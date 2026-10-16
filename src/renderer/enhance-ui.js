/* global App, BookText */
// Melhoramento: EPUBs do Project Gutenberg (seção EPUB) e PDFs do Domínio Público (seção PDF, separada) viram
// DOCX no padrão do livro (Garamond, títulos, alinhamento, tamanho do texto, espaçamentos e parágrafos do
// sistema, sem sumário), gravados no lugar do EPUB (que vai para a Lixeira), na pasta do PDF ou em Downloads.
// Tira avisos e licença do Gutenberg ou do acervo, capa, folha de rosto, créditos, notas do transcritor,
// dedicatória, sumário/índice e listas do arquivo — fica só o texto dos capítulos. Um livro ou vários, um
// depois do outro, com registro de cada etapa.
(function () {
  const { el, $, api, D } = App;
  const queue = []; // { path, name, status: 'wait'|'run'|'ok'|'err', out, msg }
  let running = false;
  let screen = null, dlDir = '';

  const FRONT_RE = /^(contents|table of contents|sum[áa]rio|[íi]ndice|conte[úu]do|list of illustrations|illustrations|lista de ilustra[çc][õo]es|dedication|dedicat[óo]ria|to the (children|reader)|transcriber'?s? notes?|nota do transcritor|copyright|title page|errata|preface to the (\w+ )?edition|publisher'?s? note|acknowledg(e)?ments?|agradecimentos?|about (the|this) (author|book|e-?book)|by the same author|also by|frontispiece|half-title)\b/i;
  const BACK_RE = /^(footnotes?|notes?|notas?|transcriber'?s? notes?|nota do transcritor|advertisements?|an[úu]ncios|catalog(ue)?|books by|also by|other books|index|[íi]ndice remissivo|glossary|gloss[áa]rio|the full project gutenberg|end of (the )?project gutenberg|colophon|colofão)\b/i;
  const KEEP_BEFORE_RE = /^(pr[óo]logo|prologue|prelude|prel[úu]dio|introdu[çc][ãa]o|introduction|pre[âa]mbulo)\b/i;
  const END_RE = /^(the end|fim|finis|the end\.|fim\.)$/i;

  const clean = t => String(t || '').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();
  const decode = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return clean(t.value); };

  // ---------------------------------------------------------------- limpeza
  // o.keep (Tradução, VBO Refinamento): só tira avisos/licença do Gutenberg e converte as notas — nenhuma página,
  // capítulo, sumário ou separador do livro é removido
  function cleanGutenberg(res, log, o) {
    const keep = !!(o && o.keep);
    const root = document.createElement('div');
    (res.docs || []).forEach(d => {
      // capa (página de imagem do ebookmaker)
      if (/x-ebookmaker-cover/.test(d.bodyAttrs || '') || /^coverpage/i.test(d.id || '')) { log('· capa do arquivo removida'); return; }
      const box = document.createElement('div');
      box.innerHTML = d.html;
      root.appendChild(box);
    });
    let n = 0;
    // avisos, cabeçalho e licença do Project Gutenberg
    root.querySelectorAll('[id^="pg-header"], [id^="pg-footer"], #pg-machine-header, #pg-start-separator, #pg-end-separator, .pg-boilerplate, .pgheader, .pgfooter, [id*="pg-license"], .x-ebookmaker-cover, .x-ebookmaker-coverpage').forEach(x => { x.remove(); n++; });
    // formato antigo: “*** START OF THE PROJECT GUTENBERG …” / “*** END OF …”
    const all = () => Array.from(root.querySelectorAll('p, div, pre, h1, h2, h3, h4, h5, h6'));
    const start = all().find(x => /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(x.textContent));
    if (start) { removeBefore(root, start); start.remove(); n++; }
    const end = all().find(x => /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(x.textContent) || /^End of (the )?Project Gutenberg/i.test(clean(x.textContent)));
    if (end) { removeAfter(root, end); end.remove(); n++; }
    if (n) log(`· ${n} bloco(s) de avisos e licença do Project Gutenberg removido(s)`);
    // números de página do original, âncoras e notas do transcritor
    root.querySelectorAll('span.pagenum, .pagenum, a.pagenum, span[class*="pagenum"]').forEach(x => x.remove());
    let tn = 0;
    root.querySelectorAll('p, div, blockquote').forEach(x => { if (x.isConnected && /^\[?\s*transcriber'?s? note/i.test(clean(x.textContent)) && x.textContent.length < 3000) { x.remove(); tn++; } });
    if (tn) log(`· ${tn} nota(s) do transcritor removida(s)`);
    // notas de rodapé do Gutenberg ([1] -> nota de rodapé do livro)
    const fnCount = convertFootnotes(root);
    if (fnCount) log(`· ${fnCount} nota(s) de rodapé convertida(s)`);
    // quebras de linha dentro de títulos viram espaço (“CHAPTER 1<br>Título” -> “CHAPTER 1 Título”)
    root.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(h => {
      if (h.tagName === 'P' && h.textContent.length > 160) return;
      h.querySelectorAll('br').forEach(b => b.replaceWith(document.createTextNode(' ')));
    });
    // layout do original: alinhamentos e posição das figuras vindos das classes do Gutenberg
    root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(x => {
      if (x.style.textAlign) return;
      const c = ' ' + (x.className || '').toLowerCase() + ' ';
      if (/ (center|centered|c|tac|caption|figcenter|centerpar|centertext) /.test(c)) x.style.textAlign = 'center';
      else if (/ (right|r|tar|signature|sig|rightalign|textright) /.test(c)) x.style.textAlign = 'right';
      else if (/ (noindent|no-indent|nind|ni|first) /.test(c) && x.tagName === 'P') x.classList.add('no-indent');
    });
    // parágrafos com classe de título (ph2/ph3) viram títulos de verdade
    root.querySelectorAll('p.ph1, p.ph2, p.ph3, p[class*="title"]').forEach(p => { const h = document.createElement(p.classList.contains('ph1') ? 'h1' : 'h2'); h.innerHTML = p.innerHTML; p.replaceWith(h); });

    // sequência de blocos (achata divisões de capítulo, mantendo figuras, poesia e tabelas inteiras)
    const flat = [];
    const keepWhole = n2 => n2.matches('table, figure, ul, ol, blockquote, .poetry, .poem, .figcenter, .image-center, .figure, .illustration, .caption');
    const push = node => {
      if (node.nodeType === 3) { if (node.nodeValue.trim()) { const p = document.createElement('p'); p.textContent = node.nodeValue.trim(); flat.push(p); } return; }
      if (node.nodeType !== 1) return;
      if (/^(DIV|SECTION|ARTICLE|MAIN|BODY)$/.test(node.tagName) && !keepWhole(node) && node.querySelector('p, h1, h2, h3, h4, h5, h6, div')) { Array.from(node.childNodes).forEach(push); return; }
      flat.push(node);
    };
    Array.from(root.childNodes).forEach(push);
    if (keep) return flat.map(x => x.outerHTML).join('');

    // começo do texto: o primeiro capítulo (ou prólogo/introdução logo antes dele)
    const text = x => clean(x.textContent);
    const isHead = x => /^H[1-4]$/.test(x.tagName);
    const markers = BookText.chapterMarkers(flat);
    let first = -1;
    if (markers) first = Math.min(...markers.at.keys());
    if (first < 0) {
      // sem “CHAPTER N”: o primeiro título que não é página pré-textual nem o título da obra
      const title = clean(decode(res.meta && res.meta.title)).toLowerCase();
      first = flat.findIndex((x, i) => isHead(x) && !FRONT_RE.test(text(x)) && text(x).toLowerCase() !== title && i > 0 && flat.slice(i + 1, i + 4).some(y => y.tagName === 'P' && text(y).length > 120));
    }
    if (first > 0) {
      // um prólogo/introdução antes do primeiro capítulo continua
      for (let i = first - 1; i >= 0; i--) if (isHead(flat[i]) && KEEP_BEFORE_RE.test(text(flat[i]))) { first = i; break; }
      const dropped = flat.slice(0, first);
      const heads = dropped.filter(isHead).map(text).filter(Boolean).slice(0, 6);
      log(`· páginas pré-textuais removidas (${dropped.length} blocos${heads.length ? ': ' + heads.join(' · ') : ''})`);
      flat.splice(0, first);
    }
    // fim do texto: “THE END”/“FIM” e seções pós-textuais (notas, anúncios, índice, licença…)
    let cut = flat.findIndex(x => END_RE.test(text(x)));
    if (cut >= 0 && cut < flat.length) { log(`· “${text(flat[cut])}” e o que vem depois removidos`); flat.splice(cut); }
    for (let i = 0; i < flat.length; i++) {
      if (isHead(flat[i]) && BACK_RE.test(text(flat[i])) && !(markers && markers.at.has(i))) {
        const rest = flat.slice(i).filter(isHead).map(text);
        const anyChapterAfter = flat.slice(i + 1).some(y => isHead(y) && BookText.chapterMark(text(y), y.tagName));
        if (!anyChapterAfter) { log(`· páginas pós-textuais removidas: ${rest.slice(0, 5).join(' · ')}`); flat.splice(i); break; }
      }
    }
    // dedicatória/sumário/listas que sobraram no meio (sumário do arquivo dá lugar ao do sistema)
    for (let i = 0; i < flat.length; i++) {
      if (isHead(flat[i]) && FRONT_RE.test(text(flat[i]))) {
        let j = i + 1;
        while (j < flat.length && !isHead(flat[j])) j++;
        log(`· “${text(flat[i])}” removido`);
        flat.splice(i, j - i);
        i--;
      }
    }
    // tabelas de sumário sem título e imagens decorativas soltas sem texto ao lado
    for (let i = flat.length - 1; i >= 0; i--) {
      const x = flat[i];
      if (x.tagName === 'TABLE' && /contents/i.test(x.getAttribute('summary') || x.getAttribute('data-summary') || '')) flat.splice(i, 1);
      else if (x.tagName === 'HR') flat.splice(i, 1);
    }
    return flat.map(x => x.outerHTML).join('');
  }
  function removeBefore(root, node) {
    let cur = node;
    while (cur && cur !== root) { let p = cur.previousSibling; while (p) { const q = p.previousSibling; p.remove(); p = q; } cur = cur.parentNode; }
  }
  function removeAfter(root, node) {
    let cur = node;
    while (cur && cur !== root) { let n2 = cur.nextSibling; while (n2) { const q = n2.nextSibling; n2.remove(); n2 = q; } cur = cur.parentNode; }
  }
  function convertFootnotes(root) {
    let c = 0;
    root.querySelectorAll('a[href^="#"]').forEach(a => {
      const href = a.getAttribute('href').slice(1);
      if (!/^(Footnote|fn|note|FN|f\d)/i.test(href) && !a.classList.contains('fnanchor') && !/^\[?\d+\]?$|^\[[A-Z*]\]$/.test(clean(a.textContent))) return;
      const target = root.querySelector(`[id="${CSS.escape(href)}"]`) || root.querySelector(`a[name="${CSS.escape(href)}"]`);
      if (!target) return;
      const holder = target.closest('.footnote, div, p') || target;
      if (holder.contains(a)) return;
      const tmp = holder.cloneNode(true);
      tmp.querySelectorAll('a.label, a[href^="#Footnote"], a[href^="#FNanchor"], a[href^="#fnanchor"]').forEach(x => x.remove());
      const txt = clean(tmp.textContent).replace(/^\[?\d+\]?\s*/, '');
      if (!txt) return;
      const sp = document.createElement('span');
      sp.className = 'footnote';
      sp.textContent = txt;
      (a.closest('sup') || a).replaceWith(sp);
      holder.remove();
      c++;
    });
    // título “Footnotes” que ficou vazio
    root.querySelectorAll('h2, h3, h4, p').forEach(h => { if (/^footnotes?$/i.test(clean(h.textContent))) h.remove(); });
    return c;
  }

  // tamanho real da ilustração (proporção certa no DOCX)
  function imageSize(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth || 1000, h: im.naturalHeight || 1000 }); im.onerror = () => res({ w: 1000, h: 1000 }); im.src = src; });
  }
  // largura e posição como no original: % declarado no img/bloco, largura em px (coluna de ~600 px) ou natural
  function figureLayout(img, dim) {
    const holder = img.closest('figure, div') || img;
    const pct = el2 => { const m = /width\s*:\s*([\d.]+)%/.exec((el2 && el2.getAttribute('style')) || ''); return m ? Number(m[1]) : 0; };
    const px = el2 => { if (!el2) return 0; const m = /width\s*:\s*([\d.]+)(px|em)/.exec(el2.getAttribute('style') || ''); if (m) return Number(m[1]) * (m[2] === 'em' ? 16 : 1); return Number(el2.getAttribute('width')) || 0; };
    let w = pct(img) || pct(holder);
    if (!w) { const p = px(img) || px(holder) || dim.w; w = p / 600 * 100; }
    const cls = ((holder.className || '') + ' ' + (img.className || '')).toLowerCase();
    const side = /figleft|floatleft|left/.test(cls) ? 'left' : /figright|floatright|right/.test(cls) ? 'right' : 'center';
    w = Math.round(Math.max(20, Math.min(side === 'center' ? 100 : 50, w)));
    return { width: w, align: side, wrap: side === 'center' ? 'none' : 'square' };
  }

  // ---------------------------------------------------------------- PDF (Domínio Público)
  // avisos, créditos e endereços que os acervos públicos põem nos PDFs (Biblioteca Virtual do Estudante,
  // Ministério da Cultura/Biblioteca Nacional, NEAD/UNAMA, eBooksBrasil, Domínio Público…)
  const BOILER_RE = /(texto proveniente d[eo]|biblioteca virtual do estudante|bibvirt|escola do futuro|permitido o uso apenas|fins educacionais|redistribu[íi]do livremente|desde que n[ãa]o seja alterado|informa[çc][õo]es acima sejam mantidas|patrocinadores e volunt[áa]rios|para maiores informa[çc][õo]es|minist[ée]rio da cultura|funda[çc][ãa]o biblioteca nacional|departamento nacional do livro|n[úu]cleo de educa[çc][ãa]o a dist[âa]ncia|\bnead\b|universidade da amaz[ôo]nia|\bunama\b|ebooks ?brasil|vers[ãa]o para e-?book|fonte digital|digitaliza[çc][ãa]o|digitalizad[oa] por|texto-base|dom[íi]nio p[úu]blico|www\.|https?:\/\/|[\w.-]+@[\w-]+\.[a-z]{2,}|virtual ?books|e-?books? gratuitos?|livros gr[áa]tis|edi[çc][ãa]o eletr[ôo]nica|vers[ãa]o eletr[ôo]nica|todos os direitos reservados|copyright|©|\bisbn\b|bel[ée]m\s*[-–—]\s*par[áa])/i;
  const TOC_HEAD_RE = /^(sum[áa]rio|[íi]ndices?( geral| dos cap[íi]tulos)?|conte[úu]do|contents|table of contents)\s*[.:]?$/i;
  const PDF_BACK_RE = /^(biografia|sobre o autor|sobre a autora|dados biogr[áa]ficos|vida e obra|cronologia|obras d[oa] autor[a]?|outras obras|do mesmo autor|da mesma autora)\b/i;

  // tira do PDF as páginas de sumário/índice, avisos e créditos do acervo e páginas de capa/rosto; o resto
  // (títulos, capítulos, fim e páginas pós-textuais) segue a mesma limpeza do EPUB
  // trocas típicas do OCR em numerais romanos de capítulo (“CAPÍTULO!”, “CAPÍTULO Il” → “CAPÍTULO I”, “CAPÍTULO II”)
  function fixOcrLine(t) {
    const m = /^(cap[ií]tulo|parte|livro|canto|cap\.)\s*([IVXLCivxlc!|1]+)\s*[.:]?$/i.exec(t);
    if (m && /[!|1l]/.test(m[2])) return m[1] + ' ' + m[2].replace(/[!|1l]/g, 'I').toUpperCase();
    if (/^[IVX!|]{1,6}$/.test(t) && /[!|]/.test(t)) return t.replace(/[!|]/g, 'I');
    return t;
  }
  function cleanPdf(res, log) {
    const T = BookText.pdfLineText;
    (res.pages || []).forEach(p => { if (p.ocr) (p.lines || []).forEach(l => { const t = T(l), f = fixOcrLine(t); if (f !== t) l.parts = [{ text: f, sup: false, size: l.size }]; }); });
    const pages = (res.pages || []).filter(p => p.lines && p.lines.length);
    const body = BookText.pdfBodySize(pages);
    const endsNum = t => /(\.{2,}|…|_{2,}|-{3,}|\s)\s*\d{1,4}$/.test(t) && !/^\d{1,4}$/.test(t);
    const listLike = t => t.length <= 90 && (!!BookText.chapterMark(t, 'H1') || /^(cap[ií]tulo|parte|livro|canto)\b/i.test(t));
    let inToc = false;
    const toc = [];
    const keep = pages.filter(p => {
      const ts = p.lines.map(T).filter(Boolean);
      if (!ts.length) return false;
      const head = ts.slice(0, 3).some(t => TOC_HEAD_RE.test(t));
      const nNum = ts.filter(endsNum).length, nList = ts.filter(listLike).length;
      const short = ts.every(t => t.length <= 90);
      const isToc = ts.length >= 3 && ((head && (nNum >= ts.length * 0.25 || nList >= ts.length * 0.4 || short)) || (inToc && (nNum >= ts.length * 0.4 || nList >= ts.length * 0.6)) || (ts.length >= 6 && nNum >= ts.length * 0.6));
      inToc = isToc;
      if (isToc) toc.push(p.n);
      return !isToc;
    });
    if (toc.length) log(`· sumário/índice do PDF removido (página${toc.length > 1 ? 's' : ''} ${toc.join(', ')})`);
    if (pages.length - keep.length - toc.length > 0) log(`· ${pages.length - keep.length - toc.length} página(s) em branco removida(s)`);
    // título e autor da obra (para o DOCX e o nome do arquivo salvo)
    const found = guessPdfTitle(keep, body, res.meta || {}, res.name || '');
    // título com a grafia atual (“Memorias Posthumas” → “Memórias Póstumas”), também no nome do arquivo
    const fixT = t => (typeof PtBr === 'undefined' || !t ? t : PtBr.orthography(PtBr.archaic(t, { title: true }).text).text);
    found.title = fixT(found.title);
    const meta = Object.assign({}, res.meta || {}, { title: found.title, author: found.author || (res.meta || {}).author || '' });
    if (found.title) log(`· título reconhecido: “${found.title}” (${found.source})${meta.author ? ' · autor: ' + meta.author : ''}`);
    res.meta = meta;
    // texto reconstruído (parágrafos, títulos, notas, sem cabeçalhos e números de página)
    const box = document.createElement('div');
    box.innerHTML = BookText.pdfToHtml(Object.assign({}, res, { pages: keep }));
    let bp = 0;
    box.querySelectorAll('p, h1, h2, h3, h4').forEach(x => {
      const t = clean(x.textContent);
      if (!t) { x.remove(); return; }
      if (t.length < 900 && BOILER_RE.test(t)) { x.remove(); bp++; }
    });
    if (bp) log(`· ${bp} bloco(s) de avisos, créditos e endereços do acervo removido(s)`);
    // coesão: parágrafos partidos na virada da página (ou pela digitalização) voltam a ser um só
    let joined = 0;
    const ps = Array.from(box.children);
    for (let i = ps.length - 1; i > 0; i--) {
      const a = ps[i - 1], b = ps[i];
      if (a.tagName !== 'P' || b.tagName !== 'P' || a.querySelector('img') || b.querySelector('img')) continue;
      const ta = clean(a.textContent), tb = clean(b.textContent);
      if (!ta || !tb || /^[—–-]/.test(tb)) continue;
      const open = !/[.!?…:;»”"’)\]]$/.test(ta);
      const hyph = /\p{L}-$/u.test(ta) && /^\p{Ll}/u.test(tb);
      if (hyph || (open && /^\p{Ll}/u.test(tb)) || (open && /[,\p{Ll}]$/u.test(ta) && ta.length > 120 && /^\p{Lu}/u.test(tb) && tb.length > 40)) {
        if (hyph) a.innerHTML = a.innerHTML.replace(/-\s*$/, '') + b.innerHTML;
        else a.innerHTML = a.innerHTML.replace(/\s+$/, '') + ' ' + b.innerHTML.replace(/^\s+/, '');
        b.remove();
        joined++;
      }
    }
    if (joined) log(`· ${joined} parágrafo(s) partido(s) entre páginas reunido(s)`);
    // páginas pós-textuais próprias dos PDFs (biografia, cronologia, outras obras…) viram título para a limpeza geral
    box.querySelectorAll('p').forEach(x => { const t = clean(x.textContent); if (t.length <= 60 && PDF_BACK_RE.test(t) && !/[.;,]$/.test(t)) { const h = document.createElement('h2'); h.textContent = t; x.replaceWith(h); } });
    return box.innerHTML;
  }

  // ---------------------------------------------------------------- título da obra no PDF
  const SMALL_WORDS = new Set(['a', 'à', 'ao', 'aos', 'as', 'às', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'sem', 'sob', 'um', 'uma', 'à', 'del', 'di', 'du', 'la', 'le', 'of', 'the', 'and']);
  const ROMAN_T = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
  // “DOM CASMURRO” → “Dom Casmurro”; “MEMÓRIAS PÓSTUMAS DE BRÁS CUBAS” → “Memórias Póstumas de Brás Cubas”
  function titleCase(t) {
    t = clean(t);
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (!letters || letters !== letters.toUpperCase()) return t; // já tem maiúsculas e minúsculas: fica como está
    return t.toLowerCase().split(' ').map((w, i) => {
      if (ROMAN_T.test(w)) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.replace(/^([("“«'‘]*)(\p{L})/u, (m, a, b) => a + b.toUpperCase()).replace(/-(\p{L})/gu, (m, b) => '-' + b.toUpperCase());
    }).join(' ');
  }
  const PERSON_RE = /^[A-ZÀ-Ú][\p{L}.'’-]+(\s+(de|da|do|dos|das|e|[A-ZÀ-Ú][\p{L}.'’-]*)){1,5}$/u;
  const NOT_TITLE_RE = /^(romance|romances|novela|novelas|contos?|poesias?|poemas?|crônicas?|teatro|drama|com[ée]dia|trag[ée]dia|obra completa|obras completas|volume|vol\.|tomo|livro|edi[çc][ãa]o|\d+[ªa]? edi[çc][ãa]o|pref[áa]cio|apresenta[çc][ãa]o|introdu[çc][ãa]o|[íi]ndice|sum[áa]rio|fim|nota|notas|biografia|cap[íi]tulo\b.*|parte\b.*|primeira parte|segunda parte|cole[çc][ãa]o\b.*|s[ée]rie\b.*|vers[ãa]o\b.*|fonte\b.*|digitaliza.*|texto\b.*|autor\b.*|editora\b.*|rio de janeiro.*|s[ãa]o paulo.*|lisboa.*|bras[íi]lia.*|belo horizonte.*|porto alegre.*)\.?$/i;
  // nome de arquivo útil? (“dom_casmurro” sim; “bv000215”, “ua00064a”, “texto1” não)
  function nameFromFile(n) {
    n = String(n || '').replace(/\.[a-z0-9]{2,4}$/i, '').trim();
    if (!n || /^[a-z]{1,4}[-_]?\d{3,}[a-z]?$/i.test(n) || /^\d+$/.test(n) || /^(texto|livro|documento|arquivo|download|ebook|e-book|book|pdf|doc)[-_ ]?\d*$/i.test(n)) return '';
    const t = n.replace(/[_]+/g, ' ').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').replace(/\s+/g, ' ').trim();
    return t.split(' ').length >= 1 && /\p{L}{3,}/u.test(t) ? titleCase(t.toUpperCase()) : '';
  }
  const norm = t => clean(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // O título costuma ser a primeira linha de destaque do arquivo (folha de rosto), depois dos avisos do acervo.
  // Pontua as linhas das primeiras páginas (tamanho da letra, caixa alta, posição, não parecer nome de pessoa,
  // gênero ou cidade), junta título em duas linhas e confere com os dados do PDF e o nome do arquivo.
  function guessPdfTitle(pages, body, meta, fileName) {
    const T = BookText.pdfLineText;
    const cands = [];
    let order = 0;
    let stop = false;
    for (const p of pages.slice(0, 3)) {
      if (stop) break;
      const lines = p.lines.slice().sort((a, b) => b.y - a.y);
      let longRun = 0;
      for (let k = 0; k < lines.length; k++) {
        const l = lines[k], t = T(l);
        if (!t || BOILER_RE.test(t)) continue; // avisos e créditos do acervo não contam
        // o texto corrido (ou o primeiro capítulo) começou: o que vier depois não é mais folha de rosto
        if (BookText.chapterMark(t, 'H1') && cands.length === 0) { stop = true; break; }
        const letters0 = t.replace(/[^\p{L}]/gu, '');
        const textish = l.size <= body * 1.05 && letters0 !== letters0.toUpperCase() && (t.length > 45 || /^[a-zà-ú]/.test(t));
        if (textish) { if (++longRun >= 2) { stop = cands.length === 0; break; } continue; }
        order++;
        if (t.length < 2 || t.length > 90 || t.split(' ').length > 14) continue;
        if (BOILER_RE.test(t) || TOC_HEAD_RE.test(t) || BookText.chapterMark(t, 'H1') || NOT_TITLE_RE.test(t)) continue;
        if (/^[\d\s.,/–—-]+$/.test(t) || /^\(?\d{3,4}\)?$/.test(t) || /^[ivxlcdm]+$/i.test(t)) continue;
        if (/[.;:]$/.test(t) && t.split(' ').length > 6) continue;
        const letters = t.replace(/[^\p{L}]/gu, '');
        if (letters.length < 2) continue;
        const upper = letters === letters.toUpperCase();
        const byLine = /^(de|por|by)\s+\S/i.test(t); // “de Machado de Assis”: autor
        const person = byLine || (PERSON_RE.test(t) && !upper && t.split(' ').length <= 5);
        let score = (l.size / body) * 3 + (upper ? 1.5 : 0) - order * 0.25 - (byLine ? 4 : person ? 1.5 : 0) - (t.length > 60 ? 1 : 0);
        cands.push({ l, t, p, k, lines, score, upper, person });
      }
      if (cands.length >= 6) break;
    }
    let best = cands.slice().sort((a, b) => b.score - a.score)[0] || null;
    let title = '';
    if (best) {
      title = best.t;
      // título em duas (ou três) linhas seguidas do mesmo tamanho
      for (let k = best.k + 1, n = 0; k < best.lines.length && n < 2; k++, n++) {
        const nx = best.lines[k], prev = best.lines[k - 1], t2 = T(nx);
        if (!t2 || Math.abs(nx.size - best.l.size) > 0.6 || prev.y - nx.y > best.l.size * 2.2) break;
        if (BOILER_RE.test(t2) || NOT_TITLE_RE.test(t2) || (PERSON_RE.test(t2) && !/^[^a-zà-ú]+$/.test(t2)) || (title + ' ' + t2).length > 110) break;
        title += ' ' + t2;
      }
    }
    // dados do PDF: valem quando o título gravado aparece nas primeiras páginas (ou quando não há outro)
    const firstText = norm(pages.slice(0, 3).map(p => p.lines.map(T).join(' ')).join(' '));
    const mt = clean(meta.title || '');
    const fileT = nameFromFile(fileName);
    let source = 'folha de rosto';
    if (mt && (!title || firstText.includes(norm(mt))) && norm(mt).length >= 3) { title = mt; source = 'dados do PDF'; }
    else if (title && fileT && norm(fileT) === norm(title)) source = 'folha de rosto e nome do arquivo';
    else if (!title && fileT) { title = fileT; source = 'nome do arquivo'; }
    else if (!title) source = '';
    // autor: nome de pessoa perto do título (antes ou depois), ou o dos dados do PDF
    let author = clean(meta.author || '');
    if (!author && best) {
      const near = best.lines.slice(Math.max(0, best.k - 3), best.k + 5).map(T).filter(t => t && norm(t) !== norm(best.t) && !title.includes(t));
      const a = near.map(t => t.replace(/^(de|por|by)\s+/i, '')).find(t => PERSON_RE.test(t) && !BOILER_RE.test(t) && !NOT_TITLE_RE.test(t) && !BookText.chapterMark(t, 'H1'));
      if (a) author = titleCase(a);
    }
    return { title: titleCase(title), author, source };
  }

  // ---------------------------------------------------------------- revisão do português (PDF)
  // Diálogos com travessão (sem aspas), grafias antigas atualizadas, Novo Acordo Ortográfico e pontuação
  // editorial (reticências, espaços, travessões, aspas curvas nas citações) — sem mudar o estilo do autor.
  function polishPtBr(html, log, glue, o) {
    const archaic = !(o && o.archaic === false);
    if (typeof PtBr === 'undefined') return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const st = { dialogues: 0, archaic: {}, ortho: {}, punct: {}, ocr: 0 };
    const add = (map, rules) => rules.forEach(r => { map[r] = (map[r] || 0) + 1; });
    tpl.content.querySelectorAll('p, li').forEach(p => {
      if (p.closest('figure')) return;
      const txt = p.textContent;
      if (!/^\s*[“"«„\-–—]/.test(txt)) return;
      if (!p.querySelector('*:not(em):not(i):not(strong):not(b)') && p.children.length === 0) {
        const r = PtBr.dialogue(txt, { glue });
        if (r.changed) { p.textContent = r.text; st.dialogues++; }
      } else {
        const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        const first = tw.nextNode();
        if (first && /^\s*[“"«„\-–]/.test(first.nodeValue)) { first.nodeValue = first.nodeValue.replace(/^\s*[“"«„\-–]\s*/, glue ? PtBr.EM : PtBr.EM + ' '); st.dialogues++; }
      }
    });
    const tw = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = tw.nextNode())) if (!n.parentElement.closest('figure, code, pre')) nodes.push(n);
    nodes.forEach(t => {
      let v = t.nodeValue;
      // sujeira comum de PDF/OCR: ligaduras, hífen flutuante, espaços
      const v0 = v;
      v = v.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/[\u00ad\u200b]/g, '').replace(/\s*\|\s*/g, ' ').replace(/(\p{L})\s+-\s+(\p{Ll})/gu, '$1-$2');
      if (v !== v0) st.ocr++;
      if (archaic) { const a = PtBr.archaic(v); v = a.text; add(st.archaic, a.hits); }
      const o = PtBr.orthography(v); v = o.text; add(st.ortho, o.hits);
      const p = PtBr.punctuation(v); v = p.text; add(st.punct, p.hits);
      if (v !== t.nodeValue) t.nodeValue = v;
    });
    const sum = m => Object.values(m).reduce((x, y) => x + y, 0);
    if (st.dialogues) log(`· ${st.dialogues} diálogo(s) com travessão (aspas retiradas)`);
    if (sum(st.archaic)) log(`· ${sum(st.archaic)} grafia(s) antiga(s) atualizada(s) (ex.: ${Object.keys(st.archaic).slice(0, 3).map(k => k.replace(/^.*\((.*)\)$/, '$1')).join(', ')})`);
    if (sum(st.ortho)) log(`· ${sum(st.ortho)} correção(ões) do Novo Acordo Ortográfico`);
    if (sum(st.punct)) log(`· ${sum(st.punct)} ajuste(s) de pontuação (reticências, espaços, travessões, aspas)`);
    if (st.ocr) log(`· ${st.ocr} trecho(s) com sujeira de PDF/digitalização limpos`);
    return tpl.innerHTML;
  }
  const polishTitle = t => (typeof PtBr === 'undefined' ? t : PtBr.punctuation(PtBr.orthography(PtBr.archaic(t, { title: true }).text).text).text);

  // ---------------------------------------------------------------- um livro
  async function processOne(item, sec) {
    const log = (m, k) => addLog(sec, `${item.name} — ${m}`, k);
    item.status = 'run'; renderList(sec);
    if (sec.kind === 'pdf') {
      const { proj } = await loadBook(item.path, item.name, log, { images: false });
      // o DOCX recebe o nome da obra (título reconhecido); substituir: na pasta do PDF, e o PDF vai para a Lixeira
      const title = clean(proj.meta.title) || item.name;
      const replace = sec.opt.replace.checked;
      const here = replace || sec.opt.next.checked;
      item.out = await saveDocx(proj, log, '', { nextTo: here ? item.path : null, name: title }, { noTitlePage: true });
      log(`arquivo salvo com o título da obra: ${item.out.split(/[\\/]/).pop()}`);
      if (replace) {
        const r = await api.enhReplace(item.path, item.out);
        if (r && r.ok) log('PDF original substituído pelo DOCX (o PDF foi para a Lixeira)', 'ok');
        else log('atenção: ' + ((r && r.msg) || 'o PDF foi mantido'), 'bad');
      }
      item.status = 'ok';
      return;
    }
    const { proj } = await loadBook(item.path, item.name, log, { images: sec.opt.images.checked });
    const replace = sec.opt.replace.checked;
    // substituir: o DOCX vai para a pasta do EPUB, com o mesmo nome do arquivo, e o EPUB para a Lixeira
    item.out = await saveDocx(proj, log, '', replace ? { nextTo: item.path, name: item.path.split(/[\\/]/).pop().replace(/\.epub$/i, '') } : null, { noTitlePage: true });
    if (replace) {
      const r = await api.enhReplace(item.path, item.out);
      if (r && r.ok) log('EPUB original substituído pelo DOCX (o EPUB foi para a Lixeira)', 'ok');
      else log('atenção: ' + ((r && r.msg) || 'o EPUB foi mantido'), 'bad');
    }
    item.status = 'ok';
  }

  // Lê um livro (EPUB, PDF, DOCX, DOC, ODT…), tira avisos do Gutenberg/do acervo e páginas pré/pós-textuais e
  // monta um projeto temporário no padrão do sistema, com os capítulos e as ilustrações. Usado também pela
  // Tradução e pelas Ferramentas. Sem sumário, a não ser que opts.toc peça.
  async function loadBook(filePath, name, log, opts) {
    opts = opts || {};
    log('lendo o arquivo…');
    const res = await api.enhRead(filePath);
    if (!res || res.error) throw new Error(res ? res.error : 'arquivo ilegível');
    // dados vazios que os geradores de PDF/DOCX gravam (“(anonymous)”, “Untitled”, “Microsoft Word - arquivo.docx”)
    if (res.meta) ['title', 'author'].forEach(k => {
      const v = String(res.meta[k] || '').replace(/^Microsoft Word\s*-\s*/i, '').replace(/\.(docx?|odt|rtf|pdf)$/i, '').trim();
      res.meta[k] = /^\(?\s*(anonymous|anônimo|untitled|unknown|sem título|desconhecido|user|usuário|admin|author|autor|title|título)\s*\)?$/i.test(v) ? '' : v;
    });
    if (res.kind === 'pdf' && opts.clean !== false) {
      log(`${res.pages.length} página(s) no PDF`);
      // PDF digitalizado (páginas só com imagem): reconhecimento de texto (OCR) no computador
      const chars = p => (p.lines || []).reduce((a, l) => a + BookText.pdfLineText(l).length, 0);
      const noText = res.pages.filter(p => chars(p) < 30).map(p => p.n);
      if (noText.length && noText.length >= res.pages.length * 0.5) {
        log(`PDF digitalizado: reconhecendo o texto de ${noText.length} página(s) (OCR em português, no computador; pode levar alguns minutos)…`);
        const t0 = Date.now();
        let last = 0;
        const off = api.onEnhOcrProgress ? api.onEnhOcrProgress(p => { if (p.done === p.total || p.done - last >= Math.max(5, Math.round(p.total / 10))) { last = p.done; log(`OCR: ${p.done} de ${p.total} página(s)…`); } }) : null;
        const r = await api.enhOcr(filePath, noText).finally(() => { if (off) off(); });
        if (!r || r.error) throw new Error('não foi possível reconhecer o texto do PDF digitalizado' + (r && r.error ? ': ' + r.error : ''));
        const byN = new Map(r.pages.map(p => [p.n, p]));
        res.pages = res.pages.map(p => byN.get(p.n) || p);
        const conf = r.pages.flatMap(p => p.lines.map(l => l.ocr || 0));
        const avg = conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : 0;
        log(`· texto reconhecido em ${r.pages.length} página(s) em ${Math.round((Date.now() - t0) / 1000)} s · confiança média ${avg}%${avg && avg < 75 ? ' (digitalização de baixa qualidade: revise o texto)' : ''}`);
        res.ocr = true;
      }
      if (!(res.pages || []).some(p => p.lines && p.lines.length)) throw new Error('o PDF não tem texto reconhecível');
      res.docs = [{ id: 'pdf', html: cleanPdf(res, m => log(m)) }];
    } else if (res.kind !== 'epub') {
      // Word/ODT/texto: capítulos do importador, depois a mesma limpeza (avisos, páginas extras)
      const chs = BookText.convertImport(Object.assign({ name }, res));
      const meta = chs.meta || {};
      res.docs = [{ id: 'doc', html: chs.map(c => `<h1>${App.escape(c.title || '')}</h1>${c.html}`).join('\n') }];
      res.meta = Object.assign({ title: meta.title || name, author: meta.author || '', language: meta.language || '' }, res.meta || {});
      if (!opts.allowAny && !/\.(docx?|odt|epub|rtf|txt|html?)$/i.test(filePath)) throw new Error('formato não suportado');
    }
    res.meta = res.meta || {};
    if (!res.meta.title) res.meta.title = name;
    log(`${res.kind === 'pdf' ? 'texto do PDF reconstruído' : (res.docs || []).length + ' arquivo(s) internos'} · “${decode(res.meta.title) || name}”${res.meta.author ? ' · ' + decode(res.meta.author) : ''}`);
    // conversão de formato (Ferramentas): sem a limpeza do Gutenberg, o arquivo fica inteiro
    let html = opts.clean === false ? (res.docs || []).map(d => d.html).join('\n') : cleanGutenberg(res, m => log(m), { keep: opts.keep });
    // PDF: revisão do português (travessão nos diálogos, ortografia atual, pontuação)
    if (res.kind === 'pdf' && opts.clean !== false && opts.polish !== false) html = polishPtBr(html, m => log(m), opts.glue !== false);
    let chapters = BookText.htmlToChapters(html, decode(res.meta.title) || name);
    const det = chapters.detected;
    chapters = chapters.filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img/.test(c.html));
    if (opts.clean !== false && !opts.keep) {
      // restos de página de rosto no começo (título, autor, editora, local/ano), sem texto corrido: fora
      const bookT = clean(decode(res.meta.title)).toLowerCase(), bookA = clean(decode(res.meta.author)).toLowerCase();
      const txt = c => clean(c.html.replace(/<[^>]+>/g, ' '));
      while (chapters.length > 1) {
        const c = chapters[0], t = txt(c), low = t.toLowerCase(), head = clean(c.title).toLowerCase();
        const paras = (c.html.match(/<p[\s>]/g) || []).length;
        const longest = Math.max(0, ...(c.html.match(/<p[^>]*>[\s\S]*?<\/p>/g) || []).map(p => clean(p.replace(/<[^>]+>/g, '')).length));
        const titleish = (bookT && (head === bookT || low.includes(bookT))) || (bookA && low.includes(bookA)) || FRONT_RE.test(c.title) || head === clean(name).toLowerCase();
        if (c.sourceLabel || /<img/.test(c.html) || !(t.length < 700 && longest < 200 && paras <= 12 && (titleish || t.length < 120))) break;
        log(`· página de rosto removida (“${c.title}”${t ? ': ' + t.slice(0, 60) + (t.length > 60 ? '…' : '') : ''})`);
        chapters.shift();
      }
    }
    if (!chapters.length) throw new Error('nenhum capítulo encontrado depois da limpeza');
    log(`${chapters.length} capítulo(s)${det ? ' (pelos marcadores “' + (det.labeled ? 'CHAPTER/CAPÍTULO ' : '') + (det.style === 'roman' ? 'I, II…' : '1, 2…') + '”)' : ''}: ${chapters.slice(0, 3).map(c => c.title).join(' · ')}${chapters.length > 3 ? ' …' : ''}`);
    // projeto temporário com a configuração padrão do sistema (não mexe no livro aberto)
    const proj = D.normalizeProject(await api.newProject());
    proj.meta.title = decode(res.meta.title) || name;
    proj.meta.author = decode(res.meta.author);
    proj.meta.language = decode(res.meta.language) || proj.meta.language;
    if (det) { proj.settings.chapterNumbering = det.style === 'words' ? 'arabic' : det.style; proj.settings.chapterLabel = det.labeled ? 'Capítulo' : ''; }
    // sem sumário automático (nem o do arquivo, que a limpeza já tirou)
    proj.front.toc = !!opts.toc;
    let imgs = 0;
    proj.chapters = [];
    for (const c of chapters) proj.chapters.push(await (async () => {
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html;
      for (const img of tpl.content.querySelectorAll('img[src^="data:"]')) {
        if (opts.images === false) { (img.closest('figure') || img).remove(); continue; }
        const id = 'img' + (++imgs);
        const dim = await imageSize(img.getAttribute('src'));
        proj.assets[id] = { id, name: 'Ilustração ' + imgs, dataUrl: img.getAttribute('src'), width: dim.w, height: dim.h, info: {} };
        const holder = img.closest('figure') || img;
        const cap = holder.tagName === 'FIGURE' ? holder.querySelector('figcaption') : null;
        const t = document.createElement('template');
        t.innerHTML = App.editor.figureHtml(id, Object.assign(figureLayout(img, dim), { caption: cap ? cap.textContent : '' }));
        if (holder.tagName === 'FIGURE' || !holder.closest('p')) holder.replaceWith(t.content.firstChild); else { const p = holder.closest('p'); holder.remove(); p.after(t.content.firstChild); }
      }
      return { id: D.uid(), title: res.kind === 'pdf' && opts.clean !== false && opts.polish !== false ? polishTitle(c.title) : c.title, numbered: c.numbered !== false, html: tpl.innerHTML, locked: false, style: {}, separator: 'default', openingImage: null };
    })());
    if (imgs) log(`${imgs} ilustração(ões) mantida(s) nos capítulos`);
    return { proj, res, det, images: imgs };
  }

  // Grava o DOCX na pasta Downloads (ou ao lado do arquivo de origem: where.nextTo), no padrão do sistema
  // (Garamond no texto e nos títulos, espaçamentos, alinhamentos e tamanhos do sistema)
  async function saveDocx(proj, log, suffix, where, o) {
    const words = proj.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    log(`${words.toLocaleString('pt-BR')} palavras · gerando o DOCX no padrão do sistema (Garamond, títulos, alinhamento, tamanho do texto e parágrafos${proj.front.toc ? ', sumário' : ''})…`);
    const target = await api.enhTarget((where && where.name) || proj.meta.title + (suffix || ''), 'docx', where && where.nextTo);
    const doc = App.exportPrep.buildDoc(proj);
    doc.fontOverride = 'Garamond'; // texto e títulos em Garamond, com tamanhos, alinhamentos e espaços do sistema
    // Melhoramento: sem página de título — o documento começa no primeiro capítulo
    if (o && o.noTitlePage) doc.noTitlePage = true;
    const r = await api.exportRun({ kind: 'docx', project: proj, doc, opts: { target } });
    if (!r || !r.files) throw new Error('falha ao gravar o DOCX');
    log(`pronto → ${r.files[0]}`, 'ok');
    return r.files[0];
  }

  // ---------------------------------------------------------------- seções da tela (EPUB e PDF, separadas)
  const SECT = {
    epub: { kind: 'epub', ext: /\.epub$/i, label: 'EPUB', queue, running: false, opt: {} },
    pdf: { kind: 'pdf', ext: /\.pdf$/i, label: 'PDF', queue: [], running: false, opt: {} }
  };

  async function start(sec) {
    sec = sec && sec.kind ? sec : SECT.epub;
    if (sec.running) return;
    const todo = sec.queue.filter(q => q.status === 'wait' || q.status === 'err');
    if (!todo.length) return App.toast(`Envie um ou mais arquivos ${sec.label}.`);
    sec.running = true;
    running = SECT.epub.running || SECT.pdf.running;
    renderControls(sec);
    const t0 = Date.now();
    const where = sec.kind === 'pdf' ? (sec.opt.replace.checked ? 'cada DOCX substitui o seu PDF, na mesma pasta, com o título da obra' : sec.opt.next.checked ? 'cada DOCX na pasta do seu PDF, com o título da obra (o PDF é mantido)' : 'saída em ' + dlDir) : (sec.opt.replace.checked ? 'cada DOCX substitui o seu EPUB, na mesma pasta' : 'saída em ' + dlDir);
    addLog(sec, `Início: ${todo.length} livro(s) · ${where}`);
    let ok = 0;
    for (const item of todo) {
      try { await processOne(item, sec); ok++; } catch (e) { item.status = 'err'; item.msg = String(e.message || e); addLog(sec, `${item.name} — erro: ${item.msg}`, 'bad'); }
      renderList(sec);
    }
    sec.running = false;
    running = SECT.epub.running || SECT.pdf.running;
    addLog(sec, `Fim: ${ok} de ${todo.length} livro(s) processado(s) em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`, ok === todo.length ? 'ok' : 'bad');
    renderControls(sec);
    if (ok && sec.opt.open.checked) { const last = todo.filter(x => x.out).pop(); if (last) api.showItem(last.out); }
  }

  // ---------------------------------------------------------------- tela
  function addLog(sec, m, kind) {
    if (typeof sec === 'string') { kind = m; m = sec; sec = SECT.epub; }
    const box = sec.logBox;
    if (!box) return;
    const now = new Date();
    box.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: now.toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
    box.scrollTop = box.scrollHeight;
  }
  function addFiles(paths, sec) {
    sec = sec || SECT[(paths || []).some(p => /\.pdf$/i.test(p)) && !(paths || []).some(p => /\.epub$/i.test(p)) ? 'pdf' : 'epub'];
    let n = 0;
    paths.filter(p => sec.ext.test(p)).forEach(p => { if (!sec.queue.some(q => q.path === p)) { sec.queue.push({ path: p, name: p.split(/[\\/]/).pop().replace(sec.ext, ''), status: 'wait' }); n++; } });
    if (paths.length && !n) App.toast(`Só arquivos .${sec.kind} (ou já estão na lista).`);
    renderList(sec);
    renderControls(sec);
    return n;
  }
  function renderList(sec) {
    sec = sec || SECT.epub;
    const box = sec.listBox;
    if (!box) return;
    box.innerHTML = '';
    if (!sec.queue.length) { box.appendChild(el('p', { class: 'muted enh-empty', text: 'Nenhum livro na lista.' })); return; }
    const L = { wait: 'aguardando', run: 'processando…', ok: 'concluído', err: 'erro' };
    sec.queue.forEach((q, i) => box.appendChild(el('div', { class: 'enh-item ' + q.status }, [
      el('span', { class: 'enh-ic', html: App.icons ? App.icons.svg('book') : '' }),
      el('span', { class: 'enh-name' }, [el('b', { text: q.name }), el('small', { class: 'muted', text: q.out ? q.out : q.msg || q.path })]),
      el('span', { class: 'enh-st', text: L[q.status] }),
      q.out ? el('button', { class: 'icon-btn', title: 'Mostrar na pasta', text: '📂', onclick: () => api.showItem(q.out) }) : null,
      !sec.running && q.status !== 'run' ? el('button', { class: 'icon-btn', title: 'Tirar da lista', text: '✕', onclick: () => { sec.queue.splice(i, 1); renderList(sec); renderControls(sec); } }) : null
    ])));
  }
  function renderControls(sec) {
    sec = sec || SECT.epub;
    const b = sec.startBtn;
    if (!b) return;
    const n = sec.queue.filter(q => q.status === 'wait' || q.status === 'err').length;
    b.disabled = sec.running || !n;
    b.textContent = sec.running ? 'Processando…' : n > 1 ? `▶ Iniciar (${n} livros, um após o outro)` : '▶ Iniciar';
  }

  // uma seção completa: envio, lista, opções, o que é feito, botão e registro próprios
  function section(sec, cfg) {
    sec.logBox = el('ol', { class: 'pg-log enh-log' });
    sec.listBox = el('div', { class: 'enh-list' });
    sec.startBtn = el('button', { class: 'primary big', id: sec.kind === 'pdf' ? 'pdfStart' : 'enhStart', onclick: () => start(sec) });
    const drop = el('button', { class: 'enh-drop', onclick: async () => addFiles(await api.enhPick(sec.kind), sec) }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }),
      el('b', { text: cfg.drop }),
      el('span', { class: 'muted', text: cfg.dropHint })
    ]);
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f)), sec); });
    const node = el('main', { class: 'enh-main', 'data-sec': sec.kind }, [
      el('section', { class: 'enh-col' }, [
        drop,
        sec.listBox,
        el('div', { class: 'enh-opts' }, cfg.opts),
        el('div', { class: 'enh-what' }, [el('b', { text: 'O que é feito em cada livro' }), el('ul', {}, cfg.what.map(t => el('li', { text: t })))]),
        el('div', { class: 'enh-run' }, [sec.startBtn, cfg.whereTxt])
      ]),
      el('section', { class: 'enh-col' }, [el('h3', { text: 'Registro — ' + sec.label }), sec.logBox])
    ]);
    // arrastar arquivos para qualquer ponto da seção
    node.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    node.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f)), sec); });
    return node;
  }
  const pref = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v !== '0'; } catch (e) { return def; } };
  const remember = (k, chk, after) => chk.addEventListener('change', () => { try { localStorage.setItem(k, chk.checked ? '1' : '0'); } catch (e) { /* ok */ } if (after) after(); });

  async function open(tab) {
    if (screen) { screen.classList.add('show'); if (tab) setTab(tab); return; }
    dlDir = await api.enhDownloads();
    // EPUB: substituir o EPUB de origem (padrão, lembrado) ou salvar uma cópia em Downloads
    const E = SECT.epub;
    E.opt.images = el('input', { type: 'checkbox', id: 'enhImages', checked: true });
    E.opt.replace = el('input', { type: 'checkbox', id: 'enhReplace', checked: pref('enh.replace', true) });
    E.opt.open = el('input', { type: 'checkbox', id: 'enhOpen', checked: true });
    const eWhere = el('span', { class: 'muted small' });
    const showE = () => { eWhere.textContent = E.opt.replace.checked ? 'Salvo na pasta de cada EPUB, no lugar dele' : 'Salvo em: ' + dlDir; };
    remember('enh.replace', E.opt.replace, showE); showE();
    const epubNode = section(E, {
      drop: 'Enviar EPUBs do Project Gutenberg',
      dropHint: 'Clique ou arraste aqui um ou vários arquivos .epub (modo em massa: processados um após o outro)',
      opts: [
        el('label', { class: 'chk' }, [E.opt.images, ' Manter as ilustrações dentro dos capítulos']),
        el('label', { class: 'chk', title: 'O DOCX é gravado na pasta do EPUB, com o mesmo nome; só depois de conferido o EPUB vai para a Lixeira (dá para recuperar de lá).' }, [E.opt.replace, ' Substituir o EPUB original pelo DOCX (o EPUB vai para a Lixeira)']),
        el('label', { class: 'chk' }, [E.opt.open, ' Mostrar a pasta ao terminar'])
      ],
      what: [
        'remove capa, folha de rosto, créditos, dedicatória, notas do transcritor, listas de ilustrações e o sumário do arquivo',
        'remove os avisos, o cabeçalho e a licença do Project Gutenberg e as páginas pós-textuais (anúncios, índices, notas finais)',
        'identifica os capítulos (CHAPTER 1, I, II…) — sem sumário automático',
        'converte as notas de rodapé e aplica o padrão do sistema: Garamond no texto e nos títulos, alinhamento, tamanho do texto, entrelinha e recuo de parágrafo'
      ],
      whereTxt: eWhere
    });
    // PDF: o DOCX vai para a pasta do PDF (padrão, lembrado) ou para Downloads; o PDF nunca é apagado
    const P = SECT.pdf;
    P.opt.replace = el('input', { type: 'checkbox', id: 'pdfReplace', checked: pref('enh.pdfReplace', true) });
    P.opt.next = el('input', { type: 'checkbox', id: 'pdfNext', checked: pref('enh.pdfNext', true) });
    P.opt.open = el('input', { type: 'checkbox', id: 'pdfOpen', checked: true });
    const pWhere = el('span', { class: 'muted small' });
    const nextLbl = el('label', { class: 'chk', title: 'O PDF original é mantido.' }, [P.opt.next, ' Salvar o DOCX na pasta de cada PDF (o PDF é mantido)']);
    const showP = () => {
      nextLbl.style.display = P.opt.replace.checked ? 'none' : '';
      pWhere.textContent = P.opt.replace.checked ? 'Salvo na pasta de cada PDF, no lugar dele, com o título da obra' : P.opt.next.checked ? 'Salvo na pasta de cada PDF, com o título da obra (o PDF é mantido)' : 'Salvo em: ' + dlDir + ', com o título da obra';
    };
    remember('enh.pdfNext', P.opt.next, showP); remember('enh.pdfReplace', P.opt.replace, showP); showP();
    const pdfNode = section(P, {
      drop: 'Enviar livros em PDF (Domínio Público)',
      dropHint: 'Clique ou arraste aqui um ou vários arquivos .pdf baixados do dominiopublico.gov.br (modo em massa: um após o outro)',
      opts: [
        el('label', { class: 'chk', title: 'O DOCX é gravado na pasta do PDF com o título da obra; só depois de conferido o PDF vai para a Lixeira (dá para recuperar de lá).' }, [P.opt.replace, ' Substituir o PDF original pelo DOCX, salvo com o título da obra (o PDF vai para a Lixeira)']),
        nextLbl,
        el('label', { class: 'chk' }, [P.opt.open, ' Mostrar a pasta ao terminar'])
      ],
      what: [
        'reconhece o título da obra (folha de rosto, dados do PDF ou nome do arquivo) e salva o DOCX com esse nome — ex.: “Dom Casmurro.docx”',
        'PDF digitalizado (só imagem): reconhece o texto por OCR em português, no computador, sem internet',
        'reconstrói os parágrafos do PDF (junta as linhas e os parágrafos partidos entre páginas, desfaz hifenizações, tira cabeçalhos, rodapés e números de página)',
        'revisa o português: diálogos com travessão (sem aspas), grafias antigas atualizadas (ella → ela, pharmacia → farmácia, sôbre → sobre), Novo Acordo Ortográfico e pontuação',
        'remove capa, folha de rosto, avisos e créditos do acervo (Biblioteca Virtual do Estudante, Ministério da Cultura, NEAD, eBooksBrasil…), apresentação e o sumário/índice do PDF',
        'remove as páginas pós-textuais (FIM, biografia, cronologia, outras obras, índice, notas finais)',
        'identifica os capítulos (CAPÍTULO I, II, 1, 2…) — sem sumário automático',
        'aplica o padrão do sistema: Garamond no texto e nos títulos, espaçamentos, alinhamento, tamanho do texto, entrelinha e recuo de parágrafo'
      ],
      whereTxt: pWhere
    });
    const tabs = { epub: epubNode, pdf: pdfNode };
    const head = el('div', { class: 'tr-tabs enh-tabs' }, [['epub', '📗 EPUB — Project Gutenberg'], ['pdf', '📄 PDF — Domínio Público']].map(([k, t]) => el('button', { class: 'tr-tab', 'data-tab': k, text: t, onclick: () => setTab(k) })));
    screen = el('div', { class: 'enh-screen show' }, [
      el('header', { class: 'enh-head' }, [
        el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('sparkles') : '' }), el('div', {}, [el('h1', { text: 'Melhoramento' }), el('p', { class: 'muted', text: 'EPUB do Project Gutenberg ou PDF do Domínio Público → DOCX limpo, no padrão do sistema' })])]),
        head,
        el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
      ]),
      epubNode,
      pdfNode
    ]);
    screen._tabs = tabs;
    // arquivo solto fora das seções: vai para a seção aberta
    screen.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    screen.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f)), SECT[screen._tab] || SECT.epub); });
    document.body.appendChild(screen);
    [E, P].forEach(s => { renderList(s); renderControls(s); });
    addLog(E, 'Pronto. Envie os EPUBs e clique em Iniciar.');
    addLog(P, 'Pronto. Envie os PDFs e clique em Iniciar.');
    setTab(tab || 'epub');
  }
  function setTab(t) {
    if (!screen || !screen._tabs[t]) return;
    screen._tab = t;
    Object.entries(screen._tabs).forEach(([k, n]) => { n.style.display = k === t ? '' : 'none'; });
    screen.querySelectorAll('.enh-tabs .tr-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  }

  App.enhance = { open, setTab, cleanGutenberg, cleanPdf, addFiles, start, queue, pdfQueue: SECT.pdf.queue, sections: SECT, loadBook, saveDocx, polishPtBr, polishTitle };
})();
