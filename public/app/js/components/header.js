// ═══════════════════════════════════════
// COMPONENT, Header
// ═══════════════════════════════════════

// Header-related logic: topnav, dropdowns, global search integration.

function initHeader() {
  // Header initialization is intentionally lightweight.
}

(function initDropdownRuntime(){
  if(window.__TC_DROPDOWNS_READY__) return;
  window.__TC_DROPDOWNS_READY__=true;

  window.closeDropdowns=function(){
    document.querySelectorAll('.nav-dropdown-menu.open').forEach(function(menu){menu.classList.remove('open');});
    document.querySelectorAll('.nav-dropdown-btn.open').forEach(function(btn){btn.classList.remove('open');});
  };

  window.toggleDropdown=function(id){
    var root=document.getElementById(id);
    if(!root) return;
    var menu=root.querySelector('.nav-dropdown-menu');
    var btn=root.querySelector('.nav-dropdown-btn');
    if(!menu||!btn) return;
    var shouldOpen=!menu.classList.contains('open');
    window.closeDropdowns();
    if(shouldOpen){menu.classList.add('open');btn.classList.add('open');}
  };

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') window.closeDropdowns();
  });

  document.addEventListener('click',function(e){
    if(!e.target.closest('.nav-dropdown')) window.closeDropdowns();
  });
})();

(function loadDisplayAndProductModules(){
  const scripts = [
    'app/js/mode.js',
    'app/js/views/comparison.js',
    'app/js/views/dividend-screener.js'
  ];
  scripts.forEach(src => {
    if (document.querySelector(`script[data-tc-module="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset.tcModule = src;
    document.body.appendChild(script);
  });
})();
