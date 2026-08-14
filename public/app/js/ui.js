// THE CAPITAL — UI / application data bootstrap
//
// This file must not use the old direct `sb()` client. The application data
// layer is exposed by fetch.js through /api/* and apiGet().
(function () {
  'use strict';

  if (window.__TC_UI_LOADED__) return;
  window.__TC_UI_LOADED__ = true;

  window.populateTickerSelects = function populateTickerSelects() {
    const byTicker = {};
    (window.allCours || []).forEach(function (c) {
      if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c;
    });
    const tickers = Object.keys(byTicker).sort();
    const opts = tickers.map(function (t) {
      return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>';
    }).join('');

    const pf = document.getElementById('pfTicker');
    if (pf) pf.innerHTML = '<option value="">Ticker...</option>' + opts;

    const al = document.getElementById('alertTicker');
    if (al) al.innerHTML = '<option value="">Ticker...</option>' + opts;

    const fu = document.getElementById('fundTickerSelect');
    if (fu) fu.innerHTML = '<option value="">Choisir un ticker...</option>' + opts;
  };

  function unwrap(payload) {
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload.data;
    }
    return payload;
  }

  async function loadAll() {
    if (typeof window.apiGet !== 'function') {
      throw new Error('Client API indisponible');
    }

    const requests = await Promise.allSettled([
      window.apiGet('/marche?type=cours'),
      window.apiGet('/marche?type=indices'),
      window.apiGet('/marche?type=entreprises'),
      window.apiGet('/marche?type=analyses'),
      window.apiGet('/marche?type=financials'),
      window.apiGet('/boc')
    ]);

    const read = function (index, fallback) {
      return requests[index].status === 'fulfilled' ? (unwrap(requests[index].value) || fallback) : fallback;
    };

    window.allCours = Array.isArray(read(0, [])) ? read(0, []) : [];
    window.allIndices = Array.isArray(read(1, [])) ? read(1, []) : [];
    window.allEntreprises = Array.isArray(read(2, [])) ? read(2, []) : [];
    window.allAnalyses = Array.isArray(read(3, [])) ? read(3, []) : [];
    window.allFinancials = Array.isArray(read(4, [])) ? read(4, []) : [];
    window.allBoc = Array.isArray(read(5, [])) ? read(5, []) : [];

    window.entMap = {};
    window.allEntreprises.forEach(function (e) {
      if (e && e.ticker) window.entMap[e.ticker] = e;
    });

    window.populateTickerSelects();

    const errors = requests.filter(function (r) { return r.status === 'rejected'; });
    if (errors.length) {
      console.warn('[UI] Certains jeux de données n’ont pas pu être chargés:', errors.length);
    }

    console.log('[UI] Données chargées:', {
      cours: window.allCours.length,
      indices: window.allIndices.length,
      entreprises: window.allEntreprises.length,
      analyses: window.allAnalyses.length,
      financials: window.allFinancials.length,
      boc: window.allBoc.length
    });

    window.dispatchEvent(new CustomEvent('tc:dataready', {
      detail: {
        cours: window.allCours.length,
        indices: window.allIndices.length,
        entreprises: window.allEntreprises.length
      }
    }));

    if (typeof window.nav === 'function') {
      const hash = window.location.hash || '';
      const map = {
        '#titres': 'titres',
        '#boc': 'boc',
        '#marche': 'marche',
        '#analyses': 'analyses',
        '#analyse-technique': 'analyse-technique',
        '#analyse-fondamentale': 'analyse-fondamentale',
        '#screener': 'screener',
        '#dividend-screener': 'dividend-screener',
        '#portefeuille': 'portefeuille',
        '#alertes': 'alertes',
        '#financials': 'financials',
        '#publications': 'publications',
        '#formation': 'formation'
      };
      window.nav(map[hash] || 'overview', true);
    } else if (typeof window.renderOverview === 'function') {
      window.renderOverview();
    }

    if (typeof window.initGlobalSearch === 'function') {
      try { window.initGlobalSearch(); } catch (e) { console.warn('[UI] recherche:', e); }
    }

    return {
      cours: window.allCours,
      indices: window.allIndices,
      entreprises: window.allEntreprises,
      analyses: window.allAnalyses,
      financials: window.allFinancials,
      boc: window.allBoc
    };
  }

  window.loadAll = loadAll;

  function bootData() {
    if (window.__TC_DATA_BOOTED__) return;
    window.__TC_DATA_BOOTED__ = true;
    loadAll().catch(function (error) {
      console.error('[UI] Erreur globale de chargement:', error);
      if (typeof window.toast === 'function') window.toast('Impossible de charger les données du marché', 'error');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootData, { once: true });
  } else {
    setTimeout(bootData, 0);
  }
})();
