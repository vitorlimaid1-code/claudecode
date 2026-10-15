// Processo principal do Casa Vertigem Hub (antigo Diagramador de Livros).
// Tudo roda localmente: nenhuma requisição de rede é permitida.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell, utilityProcess } = require('electron');
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
const LayoutPasses = require('./shared/passes');
const manuscript = require('./main/manuscript');
const pdfcolor = require('./main/pdfcolor');

const APP_ROOT = path.join(__dirname, '..');
const PROJECT_EXT = 'livro';

// Versão portátil: guarda configurações e bibliotecas ao lado do executável
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  // a pasta de dados da versão anterior (DiagramadorDeLivros-dados) continua sendo usada se já existir
  const oldDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'DiagramadorDeLivros-dados');
  app.setPath('userData', fs.existsSync(oldDir) ? oldDir : path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'CasaVertigemHub-dados'));
} else if (fs.existsSync(path.join(path.dirname(process.execPath), 'portable.txt'))) {
  app.setPath('userData', path.join(path.dirname(process.execPath), 'dados'));
} else {
  // instalação normal: configurações e bibliotecas do antigo “Diagramador de Livros” passam para o novo nome
  try {
    const appData = app.getPath('appData');
    const oldDir = path.join(appData, 'Diagramador de Livros');
    const newDir = path.join(appData, 'Casa Vertigem Hub');
    if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) fs.cpSync(oldDir, newDir, { recursive: true });
  } catch (e) { /* segue com a pasta nova */ }
}

// Sem tráfego de rede do próprio Chromium (atualizações de componentes etc.)
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-domain-reliability');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.ttc': 'font/collection', '.wasm': 'application/wasm'
};
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };

let mainWindow = null;
let allowClose = false;
let pendingOpenPath = null;
let fonts = null;
let library = null;
let remoteAssets = null;

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
    } else if (url.host === 'models') {
      // modelos do tradutor offline, baixados para a pasta de dados
      const base = path.join(app.getPath('userData'), 'modelos');
      filePath = path.normalize(path.join(base, rel));
      if (!filePath.startsWith(base + path.sep)) filePath = null;
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
      const headers = { 'content-type': type, 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' };
      // janela do tradutor offline isolada: libera vários núcleos para o WebAssembly (SharedArrayBuffer)
      if (url.host === 'local' && /^src\/mt\//.test(rel)) Object.assign(headers, { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' });
      return new Response(data, { headers });
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
    title: 'Casa Vertigem Hub', backgroundColor: '#f7f7f5',
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
  // as janelas ocultas de paginação fecham junto com a janela principal
  mainWindow.on('closed', () => { mainWindow = null; if (layoutPool) { layoutPool.destroy(); layoutPool = null; } });
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
            type: 'info', title: 'Sobre', message: `Casa Vertigem Hub ${app.getVersion()}`,
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
  if (!data || data.format !== 'diagramador-de-livros') throw new Error('Este arquivo não é um projeto de livro do Casa Vertigem Hub.');
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
  require('./shared/defaults').applyFormatOverrides(readJson(userFile('formatos.json'), {}));
  const p = newProject(readJson(userFile('meu-padrao.json'), null));
  const ficha = readJson(userFile('ficha-fixa.json'), null);
  if (ficha) { p.catalog = Object.assign(p.catalog, ficha.catalog || {}); if (ficha.meta) Object.assign(p.meta, ficha.meta); if (ficha.titlePage) Object.assign(p.titlePage, ficha.titlePage); if (ficha.assets) Object.assign(p.assets, ficha.assets); }
  return p;
});

// Medidas editadas pelo usuário nos modelos de formato ({ id: { width, height } })
ipcMain.handle('formats:get', () => readJson(userFile('formatos.json'), {}));
ipcMain.handle('formats:set', (e, data) => { writeJson(userFile('formatos.json'), data || {}); return true; });

// Central “Restaurar padrões do sistema”: o que o usuário personalizou e como voltar ao original
const CUSTOM_FILES = {
  meuPadrao: 'meu-padrao.json', fichaFixa: 'ficha-fixa.json', modelosFicha: 'modelos-ficha.json',
  conjuntos: 'conjuntos-tipograficos.json', perfis: 'perfis.json', formatos: 'formatos.json'
};
ipcMain.handle('system:customizations', () => {
  const out = {};
  Object.entries(CUSTOM_FILES).forEach(([k, f]) => {
    const v = readJson(userFile(f), null);
    out[k] = v == null ? 0 : Array.isArray(v) ? v.length : typeof v === 'object' ? Math.max(1, Object.keys(v).length) : 1;
  });
  const lib = library.list();
  out.imagens = lib.items.filter(i => i.source === 'user').length;
  out.marcacoes = lib.items.filter(i => i.favorite || (i.collections || []).length).length + (lib.collections || []).length;
  out.fontes = (fonts.library() || []).length;
  return out;
});
ipcMain.handle('system:reset', (e, keys) => {
  const done = [];
  (keys || []).forEach(k => {
    if (CUSTOM_FILES[k]) { try { fs.unlinkSync(userFile(CUSTOM_FILES[k])); } catch (err) { /* já no padrão */ } done.push(k); }
    else if (k === 'imagens') { library.list().items.filter(i => i.source === 'user').forEach(i => library.remove(i.key)); done.push(k); }
    else if (k === 'marcacoes') { const m = library.readMeta(); Object.values(m.items || {}).forEach(it => { delete it.favorite; delete it.collections; }); m.collections = []; library.writeMeta(m); done.push(k); }
    else if (k === 'fontes') { (fonts.library() || []).forEach(f => fonts.removeFamily(f.family)); done.push(k); }
  });
  return done;
});

// Ficha catalográfica fixa (aplicada a todo livro novo) e modelos salvos pelo usuário
ipcMain.handle('catalog:fixedGet', () => readJson(userFile('ficha-fixa.json'), null));
ipcMain.handle('catalog:fixedSet', (e, data) => { if (data) writeJson(userFile('ficha-fixa.json'), data); else { try { fs.unlinkSync(userFile('ficha-fixa.json')); } catch (err) { /* ok */ } } return true; });
ipcMain.handle('catalog:templatesGet', () => readJson(userFile('modelos-ficha.json'), []));
ipcMain.handle('catalog:templatesSet', (e, list) => { writeJson(userFile('modelos-ficha.json'), list || []); return true; });
// editoras e logotipos salvos (valem para todos os livros)
ipcMain.handle('publishers:get', () => readJson(userFile('editoras.json'), { publishers: [], logos: [] }));
ipcMain.handle('publishers:set', (e, data) => { writeJson(userFile('editoras.json'), data || { publishers: [], logos: [] }); return true; });

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
// registro de progresso mostrado na interface (carregamento e exportação)
function progress(msg) { try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('progress', String(msg)); } catch (e) { /* ok */ } }
const kb = n => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

