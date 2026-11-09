/* ======================= Eventos ======================= */
document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => $(b.dataset.pick).click()));
for (const id of ['inFiles', 'inDir', 'inCD', 'inZip']) $(id).addEventListener('change', e => { const f = [...e.target.files].map(asItem); e.target.value = ''; importItems(f); });
$('addImgs').addEventListener('click', () => $('inFiles').click());
$('goHome').addEventListener('click', () => showView('home'));
$('brandHome').addEventListener('click', () => showView('home'));
$('openDemo').addEventListener('click', openDemo);
els.homeSearch.addEventListener('input', e => { state.search = e.target.value; renderHome(); });
$('bXlsx').addEventListener('click', exportDatabaseXlsx);
$('bExport').addEventListener('click', () => { if (locked()) { $('bStatus').textContent = 'Desbloquea Cardón primero.'; return; } exportBackup(); });
$('bExportZip').addEventListener('click', exportBackupZip);
$('bImportBtn').addEventListener('click', () => $('bImport').click());
$('bImport').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackupFile(f); });

let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; els.drop.hidden = false; els.dropzone.classList.add('over'); });
window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { els.drop.hidden = true; els.dropzone.classList.remove('over'); } });
window.addEventListener('drop', async e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; els.drop.hidden = true; els.dropzone.classList.remove('over');
  setHomeStatus('Reuniendo archivos…');
  const files = await filesFromDrop(e.dataTransfer);
  const json = files.filter(f => /\.json$/i.test(f.name));
  if (json.length && json.length === files.length) { importBackupFile(json[0]); return; }
  importItems(files.map(asItem));
});

