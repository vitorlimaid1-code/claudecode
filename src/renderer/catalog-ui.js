/* global App */
// Galeria de modelos de ficha catalográfica (prontos + salvos pelo usuário) e a "ficha fixa",
// que é aplicada automaticamente a todo livro novo.
(function () {
  const { el, api } = App;

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

  App.catalogUi = { gallery, STYLES, BUILTIN };
})();
