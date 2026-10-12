// Capa para gráfica em CMYK: compõe as imagens da capa num raster CMYK convertido com
// LittleCMS (perfil ICC de saída real) e grava um PDF no padrão PDF/X-1a (CMYK, sem
// transparência, OutputIntent com o perfil, TrimBox/BleedBox).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { nativeImage } = require('electron');
const Isbn = require('../shared/isbn');
const CoverGeometry = require('../shared/cover');

const PROFILES = {
  fogra39: { file: 'ISOcoated_v2_eci.icc', label: 'ISO Coated v2 (ECI) — FOGRA39, papel couchê (offset Brasil/Europa)', condition: 'FOGRA39', info: 'Offset commercial and specialty printing according to ISO 12647-2:2004 / Amd 1, paper type 1 or 2 (gloss or matte coated), screen frequency 60/cm' },
  gracol: { file: 'GRACoL2013_CRPC6.icc', label: 'GRACoL 2013 (CRPC6) — couchê, padrão americano (KDP e gráficas nos EUA)', condition: 'CGATS21_CRPC6', info: 'Printing condition CGATS 21-2 CRPC6 (GRACoL 2013)' }
};

let lcmsPromise = null;
function lcms() {
  if (!lcmsPromise) lcmsPromise = import('lcms-wasm/dist/lcms.js').then(async m => ({ m, l: await m.instantiate() }));
  return lcmsPromise;
}

function profilePath(appRoot, key) {
  return path.join(appRoot, 'assets', 'icc', (PROFILES[key] || PROFILES.fogra39).file);
}
// Perfil da capa: um dos embutidos ou um ICC CMYK carregado pelo usuário (ex.: U.S. Web Coated (SWOP) v2)
function coverProfile(appRoot, cover) {
  const ci = cover && cover.customIcc;
  if (cover && cover.profile === 'custom' && ci && ci.data) {
    const buf = new Uint8Array(Buffer.from(ci.data, 'base64'));
    const desc = ci.desc || ci.name || 'Perfil ICC personalizado';
    const swop = /swop/i.test(desc);
    return { key: 'custom', buf, prof: { label: desc, condition: swop ? 'CGATS TR 001' : desc, info: swop ? 'U.S. Web Coated (SWOP) v2' : desc } };
  }
  const key = PROFILES[cover && cover.profile] ? cover.profile : 'fogra39';
  return { key, buf: new Uint8Array(fs.readFileSync(profilePath(appRoot, key))), prof: PROFILES[key] };
}
// Lê a descrição e o espaço de cor de um perfil ICC (cabeçalho + tag 'desc')
function iccInfo(buf) {
  if (!buf || buf.length < 132 || buf.toString('latin1', 36, 40) !== 'acsp') return null;
  const info = { colorSpace: buf.toString('latin1', 16, 20).trim(), cls: buf.toString('latin1', 12, 16), desc: '' };
  const n = buf.readUInt32BE(128);
  for (let i = 0; i < n && 132 + i * 12 + 12 <= buf.length; i++) {
    const o = 132 + i * 12;
    if (buf.toString('latin1', o, o + 4) !== 'desc') continue;
    const off = buf.readUInt32BE(o + 4);
    const type = buf.toString('latin1', off, off + 4);
    if (type === 'desc') { const len = buf.readUInt32BE(off + 8); info.desc = buf.toString('latin1', off + 12, off + 12 + len).replace(/\0+$/, ''); }
    else if (type === 'mluc') { const rl = buf.readUInt32BE(off + 20), ro = buf.readUInt32BE(off + 24); const u = buf.subarray(off + ro, off + ro + rl); let t = ''; for (let k = 0; k + 1 < u.length; k += 2) t += String.fromCharCode(u.readUInt16BE(k)); info.desc = t.replace(/\0+$/, ''); }
  }
  return info;
}

// ---------------------------------------------------------------- perfis embutidos nas imagens
function extractIcc(buf) {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) {
    let p = 8;
    while (p + 8 < buf.length) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      if (type === 'iCCP') {
        const data = buf.subarray(p + 8, p + 8 + len);
        const z = data.indexOf(0);
        try { return zlib.inflateSync(data.subarray(z + 2)); } catch (e) { return null; }
      }
      if (type === 'IDAT') break;
      p += 12 + len;
    }
  } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    const chunks = [];
    let p = 2;
    while (p + 4 < buf.length && buf[p] === 0xff) {
      const marker = buf[p + 1];
      const len = buf.readUInt16BE(p + 2);
      if (marker === 0xe2 && buf.toString('latin1', p + 4, p + 15) === 'ICC_PROFILE') chunks.push({ n: buf[p + 18], data: buf.subarray(p + 20, p + 2 + len) });
      if (marker === 0xda) break;
      p += 2 + len;
    }
    if (chunks.length) return Buffer.concat(chunks.sort((a, b) => a.n - b.n).map(c => c.data));
  }
  return null;
}

