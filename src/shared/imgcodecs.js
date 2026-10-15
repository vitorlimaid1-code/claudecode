// Formatos de imagem escritos em JavaScript puro, sem dependências (rodam na interface, num Web Worker
// e no processo principal). Todos trabalham com { width, height, data } em RGBA de 8 bits.
//  Gravação: BMP, TGA, PPM/PGM/PBM/PAM, QOI, GIF (paleta de 256 cores por corte mediano), TIFF, ICO
//  (com imagens PNG dentro) e SVG (imagem embutida).
//  Leitura: TGA, PPM/PGM/PBM/PAM, QOI e BMP (o BMP também é lido pelo navegador).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ImgCodecs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------------------------------------------------------------- utilidades
  class Writer {
    constructor(size) { this.buf = new Uint8Array(size || 1024); this.pos = 0; }
    ensure(n) { if (this.pos + n > this.buf.length) { const b = new Uint8Array(Math.max(this.buf.length * 2, this.pos + n)); b.set(this.buf); this.buf = b; } }
    u8(v) { this.ensure(1); this.buf[this.pos++] = v & 255; }
    u16(v) { this.ensure(2); this.buf[this.pos++] = v & 255; this.buf[this.pos++] = (v >> 8) & 255; }
    u32(v) { this.ensure(4); for (let i = 0; i < 4; i++) this.buf[this.pos++] = (v >>> (8 * i)) & 255; }
    u32be(v) { this.ensure(4); for (let i = 3; i >= 0; i--) this.buf[this.pos++] = (v >>> (8 * i)) & 255; }
    bytes(a) { this.ensure(a.length); this.buf.set(a, this.pos); this.pos += a.length; }
    ascii(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
    out() { return this.buf.slice(0, this.pos); }
  }
  // cor de fundo para formatos sem transparência
  function flatten(img, bg) {
    const c = bg || [255, 255, 255];
    const d = img.data, out = new Uint8Array(img.width * img.height * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      const a = d[i + 3] / 255;
      out[j] = Math.round(d[i] * a + c[0] * (1 - a)); out[j + 1] = Math.round(d[i + 1] * a + c[1] * (1 - a)); out[j + 2] = Math.round(d[i + 2] * a + c[2] * (1 - a));
    }
    return out;
  }
  const hasAlpha = img => { const d = img.data; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true; return false; };

  // ---------------------------------------------------------------- BMP (32 bits com transparência, BITMAPV4)
  function encodeBMP(img) {
    const { width: w, height: h, data: d } = img;
    const alpha = hasAlpha(img);
    const bpp = alpha ? 32 : 24;
    const row = alpha ? w * 4 : ((w * 3 + 3) & ~3);
    const hdr = alpha ? 108 : 40;
    const W = new Writer(14 + hdr + row * h);
    W.ascii('BM'); W.u32(14 + hdr + row * h); W.u32(0); W.u32(14 + hdr);
    W.u32(hdr); W.u32(w); W.u32(h); W.u16(1); W.u16(bpp); W.u32(alpha ? 3 : 0); W.u32(row * h); W.u32(2835); W.u32(2835); W.u32(0); W.u32(0);
    if (alpha) { W.u32(0x00ff0000); W.u32(0x0000ff00); W.u32(0x000000ff); W.u32(0xff000000); W.ascii('BGRs'); for (let i = 0; i < 12; i++) W.u32(0); }
    const pad = row - w * (alpha ? 4 : 3);
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; W.u8(d[i + 2]); W.u8(d[i + 1]); W.u8(d[i]); if (alpha) W.u8(d[i + 3]); }
      for (let p = 0; p < pad; p++) W.u8(0);
    }
    return W.out();
  }

  // ---------------------------------------------------------------- TGA (32 bits, RLE)
  function encodeTGA(img) {
    const { width: w, height: h, data: d } = img;
    const W = new Writer(18 + w * h * 4);
    W.u8(0); W.u8(0); W.u8(10); W.u16(0); W.u16(0); W.u8(0); W.u16(0); W.u16(0); W.u16(w); W.u16(h); W.u8(32); W.u8(0x28); // origem no topo, 8 bits de alfa
    for (let y = 0; y < h; y++) {
      let x = 0;
      const px = k => { const i = (y * w + k) * 4; return [d[i + 2], d[i + 1], d[i], d[i + 3]]; };
      const same = (a, b) => { const i = (y * w + a) * 4, j = (y * w + b) * 4; return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3]; };
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 128 && same(x, x + run)) run++;
        if (run > 1) { W.u8(0x80 | (run - 1)); W.bytes(px(x)); x += run; continue; }
        let raw = 1;
        while (x + raw < w && raw < 128 && !(x + raw + 1 < w && same(x + raw, x + raw + 1))) raw++;
        W.u8(raw - 1);
        for (let k = 0; k < raw; k++) W.bytes(px(x + k));
        x += raw;
      }
    }
    return W.out();
  }
  function decodeTGA(buf) {
    const b = buf;
    const idLen = b[0], cmapType = b[1], type = b[2];
    const cmapLen = b[5] | (b[6] << 8), cmapBits = b[7];
    const w = b[12] | (b[13] << 8), h = b[14] | (b[15] << 8), bpp = b[16], desc = b[17];
    if (![1, 2, 3, 9, 10, 11].includes(type)) throw new Error('TGA: tipo não suportado');
    let p = 18 + idLen;
    const cmap = [];
    if (cmapType) { const cb = Math.ceil(cmapBits / 8); for (let i = 0; i < cmapLen; i++, p += cb) cmap.push(readPx(p, cmapBits, false)); }
    const out = new Uint8Array(w * h * 4);
    const bypp = Math.ceil(bpp / 8);
    function readPx(o, bits, gray) {
      if (gray) return [b[o], b[o], b[o], bits === 16 ? b[o + 1] : 255];
      if (bits === 15 || bits === 16) { const v = b[o] | (b[o + 1] << 8); return [((v >> 10) & 31) * 255 / 31 | 0, ((v >> 5) & 31) * 255 / 31 | 0, (v & 31) * 255 / 31 | 0, bits === 16 && !(v & 0x8000) && (desc & 15) ? 0 : 255]; }
      return [b[o + 2], b[o + 1], b[o], bits === 32 ? b[o + 3] : 255];
    }
    const gray = type === 3 || type === 11, mapped = type === 1 || type === 9;
    const get = o => (mapped ? cmap[b[o]] || [0, 0, 0, 255] : readPx(o, bpp, gray));
    const n = w * h;
    let k = 0;
    const put = c => { out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = c[3]; k++; };
    if (type >= 9) {
      while (k < n && p < b.length) {
        const hdr = b[p++], cnt = (hdr & 127) + 1;
        if (hdr & 128) { const c = get(p); p += bypp; for (let i = 0; i < cnt && k < n; i++) put(c); }
        else for (let i = 0; i < cnt && k < n; i++) { put(get(p)); p += bypp; }
      }
    } else for (; k < n;) { put(get(p)); p += bypp; }
    // origem embaixo (padrão do TGA): inverte as linhas
    const top = desc & 0x20;
    if (!top) { const row = w * 4, tmp = new Uint8Array(row); for (let y = 0; y < (h >> 1); y++) { const a = y * row, c = (h - 1 - y) * row; tmp.set(out.subarray(a, a + row)); out.copyWithin(a, c, c + row); out.set(tmp, c); } }
    if (desc & 0x10) { for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) { const a = (y * w + x) * 4, c = (y * w + w - 1 - x) * 4; for (let i = 0; i < 4; i++) { const t = out[a + i]; out[a + i] = out[c + i]; out[c + i] = t; } } }
    return { width: w, height: h, data: out };
  }

  // ---------------------------------------------------------------- PPM / PGM / PBM / PAM (Netpbm)
  function encodePNM(img, kind, bg) {
    const { width: w, height: h, data: d } = img;
    if (kind === 'pam') {
      const head = `P7\nWIDTH ${w}\nHEIGHT ${h}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`;
      const W = new Writer(head.length + d.length); W.ascii(head); W.bytes(d); return W.out();
    }
    const rgb = flatten(img, bg);
    if (kind === 'ppm') { const head = `P6\n${w} ${h}\n255\n`; const W = new Writer(head.length + rgb.length); W.ascii(head); W.bytes(rgb); return W.out(); }
    if (kind === 'pgm') {
      const head = `P5\n${w} ${h}\n255\n`; const W = new Writer(head.length + w * h); W.ascii(head);
      for (let i = 0; i < rgb.length; i += 3) W.u8(Math.round(rgb[i] * 0.299 + rgb[i + 1] * 0.587 + rgb[i + 2] * 0.114));
      return W.out();
    }
    // PBM: preto e branco com pontilhado Floyd–Steinberg
    const head = `P4\n${w} ${h}\n`; const rowB = (w + 7) >> 3; const W = new Writer(head.length + rowB * h); W.ascii(head);
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; j < g.length; i += 3, j++) g[j] = rgb[i] * 0.299 + rgb[i + 1] * 0.587 + rgb[i + 2] * 0.114;
    for (let y = 0; y < h; y++) {
      const bits = new Uint8Array(rowB);
      for (let x = 0; x < w; x++) {
        const i = y * w + x, old = g[i], v = old < 128 ? 0 : 255, e = old - v;
        if (!v) bits[x >> 3] |= 0x80 >> (x & 7);
        if (x + 1 < w) g[i + 1] += e * 7 / 16;
        if (y + 1 < h) { if (x) g[i + w - 1] += e * 3 / 16; g[i + w] += e * 5 / 16; if (x + 1 < w) g[i + w + 1] += e / 16; }
      }
      W.bytes(bits);
    }
    return W.out();
  }
  function decodePNM(buf) {
    const b = buf;
    let p = 0;
    const tok = () => {
      for (;;) { while (p < b.length && /\s/.test(String.fromCharCode(b[p]))) p++; if (b[p] === 35) { while (p < b.length && b[p] !== 10) p++; } else break; }
      let s = ''; while (p < b.length && !/\s/.test(String.fromCharCode(b[p]))) s += String.fromCharCode(b[p++]); return s;
    };
    const magic = tok();
    if (magic === 'P7') {
      const hdr = {};
      for (;;) { const line = []; while (p < b.length && b[p] !== 10) line.push(b[p++]); p++; const t = String.fromCharCode(...line).trim(); if (t === 'ENDHDR') break; const [k, ...v] = t.split(/\s+/); if (k) hdr[k] = v.join(' '); }
      const w = +hdr.WIDTH, h = +hdr.HEIGHT, dep = +hdr.DEPTH, max = +hdr.MAXVAL || 255;
      const out = new Uint8Array(w * h * 4), sc = 255 / max;
      for (let i = 0; i < w * h; i++) {
        const px = []; for (let c = 0; c < dep; c++) px.push(max > 255 ? ((b[p++] << 8) | b[p++]) * sc : b[p++] * sc);
        const g = dep < 3;
        out[i * 4] = px[0]; out[i * 4 + 1] = g ? px[0] : px[1]; out[i * 4 + 2] = g ? px[0] : px[2]; out[i * 4 + 3] = dep === 2 ? px[1] : dep === 4 ? px[3] : 255;
      }
      return { width: w, height: h, data: out };
    }
    const w = +tok(), h = +tok();
    const max = magic === 'P1' || magic === 'P4' ? 1 : +tok();
    const out = new Uint8Array(w * h * 4);
    const ascii = /^P[123]$/.test(magic);
    if (!ascii) p++; // um espaço depois do cabeçalho
    const sc = 255 / max;
    const val = () => (ascii ? +tok() : max > 255 ? (b[p++] << 8) | b[p++] : b[p++]);
    for (let y = 0; y < h; y++) {
      if (magic === 'P4') { const rowB = (w + 7) >> 3; for (let x = 0; x < w; x++) { const v = (b[p + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255; const i = (y * w + x) * 4; out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255; } p += rowB; continue; }
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (magic === 'P1') { const v = +tok() ? 0 : 255; out[i] = out[i + 1] = out[i + 2] = v; }
        else if (magic === 'P2' || magic === 'P5') { const v = val() * sc; out[i] = out[i + 1] = out[i + 2] = v; }
        else { out[i] = val() * sc; out[i + 1] = val() * sc; out[i + 2] = val() * sc; }
        out[i + 3] = 255;
      }
    }
    return { width: w, height: h, data: out };
  }

  // ---------------------------------------------------------------- QOI
  function encodeQOI(img) {
    const { width: w, height: h, data: d } = img;
    const W = new Writer(14 + w * h * 5 + 8);
    W.ascii('qoif'); W.u32be(w); W.u32be(h); W.u8(4); W.u8(0);
    const idx = new Uint8Array(256);
    let pr = 0, pg = 0, pb = 0, pa = 255, run = 0;
    const n = w * h;
    for (let k = 0; k < n; k++) {
      const i = k * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (r === pr && g === pg && b === pb && a === pa) { run++; if (run === 62 || k === n - 1) { W.u8(0xc0 | (run - 1)); run = 0; } continue; }
      if (run) { W.u8(0xc0 | (run - 1)); run = 0; }
      const h6 = ((r * 3 + g * 5 + b * 7 + a * 11) % 64) * 4;
      if (idx[h6] === r && idx[h6 + 1] === g && idx[h6 + 2] === b && idx[h6 + 3] === a) W.u8(h6 >> 2);
      else {
        idx[h6] = r; idx[h6 + 1] = g; idx[h6 + 2] = b; idx[h6 + 3] = a;
        if (a === pa) {
          const vr = ((r - pr + 384) % 256) - 128, vg = ((g - pg + 384) % 256) - 128, vb = ((b - pb + 384) % 256) - 128;
          const vgr = vr - vg, vgb = vb - vg;
          if (vr > -3 && vr < 2 && vg > -3 && vg < 2 && vb > -3 && vb < 2) W.u8(0x40 | ((vr + 2) << 4) | ((vg + 2) << 2) | (vb + 2));
          else if (vgr > -9 && vgr < 8 && vg > -33 && vg < 32 && vgb > -9 && vgb < 8) { W.u8(0x80 | (vg + 32)); W.u8(((vgr + 8) << 4) | (vgb + 8)); }
          else { W.u8(0xfe); W.u8(r); W.u8(g); W.u8(b); }
        } else { W.u8(0xff); W.u8(r); W.u8(g); W.u8(b); W.u8(a); }
      }
      pr = r; pg = g; pb = b; pa = a;
    }
    for (let i = 0; i < 7; i++) W.u8(0); W.u8(1);
    return W.out();
  }
  function decodeQOI(b) {
    if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'qoif') throw new Error('QOI inválido');
    const w = (b[4] << 24 | b[5] << 16 | b[6] << 8 | b[7]) >>> 0, h = (b[8] << 24 | b[9] << 16 | b[10] << 8 | b[11]) >>> 0;
    const out = new Uint8Array(w * h * 4), idx = new Uint8Array(256);
    let p = 14, r = 0, g = 0, bl = 0, a = 255, run = 0;
    for (let k = 0; k < w * h; k++) {
      if (run) run--;
      else {
        const t = b[p++];
        if (t === 0xfe) { r = b[p++]; g = b[p++]; bl = b[p++]; }
        else if (t === 0xff) { r = b[p++]; g = b[p++]; bl = b[p++]; a = b[p++]; }
        else if ((t & 0xc0) === 0x00) { const i = (t & 63) * 4; r = idx[i]; g = idx[i + 1]; bl = idx[i + 2]; a = idx[i + 3]; }
        else if ((t & 0xc0) === 0x40) { r = (r + ((t >> 4) & 3) - 2) & 255; g = (g + ((t >> 2) & 3) - 2) & 255; bl = (bl + (t & 3) - 2) & 255; }
        else if ((t & 0xc0) === 0x80) { const t2 = b[p++], vg = (t & 63) - 32; r = (r + vg - 8 + ((t2 >> 4) & 15)) & 255; g = (g + vg) & 255; bl = (bl + vg - 8 + (t2 & 15)) & 255; }
        else run = t & 63;
        const h6 = ((r * 3 + g * 5 + bl * 7 + a * 11) % 64) * 4;
        idx[h6] = r; idx[h6 + 1] = g; idx[h6 + 2] = bl; idx[h6 + 3] = a;
      }
      out[k * 4] = r; out[k * 4 + 1] = g; out[k * 4 + 2] = bl; out[k * 4 + 3] = a;
    }
    return { width: w, height: h, data: out };
  }

  // ---------------------------------------------------------------- GIF (corte mediano + LZW)
  function quantize(img, maxColors) {
    const d = img.data, n = img.width * img.height;
    const step = Math.max(1, Math.floor(n / 120000));
    const pts = [];
    for (let k = 0; k < n; k += step) { const i = k * 4; if (d[i + 3] >= 128) pts.push([d[i], d[i + 1], d[i + 2]]); }
    if (!pts.length) pts.push([0, 0, 0]);
    let boxes = [pts];
    while (boxes.length < maxColors) {
      // divide a caixa com maior extensão (ponderada pela quantidade de pontos)
      let best = -1, bestScore = -1, bestCh = 0;
      boxes.forEach((bx, bi) => {
        if (bx.length < 2) return;
        for (let c = 0; c < 3; c++) {
          let mn = 255, mx = 0; for (const p of bx) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; }
          const sc = (mx - mn) * Math.sqrt(bx.length);
          if (sc > bestScore) { bestScore = sc; best = bi; bestCh = c; }
        }
      });
      if (best < 0 || bestScore <= 0) break;
      const bx = boxes[best].sort((a, b) => a[bestCh] - b[bestCh]);
      const mid = bx.length >> 1;
      boxes.splice(best, 1, bx.slice(0, mid), bx.slice(mid));
    }
    return boxes.map(bx => { let r = 0, g = 0, b = 0; for (const p of bx) { r += p[0]; g += p[1]; b += p[2]; } return [Math.round(r / bx.length), Math.round(g / bx.length), Math.round(b / bx.length)]; });
  }
  function encodeGIF(img, opts) {
    opts = opts || {};
    const { width: w, height: h, data: d } = img;
    const alpha = hasAlpha(img);
    const pal = quantize(img, alpha ? 255 : 256);
    const trans = alpha ? pal.length : -1;
    const full = pal.concat(alpha ? [[0, 0, 0]] : []);
    let bits = 1; while ((1 << bits) < full.length) bits++;
    while (full.length < (1 << bits)) full.push([0, 0, 0]);
    // cor mais próxima com cache de 15 bits; pontilhado Floyd–Steinberg opcional
    const cache = new Int16Array(32768).fill(-1);
    const nearest = (r, g, b) => {
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let c = cache[key];
      if (c >= 0) return c;
      let bd = 1e9; c = 0;
      for (let i = 0; i < pal.length; i++) { const p = pal[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, dd = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (dd < bd) { bd = dd; c = i; } }
      cache[key] = c;
      return c;
    };
    const ix = new Uint8Array(w * h);
    const dither = opts.dither !== false;
    const err = dither ? new Float32Array(w * h * 3) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x, i = k * 4;
      if (alpha && d[i + 3] < 128) { ix[k] = trans; continue; }
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (dither) { r = Math.max(0, Math.min(255, r + err[k * 3])); g = Math.max(0, Math.min(255, g + err[k * 3 + 1])); b = Math.max(0, Math.min(255, b + err[k * 3 + 2])); }
      const c = nearest(r | 0, g | 0, b | 0);
      ix[k] = c;
      if (dither) {
        const p = pal[c], er = r - p[0], eg = g - p[1], eb = b - p[2];
        const spread = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += er * f; err[j + 1] += eg * f; err[j + 2] += eb * f; };
        spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
      }
    }
    const W = new Writer(w * h + 1024);
    W.ascii('GIF89a'); W.u16(w); W.u16(h); W.u8(0x80 | 0x70 | (bits - 1)); W.u8(0); W.u8(0);
    full.forEach(c => { W.u8(c[0]); W.u8(c[1]); W.u8(c[2]); });
    if (alpha) { W.u8(0x21); W.u8(0xf9); W.u8(4); W.u8(1); W.u16(0); W.u8(trans); W.u8(0); }
    W.u8(0x2c); W.u16(0); W.u16(0); W.u16(w); W.u16(h); W.u8(0);
    const minCode = Math.max(2, bits);
    W.u8(minCode);
    lzw(ix, minCode, W);
    W.u8(0x3b);
    return W.out();
  }
  function lzw(ix, minCode, W) {
    const clear = 1 << minCode, eoi = clear + 1;
    let size = minCode + 1, next = eoi + 1;
    const dict = new Map();
    let cur = 0, nbits = 0;
    const block = [];
    const flush = () => { if (!block.length) return; W.u8(block.length); W.bytes(block); block.length = 0; };
    const emit = code => { cur |= code << nbits; nbits += size; while (nbits >= 8) { block.push(cur & 255); cur >>>= 8; nbits -= 8; if (block.length === 255) flush(); } };
    emit(clear);
    let prefix = ix[0];
    for (let i = 1; i < ix.length; i++) {
      const c = ix[i], key = (prefix << 8) | c;
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear); dict.clear(); size = minCode + 1; next = eoi + 1; }
      prefix = c;
    }
    emit(prefix); emit(eoi);
    if (nbits > 0) { block.push(cur & 255); if (block.length === 255) flush(); }
    flush();
    W.u8(0);
  }

  // ---------------------------------------------------------------- TIFF (RGBA, sem compressão; resolução em dpi)
  function encodeTIFF(img, dpi) {
    const { width: w, height: h, data: d } = img;
    const alpha = hasAlpha(img);
    const spp = alpha ? 4 : 3;
    const pix = alpha ? d : flatten(img);
    const nTags = alpha ? 13 : 12;
    const ifd = 8, ifdSize = 2 + nTags * 12 + 4;
    const bpsOff = ifd + ifdSize, resOff = bpsOff + spp * 2, dataOff = resOff + 16;
    const W = new Writer(dataOff + pix.length);
    W.ascii('II'); W.u16(42); W.u32(ifd);
    W.u16(nTags);
    const tag = (id, type, count, val) => { W.u16(id); W.u16(type); W.u32(count); if (type === 3 && count === 1) { W.u16(val); W.u16(0); } else W.u32(val); };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, spp, bpsOff); tag(259, 3, 1, 1); tag(262, 3, 1, 2);
    tag(273, 4, 1, dataOff); tag(277, 3, 1, spp); tag(278, 4, 1, h); tag(279, 4, 1, pix.length);
    tag(282, 5, 1, resOff); tag(283, 5, 1, resOff + 8); tag(296, 3, 1, 2);
    if (alpha) tag(338, 3, 1, 2);
    W.u32(0);
    for (let i = 0; i < spp; i++) W.u16(8);
    const r = Math.round(dpi || 300);
    W.u32(r); W.u32(1); W.u32(r); W.u32(1);
    W.bytes(pix);
    return W.out();
  }

  // ---------------------------------------------------------------- ICO (PNGs de 16 a 256 px dentro)
  function encodeICO(pngs) {
    // pngs: [{ size, bytes }]
    const W = new Writer(6 + pngs.length * 16 + pngs.reduce((a, p) => a + p.bytes.length, 0));
    W.u16(0); W.u16(1); W.u16(pngs.length);
    let off = 6 + pngs.length * 16;
    pngs.forEach(p => { W.u8(p.size >= 256 ? 0 : p.size); W.u8(p.size >= 256 ? 0 : p.size); W.u8(0); W.u8(0); W.u16(1); W.u16(32); W.u32(p.bytes.length); W.u32(off); off += p.bytes.length; });
    pngs.forEach(p => W.bytes(p.bytes));
    return W.out();
  }

  // ---------------------------------------------------------------- SVG (imagem embutida, com o tamanho original)
  function encodeSVG(pngBase64, w, h, mime) {
    const s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" xlink:href="data:${mime || 'image/png'};base64,${pngBase64}"/></svg>\n`;
    return new TextEncoder().encode(s);
  }

  // ---------------------------------------------------------------- remoção de fundo liso (sem IA)
  // preenche a partir das bordas tudo o que for parecido com a cor do fundo; borda suavizada
  function removeFlatBackground(img, opts) {
    opts = opts || {};
    const { width: w, height: h, data: d } = img;
    const tol = (opts.tolerance == null ? 18 : opts.tolerance) / 100 * 441;
    // cor do fundo: mediana das bordas
    const border = [];
    for (let x = 0; x < w; x += Math.max(1, w >> 7)) { border.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y += Math.max(1, h >> 7)) { border.push(y * w, y * w + w - 1); }
    const med = c => { const v = border.map(k => d[k * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const bg = [med(0), med(1), med(2)];
    const dist = k => { const i = k * 4, r = d[i] - bg[0], g = d[i + 1] - bg[1], b = d[i + 2] - bg[2]; return Math.sqrt(r * r + g * g + b * b); };
    const mask = new Uint8Array(w * h); // 1 = fundo
    const stack = [];
    const push = k => { if (!mask[k] && dist(k) <= tol) { mask[k] = 1; stack.push(k); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k / w) | 0;
      if (x > 0) push(k - 1); if (x < w - 1) push(k + 1); if (y > 0) push(k - w); if (y < h - 1) push(k + w);
    }
    // também os buracos fechados com a mesma cor (o miolo de um “O”), se pedido
    if (opts.holes) for (let k = 0; k < w * h; k++) if (!mask[k] && dist(k) <= tol * 0.6) mask[k] = 1;
    const out = new Uint8Array(d);
    const feather = Math.max(0, Math.min(6, opts.feather == null ? 1 : opts.feather));
    for (let k = 0; k < w * h; k++) {
      if (mask[k]) { out[k * 4 + 3] = 0; continue; }
      if (!feather) continue;
      // suaviza a borda: pixels próximos do fundo ficam parcialmente transparentes
      const x = k % w, y = (k / w) | 0;
      let near = false;
      for (let dy = -feather; dy <= feather && !near; dy++) for (let dx = -feather; dx <= feather; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx]) { near = true; break; } }
      if (near) { const t = Math.min(1, dist(k) / (tol * 2 + 1)); out[k * 4 + 3] = Math.round(d[k * 4 + 3] * (0.35 + 0.65 * t)); }
    }
    return { width: w, height: h, data: out, background: bg };
  }

  return { encodeBMP, encodeTGA, decodeTGA, encodePNM, decodePNM, encodeQOI, decodeQOI, encodeGIF, encodeTIFF, encodeICO, encodeSVG, flatten, hasAlpha, removeFlatBackground };
});
