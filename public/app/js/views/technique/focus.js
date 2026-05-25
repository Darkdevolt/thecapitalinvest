// ═══════════════════════════════════════
// AT — Focus Mode
// ═══════════════════════════════════════

// ── Focus ──
function atToggleFocus() {
  AT.focus = !AT.focus;
  const wrap = document.getElementById('atWrap');
  const btn = document.getElementById('atBtnFocus');
  const right = document.getElementById('atRight');
  if (AT.focus) {
    wrap.style.cssText='position:fixed;inset:0;z-index:999;height:100vh;border-radius:0;';
    btn.classList.add('on'); btn.textContent='✕ Quitter';
    right.style.display='none';
  } else {
    wrap.style.cssText='';
    btn.classList.remove('on'); btn.textContent='⛶ Focus';
    right.style.display='';
  }
  setTimeout(atRender, 50);
}
document.addEventListener('keydown', e => { if (e.key==='Escape' && AT.focus) atToggleFocus(); });
