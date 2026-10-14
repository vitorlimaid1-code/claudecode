/* global App, HeaderRules */
// Galeria do filete sob o cabeçalho: miniaturas de um livro aberto (página par e ímpar) com o
// cabeçalho e a linha de cada estilo, que se encontra na lombada.
(function () {
  const { el } = App;
  function gallery(s, rerender) {
    const R = window.HeaderRules;
    if (!R) return null;
    const hr = s.headerRule = Object.assign({ style: 'fina', color: '#6b6b6b', weight: 0.5, gap: 2.2, spine: true }, s.headerRule || {});
    const meta = App.project.meta;
    const H = s.styles.header || {};
    const font = H.font || s.styles.body.font;
    const texts = s.header === 'title-chapter' ? [meta.title, 'Título do capítulo'] : s.header === 'chapter-chapter' ? ['Título do capítulo', 'Título do capítulo'] : [meta.author || 'Nome do Autor', meta.title || 'Título do livro'];
    const page = (side, key) => {
      const spine = hr.spine !== false && key !== 'curta';
      const pos = key === 'curta' ? 'left:35%;right:35%;' : side === 'left' ? `left:14%;right:${spine ? 0 : 8}%;` : `left:${spine ? 0 : 8}%;right:14%;`;
      // escala: 1 pt da página ≈ 0,6 px na miniatura (com mínimo visível)
      const css = R.decl(key, hr.color || '#6b6b6b', Math.max(0.6, (Number(hr.weight) || 0.5) * 1.6), side);
      return el('div', { class: 'hrg-page ' + side }, [
        el('div', { class: 'hrg-head', style: `font-family:"${font}",Georgia,serif; text-align:${side === 'left' ? 'left' : 'right'}; ${H.uppercase ? 'text-transform:uppercase; letter-spacing:.08em;' : ''}` + (side === 'left' ? 'padding-left:14%;' : 'padding-right:14%;'), text: side === 'left' ? texts[0] : texts[1] }),
        key !== 'none' ? el('div', { class: 'hrg-line', style: pos + css }) : null,
        key === 'ornamento' ? el('span', { class: 'hrg-orn', style: `color:${hr.color}`, text: '◆' }) : null,
        el('div', { class: 'hrg-text' }, Array.from({ length: 7 }, () => el('i')))
      ]);
    };
    const tiles = R.RULES.map(r => el('button', {
      class: 'hrg-tile' + (hr.style === r.key ? ' on' : ''),
      onclick: () => { hr.style = r.key; App.changed('Filete do cabeçalho: ' + r.label); rerender(); }
    }, [el('div', { class: 'hrg-spread' }, [page('left', r.key), page('right', r.key)]), el('span', { text: r.label })]));
    const num = (k, label, step, min, max) => App.field(label, App.bind(hr, k, 'number', { step, min, max, onChange: () => rerender() }));
    return el('div', { class: 'field wide hrg' }, [
      el('span', { class: 'flabel', text: 'Filete abaixo do cabeçalho (galeria)' }),
      el('div', { class: 'hrg-grid' }, tiles),
      el('div', { class: 'inline wrap' }, [
        App.field('Cor', App.bind(hr, 'color', 'color', { fallback: '#6b6b6b', onChange: () => rerender() })),
        num('weight', 'Espessura (pt)', 0.1, 0.2, 3),
        num('gap', 'Distância até o texto (mm)', 0.2, 0.8, 10),
        el('label', { class: 'chk' }, [App.bind(hr, 'spine', 'checkbox', { onChange: () => rerender() }), ' As linhas se encontram na lombada (livro aberto)'])
      ]),
      s.header === 'none' ? el('p', { class: 'small warn', text: 'O cabeçalho está desligado: escolha um cabeçalho acima para ver o filete.' }) : null
    ]);
  }
  App.headerRuleGallery = gallery;
})();
