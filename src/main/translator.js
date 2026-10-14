// Tradução literária para o português do Brasil. O texto é traduzido por um modelo de linguagem com as
// diretrizes editoriais do sistema (tradutor literário sênior, copidesque e preparador de textos):
//  - Claude (API da Anthropic, SDK oficial) — qualidade editorial, precisa de internet e de uma chave;
//  - Ollama (modelo rodando no próprio computador) — sem internet, qualidade conforme o modelo instalado.
// Depois, a pós-edição local (src/shared/ptbr.js) aplica travessões, ortografia, dicionário e pontuação.
const fs = require('fs');
const path = require('path');

// diretrizes editoriais (texto do editor) + regras técnicas de entrada e saída
const SYSTEM = `Você é um tradutor literário sênior, copidesque e preparador de textos com décadas de experiência no mercado editorial premium. Seu objetivo é traduzir o texto fornecido para o português do Brasil, garantindo que o resultado final pareça ter sido escrito originalmente em português, mantendo o rigor técnico, a elegância estilística e a adequação ao layout de um livro físico. O texto de origem pode estar em qualquer idioma: identifique-o e traduza.

DIRETRIZES EDITORIAIS PREMIUM
Ao traduzir, siga estritamente os quatro pilares abaixo:
1. Fiel ao tom e ao subtexto: não faça traduções literais. Adapte expressões idiomáticas, trocadilhos e referências culturais para equivalentes naturais em português. Mantenha a voz, a ironia, a época e a cadência do autor original.
2. Ritmo e fluidez: o texto deve ser agradável de ler em voz alta. Ajuste a ordem das frases para que a sonoridade e o ritmo da prosa sejam naturais e elegantes. Evite repetições excessivas de palavras próximas usando sinônimos ricos.
3. Preparação de texto: elimine cacoetes de linguagem e ambiguidades. Se o original for excessivamente prolixo devido a características do idioma de origem, faça pequenos ajustes de concisão sem alterar o sentido, visando à clareza editorial.
4. Preservação de estrutura: mantenha intactas todas as marcações estruturais, como ênfases em palavras, aspas de diálogo ou travessões.

DIRETRIZES ESPECÍFICAS PARA DIAGRAMAÇÃO
- Gerenciamento de espaço: o português costuma ocupar de 15 a 25 por cento mais espaço que o inglês. Mantenha a tradução o mais concisa possível para evitar quebras de página abruptas ou estouro da mancha gráfica, sem sacrificar a beleza do texto.
- Padrão tipográfico: use aspas e travessões corretos segundo a norma editorial brasileira. Nos diálogos, use o travessão longo (—), colado na fala, nunca hífens. Siga o Novo Acordo Ortográfico.

FORMATO DO TEXTO (técnico, obrigatório)
- A entrada vem em HTML simples: um bloco por linha (<p>, <h1>–<h4>, <blockquote>, <li>…), com ênfases (<em>, <i>, <strong>, <b>, <u>, <sup>, <sub>, <span class="…">) e notas de rodapé (<span class="footnote">…</span>).
- Devolva exatamente os mesmos blocos, na mesma ordem e na mesma quantidade, um por linha, com as mesmas tags e atributos; traduza só o texto (inclusive dentro das notas de rodapé). Nunca junte nem divida blocos.
- Linhas no formato [[FIG:n]] são ilustrações: copie-as sem mudança, na mesma posição.
- Nomes próprios: mantenha-os coerentes com o glossário enviado; só traduza nomes que tenham forma consagrada em português.

FORMATO DA SAÍDA
Sua resposta deve conter apenas duas seções, sem introduções nem comentários informais, com estes títulos exatos, cada um sozinho em sua linha:
### TEXTO TRADUZIDO E PREPARADO
(o texto final em HTML, um bloco por linha, perfeitamente limpo, revisado e pronto para a diagramação)
### NOTAS EDITORIAIS
(justifique brevemente escolhas difíceis de tradução, adaptações culturais complexas ou termos técnicos que exigiram atenção especial; uma nota por linha começando com "- ". Depois, se houver, liste nomes e termos recorrentes no formato "GLOSSÁRIO: original → tradução", um por linha. Na primeira chamada, inclua a linha "IDIOMA DE ORIGEM: <idioma>". Se não houver notas, deixe em branco.)`;

const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 — máxima qualidade literária', in: 4, out: 20, fallback: true },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 — ótima qualidade, mais econômico', in: 2, out: 10, fallback: true },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 — rápido e barato', in: 0.1, out: 0.5, fallback: false }
];

