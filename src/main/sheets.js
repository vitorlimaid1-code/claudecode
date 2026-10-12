// Planilhas para tabelas e gráficos: lê CSV/TSV/TXT, XLSX (Excel) e ODS (LibreOffice/Google Planilhas
// exportado) e devolve as linhas como texto. Só a primeira planilha (aba) é usada; células mescladas
// e fórmulas entram pelo valor já calculado que o arquivo guarda.
const fs = require('fs');
const path = require('path');

const MAX_ROWS = 300, MAX_COLS = 30;

function parseDelimited(text) {
  text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = text.split('\n').find(l => l.trim()) || '';
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && !cell) q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return tidy(rows);
}

// remove linhas e colunas vazias nas bordas e limita o tamanho
function tidy(rows) {
  rows = rows.map(r => r.map(c => String(c == null ? '' : c).trim()));
  rows = rows.filter(r => r.some(c => c)); // linhas vazias (no meio ou nas bordas) não viram linhas da tabela
  const width = Math.min(MAX_COLS, Math.max(0, ...rows.map(r => { let w = r.length; while (w && !r[w - 1]) w--; return w; })));
  return rows.slice(0, MAX_ROWS).map(r => Array.from({ length: width }, (_, i) => r[i] || ''));
}

const decodeXml = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
// número no padrão brasileiro (vírgula decimal), sem casas fantasmas de ponto flutuante
const ptNumber = v => { const n = Number(v); if (!isFinite(n)) return v; return String(Math.round(n * 1e10) / 1e10).replace('.', ','); };

async function parseXlsx(buf) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buf);
  const shared = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) (await ss.async('string')).replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => { shared.push(decodeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''))); return m; });
  // primeira aba na ordem do arquivo
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = zip.file('xl/workbook.xml'), rels = zip.file('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const w = await wb.async('string'), r = await rels.async('string');
    const rid = (/<sheet\b[^>]*r:id="([^"]+)"/.exec(w) || [])[1];
    const target = rid && (new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(r) || new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(r) || [])[1];
    if (target) sheetPath = 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const sh = zip.file(sheetPath);
  if (!sh) throw new Error('A planilha não tem abas legíveis.');
  const xml = await sh.async('string');
  const rows = [];
  xml.replace(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, (m, inner) => {
    const rn = Number((/\br="(\d+)"/.exec(m) || [])[1]) || rows.length + 1;
    const row = [];
    (inner || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mc, attrs, body) => {
      const ref = (/\br="([A-Z]+\d+)"/.exec(attrs) || [])[1];
      const t = (/\bt="([^"]+)"/.exec(attrs) || [])[1];
      let v = '';
      if (t === 'inlineStr') v = decodeXml((body || '').replace(/<[^>]+>/g, ''));
      else {
        const raw = (/<v>([\s\S]*?)<\/v>/.exec(body || '') || [])[1];
        if (raw != null && raw !== '') v = t === 's' ? shared[Number(raw)] || '' : t === 'str' || t === 'e' ? decodeXml(raw) : t === 'b' ? (raw === '1' ? 'VERDADEIRO' : 'FALSO') : ptNumber(raw);
      }
      row[ref ? colIndex(ref) : row.length] = v;
      return mc;
    });
    rows[rn - 1] = row;
    return m;
  });
  return tidy(Array.from(rows, r => r || []));
}

async function parseOds(buf) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('content.xml').async('string');
  const table = (/<table:table\b[\s\S]*?<\/table:table>/.exec(xml) || [''])[0];
  const rows = [];
  table.replace(/<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g, (m, attrs, inner) => {
    const rep = Math.min(MAX_ROWS, Number((/table:number-rows-repeated="(\d+)"/.exec(attrs) || [])[1]) || 1);
    const row = [];
    (inner || '').replace(/<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g, (mc, a, body) => {
      const n = Math.min(MAX_COLS, Number((/table:number-columns-repeated="(\d+)"/.exec(a) || [])[1]) || 1);
      const val = (/office:value="([^"]+)"/.exec(a) || [])[1];
      const txt = decodeXml((body || '').replace(/<text:s[^>]*\/>/g, ' ').replace(/<\/text:p>\s*<text:p[^>]*>/g, ' ').replace(/<[^>]+>/g, ''));
      for (let i = 0; i < n; i++) row.push(txt || (val != null ? ptNumber(val) : ''));
      return mc;
    });
    for (let i = 0; i < rep && rows.length < MAX_ROWS * 2; i++) rows.push(row.slice());
    return m;
  });
  return tidy(rows);
}

async function readSheet(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  let rows;
  if (ext === '.xlsx' || ext === '.xlsm') rows = await parseXlsx(buf);
  else if (ext === '.ods') rows = await parseOds(buf);
  else if (ext === '.xls') throw new Error('Arquivos .xls (Excel 97–2003) não são lidos diretamente: salve como .xlsx ou .csv no Excel.');
  else {
    let text = buf.toString('utf8');
    if (text.includes('�')) text = buf.toString('latin1'); // CSV salvo pelo Excel em Windows-1252
    rows = parseDelimited(text);
  }
  if (!rows.length) throw new Error('A planilha está vazia.');
  return { name: path.basename(file), rows };
}

module.exports = { readSheet, parseDelimited, tidy };
