// Desenha a capa aberta (quarta capa + lombada + primeira capa, com orelhas opcionais)
// em milímetros. Usado pela prévia da capa e pela exportação (PDF/PNG/JPG/TIFF).
(function () {
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

  function geometry(c) {
    const perPage = c.paper === 'custom' ? Number(c.paperMm) || 0.05 : (PAPERS[c.paper] || PAPERS.offset75).mm;
    const pages = Number(c.pages) || 0;
    let spine = c.spineOverride !== '' && c.spineOverride != null && !isNaN(Number(c.spineOverride)) ? Number(c.spineOverride) : pages * perPage + (c.hardcover ? Number(c.boardExtra) || 4 : 0);
    spine = Math.max(0, Math.round(spine * 100) / 100);
    const bleed = Number(c.bleed) || 0;
    const wrap = c.hardcover ? Number(c.wrapExtra) || 0 : 0;
    const flap = Number(c.flaps) || 0;
    const W = Number(c.trimW) || 140;
    const H = Number(c.trimH) || 210;
    const outer = bleed + wrap;
    const x = {};
    x.flapBack = outer;
    x.back = outer + flap;
    x.spine = x.back + W;
    x.front = x.spine + spine;
    x.flapFront = x.front + W;
    const total = x.flapFront + flap + outer;
    return { perPage, pages, spine, bleed, wrap, flap, W, H, outer, x, totalW: total, totalH: H + 2 * outer, trimTotalW: total - 2 * outer };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  window.CoverGeometry = { geometry, PAPERS };

  window.renderCover = async function (data, opts) {
    opts = opts || {};
    const c = data.cover || {};
    const assets = data.assets || {};
    const meta = data.meta || {};
    const g = geometry(c);
    const t = c.texts || {};
    const bg = c.bg || {};
    const im = c.images || {};
    const img = (k, extra) => {
      const it = im[k];
      const a = it && assets[it.asset];
      if (!a) return '';
      return `<div class="cv-img" style="${extra}; background-image:url('${a.dataUrl || it.url}'); background-size:${it.fit === 'contain' ? 'contain' : 'cover'}; background-position:${it.pos || 'center'};"></div>`;
    };
    const mm = v => `${v}mm`;
    const panels = [];
    const fullTop = 0, fullH = g.totalH;
    // fundos de cada parte (sangram até a borda externa)
    const part = (name, left, width, color) => panels.push(`<div class="cv-part cv-${name}" style="left:${mm(left)};top:0;width:${mm(width)};height:${mm(fullH)};background:${color || '#ffffff'}"></div>`);
    const leftEdge = 0;
    if (g.flap) part('flapBack', leftEdge, g.x.back, bg.flapBack || bg.back);
    part('back', g.flap ? g.x.back : leftEdge, g.flap ? g.W : g.x.spine, bg.back);
    part('spine', g.x.spine, g.spine, bg.spine || bg.back);
    part('front', g.x.front, g.flap ? g.W : g.totalW - g.x.front, bg.front);
    if (g.flap) part('flapFront', g.x.flapFront, g.flap + g.outer, bg.flapFront || bg.front);
    // imagens: envolvente (capa inteira) e por parte
    if (im.wrap) panels.push(img('wrap', `left:0;top:0;width:${mm(g.totalW)};height:${mm(g.totalH)}`));
    const partBox = {
      back: [g.flap ? g.x.back : 0, g.flap ? g.W : g.x.spine],
      spine: [g.x.spine, g.spine],
      front: [g.x.front, g.flap ? g.W : g.totalW - g.x.front],
      flapBack: [0, g.x.back],
      flapFront: [g.x.flapFront, g.flap + g.outer]
    };
    ['back', 'front', 'spine', 'flapBack', 'flapFront'].forEach(k => { if (im[k] && partBox[k][1] > 0) panels.push(img(k, `left:${mm(partBox[k][0])};top:${mm(fullTop)};width:${mm(partBox[k][1])};height:${mm(fullH)}`)); });

    const safe = Number(c.safety) || 5;
    const font = f => `'${String(f || 'EB Garamond').replace(/['"]/g, '')}', 'EB Garamond', Georgia, serif`;
    const shadow = c.textShadow ? 'text-shadow: 0 0.3mm 1.2mm rgba(0,0,0,.55);' : '';
    // textos da primeira capa
    const fx = g.x.front + safe, fw = g.W - 2 * safe;
    const top = g.outer + safe, h = g.H - 2 * safe;
    const pos = t.titlePos || 'top';
    const titleBlock = `<div class="cv-title" style="font-family:${font(t.titleFont)};font-size:${t.titleSize || 32}pt;color:${t.titleColor || '#111'};${shadow}">${esc(t.title || meta.title)}</div>${(t.subtitle || meta.subtitle) ? `<div class="cv-sub" style="font-family:${font(t.titleFont)};font-size:${t.subtitleSize || 14}pt;color:${t.titleColor || '#111'};${shadow}">${esc(t.subtitle || meta.subtitle)}</div>` : ''}`;
    const authorBlock = `<div class="cv-author" style="font-family:${font(t.authorFont || t.titleFont)};font-size:${t.authorSize || 16}pt;color:${t.authorColor || t.titleColor || '#111'};${shadow}">${esc(t.author || meta.author)}</div>`;
    const just = pos === 'top' ? 'flex-start' : pos === 'middle' ? 'center' : 'flex-end';
    panels.push(`<div class="cv-front-text" style="left:${mm(fx)};top:${mm(top)};width:${mm(fw)};height:${mm(h)};justify-content:space-between;text-align:${t.titleAlign || 'center'}">
      ${t.authorFirst ? authorBlock : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:${just};">${titleBlock}</div>
      ${t.authorFirst ? '' : authorBlock}
    </div>`);
    // lombada (texto girado; só quando há espaço)
    if (g.spine >= 4 && t.spineShow !== false) {
      const spineText = t.spineText || `${(t.title || meta.title) || ''}${(meta.author || t.author) ? '   ·   ' + (t.author || meta.author) : ''}`;
      const sz = Math.min(Number(t.spineSize) || 11, g.spine * 2.835 * 0.62);
      panels.push(`<div class="cv-spine-text" style="left:${mm(g.x.spine)};top:${mm(g.outer + safe)};width:${mm(g.spine)};height:${mm(g.H - 2 * safe)}"><div style="font-family:${font(t.spineFont || t.titleFont)};font-size:${sz}pt;color:${t.spineColor || t.titleColor || '#111'};${shadow}">${esc(spineText)}</div></div>`);
      if (im.logo && assets[im.logo.asset] && g.spine >= 8) panels.push(`<img class="cv-spine-logo" src="${assets[im.logo.asset].dataUrl}" style="left:${mm(g.x.spine + g.spine * 0.15)};width:${mm(g.spine * 0.7)};bottom:${mm(g.outer + safe)}">`);
    }
    // quarta capa
    const bx = (g.flap ? g.x.back : g.outer) + safe;
    if (t.backText) panels.push(`<div class="cv-back-text" style="left:${mm(bx)};top:${mm(g.outer + safe + 8)};width:${mm(g.W - 2 * safe)};font-family:${font(t.backFont || t.titleFont)};font-size:${t.backSize || 10.5}pt;color:${t.backColor || '#111'};text-align:${t.backAlign || 'left'};${shadow}">${esc(t.backText).replace(/\n/g, '<br>')}</div>`);
    if (c.barcode) panels.push(`<div class="cv-barcode" style="left:${mm(bx + g.W - 2 * safe - 50)};top:${mm(g.outer + g.H - safe - 30)};width:50mm;height:30mm">Área do código de barras (ISBN)</div>`);
    // orelhas
    if (g.flap) {
      if (t.flapBackText) panels.push(`<div class="cv-back-text" style="left:${mm(g.outer + safe)};top:${mm(g.outer + safe + 8)};width:${mm(g.flap - 2 * safe)};font-family:${font(t.backFont || t.titleFont)};font-size:${(t.backSize || 10.5) * 0.9}pt;color:${t.backColor || '#111'}">${esc(t.flapBackText).replace(/\n/g, '<br>')}</div>`);
      if (t.flapFrontText) panels.push(`<div class="cv-back-text" style="left:${mm(g.x.flapFront + safe)};top:${mm(g.outer + safe + 8)};width:${mm(g.flap - 2 * safe)};font-family:${font(t.backFont || t.titleFont)};font-size:${(t.backSize || 10.5) * 0.9}pt;color:${t.backColor || '#111'}">${esc(t.flapFrontText).replace(/\n/g, '<br>')}</div>`);
    }
    // guias: corte, dobras da lombada/orelhas, área segura
    const guides = [];
    if (opts.guides) {
      guides.push(`<div class="g g-trim" style="left:${mm(g.outer)};top:${mm(g.outer)};width:${mm(g.trimTotalW)};height:${mm(g.H)}"></div>`);
      [g.x.spine, g.x.front].concat(g.flap ? [g.x.back, g.x.flapFront] : []).forEach(xx => guides.push(`<div class="g g-fold" style="left:${mm(xx)};top:0;height:${mm(g.totalH)}"></div>`));
      [[(g.flap ? g.x.back : g.outer), g.W], [g.x.front, g.W]].forEach(([l, w]) => guides.push(`<div class="g g-safe" style="left:${mm(l + safe)};top:${mm(g.outer + safe)};width:${mm(w - 2 * safe)};height:${mm(g.H - 2 * safe)}"></div>`));
      if (g.spine > 2 * 1.6) guides.push(`<div class="g g-safe" style="left:${mm(g.x.spine + 1.6)};top:${mm(g.outer + safe)};width:${mm(g.spine - 3.2)};height:${mm(g.H - 2 * safe)}"></div>`);
      guides.push(`<div class="g-label" style="left:${mm(g.x.spine)};width:${mm(g.spine)};top:${mm(g.totalH + 1)}">lombada ${g.spine.toFixed(1).replace('.', ',')} mm</div>`);
    }

    // recorte: sem sangria, ou só a primeira capa
    let offX = 0, offY = 0, W = g.totalW, H = g.totalH;
    if (!opts.bleed) { offX = g.outer; offY = g.outer; W = g.trimTotalW; H = g.H; }
    if (opts.part === 'front') { offX = g.x.front; offY = g.outer; W = g.W; H = g.H; }
    const root = document.getElementById('cover');
    root.style.width = mm(W);
    root.style.height = mm(H);
    root.innerHTML = `<div class="cv-stage" style="left:${mm(-offX)};top:${mm(-offY)};width:${mm(g.totalW)};height:${mm(g.totalH)}">${panels.join('')}${guides.join('')}</div>`;
    let style = document.getElementById('cover-page');
    if (!style) { style = document.createElement('style'); style.id = 'cover-page'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${W}mm ${H}mm; margin: 0; }` + (data.fontFaceCss || '');
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => null) : null)));
    const fams = [t.titleFont, t.authorFont, t.spineFont, t.backFont].filter(Boolean);
    await Promise.all(fams.map(f => document.fonts.load(`16px "${f}"`).catch(() => null)));
    await document.fonts.ready;
    const px = 96 / 25.4;
    return { wmm: W, hmm: H, wpx: Math.round(W * px), hpx: Math.round(H * px), geometry: g };
  };
})();
