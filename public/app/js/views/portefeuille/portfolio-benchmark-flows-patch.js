// THE CAPITAL — Portfolio benchmark + financial flows (frontend only)
(function () {
  'use strict';

  const money = v => typeof window.fmtM === 'function' ? window.fmtM(v) : Number(v || 0).toLocaleString('fr-FR');
  const num = (v,d=2) => typeof window.fmt === 'function' ? window.fmt(v,d) : Number(v || 0).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});

  function transactions() { return typeof window.getTransactions === 'function' ? window.getTransactions() : []; }
  function amount(t) { return Math.abs(Number(t?.montant_net ?? t?.montant_brut ?? t?.amount ?? ((t?.quantite ?? t?.quantity ?? t?.qty ?? 0) * (t?.prix_unitaire ?? t?.price ?? 0)))); }

  function flowSummary() {
    let deposits=0, withdrawals=0, invested=0, sales=0, dividends=0;
    transactions().forEach(t => {
      const type=String(t.type||'').toUpperCase(); const a=amount(t);
      if(type==='DEPOT'||type==='DEPOSIT') deposits+=a;
      else if(type==='RETRAIT'||type==='WITHDRAW') withdrawals+=a;
      else if(type==='ACHAT'||type==='BUY') invested+=a;
      else if(type==='VENTE'||type==='SELL') sales+=a;
      else if(type==='DIVIDENDE'||type==='DIVIDEND') dividends+=a;
    });
    const cash = typeof window.getCash === 'function' ? Number(window.getCash()||0) : Math.max(0,deposits-withdrawals-invested+sales+dividends);
    return { deposits, withdrawals, invested, sales, dividends, net: deposits-withdrawals, cash };
  }

  function renderFlows() {
    const anchor=document.getElementById('benchmarkStats');
    if(!anchor) return;
    let panel=document.getElementById('portfolioFinancialFlows');
    if(!panel){
      panel=document.createElement('div'); panel.id='portfolioFinancialFlows';
      panel.style.cssText='margin-top:16px;border:1px solid var(--border);border-radius:12px;background:var(--panel);overflow:hidden';
      anchor.parentElement?.parentElement?.insertBefore(panel, anchor.parentElement) || anchor.parentElement?.before(panel);
    }
    const s=flowSummary();
    const investedValue=(Array.isArray(window._pfLastRows)?window._pfLastRows:[]).reduce((x,r)=>x+Number(r.value||0),0);
    panel.innerHTML=`<div style="padding:16px 18px;border-bottom:1px solid var(--border)"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700">Flux financiers</div><div style="font-size:13px;color:var(--dim);margin-top:4px">Séparation entre argent injecté/retiré et capitaux effectivement investis.</div></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--border)">
        <div style="padding:15px;background:var(--panel2)"><div style="font-size:11px;color:var(--dim)">Approvisionnements</div><strong style="font-size:18px;color:var(--green)">+${money(s.deposits)} FCFA</strong></div>
        <div style="padding:15px;background:var(--panel2)"><div style="font-size:11px;color:var(--dim)">Retraits</div><strong style="font-size:18px;color:var(--red)">−${money(s.withdrawals)} FCFA</strong></div>
        <div style="padding:15px;background:var(--panel2)"><div style="font-size:11px;color:var(--dim)">Capital net injecté</div><strong style="font-size:18px">${money(s.net)} FCFA</strong></div>
        <div style="padding:15px;background:var(--panel2)"><div style="font-size:11px;color:var(--dim)">Non alloué · cash</div><strong style="font-size:18px;color:var(--gold)">${money(s.cash)} FCFA</strong></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 16px">
        <div><span style="color:var(--dim);font-size:12px">Capital actuellement investi</span><br><strong>${money(investedValue)} FCFA</strong></div>
        <div><span style="color:var(--dim);font-size:12px">Ventes encaissées</span><br><strong>${money(s.sales)} FCFA</strong> <span style="color:var(--dim);font-size:11px">(flux interne, pas un apport)</span></div>
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 16px;flex-wrap:wrap"><button type="button" id="pfDepositBtn" style="padding:9px 13px;border:1px solid var(--green);border-radius:8px;background:transparent;color:var(--green);cursor:pointer;font-weight:700">+ Approvisionner</button><button type="button" id="pfWithdrawBtn" style="padding:9px 13px;border:1px solid var(--red);border-radius:8px;background:transparent;color:var(--red);cursor:pointer;font-weight:700">− Retirer</button></div>`;
    const addFlow=async type=>{ const raw=window.prompt(type==='DEPOT'?'Montant de l’approvisionnement (FCFA)':'Montant du retrait (FCFA)'); const a=Number(String(raw||'').replace(/\s/g,'').replace(',','.')); if(!Number.isFinite(a)||a<=0){ if(raw!==null&&typeof window.toast==='function') window.toast('Montant invalide.','error'); return; } const date=window.prompt('Date (AAAA-MM-JJ)',new Date().toISOString().slice(0,10)); if(!date) return; try{await window.portfolioStore.addTransaction({type,amount:a,date,note:type==='DEPOT'?'Approvisionnement du compte':'Retrait du compte'}); renderFlows();}catch(e){if(typeof window.toast==='function')window.toast(e.message||'Flux impossible.','error');}};
    document.getElementById('pfDepositBtn')?.addEventListener('click',()=>addFlow('DEPOT'));
    document.getElementById('pfWithdrawBtn')?.addEventListener('click',()=>addFlow('RETRAIT'));
  }

  function normalizeRows(payload){ return Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:(Array.isArray(payload?.indices)?payload.indices:(Array.isArray(payload?.data?.indices)?payload.data.indices:[]))); }
  function rowDate(r){ return String(r?.date_seance??r?.date??r?.date_cotation??r?.jour??'').slice(0,10); }
  function rowClose(r){ const n=Number(r?.cours_cloture??r?.cloture??r?.close??r?.cours_normal??r?.cours??r?.valeur??0); return n>0?n:null; }
  async function benchmarkSeries(){
    const r=await fetch('/api/marche?type=indices',{cache:'no-store'}); if(!r.ok) throw new Error('Indice BRVM indisponible');
    const rows=normalizeRows(await r.json());
    return rows.filter(x=>{const label=String(x?.ticker??x?.indice??x?.code??x?.nom??'').toUpperCase(); return label.includes('BRVM C')||label.includes('COMPOSITE');}).map(x=>({date:rowDate(x),close:rowClose(x)})).filter(x=>x.date&&x.close).sort((a,b)=>a.date.localeCompare(b.date));
  }

  async function renderBenchmarkReal(){
    const el=document.getElementById('benchmarkStats'); if(!el) return;
    const hist=typeof window.getPortfolioHistory==='function'?window.getPortfolioHistory(window._pfPeriod||99999):null;
    if(!hist?.dates?.length||!hist.returns?.length){el.innerHTML='<div style="padding:16px"><div style="font-size:11px;color:var(--dim)">Performance vs BRVM Composite</div><strong>—</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Historique du portefeuille insuffisant pour calculer le benchmark.</div></div>';return;}
    try{
      const idx=await benchmarkSeries(); const map=new Map(idx.map(x=>[x.date,x.close]));
      const dates=hist.dates.map(d=>new Date(d).toISOString().slice(0,10)); let first=null,last=null;
      for(const d of dates){if(map.has(d)){if(first===null)first=map.get(d);last=map.get(d);}}
      if(!(first>0&&last>0)){throw new Error('Aucune séance BRVM Composite commune');}
      const benchmark=(last/first-1)*100;
      const portfolio=hist.values.length>1?((hist.values[hist.values.length-1]/hist.values[0]-1)*100):0;
      const excess=portfolio-benchmark;
      el.innerHTML=`<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:10px">Performance vs BRVM Composite</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px"><div><div style="font-size:11px;color:var(--dim)">Portefeuille</div><strong style="font-size:20px;color:${portfolio>=0?'var(--green)':'var(--red)'}">${portfolio>=0?'+':''}${num(portfolio,2)}%</strong></div><div><div style="font-size:11px;color:var(--dim)">BRVM Composite</div><strong style="font-size:20px">${benchmark>=0?'+':''}${num(benchmark,2)}%</strong></div><div><div style="font-size:11px;color:var(--dim)">Surperformance</div><strong style="font-size:20px;color:${excess>=0?'var(--green)':'var(--red)'}">${excess>=0?'+':''}${num(excess,2)}%</strong></div></div><div style="font-size:11px;color:var(--dim);margin-top:10px">Même période de cotation commune. Les dépôts/retraits ne sont pas assimilés à de la performance.</div></div>`;
    }catch(e){el.innerHTML=`<div style="padding:16px"><div style="font-size:11px;color:var(--dim)">Performance vs BRVM Composite</div><strong>—</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">${e.message}</div></div>`;}
  }

  window.renderPortfolioBenchmarkAndFlows=function(){ renderFlows(); renderBenchmarkReal(); };
  function run(){ try{window.renderPortfolioBenchmarkAndFlows();}catch(e){console.warn('[PORTFOLIO BENCHMARK/FLOWS]',e);} }
  window.addEventListener('portfolio:updated',run); window.addEventListener('portfolio:history-ready',run); window.addEventListener('dataLoaded',run); setTimeout(run,500);
})();
