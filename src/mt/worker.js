// Janela oculta do tradutor offline: carrega o modelo NLLB-200 da pasta de dados do app (app://models/)
// e traduz lotes de frases. Nada sai do computador.
import { pipeline, env } from './vendor/transformers.js';

const bridge = window.mtBridge;
const model = new URLSearchParams(location.search).get('model');
const threads = self.crossOriginIsolated ? Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1)) : 1;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = 'app://models/';
env.useBrowserCache = false;
env.useWasmCache = false;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('./vendor/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
  wasm: new URL('./vendor/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href
};
env.backends.onnx.wasm.numThreads = threads;

let translator = null;
const queue = [];
let busy = false;

async function run() {
  if (busy || !translator) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const res = await translator(job.texts, { src_lang: job.src, tgt_lang: job.tgt, max_new_tokens: 512 });
      const out = (Array.isArray(res) ? res : [res]).map(r => String((r && r.translation_text) || '').trim());
      bridge.reply({ id: job.id, out });
    } catch (e) { bridge.reply({ id: job.id, error: String((e && e.message) || e) }); }
  }
  busy = false;
}

bridge.onJob(job => { queue.push(job); run(); });

(async () => {
  try {
    translator = await pipeline('translation', model, { dtype: 'q8', device: 'wasm' });
    bridge.reply({ type: 'ready', threads });
    run();
  } catch (e) {
    bridge.reply({ type: 'fail', error: 'o motor offline não carregou: ' + String((e && e.message) || e) });
  }
})();
