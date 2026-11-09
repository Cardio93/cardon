/* ======================= Modo M anatómico ======================= */
async function buildMMode(c, pts) {
  if (c.mm) return;
  const n = c.items.length, m = c.items[0].m, asp = m.aspect || 1;
  setPlaying(false);
  setStatus('Generando el modo M…');
  try {
    for (let i = 0; i < n; i++) { if (!c.ready[i]) await requestFrame(c, i); if (i % 20 === 19) setStatus(`Generando el modo M… ${Math.round(i / n * 50)} %`); }
  } catch (e) { setStatus('No se pudieron preparar todos los cuadros para el modo M.'); return; }
  const [p0, p1] = pts, Lpx = Math.hypot(p1.x - p0.x, (p1.y - p0.y) * asp);
  const H = Math.max(160, Math.min(900, Math.round(Lpx * 1.25))), r = Math.max(1, Math.ceil(720 / n)), W = n * r;
  const x0 = Math.max(0, Math.floor(Math.min(p0.x, p1.x)) - 2), y0 = Math.max(0, Math.floor(Math.min(p0.y, p1.y)) - 2);
  const f0 = c.ready[0], x1 = Math.min(f0.w - 1, Math.ceil(Math.max(p0.x, p1.x)) + 2), y1 = Math.min(f0.h - 1, Math.ceil(Math.max(p0.y, p1.y)) + 2);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const out = new Uint8ClampedArray(W * H * 4);
  for (let k = 0; k < n; k++) {
    const f = c.ready[k];
    g.clearRect(0, 0, bw, bh);
    g.drawImage(f.kind === 'gray' ? grayCanvas(c, f, k) : f.bmp, x0, y0, bw, bh, 0, 0, bw, bh);
    const px = g.getImageData(0, 0, bw, bh).data;
    for (let j = 0; j < H; j++) {
      const t = H > 1 ? j / (H - 1) : 0, fx = p0.x + (p1.x - p0.x) * t - x0, fy = p0.y + (p1.y - p0.y) * t - y0;
      const ix = Math.max(0, Math.min(bw - 2, Math.floor(fx))), iy = Math.max(0, Math.min(bh - 2, Math.floor(fy))), ax = Math.min(1, Math.max(0, fx - ix)), ay = Math.min(1, Math.max(0, fy - iy));
      for (let ch = 0; ch < 3; ch++) {
        const o = (iy * bw + ix) * 4 + ch;
        const v = (px[o] * (1 - ax) + px[o + 4] * ax) * (1 - ay) + (px[o + bw * 4] * (1 - ax) + px[o + bw * 4 + 4] * ax) * ay;
        for (let q = 0; q < r; q++) out[(j * W + k * r + q) * 4 + ch] = v;
      }
      for (let q = 0; q < r; q++) out[(j * W + k * r + q) * 4 + 3] = 255;
    }
    if (k % 12 === 11) { setStatus(`Generando el modo M… ${50 + Math.round(k / n * 50)} %`); await tick(); }
  }
  let cmPerPx = 0;
  try { const sc = spatialScale(measureCtx(state.vps.find(v => v.clip === c) || AV()), p0); if (sc.kind === '2d') cmPerPx = Math.hypot((p1.x - p0.x) * sc.sx, (p1.y - p0.y) * sc.sy) / Math.max(1, H - 1); } catch (e) {}
  const times = c.times || frameTimes(m, n), secPerCol = n > 1 ? (times[n - 1] - times[0]) / (n - 1) / 1000 / r : 0.02 / r;
  const bmp = await createImageBitmap(new ImageData(out, W, H));
  const meta = Object.assign({}, m, {
    seriesDesc: 'Modo M anatómico', rows: H, cols: W, frames: 1, aspect: 1, ecg: null, curve: null, rwave: [], ftv: [], pixelCm: undefined, spp: 3, photometric: 'RGB',
    regions: [{ fmt: 2, type: 1, x0: 0, y0: 0, x1: W - 1, y1: H - 1, ux: UNIT_S, uy: cmPerPx ? UNIT_CM : 0, dx: secPerCol, dy: cmPerPx, rx: 0, ry: 0 }]
  });
  const mclip = { label: `Modo M · ${c.label}`, sub: `Modo M anatómico${cmPerPx ? '' : ' · sin calibración'}`, items: [{ m: meta, pre: { kind: 'bmp', bmp, w: W, h: H } }], fps: c.fps, m: meta, multi: false, mm: { src: c, r, n } };
  addClip(mclip);
  c.el.after(mclip.el);
  state.clips.splice(state.clips.indexOf(mclip), 1); state.clips.splice(state.clips.indexOf(c) + 1, 0, mclip);
  for (const x of state.clips) x.annos = x.annos.filter(a => !(a.t === 'mline' && a.mmClip && !state.clips.includes(a.mmClip)));
  c.annos.push({ k: 'mline' + mclip.id, t: 'mline', pts, all: true, frame: -1, text: 'Modo M', mmClip: mclip });
  if (state.layout === 1) setLayout(2);
  const srcVp = state.vps.find(v => v.clip === c) || state.vps[0];
  const target = state.vps.find(v => v !== srcVp) || srcVp;
  target.clip = mclip; target.frame = 0;
  setActive(state.vps.indexOf(target));
  drawAll(); markList(); renderCal();
  setStatus(cmPerPx ? 'Modo M listo. Puedes medir TAPSE, diámetros y tiempos sobre él; la línea ámbar sigue el cuadro del 2D.' : 'Modo M listo, pero el 2D no está calibrado: solo podrás medir tiempos.');
}
