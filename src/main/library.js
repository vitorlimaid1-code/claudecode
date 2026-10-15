// Bibliotecas de imagens: a do aplicativo (somente leitura) e a pessoal do usuário,
// cada uma com duas seções separadas: "corpo" (ilustrações) e "separadores" (abaixo dos títulos).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KINDS = ['corpo', 'separadores'];
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.tif', '.tiff']);

// Lê dimensões, transparência, perfil ICC e espaço de cor direto dos bytes do arquivo
function analyzeImage(buf) {
  const info = { format: 'desconhecido', width: 0, height: 0, hasAlpha: false, hasIcc: false, colorSpace: 'RGB', bytes: buf.length };
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    info.format = 'PNG';
    info.width = buf.readUInt32BE(16);
    info.height = buf.readUInt32BE(20);
    const colorType = buf[25];
    info.hasAlpha = colorType === 4 || colorType === 6;
    if (colorType === 0 || colorType === 4) info.colorSpace = 'Tons de cinza';
    let p = 8;
    while (p + 8 < buf.length) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      if (type === 'iCCP') info.hasIcc = true;
      if (type === 'tRNS') info.hasAlpha = true;
      if (type === 'pHYs' && buf[p + 16] === 1) info.dpiTag = Math.round(buf.readUInt32BE(p + 8) * 0.0254);
      if (type === 'IDAT') break;
      p += 12 + len;
    }
  } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    info.format = 'JPEG';
    let p = 2;
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) { p++; continue; }
      const marker = buf[p + 1];
      const len = buf.readUInt16BE(p + 2);
      if (marker === 0xe2 && buf.toString('latin1', p + 4, p + 15) === 'ICC_PROFILE') info.hasIcc = true;
      if (marker === 0xe0 && buf.toString('latin1', p + 4, p + 8) === 'JFIF' && buf[p + 11] === 1) info.dpiTag = buf.readUInt16BE(p + 12);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xcb)) {
        info.height = buf.readUInt16BE(p + 5);
        info.width = buf.readUInt16BE(p + 7);
        const comps = buf[p + 9];
        info.colorSpace = comps === 4 ? 'CMYK' : comps === 1 ? 'Tons de cinza' : 'RGB';
        break;
      }
      p += 2 + len;
    }
  } else if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    info.format = 'WEBP';
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8X') { info.hasAlpha = !!(buf[20] & 0x10); info.hasIcc = !!(buf[20] & 0x20); info.width = 1 + buf.readUIntLE(24, 3); info.height = 1 + buf.readUIntLE(27, 3); }
    else if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); info.width = 1 + (b & 0x3fff); info.height = 1 + ((b >> 14) & 0x3fff); info.hasAlpha = !!((b >> 28) & 1); }
    else if (chunk === 'VP8 ') { info.width = buf.readUInt16LE(26) & 0x3fff; info.height = buf.readUInt16LE(28) & 0x3fff; }
  } else if (buf.toString('latin1', 0, 3) === 'GIF') {
    info.format = 'GIF';
    info.width = buf.readUInt16LE(6);
    info.height = buf.readUInt16LE(8);
  } else if (/<svg/i.test(buf.toString('utf8', 0, 512))) {
    info.format = 'SVG';
    const s = buf.toString('utf8', 0, 2000);
    const vb = /viewBox\s*=\s*"[\d.\s-]+?\s([\d.]+)\s+([\d.]+)"/.exec(s);
    if (vb) { info.width = Math.round(+vb[1]); info.height = Math.round(+vb[2]); }
    info.hasAlpha = true;
    info.vector = true;
  } else if (buf.toString('latin1', 0, 2) === 'BM') {
    info.format = 'BMP';
    info.width = buf.readInt32LE(18);
    info.height = Math.abs(buf.readInt32LE(22));
  }
  return info;
}

function hashBuffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
}

class ImageLibrary {
  constructor(appRoot, userDataDir) {
    this.builtinDir = path.join(appRoot, 'assets', 'library');
    this.userDir = path.join(userDataDir, 'library');
    this.metaFile = path.join(this.userDir, 'library.json');
  }

  readMeta() {
    try { return JSON.parse(fs.readFileSync(this.metaFile, 'utf8')); } catch (e) { return { items: {}, collections: [] }; }
  }

  writeMeta(m) {
    fs.mkdirSync(this.userDir, { recursive: true });
    fs.writeFileSync(this.metaFile, JSON.stringify(m, null, 1));
  }

