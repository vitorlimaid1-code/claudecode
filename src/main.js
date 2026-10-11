// Processo principal do Diagramador de Livros.
// Tudo roda localmente: nenhuma requisição de rede é permitida.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { buildBook } = require('./book');
const { normalizeProject, BUNDLED_FONTS } = require('./shared/defaults');

const APP_ROOT = path.join(__dirname, '..');
const PROJECT_EXT = 'livro';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

let mainWindow = null;
let allowClose = false;
let pendingOpenPath = null;

function appUrl(rel) {
  return 'app://local/' + rel.replace(/\\/g, '/');
}

function registerAppProtocol() {
  protocol.handle('app', async request => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.normalize(path.join(APP_ROOT, rel));
    if (!filePath.startsWith(APP_ROOT)) return new Response('Proibido', { status: 403 });
    try {
      const data = await fs.promises.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type } });
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
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) e.preventDefault();
  });
}

function autosavePath() {
  return path.join(app.getPath('userData'), 'autosave.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Diagramador de Livros',
    backgroundColor: '#f4f2ee',
    icon: path.join(APP_ROOT, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });
  mainWindow.webContents.session.setSpellCheckerLanguages(['pt-BR']);
  mainWindow.loadURL(appUrl('src/renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (process.env.SCREENSHOT_OUT) {
    // Usado apenas para documentação/testes: captura a janela e encerra
    mainWindow.webContents.on('console-message', e => {
      if (e.level === 'error' || e.level === 'warning') console.log('CONSOLE ' + e.level + ': ' + e.message);
    });
    mainWindow.webContents.once('did-finish-load', () => setTimeout(async () => {
      const r = await mainWindow.webContents.executeJavaScript(process.env.SCREENSHOT_JS || 'void 0', true).catch(e => 'ERR ' + e.message);
      if (r !== undefined) console.log('JS_RESULT ' + JSON.stringify(r));
      await new Promise(r => setTimeout(r, Number(process.env.SCREENSHOT_WAIT || 2500)));
      const img = await mainWindow.webContents.capturePage();
      fs.writeFileSync(process.env.SCREENSHOT_OUT, img.toPNG());
      allowClose = true;
      app.quit();
    }, 4000));
  }

  mainWindow.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow.webContents.send('request-close');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  // Se a interface travar, não impede o fechamento
  mainWindow.webContents.on('render-process-gone', () => { allowClose = true; });
  mainWindow.on('unresponsive', () => { allowClose = true; });
}

function send(cmd) {
  if (mainWindow) mainWindow.webContents.send('menu', cmd);
}

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
        { label: 'Importar texto (Word, TXT, Markdown)…', accelerator: 'CmdOrCtrl+I', click: () => send('import') },
        { label: 'Exportar PDF…', accelerator: 'CmdOrCtrl+E', click: () => send('exportPdf') },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Colar sem formatação', role: 'pasteAndMatchStyle' },
        { label: 'Selecionar tudo', role: 'selectAll' }
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        { label: 'Atualizar prévia', accelerator: 'F5', click: () => send('refresh') },
        { type: 'separator' },
        { label: 'Aumentar zoom da interface', role: 'zoomIn' },
        { label: 'Diminuir zoom da interface', role: 'zoomOut' },
        { label: 'Zoom padrão', role: 'resetZoom' },
        { type: 'separator' },
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
            type: 'info',
            title: 'Sobre',
            message: `Diagramador de Livros ${app.getVersion()}`,
            detail: 'Diagramação de livros 100% local e offline.\nSeus textos nunca saem do seu computador.\n\nPaginação: Paged.js (MIT). Fontes: SIL Open Font License.'
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Arquivos de projeto ----------

function readProjectFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || data.format !== 'diagramador-de-livros') {
    throw new Error('Este arquivo não é um projeto do Diagramador de Livros.');
  }
  return normalizeProject(data);
}

function writeFileAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

ipcMain.handle('project:open', async (e, filePath) => {
  if (!filePath) {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Abrir livro',
      filters: [{ name: 'Projeto de livro', extensions: [PROJECT_EXT] }],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths.length) return null;
    filePath = res.filePaths[0];
  }
  try {
    return { filePath, project: readProjectFile(filePath) };
  } catch (err) {
    dialog.showErrorBox('Não foi possível abrir', String(err.message || err));
    return null;
  }
});

ipcMain.handle('project:save', async (e, { project, filePath, saveAs }) => {
  if (!filePath || saveAs) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar livro',
      defaultPath: (filePath || safeName(project.meta && project.meta.title) + '.' + PROJECT_EXT),
      filters: [{ name: 'Projeto de livro', extensions: [PROJECT_EXT] }]
    });
    if (res.canceled || !res.filePath) return null;
    filePath = res.filePath;
  }
  try {
    writeFileAtomic(filePath, JSON.stringify(normalizeProject(project), null, 1));
    return { filePath };
  } catch (err) {
    dialog.showErrorBox('Não foi possível salvar', String(err.message || err));
    return null;
  }
});

