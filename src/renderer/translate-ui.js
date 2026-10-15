/* global App, BookText, PtBr */
// Tradução: livros (EPUB, DOCX, DOC, ODT…) de qualquer idioma para o português do Brasil, com padrão
// editorial. Etapas de cada livro (um após o outro, com registro ao vivo):
//  1. leitura e limpeza (avisos do Gutenberg, páginas pré/pós-textuais, sumário do arquivo) — igual ao Melhoramento;
//  2. tradução literária por trechos, com as diretrizes editoriais do sistema (OpenRouter, Google Gemini ou modelo local via Ollama),
//     glossário de nomes e o fim do trecho anterior para manter tom e coerência;
//  3. pós-edição local: diálogos com travessão, Novo Acordo Ortográfico, dicionário de estilo e pontuação;
//  4. DOCX no padrão do app na pasta Downloads; 5. relatório com parecer, mudanças e correções (salvável em PDF).
(function () {
  const { el, $, api } = App;
  const queue = []; // { path, name, status, out, msg, report }
  let running = false, stopAsked = false;
  let screen = null, logBox = null, listBox = null, reportBox = null, cfgBox = null, cfg = null, dlDir = '', liveLine = null;
  const EXT = /\.(epub|docx?|odt|rtf|txt|html?)$/i;
  const CHUNK_WORDS = 1600;
  const fmt = n => Number(n || 0).toLocaleString('pt-BR');
  const words = s => (String(s || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------------- registro
  function addLog(m, kind) {
    if (!logBox) return;
    if (liveLine) liveLine.remove();
    liveLine = null;
    logBox.appendChild(el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: new Date().toLocaleTimeString('pt-BR') }), el('span', { class: 'pg-m', text: m })]));
    logBox.scrollTop = logBox.scrollHeight;
  }
  function live(m) {
    if (!logBox) return;
    if (!liveLine) { liveLine = el('li', { class: 'live' }, [el('span', { class: 'pg-t', text: '…' }), el('span', { class: 'pg-m' })]); logBox.appendChild(liveLine); }
    liveLine.lastChild.textContent = m;
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ---------------------------------------------------------------- trechos para o tradutor
  // cada capítulo vira linhas de HTML simples (um bloco por linha); figuras viram [[FIG:n]]
  function chapterBlocks(c, figs) {
    const tpl = document.createElement('template');
    tpl.innerHTML = c.html;
    const lines = [];
    Array.from(tpl.content.childNodes).forEach(n => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) lines.push(`<p>${App.escape(n.nodeValue.trim())}</p>`); return; }
      if (n.nodeType !== 1) return;
      if (n.matches('figure, .fullbleed, hr, .page-break, img') || (!n.textContent.trim() && n.querySelector('img'))) { figs.push(n.outerHTML); lines.push(`[[FIG:${figs.length - 1}]]`); return; }
      if (!n.textContent.trim()) return;
      lines.push(n.outerHTML.replace(/\s*\n\s*/g, ' '));
    });
    return lines;
  }
  function chunks(lines) {
    const out = [];
    let cur = [], n = 0;
    lines.forEach(l => {
      const w = words(l.replace(/<[^>]+>/g, ' '));
      if (cur.length && n + w > CHUNK_WORDS) { out.push(cur); cur = []; n = 0; }
      cur.push(l); n += w;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  // uma chamada, com novas tentativas (limite de uso, conexão) e divisão do trecho se ficar longo demais
  async function translateLines(lines, ctx, depth) {
    for (let attempt = 0; ; attempt++) {
      if (stopAsked) throw new Error('interrompido');
      const id = Math.random().toString(36).slice(2);
      ctx.liveId = id;
      const r = await api.trChunk({ id, title: ctx.title, author: ctx.author, glossary: [...ctx.glossary.entries()].slice(-80), context: ctx.context, html: lines.join('\n'), first: ctx.first });
      if (!r || !r.error) { ctx.first = false; return r; }
      if (r.fatal) throw Object.assign(new Error(r.error), { fatal: true });
      if (r.tooLong && lines.length > 1 && (depth || 0) < 4) {
        ctx.log(`trecho longo: dividido em dois (${lines.length} blocos)`);
        const h = Math.ceil(lines.length / 2);
        const a = await translateLines(lines.slice(0, h), ctx, (depth || 0) + 1);
        const b = await translateLines(lines.slice(h), ctx, (depth || 0) + 1);
        return { body: a.body + '\n' + b.body, notes: a.notes.concat(b.notes), glossary: a.glossary.concat(b.glossary), lang: a.lang || b.lang, usage: { input_tokens: (a.usage.input_tokens || 0) + (b.usage.input_tokens || 0), output_tokens: (a.usage.output_tokens || 0) + (b.usage.output_tokens || 0) }, model: a.model, price: a.price };
      }
      if (r.refusal) { ctx.log(`aviso: ${r.error} O trecho fica no original para revisão.`, 'bad'); ctx.stats.refusals++; return { body: lines.join('\n'), notes: ['Trecho mantido no original (recusa do modelo) — revisar manualmente.'], glossary: [], usage: {}, refused: true }; }
      if (attempt >= 5) throw new Error(r.error);
      const delay = [5, 15, 30, 60, 120][attempt] * 1000;
      ctx.log(`${r.error} Nova tentativa em ${delay / 1000} s…`, 'bad');
      await wait(delay);
    }
  }

  // volta as linhas traduzidas para HTML do capítulo (figuras de volta no lugar)
  function rebuild(body, figs, expected) {
    const got = String(body || '').split('\n').map(l => l.trim()).filter(Boolean);
    const used = new Set();
    const html = got.map(l => {
      const m = /^\[\[FIG:(\d+)\]\]$/.exec(l);
      if (m) { used.add(Number(m[1])); return figs[Number(m[1])] || ''; }
      if (!/^</.test(l)) return `<p>${App.escape(l)}</p>`;
      return l;
    });
    // figura que o modelo deixou de devolver: volta no fim do trecho
    expected.forEach(l => { const m = /^\[\[FIG:(\d+)\]\]$/.exec(l); if (m && !used.has(Number(m[1]))) html.push(figs[Number(m[1])]); });
    return { html: html.join(''), mismatch: got.length !== expected.length };
  }

  // ---------------------------------------------------------------- pós-edição local
  function postEdit(html, st) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const add = (map, rules) => rules.forEach(r => { map[r] = (map[r] || 0) + 1; });
    // diálogos: parágrafos que começam com aspas (ou hífen) passam a usar travessão
    tpl.content.querySelectorAll('p, li').forEach(p => {
      if (p.closest('figure')) return;
      const simple = !p.querySelector('*:not(em):not(i):not(strong):not(b)') && p.children.length === 0;
      const txt = p.textContent;
      if (!/^\s*[“"«„\-–—]/.test(txt)) return;
      if (simple) {
        const r = PtBr.dialogue(txt, { glue: cfg.glue !== false });
        if (r.changed) { p.textContent = r.text; st.dialogues++; }
      } else {
        // com marcações dentro: só o travessão de abertura (o resto fica como está)
        const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        const first = tw.nextNode();
        if (first && /^\s*[“"«„\-–]/.test(first.nodeValue)) { first.nodeValue = first.nodeValue.replace(/^\s*[“"«„\-–]\s*/, cfg.glue !== false ? PtBr.EM : PtBr.EM + ' '); st.dialogues++; }
      }
    });
    // ortografia, dicionário e pontuação, nó de texto por nó de texto (marcações intactas)
    const tw = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = tw.nextNode())) if (!n.parentElement.closest('figure, code, pre')) nodes.push(n);
    nodes.forEach(t => {
      let v = t.nodeValue;
      const o = PtBr.orthography(v); v = o.text; add(st.ortho, o.hits);
      const d = PtBr.dictionary(v); v = d.text; add(st.dict, d.hits);
      const p = PtBr.punctuation(v); v = p.text; add(st.punct, p.hits);
      if (v !== t.nodeValue) t.nodeValue = v;
    });
    return tpl.innerHTML;
  }

  // ---------------------------------------------------------------- um livro
  async function processOne(item) {
    const log = (m, k) => addLog(`${item.name} — ${m}`, k);
    item.status = 'run'; renderList();
    const t0 = Date.now();
    const st = { dialogues: 0, ortho: {}, dict: {}, punct: {}, refusals: 0, mismatches: 0, chunks: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
    const cleaning = [];
    const { proj } = await App.enhance.loadBook(item.path, item.name, (m, k) => { cleaning.push(m.replace(/^·\s*/, '')); log(m, k); }, { images: $('#trImages').checked, allowAny: true });
    const srcWords = proj.chapters.reduce((s, c) => s + BookText.countWords(c.html), 0);
    const ctx = { title: proj.meta.title, author: proj.meta.author, glossary: new Map(), context: '', first: true, log, stats: st };
    const notes = [];
    let lang = '';
    const totalChunks = proj.chapters.reduce((s, c) => s + chunks(chapterBlocks(c, [])).length, 0);
    log(`${proj.chapters.length} capítulo(s) · ${fmt(srcWords)} palavras · ${totalChunks} trecho(s) para traduzir (${engineName(cfg)})`);
    const origTitle = proj.meta.title;
    let done = 0;
    for (let ci = 0; ci < proj.chapters.length; ci++) {
      const c = proj.chapters[ci];
      const figs = [];
      const lines = chapterBlocks(c, figs);
      const parts = chunks(lines);
      let out = '';
      for (let k = 0; k < parts.length; k++) {
        let send = parts[k];
        if (k === 0) send = [`<h1>${App.escape(c.title || '')}</h1>`].concat(send);
        if (ci === 0 && k === 0) send = [`<p class="titulo-do-livro">${App.escape(origTitle)}</p>`].concat(send);
        live(`capítulo ${ci + 1}/${proj.chapters.length} · trecho ${done + 1}/${totalChunks} · traduzindo…`);
        const r = await translateLines(send, ctx);
        done++; st.chunks++;
        st.tokensIn += Number((r.usage || {}).input_tokens || 0) + Number((r.usage || {}).cache_read_input_tokens || 0) + Number((r.usage || {}).cache_creation_input_tokens || 0);
        st.tokensOut += Number((r.usage || {}).output_tokens || 0);
        if (r.price) st.cost += (Number((r.usage || {}).input_tokens || 0) * r.price.in + Number((r.usage || {}).output_tokens || 0) * r.price.out) / 1e6;
        if (r.lang && !lang) lang = r.lang;
        (r.notes || []).forEach(x => notes.push(`Cap. ${ci + 1}: ${x}`));
        (r.glossary || []).forEach(([a, b]) => ctx.glossary.set(a, b));
        let body = r.body || '';
        // título do livro e do capítulo traduzidos
        body = body.replace(/^<p class="titulo-do-livro">([\s\S]*?)<\/p>\s*$/m, (m, t) => { proj.meta.title = t.replace(/<[^>]+>/g, '').trim() || proj.meta.title; return ''; });
        if (k === 0) body = body.replace(/^<h1[^>]*>([\s\S]*?)<\/h1>\s*$/m, (m, t) => { c.title = t.replace(/<[^>]+>/g, '').trim() || c.title; return ''; });
        const rb = rebuild(body, figs, parts[k]);
        if (rb.mismatch) st.mismatches++;
        out += rb.html;
        // fim do trecho para dar continuidade ao próximo
        const tmp = document.createElement('div'); tmp.innerHTML = rb.html;
        ctx.context = Array.from(tmp.querySelectorAll('p')).slice(-2).map(p => p.textContent).join('\n').slice(-900);
        log(`trecho ${done}/${totalChunks} traduzido${r.refused ? ' (mantido no original)' : ''}${r.usage && r.usage.output_tokens ? ` · ${fmt(r.usage.output_tokens)} tokens` : ''}`);
      }
      c.html = postEdit(out, st);
      c.title = PtBr.punctuation(PtBr.orthography(c.title).text).text;
    }
    proj.meta.language = 'pt-BR';
    proj.meta.originalTitle = origTitle;
    const allText = proj.chapters.map(c => { const d = document.createElement('div'); d.innerHTML = c.html; return d.textContent; }).join('\n');
    const outWords = words(allText);
    const read = PtBr.readability(allText);
    const reps = PtBr.repetitions(allText).slice(0, 12);
    log(`pós-edição: ${st.dialogues} diálogo(s) com travessão · ${Object.values(st.ortho).reduce((a, b) => a + b, 0)} ajuste(s) ortográfico(s) · ${Object.values(st.dict).reduce((a, b) => a + b, 0)} de estilo · ${Object.values(st.punct).reduce((a, b) => a + b, 0)} de pontuação`);
    item.out = await App.enhance.saveDocx(proj, log, ' (pt-BR)');
    const stats = {
      capitulos: proj.chapters.length, palavrasOriginal: srcWords, palavrasTraducao: outWords, variacao: srcWords ? Math.round((outWords / srcWords - 1) * 100) : 0,
      trechos: st.chunks, dialogos: st.dialogues, ortografia: st.ortho, estilo: st.dict, pontuacao: st.punct, legibilidade: read,
      recusas: st.refusals, blocosDivergentes: st.mismatches, tempoMin: +((Date.now() - t0) / 60000).toFixed(1)
    };
    live('escrevendo o parecer editorial…');
    let rep = await api.trReport({ title: proj.meta.title, author: proj.meta.author, lang, stats, notes });
    if (!rep || rep.error || !rep.parecer) rep = localReport(stats, rep && rep.error);
    item.report = {
      file: item.path, out: item.out, title: proj.meta.title, originalTitle: origTitle, author: proj.meta.author, lang: lang || 'não identificado',
      engine: engineName(cfg) + (cfg.effective === 'gtrans' || cfg.effective === 'offline' ? ' + correções do sistema' : ''),
      date: new Date().toLocaleString('pt-BR'), stats, cleaning: cleaning.filter(x => /removid|mantid|capítulo|nota/i.test(x)), notes, glossary: [...ctx.glossary.entries()], reps,
      tokens: { in: st.tokensIn, out: st.tokensOut, cost: st.cost }, parecer: rep.parecer, changes: rep.changes || [], corrections: rep.corrections || []
    };
    item.status = 'ok';
    addLog(`${item.name} — concluído em ${stats.tempoMin.toString().replace('.', ',')} min · ${fmt(outWords)} palavras em português · legibilidade ${read.flesch}/100 (${read.level})`, 'ok');
  }
  // parecer sem o modelo (simulação ou falha): montado a partir dos números
  function localReport(s, err) {
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`);
    return {
      parecer: `Tradução concluída em ${s.capitulos} capítulo(s), com ${fmt(s.palavrasTraducao)} palavras (${s.variacao >= 0 ? '+' : ''}${s.variacao}% em relação ao original). A pós-edição local padronizou ${s.dialogos} diálogo(s) com travessão e aplicou ${sum(s.ortografia)} ajuste(s) do Novo Acordo Ortográfico, ${sum(s.estilo)} de estilo e ${sum(s.pontuacao)} de pontuação. Índice de legibilidade: ${s.legibilidade.flesch}/100 (${s.legibilidade.level}), média de ${s.legibilidade.avgSentence} palavras por frase.${err ? ' (Parecer automático indisponível: ' + err + ')' : ''}`,
      changes: ['Tradução literária com adaptação de expressões idiomáticas e referências culturais', 'Diálogos no padrão brasileiro, com travessão', `Variação de extensão: ${s.variacao}%`],
      corrections: top(s.ortografia).concat(top(s.estilo), top(s.pontuacao)).slice(0, 8)
    };
  }

  async function start() {
    if (running) return;
    const todo = queue.filter(q => q.status === 'wait' || q.status === 'err');
    if (!todo.length) return App.toast('Envie um ou mais livros (EPUB, DOCX ou DOC).');
    cfg = await api.trConfig();
    // sem a chave do motor escolhido, a tradução segue pelo Google Tradutor (gratuito, sem chave)
    if (cfg.provider === 'claude' && !cfg.hasKey) { App.toast('Informe a chave da API da Anthropic em Configurações da tradução (ou escolha Ollama, local).', 6000); return; }
    // conexão conferida antes da fila (chave errada ou sem internet não vira minutos de novas tentativas)
    const t = await api.trTest();
    if (!t.ok) { addLog('Não foi possível conectar ao motor de tradução: ' + t.msg, 'bad'); App.toast('Conexão com o motor de tradução falhou — veja o registro.', 5000); return; }
    addLog('Motor de tradução: ' + t.msg, 'ok');
    running = true; stopAsked = false;
    renderControls();
    const t0 = Date.now();
    addLog(`Início: ${todo.length} livro(s) · saída em ${dlDir}`);
    let ok = 0;
    for (const item of todo) {
      if (stopAsked) break;
      try { await processOne(item); ok++; } catch (e) {
        item.status = 'err'; item.msg = String(e.message || e); addLog(`${item.name} — erro: ${item.msg}`, 'bad');
        if (e.fatal) { addLog('Fila interrompida: corrija a configuração e clique em Iniciar de novo.', 'bad'); renderList(); break; }
      }
      renderList();
      const last = queue.filter(q => q.report).pop();
      if (last) showReport(last);
    }
    running = false;
    addLog(`Fim: ${ok} de ${todo.length} livro(s) traduzido(s) em ${((Date.now() - t0) / 60000).toFixed(1).replace('.', ',')} min`, ok === todo.length ? 'ok' : 'bad');
    renderControls();
    if (ok && $('#trOpen').checked) { const last = todo.filter(x => x.out).pop(); if (last) api.showItem(last.out); }
  }

  // ---------------------------------------------------------------- relatório (tela e PDF)
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const rows = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
  function showReport(item) {
    if (!reportBox || !item.report) return;
    const r = item.report, s = r.stats;
    setTab('report');
    reportBox.innerHTML = '';
    const stat = (v, l) => el('div', { class: 'tr-stat' }, [el('b', { text: v }), el('span', { text: l })]);
    reportBox.append(
      el('div', { class: 'tr-rep-head' }, [
        el('div', {}, [el('h2', { text: r.title }), el('p', { class: 'muted small', text: `${r.originalTitle !== r.title ? 'Original: ' + r.originalTitle + ' · ' : ''}${r.author || ''} · ${r.lang} → português do Brasil` })]),
        el('div', { class: 'tr-rep-btns' }, [
          el('button', { class: 'primary', text: '⤓ Salvar (PDF)', onclick: () => savePdf(item) }),
          el('button', { text: '📂 Ver o DOCX', onclick: () => api.showItem(r.out) })
        ])
      ]),
      el('div', { class: 'tr-stats' }, [
        stat(fmt(s.palavrasTraducao), 'palavras traduzidas'), stat(s.capitulos, 'capítulos'), stat((s.variacao >= 0 ? '+' : '') + s.variacao + '%', 'extensão vs. original'),
        stat(s.legibilidade.flesch + '/100', 'legibilidade (' + s.legibilidade.level + ')'), stat(s.dialogos, 'diálogos com travessão'), stat(sum(s.ortografia) + sum(s.estilo) + sum(s.pontuacao), 'correções locais')
      ]),
      card('Parecer sobre a tradução', [el('p', { class: 'tr-parecer', text: r.parecer })]),
      card('Principais mudanças', [el('ul', {}, r.changes.map(x => el('li', { text: x })))]),
      card('Principais correções aplicadas', [el('ul', {}, r.corrections.map(x => el('li', { text: x })))]),
      card('Tudo o que foi feito', [el('ul', {}, [
        `Arquivo: ${r.file.split(/[\\/]/).pop()} → ${r.out.split(/[\\/]/).pop()} (pasta Downloads)`,
        ...r.cleaning.map(x => 'Limpeza: ' + x),
        `Tradução: ${r.engine} · ${s.trechos} trecho(s)${r.tokens.in ? ` · ${fmt(r.tokens.in)} tokens de entrada e ${fmt(r.tokens.out)} de saída` : ''}${r.tokens.cost ? ` · custo estimado US$ ${r.tokens.cost.toFixed(2)}` : ''}`,
        `Diálogos convertidos para travessão: ${s.dialogos}`,
        `Novo Acordo Ortográfico: ${sum(s.ortografia)} ajuste(s)`, `Dicionário de estilo (pleonasmos, falsos cognatos, possessivos): ${sum(s.estilo)} ajuste(s)`, `Pontuação editorial: ${sum(s.pontuacao)} ajuste(s)`,
        `Frases longas (mais de 45 palavras) para conferir: ${s.legibilidade.longSentences} · média de ${s.legibilidade.avgSentence} palavras por frase`,
        s.recusas ? `Trechos mantidos no original para revisão: ${s.recusas}` : null,
        `Tempo total: ${String(s.tempoMin).replace('.', ',')} min`
      ].filter(Boolean).map(x => el('li', { text: x })))]),
      rows(Object.assign({}, s.ortografia, s.estilo, s.pontuacao)).length ? card('Correções por regra', [el('table', { class: 'tr-table' }, rows(Object.assign({}, s.ortografia, s.estilo, s.pontuacao)).map(([k, v]) => el('tr', {}, [el('td', { text: k }), el('td', { text: String(v) })])))]) : null,
      r.reps.length ? card('Repetições próximas para conferir', [el('p', { class: 'small muted', text: r.reps.map(([w, n]) => `${w} (${n})`).join(' · ') })]) : null,
      r.glossary.length ? card('Glossário de nomes e termos', [el('p', { class: 'small', text: r.glossary.map(([a, b]) => `${a} → ${b}`).join(' · ') })]) : null,
      r.notes.length ? card(`Notas editoriais do tradutor (${r.notes.length})`, [el('ul', { class: 'tr-notes' }, r.notes.slice(0, 200).map(x => el('li', { text: x })))]) : null
    );
  }
  const card = (t, kids) => el('div', { class: 'tr-card' }, [el('h3', { text: t })].concat(kids));

  const LOGO = '<svg viewBox="0 0 512 512" width="44" height="44"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d28d9"/><stop offset=".55" stop-color="#c026d3"/><stop offset="1" stop-color="#f43f5e"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="22"><path d="M106 262 L256 136 L406 262"/><path d="M160 222 V372 H352 V222"/><path d="M232 372 V318 A24 24 0 0 1 280 318 V372"/><path d="M318 186 V150 H342 V206"/></g></svg>';
  function pdfHtml(r) {
    const e = App.escape, s = r.stats;
    const li = a => a.map(x => `<li>${e(x)}</li>`).join('');
    const corr = rows(Object.assign({}, s.ortografia, s.estilo, s.pontuacao));
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de tradução</title><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font: 10.5pt/1.55 Georgia, 'Times New Roman', serif; color: #1d1a26; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { padding: 20mm 20mm 18mm; }
.bar { height: 5mm; background: linear-gradient(90deg, #6d28d9, #c026d3, #f43f5e); }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 9mm; }
.brand { font: 600 9pt/1.2 'Helvetica Neue', Arial, sans-serif; letter-spacing: .32em; }
.brand b { color: #c026d3; font-weight: 700; }
.kind { font: 8pt 'Helvetica Neue', Arial, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #8a8398; margin-top: 3px; }
h1 { font-weight: 400; font-size: 24pt; line-height: 1.15; margin: 0 0 2mm; }
.sub { color: #6b6478; font-style: italic; margin: 0 0 7mm; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin: 0 0 8mm; }
.st { border: 0.6pt solid #e4def0; border-radius: 3mm; padding: 3.2mm 4mm; }
.st b { display: block; font: 600 15pt 'Helvetica Neue', Arial, sans-serif; color: #6d28d9; }
.st span { font: 7.5pt 'Helvetica Neue', Arial, sans-serif; color: #8a8398; letter-spacing: .06em; text-transform: uppercase; }
h2 { font: 600 8pt 'Helvetica Neue', Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #c026d3; margin: 7mm 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 0.6pt solid #eee8f6; }
p { margin: 0 0 2mm; text-align: justify; }
ul { margin: 0; padding-left: 5mm; } li { margin: 0 0 1.2mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
td { padding: 1.4mm 0; border-bottom: 0.4pt solid #f0ebf7; } td:last-child { text-align: right; color: #6d28d9; font-family: 'Helvetica Neue', Arial, sans-serif; }
.notes li { font-size: 9pt; color: #3d3748; }
footer { margin-top: 10mm; padding-top: 3mm; border-top: 0.6pt solid #eee8f6; font: 7.5pt 'Helvetica Neue', Arial, sans-serif; color: #8a8398; display: flex; justify-content: space-between; }
h2, .st { break-inside: avoid; } li { break-inside: avoid; }
</style></head><body><div class="bar"></div><div class="page">
<header>${LOGO}<div><div class="brand">CASA VERTIGEM <b>HUB</b></div><div class="kind">Relatório de tradução</div></div></header>
<h1>${e(r.title)}</h1>
<p class="sub">${r.originalTitle !== r.title ? 'Título original: ' + e(r.originalTitle) + ' · ' : ''}${e(r.author || '')} · ${e(r.lang)} → português do Brasil · ${e(r.date)}</p>
<div class="grid">
<div class="st"><b>${fmt(s.palavrasTraducao)}</b><span>palavras traduzidas</span></div>
<div class="st"><b>${s.capitulos}</b><span>capítulos</span></div>
<div class="st"><b>${s.variacao >= 0 ? '+' : ''}${s.variacao}%</b><span>extensão vs. original</span></div>
<div class="st"><b>${s.legibilidade.flesch}/100</b><span>legibilidade · ${e(s.legibilidade.level)}</span></div>
<div class="st"><b>${s.dialogos}</b><span>diálogos com travessão</span></div>
<div class="st"><b>${sum(s.ortografia) + sum(s.estilo) + sum(s.pontuacao)}</b><span>correções locais</span></div>
</div>
<h2>Parecer</h2><p>${e(r.parecer)}</p>
<h2>Principais mudanças</h2><ul>${li(r.changes)}</ul>
<h2>Principais correções aplicadas</h2><ul>${li(r.corrections)}</ul>
<h2>Processamento</h2><ul>${li([`Arquivo de origem: ${r.file.split(/[\\/]/).pop()}`, `Arquivo gerado: ${r.out.split(/[\\/]/).pop()} (DOCX no padrão do sistema)`, ...r.cleaning, `Motor de tradução: ${r.engine} · ${s.trechos} trecho(s)`, r.tokens.in ? `Tokens: ${fmt(r.tokens.in)} de entrada · ${fmt(r.tokens.out)} de saída${r.tokens.cost ? ' · custo estimado US$ ' + r.tokens.cost.toFixed(2) : ''}` : '', `Frases com mais de 45 palavras: ${s.legibilidade.longSentences} · média de ${s.legibilidade.avgSentence} palavras por frase`, s.recusas ? `Trechos mantidos no original para revisão: ${s.recusas}` : '', `Tempo total: ${String(s.tempoMin).replace('.', ',')} min`].filter(Boolean))}</ul>
${corr.length ? `<h2>Correções por regra</h2><table>${corr.map(([k, v]) => `<tr><td>${e(k)}</td><td>${v}</td></tr>`).join('')}</table>` : ''}
${r.glossary.length ? `<h2>Glossário</h2><p>${r.glossary.map(([a, b]) => `${e(a)} → ${e(b)}`).join(' · ')}</p>` : ''}
${r.notes.length ? `<h2>Notas editoriais</h2><ul class="notes">${li(r.notes.slice(0, 300))}</ul>` : ''}
<footer><span>Casa Vertigem Hub · tradução e preparação de textos</span><span>${e(r.date)}</span></footer>
</div></body></html>`;
  }
  async function savePdf(item, target) {
    const f = await api.trSavePdf(pdfHtml(item.report), `Relatório da tradução — ${item.report.title}`, target);
    if (f) { App.toast('Relatório salvo: ' + f.split(/[\\/]/).pop(), 4000); if (!target) api.showItem(f); }
    return f;
  }

  // ---------------------------------------------------------------- configurações
  async function renderConfig() {
    cfg = await api.trConfig();
    cfgBox.innerHTML = '';
    const prov = el('select', {}, [['openrouter', 'OpenRouter — principal: modelos gratuitos (NVIDIA Nemotron 3 Ultra), precisa de internet'], ['google', 'Google Gemini — cota gratuita do Google AI Studio, precisa de internet'], ['gtrans', 'Google Tradutor — gratuito, sem chave (precisa de internet; sem ela, usa o motor offline)'], ['offline', 'Offline — motor no próprio computador, sem internet'], ['ollama', 'Ollama — modelo local, funciona sem internet']].concat(cfg.mock ? [['mock', 'Simulação (teste)']] : []).map(([v, t]) => el('option', { value: v, text: t, selected: cfg.provider === v })));
    const key = el('input', { type: 'password', placeholder: cfg.hasKey ? `chave salva (${cfg.keyHint})` : 'sk-ant-…', autocomplete: 'off' });
    const model = el('select', {}, cfg.models.map(m => el('option', { value: m.id, text: m.name, selected: cfg.model === m.id })));
    const effort = el('select', {}, [['medium', 'Médio — mais rápido'], ['high', 'Alto — recomendado para literatura'], ['xhigh', 'Muito alto — máximo cuidado']].map(([v, t]) => el('option', { value: v, text: t, selected: cfg.effort === v })));
    const ourl = el('input', { type: 'text', value: cfg.ollamaUrl });
    const omodel = el('input', { type: 'text', value: cfg.ollamaModel, placeholder: 'ex.: qwen2.5:14b, llama3.1:8b, gemma2:9b' });
    const orKey = el('input', { type: 'password', placeholder: cfg.hasOrKey ? `chave salva (${cfg.orKeyHint})` : 'sk-or-v1-…', autocomplete: 'off' });
    const orModel = el('input', { type: 'text', value: cfg.orModel, placeholder: 'nvidia/nemotron-3-ultra-550b-a55b:free' });
    const ggKey = el('input', { type: 'password', placeholder: cfg.hasGgKey ? `chave salva (${cfg.ggKeyHint})` : 'AIza…', autocomplete: 'off' });
    const ggModel = el('input', { type: 'text', value: cfg.ggModel, placeholder: 'gemini-2.5-flash' });
    const glue = el('input', { type: 'checkbox', checked: cfg.glue !== false });
    const aiRev = el('input', { type: 'checkbox', checked: cfg.aiReview !== false });
    const status = el('span', { class: 'small muted' });
    const save = async () => {
      const patch = { provider: prov.value, model: model.value, effort: effort.value, ollamaUrl: ourl.value.trim(), ollamaModel: omodel.value.trim(), orModel: orModel.value.trim() || undefined, ggModel: ggModel.value.trim() || undefined, aiReview: aiRev.checked, glue: glue.checked };
      if (key.value.trim()) patch.apiKey = key.value.trim();
      if (orKey.value.trim()) patch.orKey = orKey.value.trim();
      if (ggKey.value.trim()) patch.ggKey = ggKey.value.trim();
      cfg = await api.trSetConfig(patch);
      key.value = ''; orKey.value = ''; ggKey.value = '';
      status.textContent = 'Salvo.';
      renderConfig();
    };
    const isClaude = cfg.provider === 'claude';
    prov.addEventListener('change', async () => { cfg = await api.trSetConfig({ provider: prov.value }); renderConfig(); });
    cfgBox.append(
      el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Motor de tradução' }), prov]),
      isClaude ? el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Chave da API da Anthropic' }), key, el('span', { class: 'small muted', text: 'Guardada criptografada neste computador. Crie em console.anthropic.com.' })]) : null,
      isClaude ? el('div', { class: 'tr-cfg-2' }, [el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Modelo' }), model]), el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Esforço' }), effort])]) : null,
      cfg.provider === 'openrouter' ? el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Chave da API do OpenRouter' }), orKey, el('span', { class: 'small muted', text: 'Gratuita: entre em openrouter.ai, abra Keys e crie uma chave. Ela fica guardada criptografada neste computador.' })]) : null,
      cfg.provider === 'openrouter' ? el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Modelo' }), orModel, el('span', { class: 'small muted', text: 'Padrão: NVIDIA Nemotron 3 Ultra (gratuito). Os modelos gratuitos têm limite de pedidos por minuto e por dia; quando o limite chega, o tradutor espera e continua sozinho. O texto do livro é enviado ao OpenRouter e ao provedor do modelo.' })]) : null,
      cfg.provider === 'google' ? el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Chave da API do Google Gemini' }), ggKey, el('span', { class: 'small muted', text: 'Entre em aistudio.google.com/apikey com a sua conta Google e crie uma chave (há cota gratuita). Ela fica guardada criptografada neste computador.' })]) : null,
      cfg.provider === 'google' ? el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Modelo' }), ggModel, el('span', { class: 'small muted', text: 'Padrão: Gemini 2.5 Flash. O “Testar conexão” lista os modelos disponíveis para a sua chave, se este não estiver. Na cota gratuita há limite de pedidos por minuto e por dia (o tradutor espera e continua sozinho) e o Google pode usar o texto enviado para melhorar os seus produtos.' })]) : null,
      cfg.provider === 'ollama' ? el('div', { class: 'tr-cfg-2' }, [el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Endereço do Ollama' }), ourl]), el('div', { class: 'tr-cfg-row' }, [el('label', { class: 'flabel', text: 'Modelo instalado' }), omodel])]) : null,
      cfg.provider === 'ollama' ? el('p', { class: 'small muted', text: 'Instale o Ollama (ollama.com) e um modelo multilíngue (ex.: “ollama pull qwen2.5:14b”). Tudo roda no seu computador; a qualidade depende do modelo escolhido.' }) : null,
      cfg.effective === 'gtrans' ? el('p', { class: 'small ' + (cfg.provider === 'gtrans' ? 'muted' : 'warn'), text: (cfg.provider === 'gtrans' ? '' : 'Sem a chave do motor escolhido, a tradução usa o Google Tradutor (gratuito). ') + 'O Google faz a tradução bruta, bloco a bloco (títulos, ênfases e notas preservados); depois ' + (cfg.hasOrKey || cfg.hasGgKey ? 'a IA (' + (cfg.hasOrKey ? 'OpenRouter' : 'Gemini') + ') revisa sentido, coesão, coerência e estilo, e ' : '') + 'o sistema aplica travessões, Novo Acordo Ortográfico, dicionário de estilo e pontuação.' }) : null,
      cfg.effective === 'offline' ? el('p', { class: 'small muted', text: 'O motor offline traduz frase a frase no próprio computador, sem enviar nada para a internet. Antes, as expressões idiomáticas são reescritas em linguagem literal e os trechos que existem nos livros de referência usam a tradução aprovada; depois, os nomes seguem o glossário' + (cfg.hasOrKey || cfg.hasGgKey ? ', a IA revisa sentido, coesão e estilo (quando houver internet)' : '') + ' e o sistema aplica travessões, Novo Acordo Ortográfico, dicionário de estilo e pontuação.' }) : null,
      cfg.effective === 'gtrans' || cfg.effective === 'offline' ? el('label', { class: 'chk' }, [aiRev, ' Revisar a tradução automática com IA (usa a chave do OpenRouter ou do Gemini, se houver)']) : null,
      el('label', { class: 'chk' }, [glue, ' Travessão colado na fala (—Olá — disse ele.)']),
      el('div', { class: 'inline wrap' }, [el('button', { class: 'primary', text: 'Salvar configurações', onclick: save }), el('button', { text: 'Testar conexão', onclick: async () => { await save(); status.textContent = 'Testando…'; const t = await api.trTest(); status.textContent = (t.ok ? '✓ ' : '✕ ') + t.msg; status.className = 'small ' + (t.ok ? 'good' : 'bad'); } }), status]),
      offlineCard(), refsCard()
    );
  }

  // ---------------------------------------------------------------- motor offline
  function offlineCard() {
    const box = el('div', { class: 'tr-sub' });
    const draw = async () => {
      const st = await api.mtStatus();
      box.innerHTML = '';
      const bar = el('div', { class: 'upd-bar', style: { display: 'none' } }, [el('i')]);
      const msg = el('p', { class: 'small ' + (st.installed ? 'good' : 'muted'), text: st.installed ? '✓ Motor offline pronto. A tradução funciona sem internet: escolha “Offline” acima, ou deixe no Google Tradutor — sem internet, ele usa o motor offline sozinho.' : 'Baixe um motor uma vez (precisa de internet só agora) para traduzir sem internet. Ele também entra sozinho quando o Google Tradutor não responde.' });
      const rows = st.models.map(m => {
        const radio = el('input', { type: 'radio', name: 'mtModel', checked: st.selected === m.key });
        radio.addEventListener('change', async () => { await api.mtSelect(m.key); cfg = await api.trConfig(); draw(); });
        const btn = el('button', { class: m.installed ? 'ghost' : (st.selected === m.key ? 'primary' : ''), text: m.installed ? 'Remover' : `⬇ Baixar (~${m.mb} MB)` });
        btn.addEventListener('click', async () => {
          if (m.installed) {
            if ((await api.confirm('Remover este motor offline?', `Libera cerca de ${m.sizeMb || m.mb} MB. Para usá-lo de novo, será preciso baixá-lo outra vez.`, ['Remover', 'Cancelar'])) !== 0) return;
            await api.mtRemove(m.key); cfg = await api.trConfig(); return draw();
          }
          box.querySelectorAll('button').forEach(b => { b.disabled = true; });
          bar.style.display = ''; msg.className = 'small'; msg.textContent = 'Baixando o motor offline…';
          const off = api.onMtProgress(p => { bar.firstChild.style.width = Math.round(p.ratio * 100) + '%'; msg.textContent = `Baixando o motor offline… ${Math.round(p.ratio * 100)}% (${(p.received / 1048576).toFixed(0)} de ${(p.total / 1048576).toFixed(0)} MB)`; });
          const r = await api.mtInstall(m.key);
          off();
          if (!r || r.error) { msg.className = 'small bad'; msg.textContent = '✕ ' + ((r && r.error) || 'falha no download') + ' Clique de novo para continuar de onde parou.'; box.querySelectorAll('button').forEach(b => { b.disabled = false; }); return; }
          cfg = await api.trConfig();
          draw();
        });
        return el('div', { class: 'tr-model' }, [el('label', { class: 'chk' }, [radio, ' ', el('b', { text: m.name.split(' (')[0] }), el('small', { class: 'muted', text: ' — ' + m.name.split(' (').slice(1).join(' (').replace(/\)$/, '') + (m.installed ? ' · baixado' : '') })]), btn]);
      });
      box.append(el('h4', { text: 'Tradução offline (sem internet)' }), msg, ...rows, bar,
        el('p', { class: 'small muted', text: 'M2M100 pode ser usado em livros comerciais (licença MIT). NLLB-200 traduz melhor, mas a licença dele (CC-BY-NC 4.0) só permite uso não comercial. Os dois são da Meta e rodam no seu computador.' }));
    };
    draw();
    return box;
  }

  // ---------------------------------------------------------------- livros de referência (memória de tradução)
  // parágrafos de cada capítulo (texto), na ordem do livro
  function bookParagraphs(proj) {
    return proj.chapters.map(c => {
      const d = document.createElement('div');
      d.innerHTML = c.html;
      d.querySelectorAll('.footnote, figure, table').forEach(x => x.remove());
      const out = (c.title ? [c.title] : []).concat(Array.from(d.querySelectorAll('p, h1, h2, h3, h4, li, blockquote')).filter(x => !x.querySelector('p, li')).map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      return out.filter(x => x.length > 1);
    }).filter(c => c.length);
  }
  async function addReference(onDone) {
    const pick = async label => { const r = await api.trPick(); return r && r[0] ? r[0] : null; };
    const st = el('p', { class: 'small muted', text: 'Escolha o livro no idioma original e a tradução publicada em português (EPUB, DOCX, DOC ou ODT). O sistema alinha os dois parágrafo a parágrafo e aprende o jeito de traduzir: frases idênticas passam a usar a tradução aprovada, os nomes seguem o glossário e a revisão por IA recebe exemplos parecidos com cada trecho.' });
    const srcBtn = el('button', { text: '1. Livro original…' }), tgtBtn = el('button', { text: '2. Tradução em português…' });
    const name = el('input', { type: 'text', placeholder: 'Nome da referência (ex.: O Mágico de Oz — trad. da editora)' });
    let src = null, tgt = null;
    srcBtn.addEventListener('click', async () => { const f = await pick(); if (f) { src = f; srcBtn.textContent = '1. ' + f.split(/[\\/]/).pop(); if (!name.value) name.value = f.split(/[\\/]/).pop().replace(EXT, ''); } });
    tgtBtn.addEventListener('click', async () => { const f = await pick(); if (f) { tgt = f; tgtBtn.textContent = '2. ' + f.split(/[\\/]/).pop(); } });
    App.modal({
      title: 'Adicionar livro de referência',
      body: el('div', { class: 'settings-modal' }, [st, el('div', { class: 'inline wrap' }, [srcBtn, tgtBtn]), name]),
      buttons: [{ label: 'Cancelar' }, { label: 'Adicionar', primary: true, onClick: async () => {
        if (!src || !tgt) { App.toast('Escolha os dois arquivos.'); return false; }
        App.toast('Lendo e alinhando os dois livros…', 4000);
        try {
          const quiet = () => {};
          const a = await App.enhance.loadBook(src, src.split(/[\\/]/).pop(), quiet, { images: false, allowAny: true });
          const b = await App.enhance.loadBook(tgt, tgt.split(/[\\/]/).pop(), quiet, { images: false, allowAny: true });
          const r = await api.tmAdd({ name: name.value.trim(), srcName: src.split(/[\\/]/).pop(), tgtName: tgt.split(/[\\/]/).pop(), src: bookParagraphs(a.proj), tgt: bookParagraphs(b.proj) });
          if (!r || r.error) { App.toast('✕ ' + ((r && r.error) || 'não foi possível adicionar'), 6000); return; }
          addLog(`Referência adicionada: ${name.value.trim() || r.id} · ${fmt(r.pairs)} trechos alinhados${r.glossary.length ? ' · glossário: ' + r.glossary.slice(0, 8).map(g => g[0] + ' → ' + g[1]).join(', ') : ''}`, 'ok');
          (r.sample || []).forEach(([x, y]) => addLog(`  exemplo: “${x.slice(0, 90)}” → “${y.slice(0, 90)}”`));
          if (onDone) onDone();
        } catch (e) { App.toast('✕ ' + String(e.message || e), 6000); }
      } }]
    });
  }
  function refsCard() {
    const box = el('div', { class: 'tr-sub' });
    const draw = async () => {
      const l = await api.tmList();
      box.innerHTML = '';
      const use = el('input', { type: 'checkbox', checked: l.use });
      use.addEventListener('change', async () => { await api.tmOptions({ use: use.checked }); });
      const gl = el('textarea', { rows: 4, placeholder: 'Glossário próprio, um termo por linha:\nToto = Totó\nEmerald City = Cidade das Esmeraldas', value: l.glossary || '' });
      gl.value = l.glossary || '';
      let t = null;
      gl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => api.tmOptions({ glossary: gl.value }), 600); });
      box.append(
        el('h4', { text: 'Livros de referência (memória de tradução)' }),
        el('p', { class: 'small muted', text: l.refs.length ? `${l.refs.length} livro(s) · ${fmt(l.segments)} trechos alinhados. Valem para todos os motores, inclusive offline.` : 'Envie livros já traduzidos (original + tradução) para o sistema aprender a forma correta de traduzir: frases, nomes, coesão e coerência no padrão da editora. Valem para todos os motores, inclusive offline.' }),
        el('div', { class: 'tr-refs' }, l.refs.map(r => el('div', { class: 'enh-item ok' }, [
          el('span', { class: 'enh-name' }, [el('b', { text: r.name }), el('small', { class: 'muted', text: `${fmt(r.pairs)} trechos · ${r.glossary} nome(s) no glossário · ${r.srcName || ''} → ${r.tgtName || ''}` })]),
          el('button', { class: 'icon-btn', title: 'Remover referência', text: '✕', onclick: async () => { await api.tmRemove(r.id); draw(); } })
        ]))),
        el('div', { class: 'inline wrap' }, [el('button', { text: '+ Adicionar livro traduzido de referência', onclick: () => addReference(draw) })]),
        el('label', { class: 'chk' }, [use, ' Usar os livros de referência na tradução']),
        el('label', { class: 'flabel', text: 'Glossário da editora (tem prioridade sobre o aprendido)' }), gl
      );
    };
    draw();
    return box;
  }
  function engineName(c) {
    const ai = c.aiReview && (c.hasOrKey || c.hasGgKey) ? ' + revisão por IA (' + (c.hasOrKey ? 'OpenRouter' : 'Gemini') + ')' : '';
    if (c.effective === 'gtrans') return 'Google Tradutor' + ai + (c.offline && c.offline.installed ? ' · motor offline de reserva' : '');
    if (c.effective === 'offline') return 'Motor offline' + (c.offline && c.offline.active ? ' (' + (c.offline.models.find(m => m.key === c.offline.active) || {}).name.split(' (')[0] + ')' : '') + ai;
    if (c.provider === 'ollama') return 'Ollama · ' + c.ollamaModel;
    if (c.provider === 'openrouter') return 'OpenRouter · ' + c.orModel;
    if (c.provider === 'google') return 'Google Gemini · ' + c.ggModel;
    if (c.provider === 'mock') return 'simulação';
    return (c.models.find(m => m.id === c.model) || {}).name || c.model;
  }

  // ---------------------------------------------------------------- fila
  function addFiles(paths) {
    let n = 0;
    paths.filter(p => EXT.test(p)).forEach(p => { if (!queue.some(q => q.path === p)) { queue.push({ path: p, name: p.split(/[\\/]/).pop().replace(EXT, ''), status: 'wait' }); n++; } });
    if (paths.length && !n) App.toast('Envie arquivos EPUB, DOCX, DOC ou ODT (ou eles já estão na lista).');
    renderList(); renderControls();
  }
  function renderList() {
    if (!listBox) return;
    listBox.innerHTML = '';
    if (!queue.length) { listBox.appendChild(el('p', { class: 'muted enh-empty', text: 'Nenhum livro na lista.' })); return; }
    const L = { wait: 'aguardando', run: 'traduzindo…', ok: 'concluído', err: 'erro' };
    queue.forEach((q, i) => listBox.appendChild(el('div', { class: 'enh-item ' + q.status }, [
      el('span', { class: 'enh-ic', html: App.icons ? App.icons.svg('globe') : '' }),
      el('span', { class: 'enh-name' }, [el('b', { text: q.report ? q.report.title : q.name }), el('small', { class: 'muted', text: q.out ? q.out : q.msg || q.path })]),
      el('span', { class: 'enh-st', text: L[q.status] }),
      q.report ? el('button', { class: 'icon-btn', title: 'Ver o relatório', text: '📋', onclick: () => showReport(q) }) : null,
      !running && q.status !== 'run' ? el('button', { class: 'icon-btn', title: 'Tirar da lista', text: '✕', onclick: () => { queue.splice(i, 1); renderList(); renderControls(); } }) : null
    ])));
  }
  function renderControls() {
    const b = $('#trStart'), s = $('#trStop');
    if (!b) return;
    const n = queue.filter(q => q.status === 'wait' || q.status === 'err').length;
    b.disabled = running || !n;
    b.textContent = running ? 'Traduzindo…' : n > 1 ? `▶ Iniciar (${n} livros, um após o outro)` : '▶ Iniciar a tradução';
    if (s) s.style.display = running ? '' : 'none';
  }
  function setTab(t) {
    screen.querySelectorAll('.tr-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    logBox.style.display = t === 'log' ? '' : 'none';
    reportBox.style.display = t === 'report' ? '' : 'none';
  }

  async function open() {
    if (screen) { screen.classList.add('show'); return; }
    dlDir = await api.enhDownloads();
    logBox = el('ol', { class: 'pg-log enh-log' });
    listBox = el('div', { class: 'enh-list' });
    reportBox = el('div', { class: 'tr-report' }, [el('p', { class: 'muted', text: 'O relatório de cada livro aparece aqui ao terminar a tradução.' })]);
    cfgBox = el('div', { class: 'tr-cfg' });
    api.onTrProgress(m => { if (running) live(`recebendo a tradução… ${fmt(m.chars)} caracteres`); });
    const drop = el('button', { class: 'enh-drop', onclick: async () => addFiles(await api.trPick()) }, [
      el('span', { class: 'enh-drop-ic', html: App.icons ? App.icons.svg('upload') : '' }),
      el('b', { text: 'Enviar livros para traduzir' }),
      el('span', { class: 'muted', text: 'EPUB, DOCX ou DOC, em qualquer idioma — clique ou arraste aqui um ou vários (modo em massa: um após o outro)' })
    ]);
    drop.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); });
    screen = el('div', { class: 'enh-screen tr-screen show' }, [
      el('header', { class: 'enh-head' }, [
        el('div', { class: 'enh-brand' }, [el('span', { class: 'enh-logo', html: App.icons ? App.icons.svg('globe') : '' }), el('div', {}, [el('h1', { text: 'Tradução' }), el('p', { class: 'muted', text: 'Livros de qualquer idioma → português do Brasil, com preparação de texto e o padrão do sistema' })])]),
        el('button', { class: 'enh-back', text: '← Voltar ao editor', onclick: () => screen.classList.remove('show') })
      ]),
      el('main', { class: 'enh-main' }, [
        el('section', { class: 'enh-col' }, [
          drop, listBox,
          el('details', { class: 'tr-cfg-box', open: true }, [el('summary', { text: 'Configurações da tradução' }), cfgBox]),
          el('div', { class: 'enh-opts' }, [
            el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'trImages', checked: true }), ' Manter as ilustrações dentro dos capítulos']),
            el('label', { class: 'chk' }, [el('input', { type: 'checkbox', id: 'trOpen', checked: true }), ' Mostrar a pasta ao terminar'])
          ]),
          el('div', { class: 'enh-what' }, [
            el('b', { text: 'O que é feito em cada livro' }),
            el('ul', {}, [
              'remove avisos e licença do Project Gutenberg, capa, rosto, dedicatória, sumário original e páginas pós-textuais; ficam os capítulos e o sumário do sistema',
              'tradução literária por trechos, como um tradutor sênior: tom, subtexto, ritmo, adaptação de expressões e concisão para a diagramação; glossário de nomes para manter a coerência',
              'pós-edição local: diálogos com travessão, Novo Acordo Ortográfico, dicionário de estilo (pleonasmos, falsos cognatos, possessivos), pontuação e legibilidade',
              'DOCX traduzido e formatado no padrão do app (Garamond, títulos, parágrafos, sumário) na pasta Downloads; no fim, o relatório com parecer, mudanças e correções'
            ].map(t => el('li', { text: t })))
          ]),
          el('div', { class: 'enh-run' }, [el('button', { id: 'trStart', class: 'primary big', onclick: start }), el('button', { id: 'trStop', class: 'danger', text: 'Parar depois do trecho atual', style: { display: 'none' }, onclick: () => { stopAsked = true; addLog('Parada pedida: termina o trecho atual e para.', 'bad'); } }), el('span', { class: 'muted small', text: 'Salvo em: ' + dlDir })])
        ]),
        el('section', { class: 'enh-col' }, [
          el('div', { class: 'tr-tabs' }, [el('button', { class: 'tr-tab on', 'data-tab': 'log', text: 'Registro', onclick: () => setTab('log') }), el('button', { class: 'tr-tab', 'data-tab': 'report', text: 'Relatório', onclick: () => setTab('report') })]),
          logBox, reportBox
        ])
      ])
    ]);
    screen.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    screen.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); addFiles(Array.from(e.dataTransfer.files || []).map(f => api.pathForFile(f))); });
    document.body.appendChild(screen);
    setTab('log');
    await renderConfig();
    renderList(); renderControls();
    addLog('Pronto. Envie os livros, confira as configurações e clique em Iniciar.');
  }

  App.translate = { open, addFiles, start, queue, savePdf, pdfHtml, postEdit: (h, st) => { cfg = cfg || { glue: true }; return postEdit(h, st); } };
})();
