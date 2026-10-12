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

    const target = document.getElementById('render');
    const previewer = new Paged.Previewer();
    const flow = await previewer.preview(tpl.content, [{ [location.href]: book.css }], target);
    fixPageNumbers();
    renderOverlays(book.overlays || []);
    drawGuides(book.page);
    if (options.spreadsPrint) enablePrintSpreads(book.page);
    if (options.pageRange) hidePagesOutside(options.pageRange);
    const pageInfo = Array.from(document.querySelectorAll('.pagedjs_page')).map(pg => ({
      n: Number(pg.dataset.pageNumber),
      side: pg.classList.contains('pagedjs_left_page') ? 'L' : 'R',
      blank: pg.classList.contains('pagedjs_blank_page'),
      text: (pg.querySelector('.pagedjs_page_content') || pg).textContent.trim().slice(0, 30)
    }));
    return { pages: flow.total, ms: Math.round(flow.performance), pageInfo, chapterPages: chapterStartPages() };
  };

  function pageOf(el) {
    const p = el && el.closest('.pagedjs_page');
    return p ? Number(p.dataset.pageNumber) : null;
  }

  function chapterStartPages() {
    const out = {};
    document.querySelectorAll('.chapter[id], .back-matter[id]').forEach(el => { out[el.id] = pageOf(el); });
    return out;
  }

  // Numeração: opcionalmente começa em 1 no primeiro capítulo; preenche sumário e ficha.
  function fixPageNumbers() {
    const book = document.querySelector('.book');
    const first = document.querySelector('.chapter.first-chapter');
    const firstPage = first && first.closest('.pagedjs_page');
    let offset = 0;
    if (book && book.dataset.numberFromFirst === '1' && firstPage) offset = Number(firstPage.dataset.pageNumber) - 1;
    const style = document.createElement('style');
    style.textContent = `.pagedjs_pages { counter-reset: page ${-offset} pages var(--pagedjs-page-count) !important; }`;
    document.head.appendChild(style);
    document.querySelectorAll('.toc-list a[href^="#"]').forEach(a => {
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      const n = pageOf(target);
      const slot = a.querySelector('.toc-page');
      if (n && slot) slot.textContent = String(n - offset);
    });
    const total = document.querySelectorAll('.pagedjs_page').length;
    document.querySelectorAll('.cat-pages').forEach(s => { s.textContent = String(total); });
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
    document.body.classList.toggle('single', options.mode === 'single');
    document.body.classList.toggle('overview', options.mode === 'overview');
    document.body.classList.toggle('guides', !!options.guides);
    document.body.classList.toggle('gray', !!options.gray);
  };

  window.updateOverlays = function (overlays) { renderOverlays(overlays); };
})();
