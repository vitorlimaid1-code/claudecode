// Gerenciador de fontes: encontra as fontes instaladas no computador, lê nome,
// estilo, peso e licença de incorporação (OS/2 fsType) e mantém uma biblioteca
// própria do aplicativo (fontes "instaladas virtualmente", sem mexer no Windows).
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const FONT_EXT = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2']);

function systemFontDirs() {
  const dirs = [];
  if (process.platform === 'win32') {
    dirs.push(path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'));
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  } else if (process.platform === 'darwin') {
    dirs.push('/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library', 'Fonts'));
  } else {
    dirs.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local', 'share', 'fonts'));
  }
  return dirs.filter(d => { try { return fs.statSync(d).isDirectory(); } catch (e) { return false; } });
}

function walk(dir, out, depth) {
  if (depth > 4) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (FONT_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
}

// ---------- leitura de tabelas sfnt ----------
function readTables(buf, offset) {
  const numTables = buf.readUInt16BE(offset + 4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = offset + 12 + i * 16;
    const tag = buf.toString('latin1', rec, rec + 4);
    tables[tag] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12), data: buf };
  }
  return tables;
}

function readWoffTables(buf) {
  const numTables = buf.readUInt16BE(12);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 44 + i * 20;
    const tag = buf.toString('latin1', rec, rec + 4);
    if (tag !== 'name' && tag !== 'OS/2') continue;
    const off = buf.readUInt32BE(rec + 4);
    const comp = buf.readUInt32BE(rec + 8);
    const orig = buf.readUInt32BE(rec + 12);
    let data = buf.subarray(off, off + comp);
    if (comp < orig) data = zlib.inflateSync(data);
    tables[tag] = { offset: 0, length: data.length, data };
  }
  return tables;
}

function decodeName(data, off, len, platform) {
  const b = data.subarray(off, off + len);
  if (platform === 0 || platform === 3) {
    let s = '';
    for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode(b.readUInt16BE(i));
    return s;
  }
  return b.toString('latin1');
}

function parseName(t) {
  const d = t.data;
  const base = t.offset;
  const count = d.readUInt16BE(base + 2);
  const strOff = base + d.readUInt16BE(base + 4);
  const names = {};
  const score = {};
  for (let i = 0; i < count; i++) {
    const r = base + 6 + i * 12;
    const platform = d.readUInt16BE(r);
    const lang = d.readUInt16BE(r + 4);
    const id = d.readUInt16BE(r + 6);
    const len = d.readUInt16BE(r + 8);
    const off = d.readUInt16BE(r + 10);
    if (![1, 2, 4, 16, 17].includes(id)) continue;
    // preferência: Windows/inglês > Windows/qualquer > Mac
    const sc = platform === 3 ? (lang === 0x409 ? 3 : 2) : platform === 0 ? 2 : 1;
    if ((score[id] || 0) >= sc) continue;
    try { names[id] = decodeName(d, strOff + off, len, platform).replace(/\0/g, '').trim(); score[id] = sc; } catch (e) { /* ignora */ }
  }
  return names;
}

function parseOS2(t) {
  const d = t.data;
  const b = t.offset;
  return {
    weight: d.readUInt16BE(b + 4),
    fsType: d.readUInt16BE(b + 8),
    familyClass: d.readInt16BE(b + 30) >> 8,
    fsSelection: t.length > 63 ? d.readUInt16BE(b + 62) : 0
  };
}