  list() {
    const out = [];
    let manifest = { separadores: [], corpo: [] };
    try { manifest = JSON.parse(fs.readFileSync(path.join(this.builtinDir, 'manifest.json'), 'utf8')); } catch (e) { /* sem biblioteca */ }
    // filetes da Casa Vertigem que vieram com o instalador (fora do manifesto)
    if (this.extraBuiltin) { try { const have = new Set((manifest.separadores || []).map(x => x.file)); manifest.separadores = (manifest.separadores || []).concat(this.extraBuiltin().filter(x => !have.has(x.file))); } catch (e) { /* ok */ } }
    const meta = this.readMeta();
    KINDS.forEach(kind => {
      (manifest[kind] || []).forEach(it => {
        const key = `app:${it.file}`;
        const m = meta.items[key] || {};
        out.push({
          key, kind, source: 'app', name: it.name, tags: it.tags, url: `app://local/assets/library/${it.file}`,
          width: it.width, height: it.height, format: 'PNG', hasAlpha: true, favorite: !!m.favorite, collections: m.collections || []
        });
      });
      const dir = path.join(this.userDir, kind);
      let files = [];
      try { files = fs.readdirSync(dir); } catch (e) { /* vazio */ }
      files.filter(f => IMG_EXT.has(path.extname(f).toLowerCase())).forEach(f => {
        const key = `user:${kind}/${f}`;
        const m = meta.items[key] || {};
        out.push(Object.assign({
          key, kind, source: 'user', name: m.name || path.basename(f, path.extname(f)), tags: m.tags || '',
          url: `app://userlib/${kind}/${encodeURIComponent(f)}`, favorite: !!m.favorite, collections: m.collections || [],
          added: m.added || 0, hash: m.hash
        }, m.info || {}));
      });
    });
    return { items: out, collections: meta.collections || [] };
  }

  add(kind, files) {
    if (!KINDS.includes(kind)) kind = 'corpo';
    const dir = path.join(this.userDir, kind);
    fs.mkdirSync(dir, { recursive: true });
    const meta = this.readMeta();
    const existingHashes = {};
    Object.entries(meta.items).forEach(([k, v]) => { if (v.hash) existingHashes[v.hash] = k; });
    const added = [];
    const duplicates = [];
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (!IMG_EXT.has(ext)) continue;
      const buf = fs.readFileSync(f);
      const hash = hashBuffer(buf);
      if (existingHashes[hash]) { duplicates.push({ file: f, existing: existingHashes[hash] }); continue; }
      let name = path.basename(f, ext).replace(/[^\wÀ-ſ .-]+/g, '_');
      let target = name + ext;
      let i = 1;
      while (fs.existsSync(path.join(dir, target))) target = `${name}-${i++}${ext}`;
      fs.writeFileSync(path.join(dir, target), buf);
      const key = `user:${kind}/${target}`;
      meta.items[key] = { name, tags: '', favorite: false, collections: [], added: Date.now(), hash, info: analyzeImage(buf) };
      existingHashes[hash] = key;
      added.push(key);
    }
    this.writeMeta(meta);
    return { added, duplicates };
  }

  addBuffer(kind, name, buf) {
    const tmp = path.join(require('os').tmpdir(), `dl-${Date.now()}-${name.replace(/[^\w.-]+/g, '_')}`);
    fs.writeFileSync(tmp, buf);
    try { return this.add(kind, [tmp]); } finally { try { fs.unlinkSync(tmp); } catch (e) { /* ok */ } }
  }

  update(key, patch) {
    const meta = this.readMeta();
    meta.items[key] = Object.assign({}, meta.items[key] || {}, patch);
    if (patch.collections) patch.collections.forEach(c => { if (!meta.collections.includes(c)) meta.collections.push(c); });
    this.writeMeta(meta);
  }

  // Remove só o arquivo da biblioteca: os livros já diagramados guardam sua própria cópia
  remove(key) {
    if (!key.startsWith('user:')) return false;
    const rel = key.slice(5);
    const file = path.join(this.userDir, rel);
    if (!path.resolve(file).startsWith(path.resolve(this.userDir))) return false;
    try { fs.unlinkSync(file); } catch (e) { /* ok */ }
    const meta = this.readMeta();
    delete meta.items[key];
    this.writeMeta(meta);
    return true;
  }

  resolveUserFile(rel) {
    const file = path.resolve(this.userDir, rel);
    return file.startsWith(path.resolve(this.userDir)) ? file : null;
  }
}

module.exports = { ImageLibrary, analyzeImage, hashBuffer, KINDS };
