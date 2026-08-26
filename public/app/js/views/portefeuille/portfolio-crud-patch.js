// THE CAPITAL, server-side portfolio CRUD corrections
(function(){
  function refresh(){ if(typeof renderPortfolio==='function') renderPortfolio(); }
  function notify(message,type){ if(typeof toast==='function') toast(message,type); }
  function setValue(id,value){
    const el=document.getElementById(id);
    if(el) el.value=value;
    return el;
  }
  function setSelectedIndex(id,index){
    const el=document.getElementById(id);
    if(el) el.selectedIndex=index;
    return el;
  }
  function setText(id,value){
    const el=document.getElementById(id);
    if(el) el.textContent=value;
    return el;
  }

  function addPosition(){
    const ticker=String(document.getElementById('pfTicker')?.value||'').toUpperCase().trim();
    const type=document.getElementById('pfType')?.value||'action';
    const qty=Number(document.getElementById('pfQty')?.value);
    const price=Number(document.getElementById('pfPrice')?.value);
    const date=document.getElementById('pfDate')?.value||new Date().toISOString().slice(0,10);
    if(!ticker||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<=0){notify('Champs invalides.','error');return;}
    if(!window.portfolioStore||typeof window.portfolioStore.addTransaction!=='function'){notify('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:'ACHAT',ticker,quantity:qty,price,date})
      .then(function(){
        setValue('pfQty','');
        setValue('pfPrice','');
        setValue('pfDate','');
        setSelectedIndex('pfTicker',0);
        refresh();
        notify(`${qty} × ${ticker} ajouté au portefeuille.`,'success');
      })
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
      .then(function(){if(typeof onSuccess==='function')onSuccess();refresh();notify(`Vente enregistrée, ${qty} × ${ticker}`,'success');})
      .catch(function(error){notify(error.message||'Erreur lors de la vente.','error');});
  }
  window.sellPositionQuick=function(){
    sell(
      document.getElementById('pfSellTicker')?.value,
      document.getElementById('pfSellQty')?.value,
      document.getElementById('pfSellPrice')?.value,
      document.getElementById('pfSellDate')?.value,
      function(){
        setValue('pfSellQty','');
        setValue('pfSellPrice','');
        setValue('pfSellDate','');
        setText('sellHint','');
      }
    );
  };
  window.confirmSell=function(){
    sell(
      document.getElementById('sellTicker')?.value,
      document.getElementById('sellQty')?.value,
      document.getElementById('sellPrice')?.value,
      document.getElementById('sellDate')?.value,
      function(){if(typeof closeSellModal==='function')closeSellModal();}
    );
  };

  // Edition : certains écrans/états peuvent ne pas avoir le modal monté.
  // Ne jamais écrire dans un élément DOM inexistant.
  window.openEditModal=function(id){
    const pf=typeof getPortfolio==='function'?getPortfolio():[];
    const pos=pf.find(function(p){return String(p.id)===String(id);});
    if(!pos){notify('Position introuvable.','error');return;}

    const editModal=document.getElementById('editModal');
    const editId=document.getElementById('editId');
    const editQty=document.getElementById('editQty');
    const editPrice=document.getElementById('editPrice');
    const editDate=document.getElementById('editDate');

    if(!editModal||!editId||!editQty||!editPrice||!editDate){
      notify('Interface d’édition du portefeuille indisponible. Rechargez la vue Portefeuille.','error');
      return;
    }

    editId.value=pos.id;
    editQty.value=pos.qty;
    editPrice.value=pos.price;
    editDate.value=pos.date||'';
    editModal.classList.add('open');
  };

  window.closeEditModal=function(){
    const modal=document.getElementById('editModal');
    if(modal) modal.classList.remove('open');
  };

  window.confirmEdit=function(){
    const idEl=document.getElementById('editId');
    const qtyEl=document.getElementById('editQty');
    const priceEl=document.getElementById('editPrice');
    const dateEl=document.getElementById('editDate');
    if(!idEl||!qtyEl||!priceEl||!dateEl){
      notify('Interface d’édition du portefeuille indisponible.','error');
      return;
    }

    const id=idEl.value;
    const qty=Number(qtyEl.value);
    const price=Number(priceEl.value);
    const date=dateEl.value;
    if(!qty||qty<=0||!price||price<=0){notify('Valeurs invalides.','error');return;}

    const pf=typeof getPortfolio==='function'?getPortfolio():[];
    const pos=pf.find(function(p){return String(p.id)===String(id);});
    if(!pos){notify('Position introuvable.','error');return;}
    pos.qty=qty;
    pos.price=price;
    pos.date=date;
    if(typeof savePortfolio==='function') savePortfolio(pf);
    if(typeof invalidatePortfolioCache==='function') invalidatePortfolioCache();
    window.closeEditModal();
    notify('Position mise à jour.','success');
    refresh();
  };

  // Cash et dividendes : la transaction serveur est la source de vérité.
  window.addCash=function(){
    const type=document.getElementById('cashType')?.value||'deposit';
    const amount=Number(document.getElementById('cashAmount')?.value);
    if(!Number.isFinite(amount)||amount<=0){notify('Montant invalide.','error');return;}
    if(type==='withdraw'&&amount>getCash()){notify('Solde liquide insuffisant pour ce retrait.','error');return;}
    if(!window.portfolioStore?.addTransaction){notify('API portefeuille indisponible.','error');return;}
    window.portfolioStore.addTransaction({type:type==='withdraw'?'RETRAIT':'DEPOT',ticker:'CASH',quantity:1,price:amount,amount,date:new Date().toISOString().slice(0,10)})
      .then(function(){setValue('cashAmount','');refresh();notify(type==='withdraw'?'Retrait enregistré.':'Dépôt enregistré.','success');})
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
      .then(function(){
        setValue('divTicker','');
        setValue('divAmount','');
        setValue('divDate','');
        refresh();
        notify(`Dividende de ${ticker} enregistré.`,'success');
      })
      .catch(function(error){notify(error.message||'Erreur de synchronisation.','error');});
  };
})();
