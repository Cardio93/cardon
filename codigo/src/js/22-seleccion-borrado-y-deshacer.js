/* ======================= Selección, borrado y deshacer ======================= */
state.undo = []; state.sel = null;
try { state.avg = localStorage.getItem('cardon.avg') === '1'; } catch (e) { state.avg = false; }
const UNDO_MAX = 60, AVG_MAX = 5;
let sidN = 0;
const newSid = () => 'm' + Date.now().toString(36) + (++sidN);
function boundKey(a) { return a && !a.free && a.k && a.t !== 'mline' && state.study && state.study.values && Object.prototype.hasOwnProperty.call(state.study.values, a.k) ? a.k : null; }
function annosWithKey(k) { const out = []; for (const c of state.clips) c.annos.forEach((a, idx) => { if (a.k === k) out.push({ clip: c, anno: a, idx }); }); return out; }
function pushUndo(u) { u.study = state.study; state.undo.push(u); if (state.undo.length > UNDO_MAX) state.undo.shift(); }
function undoReady() { while (state.undo.length && state.undo[state.undo.length - 1].study !== state.study) state.undo.pop(); return state.undo.length > 0; }
function snapVals(keys) { const o = {}; for (const k of new Set(keys)) { const v = state.study.values[k]; o[k] = v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } return o; }
function restoreVals(o) { let n = 0; for (const k in o || {}) { n++; if (o[k] === undefined) delete state.study.values[k]; else state.study.values[k] = o[k]; } return n > 0; }
/* Promedio de latidos: cada medida guarda sus muestras (s) y el valor es el promedio */
const meanOf = xs => xs.reduce((x, y) => x + y, 0) / xs.length;
function avgSamples(samples) {
  const vs = samples.map(x => x.v);
  if (vs.every(isNum)) return meanOf(vs);
  const last = vs[vs.length - 1] || {}, out = {};
  for (const key of Object.keys(last)) { const xs = vs.map(o => o && o[key]); out[key] = xs.every(isNum) ? meanOf(xs) : last[key]; }
  return out;
}
function samplesOf(k) { const v = state.study && state.study.values[k]; return v && Array.isArray(v.s) ? v.s : []; }
function dropSample(k, sid) {
  const v = state.study.values[k]; if (!v) return;
  if (sid && Array.isArray(v.s) && v.s.length > 1 && v.s.some(x => x.id === sid)) { v.s = v.s.filter(x => x.id !== sid); v.v = avgSamples(v.s); }
  else delete state.study.values[k];
}
function annoLines(a) {
  const p = a.pts || [];
  if (!p.length) return [];
  switch (a.t) {
    case 'sten': return [p.slice(0, 2), p.slice(2, 4)].filter(q => q.length);
    case 'qca': return p.length >= 6 ? [p.slice(0, p.length >> 1), p.slice(p.length >> 1)] : [p];
    case 'time': return p.length > 1 ? [[p[0], { x: p[1].x, y: p[0].y }]] : [p];
    case 'vel': case 'base': case 'dopcal': return p.map(q => [q]);
    case 'trace': case 'area': return [p.length > 2 ? [...p, p[0]] : p];
    case 'cac': return p.length === 2 ? [[p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y }, p[0]]] : [p];
    case 'roi': return p.length === 2 ? [roiPoly(p[0], p[1], (state.cur && state.cur.m.aspect) || 1)] : [p];
    case 'mask': return p.length === 2 ? [[p[0], { x: p[1].x, y: p[0].y }, p[1], { x: p[0].x, y: p[1].y }, p[0]]] : [p];
    default: return [p];
  }
}
function segDist(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)) : 0;
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
/* Medida bajo el puntero (línea, punto o etiqueta) */
function hitAnno(vp, cx, cy) {
  const c = vp && vp.clip; if (!c || !vp.tf || !c.annos.length) return null;
  const r = vp.el.getBoundingClientRect(), d = state.dpr, x = (cx - r.left) * d, y = (cy - r.top) * d;
  const boxes = vp.boxes || [];
  for (let i = boxes.length - 1; i >= 0; i--) { const b = boxes[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && c.annos.includes(b.a)) return b.a; }
  const G = { tf: vp.tf };
  let best = null, bd = 8 * d;
  for (const a of c.annos) {
    if (!(a.frame === vp.frame || a.all)) continue;
    for (const line of annoLines(a)) {
      const s = line.map(q => toScreen(G, q));
      let dd = s.length === 1 ? Math.hypot(s[0].x - x, s[0].y - y) : Infinity;
      for (let i = 1; i < s.length; i++) dd = Math.min(dd, segDist(x, y, s[i - 1], s[i]));
      if (dd <= bd) { bd = dd; best = a; }
    }
  }
  return best;
}
function selVisible() {
  const s = state.sel, vp = AV();
  return !!(s && vp && vp.clip === s.clip && s.clip.annos.includes(s.anno) && (s.anno.frame === vp.frame || s.anno.all));
}
function setSel(sel) { const prev = state.sel; state.sel = sel; if ((prev && prev.anno) !== (sel && sel.anno)) drawAll(); }
function refreshAfterValues() {
  scheduleSave();
  const kk = currentKind();
  if (kk === 'angio') renderAngioMed(); else if (kk === 'tc') renderCTMed(); else if (kk === 'rm') renderMRMed(); else renderMedValues();
  renderReport(); renderContext();
}
/* Borra trazos (y sus valores) y deja el paso en la pila de deshacer.
   items: [{ clip, anno, idx }]; whole: claves cuyo valor se borra completo (botón × del panel). */
