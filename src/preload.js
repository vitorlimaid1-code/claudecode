// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openProject: filePath => ipcRenderer.invoke('project:open', filePath || null),
  saveProject: (project, filePath, saveAs) => ipcRenderer.invoke('project:save', { project, filePath, saveAs: !!saveAs }),
  importFile: () => ipcRenderer.invoke('import:file'),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  buildBook: project => ipcRenderer.invoke('book:build', project),
  exportPdf: (project, suggestedPath) => ipcRenderer.invoke('book:exportPdf', { project, suggestedPath }),
  showItem: filePath => ipcRenderer.invoke('shell:showItem', filePath),
  openPath: filePath => ipcRenderer.invoke('shell:openPath', filePath),
  autosaveWrite: data => ipcRenderer.invoke('autosave:write', data),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  autosaveClear: () => ipcRenderer.invoke('autosave:clear'),
  askUnsaved: () => ipcRenderer.invoke('dialog:unsaved'),
  confirm: (message, detail, buttons) => ipcRenderer.invoke('dialog:confirm', { message, detail, buttons }),
  pendingOpen: () => ipcRenderer.invoke('app:pendingOpen'),
  closeConfirmed: () => ipcRenderer.send('app:closeConfirmed'),
  setTitle: title => ipcRenderer.send('app:setTitle', title),
  onMenu: cb => ipcRenderer.on('menu', (e, cmd) => cb(cmd)),
  onRequestClose: cb => ipcRenderer.on('request-close', () => cb())
});
