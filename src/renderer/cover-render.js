/* global CoverGeometry */
// Prévia em tela da capa aberta montada com imagens prontas (quarta capa, lombada, capa,
// orelhas ou uma imagem envolvente). A saída para gráfica é feita em CMYK no processo principal.
(function () {
  window.renderCover = async function (data, opts) {
    opts = opts || {};
    const c = data.cover || {};
    const assets = data.assets || {};
    const g = CoverGeometry.geometry(c);
    const bg = c.bg || {};
    const im = c.images || {};
    const mm = v => `${v}mm`;
    const parts = [];
    const P = g.panels;
    const fill = (k, color) => { if (P[k] && P[k][1] > 0) parts.push(`<div class="cv-part" style="left:${mm(P[k][0])};top:0;width:${mm(P[k][1])};height:${mm(g.totalH)};background:${color || '#ffffff'}"></div>`); };
    fill('flapBack', bg.flapBack || bg.back);
    fill('back', bg.back);
    fill('spine', bg.spine || bg.back);
    fill('front', bg.front);
    fill('flapFront', bg.flapFront || bg.front);
    const img = (k, l, w) => {
      const it = im[k];
      const a = it && assets[it.asset];
      if (!a || w <= 0) return;
      parts.push(`<div class="cv-img" style="left:${mm(l)};top:0;width:${mm(w)};height:${mm(g.totalH)};background-image:url('${a.dataUrl}');background-size:${it.fit === 'stretch' ? '100% 100%' : 'cover'};background-position:center"></div>`);
    };
    img('wrap', 0, g.totalW);
    ['back', 'spine', 'front', 'flapBack', 'flapFront'].forEach(k => { if (P[k]) img(k, P[k][0], P[k][1]); });
    const safe = Number(c.safety) || 5;
    if (c.barcode && P.back) parts.push(`<div class="cv-barcode" style="left:${mm(P.back[0] + P.back[1] - safe - 50)};top:${mm(g.totalH - g.outer - safe - 30)};width:50mm;height:30mm">Código de barras (ISBN)</div>`);
    const bcfg = c.isbnBarcode;
    if (bcfg && bcfg.enabled && String(bcfg.isbn || '').trim() && P.back && window.Isbn) {
      const lay = window.Isbn.layout(bcfg.isbn, bcfg);
      if (lay.ok) {
        const pos = window.Isbn.place(g, lay, bcfg);
        parts.push(`<div class="cv-isbn" style="position:absolute;left:${mm(pos.x)};top:${mm(pos.y)};width:${mm(lay.w)};height:${mm(lay.h)}">${window.Isbn.toSvg(lay).replace(/width="[^"]+" height="[^"]+"/, 'width="100%" height="100%"')}</div>`);
      } else parts.push(`<div class="cv-barcode" style="left:${mm(g.backTrim[0] + g.backTrim[1] - 12 - 37.5)};top:${mm(g.outer + g.H - 12 - 30)};width:37.5mm;height:30mm">ISBN inválido:<br>${lay.error.replace(/</g, '&lt;')}</div>`);
    }
    const guides = [];
    // linhas da sangria e do corte (opcionais; antes vinham junto com as guias)
    if (opts.bleedLines !== undefined ? opts.bleedLines : opts.guides) {
      guides.push(`<div class="g g-trim" style="left:${mm(g.outer)};top:${mm(g.outer)};width:${mm(g.trimTotalW)};height:${mm(g.H)}"></div>`);
      if (g.outer > 0) guides.push(`<div class="g g-bleed" style="left:0;top:0;width:${mm(g.totalW)};height:${mm(g.totalH)}"></div>`);
    }
    if (opts.guides) {
      g.folds.forEach(x => guides.push(`<div class="g g-fold" style="left:${mm(x)};top:0;height:${mm(g.totalH)}"></div>`));
      [g.backTrim, g.frontTrim].forEach(([l, w]) => guides.push(`<div class="g g-safe" style="left:${mm(l + safe)};top:${mm(g.outer + safe)};width:${mm(w - 2 * safe)};height:${mm(g.H - 2 * safe)}"></div>`));
      if (g.spine > 3.2) guides.push(`<div class="g g-safe" style="left:${mm(P.spine[0] + 1.6)};top:${mm(g.outer + safe)};width:${mm(g.spine - 3.2)};height:${mm(g.H - 2 * safe)}"></div>`);
    }
    let offX = 0, offY = 0, W = g.totalW, H = g.totalH;
    if (opts.bleed === false) { offX = g.outer; offY = g.outer; W = g.trimTotalW; H = g.H; }
    if (opts.part === 'front') { offX = g.frontTrim[0]; offY = g.outer; W = g.W; H = g.H; }
    const root = document.getElementById('cover');
    root.style.width = mm(W);
    root.style.height = mm(H);
    root.innerHTML = `<div class="cv-stage" style="left:${mm(-offX)};top:${mm(-offY)};width:${mm(g.totalW)};height:${mm(g.totalH)}">${parts.join('')}${guides.join('')}</div>`;
    let style = document.getElementById('cover-page');
    if (!style) { style = document.createElement('style'); style.id = 'cover-page'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${W}mm ${H}mm; margin: 0; }`;
    const px = 96 / 25.4;
    return { wmm: W, hmm: H, wpx: Math.round(W * px), hpx: Math.round(H * px), geometry: g };
  };
})();
