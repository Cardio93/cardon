/* ======================= Angio-TC coronaria (CAD-RADS 2.0) =======================
   Modelo de 18 segmentos SCCT. Categoría por la estenosis máxima; modificadores P (carga de placa),
   HRP (placa de alto riesgo), N, S, G, E e I. */
const CTA_SEGS = [
  { v: 'TCI', n: 'Tronco coronario izquierdo', segs: [['lm', 5, 'Tronco coronario izquierdo']] },
  { v: 'DA', n: 'Descendente anterior', segs: [['lad_p', 6, 'DA proximal'], ['lad_m', 7, 'DA media'], ['lad_d', 8, 'DA distal'], ['d1', 9, 'Primera diagonal'], ['d2', 10, 'Segunda diagonal']] },
  { v: 'Cx', n: 'Circunfleja', segs: [['cx_p', 11, 'Cx proximal'], ['om1', 12, 'Primera obtusa marginal'], ['cx_d', 13, 'Cx media-distal'], ['om2', 14, 'Segunda obtusa marginal'], ['lpda', 15, 'Descendente posterior izquierda'], ['lplb', 18, 'Posterolateral izquierda'], ['ri', 17, 'Ramo intermedio']] },
  { v: 'CD', n: 'Coronaria derecha', segs: [['rca_p', 1, 'CD proximal'], ['rca_m', 2, 'CD media'], ['rca_d', 3, 'CD distal'], ['rpda', 4, 'Descendente posterior derecha'], ['rplb', 16, 'Posterolateral derecha']] }
];
const CTA_NAME = {}, CTA_VES = {};
for (const g of CTA_SEGS) for (const [k, , n] of g.segs) { CTA_NAME[k] = n; CTA_VES[k] = g.v; }
const CTA_PLAQUE = { '': '—', calc: 'Calcificada', nocalc: 'No calcificada', mixta: 'Mixta' };
const CTA_HRP = [['pr', 'Remodelado positivo'], ['lap', 'Placa de baja atenuación (< 30 UH)'], ['nr', 'Signo del anillo de servilleta'], ['sc', 'Calcificación puntiforme']];
const CTA_REC = {
  0: 'Sin enfermedad coronaria aterosclerótica. Considerar causas no ateroscleróticas del dolor torácico.',
  1: 'Enfermedad coronaria mínima no obstructiva (1–24 %). Prevención y control de factores de riesgo.',
  2: 'Enfermedad coronaria leve no obstructiva (25–49 %). Prevención y control de factores de riesgo.',
  3: 'Estenosis moderada (50–69 %). Considerar prueba funcional; prevención y tratamiento antianginoso.',
  '4A': 'Estenosis severa (70–99 %). Considerar coronariografía invasiva o prueba funcional.',
  '4B': 'Tronco ≥ 50 % o enfermedad obstructiva de tres vasos (≥ 70 %). Se recomienda coronariografía invasiva.',
  5: 'Oclusión total (100 %). Considerar coronariografía invasiva y evaluación de viabilidad.'
};
function ctaCat(p) { return !(p > 0) ? 0 : p < 25 ? 1 : p < 50 ? 2 : p < 70 ? 3 : p < 100 ? 4 : 5; }
function ctaState(st) { const C = st.cta || (st.cta = {}); C.segs = C.segs || {}; C.mods = C.mods || {}; return C; }
function computeCTA(st) {
  const C = ctaState(st), V = st.values || {}, segs = [];
  for (const g of CTA_SEGS) for (const [k, num, n] of g.segs) {
    const pct = V['cta_' + k] && isNum(V['cta_' + k].v) ? V['cta_' + k].v : null, meta = C.segs[k] || {};
    const hrp = (meta.hrp || []).filter(Boolean);
    if (pct !== null || meta.plaque || hrp.length) segs.push({ k, num, n, ves: g.v, pct: pct || 0, cat: ctaCat(pct || 0), plaque: meta.plaque || '', hrp });
  }
  const max = segs.reduce((m, s) => Math.max(m, s.cat), 0);
  const lm50 = segs.some(s => s.k === 'lm' && s.pct >= 50);
  const sev = new Set(segs.filter(s => s.pct >= 70 && s.k !== 'lm').map(s => s.ves));
  const three = ['DA', 'Cx', 'CD'].every(v => sev.has(v));
  let cat = String(max);
  if (max === 4) cat = lm50 || three ? '4B' : '4A';
  else if (lm50 && max < 5) cat = '4B';
  const sis = segs.filter(s => s.pct > 0 || s.plaque).length;
  const cac = computeCAC(st), useCac = cac.lesions.length > 0 || st.cacDone;
  const P = useCac ? (cac.total <= 0 ? 0 : cac.total <= 100 ? 1 : cac.total <= 300 ? 2 : cac.total <= 1000 ? 3 : 4) : (sis === 0 ? 0 : sis <= 2 ? 1 : sis <= 4 ? 2 : sis <= 7 ? 3 : 4);
  const hrpSegs = segs.filter(s => s.hrp.length >= 2);
  const mods = [];
  if (P > 0) mods.push('P' + P);
  if (hrpSegs.length) mods.push('HRP');
  if (C.mods.I) mods.push('I' + C.mods.I);
  if (C.mods.S) mods.push('S'); if (C.mods.G) mods.push('G'); if (C.mods.E) mods.push('E'); if (C.mods.N) mods.push('N');
  const any = segs.length > 0 || C.done;
  return { segs, max, cat, P, pSource: useCac ? 'cac' : 'sis', sis, hrpSegs, mods, any, text: any ? `CAD-RADS ${cat}${mods.length ? '/' + mods.join('/') : ''}` : '', rec: any ? CTA_REC[cat] : '' };
}
function renderCTASection(st) {
  const C = ctaState(st), R = computeCTA(st), V = st.values || {}, open = groupOpenSet();
  const segRow = (k, num, n) => {
    const v = V['cta_' + k] && V['cta_' + k].v, has = isNum(v), meta = C.segs[k] || {}, cat = ctaCat(has ? v : 0), hrpN = (meta.hrp || []).length;
    return `<div class="ctarow"><button class="mname" data-ctaseg="${k}" title="Medir la estenosis de ${esc(n)} sobre la imagen">${ICON_RULER}<span><small class="segn">${num}</small> ${esc(n)}</span></button>
      <input type="number" min="0" max="100" step="1" inputmode="numeric" data-ctapct="${k}" class="${has ? 'cat' + cat : ''}" value="${has ? v : ''}" aria-label="${esc(n)} (%)" placeholder="%" title="${has ? ['Sin estenosis', 'Mínima (1–24 %)', 'Leve (25–49 %)', 'Moderada (50–69 %)', 'Severa (70–99 %)', 'Oclusión'][cat] : 'Estenosis (%)'}">
      <select data-ctapl="${k}" aria-label="Tipo de placa en ${esc(n)}" title="Tipo de placa">${Object.entries(CTA_PLAQUE).map(([x, l]) => `<option value="${x}"${(meta.plaque || '') === x ? ' selected' : ''}>${({ calc: 'Calcif.', nocalc: 'No calcif.', mixta: 'Mixta' })[x] || l}</option>`).join('')}</select>
      <button class="btn small hrpb${hrpN ? ' on' : ''}" type="button" data-ctahrp="${k}" title="Características de alto riesgo">${hrpN ? `AR ${hrpN}` : 'AR'}</button></div>
      ${C.hrpOpen === k ? `<div class="hrpbox">${CTA_HRP.map(([h, l]) => `<label class="check small"><input type="checkbox" data-hrp="${k}:${h}"${(meta.hrp || []).includes(h) ? ' checked' : ''}> ${l}</label>`).join('')}<p class="note">Placa de alto riesgo (HRP) = 2 o más características.</p></div>` : ''}`;
  };
  return `
    <div class="ctasum card">
      <div class="ctacat"><b>${R.text ? esc(R.text) : 'CAD-RADS —'}</b><span class="note">${R.any ? esc(R.rec) : 'Ingresa la estenosis de cada segmento con placa (o marca «Revisé todos los segmentos» si no hay enfermedad).'}</span></div>
      ${R.any ? `<div class="note">Carga de placa ${R.P ? 'P' + R.P : 'P0'} ${R.pSource === 'cac' ? 'por el score de calcio de este estudio' : `por el número de segmentos con placa (${R.sis})`}${R.hrpSegs.length ? ` · Placa de alto riesgo en ${R.hrpSegs.map(s => esc(CTA_NAME[s.k])).join(', ')}` : ''}.</div>` : ''}
    </div>
    <label class="check small"><input type="checkbox" id="ctaDone"${C.done ? ' checked' : ''}> Revisé todos los segmentos (los no ingresados no tienen placa)</label>
    <p class="note">Pulsa el nombre del segmento para medir la estenosis sobre la imagen (primero el vaso de referencia y luego la lesión), o escribe el porcentaje. AR = características de placa de alto riesgo.</p>
    ${CTA_SEGS.map(g => { const gk = 'cta:' + g.v, cnt = R.segs.filter(s => s.ves === g.v).length; return `<details class="mgroup" data-g="${gk}"${open.has(gk) ? ' open' : ''}><summary><span class="gname">${esc(g.n)}</span><span class="gcount${cnt ? ' has' : ''}">${cnt}</span></summary><div class="gbody">${g.segs.map(([k, num, n]) => segRow(k, num, n)).join('')}</div></details>`; }).join('')}
    <details class="mgroup" data-g="cta:mods"${open.has('cta:mods') ? ' open' : ''}><summary><span class="gname">Modificadores</span><span class="gcount${['N', 'S', 'G', 'E', 'I'].some(x => C.mods[x]) ? ' has' : ''}">${['N', 'S', 'G', 'E', 'I'].filter(x => C.mods[x]).length}</span></summary><div class="gbody">
      <label class="check small"><input type="checkbox" data-ctamod="N"${C.mods.N ? ' checked' : ''}> N · estudio no diagnóstico en algún segmento</label>
      <label class="check small"><input type="checkbox" data-ctamod="S"${C.mods.S ? ' checked' : ''}> S · stent</label>
      <label class="check small"><input type="checkbox" data-ctamod="G"${C.mods.G ? ' checked' : ''}> G · injerto coronario</label>
      <label class="check small"><input type="checkbox" data-ctamod="E"${C.mods.E ? ' checked' : ''}> E · excepciones (anomalía, disección, aneurisma, fístula…)</label>
      <label class="fld">I · isquemia (FFR-TC o perfusión)<select data-ctamod="I"><option value="">No evaluada</option>${['+', '-', '+/-'].map(x => `<option value="${x}"${C.mods.I === x ? ' selected' : ''}>I${x}</option>`).join('')}</select></label>
    </div></details>
    <p class="note">CAD-RADS 2.0 (SCCT/ACR/NASCI 2022). Las recomendaciones son orientativas; intégralas con la clínica.</p>`;
}
function bindCTASection(box, st) {
  const C = ctaState(st), save = () => { scheduleSave(); renderCTMed(); renderReport(); renderContext(); };
  box.querySelectorAll('[data-ctaseg]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.ctaseg;
    if (!state.cur) { setStatus('Abre una imagen para medir.'); return; }
    if (state.arm && state.arm.ctaSeg === k) { disarm(); return; }
    state.arm = { k: null, free: 'sten', ctaSeg: k, t: 'sten', name: `${CTA_NAME[k]}: estenosis`, help: FREE.sten[1], pts: [], err: '' };
    startArm();
  }));
  box.querySelectorAll('[data-ctapct]').forEach(inp => inp.addEventListener('change', e => {
    const k = e.target.dataset.ctapct, key = 'cta_' + k, x = parseFloat(String(e.target.value).replace(',', '.'));
    const items = annosWithKey(key), vals = snapVals([key]);
    if (isFinite(x) && x >= 0) st.values[key] = { v: Math.min(100, Math.round(x)), at: new Date().toISOString(), manual: true }; else delete st.values[key];
    for (const c of state.clips) c.annos = c.annos.filter(n => n.k !== key);
    pushUndo({ type: 'del', items, vals }); drawAll(); save();
  }));
  box.querySelectorAll('[data-ctapl]').forEach(sel => sel.addEventListener('change', e => { const k = e.target.dataset.ctapl; (C.segs[k] = C.segs[k] || {}).plaque = e.target.value; save(); }));
  box.querySelectorAll('[data-ctahrp]').forEach(b => b.addEventListener('click', () => { C.hrpOpen = C.hrpOpen === b.dataset.ctahrp ? null : b.dataset.ctahrp; renderCTMed(); }));
  box.querySelectorAll('[data-hrp]').forEach(chk => chk.addEventListener('change', e => {
    const [k, h] = e.target.dataset.hrp.split(':'), m = C.segs[k] = C.segs[k] || {}, set = new Set(m.hrp || []);
    if (e.target.checked) set.add(h); else set.delete(h);
    m.hrp = [...set]; save();
  }));
  box.querySelectorAll('[data-ctamod]').forEach(el => el.addEventListener('change', e => { C.mods[e.target.dataset.ctamod] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; save(); }));
  const d = $('ctaDone'); if (d) d.addEventListener('change', e => { C.done = e.target.checked; save(); });
}
function ctaReportSection(st) {
  const R = computeCTA(st); if (!R.any) return null;
  const rows = R.segs.filter(s => s.pct > 0 || s.plaque).map(s => ({ label: `${s.num}. ${CTA_NAME[s.k]}`, text: s.pct >= 100 ? 'Oclusión total' : `${dec(s.pct, 0)} %`, ref: [CTA_PLAQUE[s.plaque] !== '—' ? CTA_PLAQUE[s.plaque] : '', s.hrp.length >= 2 ? 'alto riesgo' : ''].filter(Boolean).join(' · '), flag: s.cat >= 4 ? 'alto' : null }));
  if (!rows.length) rows.push({ label: 'Arterias coronarias', text: 'Sin placa', ref: '', flag: null });
  rows.push({ label: 'Clasificación', text: R.text, ref: '', flag: ['3', '4A', '4B', '5'].includes(R.cat) ? 'alto' : null, note: R.rec });
  return { title: 'Angiografía coronaria por TC', rows };
}
function ctaConclusion(st) {
  const R = computeCTA(st); if (!R.any) return '';
  const en = I18N.lang === 'en', L = [];
  const sig = R.segs.filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct);
  if (!sig.length) L.push(en ? 'Coronary arteries without atherosclerotic plaque.' : 'Arterias coronarias sin placa aterosclerótica.');
  else {
    const desc = s => {
      const pl = s.plaque ? (en ? { calc: 'calcified', nocalc: 'non-calcified', mixta: 'mixed' }[s.plaque] : CTA_PLAQUE[s.plaque].toLowerCase()) : '';
      const hr = s.hrp.length >= 2 ? (en ? ', high-risk features' : ', con características de alto riesgo') : '';
      const nm = lc1(en ? tr(CTA_NAME[s.k]) : CTA_NAME[s.k]);
      return s.pct >= 100 ? (en ? `total occlusion of the ${nm}` : `oclusión total de ${nm}`) : en ? `${dec(s.pct, 0)} % ${pl ? pl + ' ' : ''}plaque in the ${nm}${hr}` : `placa ${pl ? pl + ' ' : ''}con estenosis de ${dec(s.pct, 0)} % en ${nm}${hr}`;
    };
    const t = sig.map(desc).join('; ');
    L.push((en ? 'Coronary CT angiography: ' : 'Angio-TC coronaria: ') + t + '.');
  }
  L.push(`${R.text}. ${en ? tr(R.rec) : R.rec}`);
  return L.join('\n');
}

