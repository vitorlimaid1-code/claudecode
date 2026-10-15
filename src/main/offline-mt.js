// Tradutor offline: um modelo neural de tradução roda no próprio computador, numa janela oculta
// (transformers.js + ONNX em WebAssembly, com vários núcleos). O modelo é baixado uma única vez para a
// pasta de dados do app; depois disso a tradução funciona sem internet. Dois modelos:
//  - M2M100 418M (Meta, licença MIT: uso comercial permitido) — o padrão;
//  - NLLB-200 600M (Meta, melhor qualidade, licença CC-BY-NC 4.0: só uso não comercial).
const fs = require('fs');
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

const MODELS = {
  m2m100: { id: 'Xenova/m2m100_418M', name: 'M2M100 (licença MIT, uso comercial permitido)', mb: 560, code: iso => iso, tgt: 'pt',
    langs: 'af am ar ast az ba be bg bn br bs ca ceb cs cy da de el en es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu'.split(' ') },
  nllb: { id: 'Xenova/nllb-200-distilled-600M', name: 'NLLB-200 (melhor qualidade; licença CC-BY-NC 4.0, só uso não comercial)', mb: 900, tgt: 'por_Latn',
    code: iso => ({ en: 'eng_Latn', fr: 'fra_Latn', es: 'spa_Latn', it: 'ita_Latn', de: 'deu_Latn', pt: 'por_Latn', nl: 'nld_Latn', sv: 'swe_Latn', pl: 'pol_Latn', cs: 'ces_Latn', ru: 'rus_Cyrl', uk: 'ukr_Cyrl', el: 'ell_Grek', ja: 'jpn_Jpan', zh: 'zho_Hans', ko: 'kor_Hang', ar: 'arb_Arab', he: 'heb_Hebr', da: 'dan_Latn', no: 'nob_Latn', fi: 'fin_Latn', hu: 'hun_Latn', tr: 'tur_Latn', ro: 'ron_Latn', ca: 'cat_Latn' })[iso] }
};
const FILES = [
  { f: 'config.json' }, { f: 'generation_config.json', optional: true }, { f: 'tokenizer.json' }, { f: 'tokenizer_config.json' }, { f: 'special_tokens_map.json', optional: true },
  { f: 'onnx/encoder_model_quantized.onnx' }, { f: 'onnx/decoder_model_merged_quantized.onnx' }
];
const HF = process.env.HF_BASE_URL || 'https://huggingface.co'; // (trocável só para testes)
const IDLE_MS = 4 * 60 * 1000;

