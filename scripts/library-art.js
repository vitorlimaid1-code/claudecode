// Desenhos vetoriais da biblioteca embutida. Cada item vira um PNG transparente
// (scripts/make-library.js). Cor única escura para imprimir bem em qualquer papel.
const C = '#1f1b17';

// ---------- utilidades ----------
const line = (x1, y1, x2, y2, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C}" stroke-width="${w}" stroke-linecap="round"/>`;
const taper = (x1, x2, y, w = 3) => {
  // filete que afina nas pontas
  const m = (x1 + x2) / 2;
  return `<path d="M${x1} ${y} Q${m} ${y - w} ${x2} ${y} Q${m} ${y + w} ${x1} ${y} Z" fill="${C}"/>`;
};
const diamond = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.7} ${y} L${x} ${y + r} L${x - r * 0.7} ${y} Z" fill="${C}"/>`;
const circle = (x, y, r, fill = true) => fill ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${C}"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C}" stroke-width="2"/>`;
const star = (cx, cy, R, r, n = 5, rot = -90) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (rot + i * 180 / n) * Math.PI / 180;
    const rr = i % 2 ? r : R;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${C}"/>`;
};
const heart = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-2 2 -10 -2 -10 -8 C-10 -13 -5 -15 0 -10 C5 -15 10 -13 10 -8 C10 -2 2 2 0 6 Z" fill="${C}"/>`;
const leaf = (x, y, len, ang, w = 0.38) => {
  const h = len * w;
  return `<path transform="translate(${x} ${y}) rotate(${ang})" d="M0 0 Q${len * 0.45} ${-h} ${len} 0 Q${len * 0.45} ${h} 0 0 Z" fill="${C}"/>`;
};
const scroll = (x, y, s, flip = false) => `<path transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" d="M0 0 C 18 -14, 40 -14, 52 -2 C 60 6, 52 18, 42 14 C 34 11, 36 2, 43 3" fill="none" stroke="${C}" stroke-width="${2.6 / s}" stroke-linecap="round"/>`;

