// Monta o HTML e o CSS paginável (Paged.js) a partir de um projeto de livro.
const { normalizeProject, BUNDLED_FONTS, autoBleed, CEDET, charStylesCss } = require('./shared/defaults');
const CatalogParse = require('./shared/catalog-parse');
const X = require('./book-extras');
const PageFrames = require('./shared/frames');
const TocThemes = require('./shared/tocthemes');

function effectiveBleed(s) {
  if (s.bleedAuto) return autoBleed(s);
  return Math.max(Number(s.bleedTop) || 0, Number(s.bleedBottom) || 0, Number(s.bleedOuter) || 0, Number(s.bleed) || 0);
}

let hyphenatePt = null;
function getHyphenator() {
  if (!hyphenatePt) {
    const { hyphenateHTMLSync } = require('hyphen/pt');
    hyphenatePt = html => hyphenateHTMLSync(html, { hyphenChar: '\u00AD', minWordLength: 6 });
  }
  return hyphenatePt;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function multiline(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
function cssString(s) {
  return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"';
}
function num(v, d) { const n = Number(v); return v !== '' && v !== null && isFinite(n) ? n : d; }
function color(v, d) { return /^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : d; }
function fontStack(name, fallback) {
  const n = String(name || fallback || 'EB Garamond').replace(/["\\]/g, '');
  return `"${n}", "EB Garamond", Georgia, serif`;
}

function roman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
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
  const v = settings.chapterNumbering === 'roman' ? roman(n) : settings.chapterNumbering === 'words' ? words(n) : String(n);
  const label = (settings.chapterLabel || '').trim();
  return label ? `${label} ${v}` : v;
}

// ---------------------------------------------------------------- estilos nomeados
function styleDecl(st, body, opts) {
  opts = opts || {};
  const out = [];
  if (!st) return '';
  if (st.font !== undefined) out.push(`font-family: ${fontStack(st.font || body.font)}`);
  if (st.size) out.push(`font-size: ${num(st.size, 11)}pt`);
  if (st.lineHeight) out.push(`line-height: ${num(st.lineHeight, 1.4)}`);
  if (st.color) out.push(`color: ${color(st.color, '#000')}`);
  if (st.letterSpacing !== undefined) out.push(`letter-spacing: ${num(st.letterSpacing, 0)}em`);
  if (st.wordSpacing !== undefined) out.push(`word-spacing: ${num(st.wordSpacing, 0)}em`);
  if (st.align) out.push(`text-align: ${st.align}`);
  if (st.italic !== undefined) out.push(`font-style: ${st.italic ? 'italic' : 'normal'}`);
  if (st.bold !== undefined) out.push(`font-weight: ${st.bold ? 700 : 400}`);
  if (st.uppercase !== undefined) out.push(`text-transform: ${st.uppercase ? 'uppercase' : 'none'}`);
  if (st.smallcaps !== undefined) out.push(`font-variant-caps: ${st.smallcaps ? 'small-caps' : 'normal'}`);
  if (!opts.noIndent && st.indentLeft !== undefined) out.push(`margin-left: ${num(st.indentLeft, 0)}mm`);
  if (!opts.noIndent && st.indentRight !== undefined) out.push(`margin-right: ${num(st.indentRight, 0)}mm`);
  if (!opts.noSpace && st.spaceBefore !== undefined) out.push(`margin-top: ${num(st.spaceBefore, 0)}mm`);
  if (!opts.noSpace && st.spaceAfter !== undefined) out.push(`margin-bottom: ${num(st.spaceAfter, 0)}mm`);
  if (st.background) out.push(`background: ${color(st.background, 'transparent')}`);
  return out.join('; ') + ';';
}

// ---------------------------------------------------------------- notas de rodapé
// Remove os <span class="footnote">…</span> (com spans internos balanceados)
function stripFootnotes(html) {
  let out = '';
  let i = 0;
  const open = /<span\b[^>]*class="[^"]*\bfootnote\b[^"]*"[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    out += html.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    const tag = /<\/?span\b[^>]*>/gi;
    tag.lastIndex = j;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      j = tag.lastIndex;
    }
    i = j;
    open.lastIndex = j;
  }
  return out + html.slice(i);
}

// ---------------------------------------------------------------- figuras
function parseAttrs(s) {
  const a = {};
  String(s).replace(/([\w-]+)\s*=\s*"([^"]*)"/g, (m, k, v) => { a[k] = v; return m; });
  return a;
}

function figureHtml(attrs, inner, ctx) {
  const id = attrs['data-asset'];
  const asset = ctx.assets[id];
  const capMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner);
  const capStyle = (/<figcaption[^>]*\sdata-cap="([a-z]+)"/i.exec(inner) || [])[1];
  const caption = capMatch && capMatch[1].replace(/<[^>]+>/g, '').trim() ? capMatch[1] : '';
  if (!asset) {
    ctx.missing.push(id);
    return `<figure class="fig fig-missing" data-missing="${esc(id)}"><div class="fig-missing-box">Imagem ausente</div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }
  const align = attrs['data-align'] || 'center';
  const wrap = attrs['data-wrap'] || 'none';
  let width = Math.min(100, Math.max(5, num(attrs['data-width'], 60)));
  const gap = Math.max(0, num(attrs['data-gap'], 4));
  const rot = ((num(attrs['data-rot'], 0) % 360) + 360) % 360;
  const flipx = attrs['data-flipx'] === '1';
  const flipy = attrs['data-flipy'] === '1';
  const opacity = Math.min(100, Math.max(5, num(attrs['data-opacity'], 100))) / 100;
  const crop = String(attrs['data-crop'] || '0,0,0,0').split(',').map(v => Math.min(45, Math.max(0, num(v, 0))) / 100);
  const ratio = attrs['data-ratio'] || '';
  const fit = attrs['data-fit'] || 'cover';
  const [ct, cr, cb, cl] = crop;
  const cw = 1 - cl - cr;
  const ch = 1 - ct - cb;
  const iw = asset.width || 1000;
  const ih = asset.height || 1000;
  const quarter = rot % 180 === 90;
  let A; // proporção do quadro (largura/altura)
  if (ratio && /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(ratio)) {
    const [rw, rh] = ratio.split(':').map(Number);
    A = rw / rh;
  } else {
    A = (iw * cw) / (ih * ch);
    if (quarter) A = 1 / A;
  }
  if (align === 'full') width = 100;
  // Garante que a imagem caiba na mancha: reduz a largura se a altura passar do limite
  const colW = ctx.colW;
  const maxH = ctx.contentH * (caption ? 0.82 : 0.92);
  const hMM = (colW * width / 100) / A;
  if (hMM > maxH) width = Math.max(5, (maxH * A / colW) * 100);

  let floatSide = null;
  if (align !== 'full') {
    if (wrap === 'left') floatSide = 'right'; // texto só à esquerda => imagem à direita
    else if (wrap === 'right') floatSide = 'left';
    else if (wrap === 'square' || wrap === 'contour') floatSide = align === 'right' ? 'right' : 'left';
  }

  // com texto ao redor, a imagem ocupa no máximo 50% da mancha: sobra coluna de texto suficiente
  // para a justificação não abrir buracos nem quebrar linhas de forma desproporcional
  // (com contorno da forma, o texto encosta na figura: ela pode ocupar até 65%)
  if (floatSide) width = Math.min(width, wrap === 'contour' ? 65 : 50);
  // no centro com texto dos dois lados: sobra coluna suficiente de cada lado
  if (wrap === 'both' && align !== 'full') width = Math.min(width, 46);
  // avançar sobre a margem (como nas ilustrações de livros antigos): a figura sai da mancha pelo lado
  const out = floatSide && attrs['data-bleed'] === '1' ? Math.max(0, Math.min(num(ctx.settings.marginInner, 20), num(ctx.settings.marginOuter, 16)) - 3) : 0;
  const figStyle = [out ? `width: calc(${width.toFixed(2)}% + ${out.toFixed(2)}mm)` : `width: ${width.toFixed(2)}%`];
  if (floatSide) {
    figStyle.push(`float: ${floatSide}`);
    figStyle.push(floatSide === 'left' ? `margin: 0.25em ${gap}mm ${(gap * 0.6).toFixed(2)}mm ${out ? -out.toFixed(2) + 'mm' : 0}` : `margin: 0.25em ${out ? -out.toFixed(2) + 'mm' : 0} ${(gap * 0.6).toFixed(2)}mm ${gap}mm`);
  } else if (wrap === 'behind') {
    figStyle.push('height: 0', 'position: relative', 'overflow: visible', 'margin-top: 0', 'margin-bottom: 0');
  } else if (wrap === 'both' && align !== 'full') {
    // no centro com texto dos dois lados: sem margem acima/abaixo (a folga fica nas linhas ao redor)
    figStyle.push('margin-top: 0', 'margin-bottom: 0');
  } else {
    figStyle.push(`margin-top: ${gap}mm`, `margin-bottom: ${gap}mm`);
  }
  if (!floatSide) {
    if (align === 'left') figStyle.push('margin-left: 0', 'margin-right: auto');
    else if (align === 'right') figStyle.push('margin-left: auto', 'margin-right: 0');
    else figStyle.push('margin-left: auto', 'margin-right: auto');
  }
  const simple = !ratio && rot === 0 && !flipx && !flipy && ct + cr + cb + cl === 0;
  if (wrap === 'contour' && simple) {
    figStyle.push(`shape-outside: url("${asset.dataUrl}")`, 'shape-image-threshold: 0.25', `shape-margin: ${gap}mm`);
  }

  const flip = `${flipx ? ' scaleX(-1)' : ''}${flipy ? ' scaleY(-1)' : ''}`;
  let imgHtml;
  if (ratio) {
    imgHtml = `<img src="${asset.dataUrl}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:${fit}; transform: rotate(${rot}deg)${flip};">`;
  } else {
    // quadro > caixa girada > caixa recortada > imagem
    const rotBox = quarter
      ? `position:absolute; width:${(100 / A).toFixed(4)}%; height:${(100 * A).toFixed(4)}%; left:${((100 - 100 / A) / 2).toFixed(4)}%; top:${((100 - 100 * A) / 2).toFixed(4)}%; transform: rotate(${rot}deg)${flip};`
      : `position:absolute; inset:0; transform: rotate(${rot}deg)${flip};`;
    const imgStyle = `position:absolute; width:${(100 / cw).toFixed(4)}%; height:${(100 / ch).toFixed(4)}%; left:${(-cl / cw * 100).toFixed(4)}%; top:${(-ct / ch * 100).toFixed(4)}%; max-width:none;`;
    imgHtml = `<div style="${rotBox}"><div style="position:absolute; inset:0; overflow:hidden;"><img src="${asset.dataUrl}" alt="" style="${imgStyle}"></div></div>`;
  }
  const frame = `<div class="fig-frame" style="aspect-ratio: ${A.toFixed(5)}; opacity: ${opacity};${wrap === 'behind' ? ' position:absolute; left:0; right:0; top:0; z-index:-1;' : ''}">${imgHtml}</div>`;
  const printW = colW * width / 100;
  ctx.figures.push({ asset: id, widthMM: printW });
  // numeração automática (Figura N / Gráfico N) e entrada nas listas, para figuras com legenda
  let capHtml = caption, figId = '';
  const dataRef = attrs['data-ref'] || '';
  if (caption && wrap !== 'behind' && ctx.numbering) {
    const kind = asset.chart ? 'graf' : 'fig';
    const own = ownLabel(caption);
    if (own) {
      // legenda que já vem numerada (ex.: importada do Word): o texto e a numeração originais são mantidos
      ctx.counters[kind] = Math.max(ctx.counters[kind], own.n);
      figId = `${kind}-${ctx.counters[kind]}-${ctx.lists[kind].length}`;
      ctx.lists[kind].push({ id: figId, label: own.label, title: own.rest });
      capHtml = `<span class="cap-num">${own.labelHtml}</span>${own.sepHtml}${own.restHtml}`;
    } else {
      const n = ++ctx.counters[kind];
      figId = `${kind}-${n}`;
      const label = `${kind === 'graf' ? 'Gráfico' : 'Figura'} ${n}`;
      ctx.lists[kind].push({ id: figId, label, title: caption.replace(/<[^>]+>/g, '').trim() });
      capHtml = `<span class="cap-num">${label}</span> – ${caption}`;
    }
  }
  if (dataRef) {
    // referência cruzada: o rótulo atual da figura ("Figura 3") e o id final no livro
    const kind = asset.chart ? 'graf' : 'fig';
    const item = figId && ctx.lists[kind].find(x => x.id === figId);
    if (!figId) figId = dataRef;
    ctx.refs[dataRef] = { id: figId, label: item ? item.label : (asset.chart ? 'gráfico' : 'figura') };
  }
  const srcAttr = attrs['data-src'] !== undefined ? ` data-src="${esc(attrs['data-src'])}"` : '';
  return `<figure${figId ? ` id="${figId}"` : ''}${srcAttr} class="fig fig-${wrap}${align === 'full' ? ' fig-full' : ''}${asset.chart ? ' fig-chart' : ''}" data-asset="${esc(id)}" data-print-width="${printW.toFixed(2)}" data-px-width="${Math.round(iw * cw)}" style="${figStyle.join('; ')}">${frame}${capHtml && wrap !== 'behind' ? `<figcaption${capStyle ? ` data-cap="${esc(capStyle)}"` : ''}>${capHtml}</figcaption>` : ''}</figure>`;
}

// Estilos de legenda: o do livro (.capstyle-X) vale para as legendas sem estilo próprio (data-cap)
function captionStyleCss() {
  const C = '.fig figcaption, .chapter-body table caption, .chapter-body p.caption-text';
  const sel = (k, extra) => C.split(',').map(x => `.book.capstyle-${k} ${x.trim()}:not([data-cap])${extra || ''}, ${x.trim()}[data-cap="${k}"]${extra || ''}`).join(', ');
  const R = {
    classica: ['text-align: center; font-style: italic;', 'font-weight: 700; font-style: normal;'],
    editorial: ['text-align: center; font-style: normal; border-top: 0.4pt solid currentColor; padding-top: 1.2mm; width: 70%; margin-left: auto; margin-right: auto;', 'font-variant: small-caps; letter-spacing: 0.06em; font-weight: 400;'],
    moderna: ['text-align: left; font-style: normal;', 'text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.82em; font-weight: 700;'],
    discreta: ['text-align: left; font-style: italic; font-size: 0.88em; color: #555;', 'font-weight: 600; font-style: normal;'],
    destaque: ['text-align: left; font-style: italic;', 'background: #222; color: #fff; padding: 0.2mm 1.4mm; font-style: normal; font-weight: 700; font-size: 0.85em; letter-spacing: 0.04em;'],
    lateral: ['text-align: left; font-style: normal; border-left: 1.2pt solid currentColor; padding-left: 2mm;', 'font-weight: 700;']
  };
  return Object.entries(R).map(([k, [box, label]]) => `${sel(k)} { ${box} }\n${sel(k, ' .cap-num')} { ${label} }`).join('\n');
}

// Legenda que já traz o próprio rótulo numerado (“Figura 3 – …”, “Tabela 2. …”, “Quadro 1: …”)
const OWN_LABEL = /^\s*((?:Figura|Fig\.?|Gr[áa]fico|Tabela|Quadro|Imagem|Ilustra[çc][ãa]o|Mapa|Foto(?:grafia)?)\s*(\d+))\s*([–—:.-])?\s*/i;
function ownLabel(captionHtml) {
  const text = String(captionHtml).replace(/<[^>]+>/g, '');
  const m = OWN_LABEL.exec(text);
  if (!m) return null;
  // separa no HTML a parte do rótulo (para destacá-lo) do restante, preservando itálicos etc.
  const hm = OWN_LABEL.exec(String(captionHtml));
  const restHtml = hm ? String(captionHtml).slice(hm[0].length) : esc(text.slice(m[0].length));
  return { n: Number(m[2]), label: m[1].trim(), rest: text.slice(m[0].length).trim(), labelHtml: hm ? hm[1] : esc(m[1]), sepHtml: m[3] ? ` ${m[3]} ` : ' – ', restHtml };
}

// tabelas de até 15 linhas ficam inteiras numa página (com o título)
// Tabela colada com a formatação original: mesmas proporções de colunas, encaixada na largura da mancha
// (nunca maior que ela); se era mais larga que a página, a letra diminui na mesma medida (com limite).
function origTables(html, ctx) {
  if (!/tb-orig/.test(html)) return html;
  const colPx = (ctx.colW || 100) * 96 / 25.4;
  return String(html).replace(/<table\b([^>]*\btb-orig\b[^>]*)>(\s*<caption\b[\s\S]*?<\/caption>)?/gi, (m, attrs, cap) => {
    const a = parseAttrs(attrs);
    const tw = Number(a['data-tw']) || colPx;
    const width = Math.min(100, Math.max(25, tw / colPx * 100));
    const cols = String(a['data-cols'] || '').split(',').map(Number).filter(v => v > 0);
    // letra: do tamanho das tabelas do livro; menor só quando a palavra ou número mais longo de cada
    // coluna não caberia na largura da página (nada é partido ao meio)
    const bookPx = num((ctx.settings.styles.table || {}).size, 9.5) * 96 / 72;
    const minW = Number(a['data-minw']) || 0, ofs = Number(a['data-fs']) || bookPx;
    const need = minW ? minW * (bookPx / ofs) * 1.1 + Math.max(1, cols.length) * 2 : 0;
    const fs = need > colPx ? Math.max(0.55, colPx * 0.97 / need) : 1;
    const sum = cols.reduce((x, y) => x + y, 0) || 1;
    const cg = cols.length ? `<colgroup>${cols.map(c => `<col style="width:${(c / sum * 100).toFixed(2)}%">`).join('')}</colgroup>` : '';
    const rest = attrs.replace(/\sstyle="[^"]*"/i, '');
    return `<table${rest} style="width:${width.toFixed(1)}%;${fs < 1 ? ` font-size:${fs.toFixed(2)}em;` : ''}">${cap || ''}${cg}`;
  });
}

function markShortTables(html) {
  return String(html).replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (m, attrs, inner) => {
    if ((inner.match(/<tr\b/gi) || []).length > 15) return m;
    if (/\sclass="/.test(attrs)) return `<table${attrs.replace(/\sclass="/, ' class="tb-short ')}>${inner}</table>`;
    return `<table class="tb-short"${attrs}>${inner}</table>`;
  });
}

// Caixas de texto longas (mais de ~5 linhas) podem continuar na página seguinte; as curtas ficam inteiras
function markLongBoxes(html) {
  return String(html).replace(/<div\b([^>]*\bclass="box"[^>]*)>([\s\S]*?)<\/div>/gi, (m, attrs, inner) => {
    const words = inner.replace(/<span class="footnote">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return words > 50 ? `<div${attrs.replace(/\bclass="box"/, 'class="box box-long"')}>${inner}</div>` : m;
  });
}

// Tabelas e quadros com título (legenda): Tabela N / Quadro N – título, com âncora para as listas.
// Quadro = tabela marcada como quadro (classe tb-quadro) ou com legenda "Quadro N".
function numberTables(html, ctx) {
  return String(html).replace(/<table\b([^>]*)>(\s*)(?:<caption\b([^>]*)>([\s\S]*?)<\/caption>)?/gi, (m, attrs, sp, cattrs, cap) => {
    const dataRef = (/\sdata-ref="([^"]+)"/.exec(attrs) || [])[1] || '';
    const ownId = (/\sid="([^"]+)"/.exec(attrs) || [])[1] || '';
    const text = cap ? cap.replace(/<[^>]+>/g, '').trim() : '';
    let kind = /\bclass="[^"]*\btb-quadro\b/.test(attrs) ? 'quad' : 'tab';
    const own = text ? ownLabel(cap) : null;
    if (own && /^quadro/i.test(own.label)) kind = 'quad';
    if (own && /^tabela/i.test(own.label)) kind = 'tab';
    const word = kind === 'quad' ? 'Quadro' : 'Tabela';
    const withId = id => (ownId ? attrs : ` id="${id}"${attrs}`);
    if (!text || !ctx.numbering) {
      if (dataRef) {
        ctx.refs[dataRef] = { id: ownId || dataRef, label: word.toLowerCase() };
        return `<table${withId(dataRef)}>${sp}${cap !== undefined ? `<caption${cattrs || ''}>${cap}</caption>` : ''}`;
      }
      return m;
    }
    let id, label, capOut;
    if (own) {
      ctx.counters[kind] = Math.max(ctx.counters[kind], own.n);
      id = ownId || `${kind}-${ctx.counters[kind]}-${ctx.lists[kind].length}`;
      label = own.label;
      ctx.lists[kind].push({ id, label, title: own.rest });
      capOut = `<span class="cap-num">${own.labelHtml}</span>${own.sepHtml}${own.restHtml}`;
    } else {
      const n = ++ctx.counters[kind];
      id = ownId || `${kind}-${n}`;
      label = `${word} ${n}`;
      ctx.lists[kind].push({ id, label, title: text });
      capOut = `<span class="cap-num">${label}</span> – ${cap}`;
    }
    if (dataRef) ctx.refs[dataRef] = { id, label };
    return `<table${withId(id)}>${sp}<caption${cattrs || ''}>${capOut}</caption>`;
  });
}

