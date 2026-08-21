/* Compatibility loader during admin JS architecture migration. */
(function () {
  'use strict';
  var map = {
    'admin-cours-historique-unified.js':'historique/admin-cours-historique-unified.js',
    'analyses.js':'analyses/analyses.js',
    'api.js':'core/api.js',
    'boc-admin.js':'boc/boc-admin.js',
    'boc-importer.js':'boc/boc-importer.js',
    'clientele-advanced.js':'utilisateurs/clientele-advanced.js',
    'config.js':'core/config.js',
    'cours.js':'cours/cours.js',
    'cours-control.js':'cours/cours-control.js',
    'cours-control-editor.js':'cours/cours-control-editor.js',
    'cours-historique.js':'cours/cours-historique.js',
    'cours-history-entry-delete.js':'cours/cours-history-entry-delete.js',
    'dashboard.js':'dashboard/dashboard.js',
    'dashboard-overview.js':'dashboard/dashboard-overview.js',
    'diagnostic.js':'diagnostic/diagnostic.js',
    'dividendes.js':'dividendes/dividendes.js',
    'entreprises.js':'entreprises/entreprises.js',
    'financials.js':'financials/financials.js',
    'historique.js':'historique/historique.js',
    'historique-quality.js':'historique/historique-quality.js',
    'historique-session-delete.js':'historique/historique-session-delete.js',
    'import.js':'imports/import.js',
    'indices.js':'indices/indices.js',
    'main.js':'core/main.js',
    'scraper.js':'scraper/scraper.js',
    'seance.js':'seances/seance.js',
    'seances-annuel.js':'seances/seances-annuel.js',
    'seances-crud.js':'seances/seances-crud.js',
    'seances-details.js':'seances/seances-details.js',
    'seances-globales-actions.js':'seances/seances-globales-actions.js',
    'seances-globales.js':'seances/seances-globales.js',
    'seances-integrity-hardening.js':'seances/seances-integrity-hardening.js',
    'utilisateurs.js':'utilisateurs/utilisateurs.js',
    'utils.js':'core/utils.js'
  };
  var current = (document.currentScript && document.currentScript.src || '').split('/').pop();
  var target = map[current];
  if (!target) return;
  var base = (document.currentScript.src || '').split('/public/admin/js/')[0] + '/public/admin/js/';
  var s = document.createElement('script');
  s.src = base + target;
  s.async = false;
  document.head.appendChild(s);
})();
