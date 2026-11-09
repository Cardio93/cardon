/* ======================= Diálogos ======================= */
let dlgReturn = null;
function openDlg(id) {
  dlgReturn = document.activeElement;
  $(id).hidden = false;
  if (id === 'settings') renderSettings();
  if (id === 'fileinfo') renderFileInfo();
  const first = $(id).querySelector('[data-close]'); if (first) first.focus();
}
const TS_LABEL = Object.assign({
  '1.2.840.10008.1.2': 'Sin compresión (VR implícito)', '1.2.840.10008.1.2.1': 'Sin compresión', '1.2.840.10008.1.2.2': 'Sin compresión (big endian)',
  '1.2.840.10008.1.2.4.50': 'JPEG básico', '1.2.840.10008.1.2.4.51': 'JPEG extendido', '1.2.840.10008.1.2.5': 'RLE'
}, TS_NAME);
const SOP_LABEL = { '1.2.840.10008.5.1.4.1.1.3.1': 'Ultrasonido multicuadro', '1.2.840.10008.5.1.4.1.1.6.1': 'Ultrasonido', '1.2.840.10008.5.1.4.1.1.7': 'Captura secundaria', '1.2.840.10008.5.1.4.1.1.4': 'Resonancia magnética', '1.2.840.10008.5.1.4.1.1.4.1': 'Resonancia magnética mejorada' };
const RFMT = { 1: '2D', 2: 'modo M', 3: 'Doppler espectral', 4: 'trazo de onda' };
const RTYPE = { 1: 'tejido', 2: 'flujo color', 3: 'Doppler pulsado', 4: 'Doppler continuo', 5: 'traza media', 6: 'traza modal', 7: 'traza máxima', 8: 'traza de volumen', 10: 'ECG', 11: 'pulso', 12: 'fonocardiograma', 13: 'barra de grises', 14: 'barra de color' };
function fileInfoRows() {
  const c = state.cur, it = curItem();
  if (!c || !it || !it.ds) return [['Secuencia', c && c.demo ? 'Clip de ejemplo sintético' : 'No hay un archivo DICOM abierto']];
  const m = it.m, ds = it.ds, rows = [];
  rows.push(['Fabricante', m.manufacturer || '—'], ['Modelo', m.model || '—'], ['Software', m.software || '—'], ['Modalidad', m.modality || '—']);
  rows.push(['Tipo de objeto', SOP_LABEL[m.sopClass] || m.sopClass || '—'], ['Compresión', `${TS_LABEL[m.ts] || 'desconocida'} (${m.ts})`]);
  rows.push(['Imagen', `${m.cols} × ${m.rows} px · ${m.photometric} · ${m.bitsAllocated} bit`], ['Cuadros', c.items.length > 1 ? `${c.items.length} · ${fmtNum(c.fps)} fps${m.frameTime ? ` · ${fmtNum(m.frameTime)} ms por cuadro` : ''}` : '1']);
  rows.push(['Zonas calibradas', (m.regions || []).length ? m.regions.map(r => `${RFMT[r.fmt] || 'formato ' + r.fmt}${RTYPE[r.type] ? ' (' + RTYPE[r.type] + ')' : ''}`).join(' · ') : 'ninguna']);
  const src = ecgSource(c);
  const ecgTxt = src === 'signal' ? (m.ecg ? `Señal DICOM (Waveform) · ${fmtNum(m.ecg.fs)} Hz · ${m.ecg.s.length} muestras` : `Curva DICOM · ${m.curve.s.length} puntos`)
    : src === 'rwave' ? `Solo marcas de onda R en los cuadros ${m.rwave.map(i => i + 1).join(', ')}`
    : src === 'image' ? `Dibujado en la imagen; leído automáticamente (inicio del QRS en los cuadros ${c.auto.ed.map(i => i + 1).join(', ')})`
    : src === 'burned' ? 'Dibujado dentro de la imagen; no se puede leer como señal'
    : 'No incluido en el archivo';
  rows.push(['ECG', ecgTxt, src === 'burned' || src === 'none']);
  if (src === 'none' && c.burnTried) rows.push(['Lectura del ECG en la imagen', 'Se buscó un trazo verde dibujado y no se encontró', true]);
  const cy = c.cyc;
  rows.push(['Telediástole y telesístole', cy ? `${cy.ed.length} y ${cy.es.length} marcas${cy.manual ? ' (incluye marcas manuales)' : ''}` : 'sin marcas', !cy]);
  const groups = {}, creators = [];
  for (const k of Object.keys(ds.elements)) {
    const g = parseInt(k.slice(1, 5), 16), e = parseInt(k.slice(5, 9), 16);
    if (g % 2 === 1 && g > 8) {
      groups[g] = (groups[g] || 0) + 1;
      if (e >= 0x10 && e <= 0xff) { try { const v = (ds.string(k) || '').trim(); if (v && v.length < 80) creators.push(`${g.toString(16).toUpperCase().padStart(4, '0')}: ${v}`); } catch (er) {} }
    }
  }
  const gk = Object.keys(groups);
  rows.push(['Etiquetas privadas', gk.length ? gk.map(g => `${(+g).toString(16).toUpperCase().padStart(4, '0')} (${groups[g]})`).join(' · ') : 'ninguna']);
  if (creators.length) rows.push(['Creadores privados', creators.slice(0, 12).join(' · ')]);
  rows.push(['Versión de Cardón', APP_VERSION]);
  return rows;
}
function renderFileInfo() {
  const rows = fileInfoRows();
  $('fiBody').innerHTML = rows.map(([k, v, w]) => `<dt>${esc(k)}</dt><dd class="${w ? 'warn' : ''}">${esc(v)}</dd>`).join('');
  $('fiStatus').textContent = '';
}
$('fiCopy').addEventListener('click', () => {
  const t = fileInfoRows().map(([k, v]) => `${k}: ${v}`).join('\n');
  navigator.clipboard.writeText(t).then(() => { $('fiStatus').textContent = 'Informe copiado.'; }, () => { $('fiStatus').textContent = 'Selecciona el texto y cópialo con Ctrl+C.'; });
});
function closeDlg(id) { $(id).hidden = true; if (dlgReturn && dlgReturn.focus) dlgReturn.focus(); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDlg(b.dataset.close)));
for (const id of ['about', 'settings', 'fileinfo']) $(id).addEventListener('click', e => { if (e.target === $(id)) closeDlg(id); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  for (const id of ['about', 'settings', 'fileinfo', 'caseDlg']) if (!$(id).hidden) { e.stopPropagation(); closeDlg(id); }
}, true);
$('aboutBtn').addEventListener('click', () => openDlg('about'));
$('settingsBtn').addEventListener('click', () => openDlg('settings'));
$('appVersion').textContent = APP_VERSION;
$('copyMail').addEventListener('click', () => {
  const t = $('aboutMail').textContent;
  navigator.clipboard.writeText(t).then(() => { $('mailStatus').textContent = 'Correo copiado.'; }, () => {
    const r = document.createRange(); r.selectNodeContents($('aboutMail')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    $('mailStatus').textContent = 'Selecciona y copia el correo con Ctrl+C.';
  });
});
function renderSettings() {
  const cf = state.cfg;
  for (const [id, k] of [['cfgInst', 'inst'], ['cfgLine', 'line'], ['cfgDoc', 'doc'], ['cfgReg', 'reg'], ['cfgFoot', 'foot']]) $(id).value = cf[k] || '';
  $('logoPrev').innerHTML = cf.logo ? `<img src="${esc(cf.logo)}" alt="Logo">` : 'Sin logo';
  $('signPrev').innerHTML = cf.sign ? `<img src="${esc(cf.sign)}" alt="Firma">` : 'Sin firma';
  $('logoDel').disabled = !cf.logo; $('signDel').disabled = !cf.sign;
  renderVault();
}
$('cfgLang').value = I18N.lang;
/* Bloqueo automático: con la protección activa, Cardón se bloquea tras un tiempo sin uso */
let lastActive = Date.now();
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true });
setInterval(() => {
  const min = isNum(state.cfg.autoLock) ? state.cfg.autoLock : 15;
  if (!min || !Vault.meta || !Vault.key || state.busy) return;
  if (Date.now() - lastActive > min * 60000) { lockNow(); setHomeStatus(`Cardón se bloqueó tras ${min} minutos sin uso. Escribe la contraseña para continuar.`); }
}, 20000);
/* Aviso de uso educativo: se muestra la primera vez en cada navegador */
(function eduNotice() {
  let ok = false; try { ok = localStorage.getItem('cardon.edu') === '1'; } catch (e) {}
  if (ok || navigator.webdriver) return;
  const dlg = $('eduNotice'), chk = $('eduOk'), go = $('eduGo');
  dlg.hidden = false;
  chk.addEventListener('change', () => { go.disabled = !chk.checked; });
  go.addEventListener('click', () => { try { localStorage.setItem('cardon.edu', '1'); } catch (e) {} dlg.hidden = true; });
})();
async function renderDirUI() {
  const st = $('dirStatus'), hd = $('homeDir'), pick = $('dirPick'), clr = $('dirClear');
  if (!DirStore.supported()) {
    if (st) st.textContent = 'Disponible al usar Cardón desde el archivo Cardon.html en Chrome o Edge.'; if (pick) pick.disabled = true; if (clr) clr.hidden = true;
    if (hd) hd.textContent = ''; return;
  }
  const h = DirStore.h, ok = h ? await DirStore.ensure(false) : false;
  if (st) st.textContent = h ? `Carpeta elegida: «${h.name}». ${ok ? 'Con permiso de escritura.' : 'Chrome o Edge pedirán permiso la próxima vez que importes o abras un estudio.'}` : 'Aún no hay carpeta elegida.';
  if (pick) { pick.disabled = false; pick.textContent = h ? 'Cambiar carpeta…' : 'Elegir carpeta…'; }
  if (clr) clr.hidden = !h;
  if (hd) hd.innerHTML = h ? `También se graba una copia de los DICOM en la carpeta «${esc(h.name)}» → Estudios.` : '<button class="link" type="button" id="homeDirSet">Grabar también los DICOM en una carpeta de este computador</button> (recomendado al importar desde un CD).';
  const hs = $('homeDirSet'); if (hs) hs.addEventListener('click', () => openDlg('settings'));
}
$('dirPick').addEventListener('click', async () => {
  try { await DirStore.pick(); renderDirUI(); $('dirStatus').textContent += ' Las próximas importaciones se copiarán aquí.'; }
  catch (e) { if (e && e.name !== 'AbortError') $('dirStatus').textContent = 'No se pudo usar esa carpeta. Si estás en la versión de Claude, abre Cardon.html en Chrome o Edge.'; }
});
$('dirClear').addEventListener('click', async () => { await DirStore.clear(); renderDirUI(); });
renderDirUI();
$('cfgHang').checked = state.cfg.hang !== false;
function applyUiScale() { const v = +state.cfg.ui || 1; document.documentElement.style.setProperty('--ui', String(v)); requestAnimationFrame(() => state.vps.forEach(resizeVP)); }
$('cfgUi').value = String(+state.cfg.ui || 1); applyUiScale();
$('cfgUi').addEventListener('change', e => { state.cfg.ui = +e.target.value; saveCfg(); applyUiScale(); });
$('cfgHang').addEventListener('change', e => { state.cfg.hang = e.target.checked; saveCfg(); });
$('cfgLang').addEventListener('change', e => { try { localStorage.setItem('cardon.lang', e.target.value); } catch (_) {} location.reload(); });
for (const [id, k] of [['cfgInst', 'inst'], ['cfgLine', 'line'], ['cfgDoc', 'doc'], ['cfgReg', 'reg'], ['cfgFoot', 'foot']]) {
  $(id).addEventListener('input', e => { state.cfg[k] = e.target.value; saveCfg(); renderReport(); $('cfgStatus').textContent = 'Cambios guardados en este navegador.'; });
}
function shrinkImage(file, maxW, maxH) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const s = Math.min(1, maxW / im.naturalWidth, maxH / im.naturalHeight);
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/png'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    im.src = url;
  });
}
$('logoBtn').addEventListener('click', () => $('logoIn').click());
$('signBtn').addEventListener('click', () => $('signIn').click());
$('logoIn').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { state.cfg.logo = await shrinkImage(f, 600, 300); saveCfg(); renderSettings(); renderReport(); } catch (err) { $('cfgStatus').textContent = 'No se pudo leer esa imagen. Usa PNG o JPG.'; } });
$('signIn').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { state.cfg.sign = await shrinkImage(f, 600, 260); saveCfg(); renderSettings(); renderReport(); } catch (err) { $('cfgStatus').textContent = 'No se pudo leer esa imagen. Usa PNG o JPG.'; } });
$('logoDel').addEventListener('click', () => { state.cfg.logo = ''; saveCfg(); renderSettings(); renderReport(); });
$('signDel').addEventListener('click', () => { state.cfg.sign = ''; saveCfg(); renderSettings(); renderReport(); });
$('runTests').addEventListener('click', () => {
  let T;
  try { T = runTests(); } catch (e) { $('testOut').innerHTML = `<p class="calstate warn">No se pudo ejecutar la verificación: ${esc(e.message)}</p>`; return; }
  const ok = T.filter(t => t.ok).length;
  $('testOut').innerHTML = `<p class="calstate ${ok === T.length ? 'ok' : 'warn'}">${ok} de ${T.length} pruebas correctas.</p><ul class="tests">${T.map(t => `<li class="${t.ok ? 'ok' : 'bad'}"><span>${t.ok ? '✓' : '✗'}</span>${esc(t.name)}${t.ok ? '' : ` — obtenido ${isNum(t.got) ? dec(t.got, 4) : esc(t.err || 'error')}, esperado ${dec(t.exp, 4)}`}</li>`).join('')}</ul>`;
});
