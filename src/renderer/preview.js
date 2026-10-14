/* global Paged */
// Renderiza o livro em páginas com Paged.js.
// Usado pela prévia (iframe) do editor e pela janela oculta de exportação.
(function () {
  let currentBook = null;

  async function loadFonts(families) {
    const variants = ['', 'italic ', 'bold ', 'italic bold '];
    const jobs = [];
    for (const fam of families) {
      for (const v of variants) jobs.push(document.fonts.load(`${v}16px "${fam}"`, 'ÁáçãõÉ').catch(() => null));
    }
    await Promise.all(jobs);
    await document.fonts.ready;
  }

  window.renderBook = async function (book, options) {
    options = options || {};
    currentBook = book;
    window.setPreviewOptions(options);
    if (book.fontFaceCss) {
      const st = document.createElement('style');
      st.id = 'library-fonts';
      st.textContent = book.fontFaceCss;
      document.head.appendChild(st);
    }
    await loadFonts(book.fonts || []);

    const tpl = document.createElement('template');
    tpl.innerHTML = book.html;
    // Aguarda as imagens decodificarem para a paginação medir corretamente
    await Promise.all(Array.from(tpl.content.querySelectorAll('img')).map(img => (img.decode ? img.decode().catch(() => null) : null)));

    // notas numeradas (para reconhecer uma nota cortada) e marca do fim do livro (para conferir que nada se perdeu)
    tpl.content.querySelectorAll('.footnote').forEach((n, i) => {
      n.dataset.fn = String(i);
      // padrão editorial: a nota fica inteira na página da chamada; se não couber, o texto desce
      const pol = options.notePolicy === undefined ? 'line' : (options.notePolicy || ((options.lineNotes || []).includes(i) ? 'line' : ''));
      if (pol) n.dataset.fnPolicy = pol;
      // blocos “sem divisão” (caixa, destaque, poesia) com nota dentro: o Paged.js deixa a página vazia
      // depois deles; com nota, podem dividir-se como um parágrafo comum
      for (let a = n.parentElement; a && !a.classList.contains('chapter-body'); a = a.parentElement) {
        if (a.matches('div.box, blockquote, p.phrase, div.poem p')) a.classList.add('fn-host');
      }
    });
    // parágrafos com nota: numerados para conferir se chegaram inteiros às páginas; os que se perderam numa
    // paginação anterior (defeito do Paged.js com notas na coluna de excesso) ficam sem divisão nesta
    const fnParas = [];
    tpl.content.querySelectorAll('.chapter-body > p, .chapter-body > blockquote, .chapter-body li').forEach(p => {
      if (!p.querySelector('.footnote') || p.closest('[data-fnp]')) return;
      const k = fnParas.length;
      p.dataset.fnp = String(k);
      const c = p.cloneNode(true);
      c.querySelectorAll('.footnote, .sidenote').forEach(x => x.remove());
      fnParas.push((String(c.textContent).replace(/[\u00ad\u200b]/g, '').match(/\S+/g) || []).length);
      if ((options.keepNotes || []).includes(k)) p.dataset.breakBefore = 'page';
    });
    let last = tpl.content.lastElementChild;
    while (last && last.lastElementChild && !/^(IMG|SVG|BR|HR)$/.test(last.lastElementChild.tagName)) last = last.lastElementChild;
    if (last) last.setAttribute('data-book-end', '1');
    const countWords = t => (String(t).replace(/[\u00ad\u200b]/g, '').match(/\S+/g) || []).length;
    // notas laterais saem do fluxo (vão para a margem depois da paginação): não entram na conferência
    const srcCopy = tpl.content.cloneNode(true);
    srcCopy.querySelectorAll('.sidenote').forEach(n => n.remove());
    const sourceWords = countWords(srcCopy.textContent);
    // ajuste da última página: capítulos levemente mais justos ou mais folgados
    const adjust = options.adjust || {};
    (book.chapterIds || []).forEach((id, i) => {
      if (adjust[id]) tpl.content.querySelectorAll(`.chapter[data-chapter="${i}"]`).forEach(sec => { sec.dataset.adjust = adjust[id]; });
    });
    // acabamento antes da paginação: justificação fina e grade de linha de base
    const tPre = performance.now();
    const typoReport = typoPrepass(tpl, book);
    typoReport.ms = Math.round(performance.now() - tPre);

    if (!window.__fnPolicyHandler && tpl.content.querySelector('[data-fn-policy]')) {
      // nestas notas: se não couber no pé da página, a linha (ou o parágrafo) da chamada vai junto para a página seguinte
      window.__fnPolicyHandler = true;
      class FnPolicy extends Paged.Handler { afterParsed(parsed) { parsed.querySelectorAll('[data-fn-policy]').forEach(n => n.setAttribute('data-note-policy', n.dataset.fnPolicy)); } }
      Paged.registerHandlers(FnPolicy);
    }

    // grade: o pedaço de uma tabela/citação dividida que abre a página volta a terminar na grade
    if ((book.typo || {}).grid && !window.__gridSplitHandler) {
      window.__gridSplitHandler = true;
      Paged.registerHandlers(class GridSplit extends Paged.Handler {
        afterOverflowAdded(dest) {
          if (!dest || !dest.querySelectorAll) return;
          dest.querySelectorAll('.chapter[data-chapter] > .chapter-body > [data-split-from][data-ggap]').forEach(el => {
            const L = Math.floor(parseFloat(getComputedStyle(el.parentElement).lineHeight) * 64) / 64;
            if (!(L > 4)) return;
            const h = el.getBoundingClientRect().height;
            const pad = Math.max(0, Math.ceil(h / L - 0.03) * L - h);
            el.style.marginBottom = (pad + Number(el.dataset.ggap)).toFixed(3) + 'px';
          });
        }
      });
    }
    const target = document.getElementById('render');
    const previewer = new Paged.Previewer();
    const flow = await previewer.preview(tpl.content, [{ [location.href]: book.css }], target);
    // trecho (capítulo) paginado numa janela de trabalho: numeração, camadas e guias são do livro inteiro
    // e ficam para a prévia que junta os trechos
    const offset = options.segment ? (restoreIds(), 0) : fixPageNumbers(book.typo || {});
    if (!options.segment) {
      if ((book.typo || {}).notesMode === 'side') placeSidenotes(book.page);
      renderOverlays(book.overlays || []);
      drawGuides(book.page);
    }
    if (options.spreadsPrint) enablePrintSpreads(book.page);
    if (options.pageRange) hidePagesOutside(options.pageRange);
    const pageInfo = Array.from(document.querySelectorAll('.pagedjs_page')).map(pg => ({
      n: Number(pg.dataset.pageNumber),
      side: pg.classList.contains('pagedjs_left_page') ? 'L' : 'R',
      blank: pg.classList.contains('pagedjs_blank_page'),
      text: (pg.querySelector('.pagedjs_page_content') || pg).textContent.trim().slice(0, 30)
    }));
    // notas cortadas (escondidas) e notas que continuam na página seguinte: as duas voltam inteiras
    // para a página da chamada na nova paginação (o texto desce, a nota fica)
    const clippedNotes = [...new Set(findClippedNotes().concat(findSplitNotes()))];
    if (options.showClippedNotes) clippedNotes.forEach(i => revealNote(i));
    // conferência de conteúdo: todas as palavras da origem precisam estar nas páginas (nada some no meio)
    // só conta palavras realmente visíveis: texto empurrado para fora da área da página não sai no PDF
    let pageWords = 0;
    document.querySelectorAll('.pagedjs_page .pagedjs_area').forEach(area => {
      const ar = area.getBoundingClientRect();
      const tw = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        const w = countWords(n.nodeValue);
        if (!w) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const rects = Array.from(r.getClientRects()).filter(rc => rc.width >= 1);
        if (!rects.length) continue;
        const vis = rects.filter(rc => rc.top >= ar.top - Math.max(2, rc.height * 0.75) && rc.bottom <= ar.bottom + 2 && rc.left >= ar.left - 2 && rc.right <= ar.right + 2).length;
        pageWords += w * vis / rects.length;
      }
    });
    pageWords = Math.round(pageWords);
    const lostNotes = findLostNoteParagraphs(fnParas, countWords).concat(options.keepNotes || []).filter((v, i, a) => a.indexOf(v) === i);
    const complete = !!document.querySelector('.pagedjs_pages [data-book-end]') && pageWords >= sourceWords * 0.998;
    const indexPages = {};
    document.querySelectorAll('.ix-pages[data-ixkey]').forEach(x => { indexPages[x.dataset.ixkey] = x.textContent; });
    const lp = (book.typo || {}).lastPage || {};
    const shortEnds = lp.enabled ? shortChapterEnds(book.chapterIds || [], lp.minLines || 3) : [];
    return { clippedNotes, complete, sourceWords, pageWords, pages: flow.total, ms: Math.round(flow.performance), pageInfo, chapterPages: chapterStartPages(), targetPages: targetPages(offset), shortEnds, adjust, typo: typoReport, indexPages, lostNotes, keepNotes: options.keepNotes || [], sidenotes: window.__sidenoteReport || null };
  };

  // ---------- trecho paginado numa janela de trabalho (processo separado) ----------
  // Devolve as páginas prontas (HTML) e as folhas de estilo geradas pelo Paged.js, para a prévia montar
  // o livro sem paginar de novo. Regras que o Paged.js cria para uma página específica (pelo número
  // local da página) viram estilo da própria página: a numeração muda quando os trechos se juntam.
  window.renderSegment = async function (book, options) {
    const info = await window.renderBook(book, Object.assign({}, options, { segment: true }));
    const pages = Array.from(document.querySelectorAll('.pagedjs_page'));
    const byNum = {};
    pages.forEach(pg => { byNum[pg.dataset.pageNumber] = pg; });
    const css = [];
    Array.from(document.styleSheets).forEach(sheet => {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { return; }
      for (let i = rules.length - 1; i >= 0; i--) {
        const r = rules[i];
        const m = r.selectorText && /^\[data-page-number="(\d+)"\]$/.exec(r.selectorText.trim());
        if (m && byNum[m[1]]) { byNum[m[1]].style.cssText += ';' + r.style.cssText; try { sheet.deleteRule(i); } catch (e) { /* ok */ } }
      }
    });
    document.querySelectorAll('head style').forEach(st => {
      const sh = st.sheet;
      let text = st.textContent;
      // folhas alteradas por insertRule (o Paged.js gera regras assim) não aparecem em textContent
      try { if (sh && sh.cssRules && (!text.trim() || st.dataset.pagedjsInsertedStyles !== undefined || sh.cssRules.length)) text = Array.from(sh.cssRules).map(r => r.cssText).join('\n'); } catch (e) { /* ok */ }
      if (text && text.trim()) css.push(text);
    });
    info.pagesHtml = pages.map(pg => pg.outerHTML);
    info.css = css;
    return info;
  };

  // ---------- prévia: junta os trechos paginados em processos separados ----------
  const stage = { segs: new Map(), cssOf: new Map() };
  function hashText(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + str.length; }
  function stageContainer() {
    let root = document.getElementById('render');
    let box = root.querySelector('.pagedjs_pages');
    if (!box) { box = document.createElement('div'); box.className = 'pagedjs_pages'; root.appendChild(box); }
    return box;
  }
  // order: chaves dos trechos na ordem do livro; add: { chave: { pagesHtml, css } } com os trechos novos
  window.stageApply = function (order, add, book, options) {
    if (book) currentBook = book;
    if (options) window.setPreviewOptions(options);
    document.body.classList.add('stage');
    if (book && book.fontFaceCss && !document.getElementById('library-fonts')) {
      const st = document.createElement('style');
      st.id = 'library-fonts';
      st.textContent = book.fontFaceCss;
      document.head.appendChild(st);
    }
    const box = stageContainer();
    Object.entries(add || {}).forEach(([key, seg]) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = (seg.pagesHtml || []).join('');
      const pages = Array.from(tpl.content.children);
      pages.forEach(pg => { pg.dataset.seg = key; });
      const old = stage.segs.get(key);
      if (old) old.pages.forEach(pg => pg.remove());
      const cssKeys = (seg.css || []).map(t => { const h = hashText(t); stage.cssOf.set(h, t); return h; });
      stage.segs.set(key, { pages, cssKeys });
    });
    // trechos que saíram do livro
    Array.from(stage.segs.keys()).forEach(k => { if (!order.includes(k)) { stage.segs.get(k).pages.forEach(pg => pg.remove()); stage.segs.delete(k); } });
    // páginas na ordem do livro: só move o que está fora do lugar (mover a página com o cursor tiraria o foco)
    const want = [];
    order.forEach(k => { const sg = stage.segs.get(k); if (sg) sg.pages.forEach(pg => want.push(pg)); });
    let cur = box.firstElementChild;
    while (cur && !cur.classList.contains('pagedjs_page')) cur = cur.nextElementSibling;
    want.forEach(pg => {
      if (cur === pg) { cur = cur.nextElementSibling; return; }
      box.insertBefore(pg, cur);
    });
    // folhas de estilo: só as usadas pelos trechos atuais
    const used = new Set();
    stage.segs.forEach(sg => sg.cssKeys.forEach(h => used.add(h)));
    document.querySelectorAll('style[data-stage-css]').forEach(st => { if (!used.has(st.dataset.stageCss)) st.remove(); else used.delete(st.dataset.stageCss); });
    used.forEach(h => { const st = document.createElement('style'); st.dataset.stageCss = h; st.textContent = stage.cssOf.get(h) || ''; document.head.appendChild(st); });
    return window.stageFinalize(currentBook);
  };
  // numeração absoluta, páginas pares à esquerda, sumário/índice/referências, notas laterais, camadas e guias
  window.stageFinalize = function (book) {
    book = book || currentBook || {};
    const box = stageContainer();
    const pages = Array.from(box.querySelectorAll(':scope > .pagedjs_page'));
    pages.forEach((pg, i) => {
      const n = i + 1;
      pg.dataset.pageNumber = String(n);
      pg.id = 'page-' + n;
      const right = n % 2 === 1;
      pg.classList.toggle('pagedjs_right_page', right);
      pg.classList.toggle('pagedjs_left_page', !right);
      pg.classList.toggle('pagedjs_first_page', n === 1);
    });
    box.style.setProperty('--pagedjs-page-count', String(pages.length));
    const prev = document.getElementById('stage-counters');
    if (prev) prev.remove();
    const offset = fixPageNumbers(book.typo || {});
    const st = document.head.lastElementChild;
    if (st && st.tagName === 'STYLE' && !st.dataset.stageCss) st.id = 'stage-counters';
    document.querySelectorAll('.sn-box').forEach(b => b.remove());
    if ((book.typo || {}).notesMode === 'side') placeSidenotes(book.page);
    renderOverlays(book.overlays || []);
    document.querySelectorAll('.guide').forEach(g => g.remove());
    drawGuides(book.page);
    const indexPages = {};
    document.querySelectorAll('.ix-pages[data-ixkey]').forEach(x => { indexPages[x.dataset.ixkey] = x.textContent; });
    return {
      pages: pages.length, chapterPages: chapterStartPages(), targetPages: targetPages(offset), indexPages,
      pageInfo: pages.map(pg => ({ n: Number(pg.dataset.pageNumber), side: pg.classList.contains('pagedjs_left_page') ? 'L' : 'R', blank: pg.classList.contains('pagedjs_blank_page'), text: (pg.querySelector('.pagedjs_page_content') || pg).textContent.trim().slice(0, 30) }))
    };
  };

  // exportação: monta o livro inteiro a partir dos trechos paginados em paralelo (mesmo resultado da prévia)
  window.stageExport = function (order, add, book, options) {
    options = options || {};
    const fin = window.stageApply(order, add, book);
    document.body.classList.remove('stage');
    if (options.spreadsPrint) enablePrintSpreads(book.page);
    if (options.pageRange) hidePagesOutside(options.pageRange);
    return fin;
  };

  // O Paged.js 0.5 troca id por data-id quando divide um elemento entre páginas: procura os dois
  // (o primeiro na ordem do documento é a página onde o elemento começa)
  function byId(id) {
    if (!id) return null;
    const pages = document.querySelector('.pagedjs_pages') || document;
    return pages.querySelector(`[id="${CSS.escape(id)}"], [data-id="${CSS.escape(id)}"]`);
  }
  function eachTarget(selector, fn) {
    const seen = new Set();
    const pages = document.querySelector('.pagedjs_pages') || document;
    pages.querySelectorAll(selector.split(',').map(x => x.trim()).flatMap(x => [x + '[id]', x + '[data-id]']).join(', ')).forEach(el => {
      const id = el.id || el.dataset.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      fn(el, id);
    });
  }
  // Nota de rodapé que o Paged.js deixou fora da área de notas (ficaria escondida no PDF)
  function findClippedNotes() {
    const out = [];
    document.querySelectorAll('.pagedjs_footnote_area .footnote[data-fn]').forEach(n => {
      const box = (n.closest('.pagedjs_footnote_inner_content') || n.closest('.pagedjs_footnote_area')).getBoundingClientRect();
      const area = n.closest('.pagedjs_footnote_area').getBoundingClientRect();
      const r = n.getBoundingClientRect();
      if (r.height > 0 && (r.bottom > Math.min(box.bottom, area.bottom) + 1.5 || r.top < area.top - 1.5)) out.push(Number(n.dataset.fn));
    });
    return [...new Set(out)];
  }
  // Nota dividida entre páginas (o padrão editorial pede a nota inteira na página da chamada).
  // Notas maiores que a área útil da página não cabem inteiras em lugar nenhum: essas continuam.
  function findSplitNotes() {
    const parts = {};
    document.querySelectorAll('.pagedjs_footnote_area .footnote[data-fn]').forEach(n => {
      const i = n.dataset.fn;
      (parts[i] = parts[i] || []).push(n);
    });
    const out = [];
    Object.entries(parts).forEach(([i, list]) => {
      if (list.length < 2) return;
      const area = list[0].closest('.pagedjs_page').querySelector('.pagedjs_page_content') || list[0].closest('.pagedjs_area');
      const total = list.reduce((h, n) => h + n.getBoundingClientRect().height, 0);
      if (area && total < area.getBoundingClientRect().height * 0.8) out.push(Number(i));
    });
    return out;
  }
  // Último recurso: deixa a nota inteira visível (nada do texto pode sumir)
  function revealNote(i) {
    const n = document.querySelector(`.pagedjs_footnote_area .footnote[data-fn="${i}"]`);
    if (!n) return;
    for (let el = n.parentElement; el && !el.classList.contains('pagedjs_page'); el = el.parentElement) el.style.overflow = 'visible';
    // a nota avança sobre a margem inferior em vez de ficar escondida; a pré-impressão avisa a página
  }

  function pageOf(el) {
    const p = el && el.closest('.pagedjs_page');
    return p ? Number(p.dataset.pageNumber) : null;
  }

  function chapterStartPages() {
    const out = {};
    eachTarget('.chapter, .back-matter', (el, id) => { out[id] = pageOf(el); });
    return out;
  }

  // Página (já com a numeração do livro) de cada capítulo e título com id: usada no editor do sumário
  function targetPages(offset) {
    const out = {};
    eachTarget('.chapter, .back-matter, .chapter-body h2, .chapter-body h3, .chapter-body h4', (el, id) => { const n = pageOf(el); if (n && !out[id]) out[id] = n - (offset || 0); });
    return out;
  }

  // Numeração: opcionalmente começa em 1 no primeiro capítulo; preenche sumário e ficha.
  // devolve o id ao primeiro fragmento de cada elemento dividido (links do sumário e do PDF, rolagem)
  function restoreIds() {
    const pages = document.querySelector('.pagedjs_pages');
    if (!pages) return;
    pages.querySelectorAll('[data-id]').forEach(el => {
      const id = el.dataset.id;
      if (id && !document.getElementById(id)) el.id = id;
    });
  }
  const romanLower = n => { const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let out = ''; for (const [v, r] of map) while (n >= v) { out += r; n -= v; } return out; };
  function fixPageNumbers(typo) {
    restoreIds();
    typo = typo || {};
    const book = document.querySelector('.book');
    const first = document.querySelector('.chapter.first-chapter');
    const firstPage = first && first.closest('.pagedjs_page');
    const firstN = firstPage ? Number(firstPage.dataset.pageNumber) : 1;
    // (.first-chapter é classe: continua no primeiro fragmento mesmo sem o id)
    let offset = 0;
    if (book && book.dataset.numberFromFirst === '1' && firstPage) offset = firstN - 1;
    offset -= offset % 2; // o deslocamento é sempre par: páginas ímpares continuam à direita
    // pré-textuais em romanos (i, ii, iii…): todas as páginas antes do 1º capítulo
    const roman = !!typo.frontRoman && !!firstPage;
    const label = n => (roman && n < firstN ? romanLower(n) : String(n - offset));
    const style = document.createElement('style');
    let css = `.pagedjs_pages { counter-reset: page ${-offset} pages var(--pagedjs-page-count) !important; }`;
    if (roman) {
      const folio = typo.folio || 'outer';
      document.querySelectorAll('.pagedjs_page').forEach(pg => {
        const n = Number(pg.dataset.pageNumber);
        if (n >= firstN) return;
        const leftP = pg.classList.contains('pagedjs_left_page');
        const box = folio === 'center' ? 'bottom-center' : folio === 'top-outer' ? (leftP ? 'top-left' : 'top-right') : (leftP ? 'bottom-left' : 'bottom-right');
        css += `\n.pagedjs_page[data-page-number="${n}"] .pagedjs_margin-${box} > .pagedjs_margin-content::after { content: "${romanLower(n)}" !important; }`;
      });
    }
    style.textContent = css;
    document.head.appendChild(style);
    document.querySelectorAll('.toc-list a[href^="#"]').forEach(a => {
      const target = byId(decodeURIComponent(a.getAttribute('href').slice(1)));
      const n = pageOf(target);
      const slot = a.querySelector('.toc-page');
      if (n && slot) slot.textContent = label(n);
    });
    document.querySelectorAll('a.xref-page').forEach(a => {
      const id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
      const n = pageOf(byId(id));
      const slot = a.querySelector('.xref-n');
      if (slot) slot.textContent = n ? label(n) : '?';
    });
    // índice remissivo: páginas de cada termo marcado, com intervalos (12, 15–17, 40)
    // (cada ocorrência é uma sequência invisível ⁣dígitos⁣ no texto, colocada na montagem do livro)
    const ixPages = {};
    const IXRE = /\u2063([\u2060\u2061\u2062\u2064]+)\u2063/g;
    const DIG = { '\u2060': 0, '\u2061': 1, '\u2062': 2, '\u2064': 3 };
    const pagesRoot = document.querySelector('.pagedjs_pages');
    if (pagesRoot && document.querySelector('.ix-pages')) {
      const tw = document.createTreeWalker(pagesRoot, NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = tw.nextNode())) {
        if (tn.nodeValue.indexOf('\u2063') < 0) continue;
        const n = pageOf(tn.parentElement);
        if (!n) continue;
        let mm;
        IXRE.lastIndex = 0;
        while ((mm = IXRE.exec(tn.nodeValue))) {
          const k = [...mm[1]].reduce((acc, ch) => acc * 4 + DIG[ch], 0);
          (ixPages[k] = ixPages[k] || new Set()).add(n);
        }
      }
    }
    document.querySelectorAll('.ix-pages[data-ixk]').forEach(slot => {
      const ns = [...(ixPages[slot.dataset.ixk] || [])].sort((a, b) => a - b);
      const parts = [];
      for (let i = 0; i < ns.length; i++) {
        let j = i;
        while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1 && !(roman && ns[j + 1] === firstN)) j++;
        parts.push(j > i ? `${label(ns[i])}–${label(ns[j])}` : label(ns[i]));
        i = j;
      }
      slot.textContent = parts.join(', ') || '?';
    });
    const total = document.querySelectorAll('.pagedjs_page').length;
    const catTotal = roman && firstN > 1 ? `${romanLower(firstN - 1)}, ${total - offset}` : String(total);
    document.querySelectorAll('.cat-pages').forEach(s => { s.textContent = catTotal; });
    return offset;
  }

  // Parágrafo com nota cujo texto não está todo visível nas páginas (ficou na coluna de excesso)
  function findLostNoteParagraphs(fnParas, countWords) {
    const seen = {};
    document.querySelectorAll('.pagedjs_pages [data-fnp]').forEach(el => {
      const k = Number(el.dataset.fnp);
      const area = el.closest('.pagedjs_area');
      if (!area) return;
      const ar = area.getBoundingClientRect();
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => (t.parentElement.closest('.footnote, .sidenote, [data-note]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let n;
      while ((n = tw.nextNode())) {
        const w = countWords(n.nodeValue);
        if (!w) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const rects = Array.from(r.getClientRects()).filter(rc => rc.width >= 1);
        if (!rects.length) continue;
        const vis = rects.filter(rc => rc.top >= ar.top - Math.max(2, rc.height * 0.75) && rc.bottom <= ar.bottom + 2 && rc.left >= ar.left - 2 && rc.right <= ar.right + 2).length;
        seen[k] = (seen[k] || 0) + w * vis / rects.length;
      }
    });
    const out = [];
    fnParas.forEach((total, k) => { if (total && (seen[k] || 0) < total * 0.98) out.push(k); });
    // nota que ficou no meio do texto (fora da área de notas) e foi empurrada para fora da página
    document.querySelectorAll('.pagedjs_pages .pagedjs_page_content .footnote').forEach(fn => {
      const host = fn.closest('[data-fnp]');
      const area = fn.closest('.pagedjs_area');
      if (!host || !area) return;
      const ar = area.getBoundingClientRect();
      const out1 = Array.from(fn.getClientRects()).some(rc => rc.width >= 1 && (rc.left > ar.right + 2 || rc.bottom > ar.bottom + 2));
      const k = Number(host.dataset.fnp);
      if (out1 && !out.includes(k)) out.push(k);
    });
    return out;
  }

  // ---------- notas laterais: na margem externa, na altura da chamada ----------
  function placeSidenotes(page) {
    const report = { placed: 0, narrow: false, overflow: [] };
    if (!page) return;
    const pxmm = 96 / 25.4;
    const gap = 4;
    const w = Math.max(12, Math.min(55, page.marginOuter - gap - 5));
    report.narrow = page.marginOuter - gap - 5 < 18;
    document.querySelectorAll('.pagedjs_page').forEach(pg => {
      const calls = pg.querySelectorAll('.pagedjs_area .sn-call[data-sn]');
      if (!calls.length) return;
      const box = pg.querySelector('.pagedjs_pagebox');
      const br = box.getBoundingClientRect();
      const scale = br.width / (page.width * pxmm) || 1;
      const leftP = pg.classList.contains('pagedjs_left_page');
      const x = leftP ? page.marginOuter - gap - w : page.width - page.marginOuter + gap;
      let lastBottom = 0;
      const placed = [];
      calls.forEach(call => {
        const k = call.dataset.sn;
        const src = pg.querySelector(`.sidenote[data-sn="${k}"]`) || document.querySelector(`.pagedjs_pages .sidenote[data-sn="${k}"]`);
        if (!src) return;
        const d = document.createElement('div');
        d.className = 'sn-box ' + (leftP ? 'sn-left' : 'sn-right');
        d.innerHTML = src.innerHTML;
        let top = (call.getBoundingClientRect().top - br.top) / scale / pxmm - 0.6;
        if (top < lastBottom + 1.2) top = lastBottom + 1.2;
        d.style.cssText = `position:absolute; left:${x.toFixed(2)}mm; top:${top.toFixed(2)}mm; width:${w.toFixed(2)}mm;`;
        box.appendChild(d);
        const h = d.getBoundingClientRect().height / scale / pxmm;
        lastBottom = top + h;
        placed.push({ d, top, h });
        report.placed += 1;
      });
      // notas que passariam do pé da página sobem (sem sobrepor a anterior)
      const limit = page.height - Math.min(page.marginBottom, 12);
      let floor = limit;
      for (let i = placed.length - 1; i >= 0; i--) {
        const b = placed[i];
        if (b.top + b.h > floor) { b.top = Math.max(Math.min(page.marginTop, 15), floor - b.h); b.d.style.top = b.top.toFixed(2) + 'mm'; }
        floor = b.top - 1.2;
      }
      if (placed.length && placed[placed.length - 1].top + placed[placed.length - 1].h > limit + 0.5) report.overflow.push(Number(pg.dataset.pageNumber));
    });
    window.__sidenoteReport = report;
  }

  // ---------- última página do capítulo com poucas linhas sozinhas ----------
  function shortChapterEnds(ids, minLines) {
    const byChapter = {};
    document.querySelectorAll('.pagedjs_page').forEach(pg => {
      pg.querySelectorAll('.pagedjs_area .chapter[data-chapter]').forEach(sec => {
        const i = sec.dataset.chapter;
        const e = byChapter[i] = byChapter[i] || { pages: new Set(), last: null };
        e.pages.add(pg);
        e.last = sec;
      });
    });
    const out = [];
    Object.entries(byChapter).forEach(([i, e]) => {
      if (e.pages.size < 2 || !e.last) return;
      const body = e.last.querySelector('.chapter-body');
      if (!body || e.last.querySelector('.chapter-head')) return;
      if (body.querySelector('figure, table, img, .fig, .poem')) return;
      const p = body.querySelector('p');
      const L = p ? parseFloat(getComputedStyle(p).lineHeight) : NaN;
      if (!(L > 0)) return;
      let h = 0;
      [...body.children].forEach(c => { h += c.getBoundingClientRect().height; });
      const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const lines = Math.round(h / z / L);
      if (lines > 0 && lines < minLines) out.push({ id: ids[Number(i)], i: Number(i), lines });
    });
    return out;
  }

  // ---------- acabamento antes da paginação (medido numa cópia invisível do livro) ----------
  // 1) justificação fina: parágrafos com linhas frouxas recebem um ajuste mínimo de entreletra e de
  //    espaço entre palavras (o que menos deixar buracos e "rios"); 2) grade de linha de base: títulos,
  //    imagens, tabelas e caixas ocupam um número inteiro de linhas, e as linhas das páginas opostas
  //    ficam na mesma altura.
  function typoPrepass(tpl, book) {
    const t = book.typo || {};
    const report = { loose: 0, fixed: 0, gridded: 0 };
    if (!t.grid && !t.justify) return report;
    const st = document.createElement('style');
    st.textContent = book.css + `
.dl-measure .footnote, .dl-measure .sidenote { display: none !important; }
.dl-measure.dl-left .chapter-body p { text-align: left !important; text-align-last: auto !important; }`;
    document.head.appendChild(st);
    const root = document.createElement('div');
    root.className = 'dl-measure';
    root.style.cssText = `position:absolute; left:-200000px; top:0; width:${t.colW}mm; visibility:hidden; zoom:1;`;
    root.appendChild(tpl.content.cloneNode(true));
    document.body.appendChild(root);
    try {
      if (t.justify) justifyPass(root, tpl.content, report);
      if (t.grid) gridPass(root, tpl.content, report);
    } catch (e) { console.error('acabamento tipográfico', e); }
    root.remove();
    st.remove();
    return report;
  }

  const P_SEL = '.chapter .chapter-body p';
  function lineLooseness(p) {
    const cs = getComputedStyle(p);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight) || fs * 1.3;
    const pr = p.getBoundingClientRect();
    const right = pr.right - (parseFloat(cs.paddingRight) || 0);
    const lines = [];
    let cur = null;
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n;
    const range = document.createRange();
    while ((n = tw.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 0.5) continue;
        if (!cur || r.top > cur.top + lh * 0.5) { cur = { top: r.top, left: r.left, right: r.right }; lines.push(cur); }
        else { cur.left = Math.min(cur.left, r.left); cur.right = Math.max(cur.right, r.right); }
      }
    }
    let worst = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const L = lines[i];
      const width = L.right - L.left;
      const spaces = Math.max(1, width / (fs * 2.8) - 1);
      const extra = (right - L.right) / spaces / fs; // espaço extra por espaço, em em
      if (extra > worst) worst = extra;
    }
    return { worst, lines: lines.length };
  }
  function justifyPass(root, orig, report) {
    const mp = [...root.querySelectorAll(P_SEL)];
    const op = [...orig.querySelectorAll(P_SEL)];
    if (mp.length !== op.length) return;
    const idx = [];
    mp.forEach((p, i) => { if (getComputedStyle(p).textAlign === 'justify' && !p.closest('.poem, table, li')) idx.push(i); });
    root.classList.add('dl-left');
    const LOOSE = 0.3; // linha frouxa: mais de 0,3 em de espaço extra entre as palavras
    const base = {};
    idx.forEach(i => { base[i] = lineLooseness(mp[i]).worst; });
    let todo = idx.filter(i => base[i] > LOOSE);
    report.loose = todo.length;
    const best = {};
    todo.forEach(i => { best[i] = { v: base[i], c: null }; });
    const CANDS = [{ ls: -0.01, ws: -0.03 }, { ls: 0.01, ws: 0 }, { ls: -0.018, ws: -0.05 }, { ls: 0.016, ws: 0.02 }];
    CANDS.forEach(c => {
      todo.forEach(i => { mp[i].style.letterSpacing = c.ls + 'em'; mp[i].style.wordSpacing = c.ws + 'em'; });
      todo.forEach(i => { const v = lineLooseness(mp[i]).worst; if (v < best[i].v * 0.8) best[i] = { v, c }; });
    });
    todo.forEach(i => {
      const b = best[i];
      if (b.c) {
        op[i].style.letterSpacing = b.c.ls + 'em';
        op[i].style.wordSpacing = b.c.ws + 'em';
        mp[i].style.letterSpacing = b.c.ls + 'em';
        mp[i].style.wordSpacing = b.c.ws + 'em';
        report.fixed += 1;
      } else { mp[i].style.letterSpacing = ''; mp[i].style.wordSpacing = ''; }
    });
    root.classList.remove('dl-left');
  }
  // Grade de linha de base (medida antes da paginação, sem mexer no trabalho do Paged.js): cada bloco do
  // corpo (título, imagem, tabela, citação, caixa, lista) passa a ocupar um número inteiro de linhas e os
  // espaços entre blocos viram múltiplos da entrelinha. A altura real de cada linha é arredondada pelo
  // navegador para 1/64 px — essa é a grade de verdade.
  function gridPass(root, orig, report) {
    const ms = [...root.querySelectorAll('.chapter[data-chapter]')];
    const os = [...orig.querySelectorAll('.chapter[data-chapter]')];
    if (ms.length !== os.length) return;
    const jobs = [];
    ms.forEach((sec, k) => {
      if (Number(sec.dataset.cols) > 1) return;
      const body = sec.querySelector(':scope > .chapter-body');
      const obody = os[k].querySelector(':scope > .chapter-body');
      if (!body || !obody) return;
      const L = Math.floor(parseFloat(getComputedStyle(body).lineHeight) * 64) / 64;
      if (!(L > 4)) return;
      const items = [];
      const head = sec.querySelector(':scope > .chapter-head');
      if (head) items.push({ m: head, o: os[k].querySelector(':scope > .chapter-head'), head: true });
      const mk = [...body.children], ok = [...obody.children];
      if (mk.length !== ok.length) return;
      mk.forEach((c, i) => {
        const cs = getComputedStyle(c);
        if (cs.float !== 'none' || cs.position === 'absolute' || cs.display === 'none') return;
        items.push({ m: c, o: ok[i] });
      });
      items.forEach(it => {
        const cs = getComputedStyle(it.m);
        it.h = it.m.getBoundingClientRect().height;
        it.mt = parseFloat(cs.marginTop) || 0;
        it.mb = parseFloat(cs.marginBottom) || 0;
      });
      jobs.push({ items, L });
    });
    jobs.forEach(({ items, L }) => {
      items.forEach((it, i) => {
        if (!it.o) return;
        const next = items[i + 1];
        const gap = Math.round(Math.max(it.mb, next ? next.mt : 0) / L) * L;
        if (it.head) {
          // bloco do título com altura fixa (número inteiro de linhas, com folga): não depende de arredondamentos
          it.o.style.marginTop = (Math.round(it.mt / L) * L).toFixed(3) + 'px';
          const pad = Math.max(0, Math.ceil(it.h / L - 0.03) * L - it.h);
          it.o.style.marginBottom = (pad + gap).toFixed(3) + 'px';
        } else {
          const pad = Math.max(0, Math.ceil(it.h / L - 0.03) * L - it.h);
          it.o.style.marginTop = '0px';
          it.o.style.marginBottom = (pad + gap).toFixed(3) + 'px';
          it.o.dataset.ggap = gap.toFixed(3); // para o pedaço de um bloco dividido entre páginas
        }
        report.gridded += 1;
      });
    });
  }

  // ---------- camadas (elementos fixos na página) ----------
  function pagesFor(spec, total) {
    spec = String(spec == null ? '' : spec).trim().toLowerCase();
    const out = new Set();
    if (!spec) return out;
    if (spec === 'all' || spec === 'todas') { for (let i = 1; i <= total; i++) out.add(i); return out; }
    if (spec === 'odd' || spec === 'ímpares') { for (let i = 1; i <= total; i += 2) out.add(i); return out; }
    if (spec === 'even' || spec === 'pares') { for (let i = 2; i <= total; i += 2) out.add(i); return out; }
    spec.split(',').forEach(part => {
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(part.trim());
      if (m) for (let i = +m[1]; i <= +m[2]; i++) out.add(i);
      else if (/^\d+$/.test(part.trim())) out.add(+part.trim());
    });
    return out;
  }

  function renderOverlays(overlays) {
    document.querySelectorAll('.ov').forEach(e => e.remove());
    const pages = Array.from(document.querySelectorAll('.pagedjs_page'));
    const total = pages.length;
    overlays.forEach(o => {
      if (o.hidden) return;
      pagesFor(o.pages, total).forEach(n => {
        const pg = pages[n - 1];
        if (!pg) return;
        const box = pg.querySelector('.pagedjs_pagebox');
        const el = document.createElement('div');
        el.className = 'ov' + (o.behind ? ' ov-behind' : '');
        el.dataset.id = o.id;
        el.dataset.page = n;
        const st = el.style;
        st.position = 'absolute';
        st.left = `${o.x || 0}mm`;
        st.top = `${o.y || 0}mm`;
        st.width = `${o.w || 20}mm`;
        st.height = `${o.h || 20}mm`;
        st.transform = `rotate(${o.rot || 0}deg)`;
        st.opacity = (o.opacity == null ? 100 : o.opacity) / 100;
        st.zIndex = o.behind ? 0 : 20 + (o.z || 0);
        if (o.type === 'rect' || o.type === 'ellipse' || o.type === 'box') {
          st.background = o.fill || 'transparent';
          st.border = o.strokeWidth ? `${o.strokeWidth}pt solid ${o.stroke || '#000'}` : 'none';
          if (o.type === 'ellipse') st.borderRadius = '50%';
          if (o.radius) st.borderRadius = `${o.radius}mm`;
        } else if (o.type === 'line') {
          st.height = '0';
          st.borderTop = `${o.strokeWidth || 0.75}pt solid ${o.stroke || '#000'}`;
        } else if (o.type === 'image' && o.src) {
          const img = document.createElement('img');
          img.src = o.src;
          img.style.cssText = `width:100%;height:100%;object-fit:${o.fit || 'contain'};display:block;`;
          el.appendChild(img);
        }
        if (o.text && (o.type === 'text' || o.type === 'box')) {
          const t = document.createElement('div');
          t.textContent = o.text;
          t.style.cssText = `font-family:"${(o.font || 'EB Garamond').replace(/"/g, '')}",serif;font-size:${o.size || 12}pt;color:${o.color || '#000'};text-align:${o.align || 'left'};white-space:pre-wrap;line-height:1.25;padding:${o.type === 'box' ? '2mm' : '0'};`;
          el.appendChild(t);
        }
        box.appendChild(el);
      });
    });
  }

  // ---------- guias: corte, sangria, área segura e margens ----------
  function drawGuides(page) {
    if (!page) return;
    document.querySelectorAll('.pagedjs_page').forEach(pg => {
      const box = pg.querySelector('.pagedjs_pagebox');
      if (!box || box.querySelector('.guide')) return;
      const left = pg.classList.contains('pagedjs_left_page');
      const inner = page.marginInner, outer = page.marginOuter;
      const mk = (cls, css) => { const d = document.createElement('div'); d.className = 'guide ' + cls; d.style.cssText = css; box.appendChild(d); };
      mk('guide-trim', 'inset:0');
      if (page.bleed > 0) mk('guide-bleed', `inset:-${page.bleed}mm`);
      mk('guide-safe', `inset:${page.safety}mm`);
      mk('guide-margin', `top:${page.marginTop}mm;bottom:${page.marginBottom}mm;left:${left ? outer : inner}mm;right:${left ? inner : outer}mm`);
      mk('guide-center', 'left:50%;top:0;bottom:0;width:0');
    });
  }

  function enablePrintSpreads(page) {
    const w = page.width * 2 + page.bleed * 2;
    const h = page.height + page.bleed * 2;
    const st = document.createElement('style');
    st.textContent = `@page { size: ${w}mm ${h}mm !important; margin: 0 !important; }
      @media print {
        .pagedjs_pages { display: flex !important; flex-wrap: wrap !important; width: ${w}mm !important; }
        .pagedjs_page { break-after: auto !important; }
        .pagedjs_first_page { margin-left: calc(${w}mm / 2) !important; }
        .pagedjs_right_page { break-after: page !important; }
        .pagedjs_left_page .pagedjs_bleed-right, .pagedjs_right_page .pagedjs_bleed-left { display: none; }
      }`;
    document.head.appendChild(st);
  }

  function hidePagesOutside(range) {
    const keep = pagesFor(range, document.querySelectorAll('.pagedjs_page').length);
    if (!keep.size) return;
    document.querySelectorAll('.pagedjs_page').forEach(pg => {
      if (!keep.has(Number(pg.dataset.pageNumber))) pg.style.display = 'none';
    });
  }

  // ---------- inspeção (pré-impressão) ----------
  window.inspectBook = function (opts) {
    opts = opts || {};
    const minDpi = opts.minDpi || 300;
    const errDpi = opts.errDpi || 150;
    const issues = [];
    const images = [];
    const pages = Array.from(document.querySelectorAll('.pagedjs_page'));
    const pxPerMm = 96 / 25.4;
    const page = currentBook ? currentBook.page : null;

    document.querySelectorAll('.fig[data-asset]').forEach(fig => {
      const n = pageOf(fig);
      const wMM = fig.getBoundingClientRect().width / pxPerMm / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
      const px = Number(fig.dataset.pxWidth) || 0;
      const dpi = wMM > 0 ? Math.round(px / (wMM / 25.4)) : 0;
      images.push({ asset: fig.dataset.asset, page: n, widthMM: +wMM.toFixed(1), dpi });
      if (dpi && dpi < errDpi) issues.push({ level: 'error', type: 'dpi', page: n, asset: fig.dataset.asset, msg: `Imagem com ${dpi} dpi (mínimo aceitável ${errDpi}) na página ${n}.` });
      else if (dpi && dpi < minDpi) issues.push({ level: 'warn', type: 'dpi', page: n, asset: fig.dataset.asset, msg: `Imagem com ${dpi} dpi (recomendado ${minDpi}) na página ${n}.` });
      if (fig.hasAttribute('data-split-from') || fig.hasAttribute('data-split-to')) issues.push({ level: 'error', type: 'split', page: n, msg: `Imagem dividida entre páginas (página ${n}).` });
      const cap = fig.querySelector('figcaption');
      if (cap && pageOf(cap) !== n) issues.push({ level: 'warn', type: 'caption', page: n, msg: `Legenda separada da imagem na página ${n}.` });
    });
    document.querySelectorAll('.fig-missing').forEach(f => issues.push({ level: 'error', type: 'missing', page: pageOf(f), msg: `Imagem ausente ou referência quebrada na página ${pageOf(f)}.` }));

    pages.forEach((pg, i) => {
      const n = i + 1;
      const area = pg.querySelector('.pagedjs_page_content');
      if (area) {
        const r = area.getBoundingClientRect();
        area.querySelectorAll('img, table, .fig').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.right > r.right + 2 || b.left < r.left - 2 || b.bottom > r.bottom + 2) {
            if (!el.closest('.fullbleed') && !el.closest('.fig-behind')) issues.push({ level: 'warn', type: 'overflow', page: n, msg: `Elemento ultrapassa a mancha gráfica na página ${n}.` });
          }
        });
        // título isolado no fim da página
        const kids = area.querySelectorAll('.chapter-body > h2, .chapter-body > h3, .chapter-body > h4');
        kids.forEach(h => {
          const last = h.parentElement.lastElementChild === h;
          if (last && pageOf(h) === n) issues.push({ level: 'warn', type: 'orphan-heading', page: n, msg: `Título isolado no fim da página ${n}.` });
        });
      }
      // camadas fora da área segura / na linha de corte
      if (page) {
        const box = pg.querySelector('.pagedjs_pagebox');
        const br = box.getBoundingClientRect();
        pg.querySelectorAll('.ov').forEach(ov => {
          const b = ov.getBoundingClientRect();
          const toMM = v => v / pxPerMm;
          const l = toMM(b.left - br.left), t = toMM(b.top - br.top), rr = toMM(br.right - b.right), bb = toMM(br.bottom - b.bottom);
          const touchesTrim = [l, t, rr, bb].some(v => Math.abs(v) < 0.3);
          if (touchesTrim && page.bleed > 0) issues.push({ level: 'warn', type: 'bleed', page: n, msg: `Elemento termina exatamente na linha de corte na página ${n}: estenda até a sangria (${page.bleed} mm) para evitar filete branco.` });
          if (touchesTrim && !page.bleed) issues.push({ level: 'warn', type: 'bleed', page: n, msg: `Elemento encosta na borda da página ${n}, mas o projeto não tem sangria.` });
          const inSafe = [l, t, rr, bb].some(v => v > 0.3 && v < page.safety);
          if (inSafe && !ov.classList.contains('ov-behind')) issues.push({ level: 'info', type: 'safety', page: n, msg: `Elemento invade a área de segurança (${page.safety} mm) na página ${n}.` });
          if ([l, t, rr, bb].some(v => v < -page.bleed - 0.3)) issues.push({ level: 'warn', type: 'outside', page: n, msg: `Elemento fora da área imprimível na página ${n}.` });
        });
        if (pg.querySelector('.fullbleed') && !page.bleed) issues.push({ level: 'warn', type: 'bleed', page: n, msg: `Imagem de página inteira na página ${n} sem sangria configurada.` });
      }
    });

    // fontes
    const fonts = (currentBook && currentBook.fonts || []).map(f => ({ family: f, loaded: document.fonts.check(`12px "${f}"`) }));
    fonts.filter(f => !f.loaded).forEach(f => issues.push({ level: 'error', type: 'font', msg: `Fonte “${f.family}” não encontrada: será substituída na exportação.` }));
    return { pages: pages.length, issues, images, fonts };
  };

  window.scrollToId = function (id) {
    const el = document.getElementById(id);
    const page = el && el.closest('.pagedjs_page');
    if (page) page.scrollIntoView({ block: 'start' });
  };

  window.scrollToPage = function (n) {
    const page = document.querySelectorAll('.pagedjs_page')[n - 1];
    if (page) {
      page.scrollIntoView({ block: 'center' });
      page.classList.add('flash');
      setTimeout(() => page.classList.remove('flash'), 1600);
    }
  };

  window.setPreviewOptions = function (options) {
    const mode = options.mode === 'overview' ? 'cols4' : options.mode;
    document.body.classList.toggle('single', mode === 'single');
    ['cols2', 'cols3', 'cols4', 'cols5'].forEach(c => document.body.classList.toggle(c, mode === c));
    document.body.classList.toggle('grid', /^cols/.test(mode || ''));
    document.body.classList.toggle('guides', !!options.guides);
    document.body.classList.toggle('gray', !!options.gray);
  };

  window.updateOverlays = function (overlays) { renderOverlays(overlays); };

  // Diagnóstico: texto do corpo desenhado fora da área visível da página (seria cortado)
  window.findClippedText = function () {
    const out = [];
    document.querySelectorAll('.pagedjs_page').forEach(pg => {
      const area = pg.querySelector('.pagedjs_page_content');
      if (!area) return;
      const ar = area.getBoundingClientRect();
      const tw = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        if (!n.nodeValue.trim() || n.parentElement.closest('.pagedjs_footnote_area, .fullbleed, .ov')) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        for (const rc of r.getClientRects()) {
          if (rc.width < 1) continue;
          const below = rc.bottom - ar.bottom, right = rc.left - ar.right;
          if (below > 1 && right < 0) { out.push({ page: Number(pg.dataset.pageNumber), below: Math.round(below), text: n.nodeValue.trim().slice(0, 40) }); break; }
        }
      }
    });
    return out;
  };
})();
