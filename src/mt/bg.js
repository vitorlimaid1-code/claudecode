// Janela oculta da remoção de fundo: carrega o modelo de segmentação (MODNet ou outro compatível) e
// devolve a máscara de opacidade de cada imagem. Nada sai do computador.
import { pipeline, env, RawImage } from './vendor/transformers.js';

const bridge = window.bgBridge;
const q = new URLSearchParams(location.search);
const threads = self.crossOriginIsolated ? Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1)) : 1;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = q.get('base') || 'app://models/';
env.useBrowserCache = false;
env.useWasmCache = false;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('./vendor/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
  wasm: new URL('./vendor/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href
};
env.backends.onnx.wasm.numThreads = threads;

let seg = null;
const queue = [];
let busy = false;
async function run() {
  if (busy || !seg) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const img = await RawImage.fromBlob(new Blob([job.bytes], { type: job.mime || 'image/png' }));
      const out = await seg(img);
      const r = Array.isArray(out) ? out[0] : out;
      const ch = r.channels || 4;
      const mask = new Uint8Array(r.width * r.height);
      for (let i = 0; i < mask.length; i++) mask[i] = ch === 4 ? r.data[i * 4 + 3] : r.data[i];
      bridge.reply({ id: job.id, width: r.width, height: r.height, mask });
    } catch (e) { bridge.reply({ id: job.id, error: String((e && e.message) || e) }); }
  }
  busy = false;
}
bridge.onJob(job => { queue.push(job); run(); });

(async () => {
  try {
    seg = await pipeline('background-removal', q.get('model'), { dtype: q.get('dtype') || 'fp32', device: 'wasm' });
    bridge.reply({ type: 'ready', threads });
    run();
  } catch (e) {
    bridge.reply({ type: 'fail', error: 'o modelo de remoção de fundo não carregou: ' + String((e && e.message) || e) });
  }
})();
