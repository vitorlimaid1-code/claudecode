// Monta o HTML e o CSS paginável (Paged.js) a partir de um projeto de livro.
const { normalizeProject, BUNDLED_FONTS, autoBleed, CEDET } = require('./shared/defaults');
const CatalogParse = require('./shared/catalog-parse');

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
  if (floatSide) width = Math.min(width, 50);
  const figStyle = [`width: ${width.toFixed(2)}%`];
  if (floatSide) {
    figStyle.push(`float: ${floatSide}`);
    figStyle.push(floatSide === 'left' ? `margin: 0.25em ${gap}mm ${(gap * 0.6).toFixed(2)}mm 0` : `margin: 0.25em 0 ${(gap * 0.6).toFixed(2)}mm ${gap}mm`);
  } else if (wrap === 'behind') {
    figStyle.push('height: 0', 'position: relative', 'overflow: visible', 'margin-top: 0', 'margin-bottom: 0');
  } else {
    figStyle.push(`margin-top: ${gap}mm`, `margin-bottom: ${gap}mm`);
  }
  if (!floatSide) {
    if (align === 'left') figStyle.push('margin-left: 0', 'margin-right: auto');
    else if (align === 'right') figStyle.push('margin-left: auto', 'margin-right: 0');
    else figStyle.push('margin-left: auto', 'margin-right: auto');
  }
  const simple = !ratio && rot === 0 && !flipx && !flipy && ct + cr + cb + cl === 0;
  if (wrap === 'contour' && simple && !caption) {
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
  return `<figure${figId ? ` id="${figId}"` : ''} class="fig fig-${wrap}${align === 'full' ? ' fig-full' : ''}${asset.chart ? ' fig-chart' : ''}" data-asset="${esc(id)}" data-print-width="${printW.toFixed(2)}" data-px-width="${Math.round(iw * cw)}" style="${figStyle.join('; ')}">${frame}${capHtml && wrap !== 'behind' ? `<figcaption${capStyle ? ` data-cap="${esc(capStyle)}"` : ''}>${capHtml}</figcaption>` : ''}</figure>`;
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
function markShortTables(html) {
  return String(html).replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (m, attrs, inner) => {
    if ((inner.match(/<tr\b/gi) || []).length > 15) return m;
    if (/\sclass="/.test(attrs)) return `<table${attrs.replace(/\sclass="/, ' class="tb-short ')}>${inner}</table>`;
    return `<table class="tb-short"${attrs}>${inner}</table>`;
  });
}

// Tabelas com título (legenda): Tabela N – título, com âncora para a lista de tabelas
function numberTables(html, ctx) {
  if (!ctx.numbering) return html;
  return String(html).replace(/<table\b([^>]*)>(\s*)<caption\b([^>]*)>([\s\S]*?)<\/caption>/gi, (m, attrs, sp, cattrs, cap) => {
    const text = cap.replace(/<[^>]+>/g, '').trim();
    if (!text) return m;
    const own = ownLabel(cap);
    if (own) {
      ctx.counters.tab = Math.max(ctx.counters.tab, own.n);
      const id = `tab-${ctx.counters.tab}-${ctx.lists.tab.length}`;
      ctx.lists.tab.push({ id, label: own.label, title: own.rest });
      return `<table${/\sid="/.test(attrs) ? attrs : ` id="${id}"${attrs}`}>${sp}<caption${cattrs}><span class="cap-num">${own.labelHtml}</span>${own.sepHtml}${own.restHtml}</caption>`;
    }
    const n = ++ctx.counters.tab;
    const id = `tab-${n}`;
    ctx.lists.tab.push({ id, label: `Tabela ${n}`, title: text });
    return `<table${/\sid="/.test(attrs) ? attrs : ` id="${id}"${attrs}`}>${sp}<caption${cattrs}><span class="cap-num">Tabela ${n}</span> – ${cap}</caption>`;
  });
}

