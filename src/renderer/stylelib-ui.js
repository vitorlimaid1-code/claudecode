/* global App */
// Biblioteca de estilos: um estilo de formatação pronto para cada gênero, com amostra visual.
// Um clique aplica a todo o livro (fontes, tamanhos, títulos, subtítulos, parágrafos,
// alinhamento, capitular, cabeçalho e separador). Tudo continua editável em “Estilos de texto”.
(function () {
  const { el, $, D } = App;

  const SAMPLE_TITLE = { romance: 'O último verão', poesia: 'Mar de dentro', terror: 'A casa no fim da rua', suspense: 'Testemunha', fantasia: 'O reino de cinzas', ficcaocientifica: 'Órbita zero', contos: 'Histórias da varanda', infantil: 'O dragão dorminhoco', autoajuda: 'Comece pelo agora', biografia: 'Uma vida inteira', religioso: 'Caminhos de fé', academico: 'Introdução ao método', naoficcao: 'Como pensamos', humanas: 'Sociedade e memória', historia: 'O império e o porto', filosofia: 'Sobre o tempo', jornalismo: 'Dentro da notícia', culinaria: 'Cozinha de família' };
  const TEXT = 'Era uma manhã clara quando tudo começou. As palavras chegaram devagar, uma depois da outra, e encontraram o seu lugar na página — como se sempre tivessem estado ali.';
  const POEM = 'Há um mar de dentro<br>que ninguém navega:<br>só a palavra entra<br>e a maré a leva.';

  function css(st, base) {
    const out = [];
    const font = st.font || base.font;
    if (font) out.push(`font-family:'${font}',Georgia,serif`);
    if (st.italic) out.push('font-style:italic');
    if (st.bold) out.push('font-weight:700');
    if (st.uppercase) out.push('text-transform:uppercase');
    if (st.smallcaps) out.push('font-variant:small-caps');
    if (st.letterSpacing) out.push(`letter-spacing:${st.letterSpacing}em`);
    if (st.color) out.push(`color:${st.color}`);
    if (st.align) out.push(`text-align:${st.align}`);
    return out.join(';');
  }

  function card(key, p) {
    const s = D.applyGenrePreset(JSON.parse(JSON.stringify(D.DEFAULT_SETTINGS)), key);
    const st = s.styles;
    const k = 0.62; // escala da amostra
    const active = App.project.genre === key;
    return el('div', { class: 'sl-card' + (active ? ' active' : '') }, [
      el('div', { class: 'sl-page', style: { background: s.pageColor || '#fff' } }, [
        el('div', { class: 'sl-label', style: css(Object.assign({}, st.chapterLabel || {}), st.body) + `;font-size:${(st.chapterLabel.size || 9) * k}pt`, text: s.chapterNumbering === 'none' ? '' : `${(s.chapterLabel || '').trim()} 1`.trim() }),
        el('div', { class: 'sl-title', style: css(st.chapterTitle, st.body) + `;font-size:${(st.chapterTitle.size || 22) * k}pt` , text: SAMPLE_TITLE[key] || p.label }),
        p.separatorLibrary ? el('img', { class: 'sl-sep', src: `app://local/assets/library/separadores/${p.separatorLibrary}.png` }) : el('div', { class: 'sl-rule' }),
        key === 'poesia'
          ? el('div', { class: 'sl-body', style: css(Object.assign({}, st.body, { align: 'left' }), st.body) + `;font-size:${st.body.size * k}pt;line-height:${st.body.lineHeight}`, html: POEM })
          : el('div', { class: 'sl-body', style: css(st.body, st.body) + `;font-size:${st.body.size * k}pt;line-height:${st.body.lineHeight};text-indent:${st.body.indent || 0}em` }, [
            s.dropCap ? el('span', { class: 'sl-drop', style: `font-family:'${st.chapterTitle.font || st.body.font}'`, text: TEXT[0] }) : null, s.dropCap ? TEXT.slice(1) : TEXT
          ]),
        key === 'poesia' ? null : el('div', { class: 'sl-h2', style: css(st.h2, st.body) + `;font-size:${(st.h2.size || 15) * k}pt`, text: 'Um título de seção' })
      ]),
      el('div', { class: 'sl-foot' }, [
        el('div', {}, [el('strong', { text: p.label }), el('div', { class: 'muted small', text: `${st.body.font} ${st.body.size} pt · títulos em ${st.chapterTitle.font || st.body.font} · ${st.body.align === 'justify' ? 'justificado' : 'alinhado à esquerda'}` })]),
        el('button', { class: active ? '' : 'primary', text: active ? '✓ Em uso — reaplicar' : 'Aplicar ao livro', onclick: async () => { if (await App.genre.apply(key, true)) { App.toast(`Estilo “${p.label}” aplicado a todo o livro.`); render(); } } })
      ])
    ]);
  }

  function render() {
    const v = $('#view-stylelib');
    if (!v) return;
    v.innerHTML = '';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Biblioteca de estilos' }),
      el('p', { class: 'muted', text: 'Estilos prontos, um para cada gênero. “Aplicar ao livro” formata todo o documento de uma vez — títulos, subtítulos, texto, parágrafos, capitular, cabeçalhos e separador — mantendo o formato da página e as margens. Ajustes finos ficam em “Estilos de texto”.' }),
      el('div', { class: 'sl-grid' }, Object.entries(D.GENRE_PRESETS).map(([k, p]) => card(k, p)))
    ]));
  }

  App.hooks.viewRender.stylelib = render;
  App.styleLib = { render };
})();
