/* global App */
// Imersão: galeria de imagens para a abertura dos capítulos (acima do título, além do corte).
// Uma imagem para todos os capítulos, ou várias sorteadas — uma por capítulo, sem repetir em seguida.
(function () {
  const { el, $, api } = App;
  const GROUPS = [['all', 'Todas'], ['geometrica', 'Geométricas · não ficção'], ['romance', 'Romance · florais e silhuetas'], ['terror', 'Terror'], ['suspense', 'Suspense'], ['mine', 'Minhas imagens']];
  let manifest = null;
  let filter = 'all';

  const im = () => {
    const p = App.project;
    if (!p.immersion) p.immersion = {};
    const x = p.immersion;
    const def = { mode: 'off', single: null, height: 36, fade: true, numberedOnly: false };
    Object.keys(def).forEach(k => { if (x[k] === undefined) x[k] = def[k]; });
    x.lib = x.lib || {}; x.uploads = x.uploads || []; x.groups = x.groups || {}; x.pool = x.pool || []; x.assign = x.assign || {};
    return x;
  };
  async function loadManifest() {
    if (manifest) return manifest;
    try { manifest = await (await fetch('app://local/assets/immersion/manifest.json')).json(); } catch (e) { manifest = []; }
    return manifest;
  }
  // imagem da galeria -> imagem do projeto (copiada para dentro do livro, que continua portátil)
  async function assetOf(item) {
    const x = im();
    if (x.lib[item.id] && App.project.assets[x.lib[item.id]]) return x.lib[item.id];
    const id = await App.addAssetFromUrl('app://local/assets/' + item.file, { name: 'Imersão — ' + item.name });
    x.lib[item.id] = id;
    return id;
  }
  const chaptersFor = () => App.project.chapters.filter(c => !im().numberedOnly || c.numbered);

  // sorteio: todas diferentes se houver imagens para todos; senão, rodadas embaralhadas sem repetir em seguida
  function distribute(n, pool) {
    const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    if (!pool.length) return [];
    if (pool.length >= n) return shuffle(pool).slice(0, n);
    const out = [];
    while (out.length < n) {
      const round = shuffle(pool);
      if (out.length && round.length > 1 && round[0] === out[out.length - 1]) { const k = 1 + Math.floor(Math.random() * (round.length - 1)); [round[0], round[k]] = [round[k], round[0]]; }
      out.push(...round);
    }
    return out.slice(0, n);
  }
  function randomize() {
    const x = im();
    const pool = x.pool.filter(id => App.project.assets[id]);
    if (!pool.length) return App.toast('Selecione (ou envie) as imagens que entram no sorteio.');
    const chs = chaptersFor();
    const list = distribute(chs.length, pool);
    x.assign = {};
    chs.forEach((c, i) => { x.assign[c.id] = list[i]; });
    x.mode = 'random';
    App.changed(`Imersão sorteada: ${pool.length} imagem(ns) em ${chs.length} capítulo(s)`);
    render();
  }

  const CATS = GROUPS.filter(([k]) => k !== 'all' && k !== 'mine');
  const catName = k => (CATS.find(c => c[0] === k) || [k, 'Sem categoria'])[1].split(' · ')[0];

  // envio do computador (botão ou arrastar para a galeria / para uma aba): pergunta a categoria de cada imagem
  async function upload(preset) {
    const l = await api.pickImages({ title: 'Imagens para a abertura dos capítulos (horizontais, de preferência)', multiple: true });
    if (l && l.length) await addUploads(l, preset);
  }
  async function addUploads(l, preset) {
    const x = im();
    const ids = [];
    for (const a of l) { const id = await App.addAsset(a); ids.push(id); if (!x.uploads.includes(id)) x.uploads.push(id); if (!x.pool.includes(id)) x.pool.push(id); }
    if (!ids.length) return;
    if (x.mode === 'single' || x.mode === 'off') { x.single = ids[ids.length - 1]; if (x.mode === 'off') x.mode = 'single'; }
    const def = preset || (CATS.some(c => c[0] === filter) ? filter : '');
    ids.forEach(id => { if (def) x.groups[id] = def; });
    App.changed(`${ids.length} imagem(ns) de imersão enviada(s)`);
    catalog(ids, def);
  }
  // diálogo de catalogação: uma linha por imagem, com as categorias do sistema em botões
  function catalog(ids, def) {
    const x = im();
    const rows = [];
    const chips = (cur, onPick) => el('div', { class: 'im-chips' }, CATS.concat([['', 'Sem categoria']]).map(([k]) => el('button', {
      class: 'im-chip' + (cur() === k ? ' on' : ''), 'data-k': k, text: k ? catName(k) : 'Sem categoria',
      onclick: e => { onPick(k); e.currentTarget.parentNode.querySelectorAll('.im-chip').forEach(b => b.classList.toggle('on', b.dataset.k === k)); }
    })));
    const setAll = k => { ids.forEach(id => { if (k) x.groups[id] = k; else delete x.groups[id]; }); rows.forEach(r => r.querySelectorAll('.im-chip').forEach(b => b.classList.toggle('on', b.dataset.k === k))); };
    ids.forEach(id => rows.push(el('div', { class: 'im-catrow' }, [
      el('img', { src: App.assetUrl(id) }),
      el('div', {}, [el('b', { class: 'small', text: App.project.assets[id].name || 'Imagem' }), chips(() => x.groups[id] || '', k => { if (k) x.groups[id] = k; else delete x.groups[id]; })])
    ])));
    App.modal({
      title: 'Catalogar imagens enviadas',
      wide: true,
      body: el('div', {}, [
        el('p', { class: 'muted small', text: 'Escolha a categoria de cada imagem — ela passa a aparecer na aba da categoria (e em “Minhas imagens”). Dá para mudar depois, no seletor abaixo de cada imagem.' }),
        ids.length > 1 ? el('div', { class: 'im-catall' }, [el('span', { class: 'flabel', text: 'Todas de uma vez' }), chips(() => (ids.every(id => x.groups[id] === x.groups[ids[0]]) ? x.groups[ids[0]] || '' : null), setAll)]) : null,
        el('div', { class: 'im-catlist' }, rows)
      ]),
      buttons: [{ label: 'Concluir', primary: true }],
      onClose: () => {
        const gs = [...new Set(ids.map(id => x.groups[id] || ''))];
        filter = gs.length === 1 && gs[0] ? gs[0] : 'mine';
        App.changed(null, { preview: false });
        render();
      }
    });
  }
  async function dropUpload(e, preset) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('over');
    const paths = Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f)).filter(p => /\.(png|jpe?g|gif|webp|bmp)$/i.test(p));
    if (!paths.length) return App.toast('Arraste arquivos de imagem (JPG, PNG, WEBP…).');
    await addUploads(await api.imagesFromPaths(paths), preset);
  }
  const dropZone = (node, preset) => {
    node.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); node.classList.add('over'); } });
    node.addEventListener('dragleave', () => node.classList.remove('over'));
    node.addEventListener('drop', e => dropUpload(e, preset));
    return node;
  };

  async function onTile(item, assetId) {
    const x = im();
    const id = assetId || await assetOf(item);
    if (x.mode === 'random') {
      const k = x.pool.indexOf(id);
      if (k >= 0) x.pool.splice(k, 1); else x.pool.push(id);
      App.changed(null, { preview: false });
    } else {
      x.mode = 'single';
      x.single = id;
      App.changed('Imersão: mesma imagem em todos os capítulos');
    }
    render();
  }

  async function render() {
    const v = $('#view-immersion');
    if (!v) return;
    const items = await loadManifest();
    const x = im();
    const chs = chaptersFor();
    const pool = x.pool.filter(id => App.project.assets[id]);
    const random = x.mode === 'random';
    const tile = (src, title, id, item) => {
      const on = random ? pool.includes(id) : (x.mode === 'single' && x.single === id);
      // imagens enviadas: seletor de categoria logo abaixo (não dispara a escolha da imagem)
      const cat = item ? null : el('select', { class: 'im-cat', title: 'Categoria desta imagem', onclick: e => e.stopPropagation(), onchange: e => { if (e.target.value) x.groups[id] = e.target.value; else delete x.groups[id]; App.changed(`Imagem catalogada em “${catName(e.target.value)}”`, { preview: false }); render(); } },
        CATS.concat([['', 'Sem categoria']]).map(([k]) => el('option', { value: k, text: k ? catName(k) : 'Sem categoria', selected: (x.groups[id] || '') === k })));
      return el('div', { class: 'im-tile' + (on ? ' on' : ''), role: 'button', tabindex: 0, title, onclick: () => onTile(item, id) }, [
        el('img', { src, loading: 'lazy' }),
        el('span', { class: 'im-name', text: title }),
        cat,
        on ? el('span', { class: 'im-check', text: random ? '✓' : '●' }) : null
      ]);
    };
    const tiles = [];
    const ups = x.uploads.filter(id => App.project.assets[id]);
    if (filter !== 'mine') items.filter(it => filter === 'all' || it.group === filter).forEach(it => tiles.push(tile('app://local/assets/' + it.file, it.name, x.lib[it.id] && App.project.assets[x.lib[it.id]] ? x.lib[it.id] : null, it)));
    ups.filter(id => filter === 'mine' || filter === 'all' || x.groups[id] === filter).forEach(id => tiles.push(tile(App.assetUrl(id), App.project.assets[id].name, id, null)));
    const count = k => k === 'all' ? items.length + ups.length : k === 'mine' ? ups.length : items.filter(it => it.group === k).length + ups.filter(id => x.groups[id] === k).length;
    const loose = ups.filter(id => !x.groups[id]);
    const need = Math.max(0, chs.length - pool.length);
    const h = el('input', { type: 'range', min: 15, max: 60, step: 1, value: x.height || 36 });
    const hOut = el('span', { class: 'val', text: (x.height || 36) + '%' });
    h.addEventListener('input', () => { hOut.textContent = h.value + '%'; });
    h.addEventListener('change', () => { x.height = Number(h.value); App.changed('Altura da imersão'); });
    const fade = el('input', { type: 'checkbox', checked: x.fade !== false });
    fade.addEventListener('change', () => { x.fade = fade.checked; App.changed('Imersão: transição para a página'); });
    const numbered = el('input', { type: 'checkbox', checked: !!x.numberedOnly });
    numbered.addEventListener('change', () => { x.numberedOnly = numbered.checked; App.changed('Imersão: capítulos'); render(); });
    v.innerHTML = '';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Imersão' }),
      el('p', { class: 'muted', text: 'Imagens acima do título de cada capítulo, ocupando o alto da página até além do corte. Escolha uma imagem para todos os capítulos, ou várias para sortear uma por capítulo.' }),
      el('div', { class: 'card' }, [
        el('div', { class: 'im-modes' }, [
          el('button', { class: 'im-mode' + (x.mode === 'single' ? ' on' : ''), onclick: () => { x.mode = 'single'; if (!x.single && pool[0]) x.single = pool[0]; App.changed('Imersão: mesma imagem'); render(); } }, [el('b', { text: 'Mesma imagem' }), el('span', { text: 'em todos os capítulos' })]),
          el('button', { class: 'im-mode' + (random ? ' on' : ''), onclick: () => { x.mode = 'random'; if (x.single && !x.pool.includes(x.single)) x.pool.push(x.single); App.changed(null, { preview: false }); render(); } }, [el('b', { text: 'Aleatório' }), el('span', { text: 'uma imagem por capítulo' })]),
          el('button', { class: 'im-mode' + (x.mode === 'off' ? ' on' : ''), onclick: () => { x.mode = 'off'; App.changed('Imersão desligada'); render(); } }, [el('b', { text: 'Sem imersão' }), el('span', { text: 'títulos sem imagem' })])
        ]),
        random ? el('div', { class: 'im-random' }, [
          el('p', { class: need ? 'warn' : 'good', text: `${chs.length} capítulo(s) · ${pool.length} imagem(ns) selecionada(s) — ` + (need ? `faltam ${need} para cobrir todos sem repetir; com as atuais, as imagens se alternam sem repetir uma logo após a outra.` : 'cobrem todos os capítulos sem repetir.') }),
          el('button', { class: 'primary', text: '🎲 Randomizar', onclick: randomize, disabled: !pool.length })
        ]) : null,
        el('div', { class: 'inline wrap im-opts' }, [
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Altura (% da página)' }), el('div', { class: 'slider' }, [h, hOut])]),
          el('label', { class: 'chk' }, [fade, ' Transição suave para a página']),
          el('label', { class: 'chk' }, [numbered, ' Só capítulos numerados'])
        ])
      ]),
      el('div', { class: 'im-tabs' }, GROUPS.map(([k, label]) => {
        const b = el('button', { class: 'im-tab' + (filter === k ? ' on' : ''), title: CATS.some(c => c[0] === k) ? `Arraste imagens para esta aba para catalogá-las em “${catName(k)}”` : '', onclick: () => { filter = k; render(); } }, [label + ' ', el('span', { class: 'im-count', text: String(count(k)) })]);
        return CATS.some(c => c[0] === k) ? dropZone(b, k) : dropZone(b, '');
      }).concat([el('button', { class: 'im-upload', text: CATS.some(c => c[0] === filter) ? `＋ Enviar para “${catName(filter)}”` : '＋ Enviar do computador', onclick: () => upload() })])),
      loose.length ? el('div', { class: 'im-loose' }, [el('span', { text: `${loose.length} imagem(ns) enviada(s) sem categoria.` }), el('button', { text: 'Catalogar agora', onclick: () => catalog(loose, '') })]) : null,
      el('p', { class: 'small muted', text: random ? 'Clique nas imagens para incluir ou tirar do sorteio; depois, “Randomizar”.' : 'Clique numa imagem para aplicá-la acima do título de todos os capítulos.' }),
      dropZone(el('div', { class: 'im-grid' }, tiles.length ? tiles : [el('p', { class: 'muted small', text: 'Nenhuma imagem nesta categoria ainda — envie do computador ou arraste arquivos para cá.' })]), ''),
      framesCard(),
      random && Object.keys(x.assign).length ? el('div', { class: 'card' }, [
        el('h3', { text: 'Distribuição atual' }),
        el('div', { class: 'im-assign' }, chs.map((c, i) => { const id = x.assign[c.id] || pool[i % (pool.length || 1)]; return el('div', { class: 'im-as' }, [id && App.project.assets[id] ? el('img', { src: App.assetUrl(id) }) : el('span', { class: 'muted', text: '—' }), el('span', { text: `${i + 1}. ${c.title || 'Sem título'}` })]); }))
      ]) : null
    ]));
  }

  // ---------------------------------------------------------------- molduras
  let frTab = 'classica';
  const frames = () => { const p = App.project; p.frames = p.frames || {}; p.frames.uploads = p.frames.uploads || []; if (p.frames.all === undefined) p.frames.all = ''; return p.frames; };
  const frName = id => /^up:/.test(id) ? ((App.project.assets[id.slice(3)] || {}).name || 'Minha moldura') : ((PageFrames.FRAMES[id] || {}).name || id);
  // faixa desenhada de uma moldura enviada (fração da página em cada lado), medida na própria imagem:
  // do lado de fora para dentro, até onde ainda há traço; o texto fica além disso (+ folga)
  async function measureFrame(dataUrl) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const paper = px(Math.floor(W / 2), Math.floor(H / 2));
    const ink = (x, y) => { const p = px(x, y); if (p[3] < 40) return false; if (paper[3] < 40) return true; return Math.abs(p[0] - paper[0]) + Math.abs(p[1] - paper[1]) + Math.abs(p[2] - paper[2]) > 60; };
    const scan = (n, len, at) => { let worst = 0; for (let j = Math.floor(n * 0.15); j < n * 0.85; j += Math.max(1, Math.floor(n / 60))) { let last = 0; for (let i = 0; i < len * 0.42; i++) if (at(j, i)) last = i + 1; worst = Math.max(worst, last); } return Math.min(0.32, worst / len); };
    return {
      left: scan(H, W, (y, i) => ink(i, y)), right: scan(H, W, (y, i) => ink(W - 1 - i, y)),
      top: scan(W, H, (x, i) => ink(x, i)), bottom: scan(W, H, (x, i) => ink(x, H - 1 - i)),
      ratio: img.naturalWidth / img.naturalHeight
    };
  }
  async function uploadFrame() {
    const l = await api.pickImages({ title: 'Moldura (PNG com fundo transparente ou JPG com o centro em branco)', multiple: true });
    if (!l || !l.length) return;
    const fr = frames();
    const st = App.project.settings;
    for (const a of l) {
      const id = await App.addAsset(Object.assign(a, { kind: 'moldura' }));
      const asset = App.project.assets[id];
      try { const m = await measureFrame(asset.dataUrl); asset.frameInset = { top: m.top, right: m.right, bottom: m.bottom, left: m.left }; asset.frameRatio = m.ratio; } catch (e) { asset.frameInset = { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 }; }
      if (!fr.uploads.includes(id)) fr.uploads.push(id);
      const want = st.pageWidth / st.pageHeight;
      if (asset.frameRatio && Math.abs(asset.frameRatio - want) / want > 0.04) App.toast(`“${asset.name}” tem proporção diferente da página (${st.pageWidth} × ${st.pageHeight} mm): ela será esticada para caber.`, 5000);
    }
    frTab = 'mine';
    App.changed(`${l.length} moldura(s) enviada(s)`, { preview: false });
    render();
  }
  function framesCard() {
    if (!window.PageFrames) return null;
    const fr = frames();
    const cur = App.chapter();
    const st = App.project.settings;
    const usedBy = id => App.project.chapters.filter(c => c.frame === id).length;
    const apply = (id, all) => {
      const list = all ? App.project.chapters : (cur ? [cur] : []);
      if (!list.length) return App.toast('Abra um capítulo (lista à esquerda) para aplicar só nele.');
      list.forEach(c => { if (!c.locked) c.frame = id; });
      App.changed(id ? `Moldura “${frName(id)}” ${all ? 'em todos os capítulos' : 'em “' + cur.title + '”'}` : 'Moldura removida');
      render();
    };
    const applyAllPages = id => {
      fr.all = id;
      // a moldura de todas as páginas vale também nos capítulos (sem moldura própria diferente)
      App.changed(id ? `Moldura “${frName(id)}” em todas as páginas` : 'Moldura removida de todas as páginas');
      render();
    };
    const prev = id => /^up:/.test(id) ? App.assetUrl(id.slice(3)) : 'data:image/svg+xml;utf8,' + encodeURIComponent(PageFrames.svg(id, 100, 150, PageFrames.FRAMES[id].wide ? 10 : 7).replace('<svg ', '<svg style="background:#fff" '));
    const ids = frTab === 'mine' ? fr.uploads.filter(a => App.project.assets[a]).map(a => 'up:' + a) : PageFrames.list().filter(x => x.cat === frTab).map(x => x.id);
    const pxW = Math.round(st.pageWidth / 25.4 * 300), pxH = Math.round(st.pageHeight / 25.4 * 300);
    const tile = id => el('div', { class: 'fr-tile' + ((cur && cur.frame === id) || fr.all === id ? ' on' : '') }, [
      el('img', { src: prev(id), alt: frName(id) }),
      el('b', { text: frName(id) }),
      el('span', { class: 'small muted', text: [fr.all === id ? 'todas as páginas' : '', usedBy(id) ? `em ${usedBy(id)} capítulo(s)` : ''].filter(Boolean).join(' · ') || ' ' }),
      el('div', { class: 'fr-btns' }, [
        el('button', { class: 'primary', text: 'Aplicar à página', title: 'Aplica nas páginas do capítulo aberto', onclick: () => apply(id, false) }),
        el('button', { text: 'Em todos os capítulos', title: 'Aplica nas páginas de todos os capítulos', onclick: () => apply(id, true) }),
        el('button', { class: 'fr-allpages', text: 'Todas as páginas', title: 'Aplica em todas as páginas do livro, inclusive nas aberturas de capítulo (menos nas que têm imagem de imersão)', onclick: () => applyAllPages(id) }),
        /^up:/.test(id) ? el('button', { class: 'ghost small', text: 'Excluir', onclick: () => {
          fr.uploads = fr.uploads.filter(a => 'up:' + a !== id);
          if (fr.all === id) fr.all = '';
          App.project.chapters.forEach(c => { if (c.frame === id) c.frame = ''; });
          App.changed('Moldura excluída'); render();
        } }) : null
      ])
    ]);
    const tabs = PageFrames.CATS.concat([['mine', 'Minhas molduras']]);
    return el('div', { class: 'card' }, [
      el('h3', { text: 'Molduras' }),
      el('p', { class: 'small muted', text: 'Em preto e branco, na margem, em volta do texto (com folga): o texto continua no centro. “Aplicar à página” vale para as páginas do capítulo aberto' + (cur ? ` (“${cur.title}”)` : '') + '; “Todas as páginas” vale para o livro inteiro, inclusive nas aberturas de capítulo — menos nas que têm imagem de imersão.' }),
      fr.all ? el('div', { class: 'fr-status' }, [el('span', { text: `Todas as páginas: “${frName(fr.all)}”` }), el('button', { text: 'Tirar de todas as páginas', onclick: () => applyAllPages('') })]) : null,
      el('div', { class: 'im-tabs' }, tabs.map(([k, label]) => el('button', { class: 'im-tab' + (frTab === k ? ' on' : ''), onclick: () => { frTab = k; render(); } }, [label + ' ', el('span', { class: 'im-count', text: String(k === 'mine' ? fr.uploads.filter(a => App.project.assets[a]).length : PageFrames.list().filter(x => x.cat === k).length) })]))
        .concat([el('button', { class: 'im-upload', text: '＋ Enviar minha moldura', onclick: uploadFrame })])),
      frTab === 'mine' ? el('div', { class: 'fr-help' }, [
        el('b', { text: 'Tamanho da moldura: ' }),
        `${st.pageWidth} × ${st.pageHeight} mm (o tamanho da página deste livro) — ${pxW} × ${pxH} px a 300 dpi. `,
        'PNG com fundo transparente ou JPG com o centro em branco. A imagem vai para o fundo da página, o texto fica por cima, e as margens se afastam sozinhas da faixa desenhada (medida na imagem), para o texto não encostar nas bordas da moldura.'
      ]) : null,
      ids.length ? el('div', { class: 'fr-grid' }, ids.map(tile)) : el('p', { class: 'muted small', text: 'Nenhuma moldura enviada ainda.' }),
      App.project.chapters.some(c => c.frame) || fr.all ? el('div', { class: 'inline wrap' }, [
        el('button', { text: 'Remover do capítulo aberto', onclick: () => apply('', false) }),
        el('button', { class: 'danger', text: 'Remover de tudo', onclick: () => { fr.all = ''; apply('', true); } })
      ]) : null
    ]);
  }

  App.hooks.viewRender.immersion = render;
  App.immersion = { render, distribute, randomize, addUploads, catalog, measureFrame };
})();
