// Exportação para formatos editáveis e digitais. A interface converte o livro em
// uma estrutura neutra de blocos (ver renderer/exportprep.js); aqui geramos os arquivos.
const path = require('path');

function dataUrlToBuffer(url) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url || '');
  if (!m) return null;
  return { mime: m[1], buf: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };
function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ---------------------------------------------------------------- TXT
function runsText(runs) {
  return (runs || []).map(r => (r.fn ? '' : r.text || '')).join('');
}
function exportTxt(doc) {
  const out = [];
  out.push(doc.meta.title.toUpperCase());
  if (doc.meta.subtitle) out.push(doc.meta.subtitle);
  out.push(doc.meta.author, '', '');
  doc.chapters.forEach(ch => {
    const notes = [];
    const noteRuns = runs => (runs || []).map(r => { if (r.fn) { notes.push(runsText(r.fn)); return `[${notes.length}]`; } return r.text || ''; }).join('');
    if (ch.label) out.push(ch.label);
    out.push(ch.title, '');
    ch.blocks.forEach(b => {
      if (b.t === 'p' || b.t === 'h') out.push(noteRuns(b.runs), '');
      else if (b.t === 'quote' || b.t === 'box') { b.paras.forEach(p => out.push('    ' + noteRuns(p))); out.push(''); }
      else if (b.t === 'poem') { b.stanzas.forEach(st => { st.forEach(l => out.push(noteRuns(l))); out.push(''); }); }
      else if (b.t === 'list') { b.items.forEach((it, i) => out.push(`${b.ordered ? (i + 1) + '.' : '•'} ${noteRuns(it)}`)); out.push(''); }
      else if (b.t === 'scene') out.push('* * *', '');
      else if (b.t === 'table') { b.rows.forEach(r => out.push(r.map(c => noteRuns(c.runs)).join('\t'))); out.push(''); }
      else if (b.t === 'image' && b.caption) out.push(`[Imagem: ${runsText(b.caption)}]`, '');
    });
    if (notes.length) { out.push('Notas:'); notes.forEach((n, i) => out.push(`[${i + 1}] ${n}`)); out.push(''); }
    out.push('');
  });
  return Buffer.from('﻿' + out.join('\r\n'), 'utf8');
}