// Listas de figuras, gráficos e tabelas (mesma aparência e numeração de páginas do sumário)
function listsHtml(project, ctx) {
  const f = project.front || {};
  const out = [];
  [['listFigures', 'fig', 'Lista de figuras', 'lista-figuras'], ['listCharts', 'graf', 'Lista de gráficos', 'lista-graficos'], ['listTables', 'tab', 'Lista de tabelas', 'lista-tabelas'], ['listQuadros', 'quad', 'Lista de quadros', 'lista-quadros']].forEach(([key, kind, title, id]) => {
    const items = ctx.lists[kind];
    if (!f[key] || !items.length) return;
    const li = items.map(it => `<li class="toc-l1"><a href="#${esc(it.id)}"><span class="toc-label">${esc(it.label)}</span><span class="toc-title">${esc(it.title)}</span><span class="toc-dots"></span><span class="toc-page"></span></a></li>`).join('');
    out.push(`<section class="front toc list-of${ctx.frontNum ? ' front-num' : ''}" id="${id}"><h2 class="toc-heading">${esc(f[key + 'Title'] || title)}</h2><ul class="toc-list">${li}</ul></section>`);
  });
  return out;
}

function fullBleedHtml(assetId, fit, ctx, extraClass, box) {
  const asset = ctx.assets[assetId];
  if (!asset) { ctx.missing.push(assetId); return ''; }
  // box com legenda ou texto informativo sobre a imagem (canto ou faixa, escuro ou claro)
  const boxHtml = box && String(box.text || '').trim() ? `<div class="fb-box fb-pos-${esc(box.pos || 'bl')} fb-look-${esc(box.look || 'dark')}">${box.title ? `<div class="fb-box-title">${esc(box.title)}</div>` : ''}${String(box.text).split(/\n{2,}/).map(t => `<p>${multiline(t.trim())}</p>`).join('')}</div>` : '';
  return `<section class="fullbleed ${extraClass || ''}" data-asset="${esc(assetId)}"><div class="fb-img" style="background-image:url('${asset.dataUrl}'); background-size:${fit === 'contain' ? 'contain' : 'cover'};"></div>${boxHtml}</section>`;
}

// Blocos de imagem (cinza, à espera da imagem) e caixas de texto à parte
function blocksHtml(html, ctx) {
  // bloco de imagem: horizontal (largura total) ou vertical, com legenda de teste
  html = html.replace(/<div\b([^>]*class="[^"]*\bph-block\b[^"]*"[^>]*)>([\s\S]*?)<\/div>/gi, (m, attrs, inner) => {
    const a = parseAttrs(attrs);
    const v = a['data-ph'] === 'v';
    const cap = a['data-cap'] !== '0';
    const capText = inner.replace(/<[^>]+>/g, '').trim() || 'Legenda de teste: descreva a imagem aqui.';
    const src = a['data-src'] !== undefined ? ` data-src="${esc(a['data-src'])}"` : '';
    const tools = ctx.markBlocks ? `<button class="ph-plus" title="Escolher a imagem que ilustra a matéria">+</button><span class="ph-tools" contenteditable="false"><button class="ph-cap" title="${cap ? 'Tirar a legenda' : 'Pôr legenda'}">${cap ? 'Legenda ✓' : 'Legenda ✕'}</button><button class="ph-del" title="Remover o bloco">✕</button></span>` : '';
    return `<figure class="ph ph-${v ? 'v' : 'h'}"${src} contenteditable="false"><div class="ph-box"><span class="ph-label">${v ? 'Imagem vertical' : 'Imagem horizontal'}</span>${tools}</div>${cap ? `<figcaption>${esc(capText)}</figcaption>` : ''}</figure>`;
  });
  // caixa de texto à parte: só o texto aparece (a caixa só delimita o espaço)
  html = html.replace(/<div\b([^>]*class="[^"]*\btframe\b[^"]*"[^>]*)>/gi, (m, attrs) => {
    const a = parseAttrs(attrs);
    const pos = ['left', 'right', 'center', 'band'].includes(a['data-pos']) ? a['data-pos'] : 'right';
    const w = Math.max(20, Math.min(pos === 'band' ? 100 : 60, num(a['data-width'], 40)));
    const look = ['pull', 'plain', 'quote'].includes(a['data-look']) ? a['data-look'] : 'pull';
    const src = a['data-src'] !== undefined ? ` data-src="${esc(a['data-src'])}"` : '';
    const keep = a['data-border'] === 'keep'; // manter: o contorno tracejado sai também no PDF
    return `<div class="tframe tf-${pos} tf-${look}${keep ? ' tf-keep' : ''}${pos === 'center' ? ' fig-both' : ''}"${src} data-pos="${pos}" style="width:${w}%"${ctx.markBlocks ? ' data-guide="1"' : ''}>`;
  });
  return html;
}