// Listas de figuras, gráficos e tabelas (mesma aparência e numeração de páginas do sumário)
function listsHtml(project, ctx) {
  const f = project.front || {};
  const out = [];
  [['listFigures', 'fig', 'Lista de figuras', 'lista-figuras'], ['listCharts', 'graf', 'Lista de gráficos', 'lista-graficos'], ['listTables', 'tab', 'Lista de tabelas', 'lista-tabelas']].forEach(([key, kind, title, id]) => {
    const items = ctx.lists[kind];
    if (!f[key] || !items.length) return;
    const li = items.map(it => `<li class="toc-l1"><a href="#${esc(it.id)}"><span class="toc-label">${esc(it.label)}</span><span class="toc-title">${esc(it.title)}</span><span class="toc-dots"></span><span class="toc-page"></span></a></li>`).join('');
    out.push(`<section class="front toc list-of" id="${id}"><h2 class="toc-heading">${esc(f[key + 'Title'] || title)}</h2><ul class="toc-list">${li}</ul></section>`);
  });
  return out;
}

function fullBleedHtml(assetId, fit, ctx, extraClass) {
  const asset = ctx.assets[assetId];
  if (!asset) { ctx.missing.push(assetId); return ''; }
  return `<section class="fullbleed ${extraClass || ''}" data-asset="${esc(assetId)}"><div class="fb-img" style="background-image:url('${asset.dataUrl}'); background-size:${fit === 'contain' ? 'contain' : 'cover'};"></div></section>`;
}

