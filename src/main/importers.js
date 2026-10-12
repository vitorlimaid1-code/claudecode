// Leitura de manuscritos. O processo principal extrai o conteúdo bruto;
// a interface (sanitize.js) padroniza tudo para os estilos do livro.
const fs = require('fs');
const path = require('path');

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };

async function importDocx(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.convertToHtml({ path: filePath }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Título'] => h1:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Título 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Título 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Título 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Título 4'] => h4:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Subtítulo'] => h2:fresh",
      "p[style-name='Quote'] => blockquote > p:fresh",
      "p[style-name='Citação'] => blockquote > p:fresh",
      "p[style-name='Intense Quote'] => p.phrase:fresh",
      "p[style-name='Citação Intensa'] => p.phrase:fresh",
      "p[style-name='Caption'] => p.caption:fresh",
      "p[style-name='Legenda'] => p.caption:fresh",
      "p[style-name='Bibliography'] => p.reference:fresh",
      "p[style-name='Bibliografia'] => p.reference:fresh",
      'u => u',
      'strike => s',
      "r[style-name='Footnote Reference'] =>",
      "r[style-name='Ref. de nota de rodapé'] =>"
    ]
  });
  return { kind: 'html', html: result.value, notesFormat: 'mammoth' };
}

// O word-extractor descarta o caractere de referência de nota (0x02). Antes de carregá-lo,
// trocamos esse caractere por um marcador para saber onde cada nota estava no texto.
const NOTE_MARK = '\uE000';
let wordExtractorPatched = false;
function getWordExtractor() {
  if (!wordExtractorPatched) {
    const filters = require('word-extractor/lib/filters');
    const orig = filters.clean;
    filters.clean = s => orig(String(s).replace(/\x02/g, NOTE_MARK));
    wordExtractorPatched = true;
  }
  return require('word-extractor');
}

async function importDoc(filePath) {
  const WordExtractor = getWordExtractor();
  const doc = await new WordExtractor().extract(filePath);
  const opts = { filterUnicode: false };
  const body = doc.getBody(opts) || '';
  const footnotes = splitNotes((doc.getFootnotes(opts) || '').replace(new RegExp(NOTE_MARK, 'g'), '\n'));
  const endnotes = splitNotes((doc.getEndnotes(opts) || '').replace(new RegExp(NOTE_MARK, 'g'), '\n'));
  return { kind: 'doc', text: body, footnotes, endnotes, noteMark: NOTE_MARK };
}

