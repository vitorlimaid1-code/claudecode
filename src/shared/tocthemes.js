// Estilos de sumário pré-formatados: fonte, pesos, espaçamento, moldura (simples, dupla, grossa, cantos)
// e faixas imersivas que vão até o corte (com sangria) à direita, à esquerda, no alto, na base, na página
// inteira ou como moldura grossa nos quatro lados. O mesmo CSS serve ao livro (prévia e PDF) e às
// miniaturas da janela de escolha.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TocThemes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const G = (name, label, desc, group, font, base, extra) => Object.assign({ key: name, label, desc, group, font, base }, extra || {});
  const THEMES = [
    G('none', 'Padrão', 'Segue os Estilos de texto do livro', 'Tipografia', '', ''),
    G('grande', 'Clássico grande', 'Garamond grande, título em versalete centrado', 'Tipografia', 'EB Garamond', 'dots'),
    G('grosso', 'Moderno grosso', 'Playfair extra-grosso, números pesados', 'Tipografia', 'Playfair Display', 'plain'),
    G('fino', 'Fino e arejado', 'Cormorant leve, título espaçado, muito respiro', 'Tipografia', 'Cormorant Garamond', 'plain'),
    G('compacto', 'Compacto', 'Crimson menor, linhas próximas, para sumários longos', 'Tipografia', 'Crimson Pro', 'dots'),
    G('editorial', 'Editorial', 'Lora, fio grosso sob o título, número à esquerda', 'Tipografia', 'Lora', 'numleft'),
    G('centrado', 'Centrado', 'Baskerville, cada capítulo centralizado com o número ao lado', 'Tipografia', 'Libre Baskerville', 'inline'),
    G('espacado', 'Bem espaçado', 'Merriweather leve, fios entre os capítulos', 'Tipografia', 'Merriweather', 'plain'),
    G('moldura-simples', 'Moldura simples', 'Fio fino ao redor do sumário', 'Moldura', 'EB Garamond', 'dots'),
    G('moldura-dupla', 'Moldura dupla', 'Fio duplo clássico', 'Moldura', 'Libre Baskerville', 'dots'),
    G('moldura-grossa', 'Moldura grossa', 'Borda larga na cor escolhida', 'Moldura', 'Playfair Display', 'plain'),
    G('moldura-cantos', 'Cantoneiras', 'Só os cantos marcados, elegante e leve', 'Moldura', 'Cormorant Garamond', 'plain'),
    G('imersa-direita', 'Faixa à direita', 'Faixa larga até o corte na lateral direita', 'Imersiva', 'Cormorant Garamond', 'plain'),
    G('imersa-esquerda', 'Faixa à esquerda', 'Faixa larga até o corte na lateral esquerda', 'Imersiva', 'Lora', 'numleft'),
    G('imersa-topo', 'Faixa no alto', 'Faixa até o corte no alto, com o título em branco', 'Imersiva', 'Playfair Display', 'plain'),
    G('imersa-base', 'Faixa na base', 'Faixa até o corte embaixo', 'Imersiva', 'EB Garamond', 'dots'),
    G('imersa-moldura', 'Moldura imersiva', 'Moldura grossa que chega ao corte nos quatro lados', 'Imersiva', 'Libre Baskerville', 'dots'),
    G('imersa-total', 'Página escura', 'Página inteira na cor, letras claras', 'Imersiva', 'Cormorant Garamond', 'plain')
  ];
  const byKey = k => THEMES.find(t => t.key === k) || THEMES[0];
  const ff = f => `"${f}", "EB Garamond", Georgia, serif`;
  const mm = v => `${(Math.round(v * 100) / 100)}mm`;

  // g: { mt, mb, mi, mo, bleed, contentH, color }; pre: prefixo dos seletores (miniaturas da janela)
  function css(key, g, pre) {
    const t = byKey(key);
    if (t.key === 'none') return '';
    pre = pre || '';
    const S = `${pre}.toc.tt-${t.key}`;
    const PG = `${pre}.pagedjs_page:has(.toc.tt-${t.key})`;
    // cor escrita direto (o paginador descarta var() dentro de bordas e degradês)
    const C = /^#[0-9a-f]{3,8}$/i.test(g.color || '') ? g.color : '#1d1d24';
    const out = [];
    if (t.font) out.push(`${S} .toc-heading, ${S} .toc-list { font-family: ${ff(t.font)}; }`);
    // molduras finas: contorno do bloco (só pintura, a mancha inteira)
    const bl = g.bleed || 0;
    // Faixas imersivas: desenhadas na própria página (fora das colunas do paginador, que cortariam ou
    // empurrariam para outra coluna o que passasse da mancha), do corte + sangria até perto do texto.
    // E: margens da esquerda/direita daquela página (ímpar: lombada à esquerda; par: à direita).
    const PB = side => `${PG.replace('.pagedjs_page:', `.pagedjs_page.pagedjs_${side}_page:`)} .pagedjs_pagebox::after`;
    const deco = fn => {
      out.push(`${PB('right')} { content: ''; position: absolute; pointer-events: none; ${fn({ l: g.mi, r: g.mo })} }`);
      out.push(`${PB('left')} { content: ''; position: absolute; pointer-events: none; ${fn({ l: g.mo, r: g.mi })} }`);
    };
    const full = `${S} { min-height: ${mm(g.contentH - 2)}; box-sizing: border-box; }`;
    // números de página e cabeçalhos ficam por cima das faixas, em branco
    const lightFolio = `${PG} .pagedjs_margin { position: relative; z-index: 2; color: #fff; }`;
    switch (t.key) {
      case 'grande':
        out.push(`${S} .toc-heading { font-size: 2.3em; font-weight: 400; font-variant: small-caps; letter-spacing: 0.12em; text-align: center; margin-bottom: 12mm; }
${S} .toc-list { font-size: 1.24em; line-height: 1.3; }
${S} .toc-list li { margin-bottom: 0.55em; }`);
        break;
      case 'grosso':
        out.push(`${S} .toc-heading { font-size: 2.6em; font-weight: 900; letter-spacing: -0.01em; text-align: left; line-height: 1; margin-bottom: 11mm; }
${S} .toc-list { font-size: 1.08em; font-weight: 700; }
${S} .toc-list li { margin-bottom: 0.6em; }
${S} .toc-page { font-weight: 900; }
${S} .toc-label { font-weight: 400; font-variant: normal; }`);
        break;
      case 'fino':
        out.push(`${S} .toc-heading { font-size: 2.1em; font-weight: 300; text-transform: uppercase; letter-spacing: 0.32em; text-align: center; margin-bottom: 14mm; }
${S} .toc-list { font-size: 1.22em; font-weight: 300; }
${S} .toc-list li { margin-bottom: 0.95em; }
${S} .toc-label { letter-spacing: 0.12em; }`);
        break;
      case 'compacto':
        out.push(`${S} .toc-heading { font-size: 1.35em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; text-align: left; padding-bottom: 2mm; border-bottom: 0.5pt solid currentColor; margin-bottom: 5mm; }
${S} .toc-list { font-size: 0.92em; line-height: 1.22; }
${S} .toc-list li { margin-bottom: 0.12em; }`);
        break;
      case 'editorial':
        out.push(`${S} .toc-heading { font-size: 2em; font-weight: 700; text-align: left; padding-bottom: 3mm; border-bottom: 2.4pt solid ${C}; margin-bottom: 8mm; }
${S} .toc-list li { margin: 0; padding: 0.42em 0; border-bottom: 0.4pt solid #c9c9cf; }
${S} .toc-page { color: ${C}; font-weight: 700; }`);
        break;
      case 'centrado':
        out.push(`${S} .toc-heading { font-size: 1.6em; font-style: italic; font-weight: 400; text-align: center; margin-bottom: 12mm; }
${S} .toc-list { text-align: center; }
${S} .toc-list li { margin-bottom: 1em; padding-left: 0 !important; }
${S} .toc-list a { display: block; text-align: center; }
${S} .toc-label { display: block; margin: 0 0 0.15em; font-size: 0.72em; letter-spacing: 0.22em; text-transform: uppercase; font-variant: normal; }
${S} .toc-title { max-width: none; }
${S} .toc-dots { display: inline; border: 0; margin: 0; transform: none; }
${S} .toc-dots::before { content: " · "; opacity: 0.8; }
${S} .toc-page { display: inline; min-width: 0; }`);
        break;
      case 'espacado':
        out.push(`${S} .toc-heading { font-size: 1.8em; font-weight: 900; text-align: left; margin-bottom: 10mm; }
${S} .toc-list { font-size: 0.95em; font-weight: 300; }
${S} .toc-list li { margin: 0; padding: 0.75em 0; border-top: 0.4pt solid #bdbdc4; }
${S} .toc-list li:last-child { border-bottom: 0.4pt solid #bdbdc4; }
${S} .toc-page { font-weight: 900; }`);
        break;
      case 'moldura-simples': case 'moldura-dupla': case 'moldura-grossa': case 'moldura-cantos': {
        out.push(full);
        const gap = Math.min(g.mt, g.mb, g.mi, g.mo) * 0.42;
        if (t.key === 'moldura-cantos') {
          // cantoneiras: desenhadas no próprio bloco (com respiro interno)
          const c = `linear-gradient(${C}, ${C})`;
          out.push(`${S} { padding: 4mm 6mm; background-image: ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => c).join(', ')}; background-repeat: no-repeat; background-position: left top, left top, right top, right top, left bottom, left bottom, right bottom, right bottom; background-size: 11mm 0.9pt, 0.9pt 11mm, 11mm 0.9pt, 0.9pt 11mm, 11mm 0.9pt, 0.9pt 11mm, 11mm 0.9pt, 0.9pt 11mm; }
${S} .toc-heading { font-weight: 300; text-transform: uppercase; letter-spacing: 0.3em; text-align: center; font-size: 1.8em; margin-top: 6mm; }
${S} .toc-list { font-size: 1.15em; }
${S} .toc-list li { margin-bottom: 0.7em; }`);
        } else {
          const ol = t.key === 'moldura-simples' ? '0.6pt solid #000' : t.key === 'moldura-dupla' ? '2.6pt double #000' : `3.4pt solid ${C}`;
          out.push(`${S} { padding: 0 5mm; outline: ${ol}; outline-offset: ${mm(gap)}; }
${S} .toc-heading { text-align: center; margin-top: 6mm; ${t.key === 'moldura-grossa' ? 'font-weight: 700; font-size: 2em;' : 'font-size: 1.8em; letter-spacing: 0.06em;'} }`);
        }
        break;
      }
      case 'imersa-direita': case 'imersa-esquerda': {
        const right = t.key === 'imersa-direita';
        // faixa do corte até 4 mm da mancha (direita: margem externa na página ímpar, lombada na par)
        deco(E => `top: -${mm(bl)}; bottom: -${mm(bl)}; ${right ? 'right' : 'left'}: -${mm(bl)}; width: ${mm(bl + Math.max(3, (right ? E.r : E.l) - 4))}; background: ${C};`);
        out.push(`${S} .toc-heading { color: ${C}; text-align: ${right ? 'left' : 'right'}; font-size: 2.3em; font-weight: ${right ? 300 : 700}; ${right ? 'letter-spacing: 0.08em;' : ''} margin-bottom: 11mm; }
${S} .toc-list li { margin-bottom: 0.6em; }
${S} .toc-page { color: ${C}; font-weight: 700; }`);
        break;
      }
      case 'imersa-topo': {
        const hh = 26;
        deco(() => `top: -${mm(bl)}; left: -${mm(bl)}; right: -${mm(bl)}; height: ${mm(bl + g.mt + hh)}; background: ${C};`);
        out.push(`${S} .toc-heading { color: #fff; margin: 0 0 11mm; height: ${mm(hh)}; box-sizing: border-box; display: flex; align-items: flex-end; padding-bottom: 6mm; font-size: 2.4em; font-weight: 900; letter-spacing: 0.01em; }
${S} .toc-list li { margin-bottom: 0.55em; }`);
        break;
      }
      case 'imersa-base': {
        const hh = 12;
        out.push(full);
        out.push(`${S} { padding-bottom: ${mm(hh + 4)}; }`);
        deco(() => `bottom: -${mm(bl)}; left: -${mm(bl)}; right: -${mm(bl)}; height: ${mm(bl + g.mb + hh)}; background: ${C};`);
        out.push(lightFolio);
        out.push(`${S} .toc-heading { font-size: 2.2em; font-variant: small-caps; letter-spacing: 0.1em; text-align: center; margin-bottom: 12mm; }
${S} .toc-list li { margin-bottom: 0.5em; }`);
        break;
      }
      case 'imersa-moldura': {
        // moldura grossa do corte até 5 mm da mancha, nos quatro lados
        out.push(`${S} { padding: 0 3mm; }`);
        deco(E => `top: -${mm(bl)}; bottom: -${mm(bl)}; left: -${mm(bl)}; right: -${mm(bl)}; box-sizing: border-box; border: solid ${C}; border-width: ${mm(bl + Math.max(3, g.mt - 5))} ${mm(bl + Math.max(3, E.r - 5))} ${mm(bl + Math.max(3, g.mb - 5))} ${mm(bl + Math.max(3, E.l - 5))};`);
        out.push(lightFolio);
        out.push(`${S} .toc-heading { text-align: center; font-size: 1.9em; margin-top: 6mm; margin-bottom: 10mm; }
${S} .toc-list li { margin-bottom: 0.5em; }`);
        break;
      }
      case 'imersa-total': {
        deco(() => `top: -${mm(bl)}; bottom: -${mm(bl)}; left: -${mm(bl)}; right: -${mm(bl)}; background: ${C};`);
        out.push(lightFolio);
        out.push(`${S}, ${S} .toc-list, ${S} .toc-list a, ${S} .toc-label, ${S} .toc-page { color: #f4efe6; }
${S} .toc-heading { color: #fff; text-align: center; font-size: 2.4em; font-weight: 300; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 14mm; }
${S} .toc-list { font-size: 1.15em; }
${S} .toc-list li { margin-bottom: 0.8em; }
${S} .toc-dots { opacity: 0.5; }`);
        break;
      }
    }
    return out.join('\n');
  }
  const COLORS = ['#1d1d24', '#0f2a44', '#3b1f2b', '#1f3a2e', '#7a1f1f', '#8a6a2a', '#4b2a6b'];
  return { THEMES, byKey, css, COLORS };
});
