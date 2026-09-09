/* ============================================================================
   THE CAPITAL — Bandeau d'état de la base de données
   ----------------------------------------------------------------------------
   Rend visible, en permanence, que la base Supabase « brvm data » est bien
   chargée : séance, nombre de valeurs / sociétés / indices, ou un état
   d'erreur explicite avec bouton « réessayer » — plutôt qu'un écran blanc.
   Écoute tc:dataready (émis par loader.js à chaque phase).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__TC_DATA_STATUS__) return;
  window.__TC_DATA_STATUS__ = true;

  var STYLE_ID = 'tc-data-status-css';
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#tcDataStatus{position:sticky;top:calc(var(--tc-header,64px) + var(--tc-nav,44px));z-index:800;' +
      'display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 22px;' +
      'font:500 10px/1.4 var(--sans,system-ui);letter-spacing:.02em;' +
      'background:rgba(20,17,12,.96);border-bottom:1px solid var(--border2,rgba(184,150,78,.08));' +
      'color:var(--muted,#9e978e)}' +
      '#tcDataStatus .dot{width:6px;height:6px;border-radius:50%;background:var(--green,#4ade80);flex:0 0 auto}' +
      '#tcDataStatus.warn .dot{background:var(--warn,#f0a72a)}' +
      '#tcDataStatus.err{color:var(--red,#f87171)}#tcDataStatus.err .dot{background:var(--red,#f87171)}' +
      '#tcDataStatus b{color:var(--cream,#f5f0e8);font-weight:600}' +
      '#tcDataStatus .sep{opacity:.4}' +
      '#tcDataStatus button{margin-left:auto;border:1px solid var(--border,rgba(184,150,78,.15));' +
      'background:transparent;color:var(--gold-l,#d4af6a);border-radius:6px;padding:3px 10px;' +
      'font:600 9px var(--sans,system-ui);text-transform:uppercase;letter-spacing:.08em;cursor:pointer}' +
      '#tcDataStatus button:hover{border-color:var(--gold,#b8964e)}' +
      '@media(max-width:700px){#tcDataStatus{padding:6px 12px;font-size:9px}}';
    document.head.appendChild(s);
  }

  function bar() {
    var b = document.getElementById('tcDataStatus');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'tcDataStatus';
    b.setAttribute('role', 'status');
    var shell = document.getElementById('tcShell');
    if (shell && shell.parentNode) shell.parentNode.insertBefore(b, shell.nextSibling);
    else document.body.insertBefore(b, document.body.firstChild);
    return b;
  }

  function latestSeance() {
    var rows = (window.allCours && window.allCours.length ? window.allCours : window.allIndices) || [];
    var max = '';
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i] && rows[i].date_seance ? String(rows[i].date_seance) : '';
      if (d > max) max = d;
    }
    if (!max) return '';
    var p = max.slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : max.slice(0, 10);
  }

  function n(v) { return (Array.isArray(v) ? v.length : 0).toLocaleString('fr-FR'); }
  function distinctTickers(v) {
    var s = {}; (Array.isArray(v) ? v : []).forEach(function (x) { if (x && x.ticker) s[x.ticker] = 1; });
    return Object.keys(s).length;
  }

  var lastPhase = '';
  function render(detail) {
    injectCss();
    var el = bar();
    var cours = window.allCours || [];
    var indices = window.allIndices || [];
    var ok = cours.length > 0 || indices.length > 0;
    var enriched = lastPhase === 'enrichment' || lastPhase === 'ondemand';

    if (!ok) {
      el.className = 'err';
      el.innerHTML = '<span class="dot"></span><span>Base de données BRVM indisponible pour le moment.</span>' +
        '<button type="button" id="tcDataRetry">Réessayer</button>';
    } else {
      var seance = latestSeance();
      var soc = distinctTickers(window.allFinancials);
      var parts = [];
      parts.push('<span class="dot"></span><span>Base BRVM</span>');
      if (seance) parts.push('<span class="sep">·</span><span>séance du <b>' + seance + '</b></span>');
      parts.push('<span class="sep">·</span><span><b>' + distinctTickers(cours) + '</b> valeurs</span>');
      parts.push('<span class="sep">·</span><span><b>' + n(indices) + '</b> pts indices</span>');
      if (soc) parts.push('<span class="sep">·</span><span><b>' + soc + '</b> sociétés (états financiers)</span>');
      parts.push('<span class="sep">·</span><span><b>' + distinctTickers(window.allDividendes) + '</b> tickers dividendes</span>');
      el.className = enriched ? '' : 'warn';
      if (!enriched) parts.push('<span class="sep">·</span><span>chargement des données financières…</span>');
      el.innerHTML = parts.join('');
    }

    var retry = document.getElementById('tcDataRetry');
    if (retry) retry.addEventListener('click', function () {
      retry.disabled = true; retry.textContent = '…';
      try { window.__tcLoadPromise = null; } catch (e) {}
      var loader = window.__tcOptimizedLoadAll || window.loadAll;
      if (typeof loader === 'function') Promise.resolve().then(loader).catch(function () {});
    });
  }

  window.addEventListener('tc:dataready', function (e) {
    lastPhase = (e && e.detail && e.detail.phase) || lastPhase;
    render(e && e.detail);
  });

  // Premier rendu (au cas où les données seraient déjà là ou pas encore).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { render(null); }, { once: true });
  } else {
    render(null);
  }
})();
