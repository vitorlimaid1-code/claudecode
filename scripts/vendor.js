// Copia para src/renderer/vendor os arquivos de terceiros usados pela interface
// (Paged.js e fontes), para que o app funcione 100% offline e o instalador fique enxuto.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'src', 'renderer', 'vendor');

const FONTS = ['eb-garamond', 'crimson-pro', 'libre-baskerville', 'lora', 'merriweather', 'cormorant-garamond', 'playfair-display', 'josefin-sans', 'montserrat'];
const WEIGHTS = ['400', '400-italic', '700', '700-italic'];
const SUBSETS = ['latin', 'latin-ext'];
// faixas Unicode do Google Fonts/Fontsource para cada subconjunto
const UNICODE_RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
};
// pesos extras (fino e extra-grosso) usados pelos modelos de sumário e de título
const EXTRA = { 'cormorant-garamond': ['300', '300-italic'], 'crimson-pro': ['300', '300-italic'], merriweather: ['300', '300-italic', '900'], 'playfair-display': ['900', '900-italic'] };

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

// Correção da página nomeada: na primeira página de um capítulo (página nomeada), o Paged.js marcava a página com
// "pagejs_named_page" (erro de digitação) em vez de "pagedjs_named_page"; as regras do capítulo (número da
// página, margens da moldura, cor) não valiam na abertura, que saía sem número.
const BUG_NP = 'page.classList.add("pagejs_named_page");';
if (!paged.includes(BUG_NP)) throw new Error('paged.js: trecho da página nomeada não encontrado (versão diferente?)');
paged = paged.replace(BUG_NP, 'page.classList.add("pagedjs_named_page"); page.classList.add("pagejs_named_page");');
// Imagens e outros elementos sem filhos (img, svg, canvas) eram medidos com altura zero ao procurar onde a
// página transborda: uma figura que começava perto do fim da página e não cabia ficava lá, cortada (sumia
// do PDF), em vez de ir inteira para a página seguinte. Esses elementos passam a contar com a altura real.
const BUG_LEAF = 'if (node instanceof HTMLBRElement) {';
if (!paged.includes(BUG_LEAF)) throw new Error('paged.js: trecho da medida de elementos sem filhos não encontrado (versão diferente?)');
paged = paged.replace(BUG_LEAF, 'if (node instanceof HTMLBRElement || /^(IMG|SVG|CANVAS|VIDEO|PICTURE|OBJECT|EMBED|IFRAME)$/i.test(node.tagName)) {');

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
  for (const w of WEIGHTS.concat(EXTRA[font] || [])) {
    for (const sub of SUBSETS) {
      const cssFile = path.join(pkg, `${sub}-${w}.css`);
      if (!fs.existsSync(cssFile)) continue;
      let text = fs.readFileSync(cssFile, 'utf8');
      // faixa de caracteres de cada subconjunto (latin / latin-ext): os arquivos por subconjunto não a trazem e,
      // sem ela, a face latin-ext (declarada depois) assumia letras como “Ã” e o til saía deslocado
      if (!/unicode-range/.test(text)) {
        const range = UNICODE_RANGES[sub];
        if (range) text = text.replace(/(src:[^;]*;)/, `$1\n  unicode-range: ${range};`);
      }
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

// Tradutor offline: transformers.js empacotado para o navegador + o ONNX Runtime em WebAssembly
// (o modelo em si é baixado pelo app na primeira vez). Refeito só quando a versão muda.
(function vendorMt() {
  const mtOut = path.join(root, 'src', 'mt', 'vendor');
  const tf = path.join(nm, '@huggingface', 'transformers', 'package.json');
  const ortDir = path.join(nm, 'onnxruntime-web', 'dist');
  if (!fs.existsSync(tf) || !fs.existsSync(ortDir)) { console.warn('vendor: @huggingface/transformers ausente — tradutor offline indisponível nesta compilação'); return; }
  const stamp = 'transformers ' + require(tf).version + ' / ort ' + require(path.join(nm, 'onnxruntime-web', 'package.json')).version + ' / ' + require('crypto').createHash('md5').update(fs.readFileSync(path.join(__dirname, 'mt-entry.mjs'))).digest('hex').slice(0, 8);
  const stampFile = path.join(mtOut, 'VERSION.txt');
  const files = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];
  if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp && fs.existsSync(path.join(mtOut, 'transformers.js')) && files.every(f => fs.existsSync(path.join(mtOut, f)))) return;
  fs.rmSync(mtOut, { recursive: true, force: true });
  fs.mkdirSync(mtOut, { recursive: true });
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, 'mt-entry.mjs')], bundle: true, format: 'esm', platform: 'browser', minify: true, legalComments: 'eof', outfile: path.join(mtOut, 'transformers.js'), logLevel: 'warning' });
  files.forEach(f => fs.copyFileSync(path.join(ortDir, f), path.join(mtOut, f)));
  fs.writeFileSync(stampFile, stamp);
  console.log('vendor: tradutor offline (' + stamp + ') em', path.relative(root, mtOut));
})();