async function importPath(filePath) {
  try {
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch (e) { /* ok */ }
    progress(`Abrindo “${path.basename(filePath)}” (${kb(size)})`);
    progress('Lendo o conteúdo do arquivo…');
    const t0 = Date.now();
    const res = await importAny(filePath);
    if (res) {
      const parts = [];
      if (res.html) parts.push(`${kb(res.html.length)} de texto formatado`);
      if (res.text) parts.push(`${kb(res.text.length)} de texto`);
      if (res.docs) parts.push(`${res.docs.length} arquivo(s) internos`);
      if (res.pages) parts.push(`${res.pages.length} página(s) de PDF`);
      if (res.footnotes && res.footnotes.length) parts.push(`${res.footnotes.length} nota(s)`);
      progress(`Arquivo lido em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s${parts.length ? ' — ' + parts.join(', ') : ''}`);
    }
    return res;
  } catch (err) {
    dialog.showErrorBox('Não foi possível importar', `${path.basename(filePath)}\n\n${String(err.message || err)}`);
    return null;
  }
}
ipcMain.handle('import:file', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Importar manuscrito', filters: IMPORT_FILTERS, properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return null;
  return require('./shared/defaults').nfcDeep(await importPath(res.filePaths[0]));
});
ipcMain.handle('import:path', async (e, filePath) => require('./shared/defaults').nfcDeep(await importPath(filePath)));

// Melhoramento: EPUBs do Project Gutenberg -> DOCX no padrão do livro, na pasta Downloads
ipcMain.handle('enh:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Livros EPUB (Project Gutenberg)', filters: [{ name: 'EPUB', extensions: ['epub'] }], properties: ['openFile', 'multiSelections'] });
  return res.canceled ? [] : res.filePaths;
});
ipcMain.handle('enh:read', async (e, filePath) => {
  try { return Object.assign(require('./shared/defaults').nfcDeep(await importAny(filePath)), { name: path.basename(filePath, path.extname(filePath)), size: fs.statSync(filePath).size }); } catch (err) { return { error: String(err && err.message || err) }; }
});
ipcMain.handle('enh:target', (e, base, ext, nextTo) => {
  // nextTo: arquivo de origem — o DOCX fica na mesma pasta dele (para substituir o EPUB)
  const dir = nextTo && fs.existsSync(nextTo) ? path.dirname(nextTo) : app.getPath('downloads');
  fs.mkdirSync(dir, { recursive: true });
  const b = safeName(base || 'livro', 120);
  let f = path.join(dir, `${b}.${ext || 'docx'}`);
  for (let i = 2; fs.existsSync(f); i++) f = path.join(dir, `${b} (${i}).${ext || 'docx'}`);
  return f;
});
ipcMain.handle('enh:downloads', () => app.getPath('downloads'));
// substitui o EPUB de origem pelo DOCX já gravado ao lado dele: o EPUB vai para a Lixeira (recuperável),
// e só depois de conferir que o DOCX existe, não está vazio e ficou na mesma pasta
ipcMain.handle('enh:replace', async (e, src, docx) => {
  try {
    if (!src || !/\.epub$/i.test(src) || !fs.existsSync(src)) return { ok: false, msg: 'arquivo de origem não encontrado' };
    if (!docx || !/\.docx$/i.test(docx) || !fs.existsSync(docx) || fs.statSync(docx).size < 1000) return { ok: false, msg: 'o DOCX não foi conferido; o EPUB foi mantido' };
    if (path.resolve(path.dirname(src)) !== path.resolve(path.dirname(docx))) return { ok: false, msg: 'o DOCX não está na pasta do EPUB; o EPUB foi mantido' };
    await shell.trashItem(src);
    return { ok: true };
  } catch (err) { return { ok: false, msg: 'não foi possível mandar o EPUB para a Lixeira (' + String(err.message || err) + '); ele foi mantido' }; }
});

