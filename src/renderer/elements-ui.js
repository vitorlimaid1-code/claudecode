/* global App, ChartDraw */
// Elementos do livro: tabelas (grade editável, colar de planilha ou importar CSV/XLSX/ODS), gráficos
// (várias séries, a partir de planilha) e elementos extras (caixa de destaque, citação, frase, poema,
// epígrafe, quebras, QR code, página de imagem). Cada elemento pode ser arrastado para o texto do editor
// ou para uma página da prévia (entra no fluxo do texto, na posição solta) ou inserido com um clique.
(function () {
  const { el, $, api } = App;
  const MIME = 'application/x-dl-element';

  // ---------------------------------------------------------------- grade editável (planilha)
  function grid(rows, onChange) {
    rows = rows && rows.length ? rows.map(r => r.slice()) : [['', '', ''], ['', '', ''], ['', '', '']];
    const box = el('div', { class: 'sheet-grid' });
    const state = { rows };
    const width = () => Math.max(1, ...state.rows.map(r => r.length));
    function render() {
      const w = width();
      state.rows.forEach(r => { while (r.length < w) r.push(''); });
      box.innerHTML = '';
      const t = el('table', {});
      state.rows.forEach((r, i) => {
        const tr = el('tr', {});
        r.forEach((c, j) => {
          const td = el('td', { contenteditable: 'true', spellcheck: 'false' });
          td.textContent = c;
          td.addEventListener('input', () => { state.rows[i][j] = td.textContent; onChange && onChange(); });
          // colar várias células (Excel, LibreOffice, Google Planilhas) expande a grade a partir daqui
          td.addEventListener('paste', e => {
            const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
            if (!/[\t\n]/.test(txt.trim())) return;
            e.preventDefault();
            pasteAt(i, j, txt);
          });
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      box.appendChild(t);
    }
    function pasteAt(i0, j0, txt) {
      const lines = txt.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      lines.forEach((cells, di) => cells.forEach((c, dj) => {
        while (state.rows.length <= i0 + di) state.rows.push([]);
        const r = state.rows[i0 + di];
        while (r.length <= j0 + dj) r.push('');
        r[j0 + dj] = c.trim();
      }));
      render(); onChange && onChange();
    }
    const btn = (t, f) => el('button', { class: 'small-btn', type: 'button', text: t, onclick: () => { f(); render(); onChange && onChange(); } });
    const tools = el('div', { class: 'inline wrap' }, [
      btn('+ Linha', () => state.rows.push(Array(width()).fill(''))),
      btn('− Linha', () => { if (state.rows.length > 1) state.rows.pop(); }),
      btn('+ Coluna', () => state.rows.forEach(r => r.push(''))),
      btn('− Coluna', () => { if (width() > 1) state.rows.forEach(r => r.pop()); }),
      el('button', { class: 'small-btn', type: 'button', text: 'Importar planilha… (XLSX, ODS, CSV)', onclick: async () => {
        const r = await api.sheetImport();
        if (!r) return;
        if (r.error) return App.toast(r.error, 6000);
        state.rows = r.rows; render(); onChange && onChange();
        App.toast(`${r.name}: ${r.rows.length} linhas × ${r.rows[0].length} colunas.`);
      } }),
      el('button', { class: 'small-btn', type: 'button', text: 'Colar da área de transferência', onclick: async () => {
        try { const t = await navigator.clipboard.readText(); if (t) { state.rows = []; pasteAt(0, 0, t); } } catch (e) { App.toast('Clique numa célula e use Ctrl+V.'); }
      } })
    ]);
    render();
    return { el: el('div', { class: 'sheet-wrap' }, [tools, box, el('div', { class: 'small muted', text: 'Dica: copie as células no Excel/LibreOffice/Google Planilhas e cole (Ctrl+V) numa célula — a grade cresce sozinha.' })]), get rows() { return state.rows.map(r => r.map(c => String(c).trim())); } };
  }

  const isNum = v => /^[-+]?[\d.\s]*\d(,\d+)?\s*%?$/.test(String(v).trim()) || /^[-+]?\d+(\.\d+)?$/.test(String(v).trim());

  // ---------------------------------------------------------------- tabela
  function tableHtml(rows, o) {
    rows = rows.filter(r => r.some(c => c));
    if (!rows.length) return '';
    const w = Math.max(...rows.map(r => r.length));
    const cls = [o.zebra ? 'tb-zebra' : '', o.compact ? 'tb-compact' : ''].filter(Boolean).join(' ');
    const numCol = Array.from({ length: w }, (_, j) => rows.slice(o.head ? 1 : 0).every(r => !r[j] || isNum(r[j])) && rows.slice(o.head ? 1 : 0).some(r => r[j]));
    let h = `<table${cls ? ` class="${cls}"` : ''}>` + (o.caption ? `<caption>${App.escape(o.caption)}</caption>` : '');
    rows.forEach((r, i) => {
      const th = o.head && i === 0;
      h += '<tr>' + Array.from({ length: w }, (_, j) => { const v = r[j] || ''; const tag = th ? 'th' : 'td'; return `<${tag}${!th && o.alignNum && numCol[j] ? ' class="num"' : ''}>${v ? App.escape(v) : '<br>'}</${tag}>`; }).join('') + '</tr>';
    });
    h += '</table>';
    if (o.source) h += `<p class="table-source">${App.escape(/^fonte\s*:/i.test(o.source) ? o.source : 'Fonte: ' + o.source)}</p>`;
    return h + '<p><br></p>';
  }

  function tableDialog(initialRows, title) {
    return new Promise(resolve => {
      const g = grid(initialRows || [['Coluna 1', 'Coluna 2', 'Coluna 3'], ['', '', ''], ['', '', '']]);
      const cap = el('input', { type: 'text', placeholder: 'Ex.: Vendas por ano' });
      const src = el('input', { type: 'text', placeholder: 'Ex.: IBGE, 2024 (opcional)' });
      const head = el('input', { type: 'checkbox', checked: true });
      const zebra = el('input', { type: 'checkbox', checked: false });
      const alignNum = el('input', { type: 'checkbox', checked: true });
      App.modal({
        title: title || 'Tabela', wide: true, onClose: () => resolve(null),
        body: el('div', {}, [g.el, el('div', { class: 'grid' }, [App.field('Título (legenda — entra numerado na lista de tabelas)', cap), App.field('Fonte (abaixo da tabela)', src),
          el('label', { class: 'chk' }, [head, ' Primeira linha é cabeçalho']), el('label', { class: 'chk' }, [zebra, ' Linhas alternadas em cinza']), el('label', { class: 'chk' }, [alignNum, ' Números alinhados à direita'])])]),
        buttons: [{ label: 'Cancelar', onClick: () => resolve(null) }, { label: 'Inserir tabela', primary: true, onClick: () => resolve(tableHtml(g.rows, { caption: cap.value.trim(), source: src.value.trim(), head: head.checked, zebra: zebra.checked, alignNum: alignNum.checked })) }]
      });
    });
  }

  // ---------------------------------------------------------------- gráfico
  function chartDialog(fig) {
    const asset = fig && App.project.assets[fig.dataset.asset];
    const prev = asset && asset.chart ? ChartDraw.normalize(asset.chart) : null;
    return new Promise(resolve => {
      const spec = prev || ChartDraw.normalize({ type: 'bar', title: '', labels: ['2021', '2022', '2023', '2024'], series: [{ name: 'Brochura', values: [1200, 1500, 1830, 2100] }, { name: 'Capa dura', values: [300, 420, 515, 640] }] });
      const img = el('img', { class: 'chart-preview' });
      const type = el('select', {}, ChartDraw.TYPES.map(([v, l]) => el('option', { value: v, text: l })));
      type.value = spec.type;
      const title = el('input', { type: 'text', value: spec.title || '', placeholder: 'Título dentro do gráfico (opcional)' });
      const cap = el('input', { type: 'text', value: (fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : '') || '', placeholder: 'Legenda numerada (entra na lista de gráficos)' });
      const src = el('input', { type: 'text', value: spec.source || '', placeholder: 'Ex.: Pesquisa própria, 2024' });
      const mono = el('input', { type: 'checkbox' }); mono.checked = !!spec.mono || App.project.settings.standard === 'cedet';
      const legend = el('input', { type: 'checkbox' }); legend.checked = spec.legend !== false;
      const values = el('input', { type: 'checkbox' }); values.checked = spec.values !== false;
      const read = () => ChartDraw.fromRows(g.rows, { type: type.value, title: title.value.trim(), mono: mono.checked, legend: legend.checked, values: values.checked, source: src.value.trim() });
      const redraw = () => { clearTimeout(redraw.t); redraw.t = setTimeout(() => { img.src = ChartDraw.draw(read()); }, 150); };
      const g = grid(ChartDraw.toRows(spec), redraw);
      [type, mono, legend, values].forEach(i => i.addEventListener('change', redraw));
      title.addEventListener('input', redraw);
      img.src = ChartDraw.draw(spec);
      App.modal({
        title: prev ? 'Editar gráfico' : 'Gráfico', wide: true, onClose: () => resolve(null),
        body: el('div', { class: 'chart-wrap' }, [
          el('div', {}, [el('div', { class: 'small muted', text: '1ª coluna: rótulos (eixo ou fatias). Demais colunas: uma série cada (1ª linha = nomes das séries). Importe ou cole uma planilha.' }), g.el,
            el('div', { class: 'grid' }, [App.field('Tipo', type), App.field('Título no gráfico', title), App.field('Legenda numerada', cap), App.field('Fonte', src),
              el('label', { class: 'chk' }, [mono, ' Tons de cinza (impressão P&B — padrão no CEDET)']), el('label', { class: 'chk' }, [legend, ' Mostrar legenda das séries']), el('label', { class: 'chk' }, [values, ' Mostrar os valores'])])]),
          img]),
        buttons: [{ label: 'Cancelar', onClick: () => resolve(null) }, { label: prev ? 'Atualizar gráfico' : 'Inserir gráfico', primary: true, onClick: async () => {
          const s = read();
          const url = ChartDraw.draw(s);
          if (prev) {
            Object.assign(asset, { dataUrl: url, chart: s, hash: await App.hashDataUrl(url) });
            const fc = fig.querySelector('figcaption');
            if (cap.value.trim()) { if (fc) fc.textContent = cap.value.trim(); else fig.appendChild(el('figcaption', { text: cap.value.trim() })); }
            App.editor.styleFigure(fig);
            resolve('updated');
          } else {
            const id = await App.addAsset({ dataUrl: url, name: 'Gráfico ' + (cap.value || s.title || ''), width: 1800, height: 1100 });
            App.project.assets[id].chart = s;
            let h = App.editor.figureHtml(id, { width: 100, caption: cap.value.trim() || s.title });
            if (s.source) h += `<p class="table-source">${App.escape(/^fonte\s*:/i.test(s.source) ? s.source : 'Fonte: ' + s.source)}</p>`;
            resolve(h + '<p><br></p>');
          }
        } }]
      });
    });
  }

  // ---------------------------------------------------------------- elementos extras
  const ELEMENTS = [
    { group: 'Tabelas e planilhas', items: [
      { kind: 'table', icon: '▦', label: 'Tabela', hint: 'Grade editável', make: () => tableDialog(null, 'Nova tabela') },
      { kind: 'sheet', icon: '⊞', label: 'Planilha', hint: 'Importar XLSX, ODS ou CSV', make: async () => { const r = await api.sheetImport(); if (!r) return null; if (r.error) { App.toast(r.error, 6000); return null; } return tableDialog(r.rows, 'Tabela a partir de ' + r.name); } },
      { kind: 'paste', icon: '⎘', label: 'Colar planilha', hint: 'Do Excel, LibreOffice ou Google', make: async () => { let t = ''; try { t = await navigator.clipboard.readText(); } catch (e) { /* sem acesso */ } const rows = t && /\t/.test(t) ? t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(l => l.split('\t').map(c => c.trim())) : null; return tableDialog(rows, 'Tabela colada'); } }
    ] },
    { group: 'Gráficos', items: [
      { kind: 'chart', icon: '📊', label: 'Gráfico', hint: 'Colunas, barras, linhas, área, pizza, rosca', make: () => chartDialog(null) }
    ] },
    { group: 'Elementos de texto', items: [
      { kind: 'box', icon: '▢', label: 'Caixa de destaque', hint: 'Quadro com fundo', make: async () => '<div class="box"><p>Texto em destaque.</p></div><p><br></p>' },
      { kind: 'quote', icon: '❝', label: 'Citação longa', hint: 'Recuada, sem aspas', make: async () => '<blockquote><p>Citação com mais de três linhas, recuada da margem.</p></blockquote><p><br></p>' },
      { kind: 'phrase', icon: '“', label: 'Frase de destaque', hint: 'Centralizada', make: async () => '<p class="phrase">Frase de destaque.</p><p><br></p>' },
      { kind: 'poem', icon: '✒', label: 'Poema', hint: 'Versos e estrofes', make: async () => '<div class="poem"><p>Primeiro verso<br>segundo verso</p></div><p><br></p>' },
      { kind: 'epigraph', icon: '¶', label: 'Epígrafe', hint: 'À direita, em itálico', make: async () => '<p class="epigraph-inline">Epígrafe — Autor</p><p><br></p>' },
      { kind: 'scene', icon: '✱', label: 'Quebra de cena', hint: 'Separador entre cenas', make: async () => '<hr class="scene-break"><p><br></p>' },
      { kind: 'pagebreak', icon: '⤓', label: 'Quebra de página', hint: 'Começa nova página', make: async () => '<div class="page-break"></div><p><br></p>' }
    ] },
    { group: 'Imagens e códigos', items: [
      { kind: 'qr', icon: '▩', label: 'QR code', hint: 'Link ou texto', make: async () => {
        const t = await App.prompt('QR code', 'Endereço (link) ou texto do QR code', 'https://');
        if (!t || t === 'https://') return null;
        const url = await api.qrDataUrl(t);
        if (!url) { App.toast('Não foi possível gerar o QR code.'); return null; }
        const id = await App.addAsset({ dataUrl: url, name: 'QR ' + t.slice(0, 40), width: 1000, height: 1000 });
        return App.editor.figureHtml(id, { width: 25, caption: '' }) + '<p><br></p>';
      } },
      { kind: 'fullbleed', icon: '▣', label: 'Página de imagem', hint: 'Imagem sangrada, página inteira', make: async () => { const l = await api.pickImages({ title: 'Imagem de página inteira' }); if (!l || !l.length) return null; const id = await App.addAsset(l[0]); return `<div class="fullbleed" data-asset="${id}" data-fit="cover"></div><p><br></p>`; } }
    ] }
  ];
  const byKind = k => ELEMENTS.flatMap(g => g.items).find(i => i.kind === k);

  async function makeElement(kind) {
    const it = byKind(kind);
    return it ? it.make() : null;
  }

  // Insere HTML de elementos num capítulo, junto do bloco cujo texto começa com `probe` (prévia)
  function insertHtmlIntoChapter(ch, probe, before, html) {
    if (!ch || ch.locked) return false;
    App.flush();
    const tpl = document.createElement('template');
    tpl.innerHTML = ch.html || '';
    const norm = t => String(t || '').replace(/[­‑​]/g, '').replace(/\s+/g, ' ').trim();
    const pr = norm(probe).slice(0, 60);
    const at = pr ? Array.from(tpl.content.children).find(k => norm(k.textContent).includes(pr)) : null;
    const frag = document.createElement('template');
    frag.innerHTML = html.replace(/<p><br><\/p>$/, '');
    if (at) { if (before) at.before(frag.content); else at.after(frag.content); } else tpl.content.appendChild(frag.content);
    ch.html = tpl.innerHTML;
    if (ch.id === App.editorChapterId) { App.editorChapterId = null; if (App.view === 'chapter') App.editor.load(); }
    return true;
  }

  // clique: no capítulo aberto (no cursor) ou, sem capítulo aberto, ao fim do capítulo escolhido
  async function insertByClick(kind) {
    const c = App.chapter();
    if (App.view !== 'chapter' || !c) return App.toast('Abra um capítulo (lista à esquerda) e clique no ponto do texto — ou arraste o elemento para o texto ou para uma página da prévia.', 6000);
    if (c.locked) return App.toast('Capítulo bloqueado: desbloqueie no cadeado.');
    const html = await makeElement(kind);
    if (!html || html === 'updated') return;
    App.editor.insertBlocks(html);
    App.changed('Elemento inserido: ' + byKind(kind).label);
  }

  // ---------------------------------------------------------------- gaveta
  function renderDrawer() {
    const d = $('#elementsDrawer');
    d.innerHTML = '';
    d.append(
      el('div', { class: 'drawer-head' }, [el('strong', { text: 'Elementos' }), el('button', { class: 'small-btn', text: '✕', onclick: () => toggle(false) })]),
      el('p', { class: 'small muted', text: 'Arraste para o texto do capítulo ou para uma página da prévia — o elemento entra no fluxo e o texto se reorganiza. Ou clique para inserir no cursor do capítulo aberto.' }),
      ...ELEMENTS.map(g => el('div', { class: 'el-group' }, [el('div', { class: 'el-group-title', text: g.group }), el('div', { class: 'el-tiles' }, g.items.map(it => {
        const t = el('div', { class: 'el-tile', draggable: 'true', title: it.hint, onclick: () => insertByClick(it.kind) }, [el('span', { class: 'el-ic', text: it.icon }), el('span', { class: 'el-lb', text: it.label }), el('span', { class: 'el-hint', text: it.hint })]);
        t.addEventListener('dragstart', e => { e.dataTransfer.setData(MIME, it.kind); e.dataTransfer.effectAllowed = 'copy'; });
        return t;
      }))])),
      el('div', { class: 'small muted', text: 'Tabelas, gráficos e figuras com legenda são numerados automaticamente (Tabela 1, Gráfico 1, Figura 1) e podem ter listas com o número da página, em Dados e páginas iniciais.' })
    );
  }
  function toggle(show) {
    const d = $('#elementsDrawer');
    const open = show === undefined ? !d.classList.contains('open') : show;
    if (open && App.library) App.library.toggle(false);
    d.classList.toggle('open', open);
    const b = $('#btnElements'); if (b) b.classList.toggle('on', open);
    if (open) renderDrawer();
  }

  App.elements = { MIME, toggle, makeElement, insertHtmlIntoChapter, tableDialog, chartDialog, grid, byKind };
  document.addEventListener('DOMContentLoaded', () => { const b = $('#btnElements'); if (b) b.addEventListener('click', () => toggle()); });
  if (document.readyState !== 'loading') { const b = $('#btnElements'); if (b) b.addEventListener('click', () => toggle()); }
})();
