/* ======================= Almacenamiento local (IndexedDB) ======================= */
const Store = {
  db: null, ok: false, status: 'opening', err: '',
  async open() {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw Object.assign(new Error('sin indexedDB'), { name: 'SecurityError' });
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('latido', 3);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('patients')) d.createObjectStore('patients', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('studies')) d.createObjectStore('studies', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' }).createIndex('study', 'studyId');
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
        };
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => { db.close(); this.ok = false; this.status = 'fail'; this.err = 'newer'; renderHome(); };
          res(db);
        };
        r.onerror = () => rej(r.error);
        r.onblocked = () => { this.status = 'blocked'; renderHome(); };
      });
      this.ok = true; this.status = 'ok';
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
    } catch (e) { this.ok = false; this.status = 'fail'; this.err = (e && e.name) || 'Error'; }
    return this.ok;
  },
  problem() {
    if (this.status === 'opening') return 'Cargando tus pacientes…';
    if (this.status === 'blocked') return 'Cardón está abierto en otra pestaña o ventana con una versión anterior. Ciérrala y tus pacientes aparecerán aquí.';
    if (this.err === 'newer') return 'Se abrió una versión más nueva de Cardón en otra pestaña. Recarga esta página.';
    if (this.err === 'QuotaExceededError') return 'El navegador no tiene espacio disponible para guardar datos. Libera espacio en el disco y recarga la página.';
    return 'Esta vista no permite guardar datos. Abre Cardón en una pestaña normal de Chrome, Edge o Firefox desde claude.ai; las ventanas privadas y algunas vistas integradas bloquean el almacenamiento. Mientras tanto puedes ver estudios y medir, pero no quedarán guardados.';
  },
  req(name, mode, fn) {
    if (!this.ok) return Promise.reject(new Error('sin almacenamiento'));
    return new Promise((res, rej) => {
      try {
        const t = this.db.transaction(name, mode);
        let out;
        const r = fn(t.objectStore(name));
        if (r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => res(out);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      } catch (e) { rej(e); }
    });
  },
  raw(name) { return this.req(name, 'readonly', s => s.getAll()).catch(() => []); },
  async wrap(name, obj, key) {
    const plain = JSON.parse(JSON.stringify(obj));
    if (!key) return plain;
    const { iv, ct } = await aesEnc(key, TE.encode(JSON.stringify(plain)));
    const rec = { id: plain.id, _enc: 1, iv, ct };
    if (name === 'studies') rec.patientId = plain.patientId;
    return rec;
  },
  async unwrap(rec, key) {
    if (!rec || !rec._enc) return rec;
    if (!key) return null;
    return JSON.parse(TD.decode(await aesDec(key, rec.iv, rec.ct)));
  },
  async all(name) {
    const recs = await this.raw(name), out = [];
    for (const r of recs) { try { const v = await this.unwrap(r, Vault.key); if (v) out.push(v); } catch (e) {} }
    return out;
  },
  /* sin clave explícita se usa la de la sesión; si hay protección y está bloqueado, no se escribe nada sin cifrar */
  async put(name, obj, key) { if (key === undefined) { key = Vault.key; if (!key && Vault.meta) throw new Error('Cardón está bloqueado: no se guarda sin cifrar.'); } const rec = await this.wrap(name, obj, key); return this.req(name, 'readwrite', s => s.put(rec)); },
  async putFile(f, key) {
    if (key === undefined) { key = Vault.key; if (!key && Vault.meta) throw new Error('Cardón está bloqueado: no se guarda sin cifrar.'); }
    let rec;
    if (key) { const { iv, ct } = await aesEnc(key, f.bytes); rec = { id: f.id, studyId: f.studyId, name: f.name, size: f.size, _enc: 1, iv, blob: ct }; }
    else rec = { id: f.id, studyId: f.studyId, name: f.name, size: f.size, blob: new Blob([f.bytes]) };
    return this.req('files', 'readwrite', s => s.put(rec));
  },
  async readFile(rec, key = Vault.key) {
    if (rec._enc) { if (!key) throw new Error('bloqueado'); return new Uint8Array(await aesDec(key, rec.iv, rec.blob)); }
    const d = rec.blob;
    return new Uint8Array(d && typeof d.arrayBuffer === 'function' ? await d.arrayBuffer() : d);
  },
  hasFile(id) { return this.req('files', 'readonly', s => s.count(id)).then(n => n > 0).catch(() => false); },
  filesOf(studyId) { return this.req('files', 'readonly', s => s.index('study').getAll(studyId)).catch(() => []); },
  fileKeys() { return this.req('files', 'readonly', s => s.getAllKeys()).catch(() => []); },
  getFile(id) { return this.req('files', 'readonly', s => s.get(id)); },
  del(name, id) { return this.req(name, 'readwrite', s => s.delete(id)).catch(() => {}); },
  delFilesOf(studyId) {
    return this.req('files', 'readwrite', s => {
      const c = s.index('study').openKeyCursor(IDBKeyRange.only(studyId));
      c.onsuccess = () => { const cur = c.result; if (cur) { s.delete(cur.primaryKey); cur.continue(); } };
      return null;
    }).catch(() => {});
  },
  getMeta(k) { return this.req('meta', 'readonly', s => s.get(k)).then(r => r ? r.v : null).catch(() => null); },
  setMeta(k, v) { return this.req('meta', 'readwrite', s => s.put({ k, v })); },
  delMeta(k) { return this.req('meta', 'readwrite', s => s.delete(k)).catch(() => {}); }
};
function blankStudy() { return { id: null, patientId: null, studyUID: '', date: todayISO(), desc: '', modalities: [], nImages: 0, bytes: 0, hasImages: false, weight: null, height: null, hr: null, sbp: null, dbp: null, rap: 'auto', values: {}, conclusion: '', updated: null }; }
state.study = blankStudy();
let saveTimer = null;
function setSave(text, cls) { els.saveState.textContent = text; els.saveState.className = 'save ' + (cls || ''); }
/* Errores de guardado: siempre visibles, con la causa probable, y con reintento */
let saveFailed = false, saveRetries = 0;
function saveErrorText(e, what) {
  const m = (e && (e.message || e.name)) || '';
  if (e && (e.name === 'QuotaExceededError' || /quota|space|espacio/i.test(m))) return 'No hay espacio para guardar en este computador. Borra estudios que ya no uses o haz una copia completa y libera espacio.';
  if (/bloqueado/.test(m)) return 'Cardón está bloqueado: desbloquéalo para guardar los cambios.';
  return `No se pudo guardar ${what || 'el estudio'} en este computador. Los cambios siguen en pantalla; Cardón lo intentará de nuevo.`;
}
function saveError(e, what) {
  saveFailed = true; setSave('No se pudo guardar', 'err');
  const t = saveErrorText(e, what); setStatus(t); setHomeStatus(t);
  try { console.warn('Cardón · error al guardar', e); } catch (_) {}
}
function saveOk() { saveFailed = false; saveRetries = 0; }
function scheduleSave() {
  const st = state.study;
  if (!st.id) { setSave(Object.keys(st.values).length ? 'Sin guardar' : '', 'warn'); return; }
  setSave('Guardando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    st.updated = new Date().toISOString();
    try { await Store.put('studies', st); setSave('Guardado', 'ok'); saveOk(); }
    catch (e) { saveError(e); if (saveRetries++ < 3 && !/bloqueado/.test((e && e.message) || '')) setTimeout(() => { if (state.study === st) scheduleSave(); }, 4000); }
  }, 350);
}
async function savePatient(p) { try { await Store.put('patients', p); saveOk(); } catch (e) { saveError(e, 'el paciente'); } }
async function saveStudyNow(st) { st.updated = new Date().toISOString(); try { await Store.put('studies', st); saveOk(); } catch (e) { saveError(e); } }
window.addEventListener('beforeunload', e => { if (saveTimer || saveFailed) { e.preventDefault(); e.returnValue = ''; } });
