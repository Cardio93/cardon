
/*CORE-START*/
const TS_MODE = {
  '1.2.840.10008.1.2': 'raw', '1.2.840.10008.1.2.1': 'raw', '1.2.840.10008.1.2.2': 'rawBE',
  '1.2.840.10008.1.2.4.50': 'jpeg', '1.2.840.10008.1.2.4.51': 'jpeg', '1.2.840.10008.1.2.5': 'rle',
  '1.2.840.10008.1.2.4.57': 'jll', '1.2.840.10008.1.2.4.70': 'jll',
  '1.2.840.10008.1.2.4.80': 'jls', '1.2.840.10008.1.2.4.81': 'jls',
  '1.2.840.10008.1.2.4.90': 'j2k', '1.2.840.10008.1.2.4.91': 'j2k'
};
const TS_NAME = {
  '1.2.840.10008.1.2.1.99': 'Deflate',
  '1.2.840.10008.1.2.4.57': 'JPEG sin pérdida', '1.2.840.10008.1.2.4.70': 'JPEG sin pérdida',
  '1.2.840.10008.1.2.4.80': 'JPEG-LS', '1.2.840.10008.1.2.4.81': 'JPEG-LS',
  '1.2.840.10008.1.2.4.90': 'JPEG 2000', '1.2.840.10008.1.2.4.91': 'JPEG 2000',
  '1.2.840.10008.1.2.4.100': 'video MPEG-2', '1.2.840.10008.1.2.4.101': 'video MPEG-2',
  '1.2.840.10008.1.2.4.102': 'video MPEG-4', '1.2.840.10008.1.2.4.103': 'video MPEG-4',
  '1.2.840.10008.1.2.4.104': 'video MPEG-4', '1.2.840.10008.1.2.4.105': 'video MPEG-4', '1.2.840.10008.1.2.4.106': 'video MPEG-4',
  '1.2.840.10008.1.2.4.107': 'video HEVC', '1.2.840.10008.1.2.4.108': 'video HEVC',
  '1.2.840.10008.1.2.4.201': 'HTJ2K', '1.2.840.10008.1.2.4.202': 'HTJ2K', '1.2.840.10008.1.2.4.203': 'HTJ2K'
};
function unsupportedText(ts) {
  const n = TS_NAME[ts];
  return n
    ? `Este archivo usa compresión ${n}, que el visor aún no lee. Expórtalo sin compresión o como JPEG desde el equipo o el PACS.`
    : `Compresión no reconocida (${ts || 'desconocida'}). Expórtalo sin compresión o como JPEG.`;
}
function num(v, d) { return (v === undefined || v === null || Number.isNaN(v)) ? d : v; }
function strList(ds, tag) { const s = ds.string(tag); return s ? s.split('\\').map(x => x.trim()) : []; }

function readPalette(ds) {
  const descs = ['x00281101', 'x00281102', 'x00281103'], datas = ['x00281201', 'x00281202', 'x00281203'];
  const ch = descs.map((dt, k) => {
    const el = ds.elements[datas[k]];
    if (!el || !ds.elements[dt]) return null;
    const entries = ds.uint16(dt, 0) || 65536, first = ds.uint16(dt, 1) || 0, bits = ds.uint16(dt, 2) || 16;
    const base = ds.byteArray.byteOffset + el.dataOffset;
    let lut;
    if (bits === 8 && el.length === entries) lut = new Uint8Array(ds.byteArray.buffer.slice(base, base + entries));
    else {
      const dv = new DataView(ds.byteArray.buffer, base, el.length);
      const n = Math.min(entries, el.length >> 1);
      lut = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const v = dv.getUint16(i * 2, true); lut[i] = bits === 16 ? v >> 8 : v & 255; }
    }
    return { lut, first };
  });
  return ch.every(Boolean) ? ch : null;
}

/* Regiones de ultrasonido (0018,6011): calibración física de 2D, modo M y Doppler */
function readRegions(ds) {
  const el = ds.elements.x00186011;
  if (!el || !el.items) return [];
  const out = [];
  for (const it of el.items) {
    const d = it.dataSet; if (!d) continue;
    const g = (t, fn) => { try { const v = d[fn](t); return Number.isFinite(v) ? v : undefined; } catch (e) { return undefined; } };
    const r = {
      fmt: g('x00186012', 'uint16'), type: g('x00186014', 'uint16'),
      x0: g('x00186018', 'uint32'), y0: g('x0018601a', 'uint32'), x1: g('x0018601c', 'uint32'), y1: g('x0018601e', 'uint32'),
      ux: g('x00186024', 'uint16'), uy: g('x00186026', 'uint16'),
      rx: g('x00186020', 'int32'), ry: g('x00186022', 'int32'),
      px: g('x00186028', 'double'), py: g('x0018602a', 'double'),
      dx: g('x0018602c', 'double'), dy: g('x0018602e', 'double'),
      angle: g('x00186034', 'double')
    };
    if (r.x0 === undefined || r.y0 === undefined || r.x1 === undefined || r.y1 === undefined) continue;
    if (!r.dx && !r.dy) continue;
    out.push(r);
  }
  return out;
}

