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
    var rows = getIndicesLatest();
    for (var i = 0; i < rows.length; i += 1) {
      var key = String(rows[i].indice || rows[i].nom || rows[i].code || '').toUpperCase();
      for (var j = 0; j < names.length; j += 1) {
        if (key.indexOf(names[j]) !== -1) return rows[i];
      }
    }
    return null;
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

    filtered.sort(function (a, b) { return courseTicker(a).localeCompare(courseTicker(b)); });
    body.innerHTML = filtered.map(function (row) {
      var ticker = courseTicker(row);
      var variation = courseVariation(row);
      var variationStyle = variation > 0 ? 'var(--green)' : (variation < 0 ? 'var(--red)' : 'var(--muted)');
      return '<tr>' +
        '<td><strong style="color:var(--gold)">' + esc(ticker) + '</strong></td>' +
        '<td>' + esc(courseName(row)) + '</td>' +
        '<td class="right">' + money(coursePrice(row)) + '</td>' +
        '<td class="right" style="color:' + variationStyle + '">' + pct(variation) + '</td>' +
        '<td class="right">' + money(row.plus_haut || row.plus_high || row.high) + '</td>' +
        '<td class="right">' + money(row.plus_bas || row.plus_low || row.low) + '</td>' +
        '<td class="right">' + money(row.volume) + '</td>' +
        '<td class="right">' + money(row.capitalisation) + '</td>' +
        '<td>' + esc(row.secteur || row.sector || '—') + '</td>' +
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

  function renderMarketShell(container) {
    var cours = getCours();
    var composite = getIndex(['COMPOSITE']);
    var brvm30 = getIndex(['BRVM-30', 'BRVM 30', '30']);
    var prestige = getIndex(['PRESTIGE']);

    container.innerHTML = '' +
      '<div class="page-content">' +
        '<div class="page-header"><h1>Marché <span style="color:var(--gold)">BRVM</span></h1><p>Bourse Régionale des Valeurs Mobilières · Données de la séance · Abidjan, Côte d’Ivoire</p></div>' +
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
            '<div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Société</th><th class="right">Cours (FCFA)</th><th class="right">Variation</th><th class="right">+ Haut</th><th class="right">+ Bas</th><th class="right">Volume</th><th class="right">Capitalisation</th><th>Secteur</th></tr></thead><tbody id="marche-coursTable"></tbody></table></div></div>' +
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

  function bindMarketEvents() {
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