function describe(tables, file, index) {
  const names = tables.name ? parseName(tables.name) : {};
  const os2 = tables['OS/2'] ? parseOS2(tables['OS/2']) : { weight: 400, fsType: 0, familyClass: 0, fsSelection: 0 };
  const family = names[16] || names[1] || path.basename(file, path.extname(file));
  const sub = names[17] || names[2] || 'Regular';
  const italic = !!(os2.fsSelection & 1) || /italic|oblique|itálico/i.test(sub);
  let weight = os2.weight || 400;
  if (weight < 100) weight = 400;
  // fsType: 0x0002 = restrito (não pode ser incorporada); 0x0200 = somente bitmap
  const restricted = (os2.fsType & 0x000f) === 0x0002;
  const bitmapOnly = !!(os2.fsType & 0x0200);
  const editable = !!(os2.fsType & 0x0008);
  const previewPrint = !!(os2.fsType & 0x0004);
  const cls = os2.familyClass;
  const category = [1, 2, 3, 4, 5, 7].includes(cls) ? 'serifa' : cls === 8 ? 'sem serifa' : cls === 10 ? 'manuscrita' : cls === 9 ? 'decorativa' : cls === 12 ? 'símbolos' : '';
  return {
    file, index: index || 0, family, style: sub, fullName: names[4] || `${family} ${sub}`,
    weight, italic,
    embeddable: !restricted && !bitmapOnly,
    embedding: restricted ? 'restrita' : bitmapOnly ? 'somente bitmap' : previewPrint ? 'visualização/impressão' : editable ? 'editável' : 'instalável',
    category
  };
}

function parseFontFile(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  const sig = buf.toString('latin1', 0, 4);
  if (sig === 'ttcf') {
    const n = buf.readUInt32BE(8);
    const out = [];
    for (let i = 0; i < Math.min(n, 16); i++) out.push(describe(readTables(buf, buf.readUInt32BE(12 + i * 4)), file, i));
    return out;
  }
  if (sig === 'wOFF') return [describe(readWoffTables(buf), file)];
  if (sig === 'wOF2' || ext === '.woff2') {
    const base = path.basename(file, ext);
    const italic = /italic/i.test(base);
    const w = /thin/i.test(base) ? 100 : /extralight/i.test(base) ? 200 : /light/i.test(base) ? 300 : /medium/i.test(base) ? 500 : /semibold/i.test(base) ? 600 : /extrabold/i.test(base) ? 800 : /black/i.test(base) ? 900 : /bold/i.test(base) ? 700 : 400;
    return [{ file, index: 0, family: base.replace(/[-_](regular|italic|bold|light|medium|thin|black|semibold|extrabold|extralight).*$/i, '').replace(/[-_]/g, ' '), style: base, fullName: base, weight: w, italic, embeddable: true, embedding: 'desconhecida (WOFF2)', category: '' }];
  }
  return [describe(readTables(buf, 0), file)];
}

// ---------- cache e varredura ----------
class FontManager {
  constructor(userDataDir) {
    this.libDir = path.join(userDataDir, 'fonts');
    this.cacheFile = path.join(userDataDir, 'font-cache.json');
    this.libFile = path.join(userDataDir, 'font-library.json');
    this.system = null;
  }

