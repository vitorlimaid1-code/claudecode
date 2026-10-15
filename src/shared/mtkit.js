// Ferramentas da tradução sem IA (offline e Google Tradutor), sem dependências e sem internet:
//  - detecção do idioma de origem (palavras funcionais e escrita);
//  - divisão em frases e preparo das linhas HTML (notas de rodapé e ênfase do bloco preservadas);
//  - expressões idiomáticas do inglês reescritas em linguagem literal antes da tradução automática
//    (o tradutor automático traduz palavra por palavra o que não entende: “it's raining cats and dogs”);
//  - memória de tradução feita com livros já traduzidos enviados como referência: alinhamento
//    parágrafo a parágrafo (e frase a frase), reaproveitamento de traduções idênticas ou quase,
//    glossário de nomes aprendido das referências e exemplos para a revisão por IA.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MtKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------------------------------------------------------------- idioma
  const STOPS = {
    en: 'the and of to in that is was he for it with as his on be at by i had not are but from or have an they which you were her all she there would their we him been has when who will no if out so said what up its about into than them can only could these then my now like our over me even made after did before must through back where much your way well down should because just those how too very here both being never same know while last might us old off come since go came right take three upon',
    fr: 'le la les des du une et est que qui dans pour pas au aux il elle ne se sur son sa ses avec ce cette mais plus par comme on nous vous ils elles été être avait était fait tout lui dit bien sans leur même je mon ma mes',
    es: 'el los las del una y que en es por con para no se su sus al lo como más pero le ya fue este ha sí porque esta son entre cuando muy sin sobre también me hasta hay donde quien desde todo nos uno les ni ese eso había ellos esto él ella yo mi',
    it: 'il lo gli le di del della un una che è per non con si su al come più ma suo sua anche era sono ha questo questa nel nella da dei delle mi lui lei io tu loro ci ne quando molto',
    de: 'der die das und ist nicht zu den von mit sich des auf für im dem ein eine als auch es an er hat aus bei sie nach wird noch wie einem einen über einer so zum war haben nur oder aber vor zur bis mehr durch man ich',
    pt: 'o os as de do da dos das um uma e é que em no na por para com não se seu sua mais mas como foi ele ela ao à já ou quando muito também eu isso pelo pela',
    la: 'et in est non ad cum quod qui quae sed ut ex de enim per esse sunt autem nec quam etiam atque ac vel si tamen hoc eius ab sicut iam',
    nl: 'de het een en van in is dat op te zijn met voor niet aan er hij ze als maar om ook bij door nog wat zo dan ik je',
    sv: 'och det att i en som är på av för med till den har de inte om ett han men var jag sig från vi så kan man när',
    pl: 'i w nie na się z do to że jest jak po co tak za od ale o już jego jej był była przez',
    cs: 'a se na je že v to s do o jako ale by jsem jsou pro tak už jeho jen'
  };
  const STOPSETS = Object.fromEntries(Object.entries(STOPS).map(([k, v]) => [k, new Set(v.split(' '))]));
  // código do NLLB-200 (motor offline)
  const NLLB = {
    en: 'eng_Latn', fr: 'fra_Latn', es: 'spa_Latn', it: 'ita_Latn', de: 'deu_Latn', pt: 'por_Latn', nl: 'nld_Latn', sv: 'swe_Latn', pl: 'pol_Latn', cs: 'ces_Latn',
    ru: 'rus_Cyrl', uk: 'ukr_Cyrl', el: 'ell_Grek', ja: 'jpn_Jpan', zh: 'zho_Hans', ko: 'kor_Hang', ar: 'arb_Arab', he: 'heb_Hebr', da: 'dan_Latn', no: 'nob_Latn', fi: 'fin_Latn', hu: 'hun_Latn', tr: 'tur_Latn', ro: 'ron_Latn', ca: 'cat_Latn'
  };
  const NAMES = { en: 'inglês', fr: 'francês', es: 'espanhol', it: 'italiano', de: 'alemão', pt: 'português', la: 'latim', nl: 'holandês', sv: 'sueco', pl: 'polonês', cs: 'tcheco', ru: 'russo', uk: 'ucraniano', el: 'grego', ja: 'japonês', zh: 'chinês', ko: 'coreano', ar: 'árabe', he: 'hebraico' };
  function detectLang(text) {
    const t = String(text || '').replace(/<[^>]+>/g, ' ').slice(0, 20000);
    const count = re => (t.match(re) || []).length;
    const letters = Math.max(1, count(/\p{L}/gu));
    if (count(/[\u0400-\u04FF]/g) / letters > 0.3) return /[іїєґ]/i.test(t) ? 'uk' : 'ru';
    if (count(/[\u0370-\u03FF]/g) / letters > 0.3) return 'el';
    if (count(/[\u3040-\u30FF]/g) / letters > 0.05) return 'ja';
    if (count(/[\uAC00-\uD7AF]/g) / letters > 0.3) return 'ko';
    if (count(/[\u4E00-\u9FFF]/g) / letters > 0.3) return 'zh';
    if (count(/[\u0600-\u06FF]/g) / letters > 0.3) return 'ar';
    if (count(/[\u0590-\u05FF]/g) / letters > 0.3) return 'he';
    const words = t.toLowerCase().match(/\p{L}+/gu) || [];
    let best = 'en', bestN = -1;
    for (const [lang, set] of Object.entries(STOPSETS)) {
      let n = 0;
      for (const w of words) if (set.has(w)) n++;
      if (n > bestN) { best = lang; bestN = n; }
    }
    return best;
  }

  // ---------------------------------------------------------------- frases
  const ABBR = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Sra|Srta|Prof|Mt|vs|etc|Mme|Mlle|M|Gen|Col|Capt|Lt|Rev|Hon|No|Vol|Ch|pp|cf|ibid|i\.e|e\.g|Ave|Co|Ltd|Inc|[A-Z])\.$/;
  function splitSentences(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    const out = [];
    const re = /[.!?…]+["”’»)\]]*\s+(?=["“‘«(\[—–-]?\s*[\p{Lu}\p{N}])/gu;
    let last = 0, m;
    while ((m = re.exec(s))) {
      const end = m.index + m[0].length;
      const piece = s.slice(last, end).trim();
      if (ABBR.test(s.slice(last, m.index + 1).trim())) continue;
      out.push(piece);
      last = end;
    }
    if (last < s.length) out.push(s.slice(last).trim());
    // frases muito longas: quebra em ponto e vírgula / dois-pontos (o motor offline perde o fio em frases enormes)
    return out.flatMap(x => (x.split(/\s+/).length > 90 ? x.split(/(?<=[;:])\s+/) : [x])).filter(Boolean);
  }

  // ---------------------------------------------------------------- linhas HTML
  const decode = s => String(s || '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
  const escape = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const strip = s => decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  // tira do HTML os <span class="footnote">…</span> (com spans dentro), devolvendo o texto com marcas \u0000n\u0000
  function takeNotes(html) {
    const notes = [];
    let out = '', i = 0;
    const open = /<span\b[^>]*class="[^"]*\bfootnote\b[^"]*"[^>]*>/gi;
    let m;
    while ((m = open.exec(html))) {
      out += html.slice(i, m.index);
      let depth = 1, j = m.index + m[0].length;
      const tag = /<\/?span\b[^>]*>/gi;
      tag.lastIndex = j;
      let t;
      while (depth && (t = tag.exec(html))) { depth += t[0][1] === '/' ? -1 : 1; j = tag.lastIndex; }
      notes.push({ open: m[0], inner: html.slice(m.index + m[0].length, j - 7) });
      out += '\u0000' + (notes.length - 1) + '\u0000';
      i = j; open.lastIndex = j;
    }
    return { html: out + html.slice(i), notes };
  }
  // linha → plano de tradução: pedaços de texto (cada um dividido em frases) e o molde para remontar
  function planLine(line) {
    const l = String(line || '').trim();
    if (!l || /^\[\[FIG:\d+\]\]$/.test(l)) return { keep: l };
    const m = /^<(h[1-6]|p|li|blockquote|div|figcaption|dt|dd)(\s[^>]*)?>([\s\S]*)<\/\1>$/i.exec(l);
    const tag = m ? m[1] : 'p', attrs = m ? (m[2] || '') : '', inner = m ? m[3] : l;
    const tn = takeNotes(inner);
    const bare = tn.html.replace(/\u0000\d+\u0000/g, '').trim();
    const em = /^<(i|em|b|strong)>([\s\S]*)<\/\1>$/i.exec(bare);
    const pieces = tn.html.split(/\u0000(\d+)\u0000/);
    const texts = [], noteAfter = [];
    for (let k = 0; k < pieces.length; k += 2) { texts.push(strip(pieces[k])); noteAfter.push(k + 1 < pieces.length ? Number(pieces[k + 1]) : -1); }
    if (!texts.some(Boolean) && !tn.notes.length) return { keep: l };
    return { tag, attrs, wrap: em ? em[1].toLowerCase() : '', texts, noteAfter, notes: tn.notes.map(n => ({ open: n.open, text: strip(n.inner) })) };
  }
  function buildLine(plan, texts, noteTexts) {
    if (plan.keep !== undefined) return plan.keep;
    let body = '';
    plan.texts.forEach((t, k) => {
      const tr = texts[k] || '';
      body += (body && tr && !/^[,.;:!?…]/.test(tr) ? ' ' : '') + escape(tr);
      const n = plan.noteAfter[k];
      if (n >= 0) body += plan.notes[n].open + escape(noteTexts[n] || plan.notes[n].text) + '</span>';
    });
    if (plan.wrap) body = `<${plan.wrap}>${body}</${plan.wrap}>`;
    return `<${plan.tag}${plan.attrs}>${body}</${plan.tag}>`;
  }

  // ---------------------------------------------------------------- expressões idiomáticas (inglês)
  // [expressão, sentido literal]: o texto em inglês é reescrito antes da tradução automática
  const IDIOMS_EN = [
    ["it's raining cats and dogs", "it's raining very heavily"], ['raining cats and dogs', 'raining very heavily'], ['a piece of cake', 'very easy'], 
    ['under the weather', 'slightly ill'], ['once in a blue moon', 'very rarely'], ['spill the beans', 'reveal the secret'], ['spilled the beans', 'revealed the secret'], ['spilt the beans', 'revealed the secret'],
    ['let the cat out of the bag', 'revealed the secret'], ['kick the bucket', 'die'], ['kicked the bucket', 'died'], ['bite the bullet', 'face the difficulty'], ['bit the bullet', 'faced the difficulty'],
    ['hit the sack', 'go to bed'], ['hit the hay', 'go to bed'], ['call it a day', 'stop working for today'], ['called it a day', 'stopped working for the day'], ['beat around the bush', 'avoid the subject'], ['beating around the bush', 'avoiding the subject'],
    ['cost an arm and a leg', 'cost a fortune'], ['costs an arm and a leg', 'costs a fortune'], ['pull my leg', 'tease me'], ['pulling my leg', 'teasing me'], ['pulling your leg', 'teasing you'],
    ['on cloud nine', 'extremely happy'], ['the last straw', 'the limit'], ['a blessing in disguise', 'a hidden blessing'], ['add insult to injury', 'make things even worse'], ['by the skin of his teeth', 'barely'], ['by the skin of her teeth', 'barely'], ['by the skin of my teeth', 'barely'],
    ['get out of hand', 'get out of control'], ['got out of hand', 'got out of control'], ['in the nick of time', 'just in time'], 
    ['no pain, no gain', 'without effort there is no reward'], ['see eye to eye', 'agree'], ['saw eye to eye', 'agreed'], 
    ['steal his thunder', 'take the credit from him'], ['the ball is in your court', 'the decision is yours'], ['throw in the towel', 'give up'], ['threw in the towel', 'gave up'], ['under my nose', 'right in front of me'], 
    ['when pigs fly', 'never'], ['a dime a dozen', 'very common'], ['back to square one', 'back to the beginning'], ['barking up the wrong tree', 'looking in the wrong place'], ['best of both worlds', 'advantages of both'],
    ['burn the midnight oil', 'work late into the night'], ['burned the midnight oil', 'worked late into the night'], ['cut corners', 'do things carelessly to save effort'], ['cutting corners', 'doing things carelessly'],
    ['easy does it', 'carefully'], ['get your act together', 'organize yourself'], ['hang in there', 'do not give up'], ['it slipped my mind', 'I forgot'], ['keep your chin up', 'stay strong'],
    ['let someone off the hook', 'free someone from the obligation'], ['make a long story short', 'summarize'], ['to make a long story short', 'in short'], ['long story short', 'in short'],
    ['out of the blue', 'unexpectedly'], ['play it by ear', 'improvise'], ['pull yourself together', 'calm down'], ['so far so good', 'everything is fine until now'],
    ['speak of the devil', 'here he is, we were just talking about him'], ['take it with a grain of salt', 'do not take it too seriously'], ['with a grain of salt', 'with skepticism'],
    ['the elephant in the room', 'the obvious problem nobody mentions'], ['wrap your head around', 'understand'], ['wrap my head around', 'understand'], ['you can say that again', 'that is very true'],
    ['your guess is as good as mine', 'I do not know either'], ['a chip on his shoulder', 'a resentment'], ['a chip on her shoulder', 'a resentment'],
    ['jump the gun', 'act too soon'], ['jumped the gun', 'acted too soon'], ['keep an eye on', 'watch'], ['kept an eye on', 'watched'],
    ['let sleeping dogs lie', 'leave the matter alone'], ['look before you leap', 'think before you act'], ['not my cup of tea', 'not to my taste'], ['not his cup of tea', 'not to his taste'], ['not her cup of tea', 'not to her taste'],
    ['on the same page', 'in agreement'], ['rule of thumb', 'general rule'], ['shoot the breeze', 'chat'], ['shooting the breeze', 'chatting'],
    ['head over heels in love', 'completely in love'], ['the whole nine yards', 'everything'], ['through thick and thin', 'in good and bad times'], 
    ['like a fish out of water', 'completely out of place'], ['all ears', 'listening attentively'], ['at the drop of a hat', 'immediately'],
    ['bent out of shape', 'upset'], ['bury the hatchet', 'make peace'], ['buried the hatchet', 'made peace'], ['caught red-handed', 'caught in the act'], ['cry over spilt milk', 'regret what cannot be changed'], ['cry over spilled milk', 'regret what cannot be changed'],
    ['go the extra mile', 'make an extra effort'], ['went the extra mile', 'made an extra effort'], ['hit the nail on the head', 'be exactly right'], 
    ['in a nutshell', 'in short'], ['keep my fingers crossed', 'hope for good luck'], ['fingers crossed', 'hoping for good luck'], ['lose one\'s temper', 'get angry'], ['lost his temper', 'got angry'], ['lost her temper', 'got angry'],
    ['piece of my mind', 'my frank and angry opinion'], ['pain in the neck', 'nuisance'], ['raining on my parade', 'spoiling my plans'], ['rain on his parade', 'spoil his plans'],
    ['sick and tired of', 'fed up with'], ['take a rain check', 'postpone'], ['the tip of the iceberg', 'a small part of the problem'], ['turn a blind eye', 'pretend not to see'], ['turned a blind eye', 'pretended not to see'],
    ['up to his ears', 'deeply involved'], ['up to her ears', 'deeply involved'], ['water under the bridge', 'something in the past, already forgotten'], ['whole new ball game', 'completely different situation'],
    ['for crying out loud', 'for heaven\'s sake'], ['by and large', 'in general'], ['more often than not', 'usually'], ['every now and then', 'occasionally'], ['now and then', 'occasionally'],
    ['all of a sudden', 'suddenly'], ['as a matter of fact', 'in fact'], ['for the time being', 'for now'], ['to and fro', 'back and forth'],
    ['out of the question', 'impossible'], ['make ends meet', 'pay the bills'], ['made ends meet', 'paid the bills'], ['go without saying', 'be obvious'], ['goes without saying', 'is obvious'],
    ['take for granted', 'assume'], ['took for granted', 'assumed'], ['taken for granted', 'assumed'], ['make up his mind', 'decide'], ['make up her mind', 'decide'], ['made up his mind', 'decided'], ['made up her mind', 'decided'], ['make up my mind', 'decide'], ['made up my mind', 'decided'],
    ['get rid of', 'eliminate'], ['got rid of', 'eliminated'], ['put up with', 'tolerate'], ['puts up with', 'tolerates'], ['look forward to', 'eagerly await'], ['looked forward to', 'eagerly awaited'], ['looking forward to', 'eagerly awaiting'],
    ['figure out', 'understand'], ['figured out', 'understood'], ['find out', 'discover'], ['found out', 'discovered'],
    ['pick up on', 'notice'], ['picked up on', 'noticed'], ['brush up on', 'review'], ['come up with', 'invent'], ['came up with', 'invented']
  ].sort((a, b) => b[0].length - a[0].length);
  const IDIOM_RE = IDIOMS_EN.map(([a, b]) => [new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")}(?=$|[^\\p{L}])`, 'giu'), b]);
  function literalize(text, lang) {
    if (lang && lang !== 'en') return { text, hits: 0 };
    let t = String(text || ''), hits = 0;
    for (const [re, to] of IDIOM_RE) t = t.replace(re, (m, pre) => { hits++; const orig = m.slice(pre.length); return pre + (/^\p{Lu}/u.test(orig) ? to[0].toUpperCase() + to.slice(1) : to); });
    return { text: t, hits };
  }
  // o mesmo, só nos textos de uma linha HTML (as marcas ficam intactas)
  function literalizeHtml(html, lang) {
    let hits = 0;
    const out = String(html || '').split(/(<[^>]+>)/).map(p => { if (p.startsWith('<')) return p; const r = literalize(p, lang); hits += r.hits; return r.text; }).join('');
    return { html: out, hits };
  }

  // ---------------------------------------------------------------- memória de tradução
  const norm = s => strip(s).normalize('NFC').toLowerCase().replace(/[“”"«»„‘’'`´]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const toks = s => norm(s).split(' ').filter(Boolean);
  const numbers = s => (String(s).match(/\d+/g) || []).join(',');
  // alinhamento de parágrafos (Gale–Church simplificado, em faixa ao redor da diagonal): 1-1, 1-2, 2-1, 1-0, 0-1
  function alignParagraphs(src, tgt, ratio) {
    const n = src.length, m = tgt.length;
    if (!n || !m) return [];
    const ls = src.map(s => Math.max(1, strip(s).length)), lt = tgt.map(s => Math.max(1, strip(s).length));
    const sumS = ls.reduce((a, b) => a + b, 0), sumT = lt.reduce((a, b) => a + b, 0);
    const r = ratio || sumT / sumS || 1.15;
    const ns = src.map(numbers), nt = tgt.map(numbers);
    const cost = (a, b) => { const d = (b - a * r) / Math.sqrt(a * r * 0.25 + 4); return d * d * 0.5; };
    const band = Math.max(60, Math.abs(n - m) + 40);
    const INF = 1e18;
    const W = m + 1;
    const D = new Float64Array((n + 1) * W).fill(INF);
    const B = new Uint8Array((n + 1) * W);
    D[0] = 0;
    for (let i = 0; i <= n; i++) {
      const jc = Math.round(i * m / n);
      for (let j = Math.max(0, jc - band); j <= Math.min(m, jc + band); j++) {
        if (!i && !j) continue;
        let best = INF, op = 0;
        const tryOp = (c, o) => { if (c < best) { best = c; op = o; } };
        if (i && j && D[(i - 1) * W + j - 1] < INF) tryOp(D[(i - 1) * W + j - 1] + cost(ls[i - 1], lt[j - 1]) - (ns[i - 1] && ns[i - 1] === nt[j - 1] ? 2 : 0), 1);
        if (i && j > 1 && D[(i - 1) * W + j - 2] < INF) tryOp(D[(i - 1) * W + j - 2] + cost(ls[i - 1], lt[j - 1] + lt[j - 2]) + 2.2, 2);
        if (i > 1 && j && D[(i - 2) * W + j - 1] < INF) tryOp(D[(i - 2) * W + j - 1] + cost(ls[i - 1] + ls[i - 2], lt[j - 1]) + 2.2, 3);
        if (i && D[(i - 1) * W + j] < INF) tryOp(D[(i - 1) * W + j] + 4.5, 4);
        if (j && D[i * W + j - 1] < INF) tryOp(D[i * W + j - 1] + 4.5, 5);
        D[i * W + j] = best; B[i * W + j] = op;
      }
    }
    const pairs = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      const op = B[i * W + j];
      if (op === 1) { pairs.push([[i - 1], [j - 1]]); i--; j--; }
      else if (op === 2) { pairs.push([[i - 1], [j - 2, j - 1]]); i--; j -= 2; }
      else if (op === 3) { pairs.push([[i - 2, i - 1], [j - 1]]); i -= 2; j--; }
      else if (op === 4) i--;
      else if (op === 5) j--;
      else break;
    }
    return pairs.reverse().map(([a, b]) => [a.map(k => src[k]).join(' '), b.map(k => tgt[k]).join(' ')]);
  }
  // livro de referência: capítulos (listas de parágrafos) do original e da tradução → pares de segmentos
  function alignBook(srcChapters, tgtChapters) {
    const flat = c => c.reduce((a, x) => a.concat(x), []);
    let paraPairs = [];
    if (srcChapters.length === tgtChapters.length && srcChapters.length > 1) srcChapters.forEach((c, k) => { paraPairs = paraPairs.concat(alignParagraphs(c, tgtChapters[k])); });
    else paraPairs = alignParagraphs(flat(srcChapters), flat(tgtChapters));
    const out = [];
    const ok = (s, t) => { const a = strip(s).length, b = strip(t).length; return a > 12 && b > 8 && b / a > 0.55 && b / a < 2.1; };
    paraPairs.forEach(([s, t]) => {
      if (!ok(s, t)) return;
      out.push([strip(s), strip(t)]);
      const ss = splitSentences(strip(s)), ts = splitSentences(strip(t));
      if (ss.length > 1 && ss.length === ts.length) ss.forEach((x, k) => { if (ok(x, ts[k])) out.push([x, ts[k]]); });
    });
    return out;
  }
  // nomes próprios que mudam na tradução (Toto → Totó, London → Londres), aprendidos dos pares
  function learnGlossary(pairs) {
    const caps = s => (s.match(/(?<![.!?—]\s|^|\p{L})\p{Lu}[\p{Ll}’'-]{2,}(?!\p{L})/gu) || []);
    const counts = new Map(), seen = new Map();
    pairs.forEach(([s, t]) => {
      const a = [...new Set(caps(s))].filter(w => !t.includes(w)), b = [...new Set(caps(t))].filter(w => !s.includes(w));
      a.forEach(w => seen.set(w, (seen.get(w) || 0) + 1));
      if (a.length === 1 && b.length === 1) { const k = a[0] + '\u0001' + b[0]; counts.set(k, (counts.get(k) || 0) + 1); }
    });
    const best = new Map();
    for (const [k, c] of counts) { const [a, b] = k.split('\u0001'); if (c >= 2 && c / (seen.get(a) || 1) >= 0.5 && (!best.has(a) || best.get(a)[1] < c)) best.set(a, [b, c]); }
    return [...best.entries()].map(([a, [b, c]]) => [a, b, c]).sort((x, y) => y[2] - x[2]);
  }

  function createMemory(entries, glossary) {
    // entries: [[origem, tradução], …]
    const exact = new Map();
    const postings = new Map();
    const segs = [];
    const df = new Map();
    (entries || []).forEach(([s, t]) => {
      const k = norm(s);
      if (!k || exact.has(k)) return;
      exact.set(k, t);
      const id = segs.length;
      const w = [...new Set(k.split(' ').filter(x => x.length > 2))];
      segs.push({ s, t, w, n: k.split(' ').length });
      w.forEach(x => { df.set(x, (df.get(x) || 0) + 1); let p = postings.get(x); if (!p) postings.set(x, (p = [])); p.push(id); });
    });
    const N = Math.max(1, segs.length);
    const gl = (glossary || []).filter(g => g[0] && g[1]);
    function candidates(words, limit) {
      const score = new Map();
      words.forEach(x => {
        const p = postings.get(x);
        if (!p || p.length > N * 0.2 + 30) return; // palavras comuns não ajudam a achar o par
        const idf = Math.log(1 + N / p.length);
        p.forEach(id => score.set(id, (score.get(id) || 0) + idf));
      });
      return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 30).map(x => x[0]);
    }
    // tradução de referência para um segmento: idêntica (1) ou quase (≥ min, mesma numeração)
    function lookup(text, min) {
      const k = norm(text);
      if (!k) return null;
      if (exact.has(k)) return { target: exact.get(k), score: 1 };
      const w = [...new Set(k.split(' ').filter(x => x.length > 2))];
      if (w.length < 4) return null;
      let best = null;
      candidates(w, 25).forEach(id => {
        const sg = segs[id];
        const inter = sg.w.filter(x => w.includes(x)).length;
        const dice = 2 * inter / (sg.w.length + w.length);
        const len = Math.min(sg.n, k.split(' ').length) / Math.max(sg.n, k.split(' ').length);
        const sc = dice * 0.85 + len * 0.15;
        if (numbers(sg.s) !== numbers(text)) return;
        if (!best || sc > best.score) best = { target: sg.t, source: sg.s, score: sc };
      });
      return best && best.score >= (min || 0.92) ? best : null;
    }
    // pares parecidos com o trecho, para mostrar à IA o jeito de traduzir da editora
    function examples(text, k) {
      const w = [...new Set(toks(text).filter(x => x.length > 3))];
      if (!w.length) return [];
      return candidates(w, (k || 4) * 3).map(id => segs[id]).filter(s => s.s.length < 600).slice(0, k || 4).map(s => [s.s, s.t]);
    }
    // termos do glossário que aparecem no texto
    function terms(text) {
      const t = String(text || '');
      return gl.filter(([a]) => new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'iu').test(t)).map(([a, b]) => [a, b]);
    }
    // depois da tradução automática: nome que ficou no original troca pela forma do glossário
    function enforce(source, translated) {
      let out = String(translated || ''), hits = 0;
      terms(source).forEach(([a, b]) => {
        if (a === b) return;
        const re = new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'gu');
        out = out.replace(re, (m, pre) => { hits++; return pre + b; });
      });
      return { text: out, hits };
    }
    return { size: segs.length, glossary: gl, lookup, examples, terms, enforce };
  }

  // glossário escrito pelo usuário: uma entrada por linha (“termo = tradução”, “termo → tradução” ou com tabulação)
  function parseGlossary(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => l.split(/\s*(?:→|->|=>|=|\t|;)\s*/)).filter(p => p.length >= 2 && p[0] && p[1]).map(p => [p[0], p[1]]);
  }

  return { detectLang, NLLB, NAMES, splitSentences, planLine, buildLine, literalize, literalizeHtml, IDIOMS_EN, alignParagraphs, alignBook, learnGlossary, createMemory, parseGlossary, norm, strip, escape };
});
