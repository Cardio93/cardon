/*CALC-START*/
/* Paquete básico de ecocardiografía. Valores de referencia: ASE/EACVI 2015 (cuantificación de cavidades) y 2016 (función diastólica). */
const DEFS = [
  { sec: 'Corazón izquierdo', g: 'VI · dimensiones', hint: 'Paraesternal eje largo, 2D o modo M.', items: [
    { k: 'ivsd', n: 'SIV en diástole', t: 'dist', q: 'len', h: 'Telediástole: grosor del septo interventricular.' },
    { k: 'lvidd', n: 'DdVI', t: 'dist', q: 'len', h: 'Telediástole: de endocardio septal a endocardio posterior.' },
    { k: 'pwd', n: 'PP en diástole', t: 'dist', q: 'len', h: 'Telediástole: grosor de la pared posterior.' },
    { k: 'lvids', n: 'DsVI', t: 'dist', q: 'len', h: 'Telesístole: diámetro interno del VI.' }
  ] },
  { sec: 'Corazón izquierdo', g: 'VI · volúmenes (Simpson)', hint: 'Apicales. Traza el endocardio de un anillo mitral, por el ápex, al otro anillo.', items: [
    { k: 'lved4', n: 'Diástole 4C', t: 'trace', h: 'Apical 4 cámaras, telediástole: traza de anillo a anillo pasando por el ápex.' },
    { k: 'lves4', n: 'Sístole 4C', t: 'trace', h: 'Apical 4 cámaras, telesístole: traza de anillo a anillo pasando por el ápex.' },
    { k: 'lved2', n: 'Diástole 2C', t: 'trace', h: 'Apical 2 cámaras, telediástole: traza de anillo a anillo pasando por el ápex.' },
    { k: 'lves2', n: 'Sístole 2C', t: 'trace', h: 'Apical 2 cámaras, telesístole: traza de anillo a anillo pasando por el ápex.' }
  ] },
  { sec: 'Corazón izquierdo', g: 'Función diastólica', hint: 'Doppler pulsado mitral y tisular del anillo. La velocidad de la insuficiencia tricuspídea, que también entra en el algoritmo, está en Corazón derecho → Presión pulmonar y vena cava.', items: [
    { k: 'e', n: 'Onda E', t: 'vel', q: 'velT', h: 'Doppler pulsado mitral en la punta de los velos: clic en el pico de la onda E.' },
    { k: 'a', n: 'Onda A', t: 'vel', q: 'velT', h: 'Doppler pulsado mitral: clic en el pico de la onda A.' },
    { k: 'dt', n: 'Tiempo desaceleración E', t: 'time', q: 'ms', h: 'Arrastra desde el pico de la onda E hasta donde la pendiente toca la línea de base.' },
    { k: 'esep', n: "e' septal", t: 'vel', q: 'velT', h: "Doppler tisular del anillo mitral septal: clic en el pico de e'." },
    { k: 'elat', n: "e' lateral", t: 'vel', q: 'velT', h: "Doppler tisular del anillo mitral lateral: clic en el pico de e'." }
  ] },
  { sec: 'Corazón izquierdo', g: 'Aurícula izquierda', hint: 'Telesístole. Excluye venas pulmonares y orejuela.', items: [
    { k: 'la_ap', n: 'Diámetro AP', t: 'dist', q: 'len', h: 'Paraesternal eje largo, telesístole: diámetro anteroposterior.' },
    { k: 'la4', n: 'Contorno 4C', t: 'trace', h: 'Apical 4C, telesístole: traza la AI de anillo a anillo.' },
    { k: 'la2', n: 'Contorno 2C', t: 'trace', h: 'Apical 2C, telesístole: traza la AI de anillo a anillo.' }
  ] },
  { sec: 'Aorta y válvula aórtica', g: 'Aorta y tracto de salida', hint: 'Paraesternal eje largo.', items: [
    { k: 'aoroot', n: 'Senos de Valsalva', t: 'dist', q: 'len', h: 'Diástole: diámetro máximo a nivel de los senos.' },
    { k: 'aoasc', n: 'Aorta ascendente', t: 'dist', q: 'len', h: 'Aorta ascendente proximal.' },
    { k: 'lvot', n: 'Diámetro TSVI', t: 'dist', q: 'len', h: 'Mesosístole: diámetro del tracto de salida del VI.' }
  ] },
  { sec: 'Aorta y válvula aórtica', g: 'Estenosis aórtica y flujo del TSVI', hint: 'Doppler pulsado en TSVI y continuo aórtico.', items: [
    { k: 'lvotvti', n: 'ITV TSVI', t: 'vti', h: 'Doppler pulsado en el TSVI: traza el borde de la onda de principio a fin sin soltar.' },
    { k: 'avvti', n: 'ITV aórtica', t: 'vti', h: 'Doppler continuo aórtico: traza el borde de la onda de principio a fin sin soltar.' },
    { k: 'avvmax', n: 'Vmax aórtica', t: 'vel', q: 'velF', h: 'Doppler continuo aórtico: clic en la velocidad máxima.' }
  ] },
  { sec: 'Aorta y válvula aórtica', g: 'Insuficiencia aórtica', hint: 'Doppler continuo del chorro en apical 5C y color en paraesternal eje largo.', items: [
    { k: 'ar_pht', n: 'Tiempo de hemipresión', t: 'slope', q: 'ms', h: 'Arrastra desde el pico del chorro de insuficiencia siguiendo su pendiente de desaceleración.' },
    { k: 'ar_vc', n: 'Vena contracta aórtica', t: 'dist', q: 'len', h: 'Paraesternal eje largo con zoom: ancho más estrecho del chorro de insuficiencia.' }
  ] },
  { sec: 'Válvula mitral', g: 'Estenosis mitral', hint: 'Doppler continuo del flujo mitral en apical 4C.', items: [
    { k: 'ms_pht', n: 'Tiempo de hemipresión', t: 'slope', q: 'ms', h: 'Arrastra desde el pico de la onda E siguiendo la pendiente de desaceleración.' },
    { k: 'msvti', n: 'ITV mitral', t: 'vti', h: 'Traza la envolvente del flujo mitral de principio a fin para obtener el gradiente medio.' }
  ] },
  { sec: 'Válvula mitral', g: 'Insuficiencia mitral (PISA)', hint: 'Doppler color con la línea de base desplazada hacia el chorro, en mesosístole.', items: [
    { k: 'pisa_r', n: 'Radio PISA', t: 'dist', q: 'len', h: 'Mesosístole: del orificio regurgitante al primer cambio de color (aliasing).' },
    { k: 'pisa_va', n: 'Velocidad de aliasing', t: 'num', q: 'velT', h: 'Escríbela desde la escala de color, con la línea de base ya desplazada (habitualmente 30 a 40 cm/s).' },
    { k: 'mrvmax', n: 'Vmax insuf. mitral', t: 'vel', q: 'velF', h: 'Doppler continuo del chorro de insuficiencia mitral: clic en la velocidad máxima.' },
    { k: 'mrvti', n: 'ITV insuf. mitral', t: 'vti', h: 'Doppler continuo del chorro de insuficiencia mitral: traza la envolvente completa.' },
    { k: 'mr_vc', n: 'Vena contracta mitral', t: 'dist', q: 'len', h: 'Doppler color con zoom: ancho más estrecho del chorro justo después del orificio.' }
  ] },
  { sec: 'Corazón derecho', g: 'Ventrículo derecho', hint: 'Apical 4C enfocada en VD.', items: [
    { k: 'rvd1', n: 'Diámetro basal VD', t: 'dist', q: 'len', h: 'Telediástole: diámetro basal del VD.' },
    { k: 'tapse', n: 'TAPSE', t: 'dist', q: 'len', h: 'Modo M del anillo tricuspídeo lateral: arrastra del valle al pico.' },
    { k: 'rvs', n: "S' tricuspídeo", t: 'vel', q: 'velT', h: "Doppler tisular del anillo tricuspídeo: clic en el pico sistólico." },
    { k: 'rvda', n: 'Área VD diástole', t: 'trace', areaOnly: true, h: 'Apical 4C enfocada en VD, telediástole: traza el endocardio del VD siguiendo las trabéculas.' },
    { k: 'rvsa', n: 'Área VD sístole', t: 'trace', areaOnly: true, h: 'Apical 4C enfocada en VD, telesístole: traza el endocardio del VD siguiendo las trabéculas.' }
  ] },
  { sec: 'Corazón derecho', g: 'Presión pulmonar y vena cava', hint: 'Doppler continuo de la insuficiencia tricuspídea (PSAP) y subcostal de la vena cava inferior, a 1–2 cm de la aurícula derecha: diámetro máximo en espiración y mínimo con la inspiración o el olfateo (presión de la AD).', items: [
    { k: 'trv', n: 'Vmax insuf. tricuspídea', t: 'vel', q: 'velF', h: 'Doppler continuo de la insuficiencia tricuspídea: clic en la velocidad máxima.' },
    { k: 'ivc_max', n: 'VCI diámetro máximo', t: 'dist', q: 'len', h: 'Espiración: diámetro máximo de la vena cava inferior, perpendicular a su eje.' },
    { k: 'ivc_min', n: 'VCI diámetro mínimo', t: 'dist', q: 'len', h: 'Inspiración u olfateo: diámetro mínimo de la vena cava inferior en el mismo sitio.' }
  ] },
  { sec: 'Corazón derecho', g: 'Índice de excentricidad del VI', hint: 'Paraesternal eje corto a nivel de los músculos papilares. D1 perpendicular al septo; D2 paralelo al septo.', items: [
    { k: 'ei_d1_d', n: 'D1 en diástole', t: 'dist', q: 'len', h: 'Telediástole: diámetro del VI perpendicular al septo interventricular.' },
    { k: 'ei_d2_d', n: 'D2 en diástole', t: 'dist', q: 'len', h: 'Telediástole: diámetro del VI paralelo al septo, que corta a D1 por la mitad.' },
    { k: 'ei_d1_s', n: 'D1 en sístole', t: 'dist', q: 'len', h: 'Telesístole: diámetro del VI perpendicular al septo interventricular.' },
    { k: 'ei_d2_s', n: 'D2 en sístole', t: 'dist', q: 'len', h: 'Telesístole: diámetro del VI paralelo al septo, que corta a D1 por la mitad.' }
  ] },
  { sec: 'Corazón derecho', g: 'TSVD y flujo pulmonar', hint: 'Paraesternal eje corto de grandes vasos. Coloca el Doppler pulsado en el mismo sitio donde mides el diámetro.', items: [
    { k: 'rvotd', n: 'Diámetro TSVD', t: 'dist', q: 'len', h: 'Mesosístole: diámetro del TSVD a nivel del anillo pulmonar, donde colocas el Doppler pulsado.' },
    { k: 'pat', n: 'Tiempo aceleración pulmonar', t: 'time', q: 'ms', h: 'Doppler pulsado en el TSVD: arrastra desde el inicio del flujo hasta su pico.' },
    { k: 'rvotvti', n: 'ITV TSVD', t: 'vti', h: 'Doppler pulsado en el TSVD, justo antes de la válvula pulmonar: traza la envolvente de principio a fin.' }
  ] },
  { sec: 'Corazón derecho', g: 'Estenosis pulmonar', hint: 'Doppler continuo a través de la válvula pulmonar en eje corto de grandes vasos.', items: [
    { k: 'ps_vmax', n: 'Vmax pulmonar', t: 'vel', q: 'velF', h: 'Doppler continuo pulmonar: clic en la velocidad máxima.' }
  ] },
  { sec: 'Corazón derecho', g: 'Estenosis tricuspídea', hint: 'Doppler continuo del flujo tricuspídeo en apical 4C o paraesternal de tracto de entrada del VD.', items: [
    { k: 'ts_vti', n: 'ITV tricuspídea', t: 'vti', h: 'Traza la envolvente del flujo diastólico tricuspídeo para obtener el gradiente medio. Promedia en fibrilación auricular.' },
    { k: 'ts_pht', n: 'Tiempo de hemipresión', t: 'slope', q: 'ms', h: 'Arrastra desde el pico de la onda E tricuspídea siguiendo la pendiente de desaceleración.' }
  ] }
];
const DEF = {}; for (const g of DEFS) for (const d of g.items) DEF[d.k] = d;

