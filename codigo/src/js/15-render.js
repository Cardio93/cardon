/* ======================= Render ======================= */
const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d');
let scratchImg = null, scratchKey = '';
function grayCanvas(c, f, i) {
  const v = c.view, wl = v.wl || { c: 128, w: 256 };
  const key = `${c.id}:${i}:${wl.c}:${wl.w}:${v.invert}`;
  if (key === scratchKey && scratch.width === f.w && scratch.height === f.h) return scratch;
  if (scratch.width !== f.w || scratch.height !== f.h || !scratchImg) { scratch.width = f.w; scratch.height = f.h; scratchImg = sctx.createImageData(f.w, f.h); }
  const d = scratchImg.data, src = f.data, n = f.w * f.h;
  const w = Math.max(2, wl.w), k = 255 / (w - 1), base = wl.c - 0.5 - (w - 1) / 2;
  const sl = f.slope, ic = f.intercept, inv = f.mono1 !== v.invert;
  for (let p = 0, q = 0; p < n; p++, q += 4) {
    let o = (src[p] * sl + ic - base) * k;
    if (inv) o = 255 - o;
    d[q] = o; d[q + 1] = o; d[q + 2] = o; d[q + 3] = 255;
  }
  sctx.putImageData(scratchImg, 0, 0);
  scratchKey = key;
  return scratch;
}
function drawThumb(c, f, i) {
  const t = c.thumb, tc = t.getContext('2d');
  tc.fillStyle = '#000'; tc.fillRect(0, 0, t.width, t.height);
  const src = f.kind === 'gray' ? grayCanvas(c, f, i) : f.bmp;
  const ih = f.h * (c.m.aspect || 1), s = Math.min(t.width / f.w, t.height / ih);
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(src, (t.width - f.w * s) / 2, (t.height - ih * s) / 2, f.w * s, ih * s);
  const first = !c.thumbDone; c.thumbDone = true;
  if (first && c.slices > 1 && state.grpEls && state.grpEls.size) groupList();
}
function showMsg(vp, text, isErr) { vp.msg.hidden = !text; vp.msg.classList.toggle('err', !!isErr); vp.msgText.textContent = text || ''; }
function curItem(vp = AV()) { const c = vp && vp.clip; return c ? (c.items[vp.frame] || c.items[0]) : null; }
function measureCtx(vp = AV()) {
  const c = vp.clip, it = curItem(vp);
  return { regions: (it && it.m.regions) || [], cal: c && c.cal, dop: c && c.dop, baseOverride: c ? c.baseOverride : {}, aspect: (c && c.m.aspect) || 1, pixelCm: it && it.m.pixelCm, angle: c && c.angle };
}
function imageSource(G, c, f, i) {
  const v = c.view, enh = v.enh ? `url(#f_${v.enh})` : '';
  if (f.kind === 'gray') { if (enh) G.ctx.filter = enh; return grayCanvas(c, f, i); }
  const fl = `brightness(${v.bc.b}) contrast(${v.bc.c})${v.invert ? ' invert(1)' : ''}`;
  if (fl !== 'brightness(1) contrast(1)' || enh) G.ctx.filter = (fl !== 'brightness(1) contrast(1)' ? fl + ' ' : '') + enh;
  return f.bmp;
}
function refreshEnh() { const c = state.cur, e = (c && c.view.enh) || ''; document.querySelectorAll('[data-enh]').forEach(b => b.setAttribute('aria-pressed', b.dataset.enh === e ? 'true' : 'false')); }
document.querySelectorAll('[data-enh]').forEach(b => b.addEventListener('click', () => { const c = state.cur; if (!c) return; c.view.enh = b.dataset.enh; refreshEnh(); drawClipViews(c); setStatus(c.view.enh ? (c.view.enh === 'sharp' ? 'Realce de nitidez aplicado a esta secuencia.' : 'Suavizado aplicado a esta secuencia.') : 'Imagen original, sin realce.'); }));
function drawVP(vp) {
  if (!vp) return;
  const W = vp.canvas.width, H = vp.canvas.height, ctx = vp.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const c = vp.clip;
  vp.tf = null;
  vp.tag.hidden = !(c && c.foreign);
  if (c && c.foreign) vp.tag.textContent = `Estudio del ${isoToShow(c.foreign.date)}`;
  if (vp === AV()) updateTransport();
  if (!c) {
    showMsg(vp, state.study && state.study.id && !state.study.hasImages ? 'Este estudio no tiene imágenes guardadas en este computador. Usa «Agregar imágenes» para abrirlas.' : (state.vps.length > 1 ? 'Elige una secuencia de la lista para esta ventana.' : 'No hay imágenes abiertas. Usa «Agregar imágenes» o vuelve al inicio.'));
    overlays(vp, null); drawECG(vp); return;
  }
  if (c.err) { showMsg(vp, c.err, true); overlays(vp, null); drawECG(vp); return; }
  let f = c.ready[vp.frame];
  /* Cuadro aún no listo (p. ej. planos MPR, que se generan al pedirlos): se muestra el anterior y se pide este */
  if (f) c.lastShown = f; else { f = c.lastShown; if (f && !c.pending[vp.frame]) requestFrame(c, vp.frame).catch(() => {}); }
  if (!f) { showMsg(vp, `Preparando imágenes… ${c.loaded}/${c.items.length}`); overlays(vp, null); requestFrame(c, vp.frame).catch(() => {}); drawECG(vp); return; }
  showMsg(vp, '');
  const v = c.view, asp = c.m.aspect || 1;
  const ih = f.h * asp, ref = state.fit === 'fit' ? ecoRef(c, f.w, ih) : null;
  const fit = state.fit === 'fill' ? Math.max(W / f.w, H / ih) : state.fit === 'real' ? state.dpr : ref ? Math.min(W / ref.w, H / ref.h) : Math.min(W / f.w, H / ih), sc = fit * v.zoom;
  const dw = f.w * sc, dh = ih * sc;
  const x = (W - dw) / 2 + v.panX * state.dpr, y = (H - dh) / 2 + v.panY * state.dpr;
  vp.tf = { x, y, sc, asp };
  const G = { ctx, tf: vp.tf, dpr: state.dpr, w: W, h: H };
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const src = imageSource(G, c, f, c.ready[vp.frame] ? vp.frame : -1);
  ctx.drawImage(src, x, y, dw, dh);
  ctx.filter = 'none';
  if (state.cacHi && f.kind === 'gray' && clipKind(c) === 'tc' && c.ready[vp.frame]) { ctx.imageSmoothingEnabled = false; ctx.drawImage(cacOverlay(c.ready[vp.frame]), x, y, dw, dh); ctx.imageSmoothingEnabled = true; }
  drawMasks(G, c, true);
  drawMprRefs(G, vp, f);
  drawCprRuler(G, vp, f);
  drawAnnotations(G, vp);
  overlays(vp, f);
  drawECG(vp);
  for (const o of state.vps) if (o !== vp && o.clip && o.clip.mm && o.clip.mm.src === c) drawVP(o);
  if (c.vol || c.mpr) redrawMprPeers(vp);
}
function drawAll() { state.vps.forEach(drawVP); }
/* Eco: las imágenes fijas más pequeñas que los clips del estudio se muestran a la misma escala que los clips,
   en vez de agrandarlas hasta llenar la ventana (así no parecen ampliadas). */
