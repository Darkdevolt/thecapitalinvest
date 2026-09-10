// ============================================================
// THE CAPITAL — INIT
// Bootstrap stable et sécurisé
// ============================================================

(function(){
  'use strict';
  if(window.__TC_INIT_LOADED__){ return; }
  window.__TC_INIT_LOADED__ = true;
  const SESSION_KEY = 'tc_session';

  function decodeBase64Url(value){
    let input = String(value || '').replace(/-/g,'+').replace(/_/g,'/');
    while(input.length % 4){ input += '='; }
    return atob(input);
  }

  function tokenIsValid(token){
    try{
      const parts = String(token || '').split('.');
      if(parts.length !== 3){ return false; }
      const payload = JSON.parse(decodeBase64Url(parts[1]));
      return !!payload.exp && payload.exp * 1000 > Date.now();
    }catch(error){ return false; }
  }

  function getSession(){
    try{
      if(window.TC_ENV && typeof window.TC_ENV.getSession === 'function'){
        const envSession = window.TC_ENV.getSession();
        if(envSession && envSession.access_token && tokenIsValid(envSession.access_token)) return envSession;
      }
    }catch(error){ console.warn('[INIT] Session TC_ENV indisponible:', error); }
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw){ return null; }
      const parsed = JSON.parse(raw);
      const session = (parsed && parsed.data && parsed.data.session) || (parsed && parsed.session) || parsed;
      if(!session || !session.access_token || !tokenIsValid(session.access_token)) return null;
      return session;
    }catch(error){ return null; }
  }

  function requireAuth(){
    const session = getSession();
    if(session){
      window.tcSession = session;
      window.tcAccessToken = session.access_token;
      return true;
    }
    const target = '/app.html';
    window.location.replace('/login.html?redirect=' + encodeURIComponent(target));
    return false;
  }

  function normalizeDocument(){
    document.querySelectorAll('base').forEach(function(base){ base.remove(); });
    document.querySelectorAll('a[href]').forEach(function(link){
      const href = link.getAttribute('href') || '';
      if(href && href.charAt(0) !== '#' && !/^(https?:|mailto:|tel:|javascript:)/i.test(href)){
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
  }

  function safeRender(){
    try{
      if(typeof window.renderCurrentView === 'function') window.renderCurrentView();
    }catch(error){ console.error('[INIT] Rendu:', error); }
  }

  function loadScript(src){
    // Dédup par chemin (sans ?v=) via le helper global : plusieurs loaders
    // demandaient le même fichier avec des versions différentes.
    if(typeof window.tcLoadOnce === 'function') return window.tcLoadOnce(src);
    return new Promise(function(resolve){
      var path = String(src).split('?')[0];
      if(document.querySelector('script[src="'+path+'"],script[src^="'+path+'?"]')){ resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.tcSecondary = src;
      script.onload = function(){ resolve(); };
      script.onerror = function(){ console.warn('[INIT] Module secondaire indisponible:', src); resolve(); };
      document.head.appendChild(script);
    });
  }

  async function loadSecondaryModules(){
    const modules = [
      '/app/js/views/overview-fixes.js?v=1',
      '/app/js/views/brvm-market-hours.js?v=20260827.3',
      '/app/js/market-ux.js?v=20260827.2',
      '/app/js/views/user-data-patch.js?v=7',
      '/app/js/views/fundamental-ratios.js?v=1',
      '/app/js/views/dashboard-presentation-v2.js?v=20260910.2'
    ];
    for(const src of modules){ await loadScript(src); }
  }

  async function init(){
    if(!requireAuth()) return;
    normalizeDocument();
    console.log('[INIT] Session authentifiée.');
    try{
      if(typeof window.initApp === 'function') window.initApp();
      else console.error('[INIT] initApp() absent.');
    }catch(error){ console.error('[INIT] initApp:', error); }
    if(document.body){
      document.body.classList.remove('init-hidden');
      document.body.style.opacity = '1';
      document.body.style.visibility = 'visible';
    }
    try{ await loadSecondaryModules(); }
    catch(error){ console.warn('[INIT] Modules secondaires:', error); }
    safeRender();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
