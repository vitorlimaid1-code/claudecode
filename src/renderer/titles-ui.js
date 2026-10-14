/* global App, BookText */
// Revisar títulos: mostra os capítulos e todos os títulos internos (e parágrafos que parecem título) numa
// lista só. Cada linha pode virar capítulo, título de seção, subtítulo, intertítulo ou texto normal — para
// corrigir títulos identificados errado na importação. O sumário automático segue o resultado.
(function () {
  const { el, $, D } = App;
  const ROLES = [['chapter', 'Capítulo'], ['h2', 'Título de seção (T1)'], ['h3', 'Subtítulo (T2)'], ['h4', 'Intertítulo (T3)'], ['p', 'Texto normal']];
  const clean = t => String(t || '').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();

  // linhas: capítulos + títulos internos + parágrafos curtos com cara de título
  function collect(showSuspects) {
    App.flush();
    const rows = [];
    App.project.chapters.forEach((c, ci) => {
      rows.push({ kind: 'chapter', c, ci, text: c.title || '', role: 'chapter', orig: 'chapter', numbered: c.numbered !== false });
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      Array.from(tpl.content.children).forEach((n, bi) => {
        const t = clean(n.textContent);
        if (!t) return;
        if (/^H[2-4]$/.test(n.tagName)) rows.push({ kind: 'block', c, ci, bi, text: t, role: n.tagName.toLowerCase(), orig: n.tagName.toLowerCase() });
        else if (showSuspects && n.tagName === 'P' && !n.classList.length && t.length <= 110 && (BookText.chapterMark(t, 'P') || (BookText.isTitleLike(n) && (n.querySelector('b, strong') || /center/.test(n.getAttribute('style') || '') || (t === t.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(t)))))) {
          rows.push({ kind: 'block', c, ci, bi, text: t, role: 'p', orig: 'p', suspect: true });
        }
      });
    });
    return rows;
  }

  // sugestão automática: “CAPÍTULO N” / números em sequência viram capítulos; o resto, títulos de seção
  function suggest(rows) {
    const marks = rows.filter(r => BookText.chapterMark(r.text, r.kind === 'chapter' ? 'H1' : r.orig.toUpperCase()));
    if (marks.length < 2) { App.toast('Nenhuma sequência de “CAPÍTULO 1, 2…” (ou I, II…) encontrada nos títulos.', 4500); return false; }
    rows.forEach((r, i) => {
      if (r.c.locked) return;
      const mk = BookText.chapterMark(r.text, r.kind === 'chapter' ? 'H1' : r.orig.toUpperCase());
      if (mk) { r.role = 'chapter'; return; }
      // o nome logo depois de “CAPÍTULO 3” é o título do mesmo capítulo
      const prev = rows[i - 1];
      if (prev && prev.role === 'chapter' && BookText.chapterMark(prev.text, 'H1') && !BookText.chapterMark(prev.text, 'H1').title && prev.c === r.c) { r.role = 'title-of-prev'; return; }
      if (r.kind === 'chapter' && BookText.SPECIAL_RE.test(r.text)) { r.role = 'chapter'; r.numbered = false; return; }
      if (r.kind === 'chapter' && i > 0) r.role = 'h2';
    });
    return true;
  }

  function apply(rows) {
    App.commit('Antes da revisão de títulos');
    const byChapter = new Map();
    rows.forEach(r => { if (!byChapter.has(r.c)) byChapter.set(r.c, []); byChapter.get(r.c).push(r); });
    const out = [];
    let cur = null;
    const newChapter = (base, title, numbered) => {
      cur = base ? Object.assign(base, { title, numbered, html: '' }) : { id: D.uid(), title, numbered, html: '', locked: false, style: {}, separator: 'default', openingImage: null };
      cur._parts = [];
      out.push(cur);
    };
    App.project.chapters.forEach(c => {
      const rs = byChapter.get(c) || [];
      const src = c.html || '';
      const head = rs.find(r => r.kind === 'chapter');
      if (c.locked) { cur = c; cur._parts = null; out.push(c); return; }
      // o próprio capítulo
      let takeTitle = null;
      if (!head || head.role === 'chapter' || !cur || !cur._parts) {
        newChapter(c, clean(head ? head.text : c.title) || 'Sem título', head ? head.numbered : c.numbered);
        const mk = head && BookText.chapterMark(head.text, 'H1');
        if (mk && !mk.title) takeTitle = cur;
      } else cur._parts.push(head.role === 'p' ? `<p>${BookText.escapeHtml(head.text)}</p>` : `<${head.role}>${BookText.escapeHtml(head.text)}</${head.role}>`);
      const tpl = document.createElement('template');
      tpl.innerHTML = src;
      const kids = Array.from(tpl.content.childNodes);
      const blockRows = new Map(rs.filter(r => r.kind === 'block').map(r => [r.bi, r]));
      let bi = -1;
      kids.forEach(n => {
        if (n.nodeType !== 1) { if (cur._parts) cur._parts.push(n.nodeType === 3 ? BookText.escapeHtml(n.nodeValue) : ''); return; }
        bi++;
        const r = blockRows.get(bi);
        if (r && r.role === 'title-of-prev' && takeTitle) { takeTitle.title = r.text; takeTitle.numbered = true; takeTitle = null; return; }
        takeTitle = null;
        if (r && r.role === 'chapter') {
          const mk = BookText.chapterMark(r.text, r.orig.toUpperCase());
          newChapter(null, mk && mk.title ? mk.title : r.text, !!(mk && mk.title));
          if (mk && !mk.title) takeTitle = cur;
          return;
        }
        if (r && r.role !== r.orig) {
          const tag = r.role === 'title-of-prev' ? r.orig : r.role;
          const e = document.createElement(tag);
          e.innerHTML = n.innerHTML;
          if (n.getAttribute('style')) e.setAttribute('style', n.getAttribute('style'));
          cur._parts.push(e.outerHTML);
          return;
        }
        cur._parts.push(n.outerHTML);
      });
    });
    out.forEach(c => { if (c._parts) c.html = c._parts.join('') || '<p><br></p>'; delete c._parts; });
    const before = App.project.chapters.length;
    App.project.chapters = out;
    App.editorChapterId = null;
    App.changed(`Revisão de títulos (${before} → ${out.length} capítulos)`);
    if (!out.find(c => c.id === App.chapterId)) App.chapterId = out[0] && out[0].id;
    App.setView(App.view === 'chapter' ? 'chapter' : App.view, App.chapterId);
    App.toast(`Títulos aplicados: ${out.length} capítulo(s). O sumário automático segue os novos títulos.`, 4500);
  }

  function open() {
    let showSuspects = true;
    let rows = collect(showSuspects);
    const list = el('div', { class: 'titles-list' });
    const draw = () => {
      list.innerHTML = '';
      rows.forEach((r, i) => {
        const locked = r.c.locked;
        const sel = el('select', { disabled: locked || (r.kind === 'chapter' && i === 0) });
        ROLES.forEach(([k, label]) => sel.appendChild(el('option', { value: k, text: label })));
        if (r.role === 'title-of-prev') sel.appendChild(el('option', { value: 'title-of-prev', text: 'Nome do capítulo acima' }));
        sel.value = r.role;
        sel.addEventListener('change', () => { r.role = sel.value; row.className = rowClass(); });
        const txt = el('input', { type: 'text', value: r.text, disabled: locked || r.kind !== 'chapter' });
        txt.addEventListener('input', () => { r.text = txt.value; });
        const num = r.kind === 'chapter' ? el('label', { class: 'chk small', title: 'Numerar (Capítulo 1, 2…)' }, [el('input', { type: 'checkbox', checked: r.numbered, disabled: locked, onchange: e => { r.numbered = e.target.checked; } }), ' nº']) : el('span');
        const rowClass = () => 'tl-row' + (r.kind === 'chapter' ? ' is-ch' : '') + (r.role !== r.orig ? ' changed' : '') + (r.suspect ? ' suspect' : '') + (locked ? ' locked' : '');
        const row = el('div', { class: rowClass() }, [sel, txt, num, el('span', { class: 'tl-where muted small', text: r.kind === 'chapter' ? (locked ? '🔒' : '') : (r.suspect ? 'parágrafo' : '') })]);
        list.appendChild(row);
      });
    };
    draw();
    const susp = el('input', { type: 'checkbox', checked: showSuspects });
    susp.addEventListener('change', () => { showSuspects = susp.checked; rows = collect(showSuspects); draw(); });
    App.modal({
      title: 'Revisar títulos e capítulos', wide: true,
      body: el('div', {}, [
        el('p', { class: 'muted', text: 'Cada linha é um capítulo ou um título dentro do texto. Mude a função das linhas identificadas errado: um título pode virar capítulo (o texto seguinte vai com ele), um capítulo pode virar título de seção ou texto (o conteúdo se junta ao capítulo anterior). O sumário automático usa estes títulos.' }),
        el('div', { class: 'inline wrap', style: 'margin: 6px 0 10px' }, [
          el('button', { text: '✨ Sugerir pelo padrão “CAPÍTULO 1 / I”', onclick: () => { if (suggest(rows)) draw(); } }),
          el('label', { class: 'chk small' }, [susp, ' Mostrar parágrafos curtos que parecem título'])
        ]),
        list
      ]),
      buttons: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, onClick: () => apply(rows) }]
    });
  }

  App.titles = { open, collect, suggest, apply };
  const init = () => {
    const actions = document.querySelector('.chapters-head .ch-actions');
    const nav = $('#navTitles');
    if (nav && !nav.__wired) { nav.__wired = true; nav.addEventListener('click', open); }
    if (actions && !$('#reviewTitles')) actions.insertBefore(el('button', { id: 'reviewTitles', class: 'icon-btn', title: 'Revisar títulos e capítulos (corrigir títulos identificados errado)', text: 'Aa', onclick: open }), actions.firstChild);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
