(()=>{
'use strict';

const KEY='thecapital:landing-theme';

const css=`
/* THE CAPITAL — IMMERSIVE OPEN-SPACE V2 */
.tc-immersive-hero{grid-template-columns:minmax(330px,.76fr) minmax(620px,1.24fr)!important;gap:28px!important;min-height:calc(100svh - 72px)!important;overflow:hidden!important}
.tc-immersive-hero .copy{z-index:50!important;max-width:600px!important;padding:50px 0!important}
.tc-immersive-hero .visual{min-height:650px!important;overflow:visible!important;z-index:5!important}
.tc-floor-scene{position:relative!important;width:min(850px,100%)!important;height:570px!important;overflow:hidden!important;border:0!important;border-radius:2px!important;background:#0b0907!important;box-shadow:0 45px 100px rgba(0,0,0,.65),inset 0 0 100px rgba(0,0,0,.5)!important;isolation:isolate!important}
.tc-floor-scene:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 18%,rgba(224,193,118,.10),transparent 34%),linear-gradient(90deg,rgba(0,0,0,.48),transparent 22%,transparent 78%,rgba(0,0,0,.48));z-index:0;pointer-events:none}
.tc-floor-header{height:45px!important;background:rgba(5,5,4,.9)!important;border-bottom:1px solid rgba(224,193,118,.12)!important;padding:0 18px!important;z-index:40!important}
.tc-ceiling{top:45px!important;height:110px!important;background:linear-gradient(180deg,#211b15,rgba(15,12,9,.2))!important;z-index:1!important}
.tc-lightbar{top:62px!important;left:20%!important;width:17%!important;height:2px!important;box-shadow:210px 0 rgba(224,193,118,.18),420px 0 rgba(224,193,118,.12)!important}
.tc-column{top:45px!important;bottom:43px!important;width:20px!important;opacity:.7}
.tc-wall{left:48px!important;right:48px!important;top:92px!important;height:155px!important;z-index:7!important;background:linear-gradient(160deg,#1d1913,#070706)!important;border-color:rgba(224,193,118,.15)!important}
.tc-wall:before{content:'THE CAPITAL  /  BRVM  /  MARKET INTELLIGENCE'!important}
.tc-wall-value{left:18px!important;top:52px!important}
.tc-wall-value strong{font-size:25px!important}
.tc-wall-chart{left:29%!important;right:4%!important}
.tc-back-row{left:52px!important;right:52px!important;top:268px!important;height:80px!important;gap:14px!important;z-index:9!important}
.tc-back-desk{height:80px!important;background:linear-gradient(180deg,#211b14,#0c0a08)!important}
.tc-front-row{left:30px!important;right:30px!important;bottom:67px!important;height:150px!important;gap:18px!important;z-index:18!important}
.tc-workstation{height:150px!important}
.tc-monitor{width:min(190px,88%)!important;height:92px!important;background:#050504!important}
.tc-table{height:31px!important;background:linear-gradient(180deg,#30271b,#100d09)!important}
.tc-person{bottom:25px!important}
.tc-floor-plane{position:absolute!important;left:-10%;right:-10%;bottom:-90px;height:250px;z-index:3!important;transform:perspective(500px) rotateX(62deg);transform-origin:bottom;background:linear-gradient(rgba(224,193,118,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(224,193,118,.045) 1px,transparent 1px);background-size:58px 34px;opacity:.3;pointer-events:none}
.tc-floor-glow{position:absolute!important;left:10%;right:10%;bottom:75px;height:2px;background:rgba(224,193,118,.12);box-shadow:0 0 45px 10px rgba(184,150,78,.06);z-index:4;pointer-events:none}
.tc-room-ticker{position:absolute!important;left:0;right:0;bottom:0;height:43px;z-index:45!important;display:flex;align-items:center;justify-content:center;gap:28px;padding:0 14px;background:#060504;border-top:1px solid rgba(224,193,118,.12);color:rgba(243,238,229,.35);font:500 7px 'DM Mono',monospace;letter-spacing:.08em;white-space:nowrap}
.tc-room-ticker b{color:#e0c176;font-weight:400}
.tc-workstation:nth-child(1){transform:translateY(10px) scale(.94)}
.tc-workstation:nth-child(3){transform:translateY(10px) scale(.94)}
.tc-workstation:nth-child(2){transform:translateY(-2px) scale(1.02)}
.tc-floor-scene.active{animation:tcRoomIn .8s cubic-bezier(.2,.7,.2,1) both}
@keyframes tcRoomIn{from{opacity:0;transform:translateX(28px) scale(.985)}to{opacity:1;transform:none}}
@media(max-width:1100px){.tc-immersive-hero{grid-template-columns:1fr!important}.tc-immersive-hero .visual{min-height:570px!important}.tc-immersive-hero .copy{padding-bottom:0!important}}
@media(max-width:700px){.tc-immersive-hero .visual{min-height:410px!important}.tc-floor-scene{height:390px!important}.tc-floor-header{height:38px!important}.tc-ceiling{top:38px!important;height:78px!important}.tc-wall{left:22px!important;right:22px!important;top:61px!important;height:112px!important}.tc-wall-value{top:39px!important;left:11px!important}.tc-wall-value strong{font-size:17px!important}.tc-wall-chart{left:35%!important}.tc-back-row{left:22px!important;right:22px!important;top:190px!important;height:52px!important;gap:6px!important}.tc-back-desk{height:52px!important}.tc-back-screen{top:6px!important;height:27px!important}.tc-front-row{left:8px!important;right:8px!important;bottom:52px!important;height:100px!important;gap:5px!important}.tc-workstation{height:100px!important}.tc-monitor{width:92px!important;height:55px!important;border-width:3px!important}.tc-person{transform:translateX(-50%) scale(.7)!important;transform-origin:bottom}.tc-table{height:22px!important}.tc-room-ticker{height:32px!important;gap:12px!important;justify-content:flex-start;overflow:hidden}.tc-room-ticker span:nth-child(n+4){display:none}.tc-floor-plane{bottom:-70px;height:170px}}
@media(max-width:480px){.tc-immersive-hero .visual{min-height:350px!important}.tc-floor-scene{height:330px!important}.tc-wall{top:52px!important;height:94px!important}.tc-back-row{top:158px!important}.tc-front-row{bottom:43px!important}.tc-monitor{width:74px!important;height:48px!important}.tc-monitor-head{height:16px!important;font-size:4px!important}.tc-bars{top:22px!important;height:20px!important}.tc-monitor-foot{font-size:4px!important}.tc-room-ticker{height:28px!important;font-size:5px!important}}
`;

const injectCSS=()=>{if(document.getElementById('tc-v2-style'))return;const s=document.createElement('style');s.id='tc-v2-style';s.textContent=css;document.head.appendChild(s)};

const setTheme=(theme,button)=>{const light=theme==='light';document.body.classList.toggle('tc-light',light);document.body.classList.toggle('tc-dark',!light);try{localStorage.setItem(KEY,theme)}catch{}if(button){button.textContent=light?'☾':'☼';button.setAttribute('aria-label',light?'Passer en mode sombre':'Passer en mode clair')}};

const setupTheme=()=>{const nav=document.querySelector('.links');if(!nav||nav.querySelector('.tc-theme-toggle'))return;const b=document.createElement('button');b.type='button';b.className='tc-theme-toggle';nav.appendChild(b);let t='dark';try{t=localStorage.getItem(KEY)||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch{}setTheme(t,b);b.addEventListener('click',()=>setTheme(document.body.classList.contains('tc-light')?'dark':'light',b))};

const scene=()=>{const visual=document.querySelector('.visual');if(!visual)return;visual.innerHTML=`
<div class="tc-floor-scene" aria-label="Salle des marchés The Capital">
<div class="tc-floor-header"><div class="tc-room-brand"><span class="tc-room-dot"></span>THE CAPITAL · MARKET INTELLIGENCE</div><div class="floor-status">DAKAR · BRVM</div></div>
<div class="tc-ceiling"></div><div class="tc-lightbar"></div><div class="tc-column left"></div><div class="tc-column right"></div>
<div class="tc-wall"><div class="tc-wall-value"><small>BRVM COMPOSITE</small><strong class="tc-composite-value">—</strong><b class="tc-composite-change">—</b></div><div class="tc-wall-chart"><svg viewBox="0 0 520 120" preserveAspectRatio="none"><path d="M0 96 C35 92 50 99 75 83 S112 88 140 74 S175 78 200 65 S235 71 264 57 S302 66 332 48 S370 55 400 39 S438 46 466 29 S500 36 520 18" fill="none" stroke="rgba(224,193,118,.86)" stroke-width="2"/></svg></div></div>
<div class="tc-back-row"><div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div><div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div><div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div><div class="tc-back-desk"><div class="tc-back-screen"></div><div class="tc-back-chair"></div></div></div>
<div class="tc-front-row">
${[['MARKET','BRVM'],['ANALYSIS','FUNDAMENTAL'],['PORTFOLIO','MONITOR']].map((x,i)=>`<div class="tc-workstation"><div class="tc-monitor"><div class="tc-monitor-head"><span>${x[0]}</span><b>${x[1]}</b></div><div class="tc-bars"><i style="height:${35+i*6}%"></i><i style="height:${53+i*4}%"></i><i style="height:${46+i*5}%"></i><i style="height:${69+i*3}%"></i><i style="height:${57+i*6}%"></i><i style="height:${78+i*2}%"></i><i style="height:${66+i*7}%"></i></div><div class="tc-monitor-foot"><span>${i===0?'SONATEL':i===1?'FINANCIALS':'RISK'}</span><b>${i===0?'DATA':i===1?'LIVE':'TRACKING'}</b></div></div><div class="tc-person"></div><div class="tc-table"></div></div>`).join('')}
</div><div class="tc-floor-plane"></div><div class="tc-floor-glow"></div>
<div class="tc-room-ticker"><span>SONATEL <b>MARKET</b></span><span>BOA SN <b>ANALYSIS</b></span><span>CORIS BANK <b>DATA</b></span><span>BRVM 30 <b>INDEX</b></span><span>THE CAPITAL <b>INTELLIGENCE</b></span></div>
</div>`;
const hero=document.querySelector('.hero');hero?.classList.add('tc-immersive-hero');const e=document.querySelector('.hero .eyebrow');if(e)e.textContent='THE CAPITAL · MARCHÉS AFRICAINS';const h=document.querySelector('.hero h1');if(h)h.innerHTML='Intelligence financière<br><em>africaine.</em>';requestAnimationFrame(()=>document.querySelector('.tc-floor-scene')?.classList.add('active'))};

const data=async()=>{try{const r=await fetch('/api/marche?type=indices',{headers:{Accept:'application/json'}});if(!r.ok)throw 0;const rows=await r.json();const x=rows.find(row=>String(row.indice||'').toUpperCase().replace(/[-_]/g,' ')==='BRVM COMPOSITE');if(!x)return;const v=Number(x.valeur),p=Number(x.variation_pct);const vn=document.querySelector('.tc-composite-value'),pn=document.querySelector('.tc-composite-change');if(vn&&Number.isFinite(v))vn.textContent=v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});if(pn&&Number.isFinite(p))pn.textContent=`${p>=0?'+':''}${p.toFixed(2)} %`}catch{}};

const boot=()=>{injectCSS();document.body.classList.add('tc-institution');setupTheme();scene();data()};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();