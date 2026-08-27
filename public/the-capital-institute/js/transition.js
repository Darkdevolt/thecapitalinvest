/* THE CAPITAL INSTITUTE — premium institutional entry transition */
(function(){
  'use strict';
  if(window.__TCI_TRANSITION__) return;
  window.__TCI_TRANSITION__=true;

  var fallbackTimer=null;
  var observer=null;
  var left=false;
  var EXIT_MS=720;
  var FALLBACK_MS=10000;

  function styles(){
    if(document.getElementById('tci-transition-style')) return;
    var s=document.createElement('style'); s.id='tci-transition-style';
    s.textContent=`
      .tci-transition{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#171310;color:#f4efe6;overflow:hidden;opacity:1;transition:opacity ${EXIT_MS}ms cubic-bezier(.22,1,.36,1);font-family:'DM Sans',Arial,sans-serif}
      .tci-transition.is-leaving{opacity:0;pointer-events:none}
      .tci-transition::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,rgba(224,193,118,.045),transparent 42%),linear-gradient(115deg,transparent 0%,rgba(224,193,118,.035) 48%,transparent 70%);transform:translateX(-100%);animation:tciSweep 2.6s .08s cubic-bezier(.2,.7,.2,1) forwards}
      .tci-transition-grid{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(rgba(224,193,118,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(224,193,118,.055) 1px,transparent 1px);background-size:88px 88px;mask-image:linear-gradient(to bottom,transparent,black 32%,black 68%,transparent)}
      .tci-transition-wordmark{position:absolute;top:9%;left:0;right:0;text-align:center;opacity:0;animation:tciWordmark .8s .05s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-wordmark span{font:500 9px/1 'DM Mono',monospace;letter-spacing:.42em;color:rgba(244,239,230,.55);padding-left:.42em}
      .tci-transition-market{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .tci-transition-market span{position:absolute;color:rgba(244,239,230,.13);font:500 9px/1 'DM Mono',monospace;letter-spacing:.26em;white-space:nowrap;opacity:0;animation:tciMarket 1.5s ease-out both}
      .tci-transition-market span:nth-child(1){transform:translate(-37vw,-23vh);animation-delay:.28s}.tci-transition-market span:nth-child(2){transform:translate(33vw,-16vh);animation-delay:.42s}.tci-transition-market span:nth-child(3){transform:translate(-34vw,24vh);animation-delay:.56s}.tci-transition-market span:nth-child(4){transform:translate(35vw,22vh);animation-delay:.7s}
      .tci-transition-chart{position:absolute;left:7%;right:7%;top:50%;height:22%;min-height:90px;transform:translateY(-50%);opacity:.95}
      .tci-transition-chart svg{width:100%;height:100%;overflow:visible}
      .tci-transition-chart .axis{stroke:rgba(224,193,118,.10);stroke-width:1}
      .tci-transition-chart .trend{fill:none;stroke:rgba(224,193,118,.76);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1000;stroke-dashoffset:1000;animation:tciTrend 1.55s .3s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-chart .trend-soft{fill:none;stroke:rgba(224,193,118,.16);stroke-width:1;vector-effect:non-scaling-stroke;stroke-dasharray:6 9;opacity:0;animation:tciSoft .9s .7s ease-out forwards}
      .tci-transition-chart .node{fill:#e0c176;opacity:0;animation:tciNode .7s 1.25s ease-out forwards;filter:drop-shadow(0 0 7px rgba(224,193,118,.55))}
      .tci-transition-copy{position:absolute;left:20px;right:20px;top:50%;transform:translateY(-50%);text-align:center;opacity:0;animation:tciCopy .9s .72s cubic-bezier(.22,1,.36,1) forwards}
      .tci-transition-kicker{display:block;color:#b8964e;font:500 9px/1 'DM Mono',monospace;letter-spacing:.34em;margin:0 0 14px;padding-left:.34em;text-transform:uppercase}
      .tci-transition-brand{display:block;color:#f4efe6;font:500 clamp(20px,3vw,30px)/1.1 'Playfair Display',Georgia,serif;letter-spacing:.04em}
      .tci-transition-title{display:block;margin-top:3px;color:#f4efe6;font:500 clamp(40px,6vw,72px)/.98 'Playfair Display',Georgia,serif;letter-spacing:-.035em}
      .tci-transition-title em{color:#e0c176;font-style:italic}
      .tci-transition-sub{display:block;margin-top:17px;color:rgba(244,239,230,.42);font:9px/1 'DM Mono',monospace;letter-spacing:.16em}
      .tci-transition-rule{width:58px;height:1px;margin:17px auto 0;background:rgba(224,193,118,.5);transform:scaleX(0);transform-origin:center;animation:tciRule .65s 1.15s cubic-bezier(.22,1,.36,1) forwards}
      body.tci-transition-lock{overflow:hidden!important}
      @keyframes tciSweep{to{transform:translateX(100%)}}
      @keyframes tciWordmark{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
      @keyframes tciMarket{from{opacity:0;letter-spacing:.38em}to{opacity:1;letter-spacing:.26em}}
      @keyframes tciTrend{to{stroke-dashoffset:0}}
      @keyframes tciSoft{to{opacity:1}}
      @keyframes tciNode{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
      @keyframes tciCopy{from{opacity:0;transform:translateY(calc(-50% + 13px))}to{opacity:1;transform:translateY(-50%)}}
      @keyframes tciRule{to{transform:scaleX(1)}}
      @media(max-width:640px){
        .tci-transition-chart{left:2%;right:2%;height:18%;min-height:70px}
        .tci-transition-wordmark{top:8%}
        .tci-transition-market span{font-size:8px}
        .tci-transition-market span:nth-child(1){transform:translate(-29vw,-22vh)}.tci-transition-market span:nth-child(2){transform:translate(25vw,-16vh)}.tci-transition-market span:nth-child(3){transform:translate(-27vw,21vh)}.tci-transition-market span:nth-child(4){transform:translate(27vw,20vh)}
        .tci-transition-sub{font-size:8px;letter-spacing:.11em}
      }
      @media(prefers-reduced-motion:reduce){
        .tci-transition,.tci-transition *,.tci-transition::before{animation:none!important;transition:none!important}
        .tci-transition-wordmark,.tci-transition-copy{opacity:1}
        .tci-transition-chart .trend{stroke-dashoffset:0}
        .tci-transition-chart .trend-soft,.tci-transition-chart .node{opacity:1}
        .tci-transition-rule{transform:scaleX(1)}
      }
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
    document.body.classList.remove('tci-transition-lock');
    var d=document.querySelector('.tci-transition');
    if(!d)return;
    d.classList.add('is-leaving');
    setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},EXIT_MS+80);
  }

  function instituteReady(){
    var host=document.getElementById('tciVue');
    return !!(host&&host.children&&host.children.length);
  }

  function watchReady(){
    var host=document.getElementById('tciVue');
    if(!host){fallbackTimer=setTimeout(leave,FALLBACK_MS);return;}
    if(instituteReady()){requestAnimationFrame(leave);return;}
    observer=new MutationObserver(function(){
      if(instituteReady())requestAnimationFrame(leave);
    });
    observer.observe(host,{childList:true,subtree:true});
    fallbackTimer=setTimeout(leave,FALLBACK_MS);
  }

  function show(){
    if(document.querySelector('.tci-transition'))return;
    styles();
    document.body.classList.add('tci-transition-lock');
    var d=document.createElement('div');
    d.className='tci-transition';
    d.setAttribute('aria-hidden','true');
    d.innerHTML='<div class="tci-transition-grid"></div>'+
      '<div class="tci-transition-wordmark"><span>THE · CAPITAL</span></div>'+
      '<div class="tci-transition-market"><span>BRVM</span><span>UEMOA</span><span>MARKETS</span><span>CAPITAL</span></div>'+
      '<div class="tci-transition-chart" aria-hidden="true"><svg viewBox="0 0 1000 160" preserveAspectRatio="none">'+
        '<path class="axis" d="M0 80H1000"/>'+
        '<path class="trend-soft" d="M0 103 C85 99 105 112 165 92 S245 84 300 98 S370 55 438 72 S515 89 565 60 S635 74 690 45 S755 61 820 36 S900 48 1000 20"/>'+
        '<path class="trend" d="M0 112 C72 108 105 120 165 94 S245 86 300 98 S370 57 438 73 S515 91 565 59 S635 76 690 45 S755 63 820 35 S900 49 1000 18"/>'+
        '<circle class="node" cx="820" cy="35" r="3.2"/>'+
      '</svg></div>'+
      '<div class="tci-transition-copy">'+
        '<span class="tci-transition-kicker">THE CAPITAL</span>'+ 
        '<span class="tci-transition-brand">The Capital</span>'+ 
        '<span class="tci-transition-title">Institute<em>.</em></span>'+ 
        '<span class="tci-transition-sub">MARCHÉS · ÉDUCATION · BRVM</span>'+ 
        '<div class="tci-transition-rule"></div>'+ 
      '</div>';
    document.body.appendChild(d);
    watchReady();
  }

  function leaveThen(url){
    styles();
    var d=document.querySelector('.tci-transition');
    if(!d){show();d=document.querySelector('.tci-transition');}
    if(!d)return window.location.href=url;
    d.classList.remove('is-leaving');d.style.opacity='1';
    var brand=d.querySelector('.tci-transition-brand');if(brand)brand.textContent='The Capital';
    var title=d.querySelector('.tci-transition-title');if(title)title.innerHTML='Retour <em>vers Capital.</em>';
    var sub=d.querySelector('.tci-transition-sub');if(sub)sub.textContent='RETOUR À VOTRE ESPACE D’INVESTISSEMENT';
    document.body.classList.add('tci-transition-lock');
    setTimeout(function(){window.location.href=url},1050);
  }

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('.tci-capital-link');
    if(a){e.preventDefault();leaveThen(a.href);}
  });

  show();
})();
