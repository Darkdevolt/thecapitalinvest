/* Loader de compatibilité pour le module de gestion globale des séances. */
(function(){
  function load(src){
    var s=document.createElement('script');
    s.src=src;
    s.defer=true;
    s.onerror=function(){console.warn('[seances-globales] module introuvable: '+src)};
    document.head.appendChild(s);
  }
  load('/admin/js/seances-details.js?v=20260818-1');
  load('/admin/js/seances-globales.js?v=20260818-1');
})();