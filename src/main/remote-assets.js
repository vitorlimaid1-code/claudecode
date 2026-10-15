// Logotipos dos selos editoriais e filetes ornamentais da Casa Vertigem.
// O instalador já os traz (baixados por scripts/fetch-assets.js na compilação). Se faltar algum, o app
// baixa uma vez (pelo processo principal; a interface continua sem acesso à rede) e guarda uma cópia
// na pasta de dados do usuário, para funcionar sem internet daí em diante.
const fs = require('fs');
const path = require('path');
const Ficha = require('../shared/ficha');

async function download(url, file) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'Casa Vertigem Hub' } });
    if (!r.ok) throw new Error('servidor respondeu ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100 || !(buf[0] === 0x89 && buf[1] === 0x50) && !(buf[0] === 0xff && buf[1] === 0xd8)) throw new Error('arquivo não é uma imagem');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    return buf;
  } finally { clearTimeout(timer); }
}

// largura e altura de um PNG (cabeçalho IHDR)
function pngSize(buf) {
  return buf && buf.length > 24 && buf[0] === 0x89 ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : { width: 0, height: 0 };
}

function createRemoteAssets(appRoot, userDataDir) {
  const sealFile = id => [path.join(appRoot, 'assets', 'seals', id + '.png'), path.join(userDataDir, 'selos', id + '.png')];
  async function sealLogo(id) {
    const s = Ficha.SEALS.find(x => x.id === id);
    if (!s) return { error: 'selo desconhecido' };
    const [bundled, cached] = sealFile(id);
    try {
      const f = [bundled, cached].find(x => fs.existsSync(x));
      const buf = f ? fs.readFileSync(f) : await download(s.url, cached);
      return { dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
    } catch (e) { return { error: e.name === 'AbortError' ? 'sem resposta do servidor' : /fetch failed|ENOTFOUND|ECONN/i.test(String(e.message)) ? 'sem conexão com a internet' : String(e.message || e) }; }
  }

  // filetes: os do instalador entram na biblioteca como itens do app; os que faltarem são baixados para a
  // biblioteca do usuário (categoria Separadores), uma vez por sessão
  let rulesTried = false;
  function bundledRules(builtinDir) {
    return Ficha.RULES.map(r => {
      const file = path.join(builtinDir, 'separadores', r.id + '.png');
      if (!fs.existsSync(file)) return null;
      let size = { width: 0, height: 0 };
      try { size = pngSize(fs.readFileSync(file)); } catch (e) { /* tamanho desconhecido */ }
      return { id: r.id, name: r.name, tags: 'filete ornamento casa vertigem', file: 'separadores/' + r.id + '.png', width: size.width, height: size.height };
    }).filter(Boolean);
  }
  async function ensureRules(library) {
    if (rulesTried) return 0;
    rulesTried = true;
    let n = 0;
    const meta = library.readMeta();
    for (const r of Ficha.RULES) {
      if (fs.existsSync(path.join(library.builtinDir, 'separadores', r.id + '.png'))) continue;
      const file = path.join(library.userDir, 'separadores', r.id + '.png');
      if (fs.existsSync(file)) continue;
      try {
        const buf = await download(r.url, file);
        meta.items[`user:separadores/${r.id}.png`] = Object.assign({}, meta.items[`user:separadores/${r.id}.png`], { name: r.name, tags: 'filete ornamento casa vertigem', added: Date.now(), info: Object.assign(pngSize(buf), { format: 'PNG', hasAlpha: true }) });
        n++;
      } catch (e) { /* sem internet: tenta de novo na próxima sessão */ }
    }
    if (n) library.writeMeta(meta);
    return n;
  }
  return { sealLogo, bundledRules, ensureRules };
}

module.exports = { createRemoteAssets, download, pngSize };
