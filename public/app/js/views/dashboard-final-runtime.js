/* THE CAPITAL — Dashboard final runtime guard
 *
 * Last browser-side compatibility layer for the Overview view.
 * It does not create or alter API endpoints, Supabase tables, authentication,
 * or business rules. It only reconciles the already-published browser data
 * with the dashboard and provides safe fallbacks when a late/partial load
 * leaves a dashboard block empty.
 */
(function () {
  'use strict';
  if (window.__TC_DASHBOARD_FINAL_RUNTIME__) return;
  window.__TC_DASHBOARD_FINAL_RUNTIME__ = true;

  var renderTimer = 0;
  var lastSignature = '';
  var historyRequested = false;

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }
  function norm(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function publishGlobals() {
    window.allCours = arr(window.allCours);
    window.allIndices = arr(window.allIndices);
    window.allIndicesHistory = arr(window.allIndicesHistory);
    window.allEntreprises = arr(window.allEntreprises);
    window.allAnalyses = arr(window.allAnalyses);
    window.allFinancials = arr(window.allFinancials);
    window.allDividendes = arr(window.allDividendes);
    window.allBoc = arr(window.allBoc);
    window.allCoupons = arr(window.allCoupons);
    window.entMap = Object.fromEntries(window.allEntreprises.filter(function (r) { return r && r.ticker; }).map(function (r) {
      return [String(r.ticker).trim().toUpperCase(), r];
    }));
  }

  function latestByIndice(rows) {
    var out = {};
    arr(rows).forEach(function (r) {
      if (!r || !r.indice || !r.date_seance || num(r.valeur) == null) return;
      var k = String(r.indice).trim();
      if (!out[k] || String(r.date_seance) > String(out[k].date_seance)) out[k] = r;
    });
    return out;
  }

  function findIndice(map, candidates) {
    var keys = Object.keys(map);
    for (var i = 0; i < candidates.length; i++) {
      var wanted = norm(candidates[i]);
      var hit = keys.find(function (k) { return norm(k) === wanted; });
      if (hit) return map[hit];
    }
    return null;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fmt(v, decimals) {
    var n = num(v);
    return n == null ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
  }

  function fmtPct(v) {
    var n = num(v);
    return n == null ? '—' : (n > 0 ? '+' : '') + n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function renderFallbackIndexCards() {
    var map = latestByIndice(window.allIndicesHistory.length ? window.allIndicesHistory : window.allIndices);
    if (!Object.keys(map).length) return;
    var defs = [
      { ids: ['idx-composite', 'idx-composite-chg'], candidates: ['BRVM C', 'BRVM Composite', 'BRVM-COMPOSITE', 'COMPOSITE'] },
      { ids: ['idx-30', 'idx-30-chg'], candidates: ['BRVM 30', 'BRVM30', 'BRVM-30', '30'] },
      { ids: ['idx-prestige', 'idx-prestige-chg'], candidates: ['BRVM Prestige', 'BRVMPrestige', 'BRVM-PRESTIGE', 'PRESTIGE'] }
    ];
    defs.forEach(function (d) {
      var row = findIndice(map, d.candidates);
      if (!row) return;
      var value = document.getElementById(d.ids[0]);
      var change = document.getElementById(d.ids[1]);
      if (value && (value.textContent === '—' || value.textContent === '—' || !value.textContent.trim())) value.textContent = fmt(row.valeur, 2);
      if (change && (change.textContent === '—' || change.textContent === '—' || !change.textContent.trim())) {
        var v = num(row.variation);
        change.textContent = v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + ' pts';
        change.classList.toggle('up', v > 0);
        change.classList.toggle('down', v < 0);
        change.classList.toggle('neutral', v === 0 || v == null);
      }
    });
  }

  function renderFallbackActivity() {
    var host = document.getElementById('recentActivity');
    if (!host || host.children.length) return;
    var rows = arr(window.allCours).filter(function (r) { return r && r.ticker; });
    if (!rows.length) return;
    var latestDate = rows.reduce(function (m, r) { return !m || String(r.date_seance) > String(m) ? r.date_seance : m; }, '');
    var session = rows.filter(function (r) { return String(r.date_seance) === String(latestDate); });
    var volume = session.reduce(function (s, r) { return s + (num(r.volume) || 0); }, 0);
    var value = session.reduce(function (s, r) { return s + (num(r.valeur_totale) || 0); }, 0);
    host.innerHTML = '<div class="tc-dashboard-fallback-row"><span>Dernière séance</span><strong>' + esc(latestDate || '—') + '</strong></div>' +
      '<div class="tc-dashboard-fallback-row"><span>Valeur échangée</span><strong>' + fmt(value, 0) + ' FCFA</strong></div>' +
      '<div class="tc-dashboard-fallback-row"><span>Volume</span><strong>' + fmt(volume, 0) + ' titres</strong></div>';
  }

  function settleLoading() {
    var root = document.getElementById('view-overview');
    if (!root) return;
    root.querySelectorAll('.loading[data-tc-settled], .skeleton[data-tc-settled]').forEach(function (el) { el.removeAttribute('data-tc-settled'); });
    root.querySelectorAll('.loading, .skeleton').forEach(function (el) {
      if (el.closest('#chartComposite')) return;
      var text = (el.textContent || '').trim().toLowerCase();
      if (text.indexOf('chargement') === -1 && text.indexOf('données') === -1 && text.indexOf('lecture') === -1) return;
      el.setAttribute('data-tc-settled', '1');
    });
  }

  function reconcile(reason) {
    var root = document.getElementById('view-overview');
    if (!root) return;
    publishGlobals();

    var signature = [
      reason,
      window.allCours.length,
      window.allIndices.length,
      window.allIndicesHistory.length,
      window.allEntreprises.length,
      window.allAnalyses.length,
      window.allDividendes.length
    ].join('|');

    if (signature === lastSignature && reason !== 'resize') return;
    lastSignature = signature;

    if (!window.allIndicesHistory.length && !historyRequested && typeof window.loadIndexHistory === 'function') {
      historyRequested = true;
      Promise.resolve(window.loadIndexHistory()).catch(function (e) {
        console.warn('[DASHBOARD] Historique des indices indisponible:', e);
      });
    }

    try {
      if (typeof window.renderOverview === 'function') window.renderOverview();
    } catch (e) {
      console.error('[DASHBOARD] Rendu principal en échec:', e);
    }

    renderFallbackIndexCards();
    renderFallbackActivity();
    settleLoading();
  }

  function queue(reason, delay) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { reconcile(reason); }, delay == null ? 30 : delay);
  }

  window.addEventListener('tc:dataready', function (e) {
    var phase = e && e.detail && e.detail.phase || 'dataready';
    queue(phase, phase === 'critical' ? 20 : 0);
  });

  window.addEventListener('hashchange', function () { queue('navigation', 20); });
  window.addEventListener('resize', function () { if (location.hash === '#overview' || document.getElementById('view-overview')?.classList.contains('active')) queue('resize', 120); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) queue('visibility', 40); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { queue('ready', 0); }, { once: true });
  else queue('ready', 0);
})();
