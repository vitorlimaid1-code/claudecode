// Pós-edição local em português do Brasil (sem internet): diálogos com travessão, Novo Acordo
// Ortográfico, dicionário de correções de estilo (pleonasmos, decalques do inglês, possessivos
// desnecessários), pontuação editorial e medidas de legibilidade. Cada função devolve o texto corrigido
// e a lista do que mudou, para o relatório da tradução.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PtBr = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NB = ' ';
  const EM = '—';

  // ---------------------------------------------------------------- ortografia (Acordo de 1990)
  // palavras que perderam acento, trema ou hífen; cada entrada: [forma antiga (regex), nova, regra]
  const W = (a, b, rule) => [new RegExp(`(^|[^\\p{L}])${a}(?=$|[^\\p{L}])`, 'gu'), b, rule];
  const ACC = [
    // ditongos abertos éi/ói em paroxítonas
    ...['idéia', 'idéias', 'européia', 'européias', 'européio', 'européios', 'assembléia', 'assembléias', 'platéia', 'platéias', 'estréia', 'estréias', 'estréiam', 'estréio', 'geléia', 'geléias', 'colméia', 'colméias', 'boléia', 'epopéia', 'epopéias', 'odisséia', 'odisséias', 'panacéia', 'diarréia', 'hebréia', 'plebéia', 'apnéia', 'traquéia', 'Coréia', 'Guiné-Equatorial', 'jibóia', 'jibóias', 'jóia', 'jóias', 'bóia', 'bóias', 'bóiam', 'apóia', 'apóiam', 'apóio', 'paranóia', 'paranóias', 'paranóico', 'paranóica', 'heróico', 'heróica', 'heróicos', 'heróicas', 'estóico', 'estóica', 'estóicos', 'jóquei', 'clarabóia', 'tramóia', 'tramóias', 'Tróia', 'introspectivo', 'andróide', 'andróides', 'asteróide', 'asteróides', 'alcalóide', 'celulóide', 'debilóide', 'esferóide', 'hemorróida', 'hemorróidas', 'ovóide', 'paranóide', 'tiróide', 'tireóide', 'escabróso', 'dezóito', 'comboio', 'Bóia', 'claraboia', 'proteico', 'protéico', 'protéicos', 'onomatopéia', 'onomatopéias', 'alcatéia', 'alcatéias', 'centopéia', 'centopéias', 'cocaína', 'Galiléia', 'Judéia', 'Caldéia', 'Eritréia', 'Nicéia', 'Cesaréia', 'Pompéia']
      .filter(w => /[éó]i/.test(w)).map(w => W(w, w.replace('éi', 'ei').replace('ói', 'oi'), 'Acento dos ditongos abertos éi/ói nas paroxítonas (idéia → ideia)')),
    // hiatos ee/oo
    ...['crêem', 'dêem', 'lêem', 'vêem', 'relêem', 'revêem', 'prevêem', 'descrêem', 'desdêem', 'antevêem', 'provêem'].map(w => W(w, w.replace('ê', 'e'), 'Acento circunflexo em êem (lêem → leem)')),
    ...['vôo', 'vôos', 'enjôo', 'enjôos', 'abençôo', 'perdôo', 'magôo', 'corôo', 'côo', 'dôo', 'zôo', 'povôo', 'entôo', 'atordôo', 'abotôo', 'amontôo', 'acôo', 'sôo', 'môo'].map(w => W(w, w.replace('ô', 'o'), 'Acento circunflexo em ôo (vôo → voo)')),
    // i/u tônicos depois de ditongo
    ...['feiúra', 'feiúras', 'baiúca', 'bocaiúva', 'cauíla', 'Sauípe'].map(w => W(w, w.replace('ú', 'u').replace('í', 'i'), 'Acento em i/u tônicos depois de ditongo (feiúra → feiura)')),
    // diferenciais abolidos
    W('pára', 'para', 'Acento diferencial abolido (pára → para)'), W('Pára', 'Para', 'Acento diferencial abolido (pára → para)'),
    W('péla', 'pela', 'Acento diferencial abolido'), W('pélas', 'pelas', 'Acento diferencial abolido'), W('pêlo', 'pelo', 'Acento diferencial abolido (pêlo → pelo)'), W('pêlos', 'pelos', 'Acento diferencial abolido (pêlo → pelo)'),
    W('pólo', 'polo', 'Acento diferencial abolido (pólo → polo)'), W('pólos', 'polos', 'Acento diferencial abolido (pólo → polo)'), W('pêra', 'pera', 'Acento diferencial abolido (pêra → pera)'), W('pêras', 'peras', 'Acento diferencial abolido (pêra → pera)'),
    // hífen com “não”/“quase” e palavras compostas que se juntaram
    W('pára-quedas', 'paraquedas', 'Composto aglutinado (pára-quedas → paraquedas)'), W('pára-quedista', 'paraquedista', 'Composto aglutinado'), W('pára-quedistas', 'paraquedistas', 'Composto aglutinado'),
    W('pára-choque', 'para-choque', 'Acento diferencial abolido (pára-choque → para-choque)'), W('pára-choques', 'para-choques', 'Acento diferencial abolido'), W('pára-brisa', 'para-brisa', 'Acento diferencial abolido'), W('pára-brisas', 'para-brisas', 'Acento diferencial abolido'), W('pára-raios', 'para-raios', 'Acento diferencial abolido'), W('pára-lama', 'para-lama', 'Acento diferencial abolido'), W('pára-lamas', 'para-lamas', 'Acento diferencial abolido'),
    W('manda-chuva', 'mandachuva', 'Composto aglutinado (manda-chuva → mandachuva)'), W('manda-chuvas', 'mandachuvas', 'Composto aglutinado'),
    W('fim-de-semana', 'fim de semana', 'Locução sem hífen (fim-de-semana → fim de semana)'), W('fins-de-semana', 'fins de semana', 'Locução sem hífen'), W('dia-a-dia', 'dia a dia', 'Locução sem hífen (dia-a-dia → dia a dia)'), W('cara-de-pau', 'cara de pau', 'Locução sem hífen'), W('pé-de-moleque', 'pé de moleque', 'Locução sem hífen'), W('mão-de-obra', 'mão de obra', 'Locução sem hífen (mão-de-obra → mão de obra)'), W('ponto-de-vista', 'ponto de vista', 'Locução sem hífen'), W('à-toa', 'à toa', 'Locução sem hífen'), W('tão-somente', 'tão somente', 'Locução sem hífen'), W('tão-só', 'tão só', 'Locução sem hífen')
  ];
  // compostos antes das palavras isoladas (pára-quedas antes de pára)
  ACC.sort((x, y) => (y[0].source.includes('-') ? 1 : 0) - (x[0].source.includes('-') ? 1 : 0));
  // português europeu -> brasileiro (formas comuns em traduções de referência ou modelos)
  const PTPT = [
    ['facto', 'fato'], ['factos', 'fatos'], ['acção', 'ação'], ['acções', 'ações'], ['actual', 'atual'], ['actualmente', 'atualmente'], ['óptimo', 'ótimo'], ['óptima', 'ótima'], ['director', 'diretor'], ['directora', 'diretora'], ['directamente', 'diretamente'], ['exacto', 'exato'], ['exacta', 'exata'], ['exactamente', 'exatamente'], ['objecto', 'objeto'], ['objectos', 'objetos'], ['projecto', 'projeto'], ['projectos', 'projetos'], ['electricidade', 'eletricidade'], ['eléctrico', 'elétrico'], ['eléctrica', 'elétrica'], ['registo', 'registro'], ['registos', 'registros'], ['ecrã', 'tela'], ['telemóvel', 'celular'], ['casa de banho', 'banheiro'], ['autocarro', 'ônibus'], ['comboio', 'trem'], ['pequeno-almoço', 'café da manhã'], ['frigorífico', 'geladeira'], ['rapariga', 'moça'], ['raparigas', 'moças'], ['equipa', 'equipe'], ['secção', 'seção'], ['adopção', 'adoção'], ['receção', 'recepção'], ['génio', 'gênio'], ['génios', 'gênios'], ['económico', 'econômico'], ['económica', 'econômica'], ['académico', 'acadêmico'], ['António', 'Antônio'], ['bebé', 'bebê'], ['bebés', 'bebês'], ['ténis', 'tênis'], ['quilómetro', 'quilômetro'], ['quilómetros', 'quilômetros'], ['fenómeno', 'fenômeno'], ['fenómenos', 'fenômenos']
  ].map(([a, b]) => W(a, b, 'Forma do português europeu → brasileiro'));
  // trema abolido (exceto nomes próprios estrangeiros, com maiúscula)
  const TREMA = [/(^|[^\p{L}])(\p{Ll}[\p{L}]*?)ü/gu];
  // prefixos com hífen: regra nova (vogal + r/s dobra; vogais diferentes juntam; iguais mantêm hífen)
  const PREFIXES = ['anti', 'auto', 'contra', 'extra', 'infra', 'intra', 'semi', 'supra', 'ultra', 'mini', 'micro', 'macro', 'mega', 'multi', 'neo', 'pseudo', 'proto', 'tele', 'arqui', 'agro', 'eletro', 'hidro', 'foto', 'geo', 'radio', 'retro', 'socio', 'sobre', 'maxi', 'poli', 'pluri'];
  const PREFIX_RE = new RegExp(`(^|[^\\p{L}])(${PREFIXES.join('|')})-(\\p{Ll}+)`, 'giu');

  function orthography(text) {
    const hits = [];
    const note = rule => { hits.push(rule); };
    let t = text;
    for (const [re, to, rule] of ACC.concat(PTPT)) t = t.replace(re, (m, pre) => { note(rule); return pre + (/^\p{Lu}/u.test(m.slice(pre.length)) && !/^\p{Lu}/u.test(to) ? to[0].toUpperCase() + to.slice(1) : to); });
    t = t.replace(TREMA[0], (m, pre, stem) => { note('Trema abolido (freqüente → frequente)'); return pre + stem + 'u'; });
    t = t.replace(/(\p{Ll})ü/gu, (m, a) => { note('Trema abolido (freqüente → frequente)'); return a + 'u'; });
    t = t.replace(PREFIX_RE, (m, pre, px, rest) => {
      const last = px[px.length - 1].toLowerCase(), first = rest[0].toLowerCase();
      if (first === 'h' || first === last) return m; // anti-higiênico, micro-ondas, contra-ataque
      const vowel = /[aeiou]/.test(last);
      let out;
      if (vowel && /[rs]/.test(first)) out = px + first + rest; // antissocial, autorretrato
      else if (vowel) out = px + rest; // autoestima, extraescolar
      else return m;
      note('Hífen com prefixos (auto-estima → autoestima; anti-social → antissocial)');
      return pre + out;
    });
    return { text: t, hits };
  }

  // ---------------------------------------------------------------- dicionário de estilo
  const BODY = 'cabeça|mão|mãos|olhos|olho|braço|braços|perna|pernas|pé|pés|boca|lábios|dentes|ombros|ombro|cabelo|cabelos|rosto|testa|nariz|queixo|dedos|dedo|punho|punhos|joelhos|joelho|costas|garganta|pescoço|sobrancelhas|sobrancelha|pálpebras|bochecha|bochechas|orelha|orelhas|peito|coração';
  // substantivos femininos em -er (“ali estava a mulher” não é “estava a fazer”; os masculinos levariam “o”)
  const NOUNS_R = new Set(['mulher', 'mulheres', 'colher', 'talher']);
  const DICT = [
    // pleonasmos
    [/\bsubir para cima\b/gi, 'subir', 'Pleonasmo'], [/\bsubiu para cima\b/gi, 'subiu', 'Pleonasmo'], [/\bdescer para baixo\b/gi, 'descer', 'Pleonasmo'], [/\bdesceu para baixo\b/gi, 'desceu', 'Pleonasmo'],
    [/\bentrar para dentro\b/gi, 'entrar', 'Pleonasmo'], [/\bentrou para dentro\b/gi, 'entrou', 'Pleonasmo'], [/\bsair para fora\b/gi, 'sair', 'Pleonasmo'], [/\bsaiu para fora\b/gi, 'saiu', 'Pleonasmo'],
    [/\belo de ligação\b/gi, 'elo', 'Pleonasmo'], [/\bhá (\S+) (anos|meses|dias|semanas|horas|minutos|séculos) atrás\b/gi, 'há $1 $2', 'Pleonasmo (há … atrás)'],
    [/\bencarar de frente\b/gi, 'encarar', 'Pleonasmo'], [/\bsurpresa inesperada\b/gi, 'surpresa', 'Pleonasmo'], [/\boutra alternativa\b/gi, 'alternativa', 'Pleonasmo'], [/\bconsenso geral\b/gi, 'consenso', 'Pleonasmo'],
    [/\bmonopólio exclusivo\b/gi, 'monopólio', 'Pleonasmo'], [/\brepetir de novo\b/gi, 'repetir', 'Pleonasmo'], [/\brepetiu de novo\b/gi, 'repetiu', 'Pleonasmo'], [/\bplanos para o futuro\b/gi, 'planos', 'Pleonasmo'], [/\bpequenos detalhes\b/gi, 'detalhes', 'Pleonasmo'], [/\bganhar grátis\b/gi, 'ganhar', 'Pleonasmo'], [/\bmeio-dia e meio\b/gi, 'meio-dia e meia', 'Concordância'],
    // decalques do inglês (falsos cognatos e construções)
    [/\brealizou que\b/gi, 'percebeu que', 'Falso cognato (realize = perceber)'], [/\brealizei que\b/gi, 'percebi que', 'Falso cognato (realize = perceber)'], [/\brealizar que\b/gi, 'perceber que', 'Falso cognato (realize = perceber)'], [/\brealizando que\b/gi, 'percebendo que', 'Falso cognato (realize = perceber)'], [/\brealizaram que\b/gi, 'perceberam que', 'Falso cognato (realize = perceber)'],
    [/\bno final do dia\b/gi, 'no fim das contas', 'Decalque do inglês (at the end of the day)'], [/\bfazer uma decisão\b/gi, 'tomar uma decisão', 'Decalque do inglês (make a decision)'], [/\bfez uma decisão\b/gi, 'tomou uma decisão', 'Decalque do inglês (make a decision)'],
    [/\btomar lugar\b/gi, 'acontecer', 'Decalque do inglês (take place)'], [/\btomou lugar\b/gi, 'aconteceu', 'Decalque do inglês (take place)'], [/\bem ordem de\b/gi, 'para', 'Decalque do inglês (in order to)'], [/\bpelo caminho\b(?= ,)/gi, 'aliás', 'Decalque do inglês (by the way)'],
    [/\bsuportar (a ideia|o plano|a decisão|a causa)\b/gi, 'apoiar $1', 'Falso cognato (support = apoiar)'], [/\beventualmente,? (ele|ela|eles|elas|nós|eu)\b/gi, 'por fim, $1', 'Falso cognato (eventually = por fim)'],
    // literalismos da tradução automática e construções do português europeu
    [/\bem adição a\b/gi, 'além de', 'Decalque do inglês (in addition to)'], [/\bem adição,/gi, 'além disso,', 'Decalque do inglês (in addition)'],
    [/\bde novo e de novo\b/gi, 'repetidas vezes', 'Decalque do inglês (again and again)'], [/\bmais e mais\b/gi, 'cada vez mais', 'Decalque do inglês (more and more)'],
    [/\bao invés de\b/gi, 'em vez de', 'Norma culta (ao invés de = ao contrário de)'], [/\benquanto que\b/gi, 'enquanto', 'Expressão redundante (enquanto que)'],
    [/\ba nível de\b/gi, 'em termos de', 'Expressão condenada (a nível de)'], [/\bisso é porque\b/gi, 'isso porque', 'Decalque do inglês (that is because)'],
    [/\bno caso de que\b/gi, 'caso', 'Construção pesada (no caso de que)'], [/\bpara o caso de que\b/gi, 'caso', 'Construção pesada'],
    [/\b(estava|estavas|estou|está|estás|estavam|estão|estamos|estávamos|esteve|estive|estiveram|ficou|ficava|fiquei|continuou|continuava|andava|anda) a (\p{Ll}+)(ar|er|ir)\b/giu,
      (m, aux, stem, end) => (NOUNS_R.has((stem + end).toLowerCase()) ? m : `${aux} ${stem}${{ ar: 'ando', er: 'endo', ir: 'indo' }[end.toLowerCase()]}`), 'Português europeu → brasileiro (estava a fazer → estava fazendo)'],
    // possessivo desnecessário com partes do corpo (decalque de “his head”)
    [new RegExp(`\\b(balançou|balançava|balançando|sacudiu|sacudia|levantou|levantava|ergueu|erguia|abriu|abria|fechou|fechava|esfregou|esfregava|coçou|coçava|cruzou|cruzava|apertou|apertava|mordeu|mordia|passou|passava|enfiou|enfiava|estendeu|estendia|baixou|baixava|virou|virava|inclinou|inclinava|estalou|estalava|lambeu|lambia|franziu|franzia|arqueou|arqueava|ergui|levantei|abri|fechei|balancei|sacudi|cruzei|estendi|baixei|virei)\\s+(sua|seu|suas|seus|minha|meu|minhas|meus)\\s+(${BODY})\\b`, 'giu'),
      (m, v, poss, part) => `${v} ${/^(sua|minha)$/i.test(poss) ? 'a' : /^(seu|meu)$/i.test(poss) ? 'o' : /^(suas|minhas)$/i.test(poss) ? 'as' : 'os'} ${part}`, 'Possessivo desnecessário com parte do corpo (balançou sua cabeça → balançou a cabeça)']
  ];
  function dictionary(text) {
    const hits = [];
    let t = text;
    for (const [re, to, rule] of DICT) t = t.replace(re, (...a) => { hits.push(rule); const m = a[0]; const out = typeof to === 'function' ? to(...a) : m.replace(new RegExp(re.source, re.flags.replace('g', '')), to); return /^\p{Lu}/u.test(m) && !/^\p{Lu}/u.test(out) ? out[0].toUpperCase() + out.slice(1) : out; });
    return { text: t, hits };
  }

  // ---------------------------------------------------------------- grafias antigas (antes de 1943 e de 1971)
  // Livros do Domínio Público costumam trazer a ortografia da época (“ella”, “pharmacia”, “sôbre”). As formas
  // abaixo são atualizadas para a escrita brasileira atual; a lista evita mexer em nomes próprios e em palavras
  // que continuam corretas.
  const OLD = {
    // pronomes e contrações com consoante dobrada
    ella: 'ela', ellas: 'elas', elle: 'ele', elles: 'eles', aquella: 'aquela', aquellas: 'aquelas', aquelle: 'aquele', aquelles: 'aqueles',
    daquella: 'daquela', daquellas: 'daquelas', daquelle: 'daquele', daquelles: 'daqueles', naquella: 'naquela', naquellas: 'naquelas', naquelle: 'naquele', naquelles: 'naqueles',
    della: 'dela', dellas: 'delas', delle: 'dele', delles: 'deles', nella: 'nela', nellas: 'nelas', nelle: 'nele', nelles: 'neles', pella: 'pela', pellas: 'pelas', pello: 'pelo', pellos: 'pelos',
    esta: null, alli: 'ali', aquillo: 'aquilo', naquillo: 'naquilo', daquillo: 'daquilo', d: null,
    // h, y, ph, th, ch (= k) e consoantes mudas
    hontem: 'ontem', hombro: 'ombro', hombros: 'ombros', cahir: 'cair', cahiu: 'caiu', cahia: 'caía', cahido: 'caído', cahida: 'caída', sahir: 'sair', sahiu: 'saiu', sahia: 'saía', sahida: 'saída', sahido: 'saído',
    prohibir: 'proibir', prohibido: 'proibido', prohibida: 'proibida', comprehender: 'compreender', comprehendo: 'compreendo', comprehendia: 'compreendia', comprehendeu: 'compreendeu', comprehensão: 'compreensão', reprehender: 'repreender', reprehensão: 'repreensão',
    estylo: 'estilo', estylos: 'estilos', typo: 'tipo', typos: 'tipos', lyrio: 'lírio', lyrios: 'lírios', lyra: 'lira', lyrico: 'lírico', lyrica: 'lírica', mysterio: 'mistério', mysterios: 'mistérios', mysterioso: 'misterioso', mysteriosa: 'misteriosa', mysteriosos: 'misteriosos', mysteriosas: 'misteriosas',
    sympathia: 'simpatia', sympathico: 'simpático', sympathica: 'simpática', sympathicos: 'simpáticos', sympathicas: 'simpáticas', symbolo: 'símbolo', symbolos: 'símbolos', systema: 'sistema', systemas: 'sistemas', hysterico: 'histérico', hysterica: 'histérica', martyr: 'mártir', martyrio: 'martírio', abysmo: 'abismo', abysmos: 'abismos', hymno: 'hino', hymnos: 'hinos', nympha: 'ninfa', nymphas: 'ninfas', cysne: 'cisne', cysnes: 'cisnes',
    philosophia: 'filosofia', philosopho: 'filósofo', philosophos: 'filósofos', philosophico: 'filosófico', physionomia: 'fisionomia', physionomias: 'fisionomias', physica: 'física', physico: 'físico', phantasia: 'fantasia', phantasias: 'fantasias', phantasma: 'fantasma', phantasmas: 'fantasmas', pharmacia: 'farmácia', pharmaceutico: 'farmacêutico', photographia: 'fotografia', photographias: 'fotografias', phrase: 'frase', phrases: 'frases', pharol: 'farol', triumpho: 'triunfo', triumphos: 'triunfos', triumphante: 'triunfante', orthographia: 'ortografia', telegrapho: 'telégrafo', telegramma: 'telegrama', telegrammas: 'telegramas', geographia: 'geografia', prophecia: 'profecia', propheta: 'profeta', prophetas: 'profetas', epitaphio: 'epitáfio', elephante: 'elefante', elephantes: 'elefantes', amphitheatro: 'anfiteatro', orphão: 'órfão', orphã: 'órfã', orphãos: 'órfãos', phenomeno: 'fenômeno', phenomenos: 'fenômenos', estrophe: 'estrofe', estrophes: 'estrofes', catastrophe: 'catástrofe', phosphoro: 'fósforo', phosphoros: 'fósforos', nymphéa: 'ninfeia',
    theatro: 'teatro', theatros: 'teatros', thesouro: 'tesouro', thesouros: 'tesouros', theoria: 'teoria', theorias: 'teorias', thema: 'tema', themas: 'temas', methodo: 'método', methodos: 'métodos', atheu: 'ateu', authoridade: 'autoridade', authoridades: 'autoridades', athleta: 'atleta', rhythmo: 'ritmo', rheumatismo: 'reumatismo', thronos: 'tronos', throno: 'trono', ethica: 'ética', sabbado: 'sábado', sabbados: 'sábados', cathedral: 'catedral', cathedra: 'cátedra', catholico: 'católico', catholica: 'católica', catholicos: 'católicos', lethargo: 'letargo', apotheose: 'apoteose', hypothese: 'hipótese', hypotheses: 'hipóteses', sympathizar: 'simpatizar',
    christão: 'cristão', christã: 'cristã', christãos: 'cristãos', christãs: 'cristãs', chimica: 'química', chimico: 'químico', chronica: 'crônica', chronicas: 'crônicas', chronista: 'cronista', chronologia: 'cronologia', chimera: 'quimera', chimeras: 'quimeras', chaos: 'caos', chôro: 'choro', archanjo: 'arcanjo', archivo: 'arquivo', archivos: 'arquivos', architecto: 'arquiteto', architectura: 'arquitetura', orchestra: 'orquestra', orchestras: 'orquestras', melancholia: 'melancolia', melancholico: 'melancólico', melancholica: 'melancólica', monarchia: 'monarquia', anarchia: 'anarquia', patriarcha: 'patriarca', machina: 'máquina', machinas: 'máquinas', machinal: 'maquinal', machinalmente: 'maquinalmente', echo: 'eco', echos: 'ecos', characteristico: 'característico', character: 'caráter',
    sciencia: 'ciência', sciencias: 'ciências', scientifico: 'científico', sceptico: 'cético', scena: 'cena', scenas: 'cenas', scenario: 'cenário', sceptro: 'cetro', consciencia: 'consciência', sciente: 'ciente', nascer: null, discipulo: 'discípulo', discipulos: 'discípulos',
    auctor: 'autor', auctores: 'autores', fructo: 'fruto', fructos: 'frutos', victoria: 'vitória', victorias: 'vitórias', victima: 'vítima', victimas: 'vítimas', escripto: 'escrito', escripta: 'escrita', escriptos: 'escritos', escriptas: 'escritas', escriptor: 'escritor', escriptores: 'escritores', escriptorio: 'escritório', descripção: 'descrição', assignar: 'assinar', assignou: 'assinou', assignado: 'assinado', assignatura: 'assinatura', signal: 'sinal', signaes: 'sinais', digno: null, prompto: 'pronto', prompta: 'pronta', promptos: 'prontos', promptamente: 'prontamente', exacto: 'exato', exacta: 'exata', exactamente: 'exatamente', acto: 'ato', actos: 'atos', actor: 'ator', actriz: 'atriz', facto: 'fato', factos: 'fatos', affecto: 'afeto', affectos: 'afetos', affectuoso: 'afetuoso', affectuosa: 'afetuosa', aspecto: null, objecto: 'objeto', objectos: 'objetos', projecto: 'projeto', projectos: 'projetos', director: 'diretor', directora: 'diretora', directo: 'direto', directa: 'direta', directamente: 'diretamente', redacção: 'redação', acção: 'ação', acções: 'ações', direcção: 'direção', satisfação: null, sancto: 'santo', sancta: 'santa', baptismo: 'batismo', baptizar: 'batizar', baptisado: 'batizado', egreja: 'igreja', egrejas: 'igrejas',
    // acentos que a ortografia antiga não usava
    posthumas: 'póstumas', posthuma: 'póstuma', posthumo: 'póstumo', posthumos: 'póstumos', memorias: 'memórias', memoria: 'memória', historia: 'história', historias: 'histórias', patria: 'pátria', familia: 'família', familias: 'famílias', tragedia: 'tragédia', comedia: 'comédia', sabio: 'sábio', sabios: 'sábios', unico: 'único', unica: 'única', ultimo: 'último', ultima: 'última', ultimos: 'últimos', ultimas: 'últimas', proprio: 'próprio', propria: 'própria', proprios: 'próprios', proprias: 'próprias', espirito: 'espírito', espiritos: 'espíritos', lagrima: 'lágrima', lagrimas: 'lágrimas', musica: 'música', pagina: 'página', paginas: 'páginas', camara: 'câmara', paciencia: 'paciência', sciente: 'ciente', facil: 'fácil', faceis: 'fáceis', util: 'útil', inutil: 'inútil', amavel: 'amável', terrivel: 'terrível', terriveis: 'terríveis', impossivel: 'impossível', possivel: 'possível', horrivel: 'horrível', sensivel: 'sensível', invisivel: 'invisível', visivel: 'visível', alem: 'além', porem: 'porém', tambem: 'também', armazem: 'armazém',
    'á': 'à', 'ás': 'às', capitulo: 'capítulo', capitulos: 'capítulos', tremula: 'trêmula', tremulo: 'trêmulo', lampada: 'lâmpada', lampadas: 'lâmpadas', mysticos: 'místicos', duvida: null,
    // dobradas e terminações antigas
    anno: 'ano', annos: 'anos', annual: 'anual', annuncio: 'anúncio', annuncios: 'anúncios', commodo: 'cômodo', commodos: 'cômodos', commum: 'comum', communs: 'comuns', commercio: 'comércio', commissão: 'comissão', commover: 'comover', commoção: 'comoção', commovido: 'comovido', commovida: 'comovida', immenso: 'imenso', immensa: 'imensa', immensos: 'imensos', immensas: 'imensas', immediato: 'imediato', immediatamente: 'imediatamente', immortal: 'imortal', immovel: 'imóvel', innocente: 'inocente', innocentes: 'inocentes', innocencia: 'inocência', effeito: 'efeito', effeitos: 'efeitos', effectivamente: 'efetivamente', official: 'oficial', officiaes: 'oficiais', officio: 'ofício', differente: 'diferente', differentes: 'diferentes', differença: 'diferença', difficil: 'difícil', difficeis: 'difíceis', difficuldade: 'dificuldade', difficuldades: 'dificuldades', offerecer: 'oferecer', offereceu: 'ofereceu', offerta: 'oferta', soffrer: 'sofrer', soffria: 'sofria', soffreu: 'sofreu', soffrimento: 'sofrimento', soffrimentos: 'sofrimentos', attenção: 'atenção', attento: 'atento', attenta: 'atenta', attitude: 'atitude', attingir: 'atingir', attrahir: 'atrair', attrahiu: 'atraiu', attractivo: 'atrativo', acceitar: 'aceitar', acceitou: 'aceitou', acceito: 'aceito', accordo: 'acordo', accordar: 'acordar', accordou: 'acordou', accender: 'acender', accendeu: 'acendeu', accesso: 'acesso', accrescentar: 'acrescentar', accrescentou: 'acrescentou', accusar: 'acusar', accusação: 'acusação', occasião: 'ocasião', occasiões: 'ocasiões', occupar: 'ocupar', occupado: 'ocupado', occupada: 'ocupada', occupação: 'ocupação', occorrer: 'ocorrer', occorreu: 'ocorreu', succeder: 'suceder', succedeu: 'sucedeu', successo: 'sucesso', successos: 'sucessos', successivamente: 'sucessivamente', suppor: 'supor', supponho: 'suponho', supposto: 'suposto', supplicar: 'suplicar', supplicio: 'suplício', apparecer: 'aparecer', appareceu: 'apareceu', apparecia: 'aparecia', apparencia: 'aparência', apparentemente: 'aparentemente', appellido: 'apelido', applicar: 'aplicar', applauso: 'aplauso', applausos: 'aplausos', approximar: 'aproximar', approximou: 'aproximou', apprender: 'aprender', apprendeu: 'aprendeu', aggravar: 'agravar', aggressão: 'agressão', bello: 'belo', bella: 'bela', bellos: 'belos', bellas: 'belas', bellezas: 'belezas', belleza: 'beleza', gallinha: 'galinha', gallinhas: 'galinhas', collegio: 'colégio', collega: 'colega', collegas: 'colegas', collocar: 'colocar', collocou: 'colocou', cavallo: 'cavalo', cavallos: 'cavalos', estrella: 'estrela', estrellas: 'estrelas', donzella: 'donzela', donzellas: 'donzelas', sello: 'selo', sellos: 'selos', mollhado: 'molhado', villa: 'vila', villas: 'vilas', aldêa: 'aldeia', aldêas: 'aldeias', idéa: 'ideia', idéas: 'ideias', cêa: 'ceia', arêa: 'areia', arêas: 'areias', cadêa: 'cadeia', cadêas: 'cadeias', vêa: 'veia', vêas: 'veias', mãi: 'mãe', mãis: 'mães', pae: 'pai', paes: 'pais', sae: 'sai', cae: 'cai', vae: 'vai', vaes: 'vais', trahir: 'trair', trahiu: 'traiu', traição: null, logar: 'lugar', logares: 'lugares', egual: 'igual', eguaes: 'iguais', egualmente: 'igualmente', tambem: 'também', porém: null, alguem: 'alguém', ninguem: 'ninguém', ha: null, sómente: 'somente', só: null, sinão: 'senão', sôbre: 'sobre', bôa: 'boa', bôas: 'boas', pessôa: 'pessoa', pessôas: 'pessoas', lagôa: 'lagoa', lagôas: 'lagoas', canôa: 'canoa', canôas: 'canoas', côr: 'cor', côres: 'cores', flôr: 'flor', flôres: 'flores', amôr: 'amor', êle: 'ele', êles: 'eles', êste: 'este', êstes: 'estes', êsse: 'esse', êsses: 'esses', dêle: 'dele', dêles: 'deles', nêle: 'nele', dêste: 'deste', dêsse: 'desse', nêste: 'neste', nêsse: 'nesse', aquêle: 'aquele', aquêles: 'aqueles', tôda: 'toda', tôdas: 'todas', tôdo: 'todo', tôdos: 'todos', fôsse: 'fosse', fôssem: 'fossem', mêdo: 'medo', ôlho: 'olho', ôlhos: 'olhos', pôrto: 'porto', govêrno: 'governo', almôço: 'almoço', fôrça: 'força', fôrças: 'forças', pêso: 'peso', sêco: 'seco', sêca: 'seca', côrte: 'corte', gôsto: 'gosto', bôlso: 'bolso', esfôrço: 'esforço', sôpro: 'sopro', êrro: 'erro', êrros: 'erros', cêdo: 'cedo', êle: 'ele', mêsmo: 'mesmo', mêsma: 'mesma', pôça: 'poça', tôrre: 'torre', ôvo: 'ovo', êsse: 'esse', súbito: null, cousa: null, mez: 'mês', mezes: 'meses', fez: null, vez: null, portuguez: 'português', portuguezes: 'portugueses', inglez: 'inglês', inglezes: 'ingleses', francez: 'francês', francezes: 'franceses', marquez: 'marquês', camponez: 'camponês', burguez: 'burguês', cortez: 'cortês', atravez: 'através', tranquillo: 'tranquilo', tranquilla: 'tranquila', tranquillidade: 'tranquilidade', ancião: null, emfim: 'enfim', emquanto: 'enquanto', comtudo: 'contudo', comsigo: 'consigo', comtanto: 'contanto', sinão: 'senão', idade: null, hoje: null
  };
  const OLD_RE = new RegExp('(^|[^\\p{L}])(' + Object.keys(OLD).filter(k => OLD[k]).sort((a, b) => b.length - a.length).join('|') + ')(?=$|[^\\p{L}])', 'giu');
  function archaic(text, opts) {
    const titleMode = !!(opts && opts.title); // título da obra: palavras com maiúscula também mudam
    const hits = [];
    const PRON = /^(d|n)?(aqu)?(ell|ell)(a|e|as|es)$|^(p|d|n)ell(a|e|o|as|es|os)$/i;
    const t = String(text).replace(OLD_RE, (m, pre, w, off, str) => {
      const lw = w.toLowerCase();
      let to = OLD[lw];
      if (!to) return m;
      // inicial maiúscula no meio da frase pode ser nome próprio (Villa-Lobos, Bella Vista): só pronomes mudam
      if (!titleMode && w[0] !== w[0].toLowerCase() && w !== w.toUpperCase() && !PRON.test(w)) {
        if (str[off + m.length] === '-') return m; // nome composto (Villa-Lobos)
        const before = str.slice(0, off + pre.length).replace(/\s+$/, '');
        if (before && !/[.!?…:—–"“«(]$/.test(before)) return m;
      }
      // preserva a caixa: Ella → Ela; ELLA → ELA
      if (w === w.toUpperCase() && w.length > 1) to = to.toUpperCase();
      else if (w[0] === w[0].toUpperCase()) to = to[0].toUpperCase() + to.slice(1);
      hits.push(`Grafia antiga atualizada (${lw} → ${OLD[lw]})`);
      return pre + to;
    });
    return { text: t, hits };
  }

  // ---------------------------------------------------------------- pontuação editorial
  function punctuation(text) {
    const hits = [];
    let t = text;
    const rep = (re, to, rule) => { t = t.replace(re, (...a) => { hits.push(rule); return typeof to === 'function' ? to(...a) : a[0].replace(new RegExp(re.source, re.flags.replace('g', '')), to); }); };
    rep(/\.\.\./g, '…', 'Reticências tipográficas (... → …)');
    rep(/ {2,}/g, ' ', 'Espaços duplos');
    rep(/ +([,.;:!?…])/g, '$1', 'Espaço antes da pontuação');
    rep(/(\S) - (\S)/g, `$1 ${EM} $2`, 'Hífen usado como travessão ( - → — )');
    rep(/(\S) – (\S)/g, `$1 ${EM} $2`, 'Meia-risca usada como travessão ( – → — )');
    rep(/--/g, EM, 'Travessão tipográfico (-- → —)');
    // aspas retas → curvas (“ ” e ‘ ’)
    rep(/"([^"\n]*)"/g, '“$1”', 'Aspas retas → aspas curvas');
    rep(/(^|[\s(\[{“])'(\S[^'\n]*?)'(?=[\s.,;:!?…)\]}”]|$)/g, '$1‘$2’', 'Aspas simples retas → curvas');
    rep(/(\p{L})'(\p{L})/gu, '$1’$2', 'Apóstrofo tipográfico');
    rep(/([!?])\1{2,}/g, '$1', 'Pontuação repetida');
    rep(/,,/g, ',', 'Vírgula duplicada');
    return { text: t, hits };
  }

  // ---------------------------------------------------------------- diálogos: aspas -> travessão
  // Converte um parágrafo de fala (que começa com aspas) para o padrão brasileiro:
  // “Olá,” disse ele. “Tudo bem?”  ->  —Olá — disse ele. — Tudo bem?
  const OPEN = '“"«„', CLOSE = '”"»“';
  function dialogue(text, opts) {
    opts = opts || {};
    const glue = opts.glue !== false; // travessão colado na fala que abre o parágrafo
    const s = text.replace(/^\s+/, '');
    // travessão/hífen de diálogo já usado: só normaliza
    if (/^[-–—]\s*\S/.test(s)) {
      const out = s.replace(/^[-–—]\s*/, glue ? EM : EM + ' ').replace(/(\S)\s+[-–]\s+(?=\p{Ll})/gu, `$1 ${EM} `);
      return { text: out, changed: out !== s, kind: 'normalize' };
    }
    if (!OPEN.includes(s[0])) return { text, changed: false };
    // separa falas e narração pelas aspas
    const parts = [];
    let cur = '', inSpeech = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (!inSpeech && OPEN.includes(c) && (c !== '"' || i === 0 || /[\s(—]/.test(s[i - 1]))) { if (cur.trim()) parts.push({ t: cur, sp: false }); cur = ''; inSpeech = true; continue; }
      if (inSpeech && CLOSE.includes(c) && (c !== '“')) { parts.push({ t: cur, sp: true }); cur = ''; inSpeech = false; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push({ t: cur, sp: inSpeech });
    if (!parts.some(p => p.sp)) return { text, changed: false };
    // aspas dentro da narração (citação) ou falas sem fechamento: não mexe
    if (parts.filter(p => !p.sp).some(p => /[“”"]/.test(p.t))) return { text, changed: false };
    let out = '';
    let joinNext = false; // narração terminada em vírgula: a fala seguinte continua a mesma frase (—, …)
    parts.forEach((p, i) => {
      if (p.sp) {
        let sp = p.t.trim();
        const next = parts[i + 1];
        // “Olá,” disse ele -> —Olá — disse ele (a vírgula da fala vai embora antes do verbo de elocução)
        if (next && !next.sp && /^\s*[,]?\s*\p{Ll}/u.test(next.t)) sp = sp.replace(/,$/, '');
        if (i === 0) out += (glue ? EM : EM + ' ') + sp;
        else if (joinNext) out += ' ' + sp;
        else out += (out.endsWith(' ') ? '' : ' ') + EM + ' ' + sp;
        joinNext = false;
      } else {
        const prev = parts[i - 1], next = parts[i + 1];
        let n = p.t.replace(/^\s*,\s*/, ' ').replace(/^\s+/, ' ').replace(/\s+$/, '');
        // só pontuação depois da última fala (”.): cola na fala
        if (!/\p{L}/u.test(n)) { out += n.trim(); return; }
        if (prev && prev.sp) n = ' ' + EM + n;
        if (next && next.sp) {
          if (/,$/.test(n) && /^\s*\p{Ll}/u.test(next.t)) { n = n.replace(/,$/, '') + ' ' + EM + ','; joinNext = true; }
          else { n = n.replace(/,$/, '.'); if (!/[.!?…:]$/.test(n)) n += '.'; }
        } else n = n.replace(/,$/, '.');
        out += n + (next ? ' ' : '');
      }
    });
    out = out.replace(/\s+([.,;!?…])/g, '$1').replace(/ {2,}/g, ' ').trim();
    return { text: out, changed: out !== s, kind: 'quotes' };
  }

  // ---------------------------------------------------------------- legibilidade
  const syl = w => { const m = w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[aeiouy]+/g); return Math.max(1, m ? m.length : 1); };
  function readability(text) {
    const sentences = text.split(/[.!?…]+(?=\s|$)/).map(s => s.trim()).filter(s => /\p{L}/u.test(s));
    const words = (text.match(/\p{L}[\p{L}'’-]*/gu) || []);
    const nS = Math.max(1, sentences.length), nW = Math.max(1, words.length);
    const sy = words.reduce((a, w) => a + syl(w), 0);
    // Flesch adaptado ao português (Martins et al.)
    const flesch = Math.round(Math.max(0, Math.min(100, 248.835 - 1.015 * (nW / nS) - 84.6 * (sy / nW))));
    const long = sentences.filter(s => (s.match(/\p{L}+/gu) || []).length > 45).length;
    return { flesch, sentences: nS, words: nW, avgSentence: +(nW / nS).toFixed(1), longSentences: long, level: flesch >= 75 ? 'muito fácil' : flesch >= 50 ? 'fácil' : flesch >= 25 ? 'difícil' : 'muito difícil' };
  }
  // palavras de conteúdo repetidas a menos de 12 palavras de distância (cacoete de repetição)
  const STOP = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob que se e é ou mas mais menos como quando onde já não sim muito pouco ele ela eles elas eu tu você vocês nós me te lhe lhes nos vos seu sua seus suas meu minha meus minhas isso isto aquilo esse essa este esta aquele aquela foi era ser estar está estava tinha ter há havia fez faz disse ao aos à às entre até sobre depois antes ainda então também só tão tudo nada algo alguém ninguém cada outro outra outros outras mesmo mesma'.split(' '));
  function repetitions(text) {
    const w = (text.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) || []);
    const last = new Map(); const out = new Map();
    w.forEach((x, i) => { if (x.length < 5 || STOP.has(x)) return; const j = last.get(x); if (j !== undefined && i - j < 12) out.set(x, (out.get(x) || 0) + 1); last.set(x, i); });
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
  }

  return { orthography, archaic, dictionary, punctuation, dialogue, readability, repetitions, EM };
});
