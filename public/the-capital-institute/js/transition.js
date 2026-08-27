/* THE CAPITAL INSTITUTE — premium product transition */
(function(){
  'use strict';
  if(window.__TCI_TRANSITION__) return;
  window.__TCI_TRANSITION__=true;

  var fallbackTimer=null;
  var observer=null;
  var left=false;

  function styles(){
    if(document.getElementById('tci-transition-style')) return;
    var s=document.createElement('style'); s.id='tci-transition-style';
    s.textContent=`
      .tci-transition{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#090806;overflow:hidden;opacity:1;transition:opacity .55s cubic-bezier(.22,1,.36,1);}
      .tci-transition.is-leaving{opacity:0;pointer-events:none}
      .tci-transition-bg{position:absolute;inset:-20%;background:radial-gradient(circle at 50% 48%,rgba(224,193,118,.16),transparent 18%),radial-gradient(circle at 50% 50%,rgba(184,150,78,.08),transparent 42%);animation:tciPulse 2.2s ease-in-out infinite;}
      .tci-transition-ring{position:absolute;width:min(62vw,620px);aspect-ratio:1;border:1px solid rgba(224,193,118,.18);border-radius:50%;animation:tciRing 1.8s cubic-bezier(.22,1,.36,1) forwards;}
      .tci-transition-ring:before,.tci-transition-ring:after{content:'';position:absolute;inset:9%;border:1px solid rgba(184,150,78,.12);border-radius:50%;}
      .tci-transition-ring:after{inset:20%;border-color:rgba(224,193,118,.10)}
      .tci-transition-orbit{position:absolute;width:min(76vw,760px);height:min(23vw,230px);border:1px solid rgba(224,193,118,.10);border-radius:50%;transform:rotate(-18deg);animation:tciOrbit 1.7s ease-out forwards;}
      .tci-transition-orbit:after{content:'';position:absolute;width:6px;height:6px;border-radius:50%;background:#e0c176;box-shadow:0 0 24px 7px rgba(224,193,118,.42);left:12%;top:50%;}
      .tci-transition-core{position:relative;width:82px;height:82px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 34% 28%,#f3d98f,#b8893f 48%,#39260e 76%,#090806 100%);box-shadow:0 0 70px rgba(224,193,118,.18),inset -14px -16px 24px rgba(0,0,0,.48);animation:tciCore 1.4s cubic-bezier(.22,1,.36,1) both;}
      .tci-transition-core:before{content:'✦';color:#fff3c8;font-size:22px;animation:tciStar 1.5s ease both;}
      .tci-transition-copy{position:absolute;bottom:13%;left:0;right:0;text-align:center;animation:tciCopy .9s .2s cubic-bezier(.22,1,.36,1) both;}
      .tci-transition-kicker{display:block;color:#b8964e;font:500 9px/1 'DM Mono',monospace;letter-spacing:.28em;text-transform:uppercase;margin-bottom:13px;}
      .tci-transition-title{display:block;color:#f4efe6;font:600 clamp(30px,5vw,58px)/1 'Playfair Display',Georgia,serif;letter-spacing:-.025em;}
      .tci-transition-title em{color:#e0c176;font-style:italic;}
      .tci-transition-sub{display:block;margin-top:12px;color:rgba(244,239,230,.48);font:10px 'DM Mono',monospace;letter-spacing:.08em;}
      body.tci-transition-lock{overflow:hidden!important;}
      @keyframes tciPulse{0%,100%{transform:scale(.96);opacity:.65}50%{transform:scale(1.04);opacity:1}}
      @keyframes tciRing{0%{transform:scale(.35);opacity:0}45%{opacity:1}100%{transform:scale(1);opacity:1}}
      @keyframes tciOrbit{0%{transform:rotate(-18deg) scale(.55);opacity:0}100%{transform:rotate(-18deg) scale(1);opacity:1}}
      @keyframes tciCore{0%{transform:scale(.1);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
      @keyframes tciStar{0%{transform:rotate(-40deg) scale(0);opacity:0}70%{transform:rotate(10deg) scale(1.2)}100%{transform:rotate(0) scale(1);opacity:1}}
      @keyframes tciCopy{0%{transform:translateY(18px);opacity:0}100%{transform:translateY(0);opacity:1}}
      @media(prefers-reduced-motion:reduce){.tci-transition *{animation:none!important;transition:none!important}.tci-transition{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function cleanup(){
    if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null;}
    if(observer){observer.disconnect();observer=null;}
  }

  function leave(){
    if(left)return;
    left=true;
    cleanup();
    var d=document.querySelector('.tci-transition');
    document.body.classList.remove('tci-transition-lock');
    if(!d)return;
    d.classList.add('is-leaving');
    setTimeout(function(){if(d&&d.parentNode)d.remove()},650);
  }

  function instituteReady(){
    var host=document.getElementById('tciVue');
    return !!(host && host.children && host.children.length);
  }

  function watchReady(){
    var host=document.getElementById('tciVue');
    if(!host){
      fallbackTimer=setTimeout(leave,10000);
      return;
    }
    if(instituteReady()){
      requestAnimationFrame(leave);
      return;
    }
    observer=new MutationObserver(function(){
      if(instituteReady()) requestAnimationFrame(leave);
    });
    observer.observe(host,{childList:true,subtree:true});
    fallbackTimer=setTimeout(leave,10000);
  }

  function show(){
    if(document.querySelector('.tci-transition'))return;
    styles();
    document.body.classList.add('tci-transition-lock');
    var d=document.createElement('div'); d.className='tci-transition'; d.setAttribute('aria-label','Ouverture de The Capital Institute');
    d.innerHTML='<div class="tci-transition-bg"></div><div class="tci-transition-ring"></div><div class="tci-transition-orbit"></div><div class="tci-transition-core"></div><div class="tci-transition-copy"><span class="tci-transition-kicker">THE CAPITAL</span><span class="tci-transition-title">Bienvenue dans <em>Institute.</em></span><span class="tci-transition-sub">PRÉPARATION DE VOTRE ESPACE D’APPRENTISSAGE</span></div>';
    document.body.appendChild(d);
    watchReady();
  }

  function leaveThen(url){
    styles();
    var d=document.querySelector('.tci-transition');
    if(!d){show();d=document.querySelector('.tci-transition');}
    if(!d)return window.location.href=url;
    d.classList.remove('is-leaving'); d.style.opacity='1';
    var title=d.querySelector('.tci-transition-title'); if(title)title.innerHTML='Retour vers <em>The Capital.</em>';
    var sub=d.querySelector('.tci-transition-sub'); if(sub)sub.textContent='RETOUR À VOTRE ESPACE D’INVESTISSEMENT';
    document.body.classList.add('tci-transition-lock');
    setTimeout(function(){window.location.href=url},1050);
  }

  document.addEventListener('click',function(e){
    var a=e.target.closest('.tci-capital-link');
    if(a){e.preventDefault();leaveThen(a.href);}
  });

  function boot(){
    show();
    setTimeout(function(){
      var a=document.querySelector('.tci-capital-link');
      if(a)a.setAttribute('aria-label','Retour vers The Capital');
    },500);
  }

  // La transition reste synchrone pour pouvoir s'afficher avant les scripts defer.
  // Les ressources de l'Institute sont chargées et exécutées indépendamment.
  boot();
})();
