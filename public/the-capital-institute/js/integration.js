/* THE CAPITAL INSTITUTE — product integration layer */
(function(){'use strict';
var MAIN_URL='/';
var LS='tci-progression-v1';
var ENV=null;
var enrolled=false;
var enrollmentState='unknown'; // unknown | active | inactive | unavailable
var lastSync='';
var API_TIMEOUT=8000;

function withTimeout(promise,ms){
  return new Promise(function(resolve,reject){
    var settled=false;
    var timer=setTimeout(function(){if(settled)return;settled=true;var e=new Error('Supabase timeout');e.name='AbortError';reject(e)},ms||API_TIMEOUT);
    promise.then(function(v){if(settled)return;settled=true;clearTimeout(timer);resolve(v)},function(e){if(settled)return;settled=true;clearTimeout(timer);reject(e)});
  });
}

function loadEnv(){
  return new Promise(function(resolve){
    if(window.TC_ENV){ENV=window.TC_ENV;return resolve(true)}
    var done=false;
    var finish=function(ok){if(done)return;done=true;clearTimeout(timer);ENV=window.TC_ENV||null;resolve(!!ok&&!!ENV)};
    var timer=setTimeout(function(){finish(false)},API_TIMEOUT);
    var s=document.createElement('script');
    s.src='/js/env.js';
    s.onload=function(){finish(true)};
    s.onerror=function(){finish(false)};
    document.head.appendChild(s);
  });
}

function token(){try{return ENV&&ENV.getSession?ENV.getSession()?.access_token||'':''}catch(e){return ''}}
function uid(){try{return ENV&&ENV.getSession?ENV.getSession()?.user?.id||'':''}catch(e){return ''}}

async function api(path,options){
  if(!ENV||!token()||!uid())return {ok:false,kind:'auth',data:null};
  var o=Object.assign({},options||{});
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort()},API_TIMEOUT);
  o.headers=Object.assign({
    apikey:ENV.SUPABASE_ANON_KEY,
    Authorization:'Bearer '+token(),
    Accept:'application/json'
  },o.headers||{});
  o.signal=controller.signal;
  try{
    var r=await fetch(ENV.SUPABASE_URL+path,o);
    var data=await r.json().catch(function(){return null});
    if(!r.ok)return {ok:false,kind:r.status===401||r.status===403?'permission':'http',status:r.status,data:data};
    return {ok:true,kind:'ok',status:r.status,data:data};
  }catch(e){
    return {ok:false,kind:e&&e.name==='AbortError'?'timeout':'network',status:0,data:null,error:e};
  }finally{clearTimeout(timer)}
}

async function checkEnrollment(){
  var id=uid();
  if(!id){enrolled=false;enrollmentState='inactive';return}
  var result=await api('/rest/v1/subscriptions?user_id=eq.'+encodeURIComponent(id)+'&plan_code=eq.institute&status=eq.active&select=current_period_end,started_at&limit=1');
  if(!result.ok){
    enrolled=false;
    enrollmentState='unavailable';
    console.warn('[TCI] Vérification abonnement indisponible:',result.kind,result.status||'');
    return;
  }
  var d=result.data;
  enrolled=Array.isArray(d)&&d.length>0&&(!d[0].current_period_end||new Date(d[0].current_period_end)>new Date());
  enrollmentState=enrolled?'active':'inactive';
}

function readLocal(){try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch(e){return {}}}
function writeLocal(p){try{localStorage.setItem(LS,JSON.stringify(p))}catch(e){}}

async function pullProgress(){
  if(!enrolled||!uid())return;
  var result=await api('/rest/v1/institute_progress?user_id=eq.'+encodeURIComponent(uid())+'&select=completed_lessons,completed_courses,xp,streak_days,last_activity_at,badges&limit=1');
  if(!result.ok||!Array.isArray(result.data)||!result.data[0]){
    if(!result.ok)console.warn('[TCI] Progression distante indisponible:',result.kind,result.status||'');
    return;
  }
  var p=readLocal(),db=result.data[0],lessons={};
  (db.completed_lessons||[]).forEach(function(id){lessons[id]=true});
  p.lecons=Object.assign({},lessons,p.lecons||{});p.debut=p.debut||new Date().toISOString();writeLocal(p);
}

