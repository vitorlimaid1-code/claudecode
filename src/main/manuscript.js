// Lê um manuscrito (PDF, DOC, DOCX, ODT, HTML, EPUB, MOBI, TXT) só para descobrir o número de
// páginas e o formato, usados para calcular a capa sem passar pelo módulo de diagramação.
const fs = require('fs');
const path = require('path');

const MM_PER_PT = 25.4 / 72;
const MM_PER_TWIP = 25.4 / 1440;

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

// Estimativa de páginas para textos sem paginação (EPUB, HTML, MOBI, TXT, DOC)
function estimatePages(words, s) {
  const W = Number(s.pageWidth) || 140;
  const H = Number(s.pageHeight) || 210;
  const colW = W - (Number(s.marginInner) || 22) - (Number(s.marginOuter) || 16);
  const colH = H - (Number(s.marginTop) || 20) - (Number(s.marginBottom) || 22);
  const size = Number(s.fontSize) || 11.5;
  const lh = Number(s.lineHeight) || 1.4;
  const charsPerLine = colW / (size * 0.47 * MM_PER_PT);
  const lines = colH / (size * lh * MM_PER_PT);
  const wordsPerPage = (charsPerLine * lines / 6.1) * 0.9; // perdas com parágrafos e diálogos
  let pages = Math.ceil(words / Math.max(50, wordsPerPage)) + 8; // + pré-textuais e aberturas
  if (pages % 2) pages += 1;
  return { pages, wordsPerPage: Math.round(wordsPerPage) };
}

function stripTags(html) {
  return String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
}

async function analyzePdf(file) {
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true, updateMetadata: false });
  const pages = doc.getPageCount();
  const pg = doc.getPage(0);
  const trim = pg.getTrimBox();
  const media = pg.getMediaBox();
  const box = trim && trim.width ? trim : media;
  return { pages, trimW: +(box.width * MM_PER_PT).toFixed(2), trimH: +(box.height * MM_PER_PT).toFixed(2), exact: { pages: true, size: true }, method: trim && (trim.width !== media.width) ? 'PDF (TrimBox)' : 'PDF (tamanho da página)' };
}

async function analyzeDocx(file) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const app = zip.file('docProps/app.xml') ? await zip.file('docProps/app.xml').async('string') : '';
  const doc = await zip.file('word/document.xml').async('string');
  const pagesM = /<Pages>(\d+)<\/Pages>/.exec(app);
  const sz = /<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/.exec(doc) || /<w:pgSz[^>]*w:h="(\d+)"[^>]*w:w="(\d+)"/.exec(doc);
  const words = countWords(doc.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, ' $1 ').replace(/<[^>]+>/g, ' '));
  let trimW = null, trimH = null;
  if (sz) { trimW = +(Number(sz[1]) * MM_PER_TWIP).toFixed(1); trimH = +(Number(sz[2]) * MM_PER_TWIP).toFixed(1); }
  return { pages: pagesM ? Number(pagesM[1]) : null, trimW, trimH, words, exact: { pages: !!pagesM, size: !!sz }, method: 'Word (DOCX)' };
}

async function analyzeOdt(file) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const meta = zip.file('meta.xml') ? await zip.file('meta.xml').async('string') : '';
  const styles = zip.file('styles.xml') ? await zip.file('styles.xml').async('string') : '';
  const content = await zip.file('content.xml').async('string');
  const pc = /meta:page-count="(\d+)"/.exec(meta);
  const toMm = v => { const m = /([\d.]+)(mm|cm|in|pt)/.exec(v || ''); if (!m) return null; const n = Number(m[1]); return +(m[2] === 'cm' ? n * 10 : m[2] === 'in' ? n * 25.4 : m[2] === 'pt' ? n * MM_PER_PT : n).toFixed(1); };
  const w = /fo:page-width="([^"]+)"/.exec(styles);
  const h = /fo:page-height="([^"]+)"/.exec(styles);
  return { pages: pc ? Number(pc[1]) : null, trimW: w ? toMm(w[1]) : null, trimH: h ? toMm(h[1]) : null, words: countWords(stripTags(content)), exact: { pages: !!pc, size: !!w }, method: 'OpenDocument (ODT)' };
}

