// THE CAPITAL — Navigation Guard
(function () {
  'use strict';
  if (window.__TC_NAV_GUARD__) return;
  window.__TC_NAV_GUARD__ = true;

  var LABELS = {
    overview: "Vue d’ensemble", titres: "Titres BRVM", marche: "Marché BRVM", boc: "BOC / Emprunts",
    analyses: "Recommandations", "analyse-technique": "Analyse technique", "analyse-fondamentale": "Analyse fondamentale",
    screener: "Screener", portefeuille: "Portefeuille", alertes: "Alertes", financials: "États financiers",
    publications: "Calendrier", formation: "Formation", fiche: "Fiche valeur",
    "analyse-detail": "Détail de l’analyse", "financials-detail": "Détail financier"
  };
  var STORAGE = '__tc_navigation_stack_v2__';
  var suppressNext = false, wrapped = false;

  function rawCurrent() {
    if (typeof window.parseHashFromUrl === 'function') { try { return window.parseHashFromUrl(); } catch (e) {} }
    var h = location.hash || '';
    if (h.indexOf('#fiche=') === 0) return 'fiche';
    if (h.indexOf('#analyse=') === 0) return 'analyse-detail';
    if (h.indexOf('#financials=') === 0) return 'financials-detail';
    var key = h.replace(/^#/, '').split('?')[0];
    return LABELS[key] ? key : 'overview';
  }
  function current(){ return rawCurrent(); }
  function label(v){ return LABELS[v] || 'The Capital'; }
  function readStack(){ try { var x=JSON.parse(sessionStorage.getItem(STORAGE)||'[]'); return Array.isArray(x)?x:[]; } catch(e){return [];} }
  function writeStack(s){ try{sessionStorage.setItem(STORAGE,JSON.stringify(s.slice(-30)));}catch(e){} }
  function same(a,b){return a&&b&&a===b;}

  function ensureStyle(){
    if(document.getElementById('tc-nav-guard-style'))return;
    var s=document.createElement('style');s.id='tc-nav-guard-style';
    s.textContent=''
      +'.tc-nav-context{display:flex!important;align-items:center;gap:8px;margin:0 0 18px!important;padding:8px 0 10px!important;min-height:32px;box-sizing:border-box;border-bottom:1px solid var(--border2,rgba(184,150,78,.08));position:relative!important;z-index:5!important;clear:both}'
      +'.tc-nav-trail{font:500 11px var(--sans,Arial);color:var(--dim,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +'.tc-nav-trail strong{color:var(--cream,#f5f0e8);font-weight:500}'
      +'.tc-nav-home{border:0;background:none;color:var(--dim,#777);font-size:11px;cursor:pointer;padding:0}'
      +'.tc-nav-home:hover{color:var(--gold,#b8964e)}'
      +'.main{position:relative;z-index:1;padding-top:1px!important}'
      +'[data-tc-legacy-back]{display:none!important}';
    document.head.appendChild(s);
  }

  // Supprime uniquement les vrais contrôles Retour, jamais leur conteneur.
  // L'ancienne implémentation parcourait div/span et pouvait supprimer un
  // bloc parent contenant à la fois le bouton Retour et des liens de page.
  function removeLegacyBackControls(){
    var nodes=document.querySelectorAll('button,a,[role="button"]');
    nodes.forEach(function(el){
      if(el.id==='tc-nav-context'||el.closest('#tc-nav-context'))return;
      var text=(el.textContent||'').replace(/\s+/g,' ').trim();
      var isBack = text==='← Retour' || text==='Retour' || /^←\s*Retour(?:\s*)$/.test(text);
      if(isBack){
        el.setAttribute('data-tc-legacy-back','1');
        el.remove();
      }
    });
  }

  function fallbackParent(v){
    if(v==='fiche')return'titres';
    if(v==='analyse-detail')return'analyses';
    if(v==='financials-detail')return'financials';
    return'overview';
  }
  function navigate(target,fromBack){
    if(!target)target='overview';
    var before=current();
    if(!fromBack&&!same(before,target)){var stack=readStack();if(!same(stack[stack.length-1],before))stack.push(before);writeStack(stack);}
    suppressNext=!!fromBack;
    if(typeof window.nav==='function')window.nav(target);else location.hash=target;
  }
  function goBack(){
    var stack=readStack(),target=stack.pop();writeStack(stack);
    if(!target||target===current())target=fallbackParent(current());
    navigate(target,true);
  }
  function renderContext(){
    ensureStyle();removeLegacyBackControls();
    var main=document.querySelector('.main');if(!main)return;
    var active=document.querySelector('.view.active');if(!active)return;
    var v=current(),existing=document.getElementById('tc-nav-context');if(existing)existing.remove();
    if(v==='overview')return;
    var stack=readStack(),parent=stack.length?stack[stack.length-1]:fallbackParent(v);if(parent===v)parent=fallbackParent(v);
    var box=document.createElement('div');box.id='tc-nav-context';box.className='tc-nav-context';
    var home=document.createElement('button');home.type='button';home.className='tc-nav-home';home.textContent='Accueil';
    home.addEventListener('click',function(){writeStack([]);navigate('overview',true);});
    var trail=document.createElement('div');trail.className='tc-nav-trail';trail.innerHTML='<span>'+label(parent)+'</span>  /  <strong>'+label(v)+'</strong>';
    box.appendChild(home);box.appendChild(trail);main.insertBefore(box,main.firstChild);
  }
  function wrapNav(){
    if(wrapped||typeof window.nav!=='function')return false;
    var original=window.nav;window.nav=function(target){var before=current();if(target&&target!==before&&!suppressNext){var stack=readStack();if(stack[stack.length-1]!==before){stack.push(before);writeStack(stack);}}suppressNext=false;var r=original.apply(this,arguments);setTimeout(renderContext,0);return r;};wrapped=true;return true;
  }
  window.tcNavigation={back:goBack,navigate:navigate,render:renderContext,parentFor:fallbackParent};

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';
    if(!href||/^(https?:|mailto:|tel:|javascript:)/i.test(href))return;
    if(href.indexOf('app.html')===0&&href.indexOf('#')!==-1){e.preventDefault();navigate(href.split('#')[1],false);}
  },true);
  window.addEventListener('hashchange',function(){setTimeout(renderContext,0);});
  window.addEventListener('popstate',function(){setTimeout(renderContext,0);});
  document.addEventListener('DOMContentLoaded',function(){
    var tries=0,timer=setInterval(function(){tries++;wrapNav();renderContext();if(wrapped||tries>30)clearInterval(timer);},100);
    var observer=new MutationObserver(function(){removeLegacyBackControls();});
    observer.observe(document.body,{childList:true,subtree:true});
  });
  setTimeout(function(){wrapNav();renderContext();},100);
})();
