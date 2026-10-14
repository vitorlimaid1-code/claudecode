/* global App */
// Imagens direto nas páginas:
// - soltar uma imagem em qualquer ponto de uma página de capítulo (sobre o texto, margens, em cima de outra
//   imagem): ela entra no fluxo naquele ponto e o texto continua ao redor (lateral) ou acima/abaixo (centro);
// - arrastar uma imagem já no livro para outro ponto (até outro capítulo);
// - clicar numa imagem: alças para aumentar/reduzir e o painel (legenda, caixa de texto, recorte, fundo);
// - remover o fundo da imagem, no próprio computador.
(function () {
  const { el, $ } = App;
  const MOVE = 'application/x-dl-move';

  // ---------------------------------------------------------------- modelo do capítulo
  function withChapterDom(c, fn) {
    App.flush();
    if (App.editorChapterId === c.id && App.view === 'chapter') {
      const ed = $('#editor');
      const r = fn(ed);
      App.editor.decorate(ed);
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      return r;
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = c.html || '';
    const r = fn(tpl.content);
    c.html = tpl.innerHTML;
    App.changed(null);
    return r;
  }
  function zoneOpts(zone) {
    if (zone === 'left') return { align: 'left', wrap: 'square', width: 40 };
    if (zone === 'right') return { align: 'right', wrap: 'square', width: 40 };
    return { align: 'center', wrap: 'none' };
  }

  // ---------------------------------------------------------------- ponto de inserção
  // bloco mais próximo do ponto (na página), antes/depois e lado (esquerda | centro | direita)
  function dropTarget(d, x, y) {
    const hit = d.elementFromPoint(x, y);
    const pg = hit && hit.closest('.pagedjs_page');
    if (!pg) return null;
    const bodies = Array.from(pg.querySelectorAll('section[data-chapter] > .chapter-body'));
    if (!bodies.length) return null;
    let best = null, bestD = Infinity;
    bodies.forEach(b => Array.from(b.children).forEach(blk => {
      if (blk.dataset.src === undefined) return;
      const r = blk.getBoundingClientRect();
      if (!r.height) return;
      const dd = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (dd < bestD) { bestD = dd; best = { blk, r }; }
    }));
    if (!best) return null;
    const sec = best.blk.closest('section[data-chapter]');
    const ch = App.project.chapters[Number(sec.dataset.chapter)];
    if (!ch) return null;
    const br = best.blk.closest('.chapter-body').getBoundingClientRect();
    const rel = (x - br.left) / (br.width || 1);
    const zone = rel < 0.33 ? 'left' : rel > 0.67 ? 'right' : 'center';
    // num parágrafo que continua da página anterior, “antes” seria lá atrás: aqui conta como “depois”
    let before = y < best.r.top + best.r.height / 2;
    if (before && best.blk.hasAttribute('data-split-from')) before = false;
    return { ch, idx: Number(best.blk.dataset.src), before, zone, blk: best.blk, page: pg };
  }
  function showIndicator(d, t) {
    hideIndicator(d);
    if (!t) return;
    const box = t.page.querySelector('.pagedjs_pagebox');
    const bx = box.getBoundingClientRect();
    const k = bx.width / (box.offsetWidth || bx.width) || 1;
    const r = t.blk.getBoundingClientRect();
    const body = t.blk.closest('.chapter-body').getBoundingClientRect();
    const line = d.createElement('div');
    line.className = 'drop-line';
    const top = ((t.before ? r.top : r.bottom) - bx.top) / k;
    const left = (body.left - bx.left) / k, w = body.width / k;
    const part = t.zone === 'center' ? [left, w] : t.zone === 'left' ? [left, w * 0.42] : [left + w * 0.58, w * 0.42];
    Object.assign(line.style, { position: 'absolute', left: part[0] + 'px', width: part[1] + 'px', top: (top - 2) + 'px', height: '4px', borderRadius: '3px', background: 'linear-gradient(90deg,#6d28d9,#c026d3,#f43f5e)', boxShadow: '0 0 0 3px rgba(192,38,211,.18)', zIndex: 60, pointerEvents: 'none' });
    const tag = d.createElement('div');
    tag.className = 'drop-line';
    tag.textContent = t.zone === 'center' ? 'imagem aqui · texto acima e abaixo' : t.zone === 'left' ? 'imagem à esquerda · texto ao lado' : 'imagem à direita · texto ao lado';
    Object.assign(tag.style, { position: 'absolute', left: part[0] + 'px', top: (top + 6) + 'px', font: '600 11px system-ui, sans-serif', color: '#fff', background: '#6d28d9', padding: '2px 8px', borderRadius: '8px', zIndex: 61, pointerEvents: 'none', whiteSpace: 'nowrap' });
    box.appendChild(line);
    box.appendChild(tag);
  }
  function hideIndicator(d) { d.querySelectorAll('.drop-line').forEach(x => x.remove()); }

  // insere o HTML junto do bloco (posição no texto do capítulo)
  function insertAt(ch, idx, before, html) {
    if (!ch || ch.locked) { App.toast('Capítulo bloqueado: desbloqueie no cadeado.'); return false; }
    return withChapterDom(ch, root => {
      const ref = root.children[idx];
      const t = document.createElement('template');
      t.innerHTML = html;
      if (!ref) root.appendChild(t.content);
      else if (before) ref.before(t.content);
      else ref.after(t.content);
      return true;
    });
  }
  // move uma imagem do livro para outro ponto (mesmo capítulo ou outro)
  function moveFigure(from, to) {
    if (!from.ch || !to.ch || from.ch.locked || to.ch.locked) { App.toast('Capítulo bloqueado.'); return false; }
    let html = null, opts = null;
    withChapterDom(from.ch, root => {
      const fig = root.children[from.idx];
      if (!fig || !fig.matches('figure')) return;
      const c = fig.cloneNode(true);
      c.classList.remove('selected');
      ['style', 'contenteditable', 'draggable'].forEach(a => c.removeAttribute(a));
      c.querySelectorAll('img').forEach(i => { i.removeAttribute('style'); i.removeAttribute('src'); });
      html = c;
      fig.remove();
    });
    if (!html) return false;
    // lado escolhido ao soltar (o contorno da forma é mantido nas laterais)
    opts = zoneOpts(to.zone);
    html.setAttribute('data-align', opts.align);
    html.setAttribute('data-wrap', to.zone !== 'center' && html.dataset.wrap === 'contour' ? 'contour' : opts.wrap);
    if (opts.width && Number(html.dataset.width) > 50) html.setAttribute('data-width', String(opts.width));
    let idx = to.idx;
    if (from.ch === to.ch && from.idx < to.idx) idx -= 1;
    return insertAt(to.ch, idx, to.before, html.outerHTML);
  }

  // ---------------------------------------------------------------- eventos nas páginas
  function wire(d) {
    if (d.__imgWired) return;
    d.__imgWired = true;
    const st = d.createElement('style');
    st.textContent = `
      .chapter-body figure.fig { cursor: grab; }
      .chapter-body figure.fig.img-sel { outline: 2px solid #c026d3; outline-offset: 3px; }
      .img-handle { position: absolute; width: 12px; height: 12px; background: #fff; border: 2px solid #c026d3; border-radius: 50%; z-index: 62; cursor: ew-resize; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
      .img-size { position: absolute; z-index: 62; font: 600 11px system-ui, sans-serif; color: #fff; background: #c026d3; padding: 2px 7px; border-radius: 8px; pointer-events: none; }`;
    d.head.appendChild(st);

    d.addEventListener('dragstart', e => {
      const fig = e.target.closest && e.target.closest('.chapter-body > figure.fig[data-src]');
      if (!fig || App.view === 'layers') return;
      const sec = fig.closest('section[data-chapter]');
      e.dataTransfer.setData(MOVE, JSON.stringify({ ch: Number(sec.dataset.chapter), idx: Number(fig.dataset.src) }));
      e.dataTransfer.effectAllowed = 'move';
      clearSelection(d);
    });
    // dragover/drop: antes do tratamento da prévia (que cria camadas fora do texto)
    // arrastar sem travar: o ponto de inserção é recalculado no máximo uma vez por quadro
    let lastT = null, pending = false, lastXY = null;
    d.addEventListener('dragover', e => {
      if (App.view === 'layers') return;
      const types = Array.from(e.dataTransfer.types);
      if (!types.some(t => /x-dl-move|x-dl-library|x-dl-asset|Files/.test(t))) { hideIndicator(d); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      e.dataTransfer.dropEffect = types.includes(MOVE) ? 'move' : 'copy';
      lastXY = [e.clientX, e.clientY];
      if (pending) return;
      pending = true;
      d.defaultView.requestAnimationFrame(() => {
        pending = false;
        const t = dropTarget(d, lastXY[0], lastXY[1]);
        if (lastT && t && lastT.blk === t.blk && lastT.before === t.before && lastT.zone === t.zone) return;
        lastT = t;
        d.querySelectorAll('.drop-ghost').forEach(g => g.remove());
        if (t) showIndicator(d, t); else hideIndicator(d);
      });
    }, true);
    d.addEventListener('dragleave', e => { if (!e.relatedTarget) { hideIndicator(d); lastT = null; } }, true);
    d.addEventListener('drop', async e => {
      if (App.view === 'layers') return;
      const types = Array.from(e.dataTransfer.types);
      if (!types.some(t => /x-dl-move|x-dl-library|x-dl-asset|Files/.test(t))) return;
      const t = dropTarget(d, e.clientX, e.clientY);
      hideIndicator(d);
      lastT = null;
      if (!t) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (types.includes(MOVE)) {
        let from = null;
        try { from = JSON.parse(e.dataTransfer.getData(MOVE)); } catch (err) { /* ok */ }
        if (!from) return;
        const fch = App.project.chapters[from.ch];
        if (fch && fch === t.ch && (from.idx === t.idx)) {
          // mesma posição: só muda o lado (esquerda/centro/direita)
          withChapterDom(fch, root => { const f = root.children[from.idx]; if (f) { const o = zoneOpts(t.zone); f.setAttribute('data-align', o.align); f.setAttribute('data-wrap', o.wrap); } });
        } else if (!moveFigure({ ch: fch, idx: from.idx }, t)) return;
        App.changed('Imagem movida');
        return;
      }
      const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
      if (ids && ids.manuscript) return App.importer.fromPath(ids.manuscript);
      if (!ids || !ids.length) return;
      // nas laterais o texto contorna a forma: imagem com transparência ou com fundo liso (removido aqui)
      const parts = [];
      for (const id0 of ids) {
        let id = id0;
        const o = zoneOpts(t.zone);
        if (t.zone !== 'center') {
          const shaped = await shapeAsset(id0);
          if (shaped) { id = shaped; o.wrap = 'contour'; o.width = 45; }
        }
        parts.push(App.editor.figureHtml(id, o));
      }
      const html = parts.join('');
      if (insertAt(t.ch, t.idx, t.before, html)) {
        App.changed(`Imagem inserida em “${t.ch.title}”`);
        App.toast(t.zone === 'center' ? 'Imagem inserida: o texto continua acima e abaixo.' : `Imagem inserida à ${t.zone === 'left' ? 'esquerda' : 'direita'}: ${/data-wrap="contour"/.test(html) ? 'o texto contorna a forma do desenho' : 'o texto corre ao lado'}.`, 3500);
      }
    }, true);

    // clique numa imagem: seleção com alças de tamanho
    d.addEventListener('mousedown', e => {
      const h = e.target.closest && e.target.closest('.img-handle');
      if (h) { startResize(d, e, h); return; }
      const fig = e.target.closest && e.target.closest('.chapter-body > figure.fig[data-src]');
      clearSelection(d);
      if (fig && App.view !== 'layers') select(d, fig);
    });
    d.addEventListener('scroll', () => { const f = d.querySelector('figure.img-sel'); if (f) placeHandles(d, f); }, true);
  }

  function clearSelection(d) {
    d.querySelectorAll('figure.img-sel').forEach(f => f.classList.remove('img-sel'));
    d.querySelectorAll('.img-handle, .img-size').forEach(x => x.remove());
  }
  function select(d, fig) {
    fig.classList.add('img-sel');
    fig.setAttribute('draggable', 'true');
    placeHandles(d, fig);
  }
  function placeHandles(d, fig) {
    d.querySelectorAll('.img-handle, .img-size').forEach(x => x.remove());
    const box = fig.closest('.pagedjs_pagebox');
    if (!box) return;
    const bx = box.getBoundingClientRect();
    const k = bx.width / (box.offsetWidth || bx.width) || 1;
    const r = fig.getBoundingClientRect();
    [['l', r.left, r.top + r.height / 2], ['r', r.right, r.top + r.height / 2], ['bl', r.left, r.bottom], ['br', r.right, r.bottom]].forEach(([side, x, y]) => {
      const h = d.createElement('div');
      h.className = 'img-handle';
      h.dataset.side = side;
      Object.assign(h.style, { left: ((x - bx.left) / k - 6) + 'px', top: ((y - bx.top) / k - 6) + 'px' });
      box.appendChild(h);
    });
  }
  // arrastar a alça: largura em % da mancha, aplicada no modelo ao soltar
  function startResize(d, e, h) {
    e.preventDefault();
    e.stopPropagation();
    const fig = d.querySelector('figure.img-sel');
    if (!fig) return;
    const body = fig.closest('.chapter-body');
    const bodyW = body.getBoundingClientRect().width;
    const r0 = fig.getBoundingClientRect();
    const w0 = r0.width / bodyW * 100;
    const x0 = e.clientX;
    const side = h.dataset.side;
    const dir = side === 'l' || side === 'bl' ? -1 : 1;
    const centered = !/float/.test(fig.getAttribute('style') || '') && !/left|right/.test(getComputedStyle(fig).float);
    const box = fig.closest('.pagedjs_pagebox');
    const tag = d.createElement('div');
    tag.className = 'img-size';
    box.appendChild(tag);
    let w = w0;
    const move = ev => {
      const dx = (ev.clientX - x0) * dir * (centered ? 2 : 1);
      w = Math.max(8, Math.min(100, w0 + dx / bodyW * 100));
      fig.style.width = w.toFixed(1) + '%';
      tag.textContent = Math.round(w) + '%';
      const bx = box.getBoundingClientRect();
      const k = bx.width / (box.offsetWidth || bx.width) || 1;
      const fr = fig.getBoundingClientRect();
      Object.assign(tag.style, { left: ((fr.left - bx.left) / k) + 'px', top: ((fr.top - bx.top) / k - 22) + 'px' });
      placeHandles(d, fig);
    };
    const up = () => {
      d.removeEventListener('mousemove', move);
      d.removeEventListener('mouseup', up);
      tag.remove();
      const sec = fig.closest('section[data-chapter]');
      const ch = App.project.chapters[Number(sec.dataset.chapter)];
      const idx = Number(fig.dataset.src);
      if (!ch || ch.locked) return;
      const val = String(Math.round(w));
      withChapterDom(ch, root => { const f = root.children[idx]; if (f && f.matches('figure')) { f.setAttribute('data-width', val); if (App.editor.styleFigure && root.id === 'editor') App.editor.styleFigure(f); } });
      App.changed('Tamanho da imagem');
    };
    d.addEventListener('mousemove', move);
    d.addEventListener('mouseup', up);
  }

  // imagem pronta para o contorno: com transparência (usa a própria) ou com fundo liso (cria uma cópia sem fundo)
  async function shapeAsset(id) {
    const a = App.project.assets[id];
    if (!a) return null;
    try {
      const img = await loadImage(a.dataUrl);
      // transparência de verdade nas bordas (PNG “com canal alfa” pode ser todo opaco)
      if (a.info && a.info.hasAlpha && borderTransparency(img) > 0.3) return id;
      const r = cutBackground(img, 16, true, 2400);
      if (r.removed < 0.06 || r.removed > 0.9) return null;
      return await App.addAsset({ dataUrl: r.canvas.toDataURL('image/png'), name: (a.name || 'imagem') + ' (sem fundo)', width: r.canvas.width, height: r.canvas.height, info: Object.assign({}, a.info || {}, { hasAlpha: true, format: 'PNG' }) });
    } catch (e) { return null; }
  }

  function borderTransparency(img) {
    const s = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(2, Math.round(img.naturalWidth * s)), h = Math.max(2, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let n = 0, t = 0;
    const at = (x, y) => { n++; if (d[(y * w + x) * 4 + 3] < 20) t++; };
    for (let x = 0; x < w; x++) { at(x, 0); at(x, h - 1); }
    for (let y = 0; y < h; y++) { at(0, y); at(w - 1, y); }
    return t / n;
  }

  // ---------------------------------------------------------------- remover o fundo (local)
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  // fundo = regiões ligadas à borda com cor parecida com a da borda; bordas suavizadas
  function cutBackground(img, tol, smooth, maxSide) {
    const sc = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, w, h);
    const im = cx.getImageData(0, 0, w, h);
    const p = im.data;
    const N = w * h;
    const region = new Int32Array(N).fill(-1);
    const seeds = [];
    const q = new Int32Array(N);
    const T = tol * 4.42; // tolerância (0–100) em distância RGB
    const dist = (i, c) => { const r = p[i * 4] - c[0], g = p[i * 4 + 1] - c[1], b = p[i * 4 + 2] - c[2]; return Math.sqrt(r * r + g * g + b * b); };
    const fill = start => {
      if (region[start] >= 0) return;
      const id = seeds.length;
      const c = [p[start * 4], p[start * 4 + 1], p[start * 4 + 2]];
      seeds.push(c);
      let qh = 0, qt = 0;
      q[qt++] = start; region[start] = id;
      while (qh < qt) {
        const i = q[qh++];
        const x = i % w, y = (i - x) / w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const n of nb) {
          if (n < 0 || region[n] >= 0) continue;
          if (p[n * 4 + 3] < 16 || dist(n, c) <= T) { region[n] = id; q[qt++] = n; }
        }
      }
    };
    for (let x = 0; x < w; x++) { fill(x); fill((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { fill(y * w); fill(y * w + w - 1); }
    // regiões da borda muito pequenas não são fundo (ex.: a figura encosta na borda)
    const size = new Int32Array(seeds.length);
    for (let i = 0; i < N; i++) if (region[i] >= 0) size[region[i]]++;
    const isBg = new Uint8Array(seeds.length);
    for (let s = 0; s < seeds.length; s++) isBg[s] = size[s] > N * 0.002 ? 1 : 0;
    let removed = 0;
    for (let i = 0; i < N; i++) if (region[i] >= 0 && isBg[region[i]]) { p[i * 4 + 3] = 0; removed++; }
    if (smooth) {
      // borda suave: pixels da figura vizinhos do fundo ficam parcialmente transparentes conforme a cor
      const a2 = new Uint8ClampedArray(N);
      for (let i = 0; i < N; i++) a2[i] = p[i * 4 + 3];
      for (let i = 0; i < N; i++) {
        if (a2[i] === 0) continue;
        const x = i % w, y = (i - x) / w;
        let bgN = -1;
        if (x > 0 && a2[i - 1] === 0) bgN = i - 1; else if (x < w - 1 && a2[i + 1] === 0) bgN = i + 1; else if (y > 0 && a2[i - w] === 0) bgN = i - w; else if (y < h - 1 && a2[i + w] === 0) bgN = i + w;
        if (bgN < 0 || region[bgN] < 0) continue;
        const d0 = dist(i, seeds[region[bgN]]);
        const f = Math.max(0, Math.min(1, (d0 - T) / (T * 0.8 + 12)));
        p[i * 4 + 3] = Math.round(a2[i] * (0.35 + 0.65 * f));
      }
    }
    cx.putImageData(im, 0, 0);
    return { canvas: cv, removed: removed / N };
  }

  async function removeBackground(fig) {
    const a = fig && App.project.assets[fig.dataset.asset];
    if (!a) return;
    const img = await loadImage(a.dataUrl);
    let tol = 18, smooth = true;
    const before = el('img', { class: 'rb-img', src: a.dataUrl });
    const after = el('div', { class: 'rb-after' });
    const info = el('p', { class: 'small muted' });
    const redraw = () => {
      const r = cutBackground(img, tol, smooth, 700);
      after.innerHTML = '';
      r.canvas.className = 'rb-img';
      after.appendChild(r.canvas);
      info.textContent = `${Math.round(r.removed * 100)}% da imagem ficou transparente.${r.removed < 0.02 ? ' Aumente a tolerância se o fundo não sumiu.' : r.removed > 0.85 ? ' Diminua a tolerância: a figura também está sumindo.' : ''}`;
    };
    const tolOut = el('span', { class: 'val', text: String(tol) });
    const slider = el('input', { type: 'range', min: 2, max: 70, step: 1, value: tol });
    let t = null;
    slider.addEventListener('input', () => { tol = Number(slider.value); tolOut.textContent = String(tol); clearTimeout(t); t = setTimeout(redraw, 120); });
    const sm = el('input', { type: 'checkbox', checked: true });
    sm.addEventListener('change', () => { smooth = sm.checked; redraw(); });
    App.modal({
      title: 'Remover o fundo da imagem', wide: true,
      body: el('div', {}, [
        el('p', { class: 'muted', text: 'Funciona melhor com fundo liso ou quase liso (estúdio, papel, céu). Tudo é feito no seu computador; a imagem original continua no projeto.' }),
        el('div', { class: 'rb-wrap' }, [el('div', {}, [el('div', { class: 'small muted', text: 'Original' }), before]), el('div', {}, [el('div', { class: 'small muted', text: 'Sem fundo' }), after])]),
        el('div', { class: 'fp-row' }, [el('label', { text: 'Tolerância de cor' }), el('div', { class: 'slider' }, [slider, tolOut])]),
        el('label', { class: 'chk' }, [sm, ' Suavizar as bordas']),
        info
      ]),
      buttons: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, onClick: async () => {
        const r = cutBackground(img, tol, smooth, 4000);
        const dataUrl = r.canvas.toDataURL('image/png');
        const id = await App.addAsset({ dataUrl, name: (a.name || 'imagem') + ' (sem fundo)', width: r.canvas.width, height: r.canvas.height });
        fig.setAttribute('data-asset', id);
        const im = fig.querySelector('img');
        if (im) im.setAttribute('data-asset', id);
        App.editor.setFig(fig, 'data-wrap', fig.dataset.wrap === 'square' ? 'contour' : fig.dataset.wrap, 'Fundo removido');
        App.changed('Fundo da imagem removido');
        App.toast('Fundo removido. Com o texto ao lado, ele contorna a forma da figura.', 4000);
      } }]
    });
    setTimeout(redraw, 30);
  }

  App.images = { wire, dropTarget, insertAt, moveFigure, removeBackground, cutBackground, shapeAsset };
})();
