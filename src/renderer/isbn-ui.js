/* global App */
// ISBN e código de barras (Livro → ISBN e código de barras): tudo o que é do ISBN numa tela só — o número
// (conferido pelo dígito verificador, ISBN-10 convertido), o ISBN do e-book, onde o número aparece no livro
// (ficha catalográfica, contracapa, EPUB, nomes dos arquivos do Cedet) e o código de barras da contracapa
// (posição, tamanho, prévia e download em EPS/PDF/SVG). As outras telas só mostram o número e trazem para cá.
(function () {
  const { el, $ } = App;

  function status(v) {
    if (!String(v || '').trim()) return { ok: false, empty: true };
    return window.Isbn ? window.Isbn.parse(v) : { ok: true };
  }

  function render() {
    const v = $('#view-isbn');
    if (!v) return;
    v.innerHTML = '';
    const m = App.project.meta;
    const c = App.cover && App.cover.ensure ? App.cover.ensure() : null;
    const cedet = (c && c.cedet) || App.project.settings.standard === 'cedet';

    // ---- número
    const hint = el('div', { class: 'small' });
    const show = () => {
      const r = status(m.isbn);
      hint.className = 'small ' + (r.ok ? 'good' : r.empty ? 'muted' : 'bad');
      hint.textContent = r.ok ? `✓ ISBN válido · EAN-13 ${r.isbn13}${r.converted ? ' (convertido do ISBN-10)' : ''}${r.display && r.display !== m.isbn ? ` · forma com hífens: ${r.display}` : ''}` : r.empty ? (cedet ? 'Obrigatório no Cedet: digite o ISBN de 13 dígitos do pré-cadastro (o ISBN-10 é convertido).' : 'Opcional. Sem ISBN, a ficha sai sem a linha do ISBN e a capa sem código de barras.') : '✗ ' + r.error;
      fix.style.display = r.ok && r.display && r.display !== m.isbn ? '' : 'none';
    };
    const input = el('input', { type: 'text', value: m.isbn || '', placeholder: '978-85-XXXXX-XX-X', spellcheck: 'false' });
    const fix = el('button', { class: 'small-btn', text: 'Usar a forma com hífens', onclick: () => { const r = status(m.isbn); if (r.ok && r.display) { m.isbn = r.display; input.value = m.isbn; changed(); } } });
    let t = null;
    const changed = () => { show(); if (App.cover && App.cover.invalidate) App.cover.invalidate(); clearTimeout(t); t = setTimeout(() => { App.changed('ISBN do livro'); render(); }, 700); };
    input.addEventListener('input', () => { m.isbn = input.value.trim(); changed(); });
    const ebook = App.bind(m, 'isbnEpub', 'text', { placeholder: 'Opcional — o mesmo do impresso se vazio', label: 'ISBN do e-book' });
    const r = status(m.isbn);
    const re = status(m.isbnEpub);

    // ---- onde aparece
    const cat = App.project.catalog || {};
    const front = App.project.front || {};
    const b = (c && c.isbnBarcode) || {};
    const pasted = cat.mode === 'manual';
    const pastedHas = pasted && r.ok && String(cat.manualText || '').replace(/[^0-9Xx]/g, '').includes(r.isbn13.slice(3, 12));
    const row = (ok, label, detail, go) => el('div', { class: 'isbn-where' }, [
      el('span', { class: ok === true ? 'good' : ok === false ? 'bad' : 'muted', text: ok === true ? '✓' : ok === false ? '✗' : '–' }),
      el('div', {}, [el('b', { text: label }), el('div', { class: 'small muted', text: detail })]),
      go ? el('button', { class: 'small-btn', text: go[0], onclick: go[1] }) : null
    ]);
    const where = [
      row(front.copyright === false ? null : pasted ? (r.ok ? pastedHas : null) : r.ok ? true : null, 'Ficha catalográfica',
        front.copyright === false ? 'A página da ficha está desligada.' : pasted ? (pastedHas ? 'A ficha colada traz este ISBN.' : 'Ficha colada: o ISBN é o que está no texto colado — confira se é o mesmo.') : r.ok ? `Linha “ISBN ${m.isbn}” na ficha.` : 'Sem ISBN, a ficha sai sem a linha do ISBN.',
        ['Abrir a ficha', () => App.setView('catalog')]),
      row(b.enabled || cedet ? r.ok : null, 'Contracapa — código de barras (EAN-13)', b.enabled || cedet ? (r.ok ? 'Gerado com este ISBN, no quadro abaixo.' : 'Sem ISBN válido, o código não é gerado.') : 'Desligado (ligue no quadro abaixo).'),
      row(r.ok || re.ok ? true : null, 'Livro digital (EPUB/MOBI)', re.ok ? `Identificador do e-book: ${m.isbnEpub}.` : r.ok ? `Identificador: ${m.isbn} (o do impresso).` : 'Sem ISBN, o EPUB usa um identificador interno.'),
      row(cedet ? r.ok : null, 'Nome dos arquivos para a gráfica (Cedet)', r.ok ? `${r.isbn13}_MIOLO_… e ${r.isbn13}_CAPA_…` : cedet ? 'Os arquivos levam o ISBN no nome: digite-o.' : 'Só no envio no padrão Cedet.')
    ];

    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'ISBN e código de barras' }),
      el('p', { class: 'muted', text: 'Tudo o que é do ISBN fica aqui: o número, onde ele aparece no livro e o código de barras da contracapa. Digite uma vez — a ficha, a capa, o EPUB e os nomes dos arquivos usam o mesmo número.' }),
      App.card('Número do ISBN', [
          el('label', { class: 'field wide' }, [el('span', { class: 'flabel', text: cedet ? 'ISBN do pré-cadastro (obrigatório no Cedet)' : 'ISBN do livro impresso' }), el('div', { class: 'inline' }, [input, fix]), hint]),
          el('label', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'ISBN do e-book (EPUB), se for diferente' }), ebook, el('div', { class: 'small ' + (re.ok ? 'good' : re.empty ? 'muted' : 'bad'), text: re.ok ? `✓ ${re.isbn13}` : re.empty ? 'O e-book costuma ter ISBN próprio; vazio, usa o do impresso.' : '✗ ' + re.error })])
        ], 'O dígito verificador é conferido; ISBN-10 é convertido para 13 dígitos (978…).', 'span-all'),
        App.card('Onde o ISBN aparece', where, '', 'span-all'),
        c && App.cover.barcodeCard ? App.cover.barcodeCard(c, (obj, key, type, o) => App.bind(obj, key, type, Object.assign({ label: 'Código de barras', onChange: () => { App.cover.invalidate(); } }, o || {})), { noIsbnInput: true, rerender: () => { App.cover.invalidate(); App.changed('Código de barras do ISBN', { preview: false }); render(); }, redraw: () => App.cover.invalidate() }) : null
    ]));
    show();
  }

  App.hooks.viewRender.isbn = render;
  // resumo do ISBN para as outras telas (Dados do livro, ficha): mostra o número e leva para cá
  App.isbnSummary = function () {
    const m = App.project.meta;
    const r = status(m.isbn);
    return el('div', { class: 'field' }, [
      el('span', { class: 'flabel', text: 'ISBN' }),
      el('div', { class: 'inline' }, [
        el('span', { class: r.ok ? 'good' : r.empty ? 'muted' : 'bad', text: r.empty ? 'não informado' : r.ok ? m.isbn : `${m.isbn} (inválido)` }),
        el('button', { class: 'small-btn', text: 'Editar ISBN e código de barras →', onclick: () => App.setView('isbn') })
      ])
    ]);
  };
  App.isbnUi = { render };
})();
