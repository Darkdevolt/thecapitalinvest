// ═══════════════════════════════════════
// STATE, The Capital BRVM
// ═══════════════════════════════════════
// Source unique de vérité pour l'état public de l'application.
// Les anciennes propriétés window.* restent disponibles pour compatibilité,
// mais leurs écritures passent désormais par tcStore.
(function(){
  'use strict';
  if(window.__TC_STATE_LOADED__) { console.log('[STATE] Déjà chargé, skip.'); return; }
  window.__TC_STATE_LOADED__ = true;

  const initialState = {
    allCours: [], allCoursHistory: [], allBoc: [], allAnalyses: [],
    allFinancials: [], allEntreprises: [], entMap: {},
    allIndices: [], allIndicesHistory: [], allIndicesLatest: [],
    allDividendes: [], allCoupons: [], ficheHistorique: [],
    ficheChartPeriod: 30, ficheChartInst: null, compositeChartInst: null,
    techChartInst: null, techVolInst: null, prevView: 'titres',
    _titreFilter: 'all', _bocFilter: 'all', _analyseFilter: 'all',
    _pubFilter: 'all', _sortState: {}, _fundMethod: 'tcam'
  };

  const stateKeys = Object.keys(initialState);
  const listeners = new Map();
  const store = new Proxy(initialState, {
    set(target, prop, value){
      const previous = target[prop];
      target[prop] = value;
      if(previous !== value){
        window.dispatchEvent(new CustomEvent('tc:state-change', {
          detail: { key: String(prop), value, previous }
        }));
        const callbacks = listeners.get(prop);
        if(callbacks) callbacks.forEach(fn => {
          try { fn(value, previous); } catch(err) { console.error('[STATE] Listener:', err); }
        });
      }
      return true;
    },
    deleteProperty(target, prop){
      const previous = target[prop];
      delete target[prop];
      window.dispatchEvent(new CustomEvent('tc:state-change', {
        detail: { key: String(prop), value: undefined, previous }
      }));
      return true;
    }
  });

  // Non-enumerable API : elle ne devient jamais une propriété window.*.
  Object.defineProperties(store, {
    get: { value: key => store[key] },
    set: { value: (key, value) => { store[key] = value; return value; } },
    subscribe: { value: function(key, callback){
      if(typeof callback !== 'function') return function(){};
      if(!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(callback);
      return function(){ listeners.get(key)?.delete(callback); };
    }},
    snapshot: { value: () => JSON.parse(JSON.stringify(store)) }
  });
  window.tcStore = store;

  // Compatibilité transparente : toute écriture window.* est synchronisée.
  stateKeys.forEach(function(key){
    try {
      Object.defineProperty(window, key, {
        configurable: true, enumerable: true,
        get: function(){ return store[key]; },
        set: function(value){ store[key] = value; }
      });
    } catch(err) { console.warn('[STATE] Proxy impossible pour '+key+':', err); }
  });

  window.destroyChart = function(chartVar){
    if(chartVar && typeof chartVar.destroy === 'function') chartVar.destroy();
    return null;
  };
  window.destroyAllCharts = function(){
    window.ficheChartInst = window.destroyChart(window.ficheChartInst);
    window.compositeChartInst = window.destroyChart(window.compositeChartInst);
    window.techChartInst = window.destroyChart(window.techChartInst);
    window.techVolInst = window.destroyChart(window.techVolInst);
  };
  console.log('[STATE] Store centralisé chargé avec compatibilité window.*');
})();
