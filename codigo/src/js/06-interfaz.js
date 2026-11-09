/* ======================= Interfaz ======================= */
const APP_VERSION = '1.1';
const $ = id => document.getElementById(id);
const els = {
  home: $('home'), app: $('app'), viewerActions: $('viewerActions'), vgrid: $('vgrid'),
  list: $('list'), count: $('count'), status: $('status'), mhint: $('mhint'),
  play: $('play'), playIcon: $('playIcon'), prev: $('prev'), next: $('next'), prevSeq: $('prevSeq'), nextSeq: $('nextSeq'),
  scrub: $('scrub'), ticks: $('ticks'), frameLabel: $('frameLabel'), goED: $('goED'), goES: $('goES'),
  speed: $('speed'), bounce: $('bounce'), sync: $('sync'), invert: $('invert'), reset: $('reset'), info: $('info'), patient: $('patient'), ecgBtn: $('ecgBtn'),
  full: $('full'), stage: $('stage'), drop: $('drop'), maskClear: $('maskClear'), expMeas: $('expMeas'),
  pac: $('tab-pac'), med: $('tab-med'), rep: $('tab-rep'), ctxName: $('ctxName'), ctxSub: $('ctxSub'), saveState: $('saveState'),
  homeStatus: $('homeStatus'), progress: $('progress'), progressBar: $('progressBar'), storage: $('storage'),
  homeList: $('homeList'), homeCount: $('homeCount'), homeSearch: $('homeSearch'), keep: $('keepImgs'), dropzone: $('dropzone'), lockBox: $('lockBox')
};
const state = {
  view: 'home', clips: [], vps: [], act: 0, layout: 1, sync: false, playing: true, speed: 1, bounce: false, tool: 'wl',
  info: true, patient: false, ecgOn: true, dpr: 1, arm: null, tab: 'med', guide: null,
  patients: [], studies: [], study: null, search: '', confirmDel: null, pendingCal: null, busy: false, units: 'mm',
  cfg: { inst: '', line: '', doc: '', reg: '', foot: '', logo: '', sign: '', templates: [], phrases: null }, pendingBackup: null, compareIds: [],
  fit: 'fit', hdr: false
};
try { const f = localStorage.getItem('cardon.fit'); if (f === 'fit' || f === 'real' || f === 'fill') state.fit = f; state.hdr = localStorage.getItem('cardon.hdr') === '1'; } catch (e) {}
const AV = () => state.vps[state.act];
Object.defineProperty(state, 'cur', { get: () => AV() ? AV().clip : null, set: v => { if (AV()) AV().clip = v; } });
Object.defineProperty(state, 'frame', { get: () => AV() ? AV().frame : 0, set: v => { if (AV()) AV().frame = v; } });
let uid = 0;
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = p => p + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const dicomDateISO = d => /^\d{8}$/.test(d || '') ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
const fmtDate = d => /^\d{8}$/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : '';
const isoToShow = d => d ? d.split('-').reverse().join('/') : 'sin fecha';
const fmtNum = x => { const t = String(Math.round(x * 10) / 10); return I18N.lang === 'en' ? t : t.replace('.', ','); };
const fmtBytes = b => b >= 1e9 ? `${dec(b / 1e9, 1)} GB` : b >= 1e6 ? `${dec(b / 1e6, 0)} MB` : `${dec(b / 1e3, 0)} kB`;
const sexWord = s => s === 'H' ? 'Hombre' : s === 'M' ? 'Mujer' : '';
const tick = () => new Promise(r => setTimeout(r, 0));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let toastT = 0;
function setStatus(t) { els.status.textContent = t || ''; showToast(t); }
/* Aviso breve sobre la imagen: el mismo texto queda en la barra lateral */
function showToast(t) {
  const el = document.getElementById('toast'); if (!el) return;
  clearTimeout(toastT);
  if (!t || !el.parentNode.offsetParent) { el.classList.remove('on'); return; }
  el.textContent = t; el.classList.add('on');
  toastT = setTimeout(() => el.classList.remove('on'), Math.min(9000, 2800 + t.length * 35));
}
document.getElementById('toast').addEventListener('click', e => { clearTimeout(toastT); e.currentTarget.classList.remove('on'); });
function setHomeStatus(t) { els.homeStatus.textContent = t || ''; }
function setProgress(f) { if (f === null) { els.progress.hidden = true; return; } els.progress.hidden = false; els.progressBar.style.width = `${Math.round(f * 100)}%`; }
function normName(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
try { const u = localStorage.getItem('latido.units'); if (u === 'cm' || u === 'mm') state.units = u; } catch (e) {}

const ICON_PLAY = '<path d="M4 2l10 6-10 6z"/>';
const ICON_PAUSE = '<path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z"/>';
const ICON_PEN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10l.6-2.4L8.4 1.8l1.8 1.8L4.4 9.4zM7.3 2.9l1.8 1.8"/></svg>';
const ICON_RULER = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 11L11 1M1 11l2-.2M1 11l.2-2M11 1l-2 .2M11 1l-.2 2"/></svg>';
