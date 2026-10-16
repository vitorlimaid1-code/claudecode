// Tela Ferramentas (processo principal): escolha de arquivos e pasta, leitura e gravação, leitura de
// formatos de imagem que o navegador não entende (processo utilitário img-worker.js), PDF a partir de
// imagens, páginas de PDF como imagens e remoção de fundo por IA.
const fs = require('fs');
const path = require('path');

// extensões aceitas em cada conversor (a interface usa a mesma lista)
const IMG_IN = ['png', 'apng', 'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'avif', 'bmp', 'dib', 'ico', 'cur', 'svg', 'svgz', 'tif', 'tiff', 'heic', 'heif', 'hif', 'psd', 'psb', 'tga', 'icb', 'vda', 'vst', 'ppm', 'pgm', 'pbm', 'pnm', 'pam', 'qoi', 'pdf'];
const TXT_IN = ['docx', 'doc', 'odt', 'rtf', 'epub', 'pdf', 'txt', 'text', 'md', 'markdown', 'html', 'htm', 'xhtml', 'fb2'];

function registerTools({ ipcMain, dialog, app, utilityProcess, getWindow, rasterizePdf, safeName, bg }) {
  // processo utilitário dos decodificadores (aberto sob demanda, fechado depois de um tempo parado)
  let child = null, seq = 0, idle = null;
  const pending = new Map();
  function worker() {
    if (child) return child;
    child = utilityProcess.fork(path.join(__dirname, 'img-worker.js'), [], { serviceName: 'Casa Vertigem Hub — imagens' });
    child.on('message', msg => { const p = pending.get(msg.id); if (!p) return; pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg); });
    child.on('exit', () => { child = null; pending.forEach(p => p.reject(new Error('o leitor de imagens parou'))); pending.clear(); });
    return child;
  }
  function call(msg) {
    clearTimeout(idle);
    const w = worker();
    const id = ++seq;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); w.postMessage(Object.assign({ id }, msg)); })
      .finally(() => { clearTimeout(idle); idle = setTimeout(() => { if (child && !pending.size) { child.kill(); child = null; } }, 60000); });
  }

  ipcMain.handle('tools:pick', async (e, kind) => {
    const exts = kind === 'text' ? TXT_IN : kind === 'pdf' ? ['pdf'] : IMG_IN;
    const res = await dialog.showOpenDialog(getWindow(), { title: kind === 'text' ? 'Textos para converter' : kind === 'pdf' ? 'Arquivos PDF' : 'Imagens', filters: [{ name: kind === 'text' ? 'Textos e livros' : kind === 'pdf' ? 'PDF' : 'Imagens', extensions: exts }, { name: 'Todos os arquivos', extensions: ['*'] }], properties: ['openFile', 'multiSelections'] });
    return res.canceled ? [] : res.filePaths;
  });
  // pastas soltas na lista viram os livros que estão dentro delas (e nas subpastas), sem limite de quantidade
  ipcMain.handle('tools:expand', (e, paths) => {
    const ok = new RegExp('\\.(' + TXT_IN.join('|') + ')$', 'i');
    const out = [];
    const walk = (p, depth) => {
      let st;
      try { st = fs.statSync(p); } catch (err) { return; }
      if (st.isDirectory()) {
        if (depth > 8) return;
        let list = [];
        try { list = fs.readdirSync(p).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })); } catch (err) { return; }
        list.filter(n => !n.startsWith('.') && !n.startsWith('~$')).forEach(n => walk(path.join(p, n), depth + 1));
      } else if (ok.test(p)) out.push(p);
    };
    (paths || []).forEach(p => walk(p, 0));
    return out;
  });
  ipcMain.handle('tools:pickDir', async (e, title) => {
    const res = await dialog.showOpenDialog(getWindow(), { title: title || 'Pasta de saída', properties: ['openDirectory', 'createDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle('tools:read', async (e, file) => {
    try {
      const st = fs.statSync(file);
      if (st.size > 600 * 1048576) return { error: 'arquivo grande demais (mais de 600 MB)' };
      const b = fs.readFileSync(file);
      return { bytes: new Uint8Array(b.buffer, b.byteOffset, b.byteLength), size: st.size };
    } catch (err) { return { error: String(err.message || err) }; }
  });
  ipcMain.handle('tools:decode', async (e, file) => {
    try { const r = await call({ op: 'decode', file }); return { width: r.width, height: r.height, data: r.data }; } catch (err) { return { error: String(err.message || err) }; }
  });
  ipcMain.handle('tools:psd', async (e, img) => {
    try { const r = await call({ op: 'psd', width: img.width, height: img.height, data: img.data }); return { bytes: r.bytes }; } catch (err) { return { error: String(err.message || err) }; }
  });
  // destino: Downloads, a pasta do original ou uma pasta escolhida; nunca sobrescreve
  ipcMain.handle('tools:target', (e, { base, ext, src, mode, dir }) => {
    let d = app.getPath('downloads');
    if (mode === 'same' && src && fs.existsSync(src)) d = path.dirname(src);
    else if (mode === 'custom' && dir) d = dir;
    fs.mkdirSync(d, { recursive: true });
    const b = safeName(base || 'arquivo', 140);
    let f = path.join(d, `${b}.${ext}`);
    for (let i = 2; fs.existsSync(f); i++) f = path.join(d, `${b} (${i}).${ext}`);
    return f;
  });
  ipcMain.handle('tools:write', (e, file, data) => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : Buffer.from(data)); return { ok: true, file }; } catch (err) { return { error: String(err.message || err) }; }
  });
  // páginas de um PDF → PNG (para converter PDF em imagem)
  ipcMain.handle('tools:pdfPages', async (e, file, dpi, maxPages) => {
    try {
      const buf = fs.readFileSync(file);
      const { PDFDocument } = require('pdf-lib');
      const n = (await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
      const pages = Array.from({ length: Math.min(n, maxPages || 500) }, (x, i) => i + 1);
      const imgs = await rasterizePdf(buf, pages, Math.max(36, Math.min(600, dpi || 200)), null);
      return { total: n, pages: imgs.map(({ n: p, img }) => { const b = img.toPNG(); return { n: p, bytes: new Uint8Array(b.buffer, b.byteOffset, b.byteLength) }; }) };
    } catch (err) { return { error: String(err.message || err) }; }
  });
  // imagens → um PDF (uma página por imagem, no tamanho da imagem na resolução pedida)
  ipcMain.handle('tools:pdfFromImages', async (e, items, dpi) => {
    try {
      const { PDFDocument } = require('pdf-lib');
      const pdf = await PDFDocument.create();
      pdf.setProducer('Casa Vertigem Hub'); pdf.setCreator('Casa Vertigem Hub — Ferramentas');
      for (const it of items) {
        const im = it.mime === 'image/jpeg' ? await pdf.embedJpg(it.bytes) : await pdf.embedPng(it.bytes);
        const k = 72 / (dpi || 300);
        const page = pdf.addPage([im.width * k, im.height * k]);
        page.drawImage(im, { x: 0, y: 0, width: im.width * k, height: im.height * k });
      }
      const out = await pdf.save();
      return { bytes: out };
    } catch (err) { return { error: String(err.message || err) }; }
  });
  // remoção de fundo por IA
  ipcMain.handle('tools:bgStatus', () => bg.status());
  ipcMain.handle('tools:bgInstall', async e => bg.install(p => { try { e.sender.send('tools:bgProgress', p); } catch (err) { /* janela fechada */ } }));
  ipcMain.handle('tools:bgModel', (e, custom, dtype) => bg.setModel(custom, dtype));
  ipcMain.handle('tools:bgMask', async (e, bytes, mime) => { try { return await bg.mask(bytes, mime); } catch (err) { return { error: String(err.message || err) }; } });
}

module.exports = { registerTools, IMG_IN, TXT_IN };