/* [mínimo, máximo] en cm, cm/s, %, ml/m², g/m². H = hombre, M = mujer, A = ambos */
const REF = {
  lvidd: { H: [4.2, 5.8], M: [3.8, 5.2] }, lvids: { H: [2.5, 4.0], M: [2.2, 3.5] },
  ivsd: { H: [0.6, 1.0], M: [0.6, 0.9] }, pwd: { H: [0.6, 1.0], M: [0.6, 0.9] },
  la_ap: { H: [3.0, 4.0], M: [2.7, 3.8] }, rvd1: { A: [2.5, 4.1] },
  tapse: { A: [1.7, null] }, rvs: { A: [9.5, null] }, esep: { A: [7, null] }, elat: { A: [10, null] }, trv: { A: [null, 280] },
  ef_s: { H: [52, 72], M: [54, 74] }, edvi: { H: [34, 74], M: [29, 61] }, esvi: { H: [11, 31], M: [8, 24] },
  lvmi: { H: [49, 115], M: [43, 95] }, rwt: { A: [null, 0.42] }, lavi: { A: [null, 34] }, ee: { A: [null, 14] },
  ci: { A: [2.5, 4.0] }, fac: { A: [35, null] }, pat: { A: [0.105, null] }, mr_vc: { A: [null, 0.69] }, ar_vc: { A: [null, 0.6] }, ava: { A: [1.0, null] }, avmg: { A: [null, 40] }, avvmax: { A: [null, 400] }
};
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const dec = (x, d) => (typeof I18N !== 'undefined' && I18N.lang === 'en') ? x.toFixed(d) : x.toFixed(d).replace('.', ',');

function fmtQ(v, q, units) {
  if (!isNum(v)) return '';
  if (q === 'len') return units === 'cm' ? `${dec(v, 2)} cm` : `${dec(v * 10, 0)} mm`;
  if (q === 'velT') return `${dec(v, 1)} cm/s`;
  if (q === 'velF') return `${dec(v / 100, 2)} m/s`;
  if (q === 'ms') return `${dec(v * 1000, 0)} ms`;
  return String(v);
}
function qUnit(q, units) { return q === 'len' ? (units === 'cm' ? 'cm' : 'mm') : q === 'velT' ? 'cm/s' : q === 'velF' ? 'm/s' : q === 'ms' ? 'ms' : ''; }
function toDisplay(v, q, units) {
  if (q === 'len') return units === 'cm' ? +v.toFixed(2) : +(v * 10).toFixed(1);
  if (q === 'velF') return +(v / 100).toFixed(2);
  if (q === 'ms') return Math.round(v * 1000);
  return +v.toFixed(1);
}
function fromDisplay(x, q, units) {
  if (q === 'len') return units === 'cm' ? x : x / 10;
  if (q === 'velF') return x * 100;
  if (q === 'ms') return x / 1000;
  return x;
}
function refFor(k, sex) {
  const r = REF[k]; if (!r) return null;
  if (r.A) return r.A;
  if (sex === 'M' || sex === 'H') return r[sex === 'H' ? 'H' : 'M'];
  return null;
}
function flagFor(k, v, sex) {
  const r = refFor(k, sex); if (!r || !isNum(v)) return null;
  if (r[0] !== null && v < r[0]) return 'bajo';
  if (r[1] !== null && v > r[1]) return 'alto';
  return null;
}
function refText(k, sex, conv) {
  const r = REF[k]; if (!r) return '';
  const one = rr => {
    const a = rr[0] !== null ? conv(rr[0]) : null, b = rr[1] !== null ? conv(rr[1]) : null;
    return a !== null && b !== null ? `${a}–${b}` : a !== null ? `≥ ${a}` : `≤ ${b}`;
  };
  if (r.A) return one(r.A);
  if (sex === 'H') return one(r.H);
  if (sex === 'M') return one(r.M);
  return `H ${one(r.H)} · M ${one(r.M)}`;
}
function convFor(q, units) {
  if (q === 'len') return x => units === 'cm' ? dec(x, 1) : dec(x * 10, 0);
  if (q === 'velF') return x => dec(x / 100, 1);
  if (q === 'ms') return x => dec(x * 1000, 0);
  return x => (Number.isInteger(x) ? String(x) : dec(x, 2));
}

function bsaOf(st) { return st.weight > 0 && st.height > 0 ? Math.sqrt(st.height * st.weight / 3600) : null; }
function ageAt(birth, date) {
  if (!birth || !date) return null;
  const b = new Date(birth + 'T00:00'), d = new Date(date + 'T00:00');
  if (isNaN(b) || isNaN(d)) return null;
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}

