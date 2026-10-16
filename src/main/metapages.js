// VBO Refinamento → Metadados: acrescenta a página de rosto e a página da ficha catalográfica no começo de um
// livro já pronto e substitui o arquivo original (que vai para a Lixeira). O conteúdo do livro não é refeito:
//  - PDF: as duas páginas (diagramadas pelo sistema no formato de corte do livro) entram antes da primeira página,
//    alinhadas à caixa de corte (TrimBox) do original, com a mesma folha, sangria e caixas;
//  - DOCX: parágrafos do Word inseridos no começo do documento (imagem do selo incluída);
//  - EPUB: duas páginas XHTML no começo da ordem de leitura (depois da capa, se houver);
//  - HTML, TXT e Markdown: o texto das duas páginas no começo do arquivo.
// Os demais formatos chegam aqui já convertidos para DOCX pela interface.
const fs = require('fs');
const os = require('os');
const path = require('path');

const MM = 72 / 25.4;
const xmlEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUrlBytes = du => { const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(du || '')); if (!m) return null; return { mime: m[1], buf: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) }; };
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

// ---------------------------------------------------------------- PDF
async function pdfTrim(file) {
  const { PDFDocument } = require('@cantoo/pdf-lib');
  const doc = await PDFDocument.load(fs.readFileSync(file), { updateMetadata: false, ignoreEncryption: true });
  const p = doc.getPage(0);
  const t = p.getTrimBox();
  return { w: t.width / MM, h: t.height / MM, pages: doc.getPageCount(), encrypted: !!doc.isEncrypted };
}
// PDF para gráfica (folha maior que o corte): as páginas novas recebem as marcas de corte, como as do livro
function cropMarks(pg, media, trim, bleed) {
  const { rgb } = require('@cantoo/pdf-lib');
  const room = Math.min(trim.x - media.x, trim.y - media.y, media.x + media.width - (trim.x + trim.width), media.y + media.height - (trim.y + trim.height));
  if (room < 6 * MM) return;
  // distância das marcas: a da sangria do original, se ela estiver dentro da folha; senão o padrão do sistema (5 mm)
  const bl = trim.x - bleed.x;
  const off = bl > 0 && bl < room - 2 * MM ? Math.max(bl, 3 * MM) : Math.min(5 * MM, room - 3 * MM);
  const len = Math.min(5 * MM, room - off);
  if (len < 2 * MM) return;
  const k = { thickness: 0.25, color: rgb(0, 0, 0) };
  const L = trim.x, R = trim.x + trim.width, B = trim.y, T = trim.y + trim.height;
  [[L, B, -1, -1], [R, B, 1, -1], [L, T, -1, 1], [R, T, 1, 1]].forEach(([x, y, sx, sy]) => {
    pg.drawLine(Object.assign({ start: { x: x + sx * off, y }, end: { x: x + sx * (off + len), y } }, k));
    pg.drawLine(Object.assign({ start: { x, y: y + sy * off }, end: { x, y: y + sy * (off + len) } }, k));
  });
}
async function pdfMerge(orig, front, out) {
  const { PDFDocument } = require('@cantoo/pdf-lib');
  let doc;
  try { doc = await PDFDocument.load(fs.readFileSync(orig), { updateMetadata: false }); } catch (e) {
    if (/encrypt/i.test(String(e && (e.name + e.message)))) throw new Error('o PDF é protegido por senha: tire a senha em FERRAMENTAS → Remover senha e tente de novo');
    throw e;
  }
  const fr = await PDFDocument.load(fs.readFileSync(front), { updateMetadata: false });
  const p0 = doc.getPage(0);
  const media = p0.getMediaBox(), trim = p0.getTrimBox(), bleed = p0.getBleedBox();
  const n = fr.getPageCount();
  for (let i = 0; i < n; i++) {
    const emb = await doc.embedPage(fr.getPage(i));
    const pg = doc.insertPage(i, [media.width, media.height]);
    pg.setMediaBox(media.x, media.y, media.width, media.height);
    pg.drawPage(emb, { x: trim.x, y: trim.y, width: trim.width, height: trim.height });
    pg.setTrimBox(trim.x, trim.y, trim.width, trim.height);
    pg.setBleedBox(bleed.x, bleed.y, bleed.width, bleed.height);
    cropMarks(pg, media, trim, bleed);
  }
  fs.writeFileSync(out, await doc.save());
  return { pages: doc.getPageCount(), added: n };
}

