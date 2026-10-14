/* global App */
// Tipografia e paginação: o acabamento de um livro feito à mão, aplicado automaticamente.
(function () {
  const { el, $, D } = App;

  function render() {
    const s = App.project.settings;
    const f = App.project.front;
    const v = $('#view-typo');
    v.innerHTML = '';
    const { field, bind, card } = App;
    const rerender = () => render();
    if (!s.index) s.index = { enabled: true, title: 'Índice remissivo', columns: 2 };
    const rep = App.lastRender && App.lastRender.typo;
    const periodical = App.project.kind === 'magazine' || App.project.kind === 'newspaper';

    // ---------- índice remissivo
    const terms = App.typoTools ? App.typoTools.terms() : [];
    const newTerm = el('input', { type: 'text', placeholder: 'Ex.: Revolução Francesa' });
    const termRows = el('div', { class: 'ix-terms' }, terms.length ? terms.map(t => el('div', { class: 'ix-row' }, [
      el('strong', { text: t.term }),
      el('span', { class: 'muted small', text: `${t.count} marcação(ões)${t.subs.size ? ' · subentradas: ' + [...t.subs.values()].join(', ') : ''}` }),
      el('button', { class: 'ghost', text: 'Marcar todas', title: 'Marca as ocorrências ainda não marcadas desta palavra no livro', onclick: () => { const n = App.typoTools.markAll(t.term, t.term, ''); App.changed('Índice: ' + t.term); App.toast(n ? `${n} nova(s) ocorrência(s) de “${t.term}” marcada(s).` : 'Nenhuma ocorrência nova encontrada.'); rerender(); } }),
      el('button', { class: 'ghost', text: 'Renomear', onclick: async () => { const nv = await App.prompt('Renomear entrada do índice', 'Entrada', t.term); if (nv && nv.trim() && nv.trim() !== t.term) { App.typoTools.renameTerm(t.term, nv.trim()); App.changed('Índice: entrada renomeada'); rerender(); } } }),
      el('button', { class: 'ghost danger', text: 'Remover', onclick: () => { App.typoTools.removeTerm(t.term); App.changed('Índice: entrada removida'); rerender(); } })
    ])) : [el('p', { class: 'muted small', text: 'Nenhum termo marcado. Selecione uma palavra no editor e clique em “📇 Índice”, ou digite um termo abaixo para marcar todas as ocorrências.' })]);

    // ---------- notas laterais precisam de margem externa larga
    const sideNarrow = s.notesMode === 'side' && Number(s.marginOuter) < 35;

    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Tipografia e paginação' }),
      el('p', { class: 'muted', text: 'O acabamento de um livro feito à mão, aplicado automaticamente em cada paginação (prévia e exportação). Todos os ajustes são mínimos e invisíveis ao leitor — o resultado é um texto mais uniforme e páginas mais bem resolvidas.' }),
      el('div', { class: 'inline wrap' }, [el('button', { text: '↺ Restaurar o acabamento tipográfico padrão', title: 'Grade, justificação, exceções, notas, numeração, ABNT, índice e sumário voltam ao padrão do sistema (pode ser desfeito com Ctrl+Z)', onclick: async () => {
        const ok = await App.confirmPreview('Acabamento tipográfico', 'Voltar estas opções ao padrão do sistema? (pode ser desfeito com Ctrl+Z)', ['Grade de linha de base, justificação fina e exceções de hifenização', 'Ajuste da última página', 'Notas no rodapé, numeração das páginas sem romanos', 'Referências e citações no estilo do livro', 'Índice remissivo (os termos marcados continuam) e sumário pontilhado']);
        if (!ok) return;
        const d = D.DEFAULT_SETTINGS;
        ['baselineGrid', 'fineJustify', 'hyphenExceptions', 'lastPageAdjust', 'lastPageMinLines', 'notesMode', 'endnotesTitle', 'frontNumbering', 'referenceStyle', 'quoteStyle'].forEach(k => { s[k] = JSON.parse(JSON.stringify(d[k])); });
        s.index = JSON.parse(JSON.stringify(d.index));
        f.tocStyle = 'dots';
        App.project.layoutAdjust = {};
        App.changed('Acabamento tipográfico padrão'); rerender();
      } })]),
      rep ? el('p', { class: 'small good', text: `Última paginação: ${rep.gridded || 0} blocos na grade · ${rep.fixed || 0} de ${rep.loose || 0} parágrafos com linhas frouxas corrigidos${App.lastRender.shortEnds && App.lastRender.shortEnds.length ? ` · ${App.lastRender.shortEnds.length} capítulo(s) ainda com poucas linhas na última página` : ''}.` }) : null,

      card('Grade de linha de base e páginas espelhadas', [
        el('label', { class: 'chk full' }, [bind(s, 'baselineGrid', 'checkbox', { disabled: periodical }), ' Alinhar as linhas à grade (as linhas de páginas opostas ficam na mesma altura)']),
        el('p', { class: 'small muted span-all', text: 'Títulos, imagens, tabelas, citações e caixas passam a ocupar um número inteiro de linhas: o texto que vem depois volta à grade, e as linhas da página da esquerda e da direita coincidem — marca registrada de livros bem diagramados. Os espaços antes e depois dos títulos são arredondados para múltiplos da entrelinha.' })
      ], periodical ? 'Em revistas e jornais (colunas), a grade não é aplicada.' : ''),

      card('Justificação e hifenização', [
        el('label', { class: 'chk full' }, [bind(s, 'fineJustify', 'checkbox'), ' Justificação fina: corrigir linhas frouxas e “rios” com ajuste mínimo de entreletra e de espaço entre palavras']),
        el('label', { class: 'chk' }, [bind(s, 'hyphenate', 'checkbox'), ' Hifenização automática (português)']),
        field('Dicionário de exceções de hifenização', bind(s, 'hyphenExceptions', 'textarea', { rows: 5, placeholder: 'Uma palavra por linha. Ex.:\nan-ti-cons-ti-tu-cio-nal (hífens = únicos pontos de quebra)\nDiagramador (sem hífen = nunca divide)', label: 'Exceções de hifenização' }), 'Hífens marcam onde a palavra pode ser dividida; sem hífen, a palavra nunca é dividida (nomes próprios, marcas, termos técnicos).', 'wide')
      ], 'Cada parágrafo com linhas muito abertas é testado com pequenas variações (até ±2% na entreletra e ±5% no espaço entre palavras); fica a que deixa o texto mais uniforme.'),

      card('Ajuste da última página', [
        el('label', { class: 'chk full' }, [bind(s, 'lastPageAdjust', 'checkbox'), ' Evitar poucas linhas sozinhas na última página do capítulo']),
        field('Mínimo de linhas na última página', bind(s, 'lastPageMinLines', 'number', { min: 1, max: 8, step: 1 })),
        el('button', { text: '↺ Recalcular os ajustes', title: 'Descarta os ajustes salvos e calcula de novo na próxima paginação', onclick: () => { App.project.layoutAdjust = {}; App.changed('Ajustes de última página recalculados'); } })
      ], 'Quando um capítulo termina com menos linhas que o mínimo no topo da última página, ele é levemente encolhido (as linhas voltam para a página anterior); se não der, é levemente expandido (mais linhas passam para a última página). Os ajustes ficam salvos no livro e só são refeitos quando o capítulo muda.'),

      card('Notas', [
        field('Onde ficam as notas', bind(s, 'notesMode', 'select', { options: [{ value: 'footnote', label: 'Rodapé da página (padrão)' }, { value: 'chapter', label: 'Fim de cada capítulo (notas de fim)' }, { value: 'book', label: 'Fim do livro, agrupadas por capítulo' }, { value: 'side', label: 'Margem externa (notas laterais)' }], onChange: rerender }), periodical ? 'Revistas e jornais usam notas de rodapé.' : ''),
        s.notesMode === 'chapter' || s.notesMode === 'book' ? field('Título da seção de notas', bind(s, 'endnotesTitle', 'text', { placeholder: 'Notas' })) : null,
        field('Numeração das notas', bind(s, 'footnoteNumbering', 'select', { options: [{ value: 'book', label: 'Contínua no livro' }, { value: 'chapter', label: 'Reinicia a cada capítulo' }] })),
        sideNarrow ? el('div', { class: 'warn-box span-all' }, [
          el('span', { text: `A margem externa tem ${App.fmtNum(s.marginOuter)} mm: as notas laterais ficam muito estreitas. Recomendado: 40 a 50 mm.${s.standard === 'cedet' ? ' (No CEDET, a margem de segurança de 20 mm continua respeitada.)' : ''}` }),
          el('button', { text: 'Ampliar a margem externa para 45 mm', onclick: () => { s.marginOuter = 45; App.changed('Margem externa para notas laterais'); rerender(); } })
        ]) : null
      ], 'As notas continuam sendo inseridas do mesmo jeito no editor (¹ Nota); aqui você escolhe só onde elas aparecem no livro. Notas de fim recebem números com ligação no PDF; notas laterais ficam na margem externa, na altura da chamada.'),

      card('Numeração das páginas', [
        field('Páginas pré-textuais', bind(s, 'frontNumbering', 'select', { options: [{ value: 'none', label: 'Sem número (padrão da maioria dos livros)' }, { value: 'roman', label: 'Algarismos romanos (i, ii, iii…) — livros acadêmicos e técnicos' }] })),
        el('label', { class: 'chk' }, [bind(s, 'numberFromFirstChapter', 'checkbox', { disabled: s.frontNumbering === 'roman' }), ' Página 1 = primeiro capítulo']),
        el('p', { class: 'small muted span-all', text: s.frontNumbering === 'roman' ? 'Com romanos, as páginas antes do 1º capítulo são i, ii, iii…; o sumário e as listas mostram o número em romano, e a contagem em algarismos arábicos recomeça no 1º capítulo. A ficha catalográfica sai como “xii, 230 p.”.' : 'ABNT: as páginas pré-textuais são contadas, mas o número só aparece a partir da primeira página do texto.' })
      ]),

      card('Normas ABNT', [
        field('Referências', bind(s, 'referenceStyle', 'select', { options: [{ value: 'hanging', label: 'Recuo pendente (padrão editorial)' }, { value: 'abnt', label: 'ABNT NBR 6023 — alinhadas à esquerda, espaço simples, uma linha em branco entre elas' }] })),
        field('Citação longa', bind(s, 'quoteStyle', 'select', { options: [{ value: 'book', label: 'Estilo do livro' }, { value: 'abnt', label: 'ABNT NBR 10520 — recuo de 4 cm, letra menor, espaço simples, sem aspas' }] })),
        el('div', { class: 'inline wrap span-all' }, [
          el('button', { class: 'primary', text: 'Aplicar as normas ABNT', onclick: async () => {
            const ok = await App.confirmPreview('Normas ABNT', 'Aplicar as normas ABNT a este livro?', ['Referências: NBR 6023 (alinhadas à esquerda, separadas por linha em branco)', 'Citações longas: NBR 10520 (recuo de 4 cm, letra menor, sem aspas)', 'Legendas numeradas com listas de figuras, tabelas e quadros', 'Notas de rodapé numeradas em sequência']);
            if (!ok) return;
            Object.assign(s, { referenceStyle: 'abnt', quoteStyle: 'abnt', captionNumbering: true, notesMode: 'footnote', footnoteNumbering: 'book' });
            App.changed('Normas ABNT aplicadas'); rerender();
          } }),
          el('span', { class: 'small muted', text: 'No editor, o botão “ABNT ▾” monta referências (livro, capítulo, artigo, site, tese) e citações autor-data, e ordena as referências de A a Z.' })
        ])
      ]),

      card('Índice remissivo', [
        el('label', { class: 'chk full' }, [bind(s.index, 'enabled', 'checkbox'), ' Gerar o índice remissivo nas páginas finais']),
        field('Título', bind(s.index, 'title', 'text', { placeholder: 'Índice remissivo' })),
        field('Colunas', bind(s.index, 'columns', 'select', { options: [{ value: 1, label: '1 coluna' }, { value: 2, label: '2 colunas' }, { value: 3, label: '3 colunas' }], onChange: x => { s.index.columns = Number(x); } })),
        el('div', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'Adicionar termo e marcar todas as ocorrências no livro' }), el('div', { class: 'inline' }, [newTerm, el('button', { text: 'Marcar ocorrências', onclick: () => {
          const t = newTerm.value.trim();
          if (!t) return;
          const n = App.typoTools.markAll(t, t, '');
          App.changed('Índice: ' + t);
          App.toast(n ? `${n} ocorrência(s) de “${t}” marcada(s).` : `Nenhuma ocorrência de “${t}” encontrada no texto.`);
          rerender();
        } })])]),
        el('div', { class: 'field wide' }, [el('span', { class: 'flabel', text: `Termos marcados (${terms.length})` }), termRows])
      ], 'Marque os termos no texto (botão “📇 Índice” no editor). O índice é montado em ordem alfabética, agrupado por letra, com as páginas de cada ocorrência — e os números são atualizados a cada paginação.'),

      card('Figuras, tabelas e quadros', [
        el('label', { class: 'chk full' }, [bind(s, 'captionNumbering', 'checkbox'), ' Numerar automaticamente: Figura 1, Gráfico 1, Tabela 1, Quadro 1']),
        el('div', { class: 'inline wrap span-all' }, [
          el('label', { class: 'chk' }, [bind(f, 'listFigures', 'checkbox'), ' Lista de figuras']),
          el('label', { class: 'chk' }, [bind(f, 'listCharts', 'checkbox'), ' Lista de gráficos']),
          el('label', { class: 'chk' }, [bind(f, 'listTables', 'checkbox'), ' Lista de tabelas']),
          el('label', { class: 'chk' }, [bind(f, 'listQuadros', 'checkbox'), ' Lista de quadros'])
        ])
      ], 'Quadro = tabela de informações em texto (escolha “Quadro” ao inserir a tabela). Para citar no texto, use “↪ Referência” no editor: entra “ver Figura 3, p. 41”, que se atualiza sozinho quando a numeração ou a página mudam.'),

      card('Modelo do sumário', [
        el('div', { class: 'toc-styles span-all' }, D.TOC_STYLES.map(t => el('button', {
          class: 'toc-style-card' + ((f.tocStyle || 'dots') === t.key ? ' on' : ''),
          onclick: () => { f.tocStyle = t.key; App.changed('Modelo do sumário: ' + t.label); rerender(); }
        }, [el('div', { class: 'toc-sample toc-sample-' + t.key }, [
          el('div', {}, [el('span', { class: 'ts-n', text: '9' }), el('span', { class: 'ts-t', text: 'O começo' }), el('span', { class: 'ts-d' }), el('span', { class: 'ts-p', text: '9' })]),
          t.key === 'summary' ? el('div', { class: 'ts-sum', text: 'Resumo breve do capítulo.' }) : null,
          el('div', {}, [el('span', { class: 'ts-n', text: '27' }), el('span', { class: 'ts-t', text: 'A travessia' }), el('span', { class: 'ts-d' }), el('span', { class: 'ts-p', text: '27' })])
        ]), el('strong', { text: t.label }), el('span', { class: 'small muted', text: t.desc })]))),
        (f.tocStyle === 'summary') ? el('p', { class: 'small muted span-all', text: 'Os resumos de cada capítulo são escritos em Dados e páginas iniciais › Sumário.' }) : null
      ])
    ]));
  }

  App.hooks.viewRender.typo = render;
})();
