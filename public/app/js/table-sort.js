// The Capital - table sorting helper
(function(){
  'use strict';
  window.tcSortTable=function(rows,key,direction){
    var dir=direction==='asc'?1:-1;
    return (Array.isArray(rows)?rows.slice():[]).sort(function(a,b){
      var av=a&&a[key],bv=b&&b[key];
      var an=Number(av),bn=Number(bv);
      if(Number.isFinite(an)&&Number.isFinite(bn))return (an-bn)*dir;
      return String(av??'').localeCompare(String(bv??''),'fr',{numeric:true,sensitivity:'base'})*dir;
    });
  };
  console.log('[TABLE-SORT] Helper chargé avec succès');
})();