function createOfflineMT({ modelsDir, workerUrl, preload }) {
  const dirOf = key => path.join(modelsDir, ...MODELS[key].id.split('/'));
  const readyOf = key => path.join(dirOf(key), 'pronto.json');
  const isInstalled = key => fs.existsSync(readyOf(key));
  const choiceFile = path.join(modelsDir, 'escolha.json');
  const chosen = () => { try { const k = JSON.parse(fs.readFileSync(choiceFile, 'utf8')).model; return MODELS[k] ? k : 'm2m100'; } catch (e) { return 'm2m100'; } };
  // modelo em uso: o escolhido, se já baixado; senão qualquer um que esteja baixado
  const active = () => (isInstalled(chosen()) ? chosen() : Object.keys(MODELS).find(isInstalled) || null);
  let dl = null; // download em andamento
  let win = null, ready = null, idleTimer = null, seq = 0, winModel = null;
  const pending = new Map();

  function status() {
    const models = Object.entries(MODELS).map(([key, m]) => {
      let bytes = 0;
      try { FILES.forEach(x => { const p = path.join(dirOf(key), x.f); if (fs.existsSync(p)) bytes += fs.statSync(p).size; }); } catch (e) { /* ok */ }
      return { key, id: m.id, name: m.name, mb: m.mb, installed: isInstalled(key), sizeMb: Math.round(bytes / 1048576) };
    });
    const a = active();
    return { installed: !!a, active: a, selected: chosen(), models, mb: a ? models.find(m => m.key === a).sizeMb : 0, downloading: dl ? dl.key : null, progress: dl ? dl.progress : null, model: a ? MODELS[a].id : '' };
  }
  function select(key) {
    if (!MODELS[key]) return status();
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.writeFileSync(choiceFile, JSON.stringify({ model: key }));
    if (winModel && winModel !== active()) shutdown();
    return status();
  }

  // download com retomada (.part) e novas tentativas; progresso pelo tamanho total dos arquivos
  async function install(key, onProgress) {
    key = MODELS[key] ? key : chosen();
    if (dl) return dl.promise;
    const M = MODELS[key], dir = dirOf(key);
    dl = { key, progress: { ratio: 0, received: 0, total: 0, file: '' } };
    dl.promise = (async () => {
      try {
        fs.mkdirSync(path.join(dir, 'onnx'), { recursive: true });
        const sizes = {};
        for (const x of FILES) {
          try {
            const r = await fetch(`${HF}/${M.id}/resolve/main/${x.f}`, { method: 'HEAD', redirect: 'follow' });
            sizes[x.f] = r.ok ? Number(r.headers.get('content-length') || r.headers.get('x-linked-size') || 0) : 0;
            if (!r.ok && !x.optional) throw new Error(`o servidor de modelos respondeu ${r.status} para ${x.f}`);
          } catch (e) { if (!x.optional) throw e; }
        }
        const total = Object.values(sizes).reduce((a, b) => a + b, 0);
        let doneBytes = 0;
        for (const x of FILES) {
          const dest = path.join(dir, x.f);
          if (fs.existsSync(dest) && (!sizes[x.f] || fs.statSync(dest).size === sizes[x.f])) { doneBytes += fs.statSync(dest).size; continue; }
          if (!sizes[x.f] && x.optional) continue;
          await downloadFile(`${HF}/${M.id}/resolve/main/${x.f}`, dest, sizes[x.f], got => {
            dl.progress = { ratio: total ? (doneBytes + got) / total : 0, received: doneBytes + got, total, file: x.f };
            if (onProgress) onProgress(dl.progress);
          });
          doneBytes += fs.statSync(dest).size;
        }
        fs.writeFileSync(readyOf(key), JSON.stringify({ model: M.id, date: new Date().toISOString() }));
        if (!isInstalled(chosen())) select(key);
        return { ok: true };
      } catch (e) {
        return { error: /fetch failed|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(String(e.message)) ? 'sem conexão com a internet para baixar o motor (só é preciso uma vez).' : String(e.message || e) };
      } finally { dl = null; }
    })();
    return dl.promise;
  }
  async function downloadFile(url, dest, size, onBytes) {
    const part = dest + '.part';
    for (let attempt = 0; ; attempt++) {
      let have = fs.existsSync(part) ? fs.statSync(part).size : 0;
      try {
        const r = await fetch(url, { headers: have ? { range: `bytes=${have}-` } : {}, redirect: 'follow' });
        if (r.status === 416) { fs.rmSync(part, { force: true }); throw new Error('retomada recusada'); }
        if (!r.ok) throw new Error(`o servidor de modelos respondeu ${r.status}`);
        if (have && r.status !== 206) { have = 0; fs.rmSync(part, { force: true }); }
        const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
        let got = have, last = 0;
        const reader = r.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res));
            got += value.length;
            const now = Date.now();
            if (now - last > 400) { last = now; onBytes(got); }
          }
        } finally { await new Promise(res => out.end(res)); }
        onBytes(got);
        if (size && got !== size) throw new Error('download incompleto');
        fs.renameSync(part, dest);
        return;
      } catch (e) {
        if (attempt >= 5) throw e;
        await new Promise(res => setTimeout(res, [2, 4, 8, 16, 30][attempt] * 1000));
      }
    }
  }
  function remove(key) {
    if (!MODELS[key]) return status();
    if (winModel === key) shutdown();
    fs.rmSync(dirOf(key), { recursive: true, force: true });
    return status();
  }

  // ---------------------------------------------------------------- janela do motor
  ipcMain.on('mt:reply', (e, msg) => {
    if (!win || e.sender !== win.webContents) return;
    if (msg.type === 'ready') { if (ready) ready.resolve(msg); return; }
    if (msg.type === 'fail' && ready && !ready.done) { ready.reject(new Error(msg.error)); return; }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.out);
  });
  function shutdown() {
    clearTimeout(idleTimer);
    if (win && !win.isDestroyed()) win.destroy();
    win = null; ready = null; winModel = null;
    pending.forEach(p => p.reject(new Error('motor offline encerrado')));
    pending.clear();
  }
  function ensureWorker() {
    const key = active();
    if (!key) return Promise.reject(Object.assign(new Error('o motor offline ainda não foi baixado (Configurações da tradução → Tradução offline).'), { fatal: true }));
    if (win && !win.isDestroyed() && ready && winModel === key) return ready.promise;
    if (win) shutdown();
    winModel = key;
    win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    win.on('closed', () => { win = null; ready = null; winModel = null; });
    const r = ready = {};
    r.promise = new Promise((resolve, reject) => { r.resolve = v => { r.done = true; resolve(v); }; r.reject = err => { r.done = true; reject(err); }; });
    win.webContents.on('render-process-gone', (e, d) => { const err = new Error('o motor offline parou (' + d.reason + ')'); if (!r.done) r.reject(err); pending.forEach(p => p.reject(err)); pending.clear(); win = null; ready = null; winModel = null; });
    win.loadURL(workerUrl + '?model=' + encodeURIComponent(MODELS[key].id));
    const timeout = setTimeout(() => { if (!r.done) r.reject(new Error('o motor offline não carregou (tempo esgotado).')); }, 5 * 60 * 1000);
    return r.promise.finally(() => clearTimeout(timeout)).catch(e => { shutdown(); throw e; });
  }
  function touch() { clearTimeout(idleTimer); idleTimer = setTimeout(shutdown, IDLE_MS); }
  // o modelo em uso traduz este idioma?
  function supports(iso) {
    const key = active();
    if (!key) return false;
    const M = MODELS[key];
    return !!M.code(iso) && (!M.langs || M.langs.includes(iso));
  }

  // frases → traduções, em lotes (a memória fica perto de 1,5 GB enquanto o motor está aberto)
  async function translateSentences(sentences, iso, onProgress) {
    const info = await ensureWorker();
    const M = MODELS[winModel];
    if (!supports(iso)) throw Object.assign(new Error(`o motor offline não traduz este idioma (${iso}); o trecho fica no original.`), { refusal: true });
    touch();
    const out = new Array(sentences.length);
    const B = 8;
    for (let i = 0; i < sentences.length; i += B) {
      const batch = sentences.slice(i, i + B);
      const id = ++seq;
      const res = await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        win.webContents.send('mt:job', { id, texts: batch, src: M.code(iso), tgt: M.tgt });
      });
      res.forEach((t, k) => { out[i + k] = t; });
      touch();
      if (onProgress) onProgress(Math.min(sentences.length, i + B), sentences.length, info);
    }
    return out;
  }
  async function test() {
    const st = status();
    if (!st.installed) return { ok: false, msg: 'o motor offline ainda não foi baixado: abra Configurações da tradução → Tradução offline → Baixar.' };
    try {
      const info = await ensureWorker();
      const r = await translateSentences(['Hello, world.'], 'en');
      return { ok: true, msg: `Motor offline funcionando · ${MODELS[st.active].name.split(' (')[0]} (“${r[0]}”) · ${info.threads || 1} núcleo(s)` };
    } catch (e) { return { ok: false, msg: String(e.message || e) }; }
  }
  return { status, select, install, remove, supports, translateSentences, test, shutdown, name: () => (active() ? MODELS[active()].name.split(' (')[0] : '') };
}

module.exports = { createOfflineMT, MODELS };
