// THE CAPITAL — Dividend Intelligence Center
(function () {
  'use strict';
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  const esc = v => { const d=document.createElement('div'); d.textContent=v==null?'':String(v); return d.innerHTML; };
  const num = v => { if(v===''||v==null) return null; const n=Number(v); return Number.isFinite(n)?n:null; };
  const arr = k => Array.isArray(window[k]) ? window[k] : [];
  const divs = () => arr('allDividendes');
  const fins = () => arr('allFinancials');
  const cours = () => arr('allCours');
  const ymd = v => v ? String(v).slice(0,10) : '';
  const fmt = (v,d=2) => v==null ? '—' : Number(v).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct = v => v==null ? '—' : fmt(v,2)+' %';
  const ticker = v => String(v||'').toUpperCase().trim();
  // Aide contextuelle (memo.js) : icône « i » et terme souligné, bulle au survol, mémo complet au clic.
  const I = k => window.TCMemo ? window.TCMemo.icon(k) : '';
  const T = (k,l) => window.TCMemo && window.TCMemo.term ? window.TCMemo.term(k,l) : esc(l);

  function entOf(t){ return (window.entMap&&window.entMap[t])||{}; }
  function sectorOf(t){ const e=entOf(t); return e.secteur||e.sous_secteur||'Autre'; }
  function nameOf(t){ return entOf(t).nom||t; }
  function priceOf(t){
    const rows=cours().filter(r=>ticker(r.ticker)===t);
    if(!rows.length) return null;
    rows.sort((a,b)=>String(b.date_seance||'').localeCompare(String(a.date_seance||'')));
    return num(rows[0].cours_cloture??rows[0].cloture??rows[0].cours_normal??rows[0].cours);
  }
  function median(a){ a=a.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
  function mean(a){ a=a.filter(Number.isFinite); return a.length?a.reduce((s,v)=>s+v,0)/a.length:null; }
  // Moyenne par défaut, médiane si l'utilisateur l'a choisie (réglage partagé, cf. tcStatPref dans score-maison.js).
  const statLabel=()=>typeof window.tcStatLabel==='function'?window.tcStatLabel():'moyenne';
  function aggregate(a){ a=a.filter(Number.isFinite); if(!a.length)return null; return typeof window.tcAggregate==='function'?window.tcAggregate(a):mean(a); }
  const todayKey=()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const cancelled=r=>/annul|suspend/i.test(String(r.statut||''));

  // Un DPS versé avant une attribution gratuite / un fractionnement est ramené à la base d'actions actuelle
  // (entreprises.operations_capital, cf. state.js) : sans cela BOAB « perd » la moitié de son dividende en 2024.
  function shareFactor(t,day){
    let f=1; const ops=typeof window.tcCapitalOps==='function'?window.tcCapitalOps(t):[];
    ops.forEach(o=>{ if(day&&day<String(o.date).slice(0,10)) f/=Number(o.ratio); });
    return f;
  }

  // Historique des dividendes par titre : une entrée par exercice (acompte + solde additionnés, doublons exacts ignorés,
  // dividendes annulés ou suspendus écartés). dps = brut, net = net publié, tous deux retraités ; yield = rendement
  // enregistré à l'époque (en %, jamais la colonne « rendement » qui est une fraction).
  function historyByTicker(){
    const m={}, seen=new Set();
    divs().forEach(r=>{
      const t=ticker(r.ticker), y=num(r.exercice??r.annee); if(!t||y==null||cancelled(r))return;
      const ex=ymd(r.date_detachement??r.ex_date), pay=ymd(r.date_paiement_cal??r.date_paiement);
      const brut=num(r.montant), net=num(r.montant_net);
      const key=[t,y,ex,brut,net].join('|'); if(seen.has(key))return; seen.add(key);
      const f=shareFactor(t,ex||pay);
      const e=(m[t]||(m[t]={}))[y]||(m[t][y]={year:y,dps:null,net:null,yield:null,ex:'',pay:'',factor:f});
      if(brut!=null) e.dps=(e.dps||0)+brut*f;
      if(net!=null) e.net=(e.net||0)+net*f;
      const yl=num(r.taux_rendement); if(yl!=null&&yl>0&&e.yield==null) e.yield=yl;
      if(ex&&(!e.ex||ex>e.ex)) e.ex=ex; if(pay&&(!e.pay||pay>e.pay)) e.pay=pay;
    });
    const out={}; Object.keys(m).forEach(t=>{ out[t]=Object.values(m[t]).sort((a,b)=>a.year-b.year); }); return out;
  }
  // Comptes annuels de l'EXERCICE demandé, jamais ceux d'une autre année (un payout calculé sur un autre exercice est faux).
  function finFor(t,y){
    return fins().find(f=>ticker(f.ticker)===t&&(!f.periode||String(f.periode).toLowerCase()==='annuel')&&num(f.annee)===y)||null;
  }
  // Payout = DPA brut / BPA de l'exercice (BPA = résultat net / actions) ; la colonne payout_ratio, souvent périmée,
  // ne sert qu'en dernier recours.
  function payoutAt(t,e){
    const f=finFor(t,e.year); if(!f) return null;
    const bpa=num(f.bpa), dpa=num(f.dpa)!=null?num(f.dpa):e.dps;
    if(dpa!=null&&bpa>0) return dpa/bpa*100;
    const rn=num(f.resultat_net), sh=num(f.nombre_actions??f.nb_actions);
    if(e.dps!=null&&rn>0&&sh>0) return e.dps*sh/rn*100;
    const s=num(f.payout_ratio); return s!=null&&s>0?s:null;
  }
  const coverageOf=p=>p!=null&&p>0?100/p:null;
  // Flux de trésorerie libre (total, FCFA) ; absent pour les banques (pas de tableau de flux saisi).
  function fcf(f){ const ocf=num(f?.cash_flow_operationnel), capex=num(f?.capex); return ocf!=null&&capex!=null?ocf-Math.abs(capex):null; }
  // Dividendes totaux versés au titre de l'exercice = DPS brut × nombre d'actions (mêmes base retraitée des deux côtés).
  function totalDividends(t,e){ const f=finFor(t,e.year); const sh=num(f?.nombre_actions??f?.nb_actions); return e.dps!=null&&sh>0?e.dps*sh:null; }
  // TCAM du DPS sur EXACTEMENT n exercices (dernier exercice vs celui d'il y a n ans).
  function growth(h,n){
    if(!h||h.length<2) return null;
    const last=h[h.length-1], target=h.find(x=>x.year===last.year-n);
    if(!target||!(target.dps>0)||!(last.dps>0)) return null;
    return (Math.pow(last.dps/target.dps,1/n)-1)*100;
  }
  // Exercices consécutifs, jusqu'au dernier, avec un dividende strictement positif.
  function streak(h){
    let c=0,prev=null;
    for(let i=h.length-1;i>=0;i--){ const x=h[i]; if(!(x.dps>0))break; if(prev!=null&&prev-x.year!==1)break; c++; prev=x.year; }
    return c;
  }
  function forwardDps(t){
    const today=todayKey();
    const future=divs().filter(r=>ticker(r.ticker)===t&&!cancelled(r)).map(r=>({r,d:ymd(r.date_detachement??r.ex_date)})).filter(x=>x.d&&x.d>=today).sort((a,b)=>a.d.localeCompare(b.d));
    return future.length?num(future[0].r.montant):null;
  }

  let charts={}, selectedTicker='';
  function destroy(id){ if(charts[id]){try{charts[id].destroy();}catch(e){} delete charts[id];} }
  // Les options passées se FUSIONNENT avec les défauts (plugins, axes) au lieu de les remplacer.
  function mergeScales(b,o){
    const r={}; new Set([...Object.keys(b),...Object.keys(o)]).forEach(k=>{
      const x=b[k]||{}, y=o[k]||{};
      r[k]=Object.assign({},x,y,{ticks:Object.assign({},x.ticks,y.ticks),grid:Object.assign({},x.grid,y.grid)});
    }); return r;
  }
  function chart(id,type,data,options={}){
    const cv=document.getElementById(id); if(!cv||typeof window.Chart!=='function')return; destroy(id);
    const base={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{labels:{color:'#c8c0b5',font:{size:10}}},tooltip:{mode:'index',intersect:false}},scales:{x:{ticks:{color:'#8f877d',font:{size:9}},grid:{color:'rgba(255,255,255,.05)'}},y:{ticks:{color:'#8f877d',font:{size:9}},grid:{color:'rgba(255,255,255,.05)'}}}};
    const merged=Object.assign({},base,options,{plugins:Object.assign({},base.plugins,options.plugins||{}),scales:type==='radar'?(options.scales||{}):mergeScales(base.scales,options.scales||{})});
    charts[id]=new Chart(cv,{type,data,options:merged});
  }

  function injectCss(){
    if(document.getElementById('tc-dividend-intelligence-css'))return;
    const s=document.createElement('style'); s.id='tc-dividend-intelligence-css';
    s.textContent=`
      #view-dividend-screener .di-hero{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:0 0 16px}
      #view-dividend-screener .di-kpi{padding:15px;border:1px solid var(--border2);background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border-radius:10px}
      #view-dividend-screener .di-kpi-label{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}.di-kpi-value{font-size:21px;font-weight:700;margin-top:6px;color:var(--text)}.di-kpi-sub{font-size:10px;color:var(--dim);margin-top:3px}
      #view-dividend-screener .di-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.di-toolbar select,.di-toolbar input{min-width:145px}
      #view-dividend-screener .di-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.di-tab{background:transparent;color:var(--dim);border:1px solid var(--border2);padding:7px 11px;border-radius:7px;cursor:pointer}.di-tab.active{color:var(--gold);border-color:var(--gold)}
      #view-dividend-screener .di-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-bottom:16px}.di-grid.equal{grid-template-columns:1fr 1fr}
      #view-dividend-screener .di-chart{height:300px;position:relative}.di-chart.tall{height:350px}
      #view-dividend-screener .di-card-title{font-weight:700;font-size:13px}.di-card-meta{font-size:10px;color:var(--dim);margin-top:3px}
      #view-dividend-screener .di-pills{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.di-pill{padding:5px 8px;border-radius:999px;border:1px solid var(--border2);font-size:10px;color:var(--dim)}
      #view-dividend-screener .di-pill strong{color:var(--text)}
      #view-dividend-screener .di-actions{display:flex;gap:8px;flex-wrap:wrap}.di-actions button{cursor:pointer}
      #view-dividend-screener .di-table-row{cursor:pointer}.di-table-row:hover{background:rgba(255,255,255,.025)}
      #view-dividend-screener .di-badge{font-size:9px;padding:3px 7px;border:1px solid var(--border2);border-radius:999px;white-space:nowrap}.di-good{color:var(--green)!important;border-color:rgba(74,222,128,.35)!important}.di-warn{color:var(--red)!important;border-color:rgba(248,113,113,.35)!important}.di-mid{color:#f0a72a!important;border-color:rgba(240,167,42,.4)!important}#view-dividend-screener .tc-memo-i{margin-left:4px}
      #view-dividend-screener .di-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.di-day{min-height:76px;padding:7px;border:1px solid var(--border2);border-radius:7px;background:rgba(255,255,255,.015)}.di-day small{color:var(--dim)}.di-event{margin-top:5px;font-size:9px;color:var(--gold);cursor:pointer}
      #view-dividend-screener .di-calc{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.di-calc-result{font-size:18px;font-weight:700;color:var(--gold)}
      @media(max-width:1000px){#view-dividend-screener .di-hero{grid-template-columns:repeat(3,1fr)}#view-dividend-screener .di-grid,#view-dividend-screener .di-grid.equal{grid-template-columns:1fr}}
      @media(max-width:600px){#view-dividend-screener .di-hero{grid-template-columns:repeat(2,1fr)}#view-dividend-screener .di-calc{grid-template-columns:1fr 1fr}.di-calendar{grid-template-columns:repeat(2,1fr)!important}}
    `;
    document.head.appendChild(s);
  }

  function kpis(rows){
    const yields=rows.map(r=>r.y).filter(v=>v!=null), g=rows.map(r=>r.g3).filter(v=>v!=null);
    return {avg:mean(yields),med:median(yields),max:yields.length?Math.max(...yields):null,count:rows.length,avgGrowth:mean(g)};
  }

  // Une ligne par titre : dernier exercice distribué. Rendement courant = dernier DPS brut / dernier cours ;
  // à défaut de cours, rendement enregistré à l'époque.
  function datasetRows(){
    const hm=historyByTicker();
    return Object.keys(hm).map(t=>{
      const h=hm[t], last=h[h.length-1]; if(!last) return null;
      const price=priceOf(t), fd=forwardDps(t), p=payoutAt(t,last), f=finFor(t,last.year);
      const yNow=last.dps>0&&price>0?last.dps/price*100:null;
      return {t,name:nameOf(t),sector:sectorOf(t),year:last.year,dps:last.dps,net:last.net,y:yNow!=null?yNow:last.yield,g3:growth(h,3),g5:growth(h,5),payout:p,coverage:coverageOf(p),fcf:fcf(f),streak:streak(h),price,forwardYield:fd!=null&&price>0?fd/price*100:null,h};
    }).filter(Boolean);
  }

  function build(){
    const view=document.getElementById('view-dividend-screener'); if(!view)return; injectCss();
    if(view.dataset.built==='1'){renderAll();return;} view.dataset.built='1';
    view.innerHTML=`
      <div class="page-header"><h1>Dividend <span style="color:var(--gold)">Intelligence</span></h1><p>Analysez rendement, croissance, couverture, soutenabilité et calendrier des dividendes BRVM.</p></div>
      <div class="di-hero" id="diKpis"></div>
      <div class="card mb20"><div class="card-body"><div class="di-toolbar">
        <select id="diTicker"><option value="">Choisir une société…</option></select>
        <select id="diSector"><option value="">Tous les secteurs</option></select>
        <input id="diMinYield" type="number" placeholder="Yield min %" step=".1"><input id="diMaxYield" type="number" placeholder="Yield max %" step=".1">
        <input id="diMinGrowth" type="number" placeholder="Growth min %" step=".1">
        <select id="diPeriod"><option value="all">Tout l'historique</option><option value="3">3 ans</option><option value="5" selected>5 ans</option><option value="10">10 ans</option></select>
      </div></div></div>
      <div class="di-tabs"><button class="di-tab active" data-tab="overview">Overview</button><button class="di-tab" data-tab="screener">Screener</button><button class="di-tab" data-tab="calendar">Calendrier</button><button class="di-tab" data-tab="compare">Comparer</button><button class="di-tab" data-tab="sustain">Soutenabilité</button><button class="di-tab" data-tab="calculator">Calculateur</button></div>
      <div id="diOverview">
        <div class="di-grid"><div class="card"><div class="card-header"><div><div class="di-card-title">Dividend Yield vs Growth</div><div class="di-card-meta">Chaque bulle représente une société · axes : rendement courant (DPS brut / cours) et croissance du DPS sur 3 exercices</div></div></div><div class="card-body"><div class="di-chart tall"><canvas id="diScatter"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div><div class="di-card-title">Profil du titre</div><div class="di-card-meta" id="diProfileMeta">Sélectionnez une société</div></div></div><div class="card-body"><div id="diProfilePills"></div><div class="di-chart"><canvas id="diProfileChart"></canvas></div></div></div></div>
        <div class="di-grid equal"><div class="card"><div class="card-header"><div class="di-card-title">Dividend Yield historique</div></div><div class="card-body"><div class="di-chart"><canvas id="diYieldHistory"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div class="di-card-title">Payout & Dividend Coverage</div></div><div class="card-body"><div class="di-chart"><canvas id="diPayoutHistory"></canvas></div></div></div></div>
        <div class="di-grid equal"><div class="card"><div class="card-header"><div class="di-card-title">Yield moyen par secteur</div></div><div class="card-body"><div class="di-chart"><canvas id="diSectorChart"></canvas></div></div></div>
        <div class="card"><div class="card-header"><div class="di-card-title">FCF vs Dividendes totaux</div></div><div class="card-body"><div class="di-chart"><canvas id="diFcfChart"></canvas></div></div></div></div>
      </div>
      <div id="diScreener" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Résultats du screener</div><div id="diCount" style="font-size:11px;color:var(--dim)"></div></div><div class="table-wrap"><table><thead><tr><th>Société</th><th>Secteur</th><th class="right">Yield${I('rendement')}</th><th class="right">Growth 3Y${I('croissance-dps')}</th><th class="right">Growth 5Y${I('croissance-dps')}</th><th class="right">Payout${I('payout')}</th><th class="right">Coverage${I('couverture-dividende')}</th><th class="right">Forward Yield${I('rendement-prospectif')}</th><th>Régularité${I('regularite-dividende')}</th></tr></thead><tbody id="diTable"></tbody></table></div></div></div>
      <div id="diCalendar" style="display:none"><div class="card mb20"><div class="card-header"><div class="card-title">Calendrier des dividendes</div><div class="di-actions"><button id="diPrev">←</button><button id="diNext">→</button></div></div><div class="card-body"><div id="diCalendarGrid" class="di-calendar"></div></div></div><div class="card"><div class="card-header"><div class="card-title">Prochains détachements</div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Ex-Date</th><th>Payment Date</th><th>Yield</th><th>Statut</th></tr></thead><tbody id="diUpcoming"></tbody></table></div></div></div>
      <div id="diCompare" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Comparaison multi-actions</div></div><div class="card-body"><div id="diComparePicks" class="di-pills"></div><div class="di-chart tall"><canvas id="diCompareChart"></canvas></div><div class="table-wrap"><table><thead><tr><th>Indicateur</th><th id="cmpH1">—</th><th id="cmpH2">—</th><th id="cmpH3">—</th><th id="cmpH4">—</th></tr></thead><tbody id="diCompareTable"></tbody></table></div></div></div></div>
      <div id="diSustain" style="display:none"><div class="card mb20"><div class="card-header"><div><div class="di-card-title" id="diSusTitle">Soutenabilité du dividende</div><div class="di-card-meta" id="diSusMeta">Coussins de sécurité, réserves et coût du risque</div></div></div><div class="card-body"><div class="di-pills" id="diSusPills"></div><div id="diSusReading"></div></div></div><div class="card"><div class="card-header"><div class="card-title">Soutenabilité · tous les titres du périmètre</div></div><div class="table-wrap"><table><thead><tr><th>Société</th><th class="right">Payout${I('payout')}</th><th class="right">Réserves${I('reserves')}</th><th class="right">Réserves / dividendes${I('reserves-annees')}</th><th class="right">Fonds propres / actif${I('coussin-fp')}</th><th class="right">Après distribution${I('coussin-apres-distribution')}</th><th class="right">Coût du risque / PNB${I('cout-du-risque')}</th><th class="right">Couverture avant risque${I('couverture-avant-risque')}</th><th>Verdict${I('soutenabilite-dividende')}</th></tr></thead><tbody id="diSusTable"></tbody></table></div></div></div>
      <div id="diCalculator" style="display:none"><div class="card"><div class="card-header"><div class="card-title">Calculateur de revenus de dividendes</div></div><div class="card-body"><div class="di-calc"><div><label>Capital investi (FCFA)</label><input id="diCapital" type="number" value="10000000"></div><div><label>Prix par action</label><input id="diCalcPrice" type="number"></div><div><label>DPS annuel net (FCFA)</label><input id="diCalcDps" type="number"></div><div><label>Croissance annuelle</label><input id="diCalcGrowth" type="number" value="0" step=".1"></div></div><div class="di-pills" style="margin-top:18px"><div class="di-pill">Actions <strong id="diCalcShares">—</strong></div><div class="di-pill">Dividende annuel <strong class="di-calc-result" id="diCalcIncome">—</strong></div><div class="di-pill">Yield on Cost <strong id="diCalcYoc">—</strong></div><div class="di-pill">Revenu mensuel <strong id="diCalcMonthly">—</strong></div></div><div class="di-chart"><canvas id="diIncomeChart"></canvas></div></div></div></div>`;
    bind();
  }
  const calcTouched={};
  let cache={rows:[]};
  let calDate=new Date(new Date().getFullYear(),new Date().getMonth(),1);

  function bind(){
    // Changer de société réinitialise prix et DPS du calculateur (sinon ils restent ceux du titre précédent).
    document.getElementById('diTicker')?.addEventListener('change',()=>{selectedTicker=document.getElementById('diTicker').value;calcTouched.diCalcPrice=false;calcTouched.diCalcDps=false;});
    ['diTicker','diSector','diPeriod'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderAll));
    ['diMinYield','diMaxYield','diMinGrowth'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderAll));
    // Le calculateur ne redessine que lui-même : pas tout le tableau à chaque frappe.
    ['diCapital','diCalcPrice','diCalcDps','diCalcGrowth'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{calcTouched[id]=true;renderCalculator();}));
    document.querySelectorAll('#view-dividend-screener .di-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#view-dividend-screener .di-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');showTab(b.dataset.tab);}));
    document.getElementById('diPrev')?.addEventListener('click',()=>calendarMove(-1));
    document.getElementById('diNext')?.addEventListener('click',()=>calendarMove(1));
  }

  function syncSelectors(rows){
    const tsel=document.getElementById('diTicker'), sec=document.getElementById('diSector'); if(!tsel||!sec)return;
    const old=tsel.value||selectedTicker, oldS=sec.value;
    tsel.innerHTML='<option value="">Choisir une société…</option>'+rows.slice().sort((a,b)=>a.t.localeCompare(b.t)).map(r=>'<option value="'+esc(r.t)+'">'+esc(r.t+' · '+r.name)+'</option>').join('');
    tsel.value=rows.some(r=>r.t===old)?old:'';
    const sectors=[...new Set(rows.map(r=>r.sector))].sort();
    sec.innerHTML='<option value="">Tous les secteurs</option>'+sectors.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
    sec.value=sectors.includes(oldS)?oldS:'';
    selectedTicker=tsel.value;
  }
  // Un critère renseigné exclut les titres dont la valeur est inconnue (null n'est pas 0).
  function filtered(rows){
    const sec=document.getElementById('diSector')?.value||'', min=num(document.getElementById('diMinYield')?.value), max=num(document.getElementById('diMaxYield')?.value), mg=num(document.getElementById('diMinGrowth')?.value);
    return rows.filter(r=>(!sec||r.sector===sec)&&(min==null||(r.y!=null&&r.y>=min))&&(max==null||(r.y!=null&&r.y<=max))&&(mg==null||(r.g3!=null&&r.g3>=mg)));
  }
  function showTab(tab){
    ['Overview','Screener','Calendar','Compare','Sustain','Calculator'].forEach(x=>{const el=document.getElementById('di'+x);if(el)el.style.display=x.toLowerCase()===tab?'':'none';});
    renderAll();
  }
  function periodSlice(h){ const p=document.getElementById('diPeriod')?.value||'5'; return p==='all'?h:h.slice(-Number(p)); }

  function renderAll(){
    const rows=datasetRows(); cache.rows=rows; syncSelectors(rows); const out=filtered(rows), k=kpis(out), today=todayKey();
    const upcoming=divs().filter(r=>!cancelled(r)&&ymd(r.date_detachement??r.ex_date)>=today).length;
    document.getElementById('diKpis').innerHTML=[
      ['Dividend Yield moyen',pct(k.avg),'sur le périmètre filtré','rendement'],['Yield médian',pct(k.med),'moins sensible aux extrêmes','rendement'],['Plus haut Yield',pct(k.max),'titre le plus élevé','rendement'],['Croissance moyenne 3Y',pct(k.avgGrowth),'TCAM du DPS quand disponible','croissance-dps'],['Titres distributifs',k.count,'dans le périmètre',''],['Détachements à venir',upcoming,'calendrier BRVM','']
    ].map(x=>'<div class="di-kpi"><div class="di-kpi-label">'+x[0]+(x[3]?I(x[3]):'')+'</div><div class="di-kpi-value">'+x[1]+'</div><div class="di-kpi-sub">'+x[2]+'</div></div>').join('');
    renderScatter(out); renderProfile(rows); renderSector(out); renderScreener(out); renderCalendar(); renderCompare(rows); renderSustain(rows,out); renderCalculator();
  }

  function renderScatter(rows){
    const pts=rows.filter(r=>r.y!=null&&r.g3!=null).map(r=>({x:r.y,y:r.g3,r}));
    chart('diScatter','scatter',{datasets:[{label:'Titres',data:pts,backgroundColor:'rgba(212,175,55,.72)',borderColor:'rgba(212,175,55,.9)',pointRadius:5,pointHoverRadius:8}]},{plugins:{tooltip:{callbacks:{label:c=>{const r=c.raw.r;return r.t+' · Yield '+pct(r.y)+' · Growth '+pct(r.g3);}}}},scales:{x:{title:{display:true,text:'Dividend Yield (%)',color:'#9e978e'}},y:{title:{display:true,text:'Dividend Growth 3Y (%)',color:'#9e978e'}}}});
  }

  function renderProfile(rows){
    const t=document.getElementById('diTicker')?.value||selectedTicker||rows[0]?.t; if(!t)return;
    const r=rows.find(x=>x.t===t)||rows[0]; if(!r)return; selectedTicker=r.t;
    const meta=document.getElementById('diProfileMeta'); if(meta)meta.textContent=r.t+' · '+r.name+' · '+r.sector+' · exercice '+r.year;
    const adjusted=r.h.some(x=>x.factor!==1);
    document.getElementById('diProfilePills').innerHTML=[['Yield',pct(r.y),'rendement'],['Forward Yield',pct(r.forwardYield),'rendement-prospectif'],['Growth 3Y',pct(r.g3),'croissance-dps'],['Growth 5Y',pct(r.g5),'croissance-dps'],['Payout',pct(r.payout),'payout'],['Coverage',r.coverage?fmt(r.coverage,2)+'x':'—','couverture-dividende'],['Streak',r.streak+' ans','regularite-dividende'],['Prix',r.price?fmt(r.price,0)+' FCFA':'—','']].map(x=>'<span class="di-pill">'+x[0]+(x[2]?I(x[2]):'')+' <strong>'+x[1]+'</strong></span>').join('')+(adjusted?'<span class="di-pill">DPS <strong>'+T('retraitement-actions','retraités des opérations sur le capital')+'</strong></span>':'');
    const h=periodSlice(r.h), labels=h.map(x=>x.year);
    chart('diProfileChart','bar',{labels,datasets:[{label:'DPS brut',data:h.map(x=>x.dps),backgroundColor:'rgba(212,175,55,.45)',borderColor:'rgba(212,175,55,.9)',borderWidth:1},{label:'DPS net',data:h.map(x=>x.net),backgroundColor:'rgba(96,165,250,.35)',borderColor:'rgba(96,165,250,.8)',borderWidth:1}]});
    chart('diYieldHistory','line',{labels,datasets:[{label:'Yield à l\'époque',data:h.map(x=>x.yield),borderColor:'rgba(212,175,55,.95)',backgroundColor:'rgba(212,175,55,.12)',fill:true,tension:.3,pointRadius:3,spanGaps:true}]},{plugins:{legend:{display:false}}});
    const pay=h.map(x=>payoutAt(r.t,x));
    chart('diPayoutHistory','line',{labels,datasets:[{label:'Payout %',data:pay,borderColor:'rgba(212,175,55,.95)',tension:.3,spanGaps:true},{label:'Coverage x',data:pay.map(coverageOf),borderColor:'rgba(96,165,250,.9)',tension:.3,yAxisID:'y2',spanGaps:true}]},{scales:{y:{title:{display:true,text:'Payout %',color:'#9e978e'}},y2:{position:'right',title:{display:true,text:'Coverage x',color:'#9e978e'},grid:{drawOnChartArea:false}}}});
    // Totaux en milliards de FCFA des deux côtés (FCF total contre dividendes totaux, pas contre un DPS par action).
    const md=v=>v==null?null:Math.round(v/1e7)/100, fcfData=h.map(x=>md(fcf(finFor(r.t,x.year)))), hasFcf=fcfData.some(v=>v!=null);
    chart('diFcfChart','bar',{labels,datasets:[{label:'FCF (Md FCFA)',data:fcfData,backgroundColor:'rgba(96,165,250,.38)'},{label:'Dividendes totaux (Md FCFA)',data:h.map(x=>md(totalDividends(r.t,x))),backgroundColor:'rgba(212,175,55,.48)'}]},{plugins:{title:{display:!hasFcf,text:'FCF indisponible (banque ou tableau de flux non saisi) : dividendes totaux seuls',color:'#9e978e',font:{size:10}}}});
  }

  function renderSector(rows){
    const m={}; rows.forEach(r=>{if(r.y!=null)(m[r.sector]||(m[r.sector]=[])).push(r.y);});
    const a=Object.keys(m).map(s=>({s,y:aggregate(m[s])})).filter(x=>x.y!=null).sort((x,y)=>y.y-x.y);
    chart('diSectorChart','bar',{labels:a.map(x=>x.s),datasets:[{label:'Yield '+statLabel()+' %',data:a.map(x=>x.y),backgroundColor:'rgba(212,175,55,.48)',borderColor:'rgba(212,175,55,.9)',borderWidth:1}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  }

  function renderScreener(rows){
    const tb=document.getElementById('diTable'); if(!tb)return; document.getElementById('diCount').textContent=rows.length+' résultat(s)';
    tb.innerHTML=rows.slice().sort((a,b)=>(b.y??-999)-(a.y??-999)).map(r=>'<tr class="di-table-row" onclick="openFiche && openFiche(\''+esc(r.t)+'\',\'dividend-screener\')"><td><strong style="color:var(--gold)">'+esc(r.t)+'</strong><div style="font-size:10px;color:var(--dim)">'+esc(r.name)+' · exercice '+esc(r.year)+'</div></td><td>'+esc(r.sector)+'</td><td class="right">'+pct(r.y)+'</td><td class="right">'+pct(r.g3)+'</td><td class="right">'+pct(r.g5)+'</td><td class="right">'+pct(r.payout)+'</td><td class="right">'+(r.coverage?fmt(r.coverage,2)+'x':'—')+'</td><td class="right">'+pct(r.forwardYield)+'</td><td><span class="di-badge '+(r.streak>=3?'di-good':'')+'">'+r.streak+' ans</span></td></tr>').join('')||'<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">Aucune donnée.</td></tr>';
  }

  function calendarRows(){ return divs().filter(r=>!cancelled(r)).map(r=>({t:ticker(r.ticker),ex:ymd(r.date_detachement??r.ex_date),pay:ymd(r.date_paiement_cal??r.date_paiement),y:num(r.taux_rendement),net:num(r.montant_net),brut:num(r.montant),status:r.statut||'—'})).filter(r=>r.ex).sort((a,b)=>a.ex.localeCompare(b.ex)); }
  function calendarMove(d){ calDate=new Date(calDate.getFullYear(),calDate.getMonth()+d,1); renderCalendar(); }
  const keyOf=(y,m,d)=>y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  function renderCalendar(){
    const rows=calendarRows(), y=calDate.getFullYear(), m=calDate.getMonth(), first=new Date(y,m,1), last=new Date(y,m+1,0), grid=document.getElementById('diCalendarGrid'); if(!grid)return;
    const title=document.querySelector('#diCalendar .card-title'); if(title)title.textContent='Calendrier des dividendes · '+first.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    const names=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; let html=names.map(n=>'<div class="di-day" style="min-height:auto;font-weight:700;color:var(--dim)">'+n+'</div>').join(''); const offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++)html+='<div class="di-day" style="opacity:.25"></div>';
    for(let d=1;d<=last.getDate();d++){
      const key=keyOf(y,m,d), ev=rows.filter(r=>r.ex===key);
      html+='<div class="di-day"><small>'+d+'</small>'+ev.map(r=>'<div class="di-event" title="Détachement · '+esc(r.status)+'" onclick="openFiche && openFiche(\''+esc(r.t)+'\',\'dividend-screener\')">'+esc(r.t)+' · '+(r.net!=null?fmt(r.net,r.net%1?2:0)+' F net':r.brut!=null?fmt(r.brut,0)+' F':pct(r.y))+'</div>').join('')+'</div>';
    }
    grid.innerHTML=html;
    const today=todayKey(), up=rows.filter(r=>r.ex>=today).slice(0,20);
    document.getElementById('diUpcoming').innerHTML=up.map(r=>'<tr><td><strong style="color:var(--gold)">'+esc(r.t)+'</strong></td><td>'+esc(r.ex.split('-').reverse().join('/'))+'</td><td>'+esc(r.pay?r.pay.split('-').reverse().join('/'):'—')+'</td><td>'+(r.net!=null?fmt(r.net,r.net%1?2:0)+' F net':pct(r.y))+'</td><td>'+esc(r.status)+'</td></tr>').join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--dim)">Aucun détachement futur disponible.</td></tr>';
  }

  function renderCompare(rows){
    const holder=document.getElementById('diComparePicks'); if(!holder)return;
    const valid=(window.__tcDividendCompare||[]).filter(t=>rows.some(r=>r.t===t));
    window.__tcDividendCompare=valid.length?valid:rows.filter(r=>r.y!=null).sort((a,b)=>b.y-a.y).slice(0,4).map(r=>r.t);
    const final=[...new Set(window.__tcDividendCompare)].slice(0,4);
    holder.innerHTML=rows.map(r=>'<button class="di-pill '+(final.includes(r.t)?'di-good':'')+'" style="cursor:pointer" onclick="var a=window.__tcDividendCompare=window.__tcDividendCompare||[],i=a.indexOf(\''+esc(r.t)+'\');if(i>=0)a.splice(i,1);else if(a.length<4)a.push(\''+esc(r.t)+'\');renderDividendScreener();">'+esc(r.t)+'</button>').join('');
    const selected=final.map(t=>rows.find(r=>r.t===t)).filter(Boolean); ['cmpH1','cmpH2','cmpH3','cmpH4'].forEach((id,i)=>{const el=document.getElementById(id); if(el)el.textContent=selected[i]?.t||'—';});
    const metrics=[['Yield','y','%'],['Growth 3Y','g3','%'],['Growth 5Y','g5','%'],['Payout','payout','%'],['Coverage','coverage','x'],['Forward Yield','forwardYield','%'],['Streak','streak','ans']];
    document.getElementById('diCompareTable').innerHTML=metrics.map(mt=>'<tr><td>'+mt[0]+'</td>'+[0,1,2,3].map(i=>'<td>'+(selected[i]&&selected[i][mt[1]]!=null?fmt(selected[i][mt[1]],2)+(mt[2]==='x'?'x':mt[2]==='ans'?' ans':' %'):'—')+'</td>').join('')+'</tr>').join('');
    // Radar : chaque axe est ramené à 0-100 par rapport au meilleur titre du marché (les unités % et x ne sont pas comparables telles quelles).
    const axes=[['Yield','y'],['Growth 3Y','g3'],['Growth 5Y','g5'],['Coverage','coverage'],['Forward Yield','forwardYield']];
    const maxOf=k=>Math.max(1e-9,...rows.map(r=>Math.max(0,r[k]||0)));
    chart('diCompareChart','radar',{labels:axes.map(a=>a[0]),datasets:selected.map((r,i)=>({label:r.t,data:axes.map(a=>Math.round(Math.max(0,r[a[1]]||0)/maxOf(a[1])*100)),real:axes.map(a=>r[a[1]]),borderColor:['rgba(212,175,55,.9)','rgba(96,165,250,.85)','rgba(74,222,128,.85)','rgba(248,113,113,.85)'][i%4],backgroundColor:'transparent'}))},{plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+' : '+(c.dataset.real[c.dataIndex]!=null?fmt(c.dataset.real[c.dataIndex],2):'—')+' (indice '+c.raw+'/100)'}}},scales:{r:{min:0,max:100,angleLines:{color:'rgba(255,255,255,.08)'},grid:{color:'rgba(255,255,255,.08)'},pointLabels:{color:'#9e978e',font:{size:10}},ticks:{display:false}}}});
  }

  function renderCalculator(){
    const el=id=>document.getElementById(id); if(!el('diCapital'))return;
    const t=el('diTicker')?.value||selectedTicker, r=(cache.rows.length?cache.rows:datasetRows()).find(x=>x.t===t);
    const P=el('diCalcPrice'), D=el('diCalcDps');
    if(P&&!calcTouched.diCalcPrice&&r&&r.price!=null)P.value=r.price;
    if(D&&!calcTouched.diCalcDps&&r&&(r.net??r.dps)!=null)D.value=r.net??r.dps;
    const cap=num(el('diCapital').value)||0, price=num(P?.value), dps=num(D?.value)||0, g=num(el('diCalcGrowth')?.value)||0;
    const shares=price>0?Math.floor(cap/price):0, income=shares*dps, yoc=cap>0?income/cap*100:0;
    el('diCalcShares').textContent=fmt(shares,0);el('diCalcIncome').textContent=fmt(income,0)+' FCFA';el('diCalcYoc').textContent=pct(yoc);el('diCalcMonthly').textContent=fmt(income/12,0)+' FCFA';
    const labels=Array.from({length:6},(_,i)=>'An '+i), vals=labels.map((_,i)=>income*Math.pow(1+g/100,i));
    chart('diIncomeChart','line',{labels,datasets:[{label:'Revenu annuel projeté',data:vals,borderColor:'rgba(212,175,55,.95)',backgroundColor:'rgba(212,175,55,.1)',fill:true,tension:.3}]},{plugins:{legend:{display:false}}});
  }

  // ── Soutenabilité du dividende : bénéfice, réserves, coussins de fonds propres et, pour une banque, coût du risque ──
  const isBank=t=>/banq|financ/i.test(String((entOf(t).sous_secteur||'')+' '+(entOf(t).secteur||'')));
  const Md=v=>v==null?'—':fmt(v/1e9,2)+' Md';
  const ratioX=v=>v==null?'—':fmt(v,2)+'x';
  function costOfRisk(f){ const rbe=num(f?.rbe??f?.ebitda), re=num(f?.resultat_exploitation??f?.ebit); return rbe!=null&&re!=null?rbe-re:null; }

  function sustainOf(t,e){
    const f=finFor(t,e.year); if(!f) return null;
    const fp=num(f.fonds_propres??f.capitaux_propres), ta=num(f.total_actif), rn=num(f.resultat_net), cap=num(f.capital_social), pr=num(f.primes_reserves), ran=num(f.report_a_nouveau);
    const total=totalDividends(t,e), bank=isBank(t), rbe=num(f.rbe??f.ebitda), pnb=num(f.chiffre_affaires);
    // Réserves accumulées : primes + réserves + report à nouveau ; à défaut fonds propres − capital − résultat de l'exercice.
    const reserves=pr!=null?pr+(ran||0):(fp!=null&&cap!=null&&rn!=null?fp-cap-rn:null);
    const p=payoutAt(t,e), o={year:e.year,bank,total,rn,fp,ta,reserves,payout:p,f};
    o.resYears=reserves!=null&&total>0?reserves/total:null;
    o.retained=rn!=null&&total!=null?rn-total:null;
    o.fpTa=fp!=null&&ta>0?fp/ta*100:null;
    o.fpTaAfter=fp!=null&&ta>0&&total!=null?(fp-total)/ta*100:null;
    if(bank){
      o.cor=costOfRisk(f); o.corPnb=o.cor!=null&&pnb>0?o.cor/pnb*100:null;
      const prev=finFor(t,e.year-1); o.corPrev=prev?costOfRisk(prev):null;
      o.rbe=rbe; o.beforeRisk=rbe!=null&&total>0?rbe/total:null;
      o.riskMargin=rbe!=null&&total!=null&&o.cor>0?(rbe-total)/o.cor:null;
    } else {
      const cash=num(f.tresorerie_actif), fc=fcf(f);
      o.cashYears=cash!=null&&total>0?cash/total:null; o.fcfCover=fc!=null&&total>0?fc/total:null;
    }
    // Alertes : repères usuels, jamais un verdict d'investissement.
    const al=[];
    if(p!=null&&p>100) al.push('Le dividende dépasse le bénéfice : il est en partie payé sur les réserves.');
    else if(p!=null&&p>85) al.push('Taux de distribution supérieur à 85 % : peu de marge si le bénéfice recule.');
    if(o.resYears!=null&&o.resYears<1) al.push('Les réserves ne couvrent pas une année de dividendes.');
    if(bank){
      if(o.corPnb!=null&&o.corPnb>15) al.push('Coût du risque supérieur à 15 % du produit net bancaire.');
      if(o.cor!=null&&o.corPrev!=null&&o.cor>0&&o.cor>2*Math.max(o.corPrev,0)&&o.cor-Math.max(o.corPrev,0)>0.02*(pnb||0)) al.push('Le coût du risque a plus que doublé en un an.');
      if(o.beforeRisk!=null&&o.beforeRisk<1.5) al.push('Avant coût du risque, le dividende n\'est couvert que ' + fmt(o.beforeRisk,2) + ' fois.');
    } else if(o.fcfCover!=null&&o.fcfCover<1) al.push('Le flux de trésorerie libre ne couvre pas le dividende.');
    o.alerts=al; o.level=al.length===0?'good':al.length===1?'mid':'warn';
    o.label=al.length===0?'Solide':al.length===1?'À surveiller':'Fragile';
    return o;
  }

  function renderSustain(rows,out){
    const host=document.getElementById('diSustain'); if(!host)return;
    const t=document.getElementById('diTicker')?.value||selectedTicker||rows[0]?.t, r=rows.find(x=>x.t===t)||rows[0];
    const pills=document.getElementById('diSusPills'), reading=document.getElementById('diSusReading'), meta=document.getElementById('diSusMeta'), title=document.getElementById('diSusTitle');
    const s=r?sustainOf(r.t,r.h[r.h.length-1]):null;
    if(title)title.textContent='Soutenabilité du dividende'+(r?' · '+r.t:'');
    if(!r){ if(pills)pills.innerHTML=''; if(reading)reading.innerHTML='<div class="fch-muted" style="color:var(--dim)">Aucun titre distributif.</div>'; }
    else if(!s){
      if(meta)meta.textContent=r.name+' · exercice '+r.year;
      if(pills)pills.innerHTML=''; if(reading)reading.innerHTML='<div style="color:var(--dim)">Les états financiers annuels de l\'exercice '+esc(r.year)+' ne sont pas encore saisis pour ce titre : la soutenabilité n\'est pas calculable, plutôt que estimée sur un autre exercice.</div>';
    } else {
      if(meta)meta.textContent=r.name+' · exercice '+s.year+' · '+(s.bank?'banque : coût du risque pris en compte':'société non financière : flux de trésorerie pris en compte');
      const P=(k,label,val)=>'<span class="di-pill">'+T(k,label)+' <strong>'+val+'</strong></span>';
      pills.innerHTML=[
        P('payout','Payout',pct(s.payout)),P('reserves','Réserves',Md(s.reserves)),P('reserves-annees','Réserves / dividendes',s.resYears!=null?fmt(s.resYears,1)+' ans':'—'),
        P('coussin-fp','Fonds propres / actif',pct(s.fpTa)),P('coussin-apres-distribution','Après distribution',pct(s.fpTaAfter)),
        s.bank?P('cout-du-risque','Coût du risque',s.cor!=null?Md(s.cor)+(s.corPnb!=null?' ('+fmt(s.corPnb,1)+' % du PNB)':''):'—'):P('tresorerie-dividende','Trésorerie / dividendes',s.cashYears!=null?fmt(s.cashYears,1)+' ans':'—'),
        s.bank?P('couverture-avant-risque','Couverture avant risque',ratioX(s.beforeRisk)):P('fcf-dividendes','FCF / dividendes',ratioX(s.fcfCover))
      ].join('')+'<span class="di-badge di-'+s.level+'" style="align-self:center">'+T('soutenabilite-dividende',s.label)+'</span>';
      const L=[];
      if(s.total!=null&&s.rn!=null) L.push('Le dividende de l\'exercice '+s.year+' représente '+Md(s.total)+' pour un '+(s.rn>=0?'bénéfice':'résultat')+' de '+Md(s.rn)+' : '+(s.retained>=0?Md(s.retained)+' sont mis en réserves.':Md(-s.retained)+' sont prélevés sur les réserves.'));
      if(s.reserves!=null) L.push('Les '+T('reserves','réserves accumulées')+' atteignent '+Md(s.reserves)+(s.resYears!=null?', soit '+fmt(s.resYears,1)+' année(s) de dividendes au rythme actuel : c\'est le matelas qui permettrait de tenir en cas de mauvais exercice (une partie reste indisponible : réserve légale).':'.'));
      if(s.fpTa!=null) L.push('Les fonds propres financent '+fmt(s.fpTa,1)+' % du bilan'+(s.fpTaAfter!=null?' ; après ce dividende, le '+T('coussin-fp','coussin')+' serait de '+fmt(s.fpTaAfter,1)+' %, soit '+fmt(s.fpTa-s.fpTaAfter,1)+' point(s) de moins sans le bénéfice de l\'année suivante.':'.'));
      if(s.bank){
        if(s.cor!=null) L.push('Le '+T('cout-du-risque','coût du risque')+' est de '+Md(s.cor)+(s.corPnb!=null?', soit '+fmt(s.corPnb,1)+' % du '+T('pnb','produit net bancaire'):'')+(s.corPrev!=null?', contre '+Md(s.corPrev)+' l\'exercice précédent':'')+' : c\'est la ligne qui fait varier le bénéfice, donc le dividende.');
        if(s.beforeRisk!=null) L.push('Avant provisions, le '+T('rbe','résultat brut d\'exploitation')+' couvre '+fmt(s.beforeRisk,2)+' fois le dividende'+(s.riskMargin!=null&&s.riskMargin>=1?' : le coût du risque pourrait être multiplié par '+fmt(s.riskMargin,1)+' avant que le dividende ne soit plus couvert ('+T('marge-securite-risque','marge de sécurité')+', avant impôt et hors évolution du PNB).':'.'));
      } else {
        if(s.fcfCover!=null) L.push('Le flux de trésorerie libre couvre '+fmt(s.fcfCover,2)+' fois le dividende total.');
        if(s.cashYears!=null) L.push('La trésorerie représente '+fmt(s.cashYears,1)+' année(s) de dividendes.');
      }
      if(r.h.some(x=>x.factor!==1)) L.push('Les dividendes d\'avant l\'opération sur le capital sont '+T('retraitement-actions','retraités')+' pour rester comparables.');
      L.push(s.alerts.length?'<strong>Points d\'attention :</strong><ul style="margin:6px 0 0 18px">'+s.alerts.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':'Aucun point d\'attention sur les critères ci-dessus.');
      reading.innerHTML='<ul style="margin:0 0 0 18px;line-height:1.7;font-size:13px">'+L.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
    }
    const tb=document.getElementById('diSusTable'); if(!tb)return;
    const lines=out.map(x=>({x,s:sustainOf(x.t,x.h[x.h.length-1])}));
    tb.innerHTML=lines.map(({x,s})=>s?'<tr class="di-table-row" onclick="openFiche && openFiche(\''+esc(x.t)+'\',\'dividend-screener\')"><td><strong style="color:var(--gold)">'+esc(x.t)+'</strong><div style="font-size:10px;color:var(--dim)">'+esc(x.name)+' · exercice '+esc(s.year)+'</div></td><td class="right">'+pct(s.payout)+'</td><td class="right">'+Md(s.reserves)+'</td><td class="right">'+(s.resYears!=null?fmt(s.resYears,1)+' ans':'—')+'</td><td class="right">'+pct(s.fpTa)+'</td><td class="right">'+pct(s.fpTaAfter)+'</td><td class="right">'+(s.bank?(s.corPnb!=null?fmt(s.corPnb,1)+' %':'—'):'n/a')+'</td><td class="right">'+(s.bank?ratioX(s.beforeRisk):'n/a')+'</td><td><span class="di-badge di-'+s.level+'" title="'+esc(s.alerts.join(' '))+'">'+s.label+'</span></td></tr>':'<tr><td><strong style="color:var(--gold)">'+esc(x.t)+'</strong><div style="font-size:10px;color:var(--dim)">'+esc(x.name)+'</div></td><td colspan="8" style="color:var(--dim)">États financiers de l\'exercice '+esc(x.year)+' non saisis</td></tr>').join('')||'<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">Aucune donnée.</td></tr>';
  }

  // Les données arrivent après l'ouverture de la vue : on redessine quand elles sont prêtes ou modifiées depuis l'admin.
  ['tc:dataready','tc:backoffice-source-updated'].forEach(ev=>window.addEventListener(ev,()=>{
    const v=document.getElementById('view-dividend-screener'); if(v&&v.dataset.built==='1'&&v.offsetParent!==null)renderAll();
  }));

  window.renderDividendScreener=build;
})();