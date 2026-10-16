/* global ImgCodecs */
// Trabalho pesado da tela Ferramentas, fora da interface: leitura dos formatos que o navegador entende,
// redimensionamento, gravação em todos os formatos de saída, máscara da remoção de fundo e recorte.
importScripts('../shared/imgcodecs.js');

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' };

function canvasOf(img) {
  const c = new OffscreenCanvas(img.width, img.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height), 0, 0);
  return c;
}
function rgbaOf(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data: new Uint8Array(d.buffer) };
}
async function decode(bytes, mime) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime || '' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'default' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  return rgbaOf(c);
}
// redimensiona com reduções sucessivas pela metade (mais nítido que um salto só)
function resize(img, w, h) {
  if (w === img.width && h === img.height) return img;
  let c = canvasOf(img);
  while (c.width / 2 >= w && c.height / 2 >= h) {
    const n = new OffscreenCanvas(Math.max(w, c.width >> 1), Math.max(h, c.height >> 1));
    const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n;
  }
  const out = new OffscreenCanvas(w, h);
  const x = out.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h);
  return rgbaOf(out);
}
function targetSize(img, o) {
  let w = img.width, h = img.height;
  if (o.scale && o.scale !== 100) { w = Math.round(w * o.scale / 100); h = Math.round(h * o.scale / 100); }
  if (o.maxW && w > o.maxW) { h = Math.round(h * o.maxW / w); w = o.maxW; }
  if (o.maxH && h > o.maxH) { w = Math.round(w * o.maxH / h); h = o.maxH; }
  return [Math.max(1, w), Math.max(1, h)];
}
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const v = m ? parseInt(m[1], 16) : 0xffffff; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
async function blobBytes(canvas, type, quality) { return new Uint8Array(await (await canvas.convertToBlob({ type, quality })).arrayBuffer()); }
function flatCanvas(img, bg) {
  const c = new OffscreenCanvas(img.width, img.height);
  const x = c.getContext('2d'); x.fillStyle = bg || '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvasOf(img), 0, 0);
  return c;
}
let avifOk = null;
async function canAvif() {
  if (avifOk !== null) return avifOk;
  try { const b = await new OffscreenCanvas(2, 2).convertToBlob({ type: 'image/avif' }); avifOk = b.type === 'image/avif'; } catch (e) { avifOk = false; }
  return avifOk;
}
function square(img, s) {
  // ícone: a imagem inteira dentro de um quadrado transparente
  const c = new OffscreenCanvas(s, s), x = c.getContext('2d');
  const k = Math.min(s / img.width, s / img.height), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  x.imageSmoothingQuality = 'high';
  x.drawImage(canvasOf(resize(img, Math.max(w, 1), Math.max(h, 1))), Math.round((s - w) / 2), Math.round((s - h) / 2));
  return c;
}
// EPS (PostScript encapsulado, o formato que muitas gráficas pedem): imagem RGB sem transparência (fundo de cor),
// comprimida (Flate) e em ASCII85, com a caixa no tamanho real pela resolução escolhida
async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(cs));
  return new Uint8Array(await out.arrayBuffer());
}
function ascii85(b) {
  let out = '', line = 0;
  const put = s => { for (const ch of s) { out += ch; if (++line >= 75) { out += '\n'; line = 0; } } };
  for (let i = 0; i < b.length; i += 4) {
    const n = Math.min(4, b.length - i);
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (k < n ? b[i + k] : 0);
    if (v === 0 && n === 4) { put('z'); continue; }
    const c = [];
    for (let k = 0; k < 5; k++) { c.unshift(String.fromCharCode(33 + (v % 85))); v = Math.floor(v / 85); }
    put(c.slice(0, n + 1).join(''));
  }
  return out + '~>';
}
async function encodeEPS(img, bg, dpi) {
  const c = flatCanvas(img, bg);
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const rgb = new Uint8Array(c.width * c.height * 3);
  for (let i = 0, j = 0; i < px.length; i += 4) { rgb[j++] = px[i]; rgb[j++] = px[i + 1]; rgb[j++] = px[i + 2]; }
  const data = ascii85(await deflate(rgb));
  const k = 72 / (dpi || 300), W = c.width * k, H = c.height * k;
  const head = `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${Math.ceil(W)} ${Math.ceil(H)}\n%%HiResBoundingBox: 0 0 ${W.toFixed(3)} ${H.toFixed(3)}\n%%LanguageLevel: 3\n%%Creator: Casa Vertigem Hub\n%%Pages: 1\n%%EndComments\n%%Page: 1 1\ngsave\n${W.toFixed(3)} ${H.toFixed(3)} scale\n/DeviceRGB setcolorspace\n<< /ImageType 1 /Width ${c.width} /Height ${c.height} /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [${c.width} 0 0 -${c.height} 0 ${c.height}] /DataSource currentfile /ASCII85Decode filter /FlateDecode filter >> image\n`;
  return new TextEncoder().encode(head + data + '\ngrestore\nshowpage\n%%EOF\n');
}
// ICNS (ícone do macOS): PNGs de 16 a 1024 px no contêiner da Apple
async function encodeICNS(img) {
  const max = Math.max(img.width, img.height);
  const types = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]].filter(([, s]) => s <= Math.max(16, max));
  const parts = [];
  for (const [t, s] of types) parts.push([t, await blobBytes(square(img, s), 'image/png')]);
  const total = 8 + parts.reduce((n, [, b]) => n + 8 + b.length, 0);
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  const tag = (at, t) => { for (let i = 0; i < 4; i++) out[at + i] = t.charCodeAt(i); };
  tag(0, 'icns'); dv.setUint32(4, total);
  let at = 8;
  for (const [t, b] of parts) { tag(at, t); dv.setUint32(at + 4, 8 + b.length); out.set(b, at + 8); at += 8 + b.length; }
  return out;
}
async function encode(img, fmt, o) {
  o = o || {};
  const [w, h] = targetSize(img, o);
  img = resize(img, w, h);
  const q = Math.max(0.3, Math.min(1, (o.quality || 92) / 100));
  const bg = o.background || '#ffffff';
  switch (fmt) {
    case 'png': return { bytes: await blobBytes(canvasOf(img), 'image/png'), ext: 'png', mime: 'image/png' };
    case 'jpeg': return { bytes: await blobBytes(flatCanvas(img, bg), 'image/jpeg', q), ext: 'jpg', mime: 'image/jpeg' };
    case 'webp': return { bytes: await blobBytes(canvasOf(img), 'image/webp', o.lossless ? 1 : q), ext: 'webp', mime: 'image/webp' };
    case 'avif': if (!(await canAvif())) throw new Error('este computador não grava AVIF'); return { bytes: await blobBytes(canvasOf(img), 'image/avif', q), ext: 'avif', mime: 'image/avif' };
    case 'gif': return { bytes: ImgCodecs.encodeGIF(img, { dither: o.dither !== false }), ext: 'gif', mime: 'image/gif' };
    case 'bmp': return { bytes: ImgCodecs.encodeBMP(img), ext: 'bmp', mime: 'image/bmp' };
    case 'tiff': return { bytes: ImgCodecs.encodeTIFF(img, o.dpi || 300), ext: 'tif', mime: 'image/tiff' };
    case 'tga': return { bytes: ImgCodecs.encodeTGA(img), ext: 'tga', mime: 'image/x-tga' };
    case 'ppm': case 'pgm': case 'pbm': case 'pam': return { bytes: ImgCodecs.encodePNM(img, fmt, hexRgb(bg)), ext: fmt, mime: 'image/x-portable-anymap' };
    case 'qoi': return { bytes: ImgCodecs.encodeQOI(img), ext: 'qoi', mime: 'image/qoi' };
    case 'ico': {
      const max = Math.max(img.width, img.height);
      const sizes = [16, 24, 32, 48, 64, 128, 256].filter(s => s <= Math.max(16, max));
      const pngs = [];
      for (const s of sizes) pngs.push({ size: s, bytes: await blobBytes(square(img, s), 'image/png') });
      return { bytes: ImgCodecs.encodeICO(pngs), ext: 'ico', mime: 'image/x-icon' };
    }
    case 'svg': {
      const b = await blobBytes(canvasOf(img), 'image/png');
      let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
      return { bytes: ImgCodecs.encodeSVG(btoa(s), img.width, img.height, 'image/png'), ext: 'svg', mime: 'image/svg+xml' };
    }
    case 'pdf': {
      // o PDF é montado no processo principal: aqui vai o PNG (com transparência) ou o JPEG (fotos)
      const jpg = o.pdfJpeg && !ImgCodecs.hasAlpha(img);
      return { bytes: await blobBytes(jpg ? flatCanvas(img, bg) : canvasOf(img), jpg ? 'image/jpeg' : 'image/png', q), ext: 'pdf', mime: jpg ? 'image/jpeg' : 'image/png', forPdf: true };
    }
    case 'psd': return { rgba: img, ext: 'psd', forPsd: true };
    case 'eps': return { bytes: await encodeEPS(img, bg, o.dpi || 300), ext: 'eps', mime: 'application/postscript' };
    case 'icns': return { bytes: await encodeICNS(img), ext: 'icns', mime: 'image/icns' };
    default: throw new Error('formato de saída desconhecido: ' + fmt);
  }
}
// máscara da IA (tamanho reduzido) → opacidade da imagem original, com borda suavizada
function applyMask(img, m, o) {
  const mc = new OffscreenCanvas(m.width, m.height);
  const md = new Uint8ClampedArray(m.width * m.height * 4);
  for (let i = 0; i < m.mask.length; i++) { md[i * 4 + 3] = m.mask[i]; }
  mc.getContext('2d').putImageData(new ImageData(md, m.width, m.height), 0, 0);
  const big = new OffscreenCanvas(img.width, img.height);
  const x = big.getContext('2d');
  x.imageSmoothingQuality = 'high';
  if (o.feather) x.filter = `blur(${Math.max(0.5, o.feather * Math.max(img.width, img.height) / 1500)}px)`;
  x.drawImage(mc, 0, 0, img.width, img.height);
  const a = x.getImageData(0, 0, img.width, img.height).data;
  const out = new Uint8Array(img.data);
  const cut = (o.threshold || 0) * 2.55;
  for (let i = 0; i < img.width * img.height; i++) {
    let v = a[i * 4 + 3];
    if (cut) v = v < cut ? 0 : Math.min(255, Math.round((v - cut) * 255 / (255 - cut + 1)));
    out[i * 4 + 3] = Math.round(out[i * 4 + 3] * v / 255);
  }
  return { width: img.width, height: img.height, data: out };
}
// recorta as sobras transparentes em volta do objeto (com uma margem)
function trim(img, pad) {
  const { width: w, height: h, data: d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return img;
  const p = pad || 0;
  x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w - 1, x1 + p); y1 = Math.min(h - 1, y1 + p);
  const c = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1);
  c.getContext('2d').drawImage(canvasOf(img), -x0, -y0);
  return rgbaOf(c);
}
// fundo é uniforme? (desvio das cores da borda)
function borderStats(img) {
  const { width: w, height: h, data: d } = img;
  const px = [];
  for (let x = 0; x < w; x += Math.max(1, w >> 6)) px.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += Math.max(1, h >> 6)) px.push(y * w, y * w + w - 1);
  const m = [0, 0, 0];
  px.forEach(k => { for (let c = 0; c < 3; c++) m[c] += d[k * 4 + c]; });
  for (let c = 0; c < 3; c++) m[c] /= px.length;
  let v = 0;
  px.forEach(k => { for (let c = 0; c < 3; c++) v += (d[k * 4 + c] - m[c]) ** 2; });
  return { std: Math.sqrt(v / (px.length * 3)), mean: m };
}

