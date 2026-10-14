// Molduras de página (preto puro sobre o papel branco): contornam a mancha de texto pelos quatro lados,
// na margem, sem tocar no texto. Geradas em SVG na medida exata da página (mm), sem deformar ornamentos.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PageFrames = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const K = '#000';
  const f = n => Math.round(n * 100) / 100;
  // w, h: tamanho total da moldura (mm); t: largura da faixa da moldura (mm)
  const rect = (x, y, w, h, sw, extra) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${K}" stroke-width="${sw}"${extra || ''}/>`;
  const corners = (w, h, fn) => [[0, 0, 0], [w, 0, 90], [w, h, 180], [0, h, 270]].map(([x, y, r]) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${r})">${fn()}</g>`).join('');
  const mids = (w, h, fn) => [[w / 2, 0, 0], [w, h / 2, 90], [w / 2, h, 180], [0, h / 2, 270]].map(([x, y, r]) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${r})">${fn()}</g>`).join('');

  // faixa de cada lado em coordenadas locais: x ao longo do lado (0..L), y da borda (0) para dentro (t)
  const sides = (w, h, fn) => [[0, 0, 0, w], [w, 0, 90, h], [w, h, 180, w], [0, h, 270, h]].map(([x, y, r, L], k) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${r})">${fn(L, k)}</g>`).join('');
  const at = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(' ');
  const line = (x1, y1, x2, y2, sw, extra) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${K}" stroke-width="${sw}" stroke-linecap="round"${extra || ''}/>`;
  const circle = (cx, cy, r, fill, sw) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill || 'none'}"${sw ? ` stroke="${K}" stroke-width="${sw}"` : ''}/>`;
  const spiral = (cx, cy, r, turns, dir, sw, a0) => {
    const pts = [], T = turns * 2 * Math.PI;
    for (let th = 0; th <= T; th += 0.2) { const rr = r * (1 - 0.82 * th / T); const a = (a0 || 0) + dir * th; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    return `<path d="${at(pts)}" fill="none" stroke="${K}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };
  // pseudoaleatório com semente (o desenho é sempre o mesmo)
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const fixedCorners = (w, h, t, fn) => [[t / 2, t / 2], [w - t / 2, t / 2], [w - t / 2, h - t / 2], [t / 2, h - t / 2]].map(([x, y]) => `<g transform="translate(${f(x)} ${f(y)})">${fn()}</g>`).join('');
  // adaga deitada, centrada na origem, ponta para +x
  const dagger = (len, bw) => {
    const r = bw * 0.42, x0 = -len / 2, gx = x0 + 2 * r + len * 0.2, tip = len / 2;
    return circle(x0 + r, 0, r, K) +
      `<rect x="${f(x0 + 2 * r - 0.1)}" y="${f(-bw * 0.28)}" width="${f(len * 0.2 + 0.1)}" height="${f(bw * 0.56)}" rx="${f(bw * 0.15)}" fill="${K}"/>` +
      `<rect x="${f(gx)}" y="${f(-bw * 1.15)}" width="${f(Math.max(0.7, bw * 0.3))}" height="${f(bw * 2.3)}" rx="0.3" fill="${K}"/>` +
      `<path d="M${f(gx + Math.max(0.7, bw * 0.3))} ${f(-bw / 2)} L${f(tip)} 0 L${f(gx + Math.max(0.7, bw * 0.3))} ${f(bw / 2)} Z" fill="#fff" stroke="${K}" stroke-width="0.35" stroke-linejoin="round"/>` +
      line(gx + bw * 0.6, 0, tip - len * 0.18, 0, 0.22);
  };
  const skull = s => `<path d="M${f(-s * 0.42)} ${f(-s * 0.05)} A${f(s * 0.42)} ${f(s * 0.44)} 0 1 1 ${f(s * 0.42)} ${f(-s * 0.05)} L${f(s * 0.3)} ${f(s * 0.2)} L${f(-s * 0.3)} ${f(s * 0.2)} Z" fill="#fff" stroke="${K}" stroke-width="0.4" stroke-linejoin="round"/>` +
    `<rect x="${f(-s * 0.24)}" y="${f(s * 0.17)}" width="${f(s * 0.48)}" height="${f(s * 0.26)}" rx="${f(s * 0.06)}" fill="#fff" stroke="${K}" stroke-width="0.4"/>` +
    `<ellipse cx="${f(-s * 0.16)}" cy="${f(-s * 0.06)}" rx="${f(s * 0.11)}" ry="${f(s * 0.12)}" fill="${K}"/><ellipse cx="${f(s * 0.16)}" cy="${f(-s * 0.06)}" rx="${f(s * 0.11)}" ry="${f(s * 0.12)}" fill="${K}"/>` +
    `<path d="M0 ${f(s * 0.05)} L${f(s * 0.05)} ${f(s * 0.14)} L${f(-s * 0.05)} ${f(s * 0.14)} Z" fill="${K}"/>` +
    [-0.12, 0, 0.12].map(k => line(s * k, s * 0.2, s * k, s * 0.42, 0.25)).join('');
  const bone = len => { const e = len / 2, r = Math.max(0.5, len * 0.07); return line(-e + r, 0, e - r, 0, r * 1.3) + [[-e + r, -r * 0.7], [-e + r, r * 0.7], [e - r, -r * 0.7], [e - r, r * 0.7]].map(([x, y]) => circle(x, y, r * 0.75, K)).join(''); };

  const FRAMES = {
    'filete-duplo': { name: 'Filete duplo', cat: 'classica', draw: (w, h, t) => rect(0.4, 0.4, w - 0.8, h - 0.8, 0.8) + rect(t * 0.5, t * 0.5, w - t, h - t, 0.35) },
    'cantos-classicos': { name: 'Cantos clássicos', cat: 'classica', draw: (w, h, t) => {
      const i = t * 0.45;
      return rect(i, i, w - 2 * i, h - 2 * i, 0.45) + corners(w, h, () => {
        const s = t * 1.3;
        return `<path d="M${f(i)} ${f(i + s)} A${f(s)} ${f(s)} 0 0 0 ${f(i + s)} ${f(i)}" fill="none" stroke="${K}" stroke-width="0.5"/><path d="M${f(i)} ${f(i + s * 0.62)} A${f(s * 0.62)} ${f(s * 0.62)} 0 0 0 ${f(i + s * 0.62)} ${f(i)}" fill="none" stroke="${K}" stroke-width="0.35"/><rect x="${f(i - 1.3)}" y="${f(i - 1.3)}" width="2.6" height="2.6" fill="${K}" transform="rotate(45 ${f(i)} ${f(i)})"/><circle cx="${f(i + s * 0.42)}" cy="${f(i + s * 0.42)}" r="0.7" fill="${K}"/>`;
      });
    } },
    'art-deco': { name: 'Art déco', cat: 'classica', draw: (w, h, t) => {
      const a = t * 0.2, b = t * 0.55, st = t * 0.9;
      const path = k => `M${f(k + st)} ${f(k)} H${f(w - k - st)} V${f(k + st * 0.5)} H${f(w - k - st * 0.5)} V${f(k + st)} H${f(w - k)} V${f(h - k - st)} H${f(w - k - st * 0.5)} V${f(h - k - st * 0.5)} H${f(w - k - st)} V${f(h - k)} H${f(k + st)} V${f(h - k - st * 0.5)} H${f(k + st * 0.5)} V${f(h - k - st)} H${f(k)} V${f(k + st)} H${f(k + st * 0.5)} V${f(k + st * 0.5)} H${f(k + st)} Z`;
      let fan = '';
      return `<path d="${path(a)}" fill="none" stroke="${K}" stroke-width="0.7"/><path d="${path(b)}" fill="none" stroke="${K}" stroke-width="0.3"/>` + corners(w, h, () => { fan = ''; for (let k = 0; k < 5; k++) { const ang = (k / 4) * Math.PI / 2; fan += `<line x1="${f(a)}" y1="${f(a)}" x2="${f(a + Math.cos(ang) * st * 0.8)}" y2="${f(a + Math.sin(ang) * st * 0.8)}" stroke="${K}" stroke-width="0.3"/>`; } return fan; });
    } },
    'vinhetas': { name: 'Vinhetas', cat: 'classica', draw: (w, h, t) => {
      const i = t * 0.5, d = Math.min(3.6, t * 0.6);
      const dia = () => `<rect x="${f(-d / 2)}" y="${f(-d / 2)}" width="${f(d)}" height="${f(d)}" fill="#fff" stroke="${K}" stroke-width="0.45" transform="translate(0 ${f(i)}) rotate(45)"/><circle cx="0" cy="${f(i)}" r="${f(d * 0.18)}" fill="${K}"/>`;
      return rect(i, i, w - 2 * i, h - 2 * i, 0.45) + mids(w, h, dia) + corners(w, h, () => `<g transform="translate(${f(i)} 0)">${dia()}</g>`);
    } },
    'pontilhado': { name: 'Pontilhado com rosetas', cat: 'classica', draw: (w, h, t) => {
      const i = t * 0.5;
      let s = rect(i, i, w - 2 * i, h - 2 * i, 0.75, ' stroke-dasharray="0.01 1.6" stroke-linecap="round"');
      s += corners(w, h, () => { let p = ''; const r = Math.min(3.4, t * 0.55); for (let k = 0; k < 8; k++) p += `<ellipse cx="${f(i)}" cy="${f(i - r * 0.55)}" rx="${f(r * 0.22)}" ry="${f(r * 0.5)}" fill="${K}" transform="rotate(${k * 45} ${f(i)} ${f(i)})"/>`; return p + `<circle cx="${f(i)}" cy="${f(i)}" r="${f(r * 0.25)}" fill="#fff" stroke="${K}" stroke-width="0.2"/>`; });
      return s;
    } },
    'grossa-fina': { name: 'Grossa e fina', cat: 'classica', draw: (w, h, t) => {
      const sw = Math.max(1.1, t * 0.24);
      return rect(sw / 2, sw / 2, w - sw, h - sw, f(sw)) + rect(sw + t * 0.25, sw + t * 0.25, w - 2 * (sw + t * 0.25), h - 2 * (sw + t * 0.25), 0.4);
    } },
    'linhas-cruzadas': { name: 'Linhas cruzadas', cat: 'classica', draw: (w, h, t) => {
      const a = t * 0.25, b = t * 0.65, e = t * 0.2;
      return `<path d="M${f(-e)} ${f(a)} H${f(w + e)} M${f(-e)} ${f(h - a)} H${f(w + e)} M${f(a)} ${f(-e)} V${f(h + e)} M${f(w - a)} ${f(-e)} V${f(h + e)}" stroke="${K}" stroke-width="0.55"/><path d="M0 ${f(b)} H${f(w)} M0 ${f(h - b)} H${f(w)} M${f(b)} 0 V${f(h)} M${f(w - b)} 0 V${f(h)}" stroke="${K}" stroke-width="0.3"/>`;
    } },
    'ornamental': { name: 'Ornamental', cat: 'classica', draw: (w, h, t) => {
      const i = t * 0.55;
      let s = rect(i, i, w - 2 * i, h - 2 * i, 0.4);
      const wave = (len, y) => { let d = `M0 ${f(y)}`; const step = 4; for (let x = 0; x <= len; x += step) d += ` Q${f(x + step / 4)} ${f(y - t * 0.22)} ${f(x + step / 2)} ${f(y)} T${f(x + step)} ${f(y)}`; return d; };
      s += `<path d="${wave(w - 2 * t, 0)}" transform="translate(${f(t)} ${f(i * 0.45)})" fill="none" stroke="${K}" stroke-width="0.4"/><path d="${wave(w - 2 * t, 0)}" transform="translate(${f(t)} ${f(h - i * 0.45)})" fill="none" stroke="${K}" stroke-width="0.4"/>`;
      s += `<path d="${wave(h - 2 * t, 0)}" transform="translate(${f(i * 0.45)} ${f(t)}) rotate(90)" fill="none" stroke="${K}" stroke-width="0.4"/><path d="${wave(h - 2 * t, 0)}" transform="translate(${f(w - i * 0.45)} ${f(t)}) rotate(90)" fill="none" stroke="${K}" stroke-width="0.4"/>`;
      s += corners(w, h, () => `<circle cx="${f(i * 0.5)}" cy="${f(i * 0.5)}" r="${f(t * 0.38)}" fill="none" stroke="${K}" stroke-width="0.45"/><circle cx="${f(i * 0.5)}" cy="${f(i * 0.5)}" r="${f(t * 0.14)}" fill="${K}"/>`);
      return s;
    } },

    // ---------------------------------------------------------------- vitorianas (faixa larga, imersivas)
    'vitoriano-arabesco': { name: 'Vitoriano · arabescos', cat: 'vitoriana', wide: true, draw: (w, h, t) => {
      const a = 1.7, c = (a + t - 0.3) / 2, k = (t - 0.3 - a) / 2;
      let s = rect(0.5, 0.5, w - 1, h - 1, 1.1) + rect(a, a, w - 2 * a, h - 2 * a, 0.3) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.45);
      s += sides(w, h, L => {
        let o = '';
        // volutas que saem dos cantos e se enrolam
        [[t * 0.9, 1], [L - t * 0.9, -1]].forEach(([x0, d]) => {
          o += `<path d="M${f(x0)} ${f(c)} C${f(x0 + d * t * 0.6)} ${f(c - k * 0.9)} ${f(x0 + d * t * 1.2)} ${f(c + k * 0.9)} ${f(x0 + d * t * 1.8)} ${f(c)} S${f(x0 + d * t * 2.6)} ${f(c - k * 0.8)} ${f(x0 + d * t * 2.9)} ${f(c)}" fill="none" stroke="${K}" stroke-width="0.45" stroke-linecap="round"/>`;
          o += spiral(x0 + d * t * 2.9 + d * k * 0.5, c, k * 0.55, 1.4, d, 0.4, Math.PI * (d > 0 ? 1 : 0));
          o += `<ellipse cx="${f(x0 + d * t * 1.2)}" cy="${f(c - k * 0.55)}" rx="${f(k * 0.45)}" ry="${f(k * 0.18)}" transform="rotate(${-25 * d} ${f(x0 + d * t * 1.2)} ${f(c - k * 0.55)})" fill="${K}"/>`;
        });
        // flor no meio do lado entre duas volutas
        o += spiral(L / 2 - k * 1.6, c, k * 0.7, 1.3, -1, 0.4, 0) + spiral(L / 2 + k * 1.6, c, k * 0.7, 1.3, 1, 0.4, Math.PI);
        o += `<path d="M${f(L / 2)} ${f(c - k * 0.95)} L${f(L / 2 + k * 0.5)} ${f(c)} L${f(L / 2)} ${f(c + k * 0.95)} L${f(L / 2 - k * 0.5)} ${f(c)} Z" fill="${K}"/>`;
        // pérolas no restante do lado
        for (let x = t * 4.4; x < L - t * 4.4; x += 2.6) if (Math.abs(x - L / 2) > k * 3.2) o += circle(x, c, 0.32, K);
        return o;
      });
      s += corners(w, h, () => [0, 90, 45, 135].map(r => `<ellipse cx="${f(c)}" cy="${f(c)}" rx="${f(k * 0.22)}" ry="${f(k * 0.75)}" transform="rotate(${r} ${f(c)} ${f(c)})" fill="${r % 90 ? '#fff' : K}" stroke="${K}" stroke-width="0.25"/>`).join('') + circle(c, c, k * 0.22, '#fff', 0.3));
      return s;
    } },
    'vitoriano-filigrana': { name: 'Vitoriano · filigrana', cat: 'vitoriana', wide: true, draw: (w, h, t) => {
      const c = t / 2, a = t * 0.17;
      let s = rect(0.5, 0.5, w - 1, h - 1, 0.7) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.3);
      s += sides(w, h, L => {
        const x0 = t * 1.05, x1 = L - t * 1.05, n = Math.max(2, Math.round((x1 - x0) / Math.max(6, t * 1.15))), P = (x1 - x0) / n;
        const pts = [];
        for (let x = x0; x <= x1 + 0.01; x += 0.7) pts.push([x, c + a * Math.sin((x - x0) / P * 2 * Math.PI)]);
        let o = `<path d="${at(pts)}" fill="none" stroke="${K}" stroke-width="0.45"/>`;
        for (let i = 0; i < n; i++) {
          const xa = x0 + P * (i + 0.25), xb = x0 + P * (i + 0.75);
          o += `<ellipse cx="${f(xa + P * 0.08)}" cy="${f(c - a * 1.55)}" rx="${f(P * 0.17)}" ry="${f(t * 0.07)}" transform="rotate(-30 ${f(xa + P * 0.08)} ${f(c - a * 1.55)})" fill="${K}"/>`;
          o += spiral(xb + P * 0.1, c + a * 1.6, t * 0.11, 1.2, 1, 0.3, Math.PI);
        }
        return o;
      });
      s += corners(w, h, () => circle(c, c, t * 0.34, '#fff', 0.5) + [0, 60, 120].map(r => `<ellipse cx="${f(c)}" cy="${f(c)}" rx="${f(t * 0.07)}" ry="${f(t * 0.25)}" transform="rotate(${r} ${f(c)} ${f(c)})" fill="${K}"/>`).join('') + circle(c, c, t * 0.06, '#fff'));
      return s;
    } },
    'vitoriano-medalhao': { name: 'Vitoriano · medalhões', cat: 'vitoriana', wide: true, draw: (w, h, t) => {
      let s = rect(0.6, 0.6, w - 1.2, h - 1.2, 1.2) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.5) + rect(t - 1.2, t - 1.2, w - 2 * t + 2.4, h - 2 * t + 2.4, 0.25);
      s += sides(w, h, L => { let o = ''; for (let x = t * 1.3; x < L - t * 1.2; x += 1.9) o += circle(x, t * 0.42, 0.42, K); return o; });
      s += mids(w, h, () => `<rect x="${f(-t * 0.42)}" y="${f(t * 0.08)}" width="${f(t * 0.84)}" height="${f(t * 0.68)}" rx="${f(t * 0.34)}" fill="#fff" stroke="${K}" stroke-width="0.5"/>` + circle(0, t * 0.42, t * 0.16, K));
      s += corners(w, h, () => `<rect x="0" y="0" width="${f(t)}" height="${f(t)}" fill="${K}"/>` + [0, 45, 90, 135].map(r => `<ellipse cx="${f(t / 2)}" cy="${f(t / 2)}" rx="${f(t * 0.09)}" ry="${f(t * 0.34)}" transform="rotate(${r} ${f(t / 2)} ${f(t / 2)})" fill="#fff"/>`).join('') + circle(t / 2, t / 2, t * 0.1, K) + circle(t / 2, t / 2, t * 0.05, '#fff'));
      return s;
    } },
    'vitoriano-gotico': { name: 'Vitoriano · gótico', cat: 'vitoriana', wide: true, draw: (w, h, t) => {
      let s = rect(0.5, 0.5, w - 1, h - 1, 0.7) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.5);
      const base = t - 0.9, top = 1.5, aw0 = Math.max(2.4, (base - top) * 0.62);
      s += sides(w, h, L => {
        const x0 = t * 1.05, n = Math.max(1, Math.floor((L - 2 * x0) / aw0)), aw = (L - 2 * x0) / n, rise = Math.min(aw * 0.8, (base - top) * 0.55), spring = top + rise;
        let o = '';
        for (let i = 0; i < n; i++) {
          const x = x0 + i * aw;
          o += `<path d="M${f(x)} ${f(base)} L${f(x)} ${f(spring)} Q${f(x)} ${f(top + rise * 0.15)} ${f(x + aw / 2)} ${f(top)} Q${f(x + aw)} ${f(top + rise * 0.15)} ${f(x + aw)} ${f(spring)} L${f(x + aw)} ${f(base)}" fill="none" stroke="${K}" stroke-width="0.3"/>`;
          o += circle(x + aw / 2, spring + (base - spring) * 0.35, Math.min(aw * 0.16, 0.9), 'none', 0.25);
        }
        return o;
      });
      s += corners(w, h, () => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => circle(t / 2 + dx * t * 0.15, t / 2 + dy * t * 0.15, t * 0.17, '#fff', 0.4)).join('') + circle(t / 2, t / 2, t * 0.07, K));
      return s;
    } },
    'vitoriano-luto': { name: 'Vitoriano · luto', cat: 'vitoriana', wide: true, draw: (w, h, t) => {
      const b = t * 0.42;
      let s = `<path d="M0 0 H${f(w)} V${f(h)} H0 Z M${f(b)} ${f(b)} V${f(h - b)} H${f(w - b)} V${f(b)} Z" fill="${K}" fill-rule="evenodd"/>`;
      s += `<rect x="0.9" y="0.9" width="${f(w - 1.8)}" height="${f(h - 1.8)}" fill="none" stroke="#fff" stroke-width="0.25"/>`;
      s += rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.35);
      s += corners(w, h, () => { const c = b / 2, z = b * 0.34; return `<path d="M${f(c)} ${f(c - z)} L${f(c + z * 0.3)} ${f(c - z * 0.3)} L${f(c + z)} ${f(c)} L${f(c + z * 0.3)} ${f(c + z * 0.3)} L${f(c)} ${f(c + z)} L${f(c - z * 0.3)} ${f(c + z * 0.3)} L${f(c - z)} ${f(c)} L${f(c - z * 0.3)} ${f(c - z * 0.3)} Z" fill="#fff"/>`; });
      s += mids(w, h, () => { const y = b + (t - b) * 0.5, z = (t - b) * 0.3; return `<path d="M0 ${f(y - z)} L${f(z * 0.7)} ${f(y)} L0 ${f(y + z)} L${f(-z * 0.7)} ${f(y)} Z" fill="${K}"/>` + line(0, b, 0, y - z, 0.3); });
      return s;
    } },
    'vitoriano-corda': { name: 'Vitoriano · cordão', cat: 'vitoriana', draw: (w, h, t) => {
      const c = t / 2, r = t * 0.26, st = Math.max(1.1, r * 1.05);
      let s = rect(0.4, 0.4, w - 0.8, h - 0.8, 0.3) + rect(t - 0.4, t - 0.4, w - 2 * t + 0.8, h - 2 * t + 0.8, 0.3);
      s += sides(w, h, L => { let o = ''; for (let x = t * 0.95; x < L - t * 0.9; x += st) o += `<ellipse cx="${f(x)}" cy="${f(c)}" rx="${f(st * 0.85)}" ry="${f(r * 0.48)}" transform="rotate(-38 ${f(x)} ${f(c)})" fill="#fff" stroke="${K}" stroke-width="0.32"/>`; return o; });
      s += corners(w, h, () => circle(c, c, t * 0.36, '#fff', 0.55) + circle(c, c, t * 0.2, 'none', 0.35) + circle(c, c, t * 0.06, K));
      return s;
    } },

    // ---------------------------------------------------------------- terror
    'galhos-secos': { name: 'Galhos secos', cat: 'terror', wide: true, draw: (w, h, t) => {
      const R = rng(7);
      const branch = (x, y, ang, len, wid, depth) => {
        const pts = [[x, y]];
        let o = '';
        const n = Math.max(2, Math.round(len / 1.4));
        for (let i = 0; i < n; i++) {
          ang += (R() - 0.5) * 0.32;
          x += Math.cos(ang) * 1.4; y += Math.sin(ang) * 1.4;
          if (y < 0.4 || y > t - 0.4) { y = Math.max(0.4, Math.min(t - 0.4, y)); ang = -ang; }
          pts.push([x, y]);
          if (depth > 0 && i > 1 && R() < (depth > 1 ? 0.1 : 0.2)) o += branch(x, y, ang + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.5), Math.min(len * (0.2 + R() * 0.2), t * (depth > 1 ? 6 : 2.2)), wid * 0.6, depth - 1);
        }
        // afina em três trechos
        const k = Math.ceil(pts.length / 3);
        for (let j = 0; j < 3; j++) { const seg = pts.slice(j * k, (j + 1) * k + 1); if (seg.length > 1) o = `<path d="${at(seg)}" fill="none" stroke="${K}" stroke-width="${f(Math.max(0.15, wid * (1 - j * 0.33)))}" stroke-linecap="round" stroke-linejoin="round"/>` + o; }
        return o;
      };
      let s = sides(w, h, L => branch(0, t * 0.55, 0.05, L * 0.58, Math.min(1.5, t * 0.15), 2) + branch(L, t * 0.45, Math.PI - 0.05, L * 0.5, Math.min(1.2, t * 0.12), 2));
      s += corners(w, h, () => `<path d="M0 0 Q${f(t * 0.5)} ${f(t * 0.15)} ${f(t * 0.6)} ${f(t * 0.6)} Q${f(t * 0.15)} ${f(t * 0.5)} 0 0 Z" fill="${K}"/>`);
      return s;
    } },
    'arame-farpado': { name: 'Arame farpado', cat: 'terror', draw: (w, h, t) => {
      const c = t / 2, a = t * 0.12, P = Math.max(2.4, t * 0.8), B = Math.max(8, t * 1.7), sp = t * 0.24;
      return sides(w, h, L => {
        const s1 = [], s2 = [];
        for (let x = -t * 0.5; x <= L + t * 0.5; x += 0.6) { s1.push([x, c + a * Math.sin(x / P * 2 * Math.PI)]); s2.push([x, c - a * Math.sin(x / P * 2 * Math.PI)]); }
        let o = `<path d="${at(s1)}" fill="none" stroke="${K}" stroke-width="0.38"/><path d="${at(s2)}" fill="none" stroke="${K}" stroke-width="0.38"/>`;
        for (let x = B * 0.6; x < L - B * 0.3; x += B) {
          o += [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => line(x, c, x + dx * sp * 0.9, c + dy * sp, 0.38)).join('');
          o += `<ellipse cx="${f(x)}" cy="${f(c)}" rx="${f(Math.max(0.6, t * 0.07))}" ry="${f(a * 1.9)}" fill="#fff" stroke="${K}" stroke-width="0.4"/>`;
        }
        return o;
      }) + fixedCorners(w, h, t, () => circle(0, 0, t * 0.16, K) + circle(0, 0, t * 0.07, '#fff'));
    } },
    'adagas': { name: 'Adagas', cat: 'terror', draw: (w, h, t) => {
      let s = rect(0.6, 0.6, w - 1.2, h - 1.2, 0.55) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.3);
      s += mids(w, h, () => `<g transform="translate(0 ${f(t / 2)})">${dagger(t * 3.4, t * 0.26)}</g>`);
      s += corners(w, h, () => `<g transform="translate(${f(t / 2)} ${f(t / 2)}) rotate(45)">${dagger(t * 1.3, t * 0.17)}</g><g transform="translate(${f(t / 2)} ${f(t / 2)}) rotate(-45)">${dagger(t * 1.3, t * 0.17)}</g>`);
      return s;
    } },
    'teia-de-aranha': { name: 'Teias de aranha', cat: 'terror', wide: true, draw: (w, h, t, g) => {
      const R = (t + g) * 1.22;
      let s = rect(t * 0.3, t * 0.3, w - t * 0.6, h - t * 0.6, 0.3);
      s += corners(w, h, () => {
        const ang = [0, 15, 30, 45, 60, 75, 90].map(d => d * Math.PI / 180);
        let o = ang.map(a => line(0, 0, R * Math.cos(a), R * Math.sin(a), 0.3)).join('');
        for (let k = 1; k <= 5; k++) {
          const r = R * k / 5.4;
          let d = '';
          ang.forEach((a, i) => {
            const x = r * Math.cos(a), y = r * Math.sin(a);
            if (!i) { d += `M${f(x)} ${f(y)}`; return; }
            const m = (a + ang[i - 1]) / 2, rc = r * 0.82;
            d += ` Q${f(rc * Math.cos(m))} ${f(rc * Math.sin(m))} ${f(x)} ${f(y)}`;
          });
          o += `<path d="${d}" fill="none" stroke="${K}" stroke-width="0.22"/>`;
        }
        return o;
      });
      // aranha descendo pelo fio, no canto de cima à direita
      const x = w - t * 0.5, y = t * 0.6 + h * 0.16, z = t * 0.16;
      s += line(x, t * 0.4, x, y - z, 0.18);
      s += [-1, 1].map(d => [[-0.9, -1.1], [-1.2, -0.3], [-1.2, 0.5], [-0.9, 1.3]].map(([lx, ly]) => `<path d="M${f(x)} ${f(y)} L${f(x + d * z * 1.3)} ${f(y + ly * z * 0.6)} L${f(x + d * z * 2)} ${f(y + ly * z * 1.2)}" fill="none" stroke="${K}" stroke-width="0.25" stroke-linejoin="round"/>`).join('')).join('');
      s += `<ellipse cx="${f(x)}" cy="${f(y + z * 0.4)}" rx="${f(z * 0.7)}" ry="${f(z)}" fill="${K}"/>` + circle(x, y - z * 0.6, z * 0.45, K);
      return s;
    } },
    'espinhos': { name: 'Espinhos', cat: 'terror', draw: (w, h, t) => {
      const c = t / 2, a = t * 0.16, P = Math.max(5, t * 1.4);
      let s = rect(0.4, 0.4, w - 0.8, h - 0.8, 0.3);
      s += sides(w, h, L => {
        const pts = [];
        for (let x = t * 0.5; x <= L - t * 0.5; x += 0.4) pts.push([x, c + a * Math.sin(x / P * 2 * Math.PI)]);
        let o = `<path d="${at(pts)}" fill="none" stroke="${K}" stroke-width="0.6"/>`;
        let up = 1;
        for (let x = t; x < L - t; x += P / 2) {
          const y = c + a * Math.sin(x / P * 2 * Math.PI), d = up = -up, len = t * 0.28;
          o += `<path d="M${f(x - 0.55)} ${f(y)} L${f(x + 0.4)} ${f(y + d * len)} L${f(x + 0.55)} ${f(y)} Z" fill="${K}"/>`;
        }
        return o;
      });
      s += corners(w, h, () => spiral(t * 0.5, t * 0.5, t * 0.32, 1.5, 1, 0.5, 0));
      return s;
    } },
    'correntes': { name: 'Correntes', cat: 'terror', draw: (w, h, t) => {
      const c = t / 2, Ll = Math.max(2.4, t * 0.95), Lh = t * 0.42, st = Ll * 0.8;
      let s = sides(w, h, L => {
        let o = '', i = 0;
        for (let x = t * 0.95; x < L - t * 0.95 - Ll * 0.5; x += st, i++) {
          o += i % 2 ? line(x - Ll * 0.4, c, x + Ll * 0.4, c, f(Lh * 0.38)) + `<line x1="${f(x - Ll * 0.3)}" y1="${f(c)}" x2="${f(x + Ll * 0.3)}" y2="${f(c)}" stroke="#fff" stroke-width="${f(Lh * 0.1)}" stroke-linecap="round"/>`
            : `<rect x="${f(x - Ll / 2)}" y="${f(c - Lh / 2)}" width="${f(Ll)}" height="${f(Lh)}" rx="${f(Lh / 2)}" fill="none" stroke="${K}" stroke-width="${f(Math.max(0.35, Lh * 0.17))}"/>`;
        }
        return o;
      });
      s += fixedCorners(w, h, t, () => circle(0, 0, t * 0.32, 'none', Math.max(0.5, t * 0.09)));
      return s;
    } },
    'caveiras': { name: 'Caveiras', cat: 'terror', draw: (w, h, t) => {
      let s = rect(0.5, 0.5, w - 1, h - 1, 0.7) + rect(t - 0.3, t - 0.3, w - 2 * t + 0.6, h - 2 * t + 0.6, 0.3);
      s += fixedCorners(w, h, t, () => `<rect x="${f(-t * 0.5)}" y="${f(-t * 0.5)}" width="${f(t)}" height="${f(t)}" fill="#fff"/>` + skull(t * 0.78));
      s += mids(w, h, () => `<g transform="translate(0 ${f(t / 2)})"><rect x="${f(-t * 0.8)}" y="${f(-t * 0.42)}" width="${f(t * 1.6)}" height="${f(t * 0.84)}" fill="#fff"/><g transform="rotate(28)">${bone(t * 1.4)}</g><g transform="rotate(-28)">${bone(t * 1.4)}</g></g>`);
      return s;
    } }
  };
  function svg(id, w, h, t, g) {
    const fr = FRAMES[id];
    if (!fr) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}mm" height="${f(h)}mm" overflow="visible">${fr.draw(w, h, t, g == null ? 3.5 : g)}</svg>`;
  }
  const CATS = [['classica', 'Clássicas'], ['vitoriana', 'Vitorianas'], ['terror', 'Terror']];
  return { FRAMES, CATS, svg, list: () => Object.entries(FRAMES).map(([id, x]) => ({ id, name: x.name, cat: x.cat, wide: !!x.wide })) };
});
