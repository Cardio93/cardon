/* ======================= Medición ======================= */
function armMeasure(k) {
  if (state.arm && state.arm.k === k) { disarm(); return; }
  openGroupOf(k);
  const d = DEF[k];
  state.arm = { k, t: d.t, name: d.n, help: armHelp(d), pts: [], err: '' };
  startArm();
}
function armSpecial(t) {
  const names = { cal: 'Calibrar distancia', dopcal: 'Calibrar Doppler', base: 'Ajustar línea de base', mask: 'Ocultar zona', mline: 'Modo M anatómico', arrow: 'Flecha', note: 'Texto' };
  const helps = {
    cal: 'Arrastra a lo largo de una distancia conocida: dos marcas de la escala de profundidad o, en angiografía, el ancho del catéter.',
    dopcal: 'Haz clic en la línea de base del Doppler y luego en una marca de velocidad conocida de la escala.',
    base: 'Haz clic sobre la línea de base del espectro Doppler para corregir su posición.',
    mask: 'Arrastra un rectángulo sobre el nombre u otros datos quemados en la imagen. Se tapará en negro al exportar.',
    arrow: 'Arrastra desde la cola hasta la punta de la flecha.',
    note: 'Haz clic donde quieres poner el texto; escríbelo y pulsa Enter (Esc cancela).',
    mline: 'Arrastra la línea del modo M sobre la imagen 2D, por ejemplo a través del anillo tricuspídeo o del VI. El sentido de arrastre es de arriba hacia abajo en el modo M.'
  };
  if (state.arm && state.arm.t === t) { disarm(); return; }
  state.arm = { k: null, t, name: names[t], help: helps[t], pts: [], err: '' };
  startArm();
}
const FREE = {
  dist: ['Calibrador', 'Arrastra entre los dos puntos que quieres medir.'],
  time: ['Tiempo', 'Arrastra en horizontal entre dos instantes del Doppler o del modo M.'],
  vel: ['Velocidad y gradiente', 'Haz clic en el punto del espectro Doppler que quieres medir.'],
  vti: ['Trazo Doppler', 'Traza la envolvente de la onda de principio a fin sin soltar.'],
  area: ['Trazo de área', 'Recorre el contorno completo sin soltar; se cierra solo.'],
  slope: ['Pendiente', 'Arrastra desde el pico de la onda siguiendo la pendiente de desaceleración.'],
  qca: ['Estenosis automática (QCA)', 'Arrastra a lo largo del vaso sin soltar, desde un tramo sano antes de la lesión hasta uno sano después.'],
  roi: ['ROI de densidad', 'Arrastra desde el centro hacia el borde: muestra el valor promedio (UH en TC).'],
  sten: ['Estenosis', 'Primero arrastra a lo ancho del vaso sano de referencia; luego, a lo ancho del punto más estrecho de la lesión.']
};
function armFree(kind) {
  const [name, help] = FREE[kind];
  state.arm = { k: null, free: kind, t: kind, name, help, pts: [], err: '' };
  startArm();
}
function freeText(kind, v, n) {
  const p = `${n}  `;
  if (kind === 'dist') return p + fmtQ(v, 'len', state.units);
  if (kind === 'time') { const ms = v * 1000; return p + `${dec(ms, 0)} ms` + (ms >= 300 && ms <= 2000 ? ` · ${Math.round(60000 / ms)} lpm` : ''); }
  if (kind === 'vel') { const m = v / 100; return p + `${dec(m, 2)} m/s · GP ${dec(4 * m * m, 1)} mmHg`; }
  if (kind === 'vti') { const vm = v.T > 0 ? v.vti / v.T / 100 : 0; return p + `ITV ${dec(v.vti, 1)} cm · Vmáx ${dec(v.vmax / 100, 2)} m/s\nVmed ${dec(vm, 2)} m/s · GPmáx ${dec(4 * (v.vmax / 100) ** 2, 1)} · GPmed ${dec(v.mg, 1)} mmHg`; }
  if (kind === 'area') return p + `${dec(v.area, 2)} cm² · perímetro ${dec(v.perim, 1)} cm`;
  if (kind === 'slope') { const ms = v * 1000; return p + `PHT ${dec(ms, 0)} ms · 220/PHT ${dec(220 / ms, 2)} cm²`; }
  if (kind === 'sten') return p + `Estenosis ${dec(v.pct, 0)} % (área ${dec(v.area, 0)} %)` + (v.ref ? `\nReferencia ${dec(v.ref * 10, 2)} mm · DLM ${dec(v.mld * 10, 2)} mm` : '');
  return p;
}
function freeAnnos(c, frame) { return c.annos.filter(a => a.free && a.frame === frame); }
function startArm() {
  const c = state.cur;
  if (!c) { state.arm = null; setStatus('Abre una imagen para medir.'); refreshArmButtons(); return; }
  if (c.foreign && state.arm.k && !state.arm.free) {
    setStatus(`Esa ventana muestra el estudio del ${isoToShow(c.foreign.date)}. Las medidas se guardan en el estudio activo: mide sobre una secuencia del estudio actual.`);
    state.arm = null; refreshArmButtons(); return;
  }
  setPlaying(false);
  state.vps.forEach(v => v.el.classList.toggle('measuring', v === AV()));
  updateHint(); draw(); refreshArmButtons();
}
function disarm() {
  state.arm = null;
  state.vps.forEach(v => v.el.classList.remove('measuring'));
  els.mhint.hidden = true;
  draw(); refreshArmButtons();
}
function updateHint() {
  const a = state.arm; if (!a) return;
  els.mhint.hidden = false;
  const g = state.guide && a.k ? `<span class="gstep">Paso ${state.guide.i + 1} de ${PROTOCOL.length} · ${esc(PROTOCOL[state.guide.i][1])}</span>` : '';
  els.mhint.innerHTML = `${g}<b>${esc(a.name)}</b> · ${esc(a.help)} <span style="color:var(--muted)">Esc cancela.</span>${a.err ? `<span class="err">${esc(a.err)}</span>` : ''}`;
}
function refreshArmButtons() {
  document.querySelectorAll('.mname[data-k]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.k === b.dataset.k ? 'true' : 'false'));
  document.querySelectorAll('[data-special]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.t === b.dataset.special ? 'true' : 'false'));
  document.querySelectorAll('[data-ctaseg]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.ctaSeg === b.dataset.ctaseg ? 'true' : 'false'));
  document.querySelectorAll('[data-cac]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.t === 'cac' && state.arm.art === b.dataset.cac ? 'true' : 'false'));
}
function refreshMaskBtn() { const c = state.cur; els.maskClear.hidden = !(c && c.masks.length); }
function liveText(a) {
  try {
    if (a.t === 'cal') { const p = a.pts; return `${fmtNum(Math.hypot(p[1].x - p[0].x, (p[1].y - p[0].y) * (state.cur.m.aspect || 1)))} px`; }
    if (a.t === 'trace' || a.t === 'vti' || a.t === 'area' || a.t === 'base' || a.t === 'dopcal' || a.t === 'mask' || a.t === 'cac') return '';
    if (a.t === 'roi') { try { return roiText(roiStats(state.cur, state.frame, a.pts[0], a.pts[1]), (state.cur.freeN || 0) + 1); } catch (e) { return ''; } }
    if (a.free === 'sten') { try { return fmtQ(measureValue('dist', a.pts, measureCtx()).v, 'len', state.units); } catch (e) { return ''; } }
    if (a.free) return freeText(a.free, measureValue(a.t, a.pts, measureCtx()).v, (state.cur.freeN || 0) + 1);
    return measureText(a.k, measureValue(a.t, a.pts, measureCtx()).v, state.units);
  } catch (e) { return ''; }
}
function finishMeasure() {
  const a = state.arm, c = state.cur;
  if (a.t === 'cac') { finishCac(a, c); return; }
  if (a.t === 'qca') { finishQCA(a, c); return; }
  if (a.mrc) { finishMRC(a, c); return; }
  if (a.mapf) { finishMapROI(a, c); return; }
  if (a.flow) { finishFlow(a, c); return; }
  if (a.t === 'roi') {
    let r;
    try { r = roiStats(c, state.frame, a.pts[0], a.pts[1]); } catch (e) { a.err = e.message; a.pts = []; updateHint(); draw(); return; }
    c.freeN = (c.freeN || 0) + 1;
    const anno = { k: 'libre' + c.freeN, free: 'roi', t: 'roi', pts: a.pts.slice(), frame: state.frame, text: roiText(r, c.freeN) };
    c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno });
    disarm(); drawClipViews(c);
    setStatus(`ROI: ${r.unit ? `${dec(r.mean, 0)} ${r.unit}` : dec(r.mean, 1)} ± ${dec(r.sd, 0)} (${r.n} píxeles).`);
    return;
  }
  if (a.t === 'arrow') {
    const p = a.pts;
    if (Math.hypot(p[1].x - p[0].x, (p[1].y - p[0].y) * (c.m.aspect || 1)) < 4) { a.err = 'Arrastra desde la cola hasta la punta.'; a.pts = []; updateHint(); draw(); return; }
    disarm(); addNote(c, 'arrow', p.slice(), '', state.frame); setStatus('Flecha agregada. Se guarda con el estudio y sale en las exportaciones.'); return;
  }
  if (a.t === 'note') { const vp = AV(), p = a.pts[0], fr = state.frame; disarm(); noteInput(vp, c, p, fr); return; }
  if (a.t === 'mline') {
    const p = a.pts;
    if (Math.hypot(p[1].x - p[0].x, (p[1].y - p[0].y) * (c.m.aspect || 1)) < 15) { a.err = 'La línea es muy corta.'; a.pts = []; updateHint(); draw(); return; }
    disarm(); buildMMode(c, p.slice()); return;
  }
  if (a.t === 'mask') {
    const p = a.pts;
    if (Math.abs(p[1].x - p[0].x) < 3 || Math.abs(p[1].y - p[0].y) < 3) { a.pts = []; draw(); return; }
    c.masks.push({ x0: Math.min(p[0].x, p[1].x), y0: Math.min(p[0].y, p[1].y), x1: Math.max(p[0].x, p[1].x), y1: Math.max(p[0].y, p[1].y) });
    a.pts = []; refreshMaskBtn(); drawClipViews(c); updateHint();
    setStatus('Zona oculta. Puedes tapar otra o pulsar Esc para terminar.');
    return;
  }
  if (a.t === 'cal') {
    const p = a.pts, px = Math.hypot(p[1].x - p[0].x, (p[1].y - p[0].y) * (c.m.aspect || 1));
    if (px < 5) { a.err = 'La línea es muy corta.'; a.pts = []; updateHint(); draw(); return; }
    state.pendingCal = { t: 'cal', px, clip: c };
    disarm(); setTab('med'); renderCal(); focusCalInput(); return;
  }
  if (a.t === 'base') {
    const hit = regionAt(curItem().m.regions || [], a.pts[0]);
    if (!hit || hit.r.fmt !== 3) { a.err = 'Haz clic dentro del espectro Doppler.'; a.pts = []; updateHint(); draw(); return; }
    c.baseOverride[hit.i] = a.pts[0].y;
    disarm(); setStatus('Línea de base ajustada para esta secuencia.'); return;
  }
  if (a.t === 'dopcal') {
    if (a.pts.length < 2) { updateHint(); draw(); return; }
    const dy = Math.abs(a.pts[1].y - a.pts[0].y);
    if (dy < 5) { a.err = 'Los dos puntos están muy cerca.'; a.pts = []; updateHint(); draw(); return; }
    state.pendingCal = { t: 'dopcal', baseY: a.pts[0].y, dy, clip: c };
    disarm(); setTab('med'); renderCal(); focusCalInput(); return;
  }
  if (a.free === 'sten') {
    const asp = c.m.aspect || 1, L = q => Math.hypot(q[1].x - q[0].x, (q[1].y - q[0].y) * asp);
    if (L(a.pts) < 3) { a.pts = a.ref ? [] : []; draw(); return; }
    if (!a.ref) { a.ref = a.pts.slice(); a.pts = []; a.help = 'Ahora arrastra a lo ancho del punto más estrecho de la lesión (diámetro luminal mínimo).'; updateHint(); draw(); return; }
    const rpx = L(a.ref), mpx = L(a.pts);
    if (mpx >= rpx) { a.err = 'El diámetro de la lesión debe ser menor que el de referencia.'; a.pts = []; updateHint(); draw(); return; }
    const v = { pct: (1 - mpx / rpx) * 100, area: (1 - (mpx / rpx) ** 2) * 100 };
    try { v.ref = measureValue('dist', a.ref, measureCtx()).v; v.mld = measureValue('dist', a.pts, measureCtx()).v; } catch (e) {}
    if (a.ctaSeg) {
      const key = 'cta_' + a.ctaSeg, vals = snapVals([key]), removed = annosWithKey(key);
      for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== key);
      const anno = { k: key, t: 'sten', pts: [...a.ref, ...a.pts], frame: state.frame, text: `${CTA_NAME[a.ctaSeg]}\n` + freeText('sten', v, '').trim() };
      c.annos.push(anno);
      state.study.values[key] = { v: Math.round(v.pct), at: new Date().toISOString() };
      pushUndo({ type: 'add', clip: c, anno, removed, vals });
      disarm(); drawClipViews(c); scheduleSave(); renderMed(); renderReport(); renderContext();
      setStatus(`${CTA_NAME[a.ctaSeg]}: estenosis de ${dec(v.pct, 0)} %.`);
      return;
    }
    if (a.seg) {
      const key = 'cor_' + a.seg, vals = snapVals([key]), removed = annosWithKey(key);
      for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== key);
      const anno = { k: key, t: 'sten', pts: [...a.ref, ...a.pts], frame: state.frame, text: `${SEG_NAME[a.seg]}\n` + freeText('sten', v, '').trim() };
      c.annos.push(anno);
      state.study.values[key] = { v: Math.round(v.pct), at: new Date().toISOString() };
      pushUndo({ type: 'add', clip: c, anno, removed, vals });
      disarm(); drawClipViews(c); scheduleSave(); renderMed(); renderReport(); renderContext();
      setStatus(`${SEG_NAME[a.seg]}: estenosis de ${dec(v.pct, 0)} %.`);
      return;
    }
    c.freeN = (c.freeN || 0) + 1;
    const anno = { k: 'libre' + c.freeN, free: 'sten', t: 'sten', pts: [...a.ref, ...a.pts], frame: state.frame, text: freeText('sten', v, c.freeN) };
    c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno });
    disarm(); drawClipViews(c);
    setStatus(v.ref ? 'Estenosis medida.' : 'Estenosis medida. Para ver los diámetros en mm, calibra con el catéter (pestaña Medidas → Calibrar distancia).');
    return;
  }
  if (a.t === 'trace' && a.k && a.pts.length < 4) {
    a.clicks = (a.clicks || []).concat([a.pts[0]]); a.pts = [];
    if (a.clicks.length < 3) { a.help = a.clicks.length === 1 ? 'Ahora haz clic en el otro anillo.' : (/^la/.test(a.k) ? 'Ahora haz clic en el techo de la aurícula.' : 'Ahora haz clic en el ápex (endocardio apical).'); updateHint(); draw(); return; }
    let r; try { r = autoEndo(c, state.frame, a.clicks); } catch (e) { a.err = e.message; a.clicks = []; a.help = armHelp(DEF[a.k]); updateHint(); draw(); return; }
    a.clicks = []; a.pts = r.pts; a.help = armHelp(DEF[a.k]);
    a.autoTxt = r.conf < 0.6 ? 'Borde automático con poca definición de la pared (lo que no se vio se completó con la forma esperada). Revísalo; si no te convence, trázalo a mano.' : 'Borde automático: revísalo; si no te convence, vuelve a medir trazando a mano.';
  }
  let res;
  try { res = measureValue(a.t, a.pts, measureCtx()); }
  catch (e) { a.err = e.message; a.pts = []; updateHint(); draw(); return; }
  if (a.aoKey) {
    const key = 'ang_' + a.aoKey, vals = snapVals([key]), removed = annosWithKey(key);
    for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== key);
    const anno = { k: key, t: 'dist', pts: a.pts.slice(), frame: state.frame, text: `${AO_ANG[a.aoKey]} ${dec(res.v * 10, 1)} mm` };
    c.annos.push(anno);
    state.study.values[key] = { v: res.v, at: new Date().toISOString(), approx: !!(curItem().m.pixelApprox && !c.cal) };
    pushUndo({ type: 'add', clip: c, anno, removed, vals });
    disarm(); drawClipViews(c); scheduleSave(); renderMed(); renderReport(); renderContext();
    setStatus(`${AO_ANG[a.aoKey]}: ${dec(res.v * 10, 1)} mm.`);
    return;
  }
  if (a.free) {
    c.freeN = (c.freeN || 0) + 1;
    const anno = { k: 'libre' + c.freeN, free: a.free, t: a.t, pts: a.pts.slice(), frame: state.frame, text: freeText(a.free, res.v, c.freeN) };
    c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno });
    disarm(); drawClipViews(c);
    setStatus('Medida libre agregada. Clic derecho para otra medida.');
    return;
  }
  const d = DEF[a.k], prev = state.study.values[a.k], vals = snapVals([a.k]), sid = newSid(), now = new Date().toISOString();
  const avg = state.avg && d.t !== 'trace' && prev && prev.v !== undefined && prev.v !== null && !prev.manual;
  let removed = [], text = `${d.n} ${measureText(a.k, res.v, state.units)}`, nAvg = 1;
  if (avg) {
    let sm = Array.isArray(prev.s) && prev.s.length ? prev.s.map(x => Object.assign({}, x)) : null;
    if (!sm) { const lid = newSid(); sm = [{ v: prev.v, id: lid }]; for (const r of annosWithKey(a.k)) if (!r.anno.sid) r.anno.sid = lid; }
    sm.push({ v: res.v, id: sid });
    while (sm.length > AVG_MAX) {
      const old = sm.shift();
      for (const r of annosWithKey(a.k)) if (r.anno.sid === old.id) { removed.push(r); r.clip.annos = r.clip.annos.filter(x => x !== r.anno); }
    }
    nAvg = sm.length;
    state.study.values[a.k] = { v: avgSamples(sm), at: now, s: sm };
    text = `${d.n} (${nAvg}) ${measureText(a.k, res.v, state.units)}`;
  } else {
    removed = annosWithKey(a.k);
    for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== a.k);
    state.study.values[a.k] = { v: res.v, at: now, s: [{ v: res.v, id: sid }] };
  }
  const anno = { k: a.k, t: a.t, pts: a.pts.slice(), frame: state.frame, text, sid };
  c.annos.push(anno);
  pushUndo({ type: 'add', clip: c, anno, removed, vals });
  if (nAvg > 1) setTimeout(() => setStatus(`${d.n}: ${nAvg} latidos, promedio ${measureText(a.k, state.study.values[a.k].v, state.units)}.`), 0);
  const wasGuided = !!state.guide;
  disarm();
  if (a.autoTxt) setTimeout(() => setStatus(a.autoTxt), 0);
  scheduleSave();
  renderMedValues(); renderReport(); renderContext();
  if (wasGuided) guideNext(false);
}