// ---------------------------------------------------------------- tradução (tela própria)
let translatorApi = null;
const tr = () => translatorApi || (translatorApi = require('./main/translator').createTranslator({
  userFile, safeStorage: require('electron').safeStorage,
  offline: require('./main/offline-mt').createOfflineMT({ modelsDir: userFile('modelos'), workerUrl: appUrl('src/mt/worker.html'), preload: path.join(__dirname, 'mt', 'preload.js') }),
  tm: require('./main/tmstore').createTmStore(userFile('tradutor'))
}));
ipcMain.handle('tr:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Livros para traduzir', filters: [{ name: 'Livros', extensions: ['epub', 'docx', 'doc', 'odt', 'rtf', 'txt', 'html', 'htm'] }], properties: ['openFile', 'multiSelections'] });
  return res.canceled ? [] : res.filePaths;
});
ipcMain.handle('tr:config', () => tr().config());
ipcMain.handle('tr:setConfig', (e, patch) => tr().setConfig(patch || {}));
ipcMain.handle('tr:test', () => tr().test());
ipcMain.handle('tr:chunk', async (e, req) => {
  try { return await tr().translate(req, chars => { try { e.sender.send('tr:progress', { id: req.id, chars }); } catch (err) { /* janela fechada */ } }); } catch (err) {
    return { error: String(err && err.message || err), fatal: !!(err && err.fatal), retry: !!(err && err.retry), refusal: !!(err && err.refusal), tooLong: !!(err && err.tooLong) };
  }
});
// tradutor offline (modelo no computador) e livros de referência (memória de tradução)
ipcMain.handle('mt:status', () => tr().offline.status());
ipcMain.handle('mt:select', (e, key) => tr().offline.select(key));
ipcMain.handle('mt:install', async (e, key) => tr().offline.install(key, p => { try { e.sender.send('mt:progress', p); } catch (err) { /* janela fechada */ } }));
ipcMain.handle('mt:remove', (e, key) => tr().offline.remove(key));
ipcMain.handle('tm:list', () => tr().tm.list());
ipcMain.handle('tm:add', (e, req) => { try { return tr().tm.add(req || {}); } catch (err) { return { error: String(err && err.message || err) }; } });
ipcMain.handle('tm:remove', (e, id) => tr().tm.remove(id));
ipcMain.handle('tm:options', (e, patch) => tr().tm.setOptions(patch || {}));
ipcMain.handle('tr:report', async (e, req) => { try { return await tr().report(req); } catch (err) { return { error: String(err && err.message || err) }; } });
// relatório da tradução em PDF (a interface monta o HTML; aqui vira PDF A4 e vai para onde o usuário escolher)
ipcMain.handle('tr:savePdf', async (e, html, baseName, target) => {
  const res = target ? { filePath: target } : await dialog.showSaveDialog(mainWindow, { title: 'Salvar relatório da tradução', defaultPath: path.join(app.getPath('downloads'), safeName(baseName || 'Relatório da tradução', 120) + '.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (res.canceled || !res.filePath) return null;
  const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } });
    fs.writeFileSync(res.filePath, pdf);
    return res.filePath;
  } finally { win.destroy(); }
});

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
// imagens de um conteúdo colado do Word/Excel/LibreOffice: vêm como arquivos temporários (file:///…/clip_image001.png)
ipcMain.handle('image:fromFileUrls', (e, urls) => (urls || []).map(u => {
  try {
    const p = require('url').fileURLToPath(String(u));
    if (!IMAGE_MIME[path.extname(p).toLowerCase()] || !fs.existsSync(p)) return null;
    return fileToAsset(p);
  } catch (err) { return null; }
}));
ipcMain.handle('image:analyze', (e, dataUrl) => {
  const bin = exporters.dataUrlToBuffer(dataUrl);
  if (!bin) return null;
  const info = analyzeImage(bin.buf);
  info.hash = hashBuffer(bin.buf);
  return info;
});

