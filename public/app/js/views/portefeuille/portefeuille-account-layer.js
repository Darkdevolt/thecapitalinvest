// ============================================================================
// PORTEFEUILLE — COUCHE MULTI-COMPTES  (P2 roadmap : 1 compte par SGI + consolidé)
// N'altère PAS le moteur de calcul existant. Ajoute une couche non intrusive :
//   · un sélecteur de compte en tête de la vue Portefeuille
//   · « Tous les comptes (consolidé) » = comportement d'origine, inchangé
//   · un compte choisi = filtrage du journal AVANT le moteur (getTransactions
//     / getPortfolio), et marquage des nouvelles opérations avec le compte.
// Le compte est porté par le champ `note` déjà persisté par l'API
// (préfixe « @@Label@@ »). Aucune migration, aucun changement d'API requis.
// Les anciennes opérations sans préfixe apparaissent sous « Non affecté » et
// restent visibles en vue consolidée.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_PF_ACCOUNT_LAYER__) return;
  window.__TC_PF_ACCOUNT_LAYER__ = true;

  var LS_LIST = 'tc_pf_accounts';
  var LS_ACTIVE = 'tc_pf_active_account';
  var TAG_RE = /^@@([^@]{1,80})@@\s?/;

  window.tcActiveAccount = window.tcActiveAccount || readActive();

  function readActive() { try { return localStorage.getItem(LS_ACTIVE) || '__all__'; } catch (e) { return '__all__'; } }
  function writeActive(v) { try { localStorage.setItem(LS_ACTIVE, v); } catch (e) {} }
  function readList() { try { return JSON.parse(localStorage.getItem(LS_LIST) || '[]').filter(function (x) { return typeof x === 'string' && x; }); } catch (e) { return []; } }
  function writeList(a) { try { localStorage.setItem(LS_LIST, JSON.stringify(a.slice(0, 40))); } catch (e) {} }

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function acctOf(tx) {
    var m = String(tx && tx.note || '').match(TAG_RE);
    return m ? m[1].trim() : '__none__';
  }

  // --- copie conforme du FIFO de portfolio-store.js (utilisé seulement quand
  //     un compte est filtré ; la vue consolidée passe par l'original) --------
  function transactionOrder(a, b) {
    var da = new Date((a && (a.date_transaction || a.date)) || 0).getTime();
    var db = new Date((b && (b.date_transaction || b.date)) || 0).getTime();
    return da !== db ? da - db : String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
  }
  function rebuildLots(rows) {
    var lots = [];
    (rows || []).slice().sort(transactionOrder).forEach(function (tx) {
      var ticker = String(tx.ticker || '').toUpperCase().trim();
      var qty = Number(tx.quantite != null ? tx.quantite : tx.quantity != null ? tx.quantity : tx.qty || 0);
      var price = Number(tx.prix_unitaire != null ? tx.prix_unitaire : tx.cours != null ? tx.cours : tx.price || 0);
      var type = String(tx.type || '').toUpperCase().trim();
      if (!ticker || qty <= 0) return;
      if (type === 'ACHAT' || type === 'BUY') {
        lots.push({ id: tx.id, ticker: ticker, type: 'action', qty: qty, price: price, date: tx.date_transaction || tx.date, serverId: tx.id });
      } else if (type === 'VENTE' || type === 'SELL') {
        var remaining = qty;
        lots.filter(function (x) { return x.ticker === ticker && x.qty > 0; }).forEach(function (lot) {
          if (remaining <= 0) return;
          var take = Math.min(lot.qty, remaining);
          lot.qty -= take; remaining -= take;
        });
      }
    });
    return lots.filter(function (l) { return l.qty > 0; });
  }

  var origGetTx = null, origGetPf = null, origAdd = null, installed = false;

  function activeFilterEnabled() {
    var a = window.tcActiveAccount;
    return a && a !== '__all__';
  }
  function filteredTx() {
    var all = origGetTx ? origGetTx() : [];
    if (!activeFilterEnabled()) return all;
    var a = window.tcActiveAccount;
    return all.filter(function (t) { return acctOf(t) === a; });
  }

  function install() {
    if (installed) return true;
    if (!window.portfolioStore || typeof window.getTransactions !== 'function' || typeof window.getPortfolio !== 'function') return false;
    origGetTx = window.portfolioStore.getTransactions.bind(window.portfolioStore);
    origGetPf = window.getPortfolio;
    origAdd = window.portfolioStore.addTransaction.bind(window.portfolioStore);

    function gt() {
      if (!activeFilterEnabled()) return origGetTx();
      return filteredTx();
    }
    window.getTransactions = gt;
    window.portfolioStore.getTransactions = gt;

    window.getPortfolio = function () {
      if (!activeFilterEnabled()) return origGetPf();
      return rebuildLots(filteredTx());
    };

    window.portfolioStore.addTransaction = function (input) {
      input = input || {};
      var a = window.tcActiveAccount;
      if (a && a !== '__all__' && !TAG_RE.test(String(input.note || ''))) {
        input.note = '@@' + a + '@@' + (input.note ? ' ' + input.note : '');
      }
      return origAdd(input);
    };

    installed = true;
    return true;
  }

  // Le store est chargé de façon asynchrone : on réessaie jusqu'à disponibilité,
  // puis une fois de plus pour se placer au-dessus des patches trade-flows.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (install() || tries > 60) { clearInterval(timer); setTimeout(install, 1500); }
  }, 200);

  // --- inventaire des comptes ------------------------------------------------
  function knownAccounts() {
    var set = {};
    var raw = origGetTx ? origGetTx() : (window.portfolioStore && window.portfolioStore.getTransactions ? window.portfolioStore.getTransactions() : []);
    (raw || []).forEach(function (t) { var a = acctOf(t); if (a !== '__none__') set[a] = 1; });
    readList().forEach(function (a) { set[a] = 1; });
    var hasNone = (raw || []).some(function (t) { return acctOf(t) === '__none__'; });
    return { list: Object.keys(set).sort(), hasNone: hasNone };
  }

  // --- barre de sélection ---------------------------------------------------
  function injectCss() {
    if (document.getElementById('tc-pf-account-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-pf-account-css';
    s.textContent = [
      '#tcPfAccountBar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--card,#181410);border:1px solid rgba(245,240,232,.1);border-radius:10px;padding:10px 14px;margin-bottom:14px}',
      '#tcPfAccountBar .lab{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold,#B8964E)}',
      '#tcPfAccountBar select{background:var(--surface,#13110C);border:1px solid rgba(245,240,232,.16);color:var(--cream,#F5F0E8);border-radius:8px;padding:7px 10px;font:inherit}',
      '#tcPfAccountBar button{background:transparent;border:1px solid rgba(245,240,232,.2);color:var(--cream,#F5F0E8);border-radius:7px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}',
      '#tcPfAccountBar button:hover{border-color:var(--gold,#B8964E)}',
      '#tcPfAccountBar .hint{font-size:11px;color:var(--muted,rgba(245,240,232,.6))}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function mountBar() {
    var view = document.getElementById('view-portefeuille');
    if (!view) return;
    injectCss();
    var bar = document.getElementById('tcPfAccountBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tcPfAccountBar';
      var header = view.querySelector('.page-header');
      if (header && header.nextSibling) view.insertBefore(bar, header.nextSibling);
      else view.insertBefore(bar, view.firstChild);
    }
    var inv = knownAccounts();
    var active = window.tcActiveAccount || '__all__';
    if (active !== '__all__' && active !== '__none__' && inv.list.indexOf(active) < 0) { active = '__all__'; window.tcActiveAccount = '__all__'; }

    var opts = '<option value="__all__"' + (active === '__all__' ? ' selected' : '') + '>Tous les comptes (consolidé)</option>';
    inv.list.forEach(function (a) { opts += '<option value="' + esc(a) + '"' + (a === active ? ' selected' : '') + '>' + esc(a) + '</option>'; });
    if (inv.hasNone) opts += '<option value="__none__"' + (active === '__none__' ? ' selected' : '') + '>Non affecté</option>';

    bar.innerHTML = '<span class="lab">Compte</span>'
      + '<select id="tcPfAccountSel">' + opts + '</select>'
      + '<button type="button" id="tcPfAccountAdd">＋ Nouveau compte</button>'
      + '<span class="hint">' + (active === '__all__'
        ? 'Vue consolidée : toutes les opérations, tous comptes confondus.'
        : active === '__none__'
          ? 'Opérations sans compte affecté.'
          : 'Filtré sur « ' + esc(active) + ' ». Les nouvelles opérations seront rattachées à ce compte.') + '</span>';

    document.getElementById('tcPfAccountSel').addEventListener('change', function () {
      window.tcActiveAccount = this.value || '__all__';
      writeActive(window.tcActiveAccount);
      rerender();
    });
    document.getElementById('tcPfAccountAdd').addEventListener('click', function () {
      var name = (window.prompt('Nom du compte (ex. « SGI Hudson », « PEA BOA ») :', '') || '').trim().slice(0, 60);
      if (!name || /@@/.test(name)) return;
      var list = readList();
      if (list.indexOf(name) < 0) { list.push(name); writeList(list); }
      window.tcActiveAccount = name;
      writeActive(name);
      rerender();
    });
  }

  function rerender() {
    mountBar();
    if (typeof window.renderPortfolio === 'function') {
      try { window.renderPortfolio(); } catch (e) { console.error('[PF-ACCOUNT] render', e); }
    }
  }

  // Re-monte la barre après chaque rendu du portefeuille.
  var origRender = null;
  function hookRender() {
    if (origRender || typeof window.renderPortfolio !== 'function') return;
    origRender = window.renderPortfolio;
    window.renderPortfolio = function () {
      var r = origRender.apply(this, arguments);
      try { mountBar(); } catch (e) {}
      return r;
    };
  }
  var h = 0;
  var hookTimer = setInterval(function () { hookRender(); if (origRender || ++h > 60) clearInterval(hookTimer); }, 200);

  window.addEventListener('portfolio:updated', function () { setTimeout(mountBar, 60); });
  setTimeout(mountBar, 500);
})();
