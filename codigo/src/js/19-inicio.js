/* ======================= Inicio ======================= */
function studySummary(s) {
  const C = computeAll(s, patientOf(s), state.units), ef = C.ef_s || C.ef_t, parts = [];
  if (s.modalities && s.modalities.length) parts.push(s.modalities.join(', '));
  if (s.desc) parts.push(s.desc);
  parts.push(s.hasImages ? `${s.nImages || 0} imágenes · ${fmtBytes(s.bytes || 0)}` : s.dirName ? `${s.nImages || 0} imágenes en la carpeta de estudios` : 'sin imágenes guardadas');
  const nv = Object.keys(s.values || {}).length;
  if (nv) parts.push(`${nv} medidas`);
  if (ef) parts.push(`FEVI ${ef.text}`);
  return parts.join(' · ');
}
function renderLock() {
  const box = els.lockBox;
  if (!locked()) { box.innerHTML = ''; els.homeSearch.hidden = false; return; }
  els.homeSearch.hidden = true;
  box.innerHTML = `<form class="card call" id="unlockForm"><b>Cardón está protegido con contraseña</b><p class="note" style="color:var(--text)">Escríbela para ver tus pacientes e importar estudios.</p><label class="fld">Contraseña<input type="password" id="unlockPass" autocomplete="current-password" required></label><div class="row"><button class="btn primary small" type="submit">Desbloquear</button></div><p class="note" id="unlockMsg"></p></form>`;
  $('unlockForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('unlockMsg').textContent = 'Comprobando…';
    const ok = await unlockVault($('unlockPass').value);
    if (!ok) { $('unlockMsg').textContent = 'La contraseña no es correcta.'; $('unlockPass').select(); }
  });
}
function renderHome() {
  renderLock();
  if (locked()) { els.homeList.innerHTML = ''; els.homeCount.textContent = ''; return; }
  const q = normName(state.search), K = state.homeKind || '';
  const KS = { eco: 'Eco', angio: 'Angio', tc: 'TC', rm: 'RM' }, kb = st => { const k = studyKindOf(st); return `<span class="kb k-${k}">${KS[k] || k}</span>`; };
  const okK = st => !K || studyKindOf(st) === K;
  const kinds = {}; for (const s of state.studies) { const k = studyKindOf(s); kinds[k] = (kinds[k] || 0) + 1; }
  const kBox = $('homeKinds');
  if (kBox) {
    kBox.innerHTML = Object.keys(kinds).length > 1 || K ? [['', 'Todos', state.studies.length], ...Object.keys(KS).filter(k => kinds[k]).map(k => [k, KS[k], kinds[k]])].map(([k, t, n]) => `<button type="button" data-k="${k}" aria-pressed="${K === k}">${t}<span class="n">${n}</span></button>`).join('') : '';
    kBox.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.homeKind = b.dataset.k; renderHome(); }));
  }
  const last = p => state.studies.filter(s => s.patientId === p.id).reduce((a, s) => (s.date || '') > a ? s.date : a, '');
  const list = state.patients
    .filter(p => !q || normName(p.name).includes(q) || (p.doc || '').toLowerCase().includes(q))
    .filter(p => !K || state.studies.some(s => s.patientId === p.id && okK(s)))
    .sort((a, b) => last(b).localeCompare(last(a)) || (a.name || '').localeCompare(b.name || '', 'es'));
  els.homeCount.textContent = state.patients.length ? `${state.patients.length} ${state.patients.length === 1 ? 'paciente' : 'pacientes'}` : '';
  const openPt = patientOf(state.study);
  const resume = state.clips.length || state.study.id
    ? `<div class="card call"><div class="srow" style="border:0;padding:0"><div><b>Estudio abierto</b><span>${esc(openPt ? `${openPt.name} · ${isoToShow(state.study.date)}` : (state.clips[0] && state.clips[0].demo ? 'Clip de ejemplo' : 'Sin paciente asignado'))}</span></div><button class="btn small primary" id="resume" type="button">Volver al visor</button></div></div>` : '';
  let body;
  if (!Store.ok) body = `<p class="empty">${esc(Store.problem())}</p>`;
  else if (!state.patients.length) body = '<p class="empty">Aún no hay pacientes. Importa un estudio y aparecerá aquí con sus datos.</p>';
  else if (!list.length) body = '<p class="empty">Ningún paciente coincide con la búsqueda.</p>';
  else body = list.map(p => {
    const studies = state.studies.filter(s => s.patientId === p.id && okK(s)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const age = ageAt(p.birth, todayISO());
    const meta = [p.doc ? `ID ${p.doc}` : '', age !== null ? `${age} años` : '', sexWord(p.sex)].filter(Boolean).join(' · ');
    return `<article class="pcard"><div class="pc-head"><b>${esc(p.name || 'Sin nombre')}</b><span>${esc(meta)}</span></div>
      ${studies.length ? studies.map(s => `<div class="srow"><div><b>${kb(s)}${isoToShow(s.date)}</b><span>${esc(studySummary(s))}</span></div><button class="btn small ${s.hasImages || s.dirName ? 'primary' : ''}" data-open="${esc(s.id)}" type="button">${s.hasImages || s.dirName ? 'Abrir' : 'Ver medidas'}</button></div>`).join('') : '<div class="srow"><div><span>Sin estudios</span></div></div>'}
    </article>`;
  }).join('');
  const rec = q || !Store.ok ? [] : state.studies.filter(s => s.lastOpened && okK(s)).sort((a, b) => b.lastOpened.localeCompare(a.lastOpened)).slice(0, 5);
  const recent = rec.length ? `<section class="recent"><h3>Abiertos recientemente</h3>${rec.map(s => { const pt = patientOf(s); return `<div class="srow"><div><b>${kb(s)}${esc(pt ? pt.name || 'Sin nombre' : 'Sin paciente')}</b><span>${isoToShow(s.date)}${s.desc ? ' · ' + esc(s.desc) : ''}</span></div><button class="btn small ${s.hasImages || s.dirName ? 'primary' : ''}" data-open="${esc(s.id)}" type="button">${s.hasImages || s.dirName ? 'Abrir' : 'Ver medidas'}</button></div>`; }).join('')}</section>` : '';
  els.homeList.innerHTML = resume + recent + body;
  const r = $('resume'); if (r) r.addEventListener('click', () => { showView('viewer'); drawAll(); });
  els.homeList.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openStudy(state.studies.find(s => s.id === b.dataset.open))));
}
