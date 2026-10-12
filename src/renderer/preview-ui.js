/* global App */
// Prévia paginada: renderização em segundo plano, zoom, modos, guias, seleção de página,
// arraste de camadas com encaixe e soltura de imagens diretamente nas páginas.
(function () {
  const { $, $$ } = App;
  let active = null;
  let timer = null;
  let rendering = false;
  let queued = false;
  let zoom = 0.5;
  try { zoom = parseFloat(localStorage.getItem('zoom')) || 0.5; } catch (e) { /* ok */ }

  const P = App.preview = { currentPage: 1 };

  P.schedule = function (immediate) {
    if (!$('#autoRefresh').checked && !immediate) { $('#pageInfo').textContent = 'Alterações pendentes — clique em Atualizar'; return; }
    clearTimeout(timer);
    timer = setTimeout(render, immediate ? 0 : 900);
  };

  function opts() {
    return { mode: $('#previewMode').value, guides: $('#guides').checked, gray: $('#gray').checked };
  }

  async function render() {
    if (rendering) { queued = true; return; }
    rendering = true;
    App.flush();
    $('#previewBusy').classList.add('show');
    const frame = document.createElement('iframe');
    frame.className = 'preview-frame loading';
    frame.src = 'preview.html';
    $('#previewFrames').appendChild(frame);
    try {
      await new Promise((res, rej) => { frame.onload = res; frame.onerror = rej; });
      const book = await App.api.buildBook(App.serialize());
      book.overlays = App.layers.resolved();
      // mesma estratégia da exportação: a prévia mostra exatamente o que sai no PDF
      const again = async o => { frame.src = 'preview.html?' + Date.now(); await new Promise((res, rej) => { frame.onload = res; frame.onerror = rej; }); return frame.contentWindow.renderBook(book, Object.assign(opts(), o)); };
      const better = (a, b) => !b || (a.complete && !b.complete) || (a.complete === b.complete && a.clippedNotes.length < b.clippedNotes.length);
      let info = await frame.contentWindow.renderBook(book, Object.assign(opts(), { notePolicy: 'line' }));
      let best = info, bestO = { notePolicy: 'line' }, lastO = bestO;
      for (const o of [{ notePolicy: 'block' }, { notePolicy: '' }]) {
        if (best.complete && !best.clippedNotes.length) break;
        if (o.notePolicy === '' && best.clippedNotes.length) o.lineNotes = best.clippedNotes;
        info = await again(o); lastO = o;
        if (better(info, best)) { best = info; bestO = o; }
      }
      if (lastO !== bestO || best.clippedNotes.length) { info = await again(Object.assign({}, bestO, { showClippedNotes: true })); if (info.clippedNotes.length) info.revealedNotes = info.clippedNotes; }
      else info = best;
      const prev = active;
      let ratio = 0;
      if (prev && prev.contentDocument) { const se = prev.contentDocument.scrollingElement; ratio = se.scrollHeight ? se.scrollTop / se.scrollHeight : 0; }
      applyZoom(frame);
      const se = frame.contentDocument.scrollingElement;
      se.scrollTop = ratio * se.scrollHeight;
      frame.classList.remove('loading');
      if (prev) prev.remove();
      active = frame;
      wire(frame);
      try { frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme; } catch (e) { /* ok */ }
      App.lastRender = info;
      if (P.fitNext) { P.fitNext = false; setTimeout(P.fit, 30); }
      App.lastRender.missingFonts = book.missingFonts;
      $('#pageInfo').textContent = `${info.pages} páginas${book.missingFonts && book.missingFonts.length ? ' · ⚠ fonte ausente' : ''}${book.missingAssets && book.missingAssets.length ? ' · ⚠ imagem ausente' : ''}`;
      P.setLayerEditing(App.view === 'layers');
      P.highlightLayers([...App.layers.sel]);
      markCurrent();
      App.updateWordCount();
      App.hooks.afterChange.forEach(fn => { try { fn({ rendered: true }); } catch (e) { /* ok */ } });
    } catch (err) {
      console.error(err);
      frame.remove();
      $('#pageInfo').textContent = 'Erro ao paginar';
    } finally {
      $('#previewBusy').classList.remove('show');
      rendering = false;
      if (queued) { queued = false; render(); }
    }
  }

  function applyZoom(frame) {
    frame = frame || active;
    $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
    if (frame && frame.contentDocument) { frame.contentDocument.documentElement.style.zoom = zoom; frame.contentDocument.documentElement.style.setProperty('--tools-zoom', String(Math.min(2.5, 1 / zoom))); }
  }

  const doc = () => (active && active.contentDocument) || null;
  const win = () => (active && active.contentWindow) || null;

  P.scrollTo = id => { try { win() && win().scrollToId(id); } catch (e) { /* ok */ } };
  P.goToPage = n => { P.currentPage = n; markCurrent(); try { win() && win().scrollToPage(n); } catch (e) { /* ok */ } };
  P.updateOverlays = list => { try { win() && win().updateOverlays(list); P.highlightLayers([...App.layers.sel]); } catch (e) { /* ok */ } };
  // volta ao modo padrão (ao abrir/criar/importar um livro)
  P.resetMode = () => {
    const sel = $('#previewMode');
    P.fitNext = true;
    if (sel.value === 'single') return;
    sel.value = 'single';
    try { win() && win().setPreviewOptions(opts()); } catch (e) { /* ok */ }
    setTimeout(P.fit, 60);
  };
  P.refreshTools = () => { const d = doc(); if (d) App.pageTools.attach(d); };
  // zoom que faz caber 1, 2, 3, 4 ou 5 páginas na largura da prévia
  P.fit = () => {
    const d = doc();
    const pg = d && d.querySelector('.pagedjs_page');
    if (!pg) return;
    const mode = $('#previewMode').value;
    const n = mode === 'single' ? 1 : mode === 'spread' ? 2 : Number(mode.replace('cols', '')) || 1;
    const avail = $('#previewFrames').clientWidth - 40 - (mode === 'single' ? 120 : 0);
    const w = pg.offsetWidth * n + 22 * (n - 1) + 40;
    zoom = Math.max(0.15, Math.min(2.5, +(avail / w).toFixed(2)));
    applyZoom();
  };
  P.setLayerEditing = on => { const d = doc(); if (d) d.body.classList.toggle('edit-layers', !!on); };
  P.inspect = o => (win() ? win().inspectBook(o) : null);

  function markCurrent() {
    const d = doc();
    if (!d) return;
    d.querySelectorAll('.pagedjs_page.current').forEach(p => p.classList.remove('current'));
    const pg = d.querySelectorAll('.pagedjs_page')[P.currentPage - 1];
    if (pg) pg.classList.add('current');
  }

  P.highlightLayers = function (ids) {
    const d = doc();
    if (!d) return;
    d.querySelectorAll('.ov').forEach(e => e.classList.toggle('selected', ids.includes(e.dataset.id)));
    d.querySelectorAll('.ov-handle').forEach(h => h.remove());
    if (ids.length === 1 && App.view === 'layers') {
      const o = App.layers.byId(ids[0]);
      if (o && !o.locked) d.querySelectorAll(`.ov[data-id="${ids[0]}"]`).forEach(e => { const h = d.createElement('div'); h.className = 'ov-handle'; e.appendChild(h); });
    }
  };

  // ---------------------------------------------------------------- interação com as páginas
  function pageAt(d, x, y) {
    const el = d.elementFromPoint(x, y);
    const pg = el && el.closest('.pagedjs_page');
    return pg || null;
  }
  function mmIn(pg, x, y) {
    const box = pg.querySelector('.pagedjs_pagebox').getBoundingClientRect();
    const s = App.project.settings;
    return { x: (x - box.left) / box.width * s.pageWidth, y: (y - box.top) / box.height * s.pageHeight, scale: box.width / s.pageWidth };
  }

  function wire(frame) {
    const d = frame.contentDocument;
    const st = d.createElement('style');
    st.textContent = '.pagedjs_page.current { outline: 2px solid rgba(197,106,63,.55); outline-offset: 2px; } .ov-handle { position:absolute; right:-5px; bottom:-5px; width:10px; height:10px; background:#d9822b; border:1px solid #fff; cursor:nwse-resize; pointer-events:auto; }';
    d.head.appendChild(st);
    App.pageTools.attach(d);

    d.addEventListener('mousedown', e => {
      const pg = pageAt(d, e.clientX, e.clientY);
      if (!pg) return;
      const n = Number(pg.dataset.pageNumber);
      if (P.currentPage !== n) { P.currentPage = n; markCurrent(); if (App.view === 'layers') App.layers.render(); }
      if (App.view !== 'layers') return;
      const handle = e.target.closest('.ov-handle');
      const ovEl = e.target.closest('.ov');
      if (!ovEl) { if (!e.ctrlKey && !e.shiftKey) App.layers.clear(); return; }
      e.preventDefault();
      const id = ovEl.dataset.id;
      if (!App.layers.sel.has(id)) App.layers.select([id], e.ctrlKey || e.shiftKey);
      const o = App.layers.byId(id);
      if (!o || o.locked) { if (o && o.locked) App.toast('Elemento bloqueado.'); return; }
      const start = mmIn(pg, e.clientX, e.clientY);
      const box = pg.querySelector('.pagedjs_pagebox');
      const moving = handle ? [o] : App.layers.moveBy(0, 0);
      const orig = moving.map(m => ({ m, x: m.x, y: m.y, w: m.w, h: m.h }));
      const snapT = App.layers.snapTargets(n, moving.map(m => m.id));
      let lines = [];
      const clearLines = () => { lines.forEach(l => l.remove()); lines = []; };
      const line = (vertical, mm) => {
        const l = d.createElement('div');
        l.className = 'snap-line';
        if (vertical) Object.assign(l.style, { left: mm + 'mm', top: '-10mm', bottom: '-10mm', width: '1px' });
        else Object.assign(l.style, { top: mm + 'mm', left: '-10mm', right: '-10mm', height: '1px' });
        box.appendChild(l);
        lines.push(l);
      };
      const TH = 1.5;
      const onMove = ev => {
        const p = mmIn(pg, ev.clientX, ev.clientY);
        let dx = p.x - start.x;
        let dy = p.y - start.y;
        clearLines();
        if (handle) {
          let w = Math.max(2, orig[0].w + dx);
          let h = Math.max(0, orig[0].h + dy);
          if (ev.shiftKey && orig[0].w) h = w * orig[0].h / orig[0].w;
          o.w = Math.round(w * 100) / 100; o.h = Math.round(h * 100) / 100;
        } else {
          if (!ev.altKey) {
            const pr = orig.find(x => x.m === o) || orig[0];
            const cx = [pr.x + dx, pr.x + dx + pr.w / 2, pr.x + dx + pr.w];
            const cy = [pr.y + dy, pr.y + dy + pr.h / 2, pr.y + dy + pr.h];
            let bx = null, by = null;
            cx.forEach(c => snapT.xs.forEach(t => { if (Math.abs(c - t) < TH && (bx === null || Math.abs(c - t) < Math.abs(bx.d))) bx = { d: t - c, t }; }));
            cy.forEach(c => snapT.ys.forEach(t => { if (Math.abs(c - t) < TH && (by === null || Math.abs(c - t) < Math.abs(by.d))) by = { d: t - c, t }; }));
            if (bx) { dx += bx.d; line(true, bx.t); }
            if (by) { dy += by.d; line(false, by.t); }
          }
          orig.forEach(r => { r.m.x = Math.round((r.x + dx) * 100) / 100; r.m.y = Math.round((r.y + dy) * 100) / 100; });
        }
        moving.forEach(m => d.querySelectorAll(`.ov[data-id="${m.id}"]`).forEach(elx => { elx.style.left = m.x + 'mm'; elx.style.top = m.y + 'mm'; elx.style.width = m.w + 'mm'; if (m.type !== 'line') elx.style.height = m.h + 'mm'; }));
      };
      const onUp = () => {
        d.removeEventListener('mousemove', onMove);
        d.removeEventListener('mouseup', onUp);
        clearLines();
        const changed = orig.some(r => r.m.x !== r.x || r.m.y !== r.y || r.m.w !== r.w || r.m.h !== r.h);
        if (changed) App.layers.changed(handle ? 'Redimensionar camada' : 'Mover camada');
      };
      d.addEventListener('mousemove', onMove);
      d.addEventListener('mouseup', onUp);
    });

    // duplo clique numa página abre o capítulo correspondente no editor
    d.addEventListener('dblclick', e => {
      if (App.view === 'layers') return;
      const ch = e.target.closest && e.target.closest('[data-chapter]');
      if (!ch) return;
      const c = App.project.chapters[Number(ch.dataset.chapter)];
      if (c) App.setView('chapter', c.id);
    });

    // soltar imagens numa página cria uma camada fixa naquela posição
    d.addEventListener('dragover', e => {
      const types = Array.from(e.dataTransfer.types);
      if (!types.some(t => /x-dl-library|x-dl-asset|x-dl-separator|x-dl-element|Files/.test(t))) return;
      e.preventDefault();
      const pg = pageAt(d, e.clientX, e.clientY);
      d.querySelectorAll('.drop-ghost').forEach(g => g.remove());
      const valid = pg && !types.includes('application/x-dl-separator');
      e.dataTransfer.dropEffect = valid ? 'copy' : 'none';
      if (!pg) return;
      const p = mmIn(pg, e.clientX, e.clientY);
      const g = d.createElement('div');
      g.className = 'drop-ghost';
      Object.assign(g.style, { left: (p.x - 25) + 'mm', top: (p.y - 18) + 'mm', width: '50mm', height: '36mm', outlineColor: valid ? '#d9822b' : '#c0392b' });
      pg.querySelector('.pagedjs_pagebox').appendChild(g);
    });
    d.addEventListener('dragleave', e => { if (!e.relatedTarget) d.querySelectorAll('.drop-ghost').forEach(g => g.remove()); });
    d.addEventListener('drop', async e => {
      d.querySelectorAll('.drop-ghost').forEach(g => g.remove());
      const pg = pageAt(d, e.clientX, e.clientY);
      if (!pg) return;
      e.preventDefault();
      if (Array.from(e.dataTransfer.types).includes('application/x-dl-separator')) return App.toast('Separadores são usados abaixo dos títulos dos capítulos.');
      const elKind = e.dataTransfer.getData('application/x-dl-element');
      const p = mmIn(pg, e.clientX, e.clientY);
      const n = Number(pg.dataset.pageNumber);
      // solto sobre o texto de um capítulo: a imagem entra no fluxo e o texto se reorganiza
      const hit = d.elementFromPoint(e.clientX, e.clientY);
      const body = hit && hit.closest('.chapter-body');
      const sec = hit && hit.closest('[data-chapter]');
      if (body && sec) {
        let blk = hit;
        while (blk && blk.parentElement !== body) blk = blk.parentElement;
        const ch = App.project.chapters[Number(sec.dataset.chapter)];
        if (ch && ch.locked) return App.toast('Capítulo bloqueado: desbloqueie no cadeado para inserir imagens.');
        if (elKind) {
          // tabela, gráfico ou elemento extra: entra no fluxo do texto onde foi solto
          const r0 = blk ? blk.getBoundingClientRect() : null;
          const before0 = r0 ? e.clientY < r0.top + r0.height / 2 : false;
          const probe = blk ? blk.textContent : '';
          const html = await App.elements.makeElement(elKind);
          if (!html || html === 'updated') return;
          if (App.elements.insertHtmlIntoChapter(ch, probe, before0, html)) {
            App.changed(App.elements.byKind(elKind).label + ' inserido(a) em “' + ch.title + '”');
            App.toast('Elemento inserido no texto. A paginação é refeita.');
          }
          return;
        }
        const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
        if (!ids || !ids.length) return;
        const r = blk ? blk.getBoundingClientRect() : null;
        const before = r ? e.clientY < r.top + r.height / 2 : false;
        const zone = App.editor.zoneAt(e.clientX, body.getBoundingClientRect());
        if (App.editor.insertIntoChapter(ch, blk ? blk.textContent : '', before, ids, zone)) {
          App.changed('Imagem inserida no texto de “' + ch.title + '”');
          App.toast(`Imagem inserida no texto (${zone === 'left' ? 'à esquerda, com texto ao redor' : zone === 'right' ? 'à direita, com texto ao redor' : 'centralizada'}). A paginação é refeita.`);
        }
        return;
      }
      if (elKind) return App.toast('Solte o elemento sobre o texto de um capítulo: ele entra no fluxo naquele ponto.', 5000);
      const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
      if (!ids || !ids.length) return;
      let off = 0;
      for (const id of ids) { await App.layers.addImage(id, n, p.x + off, p.y + off); off += 6; }
      App.toast(`Imagem fixada na página ${n} (Camadas da página).`);
      if (App.view !== 'layers') App.setView('layers');
    });
  }

  P.setup = function () {
    $('#zoomIn').addEventListener('click', () => { zoom = Math.min(2.5, +(zoom + 0.1).toFixed(2)); applyZoom(); });
    $('#zoomOut').addEventListener('click', () => { zoom = Math.max(0.15, +(zoom - 0.1).toFixed(2)); applyZoom(); });
    $('#refresh').addEventListener('click', () => P.schedule(true));
    $('#autoRefresh').addEventListener('change', e => { if (e.target.checked) P.schedule(true); });
    const setOpts = () => { try { win() && win().setPreviewOptions(opts()); } catch (e) { /* ok */ } };
    ['#previewMode', '#guides', '#gray'].forEach(s => $(s).addEventListener('change', setOpts));
    // padrão: sempre 1 página por vez, rolando na vertical; outros modos só quando o usuário escolhe
    $('#previewMode').value = 'single';
    P.fitNext = true;
    $('#previewMode').addEventListener('change', () => setTimeout(P.fit, 60));
    $('#zoomFit').addEventListener('click', () => P.fit());
    $('#insertBleedPage').addEventListener('click', () => App.pageTools.insertBleedPage(null));
    const splitter = $('#splitter');
    splitter.addEventListener('mousedown', e => {
      e.preventDefault();
      const layout = $('.layout');
      $$('.preview-frame').forEach(f => { f.style.pointerEvents = 'none'; });
      const move = ev => {
        const r = layout.getBoundingClientRect();
        const w = Math.min(Math.max(r.right - ev.clientX, 320), r.width - 700);
        document.documentElement.style.setProperty('--preview-w', w + 'px');
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        $$('.preview-frame').forEach(f => { f.style.pointerEvents = ''; });
        try { localStorage.setItem('previewWidth', getComputedStyle(document.documentElement).getPropertyValue('--preview-w')); } catch (err) { /* ok */ }
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    try { const w = localStorage.getItem('previewWidth'); if (w) document.documentElement.style.setProperty('--preview-w', w); } catch (e) { /* ok */ }
    window.addEventListener('beforeunload', () => { try { localStorage.setItem('zoom', String(zoom)); } catch (e) { /* ok */ } });
    $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  };
})();
