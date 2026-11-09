/* ======================= Angiografía: QCA semiautomático =======================
   El usuario arrastra a lo largo del vaso; se recentra la línea en el eje del vaso, se buscan los bordes
   a media altura del perfil (entre el centro opaco y el fondo) y se calcula el perfil de diámetros.
   Diámetro de referencia interpolado entre los tramos proximal y distal; DE = 1 − DLM / referencia. */
function qcaCompute(c, i, path) {
  const { w, h, L } = frameLum(c, i), asp = c.m.aspect || 1;
  let scCm = 0; try { const sc = spatialScale(measureCtx(), path[0]); if (sc.kind === '2d') scCm = sc.sx; } catch (e) {}
  const val = (x, y) => { y /= asp; if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return NaN; const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, k = y0 * w + x0; return (L[k] * (1 - fx) + L[k + 1] * fx) * (1 - fy) + (L[k + w] * (1 - fx) + L[k + w + 1] * fx) * fy; };
  const resample = (P, step) => { const out = [P[0]]; let need = step; for (let k = 1; k < P.length; k++) { let a = P[k - 1]; const b = P[k]; let d = Math.hypot(b.x - a.x, b.y - a.y); while (d >= need) { const t = need / d; a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; out.push(a); d -= need; need = step; } need -= d; } return out; };
  const smooth = (P, r) => P.map((_, k) => { let sx = 0, sy = 0, n = 0; for (let d = -r; d <= r; d++) { const q = P[Math.max(0, Math.min(P.length - 1, k + d))]; sx += q.x; sy += q.y; n++; } return { x: sx / n, y: sy / n }; });
  const normals = P => P.map((_, k) => { const a = P[Math.max(0, k - 3)], b = P[Math.min(P.length - 1, k + 3)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; });
  let P = resample(path.map(q => ({ x: q.x, y: q.y * asp })), 1);
  if (P.length < 25) throw new Error('El trazo es muy corto. Arrastra a lo largo del vaso, desde un tramo sano antes de la lesión hasta uno sano después.');
  P = smooth(P, 4);
  const R = Math.max(10, Math.min(40, scCm ? 0.45 / scCm : 22));
  /* polaridad: en angiografía el vaso es oscuro; si la imagen está invertida, el vaso es claro */
  let N = normals(P), pol = 0;
  for (let k = 0; k < P.length; k += 3) { const c0 = val(P[k].x, P[k].y), e1 = val(P[k].x + N[k].x * R, P[k].y + N[k].y * R), e2 = val(P[k].x - N[k].x * R, P[k].y - N[k].y * R); if (isFinite(c0 + e1 + e2)) pol += (e1 + e2) / 2 - c0; }
  const sg = pol >= 0 ? 1 : -1, v = (x, y) => sg * val(x, y);
  /* 1) recentrar en el eje del vaso (dos pasadas) */
  for (let pass = 0; pass < 2; pass++) {
    N = normals(P);
    P = P.map((p, k) => { let best = 0, bv = Infinity; for (let o = -R * 0.6; o <= R * 0.6; o += 0.5) { let s = 0; for (const t of [-1, 0, 1]) s += v(p.x + N[k].x * (o + t * 0.5), p.y + N[k].y * (o + t * 0.5)); if (s < bv) { bv = s; best = o; } } return { x: p.x + N[k].x * best, y: p.y + N[k].y * best }; });
    P = resample(smooth(P, 6), 1);
  }
  N = normals(P);
  /* 2) bordes a media altura */
  const T = P.map((_, k) => ({ x: N[k].y, y: -N[k].x }));
  const eL = [], eR = [], ok = [];
  for (let k = 0; k < P.length; k++) {
    const p = P[k], n = N[k], t = T[k], prof = [];
    for (let o = -R; o <= R + 1e-9; o += 0.25) { let s = 0, m = 0; for (const tt of [-1, 0, 1]) { const q = v(p.x + n.x * o + t.x * tt, p.y + n.y * o + t.y * tt); if (isFinite(q)) { s += q; m++; } } prof.push(m ? s / m : NaN); }
    const c0 = Math.round(R / 0.25); let im = c0; for (let d = -8; d <= 8; d++) if (prof[c0 + d] < prof[im]) im = c0 + d;
    const vmin = prof[im];
    /* borde = máximo del gradiente entre el centro y el fondo de ese lado (con ajuste parabólico) */
    const side = dir => {
      let mx = -Infinity, jm = im; for (let j = im; j >= 0 && j < prof.length; j += dir) if (prof[j] > mx) { mx = prof[j]; jm = j; }
      if (!(mx > vmin) || jm === im) return { o: NaN, c: 0 };
      const th = vmin + (mx - vmin) * 0.85; let jEnd = jm; for (let j = im; j !== jm; j += dir) if (prof[j] >= th) { jEnd = j; break; }
      let bg = -Infinity, jb = -1; const g = j => prof[j + dir] - prof[j - dir];
      for (let j = im + dir; j !== jEnd && j + dir >= 0 && j + dir < prof.length && j - dir >= 0 && j - dir < prof.length; j += dir) { const gv = g(j); if (gv > bg) { bg = gv; jb = j; } }
      if (jb < 0) return { o: NaN, c: 0 };
      let off = 0; if (jb + dir >= 0 && jb + dir < prof.length - 1 && jb - dir > 0 && jb - dir < prof.length) { const a = g(jb - dir), b = g(jb), cc = g(jb + dir), den = a - 2 * b + cc; if (den < 0) off = Math.max(-0.5, Math.min(0.5, 0.5 * (a - cc) / den)); }
      return { o: (jb + dir * off - c0) * 0.25, c: mx - vmin };
    };
    const l = side(-1), r = side(1);
    eL.push(l.o); eR.push(r.o); ok.push(isFinite(l.o) && isFinite(r.o) && Math.min(l.c, r.c) > 6);
  }
  const fillNaN = a => { const out = a.slice(); for (let k = 0; k < out.length; k++) if (!ok[k]) { let j = k - 1; while (j >= 0 && !ok[j]) j--; let m = k + 1; while (m < out.length && !ok[m]) m++; out[k] = j >= 0 && m < out.length ? (a[j] + a[m]) / 2 : j >= 0 ? a[j] : m < out.length ? a[m] : 0; } return out; };
  const EL = median5(fillNaN(eL)), ER = median5(fillNaN(eR));
  const trim = 3, n0 = P.length;
  const idx = []; for (let k = trim; k < n0 - trim; k++) idx.push(k);
  const D = idx.map(k => ER[k] - EL[k]);
  if (ok.filter(Boolean).length < n0 * 0.6) throw new Error('No se distinguen bien los bordes del vaso en este cuadro. Elige un cuadro con buen relleno de contraste o mide a mano.');
  const n = D.length, med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const a0 = Math.round(n * 0.04), a1 = Math.max(a0 + 2, Math.round(n * 0.22)), b0 = Math.min(n - 3, Math.round(n * 0.78)), b1 = Math.round(n * 0.96);
  const mp = med(D.slice(a0, a1)), md = med(D.slice(b0, b1)), kp = (a0 + a1) / 2, kd = (b0 + b1) / 2;
  const ref = k => k <= kp ? mp : k >= kd ? md : mp + (md - mp) * (k - kp) / (kd - kp);
  let km = Math.round(n * 0.15); for (let k = Math.round(n * 0.15); k <= Math.round(n * 0.85); k++) if (D[k] < D[km]) km = k;
  const pct = Math.max(0, Math.min(100, (1 - D[km] / ref(km)) * 100));
  let kl = km, kr = km; while (kl > 0 && D[kl - 1] < 0.9 * ref(kl - 1)) kl--; while (kr < n - 1 && D[kr + 1] < 0.9 * ref(kr + 1)) kr++;
  const toImg = q => ({ x: q.x, y: q.y / asp });
  const left = idx.map(k => toImg({ x: P[k].x + N[k].x * EL[k], y: P[k].y + N[k].y * EL[k] })), right = idx.map(k => toImg({ x: P[k].x + N[k].x * ER[k], y: P[k].y + N[k].y * ER[k] }));
  const mm = scCm * 10;
  return { left, right, km, pct, Dpx: D, refPx: ref(km), mldPx: D[km], lenPx: kr - kl + 1, mm, mld: mm ? D[km] * mm : null, ref: mm ? ref(km) * mm : null, len: mm ? (kr - kl + 1) * mm : null, prof: D.filter((_, k) => k % Math.max(1, Math.round(n / 80)) === 0).map(x => mm ? +(x * mm).toFixed(2) : +x.toFixed(1)) };
}
function qcaText(r) {
  return `QCA: DE ${dec(r.pct, 0)} %` + (r.mm ? ` · DLM ${dec(r.mld, 2)} mm · DR ${dec(r.ref, 2)} mm\nLongitud de la lesión ${dec(r.len, 1)} mm` : ' (calibra con el catéter para ver los mm)');
}
function finishQCA(a, c) {
  let r; try { r = qcaCompute(c, state.frame, a.pts); } catch (e) { a.err = e.message; a.pts = []; updateHint(); draw(); return; }
  const pts = [...r.left, ...r.right], txt = qcaText(r);
  if (a.seg) {
    const key = 'cor_' + a.seg, vals = snapVals([key]), removed = annosWithKey(key);
    for (const x of state.clips) x.annos = x.annos.filter(nn => nn.k !== key);
    const anno = { k: key, t: 'qca', pts, frame: state.frame, text: `${SEG_NAME[a.seg]}\n${txt}` };
    c.annos.push(anno);
    state.study.values[key] = { v: Math.round(r.pct), at: new Date().toISOString(), qca: { mld: r.mld, ref: r.ref, len: r.len, prof: r.prof, refProf: r.mm ? +(r.ref).toFixed(2) : +r.refPx.toFixed(1) } };
    pushUndo({ type: 'add', clip: c, anno, removed, vals });
    disarm(); drawClipViews(c); scheduleSave(); renderMed(); renderReport(); renderContext();
    setStatus(`${SEG_NAME[a.seg]}: estenosis de ${dec(r.pct, 0)} % por QCA. Revisa los bordes sobre la imagen; si no te convencen, mide a mano.`);
    return;
  }
  c.freeN = (c.freeN || 0) + 1;
  const anno = { k: 'libre' + c.freeN, free: 'qca', t: 'qca', pts, frame: state.frame, text: `${c.freeN}  ${txt}` };
  c.annos.push(anno); pushUndo({ type: 'add', clip: c, anno });
  disarm(); drawClipViews(c);
  setStatus(`QCA: estenosis de ${dec(r.pct, 0)} %. Revisa los bordes sobre la imagen.`);
}
function qcaSpark(q) {
  if (!q || !q.prof || q.prof.length < 3) return '';
  const p = q.prof, mx = Math.max(...p, q.refProf || 0) * 1.1 || 1, X = i => (i / (p.length - 1) * 196 + 2).toFixed(1), Y = x => (46 - x / mx * 42).toFixed(1);
  let im = 0; p.forEach((x, i) => { if (x < p[im]) im = i; });
  return `<svg viewBox="0 0 200 50" class="spark" aria-hidden="true"><polyline points="${p.map((x, i) => `${X(i)},${Y(x)}`).join(' ')}" fill="none" stroke="#62c6c4" stroke-width="1.6"/>${q.refProf ? `<line x1="2" x2="198" y1="${Y(q.refProf)}" y2="${Y(q.refProf)}" stroke="var(--muted)" stroke-dasharray="3 3"/>` : ''}<circle cx="${X(im)}" cy="${Y(p[im])}" r="2.6" fill="#e05a4f"/></svg>`;
}
/* ---- Conteo de cuadros TIMI (Gibson 1996): cuadros entre la llegada del contraste al origen y al hito distal, a 30 cuadros/s; DA corregida ÷ 1,7 ---- */
const TFC_REF = { DA: { m: 21.1, sd: 1.5, up: 28, hito: 'bigote distal de la DA («pata de ganso» apical)' }, Cx: { m: 22.2, sd: 4.1, up: 30, hito: 'bifurcación distal de la rama marginal más larga' }, CD: { m: 20.4, sd: 3.0, up: 27, hito: 'primera rama posterolateral' } };
function tfcOf(x) {
  if (!x || !isNum(x.f0) || !isNum(x.f1) || !(x.fps > 0) || x.f1 <= x.f0) return null;
  const n = x.f1 - x.f0, tfc = n * 30 / x.fps;
  return { n, tfc, ctfc: x.v === 'DA' ? tfc / 1.7 : tfc };
}
/* ---- Árbol coronario esquemático ---- */
const TREE = {
  tci: 'M118,30 L95,50', da_p: 'M95,50 L100,92', da_m: 'M100,92 L108,148', da_d: 'M108,148 L118,218',
  d1: 'M99,84 L140,112', d2: 'M104,128 L142,162', ri: 'M95,50 L74,96',
  cx_p: 'M95,50 L54,60', cx_d: 'M54,60 L28,150', om1: 'M46,84 L62,128', om2: 'M37,116 L52,168',
  cd_p: 'M152,30 L200,46', cd_m: 'M200,46 L222,126', cd_d: 'M222,126 L196,180', dp: 'M196,180 L160,222', pl: 'M196,180 L230,212'
};
function sevCol(v) { return !isNum(v) ? '#5b6b6e' : v >= 100 ? '#b9302b' : v >= 70 ? '#e05a4f' : v >= 50 ? '#e7b24a' : '#7cc48b'; }
function treeSVG(st) {
  const mid = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number); return { x: (n[0] + n[2]) / 2, y: (n[1] + n[3]) / 2 }; };
  return `<svg viewBox="0 0 250 236" class="ctree" role="group" aria-label="Árbol coronario">
    <path d="M118,30 Q135,6 152,30" fill="none" stroke="var(--line)" stroke-width="5"/><text x="135" y="13" class="lbl">Ao</text>
    ${Object.entries(TREE).map(([k, d]) => { const v = st.values['cor_' + k] && st.values['cor_' + k].v, has = isNum(v) && v > 0, m = mid(d);
      return `<g data-tree="${k}"><title>${esc(tr(SEG_NAME[k]))}${has ? ` · ${v} %` : ''}</title><path d="${d}" class="hit"/><path d="${d}" class="seg" stroke="${sevCol(has ? v : null)}"${has && v >= 100 ? ' stroke-dasharray="4 3"' : ''}/>${has ? `<text x="${(m.x + 6).toFixed(0)}" y="${(m.y - 4).toFixed(0)}" class="pct">${v >= 100 ? 'oc.' : v + '%'}</text>` : ''}</g>`; }).join('')}
    <text x="40" y="232" class="lbl">Sistema izquierdo</text><text x="186" y="232" class="lbl">CD</text>
  </svg>`;
}