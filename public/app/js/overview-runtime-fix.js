/* THE CAPITAL — overview runtime reconciliation */
(function(w){
  'use strict';
  if(w.__TC_OVERVIEW_RUNTIME_FIX__) return;
  w.__TC_OVERVIEW_RUNTIME_FIX__=true;
  function cleanup(){
    document.querySelectorAll('#view-overview .dashboard-news,#view-overview #sectorHeatmap,#view-overview #pubFeed,#view-overview #alertFeed,#view-overview #watchFeed,#view-overview #coursTable').forEach(function(node){var parent=node.closest('.dashboard-news,.card');if(parent)parent.remove();else node.remove()});
    ['marketStatus','marketTime','marketNext','coursCount'].forEach(function(id){var node=document.getElementById(id);if(node&&node.closest('#view-overview'))node.remove()});
  }
  var original=w.renderOverview;
  if(typeof original!=='function'||original.__tcRuntimeReconciled)return;
  function reconciled(){var result=original.apply(this,arguments);cleanup();return result}
  reconciled.__tcRuntimeReconciled=true;
  reconciled.__tcOriginal=original;
  w.renderOverview=reconciled;
})(window);
