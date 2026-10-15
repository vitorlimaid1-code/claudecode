/* global App */
// Ferramentas: conversor de imagens (qualquer formato de entrada → qualquer formato de saída),
// conversor de textos e livros, e remoção inteligente de fundo de imagens. Tudo no computador,
// em lote, com registro ao vivo; os arquivos novos vão para Downloads, para a pasta do original ou
// para uma pasta escolhida (nunca sobrescrevem nada).
(function () {
  const { el, $, api } = App;

  // ---------------------------------------------------------------- formatos
  const IMG_IN = {
    browser: ['png', 'apng', 'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'avif', 'bmp', 'dib', 'ico', 'cur'],
    svg: ['svg', 'svgz'],
    main: ['tif', 'tiff', 'heic', 'heif', 'hif', 'psd', 'psb', 'tga', 'icb', 'vda', 'vst', 'ppm', 'pgm', 'pbm', 'pnm', 'pam', 'qoi'],
    pdf: ['pdf']
  };
  const IMG_IN_LIST = [['PNG / APNG', 'png'], ['JPEG (JPG, JFIF)', 'jpg'], ['GIF', 'gif'], ['WebP', 'webp'], ['AVIF', 'avif'], ['BMP / DIB', 'bmp'], ['ICO / CUR', 'ico'], ['SVG / SVGZ', 'svg'], ['TIFF', 'tif'], ['HEIC / HEIF (iPhone)', 'heic'], ['PSD / PSB (Photoshop)', 'psd'], ['TGA (Targa)', 'tga'], ['PPM / PGM / PBM / PNM / PAM', 'ppm'], ['QOI', 'qoi'], ['PDF (cada página vira uma imagem)', 'pdf']];
  const IMG_OUT = [
    ['png', 'PNG — sem perdas, com transparência'], ['jpeg', 'JPEG (JPG) — fotos, arquivo pequeno'], ['webp', 'WebP — web, com transparência'], ['avif', 'AVIF — web, compressão máxima'],
    ['gif', 'GIF — 256 cores, com transparência'], ['bmp', 'BMP — bitmap do Windows'], ['tiff', 'TIFF — gráfica e impressão'], ['psd', 'PSD — Photoshop'], ['pdf', 'PDF — documento'],
    ['svg', 'SVG — vetor com a imagem embutida'], ['ico', 'ICO — ícone do Windows (16 a 256 px)'], ['tga', 'TGA — Targa'], ['qoi', 'QOI — sem perdas, rápido'],
    ['ppm', 'PPM — Netpbm colorido'], ['pgm', 'PGM — Netpbm em tons de cinza'], ['pbm', 'PBM — Netpbm preto e branco (pontilhado)'], ['pam', 'PAM — Netpbm com transparência']
  ];
  const LOSSY = new Set(['jpeg', 'webp', 'avif', 'pdf']);
  const NO_ALPHA = new Set(['jpeg', 'bmp', 'ppm', 'pgm', 'pbm']);
  const TXT_IN = ['docx', 'doc', 'odt', 'rtf', 'epub', 'pdf', 'txt', 'text', 'md', 'markdown', 'html', 'htm', 'xhtml', 'fb2'];
  const TXT_IN_LIST = ['DOCX (Word)', 'DOC (Word 97–2003)', 'ODT (LibreOffice/OpenOffice)', 'RTF', 'EPUB', 'PDF', 'TXT', 'Markdown (MD)', 'HTML / XHTML', 'FB2 (FictionBook)'];
  const TXT_OUT = [
    ['docx', 'DOCX — Word'], ['odt', 'ODT — LibreOffice/OpenOffice'], ['rtf', 'RTF — texto formatado universal'], ['pdf', 'PDF — diagramado no padrão do sistema'],
    ['epub', 'EPUB — livro digital'], ['mobi', 'MOBI — Kindle'], ['html', 'HTML — página única, com as imagens dentro'], ['md', 'Markdown (MD)'],
    ['txt', 'TXT — texto simples'], ['fb2', 'FB2 — FictionBook']
  ];
  const ext = p => (String(p).match(/\.([^.\\/]+)$/) || [, ''])[1].toLowerCase();
  const base = p => String(p).split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const fmtSize = n => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  // ---------------------------------------------------------------- Web Worker (decodificar/gravar sem travar a tela)
  let worker = null, wseq = 0;
  const wpend = new Map();
  function work(op, data, transfer) {
    if (!worker) {
      worker = new Worker('tools-worker.js');
      worker.onmessage = ev => { const p = wpend.get(ev.data.id); if (!p) return; wpend.delete(ev.data.id); if (ev.data.error) p.reject(new Error(ev.data.error)); else p.resolve(ev.data.res); };
      worker.onerror = ev => { wpend.forEach(p => p.reject(new Error(ev.message || 'falha no processamento da imagem'))); wpend.clear(); worker = null; };
    }
    const id = ++wseq;
    return new Promise((resolve, reject) => { wpend.set(id, { resolve, reject }); worker.postMessage(Object.assign({ id, op }, data), transfer || []); });
  }
  const mimeOf = e => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', jfif: 'image/jpeg', pjpeg: 'image/jpeg', pjp: 'image/jpeg', png: 'image/png', apng: 'image/apng', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', dib: 'image/bmp', ico: 'image/x-icon', cur: 'image/x-icon' })[e] || '';
  // SVG: desenhado pela própria interface (o Web Worker não lê SVG)
  async function decodeSvg(bytes, gz, minSide) {
    let data = bytes;
    if (gz) data = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      let w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
      // vetores pequenos ganham resolução para a imagem de saída sair nítida
      const k = Math.max(1, (minSide || 1024) / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return { width: w, height: h, data: new Uint8Array(c.getContext('2d').getImageData(0, 0, w, h).data.buffer) };
    } finally { URL.revokeObjectURL(url); }
  }
  // arquivo → lista de imagens RGBA (o PDF dá uma por página)
  async function loadImages(file, o) {
    const e = ext(file);
    if (IMG_IN.pdf.includes(e)) {
      const r = await api.toolsPdfPages(file, o.pdfDpi || 200, 500);
      if (!r || r.error) throw new Error((r && r.error) || 'PDF ilegível');
      const out = [];
      for (const p of r.pages) out.push({ suffix: r.pages.length > 1 ? ` - p${p.n}` : '', img: await work('decode', { bytes: p.bytes, mime: 'image/png' }, [p.bytes.buffer]) });
      return out;
    }
    if (IMG_IN.main.includes(e)) {
      const r = await api.toolsDecode(file);
      if (!r || r.error) throw new Error((r && r.error) || 'imagem ilegível');
      return [{ suffix: '', img: { width: r.width, height: r.height, data: r.data } }];
    }
    const rd = await api.toolsRead(file);
    if (!rd || rd.error) throw new Error((rd && rd.error) || 'arquivo ilegível');
    if (IMG_IN.svg.includes(e) || /^\s*(<\?xml|<svg)/.test(new TextDecoder().decode(rd.bytes.subarray(0, 200)))) return [{ suffix: '', img: await decodeSvg(rd.bytes, e === 'svgz', o.svgSize) }];
    return [{ suffix: '', img: await work('decode', { bytes: rd.bytes, mime: mimeOf(e) }, [rd.bytes.buffer]) }];
  }
  // imagem RGBA → arquivo gravado no formato pedido
  async function saveImage(img, fmt, o, src, name) {
    const r = await work('encode', { img, fmt, opts: o }, []);
    let bytes = r.bytes;
    if (r.forPsd) {
      const p = await api.toolsPsd(r.rgba);
      if (!p || p.error) throw new Error((p && p.error) || 'falha ao gravar o PSD');
      bytes = p.bytes;
    } else if (r.forPdf) {
      const p = await api.toolsPdfFromImages([{ bytes: r.bytes, mime: r.mime }], o.dpi || 300);
      if (!p || p.error) throw new Error((p && p.error) || 'falha ao gravar o PDF');
      bytes = p.bytes;
    }
    const target = await api.toolsTarget({ base: name, ext: r.ext, src, mode: o.outMode, dir: o.outDir });
    const w = await api.toolsWrite(target, bytes);
    if (!w || w.error) throw new Error((w && w.error) || 'falha ao gravar');
    return { file: target, size: bytes.length };
  }

  // ---------------------------------------------------------------- tela
  let screen = null, logBox = null, liveLine = null, running = false, stopAsked = false;
  const state = { img: [], txt: [], bg: [], outMode: 'downloads', outDir: '' };
  function addLog(m, kind) {
    if (!logBox) return;
    if (liveLine) { liveLine.remove(); liveLine = null; }
    logBox.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: new Date().toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
    logBox.scrollTop = logBox.scrollHeight;
  }
  function live(m) {
    if (!logBox) return;
    if (!liveLine) { liveLine = el('li', { class: 'live' }, [el('span', { class: 'pg-t', text: '…' }), el('span', { class: 'pg-m' })]); logBox.appendChild(liveLine); }
    liveLine.lastChild.textContent = m;
    logBox.scrollTop = logBox.scrollHeight;
  }
  const yieldUi = () => new Promise(r => setTimeout(r, 0));

  // lista de arquivos com área de soltar
  function fileList(key, kind, accept, hint) {
    const listBox = el('div', { class: 'enh-list' });
    const render = () => {
      listBox.innerHTML = '';
      if (!state[key].length) { listBox.appendChild(el('p', { class: 'muted enh-empty', text: 'Nenhum arquivo na lista.' })); return; }
      state[key].forEach((q, i) => listBox.appendChild(el('div', { class: 'enh-item ' + (q.status || 'wait') }, [
        el('span', { class: 'enh-name' }, [el('b', { text: q.path.split(/[\\/]/).pop() }), el('small', { class: 'muted', text: q.out || q.msg || q.path })]),
        el('span', { class: 'enh-st', text: { wait: 'aguardando', run: 'convertendo…', ok: 'pronto', err: 'erro' }[q.status || 'wait'] }),
        q.out ? el('button', { class: 'icon-btn', title: 'Mostrar na pasta', text: '📂', onclick: () => api.showItem(q.out) }) : null,
        !running ? el('button', { class: 'icon-btn', title: 'Tirar da lista', text: '✕', onclick: () => { state[key].splice(i, 1); render(); } }) : null
      ])));
    };
    const add = paths => {
      let n = 0;
      (paths || []).forEach(p => { if (accept.includes(ext(p)) && !state[key].some(q => q.path === p)) { state[key].push({ path: p, status: 'wait' }); n++; } });
      if (paths && paths.length && !n) App.toast('Formato não aceito aqui (ou o arquivo já está na lista).');
      render();
    };
    const drop = el('button', { class: 'enh-drop', onclick: async () => add(await api.toolsPick(kind)) }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }), el('b', { text: 'Enviar arquivos' }), el('span', { class: 'muted', text: hint })
    ]);
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); add(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); });
    render();
    return { node: el('div', { class: 'tl-files' }, [drop, listBox]), render, add };
  }
  function outControls() {
    const sel = el('select', {}, [['downloads', 'Pasta Downloads'], ['same', 'Na pasta de cada original'], ['custom', 'Escolher uma pasta…']].map(([v, t]) => el('option', { value: v, text: t, selected: state.outMode === v })));
    const lab = el('span', { class: 'small muted', text: state.outMode === 'custom' ? state.outDir : '' });
    sel.addEventListener('change', async () => {
      if (sel.value === 'custom') { const d = await api.toolsPickDir(); if (!d) { sel.value = state.outMode; return; } state.outDir = d; lab.textContent = d; }
      else lab.textContent = '';
      state.outMode = sel.value;
    });
    return el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Salvar em (os originais nunca são alterados)' }), sel, lab]);
  }
  const field = (label, input, hint) => el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: label }), input, hint ? el('span', { class: 'small muted', text: hint }) : null]);
  async function runQueue(key, render, fn, label) {
    if (running) return;
    const todo = state[key].filter(q => q.status !== 'ok');
    if (!todo.length) return App.toast('Envie um ou mais arquivos.');
    running = true; stopAsked = false;
    const t0 = Date.now();
    addLog(`${label}: ${todo.length} arquivo(s)`);
    let ok = 0;
    for (const q of todo) {
      if (stopAsked) break;
      q.status = 'run'; q.msg = ''; render();
      try { await fn(q); q.status = 'ok'; ok++; } catch (e) { q.status = 'err'; q.msg = String(e.message || e); addLog(`${q.path.split(/[\\/]/).pop()} — erro: ${q.msg}`, 'bad'); }
      render();
      await yieldUi();
    }
    running = false;
    addLog(`Fim: ${ok} de ${todo.length} em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`, ok === todo.length ? 'ok' : 'bad');
    render();
  }

  // ---------------------------------------------------------------- aba Imagens
  function imageTab() {
    const files = fileList('img', 'image', [].concat(IMG_IN.browser, IMG_IN.svg, IMG_IN.main, IMG_IN.pdf), 'Qualquer imagem: PNG, JPG, WebP, AVIF, GIF, HEIC (iPhone), TIFF, PSD, SVG, BMP, ICO, TGA, PDF… — clique ou arraste (vários de uma vez)');
    const fmt = el('select', {}, IMG_OUT.map(([v, t]) => el('option', { value: v, text: t })));
    work('avif', {}).then(r => { if (!r.ok) { const o = fmt.querySelector('option[value="avif"]'); if (o) o.remove(); } }).catch(() => {});
    const quality = el('input', { type: 'range', min: 40, max: 100, value: 90 });
    const qLab = el('span', { class: 'small', text: '90%' });
    quality.addEventListener('input', () => { qLab.textContent = quality.value + '%'; });
    const sizeMode = el('select', {}, [['orig', 'Tamanho original'], ['max', 'Limitar a largura/altura (px)'], ['pct', 'Porcentagem']].map(([v, t]) => el('option', { value: v, text: t })));
    const maxPx = el('input', { type: 'number', min: 16, max: 20000, value: 2000, style: { width: '110px' } });
    const pct = el('input', { type: 'number', min: 1, max: 800, value: 50, style: { width: '90px' } });
    const bgColor = el('input', { type: 'color', value: '#ffffff' });
    const dpi = el('input', { type: 'number', min: 72, max: 1200, value: 300, style: { width: '90px' } });
    const onePdf = el('input', { type: 'checkbox' });
    const sync = () => {
      const f = fmt.value;
      quality.closest('.tr-cfg-row').style.display = LOSSY.has(f) ? '' : 'none';
      bgColor.closest('.tr-cfg-row').style.display = NO_ALPHA.has(f) ? '' : 'none';
      dpi.closest('.tr-cfg-row').style.display = f === 'tiff' || f === 'pdf' ? '' : 'none';
      onePdf.closest('label').style.display = f === 'pdf' ? '' : 'none';
      maxPx.style.display = sizeMode.value === 'max' ? '' : 'none';
      pct.style.display = sizeMode.value === 'pct' ? '' : 'none';
    };
    [fmt, sizeMode].forEach(x => x.addEventListener('change', sync));
    const opts = () => ({ quality: +quality.value, background: bgColor.value, dpi: +dpi.value, maxW: sizeMode.value === 'max' ? +maxPx.value : 0, maxH: sizeMode.value === 'max' ? +maxPx.value : 0, scale: sizeMode.value === 'pct' ? +pct.value : 100, outMode: state.outMode, outDir: state.outDir, pdfJpeg: +quality.value < 100 });
    const start = async () => {
      const f = fmt.value, o = opts();
      // PDF único com todas as imagens
      if (f === 'pdf' && onePdf.checked) {
        if (running) return;
        const todo = state.img.filter(q => q.status !== 'ok');
        if (!todo.length) return App.toast('Envie um ou mais arquivos.');
        running = true;
        const items = [];
        try {
          for (const q of todo) {
            q.status = 'run'; files.render();
            live(`lendo ${q.path.split(/[\\/]/).pop()}…`);
            for (const { img } of await loadImages(q.path, o)) { const r = await work('encode', { img, fmt: 'pdf', opts: o }); items.push({ bytes: r.bytes, mime: r.mime }); }
            q.status = 'ok';
          }
          const p = await api.toolsPdfFromImages(items, o.dpi);
          if (!p || p.error) throw new Error((p && p.error) || 'falha ao montar o PDF');
          const target = await api.toolsTarget({ base: base(todo[0].path) + (todo.length > 1 ? ` e mais ${todo.length - 1}` : ''), ext: 'pdf', src: todo[0].path, mode: o.outMode, dir: o.outDir });
          await api.toolsWrite(target, p.bytes);
          todo.forEach(q => { q.out = target; });
          addLog(`PDF com ${items.length} página(s) → ${target} (${fmtSize(p.bytes.length)})`, 'ok');
        } catch (e) { addLog('erro: ' + e.message, 'bad'); todo.forEach(q => { if (q.status === 'run') q.status = 'err'; }); }
        running = false; files.render();
        return;
      }
      await runQueue('img', files.render, async q => {
        const t = Date.now();
        live(`lendo ${q.path.split(/[\\/]/).pop()}…`);
        const imgs = await loadImages(q.path, o);
        const outs = [];
        for (const { img, suffix } of imgs) {
          live(`gravando ${q.path.split(/[\\/]/).pop()}${suffix} em ${f.toUpperCase()}…`);
          const r = await saveImage(img, f, o, q.path, base(q.path) + suffix);
          outs.push(r);
          addLog(`${q.path.split(/[\\/]/).pop()}${suffix} (${img.width}×${img.height}) → ${r.file.split(/[\\/]/).pop()} · ${fmtSize(r.size)} · ${((Date.now() - t) / 1000).toFixed(1).replace('.', ',')} s`, 'ok');
        }
        q.out = outs[0] && outs[0].file;
      }, `Converter imagens para ${f.toUpperCase()}`);
    };
    const node = el('div', { class: 'tl-tab' }, [
      files.node,
      el('div', { class: 'tr-cfg' }, [
        field('Converter para', fmt),
        el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Qualidade' }), el('div', { class: 'inline' }, [quality, qLab])]),
        field('Tamanho', el('div', { class: 'inline' }, [sizeMode, maxPx, pct])),
        field('Cor de fundo (o formato não tem transparência)', bgColor),
        field('Resolução (dpi)', dpi),
        el('label', { class: 'chk' }, [onePdf, ' Juntar todas as imagens num PDF só (uma por página)']),
        outControls(),
        el('div', { class: 'enh-run' }, [el('button', { class: 'primary big', text: '▶ Converter', onclick: start }), el('button', { class: 'danger', text: 'Parar', onclick: () => { stopAsked = true; } })])
      ]),
      el('p', { class: 'small muted', text: 'Entrada: ' + IMG_IN_LIST.map(x => x[0]).join(' · ') })
    ]);
    sync();
    return node;
  }

  // ---------------------------------------------------------------- aba Textos
  const escapeXml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function assetSrc(proj, id) { const a = proj.assets && proj.assets[id]; return a && a.dataUrl ? a.dataUrl : ''; }
  function chapterDom(proj, c) {
    const d = document.createElement('div');
    d.innerHTML = c.html;
    d.querySelectorAll('img[data-asset]').forEach(img => { const s = assetSrc(proj, img.getAttribute('data-asset')); if (s) img.setAttribute('src', s); else img.remove(); });
    d.querySelectorAll('.comment, .ix-mark').forEach(x => x.remove());
    return d;
  }
  // HTML único, com as imagens dentro
  function toHtml(proj) {
    const m = proj.meta;
    const body = proj.chapters.map(c => { const d = chapterDom(proj, c); let n = 0; const notes = []; d.querySelectorAll('.footnote').forEach(f => { n++; notes.push(`<li id="n${proj.chapters.indexOf(c)}-${n}">${f.innerHTML}</li>`); f.outerHTML = `<sup><a href="#n${proj.chapters.indexOf(c)}-${n}">${n}</a></sup>`; }); return `<section class="chapter">\n<h1>${escapeXml(c.title || '')}</h1>\n${d.innerHTML}${notes.length ? `\n<ol class="notes">${notes.join('')}</ol>` : ''}\n</section>`; }).join('\n');
    return `<!DOCTYPE html>\n<html lang="${escapeXml(m.language || 'pt-BR')}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeXml(m.title || '')}</title>\n<meta name="author" content="${escapeXml(m.author || '')}">\n<style>body{max-width:40em;margin:3em auto;padding:0 1em;font:1.1em/1.6 Georgia,'Times New Roman',serif;color:#1a1a1a}h1{text-align:center;margin:2.5em 0 1em;font-weight:normal}p{margin:0;text-indent:1.5em;text-align:justify}h1+p,h2+p,h3+p{text-indent:0}figure{margin:1.5em auto;text-align:center}img{max-width:100%;height:auto}figcaption{font-size:.85em;color:#555}blockquote{margin:1em 2em;font-size:.95em}ol.notes{font-size:.85em;border-top:1px solid #ccc;padding-top:.5em;margin-top:2em}.hl-yellow{background:#fff200}.hl-green{background:#39ff14}.hl-pink{background:#ff2ec4;color:#fff}.hl-gray{background:#d0d0d0}.hl-black{background:#111;color:#fff}.hl-outline{border:1px solid #222}.smallcaps{font-variant:small-caps}</style>\n</head>\n<body>\n<header><h1 class="book-title">${escapeXml(m.title || '')}</h1>${m.author ? `<p style="text-align:center;text-indent:0">${escapeXml(m.author)}</p>` : ''}</header>\n${body}\n</body>\n</html>\n`;
  }
  // Markdown (imagens numa pasta ao lado)
  async function toMarkdown(proj, imgDir) {
    const out = [`# ${proj.meta.title || ''}`, proj.meta.author ? `*${proj.meta.author}*` : ''];
    const files = [];
    let fn = 0;
    const inline = node => Array.from(node.childNodes).map(n => {
      if (n.nodeType === 3) return n.nodeValue.replace(/([*_`[\]\\])/g, '\\$1').replace(/\s+/g, ' ');
      if (n.nodeType !== 1) return '';
      const t = n.tagName, inner = inline(n);
      if (n.classList.contains('footnote')) { fn++; notes.push(`[^${fn}]: ${inline(n).trim()}`); return `[^${fn}]`; }
      if (t === 'B' || t === 'STRONG') return inner.trim() ? `**${inner}**` : inner;
      if (t === 'I' || t === 'EM') return inner.trim() ? `*${inner}*` : inner;
      if (t === 'S' || t === 'DEL') return `~~${inner}~~`;
      if (t === 'CODE') return '`' + n.textContent + '`';
      if (t === 'BR') return '  \n';
      if (t === 'A') return `[${inner}](${n.getAttribute('href') || ''})`;
      if (t === 'SUP') return `^${inner}^`;
      if (t === 'IMG') return img(n);
      return inner;
    }).join('');
    let notes = [];
    const img = n => {
      const s = n.getAttribute('src') || '';
      const m = /^data:image\/(\w+);base64,(.*)$/.exec(s);
      if (!m) return '';
      const name = `imagem-${files.length + 1}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      files.push({ name, b64: m[2] });
      return `![](${imgDir}/${name})`;
    };
    const block = n => {
      if (n.nodeType === 3) return n.nodeValue.trim() ? n.nodeValue.trim() : '';
      if (n.nodeType !== 1) return '';
      const t = n.tagName;
      if (/^H[1-6]$/.test(t)) return '#'.repeat(Math.min(6, Number(t[1]) + 1)) + ' ' + inline(n).trim();
      if (t === 'UL' || t === 'OL') return Array.from(n.children).map((li, i) => (t === 'OL' ? `${i + 1}. ` : '- ') + inline(li).trim()).join('\n');
      if (t === 'BLOCKQUOTE' || n.classList.contains('box')) return Array.from(n.childNodes).map(block).filter(Boolean).join('\n\n').split('\n').map(l => '> ' + l).join('\n');
      if (t === 'HR') return '***';
      if (t === 'FIGURE') { const i = n.querySelector('img'); const cap = n.querySelector('figcaption'); return (i ? img(i) : '') + (cap ? `\n\n*${inline(cap).trim()}*` : ''); }
      if (t === 'TABLE') { const rows = Array.from(n.querySelectorAll('tr')).map(r => '| ' + Array.from(r.children).map(c => inline(c).trim().replace(/\|/g, '\\|')).join(' | ') + ' |'); if (rows.length) rows.splice(1, 0, '|' + ' --- |'.repeat(n.querySelector('tr').children.length)); return rows.join('\n'); }
      if (t === 'DIV' && !n.textContent.trim() && !n.querySelector('img')) return '';
      if (t === 'DIV' || t === 'SECTION' || t === 'ASIDE') return Array.from(n.childNodes).map(block).filter(Boolean).join('\n\n');
      return inline(n).trim();
    };
    proj.chapters.forEach(c => {
      notes = []; fn = 0;
      const d = chapterDom(proj, c);
      out.push(`## ${c.title || ''}`);
      out.push(...Array.from(d.childNodes).map(block).filter(Boolean));
      if (notes.length) out.push(notes.join('\n'));
    });
    return { text: out.filter(x => x !== '').join('\n\n') + '\n', files };
  }
  // RTF (Word, LibreOffice, WordPad): títulos, ênfases, notas de rodapé e imagens PNG/JPEG
  function toRtf(proj) {
    const esc = s => String(s).replace(/[\\{}]/g, m => '\\' + m).replace(/[^\x00-\x7f]/g, ch => { const c = ch.charCodeAt(0); return `\\u${c > 32767 ? c - 65536 : c}?`; }).replace(/\t/g, '\\tab ').replace(/\n/g, ' ');
    const pict = s => {
      const m = /^data:image\/(png|jpeg|jpg);base64,(.*)$/.exec(s || '');
      if (!m) return '';
      const bin = atob(m[2]);
      let hex = '';
      for (let i = 0; i < bin.length; i++) { hex += bin.charCodeAt(i).toString(16).padStart(2, '0'); if (i % 64 === 63) hex += '\n'; }
      return `{\\pict\\${m[1] === 'png' ? 'pngblip' : 'jpegblip'}\\picscalex100\\picscaley100\n${hex}}`;
    };
    const inline = node => Array.from(node.childNodes).map(n => {
      if (n.nodeType === 3) return esc(n.nodeValue.replace(/\s+/g, ' '));
      if (n.nodeType !== 1) return '';
      const t = n.tagName, inner = inline(n);
      if (n.classList.contains('footnote')) return `{\\super\\chftn}{\\footnote\\pard\\plain\\fs18{\\super\\chftn} ${inline(n)}}`;
      if (t === 'B' || t === 'STRONG') return `{\\b ${inner}}`;
      if (t === 'I' || t === 'EM') return `{\\i ${inner}}`;
      if (t === 'U') return `{\\ul ${inner}}`;
      if (t === 'S') return `{\\strike ${inner}}`;
      if (t === 'SUP') return `{\\super ${inner}}`;
      if (t === 'SUB') return `{\\sub ${inner}}`;
      if (n.classList.contains('smallcaps')) return `{\\scaps ${inner}}`;
      if (t === 'BR') return '\\line ';
      if (t === 'IMG') return pict(n.getAttribute('src'));
      return inner;
    }).join('');
    const par = (txt, fmt) => `{\\pard\\plain${fmt || '\\fi340\\qj\\sa60\\fs24'} ${txt}\\par}\n`;
    const block = n => {
      if (n.nodeType === 3) return n.nodeValue.trim() ? par(esc(n.nodeValue.trim())) : '';
      if (n.nodeType !== 1) return '';
      const t = n.tagName;
      if (/^H[1-6]$/.test(t)) return par(`{\\b ${inline(n)}}`, `\\qc\\sb240\\sa120\\fs${t === 'H2' ? 30 : t === 'H3' ? 26 : 24}`);
      if (t === 'UL' || t === 'OL') return Array.from(n.children).map((li, i) => par((t === 'OL' ? (i + 1) + '. ' : '\\bullet  ') + inline(li), '\\li360\\fi-240\\sa40\\fs24')).join('');
      if (t === 'BLOCKQUOTE') return Array.from(n.childNodes).map(x => (x.nodeType === 1 && x.tagName === 'P' ? par(inline(x), '\\li720\\ri720\\sa80\\fs22') : block(x))).join('');
      if (t === 'HR') return par('*', '\\qc\\sb120\\sa120\\fs24');
      if (t === 'FIGURE') { const i = n.querySelector('img'); const cap = n.querySelector('figcaption'); return (i ? par(pict(i.getAttribute('src')), '\\qc\\sa60') : '') + (cap ? par(`{\\i ${inline(cap)}}`, '\\qc\\sa120\\fs20') : ''); }
      if (t === 'TABLE') return Array.from(n.querySelectorAll('tr')).map(r => par(Array.from(r.children).map(c => inline(c)).join('\\tab '), '\\sa40\\fs22')).join('');
      if (t === 'DIV' || t === 'SECTION' || t === 'ASIDE') return Array.from(n.childNodes).map(block).join('');
      return par(inline(n), n.classList && (n.classList.contains('no-indent') || n.classList.contains('poem')) ? '\\qj\\sa60\\fs24' : undefined);
    };
    let body = par(`{\\b ${esc(proj.meta.title || '')}}`, '\\qc\\sb2400\\sa240\\fs44') + (proj.meta.author ? par(esc(proj.meta.author), '\\qc\\sa240\\fs28') : '');
    proj.chapters.forEach(c => {
      const d = chapterDom(proj, c);
      body += `{\\pard\\page\\par}\n` + par(`{\\b ${esc(c.title || '')}}`, '\\qc\\sb1200\\sa480\\fs36') + Array.from(d.childNodes).map(block).join('');
    });
    return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman Garamond;}}{\\info{\\title ${esc(proj.meta.title || '')}}{\\author ${esc(proj.meta.author || '')}}}\\paperw8391\\paperh11906\\margl1134\\margr1134\\margt1134\\margb1134\\f0\\fs24\n${body}}`;
  }
  // FB2 (FictionBook): seções, ênfases, notas e ilustrações
  function toFb2(proj) {
    const bins = [];
    const notes = [];
    const inline = node => Array.from(node.childNodes).map(n => {
      if (n.nodeType === 3) return escapeXml(n.nodeValue.replace(/\s+/g, ' '));
      if (n.nodeType !== 1) return '';
      const t = n.tagName, inner = inline(n);
      if (n.classList.contains('footnote')) { notes.push(inline(n)); return `<a l:href="#n${notes.length}" type="note">[${notes.length}]</a>`; }
      if (t === 'B' || t === 'STRONG') return `<strong>${inner}</strong>`;
      if (t === 'I' || t === 'EM') return `<emphasis>${inner}</emphasis>`;
      if (t === 'S') return `<strikethrough>${inner}</strikethrough>`;
      if (t === 'SUP') return `<sup>${inner}</sup>`;
      if (t === 'SUB') return `<sub>${inner}</sub>`;
      return inner;
    }).join('');
    const image = s => { const m = /^data:(image\/(?:png|jpeg));base64,(.*)$/.exec(s || ''); if (!m) return ''; bins.push({ id: `img${bins.length + 1}.${m[1] === 'image/png' ? 'png' : 'jpg'}`, type: m[1], data: m[2] }); return `<image l:href="#${bins[bins.length - 1].id}"/>`; };
    const block = n => {
      if (n.nodeType === 3) return n.nodeValue.trim() ? `<p>${escapeXml(n.nodeValue.trim())}</p>` : '';
      if (n.nodeType !== 1) return '';
      const t = n.tagName;
      if (/^H[1-6]$/.test(t)) return `<subtitle>${inline(n)}</subtitle>`;
      if (t === 'BLOCKQUOTE') return `<cite>${Array.from(n.childNodes).map(block).join('')}</cite>`;
      if (t === 'HR') return '<empty-line/>';
      if (t === 'UL' || t === 'OL') return Array.from(n.children).map((li, i) => `<p>${t === 'OL' ? i + 1 + '. ' : '• '}${inline(li)}</p>`).join('');
      if (t === 'FIGURE') { const i = n.querySelector('img'); const cap = n.querySelector('figcaption'); return (i ? image(i.getAttribute('src')) : '') + (cap ? `<p><emphasis>${inline(cap)}</emphasis></p>` : ''); }
      if (n.classList.contains('poem')) return `<poem><stanza>${n.innerHTML.split(/<br\s*\/?>/i).map(v => { const x = document.createElement('div'); x.innerHTML = v; return `<v>${inline(x)}</v>`; }).join('')}</stanza></poem>`;
      if (t === 'DIV' || t === 'SECTION' || t === 'ASIDE') return Array.from(n.childNodes).map(block).join('');
      const inner = inline(n);
      return inner.trim() ? `<p>${inner}</p>` : '';
    };
    const sections = proj.chapters.map(c => `<section><title><p>${escapeXml(c.title || '')}</p></title>${Array.from(chapterDom(proj, c).childNodes).map(block).join('\n')}</section>`).join('\n');
    const [first, ...rest] = String(proj.meta.author || '').split(' ');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">\n<description><title-info><author><first-name>${escapeXml(first || '')}</first-name><last-name>${escapeXml(rest.join(' '))}</last-name></author><book-title>${escapeXml(proj.meta.title || '')}</book-title><lang>${escapeXml((proj.meta.language || 'pt').slice(0, 2))}</lang></title-info><document-info><program-used>Casa Vertigem Hub</program-used><date>${new Date().toISOString().slice(0, 10)}</date></document-info></description>\n<body><title><p>${escapeXml(proj.meta.title || '')}</p></title>\n${sections}\n</body>\n${notes.length ? `<body name="notes"><title><p>Notas</p></title>${notes.map((n, i) => `<section id="n${i + 1}"><title><p>${i + 1}</p></title><p>${n}</p></section>`).join('')}</body>\n` : ''}${bins.map(b => `<binary id="${b.id}" content-type="${b.type}">${b.data}</binary>`).join('\n')}\n</FictionBook>\n`;
  }
  async function convertText(q, fmt, o) {
    const name = q.path.split(/[\\/]/).pop();
    const log = m => live(`${name} — ${m}`);
    const { proj } = await App.enhance.loadBook(q.path, base(q.path), log, { images: o.images, allowAny: true, clean: o.clean });
    // conversão neutra: sem sumário, ficha e direitos acrescentados (o conteúdo é o do arquivo)
    Object.assign(proj.front, { toc: false, copyright: false, halfTitle: false, dedication: false, epigraph: false });
    const target = await api.toolsTarget({ base: base(q.path), ext: fmt === 'md' ? 'md' : fmt, src: q.path, mode: o.outMode, dir: o.outDir });
    log(`gravando ${fmt.toUpperCase()}…`);
    if (['docx', 'odt', 'txt'].includes(fmt)) {
      const r = await api.exportRun({ kind: fmt, project: proj, doc: App.exportPrep.buildDoc(proj), opts: { target } });
      if (!r || !r.files) throw new Error('falha ao gravar');
    } else if (fmt === 'epub' || fmt === 'mobi') {
      const r = await api.exportRun({ kind: fmt, project: proj, epub: await App.exportPrep.buildEpub(proj, { includeCover: false, noCopyright: true }), opts: { target } });
      if (!r || !r.files) throw new Error('falha ao gravar');
    } else if (fmt === 'pdf') {
      const r = await api.exportRun({ kind: 'pdf', project: proj, opts: { target } });
      if (!r || !(r.files || r.pages)) throw new Error('falha ao gravar o PDF');
    } else if (fmt === 'html') await api.toolsWrite(target, toHtml(proj));
    else if (fmt === 'rtf') await api.toolsWrite(target, toRtf(proj));
    else if (fmt === 'fb2') await api.toolsWrite(target, toFb2(proj));
    else if (fmt === 'md') {
      const folder = base(target) + '-imagens';
      const md = await toMarkdown(proj, folder.replace(/ /g, '%20'));
      await api.toolsWrite(target, md.text);
      const dir = target.replace(/[^\\/]+$/, '') + folder;
      for (const f of md.files) await api.toolsWrite(dir + (target.includes('\\') ? '\\' : '/') + f.name, Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)));
    }
    q.out = target;
    const words = proj.chapters.reduce((s, c) => s + window.BookText.countWords(c.html), 0);
    addLog(`${name} → ${target.split(/[\\/]/).pop()} · ${proj.chapters.length} capítulo(s) · ${words.toLocaleString('pt-BR')} palavras`, 'ok');
  }
  function textTab() {
    const files = fileList('txt', 'text', TXT_IN, 'Livros e textos: DOCX, DOC, ODT, RTF, EPUB, PDF, TXT, Markdown, HTML, FB2 — clique ou arraste (vários de uma vez)');
    const fmt = el('select', {}, TXT_OUT.map(([v, t]) => el('option', { value: v, text: t })));
    const images = el('input', { type: 'checkbox', checked: true });
    const clean = el('input', { type: 'checkbox' });
    const start = () => runQueue('txt', files.render, q => convertText(q, fmt.value, { images: images.checked, clean: clean.checked ? undefined : false, outMode: state.outMode, outDir: state.outDir }), `Converter textos para ${fmt.value.toUpperCase()}`);
    return el('div', { class: 'tl-tab' }, [
      files.node,
      el('div', { class: 'tr-cfg' }, [
        field('Converter para', fmt, 'Títulos, capítulos, ênfases, notas de rodapé, listas, tabelas e ilustrações são mantidos (no TXT fica só o texto).'),
        el('label', { class: 'chk' }, [images, ' Manter as ilustrações']),
        el('label', { class: 'chk' }, [clean, ' Limpar avisos do Project Gutenberg e páginas extras (como no Melhoramento)']),
        outControls(),
        el('div', { class: 'enh-run' }, [el('button', { class: 'primary big', text: '▶ Converter', onclick: start }), el('button', { class: 'danger', text: 'Parar', onclick: () => { stopAsked = true; } })])
      ]),
      el('p', { class: 'small muted', text: 'Entrada: ' + TXT_IN_LIST.join(' · ') })
    ]);
  }

  // ---------------------------------------------------------------- aba Remover fundo
  function previewCanvas(img, maxSide) {
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
    t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height), 0, 0);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(t, 0, 0, c.width, c.height);
    return c;
  }
  async function removeBg(img, o, onStep) {
    // modo automático: fundo liso (estúdio, logotipo, produto em fundo branco) → algoritmo de cor;
    // foto com fundo variado → IA
    let mode = o.mode;
    if (mode === 'auto') {
      const b = await work('border', { img });
      const st = await api.toolsBgStatus();
      mode = b.std < 14 || !st.installed ? 'flat' : 'ai';
      if (onStep) onStep(mode === 'flat' ? (b.std < 14 ? 'fundo liso detectado: recorte pela cor da borda' : 'modelo de IA não instalado: recorte pela cor da borda') : 'fundo variado: recorte por IA');
    }
    let out;
    if (mode === 'flat') out = await work('flat', { img, opts: { tolerance: o.tolerance, feather: o.feather > 0 ? Math.min(3, Math.round(o.feather)) : 0, holes: o.holes } });
    else {
      const small = await work('small', { img, max: 1600 });
      const m = await api.toolsBgMask(small.bytes, 'image/png');
      if (!m || m.error) throw new Error((m && m.error) || 'falha na IA');
      out = await work('mask', { img, mask: m, opts: { feather: o.feather, threshold: o.threshold } });
    }
    if (o.trim) out = await work('trim', { img: out, pad: Math.round(Math.max(out.width, out.height) * 0.01) });
    return { img: out, mode };
  }
  function bgTab() {
    const files = fileList('bg', 'image', [].concat(IMG_IN.browser, IMG_IN.svg, IMG_IN.main), 'Fotos, produtos, retratos, logotipos (PNG, JPG, WebP, HEIC, TIFF, PSD…) — clique ou arraste (vários de uma vez)');
    const mode = el('select', {}, [['auto', 'Automático — escolhe sozinho (recomendado)'], ['ai', 'IA — pessoas, objetos e fotos com fundo variado'], ['flat', 'Fundo liso — produto, logotipo ou foto de estúdio (sem IA)']].map(([v, t]) => el('option', { value: v, text: t })));
    const tol = el('input', { type: 'range', min: 2, max: 60, value: 18 });
    const feather = el('input', { type: 'range', min: 0, max: 6, value: 1, step: 0.5 });
    const thr = el('input', { type: 'range', min: 0, max: 80, value: 10 });
    const holes = el('input', { type: 'checkbox', checked: true });
    const trimChk = el('input', { type: 'checkbox' });
    const outFmt = el('select', {}, [['png', 'PNG transparente'], ['webp', 'WebP transparente'], ['color', 'Fundo de cor (JPG)'], ['colorpng', 'Fundo de cor (PNG)']].map(([v, t]) => el('option', { value: v, text: t })));
    const color = el('input', { type: 'color', value: '#ffffff' });
    const before = el('div', { class: 'tl-prev' }), after = el('div', { class: 'tl-prev tl-checker' });
    const modelBox = el('div', { class: 'tr-sub' });
    const drawModel = async () => {
      const st = await api.toolsBgStatus();
      modelBox.innerHTML = '';
      const msg = el('p', { class: 'small ' + (st.installed ? 'good' : 'muted'), text: st.installed ? `✓ IA pronta: ${st.name}${st.bundled ? ' (veio no instalador)' : ''} — roda no computador, sem internet.` : `Modelo de IA ${st.name}: baixe uma vez (~25 MB) para recortar fotos com fundo variado. Sem ele, o modo automático usa o recorte pela cor do fundo.` });
      const bar = el('div', { class: 'upd-bar', style: { display: 'none' } }, [el('i')]);
      const btn = st.installed ? null : el('button', { class: 'primary', text: '⬇ Baixar o modelo de IA', onclick: async () => {
        btn.disabled = true; bar.style.display = '';
        const off = api.onToolsBgProgress(p => { bar.firstChild.style.width = Math.round(p.ratio * 100) + '%'; });
        const r = await api.toolsBgInstall();
        off();
        if (!r || r.error) { msg.className = 'small bad'; msg.textContent = '✕ ' + ((r && r.error) || 'falha no download'); btn.disabled = false; return; }
        drawModel();
      } });
      const custom = el('input', { type: 'text', value: st.custom, placeholder: 'Xenova/modnet (padrão)' });
      const dtype = el('select', {}, [['fp32', 'fp32'], ['fp16', 'fp16'], ['q8', 'q8 (quantizado)']].map(([v, t]) => el('option', { value: v, text: t, selected: st.dtype === v })));
      modelBox.append(el('h4', { text: 'Modelo de IA' }), msg, bar, btn,
        el('details', {}, [el('summary', { class: 'small', text: 'Avançado: outro modelo compatível (Hugging Face, tarefa “background-removal”)' }),
          el('div', { class: 'inline wrap' }, [custom, dtype, el('button', { text: 'Usar', onclick: async () => { await api.toolsBgModel(custom.value, dtype.value); drawModel(); } })]),
          el('p', { class: 'small muted', text: 'Deixe vazio para o MODNet (Apache-2.0). Confira a licença do modelo antes de usar em trabalho comercial.' })]));
    };
    drawModel();
    const opts = () => ({ mode: mode.value, tolerance: +tol.value, feather: +feather.value, threshold: +thr.value, holes: holes.checked, trim: trimChk.checked });
    const sync = () => { color.closest('.tr-cfg-row').style.display = /color/.test(outFmt.value) ? '' : 'none'; tol.closest('.tr-cfg-row').style.display = mode.value === 'ai' ? 'none' : ''; thr.closest('.tr-cfg-row').style.display = mode.value === 'flat' ? 'none' : ''; };
    [outFmt, mode].forEach(x => x.addEventListener('change', sync));
    const start = () => runQueue('bg', files.render, async q => {
      const name = q.path.split(/[\\/]/).pop();
      live(`${name} — lendo…`);
      const [{ img }] = await loadImages(q.path, {});
      before.innerHTML = ''; before.appendChild(previewCanvas(img, 520));
      live(`${name} — removendo o fundo…`);
      const t = Date.now();
      const r = await removeBg(img, opts(), m => live(`${name} — ${m}`));
      after.innerHTML = ''; after.appendChild(previewCanvas(r.img, 520));
      const f = outFmt.value;
      const fmt = f === 'color' ? 'jpeg' : f === 'colorpng' ? 'png' : f;
      let final = r.img;
      if (f === 'colorpng') { const c = previewCanvas(r.img, Math.max(r.img.width, r.img.height)); const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; const x = n.getContext('2d'); x.fillStyle = color.value; x.fillRect(0, 0, n.width, n.height); x.drawImage(c, 0, 0); final = { width: n.width, height: n.height, data: new Uint8Array(x.getImageData(0, 0, n.width, n.height).data.buffer) }; }
      const s = await saveImage(final, fmt, { quality: 92, background: color.value, outMode: state.outMode, outDir: state.outDir }, q.path, base(q.path) + ' (sem fundo)');
      q.out = s.file;
      addLog(`${name} → ${s.file.split(/[\\/]/).pop()} · ${r.mode === 'ai' ? 'IA' : 'cor do fundo'} · ${((Date.now() - t) / 1000).toFixed(1).replace('.', ',')} s`, 'ok');
    }, 'Remover fundo');
    const node = el('div', { class: 'tl-tab' }, [
      files.node,
      el('div', { class: 'tl-compare' }, [el('div', {}, [el('small', { class: 'muted', text: 'Antes' }), before]), el('div', {}, [el('small', { class: 'muted', text: 'Depois' }), after])]),
      el('div', { class: 'tr-cfg' }, [
        field('Como recortar', mode),
        field('Tolerância da cor do fundo', tol, 'Maior = remove tons mais distantes da cor da borda.'),
        field('Suavizar a borda', feather),
        field('Limpeza de sombras e restos (IA)', thr, 'Maior = recorte mais firme, sem halos.'),
        el('label', { class: 'chk' }, [holes, ' Remover também o fundo que aparece por dentro (miolo de letras, vãos)']),
        el('label', { class: 'chk' }, [trimChk, ' Cortar as sobras transparentes em volta']),
        field('Resultado', outFmt), field('Cor do novo fundo', color),
        outControls(),
        el('div', { class: 'enh-run' }, [el('button', { class: 'primary big', text: '▶ Remover fundo', onclick: start }), el('button', { class: 'danger', text: 'Parar', onclick: () => { stopAsked = true; } })])
      ]),
      modelBox
    ]);
    sync();
    return node;
  }

  function open(tab) {
    if (screen) { screen.classList.add('show'); if (tab) setTab(tab); return; }
    logBox = el('ol', { class: 'pg-log enh-log' });
    const tabs = { img: imageTab(), txt: textTab(), bg: bgTab() };
    const body = el('section', { class: 'enh-col tl-main' }, Object.values(tabs));
    const head = el('div', { class: 'tr-tabs' }, [['img', '🖼 Imagens'], ['txt', '📄 Textos'], ['bg', '✂ Remover fundo']].map(([k, t]) => el('button', { class: 'tr-tab', 'data-tab': k, text: t, onclick: () => setTab(k) })));
    screen = el('div', { class: 'enh-screen tl-screen show' }, [
      el('header', { class: 'enh-head' }, [
        el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('images') : '' }), el('div', {}, [el('h1', { text: 'Ferramentas' }), el('p', { class: 'muted', text: 'Converter imagens e textos entre formatos e remover o fundo de imagens — tudo no computador' })])]),
        el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
      ]),
      el('main', { class: 'enh-main' }, [el('div', { class: 'enh-col' }, [head, body]), el('section', { class: 'enh-col' }, [el('b', { text: 'Registro' }), logBox])])
    ]);
    screen._tabs = tabs;
    screen.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    screen.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); });
    document.body.appendChild(screen);
    setTab(tab || 'img');
    addLog('Pronto. Escolha a aba, envie os arquivos e clique em Converter.');
  }
  function setTab(t) {
    if (!screen) return;
    Object.entries(screen._tabs).forEach(([k, n]) => { n.style.display = k === t ? '' : 'none'; });
    screen.querySelectorAll('.tr-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  }

  App.toolbox = { open, setTab, IMG_OUT, TXT_OUT, IMG_IN_LIST, TXT_IN_LIST, toHtml, toRtf, toFb2, toMarkdown, removeBg, loadImages, saveImage, work, state, _convertText: convertText };
})();
