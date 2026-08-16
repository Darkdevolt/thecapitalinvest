/* Loader de compatibilité pour le module de gestion globale des séances. */
(function(){
  var s=document.createElement('script');
  s.src='/admin/js/seances-globales.js?v=20260816-3';
  s.defer=true;
  s.onerror=function(){console.warn('[seances-globales] module admin introuvable')};
  document.head.appendChild(s);
})();
