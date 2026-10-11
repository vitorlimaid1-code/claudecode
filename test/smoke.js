// Teste de fumaça: gera um PDF de exemplo usando o mesmo caminho de exportação do app.
// Uso: npm test   (em Linux sem tela, rode com xvfb-run)
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const electron = require('electron');

const out = process.env.SMOKE_OUT || path.join(os.tmpdir(), 'diagramador-teste.pdf');
const args = [path.join(__dirname, '..')];
if (process.platform === 'linux') args.push('--no-sandbox');
const r = spawnSync(electron, args, {
  env: { ...process.env, SMOKE_TEST: '1', SMOKE_OUT: out },
  encoding: 'utf8',
  timeout: 120000
});
process.stdout.write(r.stdout || '');
process.stderr.write((r.stderr || '').split('\n').filter(l => /SMOKE|Error/.test(l)).join('\n'));
const m = /SMOKE_OK pages=(\d+)/.exec(r.stdout || '');
if (r.status !== 0 || !m || Number(m[1]) < 8) {
  console.error('\nFalhou: status', r.status);
  process.exit(1);
}
console.log('\nOK —', m[1], 'páginas geradas em', out);
