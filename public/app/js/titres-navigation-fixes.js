// THE CAPITAL — Titres BRVM / Fiche navigation + price consistency
(function () {
  'use strict';
  if (window.__TC_TITRES_NAV_FIXES__) return;
  window.__TC_TITRES_NAV_FIXES__ = true;

  var refreshPromise = null;
  var lastRefresh = 0;
  var REFRESH_TTL = 30000;

  function normalizePayload(payload) {
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
    return payload;
  }

  function normalizeCourse(row) {
    if (!row || typeof row !== 'object') return row;
    var close = row.cours_cloture ?? row.cloture ?? row.cours_normal ?? row.cours;
    if (close != null) {
      row.cours = close;
      row.cours_cloture = close;
      row.cours_normal = close;
      row.cloture = close;
    }
    if (row.variation_pct == null && row.variation != null) row.variation_pct = row.variation;
    return row;
  }

  async function refreshTitleCourses(force) {
    var now = Date.now();
    if (!force && now - lastRefresh < REFRESH_TTL) return window.allCours || [];
    if (refreshPromise) return refreshPromise;

    refreshPromise = window.apiGet('/marche?type=cours&_=' + Date.now())
      .then(function (payload) {
        var data = normalizePayload(payload);
        if (!Array.isArray(data)) return window.allCours || [];
        data = data.map(normalizeCourse).filter(function (r) { return r && r.ticker; });
        window.allCours = data;
        window.allCoursLatestDate = data.reduce(function (max, row) {
          var d = row && row.date_seance ? String(row.date_seance) : '';
          return !max || d > max ? d : max;
        }, null);
        lastRefresh = Date.now();
        return data;
      })
      .catch(function (err) {
        console.warn('[TITRES FIX] Actualisation des cours impossible:', err && err.message ? err.message : err);
        return window.allCours || [];
      })
      .finally(function () { refreshPromise = null; });

    return refreshPromise;
  }

  function findCourse(ticker) {
    var t = String(ticker || '').trim().toUpperCase();
    return (Array.isArray(window.allCours) ? window.allCours : []).find(function (r) {
      return String(r && r.ticker || '').trim().toUpperCase() === t;
    }) || null;
  }

  function injectNavigationStyle() {
    if (document.getElementById('tc-title-navigation-fix-css')) return;
    var style = document.createElement('style');
    style.id = 'tc-title-navigation-fix-css';
    style.textContent = '\n'
      + '.tc-title-backbar{display:flex;align-items:center;gap:10px;margin:0 0 18px;padding:8px 0 10px;border-bottom:1px solid var(--border2,rgba(184,150,78,.12));position:relative;z-index:20}\n'
      + '.tc-title-back{appearance:none;border:1px solid var(--border2,rgba(184,150,78,.18));background:rgba(184,150,78,.05);color:var(--cream,#f5f0e8);border-radius:6px;padding:7px 11px;font:500 11px var(--sans,Arial);letter-spacing:.03em;cursor:pointer}\n'
      + '.tc-title-back:hover{border-color:var(--gold,#b8964e);color:var(--gold,#b8964e);background:rgba(184,150,78,.09)}\n'
      + '.tc-title-backbar .tc-title-context{font:500 10px var(--mono,monospace);color:var(--dim,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
      + '#view-fiche .tc-title-backbar{margin-bottom:20px}\n';
    document.head.appendChild(style);
  }

  function installBackBar(view, label, target, ticker) {
    if (!view) return;
    injectNavigationStyle();
    var old = view.querySelector(':scope > .tc-title-backbar');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.className = 'tc-title-backbar';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tc-title-back';
    btn.textContent = '← Retour';
    btn.setAttribute('aria-label', 'Retour à ' + label);
    btn.addEventListener('click', function () {
      if (window.tcNavigation && typeof window.tcNavigation.navigate === 'function') {
        window.tcNavigation.navigate(target || 'titres', true);
      } else if (typeof window.nav === 'function') {
        window.nav(target || 'titres');
      }
    });
    var context = document.createElement('div');
    context.className = 'tc-title-context';
    context.textContent = label + (ticker ? ' / ' + ticker : '');
    bar.appendChild(btn);
    bar.appendChild(context);
    view.insertBefore(bar, view.firstChild);
  }

  function patchFicheBack() {
    var original = window.openFiche;
    if (typeof original !== 'function' || original.__tcWrapped) return;
    function wrappedOpenFiche(ticker, from, noHash) {
      var target = from || 'titres';
      var result = original.apply(this, arguments);
      Promise.resolve(result).then(function () {
        var view = document.getElementById('view-fiche');
        installBackBar(view, 'Titres BRVM', target, String(ticker || '').toUpperCase());
      });
      return result;
    }
    wrappedOpenFiche.__tcWrapped = true;
    window.openFiche = wrappedOpenFiche;
  }

  function patchRenderTitres() {
    var original = window.renderTitres;
    if (typeof original !== 'function' || original.__tcWrapped) return false;
    function wrappedRenderTitres() {
      var args = arguments;
      return refreshTitleCourses(false).then(function () {
        var result = original.apply(this, args);
        setTimeout(function () {
          var view = document.getElementById('view-titres');
          if (view && view.classList.contains('active')) installBackBar(view, 'Marché / Titres BRVM', 'overview');
        }, 0);
        return result;
      });
    }
    wrappedRenderTitres.__tcWrapped = true;
    window.renderTitres = wrappedRenderTitres;
    return true;
  }

  function normalizeVisibleRows() {
    if (!Array.isArray(window.allCours)) return;
    window.allCours.forEach(normalizeCourse);
    if (Array.isArray(window._titresRows)) {
      window._titresRows.forEach(function (row) {
        var fresh = findCourse(row && row.ticker);
        if (fresh) {
          Object.keys(fresh).forEach(function (key) { row[key] = fresh[key]; });
          normalizeCourse(row);
        }
      });
    }
  }

  function boot() {
    injectNavigationStyle();
    patchFicheBack();
    patchRenderTitres();
    refreshTitleCourses(true).then(function () {
      normalizeVisibleRows();
      if (document.getElementById('view-titres')?.classList.contains('active') && typeof window.renderTitres === 'function') {
        window.renderTitres();
      }
    });
  }

  function retryBoot() {
    patchFicheBack();
    patchRenderTitres();
    if (typeof window.openFiche !== 'function' || typeof window.renderTitres !== 'function') setTimeout(retryBoot, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); retryBoot(); }, { once: true });
  } else {
    boot();
    retryBoot();
  }

  window.addEventListener('hashchange', function () {
    setTimeout(function () {
      patchFicheBack();
      patchRenderTitres();
      var fiche = document.getElementById('view-fiche');
      var active = fiche && fiche.classList.contains('active');
      if (active) {
        var hash = String(location.hash || '');
        var match = hash.match(/^#fiche=([^&]+)/);
        installBackBar(fiche, 'Titres BRVM', 'titres', match ? decodeURIComponent(match[1]).toUpperCase() : '');
      }
    }, 40);
  });
})();
