// Leitura de manuscritos. O processo principal extrai o conteúdo bruto;
// a interface (sanitize.js) padroniza tudo para os estilos do livro.
const fs = require('fs');
const path = require('path');

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };

// Gráficos nativos do Word (DrawingML): lê os valores guardados no próprio gráfico (séries, categorias,
// tipo e título) para recriá-los como gráficos do livro, no mesmo lugar do texto.
function parseWordChart(xml) {
  const tag = (x, t) => (new RegExp(`<c:${t}\\b[^>]*?(?:/>|>([\\s\\S]*?)</c:${t}>)`).exec(x) || []);
  const attr = (x, t) => (new RegExp(`<c:${t}\\b[^>]*\\bval="([^"]*)"`).exec(x) || [])[1];
  const pts = x => { const out = []; String(x || '').replace(/<c:pt\b[^>]*idx="(\d+)"[^>]*>\s*<c:v>([\s\S]*?)<\/c:v>/g, (m, i, v) => { out[Number(i)] = v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); return m; }); return out; };
  const types = [['barChart', 'bar'], ['bar3DChart', 'bar'], ['lineChart', 'line'], ['line3DChart', 'line'], ['areaChart', 'area'], ['area3DChart', 'area'], ['pieChart', 'pie'], ['pie3DChart', 'pie'], ['doughnutChart', 'donut'], ['scatterChart', 'line'], ['radarChart', 'line']];
  const found = types.find(([t]) => new RegExp(`<c:${t}\\b`).test(xml));
  if (!found) return null;
  const block = tag(xml, found[0])[1] || '';
  let type = found[1];
  if (type === 'bar') {
    if (attr(block, 'barDir') === 'bar') type = 'hbar';
    if (/stacked/i.test(attr(block, 'grouping') || '')) type = 'stacked';
  }
  const series = [];
  let labels = [];
  block.replace(/<c:ser>([\s\S]*?)<\/c:ser>/g, (m, ser) => {
    const name = (pts(tag(ser, 'tx')[1]) || [])[0] || (/<a:t>([^<]*)<\/a:t>/.exec(tag(ser, 'tx')[1] || '') || [])[1] || `Série ${series.length + 1}`;
    const cat = pts(tag(ser, 'cat')[1] || tag(ser, 'xVal')[1]);
    const val = pts(tag(ser, 'val')[1] || tag(ser, 'yVal')[1]).map(v => Number(v) || 0);
    if (cat.length > labels.length) labels = cat;
    series.push({ name, values: val });
    return m;
  });
  if (!series.length) return null;
  const n = Math.max(labels.length, ...series.map(s => s.values.length));
  labels = Array.from({ length: n }, (_, i) => labels[i] != null ? String(labels[i]) : String(i + 1));
  const titleXml = tag(xml, 'title')[1] || '';
  const title = (titleXml.match(/<a:t>([^<]*)<\/a:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('').trim();
  return { type, title, labels, series: series.map(s => ({ name: s.name, values: labels.map((_, i) => s.values[i] || 0) })), legend: true, values: true };
}

async function prepareDocx(filePath) {
  const JSZip = require('jszip');
  const buf = fs.readFileSync(filePath);
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch (e) { return { buffer: buf, charts: [], authors: {} }; }
  const docFile = zip.file('word/document.xml');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const charts = [];
  const authors = {};
  const cm = zip.file('word/comments.xml');
  if (cm) (await cm.async('string')).replace(/<w:comment\b[^>]*w:id="(\d+)"[^>]*>/g, (m, id) => { authors[id] = (/w:author="([^"]*)"/.exec(m) || [])[1] || ''; return m; });
  if (!docFile || !relsFile) return { buffer: buf, charts, authors };
  let doc = await docFile.async('string');
  // marcadores de travessão/hífen do Word (falas formatadas como lista): viram parágrafos que começam com
  // travessão, como num livro; sem isso o conversor troca o traço por bolinhas de lista
  const nf = zip.file('word/numbering.xml');
  let dialogs = 0;
  if (nf && /<w:numPr>/.test(doc)) {
    const num = await nf.async('string');
    const dashAbs = new Set();
    num.replace(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g, (m, id, body) => {
      const l0 = /<w:lvl\b[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/.exec(body);
      const lvl = l0 ? l0[1] : body;
      const txt = (/<w:lvlText\b[^>]*w:val="([^"]*)"/.exec(lvl) || [])[1];
      if (/<w:numFmt\b[^>]*w:val="bullet"/.test(lvl) && txt !== undefined && /^\s*[-–—‒―−\uF02D\uF0BE]\s*$/.test(txt)) dashAbs.add(id);
      return m;
    });
    const dashNum = new Set();
    num.replace(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g, (m, id, body) => { const a = (/<w:abstractNumId\b[^>]*w:val="(\d+)"/.exec(body) || [])[1]; if (a && dashAbs.has(a)) dashNum.add(id); return m; });
    if (dashNum.size) {
      doc = doc.replace(/<w:p(?=[\s>])[^>]*>(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g, para => {
        const id = (/<w:numPr>[\s\S]*?<w:numId\b[^>]*w:val="(\d+)"[\s\S]*?<\/w:numPr>/.exec(para) || [])[1];
        if (!id || !dashNum.has(id)) return para;
        dialogs++;
        return para.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, '').replace(/<\/w:pPr>/, '</w:pPr><w:r><w:t xml:space="preserve">\u2014 </w:t></w:r>');
      });
    }
  }
  if (!/<c:chart\b/.test(doc)) {
    if (!dialogs) return { buffer: buf, charts, authors };
    zip.file('word/document.xml', doc);
    return { buffer: await zip.generateAsync({ type: 'nodebuffer' }), charts, authors, dialogs };
  }
  const rels = await relsFile.async('string');
  const target = rid => (new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels) || [])[1];
  const drawings = [];
  doc.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, (m, at) => { drawings.push({ m, at }); return m; });
  for (const d of drawings.reverse()) {
    const rid = (/<c:chart\b[^>]*r:id="([^"]+)"/.exec(d.m) || [])[1];
    if (!rid) continue;
    const t = target(rid);
    const f = t && zip.file('word/' + t.replace(/^\/?word\//, '').replace(/^\//, ''));
    const spec = f ? parseWordChart(await f.async('string')) : null;
    if (!spec) continue;
    charts.unshift(spec);
    doc = doc.slice(0, d.at) + `<w:t>\u27E6GRAFICO:${drawings.length}\u27E7</w:t>` + doc.slice(d.at + d.m.length);
  }
  // numera os marcadores na ordem do documento
  let k = 0;
  doc = doc.replace(/\u27E6GRAFICO:\d+\u27E7/g, () => `\u27E6GRAFICO:${k++}\u27E7`);
  zip.file('word/document.xml', doc);
  return { buffer: await zip.generateAsync({ type: 'nodebuffer' }), charts, authors, dialogs };
}

async function importDocx(filePath) {
  const mammoth = require('mammoth');
  const prep = await prepareDocx(filePath);
  const result = await mammoth.convertToHtml({ buffer: prep.buffer }, {
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
      "r[style-name='Ref. de nota de rodapé'] =>",
      'comment-reference => sup'
    ]
  });
  // comentários de revisão do Word: viram anotações no editor (aparecem na revisão, não no livro impresso)
  const comments = {};
  let html = result.value.replace(/<dl>([\s\S]*?)<\/dl>\s*$/, (m, inner) => {
    inner.replace(/<dt id="comment-(\d+)">[\s\S]*?<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g, (mm, id, dd) => { comments[id] = dd.replace(/<a href="#comment-ref-\d+">[\s\S]*?<\/a>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return mm; });
    return '';
  });
  const escA = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  html = html.replace(/<sup><a href="#comment-(\d+)" id="comment-ref-\d+">[^<]*<\/a><\/sup>/g, (m, id) => (comments[id] ? `<span class="comment" data-author="${escA(prep.authors[id] || '')}" data-text="${escA(comments[id])}">\u200b</span>` : ''));
  return { kind: 'html', html, notesFormat: 'mammoth', charts: prep.charts, dialogs: prep.dialogs || 0 };
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
    language: (/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/.exec(opf) || [])[1] || '',
    source: (/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/.exec(opf) || [])[1] || '',
    subjects: (opf.match(/<dc:subject[^>]*>[\s\S]*?<\/dc:subject>/g) || []).map(x => x.replace(/<[^>]+>/g, '').trim())
  };

  const docs = [];
  for (const id of spine) {
    const item = manifest[id];
    if (!item || !/html|xml/.test(item.type) || /\bnav\b/.test(item.props)) continue;
    const file = zip.file(item.href);
    if (!file) continue;
    let xhtml = await file.async('string');
    let body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(xhtml) || [, xhtml])[1];
    // XHTML: <a id="x"/>, <div .../> etc. viram pares abertos/fechados (no HTML, a tag autofechada
    // de um elemento comum fica aberta e engole o texto seguinte)
    body = body.replace(/<(?!(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b)([a-zA-Z][\w:-]*)(\s[^<>]*?)?\s*\/>/g, (m, tag, attrs) => `<${tag}${attrs || ''}></${tag}>`);
    const html = await zipImagesToDataUrls(zip, item.href, body);
    const bodyAttrs = (/<body([^>]*)>/i.exec(xhtml) || [, ''])[1];
    docs.push({ href: item.href, html, id, bodyAttrs });
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
          cur.parts.push({ text: it.str, sup: true, size });
          continue;
        }
        cur = { y, x, size, parts: [], maxX: x + it.width };
        lines.push(cur);
      }
      if (it.str) {
        const sup = size < cur.size * 0.8 && y > cur.y + 1;
        cur.parts.push({ text: it.str, sup, size });
        cur.size = Math.max(cur.size, sup ? 0 : size);
        cur.maxX = Math.max(cur.maxX, x + it.width);
      }
    }
    pages.push({ n, width: vp.width, height: vp.height, lines: lines.filter(l => l.parts.some(p => p.text.trim())) });
  }
  // título e autor gravados no PDF (muitos vêm do Word: “Microsoft Word - arquivo.doc”, “Usuário”…)
  let meta = {};
  try {
    const info = (await doc.getMetadata()).info || {};
    const ok = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t && !/microsoft|word|\.(docx?|rtf|odt|pdf|txt)$|untitled|sem t[íi]tulo|^(usu[áa]rio|user|admin|administrador|owner|propriet[áa]rio|autor|author|pc|default|anonymous|an[ôo]nimo|unknown|desconhecido|reportlab|adobe|acrobat|pdf|cliente|dell|hp|lenovo|positivo)\b/i.test(t) && t.length < 160 ? t : ''; };
    meta = { title: ok(info.Title), author: ok(info.Author) };
  } catch (e) { /* sem metadados */ }
  return { kind: 'pdf', pages, meta };
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
  else if (ext === '.fb2') res = fb2ToHtml(await importText(filePath));
  else res = { kind: 'text', text: await importText(filePath) };
  res.name = name;
  res.ext = ext;
  return res;
}