// Bibliotecas de imagens
ipcMain.handle('lib:list', () => {
  // filetes da Casa Vertigem que faltarem: baixados em segundo plano (aparecem na próxima abertura da lista)
  if (remoteAssets) remoteAssets.ensureRules(library).catch(() => {});
  return library.list();
});
ipcMain.handle('seal:logo', (e, id) => (remoteAssets ? remoteAssets.sealLogo(String(id || '')) : { error: 'indisponível' }));
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
// rodízio dos créditos da ficha (revisão em ordem, tradução sorteada): muda a cada exportação; a prévia
// mostra os nomes da exportação atual
const creditsFile = () => userFile('creditos-rodizio.json');
const creditsNow = () => require('./shared/ficha').names(readJson(creditsFile(), { n: 0, t: 0 }));
function creditsNext() {
  const F = require('./shared/ficha');
  const st = readJson(creditsFile(), { n: -1, t: 0 });
  let t = Math.floor(Math.random() * F.TRANSLATORS.length);
  if (F.TRANSLATORS.length > 1 && t === st.t) t = (t + 1 + Math.floor(Math.random() * (F.TRANSLATORS.length - 1))) % F.TRANSLATORS.length;
  const next = { n: (Number(st.n) || 0) + 1, t };
  try { fs.mkdirSync(path.dirname(creditsFile()), { recursive: true }); fs.writeFileSync(creditsFile(), JSON.stringify(next)); } catch (e) { /* ok */ }
  return F.names(next);
}
ipcMain.handle('credits:next', () => creditsNext());

// atualização pelo GitHub (tela Configurações)
let updater = null;
const upd = () => updater || (updater = require('./main/updater').createUpdater({ app, shell, send: p => { try { mainWindow && mainWindow.webContents.send('update:progress', p); } catch (e) { /* ok */ } } }));
ipcMain.handle('update:check', () => upd().check());
ipcMain.handle('update:install', () => upd().install());
ipcMain.handle('credits:now', () => creditsNow());

async function bookPayload(project, opts) {
  if (!(project.catalog && project.catalog.autoNames)) opts = Object.assign({}, opts || {}, { autoNames: creditsNow() });
  const book = await buildBook(project, opts);
  if (!fonts.system) fonts.scanSystem();
  const extra = book.fonts.filter(f => !book.bundledFonts.includes(f));
  const ff = fonts.fontFaceCss(extra);
  book.fontFaceCss = ff.css;
  book.missingFonts = ff.missing;
  book.fontReport = ff.report;
  return book;
}
ipcMain.handle('book:build', async (e, project) => bookPayload(project));

// Paginação da prévia por capítulo, em janelas ocultas paralelas (a interface não trava)
let layoutPool = null;
const pool = () => layoutPool || (layoutPool = require('./main/layout-pool').createPool(appUrl('src/renderer/preview.html')));
// O livro é montado aqui (não na interface) e só a lista de trechos com o resumo (hash) de cada um
// vai para a prévia; o HTML de cada trecho segue direto daqui para a janela que pagina.
const builds = new Map();
let buildSeq = 0;
// cache em disco das páginas já paginadas (muda de “versão” quando o código da paginação muda)
let layoutCacheObj = null;
function layoutCache() {
  if (layoutCacheObj) return layoutCacheObj;
  const files = ['src/renderer/preview.js', 'src/renderer/vendor/paged.js', 'src/shared/passes.js', 'src/main/layout-pool.js'];
  const sig = files.map(f => { try { const st = fs.statSync(path.join(APP_ROOT, f)); return st.size + ':' + Math.round(st.mtimeMs); } catch (e) { return '-'; } }).join('|');
  layoutCacheObj = require('./main/layout-cache').createLayoutCache(userFile('layout-cache'), app.getVersion() + '|' + sig, 400);
  return layoutCacheObj;
}
// paginação de um trecho: do cache, se já foi paginado igual; senão nas janelas de trabalho (e guarda)
async function layoutCached(book, options, jobKey, priority, assets) {
  const c = layoutCache();
  const k = c.key(book, book.html, options);
  const hit = await c.get(k, assets || {});
  if (hit) return hit;
  const res = await pool().layout(book, options, jobKey, priority);
  if (res && !res.error && !res.superseded) c.put(k, res, assets || {});
  return res;
}
// imagens do projeto guardadas aqui: a interface não precisa mandar todas de novo a cada atualização
const assetStore = new Map();
const assetSig = a => (a && a.dataUrl ? a.dataUrl.length + ':' + a.dataUrl.slice(-48) : '');
function hashText(str) { let h = 5381, g = 52711; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h = ((h << 5) + h + c) | 0; g = ((g << 5) + g ^ c) | 0; } return (h >>> 0).toString(36) + (g >>> 0).toString(36) + ':' + str.length; }
ipcMain.handle('assets:put', (e, list) => { (list || []).forEach(a => { if (a && a.id && a.dataUrl) assetStore.set(a.id, { sig: a.sig || assetSig(a), dataUrl: a.dataUrl }); }); return true; });
ipcMain.handle('layout:prepare', async (e, project) => {
  // imagens enviadas só com a assinatura: completa com as guardadas (ou pede as que faltam)
  const need = [];
  if (project && project.assets) {
    const assets = {};
    for (const [id, a] of Object.entries(project.assets)) {
      if (a && !a.dataUrl && a.sig) { const st = assetStore.get(id); if (st && st.sig === a.sig) assets[id] = Object.assign({}, a, { dataUrl: st.dataUrl }); else need.push(id); }
      else assets[id] = a;
    }
    if (need.length) return { need };
    project = Object.assign({}, project, { assets });
  }
  const book = await bookPayload(project, { markBlocks: true });
  const id = ++buildSeq;
  const segments = book.segments || [{ key: 'all', html: book.html }];
  const meta = Object.assign({}, book, { html: '', segments: undefined, overlays: [] });
  builds.set(id, { meta, assets: project.assets || {}, segments: new Map(segments.map(s => [s.key, s.html])) });
  for (const k of builds.keys()) if (k < id - 3) builds.delete(k);
  return { id, meta, segments: segments.map(s => ({ key: s.key, hash: hashText(s.html) })) };
});
ipcMain.handle('layout:segment', async (e, buildId, key, options, priority, jobKey) => {
  const b = builds.get(buildId);
  if (!b || !b.segments.has(key)) return { superseded: true };
  const book = Object.assign({}, b.meta, { html: b.segments.get(key) });
  try { return await layoutCached(book, options, jobKey || key, priority, b.assets); } catch (err) { return { error: String(err && err.message || err) }; }
});
ipcMain.handle('layout:cancel', async (e, keys) => { if (layoutPool) layoutPool.cancel(keys); return true; });
ipcMain.handle('layout:workers', async () => pool().size);

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

