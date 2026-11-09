/* ======================= Secuencias ======================= */
function addClip(c, before) {
  c.id = ++uid;
  c.ready = new Array(c.items.length); c.pending = new Array(c.items.length);
  c.loaded = 0; c.err = null; c.lastShown = null; c.annos = []; c.masks = []; c.cal = null; c.dop = null; c.baseOverride = {};
  c.view = { zoom: 1, panX: 0, panY: 0, invert: false, wl: null, bc: { b: 1, c: 1 } };
  c.times = c.items.length > 1 ? frameTimes(c.items[0].m, c.items.length) : null;
  try { c.auto = c.items.length > 1 ? cycleMarks(c.items[0].m, c.items.length) : null; } catch (e) { c.auto = null; }
  c.manual = { ed: [], es: [] };
  rebuildCyc(c);
  if (c.mpr) try { restoreNotes(c); } catch (e) {}
  const b = document.createElement('button');
  b.className = 'item' + (c.mpr || c.mm || c.cpr ? ' child' : ''); b.type = 'button';
  b.innerHTML = '<canvas class="thumb" width="128" height="96"></canvas><span class="meta"><span class="name"></span><span class="sub"></span><span class="st"></span></span>';
  b.querySelector('.name').textContent = c.label; b.querySelector('.name').title = c.label;
  b.querySelector('.sub').textContent = c.sub + (c.cyc && c.cyc.ecg ? ' · ECG' : '');
  b.addEventListener('click', () => select(c));
  b.draggable = true;
  b.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-cardon-clip', String(c.id)); e.dataTransfer.effectAllowed = 'copy'; });
  c.el = b; c.thumb = b.querySelector('canvas'); c.stEl = b.querySelector('.st');
  const tc = c.thumb.getContext('2d'); tc.fillStyle = '#000'; tc.fillRect(0, 0, 128, 96);
  els.list.append(b);
  state.clips.push(c);
  updateCount();
}
function clipKind(c) {
  if (!c) return 'eco';
  const mod = c.items[0].m.modality;
  if (mod === 'XA' || mod === 'RF') return 'angio';
  if (mod === 'CT') return 'tc';
  if (mod === 'US' || (c.items[0].m.regions || []).length) return 'eco';
  if (mod === 'MR') return 'rm';
  return 'otro';
}
const KIND_TOOLS = { eco: ['dist', 'area', 'time', 'vel', 'vti', 'slope'], angio: ['dist', 'qca', 'sten', 'area'], tc: ['dist', 'area', 'roi', 'sten'], rm: ['dist', 'area', 'roi'], otro: ['dist', 'area', 'sten', 'roi'] };
const KIND_NAME = { eco: 'Eco', angio: 'Angiografía', tc: 'TC', rm: 'Resonancia', otro: 'Imagen' };
function rebuildCyc(c) {
  const a = c.auto, mn = c.manual || { ed: [], es: [] };
  if (!a && !mn.ed.length && !mn.es.length) { c.cyc = null; return; }
  const uniq = x => [...new Set(x)].sort((p, q) => p - q);
  const ed = uniq([...(a ? a.ed : []), ...mn.ed]), es = uniq([...(a ? a.es : []), ...mn.es]);
  let rr = a && a.rr;
  if (!rr && ed.length >= 2 && c.times) { const d = []; for (let i = 1; i < ed.length; i++) d.push(c.times[ed[i]] - c.times[ed[i - 1]]); rr = d.sort((p, q) => p - q)[d.length >> 1]; }
  if (!rr) { const hr = c.items[0].m.hr; if (hr > 0) rr = 60000 / hr; }
  c.cyc = { ed, es, rr: rr || null, times: c.times || (a && a.times), ecg: a ? a.ecg : null, manual: !!(mn.ed.length || mn.es.length) };
}
const pixCv = document.createElement('canvas');
function framePixels(f, sx, sy, sw, sh) {
  pixCv.width = sw; pixCv.height = sh;
  const g = pixCv.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, sw, sh);
  g.drawImage(f.bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  return g.getImageData(0, 0, sw, sh).data;
}
async function detectBurnedECG(c) {
  if (!c || c.burnTried || c.demo || c.err || c.items.length < 3) return;
  if (c.auto && c.auto.ed && c.auto.ed.length) return;
  const m = c.items[0].m;
  if (clipKind(c) !== 'eco' || !(m.spp === 3 || m.photometric === 'PALETTE COLOR')) return;
  c.burnTried = true;
  try {
    const n = c.items.length;
    for (let i = 0; i < n; i++) if (!c.ready[i]) await requestFrame(c, i);
    const last = c.ready[n - 1];
    if (!last || last.kind !== 'bmp') return;
    const band = findECGBand(framePixels(last, 0, 0, last.w, last.h), last.w, last.h);
    if (!band) return;
    const W = band.x1 - band.x0 + 1, H = band.y1 - band.y0, frames = [];
    for (let i = 0; i < n; i++) { frames.push({ px: framePixels(c.ready[i], band.x0, band.y0, W, H), w: W, h: H }); if (i % 16 === 15) await tick(); }
    const times = c.times || frameTimes(m, n);
    const r = ecgFromSweep(frames, Array.from(times));
    if (!r) return;
    c.auto = Object.assign(marksFromR(r.rTimes, times, n, m.hr), { ecg: null, burned: true, band });
    rebuildCyc(c);
    c.el.querySelector('.sub').textContent = c.sub + ' · ECG en imagen';
    els.ticks.dataset.key = '';
    updateTransport(); drawClipViews(c);
    if (c === state.cur) setStatus(`ECG leído de la imagen: ${c.cyc.ed.length} ${c.cyc.ed.length === 1 ? 'telediástole' : 'telediástoles'}${c.cyc.rr ? `, ${Math.round(60000 / c.cyc.rr)} lpm` : ''}. Usa TD y TS para saltar a ellas.`);
  } catch (e) {}
}
function ecgSource(c) {
  if (!c) return 'none';
  const m = c.items[0].m;
  if (c.cyc && c.cyc.ecg) return 'signal';
  if (m.rwave && m.rwave.length) return 'rwave';
  if (c.auto && c.auto.burned) return 'image';
  if ((m.regions || []).some(r => r.type === 10)) return 'burned';
  return 'none';
}
function markFrame(kind) {
  const c = state.cur; if (!c || c.items.length < 2) { setStatus('Las marcas de ciclo se usan en secuencias con varios cuadros.'); return; }
  const f = state.frame, other = kind === 'ed' ? 'es' : 'ed';
  c.manual[other] = c.manual[other].filter(i => i !== f);
  if (!c.manual[kind].includes(f)) c.manual[kind].push(f);
  rebuildCyc(c); els.ticks.dataset.key = ''; drawClipViews(c);
  setStatus(`Cuadro ${f + 1} marcado como ${kind === 'ed' ? 'telediástole' : 'telesístole'}. Usa TD y TS para saltar entre las marcas.`);
}
function unmarkFrame() {
  const c = state.cur; if (!c) return;
  const f = state.frame;
  c.manual.ed = c.manual.ed.filter(i => i !== f); c.manual.es = c.manual.es.filter(i => i !== f);
  rebuildCyc(c); els.ticks.dataset.key = ''; drawClipViews(c);
}
function removeClip(c) {
  if (!c.mpr && !c.cpr) for (const d of state.clips.filter(x => (x.mpr && x.mpr.src === c) || (x.cpr && x.cpr.src === c))) removeClip(d);
  c.vol = null;
  c.el.remove();
  state.clips = state.clips.filter(x => x !== c);
  for (const f of c.ready) if (f && f.bmp && f.bmp.close) f.bmp.close();
  for (const vp of state.vps) if (vp.clip === c) { vp.clip = null; vp.frame = 0; }
  updateCount();
}
function updateCount() { const n = state.clips.filter(c => !c.foreign).length; els.count.textContent = `${n} ${n === 1 ? 'secuencia' : 'secuencias'}`; }
function markList() {
  const shown = new Set(state.vps.map(v => v.clip));
  for (const x of state.clips) { x.el.setAttribute('aria-current', x === state.cur ? 'true' : 'false'); x.el.classList.toggle('shown', shown.has(x) && x !== state.cur); }
  groupList(shown);
}
/* Cortes de una misma serie (p. ej. cine en eje corto) se agrupan en un encabezado que se despliega */
const grpKey = c => (c.foreign ? c.foreign.id : '') + '|' + (c.items[0].m.seriesUID || c.label);
function groupList(shown) {
  shown = shown || new Set(state.vps.map(v => v.clip));
  if (!state.grpEls) { state.grpEls = new Map(); state.grpOpen = new Set(); }
  const groups = new Map();
  for (const c of state.clips) if (c.slices > 1) { const k = grpKey(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  for (const [k, h] of state.grpEls) if (!groups.has(k) || groups.get(k).length < 2) { h.remove(); state.grpEls.delete(k); }
  for (const [k, list] of groups) {
    if (list.length < 2) { list[0].el.classList.remove('child'); list[0].el.hidden = false; continue; }
    let h = state.grpEls.get(k);
    if (!h) {
      h = document.createElement('button'); h.type = 'button'; h.className = 'grp';
      h.innerHTML = '<span class="gthumb"><canvas width="128" height="96"></canvas></span><span class="meta"><span class="name"></span><span class="sub"></span></span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
      h.addEventListener('click', () => { if (state.grpOpen.has(k)) state.grpOpen.delete(k); else state.grpOpen.add(k); groupList(); });
      h.draggable = true;
      h.addEventListener('dragstart', e => { const L = state.clips.filter(x => x.slices > 1 && grpKey(x) === k).sort((a, b) => a.slice - b.slice); const m = L[Math.floor((L.length - 1) / 2)]; if (!m) return; e.dataTransfer.setData('application/x-cardon-clip', String(m.id)); e.dataTransfer.effectAllowed = 'copy'; });
      state.grpEls.set(k, h);
    }
    const firstEl = list.map(c => c.el).find(e => e.parentNode) ; if (!h.parentNode || list.every(c => c.el !== h.nextSibling)) firstEl.before(h);
    list.sort((a, b) => a.slice - b.slice); let prevEl = h; for (const c of list) { if (prevEl.nextSibling !== c.el) prevEl.after(c.el); prevEl = c.el; }
    const open = state.grpOpen.has(k), mid = list[Math.floor((list.length - 1) / 2)];
    h.querySelector('.name').textContent = h.querySelector('.name').title = list[0].label;
    h.querySelector('.sub').textContent = `${list.length} cortes` + (list[0].items.length > 1 ? ` · ${list[0].items.length} fases` : '');
    h.setAttribute('aria-expanded', open ? 'true' : 'false');
    h.title = open ? 'Ocultar los cortes' : 'Mostrar los cortes';
    h.classList.toggle('cur', !open && list.includes(state.cur));
    h.classList.toggle('shown', !open && list.some(x => shown.has(x)));
    if (mid.thumbDone) { const g = h.querySelector('canvas').getContext('2d'); g.drawImage(mid.thumb, 0, 0); }
    for (const c of list) { c.el.classList.add('child'); c.el.hidden = !open; }
  }
}
function updateItemStatus(c) {
  if (c.err) { c.stEl.textContent = 'No se pudo abrir'; c.stEl.classList.add('err'); return; }
  c.stEl.classList.remove('err');
  const visible = state.vps.some(v => v.clip === c);
  c.stEl.textContent = visible && !c.lazy && c.loaded < c.items.length ? `Preparando ${c.loaded}/${c.items.length}` : '';
}
function requestFrame(c, i) {
  if (c.ready[i]) return Promise.resolve(c.ready[i]);
  if (c.pending[i]) return c.pending[i];
  const it = c.items[i], ep = c.epoch || 0;
  const p = (it.pre ? Promise.resolve(it.pre) : it.gen ? Promise.resolve().then(it.gen) : decodeFrameAsync(it.ds, it.m, it.index)).then(f => {
    if ((c.epoch || 0) !== ep) { if (!it.pre && f && f.bmp && f.bmp.close) f.bmp.close(); return f; }
    c.ready[i] = f; c.pending[i] = null; c.loaded++; onFrameReady(c, i, f); return f;
  }, e => {
    c.pending[i] = null;
    if (!c.err) {
      c.err = (e && e.name === 'EncodingError') ? 'El navegador no pudo descomprimir este JPEG (posiblemente de 12 bit). Expórtalo sin compresión.' : (e && e.message) || String(e);
      updateItemStatus(c);
      drawClipViews(c);
    }
    throw e;
  });
  c.pending[i] = p;
  return p;
}
function initWL(c, f) {
  if (c.view.wl || f.kind !== 'gray') return;
  const m = c.items[0].m;
  let wl;
  if (Number.isFinite(m.wc) && Number.isFinite(m.ww) && m.ww > 1) wl = { c: m.wc, w: m.ww };
  else {
    let lo = Infinity, hi = -Infinity; const d = f.data;
    for (let k = 0; k < d.length; k++) { const v = d[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
    lo = lo * f.slope + f.intercept; hi = hi * f.slope + f.intercept;
    wl = { c: (lo + hi) / 2, w: Math.max(2, hi - lo) };
  }
  c.wlDefault = { ...wl }; c.view.wl = { ...wl };
}
function onFrameReady(c, i, f) {
  initWL(c, f);
  if (i === 0 || !c.thumbDone) drawThumb(c, f, i);
  if (c.loaded % 4 === 0 || c.loaded === c.items.length) updateItemStatus(c);
  for (const vp of state.vps) if (vp.clip === c && vp.frame === i) drawVP(vp);
}
async function preload(c) {
  if (c.preloading || c.lazy) return;
  c.preloading = true;
  try {
    await decodeMany(c, c.items.length, () => !c.err && state.vps.some(v => v.clip === c), async i => { if (i % 6 === 5) await tick(); }).catch(() => {});
  } finally { c.preloading = false; updateItemStatus(c); if (c.loaded === c.items.length) detectBurnedECG(c); }
}
function select(c, frame) {
  if (!c) return;
  const vp = AV(), prev = vp.clip;
  vp.clip = c; vp.frame = frame || 0; vp.dir = 1; vp.acc = 0;
  if (c.stack && state.playing) setPlaying(false);
  if (prev && prev !== c) updateItemStatus(prev);
  if (c.slices > 1 && state.grpOpen) state.grpOpen.add(grpKey(c));
  markList();
  if (!c.el.hidden) c.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  els.invert.setAttribute('aria-pressed', c.view.invert);
  refreshEnh();
  updateItemStatus(c);
  if (state.arm) { state.arm.pts = []; updateHint(); }
  drawVP(vp); updateTransport();
  preload(c);
  manageMemory();
  const k = currentKind();
  if (els.med.dataset.kind !== k) { els.med.dataset.kind = k; renderMed(); renderReport(); }
  renderCal(); refreshMaskBtn();
}
function stepSeq(d) {
  const own = state.clips;
  const idx = own.indexOf(state.cur), k = idx + d;
  if (k < 0 || k >= own.length) return;
  const keepArm = state.arm;
  select(own[k]);
  if (keepArm) { state.arm = keepArm; state.arm.pts = []; updateHint(); }
}
