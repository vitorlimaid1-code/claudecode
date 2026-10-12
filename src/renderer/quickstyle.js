/* global App */
// Estilos rápidos no editor: ao selecionar um texto aparece uma barra com Título, Subtítulo, Corpo,
// Legenda (com estilos) e Citação. Os mesmos comandos ficam na barra do editor e nos atalhos
// Ctrl+1 (título), Ctrl+2 (subtítulo), Ctrl+0 (corpo) e Ctrl+9 (legenda).
(function () {
  const { el, $, D } = App;
  const editor = () => $('#editor');

  function topBlock(node) {
    const ed = editor();
    let n = node;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n && n.parentNode === ed ? n : null;
  }
  function selectionBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor().contains(sel.anchorNode)) return null;
    return topBlock(sel.anchorNode);
  }
  // legenda em que o cursor está (dentro de uma figura ou tabela)
  function captionAtCursor() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    return n && n.closest && n.closest('#editor figcaption, #editor table caption, #editor p.caption-text');
  }

  function locked() { const c = App.chapter(); if (c && c.locked) { App.toast('Capítulo bloqueado: desbloqueie no cadeado.'); return true; } return false; }

  // transforma o parágrafo selecionado em legenda da figura/tabela vizinha (ou legenda solta) com o estilo escolhido
  function makeCaption(style) {
    if (locked()) return;
    const ed = editor();
    const existing = captionAtCursor();
    if (existing) {
      if (style) existing.dataset.cap = style; else delete existing.dataset.cap;
      done('Estilo da legenda');
      return;
    }
    const b = selectionBlock();
    if (!b || !/^(P|H2|H3|H4)$/.test(b.tagName) || !b.textContent.trim()) return App.toast('Clique no parágrafo (ou selecione o texto) que será a legenda.');
    const prev = b.previousElementSibling, next = b.nextElementSibling;
    const isFig = x => x && x.matches && x.matches('figure.img');
    const isTable = x => x && x.tagName === 'TABLE';
    const put = (host, tag, first) => {
      let cap = host.querySelector(tag === 'caption' ? ':scope > caption' : 'figcaption');
      if (!cap) { cap = document.createElement(tag); if (first) host.insertBefore(cap, host.firstChild); else host.appendChild(cap); }
      cap.innerHTML = b.innerHTML;
      if (style) cap.dataset.cap = style;
      if (tag === 'figcaption') cap.setAttribute('contenteditable', 'true');
      b.remove();
      if (host.matches('figure.img') && App.editor.styleFigure) App.editor.styleFigure(host);
    };
    if (isFig(prev)) put(prev, 'figcaption');
    else if (isTable(next)) put(next, 'caption', true);
    else if (isFig(next)) put(next, 'figcaption');
    else if (isTable(prev)) put(prev, 'caption', true);
    else {
      const p = document.createElement('p');
      p.className = 'caption-text';
      p.innerHTML = b.innerHTML;
      if (style) p.dataset.cap = style;
      b.replaceWith(p);
    }
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    done('Legenda aplicada');
  }
  function done(label) {
    App.changed(label);
    hide();
  }
  function block(v) {
    if (locked()) return;
    // legenda solta volta a ser texto quando se escolhe Corpo/Título
    const b = selectionBlock();
    if (b && b.matches('p.caption-text')) { b.classList.remove('caption-text'); delete b.dataset.cap; }
    App.editor.applyBlockStyle(v);
    hide();
  }

  // ---------------------------------------------------------------- barra flutuante
  let bar = null;
  function capMenu(anchor) {
    const cur = App.project.settings.captionStyle || 'classica';
    const menu = el('div', { class: 'qs-menu' }, [el('div', { class: 'qs-menu-title', text: 'Estilo da legenda' })].concat(D.CAPTION_STYLES.map(s => el('button', {
      class: 'qs-cap qs-cap-' + s.key, title: s.desc,
      onmousedown: e => e.preventDefault(),
      onclick: () => { menu.remove(); makeCaption(s.key === cur ? '' : s.key); }
    }, [el('span', { class: 'qs-cap-label', text: 'Figura 1' }), el('span', { class: 'qs-cap-text', text: ' ' + s.label + (s.key === cur ? ' (padrão do livro)' : '') })]))));
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(window.innerWidth - 260, r.left) + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }
  function buttons(compact) {
    const b = (text, title, fn, cls) => el('button', { class: 'qs-btn' + (cls ? ' ' + cls : ''), title, text, onmousedown: e => e.preventDefault(), onclick: e => fn(e) });
    return [
      b('Título', 'Título de seção (T1) — Ctrl+1', () => block('h2'), 'qs-t'),
      b('Subtítulo', 'Subtítulo (T2) — Ctrl+2', () => block('h3'), 'qs-s'),
      b('Corpo', 'Texto principal — Ctrl+0', () => block('p')),
      b('Legenda ▾', 'Transformar em legenda da figura/tabela vizinha e escolher o estilo — Ctrl+9', e => capMenu(e.currentTarget)),
      compact ? null : b('Citação', 'Citação longa', () => block('blockquote')),
      compact ? null : b('Destaque', 'Frase em destaque', () => block('phrase'))
    ].filter(Boolean);
  }
  function show() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || App.view !== 'chapter') return hide();
    const ed = editor();
    if (!ed || !ed.contains(sel.anchorNode) || !ed.contains(sel.focusNode)) return hide();
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return hide();
    if (!bar) { bar = el('div', { class: 'qs-bar' }, buttons(false)); document.body.appendChild(bar); }
    bar.style.display = 'flex';
    const w = bar.offsetWidth;
    bar.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    bar.style.top = Math.max(8, r.top - bar.offsetHeight - 8) + 'px';
  }
  function hide() { if (bar) bar.style.display = 'none'; }
  let t = null;
  document.addEventListener('selectionchange', () => { clearTimeout(t); t = setTimeout(show, 180); });
  document.addEventListener('scroll', hide, true);

  // atalhos
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || App.view !== 'chapter') return;
    const ed = editor();
    if (!ed || !ed.contains(document.activeElement) && document.activeElement !== ed) return;
    const map = { 1: () => block('h2'), 2: () => block('h3'), 0: () => block('p'), 9: () => makeCaption('') };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  });

  // botões fixos na barra do editor
  function mountToolbar() {
    const sel = $('#blockFormat');
    if (!sel || $('#quickStyles')) return;
    const box = el('span', { id: 'quickStyles', class: 'qs-inline' }, buttons(true));
    sel.after(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToolbar); else mountToolbar();

  App.quickStyle = { makeCaption, block };
})();
