// Ponte mínima entre a janela oculta do tradutor offline e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mtBridge', {
  onJob: cb => ipcRenderer.on('mt:job', (e, job) => cb(job)),
  reply: msg => ipcRenderer.send('mt:reply', msg)
});