// ---------------------------------------------------------------- DOCX
// xml: parágrafos (w:p) com marcadores __CVHIMGn__ no lugar do r:embed de cada imagem
async function docxMerge(orig, xml, images, out) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(orig));
  const docPath = 'word/document.xml';
  let doc = await zip.file(docPath).async('string');
  const relPath = 'word/_rels/document.xml.rels';
  let rels = zip.file(relPath) ? await zip.file(relPath).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let ct = await zip.file('[Content_Types].xml').async('string');
  (images || []).forEach((im, i) => {
    const bin = dataUrlBytes(im.dataUrl);
    if (!bin) { xml = xml.split(`__CVHIMG${i}__`).join(''); return; }
    const ext = EXT[bin.mime] || 'png';
    let name = `cvh-selo-${i + 1}.${ext}`;
    for (let k = 2; zip.file('word/media/' + name); k++) name = `cvh-selo-${i + 1}-${k}.${ext}`;
    zip.file('word/media/' + name, bin.buf);
    let rid = `rIdCvhSelo${i + 1}`;
    for (let k = 2; rels.includes(`Id="${rid}"`); k++) rid = `rIdCvhSelo${i + 1}x${k}`;
    rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/></Relationships>`);
    if (!new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace(/<Types\b[^>]*>/, m => `${m}<Default Extension="${ext}" ContentType="${bin.mime}"/>`);
    xml = xml.split(`__CVHIMG${i}__`).join(rid);
  });
  // namespaces usados pelas imagens (os documentos do Word já os declaram; os de outros programas, às vezes não)
  const root = /<w:document\b[^>]*>/.exec(doc);
  if (root) {
    let tag = root[0];
    const need = { 'xmlns:wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'xmlns:pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture' };
    Object.entries(need).forEach(([k, v]) => { if (!tag.includes(k + '=')) tag = tag.replace(/>$/, ` ${k}="${v}">`); });
    doc = doc.replace(root[0], tag);
  }
  const body = /<w:body\b[^>]*>/.exec(doc);
  if (!body) throw new Error('documento do Word sem corpo de texto');
  doc = doc.slice(0, body.index + body[0].length) + xml + doc.slice(body.index + body[0].length);
  zip.file(docPath, doc);
  zip.file(relPath, rels);
  zip.file('[Content_Types].xml', ct);
  fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  return {};
}

// ---------------------------------------------------------------- EPUB
async function epubMerge(orig, pages, css, images, out) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(orig));
  const cont = zip.file('META-INF/container.xml') ? await zip.file('META-INF/container.xml').async('string') : '';
  const opfPath = (/full-path="([^"]+)"/.exec(cont) || [])[1];
  if (!opfPath || !zip.file(opfPath)) throw new Error('EPUB sem o arquivo de pacote (content.opf)');
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  let opf = await zip.file(opfPath).async('string');
  const items = [], refs = [];
  zip.file(dir + 'cvh-front/cvh-front.css', css);
  items.push('<item id="cvh-front-css" href="cvh-front/cvh-front.css" media-type="text/css"/>');
  (images || []).forEach((im, i) => {
    const bin = dataUrlBytes(im.dataUrl);
    if (!bin) return;
    const name = `selo-${i + 1}.${EXT[bin.mime] || 'png'}`;
    zip.file(dir + 'cvh-front/' + name, bin.buf);
    items.push(`<item id="cvh-front-img${i + 1}" href="cvh-front/${name}" media-type="${bin.mime}"/>`);
    pages = pages.map(p => Object.assign({}, p, { xhtml: p.xhtml.split(`__CVHIMG${i}__`).join(name) }));
  });
  pages.forEach((p, i) => {
    const id = `cvh-front-${i + 1}`;
    zip.file(`${dir}cvh-front/${p.file}`, p.xhtml);
    items.push(`<item id="${id}" href="cvh-front/${p.file}" media-type="application/xhtml+xml"/>`);
    refs.push(`<itemref idref="${id}"/>`);
  });
  opf = opf.replace(/<\/(?:opf:)?manifest>/, m => items.join('') + m);
  // depois da capa (se a primeira página for a capa), senão no começo
  const spine = /<(?:opf:)?spine\b[^>]*>/.exec(opf);
  if (!spine) throw new Error('EPUB sem a ordem de leitura (spine)');
  const after = opf.slice(spine.index + spine[0].length);
  const first = /^\s*<(?:opf:)?itemref\b[^>]*idref="([^"]+)"[^>]*\/?>(?:\s*<\/(?:opf:)?itemref>)?/.exec(after);
  let at = spine.index + spine[0].length;
  if (first) {
    const href = (new RegExp(`<(?:opf:)?item\\b[^>]*id="${first[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`).exec(opf) || [''])[0];
    if (/cover|capa/i.test(first[1]) || /cover|capa/i.test(href)) at += first[0].length;
  }
  opf = opf.slice(0, at) + refs.join('') + opf.slice(at);
  zip.file(opfPath, opf);
  // mimetype precisa ser o primeiro arquivo, sem compressão
  const outZip = new JSZip();
  outZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(n => n !== 'mimetype');
  for (const n of names) { const f = zip.files[n]; if (f.dir) outZip.folder(n); else outZip.file(n, await f.async('nodebuffer')); }
  fs.writeFileSync(out, await outZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/epub+zip' }));
  return {};
}

// ---------------------------------------------------------------- HTML, TXT, Markdown
function textMerge(orig, kind, front, out) {
  let raw = fs.readFileSync(orig);
  let s = raw.toString('utf8');
  const bom = s.charCodeAt(0) === 0xfeff;
  if (bom) s = s.slice(1);
  if (kind === 'html') {
    const css = `<style>${front.css}</style>`;
    s = /<\/head>/i.test(s) ? s.replace(/<\/head>/i, css + '</head>') : css + s;
    const b = /<body\b[^>]*>/i.exec(s);
    s = b ? s.slice(0, b.index + b[0].length) + front.html + s.slice(b.index + b[0].length) : front.html + s;
  } else s = front.text + s;
  fs.writeFileSync(out, (bom ? '﻿' : '') + s, 'utf8');
  return {};
}

function registerMetaPages({ ipcMain, app, shell }) {
  ipcMain.handle('meta:tmp', (e, ext) => path.join(app.getPath('temp'), `cvh-meta-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${String(ext || 'tmp').replace(/[^a-z0-9]/gi, '')}`));
  ipcMain.handle('meta:pdfTrim', async (e, file) => { try { return await pdfTrim(file); } catch (err) { return { error: String(err.message || err) }; } });
  ipcMain.handle('meta:merge', async (e, req) => {
    try {
      const out = path.join(app.getPath('temp'), `cvh-meta-out-${Date.now()}${path.extname(req.orig)}`);
      let r = {};
      if (req.kind === 'pdf') r = await pdfMerge(req.orig, req.front, out);
      else if (req.kind === 'docx') r = await docxMerge(req.orig, req.xml, req.images, out);
      else if (req.kind === 'epub') r = await epubMerge(req.orig, req.pages, req.css, req.images, out);
      else if (req.kind === 'html' || req.kind === 'text') r = textMerge(req.orig, req.kind, req.front, out);
      else return { error: 'formato não suportado' };
      if (!fs.existsSync(out) || fs.statSync(out).size < 20) return { error: 'o arquivo novo não foi gravado' };
      return Object.assign({ ok: true, out }, r);
    } catch (err) { return { error: String(err.message || err) }; }
  });
  // substitui o original: ele vai para a Lixeira e o arquivo novo fica no lugar (mesmo nome; outra extensão se
  // o formato mudou, ex.: DOC → DOCX)
  ipcMain.handle('meta:replace', async (e, orig, made) => {
    try {
      if (!orig || !fs.existsSync(orig)) return { error: 'arquivo original não encontrado' };
      if (!made || !fs.existsSync(made) || fs.statSync(made).size < 20) return { error: 'o arquivo novo não foi conferido; o original foi mantido' };
      const ext = path.extname(made);
      let dest = path.join(path.dirname(orig), path.basename(orig, path.extname(orig)) + ext);
      const same = path.resolve(dest).toLowerCase() === path.resolve(orig).toLowerCase();
      if (!same) for (let i = 2; fs.existsSync(dest); i++) dest = path.join(path.dirname(orig), `${path.basename(orig, path.extname(orig))} (${i})${ext}`);
      let trashed = true;
      try { await shell.trashItem(orig); } catch (err) {
        // sem Lixeira (alguns discos de rede): guarda uma cópia de segurança ao lado
        trashed = false;
        fs.copyFileSync(orig, path.join(os.tmpdir(), 'cvh-original-' + Date.now() + '-' + path.basename(orig)));
        if (same) fs.unlinkSync(orig);
      }
      try { fs.renameSync(made, dest); } catch (err) { fs.copyFileSync(made, dest); fs.unlinkSync(made); }
      return { ok: true, file: dest, trashed };
    } catch (err) { return { error: String(err.message || err) }; }
  });
}

module.exports = { registerMetaPages, pdfMerge, docxMerge, epubMerge, textMerge, pdfTrim };
