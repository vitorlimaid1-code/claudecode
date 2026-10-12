/* global App */
// Módulo de exportação: perfis (gráfica, KDP, EPUB, prova…), verificação de pré-impressão,
// exportação por formato/intervalo, relatório técnico, pacote de produção e comparação com a última exportação.
(function () {
  const { el, $, api } = App;

  const BUILTIN = [
    { id: 'grafica', name: 'Impressão em gráfica (offset)', kind: 'pdf', purpose: 'print', bleed: 3, cropMarks: true, spreads: false, outline: false, minDpi: 300, errDpi: 200, notes: 'Sangria de 3 mm e marcas de corte. Confirme com a gráfica as medidas, o papel e o perfil de cor exigidos.' },
    { id: 'kdp', name: 'Amazon KDP (brochura)', kind: 'pdf', purpose: 'print', bleed: 3.2, bleedOnlyIfNeeded: true, cropMarks: false, spreads: false, minDpi: 300, errDpi: 150, minPages: 24, maxPages: 828, acceptedSizes: '127x203.2, 128.5x198.4, 133.4x203.2, 139.7x215.9, 152.4x228.6, 156x233.9, 169.9x244.1, 177.8x254, 189x246.1, 190.5x235, 203.2x254, 209.6x152.4, 209.6x209.6, 210x297, 215.9x215.9, 215.9x279.4, 108x174.5', notes: 'Use sangria (3,2 mm) apenas se houver imagens até a borda. Tamanhos aceitos conforme a lista do KDP — verifique a lista atual no site da Amazon.' },
    { id: 'pod', name: 'Impressão sob demanda (Clube de Autores, UICLAP…)', kind: 'pdf', purpose: 'print', bleed: 0, cropMarks: false, spreads: false, minDpi: 300, errDpi: 150, notes: 'PDF no tamanho final, sem marcas de corte. Confira as exigências atuais da plataforma.' },
    { id: 'digital', name: 'PDF para leitura digital', kind: 'pdf', purpose: 'digital', bleed: 0, cropMarks: false, spreads: false, outline: true, minDpi: 150, errDpi: 96, notes: 'Sem sangria, com marcadores (sumário navegável no leitor de PDF).' },
    { id: 'prova', name: 'Prova editorial (páginas duplas)', kind: 'pdf', purpose: 'digital', bleed: 0, cropMarks: false, spreads: true, outline: true, minDpi: 150, errDpi: 96, notes: 'Páginas lado a lado, como o livro aberto, para revisão. Não é imposição de cadernos.' },
    { id: 'epub', name: 'EPUB para leitura digital', kind: 'epub', includeCover: true, minDpi: 72, errDpi: 0, notes: 'EPUB 3 com sumário navegável, metadados, imagens e notas.' },
    { id: 'imagens', name: 'Imagens das páginas (PNG 300 dpi)', kind: 'png', dpi: 300, minDpi: 300, errDpi: 150 },
    { id: 'word', name: 'Documento editável (DOCX)', kind: 'docx' }
  ];
  const KINDS = [['pdf', 'PDF'], ['epub', 'EPUB 3'], ['png', 'PNG'], ['jpeg', 'JPEG'], ['tiff', 'TIFF'], ['docx', 'DOCX (Word)'], ['odt', 'ODT (LibreOffice)'], ['txt', 'TXT'], ['package', 'Pacote de produção (ZIP)']];

  const state = { profiles: null, current: null, opts: null, report: null, rangeMode: 'all', range: '', running: false };

  async function loadProfiles() {
    const saved = await api.profilesGet();
    state.profiles = BUILTIN.concat(Array.isArray(saved) ? saved : []);
    if (!state.current) selectProfile(state.profiles[0].id);
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
      if (o.purpose === 'digital') { proj.settings.bleedTop = proj.settings.bleedBottom = proj.settings.bleedOuter = 0; proj.settings.cropMarks = false; }
      else if (o.bleed != null && o.bleed !== '') {
        const needs = needsBleed(proj);
        const b = o.bleedOnlyIfNeeded && !needs ? 0 : Number(o.bleed);
        proj.settings.bleedTop = proj.settings.bleedBottom = proj.settings.bleedOuter = b;
        proj.settings.cropMarks = !!o.cropMarks;
      }
    }
    return proj;
  }
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
    if (r.pages % 2) issues.push({ level: 'info', type: 'pages', msg: `Número ímpar de páginas (${r.pages}); a gráfica acrescentará uma página em branco no fim.` });
    if (o.purpose === 'print' && needsBleed(proj) && !Math.max(s.bleedTop, s.bleedBottom, s.bleedOuter)) issues.push({ level: 'error', type: 'bleed', msg: 'Há imagens ou fundos até a borda da página, mas a exportação está sem sangria: pode aparecer filete branco após o corte.', fix: 'bleed' });
    (r.fontReport || []).forEach(f => { if (!f.embeddable) issues.push({ level: 'error', type: 'font', msg: `A licença da fonte “${f.family}” não permite incorporação no PDF. Escolha outra fonte (Estilos de texto ou Fontes).` }); });
    (r.missingFonts || []).forEach(f => issues.push({ level: 'error', type: 'font', msg: `Fonte “${f}” ausente neste computador: o texto seria mostrado em outra fonte.`, fix: 'fonts' }));
    (r.missingAssets || []).forEach(id => issues.push({ level: 'error', type: 'missing', msg: `Referência de imagem quebrada (${id}).`, fix: 'assets' }));
    Object.values(proj.assets).forEach(a => {
      if (a.info && a.info.colorSpace === 'CMYK') issues.push({ level: 'warn', type: 'color', msg: `“${a.name}” está em CMYK: o PDF gerado é RGB e as cores podem mudar na conversão. Converta a imagem para RGB com perfil conhecido ou confira a prova de cor.` });
    });
    const hasAlpha = Object.values(proj.assets).some(a => a.info && a.info.hasAlpha);
    if (o.purpose === 'print') {
      issues.push({ level: 'info', type: 'color', msg: 'O PDF é gerado em RGB com fontes incorporadas. PDF/X-1a, PDF/X-4 e conversão para CMYK não estão disponíveis neste aplicativo: se a gráfica exigir, peça a conversão a ela ou use um programa de pré-impressão (ex.: Acrobat Pro).' });
      if (hasAlpha) issues.push({ level: 'info', type: 'alpha', msg: 'Há imagens com transparência. O PDF mantém a transparência (compatível com PDF/X-4, não com PDF/X-1a).' });
    }
    const order = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    state.report = { pages: r.pages, issues, images: r.images, fonts: r.fonts, fontReport: r.fontReport, chapterPages: r.chapterPages, at: new Date(), settings: s };
    render();
    return state.report;
  }

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
    const b = Math.max(s.bleedTop, s.bleedBottom, s.bleedOuter);
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
    App.toast('Exportando… isso pode levar alguns segundos.', 120000);
    try {
      const proj = projectForExport();
      const req = { kind: o.kind, project: proj, opts: { spreads: !!o.spreads, outline: !!o.outline, tagged: o.purpose === 'digital', dpi: o.dpi || 300, quality: o.quality || 92, bleed: !!o.imageBleed, range: rangeSpec(), includeCover: !!o.includeCover, includeEpub: !!o.includeEpub, includeProject: !!o.includeProject, suffix: o.purpose === 'digital' ? '-digital' : '' } };
      if (o.kind === 'epub' || (o.kind === 'package' && o.includeEpub)) req.epub = await App.exportPrep.buildEpub(proj, { includeCover: o.includeCover !== false });
      if (['docx', 'odt', 'txt'].includes(o.kind)) req.doc = App.exportPrep.buildDoc(proj);
      if (o.kind === 'package') { req.report = reportText() || (await preflight(), reportText()); req.specs = specsText(proj); }
      const r = await api.exportRun(req);
      $('#toast').classList.remove('show');
      if (!r) return;
      logExport(o, r);
      const b = await api.confirm('Exportação concluída!', `${r.files.length} arquivo(s)${r.pages ? ' · ' + r.pages + ' páginas' : ''}\n${r.files[0]}`, ['Abrir', 'Mostrar na pasta', 'Fechar']);
      if (b === 0) api.openPath(r.files[0]); else if (b === 1) api.showItem(r.files[0]);
    } finally {
      state.running = false;
      $('#toast').classList.remove('show');
    }
  }

  function specsText(p) {
    const s = p.settings;
    const b = Math.max(s.bleedTop, s.bleedBottom, s.bleedOuter);
    return [
      `ESPECIFICAÇÕES TÉCNICAS — ${p.meta.title}`, '',
      `Autor: ${p.meta.author}`, `ISBN: ${p.meta.isbn || '—'}`, `Edição: ${p.meta.edition || '—'}`,
      `Miolo — formato final: ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm`,
      `Miolo — páginas: ${App.lastRender ? App.lastRender.pages : '—'}`,
      `Miolo — sangria: ${b ? App.fmtNum(b) + ' mm' : 'sem sangria'} · marcas de corte: ${s.cropMarks ? 'sim' : 'não'}`,
      `Miolo — cor: RGB (conversão de cor a cargo da gráfica)`,
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
      size: [p.settings.pageWidth, p.settings.pageHeight], bleed: Math.max(p.settings.bleedTop, p.settings.bleedBottom, p.settings.bleedOuter), overlays: (p.overlays || []).length
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
    const nb = Math.max(p.settings.bleedTop, p.settings.bleedBottom, p.settings.bleedOuter);
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
      const ok = await App.confirmPreview('Correção automática', 'Definir a sangria do miolo para 3 mm (superior, inferior e externa)?', ['Sangria: 3 mm']);
      if (!ok) return;
      const s = App.project.settings; s.bleedTop = s.bleedBottom = s.bleedOuter = 3;
      if (state.opts.bleed === 0 || state.opts.bleed == null) state.opts.bleed = 3;
      App.changed('Sangria ajustada para 3 mm');
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
          !BUILTIN.some(b => b.id === state.current) ? el('button', { class: 'danger', text: 'Excluir perfil', onclick: async () => { const saved = ((await api.profilesGet()) || []).filter(p => p.id !== state.current); await api.profilesSet(saved); state.profiles = null; state.current = null; await loadProfiles(); render(); } }) : null
        ]),
        o.notes ? el('p', { class: 'muted small', text: o.notes }) : null,
        el('p', { class: 'muted small', text: 'Os perfis são pontos de partida editáveis e não substituem as especificações oficiais e atualizadas da gráfica ou plataforma.' })
      ]),
      App.card('Formato e opções', [
        App.field('Formato de saída', kind),
        isPdf ? App.field('Finalidade', (() => { const s = el('select', { onchange: e => { o.purpose = e.target.value; render(); } }, [['print', 'Impressão'], ['digital', 'Leitura digital']].map(([a, b]) => el('option', { value: a, text: b }))); s.value = o.purpose || 'print'; return s; })()) : null,
        isPdf && o.purpose !== 'digital' ? num('bleed', 'Sangria (mm)', 0.1) : null,
        isPdf && o.purpose !== 'digital' ? chk('bleedOnlyIfNeeded', 'Sangria só se houver imagens/fundos até a borda') : null,
        isPdf && o.purpose !== 'digital' ? chk('cropMarks', 'Marcas de corte') : null,
        isPdf ? chk('spreads', 'Páginas duplas (lado a lado) — não é imposição de cadernos') : null,
        isPdf ? chk('outline', 'Marcadores / sumário navegável') : null,
        isImg ? num('dpi', 'Resolução (dpi)', 1) : null,
        o.kind === 'jpeg' ? num('quality', 'Qualidade JPEG (30–100)', 1) : null,
        isImg ? chk('imageBleed', 'Incluir área de sangria') : null,
        o.kind === 'epub' || o.kind === 'package' ? chk('includeCover', 'Incluir capa') : null,
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
