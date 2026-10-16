/* global App, Recipes */
// Modelo de receitas (Biblioteca de estilos → Receitas): ícones nos ingredientes e no modo de preparo,
// passos numerados e o quadro com + para a foto da receita antes do modo de preparo. O reconhecimento é
// feito na paginação (shared/recipes.js); aqui ficam as opções, a galeria de ícones e os quadros da foto.
(function () {
  const { el } = App;
  const PHOTO = '<div class="ph-block" data-ph="recipe" data-cap="0">Foto da receita</div>';

  // quadro da foto antes de cada “Modo de preparo” que ainda não tem foto nem quadro logo antes
  function insertPhotos(quiet) {
    App.flush();
    let n = 0, locked = 0;
    App.project.chapters.forEach(c => {
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      const kids = Array.from(tpl.content.children);
      let changed = false;
      kids.forEach(k => {
        if (Recipes.headKind(k.tagName, k.textContent) !== 'prep') return;
        const prev = k.previousElementSibling;
        if (prev && (prev.matches('.ph-block, figure, .fig, div.fullbleed') || prev.querySelector && prev.querySelector('img'))) return;
        if (c.locked) { locked++; return; }
        const t = document.createElement('template');
        t.innerHTML = PHOTO;
        k.before(t.content);
        changed = true; n++;
      });
      if (changed) c.html = tpl.innerHTML;
    });
    if (n) {
      App.editorChapterId = null;
      App.changed(`Quadros de foto das receitas (${n})`);
      if (App.view === 'chapter') App.setView('chapter', App.chapterId);
    }
    if (!quiet || n) App.toast(n ? `${n} quadro(s) de foto inserido(s) antes do modo de preparo — clique no + para carregar a foto do computador.` + (locked ? ` ${locked} em capítulo(s) bloqueado(s) ficaram de fora.` : '') : 'Todas as receitas já têm foto ou quadro antes do modo de preparo (ou nenhum “Modo de preparo” foi encontrado).', 6000);
    return n;
  }

  // quantas receitas o livro tem (títulos “Ingredientes”/“Modo de preparo” reconhecidos)
  function stats() {
    let ing = 0, prep = 0;
    App.project.chapters.forEach(c => {
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html || '';
      Array.from(tpl.content.children).forEach(k => { const h = Recipes.headKind(k.tagName, k.textContent); if (h === 'ing') ing++; if (h === 'prep') prep++; });
    });
    return { ing, prep };
  }

  // quadro de opções (na Biblioteca de estilos, quando o modelo de receitas está ligado)
  function card(rerender) {
    const s = App.project.settings;
    s.recipes = Object.assign({ enabled: false, icons: true, columns: 2, color: '#7a4a2a', photo: true }, s.recipes || {});
    const r = s.recipes;
    const st = stats();
    const b = (key, label) => el('label', { class: 'chk' }, [App.bind(r, key, 'checkbox', { label: 'Receitas: ' + label, onChange: rerender }), ' ' + label]);
    const gallery = el('div', { class: 'rc-gallery' }, Object.keys(Recipes.ICONS).map(k => el('span', { class: 'rc-icon', title: Recipes.LABELS[k] || k, html: Recipes.svgOf(k, 'currentColor') + `<small>${App.escape(Recipes.LABELS[k] || k)}</small>` })));
    const test = el('input', { type: 'text', placeholder: 'Teste: digite um ingrediente ou um passo (ex.: 2 xícaras de farinha · Leve ao forno)' });
    const out = el('span', { class: 'rc-test' });
    test.addEventListener('input', () => {
      const v = test.value.trim();
      if (!v) { out.innerHTML = ''; return; }
      const ing = Recipes.ingredientIcon(v), stp = Recipes.stepIcon(v);
      out.innerHTML = `<span title="Como ingrediente">${Recipes.svgOf(ing, 'currentColor')} ${App.escape(Recipes.LABELS[ing])}</span> <span title="Como passo do preparo">${Recipes.svgOf(stp, 'currentColor')} ${App.escape(Recipes.LABELS[stp])}</span>`;
    });
    return App.card('🍳 Receitas — ingredientes e modo de preparo', [
      b('enabled', 'Reconhecer receitas no livro (Ingredientes, Modo de preparo, rendimento, tempo e dicas)'),
      b('icons', 'Ícones nos ingredientes e em cada passo'),
      App.field('Ingredientes em', App.bind(r, 'columns', 'select', { options: [{ value: 1, label: '1 coluna' }, { value: 2, label: '2 colunas' }, { value: 3, label: '3 colunas' }], onChange: v => { r.columns = Number(v); } })),
      App.field('Cor dos ícones, filetes e números', App.bind(r, 'color', 'color', { fallback: '#7a4a2a' })),
      el('div', { class: 'field wide' }, [
        el('span', { class: 'flabel', text: `Neste livro: ${st.ing} lista(s) de ingredientes e ${st.prep} modo(s) de preparo reconhecidos` }),
        el('div', { class: 'inline wrap' }, [el('button', { class: 'primary', text: '＋ Inserir o quadro da foto antes de cada modo de preparo', onclick: () => { insertPhotos(false); rerender(); } })])
      ]),
      el('div', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'Teste o reconhecimento' }), test, out]),
      el('details', { class: 'wide' }, [el('summary', { text: `Biblioteca de ícones — ${Recipes.count()} ícones, ${Recipes.words()} palavras e expressões reconhecidas` }), gallery])
    ], 'Escreva cada receita com um título “Ingredientes” (um ingrediente por linha ou em lista) e um título “Modo de preparo” (um passo por parágrafo ou lista numerada). O sistema escolhe o ícone pelo que cada linha diz — farinha, ovos, manteiga, forno, misturar, cortar… — sem mudar o texto. “Rendimento”, “Tempo de preparo” e “Dica” também ganham ícone. Sem ícone conhecido, entra um ícone neutro.', 'span-all');
  }

  App.recipes = { insertPhotos, card, stats };
})();
