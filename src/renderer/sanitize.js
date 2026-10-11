// Limpeza de HTML colado/importado e conversão de arquivos em capítulos.
(function () {
  const BLOCKS = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'FIGURE', 'FIGCAPTION']);
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUP', 'SUB', 'BR', 'SPAN', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM']);
  const RENAME = { STRONG: 'b', EM: 'i', H1: 'h2', H5: 'h4', H6: 'h4', DEL: 's', STRIKE: 's', INS: 'u', CITE: 'i', DFN: 'i', VAR: 'i' };
  const CLASSES = new Set(['scene-break', 'page-break', 'smallcaps', 'no-indent']);

  function cleanNode(node, doc) {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.nodeValue.replace(/­/g, ''));
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    let tag = node.tagName.toUpperCase();
    if (DROP.has(tag)) return null;

    // <div class="page-break"> é o único div permitido
    if (tag === 'DIV' && node.classList.contains('page-break')) {
      const d = doc.createElement('div');
      d.className = 'page-break';
      return d;
    }
    if (tag === 'HR') {
      const hr = doc.createElement('hr');
      hr.className = 'scene-break';
      return hr;
    }
    if (tag === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (!/^data:image\//i.test(src)) return null;
      const img = doc.createElement('img');
      img.setAttribute('src', src);
      if (node.getAttribute('alt')) img.setAttribute('alt', node.getAttribute('alt'));
      const w = node.style && node.style.width;
      if (w && /^\d+(\.\d+)?%$/.test(w)) img.style.width = w;
      return img;
    }

    const known = BLOCKS.has(tag) || INLINE.has(tag) || RENAME[tag];
    if (!known) {
      // Elementos desconhecidos (div, section, a, font…) são desembrulhados
      const frag = doc.createDocumentFragment();
      node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) frag.appendChild(c); });
      if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'MAIN') {
        const marker = doc.createElement('x-block');
        marker.appendChild(frag);
        return marker;
      }
      return frag;
    }

    // Inline que envolve blocos (ex.: <b> do Google Docs) é desembrulhado
    if (INLINE.has(tag) || RENAME[tag]) {
      const hasBlock = node.querySelector && node.querySelector('p,div,h1,h2,h3,h4,h5,h6,blockquote,ul,ol,li,table,section');
      if (hasBlock && !/^H\d$/.test(tag)) {
        const marker = doc.createElement('x-block');
        node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) marker.appendChild(c); });
        return marker;
      }
    }
    // <b style="font-weight:normal"> não é negrito
    if ((tag === 'B' || tag === 'STRONG') && node.style && /^(normal|[1-5]00)$/.test(node.style.fontWeight)) {
      const frag = doc.createDocumentFragment();
      node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) frag.appendChild(c); });
      return frag;
    }

    const outTag = (RENAME[tag] || tag).toLowerCase();
    const el = doc.createElement(outTag);

    // Mantém apenas classes conhecidas e alinhamento de texto
    node.classList && node.classList.forEach(c => { if (CLASSES.has(c)) el.classList.add(c); });
    const align = (node.style && node.style.textAlign) || node.getAttribute('align');
    if (align && /^(center|right|left)$/i.test(align) && ['p', 'h2', 'h3', 'h4'].includes(outTag)) {
      el.style.textAlign = align.toLowerCase();
    }
    // Itálico/negrito vindos de estilos inline (ex.: Google Docs)
    let wrapped = el;
    if (outTag === 'span') {
      const st = node.style || {};
      const fs = String(st.fontStyle || '');
      const fw = String(st.fontWeight || '');
      const fv = String(st.fontVariant || st.fontVariantCaps || '');
      const inner = doc.createDocumentFragment();
      node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) inner.appendChild(c); });
      let out = inner;
      const wrap = t => { const w = doc.createElement(t); w.appendChild(out); out = w; };
      if (fs === 'italic') wrap('i');
      if (fw === 'bold' || Number(fw) >= 600) wrap('b');
      if (/small-caps/.test(fv) || node.classList.contains('smallcaps')) {
        const sc = doc.createElement('span'); sc.className = 'smallcaps'; sc.appendChild(out); out = sc;
      }
      return out;
    }
    node.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) wrapped.appendChild(c); });
    return el;
  }

  // Coloca texto solto e elementos inline dentro de <p>, desfaz blocos aninhados
  function normalizeBlocks(container, doc) {
    const out = doc.createElement('div');
    let para = null;
    const flush = () => {
      if (para && (para.textContent.trim() || para.querySelector('img'))) out.appendChild(para);
      para = null;
    };
    const visit = parent => {
      Array.from(parent.childNodes).forEach(n => {
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'X-BLOCK') {
          flush();
          visit(n);
          flush();
          return;
        }
        const isBlock = n.nodeType === Node.ELEMENT_NODE &&
          (BLOCKS.has(n.tagName) || n.tagName === 'DIV');
        if (isBlock) {
          flush();
          // Remove marcadores x-block internos
          n.querySelectorAll && n.querySelectorAll('x-block').forEach(x => {
            if (n.tagName === 'UL' || n.tagName === 'OL' || n.tagName === 'BLOCKQUOTE') {
              const p = doc.createElement(n.tagName === 'BLOCKQUOTE' ? 'p' : 'span');
              while (x.firstChild) p.appendChild(x.firstChild);
              x.replaceWith(p);
            } else {
              x.replaceWith(...Array.from(x.childNodes));
            }
          });
          if (n.tagName === 'LI') {
            const ul = doc.createElement('ul'); ul.appendChild(n); out.appendChild(ul); return;
          }
          if (['P', 'H2', 'H3', 'H4'].includes(n.tagName) && !n.textContent.trim() && !n.querySelector('img')) return;
          if (n.tagName === 'P' && n.querySelector('p')) { visit(n); return; }
          out.appendChild(n);
          return;
        }
        if (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim() && !para) return;
        if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR' && !para) return;
        if (!para) para = doc.createElement('p');
        para.appendChild(n);
      });
    };
    visit(container);
    flush();
    // Imagem sozinha em parágrafo vira figura
    out.querySelectorAll('p').forEach(p => {
      if (p.children.length === 1 && p.firstElementChild.tagName === 'IMG' && !p.textContent.trim()) {
        const fig = doc.createElement('figure');
        fig.appendChild(p.firstElementChild);
        p.replaceWith(fig);
      }
    });
    return out.innerHTML;
  }

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    const holder = doc.createElement('div');
    doc.body.childNodes.forEach(ch => { const c = cleanNode(ch, doc); if (c) holder.appendChild(c); });
    return normalizeBlocks(holder, doc);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // HTML (Word/HTML) -> capítulos, dividindo nos títulos de nível 1
  function htmlToChapters(html, fallbackTitle) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    let headTag = doc.body.querySelector('h1') ? 'H1' : null;
    if (!headTag && doc.body.querySelectorAll('h2').length >= 2) headTag = 'H2';
    const chapters = [];
    let current = null;
    const startChapter = title => {
      current = { title: title || fallbackTitle || 'Sem título', parts: [] };
      chapters.push(current);
    };
    Array.from(doc.body.childNodes).forEach(n => {
      if (headTag && n.nodeType === Node.ELEMENT_NODE && n.tagName === headTag) {
        startChapter(n.textContent.trim().replace(/\s+/g, ' '));
        return;
      }
      if (!current) {
        if (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim()) return;
        startChapter(fallbackTitle);
      }
      current.parts.push(n.nodeType === Node.ELEMENT_NODE ? n.outerHTML : escapeHtml(n.nodeValue || ''));
    });
    return chapters
      .map(c => Object.assign(splitChapterTitle(c.title), { html: sanitizeHtml(c.parts.join('')) }))
      .filter(c => c.html.trim() || c.title);
  }

  // "Capítulo 3 — A fuga" -> título "A fuga" (o número vem da numeração automática).
  // "Capítulo 3" sozinho -> mantém o texto e marca como não numerado, para não duplicar.
  function splitChapterTitle(title) {
    const m = /^(cap[ií]tulo|chapter)\s+([0-9]+|[ivxlcdm]+|[a-zà-ú]+)\s*([-–—:.]\s*)?(.*)$/i.exec(title || '');
    if (!m) return { title, numbered: true };
    if (m[4].trim()) return { title: m[4].trim(), numbered: true };
    return { title, numbered: false };
  }

  const CHAPTER_LINE = /^(cap[ií]tulo|chapter|parte)\s+([0-9ivxlcdm]+|[a-zà-ú]+)\b.*$/i;

  // Texto puro -> capítulos
  function textToChapters(text, fallbackTitle) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    const hasBlankLines = /\n[ \t]*\n/.test(text);
    const paragraphs = hasBlankLines
      ? text.split(/\n[ \t]*\n+/).map(p => p.replace(/\s*\n\s*/g, ' ').trim())
      : text.split('\n').map(p => p.trim());
    const html = [];
    paragraphs.forEach(p => {
      if (!p) return;
      if (/^(\*\s*){3,}$|^(#\s*){3}$|^[-–—~]{3,}$/.test(p)) { html.push('<hr class="scene-break">'); return; }
      if (CHAPTER_LINE.test(p) && p.length < 90) { html.push('<h1>' + escapeHtml(p) + '</h1>'); return; }
      html.push('<p>' + escapeHtml(p) + '</p>');
    });
    return htmlToChapters(html.join(''), fallbackTitle);
  }

  function inlineMd(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>')
      .replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, '$1<i>$2</i>');
  }

  // Markdown básico -> capítulos
  function markdownToChapters(text, fallbackTitle) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let para = [];
    let list = null;
    const flushPara = () => {
      if (para.length) html.push('<p>' + inlineMd(para.join(' ')) + '</p>');
      para = [];
    };
    const flushList = () => {
      if (list) html.push(`<${list.tag}>` + list.items.map(i => '<li>' + inlineMd(i) + '</li>').join('') + `</${list.tag}>`);
      list = null;
    };
    lines.forEach(raw => {
      const line = raw.trim();
      let m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
        flushPara(); flushList();
        const level = m[1].length;
        html.push(`<h${level}>${inlineMd(m[2])}</h${level}>`);
        return;
      }
      if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line)) { flushPara(); flushList(); html.push('<hr class="scene-break">'); return; }
      if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); html.push('<blockquote><p>' + inlineMd(m[1]) + '</p></blockquote>'); return; }
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

  // Estimativa simples de palavras
  function countWords(html) {
    const t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ');
    const m = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    return m ? m.length : 0;
  }

  window.BookText = { sanitizeHtml, htmlToChapters, textToChapters, markdownToChapters, countWords, escapeHtml };
})();
