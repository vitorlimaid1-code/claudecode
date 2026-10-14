/* global App */
// Capa e imagens iniciais: a imagem da capa abre o livro em página inteira (sem margens) e é a capa do EPUB;
// imagens extras (opcionais) vêm logo depois, antes da página de rosto. Ao escolher a capa, o sistema pede
// a sinopse, que entra nos metadados do livro digital.
(function () {
  const { el, $, api } = App;
  const eb = () => { const p = App.project; p.ebook = Object.assign({ coverAsset: null, coverInBook: true, preImages: [] }, p.ebook || {}); return p.ebook; };

  async function askSynopsis() {
    const m = App.project.meta;
    const v = await App.prompt('Sinopse do livro', 'A sinopse aparece nos aplicativos de leitura e nas lojas (metadados do EPUB) e pode ir para a quarta capa.', m.description || '', { multiline: true, ok: 'Salvar sinopse' });
    if (v !== null && v !== undefined) { m.description = String(v).trim(); App.changed('Sinopse', { preview: false }); }
  }

  async function chooseCover() {
    const l = await api.pickImages({ title: 'Imagem da capa (JPEG ou PNG — ideal 1600 × 2560 px)' });
    if (!l || !l.length) return false;
    const id = await App.addAsset(l[0]);
    eb().coverAsset = id;
    App.changed('Capa do livro');
    render();
    await askSynopsis();
    render();
    return true;
  }
  async function addImages() {
    const l = await api.pickImages({ title: 'Imagens antes da página de rosto', multiple: true });
    if (!l || !l.length) return;
    for (const f of l) eb().preImages.push(await App.addAsset(f));
    App.changed(`${l.length} imagem(ns) antes da página de rosto`);
    render();
  }

  function render() {
    const v = $('#view-frontimages');
    if (!v) return;
    const e = eb();
    const a = e.coverAsset && App.project.assets[e.coverAsset];
    const inBook = el('input', { type: 'checkbox', checked: e.coverInBook !== false });
    inBook.addEventListener('change', () => { e.coverInBook = inBook.checked; App.changed(inBook.checked ? 'Capa no livro' : 'Capa só no EPUB'); });
    const syn = el('textarea', { rows: 5, placeholder: 'Escreva a sinopse do livro…' });
    syn.value = App.project.meta.description || '';
    syn.addEventListener('input', () => { App.project.meta.description = syn.value; App.changed(null, { preview: false }); });
    v.innerHTML = '';
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Capa e imagens iniciais' }),
      el('p', { class: 'muted', text: 'Opcional. A capa abre o livro em página inteira, sem margens, e é a capa do EPUB nos aplicativos de leitura e nas lojas. As imagens extras vêm logo depois, antes da página de rosto. Nenhuma delas recebe número de página.' }),
      el('div', { class: 'card fi-card' }, [
        el('h3', { text: 'Capa' }),
        el('div', { class: 'fi-cover' }, [
          a ? el('img', { class: 'fi-thumb big', src: App.assetUrl(e.coverAsset) }) : el('button', { class: 'fi-drop', onclick: chooseCover }, [el('span', { class: 'fi-plus', text: '＋' }), el('span', { text: 'Escolher a imagem da capa' })]),
          el('div', { class: 'fi-side' }, [
            a ? el('p', { class: 'small muted', text: `${a.width || '?'} × ${a.height || '?'} px${a.width && Math.max(a.width, a.height) < 1000 ? ' — imagem pequena: use pelo menos 1600 × 2560 px' : ''}` }) : el('p', { class: 'small muted', text: 'Ideal: 1600 × 2560 px (proporção 1,6:1), JPEG ou PNG.' }),
            a ? el('button', { text: '↻ Trocar imagem', onclick: chooseCover }) : null,
            a ? el('button', { class: 'danger', text: '✕ Remover capa', onclick: () => { e.coverAsset = null; App.changed('Capa removida'); render(); } }) : null,
            el('label', { class: 'chk' }, [inBook, ' Mostrar a capa também no livro (prévia e PDF)'])
          ])
        ])
      ]),
      el('div', { class: 'card fi-card' }, [
        el('h3', { text: 'Imagens antes da página de rosto' }),
        el('div', { class: 'fi-list' }, e.preImages.map((id, i) => el('div', { class: 'fi-item' }, [
          App.project.assets[id] ? el('img', { class: 'fi-thumb', src: App.assetUrl(id) }) : el('span', { class: 'bad small', text: 'imagem ausente' }),
          el('div', { class: 'fi-tools' }, [
            el('button', { class: 'icon-btn', text: '↑', title: 'Antes', disabled: i === 0, onclick: () => { e.preImages.splice(i - 1, 0, e.preImages.splice(i, 1)[0]); App.changed('Ordem das imagens iniciais'); render(); } }),
            el('button', { class: 'icon-btn', text: '↓', title: 'Depois', disabled: i === e.preImages.length - 1, onclick: () => { e.preImages.splice(i + 1, 0, e.preImages.splice(i, 1)[0]); App.changed('Ordem das imagens iniciais'); render(); } }),
            el('button', { class: 'icon-btn danger', text: '✕', title: 'Remover', onclick: () => { e.preImages.splice(i, 1); App.changed('Imagem inicial removida'); render(); } })
          ])
        ])).concat([el('button', { class: 'fi-drop small', onclick: addImages }, [el('span', { class: 'fi-plus', text: '＋' }), el('span', { text: 'Adicionar imagens' })])]))
      ]),
      el('div', { class: 'card fi-card' }, [
        el('h3', { text: 'Sinopse (metadados do EPUB)' }),
        syn,
        el('p', { class: 'small muted', text: 'Também entram nos metadados: título, subtítulo, autor, idioma, editora, ISBN, data de geração (o dia da exportação) e o crédito à Casa Vertigem.' })
      ])
    ]));
  }

  App.hooks.viewRender.frontimages = render;
  App.frontImages = { chooseCover, askSynopsis, render };
})();
