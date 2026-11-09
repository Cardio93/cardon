/* ======================= Modo guiado ======================= */
function guideStart() {
  if (!state.cur) { setStatus('Abre un estudio para usar el modo guiado.'); return; }
  let i = PROTOCOL.findIndex(([k]) => !state.study.values[k]);
  if (i < 0) i = 0;
  state.guide = { i };
  guideArm();
}
function guideArm() {
  const g = state.guide; if (!g) return;
  const k = PROTOCOL[g.i][0];
  openGroupOf(k);
  state.arm = null;
  const d = DEF[k];
  state.arm = { k, t: d.t, name: d.n, help: armHelp(d), pts: [], err: '' };
  startArm(); renderGuide();
  const row = document.querySelector(`.mname[data-k="${k}"]`); if (row) row.scrollIntoView({ block: 'nearest' });
}
function guideNext(skipMeasured) {
  const g = state.guide; if (!g) return;
  let i = g.i + 1;
  if (!skipMeasured) while (i < PROTOCOL.length && state.study.values[PROTOCOL[i][0]]) i++;
  if (i >= PROTOCOL.length) { state.guide = null; disarm(); renderGuide(); setStatus('Protocolo completo. Revisa los cálculos y el reporte.'); return; }
  g.i = i; guideArm();
}
function guidePrev() { const g = state.guide; if (!g || g.i === 0) return; g.i--; guideArm(); }
function guideStop() { state.guide = null; disarm(); renderGuide(); }
function renderGuide() {
  const box = $('guideBar'); if (!box) return;
  const g = state.guide;
  if (!g) { box.innerHTML = `<div class="row"><button class="btn small primary" id="gStart" type="button">Iniciar modo guiado</button><span class="note">Propone las medidas en el orden habitual del estudio.</span></div>`; $('gStart').addEventListener('click', guideStart); return; }
  const [k, view] = PROTOCOL[g.i];
  box.innerHTML = `<div class="card call"><div><b>Paso ${g.i + 1} de ${PROTOCOL.length}: ${esc(DEF[k].n)}</b><div class="note">${esc(view)}</div></div><div class="row"><button class="btn small" id="gPrev" type="button"${g.i === 0 ? ' disabled' : ''}>Anterior</button><button class="btn small" id="gSkip" type="button">Omitir</button><button class="btn small" id="gStop" type="button">Salir</button></div></div>`;
  $('gPrev').addEventListener('click', guidePrev);
  $('gSkip').addEventListener('click', () => guideNext(true));
  $('gStop').addEventListener('click', guideStop);
}
