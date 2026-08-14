(function(){
'use strict';

/*
 * ARCHITECTURE SCRAPER:
 * 1. Le scraper ne touche JAMAIS Supabase pendant la récupération.
 * 2. Il place la séance dans une prévisualisation Admin.
 * 3. Mode MANUEL : aucune écriture tant que l'admin n'a pas validé.
 * 4. Mode AUTOMATIQUE : validation et transfert vers historique après récupération.
 * Les graphiques/app consomment ensuite la base existante via leurs flux habituels.
 */

var SCRAPER_PENDING_KEY='tc_scraper_pending_v2';
var SCRAPER_MODE_KEY='tc_scraper_mode_v2';
var scraperPending=null;

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
function getMode(){return localStorage.getItem(SCRAPER_MODE_KEY)==='auto'?'auto':'manual';}
function setMode(mode){localStorage.setItem(SCRAPER_MODE_KEY,mode==='auto'?'auto':'manual');renderScraperControls();}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function n(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return isFinite(v)?v:null;var s=String(v).replace(/\u00a0/g,' ').replace(/\s/g,'').replace('%','');var x=Number(s.replace(/\.(?=.*\.)/g,'').replace(',','.'));return isFinite(x)?x:null;}
function fmt(v){var x=n(v);return x===null?'—':x.toLocaleString('fr-FR',{maximumFractionDigits:2});}
function fmtPct(v){var x=n(v);return x===null?'—':x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}

function ensureUi(){
  var panel=document.getElementById('panel-scraper');
  if(!panel)return;
  var card=panel.querySelector('.card');
  if(!card)return;
  var controls=panel.querySelector('#tc-scraper-controls');
  if(!controls){
    controls=document.createElement('div');
    controls.id='tc-scraper-controls';
    controls.className='card';
    controls.style.marginBottom='16px';
    controls.innerHTML='<div class="card-header"><span class="card-title">Mode de synchronisation</span></div>'+
      '<div style="padding:18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'+
      '<button id="tc-mode-manual" class="btn btn-outline btn-sm" type="button">MANUEL</button>'+
      '<button id="tc-mode-auto" class="btn btn-outline btn-sm" type="button">AUTOMATIQUE</button>'+
      '<span id="tc-mode-label" style="font-size:11px;color:var(--muted);"></span></div>';
    panel.insertBefore(controls,panel.firstElementChild&&panel.firstElementChild.nextElementSibling?panel.firstElementChild.nextElementSibling:null);
    document.getElementById('tc-mode-manual').onclick=function(){setMode('manual');};
    document.getElementById('tc-mode-auto').onclick=function(){setMode('auto');};
  }
  var preview=document.getElementById('tc-scraper-preview');
  if(!preview){
    preview=document.createElement('div');
    preview.id='tc-scraper-preview';
    preview.className='card';
    preview.style.marginBottom='16px';
    preview.innerHTML='<div class="card-header"><span class="card-title">Prévisualisation de la séance</span><span id="tc-preview-count" style="margin-left:auto;font-size:11px;color:var(--muted);"></span></div>'+
      '<div id="tc-preview-summary" style="padding:14px 18px;font-size:12px;color:var(--muted);"></div>'+
      '<div class="tw" style="max-height:520px;overflow:auto;"><table><thead><tr><th>Ticker</th><th>Date</th><th class="r">Clôture</th><th class="r">Ouv.</th><th class="r">+Haut</th><th class="r">+Bas</th><th class="r">Volume</th><th class="r">Variation</th><th class="r">Valeur</th></tr></thead><tbody id="tc-preview-body"></tbody></table></div>'+
      '<div class="actions-row" id="tc-preview-actions" style="display:none;padding:14px 18px;"><button class="btn btn-green" id="tc-validate-session" type="button">✓ Valider la séance et mettre à jour la base</button><button class="btn btn-outline btn-sm" id="tc-reject-session" type="button">✕ Rejeter</button><span id="tc-preview-msg" class="msg"></span></div>';
    panel.insertBefore(preview,card);
    document.getElementById('tc-validate-session').onclick=validatePendingSession;
    document.getElementById('tc-reject-session').onclick=rejectPendingSession;
  }
  renderScraperControls();
}

function renderScraperControls(){
  var mode=getMode();
  var m=document.getElementById('tc-mode-manual'),a=document.getElementById('tc-mode-auto'),l=document.getElementById('tc-mode-label');
  if(!m||!a||!l)return;
  m.className='btn '+(mode==='manual'?'btn-primary':'btn-outline')+' btn-sm';
  a.className='btn '+(mode==='auto'?'btn-green':'btn-outline')+' btn-sm';
  l.textContent=mode==='auto'?'Mode automatique : après récupération, la séance validée est transférée directement dans Supabase.':'Mode manuel : la séance reste dans l’Admin jusqu’à validation explicite.';
}

async function requestScraper(){
  var token=getAdminToken();
  var headers={'Content-Type':'application/json','Accept':'application/json','X-Requested-With':'XMLHttpRequest'};
  if(token)headers.Authorization='Bearer '+token;
  var urls=['/api/scrape-brvm','https://thecapitalinvest.vercel.app/api/scrape-brvm'];
  var lastError=null;
  for(var i=0;i<urls.length;i++){
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},50000);
    try{
      var r=await fetch(urls[i],{method:'POST',headers:headers,body:'{}',credentials:'same-origin',cache:'no-store',signal:controller.signal});
      clearTimeout(timer);
      var d=await r.json().catch(function(){return {};});
      if(!r.ok)throw new Error((d.error||('HTTP '+r.status))+(Array.isArray(d.details)?' — '+d.details.map(function(x){return x.source+': '+x.error;}).join(' | '):''));
      return d;
    }catch(e){
      clearTimeout(timer);lastError=e.name==='AbortError'?new Error('Timeout du scraper'):e;
      if(i<urls.length-1)appendLogSafe('Route locale inaccessible — tentative passerelle Vercel...','info');
    }
  }
  throw lastError||new Error('Impossible de joindre le scraper');
}

