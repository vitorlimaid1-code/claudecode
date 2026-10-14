// Recursos tipográficos da montagem do livro: exceções de hifenização, índice remissivo,
// notas de fim/laterais e referências cruzadas a figuras, gráficos, tabelas e quadros.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function unesc(s) {
  return String(s == null ? '' : s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function attr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return m ? unesc(m[1]) : '';
}

// Substitui cada <span class="footnote">…</span> (com spans internos balanceados) por fn(conteúdo, k)
function replaceFootnotes(html, fn) {
  let out = '';
  let i = 0;
  let k = 0;
  const open = /<span\b[^>]*class="[^"]*\bfootnote\b[^"]*"[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    out += html.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    const tag = /<\/?span\b[^>]*>/gi;
    tag.lastIndex = j;
    let t;
    let innerEnd = html.length;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) innerEnd = t.index;
      j = tag.lastIndex;
    }
    out += fn(html.slice(m.index + m[0].length, innerEnd), k++);
    i = j;
    open.lastIndex = j;
  }
  return out + html.slice(i);
}

// ---------------------------------------------------------------- exceções de hifenização
// Uma palavra por linha (ou separadas por vírgula). Hífens marcam os únicos pontos de quebra
// permitidos ("a-na-cro-nis-mo"); sem hífen, a palavra nunca é dividida ("Diagramador").
function parseHyphenExceptions(text) {
  return String(text || '').split(/[\n,;]+/).map(w => w.trim()).filter(w => w && /\p{L}/u.test(w)).map(w => {
    const parts = w.split(/[-\u00AD‐]/).filter(Boolean);
    const letters = parts.join('');
    const breaks = [];
    let pos = 0;
    parts.slice(0, -1).forEach(p => { pos += p.length; breaks.push(pos); });
    return { word: letters, breaks };
  }).filter(e => e.word.length > 1);
}
function applyHyphenExceptions(html, text) {
  const list = parseHyphenExceptions(text);
  if (!list.length) return html;
  const rx = list.map(e => {
    const body = [...e.word].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\u00AD?');
    return { e, re: new RegExp(`(?<![\\p{L}\\u00AD])${body}(?![\\p{L}\\u00AD])`, 'giu') };
  });
  return String(html).split(/(<[^>]+>)/).map(part => {
    if (!part || part[0] === '<') return part;
    let s = part;
    rx.forEach(({ e, re }) => {
      s = s.replace(re, m => {
        const letters = [...m.replace(/\u00AD/g, '')];
        let out = '';
        letters.forEach((ch, i) => { if (i && e.breaks.includes(i)) out += '\u00AD'; out += ch; });
        return out;
      });
    });
    return s;
  }).join('');
}

// ---------------------------------------------------------------- índice remissivo
// Termos marcados no editor: <span class="ix" data-ix="Termo" data-ixsub="Subentrada">texto</span>
// No livro, a marca vira uma sequência de caracteres invisíveis de formatação antes do termo (nenhum
// elemento HTML: assim a marca não interfere na quebra de linhas nem de páginas). Depois da paginação,
// a prévia procura as sequências para saber a página de cada ocorrência.
const IX_DELIM = '\u2063';
const IX_DIGITS = ['\u2060', '\u2061', '\u2062', '\u2064'];
function ixMark(k) {
  let d = '';
  let n = k;
  do { d = IX_DIGITS[n % 4] + d; n = Math.floor(n / 4); } while (n > 0);
  return IX_DELIM + d + IX_DELIM;
}
function collectIndex(html, ctx) {
  html = String(html);
  let out = '';
  let i = 0;
  const open = /<span\b[^>]*\bclass="ix"[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    out += html.slice(i, m.index);
    // fim do span (com spans internos balanceados)
    let depth = 1;
    let j = m.index + m[0].length;
    let innerEnd = html.length;
    const tag = /<\/?span\b[^>]*>/gi;
    tag.lastIndex = j;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) innerEnd = t.index;
      j = tag.lastIndex;
    }
    const inner = html.slice(m.index + m[0].length, innerEnd);
    const term = attr(m[0], 'data-ix').trim();
    if (term) {
      const sub = attr(m[0], 'data-ixsub').trim();
      const key = term.toLowerCase() + '\u0001' + sub.toLowerCase();
      let e = ctx.index.get(key);
      if (!e) { e = { k: ctx.index.size, term, sub, count: 0 }; ctx.index.set(key, e); }
      e.count += 1;
      out += ixMark(e.k);
    }
    out += inner;
    i = j;
    open.lastIndex = j;
  }
  return out + html.slice(i);
}
const letterOf = t => {
  const c = String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '0–9';
};
function indexHtml(ctx, settings) {
  const ix = settings.index || {};
  if (ix.enabled === false || !ctx.index || !ctx.index.size) return '';
  const cmp = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });
  // espaço reservado para as páginas (preenchidas depois da paginação): o texto da paginação anterior,
  // quando existe; senão, um número de 3 algarismos por ocorrência (no máximo 40 — entradas com mais
  // ocorrências viram intervalos como 12–18, e uma entrada nunca pode passar do tamanho da coluna)
  const cache = ctx.indexCache || {};
  const slot = e => {
    const prev = cache[e.term.toLowerCase() + '|' + e.sub.toLowerCase()];
    const txt = prev ? prev + ', 0' : Array(Math.min(e.count, 40)).fill('000').join(', ');
    return `<span class="ix-pages" data-ixk="${e.k}" data-ixkey="${esc(e.term.toLowerCase() + '|' + e.sub.toLowerCase())}">${esc(txt)}</span>`;
  };
  const terms = new Map();
  [...ctx.index.values()].forEach(e => {
    const key = e.term.toLowerCase();
    const t = terms.get(key) || { term: e.term, main: null, subs: [] };
    if (e.sub) t.subs.push(e); else t.main = e;
    terms.set(key, t);
  });
  const sorted = [...terms.values()].sort((a, b) => cmp(a.term, b.term));
  let letter = '';
  const out = [];
  sorted.forEach(t => {
    const L = letterOf(t.term);
    const entry = `<p class="ix-entry"><span class="ix-term">${esc(t.term)}</span>${t.main ? `, ${slot(t.main)}` : ''}</p>`;
    // a letra do grupo nunca fica separada da primeira entrada (nem em colunas, nem entre páginas)
    // (só entradas curtas ficam presas à letra: uma entrada maior que a coluna precisa poder dividir)
    const short = (t.main ? t.main.count : 0) <= 40;
    if (L !== letter) { letter = L; out.push(short ? `<div class="ix-head"><div class="ix-letter">${esc(L)}</div>${entry}</div>` : `<div class="ix-letter">${esc(L)}</div>${entry}`); } else out.push(entry);
    t.subs.sort((a, b) => cmp(a.sub, b.sub)).forEach(s => out.push(`<p class="ix-entry ix-sub">${esc(s.sub)}, ${slot(s)}</p>`));
  });
  const cols = Math.max(1, Math.min(3, Number(ix.columns) || 2));
  return `<section class="back-matter back-num index-page" id="indice-remissivo">
    <h1 class="back-title">${esc(ix.title || 'Índice remissivo')}</h1>
    <div class="ix-list" style="column-count:${cols}">${out.join('')}</div>
  </section>`;
}

