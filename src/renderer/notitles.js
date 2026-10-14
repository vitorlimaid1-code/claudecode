/* global App, BookText */
// “Não é um título”: ao clicar num título na página aparece o botão; o título volta a ser texto corrido
// (um capítulo errado se junta ao anterior). Tudo o que foi marcado fica numa lista para reverter.
(function () {
  const { el, $, D } = App;
  const list = () => { const p = App.project; if (!Array.isArray(p.notTitles)) p.notTitles = []; return p.notTitles; };
  const clean = t => String(t || '').replace(/[­​⁠-⁤]/g, '').replace(/\s+/g, ' ').trim();
  let chip = null;

  // ---------------------------------------------------------------- botão sobre o título clicado
  function offer(hd) {
    hideChip();
    const sec = hd.closest('section[data-chapter]');
    const c = sec && App.project.chapters[Number(sec.dataset.chapter)];
    if (!c || c.locked) return;
    const isChapter = hd.classList.contains('chapter-title');
    const frame = document.querySelector('#previewFrames iframe');
    if (!frame) return;
    const fr = frame.getBoundingClientRect();
    const d = frame.contentDocument;
    const k = fr.width / (d.documentElement.clientWidth || fr.width) || 1;
    const r = hd.getBoundingClientRect();
    chip = el('div', { class: 'nt-chip' }, [
      el('button', { class: 'nt-btn', title: isChapter ? 'Este capítulo não é um capítulo: o texto se junta ao capítulo anterior' : 'Este título é texto corrido', onmousedown: e => e.preventDefault(), onclick: () => { hideChip(); if (isChapter) demoteChapter(c); else demoteHeading(c, hd); } }, [el('span', { text: '✕' }), isChapter ? ' Não é um capítulo' : ' Não é um título']),
      list().length ? el('button', { class: 'nt-list', title: 'Marcados como não título', text: '↺ ' + list().length, onmousedown: e => e.preventDefault(), onclick: () => { hideChip(); openList(); } }) : null
    ]);
    document.body.appendChild(chip);
    const x = fr.left + (r.left + r.width / 2) * k;
    const y = fr.top + r.top * k;
    chip.style.left = Math.max(8, Math.min(window.innerWidth - chip.offsetWidth - 8, x - chip.offsetWidth / 2)) + 'px';
    chip.style.top = Math.max(fr.top + 4, y - chip.offsetHeight - 8) + 'px';
    if (!d.__ntWired) { d.__ntWired = true; d.addEventListener('scroll', hideChip, true); d.addEventListener('keydown', hideChip); }
  }
  function hideChip() { if (chip) chip.remove(); chip = null; }

  // html do capítulo como modelo editável (o editor, se for o capítulo aberto)
  function withChapterDom(c, fn) {
    App.flush();
    if (App.editorChapterId === c.id && App.view === 'chapter') {
      const ed = $('#editor');
      const r = fn(ed);
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      return r;
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = c.html || '';
    const r = fn(tpl.content);
    c.html = tpl.innerHTML;
    return r;
  }

  // título interno (T1, T2, T3) -> parágrafo
  function demoteHeading(c, hd) {
    const idx = Number(hd.dataset.src);
    const text = clean(hd.textContent);
    const id = D.uid();
    const ok = withChapterDom(c, root => {
      let h = Number.isFinite(idx) ? root.children[idx] : null;
      if (!h || !/^H[2-4]$/.test(h.tagName) || clean(h.textContent) !== text) h = Array.from(root.querySelectorAll('h2, h3, h4')).find(x => clean(x.textContent) === text);
      if (!h) return false;
      const p = document.createElement('p');
      p.innerHTML = h.innerHTML;
      p.dataset.nt = id;
      list().unshift({ id, kind: 'heading', chId: c.id, tag: h.tagName.toLowerCase(), hid: h.id || '', text, at: Date.now() });
      h.replaceWith(p);
      return true;
    });
    if (!ok) return App.toast('Não encontrei este título no texto do capítulo.');
    App.changed(`“${text.slice(0, 40)}” não é título`);
    App.toast('Agora é texto corrido. Para reverter: botão ↺ na lista de capítulos.', 4000);
    renderBadge();
  }

  // capítulo -> texto do capítulo anterior (o título vira o primeiro parágrafo)
  function demoteChapter(c) {
    App.flush();
    const chs = App.project.chapters;
    const i = chs.indexOf(c);
    const id = D.uid();
    const text = clean(c.title);
    const titleP = `<p data-nt="${id}">${BookText.escapeHtml(text)}</p>`;
    if (i <= 0) {
      // primeiro capítulo: o título vira o primeiro parágrafo e o capítulo fica sem título
      list().unshift({ id, kind: 'chapter0', chId: c.id, text, numbered: c.numbered, at: Date.now() });
      c.html = titleP + (c.html || '');
      c.title = '';
      c.numbered = false;
    } else {
      const prev = chs[i - 1];
      if (prev.locked) return App.toast('O capítulo anterior está bloqueado: desbloqueie para juntar.');
      const meta = Object.assign({}, c);
      delete meta.html;
      list().unshift({ id, kind: 'chapter', chapter: meta, prevId: prev.id, text, at: Date.now() });
      prev.html = (prev.html || '') + titleP + (c.html || '');
      chs.splice(i, 1);
      if (App.chapterId === c.id) App.chapterId = prev.id;
    }
    App.editorChapterId = null;
    App.changed(`“${text.slice(0, 40)}” não é capítulo`);
    if (App.view === 'chapter') App.setView('chapter', App.chapterId);
    App.renderChapterList && App.renderChapterList();
    App.toast('O texto voltou ao fluxo do capítulo anterior. Para reverter: botão ↺ na lista de capítulos.', 4500);
    renderBadge();
  }

  // ---------------------------------------------------------------- reverter
  function findMarker(id) {
    for (const c of App.project.chapters) {
      if (!(c.html || '').includes(`data-nt="${id}"`)) continue;
      return c;
    }
    return null;
  }
  function revert(item) {
    App.flush();
    const c = findMarker(item.id);
    const L = list();
    const drop = () => { const k = L.indexOf(item); if (k >= 0) L.splice(k, 1); };
    if (!c) { drop(); App.toast('O parágrafo marcado não existe mais (foi apagado ou editado).'); render(); renderBadge(); return; }
    if (item.kind === 'heading') {
      withChapterDom(c, root => {
        const p = root.querySelector(`[data-nt="${item.id}"]`);
        if (!p) return;
        const h = document.createElement(item.tag || 'h2');
        h.innerHTML = p.innerHTML;
        if (item.hid) h.id = item.hid;
        p.replaceWith(h);
      });
    } else if (item.kind === 'chapter0') {
      withChapterDom(c, root => { const p = root.querySelector(`[data-nt="${item.id}"]`); if (p) p.remove(); });
      c.title = item.text;
      c.numbered = item.numbered !== false;
    } else {
      // separa de novo: do parágrafo marcado até o próximo capítulo juntado (ou o fim)
      let moved = '';
      withChapterDom(c, root => {
        const p = root.querySelector(`[data-nt="${item.id}"]`);
        if (!p) return;
        const parts = [];
        let n = p.nextSibling;
        while (n && !(n.nodeType === 1 && n.dataset && n.dataset.nt && L.some(x => x.id === n.dataset.nt && x.kind === 'chapter'))) {
          const nx = n.nextSibling;
          parts.push(n.nodeType === 1 ? n.outerHTML : n.nodeType === 3 ? BookText.escapeHtml(n.nodeValue) : '');
          n.remove();
          n = nx;
        }
        p.remove();
        moved = parts.join('');
      });
      const ch = Object.assign({ locked: false, style: {}, separator: 'default', openingImage: null }, item.chapter, { title: item.text, html: moved || '<p><br></p>' });
      if (App.project.chapters.some(x => x.id === ch.id)) ch.id = D.uid();
      const at = App.project.chapters.indexOf(c);
      App.project.chapters.splice(at + 1, 0, ch);
    }
    drop();
    App.editorChapterId = null;
    App.changed(`“${item.text.slice(0, 40)}” voltou a ser ${item.kind === 'heading' ? 'título' : 'capítulo'}`);
    if (App.view === 'chapter') App.setView('chapter', App.chapterId);
    App.renderChapterList && App.renderChapterList();
    render();
    renderBadge();
  }

  // ---------------------------------------------------------------- lista
  let listBox = null;
  function render() {
    if (!listBox) return;
    listBox.innerHTML = '';
    const L = list();
    if (!L.length) { listBox.appendChild(el('p', { class: 'muted', text: 'Nada marcado. Clique num título nas páginas e use “Não é um título”.' })); return; }
    L.forEach(item => {
      const where = App.project.chapters.find(c => c.id === (item.kind === 'chapter' ? item.prevId : item.chId)) || findMarker(item.id);
      listBox.appendChild(el('div', { class: 'nt-row' }, [
        el('span', { class: 'nt-kind', text: item.kind === 'heading' ? (item.tag === 'h3' ? 'Subtítulo' : item.tag === 'h4' ? 'Intertítulo' : 'Título') : 'Capítulo' }),
        el('span', { class: 'nt-text' }, [el('b', { text: item.text || '(sem texto)' }), el('small', { class: 'muted', text: where ? ' · em “' + (where.title || 'sem título') + '”' : '' })]),
        el('button', { text: '↺ Reverter', onclick: () => revert(item) })
      ]));
    });
  }
  function openList() {
    listBox = el('div', { class: 'nt-listbox' });
    render();
    App.modal({ title: 'Marcados como não título', body: el('div', {}, [el('p', { class: 'muted', text: 'Estes títulos foram transformados em texto corrido. “Reverter” devolve o título (ou separa o capítulo de novo) no mesmo lugar.' }), listBox]), onClose: () => { listBox = null; } });
  }
  function renderBadge() {
    const actions = document.querySelector('.chapters-head .ch-actions');
    if (!actions) return;
    let b = $('#notTitlesBtn');
    const n = list().length;
    if (!b) { b = el('button', { id: 'notTitlesBtn', class: 'icon-btn', title: 'Marcados como não título (reverter)', onclick: openList }); actions.insertBefore(b, actions.firstChild); }
    b.textContent = '↺ ' + n;
    b.style.display = n ? '' : 'none';
  }

  App.notTitles = { offer, hideChip, demoteHeading, demoteChapter, revert, openList, renderBadge, list };
  App.hooks.afterChange.push(() => renderBadge());
  document.addEventListener('mousedown', e => { if (chip && !chip.contains(e.target)) hideChip(); });
})();