/* ECG: Waveform Sequence (5400,0100), primer canal */
function readECG(ds) {
  const el = ds.elements.x54000100;
  if (!el || !el.items) return null;
  for (const it of el.items) {
    const d = it.dataSet; if (!d) continue;
    try {
      const nch = d.uint16('x003a0005'), ns = d.uint32('x003a0010'), fs = d.floatString('x003a001a');
      const bits = d.uint16('x54001004') || 16, interp = (d.string('x54001006') || 'SS').trim();
      const data = d.elements.x54001010;
      if (!nch || !ns || !(fs > 0) || !data) continue;
      const bps = bits === 8 ? 1 : 2, n = Math.min(ns, Math.floor(data.length / (bps * nch)));
      const dv = new DataView(d.byteArray.buffer, d.byteArray.byteOffset + data.dataOffset, data.length);
      const s = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const o = k * nch * bps;
        s[k] = bps === 1 ? (interp === 'SB' ? dv.getInt8(o) : dv.getUint8(o)) : (interp === 'US' ? dv.getUint16(o, true) : dv.getInt16(o, true));
      }
      const t0 = d.floatString('x00181068');
      return { fs, s, t0: Number.isFinite(t0) ? t0 : 0 };
    } catch (e) {}
  }
  return null;
}
/* Curvas DICOM antiguas (grupos 5000-501E): algunos equipos guardan ahí el ECG */
function readCurveECG(ds) {
  for (let g = 0x5000; g <= 0x501e; g += 2) {
    const h = 'x' + g.toString(16).padStart(4, '0');
    const el = ds.elements[h + '3000'];
    if (!el || !el.length) continue;
    try {
      const dims = ds.uint16(h + '0005') || 1, n = ds.uint16(h + '0010') || 0, dvr = ds.uint16(h + '0103') || 0;
      const type = (ds.string(h + '0020') || '').trim().toUpperCase(), desc = (ds.string(h + '0022') || '').trim().toUpperCase();
      if (type && !/ECG|PHYSIO|TAC|WAVE/.test(type + ' ' + desc) && g > 0x5000) continue;
      const size = [2, 2, 4, 8, 4][dvr] || 2, dv = new DataView(ds.byteArray.buffer, ds.byteArray.byteOffset + el.dataOffset, el.length);
      const total = Math.floor(el.length / size), pts = n || Math.floor(total / dims), s = new Float32Array(pts);
      const rd = o => dvr === 0 ? dv.getUint16(o, true) : dvr === 1 ? dv.getInt16(o, true) : dvr === 2 ? dv.getFloat32(o, true) : dvr === 3 ? dv.getFloat64(o, true) : dv.getInt32(o, true);
      for (let k = 0; k < pts && (k * dims + dims - 1) < total; k++) s[k] = rd((k * dims + dims - 1) * size);
      if (pts > 20) return { s, curve: true };
    } catch (e) {}
  }
  return null;
}
/* R Wave Pointer (0028,6040): números de cuadro (desde 1) con onda R */
function readRWave(ds) {
  const el = ds.elements.x00286040;
  if (!el || !el.length) return [];
  const out = [];
  for (let i = 0; i < el.length / 2; i++) { const v = ds.uint16('x00286040', i); if (v > 0) out.push(v - 1); }
  return out;
}

function getMeta(ds) {
  const s = t => { const v = ds.string(t); return v ? v.trim() : ''; };
  const f = (t, i = 0) => { try { const v = ds.floatString(t, i); return Number.isFinite(v) ? v : undefined; } catch (e) { return undefined; } };
  const u = t => { try { return ds.uint16(t); } catch (e) { return undefined; } };
  const ipp = strList(ds, 'x00200032').map(Number);
  const ps = strList(ds, 'x00280030').map(Number);
  const ftv = strList(ds, 'x00181065').map(Number).filter(Number.isFinite);
  const m = {
    ts: s('x00020010') || '1.2.840.10008.1.2',
    rows: u('x00280010'), cols: u('x00280011'),
    bitsAllocated: u('x00280100') || 8, bitsStored: u('x00280101') || u('x00280100') || 8,
    pixelRep: u('x00280103') || 0, spp: u('x00280002') || 1,
    photometric: (s('x00280004') || 'MONOCHROME2').toUpperCase(),
    planar: u('x00280006') || 0, frames: parseInt(s('x00280008'), 10) || 1,
    slope: num(f('x00281053'), 1) || 1, intercept: num(f('x00281052'), 0),
    wc: f('x00281050'), ww: f('x00281051'),
    frameTime: f('x00181063'), ftv,
    cineRate: f('x00180040'), recRate: f('x00082144'), hr: f('x00181088'),
    modality: s('x00080060'), seriesDesc: s('x0008103e'), studyDesc: s('x00081030'),
    date: s('x00080020'), manufacturer: s('x00080070'),
    patientName: s('x00100010').replace(/\^+/g, ' ').trim(), patientId: s('x00100020'),
    birth: s('x00100030'), sex: s('x00100040').toUpperCase(),
    weight: f('x00101030'), height: f('x00101020'),
    studyUID: s('x0020000d'), seriesUID: s('x0020000e'), sopUID: s('x00080018'), seriesNumber: f('x00200011'), instance: f('x00200013'),
    sliceLoc: num(f('x00201041'), ipp.length === 3 && Number.isFinite(ipp[2]) ? ipp[2] : undefined),
    trigger: f('x00181060'), thick: f('x00180050'), spacing: f('x00180088'), seqName: s('x00180024'), venc: f('x00189197'), kvp: f('x00180060'), z: ipp.length === 3 && Number.isFinite(ipp[2]) ? ipp[2] : f('x00201041'),
    aspect: 1, regions: readRegions(ds), ecg: readECG(ds), curve: null, rwave: readRWave(ds),
    model: s('x00081090'), software: s('x00181020'), sopClass: s('x00080016'),
    angP: f('x00181510'), angS: f('x00181511')
  };
  if (!m.ecg) m.curve = readCurveECG(ds);
  if (ps.length === 2 && ps[0] > 0 && ps[1] > 0) {
    m.aspect = ps[0] / ps[1];
    if (!m.regions.length && m.modality !== 'US') m.pixelCm = ps[1] / 10;
  } else {
    const par = strList(ds, 'x00280034').map(Number);
    if (par.length === 2 && par[0] > 0 && par[1] > 0) m.aspect = par[0] / par[1];
  }
  if (!m.pixelCm && (m.modality === 'XA' || m.modality === 'RF') && !m.regions.length) {
    const ips = strList(ds, 'x00181164').map(Number);
    if (ips.length === 2 && ips[0] > 0 && ips[1] > 0) {
      const sid = f('x00181110'), sod = f('x00181111'), emag = f('x00181114');
      const mag = emag > 1 && emag < 3 ? emag : sid > 0 && sod > 0 && sid > sod ? sid / sod : 0;
      m.aspect = ips[0] / ips[1];
      m.pixelCm = ips[1] / 10 / (mag || 1);
      m.pixelApprox = { mag: mag || 0 };
    }
  }
  if (m.photometric === 'PALETTE COLOR') m.palette = readPalette(ds);
  return m;
}

