/* Page publique /reporting.html — affiche le dernier reporting publié par
   l'admin (api/marche.js?type=reporting_latest), en HTML, pas en image.
   Même esprit que public/js/landing-market-preview.js : IIFE, pas de
   framework, cache localStorage pour un affichage instantané au retour. */
(function () {
  'use strict';
  if (window.__TC_REPORTING_PAGE__) return;
  window.__TC_REPORTING_PAGE__ = true;

  var root = document.getElementById('tcReportingPage');
  if (!root) return;

  var STORAGE_KEY = 'tc:reporting:public-latest:v1';
  var ENDPOINT = '/api/marche?type=reporting_latest';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    if (Math.abs(v) >= 1e9) return (v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }

  function pct(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function fmtDateLong(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return iso; }
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  /* Icônes — trait fin, currentColor, même vocabulaire que le générateur
     SVG de l'admin (colonnes/bourse, triangles pleins, tiret, pouls). */
  var ICON = {
    columns: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 6 8 1.5 15 6" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M1 6h14M2.5 6v6M6.5 6v6M9.5 6v6M13.5 6v6M0.5 12h15" stroke="currentColor" stroke-width="1.4"/></svg>',
    triUp: '<svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,10 1,10" fill="currentColor"/></svg>',
    triDown: '<svg width="12" height="12" viewBox="0 0 12 12"><polygon points="1,2 11,2 6,11" fill="currentColor"/></svg>',
    dash: '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="5" width="10" height="2.6" rx="1.3" fill="currentColor"/></svg>',
    pulse: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="0,9 4,9 6.5,2 9,13 11.5,5 16,5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bond: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="3.5" y1="7" x2="9.5" y2="7" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="9.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    calendar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.4"/><line x1="4.5" y1="1" x2="4.5" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="11.5" y1="1" x2="11.5" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    coin: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><text x="8" y="11" text-anchor="middle" font-size="7" font-family="DM Mono, monospace" fill="currentColor" font-weight="600">F</text></svg>'
  };

  function sparkSvg(values) {
    var v = (values || []).filter(function (n) { return n !== null && n !== undefined && isFinite(n); });
    if (v.length < 2) return '';
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    var span = (max - min) || Math.abs(max) || 1;
    var up = v[v.length - 1] >= v[0];
    var w = 60, h = 20;
    var pts = v.map(function (val, i) {
      var px = (w * i) / (v.length - 1);
      var py = h - ((val - min) / span) * h;
      return px.toFixed(1) + ',' + py.toFixed(1);
    }).join(' ');
    return '<svg class="rep-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + (up ? '#1f7a4d' : '#b23a3a') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function statCell(cls, icon, label, value) {
    return '<div class="rep-stat ' + cls + '">' + ICON[icon] + '<span class="l">' + esc(label) + '</span><span class="v">' + esc(value) + '</span></div>';
  }

  function avatarRow(e, positive) {
    var initiale = String(e.ticker || '?').charAt(0);
    var detail = [];
    if (e.volume) detail.push(money(e.volume) + ' titres');
    if (e.valeur) detail.push(money(e.valeur) + ' F échangés');
    return '<tr><td><div class="rep-name-cell"><span class="rep-avatar">' + esc(initiale) + '</span>' +
      '<div class="nm"><span class="tk">' + esc(e.ticker) + '</span>' +
      (e.nom ? '<span class="soc">' + esc(e.nom) + (detail.length ? ' · ' + esc(detail.join(' · ')) : '') + '</span>' : '') +
      '</div></div></td>' +
      '<td class="r">' + esc(money(e.last)) + '</td>' +
      '<td class="r"><span class="rep-trend ' + (positive ? 'up' : 'down') + '">' + ICON[positive ? 'triUp' : 'triDown'] + esc(pct(e.perf)) + '</span></td></tr>';
  }

  function podiumTable(title, icon, list, positive) {
    if (!list || !list.length) return '';
    return '<div class="rep-section-title">' + ICON[icon] + '<span>' + esc(title) + '</span></div>' +
      '<table class="rep-table"><thead><tr><th>Société</th><th class="r">Cours</th><th class="r">Var.</th></tr></thead>' +
      '<tbody>' + list.map(function (e) { return avatarRow(e, positive); }).join('') + '</tbody></table>';
  }

  function render(row) {
    if (!row || !row.payload) {
      root.innerHTML = '<div class="rep-wrap"><div class="rep-empty"><h2>Aucun reporting publié pour l\'instant</h2>' +
        '<p>Revenez après la prochaine séance — le bulletin de marché sera publié ici.</p></div></div>';
      return;
    }
    var p = row.payload;
    var w = p.window || {};
    var t = p.totals || {};
    var h = p.habillage || {};

    var html = '';
    html += '<div class="rep-wrap rep-head">';
    html += '<div class="rep-crumb">' + ICON.columns + '<span>BRVM · Bourse Régionale des Valeurs Mobilières</span></div>';
    html += '<h1 class="rep-title">' + esc(p.titre || 'La séance en une minute') + '</h1>';
    html += '<div class="rep-window">' + esc(w.periode === 'seance' ? fmtDateLong(w.to) : (w.label || '')) + '</div>';
    var badges = [];
    if (h.bulletin || h.heure) badges.push('<span class="rep-badge">' + esc([h.bulletin, h.heure].filter(Boolean).join(' · ')) + '</span>');
    badges.push('<span class="rep-badge"><span class="dot"></span>Publié le ' + esc(fmtDateTime(row.published_at)) + '</span>');
    html += '<div class="rep-badges">' + badges.join('') + '</div>';
    if (p.note) html += '<p class="rep-note">' + esc(p.note) + '</p>';
    html += '</div>';

    // Bandeau d'activité
    if (t && t.titres != null) {
      html += '<div class="rep-wrap rep-section"><div class="rep-stats">' +
        statCell('', 'columns', 'Titres cotés', t.titres) +
        statCell('up', 'triUp', 'Hausse', t.up) +
        statCell('down', 'triDown', 'Baisse', t.down) +
        statCell('', 'dash', 'Stables', t.flat) +
        statCell('', 'pulse', 'Valeur échangée', money(t.valeur) + ' F') +
        '</div></div>';
    }

    // Indices
    if (p.indices && p.indices.length) {
      html += '<div class="rep-wrap rep-section"><div class="rep-section-title">' + ICON.pulse + '<span>Indices de marché</span></div>' +
        '<table class="rep-table"><thead><tr><th>Indice</th><th class="r">Valeur</th><th class="r">' +
        (w.periode === 'seance' ? 'Séance' : 'Période') + '</th><th class="r">Depuis 1er janv.</th><th class="r">Tendance</th></tr></thead><tbody>' +
        p.indices.map(function (idx) {
          var positive = Number(idx.perf) >= 0;
          return '<tr><td>' + esc(idx.indice) + '</td>' +
            '<td class="r">' + esc(Number(idx.last).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '</td>' +
            '<td class="r"><span class="rep-trend ' + (positive ? 'up' : 'down') + '">' + ICON[positive ? 'triUp' : 'triDown'] + esc(pct(idx.perf)) + '</span></td>' +
            '<td class="r">' + (idx.ytd == null ? '—' : '<span class="rep-trend ' + (Number(idx.ytd) >= 0 ? 'up' : 'down') + '">' + esc(pct(idx.ytd)) + '</span>') + '</td>' +
            '<td class="r">' + sparkSvg(idx.spark) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    // Marché en chiffres + répartition sectorielle
    var c = p.chiffres || {};
    var hasSecteurs = p.secteurs && p.secteurs.length >= 2;
    var chiffresRows = [
      ['Titres cotés', c.titresCotes], ['Sociétés cotées', c.societesCotees],
      ['Capitalisation actions', c.capiActions != null ? money(c.capiActions) + ' F' : null],
      ['PER médian', c.perMedian != null ? c.perMedian.toFixed(1) + 'x' : null],
      ['Rendement médian', c.rdtMedian != null ? c.rdtMedian.toFixed(2) + ' %' : null],
      ['Rentabilité médiane (ROE)', c.roeMedian != null ? c.roeMedian.toFixed(1) + ' %' : null]
    ].filter(function (r) { return r[1] != null; });
    var oblRows = [
      ['Lignes obligataires', c.lignesObligataires], ['Capitalisation obligations', c.capiObligations != null ? money(c.capiObligations) + ' F' : null]
    ].filter(function (r) { return r[1] != null; });
    if (chiffresRows.length || hasSecteurs) {
      html += '<div class="rep-wrap rep-section"><div class="rep-2col"><div>';
      html += '<div class="rep-section-title">' + ICON.columns + '<span>Le marché en chiffres</span></div>';
      if (c.valeurTransactions != null) html += '<div class="rep-kv"><span class="k">Valeur des transactions</span><span class="v">' + esc(money(c.valeurTransactions) + ' F') + '</span></div>';
      if (chiffresRows.length) {
        html += '<div class="rep-subhead">Actions</div>';
        html += chiffresRows.map(function (r) { return '<div class="rep-kv"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>'; }).join('');
      }
      if (oblRows.length) {
        html += '<div class="rep-subhead">' + ICON.bond + '<span>Obligataire</span></div>';
        html += oblRows.map(function (r) { return '<div class="rep-kv"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>'; }).join('');
      }
      html += '</div><div>';
      if (hasSecteurs) {
        var maxPct = Math.max.apply(null, p.secteurs.map(function (s) { return s.pct; })) || 1;
        html += '<div class="rep-section-title">' + ICON.pulse + '<span>Répartition sectorielle</span></div><div class="rep-bars">';
        html += p.secteurs.map(function (s) {
          return '<div class="rep-bar-row"><div class="top"><span>' + esc(s.nom) + '</span><span style="font-family:var(--mono);color:var(--gold)">' + s.pct.toFixed(1) + ' %</span></div>' +
            '<div class="track"><div class="fill" style="width:' + Math.max(3, (s.pct / maxPct) * 100) + '%"></div></div></div>';
        }).join('');
        html += '</div>';
      }
      html += '</div></div></div>';
    }

    // Hausses / Baisses
    if ((p.hausses && p.hausses.length) || (p.baisses && p.baisses.length)) {
      html += '<div class="rep-wrap rep-section"><div class="rep-2col">';
      html += '<div>' + podiumTable('Plus fortes hausses', 'triUp', p.hausses, true) + '</div>';
      html += '<div>' + podiumTable('Plus fortes baisses', 'triDown', p.baisses, false) + '</div>';
      html += '</div></div>';
    }

    // Plus forte activité
    if (p.volumes && p.volumes.length) {
      var maxV = Math.max.apply(null, p.volumes.map(function (e) { return e.valeur || 0; })) || 1;
      html += '<div class="rep-wrap rep-section"><div class="rep-section-title">' + ICON.pulse + '<span>Plus forte activité · valeurs échangées</span></div><div class="rep-bars">' +
        p.volumes.map(function (e) {
          return '<div class="rep-bar-row"><div class="top"><span style="font-family:var(--serif);font-weight:600;color:var(--gold)">' + esc(e.ticker) + '</span>' +
            '<span style="font-family:var(--mono)">' + esc(money(e.valeur) + ' F') + '</span></div>' +
            '<div class="track"><div class="fill" style="width:' + Math.max(3, ((e.valeur || 0) / maxV) * 100) + '%"></div></div></div>';
        }).join('') + '</div></div>';
    }

    // Marché obligataire — détail
    var o = p.obligataire || {};
    if (o.top && o.top.length) {
      html += '<div class="rep-wrap rep-section"><div class="rep-section-title">' + ICON.bond + '<span>Marché obligataire · lignes les plus cotées</span></div>' +
        '<table class="rep-table"><thead><tr><th>Code</th><th>Société</th><th class="r">Cours</th></tr></thead><tbody>' +
        o.top.map(function (b) {
          return '<tr><td style="font-family:var(--mono);color:var(--gold)">' + esc(b.code || '') + '</td><td>' + esc(b.nom || '—') + '</td><td class="r">' + esc(money(b.cours) + ' F') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    // Dividendes à venir
    if (p.dividendesAVenir && p.dividendesAVenir.length) {
      html += '<div class="rep-wrap rep-section"><div class="rep-section-title">' + ICON.calendar + '<span>Dividendes à venir</span></div>' +
        '<table class="rep-table"><thead><tr><th>Société</th><th class="r">Détachement</th><th class="r">Montant</th><th class="r">Rendement</th></tr></thead><tbody>' +
        p.dividendesAVenir.map(function (d) {
          return '<tr><td><span style="font-family:var(--serif);font-weight:600;color:var(--gold)">' + esc(d.ticker) + '</span>' +
            (d.nom ? ' <span style="color:var(--muted);font-size:12px">' + esc(d.nom) + '</span>' : '') + '</td>' +
            '<td class="r">' + esc(d.detach || '—') + '</td>' +
            '<td class="r">' + esc(d.montant != null ? money(d.montant) + ' F' : '—') + '</td>' +
            '<td class="r" style="color:var(--green)">' + esc(d.rdt != null ? (d.rdt <= 1.5 ? (d.rdt * 100) : d.rdt).toFixed(2) + ' %' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    // Parité + pied de page
    html += '<div class="rep-wrap rep-section"><div class="rep-fx">' +
      '<span style="display:flex;align-items:center;gap:8px">' + ICON.coin + '<span class="amt">1 € = 655,957 FCFA</span></span>' +
      '<span>Parité fixe UEMOA / zone euro</span></div></div>';

    html += '<div class="rep-wrap rep-foot-note">' +
      '<span>Données de séance The Capital · sources BRVM. Information à caractère informatif — ne constitue pas un conseil en investissement.</span>' +
      '<span><a href="/">thecapitalinvest.com</a> · © ' + (w.to ? w.to.slice(0, 4) : new Date().getFullYear()) + ' The Capital</span></div>';

    root.innerHTML = html;
  }

  function loading() {
    root.innerHTML = '<div class="rep-wrap"><div class="rep-skel">Chargement du reporting…</div></div>';
  }

  var cached = null;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) { cached = null; }

  if (cached) render(cached); else loading();

  var controller = new AbortController();
  window.addEventListener('pagehide', function () { controller.abort(); }, { once: true });

  fetch(ENDPOINT, {
    headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'default', signal: controller.signal
  }).then(function (r) { return r.json(); }).then(function (payload) {
    var row = payload && payload.data ? payload.data : null;
    render(row);
    if (row) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(row)); } catch (e) { /* stockage indisponible, tant pis */ }
    }
  }).catch(function () {
    if (!cached) render(null);
  });
})();
