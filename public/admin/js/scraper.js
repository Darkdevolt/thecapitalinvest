(function(){
'use strict';

/* Load the legacy scraper without document.write so the Admin can also load this file dynamically. */
(function loadLegacy(){
  if(window.__TC_LEGACY_SCRAPER_LOADED__) return;
  window.__TC_LEGACY_SCRAPER_LOADED__=true;
  var s=document.createElement('script');
  s.src='/admin/js/scraper-legacy.js';
  s.async=false;
  s.onerror=function(){console.warn('[scraper] legacy scraper unavailable');};
  document.head.appendChild(s);
})();

function getAdminToken(){
  try{
    var raw=localStorage.getItem('tc_session');
    var s=raw?JSON.parse(raw):null;
    return s&&s.access_token?s.access_token:(s&&s.data&&s.data.session?s.data.session.access_token:'');
  }catch(e){return localStorage.getItem('tc_token')||'';}
}

function appendLogSafe(text,type){
  if(typeof appendScraperLog==='function') appendScraperLog(text,type);
  else console.log('[scraper]',text);
}

async function requestScraper(){
  var token=getAdminToken();
  var headers={'Content-Type':'application/json','Accept':'application/json','X-Requested-With':'XMLHttpRequest'};
  if(token) headers.Authorization='Bearer '+token;
  var urls=['/api/scrape-brvm','https://thecapitalinvest.vercel.app/api/scrape-brvm'];
  var lastError=null;
  for(var i=0;i<urls.length;i++){
    var controller=new AbortController();
    var timer=setTimeout(function(){controller.abort();},50000);
    try{
      var r=await fetch(urls[i],{method:'POST',headers:headers,body:'{}',credentials:'same-origin',cache:'no-store',signal:controller.signal});
      clearTimeout(timer);
      var d=await r.json().catch(function(){return {};});
      if(!r.ok) throw new Error((d.error||('HTTP '+r.status))+(Array.isArray(d.details)?' — '+d.details.map(function(x){return x.source+': '+x.error;}).join(' | '):''));
      return d;
    }catch(e){
      clearTimeout(timer);
      lastError=e.name==='AbortError'?new Error('Timeout de la passerelle scraper'):e;
      if(i<urls.length-1) appendLogSafe('Route locale inaccessible — tentative passerelle Vercel...','info');
    }
  }
  throw lastError||new Error('Impossible de joindre le serveur scraper');
}

window.runScraper=async function(){
  var msg=document.getElementById('scraper-msg');
  if(msg){msg.textContent='Scraper en cours...';msg.className='msg info';}
  appendLogSafe('Lancement du scraper BRVM...','info');
  try{
    var d=await requestScraper();
    if(d.source==='Sika Finance'){
      var rows=d.data&&d.data.rows||[];
      appendLogSafe('BRVM inaccessible — fallback Sika Finance...','info');
      appendLogSafe('Sika Finance : récupération réussie','ok');
      appendLogSafe('✓ '+rows.length+' titres récupérés','ok');
      if(!rows.length) throw new Error('Aucune cotation Sika Finance récupérée');
      var historique=rows.map(function(r){return {
        ticker:r.ticker,date_seance:r.date_seance,cours_cloture:r.cours,
        cours_ouverture:r.ouverture,plus_haut:r.plus_haut,plus_bas:r.plus_bas,
        volume:r.volume,variation:r.variation,valeur_totale:r.valeur
      };});
      var result=await sbPost('historique',historique,'ticker,date_seance');
      if(!result) throw new Error('Échec de synchronisation Supabase (historique)');
      appendLogSafe('✓ '+historique.length+' cours synchronisés dans historique','ok');
      appendLogSafe('✓ données synchronisées','ok');
    }else{
      appendLogSafe('BRVM : récupération réussie','ok');
      appendLogSafe('✓ données synchronisées par la source BRVM','ok');
    }
    appendLogSafe('Source utilisée : '+d.source,'ok');
    if(msg){msg.textContent='✓ Terminé — source : '+d.source;msg.className='msg ok';}
    if(typeof toast==='function') toast('Scraper terminé — '+d.source,'ok');
  }catch(e){
    console.error('[scraper]',e);
    appendLogSafe('Échec du scraping : '+(e.message||e),'err');
    if(msg){msg.textContent='Erreur scraper : '+(e.message||e);msg.className='msg err';}
    if(typeof toast==='function') toast('Échec du scraping BRVM','err');
  }
};

/* Load the BOC uploader alongside the existing scraper without changing the existing Admin architecture. */
(function loadBocAdmin(){
  if(document.getElementById('tc-boc-admin-script')) return;
  var s=document.createElement('script');
  s.id='tc-boc-admin-script';
  s.src='/admin/js/boc-admin.js';
  s.defer=true;
  s.onerror=function(){console.warn('[BOC] module uploader indisponible');};
  document.head.appendChild(s);
})();
})();
