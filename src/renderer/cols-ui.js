/* global App */
// Colunas num trecho: selecione o texto (no editor ou direto nas páginas), botão direito ›
// “Dividir em 2 colunas” ou “3 colunas”. Só os parágrafos selecionados vão para as colunas; a página,
// as imagens, caixas de texto, tabelas, molduras, letra capitular, filete e imersão ficam como estão
// (esses elementos nunca entram no bloco de colunas: a seleção é dividida em volta deles).
(function () {
  const { el, $ } = App;
  const OK = /^(P|BLOCKQUOTE|UL|OL|H3|H4)$/; // o que pode ir para as colunas

  let menu = null;
  const hide = () => { if (menu) { menu.remove(); menu = null; } };

  // blocos de nível superior do texto do capítulo tocados pela seleção
  function touched(ed, r) {
    return Array.from(ed.children).filter(b => r.intersectsNode(b));
  }
  function colsAt(ed, r) {
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    const own = n && n.closest && n.closest('#editor div.cols');
    return own || touched(ed, r).find(b => b.matches('div.cols')) || null;
  }

  // aplica no texto do capítulo (a seleção já está no editor)
  function apply(n, rule) {
    const ed = $('#editor');
    const sel = window.getSelection();
    if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return 0;
    const r = sel.getRangeAt(0);
    let blocks = touched(ed, r);
    if (!blocks.length) return 0;
    // colunas já existentes na seleção: os parágrafos delas entram no novo conjunto
    const flat = [];
    blocks.forEach(b => { if (b.matches('div.cols')) { const kids = Array.from(b.children); b.replaceWith(...kids); flat.push(...kids); } else flat.push(b); });
    blocks = flat;
    if (n === 0) return blocks.length; // só tirar as colunas
    // grupos contínuos de parágrafos; figuras, caixas, tabelas, títulos T1… ficam de fora, intactos
    const groups = [];
    let cur = null;
    blocks.forEach(b => {
      if (OK.test(b.tagName) && !b.closest('div.box, div.poem, div.tframe')) { if (!cur) groups.push(cur = []); cur.push(b); } else cur = null;
    });
    groups.forEach(g => {
      const d = document.createElement('div');
      d.className = 'cols';
      d.setAttribute('data-n', String(n));
      if (rule === false) d.setAttribute('data-rule', '0');
      g[0].before(d);
      g.forEach(b => d.appendChild(b));
    });
    return groups.length;
  }
  function unwrap(box) {
    if (!box) return 0;
    box.replaceWith(...Array.from(box.children));
    return 1;
  }

  // executa a ação no modelo (vindo do editor ou das páginas) e refaz as páginas
  function run(fromStage, host, fn, label) {
    if (fromStage) {
      const c = App.live && App.live.selectionToModel(host);
      if (!c) return App.toast('Selecione o texto na página (o capítulo não pode estar bloqueado).');
    } else {
      const c = App.chapter();
      if (c && c.locked) return App.toast('Capítulo bloqueado.');
    }
    const k = fn();
    if (!k) return App.toast('Selecione um ou mais parágrafos de texto.');
    if (fromStage && App.live.structureChanged) App.live.structureChanged();
    else if (App.editor.onInput) App.editor.onInput();
    App.changed(label);
  }

  function show(x, y, opts) {
    hide();
    const item = (txt, sub, fn, on) => el('button', { class: 'cxm-item' + (on ? ' on' : ''), onmousedown: e => e.preventDefault(), onclick: () => { hide(); fn(); } }, [el('span', { text: txt }), sub ? el('span', { class: 'cxm-sub', text: sub }) : null]);
    const cur = opts.current;
    const n = cur ? cur.getAttribute('data-n') : '';
    const rule = cur ? cur.getAttribute('data-rule') !== '0' : true;
    menu = el('div', { class: 'cxm' }, [
      el('div', { class: 'cxm-h', text: 'Colunas no trecho selecionado' }),
      item('▥  Dividir em 2 colunas', 'só o texto selecionado', () => opts.act(2, rule, 'Trecho em 2 colunas'), n === '2'),
      item('▦  Dividir em 3 colunas', 'só o texto selecionado', () => opts.act(3, rule, 'Trecho em 3 colunas'), n === '3'),
      cur ? item(rule ? '│  Tirar o fio entre as colunas' : '│  Pôr fio entre as colunas', '', () => opts.rule(!rule)) : null,
      cur ? item('▭  Remover as colunas', 'o texto volta à largura da página', () => opts.remove()) : null,
      el('div', { class: 'cxm-sep' }),
      item('Copiar', '', () => opts.copy()),
    ]);
    document.body.appendChild(menu);
    menu.style.left = Math.max(6, Math.min(window.innerWidth - menu.offsetWidth - 6, x)) + 'px';
    menu.style.top = Math.max(6, Math.min(window.innerHeight - menu.offsetHeight - 6, y)) + 'px';
    setTimeout(() => {
      const off = ev => { if (menu && !menu.contains(ev.target)) { hide(); document.removeEventListener('mousedown', off, true); } };
      document.addEventListener('mousedown', off, true);
    }, 0);
  }

  function setRule(box, on) { box.setAttribute('data-rule', on ? '1' : '0'); if (on) box.removeAttribute('data-rule'); return 1; }

  // no editor (texto do capítulo)
  function wireEditor() {
    const ed = $('#editor');
    if (!ed || ed.__colsWired) return;
    ed.__colsWired = true;
    ed.addEventListener('contextmenu', e => {
      const sel = window.getSelection();
      const r = sel.rangeCount ? sel.getRangeAt(0) : null;
      const inCols = e.target.closest && e.target.closest('div.cols');
      if (!r || (r.collapsed && !inCols)) return; // sem seleção: menu normal
      e.preventDefault();
      const current = inCols || (r && colsAt(ed, r));
      show(e.clientX, e.clientY, {
        current,
        act: (n, rule, label) => run(false, null, () => apply(n, rule), label),
        rule: on => run(false, null, () => setRule(current, on), on ? 'Fio entre as colunas' : 'Sem fio entre as colunas'),
        remove: () => run(false, null, () => unwrap(current), 'Colunas removidas'),
        copy: () => document.execCommand('copy')
      });
    });
  }

  // nas páginas (prévia editável)
  function wireStage(d) {
    if (d.__colsWired) return;
    d.__colsWired = true;
    d.addEventListener('contextmenu', e => {
      const host = e.target.closest && e.target.closest('.chapter-body');
      if (!host) return;
      const sel = d.getSelection();
      const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      const inCols = e.target.closest('div.cols');
      if (!r || (r.collapsed && !inCols)) return;
      e.preventDefault();
      const frame = Array.from(document.querySelectorAll('#previewFrames iframe')).find(f => f.contentDocument === d);
      const fr = frame ? frame.getBoundingClientRect() : { left: 0, top: 0, width: 1 };
      const k = frame ? fr.width / (d.documentElement.clientWidth || fr.width) : 1;
      const x = fr.left + e.clientX * k, y = fr.top + e.clientY * k;
      // o bloco de colunas tocado, no modelo: pela seleção mapeada para o editor
      const modelCols = () => { const s2 = window.getSelection(); return s2.rangeCount ? colsAt($('#editor'), s2.getRangeAt(0)) : null; };
      show(x, y, {
        current: inCols,
        act: (n, rule, label) => run(true, host, () => apply(n, rule), label),
        rule: on => run(true, host, () => { const b = modelCols(); return b ? setRule(b, on) : 0; }, on ? 'Fio entre as colunas' : 'Sem fio entre as colunas'),
        remove: () => run(true, host, () => unwrap(modelCols()), 'Colunas removidas'),
        copy: () => d.execCommand('copy')
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireEditor); else setTimeout(wireEditor, 0);
  App.cols = { wireStage, wireEditor, apply, unwrap };
})();