function ecoRef(c, w, h) {
  if (!c || c.mm || c.items.length > 1 || clipKind(c) !== 'eco') return null;
  let rw = 0, rh = 0;
  for (const o of state.clips) {
    if (o === c || o.mm || o.items.length < 2 || o.foreign !== c.foreign || clipKind(o) !== 'eco') continue;
    const m = o.items[0].m; if (!m.cols || !m.rows) continue;
    rw = Math.max(rw, m.cols); rh = Math.max(rh, m.rows * (m.aspect || 1));
  }
  if (!rw || !rh || (w >= rw * 0.98 && h >= rh * 0.98)) return null;
  return { w: Math.max(rw, w), h: Math.max(rh, h) };
}
/* ---- Memoria: descarta los cuadros decodificados de secuencias que no se están viendo ---- */
const MEM_KEEP = 2, MEM_BUDGET = 900e6;
function clipBytes(c) { const m = c.items[0].m; return c.loaded * (m.cols || 0) * (m.rows || 0) * 4; }
function evictClip(c) {
  if (!c || c.items.some(it => it.pre)) return;
  c.epoch = (c.epoch || 0) + 1;
  for (const f of c.ready) if (f && f.bmp && f.bmp.close) { try { f.bmp.close(); } catch (e) {} }
  c.ready = new Array(c.items.length); c.pending = new Array(c.items.length);
  c.loaded = 0; c.lastShown = null; c.preloading = false;
  updateItemStatus(c);
}
function manageMemory() {
  const now = performance.now(), visible = new Set();
  for (const vp of state.vps) if (vp.clip) { visible.add(vp.clip); if (vp.clip.mm) visible.add(vp.clip.mm.src); }
  for (const c of visible) c.lastSeen = now;
  const hidden = state.clips.filter(c => !visible.has(c) && c.loaded > 0 && !c.items.some(it => it.pre)).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  let total = state.clips.reduce((t, c) => t + clipBytes(c), 0);
  hidden.forEach((c, i) => { if (i >= MEM_KEEP || total > MEM_BUDGET) { total -= clipBytes(c); evictClip(c); } });
}
function draw() { drawVP(AV()); }
function drawClipViews(c) { for (const vp of state.vps) if (vp.clip === c) drawVP(vp); }

