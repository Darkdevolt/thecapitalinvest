// THE CAPITAL — Analyse technique PRO
// UI / calculs locaux uniquement. Les sources de données existantes restent inchangées.
if (window.__atIndexLoaded) {
  console.warn('[AT INDEX] Déjà chargé, skip.');
} else {
  window.__atIndexLoaded = true;

  const AT = {
    ticker: '', type: 'line', period: 252, interval: 'daily',
    hist: [], draws: [], drawMode: 'cursor',
    trendPts: [], channelPts: [], rectPts: [],
    zoom: { start: 0, end: 1 }, panning: false, panStart: 0, panZoomStart: null,
    focus: false, initialized: false,
    activeInds: {
      sma20:{on:false,color:'#60a5fa',label:'SMA 20',sub:null}, sma50:{on:false,color:'#f87171',label:'SMA 50',sub:null},
      sma200:{on:false,color:'#a78bfa',label:'SMA 200',sub:null}, ema12:{on:false,color:'#4ade80',label:'EMA 12',sub:null},
      ema26:{on:false,color:'#fb923c',label:'EMA 26',sub:null}, bb:{on:false,color:'rgba(184,150,78,.5)',label:'Bollinger (20)',sub:null},
      vwap:{on:false,color:'#e879f9',label:'VWAP',sub:null}, ichimoku:{on:false,color:'#06b6d4',label:'Ichimoku',sub:null},
      vol:{on:false,color:'#4ade80',label:'Volume',sub:'subVol'}, rsi:{on:false,color:'#fb923c',label:'RSI (14)',sub:'subRSI'},
      macd:{on:false,color:'#60a5fa',label:'MACD',sub:'subMACD'}, stoch:{on:false,color:'#e879f9',label:'Stochastique',sub:'subStoch'},
      adx:{on:false,color:'#f59e0b',label:'ADX (14)',sub:'subADX'}, cci:{on:false,color:'#a78bfa',label:'CCI (20)',sub:'subCCI'},
      obv:{on:false,color:'#4ade80',label:'OBV',sub:'subOBV'}
    },
    histCache:{}, compareData:null, compareTicker:'', rafId:null
  };
  window.AT = AT;

  const IND_CATALOG = [
    {cat:'Moyennes Mobiles',items:[
      {key:'sma20',name:'SMA 20',desc:'Moyenne mobile simple 20 périodes'}, {key:'sma50',name:'SMA 50',desc:'Moyenne mobile simple 50 périodes'},
      {key:'sma200',name:'SMA 200',desc:'Moyenne mobile simple 200 périodes'}, {key:'ema12',name:'EMA 12',desc:'Moyenne mobile exponentielle 12'}, {key:'ema26',name:'EMA 26',desc:'Moyenne mobile exponentielle 26'}]},
    {cat:'Volatilité',items:[{key:'bb',name:'Bollinger Bands',desc:'SMA ± 2 écarts-types'},{key:'vwap',name:'VWAP',desc:'Prix moyen pondéré par le volume'},{key:'ichimoku',name:'Ichimoku',desc:'Nuage Ichimoku Kinko Hyo'}]},
    {cat:'Volume',items:[{key:'vol',name:'Volume',desc:'Barres de volume'},{key:'obv',name:'OBV',desc:'On-Balance Volume'}]},
    {cat:'Momentum',items:[{key:'rsi',name:'RSI (14)',desc:'Relative Strength Index'},{key:'macd',name:'MACD',desc:'Moving Average Convergence Divergence'},{key:'stoch',name:'Stochastique',desc:'%K / %D (14,3)'},{key:'cci',name:'CCI (20)',desc:'Commodity Channel Index'},{key:'adx',name:'ADX (14)',desc:'Average Directional Index'}]}
  ];
  window.IND_CATALOG = IND_CATALOG;

  function fmtVol(n){if(n==null||isNaN(+n))return '—';const v=+n;if(v>=1e9)return(v/1e9).toFixed(2)+' Mrd';if(v>=1e6)return(v/1e6).toFixed(1)+' M';if(v>=1e3)return(v/1e3).toFixed(0)+' k';return v.toLocaleString('fr-FR');}
  window.fmtVol=fmtVol;
  function fmtDateFull(d){if(!d)return '—';const date=new Date(d);return date.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});}
  window.fmtDateFull=fmtDateFull;
  function toastSafe(msg,type){if(typeof window.toast==='function')window.toast(msg,type||'info');else console[type==='error'?'error':'log']('[AT]',msg);}

  function atPopulateTickerSelect(preserve=true){
    const sel=document.getElementById('atTicker'); if(!sel)return [];
    const rows=Array.isArray(window.allCours)?window.allCours:[];
    const seen=new Set();
    const tickers=rows.map(c=>String(c&&c.ticker||'').trim().toUpperCase()).filter(t=>t&&!seen.has(t)&&seen.add(t)).sort();
    const current=preserve?(AT.ticker||sel.value):'';
    sel.innerHTML='<option value="">Choisir un titre…</option>'+tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
    if(current&&tickers.includes(current))sel.value=current;
    sel.disabled=tickers.length===0;
    sel.title=tickers.length?`${tickers.length} titres disponibles`:'Cours indisponibles';
    return tickers;
  }
  window.atPopulateTickerSelect=atPopulateTickerSelect;

  function atInstallTickerSearch(){
    const sel=document.getElementById('atTicker'); if(!sel||sel.dataset.atSearch==='1')return;
    sel.dataset.atSearch='1';
    const holder=sel.parentElement||sel;
    const box=document.createElement('div'); box.className='at-ticker-picker'; box.innerHTML='<input id="atTickerSearch" class="at-ticker-search" type="search" autocomplete="off" placeholder="Rechercher ticker ou société…" aria-label="Rechercher un ticker"><div id="atTickerMeta" class="at-ticker-meta">Sélectionnez un titre pour charger son historique.</div>';
    holder.insertBefore(box,sel); box.appendChild(sel);
    const search=box.querySelector('#atTickerSearch');
    const filter=()=>{
      const q=search.value.trim().toUpperCase();
      const rows=Array.isArray(window.allCours)?window.allCours:[];
      const seen=new Set();
      const list=rows.filter(c=>{const t=String(c&&c.ticker||'').toUpperCase(),name=String(c&&(c.nom||c.libelle||c.entreprise||'')||'').toUpperCase();return t&&(!q||t.includes(q)||name.includes(q));}).filter(c=>{const t=String(c.ticker).toUpperCase();if(seen.has(t))return false;seen.add(t);return true;}).sort((a,b)=>String(a.ticker).localeCompare(String(b.ticker)));
      const current=sel.value;
      sel.innerHTML='<option value="">Choisir un titre…</option>'+list.map(c=>{const t=String(c.ticker).toUpperCase();const n=String(c.nom||c.libelle||'');return `<option value="${t}">${t}${n?' — '+n:''}</option>`;}).join('');
      if(current&&list.some(c=>String(c.ticker).toUpperCase()===current))sel.value=current;
      if(q&&list.length===1){sel.value=String(list[0].ticker).toUpperCase();atLoadTicker();}
    };
    search.addEventListener('input',filter);
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const opt=Array.from(sel.options).find(o=>o.value);if(opt){sel.value=opt.value;atLoadTicker();}}});
    sel.addEventListener('change',()=>{if(sel.value)atLoadTicker();});
    atPopulateTickerSelect(false);
  }

  async function atLoadTicker(){
    const sel=document.getElementById('atTicker'); const ticker=sel&&sel.value;
    if(!ticker){toastSafe('Choisissez un titre pour lancer l’analyse technique.','warn');return false;}
    AT.ticker=ticker; AT.zoom={start:0,end:1};
    const tickerEl=document.getElementById('atOhlcTicker');if(tickerEl)tickerEl.textContent=ticker;
    const meta=document.getElementById('atTickerMeta');if(meta)meta.textContent='Chargement de l’historique…';
    let raw=[];
    if(Array.isArray(window.allCoursHistorique)&&window.allCoursHistorique.length)raw=window.allCoursHistorique.filter(h=>String(h.ticker).toUpperCase()===ticker.toUpperCase());
    if(!raw.length&&AT.histCache[ticker])raw=AT.histCache[ticker];
    if(!raw.length){
      try{raw=await sb('historique',{ticker:`eq.${ticker}`,order:'date_seance.desc',limit:3000});if(Array.isArray(raw))raw=raw.reverse();if(raw.length)AT.histCache[ticker]=raw;}
      catch(e){console.error('[AT] historique',e);toastSafe('Historique indisponible : '+(e.message||e),'error');raw=[];}
    }
    AT.hist=typeof atExtract==='function'?atExtract(Array.isArray(raw)?raw:[]):[];
    if(!AT.hist.length){
      const cur=(Array.isArray(window.allCours)?window.allCours:[]).find(c=>String(c.ticker).toUpperCase()===ticker.toUpperCase());
      if(cur){const px=+cur.cours||0;AT.hist=[{date:cur.date_seance||new Date().toISOString().slice(0,10),o:px,h:px,l:px,c:px,v:+cur.volume||0}];toastSafe('Historique détaillé indisponible : cours actuel affiché.','warn');}
      else{if(meta)meta.textContent='Aucune donnée disponible';toastSafe('Aucune donnée pour '+ticker,'error');return false;}
    }
    if(meta){const last=AT.hist[AT.hist.length-1];meta.textContent=`${AT.hist.length} séances • dernier cours ${Number(last.c||0).toLocaleString('fr-FR')} FCFA`+(last.date?' • '+last.date:'');}
    atRender(); atUpdateWatchlist();
    return true;
  }
  window.atLoadTicker=atLoadTicker;

  function atSetType(t,btn){AT.type=t;document.querySelectorAll('[id^="atBtn"]').forEach(b=>{if(['atBtnLine','atBtnCandle','atBtnHA','atBtnBar'].includes(b.id))b.classList.remove('on');});if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetType=atSetType;
  function atSetPeriod(n,btn){AT.period=n;document.querySelectorAll('.at-period-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetPeriod=atSetPeriod;
  function atSetInterval(v,btn){AT.interval=v;document.querySelectorAll('.at-interval-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetInterval=atSetInterval;
  function atSetDraw(mode){AT.drawMode=mode;AT.trendPts=[];AT.channelPts=[];AT.rectPts=[];document.querySelectorAll('[id^="atTool"],[id^="dBtn"]').forEach(el=>el.classList.remove('on'));const map={cursor:['atToolCursor','dBtnCursor'],hline:['atToolHline','dBtnHLine'],trend:['atToolTrend','dBtnTrend'],channel:['atToolChannel','dBtnChannel'],rect:['atToolRect','dBtnRect'],fib:['atToolFib','dBtnFib'],pitch:['atToolPitch','dBtnPitch'],text:['atToolText','dBtnText']};(map[mode]||[]).forEach(id=>document.getElementById(id)?.classList.add('on'));const status=document.getElementById('atDrawStatus');if(status)status.textContent=({cursor:'',hline:'Support / résistance : cliquez sur le graphique',trend:'Ligne de tendance : cliquez deux points',channel:'Canal : cliquez les points de construction',rect:'Zone de prix : cliquez deux coins',fib:'Fibonacci : cliquez bas puis haut',pitch:'Pitchfork : cliquez trois points',text:'Annotation : cliquez sur le graphique'})[mode]||'';}
  window.atSetDraw=atSetDraw;
  function atClearDrawings(){AT.draws=[];if(AT.hist.length)atRender();toastSafe('Dessins effacés','success');}
  window.atClearDrawings=atClearDrawings;
  function atVisibleData(){let data=atAggregate(AT.hist,AT.interval);if(AT.period!==99999)data=data.slice(-AT.period);const n=data.length,s=Math.floor(AT.zoom.start*n),e=Math.ceil(AT.zoom.end*n);return data.slice(Math.max(0,s),Math.max(1,e));}
  window.atVisibleData=atVisibleData;

  function atInit(){
    const sel=document.getElementById('atTicker');if(!sel)return false;
    atPopulateTickerSelect(true); atInstallTickerSearch();
    document.getElementById('atBtnLine')?.classList.add('on');
    if(typeof atInitCrosshair==='function')atInitCrosshair();
    // Un seul point d'entrée pour la navigation technique : évite le double bootstrap.
    if(typeof atInitNavigation==='function')atInitNavigation();
    else if(typeof atInitNav==='function')atInitNav();
    if(typeof atUpdateWatchlist==='function')atUpdateWatchlist();
    if(!AT._resizeObserver){const wrap=document.getElementById('atWrap');if(wrap&&typeof ResizeObserver!=='undefined'){AT._resizeObserver=new ResizeObserver(()=>{if(AT.hist.length&&typeof atRender==='function')atRender();});AT._resizeObserver.observe(wrap);}}
    AT.initialized=true;
    return true;
  }
  window.atInit=atInit;
  window.atRefreshUI=function(){atPopulateTickerSelect(true);atInstallTickerSearch();if(AT.ticker){const sel=document.getElementById('atTicker');if(sel&&sel.value!==AT.ticker)sel.value=AT.ticker;}if(AT.hist.length&&typeof atRender==='function')atRender();};
}