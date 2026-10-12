/* global App */
// Biblioteca visual: ilustrações para o corpo do texto e separadores (exclusivos para títulos),
// do aplicativo e do usuário; e o gerenciador de imagens do projeto.
(function () {
  const { el, $, api } = App;
  const state = { tab: 'corpo', q: '', fav: false, coll: '', orient: '', alpha: '', minRes: 0, source: '', items: [], collections: [] };

  async function load() {
    const r = await api.libList();
    state.items = r.items;
    state.collections = r.collections || [];
  }

  function usedKeys() {
    const set = new Set();
    Object.values(App.project.assets).forEach(a => { if (a.source) set.add(a.source); });
    return set;
  }

  function filtered(kind) {
    const q = state.q.toLowerCase();
    return state.items.filter(it => it.kind === kind &&
      (!q || `${it.name} ${it.tags}`.toLowerCase().includes(q)) &&
      (!state.fav || it.favorite) &&
      (!state.coll || (it.collections || []).includes(state.coll)) &&
      (!state.source || it.source === state.source) &&
      (!state.orient || (state.orient === 'h' ? it.width > it.height * 1.1 : state.orient === 'v' ? it.height > it.width * 1.1 : Math.abs(it.width - it.height) <= Math.max(it.width, it.height) * 0.1)) &&
      (!state.alpha || (state.alpha === 'yes' ? it.hasAlpha : !it.hasAlpha)) &&
      (!state.minRes || Math.min(it.width || 0, it.height || 0) >= state.minRes));
  }

  function thumb(it, opts) {
    opts = opts || {};
    const used = usedKeys().has(it.key);
    const t = el('div', { class: 'lib-item' + (it.kind === 'separadores' ? ' sep' : ''), draggable: 'true', title: `${it.name}${it.tags ? ' — ' + it.tags : ''}\n${it.width || '?'} × ${it.height || '?'} px${it.hasAlpha ? ' · transparente' : ''}` }, [
      el('img', { src: it.url, loading: 'lazy' }),
      el('div', { class: 'lib-name', text: it.name }),
      it.favorite ? el('span', { class: 'lib-fav', text: '★' }) : null,
      used ? el('span', { class: 'lib-used', text: 'em uso' }) : null,
      it.source === 'user' ? el('span', { class: 'lib-src', text: 'minha' }) : null
    ]);
    t.addEventListener('dragstart', e => {
      const payload = JSON.stringify({ url: it.url, name: it.name, kind: it.kind, key: it.key });
      e.dataTransfer.setData(it.kind === 'separadores' ? 'application/x-dl-separator' : 'application/x-dl-library', payload);
      e.dataTransfer.effectAllowed = 'copy';
    });
    t.addEventListener('click', () => (opts.onPick ? opts.onPick(it) : inspect(it)));
    return t;
  }

  async function assetFromItem(it) {
    const id = await App.addAssetFromUrl(it.url, { name: it.name, kind: it.kind });
    App.project.assets[id].source = it.key;
    return id;
  }

  function inspect(it) {
    const tags = el('input', { type: 'text', value: it.tags || '', placeholder: 'palavras-chave' });
    const colls = el('input', { type: 'text', value: (it.collections || []).join(', '), placeholder: 'coleções, separadas por vírgula' });
    const name = el('input', { type: 'text', value: it.name });
    const actions = [];
    if (it.kind === 'corpo') {
      actions.push({ label: 'Inserir no capítulo aberto', primary: true, onClick: async () => {
        const c = App.chapter();
        if (!c || App.view !== 'chapter') { App.toast('Abra um capítulo para inserir.'); return false; }
        if (c.locked) { App.toast('Capítulo bloqueado.'); return false; }
        const id = await assetFromItem(it);
        App.editor.insertBlocks(App.editor.figureHtml(id));
      } });
    } else {
      actions.push({ label: 'Usar como separador padrão', primary: true, onClick: async () => { const s = App.project.settings; s.separatorAsset = await assetFromItem(it); s.separator = 'image'; App.changed('Separador padrão'); } });
      actions.push({ label: 'Usar só neste capítulo', onClick: async () => { const c = App.chapter(); if (!c) return false; if (c.locked) { App.toast('Capítulo bloqueado.'); return false; } c.separator = await assetFromItem(it); App.changed('Separador do capítulo'); } });
    }
    actions.push({ label: it.favorite ? '☆ Remover dos favoritos' : '★ Favoritar', onClick: async () => { await api.libUpdate(it.key, { favorite: !it.favorite }); await refresh(); } });
    actions.push({ label: 'Salvar informações', onClick: async () => { await api.libUpdate(it.key, { tags: tags.value, collections: colls.value.split(',').map(x => x.trim()).filter(Boolean), name: it.source === 'user' ? name.value : undefined }); await refresh(); } });
    if (it.source === 'user') actions.push({ label: 'Excluir da biblioteca', danger: true, onClick: async () => { const ok = await api.confirm('Excluir da biblioteca?', 'O arquivo sai da sua biblioteca, mas os livros que já usam esta imagem guardam a própria cópia e não são alterados.', ['Excluir', 'Cancelar']); if (ok !== 0) return false; await api.libRemove(it.key); await refresh(); } });
    actions.push({ label: 'Fechar' });
    App.modal({
      title: it.name, wide: true,
      body: el('div', { class: 'lib-inspect' }, [
        el('div', { class: 'lib-big' + (it.kind === 'separadores' ? ' sep' : '') }, [el('img', { src: it.url })]),
        el('div', {}, [
          el('p', { class: 'muted small', text: `${it.kind === 'separadores' ? 'Separador (uso exclusivo abaixo dos títulos)' : 'Ilustração para o corpo do texto'} · ${it.source === 'app' ? 'biblioteca do aplicativo' : 'minha biblioteca'}` }),
          el('p', { class: 'small', text: `${it.width || '?'} × ${it.height || '?'} px · ${it.format || ''}${it.hasAlpha ? ' · com transparência' : ''}${it.hasIcc ? ' · perfil ICC' : ''}${it.colorSpace === 'CMYK' ? ' · CMYK' : ''}` }),
          it.width ? el('p', { class: 'small', text: `Tamanho máximo a 300 dpi: ${(it.width / 300 * 2.54).toFixed(1).replace('.', ',')} × ${(it.height / 300 * 2.54).toFixed(1).replace('.', ',')} cm` }) : null,
          it.source === 'user' ? App.field('Nome', name) : null,
          App.field('Palavras-chave', tags),
          App.field('Coleções', colls),
          el('p', { class: 'muted small', text: 'Dica: arraste a miniatura direto para o texto (ilustrações), para o título do capítulo (separadores) ou para uma página da prévia (camada fixa).' })
        ])
      ]),
      buttons: actions
    });
  }

  async function refresh() { await load(); renderDrawer(); if (App.view === 'assets') App.hooks.viewRender.assets(); }

  function filtersRow(onChange) {
    const search = el('input', { type: 'search', placeholder: 'Buscar por nome ou palavra-chave', value: state.q, oninput: e => { state.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(onChange, 200); } });
    const sel = (key, opts) => { const s = el('select', { onchange: e => { state[key] = e.target.value; onChange(); } }, opts.map(([v, l]) => el('option', { value: v, text: l }))); s.value = String(state[key]); return s; };
    return el('div', { class: 'lib-filters' }, [
      search,
      el('div', { class: 'inline wrap' }, [
        el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', checked: state.fav, onchange: e => { state.fav = e.target.checked; onChange(); } }), ' ★ Favoritas']),
        sel('source', [['', 'Todas as origens'], ['app', 'Do aplicativo'], ['user', 'Minhas']]),
        sel('coll', [['', 'Todas as coleções']].concat(state.collections.map(c => [c, c]))),
        sel('orient', [['', 'Qualquer orientação'], ['h', 'Horizontal'], ['v', 'Vertical'], ['q', 'Quadrada']]),
        sel('alpha', [['', 'Com/sem transparência'], ['yes', 'Com transparência'], ['no', 'Sem transparência']]),
        sel('minRes', [['0', 'Qualquer resolução'], ['600', '≥ 600 px'], ['1200', '≥ 1200 px'], ['2400', '≥ 2400 px']])
      ])
    ]);
  }

  function renderDrawer() {
    const d = $('#libraryDrawer');
    if (!d.classList.contains('open')) return;
    d.innerHTML = '';
    const items = filtered(state.tab);
    const grid = el('div', { class: 'lib-grid' + (state.tab === 'separadores' ? ' seps' : '') }, items.map(it => thumb(it)));
    grid.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); grid.classList.add('over'); } });
    grid.addEventListener('dragleave', () => grid.classList.remove('over'));
    grid.addEventListener('drop', async e => {
      e.preventDefault(); grid.classList.remove('over');
      const paths = Array.from(e.dataTransfer.files).map(f => api.pathForFile(f)).filter(Boolean);
      const r = await api.libAddPaths(state.tab, paths);
      afterAdd(r);
    });
    d.append(
      el('div', { class: 'drawer-head' }, [el('strong', { text: 'Biblioteca de imagens' }), el('button', { class: 'ghost', text: '✕', onclick: () => App.library.toggle(false) })]),
      el('div', { class: 'tabs' }, [['corpo', 'Ilustrações (corpo)'], ['separadores', 'Separadores de capítulo']].map(([k, l]) => el('button', { class: state.tab === k ? 'on' : '', text: l, onclick: () => { state.tab = k; renderDrawer(); } }))),
      el('p', { class: 'muted small', text: state.tab === 'separadores' ? 'Exclusivos para uso abaixo dos títulos: arraste para o título de um capítulo ou para a lista de capítulos.' : 'Arraste para o texto, para um capítulo da lista ou para uma página da prévia.' }),
      filtersRow(renderDrawer),
      (() => {
        // área de envio sempre visível: clique para escolher ou solte arquivos do computador
        const z = el('div', { class: 'lib-dropzone', tabindex: '0', onclick: async () => afterAdd(await api.libAddDialog(state.tab)) }, [
          el('strong', { text: '⬆ Enviar imagens do computador' }),
          el('span', { class: 'small muted', text: `Clique ou solte aqui PNG, JPG, WEBP ou SVG — vão para ${state.tab === 'separadores' ? 'Separadores' : 'Imagens do corpo do texto'}` })
        ]);
        z.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); z.classList.add('over'); } });
        z.addEventListener('dragleave', () => z.classList.remove('over'));
        z.addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); z.classList.remove('over'); afterAdd(await api.libAddPaths(state.tab, Array.from(e.dataTransfer.files).map(f => api.pathForFile(f)).filter(Boolean))); });
        return z;
      })(),
      el('div', { class: 'inline' }, [
        el('button', { class: 'ghost', text: 'Abrir pasta da biblioteca', onclick: () => api.libOpenFolder() })
      ]),
      el('div', { class: 'muted small', text: `${items.length} imagem(ns) — arraste arquivos do computador para cá para adicionar` }),
      grid
    );
  }

  function afterAdd(r) {
    if (!r) return;
    if (r.duplicates && r.duplicates.length) App.toast(`${r.duplicates.length} imagem(ns) já estavam na biblioteca (duplicatas ignoradas).`, 4000);
    if (r.added && r.added.length) App.toast(`${r.added.length} imagem(ns) adicionada(s) à biblioteca.`);
    refresh();
  }

  // Escolher uma imagem da biblioteca (devolve id da imagem no projeto)
  function pick(kind) {
    return new Promise(async res => {
      await load();
      let done = false;
      const finish = v => { if (!done) { done = true; res(v); } };
      const body = el('div', {});
      const draw = () => {
        body.innerHTML = '';
        const items = filtered(kind);
        body.append(filtersRow(draw), el('div', { class: 'lib-grid' + (kind === 'separadores' ? ' seps' : '') }, items.map(it => thumb(it, { onPick: async item => { const id = await assetFromItem(item); App.closeModal(); finish(id); } }))));
      };
      draw();
      App.modal({ title: kind === 'separadores' ? 'Escolher separador' : 'Escolher imagem', body, wide: true, buttons: [
        { label: 'Do computador…', onClick: async () => { const l = await api.pickImages({}); if (l) finish(await App.addAsset(Object.assign(l[0], { kind }))); } },
        { label: 'Cancelar', onClick: () => finish(null) }
      ], onClose: () => finish(null) });
    });
  }

  App.library = {
    reload: refresh,
    toggle(show) {
      const d = $('#libraryDrawer');
      const open = show === undefined ? !d.classList.contains('open') : show;
      d.classList.toggle('open', open);
      $('#btnLibrary').classList.toggle('on', open);
      if (open && $('#elementsDrawer')) { $('#elementsDrawer').classList.remove('open'); const be = $('#btnElements'); if (be) be.classList.remove('on'); }
      if (open) load().then(renderDrawer);
    },
    pick, refresh, assetFromItem
  };

  // ================================================================ imagens do projeto
  App.hooks.viewRender.assets = function () {
    App.flush();
    const v = $('#view-assets');
    v.innerHTML = '';
    const p = App.project;
    const usage = App.assetUsage();
    const missing = App.missingAssets();
    const assets = Object.values(p.assets);
    const byHash = {};
    assets.forEach(a => { if (a.hash) (byHash[a.hash] = byHash[a.hash] || []).push(a); });
    const unused = assets.filter(a => !usage[a.id]);
    const dpiOf = a => {
      const s = p.settings;
      const colW = s.pageWidth - s.marginInner - s.marginOuter;
      let worst = null;
      p.chapters.forEach(c => String(c.html).replace(new RegExp(`<figure[^>]*data-asset="${a.id}"[^>]*>`, 'g'), m => {
        const w = /data-align="full"/.test(m) ? 100 : Number((/data-width="([\d.]+)"/.exec(m) || [])[1]) || 60;
        const dpi = Math.round(a.width / ((colW * w / 100) / 25.4));
        if (worst === null || dpi < worst) worst = dpi;
        return m;
      }));
      return worst;
    };
    const card = a => {
      const dpi = dpiOf(a);
      const info = a.info || {};
      const dup = a.hash && byHash[a.hash] && byHash[a.hash].length > 1;
      return el('div', { class: 'asset-card', draggable: 'true', ondragstart: e => { e.dataTransfer.setData('application/x-dl-asset', a.id); e.dataTransfer.effectAllowed = 'copy'; } }, [
        el('div', { class: 'asset-thumb' }, [el('img', { src: App.assetUrl(a.id) })]),
        el('div', { class: 'asset-body' }, [
          el('strong', { text: a.name }),
          el('div', { class: 'muted small', text: `${a.width} × ${a.height} px · ${info.format || ''}${info.hasAlpha ? ' · transparência' : ''}${info.hasIcc ? ' · ICC' : ''}` }),
          info.colorSpace === 'CMYK' ? el('div', { class: 'warn small', text: 'Imagem CMYK: as cores podem variar na tela; verifique a prova.' }) : null,
          dpi !== null ? el('div', { class: 'small ' + (dpi < 150 ? 'bad' : dpi < 300 ? 'warn' : 'good'), text: `Resolução efetiva: ${dpi} dpi` }) : null,
          dup ? el('div', { class: 'warn small', text: 'Duplicata de outra imagem do projeto' }) : null,
          el('div', { class: 'small' }, [el('span', { class: 'muted', text: 'Usada em: ' }), (usage[a.id] || []).length ? (usage[a.id] || []).map(u => u.label).slice(0, 6).join(' · ') : el('em', { class: 'muted', text: 'não usada' })]),
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'small-btn', text: 'Substituir em todo o livro…', onclick: async () => {
              const l = await api.pickImages({}); if (!l) return;
              const ok = await App.confirmPreview('Substituir imagem', 'A nova imagem será usada em todos os lugares abaixo, mantendo tamanhos, posições, recortes e contornos.', (usage[a.id] || []).map(u => u.label).concat(['(também nas camadas e na capa, se houver)']));
              if (!ok) return;
              Object.assign(a, { name: l[0].name, dataUrl: l[0].dataUrl, width: l[0].width, height: l[0].height, hash: l[0].hash, info: l[0].info, source: l[0].source });
              App.editorChapterId = null;
              App.changed('Substituição de imagem: ' + a.name);
              App.hooks.viewRender.assets();
            } }),
            el('button', { class: 'small-btn', text: 'Renomear', onclick: async () => { const n = await App.prompt('Renomear imagem', 'Nome', a.name); if (n) { a.name = n; App.changed('Imagem renomeada'); App.hooks.viewRender.assets(); } } }),
            el('button', { class: 'small-btn', text: '→ Minha biblioteca', onclick: async () => { const kind = await api.confirm('Salvar na biblioteca', 'Em qual seção?', ['Ilustrações (corpo)', 'Separadores', 'Cancelar']); if (kind === 2) return; afterAdd(await api.libAddDataUrl(kind === 1 ? 'separadores' : 'corpo', a.name, a.dataUrl)); } }),
            dup ? el('button', { class: 'small-btn', text: 'Unificar duplicatas', onclick: () => unifyDuplicates(a) }) : null
          ])
        ])
      ]);
    };
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Imagens do projeto' }),
      el('p', { class: 'muted', text: 'Cada imagem é guardada dentro do arquivo .livro (o livro não depende dos arquivos originais). Arraste uma miniatura para o texto ou para uma página da prévia.' }),
      missing.length ? el('div', { class: 'card bad-card' }, [
        el('h3', { text: `Referências quebradas (${missing.length})` }),
        el('p', { class: 'small', text: 'Imagens citadas no texto que não existem mais no projeto. Localize o arquivo para restaurá-las sem refazer a diagramação.' }),
        el('div', {}, missing.map(id => {
          const where = App.project.chapters.filter(c => String(c.html).includes(`data-asset="${id}"`)).map(c => c.title).join(', ');
          return el('div', { class: 'inline' }, [el('span', { text: `${id} — em: ${where}` }), el('button', { text: 'Localizar arquivo…', onclick: async () => {
            const l = await api.pickImages({}); if (!l) return;
            const a = l[0];
            p.assets[id] = { id, name: a.name, dataUrl: a.dataUrl, width: a.width, height: a.height, hash: a.hash, info: a.info, source: a.source, added: Date.now() };
            App.editorChapterId = null;
            App.changed('Imagem ausente restaurada');
            App.hooks.viewRender.assets();
          } })]);
        }))
      ]) : null,
      el('div', { class: 'inline wrap' }, [
        el('strong', { text: `${assets.length} imagem(ns)` }),
        unused.length ? el('button', { text: `Remover ${unused.length} não usada(s)…`, onclick: async () => {
          const ok = await App.confirmPreview('Remover imagens não usadas', 'Estas imagens não aparecem em nenhum lugar do livro:', unused.map(a => a.name), 'Remover');
          if (!ok) return;
          App.commit('Antes de remover imagens não usadas');
          unused.forEach(a => delete p.assets[a.id]);
          App.changed('Imagens não usadas removidas');
          App.hooks.viewRender.assets();
        } }) : null
      ]),
      el('div', { class: 'asset-grid' }, assets.map(card))
    ]));
  };

  function unifyDuplicates(a) {
    const p = App.project;
    const dups = Object.values(p.assets).filter(x => x.hash === a.hash && x.id !== a.id);
    App.confirmPreview('Unificar duplicatas', `As ocorrências destas cópias passarão a usar “${a.name}”:`, dups.map(d => d.name)).then(ok => {
      if (!ok) return;
      App.flush();
      dups.forEach(d => {
        const re = new RegExp(`data-asset="${d.id}"`, 'g');
        p.chapters.forEach(c => { c.html = c.html.replace(re, `data-asset="${a.id}"`); if (c.separator === d.id) c.separator = a.id; if (c.openingImage && c.openingImage.asset === d.id) c.openingImage.asset = a.id; });
        p.back.bio.html = p.back.bio.html.replace(re, `data-asset="${a.id}"`);
        p.back.extra.html = p.back.extra.html.replace(re, `data-asset="${a.id}"`);
        (p.overlays || []).forEach(o => { if (o.asset === d.id) o.asset = a.id; });
        if (p.settings.separatorAsset === d.id) p.settings.separatorAsset = a.id;
        delete p.assets[d.id];
      });
      App.editorChapterId = null;
      App.changed('Duplicatas unificadas');
      App.hooks.viewRender.assets();
    });
  }
})();
