/* global BookDefaults, BookText */
// Interface principal do Diagramador de Livros.
(function () {
  const api = window.api;
  const { PAGE_FORMATS, BUNDLED_FONTS, SYSTEM_FONTS, STYLE_PRESETS, uid, newProject, normalizeProject } = BookDefaults;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const state = {
    project: newProject(),
    filePath: null,
    dirty: false,
    view: 'chapter',
    chapterId: null,
    zoom: 0.5,
    previewTimer: null,
    rendering: false,
    renderQueued: false,
    autosaveTimer: null,
    lastPdfPath: null,
    editorChapterId: null
  };

  // ---------------------------------------------------------------- utilidades
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }

  function fileName(p) {
    return p ? p.split(/[\\/]/).pop() : 'Sem título';
  }

  function updateTitle() {
    const name = fileName(state.filePath);
    api.setTitle(`${state.dirty ? '● ' : ''}${name} — Diagramador de Livros`);
  }

  function markDirty(opts) {
    state.dirty = true;
    updateTitle();
    if (!opts || opts.preview !== false) schedulePreview();
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(autosave, 4000);
  }

  function autosave() {
    if (!state.dirty) return;
    api.autosaveWrite({ filePath: state.filePath, project: state.project });
  }

  function currentChapter() {
    return state.project.chapters.find(c => c.id === state.chapterId) || null;
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  // ---------------------------------------------------------------- navegação
  function setView(view, chapterId) {
    if (state.view === 'chapter') flushEditor();
    state.view = view;
    if (chapterId !== undefined) state.chapterId = chapterId;
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'book') renderBookView();
    if (view === 'layout') renderLayoutView();
    if (view === 'chapter') loadChapterIntoEditor();
    renderChapterList();
  }

  // ---------------------------------------------------------------- capítulos
  function renderChapterList() {
    const list = $('#chapterList');
    list.innerHTML = '';
    let n = 0;
    state.project.chapters.forEach((c, i) => {
      if (c.numbered) n++;
      const li = el('li', {
        class: 'chapter-item' + (state.view === 'chapter' && c.id === state.chapterId ? ' active' : ''),
        draggable: 'true',
        'data-id': c.id
      }, [
        el('span', { class: 'num', text: c.numbered ? String(n) : '–' }),
        el('span', { class: 'name', text: c.title || 'Sem título' }),
        el('span', { class: 'move' }, [
          el('button', { class: 'mini', title: 'Mover para cima', text: '▲', onclick: e => { e.stopPropagation(); moveChapter(i, -1); } }),
          el('button', { class: 'mini', title: 'Mover para baixo', text: '▼', onclick: e => { e.stopPropagation(); moveChapter(i, 1); } })
        ])
      ]);
      li.addEventListener('click', () => setView('chapter', c.id));
      li.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/x-chapter', c.id);
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', e => {
        if (!e.dataTransfer.types.includes('text/x-chapter')) return;
        e.preventDefault();
        const r = li.getBoundingClientRect();
        li.classList.toggle('drop-before', e.clientY < r.top + r.height / 2);
        li.classList.toggle('drop-after', e.clientY >= r.top + r.height / 2);
      });
      li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
      li.addEventListener('drop', e => {
        e.preventDefault();
        const before = li.classList.contains('drop-before');
        li.classList.remove('drop-before', 'drop-after');
        const id = e.dataTransfer.getData('text/x-chapter');
        const chs = state.project.chapters;
        const from = chs.findIndex(x => x.id === id);
        if (from < 0 || id === c.id) return;
        const [item] = chs.splice(from, 1);
        let to = chs.findIndex(x => x.id === c.id);
        if (!before) to++;
        chs.splice(to, 0, item);
        renderChapterList();
        markDirty();
      });
      list.appendChild(li);
    });
    updateWordCount();
  }

  function moveChapter(i, dir) {
    const chs = state.project.chapters;
    const j = i + dir;
    if (j < 0 || j >= chs.length) return;
    [chs[i], chs[j]] = [chs[j], chs[i]];
    renderChapterList();
    markDirty();
  }

  function addChapter(title, html, numbered) {
    flushEditor();
    const c = { id: uid(), title: title || 'Novo capítulo', numbered: numbered !== false, html: html || '<p><br></p>' };
    const idx = state.project.chapters.findIndex(x => x.id === state.chapterId);
    if (state.view === 'chapter' && idx >= 0) state.project.chapters.splice(idx + 1, 0, c);
    else state.project.chapters.push(c);
    markDirty();
    setView('chapter', c.id);
    const t = $('#chapterTitle');
    t.focus();
    t.select();
    return c;
  }

  async function deleteChapter() {
    const c = currentChapter();
    if (!c) return;
    const r = await api.confirm(`Excluir o capítulo “${c.title}”?`, 'Esta ação não pode ser desfeita depois de salvar.', ['Excluir', 'Cancelar']);
    if (r !== 0) return;
    const chs = state.project.chapters;
    const i = chs.findIndex(x => x.id === c.id);
    chs.splice(i, 1);
    state.editorChapterId = null;
    markDirty();
    if (chs.length) setView('chapter', chs[Math.max(0, i - 1)].id);
    else setView('book');
  }

  function updateWordCount() {
    const total = state.project.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    $('#wordCount').textContent = `${total.toLocaleString('pt-BR')} palavras · ${state.project.chapters.length} capítulo(s)`;
  }

  // ---------------------------------------------------------------- editor
  const editor = () => $('#editor');

  function loadChapterIntoEditor() {
    const c = currentChapter();
    if (!c) {
      if (state.project.chapters.length) { state.chapterId = state.project.chapters[0].id; return loadChapterIntoEditor(); }
      return setView('book');
    }
    state.editorChapterId = c.id;
    $('#chapterTitle').value = c.title;
    $('#chapterNumbered').checked = !!c.numbered;
    editor().innerHTML = c.html || '<p><br></p>';
    editor().style.fontFamily = `"${state.project.settings.bodyFont}", Georgia, serif`;
    $('.editor-scroll').scrollTop = 0;
    scrollPreviewTo(c.id);
  }

  // Copia o conteúdo do editor para o capítulo que está carregado nele
  function flushEditor() {
    if (!state.editorChapterId || state.view !== 'chapter') return;
    const c = state.project.chapters.find(x => x.id === state.editorChapterId);
    if (!c) return;
    const html = editor().innerHTML;
    if (html !== c.html) c.html = html;
  }

  function onEditorInput() {
    const c = state.project.chapters.find(x => x.id === state.editorChapterId);
    if (!c) return;
    c.html = editor().innerHTML;
    markDirty();
    clearTimeout(onEditorInput._wc);
    onEditorInput._wc = setTimeout(updateWordCount, 800);
  }

  function exec(cmd, value) {
    editor().focus();
    document.execCommand(cmd, false, value);
    onEditorInput();
    syncToolbar();
  }

  function currentBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.anchorNode;
    while (n && n !== editor()) {
      if (n.nodeType === 1 && /^(P|H2|H3|H4|BLOCKQUOTE|LI|FIGURE)$/.test(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  }

  function syncToolbar() {
    const b = currentBlock();
    let v = 'p';
    if (b) {
      if (/^H[234]$/.test(b.tagName)) v = b.tagName.toLowerCase();
      else if (b.closest('blockquote')) v = 'blockquote';
    }
    $('#blockFormat').value = v;
    ['bold', 'italic', 'underline', 'superscript'].forEach(cmd => {
      const btn = $(`[data-exec="${cmd}"]`);
      if (btn) btn.classList.toggle('on', document.queryCommandState(cmd));
    });
  }

  function insertHtmlAtCursor(html) {
    editor().focus();
    document.execCommand('insertHTML', false, html);
    onEditorInput();
  }

  function setupEditor() {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    const ed = editor();
    ed.addEventListener('input', onEditorInput);
    ed.addEventListener('keyup', syncToolbar);
    ed.addEventListener('mouseup', syncToolbar);
    ed.addEventListener('paste', e => {
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      let clean;
      if (html) clean = BookText.sanitizeHtml(html);
      else {
        const parts = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n|\n/).filter(s => s.trim());
        clean = parts.length > 1
          ? parts.map(p => '<p>' + BookText.escapeHtml(p.trim()) + '</p>').join('')
          : BookText.escapeHtml(text);
      }
      document.execCommand('insertHTML', false, clean);
      onEditorInput();
    });
    ed.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        toast('Para inserir imagens, use o botão “Imagem” da barra de ferramentas.');
      }
    });
    ed.addEventListener('keydown', e => {
      // Ctrl+Enter = quebra de página
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        insertHtmlAtCursor('<div class="page-break"></div><p><br></p>');
      }
    });

    $('#editorToolbar').addEventListener('mousedown', e => {
      // Mantém a seleção do texto ao clicar nos botões
      if (e.target.closest('button')) e.preventDefault();
    });
    $$('#editorToolbar [data-exec]').forEach(b => b.addEventListener('click', () => exec(b.dataset.exec)));
    $('#blockFormat').addEventListener('change', e => {
      const v = e.target.value;
      const b = currentBlock();
      if (v !== 'blockquote' && b && b.closest('blockquote')) {
        editor().focus();
        document.execCommand('outdent');
      }
      exec('formatBlock', v === 'blockquote' ? 'blockquote' : v);
      // formatBlock com blockquote pode gerar texto solto; garante <p> interno
      editor().querySelectorAll('blockquote').forEach(q => {
        if (!q.querySelector('p')) { const p = document.createElement('p'); while (q.firstChild) p.appendChild(q.firstChild); q.appendChild(p); }
      });
      onEditorInput();
    });
    $$('#editorToolbar [data-action]').forEach(b => b.addEventListener('click', () => toolbarAction(b.dataset.action)));

    $('#chapterTitle').addEventListener('input', e => {
      const c = currentChapter();
      if (!c) return;
      c.title = e.target.value;
      const item = $(`.chapter-item[data-id="${c.id}"] .name`);
      if (item) item.textContent = c.title || 'Sem título';
      markDirty();
    });
    $('#chapterTitle').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); editor().focus(); }
    });
    $('#chapterNumbered').addEventListener('change', e => {
      const c = currentChapter();
      if (!c) return;
      c.numbered = e.target.checked;
      renderChapterList();
      markDirty();
    });
    $('#chapterDelete').addEventListener('click', deleteChapter);
  }

  async function toolbarAction(action) {
    if (action === 'scene') return insertHtmlAtCursor('<hr class="scene-break"><p><br></p>');
    if (action === 'pagebreak') return insertHtmlAtCursor('<div class="page-break"></div><p><br></p>');
    if (action === 'noindent') {
      const b = currentBlock();
      if (b && b.tagName === 'P') { b.classList.toggle('no-indent'); onEditorInput(); }
      return;
    }
    if (action === 'smallcaps') {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return toast('Selecione o texto para aplicar versalete.');
      const range = sel.getRangeAt(0);
      const parentSc = range.commonAncestorContainer.parentElement && range.commonAncestorContainer.parentElement.closest('.smallcaps');
      if (parentSc) {
        parentSc.replaceWith(...Array.from(parentSc.childNodes));
        onEditorInput();
        return;
      }
      const span = document.createElement('span');
      span.className = 'smallcaps';
      span.appendChild(range.extractContents());
      range.insertNode(span);
      onEditorInput();
      return;
    }
    if (action === 'image') {
      const sel = window.getSelection();
      const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const dataUrl = await api.pickImage();
      if (!dataUrl) return;
      editor().focus();
      if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
      insertHtmlAtCursor(`<figure><img src="${dataUrl}" alt=""></figure><p><br></p>`);
    }
  }

  // ---------------------------------------------------------------- formulários
  function field(label, input, hint) {
    return el('label', { class: 'field' }, [
      el('span', { class: 'flabel', text: label }),
      input,
      hint ? el('span', { class: 'hint', text: hint }) : null
    ]);
  }

  function bindInput(obj, key, type, opts) {
    opts = opts || {};
    let input;
    if (type === 'textarea') {
      input = el('textarea', { rows: opts.rows || 3, placeholder: opts.placeholder || '' });
      input.value = obj[key] || '';
    } else if (type === 'checkbox') {
      input = el('input', { type: 'checkbox' });
      input.checked = !!obj[key];
    } else if (type === 'select') {
      input = el('select');
      opts.options.forEach(o => {
        if (o.group) {
          const g = el('optgroup', { label: o.group });
          o.items.forEach(it => g.appendChild(el('option', { value: it.value, text: it.label })));
          input.appendChild(g);
        } else {
          input.appendChild(el('option', { value: o.value, text: o.label }));
        }
      });
      input.value = obj[key];
    } else if (type === 'number') {
      input = el('input', { type: 'number', step: opts.step || 1, min: opts.min, max: opts.max });
      input.value = obj[key];
    } else {
      input = el('input', { type: 'text', placeholder: opts.placeholder || '' });
      input.value = obj[key] || '';
    }
    const evt = type === 'checkbox' || type === 'select' ? 'change' : 'input';
    input.addEventListener(evt, () => {
      let v = type === 'checkbox' ? input.checked : input.value;
      if (type === 'number') {
        v = parseFloat(String(v).replace(',', '.'));
        if (!isFinite(v)) return;
        if (opts.min !== undefined) v = Math.max(opts.min, v);
        if (opts.max !== undefined) v = Math.min(opts.max, v);
      }
      obj[key] = v;
      if (opts.onChange) opts.onChange(v);
      markDirty();
    });
    return input;
  }

  function card(title, children, desc) {
    return el('div', { class: 'card' }, [
      el('h3', { text: title }),
      desc ? el('p', { class: 'muted small', text: desc }) : null,
      el('div', { class: 'grid' }, children)
    ]);
  }

  function renderBookView() {
    const m = state.project.meta;
    const f = state.project.front;
    const v = $('#view-book');
    v.innerHTML = '';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Dados do livro' }),
      card('Identificação', [
        field('Título', bindInput(m, 'title', 'text')),
        field('Subtítulo', bindInput(m, 'subtitle', 'text')),
        field('Autor(a)', bindInput(m, 'author', 'text')),
        field('Editora / selo', bindInput(m, 'publisher', 'text', { placeholder: 'Opcional' })),
        field('Cidade', bindInput(m, 'city', 'text')),
        field('Ano', bindInput(m, 'year', 'text')),
        field('Edição', bindInput(m, 'edition', 'text')),
        field('ISBN', bindInput(m, 'isbn', 'text', { placeholder: 'Opcional' }))
      ]),
      card('Páginas iniciais (pré-textuais)', [
        el('label', { class: 'chk' }, [bindInput(f, 'halfTitle', 'checkbox'), ' Falsa folha de rosto']),
        el('label', { class: 'chk' }, [bindInput(f, 'titlePage', 'checkbox'), ' Folha de rosto']),
        el('label', { class: 'chk' }, [bindInput(f, 'copyright', 'checkbox'), ' Página de créditos / ficha']),
        el('label', { class: 'chk' }, [bindInput(f, 'dedication', 'checkbox'), ' Dedicatória']),
        el('label', { class: 'chk' }, [bindInput(f, 'epigraph', 'checkbox'), ' Epígrafe']),
        el('label', { class: 'chk' }, [bindInput(f, 'toc', 'checkbox'), ' Sumário']),
        field('Título do sumário', bindInput(f, 'tocTitle', 'text'))
      ], 'As páginas ímpares (à direita) são usadas para abrir cada elemento, como em livros impressos.'),
      card('Textos das páginas iniciais', [
        field('Créditos / ficha catalográfica', bindInput(m, 'copyrightText', 'textarea', { rows: 7, placeholder: 'Deixe em branco para gerar automaticamente com autor, ano, edição e ISBN.' })),
        field('Dedicatória', bindInput(m, 'dedication', 'textarea', { rows: 3 })),
        field('Epígrafe', bindInput(m, 'epigraph', 'textarea', { rows: 3 })),
        field('Autor da epígrafe', bindInput(m, 'epigraphAuthor', 'text'))
      ])
    ]));
  }

  function fontOptions() {
    return [
      { group: 'Fontes embutidas (recomendado)', items: BUNDLED_FONTS.map(f => ({ value: f, label: f })) },
      { group: 'Fontes do Windows', items: SYSTEM_FONTS.map(f => ({ value: f, label: f })) }
    ];
  }

  function renderLayoutView() {
    const s = state.project.settings;
    const v = $('#view-layout');
    v.innerHTML = '';

    const presetSel = el('select', {}, [el('option', { value: '', text: 'Escolha um estilo pronto…' })]
      .concat(Object.entries(STYLE_PRESETS).map(([k, p]) => el('option', { value: k, text: p.label }))));
    presetSel.addEventListener('change', () => {
      const p = STYLE_PRESETS[presetSel.value];
      if (!p) return;
      Object.assign(s, p.settings);
      markDirty();
      renderLayoutView();
      toast('Estilo “' + p.label + '” aplicado.');
    });

    const custom = s.pageFormat === 'custom';
    const formatSel = bindInput(s, 'pageFormat', 'select', {
      options: PAGE_FORMATS.map(f => ({ value: f.id, label: f.label })),
      onChange: id => {
        const f = PAGE_FORMATS.find(x => x.id === id);
        if (f && f.width) { s.pageWidth = f.width; s.pageHeight = f.height; }
        renderLayoutView();
      }
    });

    const n = (key, label, step, min, max, hint) => field(label, bindInput(s, key, 'number', { step, min, max }), hint);

    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Diagramação' }),
      el('div', { class: 'card preset' }, [el('h3', { text: 'Estilo pronto' }), presetSel,
        el('p', { class: 'muted small', text: 'Aplica um conjunto de fontes e espaçamentos. Você pode ajustar tudo depois.' })]),
      card('Página', [
        field('Formato', formatSel),
        custom ? n('pageWidth', 'Largura (mm)', 0.5, 50, 400) : null,
        custom ? n('pageHeight', 'Altura (mm)', 0.5, 50, 500) : null,
        !custom ? el('div', { class: 'field info', text: `${String(s.pageWidth).replace('.', ',')} × ${String(s.pageHeight).replace('.', ',')} mm` }) : null
      ]),
      card('Margens (mm)', [
        n('marginTop', 'Superior', 0.5, 5, 60),
        n('marginBottom', 'Inferior', 0.5, 5, 60),
        n('marginInner', 'Interna (lombada)', 0.5, 5, 60, 'Maior em livros grossos'),
        n('marginOuter', 'Externa', 0.5, 5, 60),
        n('bleed', 'Sangria', 0.5, 0, 10, 'Use 3 mm se a gráfica pedir'),
        field('Marcas de corte', el('label', { class: 'chk' }, [bindInput(s, 'cropMarks', 'checkbox'), ' Mostrar'])),
      ], 'Margem interna fica do lado da costura; externa, do lado de fora. Elas se espelham entre páginas pares e ímpares.'),
      card('Texto', [
        field('Fonte do texto', bindInput(s, 'bodyFont', 'select', { options: fontOptions(), onChange: () => { editor().style.fontFamily = `"${s.bodyFont}", Georgia, serif`; } })),
        n('bodySize', 'Tamanho (pt)', 0.25, 6, 24),
        n('lineHeight', 'Entrelinha', 0.05, 1, 3, 'Ex.: 1,4 = 140%'),
        n('paraIndent', 'Recuo do parágrafo (em)', 0.1, 0, 5),
        n('paraSpacing', 'Espaço entre parágrafos (em)', 0.1, 0, 3),
        field('Alinhamento', bindInput(s, 'align', 'select', { options: [{ value: 'justify', label: 'Justificado' }, { value: 'left', label: 'À esquerda' }] })),
        n('widowsOrphans', 'Linhas mín. (viúvas/órfãs)', 1, 1, 5),
        field('Hifenização', el('label', { class: 'chk' }, [bindInput(s, 'hyphenate', 'checkbox'), ' Separar sílabas (português)'])),
        field('Primeiro parágrafo', el('label', { class: 'chk' }, [bindInput(s, 'indentFirstParagraph', 'checkbox'), ' Com recuo'])),
        field('Quebra de cena', bindInput(s, 'sceneBreak', 'text', { placeholder: '*  *  *' }))
      ]),
      card('Capítulos', [
        field('Fonte dos títulos', bindInput(s, 'headingFont', 'select', { options: fontOptions() })),
        n('chapterTitleSize', 'Tamanho do título (pt)', 0.5, 8, 72),
        field('Alinhamento', bindInput(s, 'chapterTitleAlign', 'select', { options: [{ value: 'center', label: 'Centralizado' }, { value: 'left', label: 'À esquerda' }, { value: 'right', label: 'À direita' }] })),
        field('Rótulo', bindInput(s, 'chapterLabel', 'text', { placeholder: 'Capítulo' })),
        field('Numeração', bindInput(s, 'chapterNumbering', 'select', { options: [
          { value: 'arabic', label: '1, 2, 3' }, { value: 'roman', label: 'I, II, III' },
          { value: 'words', label: 'Um, Dois, Três' }, { value: 'none', label: 'Sem número' }] })),
        n('chapterDrop', 'Recuo do topo (mm)', 1, 0, 150, 'Espaço antes do título'),
        field('Início', el('label', { class: 'chk' }, [bindInput(s, 'chapterStartRight', 'checkbox'), ' Sempre em página ímpar'])),
        field('Título', el('label', { class: 'chk' }, [bindInput(s, 'chapterTitleUppercase', 'checkbox'), ' Em maiúsculas'])),
        field('Capitular', el('label', { class: 'chk' }, [bindInput(s, 'dropCap', 'checkbox'), ' Letra capitular'])),
        field('1ª linha', el('label', { class: 'chk' }, [bindInput(s, 'smallCapsFirstLine', 'checkbox'), ' Em versalete']))
      ]),
      card('Cabeçalho e numeração', [
        field('Cabeçalho', bindInput(s, 'header', 'select', { options: [
          { value: 'title-chapter', label: 'Título do livro / título do capítulo' },
          { value: 'author-title', label: 'Autor / título do livro' },
          { value: 'chapter-chapter', label: 'Título do capítulo nas duas páginas' },
          { value: 'none', label: 'Sem cabeçalho' }] })),
        n('headerSize', 'Tamanho do cabeçalho (pt)', 0.25, 5, 16),
        field('Estilo', el('label', { class: 'chk' }, [bindInput(s, 'headerUppercase', 'checkbox'), ' Maiúsculas espaçadas'])),
        field('Número da página', bindInput(s, 'pageNumbers', 'select', { options: [
          { value: 'outer', label: 'Rodapé, canto externo' },
          { value: 'center', label: 'Rodapé, centralizado' },
          { value: 'top-outer', label: 'Topo, canto externo' },
          { value: 'none', label: 'Sem numeração' }] })),
        n('pageNumberSize', 'Tamanho do número (pt)', 0.25, 5, 16),
        field('Contagem', el('label', { class: 'chk' }, [bindInput(s, 'numberFromFirstChapter', 'checkbox'), ' Página 1 = primeiro capítulo']))
      ], 'Páginas pré-textuais, aberturas de capítulo e páginas em branco não exibem cabeçalho.')
    ]));
  }

  // ---------------------------------------------------------------- prévia
  let activeFrame = null;

  function schedulePreview(immediate) {
    if (!$('#autoRefresh').checked && !immediate) {
      $('#pageInfo').textContent = 'Alterações pendentes — clique em Atualizar';
      return;
    }
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(renderPreview, immediate ? 0 : 900);
  }

  async function renderPreview() {
    if (state.rendering) { state.renderQueued = true; return; }
    state.rendering = true;
    flushEditor();
    $('#previewBusy').classList.add('show');
    const container = $('#previewFrames');
    const frame = document.createElement('iframe');
    frame.className = 'preview-frame loading';
    frame.src = 'preview.html';
    container.appendChild(frame);
    try {
      await new Promise((res, rej) => { frame.onload = res; frame.onerror = rej; });
      const book = await api.buildBook(state.project);
      const opts = { single: !$('#spread').checked, guides: $('#guides').checked };
      const info = await frame.contentWindow.renderBook(book, opts);
      // Mantém a posição de rolagem proporcional entre renderizações
      const prev = activeFrame;
      let ratio = 0;
      if (prev && prev.contentDocument) {
        const se = prev.contentDocument.scrollingElement;
        ratio = se.scrollHeight ? se.scrollTop / se.scrollHeight : 0;
      }
      applyZoom(frame);
      const se = frame.contentDocument.scrollingElement;
      se.scrollTop = ratio * se.scrollHeight;
      frame.classList.remove('loading');
      if (prev) prev.remove();
      activeFrame = frame;
      $('#pageInfo').textContent = `${info.pages} páginas`;
    } catch (err) {
      console.error(err);
      frame.remove();
      $('#pageInfo').textContent = 'Erro ao paginar';
    } finally {
      $('#previewBusy').classList.remove('show');
      state.rendering = false;
      if (state.renderQueued) { state.renderQueued = false; renderPreview(); }
    }
  }

  function applyZoom(frame) {
    frame = frame || activeFrame;
    $('#zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    if (!frame || !frame.contentDocument) return;
    frame.contentDocument.documentElement.style.zoom = state.zoom;
  }

  function scrollPreviewTo(id) {
    if (activeFrame && activeFrame.contentWindow && activeFrame.contentWindow.scrollToId) {
      try { activeFrame.contentWindow.scrollToId(id); } catch (e) { /* ignore */ }
    }
  }

  function setupPreview() {
    $('#zoomIn').addEventListener('click', () => { state.zoom = Math.min(2, +(state.zoom + 0.1).toFixed(2)); applyZoom(); });
    $('#zoomOut').addEventListener('click', () => { state.zoom = Math.max(0.2, +(state.zoom - 0.1).toFixed(2)); applyZoom(); });
    $('#refresh').addEventListener('click', () => schedulePreview(true));
    $('#autoRefresh').addEventListener('change', e => { if (e.target.checked) schedulePreview(true); });
    const opt = () => {
      if (activeFrame && activeFrame.contentWindow.setPreviewOptions) {
        activeFrame.contentWindow.setPreviewOptions({ single: !$('#spread').checked, guides: $('#guides').checked });
      }
    };
    $('#spread').addEventListener('change', opt);
    $('#guides').addEventListener('change', opt);

    // Divisor redimensionável
    const splitter = $('#splitter');
    splitter.addEventListener('mousedown', e => {
      e.preventDefault();
      const layout = $('.layout');
      $$('.preview-frame').forEach(f => { f.style.pointerEvents = 'none'; });
      const move = ev => {
        const r = layout.getBoundingClientRect();
        const w = Math.min(Math.max(r.right - ev.clientX, 320), r.width - 620);
        document.documentElement.style.setProperty('--preview-w', w + 'px');
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        $$('.preview-frame').forEach(f => { f.style.pointerEvents = ''; });
        try { localStorage.setItem('previewWidth', getComputedStyle(document.documentElement).getPropertyValue('--preview-w')); } catch (err) { /* ignore */ }
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    try {
      const w = localStorage.getItem('previewWidth');
      if (w) document.documentElement.style.setProperty('--preview-w', w);
      const z = parseFloat(localStorage.getItem('zoom'));
      if (z) state.zoom = z;
    } catch (e) { /* ignore */ }
    window.addEventListener('beforeunload', () => { try { localStorage.setItem('zoom', String(state.zoom)); } catch (e) { /* ignore */ } });
  }

  // ---------------------------------------------------------------- arquivos
  async function confirmDiscard() {
    if (!state.dirty) return true;
    const r = await api.askUnsaved();
    if (r === 'cancel') return false;
    if (r === 'save') return await save(false);
    return true;
  }

  function loadProject(project, filePath, dirty) {
    state.editorChapterId = null;
    state.project = normalizeProject(project);
    state.filePath = filePath || null;
    state.dirty = !!dirty;
    state.chapterId = state.project.chapters.length ? state.project.chapters[0].id : null;
    updateTitle();
    setView(state.chapterId ? 'chapter' : 'book');
    schedulePreview(true);
  }

  async function newBook() {
    if (!(await confirmDiscard())) return;
    loadProject(newProject(), null, false);
    api.autosaveClear();
    setView('book');
  }

  async function open(filePath) {
    if (!(await confirmDiscard())) return;
    const res = await api.openProject(filePath);
    if (!res) return;
    loadProject(res.project, res.filePath, false);
    api.autosaveClear();
    toast('Livro aberto: ' + fileName(res.filePath));
  }

  async function save(saveAs) {
    flushEditor();
    const res = await api.saveProject(state.project, state.filePath, saveAs);
    if (!res) return false;
    state.filePath = res.filePath;
    state.dirty = false;
    updateTitle();
    api.autosaveClear();
    toast('Salvo em ' + fileName(res.filePath));
    return true;
  }

  async function importText() {
    const res = await api.importFile();
    if (!res) return;
    let chapters;
    if (res.kind === 'html') chapters = BookText.htmlToChapters(res.html, res.name);
    else if (res.kind === 'markdown') chapters = BookText.markdownToChapters(res.text, res.name);
    else chapters = BookText.textToChapters(res.text, res.name);
    chapters = chapters.filter(c => c.html.trim());
    if (!chapters.length) return toast('Nenhum texto encontrado no arquivo.');

    const hasContent = state.project.chapters.some(c => BookText.countWords(c.html) > 0);
    let mode = 0;
    if (hasContent) {
      mode = await api.confirm(
        `Encontrado(s) ${chapters.length} capítulo(s) em “${res.name}”.`,
        'Deseja adicionar ao final do livro ou substituir todos os capítulos atuais?',
        ['Adicionar ao final', 'Substituir capítulos', 'Cancelar']
      );
      if (mode === 2) return;
    }
    flushEditor();
    const newChs = chapters.map(c => ({ id: uid(), title: c.title, numbered: c.numbered !== false, html: c.html }));
    if (mode === 1 || !hasContent) state.project.chapters = newChs;
    else state.project.chapters.push(...newChs);
    markDirty();
    setView('chapter', newChs[0].id);
    toast(`${newChs.length} capítulo(s) importado(s).`, 3500);
  }

  async function exportPdf() {
    flushEditor();
    toast('Gerando PDF… isso pode levar alguns segundos.', 60000);
    const res = await api.exportPdf(state.project, state.lastPdfPath);
    if (!res) { $('#toast').classList.remove('show'); return; }
    state.lastPdfPath = res.filePath;
    toast(`PDF gerado: ${res.pages} páginas — ${fileName(res.filePath)}`, 5000);
    const r = await api.confirm('PDF exportado com sucesso!', `${res.pages} páginas\n${res.filePath}`, ['Abrir PDF', 'Mostrar na pasta', 'Fechar']);
    if (r === 0) api.openPath(res.filePath);
    else if (r === 1) api.showItem(res.filePath);
  }

  const commands = {
    new: newBook,
    open: () => open(),
    save: () => save(false),
    saveAs: () => save(true),
    import: importText,
    exportPdf,
    refresh: () => schedulePreview(true),
    help: () => $('#helpDialog').showModal()
  };

  function runCommand(cmd) {
    if (cmd.startsWith('openPath:')) return open(cmd.slice(9));
    const fn = commands[cmd];
    if (fn) fn();
  }

  // ---------------------------------------------------------------- início
  async function init() {
    setupEditor();
    setupPreview();
    $$('[data-cmd]').forEach(b => b.addEventListener('click', () => runCommand(b.dataset.cmd)));
    $$('.nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#addChapter').addEventListener('click', () => addChapter());
    api.onMenu(runCommand);
    api.onRequestClose(async () => {
      flushEditor();
      if (await confirmDiscard()) {
        await api.autosaveClear();
        api.closeConfirmed();
      }
    });
    setInterval(autosave, 60000);

    // Arquivo passado pela linha de comando (duplo clique em .livro)
    const pending = await api.pendingOpen();
    if (pending) {
      const res = await api.openProject(pending);
      if (res) { loadProject(res.project, res.filePath, false); return; }
    }

    // Recuperação após fechamento inesperado
    const rec = await api.autosaveRead();
    if (rec && rec.project) {
      const when = new Date(rec.savedAt).toLocaleString('pt-BR');
      const r = await api.confirm('Recuperar trabalho não salvo?',
        `Encontramos alterações salvas automaticamente em ${when}${rec.filePath ? ' (' + fileName(rec.filePath) + ')' : ''}.`,
        ['Recuperar', 'Descartar']);
      if (r === 0) { loadProject(rec.project, rec.filePath, true); return; }
      api.autosaveClear();
    }
    loadProject(newProject(), null, false);
    try {
      if (!localStorage.getItem('helpShown')) {
        localStorage.setItem('helpShown', '1');
        $('#helpDialog').showModal();
      }
    } catch (e) { /* ignore */ }
  }

  init();
})();
