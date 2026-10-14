/* global App */
// Sumário: automático (a partir dos títulos do livro e das configurações) ou manual (lista
// editável, que pode ser gerada a partir dos títulos e depois ajustada). Também o seletor de
// gênero da barra superior, que aplica a configuração pronta e guarda o gênero do livro.
(function () {
  const { el, api, D } = App;

  function roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }
  function words(n) {
    const units = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
    const teens = ['Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove'];
    const tens = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
    if (n < 1 || n > 99) return String(n);
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const t = Math.floor(n / 10), u = n % 10;
    return tens[t] + (u ? ' e ' + units[u].toLowerCase() : '');
  }
  function chapterLabel(s, n) {
    if (s.chapterNumbering === 'none') return '';
    const v = s.chapterNumbering === 'roman' ? roman(n) : s.chapterNumbering === 'words' ? words(n) : String(n);
    const label = (s.chapterLabel || '').trim();
    return label ? `${label} ${v}` : v;
  }

  // Mesma regra do montador do livro: capítulos = nível 1; T1 (h2) = 2; T2 (h3) = 3; T3 (h4) = 4
  function collect() {
    App.flush();
    const p = App.project;
    const out = [];
    let n = 0;
    p.chapters.forEach(c => {
      let label = '';
      if (c.numbered) { n += 1; label = chapterLabel(p.settings, n); }
      out.push({ target: c.id, label, title: c.title, level: 1 });
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      let k = 0;
      tpl.content.querySelectorAll('h2, h3, h4').forEach(h => {
        k += 1;
        const clone = h.cloneNode(true);
        clone.querySelectorAll('span.footnote').forEach(x => x.remove());
        const title = clone.textContent.replace(/\s+/g, ' ').trim();
        if (title) out.push({ target: h.id || `${c.id}-s${k}`, label: '', title, level: Number(h.tagName[1]) });
      });
    });
    if (p.back.bio && p.back.bio.enabled) out.push({ target: 'sobre-autor', label: '', title: p.back.bio.title || 'Sobre o autor', level: 1 });
    if (p.back.extra && p.back.extra.enabled && p.back.extra.title) out.push({ target: 'conteudo-extra', label: '', title: p.back.extra.title, level: 1 });
    return out;
  }

  function card(rerender) {
    const f = App.project.front;
    const { field, bind } = App;
    if (!Array.isArray(f.tocEntries)) f.tocEntries = [];
    const all = collect();
    const max = Math.max(1, Math.min(3, Number(f.tocLevels) || 1));
    const auto = all.filter(e => e.level <= max);
    const targets = [{ value: '', label: '(sem ligação / sem número de página)' }].concat(all.map(e => ({ value: e.target, label: `${'  '.repeat(e.level - 1)}${e.level === 1 ? '' : '↳ '}${e.label ? e.label + ' — ' : ''}${e.title}`.slice(0, 90) })));
    const generate = () => {
      f.tocEntries = auto.map(e => Object.assign({}, e, { level: Math.min(3, e.level) }));
      f.tocMode = 'manual';
      App.changed('Sumário gerado a partir dos títulos');
      rerender();
    };
    const pages = App.lastRender && App.lastRender.targetPages ? App.lastRender.targetPages : {};
    const rowsAuto = el('ol', { class: 'toc-edit auto' }, auto.map(e => el('li', { class: 'toc-l' + Math.min(3, e.level) }, [
      e.label ? el('span', { class: 'muted', text: e.label + ' · ' }) : null, e.title, pages[e.target] ? el('span', { class: 'muted', text: ` … ${pages[e.target]}` }) : null
    ])));
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= f.tocEntries.length) return; [f.tocEntries[i], f.tocEntries[j]] = [f.tocEntries[j], f.tocEntries[i]]; App.changed('Ordem do sumário'); rerender(); };
    const rowsManual = el('div', { class: 'toc-edit manual' }, f.tocEntries.map((e, i) => el('div', { class: 'toc-row' }, [
      bind(e, 'label', 'text', { placeholder: 'Rótulo', label: 'Sumário' }),
      bind(e, 'title', 'text', { placeholder: 'Título no sumário', label: 'Sumário' }),
      bind(e, 'level', 'select', { options: [{ value: 1, label: 'Nível 1' }, { value: 2, label: 'Nível 2' }, { value: 3, label: 'Nível 3' }], onChange: v => { e.level = Number(v); } }),
      bind(e, 'target', 'select', { options: targets, label: 'Ligação do sumário' }),
      el('button', { class: 'ghost', text: '↑', title: 'Subir', onclick: () => move(i, -1) }),
      el('button', { class: 'ghost', text: '↓', title: 'Descer', onclick: () => move(i, 1) }),
      el('button', { class: 'ghost', text: '✕', title: 'Remover', onclick: () => { f.tocEntries.splice(i, 1); App.changed('Entrada removida do sumário'); rerender(); } })
    ])));
    return App.card('Sumário', [
      el('label', { class: 'chk' }, [bind(f, 'toc', 'checkbox', { onChange: rerender }), ' Incluir sumário (depois da ficha catalográfica)']),
      field('Título do sumário', bind(f, 'tocTitle', 'text')),
      field('Modelo do sumário', bind(f, 'tocStyle', 'select', { options: D.TOC_STYLES.map(t => ({ value: t.key, label: `${t.label} — ${t.desc}` })), onChange: rerender })),
      f.tocStyle === 'summary' ? el('div', { class: 'field wide' }, [
        el('span', { class: 'flabel', text: 'Resumos dos capítulos (aparecem abaixo do título no sumário)' }),
        ...App.project.chapters.map(c => el('label', { class: 'field' }, [el('span', { class: 'flabel', text: c.title }), bind(c, 'summary', 'textarea', { rows: 2, placeholder: 'Uma ou duas frases sobre o capítulo', label: 'Resumo no sumário' })]))
      ]) : null,
      field('Modo', bind(f, 'tocMode', 'select', { options: [{ value: 'auto', label: 'Automático — a partir dos títulos do livro' }, { value: 'manual', label: 'Manual — lista editável' }], onChange: rerender })),
      f.tocMode !== 'manual' ? field('Títulos incluídos', bind(f, 'tocLevels', 'select', { options: [{ value: 1, label: 'Somente capítulos' }, { value: 2, label: 'Capítulos + T1 (títulos de seção)' }, { value: 3, label: 'Capítulos + T1 + T2 (subtítulos)' }], onChange: v => { f.tocLevels = Number(v); rerender(); } })) : null,
      el('div', { class: 'field wide' }, [
        el('span', { class: 'flabel', text: 'Legendas numeradas e listas (tabelas, gráficos e figuras)' }),
        el('label', { class: 'chk' }, [bind(App.project.settings, 'captionNumbering', 'checkbox', { onChange: rerender }), ' Numerar automaticamente: Tabela 1, Gráfico 1, Figura 1 (só os que têm título/legenda)']),
        App.project.settings.captionNumbering !== false ? el('div', { class: 'inline wrap' }, [
          el('label', { class: 'chk' }, [bind(f, 'listFigures', 'checkbox'), ' Lista de figuras']),
          el('label', { class: 'chk' }, [bind(f, 'listCharts', 'checkbox'), ' Lista de gráficos']),
          el('label', { class: 'chk' }, [bind(f, 'listTables', 'checkbox'), ' Lista de tabelas']),
          el('label', { class: 'chk' }, [bind(f, 'listQuadros', 'checkbox'), ' Lista de quadros'])
        ]) : null,
        el('span', { class: 'hint', text: 'As listas entram logo depois do sumário, com o número da página de cada item (e o link no PDF).' })
      ]),
      el('div', { class: 'field wide' }, [
        el('div', { class: 'inline wrap' }, [
          el('button', { text: '⟳ Gerar a partir dos títulos', title: 'Cria a lista manual com os títulos atuais (capítulos e T1/T2 conforme “Títulos incluídos”)', onclick: async () => { if (f.tocEntries.length && !(await App.confirmPreview('Gerar sumário', 'Substituir a lista manual atual pelos títulos do livro?', auto.map(e => e.title).slice(0, 30)))) return; generate(); } }),
          f.tocMode === 'manual' ? el('button', { text: '+ Entrada', onclick: () => { f.tocEntries.push({ label: '', title: 'Nova entrada', level: 1, target: '' }); App.changed('Entrada no sumário'); rerender(); } }) : null,
          f.tocMode === 'manual' ? el('button', { text: 'Voltar ao automático', onclick: () => { f.tocMode = 'auto'; App.changed('Sumário automático'); rerender(); } }) : null
        ]),
        f.tocMode === 'manual' ? (f.tocEntries.length ? rowsManual : el('p', { class: 'muted small', text: 'Lista vazia: clique em “Gerar a partir dos títulos” ou adicione entradas. Enquanto a lista estiver vazia, o sumário automático é usado.' })) : rowsAuto
      ])
    ], 'Os números de página são preenchidos sozinhos depois da paginação. No modo manual, escolha a “ligação” de cada entrada para que ela receba o número da página e o link no PDF/EPUB.', 'span-all');
  }

  // ---------------------------------------------------------------- gênero do livro (barra superior)
  function genreSelect() {
    const sel = el('select', { id: 'genreSelect', title: 'Gênero do livro: aplica fontes, tamanhos, títulos e alinhamento (justificado; poesia alinhada à esquerda)' }, [el('option', { value: '', text: 'Gênero do livro…' })].concat(Object.entries(D.GENRE_PRESETS).map(([k, p]) => el('option', { value: k, text: p.label }))));
    sel.addEventListener('change', async () => {
      const key = sel.value;
      if (!key) return;
      const ok = await applyGenre(key, true);
      if (!ok) sel.value = App.project.genre || '';
    });
    return sel;
  }
  async function applyGenre(key, ask) {
    const p = D.GENRE_PRESETS[key];
    if (!p) return false;
    if (ask) {
      const ok = await App.confirmPreview('Gênero do livro: ' + p.label, `Aplicar a configuração de “${p.label}”? Fontes, tamanhos, títulos, alinhamento e separador serão ajustados em todo o livro. O formato e as margens não mudam.`, [key === 'poesia' ? 'Texto alinhado à esquerda (poesia)' : 'Texto justificado', 'Estilos de títulos e subtítulos', 'Capitular, cabeçalho e numeração']);
      if (!ok) return false;
    }
    const s = App.project.settings;
    D.applyGenrePreset(s, key);
    if (p.separatorLibrary) {
      try { s.separatorAsset = await App.addAssetFromUrl(`app://local/assets/library/separadores/${p.separatorLibrary}.png`, { name: p.separatorLibrary, kind: 'separadores' }); s.separator = 'image'; } catch (e) { s.separator = 'line'; }
    }
    App.project.genre = key;
    App.changed('Gênero do livro: ' + p.label);
    syncGenre();
    const r = App.hooks.viewRender[App.view];
    if (r && App.view !== 'chapter') r();
    return true;
  }
  function syncGenre() { const s = document.getElementById('genreSelect'); if (s && App.project) s.value = App.project.genre || ''; }
  App.hooks.afterChange.push(syncGenre);

  App.toc = { collect, card, chapterLabel };
  App.genre = { select: genreSelect, apply: applyGenre, sync: syncGenre };
})();
