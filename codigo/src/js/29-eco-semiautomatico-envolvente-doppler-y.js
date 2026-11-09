/* ======================= Eco semiautomático: envolvente Doppler y borde endocárdico ======================= */
function frameLum(c, i) {
  const f = c.ready[i]; if (!f) throw new Error('La imagen todavía se está preparando.');
  if (c._lum && c._lum.i === i && c._lum.f === f) return c._lum;
  if (f.kind === 'gray' && f.data) {
    /* valores originales (sin la ventana de visualización, que puede saturar los bordes), llevados a 0–255 */
    const n = f.w * f.h, src = f.data, sl = f.slope || 1, ic = f.intercept || 0, smp = [];
    for (let k = 0; k < n; k += Math.max(1, (n / 4000) | 0)) smp.push(src[k] * sl + ic);
    smp.sort((a, b) => a - b);
    const lo = smp[Math.floor(smp.length * 0.005)], hi = smp[Math.floor(smp.length * 0.995)], k255 = 255 / Math.max(1e-6, hi - lo), L = new Float32Array(n);
    for (let k = 0; k < n; k++) { let o = (src[k] * sl + ic - lo) * k255; o = o < 0 ? 0 : o > 255 ? 255 : o; L[k] = f.mono1 ? 255 - o : o; }
    return (c._lum = { i, f, w: f.w, h: f.h, L });
  }
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(f.kind === 'gray' ? grayCanvas(c, f, i) : f.bmp, 0, 0, f.w, f.h);
  const d = g.getImageData(0, 0, f.w, f.h).data, L = new Float32Array(f.w * f.h);
  for (let k = 0, j = 0; k < L.length; k++, j += 4) L[k] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  return (c._lum = { i, f, w: f.w, h: f.h, L });
}
function otsu(hist) {
  let tot = 0, sum = 0; for (let i = 0; i < hist.length; i++) { tot += hist[i]; sum += i * hist[i]; }
  let wB = 0, sB = 0, best = 0, th = 0;
  for (let i = 0; i < hist.length; i++) {
    wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break;
    sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; th = i; }
  }
  return th;
}
const median5 = a => a.map((_, i) => { const w = a.slice(Math.max(0, i - 2), i + 3).sort((x, y) => x - y); return w[w.length >> 1]; });
/* Envolvente de una onda Doppler a partir de un clic dentro de ella */
function autoVTI(c, i, p) {
  const ctx = measureCtx(), sc = dopplerScale(ctx, p, true), r = sc.region.r, { w, L } = frameLum(c, i);
  const base = Math.round(sc.base), dir = p.y > base ? 1 : -1, edge = dir > 0 ? r.y1 : r.y0, maxE = Math.floor(Math.abs(edge - base)) - 2;
  if (maxE < 10) throw new Error('No hay espacio entre la línea de base y el borde del espectro.');
  const xa = Math.max(Math.ceil(r.x0), Math.round(p.x) - 300), xb = Math.min(Math.floor(r.x1), Math.round(p.x) + 300);
  const at = (x, e) => L[(base + dir * e) * w + x];
  const hist = new Array(256).fill(0);
  for (let x = xa; x <= xb; x += 2) for (let e = 3; e <= maxE; e += 2) hist[Math.min(255, at(x, e) | 0)]++;
  const T = Math.max(otsu(hist), 8);
  const E = [];
  for (let x = xa; x <= xb; x++) {
    let run = 0, got = 0;
    for (let e = maxE; e >= 3; e--) { if (at(x, e) > T) { if (++run >= 3) { got = e + 2; break; } } else run = 0; }
    E.push(got);
  }
  const S = median5(E), xc = Math.round(p.x) - xa;
  let pk = 0; for (let k = Math.max(0, xc - 12); k <= Math.min(S.length - 1, xc + 12); k++) pk = Math.max(pk, S[k]);
  if (pk < 6) throw new Error('No se encontró la onda en ese punto. Haz clic dentro de la onda o trázala a mano.');
  const thr = Math.max(3, pk * 0.08);
  let k0 = xc; if (S[k0] <= thr) { let best = -1; for (let d = 1; d <= 15; d++) { if (S[xc - d] > thr) { best = xc - d; break; } if (S[xc + d] > thr) { best = xc + d; break; } } if (best < 0) throw new Error('Haz clic dentro de la onda.'); k0 = best; }
  const walk = step => { let k = k0, gap = 0, last = k0; while (k + step >= 0 && k + step < S.length) { k += step; if (S[k] > thr) { gap = 0; last = k; } else if (++gap > 2) break; } return last; };
  const ks = walk(-1), ke = walk(1);
  if (ke - ks < 8) throw new Error('La onda encontrada es muy corta. Trázala a mano.');
  const pts = [{ x: xa + ks - 1, y: base }];
  for (let k = ks; k <= ke; k++) pts.push({ x: xa + k, y: base + dir * S[k] });
  pts.push({ x: xa + ke + 1, y: base });
  return pts;
}
/* Borde endocárdico a partir de 3 clics: anillo, anillo y ápex (o techo de la aurícula) */
function autoEndo(c, i, clicks) {
  const { w, h, L } = frameLum(c, i), asp = c.m.aspect || 1;
  const P = clicks.map(q => ({ x: q.x, y: q.y * asp }));
  const [A1, A2, AP] = P, M = { x: (A1.x + A2.x) / 2, y: (A1.y + A2.y) / 2 };
  const Lax = Math.hypot(AP.x - M.x, AP.y - M.y), hb = Math.hypot(A2.x - A1.x, A2.y - A1.y) / 2;
  if (Lax < 15 || hb < 5) throw new Error('Los puntos están muy cerca. Haz clic en los dos anillos y luego en el ápex.');
  const u = { x: (AP.x - M.x) / Lax, y: (AP.y - M.y) / Lax };
  const n1 = { x: (A1.x - M.x) / hb, y: (A1.y - M.y) / hb };
  const C = { x: M.x + u.x * Lax * 0.4, y: M.y + u.y * Lax * 0.4 };
  const val = (x, y) => { const xi = Math.round(x), yi = Math.round(y / asp); return xi < 0 || yi < 0 || xi >= w || yi >= h ? 0 : L[yi * w + xi]; };
  /* plantilla: semielipse por los dos anillos y el ápex */
  const tpl = []; for (let k = 0; k <= 360; k++) { const ph = Math.PI * k / 360; tpl.push({ x: M.x + n1.x * hb * Math.cos(ph) + u.x * Lax * Math.sin(ph), y: M.y + n1.y * hb * Math.cos(ph) + u.y * Lax * Math.sin(ph) }); }
  const ang = q => Math.atan2(q.y - C.y, q.x - C.x), TAU = Math.PI * 2, rel = a => ((a - ang(A1)) % TAU + TAU) % TAU;
  const relA2 = rel(ang(A2)), relP = rel(ang(AP)), sgn = relP < relA2 ? 1 : -1, span = sgn > 0 ? relA2 : TAU - relA2;
  const tplAng = tpl.map(q => ({ a: sgn > 0 ? rel(ang(q)) : (TAU - rel(ang(q))) % TAU, r: Math.hypot(q.x - C.x, q.y - C.y) }));
  const r0At = t => { let best = null, bd = 1e9; for (const q of tplAng) { const d = Math.abs(q.a - t); if (d < bd) { bd = d; best = q; } } return best.r; };
  const N = 64, rays = [];
  for (let k = 1; k < N; k++) { const t = span * k / N, a = ang(A1) + sgn * t; rays.push({ t, dx: Math.cos(a), dy: Math.sin(a), r0: r0At(t) }); }
  /* umbral (Otsu) en la banda alrededor de la plantilla */
  const hist = new Array(256).fill(0);
  for (const ry of rays) for (let rr = ry.r0 * 0.5; rr <= ry.r0 * 1.6; rr += 1.5) hist[Math.min(255, val(C.x + ry.dx * rr, C.y + ry.dy * rr) | 0)]++;
  const T = otsu(hist);
  const R = rays.map(ry => {
    const tx = -ry.dy, ty = ry.dx, prof = [];
    for (let rr = ry.r0 * 0.5; rr <= ry.r0 * 1.5; rr += 1) {
      let s = 0; for (let o = -2; o <= 2; o++) s += val(C.x + ry.dx * rr + tx * o, C.y + ry.dy * rr + ty * o);
      prof.push([rr, s / 5]);
    }
    for (let k = 0; k + 2 < prof.length; k++) if (prof[k][1] > T && prof[k + 1][1] > T && prof[k + 2][1] > T) return { r: prof[k][0], ok: k > 0 };
    return { r: ry.r0, ok: false };
  });
  let rad = R.map((x, k) => x.ok ? x.r : rays[k].r0);
  rad = median5(rad); rad = rad.map((_, k) => { let s = 0, n = 0; for (let d = -1; d <= 1; d++) if (rad[k + d] !== undefined) { s += rad[k + d]; n++; } return s / n; });
  const out = [clicks[0]];
  rays.forEach((ry, k) => out.push({ x: C.x + ry.dx * rad[k], y: (C.y + ry.dy * rad[k]) / asp }));
  out.push(clicks[1]);
  return { pts: out, conf: R.filter(x => x.ok).length / R.length };
}
function armHelp(d) { const T = typeof tr === 'function' ? tr : x => x; return d.t === 'trace' ? T(d.h) + ' ' + T(/^la/.test(d.k) ? 'O haz 3 clics (anillo, anillo y techo de la aurícula) para un borde automático.' : 'O haz 3 clics (anillo, anillo y ápex) para un borde automático.') : d.h; }