/* global App, BookText */
// Editor de capítulos: texto, estilos de parágrafo, notas, imagens, tabelas, gráficos e arrastar/soltar.
(function () {
  const { el, $, $$, api, D } = App;
  const editor = () => $('#editor');
  let selectedFig = null;
  let selectedNote = null;
  let commitTimer = null;

  // ---------------------------------------------------------------- carregar / salvar
  function decorate(root) {
    root.querySelectorAll('span.comment').forEach(c => { c.setAttribute('contenteditable', 'false'); c.title = `Comentário${c.dataset.author ? ' de ' + c.dataset.author : ''}: ${c.dataset.text || ''} (não sai no livro)`; });
    root.querySelectorAll('figure.img').forEach(styleFigure);
    root.querySelectorAll('div.fullbleed').forEach(fb => {
      fb.setAttribute('contenteditable', 'false');
      const a = App.project.assets[fb.dataset.asset];
      fb.style.backgroundImage = a ? `url("${App.assetUrl(fb.dataset.asset)}")` : '';
      fb.title = 'Imagem de página inteira (sangrada) — clique para opções';
    });
    root.querySelectorAll('img[data-asset]').forEach(img => { if (!img.closest('figure.img')) img.src = App.assetUrl(img.dataset.asset); });
  }

  function load() {
    const c = App.chapter();
    if (!c) return;
    App.editorChapterId = c.id;
    $('#chapterTitle').value = c.title;
    $('#chapterNumbered').checked = !!c.numbered;
    const ed = editor();
    ed.innerHTML = c.html || '<p><br></p>';
    decorate(ed);
    ed.style.fontFamily = `"${App.project.settings.styles.body.font}", Georgia, serif`;
    App.ensureFonts([App.project.settings.styles.body.font, c.style.font].filter(Boolean));
    applyLock(c);
    selectFigure(null);
    renderLookPanel(false);
    $('#editorScroll').scrollTop = 0;
    if (!App._liveNoScroll) App.preview.scrollTo(c.id);
  }

  function flush() {
    if (!App.editorChapterId || App.view !== 'chapter') return;
    const c = App.project.chapters.find(x => x.id === App.editorChapterId);
    if (!c || c.locked) return;
    const html = serialize();
    if (html !== c.html) c.html = html;
  }

  function serialize() {
    // remove estilos visuais do editor antes de guardar
    const clone = editor().cloneNode(true);
    undecorate(clone);
    return clone.innerHTML;
  }
  function undecorate(clone) {
    clone.querySelectorAll('figure.img').forEach(f => { f.removeAttribute('style'); f.removeAttribute('contenteditable'); f.removeAttribute('draggable'); f.classList.remove('selected'); const img = f.querySelector('img'); if (img) { img.removeAttribute('style'); img.removeAttribute('src'); } const cap = f.querySelector('figcaption'); if (cap) cap.removeAttribute('contenteditable'); });
    clone.querySelectorAll('div.fullbleed').forEach(f => { f.removeAttribute('style'); f.removeAttribute('contenteditable'); f.removeAttribute('title'); f.classList.remove('selected'); });
    clone.querySelectorAll('img[data-asset]').forEach(i => i.removeAttribute('src'));
    clone.querySelectorAll('.footnote.selected').forEach(n => n.classList.remove('selected'));
    clone.querySelectorAll('[data-fid]').forEach(n => n.removeAttribute('data-fid'));
    clone.querySelectorAll('span.comment').forEach(c => { c.removeAttribute('contenteditable'); c.removeAttribute('title'); });
    return clone;
  }

  function onInput() {
    const c = App.project.chapters.find(x => x.id === App.editorChapterId);
    if (!c || c.locked) return;
    c.html = serialize();
    App.editSeq = (App.editSeq || 0) + 1;
    App.changed(null);
    clearTimeout(commitTimer);
    commitTimer = setTimeout(() => App.commit('Edição de texto'), 2500);
    clearTimeout(onInput._wc);
    onInput._wc = setTimeout(App.updateWordCount, 900);
  }

  function applyLock(c) {
    const locked = !!c.locked;
    editor().contentEditable = locked ? 'false' : 'true';
    $('#chapterTitle').readOnly = locked;
    $('#chapterNumbered').disabled = locked;
    $('#chapterDelete').disabled = locked;
    $('#chapterLock').textContent = locked ? '🔒 Desbloquear' : '🔓 Bloquear';
    $('#lockBanner').classList.toggle('show', locked);
    $('#editorToolbar').classList.toggle('disabled', locked);
  }

  // ---------------------------------------------------------------- figuras
  function figDefaults(fig) {
    const d = { 'data-align': 'center', 'data-wrap': 'none', 'data-width': '60', 'data-gap': '4', 'data-rot': '0', 'data-flipx': '0', 'data-flipy': '0', 'data-opacity': '100', 'data-crop': '0,0,0,0', 'data-ratio': '', 'data-fit': 'cover' };
    Object.entries(d).forEach(([k, v]) => { if (!fig.hasAttribute(k)) fig.setAttribute(k, v); });
  }

  function styleFigure(fig) {
    figDefaults(fig);
    fig.setAttribute('contenteditable', 'false');
    fig.setAttribute('draggable', 'true');
    if (!fig.dataset.fid) fig.dataset.fid = D.uid('f');
    const cap = fig.querySelector('figcaption');
    if (cap) cap.setAttribute('contenteditable', 'true');
    const img = fig.querySelector('img') || fig.insertBefore(document.createElement('img'), fig.firstChild);
    img.setAttribute('data-asset', fig.dataset.asset);
    img.src = App.assetUrl(fig.dataset.asset);
    const align = fig.dataset.align;
    const wrap = fig.dataset.wrap;
    const w = align === 'full' ? 100 : Number(fig.dataset.width) || 60;
    const gap = Number(fig.dataset.gap) || 4;
    const st = fig.style;
    st.cssText = '';
    st.width = w + '%';
    let side = null;
    if (align !== 'full') {
      if (wrap === 'left') side = 'right';
      else if (wrap === 'right') side = 'left';
      else if (wrap === 'square' || wrap === 'contour') side = align === 'right' ? 'right' : 'left';
    }
    if (side) { st.float = side; st.margin = side === 'left' ? `0.2em ${gap * 3.78}px ${gap * 2}px 0` : `0.2em 0 ${gap * 2}px ${gap * 3.78}px`; }
    else {
      st.margin = `${gap * 3}px 0`;
      if (align === 'left') { st.marginLeft = '0'; st.marginRight = 'auto'; }
      else if (align === 'right') { st.marginLeft = 'auto'; st.marginRight = '0'; }
      else { st.marginLeft = 'auto'; st.marginRight = 'auto'; }
    }
    if (wrap === 'behind') st.opacity = '0.45';
    const [t, r, b, l] = String(fig.dataset.crop || '0,0,0,0').split(',').map(Number);
    const rot = Number(fig.dataset.rot) || 0;
    const ist = img.style;
    ist.cssText = '';
    ist.transform = `rotate(${rot}deg)${fig.dataset.flipx === '1' ? ' scaleX(-1)' : ''}${fig.dataset.flipy === '1' ? ' scaleY(-1)' : ''}`;
    ist.opacity = (Number(fig.dataset.opacity) || 100) / 100;
    if (t || r || b || l) ist.clipPath = `inset(${t}% ${r}% ${b}% ${l}%)`;
    if (fig.dataset.ratio) { ist.aspectRatio = fig.dataset.ratio.replace(':', '/'); ist.objectFit = fig.dataset.fit || 'cover'; }
    fig.classList.toggle('missing', !App.project.assets[fig.dataset.asset]);
  }

  function figureHtml(assetId, opts) {
    opts = opts || {};
    const a = App.project.assets[assetId];
    let width = opts.width;
    if (!width && a) {
      // largura natural a 300 dpi, limitada à mancha
      const s = App.project.settings;
      const colW = s.pageWidth - s.marginInner - s.marginOuter;
      width = Math.max(15, Math.min(100, Math.round((a.width / 300 * 25.4) / colW * 100)));
    }
    return `<figure class="img" data-asset="${assetId}" data-align="${opts.align || 'center'}" data-wrap="${opts.wrap || 'none'}" data-width="${width || 60}" data-gap="4" data-rot="0" data-flipx="0" data-flipy="0" data-opacity="100" data-crop="0,0,0,0" data-ratio="" data-fit="cover"><img data-asset="${assetId}">${opts.caption ? `<figcaption>${App.escape(opts.caption)}</figcaption>` : ''}</figure>`;
  }

  // Insere blocos (HTML) antes de um elemento de bloco do editor ou na posição do cursor
  function insertBlocks(html, beforeEl, afterEl) {
    const ed = editor();
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const nodes = Array.from(tpl.content.childNodes);
    if (beforeEl && beforeEl.parentNode === ed) nodes.forEach(n => ed.insertBefore(n, beforeEl));
    else if (afterEl && afterEl.parentNode === ed) { let ref = afterEl.nextSibling; nodes.forEach(n => ed.insertBefore(n, ref)); }
    else {
      const blk = currentTopBlock();
      if (blk) { let ref = blk.nextSibling; nodes.forEach(n => ed.insertBefore(n, ref)); } else nodes.forEach(n => ed.appendChild(n));
    }
    decorate(ed);
    onInput();
    App.commit('Inserção de elemento');
    return nodes;
  }

  function currentTopBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.anchorNode;
    const ed = editor();
    if (!ed.contains(n)) return null;
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n && n.parentNode === ed ? n : null;
  }

  function currentBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.anchorNode;
    while (n && n !== editor()) {
      if (n.nodeType === 1 && /^(P|H2|H3|H4|BLOCKQUOTE|LI|FIGURE|TD|TH)$/.test(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  }

  function selectFigure(fig) {
    $$('#editor figure.selected, #editor div.fullbleed.selected').forEach(f => f.classList.remove('selected'));
    $$('#editor .footnote.selected').forEach(f => f.classList.remove('selected'));
    selectedFig = fig;
    selectedNote = null;
    if (fig) fig.classList.add('selected');
    renderPanel();
  }

  function setFig(attr, value, label) {
    if (!selectedFig) return;
    selectedFig.setAttribute(attr, value);
    styleFigure(selectedFig);
    onInput();
    clearTimeout(setFig._t);
    setFig._t = setTimeout(() => App.commit(label || 'Ajuste de imagem'), 700);
    renderPanel();
  }

  function figDpi(fig) {
    const a = App.project.assets[fig.dataset.asset];
    if (!a) return null;
    const s = App.project.settings;
    const colW = s.pageWidth - s.marginInner - s.marginOuter;
    const w = fig.dataset.align === 'full' ? 100 : Number(fig.dataset.width) || 60;
    const [, r, , l] = String(fig.dataset.crop || '0,0,0,0').split(',').map(Number);
    const px = a.width * (1 - (l + r) / 100);
    return Math.round(px / ((colW * w / 100) / 25.4));
  }

  function renderPanel() {
    const panel = $('#figPanel');
    panel.innerHTML = '';
    if (selectedNote) return renderNotePanel(panel);
    const tbl = !selectedFig && currentTable();
    if (tbl) return renderTablePanel(panel, tbl);
    if (!selectedFig) { panel.classList.remove('show'); return; }
    panel.classList.add('show');
    const fig = selectedFig;
    if (fig.classList.contains('fullbleed')) return renderFullBleedPanel(panel, fig);
    const a = App.project.assets[fig.dataset.asset];
    const dpi = figDpi(fig);
    const btn = (label, fn, title, cls) => el('button', { text: label, title: title || '', class: cls || '', onclick: fn });
    const seg = (attr, options) => el('div', { class: 'seg' }, options.map(([v, label, title]) => el('button', { class: fig.getAttribute(attr) === v ? 'on' : '', text: label, title: title || label, onclick: () => setFig(attr, v) })));
    const width = Number(fig.dataset.width) || 60;
    const slider = (attr, min, max, step, suffix, label) => {
      const v = Number(fig.getAttribute(attr)) || 0;
      const out = el('span', { class: 'val', text: v + suffix });
      const r = el('input', { type: 'range', min, max, step, value: v, oninput: e => { out.textContent = e.target.value + suffix; fig.setAttribute(attr, e.target.value); styleFigure(fig); }, onchange: e => setFig(attr, e.target.value, label) });
      return el('div', { class: 'slider' }, [r, out]);
    };
    panel.append(
      el('div', { class: 'fp-head' }, [el('strong', { text: 'Imagem' }), el('button', { class: 'ghost', text: '✕', onclick: () => selectFigure(null) })]),
      a ? el('div', { class: 'fp-info' }, [
        el('img', { src: App.assetUrl(fig.dataset.asset), class: 'fp-thumb' }),
        el('div', {}, [
          el('div', { text: a.name }),
          el('div', { class: 'muted small', text: `${a.width} × ${a.height} px · ${(a.info && a.info.format) || ''}${a.info && a.info.hasAlpha ? ' · transparência' : ''}${a.info && a.info.colorSpace === 'CMYK' ? ' · CMYK' : ''}` }),
          el('div', { class: 'small ' + (dpi < 150 ? 'bad' : dpi < 300 ? 'warn' : 'good'), text: `Resolução na impressão: ${dpi} dpi${dpi < 300 ? ' (recomendado ≥ 300)' : ''}` })
        ])
      ]) : el('div', { class: 'bad', text: 'Imagem ausente — use “Substituir”.' }),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Largura (% da mancha)' }), el('div', { class: 'inline' }, [btn('−', () => setFig('data-width', Math.max(5, width - 5))), slider('data-width', 5, 100, 1, '%', 'Redimensionar imagem'), btn('+', () => setFig('data-width', Math.min(100, width + 5)))])]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Legenda' }), (() => {
        const cap = fig.querySelector('figcaption');
        const inp = el('input', { type: 'text', placeholder: 'Escreva a legenda (vazio = sem legenda)', value: cap ? cap.textContent : '' });
        inp.addEventListener('input', () => {
          let c = fig.querySelector('figcaption');
          const v = inp.value;
          if (!v.trim()) { if (c) c.remove(); }
          else { if (!c) { c = document.createElement('figcaption'); fig.appendChild(c); } c.textContent = v; }
          styleFigure(fig);
          onInput();
          clearTimeout(inp._t);
          inp._t = setTimeout(() => App.commit('Legenda da imagem'), 900);
        });
        return inp;
      })()]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Alinhamento' }), seg('data-align', [['left', '⯇', 'Esquerda'], ['center', '≡', 'Centro'], ['right', '⯈', 'Direita'], ['full', '↔', 'Largura total']])]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Texto ao redor' }), (() => {
        const s = el('select', { onchange: async e => {
          const v = e.target.value;
          // contorno da forma numa imagem sem transparência: o fundo liso é removido (cópia; a original fica no projeto)
          const a0 = App.project.assets[fig.dataset.asset];
          if (v === 'both') fig.setAttribute('data-align', 'center');
          if ((v === 'contour' || v === 'both') && a0 && App.images) {
            const id = await App.images.shapeAsset(fig.dataset.asset);
            if (id && id !== fig.dataset.asset) { fig.setAttribute('data-asset', id); const im = fig.querySelector('img'); if (im) im.setAttribute('data-asset', id); App.toast('Fundo liso removido para o texto contornar a forma (a original continua no projeto).', 4000); }
            else if (!id) App.toast('Esta imagem não tem fundo liso: use “Remover fundo…” para ajustar, ou o texto contorna o retângulo.', 5000);
          }
          setFig('data-wrap', v, 'Contorno do texto');
        } }, [
          ['none', 'Acima e abaixo (sem texto ao lado)'], ['square', 'Quadrado — texto ao lado'], ['contour', 'Contorno da imagem (áreas transparentes)'], ['both', 'No centro — texto contornando dos dois lados'],
          ['left', 'Texto somente à esquerda'], ['right', 'Texto somente à direita'], ['behind', 'Atrás do texto (marca d’água)']
        ].map(([v, l]) => el('option', { value: v, text: l })));
        s.value = fig.dataset.wrap;
        return s;
      })()]),
      ['square', 'contour', 'left', 'right'].includes(fig.dataset.wrap) && fig.dataset.align !== 'full' ? el('label', { class: 'chk small', title: 'A figura sai da mancha pelo lado e avança sobre a margem, como nas ilustrações clássicas' }, [el('input', { type: 'checkbox', checked: fig.dataset.bleed === '1', onchange: e => setFig('data-bleed', e.target.checked ? '1' : '0', 'Avançar sobre a margem') }), ' Avançar sobre a margem']) : null,
      el('div', { class: 'fp-row' }, [el('label', { text: 'Distância do texto (mm)' }), slider('data-gap', 0, 15, 0.5, ' mm', 'Distância do texto')]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Proporção e ajuste' }), el('div', { class: 'inline' }, [
        (() => { const s = el('select', { onchange: e => setFig('data-ratio', e.target.value) }, [['', 'Original'], ['1:1', '1:1'], ['4:3', '4:3'], ['3:4', '3:4'], ['3:2', '3:2'], ['2:3', '2:3'], ['16:9', '16:9']].map(([v, l]) => el('option', { value: v, text: l }))); s.value = fig.dataset.ratio || ''; return s; })(),
        (() => { const s = el('select', { disabled: !fig.dataset.ratio, onchange: e => setFig('data-fit', e.target.value) }, [['cover', 'Preencher (recorta)'], ['contain', 'Caber inteira'], ['fill', 'Esticar']].map(([v, l]) => el('option', { value: v, text: l }))); s.value = fig.dataset.fit || 'cover'; return s; })()
      ])]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Girar e espelhar' }), el('div', { class: 'inline' }, [
        btn('↺ 90°', () => setFig('data-rot', ((Number(fig.dataset.rot) || 0) + 270) % 360)),
        btn('↻ 90°', () => setFig('data-rot', ((Number(fig.dataset.rot) || 0) + 90) % 360)),
        btn('⇋', () => setFig('data-flipx', fig.dataset.flipx === '1' ? '0' : '1'), 'Espelhar horizontalmente'),
        btn('⇵', () => setFig('data-flipy', fig.dataset.flipy === '1' ? '0' : '1'), 'Espelhar verticalmente')
      ])]),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Opacidade' }), slider('data-opacity', 5, 100, 1, '%', 'Opacidade')]),
      el('div', { class: 'fp-grid' }, [
        btn('✂ Recortar…', () => cropDialog(fig)),
        btn('✨ Remover fundo…', () => App.images && App.images.removeBackground(fig), 'Deixa o fundo transparente (no computador, sem internet)'),
        btn('▢ Caixa de texto', () => {
          const box = document.createElement('div');
          box.className = 'box';
          box.dataset.style = 'fundo';
          box.innerHTML = '<p>Escreva aqui o texto da caixa.</p>';
          fig.after(box);
          onInput(); App.commit('Caixa de texto junto da imagem');
          App.toast('Caixa de texto criada logo depois da imagem: clique nela na página para escrever.', 4000);
        }, 'Cria uma caixa de texto logo depois da imagem'),
        btn(fig.querySelector('figcaption') ? 'Remover legenda' : 'Adicionar legenda', () => {
          const cap = fig.querySelector('figcaption');
          if (cap) cap.remove(); else { const c = document.createElement('figcaption'); c.textContent = 'Legenda'; fig.appendChild(c); }
          styleFigure(fig); onInput(); App.commit('Legenda'); renderPanel();
        }),
        btn('Substituir…', () => replaceImage(fig, false), 'Troca só esta imagem, mantendo tamanho, posição, recorte e contorno'),
        btn('Substituir em todo o livro…', () => replaceImage(fig, true), 'Troca todas as ocorrências desta imagem'),
        a && a.chart ? btn('Editar gráfico…', () => App.elements.chartDialog(fig).then(r => { if (r === 'updated') { onInput(); App.changed('Gráfico atualizado'); } })) : null,
        btn('Restaurar padrão', () => { ['data-rot', 'data-flipx', 'data-flipy', 'data-crop', 'data-ratio', 'data-opacity'].forEach(k => fig.removeAttribute(k)); figDefaults(fig); styleFigure(fig); onInput(); App.commit('Restaurar imagem'); renderPanel(); }),
        btn('Mover para capítulo…', () => moveFigureDialog(fig)),
        btn('Excluir imagem', () => { fig.remove(); selectFigure(null); onInput(); App.commit('Exclusão de imagem'); }, '', 'danger')
      ])
    );
  }

  function renderFullBleedPanel(panel, fb) {
    panel.append(
      el('div', { class: 'fp-head' }, [el('strong', { text: 'Página inteira (sangrada)' }), el('button', { class: 'ghost', text: '✕', onclick: () => selectFigure(null) })]),
      el('p', { class: 'muted small', text: 'Ocupa a página toda, até a sangria. O texto continua na página seguinte.' }),
      el('div', { class: 'fp-row' }, [el('label', { text: 'Ajuste' }), (() => { const s = el('select', { onchange: e => { fb.setAttribute('data-fit', e.target.value); onInput(); App.commit('Ajuste de página inteira'); } }, [['cover', 'Preencher a página (recorta)'], ['contain', 'Mostrar inteira']].map(([v, l]) => el('option', { value: v, text: l }))); s.value = fb.dataset.fit || 'cover'; return s; })()]),
      el('div', { class: 'fp-grid' }, [
        el('button', { text: 'Substituir…', onclick: async () => { const id = await pickOneAsset(); if (id) { fb.setAttribute('data-asset', id); decorate(editor()); onInput(); App.commit('Substituição de imagem'); } } }),
        el('button', { class: 'danger', text: 'Excluir', onclick: () => { fb.remove(); selectFigure(null); onInput(); App.commit('Exclusão de página inteira'); } })
      ])
    );
  }

  async function pickOneAsset() {
    const list = await api.pickImages({ title: 'Escolher imagem' });
    if (!list || !list.length) return null;
    return App.addAsset(list[0]);
  }

  async function replaceImage(fig, all) {
    const oldId = fig.dataset.asset;
    const list = await api.pickImages({ title: all ? 'Nova imagem para todas as ocorrências' : 'Nova imagem' });
    if (!list || !list.length) return;
    if (all) {
      const use = (App.assetUsage()[oldId] || []).length;
      const ok = await App.confirmPreview('Substituir em todo o livro', `A imagem será trocada em ${use} lugar(es), mantendo tamanho, posição, recorte e contorno.`, (App.assetUsage()[oldId] || []).map(u => u.label));
      if (!ok) return;
      const n = list[0];
      const a = App.project.assets[oldId] || { id: oldId };
      Object.assign(a, { id: oldId, name: n.name, dataUrl: n.dataUrl, width: n.width, height: n.height, hash: n.hash, info: n.info, source: n.source });
      App.project.assets[oldId] = a;
      decorate(editor());
      onInput();
      App.changed('Substituição de imagem em todo o livro');
    } else {
      const id = await App.addAsset(list[0]);
      fig.setAttribute('data-asset', id);
      styleFigure(fig);
      onInput();
      App.commit('Substituição de imagem');
    }
    renderPanel();
  }

  function cropDialog(fig) {
    const a = App.project.assets[fig.dataset.asset];
    if (!a) return;
    const orig = String(fig.dataset.crop || '0,0,0,0').split(',').map(Number);
    const v = orig.slice();
    const img = el('img', { src: App.assetUrl(fig.dataset.asset), class: 'crop-img' });
    const mask = el('div', { class: 'crop-mask' });
    const update = () => { mask.style.clipPath = `polygon(0 0,100% 0,100% 100%,0 100%,0 0, ${v[3]}% ${v[0]}%, ${v[3]}% ${100 - v[2]}%, ${100 - v[1]}% ${100 - v[2]}%, ${100 - v[1]}% ${v[0]}%, ${v[3]}% ${v[0]}%)`; };
    const names = ['Superior', 'Direita', 'Inferior', 'Esquerda'];
    const sliders = names.map((n, i) => {
      const out = el('span', { class: 'val', text: v[i] + '%' });
      return el('div', { class: 'fp-row' }, [el('label', { text: n }), el('div', { class: 'slider' }, [el('input', { type: 'range', min: 0, max: 45, step: 0.5, value: v[i], oninput: e => { v[i] = Number(e.target.value); out.textContent = v[i] + '%'; update(); } }), out])]);
    });
    update();
    App.modal({
      title: 'Recortar imagem', wide: true,
      body: el('div', { class: 'crop-wrap' }, [el('div', { class: 'crop-stage' }, [img, mask]), el('div', {}, [el('p', { class: 'muted small', text: 'O recorte não altera o arquivo original e pode ser desfeito a qualquer momento (Restaurar padrão).' })].concat(sliders, [el('button', { text: 'Sem recorte', onclick: () => { v.fill(0); sliders.forEach(s => { s.querySelector('input').value = 0; s.querySelector('.val').textContent = '0%'; }); update(); } })]))]),
      buttons: [{ label: 'Cancelar' }, { label: 'Aplicar recorte', primary: true, onClick: () => setFig('data-crop', v.join(','), 'Recorte de imagem') }]
    });
  }

  function moveFigureDialog(fig) {
    const sel = el('select', {}, App.project.chapters.filter(c => c.id !== App.editorChapterId && !c.locked).map(c => el('option', { value: c.id, text: c.title })));
    const where = el('select', {}, [el('option', { value: 'start', text: 'No início do capítulo' }), el('option', { value: 'end', text: 'No fim do capítulo' })]);
    App.modal({
      title: 'Mover imagem para outro capítulo',
      body: el('div', { class: 'grid' }, [App.field('Capítulo', sel), App.field('Posição', where)]),
      buttons: [{ label: 'Cancelar' }, { label: 'Mover', primary: true, onClick: () => moveFigureTo(fig, sel.value, where.value) }]
    });
  }

  function cleanFigureHtml(fig) {
    const c = fig.cloneNode(true);
    c.removeAttribute('style'); c.removeAttribute('contenteditable'); c.removeAttribute('draggable'); c.removeAttribute('data-fid'); c.classList.remove('selected');
    const img = c.querySelector('img'); if (img) { img.removeAttribute('src'); img.removeAttribute('style'); }
    const cap = c.querySelector('figcaption'); if (cap) cap.removeAttribute('contenteditable');
    return c.outerHTML;
  }

  function moveFigureTo(fig, chapterId, where) {
    const target = App.chapter(chapterId);
    if (!target) return;
    if (target.locked) return App.toast('O capítulo de destino está bloqueado.');
    const html = cleanFigureHtml(fig);
    fig.remove();
    selectFigure(null);
    onInput();
    target.html = where === 'start' ? html + target.html : target.html + html;
    App.changed('Imagem movida para “' + target.title + '”');
    App.toast('Imagem movida para “' + target.title + '”.');
  }

  // ---------------------------------------------------------------- notas de rodapé
  function renderNotePanel(panel) {
    panel.classList.add('show');
    const n = selectedNote;
    panel.append(
      el('div', { class: 'fp-head' }, [el('strong', { text: 'Nota de rodapé' }), el('button', { class: 'ghost', text: '✕', onclick: () => { selectedNote = null; n.classList.remove('selected'); renderPanel(); } })]),
      el('p', { class: 'muted small', text: 'O texto da nota pode ser editado diretamente no editor (trecho destacado).' }),
      el('div', { class: 'fp-grid' }, [
        el('button', { text: 'Transformar em texto', onclick: () => { n.replaceWith(document.createTextNode(' (' + n.textContent.trim() + ')')); selectedNote = null; onInput(); App.commit('Nota convertida em texto'); renderPanel(); } }),
        el('button', { class: 'danger', text: 'Remover esta nota', onclick: () => { n.remove(); selectedNote = null; onInput(); App.commit('Remoção de nota'); renderPanel(); App.toast('Nota removida.'); } }),
        el('button', { text: 'Ver todas as notas', onclick: () => App.setView('notes') })
      ])
    );
  }

  function insertFootnote() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor().contains(sel.anchorNode)) return App.toast('Posicione o cursor no texto onde a nota deve aparecer.');
    const range = sel.getRangeAt(0).cloneRange();
    App.prompt('Nova nota de rodapé', 'Texto da nota', '', { multiline: true, ok: 'Inserir' }).then(text => {
      if (!text || !text.trim()) return;
      editor().focus();
      sel.removeAllRanges();
      range.collapse(false);
      sel.addRange(range);
      document.execCommand('insertHTML', false, `<span class="footnote">${App.escape(text.trim())}</span>&#8203;`);
      onInput();
      App.commit('Inserção de nota');
    });
  }

  // ---------------------------------------------------------------- ligações (links) e seções
  // Ligação interna: aponta para um capítulo ou título (T1/T2/T3) do livro; pode mostrar o número
  // da página de destino ("ver p. 23"), preenchido depois da paginação. Ligação externa: URL.
  function ensureHeadingId(target) {
    // os ids automáticos (capítulo-sN) dependem da posição; um id fixo mantém a ligação
    const m = /^(.+)-s(\d+)$/.exec(target);
    if (!m) return target;
    const ch = App.project.chapters.find(c => c.id === m[1]);
    if (!ch) return target;
    const fresh = 'ref-' + D.uid();
    const fix = root => { const h = root.querySelectorAll('h2, h3, h4')[Number(m[2]) - 1]; if (!h) return null; if (h.id) return h.id; h.id = fresh; return fresh; };
    if (ch.id === App.editorChapterId) { const id = fix(editor()); if (id) { onInput(); return id; } return target; }
    const tpl = document.createElement('template');
    tpl.innerHTML = ch.html || '';
    const id = fix(tpl.content);
    if (!id) return target;
    ch.html = tpl.innerHTML;
    return id;
  }
  function linkDialog() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor().contains(sel.anchorNode)) return App.toast('Selecione o texto da ligação (ou posicione o cursor).');
    const range = sel.getRangeAt(0).cloneRange();
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const existing = node && node.closest('a');
    const targets = App.toc.collect();
    const kind = el('select', {}, [['internal', 'Capítulo ou título deste livro'], ['url', 'Endereço da internet (site, e-mail)']].map(([a, b]) => el('option', { value: a, text: b })));
    const tgt = el('select', {}, targets.map(t => el('option', { value: t.target, text: `${'   '.repeat(t.level - 1)}${t.level > 1 ? '↳ ' : ''}${t.label ? t.label + ' — ' : ''}${t.title}`.slice(0, 100) })));
    const url = el('input', { type: 'text', placeholder: 'https://… ou mailto:…' });
    const showPage = el('input', { type: 'checkbox', checked: true });
    if (existing) {
      const href = existing.getAttribute('href') || '';
      if (href.startsWith('#')) { kind.value = 'internal'; tgt.value = href.slice(1); showPage.checked = existing.classList.contains('xref-page'); }
      else { kind.value = 'url'; url.value = href; }
    }
    const rows = el('div', {}, []);
    const sync = () => { rows.innerHTML = ''; rows.append(kind.value === 'internal' ? el('div', {}, [App.field('Destino', tgt), el('label', { class: 'chk' }, [showPage, ' Mostrar o número da página de destino (ex.: “ver Capítulo 3, p. 41”)'])]) : App.field('Endereço', url)); };
    kind.addEventListener('change', sync);
    sync();
    const restore = () => { editor().focus(); sel.removeAllRanges(); sel.addRange(range); };
    App.modal({
      title: existing ? 'Editar ligação' : 'Inserir ligação',
      body: el('div', {}, [App.field('Tipo', kind), rows, el('p', { class: 'muted small', text: 'No PDF e no EPUB a ligação é clicável; no livro impresso, a ligação interna pode mostrar a página do destino.' })]),
      buttons: [
        existing ? { label: 'Remover ligação', danger: true, onClick: () => { existing.replaceWith(...Array.from(existing.childNodes).filter(n => !(n.classList && n.classList.contains('xref-num')))); onInput(); App.commit('Ligação removida'); } } : null,
        { label: 'Cancelar' },
        { label: existing ? 'Salvar' : 'Inserir', primary: true, onClick: () => {
          let href;
          if (kind.value === 'url') {
            href = url.value.trim();
            if (!href) return false;
            if (!/^(https?:|mailto:)/i.test(href)) href = (/@/.test(href) && !/\//.test(href) ? 'mailto:' : 'https://') + href;
          } else {
            if (!tgt.value) return false;
            href = '#' + ensureHeadingId(tgt.value);
          }
          const cls = kind.value === 'internal' ? (showPage.checked ? 'xref xref-page' : 'xref') : 'ext';
          if (existing) { existing.setAttribute('href', href); existing.className = cls; onInput(); App.commit('Ligação alterada'); return; }
          restore();
          const r = sel.getRangeAt(0);
          const a = document.createElement('a');
          a.setAttribute('href', href);
          a.className = cls;
          if (r.collapsed) {
            const t = kind.value === 'url' ? href.replace(/^mailto:/, '') : (targets.find(x => x.target === tgt.value) || {}).title || 'ligação';
            a.textContent = t;
          } else a.appendChild(r.extractContents());
          r.insertNode(a);
          r.setStartAfter(a); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
          onInput();
          App.commit('Ligação inserida');
        } }
      ].filter(Boolean)
    });
  }

  // Divide o capítulo no parágrafo do cursor: daí em diante vira um novo capítulo/seção
  async function splitChapter() {
    const c = App.chapter();
    const b = topBlock();
    if (!c || !b) return App.toast('Posicione o cursor no parágrafo onde o novo capítulo deve começar.');
    if (!b.previousElementSibling) return App.toast('O cursor já está no início do capítulo.');
    const isHead = /^H[234]$/.test(b.tagName);
    const title = await App.prompt('Dividir capítulo', 'Título do novo capítulo (o texto a partir do cursor vai para ele)', isHead ? b.textContent.trim() : 'Novo capítulo');
    if (title == null) return;
    const tail = [];
    for (let n = b; n; n = n.nextElementSibling) tail.push(n);
    if (isHead && title.trim() === b.textContent.trim()) tail.shift().remove();
    const tpl = document.createElement('div');
    tail.forEach(n => tpl.appendChild(n));
    App.editor.flush();
    onInput();
    const clean = tpl.cloneNode(true);
    undecorate(clean);
    const idx = App.project.chapters.indexOf(c);
    const nc = { id: D.uid(), title: title.trim() || 'Novo capítulo', numbered: c.numbered, html: clean.innerHTML || '<p><br></p>', locked: false, style: {}, separator: 'default', openingImage: null };
    App.project.chapters.splice(idx + 1, 0, nc);
    App.editorChapterId = null;
    App.changed('Capítulo dividido');
    App.setView('chapter', nc.id);
    App.toast('Capítulo dividido. O restante do texto continua igual, só que no novo capítulo.', 4000);
  }
  function topBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.anchorNode;
    while (n && n.parentNode !== editor()) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  }
  async function newSection() {
    const title = await App.prompt('Nova seção / capítulo', 'Título da nova página (entra logo depois deste capítulo)', 'Nova seção');
    if (title == null) return;
    App.chapters.add(title.trim() || 'Nova seção');
  }

  // ---------------------------------------------------------------- tabelas
  function currentTable() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    return n && editor().contains(n) ? n.closest('table') : null;
  }
  function currentCell() {
    const sel = window.getSelection();
    const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    return n ? n.closest('td,th') : null;
  }
  function renderTablePanel(panel, table) {
    panel.classList.add('show');
    const act = (label, fn) => el('button', { text: label, onclick: () => { const cell = currentCell(); fn(cell); onInput(); App.commit('Edição de tabela'); renderPanel(); } });
    const colIndex = cell => (cell ? Array.from(cell.parentElement.children).indexOf(cell) : -1);
    panel.append(
      el('div', { class: 'fp-head' }, [el('strong', { text: 'Tabela' })]),
      el('div', { class: 'fp-grid' }, [
        act('+ Linha abaixo', cell => { const tr = cell ? cell.parentElement : table.rows[table.rows.length - 1]; const n = tr.cloneNode(true); n.querySelectorAll('td,th').forEach(c => { const td = document.createElement('td'); td.innerHTML = '<br>'; c.replaceWith(td); }); tr.after(n); }),
        act('+ Coluna à direita', cell => { const i = colIndex(cell); Array.from(table.rows).forEach(r => { const ref = r.children[i >= 0 ? i : r.children.length - 1]; const c = document.createElement(ref && ref.tagName === 'TH' ? 'th' : 'td'); c.innerHTML = '<br>'; ref ? ref.after(c) : r.appendChild(c); }); }),
        act('− Linha', cell => { if (cell && table.rows.length > 1) cell.parentElement.remove(); }),
        act('− Coluna', cell => { const i = colIndex(cell); if (i >= 0 && table.rows[0].children.length > 1) Array.from(table.rows).forEach(r => r.children[i] && r.children[i].remove()); }),
        act('Cabeçalho na 1ª linha', () => { const r = table.rows[0]; Array.from(r.children).forEach(c => { const n = document.createElement(c.tagName === 'TH' ? 'td' : 'th'); n.innerHTML = c.innerHTML; c.replaceWith(n); }); }),
        act(table.querySelector('caption') ? 'Remover legenda' : 'Adicionar legenda', () => { const c = table.querySelector('caption'); if (c) c.remove(); else { const cap = document.createElement('caption'); cap.textContent = 'Legenda da tabela'; table.prepend(cap); } }),
        el('button', { class: 'danger', text: 'Excluir tabela', onclick: () => { table.remove(); onInput(); App.commit('Exclusão de tabela'); renderPanel(); } })
      ])
    );
  }
  function tableDialog() {
    const rows = el('input', { type: 'number', min: 1, max: 60, value: 3 });
    const cols = el('input', { type: 'number', min: 1, max: 12, value: 3 });
    const head = el('input', { type: 'checkbox', checked: true });
    const cap = el('input', { type: 'text', placeholder: 'Opcional' });
    App.modal({
      title: 'Inserir tabela',
      body: el('div', { class: 'grid' }, [App.field('Linhas', rows), App.field('Colunas', cols), App.field('Primeira linha como cabeçalho', head), App.field('Legenda', cap)]),
      buttons: [{ label: 'Cancelar' }, { label: 'Inserir', primary: true, onClick: () => {
        const r = Math.max(1, Math.min(60, +rows.value || 3));
        const c = Math.max(1, Math.min(12, +cols.value || 3));
        let h = '<table>' + (cap.value.trim() ? `<caption>${App.escape(cap.value.trim())}</caption>` : '') + '<tbody>';
        for (let i = 0; i < r; i++) h += '<tr>' + Array.from({ length: c }, () => (i === 0 && head.checked ? '<th><br></th>' : '<td><br></td>')).join('') + '</tr>';
        h += '</tbody></table><p><br></p>';
        insertBlocks(h);
      } }]
    });
  }

  // ---------------------------------------------------------------- gráficos
  const PALETTE = ['#2f4b7c', '#a05195', '#f95d6a', '#ffa600', '#003f5c', '#665191', '#d45087', '#ff7c43'];
  function drawChart(spec) {
    const W = 1800, H = 1100;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    const font = `"${App.project.settings.styles.body.font}", Georgia, serif`;
    const colors = spec.mono ? spec.data.map((_, i) => `hsl(0,0%,${20 + (i * 47) % 55}%)`) : spec.data.map((_, i) => PALETTE[i % PALETTE.length]);
    g.fillStyle = '#111';
    g.font = `600 56px ${font}`;
    g.textAlign = 'center';
    if (spec.title) g.fillText(spec.title, W / 2, 80);
    const top = spec.title ? 140 : 60, bottom = H - 140, left = 170, right = W - 70;
    const max = Math.max(...spec.data.map(d => d.v), 0) || 1;
    const nice = Math.pow(10, Math.floor(Math.log10(max)));
    const vmax = Math.ceil(max / nice) * nice;
    g.font = `40px ${font}`;
    if (spec.type === 'pie') {
      const total = spec.data.reduce((s, d) => s + Math.max(0, d.v), 0) || 1;
      const cx = W * 0.36, cy = (top + H) / 2 - 20, r = Math.min(W * 0.3, (H - top) / 2 - 40);
      let a0 = -Math.PI / 2;
      spec.data.forEach((d, i) => {
        const a1 = a0 + Math.max(0, d.v) / total * Math.PI * 2;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fillStyle = colors[i]; g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
        a0 = a1;
      });
      g.textAlign = 'left';
      spec.data.forEach((d, i) => {
        const y = top + 60 + i * 70;
        g.fillStyle = colors[i]; g.fillRect(W * 0.7, y - 34, 40, 40);
        g.fillStyle = '#111'; g.fillText(`${d.l} — ${(d.v / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, W * 0.7 + 60, y);
      });
    } else {
      g.strokeStyle = '#999'; g.lineWidth = 2; g.textAlign = 'right'; g.fillStyle = '#333';
      for (let i = 0; i <= 5; i++) {
        const y = bottom - (bottom - top) * i / 5;
        g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.strokeStyle = i ? '#ddd' : '#666'; g.stroke();
        g.fillText((vmax * i / 5).toLocaleString('pt-BR', { maximumFractionDigits: 2 }), left - 20, y + 14);
      }
      const n = spec.data.length || 1;
      const step = (right - left) / n;
      g.textAlign = 'center';
      if (spec.type === 'line') {
        g.beginPath(); g.lineWidth = 8; g.strokeStyle = colors[0];
        spec.data.forEach((d, i) => { const x = left + step * (i + 0.5); const y = bottom - (bottom - top) * d.v / vmax; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
        spec.data.forEach((d, i) => { const x = left + step * (i + 0.5); const y = bottom - (bottom - top) * d.v / vmax; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fillStyle = colors[0]; g.fill(); });
      } else {
        spec.data.forEach((d, i) => {
          const x = left + step * i + step * 0.15;
          const h = (bottom - top) * d.v / vmax;
          g.fillStyle = spec.mono ? '#444' : colors[i];
          g.fillRect(x, bottom - h, step * 0.7, h);
          g.fillStyle = '#111';
          g.fillText(d.v.toLocaleString('pt-BR'), x + step * 0.35, bottom - h - 16);
        });
      }
      g.fillStyle = '#111';
      spec.data.forEach((d, i) => g.fillText(String(d.l).slice(0, 18), left + step * (i + 0.5), bottom + 60));
    }
    return cv.toDataURL('image/png');
  }
  function chartDialog(fig) {
    const prev = fig && App.project.assets[fig.dataset.asset] && App.project.assets[fig.dataset.asset].chart;
    const spec = prev ? JSON.parse(JSON.stringify(prev)) : { type: 'bar', title: '', mono: false, data: [{ l: 'A', v: 10 }, { l: 'B', v: 25 }, { l: 'C', v: 15 }] };
    const type = el('select', {}, [['bar', 'Colunas'], ['line', 'Linhas'], ['pie', 'Pizza']].map(([v, l]) => el('option', { value: v, text: l })));
    type.value = spec.type;
    const title = el('input', { type: 'text', value: spec.title });
    const mono = el('input', { type: 'checkbox' });
    mono.checked = spec.mono;
    const data = el('textarea', { rows: 8 });
    data.value = spec.data.map(d => `${d.l}; ${String(d.v).replace('.', ',')}`).join('\n');
    const img = el('img', { class: 'chart-preview' });
    const read = () => ({ type: type.value, title: title.value, mono: mono.checked, data: data.value.split('\n').map(l => l.split(/[;\t]/)).filter(p => p.length >= 2 && p[0].trim()).map(p => ({ l: p[0].trim(), v: parseFloat(p[1].replace(/\./g, '').replace(',', '.')) || 0 })) });
    const redraw = () => { img.src = drawChart(read()); };
    [type, title, mono, data].forEach(i => i.addEventListener('input', redraw));
    type.addEventListener('change', redraw);
    mono.addEventListener('change', redraw);
    redraw();
    App.modal({
      title: prev ? 'Editar gráfico' : 'Inserir gráfico', wide: true,
      body: el('div', { class: 'chart-wrap' }, [el('div', { class: 'grid' }, [App.field('Tipo', type), App.field('Título', title), App.field('Tons de cinza (impressão P&B)', mono), App.field('Dados (rótulo; valor — um por linha)', data, '', 'wide')]), img]),
      buttons: [{ label: 'Cancelar' }, { label: prev ? 'Atualizar' : 'Inserir', primary: true, onClick: async () => {
        const s = read();
        const url = drawChart(s);
        if (prev) {
          const a = App.project.assets[fig.dataset.asset];
          Object.assign(a, { dataUrl: url, chart: s, hash: await App.hashDataUrl(url) });
          styleFigure(fig); onInput(); App.changed('Gráfico atualizado');
        } else {
          const id = await App.addAsset({ dataUrl: url, name: 'Gráfico ' + (s.title || ''), width: 1800, height: 1100 });
          App.project.assets[id].chart = s;
          insertBlocks(figureHtml(id, { width: 90, caption: s.title }));
        }
      } }]
    });
  }

  // ---------------------------------------------------------------- estilos de parágrafo
  function selectedTopBlocks() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return [];
    const ed = editor();
    const r = sel.getRangeAt(0);
    const top = n => { while (n && n.parentNode !== ed) n = n.parentNode; return n; };
    const a = top(r.startContainer), b = top(r.endContainer);
    if (!a) return [];
    const out = [];
    let n = a;
    while (n) { out.push(n); if (n === b) break; n = n.nextSibling; }
    return out.filter(x => x.nodeType === 1);
  }

  function applyBlockStyle(v) {
    const ed = editor();
    ed.focus();
    const blocks = selectedTopBlocks();
    // desfaz contêineres especiais
    blocks.forEach(b => {
      if (b.matches('div.poem, div.box') && v !== 'poem' && v !== 'box') {
        const frag = document.createDocumentFragment();
        Array.from(b.children).forEach(p => {
          if (p.tagName === 'P' && b.classList.contains('poem')) p.innerHTML.split(/<br\s*\/?>/i).forEach(line => { const np = document.createElement('p'); np.innerHTML = line || '<br>'; frag.appendChild(np); });
          else frag.appendChild(p);
        });
        b.replaceWith(frag);
      }
    });
    if (v === 'poem' || v === 'box') {
      const blks = selectedTopBlocks().filter(b => /^(P|H2|H3|H4|BLOCKQUOTE)$/.test(b.tagName));
      if (!blks.length) return;
      const wrap = document.createElement('div');
      wrap.className = v;
      if (v === 'poem') {
        let stanza = [];
        const push = () => { if (stanza.length) { const p = document.createElement('p'); p.innerHTML = stanza.join('<br>'); wrap.appendChild(p); stanza = []; } };
        blks.forEach(b => { const t = b.innerHTML.trim(); if (!b.textContent.trim()) push(); else t.split(/<br\s*\/?>/i).forEach(l => stanza.push(l)); });
        push();
      } else blks.forEach(b => { const p = document.createElement('p'); p.innerHTML = b.innerHTML; wrap.appendChild(p); });
      blks[0].before(wrap);
      blks.forEach(b => b.remove());
      onInput();
      App.commit('Estilo de parágrafo');
      return;
    }
    const tag = v === 'phrase' || v === 'reference' || v === 'epigraph-inline' ? 'p' : v;
    if (v !== 'blockquote') {
      const b = currentBlock();
      if (b && b.closest('blockquote')) document.execCommand('outdent');
    }
    document.execCommand('formatBlock', false, tag);
    ed.querySelectorAll('blockquote').forEach(q => { if (!q.querySelector('p')) { const p = document.createElement('p'); while (q.firstChild) p.appendChild(q.firstChild); q.appendChild(p); } });
    selectedTopBlocks().forEach(b => {
      if (b.tagName === 'P') { b.classList.remove('phrase', 'reference', 'epigraph-inline'); if (tag === 'p' && v !== 'p') b.classList.add(v); }
    });
    onInput();
    App.commit('Estilo de parágrafo');
  }

  function syncToolbar() {
    const b = currentBlock();
    let v = 'p';
    if (b) {
      if (/^H[234]$/.test(b.tagName)) v = b.tagName.toLowerCase();
      else if (b.closest('blockquote')) v = 'blockquote';
      else if (b.closest('div.poem')) v = 'poem';
      else if (b.closest('div.box')) v = 'box';
      else if (b.classList && b.classList.contains('phrase')) v = 'phrase';
      else if (b.classList && b.classList.contains('reference')) v = 'reference';
      else if (b.classList && b.classList.contains('epigraph-inline')) v = 'epigraph-inline';
    }
    $('#blockFormat').value = v;
    ['bold', 'italic', 'underline', 'superscript'].forEach(cmd => { const btn = $(`[data-exec="${cmd}"]`); if (btn) btn.classList.toggle('on', document.queryCommandState(cmd)); });
    if (!selectedFig && !selectedNote) renderPanel();
  }

  // ---------------------------------------------------------------- arrastar e soltar
  // Lado onde a imagem foi solta: esquerda/direita = texto ao redor; centro = centralizada
  function zoneAt(x, rect) {
    const f = (x - rect.left) / Math.max(1, rect.width);
    return f < 0.3 ? 'left' : f > 0.7 ? 'right' : 'center';
  }
  function zoneOpts(zone) {
    if (zone === 'left') return { align: 'left', wrap: 'square', width: 40 };
    if (zone === 'right') return { align: 'right', wrap: 'square', width: 40 };
    return { align: 'center', wrap: 'none' };
  }
  function blockAtPoint(y) {
    const ed = editor();
    const kids = Array.from(ed.children);
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      if (y < r.top + r.height / 2) return { before: k };
    }
    return { after: kids[kids.length - 1] || null };
  }
  function showIndicator(y, valid) {
    const ind = $('#dropIndicator');
    const ed = editor();
    const pos = blockAtPoint(y);
    const ref = pos.before || pos.after;
    const scroll = $('#editorScroll');
    const sr = scroll.getBoundingClientRect();
    let top;
    if (!ref) top = ed.getBoundingClientRect().top + 40;
    else { const r = ref.getBoundingClientRect(); top = pos.before ? r.top - 4 : r.bottom + 2; }
    const er = ed.getBoundingClientRect();
    ind.style.top = (top - sr.top + scroll.scrollTop) + 'px';
    const zone = showIndicator.x != null ? zoneAt(showIndicator.x, er) : 'center';
    const inner = er.width - 80;
    ind.style.left = (er.left - sr.left + 40 + (zone === 'right' ? inner * 0.6 : 0)) + 'px';
    ind.style.width = (zone === 'center' ? inner : inner * 0.4) + 'px';
    ind.dataset.zone = zone === 'left' ? 'à esquerda, texto ao redor' : zone === 'right' ? 'à direita, texto ao redor' : 'centralizada';
    ind.classList.add('show');
    ind.classList.toggle('invalid', !valid);
    return pos;
  }
  function hideIndicator() { $('#dropIndicator').classList.remove('show'); }

  function dragKind(dt) {
    const types = Array.from(dt.types || []);
    if (types.includes('application/x-dl-figure')) return 'figure';
    if (types.includes('application/x-dl-element')) return 'element';
    if (types.includes('application/x-dl-separator')) return 'separator';
    if (types.includes('application/x-dl-library') || types.includes('application/x-dl-asset')) return 'image';
    if (types.includes('Files')) return 'files';
    return null;
  }

  function setupDnD() {
    const ed = editor();
    const scroll = $('#editorScroll');
    ed.addEventListener('dragstart', e => {
      const fig = e.target.closest && e.target.closest('figure.img, div.fullbleed');
      if (!fig) return;
      if (fig.classList.contains('fullbleed') && !fig.dataset.fid) fig.dataset.fid = D.uid('f');
      e.dataTransfer.setData('application/x-dl-figure', fig.dataset.fid);
      e.dataTransfer.effectAllowed = 'move';
      const img = fig.querySelector('img');
      if (img) e.dataTransfer.setDragImage(img, 20, 20);
    });
    scroll.addEventListener('dragover', e => {
      const kind = dragKind(e.dataTransfer);
      if (!kind) return;
      const c = App.chapter();
      const valid = !(c && c.locked) && kind !== 'separator';
      e.preventDefault();
      e.dataTransfer.dropEffect = valid ? (kind === 'figure' ? 'move' : 'copy') : 'none';
      showIndicator.x = e.clientX;
      showIndicator(e.clientY, valid);
    });
    scroll.addEventListener('dragleave', e => { if (!scroll.contains(e.relatedTarget)) hideIndicator(); });
    scroll.addEventListener('drop', async e => {
      const kind = dragKind(e.dataTransfer);
      hideIndicator();
      if (!kind) return;
      e.preventDefault();
      const c = App.chapter();
      if (c && c.locked) return App.toast('Capítulo bloqueado: desbloqueie para inserir elementos.');
      if (kind === 'separator') return App.toast('Imagens da biblioteca de separadores só podem ser usadas abaixo dos títulos — arraste para o título do capítulo ou use “Aparência”.', 5000);
      const pos = blockAtPoint(e.clientY);
      const zone = zoneAt(e.clientX, ed.getBoundingClientRect());
      if (kind === 'element') {
        // elemento da gaveta Elementos: abre o diálogo (se houver) e entra exatamente onde foi solto
        const k = e.dataTransfer.getData('application/x-dl-element');
        let html = await App.elements.makeElement(k);
        if (!html || html === 'updated') return;
        if (pos.before) html = html.replace(/<p><br><\/p>$/, ''); // no meio do texto não precisa de linha vazia depois
        insertBlocks(html, pos.before, pos.after);
        App.changed('Elemento inserido: ' + App.elements.byKind(k).label);
        return;
      }
      if (kind === 'figure') {
        const fid = e.dataTransfer.getData('application/x-dl-figure');
        const fig = ed.querySelector(`[data-fid="${fid}"]`);
        if (!fig) return;
        if (fig.classList.contains('img')) {
          const z = zoneOpts(zone);
          fig.dataset.align = z.align; fig.dataset.wrap = z.wrap;
          if (z.width && Number(fig.dataset.width) > 50) fig.dataset.width = String(z.width);
          styleFigure(fig);
        }
        // a fonte de uma tabela/gráfico (“Fonte: …”) acompanha o elemento
        const src = fig.nextElementSibling && fig.nextElementSibling.matches('p.table-source') ? fig.nextElementSibling : null;
        if (pos.before !== fig && pos.after !== fig && pos.before !== src && pos.after !== src) {
          if (pos.before) ed.insertBefore(fig, pos.before); else if (pos.after) pos.after.after(fig);
          if (src) fig.after(src);
        }
        onInput();
        App.commit(fig.tagName === 'TABLE' ? 'Tabela movida' : 'Imagem movida');
        return;
      }
      const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'corpo');
      if (ids && ids.manuscript) return App.importer.fromPath(ids.manuscript);
      if (!ids || !ids.length) return;
      insertBlocks(ids.map(id => figureHtml(id, zoneOpts(zone))).join(''), pos.before, pos.after);
      App.toast(ids.length > 1 ? `${ids.length} imagens inseridas.` : 'Imagem inserida.');
    });
    // tabelas: alça “⠿ mover” sobre a tabela (as células continuam editáveis normalmente)
    const handle = el('div', { class: 'table-handle', draggable: 'true', title: 'Arraste para mover a tabela', text: '⠿ mover' });
    scroll.appendChild(handle);
    let handleTable = null;
    const placeHandle = t => {
      handleTable = t;
      if (!t) { handle.style.display = 'none'; return; }
      const sr = scroll.getBoundingClientRect(), tr = t.getBoundingClientRect();
      handle.style.display = 'block';
      handle.style.top = (tr.top - sr.top + scroll.scrollTop - 22) + 'px';
      handle.style.left = (tr.left - sr.left + scroll.scrollLeft) + 'px';
    };
    ed.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('table'); if (t && t.parentNode === ed && !(App.chapter() && App.chapter().locked)) placeHandle(t); });
    scroll.addEventListener('mouseleave', e => { if (e.relatedTarget !== handle) placeHandle(null); });
    scroll.addEventListener('scroll', () => placeHandle(null));
    handle.addEventListener('dragstart', e => {
      if (!handleTable) return e.preventDefault();
      if (!handleTable.dataset.fid) handleTable.dataset.fid = D.uid('f');
      e.dataTransfer.setData('application/x-dl-figure', handleTable.dataset.fid);
      e.dataTransfer.effectAllowed = 'move';
    });
    handle.addEventListener('dragend', () => placeHandle(null));
    // separadores podem ser soltos no título do capítulo
    const meta = $('.chapter-meta');
    meta.addEventListener('dragover', e => { if (dragKind(e.dataTransfer) === 'separator' || dragKind(e.dataTransfer) === 'image') { e.preventDefault(); meta.classList.add('drop-ok'); } });
    meta.addEventListener('dragleave', () => meta.classList.remove('drop-ok'));
    meta.addEventListener('drop', async e => {
      meta.classList.remove('drop-ok');
      const k = dragKind(e.dataTransfer);
      if (k !== 'separator' && k !== 'image') return;
      e.preventDefault();
      const c = App.chapter();
      if (!c || c.locked) return;
      const ids = await App.editor.assetsFromDrop(e.dataTransfer, 'separadores');
      if (!ids || !ids.length) return;
      c.separator = ids[0];
      App.changed('Separador do capítulo');
      renderLookPanel(true);
      App.toast('Separador aplicado abaixo do título deste capítulo.');
    });
  }

  // Converte o que foi arrastado (biblioteca, imagens do projeto, arquivos) em ids de imagens do projeto
  async function assetsFromDrop(dt, kind) {
    const lib = dt.getData('application/x-dl-library') || dt.getData('application/x-dl-separator');
    if (lib) { const it = JSON.parse(lib); return [await App.addAssetFromUrl(it.url, { name: it.name, kind: it.kind })]; }
    const aid = dt.getData('application/x-dl-asset');
    if (aid) return [aid];
    const files = Array.from(dt.files || []);
    if (!files.length) return [];
    const paths = files.map(f => api.pathForFile(f));
    const manuscript = paths.find(p => /\.(docx?|epub|pdf|odt|txt|md|markdown|html?|rtf)$/i.test(p));
    if (manuscript && !paths.some(p => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(p))) { const r = []; r.manuscript = manuscript; return r; }
    const assets = await api.imagesFromPaths(paths);
    const bad = paths.filter(p => p && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(p));
    if (bad.length) App.toast(`Formato não suportado: ${bad.map(App.fileName).join(', ')}`, 4000);
    const ids = [];
    for (const a of assets) ids.push(await App.addAsset(Object.assign(a, { kind })));
    return ids;
  }

  // ---------------------------------------------------------------- aparência do capítulo
  function renderLookPanel(show) {
    const panel = $('#chapterLookPanel');
    if (show === false) { panel.classList.remove('show'); return; }
    if (show === true) panel.classList.add('show');
    if (!panel.classList.contains('show')) return;
    const c = App.chapter();
    if (!c) return;
    panel.innerHTML = '';
    panel.appendChild(App.panels.chapterStyleFields([c], () => renderLookPanel()));
  }

  // ---------------------------------------------------------------- configuração
  function toolbarAction(action) {
    const c = App.chapter();
    if (c && c.locked) return App.toast('Capítulo bloqueado.');
    if (action === 'scene') return insertBlocks('<hr class="scene-break"><p><br></p>');
    if (action === 'pagebreak') return insertBlocks('<div class="page-break"></div><p><br></p>');
    if (action === 'footnote') return insertFootnote();
    if (action === 'link') return linkDialog();
    if (action === 'removenotes') return App.removeAllNotes();
    if (action === 'split') return splitChapter();
    if (action === 'newsection') return newSection();
    if (action === 'table') return App.elements.tableDialog(null, 'Nova tabela').then(h => { if (h) { insertBlocks(h); App.changed('Tabela inserida'); } });
    if (action === 'chart') return App.elements.chartDialog(null).then(h => { if (h && h !== 'updated') { insertBlocks(h); App.changed('Gráfico inserido'); } });
    if (action === 'invisibles') { editor().classList.toggle('show-invisibles'); return; }
    if (action === 'noindent') { const b = currentBlock(); if (b && b.tagName === 'P') { b.classList.toggle('no-indent'); onInput(); App.commit('Recuo de parágrafo'); } return; }
    if (action === 'smallcaps') {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return App.toast('Selecione o texto para aplicar versalete.');
      const range = sel.getRangeAt(0);
      const parentSc = range.commonAncestorContainer.parentElement && range.commonAncestorContainer.parentElement.closest('.smallcaps');
      if (parentSc) { parentSc.replaceWith(...Array.from(parentSc.childNodes)); onInput(); return; }
      const span = document.createElement('span');
      span.className = 'smallcaps';
      span.appendChild(range.extractContents());
      range.insertNode(span);
      onInput();
      return;
    }
    if (action === 'image' || action === 'fullbleed') {
      const sel = window.getSelection();
      const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      api.pickImages({ multiple: action === 'image', title: action === 'fullbleed' ? 'Imagem de página inteira' : 'Inserir imagens' }).then(async list => {
        if (!list || !list.length) return;
        const ids = [];
        for (const a of list) ids.push(await App.addAsset(a));
        editor().focus();
        if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
        if (action === 'fullbleed') insertBlocks(`<div class="fullbleed" data-asset="${ids[0]}" data-fit="cover"></div><p><br></p>`);
        else insertBlocks(ids.map(id => figureHtml(id)).join('') + '<p><br></p>');
      });
    }
  }

  function setup() {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    const ed = editor();
    ed.addEventListener('input', onInput);
    ed.addEventListener('keyup', syncToolbar);
    ed.addEventListener('mouseup', syncToolbar);
    ed.addEventListener('click', e => {
      const fig = e.target.closest('figure.img, div.fullbleed');
      if (fig && !e.target.closest('figcaption')) { selectFigure(fig); return; }
      const note = e.target.closest('.footnote');
      if (note) {
        $$('#editor .footnote.selected').forEach(f => f.classList.remove('selected'));
        selectedFig = null;
        selectedNote = note;
        note.classList.add('selected');
        renderPanel();
        return;
      }
      if (selectedFig || selectedNote) selectFigure(null);
    });
    ed.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insertBlocks('<div class="page-break"></div><p><br></p>'); }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); toolbarAction('link'); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFig && document.activeElement === ed && window.getSelection().isCollapsed) {
        const cap = e.target.closest && e.target.closest('figcaption');
        if (!cap) { e.preventDefault(); selectedFig.remove(); selectFigure(null); onInput(); App.commit('Exclusão de imagem'); }
      }
    });
    ed.addEventListener('paste', e => {
      const html = e.clipboardData.getData('text/html').normalize('NFC');
      const text = e.clipboardData.getData('text/plain').normalize('NFC');
      const files = Array.from(e.clipboardData.files || []);
      if (!html && !text && !files.length) return;
      e.preventDefault();
      paste({ html, text, files });
    });
    ed.addEventListener('focusin', () => { if (App.live) App.live.noteEditorFocus(); });
    $('#editorToolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    // a barra de ferramentas age no texto do capítulo; se o cursor está nas páginas, a ação vai para o mesmo ponto
    const viaStage = () => App.live && App.live.focusedOnStage() && App.view === 'chapter';
    $$('#editorToolbar [data-exec]').forEach(b => b.addEventListener('click', () => {
      const c = App.chapter();
      if (c && c.locked) return;
      if (viaStage() && App.live.exec(b.dataset.exec)) { syncToolbar(); return; }
      const run = () => { editor().focus(); document.execCommand(b.dataset.exec, false, null); onInput(); syncToolbar(); };
      if (viaStage()) App.live.runOnModel(run); else run();
    }));
    $('#blockFormat').addEventListener('change', e => { const v = e.target.value; if (viaStage()) App.live.runOnModel(() => applyBlockStyle(v)); else applyBlockStyle(v); });
    $$('#editorToolbar [data-action]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.action; if (viaStage()) App.live.runOnModel(() => toolbarAction(a)); else toolbarAction(a); }));
    setupMeta();
  }

  function paste(data) {
    const ed = editor();
    {
      const html = data.html || '';
      const text = data.text || '';
      const files = Array.from(data.files || []).filter(f => /^image\//.test(f.type));
      if (files.length && !html) {
        (async () => {
          const ids = [];
          for (const f of files) ids.push(await App.addAsset({ dataUrl: await App.fileToDataUrl(f), name: f.name || 'imagem colada' }));
          insertBlocks(ids.map(id => figureHtml(id)).join(''));
        })();
        return;
      }
      if (!html && !text) return;
      // tabelas, gráficos e imagens: formatação original lida antes da limpeza
      if (html && !data.prepared && App.pasteKeep && /<table|<img|<svg|v:imagedata/i.test(html)) {
        const sel = document.getSelection(), rg = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        App.pasteKeep.prepare(html, data.files).then(r => {
          if (rg && ed.contains(rg.startContainer)) { ed.focus(); const s2 = document.getSelection(); s2.removeAllRanges(); s2.addRange(rg); }
          paste(Object.assign({}, data, { html: r.html, prepared: true, files: [] }));
          if (r.tables || r.images) App.toast(`Colado com a formatação original${r.tables ? `: ${r.tables} tabela(s)` : ''}${r.images ? `${r.tables ? ',' : ':'} ${r.images} imagem(ns)/gráfico(s)` : ''} — ajustado à largura da página.`, 4000);
        }).catch(err => { console.error('colar com formatação', err); paste(Object.assign({}, data, { prepared: true })); });
        return;
      }
      let clean;
      if (html) clean = BookText.sanitizeHtml(html);
      else {
        const parts = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n|\n/).filter(s => s.trim());
        clean = parts.length > 1 ? parts.map(p => '<p>' + BookText.escapeHtml(p.trim()) + '</p>').join('') : BookText.escapeHtml(text);
      }
      // imagens coladas em data: viram imagens do projeto
      if (/<img[^>]+src="data:/.test(clean)) {
        (async () => {
          const tpl = document.createElement('template');
          tpl.innerHTML = clean;
          for (const img of Array.from(tpl.content.querySelectorAll('img[src^="data:"]'))) {
            const id = await App.addAsset({ dataUrl: img.getAttribute('src'), name: 'imagem colada' });
            const t = document.createElement('template');
            t.innerHTML = figureHtml(id);
            (img.closest('figure') || img).replaceWith(t.content.firstChild);
          }
          document.execCommand('insertHTML', false, tpl.innerHTML);
          decorate(ed);
          onInput();
        })();
        return;
      }
      document.execCommand('insertHTML', false, clean);
      decorate(ed);
      onInput();
    }
  }

  function setupMeta() {

    $('#chapterTitle').addEventListener('input', e => {
      const c = App.chapter();
      if (!c || c.locked) return;
      c.title = e.target.value;
      const item = $(`.chapter-item[data-id="${c.id}"] .name`);
      if (item) item.textContent = c.title || 'Sem título';
      App.changed(null);
      clearTimeout(commitTimer);
      commitTimer = setTimeout(() => App.commit('Título do capítulo'), 1200);
    });
    $('#chapterTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); editor().focus(); } });
    $('#chapterNumbered').addEventListener('change', e => { const c = App.chapter(); if (!c || c.locked) return; c.numbered = e.target.checked; App.changed('Numeração do capítulo'); App.renderChapterList(); });
    $('#chapterDelete').addEventListener('click', () => App.chapters.remove([App.chapterId]));
    // apagar o título por completo e apertar Backspace/Delete de novo oferece excluir o capítulo
    $('#chapterTitle').addEventListener('keydown', e => { if ((e.key === 'Backspace' || e.key === 'Delete') && !e.target.value) { e.preventDefault(); App.chapters.remove([App.chapterId]); } });
    $('#chapterLock').addEventListener('click', () => {
      const c = App.chapter();
      if (!c) return;
      flush();
      c.locked = !c.locked;
      App.changed(c.locked ? 'Capítulo bloqueado' : 'Capítulo desbloqueado', { preview: false });
      applyLock(c);
      App.renderChapterList();
    });
    $('#chapterLook').addEventListener('click', () => { const p = $('#chapterLookPanel'); renderLookPanel(!p.classList.contains('show')); });
    setupDnD();
  }

  // Insere imagens num capítulo junto do bloco cujo texto começa com `probe` (usado pela prévia)
  function insertIntoChapter(ch, probe, before, ids, zone) {
    if (!ch || ch.locked) return false;
    App.flush();
    const tpl = document.createElement('template');
    tpl.innerHTML = ch.html || '';
    const norm = t => String(t || '').replace(/[\u00ad\u2011\u200b]/g, '').replace(/\s+/g, ' ').trim();
    const kids = Array.from(tpl.content.children);
    const pr = norm(probe).slice(0, 60);
    let at = pr ? kids.find(k => norm(k.textContent).includes(pr)) : null;
    const html = ids.map(id => figureHtml(id, zoneOpts(zone))).join('');
    const frag = document.createElement('template');
    frag.innerHTML = html;
    if (at) { if (before) at.before(frag.content); else at.after(frag.content); } else tpl.content.appendChild(frag.content);
    ch.html = tpl.innerHTML;
    if (ch.id === App.editorChapterId) { App.editorChapterId = null; if (App.view === 'chapter') load(); }
    return true;
  }

  App.editor = { setup, paste, action: a => toolbarAction(a), setFig: (fig, attr, v, label) => { selectedFig = fig; setFig(attr, v, label); }, selectedFigure: () => selectedFig, onInput: () => onInput(), insertIntoChapter, zoneAt, load, flush, decorate, figureHtml, insertBlocks, assetsFromDrop, chartDialog, styleFigure, renderLookPanel, selectFigure, applyBlockStyle, ensureHeadingId };
  App.hooks.viewRender.chapter = () => {
    const c = App.chapter();
    if (!c) { if (App.project.chapters.length) { App.chapterId = App.project.chapters[0].id; } else return App.setView('book'); }
    load();
  };
})();
