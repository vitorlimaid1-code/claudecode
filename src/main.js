// Processo principal do Diagramador de Livros.
// Tudo roda localmente: nenhuma requisição de rede é permitida.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { buildBook, effectiveBleed } = require('./book');
const { normalizeProject, newProject, BUNDLED_FONTS, PAGE_FORMATS, outputSheetSize, markGeometry } = require('./shared/defaults');
const { importAny } = require('./main/importers');
const { FontManager } = require('./main/fonts');
const { ImageLibrary, analyzeImage, hashBuffer } = require('./main/library');
const exporters = require('./main/exporters');
const cmyk = require('./main/cmyk');
const CoverGeometry = require('./shared/cover');
const manuscript = require('./main/manuscript');
const pdfcolor = require('./main/pdfcolor');

const APP_ROOT = path.join(__dirname, '..');
const PROJECT_EXT = 'livro';

// Versão portátil: guarda configurações e bibliotecas ao lado do executável
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'DiagramadorDeLivros-dados'));
} else if (fs.existsSync(path.join(path.dirname(process.execPath), 'portable.txt'))) {
  app.setPath('userData', path.join(path.dirname(process.execPath), 'dados'));
}

// Sem tráfego de rede do próprio Chromium (atualizações de componentes etc.)
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-domain-reliability');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.ttc': 'font/collection'
};
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };

let mainWindow = null;
let allowClose = false;
let pendingOpenPath = null;
let fonts = null;
let library = null;

function appUrl(rel) { return 'app://local/' + rel.replace(/\\/g, '/'); }
function userFile(name) { return path.join(app.getPath('userData'), name); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }

function registerAppProtocol() {
  protocol.handle('app', async request => {
    const url = new URL(request.url);
    let filePath = null;
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (url.host === 'local') {
      filePath = path.normalize(path.join(APP_ROOT, rel));
      if (!filePath.startsWith(APP_ROOT)) filePath = null;
    } else if (url.host === 'userlib') {
      filePath = library.resolveUserFile(rel);
    } else if (url.host === 'fontfile') {
      try {
        const f = Buffer.from(rel, 'base64url').toString('utf8');
        if (fonts.isAllowedFile(f)) filePath = f;
      } catch (e) { filePath = null; }
    }
    if (!filePath) return new Response('Proibido', { status: 403 });
    try {
      const data = await fs.promises.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
    } catch (e) {
      return new Response('Não encontrado', { status: 404 });
    }
  });
}

function blockNetwork(ses) {
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] },
    (details, callback) => callback({ cancel: true })
  );
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(false));
}

