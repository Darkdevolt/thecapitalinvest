/* THE CAPITAL — Durcissement de l'intégrité des séances
 * Complète le gestionnaire central sans modifier Supabase :
 * 1) titres inactifs exclus du référentiel attendu
 * 2) jours fériés BRVM 2026 exclus des séances attendues
 * 3) toute mutation historique/indice invalide la validation de la séance
 */
(function(){
'use strict';

var HOLIDAYS={
 '2026-01-01':'Jour de l’An',
 '2026-03-16':'Lendemain de la nuit du Destin',
 '2026-03-20':'Fête du Ramadan',
 '2026-04-06':'Lundi de Pâques',
 '2026-05-01':'Fête du Travail',
 '2026-05-14':'Ascension',
 '2026-05-25':'Lundi de Pentecôte',
 '2026-05-27':'Fête de Tabaski',
 '2026-08-07':'Fête de l’Indépendance',
 '2026-08-26':'Fête de Maouloud',
 '2026-12-25':'Fête de Noël'
};

function cleanDate(v){return String(v||'').slice(0,10)}
function isHoliday(v){return !!HOLIDAYS[cleanDate(v)]}
function auth(){return {apikey:window.SB_ANON,Authorization:'Bearer '+window.TK,Accept:'application/json','Content-Type':'application/json'}}
function rest(){return window.SB_REST}
function isEntrepriseReference(url){
 var u=String(url||'');
 return /\/entreprises(?:\?|$)/.test(u) && /(?:^|[?&])select=/.test(u) && /(?:^|[,&])actif(?:,|$)/.test(decodeURIComponent(u));
}
function parseBody(body){if(!body)return null;if(typeof body==='string'){try{return JSON.parse(body)}catch(e){return null}}if(body instanceof Blob)return null;return body}
function tableFromUrl(url){var m=String(url||'').match(/\/rest\/v1\/([^?/#]+)/);return m?m[1]:''}
function queryParam(url,name){try{return new URL(url,location.href).searchParams.get(name)}catch(e){return null}}
function idFromUrl(url){var m=String(url||'').match(/(?:^|[?&])id=eq\.([^&]+)/);return m?decodeURIComponent(m[1]):null}

/* Exclut les entreprises inactives uniquement pour la requête de référentiel
 * utilisée par le calendrier. Les autres écrans continuent à recevoir les
 * données complètes de la table entreprises. */
function patchEntrepriseResponse(response){
 return response.clone().json().then(function(rows){
   if(!Array.isArray(rows))return response;
   var active=rows.filter(function(r){return r && r.actif!==false});
   return new Response(JSON.stringify(active),{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)});
 }).catch(function(){return response});
}

async function findMutationDate(url,body){
 var b=parseBody(body);
 if(b && b.date_seance)return cleanDate(b.date_seance);
 if(b && b.date)return cleanDate(b.date);
 var q=queryParam(url,'date_seance');
 if(q)return cleanDate(q.replace(/^eq\./,''));
 var id=idFromUrl(url),table=tableFromUrl(url);
 if(!id || (table!=='historique' && table!=='indices'))return '';
 try{
   var r=await originalFetch(rest()+'/'+table+'?select=id,date_seance&id=eq.'+encodeURIComponent(id),{headers:auth()});
   if(!r.ok)return '';
   var rows=await r.json();
   return rows&&rows[0]?cleanDate(rows[0].date_seance):'';
 }catch(e){return ''}
}

async function invalidateValidation(date,table,method){
 if(!date)return;
 try{
   var payload={action:'SESSION_VALIDATION_OVERRIDE_REMOVED',detail:JSON.stringify({
     session_date:date,
     reason:'Donnée de séance modifiée après validation',
     source:'session-integrity-hardening',
     table:table,
     method:method,
     invalidated_at:new Date().toISOString()
   })};
   await originalFetch(rest()+'/admin_log',{method:'POST',headers:auth(),body:JSON.stringify(payload)});
 }catch(e){console.warn('[The Capital] Impossible d’invalider la validation de séance',e)}
 setTimeout(function(){
   var root=document.getElementById('tc-seances-globales');
   var refresh=root&&root.querySelector('[data-refresh]');
   if(refresh)refresh.click();
 },150);
}

var originalFetch=window.fetch.bind(window);
if(!window.__TC_SESSION_INTEGRITY_FETCH__){
 window.__TC_SESSION_INTEGRITY_FETCH__=true;
 window.fetch=async function(input,init){
   var url=typeof input==='string'?input:(input&&input.url)||'';
   var method=((init&&init.method)||(typeof input!=='string'&&input&&input.method)||'GET').toUpperCase();
   var table=tableFromUrl(url);

   var response=await originalFetch(input,init);

   if(isEntrepriseReference(url) && response.ok){
     return patchEntrepriseResponse(response);
   }

   if((table==='historique'||table==='indices') && method!=='GET' && response.ok){
     var date=await findMutationDate(url,init&&init.body);
     if(date)invalidateValidation(date,table,method);
   }
   return response;
 };
}

function decorateHolidayCells(){
 var root=document.getElementById('tc-seances-globales');
 if(!root)return;
 root.querySelectorAll('[data-day]').forEach(function(cell){
   var d=cleanDate(cell.getAttribute('data-day'));
   if(!isHoliday(d))return;
   cell.classList.add('tc-holiday');
   cell.disabled=true;
   cell.setAttribute('aria-label',HOLIDAYS[d]+' — aucune séance BRVM');
   var status=cell.querySelector('.tc-cal-status');
   if(status)status.textContent='■ JOUR FÉRIÉ BRVM';
   var meta=cell.querySelector('.tc-cal-meta');
   if(meta)meta.textContent=HOLIDAYS[d];
   cell.onclick=null;
 });
 root.querySelectorAll('tbody tr').forEach(function(row){
   var cells=row.querySelectorAll('td');
   if(!cells.length)return;
   var d=cleanDate(cells[0].textContent);
   if(!isHoliday(d))return;
   row.classList.add('tc-holiday-row');
   if(cells[1])cells[1].innerHTML='<span style="color:var(--muted)">■ JOUR FÉRIÉ BRVM</span>';
   if(cells[5])cells[5].innerHTML='<span style="color:var(--muted)">Aucune validation requise</span>';
   if(cells[6])cells[6].innerHTML='<span style="color:var(--muted)">'+HOLIDAYS[d]+'</span>';
 });
}

function injectStyle(){
 if(document.getElementById('tc-session-integrity-style'))return;
 var s=document.createElement('style');s.id='tc-session-integrity-style';s.textContent='.tc-cal-cell.tc-holiday{opacity:.62!important;border-color:var(--border)!important;background:rgba(255,255,255,.02)!important;cursor:not-allowed!important}.tc-holiday-row{opacity:.7}.tc-holiday-row td{background:rgba(255,255,255,.015)}';document.head.appendChild(s);
}

injectStyle();
var observer=new MutationObserver(function(){decorateHolidayCells()});
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(decorateHolidayCells,300);
})();
