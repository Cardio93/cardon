/* ======================= TC cardíaca: score de calcio (Agatston) y ROI =======================
   Lesión de calcio = región conectada (8 vecinos) ≥ 130 UH en un corte, de al menos 1 mm².
   Agatston = área (mm²) × factor por densidad pico (130–199: 1 · 200–299: 2 · 300–399: 3 · ≥ 400: 4). */
const CAC_ART = {
  tci: { n: 'Tronco coronario izquierdo', s: 'TCI', col: '#e889c8' },
  da: { n: 'Descendente anterior', s: 'DA', col: '#e7b24a' },
  cx: { n: 'Circunfleja', s: 'Cx', col: '#7cc48b' },
  cd: { n: 'Coronaria derecha', s: 'CD', col: '#62a8e6' }
};
const CT_WL = [['Mediastino', 350, 40], ['Angio-TC', 800, 250], ['Calcio', 600, 200], ['Pulmón', 1500, -600], ['Hueso', 2000, 500]];
const huOf = (f, i) => f.data[i] * f.slope + f.intercept;
function pxAreaMm2(m) { const cm = m.pixelCm || 0; return cm > 0 ? (cm * 10) * (cm * 10) * (m.aspect || 1) : 0; }
function agatstonWeight(peak) { return peak >= 400 ? 4 : peak >= 300 ? 3 : peak >= 200 ? 2 : peak >= 130 ? 1 : 0; }
function growCalcium(f, x0, y0) {
  const W = f.w, H = f.h, sx = Math.round(x0), sy = Math.round(y0);
  let seed = -1, bv = 129.999;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = sx + dx, y = sy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H || dx * dx + dy * dy > 16) continue;
    const v = huOf(f, y * W + x); if (v > bv) { bv = v; seed = y * W + x; }
  }
  if (seed < 0) return null;
  const seen = new Uint8Array(W * H), stack = [seed], pix = []; seen[seed] = 1; let peak = -Infinity;
  while (stack.length) {
    const i = stack.pop(); pix.push(i); const v = huOf(f, i); if (v > peak) peak = v;
    if (pix.length > 60000) return { tooBig: true };
    const x = i % W, y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (!seen[j] && huOf(f, j) >= 130) { seen[j] = 1; stack.push(j); }
    }
  }
  return { pix, peak };
}
function clipZStep(c) {
  const zs = c.items.map(it => it.m.z).filter(Number.isFinite);
  if (zs.length > 1) { const d = Math.abs(zs[1] - zs[0]); if (d > 0) return d; }
  return c.m.thick || 0;
}
function cacValues(st) { return Object.entries((st && st.values) || {}).filter(([k]) => k.startsWith('cac_')).map(([k, v]) => Object.assign({ key: k }, v)); }
function computeCAC(st) {
  const L = cacValues(st), by = {};
  for (const a of Object.keys(CAC_ART)) by[a] = { n: 0, score: 0, vol: 0 };
  let total = 0, vol = 0;
  for (const l of L) { const b = by[l.art] || (by[l.art] = { n: 0, score: 0, vol: 0 }); b.n++; b.score += l.v || 0; b.vol += l.vol || 0; total += l.v || 0; vol += l.vol || 0; }
  const N = Object.values(by).filter(b => b.score > 0).length;
  const A = total <= 0 ? 0 : total < 100 ? 1 : total < 300 ? 2 : 3;
  const cat = ['Sin calcio coronario detectable', 'Calcificación coronaria leve', 'Calcificación coronaria moderada', 'Calcificación coronaria severa'][A];
  return { lesions: L, by, total, vol, N, A, drs: A === 0 ? 'CAC-DRS 0' : `CAC-DRS A${A}/N${N}`, cat };
}
function armCac(art) {
  if (state.arm && state.arm.t === 'cac' && state.arm.art === art) { disarm(); return; }
  const A = CAC_ART[art];
  state.arm = { k: null, t: 'cac', art, name: `Calcio · ${A.n}`, help: 'Haz clic sobre cada placa de calcio de esta arteria, corte por corte. Esc para terminar.', pts: [], err: '' };
  startArm();
}
function finishCac(a, c) {
  const f = c.ready[state.frame], fail = msg => { a.err = msg; a.pts = []; updateHint(); draw(); };
  if (c.mpr || c.cpr) return fail('El score de calcio se marca en la serie axial original (en la lista de secuencias), no en el MPR.');
  if (!f || f.kind !== 'gray') return fail('La imagen todavía se está preparando.');
  const m = curItem().m, pxA = pxAreaMm2(m);
  if (!pxA) return fail('Esta serie no trae el tamaño del píxel; no se puede calcular el área.');
  const r = growCalcium(f, a.pts[0].x, a.pts[0].y);
  if (!r) return fail('No hay calcio (≥ 130 UH) en ese punto.');
  const area = r.tooBig ? Infinity : r.pix.length * pxA;
  if (area > 300) return fail('La región es demasiado grande (más de 3 cm²): probablemente es hueso, la pared aórtica o contraste.');
  if (area < 1) return fail('Lesión menor de 1 mm²: el método de Agatston no la cuenta.');
  const W = f.w, set = new Set(r.pix);
  let x0 = W, y0 = f.h, x1 = 0, y1 = 0;
  for (const i of r.pix) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const removed = [];
  c.annos.forEach((n, idx) => { if (n.t === 'cac' && n.frame === state.frame && n.pix && n.pix.some(i => set.has(i))) removed.push({ clip: c, anno: n, idx }); });
  const key = 'cac_' + newSid(), vals = snapVals([key].concat(removed.map(x => x.anno.k)));
  for (const x of removed) { c.annos = c.annos.filter(n => n !== x.anno); delete state.study.values[x.anno.k]; }
  const w = agatstonWeight(r.peak), score = area * w, vol = area * clipZStep(c);
  state.study.values[key] = { v: score, art: a.art, area, peak: r.peak, vol, slice: state.frame + 1, at: new Date().toISOString() };
  const anno = { k: key, t: 'cac', art: a.art, pix: Int32Array.from(r.pix), W, pts: [{ x: x0 - 1, y: y0 - 1 }, { x: x1 + 2, y: y1 + 2 }], frame: state.frame, text: `${CAC_ART[a.art].s} ${dec(score, 0)}` };
  c.annos.push(anno);
  pushUndo({ type: 'add', clip: c, anno, removed, vals });
  a.pts = []; a.err = ''; updateHint();
  scheduleSave(); renderCTMed(); renderReport(); renderContext(); drawClipViews(c);
  setStatus(`${CAC_ART[a.art].n}: lesión de ${dec(area, 1)} mm², pico ${Math.round(r.peak)} UH, Agatston ${dec(score, 1)}. Haz clic en otra lesión o Esc para terminar.`);
}
function drawCac(G, a, sel) {
  const art = CAC_ART[a.art] || CAC_ART.da;
  if (!a._cv) {
    const bx = a.pts[0].x, by = a.pts[0].y, bw = a.pts[1].x - bx, bh = a.pts[1].y - by;
    const cv = document.createElement('canvas'); cv.width = Math.max(1, bw); cv.height = Math.max(1, bh);
    const g = cv.getContext('2d'), img = g.createImageData(cv.width, cv.height), col = art.col;
    const R = parseInt(col.slice(1, 3), 16), Gc = parseInt(col.slice(3, 5), 16), B = parseInt(col.slice(5, 7), 16);
    for (const i of a.pix) { const x = i % a.W - bx, y = (i - (i % a.W)) / a.W - by, q = (y * cv.width + x) * 4; img.data[q] = R; img.data[q + 1] = Gc; img.data[q + 2] = B; img.data[q + 3] = 210; }
    g.putImageData(img, 0, 0); a._cv = cv;
  }
  const p0 = toScreen(G, a.pts[0]), p1 = toScreen(G, a.pts[1]);
  G.ctx.imageSmoothingEnabled = false; G.ctx.drawImage(a._cv, p0.x, p0.y, p1.x - p0.x, p1.y - p0.y); G.ctx.imageSmoothingEnabled = true;
  if (sel) { G.ctx.strokeStyle = '#ffd77a'; G.ctx.lineWidth = 1.5 * G.dpr; G.ctx.strokeRect(p0.x - 2 * G.dpr, p0.y - 2 * G.dpr, p1.x - p0.x + 4 * G.dpr, p1.y - p0.y + 4 * G.dpr); }
  if (a.text) label(G, a.pts[1], a.text, sel ? '#ffd77a' : art.col);
}
/* Resaltado de todo lo que supera 130 UH en el corte (ayuda a encontrar el calcio) */
function cacOverlay(f) {
  if (f._cac) return f._cac;
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const g = cv.getContext('2d'), img = g.createImageData(f.w, f.h), d = img.data, n = f.w * f.h;
  for (let i = 0; i < n; i++) if (huOf(f, i) >= 130) { const q = i * 4; d[q] = 236; d[q + 1] = 72; d[q + 2] = 200; d[q + 3] = 120; }
  g.putImageData(img, 0, 0); f._cac = cv; return cv;
}
/* ROI circular: valor medio (UH en TC; ms o unidades del mapa en RM) */
function roiStats(c, frame, p0, p1) {
  const f = c.ready[frame]; if (!f || f.kind !== 'gray') throw new Error('Solo en imágenes en escala de grises (TC o RM).');
  const asp = c.m.aspect || 1, r = Math.hypot(p1.x - p0.x, (p1.y - p0.y) * asp);
  if (r < 1.5) throw new Error('El círculo es muy pequeño.');
  const W = f.w, H = f.h, vals = [];
  for (let y = Math.max(0, Math.floor(p0.y - r / asp)); y <= Math.min(H - 1, Math.ceil(p0.y + r / asp)); y++)
    for (let x = Math.max(0, Math.floor(p0.x - r)); x <= Math.min(W - 1, Math.ceil(p0.x + r)); x++)
      if (Math.hypot(x - p0.x, (y - p0.y) * asp) <= r) vals.push(huOf(f, y * W + x));
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length, sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1));
  const pxA = pxAreaMm2(curItem().m);
  return { mean, sd, n: vals.length, area: pxA ? vals.length * pxA / 100 : null, unit: clipKind(c) === 'tc' ? 'UH' : '' };
}
function roiText(s, n) { return `${n}  ${s.unit ? `${dec(s.mean, 0)} ${s.unit}` : dec(s.mean, 0)} ± ${dec(s.sd, 0)}${s.area ? ` · ${dec(s.area, 2)} cm²` : ''}`; }
function roiPoly(p0, p1, asp) { const r = Math.hypot(p1.x - p0.x, (p1.y - p0.y) * asp), out = []; for (let i = 0; i <= 32; i++) { const t = i / 32 * 2 * Math.PI; out.push({ x: p0.x + r * Math.cos(t), y: p0.y + r * Math.sin(t) / asp }); } return out; }
function huUnder(vp, cx, cy) {
  const c = vp.clip; if (!c || !vp.tf || clipKind(c) !== 'tc') return '';
  const f = c.ready[vp.frame]; if (!f || f.kind !== 'gray') return '';
  const p = toImage(vp, cx, cy), x = Math.floor(p.x), y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return '';
  return `${Math.round(huOf(f, y * f.w + x))} UH`;
}
