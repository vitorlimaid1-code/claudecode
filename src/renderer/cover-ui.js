/* global App, CoverGeometry */
// Capa e lombada: recebe automaticamente as dimensões do miolo, calcula a lombada pelo papel
// e número de páginas, monta capa, lombada, quarta capa e orelhas, e exporta com ou sem sangria.
(function () {
  const { el, $, api } = App;
  let frame = null;

  function defaults() {
    const s = App.project.settings;
    const m = App.project.meta;
    return {
      trimW: s.pageWidth, trimH: s.pageHeight, pages: App.lastRender ? App.lastRender.pages : 100,
      paper: 'polen80', paperMm: 0.06, spineOverride: '', bleed: 3, flaps: 0, hardcover: false, wrapExtra: 15, boardExtra: 4, safety: 5,
      confirmed: null, barcode: true, textShadow: false,
      bg: { front: '#2b2622', back: '#2b2622', spine: '#2b2622' },
      images: {},
      texts: { title: null, subtitle: null, author: null, titleFont: s.styles.chapterTitle.font || s.styles.body.font, titleSize: 34, titleColor: '#f5efe7', titlePos: 'top', titleAlign: 'center', authorSize: 16, authorColor: '#e9b48f', spineSize: 11, spineColor: '#f5efe7', backText: m.description || '', backSize: 10.5, backColor: '#f5efe7', backAlign: 'left', flapFrontText: '', flapBackText: '' }
    };
  }
  function cover() {
    if (!App.project.cover) App.project.cover = defaults();
    const c = App.project.cover;
    c.texts = c.texts || {}; c.bg = c.bg || {}; c.images = c.images || {};
    return c;
  }

  function manuscriptDims() {
    const s = App.project.settings;
    let pages = App.lastRender ? App.lastRender.pages : null;
    if (pages && pages % 2) pages += 1;
    return { trimW: s.pageWidth, trimH: s.pageHeight, pages };
  }

  // Mantém a capa sincronizada com o miolo enquanto as dimensões não forem confirmadas
  function syncFromManuscript() {
    const c = App.project.cover;
    if (!c || c.confirmed) return;
    const d = manuscriptDims();
    c.trimW = d.trimW; c.trimH = d.trimH;
    if (d.pages) c.pages = d.pages;
  }
  App.hooks.afterChange.push(o => { if (o && o.rendered) { syncFromManuscript(); if (App.view === 'cover') updateBanner(); } });

  function confirmDims() {
    const c = cover();
    const d = manuscriptDims();
    c.trimW = d.trimW; c.trimH = d.trimH;
    if (d.pages) c.pages = d.pages;
    c.confirmed = { trimW: c.trimW, trimH: c.trimH, pages: c.pages, at: new Date().toISOString() };
    App.changed('Dimensões da capa confirmadas', { preview: false });
    render();
    App.toast('Dimensões confirmadas: ' + c.trimW / 10 + ' × ' + c.trimH / 10 + ' cm, ' + c.pages + ' páginas.');
  }

  function updateBanner() {
    const b = $('#coverBanner');
    if (!b) return;
    const c = cover();
    const d = manuscriptDims();
    const diff = c.confirmed && (Math.abs(c.confirmed.trimW - d.trimW) > 0.01 || Math.abs(c.confirmed.trimH - d.trimH) > 0.01 || (d.pages && c.confirmed.pages !== d.pages));
    b.className = 'cover-banner ' + (diff ? 'warn' : c.confirmed ? 'ok' : 'info');
    b.innerHTML = '';
    b.append(
      el('span', { text: diff ? `⚠ O miolo mudou desde a confirmação: agora ${App.fmtNum(d.trimW / 10)} × ${App.fmtNum(d.trimH / 10)} cm, ${d.pages} páginas.` : c.confirmed ? `✓ Dimensões confirmadas em ${new Date(c.confirmed.at).toLocaleString('pt-BR')}: ${App.fmtNum(c.trimW / 10)} × ${App.fmtNum(c.trimH / 10)} cm, ${c.pages} páginas.` : `Dimensões recebidas automaticamente do miolo: ${App.fmtNum(d.trimW / 10)} × ${App.fmtNum(d.trimH / 10)} cm, ${d.pages || '—'} páginas.` }),
      el('button', { class: 'primary', text: diff ? 'Atualizar e confirmar dimensões' : 'Confirmar as dimensões', onclick: confirmDims }),
      c.confirmed ? el('button', { text: 'Voltar a acompanhar o miolo', onclick: () => { c.confirmed = null; syncFromManuscript(); App.changed('Capa acompanha o miolo', { preview: false }); render(); } }) : null
    );
  }

  async function drawPreview() {
    if (!frame || !frame.contentWindow || !frame.contentWindow.renderCover) return;
    const c = cover();
    const t = c.texts;
    const fams = [t.titleFont, t.authorFont, t.spineFont, t.backFont].filter(Boolean);
    const css = (await api.fontsCss(fams.filter(f => !App.D.BUNDLED_FONTS.includes(f)))).css;
    const assets = {};
    Object.values(c.images).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = { dataUrl: App.assetUrl(it.asset) }; });
    const r = await frame.contentWindow.renderCover({ cover: c, assets, meta: App.project.meta, fontFaceCss: css }, { bleed: $('#cvBleed') ? $('#cvBleed').checked : true, guides: $('#cvGuides') ? $('#cvGuides').checked : true });
    const box = $('#coverStage');
    if (box) frame.contentWindow.setCoverZoom(Math.min(1.4, (box.clientWidth - 40) / r.wpx));
    const g = r.geometry;
    const info = $('#coverInfo');
    if (info) info.innerHTML = `<b>Lombada: ${App.fmtNum(g.spine, 2)} mm</b> (${g.pages} páginas × ${App.fmtNum(g.perPage, 4)} mm${c.hardcover ? ' + cartão' : ''}) · Capa aberta com sangria: <b>${App.fmtNum(g.totalW / 10)} × ${App.fmtNum(g.totalH / 10)} cm</b> · sem sangria: ${App.fmtNum(g.trimTotalW / 10)} × ${App.fmtNum(g.H / 10)} cm${g.spine < 4 ? ' · lombada estreita demais para texto (mín. ~4 mm)' : ''}`;
  }
  const redraw = () => { clearTimeout(redraw._t); redraw._t = setTimeout(drawPreview, 250); };

  function render() {
    const v = $('#view-cover');
    v.innerHTML = '';
    const c = cover();
    syncFromManuscript();
    const t = c.texts;
    const on = (obj, key, type, o) => { const i = App.bind(obj, key, type, Object.assign({ label: 'Capa', onChange: redraw }, o || {})); return i; };
    const f = App.field;
    const imgSlot = (key, label) => {
      const it = c.images[key];
      const a = it && App.project.assets[it.asset];
      return el('div', { class: 'field' }, [el('span', { class: 'flabel', text: label }), el('div', { class: 'inline' }, [
        a ? el('img', { class: 'mini-thumb', src: App.assetUrl(it.asset) }) : null,
        el('button', { class: 'small-btn', text: a ? 'Trocar' : 'Inserir…', onclick: async () => { const l = await api.pickImages({ title: label }); if (!l) return; c.images[key] = { asset: await App.addAsset(l[0]), fit: 'cover' }; App.changed('Imagem da capa: ' + label, { preview: false }); render(); } }),
        a ? (() => { const s = el('select', { onchange: e => { it.fit = e.target.value; App.changed('Ajuste da imagem da capa', { preview: false }); redraw(); } }, [['cover', 'Preencher'], ['contain', 'Inteira']].map(([x, y]) => el('option', { value: x, text: y }))); s.value = it.fit || 'cover'; return s; })() : null,
        a ? el('button', { class: 'small-btn', text: '✕', onclick: () => { delete c.images[key]; App.changed('Imagem da capa removida', { preview: false }); render(); } }) : null
      ])]);
    };
    const paperOpts = Object.entries(CoverGeometry.PAPERS).map(([k, p]) => ({ value: k, label: p.label + (p.mm ? ` (${String(p.mm).replace('.', ',')} mm/pág.)` : '') }));
    v.appendChild(el('div', { class: 'cover-layout' }, [
      el('div', { class: 'cover-form' }, [
        el('h2', { text: 'Capa e lombada' }),
        el('div', { id: 'coverBanner', class: 'cover-banner' }),
        App.card('Dimensões', [
          f('Largura do livro (mm)', on(c, 'trimW', 'number', { step: 0.1, disabled: !!c.confirmed })),
          f('Altura do livro (mm)', on(c, 'trimH', 'number', { step: 0.1, disabled: !!c.confirmed })),
          f('Páginas do miolo', on(c, 'pages', 'number', { step: 2, min: 2, disabled: !!c.confirmed })),
          f('Papel do miolo', on(c, 'paper', 'select', { options: paperOpts, onChange: () => { redraw(); render(); } })),
          c.paper === 'custom' ? f('Espessura por página (mm)', on(c, 'paperMm', 'number', { step: 0.001 })) : null,
          f('Lombada manual (mm)', on(c, 'spineOverride', 'number', { step: 0.1, allowEmpty: true }), 'Vazio = calcular automaticamente'),
          f('Sangria da capa (mm)', on(c, 'bleed', 'number', { step: 0.1, min: 0, max: 20 })),
          f('Orelhas (largura em mm, 0 = sem)', on(c, 'flaps', 'number', { step: 1, min: 0, max: 150 })),
          el('label', { class: 'chk' }, [on(c, 'hardcover', 'checkbox', { onChange: () => { redraw(); render(); } }), ' Capa dura']),
          c.hardcover ? f('Dobra do revestimento (mm)', on(c, 'wrapExtra', 'number', { step: 1 })) : null,
          c.hardcover ? f('Acréscimo da lombada pelo cartão (mm)', on(c, 'boardExtra', 'number', { step: 0.5 })) : null,
          f('Área segura (mm)', on(c, 'safety', 'number', { step: 0.5 }))
        ], 'A espessura do papel varia por fabricante: confirme a lombada com a gráfica antes de imprimir. A sangria da capa é independente da sangria do miolo.'),
        App.card('Imagens', [imgSlot('front', 'Capa (frente)'), imgSlot('back', 'Contracapa (quarta capa)'), imgSlot('spine', 'Lombada'), imgSlot('wrap', 'Imagem envolvente (capa inteira)'), c.flaps ? imgSlot('flapFront', 'Orelha da capa') : null, c.flaps ? imgSlot('flapBack', 'Orelha da contracapa') : null, imgSlot('logo', 'Logotipo na lombada')]),
        App.card('Cores de fundo', [f('Capa', on(c.bg, 'front', 'color')), f('Lombada', on(c.bg, 'spine', 'color')), f('Contracapa', on(c.bg, 'back', 'color'))]),
        App.card('Textos', [
          f('Título (vazio = título do livro)', on(t, 'title', 'text', { placeholder: App.project.meta.title })),
          f('Subtítulo', on(t, 'subtitle', 'text', { placeholder: App.project.meta.subtitle })),
          f('Autor', on(t, 'author', 'text', { placeholder: App.project.meta.author })),
          f('Fonte do título', on(t, 'titleFont', 'select', { options: App.fontOptions(false) })),
          f('Tamanho do título (pt)', on(t, 'titleSize', 'number', { step: 1, min: 8, max: 120 })),
          f('Cor do título', on(t, 'titleColor', 'color')),
          f('Posição do título', on(t, 'titlePos', 'select', { options: [{ value: 'top', label: 'Topo' }, { value: 'middle', label: 'Meio' }, { value: 'bottom', label: 'Base' }] })),
          f('Alinhamento', on(t, 'titleAlign', 'select', { options: [{ value: 'center', label: 'Centro' }, { value: 'left', label: 'Esquerda' }, { value: 'right', label: 'Direita' }] })),
          el('label', { class: 'chk' }, [on(t, 'authorFirst', 'checkbox'), ' Autor acima do título']),
          f('Tamanho do autor (pt)', on(t, 'authorSize', 'number', { step: 1 })),
          f('Cor do autor', on(t, 'authorColor', 'color')),
          f('Texto da lombada (vazio = título · autor)', on(t, 'spineText', 'text')),
          f('Tamanho na lombada (pt)', on(t, 'spineSize', 'number', { step: 0.5 })),
          f('Cor na lombada', on(t, 'spineColor', 'color')),
          f('Texto da quarta capa (sinopse)', on(t, 'backText', 'textarea', { rows: 6 }), '', 'wide'),
          f('Tamanho na quarta capa (pt)', on(t, 'backSize', 'number', { step: 0.5 })),
          f('Cor na quarta capa', on(t, 'backColor', 'color')),
          c.flaps ? f('Texto da orelha da capa', on(t, 'flapFrontText', 'textarea', { rows: 4 }), '', 'wide') : null,
          c.flaps ? f('Texto da orelha da contracapa (ex.: biografia)', on(t, 'flapBackText', 'textarea', { rows: 4 }), '', 'wide') : null,
          el('label', { class: 'chk' }, [on(c, 'barcode', 'checkbox'), ' Reservar área do código de barras']),
          el('label', { class: 'chk' }, [on(c, 'textShadow', 'checkbox'), ' Sombra nos textos (legibilidade sobre fotos)'])
        ]),
        App.card('Exportar capa', [
          el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'cvExpBleed', checked: true }), ' Com sangria']),
          f('Resolução (imagens)', (() => { const s = el('select', { id: 'cvDpi' }, ['150', '300', '600'].map(x => el('option', { value: x, text: x + ' dpi' }))); s.value = '300'; return s; })()),
          el('div', { class: 'inline wrap' }, ['pdf', 'png', 'jpeg', 'tiff'].map(fmt => el('button', { class: fmt === 'pdf' ? 'primary' : '', text: fmt.toUpperCase(), onclick: () => exportCover(fmt) })))
        ])
      ]),
      el('div', { class: 'cover-preview' }, [
        el('div', { class: 'inline' }, [el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvGuides', checked: true, onchange: redraw }), ' Guias (corte, dobras, área segura)']), el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvBleed', checked: true, onchange: redraw }), ' Mostrar sangria'])]),
        el('div', { id: 'coverInfo', class: 'small' }),
        el('div', { id: 'coverStage', class: 'cover-stage' })
      ])
    ]));
    updateBanner();
    frame = el('iframe', { class: 'cover-frame', src: 'cover.html' });
    frame.onload = drawPreview;
    $('#coverStage').appendChild(frame);
  }

  async function exportCover(format) {
    App.flush();
    const opts = { format, bleed: $('#cvExpBleed').checked, dpi: Number($('#cvDpi').value) };
    App.toast('Gerando a capa…', 30000);
    const r = await api.exportRun({ kind: 'cover', project: App.serialize(), opts });
    $('#toast').classList.remove('show');
    if (r && r.files) {
      const b = await api.confirm('Capa exportada!', r.files[0], ['Abrir', 'Mostrar na pasta', 'Fechar']);
      if (b === 0) api.openPath(r.files[0]); else if (b === 1) api.showItem(r.files[0]);
    }
  }

  App.hooks.viewRender.cover = render;
  App.cover = { ensure: cover, syncFromManuscript };
})();
