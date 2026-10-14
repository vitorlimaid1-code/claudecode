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
    x.lib = x.lib || {}; x.uploads = x.uploads || []; x.pool = x.pool || []; x.assign = x.assign || {};
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

  async function upload() {
    const l = await api.pickImages({ title: 'Imagens para a abertura dos capítulos (horizontais, de preferência)', multiple: true });
    if (!l || !l.length) return;
    const x = im();
    for (const a of l) { const id = await App.addAsset(a); if (!x.uploads.includes(id)) x.uploads.push(id); if (!x.pool.includes(id)) x.pool.push(id); }
    if (x.mode === 'single' || x.mode === 'off') { x.single = x.uploads[x.uploads.length - 1]; if (x.mode === 'off') x.mode = 'single'; }
    filter = 'mine';
    App.changed(`${l.length} imagem(ns) de imersão enviada(s)`);
    render();
  }

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
      return el('button', { class: 'im-tile' + (on ? ' on' : ''), title, onclick: () => onTile(item, id) }, [
        el('img', { src, loading: 'lazy' }),
        el('span', { class: 'im-name', text: title }),
        on ? el('span', { class: 'im-check', text: random ? '✓' : '●' }) : null
      ]);
    };
    const tiles = [];
    if (filter !== 'mine') items.filter(it => filter === 'all' || it.group === filter).forEach(it => tiles.push(tile('app://local/assets/' + it.file, it.name, x.lib[it.id] && App.project.assets[x.lib[it.id]] ? x.lib[it.id] : null, it)));
    if (filter === 'mine' || filter === 'all') x.uploads.filter(id => App.project.assets[id]).forEach(id => tiles.push(tile(App.assetUrl(id), App.project.assets[id].name, id, null)));
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
      el('div', { class: 'im-tabs' }, GROUPS.map(([k, label]) => el('button', { class: 'im-tab' + (filter === k ? ' on' : ''), text: label, onclick: () => { filter = k; render(); } }))
        .concat([el('button', { class: 'im-upload', text: '＋ Enviar do computador', onclick: upload })])),
      el('p', { class: 'small muted', text: random ? 'Clique nas imagens para incluir ou tirar do sorteio; depois, “Randomizar”.' : 'Clique numa imagem para aplicá-la acima do título de todos os capítulos.' }),
      el('div', { class: 'im-grid' }, tiles),
      random && Object.keys(x.assign).length ? el('div', { class: 'card' }, [
        el('h3', { text: 'Distribuição atual' }),
        el('div', { class: 'im-assign' }, chs.map((c, i) => { const id = x.assign[c.id] || pool[i % (pool.length || 1)]; return el('div', { class: 'im-as' }, [id && App.project.assets[id] ? el('img', { src: App.assetUrl(id) }) : el('span', { class: 'muted', text: '—' }), el('span', { text: `${i + 1}. ${c.title || 'Sem título'}` })]); }))
      ]) : null
    ]));
  }

  App.hooks.viewRender.immersion = render;
  App.immersion = { render, distribute, randomize };
})();
