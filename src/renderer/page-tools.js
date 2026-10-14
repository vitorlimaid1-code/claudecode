/* global App */
// Ferramentas ao lado de cada página da prévia (modo "1 página por vez"): cor da página, cor do
// texto, cadeado (bloqueia o capítulo da página) e inserção de página de imagem sangrada.
// As cores podem valer só para aquela página ou para o capítulo inteiro (o app pergunta).
(function () {
  const { el, api } = App;
  const PALETTE = ['#ffffff', '#f7f3ea', '#efe6d2', '#e9e4dc', '#d9d4cc', '#bdb6aa', '#8c8577', '#5b5548', '#2f2b26', '#000000',
    '#fbe9e7', '#f4c7c0', '#e57373', '#c62828', '#7f1d1d', '#fff4d6', '#ffe08a', '#f2b632', '#b7791f', '#6b4512',
    '#e8f5e9', '#a5d6a7', '#4caf50', '#2e7d32', '#1b4d2e', '#e3f2fd', '#90caf9', '#1e88e5', '#1d4f8a', '#0d2a4a',
    '#f3e5f5', '#ce93d8', '#8e24aa', '#4a148c', '#26123d', '#e0f7fa', '#80deea', '#00838f', '#004d55', '#0b2b2e'];

  // capítulo (índice) a que pertence a página da prévia
  function chapterOfPage(pg) {
    const sec = pg.querySelector('.chapter[data-chapter]');
    if (sec) return App.project.chapters[Number(sec.dataset.chapter)] || null;
    const fb = pg.querySelector('.fullbleed');
    if (fb) {
      // página de imagem: pertence ao capítulo seguinte (abertura) ou ao anterior
      let p = pg.nextElementSibling;
      while (p && !p.querySelector('.chapter[data-chapter]')) p = p.nextElementSibling;
      if (p) return App.project.chapters[Number(p.querySelector('.chapter[data-chapter]').dataset.chapter)] || null;
    }
    return null;
  }

  function colorPicker(initial) {
    const hex = el('input', { type: 'text', class: 'hex-input', value: initial, maxlength: 7, spellcheck: 'false' });
    const pick = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(initial) ? initial : '#000000' });
    const prev = el('span', { class: 'cp-preview', style: { background: initial } });
    let value = initial;
    const set = v => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; value = v.toLowerCase(); hex.value = value; pick.value = value; prev.style.background = value; grid.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === value)); };
    hex.addEventListener('input', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map(x => x + x).join(''); set(v); });
    pick.addEventListener('input', () => set(pick.value));
    const grid = el('div', { class: 'cp-grid' }, PALETTE.map(c => el('button', { 'data-c': c, title: c, style: { background: c }, onclick: () => set(c) })));
    const box = el('div', { class: 'cp' }, [grid, el('div', { class: 'cp-row' }, [prev, el('label', { class: 'small', text: 'Código da cor ' }), hex, el('label', { class: 'small', text: ' ou escolha: ' }), pick])]);
    set(initial);
    return { box, get: () => value };
  }

  function colorDialog(pg, kind) {
    const n = Number(pg.dataset.pageNumber);
    const ch = chapterOfPage(pg);
    const ps = (App.project.pageStyles || {})[n] || {};
    const key = kind === 'bg' ? 'bg' : 'color';
    const chKey = kind === 'bg' ? 'pageColor' : 'textColor';
    const current = ps[key] || (ch && ch.style && ch.style[chKey]) || (kind === 'bg' ? (App.project.settings.pageColor || '#ffffff') : '#000000');
    const cp = colorPicker(current);
    const scope = el('div', { class: 'scope' }, [
      el('label', { class: 'chk' }, [el('input', { type: 'radio', name: 'scope', value: 'page', checked: true }), ` Somente esta página (${n})`]),
      ch ? el('label', { class: 'chk' }, [el('input', { type: 'radio', name: 'scope', value: 'chapter' }), ` O capítulo inteiro (“${ch.title}”)`]) : null
    ]);
    const title = kind === 'bg' ? 'Cor da página' : 'Cor do texto';
    App.modal({
      title: `${title} — página ${n}`,
      body: el('div', {}, [cp.box, el('h4', { text: 'Aplicar em:' }), scope,
        kind === 'bg' ? el('p', { class: 'muted small', text: 'Dica: página escura com texto branco — mude também a “Cor do texto”. A cor cobre a sangria.' }) : null]),
      buttons: [
        { label: 'Remover cor desta página', onClick: () => { if ((App.project.pageStyles || {})[n]) { delete App.project.pageStyles[n][key]; if (!Object.keys(App.project.pageStyles[n]).length) delete App.project.pageStyles[n]; } App.changed(`${title} removida (página ${n})`); } },
        { label: 'Cancelar' },
        { label: 'Aplicar', primary: true, onClick: () => {
          const where = (document.querySelector('.modal input[name="scope"]:checked') || {}).value || 'page';
          const v = cp.get();
          if (where === 'chapter' && ch) {
            if (ch.locked) { App.toast('Capítulo bloqueado: desbloqueie no cadeado para mudar a cor.'); return false; }
            ch.style = ch.style || {};
            ch.style[chKey] = v;
            App.changed(`${title} do capítulo “${ch.title}”`);
          } else {
            if (ch && ch.locked) { App.toast('Página bloqueada: desbloqueie no cadeado para mudar a cor.'); return false; }
            App.project.pageStyles = App.project.pageStyles || {};
            App.project.pageStyles[n] = Object.assign({}, App.project.pageStyles[n] || {}, { [key]: v });
            App.changed(`${title} da página ${n}`);
          }
          App.renderChapterList();
        } }
      ]
    });
  }

  function toggleLock(pg) {
    const ch = chapterOfPage(pg);
    if (!ch) return App.toast('Esta página (rosto, ficha, sumário ou páginas finais) é gerada pelo livro e não tem cadeado próprio.');
    ch.locked = !ch.locked;
    App.changed(ch.locked ? `Capítulo “${ch.title}” bloqueado` : `Capítulo “${ch.title}” desbloqueado`, { preview: false });
    App.renderChapterList();
    if (App.view === 'chapter' && App.chapterId === ch.id) App.setView('chapter', ch.id);
    App.preview.refreshTools();
    App.toast(ch.locked ? `🔒 “${ch.title}” bloqueado contra alterações acidentais.` : `🔓 “${ch.title}” desbloqueado.`);
  }

  // Página de imagem sangrada (página única) antes ou depois de um capítulo
  async function insertBleedPage(pg) {
    const chs = App.project.chapters;
    if (!chs.length) return App.toast('Crie um capítulo primeiro.');
    const near = pg ? chapterOfPage(pg) : App.chapter();
    const pos = el('select', {}, chs.flatMap((c, i) => [
      el('option', { value: `before:${i}`, text: `Antes de “${c.title}”` }),
      el('option', { value: `after:${i}`, text: `Depois de “${c.title}”` })
    ]));
    if (near) pos.value = `before:${chs.indexOf(near)}`;
    const fit = el('select', {}, [['cover', 'Preencher a página toda (corta o excesso)'], ['contain', 'Imagem inteira (pode sobrar fundo)']].map(([a, b]) => el('option', { value: a, text: b })));
    const guides = el('input', { type: 'checkbox', checked: document.getElementById('guides').checked });
    let picked = null;
    const name = el('span', { class: 'muted small', text: 'Nenhuma imagem escolhida' });
    const thumb = el('img', { class: 'mini-thumb', style: { display: 'none' } });
    const s = App.project.settings;
    App.modal({
      title: 'Inserir página de imagem (sangrada)',
      body: el('div', {}, [
        el('div', { class: 'inline' }, [el('button', { text: 'Escolher imagem do computador…', onclick: async () => { const l = await api.pickImages({ title: 'Imagem de página inteira' }); if (!l || !l.length) return; picked = l[0]; name.textContent = picked.name || 'imagem'; thumb.src = picked.dataUrl; thumb.style.display = ''; } }), thumb, name]),
        App.field('Posição', pos), App.field('Ajuste', fit),
        el('label', { class: 'chk' }, [guides, ' Mostrar as guias de corte e sangria na prévia (só para conferência)']),
        el('p', { class: 'muted small', text: `A imagem ocupa a página inteira até a sangria (${App.fmtNum(App.bleedOf ? App.bleedOf(s) : 3, 3)} mm). Ideal: ${Math.round((s.pageWidth + 6) / 25.4 * 300)} × ${Math.round((s.pageHeight + 6) / 25.4 * 300)} px (300 dpi).` })
      ]),
      buttons: [{ label: 'Cancelar' }, { label: 'Inserir', primary: true, onClick: async () => {
        if (!picked) { App.toast('Escolha a imagem.'); return false; }
        const [where, idx] = pos.value.split(':');
        const c = chs[Number(idx)];
        if (c.locked) { App.toast('Capítulo bloqueado.'); return false; }
        App.flush();
        const id = await App.addAsset(picked);
        const block = `<div class="fullbleed" data-asset="${id}" data-fit="${fit.value}"></div>`;
        if (where === 'before') {
          if (!c.openingImage || !c.openingImage.asset) c.openingImage = { asset: id, fit: fit.value };
          else if (Number(idx) > 0 && !chs[Number(idx) - 1].locked) chs[Number(idx) - 1].html += block;
          else c.html = block + c.html;
        } else c.html += block;
        App.editorChapterId = null;
        const g = document.getElementById('guides');
        if (g.checked !== guides.checked) { g.checked = guides.checked; g.dispatchEvent(new Event('change')); }
        App.changed('Página de imagem ' + (where === 'before' ? 'antes de' : 'depois de') + ` “${c.title}”`);
        if (App.view === 'chapter') App.setView('chapter', App.chapterId);
        App.toast('Página de imagem inserida. Ela aparece na prévia após a paginação.');
      } }]
    });
  }

  // Cria os botões ao lado de cada página (documento da prévia)
  // Os botões só são criados nas páginas perto da área visível (e refeitos quando o livro muda):
  // num livro grande, recriar os botões de centenas de páginas a cada atualização travava a tela.
  function attach(d) {
    d.__ptVer = (d.__ptVer || 0) + 1;
    const win = d.defaultView;
    if (!d.__ptObs && win && win.IntersectionObserver) {
      d.__ptObs = new win.IntersectionObserver(entries => entries.forEach(e => {
        e.target.__ptNear = e.isIntersecting;
        if (e.isIntersecting) { try { build(d, e.target); } catch (err) { console.error('botões da página', err); } }
      }), { rootMargin: '1500px 0px' });
    }
    d.querySelectorAll('.pagedjs_page').forEach(pg => {
      const ch = chapterOfPage(pg);
      pg.classList.toggle('locked-page', !!(ch && ch.locked));
      if (!d.__ptObs) { build(d, pg); return; }
      if (!pg.__ptObserved) { pg.__ptObserved = true; d.__ptObs.observe(pg); }
      else if (pg.__ptNear) build(d, pg);
    });
  }
  function build(d, pg) {
    if (pg.__ptVer === d.__ptVer) return;
    pg.__ptVer = d.__ptVer;
    pg.querySelectorAll(':scope > .page-tools').forEach(t => t.remove());
    {
      const n = Number(pg.dataset.pageNumber);
      const ch = chapterOfPage(pg);
      const ps = (App.project.pageStyles || {})[n] || {};
      const st = (ch && ch.style) || {};
      pg.classList.toggle('locked-page', !!(ch && ch.locked));
      const btn = (icon, title, fn, swatch, cls) => {
        const b = d.createElement('button');
        b.type = 'button';
        b.title = title;
        b.textContent = icon;
        if (cls) b.className = cls;
        if (swatch) { const sw = d.createElement('span'); sw.className = 'sw'; sw.style.background = swatch; b.appendChild(sw); }
        b.addEventListener('mousedown', e => e.stopPropagation());
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        return b;
      };
      const tools = d.createElement('div');
      tools.className = 'page-tools';
      tools.append(
        btn('🎨', 'Cor desta página (fundo)', () => colorDialog(pg, 'bg'), ps.bg || st.pageColor || App.project.settings.pageColor || '#ffffff'),
        btn('A', 'Cor do texto desta página', () => colorDialog(pg, 'color'), ps.color || st.textColor || '#000000'),
        btn(ch && ch.locked ? '🔒' : '🔓', ch ? (ch.locked ? `Desbloquear “${ch.title}”` : `Bloquear “${ch.title}” contra alterações acidentais`) : 'Página gerada pelo livro (sem cadeado)', () => toggleLock(pg), null, ch && ch.locked ? 'on' : ''),
        btn('🖼', 'Inserir página de imagem (sangrada) antes ou depois deste capítulo', () => insertBleedPage(pg)),
        btn('✎', 'Abrir este capítulo no editor', () => { if (ch) App.setView('chapter', ch.id); else App.toast('Página gerada pelo livro: edite em “Dados e páginas iniciais” ou “Páginas finais”.'); })
      );
      pg.appendChild(tools);
    }
  }

  App.pageTools = { attach, colorDialog, insertBleedPage, chapterOfPage, colorPicker };
})();
