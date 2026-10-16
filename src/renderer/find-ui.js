/* global App, BookText, PtBr */
// Buscar e substituir (Ctrl+F / Ctrl+H): procura no texto de todos os capítulos (ou só no capítulo aberto),
// incluindo as notas de rodapé e as legendas; mostra cada ocorrência destacada nas páginas e troca uma a
// uma ou todas de uma vez (cada troca pode ser desfeita). Correções rápidas para o livro inteiro: hífen de
// diálogo → travessão, listas com marcadores → falas com travessão, falas entre aspas → travessão e espaços
// duplos.
(function () {
  const { el, $ } = App;
  const BLOCK = 'p, h1, h2, h3, h4, h5, h6, li, td, th, figcaption, blockquote, pre, dt, dd, caption, .footnote';
  const opt = { q: '', r: '', cs: false, word: false, re: false, scope: 'book', glue: 'space' };
  let panel = null, results = [], cur = -1, err = '', timer = null;
  const ui = {};

  // ---------------------------------------------------------------- motor
  // texto de cada bloco (parágrafo, título, item, célula, legenda, nota), mesmo quando dividido em
  // vários pedaços de formatação (<i>, <b>…), para achar palavras que atravessam a formatação
  function units(root) {
    const map = new Map();
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) {
      const pe = t.parentElement;
      if (!pe || pe.closest('.comment, style, script')) continue;
      let b = pe.closest(BLOCK);
      if (!b || !root.contains(b)) b = root;
      let u = map.get(b);
      if (!u) { u = { block: b, nodes: [], starts: [], text: '' }; map.set(b, u); }
      u.starts.push(u.text.length);
      u.nodes.push(t);
      u.text += t.data;
    }
    return Array.from(map.values());
  }
  function buildRe() {
    err = '';
    if (!opt.q) return null;
    let src = opt.re ? opt.q : opt.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ \\u00a0]');
    if (opt.word) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
    try { return new RegExp(src, 'gu' + (opt.cs ? '' : 'i')); } catch (e) { err = 'Expressão regular inválida: ' + e.message; return null; }
  }
  function findAll(us, re) {
    const out = [];
    us.forEach((u, ui) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(u.text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        out.push({ u: ui, start: m.index, end: m.index + m[0].length, m: Array.from(m) });
      }
    });
    return out;
  }
  // ponto (nó de texto, deslocamento) de uma posição no texto do bloco
  function locate(u, pos, isEnd) {
    for (let i = 0; i < u.nodes.length; i++) {
      const a = u.starts[i], b = a + u.nodes[i].data.length;
      if (isEnd ? pos > a && pos <= b : pos >= a && pos < b) return [u.nodes[i], pos - a];
    }
    const last = u.nodes[u.nodes.length - 1];
    return [last, last.data.length];
  }
  const expand = (rep, m) => (opt.re ? rep.replace(/\$(\$|&|\d{1,2})/g, (x, k) => (k === '$' ? '$' : k === '&' ? m[0] : (m[Number(k)] != null ? m[Number(k)] : ''))) : rep);
  function replaceIn(u, start, end, rep) {
    let first = true;
    u.nodes.forEach((n, i) => {
      const a = u.starts[i], b = a + n.data.length;
      if (b <= start || a >= end) return;
      const s = Math.max(start, a) - a, e = Math.min(end, b) - a;
      n.data = n.data.slice(0, s) + (first ? rep : '') + n.data.slice(e);
      first = false;
    });
  }
  const scopeChapters = () => (opt.scope === 'chapter' ? [App.chapter()].filter(Boolean) : App.project.chapters);
  const parse = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d; };

  function search() {
    App.flush();
    results = [];
    const re = buildRe();
    if (re) {
      scopeChapters().forEach(c => {
        const us = units(parse(c.html));
        findAll(us, re).forEach((m, k) => {
          const t = us[m.u].text;
          results.push({ chId: c.id, title: c.title, k, before: t.slice(Math.max(0, m.start - 42), m.start), hit: t.slice(m.start, m.end), after: t.slice(m.end, m.end + 42), locked: !!c.locked });
        });
      });
    }
    if (cur >= results.length) cur = results.length - 1;
    render();
  }

  // ---------------------------------------------------------------- mostrar nas páginas
  let markTry = null;
  function markChapter(i) {
    clearTimeout(markTry);
    const r = results[i];
    if (!r || !App.live || !App.live.mark) return;
    let tries = 0;
    const run = () => {
      if (App.editorChapterId !== r.chId) return;
      const re = buildRe();
      if (!re) return;
      const ed = $('#editor');
      const us = units(ed);
      const ranges = findAll(us, re).map(m => {
        const a = locate(us[m.u], m.start, false), b = locate(us[m.u], m.end, true);
        const pa = App.live.modelPos(a[0], a[1]), pb = App.live.modelPos(b[0], b[1]);
        return pa == null || pb == null ? null : [pa, pb];
      });
      const ok = App.live.mark(ranges.filter(Boolean), ranges[r.k] ? ranges.slice(0, r.k).filter(Boolean).length : null);
      if (!ok && ++tries < 12) markTry = setTimeout(run, 400);
    };
    run();
  }
  function go(i) {
    if (!results.length) return;
    cur = (i + results.length) % results.length;
    const r = results[cur];
    if (App.view !== 'chapter' || App.chapterId !== r.chId || App.editorChapterId !== r.chId) App.setView('chapter', r.chId);
    render();
    markChapter(cur);
  }

  // ---------------------------------------------------------------- substituir
  function commit(label, touched) {
    App.editorChapterId = null;
    if (App.live) App.live.invalidate();
    App.changed(label);
    if (App.view === 'chapter') App.setView('chapter', App.chapterId);
    App.renderChapterList();
    return touched;
  }
  function replaceOne() {
    const re = buildRe();
    if (!re) return;
    if (cur < 0) { go(0); return; }
    const r = results[cur];
    if (!r) return;
    const c = App.project.chapters.find(x => x.id === r.chId);
    if (!c) return;
    if (c.locked) return App.toast(`“${c.title}” está bloqueado: desbloqueie no cadeado para substituir.`);
    App.flush();
    const root = parse(c.html);
    const us = units(root);
    const m = findAll(us, re)[r.k];
    if (!m) return search();
    replaceIn(us[m.u], m.start, m.end, expand(opt.r, m.m));
    c.html = root.innerHTML;
    commit(`Substituir “${opt.q}” por “${opt.r}”`);
    const keep = cur;
    search();
    if (results.length) go(Math.min(keep, results.length - 1)); else if (App.live) App.live.unmark();
  }
  async function replaceAll() {
    const re = buildRe();
    if (!re) return;
    App.flush();
    let n = 0, chs = 0, skipped = 0;
    scopeChapters().forEach(c => {
      const root = parse(c.html);
      const us = units(root);
      const ms = findAll(us, re);
      if (!ms.length) return;
      if (c.locked) { skipped += ms.length; return; }
      ms.slice().reverse().forEach(m => replaceIn(us[m.u], m.start, m.end, expand(opt.r, m.m)));
      c.html = root.innerHTML;
      n += ms.length; chs++;
    });
    if (!n) { App.toast(skipped ? `Nenhuma troca: as ${skipped} ocorrência(s) estão em capítulos bloqueados.` : 'Nada encontrado.'); return; }
    commit(`Substituir tudo: “${opt.q}” → “${opt.r}” (${n})`);
    App.toast(`${n} substituição(ões) em ${chs} capítulo(s).` + (skipped ? ` ${skipped} em capítulo(s) bloqueado(s) ficaram como estavam.` : '') + ' Ctrl+Alt+Z desfaz.');
    cur = -1;
    search();
    if (App.live) App.live.unmark();
  }

  // ---------------------------------------------------------------- correções rápidas (livro inteiro ou capítulo aberto)
  const glueOpt = () => (opt.glue === 'glue' ? true : opt.glue === 'space' ? false : undefined);
  function quotesToDash(html) {
    if (typeof PtBr === 'undefined') return { html, count: 0 };
    const root = parse(html);
    let count = 0;
    root.querySelectorAll('p, li').forEach(p => {
      if (p.closest('figure, table, .footnote')) return;
      if (!/^\s*[“"«„]/.test(p.textContent)) return;
      if (p.children.length) return; // com formatação interna: fica para a revisão manual
      const r = PtBr.dialogue(p.textContent, { glue: glueOpt() === true });
      if (r.changed) { p.textContent = r.text; count++; }
    });
    return { html: count ? root.innerHTML : html, count };
  }
  function doubleSpaces(html) {
    const root = parse(html);
    let count = 0;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) { const v = t.data.replace(/([^\s]) {2,}(?=\S)/g, (m, a) => { count++; return a + ' '; }); if (v !== t.data) t.data = v; }
    return { html: count ? root.innerHTML : html, count };
  }
  const QUICK = [
    { id: 'dash', label: 'Hífen de diálogo → travessão (—)', help: 'Falas que começam com hífen ou meia-risca (- Olá / – Olá) passam a começar com travessão; os incisos do narrador (“ - disse ele - ”) também. Palavras com hífen (guarda-chuva, disse-lhe), números (-5 °C, 10-20) e listas feitas com hífen ficam como estão.', run: (h, acc) => BookText.dialogueHtml(h, { glue: glueOpt(), samples: acc.samples, kept: acc.kept }) },
    { id: 'lists', label: 'Listas com marcadores (•) → falas com travessão', help: 'Cada item de lista com marcador (bolinha) vira um parágrafo de fala começando com travessão — para livros em que as falas vieram do Word como lista.', run: h => BookText.listsHtml(h, { glue: glueOpt() }) },
    { id: 'quotes', label: 'Falas entre aspas → travessão', help: 'Parágrafos que começam com fala entre aspas (“Olá”, disse ele) passam para o travessão (— Olá — disse ele).', run: quotesToDash },
    { id: 'spaces', label: 'Espaços duplos → um espaço', help: 'Dois ou mais espaços seguidos entre palavras viram um só.', run: doubleSpaces }
  ];
  async function quick(q) {
    App.flush();
    const plan = [];
    const acc = { samples: [], kept: [] };
    scopeChapters().forEach(c => { const r = q.run(c.html, c.locked ? {} : acc); if (r.count) plan.push({ c, r }); });
    const lockedHits = plan.filter(x => x.c.locked);
    const go2 = plan.filter(x => !x.c.locked);
    if (!go2.length) return App.toast(lockedHits.length ? 'Só há ocorrências em capítulos bloqueados (🔒).' : 'Nada para corrigir: nenhuma ocorrência encontrada.');
    const total = go2.reduce((n, x) => n + x.r.count, 0);
    const ok = await App.confirmPreview(q.label, `${q.help} Serão alterados ${total} trecho(s) em ${go2.length} capítulo(s)` + (lockedHits.length ? ` (${lockedHits.length} capítulo(s) bloqueado(s) ficam como estão)` : '') + ':', go2.map(x => `${x.c.title}: ${x.r.count}`)
      .concat(acc.samples.length ? ['', 'Exemplos do que muda:'].concat(acc.samples.map(t => '   ' + t + '…')) : [])
      .concat(acc.kept.length ? ['', 'Começam com hífen mas não são falas (ficam como estão):'].concat(acc.kept.map(t => '   ' + t)) : []), 'Aplicar');
    if (!ok) return;
    go2.forEach(x => { x.c.html = x.r.html; });
    commit(`${q.label} (${total})`);
    App.toast(`${total} trecho(s) corrigido(s). Ctrl+Alt+Z desfaz.`);
    if (opt.q) search();
  }

  // ---------------------------------------------------------------- painel
  function render() {
    if (!panel) return;
    ui.count.textContent = err || (!opt.q ? '' : results.length ? `${cur >= 0 ? cur + 1 : 0} de ${results.length}` : 'nada encontrado');
    ui.count.classList.toggle('bad', !!err || (!!opt.q && !results.length));
    ui.list.innerHTML = '';
    let last = null;
    results.slice(0, 600).forEach((r, i) => {
      if (r.chId !== last) { last = r.chId; ui.list.appendChild(el('div', { class: 'fd-ch', text: (r.locked ? '🔒 ' : '') + r.title + ` · ${results.filter(x => x.chId === r.chId).length}` })); }
      ui.list.appendChild(el('button', { class: 'fd-hit' + (i === cur ? ' on' : ''), onclick: () => go(i) }, [
        el('span', { class: 'muted', text: (r.before.length >= 42 ? '…' : '') + r.before }), el('mark', { text: r.hit }), el('span', { class: 'muted', text: r.after + (r.after.length >= 42 ? '…' : '') })
      ]));
    });
    if (results.length > 600) ui.list.appendChild(el('p', { class: 'muted small', text: `… e mais ${results.length - 600}. Use as setas para percorrer todas.` }));
    const on = ui.list.querySelector('.fd-hit.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function build() {
    const chk = (key, label, title) => { const i = el('input', { type: 'checkbox', checked: opt[key] }); i.addEventListener('change', () => { opt[key] = i.checked; cur = -1; search(); }); return el('label', { class: 'chk small', title: title || '' }, [i, ' ' + label]); };
    ui.q = el('input', { type: 'search', placeholder: 'Buscar no livro…', spellcheck: 'false' });
    ui.r = el('input', { type: 'text', placeholder: 'Substituir por…', spellcheck: 'false' });
    ui.count = el('span', { class: 'fd-count small' });
    ui.list = el('div', { class: 'fd-list' });
    ui.q.addEventListener('input', () => { opt.q = ui.q.value; cur = -1; clearTimeout(timer); timer = setTimeout(() => { search(); if (results.length) go(0); else if (App.live) App.live.unmark(); }, 260); });
    ui.q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); if (!results.length || ui.q.value !== opt.q) { opt.q = ui.q.value; search(); } go(cur + (e.shiftKey ? -1 : 1)); } });
    ui.r.addEventListener('input', () => { opt.r = ui.r.value; });
    ui.r.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (e.ctrlKey || e.metaKey) replaceAll(); else replaceOne(); } });
    const scope = el('select', { onchange: e => { opt.scope = e.target.value; cur = -1; search(); } }, [['book', 'Livro inteiro'], ['chapter', 'Só o capítulo aberto']].map(([v, l]) => el('option', { value: v, text: l })));
    scope.value = opt.scope;
    const glue = el('select', { onchange: e => { opt.glue = e.target.value; } }, [['space', '— Olá (com espaço)'], ['glue', '—Olá (colado)'], ['keep', 'manter o espaço do texto']].map(([v, l]) => el('option', { value: v, text: l })));
    glue.value = opt.glue;
    panel = el('div', { class: 'find-panel', role: 'dialog', 'aria-label': 'Buscar e substituir' }, [
      el('div', { class: 'fd-head' }, [el('b', { text: '🔎 Buscar e substituir' }), el('span', { class: 'muted small', text: ' Ctrl+F · Ctrl+H' }), el('button', { class: 'ghost fd-x', title: 'Fechar (Esc)', text: '✕', onclick: close })]),
      el('div', { class: 'fd-row' }, [ui.q, ui.count, el('button', { title: 'Anterior (Shift+Enter)', text: '◀', onclick: () => go(cur - 1) }), el('button', { title: 'Próxima (Enter)', text: '▶', onclick: () => go(cur + 1) })]),
      el('div', { class: 'fd-row' }, [ui.r, el('button', { text: 'Substituir', title: 'Troca a ocorrência destacada e vai para a próxima (Enter)', onclick: replaceOne }), el('button', { class: 'primary', text: 'Substituir tudo', title: 'Troca todas as ocorrências (Ctrl+Enter)', onclick: replaceAll })]),
      el('div', { class: 'fd-row wrap' }, [chk('cs', 'Maiúsculas/minúsculas'), chk('word', 'Palavra inteira'), chk('re', 'Expressão regular', 'Busca avançada: \\d número, ^ início do parágrafo, (grupo) e $1 na troca'), scope]),
      ui.list,
      el('details', { class: 'fd-quick' }, [
        el('summary', { text: 'Correções rápidas no livro (diálogos, marcadores, espaços)' }),
        el('div', { class: 'fd-row small' }, [el('span', { text: 'Travessão das falas: ' }), glue]),
        ...QUICK.map(q => el('button', { class: 'fd-qbtn', title: q.help, text: q.label, onclick: () => quick(q) }))
      ])
    ]);
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    document.body.appendChild(panel);
  }
  function open(replace) {
    if (!panel) build();
    panel.classList.add('show');
    // texto selecionado nas páginas: vira a busca
    let sel = '';
    try { const f = document.querySelector('.preview-frame'); const s = f && f.contentDocument.getSelection(); sel = s ? String(s).replace(/[\u00ad\u200b]/g, '').trim() : ''; } catch (e) { /* ok */ }
    if (sel && sel.length < 120 && !/\n/.test(sel)) { ui.q.value = sel; opt.q = sel; }
    if (App.live) App.live.onApplied = () => { if (panel.classList.contains('show') && cur >= 0) markChapter(cur); };
    search();
    const target = replace && opt.q ? ui.r : ui.q;
    target.focus();
    target.select();
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('show');
    clearTimeout(markTry);
    if (App.live) { App.live.unmark(); App.live.onApplied = null; }
  }

  App.find = { open, close, search, units, findAll, replaceIn, quick: id => quick(QUICK.find(q => q.id === id)), _opt: opt, _results: () => results };
})();
