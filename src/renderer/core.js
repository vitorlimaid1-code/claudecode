/* global BookDefaults */
// Núcleo da interface: estado, utilidades, histórico (desfazer/refazer), imagens do projeto e diálogos.
// append() ignorando valores vazios (facilita montar listas condicionais)
(function () {
  const orig = Element.prototype.append;
  Element.prototype.append = function (...items) { return orig.apply(this, items.filter(x => x !== null && x !== undefined && x !== false)); };
})();

window.App = (function () {
  const api = window.api;
  const D = BookDefaults;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const App = {
    api, D, $, $$,
    project: D.newProject(),
    filePath: null,
    dirty: false,
    view: 'chapter',
    chapterId: null,
    editorChapterId: null,
    selection: new Set(),
    selectMode: false,
    lastRender: null, // { pages, chapterPages, pageInfo }
    fontFamilies: { bundled: D.BUNDLED_FONTS.slice(), library: [], system: [] },
    unit: (() => { try { return localStorage.getItem('unit') || 'mm'; } catch (e) { return 'mm'; } })(),
    hooks: { viewRender: {}, afterLoad: [], afterChange: [] }
  };

  // ---------------------------------------------------------------- utilidades
  App.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(c => { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };
  const el = App.el;

  App.toast = function (msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(App.toast._t);
    App.toast._t = setTimeout(() => t.classList.remove('show'), ms || 2800);
  };

  App.escape = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  App.fileName = p => (p ? p.split(/[\\/]/).pop() : 'Sem título');
  App.fmtNum = (v, d) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 2 : d });
  App.chapter = id => App.project.chapters.find(c => c.id === (id || App.chapterId)) || null;

  App.updateTitle = function () {
    api.setTitle(`${App.dirty ? '● ' : ''}${App.fileName(App.filePath)} — Diagramador de Livros`);
  };

  // Marca alteração; opcionalmente registra no histórico
  App.changed = function (label, opts) {
    opts = opts || {};
    App.dirty = true;
    App.updateTitle();
    if (label) App.commit(label);
    if (opts.preview !== false && App.preview) App.preview.schedule();
    clearTimeout(App._autosave);
    App._autosave = setTimeout(App.autosave, 4000);
    App.hooks.afterChange.forEach(fn => { try { fn(opts); } catch (e) { console.error(e); } });
  };

  App.autosave = function () {
    if (!App.dirty) return;
    App.flush();
    api.autosaveWrite({ filePath: App.filePath, project: App.serialize() });
  };

  App.flush = function () { if (App.editor) App.editor.flush(); };

  // Projeto pronto para salvar/exportar (sem URLs temporárias do editor)
  App.serialize = function () {
    App.flush();
    const p = App.project;
    const clean = h => String(h || '').replace(/\ssrc="blob:[^"]*"/g, '');
    return Object.assign({}, p, {
      chapters: p.chapters.map(c => Object.assign({}, c, { html: clean(c.html) })),
      back: { bio: Object.assign({}, p.back.bio, { html: clean(p.back.bio.html) }), extra: Object.assign({}, p.back.extra, { html: clean(p.back.extra.html) }) }
    });
  };

  // ---------------------------------------------------------------- histórico
  const history = { undo: [], redo: [], max: 80 };
  App.history = history;
  function snapshot() {
    const p = App.serialize();
    return JSON.stringify(Object.assign({}, p, { assets: undefined }));
  }
  App.commit = function (label) {
    const snap = snapshot();
    const last = history.undo[history.undo.length - 1];
    if (last && last.snap === snap) return;
    history.undo.push({ label, time: Date.now(), snap });
    if (history.undo.length > history.max) history.undo.shift();
    history.redo = [];
    App.updateHistoryButtons();
  };
  App.resetHistory = function (label) {
    history.undo = [{ label: label || 'Projeto aberto', time: Date.now(), snap: snapshot() }];
    history.redo = [];
    App.updateHistoryButtons();
  };
  function restore(snap) {
    const data = JSON.parse(snap);
    data.assets = App.project.assets; // imagens nunca são apagadas pelo histórico
    const view = App.view;
    const ch = App.chapterId;
    App.editorChapterId = null;
    App.project = D.normalizeProject(data);
    App.chapterId = App.project.chapters.some(c => c.id === ch) ? ch : (App.project.chapters[0] || {}).id;
    App.dirty = true;
    App.updateTitle();
    App.setView(view === 'chapter' && !App.chapterId ? 'book' : view, undefined, { noFlush: true });
    App.preview.schedule(true);
  }
  App.undo = function () {
    App.flush();
    // garante que a edição atual esteja registrada
    const cur = snapshot();
    if (history.undo.length && history.undo[history.undo.length - 1].snap !== cur) App.commit('Edição de texto');
    if (history.undo.length < 2) return App.toast('Nada para desfazer.');
    const top = history.undo.pop();
    history.redo.push(top);
    restore(history.undo[history.undo.length - 1].snap);
    App.toast('Desfeito: ' + top.label);
    App.updateHistoryButtons();
  };
  App.redo = function () {
    if (!history.redo.length) return App.toast('Nada para refazer.');
    const top = history.redo.pop();
    history.undo.push(top);
    restore(top.snap);
    App.toast('Refeito: ' + top.label);
    App.updateHistoryButtons();
  };
  App.restoreHistory = function (index) {
    const item = history.undo[index];
    if (!item) return;
    App.commit('Antes de recuperar estado');
    restore(item.snap);
    App.commit('Recuperado: ' + item.label);
  };
  App.updateHistoryButtons = function () {
    const u = $('#btnUndo');
    const r = $('#btnRedo');
    if (u) { u.disabled = history.undo.length < 2; u.title = history.undo.length > 1 ? `Desfazer: ${history.undo[history.undo.length - 1].label}` : 'Nada para desfazer'; }
    if (r) r.disabled = !history.redo.length;
  };
  App.showHistory = function () {
    const list = el('ol', { class: 'history-list' }, history.undo.slice().reverse().map((h, ri) => {
      const i = history.undo.length - 1 - ri;
      return el('li', {}, [
        el('span', { class: 'h-time', text: new Date(h.time).toLocaleTimeString('pt-BR') }),
        el('span', { class: 'h-label', text: h.label }),
        i < history.undo.length - 1 ? el('button', { text: 'Recuperar este estado', onclick: () => { App.closeModal(); App.restoreHistory(i); } }) : el('em', { class: 'muted', text: 'atual' })
      ]);
    }));
    App.modal({ title: 'Histórico de alterações', body: el('div', {}, [el('p', { class: 'muted small', text: 'Cada operação do projeto (inserir, mover, excluir, substituir, alterações em massa…) fica registrada. Recuperar um estado também pode ser desfeito.' }), list]), buttons: [{ label: 'Fechar' }] });
  };

  // ---------------------------------------------------------------- imagens do projeto
  const blobUrls = {};
  App.dataUrlToBlob = function (dataUrl) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    let bytes;
    if (m[2]) { const bin = atob(m[3]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
    return new Blob([bytes], { type: m[1] });
  };
  App.assetUrl = function (id) {
    const a = App.project.assets[id];
    if (!a) return '';
    if (!blobUrls[id] || blobUrls[id].src !== a.dataUrl) {
      if (blobUrls[id]) URL.revokeObjectURL(blobUrls[id].url);
      const b = App.dataUrlToBlob(a.dataUrl);
      blobUrls[id] = { src: a.dataUrl, url: b ? URL.createObjectURL(b) : a.dataUrl };
    }
    return blobUrls[id].url;
  };
  App.hashDataUrl = async function (dataUrl) {
    const b = App.dataUrlToBlob(dataUrl);
    if (!b) return '';
    const buf = await crypto.subtle.digest('SHA-1', await b.arrayBuffer());
    return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
  };
  App.imageSize = dataUrl => new Promise(res => { const i = new Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => res({ width: 0, height: 0 }); i.src = dataUrl; });
  App.urlToDataUrl = async function (url) {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  };
  App.fileToDataUrl = file => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });

  // Adiciona (ou reaproveita, se for idêntica) uma imagem ao projeto e devolve o id
  App.addAsset = async function (a) {
    const hash = a.hash || await App.hashDataUrl(a.dataUrl);
    const existing = Object.values(App.project.assets).find(x => x.hash === hash);
    if (existing) return existing.id;
    let { width, height } = a;
    if (!width || !height) ({ width, height } = await App.imageSize(a.dataUrl));
    let info = a.info;
    if (!info) info = await api.analyzeImage(a.dataUrl);
    const id = D.uid('img');
    App.project.assets[id] = { id, name: a.name || 'imagem', dataUrl: a.dataUrl, width, height, hash, info: info || {}, source: a.source || '', kind: a.kind || 'corpo', added: Date.now() };
    return id;
  };
  App.addAssetFromUrl = async function (url, meta) {
    const dataUrl = await App.urlToDataUrl(url);
    return App.addAsset(Object.assign({ dataUrl }, meta || {}));
  };

  // Onde cada imagem é usada no projeto
  App.assetUsage = function () {
    const use = {};
    const add = (id, where) => { (use[id] = use[id] || []).push(where); };
    const scan = (html, where) => String(html || '').replace(/data-asset="([^"]+)"/g, (m, id) => { add(id, where); return m; });
    const p = App.project;
    p.chapters.forEach(c => {
      const seen = new Set();
      String(c.html || '').replace(/data-asset="([^"]+)"/g, (m, id) => { if (!seen.has(id)) { seen.add(id); add(id, { chapter: c.id, label: c.title }); } return m; });
      if (c.openingImage && c.openingImage.asset) add(c.openingImage.asset, { chapter: c.id, label: c.title + ' (abertura)' });
      if (c.separator && p.assets[c.separator]) add(c.separator, { chapter: c.id, label: c.title + ' (separador)' });
    });
    scan(p.back.bio.html, { label: 'Sobre o autor' });
    scan(p.back.extra.html, { label: 'Conteúdo extra' });
    if (p.back.bio.photo) add(p.back.bio.photo, { label: 'Foto do autor' });
    if (p.titlePage.logo) add(p.titlePage.logo, { label: 'Logotipo (folha de rosto)' });
    if (p.settings.separatorAsset) add(p.settings.separatorAsset, { label: 'Separador padrão' });
    (p.catalog.images || []).forEach(im => add(im.asset, { label: 'Ficha catalográfica' }));
    (p.overlays || []).forEach(o => { if (o.asset) add(o.asset, { label: `Camada “${o.name}” (pág. ${o.pages})` }); });
    if (p.cover) ['front', 'back', 'spine', 'flapFront', 'flapBack', 'wrap', 'logo'].forEach(k => { if (p.cover.images && p.cover.images[k]) add(p.cover.images[k].asset, { label: 'Capa (' + k + ')' }); });
    return use;
  };
  App.missingAssets = function () {
    const ids = new Set();
    const p = App.project;
    const scan = html => String(html || '').replace(/data-asset="([^"]+)"/g, (m, id) => { if (!p.assets[id]) ids.add(id); return m; });
    p.chapters.forEach(c => scan(c.html));
    scan(p.back.bio.html); scan(p.back.extra.html);
    return [...ids];
  };

  // ---------------------------------------------------------------- diálogos
  App.modal = function ({ title, body, buttons, wide, onClose }) {
    App.closeModal();
    const root = $('#modalRoot');
    const box = el('div', { class: 'modal' + (wide ? ' wide' : '') }, [
      el('div', { class: 'modal-head' }, [el('h2', { text: title || '' }), el('button', { class: 'ghost', text: '✕', onclick: () => App.closeModal() })]),
      el('div', { class: 'modal-body' }, [body]),
      el('div', { class: 'modal-foot' }, (buttons || [{ label: 'Fechar' }]).map(b => el('button', {
        class: b.primary ? 'primary' : b.danger ? 'danger' : '', text: b.label,
        onclick: async () => { if (b.onClick) { const r = await b.onClick(); if (r === false) return; } App.closeModal(); }
      })))
    ]);
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) App.closeModal(); } }, [box]);
    back._onClose = onClose;
    root.appendChild(back);
    const first = box.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return box;
  };
  App.closeModal = function () {
    const root = $('#modalRoot');
    Array.from(root.children).forEach(c => { if (c._onClose) c._onClose(); c.remove(); });
  };
  App.prompt = function (title, label, value, opts) {
    opts = opts || {};
    return new Promise(res => {
      const input = opts.multiline ? el('textarea', { rows: 4 }) : el('input', { type: 'text' });
      input.value = value || '';
      let done = false;
      const finish = v => { if (!done) { done = true; res(v); } };
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !opts.multiline) { finish(input.value); App.closeModal(); } });
      App.modal({ title, body: el('label', { class: 'field' }, [el('span', { class: 'flabel', text: label }), input]), buttons: [{ label: 'Cancelar', onClick: () => finish(null) }, { label: opts.ok || 'OK', primary: true, onClick: () => finish(input.value) }], onClose: () => finish(null) });
    });
  };
  // Confirmação com prévia das mudanças (operações em massa)
  App.confirmPreview = function (title, intro, items, okLabel) {
    return new Promise(res => {
      let done = false;
      const finish = v => { if (!done) { done = true; res(v); } };
      const list = el('ul', { class: 'preview-list' }, items.slice(0, 200).map(t => el('li', { text: t })));
      if (items.length > 200) list.appendChild(el('li', { class: 'muted', text: `… e mais ${items.length - 200}` }));
      App.modal({ title, body: el('div', {}, [el('p', { text: intro }), list, el('p', { class: 'muted small', text: 'Você poderá desfazer esta operação (Desfazer / Histórico).' })]), buttons: [{ label: 'Cancelar', onClick: () => finish(false) }, { label: okLabel || 'Aplicar', primary: true, onClick: () => finish(true) }], onClose: () => finish(false) });
    });
  };

  // ---------------------------------------------------------------- campos de formulário
  App.field = function (label, input, hint, cls) {
    return el('label', { class: 'field' + (cls ? ' ' + cls : '') }, [el('span', { class: 'flabel', text: label }), input, hint ? el('span', { class: 'hint', text: hint }) : null]);
  };
  App.card = function (title, children, desc, cls) {
    return el('div', { class: 'card' + (cls ? ' ' + cls : '') }, [el('h3', { text: title }), desc ? el('p', { class: 'muted small', text: desc }) : null, el('div', { class: 'grid' }, children)]);
  };

  // Liga um campo a obj[key]. opts: type, options, min, max, step, unit ('len' => mm convertidos), onChange, label (história)
  App.bind = function (obj, key, type, opts) {
    opts = opts || {};
    let input;
    const isLen = opts.len;
    const show = v => (isLen ? +D.toUnit(Number(v) || 0, App.unit).toFixed(App.unit === 'mm' ? 2 : 3) : v);
    if (type === 'textarea') { input = el('textarea', { rows: opts.rows || 3, placeholder: opts.placeholder || '' }); input.value = obj[key] || ''; }
    else if (type === 'checkbox') { input = el('input', { type: 'checkbox' }); input.checked = !!obj[key]; }
    else if (type === 'color') { input = el('input', { type: 'color' }); input.value = /^#[0-9a-f]{6}$/i.test(obj[key] || '') ? obj[key] : (opts.fallback || '#000000'); }
    else if (type === 'select') {
      input = el('select');
      (opts.options || []).forEach(o => {
        if (o.group) {
          const g = el('optgroup', { label: o.group });
          o.items.forEach(it => g.appendChild(el('option', { value: it.value, text: it.label })));
          input.appendChild(g);
        } else input.appendChild(el('option', { value: o.value, text: o.label }));
      });
      input.value = obj[key] == null ? '' : obj[key];
      if (input.value !== String(obj[key] == null ? '' : obj[key]) && obj[key]) { input.appendChild(el('option', { value: obj[key], text: obj[key] + ' (indisponível)' })); input.value = obj[key]; }
    } else if (type === 'number') {
      input = el('input', { type: 'number', step: isLen && App.unit !== 'mm' ? 'any' : (opts.step || 1), min: opts.min !== undefined ? show(opts.min) : undefined, max: opts.max !== undefined ? show(opts.max) : undefined });
      input.value = obj[key] === '' || obj[key] == null ? '' : show(obj[key]);
    } else { input = el('input', { type: 'text', placeholder: opts.placeholder || '' }); input.value = obj[key] == null ? '' : obj[key]; }
    if (opts.disabled) input.disabled = true;
    const evt = type === 'checkbox' || type === 'select' || type === 'color' ? 'change' : 'input';
    let commitTimer = null;
    input.addEventListener(evt, () => {
      let v = type === 'checkbox' ? input.checked : input.value;
      if (type === 'number') {
        if (String(v).trim() === '' && opts.allowEmpty) v = '';
        else {
          v = parseFloat(String(v).replace(',', '.'));
          if (!isFinite(v)) return;
          if (isLen) v = D.fromUnit(v, App.unit);
          if (opts.min !== undefined) v = Math.max(opts.min, v);
          if (opts.max !== undefined) v = Math.min(opts.max, v);
          v = +v.toFixed(3);
        }
      }
      obj[key] = v;
      if (opts.onChange) opts.onChange(v);
      App.changed(null);
      clearTimeout(commitTimer);
      commitTimer = setTimeout(() => App.commit(opts.label || 'Alteração de configuração'), 900);
    });
    return input;
  };
  App.unitLabel = () => ({ mm: 'mm', cm: 'cm', in: 'pol.', pt: 'pt' }[App.unit]);

  // Lista de famílias para seletores de fonte
  App.fontOptions = function (includeInherit) {
    const opts = [];
    if (includeInherit) opts.push({ value: '', label: '(mesma do texto principal)' });
    opts.push({ group: 'Embutidas no aplicativo', items: App.fontFamilies.bundled.map(f => ({ value: f, label: f })) });
    if (App.fontFamilies.library.length) opts.push({ group: 'Minha biblioteca de fontes', items: App.fontFamilies.library.map(f => ({ value: f.family, label: f.family + (f.embeddable ? '' : ' ⚠ não incorporável') })) });
    if (App.fontFamilies.system.length) opts.push({ group: 'Fontes do computador', items: App.fontFamilies.system.map(f => ({ value: f.family, label: f.family + (f.embeddable ? '' : ' ⚠ não incorporável') })) });
    return opts;
  };
  App.refreshFonts = async function (force) {
    try {
      const [lib, sys] = await Promise.all([api.fontsLibrary(), api.fontsSystem(force)]);
      App.fontFamilies.library = lib;
      const libNames = new Set(lib.map(f => f.family));
      App.fontFamilies.system = sys.filter(f => !libNames.has(f.family) && !D.BUNDLED_FONTS.includes(f.family));
    } catch (e) { console.error(e); }
  };
  App.allFontNames = () => new Set([...App.fontFamilies.bundled, ...App.fontFamilies.library.map(f => f.family), ...App.fontFamilies.system.map(f => f.family)]);

  // Carrega @font-face de fontes da biblioteca/sistema na interface (editor, galeria)
  const loadedFontCss = new Set();
  App.ensureFonts = async function (families) {
    const need = families.filter(f => f && !loadedFontCss.has(f) && !D.BUNDLED_FONTS.includes(f));
    if (!need.length) return;
    need.forEach(f => loadedFontCss.add(f));
    const r = await api.fontsCss(need);
    if (r && r.css) document.head.appendChild(el('style', { text: r.css }));
  };

  App.setView = function (view, chapterId, opts) {
    opts = opts || {};
    if (!opts.noFlush) App.flush();
    App.view = view;
    if (chapterId !== undefined) App.chapterId = chapterId;
    $$('.view').forEach(v => v.classList.remove('active'));
    const sec = $('#view-' + view);
    if (sec) sec.classList.add('active');
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.body.dataset.view = view;
    const fn = App.hooks.viewRender[view];
    if (fn) fn();
    if (App.renderChapterList) App.renderChapterList();
    if (App.preview) App.preview.setLayerEditing(view === 'layers');
  };

  return App;
})();
