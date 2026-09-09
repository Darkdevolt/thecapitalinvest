// ============================================================================
// SUIVI & ALERTES v2  (P1 roadmap) — watchlist + alertes de prix unifiées
// Depuis une valeur suivie on pose une alerte en un clic. Source de vérité :
// Supabase via /api/user-data (glue window.* de user-data-patch.js).
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_ALERTES_V2__) return;
  window.__TC_ALERTES_V2__ = true;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function nf(v) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—'; }
  function nom(t) { return (window.entMap && window.entMap[t] && window.entMap[t].nom) || t; }
  function coursOf(t) {
    var c = (Array.isArray(window.allCours) ? window.allCours : []).find(function (x) { return x && String(x.ticker).toUpperCase() === t; });
    if (!c) return { cp: null, v: null };
    return { cp: Number(c.cloture != null ? c.cloture : c.cours), v: Number(c.variation_pct != null ? c.variation_pct : c.variation) };
  }
  function getWL() { return typeof window.getWatchlist === 'function' ? (window.getWatchlist() || []) : (window.__TC_WATCHLIST__ || []); }
  function getAL() { return typeof window.getAlerts === 'function' ? (window.getAlerts() || []) : []; }

  async function reload() {
    try {
      if (typeof window.loadWatchlistFromServer === 'function') await window.loadWatchlistFromServer();
      if (typeof window.loadAlertsFromServer === 'function') await window.loadAlertsFromServer();
    } catch (e) {}
    draw();
  }

  async function apiAlert(method, body, id) {
    var ep = '/user-data?mode=alerts' + (id ? '&id=' + encodeURIComponent(id) : '');
    if (method === 'POST') return window.apiPost(ep, body);
    if (method === 'PUT') return window.apiPut(ep, body);
    if (method === 'DELETE') return window.apiDelete(ep);
  }

  function injectCss() {
    if (document.getElementById('tc-alr-v2-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-alr-v2-css';
    s.textContent = [
      '#view-alertes{padding:24px clamp(14px,3vw,32px) 56px;max-width:1080px;margin-inline:auto}',
      '#view-alertes .alr-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}',
      '#view-alertes .card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}',
      '#view-alertes .card-h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;background:rgba(184,150,78,.04);border-bottom:1px solid var(--border2)}',
      '#view-alertes .card-h .t{font:600 10px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}',
      '#view-alertes .card-b{padding:8px 12px 14px}',
      '#view-alertes .row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 6px;border-bottom:1px solid var(--border2)}',
      '#view-alertes .row:last-child{border-bottom:0}',
      '#view-alertes .row .tk{font:600 12px var(--mono);color:var(--gold);cursor:pointer}',
      '#view-alertes .row .nm{font-size:11px;color:var(--muted);margin-top:2px}',
      '#view-alertes .row .px{font:500 12px var(--mono);color:var(--cream)}',
      '#view-alertes .row .px .v{font-size:10px;margin-left:5px}',
      '#view-alertes .v.pos{color:var(--green)}#view-alertes .v.neg{color:var(--red)}',
      '#view-alertes .mini{border:1px solid var(--border2);background:transparent;color:var(--gold-l);border-radius:6px;padding:4px 9px;font:600 9px var(--sans);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}',
      '#view-alertes .mini:hover{border-color:var(--gold)}',
      '#view-alertes .mini.del{color:var(--red)}',
      '#view-alertes .add{display:flex;gap:8px;flex-wrap:wrap;padding:12px 6px 4px}',
      '#view-alertes .add select,#view-alertes .add input{background:var(--surface);border:1px solid var(--border2);border-radius:7px;color:var(--cream);padding:7px 10px;font:400 12px var(--sans);outline:none}',
      '#view-alertes .add select:focus,#view-alertes .add input:focus{border-color:var(--gold)}',
      '#view-alertes .add input{width:120px}',
      '#view-alertes .add button{border:1px solid var(--gold);background:var(--gold-bg);color:var(--gold-l);border-radius:7px;padding:0 14px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}',
      '#view-alertes .alr-a{display:flex;flex-direction:column;gap:2px;align-items:flex-end}',
      '#view-alertes .alr-badge{font:700 8px var(--sans);letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid currentColor}',
      '#view-alertes .alr-badge.on{color:var(--green)}#view-alertes .alr-badge.off{color:var(--dim)}#view-alertes .alr-badge.hit{color:var(--warn)}',
      '#view-alertes .alr-desc{font-size:11px;color:var(--muted);margin-top:2px}',
      '#view-alertes .empty{padding:24px;text-align:center;color:var(--dim);font-size:12px}',
      '@media(max-width:840px){#view-alertes .alr-cols{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function draw() {
    var view = document.getElementById('view-alertes');
    if (!view) return;
    injectCss();
    var wl = getWL(), al = getAL();
    var alByT = {};
    al.forEach(function (a) { var t = String(a.ticker).toUpperCase(); (alByT[t] = alByT[t] || []).push(a); });

    var companies = (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker; }).sort(function (a, b) { return String(a.ticker).localeCompare(String(b.ticker)); });

    // ── Watchlist ──
    var wlHtml = wl.length ? wl.map(function (w) {
      var t = String(w.ticker).toUpperCase();
      var c = coursOf(t);
      var nAl = (alByT[t] || []).length;
      return '<div class="row"><div>'
        + '<div class="tk" onclick="openFiche && openFiche(\'' + esc(t) + '\',\'alertes\')">' + esc(t) + '</div>'
        + '<div class="nm">' + esc(nom(t)) + '</div></div>'
        + '<div class="alr-a"><span class="px">' + nf(c.cp) + (isFinite(c.v) ? ' <span class="v ' + (c.v > 0 ? 'pos' : c.v < 0 ? 'neg' : '') + '">' + (c.v > 0 ? '+' : '') + c.v.toFixed(1) + '%</span>' : '') + '</span>'
        + '<span style="display:flex;gap:6px;margin-top:4px">'
        + '<button class="mini" data-wl-alert="' + esc(t) + '">＋ alerte' + (nAl ? ' (' + nAl + ')' : '') + '</button>'
        + '<button class="mini del" data-wl-rm="' + esc(w.id) + '">retirer</button></span></div></div>';
    }).join('') : '<div class="empty">Aucune valeur suivie. Ajoutez-en une ci-dessous.</div>';

    // ── Alertes ──
    var alHtml = al.length ? al.slice().sort(function (a, b) { return String(a.ticker).localeCompare(String(b.ticker)); }).map(function (a) {
      var t = String(a.ticker).toUpperCase();
      var c = coursOf(t);
      var seuil = Number(a.seuil != null ? a.seuil : a.price);
      var cond = a.condition || (a.type_alerte === 'HAUSSE' ? 'above' : a.type_alerte === 'BAISSE' ? 'below' : a.type_alerte);
      var hit = isFinite(c.cp) && (cond === 'above' ? c.cp >= seuil : c.cp <= seuil);
      var dist = (isFinite(c.cp) && seuil) ? ((c.cp - seuil) / seuil) * 100 : null;
      var st = hit ? 'hit' : a.active ? 'on' : 'off';
      return '<div class="row"><div>'
        + '<div class="tk" onclick="openFiche && openFiche(\'' + esc(t) + '\',\'alertes\')">' + esc(t) + '</div>'
        + '<div class="alr-desc">Cours ' + (cond === 'above' ? '≥' : '≤') + ' <b style="color:var(--cream)">' + nf(seuil) + '</b> FCFA'
        + (isFinite(c.cp) ? ' · actuel ' + nf(c.cp) + (dist != null ? ' (' + (dist > 0 ? '+' : '') + dist.toFixed(1) + '%)' : '') : '') + '</div></div>'
        + '<div class="alr-a"><span class="alr-badge ' + st + '">' + (hit ? '🔔 atteinte' : a.active ? 'active' : 'en pause') + '</span>'
        + '<span style="display:flex;gap:6px;margin-top:4px">'
        + '<button class="mini" data-al-toggle="' + esc(a.id) + '">' + (a.active ? 'pause' : 'activer') + '</button>'
        + '<button class="mini del" data-al-rm="' + esc(a.id) + '">suppr.</button></span></div></div>';
    }).join('') : '<div class="empty">Aucune alerte. Créez-en une depuis une valeur suivie ou ci-dessous.</div>';

    var optns = '<option value="">Ticker…</option>' + companies.map(function (e) {
      return '<option value="' + esc(e.ticker) + '">' + esc(e.ticker) + ' — ' + esc(e.nom || '') + '</option>';
    }).join('');

    view.innerHTML =
      '<div class="page-header"><h1>Suivi <span style="color:var(--gold)">&amp; alertes</span></h1>'
      + '<p>Vos valeurs suivies et vos seuils de prix. Depuis une valeur suivie : « ＋ alerte » pré-remplit le ticker.</p></div>'
      + '<div class="alr-cols">'
      + '<div class="card"><div class="card-h"><span class="t">Valeurs suivies · ' + wl.length + '</span></div><div class="card-b">'
      + wlHtml
      + '<div class="add"><select id="wlAdd">' + optns + '</select><button type="button" id="wlAddBtn">Suivre</button></div></div></div>'
      + '<div class="card"><div class="card-h"><span class="t">Alertes de prix · ' + al.length + '</span></div><div class="card-b">'
      + alHtml
      + '<div class="add"><select id="alTk">' + optns + '</select>'
      + '<select id="alCond"><option value="above">≥ seuil</option><option value="below">≤ seuil</option></select>'
      + '<input type="number" id="alPx" placeholder="Seuil FCFA"><button type="button" id="alAddBtn">Créer</button></div></div></div>'
      + '</div>';

    bind(view);
  }

  function bind(view) {
    var wlAdd = view.querySelector('#wlAddBtn');
    if (wlAdd) wlAdd.addEventListener('click', async function () {
      var t = (view.querySelector('#wlAdd') || {}).value;
      if (!t || typeof window.addWatchlistItem !== 'function') return;
      wlAdd.disabled = true;
      try { await window.addWatchlistItem(t); } catch (e) {}
      reload();
    });
    view.querySelectorAll('[data-wl-rm]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (typeof window.removeWatchlistItem !== 'function') return;
        try { await window.removeWatchlistItem(b.getAttribute('data-wl-rm')); } catch (e) {}
        reload();
      });
    });
    view.querySelectorAll('[data-wl-alert]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-wl-alert');
        var sel = view.querySelector('#alTk'); if (sel) sel.value = t;
        var c = coursOf(String(t).toUpperCase());
        var px = view.querySelector('#alPx'); if (px && isFinite(c.cp)) px.value = Math.round(c.cp);
        if (px) { px.focus(); px.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      });
    });
    var alAdd = view.querySelector('#alAddBtn');
    if (alAdd) alAdd.addEventListener('click', async function () {
      var t = (view.querySelector('#alTk') || {}).value;
      var cond = (view.querySelector('#alCond') || {}).value;
      var px = Number((view.querySelector('#alPx') || {}).value);
      if (!t || ['above', 'below'].indexOf(cond) < 0 || !(px > 0)) {
        if (typeof window.toast === 'function') window.toast('Ticker, condition et seuil positif requis.', 'warn');
        return;
      }
      alAdd.disabled = true;
      try { await apiAlert('POST', { ticker: String(t).toUpperCase(), condition: cond, price: px }); if (typeof window.toast === 'function') window.toast('Alerte créée', 'success'); }
      catch (e) { if (typeof window.toast === 'function') window.toast(e.message || 'Échec', 'error'); }
      reload();
    });
    view.querySelectorAll('[data-al-toggle]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (typeof window.toggleAlert === 'function') { try { await window.toggleAlert(b.getAttribute('data-al-toggle')); } catch (e) {} }
        reload();
      });
    });
    view.querySelectorAll('[data-al-rm]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (typeof window.removeAlert === 'function') { try { await window.removeAlert(b.getAttribute('data-al-rm')); } catch (e) {} }
        else { try { await apiAlert('DELETE', undefined, b.getAttribute('data-al-rm')); } catch (e) {} }
        reload();
      });
    });
  }

  function renderAlertes() {
    if (typeof window.initUserDataLayer === 'function' && !window.__TC_UD_INIT__) {
      window.__TC_UD_INIT__ = true;
      Promise.resolve(window.initUserDataLayer()).then(draw).catch(draw);
    } else {
      draw();
    }
  }
  window.renderAlertes = renderAlertes;
  window.renderAlerts = draw;
  window.addEventListener('tc:dataready', function () {
    var v = document.getElementById('view-alertes');
    if (v && v.classList.contains('active')) draw();
  });
})();
