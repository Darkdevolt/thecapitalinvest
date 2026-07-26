(function(){
  window._sortState={};
  window.sortTable=function(tbodyId,colIndex){
    const tbody=document.getElementById(tbodyId);if(!tbody)return;
    const rows=Array.from(tbody.querySelectorAll('tr'));
    const key=tbodyId+'-'+colIndex;
    const dir=window._sortState[key]==='asc'?'desc':'asc';
    window._sortState[key]=dir;
    rows.sort(function(a,b){
      const aText=a.children[colIndex]?.textContent?.trim()||'';
      const bText=b.children[colIndex]?.textContent?.trim()||'';
      const aNum=parseFloat(aText.replace(/[^\d.-]/g,''));
      const bNum=parseFloat(bText.replace(/[^\d.-]/g,''));
      let cmp;if(!isNaN(aNum)&&!isNaN(bNum)&&aText!==''&&bText!==''){cmp=aNum-bNum;}else{cmp=aText.localeCompare(bText);}
      return dir==='asc'?cmp:-cmp;
    });
    rows.forEach(function(r){tbody.appendChild(r);});
  };
})();
