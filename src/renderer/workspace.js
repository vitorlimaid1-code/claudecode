/* global App */
// Duas mesas de trabalho separadas: Livro e Revista/Jornal. Cada uma tem o seu projeto (com formato,
// colunas, margens e exportação próprios), o seu arquivo, as suas alterações e o seu histórico.
// Trocar de mesa guarda a atual e abre a outra (ou começa uma revista nova, na primeira vez).
(function () {
  const { el, $, api, D } = App;
  const stash = { book: null, periodical: null };
  const wsOf = p => (p && ['magazine', 'newspaper'].includes(p.kind) ? 'periodical' : 'book');
  let current = 'book';

  function mark() {
    current = wsOf(App.project);
    document.body.classList.toggle('ws-periodical', current === 'periodical');
    document.body.classList.toggle('ws-book', current === 'book');
    document.querySelectorAll('.ws-switch button').forEach(b => b.classList.toggle('on', b.dataset.ws === current));
    const g = document.querySelector('.nav-group[data-ws-label]');
    if (g) g.textContent = current === 'periodical' ? (App.project.kind === 'newspaper' ? 'Jornal' : 'Revista') : 'Livro';
    // telas que não pertencem a esta mesa voltam para a principal
    const only = document.querySelector(`.nav-item[data-view="${App.view}"][data-ws]`);
    if (only && only.dataset.ws !== current) App.setView(App.chapterId ? 'chapter' : 'book');
  }

  async function go(ws) {
    if (ws === current) return;
    App.flush();
    stash[current] = { project: App.serialize(), filePath: App.filePath, dirty: App.dirty, undo: App.history.undo.slice(), redo: App.history.redo.slice() };
    const s = stash[ws];
    if (s) {
      App.loadProject(s.project, s.filePath, s.dirty);
      App.history.undo = s.undo; App.history.redo = s.redo; App.updateHistoryButtons();
    } else {
      // primeira vez: começa uma revista (ou um livro) em branco, com os ajustes de partida do tipo
      App.loadProject(await api.newProject(), null, false);
      if (ws === 'periodical') {
        App.periodical.applyKind('magazine');
        App.project.meta.title = 'Minha revista';
        App.project.masthead.name = 'Minha revista';
        App.project.chapters = [
          { id: D.uid(), title: 'Planejamento', numbered: false, kicker: 'COMPORTAMENTO', lead: 'Linha fina: um resumo de uma ou duas linhas que convida à leitura.', byline: 'Por Nome do Autor', html: sampleArticle(true), locked: false, style: {}, separator: 'default', openingImage: null, newPage: true },
          { id: D.uid(), title: 'Escolha', numbered: false, kicker: 'CARREIRA', lead: '', byline: '', html: sampleArticle(false), locked: false, style: {}, separator: 'default', openingImage: null, newPage: true }
        ];
        App.chapterId = App.project.chapters[0].id;
        App.changed('Nova revista');
        App.resetHistory('Nova revista');
        App.setView('chapter', App.chapterId);
      }
    }
    mark();
    App.toast(ws === 'periodical' ? 'Mesa de Revista e jornal' : 'Mesa de Livro', 2200);
  }
  function sampleArticle(blocks) {
    const p = 'Texto de exemplo da matéria. Substitua por seu conteúdo: cole o texto, importe um arquivo ou digite direto na página. As colunas, a hifenização e a justificação se ajustam sozinhas.';
    const ps = Array.from({ length: 8 }, () => `<p>${p} ${p}</p>`);
    if (blocks) { ps.splice(1, 0, App.blocks.phHtml(false, 'Legenda de teste: a imagem principal da matéria.')); ps.splice(5, 0, App.blocks.phHtml(true, 'Legenda de teste: imagem de apoio.')); }
    else ps.splice(2, 0, '<div class="tframe" data-pos="band" data-width="80" data-look="pull"><p>Para tomar as decisões certas, você <b>precisa primeiro definir onde quer chegar.</b></p></div>');
    return ps.join('');
  }

  function mount() {
    const brand = document.querySelector('.topbar .brand');
    if (!brand || document.querySelector('.ws-switch')) return;
    const sw = el('div', { class: 'ws-switch', title: 'Mesas de trabalho separadas: cada uma com o seu projeto, formato e exportação' }, [
      el('button', { 'data-ws': 'book', onclick: () => go('book') }, [el('span', { html: App.icons ? App.icons.svg('book') : '' }), el('span', { class: 'ws-l', text: 'Livro' })]),
      el('button', { 'data-ws': 'periodical', onclick: () => go('periodical') }, [el('span', { html: App.icons ? App.icons.svg('news') : '' }), el('span', { class: 'ws-l', text: 'Revista e jornal' })])
    ]);
    brand.after(sw);
    mark();
  }
  // toda vez que um projeto é aberto/criado, a mesa certa aparece
  App.hooks.afterChange.push(() => { if (wsOf(App.project) !== current) mark(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else setTimeout(mount, 0);
  App.workspace = { go, mark, current: () => current };
})();
