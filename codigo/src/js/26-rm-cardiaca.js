/* ======================= RM cardíaca =======================
   Volúmenes por discos (Simpson): volumen = Σ área del contorno × distancia entre cortes.
   Masa = (Σ epicardio − Σ endocardio en telediástole) × distancia × 1,05 g/ml.
   Realce tardío y edema por los 17 segmentos AHA. Mapas T1/T2 y VEC. Flujo por contraste de fase. */
const MR_REF = { /* Kawel-Boehm 2020, JCMR 22:87 (SSFP; músculos papilares incluidos en el volumen) */
  lvedvi: { H: [47, 107], M: [45, 93] }, lvesvi: { H: [11, 47], M: [10, 38] }, lvsvi: { H: [30, 66], M: [30, 59] },
  lvef: { H: [51, 76], M: [52, 79] }, lvmi: { H: [36, 75], M: [30, 59] },
  rvedvi: { H: [53, 123], M: [48, 104] }, rvesvi: { H: [17, 59], M: [13, 48] }, rvsvi: { H: [28, 75], M: [29, 66] }, rvef: { H: [42, 72], M: [46, 74] }
};
const MRC = { /* contornos del eje corto */
  lvn_ed: { s: 'VI endo TD', n: 'Endocardio del VI en telediástole', ph: 'ed', col: '#e7b24a' },
  lvn_es: { s: 'VI endo TS', n: 'Endocardio del VI en telesístole', ph: 'es', col: '#f0d28b' },
  lve_ed: { s: 'VI epi TD', n: 'Epicardio del VI en telediástole', ph: 'ed', col: '#7cc48b' },
  rvn_ed: { s: 'VD endo TD', n: 'Endocardio del VD en telediástole', ph: 'ed', col: '#62a8e6' },
  rvn_es: { s: 'VD endo TS', n: 'Endocardio del VD en telesístole', ph: 'es', col: '#a6cdf2' }
};
const AHA17 = ['Basal anterior', 'Basal anteroseptal', 'Basal inferoseptal', 'Basal inferior', 'Basal inferolateral', 'Basal anterolateral',
  'Medio anterior', 'Medio anteroseptal', 'Medio inferoseptal', 'Medio inferior', 'Medio inferolateral', 'Medio anterolateral',
  'Apical anterior', 'Apical septal', 'Apical inferior', 'Apical lateral', 'Ápex'];
