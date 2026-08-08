// API — The Capital BRVM
(function() {
  if (window.__TC_API_LOADED__) {
    console.log("[API] Deja charge, skip.");
    return;
  }
  window.__TC_API_LOADED__ = true;

  const API_BASE = "/api";
  const CACHE_PREFIX = "tc_cache_";
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchAPI(endpoint, options) {
    options = options || {};

    // BOC has a dedicated server-side adapter that reads the official BRVM source
    // when the local database is empty. Keep compatibility with the legacy
    // /api/index?path=boc call used by older views.
    var normalizedEndpoint = endpoint;
    if (endpoint === "/api/index?path=boc" || endpoint === "/index?path=boc") {
      normalizedEndpoint = "/boc";
    }

    var url = API_BASE + normalizedEndpoint;
    var cacheKey = CACHE_PREFIX + normalizedEndpoint;

    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 15000);

      var res = await fetch(url, {
        method: options.method || "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        body: options.body ? options.body : undefined
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        var errBody = "";
        var contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
          try { errBody = JSON.stringify(await res.json()); } catch(e) {}
        } else {
          try { errBody = await res.text(); } catch(e) {}
        }

        console.error("[API] HTTP " + res.status + " sur " + endpoint + ":", errBody.slice(0, 300));

        var userMsg = "Erreur de connexion au serveur";
        if (res.status === 404) userMsg = "Donnees non trouvees";
        if (res.status === 500) userMsg = "Erreur serveur — reessayez plus tard";
        if (res.status === 503) userMsg = "Service temporairement indisponible";
        if (res.status === 504) userMsg = "Le serveur met trop de temps a repondre";

        var cached = getCache(cacheKey);
        if (cached) {
          console.log("[API] Fallback cache pour " + endpoint);
          return cached.data;
        }
        throw new Error(userMsg);
      }

      var ct = res.headers.get("content-type") || "";
      if (ct.indexOf("application/json") === -1) {
        var text = await res.text();
        console.error("[API] Reponse non-JSON sur " + endpoint + ":", text.slice(0, 200));
        throw new Error("Format de reponse invalide");
      }

      var data = await res.json();
      setCache(cacheKey, data);
      return data;

    } catch (err) {
      if (err.name === "AbortError") {
        console.error("[API] Timeout sur " + endpoint);
        var cached = getCache(cacheKey);
        if (cached) return cached.data;
        throw new Error("Le serveur met trop de temps a repondre");
      }

      var cached = getCache(cacheKey);
      if (cached) {
        console.log("[API] Fallback cache (network error) pour " + endpoint);
        return cached.data;
      }
      throw err;
    }
  }

  function getCache(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
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
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
    }
    keys.sort(function(a, b) {
      var ta = 0, tb = 0;
      try { ta = JSON.parse(localStorage.getItem(a) || "{\"ts\":0}").ts; } catch(e) {}
      try { tb = JSON.parse(localStorage.getItem(b) || "{\"ts\":0}").ts; } catch(e) {}
      return ta - tb;
    });
    var toDelete = Math.floor(keys.length / 2);
    for (var i = 0; i < toDelete; i++) {
      localStorage.removeItem(keys[i]);
    }
  }

  window.apiGet = fetchAPI;

  window.apiGetCours = function() { return fetchAPI("/marche?type=cours"); };
  window.apiGetIndices = function() { return fetchAPI("/marche?type=indices"); };
  window.apiGetBOC = function() { return fetchAPI("/boc"); };
  window.apiGetFinancials = function() { return fetchAPI("/marche?type=financials"); };
  window.apiGetAnalyses = function() { return fetchAPI("/marche?type=analyses"); };
  window.apiGetEntreprises = function() { return fetchAPI("/marche?type=entreprises"); };

  console.log("[API] Charge avec succes");
})();
