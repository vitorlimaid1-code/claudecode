/* global App, CoverGeometry */
// Capa e lombada para capas já prontas: as dimensões vêm do livro em diagramação, de um
// manuscrito carregado (PDF, DOC, DOCX, ODT, HTML, EPUB, MOBI) ou são digitadas. A saída é
// sempre um PDF CMYK para gráfica (perfil ICC real, PDF/X-1a), com sangria automática ou manual.
(function () {
  const { el, $, api } = App;
  let frame = null;
  let proof = null;

  function defaults() {
    const s = App.project.settings;
    return {
      source: 'book', trimW: s.pageWidth, trimH: s.pageHeight, pages: App.lastRender ? App.lastRender.pages : 120,
      paper: 'polen80', paperMm: 0.06, spineMode: 'auto', spine: '', bleedAuto: true, bleed: 3, flaps: 0, hardcover: false, wrapExtra: 15, boardExtra: 4, safety: 5,
      totalsManual: false, totalW: '', totalH: '', confirmed: null, fileInfo: null,
      barcode: false, bg: { front: '#ffffff', back: '#ffffff', spine: '#ffffff' }, images: {},
      profile: 'fogra39', intent: 'relative', bpc: true, dpi: 300
    };
  }
  function cover() {
    const d = defaults();
    if (!App.project.cover) App.project.cover = d;
    const c = App.project.cover;
    Object.keys(d).forEach(k => { if (c[k] === undefined) c[k] = d[k]; });
    c.bg = c.bg || {}; c.images = c.images || {};
    return c;
  }

  function bookDims() {
    const s = App.project.settings;
    let pages = App.lastRender ? App.lastRender.pages : null;
    if (pages && pages % 2) pages += 1;
    return { trimW: s.pageWidth, trimH: s.pageHeight, pages };
  }
  // Sem confirmação, a capa acompanha o livro em diagramação automaticamente
  function syncFromBook() {
    const c = App.project.cover;
    if (!c || c.confirmed || c.source !== 'book') return;
    const d = bookDims();
    c.trimW = d.trimW; c.trimH = d.trimH;
    if (d.pages) c.pages = d.pages;
  }
  App.hooks.afterChange.push(o => { if (o && o.rendered) { syncFromBook(); if (App.view === 'cover') { updateSummary(); redraw(); } } });

  function confirmDims() {
    const c = cover();
    const g = CoverGeometry.geometry(c);
    c.confirmed = { trimW: c.trimW, trimH: c.trimH, pages: c.pages, totalW: g.totalW, totalH: g.totalH, spine: g.spine, at: new Date().toISOString() };
    App.changed('Dimensões da capa confirmadas', { preview: false });
    render();
    App.toast(`Dimensões confirmadas: ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm, lombada ${App.fmtNum(g.spine)} mm.`);
  }

  async function loadManuscript() {
    const s = App.project.settings;
    const r = await api.coverAnalyze({ pageWidth: s.pageWidth, pageHeight: s.pageHeight, marginInner: s.marginInner, marginOuter: s.marginOuter, marginTop: s.marginTop, marginBottom: s.marginBottom, fontSize: s.styles.body.size, lineHeight: s.styles.body.lineHeight });
    if (!r) return;
    const c = cover();
    c.source = 'file';
    c.confirmed = null;
    c.totalsManual = false;
    c.spineMode = 'auto';
    c.trimW = r.trimW; c.trimH = r.trimH; c.pages = r.pages;
    c.fileInfo = { name: r.name, method: r.method, exact: r.exact, notes: [r.pagesNote, r.sizeNote].filter(Boolean) };
    App.changed('Dimensões da capa a partir de ' + r.name, { preview: false });
    render();
  }

  function useBook() {
    const c = cover();
    c.source = 'book'; c.confirmed = null; c.totalsManual = false; c.spineMode = 'auto'; c.fileInfo = null;
    syncFromBook();
    App.changed('Capa acompanha o livro em diagramação', { preview: false });
    render();
  }

  function updateSummary() {
    const box = $('#coverSummary');
    if (!box) return;
    const c = cover();
    const g = CoverGeometry.geometry(c);
    const d = bookDims();
    const changed = c.confirmed && c.source === 'book' && (Math.abs(c.confirmed.trimW - d.trimW) > 0.01 || Math.abs(c.confirmed.trimH - d.trimH) > 0.01 || (d.pages && c.confirmed.pages !== d.pages));
    box.innerHTML = '';
    box.append(
      el('div', { class: 'cover-total' }, [
        el('div', {}, [el('span', { class: 'muted small', text: 'Tamanho total da capa (com sangria)' }), el('strong', { text: `${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Sem sangria (formato final aberto)' }), el('strong', { text: `${App.fmtNum(g.trimTotalW)} × ${App.fmtNum(g.H)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Lombada' }), el('strong', { text: `${App.fmtNum(g.spine)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Capa / contracapa' }), el('strong', { text: `${App.fmtNum(g.W)} × ${App.fmtNum(g.H)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Sangria' }), el('strong', { text: `${App.fmtNum(g.bleed)} mm${g.wrap ? ` + ${App.fmtNum(g.wrap)} mm de dobra` : ''}` })])
      ]),
      el('div', { class: 'small muted', text: `${c.spineMode === 'manual' ? 'Lombada digitada' : `Lombada calculada: ${g.pages} páginas × ${App.fmtNum(g.perPage, 4)} mm${c.hardcover ? ' + cartão' : ''}`}${g.spine < 6 ? ' · lombada fina: evite texto ou elementos importantes nela' : ''}` }),
      changed ? el('div', { class: 'warn small', text: `⚠ O livro mudou desde a confirmação: agora ${App.fmtNum(d.trimW / 10)} × ${App.fmtNum(d.trimH / 10)} cm, ${d.pages} páginas.` }) : null
    );
  }

  async function drawPreview() {
    if (proof) return showProof();
    if (!frame || !frame.contentWindow || !frame.contentWindow.renderCover) return;
    const c = cover();
    const assets = {};
    Object.values(c.images).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = { dataUrl: App.assetUrl(it.asset) }; });
    const r = await frame.contentWindow.renderCover({ cover: c, assets }, { bleed: $('#cvBleed') ? $('#cvBleed').checked : true, guides: $('#cvGuides') ? $('#cvGuides').checked : true });
    const box = $('#coverStage');
    if (box) frame.contentWindow.setCoverZoom(Math.min(1.5, (box.clientWidth - 40) / r.wpx, (box.clientHeight - 40) / r.hpx));
  }
  const redraw = () => { clearTimeout(redraw._t); redraw._t = setTimeout(() => { updateSummary(); drawPreview(); }, 200); };

  async function runProof() {
    const c = cover();
    App.toast('Convertendo para CMYK…', 20000);
    App.flush();
    const assets = {};
    Object.values(c.images).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = App.project.assets[it.asset]; });
    proof = await api.coverProof(JSON.parse(JSON.stringify(c)), assets);
    $('#toast').classList.remove('show');
    if (proof && proof.error) { App.toast('Erro: ' + proof.error, 6000); proof = null; return; }
    showProof();
  }
  function showProof() {
    const stage = $('#coverStage');
    if (!stage || !proof) return;
    stage.innerHTML = '';
    stage.append(
      el('div', { class: 'proof-bar' }, [
        el('strong', { text: 'Prova de cor: simulação da impressão em CMYK' }),
        el('span', { class: 'small', text: ` · ${proof.profile} · tinta máxima ${proof.maxTac}%${proof.maxTac > 320 ? ' (acima de 320%: risco de decalque/secagem)' : ''}` }),
        el('button', { class: 'small-btn', text: 'Voltar à prévia', onclick: () => { proof = null; render(); } })
      ]),
      el('img', { src: proof.dataUrl, class: 'proof-img' }),
      proof.notes && proof.notes.length ? el('ul', { class: 'small' }, proof.notes.map(n => el('li', { text: n }))) : null
    );
  }

  async function exportPdf() {
    App.flush();
    const c = cover();
    if (!Object.values(c.images).some(it => it && App.project.assets[it.asset])) {
      const b = await api.confirm('A capa não tem imagens.', 'Insira a capa pronta (imagem envolvente ou capa, lombada e contracapa) antes de exportar.', ['Exportar mesmo assim', 'Cancelar']);
      if (b !== 0) return;
    }
    App.toast('Gerando o PDF CMYK para gráfica…', 60000);
    const r = await api.exportRun({ kind: 'cover', project: App.serialize(), opts: { bleed: $('#cvExpBleed').checked } });
    $('#toast').classList.remove('show');
    if (!r || !r.files) return;
    const rep = r.report || {};
    const b = await api.confirm('Capa exportada (PDF CMYK)!', `${r.files[0]}\n\n${App.fmtNum(rep.sizeMm[0])} × ${App.fmtNum(rep.sizeMm[1])} mm · ${rep.dpi} dpi · ${rep.profile}\nIntenção: ${rep.intent}${rep.bpc ? ' + compensação de ponto preto' : ''} · tinta máxima ${rep.maxTac}%\n${(rep.notes || []).join('\n')}`, ['Abrir', 'Mostrar na pasta', 'Fechar']);
    if (b === 0) api.openPath(r.files[0]); else if (b === 1) api.showItem(r.files[0]);
  }

  function render() {
    const v = $('#view-cover');
    v.innerHTML = '';
    const c = cover();
    syncFromBook();
    const f = App.field;
    const on = (obj, key, type, o) => App.bind(obj, key, type, Object.assign({ label: 'Capa', onChange: () => { proof = null; redraw(); } }, o || {}));
    const manualOn = () => { if (c.source === 'book' && !c.confirmed) { c.source = 'manual'; } };
    const imgSlot = (key, label, hint) => {
      const it = c.images[key];
      const a = it && App.project.assets[it.asset];
      return el('div', { class: 'field' }, [el('span', { class: 'flabel', text: label }), el('div', { class: 'inline wrap' }, [
        a ? el('img', { class: 'mini-thumb', src: App.assetUrl(it.asset) }) : null,
        el('button', { class: 'small-btn', text: a ? 'Trocar' : 'Inserir…', onclick: async () => { const l = await api.pickImages({ title: label }); if (!l) return; c.images[key] = { asset: await App.addAsset(l[0]), fit: 'cover' }; App.changed('Capa: ' + label, { preview: false }); proof = null; render(); } }),
        a ? (() => { const s = el('select', { onchange: e => { it.fit = e.target.value; App.changed('Ajuste da imagem da capa', { preview: false }); proof = null; redraw(); } }, [['cover', 'Preencher'], ['contain', 'Inteira']].map(([x, y]) => el('option', { value: x, text: y }))); s.value = it.fit || 'cover'; return s; })() : null,
        a ? el('button', { class: 'small-btn', text: '✕', onclick: () => { delete c.images[key]; App.changed('Imagem da capa removida', { preview: false }); proof = null; render(); } }) : null
      ]), hint ? el('span', { class: 'hint', text: hint }) : null, a && a.info && a.info.colorSpace === 'CMYK' ? el('span', { class: 'good small', text: 'CMYK: valores preservados na saída' }) : null]);
    };
    const paperOpts = Object.entries(CoverGeometry.PAPERS).map(([k, p]) => ({ value: k, label: p.label + (p.mm ? ` (${String(p.mm).replace('.', ',')} mm/pág.)` : '') }));
    const g = CoverGeometry.geometry(c);
    const totalInput = (key, label, value, onSet) => {
      const i = el('input', { type: 'number', step: 0.1, value: Number(value).toFixed(2) });
      i.addEventListener('change', () => { const v = parseFloat(i.value); if (!isFinite(v) || v <= 0) return; onSet(v); c.source = c.source === 'book' ? 'manual' : c.source; App.changed('Medidas da capa', { preview: false }); proof = null; render(); });
      return f(label, i);
    };
    const srcText = c.source === 'file' && c.fileInfo ? `Manuscrito carregado: ${c.fileInfo.name} (${c.fileInfo.method})` : c.source === 'manual' ? 'Medidas digitadas manualmente' : 'Acompanhando o livro em diagramação';
    v.appendChild(el('div', { class: 'cover-layout' }, [
      el('div', { class: 'cover-form' }, [
        el('h2', { text: 'Capa e lombada' }),
        el('p', { class: 'muted small', text: 'Monte capas já editadas: insira a capa pronta (imagem envolvente) ou capa, lombada e contracapa separadas. A saída é um PDF CMYK para gráfica.' }),
        el('div', { class: 'cover-banner ' + (c.confirmed ? 'ok' : 'info') }, [
          el('div', { class: 'small', text: (c.confirmed ? `✓ Confirmado em ${new Date(c.confirmed.at).toLocaleString('pt-BR')} · ` : '') + srcText }),
          c.fileInfo && c.fileInfo.notes && c.fileInfo.notes.length ? el('div', { class: 'small warn', text: c.fileInfo.notes.join(' ') }) : null,
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'primary', text: 'Confirmar as dimensões', onclick: confirmDims }),
            el('button', { text: 'Usar o livro em diagramação', onclick: useBook }),
            el('button', { text: 'Carregar manuscrito…', title: 'Opcional: PDF, DOC, DOCX, ODT, HTML, EPUB ou MOBI', onclick: loadManuscript })
          ])
        ]),
        el('div', { id: 'coverSummary', class: 'card' }),
        App.card('Medidas da capa (mm) — editáveis', [
          totalInput('totalW', 'Largura total da capa (mm)', g.totalW, v2 => { c.totalsManual = true; c.totalW = v2; c.totalH = g.totalH; }),
          totalInput('totalH', 'Altura total da capa (mm)', g.totalH, v2 => { c.totalsManual = true; c.totalH = v2; c.totalW = g.totalW; }),
          totalInput('spine', 'Largura da lombada (mm)', g.spine, v2 => { c.spineMode = 'manual'; c.spine = v2; if (c.totalsManual) c.totalW = g.totalW - g.spine + v2; }),
          el('div', { class: 'field' }, [el('span', { class: 'flabel', text: ' ' }), el('button', { text: '↺ Recalcular automaticamente', onclick: () => { c.totalsManual = false; c.spineMode = 'auto'; App.changed('Medidas automáticas da capa', { preview: false }); render(); } })])
        ], 'Os totais incluem a sangria. Ao digitar um total, as larguras da capa e da contracapa são ajustadas; a lombada pode ser fixada à parte.'),
        App.card('Base do cálculo', [
          f('Largura do livro (mm)', on(c, 'trimW', 'number', { step: 0.1, onChange: () => { manualOn(); c.totalsManual = false; redraw(); } })),
          f('Altura do livro (mm)', on(c, 'trimH', 'number', { step: 0.1, onChange: () => { manualOn(); c.totalsManual = false; redraw(); } })),
          f('Páginas do miolo', on(c, 'pages', 'number', { step: 2, min: 2, onChange: () => { manualOn(); redraw(); } })),
          f('Papel do miolo', on(c, 'paper', 'select', { options: paperOpts, onChange: () => { proof = null; render(); } })),
          c.paper === 'custom' ? f('Espessura por página (mm)', on(c, 'paperMm', 'number', { step: 0.001 })) : null,
          el('label', { class: 'chk' }, [on(c, 'bleedAuto', 'checkbox', { onChange: () => render() }), ' Sangria automática (3 mm; 3,2 mm para KDP)']),
          !c.bleedAuto ? f('Sangria manual (mm)', on(c, 'bleed', 'number', { step: 0.1, min: 0, max: 25 })) : null,
          f('Orelhas (mm, 0 = sem)', on(c, 'flaps', 'number', { step: 1, min: 0, max: 150 })),
          el('label', { class: 'chk' }, [on(c, 'hardcover', 'checkbox', { onChange: () => render() }), ' Capa dura']),
          c.hardcover ? f('Dobra do revestimento (mm)', on(c, 'wrapExtra', 'number', { step: 1 })) : null,
          c.hardcover ? f('Acréscimo da lombada pelo cartão (mm)', on(c, 'boardExtra', 'number', { step: 0.5 })) : null,
          f('Área de segurança (mm)', on(c, 'safety', 'number', { step: 0.5 }))
        ], 'A espessura do papel varia por fabricante: confirme a lombada com a gráfica.'),
        App.card('Capa pronta (imagens)', [
          imgSlot('wrap', 'Capa inteira já montada (contracapa + lombada + capa)', 'Ideal: arquivo no tamanho total com sangria, 300 dpi'),
          imgSlot('front', 'Capa (frente)'), imgSlot('back', 'Contracapa (quarta capa)'), imgSlot('spine', 'Lombada'),
          c.flaps ? imgSlot('flapFront', 'Orelha da capa') : null, c.flaps ? imgSlot('flapBack', 'Orelha da contracapa') : null
        ], 'Imagens CMYK (JPEG) mantêm seus valores; imagens RGB são convertidas com o perfil ICC escolhido abaixo, respeitando o perfil embutido na imagem.', 'span-all'),
        App.card('Cor de fundo (áreas sem imagem)', [f('Capa', on(c.bg, 'front', 'color')), f('Lombada', on(c.bg, 'spine', 'color')), f('Contracapa', on(c.bg, 'back', 'color'))]),
        App.card('Código de barras (ISBN)', [el('label', { class: 'chk' }, [on(c, 'barcode', 'checkbox'), ' Reservar área branca de 50 × 30 mm na contracapa (opcional)'])]),
        App.card('Saída para gráfica — PDF CMYK', [
          f('Perfil de cor (ICC)', on(c, 'profile', 'select', { options: [{ value: 'fogra39', label: 'ISO Coated v2 (ECI) — FOGRA39 · couchê, offset Brasil/Europa' }, { value: 'gracol', label: 'GRACoL 2013 (CRPC6) · couchê, padrão EUA/KDP' }] }), 'Use o perfil indicado pela sua gráfica.', 'wide'),
          f('Intenção de renderização', on(c, 'intent', 'select', { options: [{ value: 'relative', label: 'Colorimétrica relativa + compensação de preto (recomendado)' }, { value: 'perceptual', label: 'Perceptual (fotos muito saturadas)' }] })),
          f('Resolução', on(c, 'dpi', 'select', { options: [{ value: 300, label: '300 dpi (padrão de gráfica)' }, { value: 400, label: '400 dpi' }, { value: 600, label: '600 dpi' }], onChange: v2 => { c.dpi = Number(v2); } })),
          el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'cvExpBleed', checked: true }), ' Com sangria (recomendado)']),
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'primary', text: '⇩ Exportar PDF CMYK para gráfica', onclick: exportPdf }),
            el('button', { text: 'Prova de cor (simulação CMYK)', onclick: runProof })
          ])
        ], 'O PDF sai no padrão PDF/X-1a: somente CMYK, sem transparências, com o perfil de saída (OutputIntent), caixas de corte e sangria. Confira a prova impressa da gráfica antes da tiragem.', 'span-all')
      ]),
      el('div', { class: 'cover-preview' }, [
        el('div', { class: 'inline' }, [el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvGuides', checked: true, onchange: redraw }), ' Guias (corte, dobras, área segura)']), el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvBleed', checked: true, onchange: redraw }), ' Mostrar sangria'])]),
        el('div', { id: 'coverStage', class: 'cover-stage' })
      ])
    ]));
    updateSummary();
    if (proof) return showProof();
    frame = el('iframe', { class: 'cover-frame', src: 'cover.html' });
    frame.onload = drawPreview;
    $('#coverStage').appendChild(frame);
  }

  App.hooks.viewRender.cover = render;
  App.cover = { ensure: cover, syncFromBook, render };
})();
