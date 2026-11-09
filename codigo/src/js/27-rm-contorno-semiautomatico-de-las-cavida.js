/* ======================= RM: contorno semiautomático de las cavidades =======================
   La sangre es brillante en el cine SSFP: desde el clic se crece la región de píxeles por encima de
   un umbral entre la sangre (alrededor del clic) y el tejido oscuro vecino; los huecos (papilares,
   trabéculas) quedan dentro, igual que en las referencias usadas. */
function segmentCavity(f, seed, frac, asp, maxR) {
  const W = f.w, H = f.h, d = f.data, sl = f.slope, ic = f.intercept, val = i => d[i] * sl + ic;
  let sx = Math.round(seed.x), sy = Math.round(seed.y);
  if (sx < 2 || sy < 2 || sx >= W - 2 || sy >= H - 2) return { err: 'El punto está fuera de la imagen.' };
  const loc = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) loc.push(val((sy + dy) * W + sx + dx));
  loc.sort((a, b) => a - b); const s = loc[12];
  const ring = [];
  for (let y = Math.max(0, Math.floor(sy - maxR / asp)); y <= Math.min(H - 1, Math.ceil(sy + maxR / asp)); y += 2)
    for (let x = Math.max(0, Math.floor(sx - maxR)); x <= Math.min(W - 1, Math.ceil(sx + maxR)); x += 2)
      if (Math.hypot(x - sx, (y - sy) * asp) <= maxR) ring.push(val(y * W + x));
  ring.sort((a, b) => a - b);
  const dk = ring[Math.floor(ring.length * 0.1)] || 0;
  if (!(s - dk > 1)) return { err: 'No hay contraste entre la sangre y el miocardio en ese punto.' };
  const t = dk + (s - dk) * frac;
  if (val(sy * W + sx) < t) {
    let best = -Infinity, bi = -1;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const v = val((sy + dy) * W + sx + dx); if (v > best) { best = v; bi = (sy + dy) * W + sx + dx; } }
    if (best < t) return { err: 'Ese punto no está dentro de una cavidad con sangre brillante.' };
    sx = bi % W; sy = (bi - sx) / W;
  }
  const mask = new Uint8Array(W * H), st = [sy * W + sx]; mask[sy * W + sx] = 1;
  let n = 0, leak = false, x0 = sx, x1 = sx, y0 = sy, y1 = sy;
  while (st.length) {
    const i = st.pop(); n++;
    const x = i % W, y = (i - x) / W;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) { leak = true; continue; }
      const j = ny * W + nx; if (mask[j] || val(j) < t) continue;
      if (Math.hypot(nx - sx, (ny - sy) * asp) > maxR) { leak = true; continue; }
      mask[j] = 1; st.push(j);
    }
  }
  /* rellenar huecos dentro de la caja */
  const bx0 = Math.max(0, x0 - 1), bx1 = Math.min(W - 1, x1 + 1), by0 = Math.max(0, y0 - 1), by1 = Math.min(H - 1, y1 + 1), bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  const out = new Uint8Array(bw * bh), q = [];
  const push = (x, y) => { const k = (y - by0) * bw + (x - bx0); if (!out[k] && !mask[y * W + x]) { out[k] = 1; q.push(k); } };
  for (let x = bx0; x <= bx1; x++) { push(x, by0); push(x, by1); }
  for (let y = by0; y <= by1; y++) { push(bx0, y); push(bx1, y); }
  while (q.length) { const k = q.pop(), x = k % bw + bx0, y = Math.floor(k / bw) + by0; if (x > bx0) push(x - 1, y); if (x < bx1) push(x + 1, y); if (y > by0) push(x, y - 1); if (y < by1) push(x, y + 1); }
  let cxs = 0, cys = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const k = (y - by0) * bw + (x - bx0); if (!out[k] && !mask[y * W + x]) { mask[y * W + x] = 1; n++; } if (mask[y * W + x]) { cxs += x; cys += y; } }
  const pts = traceBoundary(mask, W, H, bx0, by0, bx1, by1);
  const step = Math.max(1, Math.ceil(pts.length / 140));
  const poly = pts.filter((_, i) => i % step === 0).map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
  return { n, leak, poly, cx: cxs / n + 0.5, cy: cys / n + 0.5, t };
}
function traceBoundary(mask, W, H, x0, y0, x1, y1) {
  let sx = -1, sy = -1;
  outer: for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * W + x]) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  const pts = [[sx, sy]]; let cx = sx, cy = sy, b = 4;
  const max = 4 * ((x1 - x0 + 1) * (y1 - y0 + 1)) + 16;
  for (let k = 0; k < max; k++) {
    let f = -1;
    for (let i = 1; i <= 8; i++) { const j = (b + i) % 8; if (at(cx + D[j][0], cy + D[j][1])) { f = j; break; } }
    if (f < 0) break;
    const nx = cx + D[f][0], ny = cy + D[f][1], p = (f + 7) % 8, bx = cx + D[p][0] - nx, by = cy + D[p][1] - ny;
    b = D.findIndex(dd => dd[0] === bx && dd[1] === by); if (b < 0) b = 4;
    cx = nx; cy = ny;
    if (cx === sx && cy === sy) break;
    pts.push([cx, cy]);
  }
  return pts;
}
function polyCentroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; } return { x: x / pts.length, y: y / pts.length }; }
function mrSegFrac() { const R = mrState(state.study); return isNum(R.segThr) ? R.segThr / 100 : 0.5; }
function autoContour(c, frame, seed) {
  const f = c.ready[frame]; if (!f || f.kind !== 'gray') return { err: 'La imagen todavía se está preparando.' };
  const m = c.items[0].m, pxmm = (m.pixelCm || 0) * 10; if (!pxmm) return { err: 'La serie no trae el tamaño del píxel.' };
  const r = segmentCavity(f, seed, mrSegFrac(), m.aspect || 1, 70 / pxmm);
  if (r.err) return r;
  if (r.leak) return { err: 'El contorno se escapó de la cavidad: sube el umbral o traza el contorno a mano.' };
  if (r.poly.length < 6) return { err: 'La región es muy pequeña: baja el umbral o traza el contorno a mano.' };
  return Object.assign(r, { area: r.n * pxAreaMm2(m) / 100 });
}
/* Guarda un contorno de cavidad (manual o automático) como medida con su trazo */
function storeMRC(clip, w, frame, pts, area, cen, batch) {
  const key = mrcKey(clip.slice, w), vals = batch ? null : snapVals([key]), removed = batch ? [] : annosWithKey(key);
  if (batch) batch.keys.push(key); else for (const x of state.clips) x.annos = x.annos.filter(n => n.k !== key);
  state.study.values[key] = { v: area, slice: clip.slice, w, sp: saxSpacing(saxClips()), frame, cx: cen.x, cy: cen.y, at: new Date().toISOString() };
  const anno = { k: key, t: 'area', pts, frame, text: '', col: MRC[w].col };
  clip.annos.push(anno);
  if (batch) batch.adds.push({ clip, anno }); else pushUndo({ type: 'add', clip, anno, removed, vals });
  return anno;
}
async function ensureFrames(c, list) { for (const i of list) if (!c.ready[i]) { try { await requestFrame(c, i); } catch (e) { return false; } } return true; }
/* Telesístole: el cuadro con la cavidad del VI más pequeña en el corte medio */
async function detectES() {
  const L = saxClips(), V = state.study.values, R = mrState(state.study);
  const withEd = L.filter(c => V[mrcKey(c.slice, 'lvn_ed')] && isNum(V[mrcKey(c.slice, 'lvn_ed')].cx));
  if (!withEd.length) { setStatus('Primero marca el endocardio del VI en telediástole en algún corte medio.'); return; }
  const c = withEd[Math.floor(withEd.length / 2)], v = V[mrcKey(c.slice, 'lvn_ed')], n = c.items.length;
  setStatus('Buscando la telesístole…');
  if (!await ensureFrames(c, [...Array(n).keys()])) { setStatus('No se pudieron leer todos los cuadros.'); return; }
  const m = c.items[0].m, pxmm = (m.pixelCm || 0) * 10;
  let best = -1, bn = Infinity, ok = 0;
  for (let k = 0; k < n; k++) { const r = segmentCavity(c.ready[k], { x: v.cx, y: v.cy }, mrSegFrac(), m.aspect || 1, 70 / pxmm); if (!r.err && !r.leak) { ok++; if (r.n < bn) { bn = r.n; best = k; } } }
  if (best < 0 || ok < n / 2) { setStatus('No se pudo detectar la telesístole con seguridad: elígela a mano.'); return; }
  R.es = best; scheduleSave(); renderMRMed(); select(c, best);
  setStatus(`Telesístole detectada en el cuadro ${best + 1} (cavidad más pequeña del corte ${c.slice}).`);
}
/* Completar los cortes que faltan de una cavidad, partiendo del contorno más cercano */
async function autoFill(ch) {
  const L = saxClips(), V = state.study.values, R = mrState(state.study), ws = ch === 'lv' ? ['lvn_ed', 'lvn_es'] : ['rvn_ed', 'rvn_es'];
  if (!isNum(R.es)) { setStatus('Elige o detecta primero la telesístole.'); return; }
  const seeds = L.filter(c => ws.some(w => V[mrcKey(c.slice, w)] && isNum(V[mrcKey(c.slice, w)].cx)));
  if (!seeds.length) { setStatus(`Marca primero un contorno del ${ch === 'lv' ? 'VI' : 'VD'} en algún corte (un clic dentro de la cavidad).`); return; }
  setStatus('Completando los contornos…');
  const batch = { adds: [], keys: [] }, before = {}, skipped = [];
  for (const c of L) for (const w of ws) {
    if (V[mrcKey(c.slice, w)]) continue;
    const near = seeds.slice().sort((a, b) => Math.abs(a.slice - c.slice) - Math.abs(b.slice - c.slice))[0];
    const ref = V[mrcKey(near.slice, w)] || V[mrcKey(near.slice, ws.find(x => V[mrcKey(near.slice, x)]))];
    const frame = MRC[w].ph === 'ed' ? (R.ed || 0) : R.es;
    if (!await ensureFrames(c, [frame])) { skipped.push(c.slice); continue; }
    const r = autoContour(c, frame, { x: ref.cx, y: ref.cy });
    if (r.err || r.area < 0.3 || r.area > ref.v * 4 || r.area < ref.v * 0.12) { skipped.push(c.slice); continue; }
    before[mrcKey(c.slice, w)] = undefined;
    storeMRC(c, w, frame, r.poly, r.area, { x: r.cx, y: r.cy }, batch);
  }
  if (batch.adds.length) pushUndo({ type: 'batch', adds: batch.adds, vals: before });
  scheduleSave(); renderMRMed(); renderReport(); renderContext(); drawAll();
  const sk = [...new Set(skipped)];
  setStatus(`${batch.adds.length} contornos agregados.${sk.length ? ` Revisa a mano los cortes ${sk.join(', ')} (no se pudieron delimitar).` : ''} Ctrl+Z para deshacer.`);
}