function getEncapsulatedFrame(ds, i, m) {
  const el = ds.elements.x7fe00010;
  if (!el.encapsulatedPixelData) throw new Error('Los datos de imagen no tienen el formato esperado.');
  const frags = el.fragments || [];
  if (m.frames === 1) return dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, frags.length);
  if (frags.length === m.frames) return dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, i, 1);
  let bot = el.basicOffsetTable;
  if (!bot || !bot.length) bot = el._bot || (el._bot = dicomParser.createJPEGBasicOffsetTable(ds, el));
  return dicomParser.readEncapsulatedImageFrame(ds, el, i, bot);
}

function decodeRLE(bytes, m) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nSeg = dv.getUint32(0, true);
  const bpp = m.bitsAllocated / 8, px = m.rows * m.cols;
  if (nSeg !== m.spp * bpp) throw new Error('Los datos comprimidos (RLE) no coinciden con el tamaño de la imagen.');
  const out = new Uint8Array(px * m.spp * bpp), stride = m.spp * bpp;
  for (let s = 0; s < nSeg; s++) {
    const start = dv.getUint32(4 + s * 4, true);
    const end = s + 1 < nSeg ? dv.getUint32(4 + (s + 1) * 4, true) : bytes.length;
    const sample = Math.floor(s / bpp), byteIdx = bpp - 1 - (s % bpp);
    let o = sample * bpp + byteIdx, i = start, p = 0;
    while (i < end && p < px) {
      let n = bytes[i++]; if (n > 127) n -= 256;
      if (n >= 0) { for (let k = 0; k <= n && i < end && p < px; k++) { out[o] = bytes[i++]; o += stride; p++; } }
      else if (n > -128) { const v = bytes[i++]; for (let k = 0; k < 1 - n && p < px; k++) { out[o] = v; o += stride; p++; } }
    }
  }
  return out;
}

function extractRaw(ds, m, i) {
  const el = ds.elements.x7fe00010;
  if (m.bitsAllocated % 8) throw new Error(`Imágenes de ${m.bitsAllocated} bit no compatibles.`);
  const fb = m.rows * m.cols * m.spp * (m.bitsAllocated / 8);
  if (el.dataOffset + (i + 1) * fb > ds.byteArray.length) throw new Error('El archivo está incompleto o dañado.');
  const start = ds.byteArray.byteOffset + el.dataOffset + i * fb;
  return new Uint8Array(ds.byteArray.buffer.slice(start, start + fb));
}

function rawToPixels(raw, m, le, planar) {
  const n = m.rows * m.cols, ph = m.photometric, ba = m.bitsAllocated;
  if (raw.byteOffset % 4) raw = raw.slice();
  if (ba === 16 && !le) for (let k = 0; k + 1 < raw.length; k += 2) { const t = raw[k]; raw[k] = raw[k + 1]; raw[k + 1] = t; }
  if (m.spp === 1 && ph.startsWith('MONOCHROME')) {
    let data;
    if (ba === 8) data = m.pixelRep ? new Int8Array(raw.buffer, raw.byteOffset, n) : raw.subarray(0, n);
    else if (ba === 16) {
      data = m.pixelRep ? new Int16Array(raw.buffer, raw.byteOffset, n) : new Uint16Array(raw.buffer, raw.byteOffset, n);
      if (!m.pixelRep && m.bitsStored < 16) { const mask = (1 << m.bitsStored) - 1; for (let k = 0; k < n; k++) data[k] &= mask; }
    } else if (ba === 32) data = m.pixelRep ? new Int32Array(raw.buffer, raw.byteOffset, n) : new Uint32Array(raw.buffer, raw.byteOffset, n);
    else throw new Error(`Imágenes de ${ba} bit no compatibles.`);
    return { kind: 'gray', data, w: m.cols, h: m.rows, slope: m.slope, intercept: m.intercept, mono1: ph === 'MONOCHROME1' };
  }
  if (m.spp === 1 && ph === 'PALETTE COLOR') {
    if (!m.palette) throw new Error('El archivo usa una paleta de color que no se pudo leer.');
    const src = ba === 16 ? new Uint16Array(raw.buffer, raw.byteOffset, n) : raw;
    const [R, G, B] = m.palette, rgba = new Uint8ClampedArray(n * 4);
    const pick = (ch, v) => { let i = v - ch.first; if (i < 0) i = 0; else if (i >= ch.lut.length) i = ch.lut.length - 1; return ch.lut[i]; };
    for (let p = 0, q = 0; p < n; p++, q += 4) { const v = src[p]; rgba[q] = pick(R, v); rgba[q + 1] = pick(G, v); rgba[q + 2] = pick(B, v); rgba[q + 3] = 255; }
    return { kind: 'rgba', rgba, w: m.cols, h: m.rows };
  }
  if (m.spp === 3 && ba === 8 && !ph.endsWith('_422') && !ph.endsWith('_420')) {
    const rgba = new Uint8ClampedArray(n * 4), ybr = ph.startsWith('YBR'), pl = planar === 1;
    for (let p = 0, q = 0; p < n; p++, q += 4) {
      let r, g, b;
      if (pl) { r = raw[p]; g = raw[n + p]; b = raw[2 * n + p]; } else { r = raw[3 * p]; g = raw[3 * p + 1]; b = raw[3 * p + 2]; }
      if (ybr) { const Y = r, Cb = g - 128, Cr = b - 128; r = Y + 1.402 * Cr; g = Y - 0.344136 * Cb - 0.714136 * Cr; b = Y + 1.772 * Cb; }
      rgba[q] = r; rgba[q + 1] = g; rgba[q + 2] = b; rgba[q + 3] = 255;
    }
    return { kind: 'rgba', rgba, w: m.cols, h: m.rows };
  }
  throw new Error(`Formato de imagen no compatible (${ph}, ${ba} bit, ${m.spp} canales).`);
}

