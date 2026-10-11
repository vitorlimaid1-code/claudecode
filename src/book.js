// Monta o HTML e o CSS paginável (Paged.js) a partir de um projeto de livro.
const { normalizeProject, BUNDLED_FONTS } = require('./shared/defaults');

let hyphenatePt = null;
function getHyphenator() {
  if (!hyphenatePt) {
    const { hyphenateHTMLSync } = require('hyphen/pt');
    hyphenatePt = html => hyphenateHTMLSync(html, { hyphenChar: '­', minWordLength: 6 });
  }
  return hyphenatePt;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Texto simples com quebras de linha -> HTML
function multiline(s) {
  return esc(s).replace(/\r?\n/g, '<br>');
}

function cssString(s) {
  return '"' + String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ') + '"';
}

function fontStack(name) {
  const fallback = BUNDLED_FONTS.includes(name) ? '' : ', "EB Garamond"';
  return `"${String(name).replace(/"/g, '')}"${fallback}, Georgia, serif`;
}

function roman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

function words(n) {
  const units = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
  const teens = ['Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove'];
  const tens = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
  if (n < 1 || n > 99) return String(n);
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  return tens[t] + (u ? ' e ' + units[u].toLowerCase() : '');
}

function chapterLabel(settings, n) {
  if (settings.chapterNumbering === 'none') return '';
  const num = settings.chapterNumbering === 'roman' ? roman(n)
    : settings.chapterNumbering === 'words' ? words(n)
    : String(n);
  const label = (settings.chapterLabel || '').trim();
  return label ? `${label} ${num}` : num;
}

function defaultCopyright(meta) {
  const lines = [];
  lines.push(`© ${meta.year || new Date().getFullYear()} ${meta.author || ''}`.trim());
  lines.push('Todos os direitos reservados.');
  lines.push('');
  if (meta.edition) lines.push(meta.edition);
  if (meta.isbn) lines.push('ISBN ' + meta.isbn);
  if (meta.publisher || meta.city) lines.push([meta.publisher, meta.city].filter(Boolean).join(' — '));
  lines.push('');
  lines.push('Nenhuma parte desta obra pode ser reproduzida sem autorização prévia do autor, exceto em citações breves com indicação da fonte.');
  return lines.join('\n');
}

function buildHtml(project) {
  const { meta, front, chapters, settings } = project;
  const parts = [];

  if (front.halfTitle) {
    parts.push(`<section class="front half-title"><div class="ht-title">${esc(meta.title)}</div></section>`);
  }
  if (front.titlePage) {
    parts.push(`<section class="front title-page">
      <div class="tp-author">${esc(meta.author)}</div>
      <div class="tp-title">${esc(meta.title)}</div>
      ${meta.subtitle ? `<div class="tp-subtitle">${esc(meta.subtitle)}</div>` : ''}
      <div class="tp-publisher">${esc(meta.publisher)}${meta.city || meta.year ? `<br><span>${esc([meta.city, meta.year].filter(Boolean).join(' · '))}</span>` : ''}</div>
    </section>`);
  }
  if (front.copyright) {
    const text = meta.copyrightText && meta.copyrightText.trim() ? meta.copyrightText : defaultCopyright(meta);
    parts.push(`<section class="front copyright-page"><div class="cp-text">${multiline(text)}</div></section>`);
  }
  if (front.dedication && meta.dedication && meta.dedication.trim()) {
    parts.push(`<section class="front dedication"><div class="ded-text">${multiline(meta.dedication)}</div></section>`);
  }
  if (front.epigraph && meta.epigraph && meta.epigraph.trim()) {
    parts.push(`<section class="front epigraph"><div class="epi-text">${multiline(meta.epigraph)}</div>${meta.epigraphAuthor ? `<div class="epi-author">${esc(meta.epigraphAuthor)}</div>` : ''}</section>`);
  }

  // Numeração dos capítulos
  let n = 0;
  const numbered = chapters.map(c => {
    if (c.numbered) { n += 1; return { ...c, label: chapterLabel(settings, n) }; }
    return { ...c, label: '' };
  });

  if (front.toc && numbered.length) {
    const items = numbered.map(c => `
      <li><a href="#${esc(c.id)}">${c.label ? `<span class="toc-label">${esc(c.label)}</span>` : ''}<span class="toc-title">${esc(c.title)}</span><span class="toc-dots"></span><span class="toc-page"></span></a></li>`).join('');
    parts.push(`<section class="front toc"><h2 class="toc-heading">${esc(front.tocTitle || 'Sumário')}</h2><ul class="toc-list">${items}</ul></section>`);
  }

  const hyph = settings.hyphenate ? getHyphenator() : null;
  numbered.forEach((c, i) => {
    let body = c.html || '';
    if (hyph) {
      try { body = hyph(body); } catch (e) { /* mantém sem hifenização */ }
    }
    parts.push(`<section class="chapter${i === 0 ? ' first-chapter' : ''}" id="${esc(c.id)}">
      <header class="chapter-head">
        ${c.label ? `<div class="chapter-label">${esc(c.label)}</div>` : ''}
        <h1 class="chapter-title">${esc(c.title)}</h1>
      </header>
      <div class="chapter-body">${body}</div>
    </section>`);
  });

  return `<div class="book" lang="pt-BR" data-number-from-first="${settings.numberFromFirstChapter ? 1 : 0}">${parts.join('\n')}</div>`;
}

function buildCss(project) {
  const { meta, settings: s } = project;
  const mm = v => `${Number(v) || 0}mm`;
  const contentH = (Number(s.pageHeight) || 210) - (Number(s.marginTop) || 0) - (Number(s.marginBottom) || 0);
  const upper = s.headerUppercase ? 'uppercase' : 'none';

  let leftHeader = 'none';
  let rightHeader = 'none';
  if (s.header === 'title-chapter') {
    leftHeader = cssString(meta.title);
    rightHeader = 'string(chaptitle)';
  } else if (s.header === 'author-title') {
    leftHeader = cssString(meta.author);
    rightHeader = cssString(meta.title);
  } else if (s.header === 'chapter-chapter') {
    leftHeader = 'string(chaptitle)';
    rightHeader = 'string(chaptitle)';
  }

  const pn = s.pageNumbers;
  const leftNum = pn === 'outer' ? '@bottom-left { content: counter(page); }' : pn === 'center' ? '@bottom-center { content: counter(page); }' : '';
  const rightNum = pn === 'outer' ? '@bottom-right { content: counter(page); }' : pn === 'center' ? '@bottom-center { content: counter(page); }' : '';
  const topLeftNum = pn === 'top-outer' ? '@top-left { content: counter(page); }' : '';
  const topRightNum = pn === 'top-outer' ? '@top-right { content: counter(page); }' : '';
  // Com número no topo externo, o cabeçalho vai para o centro
  const headerBoxL = pn === 'top-outer' ? '@top-center' : '@top-left';
  const headerBoxR = pn === 'top-outer' ? '@top-center' : '@top-right';

  const bleed = Number(s.bleed) > 0 ? `bleed: ${mm(s.bleed)};` : '';
  const marks = s.cropMarks ? 'marks: crop cross;' : '';
  const indent = `${Number(s.paraIndent) || 0}em`;
  const spacing = `${Number(s.paraSpacing) || 0}em`;
  const wo = Math.max(1, Number(s.widowsOrphans) || 2);

  const boxStyle = `font-family: ${fontStack(s.bodyFont)}; font-size: ${Number(s.headerSize) || 8.5}pt; letter-spacing: ${s.headerUppercase ? '0.08em' : '0'}; text-transform: ${upper}; color: #222;`;
  const numStyle = `font-family: ${fontStack(s.bodyFont)}; font-size: ${Number(s.pageNumberSize) || 9.5}pt; text-transform: none; letter-spacing: 0;`;

  return `
@page {
  size: ${mm(s.pageWidth)} ${mm(s.pageHeight)};
  margin-top: ${mm(s.marginTop)};
  margin-bottom: ${mm(s.marginBottom)};
  ${bleed}
  ${marks}
}
@page :left {
  margin-left: ${mm(s.marginOuter)};
  margin-right: ${mm(s.marginInner)};
}
@page :right {
  margin-left: ${mm(s.marginInner)};
  margin-right: ${mm(s.marginOuter)};
}
@page chapter:left {
  ${headerBoxL} { content: ${leftHeader}; ${boxStyle} vertical-align: bottom; padding-bottom: 4mm; }
  ${leftNum.replace('}', `${numStyle} }`)}
  ${topLeftNum.replace('}', `${numStyle} vertical-align: bottom; padding-bottom: 4mm; }`)}
}
@page chapter:right {
  ${headerBoxR} { content: ${rightHeader}; ${boxStyle} vertical-align: bottom; padding-bottom: 4mm; }
  ${rightNum.replace('}', `${numStyle} }`)}
  ${topRightNum.replace('}', `${numStyle} vertical-align: bottom; padding-bottom: 4mm; }`)}
}
@page chapter:first {
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
}
@page :blank {
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}
@page front {
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-center { content: none; }
  @bottom-right { content: none; }
}

.book {
  font-family: ${fontStack(s.bodyFont)};
  font-size: ${Number(s.bodySize) || 11}pt;
  line-height: ${Number(s.lineHeight) || 1.4};
  color: #000;
  font-variant-ligatures: common-ligatures;
  font-kerning: normal;
}

/* ---------- Elementos pré-textuais ---------- */
.front { page: front; break-before: right; }
.front.copyright-page { break-before: left; }
.half-title .ht-title {
  margin-top: ${(contentH * 0.28).toFixed(1)}mm;
  text-align: center;
  font-family: ${fontStack(s.headingFont)};
  font-size: 1.5em;
  letter-spacing: 0.04em;
}
.title-page { text-align: center; font-family: ${fontStack(s.headingFont)}; }
.title-page .tp-author {
  margin-top: ${(contentH * 0.08).toFixed(1)}mm;
  font-size: 1.15em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.title-page .tp-title {
  margin-top: ${(contentH * 0.22).toFixed(1)}mm;
  font-size: 2.2em;
  line-height: 1.15;
}
.title-page .tp-subtitle { margin-top: 4mm; font-size: 1.2em; font-style: italic; }
.title-page .tp-publisher {
  margin-top: ${(contentH * 0.3).toFixed(1)}mm;
  font-size: 0.95em;
  letter-spacing: 0.08em;
}
.title-page .tp-publisher span { font-size: 0.85em; }
.copyright-page .cp-text {
  margin-top: ${(contentH * 0.5).toFixed(1)}mm;
  font-size: 0.78em;
  line-height: 1.45;
  text-align: left;
  hyphens: manual;
}
.dedication .ded-text, .epigraph .epi-text {
  margin-top: ${(contentH * 0.3).toFixed(1)}mm;
  margin-left: 35%;
  text-align: right;
  font-style: italic;
}
.epigraph .epi-author { text-align: right; margin-top: 3mm; font-size: 0.9em; }
.epigraph .epi-author::before { content: "— "; }

.toc-heading {
  font-family: ${fontStack(s.headingFont)};
  font-weight: normal;
  font-size: ${(Number(s.chapterTitleSize) || 22) * 0.8}pt;
  text-align: ${s.chapterTitleAlign};
  margin: ${mm(Math.max(0, (Number(s.chapterDrop) || 0) - 5))} 0 10mm 0;
  ${s.chapterTitleUppercase ? 'text-transform: uppercase; letter-spacing: 0.06em;' : ''}
}
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-list li { margin: 0 0 0.45em 0; break-inside: avoid; }
.toc-list a { display: flex; align-items: baseline; color: inherit; text-decoration: none; }
.toc-label { flex: none; margin-right: 0.6em; font-variant: small-caps; letter-spacing: 0.03em; }
.toc-title { flex: none; max-width: 75%; }
.toc-dots { flex: 1 1 auto; border-bottom: 1px dotted #555; margin: 0 0.4em; min-width: 1em; transform: translateY(-0.3em); }
.toc-page { flex: none; min-width: 1.2em; text-align: right; }

/* ---------- Capítulos ---------- */
.chapter { page: chapter; break-before: ${s.chapterStartRight ? 'right' : 'page'}; }
.chapter-head {
  margin: ${mm(s.chapterDrop)} 0 12mm 0;
  text-align: ${s.chapterTitleAlign};
  font-family: ${fontStack(s.headingFont)};
}
.chapter-label {
  font-size: 0.95em;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 3mm;
}
.chapter-title {
  font-weight: normal;
  font-size: ${Number(s.chapterTitleSize) || 22}pt;
  line-height: 1.15;
  margin: 0;
  hyphens: manual;
  string-set: chaptitle content(text);
  ${s.chapterTitleUppercase ? 'text-transform: uppercase; letter-spacing: 0.06em;' : ''}
}

.chapter-body p {
  margin: 0 0 ${spacing} 0;
  text-indent: ${indent};
  text-align: ${s.align === 'left' ? 'left' : 'justify'};
  hyphens: manual;
  widows: ${wo};
  orphans: ${wo};
}
${s.indentFirstParagraph ? '' : `
.chapter-body > p:first-child,
.chapter-body > h2 + p, .chapter-body > h3 + p, .chapter-body > h4 + p,
.chapter-body > hr + p, .chapter-body > .page-break + p,
.chapter-body > blockquote + p, .chapter-body > figure + p,
.chapter-body > ul + p, .chapter-body > ol + p { text-indent: 0; }`}
.chapter-body p.no-indent { text-indent: 0; }
.chapter-body p[data-split-from] { text-indent: 0; }
${s.align === 'left' ? '' : '.chapter-body p[data-split-to] { text-align-last: justify; }'}
.chapter-body p[style*="center"], .chapter-body p[style*="right"] { text-indent: 0; }
${s.dropCap ? `
.chapter-body > p:first-child:not([data-split-from])::first-letter {
  float: left;
  font-family: ${fontStack(s.headingFont)};
  font-size: ${((Number(s.lineHeight) || 1.4) * 2 + 0.4).toFixed(2)}em;
  line-height: 0.8;
  padding: 0.04em 0.08em 0 0;
}` : ''}
${s.smallCapsFirstLine ? `
.chapter-body > p:first-child:not([data-split-from])::first-line {
  font-variant: small-caps;
  letter-spacing: 0.04em;
}` : ''}
.chapter-body h2, .chapter-body h3, .chapter-body h4 {
  font-family: ${fontStack(s.headingFont)};
  font-weight: normal;
  line-height: 1.2;
  break-after: avoid;
  hyphens: manual;
}
.chapter-body h2 { font-size: 1.35em; margin: 1.4em 0 0.7em; text-align: ${s.chapterTitleAlign}; }
.chapter-body h3 { font-size: 1.12em; font-style: italic; margin: 1.2em 0 0.5em; }
.chapter-body h4 { font-size: 1em; font-variant: small-caps; letter-spacing: 0.04em; margin: 1em 0 0.4em; }
.chapter-body blockquote {
  margin: 0.8em 2em;
  font-size: 0.93em;
}
.chapter-body blockquote p { text-indent: 0; }
.chapter-body ul, .chapter-body ol { margin: 0.5em 0 0.5em 1.6em; padding: 0; }
.chapter-body li { margin-bottom: 0.2em; }
.chapter-body hr.scene-break {
  border: 0;
  height: auto;
  margin: 0.9em 0;
  text-align: center;
  break-after: avoid;
}
.chapter-body hr.scene-break::after { content: ${cssString(s.sceneBreak || '* * *')}; letter-spacing: 0.3em; }
.chapter-body hr:not(.scene-break) { border: 0; border-top: 0.5pt solid #000; width: 30%; margin: 1em auto; }
.chapter-body .page-break { break-after: page; height: 0; }
.chapter-body figure { margin: 1em 0; text-align: center; break-inside: avoid; }
.chapter-body img { max-width: 100%; max-height: ${(contentH * 0.85).toFixed(1)}mm; object-fit: contain; }
.chapter-body figcaption { font-size: 0.85em; font-style: italic; margin-top: 0.4em; text-align: center; }
.chapter-body .smallcaps { font-variant: small-caps; letter-spacing: 0.03em; }
.chapter-body sup, .chapter-body sub { line-height: 0; }
`;
}

function buildBook(rawProject) {
  const project = normalizeProject(rawProject);
  return { html: buildHtml(project), css: buildCss(project), title: project.meta.title };
}

module.exports = { buildBook, chapterLabel, roman, words };