/* Calcula todo lo derivable de las medidas del estudio. Devuelve {clave: {label, v, text, flag, ref, note}} */
function computeAll(st, pt, units) {
  const val = k => st.values[k] && st.values[k].v;
  const sc = k => { const v = val(k); return isNum(v) ? v : null; };
  const sex = pt && pt.sex;
  const bsa = bsaOf(st);
  const R = {};
  const put = (k, label, v, text, extra) => { if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return; R[k] = Object.assign({ label, v, text, flag: flagFor(k, v, sex), ref: '' }, extra || {}); };
  const pct = x => `${dec(x, 0)} %`;
  if (bsa) put('bsa', 'Superficie corporal (Mosteller)', bsa, `${dec(bsa, 2)} m²`);

  const d = sc('lvidd'), s = sc('lvids'), ivs = sc('ivsd'), pw = sc('pwd');
  /* datos imposibles (sístole mayor o igual que diástole): no se calcula la función y se avisa */
  if (d && s && s >= d) R.warn_ds = { label: 'Revisar DsVI', v: null, text: 'El diámetro sistólico es igual o mayor que el diastólico: no se calcula la FEVI por Teichholz.', flag: 'alto', ref: '' };
  if (d && s && s < d) {
    put('fs', 'Fracción de acortamiento', (d - s) / d * 100, pct((d - s) / d * 100), { ref: '25–43 %' });
    const teich = x => 7 / (2.4 + x) * x ** 3;
    const ef = (teich(d) - teich(s)) / teich(d) * 100;
    put('ef_t', 'FEVI (Teichholz)', ef, pct(ef), { note: 'No usar si hay alteraciones segmentarias.' });
  }
  if (d && ivs && pw) {
    const mass = 0.8 * 1.04 * ((ivs + d + pw) ** 3 - d ** 3) + 0.6;
    put('lvm', 'Masa VI (ASE)', mass, `${dec(mass, 0)} g`);
    const rwt = 2 * pw / d;
    put('rwt', 'Grosor parietal relativo', rwt, dec(rwt, 2), { ref: '≤ 0,42' });
    if (bsa) {
      const mi = mass / bsa;
      put('lvmi', 'Índice de masa VI', mi, `${dec(mi, 0)} g/m²`, { ref: refText('lvmi', sex, x => String(x)) });
      const lim = sex === 'H' ? 115 : sex === 'M' ? 95 : null;
      if (lim) {
        const hi = mi > lim, thick = rwt > 0.42;
        const geom = hi ? (thick ? 'Hipertrofia concéntrica' : 'Hipertrofia excéntrica') : (thick ? 'Remodelado concéntrico' : 'Geometría normal');
        put('geom', 'Geometría del VI', geom, geom);
      }
    }
  }

  const tv = k => { const v = val(k); return v && typeof v === 'object' && isNum(v.vol) ? v : null; };
  const vol = (a4, a2) => {
    const g4 = tv(a4), g2 = tv(a2);
    if (g4 && g2) return { v: biplaneVolume(g4, g2), m: 'biplano' };
    if (g4) return { v: g4.vol, m: '4C' };
    if (g2) return { v: g2.vol, m: '2C' };
    return null;
  };
  const edv = vol('lved4', 'lved2'), esv = vol('lves4', 'lves2');
  if (edv) put('edv', `Volumen telediastólico (${edv.m})`, edv.v, `${dec(edv.v, 0)} ml`);
  if (esv) put('esv', `Volumen telesistólico (${esv.m})`, esv.v, `${dec(esv.v, 0)} ml`);
  if (edv && bsa) put('edvi', 'Volumen telediastólico indexado', edv.v / bsa, `${dec(edv.v / bsa, 0)} ml/m²`, { ref: refText('edvi', sex, String) });
  if (esv && bsa) put('esvi', 'Volumen telesistólico indexado', esv.v / bsa, `${dec(esv.v / bsa, 0)} ml/m²`, { ref: refText('esvi', sex, String) });
  if (edv && esv && edv.v > 0 && esv.v >= edv.v) R.warn_vs = { label: 'Revisar volúmenes', v: null, text: 'El volumen telesistólico es igual o mayor que el telediastólico: no se calcula la FEVI por Simpson.', flag: 'alto', ref: '' };
  if (edv && esv && edv.v > 0 && esv.v < edv.v) {
    const ef = (edv.v - esv.v) / edv.v * 100;
    const method = edv.m === esv.m ? edv.m : 'mixto';
    put('ef_s', `FEVI (Simpson ${method})`, ef, pct(ef), { ref: refText('ef_s', sex, String) + ' %' });
    put('sv_s', 'Volumen sistólico (Simpson)', edv.v - esv.v, `${dec(edv.v - esv.v, 0)} ml`);
  }

  const lav = vol('la4', 'la2');
  if (lav) put('lav', `Volumen AI (${lav.m})`, lav.v, `${dec(lav.v, 0)} ml`);
  if (lav && bsa) put('lavi', 'Volumen AI indexado', lav.v / bsa, `${dec(lav.v / bsa, 0)} ml/m²`, { ref: '≤ 34 ml/m²' });

  const E = sc('e'), A = sc('a'), es = sc('esep'), el = sc('elat'), trv = sc('trv');
  if (E && A) put('ea', 'Relación E/A', E / A, dec(E / A, 2));
  let ep = null;
  if (es && el) { ep = (es + el) / 2; put('eprom', "e' promedio", ep, `${dec(ep, 1)} cm/s`); }
  const eRef = ep || es || el;
  if (E && eRef) {
    const lab = ep ? "E/e' promedio" : es ? "E/e' septal" : "E/e' lateral";
    put('ee', lab, E / eRef, dec(E / eRef, 1), ep ? { ref: '≤ 14' } : { flag: null, ref: ep ? '≤ 14' : es ? '≤ 15' : '≤ 13' });
    if (!ep) { const lim = es ? 15 : 13; R.ee.flag = E / eRef > lim ? 'alto' : null; }
  }
  const ivx = sc('ivc_max'), ivn = sc('ivc_min');
  let rapEst = null;
  if (ivx && ivn && ivn <= ivx) {
    const ci = (ivx - ivn) / ivx;
    rapEst = ivx <= 2.1 && ci > 0.5 ? 3 : ivx > 2.1 && ci < 0.5 ? 15 : 8;
    put('ivc_ci', 'Colapso inspiratorio de la VCI', ci * 100, pct(ci * 100), { ref: '> 50 %', flag: ci < 0.5 ? 'bajo' : null });
    put('rap_est', 'Presión de AD estimada por VCI', rapEst, `${rapEst} mmHg`, { note: 'VCI ≤ 21 mm con colapso > 50 % → 3 mmHg; > 21 mm con colapso < 50 % → 15 mmHg; los demás casos → 8 mmHg.', flag: rapEst > 3 ? 'alto' : null });
  }
  if (trv) {
    const manual = isNum(st.rap) ? st.rap : null, rap = manual !== null ? manual : (rapEst !== null ? rapEst : 3);
    const src = manual !== null ? 'elegida a mano' : rapEst !== null ? 'estimada por VCI' : 'asumida (sin VCI)';
    const ps = 4 * (trv / 100) ** 2 + rap;
    put('psap', 'PSAP estimada', ps, `${dec(ps, 0)} mmHg`, { note: `Gradiente VD–AD ${dec(4 * (trv / 100) ** 2, 0)} mmHg + presión de AD ${rap} mmHg (${src}).` });
  }
  const d1d = sc('ei_d1_d'), d2d = sc('ei_d2_d'), d1s = sc('ei_d1_s'), d2s = sc('ei_d2_s');
  if (d1d && d2d) { const e = d2d / d1d; put('ei_d', 'Índice de excentricidad en diástole', e, dec(e, 2), { ref: '≈ 1,0', flag: e > 1.1 ? 'alto' : null }); }
  if (d1s && d2s) { const e = d2s / d1s; put('ei_s', 'Índice de excentricidad en sístole', e, dec(e, 2), { ref: '≈ 1,0', flag: e > 1.1 ? 'alto' : null }); }
  if (R.ei_d || R.ei_s) {
    const dd = R.ei_d && R.ei_d.v > 1.1, ss = R.ei_s && R.ei_s.v > 1.1;
    const t = dd && ss ? 'Aplanamiento septal en sístole y diástole: sugiere sobrecarga de presión del VD.' : dd ? 'Aplanamiento septal en diástole: sugiere sobrecarga de volumen del VD.' : ss ? 'Aplanamiento septal en sístole: sugiere sobrecarga de presión del VD.' : 'Sin aplanamiento septal significativo.';
    put('ei_int', 'Interpretación del índice de excentricidad', dd || ss ? 1 : 0, dd || ss ? 'Septo aplanado' : 'Normal', { note: t, flag: dd || ss ? 'alto' : null });
  }
  const tsv = val('ts_vti'), tsp = sc('ts_pht');
  if (tsv && isNum(tsv.mg)) put('ts_mg', 'Gradiente medio tricuspídeo', tsv.mg, `${dec(tsv.mg, 1)} mmHg`, { ref: 'significativa ≥ 5 mmHg', flag: tsv.mg >= 5 ? 'alto' : null, note: tsv.vti >= 60 ? `ITV ${dec(tsv.vti, 0)} cm (≥ 60 cm apoya estenosis significativa).` : '' });
  if (tsp) { const a = 190 / (tsp * 1000); put('tva', 'Área valvular tricuspídea (190/PHT)', a, `${dec(a, 2)} cm²`, { ref: 'significativa ≤ 1,0 cm²', flag: a <= 1 ? 'bajo' : null, note: `Tiempo de hemipresión ${dec(tsp * 1000, 0)} ms (≥ 190 ms apoya estenosis significativa).` }); }
  const psv = sc('ps_vmax');
  if (psv) {
    const m = psv / 100, pg = 4 * m * m, g = m > 4 ? 'severa' : m >= 3 ? 'moderada' : 'leve o ausente';
    put('ps_pg', 'Gradiente pico pulmonar', pg, `${dec(pg, 0)} mmHg`, { ref: 'severa > 64 mmHg', flag: m >= 3 ? 'alto' : null, note: `Vmax ${dec(m, 2)} m/s: estenosis pulmonar ${g}.` });
  }
  {
    const crit = [];
    if (E && eRef) crit.push(ep ? E / ep > 14 : (es ? E / es > 15 : E / el > 13));
    if (es || el) crit.push((es !== null && es < 7) || (el !== null && el < 10));
    if (trv) crit.push(trv > 280);
    if (R.lavi) crit.push(R.lavi.v > 34);
    const efNow = R.ef_s ? R.ef_s.v : R.ef_t ? R.ef_t.v : null;
    if (crit.length >= 3 && !(efNow !== null && efNow < 50)) {
      const ab = crit.filter(Boolean).length, n = crit.length;
      let txt;
      if (ab / n > 0.5) txt = 'Sugiere disfunción diastólica';
      else if (ab / n === 0.5) txt = 'Indeterminado';
      else txt = 'Función diastólica normal';
      put('dd', 'Algoritmo diastólico (FEVI normal)', ab, `${ab} de ${n} alterados`, { note: `${txt}. Válido solo con FEVI conservada y sin otras condiciones que lo invaliden.` });
    }
  }

  const lvot = sc('lvot'), lv = val('lvotvti'), av = val('avvti');
  const lvotA = lvot ? Math.PI * (lvot / 2) ** 2 : null;
  if (lvotA) put('lvota', 'Área TSVI', lvotA, `${dec(lvotA, 2)} cm²`);
  if (lvotA && lv && isNum(lv.vti)) {
    const sv = lvotA * lv.vti;
    put('sv_d', 'Volumen sistólico (Doppler)', sv, `${dec(sv, 0)} ml`);
    const hr = st.hr > 0 ? st.hr : null;
    if (hr) { put('co', 'Gasto cardíaco', sv * hr / 1000, `${dec(sv * hr / 1000, 1)} l/min`); if (bsa) put('ci', 'Índice cardíaco', sv * hr / 1000 / bsa, `${dec(sv * hr / 1000 / bsa, 1)} l/min/m²`, { ref: '2,5–4,0' }); }
  }
  const rvotd = sc('rvotd'), rvti = val('rvotvti'), pat = sc('pat');
  const rvotA = rvotd ? Math.PI * (rvotd / 2) ** 2 : null;
  if (rvotA) put('rvota', 'Área TSVD', rvotA, `${dec(rvotA, 2)} cm²`);
  if (rvotA && rvti && isNum(rvti.vti)) {
    const qp = rvotA * rvti.vti;
    put('qp', 'Flujo pulmonar por latido (Qp)', qp, `${dec(qp, 0)} ml`);
    if (R.sv_d) {
      const r = qp / R.sv_d.v;
      const fl = r >= 1.5 ? 'alto' : r < 0.7 ? 'bajo' : null;
      const note = r >= 1.5 ? 'Sugiere un cortocircuito de izquierda a derecha significativo; confírmalo con otros hallazgos.'
        : r < 0.7 ? 'Valor bajo: revisa los diámetros (el error se eleva al cuadrado) o considera un cortocircuito de derecha a izquierda.' : 'Sin evidencia de cortocircuito significativo.';
      put('qpqs', 'Relación Qp/Qs', r, dec(r, 2), { ref: '≈ 1,0 · significativo ≥ 1,5', flag: fl, note });
    }
  }
  if (pat) {
    const ms = pat * 1000, m = 79 - 0.45 * ms;
    put('mpap_pat', 'PAPm estimada por TAP (Mahan)', m, `${dec(m, 0)} mmHg`, { note: `TAP ${dec(ms, 0)} ms${ms < 105 ? ', sugestivo de hipertensión pulmonar (< 105 ms)' : ''}. Estimación orientativa; intégrala con la velocidad de insuficiencia tricuspídea.` });
  }
  const vmaxAo = sc('avvmax') || (av && isNum(av.vmax) ? av.vmax : null);
  if (vmaxAo) put('avpg', 'Gradiente pico aórtico', 4 * (vmaxAo / 100) ** 2, `${dec(4 * (vmaxAo / 100) ** 2, 0)} mmHg`);
  if (av && isNum(av.mg)) put('avmg', 'Gradiente medio aórtico', av.mg, `${dec(av.mg, 0)} mmHg`, { ref: 'severa ≥ 40' });
  if (lvotA && lv && av && av.vti > 0) {
    const ava = lvotA * lv.vti / av.vti;
    put('ava', 'Área valvular aórtica (continuidad)', ava, `${dec(ava, 2)} cm²`, { ref: 'severa < 1,0' });
  }
  const rvd = val('rvda'), rvs2 = val('rvsa');
  if (rvd && rvs2 && rvd.area > 0) { const fac = (rvd.area - rvs2.area) / rvd.area * 100; put('fac', 'Cambio de área fraccional VD (CAF)', fac, pct(fac), { ref: '≥ 35 %' }); }
  const pr = sc('pisa_r'), pva = sc('pisa_va'), mrti = val('mrvti');
  const mrv = sc('mrvmax') || (mrti && isNum(mrti.vmax) ? mrti.vmax : null);
  if (pr && pva && mrv) {
    const ero = 2 * Math.PI * pr * pr * pva / mrv;
    const g = ero >= 0.40 ? 'severa' : ero >= 0.20 ? 'moderada' : 'leve';
    put('ero', 'Orificio regurgitante efectivo (ORE)', ero, `${dec(ero, 2)} cm²`, { ref: 'severa ≥ 0,40', note: `Rango ${g}. En la insuficiencia secundaria el PISA puede subestimar el orificio.` });
    if (mrti && isNum(mrti.vti)) {
      const rv = ero * mrti.vti, gv = rv >= 60 ? 'severa' : rv >= 30 ? 'moderada' : 'leve';
      put('mr_rvol', 'Volumen regurgitante mitral', rv, `${dec(rv, 0)} ml`, { ref: 'severa ≥ 60 ml', note: `Rango ${gv}.` });
    }
  }
  if (R.psap && sc('tapse')) {
    const r = sc('tapse') * 10 / R.psap.v;
    put('tapsepsap', 'Relación TAPSE/PSAP', r, `${dec(r, 2)} mm/mmHg`, { ref: '≥ 0,55', flag: r < 0.55 ? 'bajo' : null, note: r < 0.55 ? 'Sugiere desacoplamiento entre el VD y la circulación pulmonar.' : '' });
  }
  const mrvc = sc('mr_vc');
  if (mrvc) { const g = mrvc >= 0.7 ? 'severa' : mrvc < 0.3 ? 'leve' : 'intermedia'; put('mrvc_g', 'Insuficiencia mitral por vena contracta', g, `Rango ${g}`, { ref: 'leve < 3 mm · severa ≥ 7 mm' }); }
  const mspht = sc('ms_pht'), msv = val('msvti');
  if (mspht) {
    const mva = 220 / (mspht * 1000);
    const g = mva <= 1.0 ? 'muy severa' : mva <= 1.5 ? 'severa' : 'no significativa';
    put('mva', 'Área valvular mitral (220/PHT)', mva, `${dec(mva, 2)} cm²`, { ref: 'significativa ≤ 1,5', flag: mva <= 1.5 ? 'bajo' : null, note: `Estenosis ${g}. El PHT pierde exactitud tras valvuloplastia o con alteración de la distensibilidad del VI o la AI.` });
  }
  if (msv && isNum(msv.mg)) put('msmg', 'Gradiente medio mitral', msv.mg, `${dec(msv.mg, 1)} mmHg`, { note: 'Depende de la frecuencia cardíaca y del flujo.' });
  const arpht = sc('ar_pht'), arvc = sc('ar_vc');
  if (arpht || arvc) {
    const parts = [];
    if (arpht) { const ms = arpht * 1000; parts.push(`PHT ${dec(ms, 0)} ms: rango ${ms < 200 ? 'severo' : ms > 500 ? 'leve' : 'moderado'}`); }
    if (arvc) parts.push(`vena contracta ${dec(arvc * 10, 1)} mm: rango ${arvc > 0.6 ? 'severo' : arvc < 0.3 ? 'leve' : 'moderado'}`);
    const severe = (arpht && arpht < 0.2) || (arvc && arvc > 0.6);
    put('ar_sev', 'Severidad de la insuficiencia aórtica', parts.join(' · '), severe ? 'Rango severo' : 'Ver detalle', { note: parts.join('; ') + '.', flag: severe ? 'alto' : null });
  }
  if (lv && av && av.vti > 0) put('dvi', 'Índice adimensional (ITV TSVI/ITV Ao)', lv.vti / av.vti, dec(lv.vti / av.vti, 2), { ref: 'severa < 0,25' });
  return R;
}