function lineToPixel(src, w, h) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) for (let x = 0; x < w; x++) out[(y * w + x) * 3 + c] = src[(y * 3 + c) * w + x];
  return out;
}
/* lib = { j2k: módulo OpenJPEG, jls: módulo CharLS, jll: módulo jpeg-lossless } */
function decodeCodec(lib, codec, bytes, m) {
  let out, w = 0, h = 0, comps = m.spp, bps = m.bitsAllocated, planar = 0;
  if (codec === 'jll') {
    const d = new lib.jll.Decoder();
    const r = d.decode(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    out = new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
    if (r.BYTES_PER_ELEMENT === 2) bps = 16; else if (r.BYTES_PER_ELEMENT === 1) bps = 8;
  } else {
    const D = codec === 'j2k' ? new lib.j2k.J2KDecoder() : new lib.jls.JpegLSDecoder();
    try {
      D.getEncodedBuffer(bytes.length).set(bytes);
      D.decode();
      const fi = D.getFrameInfo();
      out = D.getDecodedBuffer().slice();
      w = fi.width; h = fi.height; comps = fi.componentCount; bps = fi.bitsPerSample;
      if (codec === 'jls' && comps === 3 && D.getInterleaveMode) {
        const ilv = D.getInterleaveMode();
        if (ilv === 0) planar = 1; else if (ilv === 1) out = lineToPixel(out, w, h);
      }
    } finally { try { D.delete(); } catch (e) {} }
  }
  const ph = /^YBR_(RCT|ICT)$/.test(m.photometric) || (codec !== 'jll' && /_42[02]$/.test(m.photometric)) ? 'RGB' : m.photometric;
  const mm = Object.assign({}, m, { bitsAllocated: bps > 8 ? 16 : 8, spp: comps || m.spp, photometric: ph });
  if (w && h) { mm.rows = h; mm.cols = w; }
  return rawToPixels(out, mm, true, planar);
}

function frameFromDataset(ds, m, i) {
  const mode = TS_MODE[m.ts];
  if (!mode) throw new Error(unsupportedText(m.ts));
  if (!m.rows || !m.cols) throw new Error('El archivo no indica el tamaño de la imagen.');
  if (mode === 'jpeg') return { kind: 'jpeg', bytes: getEncapsulatedFrame(ds, i, m) };
  if (mode === 'j2k' || mode === 'jls' || mode === 'jll') return { kind: 'codec', codec: mode, bytes: getEncapsulatedFrame(ds, i, m) };
  if (mode === 'rle') return rawToPixels(decodeRLE(getEncapsulatedFrame(ds, i, m), m), m, true, 0);
  return rawToPixels(extractRaw(ds, m, i), m, mode !== 'rawBE', m.planar);
}

function frameTimes(m, n) {
  const t = new Float64Array(n);
  if (m.ftv && m.ftv.length >= n) { let acc = 0; for (let k = 0; k < n; k++) { acc += k === 0 ? 0 : m.ftv[k]; t[k] = acc; } return t; }
  const ft = m.frameTime > 0 ? m.frameTime : m.recRate > 0 ? 1000 / m.recRate : m.cineRate > 0 ? 1000 / m.cineRate : 1000 / 30;
  for (let k = 0; k < n; k++) t[k] = k * ft;
  return t;
}
function detectR(s, fs) {
  const n = s.length; if (n < fs) return [];
  const sorted = Array.from(s).sort((a, b) => a - b), med = sorted[n >> 1];
  let hi = 0, lo = 0; for (let k = 0; k < n; k++) { const v = s[k] - med; if (v > hi) hi = v; if (v < lo) lo = v; }
  const sign = hi >= -lo ? 1 : -1;
  const win = Math.max(1, Math.round(0.08 * fs)), e = new Float32Array(n);
  let acc = 0; const d2 = new Float32Array(n);
  for (let k = 1; k < n - 1; k++) { const dv = (s[k + 1] - s[k - 1]) / 2; d2[k] = dv * dv; }
  for (let k = 0; k < n; k++) { acc += d2[k]; if (k >= win) acc -= d2[k - win]; e[k] = acc; }
  let mx = 0; for (let k = 0; k < n; k++) if (e[k] > mx) mx = e[k];
  if (!(mx > 0)) return [];
  const thr = 0.3 * mx, refr = Math.round(0.25 * fs), half = Math.round(0.06 * fs), peaks = [];
  let k = 0;
  while (k < n) {
    if (e[k] > thr) {
      let end = k; while (end < n && e[end] > thr) end++;
      let best = -1, bv = -Infinity;
      for (let j = Math.max(0, k - half); j < Math.min(n, end + half); j++) { const v = sign * (s[j] - med); if (v > bv) { bv = v; best = j; } }
      if (best >= 0 && (!peaks.length || best - peaks[peaks.length - 1] > refr)) peaks.push(best);
      k = Math.max(end, best + refr);
    } else k++;
  }
  return peaks;
}
/* Telediástole = onda R; telesístole estimada al final de la onda T: QT = 400 ms × √(RR en s) (Bazett con QTc 400 ms). */
function cycleMarks(m, n) {
  if (n < 2) return null;
  const t = frameTimes(m, n), T = t[n - 1];
  let rTimes = [];
  let ecg = m.ecg;
  if (!ecg && m.curve && T > 0) ecg = { s: m.curve.s, fs: (m.curve.s.length - 1) / (T / 1000), t0: 0, curve: true };
  if (m.rwave && m.rwave.length) rTimes = m.rwave.filter(i => i >= 0 && i < n).map(i => t[i]);
  else if (ecg) rTimes = detectR(ecg.s, ecg.fs).map(i => ecg.t0 + i / ecg.fs * 1000);
  if (!rTimes.length) return null;
  const diffs = []; for (let i = 1; i < rTimes.length; i++) diffs.push(rTimes[i] - rTimes[i - 1]);
  let rr = diffs.length ? diffs.sort((a, b) => a - b)[diffs.length >> 1] : (m.hr > 0 ? 60000 / m.hr : null);
  if (!(rr > 250 && rr < 2500)) rr = m.hr > 0 ? 60000 / m.hr : null;
  const near = time => { let b = 0, bd = Infinity; for (let k = 0; k < n; k++) { const d = Math.abs(t[k] - time); if (d < bd) { bd = d; b = k; } } return b; };
  const span = (t[1] - t[0]) * 0.75;
  const ed = [], es = [];
  for (const r of rTimes) if (r >= -span && r <= T + span) ed.push(near(r));
  if (rr) {
    const qt = 400 * Math.sqrt(rr / 1000);
    const starts = rTimes.slice(); if (rTimes[0] > qt) starts.unshift(rTimes[0] - rr);
    for (const r of starts) { const x = r + qt; if (x >= -span && x <= T + span) es.push(near(x)); }
  }
  const uniq = a => [...new Set(a)].sort((x, y) => x - y);
  return { ed: uniq(ed), es: uniq(es), rr, times: t, ecg };
}

/* ---- ECG dibujado en la imagen (trazo verde que se dibuja de izquierda a derecha, como en Philips) ---- */
const isGreen = (r, g, b) => g > 110 && g - r > 45 && g - b > 45;
/* Busca una franja horizontal con trazo verde. px: RGBA del cuadro completo. */
function findECGBand(px, w, h) {
  const pre = new Int32Array(w * (h + 1));
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = 0; y < h; y++) { const o = (y * w + x) * 4; if (isGreen(px[o], px[o + 1], px[o + 2])) acc++; pre[x * (h + 1) + y + 1] = acc; }
  }
  const win = Math.max(24, Math.round(h * 0.08));
  let best = null;
  for (let y = 0; y + win <= h; y += 2) {
    let cols = 0, x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) if (pre[x * (h + 1) + y + win] - pre[x * (h + 1) + y] > 0) { cols++; if (x0 < 0) x0 = x; x1 = x; }
    if (!best || cols > best.cols) best = { cols, y0: y, y1: y + win, x0, x1 };
  }
  if (!best || best.cols < Math.max(100, w * 0.1)) return null;
  let tot = 0; for (let x = 0; x < w; x++) tot += pre[x * (h + 1) + best.y1] - pre[x * (h + 1) + best.y0];
  if (tot / best.cols > 9) return null;
  const pad = 6;
  return { x0: Math.max(0, best.x0 - pad), x1: Math.min(w - 1, best.x1 + pad), y0: Math.max(0, best.y0 - pad), y1: Math.min(h, best.y1 + pad) };
}
/* frames: lista de { px (RGBA de la franja), w, h }; times: ms de cada cuadro. Devuelve los inicios del QRS en ms. */
function ecgFromSweep(frames, times) {
  const n = frames.length; if (n < 3) return null;
  const W = frames[0].w, H = frames[0].h;
  const cols = frames.map(f => {
    const mn = new Int16Array(W).fill(-1), mx = new Int16Array(W).fill(-1), sum = new Float32Array(W), cnt = new Int16Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (isGreen(f.px[o], f.px[o + 1], f.px[o + 2])) { if (mn[x] < 0) mn[x] = y; mx[x] = y; sum[x] += y; cnt[x]++; }
    }
    const mean = new Float32Array(W).fill(NaN);
    for (let x = 0; x < W; x++) if (cnt[x]) mean[x] = sum[x] / cnt[x];
    return { mn, mx, mean };
  });
  const allMeans = [];
  for (const c of cols) for (let x = 0; x < W; x++) if (!isNaN(c.mean[x])) allMeans.push(c.mean[x]);
  if (allMeans.length < 50) return null;
  allMeans.sort((a, b) => a - b);
  const base = allMeans[allMeans.length >> 1];
  const S = [];
  let gainedTotal = 0;
  for (let k = 1; k < n; k++) {
    const a = cols[k - 1], b = cols[k], g = [];
    for (let x = 0; x < W; x++) {
      if (isNaN(b.mean[x])) continue;
      if (isNaN(a.mean[x]) || Math.abs(b.mean[x] - a.mean[x]) > 2.5) g.push(x);
    }
    gainedTotal += g.length;
    const t0 = times[k - 1], t1 = times[k];
    g.forEach((x, j) => {
      const up = base - b.mn[x], dn = b.mx[x] - base;
      S.push({ t: t0 + (j + 1) / (g.length + 1) * (t1 - t0), v: up >= dn ? up : -dn, k });
    });
  }
  if (gainedTotal < W * 0.25 || S.length < 40) return null;
  let A = 0; for (const p of S) A = Math.max(A, Math.abs(p.v));
  if (A < 4) return null;
  const slope = S.map((p, i) => i ? Math.abs(p.v - S[i - 1].v) : 0);
  let maxSl = 0; for (const x of slope) maxSl = Math.max(maxSl, x);
  const groups = [];
  for (let i = 0; i < S.length; i++) {
    if (Math.abs(S[i].v) < 0.45 * A) continue;
    const g = groups[groups.length - 1];
    if (g && S[i].t - S[g.last].t < 120) { g.last = i; if (Math.abs(S[i].v) > Math.abs(S[g.peak].v)) g.peak = i; }
    else groups.push({ first: i, last: i, peak: i });
  }
  const onsets = [];
  for (const g of groups) {
    if (g.last - g.first + 1 < 3) continue;
    let sl = 0; for (let i = Math.max(1, g.first - 4); i <= Math.min(S.length - 1, g.last + 4); i++) sl = Math.max(sl, slope[i]);
    if (sl < 0.3 * maxSl) continue;
    const tp = S[g.peak].t, pre = S.filter(q => q.t >= tp - 260 && q.t <= tp - 100).map(q => q.v).sort((a, b) => a - b);
    const lb = pre.length ? pre[pre.length >> 1] : 0, lim = 0.25 * Math.abs(S[g.peak].v - lb);
    let o = g.first;
    while (o > 0 && Math.abs(S[o - 1].v - lb) > lim && S[g.first].t - S[o - 1].t < 120) o--;
    const t = S[o].t;
    if (!onsets.length || t - onsets[onsets.length - 1] > 300) onsets.push(t);
  }
  if (!onsets.length) return null;
  if (onsets.length >= 3) {
    const d = []; for (let i = 1; i < onsets.length; i++) d.push(onsets[i] - onsets[i - 1]);
    const med = d.slice().sort((a, b) => a - b)[d.length >> 1];
    if (!(med > 300 && med < 2000) || d.some(x => Math.abs(x - med) / med > 0.45)) return null;
  }
  return { rTimes: onsets, amp: A };
}
/* Convierte tiempos de onda R en marcas de telediástole y telesístole estimada */
function marksFromR(rTimes, t, n, hr) {
  const T = t[n - 1];
  const diffs = []; for (let i = 1; i < rTimes.length; i++) diffs.push(rTimes[i] - rTimes[i - 1]);
  let rr = diffs.length ? diffs.slice().sort((a, b) => a - b)[diffs.length >> 1] : (hr > 0 ? 60000 / hr : null);
  if (!(rr > 250 && rr < 2500)) rr = hr > 0 ? 60000 / hr : null;
  const near = time => { let b = 0, bd = Infinity; for (let k = 0; k < n; k++) { const d = Math.abs(t[k] - time); if (d < bd) { bd = d; b = k; } } return b; };
  const span = (t[1] - t[0]) * 0.75, ed = [], es = [];
  for (const r of rTimes) if (r >= -span && r <= T + span) ed.push(near(r));
  if (rr) {
    const qt = 400 * Math.sqrt(rr / 1000);
    const starts = rTimes.slice(); if (rTimes[0] > qt) starts.unshift(rTimes[0] - rr);
    for (const r of starts) { const x = r + qt; if (x >= -span && x <= T + span) es.push(near(x)); }
  }
  const uniq = a => [...new Set(a)].sort((x, y) => x - y);
  return { ed: uniq(ed), es: uniq(es), rr, times: t };
}

