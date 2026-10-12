// MOBI (Mobipocket / Kindle) a partir do mesmo conteúdo do EPUB: texto HTML em registros PalmDOC (UTF-8),
// imagens em JPEG, capa marcada nos metadados EXTH (é a capa mostrada na biblioteca do Kindle),
// sumário com links internos (filepos), guia (sumário e início da leitura) e metadados da obra.
// Observação: para publicar na Amazon (KDP), a Amazon pede EPUB; o MOBI serve para Kindles e
// aplicativos que leem MOBI diretamente.
const { nativeImage } = require('electron');
const { dataUrlToBuffer, xmlEsc } = require('./exporters');

const REC = 4096;
const MAX_IMG = 127 * 1024; // limite clássico de imagem do formato MOBI

// Imagem em JPEG RGB com fundo branco (sem transparência), dentro do limite de tamanho
function toJpeg(buf, maxSide, maxBytes) {
  let img = nativeImage.createFromBuffer(buf);
  if (img.isEmpty()) return null;
  let { width, height } = img.getSize();
  // achata a transparência sobre branco
  const bmp = img.toBitmap();
  for (let i = 0; i < bmp.length; i += 4) {
    const a = bmp[i + 3] / 255;
    if (a < 1) { bmp[i] = Math.round(bmp[i] * a + 255 * (1 - a)); bmp[i + 1] = Math.round(bmp[i + 1] * a + 255 * (1 - a)); bmp[i + 2] = Math.round(bmp[i + 2] * a + 255 * (1 - a)); bmp[i + 3] = 255; }
  }
  img = nativeImage.createFromBitmap(bmp, { width, height });
  let side = Math.min(maxSide, Math.max(width, height));
  for (let tries = 0; tries < 8; tries++) {
    const k = side / Math.max(width, height);
    const im = k < 1 ? img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' }) : img;
    for (const q of [88, 80, 72, 64]) {
      const out = im.toJPEG(q);
      if (out.length <= maxBytes) return { buf: out, w: im.getSize().width, h: im.getSize().height };
    }
    side = Math.round(side * 0.8);
  }
  const im = img.resize({ width: 400 });
  return { buf: im.toJPEG(60), w: im.getSize().width, h: im.getSize().height };
}

// XHTML do EPUB -> HTML do Mobipocket
function mobiHtml(xhtml, imgIndex, fileOf) {
  let h = String(xhtml || '');
  h = h.replace(/<\?xml[^>]*>/g, '').replace(/\sxmlns(:\w+)?="[^"]*"/g, '').replace(/\s(epub:type|role|hidden|lang|xml:lang)="[^"]*"/g, '');
  h = h.replace(/<img\b([^>]*?)data-asset="([^"]+)"([^>]*?)\/?>/g, (m, a, id) => (imgIndex[id] ? `<img recindex="${String(imgIndex[id]).padStart(5, '0')}" />` : ''));
  h = h.replace(/<(\/?)(section|aside|nav|figure|header|footer|article|main)\b([^>]*)>/g, (m, close, tag, attrs) => (close ? '</div>' : `<div${tag === 'figure' ? ' align="center"' : ''}${(/\sid="[^"]+"/.exec(attrs) || [''])[0]}>`));
  h = h.replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g, '<p align="center"><i>$1</i></p>');
  h = h.replace(/<p\b([^>]*)class="([^"]*)"([^>]*)>/g, (m, a, cls, b) => `<p${a}${b}${/scene|phrase|center/.test(cls) ? ' align="center"' : /epigraph/.test(cls) ? ' align="right"' : ''}>`);
  h = h.replace(/\sstyle="[^"]*text-align:\s*(center|right|left|justify)[^"]*"/g, ' align="$1"').replace(/\s(style|class|data-[\w-]+)="[^"]*"/g, '');
  // âncoras: cada id vira um marcador <a name> antes do elemento (os links usam a posição em bytes)
  h = h.replace(/<(\w+)([^>]*?)\sid="([^"]+)"([^>]*)>/g, (m, tag, a, id, b) => `<a name="${id}"></a><${tag}${a}${b}>`);
  h = h.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>/g, (m, a, href, b) => {
    const mm = /^([^#]*)(?:#(.*))?$/.exec(href);
    if (/^(https?:|mailto:)/i.test(href)) return m;
    const target = mm[2] || (mm[1] ? fileOf(mm[1]) : '');
    return target ? `<a${a}filepos=\u0001${target}\u0002${b}>` : `<a${a}${b}>`;
  });
  return h;
}

