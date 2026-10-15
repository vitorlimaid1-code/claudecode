// Ponte mínima entre a janela oculta da remoção de fundo e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bgBridge', {
  onJob: cb => ipcRenderer.on('bg:job', (e, job) => cb(job)),
  reply: msg => ipcRenderer.send('bg:reply', msg)
});