function jpegComponents(buf) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return 0;
  let p = 2;
  let adobe = false;
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    if (marker === 0xee && buf.toString('latin1', p + 4, p + 9) === 'Adobe') adobe = true;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xcb)) return { comps: buf[p + 9], adobe, height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
    p += 2 + len;
  }
  return 0;
}

// Imagem -> { w, h, cmyk (Uint8Array, 4 canais), alpha (Uint8Array|null), note }
async function imageToCmyk(dataUrl, outProfileBuf, opts) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) throw new Error('Imagem inválida');
  const buf = Buffer.from(m[2], 'base64');
  const { m: L, l } = await lcms();
  const jc = jpegComponents(buf);
  // JPEG já em CMYK: os valores são mantidos (sem reconversão), como numa gráfica
  if (jc && jc.comps === 4) {
    const { JpegImage } = await import('pdfjs-dist/legacy/image_decoders/pdf.image_decoders.mjs');
    const j = new JpegImage({ decodeTransform: null, colorTransform: -1 });
    j.parse(new Uint8Array(buf));
    let data = j.getData({ width: j.width, height: j.height, forceRGB: false, isSourcePDF: true });
    // em JPEGs Adobe os valores vêm invertidos
    if (jc.adobe) data = data.map(v => 255 - v);
    return { w: j.width, h: j.height, cmyk: data, alpha: null, note: 'CMYK original preservado' };
  }
  const img = nativeImage.createFromBuffer(buf);
  const { width: w, height: h } = img.getSize();
  if (!w || !h) throw new Error('Não foi possível decodificar a imagem');
  const bgra = img.toBitmap();
  const n = w * h;
  const rgb = new Uint8Array(n * 3);
  let alpha = null;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    rgb[i * 3] = bgra[j + 2]; rgb[i * 3 + 1] = bgra[j + 1]; rgb[i * 3 + 2] = bgra[j];
    if (bgra[j + 3] < 255) { if (!alpha) alpha = new Uint8Array(n).fill(255); alpha[i] = bgra[j + 3]; }
  }
  // perfil de entrada: o embutido na imagem (ex.: Adobe RGB) ou sRGB
  let input = null;
  let note = 'sRGB';
  const icc = extractIcc(buf);
  if (icc) {
    const p = l.cmsOpenProfileFromMem(new Uint8Array(icc), icc.length);
    if (p && l.cmsGetColorSpaceASCII(p) === 'RGB') { input = p; note = 'perfil embutido: ' + (l.cmsGetProfileInfoASCII(p, L.cmsInfoDescription, 'en', 'US') || 'RGB'); }
  }
  if (!input) input = l.cmsCreate_sRGBProfile();
  const out = l.cmsOpenProfileFromMem(outProfileBuf, outProfileBuf.length);
  const intent = opts.intent === 'perceptual' ? L.INTENT_PERCEPTUAL : L.INTENT_RELATIVE_COLORIMETRIC;
  const t = l.cmsCreateTransform(input, L.TYPE_RGB_8, out, L.TYPE_CMYK_8, intent, opts.bpc === false ? 0 : L.cmsFLAGS_BLACKPOINTCOMPENSATION);
  const cmyk = new Uint8Array(n * 4);
  const CH = 1 << 20;
  for (let s = 0; s < n; s += CH) {
    const len = Math.min(CH, n - s);
    cmyk.set(l.cmsDoTransform(t, rgb.subarray(s * 3, (s + len) * 3), len), s * 4);
  }
  l.cmsDeleteTransform(t);
  return { w, h, cmyk, alpha, note };
}

