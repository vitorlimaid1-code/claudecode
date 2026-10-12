// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  openProject: filePath => inv('project:open', filePath || null),
  saveProject: (project, filePath, saveAs) => inv('project:save', { project, filePath, saveAs: !!saveAs }),
  autosaveWrite: data => inv('autosave:write', data),
  autosaveRead: () => inv('autosave:read'),
  autosaveClear: () => inv('autosave:clear'),

  defaultsGet: () => inv('defaults:get'),
  defaultsSet: s => inv('defaults:set', s),
  defaultsReset: () => inv('defaults:reset'),
  newProject: () => inv('defaults:newProject'),
  typesetsGet: () => inv('typesets:get'),
  typesetsSet: d => inv('typesets:set', d),
  profilesGet: () => inv('profiles:get'),
  profilesSet: d => inv('profiles:set', d),

  importFile: () => inv('import:file'),
  importPath: p => inv('import:path', p),
  pickImages: opts => inv('image:pick', opts || {}),
  imagesFromPaths: paths => inv('image:fromPaths', paths),
  analyzeImage: dataUrl => inv('image:analyze', dataUrl),

  libList: () => inv('lib:list'),
  libAddDialog: kind => inv('lib:addDialog', kind),
  libAddPaths: (kind, paths) => inv('lib:addPaths', kind, paths),
  libAddDataUrl: (kind, name, dataUrl) => inv('lib:addDataUrl', kind, name, dataUrl),
  libUpdate: (key, patch) => inv('lib:update', key, patch),
  libRemove: key => inv('lib:remove', key),
  libOpenFolder: () => inv('lib:openFolder'),

  fontsSystem: force => inv('fonts:system', !!force),
  fontsLibrary: () => inv('fonts:library'),
  fontsAddDialog: () => inv('fonts:addDialog'),
  fontsAddPaths: paths => inv('fonts:addPaths', paths),
  fontsAddFromSystem: fam => inv('fonts:addFromSystem', fam),
  fontsRemove: fam => inv('fonts:remove', fam),
  fontsCss: fams => inv('fonts:css', fams),

  buildBook: project => inv('book:build', project),
  inspect: (project, opts) => inv('export:inspect', project, opts || {}),
  exportRun: req => inv('export:run', req),
  coverAnalyze: s => inv('cover:analyze', s),
  coverProof: (cover, assets) => inv('cover:proof', cover, assets),
  catalogFixedGet: () => inv('catalog:fixedGet'),
  catalogFixedSet: d => inv('catalog:fixedSet', d),
  catalogTemplatesGet: () => inv('catalog:templatesGet'),
  catalogTemplatesSet: d => inv('catalog:templatesSet', d),

  showItem: p => inv('shell:showItem', p),
  openPath: p => inv('shell:openPath', p),
  askUnsaved: () => inv('dialog:unsaved'),
  confirm: (message, detail, buttons) => inv('dialog:confirm', { message, detail, buttons }),
  saveText: (name, text) => inv('dialog:saveText', { name, text }),
  pendingOpen: () => inv('app:pendingOpen'),
  appInfo: () => inv('app:info'),
  closeConfirmed: () => ipcRenderer.send('app:closeConfirmed'),
  setTitle: title => ipcRenderer.send('app:setTitle', title),
  onMenu: cb => ipcRenderer.on('menu', (e, cmd) => cb(cmd)),
  onRequestClose: cb => ipcRenderer.on('request-close', () => cb()),
  pathForFile: file => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } }
});