function safeName(s) {
  return (String(s || 'livro').replace(/[\\/:*?"<>|]+/g, '').trim() || 'livro').slice(0, 80);
}

// ---------- Salvamento automático (recuperação) ----------

ipcMain.handle('autosave:write', async (e, data) => {
  try {
    await fs.promises.mkdir(path.dirname(autosavePath()), { recursive: true });
    await fs.promises.writeFile(autosavePath(), JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('autosave:read', async () => {
  try {
    const data = JSON.parse(await fs.promises.readFile(autosavePath(), 'utf8'));
    data.project = normalizeProject(data.project);
    return data;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('autosave:clear', async () => {
  try { await fs.promises.unlink(autosavePath()); } catch (e) { /* ok */ }
  return true;
});

// ---------- Importação ----------

ipcMain.handle('import:file', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar texto',
    filters: [
      { name: 'Documentos', extensions: ['docx', 'txt', 'md', 'markdown', 'html', 'htm'] },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath, ext);
  try {
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ path: filePath }, {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Título'] => h1:fresh",
          "p[style-name='Quote'] => blockquote > p:fresh",
          "p[style-name='Citação'] => blockquote > p:fresh",
          "p[style-name='Intense Quote'] => blockquote > p:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
          "p[style-name='Subtítulo'] => h2:fresh",
          "p[style-name='Título 1'] => h1:fresh",
          "p[style-name='Título 2'] => h2:fresh",
          "p[style-name='Título 3'] => h3:fresh",
          'u => u'
        ]
      });
      return { kind: 'html', html: result.value, name };
    }
    const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
    if (ext === '.html' || ext === '.htm') return { kind: 'html', html: text, name };
    if (ext === '.md' || ext === '.markdown') return { kind: 'markdown', text, name };
    return { kind: 'text', text, name };
  } catch (err) {
    dialog.showErrorBox('Não foi possível importar', String(err.message || err));
    return null;
  }
});

ipcMain.handle('image:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Inserir imagem',
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] || 'image/png';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
});

// ---------- Livro / PDF ----------

function bookPayload(project) {
  const book = buildBook(project);
  const p = normalizeProject(project);
  book.fonts = [...new Set([p.settings.bodyFont, p.settings.headingFont])].filter(f => BUNDLED_FONTS.includes(f));
  return book;
}

ipcMain.handle('book:build', async (e, project) => bookPayload(project));

async function renderPdf(project) {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  try {
    await win.loadURL(appUrl('src/renderer/preview.html'));
    const book = bookPayload(project);
    const info = await win.webContents.executeJavaScript(`window.renderBook(${JSON.stringify(book)}, {})`, true);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' }
    });
    return { pdf, pages: info.pages, info };
  } finally {
    win.destroy();
  }
}

ipcMain.handle('book:exportPdf', async (e, { project, suggestedPath }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar PDF',
    defaultPath: suggestedPath || safeName(project.meta && project.meta.title) + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (res.canceled || !res.filePath) return null;
  try {
    const { pdf, pages } = await renderPdf(project);
    fs.writeFileSync(res.filePath, pdf);
    return { filePath: res.filePath, pages };
  } catch (err) {
    dialog.showErrorBox('Falha ao exportar PDF', String(err.message || err));
    return null;
  }
});

ipcMain.handle('shell:showItem', (e, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

ipcMain.handle('shell:openPath', (e, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.openPath(filePath);
});

ipcMain.handle('dialog:unsaved', async () => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Salvar', 'Não salvar', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    title: 'Alterações não salvas',
    message: 'Deseja salvar as alterações do livro?',
    detail: 'Se não salvar, as alterações feitas desde o último salvamento serão perdidas.'
  });
  return ['save', 'discard', 'cancel'][res.response];
});

ipcMain.handle('dialog:confirm', async (e, { message, detail, buttons }) => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: buttons || ['OK', 'Cancelar'],
    defaultId: 0,
    cancelId: (buttons || ['OK', 'Cancelar']).length - 1,
    message,
    detail: detail || ''
  });
  return res.response;
});

ipcMain.handle('app:pendingOpen', () => {
  const p = pendingOpenPath;
  pendingOpenPath = null;
  return p;
});

ipcMain.on('app:closeConfirmed', () => {
  allowClose = true;
  if (mainWindow) mainWindow.close();
});

ipcMain.on('app:setTitle', (e, title) => {
  if (mainWindow) mainWindow.setTitle(title);
});

// ---------- Modo de teste automatizado (npm test) ----------

async function runSmokeTest() {
  const out = process.env.SMOKE_OUT || path.join(app.getPath('temp'), 'diagramador-teste.pdf');
  const project = normalizeProject(null);
  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Classe aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.';
  project.front.epigraph = true;
  project.meta.epigraph = 'Escrever é esquecer.';
  project.meta.epigraphAuthor = 'Fernando Pessoa';
  project.chapters.push({ id: 'prefacio', title: 'Uma pausa', numbered: false, html: '<p>' + lorem + '</p>' });
  for (let i = 2; i <= 4; i++) {
    project.chapters.push({
      id: 'cap' + i,
      title: 'Capítulo de teste ' + i,
      numbered: true,
      html: Array.from({ length: 14 }, (_, k) => (k === 6 ? '<h2>Uma seção</h2>' : '') + '<p>' + lorem + '</p>').join('')
    });
  }
  const { pdf, pages, info } = await renderPdf(project);
  fs.writeFileSync(out, pdf);
  if (process.env.SMOKE_DEBUG) console.log(JSON.stringify(info.pageInfo, null, 0));
  console.log(`SMOKE_OK pages=${pages} bytes=${pdf.length} out=${out}`);
}

// ---------- Ciclo de vida ----------

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
    registerAppProtocol();
    blockNetwork(session.defaultSession);
    if (process.env.SMOKE_TEST) {
      try {
        await runSmokeTest();
        app.exit(0);
      } catch (err) {
        console.error('SMOKE_FAIL', err);
        app.exit(1);
      }
      return;
    }
    buildMenu();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
