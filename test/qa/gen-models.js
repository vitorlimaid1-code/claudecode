// Gera os PDFs de todos os modelos (formatos, sangria, KDP, CEDET, revista, jornal…) e devolve o manifesto.
// Executado dentro do app por test/qa/run.js; __OUT__ é trocado pela pasta de saída.
(async () => {
  const OUT = '__OUT__';
  App.closeModal();
  const D = App.D;
  const castle = await App.addAssetFromUrl('app://local/assets/library/corpo/castelo.png', { name: 'castelo' });
  const castleAsset = App.project.assets[castle];
  let seq = 0;
  const words = n => { const a = []; for (let i = 0; i < n; i++) a.push('k' + (seq++).toString(36)); return a.join(' '); };
  function makeProject(cfg) {
    seq = 0;
    const p = D.normalizeProject(null);
    p.assets[castle] = castleAsset;
    const para = n => '<p>' + words(n) + '</p>';
    p.chapters = [
      { id: 'c1', title: 'Primeiro', numbered: true, html: para(260) + '<p>' + words(40) + '<span class="footnote">' + words(12) + '</span> ' + words(60) + '</p><h2>Seção um</h2>' + para(320) + '<h3>Sub</h3>' + para(150) + '<figure class="img" data-asset="' + castle + '" data-align="left" data-wrap="square" data-width="40"><img data-asset="' + castle + '"></figure>' + para(220) },
      { id: 'c2', title: 'Segundo', numbered: true, html: para(200) + '<div class="fullbleed" data-asset="' + castle + '" data-fit="cover"></div>' + para(180) + '<table><tr><td>' + words(15) + '</td><td>' + words(15) + '</td></tr></table>' + para(90) },
      { id: 'c3', title: 'Terceiro', numbered: true, html: '<div class="poem"><p>' + words(5) + '<br>' + words(6) + '<br>' + words(4) + '</p></div>' + para(400) + '<p>' + words(30) + '<span class="footnote">' + words(20) + '</span></p>' },
      { id: 'c4', title: 'Quarto', numbered: true, html: para(30) }
    ];
    p.back.bio.enabled = true; p.back.bio.html = para(60); p.back.extra.enabled = true; p.back.extra.title = 'Agradecimentos'; p.back.extra.html = para(40);
    const s = p.settings;
    if (cfg.genre) { D.applyGenrePreset(s, cfg.genre); p.genre = cfg.genre; }
    if (cfg.size) { s.pageWidth = cfg.size[0]; s.pageHeight = cfg.size[1]; s.pageFormat = cfg.format || 'custom'; }
    if (cfg.kdp) s.kdp = { enabled: true };
    if (cfg.bleed != null) { s.bleedAuto = false; s.bleedTop = s.bleedBottom = s.bleedOuter = cfg.bleed; }
    if (cfg.cedet) D.applyCedet(s, cfg.cedet);
    if (cfg.kind) { App.project = p; App.periodical.applyKind(cfg.kind); }
    return { p, total: seq };
  }
  const cfgs = Object.keys(D.GENRE_PRESETS).map(g => ({ name: 'genero-' + g, genre: g }))
    .concat([
      { name: 'cedet-15,5x23', cedet: 'CEDET (padrão do sistema):15.5x23' },
      { name: 'cedet-13,7x21', cedet: 'CEDET (padrão do sistema):13.7x21' },
      { name: 'cedet-11,5x17,5', cedet: 'CEDET (padrão do sistema):11.5x17.5' },
      { name: 'kdp-6x9', size: [152.4, 228.6], format: 'kdp-6x9', kdp: true },
      { name: 'a4', size: [210, 297] },
      { name: 'quadrado', size: [210, 210] },
      { name: 'pequeno', size: [110, 180] },
      { name: 'grande-a3', size: [297, 420] },
      { name: 'sangria-5mm', bleed: 5 },
      { name: 'sem-sangria', bleed: 0 },
      { name: 'revista', kind: 'magazine' },
      { name: 'jornal', kind: 'newspaper' }
    ]);
  const manifest = [];
  for (const cfg of cfgs) {
    const { p, total } = makeProject(cfg);
    const proj = JSON.parse(JSON.stringify(cfg.kind ? App.project : p));
    const file = OUT + '/' + cfg.name + '.pdf';
    const r = await api.exportRun({ kind: 'pdf', project: proj, opts: { target: file } });
    const s = proj.settings;
    manifest.push({ name: cfg.name, file, total, pages: r && r.pages, w: s.pageWidth, h: s.pageHeight, mi: s.marginInner, mo: s.marginOuter, mt: s.marginTop, bleed: s.bleedAuto ? D.autoBleed(s) : Math.max(s.bleedTop, s.bleedBottom, s.bleedOuter), kdp: !!cfg.kdp, kind: proj.kind, sheet: (sh => sh && sh.fits ? [sh.w, sh.h] : null)(D.outputSheetSize(s, s.bleedAuto ? D.autoBleed(s) : Math.max(s.bleedTop, s.bleedBottom, s.bleedOuter))) });
  }
  await api.saveText; 
  window.__manifest = manifest;
  return JSON.stringify(manifest);
})()