async function analyzeEpub(file) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  let words = 0;
  for (const name of Object.keys(zip.files)) if (/\.(x?html?)$/i.test(name)) words += countWords(stripTags(await zip.file(name).async('string')));
  return { pages: null, trimW: null, trimH: null, words, exact: { pages: false, size: false }, method: 'EPUB (estimado pelas palavras)' };
}

// MOBI/AZW: lê o cabeçalho PalmDOC para saber o tamanho do texto
function analyzeMobi(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 60, 68) !== 'BOOKMOBI' && buf.toString('latin1', 60, 68) !== 'TEXtREAd') throw new Error('Arquivo MOBI não reconhecido.');
  const rec0 = buf.readUInt32BE(78);
  const textLength = buf.readUInt32BE(rec0 + 4);
  // o texto do MOBI é HTML: ~40% são marcações; ~6 caracteres por palavra
  const words = Math.round(textLength * 0.6 / 6);
  return { pages: null, trimW: null, trimH: null, words, exact: { pages: false, size: false }, method: 'MOBI (estimado pelo tamanho do texto)' };
}

async function analyze(file, settings) {
  const ext = path.extname(file).toLowerCase();
  let r;
  if (ext === '.pdf') r = await analyzePdf(file);
  else if (ext === '.docx') r = await analyzeDocx(file);
  else if (ext === '.odt') r = await analyzeOdt(file);
  else if (ext === '.epub') r = await analyzeEpub(file);
  else if (ext === '.mobi' || ext === '.azw' || ext === '.azw3') r = analyzeMobi(file);
  else if (ext === '.doc') {
    const { importAny } = require('./importers');
    const d = await importAny(file);
    r = { pages: null, trimW: null, trimH: null, words: countWords(d.text), exact: { pages: false, size: false }, method: 'Word 97-2003 (estimado pelas palavras)' };
  } else {
    const text = fs.readFileSync(file, 'utf8');
    r = { pages: null, trimW: null, trimH: null, words: countWords(/\.html?$/.test(ext) ? stripTags(text) : text), exact: { pages: false, size: false }, method: ext === '.html' || ext === '.htm' ? 'HTML (estimado)' : 'Texto (estimado)' };
  }
  // formatos de escritório costumam estar em A4/Carta: nesse caso o formato do livro vem das configurações
  const officeSize = r.trimW && ((Math.abs(r.trimW - 210) < 2 && Math.abs(r.trimH - 297) < 2) || (Math.abs(r.trimW - 215.9) < 2 && Math.abs(r.trimH - 279.4) < 2));
  if (!r.trimW || (officeSize && ext !== '.pdf')) { r.trimW = Number(settings.pageWidth) || 140; r.trimH = Number(settings.pageHeight) || 210; r.exact.size = false; r.sizeNote = officeSize ? 'O arquivo está em formato de escritório (A4/Carta); foi usado o formato do livro configurado.' : 'Formato não informado no arquivo; foi usado o formato do livro configurado.'; }
  if (!r.pages || (officeSize && ext !== '.pdf')) {
    const est = estimatePages(r.words || 0, Object.assign({}, settings, { pageWidth: r.trimW, pageHeight: r.trimH }));
    r.pagesNote = r.pages ? `O arquivo tem ${r.pages} páginas em formato de escritório; no formato do livro serão cerca de ${est.pages}.` : `Estimativa: ${r.words} palavras ≈ ${est.wordsPerPage} palavras por página.`;
    r.pages = est.pages;
    r.exact.pages = false;
  }
  if (r.pages % 2) r.pages += 1;
  r.name = path.basename(file);
  return r;
}

module.exports = { analyze, estimatePages };
