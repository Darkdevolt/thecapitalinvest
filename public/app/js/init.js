// INIT — Unified application bootstrap
(function () {
  'use strict';
  var started=false,SESSION_KEY='tc_session';
  function tokenIsValid(token){try{var parts=String(token||'').split('.');if(parts.length!==3)return false;var payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));return!!payload.exp&&payload.exp*1000>Date.now()+60000;}catch(e){return false;}}
  function getSession(){try{var raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;var session=JSON.parse(raw);if(!session||!tokenIsValid(session.access_token)){localStorage.removeItem(SESSION_KEY);return null;}return session;}catch(e){localStorage.removeItem(SESSION_KEY);return null;}}
  function requireAuth(){var session=getSession();if(session)return true;var current=location.pathname.split('/').pop()||'app.html';var redirect=encodeURIComponent(current+location.search+location.hash);location.replace('login.html?redirect='+redirect);return false;}
  function normalizeDocument(){document.querySelectorAll('base').forEach(function(base){base.remove();});document.querySelectorAll('a[href]').forEach(function(a){var href=a.getAttribute('href')||'';if(href&&href.charAt(0)!=='#'&&!/^(https?:|mailto:|tel:|javascript:)/i.test(href)){a.removeAttribute('target');a.removeAttribute('rel');}});}
  function loadScript(src,done){var existing=document.querySelector('script[data-tc-runtime="'+src.replace(/"/g,'')+'"]');if(existing){done();return;}var script=document.createElement('script');script.src=src;script.async=false;script.dataset.tcRuntime=src;script.onload=done;script.onerror=function(){console.error('[INIT] Script impossible à charger:',src);done();};document.head.appendChild(script);}
  function loadStyle(href){if(document.querySelector('link[data-tc-runtime-style="'+href.replace(/"/g,'')+'"]'))return;var link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.tcRuntimeStyle=href;document.head.appendChild(link);}
  function loadRuntimeLayers(done){
    loadStyle('app/css/technique-experience.css?v=2');
    loadScript('app/js/views/portefeuille/portfolio-store.js?v=9',function(){loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=8',function(){loadScript('app/js/views/user-data-patch.js?v=7',function(){loadScript('app/js/views/fundamental-ratios.js?v=1',function(){loadScript('app/js/views/technique/experience.js?v=2',done);});});});});
  }
  function renderAfterData(){try{if(typeof window.renderCurrentView==='function')window.renderCurrentView();else if(typeof window.parseHash==='function')window.parseHash();}catch(e){console.warn('[INIT] rendu après données:',e);}}
  function init(){
    if(started)return;started=true;if(!requireAuth())return;normalizeDocument();console.log('[INIT] Session authentifiée — démarrage The Capital');
    if(typeof window.initApp!=='function'){console.error('[INIT] initApp manquant — main.js doit être chargé avant init.js');document.body.classList.remove('init-hidden');return;}
    try{window.initApp();console.log('[INIT] initApp lancé');}catch(e){console.error('[INIT] initApp:',e);}
    if(typeof window.initSidebar==='function'){try{window.initSidebar();}catch(e){console.warn('[INIT] sidebar:',e);}}
    if(typeof window.initUserDataLayer==='function'){try{window.initUserDataLayer();}catch(e){console.warn('[INIT] user data:',e);}}
    if(window.marketsModule&&typeof window.marketsModule.loadData==='function'){try{window.marketsModule.loadData();}catch(e){console.warn('[INIT] marketsModule:',e);}}
    document.body.classList.remove('init-hidden');renderAfterData();
  }
  function boot(){normalizeDocument();if(!requireAuth())return;loadRuntimeLayers(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
