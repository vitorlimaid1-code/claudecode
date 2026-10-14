/* global App, BookText */
// Inicialização, comandos, importação de manuscritos, abrir/salvar e recuperação.
(function () {
  const { el, $, $$, api, D } = App;

  // ---------------------------------------------------------------- importação
  async function convertImages(chapters) {
    let count = 0;
    for (const c of chapters) {
      if (!/<img[^>]+src="data:/.test(c.html)) continue;
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html;
      for (const img of Array.from(tpl.content.querySelectorAll('img[src^="data:"]'))) {
        const id = await App.addAsset({ dataUrl: img.getAttribute('src'), name: 'Imagem importada ' + (++count) });
        const holder = img.closest('figure') || img;
        const cap = holder.tagName === 'FIGURE' ? holder.querySelector('figcaption') : null;
        const t = document.createElement('template');
        t.innerHTML = App.editor.figureHtml(id, { caption: cap ? cap.textContent : '' });
        const fig = t.content.firstChild;
        if (holder.tagName === 'FIGURE' || !holder.closest('p')) holder.replaceWith(fig);
        else { const p = holder.closest('p'); holder.remove(); p.after(fig); }
      }
      c.html = tpl.innerHTML;
    }
    return count;
  }

  // gráficos nativos do Word: viram gráficos do livro (editáveis), no mesmo ponto do texto
  async function convertCharts(chapters, specs) {
    if (!specs || !specs.length) return 0;
    let count = 0;
    const mono = App.project.settings.standard === 'cedet';
    for (const c of chapters) {
      if (!/\u27E6GRAFICO:\d+\u27E7/.test(c.html)) continue;
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html;
      for (const p of Array.from(tpl.content.querySelectorAll('p'))) {
        const m = /^\s*\u27E6GRAFICO:(\d+)\u27E7\s*$/.exec(p.textContent);
        if (!m) continue;
        const spec = specs[Number(m[1])];
        if (!spec) { p.remove(); continue; }
        const s2 = Object.assign({}, spec, { mono: spec.mono || mono });
        const url = ChartDraw.draw(s2);
        const id = await App.addAsset({ dataUrl: url, name: 'Gráfico importado ' + (++count), width: 1800, height: 1100 });
        App.project.assets[id].chart = ChartDraw.normalize(s2);
        const t = document.createElement('template');
        t.innerHTML = App.editor.figureHtml(id, { width: 100, caption: p.dataset.caption || '' });
        p.replaceWith(t.content.firstChild);
      }
      c.html = tpl.innerHTML;
    }
    return count;
  }

  const KIND_NAMES = { html: 'Word / HTML', markdown: 'Markdown', doc: 'Word 97-2003 (.doc)', epub: 'EPUB', odt: 'OpenDocument (.odt)', pdf: 'PDF', text: 'Texto' };

  async function processImport(res) {
    if (!res) return;
    App.toast('Lendo o manuscrito…', 20000);
    let chapters;
    try { chapters = BookText.convertImport(res); } catch (e) { console.error(e); $('#toast').classList.remove('show'); return api.confirm('Não foi possível ler o arquivo.', String(e.message || e), ['OK']); }
    const notes = chapters.notes || 0;
    const meta = chapters.meta;
    chapters = chapters.filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img|<table/.test(c.html));
    const images = await convertImages(chapters);
    const charts = await convertCharts(chapters, res.charts);
    $('#toast').classList.remove('show');
    if (!chapters.length) return App.toast('Nenhum texto encontrado no arquivo.');
    const noteCount = chapters.reduce((s, c) => s + (c.html.match(/class="footnote"/g) || []).length, 0) || notes;
    const hasContent = App.project.chapters.some(c => BookText.countWords(c.html) > 0 && !/Era uma vez um livro que ainda não existia/.test(c.html));
    const words = chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    const mode = el('select', {}, [['replace', 'Substituir os capítulos atuais'], ['append', 'Adicionar ao final do livro']].map(([a, b]) => el('option', { value: a, text: b })));
    mode.value = hasContent ? 'append' : 'replace';
    const notesSel = el('select', {}, [['keep', 'Manter como notas de rodapé'], ['hide', 'Manter, mas ocultar no livro'], ['remove', 'Remover todas']].map(([a, b]) => el('option', { value: a, text: b })));
    const useMeta = el('input', { type: 'checkbox', checked: !!(meta && meta.title) && !hasContent });
    const warn = [];
    if (res.kind === 'pdf') warn.push('PDF não guarda a estrutura do texto: parágrafos, títulos e notas foram reconstruídos automaticamente pela posição das letras. Confira os títulos dos capítulos e as notas. Imagens do PDF não são importadas.');
    if (res.kind === 'doc') warn.push('Arquivos .doc antigos não preservam itálico/negrito na importação. Se possível, salve como .docx no Word e importe novamente.');
    // sumário que já vem no manuscrito: o livro gera o seu, com os números de página corretos
    const TOC_RE = /^(sum[áa]rio|[íi]ndice( geral)?|conte[úu]do|contents|table of contents)$/i;
    const tocChapters = chapters.filter(c => TOC_RE.test(String(c.title || '').replace(/<[^>]+>/g, '').trim()));
    const dropToc = el('input', { type: 'checkbox', checked: tocChapters.length > 0 });
    const tocText = tocChapters.map(c => c.html.replace(/<[^>]+>/g, ' ')).join(' ').toLowerCase();
    const subTitles = [];
    chapters.forEach(c => { const t = document.createElement('template'); t.innerHTML = c.html; t.content.querySelectorAll('h2').forEach(h => subTitles.push(h.textContent.trim().toLowerCase())); });
    const tocHasSections = subTitles.some(t => t.length > 3 && tocText.includes(t));
    const genreSel = el('select', {}, [el('option', { value: '', text: App.project.genre ? 'Manter o atual (' + (D.GENRE_PRESETS[App.project.genre] || {}).label + ')' : 'Manter a configuração atual' })].concat(Object.entries(D.GENRE_PRESETS).map(([k, p]) => el('option', { value: k, text: p.label }))));
    const list = el('ol', { class: 'import-list' }, chapters.slice(0, 80).map(c => el('li', { text: `${c.title}${c.numbered === false ? ' (sem número)' : ''} — ${BookText.countWords(c.html).toLocaleString('pt-BR')} palavras` })));
    App.modal({
      title: `Importar “${res.name}${res.ext || ''}”`, wide: true,
      body: el('div', {}, [
        el('p', { text: `${KIND_NAMES[res.kind] || res.kind}: ${chapters.length} capítulo(s), ${words.toLocaleString('pt-BR')} palavras, ${noteCount} nota(s) de rodapé, ${images} imagem(ns)${charts ? `, ${charts} gráfico(s) do Word (recriados e editáveis)` : ''}${(() => { const n = chapters.reduce((t, c) => t + (c.html.match(/class="comment"/g) || []).length, 0); return n ? `, ${n} comentário(s) de revisão (aparecem no editor, não no livro)` : ''; })()}. O texto será padronizado com os estilos do livro (fontes, tamanhos e espaçamentos do manuscrito são substituídos pela configuração atual).` }),
        warn.length ? el('div', { class: 'warn-box' }, warn.map(w => el('p', { text: '⚠ ' + w }))) : null,
        el('div', { class: 'grid' }, [App.field('Como importar', mode), App.field('Notas de rodapé', notesSel), App.field('Gênero do livro (estilos, títulos e alinhamento)', genreSel, 'Texto justificado; poesia alinhada à esquerda'),
          tocChapters.length ? el('label', { class: 'chk' }, [dropToc, ` Remover o sumário do manuscrito (“${tocChapters[0].title}”) e gerar o sumário automático com as páginas certas`]) : null,
          meta && meta.title ? el('label', { class: 'chk' }, [useMeta, ` Usar título/autor do arquivo (“${meta.title}”${meta.author ? ', ' + meta.author : ''})`]) : null]),
        el('h4', { text: 'Capítulos encontrados' }),
        list,
        chapters.length > 80 ? el('p', { class: 'muted', text: `… e mais ${chapters.length - 80}` }) : null
      ]),
      buttons: [{ label: 'Cancelar' }, { label: 'Importar', primary: true, onClick: async () => {
        App.flush();
        App.commit('Antes da importação');
        if (dropToc.checked) chapters = chapters.filter(c => !tocChapters.includes(c));
        const chs = chapters.map(c => ({ id: D.uid(), title: c.title, numbered: c.numbered !== false, html: c.html, locked: false, style: {}, separator: 'default', openingImage: null }));
        if (notesSel.value === 'remove') chs.forEach(c => { const t = document.createElement('template'); t.innerHTML = c.html; t.content.querySelectorAll('span.footnote').forEach(n => n.remove()); c.html = t.innerHTML; });
        if (notesSel.value === 'hide') App.project.settings.footnotesVisible = false;
        if (mode.value === 'replace') {
          const locked = App.project.chapters.filter(c => c.locked);
          App.project.chapters = locked.concat(chs);
          if (locked.length) App.toast(`${locked.length} capítulo(s) bloqueado(s) foram mantidos.`, 4000);
        } else App.project.chapters.push(...chs);
        if (useMeta.checked && meta) { if (meta.title) App.project.meta.title = meta.title.replace(/<[^>]+>/g, ''); if (meta.author) App.project.meta.author = meta.author.replace(/<[^>]+>/g, ''); if (meta.publisher) App.project.meta.publisher = meta.publisher.replace(/<[^>]+>/g, ''); }
        const f = App.project.front;
        if (dropToc.checked || chs.length > 1) { f.toc = true; if (dropToc.checked) { f.tocMode = 'auto'; f.tocLevels = Math.max(Number(f.tocLevels) || 1, tocHasSections ? 2 : 1); } }
        App.editorChapterId = null;
        if (genreSel.value) await App.genre.apply(genreSel.value, false);
        App.changed(`Importação de “${res.name}” (${chs.length} capítulos)`);
        App.setView('chapter', chs[0].id);
        App.toast(`${chs.length} capítulo(s) importado(s). A paginação é aplicada automaticamente.`, 4000);
      } }]
    });
  }

  App.importer = {
    fromDialog: async () => processImport(await api.importFile()),
    fromPath: async p => processImport(await api.importPath(p)),
    process: processImport
  };

  // ---------------------------------------------------------------- arquivos
  async function confirmDiscard() {
    if (!App.dirty) return true;
    const r = await api.askUnsaved();
    if (r === 'cancel') return false;
    if (r === 'save') return save(false);
    return true;
  }

  function loadProject(project, filePath, dirty) {
    App.editorChapterId = null;
    App.project = D.normalizeProject(project);
    // padroniza a formatação do texto ao abrir: o livro inteiro segue os estilos configurados
    App.project.chapters.forEach(c => { c.html = BookText.normalizeStyles(c.html); });
    ['bio', 'extra'].forEach(k => { const b = App.project.back[k]; if (b && b.html) b.html = BookText.normalizeStyles(b.html); });
    App.filePath = filePath || null;
    App.dirty = !!dirty;
    App.selection.clear();
    App.selectMode = false;
    App.chapterId = App.project.chapters.length ? App.project.chapters[0].id : null;
    App.lastRender = null;
    App.updateTitle();
    App.resetHistory('Livro aberto');
    App.setView(App.chapterId ? 'chapter' : 'book', undefined, { noFlush: true });
    App.genre.sync();
    App.preview.resetMode();
    App.preview.schedule(true);
    setTimeout(() => App.fontsUi.checkMissing(false), 1500);
  }
  App.loadProject = loadProject;

  async function newBook() {
    if (!(await confirmDiscard())) return;
    const kind = await new Promise(res => {
      let done = false;
      const pick = k => { if (!done) { done = true; res(k); } App.closeModal(); };
      const opt = (k, title, desc) => el('button', { class: 'kind-card', onclick: () => pick(k) }, [el('strong', { text: title }), el('span', { class: 'small muted', text: desc })]);
      App.modal({ title: 'Novo projeto', body: el('div', { class: 'kind-cards' }, [
        opt('book', '📖 Livro', 'Romance, poesia, contos, não ficção… Página de rosto, ficha, sumário e capítulos.'),
        opt('magazine', '📰 Revista', 'Matérias em 2 colunas, nome da revista, chapéu, linha fina e assinatura.'),
        opt('newspaper', '🗞 Jornal', 'Tabloide em 3 colunas com fios, nome do jornal, edição e data.')
      ]), buttons: [{ label: 'Cancelar', onClick: () => { done = true; res(null); } }], onClose: () => { if (!done) { done = true; res(null); } } });
    });
    if (!kind) return;
    loadProject(await api.newProject(), null, false);
    api.autosaveClear();
    if (kind !== 'book') { App.periodical.applyKind(kind); App.resetHistory('Novo projeto'); App.changed(null); App.dirty = false; App.updateTitle(); App.setView('periodical'); }
    else App.setView('book');
  }

  async function open(filePath) {
    if (!(await confirmDiscard())) return;
    const res = await api.openProject(filePath);
    if (!res) return;
    loadProject(res.project, res.filePath, false);
    api.autosaveClear();
    App.toast('Livro aberto: ' + App.fileName(res.filePath));
  }

  async function save(saveAs) {
    const res = await api.saveProject(App.serialize(), App.filePath, saveAs);
    if (!res) return false;
    App.filePath = res.filePath;
    App.dirty = false;
    App.updateTitle();
    api.autosaveClear();
    App.toast('Salvo em ' + App.fileName(res.filePath));
    return true;
  }

  function help() {
    App.modal({
      title: 'Como usar', wide: true,
      body: el('div', { class: 'help' }, [
        el('ol', {}, [
          ['Importar', 'traga o manuscrito (DOCX, DOC, EPUB, PDF, ODT, TXT, Markdown). Títulos viram capítulos e as notas de rodapé são preservadas. A paginação é automática.'],
          ['Formato e diagramação', 'o padrão é o modelo CEDET (15,5 × 23, 13,7 × 21 ou 11,5 × 17,5 cm, margem de segurança de 20 mm, sangria de 5 mm e marcas de corte; exporte com o perfil “CEDET — miolo”); escolha outro tamanho, margens espelhadas, sangria, capitulares, cabeçalhos e uma configuração pronta por gênero. “★ Salvar como meu padrão” guarda suas escolhas para os próximos livros.'],
          ['Estilos de texto', 'ajuste fonte, tamanho, cor e espaçamentos do texto, dos títulos (T1, T2, T3), citações, poesias, referências, notas e legendas.'],
          ['Capítulos', 'clique para editar; ☑ seleciona vários para editar cor da página, fontes e títulos de uma vez; 🔒 bloqueia contra edição e exclusão.'],
          ['Imagens', 'arraste da Biblioteca ou do computador para o texto. Clique numa imagem para tamanho, alinhamento, contorno do texto, recorte, rotação e substituição. Separadores vão no título do capítulo.'],
          ['Camadas da página', 'para elementos em posição fixa (mm): fundos, molduras, composições de imagens, textos decorativos. Arraste na prévia; há encaixe em margens e centro.'],
          ['Páginas iniciais e finais', 'página de rosto com logotipo, créditos e ficha catalográfica completa (com imagens e QR codes), biografia e conteúdo extra.'],
          ['Sumário', 'automático a partir dos títulos (capítulos, T1, T2) ou manual e editável, em “Dados e páginas iniciais”. Ordem padrão: rosto › ficha › sumário › capítulos › páginas finais.'],
          ['Prévia', 'role o livro página por página ou veja 2 a 5 páginas lado a lado. No modo “1 página por vez”, os botões ao lado de cada página mudam a cor da página e do texto, bloqueiam o capítulo (cadeado) e inserem uma página de imagem sangrada. Arraste imagens direto para o texto de qualquer página.'],
          ['Biblioteca de estilos', 'um estilo pronto para cada gênero, aplicado ao livro inteiro com um clique.'],
          ['Tipografia e paginação', 'acabamento automático: grade de linha de base (linhas alinhadas nas páginas opostas), justificação fina, exceções de hifenização, índice remissivo (📇 Índice no editor), referências cruzadas (↪ Referência: “ver Figura 3, p. 41”), notas de fim ou laterais, romanos nas pré-textuais, normas ABNT (ABNT ▾) e modelos de sumário.'],
          ['Capa e lombada', 'no padrão CEDET, gera o código de barras do ISBN (EAN-13 preto, vetorial) na contracapa, marcas de corte e de dobra e orelhas de 6, 7 ou 8 cm; monte a capa com imagens prontas (sempre sem bordas brancas, com correção de cor e nitidez) e veja o livro em 3D, girando para todos os lados, com opção de salvar em PNG transparente; as medidas vêm do livro (ou de um manuscrito, ou digitadas). Saída em PDF CMYK para gráfica (PDF/X-1a, perfil ICC), com sangria automática ou manual.'],
          ['Amazon KDP', 'brochura (16 tamanhos) e capa dura (5 tamanhos): confere páginas, margens e sangria e envia as medidas para a capa.'],
          ['Revista e jornal', 'em “Novo”, escolha Revista ou Jornal: colunas fixas (2 ou 3), nome da publicação, chapéu, linha fina e assinatura.'],
          ['Exportar', 'perfis prontos (gráfica, KDP, impressão sob demanda, PDF digital, prova, EPUB). A verificação de pré-impressão aponta problemas e leva você à página.']
        ].map(([t, d]) => el('li', {}, [el('b', { text: t + ': ' }), d]))),
        el('p', { class: 'muted', text: 'Tudo é processado e salvo no seu computador — o aplicativo não acessa a internet. Projetos são arquivos .livro; há salvamento automático de recuperação e cópia de segurança (.bak) a cada salvamento.' })
      ]),
      buttons: [{ label: 'Entendi', primary: true }]
    });
  }

  const commands = {
    new: newBook, open: () => open(), save: () => save(false), saveAs: () => save(true),
    import: () => App.importer.fromDialog(), export: () => App.setView('export'),
    refresh: () => App.preview.schedule(true), help,
    projectUndo: () => App.undo(), projectRedo: () => App.redo(), history: () => App.showHistory(),
    library: () => App.library.toggle(), find: () => App.tools.find(),
    invisibles: () => { $('#editor').classList.toggle('show-invisibles'); }
  };
  function runCommand(cmd) {
    if (cmd.startsWith('openPath:')) return open(cmd.slice(9));
    const fn = commands[cmd];
    if (fn) fn();
  }
  App.runCommand = runCommand;

  // arrastar manuscritos, projetos .livro ou fontes para qualquer lugar da janela
  function setupWindowDrop() {
    window.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', e => {
      if (e.defaultPrevented) return;
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;
      e.preventDefault();
      const p = api.pathForFile(files[0]);
      if (/\.livro$/i.test(p)) return open(p);
      if (/\.(docx?|epub|pdf|odt|txt|md|markdown|html?|rtf)$/i.test(p)) return App.importer.fromPath(p);
      if (/\.(ttf|otf|ttc|woff2?)$/i.test(p)) return api.fontsAddPaths(files.map(f => api.pathForFile(f))).then(r => App.toast(`${(r.added || []).length} estilo(s) de fonte adicionado(s) à biblioteca.`));
      App.toast('Para imagens, solte sobre o texto, a lista de capítulos, a biblioteca ou uma página da prévia.');
    });
  }

  async function init() {
    App.editor.setup();
    App.preview.setup();
    $('#genreSlot').appendChild(App.genre.select());
    $$('[data-cmd]').forEach(b => b.addEventListener('click', () => runCommand(b.dataset.cmd)));
    $$('.nav-item').forEach(b => b.addEventListener('click', () => App.setView(b.dataset.view)));
    $('#modulesToggle').addEventListener('click', () => { $('#modulesToggle').classList.toggle('open'); $('#modulesList').classList.toggle('open'); });
    $('#addChapter').addEventListener('click', () => App.chapters.add());
    $('#selectMode').addEventListener('click', () => { App.selectMode = !App.selectMode; if (!App.selectMode) App.selection.clear(); App.renderChapterList(); });
    api.onMenu(runCommand);
    api.onRequestClose(async () => {
      App.flush();
      if (await confirmDiscard()) { await api.autosaveClear(); api.closeConfirmed(); }
    });
    setInterval(App.autosave, 60000);
    setupWindowDrop();
    await App.refreshFonts();
    try { App.D.applyFormatOverrides(await api.formatsGet()); } catch (e) { /* sem medidas editadas */ }

    const pending = await api.pendingOpen();
    if (pending) {
      const res = await api.openProject(pending);
      if (res) { loadProject(res.project, res.filePath, false); return; }
    }
    const rec = await api.autosaveRead();
    if (rec && rec.project) {
      const when = new Date(rec.savedAt).toLocaleString('pt-BR');
      const r = await api.confirm('Recuperar trabalho não salvo?', `Encontramos alterações salvas automaticamente em ${when}${rec.filePath ? ' (' + App.fileName(rec.filePath) + ')' : ''}.`, ['Recuperar', 'Descartar']);
      if (r === 0) { loadProject(rec.project, rec.filePath, true); return; }
      api.autosaveClear();
    }
    loadProject(await api.newProject(), null, false);
    try { if (!localStorage.getItem('helpShown2')) { localStorage.setItem('helpShown2', '1'); help(); } } catch (e) { /* ok */ }
  }

  init();
})();