/* --- Panel de medidas de TC --- */
function renderCTMed() {
  const st = state.study, box = els.med; if (!box) return;
  if (!state.ctTab) state.ctTab = Object.keys(st.values || {}).some(k => k.startsWith('cta_')) || (st.cta && st.cta.done) ? 'cta' : 'cac';
  const c0 = state.cur && clipKind(state.cur) === 'tc' ? state.cur : state.clips.find(x => clipKind(x) === 'tc'), c = c0 && c0.mpr ? c0.mpr.src : c0 && c0.cpr ? c0.cpr.src : c0;
  const m = c ? c.items[0].m : {}, R = computeCAC(st), cards = cardState();
  const mprOn = !!(c && state.vps.some(v => v.clip && v.clip.mpr && v.clip.mpr.src === c));
  const thick = m.thick, zs = c ? clipZStep(c) : 0, pxmm = m.pixelCm ? m.pixelCm * 10 : 0;
  const thickOk = !thick || (thick >= 2.5 && thick <= 3.0);
  const lesions = R.lesions.slice().sort((a, b) => (a.slice || 0) - (b.slice || 0));
  box.innerHTML = `
    <div class="mtop">${kindPicker()}</div>
    <details class="mgroup mcard" data-card="ctinfo"${cards.ctinfo ? ' open' : ''}><summary><span class="gname">Datos de la serie</span><span class="msum${thickOk ? '' : ' warn'}">${thick ? `Espesor ${dec(thick, 1)} mm` : 'Sin espesor'}${pxmm ? ` · píxel ${dec(pxmm, 2)} mm` : ''}</span></summary><div class="gbody">
      <dl class="kv">
        <dt>Serie</dt><dd>${esc(m.seriesDesc || '—')}</dd>
        <dt>Cortes</dt><dd>${c ? c.items.length : '—'}</dd>
        <dt>Espesor</dt><dd>${thick ? dec(thick, 2) + ' mm' : '—'}</dd>
        <dt>Intervalo</dt><dd>${zs ? dec(zs, 2) + ' mm' : '—'}</dd>
        <dt>Píxel</dt><dd>${pxmm ? dec(pxmm, 3) + ' mm' : '—'}</dd>
        <dt>Tensión</dt><dd>${m.kvp ? m.kvp + ' kV' : '—'}</dd>
      </dl>
      <label class="fld">Fecha<input type="date" id="s-date" value="${esc(st.date || '')}"></label>
    </div></details>
    <div class="mprbox">
      <button class="btn small${mprOn ? '' : ' primary'}" type="button" id="mprBtn"${mprCapable(c) ? '' : ' disabled title="Necesita una serie axial de TC con al menos 8 cortes"'}>${mprOn ? 'Restablecer los planos (MPR)' : 'Ver en 3 planos (MPR)'}</button>
      ${mprOn && c.mprS ? (() => { const sl = c.mprS.slab || { mm: 0, mode: 'mip' }, D = state.cprDraw && state.cprDraw.src === c ? state.cprDraw : null; return `
      <div class="slab"><span class="fldl">Grosor</span><div class="seg" role="group" aria-label="Grosor del corte">${[0, 3, 5, 10, 20].map(v => `<button class="btn" type="button" data-slab="${v}" aria-pressed="${(sl.mm || 0) === v}">${v ? v + ' mm' : 'Fino'}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Modo del corte grueso">${Object.entries(SLAB_MODES).map(([k, n]) => `<button class="btn" type="button" data-slabmode="${k}" aria-pressed="${sl.mode === k}"${sl.mm ? '' : ' disabled'} title="${k === 'mip' ? 'Máxima intensidad: resalta el contraste y el calcio' : k === 'avg' ? 'Promedio: menos ruido' : 'Mínima intensidad: resalta el aire y la grasa'}">${n}</button>`).join('')}</div></div>
      <div class="cprbox">${D ? `<span class="note"><b>${D.pts.length}</b> ${D.pts.length === 1 ? 'punto marcado.' : 'puntos marcados.'} Clic en el centro de la arteria, avanzando por su recorrido.</span>
        <div class="row"><button class="btn small primary" type="button" id="cprGo"${D.pts.length >= 2 ? '' : ' disabled'}>Terminar (Enter)</button><button class="btn small" type="button" id="cprUndo"${D.pts.length ? '' : ' disabled'}>Deshacer punto</button><button class="btn small" type="button" id="cprNo">Cancelar</button></div>`
        : `<button class="btn small" type="button" id="cprStart" title="Marca el recorrido de una coronaria y obtén una imagen estirada del vaso">Reconstrucción curva de una coronaria</button>`}
        ${state.clips.filter(x => x.cpr && x.cpr.src === c).map(x => `<div class="cprrow"><button class="link" type="button" data-cprshow="${x.cpr.n}">Curva ${x.cpr.n}</button><span class="note">${dec(x.cpr.path.len, 0)} mm</span><button class="del" type="button" data-cprdel="${x.cpr.n}" aria-label="Borrar la curva ${x.cpr.n}">×</button></div>`).join('')}</div>`; })() : ''}
      <span class="note">${state.busyMpr ? 'Preparando el volumen…' : mprOn ? 'Arrastra una línea punteada para mover ese plano o un extremo (círculo) para girarlo; Ctrl + clic lleva los planos a ese punto. «Restablecer» vuelve a los planos rectos.' : 'Axial, coronal y sagital enlazados, con líneas de referencia y planos oblicuos.'}</span>
    </div>
    <div class="seg full cttabs" role="tablist"><button class="btn" type="button" data-cttab="cac" aria-pressed="${state.ctTab !== 'cta'}">Score de calcio</button><button class="btn" type="button" data-cttab="cta" aria-pressed="${state.ctTab === 'cta'}">Angio-TC coronaria</button></div>
    ${state.ctTab === 'cta' ? renderCTASection(st) : `
    <div class="mhead"><h4>Score de calcio coronario</h4><span class="note">Agatston</span></div>
    <p class="note">Usa la serie sin contraste. Elige la arteria y haz clic sobre cada placa de calcio (≥ 130 UH) en cada corte donde aparezca. Esc para terminar.</p>
    ${thickOk ? '' : `<p class="note warnc">El método de Agatston se definió con cortes de 3 mm; con cortes de ${dec(thick, 1)} mm el valor no es comparable con las tablas de referencia.</p>`}
    <label class="check small"><input type="checkbox" id="cacHi"${state.cacHi ? ' checked' : ''}> Resaltar en magenta lo que supera 130 UH</label>
    <div class="cactable">
      ${Object.entries(CAC_ART).map(([k, A]) => { const b = R.by[k]; return `<div class="cacrow"><button class="mname" data-cac="${k}" title="Marcar calcio en ${esc(A.n)}"><i class="dot" style="background:${A.col}"></i><span>${esc(A.n)}</span></button><span class="mtext">${b.n ? `${b.n} ${b.n === 1 ? 'lesión' : 'lesiones'}` : ''}</span><b class="cacv">${dec(b.score, 0)}</b></div>`; }).join('')}
      <div class="cacrow total"><span>Total de Agatston</span><span class="mtext">${dec(R.vol, 0)} mm³</span><b class="cacv">${dec(R.total, 0)}</b></div>
    </div>
    <div class="calstate ${R.A >= 2 ? 'warn' : 'ok'}">${R.lesions.length || st.cacDone ? `${esc(R.drs)} · ${esc(R.cat)}` : 'Aún no hay lesiones marcadas.'}</div>
    <label class="check small"><input type="checkbox" id="cacDone"${st.cacDone ? ' checked' : ''}> Revisé todos los cortes (permite informar un score de 0)</label>
    ${lesions.length ? `<details class="mgroup" open><summary><span class="gname">Lesiones</span><span class="gcount has">${lesions.length}</span></summary><div class="gbody">
      ${lesions.map(l => `<div class="lesrow"><button class="link" data-goslice="${l.slice}" title="Ir al corte">Corte ${l.slice}</button><span><i class="dot" style="background:${(CAC_ART[l.art] || CAC_ART.da).col}"></i>${esc((CAC_ART[l.art] || {}).s || '')}</span><span class="mono">${dec(l.area, 1)} mm² · ${Math.round(l.peak)} UH</span><b>${dec(l.v, 0)}</b><button class="del" data-del="${l.key}" aria-label="Borrar lesión">×</button></div>`).join('')}
    </div></details>` : ''}
    <p class="note">Referencia: 0 sin calcio · 1–99 leve · 100–299 moderado · ≥ 300 severo (CAC-DRS, SCCT 2018). El score depende de marcar todas las placas.</p>`}`;
  bindKindPicker(); bindCards(box);
  const mb = $('mprBtn'); if (mb) mb.addEventListener('click', () => { if (c) openMPR(c, { reset: mprOn }); });
  box.querySelectorAll('[data-cprdel]').forEach(b => b.addEventListener('click', () => { const x = state.clips.find(k => k.cpr && k.cpr.src === c && String(k.cpr.n) === b.dataset.cprdel); if (x) cprDelete(x); }));
  box.querySelectorAll('[data-cprshow]').forEach(b => b.addEventListener('click', () => { const x = state.clips.find(k => k.cpr && k.cpr.src === c && String(k.cpr.n) === b.dataset.cprshow); if (x) { if (state.layout !== 4) setLayout(4); setActive(3); select(x); } }));
  box.querySelectorAll('[data-slab]').forEach(b => b.addEventListener('click', () => mprSetSlab(c, +b.dataset.slab)));
  box.querySelectorAll('[data-slabmode]').forEach(b => b.addEventListener('click', () => mprSetSlab(c, (c.mprS.slab || {}).mm || 0, b.dataset.slabmode)));
  const cs = $('cprStart'); if (cs) cs.addEventListener('click', () => cprStart(c));
  const cg = $('cprGo'); if (cg) cg.addEventListener('click', cprFinish);
  const cu = $('cprUndo'); if (cu) cu.addEventListener('click', cprUndo);
  const cn = $('cprNo'); if (cn) cn.addEventListener('click', cprCancel);
  box.querySelectorAll('[data-cttab]').forEach(b => b.addEventListener('click', () => { state.ctTab = b.dataset.cttab; if (state.arm) disarm(); renderCTMed(); }));
  box.querySelectorAll('details.mgroup[data-g]').forEach(dt => dt.addEventListener('toggle', () => { const set = groupOpenSet(); if (dt.open) set.add(dt.dataset.g); else set.delete(dt.dataset.g); saveGroupSet(set); }));
  if (state.ctTab === 'cta') { bindCTASection(box, st); refreshArmButtons(); return; }
  const sd = $('s-date'); if (sd) sd.addEventListener('change', e => { st.date = e.target.value; scheduleSave(); renderContext(); renderReport(); });
  if (!$('cacHi')) return;
  $('cacHi').addEventListener('change', e => { state.cacHi = e.target.checked; drawAll(); });
  $('cacDone').addEventListener('change', e => { st.cacDone = e.target.checked; scheduleSave(); renderCTMed(); renderReport(); });
  box.querySelectorAll('[data-cac]').forEach(b => b.addEventListener('click', () => armCac(b.dataset.cac)));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => delKey(b.dataset.del, 'Lesión borrada.')));
  box.querySelectorAll('[data-goslice]').forEach(b => b.addEventListener('click', () => { const tc = state.clips.find(x => clipKind(x) === 'tc'); if (tc) select(tc, (+b.dataset.goslice || 1) - 1); }));
  refreshArmButtons();
}
function reportModelCT(st, pt, doctor) {
  const R = computeCAC(st), sex = pt && pt.sex, age = pt ? ageAt(pt.birth, st.date) : null, sections = [];
  if (R.lesions.length || st.cacDone) {
    const rows = Object.entries(CAC_ART).map(([k, A]) => ({ label: A.n, text: dec(R.by[k].score, 0), ref: R.by[k].n ? `${R.by[k].n} ${R.by[k].n === 1 ? 'lesión' : 'lesiones'}` : '', flag: null }));
    rows.push({ label: 'Score total de Agatston', text: dec(R.total, 0), ref: '', flag: R.total >= 100 ? 'alto' : null });
    rows.push({ label: 'Volumen de calcio', text: `${dec(R.vol, 0)} mm³`, ref: '', flag: null });
    rows.push({ label: 'Categoría', text: R.drs, ref: '', flag: null, note: R.cat + '.' });
    sections.push({ title: 'Score de calcio coronario (Agatston)', rows });
  }
  const cta = ctaReportSection(st); if (cta) sections.push(cta);
  const head = [['Paciente', pt ? pt.name : ''], ['Documento', pt ? pt.doc : ''], ['Edad', age !== null ? `${age} años` : ''], ['Sexo', sex === 'H' ? 'Masculino' : sex === 'M' ? 'Femenino' : ''], ['Fecha del estudio', st.date ? st.date.split('-').reverse().join('/') : '']].filter(x => x[1]);
  return { title: 'Tomografía cardíaca', head, sections, conclusion: st.conclusion || '', doctor: doctor || '' };
}
function buildConclusionCT(st) {
  const R = computeCAC(st), L = [], en = I18N.lang === 'en', cta = ctaConclusion(st);
  if (R.lesions.length || st.cacDone) {
    const parts = Object.entries(CAC_ART).map(([k, A]) => `${en ? { TCI: 'LM', DA: 'LAD', Cx: 'LCx', CD: 'RCA' }[A.s] : A.s} ${dec(R.by[k].score, 0)}`).join(', ');
    if (R.total <= 0) L.push(en ? 'Coronary artery calcium score of 0 (CAC-DRS 0): no detectable coronary calcium.' : 'Score de calcio coronario de 0 (CAC-DRS 0): sin calcio coronario detectable.');
    else L.push(en ? `Agatston coronary artery calcium score ${dec(R.total, 0)} (${parts}); calcium volume ${dec(R.vol, 0)} mm³. ${R.drs}: ${tr(R.cat).toLowerCase()}.` : `Score de calcio coronario de Agatston ${dec(R.total, 0)} (${parts}); volumen de calcio ${dec(R.vol, 0)} mm³. ${R.drs}: ${R.cat.toLowerCase()}.`);
  }
  if (cta) L.push(cta);
  return L.join('\n');
}
