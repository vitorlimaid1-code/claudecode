/* global App */
// Módulo Amazon KDP: brochura (paperback) e capa dura (hardcover). Escolhe o tamanho de corte
// da lista do KDP, valida o número de páginas, calcula a margem interna mínima pelo número de
// páginas, a sangria de 0,125 pol. e a lombada; aplica tudo ao livro e envia as medidas à capa.
// Os valores seguem as regras publicadas pelo KDP — confira sempre a página oficial antes de publicar.
(function () {
  const { el, $, D } = App;
  const K = D.KDP;
  const IN = 25.4;
  const fmtIn = v => String(+v.toFixed(3)).replace('.', ',');
  const PAPERS = {
    paperback: [['white', 'Preto e branco — papel branco'], ['cream', 'Preto e branco — papel creme'], ['colorStd', 'Colorido padrão — papel branco'], ['color', 'Colorido premium — papel branco']],
    hardcover: [['white', 'Preto e branco — papel branco'], ['cream', 'Preto e branco — papel creme'], ['color', 'Colorido premium — papel branco']]
  };
  const COVER_PAPER = { white: 'kdpWhite', colorStd: 'kdpWhite', cream: 'kdpCream', color: 'kdpColor' };

  function state() {
    const s = App.project.settings;
    if (!s.kdp) s.kdp = {};
    const k = s.kdp;
    if (!k.binding) k.binding = 'paperback';
    if (!k.paper) k.paper = 'white';
    if (k.size == null) k.size = 4; // 6 × 9 pol.
    if (k.bleed == null) k.bleed = false;
    return k;
  }
  function pages() { let p = App.lastRender ? App.lastRender.pages : 0; if (p % 2) p += 1; return p; }
  function gutterIn(n) { for (const [max, v] of K.gutter) if (n <= max) return v; return K.gutter[K.gutter.length - 1][1]; }

  function calc() {
    const k = state();
    const sizes = K[k.binding];
    const size = sizes[Math.min(k.size, sizes.length - 1)];
    const n = pages();
    const lim = K.limits[k.binding][k.paper] || K.limits[k.binding].white;
    const perPage = (K.paper[k.paper] || K.paper.white).in;
    const spineIn = n * perPage;
    const bleedIn = k.bleed ? K.bleedIn : 0;
    const gIn = gutterIn(n);
    const outIn = k.bleed ? K.outsideBleedIn : K.outsideNoBleedIn;
    // capa: brochura = sangria 0,125 em volta; capa dura = dobra (wrap) de 0,51 pol. em volta
    const wrapIn = k.binding === 'hardcover' ? 0.51 : 0;
    const cBleed = k.binding === 'hardcover' ? 0 : K.bleedIn;
    const coverW = 2 * (cBleed + wrapIn) + 2 * size.win + spineIn;
    const coverH = size.hin + 2 * (cBleed + wrapIn);
    return { k, size, n, lim, perPage, spineIn, bleedIn, gIn, outIn, wrapIn, cBleed, coverW, coverH, spineText: n > K.spineTextMinPages };
  }

  function check(cond, ok, bad) { return el('li', { class: cond ? 'good' : 'bad', text: (cond ? '✓ ' : '✗ ') + (cond ? ok : bad) }); }

  async function applyToBook() {
    const c = calc();
    const s = App.project.settings;
    const W = +(c.size.win * IN).toFixed(2), H = +(c.size.hin * IN).toFixed(2);
    const inner = Math.max(s.marginInner, +(c.gIn * IN + 3).toFixed(1));
    const outer = Math.max(s.marginOuter, +(c.outIn * IN + 3).toFixed(1));
    const top = Math.max(s.marginTop, +(c.outIn * IN + 3).toFixed(1));
    const bottom = Math.max(s.marginBottom, +(c.outIn * IN + 3).toFixed(1));
    const ok = await App.confirmPreview('Aplicar ao livro (Amazon KDP)', 'O livro passará a usar:', [
      `Formato: ${fmtIn(c.size.win)} × ${fmtIn(c.size.hin)} pol. (${App.fmtNum(W)} × ${App.fmtNum(H)} mm) — ${c.k.binding === 'hardcover' ? 'capa dura' : 'brochura'}`,
      `Margem interna: ${App.fmtNum(inner)} mm (mínimo do KDP para ${c.n || '…'} páginas: ${fmtIn(c.gIn)} pol. = ${App.fmtNum(c.gIn * IN)} mm)`,
      `Margens externa/superior/inferior: ${App.fmtNum(outer)} / ${App.fmtNum(top)} / ${App.fmtNum(bottom)} mm (mínimo ${fmtIn(c.outIn)} pol.)`,
      c.k.bleed ? 'Sangria: 0,125 pol. (3,175 mm) em cima, embaixo e na borda externa' : 'Sem sangria (nenhuma imagem ou fundo até a borda)'
    ]);
    if (!ok) return;
    const fmt = D.PAGE_FORMATS.find(f => f.group === 'Amazon KDP (polegadas)' && Math.abs(f.width - W) < 0.3 && Math.abs(f.height - H) < 0.3);
    s.pageFormat = fmt ? fmt.id : 'custom';
    s.pageWidth = W; s.pageHeight = H;
    s.marginInner = inner; s.marginOuter = outer; s.marginTop = top; s.marginBottom = bottom;
    s.kdp.enabled = true;
    if (c.k.bleed) { s.bleedAuto = true; } else { s.bleedAuto = false; s.bleedTop = s.bleedBottom = s.bleedOuter = 0; }
    s.cropMarks = false;
    App.changed('Formato Amazon KDP aplicado');
    App.toast('Formato KDP aplicado. A paginação foi refeita; confira a margem interna após a contagem final de páginas.', 5000);
    render();
  }

  function sendToCover() {
    const c = calc();
    const cv = App.cover.ensure();
    cv.source = 'book';
    cv.confirmed = null;
    cv.totalsManual = false;
    cv.spineMode = 'auto';
    cv.paper = COVER_PAPER[c.k.paper] || 'kdpWhite';
    cv.bleedAuto = c.k.binding !== 'hardcover';
    cv.hardcover = c.k.binding === 'hardcover';
    if (cv.hardcover) { cv.bleed = 0; cv.wrapExtra = +(c.wrapIn * IN).toFixed(2); cv.boardExtra = 0; }
    cv.trimW = +(c.size.win * IN).toFixed(2); cv.trimH = +(c.size.hin * IN).toFixed(2);
    if (c.n) cv.pages = c.n;
    cv.profile = 'gracol';
    cv.flaps = 0;
    App.changed('Medidas KDP enviadas para a capa', { preview: false });
    App.setView('cover');
  }

  function render() {
    const v = $('#view-kdp');
    if (!v) return;
    v.innerHTML = '';
    const c = calc();
    const k = c.k;
    const s = App.project.settings;
    const rer = () => { App.changed(null, { preview: false }); render(); };
    const binding = el('div', { class: 'kdp-seg' }, [['paperback', 'Brochura (paperback)'], ['hardcover', 'Capa dura (hardcover)']].map(([v2, l]) => el('button', { class: k.binding === v2 ? 'on' : '', text: l, onclick: () => { k.binding = v2; k.size = Math.min(k.size, K[v2].length - 1); if (!PAPERS[v2].some(p => p[0] === k.paper)) k.paper = 'white'; rer(); } })));
    const sizeGrid = el('div', { class: 'kdp-sizes' }, K[k.binding].map((sz, i) => el('button', { class: 'kdp-size' + (i === k.size ? ' on' : ''), onclick: () => { k.size = i; rer(); } }, [
      el('span', { class: 'kdp-shape', style: `width:${sz.win * 5}px;height:${sz.hin * 5}px` }),
      el('strong', { text: `${fmtIn(sz.win)} × ${fmtIn(sz.hin)} pol.` }),
      el('span', { class: 'small muted', text: `${App.fmtNum(sz.width / 10)} × ${App.fmtNum(sz.height / 10)} cm` })
    ])));
    const paper = el('select', { onchange: e => { k.paper = e.target.value; rer(); } }, PAPERS[k.binding].map(([v2, l]) => el('option', { value: v2, text: l })));
    paper.value = k.paper;
    const bleedSel = el('select', { onchange: e => { k.bleed = e.target.value === '1'; rer(); } }, [['0', 'Sem sangria (só texto e imagens dentro das margens)'], ['1', 'Com sangria — imagens ou fundos até a borda (0,125 pol.)']].map(([v2, l]) => el('option', { value: v2, text: l })));
    bleedSel.value = k.bleed ? '1' : '0';
    const W = c.size.win * IN, H = c.size.hin * IN;
    const applied = Math.abs(s.pageWidth - W) < 0.3 && Math.abs(s.pageHeight - H) < 0.3;
    const pdfW = c.size.win + (k.bleed ? K.bleedIn : 0), pdfH = c.size.hin + (k.bleed ? 2 * K.bleedIn : 0);
    const minInner = c.gIn * IN, minOut = c.outIn * IN;
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Amazon KDP — brochura e capa dura' }),
      el('p', { class: 'muted', text: 'Escolha o acabamento, o tamanho e o papel. O módulo confere o número de páginas, calcula a margem interna mínima, a sangria e a lombada, aplica ao livro e envia as medidas para a capa.' }),
      App.card('Acabamento', [binding, App.field('Papel e tinta', paper), App.field('Sangria do miolo', bleedSel)], k.binding === 'hardcover' ? 'Capa dura do KDP: de 75 a 550 páginas, nos 5 tamanhos abaixo.' : 'Brochura do KDP: 16 tamanhos de corte.', 'span-all'),
      App.card('Tamanho de corte', [sizeGrid], '', 'span-all'),
      App.card('Conferência', [
        el('ul', { class: 'kdp-checks' }, [
          c.n ? check(c.n >= c.lim[0] && c.n <= c.lim[1], `${c.n} páginas — dentro do limite (${c.lim[0]} a ${c.lim[1]})`, `${c.n} páginas — fora do limite do KDP para esta opção (${c.lim[0]} a ${c.lim[1]})`) : el('li', { class: 'muted', text: 'Aguardando a paginação…' }),
          check(applied, 'O livro já está neste formato', `O livro está em ${App.fmtNum(s.pageWidth)} × ${App.fmtNum(s.pageHeight)} mm — clique em “Aplicar ao livro”`),
          check(s.marginInner >= minInner - 0.05, `Margem interna ${App.fmtNum(s.marginInner)} mm (mínimo ${App.fmtNum(minInner)} mm = ${fmtIn(c.gIn)} pol.)`, `Margem interna ${App.fmtNum(s.marginInner)} mm abaixo do mínimo de ${App.fmtNum(minInner)} mm (${fmtIn(c.gIn)} pol.) para ${c.n} páginas`),
          check(Math.min(s.marginOuter, s.marginTop, s.marginBottom) >= minOut - 0.05, `Margens externas ≥ ${App.fmtNum(minOut)} mm (${fmtIn(c.outIn)} pol.)`, `Alguma margem externa está abaixo de ${App.fmtNum(minOut)} mm (${fmtIn(c.outIn)} pol.)`),
          check(k.bleed ? App.bleedOf(s) >= 3.17 : App.bleedOf(s) === 0, k.bleed ? 'Sangria de 0,125 pol. ativa' : 'Sem sangria no PDF do miolo', k.bleed ? 'Ative a sangria (Aplicar ao livro)' : 'O livro está com sangria; o KDP sem sangria exige o PDF no tamanho exato (Aplicar ao livro)'),
          el('li', { class: c.spineText ? 'good' : 'warn', text: c.spineText ? `✓ Texto na lombada permitido (mais de ${K.spineTextMinPages} páginas)` : `⚠ Com ${c.n || '…'} páginas o KDP não permite texto na lombada (é preciso mais de ${K.spineTextMinPages})` })
        ])
      ], '', 'span-all'),
      App.card('Medidas para o KDP', [
        el('table', { class: 'kdp-table' }, [
          ['Formato de corte', `${fmtIn(c.size.win)} × ${fmtIn(c.size.hin)} pol. · ${App.fmtNum(W)} × ${App.fmtNum(H)} mm`],
          ['PDF do miolo (página)', `${fmtIn(pdfW)} × ${fmtIn(pdfH)} pol. · ${App.fmtNum(pdfW * IN)} × ${App.fmtNum(pdfH * IN)} mm${k.bleed ? ' (com sangria)' : ''}`],
          ['Margem interna mínima', `${fmtIn(c.gIn)} pol. · ${App.fmtNum(minInner)} mm`],
          ['Margem externa mínima', `${fmtIn(c.outIn)} pol. · ${App.fmtNum(minOut)} mm`],
          ['Lombada', c.n ? `${fmtIn(c.spineIn)} pol. · ${App.fmtNum(c.spineIn * IN)} mm (${c.n} pág. × ${c.perPage} pol.)` : '—'],
          ['Capa aberta (com ' + (k.binding === 'hardcover' ? 'dobra de 0,51 pol.' : 'sangria de 0,125 pol.') + ')', c.n ? `${fmtIn(c.coverW)} × ${fmtIn(c.coverH)} pol. · ${App.fmtNum(c.coverW * IN)} × ${App.fmtNum(c.coverH * IN)} mm` : '—']
        ].map(([a, b]) => el('tr', {}, [el('th', { text: a }), el('td', { text: b })]))),
        k.binding === 'hardcover' ? el('p', { class: 'warn small', text: '⚠ Capa dura: o KDP calcula a lombada e a área de dobradiça pelo seu gabarito. Baixe o gabarito na calculadora de capa do KDP e confira as medidas antes de enviar.' }) : null
      ], 'Fonte: regras de formatação do KDP (tamanhos, margens por número de páginas, sangria de 0,125 pol. e espessura do papel). Confirme na página oficial antes de publicar.', 'span-all'),
      el('div', { class: 'actions-row' }, [
        el('button', { class: 'primary big', text: 'Aplicar ao livro', onclick: applyToBook }),
        el('button', { text: 'Enviar medidas para a capa →', onclick: sendToCover }),
        el('button', { text: 'Exportar com o perfil KDP', onclick: () => { App.setView('export'); } })
      ])
    ]));
  }

  App.hooks.viewRender.kdp = render;
  App.hooks.afterChange.push(o => { if (o && o.rendered && App.view === 'kdp') render(); });
  App.kdp = { calc, render };
})();
