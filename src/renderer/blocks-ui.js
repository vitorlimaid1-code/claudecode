/* global App */
// Blocos de diagramação:
//  - blocos de imagem (cinza, horizontais ou verticais, com legenda de teste): o “+” escolhe a imagem;
//  - caixas de texto à parte (só o texto aparece): na lateral, no centro (texto dos dois lados) ou em faixa;
//  - páginas de imagem sangrada antes/depois do capítulo ou matéria (página dupla), com box de legenda;
//  - estilos de título: caixa preta, caixa branca ou só contorno, à esquerda, ao centro ou à direita.
(function () {
  const { el, $, api } = App;
  const periodical = () => ['magazine', 'newspaper'].includes(App.project.kind);
  const chapterAt = sec => App.project.chapters[Number(sec && sec.dataset.chapter)];
  const modelDo = (ch, fn) => App.images.withChapterDom(ch, fn);

  // ---------------------------------------------------------------- inserir no capítulo aberto
  // ponto de inserção: depois do bloco onde está o cursor nas páginas (ou depois do 1º parágrafo)
  function insertionPoint() {
    const c = App.chapter();
    if (!c) return null;
    const f = document.querySelector('#previewFrames iframe');
    const d = f && f.contentDocument;
    const sel = d && d.getSelection();
    let idx = null;
    if (sel && sel.rangeCount) {
      const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      const blk = n && n.closest && n.closest('.chapter-body > [data-src]');
      const sec = blk && blk.closest('section[data-chapter]');
      if (blk && chapterAt(sec) === c) idx = Number(blk.dataset.src);
    }
    return { c, idx };
  }
  function insertHtml(html, label) {
    const pt = insertionPoint();
    if (!pt) return App.toast('Abra um capítulo (lista à esquerda) e clique no texto onde o bloco deve entrar.');
    if (pt.c.locked) return App.toast('Capítulo bloqueado.');
    modelDo(pt.c, root => {
      const t = document.createElement('template');
      t.innerHTML = html;
      const ref = pt.idx != null ? root.children[pt.idx] : (root.querySelector(':scope > p') || root.lastElementChild);
      if (ref) ref.after(t.content); else root.appendChild(t.content);
    });
    App.changed(label);
  }
  const phHtml = (v, cap) => `<div class="ph-block" data-ph="${v ? 'v' : 'h'}" data-cap="1">${App.escape(cap || 'Legenda de teste: descreva a imagem aqui.')}</div>`;
  const frameHtml = (pos, look) => `<div class="tframe" data-pos="${pos}" data-width="${pos === 'band' ? 80 : 38}" data-look="${look || 'pull'}"><p>Para tomar as decisões certas, você <b>precisa primeiro definir onde quer chegar.</b></p></div>`;
  function insertPh(v) { insertHtml(phHtml(v), v ? 'Bloco de imagem vertical' : 'Bloco de imagem horizontal'); }
  function insertFrame(pos) { insertHtml(frameHtml(pos), 'Caixa de texto à parte'); App.toast('Caixa inserida: clique no texto dela, na página, para escrever; clique na borda tracejada para mudar posição e estilo.', 5000); }

  // blocos distribuídos de forma estratégica: horizontal depois da abertura, verticais ao longo do texto
  function distribute(c) {
    if (!c || c.locked) return 0;
    let n = 0;
    modelDo(c, root => {
      if (root.querySelector(':scope > .ph-block')) return;
      const ps = Array.from(root.querySelectorAll(':scope > p'));
      if (!ps.length) return;
      const t = document.createElement('template');
      const add = (after, html) => { t.innerHTML = html; after.after(t.content); n++; };
      add(ps[0], phHtml(false, 'Legenda de teste: a imagem principal da matéria.'));
      if (ps.length >= 5) add(ps[Math.floor(ps.length * 0.45)], phHtml(true, 'Legenda de teste: imagem de apoio.'));
      if (ps.length >= 10) add(ps[Math.floor(ps.length * 0.78)], phHtml(true, 'Legenda de teste: detalhe.'));
    });
    return n;
  }

  // ---------------------------------------------------------------- interação nas páginas
  function blockFrom(e, sel) {
    const t = e.target.closest && e.target.closest(sel);
    if (!t) return null;
    const sec = t.closest('section[data-chapter]');
    const c = chapterAt(sec);
    const idx = Number(t.dataset.src);
    if (!c || Number.isNaN(idx)) return null;
    return { t, c, idx };
  }
  async function fillPlaceholder(c, idx, ids) {
    if (!ids || !ids.length) {
      const l = await api.pickImages({ title: 'Imagem para o bloco' });
      if (!l || !l.length) return;
      ids = [await App.addAsset(l[0])];
    }
    let ok = false;
    modelDo(c, root => {
      const ph = root.children[idx];
      if (!ph || !ph.matches('.ph-block')) return;
      const v = ph.dataset.ph === 'v';
      const cap = ph.dataset.cap !== '0' ? ph.textContent.trim() : '';
      const multi = periodical() && (Number(c.columns) || Number(App.project.settings.columns) || 1) > 1;
      const opts = v ? (multi ? { width: 100, align: 'center', wrap: 'none' } : { width: 42, align: 'right', wrap: 'square' }) : { width: 100, align: 'full', wrap: 'none' };
      const t = document.createElement('template');
      t.innerHTML = App.editor.figureHtml(ids[0], Object.assign(opts, { caption: /^Legenda de teste/.test(cap) ? cap : cap }));
      ph.replaceWith(t.content);
      ok = true;
    });
    if (ok) App.changed('Imagem no bloco');
  }
  function wire(d) {
    if (d.__blocksWired) return;
    d.__blocksWired = true;
    d.addEventListener('mousedown', async e => {
      const b = e.target.closest && e.target.closest('.ph-plus, .ph-cap, .ph-del');
      if (b) {
        e.preventDefault(); e.stopPropagation();
        const hit = blockFrom(e, 'figure.ph[data-src]');
        if (!hit) return;
        if (hit.c.locked) return App.toast('Capítulo bloqueado.');
        if (b.classList.contains('ph-plus')) return fillPlaceholder(hit.c, hit.idx);
        if (b.classList.contains('ph-cap')) { modelDo(hit.c, root => { const ph = root.children[hit.idx]; if (ph) ph.setAttribute('data-cap', ph.dataset.cap === '0' ? '1' : '0'); }); App.changed('Legenda do bloco'); return; }
        if (b.classList.contains('ph-del')) { modelDo(hit.c, root => { const ph = root.children[hit.idx]; if (ph && ph.matches('.ph-block')) ph.remove(); }); App.changed('Bloco removido'); return; }
      }
      // caixa de texto à parte: clicar nela mostra as opções logo acima (o texto continua editável)
      const tf = e.target.closest && e.target.closest('.tframe[data-src]');
      if (tf) { const hit = blockFrom(e, '.tframe[data-src]'); if (hit) frameMenu(d, hit, tf.getBoundingClientRect()); }
      else hideFrameMenu();
    }, true);
    // arrastar uma imagem para dentro de um bloco cinza: preenche o bloco
    d.addEventListener('drop', async e => {
      const hit = blockFrom(e, 'figure.ph[data-src]');
      if (!hit) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
      if (ids && ids.length) fillPlaceholder(hit.c, hit.idx, ids);
    }, true);
  }

  // contorno de todas as caixas de texto do projeto (manter ou remover)
  function allBorders(v) {
    let n = 0;
    App.project.chapters.forEach(c => {
      if (!/\btframe\b/.test(c.html || '') || c.locked) return;
      modelDo(c, root => root.querySelectorAll('.tframe').forEach(t => { t.setAttribute('data-border', v); n++; }));
    });
    App.changed(n ? (v === 'keep' ? 'Contorno das caixas mantido' : 'Contorno das caixas removido') : null);
    App.toast(n ? `${n} caixa(s) de texto: contorno ${v === 'keep' ? 'mantido' : 'removido'}.` : 'Nenhuma caixa de texto nos capítulos (desbloqueados).', 3500);
  }

  // menu flutuante da caixa de texto (posição, largura, estilo, remover)
  let menu = null;
  function hideFrameMenu() { if (menu) { menu.remove(); menu = null; } }
  function frameMenu(d, hit, r) {
    hideFrameMenu();
    const frame = document.querySelector('#previewFrames iframe');
    const fr = frame.getBoundingClientRect();
    const k = fr.width / (d.documentElement.clientWidth || fr.width) || 1;
    const set = (attr, v, label) => { modelDo(hit.c, root => { const t = root.children[hit.idx]; if (t) t.setAttribute(attr, v); }); App.changed(label); hideFrameMenu(); };
    const cur = attr => { let v = ''; modelDo(hit.c, root => { const t = root.children[hit.idx]; v = t ? t.getAttribute(attr) || '' : ''; }); return v; };
    const w = Number(cur('data-width')) || 40;
    const btn = (t, title, fn, on) => el('button', { class: 'tfm-btn' + (on ? ' on' : ''), title, text: t, onmousedown: e => e.preventDefault(), onclick: fn });
    const pos = cur('data-pos') || 'right', look = cur('data-look') || 'pull', keep = cur('data-border') === 'keep';
    menu = el('div', { class: 'tfm' }, [
      el('span', { class: 'tfm-l', text: 'Caixa de texto' }),
      btn('⯇', 'Na lateral esquerda — o texto segue reto pela margem', () => set('data-pos', 'left', 'Caixa à esquerda'), pos === 'left'),
      btn('◫', 'No centro — o texto contorna dos dois lados', () => set('data-pos', 'center', 'Caixa no centro'), pos === 'center'),
      btn('⯈', 'Na lateral direita — o texto segue reto pela margem', () => set('data-pos', 'right', 'Caixa à direita'), pos === 'right'),
      btn('▬', 'Faixa (acima/abaixo do texto, ocupa a largura)', () => set('data-pos', 'band', 'Caixa em faixa'), pos === 'band'),
      el('span', { class: 'tfm-sep' }),
      btn('−', 'Mais estreita', () => set('data-width', String(Math.max(20, w - 6)), 'Largura da caixa')),
      el('span', { class: 'tfm-w', text: w + '%' }),
      btn('+', 'Mais larga', () => set('data-width', String(Math.min(pos === 'band' ? 100 : 60, w + 6)), 'Largura da caixa')),
      el('span', { class: 'tfm-sep' }),
      btn('Aa', 'Texto grande em destaque', () => set('data-look', 'pull', 'Estilo da caixa'), look === 'pull'),
      btn('❝', 'Citação', () => set('data-look', 'quote', 'Estilo da caixa'), look === 'quote'),
      btn('¶', 'Texto normal', () => set('data-look', 'plain', 'Estilo da caixa'), look === 'plain'),
      el('span', { class: 'tfm-sep' }),
      el('span', { class: 'tfm-l', text: 'Contorno' }),
      btn('Manter', 'Manter o contorno: a caixa aparece como no preview, também no PDF', () => set('data-border', 'keep', 'Contorno da caixa mantido'), keep),
      btn('Remover', 'Remover o contorno: só a frase aparece, sem a caixa', () => set('data-border', 'none', 'Contorno da caixa removido'), !keep),
      el('span', { class: 'tfm-sep' }),
      btn('🗑', 'Remover a caixa (o texto dela sai junto)', () => { modelDo(hit.c, root => { const t = root.children[hit.idx]; if (t) t.remove(); }); App.changed('Caixa de texto removida'); hideFrameMenu(); })
    ]);
    document.body.appendChild(menu);
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, fr.left + r.left * k)) + 'px';
    menu.style.top = Math.max(8, fr.top + r.top * k - menu.offsetHeight - 10) + 'px';
    setTimeout(() => document.addEventListener('mousedown', ev => { if (menu && !menu.contains(ev.target)) hideFrameMenu(); }, { once: true, capture: true }), 0);
  }

  // ---------------------------------------------------------------- tela: blocos e imagens sangradas
  const POS = [['tl', 'Canto superior esquerdo'], ['tr', 'Canto superior direito'], ['bl', 'Canto inferior esquerdo'], ['br', 'Canto inferior direito'], ['band', 'Faixa inferior']];
  const LOOK = [['dark', 'Escuro translúcido'], ['light', 'Claro'], ['line', 'Só texto com fio']];
  function bleedEditor(c, side, rer) {
    c.bleed = c.bleed || {};
    const b = c.bleed[side];
    const a = b && b.asset && App.project.assets[b.asset];
    const pick = async () => { const l = await api.pickImages({ title: 'Imagem de página inteira (sangrada)' }); if (!l || !l.length) return; c.bleed[side] = Object.assign({ fit: 'cover', box: { text: '', title: '', pos: 'bl', look: 'dark' } }, c.bleed[side] || {}, { asset: await App.addAsset(l[0]) }); App.changed('Página de imagem ' + (side === 'before' ? 'antes' : 'depois')); rer(); };
    if (!a) return el('div', { class: 'bl-slot empty' }, [el('button', { text: side === 'before' ? '＋ Imagem antes (página da esquerda)' : '＋ Imagem depois', onclick: pick })]);
    const box = b.box = b.box || { text: '', title: '', pos: 'bl', look: 'dark' };
    const ta = el('textarea', { rows: 3, placeholder: 'Legenda ou texto informativo sobre a imagem (opcional)' });
    ta.value = box.text || '';
    ta.addEventListener('input', () => { box.text = ta.value; App.changed(null); clearTimeout(ta._t); ta._t = setTimeout(() => App.commit('Texto do box da imagem'), 900); });
    const sel = (opts, k) => { const s2 = el('select', {}, opts.map(([v, t]) => el('option', { value: v, text: t, selected: box[k] === v }))); s2.addEventListener('change', () => { box[k] = s2.value; App.changed('Box da imagem'); }); return s2; };
    const ttl = el('input', { type: 'text', value: box.title || '', placeholder: 'Título do box (opcional)' });
    ttl.addEventListener('change', () => { box.title = ttl.value; App.changed('Título do box'); });
    return el('div', { class: 'bl-slot' }, [
      el('img', { src: App.assetUrl(b.asset) }),
      el('div', { class: 'bl-fields' }, [
        el('b', { text: side === 'before' ? 'Antes do texto' : 'Depois do texto' }),
        ttl, ta,
        el('div', { class: 'inline wrap' }, [sel(POS, 'pos'), sel(LOOK, 'look')]),
        el('div', { class: 'inline wrap' }, [el('button', { text: 'Trocar…', onclick: pick }), el('button', { class: 'ghost', text: 'Remover', onclick: () => { delete c.bleed[side]; App.changed('Página de imagem removida'); rer(); } })])
      ])
    ]);
  }
  function renderBlocks() {
    const v = $('#view-blocks');
    if (!v) return;
    v.innerHTML = '';
    const rer = renderBlocks;
    const per = periodical();
    const cur = App.chapter();
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: per ? 'Blocos e páginas sangradas' : 'Caixas de texto e páginas sangradas' }),
      el('p', { class: 'muted', text: per ? 'Monte a matéria com blocos de imagem cinza (com legenda de teste) e troque cada um pela imagem final no “+”. Páginas de imagem sangrada antes ou depois de uma matéria criam páginas duplas: a imagem de um lado, o texto do outro.' : 'Caixas de texto à parte e páginas de imagem sangrada antes ou depois de um capítulo (página dupla: a imagem de um lado, o texto do outro).' }),
      App.card('Inserir no capítulo aberto' + (cur ? ` (“${cur.title}”)` : ''), [
        el('p', { class: 'small muted', text: 'Clique no texto da página, no ponto em que o bloco deve entrar, e use um dos botões. Nas páginas, o “+” do bloco cinza escolhe a imagem (ou arraste uma imagem para dentro dele).' }),
        per ? el('div', { class: 'inline wrap' }, [
          el('button', { class: 'blk-btn', onclick: () => insertPh(false) }, [el('span', { class: 'blk-ic h' }), 'Bloco horizontal']),
          el('button', { class: 'blk-btn', onclick: () => insertPh(true) }, [el('span', { class: 'blk-ic v' }), 'Bloco vertical']),
          el('button', { class: 'primary', text: '✦ Distribuir blocos em todas as matérias', onclick: () => { let n = 0; App.project.chapters.forEach(c => { n += distribute(c); }); App.changed(n ? `${n} bloco(s) de imagem distribuído(s)` : null); App.toast(n ? `${n} bloco(s) de imagem distribuído(s) nas matérias (horizontal na abertura, verticais ao longo do texto).` : 'As matérias já têm blocos (ou ainda não têm texto).', 4500); } })
        ]) : null,
        el('div', { class: 'inline wrap' }, [
          el('span', { class: 'flabel', text: 'Caixa de texto à parte:' }),
          el('button', { text: '⯇ Lateral esquerda', onclick: () => insertFrame('left') }),
          el('button', { text: '◫ Centro', onclick: () => insertFrame('center') }),
          el('button', { text: '⯈ Lateral direita', onclick: () => insertFrame('right') }),
          el('button', { text: '▬ Faixa', onclick: () => insertFrame('band') })
        ]),
        el('div', { class: 'inline wrap' }, [
          el('span', { class: 'flabel', text: 'Contorno de todas as caixas:' }),
          el('button', { text: '▭ Manter', title: 'A caixa aparece com o contorno tracejado, como no preview (também no PDF)', onclick: () => allBorders('keep') }),
          el('button', { text: '¶ Remover', title: 'Só a frase aparece, sem a caixa', onclick: () => allBorders('none') })
        ]),
        el('p', { class: 'small muted', text: 'Cada caixa tem o seletor Contorno: Manter (a caixa sai como no preview, com o contorno tracejado) ou Remover (só a frase; na tela fica apenas uma guia pontilhada clarinha, que não sai no PDF) — clique na caixa, na página. Nas laterais, o texto ao lado segue reto pela margem; no centro, contorna a caixa dos dois lados; em faixa, fica acima e abaixo.' })
      ], '', 'span-all'),
      App.card(per ? 'Páginas de imagem sangrada por matéria' : 'Páginas de imagem sangrada por capítulo', [
        el('p', { class: 'small muted', text: 'Opcional. A imagem ocupa a página inteira, além do corte. “Antes” fica na página da esquerda, de frente para a abertura do texto (página dupla). Em cada imagem, um box com legenda ou texto informativo.' }),
        el('div', { class: 'bl-list' }, App.project.chapters.map(c => el('div', { class: 'bl-row' }, [
          el('div', { class: 'bl-head' }, [el('b', { text: c.title || 'Sem título' }), (c.bleed && c.bleed.before) ? el('label', { class: 'chk small' }, [App.bind(c.bleed, 'spread', 'checkbox', { label: 'Página dupla' }), ' Página dupla (imagem à esquerda, texto à direita)']) : null]),
          el('div', { class: 'bl-slots' }, [bleedEditor(c, 'before', rer), bleedEditor(c, 'after', rer)])
        ])))
      ], '', 'span-all')
    ]));
    // página dupla ligada por padrão
    App.project.chapters.forEach(c => { if (c.bleed && c.bleed.before && c.bleed.spread === undefined) c.bleed.spread = true; });
  }

  // ---------------------------------------------------------------- tela: estilos de título
  const TB = [['none', 'Padrão', 'Título simples, no estilo do livro'], ['black', 'Caixa preta', 'Caixa preta fina, letra branca'], ['white', 'Caixa branca', 'Caixa branca fina, letra preta'], ['outline', 'Só contorno', 'Contorno preto e fino']];
  function renderTitles() {
    const v = $('#view-titles');
    if (!v) return;
    v.innerHTML = '';
    const s = App.project.settings;
    s.titleBox = s.titleBox || { style: 'none', align: '' };
    const cur = App.chapter();
    const own = cur && cur.titleBox && cur.titleBox.style;
    const target = own ? cur.titleBox : s.titleBox;
    const font = (s.styles.chapterTitle.font || s.styles.body.font || 'EB Garamond');
    App.ensureFonts([font]);
    const prev = (k, al) => el('div', { class: 'tbp-page' }, [el('div', { class: 'tbp-head', style: { textAlign: al || s.styles.chapterTitle.align || 'center' } }, [el('span', { class: 'tbp-title tbp-' + k, style: { fontFamily: `"${font}", Georgia, serif` }, text: periodical() ? 'Planejamento' : 'O começo' })]), el('div', { class: 'tbp-lines' })]);
    const apply = (patch, scope) => {
      if (scope === 'chapter') { if (!cur) return App.toast('Abra um capítulo para aplicar só nele.'); cur.titleBox = Object.assign({}, cur.titleBox && cur.titleBox.style ? cur.titleBox : s.titleBox, patch); }
      else Object.assign(s.titleBox, patch);
      App.changed('Estilo de título');
      renderTitles();
    };
    const scope = own ? 'chapter' : 'all';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Estilos de título' }),
      el('p', { class: 'muted', text: `Como aparece o título de cada ${periodical() ? 'matéria' : 'capítulo'}. Escolha o estilo e o alinhamento; vale para o livro inteiro, ou só para o ${periodical() ? 'a matéria aberta' : 'capítulo aberto'}.` }),
      App.card('Estilo', [el('div', { class: 'tbp-grid' }, TB.map(([k, name, desc]) => el('button', { class: 'tbp' + ((target.style || 'none') === k ? ' on' : ''), onclick: () => apply({ style: k }, scope) }, [prev(k, target.align), el('b', { text: name }), el('span', { class: 'small muted', text: desc })])))], '', 'span-all'),
      App.card('Alinhamento', [el('div', { class: 'kdp-seg' }, [['left', 'À esquerda'], ['center', 'Ao centro'], ['right', 'À direita'], ['', 'Do estilo do texto']].map(([k, l]) => el('button', { class: (target.align || '') === k ? 'on' : '', text: l, onclick: () => apply({ align: k }, scope) })))], '', 'span-all'),
      App.card('Onde aplicar', [
        el('p', { class: 'small', text: own ? `O ${periodical() ? 'a matéria' : 'capítulo'} “${cur.title}” tem estilo próprio (as mudanças acima valem só para ele).` : 'As mudanças acima valem para todos os títulos.' }),
        el('div', { class: 'inline wrap' }, [
          cur && !own ? el('button', { text: `Dar estilo próprio a “${cur.title}”`, onclick: () => { cur.titleBox = Object.assign({}, s.titleBox); App.changed('Estilo de título próprio'); renderTitles(); } }) : null,
          own ? el('button', { text: 'Voltar ao estilo do livro', onclick: () => { cur.titleBox = null; App.changed('Estilo de título do livro'); renderTitles(); } }) : null,
          el('button', { class: 'ghost', text: 'Aplicar o estilo atual a todos os títulos', onclick: () => { s.titleBox = Object.assign({}, target); App.project.chapters.forEach(c => { c.titleBox = null; }); App.changed('Estilo de título em todos'); renderTitles(); } })
        ])
      ], '', 'span-all')
    ]));
  }

  App.hooks.viewRender.blocks = renderBlocks;
  App.hooks.viewRender.titles = renderTitles;
  App.blocks = { wire, insertPh, insertFrame, distribute, renderBlocks, renderTitles, phHtml, fill: fillPlaceholder };
})();
