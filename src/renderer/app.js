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
  const TOC_RE = /^(sum[áa]rio|[íi]ndice( geral)?|conte[úu]do|contents|table of contents)$/i;
  const isSample = () => !App.project.chapters.some(c => BookText.countWords(c.html) > 0 && !/Era uma vez um livro que ainda não existia/.test(c.html));

  // Importação automática: títulos, capítulos, notas, tema padrão, sumário e paginação — sem perguntas.
  // O registro de cada etapa aparece na tela; no fim, um resumo com os próximos passos.
  async function processImport(res) {
    const P = App.progress;
    if (!res) { P.close(); return; }
    if (!P.active) P.open('Carregando o livro', 'Títulos, capítulos, paginação e sumário são aplicados automaticamente');
    const t0 = Date.now();
    P.log(`Formato: ${KIND_NAMES[res.kind] || res.kind}`);
    P.log('Identificando a estrutura: títulos, capítulos e notas…');
    await new Promise(r => setTimeout(r, 30));
    let chapters;
    try { chapters = BookText.convertImport(res); } catch (e) { console.error(e); return P.fail('Não foi possível ler o arquivo: ' + String(e.message || e)); }
    const notes = chapters.notes || 0;
    const meta = chapters.meta;
    const det = chapters.detected;
    chapters = chapters.filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img|<table/.test(c.html));
    if (!chapters.length) return P.fail('Nenhum texto encontrado no arquivo.');
    if (det && det.plain) P.log(`Livro sem títulos marcados: ${det.count} título(s) reconhecido(s) por linhas curtas isoladas`);
    else if (det) P.log(`${det.count} capítulos reconhecidos pelos marcadores do texto (“${det.labeled ? 'CAPÍTULO ' : ''}${det.style === 'roman' ? 'I, II, III' : '1, 2, 3'}”)`);
    else P.log(`${chapters.length} parte(s) pelos títulos do arquivo`);
    chapters.slice(0, 6).forEach((c, i) => P.log(`   ${i + 1}. ${c.title}`));
    if (chapters.length > 6) P.log(`   … e mais ${chapters.length - 6}`);
    // sumário que vinha no manuscrito: sai (o livro gera o seu, com as páginas certas)
    const tocChapters = chapters.filter(c => TOC_RE.test(String(c.title || '').replace(/<[^>]+>/g, '').trim()));
    if (tocChapters.length) { chapters = chapters.filter(c => !tocChapters.includes(c)); P.log('Sumário do manuscrito removido (o sumário automático o substitui)'); }
    const images = await convertImages(chapters);
    if (images) P.log(`${images} imagem(ns) incorporada(s)`);
    const charts = await convertCharts(chapters, res.charts);
    if (charts) P.log(`${charts} gráfico(s) do Word recriado(s)`);
    const noteCount = chapters.reduce((s, c) => s + (c.html.match(/class="footnote"/g) || []).length, 0) || notes;
    if (noteCount) P.log(`${noteCount} nota(s) de rodapé preservada(s)`);
    const words = chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    P.log(`${words.toLocaleString('pt-BR')} palavras`);
    // livro atual com conteúdo: substituir, adicionar ou cancelar
    let mode = 'replace';
    if (!isSample()) {
      const b = await api.confirm('Já há um livro aberto', 'O novo arquivo substitui o livro atual ou entra no final dele?', ['Substituir pelo novo livro', 'Adicionar ao final', 'Cancelar']);
      if (b === 2 || b === -1) return P.fail('Importação cancelada.');
      mode = b === 1 ? 'append' : 'replace';
    }
    App.flush();
    App.commit('Antes da importação');
    const chs = chapters.map(c => ({ id: D.uid(), title: c.title, numbered: c.numbered !== false, html: c.html, locked: false, style: {}, separator: 'default', openingImage: null }));
    const p = App.project;
    if (mode === 'replace') {
      const locked = p.chapters.filter(c => c.locked);
      p.chapters = locked.concat(chs);
      // título e autor: do arquivo, do começo do texto ou do nome do arquivo
      const clean = t => String(t || '').replace(/<[^>]+>/g, '').trim();
      const title = clean(meta && meta.title) || (/^(meu livro|sem título)?$/i.test(p.meta.title || '') ? clean(res.name).replace(/[_-]+/g, ' ') : '');
      if (title) p.meta.title = title;
      if (meta && meta.author) p.meta.author = clean(meta.author);
      if (meta && meta.publisher) p.meta.publisher = clean(meta.publisher);
      P.log(`Título: “${p.meta.title}”${p.meta.author ? ' · ' + p.meta.author : ''}`);
    } else p.chapters.push(...chs);
    // tema padrão: numeração dos capítulos como no manuscrito, sumário automático, números de página
    if (det) { p.settings.chapterNumbering = det.style === 'words' ? 'arabic' : det.style; p.settings.chapterLabel = det.labeled ? 'Capítulo' : ''; }
    p.front.toc = true;
    p.front.tocMode = 'auto';
    if (!p.settings.pageNumbers || p.settings.pageNumbers === 'none') p.settings.pageNumbers = 'outer';
    P.log('Aplicando o tema padrão: estilos, margens, títulos, numeração de páginas e sumário automático');
    App.editorChapterId = null;
    App.changed(`Importação de “${res.name}” (${chs.length} capítulos)`);
    App.setView('chapter', chs[0].id);
    if (App.preview.resetMode) App.preview.resetMode();
    P.log('Paginando…');
    P.whenPaged(info => {
      P.done('Livro pronto', [`${chs.length} capítulo(s) · ${info.pages} páginas · sumário gerado · ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`], [
        { label: 'Revisar títulos', onClick: () => App.titles.open() },
        { label: 'Capa e imagens', onClick: () => App.setView('frontimages') },
        { label: 'Exportar', onClick: () => App.setView('export') },
        { label: 'Ver o livro', primary: true }
      ]);
    });
  }

  App.importer = {
    fromDialog: async () => { App.progress.expect('Carregando o livro', 'Títulos, capítulos, paginação e sumário são aplicados automaticamente'); return processImport(await api.importFile()); },
    fromPath: async p => { App.progress.expect('Carregando o livro', 'Títulos, capítulos, paginação e sumário são aplicados automaticamente'); return processImport(await api.importPath(p)); },
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
    if (App.workspace) App.workspace.mark();
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
          ['Enviar um livro', 'envie qualquer arquivo (Word, PDF, EPUB, ODT, TXT, Markdown), mesmo sem formatação: títulos, capítulos, tema padrão, paginação, números de página e sumário são aplicados sozinhos. Confira os títulos em Livro › Revisar títulos.'],
          ['Capa e imagens iniciais', 'a capa abre o livro em página inteira e é a capa do EPUB; imagens extras vêm antes da página de rosto. Ao escolher a capa, informe a sinopse (vai para os metadados do EPUB).'],
          ['Não é um título', 'clique num título errado na página e use “Não é um título”: ele volta ao texto corrido. Reverta pela lista ↺ acima dos capítulos.'],
          ['Imagens', 'arraste para qualquer ponto da página: à esquerda/direita o texto corre ao lado; no centro, o texto contorna a imagem dos dois lados (até no meio de um parágrafo). Para mover uma imagem do livro, segure e arraste com o mouse. Clique na imagem para redimensionar pelas alças, pôr legenda, caixa de texto, recortar ou remover o fundo.'],
          ['Tradução', 'botão Tradução no topo: envie livros (EPUB, DOCX, DOC) em qualquer idioma; o sistema limpa as páginas extras e os avisos do Gutenberg, traduz como um tradutor literário sênior (Claude, com chave da API, ou um modelo local pelo Ollama), aplica travessões nos diálogos, o Novo Acordo Ortográfico, o dicionário de estilo e a pontuação, salva o DOCX no padrão do app em Downloads e mostra o relatório com parecer, mudanças e correções — salvável em PDF.'],
          ['Melhoramento', 'botão Melhoramento no topo: envie um ou vários EPUBs do Project Gutenberg e clique em Iniciar. O sistema tira avisos do Gutenberg, rosto, dedicatória, sumário original e páginas finais, mantém os capítulos, monta o nosso sumário e salva um DOCX com os estilos do app na pasta Downloads, um livro após o outro, com log.'],
          ['Imersão', 'menu Design › Imersão: escolha uma imagem para o alto de todos os capítulos, ou várias e “Randomizar” (uma por capítulo, sem repetir em seguida). Ao enviar imagens do computador, escolha a categoria de cada uma (ou arraste os arquivos para a aba da categoria). Na mesma tela, Molduras em preto e branco (clássicas, vitorianas e de terror, ou as suas): “Aplicar à página” (capítulo aberto), “Em todos os capítulos” ou “Todas as páginas” (menos as aberturas com imagem de imersão).'],
          ['Editora e logotipo', 'em Créditos e ficha: “Editoras…” cadastra os nomes (ficam salvos); escolher a editora atualiza a ficha e o rosto na hora. Envie logotipos e clique num deles para pô-lo no rosto, abaixo do título, com “Impresso no Brasil / Sorriso, MT”.'],
          ['Editar nas páginas', 'clique em qualquer parágrafo do livro e digite: o texto é editado na própria página, e o capítulo se repagina sozinho logo depois. A barra acima das páginas (títulos, negrito, notas, imagens…) age onde está o cursor. Selecione um trecho para colocá-lo numa caixa de texto ou de citação (▢ Caixa ▾ / ❝ Citação ▾).'],
          ['Formato e diagramação', 'o padrão é o modelo CEDET (15,5 × 23, 13,7 × 21 ou 11,5 × 17,5 cm, margem de segurança de 20 mm, sangria de 5 mm e marcas de corte; exporte com o perfil “CEDET — miolo”); escolha outro tamanho, margens espelhadas, sangria, capitulares, cabeçalhos e uma configuração pronta por gênero. “★ Salvar como meu padrão” guarda suas escolhas para os próximos livros.'],
          ['Estilos de texto', 'ajuste fonte, tamanho, cor e espaçamentos do texto, dos títulos (T1, T2, T3), citações, poesias, referências, notas e legendas. Estilos de caractere (Ênfase, Versalete, Termo estrangeiro…) valem para trechos: selecione o trecho na página e use “Aa Estilo ▾”; mudar o estilo muda todos os trechos do livro.'],
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
          ['Revista e jornal', 'use o seletor Livro | Revista e jornal no topo: é uma mesa separada, com projeto, formato e exportação próprios. Colunas fixas (2 ou 3), nome da publicação, chapéu, linha fina e assinatura.'],
          ['Blocos e páginas sangradas', 'blocos de imagem cinza (horizontal ou vertical) com legenda de teste: no preview, “+” escolhe a imagem, “Legenda” liga/desliga e ✕ remove. Páginas sangradas opcionais antes/depois de cada matéria ou capítulo, em página dupla, com box de legenda ou texto informativo.'],
          ['Colunas num trecho', 'selecione o texto (editor ou páginas) › botão direito › Dividir em 2 ou 3 colunas. Só o trecho vai para colunas; imagens, caixas, tabelas e títulos ficam fora, intactos. Botão direito dentro do trecho: mudar colunas, fio entre colunas ou remover.'],
          ['Subtítulos em caixa alta', 'T1/T2 em caixa alta, sem serifa em negrito e letras espaçadas (Josefin Sans). Ajuste fonte, tamanho, entrelinha e posição em Estilos de texto; em livros já existentes, use “✦ Caixa alta espaçada” no cartão do T1/T2.'],
          ['Estilos de sumário', 'botão “✦ Estilos de sumário…” (Dados e páginas iniciais › Sumário, ou Tipografia e paginação): 18 estilos — fontes grandes, grossas ou finas, molduras simples/dupla/grossa/cantoneiras e faixas imersivas até o corte (direita, esquerda, alto, base, moldura nos quatro lados, página escura), com a cor que você escolher.'],
          ['Colar tabelas e gráficos', 'Ctrl+V de tabelas do Excel, Word, LibreOffice ou Google Planilhas mantém cores, bordas, negrito e alinhamentos de cada célula e a proporção das colunas; no livro a tabela só é encaixada na largura da página (letra menor quando necessário, sem partir palavras). Gráficos e imagens coladas viram imagens do projeto, dentro dos limites da página.'],
          ['Estilos de título', 'título em caixa preta fina (letra branca), caixa branca fina (letra preta) ou só contorno, à esquerda, centro ou direita — para todos ou por capítulo.'],
          ['Caixas de texto', 'em Blocos e páginas sangradas, “Caixa de texto”: só o texto aparece. Clique nela no preview para pôr na lateral (o texto segue pela margem), no centro (contorno dos dois lados) ou em faixa, mudar largura e estilo, e o seletor Contorno: Manter (a caixa aparece como no preview, também no PDF) ou Remover (só a frase).'],
          ['Exportar', 'perfis prontos (gráfica, KDP, impressão sob demanda, PDF digital, prova, EPUB). A verificação de pré-impressão aponta problemas e leva você à página.']
        ].map(([t, d]) => el('li', {}, [el('b', { text: t + ': ' }), d]))),
        el('p', { class: 'muted', text: 'Tudo é processado e salvo no seu computador — o aplicativo não acessa a internet. Projetos são arquivos .livro; há salvamento automático de recuperação e cópia de segurança (.bak) a cada salvamento.' })
      ]),
      buttons: [{ label: 'Entendi', primary: true }]
    });
  }

  const commands = {
    new: newBook, open: () => open(), save: () => save(false), saveAs: () => save(true),
    import: () => App.importer.fromDialog(), export: () => App.setView('export'), enhance: () => App.enhance.open(), translate: () => App.translate.open(),
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
    welcome();
  }

  // ---------------------------------------------------------------- boas-vindas
  function welcome() {
    const go = fn => () => { back.classList.add('out'); setTimeout(() => back.remove(), 260); if (fn) fn(); };
    const card = (icon, title, text, fn, main) => el('button', { class: 'wl-card' + (main ? ' main' : ''), onclick: go(fn) }, [
      el('span', { class: 'wl-ic', html: App.icons ? App.icons.svg(icon) : '' }),
      el('span', { class: 'wl-ct' }, [el('b', { text: title }), el('span', { text })])
    ]);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const back = el('div', { class: 'wl-back' }, [el('div', { class: 'wl-card-box' }, [
      el('div', { class: 'wl-brand', html: '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#0d0d0f"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="20"><path d="M106 262 L256 136 L406 262"/><path d="M160 222 V372 H352 V222"/><path d="M232 372 V318 A24 24 0 0 1 280 318 V372"/><path d="M318 186 V150 H342 V206"/></g></svg>' }),
      el('p', { class: 'wl-hello', text: hello + ',' }),
      el('h1', { class: 'wl-title' }, ['Bem-vindo à ', el('span', { text: 'Casa Vertigem Hub' })]),
      el('p', { class: 'wl-sub', text: 'Envie um livro e o resto é automático: títulos, capítulos, paginação, números de página e sumário. Depois é só ajustar o que quiser e baixar.' }),
      el('div', { class: 'wl-actions' }, [
        card('upload', 'Enviar um livro', 'Word, PDF, EPUB, ODT, TXT ou Markdown', () => App.importer.fromDialog(), true),
        card('folder', 'Abrir um projeto', 'Continuar um livro salvo (.livro)', () => runCommand('open')),
        card('plus', 'Começar do zero', 'Livro, revista ou jornal em branco', () => runCommand('new')),
        card('sparkles', 'Melhoramento', 'EPUBs do Gutenberg → DOCX no padrão, um ou vários', () => App.enhance.open()),
        card('globe', 'Tradução', 'Qualquer idioma → português do Brasil, em DOCX no padrão', () => App.translate.open())
      ]),
      el('button', { class: 'wl-skip', text: 'Entrar no aplicativo →', onclick: go() }),
      el('p', { class: 'wl-foot', text: 'Tudo fica no seu computador e funciona sem internet — só a tradução com o Claude usa a internet.' })
    ])]);
    document.body.appendChild(back);
  }
  App.welcome = welcome;

  init();
})();
