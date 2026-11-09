/* ======================= Importación ======================= */
function asItem(file) { return { name: file.name, path: file.webkitRelativePath || file.name, size: file.size, file, read: () => file.arrayBuffer() }; }
/* ---- Lectura rápida de CD: se descartan los archivos del visor del disco (programas, páginas, ayudas) sin leerlos ---- */
const NON_DICOM = /\.(exe|dll|msi|cab|sys|ocx|drv|cpl|scr|com|jar|class|war|js|mjs|ts|css|html?|xhtml|xml|xsl|xslt|xsd|txt|ini|inf|cfg|conf|config|log|pdf|chm|hlp|ico|icns|cur|png|gif|bmp|svg|jpe?g|tiff?|webp|ttf|otf|woff2?|eot|fon|bat|cmd|sh|ps1|vbs|reg|lnk|url|json|mp4|avi|wmv|mov|mpe?g|mp3|wav|lic|manifest|plist|dylib|so|rtf|docx?|xlsx?|pptx?|odt|nfo|md|iso|dmg|pak|resx|resources|pdb|lib|tlb|nls|msm|mui|properties|policy|sig|cat|cer|crt|pem|key|py|pyc|swf|qm|ts)$/i;
const NON_DICOM_DIR = /(^|\/)(viewer|visor|program files|bin|lib|jre|java|runtime|help|ayuda|manual|docs?|plugins?|resources|locales?|fonts|images?_viewer|autorun|setup|install|redist|vcredist|dotnet|_?osirix[^/]*|weasis[^/]*|radiant[^/]*|microdicom[^/]*|efilm[^/]*|cdviewer[^/]*|\.?app)(\/|$)/i;
async function looksDicom(it) {
  if (!it.file) return true;
  if (/\.zip$/i.test(it.name)) return true;
  if (NON_DICOM.test(it.name) || /^dicomdir$/i.test(it.name) || it.size < 132) return false;
  if (it.path && NON_DICOM_DIR.test(it.path.split('/').slice(1, -1).join('/')) && !/\.dcm$/i.test(it.name)) return false;
  try { const h = new Uint8Array(await it.file.slice(128, 132).arrayBuffer()); if (h[0] === 68 && h[1] === 73 && h[2] === 67 && h[3] === 77) return true; } catch (e) { return true; }
  /* sin preámbulo «DICM»: solo se intenta si no tiene extensión o es .dcm */
  return (/\.dcm$/i.test(it.name) || !/\.[a-z0-9]{1,5}$/i.test(it.name)) && it.size < 64e6;
}
/* ---- Copia de los DICOM en una carpeta del computador (File System Access; Chrome o Edge con Cardon.html) ---- */
const DirStore = {
  h: null,
  supported() { return typeof window.showDirectoryPicker === 'function'; },
  async load() { if (!Store.ok) return null; try { this.h = await Store.getMeta('dicomDir'); } catch (e) { this.h = null; } return this.h; },
  async pick() { const h = await window.showDirectoryPicker({ id: 'cardon', mode: 'readwrite' }); this.h = h; await Store.setMeta('dicomDir', h); return h; },
  async clear() { this.h = null; try { await Store.setMeta('dicomDir', null); } catch (e) {} },
  async ensure(interactive) {
    const h = this.h; if (!h) return false;
    if (typeof h.queryPermission !== 'function') return true;
    try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p === 'granted') return true; if (!interactive) return false; p = await h.requestPermission({ mode: 'readwrite' }); return p === 'granted'; } catch (e) { return false; }
  }
};
const safeName = t => String(t || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sin nombre';
async function studyDir(st, pt, create) {
  const est = await DirStore.h.getDirectoryHandle('Estudios', { create });
  const name = st.dirName || safeName(`${pt ? pt.name : 'Paciente'} ${st.date || ''}`);
  return { d: await est.getDirectoryHandle(name, { create }), name };
}
async function writeDicom(dir, name, bytes) {
  try { const f0 = await (await dir.getFileHandle(name)).getFile(); if (f0.size === bytes.byteLength) return false; } catch (e) {}
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(bytes); await w.close(); return true;
}
async function readDirStudy(st, onProgress) {
  if (!DirStore.h || !st.dirName || !(await DirStore.ensure(true))) return [];
  let d; try { d = (await studyDir(st, null, false)).d; } catch (e) { return []; }
  const files = []; for await (const [name, h] of d.entries()) if (h.kind === 'file') files.push(h);
  const parsed = [];
  for (let k = 0; k < files.length; k++) {
    if (k % 8 === 0) { if (onProgress) onProgress(k / files.length); await tick(); }
    try { const f = await files[k].getFile(); const bytes = new Uint8Array(await f.arrayBuffer()); const ds = parseFileBytes(bytes); if (ds.elements.x7fe00010) parsed.push({ ds, m: getMeta(ds), name: f.name, bytes }); } catch (e) {}
  }
  return parsed;
}
let zipLib = null;
function loadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!zipLib) zipLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = libURL('jszip', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    s.onload = () => window.JSZip ? res(window.JSZip) : rej(new Error('zip'));
    s.onerror = () => { zipLib = null; rej(new Error('zip')); };
    document.head.append(s);
  });
  return zipLib;
}
let lastZipBackup = false;
async function expandZips(items) {
  const out = [];
  lastZipBackup = false;
  for (const it of items) {
    if (!/\.zip$/i.test(it.name)) { out.push(it); continue; }
    setHomeStatus(`Descomprimiendo ${it.name}…`);
    let Z;
    try { Z = await loadZip(); } catch (e) { setHomeStatus('No se pudo cargar el descompresor de .zip. Revisa tu conexión e inténtalo de nuevo.'); continue; }
    try {
      const zip = await Z.loadAsync(await it.read());
      if (zip.file('cardon-backup.json')) { lastZipBackup = true; await restoreBackupZip(zip); continue; }
      if (zip.file('cardon-caso.json')) { try { pendingCase = JSON.parse(await zip.file('cardon-caso.json').async('string')); } catch (e) { pendingCase = null; } }
      zip.forEach((path, entry) => {
        if (entry.dir || /(^|\/)(__MACOSX|\.DS_Store)/.test(path)) return;
        out.push({ name: path.split('/').pop(), size: (entry._data && entry._data.uncompressedSize) || 1000, read: () => entry.async('arraybuffer') });
      });
    } catch (e) { setHomeStatus(`No se pudo abrir ${it.name}. Puede estar dañado o protegido con contraseña.`); }
  }
  return out;
}
function groupKey(m) { return m.studyUID || `${m.patientId || m.patientName || 'anonimo'}|${m.date || ''}`; }
function findPatientFor(m) {
  const doc = (m.patientId || '').trim(), name = m.patientName || '';
  if (doc) { const p = state.patients.find(x => (x.doc || '').trim() === doc); if (p) return p; }
  if (name) { const p = state.patients.find(x => normName(x.name) === normName(name)); if (p) return p; }
  return null;
}
function locked() { return !!(Vault.meta && !Vault.key); }
async function importItems(items) {
  if (state.busy) return;
  if (locked()) { setHomeStatus('Desbloquea Cardón con tu contraseña antes de importar estudios.'); showView('home'); return; }
  state.busy = true;
  const dirOk = DirStore.h ? DirStore.ensure(true) : Promise.resolve(false);
  const inViewer = state.view === 'viewer';
  const say = t => { setHomeStatus(t); if (inViewer) setStatus(t); };
  let openLocal = null;
  try {
    const total = items.length;
    if (items.some(it => it.file)) {
      const keepIt = [];
      for (let k = 0; k < items.length; k++) {
        if (k % 40 === 0) { say(`Revisando ${k + 1} de ${total} archivos…`); await tick(); }
        if (await looksDicom(items[k])) keepIt.push(items[k]);
      }
      items = keepIt;
    }
    items = await expandZips(items.filter(f => f.size > 128 || /\.zip$/i.test(f.name)));
    /* Si el estudio ya está guardado completo en este computador, se abre la copia y no se vuelve a leer el disco */
    if (items.length > 3 && items.every(it => it.file)) {
      try {
        const ds0 = parseFileBytes(new Uint8Array(await items[0].read())), m0 = getMeta(ds0);
        const st0 = m0.studyUID && state.studies.find(x => x.studyUID === m0.studyUID && (x.hasImages || x.dirName));
        if (st0 && (st0.nImages || 0) >= items.length) { openLocal = st0; say('Este estudio ya está guardado en este computador: se abre la copia guardada, sin volver a leer el disco.'); return; }
      } catch (e) {}
    }
    if (!items.length) { say(lastZipBackup ? 'Copia de seguridad procesada. El detalle aparece en la sección Copia de seguridad.' : 'No se encontraron archivos para importar.'); if (lastZipBackup) showView('home'); return; }
    const parsed = []; let skipped = 0;
    setProgress(0);
    for (let k = 0; k < items.length; k++) {
      if (k % 6 === 0) { say(`Leyendo ${k + 1} de ${items.length} archivos…`); setProgress(k / items.length * 0.6); await tick(); }
      const it = items[k];
      try {
        const bytes = new Uint8Array(await it.read());
        const ds = parseFileBytes(bytes);
        if (!ds.elements.x7fe00010) { skipped++; continue; }
        parsed.push({ ds, m: getMeta(ds), name: it.name, bytes });
      } catch (e) { skipped++; }
    }
    if (!parsed.length) { say(`No se encontraron imágenes DICOM en ${items.length === 1 ? 'el archivo' : `los ${items.length} archivos`}. En un CD, elige la unidad completa del disco.`); return; }
    const groups = new Map();
    for (const p of parsed) { const k = groupKey(p.m); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    const keep = els.keep.checked && Store.ok;
    const toDir = await dirOk;
    let first = null, storedOk = true, done = 0, dirOkAll = true, dirN = 0;
    const touched = [];
    for (const list of groups.values()) {
      const m0 = list[0].m;
      let pt = findPatientFor(m0);
      if (!pt) {
        pt = { id: newId('p'), name: m0.patientName || `Sin nombre (${isoToShow(dicomDateISO(m0.date))})`, doc: m0.patientId || '', birth: dicomDateISO(m0.birth), sex: m0.sex === 'M' ? 'H' : m0.sex === 'F' ? 'M' : '', notes: '', created: new Date().toISOString() };
        state.patients.push(pt); await savePatient(pt);
      } else {
        let ch = false;
        if (!pt.birth && m0.birth) { pt.birth = dicomDateISO(m0.birth); ch = true; }
        if (!pt.sex && (m0.sex === 'M' || m0.sex === 'F')) { pt.sex = m0.sex === 'M' ? 'H' : 'M'; ch = true; }
        if (ch) await savePatient(pt);
      }
      const date = dicomDateISO(m0.date) || todayISO();
      let st = (m0.studyUID && state.studies.find(s => s.studyUID === m0.studyUID)) || state.studies.find(s => s.patientId === pt.id && s.date === date && !s.studyUID);
      if (!st) { st = blankStudy(); st.id = newId('s'); st.patientId = pt.id; st.date = date; state.studies.push(st); }
      st.studyUID = st.studyUID || m0.studyUID || '';
      st.desc = st.desc || m0.studyDesc || '';
      st.modalities = [...new Set([...(st.modalities || []), ...list.map(p => p.m.modality).filter(Boolean)])];
      if (!st.weight && m0.weight) st.weight = m0.weight;
      if (!st.height && m0.height) st.height = Math.round(m0.height * 100);
      if (keep) {
        for (const p of list) {
          const fid = `${st.id}|${p.m.sopUID || p.name + ':' + p.bytes.byteLength}`;
          done++;
          if (done % 5 === 0) { say(`Guardando imágenes ${done} de ${parsed.length}…`); setProgress(0.6 + done / parsed.length * 0.4); }
          try {
            if (await Store.hasFile(fid)) continue;
            await Store.putFile({ id: fid, studyId: st.id, name: p.name, size: p.bytes.byteLength, bytes: p.bytes });
            st.nImages = (st.nImages || 0) + 1; st.bytes = (st.bytes || 0) + p.bytes.byteLength; st.hasImages = true;
          } catch (e) { storedOk = false; break; }
        }
      }
      if (toDir) {
        try {
          const { d, name } = await studyDir(st, pt, true); st.dirName = name;
          let k2 = 0;
          for (const p of list) {
            if (++k2 % 5 === 0) { say(`Copiando a la carpeta ${k2} de ${list.length}…`); await tick(); }
            if (await writeDicom(d, safeName(p.m.sopUID || p.name).replace(/\.dcm$/i, '') + '.dcm', p.bytes)) dirN++;
          }
          if (!st.hasImages) { st.nImages = Math.max(st.nImages || 0, list.length); st.bytes = st.bytes || list.reduce((a, p) => a + p.bytes.byteLength, 0); }
        } catch (e) { dirOkAll = false; }
      }
      if (pendingCase && applyCase(st, pt)) await savePatient(pt);
      await saveStudyNow(st);
      touched.push({ st, pt, list });
      if (!first) first = touched[touched.length - 1];
    }
    setProgress(null);
    let msg = touched.length === 1
      ? `Importado: ${first.pt.name}, estudio del ${isoToShow(first.st.date)} (${parsed.length} ${parsed.length === 1 ? 'archivo' : 'archivos'}).`
      : `Se importaron ${touched.length} estudios. Se abrió el primero; los demás están en la lista de pacientes.`;
    if (skipped) msg += ` ${skipped} ${skipped === 1 ? 'archivo no era imagen DICOM' : 'archivos no eran imágenes DICOM'} y se ${skipped === 1 ? 'omitió' : 'omitieron'}.`;
    if (!storedOk) msg += ' No hubo espacio para guardar todas las imágenes en este computador; el estudio se abrió de todas formas.';
    else if (!els.keep.checked && !toDir) msg += ' Las imágenes no se guardaron; para verlas de nuevo tendrás que importarlas otra vez.';
    if (toDir) msg += dirOkAll ? ` Copia en la carpeta «${DirStore.h.name}» → Estudios${dirN ? ` (${dirN} ${dirN === 1 ? 'archivo nuevo' : 'archivos nuevos'})` : ''}.` : ` No se pudo copiar todo a la carpeta «${DirStore.h.name}».`;
    else if (DirStore.h) msg += ' No se copió a la carpeta de estudios porque no se dio permiso; se puede dar en Configuración.';
    setHomeStatus(msg);
    openParsed(first.list, first.st, msg);
    updateStorage();
  } finally { state.busy = false; setProgress(null); if (openLocal) openStudy(openLocal).then(() => setStatus('Este estudio ya estaba guardado en este computador: se abrió la copia guardada, sin volver a leer el disco.')); }
}
function openParsed(parsed, st, msg) {
  clearViewer();
  const clips = buildClips(parsed);
  clips.forEach(c => addClip(c));
  activateStudy(st);
  clips.forEach(restoreNotes);
  showView('viewer');
  state.vps.forEach((vp, k) => { vp.clip = clips[k] || clips[0] || null; vp.frame = 0; if (vp.clip) preload(vp.clip); });
  if (clips.length) { setActive(0); select(clips[0]); setPlaying(!clips[0].stack); }
  drawAll();
  setStatus(msg || '');
  try { applyHanging(clips); } catch (e) {}
  (async () => { for (const c of clips) if (!c.ready[0]) { try { await requestFrame(c, 0); } catch (e) {} } })();
}
async function readStudyFiles(st, onProgress) {
  const recs = await Store.filesOf(st.id), parsed = [];
  let bad = 0;
  for (let k = 0; k < recs.length; k++) {
    if (k % 8 === 0) { if (onProgress) onProgress(k / recs.length); await tick(); }
    try { const bytes = await Store.readFile(recs[k]); const ds = parseFileBytes(bytes); parsed.push({ ds, m: getMeta(ds), name: recs[k].name, bytes }); } catch (e) { bad++; }
  }
  return { recs, parsed, bad };
}
async function openStudy(st) {
  if (state.busy) return;
  st.lastOpened = new Date().toISOString(); if (Store.ok) Store.put('studies', st).catch(() => {});
  if (!st.hasImages && !st.dirName) { clearViewer(); activateStudy(st); showView('viewer'); drawAll(); setStatus('Este estudio no tiene imágenes guardadas. Usa «Agregar imágenes» si las tienes.'); return; }
  state.busy = true;
  try {
    setHomeStatus('Abriendo el estudio…'); setProgress(0);
    let { recs, parsed } = st.hasImages ? await readStudyFiles(st, setProgress) : { recs: [], parsed: [] };
    if (!parsed.length && st.dirName && DirStore.h) { setHomeStatus('Abriendo el estudio desde la carpeta…'); parsed = await readDirStudy(st, setProgress); }
    setProgress(null); setHomeStatus('');
    if (!parsed.length) { clearViewer(); activateStudy(st); showView('viewer'); drawAll(); setStatus(recs.length ? 'No se pudieron leer las imágenes guardadas de este estudio. Vuelve a importarlas si las tienes.' : 'Las imágenes de este estudio ya no están en este computador. Vuelve a importarlas si las tienes.'); return; }
    const nbad = recs.length - parsed.length;
    openParsed(parsed, st, nbad > 0 && st.hasImages ? `${nbad} ${nbad === 1 ? 'imagen guardada no se pudo leer' : 'imágenes guardadas no se pudieron leer'}; puede que estén dañadas. Si tienes el CD o los archivos, vuelve a importarlos.` : '');
  } finally { state.busy = false; setProgress(null); }
}
async function compareWith(st) {
  if (state.busy || state.compareIds.includes(st.id)) return;
  state.busy = true;
  try {
    setStatus(`Cargando el estudio del ${isoToShow(st.date)} para comparar…`);
    const { parsed } = await readStudyFiles(st);
    if (!parsed.length) { setStatus('No se pudieron leer las imágenes de ese estudio.'); return; }
    const sep = document.createElement('div'); sep.className = 'list-sep'; sep.textContent = `Estudio del ${isoToShow(st.date)}`; sep.dataset.sid = st.id;
    els.list.append(sep);
    const clips = buildClips(parsed);
    for (const c of clips) { c.foreign = { id: st.id, date: st.date }; addClip(c); }
    state.compareIds.push(st.id);
    if (state.layout === 1) setLayout(2);
    const target = state.vps[state.act === 0 ? 1 : 0];
    target.clip = clips[0]; target.frame = 0; preload(clips[0]);
    drawAll(); markList();
    setStatus(`Comparando con el estudio del ${isoToShow(st.date)}. Haz clic en una ventana y luego en una secuencia para cambiar lo que muestra.`);
    renderPac();
  } finally { state.busy = false; }
}
function removeCompare() {
  for (const c of state.clips.filter(c => c.foreign)) removeClip(c);
  els.list.querySelectorAll('.list-sep').forEach(e => e.remove());
  state.compareIds = [];
  const own = state.clips;
  state.vps.forEach((vp, k) => { if (!vp.clip) { vp.clip = own[k] || own[0] || null; vp.frame = 0; } });
  drawAll(); markList(); renderPac(); setStatus('Comparación cerrada.');
}
function openDemo() {
  clearViewer();
  const d = makeDemo();
  addClip(d);
  activateStudy(blankStudy());
  showView('viewer');
  state.vps.forEach(vp => { vp.clip = d; vp.frame = 0; });
  setActive(0); select(d); setPlaying(true);
  setStatus('Clip sintético para probar el visor y las mediciones. No es un paciente.');
}
async function filesFromDrop(dt) {
  const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) return [...dt.files];
  const out = [];
  async function walk(entry) {
    if (entry.isFile) { try { out.push(await new Promise((res, rej) => entry.file(res, rej))); } catch (e) {} }
    else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do { batch = await new Promise((res, rej) => reader.readEntries(res, rej)).catch(() => []); for (const e of batch) await walk(e); } while (batch.length);
    }
  }
  for (const e of entries) await walk(e);
  return out;
}
async function updateStorage() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const e = await navigator.storage.estimate();
    if (e && e.quota) els.storage.textContent = `Espacio usado en este computador: ${fmtBytes(e.usage || 0)} de ${fmtBytes(e.quota)} disponibles`;
  } catch (e) {}
}