const toScreen = (G, p) => ({ x: G.tf.x + p.x * G.tf.sc, y: G.tf.y + p.y * G.tf.sc * G.tf.asp });
function toImage(vp, clientX, clientY) {
  const r = vp.el.getBoundingClientRect(), t = vp.tf;
  const sx = (clientX - r.left) * state.dpr, sy = (clientY - r.top) * state.dpr;
  return { x: (sx - t.x) / t.sc, y: (sy - t.y) / (t.sc * t.asp) };
}
const AMBER = '#e7b24a', CYAN = '#62c6c4', ECGC = '#7cc48b', FREEC = '#eef3f1';
function strokePath(G, pts, color, close, dash) {
  if (pts.length < 2) return;
  const ctx = G.ctx;
  ctx.beginPath();
  pts.forEach((p, i) => { const s = toScreen(G, p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
  if (close) ctx.closePath();
  ctx.setLineDash((dash || []).map(d => d * G.dpr)); ctx.strokeStyle = color; ctx.lineWidth = (G.lw || 1.6) * G.dpr; ctx.stroke(); ctx.setLineDash([]);
}
function cross(G, p, color) {
  const s = toScreen(G, p), r = 5 * G.dpr, ctx = G.ctx;
  ctx.beginPath(); ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x, s.y + r);
  ctx.strokeStyle = color; ctx.lineWidth = (G.lw || 1.6) * G.dpr; ctx.stroke();
}
function label(G, p, text, color) {
  const s = toScreen(G, p), d = G.dpr, ctx = G.ctx, lines = String(tr(text)).split('\n'), lh = 16 * d;
  ctx.font = `${12 * d}px "IBM Plex Mono", ui-monospace, monospace`;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width));
  let x = s.x + 8 * d, y = s.y - 8 * d - (lines.length - 1) * lh;
  if (x + w + 8 * d > G.w) x = s.x - w - 12 * d;
  if (x < 4 * d) x = 4 * d;
  if (y < 16 * d) y = s.y + 18 * d;
  if (G.anno && G.boxes) G.boxes.push({ a: G.anno, x: x - 4 * d, y: y - 13 * d, w: w + 8 * d, h: lh * lines.length + 2 * d });
  if (G.selBox) { ctx.strokeStyle = '#ffd77a'; ctx.lineWidth = 1.5 * d; ctx.strokeRect(x - 4 * d, y - 13 * d, w + 8 * d, lh * lines.length + 2 * d); }
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(x - 4 * d, y - 13 * d, w + 8 * d, lh * lines.length + 2 * d);
  ctx.fillStyle = color; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}
