/* global App */
// Gerenciador de fontes: galeria com prévia, biblioteca do app ("instalação virtual"),
// fontes do computador, licença de incorporação e substituição de fontes ausentes.
(function () {
  const { el, $, api, D } = App;
  let tab = 'library';
  let query = '';
  let category = '';
  let onlyEmbeddable = false;
  let selected = null;
  const SPECIMEN = [
    ['Alfabeto', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz'],
    ['Números', '0123456789  ½ ¼ ¾ %  № º ª'],
    ['Acentos', 'ÁÀÂÃÄ ÉÊË ÍÎÏ ÓÔÕÖ ÚÛÜ Ç Ñ  áàâãä éêë íîï óôõö úûü ç ñ'],
    ['Pontuação e símbolos', '“ ” ‘ ’ « » — – … • ¶ § © ® ™ € $ £ ¥ & @ # * † ‡ ( ) [ ] { }'],
    ['Outros idiomas', 'Straße · Œuvre · Łódź · Ελληνικά · Русский · Čeština'],
    ['Frase', 'À noite, vovô Kowalsky vê o ímã cair no pé do pinguim queixoso e vovó põe açúcar no chá de tâmaras do jabuti feliz.']
  ];

  function famList() {
    if (tab === 'library') return App.fontFamilies.library;
    if (tab === 'bundled') return App.fontFamilies.bundled.map(f => ({ family: f, source: 'embutida', embeddable: true, styles: ['Regular', 'Regular itálico', 'Bold', 'Bold itálico'], faces: [], category: 'serifa' }));
    return App.fontFamilies.system;
  }

  App.hooks.viewRender.fonts = async function () {
    const v = $('#view-fonts');
    if (!v.dataset.ready) { v.dataset.ready = '1'; v.innerHTML = '<div class="form-wrap"><p class="muted">Procurando fontes no computador…</p></div>'; await App.refreshFonts(); }
    render();
  };

  function render() {
    const v = $('#view-fonts');
    v.innerHTML = '';
    const q = query.toLowerCase();
    const items = famList().filter(f => (!q || f.family.toLowerCase().includes(q)) && (!category || f.category === category) && (!onlyEmbeddable || f.embeddable));
    const list = el('div', { class: 'font-list' }, items.slice(0, 400).map(f => {
      const row = el('div', { class: 'font-row' + (selected === f.family ? ' active' : ''), 'data-family': f.family, onclick: () => { selected = f.family; render(); } }, [
        el('div', { class: 'font-name', text: f.family }),
        el('div', { class: 'font-sample', style: { fontFamily: `"${f.family}", sans-serif` }, text: 'Aa Bb Cc — Ação, poesia e coração' }),
        el('div', { class: 'font-meta muted small', text: `${(f.styles || []).length} estilo(s)${f.category ? ' · ' + f.category : ''}${f.embeddable === false ? ' · ⚠ não incorporável' : ''}` })
      ]);
      return row;
    }));
    if (items.length > 400) list.appendChild(el('p', { class: 'muted', text: `Mostrando 400 de ${items.length}. Refine a busca.` }));
    const tabs = el('div', { class: 'tabs' }, [['library', `Minha biblioteca (${App.fontFamilies.library.length})`], ['system', `Fontes do computador (${App.fontFamilies.system.length})`], ['bundled', `Embutidas (${App.fontFamilies.bundled.length})`]]
      .map(([k, l]) => el('button', { class: tab === k ? 'on' : '', text: l, onclick: () => { tab = k; selected = null; render(); } })));
    const search = el('input', { type: 'search', placeholder: 'Buscar por nome…', value: query, oninput: e => { query = e.target.value; clearTimeout(search._t); search._t = setTimeout(() => { render(); const s = $('#view-fonts input[type=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); } });
    const cat = el('select', { onchange: e => { category = e.target.value; render(); } }, [['', 'Todas as classificações'], ['serifa', 'Com serifa'], ['sem serifa', 'Sem serifa'], ['manuscrita', 'Manuscrita'], ['decorativa', 'Decorativa'], ['símbolos', 'Símbolos']].map(([v2, l]) => el('option', { value: v2, text: l })));
    cat.value = category;
    const emb = el('input', { type: 'checkbox', checked: onlyEmbeddable, onchange: e => { onlyEmbeddable = e.target.checked; render(); } });
    const drop = el('div', { class: 'drop-zone', text: 'Arraste arquivos .ttf, .otf, .ttc, .woff ou .woff2 aqui para adicioná-los à biblioteca' });
    drop.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async e => {
      e.preventDefault(); drop.classList.remove('over');
      const paths = Array.from(e.dataTransfer.files).map(f => api.pathForFile(f)).filter(p => /\.(ttf|otf|ttc|woff2?)$/i.test(p));
      if (!paths.length) return App.toast('Nenhum arquivo de fonte reconhecido.');
      report(await api.fontsAddPaths(paths));
    });
    v.appendChild(el('div', { class: 'form-wrap fonts-wrap' }, [
      el('h2', { text: 'Fontes' }),
      el('p', { class: 'muted', text: 'Fontes da biblioteca do aplicativo são carregadas só no Diagramador (não é preciso instalá-las no Windows) e incorporadas ao PDF. Fontes do computador podem ser usadas diretamente ou copiadas para a biblioteca para viajar com o app portátil.' }),
      el('div', { class: 'inline wrap' }, [
        el('button', { class: 'primary', text: '+ Adicionar arquivos de fonte…', onclick: async () => report(await api.fontsAddDialog()) }),
        el('button', { text: '↻ Procurar novamente no computador', onclick: async () => { await App.refreshFonts(true); render(); App.toast('Lista de fontes atualizada.'); } }),
        el('button', { text: 'Verificar fontes do livro', onclick: () => App.fontsUi.checkMissing(true) })
      ]),
      drop,
      tabs,
      el('div', { class: 'inline wrap' }, [search, cat, el('label', { class: 'chk' }, [emb, ' Somente incorporáveis no PDF'])]),
      el('div', { class: 'fonts-split' }, [list, detail()])
    ]));
    // carrega as fontes visíveis sob demanda
    const io = new IntersectionObserver(entries => {
      const fams = entries.filter(x => x.isIntersecting).map(x => x.target.dataset.family);
      if (fams.length) App.ensureFonts(fams);
    }, { root: list });
    list.querySelectorAll('.font-row').forEach(r => io.observe(r));
  }

  function report(res) {
    if (!res) return;
    const fams = [...new Set((res.added || []).map(a => a.family))];
    App.toast(fams.length ? `Adicionada(s): ${fams.join(', ')}` : 'Nenhuma fonte adicionada.', 4000);
    if (res.skipped && res.skipped.length) App.toast(`Ignorado(s): ${res.skipped.map(s => App.fileName(s.file)).join(', ')} (arquivo inválido)`, 5000);
    App.refreshFonts().then(() => { tab = 'library'; render(); });
  }

  function detail() {
    if (!selected) return el('div', { class: 'font-detail muted', text: 'Selecione uma fonte para ver a prévia completa, os estilos disponíveis e a licença de incorporação.' });
    const f = famList().find(x => x.family === selected) || {};
    App.ensureFonts([selected]);
    const st = App.project.settings.styles;
    const roleSel = el('select', {}, D.STYLE_DEFS.map(d => el('option', { value: d.key, text: d.label })));
    return el('div', { class: 'font-detail' }, [
      el('h3', { text: selected, style: { fontFamily: `"${selected}"` } }),
      el('div', { class: 'muted small', text: `Origem: ${f.source || ''}${f.category ? ' · ' + f.category : ''}` }),
      el('div', { class: 'small ' + (f.embeddable === false ? 'bad' : 'good'), text: f.embeddable === false ? '⚠ A licença desta fonte não permite incorporação no PDF. Escolha outra fonte para o livro impresso.' : '✓ Pode ser incorporada ao PDF.' }),
      el('div', { class: 'font-styles' }, (f.faces && f.faces.length ? f.faces : (f.styles || []).map(s => ({ label: s }))).map(face => el('span', {
        class: 'chip', style: face.weight ? { fontFamily: `"${selected}"`, fontWeight: face.weight, fontStyle: face.italic ? 'italic' : 'normal' } : { fontFamily: `"${selected}"` },
        text: face.label || `${face.weight} ${face.italic ? 'itálico' : ''} — ${face.embedding || ''}`
      }))),
      f.faces && f.faces.length && !f.faces.some(x => x.italic) ? el('p', { class: 'warn small', text: 'Esta família não tem itálico real: o itálico não será simulado (o texto aparece em redondo).' }) : null,
      f.faces && f.faces.length && !f.faces.some(x => x.weight >= 600) ? el('p', { class: 'warn small', text: 'Esta família não tem negrito real: o negrito não será simulado.' }) : null,
      el('div', { class: 'specimen', style: { fontFamily: `"${selected}", serif` } }, SPECIMEN.map(([t, s]) => el('div', {}, [el('div', { class: 'muted small spec-label', text: t }), el('div', { class: 'spec-text', text: s })]))),
      el('div', { class: 'inline wrap' }, [
        tab === 'system' ? el('button', { class: 'primary', text: 'Adicionar à minha biblioteca', onclick: async () => report(await api.fontsAddFromSystem(selected)) }) : null,
        tab === 'library' ? el('button', { class: 'danger', text: 'Remover da biblioteca', onclick: async () => { const ok = await App.confirmPreview('Remover fonte', `Remover “${selected}” da biblioteca do aplicativo? Livros que a usam passarão a pedir substituição.`, [selected], 'Remover'); if (!ok) return; await api.fontsRemove(selected); await App.refreshFonts(); selected = null; render(); } }) : null
      ]),
      el('div', { class: 'inline wrap' }, [
        el('button', { text: 'Usar no texto principal', onclick: () => { st.body.font = selected; App.changed('Fonte do texto: ' + selected); App.toast('Fonte aplicada ao texto principal.'); } }),
        el('button', { text: 'Usar nos títulos', onclick: () => { ['chapterTitle', 'chapterLabel', 'h2', 'h3', 'h4'].forEach(k => { st[k].font = selected; }); App.changed('Fonte dos títulos: ' + selected); App.toast('Fonte aplicada aos títulos.'); } }),
        roleSel,
        el('button', { text: 'Usar neste estilo', onclick: () => { st[roleSel.value].font = selected; App.changed('Fonte do estilo'); App.toast('Fonte aplicada.'); } })
      ])
    ]);
  }

  // Fontes usadas pelo livro que não existem neste computador
  async function checkMissing(verbose) {
    await App.refreshFonts();
    const avail = App.allFontNames();
    const p = App.project;
    const used = new Map();
    const note = (fam, where) => { if (fam && !avail.has(fam)) { if (!used.has(fam)) used.set(fam, []); used.get(fam).push(where); } };
    Object.entries(p.settings.styles).forEach(([k, st]) => note(st.font, 'Estilo ' + ((D.STYLE_DEFS.find(d => d.key === k) || {}).label || k)));
    p.chapters.forEach(c => { note(c.style.font, c.title); note(c.style.titleFont, c.title + ' (título)'); });
    (p.overlays || []).forEach(o => note(o.font, 'Camada ' + o.name));
    if (!used.size) { if (verbose) App.toast('Todas as fontes do livro estão disponíveis.'); return; }
    const selects = {};
    const body = el('div', {}, [
      el('p', { text: 'Estas fontes não foram encontradas neste computador. Sem substituição, o texto seria mostrado em outra fonte, o que pode mudar a paginação e a quantidade de páginas. Escolha uma alternativa para cada uma:' }),
      el('div', { class: 'grid' }, [...used.entries()].map(([fam, where]) => {
        const s = el('select');
        App.fontOptions(false).forEach(o => { const g = el('optgroup', { label: o.group }); o.items.forEach(it => g.appendChild(el('option', { value: it.value, text: it.label }))); s.appendChild(g); });
        s.value = 'EB Garamond';
        selects[fam] = s;
        return App.field(`“${fam}” → `, s, 'Usada em: ' + where.slice(0, 4).join(', ') + (where.length > 4 ? '…' : ''));
      }))
    ]);
    App.modal({
      title: 'Fontes ausentes', body, wide: true,
      buttons: [{ label: 'Manter (resolver depois)' }, { label: 'Substituir e registrar', primary: true, onClick: () => {
        const log = p.fontSubstitutions || (p.fontSubstitutions = []);
        Object.entries(selects).forEach(([from, s]) => {
          const to = s.value;
          Object.values(p.settings.styles).forEach(st => { if (st.font === from) st.font = to; });
          p.chapters.forEach(c => { if (c.style.font === from) c.style.font = to; if (c.style.titleFont === from) c.style.titleFont = to; });
          (p.overlays || []).forEach(o => { if (o.font === from) o.font = to; });
          log.push({ from, to, date: new Date().toISOString() });
        });
        App.changed('Substituição de fontes ausentes');
        App.toast('Fontes substituídas. A substituição ficou registrada no projeto.');
      } }]
    });
  }

  App.fontsUi = { checkMissing };
})();
