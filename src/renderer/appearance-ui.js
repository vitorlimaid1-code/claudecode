/* global App, SystemTheme */
// Aparência do sistema: modo claro, noturno ou automático (segue o Windows) e cores de destaque.
(function () {
  const { el, $ } = App;
  const ACCENTS = [
    ['terracota', 'Terracota (padrão)', '#8a3b1f'], ['azul', 'Azul-marinho', '#1f4e8a'], ['verde', 'Verde-floresta', '#2f6b3a'],
    ['vinho', 'Vinho', '#7a1f3d'], ['roxo', 'Roxo', '#5b3a8a'], ['petroleo', 'Petróleo', '#0f5c66'],
    ['ambar', 'Âmbar', '#8f5a00'], ['rosa', 'Rosa', '#a3366b'], ['grafite', 'Grafite', '#3b3f46']
  ];
  const MODES = [['light', '☀ Claro'], ['dark', '🌙 Noturno'], ['auto', '◐ Automático (segue o sistema)']];

  function syncButton() {
    const b = $('#btnNight');
    if (!b) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    b.textContent = dark ? '☀' : '🌙';
    b.title = dark ? 'Voltar ao modo claro' : 'Ativar o modo noturno';
    b.classList.toggle('on', dark);
  }
  function toggleNight() {
    const dark = document.documentElement.dataset.theme === 'dark';
    SystemTheme.set('themeMode', dark ? 'light' : 'dark');
    syncButton();
    if (App.view === 'appearance') render();
  }

  function render() {
    const v = $('#view-appearance');
    v.innerHTML = '';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Aparência do sistema' }),
      el('p', { class: 'muted', text: 'Muda só a aparência do programa. As páginas do livro na prévia continuam brancas, como o papel impresso, e o PDF não é afetado.' }),
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Modo' }),
        el('div', { class: 'theme-modes' }, MODES.map(([k, label]) => el('div', { class: 'theme-mode' + (SystemTheme.mode === k ? ' on' : ''), text: label, onclick: () => { SystemTheme.set('themeMode', k); syncButton(); render(); } }))),
        el('p', { class: 'small muted', text: 'Atalho: botão 🌙 no topo da janela.' })
      ]),
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Cor do sistema' }),
        el('div', { class: 'theme-swatches' }, ACCENTS.map(([k, label, c]) => el('div', { class: 'theme-swatch' + (SystemTheme.accent === k ? ' on' : ''), onclick: () => { SystemTheme.set('themeAccent', k); render(); } }, [el('span', { class: 'dot', style: `background:${c}` }), el('span', { text: label })])))
      ]),
      el('div', { class: 'inline wrap' }, [el('button', { text: '↺ Restaurar a aparência padrão (claro, terracota)', onclick: () => { SystemTheme.reset(); syncButton(); render(); App.toast('Aparência padrão restaurada.'); } })])
    ]));
  }

  App.hooks.viewRender.appearance = render;
  const init = () => { const b = $('#btnNight'); if (b) { b.addEventListener('click', toggleNight); syncButton(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  App.appearance = { toggleNight, syncButton };
})();
