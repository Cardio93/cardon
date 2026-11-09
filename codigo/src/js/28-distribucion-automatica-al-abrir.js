/* ======================= Vista inicial al abrir =======================
   Siempre una sola ventana (1×1). Según el tipo de estudio se muestra primero la serie principal:
   RM, el eje corto medio; TC, la serie fina (el MPR se activa después con «Ver en 3 planos»).
   La elección de la serie se puede desactivar en Configuración → Visor. */
function applyHanging(clips) {
  const own = clips.filter(c => !c.foreign); if (!own.length) return;
  let first = own[0], tip = '';
  if (state.cfg.hang !== false) {
    const re = (c, rx) => rx.test(`${c.items[0].m.seriesDesc || ''} ${c.label || ''}`);
    if (own.every(c => clipKind(c) === 'rm')) {
      const sax = saxClips(), mid = sax.length ? sax[Math.floor(sax.length / 2)] : null;
      const isFlow = c => re(c, /flow|flujo|\bpc\b|fase|phase|vel|venc/i), cine = own.filter(c => !c.slices && c.items.length > 3 && !isFlow(c));
      first = mid || cine.find(c => re(c, /4ch|4c\b|cuatro|2ch|3ch|lax|largo|long/i)) || cine[0] || first;
      state.mrTab = 'vol';
    } else if (own.every(c => clipKind(c) === 'tc')) {
      const thk = c => c.items[0].m.thick || clipZStep(c) || 0;
      const cac = own.find(c => c.stack && thk(c) >= 2.5 && thk(c) <= 3.5);
      const thin = own.filter(c => c.stack && c.items.length >= 40 && thk(c) > 0 && thk(c) <= 1.5).sort((a, b) => b.items.length - a.items.length)[0];
      state.ctTab = cac ? 'cac' : 'cta';
      first = thin || cac || first;
      if (thin && mprCapable(thin)) tip = 'Para verla en 3 planos, usa «Ver en 3 planos (MPR)» en la pestaña Medidas.';
    }
  }
  setLayout(1);
  const vp = state.vps[0]; vp.clip = first; vp.frame = 0;
  setActive(0); select(first, 0); preload(first); setPlaying(!first.stack);
  markList(); drawAll(); renderMed();
  if (tip) setStatus(tip);
}
