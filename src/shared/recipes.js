/*
 * Modelo de receitas: reconhece “Ingredientes”, “Modo de preparo”, rendimento/tempo e dicas no texto de
 * cada capítulo e estiliza tudo na paginação — cada ingrediente com o ícone do que ele é, cada passo
 * numerado com o ícone da ação (misturar, assar, cortar…). O texto do livro não muda: as marcas são só de
 * apresentação (classes e ícones desenhados ao lado), então a edição direta nas páginas continua igual.
 * Usado na paginação (book.js, Node e navegador) e na galeria de ícones da interface.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Recipes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------------------------------------------------------------- ícones (traço fino, quadro 24 × 24)
  const P = (d) => `<path d="${d}"/>`;
  const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const ICONS = {
    // ingredientes
    egg: P('M12 3c3.6 0 6.5 5.4 6.5 10.2A6.5 6.5 0 0 1 12 20a6.5 6.5 0 0 1-6.5-6.8C5.5 8.4 8.4 3 12 3Z') + P('M9.2 14.5a3 3 0 0 0 2.6 2.4'),
    flour: P('M7 8h10l1.5 12.5h-13Z') + P('M7 8c0-2 1.5-3.5 2.5-4h5c1 .5 2.5 2 2.5 4') + P('M10 13h4M12 11v4'),
    sugar: P('M5 9.5 12 5l7 4.5v8L12 22l-7-4.5Z') + P('M5 9.5 12 14l7-4.5M12 14v8'),
    salt: P('M8.5 9h7l1 12h-9Z') + P('M8.5 9c0-3 1.5-5.5 3.5-5.5s3.5 2.5 3.5 5.5') + C(11, 6, 0.4) + C(13, 6.2, 0.4) + C(12, 4.8, 0.4),
    pepper: P('M9 10h6l-.8 11h-4.4Z') + P('M9.5 10V7.5h5V10') + P('M12 7.5V3.5M10 3.5h4'),
    milk: P('M8 7h8v13.5H8Z') + P('M8 7l1.5-3.5h5L16 7') + P('M8 11h8'),
    cream: P('M6 11h12l-1.5 9h-9Z') + P('M6 11c.5-2.5 2.5-4 6-4s5.5 1.5 6 4') + P('M10 7c0-1.5 1-2.5 2-3 1 .5 2 1.5 2 3'),
    can: P('M7 5.5h10v14H7Z') + P('M7 5.5c0-1 2.2-1.5 5-1.5s5 .5 5 1.5M7 19.5c0 1 2.2 1.5 5 1.5s5-.5 5-1.5') + P('M7 10h10M7 15h10'),
    butter: P('M4 14.5 9.5 9h10.5v5.5l-5.5 4.5H4Z') + P('M4 14.5h10.5V19M14.5 14.5 20 9'),
    oil: P('M10 3h4v3l2 3v12H8V9l2-3Z') + P('M8 13h8') + P('M12 15.5c1 1 1.4 1.8 1.4 2.4a1.4 1.4 0 0 1-2.8 0c0-.6.4-1.4 1.4-2.4Z'),
    cheese: P('M3.5 16 15 6.5l5.5 4.5v7.5H3.5Z') + P('M3.5 16h17') + C(9, 13.5, 1) + C(15, 12, 0.8) + C(16.5, 16, 0.6),
    water: P('M12 3.5c3.2 4.3 5.5 7.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-3 2.3-6.2 5.5-10.5Z') + P('M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5'),
    ice: P('M6 6h12v12H6Z') + P('M9 9l6 6M15 9l-6 6'),
    garlic: P('M12 3.5c0 2.2 6 4.5 6 10a6 6 0 0 1-12 0c0-5.5 6-7.8 6-10Z') + P('M12 7c-2 2.5-2.5 6-2 13M12 7c2 2.5 2.5 6 2 13'),
    onion: P('M12 4c4.5 3 7 6 7 10a7 7 0 0 1-14 0c0-4 2.5-7 7-10Z') + P('M12 4v-1.5M9.5 9c-1.5 2-2 4-1.5 7M14.5 9c1.5 2 2 4 1.5 7M12 9v11'),
    tomato: C(12, 13.5, 7) + P('M8.5 7c1.5 1 2.5 1.2 3.5 1.2S14 8 15.5 7M12 8.2V5M12 5c1-1 2-1.3 3-1.2'),
    bellpepper: P('M8 8c-2 0-3 2.5-3 6 0 4 2 7 4 7 1 0 1.5-.5 3-.5s2 .5 3 .5c2 0 4-3 4-7 0-3.5-1-6-3-6-1.2 0-2 .6-4 .6S9.2 8 8 8Z') + P('M12 8.6V6c0-1.5 1-2.5 2.5-2.5'),
    chili: P('M5 19c6 0 12-5 13-12') + P('M18 7c-1 4-5 9-11 11.5') + P('M18 7c0-1.5.5-2.5 1.5-3'),
    carrot: P('M15.5 8.5 5 19.5c-.5.5 0 1 .5.5L16.5 9.5Z') + P('M15.5 8.5c1-1 2.5-1 3 0s.5 2-1 2.5') + P('M17 7l2-3M17.5 9l3.5-1M16 6.5l-.5-3.5') + P('M9 15l1.5 1.5M11.5 12.5 13 14'),
    potato: P('M6 9c2-3.5 9-5 12-1.5 2.5 3 1 9-3.5 10.5S4 17 4.5 13c.2-1.6.7-2.8 1.5-4Z') + C(9.5, 11, 0.5) + C(14, 10.5, 0.5) + C(12.5, 15, 0.5),
    corn: P('M12 3c2.5 2 3.5 5 3.5 9s-1 7-3.5 9c-2.5-2-3.5-5-3.5-9s1-7 3.5-9Z') + P('M9 9h6M8.6 12h6.8M9 15h6M12 4v16') + P('M8.5 13c-2 1-3 3.5-3 6.5 2.5 0 4.5-.5 6.5-1.5'),
    beans: P('M6 13c-2-3 1-7 4-5 1.5 1 3 .5 4 0 3-1.5 5.5 2.5 3.5 5s-5 3-7 3-3.5-1-4.5-3Z') + P('M10 11.5c.8.8 2.5 1 3.5.3'),
    rice: P('M4 11h16a8 8 0 0 1-16 0Z') + P('M8 11c.5-1.5 1.5-2.2 2-2.2M12.5 8.5 13 11M15.5 9l.5 2M9.5 6.5l.5 1.5M14 5.5l-.3 1.6'),
    pasta: P('M4 11h16a8 8 0 0 1-16 0Z') + P('M7 11c1-3 3-3 3 0s2 3 3 0 3-3 4 0') + P('M15 3 11 9M18 4l-4 6'),
    bread: P('M4 11c0-3.5 3.5-6 8-6s8 2.5 8 6c0 1-.7 1.5-1.5 1.5V19h-13v-6.5C4.7 12.5 4 12 4 11Z') + P('M9 9l1.5 1.5M12.5 8.5 14 10'),
    meat: P('M15 4c3.5 0 5.5 3 5 6.5-.6 4.5-5 9.5-11 9.5-3.5 0-5.5-2-5.5-4.5C3.5 11 9 4 15 4Z') + C(14.5, 9.5, 1.6) + P('M8 16c2 0 5-2 6.5-4.5'),
    pork: P('M5 12a7 6 0 1 0 14 0 7 6 0 1 0-14 0Z') + P('M10 12.5a2 1.5 0 1 0 4 0 2 1.5 0 1 0-4 0') + C(11.3, 12.5, 0.3) + C(12.7, 12.5, 0.3) + P('M7 7.5 6 4.5l3 1.8M17 7.5l1-3-3 1.8'),
    chicken: P('M14.5 4.5a5 5 0 0 1 3.5 8.5c-2 2-4 2-5.5 3.5l-2.5 2.5') + P('M14.5 4.5a5 5 0 0 0-5 5c0 1.5.5 2.5 1.5 3.5') + P('M10 19l-1.5 1.5a1.5 1.5 0 1 1-2-2l-1.5-.5a1.5 1.5 0 1 1 2-2L8.5 17'),
    fish: P('M3 12c3-4 7-5.5 10.5-5 3 .5 5 2.5 6.5 5-1.5 2.5-3.5 4.5-6.5 5C10 17.5 6 16 3 12Z') + P('M3 12l-1-3M3 12l-1 3') + C(16, 11, 0.6) + P('M11 8.5c-.8 1-1.2 2.2-1.2 3.5s.4 2.5 1.2 3.5'),
    shrimp: P('M17 5c-5 0-10 3.5-10 9 0 3 2 5 4.5 5 2 0 3.5-1.5 3.5-3.5S13.5 12 12 12') + P('M17 5c1.5 0 3 1 3 2.5S18.5 10 17 10c-2 0-4 1-5 2') + P('M9 10.5l2 1.5M8 14h2.5M9 17.5l2-1.5') + P('M17 5c1-1.5 2.5-2 4-2'),
    herb: P('M12 21V9') + P('M12 9c0-3 2-5.5 5-6 .5 3-1.5 6-5 6Z') + P('M12 14c0-3-2-5.5-5-6-.5 3 1.5 6 5 6Z') + P('M12 18c0-2 1.5-3.5 3.5-4 .3 2-1 4-3.5 4Z'),
    leaf: P('M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z') + P('M5 19 14 10M9 15h3.5M11 13v-3'),
    lemon: P('M4.5 12c0-4 3.5-7 7.5-7s7.5 3 7.5 7-3.5 7-7.5 7-7.5-3-7.5-7Z') + P('M4.5 12 3 11.3M19.5 12l1.5-.7') + P('M9 9.5c1.2-.8 2.4-1 3.5-.8'),
    orange: C(12, 13, 7) + P('M12 6V4M12 6c1.5-1.5 3.5-2 5-1.5-1 1.5-3 2-5 1.5') + C(10, 11, 0.4) + C(14, 12, 0.4) + C(12, 15, 0.4),
    apple: P('M12 7.5c-1-1-2.5-1.5-4-1.5-3 0-4.5 2.5-4.5 6 0 4.5 3 9 5.5 9 1.2 0 1.8-.6 3-.6s1.8.6 3 .6c2.5 0 5.5-4.5 5.5-9 0-3.5-1.5-6-4.5-6-1.5 0-3 .5-4 1.5Z') + P('M12 7.5V5c0-1 .5-1.8 1.5-2.2') + P('M12.5 5c1.5 0 3-.5 3.5-2'),
    banana: P('M5 6c-1 6 2 12.5 9 13.5 3 .4 5-.5 6-1.5-3 .5-6-.5-8.5-3S6.5 9 7 5.5Z') + P('M5 6l.5-2.5 1.5 2'),
    berry: P('M12 8c4.5 0 6.5 2.5 6 6-.6 4-3.5 7-6 7s-5.4-3-6-7c-.5-3.5 1.5-6 6-6Z') + P('M8.5 8 12 5l3.5 3M12 5V3') + C(10, 12, 0.4) + C(14, 12, 0.4) + C(12, 15, 0.4) + C(10.5, 17.5, 0.4) + C(13.5, 17.5, 0.4),
    grape: C(9, 9, 2) + C(13, 9, 2) + C(11, 12.5, 2) + C(15, 12.5, 2) + C(9, 16, 2) + C(13, 16, 2) + C(11, 19.5, 1.6) + P('M11 7V3.5c1.5 0 3 .5 3.5 1.5'),
    coconut: C(12, 12.5, 7.5) + C(12, 12.5, 4.5) + P('M10 8.3h.01M14 8.3h.01M12 10.5h.01'),
    pineapple: P('M7.5 13.5c0-3 2-5 4.5-5s4.5 2 4.5 5-1.5 7.5-4.5 7.5-4.5-4.5-4.5-7.5Z') + P('M8.5 11l7 7M15.5 11l-7 7') + P('M12 8.5 9 3.5l3 2 3-2-3 5'),
    avocado: P('M12 3c3 0 4.5 4 5.5 8 1 4.5-1.5 9.5-5.5 9.5S5.5 15.5 6.5 11C7.5 7 9 3 12 3Z') + C(12, 14.5, 2.6),
    fruit: P('M12 7c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7Z') + P('M12 7V4M12 5.5c1.3-1.5 3-2 4.5-1.5-1 1.6-2.8 2.2-4.5 1.5'),
    nut: P('M12 3.5c4 0 7 3.5 7 8.5s-3 8.5-7 8.5-7-3.5-7-8.5 3-8.5 7-8.5Z') + P('M12 3.5v17M8.5 8.5c1 .5 2 .5 3.5 0M12.5 15.5c1.5-.5 2.5-.5 3.5 0M8 13.5c1.2.4 2.5.4 4 0'),
    chocolate: P('M6 3.5h12v17H6Z') + P('M6 9.2h12M6 14.8h12M12 3.5v17'),
    coffee: P('M5 9h11v5a5.5 5.5 0 0 1-11 0Z') + P('M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16') + P('M8 3.5c-.8 1 .8 2 0 3M11 3.5c-.8 1 .8 2 0 3M4 21h14'),
    tea: P('M5 10h11v4a5.5 5.5 0 0 1-11 0Z') + P('M16 11.5h1.5a2 2 0 0 1 0 4H16') + P('M10.5 10V5.5M10.5 5.5h2v2.5h-2') + P('M4 21h14'),
    honey: P('M7 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z') + P('M8 9V6.5h8V9M7 13h10') + P('M17.5 3.5 13 7.5'),
    vanilla: P('M6 20C9 14 13 8 19 4') + P('M8 20c3-5 7-10.5 12.5-14.5') + P('M17 7.5c-.5-1 0-2 1-2.3'),
    cinnamon: P('M5 8.5 16.5 20M8.5 5 20 16.5') + P('M5 8.5a2.5 2.5 0 0 1 3.5-3.5M16.5 20a2.5 2.5 0 0 0 3.5-3.5') + P('M6.5 7l.5.5'),
    yeast: P('M6 9h12v11H6Z') + P('M6 9l1.5-4.5h9L18 9') + C(10, 14, 1.2) + C(14, 13, 0.8) + C(13, 17, 0.9),
    gelatin: P('M5 18h14l-2-9H7Z') + P('M7 9c0-2 2.2-3 5-3s5 1 5 3') + P('M4 20h16') + P('M9 13h6'),
    yogurt: P('M6 8h12l-1.5 12.5h-9Z') + P('M5.5 8h13') + P('M7.5 8c0-2 1.5-3.5 4.5-3.5S16.5 6 16.5 8') + P('M9 13c1 1 2 1 3 0s2-1 3 0'),
    wine: P('M8 3.5h8c0 4-1 7.5-4 7.5S8 7.5 8 3.5Z') + P('M12 11v8.5M8.5 20.5h7') + P('M8.3 6.5h7.4'),
    sauce: P('M10 3.5h4v3.5l2.5 3.5v10.5h-9V10.5L10 7Z') + P('M7.5 14h9M10 3.5h4'),
    mushroom: P('M4 12c0-4.5 3.5-8 8-8s8 3.5 8 8Z') + P('M9.5 12v6a2.5 2.5 0 0 0 5 0v-6') + C(9, 8.5, 0.6) + C(14.5, 7.5, 0.6),
    olive: P('M9 8c3-1 6 1.5 6.5 5S13 20 10 20.5 4 18.5 4 14s2-5.5 5-6Z') + P('M15.5 9.5c1.5-3 3.5-5 5-5.5') + C(9.5, 13, 1.2),
    squash: P('M10 6c-4 1-6 4-6 8 0 4 3.5 7 8 7s8-3 8-7c0-4-2-7-6-8') + P('M10 6c.5-1.5 1.5-2.5 2-2.5s1.5 1 2 2.5') + P('M12 6v14.5M8 8.5c-1 3-1 7 1 11M16 8.5c1 3 1 7-1 11'),
    broccoli: C(9, 8.5, 3) + C(15, 8.5, 3) + C(12, 6, 3) + P('M10.5 11 11 20h2l.5-9') + P('M7 11.5c1 .8 2.5 1 3.5.5M17 11.5c-1 .8-2.5 1-3.5.5'),
    ginger: P('M5 15c0-2 2-3 3.5-2.5L10 9c.5-1.5 2.5-2 3.5-.5l1 1.5c1.5-.5 3 0 3.5 1.5s-.5 3-2 3l-2.5 1c-1 2-3.5 3-5.5 2l-1 .5C5.5 17.5 5 16.5 5 15Z') + P('M10 9 9.5 6M14.5 10l1.5-2'),
    seeds: P('M7 8c1-1.5 3-1.5 3 .5S8 11 7 10s-.6-1.4 0-2Z') + P('M14 6c1-1.5 3-1.5 3 .5S15 9 14 8s-.6-1.4 0-2Z') + P('M10 15c1-1.5 3-1.5 3 .5S11 18 10 17s-.6-1.4 0-2Z') + P('M16.5 14c1-1.5 3-1.5 3 .5s-2 2.5-3 1.5-.6-1.4 0-2Z') + P('M4.5 16c1-1.5 3-1.5 3 .5S5.5 19 4.5 18s-.6-1.4 0-2Z'),
    grain: P('M12 21V8') + P('M12 8c-2-1-2.5-3-1.5-5 2 1 2.5 3 1.5 5ZM12 12c-2.5-.5-3.5-2.5-3-4.5 2.5.5 3.5 2.5 3 4.5ZM12 12c2.5-.5 3.5-2.5 3-4.5-2.5.5-3.5 2.5-3 4.5ZM12 16c-2.5-.5-3.5-2.5-3-4.5 2.5.5 3.5 2.5 3 4.5ZM12 16c2.5-.5 3.5-2.5 3-4.5-2.5.5-3.5 2.5-3 4.5Z'),
    bowl: P('M3.5 11h17a8.5 8.5 0 0 1-17 0Z') + P('M8 20.5h8') + P('M14 11c.5-3 2.5-5.5 5-6.5'),
    // ações do modo de preparo
    whisk: P('M14.5 9.5 21 3') + P('M14.5 9.5c-2.5-2.5-7-1.5-9 1.5s-1.5 7 1 9 6.5 1 8.5-2 2-6-.5-8.5Z') + P('M14.5 9.5c-3 0-7 4-7 7M14.5 9.5c0 3-4 7-7 7'),
    oven: P('M4 4h16v16H4Z') + P('M4 8.5h16') + P('M7 12h10v5H7Z') + C(7.5, 6.3, 0.5) + C(10, 6.3, 0.5) + C(12.5, 6.3, 0.5),
    pot: P('M4.5 10h15v7a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3Z') + P('M3 10h18M2.5 12.5h2M19.5 12.5h2') + P('M9 6.5c-.6.8.6 1.6 0 2.5M12 5.5c-.6.8.6 1.6 0 2.5M15 6.5c-.6.8.6 1.6 0 2.5'),
    pan: C(10, 13, 6.5) + C(10, 13, 3.5) + P('M16.3 10.5 22 7'),
    grill: P('M4 9h16a8 8 0 0 1-16 0Z') + P('M8 9v8M12 9v8M16 9v8') + P('M7 17l-2 4M17 17l2 4') + P('M9 3.5c-.6.8.6 1.6 0 2.5M13 3.5c-.6.8.6 1.6 0 2.5'),
    knife: P('M20 4 8.5 15.5l-2-2L18 2Z') + P('M8.5 15.5 5 19a1.4 1.4 0 0 1-2-2l3.5-3.5'),
    grater: P('M8 3.5h8l1.5 17h-11Z') + P('M10 3.5V2h4v1.5') + P('M10 9h1M13 9h1M10 12.5h1M13 12.5h1M10 16h1M13 16h1'),
    blender: P('M7 3.5h10l-1.5 10h-7Z') + P('M8.5 13.5h7l1 7h-9Z') + C(12, 17, 1) + P('M12 3.5V2'),
    fridge: P('M6 2.5h12v19H6Z') + P('M6 9h12M9 5.5v1.5M9 12v3'),
    snow: P('M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9') + P('M10 4.5 12 6l2-1.5M10 19.5 12 18l2 1.5'),
    clock: C(12, 12, 8.5) + P('M12 7v5l3.5 2'),
    plate: C(12, 13, 7) + C(12, 13, 4) + P('M3 4v5a1.5 1.5 0 0 0 3 0V4M4.5 9v11.5M20 4c-1.5 1-2 3-2 6h2v10.5'),
    sieve: P('M3 9h14a7 7 0 0 1-14 0Z') + P('M17 9.5 22 7') + P('M6.5 12.5h7M7.5 15h5') + P('M10 19v2M8 20l-.5 1.5M12 20l.5 1.5'),
    pour: P('M4 12l6-6 6 6-6 6Z') + P('M16 12h2.5c1 0 1.5.5 1.5 1.5V20') + P('M20 20.5h.01'),
    brush: P('M15 3l6 6-6.5 6.5-6-6Z') + P('M8.5 9.5 3 15c-1 1-1 3 1 4s3 1 4 0l5.5-5.5'),
    rollingpin: P('M7 9.5 14.5 17a2 2 0 0 0 2.8-2.8L9.8 6.7A2 2 0 0 0 7 9.5Z') + P('M8.4 8.1 4 3.7M15.9 15.6l4.4 4.4'),
    flame: P('M12 21c-3.5 0-6-2.5-6-6 0-4 3.5-6 4-11 2.5 2 3.5 4 3.5 6.5 1-.5 1.8-1.7 2-3 1.5 1.5 2.5 4 2.5 7.5 0 3.5-2.5 6-6 6Z') + P('M12 21c-1.5 0-2.5-1-2.5-2.5 0-1.8 1.5-2.5 2.5-4.5 1 2 2.5 2.7 2.5 4.5 0 1.5-1 2.5-2.5 2.5Z'),
    tray: P('M3 10h18l-1.5 7h-15Z') + P('M3 10V8h18v2') + P('M7 13.5h10'),
    lid: P('M4 15h16') + P('M5 15a7 7 0 0 1 14 0') + P('M10.5 8V6.5h3V8') + P('M5 19h14'),
    sparkle: P('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z') + P('M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z'),
    microwave: P('M3 5h18v14H3Z') + P('M5.5 7.5h10v9h-10Z') + P('M18.5 8h.01M18.5 11h.01M18 15h1'),
    hands: P('M7 21v-5l-3-4.5c-.6-1 .5-2 1.4-1.3L7.5 13V5.5a1 1 0 0 1 2 0V11') + P('M9.5 10V4.5a1 1 0 0 1 2 0V10M11.5 10V5.5a1 1 0 0 1 2 0V11M13.5 11V7.5a1 1 0 0 1 2 0V15c0 3-1.5 6-4.5 6H7'),
    chef: P('M7 14.5V20h10v-5.5') + P('M7 14.5A4 4 0 0 1 6 7a4.5 4.5 0 0 1 6-3 4.5 4.5 0 0 1 6 3 4 4 0 0 1-1 7.5Z') + P('M7 17h10'),
    // cabeçalhos e dados
    basket: P('M3 10h18l-2 10H5Z') + P('M7 10l4-6M17 10l-4-6') + P('M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5'),
    people: C(9, 8, 3) + P('M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6') + C(16.5, 9, 2.3) + P('M15.5 14.3c3 0 5 2 5 5'),
    gauge: P('M4 17a8 8 0 1 1 16 0') + P('M12 17l3.5-5') + P('M7 17h.01M17 17h.01M12 9h.01'),
    tip: P('M9 18h6M10 21h4') + P('M12 3a6 6 0 0 1 3.5 10.9c-.8.6-1.5 1.5-1.5 2.6V17h-4v-.5c0-1.1-.7-2-1.5-2.6A6 6 0 0 1 12 3Z')
  };
  const LABELS = { egg: 'Ovos', flour: 'Farinhas', sugar: 'Açúcar', salt: 'Sal', pepper: 'Especiarias', milk: 'Leite', cream: 'Creme', can: 'Enlatados', butter: 'Manteiga', oil: 'Óleo e azeite', cheese: 'Queijos', water: 'Água', ice: 'Gelo', garlic: 'Alho', onion: 'Cebola', tomato: 'Tomate', bellpepper: 'Pimentão', chili: 'Pimenta', carrot: 'Cenoura', potato: 'Batata e raízes', corn: 'Milho', beans: 'Grãos', rice: 'Arroz', pasta: 'Massas', bread: 'Pães', meat: 'Carne', pork: 'Porco e embutidos', chicken: 'Aves', fish: 'Peixes', shrimp: 'Frutos do mar', herb: 'Ervas', leaf: 'Folhas', lemon: 'Limão', orange: 'Laranja', apple: 'Maçã', banana: 'Banana', berry: 'Frutas vermelhas', grape: 'Uva', coconut: 'Coco', pineapple: 'Abacaxi', avocado: 'Abacate', fruit: 'Frutas', nut: 'Castanhas', chocolate: 'Chocolate', coffee: 'Café', tea: 'Chá', honey: 'Mel e caldas', vanilla: 'Baunilha', cinnamon: 'Canela', yeast: 'Fermento', gelatin: 'Gelatina', yogurt: 'Iogurte', wine: 'Bebidas', sauce: 'Molhos', mushroom: 'Cogumelos', olive: 'Azeitona', squash: 'Abóbora e legumes', broccoli: 'Brócolis', ginger: 'Gengibre', seeds: 'Sementes', grain: 'Cereais', bowl: 'Outros', whisk: 'Misturar', oven: 'Assar', pot: 'Cozinhar', pan: 'Fritar e refogar', grill: 'Grelhar', knife: 'Cortar', grater: 'Ralar', blender: 'Bater no liquidificador', fridge: 'Geladeira', snow: 'Congelar', clock: 'Tempo', plate: 'Servir', sieve: 'Peneirar e escorrer', pour: 'Juntar e despejar', brush: 'Untar e pincelar', rollingpin: 'Abrir a massa', flame: 'Fogo', tray: 'Forma', lid: 'Tampar', sparkle: 'Decorar', microwave: 'Micro-ondas', hands: 'Sovar e modelar', chef: 'Preparo', basket: 'Ingredientes', people: 'Rendimento', gauge: 'Dificuldade', tip: 'Dica' };

  // ---------------------------------------------------------------- palavras → ícone (sem acentos, minúsculas)
  const ING = {
    egg: 'ovo ovos gema gemas clara claras ovo caipira ovos caipiras',
    flour: 'farinha farinhas trigo amido maisena amido de milho fuba polvilho tapioca farinha de mandioca farofa semolina',
    sugar: 'acucar acucares adocante demerara mascavo cristal refinado confeiteiro',
    salt: 'sal sal grosso flor de sal sal marinho',
    pepper: 'pimenta-do-reino pimenta do reino pimenta paprica colorau cominho curry acafrao curcuma noz-moscada noz moscada cravo cravo-da-india pimenta-da-jamaica erva-doce anis especiarias tempero temperos chimichurri',
    milk: 'leite leite integral leite desnatado leite em po leite vegetal leite de amendoas',
    cream: 'creme de leite nata chantilly chantili creme fresco creme azedo creme de confeiteiro',
    can: 'leite condensado lata enlatado conserva milho em conserva ervilha em conserva',
    butter: 'manteiga margarina banha gordura vegetal manteiga ghee ghee',
    oil: 'oleo azeite azeite de oliva oleo de coco oleo vegetal gordura',
    cheese: 'queijo queijos parmesao mussarela mucarela ricota cream cheese requeijao gorgonzola provolone catupiry brie cheddar minas coalho prato pecorino mascarpone',
    water: 'agua agua fervente agua morna agua gelada caldo caldo de legumes caldo de galinha caldo de carne',
    ice: 'gelo cubos de gelo',
    garlic: 'alho alhos dente de alho dentes de alho',
    onion: 'cebola cebolas cebola roxa alho-poro alho poro echalota chalota',
    tomato: 'tomate tomates tomatinho tomate-cereja molho de tomate extrato de tomate polpa de tomate passata',
    bellpepper: 'pimentao pimentoes',
    chili: 'pimenta dedo-de-moca dedo de moca malagueta pimenta biquinho jalapeno pimenta calabresa',
    carrot: 'cenoura cenouras beterraba rabanete nabo',
    potato: 'batata batatas batata-doce batata doce mandioca aipim macaxeira inhame cara mandioquinha baroa',
    corn: 'milho milho verde pipoca canjica espiga',
    beans: 'feijao feijoes lentilha lentilhas grao-de-bico grao de bico ervilha ervilhas soja fava vagem',
    rice: 'arroz arroz arborio arroz integral risoto',
    pasta: 'macarrao massa massas espaguete talharim penne lasanha nhoque fusilli fettuccine ravioli capeletti parafuso',
    bread: 'pao paes torrada torradas farinha de rosca croissant brioche baguete bisnaguinha biscoito biscoitos bolacha bolachas',
    meat: 'carne carnes patinho alcatra picanha file mignon contrafile costela acem musculo carne moida bife bifes cupim maminha fraldinha lagarto coxao carne seca charque cordeiro',
    pork: 'porco suino bacon linguica calabresa presunto salsicha pancetta paio toucinho lombo lombo de porco pernil copa salame mortadela',
    chicken: 'frango galinha peito de frango coxa coxas sobrecoxa sobrecoxas asa asas peru chester pato codorna',
    fish: 'peixe peixes salmao atum bacalhau tilapia sardinha merluza pescada robalo truta anchova anchovas linguado',
    shrimp: 'camarao camaroes lagosta siri caranguejo lula polvo marisco mariscos mexilhao mexilhoes ostra ostras vieira',
    herb: 'salsa salsinha cebolinha coentro manjericao hortela alecrim tomilho oregano louro folha de louro salvia cheiro-verde cheiro verde endro dill estragao manjerona ervas finas ervas',
    leaf: 'alface rucula agriao espinafre couve repolho acelga folhas folha chicoria radicchio endivia',
    lemon: 'limao limoes lima raspas de limao suco de limao limao-siciliano limao siciliano',
    orange: 'laranja laranjas tangerina mexerica bergamota suco de laranja',
    apple: 'maca macas pera peras',
    banana: 'banana bananas',
    berry: 'morango morangos framboesa framboesas amora amoras mirtilo mirtilos blueberry frutas vermelhas cereja cerejas acai',
    grape: 'uva uvas passas uva-passa uvas-passas',
    coconut: 'coco leite de coco coco ralado agua de coco',
    pineapple: 'abacaxi',
    avocado: 'abacate',
    fruit: 'fruta frutas manga maracuja mamao goiaba pessego pessegos caqui kiwi figo figos melao melancia ameixa ameixas damasco tamaras jaca pitanga acerola',
    nut: 'nozes noz castanha castanhas castanha-do-para castanha-de-caju amendoim amendoas pistache avela avelas macadamia pecan',
    chocolate: 'chocolate chocolates cacau achocolatado nutella granulado gotas de chocolate brigadeiro',
    coffee: 'cafe expresso',
    tea: 'cha cha-verde cha preto',
    honey: 'mel melado xarope glucose calda caramelo doce de leite geleia',
    vanilla: 'baunilha essencia de baunilha extrato de baunilha fava de baunilha essencia aroma',
    cinnamon: 'canela canela em po canela em pau',
    yeast: 'fermento fermento biologico fermento quimico bicarbonato levedura fermento em po',
    gelatin: 'gelatina agar-agar agar colageno',
    yogurt: 'iogurte coalhada kefir',
    wine: 'vinho vinhos conhaque rum cachaca licor cerveja vodka espumante champanhe vermute saque whisky',
    sauce: 'vinagre shoyu molho shoyu molho ingles mostarda ketchup maionese molho barbecue tahine pesto molho branco bechamel',
    mushroom: 'cogumelo cogumelos champignon champignons shitake shiitake shimeji funghi',
    olive: 'azeitona azeitonas alcaparra alcaparras',
    squash: 'berinjela abobrinha pepino chuchu abobora moranga quiabo jilo',
    broccoli: 'brocolis couve-flor couve flor aspargo aspargos alcachofra palmito',
    ginger: 'gengibre',
    seeds: 'gergelim chia linhaca sementes semente de girassol semente de abobora',
    grain: 'aveia quinoa granola cevada centeio farelo cuscuz trigo para quibe'
  };
  const STEP = {
    blender: 'liquidificador liquidifique liquidificar processador processe processar mixer bata no liquidificador',
    whisk: 'misture misturar mexa mexer bata bater incorpore incorporar batedeira fouet emulsione claras em neve homogenea homogeneo',
    oven: 'forno asse assar gratine gratinar preaqueca pre-aqueca preaquecido forno preaquecido',
    microwave: 'micro-ondas microondas',
    fridge: 'geladeira refrigere refrigerar leve a geladeira gelar gele',
    snow: 'congele congelar freezer congelador',
    grill: 'grelhe grelhar grelha churrasqueira brasa chapa',
    pan: 'frite fritar refogue refogar salteie saltear doure dourar frigideira sele selar',
    pot: 'cozinhe cozinhar ferva ferver fervura escalde escaldar panela cozimento cozido aferventar fogo baixo fogo medio fogo alto',
    flame: 'aqueca aquecer derreta derreter banho-maria banho maria leve ao fogo esquente esquentar',
    knife: 'corte cortar pique picar fatie fatiar descasque descascar cubos rodelas tiras pedacos lamine',
    grater: 'rale ralar raspe raspar',
    sieve: 'peneire peneirar coe coar escorra escorrer passe na peneira',
    rollingpin: 'abra a massa estenda estender rolo enrole enrolar',
    hands: 'sove sovar amasse amassar modele modelar boleie bolear forme bolinhas',
    brush: 'unte untar pincele pincelar polvilhe polvilhar enfarinhe',
    tray: 'forma assadeira travessa refratario distribua distribuir disponha',
    lid: 'tampe tampar cubra cobrir filme plastico papel-aluminio',
    clock: 'descanse descansar aguarde aguardar espere esperar deixe repousar repouse minutos horas cresca crescer dobrar de volume',
    salt: 'tempere temperar salgue acerte o sal',
    water: 'lave lavar higienize deixe de molho hidrate hidratar',
    sparkle: 'decore decorar enfeite enfeitar finalize finalizar cobertura confeite',
    plate: 'sirva servir sirva-se acompanhe acompanha prato pratos',
    pour: 'despeje despejar adicione adicionar acrescente acrescentar junte juntar coloque colocar regue regar recheie rechear transfira transferir'
  };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/­/g, '');
  function table(src) {
    const out = [];
    // termos de duas ou mais palavras (“creme de leite”) entram inteiros; as palavras soltas deles, não
    const known = ['farinha de mandioca', 'amido de milho', 'flor de sal', 'sal grosso', 'sal marinho', 'pimenta do reino', 'noz moscada', 'leite integral', 'leite desnatado', 'leite em po', 'leite vegetal', 'leite de amendoas', 'creme de leite', 'creme fresco', 'creme azedo', 'creme de confeiteiro', 'leite condensado', 'milho em conserva', 'ervilha em conserva', 'gordura vegetal', 'manteiga ghee', 'azeite de oliva', 'oleo de coco', 'oleo vegetal', 'cream cheese', 'agua fervente', 'agua morna', 'agua gelada', 'caldo de legumes', 'caldo de galinha', 'caldo de carne', 'cubos de gelo', 'dente de alho', 'dentes de alho', 'cebola roxa', 'alho poro', 'molho de tomate', 'extrato de tomate', 'polpa de tomate', 'dedo de moca', 'pimenta biquinho', 'pimenta calabresa', 'batata doce', 'milho verde', 'grao de bico', 'arroz arborio', 'arroz integral', 'farinha de rosca', 'file mignon', 'carne moida', 'carne seca', 'lombo de porco', 'peito de frango', 'cheiro verde', 'folha de louro', 'ervas finas', 'raspas de limao', 'suco de limao', 'limao siciliano', 'suco de laranja', 'frutas vermelhas', 'leite de coco', 'coco ralado', 'agua de coco', 'gotas de chocolate', 'cha preto', 'doce de leite', 'essencia de baunilha', 'extrato de baunilha', 'fava de baunilha', 'canela em po', 'canela em pau', 'fermento biologico', 'fermento quimico', 'fermento em po', 'molho shoyu', 'molho ingles', 'molho barbecue', 'molho branco', 'couve flor', 'semente de girassol', 'semente de abobora', 'trigo para quibe', 'bata no liquidificador', 'claras em neve', 'forno preaquecido', 'leve a geladeira', 'fogo baixo', 'fogo medio', 'fogo alto', 'banho maria', 'leve ao fogo', 'passe na peneira', 'abra a massa', 'forme bolinhas', 'filme plastico', 'deixe de molho', 'acerte o sal', 'dobrar de volume', 'ovo caipira', 'ovos caipiras', 'erva doce'];
    const phrases = known.map(k => k.split(' ')).sort((a, b) => b.length - a.length);
    Object.entries(src).forEach(([icon, words]) => {
      const w = words.split(/\s+/).filter(Boolean);
      for (let i = 0; i < w.length;) {
        const ph = phrases.find(p => p.every((x, j) => w[i + j] === x));
        // palavra com hífen (castanha-de-caju) é um termo só
        if (ph) { out.push({ k: ph.join(' '), icon }); i += ph.length; } else { out.push({ k: w[i].replace(/-/g, ' '), icon }); i++; }
      }
    });
    // a expressão mais longa ganha (“creme de leite” antes de “leite”)
    return out.sort((a, b) => b.k.length - a.k.length);
  }
  const ING_T = table(ING), STEP_T = table(STEP);
  // palavras genéricas só valem quando não há nada mais específico (“folhas de manjericão” → ervas)
  const GENERIC = new Set(['folha', 'folhas', 'massa', 'massas', 'ervas', 'tempero', 'temperos', 'essencia', 'aroma', 'fruta', 'frutas', 'caldo', 'calda', 'lata', 'molho', 'conserva', 'enlatado', 'sementes', 'especiarias', 'gordura', 'cubos', 'pedacos', 'tiras', 'rodelas', 'minutos', 'horas', 'prato', 'pratos', 'forma', 'panela', 'deixe', 'coloque', 'colocar', 'adicione', 'adicionar', 'junte', 'juntar', 'acrescente', 'acrescentar']);
  // medidas não são ingredientes: “1 colher (chá) de…”, “1 xícara (de chá)…”, “1 copo americano…”
  const UNITS = /\b(colher(es)?|colheres?|xicaras?|copos?|latas?|pitadas?|punhados?|dentes?|ramos?|maços?|macos?)\s*(\(?\s*(de\s+)?(sopa|cha|cafe|sobremesa|americano|requeijao)\s*\)?)?/g;
  function find(text, T, fallback, units) {
    let t = ' ' + norm(text).replace(/[–—]/g, ' ').replace(/[^a-z0-9 -]+/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ') + ' ';
    if (units) t = t.replace(UNITS, m => (/^dentes?/.test(m) || /^latas?/.test(m) ? m : ' '));
    let best = null, gen = null;
    for (const e of T) {
      const at = t.indexOf(' ' + e.k + ' ');
      if (at < 0) continue;
      const cand = { at, k: e.k, icon: e.icon };
      const slot = GENERIC.has(e.k) ? 'g' : 's';
      const cur = slot === 'g' ? gen : best;
      if (!cur || at < cur.at || (at === cur.at && e.k.length > cur.k.length)) { if (slot === 'g') gen = cand; else best = cand; }
    }
    return best ? best.icon : gen ? gen.icon : fallback;
  }
  const ingredientIcon = text => find(text, ING_T, 'bowl', true);
  const stepIcon = text => find(text, STEP_T, 'chef');

  // ---------------------------------------------------------------- reconhecer e marcar o capítulo
  const ING_HEAD = /^(ingredientes?|o que voce vai precisar|voce vai precisar|lista de ingredientes)\b[^.]{0,40}$/;
  const PREP_HEAD = /^(modo de (preparo|fazer)|preparo|preparacao|como fazer|instrucoes|passo a passo|montagem|finalizacao)\b[^.]{0,40}$/;
  const TIP_HEAD = /^(dicas?|observac(ao|oes)|obs|sugestao( de servir)?|variac(ao|oes)|curiosidade)\b[^.]{0,40}$/;
  const META = [[/^(rendimento|rende|porc(ao|oes)|serve|serve ate)\b/, 'people'], [/^(tempo( de preparo| total| de forno| de cozimento)?|preparo em|pronto em)\b/, 'clock'], [/^(dificuldade|nivel)\b/, 'gauge'], [/^(calorias|kcal|valor energetico)\b/, 'flame']];
  const strip = h => String(h || '').replace(/<span class="footnote">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const svgOf = (name, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.bowl}</svg>`;
  const iconUrl = (name, color) => `url(&quot;data:image/svg+xml,${encodeURIComponent(svgOf(name, color)).replace(/'/g, '%27')}&quot;)`;

  // primeiro nível do capítulo: [{ tag, open, inner, close, html }]
  function blocks(html) {
    const out = [];
    const re = /<(p|h[1-6]|ul|ol|div|figure|blockquote|table|section|hr)\b([^>]*)>/gi;
    let pos = 0;
    while (pos < html.length) {
      re.lastIndex = pos;
      const m = re.exec(html);
      if (!m) { out.push({ text: html.slice(pos) }); break; }
      if (m.index > pos) out.push({ text: html.slice(pos, m.index) });
      const tag = m[1].toLowerCase();
      if (tag === 'hr' || /\/>$/.test(m[0])) { out.push({ tag, open: m[0], inner: '', close: '', html: m[0] }); pos = m.index + m[0].length; continue; }
      // fechamento do mesmo nível (listas e divs podem ter filhos iguais)
      const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
      tagRe.lastIndex = m.index + m[0].length;
      let depth = 1, end = -1, closeLen = 0, t;
      while ((t = tagRe.exec(html))) { if (t[1]) { depth--; if (!depth) { end = t.index; closeLen = t[0].length; break; } } else depth++; }
      if (end < 0) { out.push({ text: html.slice(m.index) }); break; }
      out.push({ tag, open: m[0], inner: html.slice(m.index + m[0].length, end), close: html.slice(end, end + closeLen), html: html.slice(m.index, end + closeLen) });
      pos = end + closeLen;
    }
    return out;
  }
  // acrescenta classe e estilo à marca de abertura
  function addAttr(open, cls, style, extra) {
    let o = open;
    o = /\sclass="/.test(o) ? o.replace(/\sclass="([^"]*)"/, (mm, c) => ` class="${c} ${cls}"`) : o.replace(/^<([a-z0-9]+)/i, `<$1 class="${cls}"`);
    if (style) o = /\sstyle="/.test(o) ? o.replace(/\sstyle="([^"]*)"/, (mm, s) => ` style="${s};${style}"`) : o.replace(/^<([a-z0-9]+)/i, `<$1 style="${style}"`);
    if (extra) o = o.replace(/^<([a-z0-9]+)/i, `<$1 ${extra}`);
    return o;
  }

  // opts: { color: cor dos ícones, icons: false para tirar os ícones }
  function mark(html, opts) {
    opts = opts || {};
    const color = opts.color || '#6b3f22';
    const useIcons = opts.icons !== false;
    const icon = name => (useIcons ? `--ri:${iconUrl(name, color)}` : '');
    const B = blocks(String(html || ''));
    let state = '', step = 0, found = false;
    // títulos da receita viram parágrafos de apresentação: não abrem página nova nem entram no sumário
    const asP = (b, cls, style) => ({ open: addAttr(b.open.replace(/^<h[1-6]\b/i, '<p'), cls, style), close: /^h/.test(b.tag) ? '</p>' : b.close });
    const head = (b, cls, ic) => { const o = asP(b, cls, ic); return o.open + b.inner + o.close; };
    const out = B.map(b => {
      if (!b.tag) return b.text;
      const raw = strip(b.inner);
      const t = norm(raw).replace(/[:.\s]+$/, '');
      const headLike = /^h[2-6]$/.test(b.tag) || (b.tag === 'p' && raw.length <= 48 && !/[.!?]$/.test(raw.replace(/:$/, '')));
      if (headLike && ING_HEAD.test(t)) { state = 'ing'; found = true; return head(b, 'rc-head rc-head-ing', icon('basket')); }
      if (headLike && PREP_HEAD.test(t)) { state = 'prep'; step = 0; found = true; return head(b, 'rc-head rc-head-prep', icon('chef')); }
      if (headLike && TIP_HEAD.test(t)) { state = 'tip'; return head(b, 'rc-head rc-head-tip', icon('tip')); }
      if (b.tag === 'p' && raw.length < 90) { const mt = META.find(([re]) => re.test(t)); if (mt) return addAttr(b.open, 'rc-meta', icon(mt[1])) + b.inner + b.close; }
      if (/^h[1-6]$/.test(b.tag)) { state = ''; return b.html; }
      if (state === 'ing') {
        if (b.tag === 'ul' || b.tag === 'ol') return addAttr(b.open, 'rc-list rc-ing-list') + b.inner.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (mm, a, inner) => addAttr(`<li${a}>`, 'rc-ing', icon(ingredientIcon(strip(inner)))) + inner + '</li>') + b.close;
        if (b.tag === 'p') {
          if (/:$/.test(raw) && raw.length <= 60) return addAttr(b.open, 'rc-sub') + b.inner + b.close; // “Para a massa:”
          if (raw.length > 180) { state = ''; return b.html; }
          if (/<br\s*\/?>/i.test(b.inner)) return addAttr(b.open, 'rc-ing-lines') + b.inner.split(/(<br\s*\/?>)/i).map(seg => (/^<br/i.test(seg) || !strip(seg) ? seg : `<span class="rc-ing rc-ing-line" style="${icon(ingredientIcon(strip(seg)))}">${seg}</span>`)).join('') + b.close;
          return addAttr(b.open, 'rc-ing', icon(ingredientIcon(raw))) + b.inner + b.close;
        }
        return b.html;
      }
      if (state === 'prep') {
        if (b.tag === 'ul' || b.tag === 'ol') return addAttr(b.open, 'rc-list rc-step-list') + b.inner.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (mm, a, inner) => { step++; return addAttr(`<li${a}>`, 'rc-step', icon(stepIcon(strip(inner))), `data-n="${step}"`) + inner + '</li>'; }) + b.close;
        if (b.tag === 'p') {
          if (/:$/.test(raw) && raw.length <= 60) return addAttr(b.open, 'rc-sub') + b.inner + b.close; // “Montagem:”
          // passo já numerado no texto (“1. Misture…”): o número do texto fica e o círculo mostra só o ícone
          const own = /^\d{1,2}\s*[.)\-–]\s/.test(raw);
          step++;
          return addAttr(b.open, 'rc-step' + (own ? ' rc-own' : ''), icon(stepIcon(raw)), `data-n="${step}"`) + b.inner + b.close;
        }
        return b.html;
      }
      if (state === 'tip' && b.tag === 'p') return addAttr(b.open, 'rc-tip') + b.inner + b.close;
      return b.html;
    });
    return { html: out.join(''), found };
  }

  // capítulos com receita (para inserir o quadro da foto antes do modo de preparo)
  function prepHeadIndex(html) {
    const B = blocks(String(html || ''));
    const res = [];
    let k = 0;
    B.forEach(b => {
      if (!b.tag) return;
      const raw = strip(b.inner);
      const t = norm(raw).replace(/[:.\s]+$/, '');
      const headLike = /^h[2-6]$/.test(b.tag) || (b.tag === 'p' && raw.length <= 48 && !/[.!?]$/.test(raw.replace(/:$/, '')));
      if (headLike && PREP_HEAD.test(t)) res.push(k);
      k++;
    });
    return res;
  }

  // tipo do título de seção (para a interface): 'ing', 'prep', 'tip' ou ''
  function headKind(tag, text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    const t = norm(raw).replace(/[:.\s]+$/, '');
    const headLike = /^h[2-6]$/i.test(tag) || (/^p$/i.test(tag) && raw.length <= 48 && !/[.!?]$/.test(raw.replace(/:$/, '')));
    if (!headLike) return '';
    return ING_HEAD.test(t) ? 'ing' : PREP_HEAD.test(t) ? 'prep' : TIP_HEAD.test(t) ? 'tip' : '';
  }

  return { headKind, ICONS, LABELS, ING, STEP, ingredientIcon, stepIcon, mark, svgOf, iconUrl, blocks, prepHeadIndex, norm, count: () => Object.keys(ICONS).length, words: () => ING_T.length + STEP_T.length };
});