function processBody(html, ctx) {
  html = html || '';
  html = html.replace(/\ssrc="blob:[^"]*"/g, '');
  // comentários de revisão nunca saem no livro
  html = html.replace(/<span class="comment"[^>]*>[\s\S]*?<\/span>/g, '');
  html = X.collectIndex(html, ctx);
  if (!ctx.settings.footnotesVisible) html = stripFootnotes(html);
  html = html.replace(/<figure\b([^>]*class="[^"]*\bimg\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/gi, (m, attrs, inner) => figureHtml(parseAttrs(attrs), inner, ctx));
  html = blocksHtml(html, ctx);
  // imagens soltas com data-asset (ex.: dentro de tabelas/caixas)
  html = html.replace(/<img\b([^>]*?)\bdata-asset="([^"]+)"([^>]*)>/gi, (m, a, id, b) => {
    if (/\bsrc="data:/.test(m)) return m;
    const asset = ctx.assets[id];
    if (!asset) { ctx.missing.push(id); return ''; }
    return `<img${a}src="${asset.dataUrl}"${b}>`;
  });
  // ligação interna com número de página: reserva o espaço do número (preenchido após a paginação)
  html = html.replace(/(<a\b[^>]*class="[^"]*\bxref-page\b[^"]*"[^>]*>)([\s\S]*?)<\/a>/gi, (m, open, inner) => `${open}${inner}<span class="xref-num">, p.&nbsp;<span class="xref-n">00</span></span></a>`);
  return html;
}

// Marca cada bloco do primeiro nível do capítulo com a sua posição (data-src="n"): a edição direta nas
// páginas usa essa posição para achar o mesmo parágrafo no texto do capítulo.
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function markBlocks(html) {
  let depth = 0;
  let k = 0;
  return String(html || '').replace(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g, (m, close, tag, attrs, selfClose) => {
    if (!tag) return m;
    const t = tag.toLowerCase();
    if (close) { depth = Math.max(0, depth - 1); return m; }
    const top = depth === 0;
    if (!VOID_TAGS.has(t) && !selfClose) depth++;
    if (!top) return m;
    const n = k++;
    if (/\sdata-src=/.test(attrs)) return m;
    return `<${tag} data-src="${n}"${attrs}${selfClose}>`;
  });
}

// Imersão: imagem acima do título do capítulo, até além do corte. Uma imagem para todos, ou uma por
// capítulo (distribuição aleatória guardada em assign; capítulo novo sem sorteio usa a sequência)
function immersionFor(project, c, i, ctx) {
  const im = project.immersion;
  if (!im || !im.mode || im.mode === 'off') return null;
  if (im.numberedOnly && !c.numbered) return null;
  let id = null;
  if (im.mode === 'single') id = im.single;
  else {
    const pool = (im.pool || []).filter(x => ctx.assets[x]);
    id = (im.assign || {})[c.id];
    if (!id || !ctx.assets[id]) id = pool.length ? pool[i % pool.length] : null;
  }
  return id && ctx.assets[id] ? id : null;
}

// Molduras: modelos (desenho na margem, em volta da mancha, com folga) ou imagens enviadas (fundo da página
// inteira, com o texto por cima e afastado das bordas desenhadas)
const frameOk = (id, ctx) => !!id && (!!PageFrames.FRAMES[id] || (/^up:/.test(id) && !!ctx.assets[id.slice(3)]));
// margens mínimas (mm) para o texto não tocar a moldura enviada: faixa desenhada (medida na imagem) + folga
function frameMargins(id, s, ctx) {
  if (!/^up:/.test(id || '')) return null;
  const a = ctx.assets[id.slice(3)];
  if (!a) return null;
  const ins = a.frameInset || { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 };
  const W = num(s.pageWidth, 140), H = num(s.pageHeight, 210), gap = 4;
  return { top: ins.top * H + gap, bottom: ins.bottom * H + gap, left: ins.left * W + gap, right: ins.right * W + gap };
}
function frameCss(project, ctx) {
  const s = project.settings;
  const all = (project.frames || {}).all;
  const used = [...new Set(project.chapters.map(c => c.frame).concat([all]).filter(id => frameOk(id, ctx)))];
  if (!used.length) return '';
  const mt = num(s.marginTop, 20), mb = num(s.marginBottom, 22), mi = num(s.marginInner, 22), mo = num(s.marginOuter, 16);
  const g = 3.5, minM = Math.min(mt, mb, mi, mo);
  let t0 = Math.min(9, Math.max(2.5, minM * 0.45));
  t0 = Math.min(t0, minM - g - 1.5);
  const out = ['.pagedjs_page[data-frame] .pagedjs_pagebox { position: relative; z-index: 0; }'];
  used.filter(id => /^up:/.test(id)).forEach(id => {
    // imagem enviada: ao fundo da página (atrás do texto), na medida da página
    out.push(`.pagedjs_page[data-frame="${id}"] .pagedjs_pagebox::before { content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: -1; pointer-events: none; background: url("${ctx.assets[id.slice(3)].dataUrl}") center / 100% 100% no-repeat; }`);
  });
  if (t0 < 1.2) return out.join('\n');
  used.filter(id => PageFrames.FRAMES[id]).forEach(id => {
    // modelos “imersivos” ocupam quase toda a margem
    const t = PageFrames.FRAMES[id].wide ? Math.max(t0, Math.min(14, minM - g - 1)) : t0;
    const w = ctx.colW + 2 * (g + t), h = ctx.contentH + 2 * (g + t);
    const svg = PageFrames.svg(id, w, h, t, g);
    const sel = `.pagedjs_page[data-frame="${id}"] .pagedjs_pagebox::before`;
    out.push(`${sel} { content: ""; position: absolute; z-index: 0; pointer-events: none; width: ${w.toFixed(2)}mm; height: ${h.toFixed(2)}mm; top: ${(mt - g - t).toFixed(2)}mm; left: ${(mi - g - t).toFixed(2)}mm; background: url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") no-repeat; background-size: 100% 100%; }`);
    out.push(`.pagedjs_page.pagedjs_left_page[data-frame="${id}"] .pagedjs_pagebox::before { left: ${(mo - g - t).toFixed(2)}mm; }`);
  });
  return out.join('\n');
}

// Divide o corpo do capítulo nas páginas de imagem sangrada
function splitFullBleed(html) {
  const parts = [];
  const re = /<div\b[^>]*class="[^"]*\bfullbleed\b[^"]*"[^>]*>\s*<\/div>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    parts.push({ type: 'text', html: html.slice(last, m.index) });
    const a = parseAttrs(m[0]);
    parts.push({ type: 'image', asset: a['data-asset'], fit: a['data-fit'] || 'cover' });
    last = re.lastIndex;
  }
  parts.push({ type: 'text', html: html.slice(last) });
  return parts;
}

function separatorHtml(chapter, s, ctx) {
  let mode = chapter.separator && chapter.separator !== 'default' ? chapter.separator : s.separator;
  let asset = null;
  if (mode !== 'none' && mode !== 'line' && mode !== 'image') { asset = mode; mode = 'image'; }
  if (mode === 'image' && !asset) asset = s.separatorAsset;
  if (mode === 'none') return '';
  if (mode === 'image' && asset && ctx.assets[asset]) {
    return `<div class="chapter-sep"><img src="${ctx.assets[asset].dataUrl}" alt="" style="width:${num(s.separatorWidth, 30)}%"></div>`;
  }
  return `<div class="chapter-sep"><hr class="sep-line" style="width:${num(s.separatorWidth, 30)}%"></div>`;
}

// ---------------------------------------------------------------- ficha catalográfica
function invertName(name) {
  const p = String(name || '').trim().split(/\s+/);
  if (p.length < 2) return name || '';
  const last = p.pop();
  return `${last.toUpperCase()}, ${p.join(' ')}`;
}

function catalogHtml(project, ctx) {
  const { meta, catalog: c, settings: s } = project;
  const parts = [];
  const credits = (c.credits || []).filter(x => x && x.name && x.name.trim());
  if (credits.length) {
    parts.push(`<div class="cat-credits">${credits.map(x => `<div><span class="cat-role">${esc(x.role)}:</span> ${esc(x.name)}</div>`).join('')}</div>`);
  }
  parts.push(`<div class="cat-rights">${multiline(c.rights || `© ${meta.year || ''} ${meta.author || ''}\nTodos os direitos reservados. Nenhuma parte desta obra pode ser reproduzida sem autorização prévia, exceto em citações breves com indicação da fonte.`)}</div>`);
  if (c.enabled !== false) {
    if (c.mode === 'manual') {
      if (c.manualText && c.manualText.trim()) {
        // ficha colada: mantém quebras de linha e recuos; o cabeçalho CIP só entra se não vier no texto
        const txt = String(c.manualText).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
        const pc = c.manualRaw ? null : CatalogParse.parse(txt);
        if (pc && pc.ok) {
          // ficha colada reorganizada com a mesma estrutura (e o mesmo cabeçalho) do modelo escolhido
          const clsHtml = pc.cls.map(parts2 => `<div class="cat-class${parts2.length > 1 ? ' cat-class-split' : ''}">${parts2.map(x => `<span>${esc(x)}</span>`).join('')}</div>`).join('');
          parts.push(`<div class="cat-box cat-pasted">${catHead(c)}
            ${pc.cutter ? `<div class="cat-cutter">${esc(pc.cutter)}</div>` : ''}
            <div class="cat-body"${pc.cutter ? ' style="margin-left:12mm"' : ''}><div class="cat-entry">${esc(pc.entry)}</div>${pc.paras.map(x => `<div class="cat-indent">${esc(x)}</div>`).join('')}${pc.subjects ? `<div class="cat-indent cat-subjects">${esc(pc.subjects)}</div>` : ''}</div>
            ${clsHtml}
            ${pc.indices.length ? `<div class="cat-indices">${pc.indices.map((x, i) => `<div${i ? '' : ' class="cat-indices-head"'}>${esc(x)}</div>`).join('')}</div>` : ''}
            ${pc.librarian.map(x => `<div class="cat-lib">${esc(x)}</div>`).join('')}
          </div>`);
        } else {
          const hasHead = /dados\s+internacionais\s+de\s+cataloga/i.test(txt);
          parts.push(`<div class="cat-box">${hasHead ? '' : catHead(c)}<div class="cat-manual">${esc(txt)}</div></div>`);
        }
      }
    } else {
      const wcm = (num(s.pageWidth, 140) / 10).toLocaleString('pt-BR');
      const hcm = (num(s.pageHeight, 210) / 10).toLocaleString('pt-BR');
      const pages = c.pagesOverride ? esc(c.pagesOverride) : '<span class="cat-pages">…</span>';
      const resp = [meta.author, c.translator ? `tradução de ${c.translator}` : '', c.illustrator ? `ilustrações de ${c.illustrator}` : ''].filter(Boolean).join(' ; ');
      const subjects = String(c.subjects || '').split(/[\n;]+/).map(x => x.trim()).filter(Boolean);
      const lines = [];
      lines.push(`<div class="cat-entry">${esc(c.authorEntry || invertName(meta.author))}</div>`);
      lines.push(`<div class="cat-indent">${esc(meta.title)}${meta.subtitle ? ` : ${esc(meta.subtitle)}` : ''}${resp ? ` / ${esc(resp)}` : ''}.${meta.edition ? ` — ${esc(String(meta.edition).replace(/\.\s*$/, ''))}.` : ''} — ${esc(meta.city || '[S.l.]')} : ${esc(meta.publisher || '[s.n.]')}, ${esc(meta.year || '')}.</div>`);
      lines.push(`<div class="cat-indent">${pages} p. ; ${wcm} × ${hcm} cm.${c.series ? ` — (${esc(c.series)})` : ''}</div>`);
      if (c.originalTitle) lines.push(`<div class="cat-indent">Título original: ${esc(c.originalTitle)}</div>`);
      if (c.notes) lines.push(`<div class="cat-indent">${multiline(c.notes)}</div>`);
      if (meta.isbn) lines.push(`<div class="cat-indent">ISBN ${esc(meta.isbn)}</div>`);
      if (subjects.length) lines.push(`<div class="cat-indent cat-subjects">${subjects.map((x, i) => `${i + 1}. ${esc(x)}.`).join(' ')} I. Título.</div>`);
      const cls = [c.cdd ? `CDD ${esc(c.cdd)}` : '', c.cdu ? `CDU ${esc(c.cdu)}` : ''].filter(Boolean).join('&emsp;');
      parts.push(`<div class="cat-box">${catHead(c)}
        ${c.cutter ? `<div class="cat-cutter">${esc(c.cutter)}</div>` : ''}
        <div class="cat-body"${c.cutter ? ' style="margin-left:12mm"' : ''}>${lines.join('')}</div>
        ${cls ? `<div class="cat-class">${cls}</div>` : ''}
        ${c.librarian ? `<div class="cat-lib">Ficha elaborada por ${esc(c.librarian)}${c.crb ? ` — CRB ${esc(c.crb)}` : ''}</div>` : ''}
      </div>`);
    }
  }
  // crédito de distribuição logo abaixo da ficha (CEDET: obrigatório; usa o texto do manual se o campo estiver vazio)
  const dist = String(c.distribution || (s.standard === 'cedet' ? CEDET.distribution : '')).replace(/\r\n?/g, '\n').trim();
  if (dist) {
    const [first, ...rest] = dist.split('\n');
    parts.push(`<div class="cat-dist"><div class="cat-dist-head">${esc(first)}</div>${rest.length ? multiline(rest.join('\n')) : ''}</div>`);
  }
  const media = [];
  (c.images || []).forEach(im => {
    const a = ctx.assets[im.asset];
    if (a) media.push(`<div class="cat-media"><img src="${a.dataUrl}" style="width:${num(im.width, 25)}mm">${im.caption ? `<div>${esc(im.caption)}</div>` : ''}</div>`);
  });
  (ctx.qrImages || []).forEach(q => {
    media.push(`<div class="cat-media"><img src="${q.dataUrl}" style="width:${num(q.size, 22)}mm">${q.caption ? `<div>${esc(q.caption)}</div>` : ''}</div>`);
  });
  if (media.length) parts.push(`<div class="cat-medias">${media.join('')}</div>`);
  if (c.contact) parts.push(`<div class="cat-contact">${multiline(c.contact)}</div>`);
  return `<section class="front copyright-page cat-style-${esc(c.style || 'box')} cat-pos-${c.position === 'top' ? 'top' : 'bottom'}" id="ficha">${parts.join('')}</section>`;
}
function catHead(c) {
  return `<div class="cat-head">Dados Internacionais de Catalogação na Publicação (CIP)${c.style === 'cbl' ? '<br>(Câmara Brasileira do Livro, SP, Brasil)' : ''}</div>`;
}

