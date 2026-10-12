// Capa para gráfica em CMYK: compõe as imagens da capa num raster CMYK convertido com
// LittleCMS (perfil ICC de saída real) e grava um PDF no padrão PDF/X-1a (CMYK, sem
// transparência, OutputIntent com o perfil, TrimBox/BleedBox).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { nativeImage } = require('electron');

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
  const profKey = cover.profile || 'fogra39';
  const profBuf = new Uint8Array(fs.readFileSync(profilePath(appRoot, profKey)));
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
  const toRect = (xmm, wmm) => ({ x: (xmm - offX) * pxmm, y: -offY * pxmm, w: wmm * pxmm, h: g.totalH * pxmm });
  // fundos
  const bg = cover.bg || {};
  const fill = async (key, xmm, wmm) => {
    if (wmm <= 0) return;
    const c = cover.bgCmyk && cover.bgCmyk[key] ? cover.bgCmyk[key].map(v => Math.round(v * 2.55)) : await hexToCmyk(bg[key] || '#ffffff', profBuf, cover);
    const r = toRect(xmm, wmm);
    const x0 = Math.max(0, Math.round(r.x)), x1 = Math.min(DW, Math.round(r.x + r.w));
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
    const src = await imageToCmyk(a.dataUrl, profBuf, cover);
    notes.push(`${a.name || key}: ${src.w}×${src.h} px, ${src.note}${src.w / (rectMm.w / 25.4) < 250 ? ` — ATENÇÃO: ${Math.round(src.w / (rectMm.w / 25.4))} dpi efetivos` : ''}`);
    drawInto(dst, DW, DH, src, { x: (rectMm.x - offX) * pxmm, y: (rectMm.y - offY) * pxmm, w: rectMm.w * pxmm, h: rectMm.h * pxmm }, it.fit || 'cover');
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
  // limite de tinta (TAC) informativo
  let maxTac = 0;
  for (let i = 0; i < dst.length; i += 4 * 97) { const t = dst[i] + dst[i + 1] + dst[i + 2] + dst[i + 3]; if (t > maxTac) maxTac = t; }
  return { dst, DW, DH, Wmm, Hmm, notes, maxTac, dpi, profKey, profBuf, includeBleed, g };
}

async function buildCoverPdf(appRoot, cover, assets, meta, geometry, opts) {
  const { PDFDocument, PDFName, PDFString, PDFHexString, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = require('pdf-lib');
  const { dst, DW, DH, Wmm, Hmm, notes, maxTac, dpi, profKey, profBuf, includeBleed, g } = await compose(appRoot, cover, assets, geometry, opts || {});
  // ---------- PDF/X-1a ----------
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const ptmm = 72 / 25.4;
  const page = pdf.addPage([Wmm * ptmm, Hmm * ptmm]);
  const ctx = pdf.context;
  const imgDict = ctx.obj({ Type: 'XObject', Subtype: 'Image', Width: DW, Height: DH, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8, Filter: 'FlateDecode' });
  const raw = zlib.deflateSync(Buffer.from(dst.buffer, dst.byteOffset, dst.length), { level: 6 });
  const imgStream = ctx.stream(raw, imgDict);
  const imgRef = ctx.register(imgStream);
  const name = page.node.newXObject('ImCapa', imgRef);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(Wmm * ptmm, 0, 0, Hmm * ptmm, 0, 0), drawObject(name), popGraphicsState());
  const b = includeBleed ? g.outer * ptmm : 0;
  page.setMediaBox(0, 0, Wmm * ptmm, Hmm * ptmm);
  page.setBleedBox(0, 0, Wmm * ptmm, Hmm * ptmm);
  page.setTrimBox(b, b, Wmm * ptmm - 2 * b, Hmm * ptmm - 2 * b);
  const prof = PROFILES[profKey] || PROFILES.fogra39;
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
    report: { dpi, widthPx: DW, heightPx: DH, profile: prof.label, intent: cover.intent === 'perceptual' ? 'Perceptual' : 'Colorimétrico relativo', bpc: cover.bpc !== false, maxTac: Math.round(maxTac / 2.55), notes, sizeMm: [Wmm, Hmm], bleed: includeBleed ? g.outer : 0 }
  };
}

// Prova de cor na tela: o raster CMYK final convertido de volta para sRGB (simulação da impressão)
async function softProof(appRoot, cover, assets, geometry) {
  const c = await compose(appRoot, cover, assets, geometry, { dpi: 72, bleed: true });
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
  return { dataUrl: img.toDataURL(), maxTac: Math.round(c.maxTac / 2.55), notes: c.notes, profile: (PROFILES[c.profKey] || PROFILES.fogra39).label };
}

module.exports = { buildCoverPdf, softProof, PROFILES, imageToCmyk, extractIcc };