  loadCache() {
    try { return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')); } catch (e) { return {}; }
  }

  scanSystem(force) {
    if (this.system && !force) return this.system;
    const cache = force ? {} : this.loadCache();
    const next = {};
    const files = [];
    systemFontDirs().forEach(d => walk(d, files, 0));
    const faces = [];
    for (const f of files) {
      let st;
      try { st = fs.statSync(f); } catch (e) { continue; }
      const key = `${f}|${st.size}|${st.mtimeMs}`;
      let list = cache[key];
      if (!list) {
        try { list = parseFontFile(f); } catch (e) { list = []; }
      }
      next[key] = list;
      faces.push(...list);
    }
    try { fs.writeFileSync(this.cacheFile, JSON.stringify(next)); } catch (e) { /* ok */ }
    this.system = groupFamilies(faces, 'sistema');
    return this.system;
  }

  readLibrary() {
    try { return JSON.parse(fs.readFileSync(this.libFile, 'utf8')); } catch (e) { return { faces: [] }; }
  }

  writeLibrary(lib) {
    fs.mkdirSync(path.dirname(this.libFile), { recursive: true });
    fs.writeFileSync(this.libFile, JSON.stringify(lib, null, 1));
  }

  library() {
    const lib = this.readLibrary();
    const faces = lib.faces.filter(f => fs.existsSync(path.join(this.libDir, f.stored)));
    return groupFamilies(faces.map(f => Object.assign({}, f, { file: path.join(this.libDir, f.stored) })), 'biblioteca');
  }

  // Copia arquivos para a biblioteca do app ("instalação virtual")
  addFiles(files) {
    fs.mkdirSync(this.libDir, { recursive: true });
    const lib = this.readLibrary();
    const added = [];
    const skipped = [];
    for (const f of files) {
      let faces;
      try { faces = parseFontFile(f); } catch (e) { skipped.push({ file: f, reason: 'arquivo de fonte inválido' }); continue; }
      const stored = `${Date.now().toString(36)}-${path.basename(f).replace(/[^\w.-]+/g, '_')}`;
      fs.copyFileSync(f, path.join(this.libDir, stored));
      faces.forEach(face => {
        const entry = Object.assign({}, face, { stored, file: undefined, source: f });
        lib.faces = lib.faces.filter(x => !(x.family === entry.family && x.weight === entry.weight && x.italic === entry.italic));
        lib.faces.push(entry);
        added.push(entry);
      });
    }
    this.writeLibrary(lib);
    return { added, skipped };
  }

  removeFamily(family) {
    const lib = this.readLibrary();
    const keep = [];
    lib.faces.forEach(f => {
      if (f.family === family) { try { fs.unlinkSync(path.join(this.libDir, f.stored)); } catch (e) { /* ok */ } } else keep.push(f);
    });
    lib.faces = keep;
    this.writeLibrary(lib);
  }

  // Todas as famílias conhecidas: biblioteca do app tem prioridade sobre o sistema
  allFamilies() {
    const map = {};
    (this.system || []).forEach(f => { map[f.family] = f; });
    this.library().forEach(f => { map[f.family] = f; });
    return map;
  }

  // @font-face para as famílias pedidas (biblioteca ou sistema)
  fontFaceCss(families) {
    const all = this.allFamilies();
    const css = [];
    const missing = [];
    const report = [];
    for (const fam of families || []) {
      const f = all[fam];
      if (!f) { missing.push(fam); continue; }
      report.push({ family: fam, source: f.source, embeddable: f.faces.every(x => x.embeddable), faces: f.faces.map(x => ({ weight: x.weight, italic: x.italic, embedding: x.embedding })) });
      f.faces.forEach(face => {
        if (face.index && face.index > 0) return; // TTC: só a primeira face é carregável por URL
        const url = 'app://fontfile/' + Buffer.from(face.file).toString('base64url');
        css.push(`@font-face { font-family: "${fam.replace(/"/g, '')}"; src: url("${url}"); font-weight: ${face.weight}; font-style: ${face.italic ? 'italic' : 'normal'}; font-display: block; }`);
      });
    }
    return { css: css.join('\n'), missing, report };
  }

  isAllowedFile(file) {
    const norm = path.resolve(file);
    if (norm.startsWith(path.resolve(this.libDir))) return true;
    return systemFontDirs().some(d => norm.startsWith(path.resolve(d))) && FONT_EXT.has(path.extname(norm).toLowerCase());
  }
}

function groupFamilies(faces, source) {
  const map = {};
  faces.forEach(f => {
    if (!f.family) return;
    if (!map[f.family]) map[f.family] = { family: f.family, source, category: f.category, faces: [] };
    if (!map[f.family].faces.some(x => x.weight === f.weight && x.italic === f.italic)) map[f.family].faces.push(f);
    if (!map[f.family].category && f.category) map[f.family].category = f.category;
  });
  return Object.values(map).map(f => {
    f.faces.sort((a, b) => a.weight - b.weight || a.italic - b.italic);
    f.embeddable = f.faces.every(x => x.embeddable);
    f.styles = f.faces.map(x => `${weightName(x.weight)}${x.italic ? ' itálico' : ''}`);
    return f;
  }).sort((a, b) => a.family.localeCompare(b.family));
}

function weightName(w) {
  return { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }[Math.round(w / 100) * 100] || String(w);
}

module.exports = { FontManager, parseFontFile, systemFontDirs };