// Notas do Word chegam como texto corrido, uma por parágrafo
function splitNotes(text) {
  return String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function resolveZipPath(base, rel) {
  if (!rel) return rel;
  rel = decodeURIComponent(rel.split('#')[0]);
  if (rel.startsWith('/')) return rel.slice(1);
  const parts = path.posix.join(path.posix.dirname(base), rel);
  return path.posix.normalize(parts).replace(/^\.\//, '');
}

async function zipImagesToDataUrls(zip, docPath, html) {
  // Converte <img src> e <image xlink:href> relativos em data: URLs
  const re = /(<img\b[^>]*?\bsrc\s*=\s*["']|<image\b[^>]*?\b(?:xlink:)?href\s*=\s*["'])([^"']+)(["'])/gi;
  const jobs = [];
  html.replace(re, (m, pre, src) => { jobs.push(src); return m; });
  const map = {};
  for (const src of jobs) {
    if (/^data:/i.test(src) || map[src]) continue;
    const p = resolveZipPath(docPath, src);
    const file = zip.file(p);
    if (!file) continue;
    const mime = IMAGE_MIME[path.extname(p).toLowerCase()] || 'image/png';
    map[src] = `data:${mime};base64,${await file.async('base64')}`;
  }
  return html.replace(re, (m, pre, src, q) => map[src] ? `${pre}${map[src]}${q}` : m)
    .replace(/<image\b([^>]*?)(?:xlink:)?href=/gi, '<img $1src=');
}

async function importEpub(filePath) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const container = await zip.file('META-INF/container.xml').async('string');
  const opfPath = /full-path\s*=\s*"([^"]+)"/.exec(container)[1];
  const opf = await zip.file(opfPath).async('string');

  const manifest = {};
  opf.replace(/<item\b([^>]*)\/?>/g, (m, attrs) => {
    const get = n => { const r = new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`).exec(attrs); return r ? r[1] : ''; };
    manifest[get('id')] = { href: resolveZipPath(opfPath, get('href')), type: get('media-type'), props: get('properties') };
    return m;
  });
  const spine = [];
  opf.replace(/<itemref\b[^>]*idref\s*=\s*"([^"]+)"[^>]*>/g, (m, id) => { spine.push(id); return m; });
  const meta = {
    title: (/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/.exec(opf) || [])[1] || '',
    author: (/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/.exec(opf) || [])[1] || '',
    publisher: (/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/.exec(opf) || [])[1] || '',
    language: (/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/.exec(opf) || [])[1] || ''
  };

  const docs = [];
  for (const id of spine) {
    const item = manifest[id];
    if (!item || !/html|xml/.test(item.type) || /\bnav\b/.test(item.props)) continue;
    const file = zip.file(item.href);
    if (!file) continue;
    let xhtml = await file.async('string');
    const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(xhtml) || [, xhtml])[1];
    const html = await zipImagesToDataUrls(zip, item.href, body);
    docs.push({ href: item.href, html });
  }
  return { kind: 'epub', docs, meta };
}

async function importOdt(filePath) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const content = await zip.file('content.xml').async('string');
  const styles = zip.file('styles.xml') ? await zip.file('styles.xml').async('string') : '';
  const images = {};
  for (const name of Object.keys(zip.files)) {
    if (/^Pictures\//.test(name)) {
      const mime = IMAGE_MIME[path.extname(name).toLowerCase()] || 'image/png';
      images[name] = `data:${mime};base64,${await zip.file(name).async('base64')}`;
    }
  }
  return { kind: 'odt', content, styles, images };
}

// ---------- PDF ----------
// O PDF não guarda a estrutura do texto: reconstruímos parágrafos, títulos e notas
// a partir da posição e do tamanho das letras. Cabeçalhos e números de página repetidos são descartados.
async function importPdf(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const lines = [];
    let cur = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const size = Math.round(Math.hypot(it.transform[0], it.transform[1]) * 10) / 10;
      const x = it.transform[4];
      const y = it.transform[5];
      if (!it.str && !it.hasEOL) continue;
      if (!cur || Math.abs(cur.y - y) > Math.max(2, size * 0.45)) {
        // possível sobrescrito: mesmo trecho de linha, ligeiramente acima e menor
        if (cur && it.str.trim() && size < cur.size * 0.8 && y > cur.y && y - cur.y < cur.size * 0.8) {
          cur.parts.push({ text: it.str, sup: true });
          continue;
        }
        cur = { y, x, size, parts: [], maxX: x + it.width };
        lines.push(cur);
      }
      if (it.str) {
        const sup = size < cur.size * 0.8 && y > cur.y + 1;
        cur.parts.push({ text: it.str, sup });
        cur.size = Math.max(cur.size, sup ? 0 : size);
        cur.maxX = Math.max(cur.maxX, x + it.width);
      }
    }
    pages.push({ n, width: vp.width, height: vp.height, lines: lines.filter(l => l.parts.some(p => p.text.trim())) });
  }
  return { kind: 'pdf', pages };
}

async function importText(filePath) {
  let buf = fs.readFileSync(filePath);
  let text = buf.toString('utf8');
  // Arquivos antigos do Windows costumam estar em Latin-1
  if (text.includes('�')) text = buf.toString('latin1');
  return text.replace(/^﻿/, '');
}

async function importAny(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath, ext);
  let res;
  if (ext === '.docx') res = await importDocx(filePath);
  else if (ext === '.doc') res = await importDoc(filePath);
  else if (ext === '.epub') res = await importEpub(filePath);
  else if (ext === '.odt') res = await importOdt(filePath);
  else if (ext === '.pdf') res = await importPdf(filePath);
  else if (ext === '.html' || ext === '.htm' || ext === '.xhtml') res = { kind: 'html', html: await importText(filePath) };
  else if (ext === '.md' || ext === '.markdown') res = { kind: 'markdown', text: await importText(filePath) };
  else if (ext === '.rtf') res = { kind: 'text', text: rtfToText(await importText(filePath)) };
  else res = { kind: 'text', text: await importText(filePath) };
  res.name = name;
  res.ext = ext;
  return res;
}

// RTF simples -> texto (sem formatação)
function rtfToText(rtf) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'([0-9a-f]{2})/gi, (m, h) => Buffer.from([parseInt(h, 16)]).toString('latin1'))
    .replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode(n < 0 ? 65536 + Number(n) : Number(n)))
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

module.exports = { importAny, IMAGE_MIME };
