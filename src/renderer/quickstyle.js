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
    // vai para a figura/tabela vizinha que ainda não tem legenda (uma legenda existente nunca é trocada
    // sem querer: para mudá-la, clique dentro dela)
    const figFree = x => isFig(x) && !x.querySelector('figcaption');
    const tabFree = x => isTable(x) && !x.querySelector(':scope > caption');
    if (figFree(prev)) put(prev, 'figcaption');
    else if (tabFree(next)) put(next, 'caption', true);
    else if (figFree(next)) put(next, 'figcaption');
    else if (tabFree(prev)) put(prev, 'caption', true);
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

  // ---------------------------------------------------------------- caixas de texto e citações
  const BOX_STYLES = [
    ['', 'Contorno', 'Filete fino em volta', 'box-contorno'], ['fundo', 'Fundo cinza', 'Fundo claro, sem borda', 'box-fundo'],
    ['lateral', 'Barra lateral', 'Filete grosso à esquerda', 'box-lateral'], ['filete', 'Filetes', 'Linhas acima e abaixo', 'box-filete'],
    ['escuro', 'Fundo escuro', 'Texto branco sobre preto', 'box-escuro']
  ];
  const QUOTE_STYLES = [
    ['', 'Recuada', 'Citação longa do livro (ou ABNT)', 'q-recuo'], ['aspas', 'Aspas grandes', 'Itálico com aspas decorativas', 'q-aspas'],
    ['lateral', 'Barra lateral', 'Filete à esquerda', 'q-lateral'], ['destaque', 'Destaque', 'Frase centralizada entre filetes', 'q-destaque']
  ];
  // blocos do primeiro nível tocados pela seleção
  function selectedTops() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor().contains(sel.anchorNode)) return [];
    const r = sel.getRangeAt(0);
    const a = topBlock(r.startContainer), b = topBlock(r.endContainer);
    if (!a) return [];
    const out = [a];
    let n = a;
    while (b && n !== b && n.nextElementSibling) { n = n.nextElementSibling; out.push(n); }
    return out;
  }
  // envolve os parágrafos selecionados numa caixa (div.box) ou citação (blockquote) com o estilo escolhido
  function wrap(kind, style) {
    if (locked()) return;
    const tops = selectedTops();
    if (!tops.length) return App.toast('Selecione o texto que vai para a caixa.');
    const isW = x => (kind === 'box' ? x.matches('div.box') : x.tagName === 'BLOCKQUOTE');
    if (style === 'remove') {
      tops.filter(t => t.matches('div.box, blockquote')).forEach(t => {
        while (t.firstChild) {
          const c = t.firstChild;
          if (c.nodeType === 3 && c.nodeValue.trim()) { const p = document.createElement('p'); p.appendChild(c); t.before(p); } else t.before(c);
        }
        t.remove();
      });
    } else if (tops.length === 1 && isW(tops[0])) {
      if (style) tops[0].dataset.style = style; else delete tops[0].dataset.style;
    } else {
      const w = document.createElement(kind === 'box' ? 'div' : 'blockquote');
      if (kind === 'box') w.className = 'box';
      if (style) w.dataset.style = style;
      tops[0].before(w);
      tops.forEach(t => {
        if (t.matches('div.box, blockquote')) { while (t.firstChild) w.appendChild(t.firstChild); t.remove(); }
        else if (t.matches('p.phrase')) { t.classList.remove('phrase'); w.appendChild(t); }
        else w.appendChild(t);
      });
      if (!w.querySelector('p, h2, h3, h4, ul, ol, table, figure')) { const p = document.createElement('p'); while (w.firstChild) p.appendChild(w.firstChild); w.appendChild(p); }
    }
    editor().dispatchEvent(new Event('input', { bubbles: true }));
    done(style === 'remove' ? 'Caixa removida' : kind === 'box' ? 'Caixa de texto' : 'Caixa de citação');
  }
  function styleMenu(anchor, kind, run) {
    const list = kind === 'box' ? BOX_STYLES : QUOTE_STYLES;
    const menu = el('div', { class: 'qs-menu' }, [el('div', { class: 'qs-menu-title', text: kind === 'box' ? 'Caixa de texto' : 'Caixa de citação' })]
      .concat(list.map(([k, label, desc, cls]) => el('button', { class: 'bx-tile', onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); run(() => wrap(kind, k)); } }, [el('span', { class: 'bx-prev ' + cls }), el('span', { class: 'bx-name' }, [label, el('small', { text: desc })])])))
      .concat([el('button', { class: 'bx-tile', onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); run(() => wrap(kind, 'remove')); } }, [el('span', { class: 'bx-prev' }), el('span', { class: 'bx-name' }, ['Sem caixa', el('small', { text: 'Volta a ser texto corrido' })])])]));
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px';
    menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 4) + 'px';
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }

  // ---------------------------------------------------------------- barra flutuante
  let bar = null;
  let onStage = false; // a seleção está nas páginas (edição direta)
  // ações a partir das páginas: o cursor é levado para o mesmo ponto do texto do capítulo antes
  const run = fn => (onStage && App.live ? App.live.runOnModel(fn) : fn());
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
    const b = (text, title, fn, cls) => el('button', { class: 'qs-btn' + (cls ? ' ' + cls : ''), title, text, onmousedown: e => e.preventDefault(), onclick: e => (/▾/.test(text) ? fn(e) : run(() => fn(e))) });
    return [
      b('Título', 'Título de seção (T1) — Ctrl+1', () => block('h2'), 'qs-t'),
      b('Subtítulo', 'Subtítulo (T2) — Ctrl+2', () => block('h3'), 'qs-s'),
      b('Corpo', 'Texto principal — Ctrl+0', () => block('p')),
      b('Legenda ▾', 'Transformar em legenda da figura/tabela vizinha e escolher o estilo — Ctrl+9', e => capMenu(e.currentTarget)),
      compact ? null : el('span', { class: 'qs-sep' }),
      compact ? null : b('▢ Caixa ▾', 'Colocar o trecho selecionado numa caixa de texto', e => styleMenu(e.currentTarget, 'box', run)),
      compact ? null : b('❝ Citação ▾', 'Colocar o trecho selecionado numa caixa de citação', e => styleMenu(e.currentTarget, 'quote', run)),
      compact ? null : el('span', { class: 'qs-sep' }),
      b('Aa Estilo ▾', 'Estilo de caractere no trecho selecionado (Ênfase, Versalete, Termo estrangeiro…): mudar o estilo muda todos os trechos marcados', e => charMenu(e.currentTarget)),
      b('🖍 Marcador ▾', 'Marcador de texto: contorno colorido atrás do trecho selecionado (cinza, preto, verde, amarelo, rosa neon ou caixa de linha fina)', e => hlMenu(e.currentTarget)),
      compact ? null : b('N', 'Negrito', () => fmt('bold'), 'qs-b'),
      compact ? null : b('I', 'Itálico', () => fmt('italic'), 'qs-i')
    ].filter(Boolean);
  }
  // marcador de texto (contorno colorido); preto e rosa deixam a letra branca
  const HL = [['yellow', 'Amarelo neon'], ['green', 'Verde neon'], ['pink', 'Rosa neon'], ['gray', 'Cinza'], ['black', 'Preto'], ['outline', 'Branco com contorno fino']];
  function highlight(color) {
    if (locked()) return;
    let ok = false;
    if (onStage && App.live) ok = App.live.highlight(color);
    else if (App.live && App.live.applyHighlight) { ok = App.live.applyHighlight(window.getSelection(), color); if (ok) editor().dispatchEvent(new Event('input', { bubbles: true })); }
    if (!ok) return App.toast('Selecione o trecho no texto primeiro.');
    App.commit(color ? 'Marcador de texto: ' + (HL.find(x => x[0] === color) || [, color])[1] : 'Marcador removido');
    hide();
  }
  function hlMenu(anchor) {
    const sw = ([k, name]) => el('button', { class: 'hl-sw', title: name, onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); highlight(k); } }, [el('span', { class: 'hl hl-' + k, text: 'Aa' })]);
    // CEDET: miolo só com tinta preta — o marcador fica em cinza, preto ou contorno
    const cedet = App.project.settings.standard === 'cedet';
    const list = cedet ? HL.filter(([k]) => ['gray', 'black', 'outline'].includes(k)) : HL;
    const menu = el('div', { class: 'qs-menu' }, [el('div', { class: 'qs-menu-title', text: 'Marcador de texto' + (cedet ? ' (CEDET: só tons de cinza)' : '') }), el('div', { class: 'hl-menu' }, list.map(sw)),
      el('button', { class: 'bx-tile cs-tile', onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); highlight(''); } }, [el('span', { class: 'bx-name' }, ['Sem marcador', el('small', { text: 'Tira o marcador do trecho' })])])]);
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px';
    menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 4) + 'px';
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }
  // menu dos estilos de caractere do livro
  function charMenu(anchor) {
    const list = (App.project.settings.charStyles || []);
    const css = cs => App.D.charStyleDecl(cs);
    const apply = id => {
      if (locked()) return;
      let ok = false;
      if (onStage && App.live) ok = App.live.charStyle(id);
      else if (App.live && App.live.applyCharStyle) { ok = App.live.applyCharStyle(window.getSelection(), id); if (ok) editor().dispatchEvent(new Event('input', { bubbles: true })); }
      if (!ok) return App.toast('Selecione o trecho no texto primeiro.');
      App.commit(id ? 'Estilo de caractere: ' + ((list.find(x => x.id === id) || {}).name || id) : 'Estilo de caractere removido');
      hide();
    };
    const item = (kids, fn) => el('button', { class: 'bx-tile cs-tile', onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); fn(); } }, kids);
    const menu = el('div', { class: 'qs-menu' }, [el('div', { class: 'qs-menu-title', text: 'Estilo de caractere' })]
      .concat(list.map(cs => item([el('span', { class: 'cs-prev', style: { cssText: css(cs) }, text: cs.name })], () => apply(cs.id))))
      .concat([item([el('span', { class: 'bx-name' }, ['Sem estilo de caractere', el('small', { text: 'Tira o estilo do trecho' })])], () => apply('')),
        item([el('span', { class: 'bx-name' }, ['Editar estilos…', el('small', { text: 'Mudar um estilo muda todos os trechos marcados' })])], () => { hide(); App.setView('styles'); setTimeout(() => { const c = document.querySelector('#charStylesCard'); if (c) c.scrollIntoView({ block: 'start' }); }, 250); })]));
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px';
    menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 4) + 'px';
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }
  function fmt(cmd) {
    if (onStage && App.live && App.live.exec(cmd)) return;
    editor().focus();
    document.execCommand(cmd, false, null);
    editor().dispatchEvent(new Event('input', { bubbles: true }));
  }
  function show() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || App.view !== 'chapter') return hide();
    const ed = editor();
    if (!ed || !ed.contains(sel.anchorNode) || !ed.contains(sel.focusNode)) return hide();
    // com a edição nas páginas, o editor fica fora da tela: a barra só aparece no modo de texto em coluna
    if (!document.body.classList.contains('classic-editor')) return;
    onStage = false;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return hide();
    place(r);
  }
  // seleção nas páginas: posição convertida para a janela principal
  function showStage(sel) {
    const frame = document.querySelector('#previewFrames iframe');
    if (!frame || !sel || !sel.rangeCount || sel.isCollapsed || App.view !== 'chapter') return hide();
    const r0 = sel.getRangeAt(0).getBoundingClientRect();
    if (!r0.width && !r0.height) return hide();
    const fr = frame.getBoundingClientRect();
    const d = frame.contentDocument;
    const k = fr.width / (d.documentElement.clientWidth || fr.width) || 1;
    const r = { left: fr.left + r0.left * k, top: fr.top + r0.top * k, width: r0.width * k, height: r0.height * k };
    if (r.top < fr.top || r.top > fr.bottom) return hide();
    onStage = true;
    place(r);
    if (!d.__qsWired) { d.__qsWired = true; d.addEventListener('scroll', hide, true); d.addEventListener('mousedown', e => { if (!e.shiftKey) hide(); }); }
  }
  function place(r) {
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
  // some ao clicar fora do texto ou ao trocar de tela
  document.addEventListener('mousedown', e => { if (bar && !bar.contains(e.target) && !(editor() && editor().contains(e.target))) hide(); }, true);
  const wrapSetView = () => { if (App.setView && !App.setView.__qs) { const orig = App.setView; App.setView = function () { hide(); return orig.apply(this, arguments); }; App.setView.__qs = true; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapSetView); else wrapSetView();

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

  App.quickStyle = { makeCaption, block, wrap, showStage, hide, highlight,
    // botão da barra de ferramentas: a seleção pode estar no texto em coluna ou nas páginas
    hlMenu: anchor => { onStage = !!(App.live && App.live.focusedOnStage && App.live.focusedOnStage() && App.view === 'chapter'); hlMenu(anchor); } };
})();
