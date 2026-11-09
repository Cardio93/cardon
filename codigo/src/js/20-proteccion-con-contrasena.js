/* ======================= Protección con contraseña ======================= */
async function loadVault() { Vault.meta = Store.ok ? await Store.getMeta('vault') : null; }
async function unlockVault(pass) {
  try {
    const k = await deriveKey(pass, Vault.meta.salt, Vault.meta.iter);
    const chk = TD.decode(await aesDec(k, Vault.meta.iv, Vault.meta.ct));
    if (chk !== 'cardon-ok') return false;
    Vault.key = k;
  } catch (e) { return false; }
  state.patients = await Store.all('patients');
  state.studies = await Store.all('studies');
  els.keep.disabled = !Store.ok;
  renderHome(); renderVault();
  return true;
}
async function lockNow() {
  if (!Vault.meta) return;
  /* guarda lo pendiente (cifrado) antes de quitar la clave */
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; try { if (state.study && state.study.id) await Store.put('studies', state.study); } catch (e) {} }
  Vault.key = null;
  clearViewer(); state.study = blankStudy();
  state.patients = []; state.studies = [];
  activateStudy(state.study);
  closeDlg('settings');
  showView('home');
  setHomeStatus('Cardón quedó bloqueado.');
}
async function reencryptAll(oldKey, newKey, say) {
  for (const p of state.patients) await Store.put('patients', p, newKey);
  for (const s of state.studies) await Store.put('studies', s, newKey);
  const keys = await Store.fileKeys();
  for (let i = 0; i < keys.length; i++) {
    if (i % 3 === 0) { say(`Procesando imágenes ${i + 1} de ${keys.length}…`); await tick(); }
    const rec = await Store.getFile(keys[i]);
    const bytes = await Store.readFile(rec, oldKey);
    await Store.putFile({ id: rec.id, studyId: rec.studyId, name: rec.name, size: rec.size, bytes }, newKey);
  }
}
async function enableVault(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iter = 250000;
  const key = await deriveKey(pass, salt, iter);
  const { iv, ct } = await aesEnc(key, TE.encode('cardon-ok'));
  const say = t => { $('vaultMsg').textContent = t; };
  Vault.meta = { salt, iter, iv, ct };
  await Store.setMeta('vault', Vault.meta);
  say('Cifrando la base de datos…');
  await reencryptAll(null, key, say);
  Vault.key = key;
}
async function disableVault() {
  const say = t => { $('vaultMsg').textContent = t; };
  say('Descifrando la base de datos…');
  await reencryptAll(Vault.key, null, say);
  await Store.delMeta('vault');
  Vault.meta = null; Vault.key = null;
}
function renderVault() {
  const box = $('vaultBox'); if (!box) return;
  if (!Store.ok) { box.innerHTML = '<p class="note">No disponible: esta vista no permite guardar datos.</p>'; return; }
  if (!Vault.meta) {
    box.innerHTML = `<p class="note">Cifra los pacientes, las medidas y las imágenes guardadas en este computador. Cardón pedirá la contraseña cada vez que se abra. <b>Si la olvidas, no hay forma de recuperar los datos.</b></p>
      <form class="grid2" id="vaultOn"><label class="fld">Contraseña nueva<input type="password" id="vp1" autocomplete="new-password" minlength="6" required></label><label class="fld">Repite la contraseña<input type="password" id="vp2" autocomplete="new-password" minlength="6" required></label><div class="row fld full"><button class="btn primary small" type="submit">Activar protección</button></div></form><p class="note" id="vaultMsg"></p>`;
    $('vaultOn').addEventListener('submit', async e => {
      e.preventDefault();
      const a = $('vp1').value, b = $('vp2').value;
      if (a !== b) { $('vaultMsg').textContent = 'Las contraseñas no coinciden.'; return; }
      if (a.length < 6) { $('vaultMsg').textContent = 'Usa al menos 6 caracteres.'; return; }
      try { await enableVault(a); renderVault(); $('vaultMsg').textContent = 'Protección activada. Los datos quedaron cifrados.'; } catch (err) { $('vaultMsg').textContent = 'No se pudo activar la protección.'; }
    });
    return;
  }
  box.innerHTML = `<p class="calstate ok">Protección activa: los datos están cifrados en este computador.</p>
    <div class="row"><button class="btn small" id="vLock" type="button">Bloquear ahora</button><button class="btn small" id="vChange" type="button">Cambiar contraseña</button><button class="btn danger small" id="vOff" type="button">Quitar protección</button></div>
    <form class="grid2" id="vaultChg" hidden><label class="fld">Contraseña nueva<input type="password" id="vc1" autocomplete="new-password" minlength="6"></label><label class="fld">Repite la contraseña<input type="password" id="vc2" autocomplete="new-password" minlength="6"></label><div class="row fld full"><button class="btn primary small" type="submit">Guardar contraseña</button></div></form>
    <label class="fld" style="max-width:300px">Bloqueo automático sin uso<select id="vAuto">${[[0, 'Nunca'], [5, 'A los 5 minutos'], [10, 'A los 10 minutos'], [15, 'A los 15 minutos'], [30, 'A los 30 minutos'], [60, 'A la hora']].map(([v, t]) => `<option value="${v}"${(isNum(state.cfg.autoLock) ? state.cfg.autoLock : 15) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <p class="note" id="vaultMsg"></p>`;
  $('vAuto').addEventListener('change', e => { state.cfg.autoLock = +e.target.value; saveCfg(); });
  $('vLock').addEventListener('click', lockNow);
  $('vChange').addEventListener('click', () => { $('vaultChg').hidden = false; $('vc1').focus(); });
  $('vaultChg').addEventListener('submit', async e => {
    e.preventDefault();
    const a = $('vc1').value, b = $('vc2').value;
    if (a !== b || a.length < 6) { $('vaultMsg').textContent = a !== b ? 'Las contraseñas no coinciden.' : 'Usa al menos 6 caracteres.'; return; }
    try { await disableVault(); await enableVault(a); renderVault(); $('vaultMsg').textContent = 'Contraseña cambiada.'; } catch (err) { $('vaultMsg').textContent = 'No se pudo cambiar la contraseña.'; }
  });
  $('vOff').addEventListener('click', async () => {
    try { await disableVault(); renderVault(); $('vaultMsg').textContent = 'Protección quitada. Los datos ya no están cifrados.'; } catch (err) { $('vaultMsg').textContent = 'No se pudo quitar la protección.'; }
  });
}