self.onmessage = async ev => {
  const { id, op } = ev.data;
  try {
    let res;
    if (op === 'decode') res = await decode(ev.data.bytes, ev.data.mime);
    else if (op === 'encode') res = await encode(ev.data.img, ev.data.fmt, ev.data.opts);
    else if (op === 'avif') res = { ok: await canAvif() };
    else if (op === 'flat') res = ImgCodecs.removeFlatBackground(ev.data.img, ev.data.opts);
    else if (op === 'mask') res = applyMask(ev.data.img, ev.data.mask, ev.data.opts || {});
    else if (op === 'trim') res = trim(ev.data.img, ev.data.pad);
    else if (op === 'border') res = borderStats(ev.data.img);
    else if (op === 'small') { const k = Math.min(1, ev.data.max / Math.max(ev.data.img.width, ev.data.img.height)); const im = resize(ev.data.img, Math.max(1, Math.round(ev.data.img.width * k)), Math.max(1, Math.round(ev.data.img.height * k))); res = { width: im.width, height: im.height, bytes: await blobBytes(canvasOf(im), 'image/png') }; }
    else throw new Error('operação desconhecida: ' + op);
    const tr = [];
    if (res && res.data && res.data.buffer) tr.push(res.data.buffer);
    if (res && res.bytes && res.bytes.buffer) tr.push(res.bytes.buffer);
    self.postMessage({ id, res }, tr);
  } catch (e) { self.postMessage({ id, error: String((e && e.message) || e) }); }
};
