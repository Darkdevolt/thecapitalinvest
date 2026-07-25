# 🏗️ Architecture Modulaire — The Capital BRVM

## Diagramme de Dépendances

```
┌─────────────────────────────────────┐
│      Application Initialization     │
│         init.js (85 lignes)         │
└────────────────┬────────────────────┘
                 │ (auto-exec)
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
    ┌─────────────────────────────┐
    │   Data Loading Layer        │
    │   loader.js (80 lignes)     │
    │   ↓ (depends on)            │
    └────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
  ┌──────────────┐  ┌──────────────┐
  │  API Layer   │  │ Cache Layer  │
  │ fetch.js     │  │ cache.js     │
  │ (95 lignes)  │  │ (90 lignes)  │
  └──────────────┘  └──────────────┘
        ▲
        │ (used by)
        ├──────────────────────────┐
        │                          │
        ▼                          ▼
  ┌──────────────┐  ┌──────────────┐
  │ UI Utilities │  │Page Modules  │
  │table-sort.js │  │  markets.js  │
  │(45 lignes)   │  │screener.js   │
  └──────────────┘  │  alerts.js   │
                    │(180 lignes)  │
                    └──────────────┘
```

## Module Details

### 🔐 Cache Layer (`cache.js`)
**Responsabilité** : Gérer le stockage localStorage avec TTL

```javascript
// Pattern : IIFE pour encapsulation
(function() {
  const CACHE_PREFIX = 'tc_cache_';
  const CACHE_TTL = 5 * 60 * 1000; // 5 min
  
  window.cacheManager = {
    getCache(key) { ... },
    setCache(key, data) { ... }
  };
})();
```

**Exportés** :
- `window.cacheManager.getCache(key)`
- `window.cacheManager.setCache(key, data)`
- `window.cacheManager.CACHE_PREFIX`

---

### 🔗 API Layer (`fetch.js`)
**Responsabilité** : Abstraire fetch() avec gestion erreurs, cache fallback, timeouts

```javascript
// Dépend de cache.js pour le fallback
window.apiGet = async (endpoint, options) => {
  // 1. Fetch avec timeout
  // 2. Gestion erreurs HTTP
  // 3. Cache result
  // 4. Fallback cache on error
};
```

**Exportés** :
- `window.apiGet(endpoint, options)`
- `window.apiGetCours()` — wrapper spécifique
- `window.apiGetIndices()` — wrapper spécifique
- etc.

---

### 📊 Data Loading (`loader.js`)
**Responsabilité** : Orchestrer le chargement de toutes les données

```javascript
// Dépend de apiGet() pour charger
window.loadAll = async () => {
  const [cours, indices, boc, ...] = 
    await Promise.allSettled([...]);
  
  // Populate global state
  window.allCours = cours.value;
  window.allIndices = indices.value;
  // ...
};
```

**Exportés** :
- `window.loadAll()` — fonction
- `window.allCours` — données
- `window.allIndices`
- `window.entMap` — ticker → entreprise

---

### 🎨 UI Utilities (`table-sort.js`)
**Responsabilité** : Utilitaires UI réutilisables

```javascript
window.sortTable = (tbodyId, colIndex) => {
  // 1. Parse cells (number or string)
  // 2. Sort array
  // 3. Re-append rows in order
};
```

**Exportés** :
- `window.sortTable(tbodyId, colIndex)`
- `window._sortState` — track sort direction

---

### 📈 Markets Module (`markets.js`)
**Responsabilité** : Afficher les marchés et cours BRVM

```javascript
window.marketsModule = {
  loadData() { ... },   // Load indices + cours
  filterCours() { ... } // Filter/sort tableau
};
```

**Dépend de** : fetch.js (apiGet)
**Utilisé par** : markets.html

---

### 🔍 Screener Module (`screener.js`)
**Responsabilité** : Filtrer les titres selon critères financiers

```javascript
window.runScreener = async () => {
  // 1. Load cours + financials
  // 2. Apply filters
  // 3. Calculate quality score
  // 4. Render results
};
```

**Dépend de** : sbQuery (Supabase, external)
**Exportés** :
- `window.runScreener()`
- `window.resetFilters()`
- `window.exportResults()`