function extractRows(d){
  var candidates=[d&&d.data&&d.data.rows,d&&d.rows,Array.isArray(d&&d.data)?d.data,d&&d.data&&d.data.data&&d.data.data.rows];
  for(var i=0;i<candidates.length;i++)if(Array.isArray(candidates[i])&&candidates[i].length)return candidates[i];
  return [];
}
function normalizeRow(r,date){
  var ticker=String(r&& (r.ticker||r.symbol||r.code||'')).trim().toUpperCase();
  var cours=r&&(r.cours_cloture!=null?r.cours_cloture:(r.cours!=null?r.cours:(r.close!=null?r.close:r.cloture)));
  return {ticker:ticker,date_seance:r&&r.date_seance||date,cours_cloture:n(cours),cours_ouverture:n(r&&(r.cours_ouverture!=null?r.cours_ouverture:(r.ouverture!=null?r.ouverture:r.open))),plus_haut:n(r&&(r.plus_haut!=null?r.plus_haut:(r.haut!=null?r.haut:r.high))),plus_bas:n(r&&(r.plus_bas!=null?r.plus_bas:(r.bas!=null?r.bas:r.low))),volume:n(r&&r.volume),variation:n(r&&(r.variation!=null?r.variation:(r.variation_pct!=null?r.variation_pct:r.var))),valeur_totale:n(r&&(r.valeur_totale!=null?r.valeur_totale:(r.valeur!=null?r.valeur:r.valeur_transigee)))};
}
function buildPending(d){
  var rows=extractRows(d),date=(d&&d.data&&d.data.date_seance)||new Date().toISOString().slice(0,10);
  var normalized=rows.map(function(r){return normalizeRow(r,date);}).filter(function(r){return r.ticker&&r.cours_cloture!==null;});
  normalized=Array.from(new Map(normalized.map(function(r){return [r.ticker,r];})).values());
  return {source:d.source||'BRVM',date_seance:date,rows:normalized,received_at:new Date().toISOString(),count:normalized.length};
}
function renderPreview(p){
  var box=document.getElementById('tc-scraper-preview'),body=document.getElementById('tc-preview-body'),summary=document.getElementById('tc-preview-summary'),count=document.getElementById('tc-preview-count'),actions=document.getElementById('tc-preview-actions');
  if(!box||!body)return;
  if(!p||!p.rows||!p.rows.length){box.style.display='none';return;}
  box.style.display='block';count.textContent=p.count+' titres';
  summary.innerHTML='<strong>Séance '+esc(p.date_seance)+'</strong> · Source : '+esc(p.source)+' · '+p.count+' cotations exploitables. '+(getMode()==='manual'?'⚠️ Rien n’est écrit dans Supabase avant validation.':'✓ Mode automatique actif.');
  body.innerHTML=p.rows.map(function(r){return '<tr><td class="td-gold">'+esc(r.ticker)+'</td><td>'+esc(r.date_seance)+'</td><td class="r td-mono">'+fmt(r.cours_cloture)+'</td><td class="r">'+fmt(r.cours_ouverture)+'</td><td class="r">'+fmt(r.plus_haut)+'</td><td class="r">'+fmt(r.plus_bas)+'</td><td class="r">'+fmt(r.volume)+'</td><td class="r">'+fmtPct(r.variation)+'</td><td class="r">'+fmt(r.valeur_totale)+'</td></tr>';}).join('');
  actions.style.display=getMode()==='manual'?'flex':'none';
}
function savePending(p){scraperPending=p;try{localStorage.setItem(SCRAPER_PENDING_KEY,JSON.stringify(p));}catch(e){}renderPreview(p);}
function clearPending(){scraperPending=null;try{localStorage.removeItem(SCRAPER_PENDING_KEY);}catch(e){}var b=document.getElementById('tc-scraper-preview');if(b)b.style.display='none';}
function loadPending(){try{var p=JSON.parse(localStorage.getItem(SCRAPER_PENDING_KEY)||'null');if(p&&Array.isArray(p.rows)){scraperPending=p;renderPreview(p);}}catch(e){}}

