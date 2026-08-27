(function(){
  'use strict';
  if(window.__TC_MARKET_UX_LOADED__) return;
  window.__TC_MARKET_UX_LOADED__ = true;

  const TZ_BRVM='Africa/Abidjan';
  const DAY=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  const EXCEPTIONAL={};
  const HOLIDAYS={'2026-01-01','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-08-07','2026-08-15','2026-11-01','2026-12-25'};
  function pad(n){return String(n).padStart(2,'0');}
  function parts(d,tz){const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const o={};p.forEach(x=>o[x.type]=x.value);return o;}
  function minutesInBrvm(d){const p=parts(d,TZ_BRVM);return {m:+p.hour*60 + +p.minute + +p.second/60,day:new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay(),key:`${p.year}-${p.month}-${p.day}`};}
  function parseTime(s){const [h,m]=s.split(':').map(Number);return h*60+m;}
  function scheduleFor(key){const ex=EXCEPTIONAL[key];if(ex){return {preopen:parseTime(ex.preopen),open:parseTime(ex.open),preclose:parseTime(ex.preclose),close:parseTime(ex.close),exceptional:true};}return {preopen:540,open:585,preclose:840,close:900,exceptional:false};}
  function isHoliday(key){return HOLIDAYS.has(key);}
  function isTradingDay(day,key){return day>=1&&day<=5&&!isHoliday(key);}
  function stateAt(d){
    const x=minutesInBrvm(d),s=scheduleFor(x.key);
    if(!isTradingDay(x.day,x.key)) return {code:'closed',label:'MARCHÉ FERMÉ',detail:isHoliday(x.key)?'Jour férié / marché fermé':'Hors séance',x,s};
    if(x.m>=s.preopen&&x.m<s.open)return {code:'preopen',label:'PRÉ-OUVERTURE',detail:'Ordres et formation du prix d’ouverture',x,s};
    if(x.m>=s.open&&x.m<s.preclose)return {code:'live',label:'EN DIRECT',detail:'Négociation en continu',x,s};
    if(x.m>=s.preclose&&x.m<s.close-30)return {code:'preclose',label:'PRÉ-CLÔTURE',detail:'Phase de pré-clôture',x,s};
    if(x.m>=s.close-30&&x.m<s.close)return {code:'live',label:'EN DIRECT',detail:'Négociation au dernier cours',x,s};
    return {code:'closed',label:'MARCHÉ FERMÉ',detail:'Séance terminée',x,s};
  }
  function nextSession(from){const d=new Date(from);for(let i=0;i<370;i++){d.setUTCDate(d.getUTCDate()+1);const x=minutesInBrvm(d);if(isTradingDay(x.day,x.key))return {date:d,key:x.key,schedule:scheduleFor(x.key)};}return null;}
  window.TC_BRVM_SESSION_ENGINE={stateAt,nextSession,scheduleFor,isTradingDay,isHoliday,timezone:TZ_BRVM};
  window.getBrvmSessionState=function(){return stateAt(new Date());};

  function formatClock(tz){return new Intl.DateTimeFormat('fr-FR',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}
  function userZone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  function zoneLabel(tz){if(tz==='Africa/Abidjan')return 'Abidjan';if(tz==='Africa/Dakar')return 'Dakar';const city=tz.split('/').pop().replace(/_/g,' ');return city||tz;}
  function ensureClock(){const el=document.getElementById('headerTime');if(!el)return;el.classList.add('tc-market-clocks');el.innerHTML='<div class="tc-clock-main"><span class="tc-clock-kicker">HEURE DU MARCHÉ</span><span class="tc-clock-primary"><b id="tc-clock-abidjan">--:--:--</b><small>Abidjan · BRVM</small></span></div><div class="tc-clock-list"><span><b id="tc-clock-dakar">--:--:--</b><small>Dakar</small></span><span><b id="tc-clock-user">--:--:--</b><small id="tc-clock-user-label">Votre heure</small></span></div>';}
  function updateHeader(){
    const state=stateAt(new Date()),badge=document.querySelector('.header-badge');
    if(badge){badge.className='header-badge tc-market-badge '+state.code;badge.innerHTML='<span class="tc-status-dot"></span><span>'+state.label+'</span>';badge.title=state.detail;}
    ensureClock();const tz=userZone();const a=document.getElementById('tc-clock-abidjan'),d=document.getElementById('tc-clock-dakar'),u=document.getElementById('tc-clock-user'),ul=document.getElementById('tc-clock-user-label');
    if(a)a.textContent=formatClock('Africa/Abidjan');if(d)d.textContent=formatClock('Africa/Dakar');if(u)u.textContent=formatClock(tz);if(ul)ul.textContent=zoneLabel(tz);
  }
  function updateMarketPanel(){
    const state=stateAt(new Date()),status=document.getElementById('marketStatus'),time=document.getElementById('marketTime'),next=document.getElementById('marketNext');
    if(status){status.className='market-status '+state.code;status.innerHTML='<span class="status-dot"></span>'+state.label;}
    if(time)time.textContent=formatClock(TZ_BRVM)+' GMT';
    if(next){if(state.code!=='closed'){next.textContent='Phase active · référence Abidjan';}else{const n=nextSession(new Date());next.textContent=n?'Prochaine séance : '+DAY[new Date(n.date).getUTCDay()]+' '+pad(Math.floor(n.schedule.preopen/60))+':'+pad(n.schedule.preopen%60)+' Abidjan':'';}}
  }
  function injectStyles(){if(document.getElementById('tc-market-ux-style'))return;const s=document.createElement('style');s.id='tc-market-ux-style';s.textContent=`
.header-badge.tc-market-badge{display:inline-flex;align-items:center;gap:7px;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(184,150,78,.2);background:rgba(184,150,78,.06);font:600 9px var(--mono);letter-spacing:.09em;white-space:nowrap}.tc-market-badge .tc-status-dot{width:7px;height:7px;border-radius:50%;background:#858585;box-shadow:0 0 0 3px rgba(133,133,133,.08)}.tc-market-badge.live .tc-status-dot{background:#65c18c;box-shadow:0 0 0 3px rgba(101,193,140,.12)}.tc-market-badge.preopen .tc-status-dot{background:#d7b85a;box-shadow:0 0 0 3px rgba(215,184,90,.12)}.tc-market-badge.preclose .tc-status-dot{background:#d88b4c;box-shadow:0 0 0 3px rgba(216,139,76,.12)}
.tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:310px;color:var(--muted);line-height:1.05}.tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}.tc-clock-main{gap:9px}.tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}.tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}.tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}.tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:rgba(244,239,230,.4)}.tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}
.tc-guide-premium{position:fixed;inset:0;z-index:10001;background:rgba(8,7,5,.96);backdrop-filter:blur(18px);display:none;overflow:auto}.tc-guide-premium.open{display:block}.tc-guide-inner{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}.tc-guide-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:1px solid var(--line);padding-bottom:22px}.tc-guide-eyebrow{font:500 9px var(--mono);letter-spacing:.18em;color:var(--gold);text-transform:uppercase}.tc-guide-h1{font:700 clamp(38px,6vw,70px)/.98 var(--serif);margin:10px 0}.tc-guide-h1 em{color:var(--gold2)}.tc-guide-lead{max-width:650px;color:var(--muted);font-size:14px}.tc-guide-close2{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 13px;border-radius:7px;cursor:pointer;font:500 10px var(--mono);text-transform:uppercase}.tc-guide-journey{display:grid;grid-template-columns:repeat(5,1fr);margin:30px 0 42px;border:1px solid var(--line);background:var(--line);gap:1px}.tc-guide-step{background:var(--panel);padding:16px}.tc-guide-step b{font:600 16px var(--serif)}.tc-guide-step span{display:block;color:var(--gold);font:500 8px var(--mono);margin-bottom:8px}.tc-guide-section-label{font:500 9px var(--mono);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}.tc-guide-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}.tc-guide-card{background:var(--panel);padding:25px;min-height:205px;display:flex;flex-direction:column}.tc-guide-card:nth-child(odd){background:var(--panel2)}.tc-guide-card-head{display:flex;gap:14px;align-items:flex-start}.tc-guide-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid var(--line);color:var(--gold2);font:500 10px var(--mono);flex:none}.tc-guide-card h3{font:600 22px var(--serif);margin:0 0 5px}.tc-guide-card p{color:var(--muted);font-size:12px;line-height:1.65;margin:0}.tc-guide-card ul{list-style:none;padding:0;margin:16px 0;display:grid;gap:6px}.tc-guide-card li{font-size:11px;color:rgba(244,239,230,.72)}.tc-guide-card li:before{content:'—';color:var(--gold);margin-right:7px}.tc-guide-action{margin-top:auto;align-self:flex-start;border:1px solid var(--line);background:rgba(184,150,78,.06);color:var(--gold2);padding:9px 12px;border-radius:6px;font:500 9px var(--mono);letter-spacing:.07em;text-transform:uppercase;cursor:pointer}.tc-guide-action:hover{background:rgba(184,150,78,.13);border-color:var(--gold)}.tc-guide-footer{margin-top:34px;padding:22px;border:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(110deg,rgba(184,150,78,.08),transparent)}.tc-guide-footer b{font:600 21px var(--serif)}.tc-guide-footer span{display:block;color:var(--muted);font-size:11px;margin-top:4px}@media(max-width:800px){.tc-market-clocks{min-width:0}.tc-clock-list{display:none}.tc-guide-journey{grid-template-columns:1fr 1fr}.tc-guide-cards{grid-template-columns:1fr}.tc-guide-top{flex-direction:column}.tc-guide-footer{flex-direction:column;align-items:flex-start}}@media(max-width:600px){.tc-market-clocks{gap:6px}.tc-clock-kicker{display:none}.tc-clock-primary small{font-size:6px}.tc-market-badge{max-width:110px;overflow:hidden}.tc-guide-inner{width:min(100% - 24px,1120px)}}`;
    document.head.appendChild(s);}

  const GUIDE=[
    ['01','MARCHÉ','Comprendre ce qui se passe sur la BRVM',['Cours et indices','Volumes et variations','BOC et titres cotés'],'Explorer les marchés','marche'],
    ['02','ANALYSE','Comprendre une entreprise avant d’investir',['Analyse fondamentale','Analyse technique','Comparaison et dividendes'],'Analyser une entreprise','analyse-fondamentale'],
    ['03','SUIVI & TRADING','Transformer une analyse en décision',['Watchlist et notes','Scénarios et simulations','Trading Desk'],'Ouvrir mon espace','desk-workspace.html'],
    ['04','PORTEFEUILLE','Suivre vos investissements',['Positions et P&L','Performance','Évolution du portefeuille'],'Voir mon portefeuille','portefeuille'],
    ['05','ALERTES','Ne plus surveiller constamment le marché',['Seuils de prix','Événements importants','Notifications'],'Configurer mes alertes','alertes'],
    ['06','DONNÉES','Accéder aux informations financières',['États financiers','Publications','Calendrier'],'Explorer les données','financials']
  ];
  function openGuide(){
    const old=document.getElementById('tc-guide-overlay');if(old)old.remove();let modal=document.getElementById('tc-guide-premium');
    if(!modal){modal=document.createElement('div');modal.id='tc-guide-premium';modal.className='tc-guide-premium';modal.innerHTML='<div class="tc-guide-inner"><div class="tc-guide-top"><div><div class="tc-guide-eyebrow">THE CAPITAL · GUIDE</div><h1 class="tc-guide-h1">Bienvenue sur <em>The Capital.</em></h1><p class="tc-guide-lead">Comprendre la plateforme en quelques secondes. Suivez le parcours qui vous correspond, du marché à la gestion de vos investissements.</p></div><button class="tc-guide-close2" type="button">Fermer ×</button></div><div class="tc-guide-journey">'+['Je découvre','J’analyse','Je surveille','Je décide','Je gère'].map((x,i)=>'<div class="tc-guide-step"><span>0'+(i+1)+'</span><b>'+x+'</b></div>').join('')+'</div><div class="tc-guide-section-label">Les espaces The Capital</div><div class="tc-guide-cards">'+GUIDE.map(x=>'<article class="tc-guide-card"><div class="tc-guide-card-head"><div class="tc-guide-icon">'+x[0]+'</div><div><h3>'+x[1]+'</h3><p>'+x[2]+'</p></div></div><ul>'+x[3].map(y=>'<li>'+y+'</li>').join('')+'</ul><button class="tc-guide-action" data-guide-target="'+x[5]+'">'+x[4]+' →</button></article>').join('')+'</div><div class="tc-guide-footer"><div><b>Vous ne savez pas par où commencer ?</b><span>Commencez par Marché, puis Analyse. Le reste vient naturellement.</span></div><button class="tc-guide-action" data-guide-target="marche">Commencer le parcours →</button></div></div>';document.body.appendChild(modal);modal.querySelector('.tc-guide-close2').addEventListener('click',()=>modal.classList.remove('open'));modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});modal.querySelectorAll('[data-guide-target]').forEach(btn=>btn.addEventListener('click',()=>{const t=btn.dataset.guideTarget;modal.classList.remove('open');if(t.includes('.html'))window.location.href=t;else if(typeof window.nav==='function')window.nav(t);else window.location.hash=t;}));}
    modal.classList.add('open');
  }
  function wireGuide(){const btn=document.getElementById('tc-guide-btn');if(btn&&!btn.dataset.tcPremium){btn.dataset.tcPremium='1';btn.textContent='ⓘ Guide';btn.onclick=openGuide;}}
  function boot(){injectStyles();ensureClock();updateHeader();updateMarketPanel();wireGuide();setInterval(()=>{updateHeader();updateMarketPanel();wireGuide();},1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
