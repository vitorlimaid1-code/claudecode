/* global App */
// Configurações (tela própria): atualização pelo GitHub com o registro de cada etapa do download, e os
// manuais de todas as ferramentas, por categoria, com busca.
(function () {
  const { el, api } = App;
  let screen = null, body = null, nav = null, current = 'update';
  let updLog = null, updState = null; // o registro da atualização continua ao trocar de aba

  // ---------------------------------------------------------------- atualização
  function updatePane() {
    if (updState) return updState.node;
    const verEl = el('strong', { text: '…' });
    api.appInfo().then(i => { verEl.textContent = (i && i.version) || '—'; }).catch(() => {});
    const status = el('p', { class: 'small', text: 'Clique em “Procurar atualização” para comparar com a versão publicada no GitHub.' });
    const bar = el('div', { class: 'upd-bar' }, [el('i')]);
    bar.style.display = 'none';
    const notes = el('div', { class: 'upd-notes small muted' });
    const btnCheck = el('button', { text: 'Procurar atualização' });
    const btnGo = el('button', { class: 'primary', text: 'Atualizar agora' });
    btnGo.disabled = true;
    updLog = el('ol', { class: 'pg-log upd-log' });
    const addLog = (m, kind) => {
      updLog.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: new Date().toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
      updLog.scrollTop = updLog.scrollHeight;
    };
    // mensagens do processo principal: linhas do registro e progresso do download
    if (api.onUpdateProgress) api.onUpdateProgress(p => {
      if (!p) return;
      if (p.log) { addLog(p.log, p.kind); return; }
      bar.style.display = '';
      bar.firstChild.style.width = Math.round((p.ratio || 0) * 100) + '%';
      const mb = n => (n / 1048576).toFixed(1).replace('.', ',');
      status.textContent = p.ratio >= 1 ? `Download concluído (${mb(p.received)} MB). Conferindo o arquivo…` : `Baixando… ${Math.round((p.ratio || 0) * 100)}% (${mb(p.received)} de ${mb(p.total)} MB${p.speed ? ` · ${mb(p.speed)} MB/s` : ''}${p.eta ? ` · falta ~${Math.max(1, Math.round(p.eta))} s` : ''})`;
    });
    let found = null;
    const check = async () => {
      btnCheck.disabled = true; status.textContent = 'Procurando a versão mais recente no GitHub…'; status.className = 'small';
      const r = await api.updateCheck();
      btnCheck.disabled = false;
      if (!r || r.error) { status.textContent = '✕ ' + ((r && r.error) || 'não foi possível consultar o GitHub.'); status.className = 'small bad'; return; }
      found = r;
      notes.textContent = r.notes ? r.notes.slice(0, 1200) : '';
      // depois das linhas que o processo principal já mandou
      if (r.newer) { status.textContent = `Nova versão disponível: ${r.version} (você tem a ${r.current}).`; status.className = 'small good'; btnGo.disabled = false; setTimeout(() => addLog(`Há uma versão nova: ${r.version}. Clique em “Atualizar agora” para baixar.`, 'ok'), 150); }
      else { status.textContent = `Você já está na versão mais recente (${r.current}).`; status.className = 'small good'; btnGo.disabled = true; setTimeout(() => addLog('Nenhuma atualização necessária.', 'ok'), 150); }
    };
    btnCheck.addEventListener('click', check);
    btnGo.addEventListener('click', async () => {
      if (!found || !found.newer) return;
      const ok = await api.confirm(`Atualizar para a versão ${found.version}?`, (App.dirty ? 'Há alterações não salvas: salve o livro antes (Ctrl+S). ' : '') + 'O instalador novo será baixado direto do GitHub e aberto. Configurações, bibliotecas e livros são mantidos.', ['Atualizar', 'Cancelar']);
      if (ok !== 0) return;
      btnGo.disabled = true; btnCheck.disabled = true; bar.style.display = '';
      status.textContent = 'Iniciando o download…'; status.className = 'small';
      addLog(`Atualização para a ${found.version} iniciada.`);
      const r = await api.updateInstall();
      if (!r || r.error) { status.textContent = '✕ ' + ((r && r.error) || 'falha no download.'); status.className = 'small bad'; btnCheck.disabled = false; btnGo.disabled = false; return; }
      status.textContent = r.portable ? `Pronto: a versão nova foi salva em ${r.file}. Feche este programa e abra o arquivo novo.` : 'Pronto: o instalador foi aberto; o programa vai fechar para concluir a instalação.';
      status.className = 'small good';
    });
    const node = el('div', { class: 'set-pane' }, [
      el('h2', { text: 'Atualização do sistema' }),
      el('p', { class: 'muted small', text: 'A cada alteração, o GitHub gera um instalador novo e o publica em Releases. Aqui o app consulta essa publicação, baixa o arquivo direto do GitHub, confere tamanho e assinatura SHA-256 e abre o instalador — tudo com o registro de cada etapa até a conclusão.' }),
      el('div', { class: 'inline wrap' }, [el('span', { class: 'small', text: 'Versão instalada: ' }), verEl]),
      el('div', { class: 'inline wrap' }, [btnCheck, btnGo]),
      bar, status,
      el('h3', { text: 'Registro' }),
      updLog,
      el('h3', { text: 'Notas da versão publicada' }),
      notes
    ]);
    updState = { node, check };
    setTimeout(check, 50);
    return node;
  }

  // ---------------------------------------------------------------- manuais
  const SEC = [['what', 'Para que serve'], ['where', 'Onde fica'], ['how', 'Como usar'], ['inside', 'Como funciona'], ['behaves', 'Como se comporta'], ['limits', 'Quando não se comporta / limites']];
  function manualCard(m, cat) {
    return el('article', { class: 'man-card' }, [
      el('h3', {}, [el('span', { class: 'man-cat', text: (cat.icon || '') + ' ' + cat.name }), el('br'), m.title]),
      ...SEC.map(([k, label]) => {
        const v = m[k];
        if (!v || (Array.isArray(v) && !v.length)) return null;
        return el('section', { class: 'man-sec man-' + k }, [
          el('h4', { text: label }),
          Array.isArray(v) ? el(k === 'how' ? 'ol' : 'ul', {}, v.map(x => el('li', { text: x }))) : el('p', { text: v })
        ]);
      })
    ]);
  }
  function manualsPane(catId, query) {
    const C = (App.manuals && App.manuals.CATS) || [];
    const q = String(query || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const search = el('input', { type: 'search', class: 'man-search', placeholder: 'Buscar nos manuais (ex.: lombada, OCR, marcador, sumário)…', value: query || '' });
    let tmr = null;
    search.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => show('manuals:' + (catId || ''), search.value), 250); });
    const list = el('div', { class: 'man-list' });
    let shown = 0;
    C.forEach(cat => {
      if (catId && cat.id !== catId && !q) return;
      cat.items.forEach(m => {
        if (q && !norm([m.title, m.where, m.what, m.inside].concat(m.how, m.behaves, m.limits).join(' ')).includes(q)) return;
        list.appendChild(manualCard(m, cat));
        shown++;
      });
    });
    const cat = C.find(c => c.id === catId);
    const node = el('div', { class: 'set-pane' }, [
      el('h2', { text: q ? `Busca: “${query}”` : cat ? `${cat.icon} ${cat.name}` : 'Manuais' }),
      el('p', { class: 'muted small', text: q ? `${shown} manual(is) encontrado(s).` : cat ? `${cat.items.length} manual(is) nesta categoria.` : 'Um manual para cada ferramenta: escolha a categoria à esquerda ou busque.' }),
      search,
      list
    ]);
    setTimeout(() => { if (query) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); } }, 0);
    return node;
  }

  // ---------------------------------------------------------------- tela
  function show(id, query) {
    current = id;
    body.innerHTML = '';
    if (id === 'update') body.appendChild(updatePane());
    else body.appendChild(manualsPane(id.split(':')[1] || '', query));
    body.scrollTop = 0;
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id || (id.startsWith('manuals:') && b.dataset.id === id)));
  }
  function open(where) {
    if (!screen) {
      const C = (App.manuals && App.manuals.CATS) || [];
      nav = el('nav', { class: 'set-nav' }, [
        el('b', { class: 'set-nav-h', text: 'Sistema' }),
        el('button', { 'data-id': 'update', onclick: () => show('update') }, ['⬇ Atualização']),
        el('b', { class: 'set-nav-h', text: `Manuais (${C.reduce((a, c) => a + c.items.length, 0)})` }),
        el('button', { 'data-id': 'manuals:', onclick: () => show('manuals:') }, ['📚 Todos os manuais'])
      ].concat(C.map(c => el('button', { 'data-id': 'manuals:' + c.id, onclick: () => show('manuals:' + c.id) }, [`${c.icon} ${c.name}`]))));
      body = el('div', { class: 'set-body' });
      screen = el('div', { class: 'enh-screen set-screen' }, [
        el('header', { class: 'enh-head' }, [
          el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('gear') : '' }), el('div', {}, [el('h1', { text: 'Configurações' }), el('p', { class: 'muted', text: 'Atualização do aplicativo e manuais de todas as ferramentas' })])]),
          el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
        ]),
        el('main', { class: 'set-main' }, [nav, body])
      ]);
      document.body.appendChild(screen);
    }
    screen.classList.add('show');
    show(where || current || 'update');
  }

  App.settingsUi = { open, show };
})();