function hardenContents(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1100, minHeight: 680,
    title: 'Diagramador de Livros', backgroundColor: '#f4f2ee',
    icon: path.join(APP_ROOT, 'build', 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  mainWindow.webContents.session.setSpellCheckerLanguages(['pt-BR']);
  mainWindow.loadURL(appUrl('src/renderer/index.html'));
  mainWindow.once('ready-to-show', () => { if (!process.env.SCREENSHOT_OUT) mainWindow.maximize(); mainWindow.show(); });
  if (process.env.SCREENSHOT_OUT) setupScreenshot();
  mainWindow.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow.webContents.send('request-close');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('render-process-gone', () => { allowClose = true; });
  mainWindow.on('unresponsive', () => { allowClose = true; });
}

// Usado apenas para documentação/testes automatizados: executa um script, captura a janela e encerra
function setupScreenshot() {
  mainWindow.webContents.on('console-message', e => {
    if (e.level === 'error' || e.level === 'warning') console.log('CONSOLE ' + e.level + ': ' + e.message);
  });
  mainWindow.webContents.once('did-finish-load', () => setTimeout(async () => {
    const steps = process.env.SCREENSHOT_STEPS ? JSON.parse(fs.readFileSync(process.env.SCREENSHOT_STEPS, 'utf8')) : [process.env.SCREENSHOT_JS || 'void 0'];
    for (let i = 0; i < steps.length; i++) {
      const r = await mainWindow.webContents.executeJavaScript(steps[i], true).catch(e => 'ERR ' + e.message);
      if (r !== undefined) console.log('JS_RESULT ' + i + ' ' + JSON.stringify(r));
      await new Promise(res => setTimeout(res, Number(process.env.SCREENSHOT_WAIT || 2500)));
      const img = await mainWindow.webContents.capturePage();
      fs.writeFileSync(steps.length > 1 ? process.env.SCREENSHOT_OUT.replace(/\.png$/, `-${i}.png`) : process.env.SCREENSHOT_OUT, img.toPNG());
    }
    allowClose = true;
    app.quit();
  }, 4000));
}

function send(cmd) { if (mainWindow) mainWindow.webContents.send('menu', cmd); }

function buildMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo livro', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: 'Salvar', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Salvar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Importar manuscrito (DOCX, DOC, EPUB, PDF, ODT, TXT…)', accelerator: 'CmdOrCtrl+I', click: () => send('import') },
        { label: 'Exportar…', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' }, { label: 'Refazer', role: 'redo' },
        { label: 'Desfazer ação do projeto', accelerator: 'CmdOrCtrl+Alt+Z', click: () => send('projectUndo') },
        { label: 'Refazer ação do projeto', accelerator: 'CmdOrCtrl+Alt+Y', click: () => send('projectRedo') },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' }, { label: 'Copiar', role: 'copy' }, { label: 'Colar', role: 'paste' },
        { label: 'Colar sem formatação', role: 'pasteAndMatchStyle' }, { label: 'Selecionar tudo', role: 'selectAll' },
        { type: 'separator' },
        { label: 'Localizar e substituir…', accelerator: 'CmdOrCtrl+F', click: () => send('find') }
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        { label: 'Atualizar prévia', accelerator: 'F5', click: () => send('refresh') },
        { label: 'Caracteres invisíveis', accelerator: 'CmdOrCtrl+Shift+8', click: () => send('invisibles') },
        { type: 'separator' },
        { label: 'Aumentar zoom da interface', role: 'zoomIn' }, { label: 'Diminuir zoom da interface', role: 'zoomOut' },
        { label: 'Zoom padrão', role: 'resetZoom' }, { type: 'separator' },
        { label: 'Tela cheia', role: 'togglefullscreen' },
        { label: 'Ferramentas de desenvolvedor', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Como usar', click: () => send('help') },
        {
          label: 'Sobre',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'Sobre', message: `Diagramador de Livros ${app.getVersion()}`,
            detail: `Diagramação de livros 100% local e offline.\nSeus textos nunca saem do seu computador.\n\nDados do aplicativo: ${app.getPath('userData')}\n\nPaginação: Paged.js (MIT). Fontes embutidas: SIL Open Font License.`
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- projetos
function readProjectFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data || data.format !== 'diagramador-de-livros') throw new Error('Este arquivo não é um projeto do Diagramador de Livros.');
  return normalizeProject(data);
}
function writeFileAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}
function safeName(s, max) { return (String(s || 'livro').replace(/[\\/:*?"<>|]+/g, '').trim() || 'livro').slice(0, max || 80); }

ipcMain.handle('project:open', async (e, filePath) => {
  if (!filePath) {
    const res = await dialog.showOpenDialog(mainWindow, { title: 'Abrir livro', filters: [{ name: 'Projeto de livro', extensions: [PROJECT_EXT] }], properties: ['openFile'] });
    if (res.canceled || !res.filePaths.length) return null;
    filePath = res.filePaths[0];
  }
  try { return { filePath, project: readProjectFile(filePath) }; } catch (err) {
    dialog.showErrorBox('Não foi possível abrir', String(err.message || err));
    return null;
  }
});

ipcMain.handle('project:save', async (e, { project, filePath, saveAs }) => {
  if (!filePath || saveAs) {
    const res = await dialog.showSaveDialog(mainWindow, { title: 'Salvar livro', defaultPath: filePath || safeName(project.meta && project.meta.title) + '.' + PROJECT_EXT, filters: [{ name: 'Projeto de livro', extensions: [PROJECT_EXT] }] });
    if (res.canceled || !res.filePath) return null;
    filePath = res.filePath;
  }
  try {
    // cópia de segurança da versão anterior
    if (fs.existsSync(filePath)) { try { fs.copyFileSync(filePath, filePath + '.bak'); } catch (err) { /* ok */ } }
    writeFileAtomic(filePath, JSON.stringify(normalizeProject(project)));
    return { filePath };
  } catch (err) {
    dialog.showErrorBox('Não foi possível salvar', String(err.message || err));
    return null;
  }
});

ipcMain.handle('autosave:write', async (e, data) => {
  try { await fs.promises.mkdir(app.getPath('userData'), { recursive: true }); await fs.promises.writeFile(userFile('autosave.json'), JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch (err) { return false; }
});
ipcMain.handle('autosave:read', async () => {
  try { const d = JSON.parse(await fs.promises.readFile(userFile('autosave.json'), 'utf8')); d.project = normalizeProject(d.project); return d; } catch (e) { return null; }
});
ipcMain.handle('autosave:clear', async () => { try { await fs.promises.unlink(userFile('autosave.json')); } catch (e) { /* ok */ } return true; });

// Configuração padrão do usuário: só muda quando ele pede para salvar
ipcMain.handle('defaults:get', () => readJson(userFile('meu-padrao.json'), null));
ipcMain.handle('defaults:set', (e, settings) => { writeJson(userFile('meu-padrao.json'), settings); return true; });
ipcMain.handle('defaults:reset', () => { try { fs.unlinkSync(userFile('meu-padrao.json')); } catch (e) { /* ok */ } return true; });
ipcMain.handle('defaults:newProject', () => {
  const p = newProject(readJson(userFile('meu-padrao.json'), null));
  const ficha = readJson(userFile('ficha-fixa.json'), null);
  if (ficha) { p.catalog = Object.assign(p.catalog, ficha.catalog || {}); if (ficha.meta) Object.assign(p.meta, ficha.meta); if (ficha.titlePage) Object.assign(p.titlePage, ficha.titlePage); if (ficha.assets) Object.assign(p.assets, ficha.assets); }
  return p;
});

// Ficha catalográfica fixa (aplicada a todo livro novo) e modelos salvos pelo usuário
ipcMain.handle('catalog:fixedGet', () => readJson(userFile('ficha-fixa.json'), null));
ipcMain.handle('catalog:fixedSet', (e, data) => { if (data) writeJson(userFile('ficha-fixa.json'), data); else { try { fs.unlinkSync(userFile('ficha-fixa.json')); } catch (err) { /* ok */ } } return true; });
ipcMain.handle('catalog:templatesGet', () => readJson(userFile('modelos-ficha.json'), []));
ipcMain.handle('catalog:templatesSet', (e, list) => { writeJson(userFile('modelos-ficha.json'), list || []); return true; });

// Capa: prova de cor (CMYK simulado na tela) e leitura de manuscrito para calcular dimensões
ipcMain.handle('cover:proof', async (e, cover, assets, dpi) => {
  try { return await cmyk.softProof(APP_ROOT, cover || {}, assets || {}, CoverGeometry.geometry(cover || {}), Math.max(36, Math.min(200, Number(dpi) || 72))); } catch (err) { return { error: String(err.message || err) }; }
});
ipcMain.handle('cover:analyze', async (e, settings) => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Manuscrito para calcular a capa', filters: [{ name: 'Livros', extensions: ['pdf', 'doc', 'docx', 'odt', 'html', 'htm', 'epub', 'mobi', 'azw', 'azw3', 'txt', 'md'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return null;
  try { return await manuscript.analyze(res.filePaths[0], settings || {}); } catch (err) { dialog.showErrorBox('Não foi possível ler o manuscrito', String(err.message || err)); return null; }
});

// Salva uma imagem PNG gerada na interface (ex.: prévia 3D da capa com fundo transparente)
ipcMain.handle('dialog:savePng', async (e, name, dataUrl) => {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const file = await askSavePath('Salvar imagem PNG', name || 'capa-3d.png', [{ name: 'PNG', extensions: ['png'] }]);
  if (!file) return null;
  fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
  return file;
});

// Conjuntos tipográficos salvos
ipcMain.handle('typesets:get', () => readJson(userFile('conjuntos-tipograficos.json'), {}));
ipcMain.handle('typesets:set', (e, data) => { writeJson(userFile('conjuntos-tipograficos.json'), data); return true; });

// Perfis de exportação / gráficas
ipcMain.handle('profiles:get', () => readJson(userFile('perfis.json'), null));
ipcMain.handle('profiles:set', (e, data) => { writeJson(userFile('perfis.json'), data); return true; });

// ---------------------------------------------------------------- importação
const IMPORT_FILTERS = [
  { name: 'Manuscritos', extensions: ['docx', 'doc', 'epub', 'pdf', 'odt', 'txt', 'md', 'markdown', 'html', 'htm', 'rtf'] },
  { name: 'Todos os arquivos', extensions: ['*'] }
];
async function importPath(filePath) {
  try { return await importAny(filePath); } catch (err) {
    dialog.showErrorBox('Não foi possível importar', `${path.basename(filePath)}\n\n${String(err.message || err)}`);
    return null;
  }
}
ipcMain.handle('import:file', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Importar manuscrito', filters: IMPORT_FILTERS, properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return null;
  return importPath(res.filePaths[0]);
});
ipcMain.handle('import:path', (e, filePath) => importPath(filePath));

// ---------------------------------------------------------------- imagens
function fileToAsset(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const info = analyzeImage(buf);
  const mime = IMAGE_MIME[ext] || 'image/png';
  return { name: path.basename(filePath, ext), dataUrl: `data:${mime};base64,${buf.toString('base64')}`, width: info.width, height: info.height, info, hash: hashBuffer(buf), source: filePath };
}
ipcMain.handle('image:pick', async (e, opts) => {
  opts = opts || {};
  const res = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Escolher imagem', filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }],
    properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths.map(fileToAsset);
});
ipcMain.handle('image:fromPaths', (e, paths) => paths.filter(p => IMAGE_MIME[path.extname(p).toLowerCase()]).map(fileToAsset));
ipcMain.handle('image:analyze', (e, dataUrl) => {
  const bin = exporters.dataUrlToBuffer(dataUrl);
  if (!bin) return null;
  const info = analyzeImage(bin.buf);
  info.hash = hashBuffer(bin.buf);
  return info;
});

// Bibliotecas de imagens
ipcMain.handle('lib:list', () => library.list());
ipcMain.handle('lib:addDialog', async (e, kind) => {
  const res = await dialog.showOpenDialog(mainWindow, { title: kind === 'separadores' ? 'Adicionar separadores (PNG recomendado)' : 'Adicionar imagens à biblioteca', filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }], properties: ['openFile', 'multiSelections'] });
  if (res.canceled) return null;
  return library.add(kind, res.filePaths);
});
ipcMain.handle('lib:addPaths', (e, kind, paths) => library.add(kind, paths));
ipcMain.handle('lib:addDataUrl', (e, kind, name, dataUrl) => {
  const bin = exporters.dataUrlToBuffer(dataUrl);
  return bin ? library.addBuffer(kind, `${name}.${exporters.EXT[bin.mime] || 'png'}`, bin.buf) : null;
});
ipcMain.handle('lib:update', (e, key, patch) => { library.update(key, patch); return true; });
ipcMain.handle('lib:remove', (e, key) => library.remove(key));
ipcMain.handle('lib:openFolder', () => { fs.mkdirSync(library.userDir, { recursive: true }); shell.openPath(library.userDir); });

// ---------------------------------------------------------------- fontes
ipcMain.handle('fonts:system', (e, force) => fonts.scanSystem(!!force));
ipcMain.handle('fonts:library', () => fonts.library());
ipcMain.handle('fonts:addDialog', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Adicionar fontes à biblioteca', filters: [{ name: 'Fontes', extensions: ['ttf', 'otf', 'ttc', 'woff', 'woff2'] }], properties: ['openFile', 'multiSelections'] });
  if (res.canceled) return null;
  return fonts.addFiles(res.filePaths);
});
ipcMain.handle('fonts:addPaths', (e, paths) => fonts.addFiles(paths));
ipcMain.handle('fonts:addFromSystem', (e, family) => {
  const fam = (fonts.scanSystem() || []).find(f => f.family === family);
  return fam ? fonts.addFiles([...new Set(fam.faces.map(x => x.file))]) : null;
});
ipcMain.handle('fonts:remove', (e, family) => { fonts.removeFamily(family); return true; });
ipcMain.handle('fonts:css', (e, families) => { if (!fonts.system) fonts.scanSystem(); return fonts.fontFaceCss(families); });

// ---------------------------------------------------------------- livro / renderização
async function bookPayload(project) {
  const book = await buildBook(project);
  if (!fonts.system) fonts.scanSystem();
  const extra = book.fonts.filter(f => !book.bundledFonts.includes(f));
  const ff = fonts.fontFaceCss(extra);
  book.fontFaceCss = ff.css;
  book.missingFonts = ff.missing;
  book.fontReport = ff.report;
  return book;
}
ipcMain.handle('book:build', async (e, project) => bookPayload(project));

async function withRenderWindow(fn, opts) {
  opts = opts || {};
  const win = new BrowserWindow({
    show: false, width: opts.width || 1200, height: opts.height || 900,
    paintWhenInitiallyHidden: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, offscreen: !!opts.offscreen, backgroundThrottling: false }
  });
  try {
    await win.loadURL(appUrl(opts.page || 'src/renderer/preview.html'));
    return await fn(win);
  } finally {
    win.destroy();
  }
}

