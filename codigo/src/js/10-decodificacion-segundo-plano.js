/* ======================= Decodificación (segundo plano) ======================= */
/* En la versión sin conexión las librerías vienen dentro del archivo (window.__cardonLibs) */
const OFFLINE_LIBS = window.__cardonLibs || null, libBlobs = {};
function libURL(name, url) {
  if (OFFLINE_LIBS && OFFLINE_LIBS[name]) {
    if (!libBlobs[name]) libBlobs[name] = URL.createObjectURL(new Blob([unb64(OFFLINE_LIBS[name])], { type: 'text/javascript' }));
    return libBlobs[name];
  }
  return url;
}
const CODEC_URLS = {
  j2k: libURL('j2k', 'https://cdn.jsdelivr.net/npm/@cornerstonejs/codec-openjpeg@1.3.6/dist/openjpegjs_decode.js'),
  jls: libURL('jls', 'https://cdn.jsdelivr.net/npm/@cornerstonejs/codec-charls@1.2.7/dist/charlsjs_decode.js'),
  jll: libURL('jll', 'https://cdn.jsdelivr.net/npm/jpeg-lossless-decoder-js@2.1.2/release/lossless-min.js')
};
const mainLibs = {};
function loadScript(url) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el decodificador. Revisa tu conexión a internet.')); document.head.append(s); }); }
function getLib(codec) {
  if (!mainLibs[codec]) {
    mainLibs[codec] = (async () => {
      if (codec === 'jll') return await import(CODEC_URLS.jll);
      await loadScript(CODEC_URLS[codec]);
      const factory = codec === 'j2k' ? window.OpenJPEGJS : window.CharLS;
      return await factory({ print() {}, printErr() {} });
    })();
    mainLibs[codec].catch(() => { delete mainLibs[codec]; });
  }
  return mainLibs[codec];
}
const Pool = {
  workers: [], next: 0, seq: 0, pending: new Map(), ok: false, noCodec: {},
  init() {
    try {
      const src = [rawToPixels, decodeRLE, decodeCodec, lineToPixel].map(f => f.toString()).join('\n') + `
const URLS = ${JSON.stringify(CODEC_URLS)}; const libs = {};
function lib(c) {
  if (!libs[c]) libs[c] = (async () => {
    if (c === 'jll') return self.__jll || await import(URLS.jll);
    if (!(c === 'j2k' ? self.OpenJPEGJS : self.CharLS)) importScripts(URLS[c]);
    const f = c === 'j2k' ? self.OpenJPEGJS : self.CharLS;
    return await f({ print() {}, printErr() {} });
  })();
  return libs[c];
}
self.onmessage = async e => {
  const { id, kind, codec, bytes, m } = e.data;
  try {
    let r;
    if (kind === 'codec') { const L = {}; L[codec] = await lib(codec); r = decodeCodec(L, codec, bytes, m); }
    else if (kind === 'rle') r = rawToPixels(decodeRLE(bytes, m), m, true, 0);
    else r = rawToPixels(bytes, m, kind !== 'rawBE', m.planar);
    if (r.kind === 'gray') {
      const d = r.data, copy = d.byteOffset === 0 && d.byteLength === d.buffer.byteLength ? d : d.slice();
      self.postMessage({ id, ok: true, r: { kind: 'gray', type: copy.constructor.name, buf: copy.buffer, w: r.w, h: r.h, slope: r.slope, intercept: r.intercept, mono1: r.mono1 } }, [copy.buffer]);
    } else self.postMessage({ id, ok: true, r: { kind: 'rgba', buf: r.rgba.buffer, w: r.w, h: r.h } }, [r.rgba.buffer]);
  } catch (err) { self.postMessage({ id, ok: false, msg: String((err && err.message) || err) }); }
};`;
      let pre = '';
      if (OFFLINE_LIBS) {
        for (const k of ['j2k', 'jls']) if (OFFLINE_LIBS[k]) pre += TD.decode(unb64(OFFLINE_LIBS[k])) + '\n';
        if (OFFLINE_LIBS.jll) pre += jllClassic(TD.decode(unb64(OFFLINE_LIBS.jll)));
      }
      const url = URL.createObjectURL(new Blob([pre, src], { type: 'text/javascript' }));
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url);
        w.onmessage = e => { const p = this.pending.get(e.data.id); if (!p) return; this.pending.delete(e.data.id); e.data.ok ? p.res(e.data.r) : p.rej(new Error(e.data.msg)); };
        w.onerror = () => { this.ok = false; for (const p of this.pending.values()) p.rej(new Error('worker')); this.pending.clear(); };
        this.workers.push(w);
      }
      this.ok = true;
    } catch (e) { this.ok = false; }
  },
  run(job) {
    return new Promise((res, rej) => {
      const id = ++this.seq; this.pending.set(id, { res, rej });
      const w = this.workers[this.next++ % this.workers.length];
      w.postMessage(Object.assign({ id }, job), [job.bytes.buffer]);
    });
  }
};
/* Convierte el módulo de jpeg-lossless en un script clásico para incrustarlo en el proceso de segundo plano */
function jllClassic(src) {
  const m = src.match(/export\s*\{([^}]*)\}\s*;?/);
  if (!m) return '';
  const map = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)).map(([a, b]) => `${b || a}:${a}`).join(',');
  return '(function(){' + src.replace(m[0], '') + '\nself.__jll={' + map + '};})();\n';
}
/* Pide varios cuadros a la vez (en orden) para aprovechar todos los procesos de decodificación */
async function decodeMany(c, n, keepGoing, onStep) {
  let next = 0, stop = false;
  const K = Math.max(2, Math.min(6, (Pool.workers.length || 1) + 1));
  const lane = async () => {
    while (!stop) {
      const i = next++; if (i >= n) return;
      if (keepGoing && !keepGoing()) { stop = true; return; }
      if (!c.ready[i]) { try { await requestFrame(c, i); } catch (e) { stop = true; throw e; } }
      if (onStep) await onStep(i);
    }
  };
  await Promise.all(Array.from({ length: K }, lane));
}
const TYPED = { Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array };
function liteMeta(m) {
  return { rows: m.rows, cols: m.cols, spp: m.spp, bitsAllocated: m.bitsAllocated, bitsStored: m.bitsStored, pixelRep: m.pixelRep, photometric: m.photometric, planar: m.planar, slope: m.slope, intercept: m.intercept, palette: m.palette || null };
}
async function decodeFrameAsync(ds, m, index) {
  const mode = TS_MODE[m.ts];
  if (!mode) throw new Error(unsupportedText(m.ts));
  if (!m.rows || !m.cols) throw new Error('El archivo no indica el tamaño de la imagen.');
  if (mode === 'jpeg') {
    const bmp = await createImageBitmap(new Blob([getEncapsulatedFrame(ds, index, m)], { type: 'image/jpeg' }));
    return { kind: 'bmp', bmp, w: bmp.width, h: bmp.height };
  }
  const raw = mode === 'raw' || mode === 'rawBE';
  const kind = raw ? mode : mode === 'rle' ? 'rle' : 'codec';
  const mk = () => raw ? extractRaw(ds, m, index) : getEncapsulatedFrame(ds, index, m).slice();
  const lm = liteMeta(m);
  let r = null;
  if (Pool.ok && !(kind === 'codec' && Pool.noCodec[mode])) {
    try {
      const o = await Pool.run({ kind, codec: mode, bytes: mk(), m: lm });
      r = o.kind === 'gray' ? Object.assign(o, { data: new TYPED[o.type](o.buf) }) : { kind: 'rgba', rgba: new Uint8ClampedArray(o.buf), w: o.w, h: o.h };
    } catch (e) { if (kind === 'codec') Pool.noCodec[mode] = true; r = null; }
  }
  if (!r) {
    const bytes = mk();
    if (kind === 'codec') { const L = {}; L[mode] = await getLib(mode); r = decodeCodec(L, mode, bytes, lm); }
    else if (kind === 'rle') r = rawToPixels(decodeRLE(bytes, lm), lm, true, 0);
    else r = rawToPixels(bytes, lm, kind !== 'rawBE', lm.planar);
  }
  if (r.kind === 'rgba') { const bmp = await createImageBitmap(new ImageData(r.rgba, r.w, r.h)); return { kind: 'bmp', bmp, w: r.w, h: r.h }; }
  return r;
}
