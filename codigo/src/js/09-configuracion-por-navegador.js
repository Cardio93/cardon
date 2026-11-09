/* ======================= Configuración (por navegador) ======================= */
let cfgTimer = null;
/* El logo y la firma solo pueden ser imágenes incrustadas (no direcciones externas) */
function cleanCfg() { for (const k of ['logo', 'sign']) if (state.cfg[k] && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(state.cfg[k])) state.cfg[k] = ''; }
async function loadCfg() {
  let c = Store.ok ? await Store.getMeta('settings') : null;
  if (!c) { try { c = JSON.parse(localStorage.getItem('cardon.cfg') || 'null'); } catch (e) {} }
  if (c) Object.assign(state.cfg, c);
  cleanCfg();
  if (!state.cfg.doc) { try { state.cfg.doc = localStorage.getItem('latido.doctor') || ''; } catch (e) {} }
}
function saveCfg() {
  clearTimeout(cfgTimer);
  cfgTimer = setTimeout(async () => {
    try { if (Store.ok) await Store.setMeta('settings', state.cfg); else localStorage.setItem('cardon.cfg', JSON.stringify(state.cfg)); } catch (e) { const st = $('cfgStatus'); if (st) st.textContent = saveErrorText(e, 'la configuración'); }
  }, 300);
}
