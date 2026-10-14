/* global App */
// Converte o livro numa estrutura neutra (blocos) para DOCX/ODT/TXT e em XHTML para EPUB 3.
(function () {
  const D = App.D;

  function runs(node, fmt) {
    fmt = fmt || {};
    const out = [];
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.nodeValue) out.push(Object.assign({ text: n.nodeValue.replace(/­/g, '') }, fmt)); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName;
      if (t === 'BR') { out.push({ br: true }); return; }
      if (t === 'SPAN' && n.classList.contains('footnote')) { out.push({ fn: runs(n, {}) }); return; }
      if (t === 'IMG' || t === 'FIGURE') return;
      const f = Object.assign({}, fmt);
      if (t === 'B' || t === 'STRONG') f.b = true;
      if (t === 'I' || t === 'EM') f.i = true;
      if (t === 'U') f.u = true;
      if (t === 'S') f.s = true;
      if (t === 'SUP') f.sup = true;
      if (t === 'SUB') f.sub = true;
      if (n.classList && n.classList.contains('smallcaps')) f.sc = true;
      out.push(...runs(n, f));
    });
    return out;
  }

  function blocksOf(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '').replace(/\ssrc="blob:[^"]*"/g, '');
    const blocks = [];
    Array.from(tpl.content.children).forEach(n => {
      const t = n.tagName;
      if (t === 'P') blocks.push({ t: 'p', cls: n.classList.contains('no-indent') ? 'noindent' : (n.className || 'body'), align: n.style.textAlign || '', runs: runs(n) });
      else if (/^H[1-6]$/.test(t)) blocks.push({ t: 'h', level: Math.max(2, Math.min(4, Number(t[1]))), runs: runs(n) });
      else if (t === 'BLOCKQUOTE') blocks.push({ t: 'quote', paras: Array.from(n.querySelectorAll('p')).map(p => runs(p)).concat(n.querySelector('p') ? [] : [runs(n)]) });
      else if (t === 'DIV' && n.classList.contains('poem')) blocks.push({ t: 'poem', stanzas: Array.from(n.querySelectorAll('p')).map(p => { const lines = [[]]; runs(p).forEach(r => { if (r.br) lines.push([]); else lines[lines.length - 1].push(r); }); return lines; }) });
      else if (t === 'DIV' && n.classList.contains('box')) blocks.push({ t: 'box', paras: Array.from(n.querySelectorAll('p')).map(p => runs(p)) });
      else if (t === 'DIV' && n.classList.contains('page-break')) blocks.push({ t: 'pagebreak' });
      else if (t === 'DIV' && n.classList.contains('fullbleed')) blocks.push({ t: 'image', asset: n.dataset.asset, widthPct: 100, caption: [] });
      else if (t === 'UL' || t === 'OL') blocks.push({ t: 'list', ordered: t === 'OL', items: Array.from(n.children).map(li => runs(li)) });
      else if (t === 'HR') blocks.push({ t: 'scene' });
      else if (t === 'FIGURE') {
        const cap = n.querySelector('figcaption');
        blocks.push({ t: 'image', asset: n.dataset.asset, widthPct: n.dataset.align === 'full' ? 100 : Number(n.dataset.width) || 60, caption: cap ? runs(cap) : [] });
      } else if (t === 'TABLE') {
        const cap = n.querySelector('caption');
        blocks.push({ t: 'table', rows: Array.from(n.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => ({ th: c.tagName === 'TH', runs: runs(c) }))), caption: cap ? runs(cap) : null });
      }
    });
    return blocks;
  }

  function buildDoc(project) {
    const s = project.settings;
    let n = 0;
    const chapters = project.chapters.map(c => {
      let label = '';
      if (c.numbered && s.chapterNumbering !== 'none') { n++; label = `${s.chapterLabel || ''} ${n}`.trim(); }
      let html = c.html;
      if (!s.footnotesVisible) html = html.replace(/<span class="footnote">[\s\S]*?<\/span>/g, '');
      return { title: c.title, label, blocks: blocksOf(html) };
    });
    if (project.back.bio.enabled) chapters.push({ title: project.back.bio.title, label: '', blocks: blocksOf(project.back.bio.html) });
    if (project.back.extra.enabled) chapters.push({ title: project.back.extra.title, label: '', blocks: blocksOf(project.back.extra.html) });
    return { meta: project.meta, font: s.styles.body.font, fontSize: s.styles.body.size, chapters };
  }

  // ---------------------------------------------------------------- EPUB 3
  function xhtmlOf(c, label, settings, ctr) {
    const doc = document.implementation.createHTMLDocument('x');
    const sec = doc.createElement('section');
    sec.setAttribute('epub:type', 'chapter');
    sec.setAttribute('role', 'doc-chapter');
    if (c.id) sec.id = c.id;
    const h = doc.createElement('h1');
    if (label) { const l = doc.createElement('span'); l.className = 'label'; l.textContent = label; h.appendChild(l); h.appendChild(doc.createElement('br')); }
    h.appendChild(doc.createTextNode(c.title));
    sec.appendChild(h);
    const body = doc.createElement('div');
    body.innerHTML = String(c.html || '').replace(/\ssrc="blob:[^"]*"/g, '');
    body.querySelectorAll('span.comment').forEach(c => c.remove()); // comentários de revisão não vão para o livro
    body.querySelectorAll('span.ix').forEach(x => x.replaceWith(...x.childNodes)); // marcas do índice remissivo (só no impresso)
    const notes = [];
    body.querySelectorAll('span.footnote').forEach(fn => {
      if (!settings.footnotesVisible) { fn.remove(); return; }
      const i = notes.length + 1;
      const id = `${c.id}-n${i}`;
      const a = doc.createElement('a');
      a.setAttribute('epub:type', 'noteref');
      a.setAttribute('role', 'doc-noteref');
      a.setAttribute('href', `#${id}`);
      a.id = `${id}-ref`;
      a.textContent = String(i);
      const sup = doc.createElement('sup');
      sup.appendChild(a);
      notes.push({ id, html: fn.innerHTML });
      fn.replaceWith(sup);
    });
    body.querySelectorAll('figure.img').forEach(f => {
      const fig = doc.createElement('figure');
      fig.className = 'img';
      const img = doc.createElement('img');
      img.setAttribute('data-asset', f.dataset.asset);
      img.setAttribute('alt', (f.querySelector('figcaption') || {}).textContent || '');
      img.setAttribute('style', `width:${f.dataset.align === 'full' ? 100 : Number(f.dataset.width) || 60}%`);
      fig.appendChild(img);
      const cap = f.querySelector('figcaption');
      if (cap && cap.textContent.trim()) {
        const fc = doc.createElement('figcaption'); fc.innerHTML = cap.innerHTML;
        // mesma numeração do livro impresso (Figura N / Gráfico N)
        const OWN = /^\s*(Figura|Fig\.?|Gr[áa]fico|Tabela|Quadro|Imagem|Ilustra[çc][ãa]o|Mapa|Foto(grafia)?)\s*\d+/i;
        const a = App.project.assets[f.dataset.asset];
        const k = a && a.chart ? 'graf' : 'fig';
        if (ctr && settings.captionNumbering !== false && !OWN.test(fc.textContent)) { const n = ++ctr[k]; fig.id = `${k}-${n}`; fc.innerHTML = `<b>${k === 'graf' ? 'Gráfico' : 'Figura'} ${n}</b> – ` + fc.innerHTML; if (f.dataset.ref && ctr.refs) ctr.refs[f.dataset.ref] = { id: fig.id, label: `${k === 'graf' ? 'Gráfico' : 'Figura'} ${n}` }; }
        else if (f.dataset.ref && ctr && ctr.refs) { const m = OWN.exec(fc.textContent); fig.id = f.dataset.ref; ctr.refs[f.dataset.ref] = { id: fig.id, label: m ? m[0].trim() : (k === 'graf' ? 'gráfico' : 'figura') }; }
        fig.appendChild(fc);
      } else if (f.dataset.ref && ctr && ctr.refs) { fig.id = f.dataset.ref; ctr.refs[f.dataset.ref] = { id: fig.id, label: 'figura' }; }
      f.replaceWith(fig);
    });
    body.querySelectorAll('div.fullbleed').forEach(f => {
      const fig = doc.createElement('figure');
      fig.className = 'full';
      const img = doc.createElement('img');
      img.setAttribute('data-asset', f.dataset.asset);
      img.setAttribute('alt', '');
      fig.appendChild(img);
      f.replaceWith(fig);
    });
    // tabelas e quadros: mesma numeração do livro impresso; referências cruzadas apontam para o id final
    body.querySelectorAll('table').forEach(t => {
      const cap = t.querySelector(':scope > caption');
      const own = cap && /^\s*(Tabela|Quadro)\s*\d+/i.exec(cap.textContent);
      const quad = t.classList.contains('tb-quadro') || (own && /^\s*Quadro/i.test(own[0]));
      const word = quad ? 'Quadro' : 'Tabela';
      let label = word.toLowerCase();
      if (ctr && settings.captionNumbering !== false && cap && cap.textContent.trim() && !own) { const n = ++ctr[quad ? 'quad' : 'tab']; t.id = t.id || `${quad ? 'quad' : 'tab'}-${n}`; label = `${word} ${n}`; cap.innerHTML = `<b>${label}</b> – ` + cap.innerHTML; }
      else if (own) label = own[0].trim();
      if (t.dataset.ref && ctr && ctr.refs) { t.id = t.id || t.dataset.ref; ctr.refs[t.dataset.ref] = { id: t.id, label }; }
    });
    body.querySelectorAll('div.page-break').forEach(p => p.remove());
    body.querySelectorAll('hr.scene-break').forEach(hr => { const p = doc.createElement('p'); p.className = 'scene'; p.textContent = settings.sceneBreak || '* * *'; hr.replaceWith(p); });
    body.querySelectorAll('[style]').forEach(e => { if (!e.matches('img')) { const ta = e.style.textAlign; e.removeAttribute('style'); if (ta) e.setAttribute('style', `text-align:${ta}`); } });
    body.querySelectorAll('[contenteditable], [draggable], [data-fid]').forEach(e => { e.removeAttribute('contenteditable'); e.removeAttribute('draggable'); e.removeAttribute('data-fid'); });
    Array.from(body.childNodes).forEach(n => sec.appendChild(n));
    if (notes.length) {
      const asideWrap = doc.createElement('section');
      asideWrap.setAttribute('epub:type', 'footnotes');
      asideWrap.className = 'notes';
      notes.forEach((nt, i) => {
        const aside = doc.createElement('aside');
        aside.setAttribute('epub:type', 'footnote');
        aside.setAttribute('role', 'doc-footnote');
        aside.id = nt.id;
        aside.innerHTML = `<p><a href="#${nt.id}-ref">${i + 1}.</a> ${nt.html}</p>`;
        asideWrap.appendChild(aside);
      });
      sec.appendChild(asideWrap);
    }
    return new XMLSerializer().serializeToString(sec).replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/, '');
  }

  function epubCss(s) {
    const st = s.styles;
    const fam = f => `"${f || st.body.font}", Georgia, serif`;
    return `body { font-family: ${fam(st.body.font)}; line-height: ${st.body.lineHeight}; margin: 0 4%; }
p { margin: 0; text-indent: ${st.body.indent}em; text-align: ${st.body.align}; widows: 2; orphans: 2; }
h1 + p, h2 + p, h3 + p, h4 + p, figure + p, .scene + p, blockquote + p, p.no-indent { text-indent: 0; }
h1 { font-family: ${fam(st.chapterTitle.font)}; text-align: ${st.chapterTitle.align}; font-weight: ${st.chapterTitle.bold ? 700 : 400}; font-size: 1.7em; margin: 2.5em 0 1.5em; page-break-before: always; ${st.chapterTitle.uppercase ? 'text-transform: uppercase;' : ''}}
h1 .label { font-size: 0.55em; letter-spacing: 0.15em; text-transform: uppercase; }
h2 { font-family: ${fam(st.h2.font)}; font-size: 1.3em; font-weight: ${st.h2.bold ? 700 : 400}; text-align: ${st.h2.align}; margin: 1.4em 0 0.6em; }
h3 { font-family: ${fam(st.h3.font)}; font-size: 1.12em; font-style: ${st.h3.italic ? 'italic' : 'normal'}; margin: 1.2em 0 0.5em; }
h4 { font-family: ${fam(st.h4.font)}; font-size: 1em; font-variant: small-caps; margin: 1em 0 0.4em; }
blockquote { margin: 1em 2em; font-size: 0.95em; }
blockquote p { text-indent: 0; }
p.phrase { text-align: center; font-style: italic; font-size: 1.2em; margin: 1em 1em; text-indent: 0; }
p.reference { padding-left: 1.5em; text-indent: -1.5em; text-align: left; font-size: 0.92em; }
p.epigraph-inline { text-align: right; font-style: italic; margin-left: 30%; text-indent: 0; }
div.poem { margin: 1em 0 1em 2em; }
div.poem p { text-indent: 0; text-align: left; margin-bottom: 1em; }
div.box { border: 1px solid #999; padding: 0.6em 0.9em; margin: 1em 0; background: #f4f1ec; }
div.box p { text-indent: 0; }
p.scene { text-align: center; text-indent: 0; margin: 1em 0; }
figure { margin: 1em 0; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; height: auto; }
figure.full img { width: 100%; }
figcaption { font-size: 0.85em; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9em; }
td, th { border: 1px solid #777; padding: 0.3em 0.5em; text-align: left; }
th { background: #eee; }
caption { caption-side: top; font-size: 0.85em; padding-bottom: 0.3em; }
table.tb-zebra tr:nth-child(even) td { background: #f2f2f2; }
td.num { text-align: right; }
p.table-source { text-indent: 0; font-size: 0.8em; margin-bottom: 1em; }
td p, th p { text-indent: 0; }
.smallcaps { font-variant: small-caps; }
sup a { text-decoration: none; }
section.notes { margin-top: 2em; border-top: 1px solid #999; font-size: 0.85em; }
aside p { text-indent: 0; }
.titlepage { text-align: center; margin-top: 20%; }
.tp-title { font-size: 2em; page-break-before: avoid; }
.copyright p { text-indent: 0; font-size: 0.85em; text-align: left; }
.cover { text-align: center; } .cover img { max-width: 100%; max-height: 100%; }`;
  }

  async function buildEpub(project, opts) {
    const s = project.settings;
    let n = 0;
    const ctr = { fig: 0, graf: 0, tab: 0, quad: 0, refs: {} };
    const escX = App.escape;
    const docs = project.chapters.map(c => {
      let label = '';
      if (c.numbered && s.chapterNumbering !== 'none') { n++; label = `${s.chapterLabel || ''} ${n}`.trim(); }
      return { title: c.title, tocLabel: label ? `${label} — ${c.title}` : c.title, xhtml: xhtmlOf(c, label, s, ctr) };
    });
    if (project.back.bio.enabled) docs.push({ title: project.back.bio.title, xhtml: xhtmlOf({ id: 'bio', title: project.back.bio.title, html: project.back.bio.html }, '', s) });
    if (project.back.extra.enabled) docs.push({ title: project.back.extra.title, xhtml: xhtmlOf({ id: 'extra', title: project.back.extra.title, html: project.back.extra.html }, '', s) });
    // referências cruzadas (“ver Figura 3”): rótulo atual e ligação para a figura/tabela
    docs.forEach(d => {
      d.xhtml = d.xhtml.replace(/<a\b([^>]*\bclass="[^"]*\bxref-auto\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/g, (mm, attrs) => {
        const ref = ((/\shref="#([^"]+)"/.exec(attrs) || [])[1]) || '';
        const r = ctr.refs[ref];
        return r ? `<a${attrs.replace(/\shref="[^"]*"/, ` href="#${r.id}"`)}>${escX(r.label)}</a>` : mm;
      });
    });
    // ligações internas entre capítulos: cada capítulo é um arquivo no EPUB
    const owner = {};
    docs.forEach((d, i) => { const file = `chap${String(i + 1).padStart(3, '0')}.xhtml`; d.xhtml.replace(/\sid="([^"]+)"/g, (mm, id) => { owner[id] = { file, i }; return mm; }); });
    docs.forEach((d, i) => { d.xhtml = d.xhtml.replace(/href="#([^"]+)"/g, (mm, id) => (owner[id] && owner[id].i !== i ? `href="${owner[id].file}#${id}"` : mm)); });
    const m = project.meta;
    const cat = project.catalog;
    const esc = App.escape;
    const copyright = [
      `<p>${esc(cat.rights || `© ${m.year} ${m.author}. Todos os direitos reservados.`).replace(/\n/g, '<br/>')}</p>`,
      ...(cat.credits || []).filter(c => c.name).map(c => `<p><b>${esc(c.role)}:</b> ${esc(c.name)}</p>`),
      m.isbn ? `<p>ISBN ${esc(m.isbn)}</p>` : '',
      m.edition ? `<p>${esc(m.edition)}</p>` : ''
    ].join('');
    // capa: a imagem escolhida para o livro digital ou, se pedido, a frente montada no módulo Capa
    let cover = (opts && opts.coverDataUrl) || null;
    if (!cover && opts && opts.includeCover && project.cover) {
      const r = await App.api.exportRun({ kind: 'coverFront', project });
      if (r && r.dataUrl) cover = r.dataUrl;
    }
    // metadados completos: assuntos, colaboradores, série, direitos e autor na forma de catálogo
    const roles = { translator: 'Tradução', illustrator: 'Ilustrações' };
    const contributors = Object.entries(roles).filter(([k]) => cat[k]).map(([k, role]) => ({ name: cat[k], role }))
      .concat((cat.credits || []).filter(c => c && c.name && c.name.trim()).map(c => ({ name: c.name.trim(), role: c.role || 'Colaboração' })));
    const extra = {
      subjects: String(cat.subjects || '').split(/[\n;]+/).map(x => x.trim()).filter(Boolean),
      contributors, series: cat.series || '', fileAs: cat.authorEntry ? cat.authorEntry.replace(/,?\s*\d{4}-?\s*$/, '').trim() : '',
      rights: (cat.rights || `© ${m.year || ''} ${m.author || ''}. Todos os direitos reservados.`).replace(/\s+/g, ' ').trim()
    };
    return { meta: m, extra, docs, css: epubCss(s), copyright, cover, tocTitle: project.front.tocTitle };
  }

  App.exportPrep = { buildDoc, buildEpub, blocksOf };
})();
