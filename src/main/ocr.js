// OCR offline para PDFs digitalizados (livros escaneados): cada página é rasterizada a 300 dpi na janela de
// raster do app e reconhecida pelo tesseract.js com os dados de português (tudo no computador, sem internet).
// O resultado sai no mesmo formato do leitor de PDF com texto (linhas com posição e tamanho), para que a
// limpeza do Melhoramento (cabeçalhos, números de página, títulos, parágrafos) funcione igual.
const path = require('path');

// no app instalado os pacotes ficam fora do .asar (asarUnpack): o worker_threads e o wasm precisam de arquivos reais
const unpacked = p => p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');

function createOcr({ withRenderWindow, cacheDir }) {
  let scheduler = null, idle = null;
  async function getScheduler() {
    clearTimeout(idle);
    if (scheduler) return scheduler;
    const T = require('tesseract.js');
    const workerPath = unpacked(path.join(path.dirname(require.resolve('tesseract.js/package.json')), 'src', 'worker-script', 'node', 'index.js'));
    const langPath = unpacked(path.join(path.dirname(require.resolve('@tesseract.js-data/por/package.json')), '4.0.0_best_int'));
    const s = T.createScheduler();
    const n = Math.max(1, Math.min(3, (require('os').cpus() || []).length - 1));
    for (let i = 0; i < n; i++) {
      const w = await T.createWorker('por', 1, { workerPath, langPath, gzip: true, cachePath: cacheDir, logger: () => {} });
      await w.setParameters({ preserve_interword_spaces: '1' });
      s.addWorker(w);
    }
    scheduler = s;
    return s;
  }
  function release() {
    clearTimeout(idle);
    idle = setTimeout(() => { if (scheduler) { scheduler.terminate().catch(() => {}); scheduler = null; } }, 90000);
  }

  // linhas reconhecidas → { y, x, size, parts, maxX } em pontos (y para cima, como no pdf.js)
  function toLines(data, dpi, pageHpt) {
    const k = 72 / dpi;
    const lines = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => {
      const text = String(l.text || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const words = (l.words || []).filter(w => w.text && w.text.trim());
      if (l.confidence < 35 && text.replace(/[^\p{L}]/gu, '').length < 4) return; // sujeira da digitalização
      // altura da letra: mediana da altura das palavras (a caixa da linha inclui ascendentes e descendentes)
      const hs = words.map(w => w.bbox.y1 - w.bbox.y0).sort((a, c) => a - c);
      const h = hs.length ? hs[Math.floor(hs.length / 2)] : (l.bbox.y1 - l.bbox.y0);
      const size = Math.round(h * k * 0.8 * 10) / 10;
      lines.push({ y: Math.round((pageHpt - l.bbox.y1 * k) * 10) / 10, x: Math.round(l.bbox.x0 * k * 10) / 10, size, maxX: Math.round(l.bbox.x1 * k * 10) / 10, parts: [{ text, sup: false, size }], ocr: Math.round(l.confidence) });
    })));
    return lines;
  }

  // pdf: Buffer; pages: números das páginas (1…); onProgress({ done, total })
  async function ocrPdf(pdf, pages, onProgress) {
    const dpi = 300;
    const sch = await getScheduler();
    try {
      return await withRenderWindow(async win => {
        for (let i = 0; i < 50; i++) {
          if (await win.webContents.executeJavaScript('!!window.rasterReady')) break;
          await new Promise(r => setTimeout(r, 100));
        }
        const total = await win.webContents.executeJavaScript(`window.loadPdf(${JSON.stringify(pdf.toString('base64'))})`, true);
        const list = (pages && pages.length ? pages : Array.from({ length: total }, (x, i) => i + 1)).filter(n => n >= 1 && n <= total);
        const out = [];
        const jobs = [], pending = new Set();
        let done = 0;
        for (const n of list) {
          const url = await win.webContents.executeJavaScript(`window.rasterPage(${n}, ${dpi}, "#ffffff")`, true);
          const png = Buffer.from(String(url).split(',')[1] || '', 'base64');
          // tamanho da página em pontos (pela imagem a 300 dpi)
          const wPx = png.readUInt32BE(16), hPx = png.readUInt32BE(20);
          const job = sch.addJob('recognize', png, {}, { text: false, blocks: true }).then(r => {
            out.push({ n, width: wPx * 72 / dpi, height: hPx * 72 / dpi, lines: toLines(r.data, dpi, hPx * 72 / dpi), ocr: true });
            done++;
            if (onProgress) onProgress({ done, total: list.length });
          });
          jobs.push(job);
          pending.add(job);
          job.finally(() => pending.delete(job)).catch(() => {});
          // no máximo algumas páginas na fila (memória)
          if (pending.size >= 4) await Promise.race(pending).catch(() => {});
        }
        await Promise.all(jobs);
        return out.sort((a, c) => a.n - c.n);
      }, { page: 'src/renderer/raster.html' });
    } finally { release(); }
  }
  return { ocrPdf };
}

module.exports = { createOcr };
