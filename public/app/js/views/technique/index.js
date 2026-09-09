// THE CAPITAL — Analyse technique PRO
// UI / calculs locaux. Toutes les données marché passent par le client API central.
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

  function atNormalizeKey(value){
    return String(value==null?'':value).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
  }
  function atTickerOf(row){return String(row?.ticker||row?.symbol||row?.symbole||row?.code||row?.code_titre||row?.valeur||'').trim().toUpperCase();}
  function atNameOf(row){return String(row&&(row.nom||row.libelle||row.entreprise||row.nom_societe||row.societe||row.company||'')||'').trim();}
  function atPriceOf(row){
    for(const f of ['cours','cours_cloture','cloture','close','prix','last','last_price','price']){const n=Number(String(row?.[f]??'').replace(/\s/g,'').replace(/,/g,'.'));if(Number.isFinite(n)&&n>0)return n;}
    return 0;
  }
  function atVolumeOf(row){
    for(const f of ['volume','vol','quantite','quantity']){const n=Number(String(row?.[f]??'').replace(/\s/g,'').replace(/,/g,'.'));if(Number.isFinite(n)&&n>=0)return n;}
    return 0;
  }
  function atDateOf(row){return row&&(row.date_seance||row.date||row.dt||row.seance||row.cours_date||row.jour||'')||'';}
  function atRowsMatchTicker(row, requested){const a=atNormalizeKey(atTickerOf(row)),b=atNormalizeKey(requested);return !!a&&!!b&&(a===b||a.startsWith(b)||b.startsWith(a));}
  function atFindCurrentRow(requested){
    const rows=Array.isArray(window.allCours)?window.allCours:[];
    return rows.find(r=>atNormalizeKey(atTickerOf(r))===atNormalizeKey(requested)) || rows.find(r=>atRowsMatchTicker(r,requested)) || null;
  }
  function atFilterHistory(rows,requested){
    if(!Array.isArray(rows))return [];
    const q=atNormalizeKey(requested), exact=rows.filter(r=>atNormalizeKey(atTickerOf(r))===q);
    if(exact.length)return exact;
    return rows.filter(r=>atRowsMatchTicker(r,requested));
  }
  window.atNormalizeKey=atNormalizeKey;
  window.atFindCurrentRow=atFindCurrentRow;

  function atPopulateTickerSelect(preserve=true){
    const sel=document.getElementById('atTicker'); if(!sel)return [];
    const seen=new Set();
    const tickers=(Array.isArray(window.allCours)?window.allCours:[]).map(atTickerOf).filter(t=>{const k=atNormalizeKey(t);if(!k||seen.has(k))return false;seen.add(k);return true;}).sort();
    const current=preserve?(AT.ticker||sel.value):'';
    sel.innerHTML='<option value="">Choisir un titre…</option>'+tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
    if(current){const match=tickers.find(t=>atNormalizeKey(t)===atNormalizeKey(current)||atNormalizeKey(t).startsWith(atNormalizeKey(current))||atNormalizeKey(current).startsWith(atNormalizeKey(t)));if(match)sel.value=match;}
    sel.disabled=tickers.length===0; sel.title=tickers.length?`${tickers.length} titres disponibles`:'En attente des cours'; return tickers;
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
      const q=search.value.trim().toUpperCase(), rows=Array.isArray(window.allCours)?window.allCours:[], seen=new Set();
      const list=rows.filter(c=>{const t=atTickerOf(c),n=atNameOf(c).toUpperCase();return t&&(!q||t.includes(q)||n.includes(q));}).filter(c=>{const k=atNormalizeKey(atTickerOf(c));if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>atTickerOf(a).localeCompare(atTickerOf(b)));
      const current=sel.value;
      sel.innerHTML='<option value="">Choisir un titre…</option>'+list.map(c=>{const t=atTickerOf(c),n=atNameOf(c);return `<option value="${t}">${t}${n?' — '+n:''}</option>`;}).join('');
      if(current&&list.some(c=>atNormalizeKey(atTickerOf(c))===atNormalizeKey(current)))sel.value=current;
      if(q&&list.length===1){sel.value=atTickerOf(list[0]);atLoadTicker();}
    };
    search.addEventListener('input',filter);
    search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const opt=Array.from(sel.options).find(o=>o.value);if(opt){sel.value=opt.value;atLoadTicker();}}});
    sel.addEventListener('change',()=>{if(sel.value)atLoadTicker();});
    atPopulateTickerSelect(false);
  }

  async function atLoadTicker(){
    const sel=document.getElementById('atTicker'), selected=sel?.value;
    if(!selected){toastSafe('Choisissez un titre pour lancer l’analyse technique.','warn');return false;}
    const current=atFindCurrentRow(selected), canonical=atTickerOf(current)||selected;
    AT.ticker=canonical; AT.zoom={start:0,end:1};
    const tickerEl=document.getElementById('atOhlcTicker');if(tickerEl)tickerEl.textContent=canonical;
    const meta=document.getElementById('atTickerMeta');if(meta)meta.textContent='Chargement des données…';

    let raw=[];
    if(Array.isArray(window.allCoursHistorique)&&window.allCoursHistorique.length)raw=atFilterHistory(window.allCoursHistorique,canonical);
    if(!raw.length&&AT.histCache[canonical])raw=AT.histCache[canonical];
    if(!raw.length&&typeof window.apiGetHistoriqueComplet==='function'){
      try{raw=await window.apiGetHistoriqueComplet(canonical,{pageSize:1000,maxPages:50});if(raw.length)AT.histCache[canonical]=raw;}
      catch(e){console.warn('[AT] historique API',e);}
    }
    if(!raw.length&&Array.isArray(window.allCoursHistorique))raw=atFilterHistory(window.allCoursHistorique,selected);

    AT.hist=typeof atExtract==='function'?atExtract(Array.isArray(raw)?raw:[]):[];
    if(!AT.hist.length&&current){const px=atPriceOf(current);if(px>0){AT.hist=[{date:atDateOf(current)||new Date().toISOString().slice(0,10),o:px,h:px,l:px,c:px,v:atVolumeOf(current)}];if(meta)meta.textContent=`Cours actuel ${px.toLocaleString('fr-FR')} FCFA • historique détaillé en attente`;}}
    if(!AT.hist.length){if(meta)meta.textContent='Données de cours non résolues pour ce titre';toastSafe(`Le titre ${selected} existe dans le marché mais ses données ne sont pas encore résolues par l’analyse technique.`,'error');return false;}
    AT.hist.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    if(meta){const last=AT.hist[AT.hist.length-1];meta.textContent=`${AT.hist.length} séance${AT.hist.length>1?'s':''} • dernier cours ${Number(last.c||0).toLocaleString('fr-FR')} FCFA`+(last.date?' • '+last.date:'');}
    atRender(); if(typeof atUpdateWatchlist==='function')atUpdateWatchlist(); return true;
  }
  window.atLoadTicker=atLoadTicker;

  function atSetType(t,btn){AT.type=t;document.querySelectorAll('[id^="atBtn"]').forEach(b=>{if(['atBtnLine','atBtnCandle','atBtnHA','atBtnBar'].includes(b.id))b.classList.remove('on');});if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetType=atSetType;
  function atSetPeriod(n,btn){AT.period=n;document.querySelectorAll('.at-period-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetPeriod=atSetPeriod;
  function atSetInterval(v,btn){AT.interval=v;document.querySelectorAll('.at-interval-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');if(AT.hist.length)atRender();}
  window.atSetInterval=atSetInterval;
  window.atSetDraw=typeof window.atSetDraw==='function'?window.atSetDraw:function(){};
  window.atRender=typeof window.atRender==='function'?window.atRender:function(){};
  window.atInit=typeof window.atInit==='function'?window.atInit:function(){atInstallTickerSearch();atPopulateTickerSelect(true);return true;};
}