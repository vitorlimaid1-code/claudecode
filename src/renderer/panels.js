/* global App, BookText */
// Painéis: capítulos (seleção múltipla, bloqueio, edição em massa), dados do livro, ficha,
// páginas finais, formato/diagramação e notas de rodapé.
(function () {
  const { el, $, api, D } = App;
  const bind = App.bind;
  const field = App.field;
  const card = App.card;

  // ================================================================ capítulos
  App.chapters = {};

  App.renderChapterList = function () {
    const list = $('#chapterList');
    list.innerHTML = '';
    const head = document.querySelector('.chapters-head > span');
    if (head) head.textContent = ['magazine', 'newspaper'].includes(App.project.kind) ? 'Matérias' : 'Capítulos';
    let n = 0;
    list.classList.toggle('selecting', App.selectMode);
    App.project.chapters.forEach((c, i) => {
      if (c.numbered) n++;
      const sel = App.selection.has(c.id);
      const li = el('li', {
        class: 'chapter-item' + (App.view === 'chapter' && c.id === App.chapterId ? ' active' : '') + (sel ? ' checked' : '') + (c.locked ? ' locked' : ''),
        draggable: c.locked ? 'false' : 'true', 'data-id': c.id, tabindex: '0',
        title: 'Clique para editar · Delete para excluir o capítulo'
      }, [
        App.selectMode ? el('input', { type: 'checkbox', class: 'ch-check', checked: sel, onclick: e => { e.stopPropagation(); toggleSel(c.id, e); } }) : null,
        el('span', { class: 'num', text: c.numbered ? String(n) : '–' }),
        el('span', { class: 'name', text: c.title || 'Sem título' }),
        c.style && c.style.pageColor ? el('span', { class: 'swatch', style: { background: c.style.pageColor }, title: 'Cor de página personalizada' }) : null,
        c.locked ? el('span', { class: 'lock', text: '🔒', title: 'Bloqueado' }) : null,
        el('span', { class: 'move' }, [
          el('button', { class: 'mini', title: 'Mover para cima', text: '▲', onclick: e => { e.stopPropagation(); move(i, -1); } }),
          el('button', { class: 'mini', title: 'Mover para baixo', text: '▼', onclick: e => { e.stopPropagation(); move(i, 1); } }),
          el('button', { class: 'mini danger', title: 'Excluir este capítulo inteiro', text: '🗑', onclick: e => { e.stopPropagation(); App.chapters.remove(App.selection.has(c.id) && App.selection.size > 1 ? [...App.selection] : [c.id]); } }),
          el('button', { class: 'mini', title: 'Nova página/seção com título logo depois deste', text: '＋', onclick: async e => { e.stopPropagation(); const t = await App.prompt('Nova seção', 'Título da nova página (entra depois de “' + (c.title || '') + '”)', 'Nova seção'); if (t == null) return; App.chapters.insertAt(i + 1, t.trim() || 'Nova seção'); } })
        ])
      ]);
      li.addEventListener('click', e => {
        if (App.selectMode || e.ctrlKey || e.metaKey || e.shiftKey) { toggleSel(c.id, e); return; }
        App.setView('chapter', c.id);
      });
      li.addEventListener('keydown', e => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        e.preventDefault();
        App.chapters.remove(App.selection.has(c.id) && App.selection.size > 1 ? [...App.selection] : [c.id]);
      });
      li.addEventListener('dragstart', e => {
        if (c.locked) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/x-chapter', c.id);
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', e => {
        const types = Array.from(e.dataTransfer.types);
        if (types.includes('application/x-dl-figure') || types.includes('application/x-dl-library') || types.includes('application/x-dl-asset') || types.includes('application/x-dl-separator')) {
          e.preventDefault();
          li.classList.toggle('drop-into', !c.locked);
          li.classList.toggle('drop-invalid', !!c.locked);
          return;
        }
        if (!types.includes('text/x-chapter')) return;
        e.preventDefault();
        const r = li.getBoundingClientRect();
        li.classList.toggle('drop-before', e.clientY < r.top + r.height / 2);
        li.classList.toggle('drop-after', e.clientY >= r.top + r.height / 2);
      });
      li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after', 'drop-into', 'drop-invalid'));
      li.addEventListener('drop', async e => {
        e.preventDefault();
        const before = li.classList.contains('drop-before');
        li.classList.remove('drop-before', 'drop-after', 'drop-into', 'drop-invalid');
        const types = Array.from(e.dataTransfer.types);
        if (c.locked && !types.includes('text/x-chapter')) return App.toast('Capítulo bloqueado.');
        if (types.includes('application/x-dl-figure')) {
          const fid = e.dataTransfer.getData('application/x-dl-figure');
          const fig = $(`#editor [data-fid="${fid}"]`);
          if (fig && c.id !== App.editorChapterId) {
            const html = fig.cloneNode(true);
            html.removeAttribute('style'); html.removeAttribute('contenteditable'); html.removeAttribute('draggable'); html.removeAttribute('data-fid'); html.classList.remove('selected');
            const img = html.querySelector('img'); if (img) { img.removeAttribute('src'); img.removeAttribute('style'); }
            const cap = html.querySelector('figcaption'); if (cap) cap.removeAttribute('contenteditable');
            fig.remove();
            App.editor.flush();
            c.html += html.outerHTML;
            App.changed('Imagem movida para “' + c.title + '”');
            App.toast('Imagem movida para o fim de “' + c.title + '”.');
          }
          return;
        }
        if (types.includes('application/x-dl-separator')) {
          const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'separadores');
          if (ids && ids[0]) { c.separator = ids[0]; App.changed('Separador do capítulo'); App.toast('Separador aplicado a “' + c.title + '”.'); }
          return;
        }
        if (types.includes('application/x-dl-library') || types.includes('application/x-dl-asset')) {
          const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
          if (ids && ids.length) { App.editor.flush(); c.html += ids.map(id => App.editor.figureHtml(id)).join(''); App.changed('Imagem adicionada a “' + c.title + '”'); if (c.id === App.editorChapterId) App.editor.load(); App.toast('Imagem adicionada ao fim de “' + c.title + '”.'); }
          return;
        }
        const id = e.dataTransfer.getData('text/x-chapter');
        const chs = App.project.chapters;
        const from = chs.findIndex(x => x.id === id);
        if (from < 0 || id === c.id) return;
        const [item] = chs.splice(from, 1);
        let to = chs.findIndex(x => x.id === c.id);
        if (!before) to++;
        chs.splice(to, 0, item);
        App.changed('Capítulo reordenado');
        App.renderChapterList();
      });
      list.appendChild(li);
    });
    renderBulkBar();
    App.updateWordCount();
  };

  let lastClicked = null;
  function toggleSel(id, e) {
    const ids = App.project.chapters.map(c => c.id);
    if (e && e.shiftKey && lastClicked) {
      const a = ids.indexOf(lastClicked), b = ids.indexOf(id);
      ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => App.selection.add(x));
    } else if (App.selection.has(id)) App.selection.delete(id);
    else App.selection.add(id);
    lastClicked = id;
    if (!App.selectMode && App.selection.size) App.selectMode = true;
    App.renderChapterList();
    if (App.view === 'bulk') App.hooks.viewRender.bulk();
  }

  function renderBulkBar() {
    const bar = $('#bulkBar');
    bar.innerHTML = '';
    bar.classList.toggle('show', App.selectMode);
    if (!App.selectMode) return;
    bar.append(
      el('span', { text: `${App.selection.size} selecionado(s)` }),
      el('button', { class: 'mini-btn', text: 'Todos', onclick: () => { App.project.chapters.forEach(c => App.selection.add(c.id)); App.renderChapterList(); } }),
      el('button', { class: 'mini-btn', text: 'Nenhum', onclick: () => { App.selection.clear(); App.renderChapterList(); } }),
      el('button', { class: 'mini-btn primary', text: 'Editar selecionados', disabled: !App.selection.size, onclick: () => App.setView('bulk') }),
      el('button', { class: 'mini-btn', text: '✕', title: 'Sair da seleção', onclick: () => { App.selectMode = false; App.selection.clear(); App.renderChapterList(); if (App.view === 'bulk') App.setView('chapter'); } })
    );
  }

  function move(i, dir) {
    const chs = App.project.chapters;
    const j = i + dir;
    if (j < 0 || j >= chs.length) return;
    if (chs[i].locked || chs[j].locked) return App.toast('Capítulos bloqueados não podem ser movidos.');
    [chs[i], chs[j]] = [chs[j], chs[i]];
    App.changed('Capítulo reordenado');
    App.renderChapterList();
  }

  App.chapters.add = function (title, html, numbered) {
    App.flush();
    const c = { id: D.uid(), title: title || 'Novo capítulo', numbered: numbered !== false, html: html || '<p><br></p>', locked: false, style: {}, separator: 'default', openingImage: null };
    const idx = App.project.chapters.findIndex(x => x.id === App.chapterId);
    if (App.view === 'chapter' && idx >= 0) App.project.chapters.splice(idx + 1, 0, c);
    else App.project.chapters.push(c);
    App.changed('Novo capítulo');
    App.setView('chapter', c.id);
    const t = $('#chapterTitle');
    t.focus();
    t.select();
    return c;
  };

  App.chapters.insertAt = function (index, title, html) {
    App.flush();
    const c = { id: D.uid(), title: title || 'Nova seção', numbered: App.project.kind === 'book', html: html || '<p><br></p>', locked: false, style: {}, separator: 'default', openingImage: null };
    App.project.chapters.splice(Math.max(0, Math.min(index, App.project.chapters.length)), 0, c);
    App.changed('Nova seção: ' + c.title);
    App.setView('chapter', c.id);
    return c;
  };

  App.chapters.remove = async function (ids) {
    const chs = App.project.chapters.filter(c => ids.includes(c.id));
    const locked = chs.filter(c => c.locked);
    const ok = chs.filter(c => !c.locked);
    if (!ok.length) return App.toast('Capítulos bloqueados não podem ser excluídos. Desbloqueie-os primeiro.');
    const confirmed = await App.confirmPreview('Excluir capítulos', `Serão excluídos ${ok.length} capítulo(s):` + (locked.length ? ` (${locked.length} bloqueado(s) serão mantidos)` : ''), ok.map(c => c.title), 'Excluir');
    if (!confirmed) return;
    App.flush();
    const idx = App.project.chapters.findIndex(c => c.id === ok[0].id);
    App.project.chapters = App.project.chapters.filter(c => !ok.includes(c));
    ok.forEach(c => App.selection.delete(c.id));
    App.editorChapterId = null;
    App.changed(`Exclusão de ${ok.length} capítulo(s)`);
    const next = App.project.chapters[Math.max(0, idx - 1)];
    if (next) App.setView('chapter', next.id); else App.setView('book');
  };

  App.updateWordCount = function () {
    const total = App.project.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    const pages = App.lastRender ? ` · ${App.lastRender.pages} páginas` : '';
    $('#wordCount').textContent = `${total.toLocaleString('pt-BR')} palavras · ${App.project.chapters.length} capítulo(s)${pages}`;
  };

  // ================================================================ aparência de capítulos (um ou vários)
  const LOOK_FIELDS = [
    ['pageColor', 'Cor da página', 'color'],
    ['textColor', 'Cor do texto', 'color'],
    ['font', 'Fonte do texto', 'font'],
    ['fontSize', 'Tamanho do texto (pt)', 'number'],
    ['titleColor', 'Cor do título', 'color'],
    ['titleFont', 'Fonte do título', 'font'],
    ['titleSize', 'Tamanho do título (pt)', 'number']
  ];

  App.panels = {};
  // Campos de aparência; com um capítulo edita direto, com vários prepara uma operação em massa
  App.panels.chapterStyleFields = function (chs, rerender) {
    const single = chs.length === 1 ? chs[0] : null;
    const pending = {};
    const wrap = el('div', { class: 'look' });
    const rows = LOOK_FIELDS.map(([key, label, type]) => {
      const cur = single ? single.style[key] : (chs.every(c => c.style[key] === chs[0].style[key]) ? chs[0].style[key] : undefined);
      let input;
      const setVal = v => {
        if (single) {
          if (single.locked) { App.toast('Capítulo bloqueado.'); return; }
          if (v === '' || v == null) delete single.style[key]; else single.style[key] = v;
          App.changed(null);
          clearTimeout(setVal._t);
          setVal._t = setTimeout(() => App.commit('Aparência do capítulo'), 700);
          App.renderChapterList();
        } else pending[key] = v;
      };
      if (type === 'color') input = el('input', { type: 'color', value: cur || (key === 'pageColor' ? '#ffffff' : '#000000'), oninput: e => setVal(e.target.value) });
      else if (type === 'number') input = el('input', { type: 'number', step: 0.5, min: 5, max: 72, value: cur || '', placeholder: 'padrão', oninput: e => setVal(e.target.value ? Number(e.target.value) : '') });
      else {
        input = el('select', { onchange: e => { setVal(e.target.value); App.ensureFonts([e.target.value]); } });
        App.fontOptions(true).forEach(o => {
          if (o.group) { const g = el('optgroup', { label: o.group }); o.items.forEach(it => g.appendChild(el('option', { value: it.value, text: it.label }))); input.appendChild(g); } else input.appendChild(el('option', { value: o.value, text: '(padrão do livro)' }));
        });
        input.value = cur || '';
      }
      const reset = el('button', { class: 'ghost small-btn', text: '↺', title: 'Voltar ao padrão do livro', onclick: () => { if (type === 'select' || type === 'font') input.value = ''; else if (type === 'number') input.value = ''; setVal(''); if (!single) pending[key] = ''; } });
      return el('label', { class: 'field' }, [el('span', { class: 'flabel', text: label + (!single && cur === undefined ? ' (vários)' : '') }), el('div', { class: 'inline' }, [input, reset])]);
    });
    // separador e imagem de abertura
    const sepSel = el('select', { onchange: e => { if (e.target.value === 'pick') { e.target.value = ''; App.library.pick('separadores').then(id => { if (id) { if (single) { single.separator = id; App.changed('Separador do capítulo'); rerender && rerender(); } else { pending.separator = id; App.toast('Separador escolhido — clique em Aplicar.'); } } }); return; } if (single) { single.separator = e.target.value || 'default'; App.changed('Separador do capítulo'); } else pending.separator = e.target.value || 'default'; } }, [
      el('option', { value: 'default', text: 'Padrão do livro' }), el('option', { value: 'line', text: 'Filete liso' }), el('option', { value: 'none', text: 'Sem separador' }), el('option', { value: 'pick', text: 'Escolher da biblioteca de separadores…' })
    ]);
    const curSep = single ? single.separator : 'default';
    if (curSep && App.project.assets[curSep]) sepSel.appendChild(el('option', { value: curSep, text: 'Imagem: ' + App.project.assets[curSep].name }));
    sepSel.value = curSep || 'default';
    const opening = single && single.openingImage && App.project.assets[single.openingImage.asset];
    const openBtns = el('div', { class: 'inline' }, [
      opening ? el('img', { class: 'mini-thumb', src: App.assetUrl(single.openingImage.asset) }) : null,
      el('button', { text: opening ? 'Trocar' : 'Escolher…', onclick: async () => {
        const list = await api.pickImages({ title: 'Imagem de página inteira antes do capítulo' });
        if (!list) return;
        const id = await App.addAsset(list[0]);
        chs.filter(c => !c.locked).forEach(c => { c.openingImage = { asset: id, fit: 'cover' }; });
        App.changed('Imagem de abertura de capítulo');
        rerender && rerender();
      } }),
      opening ? el('button', { text: 'Remover', onclick: () => { single.openingImage = null; App.changed('Imagem de abertura removida'); rerender && rerender(); } }) : null
    ]);
    wrap.append(
      el('div', { class: 'grid' }, rows.concat([
        el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Separador abaixo do título' }), sepSel]),
        el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Página inteira (sangrada) antes do capítulo' }), openBtns])
      ]))
    );
    if (!single) {
      wrap.append(el('div', { class: 'grid' }, [
        field('Numeração', (() => { const s = el('select', { onchange: e => { pending.numbered = e.target.value; } }, [['', 'Não alterar'], ['1', 'Numerados'], ['0', 'Não numerados']].map(([v, l]) => el('option', { value: v, text: l }))); return s; })()),
        field('Bloqueio', (() => { const s = el('select', { onchange: e => { pending.locked = e.target.value; } }, [['', 'Não alterar'], ['1', 'Bloquear'], ['0', 'Desbloquear']].map(([v, l]) => el('option', { value: v, text: l }))); return s; })())
      ]));
      wrap.append(el('div', { class: 'actions-row' }, [
        el('button', { class: 'primary', text: 'Aplicar aos selecionados', onclick: () => applyBulk(chs, pending) }),
        el('button', { text: 'Restaurar aparência padrão nos selecionados', onclick: () => applyBulk(chs, { __reset: true }) })
      ]));
    }
    return wrap;
  };

  async function applyBulk(chs, pending) {
    const keys = Object.keys(pending).filter(k => pending[k] !== undefined && !(k === 'numbered' && pending[k] === '') && !(k === 'locked' && pending[k] === ''));
    if (!keys.length) return App.toast('Nenhuma alteração escolhida.');
    const unlocking = pending.locked === '0';
    const targets = chs.filter(c => !c.locked || unlocking || keys.every(k => k === 'locked'));
    const skipped = chs.filter(c => !targets.includes(c));
    const label = k => ({ pageColor: 'cor da página', textColor: 'cor do texto', font: 'fonte', fontSize: 'tamanho do texto', titleColor: 'cor do título', titleFont: 'fonte do título', titleSize: 'tamanho do título', separator: 'separador', numbered: 'numeração', locked: 'bloqueio', __reset: 'restaurar aparência padrão' }[k] || k);
    const ok = await App.confirmPreview('Edição em massa', `Alterar ${keys.map(label).join(', ')} em ${targets.length} capítulo(s)` + (skipped.length ? ` — ${skipped.length} bloqueado(s) serão ignorados` : '') + ':', targets.map(c => c.title));
    if (!ok) return;
    App.flush();
    targets.forEach(c => {
      if (pending.__reset) { c.style = {}; c.separator = 'default'; return; }
      keys.forEach(k => {
        if (k === 'numbered') c.numbered = pending[k] === '1';
        else if (k === 'locked') c.locked = pending[k] === '1';
        else if (k === 'separator') c.separator = pending[k];
        else if (pending[k] === '' || pending[k] == null) delete c.style[k];
        else c.style[k] = pending[k];
      });
    });
    App.changed(`Edição em massa (${targets.length} capítulos)`);
    App.toast('Alterações aplicadas.');
    App.hooks.viewRender.bulk();
  }

  App.hooks.viewRender.bulk = function () {
    const v = $('#view-bulk');
    v.innerHTML = '';
    const chs = App.project.chapters.filter(c => App.selection.has(c.id));
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Editar capítulos selecionados' }),
      el('p', { class: 'muted', text: chs.length ? chs.map(c => c.title).join(' · ') : 'Selecione capítulos na lista à esquerda (Ctrl/Shift + clique ou o botão ☑).' }),
      chs.length ? card('Aparência', [App.panels.chapterStyleFields(chs, () => App.hooks.viewRender.bulk())], 'Os campos vazios mantêm o valor atual de cada capítulo. Capítulos bloqueados não são alterados (exceto para desbloquear).', 'span-all') : null,
      chs.length ? el('div', { class: 'actions-row' }, [el('button', { class: 'danger', text: `Excluir ${chs.length} capítulo(s)…`, onclick: () => App.chapters.remove(chs.map(c => c.id)) })]) : null
    ]));
  };

  // ================================================================ dados do livro
  App.hooks.viewRender.book = function () {
    const m = App.project.meta;
    const f = App.project.front;
    const tp = App.project.titlePage;
    const v = $('#view-book');
    v.innerHTML = '';
    const logo = tp.logo && App.project.assets[tp.logo];
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Dados do livro e páginas iniciais' }),
      card('Identificação', [
        field('Título do livro', bind(m, 'title', 'text', { label: 'Título do livro' })),
        field('Subtítulo', bind(m, 'subtitle', 'text')),
        field('Nome do autor', bind(m, 'author', 'text')),
        field('Editora / selo', bind(m, 'publisher', 'text', { placeholder: 'Opcional' })),
        field('Cidade', bind(m, 'city', 'text')),
        field('Ano', bind(m, 'year', 'text')),
        field('Edição', bind(m, 'edition', 'text')),
        field('ISBN', bind(m, 'isbn', 'text', { placeholder: 'Opcional' })),
        field('Idioma', bind(m, 'language', 'select', { options: [{ value: 'pt-BR', label: 'Português (Brasil)' }, { value: 'pt-PT', label: 'Português (Portugal)' }, { value: 'es', label: 'Espanhol' }, { value: 'en', label: 'Inglês' }] })),
        field('Sinopse (EPUB e quarta capa)', bind(m, 'description', 'textarea', { rows: 3 }), '', 'wide')
      ]),
      card('Páginas iniciais (pré-textuais)', [
        el('label', { class: 'chk' }, [bind(f, 'halfTitle', 'checkbox'), ' Falsa folha de rosto']),
        el('label', { class: 'chk' }, [bind(f, 'titlePage', 'checkbox'), ' Página de rosto']),
        el('label', { class: 'chk' }, [bind(f, 'copyright', 'checkbox'), ' Créditos e ficha catalográfica']),
        el('label', { class: 'chk' }, [bind(f, 'dedication', 'checkbox'), ' Dedicatória']),
        el('label', { class: 'chk' }, [bind(f, 'epigraph', 'checkbox'), ' Epígrafe']),
        el('label', { class: 'chk' }, [bind(f, 'toc', 'checkbox', { onChange: () => App.hooks.viewRender.book() }), ' Sumário'])
      ], 'Ordem padrão: página de rosto › ficha catalográfica › sumário › (dedicatória, epígrafe) › capítulos › páginas extras. Cada elemento começa na página seguinte, sem páginas em branco; estas páginas não recebem número.'),
      App.toc.card(() => App.hooks.viewRender.book()),
      card('Página de rosto', [
        el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Logotipo da editora' }), el('div', { class: 'inline' }, [
          logo ? el('img', { class: 'mini-thumb', src: App.assetUrl(tp.logo) }) : el('span', { class: 'muted', text: 'Nenhum' }),
          el('button', { text: logo ? 'Trocar…' : 'Escolher…', onclick: async () => { const l = await api.pickImages({ title: 'Logotipo da editora' }); if (!l) return; tp.logo = await App.addAsset(l[0]); App.changed('Logotipo da editora'); App.hooks.viewRender.book(); } }),
          logo ? el('button', { text: 'Remover', onclick: () => { tp.logo = null; App.changed('Logotipo removido'); App.hooks.viewRender.book(); } }) : null
        ])]),
        field('Largura do logotipo (mm)', bind(tp, 'logoWidth', 'number', { min: 5, max: 80, step: 1 })),
        el('label', { class: 'chk' }, [bind(tp, 'showPublisher', 'checkbox'), ' Mostrar nome da editora']),
        el('label', { class: 'chk' }, [bind(tp, 'showYear', 'checkbox'), ' Mostrar cidade e ano'])
      ], 'Título do livro, nome do autor e logotipo da editora.'),
      card('Dedicatória e epígrafe', [
        field('Dedicatória', bind(m, 'dedication', 'textarea', { rows: 3 }), '', 'wide'),
        field('Epígrafe', bind(m, 'epigraph', 'textarea', { rows: 3 }), '', 'wide'),
        field('Autor da epígrafe', bind(m, 'epigraphAuthor', 'text'))
      ])
    ]));
  };

  // ================================================================ créditos e ficha catalográfica
  App.hooks.viewRender.catalog = function () {
    const c = App.project.catalog;
    const m = App.project.meta;
    const v = $('#view-catalog');
    v.innerHTML = '';
    const rerender = () => App.hooks.viewRender.catalog();
    const credits = el('div', { class: 'credits' }, (c.credits || []).map((cr, i) => el('div', { class: 'credit-row' }, [
      bind(cr, 'role', 'text', { placeholder: 'Função (ex.: Revisão)' }),
      bind(cr, 'name', 'text', { placeholder: 'Nome' }),
      el('button', { class: 'ghost', text: '✕', title: 'Remover', onclick: () => { c.credits.splice(i, 1); App.changed('Crédito removido'); rerender(); } })
    ])));
    const roles = ['Edição', 'Coordenação editorial', 'Preparação de texto', 'Revisão', 'Diagramação', 'Projeto gráfico', 'Capa', 'Ilustrações', 'Fotografia', 'Tradução', 'Produção gráfica', 'Impressão'];
    const imgs = el('div', { class: 'cat-assets' }, (c.images || []).map((im, i) => el('div', { class: 'cat-asset' }, [
      App.project.assets[im.asset] ? el('img', { src: App.assetUrl(im.asset) }) : el('span', { class: 'bad', text: 'ausente' }),
      bind(im, 'caption', 'text', { placeholder: 'Legenda' }),
      el('label', { class: 'inline small' }, ['Largura (mm) ', bind(im, 'width', 'number', { min: 5, max: 80 })]),
      el('button', { class: 'ghost', text: '✕', onclick: () => { c.images.splice(i, 1); App.changed('Imagem removida da ficha'); rerender(); } })
    ])));
    const qrs = el('div', { class: 'cat-assets' }, (c.qrcodes || []).map((q, i) => el('div', { class: 'cat-asset' }, [
      el('span', { class: 'qr-icon', text: '▦' }),
      bind(q, 'text', 'text', { placeholder: 'Endereço ou texto do QR code' }),
      bind(q, 'caption', 'text', { placeholder: 'Legenda' }),
      el('label', { class: 'inline small' }, ['Tamanho (mm) ', bind(q, 'size', 'number', { min: 10, max: 60 })]),
      el('button', { class: 'ghost', text: '✕', onclick: () => { c.qrcodes.splice(i, 1); App.changed('QR code removido'); rerender(); } })
    ])));
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Créditos e ficha catalográfica' }),
      el('p', { class: 'muted', text: 'Página de créditos (verso da página de rosto). A quantidade de páginas e as dimensões são preenchidas automaticamente a partir da diagramação.' }),
      App.catalogUi.gallery(rerender),
      (() => {
        // ficha pronta (do bibliotecário/CBL): colar aqui substitui a ficha montada pelos campos
        const ta = el('textarea', { class: 'cat-paste', rows: 13, spellcheck: 'false', placeholder: 'Cole aqui a ficha catalográfica pronta, exatamente como recebeu (Ctrl+V).\n\nEx.:\nS586c    Silva, Maria, 1980-\n           O caminho das águas / Maria Silva. – São Paulo : Editora, 2026.\n           240 p. ; 14 × 21 cm.\n\n           ISBN 978-65-00-00000-0\n\n           1. Ficção brasileira. I. Título.\n\n                                                    CDD B869.3' });
        ta.value = c.manualText || '';
        const save = () => { c.manualText = ta.value; if (ta.value.trim()) c.mode = 'manual'; App.changed('Ficha catalográfica colada'); };
        ta.addEventListener('input', () => { c.manualText = ta.value; App.changed(null); clearTimeout(ta._t); ta._t = setTimeout(() => App.commit('Ficha catalográfica colada'), 1200); });
        ta.addEventListener('paste', () => setTimeout(() => { save(); rerender(); App.toast('Ficha colada: ela será usada no livro, com o espaçamento e a caixa padrão da ficha.'); }, 0));
        // como a ficha colada foi entendida: mesma organização do modelo (cabeçalho, chamada, entrada, recuos, assuntos, CDD)
        const pc = c.manualText && c.manualText.trim() && window.CatalogParse ? window.CatalogParse.parse(c.manualText) : null;
        const preview = pc && pc.ok && !c.manualRaw ? el('div', { class: 'cat-parse-preview' }, [
          el('div', { class: 'small muted', text: 'Como a ficha sai no livro (organização do modelo selecionado):' }),
          el('div', { class: 'cat-mini-sheet cat-style-' + (c.style || 'box') }, [
            el('div', { class: 'cps-head', text: 'Dados Internacionais de Catalogação na Publicação (CIP)' + (c.style === 'cbl' ? ' (Câmara Brasileira do Livro, SP, Brasil)' : '') }),
            el('div', { class: 'cps-main' }, [
              pc.cutter ? el('div', { class: 'cps-cutter', text: pc.cutter }) : null,
              el('div', {}, [el('div', { text: pc.entry })].concat(pc.paras.map(x => el('div', { class: 'cps-ind', text: x }))).concat(pc.subjects ? [el('div', { class: 'cps-ind', text: pc.subjects })] : []))
            ]),
            ...pc.cls.map(p2 => el('div', { class: 'cps-class' + (p2.length > 1 ? ' split' : '') }, p2.map(x => el('span', { text: x })))),
            ...pc.indices.map((x, i) => el('div', { class: i ? '' : 'cps-b', text: x })),
            ...pc.librarian.map(x => el('div', { class: 'cps-lib', text: x }))
          ]),
          el('div', { class: 'small muted', text: `Entendido: ${[pc.cutter && 'número de chamada', 'entrada', pc.paras.length + ' parágrafo(s)', pc.subjects && 'assuntos', pc.cls.length && 'classificação', pc.indices.length && 'índices', pc.librarian.length && 'bibliotecário'].filter(Boolean).join(' · ')}` })
        ]) : null;
        return card('Colar ficha catalográfica pronta (opcional)', [
          el('p', { class: 'small muted wide', text: 'Módulo à parte: se você já tem a ficha pronta, cole aqui e não precisa preencher os campos abaixo. A ficha colada sai com a mesma organização visual do modelo selecionado na galeria — cabeçalho, número de chamada, entrada, recuos, assuntos e CDD nos mesmos lugares da ficha montada pelos campos.' }),
          el('div', { class: 'field wide' }, [ta]),
          el('label', { class: 'chk' }, [el('input', { type: 'checkbox', checked: c.mode === 'manual', onchange: e => { c.mode = e.target.checked ? 'manual' : 'fields'; App.changed(e.target.checked ? 'Usar a ficha colada' : 'Usar a ficha montada pelos campos'); rerender(); } }), ' Usar a ficha colada no livro (em vez da montada pelos campos)']),
          el('label', { class: 'chk' }, [el('input', { type: 'checkbox', checked: !!c.manualRaw, onchange: e => { c.manualRaw = e.target.checked; App.changed(e.target.checked ? 'Ficha colada sem reorganizar' : 'Ficha colada no padrão do modelo'); rerender(); } }), ' Manter exatamente como colei (sem reorganizar no padrão do modelo)']),
          preview,
          el('div', { class: 'inline wrap' }, [
            el('button', { text: 'Colar da área de transferência', onclick: async () => { try { const t = await navigator.clipboard.readText(); if (t) { ta.value = t; save(); rerender(); } } catch (e) { App.toast('Use Ctrl+V dentro da caixa.'); } } }),
            el('button', { class: 'ghost', text: 'Limpar', onclick: () => { c.manualText = ''; c.mode = 'fields'; App.changed('Ficha colada removida'); rerender(); } })
          ])
        ], '', 'span-all');
      })(),
      card('Créditos do desenvolvimento do livro', [
        credits,
        el('div', { class: 'inline wrap' }, roles.map(r => el('button', { class: 'chip', text: '+ ' + r, onclick: () => { c.credits.push({ role: r, name: '' }); App.changed('Crédito adicionado'); rerender(); } }))
          .concat([el('button', { class: 'chip', text: '+ Outro', onclick: () => { c.credits.push({ role: '', name: '' }); rerender(); } })]))
      ], '', 'span-all'),
      card('Direitos e contato', [
        field('Texto de direitos autorais', bind(c, 'rights', 'textarea', { rows: 3, placeholder: `© ${m.year} ${m.author}\nTodos os direitos reservados.` }), '', 'wide'),
        field('Contato / endereço da editora', bind(c, 'contact', 'textarea', { rows: 2 }), '', 'wide'),
        field('Crédito de distribuição', bind(c, 'distribution', 'textarea', { rows: 6, placeholder: App.project.settings.standard === 'cedet' ? D.CEDET.distribution : 'Opcional' }), App.project.settings.standard === 'cedet' ? 'CEDET: obrigatório. Vazio = texto oficial do manual (mostrado acima, em cinza).' : 'Ex.: dados da distribuidora', 'wide'),
        App.project.settings.standard === 'cedet' ? el('div', { class: 'field' }, [el('span', { class: 'flabel', text: ' ' }), el('button', { class: 'small-btn', text: 'Inserir o crédito oficial do Cedet', onclick: () => { c.distribution = D.CEDET.distribution; App.changed('Crédito de distribuição'); App.hooks.viewRender[App.view] && App.hooks.viewRender[App.view](); } })]) : null
      ]),
      card('Ficha catalográfica (CIP)', [
        el('label', { class: 'chk' }, [bind(c, 'enabled', 'checkbox'), ' Incluir ficha catalográfica']),
        field('Modo', bind(c, 'mode', 'select', { options: [{ value: 'fields', label: 'Montar a partir dos campos' }, { value: 'manual', label: 'Texto manual (colar ficha pronta do bibliotecário)' }], onChange: rerender })),
        field('Aparência', bind(c, 'style', 'select', { options: App.catalogUi.STYLES })),
        field('Posição na página', bind(c, 'position', 'select', { options: [{ value: 'bottom', label: 'No pé da página (padrão)' }, { value: 'top', label: 'No alto da página' }] })),
        c.mode === 'manual' ? field('Ficha catalográfica (texto completo)', bind(c, 'manualText', 'textarea', { rows: 9 }), '', 'wide') : null,
        c.mode !== 'manual' ? field('Entrada principal (autor)', bind(c, 'authorEntry', 'text', { placeholder: 'SOBRENOME, Nome, 1980-' })) : null,
        c.mode !== 'manual' ? field('Título do livro', bind(m, 'title', 'text')) : null,
        c.mode !== 'manual' ? field('Subtítulo', bind(m, 'subtitle', 'text')) : null,
        c.mode !== 'manual' ? field('Nome do autor', bind(m, 'author', 'text')) : null,
        c.mode !== 'manual' ? field('Título original', bind(c, 'originalTitle', 'text')) : null,
        c.mode !== 'manual' ? field('Tradução', bind(c, 'translator', 'text')) : null,
        c.mode !== 'manual' ? field('Ilustrações', bind(c, 'illustrator', 'text')) : null,
        c.mode !== 'manual' ? field('Edição', bind(m, 'edition', 'text')) : null,
        c.mode !== 'manual' ? field('Cidade', bind(m, 'city', 'text')) : null,
        c.mode !== 'manual' ? field('Editora', bind(m, 'publisher', 'text')) : null,
        c.mode !== 'manual' ? field('Ano', bind(m, 'year', 'text')) : null,
        c.mode !== 'manual' ? field('Quantidade de páginas', bind(c, 'pagesOverride', 'text', { placeholder: App.lastRender ? `automático (${App.lastRender.pages})` : 'automático' })) : null,
        c.mode !== 'manual' ? field('Série / coleção', bind(c, 'series', 'text')) : null,
        c.mode !== 'manual' ? field('ISBN', bind(m, 'isbn', 'text')) : null,
        c.mode !== 'manual' ? field('Assuntos (separados por ;)', bind(c, 'subjects', 'text', { placeholder: 'Ficção brasileira; Romance' })) : null,
        c.mode !== 'manual' ? field('CDD', bind(c, 'cdd', 'text')) : null,
        c.mode !== 'manual' ? field('CDU', bind(c, 'cdu', 'text')) : null,
        c.mode !== 'manual' ? field('Cutter', bind(c, 'cutter', 'text')) : null,
        c.mode !== 'manual' ? field('Notas', bind(c, 'notes', 'textarea', { rows: 2 }), '', 'wide') : null,
        c.mode !== 'manual' ? field('Bibliotecário(a) responsável', bind(c, 'librarian', 'text')) : null,
        c.mode !== 'manual' ? field('CRB', bind(c, 'crb', 'text')) : null
      ], 'A ficha oficial deve ser elaborada por bibliotecário(a) (CRB). Os campos ajudam a montá-la no padrão usual.'),
      card('Imagens e QR codes na página de créditos', [
        imgs,
        el('div', { class: 'inline' }, [
          el('button', { text: '+ Imagem do computador', onclick: async () => { const l = await api.pickImages({ multiple: true }); if (!l) return; for (const a of l) c.images.push({ asset: await App.addAsset(a), width: 25, caption: '' }); App.changed('Imagem na ficha'); rerender(); } }),
          el('button', { text: '+ Da biblioteca', onclick: async () => { const id = await App.library.pick('corpo'); if (id) { c.images.push({ asset: id, width: 25, caption: '' }); App.changed('Imagem na ficha'); rerender(); } } })
        ]),
        qrs,
        el('button', { text: '+ QR code', onclick: () => { c.qrcodes.push({ text: '', caption: '', size: 20 }); App.changed(null); rerender(); } })
      ], 'Selos, logotipos de apoio, certificações e QR codes (gerados no próprio computador).', 'span-all')
    ]));
  };

  // ================================================================ páginas finais
  App.hooks.viewRender.back = function () {
    const b = App.project.back;
    const v = $('#view-back');
    v.innerHTML = '';
    const miniEditor = (obj, label) => {
      const ed = el('div', { class: 'mini-editor', contenteditable: 'true', spellcheck: 'true', lang: 'pt-BR' });
      ed.innerHTML = obj.html || '<p><br></p>';
      App.editor.decorate(ed);
      ed.addEventListener('input', () => { obj.html = ed.innerHTML.replace(/\ssrc="blob:[^"]*"/g, ''); App.changed(null); clearTimeout(ed._t); ed._t = setTimeout(() => App.commit(label), 1500); });
      ed.addEventListener('paste', e => { const h = e.clipboardData.getData('text/html'); if (!h) return; e.preventDefault(); document.execCommand('insertHTML', false, BookText.sanitizeHtml(h)); });
      const tb = el('div', { class: 'mini-toolbar' }, [['bold', 'N'], ['italic', 'I']].map(([c, t]) => el('button', { text: t, onmousedown: e => e.preventDefault(), onclick: () => { document.execCommand(c); ed.dispatchEvent(new Event('input')); } })));
      return el('div', { class: 'field wide' }, [tb, ed]);
    };
    const photo = b.bio.photo && App.project.assets[b.bio.photo];
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Páginas finais (opcionais)' }),
      card('Biografia do autor', [
        el('label', { class: 'chk' }, [bind(b.bio, 'enabled', 'checkbox'), ' Incluir “Sobre o autor” no fim do livro']),
        field('Título', bind(b.bio, 'title', 'text')),
        el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Foto' }), el('div', { class: 'inline' }, [
          photo ? el('img', { class: 'mini-thumb', src: App.assetUrl(b.bio.photo) }) : null,
          el('button', { text: photo ? 'Trocar…' : 'Escolher…', onclick: async () => { const l = await api.pickImages({}); if (!l) return; b.bio.photo = await App.addAsset(l[0]); App.changed('Foto do autor'); App.hooks.viewRender.back(); } }),
          photo ? el('button', { text: 'Remover', onclick: () => { b.bio.photo = null; App.changed('Foto removida'); App.hooks.viewRender.back(); } }) : null
        ])]),
        field('Largura da foto (mm)', bind(b.bio, 'photoWidth', 'number', { min: 10, max: 100 })),
        miniEditor(b.bio, 'Biografia do autor')
      ], '', 'span-all'),
      card('Conteúdo extra do autor', [
        el('label', { class: 'chk' }, [bind(b.extra, 'enabled', 'checkbox'), ' Incluir página extra no fim do livro']),
        field('Título', bind(b.extra, 'title', 'text', { placeholder: 'Do mesmo autor, Agradecimentos, Contato…' })),
        miniEditor(b.extra, 'Conteúdo extra')
      ], '', 'span-all')
    ]));
  };

  // ================================================================ formato e diagramação
  App.hooks.viewRender.layout = function () {
    const s = App.project.settings;
    const v = $('#view-layout');
    v.innerHTML = '';
    const rerender = () => App.hooks.viewRender.layout();
    const n = (key, label, step, min, max, hint) => field(label, bind(s, key, 'number', { step, min, max }), hint);
    const len = (key, label, min, max, hint) => {
      // larguras/alturas da folha de saída ficam dentro de settings.outputSheet
      const sheetKey = { outputSheetW: 'w', outputSheetH: 'h' }[key];
      const obj = sheetKey ? s.outputSheet : s;
      return field(`${label} (${App.unitLabel()})`, bind(obj, sheetKey || key, 'number', { len: true, min, max, step: 0.5, onChange: sheetKey ? rerender : undefined }), hint);
    };
    const fmt = D.PAGE_FORMATS.find(f => f.id === s.pageFormat);
    const groups = D.FORMAT_GROUPS.concat(['Outro']).map(g => ({ group: g, items: D.PAGE_FORMATS.filter(f => f.group === g).map(f => ({ value: f.id, label: f.label + (f.edited ? ` (editado: ${App.fmtNum(f.width / 10)} × ${App.fmtNum(f.height / 10)} cm)` : '') + (f.use ? ' — ' + f.use : '') })) }));
    // cada modelo traz os seus padrões: CEDET → manual Cedet; KDP → especificação da Amazon; demais → padrão do sistema
    const formatSel = bind(s, 'pageFormat', 'select', {
      options: groups,
      onChange: id => {
        const f = D.PAGE_FORMATS.find(x => x.id === id);
        if (f && D.CEDET.formats.includes(f.id)) { D.applyCedet(s, f.id); App.toast('Modelo CEDET: margens, sangria de 5 mm e marcas conforme o manual.'); }
        else {
          if (f && f.width) { s.pageWidth = f.width; s.pageHeight = f.height; }
          const kdp = f && f.group === 'Amazon KDP (polegadas)';
          if (s.standard === 'cedet' || kdp) D.applyFreeLayout(s);
          if (kdp) { s.kdp = Object.assign(s.kdp || {}, { enabled: true }); s.cropMarks = false; App.toast('Amazon KDP: sangria de 0,125 pol. (3,175 mm). Para as margens exatas pelo número de páginas, use o módulo Amazon KDP.', 6000); }
          else if (s.kdp && s.kdp.enabled) s.kdp.enabled = false;
        }
        App.commit('Formato do livro'); rerender();
      }
    });
    // medidas do modelo: o usuário pode editar e restaurar as originais do sistema
    const fmtNow = D.PAGE_FORMATS.find(f => f.id === s.pageFormat && f.width);
    const dimsDiffer = fmtNow && (Math.abs(fmtNow.width - s.pageWidth) > 0.01 || Math.abs(fmtNow.height - s.pageHeight) > 0.01);
    const saveOverrides = async mutate => { const o = (await api.formatsGet()) || {}; mutate(o); await api.formatsSet(o); D.applyFormatOverrides(o); };
    const formatTools = fmtNow ? el('div', { class: 'inline wrap span-all' }, [
      dimsDiffer ? el('button', { text: `Salvar ${App.fmtNum(s.pageWidth / 10)} × ${App.fmtNum(s.pageHeight / 10)} cm no modelo “${fmtNow.label}”`, title: 'Os próximos livros com este modelo usarão estas medidas', onclick: async () => { await saveOverrides(o => { o[fmtNow.id] = { width: s.pageWidth, height: s.pageHeight }; }); App.toast('Medidas salvas no modelo. Use “Restaurar” para voltar às originais.'); rerender(); } }) : null,
      dimsDiffer ? el('button', { text: `↺ Voltar às medidas do modelo (${App.fmtNum(fmtNow.width / 10)} × ${App.fmtNum(fmtNow.height / 10)} cm)`, onclick: () => { s.pageWidth = fmtNow.width; s.pageHeight = fmtNow.height; App.changed('Medidas do modelo'); rerender(); } }) : null,
      fmtNow.edited ? el('button', { text: `↺ Restaurar o modelo ao original do sistema (${App.fmtNum(fmtNow.orig.width / 10)} × ${App.fmtNum(fmtNow.orig.height / 10)} cm)`, onclick: async () => { await saveOverrides(o => { delete o[fmtNow.id]; }); s.pageWidth = fmtNow.orig.width; s.pageHeight = fmtNow.orig.height; App.changed('Modelo restaurado'); App.toast('Modelo restaurado às medidas originais do sistema.'); rerender(); } }) : null,
      D.PAGE_FORMATS.some(f => f.edited) && !fmtNow.edited ? el('span', { class: 'muted small', text: `${D.PAGE_FORMATS.filter(f => f.edited).length} modelo(s) com medidas editadas — restaure em “Restaurar padrões”.` }) : null
    ]) : null;
    const unitSel = el('select', { onchange: e => { App.unit = e.target.value; try { localStorage.setItem('unit', App.unit); } catch (err) { /* ok */ } rerender(); } }, [['mm', 'Milímetros'], ['cm', 'Centímetros'], ['in', 'Polegadas'], ['pt', 'Pontos']].map(([u, l]) => el('option', { value: u, text: l })));
    unitSel.value = App.unit;
    const presetSel = el('select', { onchange: async () => {
      const key = presetSel.value;
      if (!(await App.genre.apply(key, true))) { presetSel.value = App.project.genre || ''; return; }
      App.toast('Configuração “' + D.GENRE_PRESETS[key].label + '” aplicada.');
      rerender();
    } }, [el('option', { value: '', text: 'Escolha um gênero…' })].concat(Object.entries(D.GENRE_PRESETS).map(([k, p]) => el('option', { value: k, text: p.label }))));
    presetSel.value = App.project.genre || '';
    const sepAsset = s.separatorAsset && App.project.assets[s.separatorAsset];
    const contentW = s.pageWidth - s.marginInner - s.marginOuter;
    const contentH = s.pageHeight - s.marginTop - s.marginBottom;
    const bleedMax = s.bleedAuto ? D.autoBleed(s) : Math.max(s.bleedTop || 0, s.bleedBottom || 0, s.bleedOuter || 0);
    const cedet = s.standard === 'cedet';
    const cedetFmtSel = el('select', { onchange: e => { D.applyCedet(s, e.target.value); App.changed('Formato CEDET'); rerender(); } }, D.PAGE_FORMATS.filter(f => D.CEDET.formats.includes(f.id)).map(f => el('option', { value: f.id, text: f.label.replace('CEDET — ', '') })));
    if (D.CEDET.formats.includes(s.pageFormat)) cedetFmtSel.value = s.pageFormat;
    const cedetCard = el('div', { class: 'card preset' + (cedet ? ' cedet-on' : '') }, [
      el('h3', { text: cedet ? '✓ Modelo CEDET (padrão do sistema)' : 'Modelo CEDET (padrão do sistema)' }),
      el('p', { class: 'muted small', text: cedet
        ? 'Este livro segue o Manual de Preparação de Arquivos do Cedet: miolo preto e branco, margem de segurança de 20 mm, sangria de 5 mm, marcas de corte de 0,25 pt a 5 mm, numeração no rodapé (ímpares à direita) e crédito de distribuição na ficha. Exporte com o perfil “CEDET — miolo”.'
        : 'Este livro está com layout livre. Aplique o modelo CEDET para seguir o manual de preparação de arquivos (formato, margens, sangria, marcas e numeração).' }),
      el('div', { class: 'inline wrap' }, [
        cedet ? field('Formato CEDET', cedetFmtSel) : null,
        el('button', { class: cedet ? '' : 'primary', text: cedet ? '↺ Reaplicar o modelo CEDET' : 'Aplicar o modelo CEDET', onclick: async () => {
          const ok = await App.confirmPreview('Modelo CEDET', 'Aplicar o modelo CEDET a este livro?', ['Formato 15,5 × 23, 13,7 × 21 ou 11,5 × 17,5 cm (mantém o atual se já for Cedet)', 'Margens: superior e inferior 28 mm, interna 23 mm, externa 20 mm (segurança de 20 mm)', 'Sangria 5 mm · marcas de corte 0,25 pt a 5 mm do corte', 'Número da página no rodapé externo, logo abaixo do texto · textos em preto', 'Crédito de distribuição do Cedet na ficha catalográfica']);
          if (!ok) return;
          D.applyCedet(s);
          if (!App.project.catalog.distribution) App.project.catalog.distribution = D.CEDET.distribution;
          App.project.front.copyright = true;
          if (App.project.cover) { App.project.cover.cedet = true; App.project.cover.marks = Object.assign({}, App.project.cover.marks, { enabled: true }); }
          App.changed('Modelo CEDET aplicado'); rerender();
        } }),
        cedet ? el('button', { text: 'Usar layout livre', title: 'Desliga as regras do Cedet neste livro (as medidas atuais são mantidas)', onclick: () => { s.standard = ''; App.changed('Layout livre'); rerender(); } }) : null
      ])
    ]);
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Formato e diagramação' }),
      cedetCard,
      el('div', { class: 'card preset' }, [
        el('h3', { text: 'Configurações prontas por gênero' }), presetSel,
        el('p', { class: 'muted small', text: 'Romance, poesia, terror, suspense, fantasia, ficção científica, contos, infantojuvenil, autoajuda, biografia, religioso e acadêmico.' }),
        el('div', { class: 'inline wrap' }, [
          el('button', { text: '★ Salvar como meu padrão', title: 'Novos livros (e o próximo uso do app) começam com esta configuração', onclick: async () => { await api.defaultsSet(JSON.parse(JSON.stringify(s))); App.toast('Configuração salva como seu padrão.'); } }),
          el('button', { text: 'Aplicar meu padrão', onclick: async () => { const d = await api.defaultsGet(); if (!d) return App.toast('Você ainda não salvou um padrão.'); const ok = await App.confirmPreview('Aplicar meu padrão', 'Substituir a configuração deste livro pelo seu padrão salvo?', ['Formato, margens, estilos e opções']); if (!ok) return; App.project.settings = D.mergeSettings(JSON.parse(JSON.stringify(D.DEFAULT_SETTINGS)), d); App.changed('Meu padrão aplicado'); rerender(); } }),
          el('button', { text: 'Restaurar padrão de fábrica', onclick: async () => { const ok = await App.confirmPreview('Padrão de fábrica', 'Voltar todas as configurações deste livro ao padrão do aplicativo (modelo CEDET, 15,5 × 23 cm)?', ['Formato, margens, estilos e opções']); if (!ok) return; App.project.settings = JSON.parse(JSON.stringify(D.DEFAULT_SETTINGS)); App.changed('Padrão de fábrica'); rerender(); } })
        ])
      ]),
      card('Página (formato final de corte)', [
        field('Formato', formatSel, fmt && fmt.use ? 'Uso comum: ' + fmt.use : '', 'wide'),
        field('Unidade de medida', unitSel),
        field(`Largura (${App.unitLabel()})`, bind(s, 'pageWidth', 'number', { len: true, min: 30, max: 600, step: 0.5, onChange: () => { clearTimeout(rerender._t); rerender._t = setTimeout(rerender, 900); } })),
        field(`Altura (${App.unitLabel()})`, bind(s, 'pageHeight', 'number', { len: true, min: 30, max: 600, step: 0.5, onChange: () => { clearTimeout(rerender._t); rerender._t = setTimeout(rerender, 900); } })),
        el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Orientação' }), el('button', { text: '⟲ Inverter largura/altura', onclick: () => { [s.pageWidth, s.pageHeight] = [s.pageHeight, s.pageWidth]; s.pageFormat = (D.PAGE_FORMATS.find(f => Math.abs(f.width - s.pageWidth) < 0.3 && Math.abs(f.height - s.pageHeight) < 0.3) || { id: 'custom' }).id; App.changed('Orientação da página'); rerender(); } })]),
        field('Cor de fundo das páginas', bind(s, 'pageColor', 'color', { fallback: '#ffffff' })),
        formatTools
      ], `Formato final de corte: ${App.fmtNum(s.pageWidth / 10)} × ${App.fmtNum(s.pageHeight / 10)} cm. Arquivo com sangria: ${App.fmtNum((s.pageWidth + 2 * bleedMax) / 10)} × ${App.fmtNum((s.pageHeight + 2 * bleedMax) / 10)} cm. Mancha de texto: ${App.fmtNum(contentW / 10)} × ${App.fmtNum(contentH / 10)} cm.`),
      card('Margens espelhadas', [
        len('marginTop', 'Superior', 5, 80), len('marginBottom', 'Inferior', 5, 80),
        len('marginInner', 'Interna (lombada)', 5, 80, 'Aumente em livros com muitas páginas'), len('marginOuter', 'Externa', 5, 80)
      ], 'A margem interna fica do lado da costura e a externa do lado de fora; elas se espelham automaticamente entre páginas pares e ímpares.'),
      card('Sangria e área de segurança (miolo)', [
        el('label', { class: 'chk' }, [bind(s, 'bleedAuto', 'checkbox', { onChange: rerender }), ` Sangria automática pelo formato (${App.fmtNum(D.autoBleed(s), 3)} mm)`]),
        !s.bleedAuto ? len('bleedTop', 'Sangria superior', 0, 10) : null,
        !s.bleedAuto ? len('bleedBottom', 'Sangria inferior', 0, 10) : null,
        !s.bleedAuto ? len('bleedOuter', 'Sangria externa', 0, 10) : null,
        len('safety', 'Área de segurança', 0, 20, 'Distância mínima da borda para textos importantes'),
        el('label', { class: 'chk' }, [bind(s, 'cropMarks', 'checkbox'), ' Marcas de corte no PDF'])
      ], 'Automática: 3 mm na maioria dos formatos, 5 mm em formatos grandes (A3 ou maior) e 3,175 mm (0,125 pol.) para Amazon KDP. Desmarque para digitar a medida pedida pela sua gráfica (0 = sem sangria). A sangria não altera o formato final de corte; o PDF sai com TrimBox e BleedBox.'),
      (() => {
        // folha de saída: tamanho pedido pela gráfica; a página vai centralizada, nada é reduzido nem cortado
        if (!s.outputSheet) s.outputSheet = { mode: 'trim', w: 210, h: 297, marks: true };
        const o = s.outputSheet;
        const sh = D.outputSheetSize(s, App.bleedOf ? App.bleedOf(s) : D.autoBleed(s));
        const status = !sh ? `Saída no formato do livro: ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm + sangria.`
          : sh.fits ? `✓ Folha ${App.fmtNum(sh.w)} × ${App.fmtNum(sh.h)} mm: a página de ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm fica centralizada, em tamanho real${o.marks ? ', com marcas de corte' : ''}.`
            : `⚠ A folha ${App.fmtNum(sh.w)} × ${App.fmtNum(sh.h)} mm é menor que o necessário (${App.fmtNum(sh.needW)} × ${App.fmtNum(sh.needH)} mm com sangria${o.marks ? ' e marcas' : ''}). Nada será cortado: a exportação usa o formato do livro até você aumentar a folha.`;
        return card('Folha de saída para a gráfica', [
          field('Tamanho da folha', bind(o, 'mode', 'select', { options: Object.entries(D.OUTPUT_SHEETS).map(([k, v]) => ({ value: k, label: v.label })), onChange: rerender }), '', 'wide'),
          o.mode === 'custom' ? len('outputSheetW', 'Largura da folha', 50, 2000) : null,
          o.mode === 'custom' ? len('outputSheetH', 'Altura da folha', 50, 2000) : null,
          o.mode !== 'trim' && o.mode !== 'marks' ? el('label', { class: 'chk' }, [bind(o, 'marks', 'checkbox', { onChange: rerender }), ' Marcas de corte fora da sangria']) : null,
          o.mode !== 'trim' && (o.marks || o.mode === 'marks') ? field('Deslocamento das marcas a partir do corte (mm)', bind(o, 'markOffset', 'number', { step: 0.5, min: 0, max: 20, allowEmpty: true, onChange: rerender }), 'Vazio = 2 mm além da sangria. CEDET: 5 mm') : null,
          o.mode !== 'trim' && (o.marks || o.mode === 'marks') ? field('Comprimento das marcas (mm)', bind(o, 'markLen', 'number', { step: 0.5, min: 1, max: 20, allowEmpty: true, onChange: rerender })) : null,
          o.mode !== 'trim' && (o.marks || o.mode === 'marks') ? field('Espessura das marcas (pt)', bind(o, 'markWeight', 'number', { step: 0.05, min: 0.1, max: 2, allowEmpty: true })) : null,
          el('p', { class: 'small ' + (sh && !sh.fits ? 'warn' : 'muted'), text: status })
        ], 'Use quando a gráfica pedir o PDF numa folha maior que o livro (ex.: A4 ou SRA3). O formato final de corte, as margens, a sangria e todo o conteúdo continuam exatamente iguais — a página só é posicionada no centro da folha.');
      })(),
      card('Texto e paginação', [
        el('label', { class: 'chk' }, [bind(s, 'hyphenate', 'checkbox'), ' Hifenização (português)']),
        el('label', { class: 'chk' }, [bind(s, 'indentFirstParagraph', 'checkbox'), ' Recuo no 1º parágrafo']),
        el('label', { class: 'chk' }, [bind(s, 'keepHeadingsWithNext', 'checkbox'), ' Manter títulos com o texto seguinte']),
        n('widowsOrphans', 'Linhas mínimas por página (viúvas/órfãs)', 1, 1, 5),
        field('Quebra de cena', bind(s, 'sceneBreak', 'text', { placeholder: '*  *  *' }))
      ], 'O texto que não cabe é empurrado para a página seguinte, sem alterar o tamanho da fonte.'),
      card('Capítulos', [
        field('Rótulo', bind(s, 'chapterLabel', 'text', { placeholder: 'Capítulo' })),
        field('Numeração', bind(s, 'chapterNumbering', 'select', { options: [{ value: 'arabic', label: '1, 2, 3' }, { value: 'roman', label: 'I, II, III' }, { value: 'words', label: 'Um, Dois, Três' }, { value: 'none', label: 'Sem número' }] })),
        el('label', { class: 'chk' }, [bind(s, 'dropCap', 'checkbox'), ' Letra capitular']),
        n('dropCapLines', 'Linhas da capitular', 1, 2, 5),
        el('label', { class: 'chk' }, [bind(s, 'smallCapsFirstLine', 'checkbox'), ' 1ª linha em versalete'])
      ], 'Fontes, tamanhos e cores dos títulos ficam em “Estilos de texto”.'),
      card('Separador abaixo dos títulos', [
        field('Tipo', bind(s, 'separator', 'select', { options: [{ value: 'line', label: 'Filete liso (padrão)' }, { value: 'image', label: 'Imagem da biblioteca de separadores' }, { value: 'none', label: 'Sem separador' }], onChange: rerender })),
        s.separator === 'image' ? el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Imagem' }), el('div', { class: 'inline' }, [
          sepAsset ? el('img', { class: 'sep-thumb', src: App.assetUrl(s.separatorAsset) }) : el('span', { class: 'muted', text: 'Nenhuma' }),
          el('button', { text: 'Escolher…', onclick: async () => { const id = await App.library.pick('separadores'); if (id) { s.separatorAsset = id; App.changed('Separador padrão'); rerender(); } } })
        ])]) : null,
        n('separatorWidth', 'Largura (% da mancha)', 1, 5, 100),
        s.separator === 'line' ? field('Cor do filete', bind(s, 'separatorColor', 'color')) : null
      ], 'Cada capítulo pode usar outro separador em “Aparência”.'),
      card('Cabeçalho, numeração e notas', [
        field('Cabeçalho', bind(s, 'header', 'select', { options: [{ value: 'title-chapter', label: 'Título do livro / título do capítulo' }, { value: 'author-title', label: 'Autor / título do livro' }, { value: 'chapter-chapter', label: 'Título do capítulo nas duas páginas' }, { value: 'none', label: 'Sem cabeçalho' }] })),
        field('Número da página', bind(s, 'pageNumbers', 'select', { options: [{ value: 'outer', label: 'Rodapé, canto externo' }, { value: 'center', label: 'Rodapé, centralizado' }].concat(cedet ? [] : [{ value: 'top-outer', label: 'Topo, canto externo' }]).concat([{ value: 'none', label: 'Sem numeração' }]) }), cedet ? 'CEDET: canto inferior externo ou centro inferior; ímpares sempre à direita.' : ''),
        n('folioGap', 'Distância do número ao texto (mm)', 0.5, 0, 30, '0 = número centrado na margem inferior. CEDET: 3 mm, para ficar dentro dos 20 mm de segurança'),
        el('label', { class: 'chk' }, [bind(s, 'numberFromFirstChapter', 'checkbox'), ' Página 1 = primeiro capítulo']),
        field('Numeração das notas', bind(s, 'footnoteNumbering', 'select', { options: [{ value: 'book', label: 'Contínua no livro' }, { value: 'chapter', label: 'Reinicia a cada capítulo' }] })),
        el('label', { class: 'chk' }, [bind(s, 'footnotesVisible', 'checkbox'), ' Mostrar notas de rodapé'])
      ])
    ]));
  };

  // ================================================================ notas de rodapé
  // Remove todas as notas de todos os capítulos desbloqueados (pode ser desfeito)
  App.removeAllNotes = async function () {
    App.flush();
    const chs = App.project.chapters.filter(c => /class="footnote"/.test(c.html || ''));
    const count = c => (c.html.match(/<span class="footnote"/g) || []).length;
    const total = chs.reduce((n, c) => n + count(c), 0);
    if (!total) return App.toast('O livro não tem notas de rodapé.');
    const ok = chs.filter(c => !c.locked);
    const locked = chs.filter(c => c.locked);
    const confirmed = await App.confirmPreview('Remover todas as notas de rodapé', `Serão removidas ${ok.reduce((n, c) => n + count(c), 0)} nota(s)` + (locked.length ? ` (as de ${locked.length} capítulo(s) bloqueado(s) serão mantidas)` : '') + ':', ok.map(c => `${c.title}: ${count(c)} nota(s)`), 'Remover todas');
    if (!confirmed) return;
    ok.forEach(c => { const t = document.createElement('template'); t.innerHTML = c.html; t.content.querySelectorAll('span.footnote').forEach(n => n.remove()); c.html = t.innerHTML.replace(/\u200b/g, ''); });
    App.editorChapterId = null;
    App.changed('Todas as notas de rodapé removidas');
    if (App.view === 'chapter') App.setView('chapter', App.chapterId);
    else if (App.view === 'notes') App.hooks.viewRender.notes();
    App.toast('Notas removidas. Use Desfazer se mudar de ideia.');
  };

  App.hooks.viewRender.notes = function () {
    App.flush();
    const v = $('#view-notes');
    v.innerHTML = '';
    const s = App.project.settings;
    const all = [];
    App.project.chapters.forEach(c => {
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      tpl.content.querySelectorAll('span.footnote').forEach((n, i) => all.push({ chapter: c, index: i, text: n.textContent.trim(), context: (n.closest('p') || n.parentElement || n).textContent.replace(n.textContent, ' ¹ ').trim().slice(0, 140) }));
    });
    const removeNotes = async (items, label) => {
      const locked = items.filter(x => x.chapter.locked);
      const ok = items.filter(x => !x.chapter.locked);
      if (!ok.length) return App.toast('As notas estão em capítulos bloqueados.');
      const confirmed = await App.confirmPreview(label, `Serão removidas ${ok.length} nota(s)` + (locked.length ? ` (${locked.length} em capítulos bloqueados serão mantidas)` : '') + ':', ok.map(x => `${x.chapter.title}: ${x.text.slice(0, 90)}`), 'Remover');
      if (!confirmed) return;
      const byCh = new Map();
      ok.forEach(x => { if (!byCh.has(x.chapter)) byCh.set(x.chapter, new Set()); byCh.get(x.chapter).add(x.index); });
      byCh.forEach((idx, c) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = c.html;
        tpl.content.querySelectorAll('span.footnote').forEach((n, i) => { if (idx.has(i)) n.remove(); });
        c.html = tpl.innerHTML;
      });
      App.editorChapterId = null;
      App.changed(`${label} (${ok.length})`);
      App.hooks.viewRender.notes();
    };
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Notas de rodapé' }),
      el('div', { class: 'card' }, [
        el('div', { class: 'inline wrap' }, [
          el('strong', { text: `${all.length} nota(s) no livro` }),
          el('label', { class: 'chk' }, [bind(s, 'footnotesVisible', 'checkbox', { label: 'Mostrar/ocultar notas' }), ' Mostrar notas no livro (desmarque para ocultar todas sem apagar)']),
          el('button', { class: 'danger', text: 'Remover todas as notas…', disabled: !all.length, onclick: () => App.removeAllNotes() })
        ]),
        el('p', { class: 'muted small', text: 'Ocultar não apaga: as notas continuam no projeto e voltam ao marcar a opção. Remover pode ser desfeito pelo Histórico.' })
      ]),
      all.length ? el('table', { class: 'notes-table' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: '' }), el('th', { text: 'Capítulo' }), el('th', { text: 'Nota' }), el('th', { text: '' })])]),
        el('tbody', {}, all.map(x => el('tr', {}, [
          el('td', {}, [el('input', { type: 'checkbox', class: 'note-check' })]),
          el('td', {}, [el('a', { href: '#', text: x.chapter.title, onclick: e => { e.preventDefault(); App.setView('chapter', x.chapter.id); } })]),
          el('td', {}, [el('div', { text: x.text }), el('div', { class: 'muted small', text: '… ' + x.context + ' …' })]),
          el('td', {}, [el('button', { class: 'ghost danger', text: 'Remover', onclick: () => removeNotes([x], 'Remover nota') })])
        ])))
      ]) : el('p', { class: 'muted', text: 'Nenhuma nota. Use o botão “¹ Nota” no editor para inserir.' }),
      all.length ? el('button', { text: 'Remover notas marcadas…', onclick: () => { const marks = Array.from(document.querySelectorAll('.note-check')).map((c, i) => (c.checked ? all[i] : null)).filter(Boolean); if (!marks.length) return App.toast('Marque as notas a remover.'); removeNotes(marks, 'Remover notas selecionadas'); } }) : null
    ]));
  };
})();
