/* ======================= Menú contextual ======================= */
const ctxEl = $('ctxmenu');
let ctxReturn = null, ctxVp = null, ctxHit = null;
function openCtx(vp, x, y) {
  const c = vp.clip;
  if (!c) return;
  if (state.arm) disarm();
  ctxVp = vp; ctxHit = c.foreign ? null : hitAnno(vp, x, y);
  if (ctxHit) { state.sel = { clip: c, anno: ctxHit }; drawAll(); }
  const can = freeAvailability(vp, x, y), kind = clipKind(c), tools = KIND_TOOLS[kind];
  $('cmZone').textContent = kind === 'eco' ? can.zone : KIND_NAME[kind];
  ctxEl.querySelector('.cm-head span').textContent = kind === 'angio' ? 'Medidas de angiografía' : 'Medidas libres';
  ctxEl.querySelector('[data-cm="cath"]').hidden = kind !== 'angio';
  ctxEl.querySelector('[data-cm="arrow"]').disabled = ctxEl.querySelector('[data-cm="note"]').disabled = !!c.foreign || !vp.tf;
  { const mb = ctxEl.querySelector('[data-cm="mmode"]'); mb.hidden = kind !== 'eco'; mb.disabled = !(c.items.length > 2 && !c.mm && can.area.ok); mb.title = mb.disabled ? (c.mm ? 'Ya es un modo M' : c.items.length <= 2 ? 'Necesita un clip con varios cuadros' : 'Solo sobre la imagen 2D calibrada') : 'Traza una línea sobre el 2D para obtener su modo M'; }
  ctxEl.querySelectorAll('[data-free]').forEach(b => {
    b.hidden = !tools.includes(b.dataset.free);
    const r = can[b.dataset.free];
    b.disabled = !r.ok;
    b.title = r.ok ? '' : r.why;
  });
  const multi = c.items.length > 1, mk = c.manual || { ed: [], es: [] };
  ctxEl.querySelector('[data-cm="ed"]').disabled = !multi;
  ctxEl.querySelector('[data-cm="es"]').disabled = !multi;
  ctxEl.querySelector('[data-cm="unmark"]').disabled = !(mk.ed.includes(vp.frame) || mk.es.includes(vp.frame));
  { const ro = !!c.foreign, sv = selVisible();
    ctxEl.querySelector('[data-cm="delsel"]').disabled = ro || !(ctxHit || sv);
    ctxEl.querySelector('[data-cm="delframe"]').disabled = ro || !c.annos.some(a => a.frame === vp.frame);
    ctxEl.querySelector('[data-cm="delall"]').disabled = ro || !c.annos.length;
    ctxEl.querySelector('[data-cm="undo"]').disabled = !undoReady(); }
  ctxEl.hidden = false;
  const r = ctxEl.getBoundingClientRect();
  ctxEl.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  ctxEl.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  ctxReturn = vp.el;
  const first = ctxEl.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
}
/* Qué medidas libres admite el punto donde se hizo clic */
function freeAvailability(vp, x, y) {
  const ctx = measureCtx(vp), p = vp.tf ? toImage(vp, x, y) : { x: -1, y: -1 };
  const regs = ctx.regions || [], hit = regionAt(regs, p), anyCal = regs.length || (ctx.cal && ctx.cal.cm) || ctx.pixelCm;
  const tryIt = fn => { try { return fn() !== false; } catch (e) { return false; } };
  const fmt = hit ? hit.r.fmt : 0;
  const zone = fmt === 1 ? '2D' : fmt === 2 ? 'Modo M' : fmt === 3 ? 'Doppler' : fmt === 4 ? 'Trazo' : (regs.length ? 'Fuera de zona' : ((ctx.cal && ctx.cal.cm) || ctx.dop ? 'Calibración manual' : ctx.pixelCm ? 'Calibrada' : 'Sin calibrar'));
  const noCal = !anyCal && !ctx.dop ? 'Calibra la imagen primero' : '';
  const sp = tryIt(() => spatialScale(ctx, p)), sp2d = tryIt(() => spatialScale(ctx, p).kind === '2d');
  const dop = tryIt(() => dopplerScale(ctx, p, false)), dopT = tryIt(() => dopplerScale(ctx, p, true));
  const time = !!(hit && (fmt === 2 || fmt === 3) && hit.r.ux === UNIT_S);
  const why = (ok, msg) => ({ ok, why: ok ? '' : (noCal && !regs.length ? noCal : msg) });
  return {
    zone,
    dist: why(sp, clipKind(vp.clip) === 'angio' ? 'Calibra primero con el catéter' : 'Solo en imagen 2D o modo M'),
    area: why(sp2d, 'Solo en imagen 2D'),
    time: why(time, 'Solo en Doppler o modo M'),
    vel: why(dop, 'Solo en Doppler'),
    vti: why(dopT, 'Solo en Doppler'),
    slope: why(dopT, 'Solo en Doppler'),
    sten: { ok: !(fmt === 2 || fmt === 3 || fmt === 4), why: 'Solo en imagen 2D o angiografía' },
    qca: { ok: !regs.length && !!(vp.clip && vp.clip.ready[vp.frame]), why: 'Solo en angiografía' },
    roi: { ok: !!(vp.clip && vp.clip.ready[vp.frame] && vp.clip.ready[vp.frame].kind === 'gray'), why: 'Solo en imágenes en escala de grises (TC o RM)' },
    _angio: true
  };
}
function closeCtx() { if (!ctxEl.hidden) { ctxEl.hidden = true; } }
ctxEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  closeCtx();
  if (ctxReturn) ctxReturn.focus({ preventScroll: true });
  const c = state.cur; if (!c) return;
  if (b.dataset.free) { armFree(b.dataset.free); return; }
  if (b.dataset.cm === 'ed' || b.dataset.cm === 'es') { markFrame(b.dataset.cm); return; }
  if (b.dataset.cm === 'unmark') { unmarkFrame(); return; }
  if (b.dataset.cm === 'info') { openDlg('fileinfo'); return; }
  if (b.dataset.cm === 'mmode') { armSpecial('mline'); return; }
  if (b.dataset.cm === 'arrow' || b.dataset.cm === 'note') { armSpecial(b.dataset.cm); return; }
  if (b.dataset.cm === 'cath') { armSpecial('cal'); return; }
  if (b.dataset.cm === 'reset') resetView();
  else if (b.dataset.cm === 'undo') undo();
  else if (b.dataset.cm === 'delsel') { const vc = (ctxVp && ctxVp.clip) || c; if (ctxHit) delAnnos(vc, [ctxHit], 'Medida borrada.'); else deleteSelected(); }
  else if (b.dataset.cm === 'delframe') { const vp = ctxVp || AV(), vc = vp.clip || c; delAnnos(vc, vc.annos.filter(a => a.frame === vp.frame), 'Medidas del cuadro borradas.'); }
  else if (b.dataset.cm === 'delall') { const vc = (ctxVp && ctxVp.clip) || c; delAnnos(vc, vc.annos.slice(), 'Medidas de la secuencia borradas.'); }
});
ctxEl.addEventListener('contextmenu', e => e.preventDefault());
ctxEl.addEventListener('keydown', e => {
  const items = [...ctxEl.querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCtx(); if (ctxReturn) ctxReturn.focus({ preventScroll: true }); }
  else if (e.key === 'Tab') { closeCtx(); }
});
document.addEventListener('pointerdown', e => { if (!ctxEl.hidden && !ctxEl.contains(e.target)) closeCtx(); }, true);
window.addEventListener('blur', closeCtx);
window.addEventListener('resize', closeCtx);
