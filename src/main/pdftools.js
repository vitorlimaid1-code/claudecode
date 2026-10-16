// Ferramentas de PDF (tela Ferramentas → PDF): mesclar, remover páginas, reorganizar, PDF → JPG, proteger com
// senha e remover a senha. Tudo no computador. Os originais nunca são alterados: cada resultado é um arquivo
// novo (ou uma pasta nova, no caso das imagens). PDFs protegidos são abertos com a senha informada.
const fs = require('fs');
const path = require('path');

const lib = () => require('@cantoo/pdf-lib');

// abre o PDF; protegido: tenta sem senha (só senha do proprietário) e depois com a senha informada
async function openPdf(file, password) {
  const { PDFDocument } = lib();
  const buf = fs.readFileSync(file);
  try {
    return { doc: await PDFDocument.load(buf, { updateMetadata: false }), encrypted: false, buf };
  } catch (err) {
    if (!/encrypt/i.test(String(err && (err.name + err.message)))) throw err;
  }
  for (const pw of [password, ''].filter(p => p != null)) {
    try { return { doc: await PDFDocument.load(buf, { password: pw, updateMetadata: false }), encrypted: true, buf, usedPassword: pw }; } catch (e) { /* tenta a próxima */ }
  }
  const e = new Error(password ? 'senha incorreta' : 'o PDF é protegido por senha');
  e.needPassword = true;
  throw e;
}
// cópia sem proteção, só com as páginas pedidas (na ordem pedida, com giro opcional)
async function rebuild(src, items) {
  const { PDFDocument, degrees } = lib();
  const out = await PDFDocument.create();
  const idx = items.map(it => it.i);
  const pages = await out.copyPages(src, idx);
  pages.forEach((p, k) => {
    const rot = Number(items[k].rot) || 0;
    if (rot) p.setRotation(degrees(((p.getRotation().angle || 0) + rot) % 360));
    out.addPage(p);
  });
  try { const t = src.getTitle(); if (t) out.setTitle(t); const a = src.getAuthor(); if (a) out.setAuthor(a); } catch (e) { /* sem metadados */ }
  out.setProducer('Casa Vertigem Hub');
  return out;
}
const errOut = err => ({ error: String((err && err.message) || err), needPassword: !!(err && err.needPassword) });

