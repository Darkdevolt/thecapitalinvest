// THE CAPITAL — server-side portfolio CRUD corrections
(function(){
  function sell(ticker, qty, price, date, onSuccess){
    ticker = String(ticker || '').toUpperCase().trim();
    qty = Number(qty); price = Number(price);
    if (!ticker || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      if (typeof toast === 'function') toast('Champs invalides.', 'error');
      return;
    }
    window.portfolioStore.addTransaction({ type:'VENTE', ticker, quantity:qty, price, date:date || new Date().toISOString().slice(0,10) })
      .then(function(){
        if (typeof onSuccess === 'function') onSuccess();
        if (typeof renderPortfolio === 'function') renderPortfolio();
        if (typeof toast === 'function') toast(`Vente enregistrée — ${qty} × ${ticker}`, 'success');
      })
      .catch(function(error){ if (typeof toast === 'function') toast(error.message, 'error'); });
  }

  window.sellPositionQuick = function(){
    sell(
      document.getElementById('pfSellTicker')?.value,
      document.getElementById('pfSellQty')?.value,
      document.getElementById('pfSellPrice')?.value,
      document.getElementById('pfSellDate')?.value,
      function(){
        document.getElementById('pfSellQty').value='';
        document.getElementById('pfSellPrice').value='';
        document.getElementById('pfSellDate').value='';
      }
    );
  };

  window.confirmSell = function(){
    sell(
      document.getElementById('sellTicker')?.value,
      document.getElementById('sellQty')?.value,
      document.getElementById('sellPrice')?.value,
      document.getElementById('sellDate')?.value,
      function(){ if (typeof closeSellModal === 'function') closeSellModal(); }
    );
  };
})();
