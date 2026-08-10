// The Capital — ratio analysis layer
// Read-only enhancement: consumes already loaded financial/market data.
(function () {
  'use strict';
  var lastTicker = '';

  function n(v) { var x = Number(v); return Number.isFinite(x) ? x : 0; }
  function pct(v) { return Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—'; }
  function money(v) { if (!Number.isFinite(v)) return '—'; return typeof window.fmtM === 'function' ? window.fmtM(v) : Math.round(v).toLocaleString('fr-FR'); }
  function addCard() {
    var view = document.getElementById('view-analyse-fondamentale');
    var content = document.getElementById('fundContent');
    var select = document.getElementById('fundTickerSelect');
    if (!view || !content || !select || !select.value) return;
    var ticker = String(select.value).toUpperCase();
    if (ticker === lastTicker && document.getElementById('fundRatioAnalysis')) return;
    var rows = (Array.isArray(window.allFinancials) ? window.allFinancials : []).filter(function (f) {
      return String(f && f.ticker || '').toUpperCase() === ticker && (f.periode === 'annuel' || !f.periode);
    }).sort(function (a,b) { return n(a.annee) - n(b.annee); });
    var quote = (Array.isArray(window.allCours) ? window.allCours : []).find(function(c){ return String(c && c.ticker || '').toUpperCase() === ticker; }) || {};
    if (!rows.length) return;
    var f = rows[rows.length - 1];
    var ca=n(f.chiffre_affaires), rn=n(f.resultat_net), cfo=n(f.cash_flow_operationnel), capex=n(f.capex), fcf=cfo-capex;
    var price=n(quote.cours), shares=n(f.nombre_actions), marketCap=price*shares;
    var eps=shares>0?rn/shares:NaN, pe=eps>0&&price>0?price/eps:NaN, ps=marketCap>0&&ca>0?marketCap/ca:NaN;
    var netMargin=ca?rn/ca:NaN, fcfMargin=ca?fcf/ca:NaN, fcfYield=marketCap?fcf/marketCap:NaN;
    var roe=(n(f.capitaux_propres)>0)?rn/n(f.capitaux_propres):NaN;
    var roa=(n(f.total_actif)>0)?rn/n(f.total_actif):NaN;
    var debtEquity=(n(f.capitaux_propres)>0)?n(f.dettes_financieres)/n(f.capitaux_propres):NaN;
    var card=document.getElementById('fundRatioAnalysis');
    if(!card){
      card=document.createElement('div'); card.id='fundRatioAnalysis'; card.className='card fund-ratio-analysis';
      var methodology=content.querySelector('.fund-methodology');
      if(methodology) content.insertBefore(card,methodology); else content.appendChild(card);
    }
    function ratio(label,value,detail,cls){ return '<div class="fund-ratio"><span>'+label+'</span><strong class="'+(cls||'')+'">'+value+'</strong><small>'+detail+'</small></div>'; }
    var peDetail=Number.isFinite(pe)?(pe<12?'valorisation modérée':pe<20?'valorisation intermédiaire':'multiple élevé'):'BPA non disponible';
    var marginDetail=Number.isFinite(netMargin)?(netMargin>0.15?'bonne conversion du CA':netMargin>0.08?'marge correcte': 'marge sous pression'):'Non calculable';
    var fcfDetail=Number.isFinite(fcfMargin)?(fcfMargin>0.10?'forte génération de cash':fcfMargin>0?'FCF positif':'FCF négatif'):'Non calculable';
    card.innerHTML='<div class="card-header"><div><div class="card-title">Analyse des ratios financiers</div><div class="fund-section-note">Lecture automatique des indicateurs disponibles dans les états financiers. Les ratios non calculables restent explicitement signalés.</div></div><span class="fund-ratio-year">'+(f.annee||'—')+'</span></div><div class="card-body"><div class="fund-ratio-grid">'+
      ratio('BPA',Number.isFinite(eps)?money(eps)+' FCFA':'—','Résultat net / actions')+
      ratio('PER',Number.isFinite(pe)?pe.toFixed(1)+'x':'—',peDetail,pe>20?'negative':pe>0?'neutral':'')+
      ratio('Price / Sales',Number.isFinite(ps)?ps.toFixed(2)+'x':'—','Capitalisation / CA')+
      ratio('Marge nette',pct(netMargin),marginDetail,netMargin>=0.10?'positive':netMargin>=0?'neutral':'negative')+
      ratio('Marge FCF',pct(fcfMargin),fcfDetail,fcfMargin>0?'positive':'negative')+
      ratio('FCF Yield',pct(fcfYield),'FCF / capitalisation',fcfYield>=0.05?'positive':fcfYield>=0?'neutral':'negative')+
      ratio('ROE',pct(roe),Number.isFinite(roe)?'Rentabilité des capitaux propres':'Capitaux propres indisponibles',roe>=0.15?'positive':roe>=0?'neutral':'negative')+
      ratio('ROA',pct(roa),Number.isFinite(roa)?'Rentabilité des actifs':'Total actif indisponible',roa>=0.08?'positive':roa>=0?'neutral':'negative')+
      ratio('Dette / Fonds propres',Number.isFinite(debtEquity)?debtEquity.toFixed(2)+'x':'—',Number.isFinite(debtEquity)?'Levier financier':'Données de dette indisponibles',debtEquity>2?'negative':'neutral')+
      '</div><div class="fund-ratio-note"><strong>Lecture :</strong> le PER compare le cours au bénéfice par action, la marge nette mesure la conversion du chiffre d’affaires en résultat et le FCF Yield mesure le cash-flow libre généré rapporté à la capitalisation. Les seuils sont des repères analytiques, pas des recommandations d’achat ou de vente.</div></div>';
    lastTicker=ticker;
  }

  function observe() {
    var target=document.getElementById('fundContent'); if(!target) return;
    new MutationObserver(function(){ setTimeout(addCard,30); }).observe(target,{childList:true,subtree:true});
    setTimeout(addCard,100);
    var select=document.getElementById('fundTickerSelect'); if(select) select.addEventListener('change',function(){lastTicker='';setTimeout(addCard,100);});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe,{once:true}); else observe();
})();
