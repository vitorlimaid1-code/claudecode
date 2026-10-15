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
    // CEDET (manual de preparação): a lombada oficial vem SEMPRE das calculadoras do Cedet; a espessura
    // abaixo é só uma estimativa de referência. Critério de página chapada: com chapada → gráfica externa
    // (miolo Pólen Bold 70 g); sem chapada → gráfica interna (miolo Avena 80 g). Capa: cartão 250 g.
    cedetAvena80: { label: 'CEDET — Avena 80 g/m² (gráfica interna: miolo sem página chapada)', mm: 0.053, cedet: true },
    cedetPolenBold70: { label: 'CEDET — Pólen Bold 70 g/m² (gráfica externa: miolo com página chapada)', mm: 0.062, cedet: true },
    // padrão atual: lombada pela calculadora oficial do Cedet (cedet-spine.js); a espessura é só a média da tabela
    cedetPolenNat80: { label: 'CEDET — Pólen Natural (B2B) 80 · capa Triplex 250 (calculadora do Cedet)', mm: 0.058, cedet: true },
    kdpWhite: { label: 'Amazon KDP — branco', mm: 0.0572 },
    kdpCream: { label: 'Amazon KDP — creme', mm: 0.0635 },
    kdpColor: { label: 'Amazon KDP — colorido premium', mm: 0.0596 },
    custom: { label: 'Personalizado', mm: null }
  };
  const n = (v, d) => { const x = Number(v); return v !== '' && v != null && isFinite(x) ? x : d; };
  // calculadora de lombada do Cedet (tabela da planilha oficial)
  const CS = typeof module === 'object' && module.exports ? require('./cedet-spine') : (typeof self !== 'undefined' ? self.CedetSpine : null);
  function cedetCalc(c) {
    if (!CS || !c || !c.cedet) return null;
    return CS.spine(n(c.pages, 0), c.cedetPaper || CS.DEFAULT_PAPER, c.cedetCover || CS.DEFAULT_COVER);
  }

  function autoCoverBleed(c) {
    if (c && c.cedet) return 5; // CEDET: sangria de 5 mm
    return /^kdp/.test(c.paper || '') ? 3.175 : 3; // KDP: 0,125 pol.
  }

  function geometry(c) {
    c = c || {};
    const perPage = c.paper === 'custom' ? n(c.paperMm, 0.05) : (PAPERS[c.paper] || PAPERS.polen80).mm;
    const pages = n(c.pages, 0);
    const calc = cedetCalc(c);
    const autoSpine = calc && calc.ok ? calc.spine : Math.round((pages * perPage + (c.hardcover ? n(c.boardExtra, 4) : 0)) * 100) / 100;
    const spine = c.spineMode === 'manual' ? Math.max(0, n(c.spine, autoSpine)) : autoSpine;
    const bleed = c.bleedAuto !== false ? autoCoverBleed(c) : Math.max(0, n(c.bleed, 3));
    const wrap = c.hardcover ? n(c.wrapExtra, 15) : 0;
    const outer = bleed + wrap;
    const flap = Math.max(0, n(c.flaps, 0));
    // CEDET: a capa com orelhas é 2 mm mais larga que o miolo (15,7 × 23; 13,9 × 21; 11,7 × 17,5)
    const panelExtra = c.cedet && flap ? 2 : 0;
    let W = n(c.trimW, 140) + panelExtra;
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
      panelExtra, perPage, pages, autoSpine, cedetCalc: calc, spine: r(spine), bleed, wrap, outer, flap, W: r(W), H: r(H),
      totalW: r(totalW), totalH: r(totalH), trimTotalW: r(totalW - 2 * outer), trimTotalH: r(H),
      panels: p, folds,
      backTrim: [flap ? outer + flap : outer, W], frontTrim: [p.front[0], W]
    };
  }

  // Marcas de corte e de dobra da capa (mm): deslocamento a partir do corte, comprimento, espessura (pt)
  function marks(c) {
    const m = (c && c.marks) || {};
    if (!(c && (m.enabled || (c.cedet && m.enabled === undefined)))) return null; // opcional (o Cedet exige: vem ligado)
    return { offset: Math.max(0, n(m.offset, 5)), len: Math.max(1, n(m.len, 5)), weight: Math.max(0.1, n(m.weight, 0.25)) };
  }

  // Marca da editora na capa: logotipo (o da página de rosto) no pé da quarta capa (ou da capa).
  // aspect = largura/altura do logotipo. Tudo em mm na capa aberta.
  // a capa NÃO leva QR code (na contracapa só o código de barras do ISBN): qr fica sempre desligado
  const BRAND = { enabled: true, panel: 'back', logoWidth: 24, qrSize: 18, margin: 12, qr: false, logo: true, qrText: '' };
  function brand(g, c, aspect, bc) {
    const b = Object.assign({}, BRAND, (c && c.brand) || {});
    if (!b.enabled) return null;
    const trim = b.panel === 'front' ? g.frontTrim : g.backTrim;
    const m = Math.max(3, n(b.margin, 12));
    const bottom = g.outer + g.H - m;
    let lw = Math.max(5, n(b.logoWidth, 24)), lh = lw / (aspect > 0 ? aspect : 2);
    if (lh > 30) { lh = 30; lw = lh * (aspect > 0 ? aspect : 2); }
    return {
      logo: b.logo !== false ? { x: trim[0] + m, y: bottom - lh, w: lw, h: lh } : null,
      qr: null // sem QR code na capa
    };
  }

  return { PAPERS, geometry, cedetCalc, autoCoverBleed, marks, brand, BRAND };
});