els.play.addEventListener('click', () => { if (state.arm) disarm(); setPlaying(!state.playing); });
els.prev.addEventListener('click', () => step(-1));
els.next.addEventListener('click', () => step(1));
els.prevSeq.addEventListener('click', () => stepSeq(-1));
els.nextSeq.addEventListener('click', () => stepSeq(1));
els.goED.addEventListener('click', () => goMark('ed'));
els.goES.addEventListener('click', () => goMark('es'));
els.scrub.addEventListener('input', () => { if (!state.cur) return; setPlaying(false); state.frame = +els.scrub.value; draw(); syncOthers(); });
els.speed.addEventListener('change', () => { state.speed = +els.speed.value; state.vps.forEach(v => { v.acc = 0; }); drawAll(); });
els.bounce.addEventListener('click', () => { state.bounce = !state.bounce; state.vps.forEach(v => { v.dir = 1; }); els.bounce.setAttribute('aria-pressed', state.bounce); });
els.sync.addEventListener('click', () => { state.sync = !state.sync; els.sync.setAttribute('aria-pressed', state.sync); syncOthers(); });
document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => setLayout(+b.dataset.layout)));
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
function setTool(t) {
  state.tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  state.vps.forEach(v => { v.el.classList.toggle('pan', t === 'pan'); v.el.classList.toggle('zoomtool', t === 'zoom'); });
}
function closeDD() {
  document.querySelectorAll('.ddp').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.ddb').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
document.querySelectorAll('.ddb').forEach(b => b.addEventListener('click', () => {
  const pnl = b.nextElementSibling, open = pnl.hidden;
  closeDD();
  if (open) { pnl.hidden = false; b.setAttribute('aria-expanded', 'true'); const r = pnl.getBoundingClientRect(); if (r.left < 8) { pnl.style.right = 'auto'; pnl.style.left = '0'; } }
}));
document.querySelectorAll('.ddp [data-ddclose]').forEach(b => b.addEventListener('click', () => closeDD()));
document.addEventListener('pointerdown', e => { if (!e.target.closest('.dd')) closeDD(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.ddp:not([hidden])')) { e.stopPropagation(); closeDD(); } }, true);
function setFit(f) {
  state.fit = f;
  document.querySelectorAll('[data-fit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.fit === f ? 'true' : 'false'));
  try { localStorage.setItem('cardon.fit', f); } catch (e) {}
  state.vps.forEach(v => { if (v.clip) { v.clip.view.panX = 0; v.clip.view.panY = 0; } });
  drawAll();
}
document.querySelectorAll('[data-fit]').forEach(b => b.addEventListener('click', () => setFit(b.dataset.fit)));
document.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', () => {
  const vp = AV(), c = vp && vp.clip; if (!c || !c.view.wl) return;
  const [w, l] = b.dataset.wl.split(',').map(Number); c.view.wl = { w, c: l }; drawClipViews(c);
  setStatus(`Ventana ${b.textContent}: ancho ${w}, nivel ${l} UH.`);
}));
setFit(state.fit);
$('hdrBtn').setAttribute('aria-pressed', state.hdr ? 'true' : 'false');
$('hdrBtn').addEventListener('click', () => { state.hdr = !state.hdr; $('hdrBtn').setAttribute('aria-pressed', state.hdr ? 'true' : 'false'); try { localStorage.setItem('cardon.hdr', state.hdr ? '1' : '0'); } catch (e) {} drawAll(); });

const UI = { panel: true, tools: true };
try { Object.assign(UI, JSON.parse(localStorage.getItem('cardon.ui') || '{}')); } catch (e) {}
/* Al iniciar Cardón el panel de pestañas (Paciente, Medidas, Reporte) empieza minimizado; se abre con su botón o al elegir una pestaña */
let panelSession = false, wasNarrow = innerWidth < 1400;
const panelOpen = () => panelSession !== null ? panelSession : (innerWidth >= 1400 ? UI.panel : false);
function applyUI() {
  document.body.classList.toggle('no-panel', !panelOpen());
  document.body.classList.toggle('no-tools', !UI.tools);
  $('toolsToggle').setAttribute('aria-expanded', UI.tools ? 'true' : 'false');
  const tt = UI.tools ? 'Ocultar herramientas (H)' : 'Mostrar herramientas (H)';
  $('toolsToggle').title = tt; $('toolsToggle').setAttribute('aria-label', tt);
  try { localStorage.setItem('cardon.ui', JSON.stringify(UI)); } catch (e) {}
  requestAnimationFrame(() => state.vps.forEach(resizeVP));
}
function setPanel(open) { panelSession = open; if (innerWidth >= 1400) UI.panel = open; applyUI(); if (open) { const t = $('panelClose'); if (t) t.focus({ preventScroll: true }); } else $('panelOpen').focus({ preventScroll: true }); }
$('panelClose').addEventListener('click', () => setPanel(false));
$('panelOpen').addEventListener('click', () => setPanel(true));
$('toolsToggle').addEventListener('click', () => { UI.tools = !UI.tools; applyUI(); });
applyUI();
let resizeT = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { const n = innerWidth < 1400; if (n !== wasNarrow) { wasNarrow = n; panelSession = null; applyUI(); } }, 150);
});
function toggleFocus(on) {
  const want = on === undefined ? !document.body.classList.contains('focus') : on;
  document.body.classList.toggle('focus', want);
  closeCtx();
  requestAnimationFrame(() => state.vps.forEach(resizeVP));
  if (want) setStatus('');
}
$('focusExit').addEventListener('click', () => toggleFocus(false));
function toggleInvert() { const c = state.cur; if (!c) return; c.view.invert = !c.view.invert; els.invert.setAttribute('aria-pressed', c.view.invert); drawClipViews(c); }
function resetView() {
  const c = state.cur; if (!c) return;
  Object.assign(c.view, { zoom: 1, panX: 0, panY: 0, invert: false, bc: { b: 1, c: 1 }, enh: '' }); refreshEnh();
  if (c.wlDefault) c.view.wl = { ...c.wlDefault };
  els.invert.setAttribute('aria-pressed', 'false'); drawClipViews(c);
}
els.invert.addEventListener('click', toggleInvert);
els.reset.addEventListener('click', resetView);
els.info.addEventListener('click', () => { state.info = !state.info; els.info.setAttribute('aria-pressed', state.info); drawAll(); });
els.patient.addEventListener('click', () => { state.patient = !state.patient; els.patient.setAttribute('aria-pressed', state.patient); drawAll(); });
els.ecgBtn.addEventListener('click', () => {
  state.ecgOn = !state.ecgOn; els.ecgBtn.setAttribute('aria-pressed', state.ecgOn); drawAll();
  if (!state.ecgOn) return;
  const src = ecgSource(state.cur);
  const msg = {
    rwave: 'Esta secuencia trae las marcas de onda R pero no el trazo: verás las marcas en la barra de cuadros.',
    image: 'El ECG viene dibujado en la imagen. Cardón lo leyó para marcar telediástole y telesístole: usa TD y TS.',
    burned: 'El ECG de esta secuencia viene dibujado dentro de la imagen, no como señal, así que Cardón no puede leerlo. Marca telediástole y telesístole con clic derecho.',
    none: 'Esta secuencia no trae ECG. Puedes marcar telediástole y telesístole con clic derecho sobre el cuadro.'
  }[src];
  if (msg) setStatus(msg);
});
els.maskClear.addEventListener('click', () => { const c = state.cur; if (!c) return; c.masks = []; refreshMaskBtn(); drawClipViews(c); });
$('maskBtn').addEventListener('click', () => armSpecial('mask'));
$('expPng').addEventListener('click', exportPng);
$('expXlsx').addEventListener('click', () => exportStudyXlsx(els.status));
$('expVid').addEventListener('click', exportVideo);
function fsToggle(el) {
  const fail = () => { const t = 'Este navegador no permite pantalla completa aquí. Prueba con F11 en Windows o Ctrl+Cmd+F en Mac.'; if (state.view === 'home') setHomeStatus(t); else setStatus(t); };
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(fail);
    else fail();
  } catch (e) { fail(); }
}
els.full.addEventListener('click', () => fsToggle(els.stage));
$('appFull').addEventListener('click', () => fsToggle(document.documentElement));
document.addEventListener('fullscreenchange', () => { $('appFull').setAttribute('aria-pressed', document.fullscreenElement === document.documentElement ? 'true' : 'false'); });

