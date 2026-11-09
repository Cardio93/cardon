/* ======================= Caso docente anonimizado (.zip) =======================
   Exporta las imágenes DICOM del estudio sin datos del paciente (perfil básico de anonimización: se quitan
   nombres, documentos, instituciones, médicos, fechas opcionales, etiquetas privadas y secuencias no necesarias;
   los UID se reemplazan). Las zonas ocultas («Ocultar zona») se tapan también dentro del DICOM.
   Junto a las imágenes va cardon-caso.json con las medidas, anotaciones, curvas y, si se desea, la conclusión. */
const ANON_DROP = new Set(['x00080050', 'x00080080', 'x00080081', 'x00080090', 'x00080092', 'x00080094', 'x00081010', 'x00081040', 'x00081048', 'x00081050', 'x00081060', 'x00081070',
  'x00100030', 'x00100032', 'x00101000', 'x00101001', 'x00101005', 'x00101040', 'x00102154', 'x00101060', 'x00102160', 'x001021b0', 'x00104000', 'x00102180', 'x001021f0',
  'x00181000', 'x00181030', 'x00200010', 'x00321032', 'x00321060', 'x00380010', 'x00400244', 'x00400245', 'x00400253', 'x00400254', 'x00401001', 'x00400275', 'x0040a124', 'x00080082', 'x00321033', 'x00080096', 'x00080014', 'x00100021', 'x00102000', 'x00102110', 'x001021c0', 'x00380300', 'x00380400', 'x00380500', 'x00200200', 'x00081111', 'x00081120', 'x00081140', 'x00081155']);