/* Texto libre del usuario: no pasa por la traducción */
function noteLabel(G, p, text, color) {
  const s = toScreen(G, p), d = G.dpr, ctx = G.ctx, lines = String(text).split('\n'), lh = 18 * d;
  ctx.font = `600 ${13.5 * d}px "IBM Plex Sans", system-ui, sans-serif`;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)), bw = w + 12 * d, bh = lh * lines.length + 4 * d;
  let x = s.x, y = s.y - bh / 2;
  if (x + bw > G.w - 4 * d) x = G.w - 4 * d - bw; if (x < 4 * d) x = 4 * d;
  if (y < 4 * d) y = 4 * d; if (y + bh > G.h - 4 * d) y = G.h - 4 * d - bh;
  if (G.anno && G.boxes) G.boxes.push({ a: G.anno, x, y, w: bw, h: bh });
  ctx.fillStyle = 'rgba(0,0,0,0.70)'; ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = G.selBox ? '#ffd77a' : color; ctx.lineWidth = (G.selBox ? 1.6 : 1) * d; ctx.strokeRect(x + 0.5 * d, y + 0.5 * d, bw - d, bh - d);
  ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, x + 6 * d, y + 2 * d + lh * (i + 0.72)));
}
function drawShape(G, type, pts, color, text) {
  if (!pts || !pts.length) return;
  if (type === 'arrow' && pts.length === 2) {
    const a = toScreen(G, pts[0]), b = toScreen(G, pts[1]), ang = Math.atan2(b.y - a.y, b.x - a.x), L = (G.lw ? 15 : 12) * G.dpr, ctx = G.ctx;
    const e = { x: b.x - L * 0.6 * Math.cos(ang), y: b.y - L * 0.6 * Math.sin(ang) };
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.strokeStyle = color; ctx.lineWidth = (G.lw || 2.2) * G.dpr; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - L * Math.cos(ang - 0.42), b.y - L * Math.sin(ang - 0.42)); ctx.lineTo(b.x - L * Math.cos(ang + 0.42), b.y - L * Math.sin(ang + 0.42)); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    if (text) label(G, pts[0], text, color);
    return;
  }
  if (type === 'note') { if (text) noteLabel(G, pts[0], text, color); return; }
  if (type === 'qca' && pts.length >= 6) {
    const n = pts.length >> 1, Lp = pts.slice(0, n), Rp = pts.slice(n);
    strokePath(G, Lp, color, false); strokePath(G, Rp, color, false);
    let km = Math.round(n * 0.15), bd = Infinity; for (let k = Math.round(n * 0.15); k <= Math.round(n * 0.85); k++) { const d = Math.hypot(Lp[k].x - Rp[k].x, (Lp[k].y - Rp[k].y) * G.tf.asp); if (d < bd) { bd = d; km = k; } }
    if (!G.lw) { const a = toScreen(G, Lp[km]), b = toScreen(G, Rp[km]), ctx = G.ctx; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#ff6b5e'; ctx.lineWidth = 2.4 * G.dpr; ctx.stroke(); }
    if (text) label(G, Rp[km], text, color);
    return;
  }
  if (type === 'mline') {
    strokePath(G, pts, color, false, [7, 5]);
    cross(G, pts[0], color);
    const a = toScreen(G, pts[0]), b = toScreen(G, pts[1]), ang = Math.atan2(b.y - a.y, b.x - a.x), L = 9 * G.dpr;
    G.ctx.beginPath(); G.ctx.moveTo(b.x, b.y); G.ctx.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45)); G.ctx.moveTo(b.x, b.y); G.ctx.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); G.ctx.strokeStyle = color; G.ctx.lineWidth = 1.6 * G.dpr; G.ctx.stroke();
    if (text) label(G, pts[1], text, color);
    return;
  }
  if (type === 'roi' && pts.length === 2) {
    const a = toScreen(G, pts[0]), r = Math.hypot(pts[1].x - pts[0].x, (pts[1].y - pts[0].y) * G.tf.asp) * G.tf.sc;
    G.ctx.beginPath(); G.ctx.arc(a.x, a.y, Math.max(1, r), 0, Math.PI * 2); G.ctx.strokeStyle = color; G.ctx.lineWidth = (G.lw || 1.6) * G.dpr; G.ctx.stroke();
    cross(G, pts[0], color);
    if (text) label(G, { x: pts[0].x + Math.hypot(pts[1].x - pts[0].x, (pts[1].y - pts[0].y) * G.tf.asp) * 0.72, y: pts[0].y - Math.hypot(pts[1].x - pts[0].x, (pts[1].y - pts[0].y) * G.tf.asp) * 0.72 / G.tf.asp }, text, color);
    return;
  }
  if (type === 'sten') {
    const segs = [pts.slice(0, 2), pts.slice(2, 4)].filter(q => q.length === 2);
    segs.forEach(q => { strokePath(G, q, color, false); cross(G, q[0], color); cross(G, q[1], color); });
    if (text && segs.length) label(G, segs[segs.length - 1][1], text, color);
    return;
  }
  if (type === 'dist' || type === 'time' || type === 'cal' || type === 'slope') {
    let q = pts;
    if (type === 'time') q = [pts[0], { x: pts[1].x, y: pts[0].y }];
    strokePath(G, q, color, false, type === 'cal' ? [6, 4] : null); cross(G, q[0], color); cross(G, q[q.length - 1], color);
    if (text) label(G, q[q.length - 1], text, color);
  } else if (type === 'vel' || type === 'base' || type === 'dopcal') {
    for (const p of pts) cross(G, p, color);
    if (text) label(G, pts[pts.length - 1], text, color);
  } else if (type === 'trace') {
    strokePath(G, pts, color, false);
    if (pts.length > 2) {
      strokePath(G, [pts[pts.length - 1], pts[0]], color, false, [5, 4]);
      const asp = G.tf.asp;
      const g = contourGeometry(pts.map(p => ({ x: p.x, y: p.y * asp })));
      const mid = { x: g.mid.x, y: g.mid.y / asp }, ap = { x: g.apex.x, y: g.apex.y / asp };
      strokePath(G, [mid, ap], color, false, [3, 4]);
      if (text) label(G, ap, text, color);
    }
  } else if (type === 'vti') {
    strokePath(G, pts, color, false);
    if (text) label(G, pts[pts.length - 1], text, color);
  } else if (type === 'area') {
    strokePath(G, pts, color, pts.length > 2);
    if (text) label(G, pts[pts.length - 1], text, color);
  } else if (type === 'mask' && pts.length === 2) {
    const a = toScreen(G, pts[0]), b = toScreen(G, pts[1]);
    G.ctx.setLineDash([5 * G.dpr, 4 * G.dpr]); G.ctx.strokeStyle = color; G.ctx.lineWidth = 1.4 * G.dpr;
    G.ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); G.ctx.setLineDash([]);
  }
}
function drawMasks(G, c, outline) {
  for (const r of c.masks) {
    const a = toScreen(G, { x: r.x0, y: r.y0 }), b = toScreen(G, { x: r.x1, y: r.y1 });
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    G.ctx.fillStyle = '#000'; G.ctx.fillRect(x, y, w, h);
    if (outline) { G.ctx.setLineDash([3 * G.dpr, 3 * G.dpr]); G.ctx.strokeStyle = 'rgba(231,178,74,0.5)'; G.ctx.lineWidth = G.dpr; G.ctx.strokeRect(x, y, w, h); G.ctx.setLineDash([]); }
  }
}
function drawAnnotations(G, vp) {
  const c = vp.clip; if (!c || !G.tf) return;
  const armed = vp === AV() ? state.arm : null;
  if (armed && armed.t !== 'cal' && armed.t !== 'dopcal' && armed.t !== 'mask') {
    const regs = (curItem(vp).m.regions || []);
    regs.forEach((r, i) => {
      const a = toScreen(G, { x: r.x0, y: r.y0 }), b = toScreen(G, { x: r.x1, y: r.y1 });
      G.ctx.setLineDash([2 * G.dpr, 4 * G.dpr]); G.ctx.strokeStyle = 'rgba(98,198,196,0.45)'; G.ctx.lineWidth = G.dpr; G.ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); G.ctx.setLineDash([]);
      if (r.fmt === 3) {
        const by = toScreen(G, { x: 0, y: baselineY(r, i, c) }).y;
        G.ctx.setLineDash([8 * G.dpr, 5 * G.dpr]); G.ctx.strokeStyle = CYAN; G.ctx.lineWidth = 1.4 * G.dpr;
        G.ctx.beginPath(); G.ctx.moveTo(a.x, by); G.ctx.lineTo(b.x, by); G.ctx.stroke(); G.ctx.setLineDash([]);
        label(G, { x: r.x0, y: baselineY(r, i, c) }, 'línea de base', CYAN);
      }
    });
    if (c.dop && !regs.some(r => r.fmt === 3)) {
      const by = toScreen(G, { x: 0, y: c.dop.baseY }).y;
      G.ctx.setLineDash([8 * G.dpr, 5 * G.dpr]); G.ctx.strokeStyle = CYAN; G.ctx.beginPath(); G.ctx.moveTo(0, by); G.ctx.lineTo(G.w, by); G.ctx.stroke(); G.ctx.setLineDash([]);
    }
  }
  vp.boxes = []; G.boxes = vp.boxes;
  const sel = state.sel && state.sel.clip === c ? state.sel.anno : null;
  for (const a of c.annos) if (a.frame === vp.frame || a.all) {
    const P = a.track && a.track[vp.frame] ? a.pts.map(p => ({ x: p.x + a.track[vp.frame][0], y: p.y + a.track[vp.frame][1] })) : a.pts;
    if (a === sel && a.t !== 'cac') { G.lw = 7; drawShape(G, a.t, P, 'rgba(255,215,122,0.30)', ''); G.lw = 0; }
    G.anno = a; G.selBox = a === sel;
    if (a.t === 'cac') drawCac(G, a, a === sel);
    else drawShape(G, a.t, P, a === sel ? '#ffd77a' : a.col || (a.t === 'mline' ? CYAN : a.free ? FREEC : AMBER), a.text);
    G.anno = null; G.selBox = false;
  }
  if (c.mm) {
    const src = state.vps.find(o => o.clip === c.mm.src);
    const n = c.mm.n, r = c.mm.r, H = c.items[0].m.rows;
    if (c.mm.src.cyc) for (const e of c.mm.src.cyc.ed) { const s0 = toScreen(G, { x: (e + 0.5) * r, y: 0 }); G.ctx.fillStyle = CYAN; G.ctx.beginPath(); G.ctx.moveTo(s0.x - 4 * G.dpr, s0.y); G.ctx.lineTo(s0.x + 4 * G.dpr, s0.y); G.ctx.lineTo(s0.x, s0.y + 6 * G.dpr); G.ctx.fill(); }
    if (src && n) { const a = toScreen(G, { x: (src.frame + 0.5) * r, y: 0 }), b = toScreen(G, { x: (src.frame + 0.5) * r, y: H }); G.ctx.strokeStyle = 'rgba(231,178,74,0.75)'; G.ctx.lineWidth = 1.2 * G.dpr; G.ctx.beginPath(); G.ctx.moveTo(a.x, a.y); G.ctx.lineTo(b.x, b.y); G.ctx.stroke(); }
  }
  if (armed && armed.ref) drawShape(G, 'sten', armed.ref, CYAN, 'Referencia');
  if (armed && armed.pts && armed.pts.length) drawShape(G, armed.t === 'sten' ? 'dist' : armed.t === 'qca' ? 'vti' : armed.t, armed.pts, CYAN, armed.live || '');
  if (armed && armed.clicks && armed.clicks.length) armed.clicks.forEach(q => cross(G, q, CYAN));
}
function setOv(vp, key, lines) { const t = lines.filter(Boolean).join('\n'); if (vp.ovCache[key] !== t) { vp.ovCache[key] = t; vp.ov[key].textContent = t; } }
function overlays(vp, f) {
  const c = vp.clip;
  if (!c || !state.info) { for (const k of ['tl', 'tr', 'bl', 'br']) setOv(vp, k, []); return; }
  const m = curItem(vp).m, v = c.view, n = c.items.length;
  const showHdr = state.hdr || clipKind(c) !== 'eco';
  setOv(vp, 'tl', showHdr ? [[m.modality, m.seriesDesc].filter(Boolean).join(' · '), angText(m), m.manufacturer, fmtDate(m.date)] : (clipKind(c) === 'angio' ? [angText(m)] : []));
  setOv(vp, 'tr', state.patient ? [m.patientName || 'Paciente sin nombre', m.patientId ? `ID ${m.patientId}` : ''] : []);
  if (c.mpr && c.mpr.src.mprS) { const S = c.mpr.src.mprS, pl = c.mpr.plane, obl = Math.max(...S.n[pl].map(Math.abs)) < 0.9995; setOv(vp, 'bl', [`${MPR_NAME[pl]}${obl ? ' oblicuo' : ''}`, `Posición ${fmtNum(+mprT(S, pl, vp.frame).toFixed(1))} mm`, S.slab && S.slab.mm ? `${SLAB_MODES[S.slab.mode]} ${S.slab.mm} mm` : `Píxel ${fmtNum(+S.s.toFixed(2))} mm`]); }
  else if (c.cpr) setOv(vp, 'bl', ['Reconstrucción curva', `Giro ${vp.frame * 360 / CPR_ANGLES}°`, `Longitud ${fmtNum(Math.round(c.cpr.path.len))} mm`]);
  else if (c.stack) setOv(vp, 'bl', [`Corte ${vp.frame + 1}/${n}`, Number.isFinite(m.z) ? `z ${fmtNum(m.z)} mm` : '', m.thick ? `Espesor ${fmtNum(m.thick)} mm` : '']);
  else if (clipKind(c) === 'eco') setOv(vp, 'bl', [c.slices ? `Corte ${c.slice}/${c.slices}` : '']); else setOv(vp, 'bl', [
    n > 1 ? `Cuadro ${vp.frame + 1}/${n}` : 'Imagen única',
    n > 1 ? `${fmtNum(c.fps * state.speed)} fps${state.speed !== 1 ? ` (×${fmtNum(state.speed)})` : ''}` : '',
    c.cyc && c.cyc.rr ? `FC ${Math.round(60000 / c.cyc.rr)} lpm` : (m.hr ? `FC ${Math.round(m.hr)} lpm` : ''),
    c.slices ? `Corte ${c.slice}/${c.slices}` : ''
  ]);
  const d0 = c.wlDefault, gray = f && f.kind === 'gray' && v.wl;
  const wlChanged = gray ? !!(d0 && (Math.abs(v.wl.w - d0.w) > 0.5 || Math.abs(v.wl.c - d0.c) > 0.5)) : (Math.abs(v.bc.b - 1) > 0.005 || Math.abs(v.bc.c - 1) > 0.005);
  const wlText = !wlChanged && !(gray && clipKind(c) === 'tc') ? '' : gray ? `Ventana ${Math.round(v.wl.w)} · Nivel ${Math.round(v.wl.c)}` : `Brillo ${Math.round(v.bc.b * 100)}% · Contraste ${Math.round(v.bc.c * 100)}%`;
  setOv(vp, 'br', [vp.huText || '', c.angle ? `Ángulo ${c.angle}°` : '', wlText, Math.abs(v.zoom - 1) > 0.005 ? `Zoom ${Math.round(v.zoom * 100)}%` : '', state.fit !== 'fit' ? (state.fit === 'real' ? 'Tamaño 1:1' : 'Llenar') : '', v.invert ? 'Invertido' : '']);
}
function drawECG(vp) {
  const c = vp.clip, cv = vp.ecgCv, g = cv.getContext('2d');
  const ecg = c && c.cyc && c.cyc.ecg;
  const show = !!(state.ecgOn && c && !c.err && ecg);
  cv.hidden = !show; vp.el.classList.toggle('has-ecg', show);
  if (!show) return;
  const W = cv.width, H = cv.height, d = state.dpr, t = c.cyc.times, T = t[t.length - 1] || 1;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
  const s = ecg.s, fs = ecg.fs;
  const i0 = Math.max(0, Math.floor((0 - ecg.t0) / 1000 * fs)), i1 = Math.min(s.length - 1, Math.ceil((T - ecg.t0) / 1000 * fs));
  let lo = Infinity, hi = -Infinity; for (let k = i0; k <= i1; k++) { if (s[k] < lo) lo = s[k]; if (s[k] > hi) hi = s[k]; }
  if (!(hi > lo)) return;
  const X = ms => 6 * d + (W - 12 * d) * ms / T, Y = v => H - 4 * d - (H - 8 * d) * (v - lo) / (hi - lo);
  g.beginPath();
  const step = Math.max(1, Math.floor((i1 - i0) / (W * 1.5)));
  for (let k = i0; k <= i1; k += step) { const x = X(ecg.t0 + k / fs * 1000), y = Y(s[k]); if (k === i0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.strokeStyle = ECGC; g.lineWidth = 1.3 * d; g.stroke();
  for (const e of c.cyc.ed) { const x = X(t[e]); g.fillStyle = CYAN; g.beginPath(); g.moveTo(x - 4 * d, 0); g.lineTo(x + 4 * d, 0); g.lineTo(x, 6 * d); g.fill(); }
  const cx = X(t[vp.frame] || 0);
  g.strokeStyle = AMBER; g.lineWidth = 1.5 * d; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
}
function updateTransport() {
  const vp = AV(), c = vp && vp.clip, n = c ? c.items.length : 0, idx = state.clips.indexOf(c);
  els.scrub.max = Math.max(0, n - 1);
  if (+els.scrub.value !== state.frame) els.scrub.value = state.frame;
  els.frameLabel.textContent = n ? `${state.frame + 1} / ${n}` : '0 / 0';
  const fi = $('frameInfo');
  if (fi) { const hr = c && (c.cyc && c.cyc.rr ? Math.round(60000 / c.cyc.rr) : (c.items[0].m.hr ? Math.round(c.items[0].m.hr) : 0)); fi.textContent = c && n > 1 && !c.stack ? `${fmtNum(c.fps * state.speed)} fps${hr ? ` · ${hr} lpm` : ''}` : ''; }
  const multi = n > 1;
  if (els.play.dataset.multi !== String(multi)) {
    els.play.dataset.multi = String(multi);
    els.play.disabled = els.prev.disabled = els.next.disabled = els.scrub.disabled = !multi;
    els.play.title = multi ? 'Reproducir o pausar (espacio)' : 'Imagen fija: no hay cuadros que reproducir';
    setPlaying(state.playing);
  }
  const isCT = !!(c && clipKind(c) === 'tc');
  if (document.body.dataset.ct !== String(isCT)) { document.body.dataset.ct = String(isCT); document.querySelectorAll('[data-ctonly]').forEach(e => { e.hidden = !isCT; }); }
  els.prevSeq.disabled = idx <= 0;
  els.nextSeq.disabled = idx < 0 || idx >= state.clips.length - 1;
  const cyc = c && c.cyc;
  els.goED.disabled = !(cyc && cyc.ed.length); els.goES.disabled = !(cyc && cyc.es.length);
  const tip = c && c.items.length > 1 && !(cyc && cyc.ed.length) ? 'Esta secuencia no trae ECG legible. Marca el cuadro con clic derecho → Marcar telediástole (o Shift+D).' : 'Ir a la siguiente telediástole (D)';
  els.goED.title = tip; els.goES.title = c && c.items.length > 1 && !(cyc && cyc.es.length) ? 'Marca el cuadro con clic derecho → Marcar telesístole (o Shift+S).' : 'Ir a la siguiente telesístole (S)';
  const key = c ? `${c.id}:${n}` : '';
  if (els.ticks.dataset.key !== key) {
    els.ticks.dataset.key = key;
    els.ticks.innerHTML = cyc && n > 1 ? cyc.ed.map(i => `<i class="tk ed" style="left:${i / (n - 1) * 100}%"></i>`).join('') + cyc.es.map(i => `<i class="tk es" style="left:${i / (n - 1) * 100}%"></i>`).join('') : '';
  }
}
function setPlaying(p) { state.playing = p; const show = p && els.play.dataset.multi !== 'false'; els.playIcon.innerHTML = show ? ICON_PAUSE : ICON_PLAY; els.play.setAttribute('aria-label', show ? 'Pausar' : 'Reproducir'); }
