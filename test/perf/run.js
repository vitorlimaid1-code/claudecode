// Teste de desempenho (npm run perf): livro de ~700 páginas (40 capítulos, notas e imagens).
// Mede: primeira página na tela, livro inteiro paginado, maior travada da interface, uma edição até
// voltar à prévia, digitação e reabertura (cache de páginas). Em Linux sem tela: xvfb-run -a npm run perf
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const electron = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'cvh-perf-'));
const args = [ROOT];
if (process.platform === 'linux') args.push('--no-sandbox');
// perfil próprio e limpo (não mexe nas configurações nem no cache de quem usa o app)
args.push('--user-data-dir=' + path.join(OUT, 'profile'));
const r = spawnSync(electron, args, {
  env: { ...process.env, SCREENSHOT_STEPS: path.join(__dirname, 'steps.json'), SCREENSHOT_OUT: path.join(OUT, 'perf.png'), SCREENSHOT_WAIT: '300' },
  encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024
});
const res = (r.stdout || '').split('\n').filter(l => l.startsWith('JS_RESULT')).map(l => { let v = JSON.parse(l.split(' ').slice(2).join(' ')); try { v = JSON.parse(v); } catch (e) { /* texto */ } return v; });
const [load, edit, typing, reopen] = res;
if (!load) { console.error('falhou', (r.stderr || '').slice(-1500)); process.exit(1); }
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`Livro de ${load.pages} páginas (${os.cpus().length} núcleos)`);
console.log(`  primeira página na tela ........ ${(load.first / 1000).toFixed(1)} s`);
console.log(`  livro inteiro paginado ......... ${(load.done / 1000).toFixed(1)} s`);
console.log(`  maior travada da interface ..... ${load.longMax} ms`);
if (edit) console.log(`  edição até voltar à prévia ..... ${(edit.editDone / 1000).toFixed(1)} s`);
if (typing) console.log(`  digitação (média por tecla) .... ${avg(typing.typing)} ms`);
if (reopen) console.log(`  reabrir o livro (cache) ........ ${(reopen.reopen / 1000).toFixed(1)} s`);
const bad = load.longMax > 1000 || (typing && avg(typing.typing) > 50);
console.log(bad ? '\nATENÇÃO: interface travando' : '\nOK');
process.exit(bad ? 1 : 0);
