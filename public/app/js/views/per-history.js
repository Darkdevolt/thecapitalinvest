// THE CAPITAL — Historical PER
// Public app presentation: Simple by default, Pro for detailed calculation context.
// Uses the centralized /api/per-history endpoint. No market or financial values are invented client-side.
(function(){
  'use strict';

  const cache = window.__tcPerHistoryCache || (window.__tcPerHistoryCache = new Map());
  let activeTicker = '';
  let observerStarted = false;
  let chartInstance = null;
  let displayMode = 'simple';

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function num(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmtPrice(value){
    const n = num(value);
    return n == null ? '—' : n.toLocaleString('fr-FR',{maximumFractionDigits:2}) + ' FCFA';
  }

  function fmtBpa(value){
    const n = num(value);
    return n == null ? '—' : n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' FCFA';
  }

  function fmtPer(value){
    const n = num(value);
    return n == null ? '—' : n.toFixed(2) + 'x';
  }

  function injectStyles(){
    if(document.getElementById('tc-per-history-css')) return;
    const s=document.createElement('style');
    s.id='tc-per-history-css';
    s.textContent=`
      #tc-per-history-card{margin-top:18px;border:1px solid var(--border);background:var(--surface,#111);border-radius:6px;overflow:hidden}
      #tc-per-history-card .tc-per-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 18px;border-bottom:1px solid var(--border)}
      #tc-per-history-card .tc-per-kicker{font:9px var(--mono);letter-spacing:1.6px;color:var(--gold);text-transform:uppercase}
      #tc-per-history-card .tc-per-title{font:700 18px var(--serif);margin-top:4px;color:var(--cream)}
      #tc-per-history-card .tc-per-note{font-size:10px;line-height:1.5;color:var(--dim);margin-top:5px;max-width:760px}
      #tc-per-history-card .tc-per-body{padding:0 18px 18px}
      #tc-per-history-card .tc-per-toolbar{display:flex;justify-content:flex-end;align-items:center;margin:12px 0 4px}
      #tc-per-history-card .tc-per-switch{display:inline-flex;align-items:center;padding:2px;border:1px solid var(--border);border-radius:5px;background:rgba(255,255,255,.02)}
      #tc-per-history-card .tc-per-switch button{appearance:none;border:0;background:transparent;color:var(--dim);font:600 9px var(--mono);letter-spacing:.05em;padding:7px 11px;border-radius:3px;cursor:pointer;transition:all .15s ease}
      #tc-per-history-card .tc-per-switch button:hover{color:var(--cream)}
      #tc-per-history-card .tc-per-switch button.active{background:var(--gold);color:#171310}
      #tc-per-history-card .tc-per-simple-intro{font-size:10px;line-height:1.5;color:var(--dim);margin:12px 0 14px}
      #tc-per-history-card .tc-per-chart{height:250px;margin:10px 0 18px}
      #tc-per-history-card .tc-per-chart canvas{width:100%!important;height:100%!important}
      #tc-per-history-card .tc-per-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:4px}
      #tc-per-history-card table{width:100%;min-width:420px;border-collapse:collapse}
      #tc-per-history-card th,#tc-per-history-card td{padding:9px 10px;border-bottom:1px solid var(--border);font-size:10px;text-align:right;vertical-align:middle}
      #tc-per-history-card th:first-child,#tc-per-history-card td:first-child{text-align:left}
      #tc-per-history-card th{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);font-weight:600}
      #tc-per-history-card tr:last-child td{border-bottom:0}
      #tc-per-history-card .tc-per-year{font:600 11px var(--mono);color:var(--cream)}
      #tc-per-history-card .tc-per-value{font:600 11px var(--mono);color:var(--cream)}
      #tc-per-history-card .tc-per-pro-note{font-size:9px;line-height:1.5;color:var(--dim);margin:12px 0 0}
      #tc-per-history-card .tc-per-status{display:inline-block;padding:3px 6px;border:1px solid var(--border);border-radius:3px;font-size:8px;white-space:nowrap}
      #tc-per-history-card .tc-per-status-final{color:var(--green);border-color:rgba(143,206,154,.35)}
      #tc-per-history-card .tc-per-status-current{color:var(--gold);border-color:rgba(184,150,78,.4)}
      #tc-per-history-card .tc-per-status-missing{color:var(--red);border-color:rgba(239,119,112,.35)}
      #tc-per-history-card .tc-per-reason{display:block;color:var(--dim);font-size:8px;margin-top:3px;white-space:normal}
      #tc-per-history-card .tc-per-empty{padding:20px 4px;color:var(--dim);font-size:10px}
      @media(max-width:650px){
        #tc-per-history-card .tc-per-head{flex-direction:column}
        #tc-per-history-card .tc-per-toolbar{justify-content:flex-start}
        #tc-per-history-card .tc-per-chart{height:210px}
        #tc-per-history-card table{min-width:380px}
      }
    `;
    document.head.appendChild(s);
  }

  function tickerFromFiche(){
    const el=document.getElementById('ficheTickerLabel');
    if(!el) return '';
    return String(el.textContent||'').replace(/^\s*◈\s*/,'').trim().toUpperCase();
  }

  async function load(ticker){
    if(!ticker) return [];
    if(cache.has(ticker)) return cache.get(ticker);
    const response=await window.apiGetPerHistory(ticker);
    const rows=Array.isArray(response?.rows)?response.rows:[];
    cache.set(ticker,rows);
    return rows;
  }

  function rowForYear(rows,year){
    return rows.find(r=>Number(r.annee)===Number(year)) || null;
  }

  function updateCurrentPerSelectors(rows){
    const ficheTabs=document.getElementById('fichYearTabs');
    const fins=window._ficheFins||[];
    if(ficheTabs && fins.length){
      const idx=[...ficheTabs.querySelectorAll('.year-tab')].findIndex(b=>String(b.textContent||'').trim().startsWith(String(fins[0]?.annee||'')));
      const year=Number(fins[Math.max(idx,0)]?.annee || fins[0]?.annee);
      const row=rowForYear(rows,year);
      const el=document.getElementById('r-per');
      if(el) el.textContent=fmtPer(row?.per);
    }

    document.querySelectorAll('.fund-ratio').forEach(card=>{
      const label=String(card.querySelector('span')?.textContent||'').trim().toUpperCase();
      if(label!=='PER') return;
      const year=Number(card.closest('.fund-ratio-analysis')?.querySelector('.fund-ratio-year')?.textContent || 0);
      const row=rowForYear(rows,year);
      const strong=card.querySelector('strong');
      if(strong) strong.textContent=fmtPer(row?.per);
    });

    document.querySelectorAll('#finDetailPeriods .fin-period-card').forEach(card=>{
      const heading=card.querySelector('h3');
      const match=String(heading?.textContent||'').match(/(20\d{2})/);
      if(!match) return;
      const row=rowForYear(rows,Number(match[1]));
      card.querySelectorAll('.fin-row').forEach(line=>{
        const label=String(line.querySelector('.fin-label')?.textContent||'').trim().toUpperCase();
        if(label==='P/E'){
          const value=line.querySelector('.fin-value');
          if(value) value.textContent=fmtPer(row?.per);
        }
      });
    });
  }

  function destroyChart(){
    if(chartInstance && typeof chartInstance.destroy==='function'){
      try{ chartInstance.destroy(); }catch(_e){}
    }
    chartInstance=null;
  }

  function renderChart(calculable){
    const canvas=document.getElementById('tcPerHistoryChart');
    if(!canvas || calculable.length<1 || typeof Chart!=='function') return;
    destroyChart();
    chartInstance=new Chart(canvas,{type:'line',data:{labels:calculable.map(r=>r.annee),datasets:[{label:'PER',data:calculable.map(r=>Number(r.per)),tension:.25,fill:false,borderColor:'rgba(184,150,78,.9)',pointBackgroundColor:'rgba(184,150,78,1)',pointRadius:3,borderWidth:1.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' PER : '+Number(ctx.parsed.y).toFixed(2)+'x'}}},scales:{x:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9}},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9},callback:v=>v+'x'},grid:{color:'rgba(255,255,255,.06)'}}}}});
  }

  function statusLabel(row){
    if(row.statut === 'definitif') return '<span class="tc-per-status tc-per-status-final">Définitif</span>';
    if(row.statut === 'en_cours') return '<span class="tc-per-status tc-per-status-current">En cours</span>';
    return '<span class="tc-per-status tc-per-status-missing">Non calculable</span>';
  }

  function reason(row){
    return row.raison ? `<span class="tc-per-reason">${esc(row.raison)}</span>` : '';
  }

  function setMode(mode,rows){
    displayMode=mode==='pro'?'pro':'simple';
    try{ localStorage.setItem('tc-per-display-mode',displayMode); }catch(_e){}
    renderCard(tickerFromFiche(),rows);
  }

  function renderCard(ticker,rows){
    injectStyles();
    const view=document.getElementById('view-fiche');
    if(!view) return;
    let card=document.getElementById('tc-per-history-card');
    if(!card){
      card=document.createElement('section');
      card.id='tc-per-history-card';
      view.appendChild(card);
    }

    const sorted=rows.slice().sort((a,b)=>Number(a.annee)-Number(b.annee));
    const calculable=sorted.filter(r=>num(r.per)!=null);
    const mode=displayMode;

    let html=`<div class="tc-per-head"><div><div class="tc-per-kicker">VALORISATION · HISTORIQUE</div><div class="tc-per-title">Évolution du PER</div></div></div><div class="tc-per-body">`;
    html+=`<div class="tc-per-toolbar"><div class="tc-per-switch" role="group" aria-label="Affichage de l'historique du PER"><button type="button" data-per-mode="simple" class="${mode==='simple'?'active':''}">SIMPLE</button><button type="button" data-per-mode="pro" class="${mode==='pro'?'active':''}">PRO</button></div></div>`;

    if(mode==='simple'){
      html+=`<div class="tc-per-simple-intro">Visualisez simplement l'évolution du PER au fil des exercices.</div>`;
      if(calculable.length>0) html+=`<div class="tc-per-chart"><canvas id="tcPerHistoryChart"></canvas></div>`;
      if(calculable.length===0){
        html+='<div class="tc-per-empty">Historique du PER indisponible avec les données actuellement disponibles.</div>';
      }else{
        html+=`<div class="tc-per-table-wrap"><table><thead><tr><th>Année</th><th>PER</th></tr></thead><tbody>`;
        calculable.forEach(row=>{ html+=`<tr><td><span class="tc-per-year">${esc(row.annee)}</span></td><td><strong class="tc-per-value">${fmtPer(row.per)}</strong></td></tr>`; });
        html+='</tbody></table></div>';
      }
    }else{
      const current=sorted.find(r=>r.statut==='en_cours') || null;
      html+=`<div class="tc-per-simple-intro">Vue détaillée destinée à l'analyse : cours de référence, BPA et règles de calcul historiques.</div>`;
      if(calculable.length>0) html+=`<div class="tc-per-chart"><canvas id="tcPerHistoryChart"></canvas></div>`;
      if(!sorted.length){
        html+='<div class="tc-per-empty">Aucune année ne peut être affichée avec les données actuellement disponibles.</div>';
      }else{
        html+=`<div class="tc-per-table-wrap"><table><thead><tr><th>Année</th><th>Date cours</th><th>Cours de référence</th><th>BPA</th><th>PER</th><th>Statut</th></tr></thead><tbody>`;
        sorted.forEach(row=>{
          html+=`<tr><td><span class="tc-per-year">${esc(row.annee)}</span>${reason(row)}</td><td>${esc(row.date_cours_reference||'—')}</td><td>${fmtPrice(row.cours_reference)}</td><td>${fmtBpa(row.bpa)}</td><td><strong>${fmtPer(row.per)}</strong></td><td>${statusLabel(row)}</td></tr>`;
        });
        html+='</tbody></table></div>';
      }
      if(current) html+=`<div class="tc-per-pro-note">L'exercice ${esc(current.annee)} est traité comme exercice en cours et reste dynamique jusqu'à la clôture de l'exercice.</div>`;
    }

    html+='</div>';
    card.innerHTML=html;
    renderChart(calculable);

    card.querySelectorAll('[data-per-mode]').forEach(button=>{
      button.addEventListener('click',()=>setMode(button.getAttribute('data-per-mode'),rows));
    });

    updateCurrentPerSelectors(rows);
  }

  function restoreMode(){
    try{
      const saved=localStorage.getItem('tc-per-display-mode');
      if(saved==='pro' || saved==='simple') displayMode=saved;
    }catch(_e){}
  }

  async function refresh(){
    const ticker=tickerFromFiche();
    if(!ticker) return;
    if(ticker===activeTicker && document.getElementById('tc-per-history-card')) return;
    activeTicker=ticker;
    try{
      const rows=await load(ticker);
      if(ticker===tickerFromFiche()) renderCard(ticker,rows);
    }catch(error){
      console.warn('[PER] Impossible de charger l\'historique',error);
      const view=document.getElementById('view-fiche');
      if(view){
        let card=document.getElementById('tc-per-history-card');
        if(!card){card=document.createElement('section');card.id='tc-per-history-card';view.appendChild(card);}
        card.innerHTML='<div class="tc-per-body"><div class="tc-per-empty">Historique du PER indisponible pour le moment.</div></div>';
      }
    }
  }

  function watch(){
    if(observerStarted) return;
    observerStarted=true;
    restoreMode();
    const root=document.body;
    if(!root) return;
    const observer=new MutationObserver(()=>{
      clearTimeout(window.__tcPerHistoryTimer);
      window.__tcPerHistoryTimer=setTimeout(refresh,120);
    });
    observer.observe(root,{childList:true,subtree:true});

    document.addEventListener('click',event=>{
      const tab=event.target.closest('#fichYearTabs .year-tab');
      if(tab){
        setTimeout(()=>{
          const ticker=tickerFromFiche();
          const rows=cache.get(ticker)||[];
          const match=String(tab.textContent||'').match(/(20\d{2})/);
          const row=match?rowForYear(rows,Number(match[1])):null;
          const el=document.getElementById('r-per');
          if(el) el.textContent=fmtPer(row?.per);
        },0);
      }
    });

    setTimeout(refresh,300);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watch,{once:true});
  else watch();
})();
