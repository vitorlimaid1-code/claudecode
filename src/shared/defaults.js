/*
 * Definições compartilhadas entre o processo principal (Node) e a interface.
 * Carregado via require() no main e via <script> no renderer.
 * Todas as medidas físicas são armazenadas em milímetros.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookDefaults = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const IN = 25.4;
  const f = (group, label, wcm, hcm, use) => ({ id: `${group}:${wcm}x${hcm}`, group, label, width: +(wcm * 10).toFixed(2), height: +(hcm * 10).toFixed(2), use: use || '' });
  const fin = (group, label, win, hin, use) => ({ id: `${group}:${win}x${hin}in`, group, label, width: +(win * IN).toFixed(2), height: +(hin * IN).toFixed(2), use: use || '' });

  const FORMAT_GROUPS = [
    'Pequenos: bolso, poesia e compactos',
    'Médios: literatura, clássicos e não ficção',
    'Grandes: acadêmicos, técnicos e ilustrados',
    'Quadrados',
    'Horizontais (paisagem)',
    'Amazon KDP (polegadas)'
  ];
  const [G1, G2, G3, G4, G5, G6] = FORMAT_GROUPS;

  const PAGE_FORMATS = [
    f(G1, 'Miniatura — 7 × 10 cm', 7, 10, 'Mini livros, colecionáveis'),
    f(G1, 'Mini — 8 × 12 cm', 8, 12, 'Poesia, textos breves'),
    f(G1, 'Compacto — 10 × 15 cm', 10, 15, 'Poesia, aforismos'),
    f(G1, 'Pocket pequeno — 10,5 × 17 cm', 10.5, 17, 'Ficção de bolso'),
    f(G1, 'Bolso — 11 × 18 cm', 11, 18, 'Clássicos, romances'),
    f(G1, '12 × 18 cm', 12, 18, 'Ficção compacta'),
    f(G1, '12,5 × 18 cm', 12.5, 18, 'Bolso, literatura'),
    f(G1, '12,7 × 20,32 cm (5 × 8 pol.)', 12.7, 20.32, 'Ficção e não ficção'),
    f(G1, 'B-format britânico — 12,9 × 19,8 cm', 12.9, 19.8, 'Romances e literatura'),
    f(G1, '13 × 20 cm', 13, 20, 'Literatura e ensaios'),

    f(G2, '13,8 × 21 cm', 13.8, 21, 'Literatura geral'),
    f(G2, '14 × 20 cm', 14, 20, 'Literatura e ensaios'),
    f(G2, '14 × 21 cm (padrão)', 14, 21, 'Romances, clássicos, filosofia'),
    f(G2, 'A5 — 14,8 × 21 cm', 14.8, 21, 'Literatura, poesia, ensaios'),
    f(G2, '15 × 21 cm', 15, 21, 'Livros comerciais'),
    f(G2, '15,24 × 22,86 cm (6 × 9 pol.)', 15.24, 22.86, 'Padrão americano'),
    f(G2, '15,5 × 22,5 cm', 15.5, 22.5, 'Literatura e não ficção'),
    f(G2, '15,5 × 23 cm', 15.5, 23, 'Acadêmicos e técnicos'),
    f(G2, '16 × 23 cm', 16, 23, 'Biografias, ensaios, não ficção'),
    f(G2, '16 × 24 cm', 16, 24, 'Ensaios e edições especiais'),
    f(G2, '17 × 24 cm', 17, 24, 'Acadêmicos, monografias'),

    f(G3, '18 × 24 cm', 18, 24, 'Manuais e livros ilustrados'),
    f(G3, '19 × 24 cm', 19, 24, 'Educação e não ficção'),
    f(G3, '20 × 25 cm', 20, 25, 'Arte, fotografia'),
    f(G3, '20 × 27 cm', 20, 27, 'Técnicos e didáticos'),
    f(G3, '20 × 28 cm', 20, 28, 'Manuais e referência'),
    f(G3, '21 × 27,9 cm (Carta)', 21, 27.9, 'Próximo ao Carta americano'),
    f(G3, 'A4 — 21 × 29,7 cm', 21, 29.7, 'Acadêmicos, apostilas, manuais'),
    f(G3, '21 × 30 cm', 21, 30, 'Técnicos e ilustrados'),
    f(G3, '22 × 28 cm', 22, 28, 'Arte e referência'),
    f(G3, '23 × 30 cm', 23, 30, 'Ilustrados e fotografia'),
    f(G3, '24 × 30 cm', 24, 30, 'Arte, design e catálogos'),
    f(G3, 'A3 — 29,7 × 42 cm', 29.7, 42, 'Publicações especiais'),

    f(G4, 'Quadrado pequeno — 15 × 15 cm', 15, 15),
    f(G4, 'Quadrado compacto — 18 × 18 cm', 18, 18),
    f(G4, 'Quadrado infantil — 20 × 20 cm', 20, 20, 'Infantis e ilustrados'),
    f(G4, 'Quadrado comercial — 21 × 21 cm', 21, 21, 'Arte e fotografia'),
    f(G4, 'Quadrado grande — 21,6 × 21,6 cm', 21.6, 21.6),
    f(G4, 'Quadrado ilustrado — 22 × 22 cm', 22, 22),
    f(G4, 'Quadrado de arte — 25 × 25 cm', 25, 25, 'Coffee table books'),
    f(G4, 'Quadrado de fotografia — 30 × 30 cm', 30, 30),

    f(G5, 'Paisagem compacto — 15 × 10 cm', 15, 10, 'Livros infantis'),
    f(G5, 'Paisagem pequeno — 20 × 15 cm', 20, 15, 'Infantil e ilustrado'),
    f(G5, 'Paisagem médio — 21 × 15 cm', 21, 15, 'Fotografia e desenho'),
    f(G5, 'Paisagem — 24 × 17 cm', 24, 17, 'Arte e didáticos'),
    f(G5, 'Paisagem grande — 25 × 20 cm', 25, 20, 'Fotografia e design'),
    f(G5, 'Paisagem A4 — 29,7 × 21 cm', 29.7, 21, 'Manuais e catálogos'),
    f(G5, 'Paisagem ampliado — 30 × 22 cm', 30, 22, 'Livros de arte'),
    f(G5, 'Paisagem de arte — 30 × 24 cm', 30, 24, 'Portfólios e fotografia'),
    f(G5, 'Paisagem grande — 30 × 25 cm', 30, 25, 'Coffee table books'),
    f(G5, 'Panorâmico — 33 × 23 cm', 33, 23, 'Fotografia, edições especiais'),

    fin(G6, '4,25 × 6,87 pol. (10,8 × 17,45 cm)', 4.25, 6.87),
    fin(G6, '5 × 8 pol. (12,7 × 20,32 cm)', 5, 8),
    fin(G6, '5,06 × 7,81 pol. (12,85 × 19,84 cm)', 5.06, 7.81),
    fin(G6, '5,25 × 8 pol. (13,34 × 20,32 cm)', 5.25, 8),
    fin(G6, '5,5 × 8,5 pol. (13,97 × 21,59 cm)', 5.5, 8.5),
    fin(G6, '6 × 9 pol. (15,24 × 22,86 cm)', 6, 9),
    fin(G6, '6,14 × 9,21 pol. (15,6 × 23,39 cm)', 6.14, 9.21),
    fin(G6, '6,69 × 9,61 pol. (16,99 × 24,41 cm)', 6.69, 9.61),
    fin(G6, '7 × 10 pol. (17,78 × 25,4 cm)', 7, 10),
    fin(G6, '7,44 × 9,69 pol. (18,9 × 24,61 cm)', 7.44, 9.69),
    fin(G6, '7,5 × 9,25 pol. (19,05 × 23,5 cm)', 7.5, 9.25),
    fin(G6, '8 × 10 pol. (20,32 × 25,4 cm)', 8, 10),
    fin(G6, '8,25 × 6 pol. (20,96 × 15,24 cm)', 8.25, 6),
    fin(G6, '8,25 × 8,25 pol. (20,96 × 20,96 cm)', 8.25, 8.25),
    fin(G6, '8,27 × 11,69 pol. — A4', 8.27, 11.69),
    fin(G6, '8,5 × 8,5 pol. (21,59 × 21,59 cm)', 8.5, 8.5),
    fin(G6, '8,5 × 11 pol. (21,59 × 27,94 cm)', 8.5, 11),

    { id: 'custom', group: 'Outro', label: 'Personalizado…', width: null, height: null, use: '' }
  ];
  const DEFAULT_FORMAT_ID = PAGE_FORMATS.find(p => p.width === 140 && p.height === 210).id;

  // Fontes embutidas no aplicativo (funcionam offline e são incorporadas ao PDF)
  const BUNDLED_FONTS = [
    'EB Garamond', 'Crimson Pro', 'Libre Baskerville', 'Lora',
    'Merriweather', 'Cormorant Garamond', 'Playfair Display'
  ];

  // Sugestões de fontes comuns do Windows (a lista real vem do Gerenciador de Fontes)
  const SYSTEM_FONTS = [
    'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', 'Cambria',
    'Garamond', 'Constantia', 'Calibri', 'Arial', 'Segoe UI'
  ];

  /*
   * Estilos tipográficos nomeados. Campos:
   * font ('' = herda do texto principal), size (pt), lineHeight (×), color,
   * letterSpacing (em), wordSpacing (em), indent (em, 1ª linha), indentLeft/indentRight (mm),
   * spaceBefore/spaceAfter (mm), align, italic, bold, uppercase, smallcaps, background, borderColor
   */
  const STYLE_DEFS = [
    { key: 'body', label: 'Texto principal', tag: 'p', fields: ['font', 'size', 'lineHeight', 'color', 'letterSpacing', 'wordSpacing', 'indent', 'spaceAfter', 'align'] },
    { key: 'chapterTitle', label: 'Título do capítulo', tag: 'h1', fields: ['font', 'size', 'color', 'align', 'italic', 'bold', 'uppercase', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'chapterLabel', label: 'Rótulo “Capítulo 1”', fields: ['font', 'size', 'color', 'italic', 'uppercase', 'letterSpacing', 'spaceAfter'] },
    { key: 'h2', label: 'T1 — Título de seção', tag: 'h2', fields: ['font', 'size', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'h3', label: 'T2 — Subtítulo', tag: 'h3', fields: ['font', 'size', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'h4', label: 'T3 — Intertítulo', tag: 'h4', fields: ['font', 'size', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'quote', label: 'Citação longa', tag: 'blockquote', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'indentLeft', 'indentRight', 'spaceBefore', 'spaceAfter'] },
    { key: 'phrase', label: 'Frase em destaque', tag: 'p.phrase', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'bold', 'uppercase', 'indentLeft', 'indentRight', 'spaceBefore', 'spaceAfter'] },
    { key: 'poem', label: 'Poesia', tag: 'div.poem', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'indentLeft', 'spaceBefore', 'spaceAfter'] },
    { key: 'epigraph', label: 'Epígrafe', fields: ['font', 'size', 'color', 'align', 'italic', 'indentLeft'] },
    { key: 'reference', label: 'Referências', tag: 'p.reference', fields: ['font', 'size', 'lineHeight', 'color', 'indent', 'spaceAfter', 'align'] },
    { key: 'caption', label: 'Legenda', tag: 'figcaption', fields: ['font', 'size', 'color', 'align', 'italic'] },
    { key: 'footnote', label: 'Nota de rodapé', fields: ['font', 'size', 'lineHeight', 'color'] },
    { key: 'box', label: 'Caixa de destaque', tag: 'div.box', fields: ['font', 'size', 'color', 'background', 'borderColor', 'align', 'spaceBefore', 'spaceAfter'] },
    { key: 'table', label: 'Tabela', tag: 'table', fields: ['font', 'size', 'color', 'borderColor', 'background'] },
    { key: 'header', label: 'Cabeçalho', fields: ['font', 'size', 'color', 'italic', 'uppercase', 'letterSpacing'] },
    { key: 'pageNumber', label: 'Número da página', fields: ['font', 'size', 'color'] },
    { key: 'toc', label: 'Sumário', fields: ['font', 'size', 'color', 'lineHeight'] }
  ];

  const DEFAULT_STYLES = {
    body: { font: 'EB Garamond', size: 11.5, lineHeight: 1.4, color: '#000000', letterSpacing: 0, wordSpacing: 0, indent: 1.5, spaceAfter: 0, align: 'justify' },
    chapterTitle: { font: '', size: 22, color: '#000000', align: 'center', italic: false, bold: false, uppercase: false, letterSpacing: 0, spaceBefore: 35, spaceAfter: 6 },
    chapterLabel: { font: '', size: 10.5, color: '#000000', italic: false, uppercase: true, letterSpacing: 0.15, spaceAfter: 3 },
    h2: { font: '', size: 15.5, color: '#000000', align: 'center', italic: false, bold: false, uppercase: false, smallcaps: false, letterSpacing: 0, spaceBefore: 7, spaceAfter: 3.5 },
    h3: { font: '', size: 13, color: '#000000', align: 'left', italic: true, bold: false, uppercase: false, smallcaps: false, letterSpacing: 0, spaceBefore: 5, spaceAfter: 2.5 },
    h4: { font: '', size: 11.5, color: '#000000', align: 'left', italic: false, bold: false, uppercase: false, smallcaps: true, letterSpacing: 0.04, spaceBefore: 4, spaceAfter: 2 },
    quote: { font: '', size: 10.5, lineHeight: 1.35, color: '#000000', align: 'justify', italic: false, indentLeft: 10, indentRight: 6, spaceBefore: 3, spaceAfter: 3 },
    phrase: { font: '', size: 14, lineHeight: 1.3, color: '#000000', align: 'center', italic: true, bold: false, uppercase: false, indentLeft: 8, indentRight: 8, spaceBefore: 5, spaceAfter: 5 },
    poem: { font: '', size: 11.5, lineHeight: 1.45, color: '#000000', align: 'left', italic: false, indentLeft: 12, spaceBefore: 4, spaceAfter: 4 },
    epigraph: { font: '', size: 10.5, color: '#000000', align: 'right', italic: true, indentLeft: 35 },
    reference: { font: '', size: 10, lineHeight: 1.3, color: '#000000', indent: -1.5, spaceAfter: 1.5, align: 'left' },
    caption: { font: '', size: 9, color: '#333333', align: 'center', italic: true },
    footnote: { font: '', size: 8.5, lineHeight: 1.25, color: '#000000' },
    box: { font: '', size: 10.5, color: '#000000', background: '#f2efe9', borderColor: '#b9ad9a', align: 'left', spaceBefore: 4, spaceAfter: 4 },
    table: { font: '', size: 9.5, color: '#000000', borderColor: '#555555', background: '#efece6' },
    header: { font: '', size: 8.5, color: '#222222', italic: false, uppercase: true, letterSpacing: 0.08 },
    pageNumber: { font: '', size: 9.5, color: '#000000' },
    toc: { font: '', size: 11, color: '#000000', lineHeight: 1.5 }
  };

  const DEFAULT_SETTINGS = {
    pageFormat: DEFAULT_FORMAT_ID,
    pageWidth: 140,
    pageHeight: 210,
    pageColor: '#ffffff',
    marginTop: 20,
    marginBottom: 22,
    marginInner: 22,
    marginOuter: 16,
    // Sangria por borda (mm). Superior/inferior/externa; a interna normalmente é 0 no miolo.
    bleed: 0,
    bleedTop: 0,
    bleedBottom: 0,
    bleedOuter: 0,
    bleedInner: 0,
    safety: 5,
    cropMarks: false,

    hyphenate: true,
    indentFirstParagraph: false,
    widowsOrphans: 2,
    keepHeadingsWithNext: true,

    chapterLabel: 'Capítulo',
    chapterNumbering: 'arabic',
    chapterStartRight: true,
    dropCap: true,
    dropCapLines: 2,
    smallCapsFirstLine: false,
    sceneBreak: '*  *  *',

    // Separador abaixo do título do capítulo: 'line' (filete liso — padrão), 'image' ou 'none'
    separator: 'line',
    separatorAsset: null,
    separatorWidth: 30,
    separatorColor: '#000000',

    footnotesVisible: true,

    header: 'title-chapter',
    pageNumbers: 'outer',
    numberFromFirstChapter: true,

    styles: JSON.parse(JSON.stringify(DEFAULT_STYLES))
  };

  /* Configurações prontas por gênero (sobrescrevem campos de settings/styles) */
  const GENRE_PRESETS = {
    romance: {
      label: 'Romance', separatorLibrary: 'coracao-linhas',
      settings: { dropCap: true, smallCapsFirstLine: false, header: 'title-chapter', pageNumbers: 'outer', sceneBreak: '❦' },
      styles: { body: { font: 'EB Garamond', size: 11.5, lineHeight: 1.4, align: 'justify', indent: 1.5 }, chapterTitle: { font: 'Playfair Display', size: 22, italic: true, align: 'center', spaceBefore: 40 }, chapterLabel: { font: 'EB Garamond' } }
    },
    poesia: {
      label: 'Poesia', separatorLibrary: 'pena',
      settings: { dropCap: false, header: 'none', pageNumbers: 'center', chapterNumbering: 'none', chapterStartRight: false, hyphenate: false, sceneBreak: '·' },
      styles: { body: { font: 'Cormorant Garamond', size: 12.5, lineHeight: 1.5, align: 'left', indent: 0 }, chapterTitle: { font: 'Cormorant Garamond', size: 18, italic: true, align: 'left', spaceBefore: 20 }, poem: { indentLeft: 0, size: 12.5 } }
    },
    terror: {
      label: 'Terror', separatorLibrary: 'espinhos',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'outer', chapterNumbering: 'roman', sceneBreak: '✝', pageColor: '#ffffff' },
      styles: { body: { font: 'Crimson Pro', size: 11.5, lineHeight: 1.35, align: 'justify' }, chapterTitle: { font: 'Cormorant Garamond', size: 26, uppercase: true, letterSpacing: 0.12, color: '#5a0d0d', spaceBefore: 45 }, chapterLabel: { color: '#5a0d0d' } }
    },
    suspense: {
      label: 'Suspense / policial', separatorLibrary: 'linha-dupla',
      settings: { dropCap: false, header: 'title-chapter', pageNumbers: 'outer', chapterNumbering: 'arabic', chapterLabel: '', sceneBreak: '■' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5 }, chapterTitle: { font: 'Libre Baskerville', size: 30, bold: true, align: 'left', spaceBefore: 30 } }
    },
    fantasia: {
      label: 'Fantasia', separatorLibrary: 'arabesco',
      settings: { dropCap: true, smallCapsFirstLine: true, header: 'title-chapter', pageNumbers: 'outer', chapterNumbering: 'words', sceneBreak: '✦  ✦  ✦' },
      styles: { body: { font: 'EB Garamond', size: 11.5 }, chapterTitle: { font: 'Cormorant Garamond', size: 24, uppercase: true, letterSpacing: 0.1, spaceBefore: 45 } }
    },
    ficcaocientifica: {
      label: 'Ficção científica', separatorLibrary: 'orbita',
      settings: { dropCap: false, header: 'title-chapter', pageNumbers: 'outer', chapterNumbering: 'arabic', chapterLabel: '', sceneBreak: '◆' },
      styles: { body: { font: 'Lora', size: 10.5, lineHeight: 1.45 }, chapterTitle: { font: 'Lora', size: 20, uppercase: true, letterSpacing: 0.2, align: 'left', spaceBefore: 30 } }
    },
    contos: {
      label: 'Contos / crônicas', separatorLibrary: 'losango',
      settings: { dropCap: true, header: 'chapter-chapter', pageNumbers: 'outer', chapterNumbering: 'none', chapterStartRight: false },
      styles: { body: { font: 'Crimson Pro', size: 12 }, chapterTitle: { font: 'Crimson Pro', size: 20, italic: true, spaceBefore: 30 } }
    },
    infantil: {
      label: 'Infantojuvenil', separatorLibrary: 'estrelas',
      settings: { dropCap: true, header: 'none', pageNumbers: 'center', hyphenate: false, sceneBreak: '★' },
      styles: { body: { font: 'Merriweather', size: 12.5, lineHeight: 1.65, align: 'left', indent: 1.2, spaceAfter: 1.5 }, chapterTitle: { font: 'Merriweather', size: 22, bold: true, color: '#1d4f8a', spaceBefore: 30 } }
    },
    autoajuda: {
      label: 'Autoajuda / negócios', separatorLibrary: 'linha-ponto',
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'outer', sceneBreak: '—' },
      styles: { body: { font: 'Lora', size: 10.5, lineHeight: 1.5, align: 'left', indent: 0, spaceAfter: 2 }, chapterTitle: { font: 'Playfair Display', size: 24, align: 'left', bold: true, spaceBefore: 25 }, h2: { font: 'Playfair Display', align: 'left', bold: true } }
    },
    biografia: {
      label: 'Biografia / memórias', separatorLibrary: 'folhas',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'outer' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5 }, chapterTitle: { font: 'Libre Baskerville', size: 19, italic: true, spaceBefore: 35 } }
    },
    religioso: {
      label: 'Religioso / espiritual', separatorLibrary: 'cruz-flor',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center' },
      styles: { body: { font: 'EB Garamond', size: 12, lineHeight: 1.45 }, chapterTitle: { font: 'Cormorant Garamond', size: 24, uppercase: true, letterSpacing: 0.1, spaceBefore: 40 } }
    },
    academico: {
      label: 'Acadêmico / técnico', separatorLibrary: null,
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'outer', separator: 'none', chapterStartRight: false, chapterLabel: '' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5, indent: 1.25 }, chapterTitle: { font: 'Libre Baskerville', size: 17, align: 'left', bold: true, spaceBefore: 15 }, h2: { align: 'left', bold: true, size: 12.5 }, h3: { size: 11, bold: true, italic: false } }
    }
  };

  function uid(prefix) {
    return (prefix || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const SAMPLE_TEXT = [
    '<p>Era uma vez um livro que ainda não existia. Ele morava apenas na cabeça de quem o escrevia, entre cafés esfriados e frases riscadas, esperando o dia em que ganharia páginas, margens e um sumário digno.<span class="footnote">Esta é uma nota de rodapé de exemplo. Use o painel Notas para ocultar ou remover notas.</span></p>',
    '<p>Este é um texto de exemplo. Apague-o e escreva — ou cole, ou importe um arquivo do Word (.docx/.doc), EPUB, PDF, ODT, texto (.txt) ou Markdown (.md). À direita você vê a prévia exata de como as páginas ficarão impressas.</p>',
    '<p>Use o painel <b>Diagramação</b> para escolher o formato da página, as margens, os estilos de texto e títulos, o cabeçalho e a numeração. Quando terminar, abra <b>Exportar</b> para gerar o PDF para gráfica, o EPUB ou imagens das páginas.</p>',
    '<hr class="scene-break">',
    '<p>Tudo acontece no seu computador. Nenhum texto é enviado para a internet: o projeto é salvo como um arquivo <i>.livro</i> na pasta que você escolher.</p>'
  ].join('');

  function emptyCatalog() {
    return {
      enabled: true,
      mode: 'fields', // 'fields' (montada a partir dos campos) ou 'manual'
      manualText: '',
      authorEntry: '', // ex.: "Sobrenome, Nome, 1980-"
      originalTitle: '',
      translator: '',
      illustrator: '',
      pagesOverride: '',
      series: '',
      notes: '',
      subjects: '',
      cdd: '',
      cdu: '',
      cutter: '',
      librarian: '',
      crb: '',
      credits: [
        { role: 'Edição', name: '' },
        { role: 'Revisão', name: '' },
        { role: 'Diagramação', name: '' },
        { role: 'Capa', name: '' }
      ],
      rights: '',
      contact: '',
      images: [], // { asset, width (mm), caption }
      qrcodes: [] // { text, caption, size (mm) }
    };
  }

  function newProject(userDefaults) {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (userDefaults && typeof userDefaults === 'object') mergeSettings(settings, userDefaults);
    return {
      format: 'diagramador-de-livros',
      version: 2,
      meta: {
        title: 'Meu Livro', subtitle: '', author: 'Nome do Autor', publisher: '', city: '',
        year: String(new Date().getFullYear()), edition: '1ª edição', isbn: '',
        dedication: 'Para quem sempre acreditou nesta história.', epigraph: '', epigraphAuthor: '',
        language: 'pt-BR', description: ''
      },
      front: { halfTitle: false, titlePage: true, copyright: true, dedication: true, epigraph: false, toc: true, tocTitle: 'Sumário' },
      titlePage: { logo: null, logoWidth: 25, showPublisher: true, showYear: true },
      catalog: emptyCatalog(),
      back: {
        bio: { enabled: false, title: 'Sobre o autor', html: '', photo: null, photoWidth: 35 },
        extra: { enabled: false, title: 'Do mesmo autor', html: '' }
      },
      chapters: [{ id: uid(), title: 'O começo', numbered: true, html: SAMPLE_TEXT, locked: false, style: {}, separator: 'default', openingImage: null }],
      assets: {},
      overlays: [],
      cover: null,
      settings
    };
  }

  // Mescla configurações parciais (inclusive estilos aninhados) em settings
  function mergeSettings(target, partial) {
    Object.keys(partial || {}).forEach(k => {
      if (k === 'styles' && partial.styles) {
        Object.keys(partial.styles).forEach(sk => {
          target.styles[sk] = Object.assign({}, target.styles[sk] || {}, partial.styles[sk]);
        });
      } else {
        target[k] = partial[k];
      }
    });
    return target;
  }

  // Converte projetos da versão 1 e completa campos ausentes
  function normalizeProject(p) {
    const base = newProject();
    p = p && typeof p === 'object' ? p : {};
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const ps = Object.assign({}, p.settings || {});
    if (!p.version || p.version < 2) {
      // Migração dos campos antigos de tipografia
      const st = settings.styles;
      if (ps.bodyFont) st.body.font = ps.bodyFont;
      if (ps.bodySize) st.body.size = ps.bodySize;
      if (ps.lineHeight) st.body.lineHeight = ps.lineHeight;
      if (ps.paraIndent !== undefined) st.body.indent = ps.paraIndent;
      if (ps.paraSpacing !== undefined) st.body.spaceAfter = ps.paraSpacing * 4;
      if (ps.align) st.body.align = ps.align;
      if (ps.headingFont) { st.chapterTitle.font = ps.headingFont; st.h2.font = ps.headingFont; st.h3.font = ps.headingFont; }
      if (ps.chapterTitleSize) st.chapterTitle.size = ps.chapterTitleSize;
      if (ps.chapterTitleAlign) st.chapterTitle.align = ps.chapterTitleAlign;
      if (ps.chapterTitleUppercase) st.chapterTitle.uppercase = true;
      if (ps.chapterDrop !== undefined) st.chapterTitle.spaceBefore = ps.chapterDrop;
      if (ps.headerSize) st.header.size = ps.headerSize;
      if (ps.headerUppercase !== undefined) st.header.uppercase = ps.headerUppercase;
      if (ps.pageNumberSize) st.pageNumber.size = ps.pageNumberSize;
      if (ps.bleed) { ps.bleedTop = ps.bleedBottom = ps.bleedOuter = ps.bleed; }
      ['bodyFont', 'bodySize', 'lineHeight', 'paraIndent', 'paraSpacing', 'align', 'headingFont', 'chapterTitleSize',
        'chapterTitleAlign', 'chapterTitleUppercase', 'chapterDrop', 'headerSize', 'headerUppercase', 'pageNumberSize'].forEach(k => delete ps[k]);
      if (ps.pageFormat && !PAGE_FORMATS.some(x => x.id === ps.pageFormat)) {
        const match = PAGE_FORMATS.find(x => Math.abs(x.width - ps.pageWidth) < 0.3 && Math.abs(x.height - ps.pageHeight) < 0.3);
        ps.pageFormat = match ? match.id : 'custom';
      }
    }
    mergeSettings(settings, ps);
    const chapters = Array.isArray(p.chapters)
      ? p.chapters.map(c => ({
          id: c.id || uid(),
          title: String(c.title == null ? 'Sem título' : c.title),
          numbered: c.numbered !== false,
          html: String(c.html || ''),
          locked: !!c.locked,
          style: Object.assign({}, c.style || {}),
          separator: c.separator || 'default',
          openingImage: c.openingImage || null
        }))
      : base.chapters;
    const catalog = Object.assign(emptyCatalog(), p.catalog || {});
    return {
      format: base.format,
      version: 2,
      meta: Object.assign({}, base.meta, p.meta || {}),
      front: Object.assign({}, base.front, p.front || {}),
      titlePage: Object.assign({}, base.titlePage, p.titlePage || {}),
      catalog,
      back: {
        bio: Object.assign({}, base.back.bio, (p.back && p.back.bio) || {}),
        extra: Object.assign({}, base.back.extra, (p.back && p.back.extra) || {})
      },
      chapters,
      assets: Object.assign({}, p.assets || {}),
      overlays: Array.isArray(p.overlays) ? p.overlays : [],
      cover: p.cover || null,
      settings
    };
  }

  // Aplica um preset de gênero às configurações
  function applyGenrePreset(settings, key) {
    const preset = GENRE_PRESETS[key];
    if (!preset) return settings;
    const base = JSON.parse(JSON.stringify(DEFAULT_STYLES));
    settings.styles = base;
    mergeSettings(settings, Object.assign({}, preset.settings, { styles: preset.styles }));
    return settings;
  }

  const MM = { mm: 1, cm: 10, in: IN, pt: IN / 72 };
  function toUnit(mm, unit) { return mm / (MM[unit] || 1); }
  function fromUnit(v, unit) { return v * (MM[unit] || 1); }

  return {
    PAGE_FORMATS, FORMAT_GROUPS, DEFAULT_FORMAT_ID, BUNDLED_FONTS, SYSTEM_FONTS,
    STYLE_DEFS, DEFAULT_STYLES, DEFAULT_SETTINGS, GENRE_PRESETS,
    uid, newProject, normalizeProject, mergeSettings, applyGenrePreset, emptyCatalog,
    toUnit, fromUnit, MM
  };
});
