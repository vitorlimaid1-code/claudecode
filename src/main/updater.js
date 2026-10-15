// Atualização pelo GitHub: consulta a versão publicada (Releases do repositório), baixa o instalador
// (ou a versão portátil, quando o app roda portátil) e abre o instalador por cima da versão atual.
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = process.env.CVH_UPDATE_REPO || 'vitorlimaid1-code/claudecode';
const API = process.env.CVH_UPDATE_API || 'https://api.github.com';

const parts = v => String(v || '').replace(/^v/i, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
function newer(a, b) { const A = parts(a), B = parts(b); for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); } return false; }

const MB = n => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
const time = s => (s >= 60 ? Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s' : Math.max(1, Math.round(s)) + ' s');

function createUpdater({ app, shell, send }) {
  let latest = null;
  // registro para a tela de Configurações (cada etapa da consulta e do download)
  const log = (msg, kind) => { try { send({ log: String(msg), kind: kind || '' }); } catch (e) { /* janela fechada */ } };
  async function check() {
    log(`Consultando a versão publicada: ${API}/repos/${REPO}/releases/latest`);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(`${API}/repos/${REPO}/releases/latest`, { signal: ac.signal, headers: { 'user-agent': 'Casa Vertigem Hub', accept: 'application/vnd.github+json' } });
      if (r.status === 404) { log('Nenhuma versão publicada ainda no GitHub (Releases).', 'bad'); return { error: 'nenhuma versão publicada ainda no GitHub (Releases).' }; }
      if (!r.ok) { log(`O GitHub respondeu ${r.status}.`, 'bad'); return { error: `o GitHub respondeu ${r.status}.` }; }
      const j = await r.json();
      const version = String(j.tag_name || j.name || '').replace(/^v/i, '');
      const assets = (j.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size, digest: a.digest || '' }));
      latest = { version, assets, tag: j.tag_name, published: j.published_at, page: j.html_url };
      const current = app.getVersion();
      log(`Versão publicada no GitHub: ${version} (${j.tag_name}${j.published_at ? ', publicada em ' + new Date(j.published_at).toLocaleString('pt-BR') : ''}) · instalada: ${current}`, 'ok');
      assets.forEach(a => log(`  arquivo disponível: ${a.name} (${MB(a.size || 0)})`));
      return { version, current, newer: newer(version, current), notes: String(j.body || '').trim(), assets: assets.map(a => a.name) };
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'o GitHub não respondeu a tempo.' : 'sem conexão com a internet.';
      log('Falha na consulta: ' + msg, 'bad');
      return { error: msg };
    } finally { clearTimeout(t); }
  }
  async function install() {
    if (!latest) { const c = await check(); if (c.error) return c; }
    const portable = !!process.env.PORTABLE_EXECUTABLE_DIR;
    const re = portable ? /Portatil.*\.exe$/i : /Setup.*\.exe$/i;
    const asset = latest.assets.find(a => re.test(a.name)) || (process.platform !== 'win32' ? latest.assets.find(a => /\.AppImage$/i.test(a.name)) : null);
    if (!asset) { log('O arquivo de instalação não foi encontrado na versão publicada.', 'bad'); return { error: 'o arquivo de instalação não foi encontrado na versão publicada.' }; }
    log(`Arquivo escolhido: ${asset.name} (${portable ? 'versão portátil, porque o app está rodando portátil' : 'instalador'}) · ${MB(asset.size || 0)}`);
    const dir = portable ? process.env.PORTABLE_EXECUTABLE_DIR : fs.mkdtempSync(path.join(os.tmpdir(), 'cvh-update-'));
    const file = path.join(dir, asset.name);
    log(`Baixando direto do GitHub: ${asset.url}`);
    log(`Destino: ${file}`);
    const hash = require('crypto').createHash('sha256');
    try {
      const t0 = Date.now();
      const r = await fetch(asset.url, { headers: { 'user-agent': 'Casa Vertigem Hub' } });
      if (!r.ok || !r.body) { log(`O download falhou: o servidor respondeu ${r.status}.`, 'bad'); return { error: `download falhou (${r.status}).` }; }
      try { log(`Conectado: ${new URL(r.url).host} (arquivos de Releases do GitHub) · resposta ${r.status}`); } catch (e) { /* ok */ }
      const total = Number(r.headers.get('content-length')) || asset.size || 0;
      const out = fs.createWriteStream(file + '.part');
      let received = 0, lastSent = 0, nextLog = 0.1;
      for await (const chunk of r.body) {
        received += chunk.length;
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise(res => out.once('drain', res));
        const now = Date.now();
        const secs = Math.max(0.001, (now - t0) / 1000), speed = received / secs;
        if (now - lastSent > 250) { lastSent = now; send({ received, total, ratio: total ? received / total : 0, speed, eta: total ? (total - received) / Math.max(1, speed) : 0 }); }
        // uma linha no registro a cada 10% (velocidade e tempo restante)
        if (total && received / total >= nextLog) {
          log(`  ${Math.round(nextLog * 100)}% · ${MB(received)} de ${MB(total)} · ${MB(speed)}/s${received < total ? ' · falta ' + time((total - received) / Math.max(1, speed)) : ''}`);
          nextLog += 0.1;
        }
      }
      await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
      const secs = (Date.now() - t0) / 1000;
      if (total && received < total * 0.98) { log(`Download incompleto: ${MB(received)} de ${MB(total)}.`, 'bad'); try { fs.unlinkSync(file + '.part'); } catch (e2) { /* ok */ } return { error: 'o download veio incompleto; tente de novo.' }; }
      log(`Download concluído: ${MB(received)} em ${time(secs)} (média ${MB(received / Math.max(0.001, secs))}/s).`, 'ok');
      // conferência: tamanho e assinatura SHA-256 publicada pelo GitHub para o arquivo
      if (asset.size && received !== asset.size) { log(`Tamanho diferente do publicado (${received} × ${asset.size} bytes): o arquivo foi descartado.`, 'bad'); try { fs.unlinkSync(file + '.part'); } catch (e2) { /* ok */ } return { error: 'o arquivo baixado não confere com o publicado; tente de novo.' }; }
      const sum = hash.digest('hex');
      const want = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
      if (want && want[1].toLowerCase() !== sum) { log(`Assinatura SHA-256 não confere (baixado ${sum.slice(0, 16)}…, publicado ${want[1].slice(0, 16)}…): o arquivo foi descartado.`, 'bad'); try { fs.unlinkSync(file + '.part'); } catch (e2) { /* ok */ } return { error: 'o arquivo baixado não confere com o publicado; tente de novo.' }; }
      log(want ? `Arquivo conferido: tamanho e SHA-256 iguais aos publicados no GitHub (${sum.slice(0, 16)}…).` : `Tamanho conferido. SHA-256: ${sum.slice(0, 16)}… (o GitHub não publicou a assinatura deste arquivo).`, 'ok');
      fs.renameSync(file + '.part', file);
      send({ received, total: total || received, ratio: 1 });
    } catch (e) { try { fs.unlinkSync(file + '.part'); } catch (e2) { /* ok */ } log('Falha no download: ' + (e.message || e), 'bad'); return { error: 'falha no download: ' + (e.message || e) }; }
    if (portable) { log('Versão portátil nova salva ao lado da atual; a pasta foi aberta.', 'ok'); shell.showItemInFolder(file); return { ok: true, portable: true, file }; }
    log('Abrindo o instalador…');
    const err = await shell.openPath(file);
    if (err) { log('Não foi possível abrir o instalador: ' + err, 'bad'); return { error: 'não foi possível abrir o instalador: ' + err }; }
    log('Instalador aberto. O aplicativo vai fechar para concluir a instalação.', 'ok');
    setTimeout(() => app.quit(), 2500);
    return { ok: true, file };
  }
  return { check, install };
}

module.exports = { createUpdater, newer };
