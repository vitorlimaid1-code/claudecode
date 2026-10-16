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
      ], 'Marque os termos no texto (botão “📇 Índice” no editor). O índice é montado em ordem alfabética, agrupado por letra, com as páginas de cada ocorrência — e os números são atualizados a cada paginação.')
    ]));
  }

  App.hooks.viewRender.typo = render;
})();
