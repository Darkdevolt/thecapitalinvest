// ═══════════════════════════════════════
// UTILS, The Capital BRVM
// ═══════════════════════════════════════
(function() {
  if (window.__TC_UTILS_LOADED__) return;
  window.__TC_UTILS_LOADED__ = true;

  window.toast = function(msg, type='info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.style.cssText = `background:${type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : '#B8964E'};color:#fff;padding:12px 20px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:all .3s ease;opacity:1;transform:translateX(0);max-width:320px;word-break:break-word;`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
    }, 4000);
  };

  // Les appels de données passent exclusivement par /api via fetch.js.
  window.SB_URL = null;
  window.SB_KEY = null;
  window.SK = 'tc_session';

  window.fmt = function(n, d = 0) {
    if (n == null || isNaN(+n)) return '—';
    return (+n).toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d });
  };

  window.fmtDate = function(d) {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    } catch(e) { return '—'; }
  };

  window.fmtM = function(n) {
    if (n == null || isNaN(+n)) return '—';
    const v = +n;
    if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' Mrd';
    if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0) + ' M';
    return fmt(v);
  };

  window.changePill = function(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    if (n > 0) return `▲ ${n.toFixed(2)}%`;
    if (n < 0) return `▼ ${Math.abs(n).toFixed(2)}%`;
    return '= 0.00%';
  };

  window.SECTORS = {
    SGBC:'Banque',BICC:'Banque',BOAB:'Banque',BOAN:'Banque',CORIS:'Banque',NSBC:'Banque',ORGB:'Banque',SIBC:'Banque',
    ETIT:'Telecom',NTLC:'Telecom',SAFC:'Finance',SICC:'Finance',SONAR:'Finance',WARA:'Finance',
    PALM:'Agro',SIVC:'Agro',ONAB:'Agro',CABC:'Agro',SPCI:'Agro',SPHC:'Agro',SOGC:'Agro',SICOR:'Agro',
    SOLB:'Distribution',CASH:'Distribution',CMAC:'Distribution',TTLS:'Industrie',SHEC:'Industrie',SOTRA:'Industrie',STAC:'Industrie',
    SOTR:'Transport',CIE:'Energie',SODECI:'Energie',CGR:'BTP',SICABLE:'BTP',BOL:'Holding',CFAC:'Holding',BOAS:'Holding',
    PHPC:'Sante',UNLC:'Technologie',VIVO:'Technologie',SEM:'Mines',BOAM:'Divers',ECOC:'Divers'
  };

  window.getSector = function(t) {
    if (!t) return 'Divers';
    if (SECTORS[t]) return SECTORS[t];
    const keys = Object.keys(SECTORS).sort((a,b) => b.length-a.length);
    for (const k of keys) if (t.startsWith(k)) return SECTORS[k];
    return 'Divers';
  };

  window.chartOpts = {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#1A1610',borderColor:'rgba(184,150,78,.3)',borderWidth:1,titleColor:'#B8964E',bodyColor:'#F5F0E8',padding:12,callbacks:{label:ctx=>' '+(ctx.dataset.label?ctx.dataset.label+': ':'')+fmt(ctx.parsed.y,2)}}},
    scales:{
      x:{grid:{color:'rgba(184,150,78,.04)'},ticks:{color:'rgba(245,240,232,.3)',font:{size:10,family:'DM Mono'},maxTicksLimit:8}},
      y:{position:'right',grid:{color:'rgba(184,150,78,.06)'},ticks:{color:'rgba(245,240,232,.3)',font:{size:10,family:'DM Mono'},callback:v=>fmt(v)}}
    }
  };
  window.chartDefaults = window.chartOpts;

  window.mkDataset = function(vals,color='#B8964E',label='') {
    return {label,data:vals,borderColor:color,borderWidth:2,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:color,pointHoverBorderColor:'#fff',pointHoverBorderWidth:2,fill:true,tension:.3,backgroundColor:ctx=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);g.addColorStop(0,color+'18');g.addColorStop(1,color+'00');return g;}};
  };
  window.mkLineDataset = function(vals,color,label,width=1.5) { return {label,data:vals,borderColor:color,borderWidth:width,pointRadius:0,pointHoverRadius:3,fill:false,tension:.3}; };

  window.debounce = function(fn,ms) { let timer; return function(...args){ clearTimeout(timer); timer=setTimeout(()=>fn.apply(this,args),ms); }; };
  window.throttle = function(fn,ms) { let last=0; return function(...args){ const now=Date.now(); if(now-last>=ms){last=now;fn.apply(this,args);} }; };
  window.safeJSON = function(str,fallback=null) { try{return JSON.parse(str);}catch(e){return fallback;} };

  console.log('[UTILS] Chargé avec succès');
})();