async function renderBookIn(win, project, options) {
  const book = await bookPayload(project);
  const info = await win.webContents.executeJavaScript(`window.renderBook(${JSON.stringify(book)}, ${JSON.stringify(options || {})})`, true);
  return { book, info };
}

async function renderPdf(project, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const tm = label => { if (process.env.DEBUG_TIMING) console.log('TIMING', label, Date.now() - t0, 'ms'); };
  return withRenderWindow(async win => {
    tm('janela');
    const ns = normalizeProject(project).settings;
    const sh = outputSheetSize(ns, effectiveBleed(ns));
    if (sh && sh.fits && !opts.spreads) project = Object.assign({}, project, { settings: Object.assign({}, project.settings, { cropMarks: false }) });
    const { info } = await renderBookIn(win, project, { spreadsPrint: !!opts.spreads, pageRange: opts.range || '' });
    tm('paginação');
    if (process.env.DEBUG_LAYOUT) {
      const dbg = await win.webContents.executeJavaScript(`(() => { const t = document.querySelector('.pagedjs_pages').innerText; return { clipped: window.findClippedText().slice(0, 6), chars: t.length, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, notes: [...document.querySelectorAll('.pagedjs_page')].map(p => { const a = p.querySelector('.pagedjs_footnote_area'); const r = a && a.getBoundingClientRect(); const pr = p.getBoundingClientRect(); const f = [...p.querySelectorAll('.pagedjs_footnote_area .footnote')]; return f.length || (r && r.height) ? { n: p.dataset.pageNumber, f: f.map(x => x.innerText.slice(0, 12) + '@' + Math.round(x.getBoundingClientRect().top - pr.top) + '/' + Math.round(pr.height)), ah: r && Math.round(r.height) } : null; }).filter(Boolean) }; })()`, true);
      console.log('DEBUG_LAYOUT', JSON.stringify(dbg));
    }
    let pdf = await win.webContents.printToPDF({
      printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' },
      generateDocumentOutline: !!opts.outline, generateTaggedPDF: !!opts.tagged
    });
    tm('printToPDF');
    let colorReport = null;
    if (!opts.spreads) ({ pdf, colorReport } = await finishPrintPdf(pdf, project, opts));
    tm('caixas/cor');
    return { pdf, pages: info.pages, info, colorReport };
  });
}