/* Texto para una medida guardada (escalares, contornos e ITV) */
function measureText(k, v, units) {
  const d = DEF[k]; if (!d || v === undefined || v === null) return '';
  if (d.t === 'trace') return isNum(v.area) ? (d.areaOnly ? `${dec(v.area, 1)} cm²` : `${dec(v.area, 1)} cm² · ${dec(v.vol, 0)} ml`) : '';
  if (d.t === 'vti') return isNum(v.vti) ? `${dec(v.vti, 1)} cm · ${dec(v.vmax / 100, 2)} m/s` : '';
  return fmtQ(v, d.q, units);
}

const SECTIONS = [
  ['Ventrículo izquierdo', ['ivsd', 'lvidd', 'pwd', 'lvids', 'warn_ds', 'fs', 'ef_t', 'edv', 'esv', 'warn_vs', 'edvi', 'esvi', 'ef_s', 'sv_s', 'lvm', 'lvmi', 'rwt', 'geom']],
  ['Función diastólica y presiones', ['e', 'a', 'ea', 'dt', 'esep', 'elat', 'eprom', 'ee', 'trv', 'psap', 'tapsepsap', 'dd']],
  ['Aurícula izquierda', ['la_ap', 'lav', 'lavi']],
  ['Aorta y tracto de salida', ['aoroot', 'aoasc', 'lvot', 'lvota']],
  ['Flujos y válvula aórtica', ['lvotvti', 'sv_d', 'co', 'ci', 'avvti', 'avvmax', 'avpg', 'avmg', 'ava', 'dvi']],
  ['Insuficiencia aórtica', ['ar_pht', 'ar_vc', 'ar_sev']],
  ['Estenosis mitral', ['ms_pht', 'mva', 'msvti', 'msmg']],
  ['Insuficiencia mitral', ['pisa_r', 'pisa_va', 'mrvmax', 'mrvti', 'ero', 'mr_rvol', 'mr_vc', 'mrvc_g']],
  ['Ventrículo derecho', ['rvd1', 'tapse', 'rvs', 'fac']],
  ['Vena cava inferior', ['ivc_max', 'ivc_min', 'ivc_ci', 'rap_est']],
  ['Índice de excentricidad del VI', ['ei_d1_d', 'ei_d2_d', 'ei_d', 'ei_d1_s', 'ei_d2_s', 'ei_s', 'ei_int']],
  ['Tracto de salida del VD y flujo pulmonar', ['rvotd', 'rvota', 'pat', 'mpap_pat', 'rvotvti', 'qp', 'qpqs']],
  ['Válvulas tricúspide y pulmonar', ['ts_vti', 'ts_mg', 'ts_pht', 'tva', 'ps_vmax', 'ps_pg']]
];
const SHORT = {
  ivsd: 'Septo interventricular (diástole)', lvidd: 'Diámetro diastólico VI', pwd: 'Pared posterior (diástole)', lvids: 'Diámetro sistólico VI',
  la_ap: 'Diámetro anteroposterior AI', aoroot: 'Raíz aórtica (senos de Valsalva)', aoasc: 'Aorta ascendente', lvot: 'Diámetro del TSVI',
  rvd1: 'Diámetro basal VD', tapse: 'TAPSE', rvs: "Onda S' tricuspídea", e: 'Onda E mitral', a: 'Onda A mitral', dt: 'Tiempo de desaceleración de E',
  esep: "e' septal", elat: "e' lateral", ivc_max: 'VCI diámetro máximo', ivc_min: 'VCI diámetro mínimo', ei_d1_d: 'D1 en diástole (perpendicular al septo)', ei_d2_d: 'D2 en diástole (paralelo al septo)', ei_d1_s: 'D1 en sístole (perpendicular al septo)', ei_d2_s: 'D2 en sístole (paralelo al septo)', ts_vti: 'ITV tricuspídea', ts_pht: 'Tiempo de hemipresión tricuspídeo', ps_vmax: 'Velocidad máxima pulmonar', rvotd: 'Diámetro del TSVD', pat: 'Tiempo de aceleración pulmonar', rvotvti: 'ITV del TSVD', mr_vc: 'Vena contracta mitral', ms_pht: 'Tiempo de hemipresión mitral', msvti: 'ITV mitral', ar_pht: 'Tiempo de hemipresión aórtico', ar_vc: 'Vena contracta aórtica', pisa_r: 'Radio PISA', pisa_va: 'Velocidad de aliasing', mrvmax: 'Velocidad máxima de insuficiencia mitral', mrvti: 'ITV de insuficiencia mitral', trv: 'Velocidad máxima de insuficiencia tricuspídea', lvotvti: 'ITV del TSVI', avvti: 'ITV aórtica', avvmax: 'Velocidad máxima aórtica'
};

