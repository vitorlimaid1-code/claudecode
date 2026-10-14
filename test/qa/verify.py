import json, re, subprocess, sys, collections, html
PT = 72 / 25.4
def run(*a): return subprocess.run(a, capture_output=True, text=True).stdout
def b36(n):
    s = ''
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if n == 0: return s
man = json.load(open(sys.argv[1]))
allok = True
for m in man:
    f = m['file']; probs = []
    info = run('pdfinfo', f); npages = int(re.search(r'Pages:\s+(\d+)', info).group(1))
    # caixas
    for pg in (1, 2):
        bx = run('pdfinfo', '-box', '-f', str(pg), '-l', str(pg), f)
        g = lambda k: [float(x) for x in re.search(k + r':\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)', bx).groups()]
        mb, tb = g('MediaBox'), g('TrimBox')
        tw, th = (tb[2] - tb[0]) / PT, (tb[3] - tb[1]) / PT
        mw, mh = (mb[2] - mb[0]) / PT, (mb[3] - mb[1]) / PT
        expW = m['w'] + (1 if m['kdp'] and m['bleed'] else 2) * m['bleed']; expH = m['h'] + 2 * m['bleed']
        if m.get('sheet'): expW, expH = m['sheet']
        if abs(tw - m['w']) > 0.1 or abs(th - m['h']) > 0.1: probs.append(f'p{pg} corte {tw:.2f}x{th:.2f} esperado {m["w"]}x{m["h"]}')
        if abs(mw - expW) > 0.1 or abs(mh - expH) > 0.1: probs.append(f'p{pg} folha {mw:.2f}x{mh:.2f} esperado {expW:.2f}x{expH:.2f}')
    # texto por página (com posições)
    xml = run('pdftotext', '-bbox', f, '-')
    pages = re.findall(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', xml, re.S)
    imgs = collections.Counter(int(l.split()[0]) for l in run('pdfimages', '-list', f).splitlines()[2:] if l.split())
    EXP = {'k' + b36(n) for n in range(m['total'])}
    tokens = collections.Counter(); blank = []; mirror = []; allseq = []
    for i, (pw, ph, body) in enumerate(pages, 1):
        ws = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', body)]
        if not ws and not imgs.get(i): blank.append(i)
        # junta artefatos da extração: capitular ("k" separado do resto) e chamada de nota colada ("k8b1")
        seq_ = [w[4].replace('­', '').replace('‑', '').replace('-', '') for w in ws]
        merged = list(seq_)
        allseq.extend(merged)
        for w4 in merged:
            for t in re.findall(r'k[0-9a-z]+', w4):
                if t not in EXP:
                    t2 = t
                    while t2 not in EXP and len(t2) > 2 and t2[-1].isdigit(): t2 = t2[:-1]
                    if t2 in EXP: t = t2
                tokens[t] += 1
        # margens: só palavras do corpo (marcadores), em páginas com bastante texto
        body_ws = [w for w in ws if re.fullmatch(r'k[0-9a-z]+[‑-]?', w[4].replace('­', ''))]
        if len(body_ws) > 120 and m['kind'] == 'book':
            bx = run('pdfinfo', '-box', '-f', str(i), '-l', str(i), f)
            t0 = float(re.search(r'TrimBox:\s+([-\d.]+)', bx).group(1)); m0 = float(re.search(r'MediaBox:\s+([-\d.]+)', bx).group(1))
            left = (min(w[0] for w in body_ws) - (t0 - m0)) / PT
            right = (m['w'] * PT - (max(w[2] for w in body_ws) - (t0 - m0))) / PT
            recto = i % 2 == 1
            expL, expR = (m['mi'], m['mo']) if recto else (m['mo'], m['mi'])
            if abs(left - expL) > 1.2 or (m.get('justify', True) and abs(right - expR) > 1.2): mirror.append(f'p{i}{"R" if recto else "V"} esq {left:.1f} (esp {expL}) dir {right:.1f} (esp {expR})')
    # reparos de extração, só para palavras que de fato não apareceram inteiras:
    # (a) kerning separou o fim da palavra ("kq" + "j"); (b) capitular "k" separada do resto,
    # às vezes com o número da página entre elas no fluxo de leitura
    def present(x): return tokens.get(x, 0) > 0
    for q, t in enumerate(allseq):
        for j in range(q + 1, min(q + 5, len(allseq))):
            if allseq[j].isdigit() and j > q + 1 and t != 'k': continue
            cand = t + allseq[j]
            if cand in EXP and not present(cand):
                tokens[cand] += 1
                for part in (t, allseq[j]):
                    for x in re.findall(r'k[0-9a-z]+', part):
                        if tokens.get(x): tokens[x] -= 1
                break
    # bug de leitura: hifenização quebra marcadores entre linhas -> junta pedaços
    exp = {'k' + b36(n) for n in range(m['total'])}
    missing = sorted(exp - set(tokens), key=lambda t: int(t[1:], 36)); dup = {t: c for t, c in tokens.items() if c > 1 and t in exp}
    extra = [t for t in tokens if t not in exp]
    if blank: probs.append(f'páginas em branco: {blank}')
    if missing: probs.append(f'{len(missing)} palavras faltando: {missing[:8]}')
    if dup: probs.append(f'{len(dup)} palavras duplicadas: {list(dup.items())[:8]}')
    if mirror: probs.append(f'margens espelhadas fora: {mirror[:4]} (+{max(0, len(mirror) - 4)})')
    # sumário: toda entrada precisa terminar com o número da página
    if m['kind'] == 'book':
        toc = run('pdftotext', '-layout', '-l', '6', f, '-')
        ents = [l for l in toc.splitlines() if re.match(r'\s*(Capítulo \d|Sobre o autor|Agradecimentos)', l)]
        semnum = [l.strip() for l in ents if not re.search(r'\d+\s*$', l)]
        if not ents or semnum: probs.append(f'sumário sem número: {semnum[:3] or "sem entradas"}')
    ok = not probs
    allok &= ok
    print(f"{'OK ' if ok else 'ERRO'} {m['name']:28s} {npages:3d} pág  corte {m['w']}x{m['h']}  sangria {m['bleed']:.3f}  palavras {len(exp)}" + ('' if ok else '\n     ' + '\n     '.join(probs)) + (f'\n     (fragmentos não reconhecidos: {extra[:6]})' if extra else ''))
print('TUDO OK' if allok else 'HÁ PROBLEMAS')