// ---------------------------------------------------------------- HTML
// Dá um id estável a cada título T1/T2/T3 do capítulo (para sumário e links)
function anchorHeadings(html, chapterId, collect) {
  let k = 0;
  return String(html || '').replace(/<(h[234])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    k += 1;
    const level = Number(tag[1]); // h2 (T1) = nível 2, h3 (T2) = nível 3, h4 = nível 4
    const existing = /\sid="([^"]+)"/.exec(attrs);
    const id = existing ? existing[1] : `${chapterId}-s${k}`;
    if (collect) collect.push({ id, level, title: inner.replace(/<span class="footnote">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), index: k });
    return existing ? m : `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });
}

function tocHtml(project, items, ctx) {
  const { front } = project;
  const style = ['dots', 'plain', 'inline', 'numleft', 'twocol', 'summary'].includes(front.tocStyle) ? front.tocStyle : 'dots';
  let entries;
  if (front.tocMode === 'manual' && Array.isArray(front.tocEntries) && front.tocEntries.length) {
    entries = front.tocEntries.filter(e => e && e.title).map(e => ({ id: e.target || '', label: e.label || '', title: e.title, level: Number(e.level) || 1 }));
  } else {
    const max = Math.max(1, Math.min(3, Number(front.tocLevels) || 1));
    entries = items.filter(e => e.level <= max);
  }
  if (!entries.length) return '';
  const li = entries.map(c => {
    const inner = `${c.label ? `<span class="toc-label">${esc(c.label)}</span>` : ''}<span class="toc-title">${esc(c.title)}</span><span class="toc-dots"></span><span class="toc-page"></span>`;
    const sum = style === 'summary' && c.summary ? `<div class="toc-sum">${esc(c.summary)}</div>` : '';
    return `<li class="toc-l${c.level}">${c.id ? `<a href="#${esc(c.id)}">${inner}</a>` : `<a>${inner}</a>`}${sum}</li>`;
  }).join('');
  const theme = TocThemes.byKey(front.tocTheme).key;
  return `<section class="front toc tocstyle-${style}${theme !== 'none' ? ' tt-' + theme : ''}${ctx && ctx.frontNum ? ' front-num' : ''}" id="sumario"><h2 class="toc-heading">${esc(front.tocTitle || 'Sumário')}</h2><ul class="toc-list">${li}</ul></section>`;
}

function mastheadHtml(project, ctx) {
  const m = project.masthead || {};
  if (!m.show || !(m.name || '').trim()) return '';
  const logo = m.logo && ctx.assets[m.logo];
  return `<header class="masthead">
    ${logo ? `<img class="mh-logo" src="${logo.dataUrl}">` : ''}
    <div class="mh-name">${esc(m.name)}</div>
    ${m.tagline ? `<div class="mh-tagline">${esc(m.tagline)}</div>` : ''}
    <div class="mh-line"><span>${esc(m.edition || '')}</span><span>${esc(m.date || '')}</span></div>
  </header>`;
}

function buildHtml(project, ctx) {
  const { meta, front, chapters, settings, back, titlePage } = project;
  const periodical = project.kind === 'magazine' || project.kind === 'newspaper';
  const parts = [];
  // trecho de paginação de cada parte: 'front' | 'ch:<id>' | 'back' (a prévia pagina cada trecho à parte)
  const keys = [];
  let segKey = 'front';
  const push = h => { parts.push(h); keys.push(segKey); };
  const tocItems = [];

  // capa e imagens iniciais (opcionais): páginas inteiras, sem margens, antes da página de rosto
  const eb = project.ebook || {};
  if (!periodical && eb.coverInBook !== false && eb.coverAsset && ctx.assets[eb.coverAsset]) push(fullBleedHtml(eb.coverAsset, 'cover', ctx, 'book-cover'));
  if (!periodical) (eb.preImages || []).forEach(id => { if (ctx.assets[id]) push(fullBleedHtml(id, 'cover', ctx, 'pre-image')); });
  // Ordem padrão: página de rosto > ficha catalográfica > sumário > (dedicatória/epígrafe) > capítulos > páginas extras
  if (front.halfTitle) push(`<section class="front half-title"><div class="ht-title">${esc(meta.title)}</div></section>`);
  if (front.titlePage) {
    const logo = titlePage.logo && ctx.assets[titlePage.logo];
    push(`<section class="front title-page">
      <div class="tp-author">${esc(meta.author)}</div>
      <div class="tp-title">${esc(meta.title)}</div>
      ${meta.subtitle ? `<div class="tp-subtitle">${esc(meta.subtitle)}</div>` : ''}
      ${logo && titlePage.logoPlacement === 'below-title' ? `<div class="tp-brand"><img class="tp-logo" src="${logo.dataUrl}" style="width:${num(titlePage.logoWidth, 25)}mm">${titlePage.imprint && titlePage.imprint.trim() ? `<div class="tp-imprint">${multiline(titlePage.imprint)}</div>` : ''}</div>` : ''}
      <div class="tp-foot">
        ${logo && titlePage.logoPlacement !== 'below-title' ? `<img class="tp-logo" src="${logo.dataUrl}" style="width:${num(titlePage.logoWidth, 25)}mm">` : ''}
        ${titlePage.showPublisher && meta.publisher ? `<div class="tp-publisher">${esc(meta.publisher)}</div>` : ''}
        ${titlePage.showYear && (meta.city || meta.year) ? `<div class="tp-place">${esc([meta.city, meta.year].filter(Boolean).join(' · '))}</div>` : ''}
      </div>
    </section>`);
  }
  if (front.copyright) push(catalogHtml(project, ctx));
  const tocIndex = parts.length;

  if (front.dedication && meta.dedication && meta.dedication.trim()) {
    push(`<section class="front dedication"><div class="ded-text">${multiline(meta.dedication)}</div></section>`);
  }
  if (front.epigraph && meta.epigraph && meta.epigraph.trim()) {
    push(`<section class="front epigraph"><div class="epi-text">${multiline(meta.epigraph)}</div>${meta.epigraphAuthor ? `<div class="epi-author">${esc(meta.epigraphAuthor)}</div>` : ''}</section>`);
  }
  // revista/jornal: o nome da publicação entra no topo da primeira matéria (mesma página)
  let masthead = periodical ? mastheadHtml(project, ctx) : '';

  let n = 0;
  const hyph = settings.hyphenate ? getHyphenator() : null;
  const notesMode = periodical ? 'footnote' : (['chapter', 'book', 'side'].includes(settings.notesMode) ? settings.notesMode : 'footnote');
  ctx.noteN = 0;
  ctx.endnotes = [];
  chapters.forEach((c, i) => {
    segKey = 'ch:' + c.id;
    let label = '';
    if (c.numbered) { n += 1; label = chapterLabel(settings, n); }
    tocItems.push({ id: c.id, label, title: c.title, level: 1, summary: c.summary || '' });
    const hasOpening = !!(c.openingImage && c.openingImage.asset && ctx.assets[c.openingImage.asset]);
    if (hasOpening) push(fullBleedHtml(c.openingImage.asset, c.openingImage.fit, ctx));
    // página de imagem sangrada antes do capítulo/matéria (em página dupla: a imagem fica na página da esquerda)
    const bl = c.bleed || {};
    if (bl.before && bl.before.asset && ctx.assets[bl.before.asset]) push(fullBleedHtml(bl.before.asset, bl.before.fit, ctx, 'fb-chapter' + (bl.spread !== false ? ' fb-spread' : ''), bl.before.box));
    const heads = [];
    let body = markLongBoxes(markShortTables(origTables(numberTables(processBody(anchorHeadings(ctx.markBlocks ? markBlocks(c.html) : c.html, c.id, heads), ctx), ctx), ctx)));
    heads.forEach(h => tocItems.push({ id: h.id, label: '', title: h.title, level: h.level }));
    // notas no fim do capítulo, no fim do livro ou na margem externa (em vez do rodapé)
    if (notesMode !== 'footnote' && settings.footnotesVisible !== false) {
      const r = X.convertNotes(body, notesMode, ctx, i);
      body = r.html;
      if (notesMode === 'chapter') body += X.chapterEndnotes(r.notes, settings.endnotesTitle);
      if (notesMode === 'book') ctx.endnotes.push({ heading: [label, c.title].filter(Boolean).join(' — '), notes: r.notes });
    }
    if (hyph) { try { body = hyph(body); } catch (e) { /* sem hifenização */ } }
    // tabelas coladas com a formatação original: sem hifenização automática (como no original)
    if (/tb-orig/.test(body)) body = body.replace(/<table\b[^>]*\btb-orig\b[\s\S]*?<\/table>/g, m => m.replace(/\u00ad/g, ''));
    if (settings.hyphenExceptions) body = X.applyHyphenExceptions(body, settings.hyphenExceptions);
    const segments = splitFullBleed(body);
    segments.forEach((seg, k) => {
      if (seg.type === 'image') { push(fullBleedHtml(seg.asset, seg.fit, ctx)); return; }
      const cols = periodical ? (Number(c.columns) || Number(settings.columns) || 1) : (Number(c.columns) || 1);
      if (k === 0) {
        const imId = periodical ? null : immersionFor(project, c, i, ctx);
        const tb = Object.assign({}, settings.titleBox || {}, c.titleBox && c.titleBox.style ? c.titleBox : {});
        const tbCls = tb.style && tb.style !== 'none' ? ` tb-${tb.style}` : '';
        const tbAl = tb.align ? ` tb-al-${tb.align}` : '';
        const cls = `chapter${i === 0 ? ' first-chapter' : ''}${hasOpening ? ' after-opening' : ''}${imId ? ' has-immersion' : ''}${periodical ? ' article' + (c.newPage === false ? ' flow' : '') : ''}${tbCls}${tbAl}`;
        const frameAttr = !periodical && frameOk(c.frame, ctx) ? ` data-frame="${esc(c.frame)}"` : '';
        push(`<section class="${cls}" id="${esc(c.id)}" data-chapter="${i}" data-cols="${cols}"${frameAttr}>
          ${masthead}${imId ? `<div class="immersion${project.immersion.fade !== false ? ' fade' : ''}" data-asset="${esc(imId)}"><div class="im-img" style="background-image:url('${ctx.assets[imId].dataUrl}')"></div></div>` : ''}
          <header class="chapter-head">
            ${c.kicker ? `<div class="kicker">${esc(c.kicker)}</div>` : ''}
            ${label ? `<div class="chapter-label">${esc(label)}</div>` : ''}
            <h1 class="chapter-title">${esc(c.title)}</h1>
            ${c.lead ? `<div class="lead">${esc(c.lead)}</div>` : ''}
            ${c.byline ? `<div class="byline">${esc(c.byline)}</div>` : ''}
            ${periodical ? '' : separatorHtml(c, settings, ctx)}
          </header>
          <div class="chapter-body">${seg.html}</div>
        </section>`);
        masthead = '';
      } else if (seg.html.replace(/<[^>]+>/g, '').trim() || /<img|<figure|<table/.test(seg.html)) {
        push(`<section class="chapter chapter-cont" data-chapter="${i}" data-cols="${cols}"${!periodical && frameOk(c.frame, ctx) ? ` data-frame="${esc(c.frame)}"` : ''}><div class="chapter-body">${seg.html}</div></section>`);
      }
    });
    if (bl.after && bl.after.asset && ctx.assets[bl.after.asset]) push(fullBleedHtml(bl.after.asset, bl.after.fit, ctx, 'fb-chapter fb-after', bl.after.box));
  });

  segKey = 'back';
  if (back.bio && back.bio.enabled) {
    const photo = back.bio.photo && ctx.assets[back.bio.photo];
    tocItems.push({ id: 'sobre-autor', label: '', title: back.bio.title, level: 1 });
    push(`<section class="back-matter bio" id="sobre-autor">
      <h1 class="back-title">${esc(back.bio.title || 'Sobre o autor')}</h1>
      ${photo ? `<img class="bio-photo" src="${photo.dataUrl}" style="width:${num(back.bio.photoWidth, 35)}mm">` : ''}
      <div class="chapter-body">${processBody(back.bio.html, ctx)}</div>
    </section>`);
  }
  if (back.extra && back.extra.enabled) {
    tocItems.push({ id: 'conteudo-extra', label: '', title: back.extra.title, level: 1 });
    push(`<section class="back-matter extra" id="conteudo-extra">
      <h1 class="back-title">${esc(back.extra.title || '')}</h1>
      <div class="chapter-body">${processBody(back.extra.html, ctx)}</div>
    </section>`);
  }

  // notas no fim do livro e índice remissivo (páginas finais numeradas, entram no sumário)
  let endBook = notesMode === 'book' ? X.bookEndnotes(ctx.endnotes, settings.endnotesTitle) : '';
  if (endBook) {
    if (hyph) { try { endBook = hyph(endBook); } catch (e) { /* ok */ } }
    tocItems.push({ id: 'notas', label: '', title: settings.endnotesTitle || 'Notas', level: 1 });
    push(endBook);
  }
  const ixHtml = X.indexHtml(ctx, settings);
  if (ixHtml) {
    tocItems.push({ id: 'indice-remissivo', label: '', title: (settings.index && settings.index.title) || 'Índice remissivo', level: 1 });
    push(ixHtml);
  }

  ctx.tocItems = tocItems;
  // listas de figuras/gráficos/tabelas logo depois do sumário
  const lists = listsHtml(project, ctx);
  if (lists.length) { parts.splice(tocIndex, 0, ...lists); keys.splice(tocIndex, 0, ...lists.map(() => 'front')); }
  if (front.toc) {
    const toc = tocHtml(project, tocItems, ctx);
    if (toc) { parts.splice(tocIndex, 0, toc); keys.splice(tocIndex, 0, 'front'); }
  }

  const open = `<div class="book kind-${esc(project.kind || 'book')} capstyle-${esc(settings.captionStyle || 'classica')} notes-${notesMode}${settings.referenceStyle === 'abnt' ? ' ref-abnt' : ''}${settings.quoteStyle === 'abnt' ? ' quote-abnt' : ''}" lang="${esc(project.meta.language || 'pt-BR')}" data-number-from-first="${settings.numberFromFirstChapter || ctx.frontNum ? 1 : 0}" data-front-roman="${ctx.frontNum ? 1 : 0}">`;
  // trechos: revista e jornal correm as matérias na mesma página, então são um trecho só
  const segs = [];
  if (periodical) segs.push({ key: 'all', parts });
  else parts.forEach((h, i) => { const k = keys[i]; if (!segs.length || segs[segs.length - 1].key !== k) segs.push({ key: k, parts: [] }); segs[segs.length - 1].parts.push(h); });
  ctx.segments = segs.map(sg => ({ key: sg.key, html: X.resolveXrefs(open + sg.parts.join('\n') + '</div>', ctx) }));
  return X.resolveXrefs(open + parts.join('\n') + '</div>', ctx);
}

// ---------------------------------------------------------------- CSS
function buildCss(project, ctx) {
  const { meta, settings: s, chapters } = project;
  const S = s.styles;
  const body = S.body;
  const mm = v => `${num(v, 0)}mm`;
  const contentH = ctx.contentH;
  const bleed = ctx.bleed;

  let leftHeader = 'none';
  let rightHeader = 'none';
  const periodical = project.kind === 'magazine' || project.kind === 'newspaper';
  const mh = project.masthead || {};
  if (periodical && s.header !== 'none') { leftHeader = cssString([mh.name || meta.title, mh.edition, mh.date].filter(Boolean).join('  ·  ')); rightHeader = 'string(chaptitle)'; }
  else if (s.header === 'title-chapter') { leftHeader = cssString(meta.title); rightHeader = 'string(chaptitle)'; }
  else if (!periodical && s.header === 'author-title') { leftHeader = cssString(meta.author); rightHeader = cssString(meta.title); }
  else if (!periodical && s.header === 'chapter-chapter') { leftHeader = 'string(chaptitle)'; rightHeader = 'string(chaptitle)'; }

  // CEDET: numeração só no canto inferior externo ou no centro inferior (nunca no topo nem no lado interno)
  const pn = s.standard === 'cedet' && s.pageNumbers !== 'center' && s.pageNumbers !== 'none' ? 'outer' : s.pageNumbers;
  // folioGap: o número fica logo abaixo da mancha (dentro da margem de segurança) em vez de centrado na margem
  const folioPos = num(s.folioGap, 0) > 0 ? ` vertical-align: top; padding-top: ${num(s.folioGap, 0)}mm;` : '';
  const H = S.header;
  const P = S.pageNumber;
  const boxStyle = `font-family: ${fontStack(H.font || body.font)}; font-size: ${num(H.size, 8.5)}pt; letter-spacing: ${num(H.letterSpacing, 0)}em; text-transform: ${H.uppercase ? 'uppercase' : 'none'}; font-style: ${H.italic ? 'italic' : 'normal'}; color: ${color(H.color, '#222')}; vertical-align: bottom; padding-bottom: 4mm;`;
  const numStyle = `font-family: ${fontStack(P.font || body.font)}; font-size: ${num(P.size, 9.5)}pt; color: ${color(P.color, '#000')}; text-transform: none; letter-spacing: 0; font-style: normal;`;

  function marginRules(name, extra, textColor, noHeader) {
    const L = [];
    const R = [];
    const hl = pn === 'top-outer' ? '@top-center' : '@top-left';
    const hr = pn === 'top-outer' ? '@top-center' : '@top-right';
    L.push(`${hl} { content: ${noHeader ? 'none' : leftHeader}; ${boxStyle} }`);
    R.push(`${hr} { content: ${noHeader ? 'none' : rightHeader}; ${boxStyle} }`);
    if (pn === 'outer') { L.push(`@bottom-left { content: counter(page); ${numStyle}${folioPos} }`); R.push(`@bottom-right { content: counter(page); ${numStyle}${folioPos} }`); }
    if (pn === 'center') { L.push(`@bottom-center { content: counter(page); ${numStyle}${folioPos} }`); R.push(`@bottom-center { content: counter(page); ${numStyle}${folioPos} }`); }
    if (pn === 'top-outer') { L.push(`@top-left { content: counter(page); ${numStyle} vertical-align: bottom; padding-bottom: 4mm; }`); R.push(`@top-right { content: counter(page); ${numStyle} vertical-align: bottom; padding-bottom: 4mm; }`); }
    if (textColor) { const add = x => x.replace(/; \}/g, `; color: ${textColor}; }`); L.splice(0, L.length, ...L.map(add)); R.splice(0, R.length, ...R.map(add)); }
    return `
