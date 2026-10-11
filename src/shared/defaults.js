/*
 * Definições compartilhadas entre o processo principal (Node) e a interface.
 * Carregado via require() no main e via <script> no renderer.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookDefaults = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PAGE_FORMATS = [
    { id: '140x210', label: '14 × 21 cm (padrão brasileiro)', width: 140, height: 210 },
    { id: '160x230', label: '16 × 23 cm', width: 160, height: 230 },
    { id: '155x230', label: '15,5 × 23 cm', width: 155, height: 230 },
    { id: '120x180', label: '12 × 18 cm (bolso)', width: 120, height: 180 },
    { id: 'A5', label: 'A5 — 14,8 × 21 cm', width: 148, height: 210 },
    { id: '6x9', label: '6 × 9 pol. (KDP / Amazon)', width: 152.4, height: 228.6 },
    { id: '5.5x8.5', label: '5,5 × 8,5 pol.', width: 139.7, height: 215.9 },
    { id: '5x8', label: '5 × 8 pol.', width: 127, height: 203.2 },
    { id: '210x280', label: '21 × 28 cm (grande)', width: 210, height: 280 },
    { id: 'A4', label: 'A4 — 21 × 29,7 cm', width: 210, height: 297 },
    { id: 'custom', label: 'Personalizado…', width: null, height: null }
  ];

  // Fontes embutidas no aplicativo (funcionam offline e são incorporadas ao PDF)
  const BUNDLED_FONTS = [
    'EB Garamond',
    'Crimson Pro',
    'Libre Baskerville',
    'Lora',
    'Merriweather',
    'Cormorant Garamond',
    'Playfair Display'
  ];

  // Fontes comuns do sistema Windows
  const SYSTEM_FONTS = [
    'Georgia',
    'Palatino Linotype',
    'Book Antiqua',
    'Times New Roman',
    'Cambria',
    'Garamond',
    'Constantia',
    'Calibri',
    'Arial',
    'Segoe UI'
  ];

  const DEFAULT_SETTINGS = {
    pageFormat: '140x210',
    pageWidth: 140,
    pageHeight: 210,
    marginTop: 20,
    marginBottom: 22,
    marginInner: 22,
    marginOuter: 16,
    bleed: 0,
    cropMarks: false,

    bodyFont: 'EB Garamond',
    bodySize: 11.5,
    lineHeight: 1.4,
    paraIndent: 1.5,
    paraSpacing: 0,
    align: 'justify',
    hyphenate: true,
    indentFirstParagraph: false,
    widowsOrphans: 2,

    headingFont: 'EB Garamond',
    chapterTitleSize: 22,
    chapterTitleAlign: 'center',
    chapterTitleUppercase: false,
    chapterLabel: 'Capítulo',
    chapterNumbering: 'arabic',
    chapterDrop: 35,
    chapterStartRight: true,
    dropCap: true,
    smallCapsFirstLine: false,
    sceneBreak: '*  *  *',

    header: 'title-chapter',
    headerSize: 8.5,
    headerUppercase: true,
    pageNumbers: 'outer',
    pageNumberSize: 9.5,
    numberFromFirstChapter: true
  };

  const STYLE_PRESETS = {
    classico: {
      label: 'Clássico (romance)',
      settings: {
        bodyFont: 'EB Garamond', headingFont: 'EB Garamond', bodySize: 11.5, lineHeight: 1.4,
        paraIndent: 1.5, paraSpacing: 0, align: 'justify', chapterTitleAlign: 'center',
        chapterTitleUppercase: false, dropCap: true, smallCapsFirstLine: false,
        header: 'title-chapter', headerUppercase: true, pageNumbers: 'outer', chapterDrop: 35
      }
    },
    elegante: {
      label: 'Elegante',
      settings: {
        bodyFont: 'Cormorant Garamond', headingFont: 'Cormorant Garamond', bodySize: 12.5, lineHeight: 1.35,
        paraIndent: 1.4, paraSpacing: 0, align: 'justify', chapterTitleAlign: 'center',
        chapterTitleUppercase: true, dropCap: true, smallCapsFirstLine: true,
        header: 'title-chapter', headerUppercase: true, pageNumbers: 'center', chapterDrop: 45
      }
    },
    moderno: {
      label: 'Moderno',
      settings: {
        bodyFont: 'Lora', headingFont: 'Playfair Display', bodySize: 10.5, lineHeight: 1.5,
        paraIndent: 0, paraSpacing: 0.6, align: 'left', chapterTitleAlign: 'left',
        chapterTitleUppercase: false, dropCap: false, smallCapsFirstLine: false,
        header: 'none', headerUppercase: false, pageNumbers: 'outer', chapterDrop: 25
      }
    },
    academico: {
      label: 'Acadêmico / não ficção',
      settings: {
        bodyFont: 'Libre Baskerville', headingFont: 'Libre Baskerville', bodySize: 10, lineHeight: 1.5,
        paraIndent: 1.25, paraSpacing: 0, align: 'justify', chapterTitleAlign: 'left',
        chapterTitleUppercase: false, dropCap: false, smallCapsFirstLine: false,
        header: 'author-title', headerUppercase: false, pageNumbers: 'outer', chapterDrop: 20
      }
    },
    infantil: {
      label: 'Infantojuvenil',
      settings: {
        bodyFont: 'Merriweather', headingFont: 'Merriweather', bodySize: 12, lineHeight: 1.6,
        paraIndent: 1.2, paraSpacing: 0.3, align: 'left', chapterTitleAlign: 'center',
        chapterTitleUppercase: false, dropCap: true, smallCapsFirstLine: false,
        header: 'none', headerUppercase: false, pageNumbers: 'center', chapterDrop: 30
      }
    }
  };

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const SAMPLE_TEXT = [
    '<p>Era uma vez um livro que ainda não existia. Ele morava apenas na cabeça de quem o escrevia, entre cafés esfriados e frases riscadas, esperando o dia em que ganharia páginas, margens e um sumário digno.</p>',
    '<p>Este é um texto de exemplo. Apague-o e escreva — ou cole, ou importe um arquivo do Word (.docx), texto (.txt) ou Markdown (.md). À direita você vê a prévia exata de como as páginas ficarão impressas.</p>',
    '<p>Use o painel <b>Diagramação</b> para escolher o formato da página, as margens, as fontes, o tamanho do texto, o espaçamento entre linhas, o cabeçalho e a numeração. Quando terminar, clique em <b>Exportar PDF</b> para gerar o arquivo pronto para gráfica ou para impressão sob demanda.</p>',
    '<hr class="scene-break">',
    '<p>Tudo acontece no seu computador. Nenhum texto é enviado para a internet: o projeto é salvo como um arquivo <i>.livro</i> na pasta que você escolher.</p>'
  ].join('');

  function newProject() {
    return {
      format: 'diagramador-de-livros',
      version: 1,
      meta: {
        title: 'Meu Livro',
        subtitle: '',
        author: 'Nome do Autor',
        publisher: '',
        city: '',
        year: String(new Date().getFullYear()),
        edition: '1ª edição',
        isbn: '',
        copyrightText: '',
        dedication: 'Para quem sempre acreditou nesta história.',
        epigraph: '',
        epigraphAuthor: ''
      },
      front: {
        halfTitle: false,
        titlePage: true,
        copyright: true,
        dedication: true,
        epigraph: false,
        toc: true,
        tocTitle: 'Sumário'
      },
      chapters: [
        { id: uid(), title: 'O começo', numbered: true, html: SAMPLE_TEXT }
      ],
      settings: Object.assign({}, DEFAULT_SETTINGS)
    };
  }

  // Garante que projetos antigos/incompletos tenham todos os campos
  function normalizeProject(p) {
    const base = newProject();
    p = p && typeof p === 'object' ? p : {};
    return {
      format: base.format,
      version: base.version,
      meta: Object.assign({}, base.meta, p.meta || {}),
      front: Object.assign({}, base.front, p.front || {}),
      chapters: Array.isArray(p.chapters)
        ? p.chapters.map(c => ({
            id: c.id || uid(),
            title: String(c.title || 'Sem título'),
            numbered: c.numbered !== false,
            html: String(c.html || '')
          }))
        : base.chapters,
      settings: Object.assign({}, DEFAULT_SETTINGS, p.settings || {})
    };
  }

  return {
    PAGE_FORMATS, BUNDLED_FONTS, SYSTEM_FONTS, DEFAULT_SETTINGS, STYLE_PRESETS,
    uid, newProject, normalizeProject
  };
});
