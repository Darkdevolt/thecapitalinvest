// ═══════════════════════════════════════
// VIEW, Formation BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// FORMATION
// ═══════════════════════════════════════
function showFormationTab(tabId, btn) {
  document.querySelectorAll('.formation-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  document.querySelectorAll('#view-formation .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Le suivi est une vue native de l'application principale, pas une seconde app.
// Le chargeur est volontairement ici car ce module est déjà chargé par app.html.
(function loadIntegratedSuivi(){
  if (window.__TC_SUIVI_LOADER__) return;
  window.__TC_SUIVI_LOADER__ = true;
  const load = (src) => new Promise((resolve,reject) => {
    const s=document.createElement('script'); s.src=src; s.async=false;
    s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
  load('/app/js/views/suivi-integrated.js?v=20260827')
    .then(() => load('/app/js/views/suivi-metrics-fix.js?v=20260827'))
    .catch(err => console.error('[SUIVI] Chargement du module intégré impossible', err));
})();