async function hexToCmyk(hex, outProfileBuf, opts) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex || '#ffffff');
  const x = parseInt(v ? v[1] : 'ffffff', 16);
  const { m: L, l } = await lcms();
  const input = l.cmsCreate_sRGBProfile();
  const out = l.cmsOpenProfileFromMem(outProfileBuf, outProfileBuf.length);
  const t = l.cmsCreateTransform(input, L.TYPE_RGB_8, out, L.TYPE_CMYK_8, opts.intent === 'perceptual' ? L.INTENT_PERCEPTUAL : L.INTENT_RELATIVE_COLORIMETRIC, L.cmsFLAGS_BLACKPOINTCOMPENSATION);
  const r = l.cmsDoTransform(t, new Uint8Array([(x >> 16) & 255, (x >> 8) & 255, x & 255]), 1);
  l.cmsDeleteTransform(t);
  return Array.from(r);
}

// ---------------------------------------------------------------- qualidade das imagens da capa
// Correção automática de cor: estica os níveis (preto e branco reais) com o mesmo fator nos três
// canais — não altera o matiz — e de forma suave (no máximo +30% de contraste).
function autoLevels(rgb, alpha, n) {
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (alpha && alpha[i] < 128) continue;
    hist[(rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8]++;
    count++;
  }
  if (count < 100) return false;
  const clip = count * 0.003;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < clip) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < clip) hi--;
  if (hi - lo < 40 || (lo <= 2 && hi >= 253)) return false;
  const scale = Math.min(1.3, 255 / (hi - lo));
  // se o fator foi limitado, a sobra da faixa é dividida na proporção das folgas originais
  const loT = (255 - (hi - lo) * scale) * lo / Math.max(1, lo + 255 - hi);
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.max(0, Math.min(255, Math.round(loT + (v - lo) * scale)));
  for (let i = 0; i < n * 3; i++) rgb[i] = lut[rgb[i]];
  return true;
}
// Nitidez (máscara de nitidez): realça bordas sem criar halos em áreas lisas (limiar)
function unsharp(rgb, w, h, amount, threshold) {
  const blur = new Uint8Array(rgb.length);
  const tmp = new Uint16Array(rgb.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const i = (y * w + x) * 3 + c;
    const l = x > 0 ? i - 3 : i, r = x < w - 1 ? i + 3 : i;
    tmp[i] = rgb[l] + 2 * rgb[i] + rgb[r];
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const i = (y * w + x) * 3 + c;
    const u = y > 0 ? i - w * 3 : i, d = y < h - 1 ? i + w * 3 : i;
    blur[i] = (tmp[u] + 2 * tmp[i] + tmp[d] + 8) >> 4;
  }
  for (let i = 0; i < rgb.length; i++) {
    const diff = rgb[i] - blur[i];
    if (Math.abs(diff) > threshold) rgb[i] = Math.max(0, Math.min(255, Math.round(rgb[i] + amount * diff)));
  }
}
// Recorte para preencher (sem bordas brancas) ou esticar, no tamanho exato em pixels
function cropRect(sw, sh, tw, th, fit) {
  if (fit === 'stretch') return { x: 0, y: 0, w: sw, h: sh };
  const scale = Math.max(tw / sw, th / sh);
  const cw = Math.min(sw, Math.max(1, Math.round(tw / scale)));
  const ch = Math.min(sh, Math.max(1, Math.round(th / scale)));
  return { x: Math.floor((sw - cw) / 2), y: Math.floor((sh - ch) / 2), w: cw, h: ch };
}
function resampleCmyk(src, sw, sh, crop, tw, th) {
  // bilinear sobre os valores CMYK originais (preservados)
  const out = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const fy = crop.y + (y + 0.5) * crop.h / th - 0.5;
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(sh - 1, y0 + 1), ty = Math.max(0, fy - y0);
    for (let x = 0; x < tw; x++) {
      const fx = crop.x + (x + 0.5) * crop.w / tw - 0.5;
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(sw - 1, x0 + 1), tx = Math.max(0, fx - x0);
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * sw + x0) * 4 + c], b = src[(y0 * sw + x1) * 4 + c], d = src[(y1 * sw + x0) * 4 + c], e = src[(y1 * sw + x1) * 4 + c];
        out[(y * tw + x) * 4 + c] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty);
      }
    }
  }
  return out;
}
// Imagem -> CMYK já recortada e redimensionada para tw × th pixels
async function imageToCmykFitted(dataUrl, outProfileBuf, opts, tw, th, fit) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) throw new Error('Imagem inválida');
  const buf = Buffer.from(m[2], 'base64');
  const jc = jpegComponents(buf);
  if (jc && jc.comps === 4) {
    const full = await imageToCmyk(dataUrl, outProfileBuf, opts);
    const crop = cropRect(full.w, full.h, tw, th, fit);
    return { w: tw, h: th, cmyk: resampleCmyk(full.cmyk, full.w, full.h, crop, tw, th), alpha: null, srcW: full.w, srcH: full.h, crop, note: full.note };
  }
  const img = nativeImage.createFromBuffer(buf);
  const { width: sw, height: sh } = img.getSize();
  if (!sw || !sh) throw new Error('Não foi possível decodificar a imagem');
  const crop = cropRect(sw, sh, tw, th, fit);
  let part = (crop.x || crop.y || crop.w !== sw || crop.h !== sh) ? img.crop({ x: crop.x, y: crop.y, width: crop.w, height: crop.h }) : img;
  if (part.getSize().width !== tw || part.getSize().height !== th) part = part.resize({ width: tw, height: th, quality: 'best' });
  const bgra = part.toBitmap();
  const n = tw * th;
  const rgb = new Uint8Array(n * 3);
  let alpha = null;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    rgb[i * 3] = bgra[j + 2]; rgb[i * 3 + 1] = bgra[j + 1]; rgb[i * 3 + 2] = bgra[j];
    if (bgra[j + 3] < 255) { if (!alpha) alpha = new Uint8Array(n).fill(255); alpha[i] = bgra[j + 3]; }
  }
  const fixes = [];
  if (opts.enhance !== false && autoLevels(rgb, alpha, n)) fixes.push('cor corrigida');
  if (opts.sharpen !== false && n > 4) { unsharp(rgb, tw, th, opts.dpi && opts.dpi < 150 ? 0.35 : 0.6, 3); fixes.push('nitidez'); }
  const { m: L, l } = await lcms();
  let input = null;
  let note = 'sRGB';
  const icc = extractIcc(buf);
  if (icc) {
    const p = l.cmsOpenProfileFromMem(new Uint8Array(icc), icc.length);
    if (p && l.cmsGetColorSpaceASCII(p) === 'RGB') { input = p; note = 'perfil embutido: ' + (l.cmsGetProfileInfoASCII(p, L.cmsInfoDescription, 'en', 'US') || 'RGB'); }
  }
  if (!input) input = l.cmsCreate_sRGBProfile();
  const out = l.cmsOpenProfileFromMem(outProfileBuf, outProfileBuf.length);
  const t = l.cmsCreateTransform(input, L.TYPE_RGB_8, out, L.TYPE_CMYK_8, opts.intent === 'perceptual' ? L.INTENT_PERCEPTUAL : L.INTENT_RELATIVE_COLORIMETRIC, opts.bpc === false ? 0 : L.cmsFLAGS_BLACKPOINTCOMPENSATION);
  const cmykOut = new Uint8Array(n * 4);
  const CH = 1 << 20;
  for (let s0 = 0; s0 < n; s0 += CH) { const len = Math.min(CH, n - s0); cmykOut.set(l.cmsDoTransform(t, rgb.subarray(s0 * 3, (s0 + len) * 3), len), s0 * 4); }
  l.cmsDeleteTransform(t);
  return { w: tw, h: th, cmyk: cmykOut, alpha, srcW: sw, srcH: sh, crop, note: note + (fixes.length ? ' · ' + fixes.join(' e ') : '') };
}
// Copia pixel a pixel (sem reescala) para a posição inteira x0,y0, com alfa
function blit(dst, DW, DH, src, x0, y0) {
  for (let y = 0; y < src.h; y++) {
    const dy = y0 + y;
    if (dy < 0 || dy >= DH) continue;
    for (let x = 0; x < src.w; x++) {
      const dx = x0 + x;
      if (dx < 0 || dx >= DW) continue;
      const si = y * src.w + x, di = (dy * DW + dx) * 4;
      const a = src.alpha ? src.alpha[si] / 255 : 1;
      if (a >= 1) { dst[di] = src.cmyk[si * 4]; dst[di + 1] = src.cmyk[si * 4 + 1]; dst[di + 2] = src.cmyk[si * 4 + 2]; dst[di + 3] = src.cmyk[si * 4 + 3]; }
      else if (a > 0) for (let k = 0; k < 4; k++) dst[di + k] = Math.round(dst[di + k] * (1 - a) + src.cmyk[si * 4 + k] * a);
    }
  }
}