// ---------------------------------------------------------------- DOCX
async function exportDocx(doc, assets, page) {
  const D = require('docx');
  const mmToTwip = mm => Math.round(mm / 25.4 * 1440);
  const footnotes = {};
  let fnId = 1;
  const children = [];

  // marcador de texto: fundo da cor escolhida (preto e rosa com letra branca); contorno = borda fina
  const HL = { gray: 'D0D0D0', black: '111111', green: '39FF14', yellow: 'FFF200', pink: 'FF2EC4' };
  const hlRun = k => !k ? {} : k === 'outline' ? { border: { style: D.BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } }
    : Object.assign({ shading: { type: D.ShadingType.CLEAR, fill: HL[k] || 'FFF200', color: 'auto' } }, k === 'black' || k === 'pink' ? { color: 'FFFFFF' } : {});
  const mkRuns = runs => {
    const out = [];
    (runs || []).forEach(r => {
      if (r.fn) {
        const id = fnId++;
        footnotes[id] = { children: [new D.Paragraph({ children: mkRuns(r.fn) })] };
        out.push(new D.FootnoteReferenceRun(id));
        return;
      }
      if (r.br) { out.push(new D.TextRun({ text: '', break: 1 })); return; }
      out.push(new D.TextRun({
        text: String(r.text || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '), bold: !!r.b, italics: !!r.i, underline: r.u ? {} : undefined, strike: !!r.s, color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color.slice(1) : undefined,
        superScript: !!r.sup, subScript: !!r.sub, smallCaps: !!r.sc, ...hlRun(r.hl)
      }));
    });
    return out;
  };
  const align = a => ({ center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, left: D.AlignmentType.LEFT, justify: D.AlignmentType.JUSTIFIED }[a]);

  const S = doc.styles || null;
  const firstLine = S ? Math.round((Number(S.body.indent) || 0) * (Number(S.body.size) || 11) * 20) : 340;
  doc.chapters.forEach((ch, ci) => {
    if (S) {
      // rótulo (“Capítulo 1”) e título no estilo do livro; o título entra no sumário do Word
      // quebra de página dentro do primeiro parágrafo do capítulo (uma só, nunca página em branco),
      // reconhecida pelo Word, LibreOffice e Google Docs
      // sem página de título (doc.noTitlePage), o primeiro capítulo abre o documento, sem quebra antes
      const brk = doc.noTitlePage && ci === 0 ? [] : [new D.PageBreak()];
      if (ch.label) children.push(new D.Paragraph({ style: 'ChapterLabel', children: brk.concat([new D.TextRun({ text: ch.label })]) }));
      children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: (ch.label ? [] : brk).concat([new D.TextRun({ text: ch.title })]) }));
    } else children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: ci > 0, children: [new D.TextRun({ text: ch.label ? `${ch.label} — ${ch.title}` : ch.title })] }));
    let firstP = true;
    ch.blocks.forEach(b => {
      if (b.t === 'p') {
        const noInd = b.cls === 'noindent' || (S && firstP);
        firstP = false;
        children.push(new D.Paragraph({ children: mkRuns(b.runs), alignment: align(b.align), style: b.cls === 'reference' ? 'Bibliography' : undefined, indent: noInd ? { firstLine: 0 } : { firstLine } }));
        return;
      }
      firstP = b.t === 'h' || b.t === 'scene';
      if (b.t === 'p') return;
      else if (b.t === 'h') children.push(new D.Paragraph({ heading: [D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][Math.min(2, b.level - 2)], children: mkRuns(b.runs) }));
      else if (b.t === 'quote' || b.t === 'box') b.paras.forEach(p => children.push(new D.Paragraph({ children: mkRuns(p), indent: { left: 720, right: 360, firstLine: 0 }, style: 'Quote' })));
      else if (b.t === 'poem') b.stanzas.forEach(st => children.push(new D.Paragraph({ children: st.flatMap((l, i) => (i ? [new D.TextRun({ text: '', break: 1 })] : []).concat(mkRuns(l))), indent: { left: 720 }, spacing: { after: 240 } })));
      else if (b.t === 'list') b.items.forEach((it, i) => children.push(new D.Paragraph({ children: [new D.TextRun(b.ordered ? `${i + 1}. ` : '• ')].concat(mkRuns(it)), indent: { left: 360 } })));
      else if (b.t === 'scene') children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun('*  *  *')] }));
      else if (b.t === 'pagebreak') {
        // nunca duas quebras seguidas nem quebra no início/fim do capítulo (geraria página em branco)
        const k = ch.blocks.indexOf(b);
        if (k > 0 && k < ch.blocks.length - 1 && ch.blocks[k - 1].t !== 'pagebreak') children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      }
      else if (b.t === 'image') {
        const a = assets[b.asset];
        const bin = a && dataUrlToBuffer(a.dataUrl);
        const type = bin && EXT[bin.mime];
        if (bin && ['png', 'jpg', 'gif', 'bmp'].includes(type)) {
          const colPx = ((page.width - page.marginInner - page.marginOuter) / 25.4) * 96;
          // proporção real; nunca mais alta que ~70% da mancha (uma figura alta não empurra a página)
          const maxH = ((page.height - page.marginTop - page.marginBottom) / 25.4) * 96 * 0.7;
          let w = Math.round(colPx * (b.widthPct || 60) / 100);
          let h = Math.round(w * (a.height || 1) / (a.width || 1));
          if (h > maxH) { w = Math.round(w * maxH / h); h = Math.round(maxH); }
          children.push(new D.Paragraph({ alignment: align(b.align) || D.AlignmentType.CENTER, keepNext: !!(b.caption && b.caption.length), indent: { firstLine: 0 }, spacing: { before: 120, after: 120 }, children: [new D.ImageRun({ data: bin.buf, type, transformation: { width: w, height: h } })] }));
        }
        if (b.caption && b.caption.length) children.push(new D.Paragraph({ alignment: align(b.align) || D.AlignmentType.CENTER, style: 'Caption', children: mkRuns(b.caption) }));
      } else if (b.t === 'table') {
        children.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          // tabela colada com a formatação original: fundo, alinhamento, cor e negrito de cada célula
          rows: b.rows.map(r => new D.TableRow({ children: r.map(c => new D.TableCell({
            shading: c.bg ? { fill: c.bg.slice(1), type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
            children: [new D.Paragraph({ alignment: align(c.align), indent: { firstLine: 0 }, children: mkRuns(c.runs).map(x => x) })]
          })) }))
        }));
        if (b.caption) children.push(new D.Paragraph({ style: 'Caption', children: mkRuns(b.caption) }));
      }
    });
  });

  // estilos do livro (fonte, tamanho, entrelinha, alinhamento, recuo, títulos) como estilos do Word
  const mmTw = mm => Math.round((Number(mm) || 0) / 25.4 * 1440);
  const FO = doc.fontOverride || '';
  const runOf = (st, base) => ({ font: FO || (st && st.font) || base.font, size: Math.round(((st && st.size) || base.size) * 2), bold: !!(st && st.bold), italics: !!(st && st.italic), allCaps: !!(st && st.uppercase), smallCaps: !!(st && st.smallcaps), color: st && st.color ? String(st.color).replace('#', '') : undefined, characterSpacing: st && st.letterSpacing ? Math.round(st.letterSpacing * ((st.size || base.size) * 20)) : undefined });
  const styles = { default: { document: { run: { font: FO || doc.font || 'Georgia', size: Math.round((doc.fontSize || 11) * 2) } } } };
  if (S) {
    const base = { font: FO || S.body.font || 'Georgia', size: Number(S.body.size) || 11 };
    const lh = st => Math.round(240 * (Number((st && st.lineHeight) || S.body.lineHeight) || 1.4));
    styles.default.document.run = { font: base.font, size: Math.round(base.size * 2) };
    styles.paragraphStyles = [
      { id: 'Normal', name: 'Normal', run: runOf(S.body, base), paragraph: { alignment: align(S.body.align || 'justify'), spacing: { line: lh(S.body), after: mmTw(S.body.spaceAfter) }, indent: { firstLine } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: runOf(S.chapterTitle, base), paragraph: { alignment: align(S.chapterTitle.align || 'center'), spacing: { before: S.chapterLabel ? 0 : mmTw(S.chapterTitle.spaceBefore), after: mmTw(Math.max(6, S.chapterTitle.spaceAfter || 0) * 2), line: 276 }, indent: { firstLine: 0 }, keepNext: true, outlineLevel: 0 } },
      { id: 'ChapterLabel', name: 'Rótulo do capítulo', basedOn: 'Normal', next: 'Heading1', run: runOf(S.chapterLabel, base), paragraph: { alignment: align(S.chapterTitle.align || 'center'), spacing: { before: mmTw(S.chapterTitle.spaceBefore), after: mmTw(S.chapterLabel.spaceAfter || 3) }, indent: { firstLine: 0 }, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: runOf(S.h2, base), paragraph: { alignment: align(S.h2.align || 'center'), spacing: { before: mmTw(S.h2.spaceBefore), after: mmTw(S.h2.spaceAfter) }, indent: { firstLine: 0 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: runOf(S.h3, base), paragraph: { alignment: align(S.h3.align || 'left'), spacing: { before: mmTw(S.h3.spaceBefore), after: mmTw(S.h3.spaceAfter) }, indent: { firstLine: 0 }, keepNext: true, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: runOf(S.h4, base), paragraph: { alignment: align(S.h4.align || 'left'), spacing: { before: mmTw(S.h4.spaceBefore), after: mmTw(S.h4.spaceAfter) }, indent: { firstLine: 0 }, keepNext: true } },
      { id: 'Quote', name: 'Quote', basedOn: 'Normal', run: runOf(S.quote, base), paragraph: { alignment: align(S.quote.align || 'justify'), spacing: { line: lh(S.quote), before: mmTw(S.quote.spaceBefore), after: mmTw(S.quote.spaceAfter) } } },
      { id: 'Caption', name: 'Caption', basedOn: 'Normal', run: runOf(S.caption, base), paragraph: { alignment: align(S.caption.align || 'center'), indent: { firstLine: 0 } } },
      { id: 'TocTitle', name: 'Título do sumário', basedOn: 'Normal', run: Object.assign(runOf(S.chapterTitle, base), { size: Math.round((Number(S.chapterTitle.size) || 22) * 1.6) }), paragraph: { alignment: align(S.chapterTitle.align || 'center'), spacing: { before: mmTw(S.chapterTitle.spaceBefore), after: mmTw(10) }, indent: { firstLine: 0 } } }
    ];
  }
  // sumário automático do Word (preenchido com as páginas ao abrir o arquivo)
  const front = [];
  if (S && doc.toc !== false) front.push(new D.Paragraph({ style: 'TocTitle', pageBreakBefore: false, children: [new D.TextRun({ text: doc.tocTitle || 'Sumário' })] }), new D.TableOfContents(doc.tocTitle || 'Sumário', { hyperlink: true, headingStyleRange: '1-1' }));
  const document = new D.Document({
    creator: doc.meta.author,
    title: doc.meta.title,
    description: doc.meta.subtitle || '',
    footnotes,
    features: S ? { updateFields: true } : undefined,
    styles,
    sections: [{
      properties: { page: { size: { width: mmToTwip(page.width), height: mmToTwip(page.height) }, margin: { top: mmToTwip(page.marginTop), bottom: mmToTwip(page.marginBottom), left: mmToTwip(page.marginInner), right: mmToTwip(page.marginOuter), mirror: true } } },
      children: (doc.noTitlePage ? [] : [
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, indent: { firstLine: 0 }, spacing: { before: 2400 }, children: [new D.TextRun({ text: doc.meta.title, size: 48 })] }),
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, indent: { firstLine: 0 }, children: [new D.TextRun({ text: doc.meta.author, size: 28 })] })
      ]).concat(front.length ? [new D.Paragraph({ style: 'TocTitle', children: (doc.noTitlePage ? [] : [new D.PageBreak()]).concat([new D.TextRun({ text: doc.tocTitle || 'Sumário' })]) }), front[1]] : (S || doc.noTitlePage ? [] : [new D.Paragraph({ children: [new D.PageBreak()] })]), children)
    }]
  });
  return D.Packer.toBuffer(document);
}

