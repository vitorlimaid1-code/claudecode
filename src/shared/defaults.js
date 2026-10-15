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
    'CEDET (padrão do sistema)',
    'Pequenos: bolso, poesia e compactos',
    'Médios: literatura, clássicos e não ficção',
    'Grandes: acadêmicos, técnicos e ilustrados',
    'Quadrados',
    'Horizontais (paisagem)',
    'Amazon KDP (polegadas)',
    'Revistas e jornais'
  ];
  const [GC, G1, G2, G3, G4, G5, G6, G7] = FORMAT_GROUPS;

  const PAGE_FORMATS = [
    // Manual de Preparação de Arquivos Cedet (Editoras Parceiras): formatos obrigatórios do miolo
    f(GC, 'CEDET — 15,5 × 23 cm', 15.5, 23, 'Padrão Cedet'),
    f(GC, 'CEDET — 13,7 × 21 cm', 13.7, 21, 'Padrão Cedet'),
    f(GC, 'CEDET — 11,5 × 17,5 cm', 11.5, 17.5, 'Padrão Cedet'),

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

    f(G7, 'Revista compacta — 13,5 × 20,5 cm', 13.5, 20.5, 'Revistas de bolso'),
    f(G7, 'Revista padrão — 20,2 × 26,6 cm', 20.2, 26.6, 'Revistas semanais e mensais'),
    f(G7, 'Revista — 20,5 × 27,5 cm', 20.5, 27.5, 'Revistas de variedades'),
    f(G7, 'Revista A4 — 21 × 29,7 cm', 21, 29.7, 'Revistas técnicas e institucionais'),
    f(G7, 'Revista grande — 23 × 30 cm', 23, 30, 'Moda, arte, decoração'),
    f(G7, 'Jornal tabloide — 28 × 43 cm', 28, 43, 'Jornais populares e de bairro'),
    f(G7, 'Jornal tabloide europeu — 29,7 × 42 cm (A3)', 29.7, 42, 'Informativos e jornais-mural'),
    f(G7, 'Jornal berliner — 31,5 × 47 cm', 31.5, 47, 'Jornais diários'),
    f(G7, 'Jornal standard — 38 × 58 cm', 38, 58, 'Grandes jornais diários'),

    { id: 'custom', group: 'Outro', label: 'Personalizado…', width: null, height: null, use: '' }
  ];
  const DEFAULT_FORMAT_ID = PAGE_FORMATS.find(p => p.group === GC && p.width === 155 && p.height === 230).id;

  /*
   * Modelo CEDET — Manual de Preparação de Arquivos (Editoras Parceiras, v. outubro/2026) e Guia rápido.
   * Miolo: preto e branco (só tinta preta, sGray sem perfis incorporados), margem de segurança de 20 mm
   * nos quatro lados, sangria de 5 mm, marcas de corte de 0,25 pt com 5 mm de deslocamento em todas as
   * páginas, numeração no canto inferior externo ou no centro (ímpares à direita), páginas individuais.
   * Capa: CMYK, sangria de 5 mm, marcas de corte e de dobra (0,25 pt, 5 mm), capa com orelhas 2 mm mais
   * larga, orelhas de 6, 7 ou 8 cm, código de barras preto na contracapa (mín. 31 × 19 mm, 2,5 mm livres).
   */
  const CEDET = {
    label: 'CEDET',
    formats: PAGE_FORMATS.filter(p => p.group === GC).map(p => p.id),
    bleed: 5,
    safety: 20,
    marks: { offset: 5, len: 5, weight: 0.25 },
    // livros Cedet NUNCA têm orelhas: capa e miolo seguem as especificações “sem orelhas”
    flaps: [],
    barcode: { minW: 31, minH: 19, clearance: 2.5 },
    settings: {
      standard: 'cedet', marginTop: 28, marginBottom: 28, marginInner: 23, marginOuter: 20, safety: 20,
      bleedAuto: true, bleedTop: 5, bleedBottom: 5, bleedOuter: 5, bleedInner: 0, cropMarks: false, folioGap: 3,
      pageNumbers: 'center', numberFromFirstChapter: false, pageColor: '#ffffff',
      outputSheet: { mode: 'marks', w: 210, h: 297, marks: true, markOffset: 5, markLen: 5, markWeight: 0.25 }
    },
    distribution: 'DISTRIBUIÇÃO\nCEDET — Centro de Desenvolvimento Profissional e Tecnológico\nAv. Comendador Aladino Selmi, 4682 — Condomínio GR2, galpão 8\nCEP: 13069-096 — Vila San Martin, Campinas-SP\nTelefones: (19) 3249-0580 / 3327-2257\ne-mail: livros@cedet.com.br',
    contact: 'editoras-parceiras@cedet.com.br'
  };
  // Estilos de legenda (figuras, gráficos, tabelas e legendas soltas). O padrão vale para o livro todo;
  // cada legenda pode ter o seu (clique na legenda e escolha o estilo).
  const CAPTION_STYLES = [
    { key: 'classica', label: 'Clássica', desc: 'Centralizada, em itálico, rótulo em negrito' },
    { key: 'editorial', label: 'Editorial', desc: 'Rótulo em versalete, texto regular, filete fino acima' },
    { key: 'moderna', label: 'Moderna', desc: 'Alinhada à esquerda, rótulo em maiúsculas espaçadas' },
    { key: 'discreta', label: 'Discreta', desc: 'Pequena, em cinza, alinhada à esquerda' },
    { key: 'destaque', label: 'Destaque', desc: 'Rótulo em etiqueta escura, texto em itálico' },
    { key: 'lateral', label: 'Lateral', desc: 'Filete vertical à esquerda, texto alinhado à esquerda' }
  ];

  // Modelos de sumário
  const TOC_STYLES = [
    { key: 'dots', label: 'Pontilhado', desc: 'Título, pontilhado e número da página à direita (clássico)' },
    { key: 'plain', label: 'Sem pontilhado', desc: 'Título à esquerda e número à direita, sem pontos' },
    { key: 'inline', label: 'Número junto ao título', desc: 'O número da página vem logo depois do título' },
    { key: 'numleft', label: 'Número à esquerda', desc: 'Número da página em destaque antes do título (moderno)' },
    { key: 'twocol', label: 'Duas colunas', desc: 'Sumário compacto em duas colunas, com pontilhado' },
    { key: 'summary', label: 'Com resumos', desc: 'Cada capítulo com um breve resumo abaixo do título' }
  ];

  const isCedet = s => !!s && s.standard === 'cedet';
  // Layout livre (formatos fora do CEDET): margens, sangria e saída padrão do sistema
  const FREE_LAYOUT = {
    standard: '', marginTop: 20, marginBottom: 22, marginInner: 22, marginOuter: 16, safety: 5,
    bleedAuto: true, bleedTop: 3, bleedBottom: 3, bleedOuter: 3, bleedInner: 0, folioGap: 0,
    outputSheet: { mode: 'trim', w: 210, h: 297, marks: true }
  };
  function applyFreeLayout(settings) {
    return Object.assign(settings, JSON.parse(JSON.stringify(FREE_LAYOUT)));
  }

  // Medidas editadas pelo usuário nos modelos de formato (o original fica guardado para restaurar)
  function applyFormatOverrides(over) {
    PAGE_FORMATS.forEach(f => {
      if (!f.orig && f.width) f.orig = { width: f.width, height: f.height };
      const o = over && over[f.id];
      if (f.orig) { f.width = o ? Number(o.width) : f.orig.width; f.height = o ? Number(o.height) : f.orig.height; f.edited = !!o; }
    });
  }

  // Aplica (ou reaplica) o modelo CEDET às configurações, sem mexer em estilos de texto
  function applyCedet(settings, formatId) {
    const fmt = PAGE_FORMATS.find(p => p.id === (formatId || settings.pageFormat)) || PAGE_FORMATS.find(p => p.id === DEFAULT_FORMAT_ID);
    const ok = fmt && fmt.group === GC ? fmt : PAGE_FORMATS.find(p => p.id === DEFAULT_FORMAT_ID);
    const prevNumbers = settings.pageNumbers;
    Object.assign(settings, JSON.parse(JSON.stringify(CEDET.settings)), { pageFormat: ok.id, pageWidth: ok.width, pageHeight: ok.height });
    // número da página sempre no centro do rodapé (aceito pelo manual do Cedet)
    settings.pageNumbers = prevNumbers === 'none' ? 'none' : 'center';
    if (settings.styles) ['body', 'chapterTitle', 'chapterLabel', 'h2', 'h3', 'header', 'pageNumber', 'footnote', 'quote', 'toc'].forEach(k => { if (settings.styles[k]) settings.styles[k].color = '#000000'; });
    return settings;
  }

  // Amazon KDP — tamanhos de corte (confira sempre a tabela atual no site da Amazon)
  const kdp = (win, hin, note) => ({ win, hin, width: +(win * IN).toFixed(2), height: +(hin * IN).toFixed(2), label: `${String(+(win * 2.54).toFixed(2)).replace('.', ',')} × ${String(+(hin * 2.54).toFixed(2)).replace('.', ',')} cm — ${String(win).replace('.', ',')} × ${String(hin).replace('.', ',')} pol.${note ? ' — ' + note : ''}` });
  const KDP = {
    paperback: [kdp(5, 8), kdp(5.06, 7.81), kdp(5.25, 8), kdp(5.5, 8.5), kdp(6, 9), kdp(6.14, 9.21), kdp(6.69, 9.61), kdp(7, 10), kdp(7.44, 9.69), kdp(7.5, 9.25), kdp(8, 10), kdp(8.25, 6, 'horizontal'), kdp(8.25, 8.25, 'quadrado'), kdp(8.5, 8.5, 'quadrado'), kdp(8.5, 11), kdp(8.27, 11.69, 'A4')],
    hardcover: [kdp(5.5, 8.5), kdp(6, 9), kdp(6.14, 9.21), kdp(7, 10), kdp(8.25, 11)],
    // espessura por página (pol.) para cálculo da lombada
    paper: { white: { label: 'Branco', in: 0.002252 }, cream: { label: 'Creme', in: 0.0025 }, color: { label: 'Colorido (premium)', in: 0.002347 }, colorStd: { label: 'Colorido (padrão)', in: 0.002252 } },
    limits: { paperback: { white: [24, 828], cream: [24, 776], color: [24, 828], colorStd: [72, 600] }, hardcover: { white: [75, 550], cream: [75, 550], color: [75, 550], colorStd: [75, 550] } },
    bleedIn: 0.125,
    // margem interna mínima por número de páginas (pol.)
    gutter: [[150, 0.375], [300, 0.5], [500, 0.625], [700, 0.75], [Infinity, 0.875]],
    outsideNoBleedIn: 0.25,
    outsideBleedIn: 0.375,
    spineTextMinPages: 79
  };

  // Folhas de saída comuns em gráficas (mm, retrato)
  const OUTPUT_SHEETS = {
    trim: { label: 'Formato do livro (página + sangria, sem marcas)' },
    marks: { label: 'Formato do livro + sangria + marcas de corte (padrão CEDET)' },
    a4: { label: 'A4 — 210 × 297 mm', w: 210, h: 297 },
    a3: { label: 'A3 — 297 × 420 mm', w: 297, h: 420 },
    sra4: { label: 'SRA4 — 225 × 320 mm', w: 225, h: 320 },
    sra3: { label: 'SRA3 — 320 × 450 mm', w: 320, h: 450 },
    letter: { label: 'Carta — 215,9 × 279,4 mm', w: 215.9, h: 279.4 },
    custom: { label: 'Personalizado (digite a largura e a altura)' }
  };
  // Medidas da folha (mm) para uma configuração; null quando é o próprio formato do livro.
  // A orientação é escolhida para caber a página com sangria e marcas.
  function outputSheetSize(s, bleed) {
    const o = s.outputSheet || {};
    if (!o.mode || o.mode === 'trim') return null;
    const m = markGeometry(s, bleed);
    // sangria + espaço das marcas de corte
    const extra = o.marks || o.mode === 'marks' ? Math.max(bleed, m.offset + m.len + 1) : bleed;
    const needW = s.pageWidth + 2 * extra;
    const needH = s.pageHeight + 2 * extra;
    if (o.mode === 'marks') return { w: needW, h: needH, needW, needH, fits: true, marksOnly: true };
    const p = OUTPUT_SHEETS[o.mode] || {};
    let w = Number(o.mode === 'custom' ? o.w : p.w), h = Number(o.mode === 'custom' ? o.h : p.h);
    if (!(w > 0 && h > 0)) return null;
    if ((w < needW || h < needH) && h >= needW && w >= needH) [w, h] = [h, w];
    return { w, h, needW, needH, fits: w >= needW - 0.01 && h >= needH - 0.01 };
  }

  // Marcas de corte: deslocamento a partir do corte (padrão: 2 mm além da sangria), comprimento e espessura (pt)
  function markGeometry(s, bleed) {
    const o = (s && s.outputSheet) || {};
    const n = (v, d) => (v !== '' && v != null && isFinite(Number(v)) ? Number(v) : d);
    return { offset: Math.max(0, n(o.markOffset, bleed + 2)), len: Math.max(1, n(o.markLen, 5)), weight: Math.max(0.1, n(o.markWeight, 0.25)) };
  }

  // Sangria automática conforme o formato (pode ser ajustada manualmente)
  // KDP: especificação da Amazon (0,125 pol.); CEDET: manual (5 mm); demais: padrão do sistema
  function autoBleed(s) {
    const fmt = PAGE_FORMATS.find(p => p.id === s.pageFormat);
    if (fmt && fmt.group === 'Amazon KDP (polegadas)') return 3.175; // 0,125 pol.
    if (s.kdp && s.kdp.enabled) return 3.175;
    if (isCedet(s)) return CEDET.bleed;
    if (Math.max(s.pageWidth, s.pageHeight) >= 420) return 5;
    return 3;
  }

  // Fontes embutidas no aplicativo (funcionam offline e são incorporadas ao PDF)
  const BUNDLED_FONTS = [
    'EB Garamond', 'Crimson Pro', 'Libre Baskerville', 'Lora',
    'Merriweather', 'Cormorant Garamond', 'Playfair Display', 'Josefin Sans', 'Montserrat'
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
    { key: 'h2', label: 'T1 — Título de seção', tag: 'h2', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'h3', label: 'T2 — Subtítulo', tag: 'h3', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'h4', label: 'T3 — Intertítulo', tag: 'h4', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'bold', 'uppercase', 'smallcaps', 'letterSpacing', 'spaceBefore', 'spaceAfter'] },
    { key: 'quote', label: 'Citação longa', tag: 'blockquote', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'indentLeft', 'indentRight', 'spaceBefore', 'spaceAfter'] },
    { key: 'phrase', label: 'Frase em destaque', tag: 'p.phrase', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'bold', 'uppercase', 'indentLeft', 'indentRight', 'spaceBefore', 'spaceAfter'] },
    { key: 'poem', label: 'Poesia', tag: 'div.poem', fields: ['font', 'size', 'lineHeight', 'color', 'align', 'italic', 'indentLeft', 'spaceBefore', 'spaceAfter'] },
    { key: 'epigraph', label: 'Epígrafe', fields: ['font', 'size', 'color', 'align', 'italic', 'indentLeft'] },
    { key: 'reference', label: 'Referências', tag: 'p.reference', fields: ['font', 'size', 'lineHeight', 'color', 'indent', 'spaceAfter', 'align'] },
    { key: 'caption', label: 'Legenda', tag: 'figcaption', fields: ['font', 'size', 'color', 'align', 'italic'] },
    { key: 'footnote', label: 'Nota de rodapé', fields: ['font', 'size', 'lineHeight', 'color', 'align'] },
    { key: 'box', label: 'Caixa de destaque', tag: 'div.box', fields: ['font', 'size', 'color', 'background', 'borderColor', 'align', 'spaceBefore', 'spaceAfter'] },
    { key: 'table', label: 'Tabela', tag: 'table', fields: ['font', 'size', 'color', 'borderColor', 'background'] },
    { key: 'header', label: 'Cabeçalho', fields: ['font', 'size', 'color', 'italic', 'uppercase', 'letterSpacing'] },
    { key: 'pageNumber', label: 'Número da página', fields: ['font', 'size', 'color'] },
    { key: 'toc', label: 'Sumário', fields: ['font', 'size', 'color', 'lineHeight'] }
  ];

  // Estilos de caractere (trechos dentro do parágrafo): aplicados pela barra de seleção; mudar o estilo
  // muda todos os trechos marcados com ele no livro. sizePct: % do tamanho do texto ao redor.
  const DEFAULT_CHAR_STYLES = [
    { id: 'enfase', name: 'Ênfase', font: '', sizePct: 100, color: '', italic: true, bold: false, smallcaps: false, uppercase: false, underline: false, letterSpacing: 0, background: '' },
    { id: 'forte', name: 'Destaque forte', font: '', sizePct: 100, color: '', italic: false, bold: true, smallcaps: false, uppercase: false, underline: false, letterSpacing: 0, background: '' },
    { id: 'versalete', name: 'Versalete', font: '', sizePct: 100, color: '', italic: false, bold: false, smallcaps: true, uppercase: false, underline: false, letterSpacing: 0.04, background: '' },
    { id: 'estrangeiro', name: 'Termo estrangeiro', font: '', sizePct: 100, color: '', italic: true, bold: false, smallcaps: false, uppercase: false, underline: false, letterSpacing: 0, background: '' },
    { id: 'obra', name: 'Título de obra', font: '', sizePct: 100, color: '', italic: true, bold: false, smallcaps: false, uppercase: false, underline: false, letterSpacing: 0, background: '' },
    { id: 'sigla', name: 'Sigla', font: '', sizePct: 92, color: '', italic: false, bold: false, smallcaps: false, uppercase: true, underline: false, letterSpacing: 0.05, background: '' }
  ];
  // declarações CSS de um estilo de caractere
  function charStyleDecl(cs) {
    const d = [];
    if (cs.font) d.push(`font-family: "${String(cs.font).replace(/"/g, '')}", Georgia, serif`);
    if (cs.sizePct && Number(cs.sizePct) !== 100) d.push(`font-size: ${Number(cs.sizePct) / 100}em`);
    if (cs.color) d.push(`color: ${cs.color}`);
    d.push(`font-style: ${cs.italic ? 'italic' : 'normal'}`);
    d.push(`font-weight: ${cs.bold ? 700 : 'inherit'}`);
    if (cs.smallcaps) d.push('font-variant: small-caps');
    if (cs.uppercase) d.push('text-transform: uppercase');
    if (cs.underline) d.push('text-decoration: underline');
    if (Number(cs.letterSpacing)) d.push(`letter-spacing: ${Number(cs.letterSpacing)}em`);
    if (cs.background) d.push(`background: ${cs.background}`, 'padding: 0 0.1em');
    return d.join('; ');
  }
  // aparência “caixa alta espaçada” (subtítulos do anexo): só tipografia; posição, fonte e tamanho seguem editáveis
  const HEADING_PRESETS = {
    spaced: { h2: { font: 'Josefin Sans', size: 15, lineHeight: 1.42, color: '#1a1a1a', align: 'left', italic: false, bold: true, uppercase: true, smallcaps: false, letterSpacing: 0.1 },
      h3: { font: 'Josefin Sans', size: 12, lineHeight: 1.4, color: '#1a1a1a', align: 'left', italic: false, bold: true, uppercase: true, smallcaps: false, letterSpacing: 0.09 },
      h4: { font: 'Josefin Sans', size: 10.5, lineHeight: 1.4, color: '#1a1a1a', align: 'left', italic: false, bold: true, uppercase: true, smallcaps: false, letterSpacing: 0.08 } }
  };
  const charStylesCss = list => (list || []).filter(cs => cs && cs.id).map(cs => `span[data-cs="${String(cs.id).replace(/"/g, '')}"] { ${charStyleDecl(cs)}; }`).join('\n');

  const DEFAULT_STYLES = {
    body: { font: 'EB Garamond', size: 11.5, lineHeight: 1.4, color: '#000000', letterSpacing: 0, wordSpacing: 0, indent: 1.5, spaceAfter: 0, align: 'justify' },
    chapterTitle: { font: '', size: 22, color: '#000000', align: 'center', italic: false, bold: false, uppercase: false, letterSpacing: 0, spaceBefore: 35, spaceAfter: 6 },
    chapterLabel: { font: '', size: 10.5, color: '#000000', italic: false, uppercase: true, letterSpacing: 0.15, spaceAfter: 3 },
    // T1 e T2: caixa alta, sem serifa geométrica em negrito, letras espaçadas, à esquerda (personalizáveis)
    h2: { font: 'Josefin Sans', size: 15, lineHeight: 1.42, color: '#1a1a1a', align: 'left', italic: false, bold: true, uppercase: true, smallcaps: false, letterSpacing: 0.1, spaceBefore: 8, spaceAfter: 5 },
    h3: { font: 'Josefin Sans', size: 12, lineHeight: 1.4, color: '#1a1a1a', align: 'left', italic: false, bold: true, uppercase: true, smallcaps: false, letterSpacing: 0.09, spaceBefore: 6, spaceAfter: 3 },
    h4: { font: '', size: 11.5, color: '#000000', align: 'left', italic: false, bold: false, uppercase: false, smallcaps: true, letterSpacing: 0.04, spaceBefore: 4, spaceAfter: 2 },
    quote: { font: '', size: 10.5, lineHeight: 1.35, color: '#000000', align: 'justify', italic: false, indentLeft: 10, indentRight: 6, spaceBefore: 3, spaceAfter: 3 },
    phrase: { font: '', size: 14, lineHeight: 1.3, color: '#000000', align: 'center', italic: true, bold: false, uppercase: false, indentLeft: 8, indentRight: 8, spaceBefore: 5, spaceAfter: 5 },
    poem: { font: '', size: 11.5, lineHeight: 1.45, color: '#000000', align: 'left', italic: false, indentLeft: 12, spaceBefore: 4, spaceAfter: 4 },
    epigraph: { font: '', size: 10.5, color: '#000000', align: 'right', italic: true, indentLeft: 35 },
    reference: { font: '', size: 10, lineHeight: 1.3, color: '#000000', indent: -1.5, spaceAfter: 1.5, align: 'justify' },
    caption: { font: '', size: 9, color: '#333333', align: 'center', italic: true },
    footnote: { font: '', size: 8.5, lineHeight: 1.25, color: '#000000', align: 'justify' },
    box: { font: '', size: 10.5, color: '#000000', background: '#f2efe9', borderColor: '#b9ad9a', align: 'justify', spaceBefore: 4, spaceAfter: 4 },
    table: { font: '', size: 9.5, color: '#000000', borderColor: '#555555', background: '#efece6' },
    header: { font: '', size: 8.5, color: '#222222', italic: false, uppercase: true, letterSpacing: 0.08 },
    pageNumber: { font: '', size: 9.5, color: '#000000' },
    toc: { font: '', size: 11, color: '#000000', lineHeight: 1.5 }
  };

  const DEFAULT_SETTINGS = {
    pageFormat: DEFAULT_FORMAT_ID,
    // Modelo padrão do sistema: CEDET (ver CEDET acima). '' = livre.
    standard: 'cedet',
    pageWidth: 155,
    pageHeight: 230,
    pageColor: '#ffffff',
    marginTop: 28,
    marginBottom: 28,
    marginInner: 23,
    marginOuter: 20,
    // Sangria por borda (mm). Superior/inferior/externa; a interna normalmente é 0 no miolo.
    bleed: 0,
    bleedAuto: true,
    bleedTop: 5,
    bleedBottom: 5,
    bleedOuter: 5,
    bleedInner: 0,
    columns: 1,
    columnGap: 5,
    columnRule: true,
    safety: 20,
    // distância (mm) entre a mancha de texto e o número da página; 0 = centralizado na margem
    folioGap: 3,
    cropMarks: false,

    hyphenate: true,
    indentFirstParagraph: false,
    widowsOrphans: 2,
    keepHeadingsWithNext: true,

    chapterLabel: 'Capítulo',
    chapterNumbering: 'arabic',
    chapterStartRight: false, // páginas em branco nunca são inseridas
    // folha de saída pedida pela gráfica: a página do livro vai centralizada, sem reduzir nem cortar nada
    outputSheet: { mode: 'marks', w: 210, h: 297, marks: true, markOffset: 5, markLen: 5, markWeight: 0.25 },
    dropCap: true,
    dropCapLines: 2,
    dropCapFont: '', // vazio = a do título do capítulo
    dropCapColor: '',
    // filete fino sob o cabeçalho (título/autor), que se encontra na lombada com o livro aberto
    headerRule: { style: 'fina', color: '#6b6b6b', weight: 0.5, gap: 2.2, spine: true },
    smallCapsFirstLine: false,
    sceneBreak: '*  *  *',

    // Separador abaixo do título do capítulo: 'line' (filete liso — padrão), 'image' ou 'none'
    separator: 'line',
    separatorAsset: null,
    separatorWidth: 30,
    separatorColor: '#000000',

    // legendas numeradas: Figura N, Gráfico N, Tabela N (com listas opcionais nas páginas iniciais)
    captionNumbering: true,
    captionStyle: 'classica',
    charStyles: JSON.parse(JSON.stringify(DEFAULT_CHAR_STYLES)),
    // estilo do título dos capítulos/matérias: 'none' | 'black' (caixa preta, letra branca) | 'white' (caixa branca) | 'outline' (só contorno)
    titleBox: { style: 'none', align: '' },
    footnotesVisible: true,
    footnoteNumbering: 'book',

    header: 'title-chapter',
    // número da página: rodapé à esquerda, em branco dentro de um bloco preto (ou outra forma: naipes, estrela…)
    pageNumbers: 'center',
    pageNumberShape: 'circle',
    pageNumberBg: '#000000',
    pageNumberFg: '#ffffff',
    pageNumberShapeSize: 7,
    folioOnOpenings: true,
    folioV: 5,
    // página com moldura: some o cabeçalho (obra e autor) e o filete
    frameHidesHeader: true,
    // “Título” no texto = mesma fonte do título do capítulo, começando em página nova; “Subtítulo” = mesma fonte, em negrito
    headingsLikeChapter: true,
    numberFromFirstChapter: false,
    // pré-textuais em algarismos romanos (i, ii, iii…) e arábicos a partir do 1º capítulo
    frontNumbering: 'none',

    // ---------- acabamento tipográfico ----------
    // grade de linha de base: as linhas de páginas opostas ficam na mesma altura (títulos, imagens e
    // tabelas ocupam um número inteiro de linhas)
    baselineGrid: true,
    // justificação fina: linhas frouxas recebem ajuste mínimo de entreletra e de espaço entre palavras
    fineJustify: true,
    // palavras com hifenização própria: "a-na-cro-nis-mo" (hífens = pontos de quebra) ou sem hífen (nunca quebra)
    hyphenExceptions: '',
    // ajuste da última página: encolhe/expande levemente o capítulo para não sobrarem linhas sozinhas
    lastPageAdjust: true,
    lastPageMinLines: 3,
    // notas: 'footnote' (rodapé), 'chapter' (fim do capítulo), 'book' (fim do livro), 'side' (margem externa)
    notesMode: 'footnote',
    endnotesTitle: 'Notas',
    // normas: referências 'hanging' (recuo pendente) ou 'abnt' (NBR 6023); citação longa 'book' ou 'abnt' (NBR 10520)
    referenceStyle: 'hanging',
    quoteStyle: 'book',
    // índice remissivo nas páginas finais (gerado a partir dos termos marcados no texto)
    index: { enabled: true, title: 'Índice remissivo', columns: 2 },

    styles: JSON.parse(JSON.stringify(DEFAULT_STYLES))
  };

  /* Configurações prontas por gênero (sobrescrevem campos de settings/styles) */
  const GENRE_PRESETS = {
    romance: {
      label: 'Romance', separatorLibrary: 'coracao-linhas',
      settings: { dropCap: true, smallCapsFirstLine: false, header: 'title-chapter', pageNumbers: 'center', sceneBreak: '❦' },
      styles: { body: { font: 'EB Garamond', size: 11.5, lineHeight: 1.4, align: 'justify', indent: 1.5 }, chapterTitle: { font: 'Playfair Display', size: 22, italic: true, align: 'center', spaceBefore: 40 }, chapterLabel: { font: 'EB Garamond' } }
    },
    poesia: {
      label: 'Poesia', separatorLibrary: 'pena',
      settings: { dropCap: false, header: 'none', pageNumbers: 'center', chapterNumbering: 'none', chapterStartRight: false, hyphenate: false, sceneBreak: '·' },
      styles: { body: { font: 'Cormorant Garamond', size: 12.5, lineHeight: 1.5, align: 'left', indent: 0 }, chapterTitle: { font: 'Cormorant Garamond', size: 18, italic: true, align: 'left', spaceBefore: 20 }, poem: { indentLeft: 0, size: 12.5 } }
    },
    terror: {
      label: 'Terror', separatorLibrary: 'espinhos',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center', chapterNumbering: 'roman', sceneBreak: '✝', pageColor: '#ffffff' },
      styles: { body: { font: 'Crimson Pro', size: 11.5, lineHeight: 1.35, align: 'justify' }, chapterTitle: { font: 'Cormorant Garamond', size: 26, uppercase: true, letterSpacing: 0.12, color: '#5a0d0d', spaceBefore: 45 }, chapterLabel: { color: '#5a0d0d' } }
    },
    suspense: {
      label: 'Suspense / policial', separatorLibrary: 'linha-dupla',
      settings: { dropCap: false, header: 'title-chapter', pageNumbers: 'center', chapterNumbering: 'arabic', chapterLabel: '', sceneBreak: '■' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5 }, chapterTitle: { font: 'Libre Baskerville', size: 30, bold: true, align: 'left', spaceBefore: 30 } }
    },
    fantasia: {
      label: 'Fantasia', separatorLibrary: 'arabesco',
      settings: { dropCap: true, smallCapsFirstLine: true, header: 'title-chapter', pageNumbers: 'center', chapterNumbering: 'words', sceneBreak: '✦  ✦  ✦' },
      styles: { body: { font: 'EB Garamond', size: 11.5 }, chapterTitle: { font: 'Cormorant Garamond', size: 24, uppercase: true, letterSpacing: 0.1, spaceBefore: 45 } }
    },
    ficcaocientifica: {
      label: 'Ficção científica', separatorLibrary: 'orbita',
      settings: { dropCap: false, header: 'title-chapter', pageNumbers: 'center', chapterNumbering: 'arabic', chapterLabel: '', sceneBreak: '◆' },
      styles: { body: { font: 'Lora', size: 10.5, lineHeight: 1.45 }, chapterTitle: { font: 'Lora', size: 20, uppercase: true, letterSpacing: 0.2, align: 'left', spaceBefore: 30 } }
    },
    contos: {
      label: 'Contos / crônicas', separatorLibrary: 'losango',
      settings: { dropCap: true, header: 'chapter-chapter', pageNumbers: 'center', chapterNumbering: 'none', chapterStartRight: false },
      styles: { body: { font: 'Crimson Pro', size: 12 }, chapterTitle: { font: 'Crimson Pro', size: 20, italic: true, spaceBefore: 30 } }
    },
    infantil: {
      label: 'Infantojuvenil', separatorLibrary: 'estrelas',
      settings: { dropCap: true, header: 'none', pageNumbers: 'center', hyphenate: false, sceneBreak: '★' },
      styles: { body: { font: 'Merriweather', size: 12.5, lineHeight: 1.65, align: 'justify', indent: 1.2, spaceAfter: 1.5 }, chapterTitle: { font: 'Merriweather', size: 22, bold: true, color: '#1d4f8a', spaceBefore: 30 } }
    },
    autoajuda: {
      label: 'Autoajuda / negócios', separatorLibrary: 'linha-ponto',
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'center', sceneBreak: '—' },
      styles: { body: { font: 'Lora', size: 10.5, lineHeight: 1.5, align: 'justify', indent: 0, spaceAfter: 2 }, chapterTitle: { font: 'Playfair Display', size: 24, align: 'left', bold: true, spaceBefore: 25 }, h2: { font: 'Playfair Display', align: 'left', bold: true } }
    },
    biografia: {
      label: 'Biografia / memórias', separatorLibrary: 'folhas',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5 }, chapterTitle: { font: 'Libre Baskerville', size: 19, italic: true, spaceBefore: 35 } }
    },
    religioso: {
      label: 'Religioso / espiritual', separatorLibrary: 'cruz-flor',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center' },
      styles: { body: { font: 'EB Garamond', size: 12, lineHeight: 1.45 }, chapterTitle: { font: 'Cormorant Garamond', size: 24, uppercase: true, letterSpacing: 0.1, spaceBefore: 40 } }
    },
    academico: {
      label: 'Acadêmico / técnico', separatorLibrary: null,
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'center', separator: 'none', chapterStartRight: false, chapterLabel: '' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5, indent: 1.25 }, chapterTitle: { font: 'Libre Baskerville', size: 17, align: 'left', bold: true, spaceBefore: 15 }, h2: { align: 'left', bold: true, size: 12.5 }, h3: { size: 11, bold: true, italic: false } }
    },
    naoficcao: {
      label: 'Não-ficção / ensaio', separatorLibrary: 'linha-fina-afinada',
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'center', sceneBreak: '—' },
      styles: { body: { font: 'Merriweather', size: 10, lineHeight: 1.5, align: 'justify', indent: 1.3 }, chapterTitle: { font: 'Merriweather', size: 20, bold: true, align: 'left', spaceBefore: 28 }, h2: { font: 'Merriweather', size: 13, bold: true, align: 'left' }, h3: { font: 'Merriweather', size: 11, bold: true, italic: false, align: 'left' } }
    },
    humanas: {
      label: 'Ciências humanas', separatorLibrary: 'linha-simples',
      settings: { dropCap: false, header: 'author-title', pageNumbers: 'center', chapterLabel: 'Capítulo', sceneBreak: '*' },
      styles: { body: { font: 'Crimson Pro', size: 11.5, lineHeight: 1.45, align: 'justify', indent: 1.5 }, chapterTitle: { font: 'Crimson Pro', size: 21, smallcaps: true, align: 'center', spaceBefore: 32 }, h2: { font: 'Crimson Pro', size: 14, italic: false, bold: true, align: 'left' }, h3: { font: 'Crimson Pro', size: 12, italic: true, align: 'left' }, quote: { size: 10.5, indentLeft: 12 }, reference: { size: 10 } }
    },
    historia: {
      label: 'História', separatorLibrary: 'art-deco',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center', sceneBreak: '❧' },
      styles: { body: { font: 'Libre Baskerville', size: 10, lineHeight: 1.5, align: 'justify' }, chapterTitle: { font: 'Cormorant Garamond', size: 24, uppercase: true, letterSpacing: 0.08, spaceBefore: 36 }, h2: { font: 'Cormorant Garamond', size: 15, smallcaps: true } }
    },
    filosofia: {
      label: 'Filosofia', separatorLibrary: 'tres-losangos',
      settings: { dropCap: false, header: 'chapter-chapter', pageNumbers: 'center', sceneBreak: '§' },
      styles: { body: { font: 'EB Garamond', size: 11.5, lineHeight: 1.5, align: 'justify', indent: 1.5 }, chapterTitle: { font: 'EB Garamond', size: 20, italic: true, align: 'center', spaceBefore: 38 }, h2: { font: 'EB Garamond', size: 13.5, smallcaps: true, align: 'center' } }
    },
    jornalismo: {
      label: 'Jornalismo / reportagem', separatorLibrary: 'linha-dupla',
      settings: { dropCap: true, header: 'title-chapter', pageNumbers: 'center', sceneBreak: '■' },
      styles: { body: { font: 'Merriweather', size: 9.5, lineHeight: 1.5, align: 'justify', indent: 1.2 }, chapterTitle: { font: 'Playfair Display', size: 26, bold: true, align: 'left', spaceBefore: 22 }, h2: { font: 'Playfair Display', size: 14, bold: true, align: 'left' } }
    },
    culinaria: {
      label: 'Culinária / guias práticos', separatorLibrary: 'pontos',
      settings: { dropCap: false, header: 'chapter-chapter', pageNumbers: 'center', chapterNumbering: 'none', sceneBreak: '•' },
      styles: { body: { font: 'Lora', size: 10.5, lineHeight: 1.5, align: 'justify', indent: 0, spaceAfter: 2 }, chapterTitle: { font: 'Playfair Display', size: 28, italic: true, align: 'center', spaceBefore: 20 }, h2: { font: 'Lora', size: 13, bold: true, align: 'left', uppercase: true, letterSpacing: 0.06 }, box: { background: '#f6efe2' } }
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

  const INVITE_ADDRESS = 'Casa Vertigem Editora de Livros\nRua Santa Clara, 205/404\nCopacabana, Rio de Janeiro/RJ — CEP 22041-011';

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
      // crédito de distribuição impresso na ficha (CEDET: obrigatório; preenchido automaticamente)
      distribution: '',
      style: 'box', // box, plain, double, rounded, cbl, compact
      position: 'bottom', // bottom (pé da página) ou top
      images: [], // { asset, width (mm), caption }
      qrcodes: [] // { text, caption, size (mm) }
    };
  }

  function newProject(userDefaults) {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (userDefaults && typeof userDefaults === 'object') {
      // “meu padrão” salvo antes do modelo CEDET: só os estilos de texto são aproveitados
      if (userDefaults.standard === undefined) mergeSettings(settings, { styles: userDefaults.styles || {} });
      else mergeSettings(settings, userDefaults);
    }
    // o modelo CEDET é o padrão: formato, margens, sangria, marcas e numeração sempre conforme o manual
    if (isCedet(settings)) applyCedet(settings, settings.pageFormat);
    return {
      format: 'diagramador-de-livros',
      version: 2,
      kind: 'book',
      genre: '',
      masthead: { name: '', tagline: '', edition: '', date: '', logo: null, show: true },
      meta: {
        title: 'Meu Livro', subtitle: '', author: 'Nome do Autor', publisher: '', city: '',
        year: String(new Date().getFullYear()), edition: '1ª edição', isbn: '',
        dedication: 'Para quem sempre acreditou nesta história.', epigraph: '', epigraphAuthor: '',
        language: 'pt-BR', description: ''
      },
      front: { halfTitle: false, titlePage: true, copyright: true, toc: true, tocTitle: 'Sumário', tocMode: 'auto', tocLevels: 1, tocEntries: [], tocStyle: 'dots', tocTheme: 'none', tocColor: '#1d1d24', listQuadros: false, dedication: false, epigraph: false, listFigures: false, listCharts: false, listTables: false },
      titlePage: { logo: null, logoWidth: 25, showPublisher: true, showYear: true, logoPlacement: 'foot', imprint: '' },
      catalog: Object.assign(emptyCatalog(), isCedet(settings) ? { distribution: CEDET.distribution } : {}),
      back: {
        bio: { enabled: false, title: 'Sobre o autor', html: '', photo: null, photoWidth: 35 },
        extra: { enabled: false, title: 'Do mesmo autor', html: '' },
        // página-convite no fim de todo livro: outros títulos da casa, site, QR do Instagram e endereço da editora
        // (o endereço do Cedet fica só na ficha catalográfica)
        invite: { enabled: true, site: 'www.casavertigem.com.br', instagram: 'casavertigem', address: INVITE_ADDRESS }
      },
      chapters: [{ id: uid(), title: 'O começo', numbered: true, html: SAMPLE_TEXT, locked: false, style: {}, separator: 'default', openingImage: null }],
      assets: {},
      overlays: [],
      cover: null,
      // capa e imagens antes da página de rosto (página inteira, sem margens), também usadas no EPUB
      ebook: { coverAsset: null, coverInBook: true, preImages: [] },
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

  // Acentos: texto vindo de EPUB, Word ou PDF às vezes guarda o acento como um caractere à parte
  // ("a" + "~" combinante, forma NFD). Várias fontes e o Word não posicionam esse acento solto e ele
  // aparece deslocado. Tudo passa para a forma composta (NFC: "ã" num caractere só). Imagens (data:) ficam.
  const COMBINING = /[\u0300-\u036f]/;
  function nfcDeep(v, depth) {
    if (typeof v === 'string') return v.startsWith('data:') || !COMBINING.test(v) ? v : v.normalize('NFC');
    if (!v || typeof v !== 'object' || (depth || 0) > 40) return v;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = nfcDeep(v[i], (depth || 0) + 1); return v; }
    for (const k of Object.keys(v)) v[k] = nfcDeep(v[k], (depth || 0) + 1);
    return v;
  }

  // Converte projetos da versão 1 e completa campos ausentes
  function normalizeProject(p) {
    const base = newProject();
    p = p && typeof p === 'object' ? p : {};
    if (p.chapters) nfcDeep(p);
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
    // projetos anteriores ao modelo CEDET mantêm exatamente o comportamento com que foram feitos
    if (p.settings && ps.standard === undefined) {
      ps.standard = '';
      if (ps.folioGap === undefined) ps.folioGap = 0;
      if (ps.numberFromFirstChapter === undefined) ps.numberFromFirstChapter = true;
      if (ps.outputSheet === undefined) ps.outputSheet = { mode: 'trim', w: 210, h: 297, marks: true };
      if (ps.safety === undefined) ps.safety = 5;
      if (ps.captionNumbering === undefined) ps.captionNumbering = false;
    }
    // projetos anteriores ao acabamento tipográfico automático mantêm a paginação com que foram feitos
    if (p.settings && ps.baselineGrid === undefined) {
      ps.baselineGrid = false;
      if (ps.fineJustify === undefined) ps.fineJustify = false;
      if (ps.lastPageAdjust === undefined) ps.lastPageAdjust = false;
    }
    if (ps.index) ps.index = Object.assign({}, DEFAULT_SETTINGS.index, ps.index);
    // 4.17: número da página à esquerda, num bloco preto (uma vez; depois vale a escolha do usuário)
    // 4.18: padrão = círculo preto com o número branco, à esquerda nas duas páginas (uma vez; depois vale a escolha)
    if (!(ps.folioV >= 2) && p.chapters) { if (!ps.pageNumberShape || ps.pageNumberShape === 'block') ps.pageNumberShape = 'circle'; if (!ps.pageNumbers || ps.pageNumbers === 'outer') ps.pageNumbers = 'left'; ps.folioV = 2; }
    // CEDET: “à esquerda em todas as páginas” punha o número no canto interno das páginas ímpares,
    // o que o manual não aceita — passa para o canto externo
    // número da página sempre no centro do rodapé, em todas as páginas
    if (!(ps.folioV >= 5) && p.chapters) { if (ps.pageNumbers !== 'none') ps.pageNumbers = 'center'; ps.folioV = 5; }
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
          openingImage: c.openingImage || null,
          frame: c.frame || '',
          kicker: c.kicker || '', lead: c.lead || '', byline: c.byline || '',
          columns: c.columns || 0, newPage: c.newPage !== false,
          summary: c.summary || '',
          bleed: c.bleed && typeof c.bleed === 'object' ? c.bleed : null,
          titleBox: c.titleBox && typeof c.titleBox === 'object' ? c.titleBox : null,
          layout: typeof c.layout === 'string' ? c.layout : ''
        }))
      : base.chapters;
    const catalog = Object.assign(emptyCatalog(), p.catalog || {});
    return {
      format: base.format,
      version: 2,
      kind: ['book', 'magazine', 'newspaper'].includes(p.kind) ? p.kind : 'book',
      genre: p.genre || '',
      masthead: Object.assign({}, base.masthead, p.masthead || {}),
      meta: Object.assign({}, base.meta, p.meta || {}),
      front: Object.assign({}, base.front, p.front || {}),
      titlePage: Object.assign({}, base.titlePage, p.titlePage || {}),
      catalog,
      back: {
        bio: Object.assign({}, base.back.bio, (p.back && p.back.bio) || {}),
        extra: Object.assign({}, base.back.extra, (p.back && p.back.extra) || {}),
        invite: Object.assign({}, base.back.invite, (p.back && p.back.invite) || {})
      },
      chapters,
      assets: Object.assign({}, p.assets || {}),
      overlays: Array.isArray(p.overlays) ? p.overlays : [],
      // cores de páginas isoladas: { "<nº da página>": { bg, color } }
      pageStyles: p.pageStyles && typeof p.pageStyles === 'object' ? p.pageStyles : {},
      // títulos marcados pelo usuário como “não é título” (podem ser revertidos)
      notTitles: Array.isArray(p.notTitles) ? p.notTitles : [],
      // imersão: imagem acima do título dos capítulos (uma para todos ou uma por capítulo, sorteada)
      immersion: Object.assign({ mode: 'off', single: null, pool: [], assign: {}, height: 36, fade: true, numberedOnly: false }, p.immersion || {}),
      // molduras: 'all' = moldura em todas as páginas (id do modelo ou 'up:<imagem>'); uploads = molduras enviadas
      frames: Object.assign({ all: '', uploads: [] }, p.frames || {}),
      cover: p.cover || null,
      // livro digital (EPUB/MOBI): imagem da capa escolhida para as lojas e aplicativos de leitura
      ebook: Object.assign({ coverAsset: null, coverInBook: true, preImages: [] }, p.ebook || {}),
      fontSubstitutions: Array.isArray(p.fontSubstitutions) ? p.fontSubstitutions : [],
      exportLog: Array.isArray(p.exportLog) ? p.exportLog : [],
      // ajuste automático da última página de cada capítulo: { idDoCapítulo: { mode: 'shrink'|'expand', hash } }
      layoutAdjust: p.layoutAdjust && typeof p.layoutAdjust === 'object' ? p.layoutAdjust : {},
      // páginas do índice remissivo na última paginação (reservam o espaço certo na próxima)
      indexCache: p.indexCache && typeof p.indexCache === 'object' ? p.indexCache : {},
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
    STYLE_DEFS, DEFAULT_STYLES, DEFAULT_CHAR_STYLES, charStyleDecl, charStylesCss, DEFAULT_SETTINGS, GENRE_PRESETS,
    uid, newProject, normalizeProject, nfcDeep, mergeSettings, applyGenrePreset, emptyCatalog,
    toUnit, fromUnit, MM, KDP, autoBleed, OUTPUT_SHEETS, outputSheetSize, markGeometry, CEDET, isCedet, applyCedet, CAPTION_STYLES, TOC_STYLES, HEADING_PRESETS,
    FREE_LAYOUT, applyFreeLayout, applyFormatOverrides
  };
});
