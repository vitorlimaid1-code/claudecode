/* global App */
// VBO Refinamento → Metadados: título da obra, autor, editora, selo (os já cadastrados no sistema) e a ficha
// catalográfica colada. Ao enviar um livro (qualquer formato), o sistema acrescenta duas páginas no começo —
// 1ª a página de rosto (título, autor e editora/selo), 2ª a página da ficha catalográfica completa, com as
// informações padrão do sistema (créditos, editora, direitos, quadro CIP com a ficha colada, distribuição) —
// e substitui o arquivo original (que vai para a Lixeira). As duas páginas vêm do mesmo motor que diagrama os
// livros, então saem iguais às do livro impresso.
(function () {
  const { el, api, D } = App;
  const KEY = 'vbo.meta';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const lsSet = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } };
  const xmlEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fileName = p => String(p).split(/[\\/]/).pop();
  const extOf = p => ((/\.([a-z0-9]+)$/i.exec(p || '') || [])[1] || '').toLowerCase();
  const imgSize = src => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); i.onerror = () => res({ w: 1, h: 1 }); i.src = src; });

  // ---------------------------------------------------------------- projeto só com o rosto e a ficha
  async function frontProject(m, size) {
    const p = D.normalizeProject(await api.newProject());
    p.meta.title = m.title; p.meta.author = m.author; p.meta.publisher = m.publisher || p.meta.publisher || '';
    p.chapters = [];
    Object.assign(p.front, { halfTitle: false, titlePage: true, copyright: true, toc: false, dedication: false, epigraph: false, listFigures: false, listTables: false, listCharts: false, listQuadros: false });
    if (p.back) { if (p.back.invite) p.back.invite.enabled = false; if (p.back.bio) p.back.bio.enabled = false; if (p.back.extra) p.back.extra.enabled = false; }
    p.ebook = { coverAsset: null, coverInBook: false, preImages: [] };
    Object.assign(p.catalog, { enabled: true, mode: 'manual', manualText: String(m.ficha || '').trim() });
    if (m.logo && m.logo.dataUrl) {
      const dim = await imgSize(m.logo.dataUrl);
      p.assets.cvhselo = { id: 'cvhselo', name: m.logo.name || 'Selo', dataUrl: m.logo.dataUrl, width: dim.w, height: dim.h, info: {} };
      p.titlePage.logo = 'cvhselo';
      if (!p.titlePage.logoPlacement || p.titlePage.logoPlacement === 'foot') p.titlePage.logoPlacement = 'below-title';
    } else p.titlePage.logo = null;
    if (size) {
      // páginas no formato de corte do livro, sem sangria nem marcas (entram alinhadas ao corte do PDF)
      Object.assign(p.settings, { pageFormat: 'custom', pageWidth: +size.w.toFixed(2), pageHeight: +size.h.toFixed(2), cropMarks: false, bleedAuto: false, bleedTop: 0, bleedBottom: 0, bleedOuter: 0, bleedInner: 0 });
      p.settings.outputSheet = Object.assign({}, p.settings.outputSheet || {}, { mode: 'trim', marks: false });
    }
    return p;
  }
  async function frontDom(m) {
    const p = await frontProject(m);
    const book = await api.buildBook(p);
    const doc = new DOMParser().parseFromString(`<div id="cvh">${book.html}</div>`, 'text/html');
    const tp = doc.querySelector('section.title-page');
    const fc = doc.querySelector('section#ficha, section.copyright-page');
    if (!tp || !fc) throw new Error('não foi possível montar o rosto e a ficha');
    const logoW = Number((p.titlePage || {}).logoWidth) || 25;
    const dim = p.assets.cvhselo ? { w: p.assets.cvhselo.width, h: p.assets.cvhselo.height } : null;
    return { tp, fc, logoW, dim, logo: m.logo };
  }

  // ---------------------------------------------------------------- texto corrido (linhas)
  const BLOCK = /^(DIV|P|SECTION|H[1-6]|UL|OL|LI|BLOCKQUOTE|TABLE|TR)$/;
  function lines(root) {
    const out = [];
    let cur = '';
    const flush = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t) out.push(t); cur = ''; };
    const walk = n => {
      if (n.nodeType === 3) { cur += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'BR') { flush(); return; }
      if (n.tagName === 'IMG') return;
      const blk = BLOCK.test(n.tagName);
      if (blk) flush();
      n.childNodes.forEach(walk);
      if (blk) flush();
    };
    walk(root);
    flush();
    return out;
  }
  function frontText(f, md) {
    const tp = lines(f.tp), fc = lines(f.fc);
    const sep = md ? '\n\n---\n\n' : '\n\n\n';
    return (md ? tp.map((l, i) => (i === 1 ? '# ' + l : l)).join('\n\n') : tp.join('\n')) + sep + (md ? fc.join('\n\n') : fc.join('\n')) + sep;
  }

  // ---------------------------------------------------------------- Word (parágrafos w:p)
  function wordXml(f) {
    const images = [];
    const run = (text, st) => {
      if (!text) return '';
      const rp = [st.b ? '<w:b/>' : '', st.i ? '<w:i/>' : '', st.caps ? '<w:caps/>' : '', st.sp ? `<w:spacing w:val="${st.sp}"/>` : '', st.sz ? `<w:sz w:val="${st.sz}"/><w:szCs w:val="${st.sz}"/>` : ''].join('');
      return `<w:r>${rp ? `<w:rPr>${rp}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
    };
    const image = (img, st) => {
      const i = images.length;
      images.push({ dataUrl: img.getAttribute('src') });
      const wmm = f.logoW, hmm = f.dim ? wmm * f.dim.h / f.dim.w : wmm;
      const cx = Math.round(wmm * 36000), cy = Math.round(hmm * 36000);
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${9100 + i}" name="Selo ${i + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${9100 + i}" name="selo${i + 1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="__CVHIMG${i}__"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    };
    const BOX = '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="4" w:color="000000"/></w:pBdr>';
    const para = (inner, st, extra) => {
      if (!inner) return '';
      const pp = [extra && extra.pageBreak ? '<w:pageBreakBefore/>' : '', st.box ? BOX : '', `<w:spacing w:before="${st.before || 0}" w:after="${st.after == null ? 60 : st.after}"/>`, `<w:ind w:left="${st.ind || 0}" w:firstLine="0"/>`, `<w:jc w:val="${st.jc || 'left'}"/>`].join('');
      return `<w:p><w:pPr>${pp}</w:pPr>${inner}</w:p>`;
    };
    // estilo de cada bloco pelas classes do motor de diagramação
    const styleOf = (n, st) => {
      const c = n.classList || { contains: () => false };
      const s = Object.assign({}, st, { before: 0 });
      if (c.contains('tp-author')) Object.assign(s, { caps: true, sp: 40, sz: 26, before: 1200 });
      if (c.contains('tp-title')) Object.assign(s, { sz: 52, before: 2200, after: 120 });
      if (c.contains('tp-subtitle')) Object.assign(s, { i: true, sz: 28 });
      if (c.contains('tp-brand') || c.contains('tp-foot')) Object.assign(s, { before: 1600 });
      if (c.contains('tp-publisher')) Object.assign(s, { sp: 30, sz: 22 });
      if (c.contains('tp-place') || c.contains('tp-imprint')) Object.assign(s, { sz: 18 });
      if (c.contains('cat-company-name') || c.contains('cat-head') || c.contains('cat-dist-head')) s.b = true;
      if (c.contains('cat-box')) s.box = true;
      if (c.contains('cat-head')) Object.assign(s, { jc: 'center', after: 80 });
      if (c.contains('cat-indent')) s.ind = 340;
      if (c.contains('cat-class')) s.jc = 'right';
      if (c.contains('cat-rights')) s.jc = 'both';
      if (c.contains('cat-dist') || c.contains('cat-company') || c.contains('cat-rights') || c.contains('cat-box')) s.groupBefore = 200;
      return s;
    };
    function blocks(root, st0, firstExtra) {
      const out = [];
      let extra = firstExtra;
      let inl = '';
      let curSt = st0;
      const flush = () => { if (inl) { out.push(para(inl, curSt, extra)); extra = null; curSt = Object.assign({}, curSt, { before: 0 }); } inl = ''; };
      const inline = (n, st) => {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' '); if (t.trim() || inl) inl += run(t, st); return; }
        if (n.nodeType !== 1) return;
        if (n.tagName === 'BR') { inl += '<w:r><w:br/></w:r>'; return; }
        if (n.tagName === 'IMG') { inl += image(n, st); return; }
        const s2 = Object.assign({}, st);
        if (/^(B|STRONG)$/.test(n.tagName) || (n.classList && n.classList.contains('cat-role'))) s2.b = true;
        if (/^(I|EM)$/.test(n.tagName)) s2.i = true;
        n.childNodes.forEach(k => inline(k, s2));
      };
      root.childNodes.forEach(n => {
        if (n.nodeType === 1 && (BLOCK.test(n.tagName) || n.tagName === 'IMG' && /tp-logo/.test(n.className))) {
          flush();
          const s = n.tagName === 'IMG' ? st0 : styleOf(n, st0);
          if (s.groupBefore && !s.box) s.before = Math.max(s.before || 0, s.groupBefore);
          const hasBlock = n.tagName !== 'IMG' && Array.from(n.children).some(k => BLOCK.test(k.tagName) || k.tagName === 'IMG');
          if (n.tagName === 'IMG') { out.push(para(image(n, s0Img(st0)), s0Img(st0), extra)); extra = null; } else if (s.box) {
            // quadro da ficha (CIP): tabela de uma célula com borda — um quadro só, como no livro
            if (extra) { out.push(para(run(' ', {}), { after: 0 }, extra)); extra = null; }
            const inner = blocks(n, Object.assign({}, s, { box: false, groupBefore: 0, before: 0 }), null);
            const bd = side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
            out.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right'].map(bd).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="9000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/></w:tcPr>${inner.join('') || '<w:p/>'}</w:tc></w:tr></w:tbl>`, para(run(' ', {}), { after: 0, sz: 8 }));
          } else if (hasBlock) { out.push(...blocks(n, s, extra)); extra = null; } else { curSt = s; n.childNodes.forEach(k => inline(k, s)); flush(); curSt = st0; }
        } else { curSt = st0; inline(n, st0); }
      });
      flush();
      return out.filter(Boolean);
    }
    const s0Img = st => Object.assign({}, st, { before: 200, after: 120 });
    const tp = blocks(f.tp, { jc: 'center', after: 60 });
    const fc = blocks(f.fc, { jc: 'left', sz: 17, after: 40 }, { pageBreak: true });
    const end = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
    return { xml: tp.join('') + fc.join('') + end, images };
  }

  // ---------------------------------------------------------------- EPUB e HTML
  const FRONT_CSS = `.cvh-rosto{text-align:center;margin:12% 0 0;page-break-after:always;break-after:page}
.cvh-rosto .tp-author{letter-spacing:.12em;text-transform:uppercase;font-size:1.05em;margin:0 0 3em}
.cvh-rosto .tp-title{font-size:2em;line-height:1.2;margin:0 0 .6em}
.cvh-rosto .tp-subtitle{font-style:italic;font-size:1.15em}
.cvh-rosto .tp-brand,.cvh-rosto .tp-foot{margin-top:3em}
.cvh-rosto .tp-logo{max-width:40%;height:auto;display:block;margin:0 auto .6em}
.cvh-rosto .tp-publisher{letter-spacing:.08em}
.cvh-rosto .tp-place,.cvh-rosto .tp-imprint{font-size:.85em}
.cvh-ficha{font-size:.82em;line-height:1.35;page-break-after:always;break-after:page}
.cvh-ficha p{text-indent:0;margin:0 0 .5em;text-align:justify}
.cvh-ficha .cat-credits,.cvh-ficha .cat-company,.cvh-ficha .cat-rights,.cvh-ficha .cat-dist{margin:0 0 1.2em}
.cvh-ficha .cat-company-name,.cvh-ficha .cat-dist-head,.cvh-ficha .cat-role{font-weight:bold}
.cvh-ficha .cat-box{border:1px solid currentColor;padding:.6em .8em;margin:0 0 1.2em}
.cvh-ficha .cat-head{text-align:center;font-weight:bold;margin-bottom:.5em}
.cvh-ficha .cat-indent{padding-left:1.5em}
.cvh-ficha .cat-class{text-align:right}`;
  function sectionHtml(n, cls, xhtml, f) {
    const c = n.cloneNode(true);
    c.className = cls;
    c.removeAttribute('id');
    c.querySelectorAll('[style]').forEach(x => x.removeAttribute('style'));
    c.querySelectorAll('img').forEach((im, i) => { im.setAttribute('src', xhtml ? `__CVHIMG${i}__` : (f.logo && f.logo.dataUrl) || im.getAttribute('src')); im.setAttribute('alt', 'Selo da editora'); });
    let h = c.outerHTML.replace(/<section\b/, '<div').replace(/<\/section>$/, '</div>');
    if (xhtml) h = h.replace(/&nbsp;/g, '&#160;').replace(/<(img|br|hr)\b([^>]*?)\s*\/?>/g, '<$1$2/>');
    return h;
  }
  function epubPages(f, lang) {
    const page = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">\n<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title><link rel="stylesheet" type="text/css" href="cvh-front.css"/></head>\n<body>${body}</body></html>`;
    return [
      { file: 'rosto.xhtml', xhtml: page('Página de rosto', sectionHtml(f.tp, 'cvh-rosto', true, f).replace(/^<div /, '<div epub:type="titlepage" ')) },
      { file: 'ficha.xhtml', xhtml: page('Ficha catalográfica', sectionHtml(f.fc, 'cvh-ficha', true, f).replace(/^<div /, '<div epub:type="copyright-page" ')) }
    ];
  }

  // ---------------------------------------------------------------- aplicar num arquivo
  async function apply(file, m, log) {
    const ext = extOf(file);
    let made = null;
    log(`${fileName(file)} — montando a página de rosto e a ficha catalográfica (padrão do sistema)…`);
    if (ext === 'pdf') {
      const t = await api.metaPdfTrim(file);
      if (!t || t.error) throw new Error('não foi possível ler o PDF' + (t && t.error ? ': ' + t.error : ''));
      log(`${fileName(file)} — ${t.pages} página(s) · formato de corte ${t.w.toFixed(0)} × ${t.h.toFixed(0)} mm: as duas páginas saem nesse formato`);
      const p = await frontProject(m, t);
      const front = await api.metaTmp('pdf');
      const r = await api.exportRun({ kind: 'pdf', project: p, opts: { target: front } });
      if (!r || !r.files) throw new Error('falha ao diagramar o rosto e a ficha');
      const g = await api.metaMerge({ kind: 'pdf', orig: file, front });
      if (!g || g.error) throw new Error(g ? g.error : 'falha ao juntar as páginas');
      log(`${fileName(file)} — ${g.added} página(s) acrescentada(s) no começo · total: ${g.pages} páginas`);
      made = g.out;
    } else {
      const f = await frontDom(m);
      let orig = file, kind = null, req = null;
      if (ext === 'docx') { const w = wordXml(f); kind = 'docx'; req = { xml: w.xml, images: w.images }; } else if (ext === 'epub') {
        kind = 'epub'; req = { pages: epubPages(f, 'pt-BR'), css: FRONT_CSS, images: f.logo && f.logo.dataUrl && f.tp.querySelector('img') ? [{ dataUrl: f.logo.dataUrl }] : [] };
      } else if (/^(html?|xhtml)$/.test(ext)) { kind = 'html'; req = { front: { css: FRONT_CSS, html: sectionHtml(f.tp, 'cvh-rosto', ext === 'xhtml', f) + sectionHtml(f.fc, 'cvh-ficha', ext === 'xhtml', f) } }; } else if (/^(txt|text|md|markdown)$/.test(ext)) { kind = 'text'; req = { front: { text: frontText(f, ext !== 'txt' && ext !== 'text') } }; } else {
        // DOC, ODT, RTF, FB2, MOBI…: o livro é refeito no padrão do sistema em DOCX e recebe as duas páginas
        log(`${fileName(file)} — o formato ${ext.toUpperCase() || '?'} não pode ser alterado diretamente: o livro é refeito em DOCX no padrão do sistema, com as duas páginas`);
        const { proj } = await App.enhance.loadBook(file, fileName(file).replace(/\.[^.]+$/, ''), x => log(`${fileName(file)} — ${String(x).replace(/^·\s*/, '')}`), { images: true, allowAny: true, keep: true, polish: false });
        Object.assign(proj.front, { toc: false, titlePage: false, copyright: false, halfTitle: false });
        proj.meta.title = m.title || proj.meta.title; proj.meta.author = m.author || proj.meta.author;
        orig = await api.metaTmp('docx');
        await App.toolbox.writeBook(proj, 'docx', orig, { house: true });
        const w = wordXml(f); kind = 'docx'; req = { xml: w.xml, images: w.images };
      }
      const g = await api.metaMerge(Object.assign({ kind, orig }, req));
      if (!g || g.error) throw new Error(g ? g.error : 'falha ao acrescentar as páginas');
      made = g.out;
    }
    const rp = await api.metaReplace(file, made);
    if (!rp || rp.error) throw new Error(rp ? rp.error : 'não foi possível substituir o original');
    log(`${fileName(file)} — pronto: rosto e ficha catalográfica nas duas primeiras páginas → ${rp.file}${rp.trashed ? ' (o original foi para a Lixeira)' : ''}`, 'ok');
    return rp.file;
  }

  // ---------------------------------------------------------------- tela (aba Metadados do VBO)
  function card(addLog) {
    const saved = lsGet();
    const st = { file: null, logo: null, pubs: { publishers: [], logos: [] }, busy: false };
    const title = el('input', { type: 'text', placeholder: 'Título da obra', value: '' });
    const author = el('input', { type: 'text', placeholder: 'Nome do autor', value: '' });
    const pubSel = el('select', {});
    const pubOther = el('input', { type: 'text', placeholder: 'Nome da editora', value: saved.publisher || '' });
    const logos = el('div', { class: 'vm-logos' });
    const ficha = el('textarea', { rows: 9, placeholder: 'Cole aqui a ficha catalográfica pronta (o texto do quadro CIP). Ela entra no quadro da ficha, com as demais informações padrão do sistema: créditos, editora, direitos e distribuição.' });
    const fileBox = el('div', { class: 'vm-file muted small', text: 'Nenhum arquivo escolhido.' });
    const btn = el('button', { class: 'primary big', text: '▶ Acrescentar rosto e ficha e substituir o original' });
    const drawLogos = () => {
      logos.innerHTML = '';
      const tile = (lg, label) => el('button', { class: 'vm-logo' + ((st.logo ? st.logo.id : '') === (lg ? lg.id : '') ? ' on' : ''), title: label, onclick: () => { st.logo = lg; lsSet(Object.assign(lsGet(), { logo: lg ? lg.id : '' })); drawLogos(); } }, [lg ? el('img', { src: lg.dataUrl, alt: label }) : el('span', { text: 'Sem selo' }), el('small', { text: label })]);
      logos.appendChild(tile(null, 'Sem selo (nome da editora)'));
      st.pubs.logos.forEach(lg => logos.appendChild(tile(lg, lg.name || 'Selo')));
      logos.appendChild(el('button', { class: 'vm-logo vm-add', title: 'Cadastrar selos (PNG com fundo transparente, de preferência) — ficam salvos no sistema', onclick: addLogos }, [el('span', { text: '+' }), el('small', { text: 'Cadastrar selo' })]));
    };
    async function addLogos() {
      const l = await api.pickImages({ title: 'Selos da editora (PNG com fundo transparente, de preferência)', multiple: true });
      if (!l || !l.length) return;
      l.forEach(a => st.pubs.logos.push({ id: D.uid('logo'), name: (a.name || 'Selo').replace(/\.[a-z0-9]+$/i, ''), dataUrl: a.dataUrl, width: a.width, height: a.height }));
      await api.publishersSet(st.pubs);
      st.logo = st.pubs.logos[st.pubs.logos.length - 1];
      lsSet(Object.assign(lsGet(), { logo: st.logo.id }));
      App.toast(`${l.length} selo(s) cadastrado(s) no sistema.`);
      drawLogos();
    }
    const drawPubs = () => {
      pubSel.innerHTML = '';
      st.pubs.publishers.forEach(pb => pubSel.appendChild(el('option', { value: pb.name, text: pb.name, selected: pb.name === saved.publisher })));
      pubSel.appendChild(el('option', { value: '__other', text: 'Outra editora…', selected: !st.pubs.publishers.some(pb => pb.name === saved.publisher) }));
      pubOther.style.display = pubSel.value === '__other' ? '' : 'none';
    };
    pubSel.addEventListener('change', () => { pubOther.style.display = pubSel.value === '__other' ? '' : 'none'; lsSet(Object.assign(lsGet(), { publisher: pubSel.value === '__other' ? pubOther.value : pubSel.value })); });
    pubOther.addEventListener('input', () => lsSet(Object.assign(lsGet(), { publisher: pubOther.value })));
    (async () => {
      try { st.pubs = (await api.publishersGet()) || {}; } catch (e) { st.pubs = {}; }
      st.pubs.publishers = st.pubs.publishers || []; st.pubs.logos = st.pubs.logos || [];
      st.logo = st.pubs.logos.find(l => l.id === saved.logo) || null;
      drawPubs(); drawLogos();
    })();
    const setFile = p => {
      if (!p) return;
      st.file = p;
      fileBox.textContent = '📄 ' + p;
      fileBox.classList.remove('muted');
      if (!title.value.trim()) title.value = fileName(p).replace(/\.[^.]+$/, '').replace(/\s*\((refinado|pt-BR)\)\s*$/i, '').replace(/[_]+/g, ' ');
    };
    const drop = el('button', { class: 'enh-drop vm-drop', onclick: async () => { const l = await api.toolsPick('text'); if (l && l.length) setFile(l[0]); } }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }),
      el('b', { text: 'Enviar o livro' }),
      el('span', { class: 'muted', text: 'Qualquer formato (PDF, DOCX, EPUB, HTML, TXT, Markdown, DOC, ODT, RTF, FB2…) — clique ou arraste' })
    ]);
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); const f = (e.dataTransfer.files || [])[0]; if (f) setFile(api.pathForFile(f)); });
    btn.addEventListener('click', async () => {
      if (st.busy) return;
      const m = { title: title.value.trim(), author: author.value.trim(), publisher: pubSel.value === '__other' ? pubOther.value.trim() : pubSel.value, ficha: ficha.value, logo: st.logo };
      if (!st.file) return App.toast('Envie o arquivo do livro.');
      if (!m.title || !m.author) return App.toast('Preencha o título da obra e o nome do autor.');
      if (!m.ficha.trim()) return App.toast('Cole a ficha catalográfica.');
      const ok = await api.confirm('Substituir o arquivo original?', `${fileName(st.file)} vai ganhar a página de rosto e a página da ficha catalográfica no começo. O arquivo novo fica no lugar do original, que vai para a Lixeira.`, ['Acrescentar e substituir', 'Cancelar']);
      if (ok !== 0) return;
      st.busy = true; btn.disabled = true; btn.textContent = 'Trabalhando…';
      const t0 = Date.now();
      try {
        const out = await apply(st.file, m, addLog);
        addLog(`Metadados aplicados em ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s.`, 'ok');
        st.file = out; fileBox.textContent = '✓ ' + out;
        api.showItem(out);
      } catch (e) { addLog(`${fileName(st.file)} — erro: ${String((e && e.message) || e)} (o original foi mantido)`, 'bad'); }
      st.busy = false; btn.disabled = false; btn.textContent = '▶ Acrescentar rosto e ficha e substituir o original';
    });
    const row = (label, ctl, help) => el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: label }), ctl, help ? el('span', { class: 'small muted', text: help }) : null]);
    return el('div', { class: 'vm-card' }, [
      el('p', { class: 'muted small', text: 'Preencha os dados, envie o livro e o sistema acrescenta duas páginas no começo: 1ª a página de rosto (título, autor e editora — com selo, o selo identifica a editora), 2ª a página da ficha catalográfica completa, no padrão do sistema. O arquivo atualizado substitui o original (que vai para a Lixeira).' }),
      el('div', { class: 'tr-cfg' }, [
        row('Título da obra', title),
        row('Nome do autor', author),
        row('Editora', el('div', { class: 'inline wrap' }, [pubSel, pubOther]), 'As editoras cadastradas no sistema; o nome entra nos direitos da ficha.'),
        row('Selo da editora', logos, 'Os selos cadastrados no sistema; o escolhido vai para a página de rosto.'),
        row('Ficha catalográfica (colar)', ficha)
      ]),
      drop, fileBox,
      el('div', { class: 'enh-run' }, [btn])
    ]);
  }

  App.vboMeta = { card, apply, frontProject, wordXml, frontDom, epubPages };
})();
