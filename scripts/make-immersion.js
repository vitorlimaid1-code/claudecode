// Gera as imagens da galeria “Imersão” (aberturas de capítulo) a partir de scripts/immersion-art.js.
// Em preto e branco (tons de cinza), como exige o manual do Cedet para o miolo (só tinta preta): as cores
// do desenho viram cinza pela claridade, com um pouco mais de contraste para as formas não se perderem.
// Uso (desenvolvimento): npx electron scripts/make-immersion.js   (em Linux sem tela: xvfb-run -a ...)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { ART, W, H } = require('./immersion-art');

const OUT = path.join(__dirname, '..', 'assets', 'immersion');
const SCALE = 1.5;

async function render(win, svg) {
  const bw = '<filter id="cvbw" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope="1.12" intercept="-0.05"/><feFuncG type="linear" slope="1.12" intercept="-0.05"/><feFuncB type="linear" slope="1.12" intercept="-0.05"/></feComponentTransfer></filter>';
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}"><defs>${bw}</defs><g filter="url(#cvbw)">${svg}</g></svg>`;
  return win.webContents.executeJavaScript(`new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = ${W * SCALE}; c.height = ${H * SCALE};
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      // garante cinza puro (R = G = B) em todos os pixels
      const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
      for (let i = 0; i < p.length; i += 4) { const v = Math.round(p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722); p[i] = p[i + 1] = p[i + 2] = v; }
      x.putImageData(d, 0, 0); res(c.toDataURL('image/jpeg', 0.92)); };
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
