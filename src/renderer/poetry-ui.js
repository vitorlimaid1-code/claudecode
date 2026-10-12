/* global App */
// Módulo de poesia: aplica o estilo de poesia (alinhado à esquerda, sem hifenização, estrofes
// que não se dividem entre páginas) e converte capítulos em poemas, preservando os versos.
// Todas as ferramentas do livro (notas, imagens, cores, sumário, capa, exportação) continuam valendo.
(function () {
  const { el, $ } = App;

  // Transforma parágrafos em estrofes (<div class="poem">), um verso por linha
  function toPoem(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    const out = [];
    let stanza = [];
    const flush = () => { if (stanza.length) { out.push(`<div class="poem"><p>${stanza.join('<br>')}</p></div>`); stanza = []; } };
    Array.from(tpl.content.childNodes).forEach(n => {
      if (n.nodeType === 1 && n.tagName === 'P' && !n.classList.contains('phrase')) {
        const lines = n.innerHTML.split(/<br\s*\/?>/i).map(x => x.trim());
        if (!n.textContent.trim()) { flush(); return; }
        // parágrafo longo de prosa vira estrofe de um verso por frase só se tiver quebras de linha
        lines.forEach(l => { if (l) stanza.push(l); });
        if (lines.length > 1) flush();
      } else if (n.nodeType === 1 && n.classList && n.classList.contains('poem')) { flush(); out.push(n.outerHTML); }
      else if (n.nodeType === 1) { flush(); out.push(n.outerHTML); }
      else if (n.nodeType === 3 && n.nodeValue.trim()) stanza.push(n.nodeValue.trim());
    });
    flush();
    return out.join('');
  }

  function render() {
    const v = $('#view-poetry');
    if (!v) return;
    v.innerHTML = '';
    const p = App.project;
    const active = p.genre === 'poesia';
    const s = p.settings;
    const { bind, field, card } = App;
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Poesia' }),
      el('p', { class: 'muted', text: 'Para livros de poemas: versos alinhados à esquerda (sem justificar), sem hifenização, estrofes que não se partem entre páginas e um poema por página quando desejado. Todas as ferramentas do livro continuam disponíveis.' }),
      card('Estilo de poesia', [
        el('div', { class: 'inline wrap' }, [
          el('button', { class: active ? '' : 'primary', text: active ? '✓ Estilo de poesia em uso — reaplicar' : 'Aplicar o estilo de poesia ao livro', onclick: async () => { if (await App.genre.apply('poesia', true)) render(); } })
        ]),
        field('Recuo dos versos (mm)', bind(s.styles.poem, 'indentLeft', 'number', { step: 1, min: 0, max: 40 })),
        field('Tamanho dos versos (pt)', bind(s.styles.poem, 'size', 'number', { step: 0.5, min: 7, max: 20 })),
        field('Entrelinha dos versos', bind(s.styles.poem, 'lineHeight', 'number', { step: 0.05, min: 1, max: 2.5 })),
        field('Alinhamento dos versos', bind(s.styles.poem, 'align', 'select', { options: [{ value: 'left', label: 'À esquerda (padrão)' }, { value: 'center', label: 'Centralizado' }, { value: 'right', label: 'À direita' }] }))
      ], '', 'span-all'),
      card('Converter textos em poemas', [
        el('p', { class: 'small', text: 'Cada parágrafo com quebras de linha vira uma estrofe; linhas em branco separam estrofes. Imagens, títulos, notas e citações são mantidos.' }),
        el('div', { class: 'inline wrap' }, [
          el('button', { text: 'Converter o capítulo aberto', onclick: () => convert([App.chapter()].filter(Boolean)) }),
          el('button', { text: 'Converter todos os capítulos', onclick: () => convert(p.chapters) })
        ])
      ], '', 'span-all')
    ]));
  }

  async function convert(chs) {
    chs = chs.filter(c => !c.locked);
    if (!chs.length) return App.toast('Nenhum capítulo (desbloqueado) para converter.');
    const ok = await App.confirmPreview('Converter em poemas', 'Os capítulos abaixo terão os parágrafos transformados em estrofes:', chs.map(c => c.title));
    if (!ok) return;
    App.flush();
    chs.forEach(c => { c.html = toPoem(c.html); });
    App.editorChapterId = null;
    App.changed(`Conversão em poemas (${chs.length})`);
    App.toast('Pronto. Use Desfazer se quiser voltar.');
  }

  App.hooks.viewRender.poetry = render;
  App.poetry = { toPoem, render };
})();
