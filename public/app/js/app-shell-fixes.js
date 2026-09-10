// ============================================================================
// THE CAPITAL — Correctifs de coquille (app.html)
// Rend fonctionnels des éléments d'en-tête restés inertes :
//   · la recherche globale (input + liste de résultats) ;
//   · le bouton de déconnexion (data-action="logout") ;
//   · l'identité affichée (nom + avatar) à partir de la session.
// Aucune dépendance : lit window.allEntreprises / allCours / allAnalyses.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_SHELL_FIXES__) return;
  window.__TC_SHELL_FIXES__ = true;

  var ACC = { 'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a', 'ç': 'c', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'í': 'i', 'ô': 'o', 'ö': 'o', 'ó': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u', 'ñ': 'n' };
  function strip(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[àâäáçéèêëîïíôöóùûüúñ]/g, function (c) { return ACC[c] || c; });
  }
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

  // ─────────────────────────────── Session / identité
  function readSession() {
    try {
      var raw = localStorage.getItem('tc_session');
      if (!raw) return null;
      var p = JSON.parse(raw);
      return (p && p.data && p.data.session) || (p && p.session) || p || null;
    } catch (e) { return null; }
  }
  function jwtPayload(tok) {
    try {
      var b = String(tok).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return JSON.parse(atob(b));
    } catch (e) { return null; }
  }
  function paintIdentity() {
    var s = readSession();
    var pl = s && s.access_token ? jwtPayload(s.access_token) : null;
    var email = (pl && (pl.email || (pl.user_metadata && pl.user_metadata.email))) || (s && s.user && s.user.email) || '';
    var name = (pl && pl.user_metadata && (pl.user_metadata.name || pl.user_metadata.full_name)) || '';
    var label = name || (email ? email.split('@')[0] : '');
    var nEl = document.getElementById('headerName');
    var aEl = document.getElementById('headerAvatar');
    if (nEl && label) nEl.textContent = label;
    if (aEl) {
      var ini = (label || 'TC').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
      if (ini) aEl.textContent = ini;
    }
  }

  // ─────────────────────────────── Déconnexion
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-action="logout"]');
    if (!b) return;
    e.preventDefault();
    if (!window.confirm('Se déconnecter ?')) return;
    try { localStorage.removeItem('tc_session'); } catch (x) {}
    try { sessionStorage.removeItem('tc_session'); } catch (x) {}
    try { if (window.TC_ENV && typeof window.TC_ENV.clearSession === 'function') window.TC_ENV.clearSession(); } catch (x) {}
    window.location.replace('/login.html');
  }, true);

  // ─────────────────────────────── Recherche globale
  function results() { return document.getElementById('globalSearchResults'); }
  function closeResults() { var r = results(); if (r) { r.classList.remove('open'); r.innerHTML = ''; } }

  function search(q) {
    var qn = strip(q).trim();
    if (qn.length < 1) return [];
    var out = [];
    var ents = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
    var seen = {};
    ents.forEach(function (e) {
      if (!e || !e.ticker) return;
      var t = String(e.ticker).toUpperCase();
      var nom = e.nom || e.nom_court || e.raison_sociale || '';
      var hay = strip(t + ' ' + nom + ' ' + (e.secteur || ''));
      if (hay.indexOf(qn) === -1) return;
      var rank = strip(t) === qn ? 0 : strip(t).indexOf(qn) === 0 ? 1 : 2;
      seen[t] = 1;
      out.push({ type: 'valeur', ticker: t, nom: nom, secteur: e.secteur || '', rank: rank });
    });
    // valeurs cotées sans fiche entreprise
    (Array.isArray(window.allCours) ? window.allCours : []).forEach(function (c) {
      if (!c || !c.ticker) return;
      var t = String(c.ticker).toUpperCase();
      if (seen[t] || strip(t).indexOf(qn) === -1) return;
      seen[t] = 1;
      out.push({ type: 'valeur', ticker: t, nom: '', secteur: '', rank: strip(t) === qn ? 0 : 1 });
    });
    (Array.isArray(window.allAnalyses) ? window.allAnalyses : []).forEach(function (a) {
      if (!a || !a.ticker) return;
      var hay = strip((a.ticker || '') + ' ' + (a.recommandation || '') + ' ' + (a.analyste || ''));
      if (hay.indexOf(qn) === -1) return;
      out.push({ type: 'analyse', ticker: String(a.ticker).toUpperCase(), label: a.recommandation || 'Analyse', id: a.id, rank: 3 });
    });
    out.sort(function (x, y) { return x.rank - y.rank; });
    return out.slice(0, 8);
  }

  function render(list) {
    var r = results();
    if (!r) return;
    if (!list.length) { r.innerHTML = '<div class="gsr-empty" style="padding:12px 14px;color:var(--dim,rgba(245,240,232,.34));font-size:13px">Aucun résultat</div>'; r.classList.add('open'); return; }
    r.innerHTML = list.map(function (it, i) {
      if (it.type === 'valeur') {
        return '<div class="gsr-item" role="option" data-i="' + i + '" data-kind="valeur" data-ticker="' + esc(it.ticker) + '" '
          + 'style="padding:9px 14px;cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:center">'
          + '<span><b style="font-family:var(--mono,monospace);color:var(--gold,#B8964E)">' + esc(it.ticker) + '</b>'
          + (it.nom ? ' <span style="color:var(--muted,rgba(245,240,232,.6))">' + esc(String(it.nom).slice(0, 40)) + '</span>' : '') + '</span>'
          + (it.secteur ? '<span style="font-size:11px;color:var(--dim,rgba(245,240,232,.34))">' + esc(it.secteur) + '</span>' : '')
          + '</div>';
      }
      return '<div class="gsr-item" role="option" data-i="' + i + '" data-kind="analyse" data-ticker="' + esc(it.ticker) + '" data-id="' + esc(it.id || '') + '" '
        + 'style="padding:9px 14px;cursor:pointer;display:flex;justify-content:space-between;gap:10px">'
        + '<span><b style="font-family:var(--mono,monospace);color:var(--gold,#B8964E)">' + esc(it.ticker) + '</b> <span style="color:var(--muted,rgba(245,240,232,.6))">Recommandation</span></span>'
        + '<span style="font-size:11px;color:var(--dim,rgba(245,240,232,.34))">' + esc(it.label) + '</span></div>';
    }).join('');
    r.classList.add('open');
    r.querySelectorAll('.gsr-item').forEach(function (el) {
      el.addEventListener('mousedown', function (ev) { ev.preventDefault(); go(el); });
    });
  }

  function go(el) {
    var kind = el.getAttribute('data-kind');
    var ticker = el.getAttribute('data-ticker');
    var inp = document.getElementById('globalSearchInput');
    if (inp) inp.value = '';
    closeResults();
    if (kind === 'valeur') {
      if (typeof window.openFiche === 'function') { try { window.openFiche(ticker, 'overview'); return; } catch (e) {} }
      location.hash = '#fiche=' + encodeURIComponent(ticker);
    } else {
      var id = el.getAttribute('data-id');
      if (id && typeof window.openAnalyseDetail === 'function') { try { window.openAnalyseDetail(Number(id), true); return; } catch (e) {} }
      if (typeof window.nav === 'function') window.nav('analyses'); else location.hash = '#analyses';
    }
  }

  var timer = 0, active = -1;
  function wire() {
    var inp = document.getElementById('globalSearchInput');
    var r = results();
    if (!inp || !r || inp.dataset.tcWired === '1') return;
    inp.dataset.tcWired = '1';
    inp.addEventListener('input', function () {
      clearTimeout(timer);
      var q = inp.value;
      timer = setTimeout(function () { active = -1; if (String(q).trim().length < 1) { closeResults(); return; } render(search(q)); }, 120);
    });
    inp.addEventListener('keydown', function (e) {
      var items = r.querySelectorAll('.gsr-item');
      if (e.key === 'Escape') { closeResults(); inp.blur(); return; }
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(items[Math.max(0, active)]); return; }
      else return;
      items.forEach(function (x, i) { x.style.background = i === active ? 'rgba(184,150,78,.14)' : ''; });
    });
    inp.addEventListener('blur', function () { setTimeout(closeResults, 150); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest || (!e.target.closest('#tcSearch') && !e.target.closest('#globalSearchResults'))) closeResults();
    });
  }

  function boot() { wire(); paintIdentity(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('tc:dataready', function () { /* données arrivées : la recherche a du contenu */ });
  window.addEventListener('auth:changed', paintIdentity);
  setTimeout(boot, 1200);
})();
