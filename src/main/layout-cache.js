// Cache em disco das páginas já paginadas (por trecho: pré-textuais, cada capítulo, páginas finais).
// Reabrir um livro grande, voltar a uma versão anterior de um capítulo ou exportar logo depois da prévia
// não pagina de novo o que já foi paginado com o mesmo texto e o mesmo visual.
// As imagens (data URLs) não são gravadas no cache: viram uma referência ao id da imagem e voltam do
// projeto na leitura (o cache fica pequeno e uma imagem trocada nunca aparece velha).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function hashText(str) { let h = 5381, g = 52711; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h = ((h << 5) + h + c) | 0; g = ((g << 5) + g ^ c) | 0; } return (h >>> 0).toString(36) + (g >>> 0).toString(36) + str.length.toString(36); }

function createLayoutCache(dir, version, limitMB) {
  const LIMIT = (limitMB || 400) * 1024 * 1024;
  const commonOf = new WeakMap();
  let puts = 0;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ok */ }

  // o que muda o resultado da paginação além do texto do trecho: estilos, tipografia, fontes, página
  function common(meta) {
    if (commonOf.has(meta)) return commonOf.get(meta);
    const c = hashText([version, meta.css || '', JSON.stringify(meta.typo || {}), meta.fontFaceCss || '', JSON.stringify(meta.fonts || []), JSON.stringify(meta.page || {}), JSON.stringify(meta.chapterIds || [])].join('\u0001'));
    commonOf.set(meta, c);
    return c;
  }
  function key(meta, html, options) {
    return hashText(common(meta) + '\u0002' + html + '\u0002' + JSON.stringify(options || {}));
  }
  const file = k => path.join(dir, k + '.json.gz');
  // data URLs das imagens <-> referência pelo id
  const MARK = id => `\u0000A:${id}\u0000`;
  function strip(str, assets) {
    if (!str || str.indexOf('data:') < 0) return str;
    for (const id in assets) {
      const du = assets[id] && assets[id].dataUrl;
      if (du && du.length > 120 && str.indexOf(du) >= 0) str = str.split(du).join(MARK(id));
    }
    return str;
  }
  function restore(str, assets) {
    if (!str || str.indexOf('\u0000A:') < 0) return str;
    let ok = true;
    const out = str.replace(/\u0000A:([^\u0000]+)\u0000/g, (m, id) => { const a = assets[id]; if (!a || !a.dataUrl) { ok = false; return ''; } return a.dataUrl; });
    return ok ? out : null;
  }

  async function get(k, assets) {
    try {
      const buf = await fs.promises.readFile(file(k));
      const res = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
      res.pagesHtml = (res.pagesHtml || []).map(h => restore(h, assets));
      res.css = (res.css || []).map(h => restore(h, assets));
      if (res.pagesHtml.some(h => h === null) || res.css.some(h => h === null)) return null;
      res.fromCache = true;
      // marca de uso (o que não é usado há mais tempo sai primeiro quando o cache enche)
      const now = new Date();
      fs.promises.utimes(file(k), now, now).catch(() => {});
      return res;
    } catch (e) { return null; }
  }
  async function put(k, res, assets) {
    if (!res || !res.complete || !res.pagesHtml) return;
    try {
      const data = Object.assign({}, res, { pagesHtml: res.pagesHtml.map(h => strip(h, assets)), css: (res.css || []).map(h => strip(h, assets)) });
      const buf = zlib.gzipSync(Buffer.from(JSON.stringify(data), 'utf8'), { level: 4 });
      await fs.promises.writeFile(file(k), buf);
      if (++puts % 20 === 0) trim().catch(() => {});
    } catch (e) { /* cache é só aceleração: falhas são ignoradas */ }
  }
  async function trim() {
    const names = (await fs.promises.readdir(dir)).filter(n => n.endsWith('.json.gz'));
    const st = await Promise.all(names.map(async n => { try { const s = await fs.promises.stat(path.join(dir, n)); return { n, size: s.size, t: s.mtimeMs }; } catch (e) { return null; } }));
    const list = st.filter(Boolean).sort((a, b) => a.t - b.t);
    let total = list.reduce((a, x) => a + x.size, 0);
    for (const x of list) { if (total <= LIMIT) break; try { await fs.promises.unlink(path.join(dir, x.n)); total -= x.size; } catch (e) { /* ok */ } }
  }
  async function clear() {
    try { for (const n of await fs.promises.readdir(dir)) await fs.promises.unlink(path.join(dir, n)).catch(() => {}); } catch (e) { /* ok */ }
  }
  return { key, get, put, trim, clear };
}

module.exports = { createLayoutCache };
