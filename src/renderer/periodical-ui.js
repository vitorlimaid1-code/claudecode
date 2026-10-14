/* global App */
// Revista e jornal: tipo de publicação, nome da publicação (cabeçalho/masthead), colunas
// fixas (2 ou 3) e dados de cada matéria (chapéu, linha fina, assinatura, colunas próprias e
// se começa em página nova ou continua na mesma página).
(function () {
  const { el, $, D } = App;
  const KINDS = { book: 'Livro', magazine: 'Revista', newspaper: 'Jornal' };

  function formatId(w, h) { const f = D.PAGE_FORMATS.find(x => Math.abs(x.width - w) < 0.3 && Math.abs(x.height - h) < 0.3); return f ? f.id : 'custom'; }

  // Ajustes de partida de cada tipo (tudo continua editável depois)
  function applyKind(kind) {
    const p = App.project;
    const s = p.settings;
    const f = p.front;
    p.kind = kind;
    if (kind === 'book') {
      s.columns = 1;
      Object.assign(f, { titlePage: true, copyright: true, toc: true, tocTitle: f.tocTitle === 'Nesta edição' ? 'Sumário' : f.tocTitle });
      s.chapterStartRight = false;
      if (s.chapterNumbering === 'none') s.chapterNumbering = 'arabic';
      return;
    }
    const mag = kind === 'magazine';
    const [w, h] = mag ? [202, 266] : [280, 430];
    Object.assign(s, { pageWidth: w, pageHeight: h, pageFormat: formatId(w, h), standard: '', folioGap: 0, outputSheet: { mode: 'trim', w: 210, h: 297, marks: true } }); // revista/jornal: layout livre (o modelo CEDET é para livros)
    Object.assign(s, mag ? { marginTop: 16, marginBottom: 18, marginInner: 16, marginOuter: 13 } : { marginTop: 14, marginBottom: 16, marginInner: 13, marginOuter: 13 });
    Object.assign(s, { columns: mag ? 2 : 3, columnGap: mag ? 5 : 4, columnRule: !mag ? true : s.columnRule !== false, chapterStartRight: false, chapterNumbering: 'none', dropCap: mag, hyphenate: true, indentFirstParagraph: false });
    s.styles.body.size = mag ? 9.5 : 9;
    s.styles.body.lineHeight = mag ? 1.35 : 1.3;
    s.styles.body.align = 'justify';
    s.styles.chapterTitle = Object.assign(s.styles.chapterTitle, { size: mag ? 26 : 30, align: 'left', bold: !mag, spaceBefore: 4, spaceAfter: 3 });
    Object.assign(f, { halfTitle: false, titlePage: false, copyright: false, dedication: false, epigraph: false, toc: false, tocTitle: 'Nesta edição' });
    p.masthead.show = true;
    if (!p.masthead.name) p.masthead.name = p.meta.title;
    if (!p.masthead.date) p.masthead.date = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    p.chapters.forEach(c => { c.numbered = false; });
  }

  async function chooseKind(kind) {
    if (kind === App.project.kind) return;
    const items = kind === 'book' ? ['Uma coluna', 'Página de rosto, ficha e sumário', 'Capítulos em página ímpar'] :
      [kind === 'magazine' ? 'Formato 20,2 × 26,6 cm, 2 colunas, capitular' : 'Formato tabloide 28 × 43 cm, 3 colunas com fio', 'Nome da publicação no alto da primeira página e no cabeçalho', 'Sem páginas de rosto, ficha e sumário (podem ser ativados em Dados e páginas iniciais)', 'Matérias sem numeração; cada uma começa em página nova (ajustável)'];
    const ok = await App.confirmPreview('Tipo de publicação: ' + KINDS[kind], 'Aplicar os ajustes de partida deste tipo? Tudo continua editável depois.', items);
    if (!ok) return;
    applyKind(kind);
    App.changed('Tipo de publicação: ' + KINDS[kind]);
    render();
  }

  function render() {
    const v = $('#view-periodical');
    if (!v) return;
    v.innerHTML = '';
    const p = App.project;
    const s = p.settings;
    const m = p.masthead;
    const { field, bind, card } = App;
    const periodical = p.kind === 'magazine' || p.kind === 'newspaper';
    const rer = () => render();
    const seg = (opts, cur, on) => el('div', { class: 'kdp-seg' }, opts.map(([v2, l]) => el('button', { class: String(cur) === String(v2) ? 'on' : '', text: l, onclick: () => on(v2) })));
    const logo = m.logo && p.assets[m.logo];
    const colsSel = c => { const sel = el('select', { onchange: e => { c.columns = Number(e.target.value); App.changed('Colunas da matéria'); } }, [[0, 'Padrão'], [1, '1 coluna'], [2, '2 colunas'], [3, '3 colunas']].map(([a, b]) => el('option', { value: a, text: b }))); sel.value = c.columns || 0; return sel; };
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Revista e jornal' }),
      el('p', { class: 'muted', text: 'Diagrame revistas, jornais, informativos e boletins com colunas fixas. Cada capítulo da lista é uma matéria.' }),
      card('Tipo de publicação', [seg(Object.entries(KINDS).filter(([k]) => k !== 'book'), p.kind, chooseKind)], periodical ? 'Revista e jornal têm a sua própria mesa de trabalho (botão no alto, ao lado do nome do sistema), separada da do livro: formato, colunas e exportação próprios.' : 'Este projeto é um livro. Use a mesa “Revista e jornal”, no alto, para diagramar uma publicação.', 'span-all'),
      periodical ? card('Colunas (fixas)', [
        seg([[2, '2 colunas'], [3, '3 colunas']], s.columns, n => { s.columns = n; App.changed(n + ' colunas'); rer(); }),
        field('Espaço entre colunas (mm)', bind(s, 'columnGap', 'number', { step: 0.5, min: 2, max: 15 })),
        el('label', { class: 'chk' }, [bind(s, 'columnRule', 'checkbox'), ' Fio vertical entre as colunas']),
        el('label', { class: 'chk' }, [bind(s, 'hyphenate', 'checkbox'), ' Hifenização (recomendada em colunas estreitas)']),
        el('label', { class: 'chk' }, [bind(s, 'dropCap', 'checkbox'), ' Letra capitular na abertura das matérias'])
      ], 'O texto é justificado e equilibrado entre as colunas. Imagens com alinhamento “largura total”, títulos T1 e tabelas ocupam todas as colunas.', 'span-all') : null,
      periodical ? card('Nome da publicação (cabeçalho da primeira página)', [
        el('label', { class: 'chk' }, [bind(m, 'show', 'checkbox'), ' Mostrar no alto da primeira página']),
        field('Nome da publicação', bind(m, 'name', 'text', { placeholder: p.meta.title })),
        field('Linha de apoio (slogan)', bind(m, 'tagline', 'text')),
        field('Edição / número', bind(m, 'edition', 'text', { placeholder: 'Ano 1 · Nº 1' })),
        field('Data', bind(m, 'date', 'text')),
        el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Logotipo' }), el('div', { class: 'inline' }, [
          logo ? el('img', { class: 'mini-thumb', src: App.assetUrl(m.logo) }) : el('span', { class: 'muted', text: 'Nenhum' }),
          el('button', { text: logo ? 'Trocar…' : 'Escolher…', onclick: async () => { const l = await App.api.pickImages({ title: 'Logotipo da publicação' }); if (!l) return; m.logo = await App.addAsset(l[0]); App.changed('Logotipo da publicação'); rer(); } }),
          logo ? el('button', { text: 'Remover', onclick: () => { m.logo = null; App.changed('Logotipo removido'); rer(); } }) : null
        ])])
      ], 'O nome, a edição e a data também aparecem no cabeçalho das páginas.', 'span-all') : null,
      periodical ? card('Matérias', [
        el('div', { class: 'articles' }, p.chapters.map((c, i) => el('div', { class: 'article-row' }, [
          el('div', { class: 'article-head' }, [
            el('strong', { text: `${i + 1}. ` }),
            el('a', { href: '#', text: c.title || 'Sem título', onclick: e => { e.preventDefault(); App.setView('chapter', c.id); } }),
            el('span', { class: 'grow' }),
            App.field('Colunas', colsSel(c)),
            el('label', { class: 'chk small' }, [bind(c, 'newPage', 'checkbox', { label: 'Início da matéria' }), ' Começa em página nova'])
          ]),
          el('div', { class: 'grid' }, [
            field('Chapéu (editoria)', bind(c, 'kicker', 'text', { placeholder: 'Ex.: CULTURA', label: 'Chapéu' })),
            field('Assinatura (autor/repórter)', bind(c, 'byline', 'text', { placeholder: 'Por …', label: 'Assinatura' })),
            field('Linha fina (subtítulo)', bind(c, 'lead', 'textarea', { rows: 2, label: 'Linha fina' }), '', 'wide')
          ])
        ]))),
        el('button', { text: '+ Nova matéria', onclick: () => App.chapters.add('Nova matéria', '<p>Texto da matéria.</p>' + App.blocks.phHtml(false) + '<p><br></p>', false) })
      ], 'Desmarque “Começa em página nova” para a matéria continuar logo abaixo da anterior, separada por um fio.', 'span-all') : null
    ]));
  }

  App.hooks.viewRender.periodical = render;
  App.periodical = { applyKind, render, KINDS };
})();
