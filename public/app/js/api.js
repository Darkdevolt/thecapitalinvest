// ═══════════════════════════════════════
// API — The Capital BRVM
// ═══════════════════════════════════════
(function() {
  if (window.__TC_API_LOADED__) {
    console.log('[API] Déjà chargé, skip.');
    return;
  }
  window.__TC_API_LOADED__ = true;

  // ═══════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════
  const API_BASE = '/api';
  const CACHE_PREFIX = 'tc_cache_';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ═══════════════════════════════════════
  // FETCH AVEC TIMEOUT + GESTION ERREURS
  // ═══════════════════════════════════════
  async function fetchAPI(endpoint, options) {
    options = options || {};
    const url = API_BASE + endpoint;
    const cacheKey = CACHE_PREFIX + endpoint;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(function() { controller.abort(); }, 15000);

      const res = await fetch(url, {
        method: options.method || 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: options.body ? options.body : undefined
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errBody = '';
        const contentType = res.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') !== -1) {
          try { errBody = JSON.stringify(await res.json()); } catch(e) {}
        } else {
          try { errBody = await res.text(); } catch(e) {}
        }

        console.error('[API] HTTP ' + res.status + ' sur ' + endpoint + ':', errBody.slice(0, 300));

        let userMsg = 'Erreur de connexion au serveur';
        if (res.status === 404) userMsg = 'Données non trouvées';
        if (res.status === 500) userMsg = 'Erreur serveur — réessayez plus tard';
        if (res.status === 503) userMsg = 'Service temporairement indisponible';
        if (res.status === 504) userMsg = 'Le serveur met trop de temps à répondre';

        const cached = getCache(cacheKey);
        if (cached) {
          console.log('[API] Fallback cache pour ' + endpoint);
          return cached.data;
        }
        throw new Error(userMsg);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.indexOf('application/json') === -1) {
        const text = await res.text();
        console.error('[API] Réponse non-JSON sur ' + endpoint + ':', text.slice(0, 200));
        throw new Error('Format de réponse invalide');
      }

      const data = await res.json();
      setCache(cacheKey, data);
      return data;

    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('[API] Timeout sur ' + endpoint);
        const cached = getCache(cacheKey);
        if (cached) return cached.data;
        throw new Error('Le serveur met trop de temps à répondre');
      }

      const cached = getCache(cacheKey);
      if (cached) {
        console.log('[API] Fallback cache (network error) pour ' + endpoint);
        return cached.data;
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════
  // CACHE HELPERS
  // ═══════════════════════════════════════
  function getCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return entry;
    } catch(e) { return null; }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {
      clearOldCaches();
      try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
      } catch(e2) {}
    }
  }

  function clearOldCaches() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
    }
    keys.sort(function(a, b) {
      var ta = 0, tb = 0;
      try { ta = JSON.parse(localStorage.getItem(a) || '{"ts":0}').ts; } catch(e) {}
      try { tb = JSON.parse(localStorage.getItem(b) || '{"ts":0}').ts; } catch(e) {}
      return ta - tb;
    });
    var toDelete = Math.floor(keys.length / 2);
    for (var i = 0; i < toDelete; i++) {
      localStorage.removeItem(keys[i]);
    }
  }

  // ═══════════════════════════════════════
  // API METHODS PUBLIQUES
  // ═══════════════════════════════════════
  window.apiGet = fetchAPI;

  window.apiGetCours = function() { return fetchAPI('/marche?type=cours'); };
  window.apiGetIndices = function() { return fetchAPI('/marche?type=indices'); };
  window.apiGetBOC = function() { return fetchAPI('/boc'); };
  window.apiGetFinancials = function() { return fetchAPI('/marche?type=financials'); };
  window.apiGetAnalyses = function() { return fetchAPI('/marche?type=analyses'); };
  window.apiGetEntreprises = function() { return fetchAPI('/marche?type=entreprises'); };

  console.log('[API] Chargé avec succès');

})();
