/* THE CAPITAL — Intégrité ciblée des séances
 * Aucun changement de schéma Supabase.
 * Les contrôles sont limités au module Gestion des séances.
 */
(function(){
'use strict';
var HOLIDAYS={
 '2026-01-01':'Jour de l’An','2026-03-17':'Lendemain de la nuit du Destin','2026-03-20':'Fête du Ramadan','2026-04-06':'Lundi de Pâques','2026-05-01':'Fête du Travail','2026-05-14':'Ascension','2026-05-25':'Lundi de Pentecôte','2026-05-27':'Fête de Tabaski','2026-08-07':'Fête de l’Indépendance','2026-08-26':'Fête de Maouloud','2026-12-25':'Fête de Noël'
};
function cleanDate(v){var s=String(v||'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:s.slice(0,10)}
function isHoliday(v){return !!HOLIDAYS[cleanDate(v)]}
function auth(){return {apikey:window.SB_ANON,Authorization:'Bearer '+window.TK,Accept:'application/json','Content-Type':'application/json'}}
function rest(){return window.SB_REST}
async function invalidateValidation(date,table,method){date=cleanDate(date);if(!date)return false;try{var payload={action:'SESSION_VALIDATION_OVERRIDE_REMOVED',detail:JSON.stringify({session_date:date,reason:'Donnée de séance modifiée après validation',source:'session-integrity-hardening',table:table,method:method,invalidated_at:new Date().toISOString()})};var r=await fetch(rest()+'/admin_log',{method:'POST',headers:auth(),body:JSON.stringify(payload)});if(!r.ok)throw Error('HTTP '+r.status);setTimeout(function(){if(window.tcSessionsReload)window.tcSessionsReload()},150);return true}catch(e){console.warn('[The Capital] Impossible d’invalider la validation de séance',e);return false}}
async function dateFromHistoriqueId(id){try{var r=await fetch(rest()+'/historique?select=id,date_seance&id=eq.'+encodeURIComponent(id),{headers:auth()});if(!r.ok)return '';var rows=await r.json();return rows&&rows[0]?cleanDate(rows[0].date_seance):''}catch(e){return ''}}
async function dateFromIndiceId(id){try{var r=await fetch(rest()+'/indices?select=id,date_seance&id=eq.'+encodeURIComponent(id),{headers:auth()});if(!r.ok)return '';var rows=await r.json();return rows&&rows[0]?cleanDate(rows[0].date_seance):''}catch(e){return ''}}
function decorateHolidayCells(){var root=document.getElementById('tc-seances-globales');if(!root)return;root.querySelectorAll('[data-day]').forEach(function(cell){var d=cleanDate(cell.getAttribute('data-day'));if(!isHoliday(d))return;cell.classList.add('tc-holiday');cell.disabled=true;cell.setAttribute('aria-label',HOLIDAYS[d]+' — aucune séance BRVM');var status=cell.querySelector('.tc-cal-status');if(status)status.textContent='■ JOUR FÉRIÉ BRVM';var meta=cell.querySelector('.tc-cal-meta');if(meta)meta.textContent=HOLIDAYS[d]});root.querySelectorAll('tbody tr').forEach(function(row){var cells=row.querySelectorAll('td');if(!cells.length)return;var d=cleanDate(cells[0].textContent);if(!isHoliday(d))return;row.classList.add('tc-holiday-row');if(cells[1])cells[1].innerHTML='<span style="color:var(--muted)">■ JOUR FÉRIÉ BRVM</span>';if(cells[5])cells[5].innerHTML='<span style="color:var(--muted)">Aucune validation requise</span>';if(cells[6])cells[6].innerHTML='<span style="color:var(--muted)">'+HOLIDAYS[d]+'</span>'})}
function injectStyle(){if(document.getElementById('tc-session-integrity-style'))return;var s=document.createElement('style');s.id='tc-session-integrity-style';s.textContent='.tc-cal-cell.tc-holiday{opacity:.62!important;border-color:var(--border)!important;background:rgba(255,255,255,.02)!important;cursor:not-allowed!important}.tc-holiday-row{opacity:.7}.tc-holiday-row td{background:rgba(255,255,255,.015)}';document.head.appendChild(s)}
function wireCoursIntegrity(){if(window.__TC_COURS_INTEGRITY_WIRED__)return;if(!window.CoursApp)return false;window.__TC_COURS_INTEGRITY_WIRED__=true;var app=window.CoursApp;
 function wrap(name,resolveDate,table){if(typeof app[name]!=='function')return;var original=app[name];app[name]=async function(){var args=arguments,result=await original.apply(this,args);if(result===false)return result;var d=await resolveDate(args,result);if(d)await invalidateValidation(d,table,name);return result}}
 wrap('addCours',async function(){var f=document.getElementById('c-date');return f&&f.value},'historique');
 wrap('saveCours',async function(args){var id=args[0]||document.getElementById('modal-cours-id')&&document.getElementById('modal-cours-id').value;return id?dateFromHistoriqueId(id):''},'historique');
 wrap('deleteCours',async function(args){var d=args[1];return cleanDate(d)},'historique');
 wrap('bulkDeleteCours',async function(){return ''},'historique');
 return true}
function wireIndexIntegrity(){if(window.__TC_INDEX_INTEGRITY_WIRED__)return false;if(!window.IndicesApp)return false;window.__TC_INDEX_INTEGRITY_WIRED__=true;var app=window.IndicesApp;['addIndice','saveIndice','deleteIndice','bulkDeleteIndice'].forEach(function(name){if(typeof app[name]!=='function')return;var original=app[name];app[name]=async function(){var args=arguments,result=await original.apply(this,args);if(result===false)return result;var id=args[0]&&args[0].id||args[0],d=id?await dateFromIndiceId(id):'';if(d)await invalidateValidation(d,'indices',name);return result}});return true}
injectStyle();
var lastRoot=null,observer=null,scheduled=false;function observeSessionRoot(){var root=document.getElementById('tc-seances-globales');if(!root||root===lastRoot)return false;if(observer)observer.disconnect();lastRoot=root;observer=new MutationObserver(function(){if(scheduled)return;scheduled=true;queueMicrotask(function(){scheduled=false;decorateHolidayCells();wireCoursIntegrity();wireIndexIntegrity()})});observer.observe(root,{childList:true,subtree:true});decorateHolidayCells();wireCoursIntegrity();wireIndexIntegrity();return true}
function wait(){if(!observeSessionRoot())setTimeout(wait,250)}
wait();
window.TCSessionIntegrity={isHoliday:isHoliday,holidayName:function(v){return HOLIDAYS[cleanDate(v)]||''},invalidateValidation:invalidateValidation,decorateHolidayCells:decorateHolidayCells};
})();