// Desenha uma imagem CMYK (com alfa opcional) num retângulo do raster de saída (cover/contain)
function drawInto(dst, DW, DH, src, rect, fit) {
  const { x, y, w, h } = rect;
  if (w <= 0 || h <= 0) return;
  const sr = src.w / src.h;
  const rr = w / h;
  let dw = w, dh = h, ox = 0, oy = 0;
  if (fit === 'contain') { if (sr > rr) { dh = w / sr; oy = (h - dh) / 2; } else { dw = h * sr; ox = (w - dw) / 2; } }
  else { if (sr > rr) { dw = h * sr; ox = (w - dw) / 2; } else { dh = w / sr; oy = (h - dh) / 2; } }
  const x0 = Math.max(Math.round(x), 0), x1 = Math.min(Math.round(x + w), DW);
  const y0 = Math.max(Math.round(y), 0), y1 = Math.min(Math.round(y + h), DH);
  for (let py = y0; py < y1; py++) {
    const sy = ((py + 0.5 - y - oy) / dh) * src.h;
    if (sy < 0 || sy >= src.h) continue;
    const syi = Math.min(src.h - 1, Math.floor(sy));
    for (let px = x0; px < x1; px++) {
      const sx = ((px + 0.5 - x - ox) / dw) * src.w;
      if (sx < 0 || sx >= src.w) continue;
      const si = syi * src.w + Math.min(src.w - 1, Math.floor(sx));
      const di = (py * DW + px) * 4;
      const a = src.alpha ? src.alpha[si] / 255 : 1;
      if (a >= 1) { dst[di] = src.cmyk[si * 4]; dst[di + 1] = src.cmyk[si * 4 + 1]; dst[di + 2] = src.cmyk[si * 4 + 2]; dst[di + 3] = src.cmyk[si * 4 + 3]; }
      else if (a > 0) { for (let k = 0; k < 4; k++) dst[di + k] = Math.round(dst[di + k] * (1 - a) + src.cmyk[si * 4 + k] * a); }
    }
  }
}

