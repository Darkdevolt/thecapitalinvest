// FICHE TITRE — historique complet et chronologiquement fiable
function ficheDateValue(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? NaN : t;
  }
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const t = Date.parse(raw);
  return Number.isNaN(t) ? NaN : t;
}

function ficheSortHistory(arr) {
  return (Array.isArray(arr) ? arr.slice() : []).sort((a, b) => {
    const da = ficheDateValue(a?.date_seance);
    const db = ficheDateValue(b?.date_seance);
    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;
    return da - db;
  });
}

async function loadCompleteFicheHistorique(ticker) {
  const pageSize = 1000;
  const maxPages = 50;
  const all = [];

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const response = await window.apiGet(
      `/marche?type=historique&ticker=${encodeURIComponent(ticker)}&limit=${pageSize}&offset=${offset}&_=${Date.now()}`
    );
    const payload = response && typeof response === 'object' && 'data' in response ? response.data : response;
    const batch = Array.isArray(payload) ? payload : [];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
  }

  // Déduplication défensive : certaines anciennes importations peuvent contenir
  // deux lignes pour la même séance. On garde la ligne ayant le même ticker/date
  // mais la plus complète, sans inventer ni modifier de cours.
  const byKey = new Map();
  all.forEach(row => {
    if (!row) return;
    const key = `${String(row.ticker || ticker).trim().toUpperCase()}|${String(row.date_seance || '')}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, row);
      return;
    }
    const score = value => value == null || value === '' ? 0 : 1;
    const currentScore = Object.values(row).reduce((s, v) => s + score(v), 0);
    const previousScore = Object.values(previous).reduce((s, v) => s + score(v), 0);
    if (currentScore > previousScore) byKey.set(key, row);
  });

  return ficheSortHistory(Array.from(byKey.values()));
}

async function openFiche(ticker, from, noHash) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase();
  if (!normalizedTicker) {
    console.warn('[FICHE] Ticker vide, ouverture annulée.');
    return false;
  }

  const previousView = from || 'titres';
  prevView = previousView;

  nav('fiche', true);
  if (!noHash) history.replaceState(null, '', '#fiche=' + encodeURIComponent(normalizedTicker));
  if (typeof updateBreadcrumb === 'function') updateBreadcrumb('fiche');
  document.title = 'Fiche Titre, ' + normalizedTicker + ', The Capital';

  const backBtn = document.getElementById('ficheBackBtn');
  if (backBtn) backBtn.onclick = () => nav(previousView);

  const view = document.getElementById('view-fiche');
  if (view) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    view.classList.add('active');
    view.style.display = '';
  }

  const entreprises = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
  const financials = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  const analyses = Array.isArray(window.allAnalyses) ? window.allAnalyses : [];
  const ent = entreprises.find(e => String(e?.ticker || '').trim().toUpperCase() === normalizedTicker) || {};
  const fins = financials
    .filter(f => String(f?.ticker || '').trim().toUpperCase() === normalizedTicker)
    .sort((a,b) => (b.annee || 0) - (a.annee || 0));
  const ans = analyses.filter(a => String(a?.ticker || '').trim().toUpperCase() === normalizedTicker);

  let ficheHistoriqueLocal = [];
  let latestCours = null;
  try {
    // Même chemin canonique que le reste de l'application, mais paginé par titre.
    // Ainsi ABJC, STDC, BICB et tous les autres titres utilisent exactement la
    // même logique et récupèrent toute leur série disponible.
    ficheHistoriqueLocal = await loadCompleteFicheHistorique(normalizedTicker);
    latestCours = ficheHistoriqueLocal[ficheHistoriqueLocal.length - 1] || null;
    if (!ficheHistoriqueLocal.length && typeof toast === 'function') toast('Aucun historique disponible pour ' + normalizedTicker, 'warn');
  } catch(e) {
    ficheHistoriqueLocal = [];
    if (typeof toast === 'function') toast('Erreur historique ' + normalizedTicker + ': ' + e.message, 'warn');
  }

  if (!latestCours) {
    const fallback = Array.isArray(window.allCours) ? window.allCours : [];
    latestCours = fallback.find(c => String(c?.ticker || '').trim().toUpperCase() === normalizedTicker) || null;
  }
  const cours = latestCours || {};

  const activeView = document.querySelector('.view.active');
  if (!activeView || activeView.id !== 'view-fiche') return false;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
  };

  setText('ficheTickerLabel', '◈ ' + normalizedTicker);
  setText('ficheCompany', ent.nom || normalizedTicker);
  setText('ficheSector', ent.secteur || (typeof getSector === 'function' ? getSector(normalizedTicker) : ''));
  setText('fichePays', ent.pays || '');
  setText('fichePrice', fmt(cours.cours_cloture || cours.cours_normal || cours.cours));
  setText('ficheMeta', `Dernière séance : ${fmtDate(cours.date_seance)} · Volume : ${fmt(cours.volume)}`);

  const v = parseFloat(cours.variation);
  const cl = !isNaN(v) ? (v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--dim)') : 'var(--dim)';
  const changeEl = document.getElementById('ficheChange');
  if (changeEl) changeEl.innerHTML = !isNaN(v)
    ? `<span style="color:${cl}">${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v).toFixed(2)}%</span>`
    : '';

  const cp = parseFloat(cours.cours_cloture || cours.cours_normal || cours.cours);
  const f0 = fins[0];
  setText('r-per', f0?.bpa && cp && f0.bpa > 0 ? (cp / f0.bpa).toFixed(1) + 'x' : ', ');
  setText('r-rdt', f0?.dpa && cp && cp > 0 ? ((f0.dpa / cp) * 100).toFixed(2) + '%' : ', ');
  setText('r-pan', f0?.fonds_propres && f0?.nombre_actions && f0.nombre_actions > 0 && cp ? (cp / (f0.fonds_propres / f0.nombre_actions)).toFixed(2) + 'x' : ', ');
  setText('r-cap', f0?.nombre_actions && cp ? fmtM(cp * f0.nombre_actions) : ', ');
  setText('ficheDesc', ent.description || 'Aucune description disponible.');

  const infoRows = [
    ['Pays', ent.pays],
    ['Secteur', ent.secteur || (typeof getSector === 'function' ? getSector(normalizedTicker) : '')],
    ['Bourse', 'BRVM'],
    ['Devise', 'FCFA (XOF)'],
    ['Nb. Actions', ent.nombre_actions ? fmt(ent.nombre_actions) : null]
  ].filter(r => r[1]);
  const infoEl = document.getElementById('ficheInfo');
  if (infoEl) infoEl.innerHTML = infoRows.map(([k,v]) => `<div class="fin-row"><span class="fin-label">${k}</span><span class="fin-value">${v}</span></div>`).join('');

  const analyseEl = document.getElementById('ficheAnalyseList');
  if (analyseEl) analyseEl.innerHTML = ans.length
    ? ans.slice(0,3).map(a => renderAnalyseCard(a,true)).join('')
    : '<div style="color:var(--dim);font-size:13px">Aucune analyse disponible pour ce titre.</div>';

  window.ficheHistorique = ficheHistoriqueLocal;
  renderFicheFin(fins, cours);
  ficheChartPeriod = 252;
  document.querySelectorAll('#view-fiche .year-tab').forEach((b,i) => b.classList.toggle('active', i === 0));
  renderFicheChart();
  return true;
}

function renderFicheFin(fins,cours){
  const tabs=document.getElementById('fichYearTabs'),body=document.getElementById('ficheFinBody');
  if(!tabs||!body)return;
  if(!fins.length){tabs.innerHTML='';body.innerHTML='<div style="color:var(--dim);font-size:13px">Données financières non disponibles.</div>';return;}
  tabs.innerHTML=fins.map((f,i)=>`<button class="year-tab ${i===0?'active':''}" onclick="showFinYear(${i},this)">${f.annee}${f.periode&&f.periode!=='annuel'?' '+f.periode:''}</button>`).join('');
  window._ficheFins=fins;window._ficheCours=cours;showFinYear(0,null);
}
function showFinYear(idx,btn){
  if(btn){document.querySelectorAll('#fichYearTabs .year-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const f=(window._ficheFins||[])[idx];if(!f)return;const cp=parseFloat((window._ficheCours||{}).cours_cloture||(window._ficheCours||{}).cours_normal||(window._ficheCours||{}).cours);
  document.getElementById('r-per').textContent=f.bpa&&cp&&f.bpa>0?(cp/f.bpa).toFixed(1)+'x':', ';document.getElementById('r-rdt').textContent=f.dpa&&cp&&cp>0?((f.dpa/cp)*100).toFixed(2)+'%':', ';document.getElementById('r-pan').textContent=f.fonds_propres&&f.nombre_actions&&f.nombre_actions>0&&cp?(cp/(f.fonds_propres/f.nombre_actions)).toFixed(2)+'x':', ';document.getElementById('r-cap').textContent=f.nombre_actions&&cp?fmtM(cp*f.nombre_actions):', ';
  const sections=[['RÉSULTATS',[["Chiffre d'affaires",fmtM(f.chiffre_affaires)],["RBE",fmtM(f.rbe)],["Résultat Net",fmtM(f.resultat_net)],["BPA",f.bpa?fmt(f.bpa)+' FCFA':', '],["DPA",f.dpa?fmt(f.dpa)+' FCFA':', ']]],['BILAN',[["Total Actif",fmtM(f.total_actif)],["Fonds Propres",fmtM(f.fonds_propres)],["Dettes Financières",fmtM(f.dettes_financieres)]]],['FLUX',[["Cash-flow Opér.",fmtM(f.cash_flow_operationnel)],["CAPEX",fmtM(f.capex)]]],['RATIOS',[["Marge nette",f.resultat_net&&f.chiffre_affaires?((f.resultat_net/f.chiffre_affaires)*100).toFixed(2)+'%':', '],["ROE",f.resultat_net&&f.fonds_propres?((f.resultat_net/f.fonds_propres)*100).toFixed(2)+'%':', '],["ROA",f.resultat_net&&f.total_actif?((f.resultat_net/f.total_actif)*100).toFixed(2)+'%':', '],["Dette / FP",f.dettes_financieres&&f.fonds_propres?(f.dettes_financieres/f.fonds_propres).toFixed(2)+'x':', ']]]];
  document.getElementById('ficheFinBody').innerHTML=sections.map(([title,rows])=>{const valid=rows.filter(([,v])=>v!==', ');return valid.length?`<div style="margin-bottom:16px"><div class="fin-section-title">${title}</div>${valid.map(([l,v])=>`<div class="fin-row"><span class="fin-label">${l}</span><span class="fin-value">${v}</span></div>`).join('')}</div>`:'';}).join('')||'<div style="color:var(--dim);font-size:13px">Données comptables non renseignées.</div>';
}
function renderFicheChart(){
  const data=(window.ficheHistorique||[]).slice(-ficheChartPeriod);if(!data.length)return;const labels=data.map(d=>{const t=ficheDateValue(d.date_seance);return Number.isNaN(t)?String(d.date_seance||''):new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});});const vals=data.map(d=>d.cours_cloture??d.cours_normal??d.cours??0);if(ficheChartInst)ficheChartInst.destroy();ficheChartInst=new Chart(document.getElementById('chartFiche'),{type:'line',data:{labels,datasets:[mkDataset(vals)]},options:chartOpts});
}
function setChartPeriod(n,btn){ficheChartPeriod=n;document.querySelectorAll('#view-fiche .year-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderFicheChart();}
