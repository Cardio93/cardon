/* ======================= Copias de seguridad ======================= */
async function getDownloads() { try { return window.claude && window.claude.use ? await Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 4000))]) : null; } catch (e) { return null; } }
async function saveFile(filename, data, statusEl) {
  const dl = await getDownloads();
  if (!dl) {
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (statusEl) statusEl.textContent = `Archivo descargado: ${filename}`;
      return true;
    } catch (e) { if (statusEl) statusEl.textContent = 'La descarga de archivos no está disponible en esta vista.'; return false; }
  }
  try { await dl.save({ filename, data }); if (statusEl) statusEl.textContent = `Archivo guardado: ${filename}`; return true; }
  catch (e) {
    const code = e && e.code;
    if (statusEl) statusEl.textContent = code === 'declined' ? 'Descarga cancelada.' : code === 'rate_limited' ? 'Ya hay una descarga pendiente de confirmar.' : code === 'rejected_extension' || code === 'extension_not_enabled' ? 'Este tipo de archivo no se puede descargar en esta vista.' : 'No se pudo descargar el archivo en esta vista.';
    return false;
  }
}
async function exportBackup() {
  const data = JSON.stringify({ app: 'cardon', version: 3, exported: new Date().toISOString(), patients: state.patients, studies: state.studies, settings: state.cfg }, null, 1);
  await saveFile(`cardon-datos-${todayISO()}.json`, data, $('bStatus'));
}
async function exportBackupZip() {
  const out = $('bStatus');
  if (locked()) { out.textContent = 'Desbloquea Cardón antes de hacer la copia.'; return; }
  let Z; try { Z = await loadZip(); } catch (e) { out.textContent = 'No se pudo cargar el compresor de .zip. Revisa tu conexión.'; return; }
  const zip = new Z();
  const keys = await Store.fileKeys(), index = [];
  const enc = !!Vault.key;
  for (let i = 0; i < keys.length; i++) {
    if (i % 4 === 0) { out.textContent = `Preparando la copia: imagen ${i + 1} de ${keys.length}…`; await tick(); }
    try {
      const rec = await Store.getFile(keys[i]);
      const bytes = await Store.readFile(rec);
      const path = `imagenes/${i + 1}.${enc ? 'bin' : 'dcm'}`;
      if (enc) { const { iv, ct } = await aesEnc(Vault.key, bytes); const u = new Uint8Array(12 + ct.byteLength); u.set(iv); u.set(new Uint8Array(ct), 12); zip.file(path, u); }
      else zip.file(path, bytes);
      index.push({ id: rec.id, studyId: rec.studyId, name: rec.name, size: rec.size, path });
    } catch (e) {}
  }
  const data = { patients: state.patients, studies: state.studies, settings: state.cfg, files: index };
  let manifest = { app: 'cardon', version: 3, exported: new Date().toISOString() };
  if (enc) { const { iv, ct } = await aesEnc(Vault.key, TE.encode(JSON.stringify(data))); manifest.encrypted = { salt: b64(Vault.meta.salt), iter: Vault.meta.iter, iv: b64(iv), ct: b64(ct) }; }
  else Object.assign(manifest, data);
  zip.file('cardon-backup.json', JSON.stringify(manifest));
  out.textContent = 'Comprimiendo la copia…';
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
  await saveFile(`cardon-copia-completa-${todayISO()}.zip`, blob, out);
  if (enc && /guardado/.test(out.textContent)) out.textContent += '. La copia está cifrada con tu contraseña.';
}
async function mergeData(data, fileLoader) {
  let np = 0, ns = 0, nf = 0, nbad = 0;
  for (const p of data.patients || []) { if (!p || !p.id) continue; const i = state.patients.findIndex(x => x.id === p.id); if (i >= 0) state.patients[i] = p; else { state.patients.push(p); np++; } await Store.put('patients', p).catch(() => {}); }
  for (const s of data.studies || []) {
    if (!s || !s.id || !s.values) continue;
    const i = state.studies.findIndex(x => x.id === s.id);
    if (!fileLoader) { if (i >= 0) { const prev = state.studies[i]; s.hasImages = prev.hasImages; s.nImages = prev.nImages; s.bytes = prev.bytes; } else { s.hasImages = false; s.nImages = 0; s.bytes = 0; } }
    if (i >= 0) state.studies[i] = s; else { state.studies.push(s); ns++; }
    await Store.put('studies', s).catch(e => saveError(e));
  }
  if (fileLoader) {
    const files = data.files || [];
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      if (k % 4 === 0) { $('bStatus').textContent = `Restaurando imágenes ${k + 1} de ${files.length}…`; await tick(); }
      try { if (await Store.hasFile(f.id)) continue; const bytes = await fileLoader(f); await Store.putFile({ id: f.id, studyId: f.studyId, name: f.name, size: f.size, bytes }); nf++; } catch (e) { nbad++; if (nbad === 1) saveError(e, 'algunas imágenes de la copia'); }
    }
  }
  if (data.settings && !state.cfg.inst && !state.cfg.doc) { Object.assign(state.cfg, data.settings); cleanCfg(); saveCfg(); }
  return { np, ns, nf, nbad };
}
async function restoreBackupZip(zip, pass) {
  const out = $('bStatus');
  if (locked()) { out.textContent = 'Desbloquea Cardón antes de restaurar una copia.'; return; }
  const man = JSON.parse(await zip.file('cardon-backup.json').async('string'));
  let data = man, key = null;
  if (man.encrypted) {
    if (!pass) { state.pendingBackup = zip; renderBackupPass(); out.textContent = 'Esta copia está cifrada. Escribe la contraseña con la que se creó.'; return; }
    try {
      key = await deriveKey(pass, unb64(man.encrypted.salt), man.encrypted.iter);
      data = JSON.parse(TD.decode(await aesDec(key, unb64(man.encrypted.iv), unb64(man.encrypted.ct))));
    } catch (e) { out.textContent = 'La contraseña no es correcta para esta copia.'; renderBackupPass(); return; }
  }
  state.pendingBackup = null; renderBackupPass();
  const loader = async f => {
    const u = new Uint8Array(await zip.file(f.path).async('arraybuffer'));
    return key ? new Uint8Array(await aesDec(key, u.subarray(0, 12), u.subarray(12))) : u;
  };
  const r = await mergeData(data, loader);
  renderHome(); updateStorage();
  out.textContent = `Copia restaurada: ${r.np} pacientes y ${r.ns} estudios nuevos, ${r.nf} imágenes. Los registros repetidos se actualizaron.` + (r.nbad ? ` ${r.nbad} ${r.nbad === 1 ? 'imagen no se pudo guardar' : 'imágenes no se pudieron guardar'} (revisa el espacio disponible).` : '');
  setHomeStatus('');
}
function renderBackupPass() {
  let box = $('bPass');
  if (!state.pendingBackup) { if (box) box.remove(); return; }
  if (box) return;
  box = document.createElement('form'); box.id = 'bPass'; box.className = 'card call';
  box.innerHTML = '<label class="fld">Contraseña de la copia<input type="password" id="bPassIn" autocomplete="off" required></label><div class="row"><button class="btn primary small" type="submit">Restaurar</button><button class="btn small" type="button" id="bPassNo">Cancelar</button></div>';
  $('bStatus').before(box);
  box.addEventListener('submit', e => { e.preventDefault(); const z = state.pendingBackup; restoreBackupZip(z, $('bPassIn').value); });
  $('bPassNo').addEventListener('click', () => { state.pendingBackup = null; renderBackupPass(); $('bStatus').textContent = ''; });
  $('bPassIn').focus();
}
async function importBackupFile(file) {
  const out = $('bStatus');
  if (/\.zip$/i.test(file.name)) {
    let Z; try { Z = await loadZip(); } catch (e) { out.textContent = 'No se pudo cargar el descompresor de .zip.'; return; }
    try { const zip = await Z.loadAsync(await file.arrayBuffer()); if (!zip.file('cardon-backup.json')) { out.textContent = 'Ese .zip no es una copia de Cardón. Para abrir un estudio comprimido usa «Archivo .zip».'; return; } await restoreBackupZip(zip); }
    catch (e) { out.textContent = 'No se pudo leer el archivo .zip.'; }
    return;
  }
  try {
    const j = JSON.parse(await file.text());
    if (!j || (j.app !== 'cardon' && j.app !== 'latido') || !Array.isArray(j.patients) || !Array.isArray(j.studies)) throw new Error('formato');
    if (locked()) { out.textContent = 'Desbloquea Cardón antes de importar.'; return; }
    const r = await mergeData(j, null);
    renderHome();
    out.textContent = `Copia importada: ${r.np} pacientes y ${r.ns} estudios nuevos; los repetidos se actualizaron. Este archivo no trae imágenes.`;
  } catch (e) { out.textContent = 'Ese archivo no es una copia de seguridad de Cardón.'; }
}
