/* global App */
// Gráficos do livro: colunas (agrupadas ou empilhadas), barras horizontais, linhas, área, pizza e rosca,
// com uma ou várias séries (vindas de uma planilha: 1ª coluna = rótulos, demais colunas = séries).
// Desenho em alta resolução (1800 px de largura ≈ 300 dpi em 15 cm), com versão em tons de cinza para P&B.
(function () {
  const PALETTE = ['#2f4b7c', '#d45087', '#ffa600', '#003f5c', '#a05195', '#f95d6a', '#665191', '#ff7c43'];
  const GRAYS = ['#1a1a1a', '#7a7a7a', '#b5b5b5', '#4d4d4d', '#9a9a9a', '#d0d0d0', '#333333', '#666666'];
  const TYPES = [['bar', 'Colunas'], ['stacked', 'Colunas empilhadas'], ['hbar', 'Barras horizontais'], ['line', 'Linhas'], ['area', 'Área'], ['pie', 'Pizza'], ['donut', 'Rosca']];

  // números no padrão brasileiro: 1.234,5 · 1.200 (milhar) · 2100,5 · também aceita 1234.5 (planilha em inglês)
  const num = v => {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim().replace(/[\s\u00a0]/g, '').replace(/%$/, '').replace(/^R\$/, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  const fmt = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  // especificação antiga ({ data: [{ l, v }] }) ou nova ({ labels, series })
  function normalize(spec) {
    spec = Object.assign({ type: 'bar', title: '', mono: false, legend: true, values: true, source: '' }, spec || {});
    if (!spec.labels && Array.isArray(spec.data)) { spec.labels = spec.data.map(d => d.l); spec.series = [{ name: spec.title || 'Valores', values: spec.data.map(d => num(d.v)) }]; }
    spec.labels = spec.labels || [];
    spec.series = (spec.series || []).map(s => ({ name: s.name || '', values: spec.labels.map((_, i) => num(s.values[i])) }));
    return spec;
  }
  // linhas de planilha -> especificação (1ª linha = nomes das séries se a 2ª coluna não for número)
  function fromRows(rows, base) {
    rows = (rows || []).filter(r => r.some(c => String(c).trim()));
    if (!rows.length) return normalize(base);
    const header = rows[0].slice(1).some(c => String(c).trim() && !/^[-+\d.,\s%]+$/.test(String(c)));
    const head = header ? rows[0] : null;
    const body = header ? rows.slice(1) : rows;
    const nS = Math.max(1, ...body.map(r => r.length - 1));
    const series = Array.from({ length: nS }, (_, j) => ({ name: head ? String(head[j + 1] || `Série ${j + 1}`) : (nS > 1 ? `Série ${j + 1}` : 'Valores'), values: body.map(r => num(r[j + 1])) }));
    return normalize(Object.assign({}, base, { labels: body.map(r => String(r[0] || '')), series, data: undefined }));
  }
  function toRows(spec) {
    spec = normalize(spec);
    return [[''].concat(spec.series.map(s => s.name))].concat(spec.labels.map((l, i) => [l].concat(spec.series.map(s => fmt(s.values[i])))));
  }

  function draw(specIn, opts) {
    const spec = normalize(specIn);
    const W = 1800, H = (opts && opts.height) || 1100;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    const fam = (App.project && App.project.settings.styles.body.font) || 'Georgia';
    const font = (size, w) => `${w || 400} ${size}px "${fam}", Georgia, serif`;
    const pie = spec.type === 'pie' || spec.type === 'donut';
    const nColors = pie ? spec.labels.length : spec.series.length;
    const colors = Array.from({ length: nColors }, (_, i) => (spec.mono ? GRAYS : PALETTE)[i % 8]);
    let top = 50;
    g.fillStyle = '#111'; g.textAlign = 'center';
    if (spec.title) { g.font = font(54, 600); g.fillText(spec.title, W / 2, 90); top = 140; }
    // legenda (séries ou fatias)
    const legendItems = pie ? spec.labels.map((l, i) => { const tot = spec.series[0].values.reduce((a, b) => a + Math.max(0, b), 0) || 1; return `${l} — ${fmt(spec.series[0].values[i] / tot * 100)}%`; }) : spec.series.map(s => s.name);
    const showLegend = spec.legend !== false && (pie || spec.series.length > 1);
    g.font = font(38);
    let bottom = H - 120;
    if (showLegend && !pie) {
      // legenda em linha embaixo
      let x = 0; const items = legendItems.map((t, i) => { const w = 60 + g.measureText(t).width + 50; const it = { t, i, w }; x += w; return it; });
      let lx = (W - x) / 2; const ly = H - 40;
      items.forEach(it => { g.fillStyle = colors[it.i]; g.fillRect(lx, ly - 30, 40, 40); g.fillStyle = '#111'; g.textAlign = 'left'; g.fillText(it.t, lx + 55, ly); lx += it.w; });
      bottom = H - 170;
    }
    if (!spec.labels.length) { g.textAlign = 'center'; g.fillStyle = '#888'; g.fillText('Sem dados', W / 2, H / 2); return cv.toDataURL('image/png'); }
    if (pie) {
      const vals = spec.series[0].values.map(v => Math.max(0, v));
      const tot = vals.reduce((a, b) => a + b, 0) || 1;
      const r = Math.min(W * 0.27, (H - top - 60) / 2);
      const cx = showLegend ? W * 0.33 : W / 2, cy = top + (H - top) / 2 - 10;
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        const a1 = a0 + v / tot * Math.PI * 2;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fillStyle = colors[i]; g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
        a0 = a1;
      });
      if (spec.type === 'donut') { g.beginPath(); g.arc(cx, cy, r * 0.55, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
      if (showLegend) {
        g.textAlign = 'left'; g.font = font(40);
        const lh = Math.min(70, (H - top - 40) / Math.max(1, legendItems.length));
        legendItems.forEach((t, i) => { const y = top + 60 + i * lh; g.fillStyle = colors[i]; g.fillRect(W * 0.66, y - 34, 40, 40); g.fillStyle = '#111'; g.fillText(t.length > 34 ? t.slice(0, 33) + '…' : t, W * 0.66 + 60, y); });
      }
      return cv.toDataURL('image/png');
    }
    const stacked = spec.type === 'stacked';
    const horizontal = spec.type === 'hbar';
    const sums = spec.labels.map((_, i) => spec.series.reduce((a, s) => a + Math.max(0, s.values[i]), 0));
    const all = spec.series.flatMap(s => s.values);
    const maxV = Math.max(0, ...(stacked ? sums : all)) || 1;
    const minV = Math.min(0, ...(stacked ? [0] : all));
    const span = maxV - minV;
    const step10 = Math.pow(10, Math.floor(Math.log10(span)));
    const tick = [1, 2, 2.5, 5, 10].map(k => k * step10).find(t => span / t <= 6) || step10 * 10;
    const vmax = Math.ceil(maxV / tick) * tick, vmin = Math.floor(minV / tick) * tick;
    g.font = font(36);
    const labelW = horizontal ? Math.min(520, 30 + Math.max(...spec.labels.map(l => g.measureText(String(l)).width))) : 0;
    const left = horizontal ? labelW + 40 : 40 + Math.max(...[vmin, vmax].map(v => g.measureText(fmt(v)).width)) + 20;
    const right = W - 60;
    const plotB = horizontal ? bottom : bottom - 50;
    const pos = v => horizontal ? left + (right - left) * (v - vmin) / (vmax - vmin) : plotB - (plotB - top) * (v - vmin) / (vmax - vmin);
    // grade e eixo de valores
    g.lineWidth = 2;
    for (let v = vmin; v <= vmax + tick / 2; v += tick) {
      const p = pos(v);
      g.strokeStyle = Math.abs(v) < 1e-9 ? '#555' : '#dddddd';
      g.beginPath(); if (horizontal) { g.moveTo(p, top); g.lineTo(p, plotB); } else { g.moveTo(left, p); g.lineTo(right, p); } g.stroke();
      g.fillStyle = '#333'; g.textAlign = horizontal ? 'center' : 'right';
      if (horizontal) g.fillText(fmt(v), p, plotB + 46); else g.fillText(fmt(v), left - 16, p + 12);
    }
    const n = spec.labels.length, nS = spec.series.length;
    const band = ((horizontal ? plotB - top : right - left)) / n;
    g.font = font(34);
    spec.labels.forEach((l, i) => {
      g.fillStyle = '#111';
      if (horizontal) { g.textAlign = 'right'; g.fillText(String(l).slice(0, 40), left - 16, top + band * (i + 0.5) + 12); }
      else { g.textAlign = 'center'; const t = String(l); g.fillText(t.length > 22 ? t.slice(0, 21) + '…' : t, left + band * (i + 0.5), plotB + 46); }
    });
    if (spec.type === 'line' || spec.type === 'area') {
      spec.series.forEach((s, j) => {
        const pts = s.values.map((v, i) => [left + band * (i + 0.5), pos(v)]);
        if (spec.type === 'area') {
          g.beginPath(); g.moveTo(pts[0][0], pos(Math.max(0, vmin))); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[pts.length - 1][0], pos(Math.max(0, vmin))); g.closePath();
          g.globalAlpha = nS > 1 ? 0.35 : 0.6; g.fillStyle = colors[j]; g.fill(); g.globalAlpha = 1;
        }
        g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineWidth = 8; g.strokeStyle = colors[j]; g.setLineDash(spec.mono ? [[], [30, 14], [6, 12], [30, 10, 6, 10]][j % 4] : []); g.stroke(); g.setLineDash([]);
        pts.forEach(p => { g.beginPath(); g.arc(p[0], p[1], 12, 0, Math.PI * 2); g.fillStyle = colors[j]; g.fill(); });
        if (spec.values !== false && nS === 1) { g.fillStyle = '#111'; g.textAlign = 'center'; g.font = font(32); pts.forEach((p, i) => g.fillText(fmt(s.values[i]), p[0], p[1] - 26)); }
      });
      return cv.toDataURL('image/png');
    }
    // colunas / barras
    const inner = band * 0.72;
    spec.labels.forEach((_, i) => {
      let acc = 0;
      spec.series.forEach((s, j) => {
        const v = s.values[i];
        const w = stacked ? inner : inner / nS;
        const o = (band - inner) / 2 + (stacked ? 0 : w * j);
        const a = stacked ? pos(acc) : pos(Math.max(0, vmin)), b = stacked ? pos(acc + Math.max(0, v)) : pos(v);
        if (stacked) acc += Math.max(0, v);
        g.fillStyle = colors[j];
        if (horizontal) g.fillRect(Math.min(a, b), top + band * i + o, Math.abs(b - a), w);
        else g.fillRect(left + band * i + o, Math.min(a, b), w, Math.abs(b - a));
        if (spec.values !== false && (!stacked || nS === 1) && w > 40) {
          g.fillStyle = '#111'; g.font = font(nS > 2 ? 28 : 32);
          if (horizontal) { g.textAlign = 'left'; g.fillText(fmt(v), Math.max(a, b) + 10, top + band * i + o + w / 2 + 11); }
          else { g.textAlign = 'center'; g.fillText(fmt(v), left + band * i + o + w / 2, Math.min(a, b) - 14); }
        }
      });
      if (stacked && spec.values !== false) { g.fillStyle = '#111'; g.font = font(32); g.textAlign = horizontal ? 'left' : 'center'; if (horizontal) g.fillText(fmt(sums[i]), pos(sums[i]) + 10, top + band * (i + 0.5) + 11); else g.fillText(fmt(sums[i]), left + band * (i + 0.5), pos(sums[i]) - 14); }
    });
    return cv.toDataURL('image/png');
  }

  window.ChartDraw = { draw, normalize, fromRows, toRows, TYPES, num };
})();
