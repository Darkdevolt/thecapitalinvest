// ============================================================================
// MARKET MAP BRVM  (outil roadmap — pilier « aller plus loin »)
// Carte de la cote : chaque tuile = une valeur, surface ∝ capitalisation,
// couleur = variation du jour. Bloc greffé sur le tableau de bord.
// Sources : allCours · allEntreprises. Clic → fiche.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_MARKET_MAP__) return;
  window.__TC_MARKET_MAP__ = true;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

  function color(v) {
    var n = Number(v);
    if (!isFinite(n) || n === 0) return 'rgba(255,255,255,.06)';
    var t = Math.min(Math.abs(n) / 4, 1); // sature à ±4 %
    return n > 0
      ? 'rgba(74,222,128,' + (0.12 + t * 0.45).toFixed(3) + ')'
      : 'rgba(248,113,113,' + (0.12 + t * 0.45).toFixed(3) + ')';
  }

  function injectCss() {
    if (document.getElementById('tc-mmap-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-mmap-css';
    s.textContent = [
      '#view-overview .mmap-card{background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.22);overflow:hidden;margin-top:20px}',
      '#view-overview .mmap-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 20px;background:rgba(184,150,78,.04);border-bottom:1px solid var(--border2)}',
      '#view-overview .mmap-head .t{font:600 10px var(--sans);letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}',
      '#view-overview .mmap-head .lg{display:flex;gap:12px;font:400 10px var(--sans);color:var(--dim)}',
      '#view-overview .mmap-head .lg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:middle}',
      '#view-overview .mmap{display:flex;flex-wrap:wrap;gap:2px;padding:12px}',
      '#view-overview .mmap-t{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px;border-radius:4px;padding:6px 4px;cursor:pointer;min-width:54px;overflow:hidden;transition:outline .12s}',
      '#view-overview .mmap-t:hover{outline:2px solid var(--gold)}',
      '#view-overview .mmap-t b{font:600 11px var(--mono);color:var(--cream);line-height:1}',
      '#view-overview .mmap-t span{font:500 9px var(--mono);color:rgba(245,240,232,.75);line-height:1}',
      '#view-overview .mmap-empty{padding:24px;text-align:center;color:var(--dim);font-size:12px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function build() {
    var host = document.getElementById('view-overview');
    if (!host) return;
    var box = document.getElementById('tcMarketMap');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tcMarketMap';
      box.className = 'mmap-card';
      host.appendChild(box);
    }
    var ent = (window.entMap && typeof window.entMap === 'object') ? window.entMap : {};
    var seen = {};
    var rows = (Array.isArray(window.allCours) ? window.allCours : []).filter(function (c) {
      if (!c || !c.ticker) return false;
      var t = String(c.ticker).toUpperCase();
      if (seen[t]) return false; seen[t] = 1; return true;
    }).map(function (c) {
      var t = String(c.ticker).toUpperCase();
      var e = ent[t] || {};
      var cp = Number(c.cloture != null ? c.cloture : c.cours);
      var na = Number(e.nombre_actions || e.nb_actions);
      var capi = Number(c.capitalisation) || (isFinite(cp) && isFinite(na) ? cp * na : 0);
      return { t: t, capi: capi || 1, v: Number(c.variation_pct != null ? c.variation_pct : c.variation) };
    }).sort(function (a, b) { return b.capi - a.capi; });

    if (!rows.length) { box.innerHTML = '<div class="mmap-empty">Cote indisponible.</div>'; return; }

    var max = rows[0].capi || 1;
    box.innerHTML =
      '<div class="mmap-head"><span class="t">Market Map · ' + rows.length + ' valeurs</span>'
      + '<span class="lg"><span><i style="background:rgba(74,222,128,.5)"></i>hausse</span>'
      + '<span><i style="background:rgba(248,113,113,.5)"></i>baisse</span>'
      + '<span>surface ∝ capitalisation</span></span></div>'
      + '<div class="mmap">'
      + rows.map(function (r) {
        var scale = Math.sqrt(r.capi / max);           // aire ∝ capi
        var w = Math.max(54, Math.round(scale * 190));
        var h = Math.max(40, Math.round(scale * 120));
        var vtxt = isFinite(r.v) ? (r.v > 0 ? '+' : '') + r.v.toFixed(1) + '%' : '—';
        return '<div class="mmap-t" style="width:' + w + 'px;height:' + h + 'px;background:' + color(r.v) + '"'
          + ' title="' + esc(r.t) + ' · ' + vtxt + '" onclick="openFiche && openFiche(\'' + esc(r.t) + '\',\'overview\')">'
          + '<b>' + esc(r.t) + '</b><span>' + vtxt + '</span></div>';
      }).join('')
      + '</div>';
  }

  function hook() {
    if (typeof window.renderOverview !== 'function') return false;
    if (window.renderOverview.__mmapWrapped) return true;
    var orig = window.renderOverview;
    var wrapped = function () {
      var res = orig.apply(this, arguments);
      Promise.resolve().then(build).catch(function () {});
      return res;
    };
    wrapped.__mmapWrapped = true;
    window.renderOverview = wrapped;
    return true;
  }

  injectCss();
  if (!hook()) {
    var n = 0, iv = setInterval(function () { if (hook() || ++n > 40) clearInterval(iv); }, 150);
  }
  window.addEventListener('tc:dataready', function () {
    if (document.querySelector('#view-overview.active') || (document.getElementById('view-overview') || {}).classList && document.getElementById('view-overview').classList.contains('active')) {
      Promise.resolve().then(build);
    }
  });
})();
