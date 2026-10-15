// Baixa os logotipos dos selos editoriais e os filetes da Casa Vertigem para dentro do app
// (assets/seals e assets/library/separadores), para o instalador já trazê-los e funcionar sem internet.
// Roda na compilação (GitHub Actions) e pode ser rodado à mão: node scripts/fetch-assets.js
// Sem internet, avisa e segue: o app baixa o que faltar na primeira vez que for usado.
const path = require('path');
const fs = require('fs');
const Ficha = require('../src/shared/ficha');

const root = path.join(__dirname, '..');
async function get(url, file) {
  if (fs.existsSync(file)) return 'já existe';
  const r = await fetch(url, { headers: { 'user-agent': 'Casa Vertigem Hub (build)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf[0] !== 0x89 && buf[0] !== 0xff) throw new Error('não é imagem');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return (buf.length / 1024).toFixed(0) + ' KB';
}
(async () => {
  let ok = 0, fail = 0;
  const jobs = Ficha.SEALS.map(s => [s.url, path.join(root, 'assets', 'seals', s.id + '.png'), 'selo ' + s.name])
    .concat(Ficha.RULES.map(r => [r.url, path.join(root, 'assets', 'library', 'separadores', r.id + '.png'), r.name]));
  for (const [url, file, label] of jobs) {
    let err = null;
    // o servidor das imagens às vezes responde 404/5xx por instantes: tenta de novo, com pausas
    for (let k = 0; k < 4; k++) {
      try { console.log(`ok   ${label}: ${await get(url, file)}`); ok++; err = null; break; } catch (e) { err = e; await new Promise(r => setTimeout(r, 1500 * (k + 1))); }
    }
    if (err) { console.log(`falha ${label}: ${err.message}`); fail++; }
  }
  console.log(`fetch-assets: ${ok} baixado(s), ${fail} falha(s)`);
  if (process.argv.includes('--strict') && fail) process.exit(1);
})();