/* ---- Angiografía coronaria ---- */
const CORONARY = [
  { v: 'TCI', n: 'Tronco coronario izquierdo', segs: [['tci', 'Tronco coronario izquierdo']] },
  { v: 'DA', n: 'Descendente anterior', segs: [['da_p', 'DA proximal'], ['da_m', 'DA media'], ['da_d', 'DA distal'], ['d1', 'Primera diagonal'], ['d2', 'Segunda diagonal']] },
  { v: 'Cx', n: 'Circunfleja', segs: [['cx_p', 'Cx proximal'], ['cx_d', 'Cx distal'], ['ri', 'Ramo intermedio'], ['om1', 'Primera obtusa marginal'], ['om2', 'Segunda obtusa marginal']] },
  { v: 'CD', n: 'Coronaria derecha', segs: [['cd_p', 'CD proximal'], ['cd_m', 'CD media'], ['cd_d', 'CD distal'], ['dp', 'Descendente posterior'], ['pl', 'Posterolateral']] }
];
const SEG_NAME = {}; for (const g of CORONARY) for (const [k, n] of g.segs) SEG_NAME[k] = n;
function studyKindOf(st) {
  if (st && st.kind) return st.kind;
  const mods = (st && st.modalities) || [];
  if (mods.some(m => m === 'XA' || m === 'RF') && !mods.includes('US')) return 'angio';
  if (mods.includes('CT') && !mods.includes('US')) return 'tc';
  if (mods.includes('MR') && !mods.includes('US')) return 'rm';
  return 'eco';
}
function segVessel(k, dom) {
  if ((k === 'dp' || k === 'pl') && dom === 'izquierda') return 'Cx';
  for (const g of CORONARY) if (g.segs.some(s => s[0] === k)) return g.v;
  return '';
}
function computeAngio(st) {
  const A = st.angio || {}, out = { lesions: [], vessels: {}, tci: false, n: 0 };
  for (const g of CORONARY) for (const [k, n] of g.segs) {
    const x = st.values['cor_' + k] && st.values['cor_' + k].v;
    if (isNum(x) && x > 0) {
      const ves = segVessel(k, A.dom), sig = k === 'tci' ? x >= 50 : x >= 70;
      out.lesions.push({ k, n, pct: x, ves, sig });
      if (sig) { if (k === 'tci') out.tci = true; else out.vessels[ves] = true; }
    }
  }
  out.n = Object.keys(out.vessels).length;
  return out;
}
function aoAngLine(st, en) {
  const ao = [['aoroot', en ? 'aortic root' : 'raíz aórtica'], ['aoasc', en ? 'ascending aorta' : 'aorta ascendente']].filter(([k]) => isNum(st.values['ang_' + k] && st.values['ang_' + k].v))
    .map(([k, n]) => { const mm = st.values['ang_' + k].v * 10; return en ? `${n} ${dec(mm, 0)} mm${mm >= 40 ? ' (dilated)' : ''}` : `${n} de ${dec(mm, 0)} mm${mm >= 40 ? ' (dilatada)' : ''}`; });
  return ao.length ? ao.join('; ').replace(/^./, x => x.toUpperCase()) + '.' : '';
}
function buildConclusionAngio(st) {
  if (typeof I18N !== 'undefined' && I18N.lang === 'en' && typeof buildConclusionAngioEN === 'function') return buildConclusionAngioEN(st);
  const A = st.angio || {}, R = computeAngio(st), L = [];
  if (A.dom) L.push(`Circulación coronaria con dominancia ${A.dom === 'codominante' ? 'balanceada (codominancia)' : A.dom}.`);
  if (!R.lesions.length) { L.push('Arterias coronarias sin lesiones angiográficas.'); { const t = aoAngLine(st, false); if (t) L.push(t); } for (const v of ['DA', 'Cx', 'CD']) { const r = typeof tfcOf === 'function' && tfcOf(Object.assign({ v }, (A.tfc || {})[v])); if (r) L.push(`Conteo de cuadros TIMI ${v === 'DA' ? 'corregido ' : ''}en ${{ DA: 'descendente anterior', Cx: 'circunfleja', CD: 'coronaria derecha' }[v]}: ${dec(r.ctfc, 0)} (${r.ctfc > TFC_REF[v].up ? 'flujo lento' : 'normal'}).`); } return L.join('\n'); }
  const byV = {};
  for (const l of R.lesions) (byV[l.ves] = byV[l.ves] || []).push(l);
  const name = { TCI: 'Tronco coronario izquierdo', DA: 'Descendente anterior', Cx: 'Circunfleja', CD: 'Coronaria derecha' };
  const qs = k => { const q = st.values['cor_' + k] && st.values['cor_' + k].qca; return q ? (q.mld ? ` (QCA, DLM ${dec(q.mld, 2)} mm)` : ' (QCA)') : ''; };
  for (const v of ['TCI', 'DA', 'Cx', 'CD']) if (byV[v]) L.push(`${name[v]}: ${byV[v].map(l => l.pct >= 100 ? `oclusión total en ${l.n}` : `lesión de ${dec(l.pct, 0)} %${qs(l.k)} en ${l.n}`).join('; ')}.`);
  const timi = A.timi || {};
  for (const v of ['DA', 'Cx', 'CD']) if (timi[v] && timi[v] !== '3') L.push(`Flujo TIMI ${timi[v]} en ${name[v].toLowerCase()}.`);
  for (const v of ['DA', 'Cx', 'CD']) { const r = typeof tfcOf === 'function' && tfcOf(Object.assign({ v }, (A.tfc || {})[v])); if (r) L.push(`Conteo de cuadros TIMI ${v === 'DA' ? 'corregido ' : ''}en ${name[v].toLowerCase()}: ${dec(r.ctfc, 0)} (${r.ctfc > TFC_REF[v].up ? 'flujo lento' : 'normal'}).`); }
  for (const v of ['DA', 'Cx', 'CD']) { const b = (A.blush || {})[v]; if (b && b !== '3') L.push(`Blush miocárdico grado ${b} en el territorio de la ${name[v].toLowerCase()}.`); }
  { const t = aoAngLine(st, false); if (t) L.push(t); }
  const sigTxt = R.n ? `Enfermedad coronaria significativa de ${R.n} ${R.n === 1 ? 'vaso' : 'vasos'} (${Object.keys(R.vessels).join(', ')})` : '';
  if (R.tci) L.push((sigTxt ? sigTxt + ', con' : 'Enfermedad coronaria con') + ' compromiso significativo del tronco coronario izquierdo.');
  else if (sigTxt) L.push(sigTxt + '.');
  else L.push('Sin lesiones angiográficamente significativas (todas menores de 70 %, o de 50 % en el tronco).');
  return L.join('\n');
}
function reportModelAngio(st, pt, doctor) {
  const A = st.angio || {}, R = computeAngio(st), sex = pt && pt.sex;
  const age = pt ? ageAt(pt.birth, st.date) : null, sections = [];
  const proc = [['Acceso', A.access], ['Dominancia', A.dom ? (A.dom === 'codominante' ? 'Codominante' : A.dom[0].toUpperCase() + A.dom.slice(1)) : ''], ['Volumen de contraste', A.contrast ? `${A.contrast} ml` : ''], ['Tiempo de fluoroscopia', A.fluoro ? `${dec(A.fluoro, 1)} min` : '']].filter(x => x[1]);
  if (proc.length) sections.push({ title: 'Datos del procedimiento', rows: proc.map(([l, t]) => ({ label: l, text: t, ref: '', flag: null })) });
  if (R.lesions.length) sections.push({ title: 'Lesiones coronarias', rows: R.lesions.map(l => ({ label: l.n, text: l.pct >= 100 ? 'Oclusión total' : `${dec(l.pct, 0)} %` + ((q => q ? (q.mld ? ` (QCA, DLM ${dec(q.mld, 2)} mm)` : ' (QCA)') : '')(st.values['cor_' + l.k] && st.values['cor_' + l.k].qca)), ref: l.k === 'tci' ? 'significativa ≥ 50 %' : 'significativa ≥ 70 %', flag: l.sig ? 'alto' : null })) });
  else sections.push({ title: 'Lesiones coronarias', rows: [{ label: 'Arterias coronarias', text: 'Sin lesiones', ref: '', flag: null }] });
  const timi = A.timi || {}, trow = ['DA', 'Cx', 'CD'].filter(v => timi[v]).map(v => ({ label: `Flujo TIMI en ${v}`, text: `TIMI ${timi[v]}`, ref: 'normal TIMI 3', flag: timi[v] !== '3' ? 'bajo' : null }));
  for (const v of ['DA', 'Cx', 'CD']) { const r = typeof tfcOf === 'function' && tfcOf(Object.assign({ v }, (A.tfc || {})[v])); if (r) trow.push({ label: `Conteo de cuadros TIMI en ${v}${v === 'DA' ? ' (corregido)' : ''}`, text: dec(r.ctfc, 1), ref: `${dec(TFC_REF[v].m, 0)} ± ${dec(TFC_REF[v].sd, 0)}`, flag: r.ctfc > TFC_REF[v].up ? 'alto' : null }); }
  for (const v of ['DA', 'Cx', 'CD']) { const b = (A.blush || {})[v]; if (b) trow.push({ label: `Blush miocárdico en ${v}`, text: `Grado ${b}`, ref: 'normal grado 3', flag: b !== '3' ? 'bajo' : null }); }
  if (trow.length) sections.push({ title: 'Flujo coronario', rows: trow });
  { const ao = [['aoroot', 'Raíz aórtica (senos)'], ['aoasc', 'Aorta ascendente']].filter(([k]) => isNum(st.values['ang_' + k] && st.values['ang_' + k].v)).map(([k, n]) => { const o = st.values['ang_' + k]; return { label: n, text: `${dec(o.v * 10, 1)} mm${o.approx ? ' (calibración aproximada)' : ''}`, ref: '< 40 mm', flag: o.v * 10 >= 40 ? 'alto' : null }; });
    if (ao.length) sections.push({ title: 'Aorta', rows: ao }); }
  sections.push({ title: 'Resumen', rows: [{ label: 'Vasos con lesión significativa', text: R.n ? `${R.n} (${Object.keys(R.vessels).join(', ')})` : 'Ninguno', ref: '', flag: R.n ? 'alto' : null }].concat(R.tci ? [{ label: 'Tronco coronario izquierdo', text: 'Lesión significativa', ref: '', flag: 'alto' }] : []) });
  const head = [['Paciente', pt ? pt.name : ''], ['Documento', pt ? pt.doc : ''], ['Edad', age !== null ? `${age} años` : ''], ['Sexo', sex === 'H' ? 'Masculino' : sex === 'M' ? 'Femenino' : ''], ['Fecha del estudio', st.date ? st.date.split('-').reverse().join('/') : ''], ['Peso', st.weight ? `${dec(st.weight, 1)} kg` : ''], ['Talla', st.height ? `${dec(st.height, 0)} cm` : '']].filter(x => x[1]);
  return { title: 'Arteriografía coronaria', head, sections, conclusion: st.conclusion || '', doctor: doctor || '' };
}