const LGE_PAT = { sub: { n: 'Subendocárdico', col: '#e7b24a', isq: true }, trans: { n: 'Transmural', col: '#e05a4f', isq: true }, mid: { n: 'Mesocárdico', col: '#62a8e6' }, epi: { n: 'Subepicárdico', col: '#b88ae0' }, rvi: { n: 'Puntos de inserción del VD', col: '#7cc48b' }, diff: { n: 'Difuso o parcheado', col: '#9aa8a4' } };
const LGE_TM = { '1': '1–25 %', '2': '26–50 %', '3': '51–75 %', '4': '76–100 %' };
const MAPF = {
  t1n_myo: { n: 'T1 nativo del miocardio', u: 'ms' }, t1n_blood: { n: 'T1 nativo de la sangre', u: 'ms' },
  t1p_myo: { n: 'T1 poscontraste del miocardio', u: 'ms' }, t1p_blood: { n: 'T1 poscontraste de la sangre', u: 'ms' },
  t2_myo: { n: 'T2 del miocardio', u: 'ms' }
};
const FLOWV = { ao: 'Aorta', pa: 'Arteria pulmonar' };
function mrState(st) { const R = st.mr || (st.mr = {}); R.lge = R.lge || {}; R.edema = R.edema || {}; R.lim = R.lim || {}; return R; }
function saxClips() {
  const L = state.clips.filter(c => !c.foreign && clipKind(c) === 'rm' && c.slices > 1 && c.items.length > 1);
  return L.sort((a, b) => a.slice - b.slice);
}
function saxSpacing(L) {
  const locs = L.map(c => c.items[0].m.sliceLoc).filter(Number.isFinite).sort((a, b) => a - b), d = [];
  for (let i = 1; i < locs.length; i++) d.push(Math.abs(locs[i] - locs[i - 1]));
  if (d.length) { d.sort((a, b) => a - b); return d[Math.floor(d.length / 2)] / 10; }
  const m = L[0] && L[0].items[0].m; return m ? ((m.spacing || m.thick || 0) / 10) : 0;
}
const mrcKey = (slice, w) => `mrc_${slice}_${w}`;
function mrRef(k, sex) { const r = MR_REF[k]; return r && (sex === 'H' || sex === 'M') ? r[sex] : null; }
function mrFlag(k, v, sex) { const r = mrRef(k, sex); if (!r || !isNum(v)) return null; return v < r[0] ? 'bajo' : v > r[1] ? 'alto' : null; }
function computeMR(st, pt) {
  const V = st.values || {}, R = mrState(st), sex = pt && pt.sex, bsa = bsaOf(st), out = { sums: {}, n: {} };
  for (const w of Object.keys(MRC)) { out.sums[w] = 0; out.n[w] = 0; }
  let spacing = R.spacing || 0;
  for (const [k, v] of Object.entries(V)) { const m = /^mrc_(\d+)_(\w+)$/.exec(k); if (m && MRC[m[2]] && isNum(v.v)) { out.sums[m[2]] += v.v; out.n[m[2]]++; if (!spacing && v.sp) spacing = v.sp; } }
  out.spacing = spacing;
  const man = k => V['mr_' + k] && isNum(V['mr_' + k].v) ? V['mr_' + k].v : null;
  const fromC = w => out.n[w] && spacing ? out.sums[w] * spacing : null;
  const lvedv = man('lvedv') ?? fromC('lvn_ed'), lvesv = man('lvesv') ?? fromC('lvn_es');
  const epi = fromC('lve_ed'), lvm = man('lvm') ?? (epi !== null && lvedv !== null && epi > lvedv ? (epi - lvedv) * 1.05 : null);
  const rvedv = man('rvedv') ?? fromC('rvn_ed'), rvesv = man('rvesv') ?? fromC('rvn_es');
  const R2 = {};
  const put = (k, label, v, unit, d, idx) => { if (!isNum(v)) return; R2[k] = { label, v, text: `${dec(v, d)} ${unit}`.trim(), flag: idx ? mrFlag(k, v, sex) : null, ref: idx && mrRef(k, sex) ? `${mrRef(k, sex)[0]}–${mrRef(k, sex)[1]}` : '' }; };
  put('lvedv', 'Volumen telediastólico del VI', lvedv, 'ml', 0); put('lvesv', 'Volumen telesistólico del VI', lvesv, 'ml', 0);
  if (lvedv && lvesv !== null && lvedv > lvesv) { put('lvsv', 'Volumen latido del VI', lvedv - lvesv, 'ml', 0); put('lvef', 'FEVI', (lvedv - lvesv) / lvedv * 100, '%', 0, true); if (st.hr) put('lvco', 'Gasto cardíaco', (lvedv - lvesv) * st.hr / 1000, 'l/min', 1); }
  put('lvm', 'Masa del VI', lvm, 'g', 0);
  put('rvedv', 'Volumen telediastólico del VD', rvedv, 'ml', 0); put('rvesv', 'Volumen telesistólico del VD', rvesv, 'ml', 0);
  if (rvedv && rvesv !== null && rvedv > rvesv) { put('rvsv', 'Volumen latido del VD', rvedv - rvesv, 'ml', 0); put('rvef', 'FEVD', (rvedv - rvesv) / rvedv * 100, '%', 0, true); }
  if (bsa) {
    const ix = x => isNum(x) ? x / bsa : null;
    put('lvedvi', 'VTD del VI indexado', ix(lvedv), 'ml/m²', 0, true); put('lvesvi', 'VTS del VI indexado', ix(lvesv), 'ml/m²', 0, true);
    if (R2.lvsv) put('lvsvi', 'Volumen latido del VI indexado', R2.lvsv.v / bsa, 'ml/m²', 0, true);
    put('lvmi', 'Masa del VI indexada', ix(lvm), 'g/m²', 0, true);
    put('rvedvi', 'VTD del VD indexado', ix(rvedv), 'ml/m²', 0, true); put('rvesvi', 'VTS del VD indexado', ix(rvesv), 'ml/m²', 0, true);
    if (R2.rvsv) put('rvsvi', 'Volumen latido del VD indexado', R2.rvsv.v / bsa, 'ml/m²', 0, true);
  }
  /* mapas y VEC */
  const mp = f => V['mrm_' + f] && isNum(V['mrm_' + f].v) ? V['mrm_' + f].v : null;
  for (const [f, d] of Object.entries(MAPF)) { const v = mp(f); if (v !== null) { R2['map_' + f] = { label: d.n, v, text: `${dec(v, 0)} ms`, flag: null, ref: '' }; } }
  const lim = R.lim;
  if (R2.map_t1n_myo && isNum(lim.t1)) { R2.map_t1n_myo.flag = R2.map_t1n_myo.v > lim.t1 ? 'alto' : null; R2.map_t1n_myo.ref = `≤ ${lim.t1} ms (local)`; }
  if (R2.map_t2_myo && isNum(lim.t2)) { R2.map_t2_myo.flag = R2.map_t2_myo.v > lim.t2 ? 'alto' : null; R2.map_t2_myo.ref = `≤ ${lim.t2} ms (local)`; }
  const hct = isNum(R.hct) ? R.hct / 100 : null, a = mp('t1n_myo'), b = mp('t1n_blood'), c2 = mp('t1p_myo'), d2 = mp('t1p_blood');
  if (hct && a && b && c2 && d2 && c2 < a && d2 < b) { const ecv = (1 - hct) * ((1 / c2 - 1 / a) / (1 / d2 - 1 / b)) * 100; R2.ecv = { label: 'Volumen extracelular (VEC)', v: ecv, text: `${dec(ecv, 0)} %`, flag: ecv > (isNum(lim.ecv) ? lim.ecv : 30) ? 'alto' : null, ref: `≤ ${isNum(lim.ecv) ? lim.ecv : 30} %` }; }
  /* flujo */
  const fl = k => V['mrf_' + k] && V['mrf_' + k].v ? V['mrf_' + k] : null;
  for (const k of Object.keys(FLOWV)) { const f = fl(k); if (f) R2['flow_' + k] = f; }
  if (R2.flow_ao && R2.flow_pa && R2.flow_ao.net > 0) R2.qpqs = { label: 'Relación Qp/Qs', v: R2.flow_pa.net / R2.flow_ao.net, text: dec(R2.flow_pa.net / R2.flow_ao.net, 2), flag: R2.flow_pa.net / R2.flow_ao.net >= 1.5 ? 'alto' : null, ref: '≈ 1,0' };
  /* realce y edema */
  R2.lge = Object.entries(R.lge).filter(([, x]) => x && x.p).map(([s, x]) => ({ seg: +s, p: x.p, t: x.t || '' })).sort((x, y) => x.seg - y.seg);
  R2.edema = Object.keys(R.edema).filter(s => R.edema[s]).map(Number).sort((x, y) => x - y);
  return Object.assign(out, { R: R2 });
}
/* --- Contornos --- */
function armMRC(clip, w) {
  const R = mrState(state.study), d = MRC[w];
  if (state.arm && state.arm.mrc && state.arm.mrc.clip === clip && state.arm.mrc.w === w) { disarm(); return; }
  select(clip, Math.min(clip.items.length - 1, Math.max(0, d.ph === 'ed' ? (R.ed || 0) : (isNum(R.es) ? R.es : 0))));
  const semi = w !== 'lve_ed' && R.semi !== false;
  state.arm = { k: null, t: 'area', mrc: { clip, w }, name: `${d.s} · corte ${clip.slice}`, help: semi ? 'Haz clic dentro de la cavidad para delimitarla sola, o arrastra para trazarla a mano. Los músculos papilares quedan dentro del volumen.' : 'Recorre el contorno completo sin soltar; se cierra solo. Los músculos papilares quedan dentro del volumen.', pts: [], err: '' };
  startArm();
}
function finishMRC(a, c) {
  const fail = msg => { a.err = msg; a.pts = []; updateHint(); draw(); };
  const { clip, w } = a.mrc, d = MRC[w];
  if (c !== clip) return fail('Traza el contorno en el corte elegido.');
  let area, pts, cen, auto = false;
  if (a.pts.length < 6 && w !== 'lve_ed' && mrState(state.study).semi !== false) {
    const r = autoContour(c, state.frame, a.pts[0]); if (r.err) return fail(r.err);
    area = r.area; pts = r.poly; cen = { x: r.cx, y: r.cy }; auto = true;
  } else {
    let res; try { res = measureValue('area', a.pts, measureCtx()); } catch (e) { return fail(e.message); }
    area = res.v.area; pts = a.pts.slice(); cen = polyCentroid(pts);
  }
  storeMRC(clip, w, state.frame, pts, area, cen);
  disarm(); scheduleSave(); renderMRMed(); renderReport(); renderContext(); drawClipViews(c);
  setStatus(`${tr(d.n)}, corte ${clip.slice}: ${dec(area, 2)} cm²${auto ? ' (semiautomático; arrastra para trazarlo a mano si no te convence)' : ''}.`);
}
/* --- Mapas (ROI) --- */
function armMapROI(f) {
  if (state.arm && state.arm.mapf === f) { disarm(); return; }
  state.arm = { k: null, t: 'roi', mapf: f, name: MAPF[f].n, help: 'Arrastra desde el centro hacia el borde sobre el mapa para obtener el valor promedio.', pts: [], err: '' };
  startArm();
}
function finishMapROI(a, c) {
  let r; try { r = roiStats(c, state.frame, a.pts[0], a.pts[1]); } catch (e) { a.err = e.message; a.pts = []; updateHint(); draw(); return; }
  const key = 'mrm_' + a.mapf, vals = snapVals([key]), removed = annosWithKey(key);
  for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== key);
  state.study.values[key] = { v: r.mean, sd: r.sd, n: r.n, at: new Date().toISOString() };
  const anno = { k: key, t: 'roi', pts: a.pts.slice(), frame: state.frame, text: `${MAPF[a.mapf].n.replace(/ del? (miocardio|sangre)$/, m => m)} ${dec(r.mean, 0)} ± ${dec(r.sd, 0)}`, col: '#62c6c4' };
  c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno, removed, vals });
  disarm(); scheduleSave(); renderMRMed(); renderReport(); renderContext(); drawClipViews(c);
  setStatus(`${tr(MAPF[a.mapf].n)}: ${dec(r.mean, 0)} ± ${dec(r.sd, 0)} (${r.n} píxeles).`);
}
/* --- Flujo por contraste de fase --- */
function armFlow(v) {
  if (state.arm && state.arm.flow === v) { disarm(); return; }
  state.arm = { k: null, t: 'roi', flow: v, name: `Flujo · ${FLOWV[v]}`, help: 'En la imagen de fase, arrastra desde el centro del vaso hasta su borde. El círculo se aplica a todos los cuadros del ciclo.', pts: [], err: '' };
  startArm();
}
function guessVenc(c) {
  const m = c.items[0].m; if (isNum(m.venc) && m.venc > 0) return m.venc;
  const s = `${m.seqName || ''} ${m.seriesDesc || ''}`, x = /_v(\d{2,3})|venc\s*[:=]?\s*(\d{2,3})|v(\d{2,3})in/i.exec(s);
  return x ? +(x[1] || x[2] || x[3]) : null;
}
async function finishFlow(a, c) {
  const R = mrState(state.study), p0 = a.pts[0], p1 = a.pts[1], fail = msg => { a.err = msg; a.pts = []; updateHint(); draw(); };
  const venc = isNum(R.venc) && R.venc > 0 ? R.venc : guessVenc(c);
  if (!venc) return fail('Escribe la VENC (cm/s) en el panel de Flujo antes de medir.');
  const m = c.items[0].m, pxA = pxAreaMm2(m) / 100; if (!pxA) return fail('La serie no trae el tamaño del píxel.');
  const n = c.items.length; if (n < 4) return fail('Usa la serie de fase con todos los cuadros del ciclo.');
  setStatus('Calculando el flujo en todos los cuadros…');
  for (let i = 0; i < n; i++) if (!c.ready[i]) { try { await requestFrame(c, i); } catch (e) { return fail('No se pudieron leer todos los cuadros.'); } }
  const asp = m.aspect || 1, r = Math.hypot(p1.x - p0.x, (p1.y - p0.y) * asp);
  if (r < 1.5) return fail('El círculo es muy pequeño.');
  const half = 2 ** ((m.bitsStored || 12) - 1), signed = !!m.pixelRep, scaled = !!R.pcScaled;
  const toV = (f, i) => scaled ? f.data[i] * f.slope + f.intercept : ((signed ? f.data[i] : f.data[i] - half) / half) * venc;
  const f0 = c.ready[0], W = f0.w, H = f0.h;
  const circle = (cx, cy) => { const out = []; for (let y = Math.max(0, Math.floor(cy - r / asp)); y <= Math.min(H - 1, Math.ceil(cy + r / asp)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) if (Math.hypot(x - cx, (y - cy) * asp) <= r) out.push(y * W + x); return out; };
  /* Seguimiento: en cada cuadro el círculo se recentra en el centroide de la velocidad del vaso */
  const centers = []; let ccx = p0.x, ccy = p0.y;
  for (let k = 0; k < n; k++) {
    if (R.track !== false) {
      const f = c.ready[k], R2 = r * 1.6, win = [];
      let mx = 0;
      for (let y = Math.max(0, Math.floor(ccy - R2 / asp)); y <= Math.min(H - 1, Math.ceil(ccy + R2 / asp)); y++)
        for (let x = Math.max(0, Math.floor(ccx - R2)); x <= Math.min(W - 1, Math.ceil(ccx + R2)); x++)
          if (Math.hypot(x - ccx, (y - ccy) * asp) <= R2) { const v = Math.abs(toV(f, y * W + x)); win.push([x, y, v]); if (v > mx) mx = v; }
      if (mx > venc * 0.06) {
        let sw = 0, sx = 0, sy = 0; for (const [x, y, v] of win) if (v >= mx * 0.35) { sw += v; sx += x * v; sy += y * v; }
        if (sw > 0) { const nx = sx / sw, ny = sy / sw, dd = Math.hypot(nx - ccx, (ny - ccy) * asp); if (dd <= r * 0.8) { ccx = nx; ccy = ny; } }
      }
    }
    centers.push({ x: ccx, y: ccy });
  }
  const idxOf = k => circle(centers[k].x, centers[k].y), idx = idxOf(0);
  const trig = c.items.map(it => it.m.trigger), hasT = trig.every(Number.isFinite) && trig[n - 1] > trig[0];
  const times = hasT ? trig : (c.times || frameTimes(m, n));
  const rr = hasT ? (times[n - 1] - times[0]) * n / (n - 1) : state.study.hr > 0 ? 60000 / state.study.hr : (times[n - 1] - times[0]) * n / (n - 1) || 1000;
  const q = [], vpk = [];
  for (let k = 0; k < n; k++) { const f = c.ready[k]; let s = 0, mx = 0; for (const i of idxOf(k)) { const v = toV(f, i); s += v; if (Math.abs(v) > Math.abs(mx)) mx = v; } q.push(s * pxA); vpk.push(mx); }
  const net0 = q.reduce((s, x) => s + x, 0), sign = net0 < 0 ? -1 : 1, dt = rr / n / 1000;
  let fwd = 0, back = 0; for (const x of q) { const y = x * sign; if (y > 0) fwd += y * dt; else back -= y * dt; }
  const net = fwd - back, peak = Math.max(...vpk.map(v => v * sign));
  const key = 'mrf_' + a.flow, vals = snapVals([key]), removed = annosWithKey(key);
  for (const x of state.clips) x.annos = x.annos.filter(nn => nn.k !== key);
  state.study.values[key] = { v: net, label: `Flujo en ${FLOWV[a.flow].toLowerCase()}`, fwd, back, net, rf: fwd > 0 ? back / fwd * 100 : 0, peak, venc, curve: q.map(x => +(x * sign).toFixed(2)), rr, area: idx.length * pxA, text: `${dec(net, 0)} ml`, at: new Date().toISOString() };
  const moved = centers.some(q2 => Math.hypot(q2.x - p0.x, q2.y - p0.y) > 0.5);
  const anno = { k: key, t: 'roi', pts: a.pts.slice(), frame: -1, all: true, text: `${FLOWV[a.flow]} ${dec(net, 0)} ml`, col: '#e889c8', track: moved ? centers.map(q2 => [q2.x - p0.x, q2.y - p0.y]) : null };
  c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno, removed, vals });
  disarm(); scheduleSave(); renderMRMed(); renderReport(); renderContext(); drawClipViews(c);
  setStatus(`${tr(FLOWV[a.flow])}: anterógrado ${dec(fwd, 0)} ml, retrógrado ${dec(back, 0)} ml, neto ${dec(net, 0)} ml por latido.`);
}
/* --- Diana de 17 segmentos --- */
function bullseyeSVG(R, mode) {
  const cx = 110, cy = 110, rings = [[100, 76], [76, 52], [52, 28]], segs = [];
  const arc = (r0, r1, a0, a1) => { const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy - r * Math.sin(a)).toFixed(2)}`, la = (a1 - a0) > Math.PI ? 1 : 0; return `M${p(r0, a0)} A${r0},${r0} 0 ${la} 0 ${p(r0, a1)} L${p(r1, a1)} A${r1},${r1} 0 ${la} 1 ${p(r1, a0)} Z`; };
  const deg = d => d * Math.PI / 180;
  for (let i = 0; i < 6; i++) { const a0 = deg(60 + i * 60); segs.push([i + 1, arc(100, 76, a0, a0 + deg(60)), 88, a0 + deg(30)]); }
  for (let i = 0; i < 6; i++) { const a0 = deg(60 + i * 60); segs.push([i + 7, arc(76, 52, a0, a0 + deg(60)), 64, a0 + deg(30)]); }
  for (let i = 0; i < 4; i++) { const a0 = deg(45 + i * 90); segs.push([i + 13, arc(52, 28, a0, a0 + deg(90)), 40, a0 + deg(45)]); }
  const fill = s => mode === 'wm' ? (R[s] && WM[R[s]] ? WM[R[s]].col : 'var(--raise)') : mode === 'edema' ? (R.edema[s] ? '#e05a4f' : 'var(--raise)') : (R.lge[s] && R.lge[s].p ? LGE_PAT[R.lge[s].p].col : 'var(--raise)');
  const op = s => mode === 'lge' && R.lge[s] && R.lge[s].t ? [0.45, 0.6, 0.78, 1][+R.lge[s].t - 1] : 1;
  return `<svg viewBox="0 0 220 220" class="bull" role="group" aria-label="Diana de 17 segmentos">
    ${segs.map(([s, d, lr, la]) => `<path d="${d}" data-seg="${s}" fill="${fill(s)}" fill-opacity="${op(s)}"><title>${s}. ${esc(tr(AHA17[s - 1]))}</title></path><text x="${(cx + lr * Math.cos(la)).toFixed(1)}" y="${(cy - lr * Math.sin(la) + 4).toFixed(1)}">${s}</text>`).join('')}
    <circle cx="${cx}" cy="${cy}" r="28" data-seg="17" fill="${fill(17)}" fill-opacity="${op(17)}"><title>17. ${esc(tr(AHA17[16]))}</title></circle><text x="${cx}" y="${cy + 4}">17</text>
  </svg>`;
}
/* --- Panel de RM --- */
function renderMRMed() {
  const st = state.study, box = els.med; if (!box) return;
  const R = mrState(st), pt = patientOf(st), M = computeMR(st, pt), C = M.R, cards = cardState();
  if (!state.mrTab) state.mrTab = 'vol';
  const tab = state.mrTab, L = saxClips(), sp = saxSpacing(L) || M.spacing;
  const V = st.values || {}, cell = (c, w) => { const v = V[mrcKey(c.slice, w)]; const on = state.arm && state.arm.mrc && state.arm.mrc.clip === c && state.arm.mrc.w === w; return `<button class="mrc${v ? ' has' : ''}" type="button" data-mrc="${c.slice}:${w}" aria-pressed="${on}" title="${esc(MRC[w].n)} · corte ${c.slice}">${v ? dec(v.v, 1) : '+'}</button>`; };
  const row = k => C[k] ? `<div class="crow"><span class="cl">${esc(C[k].label)}</span><span class="cv">${C[k].flag ? `<span class="flag ${C[k].flag}">${C[k].flag}</span>` : ''}${esc(C[k].text)}</span>${C[k].ref ? `<span class="cr">Referencia: ${esc(C[k].ref)}</span>` : ''}</div>` : '';
  const f = (id, label, val, attrs) => `<label class="fld">${label}<input type="number" id="${id}" value="${val === null || val === undefined ? '' : esc(val)}" ${attrs || ''}></label>`;
  let body = '';
  if (tab === 'vol') {
    body = `
      <div class="mrphase card">
        <div class="row"><span>Telediástole: <b>cuadro ${(R.ed || 0) + 1}</b></span><button class="btn small" type="button" id="mrSetED">Usar el cuadro actual</button></div>
        <div class="row"><span>Telesístole: <b>${isNum(R.es) ? 'cuadro ' + (R.es + 1) : 'sin elegir'}</b></span><button class="btn small" type="button" id="mrSetES">Usar el cuadro actual</button></div>
        <div class="row"><button class="btn small" type="button" id="mrDetES">Detectar telesístole</button><span class="note">usa el VI en telediástole del corte medio</span></div>
      </div>
      <div class="mrsemi card">
        <label class="check small"><input type="checkbox" id="mrSemi"${R.semi !== false ? ' checked' : ''}> Contorno semiautomático: un clic dentro de la cavidad</label>
        <label class="fld">Umbral de la sangre <span class="mono" id="mrThrV">${isNum(R.segThr) ? R.segThr : 50} %</span><input type="range" id="mrThr" min="25" max="75" step="1" value="${isNum(R.segThr) ? R.segThr : 50}"></label>
        <div class="row"><button class="btn small" type="button" id="mrFillLV">Completar VI en todos los cortes</button><button class="btn small" type="button" id="mrFillRV">Completar VD</button></div>
        <p class="note">Más umbral = contorno más ajustado a la sangre. El epicardio se traza a mano. Revisa cada contorno: si no te convence, vuelve a pulsar la casilla y arrastra para trazarlo a mano.</p>
      </div>
      ${L.length ? `<div class="mrgrid"><span></span>${Object.values(MRC).map(d => `<span class="mrh" style="color:${d.col}">${esc(d.s)}</span>`).join('')}
        ${L.map(c => `<button class="link mrs" type="button" data-mrslice="${c.slice}" title="Ver el corte ${c.slice}">Corte ${c.slice}</button>${Object.keys(MRC).map(w => cell(c, w)).join('')}`).join('')}</div>
        <p class="note">Áreas en cm². Pulsa una casilla y traza el contorno en ese corte; la fase (TD o TS) se elige sola. Distancia entre cortes: ${sp ? dec(sp * 10, 1) + ' mm' : 'desconocida'}.</p>`
        : '<p class="empty">No hay una serie cine de eje corto con varios cortes. Importa el eje corto completo o escribe los volúmenes abajo.</p>'}
      <h4>Resultados</h4>
      <div class="calcs">${['lvedv', 'lvesv', 'lvsv', 'lvef', 'lvm', 'lvedvi', 'lvesvi', 'lvsvi', 'lvmi', 'lvco', 'rvedv', 'rvesv', 'rvsv', 'rvef', 'rvedvi', 'rvesvi', 'rvsvi'].map(row).join('') || '<p class="empty">Traza los contornos o escribe los valores.</p>'}</div>
      ${(pt || {}).sex ? '' : '<p class="note">Indica el sexo del paciente para comparar con las referencias.</p>'}
      <details class="mgroup mcard" data-card="mrman"${cards.mrman ? ' open' : ''}><summary><span class="gname">Escribir valores de otra estación</span></summary><div class="gbody"><div class="grid2">
        ${[['lvedv', 'VTD del VI (ml)'], ['lvesv', 'VTS del VI (ml)'], ['lvm', 'Masa del VI (g)'], ['rvedv', 'VTD del VD (ml)'], ['rvesv', 'VTS del VD (ml)']].map(([k, l]) => f('mrman_' + k, l, V['mr_' + k] ? V['mr_' + k].v : '', 'min="0" step="any" inputmode="decimal" data-mrman="' + k + '"')).join('')}
      </div><p class="note">Si escribes un valor, reemplaza al calculado con los contornos.</p></div></details>
      <p class="note">Referencias: Kawel-Boehm et al., JCMR 2020 (SSFP, músculos papilares dentro del volumen).</p>`;
  } else if (tab === 'lge') {
    const brush = state.mrBrush || (state.mrBrush = { mode: 'lge', p: 'sub', t: '2' });
    body = `
      <div class="seg full"><button class="btn" type="button" data-mrmode="lge" aria-pressed="${brush.mode === 'lge'}">Realce tardío</button><button class="btn" type="button" data-mrmode="edema" aria-pressed="${brush.mode === 'edema'}">Edema (T2)</button></div>
      ${brush.mode === 'lge' ? `<div class="grid2"><label class="fld">Patrón<select id="mrPat">${Object.entries(LGE_PAT).map(([k, d]) => `<option value="${k}"${brush.p === k ? ' selected' : ''}>${d.n}</option>`).join('')}<option value="none"${brush.p === 'none' ? ' selected' : ''}>Sin realce (borrar)</option></select></label>
        <label class="fld">Transmuralidad<select id="mrTm"><option value="">No aplica</option>${Object.entries(LGE_TM).map(([k, d]) => `<option value="${k}"${brush.t === k ? ' selected' : ''}>${d}</option>`).join('')}</select></label></div>
        <p class="note">Elige el patrón y pulsa los segmentos con realce. Pulsar de nuevo un segmento con el mismo patrón lo borra.</p>` : '<p class="note">Pulsa los segmentos con edema (hiperintensidad en T2 o T2 elevado en el mapa).</p>'}
      <div class="bullwrap">${bullseyeSVG(R, brush.mode)}
        <div class="legend">${brush.mode === 'lge' ? Object.values(LGE_PAT).map(d => `<span><i class="dot" style="background:${d.col}"></i>${esc(d.n)}</span>`).join('') : '<span><i class="dot" style="background:#e05a4f"></i>Edema</span>'}<span class="note">Anterior arriba, septo a la izquierda.</span></div></div>
      ${C.lge.length ? `<div class="calcs">${C.lge.map(x => `<div class="crow"><span class="cl">${x.seg}. ${esc(AHA17[x.seg - 1])}</span><span class="cv">${esc(LGE_PAT[x.p].n)}${x.t ? ' · ' + LGE_TM[x.t] : ''}</span></div>`).join('')}</div>` : ''}
      ${C.edema.length ? `<p class="note">Edema en: ${C.edema.map(s => `${s}. ${esc(AHA17[s - 1])}`).join(', ')}.</p>` : ''}
      <label class="check small"><input type="checkbox" id="mrLgeDone"${R.lgeDone ? ' checked' : ''}> Revisé el realce tardío (permite informar «sin realce»)</label>`;
  } else if (tab === 'map') {
    body = `
      <p class="note">Abre el mapa y pulsa «Medir» para trazar una región de interés: el valor promedio queda en la casilla. También puedes escribirlo.</p>
      ${Object.entries(MAPF).map(([k, d]) => `<div class="mrow"><button class="mname" data-mapf="${k}" title="Medir ${esc(d.n)} con una región de interés">${ICON_RULER}<span>${esc(d.n)}</span>${C['map_' + k] && C['map_' + k].flag ? `<span class="flag alto">alto</span>` : ''}</button><input type="number" step="any" inputmode="decimal" data-mapin="${k}" value="${V['mrm_' + k] ? Math.round(V['mrm_' + k].v) : ''}" aria-label="${esc(d.n)}"><span class="unit">ms</span><button class="del" data-del="mrm_${k}" aria-label="Borrar" ${V['mrm_' + k] ? '' : 'hidden'}>×</button></div>`).join('')}
      <div class="grid2">${f('mrHct', 'Hematocrito (%)', isNum(R.hct) ? R.hct : '', 'min="10" max="70" step="0.1" inputmode="decimal"')}<div class="fld">VEC<span class="fval mono">${C.ecv ? `${esc(C.ecv.text)}${C.ecv.flag ? ' · alto' : ''}` : '—'}</span></div></div>
      <details class="mgroup mcard" data-card="mrlim"${cards.mrlim ? ' open' : ''}><summary><span class="gname">Límites normales de tu equipo</span><span class="msum">${isNum(R.lim.t1) || isNum(R.lim.t2) ? 'definidos' : 'sin definir'}</span></summary><div class="gbody"><div class="grid3">
        ${f('mrLimT1', 'T1 nativo máx. (ms)', isNum(R.lim.t1) ? R.lim.t1 : '', 'min="0" step="1" inputmode="numeric"')}${f('mrLimT2', 'T2 máx. (ms)', isNum(R.lim.t2) ? R.lim.t2 : '', 'min="0" step="1" inputmode="numeric"')}${f('mrLimEcv', 'VEC máx. (%)', isNum(R.lim.ecv) ? R.lim.ecv : '', 'min="0" step="1" inputmode="numeric"')}
      </div><p class="note">Los valores normales de T1 y T2 dependen del campo magnético (1,5 o 3 T), del fabricante y de la secuencia: usa los de tu centro. VEC: si no defines otro, se toma > 30 % como elevado.</p></div></details>
      <p class="note">VEC = (1 − hematocrito) × (ΔR1 miocardio / ΔR1 sangre), con R1 = 1/T1 antes y después del gadolinio.</p>`;
  } else {
    const fl = k => C['flow_' + k];
    body = `
      <p class="note">Abre la serie de <b>fase</b> (velocidad) del contraste de fase, elige el vaso y traza un círculo sobre su luz. El cálculo usa todos los cuadros del ciclo.</p>
      <div class="grid2">${f('mrVenc', 'VENC (cm/s)', isNum(R.venc) ? R.venc : (state.cur && clipKind(state.cur) === 'rm' ? guessVenc(state.cur) || '' : ''), 'min="10" max="800" step="1" inputmode="numeric"')}<label class="check small" style="align-self:end"><input type="checkbox" id="mrPcScaled"${R.pcScaled ? ' checked' : ''}> Los píxeles ya vienen en cm/s</label></div>
      <label class="check small"><input type="checkbox" id="mrTrack"${R.track !== false ? ' checked' : ''}> Seguir el vaso en cada cuadro (el círculo se recentra si el vaso se mueve)</label>
      ${Object.entries(FLOWV).map(([k, n]) => { const x = fl(k); return `<div class="flowrow"><button class="mname" type="button" data-flow="${k}">${ICON_RULER}<span>${esc(n)}</span></button>${x ? `<span class="mono">${dec(x.net, 0)} ml neto · FR ${dec(x.rf, 0)} %</span><button class="del" data-del="mrf_${k}" aria-label="Borrar">×</button>` : '<span class="note">sin medir</span><span></span>'}</div>
        ${x ? `<div class="flowdet"><svg viewBox="0 0 200 50" class="spark" aria-hidden="true">${(() => { const q = x.curve, mx = Math.max(1, ...q.map(Math.abs)), pts = q.map((v, i) => `${(i / Math.max(1, q.length - 1) * 196 + 2).toFixed(1)},${(25 - v / mx * 22).toFixed(1)}`).join(' '); return `<line x1="2" y1="25" x2="198" y2="25" stroke="var(--line)"/><polyline points="${pts}" fill="none" stroke="#e889c8" stroke-width="1.6"/>`; })()}</svg>
          <span class="note">Anterógrado ${dec(x.fwd, 0)} ml · retrógrado ${dec(x.back, 0)} ml · velocidad pico ${dec(x.peak, 0)} cm/s · área ${dec(x.area, 2)} cm²</span></div>` : ''}`; }).join('')}
      ${C.qpqs ? `<div class="calcs">${row('qpqs')}</div>` : ''}
      <p class="note">Fracción regurgitante (FR) = retrógrado / anterógrado. Orientativo en insuficiencia aórtica: &lt; 20 % leve, 20–40 % moderada, &gt; 40 % severa. Qp/Qs ≥ 1,5 sugiere cortocircuito significativo.</p>`;
  }
  box.innerHTML = `
    <div class="mtop">${kindPicker()}</div>
    <details class="mgroup mcard" data-card="datos"${cards.datos ? ' open' : ''}><summary><span class="gname">Datos para los cálculos</span><span class="msum${bsaOf(st) ? '' : ' warn'}" id="s-sum">${bsaOf(st) ? `SC ${dec(bsaOf(st), 2)} m²` : 'Sin peso ni talla'}</span></summary><div class="gbody"><div class="grid2">
      <label class="fld">Fecha<input type="date" id="s-date" value="${esc(st.date || '')}"></label>${f('s-hr', 'FC (lpm)', st.hr, 'step="1" min="0" inputmode="numeric"')}
      ${f('s-weight', 'Peso (kg)', st.weight, 'step="0.1" min="0" inputmode="decimal"')}${f('s-height', 'Talla (cm)', st.height, 'step="1" min="0" inputmode="decimal"')}
    </div></div></details>
    <div class="seg full cttabs" role="tablist">${[['vol', 'Volúmenes'], ['lge', 'Realce'], ['map', 'Mapas'], ['flow', 'Flujo']].map(([k, n]) => `<button class="btn" type="button" data-mrtab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>
    ${body}`;
  bindKindPicker(); bindCards(box);
  const save = () => { scheduleSave(); renderMRMed(); renderReport(); renderContext(); };
  box.querySelectorAll('[data-mrtab]').forEach(b => b.addEventListener('click', () => { state.mrTab = b.dataset.mrtab; if (state.arm) disarm(); renderMRMed(); }));
  const sd = $('s-date'); if (sd) sd.addEventListener('change', e => { st.date = e.target.value; scheduleSave(); renderContext(); renderReport(); });
  for (const [id, k] of [['s-hr', 'hr'], ['s-weight', 'weight'], ['s-height', 'height']]) { const el = $(id); if (el) el.addEventListener('change', e => { const v = parseFloat(e.target.value); st[k] = isFinite(v) ? v : null; save(); }); }
  const ed = $('mrSetED'); if (ed) ed.addEventListener('click', () => { R.ed = state.frame; save(); setStatus(`Telediástole: cuadro ${state.frame + 1}.`); });
  const es = $('mrSetES'); if (es) es.addEventListener('click', () => { R.es = state.frame; save(); setStatus(`Telesístole: cuadro ${state.frame + 1}.`); });
  const de = $('mrDetES'); if (de) de.addEventListener('click', detectES);
  const sm = $('mrSemi'); if (sm) sm.addEventListener('change', e => { R.semi = e.target.checked; scheduleSave(); if (state.arm && state.arm.mrc) armMRC(state.arm.mrc.clip, state.arm.mrc.w); });
  const th = $('mrThr'); if (th) { th.addEventListener('input', e => { $('mrThrV').textContent = e.target.value + ' %'; }); th.addEventListener('change', e => { R.segThr = +e.target.value; scheduleSave(); }); }
  const fl = $('mrFillLV'); if (fl) fl.addEventListener('click', () => autoFill('lv'));
  const fr = $('mrFillRV'); if (fr) fr.addEventListener('click', () => autoFill('rv'));
  box.querySelectorAll('[data-mrslice]').forEach(b => b.addEventListener('click', () => { const c = L.find(x => x.slice === +b.dataset.mrslice); if (c) select(c, R.ed || 0); }));
  box.querySelectorAll('[data-mrc]').forEach(b => b.addEventListener('click', () => { const [s, w] = b.dataset.mrc.split(':'); const c = L.find(x => x.slice === +s); if (c) armMRC(c, w); }));
  box.querySelectorAll('[data-mrman]').forEach(inp => inp.addEventListener('change', e => { const k = 'mr_' + e.target.dataset.mrman, x = parseFloat(String(e.target.value).replace(',', '.')), vals = snapVals([k]); if (isFinite(x) && x > 0) st.values[k] = { v: x, manual: true, at: new Date().toISOString() }; else delete st.values[k]; pushUndo({ type: 'del', items: [], vals }); save(); }));
  box.querySelectorAll('[data-mrmode]').forEach(b => b.addEventListener('click', () => { state.mrBrush.mode = b.dataset.mrmode; renderMRMed(); }));
  const pat = $('mrPat'); if (pat) pat.addEventListener('change', e => { state.mrBrush.p = e.target.value; });
  const tm = $('mrTm'); if (tm) tm.addEventListener('change', e => { state.mrBrush.t = e.target.value; });
  box.querySelectorAll('.bull [data-seg]').forEach(el => el.addEventListener('click', () => {
    const s = +el.dataset.seg, b = state.mrBrush;
    if (b.mode === 'edema') R.edema[s] = !R.edema[s];
    else if (b.p === 'none' || (R.lge[s] && R.lge[s].p === b.p && (R.lge[s].t || '') === (b.t || ''))) delete R.lge[s];
    else R.lge[s] = { p: b.p, t: b.t || '' };
    save();
  }));
  const ld = $('mrLgeDone'); if (ld) ld.addEventListener('change', e => { R.lgeDone = e.target.checked; save(); });
  box.querySelectorAll('[data-mapf]').forEach(b => b.addEventListener('click', () => armMapROI(b.dataset.mapf)));
  box.querySelectorAll('[data-mapin]').forEach(inp => inp.addEventListener('change', e => { const k = 'mrm_' + e.target.dataset.mapin, x = parseFloat(String(e.target.value).replace(',', '.')), items = annosWithKey(k), vals = snapVals([k]); if (isFinite(x) && x > 0) st.values[k] = { v: x, manual: true, at: new Date().toISOString() }; else delete st.values[k]; for (const c of state.clips) c.annos = c.annos.filter(n => n.k !== k); pushUndo({ type: 'del', items, vals }); drawAll(); save(); }));
  const hct = $('mrHct'); if (hct) hct.addEventListener('change', e => { const v = parseFloat(e.target.value); R.hct = isFinite(v) ? v : null; save(); });
  for (const [id, k] of [['mrLimT1', 't1'], ['mrLimT2', 't2'], ['mrLimEcv', 'ecv']]) { const el = $(id); if (el) el.addEventListener('change', e => { const v = parseFloat(e.target.value); R.lim[k] = isFinite(v) ? v : null; save(); }); }
  const vc = $('mrVenc'); if (vc) vc.addEventListener('change', e => { const v = parseFloat(e.target.value); R.venc = isFinite(v) ? v : null; scheduleSave(); });
  const ps = $('mrPcScaled'); if (ps) ps.addEventListener('change', e => { R.pcScaled = e.target.checked; scheduleSave(); });
  const tk = $('mrTrack'); if (tk) tk.addEventListener('change', e => { R.track = e.target.checked; scheduleSave(); });
  box.querySelectorAll('[data-flow]').forEach(b => b.addEventListener('click', () => armFlow(b.dataset.flow)));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => delKey(b.dataset.del)));
  refreshArmButtons();
  box.querySelectorAll('[data-mapf]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.mapf === b.dataset.mapf ? 'true' : 'false'));
  box.querySelectorAll('[data-flow]').forEach(b => b.setAttribute('aria-pressed', state.arm && state.arm.flow === b.dataset.flow ? 'true' : 'false'));
}
/* --- Reporte y conclusión --- */
function reportModelMR(st, pt, doctor) {
  const M = computeMR(st, pt), C = M.R, R = mrState(st), sex = pt && pt.sex, age = pt ? ageAt(pt.birth, st.date) : null, sections = [];
  const rows = keys => keys.filter(k => C[k]).map(k => ({ label: C[k].label, text: C[k].text, ref: C[k].ref || '', flag: C[k].flag }));
  const lv = rows(['lvedv', 'lvedvi', 'lvesv', 'lvesvi', 'lvsv', 'lvef', 'lvm', 'lvmi', 'lvco']); if (lv.length) sections.push({ title: 'Ventrículo izquierdo', rows: lv });
  const rv = rows(['rvedv', 'rvedvi', 'rvesv', 'rvesvi', 'rvsv', 'rvef']); if (rv.length) sections.push({ title: 'Ventrículo derecho', rows: rv });
  if (C.lge.length || R.lgeDone) sections.push({ title: 'Realce tardío de gadolinio', rows: C.lge.length ? C.lge.map(x => ({ label: `${x.seg}. ${AHA17[x.seg - 1]}`, text: LGE_PAT[x.p].n, ref: x.t ? LGE_TM[x.t] : '', flag: null })) : [{ label: 'Miocardio', text: 'Sin realce', ref: '', flag: null }] });
  if (C.edema.length) sections.push({ title: 'Edema miocárdico', rows: C.edema.map(s => ({ label: `${s}. ${AHA17[s - 1]}`, text: 'Presente', ref: '', flag: null })) });
  const mp = rows(Object.keys(MAPF).map(k => 'map_' + k).concat(['ecv'])); if (mp.length) sections.push({ title: 'Mapas paramétricos', rows: mp });
  const fl = []; for (const k of Object.keys(FLOWV)) { const x = C['flow_' + k]; if (x) { fl.push({ label: `Flujo neto en ${FLOWV[k].toLowerCase()}`, text: `${dec(x.net, 0)} ml`, ref: `anterógrado ${dec(x.fwd, 0)} · retrógrado ${dec(x.back, 0)}`, flag: null }); fl.push({ label: `Fracción regurgitante (${FLOWV[k].toLowerCase()})`, text: `${dec(x.rf, 0)} %`, ref: '', flag: x.rf >= 20 ? 'alto' : null }); } }
  if (C.qpqs) fl.push({ label: C.qpqs.label, text: C.qpqs.text, ref: C.qpqs.ref, flag: C.qpqs.flag });
  if (fl.length) sections.push({ title: 'Flujo por contraste de fase', rows: fl });
  const head = [['Paciente', pt ? pt.name : ''], ['Documento', pt ? pt.doc : ''], ['Edad', age !== null ? `${age} años` : ''], ['Sexo', sex === 'H' ? 'Masculino' : sex === 'M' ? 'Femenino' : ''], ['Fecha del estudio', st.date ? st.date.split('-').reverse().join('/') : ''], ['Superficie corporal', bsaOf(st) ? `${dec(bsaOf(st), 2)} m²` : '']].filter(x => x[1]);
  return { title: 'Resonancia magnética cardíaca', head, sections, conclusion: st.conclusion || '', doctor: doctor || '' };
}
function segList(list, en) { const names = list.map(s => en ? lc1(tr(AHA17[s - 1])) : AHA17[s - 1].toLowerCase()); return list.length === 1 ? names[0] : names.slice(0, -1).join(', ') + (en ? ' and ' : ' y ') + names[names.length - 1]; }
function segPhrase(list, en) { return en ? `in the ${segList(list, true)} segment${list.length > 1 ? 's' : ''}` : `en ${list.length > 1 ? 'los segmentos' : 'el segmento'} ${segList(list, false)}`; }
function buildConclusionMR(st, pt) {
  const M = computeMR(st, pt), C = M.R, R = mrState(st), en = I18N.lang === 'en', L = [];
  if (C.lvef) {
    const e = C.lvef.v, g = e >= 50 ? (en ? 'preserved systolic function' : 'función sistólica conservada') : e >= 40 ? (en ? 'mildly reduced systolic function' : 'función sistólica levemente reducida') : (en ? 'reduced systolic function' : 'función sistólica reducida');
    const big = C.lvedvi && C.lvedvi.flag === 'alto';
    L.push(en ? `${big ? 'Dilated' : 'Non-dilated'} left ventricle${C.lvedvi ? ` (EDVi ${C.lvedvi.text})` : ''} with ${g} (LVEF ${C.lvef.text})${C.lvmi ? `; LV mass index ${C.lvmi.text}${C.lvmi.flag === 'alto' ? ', increased' : ''}` : ''}.`
      : `Ventrículo izquierdo ${big ? 'dilatado' : 'no dilatado'}${C.lvedvi ? ` (VTD indexado ${C.lvedvi.text})` : ''} con ${g} (FEVI ${C.lvef.text})${C.lvmi ? `; masa indexada ${C.lvmi.text}${C.lvmi.flag === 'alto' ? ', aumentada' : ''}` : ''}.`);
  }
  if (C.rvef) { const ab = C.rvef.flag === 'bajo', big = C.rvedvi && C.rvedvi.flag === 'alto'; L.push(en ? `${big ? 'Dilated' : 'Non-dilated'} right ventricle with ${ab ? 'reduced' : 'preserved'} systolic function (RVEF ${C.rvef.text}).` : `Ventrículo derecho ${big ? 'dilatado' : 'no dilatado'} con función sistólica ${ab ? 'reducida' : 'conservada'} (FEVD ${C.rvef.text}).`); }
  if (C.lge.length) {
    const by = {}; for (const x of C.lge) (by[x.p] = by[x.p] || []).push(x);
    const parts = Object.entries(by).map(([p, xs]) => { const tm = [...new Set(xs.map(x => x.t).filter(Boolean))].map(t => LGE_TM[t]); return en ? `${lc1(tr(LGE_PAT[p].n))} enhancement ${segPhrase(xs.map(x => x.seg), true)}${tm.length ? ` (transmurality ${tm.join(', ')})` : ''}` : `realce ${LGE_PAT[p].n.toLowerCase()} ${segPhrase(xs.map(x => x.seg), false)}${tm.length ? ` (transmuralidad ${tm.join(', ')})` : ''}`; });
    const isq = C.lge.some(x => LGE_PAT[x.p].isq), noisq = C.lge.some(x => !LGE_PAT[x.p].isq);
    const pat = isq && noisq ? (en ? 'mixed pattern' : 'patrón mixto') : isq ? (en ? 'ischemic pattern' : 'patrón isquémico') : (en ? 'non-ischemic pattern' : 'patrón no isquémico');
    L.push((en ? 'Late gadolinium enhancement: ' : 'Realce tardío de gadolinio: ') + parts.join('; ') + ` (${pat}).`);
    const tm = C.lge.filter(x => LGE_PAT[x.p].isq && +x.t >= 3).map(x => x.seg);
    if (tm.length) L.push(en ? `Transmurality > 50 % in segment${tm.length > 1 ? 's' : ''} ${tm.join(', ')}: low likelihood of functional recovery after revascularization in ${tm.length > 1 ? 'those segments' : 'that segment'}.` : `Transmuralidad > 50 % en ${tm.length > 1 ? 'los segmentos' : 'el segmento'} ${tm.join(', ')}: baja probabilidad de recuperación funcional con la revascularización ${tm.length > 1 ? 'en esos segmentos' : 'en ese segmento'}.`);
  } else if (R.lgeDone) L.push(en ? 'No late gadolinium enhancement.' : 'Sin realce tardío de gadolinio.');
  if (C.edema.length) L.push(en ? `Myocardial edema ${segPhrase(C.edema, true)}.` : `Edema miocárdico ${segPhrase(C.edema, false)}.`);
  const mp = [];
  if (C.map_t1n_myo) mp.push(`${en ? 'native T1' : 'T1 nativo'} ${C.map_t1n_myo.text}${C.map_t1n_myo.flag ? (en ? ' (increased)' : ' (aumentado)') : ''}`);
  if (C.map_t2_myo) mp.push(`T2 ${C.map_t2_myo.text}${C.map_t2_myo.flag ? (en ? ' (increased)' : ' (aumentado)') : ''}`);
  if (C.ecv) mp.push(`${en ? 'ECV' : 'VEC'} ${C.ecv.text}${C.ecv.flag ? (en ? ' (increased)' : ' (aumentado)') : ''}`);
  if (mp.length) L.push((en ? 'Parametric mapping: ' : 'Mapas paramétricos: ') + mp.join(', ') + '.');
  for (const k of Object.keys(FLOWV)) { const x = C['flow_' + k]; if (x && x.rf >= 20) L.push(en ? `Regurgitant fraction of ${dec(x.rf, 0)} % in the ${k === 'ao' ? 'aorta' : 'pulmonary artery'} (${x.rf > 40 ? 'severe' : 'moderate'} range).` : `Fracción regurgitante de ${dec(x.rf, 0)} % en ${k === 'ao' ? 'la aorta' : 'la arteria pulmonar'} (rango ${x.rf > 40 ? 'severo' : 'moderado'}).`); }
  if (C.qpqs) L.push(en ? `Qp/Qs ratio ${C.qpqs.text}${C.qpqs.flag ? ', suggestive of a significant left-to-right shunt' : ''}.` : `Relación Qp/Qs ${C.qpqs.text}${C.qpqs.flag ? ', sugestiva de cortocircuito de izquierda a derecha significativo' : ''}.`);
  return L.join('\n');
}
