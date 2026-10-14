// Paginação da prévia em janelas ocultas (processos separados): a interface nunca trava enquanto o
// livro é paginado, e vários capítulos são paginados ao mesmo tempo. Cada capítulo começa numa página
// nova, então pode ser paginado sozinho; a prévia junta as páginas na ordem.
const { BrowserWindow } = require('electron');
const os = require('os');
const LayoutPasses = require('../shared/passes');

function createPool(pageUrl) {
  const size = Math.max(1, Math.min(4, (os.cpus() || []).length - 1 || 1));
  const workers = [];
  const queue = [];
  let seq = 0;

  function newWorker() {
    const win = new BrowserWindow({
      show: false, width: 1200, height: 900, paintWhenInitiallyHidden: true,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false }
    });
    const w = { win, busy: false };
    win.on('closed', () => { const i = workers.indexOf(w); if (i >= 0) workers.splice(i, 1); });
    workers.push(w);
    return w;
  }

  // Pagina um trecho do livro com as mesmas tentativas da exportação: notas inteiras na página da
  // chamada, parágrafo com nota que se perderia, e ajuste leve da última página do capítulo.
  async function runJob(w, job) {
    const t0 = Date.now();
    const { book, options } = job;
    const run = async o => {
      await w.win.loadURL(pageUrl);
      return w.win.webContents.executeJavaScript(`window.renderSegment(${JSON.stringify(book)}, ${JSON.stringify(o)})`, true);
    };
    const better = (a, b) => !b || (a.complete && !b.complete) || (a.complete === b.complete && (a.clippedNotes.length < b.clippedNotes.length || (!a.complete && a.clippedNotes.length === b.clippedNotes.length && a.pageWords > b.pageWords + 2)));
    const base = Object.assign({ segment: true }, options);
    let info = await run(Object.assign({}, base, { notePolicy: 'line' }));
    let best = info, bestO = Object.assign({}, base, { notePolicy: 'line' }), lastO = bestO;
    for (const p of [{ notePolicy: 'block' }, { notePolicy: '' }]) {
      if (best.complete && !best.clippedNotes.length) break;
      const o = Object.assign({}, base, p);
      if (p.notePolicy === '' && best.clippedNotes.length) o.lineNotes = best.clippedNotes;
      info = await run(o); lastO = o;
      if (better(info, best)) { best = info; bestO = o; }
    }
    for (let k = 0; k < 3 && !best.complete && (best.lostNotes || []).length; k++) {
      const o = Object.assign({}, bestO, { keepNotes: best.lostNotes });
      info = await run(o); lastO = o;
      if (better(info, best)) { best = info; bestO = o; } else break;
    }
    if (lastO !== bestO || best.clippedNotes.length) {
      info = await run(Object.assign({}, bestO, { showClippedNotes: true }));
      if (info.clippedNotes.length) info.revealedNotes = info.clippedNotes;
      lastO = bestO;
    } else info = best;
    if ((info.shortEnds || []).length && !info.revealedNotes) {
      const r = await LayoutPasses.lastPageAdjust(info, Object.assign({}, lastO), run, better);
      info = r.info;
      info.adjust = r.opts.adjust || {};
    }
    info.jobMs = Date.now() - t0;
    info.waitMs = t0 - job.t;
    return info;
  }

  function pump() {
    for (;;) {
      if (!queue.length) return;
      let w = workers.find(x => !x.busy && !x.win.isDestroyed());
      if (!w && workers.length < size) w = newWorker();
      if (!w) return;
      // o trecho pedido por último (o que está sendo editado) tem prioridade
      queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      const job = queue.shift();
      w.busy = true;
      runJob(w, job).then(job.resolve, job.reject).finally(() => { w.busy = false; pump(); });
    }
  }

  return {
    size,
    // key: identifica o trecho; um pedido novo para a mesma chave substitui o que ainda está na fila
    layout(book, options, key, priority) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (key && queue[i].key === key) { queue[i].resolve({ superseded: true }); queue.splice(i, 1); }
      }
      return new Promise((resolve, reject) => {
        queue.push({ book, options: options || {}, key, priority: priority || 0, seq: ++seq, resolve, reject, t: Date.now() });
        pump();
      });
    },
    // pedidos de uma paginação que ficou velha (o livro mudou de novo) saem da fila
    cancel(keys) {
      const set = new Set(keys || []);
      for (let i = queue.length - 1; i >= 0; i--) {
        if (!keys || set.has(queue[i].key)) { queue[i].resolve({ superseded: true }); queue.splice(i, 1); }
      }
    },
    destroy() { workers.forEach(w => { try { w.win.destroy(); } catch (e) { /* ok */ } }); }
  };
}

module.exports = { createPool };
