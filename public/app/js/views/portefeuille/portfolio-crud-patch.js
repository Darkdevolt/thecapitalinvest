// THE CAPITAL — server-side portfolio CRUD corrections
(function(){
  function addPosition(){
    const ticker=String(document.getElementById('pfTicker')?.value||'').toUpperCase().trim();
    const type=document.getElementById('pfType')?.value||'action';
    const qty=Number(document.getElementById('pfQty')?.value);
    const price=Number(document.getElementById('pfPrice')?.value);
    const date=document.getElementById('pfDate')?.value||new Date().toISOString().slice(0,10);
    if(!ticker||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<=0){if(typeof toast==='function')toast('Champs invalides.','error');return;}
    if(!window.portfolioStore||typeof window.portfolioStore.addTransaction!=='function'){toast('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:'ACHAT',ticker,quantity:qty,price,date})
      .then(function(){
        document.getElementById('pfQty').value='';document.getElementById('pfPrice').value='';document.getElementById('pfDate').value='';document.getElementById('pfTicker').selectedIndex=0;
        if(typeof renderPortfolio==='function')renderPortfolio();
        if(typeof toast==='function')toast(`${qty} × ${ticker} ajouté au portefeuille.`,'success');
      }).catch(function(error){if(typeof toast==='function')toast(error.message,'error');});
  }

  window.addPosition=addPosition;

  function sell(ticker,qty,price,date,onSuccess){
    ticker=String(ticker||'').toUpperCase().trim();qty=Number(qty);price=Number(price);
    if(!ticker||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<=0){if(typeof toast==='function')toast('Champs invalides.','error');return;}
    if(!window.portfolioStore||typeof window.portfolioStore.addTransaction!=='function'){toast('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:'VENTE',ticker,quantity:qty,price,date:date||new Date().toISOString().slice(0,10)})
      .then(function(){if(typeof onSuccess==='function')onSuccess();if(typeof renderPortfolio==='function')renderPortfolio();if(typeof toast==='function')toast(`Vente enregistrée — ${qty} × ${ticker}`,'success');})
      .catch(function(error){if(typeof toast==='function')toast(error.message,'error');});
  }

  window.sellPositionQuick=function(){sell(document.getElementById('pfSellTicker')?.value,document.getElementById('pfSellQty')?.value,document.getElementById('pfSellPrice')?.value,document.getElementById('pfSellDate')?.value,function(){document.getElementById('pfSellQty').value='';document.getElementById('pfSellPrice').value='';document.getElementById('pfSellDate').value='';});};
  window.confirmSell=function(){sell(document.getElementById('sellTicker')?.value,document.getElementById('sellQty')?.value,document.getElementById('sellPrice')?.value,document.getElementById('sellDate')?.value,function(){if(typeof closeSellModal==='function')closeSellModal();});};
})();
