/* The Capital — shell hardening / defensive UX */
(function(w){
'use strict';
if(w.__TC_SHELL_OVERHAUL__)return;w.__TC_SHELL_OVERHAUL__=true;
var ICONS={overview:'M3 11.5 12 4l9 7.5',titres:'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',marche:'M3 18h18 M5 15V9 M10 15V5 M15 15v-7 M20 15V6',boc:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',analyses:'M4 19 9 13l4 3 7-10',comparison:'M7 7h11 M12 3l6 4-6 4 M17 17H6 M12 13l-6 4 6 4','dividend-screener':'M12 3v18 M7 7h10 M7 17h10','analyse-technique':'M4 18 9 13l3 3 8-9','analyse-fondamentale':'M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5',screener:'M4 6h16 M4 12h11 M4 18h7 M18 12v6 M15 15h6',portefeuille:'M4 7h16v12H4z M8 7V5h8v2',alertes:'M6 18h12 M8 18V9a4 4 0 0 1 8 0v9 M10 21h4',financials:'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h8',publications:'M5 5h14v14H5z M8 3v4 M16 3v4 M8 11h8 M8 15h5',formation:'M4 5h16v12H4z M8 21h8 M12 17v4',logout:'M10 6l6 6-6 6 M16 12H4 M19 5v14',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 12h2 M18 12h2 M12 4v2 M12 18v2'};
function svg(p){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+p+'"></path></svg>'}
function icon(el,key,cls){if(!el||!ICONS[key])return;el.classList.add(cls||'tc-nav-icon');el.setAttribute('aria-hidden','true');el.innerHTML=svg(ICONS[key])}
function normalize(){document.querySelectorAll('[data-route]').forEach(function(el){var r=el.getAttribute('data-route');if(!r)return;if(!el.id)el.id='route-'+r;el.setAttribute('data-route-control','true');var holder=el.querySelector('.icon');if(holder)icon(holder,r)});document.querySelectorAll('.nav-dropdown-btn').forEach(function(el){var r=el.getAttribute('data-route'),d=el.getAttribute('data-dropdown'),k=r||(d?d.replace(/^dd-/,''):''),s=el.querySelector(':scope > span:first-child');if(s)icon(s,k)});document.querySelectorAll('[data-action="logout"]').forEach(function(el){if(el.querySelector('.tc-ui-icon'))return;var s=document.createElement('span');s.className='tc-ui-icon';s.setAttribute('aria-hidden','true');s.innerHTML=svg(ICONS.logout);el.textContent='';el.appendChild(s);if(el.classList.contains('logout-button'))el.appendChild(document.createTextNode('Déconnexion'))});var a=document.querySelector('#adminLink a');if(a&&!a.querySelector('.tc-ui-icon')){var s=document.createElement('span');s.className='tc-ui-icon';s.setAttribute('aria-hidden','true');s.innerHTML=svg(ICONS.settings);a.replaceChildren(s,document.createTextNode('Administration'))}}
function interpretInline(code,el){
  var s=String(code||'').trim(),m;
  m=s.match(/(?:window\.)?nav\(\s*['"]([^'"]+)['"](?:\s*,\s*(true|false))?\s*\)/); if(m){ return {type:'nav',id:m[1],noHash:m[2]==='true'}; }
  m=s.match(/(?:window\.)?openFinDetail\(\s*['"]([^'"]+)['"]\s*\)/); if(m){ return {type:'fin',ticker:m[1]}; }
  m=s.match(/(?:window\.)?openFiche\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"])?[^)]*\)/); if(m){ return {type:'fiche',ticker:m[1],from:m[2]||undefined}; }
  m=s.match(/(?:window\.)?sortTable\(\s*['"]([^'"]+)['"]\s*,\s*(\d+)\s*\)/); if(m){ return {type:'sort',table:m[1],column:Number(m[2])}; }
  m=s.match(/(?:window\.)?toggleAlert\(\s*['"]([^'"]+)['"]\s*\)/); if(m){ return {type:'toggle-alert',id:m[1]}; }
  m=s.match(/(?:window\.)?removeAlert\(\s*['"]([^'"]+)['"]\s*\)/); if(m){ return {type:'remove-alert',id:m[1]}; }
  return null;
}
function runInlineAction(a){
  if(!a)return false;
  try{
    if(a.type==='nav'&&typeof w.nav==='function')return !!w.nav(a.id,a.noHash);
    if(a.type==='fin'&&typeof w.openFinDetail==='function'){w.openFinDetail(a.ticker);return true;}
    if(a.type==='fiche'&&typeof w.openFiche==='function'){w.openFiche(a.ticker,a.from);return true;}
    if(a.type==='sort'&&typeof w.sortTable==='function'){w.sortTable(a.table,a.column);return true;}
    if(a.type==='toggle-alert'&&typeof w.toggleAlert==='function'){w.toggleAlert(a.id);return true;}
    if(a.type==='remove-alert'&&typeof w.removeAlert==='function'){w.removeAlert(a.id);return true;}
  }catch(e){console.warn('[SHELL] Contrôle interactif:',e)}
  return false;
}
function inlineControls(){
  if(w.__TC_INLINE_CONTROLS__)return;
  w.__TC_INLINE_CONTROLS__=true;
  function strip(root){
    var scope=root&&root.querySelectorAll?root:document;
    scope.querySelectorAll('[onclick]').forEach(function(el){
      var a=interpretInline(el.getAttribute('onclick'),el);
      if(!a)return;
      el.dataset.tcInlineAction=JSON.stringify(a);
      el.removeAttribute('onclick');
      if((a.type==='nav'||a.type==='fiche'||a.type==='fin'||a.type==='sort')&&el.tagName!=='BUTTON'&&el.tagName!=='A'){
        el.setAttribute('role','button');
        el.setAttribute('tabindex','0');
      }
    });
  }
  document.addEventListener('click',function(event){
    var el=event.target.closest?.('[data-tc-inline-action],[onclick]');
    if(!el)return;
    var raw=el.getAttribute('data-tc-inline-action');
    var action=null;
    try{action=raw?JSON.parse(raw):interpretInline(el.getAttribute('onclick'),el)}catch(e){action=null}
    if(!action)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runInlineAction(action);
  },true);
  document.addEventListener('keydown',function(event){
    if(event.key!=='Enter'&&event.key!==' ')return;
    var el=event.target.closest?.('[data-tc-inline-action]');
    if(!el)return;
    var raw=el.getAttribute('data-tc-inline-action'),action=null;
    try{action=raw?JSON.parse(raw):null}catch(e){}
    if(!action)return;
    event.preventDefault();event.stopImmediatePropagation();runInlineAction(action);
  },true);
  strip(document);
  new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1)strip(n)})})}).observe(document.documentElement,{subtree:true,childList:true});
}
function market(){var host=document.getElementById('headerMarketStatus'),label=document.getElementById('headerMarketStatusText');if(!host||!label)return;var s=w.TC_MARKET_UX&&typeof w.TC_MARKET_UX.getStatus==='function'?w.TC_MARKET_UX.getStatus():null;if(!s){label.textContent='Marché';return}var m={live:'Marché ouvert',preopen:'Pré-ouverture',preclose:'Pré-clôture',closed:'Marché fermé'};label.textContent=m[s.code]||s.label||'Marché';host.classList.toggle('tc-open',s.code!=='closed');host.classList.toggle('tc-closed',s.code==='closed');host.title='État de la séance BRVM'}
function stateHosts(){['tciPortfolio','tciBreadth','tciActivity','tciWatch','topMovers','recentActivity'].forEach(function(id){var el=document.getElementById(id);if(!el||el.dataset.tcStateBound==='1')return;el.dataset.tcStateBound='1';el.setAttribute('data-tc-state','loading');new MutationObserver(function(){var text=(el.textContent||'').trim(),has=!!el.querySelector('table,tbody,tr,canvas,.card,[data-rendered]');if(!text&&!has)el.setAttribute('data-tc-state','loading');else if(/erreur|impossible|indisponible/i.test(text))el.setAttribute('data-tc-state','error');else if(/aucune donnée|aucun titre|aucune valeur/i.test(text))el.setAttribute('data-tc-state','empty');else el.setAttribute('data-tc-state','ready')}).observe(el,{subtree:true,childList:true,characterData:true})})}
function searchA11y(){var i=document.getElementById('globalSearchInput'),r=document.getElementById('globalSearchResults');if(!i||!r||i.dataset.tcShell==='1')return;i.dataset.tcShell='1';i.setAttribute('aria-autocomplete','list');i.setAttribute('enterkeyhint','search');new MutationObserver(function(){r.querySelectorAll('.gsr-item').forEach(function(x){x.setAttribute('role','option');x.setAttribute('tabindex','-1')})}).observe(r,{subtree:true,childList:true})}
function sessionWatch(){if(w.__TC_SESSION_WATCH__)return;w.__TC_SESSION_WATCH__=true;setInterval(function(){if(document.visibilityState==='hidden')return;var s=w.tcSession,t=s&&s.access_token;if(!t)return;try{var p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';var x=JSON.parse(atob(p));if(!x.exp||x.exp*1000<=Date.now()){try{localStorage.removeItem('tc_session')}catch(e){}if(location.pathname!=='/login.html')location.replace('/login.html?expired=1')}}catch(e){}},30000)}
function boot(){normalize();inlineControls();searchA11y();stateHosts();market();sessionWatch();if(w.TCHeader&&typeof w.TCHeader.installAccountMenu==='function')w.TCHeader.installAccountMenu();setInterval(market,5000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();w.TCShell={boot:boot,refresh:normalize}}
)(window);
