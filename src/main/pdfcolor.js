// Conversão de cor do miolo para gráfica. O Chromium gera PDF em RGB; aqui as cores dos
// textos/fios/fundos (operadores rg/RG) e as imagens RGB são convertidas:
//  - 'gray': escala de cinza (DeviceGray). Para miolo preto e branco: o texto sai 100% K.
//  - 'cmyk': CMYK com perfil ICC real (LittleCMS). Cinzas neutros e o preto do texto saem
//    somente em K (preto puro), como manda a boa prática de pré-impressão; cores passam
//    pelo perfil escolhido. O PDF recebe o OutputIntent com o perfil.
// As fontes continuam incorporadas (o Chromium incorpora subconjuntos de todas as fontes).
const fs = require('fs');
const zlib = require('zlib');
const { nativeImage } = require('electron');
const cmyk = require('./cmyk');

let lcmsP = null;
const lcms = () => (lcmsP = lcmsP || import('lcms-wasm/dist/lcms.js').then(async m => ({ m, l: await m.instantiate() })));

// Claridade perceptual (L* do CIELAB) de uma cor sRGB, 0..1 — usada para o cinza
function srgbLightness(r, g, b) {
  const lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const f = Y > 216 / 24389 ? Math.cbrt(Y) : (24389 / 27 * Y + 16) / 116;
  return Math.max(0, Math.min(1, (116 * f - 16) / 100));
}
const fmt = v => { const s = (Math.round(v * 10000) / 10000).toFixed(4).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s || '0'; };

