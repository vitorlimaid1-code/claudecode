// Gera os PNGs da galeria “Imersão” (aberturas de capítulo) a partir de scripts/immersion-art.js.
// Uso (desenvolvimento): npx electron scripts/make-immersion.js   (em Linux sem tela: xvfb-run -a ...)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { ART, W, H } = require('./immersion-art');

const OUT = path.join(__dirname, '..', 'assets', 'immersion');
const SCALE = 1.5;

async function render(win, svg) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">${svg}</svg>`;
  return win.webContents.executeJavaScript(`new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = ${W * SCALE}; c.height = ${H * SCALE};
      c.getContext('2d').drawImage(img, 0, 0); res(c.toDataURL('image/jpeg', 0.9)); };
    img.onerror = () => rej(new Error('svg inválido'));
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(${JSON.stringify(doc)})));
  })`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [];
  for (const [id, item] of Object.entries(ART)) {
    const url = await render(win, item.svg());
    fs.writeFileSync(path.join(OUT, id + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    manifest.push({ id, name: item.name, group: item.group, file: `immersion/${id}.jpg`, width: W * SCALE, height: H * SCALE });
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('Imersão gerada:', manifest.length, 'imagens');
  app.exit(0);
});
