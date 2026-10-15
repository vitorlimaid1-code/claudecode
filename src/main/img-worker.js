// Leitura e gravação de formatos de imagem que o navegador não entende (TIFF, HEIC/HEIF, PSD, TGA,
// Netpbm, QOI), num processo utilitário separado (utilityProcess do Electron): a interface e o processo
// principal não travam com fotos grandes.
const parentPort = process.parentPort;
const fs = require('fs');
const path = require('path');
const C = require('../shared/imgcodecs');

const rgba = (w, h, data) => ({ width: w, height: h, data: data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength || data.length) });

async function decode(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  if (ext === '.tif' || ext === '.tiff') {
    const UTIF = require('utif');
    const ifds = UTIF.decode(u8);
    // a maior imagem do arquivo (alguns TIFF trazem miniaturas antes)
    let best = null;
    for (const ifd of ifds) { if (!ifd.t256) continue; UTIF.decodeImage(u8, ifd, ifds); if (!best || ifd.width * ifd.height > best.width * best.height) best = ifd; }
    if (!best) throw new Error('TIFF sem imagem');
    return rgba(best.width, best.height, UTIF.toRGBA8(best));
  }
  if (ext === '.heic' || ext === '.heif' || ext === '.hif') {
    const decodeHeic = require('heic-decode');
    const r = await decodeHeic({ buffer: u8 });
    return rgba(r.width, r.height, new Uint8Array(r.data.buffer || r.data, r.data.byteOffset || 0, r.data.byteLength || r.data.length));
  }
  if (ext === '.psd' || ext === '.psb') {
    const { readPsd, initializeCanvas } = require('ag-psd');
    // sem canvas no processo: as imagens do PSD são lidas como dados RGBA puros
    initializeCanvas(() => { throw new Error('canvas indisponível'); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
    const psd = readPsd(u8, { skipLayerImageData: true, skipThumbnail: true, useImageData: true });
    if (!psd.imageData) throw new Error('o PSD não tem a imagem composta (salve com “Maximizar compatibilidade” no Photoshop)');
    return rgba(psd.width, psd.height, psd.imageData.data);
  }
  if (ext === '.tga' || ext === '.icb' || ext === '.vda' || ext === '.vst') return C.decodeTGA(u8);
  if (['.ppm', '.pgm', '.pbm', '.pnm', '.pam'].includes(ext)) return C.decodePNM(u8);
  if (ext === '.qoi') return C.decodeQOI(u8);
  throw new Error('formato não suportado: ' + ext);
}

function encodePsd(img) {
  const { writePsdUint8Array } = require('ag-psd');
  const imageData = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength) };
  return writePsdUint8Array({ width: img.width, height: img.height, imageData, children: [{ name: 'Camada 1', imageData }] }, { generateThumbnail: false, noBackground: false });
}

parentPort.on('message', async ev => {
  const msg = ev.data;
  try {
    if (msg.op === 'decode') {
      const img = await decode(msg.file);
      parentPort.postMessage({ id: msg.id, width: img.width, height: img.height, data: img.data });
    } else if (msg.op === 'psd') {
      const out = encodePsd({ width: msg.width, height: msg.height, data: new Uint8Array(msg.data) });
      parentPort.postMessage({ id: msg.id, bytes: out });
    } else throw new Error('operação desconhecida');
  } catch (e) { parentPort.postMessage({ id: msg.id, error: String((e && e.message) || e) }); }
});