// Exportação rápida: cada trecho (capítulo) é paginado em paralelo nas janelas de paginação — com as
// mesmas tentativas para notas e o ajuste de última página — e o livro é montado na janela de exportação.
async function renderBookSegmented(win, project, options) {
  if (process.env.EXPORT_FULL === '1') return null;
  // mesma montagem da prévia: os capítulos já paginados na prévia vêm do cache, sem paginar de novo
  const book = await bookPayload(project, { markBlocks: true });
  const segs = book.segments || [];
  if (segs.length < 2) return null;
  const adjustAll = LayoutPasses.savedAdjust(normalizeProject(project));
  const meta = Object.assign({}, book, { html: '', segments: undefined, overlays: [] });
  const tag = 'export' + (++buildSeq) + ':';
  const t0 = Date.now();
  progress(`Paginando ${segs.length} partes do livro em paralelo (${pool().size} processos)…`);
  let doneN = 0;
  const label = k => (k === 'front' ? 'páginas iniciais' : k === 'back' ? 'páginas finais' : k === 'all' ? 'publicação' : 'capítulo ' + (book.chapterIds.indexOf(k.slice(3)) + 1));
  const results = await Promise.all(segs.map(s => {
    const chId = s.key.startsWith('ch:') ? s.key.slice(3) : null;
    const adjust = chId && adjustAll[chId] ? { [chId]: adjustAll[chId] } : {};
    return layoutCached(Object.assign({}, meta, { html: s.html }), { adjust }, tag + s.key, 5000, project.assets || {}).catch(err => ({ error: String(err) }))
      .then(r => { doneN++; progress(`  ${doneN}/${segs.length} · ${label(s.key)}: ${r && r.pages ? r.pages + ' página(s)' : 'erro'}`); return r; });
  }));
  progress('Juntando as páginas, números de página, sumário e índice…');
  if (results.some(r => !r || r.error || r.superseded || !r.pagesHtml)) { console.error('exportação por trechos falhou; paginando o livro inteiro'); return null; }
  // um trecho incompleto: o livro inteiro é paginado de uma vez (com as tentativas da exportação)
  if (results.some(r => !r.complete)) { console.error('trecho incompleto (' + segs.filter((s, i) => !results[i].complete).map(s => s.key).join(', ') + '); paginando o livro inteiro'); return null; }
  const add = {};
  segs.forEach((s, i) => { add[s.key] = { pagesHtml: results[i].pagesHtml, css: results[i].css }; });
  const stageBook = Object.assign({}, book, { html: '', segments: undefined });
  const fin = await win.webContents.executeJavaScript(`window.stageExport(${JSON.stringify(segs.map(s => s.key))}, ${JSON.stringify(add)}, ${JSON.stringify(stageBook)}, ${JSON.stringify(options || {})})`, true);
  // espera fontes e imagens antes de imprimir
  await win.webContents.executeJavaScript('Promise.all([document.fonts.ready, ...Array.from(document.images).filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))]).then(() => true)', true);
  const sum = f => results.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const info = Object.assign({}, fin, {
    complete: results.every(r => r.complete),
    clippedNotes: [], lostNotes: [],
    revealedNotes: [].concat(...results.map(r => r.revealedNotes || [])),
    shortEnds: [].concat(...results.map(r => r.shortEnds || [])),
    sourceWords: sum('sourceWords'), pageWords: sum('pageWords'),
    ms: Date.now() - t0, segmented: true
  });
  if (process.env.DEBUG_TIMING) console.log('TIMING paginação por trechos', info.ms, 'ms', segs.length, 'trechos');
  return { book, info };
}