// ---------------------------------------------------------------- ODT
async function exportOdt(doc, assets, page) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  const pics = [];
  let fn = 0;
  const runs = rs => (rs || []).map(r => {
    if (r.fn) { fn++; return `<text:note text:id="ftn${fn}" text:note-class="footnote"><text:note-citation>${fn}</text:note-citation><text:note-body><text:p text:style-name="Footnote">${runs(r.fn)}</text:p></text:note-body></text:note>`; }
    if (r.br) return '<text:line-break/>';
    let t = xmlEsc(r.text || '').replace(/ {2,}/g, m => ` <text:s text:c="${m.length - 1}"/>`);
    const st = [r.b ? 'B' : '', r.i ? 'I' : '', r.u ? 'U' : '', r.sup ? 'Sup' : '', r.sub ? 'Sub' : '', r.sc ? 'SC' : ''].join('');
    return st ? `<text:span text:style-name="T${st}">${t}</text:span>` : t;
  }).join('');
  const spanStyles = new Set();
  const body = [];
  body.push(`<text:p text:style-name="Title">${xmlEsc(doc.meta.title)}</text:p><text:p text:style-name="Subtitle">${xmlEsc(doc.meta.author)}</text:p>`);
  doc.chapters.forEach(ch => {
    body.push(`<text:h text:style-name="Heading_20_1" text:outline-level="1">${xmlEsc(ch.label ? ch.label + ' — ' + ch.title : ch.title)}</text:h>`);
    ch.blocks.forEach(b => {
      if (b.t === 'p') body.push(`<text:p text:style-name="${b.cls === 'noindent' ? 'NoIndent' : 'Text_20_body'}">${runs(b.runs)}</text:p>`);
      else if (b.t === 'h') body.push(`<text:h text:style-name="Heading_20_${b.level}" text:outline-level="${b.level}">${runs(b.runs)}</text:h>`);
      else if (b.t === 'quote' || b.t === 'box') b.paras.forEach(p => body.push(`<text:p text:style-name="Quotations">${runs(p)}</text:p>`));
      else if (b.t === 'poem') b.stanzas.forEach(st => body.push(`<text:p text:style-name="Poem">${st.map(l => runs(l)).join('<text:line-break/>')}</text:p>`));
      else if (b.t === 'list') body.push(`<text:list>${b.items.map(it => `<text:list-item><text:p>${runs(it)}</text:p></text:list-item>`).join('')}</text:list>`);
      else if (b.t === 'scene') body.push('<text:p text:style-name="Center">*  *  *</text:p>');
      else if (b.t === 'image') {
        const a = assets[b.asset];
        const bin = a && dataUrlToBuffer(a.dataUrl);
        if (bin) {
          const name = `Pictures/${b.asset}.${EXT[bin.mime] || 'png'}`;
          if (!pics.includes(name)) { zip.file(name, bin.buf); pics.push(name); }
          const wmm = (page.width - page.marginInner - page.marginOuter) * (b.widthPct || 60) / 100;
          const hmm = wmm * (a.height || 1) / (a.width || 1);
          body.push(`<text:p text:style-name="Center"><draw:frame draw:name="${b.asset}" text:anchor-type="as-char" svg:width="${wmm.toFixed(1)}mm" svg:height="${hmm.toFixed(1)}mm"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`);
        }
        if (b.caption && b.caption.length) body.push(`<text:p text:style-name="Caption">${runs(b.caption)}</text:p>`);
      } else if (b.t === 'table') {
        const cols = Math.max(...b.rows.map(r => r.length));
        body.push(`<table:table><table:table-column table:number-columns-repeated="${cols}"/>${b.rows.map(r => `<table:table-row>${r.map(c => `<table:table-cell office:value-type="string"><text:p>${runs(c.runs)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('')}</table:table>`);
      }
    });
  });
  ['B', 'I', 'U', 'Sup', 'Sub', 'SC'].forEach(() => null);
  const props = s => [s.includes('B') && !s.includes('Sub') ? 'fo:font-weight="bold"' : '', s.includes('I') ? 'fo:font-style="italic"' : '', s.includes('U') ? 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"' : '', s.includes('Sup') ? 'style:text-position="super 58%"' : '', s.includes('Sub') ? 'style:text-position="sub 58%"' : '', s.includes('SC') ? 'fo:font-variant="small-caps"' : ''].join(' ');
  const combos = [];
  const flags = ['B', 'I', 'U', 'Sup', 'Sub', 'SC'];
  for (let m = 1; m < 64; m++) combos.push(flags.filter((f, i) => m & (1 << i)).join(''));
  spanStyles.clear();
  const auto = combos.map(c => `<style:style style:name="T${c}" style:family="text"><style:text-properties ${props(c)}/></style:style>`).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
<office:automatic-styles>${auto}
<style:style style:name="NoIndent" style:family="paragraph" style:parent-style-name="Text_20_body"><style:paragraph-properties fo:text-indent="0mm"/></style:style>
<style:style style:name="Center" style:family="paragraph" style:parent-style-name="Text_20_body"><style:paragraph-properties fo:text-align="center" fo:text-indent="0mm"/></style:style>
<style:style style:name="Poem" style:family="paragraph" style:parent-style-name="Text_20_body"><style:paragraph-properties fo:margin-left="12mm" fo:text-indent="0mm" fo:margin-bottom="4mm"/></style:style>
</office:automatic-styles>
<office:body><office:text>${body.join('\n')}</office:text></office:body></office:document-content>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3">
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="${xmlEsc(doc.font || 'Georgia')}" fo:font-family="'${xmlEsc(doc.font || 'Georgia')}'" fo:font-size="${doc.fontSize || 11}pt" fo:language="pt" fo:country="BR"/></style:default-style>
<style:style style:name="Text_20_body" style:display-name="Text body" style:family="paragraph"><style:paragraph-properties fo:text-align="justify" fo:text-indent="6mm" fo:line-height="140%"/></style:style>
<style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="24pt"/></style:style>
<style:style style:name="Subtitle" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="14pt"/></style:style>
<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:default-outline-level="1"><style:paragraph-properties fo:break-before="page" fo:text-align="center" fo:margin-top="30mm" fo:margin-bottom="10mm"/><style:text-properties fo:font-size="20pt"/></style:style>
<style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:default-outline-level="2"><style:paragraph-properties fo:margin-top="6mm" fo:margin-bottom="3mm"/><style:text-properties fo:font-size="15pt"/></style:style>
<style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:default-outline-level="3"><style:text-properties fo:font-size="13pt" fo:font-style="italic"/></style:style>
<style:style style:name="Heading_20_4" style:display-name="Heading 4" style:family="paragraph" style:default-outline-level="4"><style:text-properties fo:font-variant="small-caps"/></style:style>
<style:style style:name="Quotations" style:family="paragraph"><style:paragraph-properties fo:margin-left="10mm" fo:margin-right="6mm"/><style:text-properties fo:font-size="10pt"/></style:style>
<style:style style:name="Caption" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="9pt" fo:font-style="italic"/></style:style>
<style:style style:name="Footnote" style:family="paragraph"><style:text-properties fo:font-size="8.5pt"/></style:style>
</office:styles>
<office:automatic-styles><style:page-layout style:name="pm1" style:page-usage="mirrored"><style:page-layout-properties fo:page-width="${page.width}mm" fo:page-height="${page.height}mm" fo:margin-top="${page.marginTop}mm" fo:margin-bottom="${page.marginBottom}mm" fo:margin-left="${page.marginInner}mm" fo:margin-right="${page.marginOuter}mm"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${xmlEsc(doc.meta.title)}</dc:title><dc:creator>${xmlEsc(doc.meta.author)}</dc:creator></office:meta></office:document-meta>`);
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pics.map(p => `<manifest:file-entry manifest:full-path="${p}" manifest:media-type="image/${p.split('.').pop() === 'jpg' ? 'jpeg' : p.split('.').pop()}"/>`).join('')}</manifest:manifest>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/vnd.oasis.opendocument.text' });
}

// ---------------------------------------------------------------- EPUB 3
// Papéis MARC dos créditos (leitores e lojas mostram “tradução de…”, “ilustrações de…”)
const MARC = [[/tradu/i, 'trl'], [/ilustra/i, 'ill'], [/edi[çc][ãa]o|editor/i, 'edt'], [/revis/i, 'pfr'], [/diagrama|projeto gr[áa]fico/i, 'bkd'], [/capa/i, 'cov'], [/organiza/i, 'edt'], [/pref[áa]cio/i, 'aui'], [/fotograf/i, 'pht']];
const marcOf = role => (MARC.find(([re]) => re.test(role || '')) || [null, 'ctb'])[1];

// Metadados completos da obra (EPUB 3 + compatibilidade EPUB 2/Kindle)
function opfMetadata(epub, uid, hasCover) {
  const m = epub.meta || {};
  const x = epub.extra || {};
  const L = [];
  L.push(`<dc:identifier id="bookid">${xmlEsc(uid)}</dc:identifier>`);
  if (m.isbn) L.push(`<meta refines="#bookid" property="identifier-type" scheme="onix:codelist5">15</meta>`);
  L.push(`<dc:title id="t1">${xmlEsc(m.title || 'Sem título')}</dc:title>`, `<meta refines="#t1" property="title-type">main</meta>`, `<meta refines="#t1" property="display-seq">1</meta>`);
  if (m.subtitle) L.push(`<dc:title id="t2">${xmlEsc(m.subtitle)}</dc:title>`, `<meta refines="#t2" property="title-type">subtitle</meta>`, `<meta refines="#t2" property="display-seq">2</meta>`);
  (m.author ? String(m.author).split(/\s*;\s*/)  /* vários autores: separe com ponto e vírgula (nomes como “Sousa e Silva” ficam inteiros) */.filter(Boolean) : []).forEach((a, i) => {
    L.push(`<dc:creator id="aut${i}">${xmlEsc(a)}</dc:creator>`, `<meta refines="#aut${i}" property="role" scheme="marc:relators">aut</meta>`);
    const fa = i === 0 && x.fileAs ? x.fileAs : (/\s/.test(a) ? a.replace(/^(.*)\s(\S+)$/, '$2, $1') : a);
    L.push(`<meta refines="#aut${i}" property="file-as">${xmlEsc(fa)}</meta>`);
  });
  (x.contributors || []).forEach((c, i) => { if (!c.name) return; L.push(`<dc:contributor id="ctb${i}">${xmlEsc(c.name)}</dc:contributor>`, `<meta refines="#ctb${i}" property="role" scheme="marc:relators">${marcOf(c.role)}</meta>`); });
  // créditos da Casa Vertigem: produção do livro digital
  L.push('<dc:contributor id="cvhub">Casa Vertigem</dc:contributor>', '<meta refines="#cvhub" property="role" scheme="marc:relators">bkp</meta>');
  L.push(`<dc:language>${xmlEsc(m.language || 'pt-BR')}</dc:language>`);
  L.push(`<dc:publisher>${xmlEsc(m.publisher || 'Casa Vertigem')}</dc:publisher>`);
  // data de publicação: o dia em que o livro digital foi gerado
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  L.push(`<dc:date>${today}</dc:date>`);
  if (m.description) L.push(`<dc:description>${xmlEsc(m.description)}</dc:description>`);
  (x.subjects || []).forEach(sj => L.push(`<dc:subject>${xmlEsc(sj)}</dc:subject>`));
  if (x.rights) L.push(`<dc:rights>${xmlEsc(x.rights)}</dc:rights>`);
  if (x.series) L.push(`<meta property="belongs-to-collection" id="series">${xmlEsc(x.series)}</meta>`, `<meta refines="#series" property="collection-type">series</meta>`, `<meta name="calibre:series" content="${xmlEsc(x.series)}"/>`);
  if (m.edition) L.push(`<meta property="schema:bookEdition">${xmlEsc(m.edition)}</meta>`);
  if (m.isbn) L.push(`<meta property="schema:isbn">${xmlEsc(String(m.isbn).replace(/[^0-9Xx]/g, ''))}</meta>`);
  // acessibilidade (exigida por várias lojas e bibliotecas digitais)
  L.push('<meta property="schema:accessMode">textual</meta>', '<meta property="schema:accessModeSufficient">textual</meta>',
    '<meta property="schema:accessibilityFeature">tableOfContents</meta>', '<meta property="schema:accessibilityFeature">readingOrder</meta>',
    '<meta property="schema:accessibilityFeature">structuralNavigation</meta>', '<meta property="schema:accessibilityHazard">none</meta>',
    '<meta property="schema:accessibilitySummary">Livro com sumário navegável, ordem de leitura e títulos estruturados.</meta>');
  L.push('<meta name="generator" content="Casa Vertigem Hub"/>');
  L.push(`<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>`);
  if (hasCover) L.push('<meta name="cover" content="cover-img"/>');
  return L.join('\n');
}

async function exportEpub(epub, assets) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const m = epub.meta;
  const uid = m.isbn ? `urn:isbn:${m.isbn.replace(/[^0-9Xx]/g, '')}` : `urn:uuid:${epub.uuid}`;
  const manifest = [];
  const spine = [];
  const usedImages = new Set();
  const lang = xmlEsc(m.language || 'pt-BR');
  const page = (title, body, extraHead, bodyAttrs) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extraHead || ''}</head>
<body${bodyAttrs || ''}>${body}</body></html>`;
  const fixImages = html => html.replace(/data-asset="([^"]+)"/g, (mm, id) => { usedImages.add(id); return mm; });

  // Capa: imagem da capa da obra (vira a capa nos aplicativos de leitura e na Amazon) e primeira página,
  // em página inteira sem margens (SVG ajustado à tela, sem distorcer)
  const cv = epub.coverJpeg;
  if (cv && cv.buf) {
    zip.file('OEBPS/images/cover.jpg', cv.buf);
    manifest.push('<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
    zip.file('OEBPS/cover.xhtml', page('Capa', `<div class="cover-page" epub:type="cover" role="doc-cover"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 ${cv.w} ${cv.h}" preserveAspectRatio="xMidYMid meet"><image width="${cv.w}" height="${cv.h}" xlink:href="images/cover.jpg"><title>${xmlEsc(m.title)} — capa</title></image></svg></div>`,
      '<style>html, body { margin: 0; padding: 0; height: 100%; } .cover-page { margin: 0; padding: 0; height: 100%; text-align: center; page-break-after: always; } svg { display: block; }</style>', ' class="cover-body"'));
    manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"/>');
    spine.push('<itemref idref="cover" linear="yes"/>');
  }
  // imagens extras antes da página de rosto, em página inteira
  (epub.preImages || []).forEach((du, i) => {
    const bin = dataUrlToBuffer(du);
    if (!bin) return;
    const ext = EXT[bin.mime] || 'png';
    const name = `images/pre${i + 1}.${ext}`;
    zip.file(`OEBPS/${name}`, bin.buf);
    manifest.push(`<item id="pre-img${i + 1}" href="${name}" media-type="${bin.mime}"/>`);
    zip.file(`OEBPS/pre${i + 1}.xhtml`, page(`Imagem ${i + 1}`, `<div class="cover-page"><img src="${name}" alt="" style="max-width:100%; max-height:100vh; display:block; margin:0 auto;"/></div>`,
      '<style>html, body { margin: 0; padding: 0; } .cover-page { margin: 0; padding: 0; text-align: center; page-break-after: always; }</style>'));
    manifest.push(`<item id="pre${i + 1}" href="pre${i + 1}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="pre${i + 1}"/>`);
  });
  zip.file('OEBPS/title.xhtml', page(m.title, `<section epub:type="titlepage" class="titlepage"><p class="tp-author">${xmlEsc(m.author)}</p><h1 class="tp-title">${xmlEsc(m.title)}</h1>${m.subtitle ? `<p class="tp-sub">${xmlEsc(m.subtitle)}</p>` : ''}${m.publisher ? `<p class="tp-pub">${xmlEsc(m.publisher)}</p>` : ''}</section>`));
  manifest.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="title"/>');
  if (epub.copyright) {
    zip.file('OEBPS/copyright.xhtml', page('Créditos', `<section epub:type="copyright-page" class="copyright">${epub.copyright}</section>`));
    manifest.push('<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="copyright"/>');
  }
  // sumário também como página do livro (depois dos créditos), como no impresso
  spine.push('<itemref idref="nav"/>');
  epub.docs.forEach((d, i) => {
    const file = `chap${String(i + 1).padStart(3, '0')}.xhtml`;
    zip.file(`OEBPS/${file}`, page(d.title, fixImages(d.xhtml)));
    manifest.push(`<item id="c${i + 1}" href="${file}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="c${i + 1}"/>`);
    d.file = file;
  });
  usedImages.forEach(id => {
    const a = assets[id];
    const bin = a && dataUrlToBuffer(a.dataUrl);
    if (!bin) return;
    const name = `images/${id}.${EXT[bin.mime] || 'png'}`;
    zip.file(`OEBPS/${name}`, bin.buf);
    manifest.push(`<item id="img-${id}" href="${name}" media-type="${bin.mime}"/>`);
  });
  // os capítulos referenciam as imagens por data-asset; troca para o caminho no pacote
  for (const d of epub.docs) {
    const f = zip.file(`OEBPS/${d.file}`);
    let s = await f.async('string');
    s = s.replace(/<img\b([^>]*?)data-asset="([^"]+)"([^>]*?)\/?>/g, (mm, a, id, b) => {
      const as = assets[id];
      const bin = as && dataUrlToBuffer(as.dataUrl);
      const src = bin ? `images/${id}.${EXT[bin.mime] || 'png'}` : '';
      return `<img${a.replace(/\ssrc="[^"]*"/, '')} src="${src}"${b.replace(/\ssrc="[^"]*"/, '')}/>`.replace(/\/\/>$/, '/>');
    });
    zip.file(`OEBPS/${d.file}`, s);
  }
  const first = epub.docs[0] && epub.docs[0].file;
  const landmarks = `<nav epub:type="landmarks" id="landmarks" hidden="hidden"><h2>Guia</h2><ol>${cv ? '<li><a epub:type="cover" href="cover.xhtml">Capa</a></li>' : ''}<li><a epub:type="toc" href="nav.xhtml">${xmlEsc(epub.tocTitle || 'Sumário')}</a></li>${first ? `<li><a epub:type="bodymatter" href="${first}">Início da leitura</a></li>` : ''}</ol></nav>`;
  const nav = page('Sumário', `<nav epub:type="toc" id="toc" role="doc-toc"><h1>${xmlEsc(epub.tocTitle || 'Sumário')}</h1><ol>${epub.docs.map(d => `<li><a href="${d.file}">${xmlEsc(d.tocLabel || d.title)}</a></li>`).join('')}</ol></nav>${landmarks}`);
  zip.file('OEBPS/nav.xhtml', nav);
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  // NCX: sumário para leitores EPUB 2 e Kindle antigos
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${lang}"><head><meta name="dtb:uid" content="${xmlEsc(uid)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${xmlEsc(m.title)}</text></docTitle><docAuthor><text>${xmlEsc(m.author)}</text></docAuthor>
<navMap>${epub.docs.map((d, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xmlEsc(d.tocLabel || d.title)}</text></navLabel><content src="${d.file}"/></navPoint>`).join('')}</navMap></ncx>`;
  zip.file('OEBPS/toc.ncx', ncx);
  manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  zip.file('OEBPS/style.css', epub.css);
  manifest.push('<item id="css" href="style.css" media-type="text/css"/>');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}" prefix="schema: http://schema.org/ onix: http://www.editeur.org/ONIX/book/codelists/current.html#">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
${opfMetadata(epub, uid, !!(cv && cv.buf))}
</metadata>
<manifest>${manifest.join('\n')}</manifest>
<spine toc="ncx">${spine.join('\n')}</spine>
<guide>${cv ? '<reference type="cover" title="Capa" href="cover.xhtml"/>' : ''}<reference type="toc" title="${xmlEsc(epub.tocTitle || 'Sumário')}" href="nav.xhtml"/>${first ? `<reference type="text" title="Início" href="${first}"/>` : ''}</guide>
</package>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/epub+zip' });
}

// ---------------------------------------------------------------- TIFF (RGB, sem compressão)
function encodeTiff(bgra, width, height, dpi) {
  const pixels = width * height;
  const rgb = Buffer.alloc(pixels * 3);
  for (let i = 0, j = 0; i < pixels * 4; i += 4, j += 3) { rgb[j] = bgra[i + 2]; rgb[j + 1] = bgra[i + 1]; rgb[j + 2] = bgra[i]; }
  const entries = [
    [256, 4, 1, width], [257, 4, 1, height], [258, 3, 3, 'bps'], [259, 3, 1, 1], [262, 3, 1, 2],
    [273, 4, 1, 'strip'], [277, 3, 1, 3], [278, 4, 1, height], [279, 4, 1, rgb.length],
    [282, 5, 1, 'xres'], [283, 5, 1, 'yres'], [284, 3, 1, 1], [296, 3, 1, 2]
  ];
  const ifdSize = 2 + entries.length * 12 + 4;
  const extraOff = 8 + ifdSize;
  const bpsOff = extraOff;
  const xresOff = bpsOff + 6;
  const yresOff = xresOff + 8;
  const stripOff = yresOff + 8;
  const head = Buffer.alloc(stripOff);
  head.write('II', 0, 'latin1');
  head.writeUInt16LE(42, 2);
  head.writeUInt32LE(8, 4);
  head.writeUInt16LE(entries.length, 8);
  entries.forEach(([tag, type, count, val], i) => {
    const p = 10 + i * 12;
    head.writeUInt16LE(tag, p); head.writeUInt16LE(type, p + 2); head.writeUInt32LE(count, p + 4);
    let v = val;
    if (val === 'bps') v = bpsOff; else if (val === 'strip') v = stripOff; else if (val === 'xres') v = xresOff; else if (val === 'yres') v = yresOff;
    if (type === 3 && count === 1) head.writeUInt16LE(v, p + 8); else head.writeUInt32LE(v, p + 8);
  });
  head.writeUInt32LE(0, 10 + entries.length * 12);
  head.writeUInt16LE(8, bpsOff); head.writeUInt16LE(8, bpsOff + 2); head.writeUInt16LE(8, bpsOff + 4);
  head.writeUInt32LE(dpi, xresOff); head.writeUInt32LE(1, xresOff + 4);
  head.writeUInt32LE(dpi, yresOff); head.writeUInt32LE(1, yresOff + 4);
  return Buffer.concat([head, rgb]);
}

// ---------------------------------------------------------------- pacote de produção
async function makeZip(files) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  files.forEach(f => zip.file(f.name, f.data));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { exportTxt, exportDocx, exportOdt, exportEpub, encodeTiff, makeZip, dataUrlToBuffer, EXT, xmlEsc, path };
