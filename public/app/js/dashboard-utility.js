/* THE CAPITAL — Dashboard utility layer
   Presentation-only helpers. Reuses the existing TCTheme engine; no API,
   auth, market-data or navigation business logic is introduced here. */
(function(){
  'use strict';
  if(window.__TC_DASHBOARD_UTILITY__) return;
  window.__TC_DASHBOARD_UTILITY__=true;

  function addThemeToggle(){
    var host=document.querySelector('.topnav-right');
    if(!host || document.getElementById('tcHeaderTheme')) return;
    var button=document.createElement('button');
    button.type='button';
    button.id='tcHeaderTheme';
    button.className='tc-header-theme';
    button.setAttribute('aria-label','Changer de thème');
    button.setAttribute('title','Basculer entre le thème sombre et le thème clair');
    button.innerHTML='<span aria-hidden="true">☼</span><small>Clair</small>';
    button.addEventListener('click',function(){
      if(window.TCTheme) window.TCTheme.toggle();
    });
    var user=document.getElementById('topnavUser');
    host.insertBefore(button,user||null);
    syncThemeToggle();
  }

  function syncThemeToggle(){
    var button=document.getElementById('tcHeaderTheme');
    if(!button) return;
    var light=document.documentElement.dataset.theme==='light';
    button.querySelector('span').textContent=light?'☾':'☼';
    button.querySelector('small').textContent=light?'Sombre':'Clair';
    button.setAttribute('aria-label',light?'Passer au thème sombre':'Passer au thème clair');
  }

  function addInvestorBriefing(){
    var host=document.getElementById('tciActivity');
    if(!host || host.children.length) return;
    host.innerHTML='<section class="tc-investor-brief" aria-label="Repères investisseur">'
      +'<div class="tc-investor-brief-head"><div><span class="tc-investor-kicker">INTELLIGENCE INVESTISSEUR</span><h3>Les 4 points à vérifier avant une décision</h3></div><span class="tc-investor-live">PRÊT À ANALYSER</span></div>'
      +'<div class="tc-investor-grid">'
      +'<div><b>01 · Prix</b><span>Comparer le cours à son historique et à sa tendance.</span></div>'
      +'<div><b>02 · Liquidité</b><span>Vérifier les volumes et la facilité d’exécution.</span></div>'
      +'<div><b>03 · Fondamentaux</b><span>Regarder résultats, marges, dette et valorisation.</span></div>'
      +'<div><b>04 · Catalyseurs</b><span>Surveiller dividendes, publications et annonces.</span></div>'
      +'</div>'
      +'<div class="tc-investor-brief-foot"><span>Les données de marché remplaceront automatiquement ce bloc dès qu’elles sont disponibles.</span><button type="button" onclick="nav(\'screener\')">Ouvrir le Screener →</button></div>'
      +'</section>';
  }

  function boot(){
    addThemeToggle();
    setTimeout(addInvestorBriefing,250);
    setTimeout(addInvestorBriefing,800);
    syncThemeToggle();
  }

  window.addEventListener('tc:theme-change',syncThemeToggle);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
