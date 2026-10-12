// Converte páginas de um PDF em imagens (PNG) na resolução pedida, usando pdf.js.
import * as pdfjs from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
let doc = null;

window.loadPdf = async function (base64) {
  const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  doc = await pdfjs.getDocument({ data: bin, isEvalSupported: false }).promise;
  return doc.numPages;
};

window.rasterPage = async function (n, dpi, background) {
  const page = await doc.getPage(n);
  const scale = dpi / 72;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  await page.render({ canvasContext: ctx, viewport: vp, background: background || 'rgba(0,0,0,0)' }).promise;
  page.cleanup();
  return canvas.toDataURL('image/png');
};
window.rasterReady = true;
