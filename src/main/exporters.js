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
        text: r.text || '', bold: !!r.b, italics: !!r.i, underline: r.u ? {} : undefined, strike: !!r.s,
        superScript: !!r.sup, subScript: !!r.sub, smallCaps: !!r.sc
      }));
    });
    return out;
  };
  const align = a => ({ center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, left: D.AlignmentType.LEFT, justify: D.AlignmentType.JUSTIFIED }[a]);

  doc.chapters.forEach((ch, ci) => {
    children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: ci > 0, children: [new D.TextRun({ text: ch.label ? `${ch.label} — ${ch.title}` : ch.title })] }));
    ch.blocks.forEach(b => {
      if (b.t === 'p') children.push(new D.Paragraph({ children: mkRuns(b.runs), alignment: align(b.align), style: b.cls === 'reference' ? 'Bibliography' : undefined, indent: b.cls === 'noindent' ? undefined : { firstLine: 340 } }));
      else if (b.t === 'h') children.push(new D.Paragraph({ heading: [D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][Math.min(2, b.level - 2)], children: mkRuns(b.runs) }));
      else if (b.t === 'quote' || b.t === 'box') b.paras.forEach(p => children.push(new D.Paragraph({ children: mkRuns(p), indent: { left: 720, right: 360 }, style: 'Quote' })));
      else if (b.t === 'poem') b.stanzas.forEach(st => children.push(new D.Paragraph({ children: st.flatMap((l, i) => (i ? [new D.TextRun({ text: '', break: 1 })] : []).concat(mkRuns(l))), indent: { left: 720 }, spacing: { after: 240 } })));
      else if (b.t === 'list') b.items.forEach((it, i) => children.push(new D.Paragraph({ children: [new D.TextRun(b.ordered ? `${i + 1}. ` : '• ')].concat(mkRuns(it)), indent: { left: 360 } })));
      else if (b.t === 'scene') children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun('*  *  *')] }));
      else if (b.t === 'pagebreak') children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      else if (b.t === 'image') {
        const a = assets[b.asset];
        const bin = a && dataUrlToBuffer(a.dataUrl);
        const type = bin && EXT[bin.mime];
        if (bin && ['png', 'jpg', 'gif', 'bmp'].includes(type)) {
          const colPx = ((page.width - page.marginInner - page.marginOuter) / 25.4) * 96;
          const w = Math.round(colPx * (b.widthPct || 60) / 100);
          const h = Math.round(w * (a.height || 1) / (a.width || 1));
          children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ data: bin.buf, type, transformation: { width: w, height: h } })] }));
        }
        if (b.caption && b.caption.length) children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, style: 'Caption', children: mkRuns(b.caption) }));
      } else if (b.t === 'table') {
        children.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          rows: b.rows.map(r => new D.TableRow({ children: r.map(c => new D.TableCell({ children: [new D.Paragraph({ children: mkRuns(c.runs).map(x => x) })] })) }))
        }));
        if (b.caption) children.push(new D.Paragraph({ style: 'Caption', children: mkRuns(b.caption) }));
      }
    });
  });

  const document = new D.Document({
    creator: doc.meta.author,
    title: doc.meta.title,
    description: doc.meta.subtitle || '',
    footnotes,
    styles: { default: { document: { run: { font: doc.font || 'Georgia', size: Math.round((doc.fontSize || 11) * 2) } } } },
    sections: [{
      properties: { page: { size: { width: mmToTwip(page.width), height: mmToTwip(page.height) }, margin: { top: mmToTwip(page.marginTop), bottom: mmToTwip(page.marginBottom), left: mmToTwip(page.marginInner), right: mmToTwip(page.marginOuter), mirror: true } } },
      children: [
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: doc.meta.title, size: 48 })] }),
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: doc.meta.author, size: 28 })] }),
        new D.Paragraph({ children: [new D.PageBreak()] })
      ].concat(children)
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
  const page = (title, body, extraHead) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEsc(m.language || 'pt-BR')}" lang="${xmlEsc(m.language || 'pt-BR')}">
<head><meta charset="utf-8"/><title>${xmlEsc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extraHead || ''}</head>
<body>${body}</body></html>`;

  const fixImages = html => html.replace(/data-asset="([^"]+)"/g, (mm, id) => { usedImages.add(id); return mm; });

  if (epub.cover) {
    const bin = dataUrlToBuffer(epub.cover);
    if (bin) {
      zip.file(`OEBPS/images/cover.${EXT[bin.mime] || 'jpg'}`, bin.buf);
      manifest.push(`<item id="cover-img" href="images/cover.${EXT[bin.mime] || 'jpg'}" media-type="${bin.mime}" properties="cover-image"/>`);
      zip.file('OEBPS/cover.xhtml', page('Capa', `<section epub:type="cover" class="cover"><img src="images/cover.${EXT[bin.mime] || 'jpg'}" alt="Capa"/></section>`));
      manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
      spine.push('<itemref idref="cover" linear="yes"/>');
    }
  }
  zip.file('OEBPS/title.xhtml', page(m.title, `<section epub:type="titlepage" class="titlepage"><p class="tp-author">${xmlEsc(m.author)}</p><h1 class="tp-title">${xmlEsc(m.title)}</h1>${m.subtitle ? `<p class="tp-sub">${xmlEsc(m.subtitle)}</p>` : ''}${m.publisher ? `<p class="tp-pub">${xmlEsc(m.publisher)}</p>` : ''}</section>`));
  manifest.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="title"/>');
  if (epub.copyright) {
    zip.file('OEBPS/copyright.xhtml', page('Créditos', `<section epub:type="copyright-page" class="copyright">${epub.copyright}</section>`));
    manifest.push('<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="copyright"/>');
  }
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
  const nav = page('Sumário', `<nav epub:type="toc" id="toc"><h1>${xmlEsc(epub.tocTitle || 'Sumário')}</h1><ol>${epub.docs.map(d => `<li><a href="${d.file}">${xmlEsc(d.tocLabel || d.title)}</a></li>`).join('')}</ol></nav>`);
  zip.file('OEBPS/nav.xhtml', nav);
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  zip.file('OEBPS/style.css', epub.css);
  manifest.push('<item id="css" href="style.css" media-type="text/css"/>');
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${xmlEsc(m.language || 'pt-BR')}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${xmlEsc(uid)}</dc:identifier>
<dc:title>${xmlEsc(m.title)}</dc:title>
<dc:creator>${xmlEsc(m.author)}</dc:creator>
<dc:language>${xmlEsc(m.language || 'pt-BR')}</dc:language>
${m.publisher ? `<dc:publisher>${xmlEsc(m.publisher)}</dc:publisher>` : ''}
${m.description ? `<dc:description>${xmlEsc(m.description)}</dc:description>` : ''}
${m.year ? `<dc:date>${xmlEsc(m.year)}</dc:date>` : ''}
<meta property="dcterms:modified">${now}</meta>
${epub.cover ? '<meta name="cover" content="cover-img"/>' : ''}
</metadata>
<manifest>${manifest.join('\n')}</manifest>
<spine>${spine.join('\n')}</spine>
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