// geometry: { totalW, totalH, bleed, spine, flap, panels: {back:[x,w], spine:[x,w], front:[x,w], flapBack, flapFront} } em mm
async function compose(appRoot, cover, assets, geometry, opts) {
  const cp = coverProfile(appRoot, cover);
  const profKey = cp.key;
  const profBuf = cp.buf;
  const dpi = Math.max(72, Math.min(600, Number(opts.dpi || cover.dpi) || 300));
  const pxmm = dpi / 25.4;
  const includeBleed = opts.bleed !== false;
  const g = geometry;
  const offX = includeBleed ? 0 : g.outer;
  const offY = includeBleed ? 0 : g.outer;
  const Wmm = includeBleed ? g.totalW : g.totalW - 2 * g.outer;
  const Hmm = includeBleed ? g.totalH : g.totalH - 2 * g.outer;
  const DW = Math.round(Wmm * pxmm);
  const DH = Math.round(Hmm * pxmm);
  if (DW * DH > 160e6) throw new Error('Capa grande demais para a resolução escolhida. Reduza o dpi.');
  const dst = new Uint8Array(DW * DH * 4);
  const notes = [];
  // bordas em pixels inteiros calculadas pela mesma fórmula: painéis vizinhos não deixam frestas
  const px = mm => Math.round(mm * pxmm);
  const toRect = (xmm, wmm) => ({ x: px(xmm - offX), y: px(-offY), w: px(xmm + wmm - offX) - px(xmm - offX), h: px(g.totalH - offY) - px(-offY) });
  // fundos
  const bg = cover.bg || {};
  const fill = async (key, xmm, wmm) => {
    if (wmm <= 0) return;
    const c = cover.bgCmyk && cover.bgCmyk[key] ? cover.bgCmyk[key].map(v => Math.round(v * 2.55)) : await hexToCmyk(bg[key] || '#ffffff', profBuf, cover);
    const r = toRect(xmm, wmm);
    const x0 = Math.max(0, r.x), x1 = Math.min(DW, r.x + r.w);
    for (let y = 0; y < DH; y++) for (let x = x0; x < x1; x++) { const i = (y * DW + x) * 4; dst[i] = c[0]; dst[i + 1] = c[1]; dst[i + 2] = c[2]; dst[i + 3] = c[3]; }
  };
  const P = g.panels;
  for (const k of ['flapBack', 'back', 'spine', 'front', 'flapFront']) if (P[k]) await fill(k === 'flapBack' ? (bg.flapBack ? 'flapBack' : 'back') : k === 'flapFront' ? (bg.flapFront ? 'flapFront' : 'front') : k, P[k][0], P[k][1]);
  // imagens
  const im = cover.images || {};
  const place = async (key, rectMm) => {
    const it = im[key];
    const a = it && assets[it.asset];
    if (!a) return;
    const r = toRect(rectMm.x, rectMm.w);
    const fit = it.fit === 'stretch' ? 'stretch' : 'cover'; // nunca deixa bordas brancas
    const src = await imageToCmykFitted(a.dataUrl, profBuf, Object.assign({}, cover, { dpi }), r.w, r.h, fit);
    const eff = Math.round(src.crop.w / (rectMm.w / 25.4));
    notes.push(`${a.name || key}: ${src.srcW}×${src.srcH} px, ${src.note}${opts.dpi && opts.dpi < 200 ? '' : eff < 250 ? ` — ATENÇÃO: ${eff} dpi efetivos (ideal 300)` : ` · ${eff} dpi efetivos`}`);
    blit(dst, DW, DH, src, r.x, r.y);
  };
  if (im.wrap) await place('wrap', { x: 0, y: 0, w: g.totalW, h: g.totalH });
  for (const k of ['back', 'spine', 'front', 'flapBack', 'flapFront']) if (im[k] && P[k] && P[k][1] > 0) await place(k, { x: P[k][0], y: 0, w: P[k][1], h: g.totalH });
  // área do código de barras (opcional)
  if (cover.barcode && P.back) {
    const safe = Number(cover.safety) || 5;
    const bx = P.back[0] + P.back[1] - safe - 50 - (g.flap ? 0 : 0);
    const by = g.totalH - g.outer - safe - 30;
    const x0 = Math.round((bx - offX) * pxmm), y0 = Math.round((by - offY) * pxmm);
    for (let y = Math.max(0, y0); y < Math.min(DH, y0 + Math.round(30 * pxmm)); y++) for (let x = Math.max(0, x0); x < Math.min(DW, x0 + Math.round(50 * pxmm)); x++) dst.fill(0, (y * DW + x) * 4, (y * DW + x) * 4 + 4);
  }
  // código de barras do ISBN (prova de cor; no PDF ele é redesenhado em vetor 100% K por cima)
  const bc = barcodeFor(cover, g, opts.meta);
  if (bc && bc.lay.ok) {
    const X = mm => Math.round((mm - offX) * pxmm), Y = mm => Math.round((mm - offY) * pxmm);
    const box = (x, y, w, h, k) => { for (let yy = Math.max(0, Y(y)); yy < Math.min(DH, Y(y + h)); yy++) for (let xx = Math.max(0, X(x)); xx < Math.min(DW, X(x + w)); xx++) { const i = (yy * DW + xx) * 4; dst[i] = 0; dst[i + 1] = 0; dst[i + 2] = 0; dst[i + 3] = k; } };
    box(bc.x, bc.y, bc.lay.w, bc.lay.h, 0);
    bc.lay.rects.forEach(r => box(bc.x + r.x, bc.y + r.y, r.w, r.h, 255));
    notes.push(`Código de barras ISBN ${bc.lay.display} (EAN-13 ${bc.lay.isbn13}): ${(Math.round(bc.lay.symbolW * 100) / 100).toString().replace('.', ',')} × ${(Math.round(bc.lay.symbolH * 100) / 100).toString().replace('.', ',')} mm, preto 100% K vetorial, 2,5 mm livres ao redor`);
  } else if (bc && !bc.lay.ok) notes.push('Código de barras NÃO gerado: ' + bc.lay.error);
  // limite de tinta (TAC) informativo
  let maxTac = 0;
  for (let i = 0; i < dst.length; i += 4 * 97) { const t = dst[i] + dst[i + 1] + dst[i + 2] + dst[i + 3]; if (t > maxTac) maxTac = t; }
  return { dst, DW, DH, Wmm, Hmm, notes, maxTac, dpi, profKey, profBuf, prof: cp.prof, includeBleed, g, bc, offX, offY };
}

