/* THE CAPITAL — Cours & Historique BRVM — Control Center
   Single interface for market-course operations.
   Business rules, validation, API calls and CRUD remain in cours.js.
*/
(function () {
  'use strict';

  var mounted = false;
  var state = { view: 'data', ticker: '', date: '', status: 'all' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[c];
    });
  }

  function num(value) {
    var n = parseFloat(String(value == null ? '' : value).replace(/\s/g, '').replace(/,/g, '.'));
    return isFinite(n) ? n : null;
  }

  function rows() {
    return Array.prototype.slice.call(document.querySelectorAll('#cours-tbody tr'))
      .filter(function (row) { return row.querySelector('td') && !row.querySelector('.loading'); })
      .map(function (row) {
        var c = row.querySelectorAll('td');
        return {
          ticker: (c[1] && c[1].textContent || '').trim(),
          date: (c[2] && c[2].textContent || '').trim(),
          price: num(c[3] && c[3].textContent),
          volume: num(c[7] && c[7].textContent),
          variation: num(c[8] && c[8].textContent)
        };
      });
  }

  function currentRows() {
    return rows().filter(function (r) {
      return (!state.ticker || r.ticker.toLowerCase().indexOf(state.ticker.toLowerCase()) !== -1) &&
        (!state.date || r.date === state.date) &&
        (state.status === 'all' ||
          (state.status === 'positive' && r.variation !== null && r.variation > 0) ||
          (state.status === 'negative' && r.variation !== null && r.variation < 0) ||
          (state.status === 'flat' && r.variation !== null && r.variation === 0));
    });
  }

  function injectCss() {
    if (document.getElementById('tc-control-runtime-css')) return;
    var style = document.createElement('style');
    style.id = 'tc-control-runtime-css';
    style.textContent =
      '#tc-control .cc-toolbar input,#tc-control .cc-toolbar select{background:var(--bg)!important;color:var(--cream)!important;border-color:var(--border)!important;color-scheme:dark;}\n' +
      '#tc-control .cc-form{padding:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}\n' +
      '#tc-control .cc-field{display:flex;flex-direction:column;gap:6px;}\n' +
      '#tc-control .cc-field label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;}\n' +
      '#tc-control .cc-field input{width:100%;box-sizing:border-box;background:var(--bg);color:var(--cream);border:1px solid var(--border);padding:10px;border-radius:3px;}\n' +
      '#tc-control .cc-actions{display:flex;gap:8px;align-items:center;padding:0 18px 18px;flex-wrap:wrap;}\n' +
      '#tc-control .cc-msg{font-size:10px;}\n' +
      '#tc-control .cc-import-note{margin:0 18px 18px;padding:12px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:11px;line-height:1.6;}\n' +
      '#tc-control .cc-import-note strong{color:var(--cream);}\n' +
      '#tc-control .cc-empty{min-height:160px;}\n' +
      '@media(max-width:900px){#tc-control .cc-form{grid-template-columns:repeat(2,minmax(0,1fr));}}\n' +
      '@media(max-width:600px){#tc-control .cc-form{grid-template-columns:1fr;}.cc-kpis{grid-template-columns:repeat(2,1fr)!important;}}\n';
    document.head.appendChild(style);
  }

  function mount() {
    if (mounted) return;
    var panel = document.getElementById('panel-cours');
    if (!panel) return;

    mounted = true;
    injectCss();

    /* Rebuild the panel from one source. Nothing from the former UI is moved, wrapped or hidden. */
    panel.innerHTML = '';

    var root = document.createElement('div');
    root.id = 'tc-control';
    root.className = 'cours-control';
    root.innerHTML =
      '<div class="cc-header">' +
        '<div>' +
          '<div class="cc-eyebrow">THE CAPITAL · BRVM DATA CENTER</div>' +
          '<h1>Cours &amp; Historique <em>BRVM</em></h1>' +
          '<p>Poste de pilotage unique pour contrôler les cours, gérer les séances, importer l’historique et corriger les données. Les règles de validation et les appels de données existants restent inchangés.</p>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
          '<button class="cc-btn" id="cc-import">Importer Excel</button>' +
          '<button class="cc-primary" id="cc-refresh">Actualiser</button>' +
        '</div>' +
      '</div>' +
      '<div class="cc-kpis" id="cc-kpis"></div>' +
      '<div class="cc-toolbar">' +
        '<input id="cours-filter" placeholder="Ticker / société" aria-label="Filtrer par ticker">' +
        '<input id="cours-date-filter" type="date" aria-label="Filtrer par date">' +
        '<select id="cc-status" aria-label="Filtrer par variation">' +
          '<option value="all">Toutes variations</option>' +
          '<option value="positive">Hausses</option>' +
          '<option value="negative">Baisses</option>' +
          '<option value="flat">Stables</option>' +
        '</select>' +
        '<button class="cc-btn" id="cc-reset">Réinitialiser</button>' +
      '</div>' +
      '<div class="cc-tabs" id="cc-tabs">' +
        '<button class="active" data-view="data">Données</button>' +
        '<button data-view="add">Ajouter un cours</button>' +
        '<button data-view="analysis">Analyse</button>' +
        '<button data-view="import">Import historique</button>' +
      '</div>' +
      '<div class="cc-body" id="cc-body"></div>' +
      '<div id="modal-cours" class="cc-modal" style="display:none" role="dialog" aria-modal="true">' +
        '<div class="cc-modal-box">' +
          '<div class="cc-modal-head"><div><span>MODIFICATION</span><h2>Cours <small id="modal-cours-info"></small></h2></div><button type="button" onclick="closeModal(\'modal-cours\')" aria-label="Fermer">×</button></div>' +
          '<input type="hidden" id="modal-cours-id">' +
          '<div class="cc-edit-grid">' +
            '<div><label>Clôture</label><input type="number" step="any" id="modal-cours-val"></div>' +
            '<div><label>Ouverture</label><input type="number" step="any" id="modal-cours-ouv"></div>' +
            '<div><label>Plus haut</label><input type="number" step="any" id="modal-cours-haut"></div>' +
            '<div><label>Plus bas</label><input type="number" step="any" id="modal-cours-bas"></div>' +
            '<div><label>Volume</label><input type="number" step="1" id="modal-cours-vol"></div>' +
            '<div><label>Variation %</label><input type="number" step="any" id="modal-cours-var"></div>' +
            '<div><label>Valeur totale</label><input type="number" step="any" id="modal-cours-capi"></div>' +
          '</div>' +
          '<p class="cc-edit-note">La modification passe par la logique de validation existante de Cours. Aucun endpoint, aucune table et aucune règle métier n’est remplacé.</p>' +
          '<div class="cc-modal-actions"><span id="modal-cours-msg"></span><button class="cc-btn" onclick="closeModal(\'modal-cours\')">Annuler</button><button class="cc-primary" onclick="window.CoursApp.saveCours()">Enregistrer</button></div>' +
        '</div>' +
      '</div>';

    panel.appendChild(root);
    bindToolbar();
    bindTabs();
    renderView();

    if (window.CoursApp && typeof window.CoursApp.loadCours === 'function') {
      window.CoursApp.loadCours();
      setTimeout(updateKpis, 700);
      setTimeout(updateKpis, 1600);
    }
  }

  function bindToolbar() {
    var ticker = document.getElementById('cours-filter');
    var date = document.getElementById('cours-date-filter');
    var status = document.getElementById('cc-status');

    [ticker, date].forEach(function (el) {
      if (el) el.addEventListener('input', function () {
        state.ticker = ticker.value;
        state.date = date.value;
        if (window.CoursApp && typeof window.CoursApp.filterCoursTable === 'function') window.CoursApp.filterCoursTable();
        updateKpis();
        if (state.view === 'analysis') renderAnalysis(document.getElementById('cc-body'));
      });
    });

    if (status) status.addEventListener('change', function () {
      state.status = status.value;
      updateKpis();
      if (state.view === 'analysis') renderAnalysis(document.getElementById('cc-body'));
    });

    document.getElementById('cc-reset').onclick = function () {
      state = { view: 'data', ticker: '', date: '', status: 'all' };
      ticker.value = '';
      date.value = '';
      status.value = 'all';
      if (window.CoursApp && typeof window.CoursApp.loadCours === 'function') window.CoursApp.loadCours();
      renderView();
    };

    document.getElementById('cc-refresh').onclick = function () {
      if (window.CoursApp && typeof window.CoursApp.loadCours === 'function') window.CoursApp.loadCours();
      setTimeout(updateKpis, 700);
    };

    document.getElementById('cc-import').onclick = openImportTab;
  }

  function bindTabs() {
    document.querySelectorAll('#cc-tabs button').forEach(function (button) {
      button.onclick = function () {
        document.querySelectorAll('#cc-tabs button').forEach(function (b) { b.classList.remove('active'); });
        button.classList.add('active');
        state.view = button.getAttribute('data-view');
        renderView();
      };
    });
  }

  function openImportTab() {
    var button = document.querySelector('#cc-tabs button[data-view="import"]');
    if (button) button.click();
  }

  function updateKpis() {
    var all = rows();
    var visible = currentRows();
    var positive = visible.filter(function (r) { return r.variation !== null && r.variation > 0; }).length;
    var negative = visible.filter(function (r) { return r.variation !== null && r.variation < 0; }).length;
    var volume = visible.reduce(function (sum, r) { return sum + (r.volume || 0); }, 0);
    var k = document.getElementById('cc-kpis');
    if (!k) return;
    k.innerHTML =
      '<div class="cc-kpi"><div>Données chargées</div><strong>' + all.length.toLocaleString('fr-FR') + '</strong><small>Lignes en mémoire</small></div>' +
      '<div class="cc-kpi"><div>Dans le périmètre</div><strong>' + visible.length.toLocaleString('fr-FR') + '</strong><small>Après filtres</small></div>' +
      '<div class="cc-kpi"><div>Hausses</div><strong>' + positive + '</strong><small>Variation positive</small></div>' +
      '<div class="cc-kpi"><div>Baisses</div><strong>' + negative + '</strong><small>Variation négative</small></div>' +
      '<div class="cc-kpi"><div>Volume</div><strong>' + Math.round(volume).toLocaleString('fr-FR') + '</strong><small>Titres échangés</small></div>';
  }

  function renderView() {
    var body = document.getElementById('cc-body');
    if (!body) return;
    updateKpis();
    if (state.view === 'add') return renderAdd(body);
    if (state.view === 'analysis') return renderAnalysis(body);
    if (state.view === 'import') return renderImport(body);
    renderData(body);
  }

  function renderData(body) {
    body.innerHTML =
      '<div class="cc-table-wrap">' +
        '<table class="cc-table">' +
          '<thead><tr>' +
            '<th></th><th>Ticker</th><th>Date</th><th class="num">Clôture</th><th class="num">Ouverture</th><th class="num">Haut</th><th class="num">Bas</th><th class="num">Volume</th><th class="num">Variation</th><th class="num">Valeur</th><th>52 sem.</th><th>Actions</th>' +
          '</tr></thead>' +
          '<tbody id="cours-tbody"><tr><td colspan="12" class="cc-empty">Chargement des cours…</td></tr></tbody>' +
        '</table>' +
      '</div>' +
      '<div class="cc-foot"><span id="cours-count">0 ligne</span><span style="float:right">Sélection multiple disponible · modification et suppression par ligne</span></div>';

    if (window.CoursApp && typeof window.CoursApp.loadCours === 'function') {
      window.CoursApp.loadCours();
      setTimeout(updateKpis, 500);
    }
  }

  function renderAdd(body) {
    body.innerHTML =
      '<div class="cc-import-note"><strong>Ajouter un cours de séance.</strong> Remplis les valeurs disponibles. La validation exhaustive existante contrôle la cohérence avant écriture.</div>' +
      '<div class="cc-form">' +
        field('Ticker *', 'c-ticker', 'text', 'SNTS') +
        field('Date séance *', 'c-date', 'date', '') +
        field('Cours clôture *', 'c-cours', 'number', '') +
        field('Ouverture', 'c-ouv', 'number', '') +
        field('Plus haut', 'c-haut', 'number', '') +
        field('Plus bas', 'c-bas', 'number', '') +
        field('Volume', 'c-vol', 'number', '') +
        field('Variation %', 'c-var', 'number', '') +
        field('Valeur totale', 'c-capi', 'number', '') +
      '</div>' +
      '<div class="cc-actions">' +
        '<button class="cc-primary" id="cc-add-submit">Enregistrer le cours</button>' +
        '<button class="cc-btn" id="cc-add-clear">Vider</button>' +
        '<span class="cc-msg" id="c-msg"></span>' +
      '</div>';

    document.getElementById('c-ticker').addEventListener('input', function () { this.value = this.value.toUpperCase(); });
    document.getElementById('cc-add-submit').onclick = function () {
      if (window.CoursApp && typeof window.CoursApp.addCours === 'function') {
        window.CoursApp.addCours();
        setTimeout(updateKpis, 900);
      }
    };
    document.getElementById('cc-add-clear').onclick = function () {
      ['c-ticker','c-date','c-cours','c-ouv','c-haut','c-bas','c-vol','c-var','c-capi'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = '';
      });
      var msg = document.getElementById('c-msg'); if (msg) msg.textContent = '';
    };
  }

  function field(label, id, type, placeholder) {
    return '<div class="cc-field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" step="any" placeholder="' + placeholder + '"></div>';
  }

  function renderImport(body) {
    body.innerHTML =
      '<div class="cc-import-note" style="margin:18px">' +
        '<strong>Import historique BRVM.</strong><br>' +
        'Le moteur d’import Excel existant reste inchangé. Utilise le centre d’import Admin pour sélectionner le fichier, contrôler les colonnes, lancer les validations et enregistrer les lignes.' +
      '</div>' +
      '<div class="cc-actions" style="padding-top:0">' +
        '<button class="cc-primary" id="cc-open-import">Ouvrir Import Excel</button>' +
        '<span class="cc-msg">Les données existantes et les règles de validation ne sont pas modifiées par cette navigation.</span>' +
      '</div>';
    document.getElementById('cc-open-import').onclick = function () {
      if (typeof switchTab === 'function') switchTab('import', document.querySelector('.admin-tab[onclick*="import"]'));
    };
  }

  function renderAnalysis(body) {
    var data = currentRows();
    var pos = data.filter(function (r) { return r.variation > 0; }).length;
    var neg = data.filter(function (r) { return r.variation < 0; }).length;
    var flat = data.filter(function (r) { return r.variation === 0; }).length;
    var total = pos + neg + flat || 1;
    var volume = data.reduce(function (sum, r) { return sum + (r.volume || 0); }, 0);
    var maxPrice = data.reduce(function (m, r) { return Math.max(m, r.price || 0); }, 0);
    var minPrice = data.reduce(function (m, r) { return Math.min(m, r.price || m); }, Infinity);
    if (!isFinite(minPrice)) minPrice = 0;

    body.innerHTML =
      '<div class="cc-health">' +
        '<div class="cc-health-card"><b>Hausses</b><strong class="cc-good">' + pos + '</strong><span>' + (pos / total * 100).toFixed(1) + '% du périmètre</span></div>' +
        '<div class="cc-health-card"><b>Baisses</b><strong class="cc-bad">' + neg + '</strong><span>' + (neg / total * 100).toFixed(1) + '% du périmètre</span></div>' +
        '<div class="cc-health-card"><b>Stables</b><strong>' + flat + '</strong><span>' + (flat / total * 100).toFixed(1) + '% du périmètre</span></div>' +
        '<div class="cc-health-list">' +
          '<h3>Lecture du périmètre courant</h3>' +
          '<div>Volume total <strong style="float:right;font-family:var(--mono)">' + Math.round(volume).toLocaleString('fr-FR') + '</strong></div>' +
          '<div>Cours maximum <strong style="float:right;font-family:var(--mono)">' + maxPrice.toLocaleString('fr-FR') + '</strong></div>' +
          '<div>Cours minimum <strong style="float:right;font-family:var(--mono)">' + minPrice.toLocaleString('fr-FR') + '</strong></div>' +
          '<div>Filtres <strong style="float:right;font-family:var(--mono)">' + esc(state.ticker || 'Tous') + ' · ' + esc(state.date || 'Toutes dates') + '</strong></div>' +
        '</div>' +
      '</div>';
  }

  function watch() {
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.TheCapitalCoursControl = { refresh: renderView };
})();
