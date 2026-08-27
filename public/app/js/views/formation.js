// Legacy compatibility shim.
// The obsolete Formation view was removed from the application router and DOM.
// This file remains temporarily because older app.html deployments can still reference it.
// It intentionally exposes no Formation UI or route and contains no Formation business logic.
(function(){
  'use strict';
  if (window.__TC_SUIVI_LOADER__) return;
  window.__TC_SUIVI_LOADER__ = true;
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  load('/app/js/views/suivi-integrated.js?v=20260827').then(function(){return load('/app/js/views/suivi-metrics-fix.js?v=20260827');}).catch(function(err){console.error('[SUIVI] Chargement du module intégré impossible',err);});
})();