async function pushProgress(force){
  if(!enrolled||!uid())return;
  var p=readLocal(),ids=Object.keys(p.lecons||{}).filter(function(k){return p.lecons[k]});
  var payload={user_id:uid(),completed_lessons:ids,completed_courses:[],xp:ids.length*100,streak_days:0,last_activity_at:new Date().toISOString(),badges:ids.length>=1?['premiere_lecon']:[],updated_at:new Date().toISOString()};
  var signature=JSON.stringify(payload);
  if(!force&&signature===lastSync)return;
  lastSync=signature;
  var result=await api('/rest/v1/institute_progress?on_conflict=user_id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
  if(!result.ok)console.warn('[TCI] Synchronisation progression échouée:',result.kind,result.status||'');
}

function capitalLink(){var m=document.querySelector('main');if(!m||document.querySelector('.tci-capital-link'))return;var a=document.createElement('a');a.className='tci-capital-link';a.href=MAIN_URL;a.innerHTML='<span aria-hidden="true">←</span><span>Retour à The Capital</span>';m.insertBefore(a,m.firstChild)}
function userState(){
  var n=document.querySelector('.tci-nav');if(!n)return;
  var s=document.querySelector('.tci-user-state');
  if(!s){s=document.createElement('span');s.className='tci-user-state';n.appendChild(s)}
  s.textContent=enrollmentState==='active'?'✓ INSTITUTE ACTIF':enrollmentState==='inactive'?'✦ FORMATION':'⚠ Vérification indisponible';
  s.setAttribute('data-tci-state',enrollmentState);
}
function integrationStatus(){
  if(enrollmentState!=='unavailable')return;
  var m=document.querySelector('main');if(!m||document.querySelector('.tci-integration-error'))return;
  var d=document.createElement('div');d.className='tci-integration-error';d.setAttribute('role','status');
  d.innerHTML='<strong>Vérification temporairement indisponible.</strong><span>Le contenu reste disponible. La connexion à Supabase n’a pas répondu dans le délai prévu. Vous pouvez continuer et réessayer plus tard.</span>';
  m.insertBefore(d,m.firstChild);
}
function premium(){if(document.querySelector('.tci-premium'))return;var m=document.querySelector('main');if(!m)return;var d=document.createElement('section');d.className='tci-premium';d.innerHTML='<div class="tci-premium-k">THE CAPITAL INSTITUTE · PREMIUM</div><h2>Apprendre autrement.</h2><p>Des formations vidéo, des cas pratiques BRVM et des masterclass pour aller au-delà des fondamentaux.</p><div class="tci-premium-grid"><article><span>01</span><strong>🎥 Formations vidéo</strong><small>Modules courts, chapitres et reprise automatique.</small></article><article><span>02</span><strong>📊 Cas pratiques BRVM</strong><small>Analyse d’entreprises, ratios et exercices guidés.</small></article><article><span>03</span><strong>🏆 Parcours avancés</strong><small>Analyse financière, valuation, technique et gestion du risque.</small></article></div><a class="tci-premium-btn" href="/the-capital-institute/premium.html">Découvrir Premium</a>';m.appendChild(d)}
function gate(){if(enrollmentState==='active'||enrollmentState==='unknown'||document.querySelector('.tci-gate'))return;var d=document.createElement('div');d.className='tci-gate';d.innerHTML='<div class="tci-gate-card"><button class="tci-gate-x" aria-label="Fermer">×</button><div class="tci-premium-k">THE CAPITAL INSTITUTE</div><h2>Votre parcours commence ici.</h2><p>Accédez au programme complet, aux quiz, calculateurs et à votre progression personnelle pour <strong>1 000 FCFA</strong>.</p><div class="tci-gate-list"><span>✓ 6 parcours</span><span>✓ 34+ leçons</span><span>✓ Quiz & calculateurs</span><span>✓ Progression sauvegardée</span></div><a class="tci-premium-btn" href="/register.html?redirect=/institute-payment.html">S’inscrire — 1 000 FCFA</a></div></div>';document.body.appendChild(d);d.querySelector('.tci-gate-x').onclick=function(){d.remove()};}
function ambient(){if(document.querySelector('.tci-ambient'))return;var d=document.createElement('div');d.className='tci-ambient';d.setAttribute('aria-hidden','true');d.innerHTML='<i>✦</i><i>✦</i><i>•</i><i>✦</i>';document.body.appendChild(d)}
function intercept(){document.addEventListener('click',function(e){if(enrollmentState!=='inactive')return;var t=e.target.closest('[data-go^="parcours:"]'),l=e.target.closest('.tci-lecon');if(t||l){e.preventDefault();e.stopImmediatePropagation();gate()}},true)}

async function backgroundSync(){
  var hasEnv=await loadEnv();
  if(!hasEnv){enrollmentState='unavailable';userState();integrationStatus();return}
  await checkEnrollment();
  userState();integrationStatus();
  if(enrolled)await pullProgress();
  userState();
}

function initializeUI(){
  capitalLink();userState();ambient();premium();
  if(!document.querySelector('[data-tci-intercept]')){intercept();var marker=document.createElement('meta');marker.setAttribute('data-tci-intercept','1');document.head.appendChild(marker)}
  setInterval(function(){if(enrolled)pushProgress(false)},2500);
  window.addEventListener('beforeunload',function(){if(enrolled)pushProgress(true)});
  try{window.dispatchEvent(new CustomEvent('thecapital:institute-ready',{detail:{version:'3.1',enrolled:enrolled,state:enrollmentState}}))}catch(e){}
}

function ready(){
  // L’interface est montée immédiatement. Supabase est strictement secondaire.
  initializeUI();
  backgroundSync().catch(function(e){
    enrollmentState='unavailable';
    console.error('[TCI] Initialisation distante échouée:',e);
    userState();integrationStatus();
  });
}

new MutationObserver(function(){capitalLink();userState();premium();integrationStatus()}).observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ready):ready();
})();