async function renderBookIn(win, project, options) {
  const seg = await renderBookSegmented(win, project, options).catch(err => { console.error('exportação por trechos:', err); return null; });
  if (seg) return seg;
  if (seg === null) await win.loadURL(win.webContents.getURL());
  progress('Paginando o livro inteiro de uma vez…');
  const book = await bookPayload(project);
  options = options || {};
  const url = win.webContents.getURL();
  const run = o => win.webContents.executeJavaScript(`window.renderBook(${JSON.stringify(book)}, ${JSON.stringify(o)})`, true);
  const dbg = (label, i) => { if (process.env.DEBUG_LAYOUT) console.log('PASS', label, JSON.stringify({ pages: i.pages, complete: i.complete, words: [i.sourceWords, i.pageWords], clipped: i.clippedNotes, lost: i.lostNotes, keep: i.keepNotes })); };
  // Notas de rodapé: a nota fica inteira na página da chamada (o texto desce). O Paged.js às vezes
  // falha com notas grandes; então tenta regras alternativas e fica com a primeira paginação completa
  // (todas as palavras visíveis) e sem notas cortadas/divididas — nunca com uma que perca texto.
  const better = (a, b) => !b || (a.complete && !b.complete) || (a.complete === b.complete && (a.clippedNotes.length < b.clippedNotes.length || (!a.complete && a.clippedNotes.length === b.clippedNotes.length && a.pageWords > b.pageWords + 2)));
  let info = null, best = null, bestOpts = null, lastOpts = null;
  // ajustes de última página calculados na prévia (mesmo capítulo, mesma diagramação)
  const adjust = LayoutPasses.savedAdjust(normalizeProject(project));
  const attempts = [{ notePolicy: 'line', adjust }, { notePolicy: 'block', adjust }, { notePolicy: '', adjust }];
  for (let k = 0; k < attempts.length; k++) {
    const o = Object.assign({}, options, attempts[k]);
    if (best && best.clippedNotes.length && attempts[k].notePolicy === '') o.lineNotes = best.clippedNotes;
    if (k) await win.loadURL(url);
    info = await run(o);
    lastOpts = o;
    dbg(String(k + 1) + (attempts[k].notePolicy || 'auto'), info);
    if (better(info, best)) { best = info; bestOpts = o; }
    if (info.complete && !info.clippedNotes.length) break;
  }
  // parágrafo com nota perdido pelo Paged.js (ficou na coluna de excesso): pagina de novo com esse
  // parágrafo sem divisão — ele passa inteiro para a página seguinte e nada se perde
  for (let k = 0; k < 3 && !best.complete && (best.lostNotes || []).length; k++) {
    const o = Object.assign({}, bestOpts, { keepNotes: best.lostNotes });
    await win.loadURL(url);
    info = await run(o);
    lastOpts = o;
    dbg('nota-inteira', info);
    if (better(info, best)) { best = info; bestOpts = o; } else break;
  }
  if (lastOpts !== bestOpts || best.clippedNotes.length) {
    // volta à melhor paginação; o que ainda restar fica inteiro e visível (nada do texto some)
    await win.loadURL(url);
    info = await run(Object.assign({}, bestOpts, { showClippedNotes: true }));
    if (info.clippedNotes.length) info.revealedNotes = info.clippedNotes;
  }
  // capítulo terminando com poucas linhas sozinhas na última página: ajuste leve e nova paginação
  if ((info.shortEnds || []).length && !info.revealedNotes) {
    const r = await LayoutPasses.lastPageAdjust(info, Object.assign({}, bestOpts), async o => { await win.loadURL(url); const i = await run(o); dbg('ajuste', i); return i; }, better);
    info = r.info;
  }
  for (let k = 0; k < 2 && info.wbLead && info.complete; k++) {
    await win.loadURL(url);
    const o = Object.assign({}, bestOpts, { wbLead: info.wbLead });
    const i2 = await run(o);
    if (!i2.complete) { await win.loadURL(url); info = await run(bestOpts); break; }
    info = i2; bestOpts = o;
  }
  if (!info.complete) console.error('AVISO: a paginação não chegou ao fim do livro');
  return { book, info };
}