const pointers = new Map();
let pinchPrev = null, drawingId = null;
function zoomAt(vp, clientX, clientY, factor) {
  const c = vp.clip; if (!c) return;
  const r = vp.el.getBoundingClientRect();
  const px = clientX - r.left - r.width / 2, py = clientY - r.top - r.height / 2, v = c.view;
  const nz = Math.min(20, Math.max(0.2, v.zoom * factor)), k = nz / v.zoom;
  v.panX = px - (px - v.panX) * k; v.panY = py - (py - v.panY) * k; v.zoom = nz;
  drawClipViews(c);
}
function adjust(vp, dx, dy) {
  const c = vp.clip; if (!c) return;
  const f = c.ready[vp.frame] || c.lastShown, v = c.view;
  if (f && f.kind === 'gray' && v.wl) {
    const s = Math.max(c.wlDefault ? c.wlDefault.w : 256, 2) / 300;
    v.wl.w = Math.max(2, v.wl.w + dx * s); v.wl.c = v.wl.c + dy * s;
  } else {
    v.bc.c = Math.min(4, Math.max(0.2, v.bc.c + dx * 0.004));
    v.bc.b = Math.min(4, Math.max(0.2, v.bc.b - dy * 0.004));
  }
  drawClipViews(c);
}
function bindVP(vp) {
  const el = vp.el;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    const idx = state.vps.indexOf(vp);
    if (idx !== state.act) { setActive(idx); if (state.arm && vp.clip && vp.clip.foreign && state.arm.k) { disarm(); setStatus('Esa ventana muestra un estudio anterior; las medidas se hacen en el estudio actual.'); } else if (state.arm) { state.vps.forEach(v => v.el.classList.toggle('measuring', v === vp)); } }
    el.focus({ preventScroll: true });
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    closeCtx();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, vp, t0: performance.now(), moved: false });
    const a = state.arm;
    if (a && e.button === 0 && pointers.size === 1 && vp.tf) {
      const p = toImage(vp, e.clientX, e.clientY);
      a.err = ''; drawingId = e.pointerId;
      if (a.t === 'dist' || a.t === 'time' || a.t === 'cal' || a.t === 'slope' || a.t === 'mask' || a.t === 'sten' || a.t === 'mline' || a.t === 'roi' || a.t === 'arrow') a.pts = [p, { ...p }];
      else if (a.t === 'vel' || a.t === 'base' || a.t === 'note') a.pts = [p];
      else if (a.t === 'dopcal') a.pts = a.pts.length === 1 ? [a.pts[0], p] : [p];
      else a.pts = [p];
      a.live = liveText(a); updateHint(); drawVP(vp);
      return;
    }
    if (!a && !state.cprDraw && e.button === 0 && pointers.size === 1 && vp.clip && vp.clip.mpr && vp.tf && !e.ctrlKey && !e.shiftKey) {
      const h = mprHit(vp, e.clientX, e.clientY);
      if (h) { state.mprDrag = { vp, h, id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
    }
    if (pointers.size === 2) {
      drawingId = null;
      const [p1, p2] = [...pointers.values()];
      pinchPrev = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
    }
  });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (state.mprDrag && state.mprDrag.id === e.pointerId) {
      const D = state.mprDrag; p.moved = true; D.nx = e.clientX; D.ny = e.clientY;
      if (!D.raf) D.raf = requestAnimationFrame(() => { D.raf = 0; mprDrag(D.vp, D.h, D.x, D.y, D.nx, D.ny); D.x = D.nx; D.y = D.ny; });
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const c = vp.clip; if (!c) return;
    if (drawingId === e.pointerId && state.arm && vp.tf) {
      const a = state.arm, q = toImage(vp, e.clientX, e.clientY);
      if (a.t === 'dist' || a.t === 'time' || a.t === 'cal' || a.t === 'slope' || a.t === 'mask' || a.t === 'sten' || a.t === 'mline' || a.t === 'roi' || a.t === 'arrow') a.pts[1] = q;
      else if (a.t === 'vel' || a.t === 'base' || a.t === 'note') a.pts[0] = q;
      else if (a.t === 'dopcal') a.pts[a.pts.length - 1] = q;
      else if (Math.hypot(dx, dy) >= 2) a.pts.push(q); else return;
      p.x = e.clientX; p.y = e.clientY;
      a.live = liveText(a); drawVP(vp);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 4) p.moved = true;
    if (p.btn === 2 && !p.moved) return;
    if (pointers.size >= 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      if (pinchPrev && pinchPrev.d > 0) { c.view.panX += mx - pinchPrev.mx; c.view.panY += my - pinchPrev.my; zoomAt(vp, mx, my, d / pinchPrev.d); }
      pinchPrev = { d, mx, my };
      return;
    }
    if (state.arm) return;
    if (p.btn === 1 || p.btn === 2 || e.shiftKey || state.tool === 'pan') { c.view.panX += dx; c.view.panY += dy; drawClipViews(c); }
    else if (state.tool === 'zoom') zoomAt(vp, p.sx, p.sy, Math.exp(-dy * 0.01));
    else adjust(vp, dx, dy);
  });
  const endPointer = e => {
    if (state.mprDrag && state.mprDrag.id === e.pointerId) {
      const D = state.mprDrag; state.mprDrag = null; pointers.delete(e.pointerId);
      if (D.raf) cancelAnimationFrame(D.raf);
      if (D.nx !== undefined && (D.nx !== D.x || D.ny !== D.y)) mprDrag(D.vp, D.h, D.x, D.y, D.nx, D.ny);
      drawAll(); if (D.vp.clip && D.vp.clip.mpr) mprPersist(D.vp.clip.mpr.src); return;
    }
    const pp = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pp && pp.btn === 2 && !pp.moved && e.type === 'pointerup' && performance.now() - pp.t0 < 700) { openCtx(vp, e.clientX, e.clientY); return; }
    if (pp && pp.btn === 0 && !pp.moved && e.type === 'pointerup' && !state.arm && drawingId !== e.pointerId && pointers.size === 0) {
      if (state.cprDraw && !e.ctrlKey && vp.tf && vp.clip && vp.clip.mpr && vp.clip.mpr.src === state.cprDraw.src) { cprAddPoint(vp, toImage(vp, e.clientX, e.clientY)); if (pointers.size < 2) pinchPrev = null; return; }
      const h = vp.clip && !vp.clip.foreign ? hitAnno(vp, e.clientX, e.clientY) : null;
      setSel(h ? { clip: vp.clip, anno: h } : null);
      if (!h && e.ctrlKey && vp.tf && vp.clip && vp.clip.mpr) mprLocate(vp, toImage(vp, e.clientX, e.clientY));
      if (!h && e.ctrlKey && vp.tf && vp.clip && vp.clip.cpr) cprLocate(vp, toImage(vp, e.clientX, e.clientY));
      if (h) setStatus('Medida seleccionada. Supr para borrarla.');
    }
    if (pointers.size < 2) pinchPrev = null;
    if (drawingId === e.pointerId) {
      drawingId = null;
      const a = state.arm;
      if (a && a.pts.length) {
        if (e.type === 'pointercancel') { a.pts = []; drawVP(vp); return; }
        if (a.t === 'dopcal' && a.pts.length === 1) { a.live = ''; updateHint(); drawVP(vp); return; }
        finishMeasure();
      }
    }
  };
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', endPointer);
  let wheelAcc = 0;
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const idx = state.vps.indexOf(vp); if (idx !== state.act) setActive(idx);
    if (!vp.clip || vp.clip.items.length < 2) return;
    const unit = e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 1 : 60;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < unit) return;
    const n = Math.trunc(wheelAcc / unit);
    wheelAcc -= n * unit;
    step(n);
  }, { passive: false });
  el.addEventListener('dblclick', e => { if (!state.arm && !hitAnno(vp, e.clientX, e.clientY)) toggleFocus(); });
  /* Arrastrar una secuencia desde la lista hasta esta ventana */
  const isClipDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('application/x-cardon-clip');
  el.addEventListener('dragover', e => { if (!isClipDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; el.classList.add('dropover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dropover'));
  el.addEventListener('drop', e => {
    if (!isClipDrag(e)) return;
    e.preventDefault(); el.classList.remove('dropover');
    const c = state.clips.find(x => String(x.id) === e.dataTransfer.getData('application/x-cardon-clip')); if (!c) return;
    const idx = state.vps.indexOf(vp); if (idx < 0) return;
    if (state.arm) disarm();
    setActive(idx); select(c); preload(c); drawAll();
  });
  el.addEventListener('pointermove', e => { if (!pointers.size) { const h = huUnder(vp, e.clientX, e.clientY); if (h !== (vp.huText || '')) { vp.huText = h; overlays(vp, vp.clip && (vp.clip.ready[vp.frame] || vp.clip.lastShown)); } }
    if (pointers.size || state.arm) { el.classList.remove('onanno'); return; } el.classList.toggle('onanno', !!(vp.clip && !vp.clip.foreign && hitAnno(vp, e.clientX, e.clientY)));
    if (vp.clip && vp.clip.mpr) { const h = mprHit(vp, e.clientX, e.clientY), was = vp.mprHover; vp.mprHover = h; el.classList.toggle('onmprmove', !!(h && h.t === 'move')); el.classList.toggle('onmprrot', !!(h && h.t === 'rot')); if ((was && was.q + was.t) !== (h && h.q + h.t)) drawVP(vp); } });
  el.addEventListener('pointerleave', () => { el.classList.remove('onanno'); if (vp.huText) { vp.huText = ''; overlays(vp, vp.clip && (vp.clip.ready[vp.frame] || vp.clip.lastShown)); } });
}

window.addEventListener('keydown', e => {
  if (!$('about').hidden || !$('settings').hidden || !$('fileinfo').hidden || !$('caseDlg').hidden) return;
  if (state.view !== 'viewer') return;
  const t = e.target;
  if (t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range'))) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (state.cprDraw && !state.arm) {
    if (e.key === 'Enter') { e.preventDefault(); cprFinish(); return; }
    if (e.key === 'Escape') { e.preventDefault(); cprCancel(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); cprUndo(); return; }
  }
  switch (e.key) {
    case 'Delete': case 'Backspace': if (!state.arm && state.sel) { e.preventDefault(); deleteSelected(); } break;
    case 'Escape': if (state.arm) { if (state.guide) guideStop(); else disarm(); } else if (state.sel) setSel(null); else if (document.body.classList.contains('focus')) toggleFocus(false); break;
    case ' ': e.preventDefault(); setPlaying(!state.playing); break;
    case 'ArrowLeft': e.preventDefault(); step(-1); break;
    case 'ArrowRight': e.preventDefault(); step(1); break;
    case 'ArrowUp': e.preventDefault(); stepSeq(-1); break;
    case 'ArrowDown': e.preventDefault(); stepSeq(1); break;
    case 'd': case 'D': if (e.shiftKey) markFrame('ed'); else goMark('ed'); break;
    case 's': case 'S': if (e.shiftKey) markFrame('es'); else goMark('es'); break;
    case 'r': case 'R': resetView(); break;
    case 'i': case 'I': toggleInvert(); break;
    case 'f': case 'F': fsToggle(els.stage); break;
    case 'z': case 'Z': setTool(state.tool === 'zoom' ? 'wl' : 'zoom'); break;
    case 'm': case 'M': setPanel(!panelOpen()); break;
    case 'h': case 'H': UI.tools = !UI.tools; applyUI(); break;
    case '+': case '=': { const r = AV().el.getBoundingClientRect(); zoomAt(AV(), r.left + r.width / 2, r.top + r.height / 2, 1.2); break; }
    case '-': { const r = AV().el.getBoundingClientRect(); zoomAt(AV(), r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); break; }
  }
});
