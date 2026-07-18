// ═══════════════════════════════════════
// API — The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern: empêche le double chargement
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
  // FETCH AVEC GESTION D'ERREUR COMPLÈTE
  // ═══════════════════════════════════════
  async function fetchAPI(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const cacheKey = CACHE_PREFIX + endpoint;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);

      // Gérer les erreurs HTTP
      if (!res.ok) {
        let errBody = '';
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            errBody = JSON.stringify(json);
          } else {
            errBody = await res.text();
          }
        } catch(e) {}

        // Log détaillé pour debug
        console.error(`[API] HTTP ${res.status} sur ${endpoint}:`, errBody.slice(0, 500));

        // Message utilisateur selon le code
        let userMsg = 'Erreur de connexion au serveur';
        if (res.status === 404) userMsg = 'Données non trouvées';
        if (res.status === 500) userMsg = 'Erreur serveur — réessayez plus tard';
        if (res.status === 503) userMsg = 'Service temporairement indisponible';

        // Essayer cache
        const cached = getCache(cacheKey);
        if (cached) {
          console.log(`[API] Fallback cache pour ${endpoint}`);
          return cached.data;
        }

        throw new Error(userMsg);
      }

      // Vérifier que c'est bien du JSON
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`[API] Réponse non-JSON sur ${endpoint}:`, text.slice(0, 200));
        throw new Error('Format de réponse invalide');
      }

      const data = await res.json();

      // Sauvegarder en cache
      setCache(cacheKey, data);

      return data;

    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`[API] Timeout sur ${endpoint}`);
        const cached = getCache(cacheKey);
        if (cached) return cached.data;
        throw new Error('Le serveur met trop de temps à répondre');
      }

      // Network error — essayer cache
      const cached = getCache(cacheKey);
      if (cached) {
        console.log(`[API] Fallback cache (network error) pour ${endpoint}`);
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
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch(e) {
      // Si quota dépassé, nettoyer les anciens caches
      clearOldCaches();
      try {
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
      } catch(e2) {}
    }
  }

  function clearOldCaches() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.sort((a, b) => {
      const ta = safeJSON(localStorage.getItem(a), { ts: 0 }).ts;
      const tb = safeJSON(localStorage.getItem(b), { ts: 0 }).ts;
      return ta - tb;
    });
    // Supprimer les 50% les plus anciens
    keys.slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k));
  }

  // ═══════════════════════════════════════
  // API METHODS PUBLIQUES
  // ═══════════════════════════════════════
  window.apiGet = fetchAPI;

  window.apiGetCours = () => fetchAPI('/marche?type=cours');
  window.apiGetIndices = () => fetchAPI('/marche?type=indices');
  window.apiGetBOC = () => fetchAPI('/boc');
  window.apiGetFinancials = () => fetchAPI('/marche?type=financials');
  window.apiGetAnalyses = () => fetchAPI('/marche?type=analyses');
  window.apiGetEntreprises = () => fetchAPI('/marche?type=entreprises');

  // ═══════════════════════════════════════
  // SUPABASE PROXY (côté serveur uniquement)
  // ═══════════════════════════════════════
  // Tous les appels Supabase passent par l'API pour sécuriser la clé
  window.supabaseProxy = {
    from: (table) => ({
      select: async (cols = '*') => {
        return fetchAPI(`/supabase/${table}?select=${encodeURIComponent(cols)}`);
      },
      insert: async (data) => {
        return fetchAPI(`/supabase/${table}`, { method: 'POST', body: JSON.stringify(data) });
      }
    })
  };

  console.log('[API] Chargé avec succès');

})();