const clampFps = x => Math.min(120, Math.max(1, Math.round(x * 10) / 10));
function clipFps(metas, multi) {
  const m = metas[0];
  if (multi) {
    const v = m.ftv.filter(x => x > 0);
    if (v.length) return clampFps(1000 / (v.reduce((a, b) => a + b, 0) / v.length));
    if (m.frameTime > 0) return clampFps(1000 / m.frameTime);
  } else if (metas.length > 1) {
    const t = metas.map(x => x.trigger).filter(Number.isFinite);
    if (t.length === metas.length) { const span = Math.max(...t) - Math.min(...t); if (span > 0) return clampFps(1000 / (span / (metas.length - 1))); }
  }
  if (m.recRate > 0) return clampFps(m.recRate);
  if (m.cineRate > 0) return clampFps(m.cineRate);
  return multi ? 30 : 20;
}

function angText(m) {
  if (!Number.isFinite(m.angP) && !Number.isFinite(m.angS)) return '';
  const p = Number.isFinite(m.angP) ? `${m.angP >= 0 ? 'OAI' : 'OAD'} ${Math.round(Math.abs(m.angP))}°` : '';
  const q = Number.isFinite(m.angS) ? `${m.angS >= 0 ? 'CRA' : 'CAU'} ${Math.round(Math.abs(m.angS))}°` : '';
  return [p, q].filter(Boolean).join(' · ');
}
function makeClip(list, multi, extra) {
  let items;
  if (multi) { const p = list[0]; items = Array.from({ length: p.m.frames }, (_, i) => ({ ds: p.ds, m: p.m, index: i })); }
  else {
    const sorted = extra && extra.stack ? list.slice().sort((a, b) => num(b.m.z, 0) - num(a.m.z, 0) || num(a.m.instance, 0) - num(b.m.instance, 0))
      : list.slice().sort((a, b) => num(a.m.trigger, 0) - num(b.m.trigger, 0) || num(a.m.instance, 0) - num(b.m.instance, 0));
    items = sorted.map(p => ({ ds: p.ds, m: p.m, index: 0 }));
  }
  const m = items[0].m;
  const fps = clipFps(multi ? [m] : items.map(x => x.m), multi);
  const label = m.seriesDesc || m.studyDesc || (multi ? list[0].name : (list[0].name || 'Serie sin nombre'));
  const isStack = !!(extra && extra.stack);
  const parts = [m.modality, `${items.length} ${items.length === 1 ? 'imagen' : isStack ? 'cortes' : 'cuadros'}`];
  if (isStack && m.thick) parts.push(`${(typeof I18N !== 'undefined' && I18N.lang === 'en') ? m.thick : String(m.thick).replace('.', ',')} mm`);
  if (items.length > 1 && !isStack) parts.push(`${(typeof I18N !== 'undefined' && I18N.lang === 'en') ? String(fps) : String(fps).replace('.', ',')} fps`);
  if (angText(m)) parts.push(angText(m));
  if (m.regions.some(r => r.fmt === 3)) parts.push('Doppler');
  else if (m.regions.some(r => r.fmt === 2)) parts.push('modo M');
  return Object.assign({ label, sub: parts.filter(Boolean).join(' · '), items, fps, m, multi }, extra || {});
}