async function transferToSupabase(p){
  if(!p||!p.rows||!p.rows.length)throw new Error('Aucune donnée à transférer');
  var payload=p.rows.map(function(r){return {ticker:r.ticker,date_seance:r.date_seance,cours_cloture:r.cours_cloture,cours_ouverture:r.cours_ouverture,plus_haut:r.plus_haut,plus_bas:r.plus_bas,volume:r.volume,variation:r.variation,valeur_totale:r.valeur_totale};});
  var result=await sbPost('historique',payload,'ticker,date_seance');
  if(!result)throw new Error('Échec de mise à jour de la table historique Supabase');
  return payload.length;
}

async function validatePendingSession(){
  var p=scraperPending;if(!p)return;
  var msg=document.getElementById('tc-preview-msg');if(msg){msg.textContent='Validation et transfert en cours...';msg.className='msg info';}
  try{
    var count=await transferToSupabase(p);
    appendLogSafe('✓ Séance '+p.date_seance+' validée : '+count+' titres transférés dans Supabase','ok');
    if(msg){msg.textContent='✓ '+count+' titres transférés';msg.className='msg ok';}
    clearPending();
    if(typeof loadCours==='function')loadCours();
    if(typeof toast==='function')toast('Séance validée — '+count+' titres','ok');
  }catch(e){
    if(msg){msg.textContent='Erreur : '+e.message;msg.className='msg err';}
    appendLogSafe('Échec validation : '+e.message,'err');
  }
}
function rejectPendingSession(){if(!scraperPending)return;clearPending();appendLogSafe('Séance rejetée — aucune donnée écrite dans Supabase.','info');if(typeof toast==='function')toast('Séance rejetée','info');}

window.runScraper=async function(){
  ensureUi();
  var msg=document.getElementById('scraper-msg');if(msg){msg.textContent='Scraper en cours...';msg.className='msg info';}
  appendLogSafe('Lancement du scraper BRVM — récupération uniquement, aucune écriture Supabase...','info');
  try{
    var d=await requestScraper();
    var p=buildPending(d);
    if(!p.rows.length)throw new Error('Le scraper n’a retourné aucune cotation exploitable');
    savePending(p);
    appendLogSafe('✓ '+p.count+' titres récupérés pour la séance '+p.date_seance,'ok');
    if(getMode()==='auto'){
      appendLogSafe('Mode automatique actif — transfert de la séance vers Supabase...','info');
      await validatePendingSession();
      if(msg){msg.textContent='✓ Séance récupérée et transférée automatiquement';msg.className='msg ok';}
    }else{
      appendLogSafe('Mode manuel — séance en attente de validation Admin.','info');
      if(msg){msg.textContent='✓ Séance prête à être vérifiée';msg.className='msg ok';}
    }
  }catch(e){
    console.error('[scraper]',e);appendLogSafe('Échec du scraping : '+(e.message||e),'err');
    if(msg){msg.textContent='Erreur scraper : '+(e.message||e);msg.className='msg err';}
  }
};

/* Anciennes actions dangereuses : elles restent disponibles pour compatibilité mais ne déclenchent plus une écriture automatique. */
window.syncHistFromCours=window.syncHistFromCours||async function(){if(typeof toast==='function')toast('Utilisez la validation de séance du scraper','info');};
window.runFallback=window.runFallback||async function(){if(typeof recalcVariations==='function')return recalcVariations();};

(function init(){
  function boot(){ensureUi();loadPending();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* BOC uploader remains loaded separately, without affecting scraper flow. */
(function loadBocAdmin(){
  if(document.getElementById('tc-boc-admin-script'))return;
  var s=document.createElement('script');s.id='tc-boc-admin-script';s.src='/admin/js/boc-admin.js';s.defer=true;s.onerror=function(){console.warn('[BOC] module uploader indisponible');};document.head.appendChild(s);
})();
})();
