// FETCH UTILITIES — The Capital API
(function() {
  if (window.__TC_FETCH_LOADED__) return;
  window.__TC_FETCH_LOADED__ = true;

  const API_BASE = '/api';
  const API_TIMEOUT = 15000;

  async function fetchAPI(endpoint, options) {
    options = options || {};
    const url = API_BASE + endpoint;
    const cacheKey = (window.cacheManager?.CACHE_PREFIX || 'tc_cache_') + endpoint;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

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
        if (res.status === 404) userMsg = 'Donnees non trouvees';
        if (res.status === 500) userMsg = 'Erreur serveur — reessayez plus tard';
        if (res.status === 503) userMsg = 'Service temporairement indisponible';
        if (res.status === 504) userMsg = 'Le serveur met trop de temps a repondre';

        const cached = window.cacheManager?.getCache(cacheKey);
        if (cached) {
          console.log('[API] Fallback cache pour ' + endpoint);
          return cached.data;
        }
        throw new Error(userMsg);
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) {
        const text = await res.text();
        console.error('[API] Reponse non-JSON sur ' + endpoint + ':', text.slice(0, 200));
        throw new Error('Format de reponse invalide');
      }

      const data = await res.json();
      if (window.cacheManager) window.cacheManager.setCache(cacheKey, data);
      return data;

    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('[API] Timeout sur ' + endpoint);
        const cached = window.cacheManager?.getCache(cacheKey);
        if (cached) return cached.data;
        throw new Error('Le serveur met trop de temps a repondre');
      }

      const cached = window.cacheManager?.getCache(cacheKey);
      if (cached) {
        console.log('[API] Fallback cache (network error) pour ' + endpoint);
        return cached.data;
      }
      throw err;
    }
  }

  window.apiGet = fetchAPI;
  window.apiGetCours = () => fetchAPI('/marche?type=cours');
  window.apiGetIndices = () => fetchAPI('/marche?type=indices');
  window.apiGetBOC = () => fetchAPI('/boc');
  window.apiGetFinancials = () => fetchAPI('/marche?type=financials');
  window.apiGetAnalyses = () => fetchAPI('/marche?type=analyses');
  window.apiGetEntreprises = () => fetchAPI('/marche?type=entreprises');

  console.log('[FETCH] Charge avec succes');
})();