@page ${name}:left { ${extra || ''} ${L.join(' ')} }
@page ${name}:right { ${extra || ''} ${R.join(' ')} }
@page ${name}:first { @top-left { content: none; } @top-center { content: none; } @top-right { content: none; } }`;
  }

  const pageNames = chapters.map((c, i) => `.chapter[data-chapter="${i}"] { page: ch${i}; }`).join('\n');
  // moldura enviada: o texto se afasta da faixa desenhada (margens maiores nessas páginas);
  // a abertura com imagem de imersão fica sem moldura e com as margens normais
  const fAll = periodical ? '' : (project.frames || {}).all;
  const mAll = frameOk(fAll, ctx) ? frameMargins(fAll, s, ctx) : null;
  const pm = (req, side) => {
    const L = side === 'left', mtop = Math.max(num(s.marginTop, 20), req ? req.top : 0), mbot = Math.max(num(s.marginBottom, 22), req ? req.bottom : 0);
    const ml = Math.max(num(L ? s.marginOuter : s.marginInner, 16), req ? req.left : 0), mr = Math.max(num(L ? s.marginInner : s.marginOuter, 16), req ? req.right : 0);
    return `margin-top: ${mm(mtop)}; margin-bottom: ${mm(mbot)}; margin-left: ${mm(ml)}; margin-right: ${mm(mr)};`;
  };
  const frameMarginRules = periodical ? '' : chapters.map((c, i) => {
    const own = frameOk(c.frame, ctx) ? frameMargins(c.frame, s, ctx) : null;
    const req = c.frame && frameOk(c.frame, ctx) ? own : mAll;
    const imm = !!immersionFor(project, c, i, ctx);
    let r = req ? `@page ch${i}:left { ${pm(req, 'left')} }\n@page ch${i}:right { ${pm(req, 'right')} }` : '';
    const er = req || mAll;
    if (er && imm) {
      // a imagem de imersão continua indo até o corte com as margens maiores dessas páginas
      const top = Math.max(num(s.marginTop, 20), er.top), bl = ctx.bleed;
      const L = { l: Math.max(num(s.marginOuter, 16), er.left), r: Math.max(num(s.marginInner, 22), er.right) };
      const Rr = { l: Math.max(num(s.marginInner, 22), er.left), r: Math.max(num(s.marginOuter, 16), er.right) };
      const H = num(s.pageHeight, 210) * Math.min(60, Math.max(15, num((project.immersion || {}).height, 36))) / 100;
      r += `\n.chapter[data-chapter="${i}"] .immersion { height: ${Math.max(0, H - top - bl).toFixed(2)}mm; }`;
      r += `\n.chapter[data-chapter="${i}"] .immersion .im-img { top: -${mm(top + bl)}; }`;
      r += `\n.pagedjs_left_page .chapter[data-chapter="${i}"] .immersion .im-img { left: -${mm(L.l + bl)}; right: -${mm(L.r)}; }`;
      r += `\n.pagedjs_right_page .chapter[data-chapter="${i}"] .immersion .im-img { left: -${mm(Rr.l)}; right: -${mm(Rr.r + bl)}; }`;
    }
    return r;
  }).filter(Boolean).join('\n');
  const chapterPages = chapters.map((c, i) => {
    const st = c.style || {};
    return marginRules(`ch${i}`, st.pageColor ? `background: ${color(st.pageColor, '#fff')};` : '', st.textColor ? color(st.textColor, '#000') : '');
  }).join('\n');

  const chapterOverrides = chapters.map((c, i) => {
    const st = c.style || {};
    const out = [];
    const b = [];
    if (st.font) b.push(`font-family: ${fontStack(st.font)}`);
    if (st.fontSize) b.push(`font-size: ${num(st.fontSize, 11)}pt`);
    if (b.length) out.push(`.chapter[data-chapter="${i}"] .chapter-body { ${b.join('; ')}; }`);
    if (st.textColor) out.push(`.chapter[data-chapter="${i}"], .chapter[data-chapter="${i}"] .chapter-body *, .chapter[data-chapter="${i}"] .chapter-head * { color: ${color(st.textColor, '#000')} !important; }`);
    const t = [];
    if (st.titleFont) t.push(`font-family: ${fontStack(st.titleFont)}`);
    if (st.titleSize) t.push(`font-size: ${num(st.titleSize, 22)}pt`);
    if (st.titleColor) t.push(`color: ${color(st.titleColor, '#000')}`);
    if (t.length) out.push(`.chapter[data-chapter="${i}"] .chapter-title { ${t.join('; ')}; }`);
    if (st.titleColor) out.push(`.chapter[data-chapter="${i}"] .chapter-label { color: ${color(st.titleColor, '#000')}; }`);
    return out.join('\n');
  }).join('\n');

  const marks = s.cropMarks ? 'marks: crop cross;' : '';
  const wo = Math.max(1, num(s.widowsOrphans, 2));
  const dropLines = Math.max(2, Math.min(5, num(s.dropCapLines, 2)));
  const lh = num(body.lineHeight, 1.4);
  const pageColor = color(s.pageColor, '#ffffff');
  const none6 = '@top-left { content: none; } @top-center { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-center { content: none; } @bottom-right { content: none; }';

  return `