function processBody(html, ctx) {
  html = html || '';
  html = html.replace(/\ssrc="blob:[^"]*"/g, '');
  // comentários de revisão nunca saem no livro
  html = html.replace(/<span class="comment"[^>]*>[\s\S]*?<\/span>/g, '');
  if (!ctx.settings.footnotesVisible) html = stripFootnotes(html);
  html = html.replace(/<figure\b([^>]*class="[^"]*\bimg\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/gi, (m, attrs, inner) => figureHtml(parseAttrs(attrs), inner, ctx));
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

function tocHtml(project, items) {
  const { front } = project;
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
    return `<li class="toc-l${c.level}">${c.id ? `<a href="#${esc(c.id)}">${inner}</a>` : `<a>${inner}</a>`}</li>`;
  }).join('');
  return `<section class="front toc" id="sumario"><h2 class="toc-heading">${esc(front.tocTitle || 'Sumário')}</h2><ul class="toc-list">${li}</ul></section>`;
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
  const tocItems = [];

  // Ordem padrão: página de rosto > ficha catalográfica > sumário > (dedicatória/epígrafe) > capítulos > páginas extras
  if (front.halfTitle) parts.push(`<section class="front half-title"><div class="ht-title">${esc(meta.title)}</div></section>`);
  if (front.titlePage) {
    const logo = titlePage.logo && ctx.assets[titlePage.logo];
    parts.push(`<section class="front title-page">
      <div class="tp-author">${esc(meta.author)}</div>
      <div class="tp-title">${esc(meta.title)}</div>
      ${meta.subtitle ? `<div class="tp-subtitle">${esc(meta.subtitle)}</div>` : ''}
      <div class="tp-foot">
        ${logo ? `<img class="tp-logo" src="${logo.dataUrl}" style="width:${num(titlePage.logoWidth, 25)}mm">` : ''}
        ${titlePage.showPublisher && meta.publisher ? `<div class="tp-publisher">${esc(meta.publisher)}</div>` : ''}
        ${titlePage.showYear && (meta.city || meta.year) ? `<div class="tp-place">${esc([meta.city, meta.year].filter(Boolean).join(' · '))}</div>` : ''}
      </div>
    </section>`);
  }
  if (front.copyright) parts.push(catalogHtml(project, ctx));
  const tocIndex = parts.length;
  if (front.dedication && meta.dedication && meta.dedication.trim()) {
    parts.push(`<section class="front dedication"><div class="ded-text">${multiline(meta.dedication)}</div></section>`);
  }
  if (front.epigraph && meta.epigraph && meta.epigraph.trim()) {
    parts.push(`<section class="front epigraph"><div class="epi-text">${multiline(meta.epigraph)}</div>${meta.epigraphAuthor ? `<div class="epi-author">${esc(meta.epigraphAuthor)}</div>` : ''}</section>`);
  }
  // revista/jornal: o nome da publicação entra no topo da primeira matéria (mesma página)
  let masthead = periodical ? mastheadHtml(project, ctx) : '';

  let n = 0;
  const hyph = settings.hyphenate ? getHyphenator() : null;
  chapters.forEach((c, i) => {
    let label = '';
    if (c.numbered) { n += 1; label = chapterLabel(settings, n); }
    tocItems.push({ id: c.id, label, title: c.title, level: 1 });
    const hasOpening = !!(c.openingImage && c.openingImage.asset && ctx.assets[c.openingImage.asset]);
    if (hasOpening) parts.push(fullBleedHtml(c.openingImage.asset, c.openingImage.fit, ctx));
    const heads = [];
    let body = markShortTables(numberTables(processBody(anchorHeadings(c.html, c.id, heads), ctx), ctx));
    heads.forEach(h => tocItems.push({ id: h.id, label: '', title: h.title, level: h.level }));
    if (hyph) { try { body = hyph(body); } catch (e) { /* sem hifenização */ } }
    const segments = splitFullBleed(body);
    segments.forEach((seg, k) => {
      if (seg.type === 'image') { parts.push(fullBleedHtml(seg.asset, seg.fit, ctx)); return; }
      const cols = periodical ? (Number(c.columns) || Number(settings.columns) || 1) : (Number(c.columns) || 1);
      if (k === 0) {
        const cls = `chapter${i === 0 ? ' first-chapter' : ''}${hasOpening ? ' after-opening' : ''}${periodical ? ' article' + (c.newPage === false ? ' flow' : '') : ''}`;
        parts.push(`<section class="${cls}" id="${esc(c.id)}" data-chapter="${i}" data-cols="${cols}">
          ${masthead}
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
        parts.push(`<section class="chapter chapter-cont" data-chapter="${i}" data-cols="${cols}"><div class="chapter-body">${seg.html}</div></section>`);
      }
    });
  });

  if (back.bio && back.bio.enabled) {
    const photo = back.bio.photo && ctx.assets[back.bio.photo];
    tocItems.push({ id: 'sobre-autor', label: '', title: back.bio.title, level: 1 });
    parts.push(`<section class="back-matter bio" id="sobre-autor">
      <h1 class="back-title">${esc(back.bio.title || 'Sobre o autor')}</h1>
      ${photo ? `<img class="bio-photo" src="${photo.dataUrl}" style="width:${num(back.bio.photoWidth, 35)}mm">` : ''}
      <div class="chapter-body">${processBody(back.bio.html, ctx)}</div>
    </section>`);
  }
  if (back.extra && back.extra.enabled) {
    tocItems.push({ id: 'conteudo-extra', label: '', title: back.extra.title, level: 1 });
    parts.push(`<section class="back-matter extra" id="conteudo-extra">
      <h1 class="back-title">${esc(back.extra.title || '')}</h1>
      <div class="chapter-body">${processBody(back.extra.html, ctx)}</div>
    </section>`);
  }

  ctx.tocItems = tocItems;
  // listas de figuras/gráficos/tabelas logo depois do sumário
  const lists = listsHtml(project, ctx);
  if (lists.length) parts.splice(tocIndex, 0, ...lists);
  if (front.toc) {
    const toc = tocHtml(project, tocItems);
    if (toc) parts.splice(tocIndex, 0, toc);
  }

  return `<div class="book kind-${esc(project.kind || 'book')} capstyle-${esc(settings.captionStyle || 'classica')}" lang="${esc(project.meta.language || 'pt-BR')}" data-number-from-first="${settings.numberFromFirstChapter ? 1 : 0}">${parts.join('\n')}</div>`;
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

  function marginRules(name, extra, textColor) {
    const L = [];
    const R = [];
    const hl = pn === 'top-outer' ? '@top-center' : '@top-left';
    const hr = pn === 'top-outer' ? '@top-center' : '@top-right';
    L.push(`${hl} { content: ${leftHeader}; ${boxStyle} }`);
    R.push(`${hr} { content: ${rightHeader}; ${boxStyle} }`);
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
@page :left { margin-left: ${mm(s.marginOuter)}; margin-right: ${mm(s.marginInner)}; }
@page :right { margin-left: ${mm(s.marginInner)}; margin-right: ${mm(s.marginOuter)}; }
@page :blank { ${none6} }
@page front { ${none6} }
@page fullbleed { margin: 0; ${none6} }
@page back { ${none6} }
${chapterPages}
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
.fullbleed .fb-img { position: absolute; left: -${mm(bleed)}; top: -${mm(bleed)}; width: calc(100% + ${(2 * bleed).toFixed(2)}mm); height: calc(100% + ${(2 * bleed + 0.5).toFixed(2)}mm); background-position: center; background-repeat: no-repeat; }

/* ---------- capítulos ---------- */
.chapter { break-before: page; }
.chapter.after-opening, .chapter.chapter-cont { break-before: page; }
.chapter-head { text-align: ${S.chapterTitle.align}; margin: ${mm(S.chapterTitle.spaceBefore)} 0 ${mm(S.chapterTitle.spaceAfter)} 0; break-after: avoid; }
.chapter-label { ${styleDecl(S.chapterLabel, body, { noIndent: true })} margin-top: 0; }
.chapter-title { ${styleDecl(S.chapterTitle, body, { noSpace: true })} line-height: 1.15; margin: 0; hyphens: manual; string-set: chaptitle content(text); }
.chapter-sep { margin-top: 4mm; text-align: ${S.chapterTitle.align}; line-height: 0; }
.chapter-sep img { display: inline-block; max-height: 18mm; object-fit: contain; }
.chapter-sep .sep-line { display: inline-block; border: 0; border-top: 0.6pt solid ${color(s.separatorColor, '#000')}; height: 0; margin: 0; }
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
.chapter-body div.box p { text-indent: 0; margin: 0 0 0.4em; }
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
`;
}

// ---------------------------------------------------------------- entrada
async function buildBook(rawProject) {
  const project = normalizeProject(rawProject);
  const s = project.settings;
  const contentH = num(s.pageHeight, 210) - num(s.marginTop, 20) - num(s.marginBottom, 22);
  const colW = num(s.pageWidth, 140) - num(s.marginInner, 22) - num(s.marginOuter, 16);
  const bleed = effectiveBleed(s);
  const ctx = { assets: project.assets || {}, settings: s, contentH, colW, bleed, missing: [], figures: [], qrImages: [],
    numbering: s.captionNumbering !== false, counters: { fig: 0, graf: 0, tab: 0 }, lists: { fig: [], graf: [], tab: [] } };

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
  project.chapters.forEach(c => { if (c.style.font) fams.add(c.style.font); if (c.style.titleFont) fams.add(c.style.titleFont); });
  (project.overlays || []).forEach(o => { if (o.font) fams.add(o.font); });

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
    figures: ctx.figures,
    page: {
      width: num(s.pageWidth, 140), height: num(s.pageHeight, 210),
      marginTop: num(s.marginTop, 20), marginBottom: num(s.marginBottom, 22),
      marginInner: num(s.marginInner, 22), marginOuter: num(s.marginOuter, 16),
      bleed, safety: num(s.safety, 5)
    }
  };
}

module.exports = { buildBook, chapterLabel, roman, words, stripFootnotes, esc, effectiveBleed, anchorHeadings };
