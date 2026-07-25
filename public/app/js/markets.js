// MARKETS PAGE — Data loading and rendering
(function() {
  if (window.__TC_MARKETS_LOADED__) return;
  window.__TC_MARKETS_LOADED__ = true;

  const fmt = n => n != null ? parseFloat(n).toLocaleString('fr-FR') : '—';
  
  function varHtml(v) {
    if(v==null) return '<span style="color:var(--muted)">—</span>';
    const val=parseFloat(v), s=val>0?'+':'';
    return `<span style="color:${val>0?'#4ADE80':val<0?'#F87171':'var(--muted)'">${s}${val.toFixed(2)}%</span>`;
  }

  let allCours = [];

  async function loadData() {
    const [ir, cr] = await Promise.all([
      fetch('/api/marche?type=indices').then(r=>r.json()).catch(()=>({data:[]})),
      fetch('/api/marche?type=cours').then(r=>r.json()).catch(()=>({data:[]}))
    ]);
    
    const indices = ir.data || [];
    ['BRVM COMPOSITE','BRVM 30','BRVM PRESTIGE'].forEach((name, i)=>{
      const ids=['composite','30','prestige'];
      const d=indices.find(x=>x.indice===name);
      if(!d) return;
      const v=parseFloat(d.variation||0), cls=v>0?'#4ADE80':v<0?'#F87171':'var(--muted)';
      const valEl = document.getElementById('val-'+ids[i]);
      const varEl = document.getElementById('var-'+ids[i]);
      if(valEl) valEl.textContent=parseFloat(d.valeur).toLocaleString('fr-FR',{minimumFractionDigits:2});
      if(varEl) varEl.innerHTML=`<span style="color:${cls}">${v>0?'+':''}${v.toFixed(2)}%</span>`;
    });
    
    allCours = cr.data || [];
    filterCours();
    
    const countPays=(code)=>allCours.filter(c=>{
      const pays=(c.pays||'').toLowerCase();
      if(code==='sn') return pays.includes('sénégal')||pays.includes('senegal');
      if(code==='ci') return pays.includes('ivoire');
      if(code==='bf') return pays.includes('burkina');
      if(code==='ml') return pays.includes('mali');
      if(code==='bj') return pays.includes('bénin')||pays.includes('benin');
      if(code==='tg') return pays.includes('togo');
      if(code==='ne') return pays.includes('niger');
      if(code==='gw') return pays.includes('guinée')||pays.includes('guinea');
      return false;
    }).length;
    
    ['sn','ci','bf','ml','bj','tg','ne','gw'].forEach(c=>{
      const el=document.getElementById('count-'+c);
      if(el){const n=countPays(c);el.textContent=n>0?`${n} société${n>1?'s':''}`:' — ';}
    });
  }

  function filterCours(){
    const q=(document.getElementById('cs')||{}).value?.toLowerCase()||'';
    const sect=(document.getElementById('cf')||{}).value||'';
    const tri=(document.getElementById('ct')||{}).value||'vd';
    let list=allCours.filter(c=>
      (!q||(c.ticker||'').toLowerCase().includes(q)||(c.nom||'').toLowerCase().includes(q))&&
      (!sect||c.secteur===sect)
    );
    if(tri==='vd') list.sort((a,b)=>parseFloat(b.variation||0)-parseFloat(a.variation||0));
    else if(tri==='va') list.sort((a,b)=>parseFloat(a.variation||0)-parseFloat(b.variation||0));
    else if(tri==='cd') list.sort((a,b)=>parseFloat(b.cours||0)-parseFloat(a.cours||0));
    else list.sort((a,b)=>a.ticker.localeCompare(b.ticker));
    const ccEl=document.getElementById('cc');
    if(ccEl) ccEl.textContent=`${list.length} titre${list.length>1?'s':''}`;
    const tbody=document.getElementById('ctb');
    if(!tbody) return;
    if(!list.length){tbody.innerHTML='<tr><td colspan="8"><div class="loading-cell">Aucun résultat</div></td></tr>';return;}
    tbody.innerHTML=list.map(c=>`<tr>
      <td class="td-tk">${c.ticker}</td>
      <td class="td-nm">${c.nom||'—'}</td>
      <td style="font-size:12px;color:rgba(245,240,232,0.4)">${c.pays||'—'}</td>
      <td class="td-sc">${c.secteur||'—'}</td>
      <td class="r" style="font-family:var(--mono)">${fmt(c.cours)} <span style="font-size:10px;color:var(--muted)">FCFA</span></td>
      <td class="r">${varHtml(c.variation)}</td>
      <td class="r" style="font-family:var(--mono);color:var(--muted)">${c.volume?parseInt(c.volume).toLocaleString('fr-FR'):'—'}</td>
      <td>${c.compartiment==='PRESTIGE'?'<span class="badge-gold">Prestige</span>':'<span class="badge-gray">Principal</span>'}</td>
    </tr>`).join('');
  }

  window.marketsModule = { loadData, filterCours };
  console.log('[MARKETS] Charge avec succes');
})();
