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
        el('div', { class: 'inline' }, [/^h[234]$/.test(def.key) ? el('button', { class: 'small-btn', text: '✦ Caixa alta espaçada', title: 'Sem serifa geométrica em negrito, maiúsculas e letras espaçadas, à esquerda (depois ajuste fonte, tamanho e posição à vontade)', onclick: () => { Object.assign(st, JSON.parse(JSON.stringify(D.HEADING_PRESETS.spaced[def.key]))); App.changed('Estilo: ' + def.label + ' em caixa alta espaçada'); rerender(); } }) : null, el('button', { class: 'ghost small-btn', text: '↺ Padrão deste estilo', onclick: () => { s.styles[def.key] = JSON.parse(JSON.stringify(D.DEFAULT_STYLES[def.key])); App.changed('Estilo restaurado: ' + def.label); rerender(); } })])
      ]);
    });
    const typesetBar = el('div', { class: 'card preset' }, [
      el('h3', { text: 'Conjuntos tipográficos' }),
      el('div', { class: 'inline wrap', id: 'typesetRow' }, [el('span', { class: 'muted', text: 'Carregando…' })]),
      el('p', { class: 'muted small', text: 'Salve todos os estilos atuais com um nome para reaplicar em outros livros. Ficam guardados neste computador.' })
    ]);
    // estilos de caractere: trechos dentro do parágrafo (Ênfase, Versalete, Termo estrangeiro…)
    if (!Array.isArray(s.charStyles)) s.charStyles = JSON.parse(JSON.stringify(D.DEFAULT_CHAR_STYLES));
    const csUsage = id => App.project.chapters.reduce((n, c) => n + (String(c.html).match(new RegExp(`data-cs="${id}"`, 'g')) || []).length, 0);
    const charCard = el('div', { class: 'card span-all', id: 'charStylesCard' }, [
      el('h3', { text: 'Estilos de caractere' }),
      el('p', { class: 'muted small', text: 'Para trechos dentro do parágrafo. Selecione o texto na página e use “Aa Estilo ▾” na barra que aparece. Mudar um estilo aqui muda, de uma vez, todos os trechos marcados com ele no livro (e no EPUB e no DOCX).' })
    ].concat(s.charStyles.map((cs, i) => {
      const sample = el('div', { class: 'cs-sample', html: `Um trecho com o estilo <span style="${D.charStyleDecl(cs)}">${App.escape(cs.name)}</span> no meio do texto.` });
      const upd = () => { sample.querySelector('span').style.cssText = D.charStyleDecl(cs); sample.querySelector('span').textContent = cs.name; App.ensureFonts([cs.font]); };
      const chk = (k, label) => el('label', { class: 'chk' }, [bind(cs, k, 'checkbox', { onChange: upd, label: 'Estilo de caractere: ' + cs.name }), ' ' + label]);
      return el('div', { class: 'cs-row' }, [
        sample,
        field('Nome', bind(cs, 'name', 'text', { onChange: upd })),
        field('Fonte', bind(cs, 'font', 'select', { options: App.fontOptions(true), onChange: upd, label: 'Estilo de caractere: ' + cs.name })),
        field('Tamanho %', bind(cs, 'sizePct', 'number', { step: 1, min: 50, max: 200, onChange: upd })),
        field('Espaço letras', bind(cs, 'letterSpacing', 'number', { step: 0.01, min: -0.1, max: 0.5, onChange: upd })),
        el('button', { class: 'ghost small-btn', text: '✕', title: csUsage(cs.id) ? `Excluir (os ${csUsage(cs.id)} trecho(s) marcados voltam ao texto normal)` : 'Excluir', onclick: () => {
          const id = cs.id;
          App.project.chapters.forEach(c => { if (String(c.html).includes(`data-cs="${id}"`)) c.html = String(c.html).replace(new RegExp(`<span data-cs="${id}">([\\s\\S]*?)</span>`, 'g'), '$1'); });
          s.charStyles.splice(i, 1); App.changed('Estilo de caractere excluído: ' + cs.name); rerender();
        } }),
        el('div', { class: 'cs-flags' }, [chk('italic', 'Itálico'), chk('bold', 'Negrito'), chk('smallcaps', 'Versalete'), chk('uppercase', 'Maiúsculas'), chk('underline', 'Sublinhado'),
          el('label', { class: 'chk' }, ['Cor ', bind(cs, 'color', 'color', { onChange: upd, fallback: '#000000' })]),
          el('span', { class: 'small muted', text: csUsage(cs.id) ? `usado em ${csUsage(cs.id)} trecho(s)` : 'ainda não usado' })])
      ]);
    })).concat([el('div', { class: 'inline' }, [
      el('button', { text: '+ Novo estilo de caractere', onclick: async () => { const name = await App.prompt('Novo estilo de caractere', 'Nome', 'Meu estilo'); if (!name) return; s.charStyles.push({ id: 'cs' + Date.now().toString(36), name, font: '', sizePct: 100, color: '', italic: false, bold: false, smallcaps: false, uppercase: false, underline: false, letterSpacing: 0, background: '' }); App.changed('Novo estilo de caractere: ' + name); rerender(); } }),
      el('button', { class: 'ghost small-btn', text: '↺ Estilos de caractere padrão', onclick: () => { const used = new Set(s.charStyles.map(x => x.id)); D.DEFAULT_CHAR_STYLES.forEach(d => { const k = s.charStyles.findIndex(x => x.id === d.id); if (k >= 0) s.charStyles[k] = JSON.parse(JSON.stringify(d)); else if (!used.has(d.id)) s.charStyles.push(JSON.parse(JSON.stringify(d))); }); App.changed('Estilos de caractere padrão'); rerender(); } })
    ])]));
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Estilos de texto' }),
      el('p', { class: 'muted', text: 'Hierarquia: Título do capítulo → T1 (seção) → T2 (subtítulo) → T3 (intertítulo). No editor, escolha o estilo na caixa “Texto principal”. Fontes diferentes podem ser usadas para texto, títulos, citações, poesias, notas, legendas, cabeçalhos, sumário e referências.' }),
      typesetBar,
      charCard,
      // galeria de estilos de legenda: o escolhido vale para o livro todo (cada legenda pode ter o seu no editor)
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Estilo das legendas (figuras, gráficos e tabelas)' }),
        el('p', { class: 'muted small', text: 'Clique para aplicar a todas as legendas do livro. No editor, selecione um texto e use “Legenda ▾” para transformá-lo em legenda (ou para dar a uma legenda um estilo próprio).' }),
        el('div', { class: 'qs-gallery' }, D.CAPTION_STYLES.map(cs => el('button', {
          class: 'qs-cap qs-cap-' + cs.key + ((s.captionStyle || 'classica') === cs.key ? ' on' : ''), title: cs.desc,
          onclick: () => { s.captionStyle = cs.key; App.changed('Estilo das legendas: ' + cs.label); rerender(); }
        }, [el('span', { class: 'qs-cap-label', text: 'Figura 1' }), el('span', { class: 'qs-cap-text', text: ' – ' + cs.label }), el('div', { class: 'small muted', text: cs.desc })])))
      ])
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
