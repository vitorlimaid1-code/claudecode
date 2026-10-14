// Filete sob o cabeçalho das páginas (título do livro / autor): estilos da galeria.
// decl() devolve a aparência da linha (sem posição); o livro e as miniaturas da galeria usam o mesmo.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HeaderRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const RULES = [
    { key: 'none', label: 'Sem filete' },
    { key: 'fina', label: 'Linha fina' },
    { key: 'espessa', label: 'Linha marcada' },
    { key: 'dupla', label: 'Dupla' },
    { key: 'grossa-fina', label: 'Grossa e fina' },
    { key: 'fina-grossa', label: 'Fina e grossa' },
    { key: 'pontilhada', label: 'Pontilhada' },
    { key: 'tracejada', label: 'Tracejada' },
    { key: 'degrade', label: 'Esvaecida (mais forte na lombada)' },
    { key: 'ornamento', label: 'Fina com ornamento ◆' },
    { key: 'curta', label: 'Curta, centralizada' }
  ];
  const r2 = v => Math.round(v * 100) / 100;
  // side: 'left' (página par) ou 'right' (ímpar) — o esvaecido fica forte do lado da lombada
  function decl(key, C, w, side) {
    w = Math.max(0.2, Math.min(3, Number(w) || 0.5));
    switch (key) {
      case 'fina': return `height: ${r2(w)}pt; background: ${C};`;
      case 'espessa': return `height: ${r2(Math.max(1.2, w * 2.4))}pt; background: ${C};`;
      case 'dupla': return `height: ${r2(w * 2 + 1.4)}pt; border-top: ${r2(w)}pt solid ${C}; border-bottom: ${r2(w)}pt solid ${C}; box-sizing: border-box;`;
      case 'grossa-fina': { const t = Math.max(1.4, w * 3); return `height: ${r2(t + w + 1.3)}pt; border-top: ${r2(t)}pt solid ${C}; border-bottom: ${r2(w)}pt solid ${C}; box-sizing: border-box;`; }
      case 'fina-grossa': { const t = Math.max(1.4, w * 3); return `height: ${r2(t + w + 1.3)}pt; border-top: ${r2(w)}pt solid ${C}; border-bottom: ${r2(t)}pt solid ${C}; box-sizing: border-box;`; }
      case 'pontilhada': return `height: 0; border-top: ${r2(Math.max(0.8, w * 1.6))}pt dotted ${C};`;
      case 'tracejada': return `height: 0; border-top: ${r2(Math.max(0.6, w * 1.2))}pt dashed ${C};`;
      case 'degrade': return `height: ${r2(Math.max(0.6, w * 1.4))}pt; background: linear-gradient(to ${side === 'left' ? 'right' : 'left'}, rgba(255,255,255,0), ${C} 70%);`;
      case 'ornamento': return `height: ${r2(w)}pt; background: ${C};`;
      case 'curta': return `height: ${r2(w)}pt; background: ${C};`;
      default: return '';
    }
  }
  return { RULES, decl };
});
