/* Passos extras de paginação comuns à prévia e à exportação.
   Ajuste da última página: se um capítulo termina com poucas linhas sozinhas na última página,
   o capítulo é levemente encolhido (entreletra/espaço entre palavras um pouco menores); se não
   resolver, é levemente expandido. Capítulos começam em página nova, então cada ajuste só mexe
   no próprio capítulo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LayoutPasses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  // o ajuste salvo só vale enquanto o capítulo e a diagramação não mudarem
  function chapterHash(project, c) {
    const s = project.settings || {};
    return hash([c.html, JSON.stringify(c.style || {}), JSON.stringify(s.styles || {}), s.pageWidth, s.pageHeight, s.marginTop, s.marginBottom, s.marginInner, s.marginOuter, s.baselineGrid, s.fineJustify, s.notesMode, s.hyphenate].join('|'));
  }
  function savedAdjust(project) {
    const out = {};
    const saved = project.layoutAdjust || {};
    (project.chapters || []).forEach(c => {
      const a = saved[c.id];
      if (a && a.mode && a.hash === chapterHash(project, c)) out[c.id] = a.mode;
    });
    return out;
  }
  function storeAdjust(project, adjust) {
    const out = {};
    (project.chapters || []).forEach(c => { if (adjust[c.id]) out[c.id] = { mode: adjust[c.id], hash: chapterHash(project, c) }; });
    project.layoutAdjust = out;
    return out;
  }
  // run(opts) pagina de novo (recarregando a página) e devolve o relatório; better(a, b) = a é melhor que b
  async function lastPageAdjust(info, baseOpts, run, better) {
    let cur = info, curOpts = baseOpts;
    for (let round = 0; round < 2; round++) {
      const short = cur.shortEnds || [];
      const next = Object.assign({}, curOpts.adjust || {});
      let changed = false;
      short.forEach(s => {
        if (!s.id) return;
        if (!next[s.id]) { next[s.id] = 'shrink'; changed = true; } else if (next[s.id] === 'shrink') { next[s.id] = 'expand'; changed = true; }
      });
      if (!changed) break;
      const o = Object.assign({}, curOpts, { adjust: next });
      const r = await run(o);
      if (better(cur, r)) {
        // a paginação ajustada ficou pior (texto ou nota perdida): volta à anterior
        return { info: await run(curOpts), opts: curOpts };
      }
      cur = r;
      curOpts = o;
    }
    return { info: cur, opts: curOpts };
  }
  return { hash, chapterHash, savedAdjust, storeAdjust, lastPageAdjust };
});
