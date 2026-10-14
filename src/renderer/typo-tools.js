/* global App */
// Ferramentas do editor para o acabamento editorial: termos do índice remissivo, referências cruzadas
// (“ver Figura 3, p. 41”) e normas ABNT (referências NBR 6023, citações NBR 10520).
(function () {
  const { el, $, D } = App;
  const editor = () => $('#editor');
  const onInput = () => editor().dispatchEvent(new Event('input', { bubbles: true }));
  const locked = () => { const c = App.chapter(); if (c && c.locked) { App.toast('Capítulo bloqueado: desbloqueie no cadeado.'); return true; } return false; };
  const ensureEditorSaved = () => { if (App.flush) App.flush(); };

  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor().contains(sel.anchorNode)) return null;
    const range = sel.getRangeAt(0).cloneRange();
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    return { sel, range, node };
  }
  function restore(info) { editor().focus(); info.sel.removeAllRanges(); info.sel.addRange(info.range); }

  // Percorre o HTML de todos os capítulos (o aberto no editor é lido/escrito direto no editor)
  function eachChapterDom(fn, opts) {
    opts = opts || {};
    ensureEditorSaved();
    let changed = 0;
    App.project.chapters.forEach(c => {
      if (opts.skipLocked && c.locked) return;
      const live = c.id === App.editorChapterId && App.view === 'chapter';
      if (live) { const n = fn(editor(), c); if (n) { changed += n; onInput(); } return; }
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      const n = fn(tpl.content, c);
      if (n) { c.html = tpl.innerHTML; changed += n; }
    });
    return changed;
  }

  // ================================================================ índice remissivo
  const norm = s => String(s || '').trim();
  function terms() {
    const map = new Map();
    eachChapterDom(root => {
      root.querySelectorAll('span.ix[data-ix]').forEach(x => {
        const t = norm(x.dataset.ix);
        const k = t.toLowerCase();
        const e = map.get(k) || { term: t, count: 0, subs: new Map() };
        e.count += 1;
        if (x.dataset.ixsub) e.subs.set(x.dataset.ixsub.toLowerCase(), x.dataset.ixsub);
        map.set(k, e);
      });
      return 0;
    });
    return [...map.values()].sort((a, b) => a.term.localeCompare(b.term, 'pt-BR', { sensitivity: 'base' }));
  }
  function wrapRange(range, term, sub) {
    const span = document.createElement('span');
    span.className = 'ix';
    span.dataset.ix = term;
    if (sub) span.dataset.ixsub = sub;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    return span;
  }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // marca todas as ocorrências (palavra inteira, sem diferenciar maiúsculas) que ainda não estão marcadas
  function markAll(text, term, sub) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(text)}(?![\\p{L}\\p{N}])`, 'giu');
    return eachChapterDom(root => {
      let n = 0;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: t => (t.parentElement && t.parentElement.closest('span.ix, .footnote, .comment, figcaption, caption, h1') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      const nodes = [];
      let t;
      while ((t = tw.nextNode())) nodes.push(t);
      nodes.forEach(node => {
        const hits = [];
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(node.nodeValue))) hits.push([m.index, m[0].length]);
        for (let i = hits.length - 1; i >= 0; i--) {
          const r = document.createRange();
          r.setStart(node, hits[i][0]);
          r.setEnd(node, hits[i][0] + hits[i][1]);
          wrapRange(r, term, sub);
          n += 1;
        }
      });
      return n;
    }, { skipLocked: true });
  }
  function renameTerm(oldTerm, newTerm) {
    return eachChapterDom(root => {
      let n = 0;
      root.querySelectorAll('span.ix[data-ix]').forEach(x => { if (x.dataset.ix.toLowerCase() === oldTerm.toLowerCase()) { x.dataset.ix = newTerm; n++; } });
      return n;
    }, { skipLocked: true });
  }
  function removeTerm(term) {
    return eachChapterDom(root => {
      let n = 0;
      root.querySelectorAll('span.ix[data-ix]').forEach(x => { if (x.dataset.ix.toLowerCase() === term.toLowerCase()) { x.replaceWith(...x.childNodes); n++; } });
      return n;
    }, { skipLocked: true });
  }

  function indexDialog() {
    if (locked()) return;
    const info = selectionInfo();
    if (!info) return App.toast('Selecione a palavra ou expressão que entra no índice remissivo.');
    const existing = info.node && info.node.closest('span.ix');
    const selected = existing ? existing.textContent : info.range.toString().trim();
    if (!existing && !selected) return App.toast('Selecione a palavra ou expressão que entra no índice remissivo.');
    const termIn = el('input', { type: 'text', value: existing ? existing.dataset.ix : selected.replace(/\s+/g, ' '), list: 'ixTerms' });
    const subIn = el('input', { type: 'text', value: existing ? existing.dataset.ixsub || '' : '', placeholder: 'Opcional (ex.: “museus”, sob a entrada “Paris”)' });
    const all = el('input', { type: 'checkbox', checked: !existing });
    const list = el('datalist', { id: 'ixTerms' }, terms().map(t => el('option', { value: t.term })));
    App.modal({
      title: existing ? 'Termo do índice remissivo' : 'Marcar termo para o índice remissivo',
      body: el('div', {}, [list,
        App.field('Entrada no índice', termIn, 'Como o termo aparece no índice (ex.: “Freud, Sigmund”)'),
        App.field('Subentrada', subIn),
        existing ? null : el('label', { class: 'chk' }, [all, ` Marcar também as outras ocorrências de “${selected}” no livro`]),
        el('p', { class: 'muted small', text: 'O índice é montado nas páginas finais, em ordem alfabética, com as páginas de cada ocorrência (ex.: 12, 15–17, 40). Os números são atualizados sozinhos a cada paginação.' })]),
      buttons: [
        existing ? { label: 'Remover marcação', danger: true, onClick: () => { existing.replaceWith(...existing.childNodes); onInput(); App.commit('Termo removido do índice'); } } : null,
        { label: 'Cancelar' },
        { label: existing ? 'Salvar' : 'Marcar', primary: true, onClick: () => {
          const term = norm(termIn.value);
          if (!term) return false;
          const sub = norm(subIn.value);
          if (existing) { existing.dataset.ix = term; if (sub) existing.dataset.ixsub = sub; else delete existing.dataset.ixsub; onInput(); App.commit('Termo do índice'); return; }
          restore(info);
          wrapRange(window.getSelection().getRangeAt(0), term, sub);
          onInput();
          let more = 0;
          if (all.checked) more = markAll(selected, term, sub);
          App.changed('Termo marcado para o índice');
          App.toast(more ? `“${term}” marcado aqui e em mais ${more} ocorrência(s).` : `“${term}” marcado para o índice remissivo.`);
        } }
      ].filter(Boolean)
    });
  }

  // ================================================================ referências cruzadas
  const OWN = /^\s*((Figura|Fig\.?|Gr[áa]fico|Tabela|Quadro|Imagem|Ilustra[çc][ãa]o|Mapa|Foto(?:grafia)?)\s*(\d+))/i;
  // Figuras, gráficos, tabelas e quadros do livro, na ordem, com o rótulo que receberão na paginação
  function referenceTargets() {
    ensureEditorSaved();
    const counters = { fig: 0, graf: 0, tab: 0, quad: 0 };
    const words = { fig: 'Figura', graf: 'Gráfico', tab: 'Tabela', quad: 'Quadro' };
    const out = [];
    const numbering = App.project.settings.captionNumbering !== false;
    App.project.chapters.forEach(c => {
      const live = c.id === App.editorChapterId && App.view === 'chapter';
      const root = live ? editor() : (() => { const t = document.createElement('template'); t.innerHTML = c.html || ''; return t.content; })();
      root.querySelectorAll('figure.img, table').forEach(node => {
        let kind, cap;
        if (node.tagName === 'FIGURE') {
          const a = App.project.assets[node.dataset.asset];
          kind = a && a.chart ? 'graf' : 'fig';
          cap = (node.querySelector('figcaption') || {}).textContent || '';
          if (node.dataset.wrap === 'behind') return;
        } else {
          cap = (node.querySelector(':scope > caption') || {}).textContent || '';
          kind = node.classList.contains('tb-quadro') ? 'quad' : 'tab';
        }
        cap = cap.trim();
        let label = words[kind].toLowerCase();
        if (cap && numbering) {
          const m = OWN.exec(cap);
          if (m) { if (/^quadro/i.test(m[2])) kind = 'quad'; counters[kind] = Math.max(counters[kind], Number(m[3])); label = m[1]; }
          else label = `${words[kind]} ${++counters[kind]}`;
        }
        out.push({ chapter: c, live, node, kind, label, caption: cap.replace(OWN, '').replace(/^\s*[–—:.-]\s*/, '') });
      });
    });
    return out;
  }
  function ensureRef(t) {
    if (t.node.dataset.ref) return t.node.dataset.ref;
    const ref = 'r-' + D.uid();
    t.node.dataset.ref = ref;
    if (t.live) onInput();
    else {
      // grava no capítulo (o nó veio do template desse capítulo)
      const div = document.createElement('div');
      div.appendChild(t.node.getRootNode().cloneNode(true));
      t.chapter.html = div.innerHTML;
    }
    return ref;
  }

  function xrefDialog() {
    if (locked()) return;
    const info = selectionInfo();
    if (!info) return App.toast('Posicione o cursor onde a referência deve entrar.');
    const items = referenceTargets();
    const heads = App.toc.collect();
    const kindSel = el('select', {}, [['elem', 'Figura, gráfico, tabela ou quadro'], ['head', 'Capítulo ou título']].map(([v, l]) => el('option', { value: v, text: l })));
    const elemSel = el('select', {}, items.length ? items.map((t, i) => el('option', { value: i, text: `${t.label}${t.caption ? ' – ' + t.caption : ''}`.slice(0, 110) })) : [el('option', { value: '', text: 'Nenhuma figura, gráfico, tabela ou quadro no livro' })]);
    const headSel = el('select', {}, heads.map(t => el('option', { value: t.target, text: `${'   '.repeat(t.level - 1)}${t.level > 1 ? '↳ ' : ''}${t.label ? t.label + ' — ' : ''}${t.title}`.slice(0, 100) })));
    const withPage = el('input', { type: 'checkbox', checked: true });
    const prefix = el('select', {}, [['ver ', 'ver Figura 3'], ['(ver ', '(ver Figura 3)'], ['', 'Figura 3'], ['conforme ', 'conforme Figura 3']].map(([v, l]) => el('option', { value: v, text: l })));
    if (!items.length) kindSel.value = 'head';
    const box = el('div');
    const sync = () => { box.innerHTML = ''; box.append(kindSel.value === 'elem' ? App.field('Elemento', elemSel) : App.field('Destino', headSel)); };
    kindSel.addEventListener('change', sync);
    sync();
    App.modal({
      title: 'Referência cruzada',
      body: el('div', {}, [App.field('Tipo', kindSel), box, App.field('Forma', prefix), el('label', { class: 'chk' }, [withPage, ' Incluir o número da página (ex.: “ver Figura 3, p. 41”)']),
        el('p', { class: 'muted small', text: 'O número da figura/tabela e a página são atualizados sozinhos: se a ordem mudar ou o texto andar, a referência acompanha.' })]),
      buttons: [{ label: 'Cancelar' }, { label: 'Inserir', primary: true, onClick: () => {
        let href, text, cls;
        if (kindSel.value === 'elem') {
          const t = items[Number(elemSel.value)];
          if (!t) return false;
          href = '#' + ensureRef(t);
          text = t.label;
          cls = 'xref xref-auto' + (withPage.checked ? ' xref-page' : '');
        } else {
          const h = heads.find(x => x.target === headSel.value);
          if (!h) return false;
          href = '#' + (App.editor.ensureHeadingId ? App.editor.ensureHeadingId(h.target) : h.target);
          text = h.label || h.title;
          cls = 'xref' + (withPage.checked ? ' xref-page' : '');
        }
        restore(info);
        const r = window.getSelection().getRangeAt(0);
        r.deleteContents();
        const a = document.createElement('a');
        a.className = cls;
        a.setAttribute('href', href);
        a.textContent = text;
        const frag = document.createDocumentFragment();
        if (prefix.value) frag.appendChild(document.createTextNode(prefix.value));
        frag.appendChild(a);
        if (prefix.value.startsWith('(')) frag.appendChild(document.createTextNode(')'));
        const last = frag.lastChild;
        r.insertNode(frag);
        r.setStartAfter(last); r.collapse(true);
        window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
        onInput();
        App.commit('Referência cruzada');
      } }]
    });
  }

  // ================================================================ ABNT
  const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  // "Maria da Silva; João Souza" → "SILVA, Maria da; SOUZA, João" (mais de 3 autores: primeiro + et al.)
  function authorsAbnt(txt) {
    const list = String(txt || '').split(/;|\s+e\s+/).map(a => a.trim()).filter(Boolean);
    const fmt = a => {
      if (/,/.test(a)) { const [last, first] = a.split(',').map(x => x.trim()); return `${last.toUpperCase()}, ${first}`; }
      const p = a.split(/\s+/);
      if (p.length === 1) return a.toUpperCase();
      // sobrenomes compostos com Filho/Júnior/Neto ficam juntos
      let last = p.pop();
      if (/^(filho|júnior|junior|neto|sobrinho)$/i.test(last) && p.length > 1) last = p.pop() + ' ' + last;
      return `${last.toUpperCase()}, ${p.join(' ')}`;
    };
    if (list.length > 3) return fmt(list[0]) + ' et al.';
    return list.map(fmt).join('; ');
  }
  const surnameOf = a => { const f = authorsAbnt(String(a).split(/;/)[0]); return f.split(',')[0]; };
  const dot = s => (s && !/[.!?]$/.test(s) ? s + '.' : s);
  const esc = App.escape;
  function referenceHtml(t, v) {
    const au = v.authors ? authorsAbnt(v.authors) : '';
    const title = `<b>${esc(v.title)}</b>${v.subtitle ? ': ' + esc(v.subtitle) : ''}`;
    const ed = v.edition && !/^1\b/.test(v.edition) ? ` ${esc(String(v.edition).replace(/\D+$/, ''))}. ed.` : '';
    const imprint = `${esc(v.city || '[S. l.]')}: ${esc(v.publisher || '[s. n.]')}, ${esc(v.year || '[s. d.]')}`;
    const online = v.url ? ` Disponível em: ${esc(v.url)}. Acesso em: ${esc(v.access || accessToday())}.` : '';
    if (t === 'book') return `${au ? esc(au) + '. ' : ''}${title}.${ed} ${imprint}.${online}`;
    if (t === 'chapter') return `${au ? esc(au) + '. ' : ''}${esc(v.chapter)}. <i>In</i>: ${v.editors ? esc(authorsAbnt(v.editors)) + ' (org.). ' : ''}${title}.${ed} ${imprint}. ${v.pages ? 'p. ' + esc(v.pages) + '.' : ''}${online}`;
    if (t === 'article') return `${au ? esc(au) + '. ' : ''}${esc(v.chapter || v.title)}. <b>${esc(v.journal)}</b>, ${esc(v.city || '[S. l.]')}${v.volume ? ', v. ' + esc(v.volume) : ''}${v.number ? ', n. ' + esc(v.number) : ''}${v.pages ? ', p. ' + esc(v.pages) : ''}, ${esc(v.year || '[s. d.]')}.${online}`;
    if (t === 'thesis') return `${au ? esc(au) + '. ' : ''}${title}. ${esc(v.year || '')}. ${esc(v.degree || 'Tese (Doutorado)')} – ${esc(v.publisher || '')}, ${esc(v.city || '')}, ${esc(v.year || '')}.`;
    // site / documento on-line
    return `${au ? esc(au) + '. ' : ''}${title}. ${esc(v.city || '[S. l.]')}, ${esc(v.year || '[s. d.]')}.${online || ' Disponível em: [endereço]. Acesso em: ' + accessToday() + '.'}`;
  }
  function accessToday() { const d = new Date(); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }

  function referenceDialog() {
    if (locked()) return;
    const info = selectionInfo();
    if (!info) return App.toast('Posicione o cursor onde a referência deve entrar (ex.: na seção “Referências”).');
    const type = el('select', {}, [['book', 'Livro'], ['chapter', 'Capítulo de livro'], ['article', 'Artigo de periódico'], ['site', 'Site ou documento on-line'], ['thesis', 'Tese, dissertação ou TCC']].map(([v, l]) => el('option', { value: v, text: l })));
    const v = {};
    const inp = (k, ph) => { const i = el('input', { type: 'text', placeholder: ph || '' }); i.addEventListener('input', () => { v[k] = i.value.trim(); upd(); }); return i; };
    const prev = el('p', { class: 'ref-preview' });
    const fieldsBox = el('div', { class: 'grid' });
    const F = {
      authors: App.field('Autor(es)', inp('authors', 'Maria da Silva; João Souza'), 'Separe com ponto e vírgula. Mais de 3 autores: entra o primeiro + et al.'),
      chapter: App.field('Título do capítulo / artigo', inp('chapter')),
      editors: App.field('Organizador(es) do livro', inp('editors', 'Ana Lima')),
      title: App.field('Título (em negrito)', inp('title')),
      subtitle: App.field('Subtítulo', inp('subtitle')),
      journal: App.field('Nome do periódico', inp('journal')),
      edition: App.field('Edição', inp('edition', '2 (deixe vazio na 1ª edição)')),
      city: App.field('Local', inp('city', 'São Paulo')),
      publisher: App.field('Editora / instituição', inp('publisher')),
      year: App.field('Ano', inp('year', '2024')),
      volume: App.field('Volume', inp('volume')),
      number: App.field('Número', inp('number')),
      pages: App.field('Páginas', inp('pages', '15-32')),
      degree: App.field('Tipo do trabalho', inp('degree', 'Dissertação (Mestrado em Letras)')),
      url: App.field('Endereço (URL)', inp('url', 'https://…')),
      access: App.field('Acesso em', inp('access', accessToday()))
    };
    const SHOW = {
      book: ['authors', 'title', 'subtitle', 'edition', 'city', 'publisher', 'year', 'url'],
      chapter: ['authors', 'chapter', 'editors', 'title', 'subtitle', 'edition', 'city', 'publisher', 'year', 'pages'],
      article: ['authors', 'chapter', 'journal', 'city', 'volume', 'number', 'pages', 'year', 'url', 'access'],
      site: ['authors', 'title', 'subtitle', 'city', 'year', 'url', 'access'],
      thesis: ['authors', 'title', 'subtitle', 'degree', 'publisher', 'city', 'year']
    };
    function upd() { prev.innerHTML = referenceHtml(type.value, v); }
    function sync() { fieldsBox.innerHTML = ''; SHOW[type.value].forEach(k => fieldsBox.appendChild(F[k])); upd(); }
    type.addEventListener('change', sync);
    sync();
    App.modal({
      title: 'Referência ABNT (NBR 6023)', wide: true,
      body: el('div', {}, [App.field('Tipo de documento', type), fieldsBox, el('div', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'Como fica' }), prev]),
        el('p', { class: 'muted small', text: 'As referências saem alinhadas à esquerda, em espaço simples e separadas por uma linha em branco quando “Referências ABNT” está ligado em Tipografia e paginação.' })]),
      buttons: [{ label: 'Cancelar' }, { label: 'Inserir referência', primary: true, onClick: () => {
        if (!v.title && !v.chapter) return false;
        restore(info);
        const html = `<p class="reference">${referenceHtml(type.value, v)}</p>`;
        App.editor.insertBlocks ? App.editor.insertBlocks(html) : document.execCommand('insertHTML', false, html);
        onInput();
        App.commit('Referência ABNT');
      } }]
    });
  }

  function citationDialog() {
    if (locked()) return;
    const info = selectionInfo();
    if (!info) return App.toast('Posicione o cursor onde a citação deve entrar.');
    const au = el('input', { type: 'text', placeholder: 'Maria da Silva; João Souza' });
    const yr = el('input', { type: 'text', placeholder: '2020' });
    const pg = el('input', { type: 'text', placeholder: '15 (opcional)' });
    const mode = el('select', {}, [['paren', 'Entre parênteses: (SILVA, 2020, p. 15)'], ['narr', 'No texto: Silva (2020, p. 15)']].map(([a, b]) => el('option', { value: a, text: b })));
    const prev = el('p', { class: 'ref-preview' });
    const make = () => {
      const names = au.value.split(/;/).map(a => a.trim()).filter(Boolean);
      const sur = names.length > 3 ? [surnameOf(names[0])] : names.map(surnameOf);
      const etal = names.length > 3 ? ' et al.' : '';
      const tail = `${yr.value.trim() || '[s. d.]'}${pg.value.trim() ? ', p. ' + pg.value.trim() : ''}`;
      if (mode.value === 'paren') return `(${sur.join('; ')}${etal}, ${tail})`;
      const cap = s => s.charAt(0) + s.slice(1).toLowerCase();
      return `${sur.map(cap).join(' e ')}${etal} (${tail})`;
    };
    [au, yr, pg, mode].forEach(i => i.addEventListener('input', () => { prev.textContent = make(); }));
    mode.addEventListener('change', () => { prev.textContent = make(); });
    App.modal({
      title: 'Citação autor-data (NBR 10520)',
      body: el('div', {}, [el('div', { class: 'grid' }, [App.field('Autor(es)', au), App.field('Ano', yr), App.field('Página', pg), App.field('Forma', mode)]), prev,
        el('p', { class: 'muted small', text: 'Citação direta com mais de 3 linhas: use o estilo “Citação longa” (recuo de 4 cm, letra menor, sem aspas, quando “Citação longa ABNT” está ligado).' })]),
      buttons: [{ label: 'Cancelar' }, { label: 'Inserir', primary: true, onClick: () => {
        if (!au.value.trim()) return false;
        restore(info);
        document.execCommand('insertText', false, make());
        onInput();
        App.commit('Citação ABNT');
      } }]
    });
  }

  // ordena em ordem alfabética o bloco de referências em que está o cursor
  function sortReferences() {
    if (locked()) return;
    const info = selectionInfo();
    let b = info && info.node;
    while (b && b.parentNode !== editor()) b = b.parentNode;
    if (!b || !(b.matches && b.matches('p.reference'))) return App.toast('Clique numa das referências (parágrafos no estilo “Referência”).');
    let first = b, last = b;
    while (first.previousElementSibling && first.previousElementSibling.matches('p.reference')) first = first.previousElementSibling;
    while (last.nextElementSibling && last.nextElementSibling.matches('p.reference')) last = last.nextElementSibling;
    const run = [];
    for (let n = first; n; n = n.nextElementSibling) { run.push(n); if (n === last) break; }
    const marker = document.createComment('refs');
    first.before(marker);
    run.sort((x, y) => x.textContent.trim().localeCompare(y.textContent.trim(), 'pt-BR', { sensitivity: 'base' })).forEach(n => marker.before(n));
    marker.remove();
    onInput();
    App.commit('Referências em ordem alfabética');
    App.toast(`${run.length} referência(s) em ordem alfabética.`);
  }

  function abntMenu(anchor) {
    const menu = el('div', { class: 'qs-menu' }, [
      el('div', { class: 'qs-menu-title', text: 'Normas ABNT' }),
      ...[['Referência (NBR 6023)…', referenceDialog], ['Citação autor-data (NBR 10520)…', citationDialog], ['Ordenar as referências (A–Z)', sortReferences], ['Configurar normas ABNT…', () => App.setView('typo')]]
        .map(([t, f]) => el('button', { class: 'qs-menu-item', text: t, onmousedown: e => e.preventDefault(), onclick: () => { menu.remove(); f(); } }))
    ]);
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(window.innerWidth - 280, r.left) + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }

  function mount() {
    const bar = $('#editorToolbar');
    if (!bar || $('#typoTools')) return;
    const link = bar.querySelector('[data-action="link"]');
    const mk = (text, title, fn) => el('button', { title, text, onmousedown: e => e.preventDefault(), onclick: e => fn(e) });
    const box = el('span', { id: 'typoTools', class: 'typo-tools' }, [
      mk('📇 Índice', 'Marcar a palavra selecionada para o índice remissivo', indexDialog),
      mk('↪ Referência', 'Referência cruzada a figura, gráfico, tabela, quadro, capítulo ou título — com o número da página', xrefDialog),
      mk('ABNT ▾', 'Referências e citações nas normas ABNT', e => abntMenu(e.currentTarget))
    ]);
    if (link) link.after(box); else bar.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  App.typoTools = { terms, markAll, renameTerm, removeTerm, referenceTargets, authorsAbnt, referenceHtml, indexDialog, xrefDialog, referenceDialog, citationDialog, sortReferences };
})();
