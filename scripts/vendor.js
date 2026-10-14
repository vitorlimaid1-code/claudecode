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
// Terceira correção: ao separar o excesso de uma página, a nota de rodapé ainda não posicionada (e a sua
// chamada), que ficam na coluna invisível de excesso, eram vistas como conteúdo visível; o excesso era cortado antes dela e o
// resto do parágrafo se perdia. A chamada não conta como conteúdo visível nessa conferência.
const BUG3 = `				do {
					sibling = sibling.nextSibling;
					siblingBounds = sibling ? getBoundingClientRect(sibling) : undefined;
				} while (sibling && !siblingBounds?.height);`;
if (!paged.includes(BUG3)) throw new Error('paged.js: terceiro trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG3, `				do {
					sibling = sibling.nextSibling;
					siblingBounds = sibling ? getBoundingClientRect(sibling) : undefined;
				} while (sibling && (!siblingBounds?.height || (sibling.nodeType === 1 && sibling.dataset && (sibling.dataset.footnoteCall !== undefined || sibling.dataset.note === 'footnote'))));`);

// Quarta correção (velocidade): o Paged.js agenda cada página com requestIdleCallback/requestAnimationFrame,
// que o Chromium desacelera muito em janelas ocultas (onde a paginação roda). Um agendador imediato
// deixa a paginação várias vezes mais rápida, sem mudar o resultado.
const BUG4a = 'const requestIdleCallback = typeof window !== "undefined" && ("requestIdleCallback" in window ? window.requestIdleCallback : window.requestAnimationFrame);';
if (!paged.includes(BUG4a)) throw new Error('paged.js: quarto trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG4a, 'const requestIdleCallback = cb => setTimeout(cb, 0);');
const BUG4b = 'this.tick = requestAnimationFrame;';
if (!paged.includes(BUG4b)) throw new Error('paged.js: quarto trecho (b) a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG4b, 'this.tick = cb => setTimeout(cb, 0);');

// Quinta correção (segurança): a busca de excesso da página roda num laço que, em casos raros de
// elementos em linha na quebra, podia nunca terminar e congelar o aplicativo. O laço passa a ter um
// limite (bem acima de qualquer página real); ao atingi-lo, segue com o excesso já encontrado.
const BUG5 = `			let overflowResult = this.findOverflow(rendered, bounds, source);
			while (overflowResult) {`;
if (!paged.includes(BUG5)) throw new Error('paged.js: quinto trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG5, `			let overflowResult = this.findOverflow(rendered, bounds, source);
			let overflowGuard = 0;
			while (overflowResult && overflowGuard++ < 500) {`);
// Sexta correção: ao comparar duas posições de quebra, o Paged.js ignorava a posição 0 (falsa em
// JavaScript). Quando um parágrafo inteiro passava para a página seguinte (posição 0) e depois precisava
// continuar em outra página, a nova quebra parecia igual à anterior, a paginação parava ali e o resto do
// capítulo se perdia. Agora 0 é uma posição como outra qualquer.
const BUG6 = `			if (this["offset"] && otherOffset["offset"] &&
				this["offset"] !== otherOffset["offset"]) {`;
if (!paged.includes(BUG6)) throw new Error('paged.js: sexto trecho a corrigir não encontrado (versão diferente?)');
paged = paged.replace(BUG6, `			if (this["offset"] !== undefined && otherOffset["offset"] !== undefined &&
				this["offset"] !== otherOffset["offset"]) {`);
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