// FictionBook 2 (FB2) -> HTML: títulos, parágrafos, ênfases, poemas, citações, notas e ilustrações
function fb2ToHtml(xml) {
  const tag = (s, t) => { const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i').exec(s); return m ? m[1] : ''; };
  const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const info = tag(xml, 'title-info');
  const author = plain([tag(tag(info, 'author'), 'first-name'), tag(tag(info, 'author'), 'middle-name'), tag(tag(info, 'author'), 'last-name')].join(' '));
  const title = plain(tag(info, 'book-title'));
  const lang = plain(tag(info, 'lang'));
  // ilustrações embutidas (binary) e notas (body name="notes")
  const bins = {};
  xml.replace(/<binary[^>]*id="([^"]+)"[^>]*content-type="([^"]+)"[^>]*>([\s\S]*?)<\/binary>/gi, (m, id, type, b64) => { bins[id] = `data:${type};base64,${b64.replace(/\s+/g, '')}`; return ''; });
  const notes = {};
  const notesBody = /<body[^>]*name="(?:notes|comments)"[^>]*>([\s\S]*?)<\/body>/i.exec(xml);
  if (notesBody) notesBody[1].replace(/<section[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi, (m, id, inner) => { notes[id] = plain(inner.replace(/<title>[\s\S]*?<\/title>/i, '')); return ''; });
  const bodies = (xml.match(/<body(?![^>]*name="(?:notes|comments)")[^>]*>[\s\S]*?<\/body>/gi) || []);
  let html = bodies.join('\n')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<a[^>]*(?:l|xlink):href="#([^"]+)"[^>]*type="note"[^>]*>[\s\S]*?<\/a>/gi, (m, id) => (notes[id] ? `<span class="footnote">${notes[id]}</span>` : ''))
    .replace(/<a[^>]*type="note"[^>]*(?:l|xlink):href="#([^"]+)"[^>]*>[\s\S]*?<\/a>/gi, (m, id) => (notes[id] ? `<span class="footnote">${notes[id]}</span>` : ''))
    .replace(/<image[^>]*(?:l|xlink):href="#([^"]+)"[^>]*\/?>/gi, (m, id) => (bins[id] ? `<p><img src="${bins[id]}" alt=""></p>` : ''))
    .replace(/<title>([\s\S]*?)<\/title>/gi, (m, t) => `<h1>${plain(t)}</h1>`)
    .replace(/<subtitle>([\s\S]*?)<\/subtitle>/gi, '<h2>$1</h2>')
    .replace(/<epigraph>([\s\S]*?)<\/epigraph>/gi, '<blockquote class="epigraph">$1</blockquote>')
    .replace(/<cite>([\s\S]*?)<\/cite>/gi, '<blockquote>$1</blockquote>')
    .replace(/<text-author>([\s\S]*?)<\/text-author>/gi, '<p class="attribution">$1</p>')
    .replace(/<poem>([\s\S]*?)<\/poem>/gi, (m, p) => p.replace(/<stanza>([\s\S]*?)<\/stanza>/gi, (mm, st) => `<p class="poem">${(st.match(/<v>([\s\S]*?)<\/v>/gi) || []).map(v => v.replace(/<\/?v>/gi, '')).join('<br>')}</p>`))
    .replace(/<empty-line\s*\/>/gi, '<p><br></p>')
    .replace(/<emphasis>/gi, '<i>').replace(/<\/emphasis>/gi, '</i>')
    .replace(/<strong>/gi, '<b>').replace(/<\/strong>/gi, '</b>')
    .replace(/<strikethrough>/gi, '<s>').replace(/<\/strikethrough>/gi, '</s>')
    .replace(/<\/?(section|annotation)[^>]*>/gi, '\n');
  return { kind: 'html', html, meta: { title, author, language: lang } };
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
