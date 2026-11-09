/* ======================= Reproducción y sincronía ======================= */
let lastT = 0;
function nextIndex(vp) {
  const n = vp.clip.items.length;
  if (!state.bounce) return (vp.frame + 1) % n;
  let k = vp.frame + vp.dir;
  if (k >= n || k < 0) { vp.dir = -vp.dir; k = vp.frame + vp.dir; }
  return Math.max(0, Math.min(n - 1, k));
}
function phaseOf(c, frame) {
  const n = c.items.length;
  if (c.cyc && c.cyc.ed.length && c.cyc.rr) {
    const t = c.cyc.times; let e = -1;
    for (const k of c.cyc.ed) if (k <= frame) e = k;
    const ref = e >= 0 ? t[e] : t[c.cyc.ed[0]] - c.cyc.rr;
    return { cyc: true, ph: (((t[frame] - ref) / c.cyc.rr) % 1 + 1) % 1 };
  }
  return { cyc: false, ph: n > 1 ? frame / (n - 1) : 0 };
}
function frameAtPhase(c, P) {
  const n = c.items.length;
  if (P.cyc && c.cyc && c.cyc.ed.length && c.cyc.rr) {
    const t = c.cyc.times, target = t[c.cyc.ed[0]] + P.ph * c.cyc.rr;
    let b = 0, bd = Infinity; for (let k = 0; k < n; k++) { const d = Math.abs(t[k] - target); if (d < bd) { bd = d; b = k; } }
    return b;
  }
  return Math.round(P.ph * (n - 1));
}
function syncOthers() {
  if (!state.sync || state.vps.length < 2) return;
  const a = AV(); if (!a.clip) return;
  const P = phaseOf(a.clip, a.frame);
  for (const vp of state.vps) if (vp !== a && vp.clip && vp.clip.items.length > 1) {
    const f = frameAtPhase(vp.clip, P);
    if (f !== vp.frame) { vp.frame = f; if (!vp.clip.ready[f]) requestFrame(vp.clip, f).catch(() => {}); drawVP(vp); }
  }
}
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(250, t - lastT); lastT = t;
  if (state.view !== 'viewer' || !state.playing) return;
  const list = state.sync && state.vps.length > 1 ? [AV()] : state.vps;
  for (const vp of list) {
    const c = vp.clip;
    if (!c || c.items.length < 2 || c.err) continue;
    vp.acc += dt;
    const delay = 1000 / (c.fps * state.speed);
    let moved = false, guard = 0;
    while (vp.acc >= delay && guard++ < 6) {
      vp.acc -= delay;
      const nf = nextIndex(vp);
      if (!c.ready[nf]) { requestFrame(c, nf).catch(() => {}); vp.acc = 0; break; }
      vp.frame = nf; moved = true;
    }
    if (guard >= 6) vp.acc = 0;
    if (moved) { drawVP(vp); if (vp === AV()) syncOthers(); }
  }
}
function step(d) {
  const c = state.cur; if (!c) return;
  setPlaying(false);
  const n = c.items.length;
  state.frame = (((state.frame + d) % n) + n) % n;
  draw(); syncOthers();
}
function goMark(kind) {
  const c = state.cur; if (!c || !c.cyc) return;
  const marks = c.cyc[kind]; if (!marks.length) return;
  setPlaying(false);
  const nx = marks.find(i => i > state.frame);
  state.frame = nx !== undefined ? nx : marks[0];
  if (!c.ready[state.frame]) requestFrame(c, state.frame).catch(() => {});
  draw(); syncOthers();
}
