/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */
async function loadDashboard() {
    const tsEl = document.getElementById('dash-ts');
    if (tsEl) tsEl.textContent = new Date().toLocaleString('fr-FR');

    const counts = await Promise.all([
        sbCount('entreprises'), sbCount('cours'), sbCount('historique'),
        sbCount('financials'), sbCount('dividendes_calendrier'), sbCount('users')
    ]);
    const nEnt = counts[0], nCours = counts[1], nHist = counts[2], nFin = counts[3], nDiv = counts[4], nUsers = counts[5];

    const kEnt = document.getElementById('k-entreprises'); if(kEnt) kEnt.textContent = nEnt;
    const kCou = document.getElementById('k-cours');       if(kCou) kCou.textContent = nCours;
    const kHis = document.getElementById('k-historique');  if(kHis) kHis.textContent = nHist;
    const kFin = document.getElementById('k-financials');  if(kFin) kFin.textContent = nFin;
    const kDiv = document.getElementById('k-dividendes');  if(kDiv) kDiv.textContent = nDiv;
    const kUsr = document.getElementById('k-users');       if(kUsr) kUsr.textContent = nUsers;

    const lastCours = await sbGet('cours', 'select=date_seance&order=date_seance.desc&limit=1');
    const usersPlans = await sbGet('users', 'select=plan');

    const plans = { free:0, pro:0, elite:0 };
    (usersPlans || []).forEach(function(u){ if (u.plan in plans) plans[u.plan]++; });
    const ksUsr = document.getElementById('ks-users');
    if(ksUsr) ksUsr.textContent = 'Free:' + plans.free + ' Pro:' + plans.pro + ' Elite:' + plans.elite;
    const ksCou = document.getElementById('ks-cours');
    if(ksCou) ksCou.textContent = 'Dernière: ' + ((lastCours || [])[0] && (lastCours || [])[0].date_seance || '—');

    const dashInfo = document.getElementById('dash-info');
    if(dashInfo) {
        dashInfo.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">' +
            '<div style="font-size:13px;"><span style="color:var(--muted);">Dernière séance :</span> <strong>' + ((lastCours || [])[0] && (lastCours || [])[0].date_seance || '—') + '</strong></div>' +
            '<div style="font-size:13px;"><span style="color:var(--muted);">Entreprises :</span> <strong>' + nEnt + '</strong></div>' +
            '<div style="font-size:13px;"><span style="color:var(--muted);">Historique :</span> <strong>' + nHist.toLocaleString('fr-FR') + '</strong></div>' +
            '</div>';
    }

    await loadDashboardAlerts();
}

async function loadDashboardAlerts() {
    const panel = document.getElementById('dash-alerts');
    if(!panel) return;
    const alerts = [];
    const nullVar = await sbCount('cours', 'variation=is.null');
    const nullCours = await sbCount('cours', 'cours=lte.0');
    const nullClot = await sbCount('historique', 'cours_cloture=is.null');
    if (nullVar   > 0) alerts.push({ type:'warn', msg: nullVar   + ' cours sans variation' });
    if (nullCours > 0) alerts.push({ type:'err',  msg: nullCours + ' cours ≤ 0' });
    if (nullClot  > 0) alerts.push({ type:'warn', msg: nullClot  + ' historique sans cours_cloture' });
    if (!alerts.length) { panel.innerHTML = '<div style="color:var(--green);font-size:13px;">✓ Aucune anomalie.</div>'; return; }
    panel.innerHTML = alerts.map(function(a){
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-s);">' +
               '<span style="font-size:16px;">' + (a.type==='err'?'⚠':'ℹ') + '</span>' +
               '<span style="font-size:13px;color:' + (a.type==='err'?'var(--red)':'var(--orange)') + ';">' + a.msg + '</span>' +
               '</div>';
    }).join('');
}
