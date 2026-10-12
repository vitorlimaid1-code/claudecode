/* global App */
// Revisão do texto: localizar e substituir, limpeza de problemas vindos do manuscrito
// e verificação de consistência tipográfica. Tudo com prévia e desfazer.
(function () {
  const { el, $ } = App;
  const st = { find: '', repl: '', cs: false, word: false, re: false, scope: 'all', results: null };

  function textNodes(root) {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function parse(html) { const t = document.createElement('template'); t.innerHTML = html || ''; return t; }

  const CHECKS = [
    { id: 'dspace', label: 'Espaços duplos', on: true, text: [/ {2,}/g, ' '] },
    { id: 'spacepunct', label: 'Espaço antes de vírgula, ponto, ponto e vírgula, dois-pontos, ! e ?', on: true, text: [/ +([,.;:!?])/g, '$1'] },
    { id: 'invisible', label: 'Caracteres invisíveis (espaço de largura zero, hífen discricionário)', on: true, text: [/[​‌‍⁠﻿­]/g, ''] },
    { id: 'tabs', label: 'Tabulações dentro do texto', on: true, text: [/\t+/g, ' '] },
    { id: 'dash', label: 'Hífen duplo (--) → travessão (—)', on: true, text: [/--/g, '—'] },
    { id: 'brokenhyph', label: 'Palavras partidas por hífen de fim de linha (ex.: “pala- vra”)', on: true, text: [/([a-zà-ú])- ([a-zà-ú])/g, '$1$2'] },
    { id: 'ellipsis', label: 'Três pontos (...) → reticências (…)', on: false, text: [/\.\.\./g, '…'] },
    { id: 'nbsp', label: 'Espaços não separáveis → espaço comum', on: false, text: [/ /g, ' '] },
    { id: 'quotes', label: 'Aspas retas → aspas curvas (“ ” ‘ ’)', on: false, custom: 'quotes' },
    { id: 'trim', label: 'Espaços no início ou fim de parágrafos', on: true, custom: 'trim' },
    { id: 'empty', label: 'Parágrafos vazios', on: true, custom: 'empty' },
    { id: 'br', label: 'Quebras de linha manuais dentro de parágrafos (fora de poesias)', on: true, custom: 'br' },
    { id: 'emptyh', label: 'Títulos (T1/T2/T3) vazios', on: true, custom: 'emptyh' },
    { id: 'align', label: 'Alinhamentos manuais em parágrafos de texto', on: false, custom: 'align' },
    { id: 'inlinestyle', label: 'Formatação manual residual (estilos embutidos)', on: true, custom: 'inlinestyle' }
  ];

  function runCheck(check, frag, fix) {
    let count = 0;
    const samples = [];
    const root = frag.content;
    if (check.text) {
      const [re, rep] = check.text;
      textNodes(root).forEach(n => {
        if (n.parentElement && n.parentElement.closest('div.poem') && check.id === 'dspace') return;
        const m = n.nodeValue.match(re);
        if (m) { count += m.length; if (samples.length < 3) samples.push(n.nodeValue.trim().slice(0, 70)); if (fix) n.nodeValue = n.nodeValue.replace(re, rep); }
      });
      return { count, samples };
    }
    const c = check.custom;
    if (c === 'quotes') {
      textNodes(root).forEach(n => {
        if (!/["']/.test(n.nodeValue)) return;
        count += (n.nodeValue.match(/["']/g) || []).length;
        if (samples.length < 3) samples.push(n.nodeValue.trim().slice(0, 70));
        if (fix) n.nodeValue = n.nodeValue.replace(/(^|[\s(\[—–-])"/g, '$1“').replace(/"/g, '”').replace(/(^|[\s(\[—–-])'/g, '$1‘').replace(/'/g, '’');
      });
    } else if (c === 'trim') {
      root.querySelectorAll('p, h2, h3, h4, li').forEach(p => {
        const f = p.firstChild, l = p.lastChild;
        let hit = false;
        if (f && f.nodeType === 3 && /^\s+/.test(f.nodeValue)) { hit = true; if (fix) f.nodeValue = f.nodeValue.replace(/^\s+/, ''); }
        if (l && l.nodeType === 3 && /\s+$/.test(l.nodeValue) && l.nodeValue.trim()) { hit = true; if (fix) l.nodeValue = l.nodeValue.replace(/\s+$/, ''); }
        if (hit) count++;
      });
    } else if (c === 'empty') {
      root.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.querySelector('img, span.footnote') && !p.closest('div.poem, td, th')) { count++; if (fix) p.remove(); } });
    } else if (c === 'br') {
      root.querySelectorAll('p br, h2 br, h3 br, h4 br').forEach(br => {
        if (br.closest('div.poem, td, th')) return;
        const p = br.parentElement;
        if (p && !p.textContent.trim()) return;
        count++;
        if (samples.length < 3) samples.push((p.textContent || '').slice(0, 70));
        if (fix) br.replaceWith(document.createTextNode(' '));
      });
    } else if (c === 'emptyh') {
      root.querySelectorAll('h2, h3, h4').forEach(h => { if (!h.textContent.trim()) { count++; if (fix) h.remove(); } });
    } else if (c === 'align') {
      root.querySelectorAll('p[style*="text-align"]').forEach(p => { if (/justify|left/.test(p.style.textAlign)) { count++; if (fix) p.style.textAlign = ''; if (fix && !p.getAttribute('style')) p.removeAttribute('style'); } });
    } else if (c === 'inlinestyle') {
      root.querySelectorAll('span[style], b[style], i[style], u[style], h2[style], h3[style], h4[style], li[style]').forEach(n => { count++; if (fix) n.removeAttribute('style'); });
    }
    return { count, samples };
  }

  function chaptersInScope() {
    App.flush();
    const all = App.project.chapters;
    return st.scope === 'current' ? all.filter(c => c.id === App.chapterId) : all;
  }

  function scan() {
    const res = CHECKS.map(ch => ({ ch, count: 0, samples: [], chapters: [] }));
    chaptersInScope().forEach(c => {
      const t = parse(c.html);
      res.forEach(r => { const x = runCheck(r.ch, t, false); if (x.count) { r.count += x.count; r.chapters.push(c.title); r.samples.push(...x.samples.slice(0, 1)); } });
    });
    return res;
  }

  async function applyFixes(ids) {
    const checks = CHECKS.filter(c => ids.includes(c.id));
    if (!checks.length) return;
    const chs = chaptersInScope();
    const locked = chs.filter(c => c.locked);
    const items = checks.map(c => c.label);
    if (locked.length) items.push(`(${locked.length} capítulo(s) bloqueado(s) não serão alterados)`);
    const ok = await App.confirmPreview('Aplicar correções', 'Serão aplicadas as correções abaixo:', items);
    if (!ok) return;
    let total = 0;
    chs.filter(c => !c.locked).forEach(c => {
      const t = parse(c.html);
      checks.forEach(ch => { total += runCheck(ch, t, true).count; });
      c.html = t.innerHTML;
    });
    App.editorChapterId = null;
    App.changed(`Revisão: ${total} correção(ões)`);
    App.toast(`${total} correção(ões) aplicada(s).`);
    render();
  }

  // ---------------------------------------------------------------- localizar e substituir
  function buildRegex() {
    if (!st.find) return null;
    let src = st.re ? st.find : st.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (st.word) src = `(?<![\\p{L}\\p{N}])${src}(?![\\p{L}\\p{N}])`;
    try { return new RegExp(src, 'gu' + (st.cs ? '' : 'i')); } catch (e) { App.toast('Expressão inválida: ' + e.message); return null; }
  }

  function find() {
    const re = buildRegex();
    if (!re) { st.results = null; render(); return; }
    const results = [];
    chaptersInScope().forEach(c => {
      const t = parse(c.html);
      textNodes(t.content).forEach(n => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(n.nodeValue))) {
          results.push({ chapter: c, before: n.nodeValue.slice(Math.max(0, m.index - 40), m.index), match: m[0], after: n.nodeValue.slice(m.index + m[0].length, m.index + m[0].length + 40) });
          if (!m[0].length) re.lastIndex++;
          if (results.length > 2000) break;
        }
      });
    });
    st.results = results;
    render();
  }

  async function replaceAll() {
    const re = buildRegex();
    if (!re || !st.results || !st.results.length) return;
    const targets = [...new Set(st.results.map(r => r.chapter))];
    const locked = targets.filter(c => c.locked);
    const ok = await App.confirmPreview('Substituir todos', `Substituir ${st.results.length} ocorrência(s) de “${st.find}” por “${st.repl}”` + (locked.length ? ` (exceto em ${locked.length} capítulo(s) bloqueado(s))` : '') + ':', st.results.slice(0, 60).map(r => `${r.chapter.title}: …${r.before}[${r.match}]${r.after}…`), 'Substituir');
    if (!ok) return;
    let n = 0;
    targets.filter(c => !c.locked).forEach(c => {
      const t = parse(c.html);
      textNodes(t.content).forEach(tn => { re.lastIndex = 0; const v = tn.nodeValue.replace(re, () => { n++; return st.repl; }); if (v !== tn.nodeValue) tn.nodeValue = st.re ? tn.nodeValue.replace(re, st.repl) : v; });
      c.html = t.innerHTML;
    });
    App.editorChapterId = null;
    App.changed(`Substituição: ${n} ocorrência(s)`);
    App.toast(`${n} ocorrência(s) substituída(s).`);
    find();
  }

  // comentários de revisão vindos do Word/ODT (ou feitos no editor): não saem no livro
  function commentsCard() {
    const list = [];
    App.project.chapters.forEach(c => { const t = document.createElement('template'); t.innerHTML = c.html || ''; t.content.querySelectorAll('span.comment').forEach((n, i) => list.push({ c, i, author: n.dataset.author || '', text: n.dataset.text || '', ctx: (n.parentElement ? n.parentElement.textContent : '').trim().slice(0, 90) })); });
    if (!list.length) return null;
    const removeAll = () => { App.project.chapters.forEach(c => { c.html = String(c.html || '').replace(/<span class="comment"[^>]*>[\s\S]*?<\/span>/g, ''); }); App.editorChapterId = null; App.changed('Comentários de revisão removidos'); render(); };
    return el('div', { class: 'card' }, [
      el('h3', { text: `Comentários de revisão (${list.length})` }),
      el('p', { class: 'muted small', text: 'Vieram do manuscrito importado. Aparecem no editor como 💬 e nunca saem no livro impresso, no PDF nem no EPUB.' }),
      el('div', { class: 'find-results' }, list.map(r => el('div', { class: 'find-row', onclick: () => App.setView('chapter', r.c.id) }, [
        el('span', { class: 'muted small', text: r.c.title + ': ' }), el('b', { text: (r.author ? r.author + ': ' : '') }), el('span', { text: r.text }),
        r.ctx ? el('div', { class: 'muted small', text: '“' + r.ctx + '…”' }) : null
      ]))),
      el('div', { class: 'inline wrap' }, [el('button', { text: 'Remover todos os comentários', onclick: removeAll })])
    ]);
  }

  function render() {
    const v = $('#view-tools');
    v.innerHTML = '';
    const inp = (key, ph) => { const i = el('input', { type: 'text', placeholder: ph, value: st[key] }); i.addEventListener('input', () => { st[key] = i.value; }); i.addEventListener('keydown', e => { if (e.key === 'Enter') find(); }); return i; };
    const chk = (key, label) => el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', checked: st[key], onchange: e => { st[key] = e.target.checked; } }), ' ' + label]);
    const scope = el('select', { onchange: e => { st.scope = e.target.value; } }, [['all', 'Livro inteiro'], ['current', 'Capítulo atual']].map(([a, b]) => el('option', { value: a, text: b })));
    scope.value = st.scope;
    const checks = scan();
    const boxes = {};
    v.appendChild(el('div', { class: 'form-wrap' }, [
      el('h2', { text: 'Revisão do texto' }),
      commentsCard(),
      el('div', { class: 'card' }, [
        el('h3', { text: 'Localizar e substituir' }),
        el('div', { class: 'grid' }, [App.field('Localizar', inp('find', 'texto ou expressão')), App.field('Substituir por', inp('repl', '')), App.field('Onde', scope)]),
        el('div', { class: 'inline wrap' }, [chk('cs', 'Diferenciar maiúsculas'), chk('word', 'Palavra inteira'), chk('re', 'Expressão regular'),
          el('button', { class: 'primary', text: 'Localizar', onclick: find }),
          el('button', { text: 'Substituir todos…', disabled: !st.results || !st.results.length, onclick: replaceAll })]),
        st.results ? el('div', { class: 'find-results' }, [el('div', { class: 'muted small', text: `${st.results.length} ocorrência(s)` })].concat(st.results.slice(0, 300).map(r => el('div', { class: 'find-row', onclick: () => App.setView('chapter', r.chapter.id) }, [
          el('span', { class: 'muted small', text: r.chapter.title + ': ' }), el('span', { text: '…' + r.before }), el('mark', { text: r.match }), el('span', { text: r.after + '…' })
        ])))) : null
      ]),
      el('div', { class: 'card' }, [
        el('h3', { text: 'Limpeza e consistência' }),
        el('p', { class: 'muted small', text: 'Problemas comuns vindos de manuscritos importados. Marque o que deseja corrigir; as correções podem ser desfeitas pelo Histórico. Capítulos bloqueados não são alterados.' }),
        el('table', { class: 'checks-table' }, [el('tbody', {}, checks.map(r => {
          const cb = el('input', { type: 'checkbox', checked: r.count > 0 && r.ch.on, disabled: !r.count });
          boxes[r.ch.id] = cb;
          return el('tr', { class: r.count ? '' : 'muted' }, [
            el('td', {}, [cb]),
            el('td', {}, [el('div', { text: r.ch.label }), r.samples.length ? el('div', { class: 'muted small', text: '“' + r.samples[0] + '”' }) : null]),
            el('td', { class: r.count ? 'warn' : 'good', text: r.count ? `${r.count}` : '✓' }),
            el('td', { class: 'muted small', text: r.chapters.slice(0, 3).join(', ') + (r.chapters.length > 3 ? '…' : '') })
          ]);
        }))]),
        el('div', { class: 'inline' }, [
          el('button', { class: 'primary', text: 'Aplicar correções marcadas…', onclick: () => applyFixes(Object.keys(boxes).filter(k => boxes[k].checked)) }),
          el('button', { text: 'Verificar novamente', onclick: render }),
          el('button', { text: 'Mostrar caracteres invisíveis no editor', onclick: () => { App.setView('chapter'); $('#editor').classList.add('show-invisibles'); } })
        ])
      ])
    ]));
  }

  App.hooks.viewRender.tools = render;
  App.tools = { find: () => { App.setView('tools'); setTimeout(() => { const i = $('#view-tools input[type=text]'); if (i) i.focus(); }, 50); } };
})();
