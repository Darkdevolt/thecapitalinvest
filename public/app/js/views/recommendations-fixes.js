(function(){
  'use strict';
  if(window.__TC_RECOMMENDATIONS_FIXES__)return;
  window.__TC_RECOMMENDATIONS_FIXES__=true;

  function rows(){return Array.isArray(window.allAnalyses)?window.allAnalyses:[];}
  function findAnalysis(id){
    const needle=String(id==null?'':id);
    return rows().find(x=>String(x&&x.id)==needle)||null;
  }
  function safeId(id){return String(id==null?'':id).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

  // Supabase analyses.id est un UUID. L'ancien rendu convertissait l'UUID
  // avec Number(), produisant 0 et rendant les fiches détaillées inaccessibles.
  window.renderAnalyseCard=function(a,clickable=true){
    const quote=analyseQuote(a.ticker),company=analyseCompany(a.ticker),target=analyseTarget(a),ref=analyseReference(a,quote),potential=analysePotential(a,quote),financials=analyseFinancials(a.ticker),latest=financials[0],review=analyseReviewFlag(a,quote),name=company.nom||company.raison_sociale||a.ticker||'—',title=`${a.ticker||'—'} · ${analyseSafeText(a.recommandation||'Analyse')}`;
    const clickAttr=clickable?`onclick="openAnalyseDetail('${safeId(a.id)}')"`:'';
    return `<article class="tc-rec-card" ${clickAttr}><div class="tc-rec-card-top"><div><div class="tc-rec-kicker">${analyseEsc(a.ticker||'—')}</div><h3>${analyseEsc(name)}</h3><div class="tc-rec-note-title">${analyseEsc(title)}</div></div>${analyseRecoBadge(a)}</div><div class="tc-rec-price-row"><div><span>Cours actuel</span><strong>${analyseFmt(ref)} <small>FCFA</small></strong></div>${target!==null?`<div><span>Objectif</span><strong class="gold">${analyseFmt(target)} <small>FCFA</small></strong></div>`:''}${potential!==null?`<div><span>Potentiel</span><strong class="${potential>=0?'positive':'negative'}">${potential>=0?'+':''}${potential.toFixed(1)}%</strong></div>`:''}</div><div class="tc-rec-fin-row">${latest?`<div><span>Dernier exercice</span><strong>${analyseEsc(analysePeriodLabel(latest))}</strong></div><div><span>Résultat net</span><strong>${analyseFmtM(latest.resultat_net)}</strong></div><div><span>CA</span><strong>${analyseFmtM(latest.chiffre_affaires)}</strong></div>`:'<div><span>Dernières données</span><strong>—</strong></div>'}</div>${a.commentaire?`<p class="tc-rec-comment">${analyseEsc(a.commentaire).slice(0,280)}${String(a.commentaire).length>280?'…':''}</p>`:''}<div class="tc-rec-footer"><span>${a.date_analyse?`📅 ${analyseDate(a.date_analyse)}`:''}${a.horizon?` · ${analyseEsc(a.horizon)}`:''}</span>${review.length?`<span class="tc-rec-review">${analyseEsc(review[0])}</span>`:'<span class="tc-rec-current">Analyse disponible</span>'}</div></article>`;
  };

  window.openAnalyseDetail=function(id,noHash){
    ensureRecommendationStyles();
    const a=findAnalysis(id);if(!a)return;
    nav('analyse-detail',noHash);
    if(!noHash)history.replaceState(null,'','#analyse='+encodeURIComponent(String(a.id)));
    const ticker=analyseTicker(a.ticker),company=analyseCompany(ticker),quote=analyseQuote(ticker),fins=analyseFinancials(ticker),latest=fins[0]||{},target=analyseTarget(a),ref=analyseReference(a,quote),potential=analysePotential(a,quote),review=analyseReviewFlag(a,quote),sameTicker=rows().filter(x=>analyseTicker(x.ticker)===ticker&&String(x.id)!==String(a.id)).sort((x,y)=>Date.parse(y.date_analyse||0)-Date.parse(x.date_analyse||0)),detail=document.getElementById('analyseDetailContent');
    if(!detail)return;
    detail.innerHTML=`<div class="tc-rec-detail-head"><div><button class="back-btn" onclick="nav('analyses')">← Retour aux recommandations</button><div class="tc-rec-kicker">THE CAPITAL · RESEARCH NOTE</div><div class="tc-rec-detail-company"><span>${analyseEsc(ticker)}</span><h1>${analyseEsc(company.nom||company.raison_sociale||ticker)}</h1><p>${analyseEsc(company.secteur||company.sous_secteur||'Analyse financière')} · ${analyseDate(a.date_analyse)}</p></div></div><div class="tc-rec-detail-actions">${analyseRecoBadge(a,true)}<button class="filter-btn" onclick="openClientRecommendationSheet('${safeId(a.id)}')">↗ Fiche client</button></div></div>${review.length?`<div class="tc-rec-warning">⚠ ${analyseEsc(review.join(' · '))}. Cette note doit être réévaluée avant diffusion comme conviction actuelle.</div>`:''}<div class="tc-rec-detail-kpis">${analyseMetric('Cours',ref===null?'—':analyseFmt(ref)+' FCFA',quote.date_seance?'Dernière séance '+analyseDate(quote.date_seance):'')}${analyseMetric('Objectif',target===null?'—':analyseFmt(target)+' FCFA')}${analyseMetric('Potentiel',potential===null?'—':`${potential>=0?'+':''}${potential.toFixed(1)}%`)}${analyseMetric('Résultat net',analyseFmtM(latest.resultat_net),latest.annee?analysePeriodLabel(latest):'—')}</div><div class="tc-rec-detail-grid"><div><section class="tc-rec-panel"><div class="tc-rec-panel-title">01 · THÈSE D’INVESTISSEMENT</div><div class="tc-rec-body">${a.commentaire?analyseEsc(a.commentaire).replace(/\n/g,'<br>'):'Aucune analyse détaillée disponible.'}</div></section><section class="tc-rec-panel"><div class="tc-rec-panel-title">02 · DERNIÈRES DONNÉES FINANCIÈRES PUBLIÉES</div>${financialTableForRecommendation(ticker)}</section><section class="tc-rec-panel"><div class="tc-rec-panel-title">03 · DERNIERS ÉLÉMENTS PUBLIÉS</div>${publicationSummaryForRecommendation(ticker)}</section></div><aside><section class="tc-rec-panel"><div class="tc-rec-panel-title">MARCHÉ</div><div class="tc-rec-side-grid">${analyseMetric('Capitalisation',analyseFmtM(quote.capitalisation))}${analyseMetric('Volume',analyseFmtM(quote.volume))}${analyseMetric('52s haut',analyseFmt(quote.plus_haut_52))}${analyseMetric('52s bas',analyseFmt(quote.plus_bas_52))}${analyseMetric('Rendement dividende',analyseNum(latest.dividend_yield)!==null?Number(latest.dividend_yield).toFixed(2)+'%':'—')}</div></section><section class="tc-rec-panel"><div class="tc-rec-panel-title">NOTE</div><div class="tc-rec-side-text"><div><span>Analyste</span><strong>${analyseEsc(a.analyste||'The Capital Research')}</strong></div><div><span>Horizon</span><strong>${analyseEsc(a.horizon||'Non précisé')}</strong></div><div><span>Date</span><strong>${analyseDate(a.date_analyse)}</strong></div></div></section><section class="tc-rec-panel"><div class="tc-rec-panel-title">HISTORIQUE</div>${sameTicker.length?sameTicker.slice(0,5).map(x=>`<button class="tc-rec-history" onclick="openAnalyseDetail('${safeId(x.id)}')"><strong>${analyseEsc(x.recommandation||'Analyse')}</strong><span>${analyseDate(x.date_analyse)}</span></button>`).join(''):'<div class="tc-rec-empty">Aucune autre note pour cette valeur.</div>'}</section></aside></div>`;
  };

  window.openClientRecommendationSheet=function(id){
    const a=findAnalysis(id);if(!a)return;
    ensureRecommendationStyles();
    const existing=document.getElementById('tcClientSheetOverlay');if(existing)existing.remove();
    const overlay=document.createElement('div');overlay.id='tcClientSheetOverlay';overlay.className='tc-client-overlay';overlay.innerHTML=`<div class="tc-client-modal"><div class="tc-client-toolbar"><strong>Fiche client</strong><div><button class="filter-btn" type="button" onclick="printClientRecommendation('${safeId(a.id)}')">🖨 Imprimer / PDF</button><button class="filter-btn" type="button" onclick="document.getElementById('tcClientSheetOverlay').remove()">Fermer</button></div></div>${analysisClientSheet(a)}</div>`;document.body.appendChild(overlay);
  };

  window.printClientRecommendation=function(id){
    const a=findAnalysis(id);if(!a)return;
    const sheet=analysisClientSheet(a),win=window.open('','_blank','noopener,noreferrer,width=1100,height=850');
    if(!win){toast('Autorisez les fenêtres contextuelles pour exporter la fiche.','warn');return;}
    const css=Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l=>`<link rel="stylesheet" href="${l.href}">`).join('')+'<style>body{background:#fff!important;color:#18140e!important;padding:30px}.tc-client-sheet{max-width:980px;margin:auto;box-shadow:none!important;border:1px solid #ddd!important;color:#18140e!important}.tc-client-toolbar{display:none!important}@media print{body{padding:0}.tc-client-sheet{border:0!important}}</style>';
    win.document.open();win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>The Capital — Fiche ${analyseEsc(a.ticker)}</title>${css}</head><body>${sheet}</body></html>`);win.document.close();win.focus();setTimeout(()=>win.print(),500);
  };
})();
