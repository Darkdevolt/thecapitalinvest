// ═══════════════════════════════════════
// VIEW — Fiche Titre (détail)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// FICHE
// ═══════════════════════════════════════
async function openFiche(ticker, from, noHash) {
  prevView = from;
  document.getElementById('ficheBackBtn').onclick = () => nav(from);
  nav('fiche', noHash);
  if (!noHash) history.replaceState(null, '', '#fiche=' + ticker);

  const ent = allEntreprises.find(e => e.ticker === ticker) || {};
  const fins = allFinancials.filter(f => f.ticker === ticker).sort((a,b) => b.annee - a.annee);
  const ans = allAnalyses.filter(a => a.ticker === ticker);

  // ─── CHARGER L'HISTORIQUE EN PREMIER pour avoir le vrai dernier cours ───
  let latestCours = null;
  try {
    const histResult = await sb('historique', { 
      ticker: `eq.${ticker}`, 
      order: 'date_seance.desc',
      limit: 5000
    });
    ficheHistorique = Array.isArray(histResult) ? histResult.reverse() : [];
    if (!ficheHistorique.length) {
      toast('Aucun historique disponible pour ' + ticker, 'warn');
    } else {
      // Le dernier point de l'historique = le vrai cours le plus récent
      latestCours = ficheHistorique[ficheHistorique.length - 1];
    }
  } catch(e) {
    ficheHistorique = [];
    toast('Erreur historique ' + ticker + ': ' + e.message, 'warn');
    console.error('Historique error:', e);
  }

  // Fallback sur allCours si pas d'historique
  const cours = latestCours || allCours.find(c => c.ticker === ticker) || {};

  document.getElementById('ficheTickerLabel').textContent = ticker;
  document.getElementById('ficheCompany').textContent = ent.nom || ticker;
  document.getElementById('ficheSector').textContent = ent.secteur || getSector(ticker);
  document.getElementById('fichePays').textContent = ent.pays || '';
  document.getElementById('fichePrice').textContent = fmt(cours.cours_cloture || cours.cours_normal || cours.cours);
  document.getElementById('ficheMeta').textContent = `Dernière séance : ${fmtDate(cours.date_seance)} · Volume : ${fmt(cours.volume)}`;

  const v = parseFloat(cours.variation);
  const cl = !isNaN(v) ? (v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--dim)') : 'var(--dim)';
  document.getElementById('ficheChange').innerHTML = !isNaN(v)
    ? `<span style="color:${cl}">${v>0?'▲':v<0?'▼':'='} ${Math.abs(v).toFixed(2)}%</span>` : '';

  const cp = parseFloat(cours.cours_cloture || cours.cours_normal || cours.cours);
  const f0 = fins[0];
  document.getElementById('r-per').textContent = (f0?.bpa && cp && f0.bpa > 0) ? (cp/f0.bpa).toFixed(1) + 'x' : '—';
  document.getElementById('r-rdt').textContent = (f0?.dpa && cp && cp > 0) ? ((f0.dpa/cp)*100).toFixed(2) + '%' : '—';
  document.getElementById('r-pan').textContent = (f0?.fonds_propres && f0?.nombre_actions && f0.nombre_actions > 0 && cp)
    ? (cp/(f0.fonds_propres/f0.nombre_actions)).toFixed(2) + 'x' : '—';
  document.getElementById('r-cap').textContent = (f0?.nombre_actions && cp) ? fmtM(cp*f0.nombre_actions) : '—';

  document.getElementById('ficheDesc').textContent = ent.description || 'Aucune description disponible.';

  const infoRows = [['Pays', ent.pays], ['Secteur', ent.secteur || getSector(ticker)], ['Bourse', 'BRVM'], ['Devise', 'FCFA (XOF)'], ['Nb. Actions', ent.nombre_actions ? fmt(ent.nombre_actions) : null]].filter(r => r[1]);
  document.getElementById('ficheInfo').innerHTML = infoRows.map(([k,v]) =>
    `<div class="fin-row"><span class="fin-label">${k}</span><span class="fin-value">${v}</span></div>`).join('');

  document.getElementById('ficheAnalyseList').innerHTML = ans.length
    ? ans.slice(0,3).map(a => renderAnalyseCard(a, true)).join('')
    : '<div style="color:var(--dim);font-size:13px">Aucune analyse disponible pour ce titre.</div>';

  renderFicheFin(fins, cours);

  ficheChartPeriod = 30;
  document.querySelectorAll('#view-fiche .year-tab').forEach((b,i) => b.classList.toggle('active', i===0));
  renderFicheChart();
}

function renderFicheFin(fins, cours) {
  const tabs = document.getElementById('fichYearTabs');
  const body = document.getElementById('ficheFinBody');
  if (!fins.length) { tabs.innerHTML = ''; body.innerHTML = '<div style="color:var(--dim);font-size:13px">Données financières non disponibles.</div>'; return; }
  tabs.innerHTML = fins.map((f,i) => `<button class="year-tab ${i===0?'active':''}" onclick="showFinYear(${i},this)">${f.annee}${f.periode && f.periode !== 'annuel' ? ' ' + f.periode : ''}</button>`).join('');
  window._ficheFins = fins; window._ficheCours = cours;
  showFinYear(0, null);
}

