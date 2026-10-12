/*
 * Interpreta uma ficha catalográfica colada (texto pronto, vindo do bibliotecário, de PDF ou Word) e
 * separa as mesmas partes que a ficha montada pelos campos: cabeçalho CIP, número de chamada (Cutter),
 * entrada (autor), parágrafos recuados (título, imprenta, descrição física, notas, ISBN), assuntos,
 * índices para catálogo sistemático, classificação (CDD/CDU) e bibliotecário (CRB).
 * Assim, a ficha colada sai com a mesma organização visual do modelo escolhido.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CatalogParse = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const HEAD = /dados\s+internacionais\s+de\s+cataloga|c[âa]mara\s+brasileira\s+do\s+livro|^\s*\(?cip\)?\s*$|^\s*ficha\s+catalogr[áa]fica\s*$/i;
  const LIB = /ficha\s+(catalogr[áa]fica\s+)?elaborada|bibliotec[áa]ri[oa]|\bCRB[\s.-]*\d|\bCRB\s*[-–]?\s*\d/i;
  const CLASS = /^\s*(CDD|CDU)\b|^\s*\d{3}(\.\d+)?\s*$/i;
  const INDEX = /^\s*[ÍI]ndices?\s+para\s+cat[áa]logo\s+sistem[áa]tico/i;
  const SUBJ = /^\s*1\s*[.)]\s+\S/;
  const CUTTER = /^[A-Z][a-z]?\d{1,4}[a-z]{0,2}\d?$/;

  const indentOf = l => { const m = /^[ \t]*/.exec(l)[0]; return m.replace(/\t/g, '    ').length; };

  function parse(text) {
    const raw = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[ \t]+$/gm, '');
    const lines = raw.split('\n');
    const out = { ok: false, head: false, cutter: '', entry: '', paras: [], subjects: '', indices: [], cls: [], librarian: [] };
    // 1) cabeçalho, bibliotecário, classificação e índices saem das linhas do corpo
    const body = [];
    let inIndex = false;
    lines.forEach(l => {
      const t = l.trim();
      if (!t) { body.push(''); return; }
      if (HEAD.test(t)) { out.head = true; return; }
      if (LIB.test(t)) { out.librarian.push(t); return; }
      if (INDEX.test(t)) { inIndex = true; out.indices.push(t); return; }
      if (inIndex) { out.indices.push(t); return; }
      if ((CLASS.test(t) || /\bCD[DU][\s:–-]*\d/i.test(t)) && /CDD|CDU/i.test(t) && !SUBJ.test(t)) { out.cls.push(t.split(/\s{3,}|\t+/).map(x => x.trim()).filter(Boolean)); return; }
      body.push(l);
    });
    while (body.length && !body[0].trim()) body.shift();
    while (body.length && !body[body.length - 1].trim()) body.pop();
    if (!body.length) return out;
    // 2) número de chamada (Cutter): numa linha própria ou antes da entrada ("S586a   Silva, João")
    let first = body[0];
    const ft = first.trim();
    if (CUTTER.test(ft) && body.length > 1) { out.cutter = ft; body.shift(); while (body.length && !body[0].trim()) body.shift(); first = body[0]; }
    else {
      const m = /^\s*([A-Z][a-z]?\d{1,4}[a-z]{0,2}\d?)(\s{2,}|\t+)(\S.*)$/.exec(first);
      if (m && CUTTER.test(m[1])) { out.cutter = m[1]; body[0] = ' '.repeat(indentOf(first) + m[1].length + m[2].replace(/\t/g, '    ').length) + m[3]; first = body[0]; }
    }
    // linhas soltas do número de chamada no começo de outras linhas (ex.: "869.3" alinhado à esquerda) ficam na entrada
    // 3) parágrafos: linha em branco ou recuo maior que o da entrada começa um parágrafo; recuo igual ou menor continua
    const e0 = indentOf(first);
    const hasIndent = body.some((l, i) => i > 0 && l.trim() && indentOf(l) > e0 + 1);
    const paras = [];
    let cur = null;
    body.forEach((l, i) => {
      const t = l.trim();
      if (!t) { cur = null; return; }
      const startsNew = i === 0 || !cur || (hasIndent ? indentOf(l) > e0 + 1 : /[.:]$/.test(cur.text) || !/^[a-zà-ú(\[]/.test(t)) || SUBJ.test(t) || /^ISBN/i.test(t);
      if (startsNew) { cur = { text: t }; paras.push(cur); }
      else cur.text += (/-$/.test(cur.text) && !/\s-$/.test(cur.text) ? '' : ' ') + t;
    });
    if (!paras.length) return out;
    out.entry = paras.shift().text;
    const si = paras.findIndex(p => SUBJ.test(p.text));
    if (si >= 0) { out.subjects = paras.slice(si).map(p => p.text).join(' '); paras.splice(si); }
    out.paras = paras.map(p => p.text);
    out.ok = !!out.entry;
    return out;
  }

  return { parse };
});