// Grava TrimBox (formato final de corte) e BleedBox em cada página e os metadados do livro;
// se pedido, converte as cores do miolo para CMYK (perfil ICC) ou escala de cinza (100% K)
async function finishPrintPdf(pdfBuf, project, opts) {
  opts = opts || {};
  let colorReport = null;
  if (opts.color === 'cmyk' || opts.color === 'gray') {
    try {
      const r = await pdfcolor.convertPdfColor(pdfBuf, opts.color, APP_ROOT, { profile: opts.colorProfile, noProfile: !!opts.noProfile });
      pdfBuf = r.pdf;
      colorReport = r.report;
    } catch (e) { console.error('convertPdfColor', e); colorReport = { error: String(e.message || e) }; }
  }
  return { pdf: await finishBoxes(pdfBuf, project, opts), colorReport };
}
async function finishBoxes(pdfBuf, project, opts) {
  try {
    const { PDFDocument, rgb, cmyk: cmykColor, grayscale } = require('pdf-lib');
    const doc = await PDFDocument.load(pdfBuf, { updateMetadata: false });
    const s = normalizeProject(project).settings;
    // folha de saída personalizada (pedido da gráfica): a página vai centralizada, sem redução
    const sheet = outputSheetSize(s, effectiveBleed(s));
    const useSheet = sheet && sheet.fits;
    const ptmm = 72 / 25.4;
    const tw = s.pageWidth * ptmm;
    const th = s.pageHeight * ptmm;
    const b = effectiveBleed(s) * ptmm;
    // O Chromium arredonda o tamanho da folha para pontos inteiros, mas desenha a página a partir
    // do canto superior esquerdo no tamanho exato: as caixas são gravadas com as medidas exatas.
    const W = tw + 2 * b;
    const H = th + 2 * b;
    // KDP: a sangria do miolo existe só nas bordas externas (a lombada não tem sangria)
    const fmt = PAGE_FORMATS.find(f => f.id === s.pageFormat);
    const outerOnly = !useSheet && b > 0 && ((s.kdp && s.kdp.enabled) || (fmt && /KDP/.test(fmt.group)));
    const markColor = opts && opts.color === 'cmyk' ? cmykColor(1, 1, 1, 1) : opts && opts.color === 'gray' ? grayscale(0) : rgb(0, 0, 0);
    const first = opts && opts.range ? Math.max(1, Math.min(...String(opts.range).match(/\d+/g).map(Number))) : 1;
    doc.getPages().forEach((pg, i) => {
      const { height } = pg.getSize();
      const y0 = height - H;
      const recto = (first + i) % 2 === 1; // página ímpar = direita: a lombada fica à esquerda
      const mx = outerOnly && recto ? b : 0;
      const mw = outerOnly ? W - b : W;
      pg.setTrimBox(b, y0 + b, tw, th);
      pg.setArtBox(b, y0 + b, tw, th);
      if (useSheet) {
        const SW = sheet.w * ptmm, SH = sheet.h * ptmm;
        const cx = b + tw / 2, cy = y0 + b + th / 2;
        pg.setMediaBox(cx - SW / 2, cy - SH / 2, SW, SH);
        pg.setCropBox(cx - SW / 2, cy - SH / 2, SW, SH);
        pg.setBleedBox(0, y0, W, H);
        if (s.outputSheet.marks || sheet.marksOnly) {
          // marcas de corte fora da sangria (padrão: 5 mm de comprimento, a 2 mm da sangria;
          // CEDET: 0,25 pt com deslocamento de 5 mm a partir do corte)
          const mg = markGeometry(s, effectiveBleed(s));
          const off = mg.offset * ptmm, len = mg.len * ptmm;
          const x1 = b, x2 = b + tw, yb = y0 + b, yt = y0 + b + th;
          const line = (a, c) => pg.drawLine({ start: { x: a[0], y: a[1] }, end: { x: c[0], y: c[1] }, thickness: mg.weight, color: markColor });
          [[x1, yb], [x2, yb], [x1, yt], [x2, yt]].forEach(([x, y]) => {
            const sx = x === x1 ? -1 : 1, sy = y === yb ? -1 : 1;
            line([x + sx * off, y], [x + sx * (off + len), y]);
            line([x, y + sy * off], [x, y + sy * (off + len)]);
          });
        }
      } else {
        pg.setMediaBox(mx, y0, mw, H);
        pg.setCropBox(mx, y0, mw, H);
        pg.setBleedBox(mx, y0, mw, H);
      }
    });
    const m = project.meta || {};
    doc.setTitle(m.title || '');
    doc.setAuthor(m.author || '');
    doc.setCreator('Diagramador de Livros');
    doc.setProducer('Diagramador de Livros (Chromium/Skia PDF)');
    doc.setLanguage(m.language || 'pt-BR');
    return Buffer.from(await doc.save({ useObjectStreams: false }));
  } catch (e) {
    console.error('finishPrintPdf', e);
    return pdfBuf;
  }
}

