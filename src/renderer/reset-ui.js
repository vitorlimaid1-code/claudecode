/* global App */
// Restaurar padrões: tudo o que o usuário personalizou volta ao original do sistema com um clique.
// “Este livro” altera só o livro aberto (pode ser desfeito com Ctrl+Z); “Sistema” vale para os próximos livros.
(function () {
  const { el, $, api, D } = App;

  const SYSTEM_ITEMS = [
    { key: 'meuPadrao', label: 'Meu padrão (configuração inicial dos livros novos)', done: 'Livros novos voltam a nascer no modelo CEDET.' },
    { key: 'formatos', label: 'Medidas editadas nos modelos de formato', done: 'Todos os formatos voltaram às medidas originais.', after: () => D.applyFormatOverrides({}) },
    { key: 'perfis', label: 'Perfis de exportação criados por você', done: 'Ficam só os perfis originais do sistema.' },
    { key: 'fichaFixa', label: 'Ficha catalográfica fixa', done: 'Livros novos começam com a ficha em branco (com o crédito do Cedet).' },
    { key: 'modelosFicha', label: 'Modelos de ficha salvos por você', done: 'Fica só a galeria original de modelos de ficha.' },
    { key: 'conjuntos', label: 'Conjuntos tipográficos salvos por você', done: 'Fica só a biblioteca de estilos original.' },
    { key: 'marcacoes', label: 'Favoritos e coleções da biblioteca de imagens', done: 'Favoritos e coleções removidos (as imagens continuam).' }
  ];
  const REMOVE_ITEMS = [
    { key: 'imagens', label: 'Imagens que você adicionou à biblioteca', done: 'Biblioteca de imagens com o conteúdo original. Os livros já feitos guardam as suas cópias.' },
    { key: 'fontes', label: 'Fontes que você adicionou à biblioteca de fontes', done: 'Biblioteca de fontes com as fontes originais.' }
  ];

  async function resetSystem(items, title) {
    const ok = await App.confirmPreview(title, 'Voltar ao padrão original do sistema?', items.map(i => i.label));
    if (!ok) return;
    await api.systemReset(items.map(i => i.key));
    items.forEach(i => i.after && i.after());
    if (items.some(i => i.key === 'imagens' || i.key === 'marcacoes') && App.library && App.library.reload) App.library.reload();
    if (items.some(i => i.key === 'fontes')) await App.refreshFonts();
    App.toast(items.length === 1 ? items[0].done : 'Padrões do sistema restaurados.', 5000);
    render();
  }

  function resetPrefs() {
    ['unit', 'zoom', 'previewWidth', 'helpShown2'].forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } });
    App.unit = 'mm';
    document.documentElement.style.removeProperty('--preview-w');
    if (App.preview && App.preview.resetMode) App.preview.resetMode();
    App.toast('Preferências da tela restauradas: milímetros, prévia de 1 página por vez e zoom automático.', 5000);
    render();
  }

  // ---------------------------------------------------------------- este livro
  const LAYOUT_KEYS = ['standard', 'pageFormat', 'pageWidth', 'pageHeight', 'pageColor', 'marginTop', 'marginBottom', 'marginInner', 'marginOuter',
    'bleed', 'bleedAuto', 'bleedTop', 'bleedBottom', 'bleedOuter', 'bleedInner', 'safety', 'cropMarks', 'folioGap', 'outputSheet',
    'columns', 'columnGap', 'columnRule', 'pageNumbers', 'numberFromFirstChapter', 'header'];
  const fresh = () => JSON.parse(JSON.stringify(D.DEFAULT_SETTINGS));

  const BOOK_ITEMS = [
    {
      label: 'Formato, margens, sangria, marcas de corte e numeração', desc: 'Volta ao modelo CEDET (15,5 × 23 cm, segurança de 20 mm, sangria de 5 mm, marcas de 0,25 pt).',
      run: () => { const s = App.project.settings, d = fresh(); LAYOUT_KEYS.forEach(k => { s[k] = d[k]; }); if (s.kdp) s.kdp.enabled = false; D.applyCedet(s); }
    },
    { label: 'Estilos de texto (fontes, tamanhos, títulos, parágrafos)', desc: 'Volta aos estilos padrão de título, texto, fonte e parágrafo.', run: () => { App.project.settings.styles = JSON.parse(JSON.stringify(D.DEFAULT_STYLES)); App.project.genre = ''; } },
    {
      label: 'Capítulos, capitulares, separadores, hifenização e notas', desc: 'Opções de texto e paginação do padrão do sistema.',
      run: () => { const s = App.project.settings, d = fresh(); Object.keys(d).filter(k => !LAYOUT_KEYS.includes(k) && k !== 'styles' && k !== 'kdp').forEach(k => { s[k] = d[k]; }); }
    },
    { label: 'Cores de páginas e de capítulos', desc: 'Remove as cores de página e de texto aplicadas a páginas e capítulos (o miolo volta ao preto no branco).', run: () => { App.project.pageStyles = {}; App.project.chapters.forEach(c => { if (c.style) { delete c.style.pageColor; delete c.style.textColor; delete c.style.titleColor; } }); } },
    { label: 'Crédito de distribuição da ficha', desc: 'Volta ao texto oficial do manual Cedet.', run: () => { App.project.catalog.distribution = D.CEDET.distribution; } },
    {
      label: 'Configurações da capa (mantém as imagens e o ISBN)', desc: 'Sangria, papel, lombada, perfil de cor, posição do código de barras e marcas voltam ao padrão.',
      run: () => {
        const old = App.project.cover || {};
        App.project.cover = null;
        const c = App.cover.ensure();
        c.images = old.images || {};
        c.isbnBarcode.isbn = (old.isbnBarcode && old.isbnBarcode.isbn) || '';
      }
    }
  ];

  async function resetBook(items, title) {
    const ok = await App.confirmPreview(title, 'Restaurar no livro aberto? (pode ser desfeito com Ctrl+Z)', items.map(i => i.label + ' — ' + i.desc));
    if (!ok) return;
    items.forEach(i => i.run());
    App.changed(items.length === 1 ? 'Padrão restaurado: ' + items[0].label : 'Livro restaurado ao padrão do sistema');
    App.toast('Restaurado. Use Desfazer (Ctrl+Z) se mudar de ideia.', 5000);
    render();
  }

  // ---------------------------------------------------------------- tela
  async function render() {
    const v = $('#view-reset');
    v.innerHTML = '';
    let st = {};
    try { st = (await api.systemCustomizations()) || {}; } catch (e) { /* sem informação */ }
    const badge = n => el('span', { class: 'chip ' + (n ? 'warn' : 'muted'), text: n ? `personalizado (${n})` : 'padrão' });
    const row = (label, desc, status, btnText, onclick, disabled) => el('div', { class: 'reset-row' }, [
      el('div', {}, [el('strong', { text: label }), desc ? el('div', { class: 'small muted', text: desc }) : null]),
      status || el('span'),
      el('button', { text: btnText, disabled: !!disabled, onclick })
    ]);
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Restaurar padrões' }),
      el('p', { class: 'muted', text: 'Tudo o que você alterou pode voltar ao padrão original do sistema. Em “Este livro”, a mudança vale só para o livro aberto e pode ser desfeita (Ctrl+Z). Em “Sistema”, vale para os próximos livros.' }),
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Este livro' }),
        ...BOOK_ITEMS.map(i => row(i.label, i.desc, null, '↺ Restaurar', () => resetBook([i], i.label))),
        el('div', { class: 'inline wrap' }, [el('button', { class: 'primary', text: '↺ Restaurar todo o livro ao padrão do sistema', onclick: () => resetBook(BOOK_ITEMS, 'Restaurar o livro') })]),
        el('p', { class: 'small muted', text: 'O texto, os capítulos e as imagens do livro nunca são apagados por estes botões.' })
      ]),
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Sistema (próximos livros)' }),
        ...SYSTEM_ITEMS.map(i => row(i.label, i.done, badge(st[i.key]), '↺ Restaurar', () => resetSystem([i], i.label), !st[i.key])),
        row('Preferências da tela', 'Unidade de medida, zoom e largura da prévia, ajuda inicial.', null, '↺ Restaurar', resetPrefs),
        el('div', { class: 'inline wrap' }, [el('button', { class: 'primary', text: '↺ Restaurar todos os padrões do sistema', onclick: () => resetSystem(SYSTEM_ITEMS, 'Restaurar todos os padrões').then(resetPrefs) })]),
        el('p', { class: 'small muted', text: 'Restaurar os padrões não apaga imagens nem fontes que você adicionou. Para removê-las, use as opções abaixo.' })
      ]),
      el('div', { class: 'card span-all' }, [
        el('h3', { text: 'Conteúdo adicionado às bibliotecas' }),
        ...REMOVE_ITEMS.map(i => row(i.label, i.done, badge(st[i.key]), 'Remover', () => resetSystem([i], 'Remover: ' + i.label), !st[i.key]))
      ])
    ]));
  }

  App.hooks.viewRender.reset = render;
})();
