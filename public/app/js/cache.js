// CACHE MANAGEMENT — The Capital API
(function() {
  if (window.__TC_CACHE_LOADED__) return;
  window.__TC_CACHE_LOADED__ = true;

  const CACHE_PREFIX = 'tc_cache_';
  const CACHE_TTL = 5 * 60 * 1000;

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
    keys.sort((a, b) => {
      let ta = 0, tb = 0;
      try { ta = JSON.parse(localStorage.getItem(a) || '{"ts":0}').ts; } catch(e) {}
      try { tb = JSON.parse(localStorage.getItem(b) || '{"ts":0}').ts; } catch(e) {}
      return ta - tb;
    });
    const toDelete = Math.floor(keys.length / 2);
    for (let i = 0; i < toDelete; i++) {
      localStorage.removeItem(keys[i]);
    }
  }

  window.cacheManager = { getCache, setCache, CACHE_PREFIX };
  console.log('[CACHE] Charge avec succes');
})();
