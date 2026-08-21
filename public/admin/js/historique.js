(function(){
  var s=document.currentScript;
  if(!s) return;
  var name=(s.src.split('/').pop()||'').split('?')[0];
  var folders={
    'api.js':'core','config.js':'core','main.js':'core','utils.js':'core',
    'admin-cours-historique-unified.js':'historique',
    'analyses.js':'analyses',
    'boc-admin.js':'boc','boc-importer.js':'boc',
    'clientele-advanced.js':'utilisateurs',
    'cours.js':'cours','cours-control.js':'cours','cours-control-editor.js':'cours','cours-historique.js':'historique','cours-history-entry-delete.js':'historique',
    'dashboard.js':'dashboard','dashboard-overview.js':'dashboard',
    'diagnostic.js':'diagnostic',
    'dividendes.js':'dividendes',
    'entreprises.js':'entreprises',
    'financials.js':'financials',
    'historique.js':'historique','historique-quality.js':'historique','historique-session-delete.js':'seances',
    'import.js':'imports',
    'indices.js':'indices',
    'scraper.js':'scraper',
    'seance.js':'seances','seances-annuel.js':'seances','seances-crud.js':'seances','seances-details.js':'seances','seances-globales-actions.js':'seances','seances-globales.js':'seances','seances-integrity-hardening.js':'seances',
    'utilisateurs.js':'utilisateurs'
  };
  var folder=folders[name];
  if(!folder) return;
  document.write('<script src="admin/js/'+folder+'/'+name+'"><\\/script>');
})();