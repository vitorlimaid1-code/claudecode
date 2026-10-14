/* global App */
// Colar tabelas, gráficos e imagens sem perder a formatação original.
// O conteúdo colado (Excel, Word, LibreOffice, Google Planilhas, páginas da web) é montado numa
// moldura invisível, sem scripts, com os estilos que vieram junto; daí se lê, célula a célula, o que o
// navegador realmente mostra (fundo, cor, negrito, itálico, alinhamentos, bordas e a proporção das
// colunas) e isso é gravado na própria tabela. No livro, a tabela só é encaixada na largura da mancha
// (mesmas proporções; letra reduzida quando ela era mais larga que a página).
// Gráficos em SVG viram imagem em alta resolução; imagens em arquivos temporários do Office e da web
// viram imagens do projeto.
(function () {
  const { api } = App;
  const px = v => parseFloat(v) || 0;
  const transparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

  function frameFor(html) {
    return new Promise(res => {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-same-origin');
      f.style.cssText = 'position:fixed; left:-12000px; top:0; width:1100px; height:900px; visibility:hidden; border:0;';
      // imagens: o endereço original fica guardado; nada é carregado de fora
      const safe = String(html)
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<(img|v:imagedata)\b([^>]*?)\s(src)=("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, tag, pre, a, v) => `<${tag}${pre} data-psrc=${v} src=""`);
      f.srcdoc = /<html[\s>]/i.test(safe) ? safe : `<!doctype html><html><head><meta charset="utf-8"></head><body>${safe}</body></html>`;
      f.onload = () => res(f);
      document.body.appendChild(f);
    });
  }

  // estilos de cada célula, por extenso (o que não tinha borda/fundo fica explícito, para o padrão do livro não entrar)
  function cellStyle(td, base) {
    const cs = td.ownerDocument.defaultView.getComputedStyle(td);
    const out = [];
    const bg = cs.backgroundColor;
    out.push(`background-color:${transparent(bg) ? 'transparent' : bg}`);
    out.push(`color:${cs.color}`);
    out.push(`font-weight:${Number(cs.fontWeight) >= 600 ? 700 : 400}`);
    if (cs.fontStyle === 'italic') out.push('font-style:italic');
    const ta = cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign;
    if (/^(left|right|center|justify)$/.test(ta)) out.push(`text-align:${ta}`);
    if (/^(top|middle|bottom)$/.test(cs.verticalAlign)) out.push(`vertical-align:${cs.verticalAlign}`);
    ['Top', 'Right', 'Bottom', 'Left'].forEach(sd => {
      const w = px(cs[`border${sd}Width`]), st = cs[`border${sd}Style`], c = cs[`border${sd}Color`];
      out.push(w > 0 && st !== 'none' && st !== 'hidden' ? `border-${sd.toLowerCase()}:${Math.min(3, Math.max(0.4, w * 0.75)).toFixed(2)}pt ${st} ${c}` : `border-${sd.toLowerCase()}:none`);
    });
    const fs = px(cs.fontSize);
    if (base && fs && Math.abs(fs / base - 1) > 0.08) out.push(`font-size:${Math.max(0.6, Math.min(1.8, fs / base)).toFixed(2)}em`);
    if (cs.textDecorationLine && /underline/.test(cs.textDecorationLine)) out.push('text-decoration:underline');
    return out.join(';');
  }

  function bookFont() {
    const st = App.project.settings.styles || {};
    return ((st.table || {}).font || (st.body || {}).font || 'EB Garamond').replace(/["\\]/g, '');
  }
  async function measureStyle(doc) {
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('vendor/fonts.css', location.href).href;
    const st = doc.createElement('style');
    st.textContent = `table.pk-measure, table.pk-measure * { font-family: "${bookFont()}", "EB Garamond", serif !important; } table.pk-measure td, table.pk-measure th { padding: 0.3em 0.45em !important; }`;
    doc.head.appendChild(link); doc.head.appendChild(st);
    await new Promise(r => { link.onload = r; link.onerror = r; setTimeout(r, 1500); });
    try { await doc.fonts.load(`700 14px "${bookFont()}"`); await doc.fonts.load(`14px "${bookFont()}"`); await doc.fonts.ready; } catch (e) { /* segue */ }
  }

  function keepTables(doc) {
    let n = 0;
    doc.querySelectorAll('table').forEach(t => {
      if (t.parentElement && t.parentElement.closest('table')) return; // tabelas dentro de tabelas: a de fora manda
      const rows = Array.from(t.rows);
      if (!rows.length) return;
      // tamanho de letra mais comum (base para os tamanhos relativos)
      const sizes = {};
      rows.forEach(r => Array.from(r.cells).forEach(c => { const f = Math.round(px(c.ownerDocument.defaultView.getComputedStyle(c).fontSize)); sizes[f] = (sizes[f] || 0) + 1; }));
      const base = Number(Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0]) || 14;
      // proporção das colunas: da linha com mais células sem mesclagem
      let ref = null;
      rows.forEach(r => { const cells = Array.from(r.cells); if (cells.every(c => (c.colSpan || 1) === 1) && (!ref || cells.length > ref.length)) ref = cells; });
      const tw = t.getBoundingClientRect().width;
      if (ref && tw) t.setAttribute('data-cols', ref.map(c => Math.max(1, Math.round(c.getBoundingClientRect().width / tw * 1000) / 10)).join(','));
      t.setAttribute('data-tw', String(Math.round(tw)));
      // largura mínima para nenhuma palavra ou número ser partido (com a letra original)
      const keep = t.getAttribute('style') || '';
      t.style.width = 'min-content'; t.style.tableLayout = 'auto';
      t.classList.add('pk-measure'); // com a fonte das tabelas do livro (a que vai ser usada na página)
      t.setAttribute('data-minw', String(Math.round(t.getBoundingClientRect().width)));
      t.classList.remove('pk-measure');
      t.setAttribute('data-fs', String(base));
      t.setAttribute('style', keep);
      rows.forEach(r => Array.from(r.cells).forEach(c => c.setAttribute('data-ks', cellStyle(c, base))));
      t.classList.add('tb-orig');
      n++;
    });
    return n;
  }

  // SVG (gráficos copiados de páginas e de alguns programas) -> PNG em alta resolução
  async function svgToPng(svg) {
    const r = svg.getBoundingClientRect();
    const w = Math.max(20, r.width || Number(svg.getAttribute('width')) || 600), h = Math.max(20, r.height || Number(svg.getAttribute('height')) || 400);
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = url; });
    if (!img.naturalWidth && !img.width) return null;
    const k = 4; // ~300 dpi para um gráfico de meia página
    const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/png');
  }

  async function fetchData(url) {
    try { const r = await fetch(url); if (!r.ok) return null; const b = await r.blob(); if (!/^image\//.test(b.type)) return null; return await App.fileToDataUrl(b); } catch (e) { return null; }
  }

  // html colado -> html com tabelas marcadas (formatação lida) e imagens embutidas (data:)
  async function prepare(html, files) {
    if (!/<table|<img|<svg|v:imagedata/i.test(html)) return { html, tables: 0, images: 0 };
    const f = await frameFor(html);
    const doc = f.contentDocument;
    let images = 0;
    try {
      if (doc.querySelector('table')) await measureStyle(doc);
      const tables = keepTables(doc);
      for (const svg of Array.from(doc.querySelectorAll('svg'))) {
        if (svg.closest('svg') !== svg || svg.getBoundingClientRect().width < 24) continue;
        const data = await svgToPng(svg);
        if (data) { const img = doc.createElement('img'); img.setAttribute('src', data); svg.replaceWith(img); images++; }
      }
      // imagens: data: ficam; file:/// (Office) e http(s) são lidas; a imagem da área de transferência
      // substitui a primeira que não puder ser lida (o Word costuma mandar as duas)
      const pending = Array.from(doc.querySelectorAll('img[data-psrc], v\\:imagedata[data-psrc]'));
      const fileUrls = pending.map(i => i.getAttribute('data-psrc')).filter(u => /^file:/i.test(u));
      const fromFiles = fileUrls.length && api.imagesFromFileUrls ? await api.imagesFromFileUrls(fileUrls) : [];
      const spare = (files || []).filter(x => /^image\//.test(x.type));
      for (const i of pending) {
        const src = i.getAttribute('data-psrc') || '';
        let data = /^data:image\//i.test(src) ? src : null;
        if (!data && /^file:/i.test(src)) { const a = fromFiles[fileUrls.indexOf(src)]; data = a && a.dataUrl; }
        if (!data && /^https?:/i.test(src)) data = await fetchData(src);
        if (!data && spare.length) data = await App.fileToDataUrl(spare.shift());
        if (data && i.tagName.toLowerCase() === 'img') { i.setAttribute('src', data); i.removeAttribute('data-psrc'); images++; }
        else if (data) { const img = doc.createElement('img'); img.setAttribute('src', data); i.replaceWith(img); images++; }
        else i.remove();
      }
      return { html: doc.body.innerHTML, tables, images };
    } finally { f.remove(); }
  }

  App.pasteKeep = { prepare };
})();
