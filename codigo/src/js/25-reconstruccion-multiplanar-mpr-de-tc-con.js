/* ======================= Reconstrucción multiplanar (MPR) de TC, con planos oblicuos =======================
   Con la serie axial se arma un volumen en UH. Las tres ventanas (axial, coronal y sagital) son planos que se
   remuestrean del volumen (interpolación trilineal). Un punto central C y tres normales ortogonales definen los
   planos. En cada ventana, las líneas punteadas son los otros dos planos: arrastrar la línea mueve ese plano;
   arrastrar un extremo (círculo) gira los dos planos alrededor del eje de esta ventana (imágenes fuera de eje). */
function mprCapable(c) { return !!(c && c.stack && !c.mpr && !c.foreign && clipKind(c) === 'tc' && c.items.length >= 8); }
async function buildVolume(c) {
  if (c.vol) return c.vol;
  const n = c.items.length;
  let done = 0;
  await decodeMany(c, n, null, async () => { if (++done % 10 === 0) { setStatus(`Preparando el volumen… ${Math.round(done / n * 100)} %`); await tick(); } });
  const f0 = c.ready[0], W = f0.w, H = f0.h, vol = new Int16Array(W * H * n);
  for (let k = 0; k < n; k++) {
    const f = c.ready[k];
    if (!f || f.kind !== 'gray' || f.w !== W || f.h !== H) throw new Error('Los cortes de la serie no tienen el mismo tamaño.');
    const off = k * W * H, sl = f.slope, ic = f.intercept, d = f.data;
    for (let i = 0; i < W * H; i++) { const v = Math.round(d[i] * sl + ic); vol[off + i] = v < -32768 ? -32768 : v > 32767 ? 32767 : v; }
  }
  const m = c.items[0].m, colCm = m.pixelCm || 0.05, rowCm = colCm * (m.aspect || 1), zCm = (clipZStep(c) || m.thick || 1) / 10;
  c.vol = { data: vol, W, H, n, colCm, rowCm, zCm };
  return c.vol;
}
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  rot: (v, k, t) => { const c = Math.cos(t), s = Math.sin(t), kv = V3.cross(k, v), d = V3.dot(k, v); return [v[0] * c + kv[0] * s + k[0] * d * (1 - c), v[1] * c + kv[1] * s + k[1] * d * (1 - c), v[2] * c + kv[2] * s + k[2] * d * (1 - c)]; }
};
const MPR_PLANES = ['ax', 'cor', 'sag'];
const MPR_NAME = { ax: 'Axial', cor: 'Coronal', sag: 'Sagital' };
const MPR_COL = { ax: '#e889c8', cor: '#62c6c4', sag: '#e7b24a' };
/* referencias fijas para orientar cada plano en pantalla (abajo y derecha), en coordenadas del volumen en mm */
const MPR_REF = { ax: { down: [0, 1, 0], right: [1, 0, 0] }, cor: { down: [0, 0, 1], right: [1, 0, 0] }, sag: { down: [0, 0, 1], right: [0, 1, 0] } };
function mprInit(src) {
  const V = src.vol, cx = V.colCm * 10, cy = V.rowCm * 10, cz = V.zCm * 10;
  const ext = [V.W * cx, V.H * cy, V.n * cz], Dm = Math.hypot(ext[0], ext[1], ext[2]);
  const s0 = Math.min(cx, cy), N = Math.max(64, Math.min(768, Math.ceil(Dm / s0)));
  const s = Math.max(s0, Dm / N);
  const Vc = [Math.round((V.W - 1) / 2) * cx, Math.round((V.H - 1) / 2) * cy, Math.round((V.n - 1) / 2) * cz];
  const sn = { ax: cz, cor: cy, sag: cx }, M = {}, K = {};
  for (const p of MPR_PLANES) { M[p] = Math.ceil(Dm / 2 / sn[p]); K[p] = 2 * M[p] + 1; }
  src.mprS = { cx, cy, cz, ext, D: Dm, N, s, h: Math.floor(N / 2), Vc, C: Vc.slice(), n: { ax: [0, 0, 1], cor: [0, 1, 0], sag: [1, 0, 0] }, sn, M, K, oblique: false };
  return src.mprS;
}
function mprBasis(S, p) {
  const n = S.n[p], R = MPR_REF[p];
  let v = V3.sub(R.down, V3.mul(n, V3.dot(R.down, n)));
  if (Math.hypot(...v) < 1e-3) v = V3.sub(R.right, V3.mul(n, V3.dot(R.right, n)));
  v = V3.norm(v);
  let u = V3.cross(v, n); if (V3.dot(u, R.right) < 0) u = V3.mul(u, -1);
  return { n, u: V3.norm(u), v };
}
function mprT(S, p, i) { return (i - S.M[p]) * S.sn[p]; }
function mprFrameOf(S, p) { return Math.max(0, Math.min(S.K[p] - 1, Math.round(V3.dot(V3.sub(S.C, S.Vc), S.n[p]) / S.sn[p] + S.M[p]))); }
function renderPlane(src, p, i) {
  const V = src.vol, S = src.mprS, B = mprBasis(S, p), N = S.N, s = S.s, h = S.h, d = V.data, W = V.W, H = V.H, nz = V.n, WH = W * H;
  const O = V3.add(S.Vc, V3.mul(B.n, mprT(S, p, i)));
  const toI = P => [P[0] / S.cx, P[1] / S.cy, P[2] / S.cz];
  const du = toI(V3.mul(B.u, s)), dv = toI(V3.mul(B.v, s)), o0 = toI(V3.sub(V3.sub(O, V3.mul(B.u, h * s)), V3.mul(B.v, h * s)));
  const out = new Int16Array(N * N), W1 = W - 1, H1 = H - 1, Z1 = nz - 1;
  let q = 0;
  /* Corte grueso (slab): MIP, promedio o MinIP a lo largo de la normal, con muestreo al vecino más cercano */
  if (S.slab && S.slab.mm > 0) {
    const step = Math.min(S.cx, S.cy, S.cz), K = Math.max(2, Math.round(S.slab.mm / step)), dn = toI(V3.mul(B.n, S.slab.mm / K));
    const ox = [], oy = [], oz = []; for (let k = 0; k < K; k++) { const f = k - (K - 1) / 2; ox.push(dn[0] * f); oy.push(dn[1] * f); oz.push(dn[2] * f); }
    const mode = S.slab.mode === 'avg' ? 1 : S.slab.mode === 'minip' ? 2 : 0;
    for (let b = 0; b < N; b++) {
      let x = o0[0] + dv[0] * b, y = o0[1] + dv[1] * b, z = o0[2] + dv[2] * b;
      for (let a = 0; a < N; a++, x += du[0], y += du[1], z += du[2]) {
        let acc = mode === 0 ? -32768 : mode === 2 ? 32767 : 0, cnt = 0;
        for (let k = 0; k < K; k++) {
          const xi = Math.round(x + ox[k]), yi = Math.round(y + oy[k]), zi = Math.round(z + oz[k]);
          if (xi < 0 || yi < 0 || zi < 0 || xi > W1 || yi > H1 || zi > Z1) continue;
          const v = d[zi * WH + yi * W + xi]; cnt++;
          if (mode === 0) { if (v > acc) acc = v; } else if (mode === 2) { if (v < acc) acc = v; } else acc += v;
        }
        out[q++] = cnt ? (mode === 1 ? Math.round(acc / cnt) : acc) : -1024;
      }
    }
    return { kind: 'gray', data: out, w: N, h: N, slope: 1, intercept: 0, mono1: false };
  }
  for (let b = 0; b < N; b++) {
    let x = o0[0] + dv[0] * b, y = o0[1] + dv[1] * b, z = o0[2] + dv[2] * b;
    for (let a = 0; a < N; a++, x += du[0], y += du[1], z += du[2]) {
      if (x < 0 || y < 0 || z < 0 || x > W1 || y > H1 || z > Z1) { out[q++] = -1024; continue; }
      const xi = x | 0, yi = y | 0, zi = z | 0, fx = x - xi, fy = y - yi, fz = z - zi;
      const bx = xi < W1 ? 1 : 0, by = yi < H1 ? W : 0, bz = zi < Z1 ? WH : 0, k = zi * WH + yi * W + xi;
      const c00 = d[k] + (d[k + bx] - d[k]) * fx, c10 = d[k + by] + (d[k + by + bx] - d[k + by]) * fx;
      const c01 = d[k + bz] + (d[k + bz + bx] - d[k + bz]) * fx, c11 = d[k + bz + by] + (d[k + bz + by + bx] - d[k + bz + by]) * fx;
      const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
      out[q++] = Math.round(c0 + (c1 - c0) * fz);
    }
  }
  return { kind: 'gray', data: out, w: N, h: N, slope: 1, intercept: 0, mono1: false };
}
/* memoria: cada plano guarda como máximo ~48 cortes generados */
function mprGen(c, i) {
  if (c.loaded > 48) for (let j = 0; j < c.ready.length; j++) if (c.ready[j] && Math.abs(j - i) > 24) { c.ready[j] = undefined; c.loaded--; }
  return renderPlane(c.mpr.src, c.mpr.plane, i);
}
function mprClip(src, plane) {
  let c = state.clips.find(x => x.mpr && x.mpr.src === src && x.mpr.plane === plane);
  if (c) return c;
  const S = src.mprS, m0 = src.items[0].m, K = S.K[plane];
  const meta = Object.assign({}, m0, { seriesDesc: `${MPR_NAME[plane]} · ${m0.seriesDesc || 'TC'}`, rows: S.N, cols: S.N, frames: 1, pixelCm: S.s / 10, aspect: 1, regions: [], ecg: null, curve: null, rwave: [], ftv: [], thick: undefined, z: undefined, sliceLoc: undefined, wc: m0.wc, ww: m0.ww });
  const items = [];
  c = { label: `${MPR_NAME[plane]} · ${src.label}`, sub: 'MPR', items, fps: 10, m: meta, multi: false, stack: true, lazy: true, mpr: { src, plane } };
  for (let i = 0; i < K; i++) items.push({ m: meta, gen: () => mprGen(c, i) });
  addClip(c);
  c.view.wl = src.view.wl ? Object.assign({}, src.view.wl) : null;
  const ext = S.ext, span = plane === 'ax' ? Math.max(ext[0], ext[1]) : plane === 'cor' ? Math.max(ext[0], ext[2]) : Math.max(ext[1], ext[2]);
  c.view.zoom = Math.max(1, S.D / span * 0.98);
  const after = state.clips.filter(x => x.mpr && x.mpr.src === src && x !== c).pop() || src;
  after.el.after(c.el);
  state.clips.splice(state.clips.indexOf(c), 1); state.clips.splice(state.clips.indexOf(after) + 1, 0, c);
  return c;
}
function mprInvalidate(c) { c.epoch = (c.epoch || 0) + 1; c.ready = new Array(c.items.length); c.pending = new Array(c.items.length); c.loaded = 0; }
async function openMPR(src, opt) {
  opt = opt || {};
  src = src && src.mpr ? src.mpr.src : src && src.cpr ? src.cpr.src : src;
  if (!mprCapable(src)) { setStatus('La reconstrucción necesita una serie axial de TC con al menos 8 cortes.'); return; }
  if (state.busyMpr) return;
  state.busyMpr = true; setPlaying(false);
  try {
    await buildVolume(src);
    const prev = state.vps.find(v => v.clip === src), S = mprInit(src);
    if (prev && prev.frame > 0) S.C[2] = prev.frame * S.cz;
    /* trabajo guardado con el estudio: planos, grosor y curvas */
    const key = clipUID(src), saved = key && state.study.mprs && state.study.mprs[key];
    let restored = false;
    if (saved && !opt.reset) {
      if (Array.isArray(saved.C) && saved.n) { S.C = saved.C.slice(); for (const p of MPR_PLANES) if (Array.isArray(saved.n[p])) S.n[p] = saved.n[p].slice(); S.oblique = !!saved.oblique; restored = true; }
      if (saved.slab) S.slab = Object.assign({}, saved.slab);
    }
    for (const d of state.clips.filter(x => x.mpr && x.mpr.src === src)) mprInvalidate(d);
    const cl = {}; for (const p of MPR_PLANES) cl[p] = mprClip(src, p);
    setLayout(4);
    const other = state.clips.find(x => clipKind(x) === 'tc' && !x.mpr && x !== src && !x.foreign);
    MPR_PLANES.forEach((p, k) => { state.vps[k].clip = cl[p]; state.vps[k].frame = mprFrameOf(S, p); });
    if (other) { state.vps[3].clip = other; state.vps[3].frame = 0; } else { state.vps[3].clip = null; state.vps[3].frame = 0; }
    if (saved && Array.isArray(saved.curves) && !state.clips.some(x => x.cpr && x.cpr.src === src)) {
      let last = null; for (const cv of saved.curves) last = cprCreate(src, cv.pts, cv.n) || last;
      if (last) state.vps[3].clip = last, state.vps[3].frame = 0;
    }
    setActive(0); markList(); drawAll();
    if (opt.reset) mprPersist(src);
    if (restored || (saved && saved.curves && saved.curves.length)) { setStatus('MPR abierto con los planos y las curvas que guardaste en este estudio. «Restablecer los planos» vuelve a los planos rectos.'); return; }
    setStatus('MPR listo. Arrastra una línea punteada para mover ese plano, o uno de sus extremos (círculo) para girarlo y obtener cortes fuera de eje. La rueda pasa de corte en corte; Ctrl + clic lleva los planos a ese punto.');
  } catch (e) { setStatus('No se pudo armar el volumen: ' + (e && e.message || e)); }
  finally { state.busyMpr = false; renderMed(); }
}
/* Al cambiar de corte en una ventana, el punto central se desplaza a lo largo de su normal */
function mprSync(vp) {
  const c = vp.clip; if (!c || !c.mpr || !c.mpr.src.mprS) return;
  const S = c.mpr.src.mprS, p = c.mpr.plane, n = S.n[p], t = mprT(S, p, vp.frame), tc = V3.dot(V3.sub(S.C, S.Vc), n);
  if (Math.abs(t - tc) > 1e-6) { S.C = V3.add(S.C, V3.mul(n, t - tc)); mprPersistSoon(c.mpr.src); }
}
/* Guarda en el estudio la posición, la orientación, el grosor y las curvas del MPR */
function mprPersist(src) {
  const st = state.study, S = src && src.mprS; if (!S || !st || src.foreign) return;
  const key = clipUID(src); if (!key) return;
  const r2 = a => a.map(x => Math.round(x * 1e4) / 1e4);
  st.mprs = st.mprs || {};
  st.mprs[key] = { C: r2(S.C), n: { ax: r2(S.n.ax), cor: r2(S.n.cor), sag: r2(S.n.sag) }, oblique: !!S.oblique, slab: S.slab ? Object.assign({}, S.slab) : null,
    curves: state.clips.filter(x => x.cpr && x.cpr.src === src).map(x => ({ n: x.cpr.n, pts: x.cpr.pts.map(r2) })) };
  scheduleSave();
}
let mprPersistT = 0;
function mprPersistSoon(src) { clearTimeout(mprPersistT); mprPersistT = setTimeout(() => mprPersist(src), 900); }
/* Geometría de las líneas en la imagen de esta ventana */
function mprLines(vp) {
  const c = vp.clip; if (!c || !c.mpr || !c.mpr.src.mprS) return null;
  const S = c.mpr.src.mprS, p = c.mpr.plane, B = mprBasis(S, p), O = V3.add(S.Vc, V3.mul(B.n, mprT(S, p, vp.frame)));
  const rel = V3.sub(S.C, O), C = { x: V3.dot(rel, B.u) / S.s + S.h, y: V3.dot(rel, B.v) / S.s + S.h };
  const lines = MPR_PLANES.filter(q => q !== p && state.vps.some(o => o.clip && o.clip.mpr && o.clip.mpr.src === c.mpr.src && o.clip.mpr.plane === q)).map(q => {
    const nq = S.n[q], dir = V3.norm(V3.cross(B.n, nq));
    return { q, d: { x: V3.dot(dir, B.u), y: V3.dot(dir, B.v) }, nrm: { x: V3.dot(nq, B.u), y: V3.dot(nq, B.v) }, col: MPR_COL[q] };
  });
  return { S, p, B, C, lines };
}
function mprHandleLen(vp) { const t = vp.tf; if (!t) return 60; const r = vp.el.getBoundingClientRect(); return Math.min(r.width, r.height) * state.dpr * 0.36 / t.sc; }
function drawMprRefs(G, vp, f) {
  const c = vp.clip; if (!c || !c.mpr) return;
  mprSync(vp);
  const L = mprLines(vp); if (!L) return;
  const ctx = G.ctx, d = G.dpr; ctx.save();
  { /* letras de orientación */
    const en = I18N.lang === 'en', p = L.p;
    const lab = { ax: ['D', 'A'], cor: ['D', 'S'], sag: ['A', 'S'] }[p], labE = { ax: ['R', 'A'], cor: ['R', 'S'], sag: ['A', 'S'] }[p];
    const [l, t] = en ? labE : lab;
    ctx.font = `600 ${12 * d}px "IBM Plex Mono", monospace`; ctx.fillStyle = 'rgba(231,178,74,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const a = toScreen(G, { x: 0, y: f.h / 2 }), b = toScreen(G, { x: f.w / 2, y: 0 });
    ctx.fillText(l, Math.max(10 * d, a.x + 10 * d), a.y); ctx.fillText(t, b.x, Math.max(10 * d, b.y + 10 * d));
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  const Cs = toScreen(G, L.C), far = 4000 * d, gap = 14 * d, hl = mprHandleLen(vp), hov = vp.mprHover;
  for (const ln of L.lines) {
    const dx = ln.d.x * G.tf.sc, dy = ln.d.y * G.tf.sc * G.tf.asp, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    ctx.strokeStyle = ln.col; ctx.globalAlpha = hov && hov.q === ln.q ? 1 : 0.85; ctx.lineWidth = (hov && hov.q === ln.q ? 1.8 : 1.2) * d; ctx.setLineDash([6 * d, 5 * d]);
    ctx.beginPath();
    ctx.moveTo(Cs.x + ux * gap, Cs.y + uy * gap); ctx.lineTo(Cs.x + ux * far, Cs.y + uy * far);
    ctx.moveTo(Cs.x - ux * gap, Cs.y - uy * gap); ctx.lineTo(Cs.x - ux * far, Cs.y - uy * far);
    ctx.stroke(); ctx.setLineDash([]);
    for (const sg of [1, -1]) {
      const hp = toScreen(G, { x: L.C.x + ln.d.x * hl * sg, y: L.C.y + ln.d.y * hl * sg });
      ctx.beginPath(); ctx.arc(hp.x, hp.y, (hov && hov.q === ln.q && hov.t === 'rot' ? 6.5 : 5) * d, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.lineWidth = 1.6 * d; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
  drawCprMarks(G, vp);
}
let mprRedrawing = false;
function redrawMprPeers(vp) {
  if (mprRedrawing) return;
  const c = vp.clip; if (!c || !c.mpr) return;
  const src = c.mpr.src;
  mprRedrawing = true;
  try { for (const o of state.vps) if (o !== vp && o.clip && ((o.clip.mpr && o.clip.mpr.src === src) || (o.clip.cpr && o.clip.cpr.src === src))) drawVP(o); }
  finally { mprRedrawing = false; }
}
/* ¿El puntero está sobre una línea o un extremo? */
function mprHit(vp, cx, cy) {
  const L = mprLines(vp); if (!L || !vp.tf) return null;
  const r = vp.el.getBoundingClientRect(), d = state.dpr, x = (cx - r.left) * d, y = (cy - r.top) * d, G = { tf: vp.tf };
  const Cs = toScreen(G, L.C), hl = mprHandleLen(vp);
  let best = null;
  for (const ln of L.lines) for (const sg of [1, -1]) {
    const hp = toScreen(G, { x: L.C.x + ln.d.x * hl * sg, y: L.C.y + ln.d.y * hl * sg }), dd = Math.hypot(hp.x - x, hp.y - y);
    if (dd <= 10 * d && (!best || dd < best.dd)) best = { t: 'rot', q: ln.q, dd };
  }
  if (best) return best;
  for (const ln of L.lines) {
    const dx = ln.d.x * vp.tf.sc, dy = ln.d.y * vp.tf.sc * vp.tf.asp, l = Math.hypot(dx, dy) || 1;
    const dist = Math.abs((x - Cs.x) * dy / l - (y - Cs.y) * dx / l);
    if (dist <= 6 * d && (!best || dist < best.dd)) best = { t: 'move', q: ln.q, dd: dist };
  }
  return best;
}
/* Arrastre: mover un plano o girar el par de planos alrededor del eje de esta ventana */
function mprDrag(vp, hit, e0x, e0y, ex, ey, start) {
  const L = mprLines(vp); if (!L) return;
  const S = L.S, src = vp.clip.mpr.src, G = { tf: vp.tf }, r = vp.el.getBoundingClientRect(), d = state.dpr;
  const toImg = (cx, cy) => toImage(vp, cx, cy);
  if (hit.t === 'move') {
    const a = toImg(e0x, e0y), b = toImg(ex, ey), ln = L.lines.find(l => l.q === hit.q); if (!ln) return;
    const mm = ((b.x - a.x) * ln.nrm.x + (b.y - a.y) * ln.nrm.y) * S.s;
    S.C = V3.add(S.C, V3.mul(S.n[hit.q], mm));
    for (const o of state.vps) if (o.clip && o.clip.mpr && o.clip.mpr.src === src && o.clip.mpr.plane === hit.q) o.frame = mprFrameOf(S, hit.q);
  } else {
    const a = toImg(e0x, e0y), b = toImg(ex, ey), a0 = Math.atan2(a.y - L.C.y, a.x - L.C.x), a1 = Math.atan2(b.y - L.C.y, b.x - L.C.x);
    let dt = a1 - a0; if (dt > Math.PI) dt -= 2 * Math.PI; if (dt < -Math.PI) dt += 2 * Math.PI;
    if (Math.abs(dt) < 1e-4) return;
    const w = V3.norm(V3.cross(L.B.u, L.B.v));
    for (const q of MPR_PLANES) if (q !== L.p) S.n[q] = V3.norm(V3.rot(S.n[q], w, dt));
    /* reortogonalizar para que no se acumule error */
    const [qa, qb] = MPR_PLANES.filter(q => q !== L.p);
    { const rb = S.n[qb], cb = V3.norm(V3.cross(S.n[L.p], S.n[qa])); S.n[qb] = V3.dot(cb, rb) < 0 ? V3.mul(cb, -1) : cb; }
    S.oblique = true;
    for (const o of state.vps) if (o.clip && o.clip.mpr && o.clip.mpr.src === src && o.clip.mpr.plane !== L.p) {
      const q = o.clip.mpr.plane; mprInvalidate(o.clip); o.frame = mprFrameOf(S, q);
      o.clip.ready[o.frame] = renderPlane(src, q, o.frame); o.clip.loaded = 1;
    }
  }
  drawAll();
}
/* Ctrl + clic: lleva los planos al punto marcado */
function mprLocate(vp, p) {
  const L = mprLines(vp); if (!L) return false;
  const S = L.S, O = V3.add(S.Vc, V3.mul(L.B.n, mprT(S, L.p, vp.frame)));
  S.C = V3.add(O, V3.add(V3.mul(L.B.u, (p.x - S.h) * S.s), V3.mul(L.B.v, (p.y - S.h) * S.s)));
  for (const o of state.vps) if (o !== vp && o.clip && o.clip.mpr && o.clip.mpr.src === vp.clip.mpr.src) o.frame = mprFrameOf(S, o.clip.mpr.plane);
  drawAll(); mprPersist(vp.clip.mpr.src);
  return true;
}

/* ---- Grosor del corte (slab) ---- */
const SLAB_MODES = { mip: 'MIP', avg: 'Promedio', minip: 'MinIP' };
function mprSetSlab(src, mm, mode) {
  const S = src.mprS; if (!S) return;
  S.slab = { mm: +mm || 0, mode: mode || (S.slab && S.slab.mode) || 'mip' };
  for (const c of state.clips) if (c.mpr && c.mpr.src === src) mprInvalidate(c);
  drawAll(); renderMed(); mprPersist(src);
}
function cprDelete(c) { const src = c.cpr.src; removeClip(c); markList(); drawAll(); renderMed(); mprPersist(src); setStatus('Curva borrada.'); }
/* ======================= Reconstrucción curva (CPR) de una coronaria =======================
   Se marcan puntos sobre el centro de la arteria en los planos del MPR; con ellos se arma una línea central suave
   y se genera una imagen «estirada» del vaso. La rueda sobre esa imagen la gira alrededor de la línea central. */
const CPR_ANGLES = 36, CPR_HALF_MM = 15;
function cprPoint3D(vp, p) {
  const L = mprLines(vp); if (!L) return null;
  const S = L.S, O = V3.add(S.Vc, V3.mul(L.B.n, mprT(S, L.p, vp.frame)));
  return V3.add(O, V3.add(V3.mul(L.B.u, (p.x - S.h) * S.s), V3.mul(L.B.v, (p.y - S.h) * S.s)));
}
function cprStart(src) {
  if (!src || !src.mprS) return;
  if (state.arm) disarm();
  state.cprDraw = { src, pts: [] };
  setStatus('Trazado de la coronaria: haz clic en el centro de la arteria, desde su origen, avanzando por su recorrido (usa la rueda para cambiar de corte). Enter o «Terminar» genera la imagen; Retroceso borra el último punto; Esc cancela.');
  renderMed(); drawAll();
}
function cprAddPoint(vp, p) {
  const D = state.cprDraw, P = cprPoint3D(vp, p); if (!D || !P) return;
  D.pts.push(P);
  const S = D.src.mprS; S.C = P;
  for (const o of state.vps) if (o.clip && o.clip.mpr && o.clip.mpr.src === D.src && o !== vp) o.frame = mprFrameOf(S, o.clip.mpr.plane);
  drawAll(); renderMed();
  setStatus(`Punto ${D.pts.length} marcado.${D.pts.length >= 2 ? ' Sigue por el recorrido o pulsa Enter para generar la imagen.' : ' Marca el siguiente punto más adelante en la arteria.'}`);
}
function cprUndo() { const D = state.cprDraw; if (!D || !D.pts.length) return; D.pts.pop(); drawAll(); renderMed(); }
function cprCancel() { state.cprDraw = null; drawAll(); renderMed(); setStatus('Trazado cancelado.'); }
/* Línea central: Catmull-Rom por los puntos, remuestreada a paso constante, con marcos que no giran (transporte paralelo) */
function cprPath(pts, step) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], dense = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1, 2].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  dense.push(pts[pts.length - 1]);
  const C = [dense[0]]; let need = step;
  for (let i = 1; i < dense.length; i++) {
    let a = dense[i - 1]; const b = dense[i]; let dd = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    while (dd >= need) { const t = need / dd; a = V3.add(a, V3.mul(V3.sub(b, a), t)); C.push(a); dd -= need; need = step; }
    need -= dd;
  }
  if (C.length < 3) return null;
  const T = C.map((_, i) => V3.norm(V3.sub(C[Math.min(C.length - 1, i + 1)], C[Math.max(0, i - 1)])));
  let ref = Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  let N = V3.norm(V3.cross(T[0], V3.cross(ref, T[0])));
  const NN = [], BB = [];
  for (let i = 0; i < C.length; i++) {
    N = V3.norm(V3.sub(N, V3.mul(T[i], V3.dot(N, T[i]))));
    NN.push(N); BB.push(V3.norm(V3.cross(T[i], N)));
  }
  return { C, T, N: NN, B: BB, len: (C.length - 1) * step };
}
function renderCPR(src, path, ai) {
  const V = src.vol, S = src.mprS, s = S.s, d = V.data, W = V.W, H = V.H, nz = V.n, WH = W * H, W1 = W - 1, H1 = H - 1, Z1 = nz - 1;
  const M = path.C.length, Hh = Math.round(CPR_HALF_MM / s), rows = 2 * Hh + 1, th = ai / CPR_ANGLES * 2 * Math.PI, ct = Math.cos(th), st = Math.sin(th);
  const out = new Int16Array(M * rows);
  for (let i = 0; i < M; i++) {
    const c = path.C[i], dir = V3.add(V3.mul(path.N[i], ct), V3.mul(path.B[i], st));
    for (let j = 0; j < rows; j++) {
      const o = (j - Hh) * s, x = (c[0] + dir[0] * o) / S.cx, y = (c[1] + dir[1] * o) / S.cy, z = (c[2] + dir[2] * o) / S.cz;
      let v = -1024;
      if (x >= 0 && y >= 0 && z >= 0 && x <= W1 && y <= H1 && z <= Z1) {
        const xi = x | 0, yi = y | 0, zi = z | 0, fx = x - xi, fy = y - yi, fz = z - zi;
        const bx = xi < W1 ? 1 : 0, by = yi < H1 ? W : 0, bz = zi < Z1 ? WH : 0, k = zi * WH + yi * W + xi;
        const c00 = d[k] + (d[k + bx] - d[k]) * fx, c10 = d[k + by] + (d[k + by + bx] - d[k + by]) * fx;
        const c01 = d[k + bz] + (d[k + bz + bx] - d[k + bz]) * fx, c11 = d[k + bz + by] + (d[k + bz + by + bx] - d[k + bz + by]) * fx;
        const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
        v = Math.round(c0 + (c1 - c0) * fz);
      }
      out[j * M + i] = v;
    }
  }
  return { kind: 'gray', data: out, w: M, h: rows, slope: 1, intercept: 0, mono1: false };
}
function cprFinish() {
  const D = state.cprDraw; if (!D) return;
  if (D.pts.length < 2) { setStatus('Marca al menos dos puntos sobre la arteria.'); return; }
  const src = D.src, S = src.mprS, path = cprPath(D.pts, S.s);
  if (!path) { setStatus('El trazo es demasiado corto.'); return; }
  state.cprDraw = null;
  const c = cprCreate(src, D.pts, null, path);
  if (state.layout !== 4) setLayout(4);
  const vp = state.vps[3]; vp.clip = c; vp.frame = 0;
  setActive(3); markList(); drawAll(); renderMed(); mprPersist(src);
  setStatus(`Reconstrucción curva lista (${dec(path.len, 0)} mm). La rueda sobre la imagen la gira alrededor del vaso; Ctrl + clic lleva los planos a ese punto. Puedes medir sobre ella como en cualquier imagen.`);
}
function cprCreate(src, pts, num, path) {
  const S = src.mprS; path = path || cprPath(pts, S.s); if (!path) return null;
  src.cprN = Math.max(src.cprN || 0, num || 0); if (!num) num = ++src.cprN;
  const m0 = src.items[0].m, rows = 2 * Math.round(CPR_HALF_MM / S.s) + 1;
  const meta = Object.assign({}, m0, { seriesDesc: `Curva ${num} · ${m0.seriesDesc || 'TC'}`, rows, cols: path.C.length, frames: 1, pixelCm: S.s / 10, aspect: 1, regions: [], ecg: null, curve: null, rwave: [], ftv: [], thick: undefined, z: undefined, sliceLoc: undefined });
  const items = [];
  const c = { label: `Curva ${num} · ${src.label}`, sub: `Reconstrucción curva · ${dec(path.len, 0)} mm`, items, fps: 10, m: meta, multi: false, stack: true, lazy: true, cpr: { src, path, pts: pts.map(p => p.slice()), n: num } };
  for (let i = 0; i < CPR_ANGLES; i++) items.push({ m: meta, gen: () => renderCPR(src, path, i) });
  addClip(c);
  c.view.wl = src.view.wl ? Object.assign({}, src.view.wl) : null;
  const after = state.clips.filter(x => (x.mpr && x.mpr.src === src) || (x.cpr && x.cpr.src === src)).pop() || src;
  after.el.after(c.el); state.clips.splice(state.clips.indexOf(c), 1); state.clips.splice(state.clips.indexOf(after) + 1, 0, c);
  return c;
}
/* Dibujo de los puntos y de la línea central sobre los planos del MPR */
function drawCprMarks(G, vp) {
  const c = vp.clip; if (!c || !c.mpr) return;
  const src = c.mpr.src, S = src.mprS, L = mprLines(vp); if (!L || !S) return;
  const sets = [];
  if (state.cprDraw && state.cprDraw.src === src) sets.push({ pts: state.cprDraw.pts, live: true });
  for (const x of state.clips) if (x.cpr && x.cpr.src === src && state.vps.some(o => o.clip === x)) sets.push({ pts: x.cpr.path.C.filter((_, i) => i % 4 === 0), live: false });
  if (!sets.length) return;
  const O = V3.add(S.Vc, V3.mul(L.B.n, mprT(S, L.p, vp.frame))), ctx = G.ctx, d = G.dpr;
  const proj = P => { const r = V3.sub(P, O); return { x: V3.dot(r, L.B.u) / S.s + S.h, y: V3.dot(r, L.B.v) / S.s + S.h, dz: Math.abs(V3.dot(r, L.B.n)) }; };
  ctx.save();
  for (const st of sets) {
    const q = st.pts.map(proj);
    ctx.setLineDash(st.live ? [] : [4 * d, 3 * d]); ctx.strokeStyle = st.live ? 'rgba(124,242,154,0.55)' : 'rgba(124,242,154,0.35)'; ctx.lineWidth = 1.4 * d;
    ctx.beginPath(); q.forEach((p, i) => { const s2 = toScreen(G, p); if (i) ctx.lineTo(s2.x, s2.y); else ctx.moveTo(s2.x, s2.y); }); ctx.stroke(); ctx.setLineDash([]);
    if (st.live) q.forEach((p, i) => { const s2 = toScreen(G, p), near = p.dz < 2; ctx.beginPath(); ctx.arc(s2.x, s2.y, (near ? 4.5 : 3) * d, 0, Math.PI * 2); ctx.fillStyle = near ? '#7cf29a' : 'rgba(124,242,154,0.4)'; ctx.fill(); if (near) { ctx.fillStyle = '#0b1210'; ctx.font = `600 ${9 * d}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), s2.x, s2.y); } });
  }
  ctx.restore();
}
/* Regla y posición sobre la imagen curva */
function drawCprRuler(G, vp, f) {
  const c = vp.clip; if (!c || !c.cpr) return;
  const S = c.cpr.src.mprS, s = S.s, ctx = G.ctx, d = G.dpr, M = c.cpr.path.C.length, Hh = (f.h - 1) / 2;
  ctx.save(); ctx.strokeStyle = 'rgba(124,242,154,0.5)'; ctx.fillStyle = 'rgba(124,242,154,0.85)'; ctx.lineWidth = d; ctx.font = `${10 * d}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center';
  for (let mm = 0; mm <= c.cpr.path.len; mm += 10) {
    const a = toScreen(G, { x: mm / s, y: 0 }), b = toScreen(G, { x: mm / s, y: 3 / s });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (mm % 20 === 0) ctx.fillText(`${mm}`, a.x, b.y + 11 * d);
  }
  /* posición del punto central del MPR si cae sobre la línea */
  let bi = -1, bd = 2.5; c.cpr.path.C.forEach((P, i) => { const dd = Math.hypot(P[0] - S.C[0], P[1] - S.C[1], P[2] - S.C[2]); if (dd < bd) { bd = dd; bi = i; } });
  if (bi >= 0) { const a = toScreen(G, { x: bi, y: 0 }), b = toScreen(G, { x: bi, y: f.h }); ctx.strokeStyle = 'rgba(231,178,74,0.8)'; ctx.setLineDash([5 * d, 4 * d]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.restore();
}
/* Ctrl + clic en la imagen curva: lleva los planos al punto de la línea central */
function cprLocate(vp, p) {
  const c = vp.clip; if (!c || !c.cpr) return false;
  const path = c.cpr.path, i = Math.max(0, Math.min(path.C.length - 1, Math.round(p.x))), S = c.cpr.src.mprS;
  S.C = path.C[i].slice();
  for (const o of state.vps) if (o.clip && o.clip.mpr && o.clip.mpr.src === c.cpr.src) o.frame = mprFrameOf(S, o.clip.mpr.plane);
  drawAll(); return true;
}
