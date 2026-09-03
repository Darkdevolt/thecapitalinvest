/* THE CAPITAL — Header polish / Institute transition.
 *
 * The header navigation itself is static. Older versions inserted an Institute
 * link asynchronously after load, which changed the width of the right control
 * rail and could move the header between renders. The link insertion and its
 * global observer are intentionally removed; the existing navigation remains
 * responsible for stable header geometry.
 */
(function(){
  'use strict';
  if(window.__TC_HEADER_POLISH__) return;
  window.__TC_HEADER_POLISH__=true;

  function addTransitionStyles(){
    if(document.getElementById('tc-institute-transition-css')) return;
    var s=document.createElement('style');
    s.id='tc-institute-transition-css';
    s.textContent=''+
      '.tc-institute-transition{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#090806;opacity:0;pointer-events:none;overflow:hidden}'+
      '.tc-institute-transition.is-active{opacity:1;pointer-events:auto}'+
      '.tc-it-glow{position:absolute;width:55vw;height:55vw;max-width:720px;max-height:720px;border-radius:50%;background:radial-gradient(circle,rgba(224,193,118,.18),rgba(184,150,78,.06) 34%,transparent 68%);animation:tcItGlow 1.7s ease-in-out both}'+
      '.tc-it-ring{position:absolute;width:min(58vw,600px);aspect-ratio:1;border:1px solid rgba(224,193,118,.20);border-radius:50%;animation:tcItRing 1.15s cubic-bezier(.22,1,.36,1) both}'+
      '.tc-it-ring:before,.tc-it-ring:after{content:"";position:absolute;inset:9%;border:1px solid rgba(184,150,78,.12);border-radius:50%}.tc-it-ring:after{inset:21%;border-color:rgba(224,193,118,.09)}'+
      '.tc-it-orbit{position:absolute;width:min(74vw,760px);height:min(22vw,220px);border:1px solid rgba(224,193,118,.10);border-radius:50%;transform:rotate(-17deg);animation:tcItOrbit 1.35s ease-out both}.tc-it-orbit:after{content:"";position:absolute;left:11%;top:50%;width:6px;height:6px;border-radius:50%;background:#e0c176;box-shadow:0 0 28px 8px rgba(224,193,118,.48)}'+
      '.tc-it-core{position:relative;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 32% 25%,#f5dc98,#b8893f 48%,#39260e 78%,#090806);box-shadow:0 0 70px rgba(224,193,118,.20),inset -12px -14px 22px rgba(0,0,0,.48);animation:tcItCore 1s cubic-bezier(.22,1,.36,1) both}.tc-it-core:before{content:"✦";color:#fff3c8;font-size:22px}'+
      '.tc-it-copy{position:absolute;bottom:15%;left:20px;right:20px;text-align:center;animation:tcItCopy .75s .16s cubic-bezier(.22,1,.36,1) both}.tc-it-kicker{display:block;color:#b8964e;font:500 9px var(--mono);letter-spacing:.26em;text-transform:uppercase;margin-bottom:12px}.tc-it-title{display:block;color:#f4efe6;font:600 clamp(30px,4.5vw,58px)/1 var(--serif);letter-spacing:-.025em}.tc-it-title em{color:#e0c176;font-style:italic}.tc-it-sub{display:block;margin-top:12px;color:rgba(244,239,230,.48);font:500 9px var(--mono);letter-spacing:.10em}'+
      '@keyframes tcItGlow{0%{transform:scale(.72);opacity:0}45%{opacity:1}100%{transform:scale(1);opacity:1}}'+
      '@keyframes tcItRing{0%{transform:scale(.35);opacity:0}100%{transform:scale(1);opacity:1}}'+
      '@keyframes tcItOrbit{0%{transform:rotate(-17deg) scale(.45);opacity:0}100%{transform:rotate(-17deg) scale(1);opacity:1}}'+
      '@keyframes tcItCore{0%{transform:scale(.08);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}'+
      '@keyframes tcItCopy{0%{transform:translateY(16px);opacity:0}100%{transform:none;opacity:1}}'+
      '@media(prefers-reduced-motion:reduce){.tc-institute-transition *{animation:none!important}}'+
      'body.tc-institute-lock{overflow:hidden!important}';
    document.head.appendChild(s);
  }

  window.openCapitalInstituteTransition=function(url){
    addTransitionStyles();
    if(document.querySelector('.tc-institute-transition')) return;
    var d=document.createElement('div');
    d.className='tc-institute-transition is-active';
    d.setAttribute('role','status');
    d.setAttribute('aria-label','Ouverture de The Capital Institute');
    d.innerHTML='<div class="tc-it-glow"></div><div class="tc-it-ring"></div><div class="tc-it-orbit"></div><div class="tc-it-core"></div><div class="tc-it-copy"><span class="tc-it-kicker">THE CAPITAL</span><span class="tc-it-title">Bienvenue dans <em>Institute.</em></span><span class="tc-it-sub">PRÉPARATION DE VOTRE ESPACE D’APPRENTISSAGE</span></div>';
    document.body.appendChild(d);
    document.body.classList.add('tc-institute-lock');
    setTimeout(function(){window.location.href=url},1450);
  };
})();
