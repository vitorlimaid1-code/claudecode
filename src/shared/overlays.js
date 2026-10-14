// Caixas de texto e legendas sobre as imagens: modelos prontos (fonte, cor, tamanho e estilo próprios).
// Os tamanhos usam cqw (% da largura da imagem): a caixa acompanha a imagem em qualquer tamanho.
// align: 'stretch' (largura dada por left/right no css), 'left', 'right' ou 'center' (centralizada).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Overlays = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const sh = 'text-shadow: 0 0.3cqw 1.4cqw rgba(0,0,0,0.75);';
  const P = (key, label, kind, font, align, y, rot, text, css) => ({ key, label, kind, font, align, y, rot, text, css });
  const LEG = 'Legenda da imagem';
  const BOX = 'Um texto curto que comenta ou explica a imagem.';
  const PRESETS = [
    P('legenda-faixa', 'Faixa escura', 'legenda', 'Josefin Sans', 'stretch', 90, 0, LEG, `left: 0; right: 0; background: rgba(0,0,0,0.62); color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 3.1cqw; padding: 2.2cqw 4cqw; text-align: center;`),
    P('legenda-italica', 'Itálico sobre a foto', 'legenda', 'Cormorant Garamond', 'stretch', 88, 0, LEG, `left: 6%; right: 6%; color: #fff; font-style: italic; font-size: 4.6cqw; text-align: center; ${sh}`),
    P('legenda-lateral', 'Com fio lateral', 'legenda', 'Lora', 'left', 84, 0, LEG, `left: 5%; max-width: 58%; color: #fff; font-size: 3.4cqw; border-left: 0.6cqw solid #fff; padding: 0.4cqw 0 0.4cqw 2.6cqw; ${sh}`),
    P('etiqueta', 'Etiqueta', 'legenda', 'Montserrat', 'left', 9, 0, 'Destaque', `left: 5%; background: #7c3aed; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; font-size: 2.6cqw; padding: 1.4cqw 2.8cqw; border-radius: 0.6cqw;`),
    P('contorno', 'Contorno branco', 'legenda', 'Josefin Sans', 'center', 50, 0, 'Título', `border: 0.4cqw solid #fff; color: #fff; text-transform: uppercase; letter-spacing: 0.3em; font-size: 3.6cqw; padding: 2.5cqw 5cqw; ${sh}`),
    P('titulo-grande', 'Título grande', 'legenda', 'Playfair Display', 'stretch', 46, 0, 'Título da imagem', `left: 6%; right: 6%; color: #fff; font-weight: 900; font-size: 9cqw; line-height: 1; text-align: center; text-shadow: 0 0.5cqw 2.5cqw rgba(0,0,0,0.6);`),
    P('caixa-branca', 'Caixa branca', 'caixa', 'Lora', 'left', 28, 0, BOX, `left: 7%; width: 46%; background: #fff; color: #1a1a1a; font-size: 3.2cqw; line-height: 1.35; padding: 3.5cqw 4cqw; box-shadow: 0 1cqw 3cqw rgba(0,0,0,0.25);`),
    P('caixa-preta', 'Caixa preta', 'caixa', 'Playfair Display', 'right', 28, 0, BOX, `right: 7%; width: 46%; background: #111; color: #f4efe6; font-size: 3.5cqw; line-height: 1.3; padding: 4cqw;`),
    P('vidro', 'Vidro claro', 'caixa', 'Montserrat', 'stretch', 82, 0, BOX, `left: 7%; right: 7%; background: rgba(255,255,255,0.8); color: #1d1d24; font-size: 3cqw; line-height: 1.4; padding: 3cqw 4cqw; border-radius: 1.2cqw;`),
    P('citacao', 'Citação', 'caixa', 'Cormorant Garamond', 'stretch', 50, 0, 'Uma frase marcante sobre a imagem.', `left: 10%; right: 10%; color: #fff; font-style: italic; font-size: 6cqw; line-height: 1.15; text-align: center; ${sh}`),
    P('nota-amarela', 'Nota adesiva', 'caixa', 'Lora', 'right', 26, 4, 'Anotação à mão.', `right: 7%; width: 36%; background: #fde68a; color: #3a2e00; font-style: italic; font-size: 3.2cqw; line-height: 1.3; padding: 3.5cqw; box-shadow: 0 1cqw 2cqw rgba(0,0,0,0.25);`),
    P('carimbo', 'Carimbo', 'caixa', 'Josefin Sans', 'center', 24, -10, 'Aprovado', `border: 0.7cqw double #b42318; color: #b42318; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; font-size: 4cqw; padding: 1.6cqw 4cqw; background: rgba(255,255,255,0.55);`),
    P('faixa-diagonal', 'Faixa diagonal', 'caixa', 'Montserrat', 'stretch', 50, -8, 'Edição especial', `left: -10%; right: -10%; background: #b42318; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.25em; font-size: 3cqw; padding: 1.6cqw; text-align: center;`)
  ];
  const byKey = k => PRESETS.find(p => p.key === k) || null;
  const clamp = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  // posição de uma caixa: altura (0 = topo, 100 = base da imagem) e rotação em graus
  function placeStyle(p, y, rot) {
    const tx = p && p.align === 'center' ? '-50%' : '0';
    return `top: ${clamp(y, 0, 100, 50)}%; transform: translate(${tx}, -50%) rotate(${clamp(rot, -180, 180, 0)}deg);${p && p.align === 'center' ? ' left: 50%;' : ''}`;
  }
  // CSS de todos os modelos (prefixo opcional, para as miniaturas da tela)
  function css(pre) {
    pre = pre || '';
    return [`${pre}.fig-frame { container-type: inline-size; }`,
      `${pre}.fig-ov { position: absolute; z-index: 2; box-sizing: border-box; line-height: 1.3; white-space: pre-line; pointer-events: none; text-indent: 0; hyphens: none; }`]
      .concat(PRESETS.map(p => `${pre}.fig-ov.ov-${p.key} { font-family: "${p.font}", "EB Garamond", Georgia, serif; ${p.css} }`))
      .concat([`${pre}.fig-ov.ov-citacao::before { content: "“"; }`, `${pre}.fig-ov.ov-citacao::after { content: "”"; }`]).join('\n');
  }
  return { PRESETS, byKey, placeStyle, css, clamp };
});
