// Padronização de texto: limpa HTML colado/importado e converte manuscritos
// (Word, EPUB, ODT, DOC, PDF, TXT, Markdown) em capítulos no padrão do livro.
(function () {
  const BLOCKS = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION']);
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUP', 'SUB', 'BR', 'SPAN', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'NAV', 'COL', 'COLGROUP']);
  const RENAME = { STRONG: 'b', EM: 'i', H1: 'h2', H5: 'h4', H6: 'h4', DEL: 's', STRIKE: 's', INS: 'u', CITE: 'i', DFN: 'i', VAR: 'i', ASIDE: 'div', DT: 'p', DD: 'p' };
  const P_CLASSES = new Set(['no-indent', 'phrase', 'reference', 'epigraph-inline', 'table-source', 'caption-text']);
  const DIV_CLASSES = ['page-break', 'poem', 'box', 'fullbleed', 'tframe', 'ph-block'];
  const FIG_ATTRS = ['data-asset', 'data-align', 'data-wrap', 'data-width', 'data-gap', 'data-rot', 'data-flipx', 'data-flipy', 'data-opacity', 'data-crop', 'data-ratio', 'data-fit', 'data-ref', 'data-bleed'];

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
      a.className = /^#/.test(href) ? ['xref'].concat(cls.contains('xref-auto') ? ['xref-auto'] : [], cls.contains('xref-page') ? ['xref-page'] : []).join(' ') : 'ext';
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
      // bloco de imagem (cinza, à espera da imagem) e caixa de texto à parte
      if (special === 'ph-block') {
        const d = doc.createElement('div');
        d.className = 'ph-block';
        ['data-ph', 'data-cap', 'data-width', 'data-align'].forEach(a => { if (node.getAttribute(a) != null) d.setAttribute(a, node.getAttribute(a)); });
        d.textContent = node.textContent.replace(/[­​]/g, '').trim();
        return d;
      }
      if (special === 'tframe') {
        const d = doc.createElement('div');
        d.className = 'tframe';
        ['data-pos', 'data-width', 'data-look'].forEach(a => { if (/^[a-z0-9.-]{1,12}$/.test(node.getAttribute(a) || '')) d.setAttribute(a, node.getAttribute(a)); });
        const inner = doc.createElement('div');
        children(node, doc, inner);
        d.innerHTML = normalizeBlocks(inner, doc, true);
        return d;
      }
      if (special === 'poem' || special === 'box') {
        const d = doc.createElement('div');
        d.className = special;
        if (special === 'box' && /^[a-z-]{1,20}$/.test(node.getAttribute('data-style') || '')) d.setAttribute('data-style', node.getAttribute('data-style'));
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
    // termo marcado para o índice remissivo
    if (outTag === 'span' && cls.contains('ix') && node.getAttribute('data-ix')) {
      const x = doc.createElement('span');
      x.className = 'ix';
      x.setAttribute('data-ix', node.getAttribute('data-ix'));
      if (node.getAttribute('data-ixsub')) x.setAttribute('data-ixsub', node.getAttribute('data-ixsub'));
      return children(node, doc, x);
    }
    // estilo de caractere (trecho marcado): fica, com o nome do estilo
    if (outTag === 'span' && node.getAttribute('data-cs')) {
      const x = doc.createElement('span');
      x.setAttribute('data-cs', node.getAttribute('data-cs'));
      return children(node, doc, x);
    }
    if (outTag === 'span' && cls.contains('comment')) {
      // comentário de revisão (Word/ODT): anotação no editor, não sai no livro
      const c = doc.createElement('span');
      c.className = 'comment';
      c.setAttribute('data-text', node.getAttribute('data-text') || node.textContent || '');
      if (node.getAttribute('data-author')) c.setAttribute('data-author', node.getAttribute('data-author'));
      c.textContent = '\u200b';
      return c;
    }
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
    if (outTag === 'table') { cls.forEach(c => { if (/^tb-(zebra|compact|quadro)$/.test(c)) e.classList.add(c); }); if (node.getAttribute('data-ref')) e.setAttribute('data-ref', node.getAttribute('data-ref')); }
    if (outTag === 'td' && cls.contains('num')) e.classList.add('num');
    if (outTag === 'blockquote' && /^[a-z-]{1,20}$/.test(node.getAttribute('data-style') || '')) e.setAttribute('data-style', node.getAttribute('data-style'));
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
      // legendas importadas: ficam ligadas à figura, à tabela ou ao gráfico a que pertencem (o texto
      // da legenda é mantido como veio — se já vier numerada, a numeração original é respeitada)
      const isChartMark = el => el && el.tagName === 'P' && /^\s*\u27E6GRAFICO:\d+\u27E7\s*$/.test(el.textContent);
      const moveInto = (p, tagName, host, atStart) => { const c = doc.createElement(tagName); while (p.firstChild) c.appendChild(p.firstChild); if (atStart) host.insertBefore(c, host.firstChild); else host.appendChild(c); p.remove(); };
      out.querySelectorAll('p.caption-import').forEach(p => {
        const prev = p.previousElementSibling, next = p.nextElementSibling;
        if (prev && prev.tagName === 'FIGURE' && !prev.querySelector('figcaption')) return moveInto(p, 'figcaption', prev);
        if (isChartMark(prev) && !prev.dataset.caption) { prev.dataset.caption = p.textContent.trim(); p.remove(); return; }
        if (next && next.tagName === 'TABLE' && !next.querySelector('caption')) return moveInto(p, 'caption', next, true);
        if (next && next.tagName === 'FIGURE' && !next.querySelector('figcaption')) return moveInto(p, 'figcaption', next);
        if (isChartMark(next) && !next.dataset.caption) { next.dataset.caption = p.textContent.trim(); p.remove(); return; }
        if (prev && prev.tagName === 'TABLE' && !prev.querySelector('caption') && !/^fonte\s*:/i.test(p.textContent.trim())) return moveInto(p, 'caption', prev, true);
        p.classList.remove('caption-import');
        p.classList.add('caption-text'); // legenda solta: mantém a aparência de legenda
      });
      // “Fonte: …” logo depois de uma tabela, gráfico ou figura
      out.querySelectorAll('p').forEach(p => {
        const prev = p.previousElementSibling;
        if (/^fonte\s*:/i.test(p.textContent.trim()) && prev && (prev.tagName === 'TABLE' || prev.tagName === 'FIGURE' || isChartMark(prev))) p.classList.add('table-source');
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
    // o número (1, IV, “dois”) precisa terminar a palavra: “Capítulo Dois” não é “Capítulo D” + “ois”
    const m = /^(cap[ií]tulo|chapter)\s+([0-9]+|[ivxlcdm]+|[a-zà-ú]+)(?![\p{L}\p{N}])\s*([-–—:.]\s*)?(.*)$/iu.exec(title || '');
    if (!m) return { title, numbered: true };
    if (m[4].trim()) return { title: m[4].trim(), numbered: true };
    return { title, numbered: false };
  }

  // ---- marcadores de capítulo: "CAPÍTULO 3", "Capítulo IV — A fuga", "Cap. 2", ou só "3" / "IV" num bloco
  const ROMAN_RE = /^(?=[IVXLCDM]+$)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
  const NUM_WORDS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
  const ORD_WORDS = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo'];
  const SPECIAL_RE = /^(pref[áa]cio|apresenta[çc][ãa]o|introdu[çc][ãa]o|pr[óo]logo|ep[íi]logo|posf[áa]cio|conclus[ãa]o|considera[çc][õo]es finais|agradecimentos?|nota (do|da) (autor|autora|editor|editora|tradutor|tradutora)|nota pr[ée]via|ap[êe]ndices?|anexos?|refer[êe]ncias( bibliogr[áa]ficas)?|bibliografia|gloss[áa]rio|notas|sobre (o|a) autor[a]?)\b/i;
  function romanValue(r) {
    const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let n = 0; r = r.toUpperCase();
    for (let i = 0; i < r.length; i++) { const a = v[r[i]], b = v[r[i + 1]] || 0; n += a < b ? -a : a; }
    return n;
  }
  function numValue(tok) {
    if (/^\d+$/.test(tok)) return { n: Number(tok), style: 'arabic' };
    if (ROMAN_RE.test(tok)) return { n: romanValue(tok), style: 'roman' };
    const w = tok.toLowerCase();
    if (NUM_WORDS.includes(w)) return { n: NUM_WORDS.indexOf(w), style: 'words' };
    if (ORD_WORDS.includes(w) && w) return { n: ORD_WORDS.indexOf(w), style: 'words' };
    return null;
  }
  // texto do bloco -> { n, style, labeled, title } ou null
  function chapterMark(text, tag) {
    const t = String(text || '').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 140) return null;
    let m = /^(cap[ií]tulo|cap\.|chapter)\s+([0-9]+|[ivxlcdm]+|[a-zà-ú]+)(?![\p{L}\p{N}])\s*(?:[-–—:.]\s*)?(.*)$/iu.exec(t);
    if (m) {
      const v = numValue(m[2]);
      if (!v) return null;
      return { n: v.n, style: v.style, labeled: true, title: m[3].trim(), label: (m[1] + ' ' + m[2]).trim() };
    }
    // número sozinho: "3", "IV", "3.", "— IV —"
    m = /^[-–—\s]*([0-9]{1,3}|[IVXLCDM]{1,7})[.)]?[-–—\s]*$/.exec(t);
    if (m) { const v = numValue(m[1]); if (v && v.n > 0) return { n: v.n, style: v.style, labeled: false, title: '', label: m[1] }; }
    // "3. Título" / "IV — Título": só em títulos (h1–h3), nunca em parágrafos de texto
    if (/^H[1-3]$/.test(tag || '')) {
      m = /^([0-9]{1,3}|[IVXLCDM]{1,7})\s*[.)\-–—:]\s+(.{2,100})$/.exec(t);
      if (m && !/^\d+\.\d/.test(t)) { const v = numValue(m[1]); if (v && v.n > 0) return { n: v.n, style: v.style, labeled: false, title: m[2].trim(), label: m[1] }; }
    }
    return null;
  }
  // bloco curto que parece título (para usar como nome do capítulo depois de "CAPÍTULO 3")
  function isTitleLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (/^H[1-6]$/.test(el.tagName)) return true;
    if (el.tagName !== 'P') return false;
    const t = el.textContent.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 110 || el.querySelector('.footnote, img, table')) return false;
    const words = t.split(' ').length;
    if (words > 16) return false;
    const strong = el.querySelector('b, strong') && el.querySelector('b, strong').textContent.trim() === t;
    const centered = /text-align:\s*center/.test(el.getAttribute('style') || '');
    const upper = t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t);
    return strong || centered || upper || (!/[.;,:]$/.test(t) && words <= 10);
  }
  // escolhe os marcadores que formam a sequência de capítulos do livro
  function chapterMarkers(flat) {
    const cands = [];
    flat.forEach((n, i) => {
      if (n.nodeType !== 1 || !/^(H[1-6]|P)$/.test(n.tagName)) return;
      const mk = chapterMark(n.textContent, n.tagName);
      if (mk) cands.push(Object.assign({ i }, mk));
    });
    const labeled = cands.filter(c => c.labeled);
    const groups = { arabic: [], roman: [] };
    cands.filter(c => !c.labeled).forEach(c => { if (groups[c.style]) groups[c.style].push(c); });
    // números soltos só contam se formam uma sequência (1, 2, 3… ou I, II, III…)
    const seqOk = g => {
      if (g.length < 2) return false;
      let inc = 0;
      for (let k = 1; k < g.length; k++) if (g[k].n === g[k - 1].n + 1) inc++;
      return inc >= Math.max(1, (g.length - 1) * 0.6) && g[0].n <= 2;
    };
    let chosen = labeled.length >= 2 ? labeled.slice() : [];
    ['arabic', 'roman'].forEach(k => {
      const g = groups[k];
      if (!seqOk(g)) return;
      // se já há "CAPÍTULO N", números soltos só valem quando são a maioria (livro misto)
      if (chosen.length && g.length < chosen.length) return;
      chosen = chosen.concat(g);
    });
    if (chosen.length < 2) return null;
    chosen.sort((a, b) => a.i - b.i);
    const styles = {};
    chosen.forEach(c => { styles[c.style] = (styles[c.style] || 0) + 1; });
    const style = Object.entries(styles).sort((a, b) => b[1] - a[1])[0][0];
    return { at: new Map(chosen.map(c => [c.i, c])), style, labeled: labeled.length >= chosen.length / 2 };
  }

  // livro sem nenhuma marcação: títulos são linhas curtas, sozinhas, sem pontuação final, entre parágrafos longos
  function plainTitles(flat) {
    const els = [];
    flat.forEach((n, i) => { if (n.nodeType === 1 && /^(P|H[1-6]|DIV)$/.test(n.tagName) && n.textContent.trim()) els.push({ n, i, t: n.textContent.replace(/\s+/g, ' ').trim() }); });
    if (els.length < 20) return null;
    const isLong = e => e && e.t.length > 140;
    // linhas curtas antes do primeiro parágrafo longo (exceto a última, que é o título do 1º capítulo): título/autor da obra
    const firstLong = els.findIndex(isLong);
    const front = firstLong > 1 ? els.slice(0, firstLong - 1).filter(e => e.t.length <= 80).map(e => e.t) : [];
    const cands = els.filter((e, k) => {
      if (k < firstLong - 1) return false;
      const t = e.t;
      if (t.length > 80 || t.split(' ').length > 12 || t.length < 2) return false;
      if (/[.,;:…]$/.test(t) && !/^[IVXLC]+\.$|^\d+\.$/.test(t)) return false;
      if (/^[—–\-"“«'‘(]/.test(t) || /^[a-zà-ú]/.test(t)) return false;
      if (e.n.querySelector && e.n.querySelector('.footnote, img')) return false;
      const prev = els[k - 1], next = els[k + 1];
      // título: o próximo bloco é texto corrido (ou outro título curto, nome do capítulo); o anterior não é a mesma frase quebrada
      return (isLong(next) || (next && next.t.length <= 80 && isLong(els[k + 2]))) && (!prev || isLong(prev) || prev.t.length <= 80);
    });
    // junta “título + subtítulo” consecutivos e exige distância mínima entre títulos
    const out = [];
    cands.forEach(c => {
      const last = out[out.length - 1];
      if (last && els.indexOf(c) - els.indexOf(last.c) <= 1) { last.sub = c; return; }
      out.push({ c });
    });
    if (out.length < 2) return null;
    const pos = out.map(o => els.indexOf(o.c));
    const gaps = pos.slice(1).map((p, k) => p - pos[k]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avg < 8 || gaps.filter(g => g < 3).length > gaps.length * 0.2) return null;
    if (pos[0] > els.length * 0.25) return null;
    const res = out.map(o => ({ i: o.c.i, title: o.c.t, sub: o.sub ? { i: o.sub.i, title: o.sub.t } : null }));
    res.front = front.length === firstLong - 1 ? front : [];
    return res;
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
    const start = (title, extra) => { current = Object.assign({ title: title || fallbackTitle || 'Sem título', parts: [] }, extra || {}); chapters.push(current); };
    // achata seções que só agrupam conteúdo
    const flat = [];
    const pushFlat = node => {
      if (node.nodeType === 1 && /^(SECTION|ARTICLE|MAIN|DIV)$/.test(node.tagName) && !DIV_CLASSES.some(c => node.classList.contains(c)) && node.querySelector('h1,h2,p')) node.childNodes.forEach(pushFlat);
      else flat.push(node);
    };
    doc.body.childNodes.forEach(pushFlat);
    const clean = t => String(t || '').replace(/[­​]/g, '').trim().replace(/\s+/g, ' ');
    const markers = opts.noMarkers ? null : chapterMarkers(flat);
    let detected = null;
    if (markers) {
      // capítulos pelos marcadores "CAPÍTULO N" / números; títulos especiais (Prefácio, Introdução…) também abrem seção
      const skip = new Set();
      let seenMarker = false;
      flat.forEach((n, i) => {
        if (skip.has(i)) return;
        const mk = markers.at.get(i);
        if (mk) {
          seenMarker = true;
          let title = mk.title;
          if (!title) {
            let j = i + 1;
            while (j < flat.length && (flat[j].nodeType !== 1 && !String(flat[j].nodeValue || '').trim())) j++;
            const nx = flat[j];
            if (nx && !markers.at.has(j) && isTitleLike(nx) && !chapterMark(nx.textContent, nx.tagName)) { title = clean(nx.textContent); skip.add(j); }
          }
          // sem nome: o título fica como no manuscrito (“CAPÍTULO 3”), sem o rótulo automático repetido
          start(title || clean(n.textContent), { numbered: !!title, sourceLabel: clean(n.textContent), mark: mk });
          return;
        }
        if (n.nodeType === 1 && /^H[1-3]$/.test(n.tagName)) {
          const t = clean(n.textContent);
          if (SPECIAL_RE.test(t) && t.length < 80) { start(t, { numbered: false }); return; }
          if (!seenMarker && n.tagName === headTag) { start(t, { numbered: false }); return; }
        }
        if (!current) {
          if (n.nodeType === 3 && !n.nodeValue.trim()) return;
          start(fallbackTitle, { numbered: false });
        }
        current.parts.push(n.nodeType === 1 ? n.outerHTML : escapeHtml(n.nodeValue || ''));
      });
      detected = { style: markers.style, labeled: markers.labeled, count: markers.at.size };
    } else if (!headTag && !opts.noPlain && (detected = plainTitles(flat))) {
      // sem títulos marcados: linhas curtas isoladas viram capítulos (confira em Revisar títulos)
      const at = new Map(detected.map(d => [d.i, d]));
      const skip = new Set(detected.filter(d => d.sub).map(d => d.sub.i));
      flat.forEach((n, i) => {
        if (skip.has(i)) return;
        const d = at.get(i);
        if (d) {
          const mk = chapterMark(d.title, 'H1');
          let title = mk && mk.title ? mk.title : d.title;
          if (mk && !mk.title && d.sub) title = d.sub.title;
          else if (d.sub) title = d.title + ' — ' + d.sub.title;
          start(title, { numbered: !(SPECIAL_RE.test(title)) && !(mk && !mk.title && !d.sub), sourceLabel: d.title });
          return;
        }
        if (!current) {
          if (n.nodeType === 3 && !n.nodeValue.trim()) return;
          start(fallbackTitle, { numbered: false });
        }
        current.parts.push(n.nodeType === 1 ? n.outerHTML : escapeHtml(n.nodeValue || ''));
      });
      const front = detected.front || [];
      detected = { style: 'arabic', labeled: true, count: detected.length, plain: true };
      // título e autor no começo do arquivo: vão para os dados do livro, não para um capítulo
      if (front.length && chapters[0] && chapters[0].numbered === false && !chapters[0].sourceLabel) {
        const txt = chapters[0].parts.join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (txt === front.join(' ')) { chapters.shift(); detected.meta = { title: front[0], author: front[1] || '' }; }
      }
    } else {
      flat.forEach(n => {
        if (headTag && n.nodeType === 1 && n.tagName === headTag) { start(clean(n.textContent)); return; }
        if (!current) {
          if (n.nodeType === 3 && !n.nodeValue.trim()) return;
          start(fallbackTitle);
        }
        current.parts.push(n.nodeType === 1 ? n.outerHTML : escapeHtml(n.nodeValue || ''));
      });
    }
    const out = chapters
      .map(c => {
        const base = c.numbered === undefined ? splitChapterTitle(c.title) : { title: c.title, numbered: c.numbered };
        return Object.assign(base, { html: sanitizeHtml(c.parts.join('')) }, c.sourceLabel ? { sourceLabel: c.sourceLabel } : {});
      })
      .filter(c => c.html.replace(/<[^>]+>/g, '').trim() || /<img|<table/.test(c.html) || c.sourceLabel);
    out.notes = notes;
    out.detected = detected;
    if (detected && detected.meta) out.meta = detected.meta;
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
      // "CAPÍTULO 3" no título e o nome logo abaixo
      const mk = h && chapterMark(title, h.tagName);
      let next = h && h.nextElementSibling;
      if (mk && !mk.title && next && isTitleLike(next) && !chapterMark(next.textContent, next.tagName)) { title = (mk.label || title) + ' — ' + next.textContent.trim().replace(/\s+/g, ' '); next.remove(); }
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

  // Padroniza o texto já gravado: tira fontes, tamanhos, cores, entrelinhas e espaçamentos
  // embutidos (vindos de colagens antigas), para que o livro siga os estilos configurados.
  // Mantém negrito/itálico, versalete, notas, figuras e só o alinhamento centralizado/à direita.
  function normalizeStyles(html) {
    if (!html || !/style=|<font/i.test(html)) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const root = tpl.content;
    root.querySelectorAll('font').forEach(f => f.replaceWith(...Array.from(f.childNodes)));
    root.querySelectorAll('[style]').forEach(e => {
      if (e.closest('figure.img, div.fullbleed')) return;
      const st = e.style;
      const tag = e.tagName;
      if (/^(P|H2|H3|H4|LI|BLOCKQUOTE|TD|TH)$/.test(tag)) {
        const ta = /^(center|right)$/.test(st.textAlign) ? st.textAlign : '';
        e.removeAttribute('style');
        if (ta) e.style.textAlign = ta;
        return;
      }
      if (tag === 'SPAN' && !e.className) {
        let node = document.createDocumentFragment();
        Array.from(e.childNodes).forEach(n => node.appendChild(n));
        const wrap = t => { const w = document.createElement(t); w.appendChild(node); node = w; };
        if (st.fontStyle === 'italic') wrap('i');
        if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) wrap('b');
        e.replaceWith(node);
        return;
      }
      e.removeAttribute('style');
    });
    return tpl.innerHTML;
  }

  window.BookText = { chapterMark, isTitleLike, chapterMarkers, SPECIAL_RE, sanitizeHtml, normalizeStyles, htmlToChapters, textToChapters, markdownToChapters, convertImport, countWords, escapeHtml, splitChapterTitle };
})();
