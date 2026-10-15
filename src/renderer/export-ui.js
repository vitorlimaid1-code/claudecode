/* global App */
// Módulo de exportação: perfis (gráfica, KDP, EPUB, prova…), verificação de pré-impressão,
// exportação por formato/intervalo, relatório técnico, pacote de produção e comparação com a última exportação.
(function () {
  const { el, $, api } = App;

  const BUILTIN = [
    { id: 'cedet', name: 'CEDET — miolo para impressão (padrão)', kind: 'pdf', purpose: 'print', cedet: true, bleed: 5, cropMarks: false, spreads: false, outline: false, color: 'gray', noProfile: true, minDpi: 300, errDpi: 200, notes: 'Manual Cedet: miolo preto e branco só com tinta preta (sGray, sem perfis incorporados), páginas individuais, sangria de 5 mm, marcas de corte de 0,25 pt a 5 mm do corte em todas as páginas, margem de segurança de 20 mm, numeração no canto inferior externo ou no centro. Arquivo: ISBN_MIOLO_NOME DO LIVRO.pdf.' },
    { id: 'grafica', name: 'Impressão em gráfica (offset)', kind: 'pdf', purpose: 'print', bleed: null, cropMarks: true, spreads: false, outline: false, color: 'cmyk', colorProfile: 'fogra39', minDpi: 300, errDpi: 200, notes: 'Sangria do livro (automática pelo formato ou a medida digitada), marcas de corte, cores em CMYK com perfil ICC (texto preto 100% K) e fontes incorporadas. Para miolo só preto e branco, escolha “Escala de cinza”. Confirme com a gráfica o perfil de cor exigido.' },
    { id: 'kdp', name: 'Amazon KDP (brochura)', kind: 'pdf', purpose: 'print', bleed: 3.175, bleedOnlyIfNeeded: true, cropMarks: false, spreads: false, color: 'rgb', minDpi: 300, errDpi: 150, minPages: 24, maxPages: 828, acceptedSizes: '127x203.2, 128.5x198.4, 133.4x203.2, 139.7x215.9, 152.4x228.6, 156x233.9, 169.9x244.1, 177.8x254, 189x246.1, 190.5x235, 203.2x254, 209.6x152.4, 209.6x209.6, 210x297, 215.9x215.9, 215.9x279.4, 108x174.5', notes: 'Use sangria (3,175 mm = 0,125 pol.) apenas se houver imagens até a borda. Miolo preto e branco: use “Escala de cinza”. Tamanhos aceitos conforme a lista do KDP — verifique a lista atual no site da Amazon.' },
    { id: 'pod', name: 'Impressão sob demanda (Clube de Autores, UICLAP…)', kind: 'pdf', purpose: 'print', bleed: null, color: 'rgb', cropMarks: false, spreads: false, minDpi: 300, errDpi: 150, notes: 'PDF com a sangria padrão do livro, sem marcas de corte. Confira as exigências atuais da plataforma.' },
    { id: 'digital', name: 'PDF para leitura digital', kind: 'pdf', purpose: 'digital', bleed: 0, cropMarks: false, spreads: false, outline: true, minDpi: 150, errDpi: 96, notes: 'Sem sangria, com marcadores (sumário navegável no leitor de PDF).' },
    { id: 'prova', name: 'Prova editorial (páginas duplas)', kind: 'pdf', purpose: 'digital', bleed: 0, cropMarks: false, spreads: true, outline: true, minDpi: 150, errDpi: 96, notes: 'Páginas lado a lado, como o livro aberto, para revisão. Não é imposição de cadernos.' },
    { id: 'epub', name: 'EPUB para leitura digital (Amazon KDP, Apple, Google, Kobo)', kind: 'epub', includeCover: true, minDpi: 72, errDpi: 0, notes: 'EPUB 3 com a capa como abertura em página inteira (e capa nos aplicativos de leitura), sumário navegável, todos os metadados da obra (ISBN, autor, colaboradores, editora, data, idioma, assuntos, série, direitos), imagens e notas. É o formato que a Amazon KDP recebe.' },
    { id: 'mobi', name: 'MOBI para Kindle', kind: 'mobi', includeCover: true, minDpi: 72, errDpi: 0, notes: 'MOBI com a capa marcada para a biblioteca do Kindle, sumário com links, metadados e imagens. Para publicar na Amazon KDP use o EPUB; o MOBI serve para Kindles e aplicativos que leem MOBI.' },
    { id: 'imagens', name: 'Imagens das páginas (PNG 300 dpi)', kind: 'png', dpi: 300, minDpi: 300, errDpi: 150, imageBleed: true },
    { id: 'word', name: 'Documento editável (DOCX)', kind: 'docx' }
  ];
  const KINDS = [['pdf', 'PDF'], ['epub', 'EPUB 3'], ['mobi', 'MOBI (Kindle)'], ['png', 'PNG'], ['jpeg', 'JPEG'], ['tiff', 'TIFF'], ['docx', 'DOCX (Word)'], ['odt', 'ODT (LibreOffice)'], ['txt', 'TXT'], ['package', 'Pacote de produção (ZIP)']];

  const state = { profiles: null, current: null, opts: null, report: null, rangeMode: 'all', range: '', running: false };

  async function loadProfiles() {
    const saved = await api.profilesGet();
    state.profiles = BUILTIN.concat(Array.isArray(saved) ? saved : []);
    if (!state.current) selectProfile(App.project.settings.standard === 'cedet' ? 'cedet' : 'grafica');
  }
  function selectProfile(id) {
    const p = state.profiles.find(x => x.id === id) || state.profiles[0];
    state.current = p.id;
    state.opts = JSON.parse(JSON.stringify(p));
    state.report = null;
  }

  // ---------------------------------------------------------------- verificação
  function projectForExport() {
    const proj = JSON.parse(JSON.stringify(App.serialize()));
    const o = state.opts;
    if (o.kind === 'pdf' || o.kind === 'package' || ['png', 'jpeg', 'tiff'].includes(o.kind)) {
      const fix = b => { proj.settings.bleedAuto = false; proj.settings.bleedTop = proj.settings.bleedBottom = proj.settings.bleedOuter = b; };
      if (o.purpose === 'digital') { fix(0); proj.settings.cropMarks = false; }
      else if (o.cedet) {
        // CEDET: sangria de 5 mm e marcas de corte de 0,25 pt com 5 mm de deslocamento em todas as páginas
        fix(App.D.CEDET.bleed);
        proj.settings.cropMarks = false;
        proj.settings.outputSheet = Object.assign({ mode: 'marks', w: 210, h: 297 }, { marks: true, markOffset: App.D.CEDET.marks.offset, markLen: App.D.CEDET.marks.len, markWeight: App.D.CEDET.marks.weight });
      } else {
        const needs = needsBleed(proj);
        // perfil sem medida própria: usa a sangria do livro (automática pelo formato ou manual)
        if (o.bleed != null && o.bleed !== '') fix(o.bleedOnlyIfNeeded && !needs ? 0 : Number(o.bleed));
        else if (o.bleedOnlyIfNeeded && !needs) fix(0);
        proj.settings.cropMarks = !!o.cropMarks;
      }
    }
    return proj;
  }
  App.needsBleed = p => needsBleed(p);
  const bleedOf = s => (s.bleedAuto ? App.D.autoBleed(s) : Math.max(s.bleedTop || 0, s.bleedBottom || 0, s.bleedOuter || 0));
  App.bleedOf = bleedOf;
  function needsBleed(p) {
    const W = p.settings.pageWidth, H = p.settings.pageHeight;
    return p.chapters.some(c => /class="fullbleed"/.test(c.html) || (c.openingImage && c.openingImage.asset)) ||
      (p.overlays || []).some(o => !o.hidden && (o.x <= 0.3 || o.y <= 0.3 || o.x + o.w >= W - 0.3 || o.y + o.h >= H - 0.3));
  }

  async function preflight() {
    const o = state.opts;
    App.toast('Verificando o arquivo…', 30000);
    const proj = projectForExport();
    const r = await api.inspect(proj, { minDpi: o.minDpi || 300, errDpi: o.errDpi || 150 });
    $('#toast').classList.remove('show');
    const issues = (r.issues || []).slice();
    const s = proj.settings;
    // regras do perfil
    if (o.acceptedSizes) {
      const ok = o.acceptedSizes.split(',').map(x => x.trim().split('x').map(Number)).some(([w, h]) => Math.abs(w - s.pageWidth) < 0.6 && Math.abs(h - s.pageHeight) < 0.6);
      if (!ok) issues.push({ level: 'error', type: 'size', msg: `O formato ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm não está na lista de tamanhos do perfil “${o.name}”.` });
    }
    if (o.minPages && r.pages < o.minPages) issues.push({ level: 'error', type: 'pages', msg: `O livro tem ${r.pages} páginas; o perfil exige no mínimo ${o.minPages}.` });
    if (o.maxPages && r.pages > o.maxPages) issues.push({ level: 'error', type: 'pages', msg: `O livro tem ${r.pages} páginas; o perfil aceita no máximo ${o.maxPages}.` });
    if (o.purpose === 'print' && o.kind !== 'cover') {
      const sh = App.D.outputSheetSize(s, bleedOf(s));
      if (sh && !sh.fits) issues.push({ level: 'error', type: 'size', msg: `A folha de saída (${App.fmtNum(sh.w)} × ${App.fmtNum(sh.h)} mm) é menor que a página com sangria${s.outputSheet.marks ? ' e marcas' : ''} (${App.fmtNum(sh.needW)} × ${App.fmtNum(sh.needH)} mm). Para não cortar nada, o PDF sairá no formato do livro. Ajuste em Formato e diagramação › Folha de saída.` });
      else if (sh) issues.push({ level: 'info', type: 'size', msg: `Folha de saída ${App.fmtNum(sh.w)} × ${App.fmtNum(sh.h)} mm: cada página fica centralizada em tamanho real${s.outputSheet.marks ? ', com marcas de corte' : ''} (TrimBox mantida; Bleed Box se ativada).` });
    }
    if (o.cedet || s.standard === 'cedet') cedetChecks(proj, r, issues);
    if (r.pages % 2) issues.push({ level: 'info', type: 'pages', msg: `Número ímpar de páginas (${r.pages}); a gráfica acrescentará uma página em branco no fim.` });
    if (o.purpose === 'print' && needsBleed(proj) && !bleedOf(s)) issues.push({ level: 'error', type: 'bleed', msg: 'Há imagens ou fundos até a borda da página, mas a exportação está sem sangria: pode aparecer filete branco após o corte.', fix: 'bleed' });
    (r.fontReport || []).forEach(f => { if (!f.embeddable) issues.push({ level: 'error', type: 'font', msg: `A licença da fonte “${f.family}” não permite incorporação no PDF. Escolha outra fonte (Estilos de texto ou Fontes).` }); });
    (r.missingFonts || []).forEach(f => issues.push({ level: 'error', type: 'font', msg: `Fonte “${f}” ausente neste computador: o texto seria mostrado em outra fonte.`, fix: 'fonts' }));
    (r.missingAssets || []).forEach(id => issues.push({ level: 'error', type: 'missing', msg: `Referência de imagem quebrada (${id}).`, fix: 'assets' }));
    Object.values(proj.assets).forEach(a => {
      if (a.info && a.info.colorSpace === 'CMYK' && o.kind !== 'cover') issues.push({ level: 'warn', type: 'color', msg: `“${a.name}” está em CMYK: no miolo ela é mostrada pelo navegador em RGB e convertida de novo na saída; as cores podem mudar. Prefira imagens RGB com perfil (ou use-a na capa, onde o CMYK é preservado).` });
    });
    const phs = (proj.chapters || []).filter(c => /class="[^"]*\bph-block\b/.test(c.html || ''));
    if (phs.length && o.kind !== 'cover') issues.push({ level: 'warn', type: 'missing', msg: `Há blocos de imagem cinza ainda sem imagem em: ${phs.map(c => '“' + (c.title || 'sem título') + '”').join(', ')}. Eles saem como áreas cinza com a legenda de teste — clique no “+” de cada bloco para escolher a imagem, ou remova-o.` });
    const hasAlpha = Object.values(proj.assets).some(a => a.info && a.info.hasAlpha);
    if (o.purpose === 'print') {
      const col = o.color || 'rgb';
      issues.push({ level: 'info', type: 'color', msg: col === 'cmyk' ? 'Cores do miolo em CMYK com perfil ICC (texto e cinzas somente em preto K), OutputIntent no PDF, TrimBox (Bleed Box se ativada) e todas as fontes incorporadas.' : col === 'gray' ? 'Miolo em escala de cinza (texto 100% K), com TrimBox (Bleed Box se ativada) e todas as fontes incorporadas.' : 'Miolo em RGB com fontes incorporadas (aceito por KDP e pela maioria das impressões sob demanda). Para gráfica offset, escolha CMYK ou Escala de cinza.' });
      if (hasAlpha) issues.push({ level: 'info', type: 'alpha', msg: 'Há imagens com transparência: o PDF mantém a transparência (aceita em PDF/X-4 e pela maioria das gráficas; se a sua exigir PDF/X-1a, achate as imagens antes).' });
    }
    const order = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    state.report = { pages: r.pages, issues, images: r.images, fonts: r.fonts, fontReport: r.fontReport, chapterPages: r.chapterPages, at: new Date(), settings: s };
    render();
    return state.report;
  }

  // Bleed Box: marcação interna do PDF com a área de sangria. Desligada por padrão (o Cedet não exige no
  // envio; a gráfica pede quando precisar). Vale para o miolo, a capa e o pacote de produção.
  function bleedBoxToggle() {
    const s = App.project.settings;
    const on = !!s.pdfBleedBox;
    const btn = el('button', { class: on ? 'primary' : '', text: on ? '✓ Bleed Box ativado — clique para desativar' : 'Ativar Bleed Box', onclick: () => { s.pdfBleedBox = !s.pdfBleedBox; App.changed(s.pdfBleedBox ? 'Bleed Box ativado na exportação' : 'Bleed Box desativado na exportação', { preview: false }); render(); } });
    return el('div', { class: 'field bleedbox-field' }, [el('span', { class: 'flabel', text: 'Bleed Box no PDF' }), el('div', { class: 'inline wrap' }, [btn, el('span', { class: 'small muted', text: on ? 'O PDF exportado (miolo e capa) recebe a Bleed Box, a marcação da área de sangria.' : 'Desativado (padrão). Ative quando a gráfica pedir a marcação interna da sangria.' })])]);
  }

  // Conferência do Manual de Preparação de Arquivos Cedet (miolo)
  function cedetChecks(proj, r, issues) {
    const s = proj.settings, C = App.D.CEDET;
    const fmt = App.D.PAGE_FORMATS.find(f => f.id === s.pageFormat);
    const okFmt = App.D.PAGE_FORMATS.filter(f => C.formats.includes(f.id)).some(f => Math.abs(f.width - s.pageWidth) < 0.3 && Math.abs(f.height - s.pageHeight) < 0.3);
    if (!okFmt) issues.push({ level: 'error', type: 'cedet', msg: `CEDET: o formato ${App.fmtNum(s.pageWidth / 10)} × ${App.fmtNum(s.pageHeight / 10)} cm${fmt ? ' (' + fmt.label + ')' : ''} não é aceito. Use 15,5 × 23, 13,7 × 21 ou 11,5 × 17,5 cm (Formato e diagramação › CEDET).` });
    const small = [['superior', s.marginTop], ['inferior', s.marginBottom], ['interna', s.marginInner], ['externa', s.marginOuter]].filter(([, v]) => Number(v) < C.safety - 0.01);
    if (small.length) issues.push({ level: 'error', type: 'cedet', msg: `CEDET: margem de segurança de 20 mm em todos os lados. Abaixo do mínimo: ${small.map(([k, v]) => `${k} ${App.fmtNum(v)} mm`).join(', ')}.`, fix: 'cedet' });
    if (s.header !== 'none' && Number(s.marginTop) < 27) issues.push({ level: 'warn', type: 'cedet', msg: 'CEDET: com cabeçalho, use margem superior de pelo menos 27 mm para o cabeçalho também ficar dentro da margem de segurança de 20 mm.', fix: 'cedet' });
    if (s.pageNumbers !== 'none' && !(Number(s.folioGap) > 0) && Number(s.marginBottom) < 46) issues.push({ level: 'warn', type: 'cedet', msg: 'CEDET: o número da página fica centrado na margem inferior e pode ficar a menos de 20 mm do corte. Reaplique o modelo CEDET (número logo abaixo do texto).', fix: 'cedet' });
    if (s.pageNumbers === 'top-outer') issues.push({ level: 'info', type: 'cedet', msg: 'CEDET: a numeração no topo não é aceita; ela sai no canto inferior externo.' });
    if (s.pageNumbers === 'left') issues.push({ level: 'warn', type: 'cedet', msg: 'CEDET: o número está à esquerda em todas as páginas (padrão da editora). O manual do Cedet pede o canto inferior externo ou o centro; nas páginas ímpares o número fica no canto interno, perto da lombada — confirme com a equipe de Editoras Parceiras se aceitam.' });
    if (s.pageNumbers === 'none') issues.push({ level: 'error', type: 'cedet', msg: 'CEDET: o miolo deve ter numeração de páginas.' });
    // imagens e marcações coloridas: o miolo sai só com tinta preta
    const used = new Set();
    proj.chapters.forEach(c => { String(c.html || '').replace(/data-asset="([^"]+)"/g, (m, id) => { used.add(id); return m; }); if (c.openingImage && c.openingImage.asset) used.add(c.openingImage.asset); });
    const colorImgs = [...used].map(id => proj.assets[id]).filter(a => a && !(a.info && /gray|grey|cinza/i.test(a.info.colorSpace || '')));
    if (colorImgs.length) issues.push({ level: 'info', type: 'cedet', msg: `CEDET: ${colorImgs.length} imagem(ns) do miolo ${colorImgs.length > 1 ? 'são convertidas' : 'é convertida'} para tons de cinza na exportação (só tinta preta) — a prévia já mostra as páginas em cinza.` });
    if (proj.chapters.some(c => /\bhl-(yellow|green|pink)\b/.test(c.html || ''))) issues.push({ level: 'info', type: 'cedet', msg: 'CEDET: os marcadores coloridos (amarelo, verde, rosa) saem em tons de cinza.' });
    const dist = String((proj.catalog && proj.catalog.distribution) || '').replace(/\s+/g, ' ').trim(), official = C.distribution.replace(/\s+/g, ' ').trim();
    if (proj.front.copyright && dist !== official) issues.push({ level: 'warn', type: 'cedet', msg: 'CEDET: o crédito de distribuição na ficha não está igual ao texto oficial do manual. Use “Inserir o crédito oficial” em Créditos e ficha.' });
    if (s.numberFromFirstChapter) issues.push({ level: 'info', type: 'cedet', msg: 'Numeração a partir do 1º capítulo: o deslocamento é sempre par, então as páginas ímpares continuam à direita, como exige o manual.' });
    if (!proj.front.copyright) issues.push({ level: 'error', type: 'cedet', msg: 'CEDET: o crédito de distribuição deve constar na ficha catalográfica. Ative a página da ficha (Livro › Páginas iniciais).' });
    else issues.push({ level: 'info', type: 'cedet', msg: 'Crédito de distribuição do Cedet incluído na ficha catalográfica.' });
    const isbn = window.Isbn ? window.Isbn.parse(proj.meta.isbn) : { ok: !!proj.meta.isbn };
    if (!isbn.ok) issues.push({ level: 'warn', type: 'cedet', msg: `CEDET: ISBN ${proj.meta.isbn ? 'inválido — ' + isbn.error : 'não informado'}. Ele dá nome ao arquivo (ISBN_MIOLO_NOME DO LIVRO) e deve ser o mesmo do pré-cadastro.` });
    const colored = proj.chapters.some(c => c.style && (c.style.pageColor || c.style.textColor || c.style.titleColor)) || Object.keys(proj.pageStyles || {}).length || (s.pageColor && s.pageColor.toLowerCase() !== '#ffffff');
    if (colored) issues.push({ level: 'warn', type: 'cedet', msg: 'CEDET: o miolo é só preto e branco. Há cores de página ou de texto: elas sairão convertidas em tons de cinza (tinta preta).' });
    const cv = proj.cover;
    if (cv && cv.cedet && cv.spineMode === 'manual' && cv.spineFor && cv.spineFor.pages && r && r.pages && r.pages !== cv.spineFor.pages) issues.push({ level: 'warn', type: 'cedet', msg: `CEDET: a lombada da capa (${App.fmtNum(cv.spine)} mm) foi calculada para ${cv.spineFor.pages} páginas, mas o miolo tem ${r.pages}. Refaça o cálculo na calculadora do Cedet e atualize a capa.` });
    issues.push({ level: 'info', type: 'cedet', msg: 'Saída CEDET: sGray sem perfis incorporados, só tinta preta (as separações são conferidas na exportação), sangria de 5 mm, marcas de corte de 0,25 pt a 5 mm do corte, páginas individuais.' });
  }

  // ---------------------------------------------------------------- capa do livro digital (EPUB/MOBI)
  const ebook = () => { const p = App.project; p.ebook = p.ebook || { coverAsset: null }; return p.ebook; };
  async function chooseEbookCover() {
    const l = await api.pickImages({ title: 'Imagem da capa do livro digital (JPEG ou PNG — ideal 1600 × 2560 px)' });
    if (!l || !l.length) return null;
    const id = await App.addAsset(l[0]);
    ebook().coverAsset = id;
    App.changed('Capa do livro digital', { preview: false });
    return id;
  }
  function ebookCoverCard() {
    const e = ebook();
    const a = e.coverAsset && App.project.assets[e.coverAsset];
    const w = a && a.width, h = a && a.height;
    const ratio = w && h ? h / w : 0;
    const warn = a ? (Math.max(w, h) < 1000 ? '⚠ Imagem pequena: use pelo menos 1000 px no lado maior (ideal 2560 px).' : Math.abs(ratio - 1.6) > 0.25 ? `Proporção ${App.fmtNum(ratio, 2)}:1 — a Amazon recomenda 1,6:1 (ex.: 1600 × 2560 px); a imagem não é distorcida.` : '✓ Tamanho e proporção adequados.') : '';
    return el('div', { class: 'field wide ebook-cover' }, [
      el('span', { class: 'flabel', text: 'Capa do livro digital (abre o livro em página inteira e é a capa nas lojas e aplicativos)' }),
      el('div', { class: 'inline wrap' }, [
        a ? el('img', { class: 'ebook-thumb', src: App.assetUrl(e.coverAsset) }) : el('span', { class: 'muted small', text: 'Nenhuma imagem escolhida.' }),
        el('button', { text: a ? 'Trocar imagem…' : 'Escolher imagem da capa…', onclick: async () => { if (await chooseEbookCover()) render(); } }),
        App.project.cover ? el('button', { text: 'Usar a frente do módulo Capa', onclick: async () => { const r = await api.exportRun({ kind: 'coverFront', project: App.serialize() }); if (r && r.dataUrl) { e.coverAsset = await App.addAsset({ dataUrl: r.dataUrl, name: 'Capa do livro digital', width: 1600, height: 2400 }); App.changed('Capa do livro digital', { preview: false }); render(); } } }) : null,
        a ? el('button', { class: 'ghost', text: '✕', title: 'Remover', onclick: () => { e.coverAsset = null; App.changed('Capa do livro digital removida', { preview: false }); render(); } }) : null
      ]),
      a ? el('span', { class: 'hint', text: `${w} × ${h} px. ${warn}` }) : el('span', { class: 'hint', text: 'Ideal: JPEG ou PNG de 1600 × 2560 px (proporção 1,6:1), RGB. A imagem é convertida para JPEG RGB sem transparência.' })
    ]);
  }
  // pede a capa se ainda não houver: devolve dataUrl, '' (sem capa) ou false (cancelar)
  async function ebookCoverFor(o) {
    const e = ebook();
    if (!(e.coverAsset && App.project.assets[e.coverAsset])) {
      const opts = ['Escolher imagem da capa…'].concat(App.project.cover ? ['Usar a frente do módulo Capa'] : [], ['Exportar sem capa', 'Cancelar']);
      const b = await api.confirm('O livro digital precisa de uma capa', 'A imagem da capa abre o livro em página inteira e é a capa mostrada na Amazon, na biblioteca do Kindle e nos aplicativos de leitura. Ideal: 1600 × 2560 px.', opts);
      const pick = opts[b];
      if (pick === 'Escolher imagem…' || pick === 'Escolher imagem da capa…') { if (!(await chooseEbookCover())) return false; }
      else if (pick === 'Usar a frente do módulo Capa') { const r = await api.exportRun({ kind: 'coverFront', project: App.serialize() }); if (!r || !r.dataUrl) return false; e.coverAsset = await App.addAsset({ dataUrl: r.dataUrl, name: 'Capa do livro digital', width: 1600, height: 2400 }); }
      else if (pick === 'Exportar sem capa') return '';
      else return false;
    }
    return App.project.assets[e.coverAsset].dataUrl;
  }

  function cedetFileName(part) {
    const p = App.project;
    const r = window.Isbn ? window.Isbn.parse(p.meta.isbn) : null;
    const isbn = r && r.ok ? r.isbn13 : (String(p.meta.isbn || '').replace(/[^0-9Xx]/g, '') || 'ISBN');
    return `${isbn}_${part}_${p.meta.title || 'NOME DO LIVRO'}`;
  }
  App.cedetFileName = cedetFileName;

  function reportText() {
    const r = state.report;
    if (!r) return '';
    const s = r.settings;
    const L = [];
    L.push(`RELATÓRIO DE PRÉ-IMPRESSÃO — ${App.project.meta.title}`);
    L.push(`Gerado em ${r.at.toLocaleString('pt-BR')} · Perfil: ${state.opts.name}`);
    L.push('');
    L.push(`Páginas: ${r.pages}`);
    L.push(`Formato final de corte (miolo): ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm`);
    const b = bleedOf(s);
    L.push(`Sangria: ${b ? App.fmtNum(b) + ' mm (arquivo com ' + App.fmtNum(s.pageWidth + 2 * b) + ' × ' + App.fmtNum(s.pageHeight + 2 * b) + ' mm)' : 'sem sangria'}`);
    L.push(`Margens: superior ${s.marginTop} · inferior ${s.marginBottom} · interna ${s.marginInner} · externa ${s.marginOuter} mm`);
    L.push(`Fontes: ${(r.fonts || []).map(f => f.family + (f.loaded ? '' : ' (AUSENTE)')).join(', ')}`);
    L.push(`Imagens no miolo: ${(r.images || []).length}`);
    if (App.project.cover) { const g = window.CoverGeometry && window.CoverGeometry.geometry(App.project.cover); if (g) L.push(`Capa: lombada ${App.fmtNum(g.spine)} mm · capa aberta ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm com sangria`); }
    L.push('');
    const groups = [['error', 'ERROS'], ['warn', 'ATENÇÃO'], ['info', 'INFORMATIVOS']];
    groups.forEach(([lv, title]) => {
      const list = r.issues.filter(i => i.level === lv);
      L.push(`${title} (${list.length})`);
      list.forEach(i => L.push(`  - ${i.msg}`));
      L.push('');
    });
    if ((App.project.fontSubstitutions || []).length) { L.push('SUBSTITUIÇÕES DE FONTES REGISTRADAS'); App.project.fontSubstitutions.forEach(x => L.push(`  - ${x.from} → ${x.to} (${new Date(x.date).toLocaleDateString('pt-BR')})`)); }
    return L.join('\r\n');
  }

  function rangeSpec() {
    if (state.rangeMode === 'pages') return state.range;
    if (state.rangeMode === 'chapters' && App.lastRender) {
      const cp = App.lastRender.chapterPages || {};
      const order = App.project.chapters.map(c => c.id);
      const parts = [];
      order.forEach((id, i) => {
        if (!App.selection.has(id)) return;
        const start = cp[id];
        let end = App.lastRender.pages;
        for (let j = i + 1; j < order.length; j++) if (cp[order[j]]) { end = cp[order[j]] - 1; break; }
        if (start) parts.push(`${start}-${end}`);
      });
      return parts.join(',');
    }
    return '';
  }

  // ---------------------------------------------------------------- exportar
  async function run() {
    if (state.running) return;
    const o = state.opts;
    if (['pdf', 'png', 'jpeg', 'tiff', 'package'].includes(o.kind)) {
      const rep = await preflight();
      const errors = rep.issues.filter(i => i.level === 'error');
      if (errors.length) {
        const b = await api.confirm(`Foram encontrados ${errors.length} erro(s) de pré-impressão.`, errors.slice(0, 6).map(e => '• ' + e.msg).join('\n'), ['Exportar mesmo assim', 'Cancelar e corrigir']);
        if (b !== 0) return;
      }
    }
    state.running = true;
    App.progress.expect('Exportando o livro', ({ pdf: 'PDF', epub: 'EPUB', mobi: 'MOBI (Kindle)', package: 'Pacote de produção', docx: 'Word', odt: 'OpenDocument', txt: 'Texto', png: 'Imagens PNG', jpeg: 'Imagens JPEG', tiff: 'Imagens TIFF' })[o.kind] || o.kind);
    try {
      const proj = projectForExport();
      // créditos da ficha: revisão em rodízio e tradução sorteada, novos a cada exportação
      try { proj.catalog.autoNames = await api.creditsNext(); } catch (e) { /* mantém os atuais */ }
      const req = { kind: o.kind, project: proj, opts: { spreads: !!o.spreads, outline: !!o.outline, tagged: o.purpose === 'digital', dpi: o.dpi || 300, quality: o.quality || 92, bleed: !!o.imageBleed, color: o.purpose === 'digital' ? 'rgb' : (o.color || 'rgb'), colorProfile: o.colorProfile || 'fogra39', range: rangeSpec(), noProfile: !!o.noProfile && o.color === 'gray', imageDpi: 300, bleedBox: !!App.project.settings.pdfBleedBox, fileBase: o.cedet && (o.kind === 'pdf' || o.kind === 'package') ? cedetFileName('MIOLO') : '', cedet: !!o.cedet, includeCover: !!o.includeCover, includeEpub: !!o.includeEpub, includeProject: !!o.includeProject, suffix: o.purpose === 'digital' ? '-digital' : '' } };
      if (o.kind === 'epub' || o.kind === 'mobi' || (o.kind === 'package' && o.includeEpub)) {
        const coverDataUrl = await ebookCoverFor(o);
        if (coverDataUrl === false) { state.running = false; $('#toast').classList.remove('show'); return; }
        App.progress.log('Preparando o livro digital: capítulos, notas, imagens e sumário…');
        req.epub = await App.exportPrep.buildEpub(proj, { includeCover: false, coverDataUrl: coverDataUrl || null });
      }
      if (['docx', 'odt', 'txt'].includes(o.kind)) req.doc = App.exportPrep.buildDoc(proj);
      if (o.kind === 'package') { req.report = reportText() || (await preflight(), reportText()); req.specs = specsText(proj); }
      const r = await api.exportRun(req);
      $('#toast').classList.remove('show');
      if (!r) { App.progress.close(); return; }
      logExport(o, r);
      const cr = r.colorReport;
      const sep = cr && cr.onlyBlack !== undefined ? (cr.onlyBlack ? '\n✓ Separações conferidas: somente preto (desligando o preto, nada aparece).' : `\n⚠ Separações: ainda há ${cr.nonBlack.join(', ')}.`) : '';
      const colorTxt = !cr ? '' : cr.error ? `\n\n⚠ A conversão de cor falhou (${cr.error}); o PDF foi salvo em RGB.` : `${sep}\n\nCor: ${cr.mode === 'cmyk' ? 'CMYK — ' + cr.profile : cr.profile && cr.mode === 'gray' && /sGray/.test(cr.profile) ? 'escala de cinza (sGray, sem perfil incorporado)' : 'escala de cinza'} · ${cr.colors} cor(es) e ${cr.images} imagem(ns) convertidas${cr.kOnly ? ' · pretos e cinzas em 100% K' : ''}${(cr.warnings || []).length ? '\n' + cr.warnings.map(w => '⚠ ' + w).join('\n') : ''}`;
      App.progress.done('Exportação concluída', [`${r.files.length} arquivo(s)${r.pages ? ' · ' + r.pages + ' páginas' : ''}`, r.files[0]].concat(colorTxt ? colorTxt.trim().split('\n').filter(Boolean) : []), [
        { label: 'Mostrar na pasta', onClick: () => api.showItem(r.files[0]) },
        { label: 'Abrir', onClick: () => api.openPath(r.files[0]) },
        { label: 'Fechar', primary: true }
      ]);
    } catch (err) {
      console.error(err);
      App.progress.fail('Falha na exportação: ' + String(err && err.message || err));
    } finally {
      state.running = false;
      $('#toast').classList.remove('show');
    }
  }

  function specsText(p) {
    const s = p.settings;
    const b = bleedOf(s);
    const col = state.opts && state.opts.color;
    return [
      `ESPECIFICAÇÕES TÉCNICAS — ${p.meta.title}`, '',
      `Autor: ${p.meta.author}`, `ISBN: ${p.meta.isbn || '—'}`, `Edição: ${p.meta.edition || '—'}`,
      `Miolo — formato final: ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm`,
      `Miolo — páginas: ${App.lastRender ? App.lastRender.pages : '—'}`,
      `Miolo — sangria: ${b ? App.fmtNum(b) + ' mm' : 'sem sangria'} · marcas de corte: ${s.cropMarks ? 'sim' : 'não'}`,
      `Miolo — cor: ${col === 'cmyk' ? 'CMYK (' + (state.opts.colorProfile === 'gracol' ? 'GRACoL 2013' : 'ISO Coated v2 FOGRA39') + '), texto 100% K' : col === 'gray' ? 'escala de cinza, texto 100% K' : 'RGB'} · fontes incorporadas`,
      p.cover ? `Capa — ${JSON.stringify(window.CoverGeometry ? (g => ({ lombada_mm: g.spine, largura_total_mm: g.totalW, altura_total_mm: g.totalH, sangria_mm: g.bleed, orelhas_mm: g.flap }))(window.CoverGeometry.geometry(p.cover)) : {})}` : 'Capa — não incluída',
      `Papel informado para a lombada: ${p.cover ? p.cover.paper : '—'}`
    ].join('\r\n');
  }

  function logExport(o, r) {
    const p = App.project;
    const fonts = new Set();
    Object.values(p.settings.styles).forEach(s => s.font && fonts.add(s.font));
    p.exportLog = (p.exportLog || []).concat([{
      date: new Date().toISOString(), profile: o.name, kind: o.kind, files: r.files.slice(0, 3), pages: App.lastRender ? App.lastRender.pages : r.pages,
      chapterPages: App.lastRender ? App.lastRender.chapterPages : {}, fonts: [...fonts], images: Object.keys(p.assets).length,
      size: [p.settings.pageWidth, p.settings.pageHeight], bleed: bleedOf(p.settings), overlays: (p.overlays || []).length
    }]).slice(-20);
    App.changed(null, { preview: false });
  }

  function comparison() {
    const log = App.project.exportLog || [];
    const last = log[log.length - 1];
    if (!last) return el('p', { class: 'muted small', text: 'Ainda não houve exportação deste livro.' });
    const p = App.project;
    const fonts = new Set();
    Object.values(p.settings.styles).forEach(s => s.font && fonts.add(s.font));
    const diffs = [];
    const pages = App.lastRender ? App.lastRender.pages : null;
    if (pages && pages !== last.pages) diffs.push(`Páginas: ${last.pages} → ${pages} (${pages > last.pages ? '+' : ''}${pages - last.pages})`);
    if (last.size[0] !== p.settings.pageWidth || last.size[1] !== p.settings.pageHeight) diffs.push(`Formato: ${last.size.join(' × ')} → ${p.settings.pageWidth} × ${p.settings.pageHeight} mm`);
    const nb = bleedOf(p.settings);
    if (nb !== last.bleed) diffs.push(`Sangria: ${last.bleed} → ${nb} mm`);
    const added = [...fonts].filter(f => !last.fonts.includes(f));
    const removed = last.fonts.filter(f => !fonts.has(f));
    if (added.length) diffs.push('Fontes novas: ' + added.join(', '));
    if (removed.length) diffs.push('Fontes removidas: ' + removed.join(', '));
    const imgs = Object.keys(p.assets).length;
    if (imgs !== last.images) diffs.push(`Imagens: ${last.images} → ${imgs}`);
    if ((p.overlays || []).length !== last.overlays) diffs.push(`Elementos fixos nas páginas: ${last.overlays} → ${(p.overlays || []).length}`);
    if (App.lastRender) {
      p.chapters.forEach(c => {
        const a = last.chapterPages[c.id], b = App.lastRender.chapterPages[c.id];
        if (a && b && a !== b) diffs.push(`“${c.title}” começa na página ${b} (antes ${a})`);
        if (!a && b) diffs.push(`Capítulo novo: “${c.title}” (pág. ${b})`);
      });
    }
    return el('div', {}, [
      el('p', { class: 'small', text: `Última exportação: ${new Date(last.date).toLocaleString('pt-BR')} — ${last.profile} (${last.kind.toUpperCase()}), ${last.pages} páginas.` }),
      diffs.length ? el('ul', { class: 'small' }, diffs.slice(0, 40).map(d => el('li', { text: d }))) : el('p', { class: 'good small', text: 'Nenhuma mudança de paginação, fontes, imagens ou dimensões desde a última exportação.' })
    ]);
  }

  async function autoFix(kind) {
    if (kind === 'bleed') {
      const s = App.project.settings;
      const ok = await App.confirmPreview('Correção automática', 'Ativar a sangria automática do miolo?', [`Sangria: ${App.fmtNum(App.D.autoBleed(s), 3)} mm (pelo formato do livro)`]);
      if (!ok) return;
      s.bleedAuto = true;
      state.opts.bleed = null;
      state.opts.bleedOnlyIfNeeded = false;
      App.changed('Sangria automática ativada');
      preflight();
    } else if (kind === 'cedet') {
      const ok = await App.confirmPreview('Modelo CEDET', 'Reaplicar o modelo CEDET (margens, sangria, marcas e numeração)?', ['Margens: superior e inferior 28 mm, interna 23 mm, externa 20 mm', 'Número da página logo abaixo do texto, no canto externo', 'Sangria 5 mm · marcas de corte 0,25 pt a 5 mm']);
      if (!ok) return;
      App.D.applyCedet(App.project.settings);
      App.changed('Modelo CEDET aplicado');
      preflight();
    } else if (kind === 'fonts') App.fontsUi.checkMissing(true);
    else if (kind === 'assets') App.setView('assets');
  }

  function goTo(page) {
    if (!page) return;
    App.preview.goToPage(page);
    const cp = App.lastRender && App.lastRender.chapterPages;
    if (!cp) return;
    let best = null;
    App.project.chapters.forEach(c => { if (cp[c.id] && cp[c.id] <= page && (!best || cp[c.id] > cp[best.id])) best = c; });
    if (best) App.toast(`Página ${page} — capítulo “${best.title}”. Dê duplo clique na página para abri-lo no editor.`, 4000);
  }

  // ---------------------------------------------------------------- tela
  function render() {
    const v = $('#view-export');
    v.innerHTML = '';
    if (!state.profiles) { loadProfiles().then(render); return; }
    const o = state.opts;
    const pf = el('select', { onchange: e => { selectProfile(e.target.value); render(); } }, state.profiles.map(p => el('option', { value: p.id, text: p.name + (BUILTIN.some(b => b.id === p.id) ? '' : ' (meu perfil)') })));
    pf.value = state.current;
    const set = (k, v2) => { o[k] = v2; };
    const num = (k, label, step) => App.field(label, el('input', { type: 'number', step: step || 1, value: o[k] == null ? '' : o[k], oninput: e => set(k, e.target.value === '' ? null : Number(e.target.value)) }));
    const chk = (k, label) => el('label', { class: 'chk' }, [el('input', { type: 'checkbox', checked: !!o[k], onchange: e => set(k, e.target.checked) }), ' ' + label]);
    const kind = el('select', { onchange: e => { o.kind = e.target.value; render(); } }, KINDS.map(([k, l]) => el('option', { value: k, text: l })));
    kind.value = o.kind;
    const rm = el('select', { onchange: e => { state.rangeMode = e.target.value; render(); } }, [['all', 'Livro completo'], ['pages', 'Intervalo de páginas'], ['chapters', 'Capítulos selecionados na lista']].map(([a, b]) => el('option', { value: a, text: b })));
    rm.value = state.rangeMode;
    const isPdf = o.kind === 'pdf' || o.kind === 'package';
    const isImg = ['png', 'jpeg', 'tiff'].includes(o.kind);
    const r = state.report;
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Exportar' }),
      el('div', { class: 'card preset' }, [
        el('h3', { text: 'Perfil de exportação' }),
        el('div', { class: 'inline wrap' }, [pf,
          el('button', { text: 'Salvar como meu perfil…', onclick: async () => { const name = await App.prompt('Salvar perfil', 'Nome do perfil', o.name + ' (meu)'); if (!name) return; const saved = (await api.profilesGet()) || []; const p = Object.assign({}, o, { id: 'u' + Date.now(), name }); saved.push(p); await api.profilesSet(saved); state.profiles = null; await loadProfiles(); state.current = p.id; render(); App.toast('Perfil salvo.'); } }),
          BUILTIN.some(b => b.id === state.current) && JSON.stringify(o) !== JSON.stringify(BUILTIN.find(b => b.id === state.current)) ? el('button', { text: '↺ Restaurar as opções originais do perfil', onclick: () => { selectProfile(state.current); render(); App.toast('Perfil restaurado às opções originais do sistema.'); } }) : null,
          !BUILTIN.some(b => b.id === state.current) ? el('button', { class: 'danger', text: 'Excluir perfil', onclick: async () => { const saved = ((await api.profilesGet()) || []).filter(p => p.id !== state.current); await api.profilesSet(saved); state.profiles = null; state.current = null; await loadProfiles(); render(); } }) : null
        ]),
        o.notes ? el('p', { class: 'muted small', text: o.notes }) : null,
        el('p', { class: 'muted small', text: 'Os perfis são pontos de partida editáveis e não substituem as especificações oficiais e atualizadas da gráfica ou plataforma.' })
      ]),
      App.card('Formato e opções', [
        App.field('Formato de saída', kind),
        isPdf ? App.field('Finalidade', (() => { const s = el('select', { onchange: e => { o.purpose = e.target.value; render(); } }, [['print', 'Impressão'], ['digital', 'Leitura digital']].map(([a, b]) => el('option', { value: a, text: b }))); s.value = o.purpose || 'print'; return s; })()) : null,
        isPdf && o.purpose !== 'digital' ? App.field('Sangria (mm)', el('input', { type: 'number', step: 0.1, placeholder: `do livro (${App.fmtNum(bleedOf(App.project.settings), 3)} mm)`, value: o.bleed == null ? '' : o.bleed, oninput: e => set('bleed', e.target.value === '' ? null : Number(e.target.value)) }), 'Vazio = sangria do livro (automática pelo formato ou manual)') : null,
        isPdf && o.purpose !== 'digital' ? App.field('Cor do miolo', (() => { const sel = el('select', { onchange: e => { o.color = e.target.value; render(); } }, [['rgb', 'RGB (KDP, impressão sob demanda)'], ['cmyk', 'CMYK com perfil ICC (gráfica offset)'], ['gray', 'Escala de cinza — miolo preto e branco (100% K)']].map(([a, b]) => el('option', { value: a, text: b }))); sel.value = o.color || 'rgb'; return sel; })()) : null,
        isPdf && o.purpose !== 'digital' && o.color === 'cmyk' ? App.field('Perfil CMYK', (() => { const sel = el('select', { onchange: e => { o.colorProfile = e.target.value; } }, [['fogra39', 'ISO Coated v2 (FOGRA39) — offset Brasil/Europa'], ['gracol', 'GRACoL 2013 (CRPC6) — padrão EUA']].map(([a, b]) => el('option', { value: a, text: b }))); sel.value = o.colorProfile || 'fogra39'; return sel; })()) : null,
        isPdf && o.purpose !== 'digital' ? chk('bleedOnlyIfNeeded', 'Sangria só se houver imagens/fundos até a borda') : null,
        isPdf && o.purpose !== 'digital' && !o.cedet ? chk('cropMarks', 'Linhas (marcas) de corte — a sangria sai no arquivo com ou sem as linhas') : null,
        isPdf && o.cedet ? el('div', { class: 'small muted', text: 'CEDET: sangria de 5 mm e marcas de corte de 0,25 pt sempre incluídas, como exige o manual.' }) : null,
        isPdf ? chk('spreads', 'Páginas duplas (lado a lado) — não é imposição de cadernos') : null,
        isPdf ? chk('outline', 'Marcadores / sumário navegável') : null,
        isPdf || o.kind === 'package' ? bleedBoxToggle() : null,
        isPdf || o.kind === 'package' ? el('div', { class: 'small muted', text: 'Imagens: todas saem com 300 dpi no tamanho em que aparecem na página (as maiores são reduzidas; as menores, ampliadas com interpolação de alta qualidade).' }) : null,
        isImg ? num('dpi', 'Resolução (dpi)', 1) : null,
        o.kind === 'jpeg' ? num('quality', 'Qualidade JPEG (30–100)', 1) : null,
        isImg ? chk('imageBleed', 'Incluir área de sangria (recomendado para impressão)') : null,
        o.kind === 'package' ? chk('includeCover', 'Incluir capa') : null,
        o.kind === 'epub' || o.kind === 'mobi' || (o.kind === 'package' && o.includeEpub) ? ebookCoverCard() : null,
        o.kind === 'package' ? chk('includeEpub', 'Incluir EPUB') : null,
        o.kind === 'package' ? chk('includeProject', 'Incluir o arquivo .livro') : null,
        num('minDpi', 'Resolução mínima recomendada (dpi)'),
        num('errDpi', 'Resolução que gera erro (dpi)'),
        isPdf || isImg ? App.field('Intervalo', rm) : null,
        (isPdf || isImg) && state.rangeMode === 'pages' ? App.field('Páginas', el('input', { type: 'text', placeholder: 'ex.: 1-12, 15', value: state.range, oninput: e => { state.range = e.target.value; } })) : null,
        (isPdf || isImg) && state.rangeMode === 'chapters' ? el('div', { class: 'muted small', text: `${App.selection.size} capítulo(s) selecionado(s) na lista (use ☑).` }) : null
      ]),
      el('div', { class: 'actions-row' }, [
        el('button', { text: '✓ Verificar (pré-impressão)', onclick: preflight }),
        el('button', { class: 'primary big', text: '⇩ Exportar', onclick: run }),
        r ? el('button', { text: 'Salvar relatório…', onclick: () => api.saveText(`${App.project.meta.title}-relatorio.txt`, reportText()) }) : null
      ]),
      r ? el('div', { class: 'card' }, [
        el('h3', { text: `Revisão antes de exportar — ${r.pages} páginas` }),
        el('p', { class: 'small', text: `Miolo ${App.fmtNum(r.settings.pageWidth)} × ${App.fmtNum(r.settings.pageHeight)} mm · ${(r.fonts || []).length} fonte(s): ${(r.fonts || []).map(f => f.family).join(', ')} · ${(r.images || []).length} imagem(ns) no texto` }),
        el('div', { class: 'issue-summary' }, [['error', 'erro(s)', 'bad'], ['warn', 'aviso(s)', 'warn'], ['info', 'informativo(s)', 'muted']].map(([lv, l, cls]) => el('span', { class: 'chip ' + cls, text: `${r.issues.filter(i => i.level === lv).length} ${l}` }))),
        el('ul', { class: 'issues' }, r.issues.map(i => el('li', { class: 'issue ' + i.level }, [
          el('span', { class: 'lvl', text: i.level === 'error' ? 'Erro' : i.level === 'warn' ? 'Atenção' : 'Info' }),
          el('span', { class: 'msg', text: i.msg }),
          i.page ? el('button', { class: 'small-btn', text: 'Ir para a página', onclick: () => goTo(i.page) }) : null,
          i.fix ? el('button', { class: 'small-btn', text: i.fix === 'bleed' ? 'Corrigir' : 'Resolver', onclick: () => autoFix(i.fix) }) : null
        ])))
      ]) : null,
      App.card('Comparação com a última exportação', [comparison()], '', 'span-all')
    ]));
  }

  App.hooks.viewRender.export = render;
})();
