/* ======================= Arranque ======================= */
async function boot() {
  setPlaying(false);
  if (typeof dicomParser === 'undefined') setHomeStatus('No se pudo cargar el lector DICOM. Revisa tu conexión a internet y recarga la página.');
  Pool.init();
  setLayout(1);
  renderMed(); renderReport(); renderContext(); renderPac();
  showView('home');
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(loop); });
  await Store.open();
  await loadVault();
  await loadCfg();
  if (!locked()) {
    state.patients = await Store.all('patients');
    state.studies = await Store.all('studies');
  }
  els.keep.disabled = !Store.ok;
  try { await DirStore.load(); } catch (e) {}
  renderDirUI();
  renderHome(); renderContext(); renderReport(); updateStorage();
}
boot();
