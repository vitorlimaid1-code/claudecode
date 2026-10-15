/* global App */
// Configurações: versão instalada e atualização pelo GitHub (a versão nova é baixada e instalada por cima,
// mantendo configurações, bibliotecas e livros).
(function () {
  const { el, api } = App;

  function open() {
    const verEl = el('strong', { text: '…' });
    api.appInfo().then(i => { verEl.textContent = (i && i.version) || '—'; }).catch(() => {});
    const status = el('p', { class: 'small', text: 'Clique em “Procurar atualização” para comparar com a versão publicada no GitHub.' });
    const bar = el('div', { class: 'upd-bar' }, [el('i')]);
    bar.style.display = 'none';
    const notes = el('div', { class: 'upd-notes small muted' });
    const btnCheck = el('button', { text: 'Procurar atualização' });
    const btnGo = el('button', { class: 'primary', text: 'Atualizar agora' });
    btnGo.disabled = true;
    let found = null;
    const check = async () => {
      btnCheck.disabled = true; status.textContent = 'Procurando a versão mais recente no GitHub…'; status.className = 'small';
      const r = await api.updateCheck();
      btnCheck.disabled = false;
      if (!r || r.error) { status.textContent = '✕ ' + ((r && r.error) || 'não foi possível consultar o GitHub.'); status.className = 'small bad'; return; }
      found = r;
      notes.textContent = r.notes ? r.notes.slice(0, 900) : '';
      if (r.newer) { status.textContent = `Nova versão disponível: ${r.version} (você tem a ${r.current}).`; status.className = 'small good'; btnGo.disabled = false; }
      else { status.textContent = `Você já está na versão mais recente (${r.current}).`; status.className = 'small good'; btnGo.disabled = true; }
    };
    btnCheck.addEventListener('click', check);
    btnGo.addEventListener('click', async () => {
      if (!found || !found.newer) return;
      const ok = await api.confirm(`Atualizar para a versão ${found.version}?`, App.dirty ? 'Há alterações não salvas: salve o livro antes (Ctrl+S). O instalador novo será baixado e aberto.' : 'O instalador novo será baixado e aberto.'+'  Configurações, bibliotecas e livros são mantidos.', ['Atualizar', 'Cancelar']);
      if (ok !== 0) return;
      btnGo.disabled = true; btnCheck.disabled = true; bar.style.display = '';
      status.textContent = 'Baixando…'; status.className = 'small';
      const off = api.onUpdateProgress ? api.onUpdateProgress(p => { bar.firstChild.style.width = Math.round(p.ratio * 100) + '%'; status.textContent = `Baixando… ${Math.round(p.ratio * 100)}% (${(p.received / 1048576).toFixed(1)} de ${(p.total / 1048576).toFixed(1)} MB)`; }) : null;
      const r = await api.updateInstall();
      if (off) off();
      if (!r || r.error) { status.textContent = '✕ ' + ((r && r.error) || 'falha no download.'); status.className = 'small bad'; btnCheck.disabled = false; btnGo.disabled = false; return; }
      status.textContent = r.portable ? `Pronto: a versão nova foi salva em ${r.file}. Feche este programa e abra o arquivo novo.` : 'Pronto: o instalador foi aberto; o programa vai fechar para concluir a instalação.';
      status.className = 'small good';
    });
    App.modal({
      title: 'Configurações',
      body: el('div', { class: 'settings-modal' }, [
        el('h3', { text: 'Atualização do sistema' }),
        el('p', { class: 'small muted', text: 'Sempre que o sistema é alterado, o GitHub gera um instalador novo. Aqui você confere e instala a versão mais recente sem precisar baixar nada à mão.' }),
        el('div', { class: 'inline wrap' }, [el('span', { class: 'small', text: 'Versão instalada: ' }), verEl]),
        el('div', { class: 'inline wrap' }, [btnCheck, btnGo]),
        bar, status, notes
      ]),
      buttons: [{ label: 'Fechar' }]
    });
    check();
  }

  App.settingsUi = { open };
})();