function buildClips(parsed) {
  const clips = [], groups = new Map();
  for (const p of parsed) {
    if (p.m.frames > 1) { clips.push(makeClip([p], true)); continue; }
    const key = p.m.seriesUID || ('archivo:' + p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  for (const list of groups.values()) {
    if (list[0].m.modality === 'US' && list.length > 1) { for (const p of list) clips.push(makeClip([p], false)); continue; }
    const byLoc = new Map();
    for (const p of list) {
      const l = Number.isFinite(p.m.sliceLoc) ? Math.round(p.m.sliceLoc * 10) / 10 : 'x';
      if (!byLoc.has(l)) byLoc.set(l, []);
      byLoc.get(l).push(p);
    }
    const hasTrig = list.some(p => Number.isFinite(p.m.trigger));
    if (list.length > 2 && byLoc.size === list.length && !hasTrig && (list[0].m.modality === 'CT' || list[0].m.modality === 'MR')) { clips.push(makeClip(list, false, { stack: true })); continue; }
    if (byLoc.size > 1 && byLoc.size < list.length && hasTrig) {
      const locs = [...byLoc.keys()].sort((a, b) => (a === 'x') - (b === 'x') || a - b);
      locs.forEach((l, k) => {
        const c = makeClip(byLoc.get(l), false, { slice: k + 1, slices: locs.length });
        c.sub = `Corte ${k + 1}/${locs.length} · ` + c.sub;
        clips.push(c);
      });
    } else clips.push(makeClip(list, false));
  }
  const key = c => [num(c.m.seriesNumber, 1e9), num(c.m.instance, 1e9)];
  clips.sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1]; });
  return clips;
}

