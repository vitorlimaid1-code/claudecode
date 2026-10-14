/* global App, BookText */
// Edição direta nas páginas: o texto é digitado na própria página paginada. Cada alteração é levada ao
// texto do capítulo (o editor oculto, que é o modelo) e o capítulo é repaginado logo depois, sem travar.
//
// Como funciona: o texto visível de um capítulo (em todas as páginas) e o texto do modelo são lidos como
// uma sequência de caracteres (“texto V”): parágrafos separados por ¶, notas/figuras como um objeto, sem
// hifens automáticos nem marcas invisíveis. Uma digitação muda o texto V das páginas; a diferença (posição,
// trecho apagado, trecho novo) é aplicada no mesmo ponto do modelo, através de um alinhamento entre os dois.
(function () {
  const { $ } = App;
  const SEP = ' ';
  const OBJ = '￼';
  const BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'FIGCAPTION', 'CAPTION', 'PRE', 'SECTION', 'DL', 'DT', 'DD', 'ASIDE', 'HEADER', 'FOOTER']);
  const STRIP = /[­​⁠-⁤﻿]/;
  const INLINE_FMT = new Set(['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'removeFormat']);

  const L = App.live = { enabled: true };
  let stageDoc = null;
  let state = null; // { chId, idx, R, S, r2s, s2r? }
  let lock = null; // cursor a recolocar depois da próxima paginação: { chId, caret: [a, b] (posições do modelo) }
  let lastFocus = 'stage';
  App.editSeq = App.editSeq || 0;

  // ---------------------------------------------------------------- texto V
  // side 'S' (modelo, editor) ou 'R' (páginas). Devolve { text, after: [], start: Map, end: Map, kept: Map }
  function buildV(roots, side, opts) {
    opts = opts || {};
    const out = [];
    const after = []; // ponto do DOM logo depois de cada unidade
    const start = new Map();
    const end = new Map();
    const notesHidden = !!opts.notesHidden;
    let lastSepIdx = -1;
    const push = (ch, pt) => { out.push(ch); after.push(pt); };
    const isAtom = el => {
      if (el.tagName === 'IMG' || el.tagName === 'HR' || el.tagName === 'FIGURE') return true;
      if (el.classList.contains('fullbleed')) return true;
      if (el.classList.contains('xref-auto')) return true;
      if (side === 'S') return el.classList.contains('footnote') && !notesHidden;
      return el.hasAttribute('data-footnote-call') || el.classList.contains('en-call') || el.classList.contains('sn-call');
    };
    const isSkip = el => {
      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return true;
      if (side === 'S') return el.classList.contains('comment') || (notesHidden && el.classList.contains('footnote'));
      return el.classList.contains('xref-num') || el.classList.contains('sidenote') || el.classList.contains('footnote') || el.dataset.note === 'footnote' || el.classList.contains('endnotes') || el.classList.contains('sn-box') || el.classList.contains('guide');
    };
    const visit = node => {
      start.set(node, out.length);
      if (node.nodeType === 3) {
        const d = node.data;
        let n = d.length;
        if (side === 'R' && d.endsWith('‑') && node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('pagedjs_hyphen')) n -= 1;
        for (let i = 0; i < n; i++) {
          const c = d[i];
          if (STRIP.test(c)) continue;
          push(c === ' ' ? ' ' : c === '\n' || c === '\r' || c === '\t' ? ' ' : c, [node, i + 1]);
        }
      } else if (node.nodeType === 1) {
        const el = node;
        if (isSkip(el)) { end.set(node, out.length); return; }
        const parent = el.parentNode;
        if (isAtom(el)) {
          if (BLOCK.has(el.tagName) || el.tagName === 'FIGURE' || el.tagName === 'HR' || el.classList.contains('fullbleed')) sep(el, true);
          push(OBJ, [parent, Array.prototype.indexOf.call(parent.childNodes, el) + 1]);
          end.set(node, out.length);
          return;
        }
        if (el.tagName === 'BR') {
          // <br> no fim do bloco só segura a linha vazia: não conta
          if (el.nextSibling || !(el.parentNode && BLOCK.has(el.parentNode.tagName))) push('\n', [parent, Array.prototype.indexOf.call(parent.childNodes, el) + 1]);
          end.set(node, out.length);
          return;
        }
        if (BLOCK.has(el.tagName) && !(side === 'R' && el.hasAttribute('data-split-from'))) sep(el, false);
        for (let c = el.firstChild; c; c = c.nextSibling) visit(c);
      }
      end.set(node, out.length);
    };
    // abre um bloco: um separador (nunca dois seguidos); o ponto depois dele é o início do bloco
    function sep(el, atom) {
      if (!out.length) return;
      if (out[out.length - 1] === SEP) { if (!atom) after[lastSepIdx] = [el, 0]; return; }
      push(SEP, [el, 0]);
      lastSepIdx = out.length - 1;
      if (atom) after[lastSepIdx] = [el.parentNode, Array.prototype.indexOf.call(el.parentNode.childNodes, el)];
    }
    roots.forEach(r => { start.set(r, out.length); for (let c = r.firstChild; c; c = c.nextSibling) visit(c); end.set(r, out.length); });
    return { text: out.join(''), after, start, end, roots };
  }

  // posição V de um ponto do DOM (nó, deslocamento)
  function posOf(V, node, offset) {
    if (!node) return null;
    if (node.nodeType === 3) {
      const s = V.start.get(node);
      if (s === undefined) return null;
      let k = 0;
      const d = node.data;
      for (let i = 0; i < Math.min(offset, d.length); i++) if (!STRIP.test(d[i])) k++;
      const lim = (V.end.get(node) || s) - s;
      return s + Math.min(k, lim);
    }
    const kids = node.childNodes;
    if (offset < kids.length) { const v = V.start.get(kids[offset]); if (v !== undefined) return v; }
    const v = V.end.get(node);
    if (v !== undefined) return v;
    // nó fora do texto V: procura o ancestral mais próximo
    let p = node.parentNode;
    while (p && !V.start.has(p)) p = p.parentNode;
    return p ? V.start.get(p) : null;
  }
  // ponto do DOM para uma posição V
  function pointAt(V, pos) {
    if (pos <= 0) {
      const r = V.roots[0];
      let first = r;
      while (first.firstChild && first.firstChild.nodeType === 1 && BLOCK.has(first.firstChild.tagName)) first = first.firstChild;
      return [first, 0];
    }
    const pt = V.after[Math.min(pos, V.after.length) - 1];
    return pt || [V.roots[V.roots.length - 1], V.roots[V.roots.length - 1].childNodes.length];
  }

  // ---------------------------------------------------------------- alinhamento modelo ↔ páginas
  // Myers (O((N+M)·D)) só no miolo diferente; devolve r2s (posição nas páginas -> posição no modelo)
  function align(S, R) {
    const n = S.length, m = R.length;
    let p = 0;
    while (p < n && p < m && S[p] === R[p]) p++;
    let q = 0;
    while (q < n - p && q < m - p && S[n - 1 - q] === R[m - 1 - q]) q++;
    const r2s = new Int32Array(m + 1);
    for (let i = 0; i <= p; i++) r2s[i] = i;
    for (let i = 0; i <= q; i++) r2s[m - i] = n - i;
    const A = S.slice(p, n - q), B = R.slice(p, m - q);
    if (!A.length || !B.length) {
      for (let i = p + 1; i < m - q; i++) r2s[i] = p + A.length;
      return r2s;
    }
    const N = A.length, M = B.length, MAX = Math.min(N + M, 4000);
    const off = MAX + 1;
    const v = new Int32Array(2 * MAX + 3);
    const trace = [];
    let found = -1;
    for (let d = 0; d <= MAX; d++) {
      trace.push(v.slice(off - d - 1, off + d + 2));
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
        let y = x - k;
        while (x < N && y < M && A[x] === B[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= N && y >= M) { found = d; break; }
      }
      if (found >= 0) break;
    }
    if (found < 0) {
      // diferenças demais: proporcional
      for (let i = 1; i < M; i++) r2s[p + i] = p + Math.round(i * N / M);
      return r2s;
    }
    // volta pelo caminho, marcando cada posição de B
    let x = N, y = M;
    const mapB = new Int32Array(M + 1);
    mapB[M] = N;
    for (let d = found; d > 0; d--) {
      const tv = trace[d]; // v antes do passo d (janela -d-1 .. d+1)
      const get = k => tv[k + d + 1];
      const k = x - y;
      const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
      const prevX = get(prevK), prevY = prevX - prevK;
      while (x > prevX && y > prevY) { x--; y--; mapB[y] = x; }
      if (x === prevX) { y--; mapB[y] = x; } else { x--; }
      x = prevX; y = prevY;
    }
    while (x > 0 && y > 0) { x--; y--; mapB[y] = x; }
    while (y > 0) { y--; mapB[y] = 0; }
    for (let i = 1; i < M; i++) r2s[p + i] = p + mapB[i];
    return r2s;
  }
  function s2rOf(st, s) {
    // inverso monótono de r2s
    const r2s = st.r2s;
    let lo = 0, hi = r2s.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (r2s[mid] < s) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // ---------------------------------------------------------------- páginas do capítulo
  const chIndex = id => App.project.chapters.findIndex(c => c.id === id);
  function hostsOf(idx) {
    if (!stageDoc || idx < 0) return [];
    return Array.from(stageDoc.querySelectorAll(`.pagedjs_page section[data-chapter="${idx}"] > .chapter-body`));
  }
  function notesHidden() { return App.project.settings.footnotesVisible === false; }
  function modelV() { return buildV([$('#editor')], 'S', { notesHidden: notesHidden() }); }
  function stageV(idx) { return buildV(hostsOf(idx), 'R'); }

  // prepara o estado de edição do capítulo (texto das páginas + alinhamento com o modelo)
  function ensureState(chId) {
    const idx = chIndex(chId);
    if (state && state.chId === chId && state.idx === idx && !state.stale) return state;
    if (App.editorChapterId !== chId) return null;
    const R = stageV(idx);
    const S = modelV();
    state = { chId, idx, R, S, r2s: align(S.text, R.text) };
    return state;
  }

  // ---------------------------------------------------------------- aplicar no modelo
  const blockOf = (node, root) => {
    let n = node.nodeType === 1 ? node : node.parentNode;
    while (n && n !== root && !(n.nodeType === 1 && BLOCK.has(n.tagName) && n.tagName !== 'UL' && n.tagName !== 'OL' && n.tagName !== 'TABLE' && n.tagName !== 'TBODY' && n.tagName !== 'TR' && n.tagName !== 'BLOCKQUOTE')) n = n.parentNode;
    return n && n !== root ? n : null;
  };
  function insertTextAt(range, text) {
    // texto com \n vira <br>
    const parts = text.split('\n');
    let node = null;
    parts.forEach((t, i) => {
      if (i > 0) { const br = document.createElement('br'); range.insertNode(br); range.setStartAfter(br); range.collapse(true); }
      if (!t) return;
      const sc = range.startContainer;
      if (sc.nodeType === 3) { sc.insertData(range.startOffset, t); range.setStart(sc, range.startOffset + t.length); range.collapse(true); node = sc; }
      else { node = document.createTextNode(t); range.insertNode(node); range.setStartAfter(node); range.collapse(true); }
    });
    return node;
  }
  function splitBlockAt(range, root) {
    const blk = blockOf(range.startContainer, root);
    if (!blk) {
      // texto solto no primeiro nível: embrulha num parágrafo
      const p = document.createElement('p');
      range.insertNode(p);
      range.setStart(p, 0); range.collapse(true);
      return p;
    }
    const tail = document.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEnd(blk, blk.childNodes.length);
    const frag = tail.extractContents();
    const atEnd = !frag.textContent.length && !frag.querySelector('img, figure, br, .footnote');
    const nb = (atEnd && /^H[1-6]$/.test(blk.tagName)) ? document.createElement('p') : blk.cloneNode(false);
    ['id', 'data-split-from', 'data-split-to', 'data-src', 'data-ref'].forEach(a => nb.removeAttribute(a));
    nb.appendChild(frag);
    if (!nb.firstChild || (nb.textContent === '' && !nb.querySelector('img, br'))) nb.appendChild(document.createElement('br'));
    if (!blk.firstChild || (blk.textContent === '' && !blk.querySelector('img, br, .footnote'))) blk.appendChild(document.createElement('br'));
    blk.after(nb);
    const r = document.createRange();
    r.setStart(nb, 0); r.collapse(true);
    return r;
  }
  // substitui [a, b) do modelo por ins (com ¶ para novos parágrafos e \n para quebras de linha)
  function replaceModel(a, b, ins) {
    const ed = $('#editor');
    let V = modelV();
    const removed = V.text.slice(a, b);
    let range = document.createRange();
    const pa = pointAt(V, a);
    range.setStart(pa[0], pa[1]);
    if (b > a) {
      const pb = pointAt(V, b);
      range.setEnd(pb[0], pb[1]);
      const startBlk = blockOf(range.startContainer, ed);
      const endBlk = blockOf(range.endContainer, ed);
      range.deleteContents();
      if (removed.includes(SEP) && startBlk && endBlk && startBlk !== endBlk && endBlk.isConnected && startBlk.isConnected) {
        // junta os parágrafos: o que sobrou do último vai para o fim do primeiro
        const placeholder = startBlk.lastChild && startBlk.lastChild.nodeName === 'BR' && startBlk.childNodes.length === 1 ? startBlk.lastChild : null;
        if (placeholder) placeholder.remove();
        const caret = document.createRange();
        caret.setStart(startBlk, startBlk.childNodes.length); caret.collapse(true);
        while (endBlk.firstChild) startBlk.appendChild(endBlk.firstChild);
        let par = endBlk.parentNode;
        endBlk.remove();
        while (par && par !== ed && !par.textContent.trim() && !par.querySelector('img, figure, br')) { const up = par.parentNode; par.remove(); par = up; }
        range = caret;
      } else if (startBlk && startBlk.isConnected && !startBlk.textContent && !startBlk.querySelector('img, br, figure, .footnote')) {
        startBlk.appendChild(document.createElement('br'));
        range.setStart(startBlk, 0); range.collapse(true);
      }
    }
    if (ins) {
      const chunks = ins.split(SEP);
      chunks.forEach((t, i) => {
        if (i > 0) range = splitBlockAt(range, ed);
        if (t) {
          // um parágrafo só com <br> perde o <br> quando ganha texto
          const sc = range.startContainer;
          if (sc.nodeType === 1 && sc.childNodes.length === 1 && sc.firstChild.nodeName === 'BR') sc.firstChild.remove();
          insertTextAt(range, t.replace(new RegExp(OBJ, 'g'), ''));
        }
      });
    }
    ed.normalize();
    return true;
  }

  // ---------------------------------------------------------------- sincronização após digitar
  let syncing = false;
  function syncFromStage() {
    if (!state || syncing) return;
    syncing = true;
    try {
      const st = state;
      const R2 = stageV(st.idx);
      const A = st.R.text, B = R2.text;
      if (A === B) { st.R = R2; return; }
      let p = 0;
      while (p < A.length && p < B.length && A[p] === B[p]) p++;
      let q = 0;
      while (q < A.length - p && q < B.length - p && A[A.length - 1 - q] === B[B.length - 1 - q]) q++;
      // a posição do cursor desfaz empates (digitar “a” depois de “a”, apagar uma de duas letras iguais)
      const sel = stageDoc.getSelection();
      if (sel && sel.rangeCount && sel.isCollapsed) {
        const cp = posOf(R2, sel.focusNode, sel.focusOffset);
        const dl = B.length - A.length;
        if (cp !== null && dl > 0 && B.length - p - q === dl) {
          const p2 = cp - dl;
          if (p2 >= 0 && p2 !== p && A.slice(0, p2) === B.slice(0, p2) && A.slice(p2) === B.slice(cp)) { p = p2; q = A.length - p2; }
        } else if (cp !== null && dl < 0 && A.length - p - q === -dl) {
          const p2 = cp;
          if (p2 !== p && A.slice(0, p2) === B.slice(0, p2) && A.slice(p2 - dl) === B.slice(p2)) { p = p2; q = B.length - p2; }
        }
      }
      const oldEnd = A.length - q;
      const ins = B.slice(p, B.length - q);
      const a = st.r2s[p], b = st.r2s[oldEnd];
      replaceModel(a, Math.max(a, b), ins);
      // alinhamento atualizado sem recalcular tudo
      const delta = ins.length - (b - a);
      const r2s = new Int32Array(B.length + 1);
      for (let i = 0; i <= p; i++) r2s[i] = st.r2s[i];
      for (let i = 1; i <= ins.length; i++) r2s[p + i] = a + i;
      for (let i = oldEnd + 1, j = p + ins.length + 1; i < st.r2s.length; i++, j++) r2s[j] = st.r2s[i] + delta;
      st.r2s = r2s;
      st.R = R2;
      st.S = modelV();
      modelChanged('Edição de texto');
    } catch (e) {
      console.error('edição direta', e);
      state = null;
    } finally { syncing = false; }
  }
  function modelChanged(label) {
    App.editSeq++;
    $('#editor').dispatchEvent(new Event('input', { bubbles: true }));
    if (label && label !== 'Edição de texto') App.changed(label);
  }

  // ---------------------------------------------------------------- cursor ↔ modelo
  function stageSelection() {
    if (!stageDoc || !state) return null;
    const sel = stageDoc.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const a = posOf(state.R, sel.anchorNode, sel.anchorOffset);
    const f = posOf(state.R, sel.focusNode, sel.focusOffset);
    if (a === null || f === null) return null;
    return [state.r2s[Math.min(a, f)], state.r2s[Math.max(a, f)]];
  }
  function setEditorSelection(sa, sb) {
    const V = modelV();
    const ed = $('#editor');
    const pa = pointAt(V, sa), pb = pointAt(V, sb);
    const r = document.createRange();
    try { r.setStart(pa[0], pa[1]); r.setEnd(pb[0], pb[1]); } catch (e) { r.selectNodeContents(ed); r.collapse(true); }
    ed.focus({ preventScroll: true });
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function editorSelectionPos() {
    const sel = window.getSelection();
    const ed = $('#editor');
    if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return null;
    const V = modelV();
    const a = posOf(V, sel.anchorNode, sel.anchorOffset), f = posOf(V, sel.focusNode, sel.focusOffset);
    if (a === null || f === null) return null;
    return [Math.min(a, f), Math.max(a, f)];
  }
  function restoreStageCaret(sa, sb) {
    const st = ensureState(App.editorChapterId);
    if (!st) return;
    const ra = s2rOf(st, sa), rb = s2rOf(st, sb);
    const pa = pointAt(st.R, ra), pb = pointAt(st.R, rb);
    if (!pa || !pb) return;
    const host = (pa[0].nodeType === 1 ? pa[0] : pa[0].parentNode).closest('.chapter-body');
    if (!host) return;
    try {
      host.focus({ preventScroll: true });
      const sel = stageDoc.getSelection();
      sel.setBaseAndExtent(pa[0], pa[1], pb[0], pb[1]);
      const el = (pb[0].nodeType === 1 ? pb[0] : pb[0].parentNode);
      const r = el.getBoundingClientRect();
      const vh = stageDoc.defaultView.innerHeight;
      if (r.bottom < 0 || r.top > vh) el.scrollIntoView({ block: 'center' });
    } catch (e) { /* ok */ }
  }

  // edição feita no modelo (barra de ferramentas, colar, desfazer…): a página fica só leitura até a nova paginação
  L.runOnModel = function (fn, label) {
    const c = App.chapter();
    if (!c || c.locked) return;
    if (lastFocus === 'stage') ensureState(c.id);
    const sel = lastFocus === 'stage' && state && state.chId === c.id ? stageSelection() : null;
    if (sel) setEditorSelection(sel[0], sel[1]);
    const r = fn();
    const after = editorSelectionPos() || sel;
    beginLock(after);
    return r;
  };
  function beginLock(caret) {
    if (!App.editorChapterId) return;
    // o texto das páginas ainda não mostra a mudança: o alinhamento é refeito na próxima digitação
    state = null;
    lock = { chId: App.editorChapterId, caret, t: Date.now() };
  }

  // ---------------------------------------------------------------- páginas editáveis
  function attachHosts() {
    if (!stageDoc) return;
    const can = L.enabled && App.view !== 'layers';
    stageDoc.querySelectorAll('.pagedjs_page section[data-chapter]').forEach(sec => {
      const c = App.project.chapters[Number(sec.dataset.chapter)];
      const ok = can && c && !c.locked;
      const body = sec.querySelector(':scope > .chapter-body');
      if (body) {
        if (ok) { body.setAttribute('contenteditable', 'true'); body.spellcheck = true; body.lang = App.project.meta.language || 'pt-BR'; }
        else body.removeAttribute('contenteditable');
        body.querySelectorAll('figure, .fig, img, hr, .xref-auto, [data-footnote-call], .en-call, .sn-call, .sidenote, table caption').forEach(x => x.setAttribute('contenteditable', 'false'));
      }
      const title = sec.querySelector(':scope > .chapter-head .chapter-title');
      if (title) { if (ok) title.setAttribute('contenteditable', 'plaintext-only'); else title.removeAttribute('contenteditable'); }
    });
  }

  // capítulo da posição do cursor nas páginas
  function chapterOfNode(n) {
    const el = n && (n.nodeType === 1 ? n : n.parentNode);
    const sec = el && el.closest && el.closest('section[data-chapter]');
    if (!sec) return null;
    return App.project.chapters[Number(sec.dataset.chapter)] || null;
  }
  function activate(c) {
    if (!c) return false;
    if (App.view !== 'chapter' || App.editorChapterId !== c.id) {
      App._liveNoScroll = true;
      try { App.setView('chapter', c.id); } finally { App._liveNoScroll = false; }
    }
    lastFocus = 'stage';
    return !!ensureState(c.id);
  }

  // ---------------------------------------------------------------- eventos das páginas
  function wire(d) {
    if (d.__liveWired) return;
    d.__liveWired = true;
    const st = d.createElement('style');
    st.textContent = `
      .chapter-body[contenteditable="true"] { outline: none; caret-color: #111; cursor: text; }
      .chapter-head .chapter-title[contenteditable] { outline: none; cursor: text; }
      .chapter-head .chapter-title[contenteditable]:focus { box-shadow: 0 1px 0 rgba(0,0,0,.25); }
      .chapter-body [data-src]:focus-within { }
      ::selection { background: rgba(70, 120, 220, .28); }`;
    d.head.appendChild(st);

    d.addEventListener('focusin', e => {
      const c = chapterOfNode(e.target);
      if (!c) return;
      if (e.target.classList && e.target.classList.contains('chapter-title')) { activate(c); return; }
      activate(c);
    });
    d.addEventListener('beforeinput', e => {
      const t = e.target;
      if (t.classList && t.classList.contains('chapter-title')) {
        if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); t.blur(); }
        return;
      }
      const host = t.closest && t.closest('.chapter-body');
      if (!host) return;
      const c = chapterOfNode(host);
      if (!c || c.locked) { e.preventDefault(); return; }
      if (!activate(c)) { e.preventDefault(); return; }
      const type = e.inputType;
      if (type === 'historyUndo' || type === 'historyRedo') { e.preventDefault(); undo(type === 'historyRedo'); return; }
      if (type.startsWith('format')) {
        e.preventDefault();
        const map = { formatBold: 'bold', formatItalic: 'italic', formatUnderline: 'underline', formatStrikeThrough: 'strikeThrough', formatSuperscript: 'superscript', formatSubscript: 'subscript', formatRemove: 'removeFormat' };
        if (map[type]) L.exec(map[type]);
        return;
      }
      if (type === 'insertFromDrop' || type === 'deleteByDrag' || type === 'insertFromYank') { e.preventDefault(); return; }
      if (type === 'insertParagraph') { e.preventDefault(); splitInStage(); return; }
      // apagar além do começo/fim de uma página: feito no modelo
      const sel = d.getSelection();
      if (sel && sel.rangeCount && (type === 'deleteContentBackward' || type === 'deleteContentForward' || type === 'deleteWordBackward' || type === 'deleteWordForward') && sel.isCollapsed) {
        const r = sel.getRangeAt(0);
        const probe = d.createRange();
        probe.selectNodeContents(host);
        if (type.endsWith('Backward')) probe.setEnd(r.startContainer, r.startOffset); else probe.setStart(r.endContainer, r.endOffset);
        const empty = !probe.toString().replace(/[­​]/g, '').length && !probe.cloneContents().querySelector('img, br, a[data-footnote-call]');
        if (empty) {
          e.preventDefault();
          const st2 = ensureState(c.id);
          const p = posOf(st2.R, r.startContainer, r.startOffset);
          if (p === null) return;
          const s = st2.r2s[p];
          const V = modelV();
          if (type.endsWith('Backward') && s > 0) { replaceModel(s - 1, s, ''); after1(s - 1); }
          else if (type.endsWith('Forward') && s < V.text.length) { replaceModel(s, s + 1, ''); after1(s); }
          return;
        }
      }
      // seleção que atravessa páginas: feito no modelo
      if (sel && sel.rangeCount && !sel.isCollapsed) {
        const r = sel.getRangeAt(0);
        const h1 = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode).closest('.chapter-body');
        const h2 = (r.endContainer.nodeType === 1 ? r.endContainer : r.endContainer.parentNode).closest('.chapter-body');
        if (h1 !== h2) {
          e.preventDefault();
          const ss = stageSelection();
          if (!ss) return;
          const txt = type === 'insertText' || type === 'insertReplacementText' ? (e.data || '') : '';
          replaceModel(ss[0], ss[1], txt);
          after1(ss[0] + txt.length);
        }
      }
      function after1(pos) { state.stale = true; modelChanged('Edição de texto'); beginLock([pos, pos]); }
    });
    d.addEventListener('input', e => {
      const t = e.target;
      if (t.classList && t.classList.contains('chapter-title')) {
        const c = chapterOfNode(t);
        if (!c || c.locked) return;
        c.title = t.textContent.replace(/\s+/g, ' ').trim();
        if (App.editorChapterId === c.id) $('#chapterTitle').value = c.title;
        App.editSeq++;
        App.changed(null);
        App.renderChapterList && App.renderChapterList();
        return;
      }
      if (!t.closest || !t.closest('.chapter-body')) return;
      syncFromStage();
    });
    d.addEventListener('paste', e => {
      const host = e.target.closest && e.target.closest('.chapter-body');
      if (!host) return;
      e.preventDefault();
      const c = chapterOfNode(host);
      if (!c || c.locked || !activate(c)) return;
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      const files = Array.from(e.clipboardData.files || []);
      // texto simples de uma linha: entra na página na hora
      if (!html && !files.length && text && !/[\r\n]/.test(text)) { d.execCommand('insertText', false, text); return; }
      L.runOnModel(() => App.editor.paste({ html, text, files }), 'Colar');
    });
    d.addEventListener('mousedown', () => { lock = null; });
    d.addEventListener('keydown', e => {
      const host = e.target.closest && e.target.closest('.chapter-body');
      if (!host) return;
      lock = null;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); L.runOnModel(() => App.editor.action('pagebreak'), 'Quebra de página'); return; }
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); return; }
      if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); L.runOnModel(() => App.editor.action('link'), 'Ligação'); return; }
      if (e.key === 'Tab') { e.preventDefault(); }
    });
    d.addEventListener('selectionchange', () => {
      const sel = d.getSelection();
      if (sel && sel.rangeCount && chapterOfNode(sel.anchorNode)) { lastFocus = 'stage'; if (L.onSelection) L.onSelection(sel); }
    });
    // clique numa nota (chamada) ou figura: abre o painel correspondente no editor
    d.addEventListener('click', e => {
      const call = e.target.closest && e.target.closest('a[data-footnote-call], .en-call, .sn-call');
      const fig = e.target.closest && e.target.closest('figure, .fig');
      if (!call && !fig) return;
      const c = chapterOfNode(e.target);
      if (!c || !activate(c)) return;
      e.preventDefault();
      const st2 = state;
      const el = call || fig;
      const p = posOf(st2.R, el.parentNode, Array.prototype.indexOf.call(el.parentNode.childNodes, el));
      if (p === null) return;
      const s = st2.r2s[p];
      const V = modelV();
      // a unidade seguinte no modelo é o objeto (nota/figura)
      const pt = V.after[s];
      const node = pt && pt[0] && pt[0].childNodes ? pt[0].childNodes[pt[1] - 1] : null;
      if (node && node.nodeType === 1) node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  // Enter: divide o parágrafo na página (aparece na hora) e o modelo acompanha pela diferença (¶)
  function splitInStage() {
    const sel = stageDoc.getSelection();
    if (!sel.rangeCount) return;
    let r = sel.getRangeAt(0);
    if (!r.collapsed) { r.deleteContents(); }
    const host = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode).closest('.chapter-body');
    const blk = blockOf(r.startContainer, host);
    if (!blk) return;
    const tail = stageDoc.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(blk, blk.childNodes.length);
    const frag = tail.extractContents();
    const atEnd = !frag.textContent.replace(/[­​]/g, '').length;
    const nb = atEnd && /^H[1-6]$/.test(blk.tagName) ? stageDoc.createElement('p') : blk.cloneNode(false);
    ['id', 'data-split-from', 'data-split-to', 'data-src', 'data-ref', 'data-fnp', 'data-break-before'].forEach(a => nb.removeAttribute(a));
    nb.style.textIndent = '';
    nb.appendChild(frag);
    if (!nb.textContent.length && !nb.querySelector('img, br')) nb.appendChild(stageDoc.createElement('br'));
    if (!blk.textContent.length && !blk.querySelector('img, br')) blk.appendChild(stageDoc.createElement('br'));
    blk.after(nb);
    const c = stageDoc.createRange();
    c.setStart(nb, 0); c.collapse(true);
    sel.removeAllRanges(); sel.addRange(c);
    syncFromStage();
  }

  function undo(redo) {
    App.flush();
    const btn = $(redo ? '#btnRedo' : '#btnUndo');
    if (btn && !btn.disabled) { state = null; beginLock(null); btn.click(); }
  }

  // formatação de trecho (negrito, itálico…): aplicada na página e no modelo ao mesmo tempo
  L.exec = function (cmd, value) {
    const c = App.chapter();
    if (!c || c.locked || !ensureState(c.id)) return false;
    const ss = stageSelection();
    if (!ss) return false;
    if (INLINE_FMT.has(cmd)) {
      setEditorSelection(ss[0], ss[1]);
      document.execCommand(cmd, false, value || null);
      // na página, a mesma formatação (o texto não muda, então a diferença é vazia)
      const host = stageDoc.activeElement;
      stageDoc.execCommand(cmd, false, value || null);
      state.S = modelV();
      App.editSeq++;
      $('#editor').dispatchEvent(new Event('input', { bubbles: true }));
      if (host && host.focus) host.focus({ preventScroll: true });
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- integração com a prévia
  L.attach = function (d) {
    stageDoc = d;
    wire(d);
    attachHosts();
  };
  // antes de trocar as páginas de um capítulo: guarda o cursor (em posições do modelo)
  L.beforeApply = function (keys) {
    if (!stageDoc || !App.editorChapterId) return null;
    const key = 'ch:' + App.editorChapterId;
    if (!keys.includes(key) && !keys.includes('all')) return null;
    let caret = null;
    if (lock && lock.chId === App.editorChapterId) { caret = lock.caret; if (!caret) return null; }
    else if (stageDoc.activeElement && stageDoc.activeElement.closest && stageDoc.activeElement.closest('.chapter-body, .chapter-title')) {
      if (stageDoc.activeElement.classList.contains('chapter-title')) return { title: true };
      if (ensureState(App.editorChapterId)) caret = stageSelection();
    }
    return { caret, hadLock: !!lock };
  };
  L.afterApply = function (keys, saved) {
    if (!stageDoc) return;
    if (keys.includes('all') || (App.editorChapterId && keys.includes('ch:' + App.editorChapterId))) state = null;
    if (lock && keys.includes('ch:' + lock.chId)) lock = null;
    attachHosts();
    if (saved && saved.title) {
      const idx = chIndex(App.editorChapterId);
      const t = stageDoc.querySelector(`section[data-chapter="${idx}"] .chapter-title`);
      if (t) { t.focus(); const s = stageDoc.getSelection(); s.selectAllChildren(t); s.collapseToEnd(); }
      return;
    }
    if (saved && saved.caret && App.view === 'chapter') restoreStageCaret(saved.caret[0], saved.caret[1]);
  };
  // a paginação que chegou ainda corresponde ao texto atual do capítulo?
  L.fresh = function (key, seq) {
    if (!App.editorChapterId || key !== 'ch:' + App.editorChapterId) return true;
    return seq === App.editSeq;
  };
  // seleção nas páginas: barra flutuante de estilos (caixa, citação, título…)
  let selT = null;
  L.onSelection = sel => { clearTimeout(selT); selT = setTimeout(() => { if (App.quickStyle) App.quickStyle.showStage(stageDoc.getSelection()); }, 180); };
  L.focusedOnStage = () => lastFocus === 'stage';
  L.noteEditorFocus = () => { lastFocus = 'editor'; };
  L.selectionPos = () => stageSelection();
  L.state = () => state;
  L.invalidate = () => { state = null; };
  L.refresh = attachHosts;
  // modo clássico (texto do capítulo também numa coluna à parte), guardado neste computador
  function setClassic(on) {
    document.body.classList.toggle('classic-editor', !!on);
    const b = $('#classicToggle');
    if (b) b.classList.toggle('on', !!on);
    try { localStorage.setItem('classicEditor', on ? '1' : ''); } catch (e) { /* ok */ }
  }
  const initClassic = () => {
    let on = false;
    try { on = localStorage.getItem('classicEditor') === '1'; } catch (e) { /* ok */ }
    setClassic(on);
    const b = $('#classicToggle');
    if (b) b.addEventListener('click', () => setClassic(!document.body.classList.contains('classic-editor')));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initClassic); else initClassic();
  L.setClassic = setClassic;

  // para testes
  L._buildV = buildV; L._align = align; L._modelV = modelV; L._stageV = stageV;
})();
