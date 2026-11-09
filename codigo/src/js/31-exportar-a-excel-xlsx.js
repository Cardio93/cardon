/* ======================= Exportar a Excel (.xlsx) =======================
   Libro mínimo en formato Office Open XML, empaquetado con JSZip (ya incluido). */
function xlsxCol(i) { let t = ''; i++; while (i) { const m = (i - 1) % 26; t = String.fromCharCode(65 + m) + t; i = Math.floor((i - 1) / 26); } return t; }
const xmlEsc = v => String(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function sheetXML(rows, widths) {
  const cols = widths && widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    if (v === null || v === undefined || v === '') return '';
    const ref = xlsxCol(ci) + (ri + 1), sty = ri === 0 ? ' s="1"' : '';
    if (typeof v === 'number') return isFinite(v) ? `<c r="${ref}"${sty}><v>${+v.toPrecision(12)}</v></c>` : '';
    return `<c r="${ref}" t="inlineStr"${sty}><is><t xml:space="preserve">${xmlEsc(tr(v))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
}
async function buildXlsx(sheets) {
  const JSZip = await loadZip(), z = new JSZip(), X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = 'http://schemas.openxmlformats.org', REL = NS + '/officeDocument/2006/relationships';
  z.file('[Content_Types].xml', `${X}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  z.file('_rels/.rels', `${X}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `${X}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(tr(sh.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="${NS}/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
  z.file('xl/styles.xml', `${X}<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach((sh, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXML(sh.rows, sh.widths)));
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
}
/* Texto de un cálculo («65 %», «1,85 m²») → número y unidad */
function splitNum(text) { const m = /^\s*(-?\d+(?:[,.]\d+)?)\s*(.*)$/.exec(String(text || '')); return m && !/\s/.test(m[2]) ? { v: parseFloat(m[1].replace(',', '.')), u: m[2] } : { v: String(text || ''), u: '' }; }
/* Columnas numéricas de cada medida del paquete eco: [{ key, label, unit, get(valueObj) }] */
function measureColumns(units) {
  const cols = [];
  for (const g of DEFS) for (const d of g.items) {
    if (d.t === 'trace') {
      cols.push({ k: d.k, g, d, label: `${d.n} · área`, unit: 'cm²', get: v => v && v.area });
      if (!d.areaOnly) cols.push({ k: d.k, g, d, label: `${d.n} · volumen`, unit: 'ml', get: v => v && v.vol });
    } else if (d.t === 'vti') {
      cols.push({ k: d.k, g, d, label: `${d.n}`, unit: 'cm', get: v => v && v.vti });
      cols.push({ k: d.k, g, d, label: `${d.n} · Vmax`, unit: 'm/s', get: v => v && isNum(v.vmax) ? v.vmax / 100 : null });
    } else cols.push({ k: d.k, g, d, label: d.n, unit: qUnit(d.q, units), get: v => isNum(v) ? toDisplay(v, d.q, units) : null, fmt: x => isNum(x) ? toDisplay(x, d.q, units) : null });
  }
  return cols;
}
const r3 = x => isNum(x) ? +x.toFixed(3) : x;
function studySheets(st, pt, units) {
  const kind = studyKindOf(st), sheets = [];
  const age = pt ? ageAt(pt.birth, st.date) : null, C = computeAll(st, pt, units);
  sheets.push({ name: 'Estudio', widths: [26, 40], rows: [['Dato', 'Valor'],
    ['Paciente', pt ? pt.name : ''], ['Documento', pt ? pt.doc : ''], ['Sexo', pt && pt.sex === 'H' ? 'Masculino' : pt && pt.sex === 'M' ? 'Femenino' : ''],
    ['Edad (años)', age], ['Fecha del estudio', st.date || ''], ['Tipo', kind === 'angio' ? 'Angiografía coronaria' : kind === 'tc' ? 'TC cardíaca' : kind === 'rm' ? 'RM cardíaca' : 'Ecocardiograma'],
    ['Peso (kg)', st.weight || null], ['Talla (cm)', st.height || null], ['Superficie corporal (m²)', C.bsa ? r3(C.bsa.v) : null],
    ['Frecuencia cardíaca (lpm)', st.hr || null], ['PAS (mmHg)', st.sbp || null], ['PAD (mmHg)', st.dbp || null],
    ['Exportado', new Date().toLocaleString('es')], ['Programa', 'Cardón · uso educativo']] });
  if (kind === 'rm') {
    const M = computeMR(st, pt), C = M.R;
    const res = [['Parámetro', 'Valor', 'Unidad', 'Referencia']];
    for (const k of ['lvedv', 'lvedvi', 'lvesv', 'lvesvi', 'lvsv', 'lvsvi', 'lvef', 'lvm', 'lvmi', 'lvco', 'rvedv', 'rvedvi', 'rvesv', 'rvesvi', 'rvsv', 'rvsvi', 'rvef', 'map_t1n_myo', 'map_t1n_blood', 'map_t1p_myo', 'map_t1p_blood', 'map_t2_myo', 'ecv', 'qpqs']) if (C[k]) { const x = splitNum(C[k].text); res.push([C[k].label, r3(C[k].v), x.u, C[k].ref || '']); }
    sheets.push({ name: 'Resultados', widths: [36, 10, 10, 18], rows: res });
    const cont = [['Corte', 'Estructura', 'Área (cm²)']];
    for (const [k, v] of Object.entries(st.values || {})) { const m = /^mrc_(\d+)_(\w+)$/.exec(k); if (m && MRC[m[2]]) cont.push([+m[1], MRC[m[2]].n, r3(v.v)]); }
    cont.splice(1, cont.length, ...cont.slice(1).sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(b[1])));
    if (cont.length > 1) sheets.push({ name: 'Contornos', widths: [8, 38, 12], rows: cont });
    const seg = [['Segmento', 'Nombre', 'Realce tardío', 'Transmuralidad', 'Edema']];
    for (let i = 1; i <= 17; i++) { const l = mrState(st).lge[i]; seg.push([i, AHA17[i - 1], l && l.p ? LGE_PAT[l.p].n : '', l && l.t ? LGE_TM[l.t] : '', mrState(st).edema[i] ? 'Sí' : '']); }
    sheets.push({ name: 'Segmentos AHA', widths: [10, 24, 26, 16, 10], rows: seg });
    const flo = [['Vaso', 'Anterógrado (ml)', 'Retrógrado (ml)', 'Neto (ml)', 'Fracción regurgitante (%)', 'Velocidad pico (cm/s)', 'VENC (cm/s)']];
    for (const [k, n] of Object.entries(FLOWV)) { const x = C['flow_' + k]; if (x) flo.push([n, r3(x.fwd), r3(x.back), r3(x.net), r3(x.rf), r3(x.peak), x.venc]); }
    if (flo.length > 1) sheets.push({ name: 'Flujo', widths: [20, 16, 16, 12, 22, 20, 12], rows: flo });
    return sheets;
  }
  if (kind === 'tc') {
    const R = computeCAC(st);
    const rows = [['Arteria', 'Corte', 'Área (mm²)', 'Pico (UH)', 'Agatston', 'Volumen (mm³)']];
    for (const l of R.lesions.slice().sort((a, b) => a.slice - b.slice)) rows.push([(CAC_ART[l.art] || {}).n || l.art, l.slice, r3(l.area), Math.round(l.peak), r3(l.v), r3(l.vol)]);
    sheets.push({ name: 'Lesiones de calcio', widths: [28, 8, 12, 10, 10, 14], rows });
    const tot = [['Arteria', 'Lesiones', 'Agatston', 'Volumen (mm³)']];
    for (const [k, A] of Object.entries(CAC_ART)) tot.push([A.n, R.by[k].n, r3(R.by[k].score), r3(R.by[k].vol)]);
    tot.push(['Total', R.lesions.length, r3(R.total), r3(R.vol)], ['Categoría', R.drs, R.cat, '']);
    sheets.push({ name: 'Score de calcio', widths: [28, 12, 22, 14], rows: tot });
    const T = computeCTA(st);
    if (T.any) {
      const rows2 = [['Segmento', 'Nombre', 'Estenosis (%)', 'Categoría', 'Placa', 'Alto riesgo']];
      for (const sg of T.segs) rows2.push([sg.num, CTA_NAME[sg.k], sg.pct, sg.cat, CTA_PLAQUE[sg.plaque] === '—' ? '' : CTA_PLAQUE[sg.plaque], sg.hrp.length >= 2 ? 'Sí' : '']);
      rows2.push([], ['Clasificación', T.text], ['Recomendación', T.rec]);
      sheets.push({ name: 'Angio-TC', widths: [10, 32, 12, 10, 16, 12], rows: rows2 });
    }
    return sheets;
  }
  if (kind === 'angio') {
    const rows = [['Vaso', 'Segmento', 'Estenosis (%)', 'Método', 'DLM (mm)', 'DR (mm)', 'Longitud (mm)']];
    for (const g of CORONARY) for (const [k, n] of g.segs) { const o = st.values['cor_' + k], x = o && o.v; if (isNum(x)) { const q = o.qca; rows.push([g.n, n, x, q ? 'QCA' : o.manual ? 'Escrito' : 'Calibrador', q && q.mld ? r3(q.mld) : null, q && q.ref ? r3(q.ref) : null, q && q.len ? r3(q.len) : null]); } }
    sheets.push({ name: 'Lesiones', widths: [28, 30, 14, 12, 10, 10, 14], rows });
    const A = st.angio || {}, fl = [['Vaso', 'Flujo TIMI', 'Blush', 'Cuadros', 'Cuadros/s', 'Conteo TIMI', 'Conteo corregido']];
    for (const v of ['DA', 'Cx', 'CD']) { const x = (A.tfc || {})[v], r = tfcOf(Object.assign({ v }, x)), t = (A.timi || {})[v], b = (A.blush || {})[v]; if (r || t || b) fl.push([v, t ? +t : null, b ? +b : null, r ? r.n : null, r ? x.fps : null, r ? r3(r.tfc) : null, r ? r3(r.ctfc) : null]); }
    const aoR = [['Medida', 'Valor (mm)', 'Calibración']]; for (const [k, n] of [['aoroot', 'Raíz aórtica (senos)'], ['aoasc', 'Aorta ascendente']]) { const o = st.values['ang_' + k]; if (o && isNum(o.v)) aoR.push([n, r3(o.v * 10), o.approx ? 'Aproximada (detector)' : 'Catéter']); }
    if (aoR.length > 1) sheets.push({ name: 'Aorta', widths: [26, 12, 22], rows: aoR });
    if (fl.length > 1) sheets.push({ name: 'Flujo', widths: [8, 12, 8, 10, 10, 14, 16], rows: fl });
    return sheets;
  }
  const rows = [['Sección', 'Grupo', 'Medida', 'Valor', 'Unidad', 'Latidos', 'Valores de cada latido', 'Origen']];
  for (const col of measureColumns(units)) {
    const rec = st.values[col.k]; if (!rec) continue;
    const v = col.get(rec.v); if (!isNum(v)) continue;
    const sm = Array.isArray(rec.s) ? rec.s : [];
    const each = sm.length > 1 ? sm.map(x => col.get(x.v)).filter(isNum).map(x => I18N.lang === 'en' ? String(r3(x)) : String(r3(x)).replace('.', ',')).join('; ') : '';
    rows.push([col.g.sec || '', col.g.g, col.label, r3(v), col.unit, sm.length > 1 ? sm.length : 1, each, rec.manual ? 'Escrita a mano' : 'Medida en la imagen']);
  }
  sheets.push({ name: 'Medidas', widths: [22, 30, 30, 10, 8, 9, 28, 20], rows });
  const crow = [['Cálculo', 'Valor', 'Unidad', 'Referencia', 'Nota']];
  for (const k of CALC_ORDER) if (C[k] && !/^warn_/.test(k)) { const x = splitNum(C[k].text); crow.push([C[k].label, typeof x.v === 'number' ? x.v : x.v, x.u, C[k].ref || '', C[k].note || '']); }
  sheets.push({ name: 'Cálculos', widths: [36, 12, 10, 22, 40], rows: crow });
  { const w = wmCompute(st); if (w) sheets.push({ name: 'Motilidad', widths: [10, 26, 10, 16], rows: [['Segmento', 'Nombre', 'Puntaje', 'Motilidad'], ...AHA17.map((n, i) => [i + 1, n, st.wm[i + 1] || null, st.wm[i + 1] ? WM[st.wm[i + 1]].n : '']), [], ['IMS', null, r3(w.wmsi), `${w.n} de 17 segmentos`]] }); }
  return sheets;
}
const fileSafe = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
async function exportStudyXlsx(statusEl) {
  const st = state.study; statusEl = statusEl || els.status;
  if (!st) { setStatus('Abre un estudio primero.'); return; }
  const pt = patientOf(st);
  try {
    if (statusEl) statusEl.textContent = 'Preparando el archivo de Excel…';
    const blob = await buildXlsx(studySheets(st, pt, state.units));
    await saveFile(`${I18N.lang === 'en' ? 'Measurements' : 'Medidas'}_${fileSafe(pt ? pt.name : 'estudio') || 'estudio'}_${st.date || todayISO()}.xlsx`, blob, statusEl);
  } catch (e) { if (statusEl) statusEl.textContent = 'No se pudo crear el archivo de Excel. ' + (e && e.message === 'zip' ? 'Revisa tu conexión e inténtalo de nuevo.' : ''); }
}
/* Toda la base: una fila por estudio, una columna por medida y cálculo */
function databaseSheets(anon, units) {
  const all = state.studies.map(x => state.study && x.id === state.study.id ? state.study : x);
  const cols = measureColumns(units), eco = all.filter(s => studyKindOf(s) === 'eco'), rms = all.filter(s => studyKindOf(s) === 'rm'), ang = all.filter(s => studyKindOf(s) === 'angio'), tcs = all.filter(s => studyKindOf(s) === 'tc');
  const ids = new Map(); let n = 0;
  const who = pt => { if (!pt) return ['', '']; if (!anon) return [pt.name || '', pt.doc || '']; if (!ids.has(pt.id)) ids.set(pt.id, `P${String(++n).padStart(3, '0')}`); return [ids.get(pt.id), '']; };
  const base = (st, pt) => { const age = pt ? ageAt(pt.birth, st.date) : null, b = bsaOf(st); return [...who(pt), pt && pt.sex === 'H' ? (I18N.lang === 'en' ? 'M' : 'H') : pt && pt.sex === 'M' ? (I18N.lang === 'en' ? 'F' : 'M') : '', age, st.date || '', st.weight || null, st.height || null, b ? r3(b) : null, st.hr || null, st.sbp || null, st.dbp || null]; };
  const head = ['Paciente', anon ? '' : 'Documento', 'Sexo', 'Edad (años)', 'Fecha', 'Peso (kg)', 'Talla (cm)', 'SC (m²)', 'FC (lpm)', 'PAS', 'PAD'];
  const sorted = list => list.slice().sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')));
  const sheets = [];
  if (eco.length) {
    const used = cols.filter(c => eco.some(st => st.values[c.k] && isNum(c.get(st.values[c.k].v))));
    const calcKeys = [], calcLab = {}, calcUnit = {}, Cs = new Map();
    for (const st of eco) { const C = computeAll(st, patientOf(st), units); Cs.set(st, C); for (const k of CALC_ORDER) if (C[k] && k !== 'bsa' && !/^warn_/.test(k) && !calcLab[k]) { calcLab[k] = C[k].label; calcUnit[k] = splitNum(C[k].text).u; } }
    for (const k of CALC_ORDER) if (calcLab[k]) calcKeys.push(k);
    const rows = [head.concat(used.map(c => c.unit ? `${c.label} (${c.unit})` : c.label), calcKeys.map(k => calcUnit[k] ? `${calcLab[k]} (${calcUnit[k]})` : calcLab[k]))];
    for (const st of sorted(eco)) {
      const pt = patientOf(st), C = Cs.get(st);
      rows.push(base(st, pt).concat(used.map(c => { const r = st.values[c.k]; const v = r ? c.get(r.v) : null; return isNum(v) ? r3(v) : null; }), calcKeys.map(k => { if (!C[k]) return null; const x = splitNum(C[k].text); return x.v; })));
    }
    sheets.push({ name: 'Ecocardiogramas', widths: head.map((_, i) => i < 2 ? 22 : 11).concat(used.map(() => 14), calcKeys.map(() => 16)), rows });
  }
  if (ang.length) {
    const segs = CORONARY.flatMap(g => g.segs);
    const rows = [head.concat(['Dominancia', 'Vasos con lesión significativa'], segs.map(([, nm]) => `${nm} (%)`))];
    for (const st of sorted(ang)) { const pt = patientOf(st), R = computeAngio(st), A = st.angio || {}; rows.push(base(st, pt).concat([A.dom || '', R.n], segs.map(([k]) => { const x = st.values['cor_' + k] && st.values['cor_' + k].v; return isNum(x) ? x : null; }))); }
    sheets.push({ name: 'Angiografías', widths: head.map((_, i) => i < 2 ? 22 : 11).concat([14, 14], segs.map(() => 12)), rows });
  }
  if (tcs.length) {
    const segCols = CTA_SEGS.flatMap(g => g.segs);
    const rows = [head.concat(Object.values(CAC_ART).map(A => `Agatston ${A.s}`), ['Agatston total', 'Volumen de calcio (mm³)', 'Lesiones', 'CAC-DRS', 'CAD-RADS'], segCols.map(([, num, n]) => `${num}. ${n} (%)`))];
    for (const st of sorted(tcs)) { const pt = patientOf(st), R = computeCAC(st), T = computeCTA(st); rows.push(base(st, pt).concat(Object.keys(CAC_ART).map(k => r3(R.by[k].score)), [r3(R.total), r3(R.vol), R.lesions.length, R.lesions.length || st.cacDone ? R.drs : '', T.text], segCols.map(([k]) => { const x = st.values['cta_' + k]; return x && isNum(x.v) ? x.v : null; }))); }
    sheets.push({ name: 'TC cardíaca', widths: head.map((_, i) => i < 2 ? 22 : 11).concat([12, 12, 12, 12, 14, 18, 10, 14]), rows });
  }
  if (rms.length) {
    const ks = [['lvedv', 'VTD VI (ml)'], ['lvedvi', 'VTD VI indexado (ml/m²)'], ['lvesv', 'VTS VI (ml)'], ['lvef', 'FEVI (%)'], ['lvm', 'Masa VI (g)'], ['lvmi', 'Masa VI indexada (g/m²)'], ['rvedv', 'VTD VD (ml)'], ['rvedvi', 'VTD VD indexado (ml/m²)'], ['rvef', 'FEVD (%)'], ['map_t1n_myo', 'T1 nativo (ms)'], ['map_t2_myo', 'T2 (ms)'], ['ecv', 'VEC (%)'], ['qpqs', 'Qp/Qs']];
    const rows = [head.concat(ks.map(x => x[1]), ['Segmentos con realce', 'Patrón de realce', 'Segmentos con edema', 'FR aórtica (%)'])];
    for (const st of sorted(rms)) { const pt = patientOf(st), C = computeMR(st, pt).R; rows.push(base(st, pt).concat(ks.map(([k]) => C[k] ? r3(C[k].v) : null), [C.lge.map(x => x.seg).join(', '), [...new Set(C.lge.map(x => LGE_PAT[x.p].n))].join(', '), C.edema.join(', '), C.flow_ao ? r3(C.flow_ao.rf) : null])); }
    sheets.push({ name: 'RM cardíaca', widths: head.map((_, i) => i < 2 ? 22 : 11).concat(ks.map(() => 14), [18, 24, 16, 12]), rows });
  }
  if (anon) for (const sh of sheets) for (const r of sh.rows) r.splice(1, 1);
  return sheets;
}
async function exportDatabaseXlsx() {
  const out = $('bStatus');
  if (locked()) { out.textContent = 'Desbloquea Cardón primero.'; return; }
  if (!state.studies.length) { out.textContent = 'Aún no hay estudios para exportar.'; return; }
  const anon = !!($('bAnon') && $('bAnon').checked);
  try {
    out.textContent = 'Preparando el archivo de Excel…';
    const sheets = databaseSheets(anon, state.units);
    if (!sheets.length) { out.textContent = 'Aún no hay medidas para exportar.'; return; }
    await saveFile(`cardon-${I18N.lang === 'en' ? 'measurements' : 'medidas'}-${anon ? (I18N.lang === 'en' ? 'anonymous-' : 'anonimas-') : ''}${todayISO()}.xlsx`, await buildXlsx(sheets), out);
  } catch (e) { out.textContent = 'No se pudo crear el archivo de Excel.'; }
}
