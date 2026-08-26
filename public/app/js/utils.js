// ═══════════════════════════════════════
// UTILS, The Capital BRVM
// ═══════════════════════════════════════
(function(){
  'use strict';
  if(window.__TC_UTILS_LOADED__){console.log('[UTILS] Déjà chargé, skip.');return;}
  window.__TC_UTILS_LOADED__=true;

  window.toast=function(msg,type='info'){
    let container=document.getElementById('toastContainer');
    if(!container){container=document.createElement('div');container.id='toastContainer';container.className='toast-container';document.body.appendChild(container);}
    const el=document.createElement('div');el.className='toast '+type;el.setAttribute('role',type==='error'?'alert':'status');el.setAttribute('aria-live',type==='error'?'assertive':'polite');el.textContent=msg;container.appendChild(el);
    setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(20px)';setTimeout(function(){el.remove();},300);},4000);
  };
  window.SB_URL=null;window.SB_KEY=null;window.SK='tc_session';
  window.fmt=function(n,d=0){if(n==null||isNaN(+n))return ', ';return (+n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});};
  window.fmtDate=function(d){if(!d)return ', ';try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return ', ';}};
  window.fmtM=function(n){if(n==null||isNaN(+n))return ', ';const v=+n;if(Math.abs(v)>=1e9)return (v/1e9).toFixed(1)+' Mrd';if(Math.abs(v)>=1e6)return (v/1e6).toFixed(0)+' M';return fmt(v);};
  window.changePill=function(v){const n=parseFloat(v);if(isNaN(n))return ', ';if(n>0)return '▲ '+n.toFixed(2)+'%';if(n<0)return '▼ '+Math.abs(n).toFixed(2)+'%';return '= 0.00%';};
  window.escapeHtml=function(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');};
  window.SECTORS={SGBC:'Banque',BICC:'Banque',BOAB:'Banque',BOAN:'Banque',CORIS:'Banque',NSBC:'Banque',ORGB:'Banque',SIBC:'Banque',ETIT:'Telecom',NTLC:'Telecom',SAFC:'Finance',SICC:'Finance',SONAR:'Finance',WARA:'Finance',PALM:'Agro',SIVC:'Agro',ONAB:'Agro',CABC:'Agro',SPCI:'Agro',SPHC:'Agro',SOGC:'Agro',SICOR:'Agro',SOLB:'Distribution',CASH:'Distribution',CMAC:'Distribution',TTLS:'Industrie',SHEC:'Industrie',SOTRA:'Industrie',STAC:'Industrie',SOTR:'Transport',CIE:'Energie',SODECI:'Energie',CGR:'BTP',SICABLE:'BTP',BOL:'Holding',CFAC:'Holding',BOAS:'Holding',PHPC:'Sante',UNLC:'Technologie',VIVO:'Technologie',SEM:'Mines',BOAM:'Divers',ECOC:'Divers'};
  window.getSector=function(t){if(!t)return 'Divers';const ref=window.entMap&&window.entMap[t];if(ref&&ref.secteur&&String(ref.secteur).trim())return String(ref.secteur).trim();if(window.SECTORS[t])return window.SECTORS[t];const keys=Object.keys(window.SECTORS).sort((a,b)=>b.length-a.length);for(const k of keys)if(String(t).startsWith(k))return window.SECTORS[k];return 'Divers';};
  window.getPays=function(t){const ref=window.entMap&&window.entMap[t];return ref&&ref.pays?String(ref.pays):'UEMOA';};
  window.chartOpts={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#1A1610',borderColor:'rgba(184,150,78,0.3)',borderWidth:1,titleColor:'#B8964E',bodyColor:'#F5F0E8',padding:12,callbacks:{label:ctx=>' '+(ctx.dataset.label?ctx.dataset.label+': ':'')+fmt(ctx.parsed.y,2)}}},scales:{x:{grid:{color:'rgba(184,150,78,0.04)'},ticks:{color:'rgba(245,240,232,0.3)',font:{size:10,family:'DM Mono'},maxTicksLimit:8}},y:{position:'right',grid:{color:'rgba(184,150,78,0.06)'},ticks:{color:'rgba(245,240,232,0.3)',font:{size:10,family:'DM Mono'},callback:v=>fmt(v)}}}};
  window.chartDefaults=window.chartOpts;
  window.mkDataset=function(vals,color='#B8964E',label=''){return {label,data:vals,borderColor:color,borderWidth:2,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:color,pointHoverBorderColor:'#fff',pointHoverBorderWidth:2,fill:true,tension:.3,backgroundColor:ctx=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);g.addColorStop(0,color+'18');g.addColorStop(1,color+'00');return g;}};};
  window.mkLineDataset=function(vals,color,label,width=1.5){return {label,data:vals,borderColor:color,borderWidth:width,pointRadius:0,pointHoverRadius:3,fill:false,tension:.3};};
  window.debounce=function(fn,ms){let timer;return function(...args){clearTimeout(timer);timer=setTimeout(()=>fn.apply(this,args),ms);};};
  window.throttle=function(fn,ms){let last=0;return function(...args){const now=Date.now();if(now-last>=ms){last=now;fn.apply(this,args);}};};
  window.safeJSON=function(str,fallback=null){try{return JSON.parse(str);}catch(e){return fallback;}};
  console.log('[UTILS] Chargé avec succès');
})();