function reportModel(st, pt, units, doctor) {
  if (studyKindOf(st) === 'angio') return reportModelAngio(st, pt, doctor);
  if (studyKindOf(st) === 'tc' && typeof reportModelCT === 'function') return reportModelCT(st, pt, doctor);
  if (studyKindOf(st) === 'rm' && typeof reportModelMR === 'function') return reportModelMR(st, pt, doctor);
  const C = computeAll(st, pt, units), sex = pt && pt.sex;
  const sections = [];
  for (const [title, keys] of SECTIONS) {
    const rows = [];
    for (const k of keys) {
      if (DEF[k]) {
        const v = st.values[k] && st.values[k].v;
        if (v === undefined || v === null) continue;
        const d = DEF[k];
        let text = measureText(k, v, units), ref = '', flag = null;
        if (d.t === 'vti') text = `${dec(v.vti, 1)} cm`;
        if (isNum(v)) { flag = flagFor(k, v, sex); ref = REF[k] ? refText(k, sex, convFor(d.q, units)) + ' ' + qUnit(d.q, units) : ''; }
        const nS = Array.isArray(st.values[k].s) ? st.values[k].s.length : 0;
        rows.push({ label: SHORT[k] || d.n, text, ref: ref.trim(), flag, note: nS > 1 ? `Promedio de ${nS} latidos.` : undefined });
      } else if (C[k]) rows.push({ label: C[k].label, text: C[k].text, ref: C[k].ref || '', flag: C[k].flag, note: C[k].note });
    }
    if (rows.length) sections.push({ title, rows });
  }
  const sexTxt = sex === 'H' ? 'Masculino' : sex === 'M' ? 'Femenino' : '';
  const age = pt ? ageAt(pt.birth, st.date) : null;
  const head = [
    ['Paciente', pt ? pt.name : ''], ['Documento', pt ? pt.doc : ''], ['Edad', age !== null ? `${age} años` : ''], ['Sexo', sexTxt],
    ['Fecha del estudio', st.date ? st.date.split('-').reverse().join('/') : ''],
    ['Peso', st.weight ? `${dec(st.weight, 1)} kg` : ''], ['Talla', st.height ? `${dec(st.height, 0)} cm` : ''],
    ['Superficie corporal', C.bsa ? C.bsa.text : ''], ['Frecuencia cardíaca', st.hr ? `${st.hr} lpm` : ''],
    ['Presión arterial', st.sbp && st.dbp ? `${st.sbp}/${st.dbp} mmHg` : '']
  ].filter(x => x[1]);
  { const w = typeof wmCompute === 'function' ? wmCompute(st) : null; if (w) { const rows = [{ label: 'Índice de motilidad (IMS)', text: dec(w.wmsi, 2), ref: `1,00 · ${w.n} de 17 segmentos`, flag: w.wmsi > 1 ? 'alto' : null }];
    for (const k of [2, 3, 4]) if (w.by[k].length) rows.push({ label: WM[k].n, text: w.by[k].map(sg => AHA17[sg - 1]).join(', '), ref: '' });
    sections.push({ title: 'Motilidad segmentaria', rows }); } }
  return { title: 'Ecocardiograma transtorácico', head, sections, conclusion: st.conclusion || '', doctor: doctor || '' };
}

