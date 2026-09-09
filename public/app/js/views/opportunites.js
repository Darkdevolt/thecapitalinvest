// ============================================================================
// ÉCRAN D'OPPORTUNITÉS  (P1 roadmap — parité RichBourse « sélection du moment »)
// Balaye toute la cote et remonte les valeurs qui présentent un signal :
//   · volume anormal (> 2× la moyenne 20 séances)
//   · proche du plus-haut / plus-bas de la fenêtre d'historique
//   · écart marqué à la moyenne mobile 20 (momentum / survente)
//   · forte variation du jour (|Δ| ≥ 3 %)
//   · détachement de dividende imminent (≤ 15 jours)
// Sources : allCours (séance) · historique (fenêtre ~3 mois, paginée) ·
//           allDividendes · allEntreprises. Aucun signal inventé : sans
//           historique suffisant, les signaux qui en dépendent sont ignorés.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_OPPORTUNITES_V1__) return;
  window.__TC_OPPORTUNITES_V1__ = true;

  var histIndex = null;      // { TICKER: [rows triés par date] }
  var loading = false;
  var FILTER = 'all';
  var SORT = 'signals';

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pct(v) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, 2) + ' %' : '—'; }
  function g(id) { return document.getElementById(id); }
  function close(r) { return num(r && (r.cours_cloture != null ? r.cours_cloture : r.cloture != null ? r.cloture : r.cours_normal != null ? r.cours_normal : r.cours)); }

  function ent(t) { return (window.entMap && window.entMap[t]) || {}; }
  function coursSnapshot() { return Array.isArray(window.allCours) ? window.allCours : []; }

  // ---- historique : réutilise le cache titres si présent, sinon pagine ----
  function buildIndexFrom(rows) {
    var idx = {};
    (rows || []).forEach(function (r) {
      var t = String(r && r.ticker || '').toUpperCase();
      if (!t) return;
      (idx[t] || (idx[t] = [])).push(r);
    });
    Object.keys(idx).forEach(function (t) {
      idx[t].sort(function (a, b) { return ymd(a.date_seance) < ymd(b.date_seance) ? -1 : 1; });
    });
    return idx;
  }
  function ensureHistory() {
    if (histIndex) return Promise.resolve(histIndex);
    if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 400) {
      histIndex = buildIndexFrom(window.allCoursHistorique);
      return Promise.resolve(histIndex);
    }
    if (typeof window.apiGet !== 'function') { histIndex = {}; return Promise.resolve(histIndex); }
    var since = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    var all = [];
    var page = function (offset) {
      return window.apiGet('/marche?type=historique&limit=1000&offset=' + offset + '&date_from=' + since, { cache: 'no-store' })
        .then(function (rows) {
          var arr = Array.isArray(rows) ? rows : (rows && rows.data) || [];
          all = all.concat(arr);
          if (arr.length === 1000 && offset < 4000) return page(offset + 1000);
          return all;
        });
    };
    return page(0).then(function (rows) {
      window.allCoursHistorique = rows;
      histIndex = buildIndexFrom(rows);
      return histIndex;
    }).catch(function () { histIndex = {}; return histIndex; });
  }

  // ---- dividendes à venir ----
  function upcomingDividend(t) {
    var today = new Date().toISOString().slice(0, 10);
    var limit = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return (Array.isArray(window.allDividendes) ? window.allDividendes : [])
      .filter(function (d) { return d && String(d.ticker).toUpperCase() === t; })
      .map(function (d) { return ymd(d.date_detachement || d.ex_date); })
      .filter(function (ex) { return ex && ex >= today && ex <= limit; })
      .sort()[0] || null;
  }

  // ---- détection des signaux pour un titre ----
  var SIGNALS = {
    vol: { label: 'Volume anormal', cls: 'blue' },
    haut: { label: 'Proche du plus-haut', cls: 'green' },
    bas: { label: 'Proche du plus-bas', cls: 'red' },
    momentum: { label: 'Au-dessus de la MM20', cls: 'green' },
    survente: { label: 'Sous la MM20', cls: 'red' },
    var: { label: 'Forte variation du jour', cls: 'warn' },
    div: { label: 'Détachement imminent', cls: 'gold' }
  };

  function analyse(row) {
    var t = String(row.ticker || '').toUpperCase();
    var cp = close(row);
    if (!t || cp == null || !(cp > 0)) return null;
    var e = ent(t);
    var hist = (histIndex && histIndex[t]) || [];
    var tags = [];
    var notes = [];

    var varDay = num(row.variation_pct != null ? row.variation_pct : row.variation);
    if (varDay != null && Math.abs(varDay) >= 3) { tags.push('var'); notes.push('Variation ' + pct(varDay) + ' sur la séance.'); }

    var divEx = upcomingDividend(t);
    if (divEx) { tags.push('div'); notes.push('Dividende détaché le ' + divEx.split('-').reverse().join('/') + '.'); }

    if (hist.length >= 15) {
      var last20 = hist.slice(-20);
      var prior = hist.slice(-21, -1); // 20 séances avant la dernière
      var avgVol = prior.reduce(function (s, x) { return s + (num(x.volume) || 0); }, 0) / (prior.length || 1);
      var vol = num(row.volume);
      if (vol != null && avgVol > 0 && vol > avgVol * 2) {
        tags.push('vol');
        notes.push('Volume ' + nf(vol) + ' contre ' + nf(avgVol) + ' en moyenne (×' + (vol / avgVol).toFixed(1) + ').');
      }
      var hi = last20.reduce(function (m, x) { return Math.max(m, num(x.plus_haut) || close(x) || 0); }, 0);
      var lo = last20.reduce(function (m, x) { var v = num(x.plus_bas) || close(x); return v ? Math.min(m, v) : m; }, Infinity);
      if (hi > 0 && cp >= hi * 0.97) { tags.push('haut'); notes.push('À ' + nf((cp / hi - 1) * 100, 1) + ' % du plus-haut ' + nf(hi) + ' de la fenêtre.'); }
      if (isFinite(lo) && lo > 0 && cp <= lo * 1.03) { tags.push('bas'); notes.push('À ' + nf((cp / lo - 1) * 100, 1) + ' % du plus-bas ' + nf(lo) + ' de la fenêtre.'); }
      var sma = last20.reduce(function (s, x) { return s + (close(x) || 0); }, 0) / last20.length;
      if (sma > 0) {
        var gap = (cp / sma - 1) * 100;
        if (gap >= 3) { tags.push('momentum'); notes.push('Cours ' + nf(gap, 1) + ' % au-dessus de la moyenne mobile 20.'); }
        else if (gap <= -5) { tags.push('survente'); notes.push('Cours ' + nf(gap, 1) + ' % sous la moyenne mobile 20.'); }
      }
    }

    if (!tags.length) return null;
    return {
      ticker: t, nom: e.nom || e.nom_court || t, secteur: e.secteur || '—',
      cours: cp, varDay: varDay, tags: tags, notes: notes, sessions: hist.length
    };
  }

  // ---- rendu ----
  function injectCss() {
    if (g('tc-opportunites-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-opportunites-css';
    s.textContent = [
      '#view-opportunites .op-chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}',
      '#view-opportunites .op-chip{background:var(--surface);border:1px solid rgba(245,240,232,.14);color:var(--muted,rgba(245,240,232,.6));border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer}',
      '#view-opportunites .op-chip.active{background:var(--gold);color:#1a1408;border-color:var(--gold);font-weight:700}',
      '#view-opportunites .op-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}',
      '#view-opportunites .op-card{background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:12px;padding:15px 16px;cursor:pointer;transition:border-color .15s}',
      '#view-opportunites .op-card:hover{border-color:var(--gold)}',
      '#view-opportunites .op-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
      '#view-opportunites .op-tk{font-family:var(--mono,monospace);font-weight:700;font-size:15px}',
      '#view-opportunites .op-nom{font-size:11px;color:var(--dim);margin-top:2px}',
      '#view-opportunites .op-px{font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;text-align:right}',
      '#view-opportunites .op-var{font-size:12px}',
      '#view-opportunites .pos{color:var(--green,#4ADE80)}#view-opportunites .neg{color:var(--red,#F87171)}',
      '#view-opportunites .op-tags{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0 8px}',
      '#view-opportunites .op-tag{font-size:10px;padding:2px 7px;border-radius:999px;border:1px solid;letter-spacing:.02em}',
      '#view-opportunites .op-tag.green{color:#4ADE80;border-color:rgba(74,222,128,.4)}',
      '#view-opportunites .op-tag.red{color:#F87171;border-color:rgba(248,113,113,.4)}',
      '#view-opportunites .op-tag.blue{color:#60A5FA;border-color:rgba(96,165,250,.4)}',
      '#view-opportunites .op-tag.warn{color:#F0A72A;border-color:rgba(240,167,42,.4)}',
      '#view-opportunites .op-tag.gold{color:var(--gold-l,#D4AF6A);border-color:rgba(184,150,78,.5)}',
      '#view-opportunites .op-notes{font-size:11.5px;line-height:1.55;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-opportunites .op-bar{font-size:12px;color:var(--muted,rgba(245,240,232,.6));display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:4px}',
      '#view-opportunites select{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:7px;padding:5px 8px;font:inherit;font-size:12px}',
      '#view-opportunites .op-empty{padding:28px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function draw(list) {
    var view = g('view-opportunites');
    if (!view) return;

    var counts = {};
    list.forEach(function (o) { o.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });

    var filtered = FILTER === 'all' ? list : list.filter(function (o) { return o.tags.indexOf(FILTER) >= 0; });
    filtered = filtered.slice().sort(function (a, b) {
      if (SORT === 'var') return Math.abs(b.varDay || 0) - Math.abs(a.varDay || 0);
      if (SORT === 'ticker') return a.ticker.localeCompare(b.ticker);
      return b.tags.length - a.tags.length || Math.abs(b.varDay || 0) - Math.abs(a.varDay || 0);
    });

    var chips = '<button type="button" class="op-chip' + (FILTER === 'all' ? ' active' : '') + '" data-f="all">Tous (' + list.length + ')</button>'
      + Object.keys(SIGNALS).filter(function (k) { return counts[k]; }).map(function (k) {
        return '<button type="button" class="op-chip' + (FILTER === k ? ' active' : '') + '" data-f="' + k + '">' + esc(SIGNALS[k].label) + ' (' + counts[k] + ')</button>';
      }).join('');

    view.innerHTML = ''
      + '<div class="page-header"><h1>Écran <span style="color:var(--gold)">d\'opportunités</span></h1>'
      + '<p>Toutes les valeurs de la cote présentant un signal de marché aujourd\'hui. Cliquez une carte pour ouvrir la fiche.</p></div>'
      + '<div class="op-bar"><span>' + list.length + ' valeur(s) avec au moins un signal</span>'
      + '<label>Trier : <select id="opSort">'
      + '<option value="signals"' + (SORT === 'signals' ? ' selected' : '') + '>Nombre de signaux</option>'
      + '<option value="var"' + (SORT === 'var' ? ' selected' : '') + '>Variation du jour</option>'
      + '<option value="ticker"' + (SORT === 'ticker' ? ' selected' : '') + '>Ticker</option>'
      + '</select></label></div>'
      + '<div class="op-chips">' + chips + '</div>'
      + (filtered.length
        ? '<div class="op-grid">' + filtered.map(card).join('') + '</div>'
        : '<div class="op-empty">Aucune valeur pour ce filtre.</div>')
      + '<p class="op-notes" style="margin-top:14px">Fenêtre d\'historique : ~' + (list[0] ? list[0].sessions : 0) + ' séances récentes. Signaux volume / plus-haut / plus-bas / MM20 calculés sur cette fenêtre ; « forte variation » sur la séance en cours ; « détachement imminent » depuis le calendrier des dividendes. Ceci n\'est pas un conseil d\'investissement.</p>';

    view.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { FILTER = b.getAttribute('data-f'); draw(list); });
    });
    var ss = g('opSort');
    if (ss) ss.addEventListener('change', function () { SORT = this.value; draw(list); });
    view.querySelectorAll('[data-op-ticker]').forEach(function (c) {
      c.addEventListener('click', function () {
        var t = c.getAttribute('data-op-ticker');
        if (typeof window.openFiche === 'function') window.openFiche(t, 'opportunites');
        else if (typeof window.nav === 'function') { location.hash = '#fiche=' + t; }
      });
    });
  }

  function card(o) {
    var vc = (o.varDay || 0) >= 0 ? 'pos' : 'neg';
    return '<div class="op-card" data-op-ticker="' + esc(o.ticker) + '">'
      + '<div class="op-head"><div><div class="op-tk">' + esc(o.ticker) + '</div><div class="op-nom">' + esc(o.nom) + ' · ' + esc(o.secteur) + '</div></div>'
      + '<div class="op-px">' + nf(o.cours) + '<div class="op-var ' + vc + '">' + pct(o.varDay) + '</div></div></div>'
      + '<div class="op-tags">' + o.tags.map(function (t) { return '<span class="op-tag ' + SIGNALS[t].cls + '">' + esc(SIGNALS[t].label) + '</span>'; }).join('') + '</div>'
      + '<div class="op-notes">' + o.notes.map(esc).join(' ') + '</div>'
      + '</div>';
  }

  function render() {
    var view = g('view-opportunites');
    if (!view) return;
    injectCss();
    if (loading) return;
    if (!histIndex) {
      view.innerHTML = '<div class="page-header"><h1>Écran <span style="color:var(--gold)">d\'opportunités</span></h1></div>'
        + '<div class="op-empty">Analyse de la cote en cours…</div>';
      loading = true;
      ensureHistory().then(function () {
        loading = false;
        var list = coursSnapshot().map(analyse).filter(Boolean);
        if (!list.length) { view.innerHTML = view.querySelector('.page-header').outerHTML + '<div class="op-empty">Aucun signal détecté sur la séance, ou données de marché indisponibles.</div>'; return; }
        draw(list);
      });
      return;
    }
    var list = coursSnapshot().map(analyse).filter(Boolean);
    if (!list.length) { view.innerHTML = '<div class="page-header"><h1>Écran <span style="color:var(--gold)">d\'opportunités</span></h1></div><div class="op-empty">Aucun signal détecté sur la séance.</div>'; return; }
    draw(list);
  }

  window.renderOpportunites = render;
})();
