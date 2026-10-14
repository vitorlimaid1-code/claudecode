// Ilustrações da galeria “Imersão” (aberturas de capítulo), desenhadas em SVG e convertidas em PNG por
// scripts/make-immersion.js. Formato 1600 × 1000 (proporção de faixa larga sobre o título do capítulo).
const W = 1600, H = 1000;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const f = n => Math.round(n * 10) / 10;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const grain = (id, op = 0.18) => `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0"/></filter>`;
const noiseRect = id => `<rect width="${W}" height="${H}" filter="url(#${id})"/>`;

// árvore seca (recursiva)
function tree(r, x, y, len, ang, w, depth, out) {
  if (depth <= 0 || len < 6) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  const bend = (r() - 0.5) * len * 0.35;
  const mx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend, my = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend;
  out.push(`<path d="M${f(x)} ${f(y)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}" stroke-width="${f(w)}"/>`);
  const n = depth > 6 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) tree(r, x2, y2, len * (0.62 + r() * 0.2), ang + (r() - 0.5) * 1.1 + (i - (n - 1) / 2) * 0.5, w * 0.68, depth - 1, out);
}
const bat = (x, y, s) => `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M0 0 C-6 -8 -18 -10 -30 -4 C-24 -2 -22 4 -26 8 C-18 4 -12 6 -8 10 C-6 6 -3 4 0 6 C3 4 6 6 8 10 C12 6 18 4 26 8 C22 4 24 -2 30 -4 C18 -10 6 -8 0 0 Z"/>`;
const bird = (x, y, s) => `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M-20 0 Q-10 -10 0 0 Q10 -10 20 0 Q10 -5 0 3 Q-10 -5 -20 0 Z"/>`;
const crow = (x, y, s, flip) => `<path transform="translate(${f(x)} ${f(y)}) scale(${f(flip ? -s : s)} ${f(s)})" d="M0 0 C6 -10 18 -14 26 -10 L34 -14 L30 -8 C34 -2 32 8 24 14 L30 30 L24 30 L20 18 C14 20 6 20 0 16 L-26 22 L-4 8 C-8 4 -6 2 0 0 Z"/>`;

function petals(cx, cy, rad, n, color, rot, op = 1) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = rot + i * 360 / n; s += `<ellipse cx="${f(cx)}" cy="${f(cy - rad * 0.55)}" rx="${f(rad * 0.38)}" ry="${f(rad * 0.62)}" fill="${color}" opacity="${op}" transform="rotate(${f(a)} ${f(cx)} ${f(cy)})"/>`; }
  return s;
}
function rose(cx, cy, r, c1, c2) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>`;
  for (let k = 0; k < 5; k++) { const rr = r * (1 - k * 0.18); s += `<path d="M${f(cx - rr)} ${f(cy)} A${f(rr)} ${f(rr * 0.9)} 0 0 1 ${f(cx + rr * 0.8)} ${f(cy - rr * 0.3)}" fill="none" stroke="${c2}" stroke-width="${f(r * 0.07)}" stroke-linecap="round" transform="rotate(${k * 67} ${cx} ${cy})"/>`; }
  return s;
}
const leaf = (x, y, len, ang, c) => `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})" d="M0 0 Q${f(len * 0.5)} ${f(-len * 0.28)} ${f(len)} 0 Q${f(len * 0.5)} ${f(len * 0.28)} 0 0 Z" fill="${c}"/>`;

