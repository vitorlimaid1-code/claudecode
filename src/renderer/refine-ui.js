/* global App, BookText */
// VBO Refinamento: envie livros em qualquer formato (um, vários ou pastas inteiras, sem limite) e cada um recebe
// toda a edição automática do sistema — estilo e tamanho de fonte padrão, títulos e capítulos reconhecidos, falas
// com travessão (hífen ou aspas → —), Novo Acordo Ortográfico, pontuação editorial, sujeira de PDF limpa, notas de
// rodapé ligadas, sumário automático — menos a ficha catalográfica. O resultado vai para a pasta Downloads, com
// “(refinado)” no nome; o original nunca é alterado. Tudo no computador, sem internet, com registro ao vivo.
(function () {
  const { el, $, api } = App;
  const queue = []; // { path, name, status: 'wait'|'run'|'ok'|'err', out, msg }
  let screen = null, logBox = null, listBox = null, liveLine = null, countBox = null;
  let running = false, stopAsked = false, dlDir = '';
  const opt = {};
  const TOC_RE = /^(sum[áa]rio|[íi]ndice|conte[úu]do|contents|table of contents)$/i;
  const FORMATS = [['same', 'Mesmo formato do original'], ['docx', 'Word (DOCX)'], ['pdf', 'PDF diagramado'], ['epub', 'EPUB'], ['odt', 'OpenDocument (ODT)']];
  const fmtN = n => Number(n || 0).toLocaleString('pt-BR');
  const fileName = p => String(p).split(/[\\/]/).pop();
  const baseName = p => fileName(p).replace(/\.[^.]+$/, '');

  function addLog(m, kind) {
    if (!logBox) return;
    if (liveLine) liveLine.remove();
    liveLine = null;
    logBox.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: new Date().toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
    // registro muito longo (centenas de livros): as linhas mais antigas saem da tela
    while (logBox.children.length > 4000) logBox.firstChild.remove();
    logBox.scrollTop = logBox.scrollHeight;
  }
  function live(m) {
    if (!logBox) return;
    if (!liveLine) { liveLine = el('li', { class: 'live' }, [el('span', { class: 'pg-t', text: '…' }), el('span', { class: 'pg-m' })]); logBox.appendChild(liveLine); }
    liveLine.lastChild.textContent = m;
    logBox.scrollTop = logBox.scrollHeight;
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  // ---------------------------------------------------------------- um livro
  async function refineOne(item, idx, total) {
    const tag = `[${idx}/${total}] ${item.name}`;
    const log = (m, k) => addLog(`${tag} — ${String(m).replace(/^·\s*/, '')}`, k);
    item.status = 'run'; renderList();
    const t0 = Date.now();
    // 1. leitura do livro inteiro (nenhum capítulo é descartado), com as notas de rodapé ligadas às chamadas
    const { proj } = await App.enhance.loadBook(item.path, item.name, log, { images: opt.images.checked, allowAny: true, keep: true, polish: false });
    await tick();
    // 2. sumário que vinha no arquivo sai (o sistema gera o seu, com as páginas certas)
    const tocs = proj.chapters.filter(c => TOC_RE.test(String(c.title || '').replace(/<[^>]+>/g, '').trim()));
    if (tocs.length && proj.chapters.length > tocs.length) { proj.chapters = proj.chapters.filter(c => !tocs.includes(c)); log('sumário do arquivo removido (o sumário automático o substitui)'); }
    // 3. falas com hífen → travessão (só o que é fala: palavras com hífen, números e listas ficam)
    const glue = opt.glue.checked;
    let dashes = 0;
    proj.chapters.forEach(c => { const r = BookText.dialogueHtml(c.html, { glue }); if (r.count) { c.html = r.html; dashes += r.count; } });
    if (dashes) log(`${fmtN(dashes)} fala(s) com hífen passaram para travessão (—)`);
    // 4. revisão do português: falas entre aspas → travessão, grafias antigas, Novo Acordo, pontuação, sujeira de PDF
    const polishLog = m => log(m);
    addLog(`${tag} — revisão do texto: aspas nas falas, ortografia e pontuação…`);
    const joined = proj.chapters.map((c, i) => `<section data-rf="${i}">${c.html}</section>`).join('');
    const tpl = document.createElement('template');
    tpl.innerHTML = App.enhance.polishPtBr(joined, polishLog, glue, { archaic: opt.archaic.checked });
    tpl.content.querySelectorAll('section[data-rf]').forEach(sec => { const c = proj.chapters[Number(sec.dataset.rf)]; if (c) c.html = sec.innerHTML; });
    proj.chapters.forEach(c => { c.title = opt.archaic.checked ? App.enhance.polishTitle(c.title) : c.title; });
    await tick();
    // 5. padrão do sistema: estilos, fontes e tamanhos de fábrica; sumário automático; sem ficha catalográfica
    proj.front.toc = opt.toc.checked;
    proj.front.copyright = false;
    const notes = proj.chapters.reduce((s, c) => s + (c.html.match(/class="footnote"/g) || []).length, 0);
    const words = proj.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    log(`${proj.chapters.length} capítulo(s) · ${fmtN(words)} palavras${notes ? ' · ' + fmtN(notes) + ' nota(s) de rodapé' : ''} · estilo, fonte e tamanho padrão do sistema${proj.front.toc ? ' · sumário automático' : ''} · sem ficha catalográfica`);
    // 6. gravação em Downloads, num arquivo novo
    const fmt = opt.format.value === 'same' ? App.toolbox.sameFormat(item.path) : opt.format.value;
    const target = await api.toolsTarget({ base: baseName(item.path) + ' (refinado)', ext: fmt, src: item.path, mode: 'downloads' });
    addLog(`${tag} — gravando ${fmt.toUpperCase()}${fmt === 'pdf' ? ' (diagramação das páginas: pode levar alguns minutos em livros grandes)' : ''}…`);
    item.out = await App.toolbox.writeBook(proj, fmt, target, { house: fmt !== 'pdf' });
    item.status = 'ok';
    log(`pronto em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s → ${item.out}`, 'ok');
  }

  async function start() {
    if (running) return;
    const todo = queue.filter(q => q.status === 'wait' || q.status === 'err');
    if (!todo.length) return App.toast('Envie um ou mais livros (qualquer formato).');
    running = true; stopAsked = false;
    renderControls();
    const t0 = Date.now();
    addLog(`Início: ${fmtN(todo.length)} livro(s), um após o outro · saída em ${dlDir} · os originais não são alterados`);
    let ok = 0, n = 0;
    for (const item of todo) {
      if (stopAsked) { addLog('Parado a pedido. Os livros que faltam continuam na lista.', 'bad'); break; }
      n++;
      try { await refineOne(item, n, todo.length); ok++; } catch (e) {
        item.status = 'err'; item.msg = String((e && e.message) || e);
        addLog(`[${n}/${todo.length}] ${item.name} — erro: ${item.msg}`, 'bad');
      }
      renderList();
      await tick();
    }
    running = false;
    const min = (Date.now() - t0) / 60000;
    addLog(`Fim: ${fmtN(ok)} de ${fmtN(todo.length)} livro(s) refinado(s) em ${min < 1 ? Math.round(min * 60) + ' s' : min.toFixed(1).replace('.', ',') + ' min'}`, ok === todo.length ? 'ok' : 'bad');
    renderControls();
    if (ok && opt.open.checked) { const last = todo.filter(x => x.out).pop(); if (last) api.showItem(last.out); }
  }

  // ---------------------------------------------------------------- fila
  async function addFiles(paths) {
    paths = (paths || []).filter(Boolean);
    if (!paths.length) return;
    const files = api.toolsExpand ? await api.toolsExpand(paths) : paths;
    let n = 0;
    files.forEach(p => { if (!queue.some(q => q.path === p)) { queue.push({ path: p, name: baseName(p), status: 'wait' }); n++; } });
    if (!n) App.toast(files.length ? 'Esses arquivos já estão na lista.' : 'Nenhum livro reconhecido (DOCX, DOC, ODT, RTF, EPUB, PDF, TXT, Markdown, HTML ou FB2).');
    else addLog(`${fmtN(n)} livro(s) adicionado(s) à lista (total: ${fmtN(queue.length)})`);
    renderList(); renderControls();
  }
  function renderList() {
    if (!listBox) return;
    listBox.innerHTML = '';
    const c = { wait: 0, run: 0, ok: 0, err: 0 };
    queue.forEach(q => { c[q.status]++; });
    if (countBox) countBox.textContent = queue.length ? `${fmtN(queue.length)} livro(s) · ${fmtN(c.ok)} pronto(s) · ${fmtN(c.wait + c.run)} na fila${c.err ? ' · ' + fmtN(c.err) + ' com erro' : ''}` : '';
    if (!queue.length) { listBox.appendChild(el('p', { class: 'muted enh-empty', text: 'Nenhum livro na lista.' })); return; }
    const L = { wait: 'aguardando', run: 'refinando…', ok: 'pronto', err: 'erro' };
    // listas enormes: mostra os 300 mais relevantes (em andamento, com erro e os próximos); o contador mostra o total
    const shown = queue.length > 300 ? queue.filter(q => q.status === 'run' || q.status === 'err').concat(queue.filter(q => q.status === 'wait').slice(0, 200), queue.filter(q => q.status === 'ok').slice(-80)) : queue;
    shown.forEach(q => listBox.appendChild(el('div', { class: 'enh-item ' + q.status }, [
      el('span', { class: 'enh-ic', html: App.icons ? App.icons.svg('feather') : '' }),
      el('span', { class: 'enh-name' }, [el('b', { text: q.name }), el('small', { class: 'muted', text: q.out ? q.out : q.msg || q.path })]),
      el('span', { class: 'enh-st', text: L[q.status] }),
      q.out ? el('button', { class: 'icon-btn', title: 'Mostrar na pasta', text: '📂', onclick: () => api.showItem(q.out) }) : null,
      !running && q.status !== 'run' ? el('button', { class: 'icon-btn', title: 'Tirar da lista', text: '✕', onclick: () => { queue.splice(queue.indexOf(q), 1); renderList(); renderControls(); } }) : null
    ])));
  }
  function renderControls() {
    const b = $('#rfStart'), s = $('#rfStop');
    if (!b) return;
    const n = queue.filter(q => q.status === 'wait' || q.status === 'err').length;
    b.disabled = running || !n;
    b.textContent = running ? 'Refinando…' : n > 1 ? `▶ Refinar ${fmtN(n)} livros (um após o outro)` : '▶ Refinar';
    if (s) s.style.display = running ? '' : 'none';
    const clr = $('#rfClear');
    if (clr) clr.disabled = running || !queue.length;
  }

  // ---------------------------------------------------------------- tela
  async function open() {
    if (screen) { screen.classList.add('show'); return; }
    dlDir = await api.enhDownloads();
    logBox = el('ol', { class: 'pg-log enh-log rf-log' });
    listBox = el('div', { class: 'enh-list' });
    countBox = el('p', { class: 'small muted rf-count' });
    opt.format = el('select', {}, FORMATS.map(([v, t]) => el('option', { value: v, text: t })));
    opt.toc = el('input', { type: 'checkbox', checked: true });
    opt.images = el('input', { type: 'checkbox', checked: true });
    opt.glue = el('input', { type: 'checkbox', checked: true });
    opt.archaic = el('input', { type: 'checkbox', checked: true });
    opt.open = el('input', { type: 'checkbox', checked: true });
    const drop = el('button', { class: 'enh-drop', onclick: async () => addFiles(await api.toolsPick('text')) }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }),
      el('b', { text: 'Enviar livros para refinar' }),
      el('span', { class: 'muted', text: 'Qualquer formato (DOCX, DOC, ODT, RTF, EPUB, PDF, TXT, Markdown, HTML, FB2) — clique ou arraste aqui arquivos ou pastas inteiras, quantos quiser' })
    ]);
    const onDrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); };
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', onDrop);
    screen = el('div', { class: 'enh-screen rf-screen show' }, [
      el('header', { class: 'enh-head' }, [
        el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('feather') : '' }), el('div', {}, [el('h1', { text: 'VBO Refinamento' }), el('p', { class: 'muted', text: 'Toda a edição automática do sistema em um ou em centenas de livros — no computador, sem internet' })])]),
        el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
      ]),
      el('main', { class: 'enh-main' }, [
        el('section', { class: 'enh-col' }, [
          drop,
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'small-btn', text: '📁 Adicionar uma pasta inteira', onclick: async () => { const d = await api.toolsPickDir('Pasta com os livros para refinar'); if (d) addFiles([d]); } }),
            el('button', { id: 'rfClear', class: 'small-btn', text: 'Limpar a lista', onclick: () => { if (running) return; queue.splice(0); renderList(); renderControls(); } }),
            countBox
          ]),
          listBox,
          el('div', { class: 'tr-cfg' }, [
            el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Formato do arquivo refinado' }), opt.format, el('span', { class: 'small muted', text: 'Padrão: o mesmo do original (DOC antigo sai como DOCX). O PDF sai diagramado, com as páginas do sistema.' })]),
            el('label', { class: 'chk' }, [opt.toc, ' Sumário automático']),
            el('label', { class: 'chk' }, [opt.images, ' Manter as ilustrações']),
            el('label', { class: 'chk' }, [opt.glue, ' Travessão colado na fala (—Olá — disse ele.)']),
            el('label', { class: 'chk' }, [opt.archaic, ' Atualizar grafias antigas (pharmacia → farmácia)']),
            el('label', { class: 'chk' }, [opt.open, ' Mostrar a pasta ao terminar'])
          ]),
          el('div', { class: 'enh-what' }, [
            el('b', { text: 'O que é feito em cada livro' }),
            el('ul', {}, [
              'lê o livro inteiro: capítulos e títulos reconhecidos (mesmo sem formatação), notas de rodapé ligadas às chamadas, ilustrações, tabelas e listas',
              'falas: hífen ou aspas abrindo a fala viram travessão (—), inclusive nos incisos do narrador; palavras com hífen, números e listas ficam como estão',
              'texto: Novo Acordo Ortográfico, grafias antigas, pontuação editorial (reticências, espaços duplos, aspas curvas) e sujeira de PDF/digitalização',
              'padrão do sistema: estilo, fonte e tamanho de fábrica, títulos, parágrafos e alinhamentos; sumário do arquivo trocado pelo automático',
              'sem ficha catalográfica. Cada livro é salvo como um arquivo novo na pasta Downloads, com “(refinado)” no nome — o original nunca é alterado'
            ].map(t => el('li', { text: t })))
          ]),
          el('div', { class: 'enh-run' }, [
            el('button', { id: 'rfStart', class: 'primary big', onclick: start }),
            el('button', { id: 'rfStop', class: 'danger', text: 'Parar depois do livro atual', style: { display: 'none' }, onclick: () => { stopAsked = true; addLog('Parada pedida: termina o livro atual e para.', 'bad'); } }),
            el('span', { class: 'muted small', text: 'Salvo em: ' + dlDir })
          ])
        ]),
        el('section', { class: 'enh-col' }, [el('h3', { class: 'rf-log-title', text: 'Registro (ao vivo)' }), logBox])
      ])
    ]);
    screen.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    screen.addEventListener('drop', onDrop);
    document.body.appendChild(screen);
    renderList(); renderControls();
    addLog('Pronto. Envie os livros (ou pastas) e clique em Refinar.');
  }

  App.refine = { open, addFiles, start, queue, opt, _live: live };
})();
