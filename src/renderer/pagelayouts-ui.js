/* global App */
// Composições de página (revista e jornal): modelos de distribuição de texto e imagens, como nas revistas
// de verdade. Um clique aplica na matéria escolhida: número de colunas, blocos de imagem (cinza, com “+”),
// frase em destaque tirada do próprio texto, box lateral e o estilo do título. O texto da matéria fica
// intacto; os blocos e caixas de uma composição anterior são trocados pelos da nova.
(function () {
  const { el, $ } = App;
  const LAYOUTS = [
    { key: 'classica', name: 'Clássica', desc: '3 colunas, foto horizontal na abertura e frase em destaque no meio', cols: 3, items: [['h', 0.08], ['band', 0.5]] },
    { key: 'hero', name: 'Foto principal', desc: 'Foto grande no alto, título forte e texto em 2 colunas', cols: 2, items: [['hero', 0]] },
    { key: 'retrato', name: 'Retratos', desc: '2 colunas com duas fotos verticais ao longo do texto', cols: 2, items: [['v', 0.15], ['v', 0.62]] },
    { key: 'citacao', name: 'Citação em destaque', desc: '3 colunas com frase grande atravessando a página e foto embaixo', cols: 3, items: [['band', 0.25], ['h', 0.7]] },
    { key: 'lateral', name: 'Box lateral', desc: '2 colunas com box “Saiba mais” e foto horizontal', cols: 2, items: [['side', 0.1], ['h', 0.55]] },
    { key: 'entrevista', name: 'Entrevista', desc: 'Retrato do entrevistado, frase de destaque e título em caixa preta', cols: 2, items: [['v', 0.04], ['band', 0.45]], titleBox: { style: 'black', align: 'left' } },
    { key: 'jornal', name: 'Notícia de jornal', desc: '4 colunas, foto no alto, título grosso com fio', cols: 4, items: [['h', 0], ['v', 0.6]] },
    { key: 'ensaio', name: 'Ensaio', desc: '1 coluna larga, título centralizado, foto e citação lateral', cols: 1, items: [['h', 0.3], ['qleft', 0.62]] },
    { key: 'galeria', name: 'Galeria de fotos', desc: 'Foto principal e mais duas fotos, texto em 3 colunas', cols: 3, items: [['hero', 0], ['h', 0.4], ['h', 0.78]] },
    { key: 'abertura', name: 'Abertura impactante', desc: 'Foto principal, título enorme centralizado e destaque', cols: 2, items: [['hero', 0], ['band', 0.6]], titleBox: { style: 'none', align: 'center' } }
  ];

  // ------------------------------------------------------------ miniatura (desenho da página)
  function thumb(L) {
    const W = 100, H = 138, top = 26, bot = 132;
    const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`];
    const center = L.key === 'abertura' || L.key === 'ensaio';
    // título
    const tb = L.titleBox && L.titleBox.style === 'black';
    if (tb) parts.push(`<rect x="8" y="9" width="48" height="9" fill="#111"/>`);
    else parts.push(`<rect x="${center ? 18 : 8}" y="${L.key === 'jornal' ? 8 : 10}" width="${center ? 64 : 56}" height="${L.key === 'abertura' ? 10 : 7}" rx="1" fill="#2d2d33"/>`);
    parts.push(`<rect x="${center ? 28 : 8}" y="21" width="${center ? 44 : 38}" height="2" fill="#b7b7bf"/>`);
    if (L.key === 'jornal') parts.push(`<rect x="8" y="24" width="84" height="0.8" fill="#222"/>`);
    // colunas de texto
    const n = L.cols, gx = 3, x0 = L.key === 'ensaio' ? 16 : 8, x1 = L.key === 'ensaio' ? 84 : 92, cw = (x1 - x0 - gx * (n - 1)) / n;
    const lines = [];
    for (let c = 0; c < n; c++) for (let y = top + 2; y < bot; y += 3.2) lines.push(`<rect x="${(x0 + c * (cw + gx)).toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="1.3" fill="#d4d4da"/>`);
    parts.push(lines.join(''));
    // elementos por cima (com fundo branco “cortando” o texto)
    let heroH = 0;
    L.items.forEach(([t, at]) => {
      const y = top + (bot - top) * at;
      if (t === 'hero') { heroH = 40; parts.push(`<rect x="${x0}" y="${top}" width="${x1 - x0}" height="40" fill="#fff"/><rect x="${x0}" y="${top + 1}" width="${x1 - x0}" height="36" fill="#b9b9c3"/>`); }
      else if (t === 'h') { const yy = Math.max(y, top + heroH); parts.push(`<rect x="${x0}" y="${yy}" width="${x1 - x0}" height="22" fill="#fff"/><rect x="${x0}" y="${yy + 1}" width="${x1 - x0}" height="19" fill="#c9c9d1"/>`); }
      else if (t === 'v') { const col = at > 0.5 ? n - 1 : 0; const xx = x0 + col * (cw + gx); parts.push(`<rect x="${xx}" y="${y}" width="${cw}" height="26" fill="#fff"/><rect x="${xx}" y="${y + 1}" width="${cw}" height="24" fill="#c9c9d1"/>`); }
      else if (t === 'band') parts.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="12" fill="#fff"/><rect x="${x0 + 6}" y="${y + 3}" width="${x1 - x0 - 12}" height="2.4" fill="#5b5b66"/><rect x="${x0 + 14}" y="${y + 7}" width="${x1 - x0 - 28}" height="2.4" fill="#5b5b66"/>`);
      else if (t === 'side') { const xx = x1 - cw * 0.9; parts.push(`<rect x="${xx - 2}" y="${y}" width="${cw * 0.9 + 2}" height="30" fill="#fff"/><rect x="${xx}" y="${y + 1}" width="${cw * 0.9}" height="28" fill="#f1ede4" stroke="#b5ab95" stroke-width="0.6"/>`); }
      else if (t === 'qleft') parts.push(`<rect x="${x0}" y="${y}" width="${(x1 - x0) * 0.34}" height="18" fill="#fff"/><rect x="${x0}" y="${y + 3}" width="${(x1 - x0) * 0.3}" height="2.2" fill="#5b5b66"/><rect x="${x0}" y="${y + 7}" width="${(x1 - x0) * 0.26}" height="2.2" fill="#5b5b66"/><rect x="${x0}" y="${y + 11}" width="${(x1 - x0) * 0.22}" height="2.2" fill="#5b5b66"/>`);
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }

  // ------------------------------------------------------------ aplicar
  // frase em destaque: uma frase do próprio texto (8 a 26 palavras), perto do ponto da matéria
  function pickQuote(paras, k) {
    const order = [k, k + 1, k - 1, k + 2, k - 2, k + 3].filter(i => i >= 0 && i < paras.length);
    for (const i of order) {
      const sents = (paras[i].textContent || '').replace(/­/g, '').split(/(?<=[.!?…])\s+/).map(x => x.trim());
      const s = sents.find(x => { const w = x.split(/\s+/).length; return w >= 8 && w <= 26; });
      if (s) return s;
    }
    return 'Uma frase marcante da matéria, em destaque.';
  }
  function itemHtml(t, paras, k) {
    const ph = (kind, cap) => `<div class="ph-block" data-ph="${kind}" data-cap="1" data-li="1">${cap}</div>`;
    if (t === 'hero') return ph('hero', 'Legenda de teste: a foto principal da matéria.');
    if (t === 'h') return ph('h', 'Legenda de teste: imagem horizontal.');
    if (t === 'v') return ph('v', 'Legenda de teste: imagem vertical.');
    if (t === 'band') return `<div class="tframe" data-pos="band" data-width="86" data-look="pull" data-li="1"><p>${App.escape('“' + pickQuote(paras, k).replace(/^[“"]|[”"]$/g, '') + '”')}</p></div>`;
    if (t === 'qleft') return `<div class="tframe" data-pos="left" data-width="34" data-look="quote" data-li="1"><p>${App.escape(pickQuote(paras, k).replace(/^[“"]|[”"]$/g, ''))}</p></div>`;
    if (t === 'side') return `<div class="tframe" data-pos="right" data-width="42" data-look="plain" data-border="keep" data-li="1"><p><b>SAIBA MAIS</b></p><p>Informações complementares, dados ou uma lista curta sobre o assunto da matéria. Clique para escrever.</p></div>`;
    return '';
  }
  function apply(c, L) {
    if (!c) return App.toast('Escolha uma matéria.');
    if (c.locked) return App.toast('Matéria bloqueada.');
    App.images.withChapterDom(c, root => {
      // tira os blocos e caixas de uma composição anterior (o texto e as imagens já escolhidas ficam)
      root.querySelectorAll(':scope > .ph-block[data-li], :scope > .tframe[data-li]').forEach(x => x.remove());
      const paras = Array.from(root.children).filter(x => x.tagName === 'P');
      // de trás para frente: cada inserção não muda a posição das seguintes
      L.items.map(([t, at]) => ({ t, k: Math.round(at * paras.length) })).sort((a, b) => b.k - a.k).forEach(({ t, k }) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = itemHtml(t, paras, Math.min(paras.length - 1, k));
        const node = tpl.content.firstChild;
        if (!node) return;
        if (k <= 0 || !paras.length) root.insertBefore(node, root.firstChild);
        else paras[Math.min(paras.length, k) - 1].after(node);
      });
    });
    c.columns = L.cols;
    c.layout = L.key;
    c.titleBox = L.titleBox ? Object.assign({}, L.titleBox) : null;
    App.changed(`Composição “${L.name}” em “${c.title}”`);
    render();
  }

  // ------------------------------------------------------------ tela
  let targetId = null;
  function render() {
    const v = $('#view-pagelayouts');
    if (!v) return;
    v.innerHTML = '';
    const chs = App.project.chapters;
    const cur = App.chapter();
    if (!targetId || !chs.find(c => c.id === targetId)) targetId = (cur || chs[0] || {}).id;
    const c = chs.find(x => x.id === targetId);
    const sel = el('select', { onchange: e => { targetId = e.target.value; render(); } }, chs.map(x => el('option', { value: x.id, text: (x.kicker ? x.kicker + ' · ' : '') + (x.title || 'Sem título') })));
    if (targetId) sel.value = targetId;
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Composições de página' }),
      App.card('Matéria', [
        el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Aplicar na matéria' }), sel]),
        el('p', { class: 'small muted', text: 'Um clique numa composição aplica: colunas, blocos de imagem (cinza, com “+” para escolher a foto), frase em destaque tirada do próprio texto, box lateral e estilo do título. O texto da matéria não muda; os blocos e caixas de uma composição anterior são trocados. Dá para combinar composições diferentes em cada matéria e desfazer com Ctrl+Alt+Z.' })
      ], '', 'span-all'),
      App.card('Modelos', [el('div', { class: 'pl-grid' }, LAYOUTS.map(L => el('button', {
        class: 'pl-tile' + (c && c.layout === L.key ? ' on' : ''),
        title: L.desc,
        onclick: () => apply(chs.find(x => x.id === targetId), L)
      }, [el('div', { class: 'pl-thumb', html: thumb(L) }), el('strong', { text: L.name }), el('span', { class: 'small muted', text: L.desc }), el('span', { class: 'pl-cols', text: `${L.cols} coluna${L.cols > 1 ? 's' : ''}` })])))], '', 'span-all'),
      c && c.layout ? el('div', { class: 'inline wrap' }, [el('button', { class: 'ghost', text: 'Voltar ao texto simples (tirar a composição)', onclick: () => {
        App.images.withChapterDom(c, root => root.querySelectorAll(':scope > .ph-block[data-li], :scope > .tframe[data-li]').forEach(x => x.remove()));
        c.layout = ''; c.columns = 0; c.titleBox = null; App.changed('Composição removida'); render();
      } })]) : null
    ]));
  }

  App.hooks.viewRender.pagelayouts = render;
  App.pageLayouts = { LAYOUTS, apply, render, thumb };
})();