// ---------------------------------------------------------------- notas de fim e laterais
// mode: 'chapter' (no fim do capítulo), 'book' (no fim do livro) ou 'side' (na margem externa)
function convertNotes(html, mode, ctx, chapterIndex) {
  const notes = [];
  const restart = ctx.settings.footnoteNumbering === 'chapter';
  if (restart) ctx.noteN = 0;
  const out = replaceFootnotes(html, inner => {
    const n = ++ctx.noteN;
    const id = `en-${chapterIndex}-${n}`;
    if (mode === 'side') {
      ctx.sideCount = (ctx.sideCount || 0) + 1;
      const k = ctx.sideCount;
      return `<sup class="sn-call" data-sn="${k}">${n}</sup><span class="sidenote" data-sn="${k}"><span class="sn-num">${n}</span> ${inner}</span>`;
    }
    notes.push({ n, id, html: inner });
    return `<sup class="en-call"><a class="en-link" href="#${id}" id="${id}-r">${n}</a></sup>`;
  });
  return { html: out, notes };
}
function endnotesList(notes) {
  return `<ol class="en-list">${notes.map(x => `<li id="${x.id}" value="${x.n}"><span class="en-num">${x.n}.</span> ${x.html}</li>`).join('')}</ol>`;
}
function chapterEndnotes(notes, title) {
  if (!notes.length) return '';
  return `<div class="endnotes"><div class="en-title">${esc(title || 'Notas')}</div>${endnotesList(notes)}</div>`;
}
function bookEndnotes(groups, title) {
  const g = groups.filter(x => x.notes.length);
  if (!g.length) return '';
  return `<section class="back-matter back-num endnotes-book" id="notas">
    <h1 class="back-title">${esc(title || 'Notas')}</h1>
    ${g.map(x => `<div class="en-group"><div class="en-chapter">${esc(x.heading)}</div>${endnotesList(x.notes)}</div>`).join('')}
  </section>`;
}

// ---------------------------------------------------------------- referências cruzadas
// No editor: <a class="xref xref-auto [xref-page]" href="#r-…">…</a> aponta para a figura/tabela com
// data-ref="r-…". Na montagem, o texto vira o rótulo atual ("Figura 3") e o link vai para o id final.
function resolveXrefs(html, ctx) {
  return String(html).replace(/<a\b([^>]*\bclass="[^"]*\bxref-auto\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inner) => {
    const href = attr(m, 'href').replace(/^#/, '');
    const ref = ctx.refs[href];
    const pageSpan = (/<span class="xref-num">[\s\S]*<\/span><\/span>$/.exec(inner) || [''])[0];
    const label = ref ? esc(ref.label) : '[referência não encontrada]';
    const newAttrs = ref ? attrs.replace(/\shref="[^"]*"/i, ` href="#${esc(ref.id)}"`) : attrs;
    return `<a${newAttrs}>${label}${pageSpan}</a>`;
  });
}

module.exports = {
  replaceFootnotes, parseHyphenExceptions, applyHyphenExceptions, collectIndex, indexHtml,
  convertNotes, chapterEndnotes, bookEndnotes, resolveXrefs, letterOf
};
