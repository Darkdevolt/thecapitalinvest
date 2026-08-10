// THE CAPITAL — Unified application bootstrap
(function () {
  'use strict';

  var started = false;
  var SESSION_KEY = 'tc_session';

  function tokenIsValid(token) {
    try { var parts=String(token||'').split('.'); if(parts.length!==3)return false; var payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))); return !!payload.exp && payload.exp*1000>Date.now()+60000; } catch(e){ return false; }
  }
  function getSession(){ try{var raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;var session=JSON.parse(raw);if(!session||!tokenIsValid(session.access_token)){localStorage.removeItem(SESSION_KEY);return null;}return session;}catch(e){localStorage.removeItem(SESSION_KEY);return null;} }
  function requireAuth(){var session=getSession();if(session)return true;var current=location.pathname.split('/').pop()||'app.html';var redirect=encodeURIComponent(current+location.search+location.hash);location.replace('login.html?redirect='+redirect);return false;}
  function normalizeDocument(){document.querySelectorAll('base').forEach(function(base){base.remove();});document.querySelectorAll('a[href]').forEach(function(a){var href=a.getAttribute('href')||'';if(href&&href.charAt(0)!=='#'&&!/^(https?:|mailto:|tel:|javascript:)/i.test(href)){a.removeAttribute('target');a.removeAttribute('rel');}});}
  function loadScript(src,done){var existing=document.querySelector('script[data-tc-runtime="'+src.replace(/"/g,'')+'"]');if(existing){done();return;}var script=document.createElement('script');script.src=src;script.async=false;script.dataset.tcRuntime=src;script.onload=done;script.onerror=function(){console.error('[INIT] Script impossible à charger:',src);done();};document.head.appendChild(script);}
  function loadRuntimeLayers(done){loadScript('app/js/views/portefeuille/portfolio-store.js?v=9',function(){loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=8',function(){loadScript('app/js/views/user-data-patch.js?v=7',function(){loadScript('app/js/views/fundamental-ratios.js?v=1',done);});});});}
  function renderAfterData(){try{if(typeof window.renderCurrentView==='function')window.renderCurrentView();else if(typeof window.parseHash==='function')window.parseHash();}catch(e){console.warn('[INIT] rendu après données:',e);}}

  function initMobileMenu(){
    var header=document.querySelector('.header'),sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay');if(!header||!sidebar)return;
    var btn=document.getElementById('mobileMenuToggle');
    if(!btn){btn=document.createElement('button');btn.id='mobileMenuToggle';btn.className='mobile-menu-toggle';btn.type='button';btn.setAttribute('aria-label','Ouvrir le menu');btn.setAttribute('aria-controls','sidebar');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span></span><span></span><span></span>';header.insertBefore(btn,header.firstChild);}
    function setMenu(open){sidebar.classList.toggle('mobile-open',open);if(overlay)overlay.classList.toggle('mobile-open',open);btn.setAttribute('aria-expanded',open?'true':'false');btn.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');document.body.classList.toggle('menu-open',open);}
    btn.onclick=function(){setMenu(!sidebar.classList.contains('mobile-open'));};if(overlay)overlay.onclick=function(){setMenu(false);};sidebar.querySelectorAll('.nav-item').forEach(function(item){item.addEventListener('click',function(){if(window.innerWidth<=760)setMenu(false);});});window.addEventListener('resize',function(){if(window.innerWidth>760)setMenu(false);});
  }
  function init(){if(started)return;started=true;if(!requireAuth())return;normalizeDocument();console.log('[INIT] Session authentifiée — démarrage The Capital');if(typeof window.initApp!=='function'){console.error('[INIT] initApp manquant — main.js doit être chargé avant init.js');document.body.classList.remove('init-hidden');return;}try{window.initApp();console.log('[INIT] initApp lancé');}catch(e){console.error('[INIT] initApp:',e);}initMobileMenu();if(typeof window.initUserDataLayer==='function'){try{window.initUserDataLayer();}catch(e){console.warn('[INIT] user data:',e);}}if(window.marketsModule&&typeof window.marketsModule.loadData==='function'){try{window.marketsModule.loadData();}catch(e){console.warn('[INIT] marketsModule:',e);}}document.body.classList.remove('init-hidden');renderAfterData();}
  function boot(){normalizeDocument();if(!requireAuth())return;loadRuntimeLayers(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