@page {
  size: ${mm(s.pageWidth)} ${mm(s.pageHeight)};
  margin-top: ${mm(s.marginTop)};
  margin-bottom: ${mm(s.marginBottom)};
  ${bleed > 0 ? `bleed: ${mm(bleed)};` : ''}
  ${marks}
  background: ${pageColor};
}
@page :left { ${mAll ? pm(mAll, 'left') : `margin-left: ${mm(s.marginOuter)}; margin-right: ${mm(s.marginInner)};`} }
@page :right { ${mAll ? pm(mAll, 'right') : `margin-left: ${mm(s.marginInner)}; margin-right: ${mm(s.marginOuter)};`} }
@page :blank { ${none6} }
@page front { ${none6} }
@page fullbleed { margin: 0; ${none6} }
@page back { ${none6} }
${marginRules('frontnum', '', '', true)}
${marginRules('backnum', '', '')}
${chapterPages}
${frameMarginRules}
${pageNames}

.book {
  ${styleDecl(body, body, { noSpace: true })}
  text-align: start;
  font-variant-ligatures: common-ligatures;
  font-kerning: normal;
  font-synthesis: none;
}

/* ---------- pré-textuais ---------- */
.front { page: front; break-before: page; }
.half-title .ht-title { margin-top: ${(contentH * 0.28).toFixed(1)}mm; text-align: center; font-family: ${fontStack(S.chapterTitle.font || body.font)}; font-size: 1.5em; letter-spacing: 0.04em; }
.title-page { text-align: center; font-family: ${fontStack(S.chapterTitle.font || body.font)}; height: ${(contentH - 2).toFixed(1)}mm; display: flex; flex-direction: column; }
.title-page .tp-author { margin-top: ${(contentH * 0.06).toFixed(1)}mm; font-size: 1.15em; letter-spacing: 0.12em; text-transform: uppercase; }
.title-page .tp-title { margin-top: ${(contentH * 0.2).toFixed(1)}mm; font-size: 2.2em; line-height: 1.15; color: ${color(S.chapterTitle.color, '#000')}; }
.title-page .tp-subtitle { margin-top: 4mm; font-size: 1.2em; font-style: italic; }
.title-page .tp-foot { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 2mm; }
.title-page .tp-logo { display: block; max-height: 30mm; object-fit: contain; }
.title-page .tp-publisher { font-size: 0.95em; letter-spacing: 0.08em; }
.title-page .tp-brand { margin-top: 12mm; display: flex; flex-direction: column; align-items: center; gap: 3mm; }
.title-page .tp-imprint { font-size: 0.8em; letter-spacing: 0.06em; line-height: 1.5; }
.title-page .tp-place { font-size: 0.85em; }
.copyright-page { font-size: 7.5pt; line-height: 1.4; text-align: left; height: ${(contentH - 2).toFixed(1)}mm; display: flex; flex-direction: column; justify-content: flex-end; gap: 3mm; hyphens: manual; }
.copyright-page .cat-role { font-weight: 700; }
.copyright-page.cat-pos-top { justify-content: flex-start; }
.cat-style-plain .cat-box { border: 0; padding: 0; }
.cat-style-double .cat-box { border: 2pt double currentColor; }
.cat-style-rounded .cat-box { border-radius: 2.5mm; }
.cat-style-cbl .cat-box { border-width: 0.75pt; }
.cat-style-compact { font-size: 6.8pt; line-height: 1.3; }
.cat-style-compact .cat-box { padding: 1.5mm 2mm; }
.cat-box { border: 0.5pt solid currentColor; padding: 2.5mm 3mm; }
.cat-head { text-align: center; font-weight: 700; margin-bottom: 1.5mm; }
.cat-manual { white-space: pre-wrap; tab-size: 4; hyphens: manual; overflow-wrap: break-word; }
.cat-cutter { float: left; width: 12mm; }
.cat-indent { padding-left: 4mm; }
.cat-class { text-align: right; margin-top: 1.5mm; }
.cat-class-split { display: flex; justify-content: space-between; gap: 4mm; }
.cat-indices { margin-top: 1.5mm; }
.cat-indices-head { font-weight: 700; }
.cat-lib { margin-top: 1.5mm; font-size: 0.9em; }
.cat-dist { margin-top: 3mm; font-size: 0.9em; line-height: 1.35; text-align: left; hyphens: manual; }
.cat-dist-head { font-weight: bold; }
.cat-medias { display: flex; flex-wrap: wrap; gap: 4mm; align-items: flex-end; }
.cat-media { text-align: center; font-size: 0.9em; }
.cat-media img { display: block; margin: 0 auto 1mm; }
.dedication .ded-text, .epigraph .epi-text { margin-top: ${(contentH * 0.3).toFixed(1)}mm; ${styleDecl(S.epigraph, body)} }
.epigraph .epi-author { text-align: right; margin-top: 3mm; font-size: 0.9em; }
.epigraph .epi-author::before { content: "— "; }

.toc-heading { ${styleDecl(S.chapterTitle, body, { noSpace: true })} font-size: ${(num(S.chapterTitle.size, 22) * 0.8).toFixed(1)}pt; margin: ${mm(Math.max(0, num(S.chapterTitle.spaceBefore, 30) - 5))} 0 10mm; }
.toc-list { list-style: none; margin: 0; padding: 0; ${styleDecl(S.toc, body, { noSpace: true })} }
.toc-list li { margin: 0 0 0.35em 0; break-inside: avoid; }
.toc-list a { display: flex; align-items: baseline; color: inherit; text-decoration: none; }
.toc-label { flex: none; margin-right: 0.6em; font-variant: small-caps; letter-spacing: 0.03em; }
.toc-title { flex: 0 1 auto; max-width: 78%; }
.toc-dots { flex: 1 1 auto; border-bottom: 0.6pt dotted currentColor; margin: 0 0.4em; min-width: 1em; transform: translateY(-0.3em); opacity: 0.7; }
.toc-page { flex: none; min-width: 1.2em; text-align: right; }

