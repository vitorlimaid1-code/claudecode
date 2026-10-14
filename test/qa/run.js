// Bateria de qualidade (npm run qa): roda o app de verdade e confere o resultado.
//  1. Gera o PDF de todos os modelos e confere cada um (test/qa/verify.py): formato de corte e folha,
//     sangria, páginas em branco, espelhamento, texto completo (nenhuma palavra perdida ou repetida).
//  2. Exporta DOCX, ODT e EPUB com os recursos de diagramação (colunas, caixas, sobreposições, tabela
//     colada, página sangrada) e confere que nada some.
// Requer: Python 3 e poppler-utils (pdfinfo, pdftotext, pdfimages). Em Linux sem tela: xvfb-run -a npm run qa
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const electron = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const OUT = process.env.QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'cvh-qa-'));
fs.mkdirSync(path.join(OUT, 'models'), { recursive: true });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) failed++; };

function runApp(script, label, timeoutMs) {
  const steps = path.join(OUT, label + '-steps.json');
  fs.writeFileSync(steps, JSON.stringify([script]));
  const args = [ROOT];
  if (process.platform === 'linux') args.push('--no-sandbox');
  args.push('--user-data-dir=' + path.join(OUT, 'profile-' + label)); // perfil próprio e limpo
  const r = spawnSync(electron, args, {
    env: { ...process.env, SCREENSHOT_STEPS: steps, SCREENSHOT_OUT: path.join(OUT, label + '.png'), SCREENSHOT_WAIT: '300' },
    encoding: 'utf8', timeout: timeoutMs || 600000, maxBuffer: 64 * 1024 * 1024
  });
  const line = (r.stdout || '').split('\n').find(l => l.startsWith('JS_RESULT'));
  if (!line) { console.error((r.stdout || '').slice(-2000), (r.stderr || '').slice(-2000)); return null; }
  let v = JSON.parse(line.split(' ').slice(2).join(' '));
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* texto */ } }
  return v;
}

// 1) modelos
const gen = fs.readFileSync(path.join(__dirname, 'gen-models.js'), 'utf8').replace(/__OUT__/g, path.join(OUT, 'models').replace(/\\/g, '\\\\'));
const manifest = runApp(gen, 'models');
if (!Array.isArray(manifest)) { ok(false, 'geração dos PDFs dos modelos'); }
else {
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const v = spawnSync(py, [path.join(__dirname, 'verify.py'), path.join(OUT, 'manifest.json')], { encoding: 'utf8' });
  process.stdout.write(v.stdout || '');
  if (v.error) console.error('Python 3 e poppler-utils são necessários para conferir os PDFs:', v.error.message);
  ok(!v.error && /TUDO OK/.test(v.stdout || ''), `${manifest.length} modelos de PDF conferidos`);
}

// 2) exportações editáveis e digitais
const ex = fs.readFileSync(path.join(__dirname, 'gen-exports.js'), 'utf8').replace(/__OUT__/g, OUT.replace(/\\/g, '\\\\'));
const er = runApp(ex, 'exports', 180000);
ok(er && !(er.errs || []).length, 'exportações sem erros no app');
const unzip = (file, name) => {
  // leitura mínima de ZIP (arquivos DOCX/ODT/EPUB): procura a entrada e descompacta
  const buf = fs.readFileSync(file);
  let p = 0;
  while ((p = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), p)) >= 0) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const n = buf.slice(p + 30, p + 30 + nlen).toString();
    const start = p + 30 + nlen + xlen;
    if (n === name) { const data = buf.slice(start, start + csize); return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8'); }
    p = start + csize;
  }
  return '';
};
const must = ['PARAGRAFO EM COLUNA UM', 'PARAGRAFO EM COLUNA DOIS', 'FRASE DA CAIXA DE TEXTO', 'TEXTO SOBRE A IMAGEM', 'CELULA AZUL', 'TITULO DO BOX'];
for (const [f, entry] of [['out.docx', 'word/document.xml'], ['out.odt', 'content.xml']]) {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) { ok(false, f + ' gerado'); continue; }
  const text = unzip(p, entry).replace(/<[^>]+>/g, ' ');
  const miss = must.filter(m => !text.includes(m));
  ok(!miss.length, `${f}: todo o texto presente${miss.length ? ' (faltou: ' + miss.join(', ') + ')' : ''}`);
  ok(!/Legenda de teste/.test(text), `${f}: bloco cinza de teste não exportado`);
}
const epub = path.join(OUT, 'out.epub');
if (fs.existsSync(epub)) {
  const ch = unzip(epub, 'OEBPS/chap002.xhtml');
  ok(/class="ov-wrap"/.test(ch) && /fig-ov ov-caixa-branca/.test(ch), 'EPUB: caixa sobre a imagem');
  ok(/<div class="cols"/.test(ch) && /<div class="tframe"/.test(ch), 'EPUB: colunas e caixa de texto');
  ok(/<td style="background-color/.test(ch), 'EPUB: tabela com a formatação original');
  ok(/bleed-page/.test(ch) && !/ph-block/.test(ch), 'EPUB: página sangrada e sem bloco de teste');
} else ok(false, 'EPUB gerado');

console.log(failed ? `\n${failed} verificação(ões) falharam. Arquivos em ${OUT}` : `\nTUDO OK — arquivos em ${OUT}`);
process.exit(failed ? 1 : 0);
