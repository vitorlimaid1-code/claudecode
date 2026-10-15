/* global App, Ficha */
// Galeria de modelos de ficha catalográfica (prontos + salvos pelo usuário) e a "ficha fixa",
// que é aplicada automaticamente a todo livro novo.
(function () {
  const { el, api, D } = App;

  // Modelos prontos: assuntos e classificação usuais por gênero + apresentação da ficha.
  // A ficha oficial deve ser conferida por bibliotecário(a); os modelos agilizam o preenchimento.
  const BUILTIN = [
    { id: 'romance', name: 'Romance brasileiro', desc: 'Caixa clássica', fields: { style: 'box', subjects: 'Ficção brasileira; Romance', cdd: 'B869.3', cdu: '821.134.3(81)-31' } },
    { id: 'poesia', name: 'Poesia brasileira', desc: 'Sem borda, minimalista', fields: { style: 'plain', subjects: 'Poesia brasileira', cdd: 'B869.1', cdu: '821.134.3(81)-1' } },
    { id: 'contos', name: 'Contos', desc: 'Caixa clássica', fields: { style: 'box', subjects: 'Contos brasileiros', cdd: 'B869.3', cdu: '821.134.3(81)-34' } },
    { id: 'cronicas', name: 'Crônicas', desc: 'Cantos arredondados', fields: { style: 'rounded', subjects: 'Crônicas brasileiras', cdd: 'B869.4', cdu: '821.134.3(81)-94' } },
    { id: 'terror', name: 'Terror e suspense', desc: 'Borda dupla', fields: { style: 'double', subjects: 'Ficção brasileira; Terror; Suspense', cdd: 'B869.3', cdu: '821.134.3(81)-312.4' } },
    { id: 'fantasia', name: 'Fantasia e ficção científica', desc: 'Caixa clássica', fields: { style: 'box', subjects: 'Ficção brasileira; Fantasia; Ficção científica', cdd: 'B869.3', cdu: '821.134.3(81)-312.9' } },
    { id: 'infantil', name: 'Infantojuvenil', desc: 'Cantos arredondados', fields: { style: 'rounded', subjects: 'Literatura infantojuvenil', cdd: '028.5', cdu: '087.5' } },
    { id: 'traducao', name: 'Ficção traduzida', desc: 'Com título original e tradutor', fields: { style: 'box', subjects: 'Ficção estrangeira; Romance', cdd: '813', cdu: '821.111(73)-31', originalTitle: 'Título original', translator: 'Nome do(a) tradutor(a)' } },
    { id: 'autoajuda', name: 'Autoajuda', desc: 'Padrão CBL', fields: { style: 'cbl', subjects: 'Autoajuda; Desenvolvimento pessoal; Autorrealização', cdd: '158.1', cdu: '159.947' } },
    { id: 'biografia', name: 'Biografia e memórias', desc: 'Caixa clássica', fields: { style: 'box', subjects: 'Biografias; Memórias', cdd: '920', cdu: '929' } },
    { id: 'religioso', name: 'Religioso', desc: 'Borda dupla', fields: { style: 'double', subjects: 'Vida cristã; Espiritualidade', cdd: '248.4', cdu: '27-584' } },
    { id: 'academico', name: 'Acadêmico', desc: 'Padrão CBL, com notas', fields: { style: 'cbl', subjects: 'Educação; Pesquisa', cdd: '370', cdu: '37', notes: 'Inclui bibliografia.' } },
    { id: 'compacta', name: 'Compacta (livros pequenos)', desc: 'Letra menor, ocupa menos espaço', fields: { style: 'compact' } },
    { id: 'manual', name: 'Ficha pronta do bibliotecário', desc: 'Cole o texto completo', fields: { style: 'box', mode: 'manual' } }
  ];
  const STYLES = [
    { value: 'box', label: 'Caixa clássica' }, { value: 'plain', label: 'Sem borda' }, { value: 'double', label: 'Borda dupla' },
    { value: 'rounded', label: 'Cantos arredondados' }, { value: 'cbl', label: 'Padrão CBL (Câmara Brasileira do Livro)' }, { value: 'compact', label: 'Compacta' }
  ];
  // campos do livro que não vêm de um modelo
  const BOOK_ONLY = ['pagesOverride', 'enabled'];

  let userTemplates = null;
  let fixed;
  async function load() {
    if (userTemplates === null) { try { userTemplates = (await api.catalogTemplatesGet()) || []; } catch (e) { userTemplates = []; } }
    if (fixed === undefined) { try { fixed = await api.catalogFixedGet(); } catch (e) { fixed = null; } }
  }

  function mini(fields, meta) {
    const st = fields.style || 'box';
    const subj = String(fields.subjects || '').split(/[\n;]+/).map(x => x.trim()).filter(Boolean);
    const box = el('div', { class: 'cat-mini-box' }, fields.mode === 'manual' ? [el('div', { class: 'cm-head', text: 'CIP' }), el('div', { class: 'cm-line', text: '(texto colado)' })] : [
      el('div', { class: 'cm-head', text: st === 'cbl' ? 'CIP · CBL' : 'CIP' }),
      el('div', { class: 'cm-line', text: (meta.author || 'Autor').split(' ').slice(-1)[0] + ', ' + (meta.author || 'Autor').split(' ')[0] }),
      el('div', { class: 'cm-line ind', text: (meta.title || 'Título') + ' / ' + (meta.author || '') }),
      fields.originalTitle ? el('div', { class: 'cm-line ind', text: 'Título original: …' }) : null,
      el('div', { class: 'cm-line ind', text: subj.map((x, i) => `${i + 1}. ${x}.`).join(' ') + ' I. Título.' }),
      fields.cdd ? el('div', { class: 'cm-line r', text: 'CDD ' + fields.cdd }) : null
    ]);
    return el('div', { class: 'cat-mini cm-st-' + st }, [box]);
  }

  async function applyTemplate(t, rerender) {
    const c = App.project.catalog;
    const f = t.fields || {};
    const ok = await App.confirmPreview('Aplicar modelo de ficha', `Aplicar o modelo “${t.name}”? Os campos abaixo serão preenchidos; título, autor e ISBN do livro são mantidos.`, Object.entries(f).filter(([k]) => !['credits', 'images', 'qrcodes'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)}`).concat(f.credits ? ['créditos (' + f.credits.length + ')'] : []));
    if (!ok) return;
    if (f.mode !== 'manual') c.mode = 'fields';
    Object.keys(f).forEach(k => { if (!BOOK_ONLY.includes(k)) c[k] = JSON.parse(JSON.stringify(f[k])); });
    if (t.meta) Object.entries(t.meta).forEach(([k, v]) => { if (v) App.project.meta[k] = v; });
    if (t.assets) Object.assign(App.project.assets, t.assets);
    App.changed('Modelo de ficha: ' + t.name);
    rerender();
  }

  function snapshot() {
    const p = App.project;
    const c = JSON.parse(JSON.stringify(p.catalog));
    BOOK_ONLY.forEach(k => delete c[k]);
    const assets = {};
    (c.images || []).forEach(im => { if (p.assets[im.asset]) assets[im.asset] = p.assets[im.asset]; });
    const meta = {};
    ['author', 'publisher', 'city', 'year', 'edition'].forEach(k => { if (p.meta[k]) meta[k] = p.meta[k]; });
    return { catalog: c, meta, assets };
  }

  async function saveAsTemplate(rerender) {
    const name = await App.prompt('Salvar modelo de ficha', 'Nome do modelo', (App.project.meta.publisher || 'Minha ficha') + ' — ' + (STYLES.find(s => s.value === App.project.catalog.style) || STYLES[0]).label);
    if (!name) return;
    const snap = snapshot();
    userTemplates = userTemplates || [];
    userTemplates.push({ id: 'u' + Date.now().toString(36), name, desc: 'Salvo por você', fields: snap.catalog, meta: snap.meta, assets: snap.assets, user: true });
    await api.catalogTemplatesSet(userTemplates);
    App.toast('Modelo “' + name + '” salvo na galeria.');
    rerender();
  }

  async function saveFixed(rerender) {
    const p = App.project;
    const snap = snapshot();
    const titlePage = { logo: p.titlePage.logo, logoWidth: p.titlePage.logoWidth, showPublisher: p.titlePage.showPublisher, showYear: p.titlePage.showYear };
    if (titlePage.logo && p.assets[titlePage.logo]) snap.assets[titlePage.logo] = p.assets[titlePage.logo];
    const ok = await App.confirmPreview('Salvar ficha fixa', 'A partir de agora, todo livro novo já começa com esta ficha preenchida:', [
      'Ficha catalográfica: ' + (p.catalog.mode === 'manual' ? 'texto manual' : `${p.catalog.subjects || 'sem assuntos'} · CDD ${p.catalog.cdd || '—'}`),
      'Créditos: ' + ((p.catalog.credits || []).filter(x => x.name).map(x => `${x.role}: ${x.name}`).join(', ') || '—'),
      'Direitos e contato, bibliotecário(a)/CRB, imagens e QR codes da página de créditos',
      'Editora, cidade, ano, edição e autor: ' + Object.values(snap.meta).join(' · '),
      'Logotipo da editora na página de rosto: ' + (titlePage.logo ? 'sim' : 'não')
    ], 'Salvar como fixa');
    if (!ok) return;
    fixed = { catalog: snap.catalog, meta: snap.meta, titlePage, assets: snap.assets, savedAt: new Date().toISOString() };
    await api.catalogFixedSet(fixed);
    App.toast('Ficha fixa salva: novos livros já começam com ela.');
    rerender();
  }

  async function removeFixed(rerender) {
    const b = await api.confirm('Remover a ficha fixa?', 'Os novos livros voltarão a começar com a ficha em branco. Este livro não muda.', ['Remover', 'Cancelar']);
    if (b !== 0) return;
    await api.catalogFixedSet(null);
    fixed = null;
    rerender();
  }

  function gallery(rerender) {
    const holder = el('div', { class: 'card span-all' }, [el('h3', { text: 'Modelos de ficha catalográfica' }), el('p', { class: 'muted small', text: 'Carregando…' })]);
    load().then(() => {
      const meta = App.project.meta;
      const tile = t => el('div', { class: 'cat-tile' + (t.user ? ' user' : '') }, [
        mini(t.fields || {}, meta),
        el('div', { class: 'cat-tile-name', text: t.name }),
        el('div', { class: 'muted small', text: t.desc || '' }),
        el('div', { class: 'inline' }, [
          el('button', { class: 'small-btn primary', text: 'Aplicar', onclick: () => applyTemplate(t, rerender) }),
          t.user ? el('button', { class: 'small-btn', text: '✕', title: 'Excluir modelo', onclick: async () => { userTemplates = userTemplates.filter(x => x.id !== t.id); await api.catalogTemplatesSet(userTemplates); rerender(); } }) : null
        ])
      ]);
      holder.innerHTML = '';
      holder.append(
        el('h3', { text: 'Modelos de ficha catalográfica' }),
        el('p', { class: 'muted small', text: 'Escolha um modelo pronto para preencher assuntos, classificação (CDD/CDU) e a aparência da ficha. Título, autor e ISBN continuam os do livro.' }),
        el('div', { class: 'cat-fixed ' + (fixed ? 'on' : '') }, [
          el('div', {}, [
            el('strong', { text: fixed ? '★ Ficha fixa ativa' : 'Ficha fixa' }),
            el('div', { class: 'small muted', text: fixed ? `Salva em ${new Date(fixed.savedAt || Date.now()).toLocaleString('pt-BR')}. Todo livro novo começa com ela já preenchida.` : 'Salve a ficha deste livro como fixa para que todo livro novo já comece com ela preenchida (créditos, editora, direitos, bibliotecário, logotipo…).' })
          ]),
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'primary', text: fixed ? '★ Atualizar ficha fixa' : '★ Salvar como ficha fixa', onclick: () => saveFixed(rerender) }),
            fixed ? el('button', { text: 'Aplicar a ficha fixa neste livro', onclick: () => applyTemplate({ name: 'Ficha fixa', fields: fixed.catalog, meta: fixed.meta, assets: fixed.assets }, rerender) }) : null,
            fixed ? el('button', { class: 'ghost danger', text: 'Remover', onclick: () => removeFixed(rerender) }) : null
          ])
        ]),
        el('div', { class: 'cat-gallery' }, BUILTIN.map(tile).concat((userTemplates || []).map(tile))),
        el('div', { class: 'inline wrap' }, [
          el('button', { text: '+ Salvar a ficha atual como modelo', onclick: () => saveAsTemplate(rerender) })
        ])
      );
    });
    return holder;
  }

  // ---------------------------------------------------------------- editoras e logotipos (salvos para todos os livros)
  let pubs = null;
  async function loadPubs() {
    if (!pubs) { try { pubs = (await api.publishersGet()) || {}; } catch (e) { pubs = {}; } }
    pubs.publishers = pubs.publishers || []; pubs.logos = pubs.logos || [];
    return pubs;
  }
  const savePubs = () => api.publishersSet(pubs);
  const IMPRINT = 'Impresso no Brasil\nSorriso, MT';
  const showFront = sel => { try { const f = App.preview && App.preview.findPage; if (f) f(sel); } catch (e) { /* ok */ } };

  // escolhe a editora: atualiza a ficha catalográfica (e o rosto) na hora
  function choosePublisher(pb, rerender) {
    const m = App.project.meta;
    m.publisher = pb ? pb.name : '';
    if (pb && pb.city) m.city = pb.city;
    App.changed(pb ? `Editora: ${pb.name}` : 'Editora removida');
    showFront('#ficha');
    rerender();
  }
  // escolhe o logotipo: vai para a página de rosto, abaixo do título, com “Impresso no Brasil / Sorriso, MT”
  async function chooseLogo(lg, rerender) {
    const tp = App.project.titlePage;
    if (!lg) { tp.logo = null; App.changed('Logotipo removido da página de rosto'); rerender(); return; }
    tp.logo = await App.addAsset({ dataUrl: lg.dataUrl, name: lg.name || 'Logotipo', kind: 'logo' });
    tp.logoLib = lg.id;
    tp.logoPlacement = 'below-title';
    if (!tp.imprint) tp.imprint = IMPRINT;
    App.project.front.titlePage = true;
    App.changed(`Logotipo “${lg.name || 'da editora'}” na página de rosto`);
    showFront('.title-page');
    rerender();
  }
  async function uploadLogos(rerender) {
    const l = await api.pickImages({ title: 'Logotipos da editora (PNG com fundo transparente, de preferência)', multiple: true });
    if (!l || !l.length) return;
    await loadPubs();
    l.forEach(a => pubs.logos.push({ id: D.uid('logo'), name: (a.name || 'Logotipo').replace(/\.[a-z0-9]+$/i, ''), dataUrl: a.dataUrl, width: a.width, height: a.height }));
    await savePubs();
    App.toast(`${l.length} logotipo(s) salvo(s). Clique num deles para usá-lo na página de rosto.`);
    if (l.length === 1) await chooseLogo(pubs.logos[pubs.logos.length - 1], rerender); else rerender();
  }
  // janela com as editoras: adicionar, editar, excluir e salvar (ficam guardadas para os próximos livros)
  async function managePublishers(rerender) {
    await loadPubs();
    const list = pubs.publishers.map(x => Object.assign({}, x));
    const box = el('div', { class: 'pub-list' });
    const draw = () => {
      box.innerHTML = '';
      if (!list.length) box.appendChild(el('p', { class: 'muted small', text: 'Nenhuma editora cadastrada ainda.' }));
      list.forEach((x, i) => {
        const name = el('input', { type: 'text', value: x.name || '', placeholder: 'Nome da editora' });
        const city = el('input', { type: 'text', value: x.city || '', placeholder: 'Cidade (opcional)' });
        name.addEventListener('input', () => { x.name = name.value; });
        city.addEventListener('input', () => { x.city = city.value; });
        box.appendChild(el('div', { class: 'pub-row' }, [name, city, el('button', { class: 'ghost', text: '✕', title: 'Excluir', onclick: () => { list.splice(i, 1); draw(); } })]));
      });
    };
    draw();
    const add = el('input', { type: 'text', placeholder: 'Nova editora (ex.: Casa Vertigem)' });
    const addIt = () => { const v = add.value.trim(); if (!v) return; list.push({ id: D.uid('pub'), name: v, city: '' }); add.value = ''; draw(); add.focus(); };
    add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });
    App.modal({
      title: 'Editoras',
      body: el('div', {}, [
        el('p', { class: 'muted small', text: 'Cadastre os nomes das editoras uma vez; depois é só escolher na ficha catalográfica — a ficha e a página de rosto se atualizam na hora.' }),
        el('div', { class: 'pub-add' }, [add, el('button', { class: 'primary', text: '+ Adicionar', onclick: addIt })]),
        box
      ]),
      buttons: [{ label: 'Cancelar' }, { label: 'Salvar', primary: true, onClick: async () => {
        if (add.value.trim()) addIt();
        pubs.publishers = list.filter(x => (x.name || '').trim()).map(x => ({ id: x.id || D.uid('pub'), name: x.name.trim(), city: (x.city || '').trim() }));
        await savePubs();
        App.toast('Editoras salvas.');
        rerender();
      } }]
    });
    setTimeout(() => add.focus(), 40);
  }
  // ---------------------------------------------------------------- assuntos e CDD (janelas de escolha)
  function pickSubjects(rerender) {
    const c = App.project.catalog;
    let sel = String(c.subjects || '').split(/[\n;]+/).map(x => x.trim()).filter(Boolean);
    const all = Ficha.SUBJECTS.concat(sel.filter(x => !Ficha.SUBJECTS.includes(x)));
    const prev = el('p', { class: 'small cat-prev' });
    const grid = el('div', { class: 'pick-grid' });
    const draw = () => {
      grid.innerHTML = '';
      all.forEach(x => {
        const i = sel.indexOf(x);
        grid.appendChild(el('button', { class: 'pick-chip' + (i >= 0 ? ' on' : ''), onclick: () => { const k = sel.indexOf(x); if (k >= 0) sel.splice(k, 1); else sel.push(x); draw(); } }, [i >= 0 ? el('b', { text: String(i + 1) }) : null, x]));
      });
      prev.textContent = sel.length ? 'Na ficha: ' + sel.map((x, i) => `${i + 1}. ${x}.`).join(' ') + ' I. Título.' : 'Escolha ao menos um assunto (na ordem de importância).';
    };
    const add = el('input', { type: 'text', placeholder: 'Outro assunto (Enter para incluir)' });
    add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = add.value.trim(); if (v && !all.includes(v)) all.push(v); if (v && !sel.includes(v)) sel.push(v); add.value = ''; draw(); } });
    draw();
    App.modal({
      title: 'Assuntos da ficha catalográfica',
      body: el('div', {}, [el('p', { class: 'muted small', text: 'Clique na ordem de importância: o número mostra a posição na ficha. Clique de novo para tirar.' }), grid, add, prev]),
      buttons: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, onClick: () => { c.subjects = sel.join('; '); App.changed('Assuntos da ficha'); rerender(); } }]
    });
  }
  function pickCdd(rerender) {
    const c = App.project.catalog;
    let cur = String(c.cdd || '').trim();
    const list = el('div', { class: 'pick-list' });
    const q = el('input', { type: 'search', placeholder: 'Procurar (ex.: russa, história)' });
    const custom = el('input', { type: 'text', placeholder: 'Ou digite o código', value: cur });
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      list.innerHTML = '';
      Ficha.CDD.filter(x => !t || (x.label + ' ' + x.code).toLowerCase().includes(t)).forEach(x => list.appendChild(el('button', { class: 'pick-row' + (cur === x.code ? ' on' : ''), onclick: () => { cur = x.code; custom.value = x.code; draw(); } }, [el('b', { text: x.code }), el('span', { text: x.label })])));
    };
    q.addEventListener('input', draw);
    custom.addEventListener('input', () => { cur = custom.value.trim(); draw(); });
    draw();
    App.modal({
      title: 'CDD — Classificação Decimal de Dewey',
      body: el('div', {}, [el('p', { class: 'muted small', text: 'Códigos usuais por gênero e origem da obra. A ficha oficial deve ser conferida por bibliotecário(a).' }), q, list, custom]),
      buttons: [{ label: 'Cancelar' }, { label: 'Aplicar', primary: true, onClick: () => { c.cdd = cur; App.changed('CDD da ficha'); rerender(); } }]
    });
  }

  // selo editorial: nome em “Esta edição é publicada por …” (e na editora da ficha) e logotipo no rosto
  async function chooseSeal(id, rerender) {
    const m = App.project.meta;
    const sl = Ficha.SEALS.find(x => x.id === id);
    m.seal = sl ? sl.id : '';
    if (!sl) { App.changed('Selo removido'); rerender(); return; }
    m.publisher = sl.name;
    if (!m.city) m.city = 'Rio de Janeiro';
    App.changed(`Selo: ${sl.name}`);
    const r = await api.sealLogo(sl.id);
    if (r && r.dataUrl) await chooseLogo({ id: 'seal:' + sl.id, name: sl.name, dataUrl: r.dataUrl }, rerender);
    else { App.toast(`Selo “${sl.name}” aplicado na ficha. O logotipo não pôde ser baixado agora${r && r.error ? ' (' + r.error + ')' : ''}: conecte-se à internet uma vez e escolha o selo de novo.`, 7000); rerender(); }
  }

  function publisherCard(rerender) {
    const holder = el('div', { class: 'card span-all' }, [el('h3', { text: 'Editora e logotipo' }), el('p', { class: 'muted small', text: 'Carregando…' })]);
    loadPubs().then(() => {
      const m = App.project.meta, tp = App.project.titlePage;
      const sel = el('select', { class: 'pub-select', onchange: e => choosePublisher(pubs.publishers.find(x => x.id === e.target.value) || null, rerender) }, [
        el('option', { value: '', text: m.publisher && !pubs.publishers.some(x => x.name === m.publisher) ? `${m.publisher} (deste livro)` : '— escolha a editora —', selected: true })
      ].concat(pubs.publishers.map(x => el('option', { value: x.id, text: x.name + (x.city ? ' · ' + x.city : ''), selected: x.name === m.publisher }))));
      const cur = tp.logo && App.project.assets[tp.logo];
      const imprint = el('textarea', { rows: 2 });
      imprint.value = tp.imprint || IMPRINT;
      imprint.addEventListener('input', () => { tp.imprint = imprint.value; App.changed(null); clearTimeout(imprint._t); imprint._t = setTimeout(() => App.commit('Texto abaixo do logotipo'), 900); });
      const sealSel = el('select', { class: 'pub-select', onchange: e => chooseSeal(e.target.value, rerender) }, [el('option', { value: '', text: '— escolha o selo editorial —' })].concat(Ficha.SEALS.map(x => el('option', { value: x.id, text: x.name, selected: m.seal === x.id }))));
      holder.innerHTML = '';
      holder.append(
        el('h3', { text: 'Editora e logotipo' }),
        el('div', { class: 'pub-top' }, [
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Selo editorial (logotipo no rosto e na capa; “Esta edição é publicada por …” na ficha)' }), sealSel])
        ]),
        el('div', { class: 'pub-top' }, [
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Editora' }), sel]),
          el('button', { text: 'Editoras…', title: 'Cadastrar, editar ou excluir editoras', onclick: () => managePublishers(rerender) })
        ]),
        el('div', { class: 'flabel', text: 'Logotipos da editora — clique para usar na página de rosto (abaixo do título)' }),
        el('div', { class: 'pub-logos' }, pubs.logos.map(lg => el('div', { class: 'pub-logo' + (cur && tp.logoLib === lg.id ? ' on' : ''), title: lg.name, onclick: () => chooseLogo(lg, rerender) }, [
          el('img', { src: lg.dataUrl, alt: lg.name }),
          el('span', { text: lg.name }),
          el('button', { class: 'ghost pub-del', text: '✕', title: 'Excluir este logotipo da lista', onclick: async e => { e.stopPropagation(); pubs.logos = pubs.logos.filter(x => x.id !== lg.id); await savePubs(); rerender(); } })
        ])).concat([el('button', { class: 'pub-logo pub-up', onclick: () => uploadLogos(rerender) }, [el('b', { text: '＋' }), el('span', { text: 'Enviar logotipo' })])])),
        cur ? el('div', { class: 'pub-cur' }, [
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Texto abaixo do logotipo' }), imprint]),
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Largura do logotipo (mm)' }), (() => { const n = el('input', { type: 'number', min: 5, max: 80, value: tp.logoWidth || 25 }); n.addEventListener('change', () => { tp.logoWidth = Number(n.value) || 25; App.changed('Largura do logotipo'); }); return n; })()]),
          el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Posição' }), (() => { const s2 = el('select', {}, [['below-title', 'Abaixo do título'], ['foot', 'No pé da página']].map(([v, t]) => el('option', { value: v, text: t, selected: (tp.logoPlacement || 'foot') === v }))); s2.addEventListener('change', () => { tp.logoPlacement = s2.value; App.changed('Posição do logotipo'); }); return s2; })()]),
          el('button', { class: 'ghost', text: 'Tirar o logotipo', onclick: () => chooseLogo(null, rerender) })
        ]) : null
      );
    });
    return holder;
  }

  App.catalogUi = { gallery, STYLES, BUILTIN, publisherCard, managePublishers, pickSubjects, pickCdd, chooseSeal };
})();