const OR_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'; // (endereço trocável só para testes)
const OR_DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

function createTranslator({ userFile, safeStorage }) {
  const cfgFile = userFile('tradutor.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { return {}; } };
  const write = c => { fs.mkdirSync(path.dirname(cfgFile), { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify(c, null, 1)); };
  const enc = k => (safeStorage && safeStorage.isEncryptionAvailable() ? { enc: safeStorage.encryptString(k).toString('base64') } : { plain: k });
  const dec = o => { if (!o) return ''; try { return o.enc ? safeStorage.decryptString(Buffer.from(o.enc, 'base64')) : o.plain || ''; } catch (e) { return ''; } };

  function config() {
    const c = read();
    const key = dec(c.key);
    return {
      provider: c.provider || (process.env.TRANSLATE_MOCK ? 'mock' : 'claude'),
      model: c.model || 'claude-opus-5-5',
      effort: c.effort || 'high',
      ollamaUrl: c.ollamaUrl || 'http://localhost:11434',
      ollamaModel: c.ollamaModel || 'qwen2.5:14b',
      orModel: c.orModel || OR_DEFAULT_MODEL,
      hasOrKey: !!dec(c.orKey) || !!process.env.OPENROUTER_API_KEY,
      orKeyHint: (k => (k ? k.slice(0, 8) + '…' + k.slice(-4) : process.env.OPENROUTER_API_KEY ? 'variável OPENROUTER_API_KEY' : ''))(dec(c.orKey)),
      glue: c.glue !== false,
      hasKey: !!key || !!process.env.ANTHROPIC_API_KEY,
      keyHint: key ? key.slice(0, 7) + '…' + key.slice(-4) : process.env.ANTHROPIC_API_KEY ? 'variável ANTHROPIC_API_KEY' : '',
      models: MODELS.map(m => ({ id: m.id, name: m.name })),
      mock: !!process.env.TRANSLATE_MOCK
    };
  }
  function setConfig(patch) {
    const c = read();
    ['provider', 'model', 'effort', 'ollamaUrl', 'ollamaModel', 'orModel', 'glue'].forEach(k => { if (patch[k] !== undefined) c[k] = patch[k]; });
    if (patch.apiKey !== undefined) c.key = patch.apiKey ? enc(String(patch.apiKey).trim()) : null;
    if (patch.orKey !== undefined) c.orKey = patch.orKey ? enc(String(patch.orKey).trim()) : null;
    write(c);
    return config();
  }

  let client = null, clientKey = null;
  function anthropic() {
    const Anthropic = require('@anthropic-ai/sdk');
    const A = Anthropic.default || Anthropic;
    const key = dec(read().key);
    if (!client || clientKey !== key) {
      // sem chave salva: o SDK usa ANTHROPIC_API_KEY ou o perfil do `ant auth login`
      client = key ? new A({ apiKey: key, maxRetries: 4, timeout: 30 * 60 * 1000 }) : new A({ maxRetries: 4, timeout: 30 * 60 * 1000 });
      clientKey = key;
    }
    return { client, A };
  }

  // OpenRouter (API compatível com chat completions): modelos gratuitos como o NVIDIA Nemotron 3 Ultra
  const orKey = () => dec(read().orKey) || process.env.OPENROUTER_API_KEY || '';
  async function openrouter(messages, maxTokens) {
    const cfg = config();
    const key = orKey();
    if (!key) throw Object.assign(new Error('Informe a chave do OpenRouter em Configurações da tradução (crie em openrouter.ai/keys).'), { fatal: true });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20 * 60 * 1000);
    let r;
    try {
      r = await fetch(OR_URL + '/chat/completions', {
        method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, 'HTTP-Referer': 'https://casavertigem.app', 'X-Title': 'Casa Vertigem Hub' },
        body: JSON.stringify({ model: cfg.orModel, messages, temperature: 0.3, max_tokens: maxTokens || 32000 })
      });
    } catch (e) {
      throw Object.assign(new Error('Sem conexão com o OpenRouter (verifique a internet).'), { retry: true });
    } finally { clearTimeout(timer); }
    const raw = await r.text();
    let j = {};
    try { j = JSON.parse(raw); } catch (e) { /* resposta não-JSON */ }
    const emsg = (j.error && (j.error.message || j.error.code)) || raw.slice(0, 200);
    if (r.status === 401) throw Object.assign(new Error('Chave do OpenRouter inválida (401). Confira em openrouter.ai/keys.'), { fatal: true });
    if (r.status === 402) throw Object.assign(new Error('O OpenRouter pediu créditos para este modelo (402): ' + emsg), { fatal: true });
    if (r.status === 404) throw Object.assign(new Error(`Modelo “${cfg.orModel}” não encontrado no OpenRouter (404).`), { fatal: true });
    if (r.status === 429) throw Object.assign(new Error('Limite do plano gratuito do OpenRouter atingido (muitos pedidos por minuto ou por dia); aguardando para tentar de novo.'), { retry: true });
    if (r.status >= 500) throw Object.assign(new Error(`OpenRouter indisponível (${r.status}).`), { retry: true });
    if (!r.ok) throw new Error(`OpenRouter respondeu ${r.status}: ${emsg}`);
    if (j.error) throw Object.assign(new Error('OpenRouter: ' + emsg), { retry: true });
    const ch = (j.choices || [])[0] || {};
    // alguns modelos devolvem o raciocínio entre <think>…</think> no próprio texto
    const text = String((ch.message || {}).content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return { text, finish: ch.finish_reason || ch.native_finish_reason || '', usage: j.usage || {}, model: j.model || cfg.orModel };
  }

  // separa as duas seções da resposta
  function parse(out) {
    const t = String(out || '');
    const i = t.search(/#*\s*TEXTO TRADUZIDO E PREPARADO\s*\n/i);
    const j = t.search(/#*\s*NOTAS EDITORIAIS\s*(\n|$)/i);
    let body = t, notes = '';
    if (i >= 0) body = t.slice(t.indexOf('\n', i) + 1, j > i ? j : undefined);
    if (j >= 0) notes = t.slice(j).replace(/^#*\s*NOTAS EDITORIAIS\s*/i, '');
    body = body.replace(/^```[a-z]*\n?|```\s*$/gm, '').trim();
    const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
    const glossary = [], list = [];
    let lang = '';
    lines.forEach(l => {
      const g = /^-?\s*GLOSS[ÁA]RIO:\s*(.+?)\s*(?:→|->|=>)\s*(.+)$/i.exec(l);
      const lg = /^-?\s*IDIOMA DE ORIGEM:\s*(.+)$/i.exec(l);
      if (g) glossary.push([g[1], g[2]]);
      else if (lg) lang = lg[1].replace(/[.;]$/, '');
      else if (!/^\(?\s*(deixe em branco|sem notas|nenhuma)/i.test(l)) list.push(l.replace(/^[-•]\s*/, ''));
    });
    return { body, notes: list, glossary, lang };
  }

  function userMessage({ title, author, glossary, context, html, first }) {
    return [
      `Livro: ${title || '(sem título)'}${author ? ' — ' + author : ''}`,
      glossary && glossary.length ? `Glossário já usado neste livro (mantenha):\n${glossary.map(([a, b]) => `${a} → ${b}`).join('\n')}` : '',
      context ? `Trecho anterior já traduzido (só para manter o tom e a continuidade; não traduza nem repita):\n${context}` : '',
      first ? 'Este é o primeiro trecho do livro: informe o IDIOMA DE ORIGEM nas notas.' : '',
      `Texto a traduzir:\n${html}`
    ].filter(Boolean).join('\n\n');
  }

  // um trecho: devolve { body, notes, glossary, lang, usage, model, stop }
  async function translate(req, onProgress) {
    const cfg = config();
    const msg = userMessage(req);
    if (cfg.provider === 'mock') return mock(req, onProgress);
    if (cfg.provider === 'ollama') {
      const r = await fetch(cfg.ollamaUrl.replace(/\/$/, '') + '/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.ollamaModel, stream: false, options: { temperature: 0.3, num_ctx: 16384 }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: msg }] })
      });
      if (!r.ok) throw new Error(`Ollama respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      const out = parse(j.message && j.message.content);
      return Object.assign(out, { usage: { input_tokens: j.prompt_eval_count || 0, output_tokens: j.eval_count || 0 }, model: cfg.ollamaModel, stop: 'end_turn' });
    }
    if (cfg.provider === 'openrouter') {
      if (onProgress) onProgress(0);
      const res = await openrouter([{ role: 'system', content: SYSTEM }, { role: 'user', content: msg }], 32000);
      if (res.finish === 'length') throw Object.assign(new Error('Trecho longo demais para uma resposta.'), { tooLong: true });
      if (!res.text) throw Object.assign(new Error('O modelo devolveu uma resposta vazia.'), { retry: true });
      if (onProgress) onProgress(res.text.length);
      const out = parse(res.text);
      return Object.assign(out, { usage: { input_tokens: res.usage.prompt_tokens || 0, output_tokens: res.usage.completion_tokens || 0 }, model: res.model, stop: res.finish || 'end_turn', price: { in: 0, out: 0 } });
    }
    const { client: c, A } = anthropic();
    const m = MODELS.find(x => x.id === cfg.model) || MODELS[0];
    const params = {
      model: m.id,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort: cfg.effort },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: msg }]
    };
    let stream;
    if (m.fallback) {
      // recusas de segurança: o próprio servidor tenta outro modelo, sem perder o trecho
      stream = c.beta.messages.stream(Object.assign({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, params));
    } else stream = c.messages.stream(params);
    let chars = 0, lastT = 0;
    stream.on('text', d => { chars += d.length; const now = Date.now(); if (onProgress && now - lastT > 1500) { lastT = now; onProgress(chars); } });
    let final;
    try { final = await stream.finalMessage(); } catch (e) {
      if (e instanceof A.AuthenticationError) throw Object.assign(new Error('Chave da API inválida ou ausente. Confira em Configurações da tradução.'), { fatal: true });
      if (e instanceof A.PermissionDeniedError) throw Object.assign(new Error('A chave não tem permissão para este modelo.'), { fatal: true });
      if (e instanceof A.RateLimitError) throw Object.assign(new Error('Limite de uso da API atingido; aguardando para tentar de novo.'), { retry: true });
      if (e instanceof A.APIConnectionError) throw Object.assign(new Error('Sem conexão com a API da Anthropic.'), { retry: true });
      if (e instanceof A.APIError && e.status >= 500) throw Object.assign(new Error(`API indisponível (${e.status}).`), { retry: true });
      throw e;
    }
    if (final.stop_reason === 'refusal') throw Object.assign(new Error('O modelo recusou este trecho' + (final.stop_details && final.stop_details.category ? ` (${final.stop_details.category})` : '') + '.'), { refusal: true });
    if (final.stop_reason === 'max_tokens') throw Object.assign(new Error('Trecho longo demais para uma resposta.'), { tooLong: true });
    const text = final.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const out = parse(text);
    return Object.assign(out, { usage: final.usage || {}, model: final.model || m.id, stop: final.stop_reason, price: { in: m.in, out: m.out } });
  }

  // parecer final da tradução (a partir das notas e números do processamento)
  async function report(req) {
    const cfg = config();
    const prompt = `Você é o editor responsável pela tradução abaixo. Com base nas notas editoriais do tradutor e nos números do processamento, escreva para o cliente, em português do Brasil, três seções com estes títulos exatos, cada um sozinho na linha:
### PARECER
(um parágrafo de 5 a 8 linhas sobre a qualidade, o tom e a adequação editorial da tradução)
### PRINCIPAIS MUDANÇAS
(de 4 a 8 itens começando com "- ": adaptações culturais, idiomáticas e de estilo mais relevantes)
### PRINCIPAIS CORREÇÕES
(de 4 a 8 itens começando com "- ": correções de ortografia, pontuação, diálogos e legibilidade aplicadas)

Livro: ${req.title}${req.author ? ' — ' + req.author : ''}
Idioma de origem: ${req.lang || 'não informado'}
Números: ${JSON.stringify(req.stats)}
Notas editoriais do tradutor:
${(req.notes || []).slice(0, 120).map(n => '- ' + n).join('\n') || '(sem notas)'}`;
    let text = '';
    if (cfg.provider === 'mock') text = '### PARECER\nTradução de teste (modo de simulação).\n### PRINCIPAIS MUDANÇAS\n- Simulação.\n### PRINCIPAIS CORREÇÕES\n- Simulação.';
    else if (cfg.provider === 'openrouter') text = (await openrouter([{ role: 'user', content: prompt }], 8000)).text;
    else if (cfg.provider === 'ollama') {
      const r = await fetch(cfg.ollamaUrl.replace(/\/$/, '') + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.ollamaModel, stream: false, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) throw new Error('Ollama: ' + r.status);
      text = ((await r.json()).message || {}).content || '';
    } else {
      const { client: c } = anthropic();
      const m = MODELS.find(x => x.id === cfg.model) || MODELS[0];
      const params = { model: m.id, max_tokens: 16000, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: prompt }] };
      const final = await (m.fallback ? c.beta.messages.stream(Object.assign({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, params)) : c.messages.stream(params)).finalMessage();
      if (final.stop_reason === 'refusal') throw new Error('recusa ao gerar o parecer');
      text = final.content.filter(b => b.type === 'text').map(b => b.text).join('');
    }
    const sec = name => { const m = new RegExp(`#*\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n#*\\s*(PARECER|PRINCIPAIS MUDANÇAS|PRINCIPAIS CORREÇÕES)\\s*\\n|$)`, 'i').exec(text); return m ? m[1].trim() : ''; };
    const items = t => t.split('\n').map(l => l.trim()).filter(l => /^[-•]/.test(l)).map(l => l.replace(/^[-•]\s*/, ''));
    return { parecer: sec('PARECER'), changes: items(sec('PRINCIPAIS MUDANÇAS')), corrections: items(sec('PRINCIPAIS CORREÇÕES')) };
  }

  async function test() {
    const cfg = config();
    if (cfg.provider === 'mock') return { ok: true, msg: 'Modo de simulação (teste).' };
    if (cfg.provider === 'openrouter') {
      const key = orKey();
      if (!key) return { ok: false, msg: 'informe a chave do OpenRouter (crie grátis em openrouter.ai/keys).' };
      try {
        const kr = await fetch(OR_URL + '/key', { headers: { authorization: 'Bearer ' + key } });
        if (kr.status === 401) return { ok: false, msg: 'chave do OpenRouter inválida (401).' };
        const kj = kr.ok ? await kr.json() : {};
        const mr = await fetch(OR_URL + '/models');
        const ids = mr.ok ? ((await mr.json()).data || []).map(x => x.id) : [];
        if (ids.length && !ids.includes(cfg.orModel)) {
          const sim = ids.filter(x => /nemotron/i.test(x)).slice(0, 6);
          return { ok: false, msg: `modelo “${cfg.orModel}” não está disponível no OpenRouter.${sim.length ? ' Parecidos: ' + sim.join(', ') : ''}` };
        }
        const d = kj.data || {};
        return { ok: true, msg: `Conectado ao OpenRouter · ${cfg.orModel}${d.is_free_tier ? ' · plano gratuito (limite de pedidos por minuto e por dia)' : ''}` };
      } catch (e) { return { ok: false, msg: 'sem conexão com o OpenRouter (verifique a internet).' }; }
    }
    if (cfg.provider === 'ollama') {
      const r = await fetch(cfg.ollamaUrl.replace(/\/$/, '') + '/api/tags').catch(e => ({ ok: false, statusText: e.message }));
      if (!r.ok) return { ok: false, msg: 'Ollama não respondeu em ' + cfg.ollamaUrl + ' (' + (r.statusText || r.status) + '). Ele está aberto?' };
      const tags = ((await r.json()).models || []).map(x => x.name);
      return tags.includes(cfg.ollamaModel) ? { ok: true, msg: `Ollama ok · modelo ${cfg.ollamaModel}` } : { ok: false, msg: `Modelo “${cfg.ollamaModel}” não está instalado no Ollama. Instalados: ${tags.join(', ') || 'nenhum'}` };
    }
    try {
      const { client: c } = anthropic();
      const r = await c.models.retrieve(cfg.model);
      return { ok: true, msg: `Conectado · ${r.display_name || cfg.model}` };
    } catch (e) {
      const { A } = anthropic();
      if (e instanceof A.AuthenticationError) return { ok: false, msg: 'chave da API inválida (401). Confira a chave em console.anthropic.com.' };
      if (e instanceof A.PermissionDeniedError) return { ok: false, msg: 'a chave não tem acesso a este modelo (403).' };
      if (e instanceof A.NotFoundError) return { ok: false, msg: `modelo “${cfg.model}” não encontrado para esta chave (404).` };
      if (e instanceof A.APIConnectionError) return { ok: false, msg: 'sem conexão com a API da Anthropic (verifique a internet).' };
      return { ok: false, msg: String(e.message || e).slice(0, 300) };
    }
  }

  // simulação para testes automáticos (TRANSLATE_MOCK=1): devolve o próprio texto e notas fictícias
  async function mock(req, onProgress) {
    if (onProgress) onProgress(req.html.length);
    await new Promise(r => setTimeout(r, 50));
    return { body: req.html, notes: ['Nota de simulação: trecho mantido para teste do fluxo.'], glossary: [['Toto', 'Totó']], lang: req.first ? 'inglês (simulação)' : '', usage: { input_tokens: Math.round(req.html.length / 4), output_tokens: Math.round(req.html.length / 4) }, model: 'simulação', stop: 'end_turn', price: { in: 0, out: 0 } };
  }

  return { config, setConfig, translate, report, test, SYSTEM };
}

module.exports = { createTranslator };