function showFinYear(idx, btn) {
  if (btn) {
    document.querySelectorAll('#fichYearTabs .year-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const f = (window._ficheFins||[])[idx]; if (!f) return;
  const cp = parseFloat((window._ficheCours||{}).cours_cloture || (window._ficheCours||{}).cours_normal || (window._ficheCours||{}).cours);
  document.getElementById('r-per').textContent = (f.bpa && cp && f.bpa > 0) ? (cp/f.bpa).toFixed(1)+'x' : '—';
  document.getElementById('r-rdt').textContent = (f.dpa && cp && cp > 0) ? ((f.dpa/cp)*100).toFixed(2)+'%' : '—';
  document.getElementById('r-pan').textContent = (f.fonds_propres && f.nombre_actions && f.nombre_actions > 0 && cp) ? (cp/(f.fonds_propres/f.nombre_actions)).toFixed(2)+'x' : '—';
  document.getElementById('r-cap').textContent = (f.nombre_actions && cp) ? fmtM(cp*f.nombre_actions) : '—';

  const sections = [
    ['RÉSULTATS', [["Chiffre d'affaires", fmtM(f.chiffre_affaires)], ["RBE", fmtM(f.rbe)], ["Résultat Net", fmtM(f.resultat_net)], ["BPA", f.bpa ? fmt(f.bpa)+' FCFA' : '—'], ["DPA", f.dpa ? fmt(f.dpa)+' FCFA' : '—']]],
    ['BILAN', [["Total Actif", fmtM(f.total_actif)], ["Fonds Propres", fmtM(f.fonds_propres)], ["Dettes Financières", fmtM(f.dettes_financieres)]]],
    ['FLUX', [["Cash-flow Opér.", fmtM(f.cash_flow_operationnel)], ["CAPEX", fmtM(f.capex)]]],
    ['RATIOS', [["Marge nette", f.resultat_net && f.chiffre_affaires && f.chiffre_affaires !== 0 ? ((f.resultat_net/f.chiffre_affaires)*100).toFixed(2)+'%' : '—'], ["ROE", f.resultat_net && f.fonds_propres && f.fonds_propres !== 0 ? ((f.resultat_net/f.fonds_propres)*100).toFixed(2)+'%' : '—'], ["ROA", f.resultat_net && f.total_actif && f.total_actif !== 0 ? ((f.resultat_net/f.total_actif)*100).toFixed(2)+'%' : '—'], ["Dette / FP", f.dettes_financieres && f.fonds_propres && f.fonds_propres !== 0 ? (f.dettes_financieres/f.fonds_propres).toFixed(2)+'x' : '—']]]
  ];

  document.getElementById('ficheFinBody').innerHTML = sections.map(([title, rows]) => {
    const validRows = rows.filter(([,v]) => v !== '—');
    if (!validRows.length) return '';
    return `<div style="margin-bottom:16px">
      <div class="fin-section-title">${title}</div>
      ${validRows.map(([l,v]) => `<div class="fin-row"><span class="fin-label">${l}</span><span class="fin-value">${v}</span></div>`).join('')}
    </div>`;
  }).join('') || '<div style="color:var(--dim);font-size:13px">Données comptables non renseignées.</div>';
}

function renderFicheChart() {
  const data = ficheHistorique.slice(-ficheChartPeriod);
  if (!data.length) {
    document.getElementById('chartFiche').parentElement.innerHTML = 
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--dim);font-size:13px">Aucun historique disponible</div>';
    return;
  }
  const labels = data.map(d => new Date(d.date_seance).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }));
  const vals = data.map(d => d.cours_cloture || d.cours_normal || 0);

  const validVals = vals.filter(v => v > 0);
  const periodHigh = validVals.length ? Math.max(...validVals) : 0;
  const periodLow = validVals.length ? Math.min(...validVals) : 0;
  const periodChange = validVals.length > 1 
    ? ((validVals[validVals.length-1] - validVals[0]) / validVals[0] * 100).toFixed(2) 
    : 0;
  const changeColor = periodChange >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('ficheMeta').innerHTML = `Dernière séance : ${fmtDate(ficheHistorique[ficheHistorique.length-1]?.date_seance)} · Volume : ${fmt(ficheHistorique[ficheHistorique.length-1]?.volume)} · <span style="color:var(--green)">▲ Haut : ${fmt(periodHigh)}</span> · <span style="color:var(--red)">▼ Bas : ${fmt(periodLow)}</span> · <span style="color:${changeColor}">Perf : ${periodChange >= 0 ? '+' : ''}${periodChange}%</span>`;

  if (ficheChartInst) ficheChartInst.destroy();
  ficheChartInst = new Chart(document.getElementById('chartFiche'), {
    type: 'line', 
    data: { labels, datasets: [mkDataset(vals)] }, 
    options: chartOpts
  });
}

function setChartPeriod(n, btn) {
  ficheChartPeriod = n;
  document.querySelectorAll('#view-fiche .year-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFicheChart();
}
