/* global App */
// Estilos tipográficos nomeados (texto, T1/T2/T3, citação, poesia, referências, notas…)
// e conjuntos tipográficos salvos para reutilizar em outros livros.
(function () {
  const { el, $, api, D } = App;
  const bind = App.bind;
  const field = App.field;

  const FIELD_INFO = {
    font: ['Fonte', 'font'], size: ['Tamanho (pt)', 'number', 0.25, 5, 96], lineHeight: ['Entrelinha (×)', 'number', 0.05, 0.8, 3],
    color: ['Cor', 'color'], letterSpacing: ['Espaço entre letras (em)', 'number', 0.01, -0.1, 0.5], wordSpacing: ['Espaço entre palavras (em)', 'number', 0.01, -0.2, 1],
    indent: ['Recuo da 1ª linha (em)', 'number', 0.1, -5, 6], indentLeft: ['Recuo à esquerda (mm)', 'number', 0.5, 0, 80], indentRight: ['Recuo à direita (mm)', 'number', 0.5, 0, 80],
    spaceBefore: ['Espaço antes (mm)', 'number', 0.5, 0, 150], spaceAfter: ['Espaço depois (mm)', 'number', 0.5, 0, 40],
    align: ['Alinhamento', 'align'], italic: ['Itálico', 'checkbox'], bold: ['Negrito', 'checkbox'], uppercase: ['Maiúsculas', 'checkbox'], smallcaps: ['Versalete', 'checkbox'],
    background: ['Cor de fundo', 'color'], borderColor: ['Cor da borda', 'color']
  };
  const SAMPLE = {
    body: 'Era uma vez um livro que ainda não existia. Ele morava apenas na cabeça de quem o escrevia, entre cafés esfriados e frases riscadas.',
    chapterTitle: 'O começo de tudo', chapterLabel: 'Capítulo 1', h2: 'Título de seção (T1)', h3: 'Subtítulo (T2)', h4: 'Intertítulo (T3)',
    quote: '“A literatura é a maneira mais agradável de ignorar a vida.” Uma citação longa costuma ficar recuada e em corpo menor.',
    phrase: 'Nem tudo que é ouro fulgura.', poem: 'Minha terra tem palmeiras,\nonde canta o sabiá;\nas aves que aqui gorjeiam\nnão gorjeiam como lá.',
    epigraph: 'Escrever é esquecer.', reference: 'SOBRENOME, Nome. Título da obra. 2. ed. São Paulo: Editora, 2020.', caption: 'Figura 1 — Legenda da imagem',
    footnote: '1. Texto de uma nota de rodapé.', box: 'Caixa de destaque com uma informação importante.', table: 'Ano | Valor', header: 'MEU LIVRO', pageNumber: '27', toc: 'Capítulo 1  O começo ........ 9'
  };

  function sampleStyle(st, body) {
    const f = st.font || body.font;
    const css = [`font-family:"${f}",Georgia,serif`];
    if (st.size) css.push(`font-size:${Math.min(st.size, 30) * 1.3}px`);
    if (st.lineHeight) css.push(`line-height:${st.lineHeight}`);
    if (st.color) css.push(`color:${st.color}`);
    if (st.letterSpacing) css.push(`letter-spacing:${st.letterSpacing}em`);
    if (st.wordSpacing) css.push(`word-spacing:${st.wordSpacing}em`);
    if (st.align) css.push(`text-align:${st.align}`);
    if (st.italic) css.push('font-style:italic');
    if (st.bold) css.push('font-weight:700');
    if (st.uppercase) css.push('text-transform:uppercase');
    if (st.smallcaps) css.push('font-variant:small-caps');
    if (st.indent) css.push(`text-indent:${st.indent}em`);
    if (st.indentLeft) css.push(`padding-left:${st.indentLeft * 1.2}px`);
    if (st.background) css.push(`background:${st.background}`);
    if (st.borderColor) css.push(`border:1px solid ${st.borderColor};padding:6px 8px`);
    return css.join(';');
  }

  App.hooks.viewRender.styles = function () {
    const s = App.project.settings;
    const v = $('#view-styles');
    v.innerHTML = '';
    const rerender = () => App.hooks.viewRender.styles();
    const body = s.styles.body;
    App.ensureFonts(Object.values(s.styles).map(x => x.font).filter(Boolean));
    const cards = D.STYLE_DEFS.map(def => {
      const st = s.styles[def.key] || (s.styles[def.key] = {});
      const sample = el('div', { class: 'style-sample', style: { cssText: sampleStyle(st, body) } });
      sample.textContent = SAMPLE[def.key] || def.label;
      if (def.key === 'poem') sample.style.whiteSpace = 'pre-line';
      const refresh = () => { sample.style.cssText = sampleStyle(st, body) + (def.key === 'poem' ? ';white-space:pre-line' : ''); App.ensureFonts([st.font]); };
      const inputs = def.fields.map(k => {
        const [label, type, step, min, max] = FIELD_INFO[k];
        let input;
        if (type === 'font') input = bind(st, k, 'select', { options: App.fontOptions(def.key !== 'body'), onChange: refresh, label: 'Estilo: ' + def.label });
        else if (type === 'align') input = bind(st, k, 'select', { options: [{ value: 'justify', label: 'Justificado' }, { value: 'left', label: 'À esquerda' }, { value: 'center', label: 'Centralizado' }, { value: 'right', label: 'À direita' }], onChange: refresh, label: 'Estilo: ' + def.label });
        else if (type === 'checkbox') return el('label', { class: 'chk' }, [bind(st, k, 'checkbox', { onChange: refresh, label: 'Estilo: ' + def.label }), ' ' + label]);
        else if (type === 'color') input = bind(st, k, 'color', { onChange: refresh, label: 'Estilo: ' + def.label, fallback: k === 'background' ? '#ffffff' : '#000000' });
        else input = bind(st, k, 'number', { step, min, max, onChange: refresh, label: 'Estilo: ' + def.label });
        return field(label, input);
      });
      return el('details', { class: 'card style-card', open: def.key === 'body' || def.key === 'chapterTitle' }, [
        el('summary', {}, [el('strong', { text: def.label }), sample]),
        el('div', { class: 'grid' }, inputs),
        el('div', { class: 'inline' }, [el('button', { class: 'ghost small-btn', text: '↺ Padrão deste estilo', onclick: () => { s.styles[def.key] = JSON.parse(JSON.stringify(D.DEFAULT_STYLES[def.key])); App.changed('Estilo restaurado: ' + def.label); rerender(); } })])
      ]);
    });
    const typesetBar = el('div', { class: 'card preset' }, [
      el('h3', { text: 'Conjuntos tipográficos' }),
      el('div', { class: 'inline wrap', id: 'typesetRow' }, [el('span', { class: 'muted', text: 'Carregando…' })]),
      el('p', { class: 'muted small', text: 'Salve todos os estilos atuais com um nome para reaplicar em outros livros. Ficam guardados neste computador.' })
    ]);
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Estilos de texto' }),
      el('p', { class: 'muted', text: 'Hierarquia: Título do capítulo → T1 (seção) → T2 (subtítulo) → T3 (intertítulo). No editor, escolha o estilo na caixa “Texto principal”. Fontes diferentes podem ser usadas para texto, títulos, citações, poesias, notas, legendas, cabeçalhos, sumário e referências.' }),
      typesetBar
    ].concat(cards)));
    api.typesetsGet().then(sets => {
      const row = $('#typesetRow');
      if (!row) return;
      row.innerHTML = '';
      Object.keys(sets || {}).forEach(name => row.appendChild(el('span', { class: 'chip-group' }, [
        el('button', { class: 'chip', text: name, title: 'Aplicar', onclick: async () => { const ok = await App.confirmPreview('Aplicar conjunto tipográfico', `Substituir todos os estilos de texto por “${name}”?`, D.STYLE_DEFS.map(d => d.label)); if (!ok) return; s.styles = D.mergeSettings({ styles: JSON.parse(JSON.stringify(D.DEFAULT_STYLES)) }, { styles: sets[name] }).styles; App.changed('Conjunto tipográfico: ' + name); rerender(); } }),
        el('button', { class: 'chip x', text: '✕', title: 'Excluir conjunto', onclick: async () => { delete sets[name]; await api.typesetsSet(sets); rerender(); } })
      ])));
      row.appendChild(el('button', { text: '+ Salvar estilos atuais…', onclick: async () => { const name = await App.prompt('Salvar conjunto tipográfico', 'Nome do conjunto', 'Meu estilo'); if (!name) return; sets[name] = JSON.parse(JSON.stringify(s.styles)); await api.typesetsSet(sets); App.toast('Conjunto salvo.'); rerender(); } }));
    });
  };
})();