const ANON_DATES = new Set(['x00080020', 'x00080021', 'x00080022', 'x00080023', 'x0008002a', 'x00080030', 'x00080031', 'x00080032', 'x00080033', 'x00080012', 'x00080013', 'x00181012', 'x00181014', 'x00400250', 'x00400251']);
const ANON_KEEP_SQ = new Set(['x00186011', 'x54000100', 'x52009229', 'x52009230', 'x00409096', 'x00283000', 'x00283010']);
const ANON_UIDS = ['x0020000d', 'x0020000e', 'x00080018', 'x00200052'];
const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN', 'SV', 'UV']);
function newUID() { const b = crypto.getRandomValues(new Uint8Array(16)); let x = 0n; for (const v of b) x = (x << 8n) | BigInt(v); return '2.25.' + x.toString(); }
const TEnc = new TextEncoder();
function padVal(bytes, vr) { if (bytes.length % 2 === 0) return bytes; const o = new Uint8Array(bytes.length + 1); o.set(bytes); o[bytes.length] = vr === 'UI' || vr === 'OB' ? 0 : 0x20; return o; }
class DcmWriter {
  constructor(explicit) { this.explicit = explicit; this.parts = []; this.n = 0; }
  raw(u8) { this.parts.push(u8); this.n += u8.length; }
  head(tag, vr, len) {
    const g = parseInt(tag.slice(1, 5), 16), e = parseInt(tag.slice(5, 9), 16);
    if (this.explicit && vr) {
      const long = LONG_VR.has(vr), b = new Uint8Array(long ? 12 : 8), dv = new DataView(b.buffer);
      dv.setUint16(0, g, true); dv.setUint16(2, e, true); b[4] = vr.charCodeAt(0); b[5] = vr.charCodeAt(1);
      if (long) dv.setUint32(8, len, true); else dv.setUint16(6, len, true);
      this.raw(b);
    } else { const b = new Uint8Array(8), dv = new DataView(b.buffer); dv.setUint16(0, g, true); dv.setUint16(2, e, true); dv.setUint32(4, len, true); this.raw(b); }
  }
  el(tag, vr, value) { const v = padVal(value, vr); this.head(tag, vr, v.length); this.raw(v); }
  str(tag, vr, s) { this.el(tag, vr, TEnc.encode(s)); }
  us(tag, v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.el(tag, 'US', b); }
  out() { const o = new Uint8Array(this.n); let p = 0; for (const x of this.parts) { o.set(x, p); p += x.length; } return o; }
}
function metaGroup(sopClass, sopInst, ts) {
  const w = new DcmWriter(true);
  w.el('x00020001', 'OB', new Uint8Array([0, 1])); w.str('x00020002', 'UI', sopClass); w.str('x00020003', 'UI', sopInst); w.str('x00020010', 'UI', ts);
  w.str('x00020012', 'UI', '2.25.302719866524110931011729446219021305581'); w.str('x00020013', 'SH', 'CARDON');
  const body = w.out(), h = new DcmWriter(true); h.el('x00020000', 'UL', (() => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, body.length, true); return b; })());
  const pre = new Uint8Array(132); pre.set([68, 73, 67, 77], 128);
  const hd = h.out(), o = new Uint8Array(132 + hd.length + body.length); o.set(pre); o.set(hd, 132); o.set(body, 132 + hd.length); return o;
}
/* Tapa las zonas ocultas en los cuadros: datos sin comprimir, JPEG (se vuelve a comprimir) u otros (se descomprimen) */
function maskNative(px, m, rects) {
  const bytes = m.bitsAllocated > 8 ? 2 : 1, spp = m.spp || 1, fsz = m.rows * m.cols * spp * bytes, nF = Math.max(1, Math.floor(px.length / fsz));
  const fill = m.photometric === 'MONOCHROME1' ? (bytes === 2 ? 0xffff : 0xff) : (bytes === 2 && m.pixelRep ? 0x8000 : 0);
  for (let f = 0; f < nF; f++) for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x0)), x1 = Math.min(m.cols - 1, Math.ceil(r.x1)), y0 = Math.max(0, Math.floor(r.y0)), y1 = Math.min(m.rows - 1, Math.ceil(r.y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let s = 0; s < spp; s++) {
      const idx = m.planar && spp > 1 ? f * fsz + (s * m.rows * m.cols + y * m.cols + x) * bytes : f * fsz + ((y * m.cols + x) * spp + s) * bytes;
      if (bytes === 2) { px[idx] = fill & 0xff; px[idx + 1] = fill >> 8; } else px[idx] = fill;
    }
  }
}
async function jpegMasked(ds, m, rects) {
  const frames = [];
  for (let i = 0; i < m.frames; i++) {
    const bmp = await createImageBitmap(new Blob([getEncapsulatedFrame(ds, i, m)], { type: 'image/jpeg' }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; const g = cv.getContext('2d');
    g.drawImage(bmp, 0, 0); g.fillStyle = '#000'; for (const r of rects) g.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.95)); frames.push(new Uint8Array(await blob.arrayBuffer()));
  }
  return frames;
}
async function decodedMasked(ds, m, rects) {
  const out = [];
  let gray = null;
  for (let i = 0; i < m.frames; i++) {
    const f = await decodeFrameAsync(ds, m, i);
    if (f.kind === 'gray') {
      gray = f; const d = f.data, fill = f.mono1 ? (d instanceof Uint8Array ? 255 : 65535) : (d instanceof Int16Array ? -32768 : 0);
      for (const r of rects) for (let y = Math.max(0, r.y0 | 0); y <= Math.min(f.h - 1, Math.ceil(r.y1)); y++) for (let x = Math.max(0, r.x0 | 0); x <= Math.min(f.w - 1, Math.ceil(r.x1)); x++) d[y * f.w + x] = fill;
      out.push(new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice());
    } else {
      const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h; const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(f.bmp, 0, 0); g.fillStyle = '#000'; for (const r of rects) g.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
      const rgba = g.getImageData(0, 0, f.w, f.h).data, rgb = new Uint8Array(f.w * f.h * 3);
      for (let p = 0, q = 0; p < rgba.length; p += 4) { rgb[q++] = rgba[p]; rgb[q++] = rgba[p + 1]; rgb[q++] = rgba[p + 2]; }
      out.push(rgb);
    }
  }
  return { frames: out, gray };
}
/* Escribe un DICOM anonimizado a partir del archivo original */
async function anonymizeDicom(ds, m, opt) {
  const ts = m.ts, explicit = ts !== '1.2.840.10008.1.2';
  if (ts === '1.2.840.10008.1.2.2' || ts === '1.2.840.10008.1.2.1.99') throw new Error('formato no compatible para anonimizar');
  const rects = opt.masks || [], b = ds.byteArray, w = new DcmWriter(explicit);
  const mode = TS_MODE[ts], isJpeg = mode === 'jpeg', native = mode === 'raw';
  let newTS = ts, px = null, pxFrames = null, pxGray = null;
  if (rects.length) {
    if (native) { const e = ds.elements.x7fe00010; px = b.slice(e.dataOffset, e.dataOffset + e.length); maskNative(px, m, rects); }
    else if (isJpeg) pxFrames = await jpegMasked(ds, m, rects);
    else { const r = await decodedMasked(ds, m, rects); pxFrames = r.frames; pxGray = r.gray; newTS = '1.2.840.10008.1.2.1'; }
  }
  const sopClass = ds.string('x00080016') || m.sopClass || '1.2.840.10008.5.1.4.1.1.7';
  const uid = t => { const o = ds.string(t); if (!o) return null; if (!opt.uids.has(o)) opt.uids.set(o, newUID()); return opt.uids.get(o); };
  const sopNew = uid('x00080018') || newUID();
  const over = {};
  if (opt.age && !ds.elements.x00101010) over.x00101010 = opt.age;
  if (pxFrames && isJpeg) { over.x00280002 = 3; over.x00280004 = 'YBR_FULL_422'; over.x00280006 = 0; }
  if (pxFrames && !isJpeg) {
    if (pxGray) { const by = pxGray.data.BYTES_PER_ELEMENT; over.x00280100 = by * 8; over.x00280101 = by * 8; over.x00280102 = by * 8 - 1; over.x00280103 = /^Int/.test(pxGray.data.constructor.name) ? 1 : 0; over.x00280002 = 1; over.x00280004 = pxGray.mono1 ? 'MONOCHROME1' : 'MONOCHROME2'; }
    else { over.x00280100 = 8; over.x00280101 = 8; over.x00280102 = 7; over.x00280103 = 0; over.x00280002 = 3; over.x00280004 = 'RGB'; over.x00280006 = 0; }
  }
  const usTags = new Set(['x00280002', 'x00280006', 'x00280100', 'x00280101', 'x00280102', 'x00280103']);
  const done = new Set();
  const writeOver = t => { const v = over[t]; done.add(t); if (usTags.has(t)) w.us(t, v); else w.str(t, t === 'x00101010' ? 'AS' : 'CS', v); };
  for (const [tag, e] of Object.entries(ds.elements)) {
    const g = parseInt(tag.slice(1, 5), 16);
    if (g === 0x0002 || g === 0xfffe) continue;
    for (const t of Object.keys(over)) if (!done.has(t) && t < tag) writeOver(t);
    if (g % 2 === 1) continue;
    if (ANON_DROP.has(tag)) continue;
    if (!opt.keepDates && ANON_DATES.has(tag)) continue;
    if (tag in over) { writeOver(tag); continue; }
    const vr = explicit ? e.vr : null;
    if (e.items && !ANON_KEEP_SQ.has(tag)) continue;
    if (tag === 'x00100010') { w.str(tag, 'PN', opt.name); continue; }
    if (tag === 'x00100020') { w.str(tag, 'LO', opt.id); continue; }
    if (tag === 'x00101010') { if (opt.age) w.str(tag, 'AS', opt.age); continue; }
    if (tag === 'x00100040') { if (opt.keepSex) w.str(tag, 'CS', ds.string(tag) || ''); continue; }
    if (tag === 'x00081030' && opt.title) { w.str(tag, 'LO', opt.title.slice(0, 64)); continue; }
    if (ANON_UIDS.includes(tag)) { w.str(tag, 'UI', uid(tag)); continue; }
    if (tag === 'x00020010') continue;
    if (tag === 'x7fe00010') {
      if (px) { w.head(tag, explicit ? (m.bitsAllocated > 8 ? 'OW' : 'OB') : null, px.length + (px.length % 2)); w.raw(padVal(px, 'OB')); continue; }
      if (pxFrames && !isJpeg) { const tot = pxFrames.reduce((a, f) => a + f.length, 0), all = new Uint8Array(tot + (tot % 2)); let p = 0; for (const f of pxFrames) { all.set(f, p); p += f.length; } w.head(tag, pxGray && pxGray.data.BYTES_PER_ELEMENT === 2 ? 'OW' : 'OB', all.length); w.raw(all); continue; }
      if (pxFrames && isJpeg) { encapsulate(w, tag, pxFrames); continue; }
      if (e.encapsulatedPixelData) { const fr = []; for (let i = 0; i < m.frames; i++) fr.push(getEncapsulatedFrame(ds, i, m)); encapsulate(w, tag, fr); continue; }
    }
    const val = b.subarray(e.dataOffset, e.dataOffset + e.length);
    if (e.hadUndefinedLength) { w.head(tag, vr, 0xffffffff); w.raw(val); if (e.items) w.raw(new Uint8Array([0xfe, 0xff, 0xdd, 0xe0, 0, 0, 0, 0])); }
    else { w.head(tag, vr, val.length); w.raw(val); }
  }
  for (const t of Object.keys(over)) if (!done.has(t)) writeOver(t);
  const body = w.out(), meta = metaGroup(sopClass, sopNew, newTS), out = new Uint8Array(meta.length + body.length);
  out.set(meta); out.set(body, meta.length); return out;
}
function encapsulate(w, tag, frames) {
  const bot = new Uint8Array(frames.length * 4), dv = new DataView(bot.buffer); let off = 0;
  const items = frames.map((f, i) => { dv.setUint32(i * 4, off, true); const v = padVal(f, 'OB'); off += 8 + v.length; return v; });
  w.head(tag, 'OB', 0xffffffff);
  const item = (u8) => { const h = new Uint8Array(8), d = new DataView(h.buffer); d.setUint16(0, 0xfffe, true); d.setUint16(2, 0xe000, true); d.setUint32(4, u8.length, true); w.raw(h); w.raw(u8); };
  item(bot); for (const v of items) item(v);
  w.raw(new Uint8Array([0xfe, 0xff, 0xdd, 0xe0, 0, 0, 0, 0]));
}
/* ---- Diálogo de exportación ---- */
function caseSources() {
  const own = state.clips.filter(c => !c.foreign && !c.demo && !c.mpr && !c.cpr && !c.mm), out = [];
  for (const c of own) {
    const seen = new Set(); const dss = []; for (const it of c.items) if (it.ds && !seen.has(it.ds)) { seen.add(it.ds); dss.push({ ds: it.ds, m: it.m }); }
    out.push({ c, dss, kind: clipKind(c), masks: c.masks || [] });
  }
  return out;
}
function openCaseDlg() {
  const S = caseSources();
  if (!S.length) { setStatus('Abre un estudio con imágenes para exportarlo como caso.'); return; }
  const st = state.study, pt = patientOf(st), age = pt ? ageAt(pt.birth, st.date) : null;
  const risky = S.filter(x => (x.kind === 'eco' || x.kind === 'angio') && !x.masks.length);
  $('caseBody').innerHTML = `
    <label class="fld">Título del caso<input type="text" id="caseTitle" maxlength="60" value="${esc(st.caseTitle || 'Caso docente')}"></label>
    <div class="grid2">
      <label class="check small"><input type="checkbox" id="caseAge" checked> Conservar la edad${age !== null ? ` (${age} años)` : ''} y el sexo</label>
      <label class="check small"><input type="checkbox" id="caseDates"> Conservar las fechas</label>
      <label class="check small"><input type="checkbox" id="caseMeas" checked> Incluir medidas, anotaciones y curvas</label>
      <label class="check small"><input type="checkbox" id="caseConcl"${st.conclusion ? '' : ' disabled'}> Incluir la conclusión (revisa que no tenga nombres)</label>
    </div>
    <h4>Secuencias</h4>
    <div class="caselist">${S.map((x, i) => `<label class="check small"><input type="checkbox" data-casesel="${i}" checked> ${esc(x.c.label)} <span class="note">${esc(x.c.sub)}${x.masks.length ? ' · zona oculta' : ''}</span></label>`).join('')}</div>
    ${risky.length ? `<p class="note warnc">${risky.length === 1 ? 'Una secuencia de eco o angiografía no tiene' : `${risky.length} secuencias de eco o angiografía no tienen`} zonas ocultas. Estos equipos suelen escribir el nombre del paciente sobre la imagen: revísalas y usa Exportar → «Ocultar zona» sobre ese texto, o desmárcalas.</p>` : ''}
    <p class="note">Se quitan nombres, documentos, instituciones, médicos y etiquetas privadas, y se cambian los identificadores. Revisa siempre el resultado antes de compartirlo.</p>
    <p class="note" id="caseMsg"></p>`;
  openDlg('caseDlg');
}
async function exportCase() {
  const S = caseSources(), st = state.study, pt = patientOf(st), msg = $('caseMsg');
  const sel = S.filter((_, i) => { const b = document.querySelector(`[data-casesel="${i}"]`); return b && b.checked; });
  if (!sel.length) { msg.textContent = 'Elige al menos una secuencia.'; return; }
  let Z; try { Z = await loadZip(); } catch (e) { msg.textContent = 'No se pudo cargar el compresor .zip.'; return; }
  const title = ($('caseTitle').value || 'Caso docente').trim(), keepAge = $('caseAge').checked, age = pt && keepAge ? ageAt(pt.birth, st.date) : null;
  st.caseTitle = title; scheduleSave();
  const id = 'CARDON-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const opt = { name: title.replace(/\s+/g, ' '), id, title, age: age !== null ? String(age).padStart(3, '0') + 'Y' : '', keepSex: keepAge, keepDates: $('caseDates').checked, uids: new Map() };
  const zip = new Z(); let n = 0, fail = 0, tot = sel.reduce((a, x) => a + x.dss.length, 0);
  const btn = $('caseGo'); btn.disabled = true;
  try {
    for (const x of sel) for (const d of x.dss) {
      if (n % 5 === 0) { msg.textContent = `Anonimizando ${n + 1} de ${tot}…`; await tick(); }
      try { const bytes = await anonymizeDicom(d.ds, d.m, Object.assign({}, opt, { masks: x.masks })); zip.file(`DICOM/IM${String(++n).padStart(5, '0')}.dcm`, bytes); }
      catch (e) { fail++; }
    }
    /* datos del estudio: medidas, anotaciones y curvas, con los UID nuevos */
    const mapKey = k => { const [base, rest] = [k.split(/[#@]/)[0], k.slice(k.split(/[#@]/)[0].length)]; return opt.uids.has(base) ? opt.uids.get(base) + rest : null; };
    const remap = obj => { const o = {}; for (const [k, v] of Object.entries(obj || {})) { const nk = mapKey(k); if (nk) o[nk] = v; } return o; };
    const firstNew = sel[0].dss[0] && opt.uids.get(sel[0].dss[0].ds.string('x0020000d'));
    const study = {};
    if ($('caseMeas').checked) for (const k of ['values', 'wm', 'angio', 'mr', 'cta', 'cacDone', 'kind', 'weight', 'height', 'hr', 'sbp', 'dbp', 'rap']) if (st[k] !== undefined && st[k] !== null) study[k] = JSON.parse(JSON.stringify(st[k]));
    if ($('caseMeas').checked) { study.annots = remap(st.annots); study.mprs = remap(st.mprs); }
    if ($('caseConcl').checked && st.conclusion) study.conclusion = st.conclusion;
    const patient = keepAge && pt ? { age, sex: pt.sex || '' } : null;
    zip.file('cardon-caso.json', JSON.stringify({ format: 'cardon-caso', version: 1, app: APP_VERSION, title, studyUID: firstNew || '', exported: new Date().toISOString().slice(0, 10), patient, study }, null, 1));
    zip.file('LEEME.txt', `${title}\n\nCaso docente exportado con Cardón (uso educativo). Las imágenes no tienen datos del paciente.\nPara verlo con sus medidas y anotaciones, arrastra este archivo .zip a Cardón o usa «Archivo .zip» en Inicio.\nTambién puede abrirse con cualquier visor DICOM (carpeta DICOM).\n`);
    msg.textContent = 'Comprimiendo…'; await tick();
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
    await saveFile(`${fileSafe(title) || 'caso'}.zip`, blob, msg);
    msg.textContent = (n === 1 ? 'Caso exportado: 1 archivo anonimizado.' : `Caso exportado: ${n} archivos anonimizados.`) + (fail ? ` ${fail} no se pudieron procesar y se omitieron.` : '');
  } finally { btn.disabled = false; }
}
/* ---- Importar un caso: al abrir el .zip se aplican sus medidas y anotaciones ---- */
let pendingCase = null;
function applyCase(st, pt) {
  const C = pendingCase; if (!C || !C.study || (C.studyUID && st.studyUID !== C.studyUID)) return false;
  const S = C.study;
  for (const k of Object.keys(S)) if (k !== 'values' && k !== 'annots' && k !== 'mprs') st[k] = S[k];
  st.values = Object.assign({}, S.values || {}, st.values || {});
  if (S.annots) st.annots = Object.assign({}, S.annots, st.annots || {});
  if (S.mprs) st.mprs = Object.assign({}, S.mprs, st.mprs || {});
  st.desc = C.title || st.desc; st.caseTitle = C.title; st.teaching = true;
  /* edad aproximada: se fija una fecha de nacimiento que da la edad del caso en la fecha del estudio */
  if (pt && C.patient) {
    if (!pt.birth && Number.isFinite(C.patient.age) && st.date) { const [y, mo, d] = st.date.split('-'); pt.birth = `${String(+y - C.patient.age).padStart(4, '0')}-${mo}-${d}`; pt.birthApprox = true; }
    if (!pt.sex && C.patient.sex) pt.sex = C.patient.sex;
  }
  pendingCase = null; return true;
}
$('caseGo').addEventListener('click', exportCase);
$('expCase').addEventListener('click', openCaseDlg);
$('caseDlg').addEventListener('click', e => { if (e.target === $('caseDlg')) closeDlg('caseDlg'); });
