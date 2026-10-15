/* global App, CoverGeometry, CedetSpine */
// Capa e lombada para capas já prontas: as dimensões vêm do livro em diagramação, de um
// manuscrito carregado (PDF, DOC, DOCX, ODT, HTML, EPUB, MOBI) ou são digitadas. A saída é
// sempre um PDF CMYK para gráfica (perfil ICC real, PDF/X-1a), com sangria automática ou manual.
(function () {
  const { el, $, api } = App;
  let frame = null;
  let proof = null;
  const guideState = { bleedLines: true, guides: true, bleed: true }; // linhas na prévia (não vão para o PDF)

  // Calculadora de lombada do Cedet: capa Triplex 250 e miolo Pólen Natural (B2B) 80, gramatura 75 g/m²
  const CEDET_COVER = CedetSpine.DEFAULT_COVER, CEDET_PAPER = CedetSpine.DEFAULT_PAPER, CEDET_GSM = 75;
  const paperName = t => String(t || '').replace(/POLÉN/g, 'PÓLEN').toLowerCase().replace(/(^|\s|\()(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\(b2b\)/i, '(B2B)');
  const barcodeDefaults = cedet => ({ enabled: !!cedet, isbn: '', pos: 'br', dx: 12, dy: 12, scale: 1, barHeight: 20, showIsbnText: true });

  function defaults() {
    const s = App.project.settings;
    const cedet = s.standard === 'cedet';
    return {
      cedet, chapada: 'auto', marks: { enabled: cedet, offset: 5, len: 5, weight: 0.25 }, isbnBarcode: barcodeDefaults(cedet), customIcc: null,
      source: 'book', trimW: s.pageWidth, trimH: s.pageHeight, pages: App.lastRender ? App.lastRender.pages : 120,
      paper: 'polen80', paperMm: 0.06, spineMode: 'auto', spine: '', bleedAuto: true, bleed: 3, flaps: 0, hardcover: false, wrapExtra: 15, boardExtra: 4, safety: 5,
      totalsManual: false, totalW: '', totalH: '', confirmed: null, fileInfo: null,
      barcode: false, bg: { front: '#ffffff', back: '#ffffff', spine: '#ffffff' }, images: {},
      profile: 'fogra39', intent: 'relative', bpc: true, dpi: 300, enhance: true, sharpen: true
    };
  }
  function cover() {
    const d = defaults();
    if (!App.project.cover) App.project.cover = d;
    const c = App.project.cover;
    Object.keys(d).forEach(k => { if (c[k] === undefined) c[k] = d[k]; });
    c.bg = c.bg || {}; c.images = c.images || {};
    c.isbnBarcode = Object.assign(barcodeDefaults(false), c.isbnBarcode || {});
    c.marks = Object.assign({ enabled: false, offset: 5, len: 5, weight: 0.25 }, c.marks || {});
    if (c.cedet) {
      // CEDET: lombada pela calculadora oficial (capa Triplex 250, miolo Pólen Natural B2B 80), sem orelhas, sangria 5 mm
      c.paper = 'cedetPolenNat80';
      c.cedetPaper = CEDET_PAPER;
      c.cedetCover = CEDET_COVER;
      // lombada sempre automática pela calculadora (a versão anterior a fixava ao confirmar)
      if (c.spineFor && c.spineFor.source === 'calculadora') { c.spineMode = 'auto'; c.spineFor = null; }
      c.bleedAuto = true;
      c.flaps = 0; // livros Cedet nunca têm orelhas
      c.hardcover = false;
      c.totalsManual = false;
    }
    // “inteira” deixava faixas brancas: a imagem sempre preenche o espaço (ou estica)
    Object.values(c.images).forEach(it => { if (it && it.fit === 'contain') it.fit = 'cover'; });
    return c;
  }

  function bookDims() {
    const s = App.project.settings;
    let pages = App.lastRender ? App.lastRender.pages : null;
    if (pages && pages % 2) pages += 1;
    return { trimW: s.pageWidth, trimH: s.pageHeight, pages };
  }
  // A capa acompanha o livro aberto na diagramação automaticamente (formato e páginas → lombada e capa aberta)
  function syncFromBook() {
    const c = App.project.cover;
    if (!c || c.source !== 'book') return;
    const d = bookDims();
    c.trimW = d.trimW; c.trimH = d.trimH;
    if (d.pages) c.pages = d.pages;
  }
  App.hooks.afterChange.push(o => { if (o && o.rendered) { syncFromBook(); if (App.view === 'cover') { updateSummary(); redraw(); } } });

  // Confirmar medidas: a capa já é calculada automaticamente a partir do livro aberto; este botão confere.
  // Pagina o miolo final exatamente como na exportação do PDF, recalcula a lombada pela calculadora do Cedet
  // e mostra se os números batem com o cálculo automático (corrige se a prévia ainda não tinha terminado).
  let confirming = false;
  async function confirmDims() {
    if (confirming) return;
    const c = cover();
    const before = CoverGeometry.geometry(c);
    const prevPages = c.pages;
    if (c.source === 'book') {
      confirming = true;
      App.toast('Conferindo: paginando o miolo final, como na exportação do PDF…');
      const r = await api.coverBookPages(App.serialize()).catch(e => ({ error: String(e.message || e) }));
      confirming = false;
      const d = bookDims();
      c.trimW = d.trimW; c.trimH = d.trimH;
      if (r && r.pages) c.pages = r.pages % 2 ? r.pages + 1 : r.pages;
      else if (d.pages) c.pages = d.pages;
      else return App.toast('Não foi possível contar as páginas do miolo' + (r && r.error ? ': ' + r.error : '.'));
      if (r && r.pages && r.complete === false) App.toast('Atenção: a paginação não chegou ao fim do livro; confira o miolo.');
    }
    if (c.cedet) {
      const calc = CedetSpine.spine(c.pages, CEDET_PAPER, CEDET_COVER);
      if (!calc.ok) { await api.confirm('Lombada fora da calculadora do Cedet', calc.error + '\n\nConsulte editoras-parceiras@cedet.com.br.', ['OK']); return; }
      c.spineMode = 'auto';
      c.totalsManual = false;
    }
    const g = CoverGeometry.geometry(c);
    const same = Math.abs(g.spine - before.spine) < 0.001 && Math.abs(g.totalW - before.totalW) < 0.001 && c.pages === prevPages;
    c.confirmed = { trimW: c.trimW, trimH: c.trimH, pages: c.pages, totalW: g.totalW, totalH: g.totalH, spine: g.spine, at: new Date().toISOString(), same, prevPages, prevSpine: before.spine };
    App.changed('Medidas da capa conferidas', { preview: false });
    proof = null;
    render();
    App.toast(same
      ? `✓ Conferido: ${c.pages} páginas, lombada ${App.fmtNum(g.spine)} mm, capa ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm — igual ao cálculo automático.`
      : `Corrigido: ${prevPages} → ${c.pages} páginas; lombada ${App.fmtNum(before.spine)} → ${App.fmtNum(g.spine)} mm; capa ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm.`);
  }

  async function loadManuscript() {
    const s = App.project.settings;
    const r = await api.coverAnalyze({ pageWidth: s.pageWidth, pageHeight: s.pageHeight, marginInner: s.marginInner, marginOuter: s.marginOuter, marginTop: s.marginTop, marginBottom: s.marginBottom, fontSize: s.styles.body.size, lineHeight: s.styles.body.lineHeight });
    if (!r) return;
    const c = cover();
    c.source = 'file';
    c.confirmed = null;
    c.totalsManual = false;
    c.spineMode = 'auto';
    c.trimW = r.trimW; c.trimH = r.trimH; c.pages = r.pages;
    c.fileInfo = { name: r.name, method: r.method, exact: r.exact, notes: [r.pagesNote, r.sizeNote].filter(Boolean) };
    App.changed('Dimensões da capa a partir de ' + r.name, { preview: false });
    render();
  }

  function useBook() {
    const c = cover();
    c.source = 'book'; c.confirmed = null; c.totalsManual = false; c.spineMode = 'auto'; c.fileInfo = null;
    syncFromBook();
    App.changed('Capa acompanha o livro em diagramação', { preview: false });
    render();
  }

  function updateSummary() {
    const box = $('#coverSummary');
    if (!box) return;
    const c = cover();
    const g = CoverGeometry.geometry(c);
    box.innerHTML = '';
    box.append(
      el('div', { class: 'cover-total' }, [
        el('div', {}, [el('span', { class: 'muted small', text: 'Tamanho total da capa (com sangria)' }), el('strong', { text: `${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Sem sangria (formato final aberto)' }), el('strong', { text: `${App.fmtNum(g.trimTotalW)} × ${App.fmtNum(g.H)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Lombada' }), el('strong', { text: `${App.fmtNum(g.spine)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Capa / contracapa' }), el('strong', { text: `${App.fmtNum(g.W)} × ${App.fmtNum(g.H)} mm` })]),
        el('div', {}, [el('span', { class: 'muted small', text: 'Sangria' }), el('strong', { text: `${App.fmtNum(g.bleed)} mm${g.wrap ? ` + ${App.fmtNum(g.wrap)} mm de dobra` : ''}` })])
      ]),
      el('div', { class: 'small muted', text: `${c.cedet && g.cedetCalc && c.spineMode !== 'manual' ? (g.cedetCalc.ok ? `Lombada automática pela calculadora do Cedet: ${g.cedetCalc.rawPages} páginas (linha ${g.cedetCalc.pages} da tabela) · miolo ${paperName(g.cedetCalc.paper)} · capa ${paperName(g.cedetCalc.cover)}` : g.cedetCalc.error) : c.spineMode === 'manual' ? 'Lombada digitada' : `Lombada calculada: ${g.pages} páginas × ${App.fmtNum(g.perPage, 4)} mm${c.hardcover ? ' + cartão' : ''}`}${g.spine < 6 ? ' · lombada fina: evite texto ou elementos importantes nela' : ''}` }),
    );
  }

  // logotipo (o da página de rosto) para a prévia da capa (a capa não leva QR code)
  const aspectCache = {};
  async function brandData(c) {
    const b = Object.assign({}, CoverGeometry.BRAND, c.brand || {});
    if (!b.enabled) return null;
    const out = {};
    const lg = App.project.titlePage.logo;
    if (b.logo !== false && lg && App.project.assets[lg]) {
      out.logoUrl = App.assetUrl(lg);
      if (!aspectCache[out.logoUrl]) aspectCache[out.logoUrl] = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth / im.naturalHeight || 2); im.onerror = () => res(2); im.src = out.logoUrl; });
      out.aspect = aspectCache[out.logoUrl];
    }
    return out;
  }

  async function drawPreview() {
    if (proof) return showProof();
    if (!frame || !frame.contentWindow || !frame.contentWindow.renderCover) return;
    const c = cover();
    const assets = {};
    Object.values(c.images).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = { dataUrl: App.assetUrl(it.asset) }; });
    const cc = Object.assign({}, c, { isbnBarcode: Object.assign({}, c.isbnBarcode, { isbn: (c.isbnBarcode && c.isbnBarcode.isbn) || App.project.meta.isbn }) });
    const r = await frame.contentWindow.renderCover({ cover: cc, assets, brand: await brandData(c) }, { bleed: guideState.bleed, guides: guideState.guides, bleedLines: guideState.bleedLines });
    const box = $('#coverStage');
    if (box) frame.contentWindow.setCoverZoom(Math.min(1.5, (box.clientWidth - 40) / r.wpx, (box.clientHeight - 40) / r.hpx));
  }
  const redraw = () => { clearTimeout(redraw._t); redraw._t = setTimeout(() => { updateSummary(); drawPreview(); }, 200); };

  async function runProof() {
    const c = cover();
    App.toast('Convertendo para CMYK…', 20000);
    App.flush();
    const assets = {};
    Object.values(c.images).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = App.project.assets[it.asset]; });
    const cc = JSON.parse(JSON.stringify(c));
    if (cc.isbnBarcode && !cc.isbnBarcode.isbn) cc.isbnBarcode.isbn = App.project.meta.isbn;
    const lg = App.project.titlePage.logo;
    cc.brand = Object.assign({}, CoverGeometry.BRAND, c.brand || {}, { logoAsset: lg || null });
    if (lg && App.project.assets[lg]) assets[lg] = App.project.assets[lg];
    proof = await api.coverProof(cc, assets);
    $('#toast').classList.remove('show');
    if (proof && proof.error) { App.toast('Erro: ' + proof.error, 6000); proof = null; return; }
    showProof();
  }
  function showProof() {
    const stage = $('#coverStage');
    if (!stage || !proof) return;
    stage.innerHTML = '';
    stage.append(
      el('div', { class: 'proof-bar' }, [
        el('strong', { text: 'Prova de cor: simulação da impressão em CMYK' }),
        el('span', { class: 'small', text: ` · ${proof.profile} · tinta máxima ${proof.maxTac}%${proof.maxTac > 320 ? ' (acima de 320%: risco de decalque/secagem)' : ''}` }),
        el('button', { class: 'small-btn', text: 'Voltar à prévia', onclick: () => { proof = null; render(); } })
      ]),
      el('img', { src: proof.dataUrl, class: 'proof-img' }),
      proof.notes && proof.notes.length ? el('ul', { class: 'small' }, proof.notes.map(n => el('li', { text: n }))) : null
    );
  }

  async function exportPdf() {
    App.flush();
    const c = cover();
    if (!Object.values(c.images).some(it => it && App.project.assets[it.asset])) {
      const b = await api.confirm('A capa não tem imagens.', 'Insira a capa pronta (imagem envolvente ou capa, lombada e contracapa) antes de exportar.', ['Exportar mesmo assim', 'Cancelar']);
      if (b !== 0) return;
    }
    App.toast('Gerando o PDF CMYK para gráfica…', 60000);
    if (c.cedet) {
      const errs = cedetCoverIssues(c);
      if (errs.length) {
        const b = await api.confirm('Conferência CEDET da capa', errs.map(x => '• ' + x).join('\n'), ['Exportar mesmo assim', 'Cancelar e corrigir']);
        if (b !== 0) return;
      }
    }
    const r = await api.exportRun({ kind: 'cover', project: App.serialize(), opts: { bleed: true, fileBase: c.cedet && App.cedetFileName ? App.cedetFileName('CAPA') : '' } });
    $('#toast').classList.remove('show');
    if (!r || !r.files) return;
    const rep = r.report || {};
    const b = await api.confirm('Capa exportada (PDF CMYK)!', `${r.files[0]}\n\n${App.fmtNum(rep.sizeMm[0])} × ${App.fmtNum(rep.sizeMm[1])} mm${rep.marks ? ` (folha ${App.fmtNum(rep.sheetMm[0])} × ${App.fmtNum(rep.sheetMm[1])} mm com marcas)` : ''} · ${rep.dpi} dpi · ${rep.profile}\nIntenção: ${rep.intent}${rep.bpc ? ' + compensação de ponto preto' : ''} · tinta máxima ${rep.maxTac}%\n${(rep.notes || []).join('\n')}`, ['Abrir', 'Mostrar na pasta', 'Fechar']);
    if (b === 0) api.openPath(r.files[0]); else if (b === 1) api.showItem(r.files[0]);
  }

  const BARCODE_EDGE = 5; // distância mínima do quadro do código até o corte/dobra (igual à marca de corte)
  // Problemas que o manual Cedet considera obrigatórios na capa
  function cedetCoverIssues(c) {
    const out = [];
    const g = CoverGeometry.geometry(c);
    const s = App.project.settings;
    const okFmt = [[155, 230], [137, 210], [115, 175]].some(([w, h]) => Math.abs(c.trimW - w) < 0.3 && Math.abs(c.trimH - h) < 0.3);
    if (!okFmt) out.push(`Formato ${App.fmtNum(c.trimW / 10)} × ${App.fmtNum(c.trimH / 10)} cm fora dos formatos Cedet (15,5 × 23, 13,7 × 21, 11,5 × 17,5 cm).`);
    if (Math.abs(c.trimW - s.pageWidth) > 0.3 || Math.abs(c.trimH - s.pageHeight) > 0.3) out.push('A capa não está no mesmo formato do miolo.');
    if (g.cedetCalc && !g.cedetCalc.ok) out.push(g.cedetCalc.error + ' Consulte editoras-parceiras@cedet.com.br.');
    if (c.spineMode === 'manual' && g.cedetCalc && g.cedetCalc.ok && Math.abs(Number(c.spine) - g.cedetCalc.spine) > 0.001) out.push(`A lombada foi digitada à mão (${App.fmtNum(c.spine)} mm) e difere da calculadora do Cedet (${App.fmtNum(g.cedetCalc.spine)} mm): clique em “Recalcular automaticamente” ou em “Confirmar medidas”.`);
    const b = c.isbnBarcode || {};
    const isbnTxt = b.isbn || App.project.meta.isbn;
    if (!b.enabled || !isbnTxt) out.push('Sem código de barras do ISBN: o manual Cedet pede o código na contracapa (digite o ISBN quando tiver o número).');
    else {
      const lay = window.Isbn.layout(isbnTxt, b);
      if (!lay.ok) out.push('Código de barras: ' + lay.error);
      else {
        const pos = window.Isbn.place(g, lay, b);
        const [bx, bw] = g.backTrim;
        if (pos.x < bx || pos.x + lay.w > bx + bw || pos.y < g.outer || pos.y + lay.h > g.outer + g.H) out.push('O código de barras sai da contracapa: diminua as distâncias ou mude a posição.');
        else {
          // o quadro branco não deve encostar no corte nem na dobra da lombada (o corte e a dobra variam alguns milímetros)
          const gap = Math.min(pos.x - bx, bx + bw - (pos.x + lay.w), pos.y - g.outer, g.outer + g.H - (pos.y + lay.h));
          if (gap < BARCODE_EDGE - 0.01) out.push(`O código de barras está a ${App.fmtNum(gap)} mm do corte ou da dobra da lombada: deixe pelo menos ${BARCODE_EDGE} mm para que o corte não atinja o código.`);
          // manual Cedet: 2,5 mm livres entre a última barra e outros elementos da contracapa (o logotipo)
          const lg = App.project.titlePage.logo && App.project.assets[App.project.titlePage.logo];
          const L = lg ? CoverGeometry.brand(g, c, aspectCache[App.assetUrl(App.project.titlePage.logo)] || 2) : null;
          const br = Object.assign({}, CoverGeometry.BRAND, c.brand || {});
          if (L && L.logo && br.panel !== 'front') {
            const r = L.logo, sep = Math.max(r.x - (pos.x + lay.w), pos.x - (r.x + r.w), r.y - (pos.y + lay.h), pos.y - (r.y + r.h));
            if (sep < 0) out.push('O logotipo encosta no quadro do código de barras: o manual Cedet pede 2,5 mm livres entre as barras e outros elementos da contracapa. Mude a posição do código ou do logotipo.');
          }
        }
      }
    }
    if (c.hardcover) out.push('O manual Cedet trata de capa em cartão 250 g (brochura); a capa dura não faz parte do padrão.');
    return out;
  }

  function brandCard(c, on) {
    c.brand = Object.assign({}, CoverGeometry.BRAND, c.brand || {});
    const b = c.brand;
    const reb = () => { proof = null; render(); };
    const hasLogo = !!(App.project.titlePage.logo && App.project.assets[App.project.titlePage.logo]);
    return App.card('Logotipo da editora', [
      el('label', { class: 'chk' }, [on(b, 'enabled', 'checkbox', { onChange: reb }), ' Logotipo da editora no pé da capa']),
      App.field('Onde', on(b, 'panel', 'select', { options: [{ value: 'back', label: 'Quarta capa (contracapa)' }, { value: 'front', label: 'Capa (frente)' }], onChange: reb })),
      el('label', { class: 'chk' }, [on(b, 'logo', 'checkbox', { onChange: reb }), ' Logotipo (o mesmo da página de rosto)']),
      App.field('Largura do logotipo (mm)', on(b, 'logoWidth', 'number', { step: 1, min: 8, max: 60 })),
      App.field('Distância dos cortes (mm)', on(b, 'margin', 'number', { step: 0.5, min: 3 })),
      !hasLogo ? el('p', { class: 'small warn', text: 'Nenhum logotipo na página de rosto: escolha um em Créditos e ficha → Editora e logotipo.' }) : null
    ], 'A capa não leva QR code: na contracapa fica só o código de barras do ISBN (padrão Cedet). Em capas escuras, prefira um logotipo claro.', 'span-all');
  }

  function barcodeCard(c, on) {
    const b = c.isbnBarcode;
    const meta = App.project.meta;
    const isbnVal = b.isbn || meta.isbn || '';
    const lay = window.Isbn ? window.Isbn.layout(isbnVal, b) : { ok: false, error: 'módulo indisponível' };
    const svgBox = el('div', { class: 'barcode-prev' });
    const hint = el('span', { class: 'hint' });
    const showLay = l => {
      const v2 = b.isbn || meta.isbn || '';
      hint.textContent = l.ok ? `✓ EAN-13 ${l.isbn13}${l.converted ? ' (convertido do ISBN-10)' : ''}` : (v2 ? '✗ ' + l.error : 'Opcional: digite o ISBN de 13 dígitos (o ISBN-10 é convertido) para gerar o código. Sem ISBN, a capa sai sem código de barras.');
      hint.className = 'hint ' + (l.ok ? 'good' : v2 ? 'bad' : '');
      svgBox.innerHTML = l.ok ? window.Isbn.toSvg(l) : '';
    };
    const isbnIn = el('input', { type: 'text', value: isbnVal, placeholder: '978-85-XXXX-XXX-X', oninput: e => {
      b.isbn = ''; meta.isbn = e.target.value; proof = null;
      showLay(window.Isbn.layout(meta.isbn, b));
      clearTimeout(isbnIn._t); isbnIn._t = setTimeout(() => { App.changed('ISBN do livro', { preview: false }); redraw(); }, 500);
    } });
    showLay(lay);
    const posOpts = [{ value: 'br', label: 'Inferior direito (junto à lombada)' }, { value: 'bc', label: 'Inferior, centralizado' }, { value: 'bl', label: 'Inferior esquerdo (lado externo)' }];
    const reb = () => { proof = null; render(); };
    return App.card('Código de barras do ISBN (EAN-13) — contracapa', [
      el('label', { class: 'chk' }, [on(b, 'enabled', 'checkbox', { onChange: reb }), ' Gerar o código de barras do ISBN na contracapa (opcional)']),
      el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Número do ISBN (opcional — o mesmo do pré-cadastro)' }), isbnIn, hint]),
      App.field('Posição', on(b, 'pos', 'select', { options: posOpts, onChange: reb })),
      App.field('Distância do corte inferior (mm)', on(b, 'dy', 'number', { step: 0.5, min: 0 })),
      b.pos !== 'bc' ? App.field(b.pos === 'bl' ? 'Distância do corte externo (mm)' : 'Distância da lombada (mm)', on(b, 'dx', 'number', { step: 0.5, min: 0 })) : null,
      App.field('Tamanho', on(b, 'scale', 'select', { options: [{ value: 1, label: '100% — barras com 31,35 mm (mínimo Cedet: 31 mm)' }, { value: 1.1, label: '110%' }, { value: 1.2, label: '120%' }, { value: 1.5, label: '150%' }], onChange: v2 => { b.scale = Number(v2); reb(); } })),
      App.field('Altura das barras (mm)', on(b, 'barHeight', 'number', { step: 0.5, min: 17.4, onChange: () => { proof = null; redraw(); showLay(window.Isbn.layout(b.isbn || meta.isbn, b)); } }), 'Mínimo de 19 mm de código (barras + números), como pede o manual'),
      el('label', { class: 'chk' }, [on(b, 'showIsbnText', 'checkbox', { onChange: reb }), ' Mostrar “ISBN …” acima das barras']),
      lay.ok ? el('div', { class: 'small muted', text: `Quadro branco ${App.fmtNum(lay.w)} × ${App.fmtNum(lay.h)} mm · código ${App.fmtNum(lay.symbolW)} × ${App.fmtNum(lay.symbolH)} mm · 2,5 mm livres entre as barras e qualquer outro elemento · preto 100% K (nunca em 4 cores)` }) : null,
      svgBox,
      el('div', { class: 'inline wrap' }, ['eps', 'pdf', 'svg'].map(fmt => el('button', { class: fmt === 'eps' ? 'primary' : '', text: `⇩ Baixar ${fmt.toUpperCase()}${fmt === 'eps' ? ' (recomendado)' : ''}`, onclick: async () => { const r = await api.barcodeSave(b.isbn || meta.isbn, { scale: b.scale, barHeight: b.barHeight, showIsbnText: b.showIsbnText }, fmt); if (r && r.error) App.toast(r.error, 5000); else if (r) App.toast('Código de barras salvo: ' + r.file, 5000); } }))),
      el('label', { class: 'chk small' }, [on(c, 'barcode', 'checkbox'), ' Apenas reservar uma área branca de 50 × 30 mm (sem gerar o código)'])
    ], 'O código é vetorial e vai por cima da arte, num quadro branco. Confira a leitura com um leitor de código de barras na prova impressa.', 'span-all');
  }

  function cedetCard(c, on) {
    const g = CoverGeometry.geometry(c);
    const issues = c.cedet ? cedetCoverIssues(c) : [];
    const calc = g.cedetCalc || CedetSpine.spine(c.pages, CEDET_PAPER, CEDET_COVER);
    const pagesNow = calc.rawPages;
    const conf = c.confirmed && c.confirmed.pages === c.pages && Math.abs(c.confirmed.spine - g.spine) < 0.001 ? c.confirmed : null;
    const row = (k, v) => el('div', { class: 'cedet-calc-row' }, [el('span', { class: 'muted small', text: k }), el('strong', { text: v })]);
    return App.card('Padrão CEDET (manual de preparação de arquivos)', [
      el('label', { class: 'chk' }, [on(c, 'cedet', 'checkbox', { onChange: v2 => { if (v2) { c.marks.enabled = true; c.hardcover = false; c.flaps = 0; c.totalsManual = false; } proof = null; render(); } }), ' Capa no padrão CEDET (sem orelhas)']),
      c.cedet ? el('div', { class: 'small', text: `Capa sem orelhas (o Cedet não usa orelhas): capa e contracapa com ${App.fmtNum(g.W / 10)} × ${App.fmtNum(g.H / 10)} cm, o mesmo formato do miolo; capa aberta ${App.fmtNum(g.trimTotalW)} × ${App.fmtNum(g.H)} mm sem sangria, ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm com 5 mm de sangria.` }) : null,
      c.cedet ? el('div', { class: 'cedet-calc' }, [
        el('b', { text: '📘 Calculadora de lombada do Cedet' }),
        row('Papel da capa', paperName(CEDET_COVER)),
        row('Papel do miolo', paperName(CEDET_PAPER)),
        row('Gramatura do papel', `${CEDET_GSM} g/m²`),
        row('Páginas do miolo final', pagesNow ? `${pagesNow}${calc.pages !== pagesNow ? ` → ${calc.pages} na tabela (múltiplo de 4)` : ''}` : '—'),
        row('Lombada (automática)', calc.ok ? `${App.fmtNum(c.spineMode === 'manual' ? g.spine : calc.spine)} mm` : '—'),
        row('Capa aberta (com sangria)', `${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm`),
        calc.ok ? null : el('div', { class: 'small warn', text: calc.error + ' Consulte editoras-parceiras@cedet.com.br.' }),
        pagesNow && pagesNow % 4 ? el('div', { class: 'small warn', text: `⚠ ${pagesNow} páginas não é divisível por 4: a gráfica completa o caderno; a tabela usa ${calc.pages}.` }) : null,
        el('div', { class: 'small ' + (conf ? 'good' : 'muted'), text: conf ? `✓ Conferido com o miolo final paginado como na exportação (${new Date(conf.at).toLocaleString('pt-BR')})${conf.same ? ': os números batem com o cálculo automático.' : `: corrigido de ${conf.prevPages} para ${conf.pages} páginas.`}` : `Calculado automaticamente a partir do livro aberto na diagramação${c.source === 'file' ? ' (manuscrito carregado)' : ''}. “Confirmar medidas” confere: pagina o miolo como na exportação do PDF e recalcula.` }),
        el('button', { class: 'primary', text: 'Confirmar medidas', onclick: confirmDims })
      ]) : null,
      c.cedet ? el('div', { class: 'small muted', text: 'Sangria 5 mm · marcas de corte e de dobra de 0,25 pt a 5 mm do corte (capa, contracapa e lombada) · CMYK · 300 dpi · capa aberta em um único PDF (páginas espelhadas). Dúvidas sobre a lombada: editoras-parceiras@cedet.com.br.' }) : null,
      c.cedet && issues.length ? el('ul', { class: 'small warn' }, issues.map(x => el('li', { text: x }))) : c.cedet ? el('div', { class: 'good small', text: '✓ Capa conforme o manual Cedet.' }) : null
    ], '', 'span-all');
  }

  // CEDET: usa o SWOP v2 (recomendado pelo manual) se ele estiver instalado no computador
  let swopTried = false;
  async function autoSwop(c) {
    if (swopTried || !c.cedet || c.customIcc) return;
    swopTried = true;
    const r = await api.coverFindSwop();
    if (!r) return;
    c.customIcc = { name: r.name, desc: r.desc, data: r.data };
    c.profile = 'custom';
    App.changed('Perfil da capa: ' + r.desc + ' (recomendado pelo Cedet, encontrado no computador)', { preview: false });
    proof = null;
    render();
  }
  async function pickIcc() {
    const r = await api.coverPickIcc();
    if (!r) return;
    if (r.error) { App.toast(r.error, 6000); return; }
    const c = cover();
    c.customIcc = { name: r.name, desc: r.desc, data: r.data };
    c.profile = 'custom';
    App.changed('Perfil ICC da capa: ' + r.desc, { preview: false });
    proof = null;
    render();
  }

  function render() {
    const v = $('#view-cover');
    v.innerHTML = '';
    const c = cover();
    syncFromBook();
    autoSwop(c);
    const f = App.field;
    const on = (obj, key, type, o) => App.bind(obj, key, type, Object.assign({ label: 'Capa', onChange: () => { proof = null; redraw(); } }, o || {}));
    const manualOn = () => { if (c.source === 'book') c.source = 'manual'; };
    const imgSlot = (key, label, hint) => {
      const it = c.images[key];
      const a = it && App.project.assets[it.asset];
      return el('div', { class: 'field' }, [el('span', { class: 'flabel', text: label }), el('div', { class: 'inline wrap' }, [
        a ? el('img', { class: 'mini-thumb', src: App.assetUrl(it.asset) }) : null,
        el('button', { class: 'small-btn', text: a ? 'Trocar' : 'Inserir…', onclick: async () => { const l = await api.pickImages({ title: label }); if (!l) return; c.images[key] = { asset: await App.addAsset(l[0]), fit: 'cover' }; App.changed('Capa: ' + label, { preview: false }); proof = null; render(); } }),
        a ? (() => { const s = el('select', { onchange: e => { it.fit = e.target.value; App.changed('Ajuste da imagem da capa', { preview: false }); proof = null; redraw(); } }, [['cover', 'Preencher sem bordas (recorta o excesso)'], ['stretch', 'Esticar para caber exatamente']].map(([x, y]) => el('option', { value: x, text: y }))); s.value = it.fit || 'cover'; return s; })() : null,
        a ? el('button', { class: 'small-btn', text: '✕', onclick: () => { delete c.images[key]; App.changed('Imagem da capa removida', { preview: false }); proof = null; render(); } }) : null
      ]), hint ? el('span', { class: 'hint', text: hint }) : null, a && a.info && a.info.colorSpace === 'CMYK' ? el('span', { class: 'good small', text: 'CMYK: valores preservados na saída' }) : null]);
    };
    const paperOpts = Object.entries(CoverGeometry.PAPERS).map(([k, p]) => ({ value: k, label: p.label + (p.mm ? ` (${String(p.mm).replace('.', ',')} mm/pág.)` : '') }));
    const g = CoverGeometry.geometry(c);
    const totalInput = (key, label, value, onSet) => {
      const i = el('input', { type: 'number', step: 0.1, value: Number(value).toFixed(2) });
      i.addEventListener('change', () => { const v = parseFloat(i.value); if (!isFinite(v) || v <= 0) return; onSet(v); c.source = c.source === 'book' ? 'manual' : c.source; App.changed('Medidas da capa', { preview: false }); proof = null; render(); });
      return f(label, i);
    };
    const srcText = c.source === 'file' && c.fileInfo ? `Manuscrito carregado: ${c.fileInfo.name} (${c.fileInfo.method})` : c.source === 'manual' ? 'Medidas digitadas manualmente' : 'Acompanhando o livro em diagramação';
    v.appendChild(el('div', { class: 'cover-layout' }, [
      el('div', { class: 'cover-form' }, [
        el('h2', { text: 'Capa e lombada' }),
        el('p', { class: 'muted small', text: 'Monte capas já editadas: insira a capa pronta (imagem envolvente) ou capa, lombada e contracapa separadas. A saída é um PDF CMYK para gráfica.' }),
        el('div', { class: 'cover-banner ' + (c.confirmed ? 'ok' : 'info') }, [
          el('div', { class: 'small', text: (c.confirmed ? `✓ Medidas conferidas em ${new Date(c.confirmed.at).toLocaleString('pt-BR')} · ` : 'Medidas calculadas automaticamente · ') + srcText }),
          c.fileInfo && c.fileInfo.notes && c.fileInfo.notes.length ? el('div', { class: 'small warn', text: c.fileInfo.notes.join(' ') }) : null,
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'primary', text: 'Confirmar medidas', onclick: confirmDims }),
            el('button', { text: 'Usar o livro em diagramação', onclick: useBook }),
            el('button', { text: 'Carregar manuscrito…', title: 'Opcional: PDF, DOC, DOCX, ODT, HTML, EPUB ou MOBI', onclick: loadManuscript })
          ])
        ]),
        el('div', { id: 'coverSummary', class: 'card' }),
        cedetCard(c, on),
        App.card('Medidas da capa (mm) — editáveis', [
          totalInput('totalW', 'Largura total da capa (mm)', g.totalW, v2 => { c.totalsManual = true; c.totalW = v2; c.totalH = g.totalH; }),
          totalInput('totalH', 'Altura total da capa (mm)', g.totalH, v2 => { c.totalsManual = true; c.totalH = v2; c.totalW = g.totalW; }),
          totalInput('spine', 'Largura da lombada (mm)', g.spine, v2 => { c.spineMode = 'manual'; c.spine = v2; if (c.totalsManual) c.totalW = g.totalW - g.spine + v2; }),
          el('div', { class: 'field' }, [el('span', { class: 'flabel', text: ' ' }), el('button', { text: '↺ Recalcular automaticamente', onclick: () => { c.totalsManual = false; c.spineMode = 'auto'; App.changed('Medidas automáticas da capa', { preview: false }); render(); } })])
        ], 'Os totais incluem a sangria. Ao digitar um total, as larguras da capa e da contracapa são ajustadas; a lombada pode ser fixada à parte.'),
        App.card('Base do cálculo', [
          f('Largura do livro (mm)', on(c, 'trimW', 'number', { step: 0.1, onChange: () => { manualOn(); c.totalsManual = false; redraw(); } })),
          f('Altura do livro (mm)', on(c, 'trimH', 'number', { step: 0.1, onChange: () => { manualOn(); c.totalsManual = false; redraw(); } })),
          f('Páginas do miolo', on(c, 'pages', 'number', { step: 2, min: 2, onChange: () => { manualOn(); redraw(); } })),
          f('Papel do miolo', on(c, 'paper', 'select', { options: paperOpts, onChange: () => { proof = null; render(); } })),
          c.paper === 'custom' ? f('Espessura por página (mm)', on(c, 'paperMm', 'number', { step: 0.001 })) : null,
          el('label', { class: 'chk' }, [on(c, 'bleedAuto', 'checkbox', { onChange: () => render() }), c.cedet ? ' Sangria automática (CEDET: 5 mm)' : ' Sangria automática (3 mm; KDP: 3,175 mm = 0,125 pol.)']),
          !c.bleedAuto ? f('Sangria manual (mm)', on(c, 'bleed', 'number', { step: 0.1, min: 0, max: 25 })) : null,
          c.cedet ? null : f('Orelhas (mm, 0 = sem)', on(c, 'flaps', 'number', { step: 1, min: 0, max: 150 })),

          el('label', { class: 'chk' }, [on(c, 'hardcover', 'checkbox', { onChange: () => render() }), ' Capa dura']),
          c.hardcover ? f('Dobra do revestimento (mm)', on(c, 'wrapExtra', 'number', { step: 1 })) : null,
          c.hardcover ? f('Acréscimo da lombada pelo cartão (mm)', on(c, 'boardExtra', 'number', { step: 0.5 })) : null,
          f('Área de segurança (mm)', on(c, 'safety', 'number', { step: 0.5 }))
        ], 'A espessura do papel varia por fabricante: confirme a lombada com a gráfica.'),
        App.card('Capa pronta (imagens)', [
          imgSlot('wrap', 'Capa inteira já montada (contracapa + lombada + capa)', `Ideal: arquivo único de ${App.fmtNum(g.totalW)} × ${App.fmtNum(g.totalH)} mm (com sangria), 300 dpi`),
          el('div', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'Ou envie cada parte separadamente — na ordem da capa aberta (páginas espelhadas):' })]),
          el('div', { class: 'cover-spread-slots wide' }, [
            c.flaps ? imgSlot('flapBack', 'Orelha da contracapa') : null,
            imgSlot('back', '① Contracapa (quarta capa)', `${App.fmtNum(g.panels.back[1])} × ${App.fmtNum(g.totalH)} mm com sangria`),
            imgSlot('spine', '② Lombada', `${App.fmtNum(g.spine)} × ${App.fmtNum(g.totalH)} mm`),
            imgSlot('front', '③ Capa (frente)', `${App.fmtNum(g.panels.front[1])} × ${App.fmtNum(g.totalH)} mm com sangria`),
            c.flaps ? imgSlot('flapFront', 'Orelha da capa') : null
          ])
        ], 'Cada imagem preenche toda a sua parte até a borda da sangria, sem faixas brancas (o excesso é recortado pelo centro; ou escolha “Esticar”). Imagens CMYK (JPEG) mantêm seus valores; imagens RGB são convertidas com o perfil ICC escolhido abaixo, respeitando o perfil embutido na imagem.', 'span-all'),
        App.card('Cor de fundo (áreas sem imagem)', [f('Capa', on(c.bg, 'front', 'color')), f('Lombada', on(c.bg, 'spine', 'color')), f('Contracapa', on(c.bg, 'back', 'color'))]),
        brandCard(c, on),
        barcodeCard(c, on),
        App.card('Saída para gráfica — PDF CMYK', [
          f('Perfil de cor (ICC)', on(c, 'profile', 'select', { options: [{ value: 'fogra39', label: 'ISO Coated v2 (ECI) — FOGRA39 · couchê, offset Brasil/Europa' }, { value: 'gracol', label: 'GRACoL 2013 (CRPC6) · couchê, padrão EUA/KDP' }].concat(c.customIcc ? [{ value: 'custom', label: 'Carregado: ' + c.customIcc.desc }] : []), onChange: () => { proof = null; render(); } }), c.cedet ? (c.customIcc && /swop/i.test(c.customIcc.desc + c.customIcc.name) ? '✓ U.S. Web Coated (SWOP) v2, como recomenda o Cedet.' : 'O Cedet recomenda U.S. Web Coated (SWOP) v2: o app procura o perfil instalado com os programas da Adobe; se não achar, carregue o arquivo .icc (ele não pode ser distribuído com o programa).') : 'Use o perfil indicado pela sua gráfica.', 'wide'),
          el('div', { class: 'field' }, [el('span', { class: 'flabel', text: ' ' }), el('button', { text: 'Carregar perfil ICC…', title: 'Ex.: USWebCoatedSWOP.icc (Adobe)', onclick: pickIcc })]),
          f('Intenção de renderização', on(c, 'intent', 'select', { options: [{ value: 'relative', label: 'Colorimétrica relativa + compensação de preto (recomendado)' }, { value: 'perceptual', label: 'Perceptual (fotos muito saturadas)' }] })),
          el('label', { class: 'chk' }, [on(c, 'enhance', 'checkbox'), ' Correção automática de cor (níveis de preto e branco, sem mudar o matiz)']),
          el('label', { class: 'chk' }, [on(c, 'sharpen', 'checkbox'), ' Nitidez (realça os detalhes após o redimensionamento)']),
          f('Resolução', on(c, 'dpi', 'select', { options: [{ value: 300, label: '300 dpi (padrão de gráfica)' }, { value: 400, label: '400 dpi' }, { value: 600, label: '600 dpi' }], onChange: v2 => { c.dpi = Number(v2); } })),
          el('label', { class: 'chk' }, [on(c.marks, 'enabled', 'checkbox'), ' Linhas de corte e de dobra no PDF (marcas de 0,25 pt a 5 mm do corte, fora da sangria)' + (c.cedet ? ' — exigidas pelo manual Cedet' : '')]),
          el('div', { class: 'small muted', text: `O PDF sempre sai com a sangria (${App.fmtNum(CoverGeometry.geometry(c).bleed)} mm em volta), com ou sem as linhas. As linhas da prévia ao lado são só para conferência na tela.` }),
          el('div', { class: 'inline wrap' }, [
            el('button', { class: 'primary', text: '⇩ Exportar PDF CMYK para gráfica', onclick: exportPdf }),
            el('button', { text: 'Prova de cor (simulação CMYK)', onclick: runProof }),
            el('button', { text: '🧊 Prévia 3D', title: 'Livro montado em 3D: gire para todos os lados e salve em PNG transparente', onclick: () => window.Cover3D ? window.Cover3D.open() : App.toast('Prévia 3D indisponível.') })
          ])
        ], 'O PDF sai no padrão PDF/X-1a: somente CMYK, sem transparências, com o perfil de saída (OutputIntent), caixas de corte e sangria. Confira a prova impressa da gráfica antes da tiragem.', 'span-all')
      ]),
      el('div', { class: 'cover-preview' }, [
        el('div', { class: 'inline wrap' }, [
          el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvBleedLines', checked: guideState.bleedLines, onchange: e => { guideState.bleedLines = e.target.checked; redraw(); } }), ' Linhas da sangria e do corte']),
          el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvGuides', checked: guideState.guides, onchange: e => { guideState.guides = e.target.checked; redraw(); } }), ' Dobras e área segura']),
          el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', id: 'cvBleed', checked: guideState.bleed, onchange: e => { guideState.bleed = e.target.checked; redraw(); } }), ' Mostrar a área de sangria'])
        ]),
        el('div', { id: 'coverStage', class: 'cover-stage' })
      ])
    ]));
    updateSummary();
    if (proof) return showProof();
    frame = el('iframe', { class: 'cover-frame', src: 'cover.html' });
    frame.onload = drawPreview;
    $('#coverStage').appendChild(frame);
  }

  App.hooks.viewRender.cover = render;
  App.cover = { ensure: cover, syncFromBook, render };
})();
