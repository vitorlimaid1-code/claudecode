// Atualização pelo GitHub: consulta a versão publicada (Releases do repositório), baixa o instalador
// (ou a versão portátil, quando o app roda portátil) e abre o instalador por cima da versão atual.
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = process.env.CVH_UPDATE_REPO || 'vitorlimaid1-code/claudecode';
const API = process.env.CVH_UPDATE_API || 'https://api.github.com';

const parts = v => String(v || '').replace(/^v/i, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
function newer(a, b) { const A = parts(a), B = parts(b); for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); } return false; }

function createUpdater({ app, shell, send }) {
  let latest = null;
  async function check() {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(`${API}/repos/${REPO}/releases/latest`, { signal: ac.signal, headers: { 'user-agent': 'Casa Vertigem Hub', accept: 'application/vnd.github+json' } });
      if (r.status === 404) return { error: 'nenhuma versão publicada ainda no GitHub (Releases).' };
      if (!r.ok) return { error: `o GitHub respondeu ${r.status}.` };
      const j = await r.json();
      const version = String(j.tag_name || j.name || '').replace(/^v/i, '');
      const assets = (j.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }));
      latest = { version, assets };
      const current = app.getVersion();
      return { version, current, newer: newer(version, current), notes: String(j.body || '').trim(), assets: assets.map(a => a.name) };
    } catch (e) {
      return { error: e.name === 'AbortError' ? 'o GitHub não respondeu a tempo.' : 'sem conexão com a internet.' };
    } finally { clearTimeout(t); }
  }
  async function install() {
    if (!latest) { const c = await check(); if (c.error) return c; }
    const portable = !!process.env.PORTABLE_EXECUTABLE_DIR;
    const re = portable ? /Portatil.*\.exe$/i : /Setup.*\.exe$/i;
    const asset = latest.assets.find(a => re.test(a.name)) || (process.platform !== 'win32' ? latest.assets.find(a => /\.AppImage$/i.test(a.name)) : null);
    if (!asset) return { error: 'o arquivo de instalação não foi encontrado na versão publicada.' };
    const dir = portable ? process.env.PORTABLE_EXECUTABLE_DIR : fs.mkdtempSync(path.join(os.tmpdir(), 'cvh-update-'));
    const file = path.join(dir, asset.name);
    try {
      const r = await fetch(asset.url, { headers: { 'user-agent': 'Casa Vertigem Hub' } });
      if (!r.ok || !r.body) return { error: `download falhou (${r.status}).` };
      const total = Number(r.headers.get('content-length')) || asset.size || 0;
      const out = fs.createWriteStream(file + '.part');
      let received = 0, lastSent = 0;
      for await (const chunk of r.body) {
        received += chunk.length;
        if (!out.write(chunk)) await new Promise(res => out.once('drain', res));
        const now = Date.now();
        if (now - lastSent > 250) { lastSent = now; send({ received, total, ratio: total ? received / total : 0 }); }
      }
      await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
      if (total && received < total * 0.98) return { error: 'o download veio incompleto; tente de novo.' };
      fs.renameSync(file + '.part', file);
      send({ received, total: total || received, ratio: 1 });
    } catch (e) { try { fs.unlinkSync(file + '.part'); } catch (e2) { /* ok */ } return { error: 'falha no download: ' + (e.message || e) }; }
    if (portable) { shell.showItemInFolder(file); return { ok: true, portable: true, file }; }
    const err = await shell.openPath(file);
    if (err) return { error: 'não foi possível abrir o instalador: ' + err };
    setTimeout(() => app.quit(), 1500);
    return { ok: true, file };
  }
  return { check, install };
}

module.exports = { createUpdater, newer };
