// Remoção de fundo por IA: modelo de segmentação rodando no próprio computador, numa janela oculta
// (transformers.js + ONNX em WebAssembly). O MODNet (licença Apache-2.0, ~25 MB) vem no instalador
// quando a compilação consegue baixá-lo; senão é baixado uma vez para a pasta de dados do app.
// Também aceita outro modelo compatível com a tarefa “background-removal” do transformers.js.
const fs = require('fs');
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

const MODELS = {
  modnet: { id: 'Xenova/modnet', name: 'MODNet (licença Apache-2.0)', dtype: 'fp32', files: ['config.json', 'preprocessor_config.json', 'onnx/model.onnx'] }
};
const HF = process.env.HF_BASE_URL || 'https://huggingface.co';
const IDLE_MS = 3 * 60 * 1000;

function createBgRemover({ modelsDir, bundledDir, workerUrl, preload }) {
  const dirs = id => [path.join(bundledDir, ...id.split('/')), path.join(modelsDir, ...id.split('/'))];
  const cfgFile = path.join(modelsDir, 'fundo.json');
  const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { return {}; } };
  // modelo escolhido: o MODNet ou um modelo do Hugging Face informado pelo usuário
  const model = () => { const c = readCfg(); return c.custom ? { id: c.custom, name: c.custom, dtype: c.dtype || 'fp32', files: ['config.json', 'preprocessor_config.json', c.dtype === 'q8' ? 'onnx/model_quantized.onnx' : c.dtype === 'fp16' ? 'onnx/model_fp16.onnx' : 'onnx/model.onnx'] } : MODELS.modnet; };
  const installedDir = m => dirs(m.id).find(d => m.files.every(f => fs.existsSync(path.join(d, f)))) || null;
  let dl = null, win = null, ready = null, winId = null, idle = null, seq = 0;
  const pending = new Map();

  function status() {
    const m = model();
    const d = installedDir(m);
    return { installed: !!d, bundled: !!d && d.startsWith(bundledDir), model: m.id, name: m.name, custom: readCfg().custom || '', dtype: m.dtype, downloading: !!dl, progress: dl ? dl.progress : null };
  }
  function setModel(custom, dtype) {
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.writeFileSync(cfgFile, JSON.stringify({ custom: String(custom || '').trim(), dtype: dtype || 'fp32' }));
    shutdown();
    return status();
  }
  async function install(onProgress) {
    if (dl) return dl.promise;
    const m = model();
    const dir = dirs(m.id)[1];
    dl = { progress: { ratio: 0, received: 0, total: 0 } };
    dl.promise = (async () => {
      try {
        let done = 0;
        for (let k = 0; k < m.files.length; k++) {
          const f = m.files[k], dest = path.join(dir, f);
          if (fs.existsSync(dest)) continue;
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const r = await fetch(`${HF}/${m.id}/resolve/main/${f}`, { redirect: 'follow' });
          if (!r.ok) throw new Error(`o servidor de modelos respondeu ${r.status} para ${f}`);
          const total = Number(r.headers.get('content-length') || 0);
          const chunks = [];
          let got = 0;
          const reader = r.body.getReader();
          for (;;) {
            const { done: end, value } = await reader.read();
            if (end) break;
            chunks.push(Buffer.from(value)); got += value.length;
            dl.progress = { ratio: (k + (total ? got / total : 0)) / m.files.length, received: done + got, total: 0, file: f };
            if (onProgress) onProgress(dl.progress);
          }
          fs.writeFileSync(dest + '.part', Buffer.concat(chunks));
          fs.renameSync(dest + '.part', dest);
          done += got;
        }
        return { ok: true };
      } catch (e) {
        return { error: /fetch failed|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(String(e.message)) ? 'sem conexão com a internet para baixar o modelo (só é preciso uma vez).' : String(e.message || e) };
      } finally { dl = null; }
    })();
    return dl.promise;
  }

  ipcMain.on('bg:reply', (e, msg) => {
    if (!win || e.sender !== win.webContents) return;
    if (msg.type === 'ready') { if (ready) ready.resolve(msg); return; }
    if (msg.type === 'fail') { if (ready && !ready.done) ready.reject(new Error(msg.error)); return; }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg);
  });
  function shutdown() {
    clearTimeout(idle);
    if (win && !win.isDestroyed()) win.destroy();
    win = null; ready = null; winId = null;
    pending.forEach(p => p.reject(new Error('remoção de fundo encerrada')));
    pending.clear();
  }
  function ensureWorker() {
    const m = model();
    const d = installedDir(m);
    if (!d) return Promise.reject(new Error('o modelo de remoção de fundo ainda não foi baixado.'));
    if (win && ready && winId === m.id) return ready.promise;
    shutdown();
    winId = m.id;
    win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    win.on('closed', () => { win = null; ready = null; winId = null; });
    const r = ready = {};
    r.promise = new Promise((res, rej) => { r.resolve = v => { r.done = true; res(v); }; r.reject = err => { r.done = true; rej(err); }; });
    win.webContents.on('render-process-gone', (e, det) => { const err = new Error('a remoção de fundo parou (' + det.reason + ')'); if (!r.done) r.reject(err); pending.forEach(p => p.reject(err)); pending.clear(); win = null; ready = null; winId = null; });
    // a janela lê o modelo da pasta onde ele estiver (instalador ou dados do usuário)
    const base = d.startsWith(bundledDir) ? 'app://local/assets/models/' : 'app://models/';
    win.loadURL(`${workerUrl}?model=${encodeURIComponent(m.id)}&dtype=${encodeURIComponent(m.dtype)}&base=${encodeURIComponent(base)}`);
    const t = setTimeout(() => { if (!r.done) r.reject(new Error('o modelo de remoção de fundo não carregou (tempo esgotado).')); }, 3 * 60 * 1000);
    return r.promise.finally(() => clearTimeout(t)).catch(e => { shutdown(); throw e; });
  }
  // imagem (PNG/JPEG em bytes) → máscara de opacidade (largura × altura, 1 byte por pixel)
  async function mask(bytes, mime) {
    await ensureWorker();
    clearTimeout(idle); idle = setTimeout(shutdown, IDLE_MS);
    const id = ++seq;
    const res = await new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); win.webContents.send('bg:job', { id, bytes, mime }); });
    clearTimeout(idle); idle = setTimeout(shutdown, IDLE_MS);
    return { width: res.width, height: res.height, mask: res.mask };
  }
  return { status, setModel, install, mask, shutdown };
}

module.exports = { createBgRemover, MODELS };
