/* ======================= Exportar imagen y video ======================= */
function renderExportFrame(cv, c, i, withMeas) {
  const f = c.ready[i]; if (!f) return false;
  const asp = c.m.aspect || 1, W = f.w, H = Math.round(f.h * asp);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const G = { ctx: g, tf: { x: 0, y: 0, sc: 1, asp }, dpr: Math.max(1, W / 800), w: W, h: H };
  const src = imageSource(G, c, f, i);
  g.drawImage(src, 0, 0, W, H); g.filter = 'none';
  drawMasks(G, c, false);
  for (const a of c.annos) if (withMeas && (a.frame === i || a.all)) {
    const P = a.track && a.track[i] ? a.pts.map(p => ({ x: p.x + a.track[i][0], y: p.y + a.track[i][1] })) : a.pts;
    if (a.t === 'cac') drawCac(G, a, false); else drawShape(G, a.t, P, a.col || (a.t === 'mline' ? CYAN : a.free ? FREEC : AMBER), a.text);
  }
  return true;
}
async function exportPng() {
  const c = state.cur; if (!c || c.err) { setStatus('Abre una imagen para exportar.'); return; }
  const cv = document.createElement('canvas');
  if (!renderExportFrame(cv, c, state.frame, els.expMeas.checked)) { setStatus('La imagen todavía se está preparando.'); return; }
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  await saveFile(`cardon-imagen-${stamp()}.png`, blob, els.status);
  if (!c.masks.length) setStatus(els.status.textContent + ' Si la imagen tiene el nombre del paciente quemado, usa «Ocultar zona» antes de exportar.');
}
async function exportVideo() {
  const c = state.cur; if (!c || c.err) { setStatus('Abre una secuencia para exportar.'); return; }
  if (c.items.length < 2) { exportPng(); return; }
  if (typeof MediaRecorder === 'undefined') { setStatus('Este navegador no permite grabar video. Exporta imágenes sueltas.'); return; }
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
  if (!mime) { setStatus('Este navegador no tiene un formato de video disponible.'); return; }
  setPlaying(false);
  setStatus('Preparando los cuadros…');
  for (let i = 0; i < c.items.length; i++) { try { await requestFrame(c, i); } catch (e) { setStatus('No se pudieron preparar todos los cuadros.'); return; } }
  const cv = document.createElement('canvas');
  renderExportFrame(cv, c, 0, els.expMeas.checked);
  let stream, track;
  try { stream = cv.captureStream(0); track = stream.getVideoTracks()[0]; } catch (e) { setStatus('Este navegador no permite grabar video desde la imagen.'); return; }
  const manual = track && typeof track.requestFrame === 'function';
  if (!manual) { stream = cv.captureStream(Math.min(60, c.fps)); }
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  const dur = c.items.length / c.fps, loops = Math.max(1, Math.min(4, Math.ceil(2.5 / dur)));
  rec.start(250);
  const delay = 1000 / c.fps, total = loops * c.items.length;
  let n = 0;
  const t0 = performance.now();
  for (let L = 0; L < loops; L++) for (let i = 0; i < c.items.length; i++) {
    renderExportFrame(cv, c, i, els.expMeas.checked);
    if (manual) track.requestFrame();
    n++;
    if (n % 5 === 0) setStatus(`Grabando video… ${Math.round(n / total * 100)} %`);
    const wait = t0 + n * delay - performance.now();
    if (wait > 0) await sleep(wait);
  }
  rec.stop(); await stopped;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  await saveFile(`cardon-video-${stamp()}.${ext}`, blob, els.status);
}
