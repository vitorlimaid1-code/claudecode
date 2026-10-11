/* global Paged */
// Renderiza o livro em páginas com Paged.js.
// Chamado pela janela do editor (iframe) e pela janela oculta de exportação para PDF.
(function () {
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
    document.body.classList.toggle('single', !!options.single);
    document.body.classList.toggle('guides', !!options.guides);
    await loadFonts(book.fonts || []);

    const tpl = document.createElement('template');
    tpl.innerHTML = book.html;

    const target = document.getElementById('render');
    const previewer = new Paged.Previewer();
    const flow = await previewer.preview(tpl.content, [{ [location.href]: book.css }], target);
    fixPageNumbers();
    const pageInfo = Array.from(document.querySelectorAll('.pagedjs_page')).map(pg => ({
      n: Number(pg.dataset.pageNumber),
      side: pg.classList.contains('pagedjs_left_page') ? 'L' : 'R',
      blank: pg.classList.contains('pagedjs_blank_page'),
      text: (pg.querySelector('.pagedjs_page_content') || pg).textContent.trim().slice(0, 30)
    }));
    return { pages: flow.total, ms: Math.round(flow.performance), pageInfo };
  };

  // Numeração: opcionalmente começa em 1 no primeiro capítulo e preenche o sumário.
  // (Feito após a paginação porque o counter-reset do Paged.js não é confiável no Chromium atual.)
  function fixPageNumbers() {
    const book = document.querySelector('.book');
    const first = document.querySelector('.chapter.first-chapter');
    const firstPage = first && first.closest('.pagedjs_page');
    let offset = 0;
    if (book && book.dataset.numberFromFirst === '1' && firstPage) {
      offset = Number(firstPage.dataset.pageNumber) - 1;
    }
    const style = document.createElement('style');
    style.textContent = `.pagedjs_pages { counter-reset: page ${-offset} pages var(--pagedjs-page-count) !important; }`;
    document.head.appendChild(style);
    document.querySelectorAll('.toc-list a[href^="#"]').forEach(a => {
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      const page = target && target.closest('.pagedjs_page');
      const slot = a.querySelector('.toc-page');
      if (page && slot) slot.textContent = String(Number(page.dataset.pageNumber) - offset);
    });
  }

  window.scrollToId = function (id) {
    const el = document.getElementById(id);
    const page = el && el.closest('.pagedjs_page');
    if (page) page.scrollIntoView({ block: 'start' });
  };

  window.setPreviewOptions = function (options) {
    document.body.classList.toggle('single', !!options.single);
    document.body.classList.toggle('guides', !!options.guides);
  };
})();