async function convertPdfColor(pdfBuf, mode, appRoot, opts) {
  opts = opts || {};
  const { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray, PDFRef, PDFString, decodePDFRawStream } = require('pdf-lib');
  const doc = await PDFDocument.load(pdfBuf, { updateMetadata: false });
  const ctx = doc.context;
  const report = { mode, colors: 0, images: 0, kOnly: 0, warnings: [] };
  const profKey = opts.profile || 'fogra39';
  const prof = cmyk.PROFILES[profKey] || cmyk.PROFILES.fogra39;
  const profBuf = new Uint8Array(fs.readFileSync(require('path').join(appRoot, 'assets', 'icc', prof.file)));
  const { m: L, l } = await lcms();
  const intent = opts.intent === 'perceptual' ? L.INTENT_PERCEPTUAL : L.INTENT_RELATIVE_COLORIMETRIC;
  const outProf = l.cmsOpenProfileFromMem(profBuf, profBuf.length);
  const srgb = l.cmsCreate_sRGBProfile();
  const tSrgb = mode === 'cmyk' ? l.cmsCreateTransform(srgb, L.TYPE_RGB_8, outProf, L.TYPE_CMYK_8, intent, L.cmsFLAGS_BLACKPOINTCOMPENSATION) : null;

  // ---------- cores vetoriais ----------
  const cache = new Map();
  function convColor(r, g, b) {
    const key = `${r} ${g} ${b}`;
    if (cache.has(key)) return cache.get(key);
    let out;
    const neutral = Math.abs(r - g) < 0.004 && Math.abs(g - b) < 0.004;
    if (mode === 'gray') out = [srgbLightness(r, g, b)];
    else if (neutral) { out = [0, 0, 0, 1 - srgbLightness(r, g, b)]; report.kOnly++; }
    else { const c = l.cmsDoTransform(tSrgb, new Uint8Array([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]), 1); out = Array.from(c).map(v => v / 255); }
    cache.set(key, out);
    return out;
  }
  const NUM = '(-?(?:\\d+\\.?\\d*|\\.\\d+))';
  const RE = new RegExp(`(^|[\\s\\]>)])${NUM}\\s+${NUM}\\s+${NUM}\\s+(rg|RG)(?=[\\s/\\[(<]|$)`, 'g');
  function convertContent(text) {
    return text.replace(RE, (m, pre, r, g, b, op) => {
      report.colors++;
      const v = convColor(Number(r), Number(g), Number(b));
      const stroke = op === 'RG';
      if (mode === 'gray') return `${pre}${fmt(v[0])} ${stroke ? 'G' : 'g'}`;
      return `${pre}${v.map(fmt).join(' ')} ${stroke ? 'K' : 'k'}`;
    });
  }
  function rewriteStream(ref, obj, transform) {
    const bytes = decodePDFRawStream(obj).decode();
    const text = Buffer.from(bytes).toString('latin1');
    if (/\s(sc|scn|SC|SCN|cs|CS)\s/.test(text)) report.warnings.push('Há cores definidas por espaço de cor próprio (cs/sc) que foram mantidas.');
    if (/\ssh\s/.test(text)) report.warnings.push('Há degradês (sh) mantidos no espaço de cor original.');
    const out = Buffer.from(transform(text), 'latin1');
    const dict = obj.dict.clone(ctx);
    dict.delete(PDFName.of('DecodeParms'));
    dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    ctx.assign(ref, PDFRawStream.of(dict, zlib.deflateSync(out)));
  }
  const groupCs = dict => {
    const grp = dict.lookup(PDFName.of('Group'));
    if (grp instanceof PDFDict && grp.get(PDFName.of('CS'))) grp.set(PDFName.of('CS'), PDFName.of(mode === 'gray' ? 'DeviceGray' : 'DeviceCMYK'));
  };

  // conteúdos das páginas
  const contentRefs = new Set();
  doc.getPages().forEach(pg => {
    const c = pg.node.get(PDFName.of('Contents'));
    if (c instanceof PDFRef) contentRefs.add(c.toString());
    else if (c instanceof PDFArray) c.asArray().forEach(r => r instanceof PDFRef && contentRefs.add(r.toString()));
    groupCs(pg.node);
  });

  // ---------- imagens ----------
  async function iccInputFor(cs) {
    if (cs instanceof PDFArray && String(cs.get(0)) === '/ICCBased') {
      const st = ctx.lookup(cs.get(1));
      try { const b = decodePDFRawStream(st).decode(); return { n: Number(String(st.dict.get(PDFName.of('N')))), buf: new Uint8Array(b) }; } catch (e) { return null; }
    }
    return null;
  }
  async function convertImage(ref, obj) {
    const d = obj.dict;
    const cs = d.lookup(PDFName.of('ColorSpace'));
    const csName = cs instanceof PDFArray ? String(cs.get(0)) : String(cs);
    const icc = await iccInputFor(cs);
    const isRgb = csName === '/DeviceRGB' || (icc && icc.n === 3);
    // sGray sem perfil incorporado (CEDET): cinza com ICC vira DeviceGray, valores mantidos
    if (mode === 'gray' && opts.noProfile && icc && icc.n === 1) {
      const dict = d.clone(ctx);
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
      ctx.assign(ref, PDFRawStream.of(dict, obj.contents));
      report.images++;
      return;
    }
    if (!isRgb) {
      if (csName === '/Indexed') report.warnings.push('Imagem com paleta indexada mantida no espaço de cor original.');
      return;
    }
    const w = Number(String(d.get(PDFName.of('Width'))));
    const h = Number(String(d.get(PDFName.of('Height'))));
    const filter = String(d.lookup(PDFName.of('Filter')) || '');
    const bpc = Number(String(d.get(PDFName.of('BitsPerComponent')) || 8));
    let rgb;
    if (/DCTDecode/.test(filter)) {
      const img = nativeImage.createFromBuffer(Buffer.from(obj.contents));
      const bgra = img.toBitmap();
      if (!bgra.length) { report.warnings.push('Imagem JPEG não decodificada (mantida em RGB).'); return; }
      rgb = new Uint8Array(w * h * 3);
      for (let i = 0, j = 0; i < w * h; i++, j += 4) { rgb[i * 3] = bgra[j + 2]; rgb[i * 3 + 1] = bgra[j + 1]; rgb[i * 3 + 2] = bgra[j]; }
    } else {
      if (bpc !== 8 || d.get(PDFName.of('DecodeParms'))) { report.warnings.push('Imagem com codificação especial mantida em RGB.'); return; }
      try { rgb = decodePDFRawStream(obj).decode(); } catch (e) { report.warnings.push('Imagem não decodificada (mantida em RGB).'); return; }
      if (rgb.length < w * h * 3) { report.warnings.push('Imagem com tamanho inesperado mantida em RGB.'); return; }
    }
    const input = icc ? l.cmsOpenProfileFromMem(icc.buf, icc.buf.length) : l.cmsCreate_sRGBProfile();
    let out, comps;
    if (mode === 'gray') {
      // sRGB -> CMYK -> K não seria fiel; o cinza usa a claridade perceptual (L*)
      comps = 1;
      out = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) out[i] = Math.round(srgbLightness(rgb[i * 3] / 255, rgb[i * 3 + 1] / 255, rgb[i * 3 + 2] / 255) * 255);
    } else {
      comps = 4;
      const t = l.cmsCreateTransform(input, L.TYPE_RGB_8, outProf, L.TYPE_CMYK_8, intent, L.cmsFLAGS_BLACKPOINTCOMPENSATION);
      out = new Uint8Array(w * h * 4);
      const CH = 1 << 20;
      for (let s = 0; s < w * h; s += CH) { const len = Math.min(CH, w * h - s); out.set(l.cmsDoTransform(t, rgb.subarray(s * 3, (s + len) * 3), len), s * 4); }
      l.cmsDeleteTransform(t);
    }
    const dict = d.clone(ctx);
    dict.set(PDFName.of('ColorSpace'), PDFName.of(comps === 1 ? 'DeviceGray' : 'DeviceCMYK'));
    dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    dict.delete(PDFName.of('DecodeParms'));
    dict.delete(PDFName.of('Decode'));
    ctx.assign(ref, PDFRawStream.of(dict, zlib.deflateSync(Buffer.from(out.buffer, out.byteOffset, out.length), { level: 6 })));
    report.images++;
  }

  const all = ctx.enumerateIndirectObjects();
  for (const [ref, obj] of all) {
    if (!(obj instanceof PDFRawStream)) continue;
    const st = String(obj.dict.get(PDFName.of('Subtype')) || '');
    const isForm = st === '/Form';
    const isTiling = String(obj.dict.get(PDFName.of('PatternType')) || '') === '1';
    if (st === '/Image') { await convertImage(ref, obj); continue; }
    if (isForm || isTiling || contentRefs.has(ref.toString())) {
      if (isForm) groupCs(obj.dict);
      try { rewriteStream(ref, obj, convertContent); } catch (e) { report.warnings.push('Conteúdo não convertido: ' + e.message); }
    } else if (obj.dict.get(PDFName.of('ShadingType'))) report.warnings.push('Degradê mantido em RGB.');
  }
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('ShadingType'))) report.warnings.push('Degradê mantido em RGB.');
  }
  if (tSrgb) l.cmsDeleteTransform(tSrgb);

  // miolo só em preto (CEDET): confere as separações — desligando o preto, nada pode sobrar
  if (mode === 'gray') {
    const bad = new Set();
    for (const [, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const st = String(obj.dict.get(PDFName.of('Subtype')) || '');
      if (st === '/Image') {
        if (String(obj.dict.get(PDFName.of('ImageMask')) || '') === 'true') continue;
        const cs = obj.dict.lookup(PDFName.of('ColorSpace'));
        const n = cs instanceof PDFArray ? String(cs.get(0)) : String(cs);
        if (n !== '/DeviceGray' && !(n === '/ICCBased' && !opts.noProfile)) bad.add('imagem em ' + n.replace('/', ''));
      } else if (st === '/Form' || contentRefs.has(String(obj))) { /* conferido abaixo */ }
    }
    const contents = [];
    doc.getPages().forEach(pg => { const c = pg.node.get(PDFName.of('Contents')); (c instanceof PDFArray ? c.asArray() : [c]).forEach(r => r instanceof PDFRef && contents.push(ctx.lookup(r))); });
    for (const [, obj] of ctx.enumerateIndirectObjects()) if (obj instanceof PDFRawStream && String(obj.dict.get(PDFName.of('Subtype')) || '') === '/Form') contents.push(obj);
    contents.forEach(obj => {
      try {
        const t = Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1');
        if (/[\d.]\s+(rg|RG)(?=[\s/\[(<]|$)/m.test(t)) bad.add('cor RGB em textos ou fios');
        if (/[\d.]\s+(k|K)(?=[\s/\[(<]|$)/m.test(t)) bad.add('cor CMYK em textos ou fios');
        if (/\s(scn?|SCN?)\s/.test(t)) bad.add('cor em espaço de cor próprio');
        if (/\ssh\s/.test(t)) bad.add('degradê');
      } catch (e) { /* stream não decodificável: ignorado */ }
    });
    report.onlyBlack = bad.size === 0;
    report.nonBlack = [...bad];
  }
  if (opts.noProfile) {
    // sGray sem perfis incorporados, como pede o manual Cedet
    doc.catalog.delete(PDFName.of('OutputIntents'));
    report.warnings = [...new Set(report.warnings)];
    report.profile = 'sGray, sem perfil incorporado';
    return { pdf: Buffer.from(await doc.save({ useObjectStreams: false })), report };
  }
  // perfil de saída (OutputIntent) para a gráfica saber a condição de impressão
  const iccStream = ctx.register(ctx.stream(zlib.deflateSync(Buffer.from(profBuf)), ctx.obj({ N: 4, Filter: 'FlateDecode' })));
  const oi = ctx.obj({ Type: 'OutputIntent', S: 'GTS_PDFX', OutputConditionIdentifier: PDFString.of(prof.condition), OutputCondition: PDFString.of(prof.label), RegistryName: PDFString.of('http://www.color.org'), Info: PDFString.of(prof.info), DestOutputProfile: iccStream });
  doc.catalog.set(PDFName.of('OutputIntents'), ctx.obj([ctx.register(oi)]));
  report.warnings = [...new Set(report.warnings)];
  report.profile = prof.label;
  return { pdf: Buffer.from(await doc.save({ useObjectStreams: false })), report };
}

module.exports = { convertPdfColor, srgbLightness };