/* ---- Anotaciones (flecha y texto): se guardan con el estudio, por serie y corte ---- */
const NOTEC = '#a6f28f'; let noteSeq = 0;
function clipUID(c) {
  if (!c || c.foreign || c.demo || c.mm || c.cpr) return null;
  if (c.mpr) { const b = clipUID(c.mpr.src); return b ? b + '@' + c.mpr.plane : null; }
  const m = c.items[0].m, base = m.seriesUID || m.sopUID;
  return base ? base + (c.slice ? '#' + c.slice : '') : null;
}
function addNote(c, t, pts, text, frame) {
  const anno = { k: 'nota' + (++noteSeq), t, pts, frame, all: !(c.stack || c.lazy), text, col: NOTEC, note: true };
  c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno }); drawClipViews(c); saveNotes();
  return anno;
}
function noteInput(vp, c, p, frame) {
  if (!vp || !vp.tf) return;
  setPlaying(false);
  const r = vp.el.getBoundingClientRect(), t = vp.tf, d = state.dpr;
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'note-in'; inp.maxLength = 90;
  inp.placeholder = 'Escribe y pulsa Enter'; inp.setAttribute('aria-label', 'Texto de la anotación');
  inp.style.left = `${Math.min(innerWidth - 250, r.left + (t.x + p.x * t.sc) / d)}px`; inp.style.top = `${r.top + (t.y + p.y * t.sc * t.asp) / d - 15}px`;
  document.body.append(inp); inp.focus();
  let done = false;
  const fin = ok => { if (done) return; done = true; const txt = inp.value.trim(); inp.remove(); if (ok && txt) { addNote(c, 'note', [p], txt, frame); setStatus('Texto agregado. Se guarda con el estudio y sale en las exportaciones.'); } vp.el.focus({ preventScroll: true }); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); fin(false); } });
  inp.addEventListener('blur', () => fin(true));
}
function saveNotes() {
  const st = state.study; if (!st) return;
  const A = Object.assign({}, st.annots || {}); let changed = false;
  for (const c of state.clips) {
    const u = clipUID(c); if (!u) continue;
    const L = c.annos.filter(a => a.note).map(a => ({ t: a.t, pts: a.pts.map(q => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 })), frame: a.frame, all: !!a.all, text: a.text || '' }));
    if (JSON.stringify(A[u] || []) !== JSON.stringify(L)) { changed = true; if (L.length) A[u] = L; else delete A[u]; }
  }
  if (changed) { st.annots = A; scheduleSave(); }
}
function restoreNotes(c) {
  const u = clipUID(c), L = u && state.study && state.study.annots ? state.study.annots[u] : null;
  c.annos = c.annos.filter(a => !a.note);
  if (L) for (const o of L) c.annos.push({ k: 'nota' + (++noteSeq), t: o.t, pts: o.pts.map(q => ({ x: q.x, y: q.y })), frame: o.frame, all: o.all, text: o.text, col: NOTEC, note: true });
}
function applyDel(items, msg, whole) {
  whole = whole || [];
  const ks = items.map(i => boundKey(i.anno));
  const keys = ks.filter(Boolean).concat(whole);
  if (!items.length && !keys.length) return;
  const vals = snapVals(keys);
  items.forEach((it, i) => { it.clip.annos = it.clip.annos.filter(a => a !== it.anno); if (ks[i] && !whole.includes(ks[i])) dropSample(ks[i], it.anno.sid); });
  for (const k of whole) delete state.study.values[k];
  pushUndo({ type: 'del', items, vals });
  if (state.sel && items.some(i => i.anno === state.sel.anno)) state.sel = null;
  if (keys.length) refreshAfterValues();
  if (items.some(i => i.anno.note)) saveNotes();
  drawAll();
  if (msg) setStatus(`${msg} Ctrl+Z para deshacer.`);
}
function delAnnos(clip, annos, msg) {
  if (!clip || clip.foreign || !annos.length) return;
  const items = annos.map(a => ({ clip, anno: a, idx: clip.annos.indexOf(a) }));
  applyDel(items, annos.length > 1 ? msg.replace('Medida borrada', `${annos.length} medidas borradas`) : msg);
}
function delKey(k, msg) { applyDel(annosWithKey(k), msg || 'Medida borrada.', [k]); }
function deleteSelected() {
  if (!selVisible()) { setSel(null); return false; }
  delAnnos(state.sel.clip, [state.sel.anno], 'Medida borrada.');
  return true;
}
function undo() {
  if (!undoReady()) { setStatus('No hay nada que deshacer.'); return; }
  const u = state.undo.pop();
  const reinsert = list => { for (const it of list.slice().sort((x, y) => (x.idx ?? 0) - (y.idx ?? 0))) if (it.anno && it.clip && !it.clip.annos.includes(it.anno)) it.clip.annos.splice(Math.min(it.idx ?? it.clip.annos.length, it.clip.annos.length), 0, it.anno); };
  if (u.type === 'batch') {
    for (const x of u.adds) x.clip.annos = x.clip.annos.filter(a => a !== x.anno);
    setStatus(`Se deshicieron ${u.adds.length} contornos.`);
  } else if (u.type === 'del') {
    reinsert(u.items);
    setStatus(u.items.length > 1 ? `Se recuperaron ${u.items.length} medidas.` : 'Medida recuperada.');
  } else {
    u.clip.annos = u.clip.annos.filter(a => a !== u.anno);
    reinsert(u.removed || []);
    if (state.sel && state.sel.anno === u.anno) state.sel = null;
    setStatus('Se deshizo la última medida.');
  }
  if (restoreVals(u.vals)) refreshAfterValues();
  saveNotes();
  drawAll();
}
