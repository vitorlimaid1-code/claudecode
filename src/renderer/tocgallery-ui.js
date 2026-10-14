/* global App, TocThemes */
// Janela com os estilos de sumário pré-formatados: cada miniatura é uma página do livro (formato e
// margens reais, títulos dos capítulos do projeto) desenhada com o mesmo CSS do PDF.
(function () {
  const { el } = App;
  const PRE = '.ttg ';

  // regras básicas do sumário (as mesmas do livro), só dentro da janela
  const BASE = `
.ttg .ttg-page { position: relative; overflow: hidden; background: #fff; color: #111; font-family: "EB Garamond", Georgia, serif; font-size: 10.5pt; line-height: 1.35; }
.ttg .pagedjs_pagebox { position: absolute; inset: 0; }
.ttg .ttg-content { position: absolute; z-index: 1; }
.ttg .toc-heading { font-size: 17.6pt; margin: 6mm 0 10mm; font-weight: 400; }
.ttg .toc-list { list-style: none; margin: 0; padding: 0; }
.ttg .toc-list li { margin: 0 0 0.35em 0; }
.ttg .toc-list a { display: flex; align-items: baseline; color: inherit; text-decoration: none; }
.ttg .toc-label { flex: none; margin-right: 0.6em; font-variant: small-caps; letter-spacing: 0.03em; }
.ttg .toc-title { flex: 0 1 auto; max-width: 78%; }
.ttg .toc-dots { flex: 1 1 auto; border-bottom: 0.6pt dotted currentColor; margin: 0 0.4em; min-width: 1em; transform: translateY(-0.3em); opacity: 0.7; }
.ttg .toc-page { flex: none; min-width: 1.2em; text-align: right; }
.ttg .tocstyle-plain .toc-dots, .ttg .tocstyle-inline .toc-dots, .ttg .tocstyle-numleft .toc-dots { border-bottom: 0; }
.ttg .tocstyle-inline .toc-title { max-width: none; }
.ttg .tocstyle-inline .toc-dots { flex: 0 0 0.9em; }
.ttg .tocstyle-inline .toc-page { text-align: left; }
.ttg .tocstyle-numleft .toc-page { order: -2; min-width: 2.4em; text-align: left; font-weight: 700; }
.ttg .tocstyle-numleft .toc-label { order: -1; }
.ttg .tocstyle-numleft .toc-title { max-width: none; }`;

  function geometry(color) {
    const s = App.project.settings;
    const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const W = n(s.pageWidth, 140), H = n(s.pageHeight, 210);
    const g = { mt: n(s.marginTop, 20), mb: n(s.marginBottom, 22), mi: n(s.marginInner, 22), mo: n(s.marginOuter, 16), bleed: 0, color };
    g.contentH = H - g.mt - g.mb;
    g.colW = W - g.mi - g.mo;
    return { W, H, g };
  }

  function sampleEntries() {
    const chs = App.project.chapters.filter(c => c.title).slice(0, 7);
    const list = chs.length >= 3 ? chs.map(c => c.title) : ['O começo', 'A travessia', 'Sob a mesma lua', 'O rio e a ponte', 'Cartas de inverno', 'O retorno', 'Epílogo'];
    let p = 9;
    return list.map((t, i) => { const e = { label: `Capítulo ${i + 1}`, title: t, page: p }; p += 12 + ((i * 7) % 9); return e; });
  }

  function mini(t, geo, entries, f) {
    const { W, H, g } = geo;
    const base = t.base || f.tocStyle || 'dots';
    const sec = el('section', { class: `toc tocstyle-${base}${t.key !== 'none' ? ' tt-' + t.key : ''}` }, [
      el('h2', { class: 'toc-heading', text: f.tocTitle || 'Sumário' }),
      el('ul', { class: 'toc-list' }, entries.map(e => el('li', { class: 'toc-l1' }, [el('a', {}, [
        el('span', { class: 'toc-label', text: e.label }), el('span', { class: 'toc-title', text: e.title }), el('span', { class: 'toc-dots' }), el('span', { class: 'toc-page', text: String(e.page) })
      ])])))
    ]);
    const page = el('div', { class: 'ttg-page pagedjs_page pagedjs_right_page', style: `width:${W}mm; height:${H}mm;` }, [
      el('div', { class: 'pagedjs_pagebox' }, [el('div', { class: 'ttg-content', style: `top:${g.mt}mm; bottom:${g.mb}mm; left:${g.mi}mm; right:${g.mo}mm;` }, [sec])])
    ]);
    // miniatura: a página em tamanho real, reduzida
    const k = 200 / (W * 96 / 25.4);
    return el('div', { class: 'ttg-thumb', style: `width:${Math.round(W * 96 / 25.4 * k)}px; height:${Math.round(H * 96 / 25.4 * k)}px;` }, [
      el('div', { style: `transform: scale(${k.toFixed(4)}); transform-origin: 0 0;` }, [page])
    ]);
  }

  function open() {
    const T = window.TocThemes;
    const f = App.project.front;
    let color = f.tocColor || T.COLORS[0];
    const style = el('style');
    const grid = el('div', { class: 'ttg' });
    const draw = () => {
      const geo = geometry(color);
      style.textContent = BASE + '\n' + T.THEMES.map(t => T.css(t.key, geo.g, PRE)).join('\n');
      const entries = sampleEntries();
      grid.replaceChildren(...['Tipografia', 'Moldura', 'Imersiva'].map(gr => el('div', { class: 'ttg-group' }, [
        el('h3', { text: gr === 'Tipografia' ? 'Fontes e espaçamentos' : gr === 'Moldura' ? 'Com moldura' : 'Imersivos (até o corte, com sangria)' }),
        el('div', { class: 'ttg-grid' }, T.THEMES.filter(t => t.group === gr).map(t => el('button', {
          class: 'ttg-card' + ((f.tocTheme || 'none') === t.key ? ' on' : ''),
          title: t.desc,
          onclick: () => {
            f.tocTheme = t.key;
            if (t.base) f.tocStyle = t.base;
            f.tocColor = color;
            if (!f.toc) f.toc = true;
            App.changed('Estilo do sumário: ' + t.label);
            draw();
          }
        }, [mini(t, geo, entries, f), el('strong', { text: t.label }), el('span', { class: 'small muted', text: t.desc + (t.font ? ` · ${t.font}` : '') })])))
      ])));
    };
    const swatches = el('div', { class: 'ttg-colors' }, [el('span', { class: 'flabel', text: 'Cor das faixas e molduras' }),
      ...T.COLORS.map(c => el('button', { class: 'ttg-sw', style: `background:${c}`, title: c, onclick: () => { color = c; f.tocColor = c; App.changed('Cor do sumário'); swatches.querySelectorAll('.ttg-sw').forEach(b => b.classList.toggle('on', b.title === c)); draw(); } })),
      (() => { const i = el('input', { type: 'color', value: color, title: 'Outra cor' }); i.addEventListener('change', () => { color = i.value; f.tocColor = color; App.changed('Cor do sumário'); draw(); }); return i; })()
    ]);
    swatches.querySelectorAll('.ttg-sw').forEach(b => b.classList.toggle('on', b.title === color));
    draw();
    const box = App.modal({
      title: 'Estilos de sumário',
      wide: true,
      body: el('div', {}, [
        style,
        el('p', { class: 'small muted', text: 'Clique num estilo para aplicá-lo ao sumário do livro (a prévia atualiza sozinha). As miniaturas usam o formato, as margens e os capítulos do seu livro. Os imersivos chegam até o corte da página, com sangria na exportação.' }),
        swatches,
        grid
      ]),
      buttons: [{ label: 'Fechar', primary: true }],
      onClose: () => { if (App.view && App.view !== 'chapter') setTimeout(() => App.setView(App.view), 0); }
    });
    box.classList.add('ttg-modal');
  }

  App.tocGallery = { open };
})();
