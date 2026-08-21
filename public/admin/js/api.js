/* Compatibility loader: canonical Admin API lives in core/api.js. */
(function(){
  if(document.querySelector('script[data-tc-core-api]')) return;
  var s=document.createElement('script');
  s.src='core/api.js';
  s.setAttribute('data-tc-core-api','true');
  s.async=false;
  document.head.appendChild(s);
})();
