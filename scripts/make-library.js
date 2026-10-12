// Gera os PNGs da biblioteca embutida a partir de scripts/library-art.js.
// Uso (desenvolvimento): npx electron scripts/make-library.js   (em Linux sem tela: xvfb-run -a ...)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { SEP, BODY } = require('./library-art');

const OUT = path.join(__dirname, '..', 'assets', 'library');

async function render(win, svg, vw, vh, scale) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw * scale}" height="${vh * scale}">${svg}</svg>`;
  return win.webContents.executeJavaScript(`new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = ${vw * scale}; c.height = ${vh * scale};
      c.getContext('2d').drawImage(img, 0, 0); res(c.toDataURL('image/png')); };
    img.onerror = () => rej(new Error('svg inválido'));
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(${JSON.stringify(doc)})));
  })`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const manifest = { separadores: [], corpo: [] };
  const groups = [['separadores', SEP, 600, 100, 4], ['corpo', BODY, 400, 400, 3]];
  for (const [dir, items, vw, vh, scale] of groups) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const [id, item] of Object.entries(items)) {
      const url = await render(win, item.svg, vw, vh, scale);
      fs.writeFileSync(path.join(OUT, dir, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
      manifest[dir].push({ id, name: item.name, tags: item.tags, file: `${dir}/${id}.png`, width: vw * scale, height: vh * scale });
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('Biblioteca gerada:', manifest.separadores.length, 'separadores e', manifest.corpo.length, 'ilustrações');
  app.exit(0);
});