function parseFileBytes(bytes) {
  let ds;
  try { ds = dicomParser.parseDicom(bytes); }
  catch (e) {
    if (e && e.dataSet && e.dataSet.elements.x7fe00010) ds = e.dataSet;
    else ds = dicomParser.parseDicom(bytes, { TransferSyntaxUID: '1.2.840.10008.1.2' });
  }
  return ds;
}

/* ---- Medición: pasa de píxeles de la imagen a unidades físicas ---- */
const UNIT_CM = 3, UNIT_S = 4, UNIT_CMS = 7;
function regionAt(regions, p) {
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    if (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1) return { r, i };
  }
  return null;
}
function baselineY(r, i, ctx) {
  const o = ctx.baseOverride && ctx.baseOverride[i];
  return Number.isFinite(o) ? o : r.y0 + (r.ry || 0);
}
const ERR_2D = 'Esta imagen no trae calibración de distancias. Usa «Calibrar distancia» sobre la escala de profundidad.';
function spatialScale(ctx, p) {
  const hit = regionAt(ctx.regions || [], p);
  if (hit) {
    const r = hit.r;
    if (r.fmt === 1 && r.ux === UNIT_CM && r.uy === UNIT_CM) return { kind: '2d', sx: Math.abs(r.dx), sy: Math.abs(r.dy) };
    if (r.fmt === 2 && r.uy === UNIT_CM) return { kind: 'm', sx: 0, sy: Math.abs(r.dy) };
    if (r.fmt === 3 || r.fmt === 4) throw new Error('Ese punto está sobre el Doppler. Las distancias se miden en la imagen 2D o en modo M.');
  }
  if (ctx.cal && ctx.cal.cm > 0) return { kind: '2d', sx: ctx.cal.cm, sy: ctx.cal.cm * (ctx.aspect || 1) };
  if (ctx.pixelCm > 0) return { kind: '2d', sx: ctx.pixelCm, sy: ctx.pixelCm * (ctx.aspect || 1) };
  if ((ctx.regions || []).length) throw new Error('Ese punto está fuera de las zonas calibradas de la imagen.');
  throw new Error(ERR_2D);
}
function dopplerScale(ctx, p, needTime) {
  const hit = regionAt(ctx.regions || [], p);
  if (hit && hit.r.fmt === 3 && hit.r.uy === UNIT_CMS) {
    const r = hit.r;
    if (needTime && r.ux !== UNIT_S) throw new Error('Este Doppler no trae escala de tiempo en el archivo.');
    return { base: baselineY(r, hit.i, ctx), dy: r.dy, py: r.py || 0, dt: Math.abs(r.dx || 0), region: hit, k: angleK(ctx) };
  }
  if (!hit && ctx.dop && ctx.dop.cms > 0) {
    if (needTime) throw new Error('Con calibración manual solo se miden velocidades puntuales; el tiempo necesita la calibración del archivo.');
    return { base: ctx.dop.baseY, dy: -ctx.dop.cms, py: 0, dt: 0, k: angleK(ctx) };
  }
  throw new Error('Haz clic dentro del espectro Doppler. Si la imagen no trae calibración, usa «Calibrar Doppler».');
}
/* Corrección por ángulo: velocidad real = velocidad medida / cos(θ) */
function angleK(ctx) { const a = ctx && ctx.angle; return a > 0 && a < 80 ? 1 / Math.cos(a * Math.PI / 180) : 1; }
function velAt(sc, y) { return Math.abs(sc.py + (y - sc.base) * sc.dy) * (sc.k || 1); }