async function renderPdf(project, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const tm = label => { if (process.env.DEBUG_TIMING) console.log('TIMING', label, Date.now() - t0, 'ms'); };
  progress('Preparando a janela de impressão…');
  return withRenderWindow(async win => {
    tm('janela');
    const ns = normalizeProject(project).settings;
    const sh = outputSheetSize(ns, effectiveBleed(ns));
    if (sh && sh.fits && !opts.spreads) project = Object.assign({}, project, { settings: Object.assign({}, project.settings, { cropMarks: false }) });
    const { info } = await renderBookIn(win, project, { spreadsPrint: !!opts.spreads, pageRange: opts.range || '' });
    tm('paginação');
    progress(`Paginação pronta: ${info.pages} páginas${info.complete ? '' : ' (atenção: conferir o fim do livro)'}`);
    progress('Gerando o PDF (fontes incorporadas)…');
    if (process.env.DEBUG_LAYOUT) {
      const dbg = await win.webContents.executeJavaScript(`(() => { const t = document.querySelector('.pagedjs_pages').innerText; return { clipped: window.findClippedText().slice(0, 6), chars: t.length, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, notes: [...document.querySelectorAll('.pagedjs_page')].map(p => { const a = p.querySelector('.pagedjs_footnote_area'); const r = a && a.getBoundingClientRect(); const pr = p.getBoundingClientRect(); const f = [...p.querySelectorAll('.pagedjs_footnote_area .footnote')]; return f.length || (r && r.height) ? { n: p.dataset.pageNumber, f: f.map(x => x.innerText.slice(0, 12) + '@' + Math.round(x.getBoundingClientRect().top - pr.top) + '/' + Math.round(pr.height)), ah: r && Math.round(r.height) } : null; }).filter(Boolean) }; })()`, true);
      console.log('DEBUG_LAYOUT', JSON.stringify(dbg));
    }
    let pdf = await win.webContents.printToPDF({
      printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' },
      generateDocumentOutline: !!opts.outline, generateTaggedPDF: !!opts.tagged
    });
    tm('printToPDF');
    progress(`PDF gerado (${kb(pdf.length)}); gravando caixas de corte e sangria${opts.color && opts.color !== 'rgb' ? ', convertendo cores' : ''}…`);
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
    doc.setCreator('Casa Vertigem Hub');
    doc.setProducer('Casa Vertigem Hub (Chromium/Skia PDF)');
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
    res.issues = res.issues || [];
    if (info.revealedNotes && info.revealedNotes.length) res.issues.push({ level: 'warn', type: 'notes', msg: `${info.revealedNotes.length} nota(s) de rodapé são maiores que o espaço da página e continuam na página seguinte (ou ocupam a margem inferior). Confira: encurtar a nota resolve.` });
    if (!info.complete) res.issues.push({ level: 'error', type: 'pages', msg: 'A paginação não chegou ao fim do livro: parte do texto pode estar faltando. Verifique imagens ou tabelas maiores que a página.' });
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

// Capa do livro digital: JPEG RGB, sem transparência, lado maior até 2560 px (recomendação da Amazon)
function ebookCover(dataUrl) {
  const bin = dataUrl && exporters.dataUrlToBuffer(dataUrl);
  if (!bin) return null;
  return require('./main/mobi').toJpeg(bin.buf, 2560, 8 * 1024 * 1024);
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
    progress(`Arquivo salvo: ${path.basename(file)} (${kb(pdf.length)})`);
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
  const formats = { epub: ['EPUB', 'epub'], mobi: ['MOBI (Kindle)', 'mobi'], docx: ['Word', 'docx'], odt: ['OpenDocument', 'odt'], txt: ['Texto', 'txt'] };
  if (formats[kind]) {
    const file = opts.target || await askSavePath(`Exportar ${formats[kind][0]}`, `${base}.${formats[kind][1]}`, [{ name: formats[kind][0], extensions: [formats[kind][1]] }]);
    if (!file) return null;
    const s = project.settings;
    const page = { width: s.pageWidth, height: s.pageHeight, marginTop: s.marginTop, marginBottom: s.marginBottom, marginInner: s.marginInner, marginOuter: s.marginOuter };
    let buf;
    if (kind === 'epub' || kind === 'mobi') {
      const e = Object.assign({ uuid: crypto.randomUUID() }, req.epub);
      progress(e.cover ? 'Preparando a capa (JPEG RGB para lojas e leitores)…' : 'Sem imagem de capa');
      e.coverJpeg = ebookCover(e.cover);
      progress(`Montando ${(e.docs || []).length} capítulo(s), sumário navegável e metadados (título, autor, sinopse, data de hoje, créditos Casa Vertigem)…`);
      buf = kind === 'epub' ? await exporters.exportEpub(e, project.assets || {}) : require('./main/mobi').buildMobi(e, project.assets || {}).mobi;
    }
    else if (kind === 'docx') buf = await exporters.exportDocx(req.doc, project.assets || {}, page);
    else if (kind === 'odt') buf = await exporters.exportOdt(req.doc, project.assets || {}, page);
    else buf = exporters.exportTxt(req.doc);
    fs.writeFileSync(file, buf);
    progress(`Arquivo salvo: ${path.basename(file)} (${kb(buf.length)})`);
    return { files: [file] };
  }
  if (kind === 'package') {
    const file = opts.target || await askSavePath('Salvar pacote de produção', `${base}-pacote-producao.zip`, [{ name: 'ZIP', extensions: ['zip'] }]);
    if (!file) return null;
    const files = [];
    const { pdf, pages } = await renderPdf(project, opts);
    files.push({ name: opts.fileBase ? `${safeName(opts.fileBase, 140)}.pdf` : `${base}-miolo.pdf`, data: pdf });
    if (opts.includeCover && project.cover) files.push({ name: opts.fileBase ? `${safeName(opts.fileBase.replace('_MIOLO_', '_CAPA_'), 140)}.pdf` : `${base}-capa-cmyk.pdf`, data: (await cmyk.buildCoverPdf(APP_ROOT, coverOut(project), project.assets || {}, project.meta, CoverGeometry.geometry(project.cover), { bleed: true })).pdf });
    if (opts.includeEpub && req.epub) files.push({ name: `${base}.epub`, data: await exporters.exportEpub(Object.assign({ uuid: crypto.randomUUID(), coverJpeg: ebookCover(req.epub.cover) }, req.epub), project.assets || {}) });
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
    const cover = coverOut(project);
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
  try { return await runExport(require('./shared/defaults').nfcDeep(req)); } catch (err) {
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

// capa com a marca da editora: o logotipo é o mesmo da página de rosto
function coverOut(project) {
  const c = project.cover || {};
  return Object.assign({}, c, { brand: Object.assign({}, CoverGeometry.BRAND, c.brand || {}, { logoAsset: (project.titlePage || {}).logo || null }) });
}
async function renderCoverPdf(project, opts) {
  const c = coverOut(project);
  const brand = {};
  const la = c.brand.logoAsset && (project.assets || {})[c.brand.logoAsset];
  if (c.brand.enabled !== false) {
    if (la) { brand.logoUrl = la.dataUrl; try { const sz = require('electron').nativeImage.createFromDataURL(la.dataUrl).getSize(); brand.aspect = sz.width / sz.height; } catch (e) { /* padrão */ } }
    if (c.brand.qr !== false && c.brand.qrText) { try { brand.qrUrl = await require('qrcode').toDataURL(String(c.brand.qrText), { margin: 1, width: 1000, errorCorrectionLevel: 'M' }); } catch (e) { /* sem QR */ } }
  }
  return withRenderWindow(async win => {
    await win.webContents.executeJavaScript(`window.renderCover(${JSON.stringify({ cover: c, assets: project.assets, brand })}, ${JSON.stringify({ bleed: opts.bleed !== false, guides: false, part: opts.part || 'all', print: true })})`, true);
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
    doc.setCreator('Casa Vertigem Hub');
    fs.writeFileSync(file, Buffer.from(await doc.save()));
  }
  return { file, isbn13: lay.isbn13 };
});
// QR code para inserir no texto (PNG em alta resolução, preto puro)
ipcMain.handle('qr:dataUrl', async (e, text) => { try { return await require('qrcode').toDataURL(String(text || ''), { margin: 1, width: 1000, errorCorrectionLevel: 'M' }); } catch (err) { return null; } });
// Planilha (CSV, TSV, XLSX, ODS) para virar tabela ou gráfico no livro
ipcMain.handle('sheet:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { title: 'Importar planilha', filters: [{ name: 'Planilhas', extensions: ['xlsx', 'xlsm', 'ods', 'csv', 'tsv', 'txt'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return null;
  try { return await require('./main/sheets').readSheet(res.filePaths[0]); } catch (e) { return { error: e.message }; }
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
// perfil U.S. Web Coated (SWOP) v2, recomendado pelo Cedet para a capa: não pode vir no instalador, mas
// costuma estar instalado com os programas da Adobe (ou no sistema) — o app procura e usa se achar
ipcMain.handle('cover:findSwop', () => {
  const names = ['USWebCoatedSWOP.icc', 'USWebCoatedSWOP.icm', 'U.S. Web Coated (SWOP) v2.icc'];
  const env = process.env;
  const dirs = [
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Common Files', 'Adobe', 'Color', 'Profiles', 'Recommended'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Common Files', 'Adobe', 'Color', 'Profiles', 'Recommended'),
    path.join(env.CommonProgramFiles || 'C:\\Program Files\\Common Files', 'Adobe', 'Color', 'Profiles', 'Recommended'),
    path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'spool', 'drivers', 'color'),
    '/Library/Application Support/Adobe/Color/Profiles/Recommended', '/Library/ColorSync/Profiles', path.join(app.getPath('home'), 'Library', 'ColorSync', 'Profiles'),
    '/usr/share/color/icc', path.join(app.getPath('userData'), 'icc')
  ];
  for (const d of dirs) for (const n of names) {
    const f = path.join(d, n);
    try {
      if (!fs.existsSync(f)) continue;
      const buf = fs.readFileSync(f);
      const info = cmyk.iccInfo(buf);
      if (info && info.colorSpace === 'CMYK') return { name: n, desc: info.desc || 'U.S. Web Coated (SWOP) v2', data: buf.toString('base64'), file: f };
    } catch (e) { /* segue procurando */ }
  }
  return null;
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
    remoteAssets = require('./main/remote-assets').createRemoteAssets(APP_ROOT, app.getPath('userData'));
    library.extraBuiltin = () => remoteAssets.bundledRules(library.builtinDir);
    registerAppProtocol();
    blockNetwork(session.defaultSession);
    // tela Ferramentas: conversores de imagem e de texto, remoção de fundo
    require('./main/tools').registerTools({
      ipcMain, dialog, app, utilityProcess, getWindow: () => mainWindow, rasterizePdf, safeName,
      bg: require('./main/bgremove').createBgRemover({ modelsDir: userFile('modelos'), bundledDir: path.join(APP_ROOT, 'assets', 'models'), workerUrl: appUrl('src/mt/bg.html'), preload: path.join(__dirname, 'mt', 'bg-preload.js') })
    });
    if (process.env.SMOKE_TEST && process.env.MT_SELFTEST) {
      // conferência do tradutor offline (janela oculta, WebAssembly e modelo da pasta de dados)
      const r = await tr().offline.test();
      console.log('MT_SELFTEST ' + JSON.stringify(r));
      app.exit(r.ok ? 0 : 1);
      return;
    }
    if (process.env.SMOKE_TEST) {
      try { await runSmokeTest(); app.exit(0); } catch (err) { console.error('SMOKE_FAIL', err); app.exit(1); }
      return;
    }
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => { if (!process.env.SMOKE_TEST) app.quit(); });
}
