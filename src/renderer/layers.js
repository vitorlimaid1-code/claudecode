/* global App */
// Camadas da página: elementos fixados em posições exatas (mm) — imagens, formas, molduras,
// fundos, caixas e textos decorativos — com painel de camadas, grupos, alinhar e distribuir.
(function () {
  const { el, $, api, D } = App;
  const sel = new Set();
  let clipboard = null;

  const ov = () => App.project.overlays || (App.project.overlays = []);
  const byId = id => ov().find(o => o.id === id);
  const pageW = () => App.project.settings.pageWidth;
  const pageH = () => App.project.settings.pageHeight;
  const bleed = () => Math.max(App.project.settings.bleedTop || 0, App.project.settings.bleedBottom || 0, App.project.settings.bleedOuter || 0);
  const r2 = v => Math.round(v * 100) / 100;

  function resolved() {
    return ov().map(o => Object.assign({}, o, o.asset && App.project.assets[o.asset] ? { src: App.assetUrl(o.asset) } : {}));
  }
  function refreshPreview() {
    App.preview.updateOverlays(resolved());
    App.preview.highlightLayers([...sel]);
  }
  function changed(label) {
    App.changed(null, { preview: false });
    refreshPreview();
    clearTimeout(changed._t);
    changed._t = setTimeout(() => App.commit(label || 'Camadas'), 500);
    if (App.view === 'layers') render();
  }

  function create(type, extra) {
    const page = String(App.preview.currentPage || 1);
    const base = {
      id: D.uid('ov'), type, pages: page, name: ({ image: 'Imagem', rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha', text: 'Texto', box: 'Caixa de destaque' })[type] || type,
      x: 20, y: 30, w: 60, h: 40, rot: 0, opacity: 100, z: ov().length, behind: false, hidden: false, locked: false,
      fill: type === 'rect' || type === 'ellipse' ? '#e8e2d6' : type === 'box' ? '#f2efe9' : 'transparent',
      stroke: '#000000', strokeWidth: type === 'line' ? 0.75 : type === 'box' ? 0.6 : 0, radius: 0,
      text: type === 'text' || type === 'box' ? 'Texto decorativo' : '', font: App.project.settings.styles.body.font, size: 14, color: '#000000', align: 'center', fit: 'contain'
    };
    const o = Object.assign(base, extra || {});
    ov().push(o);
    sel.clear();
    sel.add(o.id);
    changed('Nova camada: ' + o.name);
    return o;
  }

  async function addImage(assetId, page, x, y) {
    const a = App.project.assets[assetId];
    const w = 50;
    const h = a && a.width ? w * a.height / a.width : 40;
    return create('image', { asset: assetId, name: a ? a.name : 'Imagem', pages: String(page || App.preview.currentPage || 1), x: r2((x == null ? (pageW() - w) / 2 : x - w / 2)), y: r2(y == null ? (pageH() - h) / 2 : y - h / 2), w, h: r2(h) });
  }

  function margins(page) {
    const s = App.project.settings;
    const left = page % 2 === 0; // página par = esquerda
    return { top: s.marginTop, bottom: pageH() - s.marginBottom, left: left ? s.marginOuter : s.marginInner, right: pageW() - (left ? s.marginInner : s.marginOuter) };
  }

  // ---------------------------------------------------------------- operações de seleção
  function selected() { return [...sel].map(byId).filter(Boolean); }
  function withGroups(list) {
    const groups = new Set(list.map(o => o.group).filter(Boolean));
    return ov().filter(o => list.includes(o) || (o.group && groups.has(o.group)));
  }

  function align(how, ref) {
    const items = selected().filter(o => !o.locked);
    if (!items.length) return;
    let box;
    const page = Number(String(items[0].pages).split(/[,-]/)[0]) || 1;
    if (ref === 'page') box = { left: 0, top: 0, right: pageW(), bottom: pageH() };
    else if (ref === 'margins') box = margins(page);
    else box = { left: Math.min(...items.map(o => o.x)), top: Math.min(...items.map(o => o.y)), right: Math.max(...items.map(o => o.x + o.w)), bottom: Math.max(...items.map(o => o.y + o.h)) };
    items.forEach(o => {
      if (how === 'left') o.x = box.left;
      if (how === 'right') o.x = box.right - o.w;
      if (how === 'hcenter') o.x = (box.left + box.right) / 2 - o.w / 2;
      if (how === 'top') o.y = box.top;
      if (how === 'bottom') o.y = box.bottom - o.h;
      if (how === 'vcenter') o.y = (box.top + box.bottom) / 2 - o.h / 2;
      o.x = r2(o.x); o.y = r2(o.y);
    });
    changed('Alinhar camadas');
  }

  function distribute(axis) {
    const items = selected().filter(o => !o.locked);
    if (items.length < 3) return App.toast('Selecione ao menos 3 elementos para distribuir.');
    const k = axis === 'h' ? 'x' : 'y';
    const sz = axis === 'h' ? 'w' : 'h';
    items.sort((a, b) => a[k] - b[k]);
    const first = items[0][k];
    const last = items[items.length - 1][k] + items[items.length - 1][sz];
    const total = items.reduce((s, o) => s + o[sz], 0);
    const gap = (last - first - total) / (items.length - 1);
    let pos = first;
    items.forEach(o => { o[k] = r2(pos); pos += o[sz] + gap; });
    changed('Distribuir camadas');
  }

  function sameSize(dim) {
    const items = selected().filter(o => !o.locked);
    if (items.length < 2) return;
    items.forEach(o => { if (dim !== 'h') o.w = items[0].w; if (dim !== 'w') o.h = items[0].h; });
    changed('Mesmo tamanho');
  }

  function group() {
    const items = selected();
    if (items.length < 2) return App.toast('Selecione dois ou mais elementos para agrupar.');
    const g = D.uid('g');
    items.forEach(o => { o.group = g; });
    changed('Agrupar camadas');
  }
  function ungroup() { selected().forEach(o => { delete o.group; }); changed('Desagrupar camadas'); }

  function duplicate() {
    const items = selected();
    if (!items.length) return;
    sel.clear();
    const gmap = {};
    items.forEach(o => {
      const c = JSON.parse(JSON.stringify(o));
      c.id = D.uid('ov'); c.x = r2(c.x + 5); c.y = r2(c.y + 5); c.name += ' (cópia)'; c.z = ov().length; c.locked = false;
      if (c.group) c.group = gmap[c.group] || (gmap[c.group] = D.uid('g'));
      ov().push(c);
      sel.add(c.id);
    });
    changed('Duplicar camadas');
  }

  async function remove() {
    const items = selected();
    if (!items.length) return;
    const locked = items.filter(o => o.locked);
    const ok = items.filter(o => !o.locked);
    if (!ok.length) return App.toast('Elementos bloqueados não podem ser excluídos.');
    if (ok.length > 1) { const c = await App.confirmPreview('Excluir camadas', `Excluir ${ok.length} elemento(s)?` + (locked.length ? ` (${locked.length} bloqueado(s) mantidos)` : ''), ok.map(o => o.name), 'Excluir'); if (!c) return; }
    App.project.overlays = ov().filter(o => !ok.includes(o));
    sel.clear();
    changed('Excluir camadas');
  }

  function zorder(dir) {
    const list = ov().slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    const items = selected();
    items.forEach(o => {
      const i = list.indexOf(o);
      list.splice(i, 1);
      if (dir === 'front') list.push(o); else if (dir === 'back') list.unshift(o);
      else list.splice(Math.max(0, Math.min(list.length, i + (dir === 'up' ? 1 : -1))), 0, o);
    });
    list.forEach((o, i) => { o.z = i; });
    changed('Ordem das camadas');
  }

  // Move a seleção (e grupos) — usado pelo arraste na prévia e pelas setas
  function moveBy(dx, dy, ids) {
    const items = withGroups((ids || [...sel]).map(byId).filter(Boolean)).filter(o => !o.locked);
    items.forEach(o => { o.x = r2(o.x + dx); o.y = r2(o.y + dy); });
    return items;
  }

  // Pontos de encaixe (mm) para uma página
  function snapTargets(page, exclude) {
    const m = margins(page);
    const xs = [0, pageW(), pageW() / 2, m.left, m.right, -bleed(), pageW() + bleed()];
    const ys = [0, pageH(), pageH() / 2, m.top, m.bottom, -bleed(), pageH() + bleed()];
    ov().forEach(o => {
      if (exclude.includes(o.id) || o.hidden) return;
      xs.push(o.x, o.x + o.w, o.x + o.w / 2);
      ys.push(o.y, o.y + o.h, o.y + o.h / 2);
    });
    return { xs, ys };
  }

  // ---------------------------------------------------------------- composição em grade
  async function gridDialog() {
    const layout = el('select', {}, [['2c', '2 colunas'], ['3c', '3 colunas'], ['2x2', 'Grade 2 × 2'], ['3x2', 'Grade 3 × 2'], ['1+2', 'Mosaico: 1 grande + 2'], ['2r', '2 linhas']].map(([v, l]) => el('option', { value: v, text: l })));
    const page = el('input', { type: 'number', min: 1, value: App.preview.currentPage || 1 });
    const gap = el('input', { type: 'number', min: 0, max: 20, step: 0.5, value: 4 });
    const area = el('select', {}, [['margins', 'Dentro das margens'], ['page', 'Página inteira'], ['bleed', 'Até a sangria']].map(([v, l]) => el('option', { value: v, text: l })));
    const caps = el('input', { type: 'checkbox' });
    App.modal({
      title: 'Composição de imagens na página',
      body: el('div', { class: 'grid' }, [App.field('Modelo', layout), App.field('Página', page), App.field('Espaço entre imagens (mm)', gap), App.field('Área', area), App.field('Legendas alinhadas abaixo', caps)]),
      buttons: [{ label: 'Cancelar' }, { label: 'Escolher imagens…', primary: true, onClick: async () => {
        const list = await api.pickImages({ multiple: true, title: 'Imagens da composição (na ordem desejada)' });
        if (!list || !list.length) return;
        const ids = [];
        for (const a of list) ids.push(await App.addAsset(a));
        const pg = Number(page.value) || 1;
        const g = Number(gap.value) || 0;
        const m = margins(pg);
        const b = bleed();
        const box = area.value === 'page' ? { left: 0, top: 0, right: pageW(), bottom: pageH() } : area.value === 'bleed' ? { left: -b, top: -b, right: pageW() + b, bottom: pageH() + b } : m;
        const W = box.right - box.left;
        const capH = caps.checked ? 7 : 0;
        const H = box.bottom - box.top;
        const cells = [];
        const cols = { '2c': [2, 1], '3c': [3, 1], '2x2': [2, 2], '3x2': [3, 2], '2r': [1, 2] }[layout.value];
        if (cols) {
          const [c, r] = cols;
          const cw = (W - g * (c - 1)) / c;
          const ch = (H - g * (r - 1)) / r - capH;
          for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) cells.push({ x: box.left + i * (cw + g), y: box.top + j * (ch + capH + g), w: cw, h: ch });
        } else {
          const bigH = (H - g) * 0.6 - capH;
          const smallH = (H - g) * 0.4 - capH;
          const sw = (W - g) / 2;
          cells.push({ x: box.left, y: box.top, w: W, h: bigH });
          cells.push({ x: box.left, y: box.top + bigH + capH + g, w: sw, h: smallH });
          cells.push({ x: box.left + sw + g, y: box.top + bigH + capH + g, w: sw, h: smallH });
        }
        const grp = D.uid('g');
        sel.clear();
        ids.slice(0, cells.length).forEach((id, i) => {
          const c = cells[i];
          const o = { id: D.uid('ov'), type: 'image', asset: id, name: App.project.assets[id].name, pages: String(pg), x: r2(c.x), y: r2(c.y), w: r2(c.w), h: r2(c.h), rot: 0, opacity: 100, z: ov().length, fit: 'cover', group: grp, behind: false, hidden: false, locked: false };
          ov().push(o);
          sel.add(o.id);
          if (caps.checked) ov().push({ id: D.uid('ov'), type: 'text', name: 'Legenda ' + (i + 1), pages: String(pg), x: r2(c.x), y: r2(c.y + c.h + 1), w: r2(c.w), h: 5, rot: 0, opacity: 100, z: ov().length, text: 'Legenda', font: App.project.settings.styles.caption.font || App.project.settings.styles.body.font, size: 8.5, color: '#333333', align: 'center', group: grp });
        });
        if (ids.length > cells.length) App.toast(`O modelo comporta ${cells.length} imagens; ${ids.length - cells.length} ficaram de fora.`);
        changed('Composição de imagens');
      } }]
    });
  }

  // ---------------------------------------------------------------- painel
  function render() {
    const v = $('#view-layers');
    v.innerHTML = '';
    const items = ov().slice().sort((a, b) => (b.z || 0) - (a.z || 0));
    const s1 = selected();
    const add = (label, fn, title) => el('button', { text: label, title: title || '', onclick: fn });
    const cur = App.preview.currentPage || 1;
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Camadas da página' }),
      el('p', { class: 'muted', text: `Elementos fixos em posições exatas, independentes do fluxo do texto (o texto que acompanha parágrafos é inserido pelo editor). Clique numa página da prévia para escolhê-la — página atual: ${cur}. Arraste os elementos na prévia; eles se encaixam nas bordas, margens, centro e em outros elementos. Setas movem 0,5 mm (Shift: 5 mm).` }),
      el('div', { class: 'inline wrap' }, [
        add('🖼 Imagem…', async () => { const l = await api.pickImages({}); if (l) addImage(await App.addAsset(l[0])); }),
        add('📚 Da biblioteca…', async () => { const id = await App.library.pick('corpo'); if (id) addImage(id); }),
        add('▭ Retângulo', () => create('rect')),
        add('◯ Elipse', () => create('ellipse')),
        add('— Linha / filete', () => create('line', { h: 0, w: 60, y: pageH() / 2 })),
        add('T Texto', () => create('text', { h: 12 })),
        add('▤ Caixa de destaque', () => create('box', { h: 30 })),
        add('■ Fundo da página', () => { const b = bleed(); create('rect', { name: 'Fundo da página', x: -b, y: -b, w: pageW() + 2 * b, h: pageH() + 2 * b, behind: true, fill: '#f3ead8' }); }, 'Cor ou imagem de fundo só nesta página, atrás do texto, até a sangria'),
        add('▢ Moldura', () => { const m = margins(cur); create('rect', { name: 'Moldura', x: m.left - 4, y: m.top - 4, w: m.right - m.left + 8, h: m.bottom - m.top + 8, fill: 'transparent', strokeWidth: 0.75, behind: true }); }),
        add('▦ Composição em grade…', gridDialog)
      ]),
      s1.length ? el('div', { class: 'card' }, [
        el('h3', { text: s1.length === 1 ? 'Elemento selecionado' : `${s1.length} elementos selecionados` }),
        el('div', { class: 'inline wrap' }, [
          el('span', { class: 'muted small', text: 'Alinhar:' }),
          ...[['left', '⇤'], ['hcenter', '↔'], ['right', '⇥'], ['top', '⤒'], ['vcenter', '↕'], ['bottom', '⤓']].map(([k, t]) => el('button', { class: 'small-btn', text: t, title: 'Alinhar ' + k, onclick: () => align(k, refSel.value) })),
          (() => { const s = el('select', { id: 'alignRef' }, [['selection', 'à seleção'], ['margins', 'às margens'], ['page', 'à página']].map(([v2, l]) => el('option', { value: v2, text: l }))); return s; })(),
          el('button', { class: 'small-btn', text: 'Distribuir ↔', onclick: () => distribute('h') }),
          el('button', { class: 'small-btn', text: 'Distribuir ↕', onclick: () => distribute('v') }),
          el('button', { class: 'small-btn', text: 'Mesmo tamanho', onclick: () => sameSize() }),
          el('button', { class: 'small-btn', text: 'Agrupar', onclick: group }),
          el('button', { class: 'small-btn', text: 'Desagrupar', onclick: ungroup }),
          el('button', { class: 'small-btn', text: 'Duplicar', onclick: duplicate }),
          el('button', { class: 'small-btn', text: '⤒ Frente', onclick: () => zorder('front') }),
          el('button', { class: 'small-btn', text: '⤓ Trás', onclick: () => zorder('back') }),
          el('button', { class: 'small-btn danger', text: 'Excluir', onclick: remove })
        ]),
        s1.length === 1 ? props(s1[0]) : null
      ]) : null,
      el('table', { class: 'layers-table' }, [
        el('thead', {}, [el('tr', {}, ['', 'Nome', 'Tipo', 'Páginas', '', '', ''].map(t => el('th', { text: t })))]),
        el('tbody', {}, items.map(o => el('tr', { class: sel.has(o.id) ? 'sel' : '', onclick: e => { if (e.target.closest('button,input')) return; if (!(e.ctrlKey || e.metaKey || e.shiftKey)) sel.clear(); sel.has(o.id) ? sel.delete(o.id) : sel.add(o.id); refreshPreview(); render(); const p = Number(String(o.pages).split(/[,-]/)[0]); if (p) App.preview.goToPage(p); } }, [
          el('td', {}, [el('input', { type: 'checkbox', checked: sel.has(o.id), onchange: e => { e.target.checked ? sel.add(o.id) : sel.delete(o.id); refreshPreview(); render(); } })]),
          el('td', {}, [el('span', { text: o.name }), o.group ? el('span', { class: 'chip tiny', text: 'grupo' }) : null, o.behind ? el('span', { class: 'chip tiny', text: 'atrás' }) : null]),
          el('td', { class: 'muted small', text: o.type }),
          el('td', { class: 'small', text: o.pages }),
          el('td', {}, [el('button', { class: 'ghost small-btn', text: o.hidden ? '🚫' : '👁', title: o.hidden ? 'Mostrar' : 'Ocultar', onclick: () => { o.hidden = !o.hidden; changed(o.hidden ? 'Ocultar camada' : 'Mostrar camada'); } })]),
          el('td', {}, [el('button', { class: 'ghost small-btn', text: o.locked ? '🔒' : '🔓', title: o.locked ? 'Desbloquear' : 'Bloquear', onclick: () => { o.locked = !o.locked; changed(o.locked ? 'Bloquear camada' : 'Desbloquear camada'); } })]),
          el('td', {}, [el('button', { class: 'ghost small-btn', text: '✎', title: 'Renomear', onclick: async () => { const n = await App.prompt('Renomear', 'Nome', o.name); if (n) { o.name = n; changed('Renomear camada'); } } })])
        ])))
      ]),
      !items.length ? el('p', { class: 'muted', text: 'Nenhum elemento. Use os botões acima ou arraste imagens da biblioteca para uma página da prévia.' }) : null
    ]));
    const refSel = $('#alignRef') || { value: 'selection' };
  }

  function props(o) {
    const u = App.unitLabel();
    const num = (key, label, step, len) => {
      const show = v => (len ? +D.toUnit(Number(v) || 0, App.unit).toFixed(3) : v);
      const i = el('input', { type: 'number', step: step || (App.unit === 'mm' ? 0.1 : 0.01), value: show(o[key]), disabled: o.locked, oninput: e => { let v = parseFloat(e.target.value); if (!isFinite(v)) return; if (len) v = D.fromUnit(v, App.unit); o[key] = r2(v); App.changed(null, { preview: false }); refreshPreview(); clearTimeout(i._t); i._t = setTimeout(() => App.commit('Propriedades da camada'), 600); } });
      return App.field(label, i);
    };
    const txt = (key, label, multi) => { const i = multi ? el('textarea', { rows: 3 }) : el('input', { type: 'text' }); i.value = o[key] || ''; i.disabled = o.locked; i.addEventListener('input', () => { o[key] = i.value; App.changed(null, { preview: false }); refreshPreview(); clearTimeout(i._t); i._t = setTimeout(() => App.commit('Propriedades da camada'), 600); }); return App.field(label, i, '', multi ? 'wide' : ''); };
    const color = (key, label) => App.field(label, el('div', { class: 'inline' }, [
      el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(o[key] || '') ? o[key] : '#ffffff', disabled: o.locked, oninput: e => { o[key] = e.target.value; App.changed(null, { preview: false }); refreshPreview(); } , onchange: () => App.commit('Cor da camada') }),
      key === 'fill' ? el('button', { class: 'small-btn', text: 'Sem cor', onclick: () => { o.fill = 'transparent'; changed('Cor da camada'); } }) : null
    ]));
    const chk = (key, label) => el('label', { class: 'chk' }, [el('input', { type: 'checkbox', checked: !!o[key], disabled: o.locked && key !== 'locked', onchange: e => { o[key] = e.target.checked; changed('Propriedades da camada'); } }), ' ' + label]);
    const pagesI = el('input', { type: 'text', value: o.pages, disabled: o.locked, placeholder: '5 · 3-7 · todas · pares · ímpares' });
    pagesI.addEventListener('change', () => { o.pages = pagesI.value.trim() || '1'; changed('Páginas da camada'); });
    const fields = [
      txt('name', 'Nome'),
      App.field('Páginas', pagesI, 'ex.: 5 · 3-7 · 2,4 · todas · pares · ímpares'),
      num('x', `X (${u}) a partir da borda esquerda`, null, true), num('y', `Y (${u}) a partir do topo`, null, true),
      num('w', `Largura (${u})`, null, true), num('h', `Altura (${u})`, null, true),
      num('rot', 'Rotação (°)', 1), num('opacity', 'Opacidade (%)', 1),
      chk('behind', 'Atrás do texto'), chk('locked', 'Bloqueado')
    ];
    if (o.type === 'image') {
      const a = App.project.assets[o.asset];
      fields.push(App.field('Ajuste', (() => { const s = el('select', { disabled: o.locked, onchange: e => { o.fit = e.target.value; changed('Ajuste da imagem'); } }, [['contain', 'Caber inteira'], ['cover', 'Preencher (recorta)'], ['fill', 'Esticar']].map(([v, l]) => el('option', { value: v, text: l }))); s.value = o.fit || 'contain'; return s; })()));
      fields.push(el('div', { class: 'field' }, [el('span', { class: 'flabel', text: 'Imagem' }), el('div', { class: 'inline' }, [
        el('button', { class: 'small-btn', text: 'Substituir…', onclick: async () => { const l = await api.pickImages({}); if (l) { o.asset = await App.addAsset(l[0]); changed('Substituir imagem da camada'); } } }),
        el('button', { class: 'small-btn', text: 'Proporção original', onclick: () => { if (a && a.width) { o.h = r2(o.w * a.height / a.width); changed('Proporção da imagem'); } } })
      ])]));
      if (a && a.width) {
        const dpi = Math.round(a.width / (o.w / 25.4));
        fields.push(el('div', { class: 'small ' + (dpi < 150 ? 'bad' : dpi < 300 ? 'warn' : 'good'), text: `${a.width} × ${a.height} px — ${dpi} dpi neste tamanho` }));
      }
    }
    if (o.type === 'rect' || o.type === 'ellipse' || o.type === 'box') { fields.push(color('fill', 'Preenchimento'), color('stroke', 'Contorno'), num('strokeWidth', 'Espessura do contorno (pt)', 0.25)); if (o.type !== 'ellipse') fields.push(num('radius', 'Arredondamento (mm)', 0.5)); }
    if (o.type === 'line') fields.push(color('stroke', 'Cor'), num('strokeWidth', 'Espessura (pt)', 0.25));
    if (o.type === 'text' || o.type === 'box') {
      fields.push(txt('text', 'Texto', true), num('size', 'Tamanho (pt)', 0.5), color('color', 'Cor do texto'));
      const fs = el('select', { disabled: o.locked, onchange: e => { o.font = e.target.value; App.ensureFonts([o.font]); changed('Fonte da camada'); } });
      App.fontOptions(false).forEach(g => { const og = el('optgroup', { label: g.group }); g.items.forEach(it => og.appendChild(el('option', { value: it.value, text: it.label }))); fs.appendChild(og); });
      fs.value = o.font || '';
      fields.push(App.field('Fonte', fs));
      fields.push(App.field('Alinhamento', (() => { const s = el('select', { disabled: o.locked, onchange: e => { o.align = e.target.value; changed('Alinhamento do texto'); } }, [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita'], ['justify', 'Justificado']].map(([v, l]) => el('option', { value: v, text: l }))); s.value = o.align || 'left'; return s; })()));
    }
    return el('div', { class: 'grid' }, fields);
  }

  // teclado: setas movem a seleção quando a tela de camadas está ativa
  document.addEventListener('keydown', e => {
    if (App.view !== 'layers' || !sel.size) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    const step = e.shiftKey ? 5 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); moveBy(d[0], d[1]); changed('Mover camada'); }
    if (e.key === 'Delete') { e.preventDefault(); remove(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicate(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') clipboard = selected().map(o => JSON.parse(JSON.stringify(o)));
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) { sel.clear(); clipboard.forEach(c => { const n = Object.assign({}, c, { id: D.uid('ov'), pages: String(App.preview.currentPage || c.pages), z: ov().length }); ov().push(n); sel.add(n.id); }); changed('Colar camadas'); }
  });

  App.layers = {
    render, resolved, sel, byId, moveBy, snapTargets, changed, addImage, refreshPreview, margins,
    select(ids, additive) { if (!additive) sel.clear(); ids.forEach(id => sel.add(id)); refreshPreview(); if (App.view === 'layers') render(); },
    clear() { sel.clear(); refreshPreview(); if (App.view === 'layers') render(); }
  };
  App.hooks.viewRender.layers = render;
})();