function contourGeometry(pts) {
  const n = pts.length;
  const A = pts[0], B = pts[n - 1];
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  let apex = pts[0], L = 0;
  for (const p of pts) { const d = Math.hypot(p.x - mid.x, p.y - mid.y); if (d > L) { L = d; apex = p; } }
  let area = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p.x * q.y - q.x * p.y; }
  area = Math.abs(area) / 2;
  const widths = [];
  if (L > 0) {
    const ux = (apex.x - mid.x) / L, uy = (apex.y - mid.y) / L;
    const loc = pts.map(p => ({ a: (p.x - mid.x) * ux + (p.y - mid.y) * uy, c: -(p.x - mid.x) * uy + (p.y - mid.y) * ux }));
    for (let k = 0; k < 20; k++) {
      const h = (k + 0.5) * L / 20, xs = [];
      for (let i = 0; i < n; i++) {
        const p = loc[i], q = loc[(i + 1) % n];
        if ((p.a - h) * (q.a - h) <= 0 && p.a !== q.a) xs.push(p.c + (h - p.a) / (q.a - p.a) * (q.c - p.c));
      }
      widths.push(xs.length >= 2 ? Math.max(...xs) - Math.min(...xs) : 0);
    }
  }
  const vol = Math.PI / 4 * widths.reduce((s, w) => s + w * w, 0) * L / 20;
  return { area, L, widths, vol, mid, apex };
}
function biplaneVolume(g4, g2) {
  const L = Math.max(g4.L, g2.L);
  let s = 0; for (let k = 0; k < 20; k++) s += (g4.widths[k] || 0) * (g2.widths[k] || 0);
  return Math.PI / 4 * s * L / 20;
}

function measureValue(type, pts, ctx) {
  if (type === 'dist') {
    const a = pts[0], b = pts[1];
    const sc = spatialScale(ctx, a);
    if (sc.kind === 'm') return { v: Math.abs(b.y - a.y) * sc.sy };
    return { v: Math.hypot((b.x - a.x) * sc.sx, (b.y - a.y) * sc.sy) };
  }
  if (type === 'vel') { const sc = dopplerScale(ctx, pts[0], false); return { v: velAt(sc, pts[0].y) }; }
  if (type === 'time') {
    const hit = regionAt(ctx.regions || [], pts[0]);
    if (!hit || !(hit.r.fmt === 2 || hit.r.fmt === 3) || hit.r.ux !== UNIT_S) throw new Error('Los tiempos se miden en un Doppler o modo M que traiga escala de tiempo en el archivo.');
    return { v: Math.abs(pts[1].x - pts[0].x) * Math.abs(hit.r.dx) };
  }
  if (type === 'slope') {
    const sc = dopplerScale(ctx, pts[0], true);
    const v0 = velAt(sc, pts[0].y), v1 = velAt(sc, pts[1].y), dt = Math.abs(pts[1].x - pts[0].x) * sc.dt;
    if (!(dt > 0) || !(v0 > v1)) throw new Error('Arrastra desde el pico de la onda siguiendo la pendiente de desaceleración, hacia la línea de base.');
    return { v: v0 * (1 - Math.SQRT1_2) / ((v0 - v1) / dt) };
  }
  if (type === 'area') {
    if (pts.length < 6) throw new Error('El trazo es muy corto. Recorre todo el contorno sin soltar.');
    const sc = spatialScale(ctx, pts[0]);
    if (sc.kind !== '2d') throw new Error('Las áreas se trazan en la imagen 2D.');
    const q = pts.map(p => ({ x: p.x * sc.sx, y: p.y * sc.sy }));
    let a = 0, per = 0;
    for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p.x * r.y - r.x * p.y; per += Math.hypot(r.x - p.x, r.y - p.y); }
    return { v: { area: Math.abs(a) / 2, perim: per } };
  }
  if (type === 'trace') {
    if (pts.length < 6) throw new Error('El trazo es muy corto. Recorre todo el contorno sin soltar.');
    const sc = spatialScale(ctx, pts[0]);
    if (sc.kind !== '2d') throw new Error('Los contornos se trazan en la imagen 2D.');
    const g = contourGeometry(pts.map(p => ({ x: p.x * sc.sx, y: p.y * sc.sy })));
    return { v: { area: g.area, L: g.L, w: g.widths, vol: g.vol } };
  }
  if (type === 'vti') {
    if (pts.length < 4) throw new Error('El trazo es muy corto. Recorre la onda de principio a fin sin soltar.');
    const sc = dopplerScale(ctx, pts[0], true);
    const s = pts.slice().sort((a, b) => a.x - b.x);
    let vti = 0, g = 0, vmax = 0;
    for (let i = 0; i < s.length; i++) {
      const v = velAt(sc, s[i].y); if (v > vmax) vmax = v;
      if (i) {
        const v0 = velAt(sc, s[i - 1].y), dt = (s[i].x - s[i - 1].x) * sc.dt;
        vti += (v0 + v) / 2 * dt;
        g += (4 * (v0 / 100) ** 2 + 4 * (v / 100) ** 2) / 2 * dt;
      }
    }
    const T = (s[s.length - 1].x - s[0].x) * sc.dt;
    if (!(T > 0)) throw new Error('El trazo no avanza en el tiempo. Recorre la onda de izquierda a derecha.');
    return { v: { vti, vmax, mg: g / T, T } };
  }
  throw new Error('Tipo de medida desconocido.');
}
/*CORE-END*/
