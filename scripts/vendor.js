// Copia para src/renderer/vendor os arquivos de terceiros usados pela interface
// (Paged.js e fontes), para que o app funcione 100% offline e o instalador fique enxuto.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'src', 'renderer', 'vendor');

const FONTS = ['eb-garamond', 'crimson-pro', 'libre-baskerville', 'lora', 'merriweather', 'cormorant-garamond', 'playfair-display'];
const WEIGHTS = ['400', '400-italic', '700', '700-italic'];
const SUBSETS = ['latin', 'latin-ext'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

// Paged.js com uma correção: o trecho de texto que continua de uma página para a outra é um
// sufixo do texto original; procurá-lo do início (indexOf) erra quando há frases repetidas
// (refrões, "Não. Não."), repetindo conteúdo. Procurando a partir do fim, a posição é sempre a certa.
let paged = fs.readFileSync(path.join(nm, 'pagedjs', 'dist', 'paged.js'), 'utf8');
const BUG = 'offset += node.textContent.indexOf(container.textContent);';
if (!paged.includes(BUG)) throw new Error('paged.js: trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG, 'offset += node.textContent.lastIndexOf(container.textContent);');
// Segunda correção: quando o Paged.js só mede a página (sem retirar o excesso), o gancho
// afterOverflowRemoved era chamado sem o conteúdo removido e lançava um erro que interrompia o
// livro inteiro (notas de rodapé muito grandes). Sem conteúdo removido, não há o que tratar.
const BUG2 = 'this.hooks && this.hooks.afterOverflowRemoved.trigger(overflow.content, rendered, this);';
if (!paged.includes(BUG2)) throw new Error('paged.js: segundo trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG2, 'if (overflow.content) this.hooks && this.hooks.afterOverflowRemoved.trigger(overflow.content, rendered, this);');
fs.writeFileSync(path.join(out, 'paged.js'), paged);

let css = '/* Gerado por scripts/vendor.js — não editar */\n';
for (const font of FONTS) {
  const pkg = path.join(nm, '@fontsource', font);
  const fontOut = path.join(out, 'fonts', font);
  fs.mkdirSync(fontOut, { recursive: true });
  for (const w of WEIGHTS) {
    for (const sub of SUBSETS) {
      const cssFile = path.join(pkg, `${sub}-${w}.css`);
      if (!fs.existsSync(cssFile)) continue;
      let text = fs.readFileSync(cssFile, 'utf8');
      // Mantém só o woff2 e reescreve o caminho
      text = text.replace(/src:\s*url\(\.\/files\/([^)]+\.woff2)\)\s*format\('woff2'\)[^;]*;/g, (m, file) => {
        fs.copyFileSync(path.join(pkg, 'files', file), path.join(fontOut, file));
        return `src: url(fonts/${font}/${file}) format('woff2');`;
      });
      css += text + '\n';
    }
  }
  const license = ['LICENSE', 'LICENSE.md', 'OFL.txt'].map(f => path.join(pkg, f)).find(f => fs.existsSync(f));
  if (license) fs.copyFileSync(license, path.join(fontOut, 'LICENSE.txt'));
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('vendor: Paged.js e', FONTS.length, 'famílias de fontes copiadas para', path.relative(root, out));
