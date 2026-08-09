// THE CAPITAL — server-side portfolio CRUD corrections
(function(){
  function refresh(){ if(typeof renderPortfolio==='function') renderPortfolio(); }
  function notify(message,type){ if(typeof toast==='function') toast(message,type); }

  function addPosition(){
    const ticker=String(document.getElementById('pfTicker')?.value||'').toUpperCase().trim();
    const type=document.getElementById('pfType')?.value||'action';
    const qty=Number(document.getElementById('pfQty')?.value);
    const price=Number(document.getElementById('pfPrice')?.value);
    const date=document.getElementById('pfDate')?.value||new Date().toISOString().slice(0,10);
    if(!ticker||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<=0){notify('Champs invalides.','error');return;}
    if(!window.portfolioStore||typeof window.portfolioStore.addTransaction!=='function'){notify('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:'ACHAT',ticker,quantity:qty,price,date})
      .then(function(){document.getElementById('pfQty').value='';document.getElementById('pfPrice').value='';document.getElementById('pfDate').value='';document.getElementById('pfTicker').selectedIndex=0;refresh();notify(`${qty} × ${ticker} ajouté au portefeuille.`,'success');})
      .catch(function(error){notify(error.message||'Erreur lors de l’achat.','error');});
  }
  window.addPosition=addPosition;

  function sell(ticker,qty,price,date,onSuccess){
    ticker=String(ticker||'').toUpperCase().trim();qty=Number(qty);price=Number(price);
    if(!ticker||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<=0){notify('Champs invalides.','error');return;}
    if(!window.portfolioStore||typeof window.portfolioStore.addTransaction!=='function'){notify('API portefeuille indisponible.','error');return;}
    const held=getPortfolio().filter(p=>(p.ticker||'').toUpperCase().trim()===ticker).reduce((s,p)=>s+Number(p.qty||0),0);
    if(qty>held){notify(`Quantité supérieure à la position détenue (${held}).`,'error');return;}
    window.portfolioStore.addTransaction({type:'VENTE',ticker,quantity:qty,price,date:date||new Date().toISOString().slice(0,10)})
      .then(function(){if(typeof onSuccess==='function')onSuccess();refresh();notify(`Vente enregistrée — ${qty} × ${ticker}`,'success');})
      .catch(function(error){notify(error.message||'Erreur lors de la vente.','error');});
  }
  window.sellPositionQuick=function(){sell(document.getElementById('pfSellTicker')?.value,document.getElementById('pfSellQty')?.value,document.getElementById('pfSellPrice')?.value,document.getElementById('pfSellDate')?.value,function(){document.getElementById('pfSellQty').value='';document.getElementById('pfSellPrice').value='';document.getElementById('pfSellDate').value='';});};
  window.confirmSell=function(){sell(document.getElementById('sellTicker')?.value,document.getElementById('sellQty')?.value,document.getElementById('sellPrice')?.value,document.getElementById('sellDate')?.value,function(){if(typeof closeSellModal==='function')closeSellModal();});};

  // Cash et dividendes : la transaction serveur est la source de vérité.
  window.addCash=function(){
    const type=document.getElementById('cashType')?.value||'deposit';
    const amount=Number(document.getElementById('cashAmount')?.value);
    if(!Number.isFinite(amount)||amount<=0){notify('Montant invalide.','error');return;}
    if(type==='withdraw'&&amount>getCash()){notify('Solde liquide insuffisant pour ce retrait.','error');return;}
    if(!window.portfolioStore?.addTransaction){notify('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:type==='withdraw'?'RETRAIT':'DEPOT',ticker:'CASH',quantity:1,price:amount,amount,date:new Date().toISOString().slice(0,10)})
      .then(function(){document.getElementById('cashAmount').value='';refresh();notify(type==='withdraw'?'Retrait enregistré.':'Dépôt enregistré.','success');})
      .catch(function(error){notify(error.message||'Erreur de synchronisation.','error');});
  };

  window.addDividend=function(){
    const ticker=String(document.getElementById('divTicker')?.value||'').toUpperCase().trim();
    const amount=Number(document.getElementById('divAmount')?.value);
    const date=document.getElementById('divDate')?.value||new Date().toISOString().slice(0,10);
    if(!ticker){notify('Renseignez un ticker.','error');return;}
    if(!Number.isFinite(amount)||amount<=0){notify('Montant invalide.','error');return;}
    if(!window.portfolioStore?.addTransaction){notify('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:'DIVIDENDE',ticker,quantity:1,price:amount,amount,date})
      .then(function(){document.getElementById('divTicker').value='';document.getElementById('divAmount').value='';document.getElementById('divDate').value='';refresh();notify(`Dividende de ${ticker} enregistré.`,'success');})
      .catch(function(error){notify(error.message||'Erreur de synchronisation.','error');});
  };
})();
