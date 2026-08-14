// PORTEFEUILLE - CRUD RESTORED
(function(){
  'use strict';
  function el(id){return document.getElementById(id);}
  function toastSafe(msg,type){if(typeof window.toast==='function')window.toast(msg,type||'info');else console.log('[PORTFOLIO]',msg);}
  function render(){if(typeof window.renderPortfolio==='function')window.renderPortfolio();}

  window.switchPfSubtab=function(tab){
    ['tabBuy','tabSell'].forEach(function(id){var x=el(id);if(x)x.classList.toggle('active',id===(tab==='buy'?'tabBuy':'tabSell'));});
    ['panelBuy','panelSell'].forEach(function(id){var x=el(id);if(x)x.classList.toggle('active',id===(tab==='buy'?'panelBuy':'panelSell'));});
    if(tab==='sell')window.populateSellTickerSelect();
  };
  window.populateSellTickerSelect=function(){
    var select=el('pfSellTicker');if(!select)return;var current=select.value;
    select.innerHTML='<option value="">Ticker à vendre...</option>';
    var pf=typeof getPortfolio==='function'?getPortfolio():[];
    [...new Set(pf.map(function(p){return String(p.ticker||'').toUpperCase().trim();}).filter(Boolean))].sort().forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;select.appendChild(o);});
    if(current)select.value=current;
  };
  window.updateSellHint=function(){
    var ticker=el('pfSellTicker')?.value,hint=el('sellHint');if(!hint)return;if(!ticker){hint.textContent='';return;}
    var pf=typeof getPortfolio==='function'?getPortfolio():[];var qty=pf.filter(function(p){return String(p.ticker||'').toUpperCase().trim()===ticker;}).reduce(function(s,p){return s+(+p.qty||0);},0);hint.textContent='Quantité détenue : '+qty;
    var price=el('pfSellPrice');if(price&&!price.value&&typeof getLatestPrice==='function')price.value=getLatestPrice(ticker)||'';
  };
  window.addPosition=function(){
    var tickerEl=el('pfTicker'),typeEl=el('pfType'),qtyEl=el('pfQty'),priceEl=el('pfPrice'),dateEl=el('pfDate');
    var ticker=String(tickerEl?.value||'').toUpperCase().trim(),type=typeEl?.value||'action',qty=+qtyEl?.value,price=+priceEl?.value,date=dateEl?.value||new Date().toISOString().slice(0,10);
    if(!ticker){toastSafe('Sélectionnez un titre.','error');return;}if(!qty||qty<=0){toastSafe('Quantité invalide.','error');return;}if(!price||price<=0){toastSafe("Prix d'achat invalide.",'error');return;}
    var pf=typeof getPortfolio==='function'?getPortfolio():[];pf.push({id:Date.now(),ticker:ticker,type:type,qty:qty,price:price,date:date});
    savePortfolio(pf);if(typeof invalidatePortfolioCache==='function')invalidatePortfolioCache();if(typeof logTransaction==='function')logTransaction({type:'buy',ticker:ticker,qty:qty,price:price,date:date});
    if(qtyEl)qtyEl.value='';if(priceEl)priceEl.value='';if(dateEl)dateEl.value='';if(tickerEl)tickerEl.selectedIndex=0;toastSafe(qty+' × '+ticker+' ajouté au portefeuille.','success');render();
  };
  function executeSell(ticker,qty,price,date,onSuccess){
    if(!ticker||!qty||qty<=0||!price||price<=0){toastSafe('Champs invalides.','error');return;}
    var pf=typeof getPortfolio==='function'?getPortfolio():[];var lots=pf.filter(function(p){return String(p.ticker||'').toUpperCase().trim()===ticker;}).sort(function(a,b){return new Date(a.date||0)-new Date(b.date||0);});
    var held=lots.reduce(function(s,l){return s+(+l.qty||0);},0);if(qty>held){toastSafe('Quantité supérieure à la position détenue ('+held+').','error');return;}
    var remaining=qty,cost=0;lots.forEach(function(l){if(remaining<=0)return;var take=Math.min(+l.qty||0,remaining);cost+=take*(+l.price||0);l.qty=(+l.qty||0)-take;remaining-=take;});
    pf=pf.filter(function(p){return String(p.ticker||'').toUpperCase().trim()!==ticker||(+p.qty||0)>0;});savePortfolio(pf);if(typeof invalidatePortfolioCache==='function')invalidatePortfolioCache();
    var proceeds=qty*price,pl=proceeds-cost;if(typeof logTransaction==='function')logTransaction({type:'sell',ticker:ticker,qty:qty,price:price,date:date,realizedPL:pl});
    toastSafe('Vente enregistrée, P&L réalisé : '+(pl>=0?'+':'')+(typeof fmtM==='function'?fmtM(pl):pl.toFixed(0))+' FCFA',pl>=0?'success':'error');if(typeof onSuccess==='function')onSuccess();render();
  }
  window.sellPositionQuick=function(){executeSell(String(el('pfSellTicker')?.value||'').toUpperCase().trim(),+el('pfSellQty')?.value,+el('pfSellPrice')?.value,el('pfSellDate')?.value||new Date().toISOString().slice(0,10),function(){if(el('pfSellQty'))el('pfSellQty').value='';if(el('pfSellPrice'))el('pfSellPrice').value='';if(el('pfSellDate'))el('pfSellDate').value='';if(el('sellHint'))el('sellHint').textContent='';});};
  window.openSellModal=function(ticker){if(el('sellTicker'))el('sellTicker').value=ticker;if(el('sellQtyHint')){var pf=typeof getPortfolio==='function'?getPortfolio():[];var q=pf.filter(function(p){return String(p.ticker||'').toUpperCase().trim()===ticker;}).reduce(function(s,p){return s+(+p.qty||0);},0);el('sellQtyHint').textContent='Quantité détenue : '+q;}if(el('sellQty'))el('sellQty').value='';if(el('sellPrice'))el('sellPrice').value=typeof getLatestPrice==='function'?(getLatestPrice(ticker)||''):'';if(el('sellDate'))el('sellDate').value='';if(el('sellModal'))el('sellModal').classList.add('open');};
  window.closeSellModal=function(){if(el('sellModal'))el('sellModal').classList.remove('open');};
  window.confirmSell=function(){executeSell(String(el('sellTicker')?.value||'').toUpperCase().trim(),+el('sellQty')?.value,+el('sellPrice')?.value,el('sellDate')?.value||new Date().toISOString().slice(0,10),window.closeSellModal);};
  window.openEditModal=function(id){var pf=typeof getPortfolio==='function'?getPortfolio():[],p=pf.find(function(x){return String(x.id)===String(id);});if(!p)return;if(el('editId'))el('editId').value=p.id;if(el('editQty'))el('editQty').value=p.qty;if(el('editPrice'))el('editPrice').value=p.price;if(el('editDate'))el('editDate').value=p.date;if(el('editModal'))el('editModal').classList.add('open');};
  window.closeEditModal=function(){if(el('editModal'))el('editModal').classList.remove('open');};
  window.confirmEdit=function(){var id=el('editId')?.value,qty=+el('editQty')?.value,price=+el('editPrice')?.value,date=el('editDate')?.value;if(!qty||qty<=0||!price||price<=0){toastSafe('Valeurs invalides.','error');return;}var pf=getPortfolio(),p=pf.find(function(x){return String(x.id)===String(id);});if(!p)return;p.qty=qty;p.price=price;p.date=date;savePortfolio(pf);if(typeof invalidatePortfolioCache==='function')invalidatePortfolioCache();window.closeEditModal();toastSafe('Position mise à jour.','success');render();};
  window.removePosition=function(id){if(!confirm('Supprimer cette position ?'))return;savePortfolio(getPortfolio().filter(function(p){return String(p.id)!==String(id);}));if(typeof invalidatePortfolioCache==='function')invalidatePortfolioCache();toastSafe('Position supprimée.','info');render();};
  window.toggleSelectAllPositions=function(master){document.querySelectorAll('.position-checkbox[data-id]').forEach(function(cb){cb.checked=!!master.checked;});window.updateDeleteButton();};
  window.updateDeleteButton=function(){var checked=document.querySelectorAll('.position-checkbox[data-id]:checked'),bar=el('bulkActionBar'),count=el('bulkActionCount');if(count)count.textContent=checked.length+' sélectionnée(s)';if(bar)bar.style.display=checked.length?'flex':'none';};
  window.deleteSelectedPositions=function(){var checked=document.querySelectorAll('.position-checkbox[data-id]:checked');if(!checked.length)return;if(!confirm('Supprimer '+checked.length+' position(s) sélectionnée(s) ?'))return;var ids=[...checked].map(function(c){return String(c.dataset.id);});savePortfolio(getPortfolio().filter(function(p){return !ids.includes(String(p.id));}));if(typeof invalidatePortfolioCache==='function')invalidatePortfolioCache();toastSafe(ids.length+' position(s) supprimée(s).','info');render();};
  window.addCash=function(){var type=el('cashType')?.value,amount=+el('cashAmount')?.value;if(!amount||amount<=0){toastSafe('Montant invalide.','error');return;}var current=getCash(),updated=type==='withdraw'?current-amount:current;if(updated<0){toastSafe('Solde liquide insuffisant pour ce retrait.','error');return;}saveCash(updated);if(typeof logTransaction==='function')logTransaction({type:type==='withdraw'?'withdraw':'deposit',amount:amount,date:new Date().toISOString().slice(0,10)});if(el('cashAmount'))el('cashAmount').value='';toastSafe(type==='withdraw'?'Retrait enregistré.':'Dépôt enregistré.','success');render();};
  window.addDividend=function(){var ticker=String(el('divTicker')?.value||'').toUpperCase().trim(),amount=+el('divAmount')?.value,date=el('divDate')?.value||new Date().toISOString().slice(0,10);if(!ticker){toastSafe('Renseignez un ticker.','error');return;}if(!amount||amount<=0){toastSafe('Montant invalide.','error');return;}var div=getDividends();div.push({ticker:ticker,amount:amount,date:date});saveDividends(div);if(typeof logTransaction==='function')logTransaction({type:'dividend',ticker:ticker,amount:amount,date:date});if(el('divTicker'))el('divTicker').value='';if(el('divAmount'))el('divAmount').value='';if(el('divDate'))el('divDate').value='';toastSafe('Dividende de '+ticker+' enregistré.','success');render();};
  window.calculatePosition=function(){var ticker=String(el('calcTicker')?.value||'').toUpperCase().trim(),qty=+el('calcQty')?.value,target=+el('calcTarget')?.value||null,out=el('calcResult');if(!out)return;if(!ticker||!qty||qty<=0){out.textContent='Renseignez un ticker et une quantité valides.';return;}var price=typeof getLatestPrice==='function'?getLatestPrice(ticker):null;if(!price){out.textContent='Aucun cours disponible pour '+ticker+'.';return;}var cost=qty*price,gain=target?qty*target-cost:0;out.innerHTML='<div style="padding:12px;background:var(--border2);border-radius:8px"><div style="display:flex;justify-content:space-between"><span>Cours actuel</span><strong style="color:var(--gold)">'+(typeof fmt==='function'?fmt(price,2):price.toFixed(2))+' FCFA</strong></div><div style="display:flex;justify-content:space-between"><span>Coût total</span><strong>'+(typeof fmtM==='function'?fmtM(cost):cost.toFixed(0))+' FCFA</strong></div>'+(target?'<div style="display:flex;justify-content:space-between"><span>Gain/Perte potentiel</span><strong style="color:'+(gain>=0?'var(--green)':'var(--red)')+'">'+(gain>=0?'+':'')+(typeof fmtM==='function'?fmtM(gain):gain.toFixed(0))+' FCFA</strong></div>':'')+'</div>';};
  window.addToWatchlist=function(){var ticker=String(el('watchTicker')?.value||'').toUpperCase().trim();if(!ticker){toastSafe('Sélectionnez un titre.','error');return;}var list=getWatchlist();if(list.some(function(w){return w.ticker===ticker;})){toastSafe('Déjà présent dans la watchlist.','error');return;}list.push({ticker:ticker,addedAt:new Date().toISOString().slice(0,10)});saveWatchlist(list);if(el('watchTicker'))el('watchTicker').selectedIndex=0;toastSafe(ticker+' ajouté à la watchlist.','success');render();};
  window.removeFromWatchlist=function(ticker){saveWatchlist(getWatchlist().filter(function(w){return w.ticker!==ticker;}));render();};
  window.addPriceAlert=function(){var ticker=String(el('alertTicker')?.value||'').toUpperCase().trim(),condition=el('alertCondition')?.value,target=+el('alertTarget')?.value;if(!ticker||!target||target<=0){toastSafe('Champs invalides.','error');return;}var alerts=getAlerts();alerts.push({id:Date.now(),ticker:ticker,condition:condition,target:target,active:true});saveAlerts(alerts);if(el('alertTicker'))el('alertTicker').value='';if(el('alertTarget'))el('alertTarget').value='';toastSafe('Alerte créée.','success');render();};
  window.removePriceAlert=function(id){saveAlerts(getAlerts().filter(function(a){return String(a.id)!==String(id);}));render();};
  window.setPortfolioGoal=function(){var target=+el('goalTarget')?.value;if(!target||target<=0){toastSafe('Montant cible invalide.','error');return;}saveGoal({target:target,date:el('goalDate')?.value||null});toastSafe('Objectif enregistré.','success');render();};
  window.setTargetAllocation=function(){var ticker=String(el('rebalTicker')?.value||'').toUpperCase().trim(),pct=+el('rebalPct')?.value;if(!ticker||!pct||pct<=0){toastSafe('Champs invalides.','error');return;}var a=getTargetAllocation();a[ticker]=pct;saveTargetAllocation(a);if(el('rebalTicker'))el('rebalTicker').value='';if(el('rebalPct'))el('rebalPct').value='';toastSafe('Allocation cible enregistrée.','success');render();};
  window.removeTargetAllocation=function(ticker){var a=getTargetAllocation();delete a[ticker];saveTargetAllocation(a);render();};
  window._pfTableState=window._pfTableState||{search:'',sortBy:'value',sortDir:'desc'};
  window.filterPositionsTable=function(){window._pfTableState.search=String(el('pfSearch')?.value||'').toUpperCase().trim();render();};
  window.sortPositionsTable=function(col){if(window._pfTableState.sortBy===col)window._pfTableState.sortDir=window._pfTableState.sortDir==='asc'?'desc':'asc';else{window._pfTableState.sortBy=col;window._pfTableState.sortDir='desc';}render();};
})();