// ---------- separadores (600 × 100) ----------
const SEP = {
  'linha-simples': { name: 'Linha simples', tags: 'filete liso padrão', svg: line(120, 50, 480, 50, 2) },
  'linha-fina-afinada': { name: 'Filete afinado', tags: 'linha clássica elegante', svg: taper(60, 540, 50, 3) },
  'linha-dupla': { name: 'Linha dupla', tags: 'suspense policial clássico', svg: line(110, 44, 490, 44, 2) + line(110, 56, 490, 56, 2) },
  'linha-ponto': { name: 'Linha com ponto', tags: 'moderno negócios', svg: line(110, 50, 280, 50, 2) + circle(300, 50, 6) + line(320, 50, 490, 50, 2) },
  'losango': { name: 'Losango central', tags: 'contos clássico', svg: taper(80, 275, 50, 3) + diamond(300, 50, 14) + taper(325, 520, 50, 3) },
  'tres-losangos': { name: 'Três losangos', tags: 'clássico', svg: diamond(260, 50, 9) + diamond(300, 50, 13) + diamond(340, 50, 9) },
  'estrelas': { name: 'Estrelas', tags: 'infantil fantasia', svg: star(240, 50, 10, 4) + star(300, 50, 16, 6.5) + star(360, 50, 10, 4) + line(110, 50, 215, 50, 1.5) + line(385, 50, 490, 50, 1.5) },
  'coracao-linhas': { name: 'Coração com linhas', tags: 'romance amor', svg: taper(90, 275, 50, 3) + heart(300, 52, 1.6) + taper(325, 510, 50, 3) },
  'pena': {
    name: 'Pena', tags: 'poesia escrita',
    svg: `<g transform="translate(300 50) rotate(-8)"><path d="M-120 4 C -60 -18, 40 -26, 120 -6 C 60 -2, -40 10, -120 4 Z" fill="${C}"/><path d="M-130 7 L 100 -8" stroke="#fff" stroke-width="1.6"/>${[...Array(12)].map((_, i) => `<path d="M${-90 + i * 17} ${2 - i * 0.6} l 8 ${i % 2 ? -7 : 7}" stroke="#fff" stroke-width="1.4"/>`).join('')}</g>`
  },
  'folhas': {
    name: 'Ramo de folhas', tags: 'biografia natureza',
    svg: `<path d="M120 50 Q300 38 480 50" fill="none" stroke="${C}" stroke-width="2"/>` +
      [...Array(9)].map((_, i) => { const x = 150 + i * 37; const up = i % 2 === 0; return leaf(x, 48 - i * 0.2, 26, up ? -40 : 40); }).join('')
  },
  'arabesco': {
    name: 'Arabesco', tags: 'fantasia ornamental clássico',
    svg: scroll(300, 50, 1.6) + scroll(300, 50, 1.6, true) + `<g transform="translate(300 50) scale(1 -1)">${scroll(0, 0, 1.6)}${scroll(0, 0, 1.6, true)}</g>` + diamond(300, 50, 8) + taper(60, 200, 50, 2.5) + taper(400, 540, 50, 2.5)
  },
  'cruz-flor': {
    name: 'Cruz florida', tags: 'religioso espiritual',
    svg: taper(90, 265, 50, 2.5) + `<g transform="translate(300 50)"><rect x="-3" y="-26" width="6" height="52" fill="${C}"/><rect x="-18" y="-12" width="36" height="6" fill="${C}"/>${circle(0, -28, 4)}${circle(0, 28, 4)}${circle(-20, -9, 4)}${circle(20, -9, 4)}</g>` + taper(335, 510, 50, 2.5)
  },
  'espinhos': {
    name: 'Espinhos', tags: 'terror sombrio gótico',
    svg: `<path d="M80 50 L520 50" stroke="${C}" stroke-width="3"/>` + [...Array(14)].map((_, i) => { const x = 105 + i * 28; return `<path d="M${x} 50 L${x + 7} ${i % 2 ? 36 : 64} L${x + 12} 50 Z" fill="${C}"/>`; }).join('') + diamond(300, 50, 12)
  },
  'caveira': {
    name: 'Caveira', tags: 'terror horror',
    svg: taper(100, 265, 50, 2.5) + `<g transform="translate(300 48)"><path d="M-20 -4 C-20 -26 20 -26 20 -4 C20 6 14 8 12 12 L-12 12 C-14 8 -20 6 -20 -4 Z" fill="${C}"/><rect x="-10" y="11" width="20" height="9" rx="2" fill="${C}"/><circle cx="-8" cy="-4" r="5.5" fill="#fff"/><circle cx="8" cy="-4" r="5.5" fill="#fff"/><path d="M0 3 l-3 5 h6 Z" fill="#fff"/><path d="M-5 13 v6 M0 13 v6 M5 13 v6" stroke="#fff" stroke-width="1.6"/></g>` + taper(335, 500, 50, 2.5)
  },
  'lua': {
    name: 'Lua e estrelas', tags: 'noite fantasia romance',
    svg: line(120, 50, 255, 50, 1.5) + `<path d="M300 28 A22 22 0 1 0 318 66 A17 17 0 1 1 300 28 Z" fill="${C}"/>` + star(330, 34, 6, 2.5) + star(272, 66, 5, 2) + line(345, 50, 480, 50, 1.5)
  },
  'ondas': {
    name: 'Ondas', tags: 'mar viagem',
    svg: `<path d="M100 50 ${[...Array(10)].map((_, i) => `q 10 ${i % 2 ? 12 : -12} 20 0 t 20 0`).join(' ')}" fill="none" stroke="${C}" stroke-width="2.5" stroke-linecap="round"/>`
  },
  'art-deco': {
    name: 'Art déco', tags: 'moderno elegante anos 20',
    svg: line(80, 50, 250, 50, 2) + line(350, 50, 520, 50, 2) + line(110, 42, 240, 42, 1) + line(360, 42, 490, 42, 1) + line(110, 58, 240, 58, 1) + line(360, 58, 490, 58, 1) +
      `<path d="M300 22 L330 50 L300 78 L270 50 Z" fill="none" stroke="${C}" stroke-width="2.5"/>` + diamond(300, 50, 12)
  },
  'orbita': {
    name: 'Órbita', tags: 'ficção científica espaço',
    svg: `<ellipse cx="300" cy="50" rx="70" ry="16" fill="none" stroke="${C}" stroke-width="2" transform="rotate(-10 300 50)"/>` + circle(300, 50, 11) + circle(366, 39, 4) + line(90, 50, 220, 50, 1.5) + line(380, 50, 510, 50, 1.5)
  },
  'chave': {
    name: 'Chave antiga', tags: 'mistério suspense',
    svg: taper(90, 230, 50, 2.5) + `<g transform="translate(300 50)"><circle cx="-38" cy="0" r="13" fill="none" stroke="${C}" stroke-width="4"/><rect x="-25" y="-2.5" width="68" height="5" fill="${C}"/><rect x="28" y="2" width="5" height="11" fill="${C}"/><rect x="37" y="2" width="5" height="8" fill="${C}"/></g>` + taper(370, 510, 50, 2.5)
  },
  'floral': {
    name: 'Floral', tags: 'romance delicado',
    svg: `<path d="M110 50 Q200 30 290 50 M310 50 Q400 70 490 50" fill="none" stroke="${C}" stroke-width="2"/>` +
      `<g transform="translate(300 50)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-9" rx="5" ry="9" fill="${C}" transform="rotate(${a})"/>`).join('')}<circle r="4" fill="#fff"/></g>` +
      leaf(200, 41, 20, -30) + leaf(380, 59, 20, 150) + leaf(240, 46, 16, 30) + leaf(355, 54, 16, 210)
  },
  'gotico': {
    name: 'Arco gótico', tags: 'terror medieval',
    svg: line(90, 60, 250, 60, 2) + line(350, 60, 510, 60, 2) + `<path d="M270 70 L270 45 Q270 22 300 14 Q330 22 330 45 L330 70" fill="none" stroke="${C}" stroke-width="3"/><path d="M300 30 L300 70 M284 50 L316 50" stroke="${C}" stroke-width="2"/>`
  },
  'pontos': {
    name: 'Três pontos', tags: 'minimalista',
    svg: circle(270, 50, 5) + circle(300, 50, 5) + circle(330, 50, 5)
  }
};

// ---------- ilustrações para o corpo (400 × 400) ----------
const BODY = {
  'rosa': {
    name: 'Rosa', tags: 'romance flor amor',
    svg: `<path d="M200 380 C 196 300, 204 250, 200 190" stroke="${C}" stroke-width="7" fill="none"/>` + leaf(200, 300, 70, -150, 0.42) + leaf(200, 260, 60, -20, 0.42) +
      `<g transform="translate(200 140)"><path d="M-62 10 C -70 -50, -20 -80, 0 -70 C 25 -82, 72 -50, 62 10 C 50 60, -50 60, -62 10 Z" fill="${C}"/>` +
      `<path d="M-30 0 C -30 -35, 30 -35, 30 0 C 30 25, -10 30, -14 8 C -16 -10, 12 -12, 10 2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M-50 20 C -30 45, 30 45, 50 20" fill="none" stroke="#fff" stroke-width="4"/></g>`
  },
  'folha': {
    name: 'Folha', tags: 'natureza outono',
    svg: `<g transform="translate(200 200) rotate(-35)"><path d="M-150 0 C -80 -95, 80 -95, 150 0 C 80 95, -80 95, -150 0 Z" fill="${C}"/><path d="M-170 0 L 140 0" stroke="#fff" stroke-width="5"/>${[-100, -60, -20, 20, 60, 100].map(x => `<path d="M${x} 0 L${x + 32} -44 M${x} 0 L${x + 32} 44" stroke="#fff" stroke-width="3.5"/>`).join('')}</g>`
  },
  'lua': {
    name: 'Lua crescente', tags: 'noite sonho fantasia',
    svg: `<path d="M220 40 A160 160 0 1 0 330 300 A125 125 0 1 1 220 40 Z" fill="${C}"/>` + star(300, 90, 22, 9) + star(340, 180, 13, 5) + star(270, 160, 9, 3.5)
  },
  'estrelas': {
    name: 'Céu estrelado', tags: 'infantil fantasia sonho',
    svg: star(200, 200, 80, 32) + star(90, 100, 30, 12) + star(320, 90, 24, 10) + star(110, 310, 20, 8) + star(310, 320, 34, 14)
  },
  'caveira': {
    name: 'Caveira', tags: 'terror horror morte',
    svg: `<g transform="translate(200 190)"><path d="M-120 -10 C -120 -150, 120 -150, 120 -10 C 120 50, 85 65, 75 90 L -75 90 C -85 65, -120 50, -120 -10 Z" fill="${C}"/><rect x="-62" y="84" width="124" height="60" rx="10" fill="${C}"/>` +
      `<path d="M-78 -20 C -78 -62, -18 -62, -18 -20 C -18 12, -78 12, -78 -20 Z" fill="#fff"/><path d="M78 -20 C 78 -62, 18 -62, 18 -20 C 18 12, 78 12, 78 -20 Z" fill="#fff"/><path d="M0 22 L -16 56 L 16 56 Z" fill="#fff"/>` +
      `${[-36, -12, 12, 36].map(x => `<rect x="${x - 7}" y="96" width="14" height="40" rx="4" fill="#fff"/>`).join('')}</g>`
  },
  'coracao': {
    name: 'Coração', tags: 'romance amor',
    svg: heart(200, 230, 17) + `<path d="M105 110 C 92 125, 92 145, 100 160" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>`
  },
  'pena-tinteiro': {
    name: 'Pena e tinteiro', tags: 'poesia escrita escritor',
    svg: `<g transform="translate(230 170) rotate(35)"><path d="M0 -160 C 60 -110, 55 40, 0 140 C -55 40, -60 -110, 0 -160 Z" fill="${C}"/><path d="M0 -150 L0 170" stroke="#fff" stroke-width="5"/>${[-120, -90, -60, -30, 0, 30, 60].map(y => `<path d="M0 ${y} l 30 -24 M0 ${y} l -30 -24" stroke="#fff" stroke-width="3"/>`).join('')}</g>` +
      `<path d="M90 300 L 90 370 L 190 370 L 190 300 C 190 285, 90 285, 90 300 Z" fill="${C}"/><rect x="115" y="276" width="50" height="16" rx="4" fill="${C}"/>`
  },
  'arvore': {
    name: 'Árvore', tags: 'natureza vida família',
    svg: `<path d="M185 380 L 192 250 L 150 200 M 192 250 L 240 190 M 196 300 L 260 260" stroke="${C}" stroke-width="16" fill="none" stroke-linecap="round"/>` +
      [[200, 130, 95], [120, 170, 60], [280, 160, 65], [160, 90, 55], [250, 85, 55], [280, 235, 42], [125, 230, 40]].map(([x, y, r]) => circle(x, y, r)).join('') + `<rect x="120" y="374" width="160" height="10" rx="5" fill="${C}"/>`
  },
  'montanhas': {
    name: 'Montanhas', tags: 'viagem aventura natureza',
    svg: `<path d="M20 330 L 140 130 L 210 240 L 270 160 L 380 330 Z" fill="${C}"/><path d="M140 130 L 112 177 L 132 168 L 146 182 L 166 170 Z M270 160 L 252 190 L 268 184 L 282 196 L 290 188 Z" fill="#fff"/>` + circle(310, 80, 30, false) + `<rect x="20" y="335" width="360" height="8" rx="4" fill="${C}"/>`
  },
  'ondas': {
    name: 'Ondas do mar', tags: 'mar praia viagem',
    svg: [0, 1, 2].map(i => `<path d="M30 ${180 + i * 60} ${[...Array(5)].map(() => 'q 34 -40 68 0').join(' ')}" fill="none" stroke="${C}" stroke-width="12" stroke-linecap="round"/>`).join('') + circle(290, 100, 40)
  },
  'vela': {
    name: 'Vela', tags: 'terror mistério religioso',
    svg: `<rect x="160" y="170" width="80" height="180" rx="8" fill="${C}"/><path d="M200 70 C 230 110, 225 150, 200 155 C 175 150, 170 110, 200 70 Z" fill="${C}"/><path d="M200 165 L200 150" stroke="${C}" stroke-width="4"/><path d="M120 350 L 280 350 L 260 375 L 140 375 Z" fill="${C}"/><path d="M175 175 C 175 215, 185 225, 182 250" stroke="#fff" stroke-width="5" fill="none"/>`
  },
  'chave': {
    name: 'Chave antiga', tags: 'mistério segredo',
    svg: `<g transform="translate(200 200) rotate(-35)"><circle cx="-110" cy="0" r="50" fill="none" stroke="${C}" stroke-width="18"/><circle cx="-110" cy="0" r="14" fill="${C}"/><rect x="-62" y="-11" width="210" height="22" fill="${C}"/><rect x="100" y="8" width="20" height="44" fill="${C}"/><rect x="132" y="8" width="16" height="30" fill="${C}"/></g>`
  },
  'borboleta': {
    name: 'Borboleta', tags: 'infantil natureza delicado',
    svg: `<g transform="translate(200 200)"><path d="M0 -10 C -60 -150, -180 -80, -120 0 C -170 50, -90 130, 0 20 Z" fill="${C}"/><path d="M0 -10 C 60 -150, 180 -80, 120 0 C 170 50, 90 130, 0 20 Z" fill="${C}"/>` +
      `${circle(-80, -55, 16).replace(C, '#fff')}${circle(80, -55, 16).replace(C, '#fff')}<rect x="-7" y="-60" width="14" height="140" rx="7" fill="${C}"/><path d="M-3 -58 C -20 -100, -40 -110, -50 -112 M3 -58 C 20 -100, 40 -110, 50 -112" stroke="${C}" stroke-width="4" fill="none"/></g>`
  },
  'gato': {
    name: 'Gato', tags: 'infantil mistério animal',
    svg: `<path d="M120 370 C 90 290, 110 200, 160 170 L 140 90 L 190 140 L 240 140 L 270 90 L 262 175 C 310 210, 320 300, 290 370 Z" fill="${C}"/><path d="M290 360 C 360 350, 370 280, 330 260" stroke="${C}" stroke-width="18" fill="none" stroke-linecap="round"/>` +
      `<path d="M178 190 l 18 6 l -18 6 Z M240 190 l -18 6 l 18 6 Z" fill="#fff"/>`
  },
  'xicara': {
    name: 'Xícara de café', tags: 'cotidiano crônica conforto',
    svg: `<path d="M80 170 L 280 170 L 262 320 C 258 345, 100 345, 98 320 Z" fill="${C}"/><path d="M276 200 C 340 195, 340 275, 268 280" stroke="${C}" stroke-width="18" fill="none"/><rect x="50" y="345" width="260" height="14" rx="7" fill="${C}"/>` +
      `<path d="M140 140 C 120 110, 160 95, 140 60 M190 140 C 170 110, 210 95, 190 60 M240 140 C 220 110, 260 95, 240 60" stroke="${C}" stroke-width="7" fill="none" stroke-linecap="round"/>`
  },
  'livro-aberto': {
    name: 'Livro aberto', tags: 'leitura estudo acadêmico',
    svg: `<path d="M200 120 C 150 90, 70 90, 30 110 L 30 310 C 70 290, 150 290, 200 320 Z" fill="${C}"/><path d="M200 120 C 250 90, 330 90, 370 110 L 370 310 C 330 290, 250 290, 200 320 Z" fill="${C}"/>` +
      [150, 180, 210, 240, 270].map(y => `<path d="M60 ${y} C 110 ${y - 12}, 160 ${y - 6}, 180 ${y + 6} M220 ${y + 6} C 240 ${y - 6}, 290 ${y - 12}, 340 ${y}" stroke="#fff" stroke-width="5" fill="none"/>`).join('')
  },
  'castelo': {
    name: 'Castelo', tags: 'fantasia medieval infantil',
    svg: `<path d="M60 360 L 60 170 L 50 170 L 50 140 L 70 140 L 70 155 L 85 155 L 85 140 L 105 140 L 105 155 L 120 155 L 120 140 L 140 140 L 140 170 L 130 170 L 130 220 L 270 220 L 270 170 L 260 170 L 260 140 L 280 140 L 280 155 L 295 155 L 295 140 L 315 140 L 315 155 L 330 155 L 330 140 L 350 140 L 350 170 L 340 170 L 340 360 Z" fill="${C}"/>` +
      `<path d="M165 360 L 165 300 C 165 270, 235 270, 235 300 L 235 360 Z" fill="#fff"/><path d="M200 220 L 200 110 M200 110 L 240 125 L 200 140" stroke="${C}" stroke-width="6" fill="${C}"/><rect x="90" y="200" width="16" height="30" rx="8" fill="#fff"/><rect x="292" y="200" width="16" height="30" rx="8" fill="#fff"/>`
  },
  'foguete': {
    name: 'Foguete', tags: 'ficção científica espaço infantil',
    svg: `<g transform="translate(200 200) rotate(35)"><path d="M0 -170 C 60 -110, 60 40, 40 90 L -40 90 C -60 40, -60 -110, 0 -170 Z" fill="${C}"/><circle cx="0" cy="-60" r="24" fill="#fff"/><path d="M-40 30 L -90 110 L -40 90 Z M40 30 L 90 110 L 40 90 Z" fill="${C}"/><path d="M-25 100 C -20 150, 0 170, 0 190 C 0 170, 20 150, 25 100 Z" fill="${C}"/></g>` + star(70, 80, 18, 7) + star(330, 330, 14, 5)
  },
  'coroa': {
    name: 'Coroa', tags: 'fantasia realeza',
    svg: `<path d="M60 300 L 40 130 L 125 210 L 200 100 L 275 210 L 360 130 L 340 300 Z" fill="${C}"/><rect x="60" y="310" width="280" height="40" rx="6" fill="${C}"/>` + circle(40, 122, 14) + circle(200, 92, 16) + circle(360, 122, 14) + diamond(200, 330, 11).replace(C, '#fff')
  },
  'bussola': {
    name: 'Bússola', tags: 'viagem aventura',
    svg: `<circle cx="200" cy="200" r="150" fill="none" stroke="${C}" stroke-width="14"/><circle cx="200" cy="200" r="118" fill="none" stroke="${C}" stroke-width="3"/>` +
      `<path d="M200 70 L 225 200 L 200 330 L 175 200 Z" fill="${C}"/><path d="M200 200 L 225 200 L 200 330 Z" fill="#fff" stroke="${C}" stroke-width="3"/><path d="M70 200 L 200 185 L 330 200 L 200 215 Z" fill="${C}" opacity="0.55"/>` + circle(200, 200, 10)
  },
  'ornamento-canto': {
    name: 'Ornamento de canto', tags: 'moldura clássico decoração',
    svg: `<path d="M40 360 L 40 40 L 360 40" fill="none" stroke="${C}" stroke-width="8"/><path d="M70 330 L 70 70 L 330 70" fill="none" stroke="${C}" stroke-width="3"/>` + scroll(70, 70, 2.6) + `<g transform="translate(70 70) rotate(90) scale(1 -1)">${scroll(0, 0, 2.6)}</g>` + diamond(40, 40, 18)
  }
};

module.exports = { SEP, BODY };