function buildMobi(epub, assets) {
  const m = epub.meta || {};
  const x = epub.extra || {};
  // ---- imagens: capa primeiro (índice 1), depois as do texto
  const images = [];
  const imgIndex = {};
  let coverIdx = -1;
  if (epub.coverJpeg && epub.coverJpeg.buf) {
    const c = toJpeg(epub.coverJpeg.buf, 1600, 200 * 1024);
    if (c) { images.push(c.buf); coverIdx = 0; }
  }
  const used = new Set();
  (epub.docs || []).forEach(d => String(d.xhtml).replace(/data-asset="([^"]+)"/g, (mm, id) => used.add(id)));
  used.forEach(id => {
    const a = assets[id];
    const bin = a && dataUrlToBuffer(a.dataUrl);
    if (!bin) return;
    const j = toJpeg(bin.buf, 1000, MAX_IMG);
    if (!j) return;
    images.push(j.buf);
    imgIndex[id] = images.length; // recindex é contado a partir de 1
  });
  // ---- texto
  const files = {};
  (epub.docs || []).forEach((d, i) => { files[`chap${String(i + 1).padStart(3, '0')}.xhtml`] = `mobi-c${i + 1}`; });
  const fileOf = f => files[f] || '';
  const parts = [];
  parts.push(`<html><head><guide><reference type="toc" title="${xmlEsc(epub.tocTitle || 'Sumário')}" filepos=\u0001mobi-toc\u0002 /><reference type="text" title="Início" filepos=\u0001mobi-start\u0002 /></guide></head><body>`);
  parts.push(`<div align="center"><p align="center"><i>${xmlEsc(m.author || '')}</i></p><h1 align="center">${xmlEsc(m.title || '')}</h1>${m.subtitle ? `<p align="center">${xmlEsc(m.subtitle)}</p>` : ''}${m.publisher ? `<p align="center">${xmlEsc(m.publisher)}</p>` : ''}</div><mbp:pagebreak />`);
  if (epub.copyright) parts.push(`<div>${mobiHtml(epub.copyright, imgIndex, fileOf)}</div><mbp:pagebreak />`);
  parts.push(`<a name="mobi-toc"></a><h2>${xmlEsc(epub.tocTitle || 'Sumário')}</h2>` + (epub.docs || []).map((d, i) => `<p><a filepos=\u0001mobi-c${i + 1}\u0002>${xmlEsc(d.tocLabel || d.title)}</a></p>`).join('') + '<mbp:pagebreak />');
  (epub.docs || []).forEach((d, i) => parts.push(`${i === 0 ? '<a name="mobi-start"></a>' : ''}<a name="mobi-c${i + 1}"></a>${mobiHtml(d.xhtml, imgIndex, fileOf)}<mbp:pagebreak />`));
  parts.push('</body></html>');
  // posições: troca as referências por 10 dígitos, mede onde cada âncora ficou (em bytes) e preenche
  let html = parts.join('');
  const refs = [];
  html = html.replace(/\u0001([^\u0002]*)\u0002/g, (mm, name) => { refs.push(name); return '\u0003'.repeat(10); });
  let buf = Buffer.from(html, 'utf8');
  const anchors = {};
  const anchorRe = /<a name="([^"]+)"><\/a>/g;
  let am;
  while ((am = anchorRe.exec(html))) if (anchors[am[1]] === undefined) anchors[am[1]] = Buffer.byteLength(html.slice(0, am.index), 'utf8');
  let k = 0;
  let p = buf.indexOf(3);
  while (p >= 0 && k < refs.length) {
    buf.write(String(anchors[refs[k]] || 0).padStart(10, '0'), p, 'latin1');
    k++;
    p = buf.indexOf(3, p + 10);
  }
  const textLen = buf.length;
  // registros de texto de 4096 bytes; o caractere UTF-8 cortado no fim é completado (dados extras)
  const textRecs = [];
  for (let off = 0; off < textLen; off += REC) {
    const chunk = buf.subarray(off, Math.min(textLen, off + REC));
    let extra = Buffer.alloc(0);
    const end = off + chunk.length;
    if (end < textLen) {
      // conta bytes de continuação (10xxxxxx) logo depois do corte
      let n = 0;
      while (n < 3 && end + n < textLen && (buf[end + n] & 0xc0) === 0x80) n++;
      extra = buf.subarray(end, end + n);
    }
    textRecs.push(Buffer.concat([chunk, extra, Buffer.from([extra.length])]));
  }
  // ---- EXTH
  const exth = [];
  const add = (type, val) => { const d = Buffer.isBuffer(val) ? val : Buffer.from(String(val), 'utf8'); const h = Buffer.alloc(8); h.writeUInt32BE(type, 0); h.writeUInt32BE(8 + d.length, 4); exth.push(Buffer.concat([h, d])); };
  const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0, 0); return b; };
  String(m.author || '').split(/\s*;\s*/).filter(Boolean).forEach(a => add(100, a));
  if (m.publisher) add(101, m.publisher);
  if (m.description) add(103, m.description);
  if (m.isbn) add(104, String(m.isbn).replace(/[^0-9Xx]/g, ''));
  (x.subjects || []).forEach(sj => add(105, sj));
  const year = String(m.year || '').match(/\d{4}/);
  if (year) add(106, year[0]);
  (x.contributors || []).forEach(c => c.name && add(108, `${c.name} (${c.role})`));
  if (x.rights) add(109, x.rights);
  add(113, epub.uuid || require('crypto').randomUUID());
  if (coverIdx >= 0) { add(201, u32(coverIdx)); add(203, u32(0)); }
  add(501, 'EBOK');
  add(503, m.title || 'Livro');
  add(524, String(m.language || 'pt-BR').split('-')[0]);
  const exthBody = Buffer.concat(exth);
  const exthLen = 12 + exthBody.length;
  const exthPad = (4 - (exthLen % 4)) % 4;
  const exthHead = Buffer.alloc(12); exthHead.write('EXTH', 0, 'latin1'); exthHead.writeUInt32BE(exthLen, 4); exthHead.writeUInt32BE(exth.length, 8);
  const exthBuf = Buffer.concat([exthHead, exthBody, Buffer.alloc(exthPad)]);
  // ---- índices dos registros
  const nText = textRecs.length;
  const firstImage = nText + 1;
  const flisIdx = firstImage + images.length;
  const fcisIdx = flisIdx + 1;
  const lastContent = images.length ? firstImage + images.length - 1 : nText;
  // ---- registro 0: cabeçalho PalmDOC + MOBI + EXTH + título
  const title = Buffer.from(m.title || 'Livro', 'utf8');
  const MOBI_LEN = 232;
  const mobi = Buffer.alloc(MOBI_LEN, 0);
  mobi.write('MOBI', 0, 'latin1');
  const W = (off, v) => mobi.writeUInt32BE(v >>> 0, off);
  W(4, MOBI_LEN); W(8, 2); W(12, 65001); W(16, (Math.random() * 0xffffffff) >>> 0); W(20, 6);
  for (let o = 24; o <= 60; o += 4) W(o, 0xffffffff); // índices ortográficos/inflexões/extra: nenhum
  W(64, firstImage); // primeiro registro que não é texto
  W(68, 16 + MOBI_LEN + exthBuf.length); W(72, title.length);
  W(76, /^pt/i.test(m.language || 'pt') ? 0x0416 : 0x0409); // pt-BR (ou en-US)
  W(88, 6); W(92, images.length ? firstImage : 0xffffffff);
  W(112, 0x50); // tem EXTH
  W(148, 0xffffffff); W(152, 0xffffffff); W(156, 0); W(160, 0); W(164, 0);
  mobi.writeUInt16BE(1, 176); mobi.writeUInt16BE(lastContent, 178);
  W(180, 1); W(184, fcisIdx); W(188, 1); W(192, flisIdx); W(196, 1);
  W(208, 0xffffffff); W(212, 0); W(216, 0xffffffff); W(220, 0xffffffff);
  W(224, 1); // dados extras nos registros de texto: caractere multibyte cortado
  W(228, 0xffffffff);
  const palmdoc = Buffer.alloc(16, 0);
  palmdoc.writeUInt16BE(1, 0); // sem compressão
  palmdoc.writeUInt32BE(textLen, 4); palmdoc.writeUInt16BE(nText, 8); palmdoc.writeUInt16BE(REC, 10);
  let rec0 = Buffer.concat([palmdoc, mobi, exthBuf, title, Buffer.alloc(2)]);
  rec0 = Buffer.concat([rec0, Buffer.alloc((4 - (rec0.length % 4)) % 4)]);
  // ---- FLIS, FCIS, fim
  const seq = items => Buffer.concat(items.map(([v, size]) => { if (typeof v === 'string') return Buffer.from(v, 'latin1'); const b = Buffer.alloc(size); if (size === 2) b.writeUInt16BE(v, 0); else b.writeUInt32BE(v >>> 0, 0); return b; }));
  const flis = seq([['FLIS'], [8, 4], [65, 2], [0, 2], [0, 4], [0xffffffff, 4], [1, 2], [3, 2], [3, 4], [1, 4], [0xffffffff, 4]]); // 36 bytes
  const fcis = seq([['FCIS'], [20, 4], [16, 4], [1, 4], [0, 4], [textLen, 4], [0, 4], [32, 4], [8, 4], [1, 2], [1, 2], [0, 4]]); // 44 bytes
  const eof = Buffer.from([0xe9, 0x8e, 0x0d, 0x0a]);
  const records = [rec0, ...textRecs, ...images, flis, fcis, eof];
  // ---- banco PalmDB
  const n = records.length;
  const head = Buffer.alloc(78 + n * 8 + 2, 0);
  const pdbName = (m.title || 'Livro').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 31);
  head.write(pdbName, 0, 'latin1');
  const now = Math.floor(Date.now() / 1000);
  head.writeUInt32BE(now, 36); head.writeUInt32BE(now, 40);
  head.write('BOOK', 60, 'latin1'); head.write('MOBI', 64, 'latin1');
  head.writeUInt32BE(2 * n - 1, 68); head.writeUInt16BE(n, 76);
  let off = head.length;
  records.forEach((r, i) => { head.writeUInt32BE(off, 78 + i * 8); head.writeUInt32BE((2 * i) & 0xffffff, 78 + i * 8 + 4); off += r.length; });
  return { mobi: Buffer.concat([head, ...records]), report: { images: images.length, textBytes: textLen, cover: coverIdx >= 0 } };
}

module.exports = { buildMobi, toJpeg };