/* Conclusión automática a partir de las medidas (texto editable) */
function buildConclusion(st, pt) {
  if (typeof I18N !== 'undefined' && I18N.lang === 'en' && typeof buildConclusionEN === 'function') return buildConclusionEN(st, pt);
  const C = computeAll(st, pt, 'mm'), sex = pt && pt.sex, v = k => { const x = st.values[k] && st.values[k].v; return isNum(x) ? x : null; };
  const L = [];
  const ef = C.ef_s || C.ef_t;
  {
    const parts = [];
    const d = v('lvidd'), edvi = C.edvi;
    const big = (edvi && edvi.flag === 'alto') || (d && flagFor('lvidd', d, sex) === 'alto');
    if (d || edvi) parts.push(big ? 'Ventrículo izquierdo dilatado' : 'Ventrículo izquierdo de dimensiones normales');
    if (C.geom) parts.push(C.geom.text.toLowerCase());
    else if ((v('ivsd') && flagFor('ivsd', v('ivsd'), sex) === 'alto') || (v('pwd') && flagFor('pwd', v('pwd'), sex) === 'alto')) parts.push('con aumento del grosor parietal');
    if (ef) {
      const e = ef.v, lo = sex === 'M' ? 54 : 52;
      const g = e >= lo ? 'función sistólica conservada' : e >= 41 ? 'disfunción sistólica leve' : e >= 30 ? 'disfunción sistólica moderada' : 'disfunción sistólica severa';
      parts.push(`${g} (FEVI ${dec(e, 0)} % por ${ef.label.replace(/^FEVI \(|\)$/g, '')})`);
    }
    if (parts.length) L.push(parts.join(', ') + '.');
  }
  if (C.dd) L.push(`Función diastólica: ${C.dd.note.split('.')[0].toLowerCase()}${C.ee ? ` (${C.ee.label} ${C.ee.text})` : ''}.`);
  if (C.lavi) { const x = C.lavi.v; L.push(`Aurícula izquierda ${x <= 34 ? 'de tamaño normal' : x <= 41 ? 'con dilatación leve' : x <= 48 ? 'con dilatación moderada' : 'con dilatación severa'} (volumen indexado ${C.lavi.text}).`); }
  {
    const tap = v('tapse'), sp = v('rvs'), fac = C.fac;
    const ab = (tap && tap < 1.7) || (sp && sp < 9.5) || (fac && fac.v < 35);
    if (tap || sp || fac) L.push(`Ventrículo derecho con función sistólica ${ab ? 'disminuida' : 'conservada'} (${[tap ? `TAPSE ${dec(tap * 10, 0)} mm` : '', sp ? `S' ${dec(sp, 1)} cm/s` : '', fac ? `CAF ${fac.text}` : ''].filter(Boolean).join(', ')}).`);
    if (v('rvd1') && v('rvd1') > 4.1) L.push(`Dilatación del ventrículo derecho (diámetro basal ${dec(v('rvd1') * 10, 0)} mm).`);
  }
  if (v('trv')) {
    const t = v('trv') / 100, p = t <= 2.8 ? 'baja' : t <= 3.4 ? 'intermedia' : 'alta';
    L.push(`Velocidad de insuficiencia tricuspídea ${dec(t, 1)} m/s${C.psap ? `, PSAP estimada ${C.psap.text}` : ''}: probabilidad ecocardiográfica ${p} de hipertensión pulmonar.`);
  }
  if (C.rap_est) L.push(`Vena cava inferior de ${dec(v('ivc_max') * 10, 0)} mm con colapso inspiratorio de ${C.ivc_ci.text}: presión de aurícula derecha estimada en ${C.rap_est.text}.`);
  if (C.ei_int && C.ei_int.flag) L.push(C.ei_int.note);
  if (C.ts_mg && C.ts_mg.flag) L.push(`Estenosis tricuspídea significativa (gradiente medio ${C.ts_mg.text}${C.tva ? `, área ${C.tva.text}` : ''}).`);
  if (C.ps_pg && C.ps_pg.flag) L.push(`Estenosis pulmonar: ${C.ps_pg.note.replace(/\.$/, '')}, gradiente pico ${C.ps_pg.text}.`);
  if (C.tapsepsap && C.tapsepsap.flag) L.push(`Relación TAPSE/PSAP ${C.tapsepsap.text}, sugestiva de desacoplamiento ventrículo-arterial derecho.`);
  if (C.qpqs && C.qpqs.v >= 1.5) L.push(`Relación Qp/Qs ${C.qpqs.text}, sugestiva de cortocircuito de izquierda a derecha significativo.`);
  {
    const vmax = (v('avvmax') || (st.values.avvti && st.values.avvti.v && st.values.avvti.v.vmax) || 0) / 100;
    const mg = C.avmg ? C.avmg.v : null, ava = C.ava ? C.ava.v : null;
    if (vmax || mg || ava) {
      let g = 'sin estenosis aórtica significativa';
      if (vmax >= 4 || (mg && mg >= 40) || (ava && ava < 1)) g = 'estenosis aórtica en rango severo';
      else if (vmax >= 3 || (mg && mg >= 20) || (ava && ava <= 1.5)) g = 'estenosis aórtica moderada';
      else if (vmax >= 2.6) g = 'esclerosis o estenosis aórtica leve';
      L.push(`Válvula aórtica: ${g} (${[vmax ? `Vmax ${dec(vmax, 1)} m/s` : '', mg ? `gradiente medio ${dec(mg, 0)} mmHg` : '', ava ? `AVA ${dec(ava, 2)} cm²` : ''].filter(Boolean).join(', ')}).`);
    }
  }
  if (C.ero || C.mrvc_g) {
    const g = C.ero ? (C.ero.v >= 0.4 ? 'severa' : C.ero.v >= 0.2 ? 'moderada' : 'leve') : C.mrvc_g.v;
    L.push(`Insuficiencia mitral ${g === 'intermedia' ? 'de grado intermedio' : g}${C.ero ? ` (ORE ${C.ero.text}${C.mr_rvol ? `, volumen regurgitante ${C.mr_rvol.text}` : ''})` : ''}.`);
  }
  if (C.mva) L.push(`Estenosis mitral: área valvular ${C.mva.text} por tiempo de hemipresión${C.msmg ? `, gradiente medio ${C.msmg.text}` : ''}.`);
  if (C.ar_sev) L.push(`Insuficiencia aórtica: ${C.ar_sev.note.replace(/\.$/, '')}.`);
  const ao = v('aoroot'); if (ao && ao > 4.0) L.push(`Dilatación de la raíz aórtica (${dec(ao * 10, 0)} mm a nivel de los senos).`);
  { const t = typeof wmSentence === 'function' ? wmSentence(st, false) : ''; if (t) { const i = L.findIndex(l => /^Ventrículo izquierdo/.test(l)); L.splice(i + 1, 0, t); } }
  return L.join('\n');
}

/* Orden sugerido del estudio para el modo guiado */
const PROTOCOL = [
  ['ivsd', 'Paraesternal eje largo'], ['lvidd', 'Paraesternal eje largo'], ['pwd', 'Paraesternal eje largo'], ['lvids', 'Paraesternal eje largo'],
  ['la_ap', 'Paraesternal eje largo'], ['aoroot', 'Paraesternal eje largo'], ['aoasc', 'Paraesternal eje largo'], ['lvot', 'Paraesternal eje largo'],
  ['rvotd', 'Eje corto de grandes vasos'], ['pat', 'Doppler pulsado del TSVD'], ['rvotvti', 'Doppler pulsado del TSVD'],
  ['lved4', 'Apical 4 cámaras'], ['lves4', 'Apical 4 cámaras'], ['la4', 'Apical 4 cámaras'],
  ['e', 'Doppler pulsado mitral'], ['a', 'Doppler pulsado mitral'], ['dt', 'Doppler pulsado mitral'],
  ['esep', 'Doppler tisular mitral'], ['elat', 'Doppler tisular mitral'],
  ['rvd1', 'Apical 4C enfocada en VD'], ['rvda', 'Apical 4C enfocada en VD'], ['rvsa', 'Apical 4C enfocada en VD'],
  ['tapse', 'Modo M tricuspídeo'], ['rvs', 'Doppler tisular tricuspídeo'], ['trv', 'Doppler continuo tricuspídeo'],
  ['lved2', 'Apical 2 cámaras'], ['lves2', 'Apical 2 cámaras'], ['la2', 'Apical 2 cámaras'],
  ['lvotvti', 'Apical 5 cámaras'], ['avvmax', 'Apical 5 cámaras'], ['avvti', 'Apical 5 cámaras'],
  ['ivc_max', 'Subcostal'], ['ivc_min', 'Subcostal']
];

/* Casos de prueba con resultados conocidos */
function runTests() {
  const T = [], near = (a, b, tol) => Math.abs(a - b) <= tol;
  const ck = (name, got, exp, tol) => T.push({ name, got, exp, ok: isNum(got) && near(got, exp, tol) });
  const safe = (name, fn, exp, tol) => { try { ck(name, fn(), exp, tol); } catch (e) { T.push({ name, got: NaN, exp, ok: false, err: e.message }); } };
  const P = { sex: 'H' };
  let R = computeAll({ values: { lvidd: { v: 5 }, lvids: { v: 3.5 }, ivsd: { v: 1 }, pwd: { v: 1 } }, weight: 70, height: 170 }, P, 'mm');
  ck('Superficie corporal (Mosteller) 70 kg, 170 cm', R.bsa.v, 1.818, 0.002);
  ck('FEVI Teichholz (DdVI 50, DsVI 35 mm)', R.ef_t.v, 56.96, 0.05);
  ck('Fracción de acortamiento', R.fs.v, 30, 0.01);
  ck('Masa VI ASE (10/50/10 mm)', R.lvm.v, 182.0, 0.1);
  ck('Grosor parietal relativo', R.rwt.v, 0.40, 0.001);
  const ell = []; for (let i = 0; i <= 400; i++) { const t = -Math.PI / 2 + Math.PI * i / 400; ell.push({ x: 2.5 * Math.sin(t), y: 8 * Math.cos(t) }); }
  const g = contourGeometry(ell);
  ck('Simpson, media elipse a 2,5 cm y L 8 cm (2/3·π·a²·L)', g.vol, 2 / 3 * Math.PI * 6.25 * 8, 0.6);
  ck('Simpson biplano con dos vistas iguales', biplaneVolume(g, g), g.vol, 0.01);
  R = computeAll({ values: { pisa_r: { v: 1 }, pisa_va: { v: 40 }, mrvmax: { v: 500 }, mrvti: { v: { vti: 150, vmax: 500, mg: 1 } } } }, P, 'mm');
  ck('ORE por PISA (r 10 mm, Va 40 cm/s, Vmax 5 m/s)', R.ero.v, 2 * Math.PI * 40 / 500, 0.0001);
  ck('Volumen regurgitante (ORE × ITV 150 cm)', R.mr_rvol.v, 2 * Math.PI * 40 / 500 * 150, 0.01);
  R = computeAll({ values: { lvot: { v: 2 }, lvotvti: { v: { vti: 20, vmax: 100, mg: 2 } }, avvti: { v: { vti: 80, vmax: 450, mg: 50 } }, rvotd: { v: 2.2 }, rvotvti: { v: { vti: 30, vmax: 80, mg: 1 } } } }, P, 'mm');
  ck('Área valvular aórtica por continuidad', R.ava.v, Math.PI * 20 / 80, 0.0001);
  ck('Qp/Qs (TSVD 22 mm, ITV 30; TSVI 20 mm, ITV 20)', R.qpqs.v, (Math.PI * 1.21 * 30) / (Math.PI * 20), 0.0001);
  ck('Gradiente pico aórtico 4,5 m/s', R.avpg.v, 81, 0.01);
  R = computeAll({ values: { trv: { v: 300 }, tapse: { v: 1.8 } }, rap: 3 }, P, 'mm');
  ck('PSAP (IT 3 m/s, AD 3 mmHg)', R.psap.v, 39, 0.001);
  ck('TAPSE/PSAP (18 mm / 39 mmHg)', R.tapsepsap.v, 18 / 39, 0.0001);
  R = computeAll({ values: { ms_pht: { v: 0.22 } } }, P, 'mm');
  ck('Área mitral 220/PHT (PHT 220 ms)', R.mva.v, 1.0, 0.0001);
  R = computeAll({ values: { rvda: { v: { area: 20 } }, rvsa: { v: { area: 12 } } } }, P, 'mm');
  ck('CAF del VD (20 → 12 cm²)', R.fac.v, 40, 0.0001);
  R = computeAll({ values: { e: { v: 80 }, esep: { v: 6 }, elat: { v: 10 } } }, P, 'mm');
  ck("E/e' promedio (80 / 8)", R.ee.v, 10, 0.0001);
  const regs = [{ fmt: 1, ux: 3, uy: 3, x0: 0, y0: 0, x1: 500, y1: 190, dx: 0.05, dy: 0.05 }, { fmt: 3, ux: 4, uy: 7, x0: 0, y0: 200, x1: 700, y1: 600, ry: 220, dx: 0.004, dy: -1 }];
  const ctx = { regions: regs, baseOverride: {} };
  safe('Distancia calibrada (100 px × 0,05 cm)', () => measureValue('dist', [{ x: 10, y: 10 }, { x: 110, y: 10 }], ctx).v, 5, 1e-9);
  safe('Velocidad respecto a la línea de base (80 px × 1 cm/s)', () => measureValue('vel', [{ x: 10, y: 340 }], ctx).v, 80, 1e-9);
  const tri = []; for (let i = 0; i <= 75; i++) { const t = i / 75; tri.push({ x: 100 + i, y: 420 - (t < 0.5 ? 200 * t : 200 * (1 - t)) }); }
  safe('ITV de una onda triangular (100 cm/s, 0,3 s → 15 cm)', () => measureValue('vti', tri, ctx).v.vti, 15, 0.01);
  safe('Tiempo de hemipresión de una pendiente lineal', () => measureValue('slope', [{ x: 100, y: 420 - 150 }, { x: 200, y: 420 - 50 }], ctx).v, 150 * (1 - Math.SQRT1_2) / (100 / 0.4), 1e-9);
  R = computeAll({ values: { ivc_max: { v: 2.4 }, ivc_min: { v: 1.6 }, trv: { v: 300 } } }, P, 'mm');
  ck('PAD por VCI (24 mm, colapso 33 % → 15 mmHg)', R.rap_est.v, 15, 0);
  ck('PSAP con PAD estimada por VCI (36 + 15)', R.psap.v, 51, 0.001);
  R = computeAll({ values: { ivc_max: { v: 1.8 }, ivc_min: { v: 0.7 } } }, P, 'mm');
  ck('PAD por VCI (18 mm, colapso 61 % → 3 mmHg)', R.rap_est.v, 3, 0);
  R = computeAll({ values: { ts_pht: { v: 0.19 }, ps_vmax: { v: 350 }, ei_d1_d: { v: 3 }, ei_d2_d: { v: 3.6 } } }, P, 'mm');
  ck('Área tricuspídea 190/PHT (PHT 190 ms)', R.tva.v, 1, 1e-9);
  ck('Gradiente pico pulmonar (3,5 m/s)', R.ps_pg.v, 49, 1e-9);
  ck('Índice de excentricidad diastólico (36/30 mm)', R.ei_d.v, 1.2, 1e-9);
  safe('Velocidad con corrección de ángulo de 60° (80 → 160 cm/s)', () => measureValue('vel', [{ x: 10, y: 340 }], Object.assign({}, ctx, { angle: 60 })).v, 160, 1e-6);
  const ang = computeAngio({ values: { cor_tci: { v: 60 }, cor_da_p: { v: 80 }, cor_cx_p: { v: 50 }, cor_dp: { v: 90 } }, angio: { dom: 'derecha' } });
  ck('Angiografía: vasos con lesión significativa (TCI 60 %, DA 80 %, Cx 50 %, DP 90 %)', ang.n + (ang.tci ? 10 : 0), 12, 0);
  /* ---- Datos incompletos, imposibles y límites ---- */
  const yes = (name, cond) => T.push({ name, got: cond ? 1 : 0, exp: 1, ok: !!cond });
  const throws = (name, fn) => { let thr = false; try { fn(); } catch (e) { thr = true; } yes(name, thr); };
  R = computeAll({ values: { lvidd: { v: 5 } } }, P, 'mm');
  yes('Sin DsVI no se calcula FEVI por Teichholz', !R.ef_t && !R.fs);
  R = computeAll({ values: { lvidd: { v: 4 }, lvids: { v: 5 } } }, P, 'mm');
  yes('DsVI mayor que DdVI: no da FEVI negativa y avisa', !R.ef_t && !R.fs && !!R.warn_ds);
  R = computeAll({ values: { lved4: { v: { area: 20, L: 7, w: [], vol: 50 } }, lves4: { v: { area: 25, L: 8, w: [], vol: 90 } } } }, P, 'mm');
  yes('VTS mayor que VTD: no da FEVI negativa y avisa', !R.ef_s && !R.sv_s && !!R.warn_vs);
  R = computeAll({ values: {}, weight: 0, height: 170 }, P, 'mm');
  yes('Peso 0: no calcula superficie corporal', !R.bsa);
  R = computeAll({ values: {}, weight: 40, height: 150 }, P, 'mm');
  ck('Superficie corporal en paciente pequeño (40 kg, 150 cm)', R.bsa.v, Math.sqrt(40 * 150 / 3600), 0.001);
  R = computeAll({ values: { lvotvti: { v: { vti: 20, vmax: 100, mg: 2 } }, avvti: { v: { vti: 80, vmax: 450, mg: 50 } } } }, P, 'mm');
  yes('Sin diámetro del TSVI no se calcula el área aórtica', !R.ava && R.dvi && Math.abs(R.dvi.v - 0.25) < 1e-9);
  R = computeAll({ values: { trv: { v: 250 } }, rap: 'auto' }, P, 'mm');
  ck('PSAP con PAD automática sin VCI (asume 3 mmHg): 25 + 3', R.psap.v, 28, 1e-9);
  R = computeAll({ values: { trv: { v: 0 } } }, P, 'mm');
  yes('Velocidad de IT 0: no calcula PSAP', !R.psap);
  R = computeAll({ values: { e: { v: 80 }, esep: { v: 8 } } }, P, 'mm');
  ck("E/e' solo con e' septal (80 / 8)", R.ee.v, 10, 1e-9);
  R = computeAll({ values: { lvidd: { v: 5 }, lvids: { v: 3.5 }, ivsd: { v: 1 }, pwd: { v: 1 } } }, P, 'cm');
  ck('Los cálculos no cambian al mostrar en cm (FEVI Teichholz)', R.ef_t.v, 56.96, 0.05);
  if (typeof toDisplay === 'function' && typeof fromDisplay === 'function') ck('Conversión de unidades ida y vuelta (5 cm → 50 mm → 5 cm)', fromDisplay(toDisplay(5, 'len', 'mm'), 'len', 'mm'), 5, 1e-12);
  throws('Velocidad medida fuera del espectro Doppler: se rechaza', () => measureValue('vel', [{ x: 10, y: 10 }], ctx));
  throws('Trazo de área demasiado corto: se rechaza', () => measureValue('area', [{ x: 1, y: 1 }, { x: 2, y: 2 }], ctx));
  throws('ITV que no avanza en el tiempo: se rechaza', () => measureValue('vti', [{ x: 100, y: 300 }, { x: 100, y: 320 }, { x: 100, y: 330 }, { x: 100, y: 340 }], ctx));
  const ang2 = computeAngio({ values: { cor_tci: { v: 49 }, cor_da_p: { v: 69 } }, angio: {} });
  yes('Angiografía: TCI 49 % y DA 69 % no son significativas', ang2.n === 0 && !ang2.tci);
  const ang3 = computeAngio({ values: { cor_tci: { v: 50 }, cor_da_p: { v: 70 } }, angio: {} });
  yes('Angiografía: TCI 50 % y DA 70 % sí son significativas', ang3.n === 1 && ang3.tci);
  const ang4 = computeAngio({ values: { cor_dp: { v: 90 } }, angio: { dom: 'izquierda' } });
  yes('Dominancia izquierda: la DP cuenta como Cx', !!ang4.vessels.Cx && !ang4.vessels.CD);
  if (typeof tfcOf === 'function') {
    ck('Conteo TIMI corregido de la DA (11 cuadros a 15/s → 22 → ÷1,7)', tfcOf({ v: 'DA', f0: 3, f1: 14, fps: 15 }).ctfc, 22 / 1.7, 1e-9);
    yes('Conteo TIMI con final anterior al inicio: no se calcula', tfcOf({ v: 'CD', f0: 10, f1: 4, fps: 15 }) === null);
  }
  if (typeof wmCompute === 'function') {
    ck('Índice de motilidad (16 normales y 1 acinético)', wmCompute({ wm: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, i === 16 ? 3 : 1])) }).wmsi, 19 / 17, 1e-9);
    yes('Índice de motilidad sin segmentos evaluados: no se calcula', wmCompute({ wm: {} }) === null);
  }
  return T;
}

