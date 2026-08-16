// THE CAPITAL — Historical PER
// Uses the centralized /api/per-history endpoint. No market or financial values are invented client-side.
(function(){
  'use strict';

  const cache = window.__tcPerHistoryCache || (window.__tcPerHistoryCache = new Map());
  let activeTicker = '';
  let observerStarted = false;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  function statusLabel(row){
    if(row.statut === 'definitif') return '<span class="tc-per-status tc-per-status-final">Définitif</span>';
    if(row.statut === 'en_cours') return '<span class="tc-per-status tc-per-status-current">En cours</span>';
    return '<span class="tc-per-status tc-per-status-missing">Non calculable</span>';
  }

  function reason(row){
    return row.raison ? `<span class="tc-per-reason">${esc(row.raison)}</span>` : '';
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
      #tc-per-history-card .tc-per-current{font:500 11px var(--mono);color:var(--gold);white-space:nowrap}
      #tc-per-history-card .tc-per-body{padding:0 18px 18px}
      #tc-per-history-card .tc-per-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
      #tc-per-history-card .tc-per-kpi{border:1px solid var(--border);padding:10px;border-radius:4px}
      #tc-per-history-card .tc-per-kpi span{display:block;font-size:8px;text-transform:uppercase;color:var(--dim);letter-spacing:.06em}
      #tc-per-history-card .tc-per-kpi strong{display:block;margin-top:5px;font:600 15px var(--mono);color:var(--cream)}
      #tc-per-history-card .tc-per-chart{height:240px;margin:12px 0 18px}
      #tc-per-history-card .tc-per-chart canvas{width:100%!important;height:100%!important}
      #tc-per-history-card .tc-per-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:4px}
      #tc-per-history-card table{width:100%;min-width:760px;border-collapse:collapse}
      #tc-per-history-card th,#tc-per-history-card td{padding:9px 8px;border-bottom:1px solid var(--border);font-size:10px;text-align:right;vertical-align:middle}
      #tc-per-history-card th:first-child,#tc-per-history-card td:first-child{text-align:left}
      #tc-per-history-card th{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);font-weight:600}
      #tc-per-history-card tr:last-child td{border-bottom:0}
      #tc-per-history-card .tc-per-year{font:600 11px var(--mono);color:var(--cream)}
      #tc-per-history-card .tc-per-status{display:inline-block;padding:3px 6px;border:1px solid var(--border);border-radius:3px;font-size:8px;white-space:nowrap}
      #tc-per-history-card .tc-per-status-final{color:var(--green);border-color:rgba(143,206,154,.35)}
      #tc-per-history-card .tc-per-status-current{color:var(--gold);border-color:rgba(184,150,78,.4)}
      #tc-per-history-card .tc-per-status-missing{color:var(--red);border-color:rgba(239,119,112,.35)}
      #tc-per-history-card .tc-per-reason{display:block;color:var(--dim);font-size:8px;margin-top:3px;white-space:normal}
      #tc-per-history-card .tc-per-empty{padding:20px 4px;color:var(--dim);font-size:10px}
      #tc-per-history-card .tc-per-foot{margin-top:12px;color:var(--dim);font-size:9px;line-height:1.5}
      @media(max-width:650px){#tc-per-history-card .tc-per-head{flex-direction:column}#tc-per-history-card .tc-per-summary{grid-template-columns:1fr 1fr}#tc-per-history-card .tc-per-chart{height:200px}}
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

  function render(ticker,rows){
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
    const current=sorted.find(r=>r.statut==='en_cours') || null;
    const definitive=sorted.filter(r=>r.statut==='definitif').length;
    const missing=sorted.filter(r=>r.statut==='non_calculable').length;

    let html=`<div class="tc-per-head"><div><div class="tc-per-kicker">VALORISATION · HISTORIQUE</div><div class="tc-per-title">Historique du PER</div><div class="tc-per-note">PER = cours de référence / BPA de l'exercice. Les années clôturées utilisent la dernière séance réellement disponible de leur année. L'année en cours utilise le dernier cours disponible et reste dynamique.</div></div>${current?`<div class="tc-per-current">${esc(current.annee)} · ${statusLabel(current)}</div>`:''}</div><div class="tc-per-body">`;
    html+=`<div class="tc-per-summary"><div class="tc-per-kpi"><span>Années calculées</span><strong>${calculable.length}</strong></div><div class="tc-per-kpi"><span>Définitives</span><strong>${definitive}</strong></div><div class="tc-per-kpi"><span>Non calculables</span><strong>${missing}</strong></div></div>`;

    if(calculable.length>1){
      html+=`<div class="tc-per-chart"><canvas id="tcPerHistoryChart"></canvas></div>`;
    }

    if(!sorted.length){
      html+='<div class="tc-per-empty">Aucune année ne peut être affichée avec les données actuellement disponibles.</div>';
    }else{
      html+=`<div class="tc-per-table-wrap"><table><thead><tr><th>Année</th><th>Date cours</th><th>Cours de référence</th><th>BPA</th><th>PER</th><th>Statut</th></tr></thead><tbody>`;
      sorted.forEach(row=>{
        html+=`<tr><td><span class="tc-per-year">${esc(row.annee)}</span>${reason(row)}</td><td>${esc(row.date_cours_reference||'—')}</td><td>${fmtPrice(row.cours_reference)}</td><td>${fmtBpa(row.bpa)}</td><td><strong>${fmtPer(row.per)}</strong></td><td>${statusLabel(row)}</td></tr>`;
      });
      html+='</tbody></table></div>';
    }

    html+='<div class="tc-per-foot">Les années sans BPA valide ou sans cours de référence ne produisent pas de faux PER. Les données historiques proviennent des cours et états financiers déjà présents dans The Capital.</div></div>';
    card.innerHTML=html;

    const canvas=document.getElementById('tcPerHistoryChart');
    if(canvas && calculable.length>1 && typeof Chart==='function'){
      const labels=calculable.map(r=>r.annee);
      const values=calculable.map(r=>Number(r.per));
      new Chart(canvas,{type:'line',data:{labels,datasets:[{label:'PER',data:values,tension:.25,fill:false,borderColor:'rgba(184,150,78,.9)',pointBackgroundColor:'rgba(184,150,78,1)',pointRadius:3,borderWidth:1.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' PER : '+Number(ctx.parsed.y).toFixed(2)+'x'}}},scales:{x:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9}},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9},callback:v=>v+'x'},grid:{color:'rgba(255,255,255,.06)'}}}}});
    }

    updateCurrentPerSelectors(rows);
  }

  async function refresh(){
    const ticker=tickerFromFiche();
    if(!ticker || ticker===activeTicker && document.getElementById('tc-per-history-card')) return;
    activeTicker=ticker;
    try{
      const rows=await load(ticker);
      if(ticker===tickerFromFiche()) render(ticker,rows);
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
