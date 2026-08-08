// THE CAPITAL — single-app routing compatibility layer
(function(){
  const originalNav = window.nav;
  if (typeof originalNav !== 'function' || window.__TC_ROUTER_PATCHED__) return;
  window.__TC_ROUTER_PATCHED__ = true;

  window.nav = function(id, noHash){
    if (id !== 'marche') return originalNav(id, noHash);

    if (typeof destroyAllCharts === 'function') destroyAllCharts();
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    const view = document.getElementById('view-marche');
    if (!view) {
      console.error('[ROUTER] view-marche introuvable');
      return;
    }
    view.classList.add('active');
    view.style.display = '';
    document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-marche');
    if (navEl) navEl.classList.add('active');
    if (!noHash) history.replaceState(null, '', '#marche');
    setTimeout(() => {
      if (typeof renderMarche === 'function') renderMarche();
    }, 30);
  };
})();
