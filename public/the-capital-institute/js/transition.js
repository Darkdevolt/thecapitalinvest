/* THE CAPITAL INSTITUTE — institutional market-opening transition */
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
      .tci-transition{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#171310;overflow:hidden;opacity:1;transition:opacity .7s cubic-bezier(.22,1,.36,1);font-family:'DM Sans',Arial,sans-serif}
      .tci-transition.is-leaving{opacity:0;pointer-events:none}
      .tci-transition::before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 0%,rgba(224,193,118,.035) 48%,transparent 70%);transform:translateX(-100%);animation:tciSweep 2.5s .15s cubic-bezier(.2,.7,.2,1) forwards}
      .tci-transition-grid{position:absolute;inset:0;opacity:.16;background-image:linear-gradient(rgba(224,193,118,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(224,193,118,.06) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,transparent,black 35%,black 65%,transparent)}
      .tci-transition-market{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.42;overflow:hidden}
      .tci-transition-market span{position:absolute;color:rgba(244,239,230,.16);font:500 9px/1 'DM Mono',monospace;letter-spacing:.24em;white-space:nowrap;animation:tciMarket 2.4s ease-out both}
      .tci-transition-market span:nth-child(1){transform:translate(-38vw,-24vh);animation-delay:.05s}.tci-transition-market span:nth-child(2){transform:translate(31vw,-17vh);animation-delay:.18s}.tci-transition-market span:nth-child(3){transform:translate(-35vw,25vh);animation-delay:.3s}.tci-transition-market span:nth-child(4){transform:translate(34vw,23vh);animation-delay:.42s}
      .tci-transition-line{position:absolute;left:8%;right:8%;top:50%;height:1px;background:linear-gradient(90deg,transparent,rgba(224,193,118,.12) 12%,rgba(224,193,118,.72) 50%,rgba(224,193,118,.12) 88%,transparent);transform:scaleX(0);transform-origin:center;animation:tciLine 1.25s .35s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-line::after{content:'';position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:#e0c176;box-shadow:0 0 22px rgba(224,193,118,.7);transform:translate(-50%,-50%);animation:tciDot 1.7s .55s ease-in-out both}
      .tci-transition-mark{position:relative;display:flex;align-items:center;justify-content:center;width:76px;height:76px;border:1px solid rgba(224,193,118,.42);transform:rotate(45deg);opacity:0;animation:tciMarkIn .8s .25s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-mark::before{content:'';width:34px;height:34px;border:1px solid rgba(224,193,118,.58);background:radial-gradient(circle at 35% 30%,rgba(243,217,143,.95),rgba(184,137,63,.45) 48%,rgba(23,19,16,0) 72%);box-shadow:0 0 45px rgba(224,193,118,.12)}
      .tci-transition-mark::after{content:'✦';position:absolute;color:#f7e8bc;font-size:14px;transform:rotate(-45deg)}
      .tci-transition-copy{position:absolute;left:0;right:0;bottom:13%;text-align:center;opacity:0;animation:tciCopy .85s .55s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-kicker{display:block;color:#b8964e;font:500 9px/1 'DM Mono',monospace;letter-spacing:.34em;margin-bottom:15px}
      .tci-transition-title{display:block;color:#f4efe6;font:500 clamp(34px,5vw,62px)/1.04 'Playfair Display',Georgia,serif;letter-spacing:-.025em}
      .tci-transition-title em{color:#e0c176;font-style:italic}
      .tci-transition-sub{display:block;margin-top:14px;color:rgba(244,239,230,.42);font:9px/1 'DM Mono',monospace;letter-spacing:.13em}
      body.tci-transition-lock{overflow:hidden!important}
      @keyframes tciSweep{to{transform:translateX(100%)}}
      @keyframes tciLine{to{transform:scaleX(1)}}
      @keyframes tciDot{0%{transform:translate(-50%,-50%) scale(0);opacity:0}35%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(22vw,-50%) scale(.7);opacity:.15}}
      @keyframes tciMarkIn{0%{transform:rotate(45deg) scale(.65);opacity:0}100%{transform:rotate(45deg) scale(1);opacity:1}}
      @keyframes tciCopy{0%{transform:translateY(15px);opacity:0}100%{transform:translateY(0);opacity:1}}
      @keyframes tciMarket{0%{opacity:0;letter-spacing:.38em}100%{opacity:1;letter-spacing:.24em}}
      @media(prefers-reduced-motion:reduce){.tci-transition *,.tci-transition::before{animation:none!important;transition:none!important}.tci-transition{transition:none}}
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
    setTimeout(function(){if(d&&d.parentNode)d.remove()},800);
  }

  function instituteReady(){
    var host=document.getElementById('tciVue');
    return !!(host && host.children && host.children.length);
  }

  function watchReady(){
    var host=document.getElementById('tciVue');
    if(!host){fallbackTimer=setTimeout(leave,10000);return;}
    if(instituteReady()){requestAnimationFrame(leave);return;}
    observer=new MutationObserver(function(){if(instituteReady())requestAnimationFrame(leave)});
    observer.observe(host,{childList:true,subtree:true});
    fallbackTimer=setTimeout(leave,10000);
  }

  function show(){
    if(document.querySelector('.tci-transition'))return;
    styles();
    document.body.classList.add('tci-transition-lock');
    var d=document.createElement('div');
    d.className='tci-transition';
    d.setAttribute('aria-label','Ouverture de The Capital Institute');
    d.innerHTML='<div class="tci-transition-grid"></div><div class="tci-transition-market"><span>BRVM</span><span>UEMOA</span><span>MARKETS</span><span>CAPITAL</span></div><div class="tci-transition-line"></div><div class="tci-transition-mark"></div><div class="tci-transition-copy"><span class="tci-transition-kicker">THE CAPITAL</span><span class="tci-transition-title">Institute<span style="color:#e0c176">.</span></span><span class="tci-transition-sub">MARCHÉS · ÉDUCATION · BRVM</span></div>';
    document.body.appendChild(d);
    watchReady();
  }

  function leaveThen(url){
    styles();
    var d=document.querySelector('.tci-transition');
    if(!d){show();d=document.querySelector('.tci-transition');}
    if(!d)return window.location.href=url;
    d.classList.remove('is-leaving');d.style.opacity='1';
    var title=d.querySelector('.tci-transition-title');if(title)title.innerHTML='Retour vers <em>The Capital.</em>';
    var sub=d.querySelector('.tci-transition-sub');if(sub)sub.textContent='RETOUR À VOTRE ESPACE D’INVESTISSEMENT';
    document.body.classList.add('tci-transition-lock');
    setTimeout(function(){window.location.href=url},1050);
  }

  document.addEventListener('click',function(e){
    var a=e.target.closest('.tci-capital-link');
    if(a){e.preventDefault();leaveThen(a.href);}
  });

  function boot(){show();}
  boot();
})();
