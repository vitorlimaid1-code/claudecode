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

  const FRAMES = {
    'filete-duplo': { name: 'Filete duplo', draw: (w, h, t) => rect(0.4, 0.4, w - 0.8, h - 0.8, 0.8) + rect(t * 0.5, t * 0.5, w - t, h - t, 0.35) },
    'cantos-classicos': { name: 'Cantos clássicos', draw: (w, h, t) => {
      const i = t * 0.45;
      return rect(i, i, w - 2 * i, h - 2 * i, 0.45) + corners(w, h, () => {
        const s = t * 1.3;
        return `<path d="M${f(i)} ${f(i + s)} A${f(s)} ${f(s)} 0 0 0 ${f(i + s)} ${f(i)}" fill="none" stroke="${K}" stroke-width="0.5"/><path d="M${f(i)} ${f(i + s * 0.62)} A${f(s * 0.62)} ${f(s * 0.62)} 0 0 0 ${f(i + s * 0.62)} ${f(i)}" fill="none" stroke="${K}" stroke-width="0.35"/><rect x="${f(i - 1.3)}" y="${f(i - 1.3)}" width="2.6" height="2.6" fill="${K}" transform="rotate(45 ${f(i)} ${f(i)})"/><circle cx="${f(i + s * 0.42)}" cy="${f(i + s * 0.42)}" r="0.7" fill="${K}"/>`;
      });
    } },
    'art-deco': { name: 'Art déco', draw: (w, h, t) => {
      const a = t * 0.2, b = t * 0.55, st = t * 0.9;
      const path = k => `M${f(k + st)} ${f(k)} H${f(w - k - st)} V${f(k + st * 0.5)} H${f(w - k - st * 0.5)} V${f(k + st)} H${f(w - k)} V${f(h - k - st)} H${f(w - k - st * 0.5)} V${f(h - k - st * 0.5)} H${f(w - k - st)} V${f(h - k)} H${f(k + st)} V${f(h - k - st * 0.5)} H${f(k + st * 0.5)} V${f(h - k - st)} H${f(k)} V${f(k + st)} H${f(k + st * 0.5)} V${f(k + st * 0.5)} H${f(k + st)} Z`;
      let fan = '';
      return `<path d="${path(a)}" fill="none" stroke="${K}" stroke-width="0.7"/><path d="${path(b)}" fill="none" stroke="${K}" stroke-width="0.3"/>` + corners(w, h, () => { fan = ''; for (let k = 0; k < 5; k++) { const ang = (k / 4) * Math.PI / 2; fan += `<line x1="${f(a)}" y1="${f(a)}" x2="${f(a + Math.cos(ang) * st * 0.8)}" y2="${f(a + Math.sin(ang) * st * 0.8)}" stroke="${K}" stroke-width="0.3"/>`; } return fan; });
    } },
    'vinhetas': { name: 'Vinhetas', draw: (w, h, t) => {
      const i = t * 0.5, d = Math.min(3.6, t * 0.6);
      const dia = () => `<rect x="${f(-d / 2)}" y="${f(-d / 2)}" width="${f(d)}" height="${f(d)}" fill="#fff" stroke="${K}" stroke-width="0.45" transform="translate(0 ${f(i)}) rotate(45)"/><circle cx="0" cy="${f(i)}" r="${f(d * 0.18)}" fill="${K}"/>`;
      return rect(i, i, w - 2 * i, h - 2 * i, 0.45) + mids(w, h, dia) + corners(w, h, () => `<g transform="translate(${f(i)} 0)">${dia()}</g>`);
    } },
    'pontilhado': { name: 'Pontilhado com rosetas', draw: (w, h, t) => {
      const i = t * 0.5;
      let s = rect(i, i, w - 2 * i, h - 2 * i, 0.75, ' stroke-dasharray="0.01 1.6" stroke-linecap="round"');
      s += corners(w, h, () => { let p = ''; const r = Math.min(3.4, t * 0.55); for (let k = 0; k < 8; k++) p += `<ellipse cx="${f(i)}" cy="${f(i - r * 0.55)}" rx="${f(r * 0.22)}" ry="${f(r * 0.5)}" fill="${K}" transform="rotate(${k * 45} ${f(i)} ${f(i)})"/>`; return p + `<circle cx="${f(i)}" cy="${f(i)}" r="${f(r * 0.25)}" fill="#fff" stroke="${K}" stroke-width="0.2"/>`; });
      return s;
    } },
    'grossa-fina': { name: 'Grossa e fina', draw: (w, h, t) => {
      const sw = Math.max(1.1, t * 0.24);
      return rect(sw / 2, sw / 2, w - sw, h - sw, f(sw)) + rect(sw + t * 0.25, sw + t * 0.25, w - 2 * (sw + t * 0.25), h - 2 * (sw + t * 0.25), 0.4);
    } },
    'linhas-cruzadas': { name: 'Linhas cruzadas', draw: (w, h, t) => {
      const a = t * 0.25, b = t * 0.65, e = t * 0.2;
      return `<path d="M${f(-e)} ${f(a)} H${f(w + e)} M${f(-e)} ${f(h - a)} H${f(w + e)} M${f(a)} ${f(-e)} V${f(h + e)} M${f(w - a)} ${f(-e)} V${f(h + e)}" stroke="${K}" stroke-width="0.55"/><path d="M0 ${f(b)} H${f(w)} M0 ${f(h - b)} H${f(w)} M${f(b)} 0 V${f(h)} M${f(w - b)} 0 V${f(h)}" stroke="${K}" stroke-width="0.3"/>`;
    } },
    'ornamental': { name: 'Ornamental', draw: (w, h, t) => {
      const i = t * 0.55;
      let s = rect(i, i, w - 2 * i, h - 2 * i, 0.4);
      const wave = (len, y) => { let d = `M0 ${f(y)}`; const step = 4; for (let x = 0; x <= len; x += step) d += ` Q${f(x + step / 4)} ${f(y - t * 0.22)} ${f(x + step / 2)} ${f(y)} T${f(x + step)} ${f(y)}`; return d; };
      s += `<path d="${wave(w - 2 * t, 0)}" transform="translate(${f(t)} ${f(i * 0.45)})" fill="none" stroke="${K}" stroke-width="0.4"/><path d="${wave(w - 2 * t, 0)}" transform="translate(${f(t)} ${f(h - i * 0.45)})" fill="none" stroke="${K}" stroke-width="0.4"/>`;
      s += `<path d="${wave(h - 2 * t, 0)}" transform="translate(${f(i * 0.45)} ${f(t)}) rotate(90)" fill="none" stroke="${K}" stroke-width="0.4"/><path d="${wave(h - 2 * t, 0)}" transform="translate(${f(w - i * 0.45)} ${f(t)}) rotate(90)" fill="none" stroke="${K}" stroke-width="0.4"/>`;
      s += corners(w, h, () => `<circle cx="${f(i * 0.5)}" cy="${f(i * 0.5)}" r="${f(t * 0.38)}" fill="none" stroke="${K}" stroke-width="0.45"/><circle cx="${f(i * 0.5)}" cy="${f(i * 0.5)}" r="${f(t * 0.14)}" fill="${K}"/>`);
      return s;
    } }
  };
  function svg(id, w, h, t) {
    const fr = FRAMES[id];
    if (!fr) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}mm" height="${f(h)}mm" overflow="visible">${fr.draw(w, h, t)}</svg>`;
  }
  return { FRAMES, svg, list: () => Object.entries(FRAMES).map(([id, x]) => ({ id, name: x.name })) };
});