/* ---- Plantillas de conclusión con valores automáticos ---- */
const TEMPLATES = [
  { id: 'normal', kind: 'eco', name: 'Ecocardiograma normal', text: 'Ventrículo izquierdo de dimensiones normales (DdVI {DdVI}), con grosor parietal normal y función sistólica global conservada (FEVI {FEVI}). Sin alteraciones segmentarias de la contractilidad.\nFunción diastólica normal (E/e\' {EE}).\nAurícula izquierda de tamaño normal (volumen indexado {AI}).\nVentrículo derecho de tamaño y función normales (TAPSE {TAPSE}).\nVálvulas sin alteraciones estructurales ni funcionales significativas.\nPSAP estimada {PSAP}. Vena cava inferior de calibre normal con colapso inspiratorio adecuado.\nSin derrame pericárdico.' },
  { id: 'hfref', kind: 'eco', name: 'Falla cardíaca con FEVI reducida', text: 'Ventrículo izquierdo dilatado (DdVI {DdVI}; volumen telediastólico indexado {VTDI}) con disfunción sistólica global (FEVI {FEVI}).\nAlteraciones segmentarias: ___.\nPatrón de llenado: E/A {EA}, E/e\' {EE}.\nAurícula izquierda con volumen indexado de {AI}.\nVentrículo derecho: TAPSE {TAPSE}, S\' {SVD}. PSAP estimada {PSAP}; presión de aurícula derecha {PAD}.\nInsuficiencia mitral: ___ (ORE {ORE}).\nSin trombos intracavitarios visibles.' },
  { id: 'valv', kind: 'eco', name: 'Valvulopatía', text: 'Válvula aórtica: ___. Vmax {VMAXAO}, gradiente medio {GMAO}, área por continuidad {AVA}, índice adimensional {DVI}.\nVálvula mitral: ___. Área por PHT {AVM}, gradiente medio {GMM}. Insuficiencia mitral con ORE {ORE} y volumen regurgitante {VR}.\nVálvula tricúspide: ___. Velocidad de insuficiencia {VIT}.\nFunción ventricular izquierda: FEVI {FEVI}, DdVI {DdVI}, DsVI {DsVI}.\nAurícula izquierda con volumen indexado de {AI}.' },
  { id: 'htp', kind: 'eco', name: 'Hipertensión pulmonar', text: 'Velocidad de insuficiencia tricuspídea {VIT}, PSAP estimada {PSAP} (presión de aurícula derecha {PAD}).\nProbabilidad ecocardiográfica de hipertensión pulmonar: ___.\nVentrículo derecho: diámetro basal {VDB}, TAPSE {TAPSE}, S\' {SVD}, CAF {CAF}. Relación TAPSE/PSAP {TAPSEPSAP}.\nTiempo de aceleración pulmonar {TAP}. Índice de excentricidad en sístole {EIS} y en diástole {EID}.\nVena cava inferior de {VCI} con colapso de {VCICOL}.\nFunción sistólica del ventrículo izquierdo conservada (FEVI {FEVI}).' },
  { id: 'cath', kind: 'angio', name: 'Arteriografía coronaria normal', text: 'Tronco coronario izquierdo sin lesiones.\nDescendente anterior y sus ramas diagonales sin lesiones angiográficas.\nCircunfleja y ramas obtusas marginales sin lesiones angiográficas.\nCoronaria derecha sin lesiones angiográficas.\nArterias coronarias epicárdicas sin enfermedad obstructiva.' }
];
const PHRASES = ['Sin derrame pericárdico.', 'Sin alteraciones segmentarias de la contractilidad.', 'Válvulas sin alteraciones significativas.', 'Septum interauricular íntegro al Doppler color.', 'Raíz aórtica y aorta ascendente de diámetros normales.', 'Ventana acústica subóptima.', 'Comparado con el estudio previo, sin cambios significativos.', 'Se recomienda correlación clínica.'];
function templateValues(st, pt) {
  const C = computeAll(st, pt, 'mm'), v = k => { const x = st.values[k] && st.values[k].v; return isNum(x) ? x : null; };
  const mm = k => v(k) !== null ? `${dec(v(k) * 10, 0)} mm` : null, t = k => C[k] ? C[k].text : null;
  const ef = C.ef_s || C.ef_t;
  return {
    FEVI: ef ? ef.text : null, DdVI: mm('lvidd'), DsVI: mm('lvids'), SIV: mm('ivsd'), PP: mm('pwd'), MASA: t('lvmi'), VTDI: t('edvi'),
    AI: t('lavi'), EE: t('ee'), EA: t('ea'), TAPSE: mm('tapse'), SVD: v('rvs') !== null ? `${dec(v('rvs'), 1)} cm/s` : null, VDB: mm('rvd1'), CAF: t('fac'),
    PSAP: t('psap'), PAD: t('rap_est') || (isNum(st.rap) ? `${st.rap} mmHg` : null), VIT: v('trv') !== null ? `${dec(v('trv') / 100, 1)} m/s` : null,
    TAPSEPSAP: t('tapsepsap'), TAP: v('pat') !== null ? `${dec(v('pat') * 1000, 0)} ms` : null, EIS: t('ei_s'), EID: t('ei_d'),
    VCI: mm('ivc_max'), VCICOL: t('ivc_ci'), VMAXAO: v('avvmax') !== null ? `${dec(v('avvmax') / 100, 1)} m/s` : null, GMAO: t('avmg'), AVA: t('ava'), DVI: t('dvi'),
    AVM: t('mva'), GMM: t('msmg'), ORE: t('ero'), VR: t('mr_rvol')
  };
}
function fillTemplate(text, st, pt) {
  const V = templateValues(st, pt);
  return text.replace(/\{([A-Za-z]+)\}/g, (m, k) => (k in V ? (V[k] || '___') : m));
}

function reportText(model) {
  const L = [model.title.toUpperCase(), ''];
  for (const [k, v] of model.head) L.push(`${k}: ${v}`);
  for (const s of model.sections) {
    L.push('', s.title.toUpperCase());
    for (const r of s.rows) L.push(`${r.label}: ${r.text}${r.flag ? ` (${r.flag})` : ''}${r.ref ? `   [ref. ${r.ref}]` : ''}${r.note ? `\n   ${r.note}` : ''}`);
  }
  if (model.conclusion) L.push('', (typeof I18N !== 'undefined' && I18N.lang === 'en') ? 'CONCLUSION' : 'CONCLUSIÓN', model.conclusion);
  if (model.doctor) L.push('', model.doctor);
  L.push('', (typeof tr === 'function' ? tr : x => x)('Documento generado con Cardón con fines educativos. No es un informe médico ni reemplaza la valoración del especialista.'));
  return L.join('\n');
}