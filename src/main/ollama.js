// Ollama no próprio computador: o sistema confere se o servidor responde na porta (11434) e, se não responder,
// abre o Ollama sozinho ("ollama serve", em segundo plano, sem janela) e espera ele ficar pronto. Também escolhe
// um modelo instalado quando o configurado não existe, e conversa em modo contínuo (stream), para que trechos
// longos em computadores lentos não estourem o tempo de espera da conexão.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

let child = null; // o Ollama que o sistema abriu (é fechado junto com o app)
let starting = null;

const base = url => String(url || 'http://localhost:11434').trim().replace(/\/+$/, '') || 'http://localhost:11434';
const isLocal = url => { try { return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/i.test(new URL(base(url)).hostname); } catch (e) { return false; } };

async function tags(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms || 2500);
  try {
    const r = await fetch(base(url) + '/api/tags', { signal: ac.signal });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return (j.models || []).map(m => m.name);
  } catch (e) { return null; } finally { clearTimeout(t); }
}

// onde o instalador do Ollama costuma deixar o programa (Windows, macOS, Linux) e o PATH
function findExe() {
  const env = process.env;
  const cands = process.platform === 'win32'
    ? [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'), env.ProgramFiles && path.join(env.ProgramFiles, 'Ollama', 'ollama.exe'), env.USERPROFILE && path.join(env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe')]
    : ['/Applications/Ollama.app/Contents/Resources/ollama', '/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/usr/bin/ollama', env.HOME && path.join(env.HOME, '.local', 'bin', 'ollama')];
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['ollama'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
    const first = out.split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch (e) { /* não está no PATH */ }
  return null;
}

// garante o Ollama respondendo: { ok, started, models, msg }
async function ensure(url, log) {
  const say = m => { try { if (log) log(m); } catch (e) { /* ok */ } };
  let list = await tags(url);
  if (list) return { ok: true, started: false, models: list };
  if (!isLocal(url)) return { ok: false, msg: `o Ollama não respondeu em ${base(url)} (endereço de outro computador: ligue o Ollama lá).` };
  if (starting) return starting;
  starting = (async () => {
    const exe = findExe();
    if (!exe) return { ok: false, notInstalled: true, msg: 'o Ollama não está instalado neste computador. Instale em ollama.com (é gratuito) e baixe um modelo, por exemplo: ollama pull qwen2.5:7b' };
    say('Ollama fechado: abrindo o Ollama em segundo plano…');
    let host = '127.0.0.1:11434';
    try { const u = new URL(base(url)); host = `${u.hostname === 'localhost' ? '127.0.0.1' : u.hostname}:${u.port || 11434}`; } catch (e) { /* padrão */ }
    let err = '';
    try {
      child = spawn(exe, ['serve'], { detached: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: Object.assign({}, process.env, { OLLAMA_HOST: host }) });
      child.stderr.on('data', d => { err = (err + d.toString()).slice(-600); });
      child.on('exit', () => { child = null; });
      child.on('error', e => { err = String(e.message || e); child = null; });
    } catch (e) { return { ok: false, msg: 'não foi possível abrir o Ollama (' + (e.message || e) + ').' }; }
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      await new Promise(r => setTimeout(r, 700));
      list = await tags(url, 1500);
      if (list) { say(`Ollama aberto em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s.`); return { ok: true, started: true, models: list }; }
      if (!child && err) break;
    }
    return { ok: false, msg: 'o Ollama foi aberto, mas não respondeu na porta ' + host.split(':').pop() + (err ? ' (' + err.trim().split('\n').pop().slice(0, 200) + ')' : '') + '.' };
  })().finally(() => { starting = null; });
  return starting;
}

// modelo a usar: o configurado (com ou sem “:latest”) ou, se ele não existe, um instalado (de preferência multilíngue)
function pickModel(models, wanted) {
  const w = String(wanted || '').trim();
  const has = m => models.includes(m);
  if (w && has(w)) return { model: w };
  if (w && !w.includes(':') && has(w + ':latest')) return { model: w + ':latest' };
  const gen = models.filter(m => !/embed|bge|nomic|minilm|whisper|clip|llava|vision/i.test(m));
  if (!gen.length) return { model: null };
  const pref = ['qwen', 'gemma', 'llama', 'mistral', 'aya', 'phi', 'deepseek'];
  const best = pref.map(p => gen.find(m => m.toLowerCase().startsWith(p))).find(Boolean) || gen[0];
  return { model: best, replaced: !!w };
}

// conversa em modo contínuo: devolve { content, prompt_eval_count, eval_count }
async function chat(url, body, onChunk) {
  const r = await fetch(base(url) + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({}, body, { stream: true, keep_alive: '30m' })) });
  if (!r.ok) throw new Error(`Ollama respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', content = '', last = {};
  const eat = line => {
    if (!line.trim()) return;
    let j;
    try { j = JSON.parse(line); } catch (e) { return; }
    if (j.error) throw new Error('Ollama: ' + j.error);
    if (j.message && j.message.content) { content += j.message.content; if (onChunk) onChunk(content.length); }
    if (j.done) last = j;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { eat(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  eat(buf);
  return { content, prompt_eval_count: last.prompt_eval_count || 0, eval_count: last.eval_count || 0 };
}

function stop() { if (child) { try { child.kill(); } catch (e) { /* ok */ } child = null; } }

module.exports = { ensure, tags, pickModel, chat, stop, findExe, isLocal, base };
