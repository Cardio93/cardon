/* ======================= Panel clínico ======================= */
function setTab(t) {
  if (!panelOpen()) { panelSession = true; applyUI(); }
  state.tab = t;
  for (const k of ['pac', 'med', 'rep']) { els[k].hidden = k !== t; $('t-' + k).setAttribute('aria-selected', k === t ? 'true' : 'false'); }
  if (t === 'rep') renderReport();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function patientOf(st) { return st && st.patientId ? state.patients.find(p => p.id === st.patientId) || null : null; }
function activateStudy(st) { state.study = st; state.confirmDel = null; renderPac(); renderMed(); renderReport(); renderContext(); }
function renderContext() {
  const st = state.study, pt = patientOf(st), n = Object.keys(st.values).length;
  if (pt) { els.ctxName.textContent = pt.name || 'Paciente sin nombre'; els.ctxSub.textContent = `Estudio del ${isoToShow(st.date)} · ${n} ${n === 1 ? 'medida' : 'medidas'}`; }
  else { els.ctxName.textContent = 'Sin paciente'; els.ctxSub.textContent = n ? `${n} ${n === 1 ? 'medida' : 'medidas'} sin guardar: asígnalas a un paciente` : 'Las medidas no se guardan hasta asignar un paciente'; }
  if (!Store.ok && Store.status !== 'opening' && Store.status !== 'blocked') setSave('Sin almacenamiento local', 'err');
  else if (!st.id) setSave(n ? 'Sin guardar' : '', 'warn');
  else if (!els.saveState.textContent) setSave('Guardado', 'ok');
}

/* --- Pestaña Paciente --- */
function renderPac() {
  const box = els.pac, st = state.study, pt = patientOf(st);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  if (!pt) {
    const opts = state.patients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.doc ? ' · ' + esc(p.doc) : ''}</option>`).join('');
    box.innerHTML = `<p class="empty">Estas imágenes no están asignadas a ningún paciente. Asígnalas para guardar las medidas.</p>
      <div class="card"><label class="fld">Paciente nuevo<input type="text" id="np-name" placeholder="Nombre completo"></label><div class="row"><button class="btn primary small" id="np-go">Crear y asignar</button></div></div>
      ${state.patients.length ? `<div class="card"><label class="fld">Paciente existente<select id="ep-sel">${opts}</select></label><div class="row"><button class="btn small" id="ep-go">Asignar como estudio nuevo</button></div></div>` : ''}`;
    const assign = async p => { st.id = newId('s'); st.patientId = p.id; st.date = st.date || todayISO(); state.studies.push(st); await saveStudyNow(st); activateStudy(st); setSave('Guardado', 'ok'); };
    on('np-go', 'click', async () => {
      const name = $('np-name').value.trim(); if (!name) { $('np-name').focus(); return; }
      const p = { id: newId('p'), name, doc: '', birth: '', sex: '', notes: '', created: new Date().toISOString() };
      state.patients.push(p); await savePatient(p); assign(p);
    });
    on('ep-go', 'click', () => { const p = state.patients.find(x => x.id === $('ep-sel').value); if (p) assign(p); });
    return;
  }
  const studies = state.studies.filter(s => s.patientId === pt.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const age = ageAt(pt.birth, st.date || todayISO());
  box.innerHTML = `<h3>${esc(pt.name || 'Paciente sin nombre')}</h3>
    <div class="grid2">
      <label class="fld full">Nombre completo<input type="text" id="f-name" value="${esc(pt.name)}"></label>
      <label class="fld">Documento<input type="text" id="f-doc" value="${esc(pt.doc)}"></label>
      <label class="fld">Sexo<select id="f-sex"><option value="">Sin indicar</option><option value="H"${pt.sex === 'H' ? ' selected' : ''}>Hombre</option><option value="M"${pt.sex === 'M' ? ' selected' : ''}>Mujer</option></select></label>
      <label class="fld">Fecha de nacimiento<input type="date" id="f-birth" value="${esc(pt.birth)}"></label>
      <div class="fld">Edad al estudio<span class="fval">${age !== null ? age + ' años' : '—'}</span></div>
      <label class="fld full">Notas<textarea id="f-notes" rows="2">${esc(pt.notes)}</textarea></label>
    </div>
    <h4>Estudios de este paciente</h4>
    <div class="plist">${studies.map(s => {
      const cur = s === st, cmp = state.compareIds.includes(s.id);
      return `<div class="prow2${cur ? ' cur' : ''}"><button class="prow" data-sid="${esc(s.id)}" aria-current="${cur}"><b>${isoToShow(s.date)}</b><span>${s.hasImages ? `${s.nImages || 0} img` : 'sin img'} · ${Object.keys(s.values || {}).length} medidas</span></button>${!cur && s.hasImages ? `<button class="btn small" data-cmp="${esc(s.id)}" type="button"${cmp ? ' disabled' : ''}>${cmp ? 'En comparación' : 'Comparar'}</button>` : ''}</div>`;
    }).join('')}</div>
    ${state.compareIds.length ? '<div class="row"><button class="btn small" id="cmpOff" type="button">Quitar comparación</button></div>' : ''}
    ${state.confirmDel ? `<div class="card" style="border-color:var(--danger)"><p class="note" style="color:var(--text)">${esc(state.confirmDel.text)} Esta acción no se puede deshacer.</p><div class="row"><button class="btn danger small" id="cdYes">Eliminar</button><button class="btn small" id="cdNo">Cancelar</button></div></div>`
      : `<div class="row"><button class="btn danger small" id="sDel">Eliminar este estudio</button><button class="btn danger small" id="pDel">Eliminar paciente</button></div>`}`;
  box.querySelectorAll('[data-sid]').forEach(b => b.addEventListener('click', () => { const s = state.studies.find(x => x.id === b.dataset.sid); if (s && s !== st) openStudy(s); }));
  box.querySelectorAll('[data-cmp]').forEach(b => b.addEventListener('click', () => { const s = state.studies.find(x => x.id === b.dataset.cmp); if (s) compareWith(s); }));
  on('cmpOff', 'click', removeCompare);
  let pt_t = null;
  const pf = (id, key) => on(id, 'input', e => { pt[key] = e.target.value; clearTimeout(pt_t); pt_t = setTimeout(() => { savePatient(pt); renderContext(); if (key === 'birth') { renderPac(); renderReport(); } }, 400); });
  pf('f-name', 'name'); pf('f-doc', 'doc'); pf('f-birth', 'birth'); pf('f-notes', 'notes');
  on('f-sex', 'change', e => { pt.sex = e.target.value; savePatient(pt); renderMedValues(); renderReport(); });
  on('sDel', 'click', () => { state.confirmDel = { kind: 'study', id: st.id, text: `¿Eliminar el estudio del ${isoToShow(st.date)} con sus imágenes y medidas?` }; renderPac(); });
  on('pDel', 'click', () => { const n = studies.length; state.confirmDel = { kind: 'patient', id: pt.id, text: `¿Eliminar a ${pt.name} y sus ${n} ${n === 1 ? 'estudio' : 'estudios'}, con imágenes y medidas?` }; renderPac(); });
  on('cdNo', 'click', () => { state.confirmDel = null; renderPac(); });
  on('cdYes', 'click', async () => {
    const cd = state.confirmDel; state.confirmDel = null;
    const ids = cd.kind === 'study' ? [cd.id] : state.studies.filter(s => s.patientId === cd.id).map(s => s.id);
    for (const id of ids) { await Store.delFilesOf(id); await Store.del('studies', id); }
    state.studies = state.studies.filter(s => !ids.includes(s.id));
    if (cd.kind === 'patient') { await Store.del('patients', cd.id); state.patients = state.patients.filter(p => p.id !== cd.id); }
    clearViewer(); state.study = blankStudy(); activateStudy(state.study);
    showView('home'); updateStorage();
    setHomeStatus(cd.kind === 'study' ? 'Estudio eliminado.' : 'Paciente eliminado.');
  });
}

/* --- Pestaña Medidas --- */
function currentKind() {
  const st = state.study;
  if (st.kind) return st.kind;
  const ck = clipKind(state.cur);
  if (!st.modalities || !st.modalities.length) return ck === 'angio' || ck === 'tc' || (ck === 'rm' && !(state.cur && state.cur.demo)) ? ck : 'eco';
  return studyKindOf(st);
}
function kindPicker() {
  const st = state.study, names = { eco: 'Ecocardiograma', angio: 'Angiografía coronaria', tc: 'TC cardíaca', rm: 'RM cardíaca' };
  const auto = !st.kind ? ({ eco: 'ecocardiograma', angio: 'angiografía', tc: 'TC cardíaca', rm: 'RM cardíaca' })[currentKind()] || '' : '';
  return `<label class="fld">Tipo de estudio<select id="s-kind"><option value="">Automático${auto ? ' (' + auto + ')' : ''}</option>${Object.entries(names).map(([k, n]) => `<option value="${k}"${st.kind === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
}
function bindKindPicker() {
  const sel = $('s-kind'); if (!sel) return;
  sel.addEventListener('change', e => { state.study.kind = e.target.value || undefined; if (!e.target.value) delete state.study.kind; scheduleSave(); renderMed(); renderReport(); });
}
function renderAngioMed() {
  const st = state.study, box = els.med, A = st.angio || (st.angio = {}), timi = A.timi || (A.timi = {});
  const R = computeAngio(st);
  const opt = (v, cur, lab) => `<option value="${v}"${cur === v ? ' selected' : ''}>${lab}</option>`;
  box.innerHTML = `
    <div class="mtop">${kindPicker()}</div>
    <details class="mgroup mcard" data-card="proc"${cardState().proc ? ' open' : ''}><summary><span class="gname">Datos del procedimiento</span><span class="msum" id="a-sum">${esc([A.dom ? 'Dominancia ' + A.dom : '', A.access || ''].filter(Boolean).join(' · ') || 'Sin datos')}</span></summary><div class="gbody">
    <div class="grid2">
      <label class="fld">Fecha<input type="date" id="s-date" value="${esc(st.date || '')}"></label><div></div>
      <label class="fld">Acceso<select id="a-access"><option value="">Sin indicar</option>${['Radial derecho', 'Radial izquierdo', 'Femoral derecho', 'Femoral izquierdo', 'Braquial'].map(x => opt(x, A.access, x)).join('')}</select></label>
      <label class="fld">Dominancia<select id="a-dom"><option value="">Sin indicar</option>${opt('derecha', A.dom, 'Derecha')}${opt('izquierda', A.dom, 'Izquierda')}${opt('codominante', A.dom, 'Codominante')}</select></label>
      <label class="fld">Contraste (ml)<input type="number" id="a-contrast" min="0" step="1" inputmode="numeric" value="${esc(A.contrast || '')}"></label>
      <label class="fld">Fluoroscopia (min)<input type="number" id="a-fluoro" min="0" step="0.1" inputmode="decimal" value="${esc(A.fluoro || '')}"></label>
    </div></div></details>
    <details class="mgroup mcard" data-card="cal"${cardState().cal ? ' open' : ''}><summary><span class="gname">Calibración</span><span class="msum" id="calSum"></span></summary><div class="gbody"><div class="cal" id="calBox"></div></div></details>
    <h4 class="sub4">Medidas libres y aorta</h4>
    <div class="row angfree"><button class="btn small" type="button" data-angfree="dist" title="Distancia entre dos puntos">Distancia</button><button class="btn small" type="button" data-angfree="area" title="Área de un contorno">Área</button><button class="btn small" type="button" data-angfree="qca" title="Estenosis automática sin asignarla a un segmento">QCA libre</button></div>
    ${Object.entries(AO_ANG).map(([k, n]) => { const v = st.values['ang_' + k] && st.values['ang_' + k].v, has = isNum(v); return `<div class="mrow"><button class="mname" data-angao="${k}" title="Arrastra de pared a pared en la aortografía (raíz: a nivel de los senos de Valsalva)">${ICON_RULER}<span>${esc(n)}</span>${has && v * 10 >= 40 ? '<span class="flag alto">dilatada</span>' : ''}</button><span class="mtext ${has ? '' : 'none'}">${has ? `${dec(v * 10, 1)} mm${st.values['ang_' + k].approx ? ' (aprox.)' : ''}` : '—'}</span><button class="del" data-angaodel="${k}" aria-label="Borrar ${esc(n)}" ${has ? '' : 'hidden'}>×</button></div>`; }).join('')}
    <p class="note">Las distancias usan la calibración del catéter; si no la hay, una aproximada del detector. Clic derecho sobre la imagen para más medidas libres.</p>
    <h4 class="sub4">Lesiones coronarias</h4>
    <div class="seg full qmode" role="group" aria-label="Forma de medir la estenosis"><button class="btn" type="button" data-qmode="auto" aria-pressed="${qcaMode() === 'auto'}" title="Arrastras a lo largo del vaso y los bordes se detectan solos">Automática (QCA)</button><button class="btn" type="button" data-qmode="man" aria-pressed="${qcaMode() === 'man'}" title="Mides a mano el diámetro de referencia y el de la lesión">Manual (2 diámetros)</button></div>
    <p class="note">${qcaMode() === 'auto' ? 'Pulsa un segmento del árbol o de la lista y arrastra a lo largo del vaso, desde un tramo sano antes de la lesión hasta uno sano después. Usa un cuadro con buen relleno de contraste; calibra con el catéter para ver los mm.' : 'Pulsa un segmento del árbol o de la lista para medir la estenosis sobre la imagen (primero el vaso de referencia y luego la lesión).'} También puedes escribir el porcentaje. 100 % = oclusión total.</p>
    <div class="treewrap">${treeSVG(st)}<div class="legend"><span><i class="dot" style="background:#7cc48b"></i>&lt; 50 %</span><span><i class="dot" style="background:#e7b24a"></i>50–69 %</span><span><i class="dot" style="background:#e05a4f"></i>70–99 %</span><span><i class="dot" style="background:#b9302b"></i>Oclusión</span><span class="note">Esquema orientativo; con dominancia izquierda la DP y la PL dependen de la Cx.</span></div></div>
    ${CORONARY.map(g => `<section class="mgroup"><div class="gh"><h4>${esc(g.n)}</h4>${g.v !== 'TCI' ? `<span class="gsel"><label class="field" title="Grado de flujo TIMI">TIMI <select data-timi="${g.v}"><option value="">—</option>${['0', '1', '2', '3'].map(x => opt(x, timi[g.v], x)).join('')}</select></label><label class="field" title="Grado de blush miocárdico (0 a 3)">Blush <select data-blush="${g.v}"><option value="">—</option>${['0', '1', '2', '3'].map(x => opt(x, (A.blush || {})[g.v], x)).join('')}</select></label></span>` : ''}</div>
      ${g.segs.map(([k, n]) => {
        const v = st.values['cor_' + k] && st.values['cor_' + k].v, has = isNum(v);
        const sig = has && (k === 'tci' ? v >= 50 : v >= 70);
        return `<div class="mrow"><button class="mname" data-seg="${k}" title="Medir la estenosis de ${esc(n)} sobre la imagen">${ICON_RULER}<span>${esc(n)}</span>${sig ? '<span class="flag alto">significativa</span>' : ''}</button><input type="number" min="0" max="100" step="1" inputmode="numeric" data-cor="${k}" value="${has ? v : ''}" aria-label="${esc(n)}"><span class="unit">%</span><button class="del" data-cordel="${k}" aria-label="Borrar ${esc(n)}" ${has ? '' : 'hidden'}>×</button></div>${has && st.values['cor_' + k].qca ? (q => `<div class="qcadet">${qcaSpark(q)}<span class="note">QCA${q.mld ? ` · DLM ${dec(q.mld, 2)} mm · DR ${dec(q.ref, 2)} mm · longitud ${dec(q.len, 1)} mm` : ' · sin calibración (solo %)'}</span></div>`)(st.values['cor_' + k].qca) : ''}`;
      }).join('')}</section>`).join('')}
    <details class="mgroup mcard" data-card="tfc"${cardState().tfc ? ' open' : ''}><summary><span class="gname">Conteo de cuadros TIMI</span><span class="msum">${esc(['DA', 'Cx', 'CD'].map(v => { const r = tfcOf(Object.assign({ v }, (A.tfc || {})[v])); return r ? `${v} ${dec(r.ctfc, 0)}` : ''; }).filter(Boolean).join(' · ') || 'Sin medir')}</span></summary><div class="gbody">
      <p class="note">Avanza cuadro a cuadro: marca el primer cuadro en que el contraste llena el origen del vaso de borde a borde y el cuadro en que llega al hito distal. Se corrige a 30 cuadros/s; en la DA se divide entre 1,7.</p>
      ${['DA', 'Cx', 'CD'].map(v => { const x = (A.tfc || {})[v] || {}, r = tfcOf(Object.assign({ v }, x)), ref = TFC_REF[v];
        return `<div class="tfc"><div class="row"><b>${v}</b><span class="note">hito: ${esc(ref.hito)}</span></div>
        <div class="row"><button class="btn small" type="button" data-tfc="${v}:f0">${isNum(x.f0) ? `Inicio: cuadro ${x.f0 + 1}` : 'Marcar inicio'}</button><button class="btn small" type="button" data-tfc="${v}:f1">${isNum(x.f1) ? `Final: cuadro ${x.f1 + 1}` : 'Marcar final'}</button>${isNum(x.f0) || isNum(x.f1) ? `<button class="del" type="button" data-tfcdel="${v}" aria-label="Borrar conteo ${v}">×</button>` : ''}</div>
        ${r ? `<div class="crow"><span class="cl">${r.n} cuadros a ${fmtNum(x.fps)} cuadros/s</span><span class="cv">${r.ctfc > ref.up ? '<span class="flag alto">lento</span>' : ''}${v === 'DA' ? 'corregido ' : ''}${dec(r.ctfc, 1)}</span><span class="cr">Referencia: ${dec(ref.m, 0)} ± ${dec(ref.sd, 0)} (${v === 'DA' ? 'DA corregida' : v})</span></div>` : ''}</div>`; }).join('')}
    </div></details>
    <h4>Resumen</h4>
    <div class="calcs"><div class="crow"><span class="cl">Vasos con lesión significativa</span><span class="cv">${R.n ? `<span class="flag alto">${R.n}</span>${esc(Object.keys(R.vessels).join(', '))}` : 'Ninguno'}</span></div>${R.tci ? '<div class="crow"><span class="cl">Tronco coronario izquierdo</span><span class="cv"><span class="flag alto">significativa</span></span></div>' : ''}<div class="crow"><span class="cl">Criterio</span><span class="cv">≥ 70 % · tronco ≥ 50 %</span></div></div>
    <p class="note">La estenosis visual o por calibrador no reemplaza la evaluación funcional (FFR o iFR) en lesiones intermedias.</p>`;
  bindKindPicker(); bindCards(box);
  $('s-date').addEventListener('change', e => { st.date = e.target.value; scheduleSave(); renderContext(); renderReport(); });
  const setA = (id, key, numv) => $(id).addEventListener(numv ? 'input' : 'change', e => { const v = numv ? parseFloat(e.target.value) : e.target.value; A[key] = numv ? (isFinite(v) ? v : null) : v; scheduleSave(); renderReport(); });
  setA('a-access', 'access'); setA('a-dom', 'dom'); setA('a-contrast', 'contrast', true); setA('a-fluoro', 'fluoro', true);
  $('a-dom').addEventListener('change', () => renderAngioMed());
  box.querySelectorAll('[data-timi]').forEach(sel => sel.addEventListener('change', e => { timi[e.target.dataset.timi] = e.target.value; scheduleSave(); renderReport(); }));
  box.querySelectorAll('[data-blush]').forEach(sel => sel.addEventListener('change', e => { (A.blush = A.blush || {})[e.target.dataset.blush] = e.target.value; scheduleSave(); renderReport(); }));
  box.querySelectorAll('[data-qmode]').forEach(b => b.addEventListener('click', () => { try { localStorage.setItem('cardon.qca', b.dataset.qmode); } catch (e) {} state.qcaMode = b.dataset.qmode; if (state.arm && state.arm.seg) disarm(); renderAngioMed(); }));
  box.querySelectorAll('[data-tree]').forEach(g => g.addEventListener('click', () => armSeg(g.dataset.tree)));
  box.querySelectorAll('[data-tfc]').forEach(b => b.addEventListener('click', () => {
    const [v, w] = b.dataset.tfc.split(':'), c = state.cur;
    if (!c || c.items.length < 3) { setStatus('Abre una secuencia de angiografía con varios cuadros.'); return; }
    const T = A.tfc = A.tfc || {}, x = T[v] = Object.assign({}, T[v] || {});
    x[w] = AV().frame; x.fps = c.fps || 15; x.clip = c.label;
    if (isNum(x.f0) && isNum(x.f1) && x.f1 <= x.f0) setStatus('El cuadro final debe ser posterior al inicial.');
    scheduleSave(); renderAngioMed(); renderReport();
  }));
  box.querySelectorAll('[data-tfcdel]').forEach(b => b.addEventListener('click', () => { if (A.tfc) delete A.tfc[b.dataset.tfcdel]; scheduleSave(); renderAngioMed(); renderReport(); }));
  box.querySelectorAll('.mname[data-seg]').forEach(b => b.addEventListener('click', () => armSeg(b.dataset.seg)));
  box.querySelectorAll('[data-angfree]').forEach(b => b.addEventListener('click', () => { if (!state.cur) { setStatus('Abre una angiografía para medir.'); return; } armFree(b.dataset.angfree); }));
  box.querySelectorAll('[data-angao]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.angao; if (!state.cur) { setStatus('Abre una angiografía para medir.'); return; }
    if (state.arm && state.arm.aoKey === k) { disarm(); return; }
    state.arm = { k: null, free: 'dist', aoKey: k, t: 'dist', name: AO_ANG[k], help: 'Arrastra de pared a pared, perpendicular al eje de la aorta.', pts: [], err: '' }; startArm();
  }));
  box.querySelectorAll('[data-angaodel]').forEach(b => b.addEventListener('click', () => delKey('ang_' + b.dataset.angaodel)));
  box.querySelectorAll('[data-cor]').forEach(inp => inp.addEventListener('change', e => {
    const k = e.target.dataset.cor, x = parseFloat(e.target.value);
    if (isFinite(x) && x > 0) st.values['cor_' + k] = { v: Math.min(100, Math.round(x)), at: new Date().toISOString(), manual: true }; else delete st.values['cor_' + k];
    scheduleSave(); renderAngioMed(); renderReport(); renderContext();
  }));
  box.querySelectorAll('[data-cordel]').forEach(b => b.addEventListener('click', () => {
    delKey('cor_' + b.dataset.cordel);
  }));
  renderCal();
}
const AO_ANG = { aoroot: 'Raíz aórtica', aoasc: 'Aorta ascendente' };
function qcaMode() { if (!state.qcaMode) { let m = null; try { m = localStorage.getItem('cardon.qca'); } catch (e) {} state.qcaMode = m === 'man' ? 'man' : 'auto'; } return state.qcaMode; }
function armSeg(k) {
  if (!state.cur) { setStatus('Abre una angiografía para medir.'); return; }
  if (state.arm && state.arm.seg === k) { disarm(); return; }
  if (qcaMode() === 'auto') state.arm = { k: null, free: 'qca', seg: k, t: 'qca', name: `${SEG_NAME[k]}: QCA`, help: FREE.qca[1], pts: [], err: '' };
  else state.arm = { k: null, free: 'sten', seg: k, t: 'sten', name: `${SEG_NAME[k]}: estenosis`, help: FREE.sten[1], pts: [], err: '' };
  startArm();
}
function renderMed() {
  els.med.dataset.kind = currentKind();
  if (currentKind() === 'angio') { renderAngioMed(); return; }
  if (currentKind() === 'tc') { renderCTMed(); return; }
  if (currentKind() === 'rm') { renderMRMed(); return; }
  const st = state.study, box = els.med;
  const f = (id, label, val, attrs) => `<label class="fld">${label}<input type="number" id="${id}" value="${val === null || val === undefined ? '' : esc(val)}" ${attrs || ''}></label>`;
  const cards = cardState();
  box.innerHTML = `
    <div class="mtop">${kindPicker()}</div>
    <div id="guideBar"></div>
    <details class="mgroup mcard" data-card="datos"${cards.datos ? ' open' : ''}><summary><span class="gname">Datos para los cálculos</span><span class="msum" id="s-sum"></span></summary><div class="gbody">
    <div class="grid2">
      <label class="fld">Fecha<input type="date" id="s-date" value="${esc(st.date || '')}"></label>
      <label class="fld">Unidades<select id="s-units"><option value="mm">mm</option><option value="cm">cm</option></select></label>
      ${f('s-weight', 'Peso (kg)', st.weight, 'step="0.1" min="0" inputmode="decimal"')}
      ${f('s-height', 'Talla (cm)', st.height, 'step="1" min="0" inputmode="decimal"')}
      ${f('s-sbp', 'PAS (mmHg)', st.sbp, 'step="1" min="0" inputmode="numeric"')}
      ${f('s-dbp', 'PAD (mmHg)', st.dbp, 'step="1" min="0" inputmode="numeric"')}
      ${f('s-hr', 'FC (lpm)', st.hr, 'step="1" min="0" inputmode="numeric"')}
      <label class="fld">Presión AD<select id="s-rap"><option value="auto">Automática</option><option value="3">3 mmHg</option><option value="8">8 mmHg</option><option value="15">15 mmHg</option></select></label>
      <div class="fld">Sup. corporal<span id="s-bsa" class="fval mono"></span></div>
    </div></div></details>
    <details class="mgroup mcard" data-card="cal"${cards.cal ? ' open' : ''}><summary><span class="gname">Calibración</span><span class="msum" id="calSum"></span></summary><div class="gbody"><div class="cal" id="calBox"></div></div></details>
    <div id="mGroups"></div>
    <details class="mgroup mcard" data-card="wm"${cards.wm ? ' open' : ''}><summary><span class="gname">Motilidad segmentaria</span><span class="msum" id="wmSum"></span></summary><div class="gbody" id="wmBox"></div></details>
    <h4>Cálculos</h4>
    <div class="calcs" id="calcs"></div>
    <p class="note">Referencias ASE/EACVI 2015 a 2017, ESC/ERS 2022. Confirma los valores en el equipo antes de usarlos en decisiones clínicas.</p>`;
  bindKindPicker();
  $('s-rap').value = isNum(st.rap) ? String(st.rap) : 'auto';
  $('s-rap').title = 'Automática: usa la presión estimada por la vena cava inferior; si no está medida, asume 3 mmHg.';
  $('s-units').value = state.units;
  const numIn = (id, key) => $(id).addEventListener('input', e => { const v = parseFloat(e.target.value); st[key] = isFinite(v) ? v : null; scheduleSave(); updateBsa(); renderCalcs(); renderReport(); });
  numIn('s-weight', 'weight'); numIn('s-height', 'height'); numIn('s-hr', 'hr'); numIn('s-sbp', 'sbp'); numIn('s-dbp', 'dbp');
  $('s-date').addEventListener('change', e => { st.date = e.target.value; scheduleSave(); renderContext(); renderReport(); });
  $('s-rap').addEventListener('change', e => { st.rap = e.target.value === 'auto' ? 'auto' : +e.target.value; scheduleSave(); renderCalcs(); renderReport(); });
  $('s-units').addEventListener('change', e => { state.units = e.target.value; try { localStorage.setItem('latido.units', state.units); } catch (_) {} renderMedValues(); renderReport(); });
  bindCards(box);
  updateBsa(); renderGuide(); renderCal(); renderMedValues(); renderWM();
}
/* ---- Motilidad segmentaria (17 segmentos, ASE 2015): 1 normal · 2 hipocinesia · 3 acinesia · 4 discinesia ---- */
function renderWM() {
  const box = $('wmBox'); if (!box) return;
  const st = state.study, W = st.wm || (st.wm = {}), w = wmCompute(st), brush = state.wmBrush || 2;
  const sum = $('wmSum'); if (sum) { sum.textContent = w ? `IMS ${dec(w.wmsi, 2)} · ${w.n}/17` : 'Sin evaluar'; sum.className = 'msum' + (w && w.wmsi > 1 ? ' warn' : ''); }
  box.innerHTML = `
    <div class="wmb" role="group" aria-label="Puntaje a aplicar">${[1, 2, 3, 4].map(k => `<button type="button" class="btn small${brush === k ? ' on' : ''}" data-wmb="${k}" aria-pressed="${brush === k}"><i class="dot" style="background:${WM[k].col}"></i>${k} · ${esc(WM[k].n)}</button>`).join('')}</div>
    <div class="bullwrap wmwrap">${bullseyeSVG(W, 'wm')}
      <div class="legend"><span class="note">Elige el puntaje y haz clic en los segmentos (otro clic con el mismo puntaje lo borra). Anterior arriba, septo a la izquierda; basales afuera, ápex al centro.</span>
      <div class="row"><button class="btn small" type="button" id="wmRest">Los demás, normales</button><button class="btn small" type="button" id="wmClear"${w ? '' : ' disabled'}>Limpiar</button></div></div></div>
    ${w ? `<div class="calcs"><div class="crow"><span class="cl">Índice de motilidad (IMS)</span><span class="cv">${w.wmsi > 1 ? '<span class="flag alto">alto</span>' : ''}${dec(w.wmsi, 2)}</span><span class="cr">Referencia: 1,00 · ${w.n} de 17 segmentos evaluados</span></div>
      ${[2, 3, 4].filter(k => w.by[k].length).map(k => `<div class="crow"><span class="cl">${esc(WM[k].n)}</span><span class="cv">${w.by[k].length}</span><span class="cr">${w.by[k].map(s => `${s}. ${esc(AHA17[s - 1])}`).join(', ')}</span></div>`).join('')}</div>` : ''}`;
  box.querySelectorAll('[data-wmb]').forEach(b => b.addEventListener('click', () => { state.wmBrush = +b.dataset.wmb; renderWM(); }));
  box.querySelectorAll('.bull [data-seg]').forEach(el => el.addEventListener('click', () => {
    const sg = +el.dataset.seg, b2 = state.wmBrush || 2;
    if (W[sg] === b2) delete W[sg]; else W[sg] = b2;
    wmChanged();
  }));
  $('wmRest').addEventListener('click', () => { for (let sg = 1; sg <= 17; sg++) if (!W[sg]) W[sg] = 1; wmChanged(); });
  $('wmClear').addEventListener('click', () => { st.wm = {}; wmChanged(); });
}
function wmChanged() { scheduleSave(); renderWM(); renderReport(); renderContext(); }
const WM = { 1: { n: 'Normal', col: '#4f8f6a' }, 2: { n: 'Hipocinesia', col: '#e7b24a' }, 3: { n: 'Acinesia', col: '#e05a4f' }, 4: { n: 'Discinesia', col: '#b88ae0' } };
function wmCompute(st) {
  const W = (st && st.wm) || {}, segs = Object.keys(W).map(Number).filter(sg => W[sg] >= 1 && W[sg] <= 4);
  if (!segs.length) return null;
  const by = { 1: [], 2: [], 3: [], 4: [] }; segs.sort((a, b) => a - b).forEach(sg => by[W[sg]].push(sg));
  return { n: segs.length, wmsi: segs.reduce((a, sg) => a + W[sg], 0) / segs.length, by };
}
function wmSentence(st, en) {
  const w = wmCompute(st); if (!w) return '';
  const NM = en ? { 2: 'hypokinesia', 3: 'akinesia', 4: 'dyskinesia' } : { 2: 'hipocinesia', 3: 'acinesia', 4: 'discinesia' };
  const parts = [2, 3, 4].filter(k => w.by[k].length).map(k => `${NM[k]} ${segPhrase(w.by[k], en)}`);
  const idx = `${en ? 'wall motion score index' : 'índice de motilidad'} ${dec(w.wmsi, 2)}${w.n < 17 ? (en ? `, ${w.n} of 17 segments scored` : `, ${w.n} de 17 segmentos evaluados`) : ''}`;
  if (!parts.length) return en ? `Normal segmental wall motion (${idx}).` : `Motilidad segmentaria conservada (${idx}).`;
  return en ? `Segmental wall motion abnormalities: ${parts.join('; ')} (${idx}).` : `Alteraciones de la motilidad segmentaria: ${parts.join('; ')} (${idx}).`;
}

function bindCards(box) { box.querySelectorAll('details.mcard').forEach(dt => dt.addEventListener('toggle', () => { const cs = cardState(); cs[dt.dataset.card] = dt.open; try { localStorage.setItem('cardon.cards', JSON.stringify(cs)); } catch (e) {} })); }
function cardState() { let o = null; try { o = JSON.parse(localStorage.getItem('cardon.cards') || 'null'); } catch (e) {} return Object.assign({ datos: false, cal: true, proc: true, wm: false, tfc: false, ctinfo: false, mrman: false, mrlim: false }, o || {}); }
function updateBsa() {
  const st = state.study, b = bsaOf(st), el = $('s-bsa'); if (el) el.textContent = b ? `${dec(b, 2)} m²` : '—';
  const sum = $('s-sum'); if (!sum) return;
  const parts = [b ? `SC ${dec(b, 2)} m²` : '', st.sbp && st.dbp ? `PA ${st.sbp}/${st.dbp}` : '', st.hr ? `FC ${st.hr}` : ''].filter(Boolean);
  sum.textContent = parts.length ? parts.join(' · ') : 'Sin peso ni talla';
  sum.classList.toggle('warn', !b);
}
function renderCal() {
  const box = $('calBox'); if (!box) return;
  const c = state.cur, it = curItem();
  const regs = it ? (it.m.regions || []) : [];
  const has2d = regs.some(r => r.fmt === 1 && r.ux === UNIT_CM), hasM = regs.some(r => r.fmt === 2), hasD = regs.some(r => r.fmt === 3);
  let txt, cls;
  if (!c) { txt = 'Abre una imagen para medir.'; cls = 'warn'; }
  else if (regs.length) { txt = 'Calibrada desde el archivo: ' + [has2d && '2D', hasM && 'modo M', hasD && 'Doppler'].filter(Boolean).join(', ') + '.'; cls = 'ok'; }
  else if (c.cal || c.dop || (it && it.m.pixelCm)) { txt = 'Calibración ' + [c.cal ? `manual de distancia (${dec(c.cal.cm * 10, 3)} mm/px)` : (it.m.pixelCm ? (it.m.pixelApprox ? `aproximada por el detector${it.m.pixelApprox.mag ? ` corregida al isocentro (factor ${dec(it.m.pixelApprox.mag, 2)})` : ' (sin corregir la magnificación: sobrestima)'}. Para medidas exactas, calibra con el catéter` : 'de distancia por tamaño de píxel') : ''), c.dop ? 'manual de Doppler' : ''].filter(Boolean).join(' y ') + '.'; cls = 'ok'; }
  else { txt = 'Esta imagen no trae calibración. Calíbrala antes de medir.'; cls = 'warn'; }
  const pc = state.pendingCal && state.pendingCal.clip === c ? state.pendingCal : null;
  const inCard = !!box.closest('details.mcard'), sumEl = $('calSum');
  if (sumEl) { sumEl.textContent = cls === 'ok' ? (regs.length ? 'Desde el archivo' : 'Manual') : (c ? 'Sin calibrar' : '—'); sumEl.className = 'msum ' + cls; }
  if (inCard && (pc || (state.arm && ['cal', 'dopcal', 'base'].includes(state.arm.t)))) box.closest('details').open = true;
  box.innerHTML = `${inCard ? '' : '<h4>Calibración</h4>'}<div class="calstate ${cls}">${esc(txt)}</div>
    <div class="row">${currentKind() === 'angio' ? '<button class="btn small" data-special="cal" title="Traza una línea a lo ancho del catéter y escribe su calibre">Calibrar con el catéter</button>' : `<button class="btn small" data-special="cal">Calibrar distancia</button><button class="btn small" data-special="dopcal">Calibrar Doppler</button>${hasD ? '<button class="btn small" data-special="base">Ajustar línea de base</button>' : ''}`}</div>
    ${c && (hasD || c.dop) ? (() => { const va = regs.find(r => r.fmt === 3 && r.angle > 0); return `<div class="angle"><label class="fld">Corrección por ángulo del Doppler<span class="row"><input type="number" id="angIn" min="0" max="70" step="1" inputmode="numeric" value="${c.angle || 0}" style="width:80px"><span class="unit">grados</span></span></label>
      <p class="note${(c.angle || 0) > 20 ? ' warnc' : ''}" id="angNote">${va ? `El equipo ya aplicó una corrección de ${Math.round(va.angle)}° a la escala; normalmente no hace falta corregir de nuevo. ` : ''}${(c.angle || 0) > 20 ? 'Por encima de 20° el error es grande: lo ideal es alinear el haz con el flujo.' : 'Se aplica a velocidades, ITV y gradientes de esta secuencia. 0° = sin corrección.'}</p></div>`; })() : ''}
    ${pc ? `<form class="card call" id="calForm"><label class="fld">${pc.t === 'cal' ? 'Longitud real de la línea (cm)' : 'Velocidad de la marca (m/s)'}<input type="number" id="calVal" step="any" min="0" inputmode="decimal" required></label>${pc.t === 'cal' ? '<div class="row"><span class="note">Catéter:</span><button class="btn small" type="button" data-fill="0.167">5F</button><button class="btn small" type="button" data-fill="0.2">6F</button><button class="btn small" type="button" data-fill="0.233">7F</button><button class="btn small" type="button" data-fill="0.267">8F</button></div>' : ''}<div class="row"><button class="btn primary small" type="submit">Aplicar</button><button class="btn small" type="button" id="calCancel">Cancelar</button></div></form>` : ''}`;
  box.querySelectorAll('[data-special]').forEach(b => b.addEventListener('click', () => armSpecial(b.dataset.special)));
  const ai = $('angIn');
  if (ai) ai.addEventListener('change', () => {
    const v = Math.max(0, Math.min(70, parseFloat(ai.value) || 0)); c.angle = v; ai.value = v;
    renderCal(); drawClipViews(c);
    setStatus(v ? `Corrección por ángulo de ${v}° aplicada a las nuevas medidas Doppler de esta secuencia. Vuelve a medir las que ya hiciste.` : 'Sin corrección por ángulo.');
  });
  const form = $('calForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = parseFloat($('calVal').value); if (!(v > 0)) return;
      if (pc.t === 'cal') pc.clip.cal = { cm: v / pc.px }; else pc.clip.dop = { baseY: pc.baseY, cms: v * 100 / pc.dy };
      state.pendingCal = null; renderCal(); drawClipViews(pc.clip);
      setStatus(pc.t === 'cal' ? 'Calibración de distancia aplicada a esta secuencia.' : 'Calibración de Doppler aplicada a esta secuencia.');
    });
    $('calCancel').addEventListener('click', () => { state.pendingCal = null; renderCal(); });
    form.querySelectorAll('[data-fill]').forEach(b => b.addEventListener('click', () => { $('calVal').value = b.dataset.fill; }));
  }
  refreshArmButtons();
}
function focusCalInput() { const i = $('calVal'); if (i) i.focus(); }
function groupOpenSet() {
  if (!state.groupsOpen) {
    let a = null; try { a = JSON.parse(localStorage.getItem('cardon.groups') || 'null'); } catch (e) {}
    state.groupsOpen = new Set(Array.isArray(a) ? a : [DEFS[0].g]);
  }
  return state.groupsOpen;
}
function saveGroupSet(set) { state.groupsOpen = set; try { localStorage.setItem('cardon.groups', JSON.stringify([...set])); } catch (e) {} }
function openGroupOf(k) {
  const g = DEFS.find(x => x.items.some(d => d.k === k)); if (!g) return;
  const set = groupOpenSet(); if (!set.has(g.g)) { set.add(g.g); saveGroupSet(set); }
  const dt = [...document.querySelectorAll('details.mgroup')].find(x => x.dataset.g === g.g); if (dt && !dt.open) dt.open = true;
}
function renderMedValues() {
  const box = $('mGroups'); if (!box) return;
  const st = state.study, sex = (patientOf(st) || {}).sex;
  const openSet = groupOpenSet();
  let lastSec = '';
  const avgBadge = k => { const sm = samplesOf(k), d = DEF[k]; if (sm.length < 2) return ''; const list = sm.map(x => d.t === 'vti' ? (isNum(x.v && x.v.vti) ? `${dec(x.v.vti, 1)} cm` : '') : (isNum(x.v) ? `${toDisplay(x.v, d.q, state.units)}` : '')).filter(Boolean).join(' · '); return `<span class="avgb" title="Promedio de ${sm.length} latidos: ${esc(list)}">×${sm.length}</span>`; };
  box.innerHTML = `<div class="mhead"><h4>Medidas</h4><div class="gtools"><button class="link" type="button" data-gall="1">Abrir todos</button><span>·</span><button class="link" type="button" data-gall="0">Cerrar todos</button></div></div>
    <label class="check small avgchk" title="Al medir de nuevo una variable ya medida, se suma como otro latido y se usa el promedio (hasta ${AVG_MAX}). No aplica a los trazos de volumen."><input type="checkbox" id="avgChk"${state.avg ? ' checked' : ''}> Promediar varios latidos<span class="note">${state.avg ? `Cada nueva medida de la misma variable se suma al promedio (hasta ${AVG_MAX}). Útil en fibrilación auricular.` : 'Desactivado: una nueva medida reemplaza la anterior.'}</span></label>` + DEFS.map(g => {
    const secHead = g.sec && g.sec !== lastSec ? `<div class="msec">${esc(g.sec)}</div>` : ''; lastSec = g.sec || lastSec;
    const done = g.items.filter(d => st.values[d.k] && st.values[d.k].v !== undefined && st.values[d.k].v !== null).length;
    const armed = state.arm && g.items.some(d => d.k === state.arm.k);
    return secHead + `<details class="mgroup" data-g="${esc(g.g)}"${openSet.has(g.g) || armed ? ' open' : ''}><summary><span class="gname">${esc(g.g)}</span><span class="gcount${done ? ' has' : ''}">${done}/${g.items.length}</span></summary><div class="gbody"><p class="note" style="margin-bottom:4px">${esc(g.hint)}</p>${g.items.map(d => {
    const v = st.values[d.k] && st.values[d.k].v;
    const has = v !== undefined && v !== null;
    if (d.t === 'trace' || d.t === 'vti') {
      return `<div class="mrow wide"><button class="mname" data-k="${d.k}" title="${esc(d.h)}">${ICON_RULER}<span>${esc(d.n)}</span>${avgBadge(d.k)}</button><span class="mtext ${has ? '' : 'none'}">${has ? esc(measureText(d.k, v, state.units)) : 'sin medir'}</span><button class="del" data-del="${d.k}" aria-label="Borrar ${esc(d.n)}" ${has ? '' : 'hidden'}>×</button></div>`;
    }
    const flag = has ? flagFor(d.k, v, sex) : null;
    const ref = REF[d.k] ? `Referencia: ${refText(d.k, sex, convFor(d.q, state.units))} ${qUnit(d.q, state.units)}` : '';
    return `<div class="mrow"><button class="mname" data-k="${d.k}" title="${esc(d.h + (ref ? ' ' + ref : ''))}">${d.t === 'num' ? ICON_PEN : ICON_RULER}<span>${esc(d.n)}</span>${avgBadge(d.k)}${flag ? `<span class="flag ${flag}">${flag}</span>` : ''}</button><input type="number" step="any" inputmode="decimal" data-in="${d.k}" value="${has ? toDisplay(v, d.q, state.units) : ''}" aria-label="${esc(d.n)}"><span class="unit">${qUnit(d.q, state.units)}</span><button class="del" data-del="${d.k}" aria-label="Borrar ${esc(d.n)}" ${has ? '' : 'hidden'}>×</button></div>`;
  }).join('')}</div></details>`; }).join('');
  box.querySelectorAll('details.mgroup').forEach(dt => dt.addEventListener('toggle', () => { const set = groupOpenSet(); if (dt.open) set.add(dt.dataset.g); else set.delete(dt.dataset.g); saveGroupSet(set); }));
  box.querySelectorAll('[data-gall]').forEach(b => b.addEventListener('click', () => { const open = b.dataset.gall === '1'; saveGroupSet(new Set(open ? DEFS.map(g => g.g) : [])); box.querySelectorAll('details.mgroup').forEach(dt => { dt.open = open; }); }));
  box.querySelectorAll('.mname[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (DEF[k].t === 'num') { const i = box.querySelector(`[data-in="${k}"]`); if (i) i.focus(); return; }
    armMeasure(k);
  }));
  box.querySelectorAll('[data-in]').forEach(inp => inp.addEventListener('change', e => {
    const k = e.target.dataset.in, d = DEF[k], x = parseFloat(String(e.target.value).replace(',', '.'));
    const items = annosWithKey(k), vals = snapVals([k]);
    if (isFinite(x) && x > 0) state.study.values[k] = { v: fromDisplay(x, d.q, state.units), at: new Date().toISOString(), manual: true };
    else delete state.study.values[k];
    for (const c of state.clips) c.annos = c.annos.filter(n => n.k !== k);
    pushUndo({ type: 'del', items, vals });
    scheduleSave(); renderMedValues(); renderReport(); renderContext(); drawAll();
  }));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    delKey(b.dataset.del);
  }));
  const ac = $('avgChk');
  if (ac) ac.addEventListener('change', () => { state.avg = ac.checked; try { localStorage.setItem('cardon.avg', state.avg ? '1' : '0'); } catch (e) {} renderMedValues(); setStatus(state.avg ? 'Promedio de latidos activado: mide la misma variable en otros latidos para promediarla.' : 'Promedio de latidos desactivado.'); });
  refreshArmButtons();
  renderCalcs();
}
const CALC_ORDER = ['bsa'].concat(SECTIONS.flatMap(s => s[1]).filter(k => !DEF[k]));
function renderCalcs() {
  const box = $('calcs'); if (!box) return;
  const C = computeAll(state.study, patientOf(state.study), state.units);
  const rows = CALC_ORDER.filter(k => C[k]).map(k => {
    const r = C[k];
    return `<div class="crow"><span class="cl">${esc(r.label)}</span><span class="cv">${r.flag ? `<span class="flag ${r.flag}">${r.flag}</span>` : ''}${esc(r.text)}</span>${r.ref || r.note ? `<span class="cr">${r.ref ? 'Referencia: ' + esc(r.ref) : ''}${r.ref && r.note ? ' · ' : ''}${r.note ? esc(r.note) : ''}</span>` : ''}</div>`;
  });
  const sexMissing = !(patientOf(state.study) || {}).sex;
  box.innerHTML = rows.length ? rows.join('') + (sexMissing ? '<p class="note" style="margin-top:8px">Indica el sexo del paciente para comparar con las referencias que dependen de él.</p>' : '') : '<p class="empty">Los cálculos aparecen a medida que agregas medidas. Por ejemplo, con SIV, DdVI y PP se calcula la masa del VI; con peso y talla, los índices.</p>';
}

/* --- Pestaña Reporte --- */
function currentModel() { const st = state.study, k = currentKind(); const view = (k === 'angio' || k === 'tc' || k === 'rm') && !st.kind ? Object.assign({}, st, { kind: k }) : st; return trModel(reportModel(view, patientOf(st), state.units, [state.cfg.doc, state.cfg.reg].filter(Boolean).join(' · '))); }
/* En inglés, el modelo del reporte se traduce una sola vez para la vista previa, Word y la copia de texto */
function trModel(m) {
  if (I18N.lang !== 'en') return m;
  return Object.assign({}, m, {
    title: tr(m.title),
    head: m.head.map(([k, v]) => [tr(k), k === 'Paciente' || k === 'Documento' ? v : tr(v)]),
    sections: m.sections.map(sc => Object.assign({}, sc, { title: tr(sc.title), rows: sc.rows.map(r => Object.assign({}, r, { label: tr(r.label), text: tr(r.text), ref: tr(r.ref), note: r.note ? tr(r.note) : r.note, flag: r.flag ? tr(r.flag) : r.flag })) }))
  });
}
function renderReport() {
  const box = els.rep;
  if (!box.dataset.init) {
    box.dataset.init = '1';
    box.innerHTML = `
      <div class="grid2"><label class="fld">Médico que informa<input type="text" id="r-doc" placeholder="Nombre del médico"></label><label class="fld">Registro médico<input type="text" id="r-reg" placeholder="Ej.: RM 12345"></label></div>
      <p class="note">El logo, la institución, la firma y el pie de página se configuran en <button class="link" id="r-cfg" type="button">Configuración</button>.</p>
      <label class="fld">Conclusión<textarea id="r-concl" rows="5" placeholder="Escribe la conclusión o genérala a partir de las medidas"></textarea></label>
      <div class="tplrow"><button class="btn small" id="r-gen" type="button" title="Redacta la conclusión a partir de las medidas y los cálculos">Generar conclusión</button><select id="r-tpl" class="tplsel" aria-label="Plantilla de conclusión"></select><button class="btn small" id="r-tpl-ins" type="button" title="Insertar la plantilla elegida en la conclusión">Insertar</button></div>
      <div id="r-genask"></div>
      <details class="phr"><summary>Frases frecuentes y plantillas propias</summary>
        <div class="chips" id="r-phr"></div>
        <div class="row"><input type="text" id="r-phr-new" placeholder="Escribe una frase para guardarla"><button class="btn small" id="r-phr-add" type="button">Guardar frase</button></div>
        <div class="row"><button class="btn small" id="r-tpl-save" type="button">Guardar la conclusión actual como plantilla</button><button class="btn small danger" id="r-tpl-del" type="button" hidden>Eliminar plantilla elegida</button></div>
        <div id="r-tpl-form"></div>
        <p class="note">Las plantillas pueden usar valores automáticos entre llaves: {FEVI}, {DdVI}, {DsVI}, {AI}, {EE}, {TAPSE}, {PSAP}, {PAD}, {VCI}, {VIT}, {AVA}, {GMAO}, {ORE}… Los que falten aparecen como ___. Todo se guarda solo en este navegador.</p>
      </details>
      <div class="ractions"><button class="btn primary small" id="r-word" type="button">Descargar Word</button><button class="btn small" id="r-xlsx" type="button" title="Medidas y cálculos de este estudio en Excel (.xlsx)">Excel</button><button class="btn small" id="r-copy" type="button">Copiar texto</button></div>
      <p class="note" id="r-status"></p>
      <div class="report" id="r-prev"></div>`;
    $('r-doc').addEventListener('input', e => { state.cfg.doc = e.target.value; saveCfg(); renderPreview(); });
    $('r-reg').addEventListener('input', e => { state.cfg.reg = e.target.value; saveCfg(); renderPreview(); });
    $('r-cfg').addEventListener('click', () => openDlg('settings'));
    $('r-concl').addEventListener('input', e => { state.study.conclusion = e.target.value; scheduleSave(); renderPreview(); });
    $('r-gen').addEventListener('click', () => {
      const ck = currentKind(), txt = ck === 'angio' ? buildConclusionAngio(state.study) : ck === 'tc' ? buildConclusionCT(state.study) : ck === 'rm' ? buildConclusionMR(state.study, patientOf(state.study)) : buildConclusion(state.study, patientOf(state.study));
      if (!txt) { $('r-status').textContent = 'Aún no hay medidas suficientes para redactar una conclusión.'; return; }
      const cur = state.study.conclusion || '';
      const apply = t => { state.study.conclusion = t; $('r-concl').value = t; scheduleSave(); renderPreview(); $('r-genask').innerHTML = ''; $('r-status').textContent = 'Conclusión generada. Revísala y ajústala antes de firmar.'; };
      if (!cur.trim()) { apply(txt); return; }
      $('r-genask').innerHTML = '<div class="card call"><p class="note" style="color:var(--text)">Ya hay una conclusión escrita.</p><div class="row"><button class="btn small primary" id="gRep" type="button">Reemplazarla</button><button class="btn small" id="gAdd" type="button">Agregar al final</button><button class="btn small" id="gNo" type="button">Cancelar</button></div></div>';
      $('gRep').addEventListener('click', () => apply(txt));
      $('gAdd').addEventListener('click', () => apply(cur.replace(/\s+$/, '') + '\n' + txt));
      $('gNo').addEventListener('click', () => { $('r-genask').innerHTML = ''; });
    });
    $('r-copy').addEventListener('click', async () => {
      const m = currentModel(), head = [state.cfg.inst, state.cfg.line].filter(Boolean).join('\n');
      const t = (head ? head + '\n\n' : '') + reportText(m) + (state.cfg.foot ? '\n\n' + state.cfg.foot : '');
      try { await navigator.clipboard.writeText(t); $('r-status').textContent = 'Reporte copiado.'; }
      catch (e) { $('r-status').textContent = 'No se pudo copiar automáticamente; selecciona el texto de la vista previa.'; }
    });
    $('r-word').addEventListener('click', downloadWord);
    $('r-xlsx').addEventListener('click', () => exportStudyXlsx($('r-status')));
    const insertText = (txt, sep) => {
      const ta = $('r-concl'), cur = ta.value, pos = document.activeElement === ta || ta.dataset.caret ? +(ta.dataset.caret || ta.selectionStart) : cur.length;
      const before = cur.slice(0, pos), after = cur.slice(pos);
      const pre = before && !/\s$/.test(before) ? (sep || ' ') : '';
      ta.value = before + pre + txt + after;
      const np = (before + pre + txt).length; ta.dataset.caret = np;
      state.study.conclusion = ta.value; scheduleSave(); renderPreview();
      ta.focus(); ta.setSelectionRange(np, np);
    };
    $('r-concl').addEventListener('blur', e => { e.target.dataset.caret = e.target.selectionStart; });
    $('r-concl').addEventListener('focus', e => { delete e.target.dataset.caret; });
    $('r-tpl-ins').addEventListener('click', () => {
      const tpl = allTemplates().find(t => t.id === $('r-tpl').value); if (!tpl) return;
      const txt = fillTemplate(tpl.user ? tpl.text : tr(tpl.text), state.study, patientOf(state.study));
      const cur = state.study.conclusion || '';
      const apply = t => { state.study.conclusion = t; $('r-concl').value = t; scheduleSave(); renderPreview(); $('r-genask').innerHTML = ''; $('r-status').textContent = 'Plantilla insertada. Completa los espacios ___ y revisa el texto.'; };
      if (!cur.trim()) { apply(txt); return; }
      $('r-genask').innerHTML = '<div class="card call"><p class="note" style="color:var(--text)">Ya hay una conclusión escrita.</p><div class="row"><button class="btn small primary" id="gRep" type="button">Reemplazarla</button><button class="btn small" id="gAdd" type="button">Agregar al final</button><button class="btn small" id="gNo" type="button">Cancelar</button></div></div>';
      $('gRep').addEventListener('click', () => apply(txt));
      $('gAdd').addEventListener('click', () => apply(cur.replace(/\s+$/, '') + '\n' + txt));
      $('gNo').addEventListener('click', () => { $('r-genask').innerHTML = ''; });
    });
    $('r-tpl').addEventListener('change', () => { $('r-tpl-del').hidden = !$('r-tpl').value.startsWith('u_'); });
    $('r-phr-add').addEventListener('click', () => {
      const t = $('r-phr-new').value.trim(); if (!t) { $('r-phr-new').focus(); return; }
      const list = phrasesList(); if (!list.includes(t)) { list.push(t); state.cfg.phrases = list; saveCfg(); }
      $('r-phr-new').value = ''; renderPhrases();
    });
    $('r-phr-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('r-phr-add').click(); } });
    $('r-tpl-save').addEventListener('click', () => {
      const txt = (state.study.conclusion || '').trim();
      if (!txt) { $('r-status').textContent = 'Escribe primero la conclusión que quieres guardar como plantilla.'; return; }
      $('r-tpl-form').innerHTML = '<form class="card call" id="tplForm"><label class="fld">Nombre de la plantilla<input type="text" id="tplName" required></label><div class="row"><button class="btn small primary" type="submit">Guardar</button><button class="btn small" type="button" id="tplNo">Cancelar</button></div></form>';
      $('tplName').focus();
      $('tplNo').addEventListener('click', () => { $('r-tpl-form').innerHTML = ''; });
      $('tplForm').addEventListener('submit', e => {
        e.preventDefault();
        const name = $('tplName').value.trim(); if (!name) return;
        state.cfg.templates = (state.cfg.templates || []).concat([{ id: 'u_' + Date.now().toString(36), name, kind: currentKind(), text: txt }]);
        saveCfg(); $('r-tpl-form').innerHTML = ''; renderTemplates(); $('r-status').textContent = `Plantilla «${name}» guardada.`;
      });
    });
    $('r-tpl-del').addEventListener('click', () => {
      const id = $('r-tpl').value; if (!id.startsWith('u_')) return;
      state.cfg.templates = (state.cfg.templates || []).filter(t => t.id !== id); saveCfg(); renderTemplates();
    });
    box.insertText = insertText;
  }
  renderTemplates(); renderPhrases();
  const doc = $('r-doc'), reg = $('r-reg'), cc = $('r-concl');
  if (document.activeElement !== doc) doc.value = state.cfg.doc || '';
  if (document.activeElement !== reg) reg.value = state.cfg.reg || '';
  if (document.activeElement !== cc) cc.value = state.study.conclusion || '';
  renderPreview();
}
function allTemplates() { return TEMPLATES.concat((state.cfg.templates || []).map(t => Object.assign({ user: true }, t))); }
function phrasesList() { return Array.isArray(state.cfg.phrases) ? state.cfg.phrases.slice() : PHRASES.slice(); }
function renderTemplates() {
  const sel = $('r-tpl'); if (!sel) return;
  const k = currentKind(), cur = sel.value;
  const list = allTemplates().filter(t => !t.kind || t.kind === k || t.user);
  sel.innerHTML = list.map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.user ? ' (propia)' : ''}</option>`).join('');
  if (list.some(t => t.id === cur)) sel.value = cur;
  sel.hidden = !list.length; const ins = $('r-tpl-ins'); if (ins) ins.hidden = !list.length;
  $('r-tpl-del').hidden = !sel.value.startsWith('u_');
}
function renderPhrases() {
  const box = $('r-phr'); if (!box) return;
  const list = phrasesList();
  box.innerHTML = list.map((p, i) => `<span class="chip"><button type="button" class="chip-t" data-pi="${i}" title="Insertar en la conclusión">${esc(p)}</button><button type="button" class="chip-x" data-px="${i}" aria-label="Quitar la frase">×</button></span>`).join('') || '<span class="note">No hay frases guardadas.</span>';
  box.querySelectorAll('[data-pi]').forEach(b => b.addEventListener('click', () => els.rep.insertText(tr(list[+b.dataset.pi]), ' ')));
  box.querySelectorAll('[data-px]').forEach(b => b.addEventListener('click', () => { list.splice(+b.dataset.px, 1); state.cfg.phrases = list; saveCfg(); renderPhrases(); }));
}
function renderPreview() {
  const m = currentModel(), el = $('r-prev'); if (!el) return;
  const cf = state.cfg;
  const head = cf.logo || cf.inst || cf.line ? `<div class="rhead">${cf.logo ? `<img src="${esc(cf.logo)}" alt="Logo">` : ''}<div>${cf.inst ? `<b>${esc(cf.inst)}</b>` : ''}${cf.line ? `<span>${esc(cf.line)}</span>` : ''}</div></div>` : '';
  el.innerHTML = `${head}<h5>${esc(m.title)}</h5>
    <div class="rsub">${m.head.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ') || 'Asigna un paciente para completar el encabezado.'}</div>
    ${m.sections.length ? m.sections.map(s => `<h6>${esc(s.title)}</h6><table>${s.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="${r.flag ? 'rf' : ''}">${esc(r.text)}${r.flag ? ` (${r.flag})` : ''}</td><td>${esc(r.ref)}</td></tr>${r.note ? `<tr class="rnr"><td colspan="3"><span class="rnote">${esc(r.note)}</span></td></tr>` : ''}`).join('')}</table>`).join('') : '<p class="rnote">Aún no hay medidas en este estudio.</p>'}
    ${m.conclusion ? `<h6>Conclusión</h6><p data-noi18n>${esc(m.conclusion)}</p>` : ''}
    ${cf.sign || m.doctor ? `<div class="rsign">${cf.sign ? `<img src="${esc(cf.sign)}" alt="Firma">` : ''}${cf.doc ? `<b>${esc(cf.doc)}</b>` : ''}${cf.reg ? `<span>${esc(cf.reg)}</span>` : ''}</div>` : ''}
    ${cf.foot ? `<p class="rfoot">${esc(cf.foot)}</p>` : ''}
    <p class="rfoot">${esc(eduFoot())}</p>`;
}
function eduFoot() { return 'Documento generado con Cardón con fines educativos. No es un informe médico ni reemplaza la valoración del especialista.'; }
let docxLoading = null;
function loadDocx() {
  if (window.docx) return Promise.resolve(window.docx);
  if (!docxLoading) docxLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = libURL('docx', 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js');
    s.onload = () => window.docx ? res(window.docx) : rej(new Error('docx'));
    s.onerror = () => { docxLoading = null; rej(new Error('docx')); };
    document.head.append(s);
  });
  return docxLoading;
}
function imgInfo(dataUrl) {
  return new Promise(res => {
    if (!dataUrl) { res(null); return; }
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, data: unb64(dataUrl.split(',')[1]), type: /^data:image\/png/.test(dataUrl) ? 'png' : 'jpg' });
    im.onerror = () => res(null);
    im.src = dataUrl;
  });
}
async function downloadWord() {
  const st = $('r-status');
  st.textContent = 'Preparando el documento…';
  let D;
  try { D = await loadDocx(); } catch (e) { st.textContent = 'No se pudo cargar el generador de Word. Revisa tu conexión e inténtalo de nuevo.'; return; }
  const m = currentModel(), cf = state.cfg, font = 'Calibri';
  const run = (text, o) => new D.TextRun(Object.assign({ text, font, size: 21 }, o || {}));
  const para = (children, o) => new D.Paragraph(Object.assign({ children, spacing: { after: 60 } }, o || {}));
  const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const cell = (text, o) => new D.TableCell({ borders: { top: none, bottom: { style: D.BorderStyle.SINGLE, size: 2, color: 'DDDDDD' }, left: none, right: none }, children: [para([run(text, o && o.run)], { alignment: o && o.align, spacing: { after: 20, before: 20 } })], width: o && o.width });
  const logo = await imgInfo(cf.logo), sign = await imgInfo(cf.sign);
  const fit = (im, maxW, maxH) => { const s = Math.min(maxW / im.w, maxH / im.h, 1); return { width: Math.round(im.w * s), height: Math.round(im.h * s) }; };
  const children = [];
  if (logo || cf.inst || cf.line) {
    const right = [];
    if (cf.inst) right.push(para([run(cf.inst, { bold: true, size: 26 })], { spacing: { after: 20 } }));
    if (cf.line) right.push(para([run(cf.line, { size: 18, color: '5A6663' })]));
    if (!right.length) right.push(para([run('')]));
    const cells = [];
    if (logo) cells.push(new D.TableCell({ borders: { top: none, bottom: none, left: none, right: none }, width: { size: 24, type: D.WidthType.PERCENTAGE }, children: [new D.Paragraph({ children: [new D.ImageRun({ data: logo.data, transformation: fit(logo, 150, 70) })] })] }));
    cells.push(new D.TableCell({ borders: { top: none, bottom: none, left: none, right: none }, children: right, verticalAlign: D.VerticalAlign ? D.VerticalAlign.CENTER : undefined }));
    children.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: noBorders, rows: [new D.TableRow({ children: cells })] }));
    children.push(para([run('')], { spacing: { after: 120 } }));
  }
  children.push(para([run(m.title.toUpperCase(), { bold: true, size: 30 })], { spacing: { after: 120 } }));
  for (const [k, v] of m.head) children.push(para([run(`${k}: `, { bold: true }), run(v)], { spacing: { after: 20 } }));
  for (const s of m.sections) {
    children.push(para([run(s.title.toUpperCase(), { bold: true, size: 22, color: '2F5D5B' })], { spacing: { before: 240, after: 80 } }));
    children.push(new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: noBorders,
      rows: s.rows.map(r => new D.TableRow({ children: [
        cell(r.label + (r.note ? ` — ${r.note}` : ''), { width: { size: 56, type: D.WidthType.PERCENTAGE } }),
        cell(r.text + (r.flag ? ` (${r.flag})` : ''), { align: D.AlignmentType.RIGHT, run: { bold: true, color: r.flag ? 'B0402C' : undefined }, width: { size: 22, type: D.WidthType.PERCENTAGE } }),
        cell(r.ref || '', { align: D.AlignmentType.RIGHT, run: { color: '6A7673', size: 18 }, width: { size: 22, type: D.WidthType.PERCENTAGE } })
      ] }))
    }));
  }
  if (m.conclusion) {
    children.push(para([run(I18N.lang === 'en' ? 'CONCLUSION' : 'CONCLUSIÓN', { bold: true, size: 22, color: '2F5D5B' })], { spacing: { before: 240, after: 80 } }));
    for (const line of m.conclusion.split('\n')) children.push(para([run(line)]));
  }
  if (sign || cf.doc || cf.reg) {
    children.push(para([run('')], { spacing: { before: 360 } }));
    if (sign) children.push(new D.Paragraph({ children: [new D.ImageRun({ data: sign.data, transformation: fit(sign, 180, 80) })] }));
    if (cf.doc) children.push(para([run(cf.doc, { bold: true })], { spacing: { after: 0 } }));
    if (cf.reg) children.push(para([run(cf.reg, { size: 19, color: '5A6663' })]));
  }
  const section = { properties: { page: { margin: { top: 1000, bottom: 1000, left: 1134, right: 1134 } } }, children };
  section.footers = { default: new D.Footer({ children: [cf.foot ? new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [run(cf.foot, { size: 16, color: '6A7673' })] }) : null, new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [run(tr(eduFoot()), { size: 14, color: '6A7673', italics: true })] })].filter(Boolean) }) };
  const doc = new D.Document({ creator: 'Cardón (Dr. Martín Arrieta)', title: m.title, sections: [section] });
  let blob;
  try { blob = await D.Packer.toBlob(doc); } catch (e) { st.textContent = tr('No se pudo generar el documento.'); return; }
  const pt = patientOf(state.study);
  const safe = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  await saveFile(`${I18N.lang === 'en' ? 'Echo' : 'Eco'}_${safe(pt ? pt.name : 'sin_paciente') || 'paciente'}_${state.study.date || todayISO()}.docx`, blob, st);
}
