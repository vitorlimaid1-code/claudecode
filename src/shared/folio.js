/*
 * Visual do número da página: forma (bloco, naipes, coração, estrela, círculo, caixa…) com o número
 * por dentro. Usado na paginação (CSS do livro) e na galeria de escolha da interface.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FolioShapes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // path num quadro de 100 × 100; ty = onde o número fica (centro vertical, em %), fs = escala da letra
  const SHAPES = [
    { key: 'plain', label: 'Só o número', css: true },
    { key: 'block', label: 'Bloco', css: true },
    { key: 'rounded', label: 'Bloco arredondado', css: true },
    { key: 'pill', label: 'Cápsula', css: true },
    { key: 'circle', label: 'Círculo', css: true },
    { key: 'box', label: 'Caixa (contorno)', css: true, outline: true },
    { key: 'ring', label: 'Anel (contorno)', css: true, outline: true },
    { key: 'spade', label: 'Espadas ♠', d: 'M50 4 C35 24 6 38 6 60 C6 76 22 84 36 76 C40 74 43 71 45 68 C44 80 40 89 32 96 L68 96 C60 89 56 80 55 68 C57 71 60 74 64 76 C78 84 94 76 94 60 C94 38 65 24 50 4 Z', ty: 54, fs: 0.82 },
    { key: 'heart', label: 'Copas ♥', d: 'M50 92 C30 74 4 58 4 34 C4 18 16 6 30 6 C40 6 46 12 50 20 C54 12 60 6 70 6 C84 6 96 18 96 34 C96 58 70 74 50 92 Z', ty: 44, fs: 0.86 },
    { key: 'diamond', label: 'Ouros ♦', d: 'M50 2 L92 50 L50 98 L8 50 Z', ty: 50, fs: 0.8 },
    { key: 'club', label: 'Paus ♣', d: 'M50 4 C38 4 30 13 30 24 C30 30 32 34 35 38 C31 36 27 35 23 35 C12 35 4 44 4 55 C4 67 13 75 24 75 C33 75 40 70 45 63 C44 77 40 87 32 96 L68 96 C60 87 56 77 55 63 C60 70 67 75 76 75 C87 75 96 67 96 55 C96 44 88 35 77 35 C73 35 69 36 65 38 C68 34 70 30 70 24 C70 13 62 4 50 4 Z', ty: 50, fs: 0.74 },
    { key: 'star', label: 'Estrela', d: 'M50 3 L62 36 L97 37 L69 58 L79 92 L50 72 L21 92 L31 58 L3 37 L38 36 Z', ty: 55, fs: 0.7 },
    { key: 'hexagon', label: 'Hexágono', d: 'M27 5 L73 5 L96 50 L73 95 L27 95 L4 50 Z', ty: 50, fs: 0.9 },
    { key: 'shield', label: 'Escudo', d: 'M10 6 L90 6 L90 46 C90 72 70 88 50 96 C30 88 10 72 10 46 Z', ty: 45, fs: 0.86 },
    { key: 'flower', label: 'Flor', d: 'M50 4 C60 4 66 14 64 24 C72 16 86 18 90 28 C94 38 86 46 76 48 C86 52 94 60 90 72 C86 82 72 84 64 76 C66 86 60 96 50 96 C40 96 34 86 36 76 C28 84 14 82 10 72 C6 60 14 52 24 48 C14 46 6 38 10 28 C14 18 28 16 36 24 C34 14 40 4 50 4 Z', ty: 50, fs: 0.78 },
    { key: 'drop', label: 'Gota', d: 'M50 3 C62 22 86 44 86 64 C86 84 70 97 50 97 C30 97 14 84 14 64 C14 44 38 22 50 3 Z', ty: 64, fs: 0.82 }
  ];
  const byKey = k => SHAPES.find(s => s.key === k) || SHAPES[0];
  function svgUrl(shape, fill) {
    const s = byKey(shape);
    if (!s.d) return '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${s.d}" fill="${fill}"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }
  // declaração CSS do número (vai no ::after da caixa de margem). o: { shape, bg, fg, size (mm), font }
  function decl(o) {
    const s = byKey(o.shape);
    const size = Math.max(4, Math.min(16, Number(o.size) || 7));
    const bg = o.bg || '#000000', fg = o.fg || '#ffffff';
    if (s.key === 'plain') return '';
    const base = `display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: ${size}mm; height: ${size}mm; line-height: 1; font-weight: 600; font-variant-numeric: lining-nums tabular-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact;`;
    if (s.key === 'block') return `${base} padding: 0 1.2mm; background: ${bg}; color: ${fg};`;
    if (s.key === 'rounded') return `${base} padding: 0 1.2mm; background: ${bg}; color: ${fg}; border-radius: 1.2mm;`;
    if (s.key === 'pill') return `${base} padding: 0 2mm; background: ${bg}; color: ${fg}; border-radius: ${size}mm;`;
    if (s.key === 'circle') return `${base} width: ${size}mm; background: ${bg}; color: ${fg}; border-radius: 50%;`;
    if (s.key === 'box') return `${base} padding: 0 1.2mm; border: 0.6pt solid ${bg}; color: ${bg};`;
    if (s.key === 'ring') return `${base} width: ${size}mm; border: 0.6pt solid ${bg}; color: ${bg}; border-radius: 50%;`;
    const big = size * 1.25;
    return `${base} width: ${big}mm; min-width: ${big}mm; height: ${big}mm; ${s.ty >= 50 ? 'padding-top' : 'padding-bottom'}: ${(Math.abs(s.ty - 50) * big / 50).toFixed(2)}mm; background: ${svgUrl(s.key, bg)} center / 100% 100% no-repeat; color: ${fg}; font-size: ${(s.fs || 0.8).toFixed(2)}em;`;
  }
  return { SHAPES, decl, svgUrl, byKey };
});