---

### 🚨 Alerts Module (`alerts.js`)
**Responsabilité** : Gérer les alertes de prix

```javascript
window.createAlert() { ... }
window.renderAlerts() { ... }
window.deleteAlert(id) { ... }
window.loadAlertsData() { ... }
```

**Stockage** : localStorage (`tc_alerts`, `tc_alert_history`)
**Utilisé par** : alertes.html

---

### 🚀 Initialization (`init.js`)
**Responsabilité** : Bootstrap l'application

```javascript
// Auto-exec IIFE :
// 1. Attend DOMContentLoaded
// 2. Setup toast container
// 3. Call window.loadAll()
// 4. Setup global event listeners
// 5. Navigate to initial view
```

**Dépend de** : loader.js
**Exécution** : Auto à chargement page

---

## Script Loading Order

**Obligatoire** (ordre strict) :
```html
1. cache.js      <!-- Setup cache manager -->
2. fetch.js      <!-- Depends on cache -->
3. loader.js     <!-- Depends on fetch -->
4. table-sort.js <!-- Independent -->
5. markets.js    <!-- Depends on fetch -->
6. screener.js   <!-- Depends on sbQuery -->
7. alerts.js     <!-- Independent -->
8. init.js       <!-- Depends on loader + all modules -->
```

**Pourquoi cet ordre?**
- `cache.js` doit être avant `fetch.js` (le fetch a besoin du cache)
- `fetch.js` doit être avant `loader.js` (loader appelle apiGet)
- `init.js` doit être dernier (auto-exécute tout)

---

## Error Handling

### Scenario 1: API échoue
```javascript
fetch() → error
  ↓
Check cache
  ↓
Return cached data (si disponible)
  ↓ (ou)
Throw error user-friendly
```

### Scenario 2: Cache plein
```javascript
localStorage.setItem() → QuotaExceededError
  ↓
clearOldCaches() (delete oldest 50%)
  ↓
Retry setItem()
```

### Scenario 3: Page spécifique ne charge pas
```javascript
// markets.html
<script src="js/markets.js"></script>
<script>
  if(window.marketsModule?.loadData) {
    window.marketsModule.loadData();
  } else {
    console.error('Markets module not loaded');
  }
</script>
```

---

## Testing Strategy

### Unit Tests (par module)
```javascript
// Test cache.js
describe('cacheManager', () => {
  it('should store and retrieve data', () => {
    window.cacheManager.setCache('test', {data: 123});
    expect(window.cacheManager.getCache('test').data).toBe(123);
  });
});

// Test screener.js
describe('runScreener', () => {
  it('should filter by PER < 15', async () => {
    await window.runScreener();
    // Check DOM results
  });
});
```

### Integration Tests
```javascript
// Full app flow
describe('App initialization', () => {
  it('should load data and render', async () => {
    await window.loadAll();
    expect(window.allCours.length).toBeGreaterThan(0);
  });
});
```

---

## Performance Metrics

**Avant refactorisation** :
- api.js : 140 lignes
- ui.js : 90 lignes
- main.js : 140 lignes
- Scripts inline : 3 pages × ~100 lignes

**Après refactorisation** :
- cache.js : 90 lignes ✓
- fetch.js : 95 lignes ✓
- loader.js : 80 lignes ✓
- init.js : 85 lignes ✓
- table-sort.js : 45 lignes ✓
- markets.js : 115 lignes ✓
- screener.js : 180 lignes ✓
- alerts.js : 140 lignes ✓

**Gains** :
- Taille moyenne/fichier : 180 → 95 (-47%)
- Code réutilisable : 0 → 8 modules (+800%)
- Scripts inline : 3 pages → 0 (-100%)

---

## Future Improvements

1. **TypeScript** : Typer chaque module
2. **ES6 Modules** : Remplacer IIFE par import/export
3. **Bundler** : Webpack/Vite pour minifier
4. **Testing** : Ajouter Jest + tests unitaires
5. **Observability** : Logging + monitoring
6. **State Management** : Migrer vers MobX/Zustand

---

**Architecture Document** | Version 1.0 | 2026-07-25