function parseRange(spec, total) {
  const keep = new Set();
  spec = String(spec || '').trim();
  if (!spec) { for (let i = 1; i <= total; i++) keep.add(i); return keep; }
  spec.split(',').forEach(p => {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(p.trim());
    if (m) for (let i = +m[1]; i <= +m[2]; i++) keep.add(i); else if (+p) keep.add(+p);
  });
  return keep;
}

// PDF -> imagens (PNG, JPEG ou TIFF) na resolução pedida, rasterizando com pdf.js
async function rasterizePdf(pdf, pages, dpi, background) {
  const { nativeImage } = require('electron');
  return withRenderWindow(async win => {
    for (let i = 0; i < 50; i++) {
      if (await win.webContents.executeJavaScript('!!window.rasterReady')) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const total = await win.webContents.executeJavaScript(`window.loadPdf(${JSON.stringify(pdf.toString('base64'))})`, true);
    const out = [];
    for (const n of pages) {
      if (n > total) continue;
      const url = await win.webContents.executeJavaScript(`window.rasterPage(${n}, ${dpi}, ${JSON.stringify(background || null)})`, true);
      out.push({ n, img: nativeImage.createFromDataURL(url) });
    }
    return out;
  }, { page: 'src/renderer/raster.html' });
}

async function renderPageImages(project, opts) {
  const dpi = Math.max(72, Math.min(600, Number(opts.dpi) || 300));
  const { pdf, pages } = await renderPdf(project, {});
  const list = [...parseRange(opts.range, pages)].filter(n => n <= pages).sort((a, b) => a - b);
  const imgs = await rasterizePdf(pdf, list, dpi, '#ffffff');
  if (opts.bleed) return imgs;
  // sem sangria: recorta a área de corte
  const bleed = Math.max(Number(project.settings.bleedTop) || 0, Number(project.settings.bleedBottom) || 0, Number(project.settings.bleedOuter) || 0, Number(project.settings.bleed) || 0);
  if (!bleed) return imgs;
  const px = Math.round(bleed / 25.4 * dpi);
  return imgs.map(({ n, img }) => {
    const s = img.getSize();
    return { n, img: img.crop({ x: px, y: px, width: s.width - 2 * px, height: s.height - 2 * px }) };
  });
}

function encodeImage(img, format, dpi, quality) {
  if (format === 'jpeg') return img.toJPEG(Math.max(30, Math.min(100, Number(quality) || 92)));
  if (format === 'tiff') { const s = img.getSize(); return exporters.encodeTiff(img.toBitmap(), s.width, s.height, dpi); }
  return img.toPNG();
}

ipcMain.handle('export:inspect', async (e, project, opts) => {
  return withRenderWindow(async win => {
    const { book, info } = await renderBookIn(win, project, {});
    const res = await win.webContents.executeJavaScript(`window.inspectBook(${JSON.stringify(opts || {})})`, true);
    res.missingFonts = book.missingFonts;
    res.fontReport = book.fontReport;
    res.missingAssets = book.missingAssets;
    res.chapterPages = info.chapterPages;
    return res;
  });
});

async function askSavePath(title, defaultName, filters) {
  const res = await dialog.showSaveDialog(mainWindow, { title, defaultPath: defaultName, filters });
  return res.canceled ? null : res.filePath;
}
async function askFolder(title) {
  const res = await dialog.showOpenDialog(mainWindow, { title, properties: ['openDirectory', 'createDirectory'] });
  return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
}

async function runExport(req) {
  const { kind, project } = req;
  const opts = req.opts || {};
  const base = safeName(project.meta && project.meta.title);
  if (kind === 'pdf') {
    const file = opts.target || await askSavePath('Exportar PDF', `${opts.fileBase ? safeName(opts.fileBase, 140) : base + (opts.suffix || '')}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
    if (!file) return null;
    const { pdf, pages, colorReport } = await renderPdf(project, opts);
    fs.writeFileSync(file, pdf);
    return { files: [file], pages, colorReport };
  }
  if (kind === 'png' || kind === 'jpeg' || kind === 'tiff') {
    const dir = opts.target || await askFolder('Escolha a pasta para as imagens das páginas');
    if (!dir) return null;
    const imgs = await renderPageImages(project, opts);
    const ext = kind === 'jpeg' ? 'jpg' : kind === 'tiff' ? 'tif' : 'png';
    const files = imgs.map(({ n, img }) => {
      const f = path.join(dir, `${base}-pagina-${String(n).padStart(3, '0')}.${ext}`);
      fs.writeFileSync(f, encodeImage(img, kind, opts.dpi || 300, opts.quality));
      return f;
    });
    return { files, pages: files.length };
  }
  const formats = { epub: ['EPUB', 'epub'], docx: ['Word', 'docx'], odt: ['OpenDocument', 'odt'], txt: ['Texto', 'txt'] };
  if (formats[kind]) {
    const file = opts.target || await askSavePath(`Exportar ${formats[kind][0]}`, `${base}.${formats[kind][1]}`, [{ name: formats[kind][0], extensions: [formats[kind][1]] }]);
    if (!file) return null;
    const s = project.settings;
    const page = { width: s.pageWidth, height: s.pageHeight, marginTop: s.marginTop, marginBottom: s.marginBottom, marginInner: s.marginInner, marginOuter: s.marginOuter };
    let buf;
    if (kind === 'epub') buf = await exporters.exportEpub(Object.assign({ uuid: crypto.randomUUID() }, req.epub), project.assets || {});
    else if (kind === 'docx') buf = await exporters.exportDocx(req.doc, project.assets || {}, page);
    else if (kind === 'odt') buf = await exporters.exportOdt(req.doc, project.assets || {}, page);
    else buf = exporters.exportTxt(req.doc);
    fs.writeFileSync(file, buf);
    return { files: [file] };
  }
  if (kind === 'package') {
    const file = opts.target || await askSavePath('Salvar pacote de produção', `${base}-pacote-producao.zip`, [{ name: 'ZIP', extensions: ['zip'] }]);
    if (!file) return null;
    const files = [];
    const { pdf, pages } = await renderPdf(project, opts);
    files.push({ name: opts.fileBase ? `${safeName(opts.fileBase, 140)}.pdf` : `${base}-miolo.pdf`, data: pdf });
    if (opts.includeCover && project.cover) files.push({ name: opts.fileBase ? `${safeName(opts.fileBase.replace('_MIOLO_', '_CAPA_'), 140)}.pdf` : `${base}-capa-cmyk.pdf`, data: (await cmyk.buildCoverPdf(APP_ROOT, project.cover, project.assets || {}, project.meta, CoverGeometry.geometry(project.cover), { bleed: true })).pdf });
    if (opts.includeEpub && req.epub) files.push({ name: `${base}.epub`, data: await exporters.exportEpub(Object.assign({ uuid: crypto.randomUUID() }, req.epub), project.assets || {}) });
    if (req.report) files.push({ name: 'relatorio-pre-impressao.txt', data: Buffer.from('﻿' + req.report, 'utf8') });
    if (req.specs) files.push({ name: 'especificacoes-tecnicas.txt', data: Buffer.from('﻿' + req.specs, 'utf8') });
    if (opts.includeProject) files.push({ name: `${base}.livro`, data: Buffer.from(JSON.stringify(normalizeProject(project))) });
    fs.writeFileSync(file, await exporters.makeZip(files));
    return { files: [file], pages };
  }
  if (kind === 'cover') {
    // capa para gráfica: sempre PDF CMYK (PDF/X-1a) com o perfil ICC escolhido
    const file = opts.target || await askSavePath('Exportar capa para gráfica (PDF CMYK)', opts.fileBase ? `${safeName(opts.fileBase, 140)}${opts.bleed === false ? '-sem-sangria' : ''}.pdf` : `${base}-capa-cmyk${opts.bleed === false ? '-sem-sangria' : ''}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
    if (!file) return null;
    const cover = project.cover || {};
    const r = await cmyk.buildCoverPdf(APP_ROOT, cover, project.assets || {}, project.meta, CoverGeometry.geometry(cover), { bleed: opts.bleed !== false });
    fs.writeFileSync(file, r.pdf);
    return { files: [file], report: r.report };
  }
  if (kind === 'coverFront') {
    return { dataUrl: 'data:image/jpeg;base64,' + (await renderCover(project, { format: 'jpeg', part: 'front', dpi: 150, bleed: false })).toString('base64') };
  }
  return null;
}

ipcMain.handle('export:run', async (e, req) => {
  try { return await runExport(req); } catch (err) {
    dialog.showErrorBox('Falha na exportação', String(err && err.stack || err));
    return null;
  }
});

// ---------------------------------------------------------------- capa
async function renderCover(project, opts) {
  opts = opts || {};
  const fmt = opts.format || 'pdf';
  const pdf = await renderCoverPdf(project, opts);
  if (fmt === 'pdf') return pdf;
  const dpi = Math.max(72, Math.min(600, Number(opts.dpi) || 300));
  const [{ img }] = await rasterizePdf(pdf, [1], dpi, '#ffffff');
  return encodeImage(img, fmt, dpi, opts.quality);
}

async function renderCoverPdf(project, opts) {
  return withRenderWindow(async win => {
    const c = project.cover || {};
    await win.webContents.executeJavaScript(`window.renderCover(${JSON.stringify({ cover: c, assets: project.assets })}, ${JSON.stringify({ bleed: opts.bleed !== false, guides: false, part: opts.part || 'all', print: true })})`, true);
    return win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
  }, { page: 'src/renderer/cover.html?print', width: 1600, height: 1200 });
}

// ---------------------------------------------------------------- utilidades de interface
ipcMain.handle('shell:showItem', (e, filePath) => { if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath); });
ipcMain.handle('shell:openPath', (e, filePath) => { if (filePath && fs.existsSync(filePath)) shell.openPath(filePath); });
ipcMain.handle('dialog:unsaved', async () => {
  const res = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Salvar', 'Não salvar', 'Cancelar'], defaultId: 0, cancelId: 2, title: 'Alterações não salvas', message: 'Deseja salvar as alterações do livro?', detail: 'Se não salvar, as alterações feitas desde o último salvamento serão perdidas.' });
  return ['save', 'discard', 'cancel'][res.response];
});
ipcMain.handle('dialog:confirm', async (e, { message, detail, buttons }) => {
  const b = buttons || ['OK', 'Cancelar'];
  const res = await dialog.showMessageBox(mainWindow, { type: 'question', buttons: b, defaultId: 0, cancelId: b.length - 1, message, detail: detail || '' });
  return res.response;
});
ipcMain.handle('dialog:saveText', async (e, { name, text }) => {
  const file = await askSavePath('Salvar', name, [{ name: 'Texto', extensions: ['txt'] }]);
  if (!file) return null;
  fs.writeFileSync(file, '﻿' + text, 'utf8');
  return file;
});
// Código de barras do ISBN (EAN-13) para download: EPS (preferido pelo Cedet), PDF ou SVG — vetorial, 100% K
ipcMain.handle('barcode:save', async (e, { isbn, opts, format }) => {
  const Isbn = require('./shared/isbn');
  const lay = Isbn.layout(isbn, opts || {});
  if (!lay.ok) return { error: lay.error };
  const ext = format === 'svg' ? 'svg' : format === 'pdf' ? 'pdf' : 'eps';
  const file = await askSavePath('Salvar código de barras', `ISBN_${lay.isbn13}_codigo-de-barras.${ext}`, [{ name: ext.toUpperCase(), extensions: [ext] }]);
  if (!file) return null;
  if (ext === 'svg') fs.writeFileSync(file, Isbn.toSvg(lay), 'utf8');
  else if (ext === 'eps') fs.writeFileSync(file, Isbn.toEps(lay), 'latin1');
  else {
    const { PDFDocument, PDFOperator, PDFNumber, pushGraphicsState, popGraphicsState } = require('pdf-lib');
    const doc = await PDFDocument.create();
    const k = 72 / 25.4;
    const pg = doc.addPage([lay.w * k, lay.h * k]);
    const ops = Isbn.pathOps(lay, 0, 0, lay.h, false);
    const lines = ['0 0 0 0 k', `0 0 ${lay.w * k} ${lay.h * k} re`, 'f', '0 0 0 1 k'].concat(ops.bars, ['f'], ops.glyphs, ['f']);
    pg.pushOperators(pushGraphicsState(), ...lines.map(l => { const p = l.trim().split(/\s+/); return PDFOperator.of(p.pop(), p.map(v => PDFNumber.of(Number(v)))); }), popGraphicsState());
    doc.setTitle('ISBN ' + lay.display);
    doc.setCreator('Diagramador de Livros');
    fs.writeFileSync(file, Buffer.from(await doc.save()));
  }
  return { file, isbn13: lay.isbn13 };
});
// Perfil ICC CMYK escolhido pelo usuário para a capa (ex.: U.S. Web Coated (SWOP) v2 pedido pelo Cedet)
ipcMain.handle('cover:pickIcc', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Escolha o perfil ICC CMYK (ex.: USWebCoatedSWOP.icc)', filters: [{ name: 'Perfil ICC', extensions: ['icc', 'icm'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return null;
  const buf = fs.readFileSync(res.filePaths[0]);
  const info = cmyk.iccInfo(buf);
  if (!info) return { error: 'O arquivo não é um perfil ICC válido.' };
  if (info.colorSpace !== 'CMYK') return { error: `O perfil é ${info.colorSpace}; a capa precisa de um perfil de saída CMYK.` };
  return { name: path.basename(res.filePaths[0]), desc: info.desc || path.basename(res.filePaths[0]), data: buf.toString('base64') };
});
ipcMain.handle('app:pendingOpen', () => { const p = pendingOpenPath; pendingOpenPath = null; return p; });
ipcMain.handle('app:info', () => ({ version: app.getVersion(), userData: app.getPath('userData'), portable: !!process.env.PORTABLE_EXECUTABLE_DIR }));
ipcMain.on('app:closeConfirmed', () => { allowClose = true; if (mainWindow) mainWindow.close(); });
ipcMain.on('app:setTitle', (e, title) => { if (mainWindow) mainWindow.setTitle(title); });

