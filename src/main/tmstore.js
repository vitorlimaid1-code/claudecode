// Livros de referência da tradução (memória de tradução): pares original + tradução enviados pelo
// usuário, alinhados parágrafo a parágrafo e guardados na pasta de dados do app. O tradutor consulta a
// memória em todos os motores: traduções idênticas são reaproveitadas, os nomes seguem o glossário e a
// revisão por IA recebe exemplos do jeito de traduzir da editora.
const fs = require('fs');
const path = require('path');
const K = require('../shared/mtkit');

function createTmStore(dir) {
  const idxFile = path.join(dir, 'referencias.json');
  const readIdx = () => { try { return Object.assign({ refs: [], glossary: '', use: true }, JSON.parse(fs.readFileSync(idxFile, 'utf8'))); } catch (e) { return { refs: [], glossary: '', use: true }; } };
  const writeIdx = o => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(idxFile, JSON.stringify(o, null, 1)); };
  const refFile = id => path.join(dir, 'ref-' + String(id).replace(/[^\w-]/g, '') + '.json');
  let mem = null;

  function list() {
    const o = readIdx();
    return { refs: o.refs, glossary: o.glossary, use: o.use !== false, segments: o.refs.reduce((a, r) => a + (r.pairs || 0), 0) };
  }
  // src/tgt: capítulos, cada um uma lista de parágrafos (texto)
  function add({ name, src, tgt, srcName, tgtName }) {
    const pairs = K.alignBook(src || [], tgt || []);
    if (pairs.length < 3) return { error: 'não foi possível alinhar os dois livros (confira se a tradução corresponde ao original).' };
    const learned = K.learnGlossary(pairs);
    const id = Date.now().toString(36);
    const lang = K.detectLang(pairs.slice(0, 60).map(p => p[0]).join(' '));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(refFile(id), JSON.stringify({ pairs, glossary: learned }));
    const o = readIdx();
    o.refs.push({ id, name: name || srcName || 'Referência', srcName, tgtName, pairs: pairs.length, glossary: learned.length, lang, date: new Date().toISOString() });
    writeIdx(o);
    mem = null;
    return { id, pairs: pairs.length, glossary: learned.slice(0, 30), lang, sample: pairs.filter(p => p[0].length > 60).slice(0, 3) };
  }
  function remove(id) {
    const o = readIdx();
    o.refs = o.refs.filter(r => r.id !== id);
    writeIdx(o);
    try { fs.unlinkSync(refFile(id)); } catch (e) { /* já não existia */ }
    mem = null;
    return list();
  }
  function setOptions(patch) {
    const o = readIdx();
    if (patch.glossary !== undefined) o.glossary = String(patch.glossary || '');
    if (patch.use !== undefined) o.use = !!patch.use;
    writeIdx(o);
    mem = null;
    return list();
  }
  // memória com todas as referências + glossário do usuário (que tem a palavra final)
  function memory() {
    if (mem) return mem;
    const o = readIdx();
    let pairs = [], learned = [];
    o.refs.forEach(r => { try { const j = JSON.parse(fs.readFileSync(refFile(r.id), 'utf8')); pairs = pairs.concat(j.pairs || []); learned = learned.concat(j.glossary || []); } catch (e) { /* referência apagada */ } });
    const user = K.parseGlossary(o.glossary);
    const userKeys = new Set(user.map(g => g[0].toLowerCase()));
    const gl = user.concat(learned.filter(g => !userKeys.has(String(g[0]).toLowerCase())).map(g => [g[0], g[1]]));
    mem = Object.assign(K.createMemory(o.use === false ? [] : pairs, o.use === false ? user : gl), { use: o.use !== false });
    return mem;
  }
  return { list, add, remove, setOptions, memory };
}

module.exports = { createTmStore };
