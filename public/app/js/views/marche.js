// THE CAPITAL — Vue Marché BRVM
// The market view owns its content and filters but never touches header/navigation.
(function () {
  'use strict';

  if (window.__TC_MARCHE_LOADED__) return;
  window.__TC_MARCHE_LOADED__ = true;

  var selectedTicker = null;
  var indexPeriod = 30;
  var courseFilter = 'all';
  var courseQuery = '';
  var pubFilter = 'all';
  var pubQuery = '';
  var courseSort = { key: 'variation', dir: -1 };

  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function money(value) {
    var n = num(value);
    return n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  function pct(value) {
    var n = num(value);
    return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + ' %';
  }

  function dateLabel(value) {
    if (!value) return '—';
    var d = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function companyName(ticker) {
    var map = window.entMap || {};
    var entity = map[ticker] || map[String(ticker || '').toUpperCase()];
    return entity ? (entity.nom || entity.nom_court || entity.name || entity.raison_sociale || ticker) : ticker;
  }

  function courseTicker(row) {
    return String(row.ticker || row.symbol || '').trim().toUpperCase();
  }

  function courseName(row) {
    var ticker = courseTicker(row);
    return row.nom || row.entreprise || row.name || companyName(ticker);
  }

  function courseVariation(row) {
    return num(row.variation_pct != null ? row.variation_pct : (row.variation != null ? row.variation : row.var));
  }

  function courseSector(row) {
    if (row.secteur || row.sector) return row.secteur || row.sector;
    var t = courseTicker(row);
    var ent = (window.entMap && (window.entMap[t] || window.entMap[String(t).toUpperCase()])) || null;
    if (ent && (ent.secteur || ent.sous_secteur)) return ent.secteur || ent.sous_secteur;
    if (typeof window.getSector === 'function') { var s = window.getSector(t); if (s) return s; }
    return '—';
  }

  function coursePrice(row) {
    return row.cours != null ? row.cours : (row.cours_cloture != null ? row.cours_cloture : (row.cloture != null ? row.cloture : row.cours_normal));
  }

  function getCours() {
    return Array.isArray(window.allCours) ? window.allCours.slice() : [];
  }

  function getIndicesLatest() {
    return Array.isArray(window.allIndices) ? window.allIndices.slice() : [];
  }

  function getIndex(names) {
    // On veut la dernière cotation : si allIndices contient plusieurs lignes
    // « COMPOSITE » (cas de l'historique), on garde la date la plus récente.
    var rows = getIndicesLatest();
    if (!rows.length && Array.isArray(window.allIndicesHistory)) rows = window.allIndicesHistory.slice();
    var best = null;
    for (var i = 0; i < rows.length; i += 1) {
      var key = String(rows[i].indice || rows[i].nom || rows[i].code || '').toUpperCase();
      var hit = false;
      for (var j = 0; j < names.length; j += 1) { if (key.indexOf(names[j]) !== -1) { hit = true; break; } }
      if (!hit) continue;
      if (!best || String(rows[i].date_seance || '') > String(best.date_seance || '')) best = rows[i];
    }
    return best;
  }

  function indexCard(label, row) {
    var value = row ? (row.valeur != null ? row.valeur : row.value) : null;
    var change = row ? (row.variation_pct != null ? row.variation_pct : row.variation) : null;
    return '<div class="stat-card">' +
      '<div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value">' + money(value) + '</div>' +
      '<div class="stat-change">' + pct(change) + '</div>' +
    '</div>';
  }

  function filterCourses(rows) {
    var q = courseQuery.trim().toLowerCase();
    return rows.filter(function (row) {
      var ticker = courseTicker(row);
      var name = String(courseName(row) || '').toLowerCase();
      var sector = String(row.secteur || row.sector || '').toLowerCase();
      var variation = courseVariation(row);
      var queryOk = !q || ticker.toLowerCase().indexOf(q) !== -1 || name.indexOf(q) !== -1;
      if (!queryOk) return false;
      if (courseFilter === 'up') return variation != null && variation > 0;
      if (courseFilter === 'down') return variation != null && variation < 0;
      if (courseFilter === 'banque') return sector.indexOf('banq') !== -1;
      if (courseFilter === 'agro') return sector.indexOf('agro') !== -1;
      if (courseFilter === 'industrie') return sector.indexOf('industr') !== -1;
      if (courseFilter === 'telecom') return sector.indexOf('tele') !== -1;
      return true;
    });
  }

  function renderCourses(rows) {
    var body = document.getElementById('marche-coursTable');
    var count = document.getElementById('marche-coursCount');
    if (!body) return;

    var filtered = filterCourses(rows);
    if (count) count.textContent = filtered.length + ' / ' + rows.length + ' titre(s)';

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-title">Aucun titre trouvé</div><div class="empty-text">Modifiez la recherche ou le filtre de séance.</div></div></td></tr>';
      return;
    }

    var sortKey = courseSort.key;
    filtered.sort(function (a,b) {
      if(sortKey==='ticker') return courseTicker(a).localeCompare(courseTicker(b))*courseSort.dir;
      var av=sortKey==='variation'?courseVariation(a):sortKey==='volume'?num(a.volume):sortKey==='capitalisation'?num(a.capitalisation):num(coursePrice(a));
      var bv=sortKey==='variation'?courseVariation(b):sortKey==='volume'?num(b.volume):sortKey==='capitalisation'?num(b.capitalisation):num(coursePrice(b));
      return ((av==null?-Infinity:av)-(bv==null?-Infinity:bv))*courseSort.dir;
    });
    body.innerHTML = filtered.map(function (row,i) {
      var ticker = courseTicker(row);
      var variation = courseVariation(row);
      var variationStyle = variation > 0 ? 'var(--green)' : (variation < 0 ? 'var(--red)' : 'var(--muted)');
      return '<tr>' +
        '<td><span class="market-ticker" data-market-ticker="' + esc(ticker) + '">' + esc(ticker) + '</span></td>' +
        '<td>' + esc(courseName(row)) + '</td>' +
        '<td class="right">' + money(coursePrice(row)) + '</td>' +
        '<td class="right"><span class="market-signal ' + (variation > 0 ? 'up' : (variation < 0 ? 'down' : 'flat')) + '">' + pct(variation) + '</span></td>' +
        '<td class="right">' + money(row.plus_haut || row.plus_high || row.high) + '</td>' +
        '<td class="right">' + money(row.plus_bas || row.plus_low || row.low) + '</td>' +
        '<td class="right">' + money(row.volume) + '</td>' +
        '<td class="right">' + money(row.capitalisation) + '</td>' +
        '<td>' + esc(courseSector(row)) + '</td>' +
      '</tr>';
    }).join('');
  }

  function moverRows(rows, descending) {
    var copy = rows.slice().filter(function (r) { return courseVariation(r) != null; });
    copy.sort(function (a, b) {
      var av = courseVariation(a) || 0;
      var bv = courseVariation(b) || 0;
      return descending ? bv - av : av - bv;
    });
    return copy.slice(0, 5);
  }

  function renderMovers(rows) {
    var topUp = document.getElementById('marche-topHausses');
    var topDown = document.getElementById('marche-topBaisses');
    var topVolume = document.getElementById('marche-topVolumes');
    if (topUp) {
      topUp.innerHTML = moverRows(rows.filter(function (r) { return (courseVariation(r) || 0) > 0; }), true).map(function (row) {
        return '<tr><td><strong style="color:var(--gold)">' + esc(courseTicker(row)) + '</strong></td><td class="right">' + money(coursePrice(row)) + '</td><td class="right" style="color:var(--green)">' + pct(courseVariation(row)) + '</td><td class="right">' + money(row.volume) + '</td></tr>';
      }).join('') || '<tr><td colspan="4">Aucune hausse</td></tr>';
    }
    if (topDown) {
      topDown.innerHTML = moverRows(rows.filter(function (r) { return (courseVariation(r) || 0) < 0; }), false).map(function (row) {
        return '<tr><td><strong style="color:var(--gold)">' + esc(courseTicker(row)) + '</strong></td><td class="right">' + money(coursePrice(row)) + '</td><td class="right" style="color:var(--red)">' + pct(courseVariation(row)) + '</td><td class="right">' + money(row.volume) + '</td></tr>';
      }).join('') || '<tr><td colspan="4">Aucune baisse</td></tr>';
    }
    if (topVolume) {
      var volumes = rows.slice().sort(function (a, b) { return (num(b.volume) || 0) - (num(a.volume) || 0); }).slice(0, 10);
      topVolume.innerHTML = volumes.map(function (row) {
        var value = row.valeur_transigee != null ? row.valeur_transigee : (row.valeur_totale != null ? row.valeur_totale : row.valeur);
        return '<tr><td><strong style="color:var(--gold)">' + esc(courseTicker(row)) + '</strong></td><td class="right">' + money(row.volume) + '</td><td class="right">' + money(coursePrice(row)) + '</td><td class="right">' + pct(courseVariation(row)) + '</td><td class="right">' + money(value) + ' FCFA</td></tr>';
      }).join('') || '<tr><td colspan="5">Aucune donnée</td></tr>';
    }
  }

  function renderIndicesChart() {
    var canvas = document.getElementById('marche-chartIndices');
    if (!canvas || typeof Chart === 'undefined') return;
    var history = Array.isArray(window.allIndicesHistory) ? window.allIndicesHistory.slice() : [];
    history = history.filter(function (r) {
      return String(r.indice || '').toUpperCase().indexOf('COMPOSITE') !== -1;
    });
    history.sort(function (a, b) { return String(a.date_seance || '').localeCompare(String(b.date_seance || '')); });
    history = history.slice(-indexPeriod);
    if (window.tcMarcheIndexChart) window.tcMarcheIndexChart.destroy();
    if (history.length < 2) return;
    window.tcMarcheIndexChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: history.map(function (r) { return dateLabel(r.date_seance); }),
        datasets: [{
          label: 'BRVM Composite',
          data: history.map(function (r) { return num(r.valeur); }),
          borderColor: '#B8964E',
          backgroundColor: 'rgba(184,150,78,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { beginAtZero: false } }
      }
    });
  }

  function renderDividends() {
    var body = document.getElementById('marche-dividendesTable');
    if (!body) return;
    var rows = Array.isArray(window.allDividendes) ? window.allDividendes.slice() : [];
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty-state">Aucune donnée de dividende disponible.</div></td></tr>';
      return;
    }
    rows.sort(function (a, b) { return String(a.ticker || '').localeCompare(String(b.ticker || '')); });
    body.innerHTML = rows.slice(0, 200).map(function (row) {
      var ticker = String(row.ticker || row.symbol || '').toUpperCase();
      var priceRow = getCours().find(function (c) { return courseTicker(c) === ticker; });
      var price = priceRow ? coursePrice(priceRow) : null;
      var dpa = row.dpa != null ? row.dpa : (row.dividende_par_action != null ? row.dividende_par_action : (row.dividende != null ? row.dividende : row.montant));
      var yieldPct = row.rendement != null ? row.rendement : (price && num(dpa) != null ? num(dpa) / num(price) * 100 : null);
      var bpa = row.bpa != null ? row.bpa : row.eps;
      var payout = row.taux_distribution != null ? row.taux_distribution : (bpa && num(dpa) != null ? num(dpa) / num(bpa) * 100 : null);
      var year = row.exercice || row.annee || row.year || '—';
      return '<tr><td><strong style="color:var(--gold)">' + esc(ticker) + '</strong></td>' +
        '<td>' + esc(companyName(ticker)) + '</td>' +
        '<td class="right">' + money(price) + '</td>' +
        '<td class="right">' + money(dpa) + '</td>' +
        '<td class="right">' + pct(yieldPct) + '</td>' +
        '<td class="right">' + money(bpa) + '</td>' +
        '<td class="right">' + pct(payout) + '</td>' +
        '<td class="right">' + esc(year) + '</td></tr>';
    }).join('');
  }

  function publicationText(row) {
    return String([
      row.titre, row.title, row.type, row.categorie, row.category,
      row.libelle, row.reference, row.description, row.numero, row.objet
    ].filter(Boolean).join(' ')).toLowerCase();
  }

  function renderPublications() {
    var grid = document.getElementById('marche-pubGrid');
    if (!grid) return;
    var rows = Array.isArray(window.allBoc) ? window.allBoc.slice() : [];
    var q = pubQuery.trim().toLowerCase();
    rows = rows.filter(function (row) {
      var text = publicationText(row);
      if (q && text.indexOf(q) === -1) return false;
      if (pubFilter === 'obligation') return text.indexOf('oblig') !== -1;
      if (pubFilter === 'action') return text.indexOf('action') !== -1;
      if (pubFilter === 'opcvm') return text.indexOf('opcvm') !== -1 || text.indexOf('fcp') !== -1;
      return true;
    }).slice(0, 60);

    if (!rows.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-title">Aucune publication</div><div class="empty-text">Les bulletins officiels apparaîtront ici dès qu’ils sont disponibles.</div></div>';
      return;
    }

    grid.innerHTML = rows.map(function (row) {
      var date = row.date || row.date_publication || row.date_seance || row.created_at;
      var title = row.titre || row.title || row.objet || row.description || row.reference || ('BOC ' + (row.numero || ''));
      var type = row.type || row.categorie || row.category || 'Publication BRVM';
      var url = row.url || row.pdf_url || row.document_url || row.lien || row.link;
      var action = url ? '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">Ouvrir</a>' : '';
      return '<div class="boc-card"><div class="boc-header"><div><div class="boc-title">' + esc(title) + '</div><div class="boc-meta">' + esc(type) + ' · ' + esc(dateLabel(date)) + '</div></div></div><div class="boc-body"><div>' + esc(row.numero ? 'N° ' + row.numero : '') + '</div>' + action + '</div></div>';
    }).join('');
  }

  function renderCalendar() {
    var list = document.getElementById('marche-calendrierList');
    if (!list) return;
    var events = [];
    (Array.isArray(window.allDividendes) ? window.allDividendes : []).forEach(function (r) {
      var ticker = String(r.ticker || '').toUpperCase();
      var d = r.date_detachement || r.date_detachement_dividende || r.ex_date;
      if (d) events.push({ date: d, ticker: ticker, label: 'Détachement dividende', amount: r.dpa || r.dividende });
      var p = r.date_paiement;
      if (p) events.push({ date: p, ticker: ticker, label: 'Paiement dividende', amount: r.dpa || r.dividende });
    });
    (Array.isArray(window.allCoupons) ? window.allCoupons : []).forEach(function (r) {
      var ticker = String(r.ticker || r.symbol || '').toUpperCase();
      var d = r.date_detachement || r.date_detachement_coupon || r.ex_date;
      if (d) events.push({ date: d, ticker: ticker, label: 'Détachement coupon', amount: r.coupon || r.montant });
    });
    events = events.filter(function (e) { return e.date; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).slice(0, 12);
    list.innerHTML = events.length ? events.map(function (e) {
      return '<div class="pub-ticker-card"><span class="pub-check">•</span><span class="pub-ticker">' + esc(dateLabel(e.date)) + '</span><span class="pub-name"><strong>' + esc(e.ticker || 'Marché') + '</strong> · ' + esc(e.label) + (e.amount != null ? ' · ' + money(e.amount) + ' FCFA' : '') + '</span></div>';
    }).join('') : '<div class="empty-state"><div class="empty-title">Aucun événement à venir</div><div class="empty-text">Les détachements et paiements seront affichés automatiquement.</div></div>';
  }

  function renderSessionStats(cours) {
    var box = document.getElementById('marche-seanceStats');
    var date = document.getElementById('marche-coursDate');
    if (date) date.textContent = cours.length ? dateLabel(cours[0].date_seance) : '—';
    if (!box) return;
    var totalVolume = cours.reduce(function (sum, r) { return sum + (num(r.volume) || 0); }, 0);
    var totalValue = cours.reduce(function (sum, r) { return sum + (num(r.valeur_transigee != null ? r.valeur_transigee : r.valeur_totale) || 0); }, 0);
    var up = cours.filter(function (r) { return (courseVariation(r) || 0) > 0; }).length;
    var down = cours.filter(function (r) { return (courseVariation(r) || 0) < 0; }).length;
    var flat = cours.length - up - down;
    box.innerHTML = '<div class="grid-2" style="margin-bottom:0">' +
      '<div><div class="stat-label">Volume</div><div class="stat-value">' + money(totalVolume) + '</div></div>' +
      '<div><div class="stat-label">Valeur échangée</div><div class="stat-value">' + money(totalValue) + '</div></div>' +
      '<div><div class="stat-label">Hausse</div><div class="stat-value" style="color:var(--green)">' + up + '</div></div>' +
      '<div><div class="stat-label">Baisse</div><div class="stat-value" style="color:var(--red)">' + down + '</div></div>' +
    '</div><div style="margin-top:12px;color:var(--dim);font-size:11px">Stables : ' + flat + '</div>';
  }

  function setFilterButtons(activeId) {
    document.querySelectorAll('#view-marche .filter-btn[data-marche-filter]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.marcheFilter === activeId);
    });
  }

  function injectMarketCss() {
    if (document.getElementById('tc-market-ux-css')) return;
    var s=document.createElement('style'); s.id='tc-market-ux-css';
    s.textContent=[
      '#view-marche .market-hero{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(4,minmax(135px,1fr));gap:12px;margin-bottom:18px}',
      '#view-marche .market-hero-main,#view-marche .market-kpi{border:1px solid var(--border2);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015));padding:17px;box-shadow:0 8px 28px rgba(0,0,0,.12)}',
      '#view-marche .market-eyebrow{font-size:10px;color:var(--gold);letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:7px}',
      '#view-marche .market-hero h1{margin:0 0 6px;font-size:28px;letter-spacing:-.03em}',
      '#view-marche .market-hero p{margin:0;color:var(--dim);font-size:12px;line-height:1.5}',
      '#view-marche .market-kpi-label{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}',
      '#view-marche .market-kpi-value{font-size:21px;font-weight:750;margin-top:7px}',
      '#view-marche .market-kpi-note{font-size:10px;color:var(--dim);margin-top:4px}',
      '#view-marche .market-breadth{display:flex;height:7px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.05);margin-top:9px}',
      '#view-marche .market-breadth-up{background:var(--green)} #view-marche .market-breadth-down{background:var(--red)} #view-marche .market-breadth-flat{background:var(--muted)}',
      '#view-marche .market-section-head{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:10px}',
      '#view-marche .market-section-meta{font-size:10px;color:var(--dim)}',
      '#view-marche .market-table thead th{position:sticky;top:0;z-index:2;background:var(--surface,#111)}',
      '#view-marche .market-sort{cursor:pointer;user-select:none;white-space:nowrap}',
      '#view-marche .market-sort:hover{color:var(--gold)}',
      '#view-marche .market-sort-ind{font-size:9px;color:var(--gold);margin-left:3px}',
      '#view-marche .market-ticker{color:var(--gold);font-weight:750;cursor:pointer}',
      '#view-marche .market-ticker:hover{text-decoration:underline}',
      '#view-marche .market-table tbody tr{transition:background .15s ease}',
      '#view-marche .market-table tbody tr:hover{background:rgba(196,157,83,.05)}',
      '#view-marche .market-signal{font-size:9px;border:1px solid;border-radius:999px;padding:3px 7px;white-space:nowrap}',
      '#view-marche .market-signal.up{color:var(--green);border-color:rgba(74,222,128,.3)}',
      '#view-marche .market-signal.down{color:var(--red);border-color:rgba(248,113,113,.3)}',
      '#view-marche .market-signal.flat{color:var(--dim);border-color:var(--border2)}',
      '#view-marche .market-quick{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}',
      '#view-marche .market-quick button{border:1px solid var(--border2);background:transparent;color:var(--dim);border-radius:8px;padding:7px 10px;cursor:pointer;font-size:10px}',
      '#view-marche .market-quick button:hover{color:var(--gold);border-color:var(--gold)}',
      '@media(max-width:1150px){#view-marche .market-hero{grid-template-columns:1fr 1fr}#view-marche .market-hero-main{grid-column:1/-1}}',
      '@media(max-width:700px){#view-marche .market-hero{grid-template-columns:1fr}#view-marche .market-hero-main{grid-column:auto}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderMarketShell(container) {
    injectMarketCss();
    var cours = getCours();
    var composite = getIndex(['COMPOSITE']);
    var brvm30 = getIndex(['BRVM-30', 'BRVM 30', '30']);
    var prestige = getIndex(['PRESTIGE']);

    container.innerHTML = '' +
      '<div class="page-content">' +
        '<section class="market-hero">' +
          '<div class="market-hero-main"><div class="market-eyebrow">The Capital · Market Intelligence</div><h1>Marché <span style="color:var(--gold)">BRVM</span></h1><p>Vue consolidée de la séance : indices, breadth, liquidité, mouvements, dividendes et publications.</p><div class="market-quick"><button type="button" data-market-scroll="cours">Cours</button><button type="button" data-market-scroll="palmares">Palmarès</button><button type="button" data-market-scroll="dividendes">Dividendes</button><button type="button" data-market-scroll="publications">Publications</button></div></div>' +
          '<div class="market-kpi"><div class="market-kpi-label">Titres</div><div class="market-kpi-value" id="marketKpiTitles">—</div><div class="market-kpi-note">univers de cotation</div></div>' +
          '<div class="market-kpi"><div class="market-kpi-label">Volume</div><div class="market-kpi-value" id="marketKpiVolume">—</div><div class="market-kpi-note">titres échangés</div></div>' +
          '<div class="market-kpi"><div class="market-kpi-label">Capitalisation</div><div class="market-kpi-value" id="marketKpiCapitalisation">—</div><div class="market-kpi-note">somme disponible</div></div>' +
          '<div class="market-kpi"><div class="market-kpi-label">Leader séance</div><div class="market-kpi-value" id="marketKpiLeader">—</div><div class="market-kpi-note" id="marketKpiLeaderNote">—</div></div>' +
          '<div class="market-kpi" style="grid-column:1/-1"><div class="market-kpi-label">Breadth de la séance</div><div class="market-kpi-value" style="font-size:13px" id="marketKpiBreadth">—</div><div class="market-breadth" id="marketHeroBreadth"></div></div>' +
        '</section>' +
        '<div class="page-header"><h1 style="display:none">Marché BRVM</h1></div>' +
        '<div class="section" id="indices">' +
          '<div class="section-title">Cours des Indices</div><div class="section-sub">Évolution des indices de référence de la BRVM</div>' +
          '<div class="grid-3 mb20">' + indexCard('BRVM Composite', composite) + indexCard('BRVM 30', brvm30) + indexCard('BRVM Prestige', prestige) + '</div>' +
          '<div class="card mb20"><div class="card-header"><div class="card-title">BRVM Composite, Historique</div><div style="display:flex;gap:6px">' +
            '<button class="filter-btn active" data-marche-filter="index-30" type="button">1M</button>' +
            '<button class="filter-btn" data-marche-filter="index-90" type="button">3M</button>' +
            '<button class="filter-btn" data-marche-filter="index-252" type="button">1A</button>' +
          '</div></div><div class="card-body"><div class="chart-container tall"><canvas id="marche-chartIndices"></canvas></div></div></div>' +
        '</div>' +
        '<div class="section" id="cours">' +
          '<div class="section-title">Cours des Actions</div><div class="section-sub">Cotations des sociétés listées à la BRVM</div>' +
          '<div class="search-bar"><input class="search-input" id="marche-searchCours" placeholder="🔍 Rechercher un titre..." autocomplete="off">' +
            '<button class="filter-btn active" data-marche-filter="course-all" type="button">Tous</button>' +
            '<button class="filter-btn" data-marche-filter="course-up" type="button">Hausse</button>' +
            '<button class="filter-btn" data-marche-filter="course-down" type="button">Baisse</button>' +
            '<button class="filter-btn" data-marche-filter="course-banque" type="button">Banque</button>' +
            '<button class="filter-btn" data-marche-filter="course-agro" type="button">Agro</button>' +
            '<button class="filter-btn" data-marche-filter="course-industrie" type="button">Industrie</button>' +
            '<button class="filter-btn" data-marche-filter="course-telecom" type="button">Telecom</button>' +
          '</div>' +
          '<div class="card"><div class="card-header"><div class="card-title">Séance du <span id="marche-coursDate">—</span></div><div style="font-size:12px;color:var(--dim)" id="marche-coursCount">—</div></div>' +
            '<div class="table-wrap"><table class="market-table"><thead><tr><th class="market-sort" data-market-sort="ticker">Ticker <span class="market-sort-ind"></span></th><th>Société</th><th class="right market-sort" data-market-sort="price">Cours <span class="market-sort-ind"></span></th><th class="right market-sort" data-market-sort="variation">Variation <span class="market-sort-ind">↓</span></th><th class="right">+ Haut</th><th class="right">+ Bas</th><th class="right market-sort" data-market-sort="volume">Volume <span class="market-sort-ind"></span></th><th class="right market-sort" data-market-sort="capitalisation">Capitalisation <span class="market-sort-ind"></span></th><th>Secteur</th></tr></thead><tbody id="marche-coursTable"></tbody></table></div></div>' +
        '</div>' +
        '<div class="section" id="palmares">' +
          '<div class="section-title">Palmarès</div><div class="section-sub">Meilleures et moins bonnes performances de la séance</div>' +
          '<div class="grid-2"><div class="card"><div class="card-header"><div class="card-title">🟢 Top Hausses</div></div><div class="table-wrap"><table><thead><tr><th>Titre</th><th class="right">Cours</th><th class="right">Variation</th><th class="right">Volume</th></tr></thead><tbody id="marche-topHausses"></tbody></table></div></div>' +
          '<div class="card"><div class="card-header"><div class="card-title">🔴 Top Baisses</div></div><div class="table-wrap"><table><thead><tr><th>Titre</th><th class="right">Cours</th><th class="right">Variation</th><th class="right">Volume</th></tr></thead><tbody id="marche-topBaisses"></tbody></table></div></div></div>' +
          '<div class="card mb20"><div class="card-header"><div class="card-title">📊 Top Volumes échangés</div></div><div class="table-wrap"><table><thead><tr><th>Titre</th><th class="right">Volume</th><th class="right">Cours</th><th class="right">Variation</th><th class="right">Valeur échangée</th></tr></thead><tbody id="marche-topVolumes"></tbody></table></div></div>' +
        '</div>' +
        '<div class="section" id="dividendes">' +
          '<div class="section-title">Dividendes</div><div class="section-sub">Distributions connues des sociétés cotées</div>' +
          '<div class="card"><div class="card-header"><div class="card-title">Dividendes par titre</div><div style="font-size:12px;color:var(--dim)">DPA = Dividende Par Action</div></div><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Société</th><th class="right">Cours actuel</th><th class="right">DPA (FCFA)</th><th class="right">Rendement</th><th class="right">BPA</th><th class="right">Taux distribution</th><th class="right">Exercice</th></tr></thead><tbody id="marche-dividendesTable"></tbody></table></div></div>' +
        '</div>' +
        '<div class="section" id="publications">' +
          '<div class="section-title">Publications Officielles</div><div class="section-sub">Avis et bulletins officiels disponibles dans les données de la plateforme</div>' +
          '<div class="search-bar"><input class="search-input" id="marche-searchPub" placeholder="🔍 Rechercher une publication..." autocomplete="off">' +
            '<button class="filter-btn active" data-marche-filter="pub-all" type="button">Toutes</button>' +
            '<button class="filter-btn" data-marche-filter="pub-obligation" type="button">Obligations</button>' +
            '<button class="filter-btn" data-marche-filter="pub-action" type="button">Actions</button>' +
            '<button class="filter-btn" data-marche-filter="pub-opcvm" type="button">OPCVM</button>' +
          '</div><div class="boc-grid" id="marche-pubGrid"></div>' +
        '</div>' +
        '<div class="section" id="calendrier">' +
          '<div class="section-title">Calendrier des Évènements</div><div class="section-sub">Détachements, paiements et coupons issus des données disponibles</div>' +
          '<div class="grid-2"><div class="card"><div class="card-header"><div class="card-title">Prochains évènements</div></div><div id="marche-calendrierList"></div></div>' +
          '<div class="card"><div class="card-header"><div class="card-title">Statistiques de la séance</div></div><div class="card-body" id="marche-seanceStats"></div></div></div>' +
        '</div>' +
      '</div>';

    bindMarketEvents();
    refreshMarket(cours);
  }

  function renderMarketHero(cours) {
    var up=cours.filter(function(r){return (courseVariation(r)||0)>0;}).length;
    var down=cours.filter(function(r){return (courseVariation(r)||0)<0;}).length;
    var flat=cours.length-up-down;
    var totalVol=cours.reduce(function(s,r){return s+(num(r.volume)||0);},0);
    var cap=cours.reduce(function(s,r){return s+(num(r.capitalisation)||0);},0);
    var best=moverRows(cours.filter(function(r){return (courseVariation(r)||0)>0;}),true)[0];
    var el=document.getElementById('marketHeroBreadth');
    if(el){
      var total=cours.length||1;
      el.innerHTML='<span class="market-breadth-up" style="width:'+up/total*100+'%"></span><span class="market-breadth-flat" style="width:'+flat/total*100+'%"></span><span class="market-breadth-down" style="width:'+down/total*100+'%"></span>';
    }
    var set=function(id,value){var x=document.getElementById(id);if(x)x.textContent=value;};
    set('marketKpiTitles',cours.length);
    set('marketKpiVolume',money(totalVol));
    set('marketKpiCapitalisation',money(cap));
    set('marketKpiLeader',best?courseTicker(best):'—');
    set('marketKpiBreadth',up+' hausse · '+flat+' stable · '+down+' baisse');
    set('marketKpiLeaderNote',best?pct(courseVariation(best)):'Aucune hausse');
  }

  function bindMarketEvents() {
    document.querySelectorAll('#view-marche [data-market-sort]').forEach(function(th){
      th.addEventListener('click',function(){
        var key=th.dataset.marketSort;
        if(courseSort.key===key) courseSort.dir*=-1; else {courseSort.key=key;courseSort.dir=-1;}
        document.querySelectorAll('#view-marche .market-sort-ind').forEach(function(x){x.textContent='';});
        var ind=th.querySelector('.market-sort-ind'); if(ind) ind.textContent=courseSort.dir===-1?'↓':'↑';
        renderCourses(getCours());
      });
    });
    document.querySelectorAll('#view-marche [data-market-scroll]').forEach(function(b){
      b.addEventListener('click',function(){var target=document.getElementById(b.dataset.marketScroll);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
    });
    document.querySelectorAll('#view-marche .market-ticker').forEach(function(el){
      el.addEventListener('click',function(){window.setMarcheTicker(el.dataset.marketTicker);});
    });
    var search = document.getElementById('marche-searchCours');
    if (search) search.addEventListener('input', function () { courseQuery = search.value || ''; renderCourses(getCours()); });

    var pubSearch = document.getElementById('marche-searchPub');
    if (pubSearch) pubSearch.addEventListener('input', function () { pubQuery = pubSearch.value || ''; renderPublications(); });

    document.querySelectorAll('#view-marche .filter-btn[data-marche-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        var f = button.dataset.marcheFilter || '';
        if (f.indexOf('course-') === 0) {
          courseFilter = f.slice(7);
          setFilterButtons(f);
          renderCourses(getCours());
          return;
        }
        if (f.indexOf('pub-') === 0) {
          pubFilter = f.slice(4);
          setFilterButtons(f);
          renderPublications();
          return;
        }
        if (f.indexOf('index-') === 0) {
          indexPeriod = Number(f.slice(6)) || 30;
          setFilterButtons(f);
          renderIndicesChart();
        }
      });
    });
  }

  function refreshMarket(cours) {
    renderMarketHero(cours);
    renderCourses(cours);
    renderMovers(cours);
    renderDividends();
    renderPublications();
    renderCalendar();
    renderSessionStats(cours);
    renderIndicesChart();
  }

  window.renderMarche = function () {
    var container = document.getElementById('view-marche');
    if (!container) return;
    renderMarketShell(container);
  };

  // Compatibility helpers for existing integrations. They operate only inside the market view.
  window.filterCours = function () { renderCourses(getCours()); };
  window.setCoursFilter = function (filter, button) {
    courseFilter = String(filter || 'all');
    if (button) setFilterButtons('course-' + courseFilter);
    renderCourses(getCours());
  };
  window.filterPub = function () { renderPublications(); };

  window.setMarcheTicker = function (ticker) {
    selectedTicker = String(ticker || '').trim().toUpperCase();
    if (!selectedTicker) return;
    window.location.hash = '#fiche=' + encodeURIComponent(selectedTicker);
  };

  window.setIdxPeriod = function (days, button) {
    indexPeriod = Number(days) || 30;
    if (button) {
      document.querySelectorAll('#view-marche #marche-idxPeriodBtns .filter-btn').forEach(function (b) { b.classList.remove('active'); });
      button.classList.add('active');
    }
    renderIndicesChart();
  };

  window.setMarchePeriod = function (days) {
    indexPeriod = Number(days) || 30;
    renderIndicesChart();
  };

  window.addEventListener('tc:dataready', function (event) {
    if (!document.getElementById('view-marche')) return;
    var active = document.getElementById('view-marche');
    if (!active.classList.contains('active')) return;
    refreshMarket(getCours());
  });

  console.log('[MARCHE] Vue marché unifiée chargée');
})();
