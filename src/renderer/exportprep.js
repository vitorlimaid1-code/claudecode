/* global App, Ficha */
// Converte o livro numa estrutura neutra (blocos) para DOCX/ODT/TXT e em XHTML para EPUB 3.
(function () {
  const D = App.D;

  let curCharStyles = [];
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
      // estilo de caractere: as marcas que os formatos editáveis entendem (itálico, negrito, versalete, sublinhado)
      if (t === 'SPAN' && n.dataset && n.dataset.cs) {
        const cs = (curCharStyles || []).find(x => x.id === n.dataset.cs);
        if (cs) { if (cs.italic) f.i = true; if (cs.bold) f.b = true; if (cs.smallcaps) f.sc = true; if (cs.underline) f.u = true; }
      }
      out.push(...runs(n, f));
    });
    return out;
  }

  // estilo de uma célula de tabela colada com a formatação original (fundo, cor, negrito, alinhamento)
  function cellLook(c) {
    const st = c.style || {};
    const hex = v => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(v || ''); if (!m || (m[4] !== undefined && Number(m[4]) < 0.1)) return /^#[0-9a-f]{6}$/i.test(v || '') ? v : ''; return '#' + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, '0')).join(''); };
    return { bg: hex(st.backgroundColor), color: hex(st.color), b: Number(st.fontWeight) >= 600 || st.fontWeight === 'bold', i: st.fontStyle === 'italic', align: /^(left|right|center|justify)$/.test(st.textAlign) ? st.textAlign : '' };
  }
  function blocksOf(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '').replace(/\ssrc="blob:[^"]*"/g, '');
    const blocks = [];
    const each = n => {
      const t = n.tagName;
      // trecho em colunas: os parágrafos entram normalmente (o Word/LibreOffice não têm colunas num trecho)
      if (t === 'DIV' && n.classList.contains('cols')) { Array.from(n.children).forEach(each); return; }
      // caixa de texto à parte: vira um bloco recuado, como citação
      if (t === 'DIV' && n.classList.contains('tframe')) { blocks.push({ t: 'box', paras: Array.from(n.querySelectorAll('p')).map(p => runs(p)).concat(n.querySelector('p') ? [] : [runs(n)]) }); return; }
      // bloco de imagem ainda sem imagem (cinza): não vai para o arquivo
      if (t === 'DIV' && n.classList.contains('ph-block')) return;
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
        blocks.push({ t: 'image', asset: n.dataset.asset, align: ['left', 'right'].includes(n.dataset.align) ? n.dataset.align : '', widthPct: n.dataset.align === 'full' ? 100 : Number(n.dataset.width) || 60, caption: cap ? runs(cap) : [] });
        // caixas/legendas que ficam sobre a imagem no livro: aqui, logo abaixo dela, em itálico
        n.querySelectorAll(':scope > .fig-ov').forEach(o => { const tx = (o.innerText || o.textContent || '').trim(); if (tx) blocks.push({ t: 'p', cls: 'noindent', align: 'center', runs: [{ text: tx, i: true }] }); });
      } else if (t === 'TABLE') {
        const cap = n.querySelector('caption');
        const orig = n.classList.contains('tb-orig');
        blocks.push({ t: 'table', orig, rows: Array.from(n.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => {
          if (!orig) return { th: c.tagName === 'TH', runs: runs(c) };
          const lk = cellLook(c);
          return { th: c.tagName === 'TH', runs: runs(c, { b: lk.b || undefined, i: lk.i || undefined, color: lk.color || undefined }), bg: lk.bg, align: lk.align };
        })), caption: cap ? runs(cap) : null });
      }
    };
    Array.from(tpl.content.children).forEach(each);
    return blocks;
  }

  function buildDoc(project) {
    const s = project.settings;
    curCharStyles = s.charStyles || [];
    let n = 0;
    const chapters = project.chapters.map(c => {
      let label = '';
      if (c.numbered && s.chapterNumbering !== 'none') { n++; label = `${s.chapterLabel || ''} ${n}`.trim(); }
      let html = c.html;
      if (!s.footnotesVisible) html = html.replace(/<span class="footnote">[\s\S]*?<\/span>/g, '');
      const blocks = blocksOf(html);
      // páginas de imagem sangrada antes/depois do capítulo: a imagem em página inteira, com o texto do box abaixo
      const bl = c.bleed || {};
      const bleedBlocks = side => { const b = bl[side]; if (!b || !b.asset || !project.assets[b.asset]) return []; const box = b.box || {}; const cap = [box.title, box.text].filter(x => x && String(x).trim()).join(' — '); return [{ t: 'image', asset: b.asset, widthPct: 100, caption: cap ? [{ text: cap, i: true }] : [] }]; };
      return { title: c.title, label, blocks: bleedBlocks('before').concat(blocks, bleedBlocks('after')) };
    });
    if (project.back.bio.enabled) chapters.push({ title: project.back.bio.title, label: '', blocks: blocksOf(project.back.bio.html) });
    if (project.back.extra.enabled) chapters.push({ title: project.back.extra.title, label: '', blocks: blocksOf(project.back.extra.html) });
    return { meta: project.meta, font: s.styles.body.font, fontSize: s.styles.body.size, chapters, styles: s.styles, toc: project.front.toc !== false, tocTitle: project.front.tocTitle || 'Sumário' };
  }

  // ---------------------------------------------------------------- EPUB 3
  function xhtmlOf(c, label, settings, ctr) {
    const doc = document.implementation.createHTMLDocument('x');
    const sec = doc.createElement('section');
    sec.setAttribute('epub:type', 'chapter');
    sec.setAttribute('role', 'doc-chapter');
    if (c.id) sec.id = c.id;
    // imersão: a imagem da abertura do capítulo vem antes do título
    if (c.immersion) { const fig = doc.createElement('div'); fig.className = 'immersion'; const im = doc.createElement('img'); im.setAttribute('data-asset', c.immersion); im.setAttribute('alt', ''); fig.appendChild(im); sec.appendChild(fig); }
    // página de imagem sangrada antes do capítulo (com o texto do box como legenda)
    const bleedFig = side => {
      const b = (c.bleed || {})[side];
      if (!b || !b.asset || !App.project.assets[b.asset]) return null;
      const fig = doc.createElement('figure'); fig.className = 'full bleed-page';
      const im = doc.createElement('img'); im.setAttribute('data-asset', b.asset); im.setAttribute('alt', ''); fig.appendChild(im);
      const box = b.box || {}; const cap = [box.title, box.text].filter(x => x && String(x).trim());
      if (cap.length) { const fc = doc.createElement('figcaption'); if (box.title) { const bb = doc.createElement('b'); bb.textContent = box.title; fc.appendChild(bb); if (box.text) fc.appendChild(doc.createElement('br')); } if (box.text) fc.appendChild(doc.createTextNode(box.text)); fig.appendChild(fc); }
      return fig;
    };
    const pre = bleedFig('before');
    if (pre) sec.appendChild(pre);
    const h = doc.createElement('h1');
    const tb = Object.assign({}, settings.titleBox || {}, c.titleBox && c.titleBox.style ? c.titleBox : {});
    if (tb.style && tb.style !== 'none') h.className = `tb tb-${tb.style}${tb.align ? ' tb-al-' + tb.align : ''}`;
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
    body.querySelectorAll('div.ph-block').forEach(x => x.remove()); // bloco cinza à espera da imagem
    body.querySelectorAll('figure.img').forEach(f => {
      const fig = doc.createElement('figure');
      fig.className = 'img';
      const img = doc.createElement('img');
      img.setAttribute('data-asset', f.dataset.asset);
      img.setAttribute('alt', (f.querySelector('figcaption') || {}).textContent || '');
      const wPct = f.dataset.align === 'full' ? 100 : Number(f.dataset.width) || 60;
      // caixas/legendas sobre a imagem: a imagem vai num quadro com as caixas por cima (leitores que não
      // posicionam elementos mostram o texto logo abaixo da imagem)
      const ovs = Array.from(f.querySelectorAll(':scope > .fig-ov')).filter(o => window.Overlays && Overlays.byKey(o.dataset.ov) && (o.textContent || '').trim());
      if (ovs.length) {
        const wrap = doc.createElement('div');
        wrap.className = 'ov-wrap';
        wrap.setAttribute('style', `width:${wPct}%`); wrap.setAttribute('data-ks', '1');
        img.setAttribute('style', 'width:100%'); img.setAttribute('data-ks', '1');
        wrap.appendChild(img);
        ovs.forEach(o => {
          const pr = Overlays.byKey(o.dataset.ov);
          const d = doc.createElement('div');
          d.className = `fig-ov ov-${pr.key}`;
          d.setAttribute('style', Overlays.placeStyle(pr, o.dataset.y, o.dataset.rot)); d.setAttribute('data-ks', '1');
          String(o.innerText || o.textContent).split('\n').forEach((ln, i) => { if (i) d.appendChild(doc.createElement('br')); d.appendChild(doc.createTextNode(ln)); });
          wrap.appendChild(d);
        });
        fig.appendChild(wrap);
      } else {
        img.setAttribute('style', `width:${wPct}%`);
        fig.appendChild(img);
      }
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
    // tabelas coladas com a formatação original: as células mantêm o visual
    body.querySelectorAll('table.tb-orig td[style], table.tb-orig th[style]').forEach(c => c.setAttribute('data-ks', '1'));
    body.querySelectorAll('table.tb-orig').forEach(t => { t.removeAttribute('data-tw'); t.removeAttribute('data-minw'); t.removeAttribute('data-fs'); t.removeAttribute('data-cols'); });
    body.querySelectorAll('[style]').forEach(e => { if (e.hasAttribute('data-ks')) { e.removeAttribute('data-ks'); return; } if (!e.matches('img')) { const ta = e.style.textAlign; e.removeAttribute('style'); if (ta) e.setAttribute('style', `text-align:${ta}`); } });
    body.querySelectorAll('[data-ks]').forEach(e => e.removeAttribute('data-ks'));
    body.querySelectorAll('[contenteditable], [draggable], [data-fid]').forEach(e => { e.removeAttribute('contenteditable'); e.removeAttribute('draggable'); e.removeAttribute('data-fid'); });
    Array.from(body.childNodes).forEach(n => sec.appendChild(n));
    const post = bleedFig('after');
    if (post) sec.appendChild(post);
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
    const cs = D.charStylesCss(s.charStyles);
    return `${cs}
body { font-family: ${fam(st.body.font)}; line-height: ${st.body.lineHeight}; margin: 0 4%; }
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
.cover { text-align: center; } .cover img { max-width: 100%; max-height: 100%; }
.immersion { margin: 0 0 1em; } .immersion img { display: block; width: 100%; height: auto; }
figure.bleed-page { page-break-before: always; page-break-after: always; }
/* caixas e legendas sobre as imagens (tamanhos em relação ao texto do leitor) */
.ov-wrap { position: relative; display: inline-block; max-width: 100%; overflow: hidden; }
.ov-wrap img { display: block; }
${window.Overlays ? Overlays.css('').replace(/container-type:[^;]*;/g, '').replace(/(-?[\d.]+)cqw/g, (m, v) => (Number(v) * 0.24).toFixed(2) + 'em') : ''}
/* caixa de texto à parte e trecho em colunas */
div.tframe { margin: 1.2em 8%; text-align: center; font-size: 1.15em; font-style: italic; }
div.tframe p { text-indent: 0; text-align: center; }
div.tframe[data-border="keep"] { border: 1px dashed #8b7bb8; padding: 0.6em 0.9em; }
div.cols p:first-child { text-indent: 0; }
@media (min-width: 38em) { div.cols { column-count: 2; column-gap: 1.6em; column-rule: 1px solid #bbb; } div.cols[data-n="3"] { column-count: 3; } div.cols[data-rule="0"] { column-rule: none; } }
/* tabelas coladas: o visual vem de cada célula */
table.tb-orig td, table.tb-orig th { border: none; }
/* títulos em caixa */
h1.tb { display: block; width: fit-content; padding: 0.3em 0.8em; margin-left: auto; margin-right: auto; }
h1.tb-al-left { margin-left: 0; } h1.tb-al-right { margin-right: 0; }
h1.tb-black { background: #000; color: #fff; } h1.tb-white { border: 1px solid #000; } h1.tb-outline { border: 1px solid #000; }`;
  }

  async function buildEpub(project, opts) {
    const s = project.settings;
    curCharStyles = s.charStyles || [];
    let n = 0;
    const ctr = { fig: 0, graf: 0, tab: 0, quad: 0, refs: {} };
    const escX = App.escape;
    const im = project.immersion || {};
    const imFor = (c, i) => {
      if (!im.mode || im.mode === 'off' || (im.numberedOnly && !c.numbered)) return null;
      let id = im.mode === 'single' ? im.single : (im.assign || {})[c.id];
      const pool = (im.pool || []).filter(x => project.assets[x]);
      if (im.mode === 'random' && (!id || !project.assets[id])) id = pool.length ? pool[i % pool.length] : null;
      return id && project.assets[id] ? id : null;
    };
    const docs = project.chapters.map((c, i) => {
      let label = '';
      if (c.numbered && s.chapterNumbering !== 'none') { n++; label = `${s.chapterLabel || ''} ${n}`.trim(); }
      return { title: c.title, tocLabel: label ? `${label} — ${c.title}` : c.title, xhtml: xhtmlOf(Object.assign({}, c, { immersion: imFor(c, i) }), label, s, ctr) };
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
      ...Ficha.rightsFor(cat, m).split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br/>')}</p>`),
      ...Ficha.credits(cat, cat.autoNames).map(c => `<p><b>${esc(c.role)}:</b> ${esc(c.name)}</p>`),
      ...(cat.company !== false ? [`<p>${Ficha.COMPANY.map(esc).join('<br/>')}</p>`] : []),
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
      .concat(Ficha.credits(cat, cat.autoNames).filter(c => !(c.role === 'Tradução' && cat.translator)).map(c => ({ name: c.name, role: c.role || 'Colaboração' })));
    const extra = {
      subjects: String(cat.subjects || '').split(/[\n;]+/).map(x => x.trim()).filter(Boolean),
      contributors, series: cat.series || '', fileAs: cat.authorEntry ? cat.authorEntry.replace(/,?\s*\d{4}-?\s*$/, '').trim() : '',
      rights: Ficha.rightsFor(cat, m).split(/\n{2,}/).slice(0, 2).join(' ').replace(/\s+/g, ' ').trim()
    };
    // imagens extras antes da página de rosto (página inteira)
    const preImages = ((project.ebook && project.ebook.preImages) || []).map(id => project.assets[id] && project.assets[id].dataUrl).filter(Boolean);
    return { meta: m, extra, docs, css: epubCss(s), copyright: copyright + '<p class="cv-credit">Livro digital produzido com Casa Vertigem Hub — Casa Vertigem.</p>', cover, preImages, tocTitle: project.front.tocTitle };
  }

  App.exportPrep = { buildDoc, buildEpub, blocksOf };
})();
