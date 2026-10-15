/* global App, BookText */
// Melhoramento: EPUBs do Project Gutenberg viram DOCX no padrão do livro (títulos, alinhamento, tamanho do
// texto, parágrafos e sumário do sistema), gravados no lugar do EPUB (que vai para a Lixeira) ou em Downloads. Tira avisos e licença do Gutenberg,
// capa, folha de rosto, créditos, notas do transcritor, dedicatória, sumário e listas do arquivo — fica só
// o texto dos capítulos. Um livro ou vários, um depois do outro, com registro de cada etapa.
(function () {
  const { el, $, api, D } = App;
  const queue = []; // { path, name, status: 'wait'|'run'|'ok'|'err', out, msg }
  let running = false;
  let screen = null, logBox = null, listBox = null, dlDir = '';

  const FRONT_RE = /^(contents|table of contents|sum[áa]rio|[íi]ndice|conte[úu]do|list of illustrations|illustrations|lista de ilustra[çc][õo]es|dedication|dedicat[óo]ria|to the (children|reader)|transcriber'?s? notes?|nota do transcritor|copyright|title page|errata|preface to the (\w+ )?edition|publisher'?s? note|acknowledg(e)?ments?|agradecimentos?|about (the|this) (author|book|e-?book)|by the same author|also by|frontispiece|half-title)\b/i;
  const BACK_RE = /^(footnotes?|notes?|notas?|transcriber'?s? notes?|nota do transcritor|advertisements?|an[úu]ncios|catalog(ue)?|books by|also by|other books|index|[íi]ndice remissivo|glossary|gloss[áa]rio|the full project gutenberg|end of (the )?project gutenberg|colophon|colofão)\b/i;
  const KEEP_BEFORE_RE = /^(pr[óo]logo|prologue|prelude|prel[úu]dio|introdu[çc][ãa]o|introduction|pre[âa]mbulo)\b/i;
  const END_RE = /^(the end|fim|finis|the end\.|fim\.)$/i;

  const clean = t => String(t || '').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();
  const decode = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return clean(t.value); };

  // ---------------------------------------------------------------- limpeza
  function cleanGutenberg(res, log) {
    const root = document.createElement('div');
    (res.docs || []).forEach(d => {
      // capa (página de imagem do ebookmaker)
      if (/x-ebookmaker-cover/.test(d.bodyAttrs || '') || /^coverpage/i.test(d.id || '')) { log('· capa do arquivo removida'); return; }
      const box = document.createElement('div');
      box.innerHTML = d.html;
      root.appendChild(box);
    });
    let n = 0;
    // avisos, cabeçalho e licença do Project Gutenberg
    root.querySelectorAll('[id^="pg-header"], [id^="pg-footer"], #pg-machine-header, #pg-start-separator, #pg-end-separator, .pg-boilerplate, .pgheader, .pgfooter, [id*="pg-license"], .x-ebookmaker-cover, .x-ebookmaker-coverpage').forEach(x => { x.remove(); n++; });
    // formato antigo: “*** START OF THE PROJECT GUTENBERG …” / “*** END OF …”
    const all = () => Array.from(root.querySelectorAll('p, div, pre, h1, h2, h3, h4, h5, h6'));
    const start = all().find(x => /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(x.textContent));
    if (start) { removeBefore(root, start); start.remove(); n++; }
    const end = all().find(x => /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(x.textContent) || /^End of (the )?Project Gutenberg/i.test(clean(x.textContent)));
    if (end) { removeAfter(root, end); end.remove(); n++; }
    if (n) log(`· ${n} bloco(s) de avisos e licença do Project Gutenberg removido(s)`);
    // números de página do original, âncoras e notas do transcritor
    root.querySelectorAll('span.pagenum, .pagenum, a.pagenum, span[class*="pagenum"]').forEach(x => x.remove());
    let tn = 0;
    root.querySelectorAll('p, div, blockquote').forEach(x => { if (x.isConnected && /^\[?\s*transcriber'?s? note/i.test(clean(x.textContent)) && x.textContent.length < 3000) { x.remove(); tn++; } });
    if (tn) log(`· ${tn} nota(s) do transcritor removida(s)`);
    // notas de rodapé do Gutenberg ([1] -> nota de rodapé do livro)
    const fnCount = convertFootnotes(root);
    if (fnCount) log(`· ${fnCount} nota(s) de rodapé convertida(s)`);
    // quebras de linha dentro de títulos viram espaço (“CHAPTER 1<br>Título” -> “CHAPTER 1 Título”)
    root.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(h => {
      if (h.tagName === 'P' && h.textContent.length > 160) return;
      h.querySelectorAll('br').forEach(b => b.replaceWith(document.createTextNode(' ')));
    });
    // layout do original: alinhamentos e posição das figuras vindos das classes do Gutenberg
    root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(x => {
      if (x.style.textAlign) return;
      const c = ' ' + (x.className || '').toLowerCase() + ' ';
      if (/ (center|centered|c|tac|caption|figcenter|centerpar|centertext) /.test(c)) x.style.textAlign = 'center';
      else if (/ (right|r|tar|signature|sig|rightalign|textright) /.test(c)) x.style.textAlign = 'right';
      else if (/ (noindent|no-indent|nind|ni|first) /.test(c) && x.tagName === 'P') x.classList.add('no-indent');
    });
    // parágrafos com classe de título (ph2/ph3) viram títulos de verdade
    root.querySelectorAll('p.ph1, p.ph2, p.ph3, p[class*="title"]').forEach(p => { const h = document.createElement(p.classList.contains('ph1') ? 'h1' : 'h2'); h.innerHTML = p.innerHTML; p.replaceWith(h); });

    // sequência de blocos (achata divisões de capítulo, mantendo figuras, poesia e tabelas inteiras)
    const flat = [];
    const keepWhole = n2 => n2.matches('table, figure, ul, ol, blockquote, .poetry, .poem, .figcenter, .image-center, .figure, .illustration, .caption');
    const push = node => {
      if (node.nodeType === 3) { if (node.nodeValue.trim()) { const p = document.createElement('p'); p.textContent = node.nodeValue.trim(); flat.push(p); } return; }
      if (node.nodeType !== 1) return;
      if (/^(DIV|SECTION|ARTICLE|MAIN|BODY)$/.test(node.tagName) && !keepWhole(node) && node.querySelector('p, h1, h2, h3, h4, h5, h6, div')) { Array.from(node.childNodes).forEach(push); return; }
      flat.push(node);
    };
    Array.from(root.childNodes).forEach(push);

    // começo do texto: o primeiro capítulo (ou prólogo/introdução logo antes dele)
    const text = x => clean(x.textContent);
    const isHead = x => /^H[1-4]$/.test(x.tagName);
    const markers = BookText.chapterMarkers(flat);
    let first = -1;
    if (markers) first = Math.min(...markers.at.keys());
    if (first < 0) {
      // sem “CHAPTER N”: o primeiro título que não é página pré-textual nem o título da obra
      const title = clean(decode(res.meta && res.meta.title)).toLowerCase();
      first = flat.findIndex((x, i) => isHead(x) && !FRONT_RE.test(text(x)) && text(x).toLowerCase() !== title && i > 0 && flat.slice(i + 1, i + 4).some(y => y.tagName === 'P' && text(y).length > 120));
    }
    if (first > 0) {
      // um prólogo/introdução antes do primeiro capítulo continua
      for (let i = first - 1; i >= 0; i--) if (isHead(flat[i]) && KEEP_BEFORE_RE.test(text(flat[i]))) { first = i; break; }
      const dropped = flat.slice(0, first);
      const heads = dropped.filter(isHead).map(text).filter(Boolean).slice(0, 6);
      log(`· páginas pré-textuais removidas (${dropped.length} blocos${heads.length ? ': ' + heads.join(' · ') : ''})`);
      flat.splice(0, first);
    }
    // fim do texto: “THE END”/“FIM” e seções pós-textuais (notas, anúncios, índice, licença…)
    let cut = flat.findIndex(x => END_RE.test(text(x)));
    if (cut >= 0 && cut < flat.length) { log(`· “${text(flat[cut])}” e o que vem depois removidos`); flat.splice(cut); }
    for (let i = 0; i < flat.length; i++) {
      if (isHead(flat[i]) && BACK_RE.test(text(flat[i])) && !(markers && markers.at.has(i))) {
        const rest = flat.slice(i).filter(isHead).map(text);
        const anyChapterAfter = flat.slice(i + 1).some(y => isHead(y) && BookText.chapterMark(text(y), y.tagName));
        if (!anyChapterAfter) { log(`· páginas pós-textuais removidas: ${rest.slice(0, 5).join(' · ')}`); flat.splice(i); break; }
      }
    }
    // dedicatória/sumário/listas que sobraram no meio (sumário do arquivo dá lugar ao do sistema)
    for (let i = 0; i < flat.length; i++) {
      if (isHead(flat[i]) && FRONT_RE.test(text(flat[i]))) {
        let j = i + 1;
        while (j < flat.length && !isHead(flat[j])) j++;
        log(`· “${text(flat[i])}” removido`);
        flat.splice(i, j - i);
        i--;
      }
    }
    // tabelas de sumário sem título e imagens decorativas soltas sem texto ao lado
    for (let i = flat.length - 1; i >= 0; i--) {
      const x = flat[i];
      if (x.tagName === 'TABLE' && /contents/i.test(x.getAttribute('summary') || x.getAttribute('data-summary') || '')) flat.splice(i, 1);
      else if (x.tagName === 'HR') flat.splice(i, 1);
    }
    return flat.map(x => x.outerHTML).join('');
  }
  function removeBefore(root, node) {
    let cur = node;
    while (cur && cur !== root) { let p = cur.previousSibling; while (p) { const q = p.previousSibling; p.remove(); p = q; } cur = cur.parentNode; }
  }
  function removeAfter(root, node) {
    let cur = node;
    while (cur && cur !== root) { let n2 = cur.nextSibling; while (n2) { const q = n2.nextSibling; n2.remove(); n2 = q; } cur = cur.parentNode; }
  }
  function convertFootnotes(root) {
    let c = 0;
    root.querySelectorAll('a[href^="#"]').forEach(a => {
      const href = a.getAttribute('href').slice(1);
      if (!/^(Footnote|fn|note|FN|f\d)/i.test(href) && !a.classList.contains('fnanchor') && !/^\[?\d+\]?$|^\[[A-Z*]\]$/.test(clean(a.textContent))) return;
      const target = root.querySelector(`[id="${CSS.escape(href)}"]`) || root.querySelector(`a[name="${CSS.escape(href)}"]`);
      if (!target) return;
      const holder = target.closest('.footnote, div, p') || target;
      if (holder.contains(a)) return;
      const tmp = holder.cloneNode(true);
      tmp.querySelectorAll('a.label, a[href^="#Footnote"], a[href^="#FNanchor"], a[href^="#fnanchor"]').forEach(x => x.remove());
      const txt = clean(tmp.textContent).replace(/^\[?\d+\]?\s*/, '');
      if (!txt) return;
      const sp = document.createElement('span');
      sp.className = 'footnote';
      sp.textContent = txt;
      (a.closest('sup') || a).replaceWith(sp);
      holder.remove();
      c++;
    });
    // título “Footnotes” que ficou vazio
    root.querySelectorAll('h2, h3, h4, p').forEach(h => { if (/^footnotes?$/i.test(clean(h.textContent))) h.remove(); });
    return c;
  }

  // tamanho real da ilustração (proporção certa no DOCX)
  function imageSize(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth || 1000, h: im.naturalHeight || 1000 }); im.onerror = () => res({ w: 1000, h: 1000 }); im.src = src; });
  }
  // largura e posição como no original: % declarado no img/bloco, largura em px (coluna de ~600 px) ou natural
  function figureLayout(img, dim) {
    const holder = img.closest('figure, div') || img;
    const pct = el2 => { const m = /width\s*:\s*([\d.]+)%/.exec((el2 && el2.getAttribute('style')) || ''); return m ? Number(m[1]) : 0; };
    const px = el2 => { if (!el2) return 0; const m = /width\s*:\s*([\d.]+)(px|em)/.exec(el2.getAttribute('style') || ''); if (m) return Number(m[1]) * (m[2] === 'em' ? 16 : 1); return Number(el2.getAttribute('width')) || 0; };
    let w = pct(img) || pct(holder);
    if (!w) { const p = px(img) || px(holder) || dim.w; w = p / 600 * 100; }
    const cls = ((holder.className || '') + ' ' + (img.className || '')).toLowerCase();
    const side = /figleft|floatleft|left/.test(cls) ? 'left' : /figright|floatright|right/.test(cls) ? 'right' : 'center';
    w = Math.round(Math.max(20, Math.min(side === 'center' ? 100 : 50, w)));
    return { width: w, align: side, wrap: side === 'center' ? 'none' : 'square' };
  }

  // ---------------------------------------------------------------- um livro
  async function processOne(item) {
    const log = (m, k) => addLog(`${item.name} — ${m}`, k);
    item.status = 'run'; renderList();
    const { proj } = await loadBook(item.path, item.name, log, { images: $('#enhImages').checked });
    const replace = $('#enhReplace').checked;
    // substituir: o DOCX vai para a pasta do EPUB, com o mesmo nome do arquivo, e o EPUB para a Lixeira
    item.out = await saveDocx(proj, log, '', replace ? { nextTo: item.path, name: item.path.split(/[\\/]/).pop().replace(/\.epub$/i, '') } : null);
    if (replace) {
      const r = await api.enhReplace(item.path, item.out);
      if (r && r.ok) log('EPUB original substituído pelo DOCX (o EPUB foi para a Lixeira)', 'ok');
      else log('atenção: ' + ((r && r.msg) || 'o EPUB foi mantido'), 'bad');
    }
    item.status = 'ok';
  }

  // Lê um livro (EPUB, DOCX, DOC, ODT…), tira avisos do Gutenberg e páginas pré/pós-textuais e monta um
  // projeto temporário no padrão do sistema, com os capítulos e as ilustrações. Usado também pela Tradução.
  async function loadBook(filePath, name, log, opts) {
    opts = opts || {};
    log('lendo o arquivo…');
    const res = await api.enhRead(filePath);
    if (!res || res.error) throw new Error(res ? res.error : 'arquivo ilegível');
    if (res.kind !== 'epub') {
      // Word/ODT/texto: capítulos do importador, depois a mesma limpeza (avisos, páginas extras)
      const chs = BookText.convertImport(Object.assign({ name }, res));
      const meta = chs.meta || {};
      res.docs = [{ id: 'doc', html: chs.map(c => `<h1>${App.escape(c.title || '')}</h1>${c.html}`).join('\n') }];
      res.meta = Object.assign({ title: meta.title || name, author: meta.author || '', language: meta.language || '' }, res.meta || {});
      if (!opts.allowAny && !/\.(docx?|odt|epub|rtf|txt|html?)$/i.test(filePath)) throw new Error('formato não suportado');
    }
    res.meta = res.meta || {};
    log(`${(res.docs || []).length} arquivo(s) internos · “${decode(res.meta.title) || name}”${res.meta.author ? ' · ' + decode(res.meta.author) : ''}`);
    // conversão de formato (Ferramentas): sem a limpeza do Gutenberg, o arquivo fica inteiro
    const html = opts.clean === false ? (res.docs || []).map(d => d.html).join('\n') : cleanGutenberg(res, m => log(m));
    let chapters = BookText.htmlToChapters(html, decode(res.meta.title) || name);
    const det = chapters.detected;
    chapters = chapters.filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img/.test(c.html));
    if (!chapters.length) throw new Error('nenhum capítulo encontrado depois da limpeza');
    log(`${chapters.length} capítulo(s)${det ? ' (pelos marcadores “' + (det.labeled ? 'CHAPTER/CAPÍTULO ' : '') + (det.style === 'roman' ? 'I, II…' : '1, 2…') + '”)' : ''}: ${chapters.slice(0, 3).map(c => c.title).join(' · ')}${chapters.length > 3 ? ' …' : ''}`);
    // projeto temporário com a configuração padrão do sistema (não mexe no livro aberto)
    const proj = D.normalizeProject(await api.newProject());
    proj.meta.title = decode(res.meta.title) || name;
    proj.meta.author = decode(res.meta.author);
    proj.meta.language = decode(res.meta.language) || proj.meta.language;
    if (det) { proj.settings.chapterNumbering = det.style === 'words' ? 'arabic' : det.style; proj.settings.chapterLabel = det.labeled ? 'Capítulo' : ''; }
    proj.front.toc = true;
    let imgs = 0;
    proj.chapters = [];
    for (const c of chapters) proj.chapters.push(await (async () => {
      const tpl = document.createElement('template');
      tpl.innerHTML = c.html;
      for (const img of tpl.content.querySelectorAll('img[src^="data:"]')) {
        if (opts.images === false) { (img.closest('figure') || img).remove(); continue; }
        const id = 'img' + (++imgs);
        const dim = await imageSize(img.getAttribute('src'));
        proj.assets[id] = { id, name: 'Ilustração ' + imgs, dataUrl: img.getAttribute('src'), width: dim.w, height: dim.h, info: {} };
        const holder = img.closest('figure') || img;
        const cap = holder.tagName === 'FIGURE' ? holder.querySelector('figcaption') : null;
        const t = document.createElement('template');
        t.innerHTML = App.editor.figureHtml(id, Object.assign(figureLayout(img, dim), { caption: cap ? cap.textContent : '' }));
        if (holder.tagName === 'FIGURE' || !holder.closest('p')) holder.replaceWith(t.content.firstChild); else { const p = holder.closest('p'); holder.remove(); p.after(t.content.firstChild); }
      }
      return { id: D.uid(), title: c.title, numbered: c.numbered !== false, html: tpl.innerHTML, locked: false, style: {}, separator: 'default', openingImage: null };
    })());
    if (imgs) log(`${imgs} ilustração(ões) mantida(s) nos capítulos`);
    return { proj, res, det, images: imgs };
  }

  // Grava o DOCX na pasta Downloads (ou ao lado do arquivo de origem: where.nextTo), no padrão do sistema
  // (Garamond, títulos, alinhamentos, sumário)
  async function saveDocx(proj, log, suffix, where) {
    const words = proj.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    log(`${words.toLocaleString('pt-BR')} palavras · gerando o DOCX no padrão do sistema (títulos, alinhamento, tamanho do texto, parágrafos e sumário)…`);
    const target = await api.enhTarget((where && where.name) || proj.meta.title + (suffix || ''), 'docx', where && where.nextTo);
    const doc = App.exportPrep.buildDoc(proj);
    doc.fontOverride = 'Garamond'; // texto e títulos em Garamond, com tamanhos, alinhamentos e espaços do sistema
    const r = await api.exportRun({ kind: 'docx', project: proj, doc, opts: { target } });
    if (!r || !r.files) throw new Error('falha ao gravar o DOCX');
    log(`pronto → ${r.files[0]}`, 'ok');
    return r.files[0];
  }

  async function start() {
    if (running) return;
    const todo = queue.filter(q => q.status === 'wait' || q.status === 'err');
    if (!todo.length) return App.toast('Envie um ou mais arquivos EPUB.');
    running = true;
    renderControls();
    const t0 = Date.now();
    addLog(`Início: ${todo.length} livro(s) · ${$('#enhReplace').checked ? 'cada DOCX substitui o seu EPUB, na mesma pasta' : 'saída em ' + dlDir}`);
    let ok = 0;
    for (const item of todo) {
      try { await processOne(item); ok++; } catch (e) { item.status = 'err'; item.msg = String(e.message || e); addLog(`${item.name} — erro: ${item.msg}`, 'bad'); }
      renderList();
    }
    running = false;
    addLog(`Fim: ${ok} de ${todo.length} livro(s) processado(s) em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`, ok === todo.length ? 'ok' : 'bad');
    renderControls();
    if (ok && $('#enhOpen').checked) { const last = todo.filter(x => x.out).pop(); if (last) api.showItem(last.out); }
  }

  // ---------------------------------------------------------------- tela
  function addLog(m, kind) {
    if (!logBox) return;
    const now = new Date();
    logBox.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: now.toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
    logBox.scrollTop = logBox.scrollHeight;
  }
  function addFiles(paths) {
    let n = 0;
    paths.filter(p => /\.epub$/i.test(p)).forEach(p => { if (!queue.some(q => q.path === p)) { queue.push({ path: p, name: p.split(/[\\/]/).pop().replace(/\.epub$/i, ''), status: 'wait' }); n++; } });
    if (paths.length && !n) App.toast('Só arquivos .epub (ou já estão na lista).');
    renderList();
    renderControls();
  }
  function renderList() {
    if (!listBox) return;
    listBox.innerHTML = '';
    if (!queue.length) { listBox.appendChild(el('p', { class: 'muted enh-empty', text: 'Nenhum livro na lista.' })); return; }
    const L = { wait: 'aguardando', run: 'processando…', ok: 'concluído', err: 'erro' };
    queue.forEach((q, i) => listBox.appendChild(el('div', { class: 'enh-item ' + q.status }, [
      el('span', { class: 'enh-ic', html: App.icons ? App.icons.svg('book') : '' }),
      el('span', { class: 'enh-name' }, [el('b', { text: q.name }), el('small', { class: 'muted', text: q.out ? q.out : q.msg || q.path })]),
      el('span', { class: 'enh-st', text: L[q.status] }),
      q.out ? el('button', { class: 'icon-btn', title: 'Mostrar na pasta', text: '📂', onclick: () => api.showItem(q.out) }) : null,
      !running && q.status !== 'run' ? el('button', { class: 'icon-btn', title: 'Tirar da lista', text: '✕', onclick: () => { queue.splice(i, 1); renderList(); renderControls(); } }) : null
    ])));
  }
  function renderControls() {
    const b = $('#enhStart');
    if (!b) return;
    const n = queue.filter(q => q.status === 'wait' || q.status === 'err').length;
    b.disabled = running || !n;
    b.textContent = running ? 'Processando…' : n > 1 ? `▶ Iniciar (${n} livros, um após o outro)` : '▶ Iniciar';
  }

  async function open() {
    if (screen) { screen.classList.add('show'); return; }
    dlDir = await api.enhDownloads();
    logBox = el('ol', { class: 'pg-log enh-log' });
    // preferência lembrada: substituir o EPUB de origem (padrão) ou salvar uma cópia em Downloads
    let pref = true;
    try { pref = localStorage.getItem('enh.replace') !== '0'; } catch (e) { /* ok */ }
    const whereTxt = el('span', { class: 'muted small' });
    const replaceChk = el('input', { type: 'checkbox', id: 'enhReplace', checked: pref });
    const showWhere = () => { whereTxt.textContent = replaceChk.checked ? 'Salvo na pasta de cada EPUB, no lugar dele' : 'Salvo em: ' + dlDir; };
    replaceChk.addEventListener('change', () => { try { localStorage.setItem('enh.replace', replaceChk.checked ? '1' : '0'); } catch (e) { /* ok */ } showWhere(); });
    showWhere();
    listBox = el('div', { class: 'enh-list' });
    const drop = el('button', { class: 'enh-drop', onclick: async () => addFiles(await api.enhPick()) }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }),
      el('b', { text: 'Enviar EPUBs do Project Gutenberg' }),
      el('span', { class: 'muted', text: 'Clique ou arraste aqui um ou vários arquivos .epub (modo em massa: processados um após o outro)' })
    ]);
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); });
    screen = el('div', { class: 'enh-screen show' }, [
      el('header', { class: 'enh-head' }, [
        el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('sparkles') : '' }), el('div', {}, [el('h1', { text: 'Melhoramento' }), el('p', { class: 'muted', text: 'EPUB do Project Gutenberg → DOCX limpo, no padrão do sistema' })])]),
        el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
      ]),
      el('main', { class: 'enh-main' }, [
        el('section', { class: 'enh-col' }, [
          drop,
          listBox,
          el('div', { class: 'enh-opts' }, [
            el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'enhImages', checked: true }), ' Manter as ilustrações dentro dos capítulos']),
            el('label', { class: 'chk', title: 'O DOCX é gravado na pasta do EPUB, com o mesmo nome; só depois de conferido o EPUB vai para a Lixeira (dá para recuperar de lá).' }, [replaceChk, ' Substituir o EPUB original pelo DOCX (o EPUB vai para a Lixeira)']),
            el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'enhOpen', checked: true }), ' Mostrar a pasta ao terminar'])
          ]),
          el('div', { class: 'enh-what' }, [
            el('b', { text: 'O que é feito em cada livro' }),
            el('ul', {}, [
              'remove capa, folha de rosto, créditos, dedicatória, notas do transcritor, listas de ilustrações e o sumário do arquivo',
              'remove os avisos, o cabeçalho e a licença do Project Gutenberg e as páginas pós-textuais (anúncios, índices, notas finais)',
              'identifica os capítulos (CHAPTER 1, I, II…) e monta o sumário do sistema',
              'converte as notas de rodapé e aplica o padrão do sistema: títulos, alinhamento, tamanho do texto, entrelinha e recuo de parágrafo'
            ].map(t => el('li', { text: t })))
          ]),
          el('div', { class: 'enh-run' }, [el('button', { id: 'enhStart', class: 'primary big', onclick: start }), whereTxt])
        ]),
        el('section', { class: 'enh-col' }, [el('h3', { text: 'Registro' }), logBox])
      ])
    ]);
    // arrastar arquivos para qualquer ponto da tela
    screen.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    screen.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); });
    document.body.appendChild(screen);
    renderList();
    renderControls();
    addLog('Pronto. Envie os arquivos e clique em Iniciar.');
  }

  App.enhance = { open, cleanGutenberg, addFiles, start, queue, loadBook, saveDocx };
})();