// Código de barras configurado na capa: { lay, x, y } em mm na capa aberta com sangria
function barcodeFor(cover, g, meta) {
  const b = cover && cover.isbnBarcode;
  if (!b || !b.enabled || !g.panels.back) return null;
  const lay = Isbn.layout(b.isbn || (meta && meta.isbn), { scale: b.scale, barHeight: b.barHeight, showIsbnText: b.showIsbnText !== false });
  if (!lay.ok) return { lay };
  const pos = Isbn.place(g, lay, b);
  return { lay, x: pos.x, y: pos.y };
}

async function buildCoverPdf(appRoot, cover, assets, meta, geometry, opts) {
  const { PDFDocument, PDFName, PDFString, PDFHexString, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = require('pdf-lib');
  const { dst, DW, DH, Wmm, Hmm, notes, maxTac, dpi, profBuf, prof, includeBleed, g, bc, offX, offY } = await compose(appRoot, cover, assets, geometry, Object.assign({}, opts || {}, { meta }));
  // ---------- PDF/X-1a ----------
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const ptmm = 72 / 25.4;
  // marcas de corte e de dobra (CEDET: 0,25 pt, deslocamento de 5 mm) — a folha cresce para recebê-las
  const mk = includeBleed ? CoverGeometry.marks(cover) : null;
  const pad = mk ? Math.max(0, mk.offset + mk.len + 2 - g.outer) : 0;
  const page = pdf.addPage([(Wmm + 2 * pad) * ptmm, (Hmm + 2 * pad) * ptmm]);
  const ctx = pdf.context;
  const imgDict = ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: DW, Height: DH, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8, Filter: 'FlateDecode' });
  const raw = zlib.deflateSync(Buffer.from(dst.buffer, dst.byteOffset, dst.length), { level: 6 });
  const imgStream = ctx.stream(raw, imgDict);
  const imgRef = ctx.register(imgStream);
  const name = page.node.newXObject('ImCapa', imgRef);
  const P = pad * ptmm;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(Wmm * ptmm, 0, 0, Hmm * ptmm, P, P), drawObject(name), popGraphicsState());
  const { PDFOperator } = require('pdf-lib');
  const emit = (txt) => page.pushOperators(...txt.split('\n').filter(Boolean).map(l => { const parts = l.trim().split(/\s+/); return PDFOperator.of(parts.pop(), parts.map(v => require('pdf-lib').PDFNumber.of(Number(v)))); }));
  // código de barras vetorial: quadro branco (0% CMYK, vaza o fundo) e barras/dígitos 100% K
  if (bc && bc.lay.ok) {
    const totalHmm = Hmm + 2 * pad;
    const ox = bc.x - offX + pad, oy = bc.y - offY + pad;
    const ops = Isbn.pathOps(bc.lay, ox, oy, totalHmm, false);
    const k = ptmm, f = v => (Math.round(v * 1000) / 1000);
    const lines = [`0 0 0 0 k`, `${f(ox * k)} ${f((totalHmm - oy - bc.lay.h) * k)} ${f(bc.lay.w * k)} ${f(bc.lay.h * k)} re`, 'f', '0 0 0 1 k'];
    page.pushOperators(pushGraphicsState());
    emit(lines.concat(ops.bars.map(x => x)).concat(['f']).join('\n'));
    emit(ops.glyphs.concat(['f']).join('\n'));
    page.pushOperators(popGraphicsState());
  }
  const b = includeBleed ? g.outer * ptmm : 0;
  const TW = Wmm * ptmm, TH = Hmm * ptmm;
  page.setMediaBox(0, 0, TW + 2 * P, TH + 2 * P);
  page.setBleedBox(P, P, TW, TH);
  page.setTrimBox(P + b, P + b, TW - 2 * b, TH - 2 * b);
  if (mk) {
    // marcas em preto de registro (100% nas quatro cores), fora da sangria
    const x1 = P + b, x2 = P + TW - b, y1 = P + b, y2 = P + TH - b;
    const off = mk.offset * ptmm, len = mk.len * ptmm;
    const L = [`${mk.weight} w`, '1 1 1 1 K'];
    const seg = (a, c) => L.push(`${f2(a[0])} ${f2(a[1])} m`, `${f2(c[0])} ${f2(c[1])} l`, 'S');
    [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].forEach(([x, y]) => {
      const sx = x === x1 ? -1 : 1, sy = y === y1 ? -1 : 1;
      seg([x + sx * off, y], [x + sx * (off + len), y]);
      seg([x, y + sy * off], [x, y + sy * (off + len)]);
    });
    // dobras: lombada (e orelhas), acima e abaixo da capa
    g.folds.forEach(fx => { const x = P + (fx - (includeBleed ? 0 : g.outer)) * ptmm; seg([x, y2 + off], [x, y2 + off + len]); seg([x, y1 - off], [x, y1 - off - len]); });
    page.pushOperators(pushGraphicsState());
    emit(L.join('\n'));
    page.pushOperators(popGraphicsState());
    notes.push(`Marcas de corte e de dobra: ${String(mk.weight).replace('.', ',')} pt, a ${String(mk.offset).replace('.', ',')} mm do corte (capa, contracapa, lombada${g.flap ? ' e orelhas' : ''})`);
  }
  const iccStream = ctx.register(ctx.stream(zlib.deflateSync(Buffer.from(profBuf)), ctx.obj({ N: 4, Filter: 'FlateDecode' })));
  const intent = ctx.obj({ Type: 'OutputIntent', S: 'GTS_PDFX', OutputConditionIdentifier: PDFString.of(prof.condition), OutputCondition: PDFString.of(prof.label), RegistryName: PDFString.of('http://www.color.org'), Info: PDFString.of(prof.info), DestOutputProfile: iccStream });
  pdf.catalog.set(PDFName.of('OutputIntents'), ctx.obj([ctx.register(intent)]));
  const now = new Date();
  const pdfDate = `D:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}Z`;
  const info = ctx.obj({
    Title: PDFString.of(`${(meta && meta.title) || 'Capa'} — capa`), Author: PDFString.of((meta && meta.author) || ''),
    Creator: PDFString.of('Diagramador de Livros'), Producer: PDFString.of('Diagramador de Livros (pdf-lib, LittleCMS)'),
    CreationDate: PDFString.of(pdfDate), ModDate: PDFString.of(pdfDate), Trapped: PDFName.of('False'),
    GTS_PDFXVersion: PDFString.of('PDF/X-1:2001'), GTS_PDFXConformance: PDFString.of('PDF/X-1a:2001')
  });
  ctx.trailerInfo.Info = ctx.register(info);
  const id = PDFHexString.of(require('crypto').randomBytes(16).toString('hex'));
  ctx.trailerInfo.ID = ctx.obj([id, id]);
  const bytes = await pdf.save({ useObjectStreams: false, addDefaultPage: false });
  // PDF/X-1a:2001 exige PDF 1.3 (o pdf-lib grava sempre 1.7 no cabeçalho; mesmo tamanho, offsets intactos)
  Buffer.from(bytes.buffer, bytes.byteOffset, 8).write('%PDF-1.3', 0, 'latin1');
  return {
    pdf: Buffer.from(bytes),
    report: { dpi, widthPx: DW, heightPx: DH, profile: prof.label, barcode: bc && bc.lay.ok ? bc.lay.isbn13 : null, marks: !!mk, sheetMm: [Wmm + 2 * pad, Hmm + 2 * pad], intent: cover.intent === 'perceptual' ? 'Perceptual' : 'Colorimétrico relativo', bpc: cover.bpc !== false, maxTac: Math.round(maxTac / 2.55), notes, sizeMm: [Wmm, Hmm], bleed: includeBleed ? g.outer : 0 }
  };
}

