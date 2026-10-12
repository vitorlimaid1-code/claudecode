/*
 * Geometria da capa aberta (mm): orelha + quarta capa + lombada + primeira capa + orelha,
 * com sangria (e dobra de capa dura). Os totais podem ser calculados a partir do miolo
 * ou digitados manualmente. Compartilhado pela interface e pelo processo principal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverGeometry = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PAPERS = {
    offset75: { label: 'Offset 75 g/m²', mm: 0.050 },
    offset90: { label: 'Offset 90 g/m²', mm: 0.060 },
    polen70: { label: 'Pólen 70 g/m²', mm: 0.055 },
    polen80: { label: 'Pólen 80 g/m²', mm: 0.062 },
    polen90: { label: 'Pólen 90 g/m²', mm: 0.068 },
    couche90: { label: 'Couchê 90 g/m²', mm: 0.040 },
    couche115: { label: 'Couchê 115 g/m²', mm: 0.050 },
    kdpWhite: { label: 'Amazon KDP — branco', mm: 0.0572 },
    kdpCream: { label: 'Amazon KDP — creme', mm: 0.0635 },
    kdpColor: { label: 'Amazon KDP — colorido premium', mm: 0.0596 },
    custom: { label: 'Personalizado', mm: null }
  };
  const n = (v, d) => { const x = Number(v); return v !== '' && v != null && isFinite(x) ? x : d; };

  function autoCoverBleed(c) {
    return /^kdp/.test(c.paper || '') ? 3.175 : 3; // KDP: 0,125 pol.
  }

  function geometry(c) {
    c = c || {};
    const perPage = c.paper === 'custom' ? n(c.paperMm, 0.05) : (PAPERS[c.paper] || PAPERS.polen80).mm;
    const pages = n(c.pages, 0);
    const autoSpine = Math.round((pages * perPage + (c.hardcover ? n(c.boardExtra, 4) : 0)) * 100) / 100;
    const spine = c.spineMode === 'manual' ? Math.max(0, n(c.spine, autoSpine)) : autoSpine;
    const bleed = c.bleedAuto !== false ? autoCoverBleed(c) : Math.max(0, n(c.bleed, 3));
    const wrap = c.hardcover ? n(c.wrapExtra, 15) : 0;
    const outer = bleed + wrap;
    const flap = Math.max(0, n(c.flaps, 0));
    let W = n(c.trimW, 140);
    let H = n(c.trimH, 210);
    let totalW, totalH;
    if (c.totalsManual) {
      totalW = n(c.totalW, 2 * outer + 2 * flap + 2 * W + spine);
      totalH = n(c.totalH, H + 2 * outer);
      W = Math.max(10, (totalW - 2 * outer - 2 * flap - spine) / 2);
      H = Math.max(10, totalH - 2 * outer);
    } else {
      totalW = 2 * outer + 2 * flap + 2 * W + spine;
      totalH = H + 2 * outer;
    }
    const r = v => Math.round(v * 100) / 100;
    const p = {};
    if (flap) {
      p.flapBack = [0, outer + flap];
      p.back = [outer + flap, W];
      p.spine = [outer + flap + W, spine];
      p.front = [outer + flap + W + spine, W];
      p.flapFront = [outer + flap + 2 * W + spine, flap + outer];
    } else {
      p.back = [0, outer + W];
      p.spine = [outer + W, spine];
      p.front = [outer + W + spine, W + outer];
    }
    const folds = [p.spine[0], p.spine[0] + spine].concat(flap ? [outer + flap, outer + flap + 2 * W + spine] : []);
    return {
      perPage, pages, autoSpine, spine: r(spine), bleed, wrap, outer, flap, W: r(W), H: r(H),
      totalW: r(totalW), totalH: r(totalH), trimTotalW: r(totalW - 2 * outer), trimTotalH: r(H),
      panels: p, folds,
      backTrim: [flap ? outer + flap : outer, W], frontTrim: [p.front[0], W]
    };
  }

  return { PAPERS, geometry, autoCoverBleed };
});
