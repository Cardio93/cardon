const EN_EXACT = new Map(), EN_PAT = [];
for (const [k, v] of Object.entries(EN)) {
  if (k.includes('{}') || k.includes('{n}')) EN_PAT.push([new RegExp('^' + k.split(/(\{n?\})/).map(x => x === '{}' ? '([\\s\\S]*?)' : x === '{n}' ? '([-\\d.,/]+)' : x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$'), v.replace(/\{n\}/g, '{}'), k.length]);
  else EN_EXACT.set(k, v);
}
EN_PAT.sort((a, b) => b[2] - a[2]);
const TOKEN_RX = Object.keys(EN_TOKENS).length ? new RegExp('(^|[^\\p{L}])(' + Object.keys(EN_TOKENS).sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}])', 'gu') : null;
let I18N_NAMES = null;
function namePrefix(k) {
  if (!I18N_NAMES) { I18N_NAMES = []; try { for (const d of Object.values(DEF)) I18N_NAMES.push(d.n); for (const n of Object.values(SEG_NAME)) I18N_NAMES.push(n); } catch (e) {} I18N_NAMES = [...new Set(I18N_NAMES)].filter(n => EN_EXACT.has(n)).sort((a, b) => b.length - a.length); }
  for (const n of I18N_NAMES) if (k.startsWith(n) && /^[\s:(]/.test(k.slice(n.length))) return EN_EXACT.get(n) + trTokens(k.slice(n.length));
  return null;
}
function trTokens(t) { return TOKEN_RX ? t.replace(TOKEN_RX, (m, a, w) => a + EN_TOKENS[w]) : t; }
function trCore(k) {
  const e = EN_EXACT.get(k); if (e !== undefined) return e;
  if (k.includes('\n')) return k.split('\n').map(l => { const t = l.trim(); if (!t) return l; const x = trCore(t); return l.replace(t, x === null ? trTokens(t) : x); }).join('\n');
  for (const [rx, v] of EN_PAT) {
    const m = rx.exec(k);
    if (m) { let i = 0; return v.replace(/\{(\d*)\}/g, (_, n) => { const g = m[n === '' ? ++i : +n + 1]; return g === undefined ? '' : trPiece(g); }); }
  }
  return namePrefix(k);
}
function trPiece(g) { const t = g.trim(); if (!t) return g; const o = trCore(t); return g.replace(t, o === null ? trTokens(t) : o); }
const trCache = new Map(), trDone = new Set();
function tr(s) {
  if (I18N.lang !== 'en' || s === null || s === undefined) return s;
  s = String(s);
  if (trDone.has(s)) return s;
  const c = trCache.get(s); if (c !== undefined) return c;
  let out = s;
  const k = s.trim();
  if (k && /\p{L}/u.test(k)) {
    let o = trCore(k);
    if (o === null) o = trTokens(k);
    out = s.replace(k, o);
  }
  if (trCache.size > 5000) { trCache.clear(); trDone.clear(); }
  trCache.set(s, out);
  if (out !== s) trDone.add(out);
  return out;
}
const I18N_ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
function trText(n) { const v = n.nodeValue; if (!v || !/\p{L}/u.test(v)) return; const p = n.parentNode; if (p && (p.nodeName === 'TEXTAREA' || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || (p.closest && p.closest('[data-noi18n]')))) return; const o = tr(v); if (o !== v) n.nodeValue = o; }
function trAttrs(el) { if (el.closest && el.closest('[data-noi18n]')) return; for (const a of I18N_ATTRS) { const v = el.getAttribute(a); if (v) { const o = tr(v); if (o !== v) el.setAttribute(a, o); } } }
function trTree(root) {
  if (!root) return;
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1 || root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE') return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => { if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT; if (n.nodeName === 'TEXTAREA') { trAttrs(n); return NodeFilter.FILTER_REJECT; } return n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE' || n.hasAttribute('data-noi18n') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
}
function startI18n() {
  if (I18N.lang !== 'en') return;
  document.documentElement.lang = 'en';
  trTree(document.body);
  if (document.title) document.title = tr(document.title);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trAttrs(m.target);
      else m.addedNodes.forEach(trTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
startI18n();
/* Conclusión automática en inglés (misma lógica que buildConclusion) */
function buildConclusionEN(st, pt) {
  const C = computeAll(st, pt, 'mm'), sex = pt && pt.sex, v = k => { const x = st.values[k] && st.values[k].v; return isNum(x) ? x : null; };
  const L = [], T = x => tr(x);
  const ef = C.ef_s || C.ef_t;
  {
    const parts = [];
    const d = v('lvidd'), edvi = C.edvi;
    const big = (edvi && edvi.flag === 'alto') || (d && flagFor('lvidd', d, sex) === 'alto');
    if (d || edvi) parts.push(big ? 'Dilated left ventricle' : 'Normal left ventricular size');
    if (C.geom) parts.push(T(C.geom.text).toLowerCase());
    else if ((v('ivsd') && flagFor('ivsd', v('ivsd'), sex) === 'alto') || (v('pwd') && flagFor('pwd', v('pwd'), sex) === 'alto')) parts.push('with increased wall thickness');
    if (ef) {
      const e = ef.v, lo = sex === 'M' ? 54 : 52;
      const g = e >= lo ? 'preserved systolic function' : e >= 41 ? 'mild systolic dysfunction' : e >= 30 ? 'moderate systolic dysfunction' : 'severe systolic dysfunction';
      parts.push(`${g} (LVEF ${dec(e, 0)} % by ${T(ef.label).replace(/^LVEF \(|\)$/g, '')})`);
    }
    if (parts.length) L.push(parts.join(', ') + '.');
  }
  if (C.dd) L.push(`Diastolic function: ${T(C.dd.note).split('.')[0].toLowerCase()}${C.ee ? ` (${T(C.ee.label)} ${C.ee.text})` : ''}.`);
  if (C.lavi) { const x = C.lavi.v; L.push(`${x <= 34 ? 'Normal left atrial size' : x <= 41 ? 'Mildly dilated left atrium' : x <= 48 ? 'Moderately dilated left atrium' : 'Severely dilated left atrium'} (indexed volume ${C.lavi.text}).`); }
  {
    const tap = v('tapse'), sp = v('rvs'), fac = C.fac;
    const ab = (tap && tap < 1.7) || (sp && sp < 9.5) || (fac && fac.v < 35);
    if (tap || sp || fac) L.push(`Right ventricle with ${ab ? 'reduced' : 'preserved'} systolic function (${[tap ? `TAPSE ${dec(tap * 10, 0)} mm` : '', sp ? `S' ${dec(sp, 1)} cm/s` : '', fac ? `FAC ${fac.text}` : ''].filter(Boolean).join(', ')}).`);
    if (v('rvd1') && v('rvd1') > 4.1) L.push(`Dilated right ventricle (basal diameter ${dec(v('rvd1') * 10, 0)} mm).`);
  }
  if (v('trv')) {
    const t = v('trv') / 100, p = t <= 2.8 ? 'low' : t <= 3.4 ? 'intermediate' : 'high';
    L.push(`Tricuspid regurgitation velocity ${dec(t, 1)} m/s${C.psap ? `, estimated PASP ${C.psap.text}` : ''}: ${p} echocardiographic probability of pulmonary hypertension.`);
  }
  if (C.rap_est) L.push(`Inferior vena cava ${dec(v('ivc_max') * 10, 0)} mm with ${C.ivc_ci.text} inspiratory collapse: estimated right atrial pressure ${C.rap_est.text}.`);
  if (C.ei_int && C.ei_int.flag) L.push(T(C.ei_int.note));
  if (C.ts_mg && C.ts_mg.flag) L.push(`Significant tricuspid stenosis (mean gradient ${C.ts_mg.text}${C.tva ? `, area ${C.tva.text}` : ''}).`);
  if (C.ps_pg && C.ps_pg.flag) L.push(`Pulmonary stenosis: ${T(C.ps_pg.note).replace(/\.$/, '')}, peak gradient ${C.ps_pg.text}.`);
  if (C.tapsepsap && C.tapsepsap.flag) L.push(`TAPSE/PASP ratio ${C.tapsepsap.text}, suggestive of right ventricular–arterial uncoupling.`);
  if (C.qpqs && C.qpqs.v >= 1.5) L.push(`Qp/Qs ratio ${C.qpqs.text}, suggestive of a significant left-to-right shunt.`);
  {
    const vmax = (v('avvmax') || (st.values.avvti && st.values.avvti.v && st.values.avvti.v.vmax) || 0) / 100;
    const mg = C.avmg ? C.avmg.v : null, ava = C.ava ? C.ava.v : null;
    if (vmax || mg || ava) {
      let g = 'no significant aortic stenosis';
      if (vmax >= 4 || (mg && mg >= 40) || (ava && ava < 1)) g = 'aortic stenosis in the severe range';
      else if (vmax >= 3 || (mg && mg >= 20) || (ava && ava <= 1.5)) g = 'moderate aortic stenosis';
      else if (vmax >= 2.6) g = 'aortic sclerosis or mild aortic stenosis';
      L.push(`Aortic valve: ${g} (${[vmax ? `Vmax ${dec(vmax, 1)} m/s` : '', mg ? `mean gradient ${dec(mg, 0)} mmHg` : '', ava ? `AVA ${dec(ava, 2)} cm²` : ''].filter(Boolean).join(', ')}).`);
    }
  }
  if (C.ero || C.mrvc_g) {
    const g = C.ero ? (C.ero.v >= 0.4 ? 'severe' : C.ero.v >= 0.2 ? 'moderate' : 'mild') : T(C.mrvc_g.v);
    L.push(`${g === 'intermediate' ? 'Intermediate-grade' : g[0].toUpperCase() + g.slice(1)} mitral regurgitation${C.ero ? ` (EROA ${C.ero.text}${C.mr_rvol ? `, regurgitant volume ${C.mr_rvol.text}` : ''})` : ''}.`);
  }
  if (C.mva) L.push(`Mitral stenosis: valve area ${C.mva.text} by pressure half-time${C.msmg ? `, mean gradient ${C.msmg.text}` : ''}.`);
  if (C.ar_sev) L.push(`Aortic regurgitation: ${T(C.ar_sev.note).replace(/\.$/, '')}.`);
  const ao = v('aoroot'); if (ao && ao > 4.0) L.push(`Dilated aortic root (${dec(ao * 10, 0)} mm at the sinuses).`);
  { const t = wmSentence(st, true); if (t) { const i = L.findIndex(l => /left ventricle/i.test(l)); L.splice(i + 1, 0, t); } }
  return L.join('\n');
}
const lc1 = t => t && /^\p{Lu}\p{Ll}/u.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
function buildConclusionAngioEN(st) {
  const A = st.angio || {}, R = computeAngio(st), L = [];
  if (A.dom) L.push(`${A.dom === 'codominante' ? 'Balanced (codominant)' : A.dom === 'derecha' ? 'Right-dominant' : 'Left-dominant'} coronary circulation.`);
  if (!R.lesions.length) { L.push('Coronary arteries without angiographic lesions.'); { const t = aoAngLine(st, true); if (t) L.push(t); } for (const v of ['DA', 'Cx', 'CD']) { const r = tfcOf(Object.assign({ v }, (A.tfc || {})[v])); if (r) L.push(`${v === 'DA' ? 'Corrected TIMI' : 'TIMI'} frame count in the ${{ DA: 'left anterior descending', Cx: 'circumflex', CD: 'right coronary artery' }[v]}: ${dec(r.ctfc, 0)} (${r.ctfc > TFC_REF[v].up ? 'slow flow' : 'normal'}).`); } return L.join('\n'); }
  const byV = {};
  for (const l of R.lesions) (byV[l.ves] = byV[l.ves] || []).push(l);
  const name = { TCI: 'Left main coronary artery', DA: 'Left anterior descending', Cx: 'Circumflex', CD: 'Right coronary artery' };
  const qs = k => { const q = st.values['cor_' + k] && st.values['cor_' + k].qca; return q ? (q.mld ? ` (QCA, MLD ${dec(q.mld, 2)} mm)` : ' (QCA)') : ''; };
  for (const v of ['TCI', 'DA', 'Cx', 'CD']) if (byV[v]) L.push(`${name[v]}: ${byV[v].map(l => l.pct >= 100 ? `total occlusion of the ${lc1(tr(l.n))}` : `${dec(l.pct, 0)} % lesion${qs(l.k)} in the ${lc1(tr(l.n))}`).join('; ')}.`);
  const timi = A.timi || {};
  for (const v of ['DA', 'Cx', 'CD']) if (timi[v] && timi[v] !== '3') L.push(`TIMI ${timi[v]} flow in the ${name[v].toLowerCase()}.`);
  for (const v of ['DA', 'Cx', 'CD']) { const r = tfcOf(Object.assign({ v }, (A.tfc || {})[v])); if (r) L.push(`${v === 'DA' ? 'Corrected TIMI' : 'TIMI'} frame count in the ${name[v].toLowerCase()}: ${dec(r.ctfc, 0)} (${r.ctfc > TFC_REF[v].up ? 'slow flow' : 'normal'}).`); }
  for (const v of ['DA', 'Cx', 'CD']) { const b = (A.blush || {})[v]; if (b && b !== '3') L.push(`Myocardial blush grade ${b} in the ${name[v].toLowerCase()} territory.`); }
  const ves = Object.keys(R.vessels).map(x => ({ DA: 'LAD', Cx: 'LCx', CD: 'RCA' }[x] || x));
  { const t = aoAngLine(st, true); if (t) L.push(t); }
  const sigTxt = R.n ? `Significant ${R.n}-vessel coronary artery disease (${ves.join(', ')})` : '';
  if (R.tci) L.push((sigTxt ? sigTxt + ', with' : 'Coronary artery disease with') + ' significant left main involvement.');
  else if (sigTxt) L.push(sigTxt + '.');
  else L.push('No angiographically significant lesions (all below 70 %, or below 50 % in the left main).');
  return L.join('\n');
}

