/* ======================= Clip de ejemplo ======================= */
function makeDemo() {
  const W = 208, H = 208, N = 30;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tex = new Float32Array(W * H);
  for (let i = 0; i < tex.length; i++) tex[i] = rnd();
  const sm = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let a = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) a += tex[(y + j) * W + x + i];
    sm[y * W + x] = a / 9;
  }
  const meta = { modality: 'MR', seriesDesc: 'Cine eje corto (ejemplo sintético)', manufacturer: 'Simulado en el navegador', date: '', patientName: 'Ejemplo sintético', patientId: '', hr: 60, aspect: 1, wc: 128, ww: 256, regions: [], pixelCm: 0.15, frameTime: 1000 / 30, ftv: [], rwave: [0], ecg: null };
  const items = [];
  for (let f = 0; f < N; f++) {
    const ph = f / N;
    const e = ph < 0.36 ? (1 - Math.cos(Math.PI * ph / 0.36)) / 2 : (1 + Math.cos(Math.PI * (ph - 0.36) / 0.64)) / 2;
    const cx = 110, cy = 106, rb = 33 - 12 * e, re = 48 - 4 * e;
    const rvx = 58, rvy = 100, rvrx = 30 - 7 * e, rvry = 40 - 5 * e;
    const pm = [[cx + Math.cos(0.7) * rb * 0.72, cy + Math.sin(0.7) * rb * 0.72], [cx + Math.cos(2.2) * rb * 0.72, cy + Math.sin(2.2) * rb * 0.72]];
    const ar = 9 + 1.2 * (1 - e);
    const data = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, t = sm[p] || tex[p];
      const bx = (x - 104) / 98, by = (y - 106) / 88, body = bx * bx + by * by;
      let v;
      if (body > 1) v = 6 + 10 * t;
      else {
        v = 82 + 30 * t;
        if (body > 0.8) v = 150 + 45 * t;
        if (((x - 178) / 18) ** 2 + ((y - 104) / 48) ** 2 < 1) v = 22 + 14 * t;
        const sp = Math.hypot(x - 104, y - 176);
        if (sp < 13) v = sp < 9 ? 120 + 20 * t : 45;
        if (Math.hypot(x - 136, y - 158) < ar) v = 210 + 30 * t;
        const r = Math.hypot(x - cx, (y - cy) * 1.04);
        const rv = ((x - rvx) / rvrx) ** 2 + ((y - rvy) / rvry) ** 2;
        if (r < re) v = 52 + 16 * t;
        if (rv < 1 && r >= re) v = rv > 0.8 ? 58 + 12 * t : 200 + 30 * t;
        if (r < rb) v = 206 + 32 * t;
        for (const [px, py] of pm) if (Math.hypot(x - px, y - py) < 4.5 + 1.5 * e) v = 60 + 12 * t;
      }
      v += (rnd() - 0.5) * 14;
      data[p] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    items.push({ m: meta, pre: { kind: 'gray', data, w: W, h: H, slope: 1, intercept: 0, mono1: false } });
  }
  return { label: 'Ejemplo sintético', sub: 'Eje corto · 30 fases · 30 fps', items, fps: 30, m: meta, multi: true, demo: true };
}
