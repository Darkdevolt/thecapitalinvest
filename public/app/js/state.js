// ═══════════════════════════════════════
// STATE, The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern : empêche le double chargement
(function() {
  if (window.__TC_STATE_LOADED__) {
    console.log('[STATE] Déjà chargé, skip.');
    return;
  }
  window.__TC_STATE_LOADED__ = true;

  // Chargement de script dédupliqué par CHEMIN (sans ?v=). Plusieurs loaders
  // (state, init, loader, vues) demandaient le même fichier avec des ?v=
  // différents -> double, voire triple téléchargement et double exécution
  // (source de gestionnaires d'événements liés deux fois — cf. doublon d'achat
  // au portefeuille). Tout passe désormais par ici.
  window.__tcScriptOnce = window.__tcScriptOnce || {};
  window.tcLoadOnce = function (src) {
    var path = String(src || '').split('?')[0];
    if (!path) return Promise.resolve();
    if (window.__tcScriptOnce[path]) return window.__tcScriptOnce[path];
    try {
      if (document.querySelector('script[src="' + path + '"], script[src^="' + path + '?"]')) {
        window.__tcScriptOnce[path] = Promise.resolve();
        return window.__tcScriptOnce[path];
      }
    } catch (e) {}
    window.__tcScriptOnce[path] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.async = false; s.dataset.tcOnce = path;
      s.onload = function () { resolve(); };
      s.onerror = function () { console.warn('[LOAD] indisponible : ' + src); resolve(); };
      (document.head || document.documentElement).appendChild(s);
    });
    return window.__tcScriptOnce[path];
  };

  window.allCours = [];
  window.allBoc = [];
  window.allAnalyses = [];
  /* États financiers : BPA, DPA et nombre d'actions ramenés à la base d'actions ACTUELLE.
     `facteur_actions` (colonne de financials, défaut 1) est le multiplicateur du BPA/DPA d'une ligne
     après une attribution gratuite ou un fractionnement postérieur (BOAB avant sept. 2024 : 0,5) ;
     le nombre d'actions est divisé par ce facteur. Les valeurs publiées restent lisibles dans
     bpa_brut / dpa_brut / nombre_actions_brut : le PER historique confronte le cours BRUT de
     l'époque au BPA BRUT (financials-per.js). L'accesseur couvre tous les chemins de chargement
     (loader, backoffice, dashboard) ; l'opération est idempotente (marque tc_ajuste). */
  window.tcAdjustFinancials = function (rows) {
    if (!Array.isArray(rows)) return rows;
    var arrondi = function (v) { return Math.round(v * 100) / 100; };
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object' || r.tc_ajuste != null) return;
      var f = Number(r.facteur_actions);
      if (!(f > 0) || f === 1) return;
      r.tc_ajuste = f;
      if (r.bpa != null && r.bpa !== '' && isFinite(Number(r.bpa))) { r.bpa_brut = r.bpa; r.bpa = arrondi(Number(r.bpa) * f); }
      if (r.dpa != null && r.dpa !== '' && isFinite(Number(r.dpa))) { r.dpa_brut = r.dpa; r.dpa = arrondi(Number(r.dpa) * f); }
      ['nombre_actions', 'nb_actions'].forEach(function (k) {
        if (r[k] != null && r[k] !== '' && isFinite(Number(r[k]))) { r[k + '_brut'] = r[k]; r[k] = Math.round(Number(r[k]) / f); }
      });
    });
    return rows;
  };
  /* Opérations sur le nombre d'actions d'un titre (entreprises.operations_capital), triées par date. */
  window.tcCapitalOps = function (ticker) {
    var t = String(ticker || '').toUpperCase();
    var e = (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .find(function (x) { return x && String(x.ticker).toUpperCase() === t; });
    var ops = e && Array.isArray(e.operations_capital) ? e.operations_capital : [];
    return ops.filter(function (o) { return o && o.date; })
      .sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
  };
  /* Une opération AJUSTE-t-elle les BPA, DPA et cours antérieurs ? Oui pour un fractionnement, une attribution gratuite ou un
     regroupement (le nombre d'actions change sans apport d'argent). Non pour une augmentation en numéraire, une fusion, etc.
     (types alignés sur facteur_actions_a côté base). */
  window.tcOpAdjusts = function (o) {
    return !!o && /^(fractionnement|attribution_gratuite|regroupement)$/.test(String(o.type)) && Number(o.ratio) > 0;
  };
  /* Facteur d'ajustement d'un COURS brut du jour `ymd` (AAAA-MM-JJ) à la base d'actions actuelle :
     produit des 1/ratio des opérations datées APRÈS ce jour (BOAB : 0,5 avant le 03/09/2024, 1 ensuite).
     Seules les opérations marquées `cours_bruts: true` comptent : si l'historique des cours est un jour
     chargé déjà ajusté, il ne faut pas l'ajuster deux fois (mettre l'indicateur à false). Sans opération : 1. */
  window.tcShareFactorAt = function (ticker, ymd) {
    var day = String(ymd || '').slice(0, 10), f = 1;
    window.tcCapitalOps(ticker).forEach(function (o) {
      if (window.tcOpAdjusts(o) && o.cours_bruts === true && day && day < String(o.date).slice(0, 10) && !(o.deja_ajuste_avant && day < String(o.deja_ajuste_avant).slice(0, 10))) f /= Number(o.ratio);
    });
    return f;
  };
  /* Certaines séries de la base sont DÉJÀ ajustées d'une opération avant une date (deja_ajuste_avant) : les cours BOA d'avant
     le 17/08/2021 valent la moitié des cours réels (base d'actions de 2024). Multiplicateur qui ramène un cours de la base
     au cours réellement coté ce jour-là (1 si la série est brute) : sert à calculer un ajustement de dividende correct. */
  window.tcRawScaleAt = function (ticker, ymd) {
    var day = String(ymd || '').slice(0, 10), m = 1;
    window.tcCapitalOps(ticker).forEach(function (o) {
      if (window.tcOpAdjusts(o) && o.cours_bruts === true && o.deja_ajuste_avant && day && day < String(o.deja_ajuste_avant).slice(0, 10) && day < String(o.date).slice(0, 10)) m *= Number(o.ratio);
    });
    return m;
  };
  var tcFinancialsStore = [];
  Object.defineProperty(window, 'allFinancials', {
    configurable: true, enumerable: true,
    get: function () { return tcFinancialsStore; },
    set: function (v) { tcFinancialsStore = window.tcAdjustFinancials(v); }
  });
  window.allFinancials = [];
  window.allEntreprises = [];
  window.allIndices = [];
  window.ficheHistorique = [];
  window.ficheChartPeriod = 30;
  window.ficheChartInst = null;
  window.compositeChartInst = null;
  window.techChartInst = null;
  window.techVolInst = null;
  window.prevView = 'titres';
  window._titreFilter = 'all';
  window._bocFilter = 'all';
  window._analyseFilter = 'all';
  window._pubFilter = 'all';
  window._sortState = {};
  window.entMap = {};
  window._fundMethod = 'tcam';

  (function loadMarketUX(){
    if (window.__TC_CLOCK_INTERVAL__) {
      clearInterval(window.__TC_CLOCK_INTERVAL__);
      window.__TC_CLOCK_INTERVAL__ = null;
    }
    window.tcLoadOnce('/app/js/market-ux.js?v=20260827.3');
  })();

  (function loadMarketStatusReconciler(){
    if (document.getElementById('tc-market-status-reconciler-script')) return;
    var script = document.createElement('script');
    script.id = 'tc-market-status-reconciler-script';
    script.src = '/app/js/market-status-reconciler.js?v=20260827.1';
    script.defer = true;
    document.head.appendChild(script);
  })();

  window.destroyChart = function(chartVar) {
    if (chartVar && typeof chartVar.destroy === 'function') chartVar.destroy();
    return null;
  };
  window.destroyAllCharts = function() {
    ficheChartInst = destroyChart(ficheChartInst);
    compositeChartInst = destroyChart(compositeChartInst);
    techChartInst = destroyChart(techChartInst);
    techVolInst = destroyChart(techVolInst);
  };
  console.log('[STATE] Chargé avec succès');
})();