/* ---------- imagem de página inteira (sangrada) ---------- */
.fullbleed { page: fullbleed; break-before: page; break-after: page; height: ${num(s.pageHeight, 210) - 0.5}mm; position: relative; }
.fullbleed.fb-spread { break-before: left; }
.fb-box { position: absolute; z-index: 2; max-width: 62%; padding: 4mm 5mm; font-size: 0.86em; line-height: 1.4; text-align: left; }
.fb-box p { margin: 0 0 1.5mm; text-indent: 0; } .fb-box p:last-child { margin-bottom: 0; }
.fb-box-title { font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.82em; margin-bottom: 1.5mm; }
.fb-look-dark { background: rgba(0, 0, 0, 0.72); color: #fff; } .fb-look-light { background: rgba(255, 255, 255, 0.9); color: #111; } .fb-look-line { background: transparent; color: #fff; border-left: 0.8mm solid #fff; text-shadow: 0 0 3mm rgba(0,0,0,.6); }
.fb-pos-tl { top: ${mm(num(s.marginTop, 20))}; left: ${mm(num(s.marginOuter, 16))}; } .fb-pos-tr { top: ${mm(num(s.marginTop, 20))}; right: ${mm(num(s.marginOuter, 16))}; }
.fb-pos-bl { bottom: ${mm(num(s.marginBottom, 22))}; left: ${mm(num(s.marginOuter, 16))}; } .fb-pos-br { bottom: ${mm(num(s.marginBottom, 22))}; right: ${mm(num(s.marginOuter, 16))}; }
.fb-pos-band { left: 0; right: 0; bottom: ${mm(num(s.marginBottom, 22) * 0.6)}; max-width: none; padding: 5mm ${mm(num(s.marginOuter, 16))}; }
/* blocos de imagem (à espera da imagem) */
.chapter-body figure.ph { margin: 3mm 0; break-inside: avoid; }
.chapter-body figure.ph .ph-box { position: relative; background: #d9d9de; display: flex; align-items: center; justify-content: center; }
.chapter-body figure.ph-h { column-span: all; width: 100%; } .chapter-body figure.ph-h .ph-box { aspect-ratio: 16 / 9; }
.chapter-body figure.ph-v .ph-box { aspect-ratio: 3 / 4; }
.chapter:not([data-cols="2"]):not([data-cols="3"]) .chapter-body figure.ph-v { float: right; width: 42%; margin: 0.3em 0 3mm 5mm; }
.ph-label { font: 600 8pt/1 system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #8d8d96; }
.chapter-body figure.ph figcaption { font-style: italic; color: #555; }
.ph-tools { position: absolute; inset: auto 2mm 2mm auto; display: flex; gap: 1.5mm; }
.ph-tools button { font: 600 8pt system-ui, sans-serif; border: 0; border-radius: 99px; padding: 1.2mm 2.6mm; background: #fff; color: #333; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
.ph-box .ph-plus { position: absolute; left: 50%; top: 50%; transform: translate(-50%, 30%); width: 11mm; height: 11mm; border-radius: 50%; font-size: 18pt; line-height: 1; background: linear-gradient(135deg, #6d28d9, #c026d3); color: #fff; padding: 0; }
/* caixas de texto à parte: a caixa só delimita o espaço; o texto segue o recuo da mancha */
.chapter-body .tframe { margin: 1mm 0 3mm; break-inside: avoid; }
.chapter-body .tframe > p { text-indent: 0; margin: 0; }
.chapter-body .tframe.tf-right { float: right; margin-left: 6mm; clear: right; }
.chapter-body .tframe.tf-left { float: left; margin-right: 6mm; clear: left; }
.chapter-body .tframe.tf-band { column-span: all; margin: 4mm auto; }
.chapter-body .tframe.tf-center { margin-left: auto; margin-right: auto; }
.chapter-body .tframe.tf-pull > p { font-family: ${fontStack(S.chapterTitle.font || body.font)}; font-size: 1.75em; line-height: 1.12; text-align: left; hyphens: none; color: #3a3a40; }
.chapter-body .tframe.tf-pull b, .chapter-body .tframe.tf-pull strong { color: #000; }
.chapter-body .tframe.tf-quote > p { font-style: italic; font-size: 1.22em; line-height: 1.3; text-align: left; hyphens: none; }
.chapter-body .tframe.tf-quote > p:first-child::before { content: "“"; font-size: 2.2em; line-height: 0; vertical-align: -0.45em; margin-right: 0.08em; }
/* contorno mantido: igual ao da tela, também na impressão; removido: só uma guia clarinha na tela */
.chapter-body .tframe.tf-keep { outline: 0.35mm dashed rgba(124, 58, 237, 0.45); outline-offset: 1.2mm; }
.chapter-body .tframe[data-guide]:not(.tf-keep) { outline: 0.25mm dotted rgba(124, 58, 237, 0.28); outline-offset: 1.2mm; }
/* estilos de título: caixa preta, caixa branca ou só contorno (à esquerda, ao centro ou à direita) */
.chapter[class*=" tb-"] .chapter-title { display: inline-block; padding: 1.8mm 4.5mm 2.1mm; line-height: 1.12; }
.chapter.tb-black .chapter-title { background: #000; color: #fff !important; }
.chapter.tb-white .chapter-title { background: #fff; color: #000 !important; border: 0.25pt solid #000; box-shadow: 0 0 0 1.2mm #fff; }
.chapter.tb-outline .chapter-title { border: 0.6pt solid currentColor; }
.chapter.tb-black .chapter-sep, .chapter.tb-white .chapter-sep, .chapter.tb-outline .chapter-sep { display: none; }
.chapter.tb-al-left .chapter-head { text-align: left; } .chapter.tb-al-center .chapter-head { text-align: center; } .chapter.tb-al-right .chapter-head { text-align: right; }
.fullbleed .fb-img { position: absolute; left: -${mm(bleed)}; top: -${mm(bleed)}; width: calc(100% + ${(2 * bleed).toFixed(2)}mm); height: calc(100% + ${(2 * bleed + 0.5).toFixed(2)}mm); background-position: center; background-repeat: no-repeat; }

/* ---------- capítulos ---------- */
.chapter { break-before: page; }
.chapter.after-opening, .chapter.chapter-cont { break-before: page; }
.chapter-head { text-align: ${S.chapterTitle.align}; margin: ${mm(S.chapterTitle.spaceBefore)} 0 ${mm(S.chapterTitle.spaceAfter)} 0; break-after: avoid; }
/* imersão: a imagem ocupa o alto da página de abertura, além das margens e do corte (sangria) */
/* no fluxo fica só a parte dentro da mancha (sem margens negativas, que confundem a paginação);
   a imagem sai da mancha até o corte por posição absoluta */
.immersion { position: relative; height: ${Math.max(0, num(s.pageHeight, 210) * Math.min(60, Math.max(15, num((project.immersion || {}).height, 36))) / 100 - num(s.marginTop, 20) - ctx.bleed).toFixed(2)}mm; margin: 0 0 6mm; break-after: avoid; break-inside: avoid; }
.immersion .im-img { position: absolute; top: -${mm(num(s.marginTop, 20) + ctx.bleed)}; bottom: 0; left: -${mm(num(s.marginInner, 22))}; right: -${mm(num(s.marginOuter, 16) + ctx.bleed)}; background-size: cover; background-position: center; }
.pagedjs_left_page .immersion .im-img { left: -${mm(num(s.marginOuter, 16) + ctx.bleed)}; right: -${mm(num(s.marginInner, 22))}; }
.pagedjs_right_page .immersion .im-img { left: -${mm(num(s.marginInner, 22))}; right: -${mm(num(s.marginOuter, 16) + ctx.bleed)}; }
.immersion.fade .im-img { -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent); mask-image: linear-gradient(to bottom, #000 70%, transparent); }
.chapter.has-immersion .chapter-head { margin-top: 2mm; }
.chapter-label { ${styleDecl(S.chapterLabel, body, { noIndent: true })} margin-top: 0; }
.chapter-title { ${styleDecl(S.chapterTitle, body, { noSpace: true })} line-height: 1.15; margin: 0; hyphens: manual; string-set: chaptitle content(text); }
.chapter-sep { margin-top: 4mm; text-align: ${S.chapterTitle.align}; line-height: 0; }
.chapter-sep img { display: block; max-height: 18mm; object-fit: contain; margin: 0 ${S.chapterTitle.align === 'right' ? '0' : 'auto'} 0 ${S.chapterTitle.align === 'left' ? '0' : 'auto'}; }
.chapter-sep .sep-line { display: block; border: 0; border-top: 0.6pt solid ${color(s.separatorColor, '#000')}; height: 0; margin: 0 ${S.chapterTitle.align === 'right' ? '0' : 'auto'} 0 ${S.chapterTitle.align === 'left' ? '0' : 'auto'}; }
.back-matter { page: back; break-before: page; }
.back-title { ${styleDecl(S.chapterTitle, body, { noSpace: true })} margin: ${mm(Math.max(10, num(S.chapterTitle.spaceBefore, 30) * 0.6))} 0 8mm; }
.bio-photo { float: left; margin: 1mm 5mm 3mm 0; border-radius: 1mm; object-fit: cover; }

.chapter-body p {
  text-align: ${body.align || 'justify'};
  margin: 0 0 ${mm(body.spaceAfter)} 0;
  text-indent: ${num(body.indent, 1.5)}em;
  hyphens: manual;
  widows: ${wo};
  orphans: ${wo};
}
${s.indentFirstParagraph ? '' : `
.chapter-body > p:first-child,
.chapter-body > h2 + p, .chapter-body > h3 + p, .chapter-body > h4 + p,
.chapter-body > hr + p, .chapter-body > .page-break + p, .chapter-body > div + p,
.chapter-body > blockquote + p, .chapter-body > figure + p, .chapter-body > table + p,
.chapter-body > ul + p, .chapter-body > ol + p { text-indent: 0; }`}
.chapter-body p.no-indent { text-indent: 0; }
.chapter-body p[data-split-from] { text-indent: 0; }
${body.align === 'justify' ? '.chapter-body p[data-split-to] { text-align-last: justify; }' : ''}
.chapter-body p[style*="center"], .chapter-body p[style*="right"] { text-indent: 0; }
${s.dropCap ? `
.chapter:not(.chapter-cont) .chapter-body > p:first-child:not([data-split-from])::first-letter {
  float: left;
  font-family: ${fontStack(S.chapterTitle.font || body.font)};
  font-size: ${(lh * dropLines + 0.4 - (dropLines - 2) * 0.1).toFixed(2)}em;
  line-height: 0.8;
  padding: 0.04em 0.08em 0 0;
  color: ${color(S.chapterTitle.color, '#000')};
}` : ''}
${s.smallCapsFirstLine ? `.chapter:not(.chapter-cont) .chapter-body > p:first-child:not([data-split-from])::first-line { font-variant: small-caps; letter-spacing: 0.04em; }` : ''}
.chapter-body h2 { ${styleDecl(S.h2, body)} line-height: 1.2; hyphens: manual; text-indent: 0; }
.chapter-body h3 { ${styleDecl(S.h3, body)} line-height: 1.2; hyphens: manual; text-indent: 0; }
.chapter-body h4 { ${styleDecl(S.h4, body)} line-height: 1.2; hyphens: manual; text-indent: 0; }
${s.keepHeadingsWithNext ? '.chapter-body h2, .chapter-body h3, .chapter-body h4 { break-after: avoid; break-inside: avoid; }' : ''}
.chapter-body blockquote { ${styleDecl(S.quote, body)} }
.chapter-body blockquote p { text-indent: 0; margin: 0 0 0.3em; }
.chapter-body p.phrase { ${styleDecl(S.phrase, body)} text-indent: 0; break-inside: avoid; }
.chapter-body div.poem { ${styleDecl(S.poem, body)} }
.chapter-body div.poem p { text-indent: 0; margin: 0 0 1em; text-align: inherit; hyphens: none; break-inside: avoid; }
.chapter-body p.epigraph-inline { ${styleDecl(S.epigraph, body)} text-indent: 0; }
.chapter-body p.reference { ${styleDecl(S.reference, body, { noSpace: true })} margin: 0 0 ${mm(S.reference.spaceAfter)} 0; padding-left: ${Math.abs(num(S.reference.indent, -1.5))}em; text-indent: ${num(S.reference.indent, -1.5)}em; }
.chapter-body div.box { ${styleDecl(S.box, body, { noSpace: true })} margin: ${mm(S.box.spaceBefore)} 0 ${mm(S.box.spaceAfter)}; border: 0.6pt solid ${color(S.box.borderColor, '#999')}; padding: 3mm 4mm; break-inside: avoid; }
.chapter-body div.box.box-long { break-inside: auto; }
.chapter-body div.box p { text-indent: 0; margin: 0 0 0.4em; }
/* estilos de caixa de texto e de citação (escolhidos ao selecionar o texto) */
.book .chapter-body div.box[data-style="fundo"] { border: 0; background: #ededeb; padding: 3.5mm 4.5mm; }
.book .chapter-body div.box[data-style="lateral"] { border: 0; border-left: 2.2pt solid ${color(S.box.borderColor, '#999')}; padding: 0.5mm 0 0.5mm 4mm; }
.book .chapter-body div.box[data-style="filete"] { border: 0; border-top: 1pt solid currentColor; border-bottom: 1pt solid currentColor; padding: 3mm 0; }
.book .chapter-body div.box[data-style="escuro"] { border: 0; background: #1d1d1f; color: #fff; padding: 4mm 5mm; }
.book .chapter-body blockquote[data-style] { font-size: 1em; }
.book .chapter-body blockquote[data-style="aspas"] { position: relative; margin: 1.2em 6mm; padding-left: 9mm; font-style: italic; }
.book .chapter-body blockquote[data-style="aspas"]::before { content: "\u201C"; position: absolute; left: 0; top: -0.12em; font-size: 3.4em; line-height: 1; opacity: .3; font-style: normal; }
.book .chapter-body blockquote[data-style="lateral"] { margin: 1em 0; padding-left: 4.5mm; border-left: 1.6pt solid currentColor; }
.book .chapter-body blockquote[data-style="destaque"] { margin: 1.4em 8mm; padding: 3mm 4mm; border-top: 0.6pt solid currentColor; border-bottom: 0.6pt solid currentColor; text-align: center; font-size: 1.22em; font-style: italic; line-height: 1.3; break-inside: avoid; }
.book .chapter-body blockquote[data-style="destaque"] p { text-align: center; }
.chapter-body ul, .chapter-body ol { margin: 0.5em 0 0.5em 1.6em; padding: 0; }
/* listas, tabelas e citações começam abaixo da letra capitular (não ficam ao lado dela) */
.chapter-body > ul, .chapter-body > ol, .chapter-body > table, .chapter-body > blockquote, .chapter-body > div.box, .chapter-body > div.poem { clear: left; }
.chapter-body li { margin-bottom: 0.2em; }
.chapter-body li p { text-indent: 0; }
.chapter-body hr.scene-break { border: 0; height: auto; margin: 0.9em 0; text-align: center; break-after: avoid; }
.chapter-body hr.scene-break::after { content: ${cssString(s.sceneBreak || '* * *')}; letter-spacing: 0.3em; white-space: pre; }
.chapter-body hr:not(.scene-break) { border: 0; border-top: 0.5pt solid currentColor; width: 30%; margin: 1em auto; }
.chapter-body .page-break { break-after: page; height: 0; }
.chapter-body table { width: 100%; border-collapse: collapse; margin: 1em 0; ${styleDecl(Object.assign({}, S.table, { background: undefined }), body, { noSpace: true })} }
.chapter-body table caption { caption-side: top; ${styleDecl(S.caption, body)} padding-bottom: 1.5mm; }
.chapter-body .cap-num { font-weight: 700; font-style: normal; hyphens: none; white-space: nowrap; }
/* o título da tabela nunca fica sozinho no pé da página; tabelas curtas não se dividem */
.chapter-body table caption { break-after: avoid; page-break-after: avoid; }
.chapter-body table.tb-short { break-inside: avoid; page-break-inside: avoid; }
.chapter-body p.caption-text, .chapter-body p.table-source { break-before: avoid; }
.chapter-body table.tb-zebra tr:nth-child(even) td { background: rgba(0,0,0,0.06); }
.chapter-body table.tb-compact td, .chapter-body table.tb-compact th { padding: 0.6mm 1.2mm; }
.chapter-body td.num { text-align: right; font-variant-numeric: tabular-nums; }
.chapter-body p.caption-text { ${styleDecl(S.caption, body)} text-indent: 0; margin: 1.5mm 0 3mm; }
${captionStyleCss()}
.chapter-body p.table-source { text-indent: 0; font-size: 0.82em; margin-top: -0.6em; margin-bottom: 1em; text-align: left; }
.chapter-body figure + p.table-source { margin-top: 0; }
.chapter-body th, .chapter-body td { border: 0.5pt solid ${color(S.table.borderColor, '#555')}; padding: 1.2mm 2mm; text-align: left; vertical-align: top; text-indent: 0; hyphens: manual; }
.chapter-body th { background: ${color(S.table.background, '#eee')}; font-weight: 700; }
.chapter-body tr { break-inside: avoid; }
.chapter-body td p, .chapter-body th p { text-indent: 0; margin: 0; }
.chapter-body .smallcaps { font-variant: small-caps; letter-spacing: 0.03em; }
.chapter-body sup, .chapter-body sub { line-height: 0; }

/* ---------- figuras: nunca ultrapassam a mancha nem se dividem ---------- */
.fig { break-inside: avoid; max-width: 100%; text-indent: 0; }
.fig-none, .fig-behind { display: block; clear: both; }
.fig-frame { position: relative; width: 100%; overflow: hidden; }
.fig-frame img { display: block; }
.fig figcaption { ${styleDecl(S.caption, body)} margin-top: 1.5mm; text-indent: 0; }
.fig-missing-box { border: 1pt dashed #c00; color: #c00; padding: 6mm; text-align: center; font-family: sans-serif; font-size: 9pt; }

/* ---------- notas de rodapé ---------- */
.footnote {
  float: footnote;

  ${styleDecl(S.footnote, body, { noSpace: true })}
  text-indent: 0;
  font-style: normal;
  font-weight: 400;
  text-transform: none;
}
.footnote::footnote-call { vertical-align: super; font-size: 0.65em; line-height: 0; }
@page { @footnote { border-top: 0.5pt solid currentColor; margin-top: 3mm; padding-top: 1.5mm; } }
${s.footnoteNumbering === 'chapter' ? '.chapter:not(.chapter-cont) { counter-reset: footnote; }' : ''}

/* ---------- numeração romana nas pré-textuais; notas e índice com número de página ---------- */
.front.front-num { page: frontnum; }
.back-matter.back-num { page: backnum; }
.back-num .back-title { string-set: chaptitle content(text); }

/* ---------- modelos de sumário ---------- */
.tocstyle-plain .toc-dots, .tocstyle-inline .toc-dots, .tocstyle-numleft .toc-dots { border-bottom: 0; }
.tocstyle-inline .toc-title { max-width: none; }
.tocstyle-inline .toc-dots { flex: 0 0 0.9em; }
.tocstyle-inline .toc-page { text-align: left; }
.tocstyle-numleft .toc-page { order: -2; min-width: 2.4em; text-align: left; font-weight: 700; font-variant-numeric: tabular-nums; }
.tocstyle-numleft .toc-label { order: -1; }
.tocstyle-numleft .toc-title { max-width: none; }
.tocstyle-twocol .toc-list { column-count: 2; column-gap: 7mm; font-size: 0.92em; }
.tocstyle-twocol .toc-title { max-width: 70%; }
.tocstyle-summary .toc-list li.toc-l1 { margin-bottom: 0.9em; }
.tocstyle-summary .toc-sum { font-size: 0.86em; font-style: italic; line-height: 1.3; margin: 0.15em 2.5em 0 0; text-align: left; hyphens: manual; }
${TocThemes.css(project.front.tocTheme, { mt: num(s.marginTop, 20), mb: num(s.marginBottom, 22), mi: num(s.marginInner, 22), mo: num(s.marginOuter, 16), bleed: ctx.bleed, contentH: ctx.contentH, colW: ctx.colW, color: project.front.tocColor })}

/* ---------- notas de fim e notas laterais ---------- */
.en-call { vertical-align: super; font-size: 0.65em; line-height: 0; }
.en-call a { color: inherit; text-decoration: none; }
.endnotes { margin-top: 2em; padding-top: 0.6em; border-top: 0.5pt solid currentColor; ${styleDecl(S.footnote, body, { noSpace: true })} text-indent: 0; }
.en-title, .en-chapter { font-weight: 700; font-variant: small-caps; letter-spacing: 0.04em; margin: 0 0 0.5em; break-after: avoid; }
.en-chapter { margin-top: 1.2em; }
.en-list { list-style: none; margin: 0; padding: 0; }
.en-list li { margin: 0 0 0.35em; padding-left: 1.6em; text-indent: -1.6em; text-align: ${body.align || 'justify'}; hyphens: manual; }
.en-num { display: inline-block; min-width: 1.6em; text-indent: 0; }
.endnotes-book .en-list, .endnotes-book .en-group { ${styleDecl(S.footnote, body, { noSpace: true })} }
.sidenote { display: none; }
.sn-box { ${styleDecl(S.footnote, body, { noSpace: true })} line-height: 1.25; text-indent: 0; hyphens: manual; z-index: 5; }
.sn-box.sn-left { text-align: right; }
.sn-box.sn-right { text-align: left; }
.sn-box .sn-num { font-weight: 700; margin-right: 0.15em; }
.sn-call { vertical-align: super; font-size: 0.65em; line-height: 0; }

/* ---------- índice remissivo ---------- */
.ix-list { column-gap: 6mm; font-size: 0.9em; line-height: 1.3; }
.ix-letter { font-weight: 700; margin: 0.8em 0 0.3em; break-after: avoid; font-variant: small-caps; letter-spacing: 0.06em; }
.ix-head { break-inside: avoid; page-break-inside: avoid; }
.ix-head:first-child .ix-letter { margin-top: 0; }
.back-matter p.ix-entry { margin: 0; padding-left: 1.2em; text-indent: -1.2em; text-align: left; orphans: 2; widows: 2; }
.back-matter p.ix-sub { padding-left: 2.4em; }

/* ---------- normas ABNT (NBR 6023 referências; NBR 10520 citação longa) ---------- */
.book.ref-abnt .chapter-body p.reference { text-align: left; padding-left: 0; text-indent: 0; margin: 0 0 ${lh.toFixed(2)}em; hyphens: none; }
.book.quote-abnt .chapter-body blockquote { margin: ${lh.toFixed(2)}em 0 ${lh.toFixed(2)}em ${Math.min(40, ctx.colW * 0.3).toFixed(1)}mm; font-size: 0.86em; line-height: 1.2; text-align: justify; font-style: normal; }
.book.quote-abnt .chapter-body blockquote p { text-indent: 0; margin: 0; }

/* ---------- ajuste da última página do capítulo (entreletra e espaço entre palavras mínimos) ---------- */
.chapter[data-adjust="shrink"] .chapter-body { letter-spacing: -0.008em; word-spacing: -0.02em; }
.chapter[data-adjust="expand"] .chapter-body { letter-spacing: 0.008em; word-spacing: 0.02em; }
${s.baselineGrid ? `/* grade: listas, citações, caixas e poemas com a mesma entrelinha do texto (continuam na grade ao dividir) */
.chapter-body li { margin-bottom: 0; }
.chapter-body blockquote, .chapter-body blockquote p, .chapter-body div.box, .chapter-body div.box p, .chapter-body div.poem p, .chapter-body li { line-height: ${(num(body.size, 11) * lh).toFixed(4)}pt; }
.chapter-body div.poem p { margin-bottom: ${(num(body.size, 11) * lh).toFixed(4)}pt; }` : ''}

/* ---------- sumário em níveis e links ---------- */
.toc-list li.toc-l2 { padding-left: 1.4em; font-size: 0.95em; }
.toc-list li.toc-l3 { padding-left: 2.8em; font-size: 0.9em; }
.toc-list li.toc-l1 + li.toc-l2 { margin-top: 0.1em; }
.chapter-body a, .back-matter a { color: inherit; text-decoration: none; }
.chapter-body a[href^="http"] { text-decoration: underline; text-decoration-thickness: 0.4pt; }

/* ---------- segurança: nada passa da mancha ---------- */
.chapter-body, .back-matter .chapter-body { overflow-wrap: break-word; }
.chapter-body a[href^="http"], .chapter-body a[href^="mailto"] { overflow-wrap: anywhere; }
.chapter-body table { max-width: 100%; table-layout: fixed; }
/* tabela colada com a formatação original: as cores, bordas e alinhamentos vêm de cada célula */
.chapter-body table.tb-orig { margin-left: auto; margin-right: auto; table-layout: auto; }
.chapter-body table.tb-orig td, .chapter-body table.tb-orig th { padding: 0.3em 0.45em; overflow-wrap: break-word; hyphens: none; }
.chapter-body img { max-width: 100%; }

/* ---------- cores de páginas isoladas ---------- */
${Object.entries(project.pageStyles || {}).map(([n, ps]) => {
    const sel = `.pagedjs_page[data-page-number="${Number(n)}"]`;
    const r = [];
    if (ps && ps.bg) r.push(`${sel} .pagedjs_sheet, ${sel} .pagedjs_pagebox { background: ${color(ps.bg, '#fff')} !important; }`);
    if (ps && ps.color) r.push(`${sel} .pagedjs_pagebox *, ${sel} .pagedjs_margin-content::after { color: ${color(ps.color, '#000')} !important; }`);
    return r.join('\n');
  }).join('\n')}

/* ---------- revista e jornal: colunas fixas ---------- */
.chapter[data-cols="2"] .chapter-body, .chapter[data-cols="3"] .chapter-body, .chapter[data-cols="4"] .chapter-body {
  column-gap: ${mm(s.columnGap || 5)};
  ${s.columnRule ? `column-rule: 0.4pt solid ${color(S.table.borderColor, '#888')};` : ''}
  column-fill: balance;
}
.chapter[data-cols="2"] .chapter-body { column-count: 2; }
.chapter[data-cols="3"] .chapter-body { column-count: 3; }
.chapter[data-cols="4"] .chapter-body { column-count: 4; }
.chapter[data-cols] .fig-full, .chapter[data-cols] .chapter-body > h2, .chapter[data-cols] .chapter-body > table { column-span: all; }
.chapter[data-cols] .fig-full { margin-left: 0; margin-right: 0; }
.kind-magazine .chapter, .kind-newspaper .chapter { break-before: page; }
.kind-magazine .article.flow, .kind-newspaper .article.flow { break-before: auto; margin-top: 7mm; padding-top: 4mm; border-top: 1.2pt solid currentColor; }
.kind-magazine .chapter-head, .kind-newspaper .chapter-head { margin: 0 0 5mm; text-align: left; }
.kind-newspaper .chapter-title { font-weight: 700; }
.kicker { font-family: ${fontStack(S.chapterLabel.font || body.font)}; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.12em; color: ${color(S.chapterLabel.color, '#7a1f1f')}; margin-bottom: 2mm; }
.lead { font-family: ${fontStack(S.chapterTitle.font || body.font)}; font-size: 1.2em; font-style: italic; line-height: 1.3; margin-top: 3mm; }
.byline { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3mm; }
.masthead { text-align: center; margin: 0 0 7mm; border-bottom: 2.2pt solid currentColor; padding-bottom: 2mm; break-after: avoid; }
.masthead .mh-logo { max-height: 22mm; display: block; margin: 0 auto 2mm; }
.masthead .mh-name { font-family: ${fontStack(S.chapterTitle.font || body.font)}; font-size: ${project.kind === 'newspaper' ? 54 : 40}pt; line-height: 1; font-weight: 700; letter-spacing: 0.02em; }
.masthead .mh-tagline { font-style: italic; font-size: 10pt; margin-top: 1.5mm; }
.masthead .mh-line { display: flex; justify-content: space-between; border-top: 0.6pt solid currentColor; margin-top: 2mm; padding-top: 1mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; }
.masthead + .chapter { break-before: avoid; }

${chapterOverrides}
${frameCss(project, ctx)}
/* estilos de caractere (trechos marcados): mudar o estilo muda todos os trechos */
${charStylesCss(s.charStyles)}
.book .chapter-body blockquote.fn-host, .book .chapter-body div.box.fn-host, .book .chapter-body p.fn-host.fn-host { break-inside: auto; }
`;
}

// ---------------------------------------------------------------- entrada
async function buildBook(rawProject, opts) {
  const project = normalizeProject(rawProject);
  const s = project.settings;
  const contentH = num(s.pageHeight, 210) - num(s.marginTop, 20) - num(s.marginBottom, 22);
  const colW = num(s.pageWidth, 140) - num(s.marginInner, 22) - num(s.marginOuter, 16);
  const bleed = effectiveBleed(s);
  const ctx = { assets: project.assets || {}, settings: s, contentH, colW, bleed, missing: [], figures: [], qrImages: [],
    numbering: s.captionNumbering !== false, counters: { fig: 0, graf: 0, tab: 0, quad: 0 }, lists: { fig: [], graf: [], tab: [], quad: [] },
    refs: {}, index: new Map(), indexCache: project.indexCache || {}, markBlocks: !!(opts && opts.markBlocks), frontNum: s.frontNumbering === 'roman' && project.kind !== 'magazine' && project.kind !== 'newspaper' };

  // QR codes da ficha catalográfica (gerados localmente)
  const qrs = (project.catalog.qrcodes || []).filter(q => q && q.text);
  if (qrs.length) {
    const QR = require('qrcode');
    for (const q of qrs) {
      try { ctx.qrImages.push({ dataUrl: await QR.toDataURL(q.text, { margin: 1, width: 600, errorCorrectionLevel: 'M' }), caption: q.caption, size: q.size }); } catch (e) { /* QR inválido */ }
    }
  }

  const html = buildHtml(project, ctx);
  const css = buildCss(project, ctx);

  const fams = new Set();
  Object.values(s.styles).forEach(st => { if (st && st.font) fams.add(st.font); });
  (s.charStyles || []).forEach(cs => { if (cs && cs.font) fams.add(cs.font); });
  project.chapters.forEach(c => { if (c.style.font) fams.add(c.style.font); if (c.style.titleFont) fams.add(c.style.titleFont); });
  (project.overlays || []).forEach(o => { if (o.font) fams.add(o.font); });
  if (project.front.toc) { const tt = TocThemes.byKey(project.front.tocTheme); if (tt.font) fams.add(tt.font); }

  const overlays = (project.overlays || []).map(o => Object.assign({}, o, o.asset && ctx.assets[o.asset] ? { src: ctx.assets[o.asset].dataUrl } : {}));

  return {
    html,
    css,
    title: project.meta.title,
    fonts: [...fams],
    bundledFonts: [...fams].filter(f => BUNDLED_FONTS.includes(f)),
    overlays,
    missingAssets: [...new Set(ctx.missing)],
    tocItems: ctx.tocItems || [],
    segments: ctx.segments || [{ key: 'all', html }],
    chapterIds: project.chapters.map(c => c.id),
    // acabamento tipográfico feito na prévia/exportação (grade, justificação, notas laterais, índice…)
    typo: {
      grid: !!s.baselineGrid && project.kind !== 'magazine' && project.kind !== 'newspaper',
      justify: !!s.fineJustify,
      notesMode: project.kind === 'magazine' || project.kind === 'newspaper' ? 'footnote' : (s.notesMode || 'footnote'),
      frontRoman: !!ctx.frontNum,
      folio: s.standard === 'cedet' && s.pageNumbers !== 'center' && s.pageNumbers !== 'none' ? 'outer' : s.pageNumbers,
      lastPage: { enabled: !!s.lastPageAdjust, minLines: Math.max(1, num(s.lastPageMinLines, 3)) },
      colW: ctx.colW
    },
    figures: ctx.figures,
    frames: { all: project.kind === 'magazine' || project.kind === 'newspaper' ? '' : (frameOk((project.frames || {}).all, ctx) ? project.frames.all : '') },
    page: {
      width: num(s.pageWidth, 140), height: num(s.pageHeight, 210),
      marginTop: num(s.marginTop, 20), marginBottom: num(s.marginBottom, 22),
      marginInner: num(s.marginInner, 22), marginOuter: num(s.marginOuter, 16),
      bleed, safety: num(s.safety, 5)
    }
  };
}

module.exports = { buildBook, chapterLabel, roman, words, stripFootnotes, esc, effectiveBleed, anchorHeadings };
