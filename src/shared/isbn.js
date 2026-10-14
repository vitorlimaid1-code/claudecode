/*
 * ISBN e código de barras EAN-13 (vetorial). Valida o ISBN (10 ou 13 dígitos), converte o
 * ISBN-10 para 13, gera as barras e os dígitos legíveis como contornos (sem fonte: funciona
 * no PDF/X-1a, no SVG e no EPS) e devolve tudo em milímetros, origem no canto superior esquerdo.
 * Compartilhado pela interface (prévia e download) e pelo processo principal (PDF da capa).
 * Contornos dos algarismos: IBM Plex Sans (SIL Open Font License 1.1).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Isbn = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const FONT = {"upm":1000,"capH":698,"g":{"0":[600,"M300 -12Q217 -12 164 31Q110 74 85 155Q60 235 60 349Q60 463 85 544Q110 625 164 668Q217 710 300 710Q384 710 437 668Q490 625 515 544Q540 463 540 349Q540 235 515 155Q490 74 437 31Q384 -12 300 -12CM300 61Q355 61 388 91Q421 120 437 173Q452 225 452 292L452 406Q452 474 437 526Q421 578 388 608Q355 637 300 637Q246 637 213 608Q179 578 164 526Q148 474 148 406L148 292Q148 225 164 173Q179 120 213 91Q246 61 300 61C"],"1":[600,"M547 0L88 0L88 74L283 74L283 636L276 636L100 472L51 525L236 698L367 698L367 74L547 74C"],"2":[600,"M533 74L533 0L75 0L75 86L303 296Q352 341 385 392Q418 443 418 493L418 505Q418 563 386 599Q354 635 289 635Q225 635 192 601Q158 567 144 517L69 546Q83 587 110 625Q136 662 181 686Q226 710 293 710Q361 710 409 684Q457 658 482 613Q507 567 507 507Q507 453 488 408Q468 363 434 323Q399 283 354 243L166 74C"],"3":[600,"M185 402L261 402Q332 402 368 435Q403 468 403 518L403 525Q403 580 369 608Q334 635 278 635Q224 635 190 612Q156 588 134 548L72 596Q90 624 117 650Q144 676 184 693Q224 710 280 710Q339 710 387 690Q435 669 464 630Q492 591 492 534Q492 467 453 426Q414 385 358 371L358 367Q396 360 430 339Q463 317 484 281Q505 244 505 191Q505 131 476 86Q446 40 393 14Q339 -12 268 -12Q208 -12 166 6Q123 23 94 50Q64 77 42 107L105 155Q132 114 168 89Q203 63 267 63Q341 63 379 97Q417 131 417 192L417 200Q417 262 379 296Q341 329 267 329L185 329C"],"4":[600,"M455 0L375 0L375 137L38 137L38 211L330 698L455 698L455 207L556 207L556 137L455 137CM370 633L117 207L375 207L375 633C"],"5":[600,"M498 698L498 624L192 624L172 358L179 358Q196 382 215 399Q234 416 260 426Q286 435 322 435Q382 435 429 409Q476 383 503 335Q530 287 530 219Q530 151 502 99Q474 47 422 18Q369 -12 295 -12Q237 -12 196 6Q155 23 127 50Q98 77 77 107L140 155Q167 114 200 89Q232 63 295 63Q366 63 404 101Q441 139 441 208L441 218Q441 287 404 325Q366 363 295 363Q247 363 220 346Q192 328 170 304L99 314L124 698C"],"6":[600,"M301 -12Q229 -12 177 21Q124 53 96 113Q67 173 67 256Q67 334 90 402Q112 470 150 527Q187 584 231 628Q274 671 316 698L424 698Q350 644 297 592Q243 539 208 478Q173 417 154 336L159 334Q176 363 199 386Q221 408 253 421Q285 434 327 434Q387 434 434 408Q480 382 507 334Q533 285 533 219Q533 151 504 99Q475 46 423 17Q371 -12 301 -12CM300 61Q346 61 379 78Q411 95 429 128Q446 161 446 208L446 216Q446 263 429 296Q411 329 379 346Q346 363 300 363Q254 363 222 346Q189 329 172 296Q154 263 154 216L154 208Q154 161 172 128Q189 95 222 78Q254 61 300 61C"],"7":[600,"M265 0L175 0L442 626L144 626L144 496L69 496L69 698L527 698L527 624C"],"8":[600,"M300 -12Q221 -12 167 15Q113 41 86 87Q58 133 58 190Q58 261 97 304Q136 346 199 363L199 371Q144 390 112 433Q79 475 79 535Q79 615 138 663Q196 710 300 710Q404 710 463 663Q521 615 521 535Q521 475 489 433Q456 390 401 371L401 363Q464 346 503 304Q542 261 542 190Q542 133 515 87Q487 41 434 15Q380 -12 300 -12CM300 61Q373 61 413 94Q453 127 453 186L453 207Q453 266 413 299Q373 332 300 332Q227 332 187 299Q147 266 147 207L147 186Q147 127 187 94Q227 61 300 61CM300 402Q365 402 400 431Q434 459 434 512L434 527Q434 580 400 609Q365 637 300 637Q235 637 201 609Q166 580 166 527L166 512Q166 459 201 431Q235 402 300 402C"],"9":[600,"M533 442Q533 364 511 296Q488 228 451 171Q413 114 370 71Q326 27 284 0L176 0Q251 55 304 107Q357 159 392 220Q427 281 446 362L441 364Q425 336 402 313Q379 290 348 277Q316 264 273 264Q213 264 167 290Q120 316 94 365Q67 413 67 479Q67 548 96 600Q125 652 177 681Q229 710 299 710Q372 710 424 678Q476 645 505 585Q533 525 533 442CM300 335Q346 335 379 352Q411 369 429 402Q446 435 446 482L446 490Q446 537 429 570Q411 603 379 620Q346 637 300 637Q254 637 222 620Q189 603 172 570Q154 537 154 490L154 482Q154 435 172 402Q189 369 222 352Q254 335 300 335C"],"I":[400,"M340 0L60 0L60 70L158 70L158 628L60 628L60 698L340 698L340 628L242 628L242 70L340 70C"],"S":[581,"M289 -12Q205 -12 145 21Q84 53 42 110L104 162Q141 113 186 88Q231 62 292 62Q367 62 407 98Q446 134 446 194Q446 227 433 250Q420 273 392 289Q363 304 317 314L260 327Q197 342 153 366Q109 390 86 428Q63 466 63 519Q63 581 92 624Q121 666 174 688Q226 710 294 710Q373 710 430 681Q486 652 525 596L462 550Q434 590 393 613Q351 636 290 636Q223 636 185 607Q146 578 146 522Q146 489 161 467Q175 445 204 431Q233 416 277 406L334 393Q402 378 445 352Q488 326 509 288Q529 250 529 198Q529 134 500 87Q471 40 418 14Q364 -12 289 -12C"],"B":[653,"M93 0L93 698L380 698Q466 698 516 649Q566 600 566 518Q566 466 548 435Q529 404 503 389Q476 374 453 370L453 364Q472 363 496 354Q519 344 541 325Q562 306 576 276Q590 246 590 202Q590 145 567 99Q543 53 503 27Q462 0 410 0CM177 324L177 74L384 74Q420 74 446 87Q472 99 486 123Q500 147 500 182L500 216Q500 251 486 275Q472 299 446 312Q420 324 384 324CM177 624L177 396L370 396Q403 396 427 408Q450 419 463 441Q476 462 476 493L476 527Q476 558 463 580Q450 601 427 613Q403 624 370 624C"],"N":[707,"M517 0L262 426L178 581L175 581L175 0L93 0L93 698L190 698L445 272L529 117L532 117L532 698L614 698L614 0C"],"-":[399,"M330 261L69 261L69 347L330 347C"],"X":[613,"M24 0L252 355L30 698L131 698L306 420L308 420L487 698L583 698L359 358L589 0L488 0L305 293L303 293L120 0C"]," ":[236,""]}};

  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const Gc = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const R = L.map(s => s.replace(/./g, c => (c === '0' ? '1' : '0')));
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  const check13 = d => { let s = 0; for (let i = 0; i < 12; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return String((10 - (s % 10)) % 10); };
  const check10 = d => { let s = 0; for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i); const c = (11 - (s % 11)) % 11; return c === 10 ? 'X' : String(c); };

  // Valida e normaliza. Retorna { ok, isbn13, display, error, converted }
  function parse(input) {
    const raw = String(input || '').trim().replace(/^ISBN(-1[03])?:?\s*/i, '');
    const d = raw.toUpperCase().replace(/[^0-9X]/g, '');
    if (!d) return { ok: false, error: 'Digite o ISBN.' };
    if (d.length === 13 && /^\d{13}$/.test(d)) {
      if (!/^97[89]/.test(d)) return { ok: false, error: 'O ISBN-13 começa com 978 ou 979.' };
      const c = check13(d);
      if (c !== d[12]) return { ok: false, error: `Dígito verificador incorreto: o último dígito deveria ser ${c}. Confira o ISBN do pré-cadastro.` };
      return { ok: true, isbn13: d, display: display(raw, d) };
    }
    if (d.length === 10 && /^\d{9}[\dX]$/.test(d)) {
      const c = check10(d);
      if (c !== d[9]) return { ok: false, error: `Dígito verificador do ISBN-10 incorreto (deveria ser ${c}).` };
      const b = '978' + d.slice(0, 9);
      const isbn13 = b + check13(b);
      const dsp = display(raw, d);
      return { ok: true, isbn13, display: dsp.includes('-') ? '978-' + dsp.replace(/-?[\dX]$/, '') + '-' + isbn13[12] : isbn13, converted: true };
    }
    if (d.length === 12 && /^97[89]\d{9}$/.test(d)) return { ok: false, error: `Falta o dígito verificador: o ISBN completo seria ${d + check13(d)}.` };
    return { ok: false, error: `O ISBN tem ${d.length} dígitos; deve ter 13 (ou 10, que será convertido).` };
  }
  // Mantém os hífens digitados pelo usuário (grupos do ISBN); sem hífens, usa os 13 dígitos
  function display(raw, d) {
    const t = raw.toUpperCase().replace(/[\s.]+/g, '-').replace(/[^0-9X-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return t.replace(/-/g, '') === d && t.includes('-') ? t : d;
  }

  // Módulos do EAN-13 (95): string de 0/1
  function modules(code) {
    const p = PARITY[Number(code[0])];
    let s = '101';
    for (let i = 1; i <= 6; i++) s += (p[i - 1] === 'L' ? L : Gc)[Number(code[i])];
    s += '01010';
    for (let i = 7; i <= 12; i++) s += R[Number(code[i])];
    return s + '101';
  }

  // Contorno de um texto: [{ d (comandos em mm, y para baixo) }]
  function textPath(str, x, baseline, capMm) {
    const k = capMm / FONT.capH;
    let cx = x;
    const out = [];
    for (const ch of str) {
      const g = FONT.g[ch];
      if (!g) continue;
      const ops = [];
      const re = /([MLQCZ])([^MLQCZ]*)/g;
      let m;
      while ((m = re.exec(g[1]))) {
        const n = m[2].trim() ? m[2].trim().split(/\s+/).map(Number) : [];
        const pts = [];
        for (let i = 0; i < n.length; i += 2) pts.push([cx + n[i] * k, baseline - n[i + 1] * k]);
        ops.push({ op: m[1] === 'C' && !n.length ? 'Z' : m[1], pts });
      }
      out.push(ops);
      cx += g[0] * k;
    }
    return out;
  }
  const textWidth = (str, capMm) => [...str].reduce((s, ch) => s + (FONT.g[ch] ? FONT.g[ch][0] : 0), 0) * capMm / FONT.capH;

  /*
   * Desenho completo do código (mm). Padrão GS1 a 100%: módulo 0,33 mm (barras com 31,35 mm),
   * zonas de silêncio de 11 e 7 módulos. O quadro branco garante a distância mínima de 2,5 mm
   * entre as barras e qualquer outro elemento da contracapa (exigência do manual Cedet).
   */
  function layout(isbnInput, opts) {
    const r = parse(isbnInput);
    if (!r.ok) return Object.assign({ ok: false }, r);
    opts = opts || {};
    const scale = Math.max(1, Number(opts.scale) || 1); // mínimo 100% (31 mm de largura)
    const mod = 0.33 * scale;
    const barH = Math.max(17.4 * scale, Number(opts.barHeight) || 20 * scale);
    const guardExt = 5 * mod;
    const cap = 2.3 * scale; // algarismo cabe no espaço de 7 módulos
    const clear = Math.max(2.5, Number(opts.clearance) || 2.5);
    const qL = Math.max(11 * mod, clear), qR = Math.max(7 * mod, clear);
    const showTop = opts.showIsbnText !== false;
    const topCap = 2.2 * scale;
    const topH = showTop ? topCap + 1.2 * scale : 0;
    const x0 = qL, y0 = clear + topH;
    const bits = modules(r.isbn13);
    const rects = [];
    const bwr = Math.max(0, Number(opts.barWidthReduction) || 0); // compensação de ganho de ponto (mm)
    for (let i = 0; i < 95;) {
      if (bits[i] !== '1') { i++; continue; }
      let j = i;
      while (j < 95 && bits[j] === '1') j++;
      const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      rects.push({ x: x0 + i * mod + bwr / 2, y: y0, w: (j - i) * mod - bwr, h: barH + (guard ? guardExt : 0) });
      i = j;
    }
    // os dígitos ficam abaixo das barras normais; as barras-guia descem entre eles (padrão EAN-13)
    const base = y0 + barH + 0.35 * scale + cap;
    const glyphs = [];
    const digit = (ch, cxMid) => glyphs.push(...textPath(ch, cxMid - textWidth(ch, cap) / 2, base, cap));
    digit(r.isbn13[0], x0 - 4 * mod);
    for (let i = 1; i <= 6; i++) digit(r.isbn13[i], x0 + (3 + (i - 1) * 7 + 3.5) * mod);
    for (let i = 7; i <= 12; i++) digit(r.isbn13[i], x0 + (50 + (i - 7) * 7 + 3.5) * mod);
    const w = qL + 95 * mod + qR;
    if (showTop) {
      const t = 'ISBN ' + r.display;
      const tc = Math.min(topCap, 95 * mod / textWidth(t, 1)); // reduz para caber na largura das barras
      const tw = textWidth(t, tc);
      glyphs.push(...textPath(t, x0 + (95 * mod - tw) / 2, clear + topCap, tc));
    }
    const h = Math.max(y0 + barH + guardExt, base) + clear;
    return { ok: true, isbn13: r.isbn13, display: r.display, converted: !!r.converted, w, h, rects, glyphs, module: mod, symbolW: 95 * mod, symbolH: Math.max(barH + guardExt, base - y0) };
  }

  // Posição do quadro do código na contracapa (mm na capa aberta, sem sangria = 0 no corte)
  // pos: 'br' inferior direito (padrão), 'bc' inferior centro, 'bl' inferior esquerdo; dx/dy = distância do corte/dobra
  function place(geom, lay, o) {
    o = o || {};
    const back = geom.backTrim; // [x, largura] da contracapa no arquivo com sangria
    const dx = Math.max(0, Number(o.dx != null && o.dx !== '' ? o.dx : 12));
    const dy = Math.max(0, Number(o.dy != null && o.dy !== '' ? o.dy : 12));
    const pos = o.pos || 'br';
    let x;
    if (pos === 'bl') x = back[0] + dx;
    else if (pos === 'bc') x = back[0] + (back[1] - lay.w) / 2;
    else x = back[0] + back[1] - dx - lay.w; // junto à lombada
    const y = geom.outer + geom.H - dy - lay.h;
    return { x, y };
  }

  const f = v => (Math.round(v * 1000) / 1000).toString();
  function toSvg(lay, opts) {
    const bg = !opts || opts.background !== false;
    const paths = lay.glyphs.map(ops => ops.map(o => o.op + o.pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' ')).join('')).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + f(lay.w) + 'mm" height="' + f(lay.h) + 'mm" viewBox="0 0 ' + f(lay.w) + ' ' + f(lay.h) + '">'
      + (bg ? '<rect width="' + f(lay.w) + '" height="' + f(lay.h) + '" fill="#fff"/>' : '')
      + '<g fill="#000">' + lay.rects.map(r => '<rect x="' + f(r.x) + '" y="' + f(r.y) + '" width="' + f(r.w) + '" height="' + f(r.h) + '"/>').join('')
      + '<path d="' + paths + '"/></g></svg>';
  }

  // Operadores de caminho PDF/PostScript (pontos, y para cima) para (ox, oy) em mm, página com altura H mm
  function pathOps(lay, ox, oyTop, pageHmm, ps) {
    const k = 72 / 25.4;
    const X = x => f((ox + x) * k), Y = y => f((pageHmm - (oyTop + y)) * k);
    const out = [];
    const mv = ps ? ' moveto' : ' m', ln = ps ? ' lineto' : ' l', cv = ps ? ' curveto' : ' c', cl = ps ? ' closepath' : ' h';
    lay.rects.forEach(r => out.push(ps ? X(r.x) + ' ' + Y(r.y + r.h) + ' ' + f(r.w * k) + ' ' + f(r.h * k) + ' rectfill' : X(r.x) + ' ' + Y(r.y + r.h) + ' ' + f(r.w * k) + ' ' + f(r.h * k) + ' re'));
    const glyphOps = [];
    lay.glyphs.forEach(ops => {
      let cur = [0, 0], start = [0, 0];
      ops.forEach(o => {
        const p = o.pts;
        if (o.op === 'M') { cur = start = p[0]; glyphOps.push(X(p[0][0]) + ' ' + Y(p[0][1]) + mv); }
        else if (o.op === 'L') { cur = p[0]; glyphOps.push(X(p[0][0]) + ' ' + Y(p[0][1]) + ln); }
        else if (o.op === 'Q') { // quadrática -> cúbica
          const c1 = [cur[0] + 2 / 3 * (p[0][0] - cur[0]), cur[1] + 2 / 3 * (p[0][1] - cur[1])];
          const c2 = [p[1][0] + 2 / 3 * (p[0][0] - p[1][0]), p[1][1] + 2 / 3 * (p[0][1] - p[1][1])];
          glyphOps.push([c1, c2, p[1]].map(q => X(q[0]) + ' ' + Y(q[1])).join(' ') + cv); cur = p[1];
        } else if (o.op === 'C') { glyphOps.push(p.map(q => X(q[0]) + ' ' + Y(q[1])).join(' ') + cv); cur = p[2]; }
        else { glyphOps.push(cl); cur = start; }
      });
    });
    return { bars: out, glyphs: glyphOps };
  }

  // EPS vetorial em preto 100% K (DeviceCMYK), como pede o manual
  function toEps(lay) {
    const k = 72 / 25.4;
    const W = lay.w * k, H = lay.h * k;
    const { bars, glyphs } = pathOps(lay, 0, 0, lay.h, true);
    return ['%!PS-Adobe-3.0 EPSF-3.0', '%%BoundingBox: 0 0 ' + Math.ceil(W) + ' ' + Math.ceil(H), '%%HiResBoundingBox: 0 0 ' + f(W) + ' ' + f(H),
      '%%Title: ISBN ' + lay.display, '%%Creator: Casa Vertigem Hub', '%%DocumentProcessColors: Black', '%%EndComments',
      'gsave', '0 0 0 0 setcmykcolor 0 0 ' + f(W) + ' ' + f(H) + ' rectfill', '0 0 0 1 setcmykcolor']
      .concat(bars, ['newpath'], glyphs, ['fill', 'grestore', 'showpage', '%%EOF']).join('\n') + '\n';
  }

  return { parse, modules, layout, place, toSvg, toEps, pathOps, check13 };
});