function registerPdfTools({ ipcMain, app, rasterizePdf, safeName }) {
  // destino: Downloads, pasta do original ou pasta escolhida; nunca sobrescreve
  function outDir(src, mode, dir) {
    let d = app.getPath('downloads');
    if (mode === 'same' && src && fs.existsSync(src)) d = path.dirname(src);
    else if (mode === 'custom' && dir) d = dir;
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  function unique(d, base, ext) {
    const b = safeName(base || 'arquivo', 140);
    let f = path.join(d, ext ? `${b}.${ext}` : b);
    for (let i = 2; fs.existsSync(f); i++) f = path.join(d, ext ? `${b} (${i}).${ext}` : `${b} (${i})`);
    return f;
  }
  const baseOf = f => path.basename(f).replace(/\.pdf$/i, '');
  async function plainBytes(file, password) {
    const o = await openPdf(file, password);
    if (!o.encrypted) return { bytes: o.buf, doc: o.doc };
    const d = await rebuild(o.doc, o.doc.getPageIndices().map(i => ({ i })));
    return { bytes: Buffer.from(await d.save()), doc: o.doc };
  }

  ipcMain.handle('pdf:info', async (e, file, password) => {
    try {
      const o = await openPdf(file, password);
      const p = o.doc.getPages()[0];
      const sz = p ? p.getSize() : { width: 0, height: 0 };
      return { pages: o.doc.getPageCount(), encrypted: o.encrypted, size: fs.statSync(file).size, w: sz.width, h: sz.height, title: (() => { try { return o.doc.getTitle() || ''; } catch (err) { return ''; } })() };
    } catch (err) { return errOut(err); }
  });
  // miniaturas das páginas (para remover e reorganizar)
  ipcMain.handle('pdf:thumbs', async (e, file, password, dpi, max) => {
    try {
      const { bytes, doc } = await plainBytes(file, password);
      const n = Math.min(doc.getPageCount(), max || 600);
      const out = [];
      for (let a = 1; a <= n; a += 12) {
        const list = Array.from({ length: Math.min(12, n - a + 1) }, (x, k) => a + k);
        const imgs = await rasterizePdf(bytes, list, dpi || 36, '#ffffff');
        imgs.forEach(({ n: pg, img }) => out.push({ n: pg, url: 'data:image/jpeg;base64,' + img.toJPEG(72).toString('base64') }));
        try { e.sender.send('pdf:progress', { stage: 'thumbs', done: Math.min(n, a + 11), total: n }); } catch (err) { /* janela fechada */ }
      }
      return { pages: out, total: doc.getPageCount() };
    } catch (err) { return errOut(err); }
  });
  // mesclar: um PDF depois do outro, na ordem da lista
  ipcMain.handle('pdf:merge', async (e, items, target) => {
    try {
      const { PDFDocument } = lib();
      const out = await PDFDocument.create();
      let total = 0;
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        let o;
        try { o = await openPdf(it.path, it.password); } catch (err) { err.message = `${path.basename(it.path)}: ${err.message}`; err.file = it.path; throw err; }
        const pages = await out.copyPages(o.doc, o.doc.getPageIndices());
        pages.forEach(p => out.addPage(p));
        total += pages.length;
        try { e.sender.send('pdf:progress', { stage: 'merge', done: k + 1, total: items.length }); } catch (err) { /* ok */ }
      }
      out.setProducer('Casa Vertigem Hub');
      fs.writeFileSync(target, await out.save());
      return { ok: true, file: target, pages: total };
    } catch (err) { return Object.assign(errOut(err), { file: err.file }); }
  });
  // remover / reorganizar / girar: items = [{ i (índice da página original, 0…), rot }]
  ipcMain.handle('pdf:pages', async (e, file, password, items, target) => {
    try {
      const o = await openPdf(file, password);
      const n = o.doc.getPageCount();
      const ok = (items || []).filter(it => Number.isInteger(it.i) && it.i >= 0 && it.i < n);
      if (!ok.length) return { error: 'nenhuma página restaria no PDF' };
      const d = await rebuild(o.doc, ok);
      fs.writeFileSync(target, await d.save());
      return { ok: true, file: target, pages: ok.length, wasEncrypted: o.encrypted };
    } catch (err) { return errOut(err); }
  });
  // PDF → JPG: uma pasta nova com uma imagem por página
  ipcMain.handle('pdf:toJpg', async (e, file, password, opts) => {
    try {
      opts = opts || {};
      const { bytes, doc } = await plainBytes(file, password);
      const n = doc.getPageCount();
      const dir = unique(outDir(file, opts.mode, opts.dir), `${baseOf(file)} - páginas em JPG`);
      fs.mkdirSync(dir, { recursive: true });
      const dpi = Math.max(72, Math.min(600, Number(opts.dpi) || 200));
      const q = Math.max(40, Math.min(100, Number(opts.quality) || 90));
      const pad = String(n).length < 3 ? 3 : String(n).length;
      for (let a = 1; a <= n; a += 6) {
        const list = Array.from({ length: Math.min(6, n - a + 1) }, (x, k) => a + k);
        const imgs = await rasterizePdf(bytes, list, dpi, '#ffffff');
        imgs.forEach(({ n: pg, img }) => fs.writeFileSync(path.join(dir, `página ${String(pg).padStart(pad, '0')}.jpg`), img.toJPEG(q)));
        try { e.sender.send('pdf:progress', { stage: 'jpg', done: Math.min(n, a + 5), total: n, file }); } catch (err) { /* ok */ }
      }
      return { ok: true, dir, pages: n };
    } catch (err) { return errOut(err); }
  });
  // proteger com senha (AES-256): senha para abrir e permissões (imprimir, copiar, alterar)
  ipcMain.handle('pdf:protect', async (e, file, password, opts, target) => {
    try {
      opts = opts || {};
      if (!opts.userPassword) return { error: 'digite a senha' };
      const o = await openPdf(file, password);
      const d = o.encrypted ? await rebuild(o.doc, o.doc.getPageIndices().map(i => ({ i }))) : o.doc;
      d.encrypt({
        userPassword: String(opts.userPassword),
        ownerPassword: String(opts.ownerPassword || opts.userPassword),
        permissions: { printing: opts.allowPrint === false ? false : 'highResolution', copying: opts.allowCopy !== false, modifying: !!opts.allowModify, annotating: !!opts.allowModify, fillingForms: true, contentAccessibility: true, documentAssembly: !!opts.allowModify }
      });
      fs.writeFileSync(target, await d.save());
      return { ok: true, file: target };
    } catch (err) { return errOut(err); }
  });
  // remover a senha: abre com a senha e grava uma cópia sem proteção
  ipcMain.handle('pdf:unlock', async (e, file, password, target) => {
    try {
      const o = await openPdf(file, password);
      if (!o.encrypted) return { error: 'este PDF não tem senha' };
      const d = await rebuild(o.doc, o.doc.getPageIndices().map(i => ({ i })));
      fs.writeFileSync(target, await d.save());
      return { ok: true, file: target };
    } catch (err) { return errOut(err); }
  });
  ipcMain.handle('pdf:target', (e, src, suffix, mode, dir) => unique(outDir(src, mode, dir), `${baseOf(src || 'PDF')}${suffix ? ' ' + suffix : ''}`, 'pdf'));
}

module.exports = { registerPdfTools, openPdf, rebuild };
