/* ============================================================
   THE CAPITAL — BACK-OFFICE / APP BRIDGE
   Le back-office est la source de vérité. Cette couche ne modifie
   aucune donnée : elle synchronise les sources publiques disponibles,
   expose leur fraîcheur et informe les vues lorsqu'une donnée change.
   ============================================================ */
(function (w) {
  'use strict';

  var state = w.TC_BACKOFFICE = w.TC_BACKOFFICE || {
    status: 'idle', startedAt: null, finishedAt: null, lastSync: null,
    sources: {}, errors: [], version: '1.1.0'
  };

  var sources = {
    entreprises: function () { return w.apiGetEntreprises ? w.apiGetEntreprises() : w.apiGet('/marche?type=entreprises'); },
    cours: function () { return w.apiGetCours ? w.apiGetCours() : w.apiGet('/marche?type=cours'); },
    indices: function () { return w.apiGetIndices ? w.apiGetIndices() : w.apiGet('/marche?type=indices'); },
    indices_historique: function () { return w.apiGetIndicesHistory ? w.apiGetIndicesHistory(30) : w.apiGet('/marche?type=indices_historique&limit=30'); },
    dividendes: function () { return w.apiGet('/marche?type=dividendes'); },
    analyses: function () { return w.apiGetAnalyses ? w.apiGetAnalyses() : w.apiGet('/marche?type=analyses'); },
    financials: function () { return w.apiGetFinancials ? w.apiGetFinancials() : w.apiGet('/marche?type=financials'); },
    boc: function () { return w.apiGetBOC ? w.apiGetBOC() : w.apiGet('/boc'); },
    apercu: function () { return w.apiGetApercu ? w.apiGetApercu() : w.apiGet('/marche?type=apercu'); }
  };

  function emit(type, detail) {
    try { w.dispatchEvent(new CustomEvent(type, { detail: detail || {} })); } catch (e) {}
  }

  function save(key, data) {
    state.sources[key] = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      count: Array.isArray(data) ? data.length : (data && Array.isArray(data.data) ? data.data.length : null),
      data: data
    };
  }

  async function sync(options) {
    options = options || {};
    if (state.status === 'loading' && !options.force) return state;
    state.status = 'loading';
    state.startedAt = new Date().toISOString();
    state.errors = [];
    emit('tc:backoffice-sync-start', state);

    var keys = Object.keys(sources);
    var results = await Promise.allSettled(keys.map(function (key) {
      return Promise.resolve().then(function () { return sources[key](); });
    }));

    results.forEach(function (result, i) {
      var key = keys[i];
      if (result.status === 'fulfilled') save(key, result.value);
      else {
        state.sources[key] = {
          ok: false,
          fetchedAt: new Date().toISOString(),
          error: String(result.reason && result.reason.message || result.reason || 'Erreur inconnue')
        };
        state.errors.push({ source: key, error: state.sources[key].error });
      }
    });

    state.finishedAt = new Date().toISOString();
    state.lastSync = state.finishedAt;
    state.status = state.errors.length ? 'partial' : 'ready';
    emit('tc:backoffice-sync-complete', state);
    return state;
  }

  function get(source) {
    var item = state.sources[source];
    return item && item.ok ? item.data : null;
  }

  function freshness(source) {
    var item = state.sources[source];
    if (!item || !item.fetchedAt) return null;
    return Math.max(0, Date.now() - new Date(item.fetchedAt).getTime());
  }

  w.tcBackofficeSync = sync;
  w.tcBackofficeData = get;
  w.tcBackofficeFreshness = freshness;

  // Synchronisation après le premier rendu : elle ne bloque jamais l'ouverture.
  function start() { setTimeout(function () { sync(); }, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