// ---------------------------------------------------------------- teste automatizado (npm test)
function smokeProject() {
  const project = normalizeProject(null);
  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Classe aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.';
  project.front.epigraph = true;
  project.meta.epigraph = 'Escrever é esquecer.';
  project.meta.epigraphAuthor = 'Fernando Pessoa';
  project.catalog.subjects = 'Ficção brasileira; Romance';
  project.catalog.cdd = 'B869.3';
  project.catalog.qrcodes = [{ text: 'https://exemplo.com.br', caption: 'Site do autor', size: 18 }];
  const png = fs.readFileSync(path.join(APP_ROOT, 'assets', 'library', 'corpo', 'rosa.png'));
  const sep = fs.readFileSync(path.join(APP_ROOT, 'assets', 'library', 'separadores', 'floral.png'));
  project.assets.rosa = { id: 'rosa', name: 'rosa', dataUrl: 'data:image/png;base64,' + png.toString('base64'), width: 1200, height: 1200 };
  project.assets.sep = { id: 'sep', name: 'sep', dataUrl: 'data:image/png;base64,' + sep.toString('base64'), width: 2400, height: 400 };
  project.settings.separator = 'image';
  project.settings.separatorAsset = 'sep';
  project.chapters.push({ id: 'prefacio', title: 'Uma pausa', numbered: false, html: '<p>' + lorem + '</p><div class="poem"><p>Verso um<br>verso dois</p><p>Outra estrofe<br>final</p></div>', style: { pageColor: '#f3ead8' } });
  for (let i = 2; i <= 4; i++) {
    project.chapters.push({
      id: 'cap' + i, title: 'Capítulo de teste ' + i, numbered: true,
      html: Array.from({ length: 12 }, (_, k) => (k === 3 ? '<figure class="img" data-asset="rosa" data-align="right" data-wrap="square" data-width="35"><img data-asset="rosa"><figcaption>Uma rosa</figcaption></figure>' : '') + (k === 6 ? '<h2>Uma seção</h2>' : '') + '<p>' + lorem + (k % 4 === 1 ? '<span class="footnote">Nota de teste número ' + k + '.</span>' : '') + '</p>').join('') +
        '<table><tbody><tr><th>Ano</th><th>Valor</th></tr><tr><td>2024</td><td>10</td></tr></tbody></table>'
    });
  }
  project.back.bio.enabled = true;
  project.back.bio.html = '<p>Nome do Autor nasceu em algum lugar e escreve livros.</p>';
  return project;
}