// Prova de cor na tela: o raster CMYK final convertido de volta para sRGB (simulação da impressão)
const f2 = v => Math.round(v * 1000) / 1000;

async function softProof(appRoot, cover, assets, geometry, dpi) {
  const c = await compose(appRoot, cover, assets, geometry, { dpi: dpi || 72, bleed: true });
  const { m: L, l } = await lcms();
  const inP = l.cmsOpenProfileFromMem(c.profBuf, c.profBuf.length);
  const outP = l.cmsCreate_sRGBProfile();
  const t = l.cmsCreateTransform(inP, L.TYPE_CMYK_8, outP, L.TYPE_RGB_8, L.INTENT_RELATIVE_COLORIMETRIC, L.cmsFLAGS_BLACKPOINTCOMPENSATION);
  const n = c.DW * c.DH;
  const rgb = l.cmsDoTransform(t, c.dst, n);
  l.cmsDeleteTransform(t);
  const bgra = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { bgra[i * 4] = rgb[i * 3 + 2]; bgra[i * 4 + 1] = rgb[i * 3 + 1]; bgra[i * 4 + 2] = rgb[i * 3]; bgra[i * 4 + 3] = 255; }
  const img = nativeImage.createFromBitmap(bgra, { width: c.DW, height: c.DH });
  return { dataUrl: dpi && dpi > 100 ? 'data:image/jpeg;base64,' + img.toJPEG(92).toString('base64') : img.toDataURL(), width: c.DW, height: c.DH, geometry: c.g, maxTac: Math.round(c.maxTac / 2.55), notes: c.notes, profile: c.prof.label };
}

module.exports = { buildCoverPdf, softProof, PROFILES, imageToCmyk, extractIcc, iccInfo };