const ART = {
  // ============================================================ geométricas (não ficção)
  'geo-circulos': { name: 'Círculos concêntricos', group: 'geometrica', svg: () => {
    const r = rng(11); let s = `<defs>${lg('g', [[0, '#14213d'], [1, '#22355e']])}${grain('n', 0.12)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    for (let i = 0; i < 26; i++) s += `<circle cx="1120" cy="420" r="${40 + i * 34}" fill="none" stroke="${i % 5 === 0 ? '#e9c46a' : '#f4ecd8'}" stroke-opacity="${i % 5 === 0 ? 0.9 : 0.22}" stroke-width="${i % 5 === 0 ? 3 : 1.4}"/>`;
    for (let x = 60; x < W; x += 60) for (let y = 60; y < H; y += 60) if (r() < 0.6) s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#f4ecd8" opacity="0.25"/>`;
    s += `<circle cx="1120" cy="420" r="120" fill="#e76f51"/><rect x="0" y="700" width="${W}" height="3" fill="#e9c46a" opacity=".6"/>` + noiseRect('n');
    return s; } },
  'geo-triangulos': { name: 'Mosaico de triângulos', group: 'geometrica', svg: () => {
    const r = rng(23); const pal = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#f1e9da'];
    let s = `<defs>${grain('n', 0.1)}</defs>`; const c = 100, rows = 10, cols = 16;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const X = x * c, Y = y * c, a = pal[Math.floor(r() * pal.length)], b = pal[Math.floor(r() * pal.length)];
      if (r() < 0.5) s += `<path d="M${X} ${Y}h${c}v${c}z" fill="${a}"/><path d="M${X} ${Y}v${c}h${c}z" fill="${b}"/>`;
      else s += `<path d="M${X + c} ${Y}h${-c}v${c}z" fill="${a}"/><path d="M${X + c} ${Y}v${c}h${-c}z" fill="${b}"/>`;
    }
    return s + noiseRect('n'); } },
  'geo-bauhaus': { name: 'Formas Bauhaus', group: 'geometrica', svg: () => {
    const r = rng(37); const pal = ['#d62828', '#f7b538', '#1d3557', '#111111', '#e9e3d5'];
    let s = `<defs>${grain('n', 0.14)}</defs><rect width="${W}" height="${H}" fill="#efe9dc"/>`; const c = 200;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) {
      const X = x * c, Y = y * c, col = pal[Math.floor(r() * pal.length)], k = Math.floor(r() * 5), rot = Math.floor(r() * 4) * 90;
      s += `<g transform="rotate(${rot} ${X + c / 2} ${Y + c / 2})">`;
      if (k === 0) s += `<path d="M${X} ${Y + c}A${c} ${c} 0 0 1 ${X + c} ${Y}V${Y + c}Z" fill="${col}"/>`;
      else if (k === 1) s += `<circle cx="${X + c / 2}" cy="${Y + c / 2}" r="${c * 0.38}" fill="${col}"/>`;
      else if (k === 2) s += `<path d="M${X} ${Y + c}A${c / 2} ${c / 2} 0 0 1 ${X + c} ${Y + c}Z" fill="${col}"/>`;
      else if (k === 3) s += `<rect x="${X + c * 0.1}" y="${Y + c * 0.1}" width="${c * 0.8}" height="${c * 0.35}" fill="${col}"/>`;
      else s += `<path d="M${X} ${Y}L${X + c} ${Y + c}H${X}Z" fill="${col}"/>`;
      s += '</g>';
    }
    return s + noiseRect('n'); } },
  'geo-isometrico': { name: 'Cubos isométricos', group: 'geometrica', svg: () => {
    const r = rng(41); let s = `<defs>${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="#2b2d42"/>`; const a = 70, h = a * Math.sqrt(3) / 2;
    for (let row = -1; row < H / (a * 1.5) + 2; row++) for (let col = -1; col < W / (h * 2) + 2; col++) {
      const x = col * h * 2 + (row % 2 ? h : 0), y = row * a * 1.5; const acc = r() < 0.07;
      s += `<path d="M${f(x)} ${f(y)}l${f(h)} ${a / 2}l${f(-h)} ${a / 2}l${f(-h)} ${-a / 2}z" fill="${acc ? '#ef8354' : '#8d99ae'}"/>`;
      s += `<path d="M${f(x - h)} ${f(y + a / 2)}l${f(h)} ${a / 2}v${a}l${f(-h)} ${-a / 2}z" fill="${acc ? '#c96440' : '#4a4e69'}"/>`;
      s += `<path d="M${f(x + h)} ${f(y + a / 2)}l${f(-h)} ${a / 2}v${a}l${f(h)} ${-a / 2}z" fill="${acc ? '#a24d30' : '#3a3d55'}"/>`;
    }
    return s + noiseRect('n'); } },
  'geo-ondas': { name: 'Ondas paralelas', group: 'geometrica', svg: () => {
    let s = `<defs>${lg('g', [[0, '#3d1a78'], [0.5, '#b5179e'], [1, '#f77f00']], 1, 0)}${grain('n', 0.12)}</defs><rect width="${W}" height="${H}" fill="#120c24"/>`;
    for (let k = 0; k < 34; k++) {
      let d = `M0 ${120 + k * 26}`;
      for (let x = 0; x <= W; x += 20) d += ` L${x} ${f(120 + k * 26 + Math.sin(x / 180 + k * 0.32) * (40 + k * 2) + Math.sin(x / 70) * 6)}`;
      s += `<path d="${d}" fill="none" stroke="url(#g)" stroke-width="${2 + (k % 4 === 0 ? 2 : 0)}" opacity="${0.35 + (k / 34) * 0.6}"/>`;
    }
    return s + noiseRect('n'); } },

  // ============================================================ romance (florais e silhuetas)
  'rom-rosas': { name: 'Rosas', group: 'romance', svg: () => {
    const r = rng(53); let s = `<defs>${lg('g', [[0, '#fde2e4'], [1, '#f6bdc0']])}${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H; for (let j = 0; j < 3; j++) s += leaf(x, y, 60 + r() * 50, r() * 360, j % 2 ? '#6b9080' : '#4f7563'); }
    for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, rr = 50 + r() * 70; const c = ['#c9184a', '#ff4d6d', '#a4133c', '#ff758f'][i % 4]; s += rose(f(x), f(y), f(rr), c, '#590d22'); }
    return s + noiseRect('n'); } },
  'rom-campo': { name: 'Campo de flores ao entardecer', group: 'romance', svg: () => {
    const r = rng(61); let s = `<defs>${lg('g', [[0, '#ffb4a2'], [0.55, '#e5989b'], [1, '#6d597a']])}${rg('sun', [[0, '#fff1e6'], [1, '#fff1e6', 0]], 0.5, 0.5, 0.5)}${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1050" cy="520" r="230" fill="url(#sun)"/><circle cx="1050" cy="520" r="120" fill="#fff1e6" opacity=".85"/>`;
    s += `<g fill="#2b1b2f" stroke="#2b1b2f" stroke-linecap="round">`;
    for (let i = 0; i < 160; i++) { const x = r() * W, h = 120 + r() * 380, bend = (r() - 0.5) * 80; s += `<path d="M${f(x)} ${H} Q${f(x + bend)} ${f(H - h * 0.6)} ${f(x + bend * 1.4)} ${f(H - h)}" fill="none" stroke-width="${f(1.5 + r() * 2)}"/>`; if (r() < 0.5) s += petals(x + bend * 1.4, H - h, 10 + r() * 12, 6, '#2b1b2f', r() * 60); else s += `<ellipse cx="${f(x + bend * 1.4)}" cy="${f(H - h)}" rx="5" ry="14"/>`; }
    return s + '</g>' + noiseRect('n'); } },
  'rom-galho': { name: 'Galho florido e pássaros', group: 'romance', svg: () => {
    const r = rng(71); let s = `<defs>${lg('g', [[0, '#f8edeb'], [1, '#fcd5ce']])}${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><g fill="none" stroke="#3d2c2e" stroke-linecap="round">`;
    const br = []; tree(r, -40, 300, 420, 0.05, 26, 6, br); s += br.join('') + '</g>';
    for (let i = 0; i < 70; i++) { const x = r() * 1300, y = 150 + r() * 400; s += petals(x, y, 14 + r() * 10, 5, ['#ffb5a7', '#f28482', '#fec5bb'][i % 3], r() * 72) + `<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#9d4edd" opacity=".6"/>`; }
    s += '<g fill="#3d2c2e">'; for (let i = 0; i < 7; i++) s += bird(900 + r() * 600, 120 + r() * 300, 1.2 + r() * 1.4); s += '</g>';
    return s + noiseRect('n'); } },
  'rom-lua': { name: 'Lua e andorinhas', group: 'romance', svg: () => {
    const r = rng(83); let s = `<defs>${lg('g', [[0, '#22223b'], [0.6, '#4a4e69'], [1, '#c9ada7']])}${rg('m', [[0, '#fffaf0'], [0.5, '#fffaf0', 0.5], [1, '#fffaf0', 0]])}${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    for (let i = 0; i < 120; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * H * 0.6)}" r="${f(r() * 1.8 + 0.3)}" fill="#fff" opacity="${f(0.3 + r() * 0.6)}"/>`;
    s += `<circle cx="420" cy="300" r="260" fill="url(#m)"/><circle cx="420" cy="300" r="120" fill="#fffaf0"/><g fill="#1b1b2f">`;
    for (let i = 0; i < 12; i++) s += bird(700 + r() * 800, 150 + r() * 350, 1 + r() * 1.8);
    for (let i = 0; i < 40; i++) { const x = i * 42 + r() * 20; s += `<path d="M${f(x)} ${H} Q${f(x + 10)} ${f(H - 120)} ${f(x + 24)} ${f(H - 180 - r() * 120)}" stroke="#1b1b2f" stroke-width="3" fill="none"/>` + petals(x + 24, H - 200 - r() * 100, 16, 5, '#1b1b2f', r() * 60); }
    return s + '</g>' + noiseRect('n'); } },
  'rom-casal': { name: 'Silhueta do casal', group: 'romance', svg: () => {
    const r = rng(97); let s = `<defs>${lg('g', [[0, '#ffcdb2'], [0.5, '#ffb4a2'], [1, '#e5989b']])}${grain('n', 0.1)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="800" cy="640" r="260" fill="#fff4e6" opacity=".75"/>`;
    s += `<path d="M0 820 Q400 740 800 800 T1600 790 V1000 H0 Z" fill="#6d4c5a"/><g fill="#3a2430">`;
    // casal de mãos dadas
    s += `<circle cx="730" cy="560" r="26"/><path d="M712 586 Q700 650 690 700 L668 812 H690 L712 720 L724 812 H746 L748 700 Q760 650 750 590 Z"/><path d="M746 620 Q770 650 790 660 L795 650 Q775 640 755 610 Z"/>`;
    s += `<circle cx="860" cy="572" r="24"/><path d="M842 596 Q825 650 812 690 Q800 740 790 812 H890 Q880 740 870 690 Q868 650 878 600 Z"/><path d="M838 640 Q815 655 798 660 L796 650 Q812 645 832 625 Z"/>`;
    s += `<path d="M836 560 Q820 600 828 640 Q846 610 850 570 Z"/></g><g fill="#3a2430">`;
    for (let i = 0; i < 60; i++) { const x = r() * W; s += petals(x, 800 + r() * 150, 12 + r() * 10, 5, '#3a2430', r() * 72); }
    for (let i = 0; i < 5; i++) s += bird(1100 + r() * 400, 200 + r() * 200, 1.2 + r());
    return s + '</g>' + noiseRect('n'); } },

  // ============================================================ terror
  'ter-arvore': { name: 'Árvore morta e lua de sangue', group: 'terror', svg: () => {
    const r = rng(101); let s = `<defs>${lg('g', [[0, '#0b0b0b'], [0.6, '#3d0000'], [1, '#6a040f']])}${rg('m', [[0, '#ff4d4d'], [0.45, '#b00020', 0.7], [1, '#b00020', 0]])}${grain('n', 0.2)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1100" cy="330" r="380" fill="url(#m)"/><circle cx="1100" cy="330" r="170" fill="#d00000"/>`;
    const br = []; tree(r, 560, H + 20, 330, -Math.PI / 2, 60, 9, br);
    s += `<g stroke="#050505" fill="none" stroke-linecap="round">${br.join('')}</g><path d="M0 930 Q500 880 900 920 T1600 900 V1000 H0Z" fill="#050505"/>`;
    return s + noiseRect('n'); } },
  'ter-castelo': { name: 'Castelo e morcegos', group: 'terror', svg: () => {
    const r = rng(113); let s = `<defs>${lg('g', [[0, '#10002b'], [0.6, '#3c096c'], [1, '#5a189a']])}${rg('m', [[0, '#e0aaff', 0.9], [1, '#e0aaff', 0]])}${grain('n', 0.18)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="400" cy="260" r="200" fill="url(#m)"/><circle cx="400" cy="260" r="95" fill="#f3e8ff"/>`;
    s += `<g fill="#05000c"><path d="M0 860 Q300 760 700 790 Q1000 700 1300 760 Q1450 790 1600 770 V1000 H0Z"/>`;
    s += `<path d="M860 760 V520 h20 v-30 h20 v30 h20 v-30 h20 v30 h20 V760 Z"/><path d="M960 520 V380 h12 v-20 h12 v20 h12 v-20 h12 v20 h12 V520Z"/><path d="M948 380 L990 270 L1032 380Z"/><path d="M1040 760 V560 h16 v-24 h16 v24 h16 v-24 h16 v24 h16 V760 Z"/><path d="M1032 560 L1080 470 L1128 560Z"/><path d="M780 760 V600 h14 v-20 h14 v20 h14 v-20 h14 v20 h14 V760Z"/><path d="M772 600 L815 520 L858 600Z"/>`;
    s += '<g fill="#e0aaff" opacity=".85"><rect x="985" y="420" width="10" height="18"/><rect x="900" y="600" width="10" height="16"/><rect x="1075" y="610" width="10" height="16"/></g>';
    for (let i = 0; i < 26; i++) s += bat(500 + r() * 1050, 120 + r() * 380, 1 + r() * 1.6);
    return s + '</g>' + noiseRect('n'); } },
  'ter-floresta': { name: 'Floresta na névoa', group: 'terror', svg: () => {
    const r = rng(127); let s = `<defs>${lg('g', [[0, '#0d1b1e'], [1, '#2f3e46']])}${lg('fog', [[0, '#cad2c5', 0], [1, '#cad2c5', 0.45]])}${grain('n', 0.2)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    const pine = (x, base, h, c) => { let d = `M${f(x)} ${f(base - h)}`; for (let k = 0; k < 7; k++) { const y = base - h + (k + 1) * h / 7, w = (k + 1) * h / 18; d += ` L${f(x + w)} ${f(y)} L${f(x + w * 0.4)} ${f(y)}`; } d += ` L${f(x + 6)} ${base} L${f(x - 6)} ${base}`; for (let k = 6; k >= 0; k--) { const y = base - h + (k + 1) * h / 7, w = (k + 1) * h / 18; d += ` L${f(x - w * 0.4)} ${f(y)} L${f(x - w)} ${f(y)}`; } return `<path d="${d}Z" fill="${c}"/>`; };
    [['#34444a', 600, 0.5], ['#222d31', 800, 0.75], ['#0f1517', 1000, 1]].forEach(([c, base, sc], li) => { for (let i = 0; i < 18; i++) s += pine(i * 95 + r() * 60, base, (260 + r() * 260) * sc, c); s += `<rect y="${base - 300}" width="${W}" height="300" fill="url(#fog)" opacity="${0.8 - li * 0.25}"/>`; });
    for (let i = 0; i < 5; i++) { const x = 200 + r() * 1200, y = 650 + r() * 200; s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="7" ry="4" fill="#ffd60a"/><ellipse cx="${f(x + 24)}" cy="${f(y)}" rx="7" ry="4" fill="#ffd60a"/>`; }
    return s + noiseRect('n'); } },
  'ter-corvos': { name: 'Corvos no galho', group: 'terror', svg: () => {
    const r = rng(131); let s = `<defs>${lg('g', [[0, '#d6d6d6'], [1, '#8d8d8d']])}${grain('n', 0.25)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1250" cy="230" r="120" fill="#8b0000" opacity=".85"/>`;
    const br = []; tree(r, -60, 560, 520, -0.12, 34, 7, br);
    s += `<g stroke="#111" fill="none" stroke-linecap="round">${br.join('')}</g><g fill="#111">`;
    [[260, 520], [470, 480], [640, 455], [820, 410], [1000, 380]].forEach(([x, y], i) => { s += crow(x, y - 10, 2.2 + (i % 2) * 0.4, i % 2 === 0); });
    for (let i = 0; i < 9; i++) s += bird(900 + r() * 650, 120 + r() * 300, 1.4 + r());
    return s + '</g>' + noiseRect('n'); } },
  'ter-sangue': { name: 'Escorrido', group: 'terror', svg: () => {
    const r = rng(139); let s = `<defs>${lg('g', [[0, '#1a0000'], [1, '#000']])}${lg('b', [[0, '#7a0000'], [1, '#b10f2e']])}${grain('n', 0.25)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    let d = `M0 0 H${W} V80`; for (let x = W; x >= 0; x -= 40 + r() * 50) { const len = 60 + r() * (r() < 0.25 ? 700 : 260); const w = 10 + r() * 22; d += ` L${f(x)} 80 L${f(x)} ${f(80 + len)} Q${f(x - w / 2)} ${f(80 + len + w)} ${f(x - w)} ${f(80 + len)} L${f(x - w)} 80`; }
    s += `<path d="${d} L0 80 Z" fill="url(#b)"/>`;
    for (let i = 0; i < 30; i++) s += `<circle cx="${f(r() * W)}" cy="${f(300 + r() * 650)}" r="${f(3 + r() * 9)}" fill="#9d0208" opacity="${f(0.5 + r() * 0.5)}"/>`;
    return s + noiseRect('n'); } },

  // ============================================================ suspense
  'sus-cidade': { name: 'Cidade à noite', group: 'suspense', svg: () => {
    const r = rng(149); let s = `<defs>${lg('g', [[0, '#03045e'], [0.7, '#023e8a'], [1, '#0077b6']])}${lg('fog', [[0, '#90e0ef', 0], [1, '#90e0ef', 0.35]])}${grain('n', 0.15)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    [[0.55, '#03045e', 300], [0.8, '#020236', 180], [1, '#00001a', 60]].forEach(([sc, c, base]) => { let x = -20; while (x < W) { const w = 60 + r() * 120, h = (200 + r() * 450) * sc; s += `<rect x="${f(x)}" y="${f(H - base - h)}" width="${f(w)}" height="${f(h + base)}" fill="${c}"/>`; if (sc === 1) for (let wy = H - base - h + 20; wy < H - 30; wy += 28) for (let wx = x + 10; wx < x + w - 14; wx += 22) if (r() < 0.07) s += `<rect x="${f(wx)}" y="${f(wy)}" width="9" height="13" fill="#ffd166"/>`; x += w + 4; } s += `<rect y="${H - base - 260}" width="${W}" height="260" fill="url(#fog)"/>`; });
    return s + noiseRect('n'); } },
  'sus-escada': { name: 'Escada em espiral', group: 'suspense', svg: () => {
    let s = `<defs>${rg('g', [[0, '#f5f3f4'], [1, '#161a1d']], 0.5, 0.5, 0.7)}${grain('n', 0.2)}</defs><rect width="${W}" height="${H}" fill="#161a1d"/>`;
    for (let i = 0; i < 46; i++) { const sc = Math.pow(0.93, i), w = 1500 * sc, h = 940 * sc; s += `<rect x="${f(800 - w / 2)}" y="${f(500 - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${i % 2 ? '#2b2d31' : '#0b090a'}" stroke="#d3d3d3" stroke-opacity="${f(0.15 + i * 0.012)}" stroke-width="2" transform="rotate(${f(i * 4.2)} 800 500)"/>`; }
    return s + `<circle cx="800" cy="500" r="60" fill="#e5383b" opacity=".85"/>` + noiseRect('n'); } },
  'sus-chuva': { name: 'Chuva e poste', group: 'suspense', svg: () => {
    const r = rng(163); let s = `<defs>${lg('g', [[0, '#0b132b'], [1, '#1c2541']])}<linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe8a3" stop-opacity=".75"/><stop offset="1" stop-color="#ffe8a3" stop-opacity="0"/></linearGradient>${grain('n', 0.18)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
    s += `<path d="M1040 250 L820 1000 H1500 Z" fill="url(#cone)"/><g fill="#050a17"><rect x="1150" y="200" width="16" height="800"/><path d="M1158 210 Q1158 170 1100 170 H1020 V190 H1100 Q1140 190 1140 230 Z"/><path d="M990 240 H1080 L1060 196 H1010 Z"/>`;
    s += `<path d="M300 1000 V640 Q300 560 360 560 Q420 560 420 640 V1000 Z"/><circle cx="360" cy="520" r="36"/><path d="M300 505 H420 V492 H392 V460 H328 V492 H300Z"/></g>`;
    s += '<g stroke="#a9bcd0" stroke-opacity=".45" stroke-width="1.6">'; for (let i = 0; i < 420; i++) { const x = r() * W, y = r() * H, l = 18 + r() * 30; s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x - l * 0.25)}" y2="${f(y + l)}"/>`; } s += '</g>';
    return s + noiseRect('n'); } },
  'sus-digital': { name: 'Impressão digital', group: 'suspense', svg: () => {
    const r = rng(173); let s = `<defs>${grain('n', 0.15)}</defs><rect width="${W}" height="${H}" fill="#e9e4d8"/><g fill="none" stroke="#2b2b2b" stroke-linecap="round">`;
    for (let k = 1; k < 34; k++) { const rx = k * 16, ry = k * 21; let d = ''; for (let a = 0; a <= 360; a += 4) { const t = a * Math.PI / 180, w = 1 + 0.04 * Math.sin(t * 5 + k) + 0.03 * Math.sin(t * 3); const x = 760 + Math.cos(t) * rx * w, y = 520 + Math.sin(t) * ry * w; d += (a ? ' L' : 'M') + f(x) + ' ' + f(y); } if (r() < 0.85) s += `<path d="${d}" stroke-width="${f(3 + r() * 2)}" stroke-dasharray="${f(80 + r() * 200)} ${f(10 + r() * 30)}" opacity=".85"/>`; }
    s += `</g><g transform="rotate(-28 1200 300)"><circle cx="1200" cy="300" r="150" fill="#ffffff" fill-opacity=".25" stroke="#7f1d1d" stroke-width="22"/><rect x="1185" y="450" width="30" height="230" rx="12" fill="#7f1d1d"/></g>`;
    return s + noiseRect('n'); } },
  'sus-persianas': { name: 'Luz pela persiana', group: 'suspense', svg: () => {
    let s = `<defs>${lg('g', [[0, '#2d1e2f'], [1, '#0e0b16']])}${lg('l', [[0, '#f6bd60', 0.9], [1, '#f28482', 0.6]], 1, 0)}${grain('n', 0.2)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/><g transform="skewX(-22)">`;
    for (let i = 0; i < 12; i++) s += `<rect x="${500 + 0}" y="${80 + i * 70}" width="1100" height="34" fill="url(#l)" opacity="${f(0.55 + (i % 3) * 0.12)}"/>`;
    s += `</g><g fill="#0e0b16"><path d="M520 1000 L560 700 Q570 640 620 620 L700 600 Q740 590 760 620 L800 1000Z"/><circle cx="660" cy="540" r="54"/><path d="M570 520 Q660 470 750 520 L780 530 L540 530 Z"/><path d="M600 510 Q660 440 720 510Z"/></g>`;
    return s + noiseRect('n'); } }
};

module.exports = { ART, W, H };
