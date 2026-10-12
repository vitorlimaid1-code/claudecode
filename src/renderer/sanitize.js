// Padronização de texto: limpa HTML colado/importado e converte manuscritos
// (Word, EPUB, ODT, DOC, PDF, TXT, Markdown) em capítulos no padrão do livro.
(function () {
  const BLOCKS = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION']);
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUP', 'SUB', 'BR', 'SPAN', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'NAV', 'COL', 'COLGROUP']);
  const RENAME = { STRONG: 'b', EM: 'i', H1: 'h2', H5: 'h4', H6: 'h4', DEL: 's', STRIKE: 's', INS: 'u', CITE: 'i', DFN: 'i', VAR: 'i', ASIDE: 'div', DT: 'p', DD: 'p' };
  const P_CLASSES = new Set(['no-indent', 'phrase', 'reference', 'epigraph-inline']);
  const DIV_CLASSES = ['page-break', 'poem', 'box', 'fullbleed'];
  const FIG_ATTRS = ['data-asset', 'data-align', 'data-wrap', 'data-width', 'data-gap', 'data-rot', 'data-flipx', 'data-flipy', 'data-opacity', 'data-crop', 'data-ratio', 'data-fit'];

  function children(node, doc, parent) {
    node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) parent.appendChild(c); });
    return parent;
  }

  function cleanNode(node, doc) {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.nodeValue.replace(/[­​⁠﻿]/g, ''));
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toUpperCase();
    if (DROP.has(tag)) return null;
    const cls = node.classList || { contains: () => false, forEach: () => {} };

    // notas de rodapé (já no padrão do aplicativo)
    if (tag === 'SPAN' && cls.contains('footnote')) {
      const s = doc.createElement('span');
      s.className = 'footnote';
      return children(node, doc, s);
    }
    // ligações: internas (#id), sites e e-mails; o resto vira texto
    if (tag === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      const frag = children(node, doc, doc.createDocumentFragment());
      if (!/^(#[\w:.-]+|https?:\/\/\S+|mailto:\S+)$/i.test(href)) return frag;
      if (/^#/.test(href) && !cls.contains('xref')) return frag; // âncoras de arquivos importados (índices, notas) não são mantidas
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      a.className = /^#/.test(href) ? (cls.contains('xref-page') ? 'xref xref-page' : 'xref') : 'ext';
      a.appendChild(frag);
      return a;
    }
    // blocos especiais
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ASIDE') {
      const special = DIV_CLASSES.find(c => cls.contains(c));
      if (special === 'page-break') { const d = doc.createElement('div'); d.className = 'page-break'; return d; }
      if (special === 'fullbleed') {
        const d = doc.createElement('div');
        d.className = 'fullbleed';
        ['data-asset', 'data-fit'].forEach(a => { if (node.getAttribute(a)) d.setAttribute(a, node.getAttribute(a)); });
        return d;
      }
      if (special === 'poem' || special === 'box') {
        const d = doc.createElement('div');
        d.className = special;
        const inner = doc.createElement('div');
        children(node, doc, inner);
        d.innerHTML = normalizeBlocks(inner, doc, true);
        return d;
      }
    }
    if (tag === 'HR') { const hr = doc.createElement('hr'); hr.className = 'scene-break'; return hr; }
    if (tag === 'IMG') {
      const src = node.getAttribute('src') || '';
      const asset = node.getAttribute('data-asset');
      if (!asset && !/^data:image\//i.test(src)) return null;
      const img = doc.createElement('img');
      if (asset) img.setAttribute('data-asset', asset);
      else img.setAttribute('src', src);
      return img;
    }
    if (tag === 'FIGURE' && cls.contains('img') && node.getAttribute('data-asset')) {
      const f = doc.createElement('figure');
      f.className = 'img';
      FIG_ATTRS.forEach(a => { if (node.getAttribute(a) != null) f.setAttribute(a, node.getAttribute(a)); });
      const img = doc.createElement('img');
      img.setAttribute('data-asset', node.getAttribute('data-asset'));
      f.appendChild(img);
      const cap = node.querySelector('figcaption');
      if (cap) { const c = doc.createElement('figcaption'); children(cap, doc, c); f.appendChild(c); }
      return f;
    }

    // Inline que envolve blocos (ex.: <b> do Google Docs) é desembrulhado
    if (INLINE.has(tag) || (RENAME[tag] && !['H1', 'H5', 'H6', 'ASIDE', 'DT', 'DD'].includes(tag))) {
      const hasBlock = node.querySelector && node.querySelector('p,div,h1,h2,h3,h4,h5,h6,blockquote,ul,ol,li,table,section');
      if (hasBlock) { const m = doc.createElement('x-block'); return children(node, doc, m); }
    }
    if ((tag === 'B' || tag === 'STRONG') && node.style && /^(normal|[1-5]00)$/.test(node.style.fontWeight)) {
      return children(node, doc, doc.createDocumentFragment());
    }

    const known = BLOCKS.has(tag) || INLINE.has(tag) || RENAME[tag];
    if (!known) {
      const frag = children(node, doc, doc.createDocumentFragment());
      if (/^(DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|BODY|DL|CENTER|ADDRESS)$/.test(tag)) {
        const m = doc.createElement('x-block');
        m.appendChild(frag);
        if (tag === 'CENTER' || (node.style && node.style.textAlign === 'center')) m.setAttribute('data-align', 'center');
        return m;
      }
      return frag;
    }

    const outTag = (RENAME[tag] || tag).toLowerCase();
    if (outTag === 'span') {
      const st = node.style || {};
      const fs = String(st.fontStyle || '');
      const fw = String(st.fontWeight || '');
      const fv = String(st.fontVariant || st.fontVariantCaps || '');
      const va = String(st.verticalAlign || '');
      let out = children(node, doc, doc.createDocumentFragment());
      const wrap = t => { const w = doc.createElement(t); w.appendChild(out); out = w; };
      if (fs === 'italic' || cls.contains('italic')) wrap('i');
      if (fw === 'bold' || Number(fw) >= 600 || cls.contains('bold')) wrap('b');
      if (/underline/.test(st.textDecoration || '')) wrap('u');
      if (va === 'super') wrap('sup');
      if (va === 'sub') wrap('sub');
      if (/small-caps/.test(fv) || cls.contains('smallcaps')) { const sc = doc.createElement('span'); sc.className = 'smallcaps'; sc.appendChild(out); out = sc; }
      return out;
    }
    const e = doc.createElement(outTag);
    if (outTag === 'p') cls.forEach(c => { if (P_CLASSES.has(c)) e.classList.add(c); });
    if (outTag === 'p' && (cls.contains('caption') || cls.contains('legenda'))) e.classList.add('caption-import');
    if ((tag === 'TD' || tag === 'TH') && node.getAttribute('colspan')) e.setAttribute('colspan', node.getAttribute('colspan'));
    if ((tag === 'TD' || tag === 'TH') && node.getAttribute('rowspan')) e.setAttribute('rowspan', node.getAttribute('rowspan'));
    const align = (node.style && node.style.textAlign) || node.getAttribute('align');
    // parágrafos alinhados à esquerda no original seguem o padrão do livro (justificado)
    if (align && /^(center|right|left)$/i.test(align) && ['p', 'h2', 'h3', 'h4'].includes(outTag) && !(outTag === 'p' && /^left$/i.test(align))) e.style.textAlign = align.toLowerCase();
    if (outTag === 'h2' && tag === 'H1') e.setAttribute('data-h1', '1');
    if (/^h[234]$/.test(outTag) && /^ref-[\w-]+$/.test(node.id || '')) e.id = node.id;
    return children(node, doc, e);
  }

  // Coloca texto solto em <p>, desfaz blocos aninhados e transforma imagens soltas em figuras
  function normalizeBlocks(container, doc, inner) {
    const out = doc.createElement('div');
    let para = null;
    const flush = () => {
      if (para && (para.textContent.trim() || para.querySelector('img'))) out.appendChild(para);
      para = null;
    };
    const visit = (parent, align) => {
      Array.from(parent.childNodes).forEach(n => {
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'X-BLOCK') {
          flush();
          visit(n, n.getAttribute('data-align') || align);
          flush();
          return;
        }
        const isBlock = n.nodeType === Node.ELEMENT_NODE && (BLOCKS.has(n.tagName) || n.tagName === 'DIV');
        if (isBlock) {
          flush();
          n.querySelectorAll && n.querySelectorAll('x-block').forEach(x => {
            if (/^(UL|OL|BLOCKQUOTE|TD|TH|LI)$/.test(n.tagName) || x.closest('td,th,li,blockquote')) {
              const p = doc.createElement('p');
              while (x.firstChild) p.appendChild(x.firstChild);
              x.replaceWith(p);
            } else x.replaceWith(...Array.from(x.childNodes));
          });
          if (n.tagName === 'LI') { const ul = doc.createElement('ul'); ul.appendChild(n); out.appendChild(ul); return; }
          if (/^(TR|TD|TH|THEAD|TBODY|CAPTION)$/.test(n.tagName)) { visit(n, align); flush(); return; }
          if (['P', 'H2', 'H3', 'H4'].includes(n.tagName) && !n.textContent.trim() && !n.querySelector('img')) return;
          if (n.tagName === 'P' && n.querySelector('p')) { visit(n, align); return; }
          if (n.tagName === 'P' && align && !n.style.textAlign) n.style.textAlign = align;
          out.appendChild(n);
          return;
        }
        if (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim() && !para) return;
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR' && !para) return;
        if (!para) { para = doc.createElement('p'); if (align) para.style.textAlign = align; }
        para.appendChild(n);
      });
    };
    visit(container);
    flush();
    if (!inner) {
      out.querySelectorAll('p').forEach(p => {
        if (p.children.length === 1 && p.firstElementChild.tagName === 'IMG' && !p.textContent.trim()) {
          const fig = doc.createElement('figure');
          fig.appendChild(p.firstElementChild);
          p.replaceWith(fig);
        }
      });
      // legenda importada logo após a imagem
      out.querySelectorAll('p.caption-import').forEach(p => {
        const prev = p.previousElementSibling;
        if (prev && prev.tagName === 'FIGURE' && !prev.querySelector('figcaption')) {
          const c = doc.createElement('figcaption');
          while (p.firstChild) c.appendChild(p.firstChild);
          prev.appendChild(c);
          p.remove();
        } else p.classList.remove('caption-import');
      });
    }
    return out.innerHTML;
  }

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    const holder = doc.createElement('div');
    children(doc.body, doc, holder);
    return normalizeBlocks(holder, doc);
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------------------------------------------------------------- notas
  // Converte referências a notas (Word, EPUB, HTML) em <span class="footnote">texto</span>
  function convertNotes(roots, lookup) {
    let count = 0;
    const toRemove = new Set();
    roots.forEach(root => {
      root.querySelectorAll('a[href*="#"]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const id = decodeURIComponent(href.split('#').pop());
        const target = lookup(id);
        if (!target || target.contains(a)) return;
        const sig = `${a.className} ${a.getAttribute('epub:type') || ''} ${a.getAttribute('role') || ''} ${a.id} ${id} ${target.className} ${target.getAttribute('epub:type') || ''}`;
        const looksNote = /note|foot|fn|endnote|nota/i.test(sig) || /^\[?\*?\d{1,4}\]?$/.test(a.textContent.trim());
        if (!looksNote) return;
        const clone = target.cloneNode(true);
        clone.querySelectorAll('a').forEach(x => {
          const t = x.textContent.trim();
          if (/ref|back/i.test(`${x.className} ${x.getAttribute('href') || ''} ${x.getAttribute('epub:type') || ''}`) || /^[↑↩⤴^]+$/.test(t) || /^\[?\d{1,4}\]?$/.test(t)) x.remove();
          else x.replaceWith(...Array.from(x.childNodes));
        });
        // tira parágrafos internos, mantendo itálico/negrito
        let content = Array.from(clone.querySelectorAll('p')).map(p => p.innerHTML.trim()).filter(Boolean).join(' ');
        if (!content) content = clone.innerHTML;
        content = content.replace(/^\s*(\d{1,4}[.)]?|\[\d+\])\s+/, '').replace(/^\s*[.):\]–—-]\s*/, '').trim();
        if (!content.replace(/<[^>]+>/g, '').trim()) return;
        const span = a.ownerDocument.createElement('span');
        span.className = 'footnote';
        span.innerHTML = content;
        const holder = a.parentElement && a.parentElement.tagName === 'SUP' && a.parentElement.textContent.trim() === a.textContent.trim() ? a.parentElement : a;
        holder.replaceWith(span);
        toRemove.add(target);
        count++;
      });
    });
    toRemove.forEach(t => {
      const li = t.closest('li') || t;
      const list = li.parentElement;
      li.remove();
      if (list && /^(OL|UL)$/.test(list.tagName) && !list.children.length) {
        const sec = list.closest('section.footnotes, div.footnotes, aside, section[epub\\:type="endnotes"], section[epub\\:type="footnotes"]');
        (sec || list).remove();
      }
    });
    roots.forEach(root => {
      root.querySelectorAll('section.footnotes, div.footnotes, aside[epub\\:type="footnote"], aside[epub\\:type="endnote"]').forEach(s => { if (!s.textContent.trim()) s.remove(); });
      // linha antes de notas finais
      root.querySelectorAll('hr').forEach(hr => { if (!hr.nextElementSibling) hr.remove(); });
    });
    return count;
  }

  // ---------------------------------------------------------------- capítulos
  // "Capítulo 3 — A fuga" -> "A fuga" (número automático); "Capítulo 3" sozinho -> não numerado
  function splitChapterTitle(title) {
    const m = /^(cap[ií]tulo|chapter)\s+([0-9]+|[ivxlcdm]+|[a-zà-ú]+)\s*([-–—:.]\s*)?(.*)$/i.exec(title || '');
    if (!m) return { title, numbered: true };
    if (m[4].trim()) return { title: m[4].trim(), numbered: true };
    return { title, numbered: false };
  }

  function htmlToChapters(html, fallbackTitle, opts) {
    opts = opts || {};
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    const notes = convertNotes([doc.body], id => doc.getElementById(id));
    // mammoth coloca âncoras vazias antes dos títulos
    doc.body.querySelectorAll('a[id]:empty').forEach(a => a.remove());
    let headTag = doc.body.querySelector('h1') ? 'H1' : null;
    if (!headTag && doc.body.querySelectorAll('h2').length >= 2) headTag = 'H2';
    const chapters = [];
    let current = null;
    const start = title => { current = { title: title || fallbackTitle || 'Sem título', parts: [] }; chapters.push(current); };
    // achata seções que só agrupam conteúdo
    const flat = [];
    const pushFlat = node => {
      if (node.nodeType === 1 && /^(SECTION|ARTICLE|MAIN|DIV)$/.test(node.tagName) && !DIV_CLASSES.some(c => node.classList.contains(c)) && node.querySelector('h1,h2')) node.childNodes.forEach(pushFlat);
      else flat.push(node);
    };
    doc.body.childNodes.forEach(pushFlat);
    flat.forEach(n => {
      if (headTag && n.nodeType === 1 && n.tagName === headTag) { start(n.textContent.trim().replace(/\s+/g, ' ')); return; }
      if (!current) {
        if (n.nodeType === 3 && !n.nodeValue.trim()) return;
        start(fallbackTitle);
      }
      current.parts.push(n.nodeType === 1 ? n.outerHTML : escapeHtml(n.nodeValue || ''));
    });
    const out = chapters
      .map(c => Object.assign(splitChapterTitle(c.title), { html: sanitizeHtml(c.parts.join('')) }))
      .filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img|<table/.test(c.html));
    out.notes = notes;
    return out;
  }

  const CHAPTER_LINE = /^(cap[ií]tulo|chapter|parte)\s+([0-9ivxlcdm]+|[a-zà-ú]+)\b.*$/i;

  function textParagraphs(text) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    const hasBlank = /\n[ \t]*\n/.test(text);
    return hasBlank ? text.split(/\n[ \t]*\n+/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()) : text.split('\n').map(p => p.trim());
  }
  function paraHtml(p) {
    if (/^(\*\s*){3,}$|^(#\s*){3}$|^[-–—~]{3,}$|^[*•·]\s*[*•·]\s*[*•·]$/.test(p)) return '<hr class="scene-break">';
    if (CHAPTER_LINE.test(p) && p.length < 90) return '<h1>' + escapeHtml(p) + '</h1>';
    return '<p>' + escapeHtml(p) + '</p>';
  }

  function textToChapters(text, fallbackTitle) {
    return htmlToChapters(textParagraphs(text).filter(Boolean).map(paraHtml).join(''), fallbackTitle);
  }

  // .doc: o texto chega com um marcador onde cada nota estava
  function docToChapters(res) {
    const mark = res.noteMark || '';
    const notes = (res.footnotes || []).concat(res.endnotes || []);
    let ni = 0;
    const lines = String(res.text || '').replace(/\r\n?/g, '\n').split('\n').map(s => s.trim());
    const html = lines.filter(Boolean).map(p => {
      let h = paraHtml(p.split(mark).join('\u0001'));
      h = h.replace(/\u0001/g, () => { const n = notes[ni++]; return n ? `<span class="footnote">${escapeHtml(n)}</span>` : ''; });
      return h;
    }).join('');
    const out = htmlToChapters(html, res.name);
    out.notes = ni;
    return out;
  }

  function inlineMd(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>')
      .replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, '$1<i>$2</i>');
  }

  function markdownToChapters(text, fallbackTitle) {
    const src = String(text || '').replace(/\r\n?/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
    const defs = {};
    const body = src.replace(/^\[\^([^\]]+)\]:\s*(.*(?:\n(?: {2,}|\t).*)*)/gm, (m, k, t) => { defs[k] = t.replace(/\n\s+/g, ' '); return ''; });
    const lines = body.split('\n');
    const html = [];
    let para = [];
    let list = null;
    const fn = s => s.replace(/\[\^([^\]]+)\]/g, (m, k) => (defs[k] ? `<span class="footnote">${inlineMd(defs[k])}</span>` : ''));
    const flushPara = () => { if (para.length) html.push('<p>' + fn(inlineMd(para.join(' '))) + '</p>'); para = []; };
    const flushList = () => { if (list) html.push(`<${list.tag}>` + list.items.map(i => '<li>' + fn(inlineMd(i)) + '</li>').join('') + `</${list.tag}>`); list = null; };
    lines.forEach(raw => {
      const line = raw.trim();
      let m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { flushPara(); flushList(); const l = m[1].length; html.push(`<h${l}>${fn(inlineMd(m[2]))}</h${l}>`); return; }
      if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line)) { flushPara(); flushList(); html.push('<hr class="scene-break">'); return; }
      if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); html.push('<blockquote><p>' + fn(inlineMd(m[1])) + '</p></blockquote>'); return; }
      if ((m = /^!\[[^\]]*\]\((data:image[^)]+)\)$/.exec(line))) { flushPara(); flushList(); html.push(`<figure><img src="${m[1]}"></figure>`); return; }
      if ((m = /^[-*+]\s+(.*)$/.exec(line)) || (m = /^\d+[.)]\s+(.*)$/.exec(line))) {
        flushPara();
        const tag = /^\d/.test(line) ? 'ol' : 'ul';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push(m[1]);
        return;
      }
      flushList();
      para.push(line);
    });
    flushPara(); flushList();
    return htmlToChapters(html.join(''), fallbackTitle);
  }

  // EPUB: cada documento do "spine" vira capítulo; notas podem estar em outro arquivo
  function epubToChapters(res) {
    const parsed = res.docs.map(d => ({ href: d.href, doc: new DOMParser().parseFromString('<body>' + d.html + '</body>', 'text/html') }));
    const lookup = id => { for (const p of parsed) { const e = p.doc.getElementById(id); if (e) return e; } return null; };
    const notes = convertNotes(parsed.map(p => p.doc.body), lookup);
    const chapters = [];
    parsed.forEach(p => {
      const body = p.doc.body;
      const type = (body.querySelector('[epub\\:type]') || { getAttribute: () => '' }).getAttribute('epub:type') || '';
      const text = body.textContent.replace(/\s+/g, ' ').trim();
      if (!text && !body.querySelector('img')) return;
      if (/cover|titlepage|toc|copyright/.test(type) && text.length < 600) return;
      if (/titlepage|cover/.test(body.innerHTML.slice(0, 400)) && text.length < 300) return;
      const h = body.querySelector('h1, h2');
      let title = h ? h.textContent.trim().replace(/\s+/g, ' ') : '';
      if (h) h.remove();
      const html = sanitizeHtml(body.innerHTML);
      if (!html.replace(/<[^>]+>/g, '').trim() && !/<img/.test(html)) return;
      if (!title) title = chapters.length ? `Seção ${chapters.length + 1}` : (res.meta && res.meta.title) || 'Início';
      chapters.push(Object.assign(splitChapterTitle(title), { html }));
    });
    chapters.notes = notes;
    chapters.meta = res.meta;
    return chapters;
  }

  // ODT (LibreOffice/Google Docs): converte o XML para HTML
  function odtToChapters(res) {
    const x = new DOMParser().parseFromString(res.content, 'application/xml');
    const NS = { text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0', style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0', fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0', draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0', xlink: 'http://www.w3.org/1999/xlink', table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0', office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0' };
    const styles = {};
    const readStyles = xml => {
      Array.from(xml.getElementsByTagNameNS(NS.style, 'style')).forEach(s => {
        const name = s.getAttributeNS(NS.style, 'name');
        const tp = s.getElementsByTagNameNS(NS.style, 'text-properties')[0];
        const pp = s.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
        styles[name] = {
          parent: s.getAttributeNS(NS.style, 'parent-style-name') || '',
          i: tp && tp.getAttributeNS(NS.fo, 'font-style') === 'italic',
          b: tp && tp.getAttributeNS(NS.fo, 'font-weight') === 'bold',
          u: tp && (tp.getAttributeNS(NS.style, 'text-underline-style') || 'none') !== 'none',
          sc: tp && tp.getAttributeNS(NS.fo, 'font-variant') === 'small-caps',
          sup: tp && /^super/.test(tp.getAttributeNS(NS.style, 'text-position') || ''),
          align: pp && pp.getAttributeNS(NS.fo, 'text-align'),
          breakBefore: pp && pp.getAttributeNS(NS.fo, 'break-before') === 'page'
        };
      });
    };
    readStyles(x);
    if (res.styles) readStyles(new DOMParser().parseFromString(res.styles, 'application/xml'));
    const resolve = name => { const out = { name }; let s = styles[name]; let guard = 0; while (s && guard++ < 8) { ['i', 'b', 'u', 'sc', 'sup', 'align'].forEach(k => { if (out[k] === undefined && s[k]) out[k] = s[k]; }); out.base = s.parent || out.base; s = styles[s.parent]; } return out; };
    const conv = node => {
      let out = '';
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) { out += escapeHtml(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        const ln = n.localName;
        if (ln === 's') out += ' '.repeat(Number(n.getAttributeNS(NS.text, 'c')) || 1);
        else if (ln === 'tab') out += ' ';
        else if (ln === 'line-break') out += '<br>';
        else if (ln === 'note') {
          const body = n.getElementsByTagNameNS(NS.text, 'note-body')[0];
          const inner = body ? Array.from(body.childNodes).map(c => conv(c)).join(' ') : '';
          out += `<span class="footnote">${inner}</span>`;
        } else if (ln === 'span' || ln === 'a') {
          const st = resolve(n.getAttributeNS(NS.text, 'style-name'));
          let h = conv(n);
          if (st.sup) h = `<sup>${h}</sup>`;
          if (st.u) h = `<u>${h}</u>`;
          if (st.b) h = `<b>${h}</b>`;
          if (st.i) h = `<i>${h}</i>`;
          if (st.sc) h = `<span class="smallcaps">${h}</span>`;
          out += h;
        } else if (ln === 'frame') {
          const img = n.getElementsByTagNameNS(NS.draw, 'image')[0];
          const href = img && img.getAttributeNS(NS.xlink, 'href');
          if (href && res.images[href]) out += `<img src="${res.images[href]}">`;
        } else if (ln === 'bookmark' || ln === 'bookmark-start' || ln === 'bookmark-end' || ln === 'soft-page-break') {
          // ignora
        } else out += conv(n);
      });
      return out;
    };
    const blocks = [];
    const walk = parent => {
      Array.from(parent.childNodes).forEach(n => {
        if (n.nodeType !== 1) return;
        const ln = n.localName;
        if (ln === 'h') {
          const lvl = Math.min(4, Number(n.getAttributeNS(NS.text, 'outline-level')) || 1);
          blocks.push(`<h${lvl}>${conv(n)}</h${lvl}>`);
        } else if (ln === 'p') {
          const st = resolve(n.getAttributeNS(NS.text, 'style-name'));
          const base = `${st.name} ${st.base || ''}`;
          const content = conv(n);
          if (/^Title|Título/i.test(base) && content.trim()) blocks.push(`<h1>${content}</h1>`);
          else if (/Heading|Título/i.test(base)) { const lvl = Math.min(4, Number((/(\d)/.exec(base) || [])[1]) || 1); blocks.push(`<h${lvl}>${content}</h${lvl}>`); }
          else if (/Quot|Cita/i.test(base)) blocks.push(`<blockquote><p>${content}</p></blockquote>`);
          else blocks.push(`<p${st.align === 'center' ? ' style="text-align:center"' : st.align === 'end' || st.align === 'right' ? ' style="text-align:right"' : ''}>${content}</p>`);
        } else if (ln === 'list') {
          blocks.push('<ul>' + Array.from(n.getElementsByTagNameNS(NS.text, 'list-item')).map(li => '<li>' + Array.from(li.childNodes).map(c => conv(c)).join(' ') + '</li>').join('') + '</ul>');
        } else if (ln === 'table') {
          blocks.push('<table>' + Array.from(n.getElementsByTagNameNS(NS.table, 'table-row')).map(r => '<tr>' + Array.from(r.getElementsByTagNameNS(NS.table, 'table-cell')).map(c => '<td>' + Array.from(c.childNodes).map(cc => conv(cc)).join(' ') + '</td>').join('') + '</tr>').join('') + '</table>');
        } else if (ln === 'section' || ln === 'text') walk(n);
      });
    };
    const textRoot = x.getElementsByTagNameNS(NS.office, 'text')[0];
    if (textRoot) walk(textRoot);
    return htmlToChapters(blocks.join(''), res.name);
  }

  // PDF: reconstrói parágrafos, títulos e notas a partir da posição e tamanho do texto
  function pdfToChapters(res) {
    const pages = res.pages || [];
    const sizes = {};
    pages.forEach(p => p.lines.forEach(l => { const k = Math.round(l.size); sizes[k] = (sizes[k] || 0) + l.parts.reduce((s, x) => s + x.text.length, 0); }));
    const body = Number(Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || 11);
    const lineText = l => l.parts.map(x => x.text).join('').replace(/\s+/g, ' ').trim();
    // cabeçalhos/rodapés repetidos e números de página
    const freq = {};
    pages.forEach(p => {
      const cand = p.lines.slice(0, 2).concat(p.lines.slice(-2));
      new Set(cand.map(l => lineText(l).replace(/\d+/g, '#'))).forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    });
    const isRunning = l => { const t = lineText(l); return /^\d{1,4}$/.test(t) || /^[ivxlcdm]{1,6}$/i.test(t) || (freq[t.replace(/\d+/g, '#')] >= Math.max(3, pages.length * 0.3)); };
    const out = [];
    let cur = null;
    let pendingNotes = {};
    const flush = () => { if (cur) { out.push(cur); cur = null; } };
    pages.forEach(p => {
      let lines = p.lines.filter(l => !isRunning(l));
      // número de nota isolado (sobrescrito no pé da página) + linha seguinte = início de nota
      const merged = [];
      lines.forEach((l, i) => {
        // número pequeno no início da própria linha (ex.: "¹ Texto da nota")
        const p0 = l.parts[0];
        if (p0 && /^\d{1,3}$/.test(p0.text.trim()) && p0.size && p0.size < body * 0.8 && l.parts.length > 1) {
          l.marker = p0.text.trim();
          l.parts = l.parts.slice(1);
        }
        const t = lineText(l);
        const next = lines[i + 1];
        if (/^\d{1,3}$/.test(t) && l.size < body * 0.8 && next && Math.abs(next.y - l.y) < body * 1.2) { next.marker = t; return; }
        merged.push(l);
      });
      lines = merged;
      if (!lines.length) return;
      const xs = lines.filter(l => Math.abs(l.size - body) < 1).map(l => l.x);
      const left = xs.length ? Math.min(...xs) : 50;
      const right = Math.max(...lines.map(l => l.maxX));
      // notas: no pé da página, começando com número (pequeno ou em corpo menor)
      const isNoteStart = l => !!l.marker || (l.size < body * 0.92 && /^\d{1,3}\s*\S/.test(lineText(l)));
      let noteStart = -1;
      for (let i = Math.floor(lines.length * 0.3); i < lines.length; i++) {
        if (isNoteStart(lines[i]) && lines.slice(i).every(x => x.y < p.height * 0.45)) { noteStart = i; break; }
      }
      const bodyLines = noteStart > 0 ? lines.slice(0, noteStart) : lines;
      const noteLines = noteStart > 0 ? lines.slice(noteStart) : [];
      pendingNotes = {};
      let nk = null;
      noteLines.forEach(l => {
        const t = lineText(l);
        if (l.marker) { nk = l.marker; pendingNotes[nk] = t; return; }
        const m = /^(\d{1,3})\s*(.*)$/.exec(t);
        if (m && l.size < body * 0.92) { nk = m[1]; pendingNotes[nk] = m[2]; } else if (nk) pendingNotes[nk] += ' ' + t;
      });
      let prev = null;
      bodyLines.forEach(l => {
        const t = l.parts.map(x => (x.sup && pendingNotes[x.text.trim()] ? `\u0001${encodeURIComponent(pendingNotes[x.text.trim()])}\u0002` : x.text)).join('').replace(/\s+/g, ' ').trim();
        if (!t) return;
        const big = l.size >= body * 1.25;
        if (big) {
          flush();
          if (out.length && out[out.length - 1].type === 'h' && prev && Math.abs(prev.y - l.y) < l.size * 2) out[out.length - 1].text += ' ' + t;
          else out.push({ type: 'h', level: l.size >= body * 1.6 ? 1 : 2, text: t });
          prev = l;
          return;
        }
        const gap = prev ? prev.y - l.y : 0;
        const newPara = !cur || !prev || gap > prev.size * 1.75 || gap < 0 || l.x > left + body * 0.9 || (prev.maxX < right - body * 4) || /[.!?:"”»]$/.test(cur.text) && l.x > left + body * 0.4;
        if (newPara) { flush(); cur = { type: 'p', text: t, center: Math.abs((l.x + l.maxX) / 2 - (left + right) / 2) < body && l.x > left + body * 3 }; }
        else if (/[A-Za-zÀ-ú]-$/.test(cur.text) && /^[a-zà-ú]/.test(t)) cur.text = cur.text.slice(0, -1) + t;
        else cur.text += ' ' + t;
        prev = l;
      });
    });
    flush();
    const html = out.map(b => {
      let t = escapeHtml(b.text);
      t = t.replace(/\u0001([^\u0002]*)\u0002/g, (m, k) => `<span class="footnote">${escapeHtml(decodeURIComponent(k))}</span>`);
      if (b.type === 'h') return `<h${b.level}>${t}</h${b.level}>`;
      if (/^(\*\s*){3,}$/.test(b.text)) return '<hr class="scene-break">';
      return `<p${b.center ? ' style="text-align:center"' : ''}>${t}</p>`;
    }).join('');
    const ch = htmlToChapters(html, res.name);
    return ch;
  }

  function convertImport(res) {
    if (!res) return [];
    if (res.kind === 'html') return htmlToChapters(res.html, res.name);
    if (res.kind === 'markdown') return markdownToChapters(res.text, res.name);
    if (res.kind === 'doc') return docToChapters(res);
    if (res.kind === 'epub') return epubToChapters(res);
    if (res.kind === 'odt') return odtToChapters(res);
    if (res.kind === 'pdf') return pdfToChapters(res);
    return textToChapters(res.text, res.name);
  }

  function countWords(html) {
    const t = String(html || '').replace(/<span class="footnote">[\s\S]*?<\/span>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');
    const m = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    return m ? m.length : 0;
  }

  window.BookText = { sanitizeHtml, htmlToChapters, textToChapters, markdownToChapters, convertImport, countWords, escapeHtml, splitChapterTitle };
})();
