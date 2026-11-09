/* ======================= Ventanas (1, 1×2, 2×2) ======================= */
function createVP() {
  const el = document.createElement('div');
  el.className = 'vp'; el.tabIndex = 0;
  el.setAttribute('aria-label', 'Imagen. La rueda del mouse cambia de cuadro.');
  el.innerHTML = '<canvas class="screen"></canvas><canvas class="ecg"></canvas><div class="ov tl"></div><div class="ov tr"></div><div class="ov bl"></div><div class="ov br"></div><span class="vp-tag" hidden></span><div class="msg" hidden><span></span></div>';
  const vp = {
    el, canvas: el.querySelector('canvas.screen'), ecgCv: el.querySelector('canvas.ecg'),
    ov: { tl: el.querySelector('.tl'), tr: el.querySelector('.tr'), bl: el.querySelector('.bl'), br: el.querySelector('.br') },
    msg: el.querySelector('.msg'), msgText: el.querySelector('.msg span'), tag: el.querySelector('.vp-tag'),
    clip: null, frame: 0, dir: 1, acc: 0, tf: null, ovCache: {}
  };
  vp.ctx = vp.canvas.getContext('2d');
  bindVP(vp);
  new ResizeObserver(() => resizeVP(vp)).observe(el);
  els.vgrid.append(el);
  return vp;
}
function setLayout(n) {
  state.layout = n;
  els.vgrid.dataset.layout = String(n);
  while (state.vps.length < n) {
    const vp = createVP();
    const shown = new Set(state.vps.map(v => v.clip));
    vp.clip = state.clips.find(c => !shown.has(c)) || (AV() && AV().clip) || null;
    state.vps.push(vp);
    if (vp.clip) { preload(vp.clip); }
  }
  while (state.vps.length > n) { const vp = state.vps.pop(); vp.el.remove(); }
  if (state.act >= n) state.act = 0;
  document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', b.dataset.layout === String(n) ? 'true' : 'false'));
  setActive(state.act);
  requestAnimationFrame(() => state.vps.forEach(resizeVP));
}
function setActive(i) {
  const prev = state.act;
  state.act = i;
  state.vps.forEach((v, k) => v.el.classList.toggle('active', k === i && state.layout > 1));
  if (prev !== i && state.arm) { state.arm.pts = []; }
  markList(); updateTransport(); renderCal(); refreshMaskBtn();
}
function resizeVP(vp) {
  const r = vp.el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * state.dpr)), h = Math.max(1, Math.round(r.height * state.dpr));
  if (vp.canvas.width !== w || vp.canvas.height !== h) { vp.canvas.width = w; vp.canvas.height = h; }
  vp.el.style.setProperty('--ovfs', `${Math.max(10, Math.min(12.5, Math.min(r.width / 64, r.height / 40))).toFixed(1)}px`);
  const eh = Math.max(1, Math.round(Math.min(90, r.height * 0.2) * state.dpr));
  if (vp.ecgCv.width !== w || vp.ecgCv.height !== eh) { vp.ecgCv.width = w; vp.ecgCv.height = eh; }
  drawVP(vp);
}