async function runSmokeTest() {
  const out = process.env.SMOKE_OUT || path.join(app.getPath('temp'), 'diagramador-teste.pdf');
  const project = smokeProject();
  const { pdf, pages, info } = await renderPdf(project, {});
  fs.writeFileSync(out, pdf);
  if (process.env.SMOKE_DEBUG) console.log(JSON.stringify(info.pageInfo));
  if (process.env.SMOKE_EXTRA) {
    const dir = path.dirname(out);
    for (const kind of ['png', 'tiff']) {
      const r = await runExport({ kind, project, opts: { target: dir, range: '1,9', dpi: 150 } });
      console.log('EXPORT', kind, r.files.map(f => path.basename(f)).join(','));
    }
    const insp = await withRenderWindow(async win => { await renderBookIn(win, project, {}); return win.webContents.executeJavaScript('window.inspectBook({})', true); });
    console.log('INSPECT', JSON.stringify(insp.issues.slice(0, 8)), 'images', JSON.stringify(insp.images.slice(0, 2)));
  }
  // verificações de saída para gráfica: caixas exatas, cor do miolo e capa CMYK (PDF/X-1a)
  const { PDFDocument, PDFName } = require('pdf-lib');
  const assert = (cond, msg) => { if (!cond) throw new Error('verificação falhou: ' + msg); };
  const d1 = await PDFDocument.load(pdf);
  const s = normalizeProject(project).settings;
  const ptmm = 72 / 25.4;
  const bl = effectiveBleed(s);
  const mb = d1.getPage(0).getMediaBox();
  const tb = d1.getPage(0).getTrimBox();
  const sheet = outputSheetSize(s, bl);
  const expW = sheet && sheet.fits ? sheet.w : s.pageWidth + 2 * bl;
  assert(Math.abs(mb.width - expW * ptmm) < 0.05 && Math.abs(tb.width - s.pageWidth * ptmm) < 0.05 && Math.abs(tb.height - s.pageHeight * ptmm) < 0.05, `caixas ${JSON.stringify([mb, tb])}`);
  // sumário e mapa de capítulos: cada capítulo precisa ter a página encontrada (Paged.js troca id por data-id ao dividir)
  const cp = info.chapterPages || {};
  assert(project.chapters.every(c => cp[c.id] > 0), 'páginas dos capítulos ' + JSON.stringify(cp));
  const cm = await finishPrintPdf(pdf, project, { color: 'cmyk' });
  assert(cm.colorReport && cm.colorReport.mode === 'cmyk' && cm.colorReport.colors > 0 && !cm.colorReport.error, 'conversão CMYK do miolo ' + JSON.stringify(cm.colorReport));
  const d2 = await PDFDocument.load(cm.pdf);
  assert(d2.catalog.get(PDFName.of('OutputIntents')), 'OutputIntent do miolo');
  const cover = { trimW: s.pageWidth, trimH: s.pageHeight, pages, paper: 'polen80', bleedAuto: true, images: { front: { asset: 'rosa', fit: 'cover' } }, bg: { back: '#203040' }, profile: 'fogra39' };
  const cv = await cmyk.buildCoverPdf(APP_ROOT, cover, project.assets, project.meta, CoverGeometry.geometry(cover), { bleed: true, dpi: 100 });
  assert(cv.pdf.slice(0, 8).toString('latin1') === '%PDF-1.3' && /DeviceCMYK/.test(cv.pdf.toString('latin1')) && /GTS_PDFX/.test(cv.pdf.toString('latin1')), 'capa PDF/X-1a CMYK');
  // modelo CEDET: miolo só preto, sGray sem perfil; capa com marcas de corte/dobra e código de barras vetorial
  const gr = await finishPrintPdf(pdf, project, { color: 'gray', noProfile: true });
  const d3 = await PDFDocument.load(gr.pdf);
  assert(gr.colorReport.onlyBlack && !d3.catalog.get(PDFName.of('OutputIntents')), 'miolo CEDET só preto ' + JSON.stringify(gr.colorReport));
  const cc = Object.assign({}, cover, { cedet: true, flaps: 0, marks: { enabled: true }, spineMode: 'manual', spine: 12, isbnBarcode: { enabled: true, isbn: '978-85-333-0227-3', pos: 'br', dx: 12, dy: 12 } });
  const gc = CoverGeometry.geometry(cc);
  const cv2 = await cmyk.buildCoverPdf(APP_ROOT, cc, project.assets, project.meta, gc, { bleed: true, dpi: 100 });
  if (process.env.SMOKE_SAVE) { fs.writeFileSync(out.replace(/\.pdf$/, '-cedet-miolo.pdf'), gr.pdf); fs.writeFileSync(out.replace(/\.pdf$/, '-cedet-capa.pdf'), cv2.pdf); }
  const d4 = await PDFDocument.load(cv2.pdf);
  const cmb = d4.getPage(0).getMediaBox(), ctb = d4.getPage(0).getTrimBox();
  assert(gc.bleed === 5 && gc.W === s.pageWidth && !gc.flap && cv2.report.barcode === '9788533302273' && cv2.report.marks && Math.abs(ctb.width - gc.trimTotalW * ptmm) < 0.05 && cmb.width > (gc.totalW + 9) * ptmm, 'capa CEDET ' + JSON.stringify([cmb, ctb, cv2.report]));
  console.log(`SMOKE_CHECKS caixas=ok miolo_cmyk=${cm.colorReport.colors}cores miolo_cedet=só_preto capa=${cv.report.widthPx}x${cv.report.heightPx}px capa_cedet=${Math.round(cmb.width / ptmm)}x${Math.round(cmb.height / ptmm)}mm`);
  console.log(`SMOKE_OK pages=${pages} bytes=${pdf.length} out=${out}`);
}

// ---------------------------------------------------------------- ciclo de vida
const fileArg = process.argv.slice(1).find(a => a.toLowerCase().endsWith('.' + PROJECT_EXT));
if (fileArg && fs.existsSync(fileArg)) pendingOpenPath = path.resolve(fileArg);

if (!process.env.SMOKE_TEST && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = argv.find(a => a.toLowerCase().endsWith('.' + PROJECT_EXT));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (f && fs.existsSync(f)) mainWindow.webContents.send('menu', 'openPath:' + path.resolve(f));
    }
  });
  app.on('web-contents-created', (e, contents) => hardenContents(contents));
  app.whenReady().then(async () => {
    fonts = new FontManager(app.getPath('userData'));
    library = new ImageLibrary(APP_ROOT, app.getPath('userData'));
    registerAppProtocol();
    blockNetwork(session.defaultSession);
    if (process.env.SMOKE_TEST) {
      try { await runSmokeTest(); app.exit(0); } catch (err) { console.error('SMOKE_FAIL', err); app.exit(1); }
      return;
    }
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => { if (!process.env.SMOKE_TEST) app.quit(); });
}
