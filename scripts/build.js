// Gera o instalador com electron-builder.
// Em Linux/macOS, o NSIS normalmente precisa do Wine apenas para extrair o desinstalador;
// aqui usamos o leitor em JavaScript puro do próprio electron-builder, dispensando o Wine.
if (process.platform !== 'win32') {
  const macosVersion = require('app-builder-lib/out/util/macosVersion');
  macosVersion.isMacOsCatalina = () => true;
}
const { build, Platform } = require('electron-builder');

const args = process.argv.slice(2);
const targets = new Map();
let platform = null;
let targetName = null;
let arch = 'x64';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--win') platform = Platform.WINDOWS;
  else if (args[i] === '--linux') platform = Platform.LINUX;
  else if (args[i] === '--x64') arch = 'x64';
  else if (args[i] === '--arm64') arch = 'arm64';
  else targetName = args[i];
}
platform = platform || Platform.WINDOWS;
targets.set(platform, new Map([[require('builder-util').archFromString(arch), [targetName || (platform === Platform.WINDOWS ? 'nsis' : 'AppImage')]]]));

build({ targets, publish: 'never' })
  .then(files => { console.log('\nArquivos gerados:\n' + files.map(f => '  ' + f).join('\n')); })
  .catch(err => { console.error(err); process.exit(1); });
