/* ======================= Vistas ======================= */
function showView(v) {
  if (v === 'home') document.body.classList.remove('focus');
  state.view = v;
  els.home.hidden = v !== 'home';
  els.app.hidden = v !== 'viewer';
  els.viewerActions.hidden = v !== 'viewer';
  if (v === 'home') { if (state.arm) disarm(); setPlaying(false); renderHome(); }
  else requestAnimationFrame(() => state.vps.forEach(resizeVP));
}
function clearViewer() {
  if (state.arm) disarm();
  state.cprDraw = null;
  state.undo = []; state.sel = null;
  state.guide = null;
  for (const c of state.clips.slice()) removeClip(c);
  els.list.querySelectorAll('.list-sep, .grp').forEach(e => e.remove());
  if (state.grpEls) { state.grpEls.clear(); state.grpOpen.clear(); }
  state.compareIds = [];
  for (const vp of state.vps) { vp.clip = null; vp.frame = 0; }
  setStatus('');
}
