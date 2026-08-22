/* ══════════════════════════════════════════════════════
   DIAGNOSTIC — contrôle de qualité de la base
   Détecte : données manquantes, incohérences OHLC, valeurs
   impossibles, dates suspectes, provenance absente, références
   orphelines et couverture financière.
══════════════════════════════════════════════════════ */

function diagIssue(label, count, severity, detail) {
    return { label: label, count: Number(count || 0), severity: severity, detail: detail || '' };
}

async function diagCount(table, params) {
    return await sbCount(table, params || '');
}

async function runDiagnostic() {
    const res = document.getElementById('diag-result');
    if(res) res.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyse complète de la base en cours...</p></div>';

    const base = await Promise.all([
        diagCount('entreprises'), diagCount('cours'), diagCount('historique'), diagCount('financials'),
        diagCount('dividendes_calendrier'), diagCount('financials_annuels'), diagCount('financials_infrannuels'),
        diagCount('etats_financiers'), diagCount('indices')
    ]);
    const nEnt=base[0], nCours=base[1], nHist=base[2], nFin=base[3], nDiv=base[4];

    const issues = [];
    issues.push(diagIssue('Entreprises absentes', nEnt === 0 ? 1 : 0, nEnt === 0 ? 'critical' : 'ok', 'Le référentiel entreprises est vide.'));
    issues.push(diagIssue('Cours absents', nCours === 0 ? 1 : 0, nCours === 0 ? 'critical' : 'ok', 'Aucun cours disponible.'));
    issues.push(diagIssue('Financials absents', nFin === 0 ? 1 : 0, nFin === 0 ? 'critical' : 'ok', 'Aucune donnée financière disponible.'));
    issues.push(diagIssue('Dividendes absents', nDiv === 0 ? 1 : 0, nDiv === 0 ? 'warning' : 'ok', 'Aucun calendrier de dividendes.'));

    const [badCours, badOhlc, futureCours, missingVariation, extremeCours, badHist, badFinancial, missingSource, missingSourceUrl, badDivDates, correctionLog] = await Promise.all([
        diagCount('cours', 'or=(cours.lt.0,ouverture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0,capitalisation.lt.0,variation.lt.-100)'),
        diagCount('cours', 'and=(plus_haut.not.is.null,plus_bas.not.is.null,plus_haut.lt.plus_bas)'),
        diagCount('cours', 'date_seance=gt.' + new Date().toISOString().slice(0,10)),
        diagCount('cours', 'variation=is.null'),
        diagCount('cours', 'or=(cours.gte.100000,ouverture.gte.100000,plus_haut.gte.100000,plus_bas.gte.100000)'),
        diagCount('historique', 'or=(cloture.lt.0,cours_cloture.lt.0,cours_ouverture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0,variation.lt.-100)'),
        diagCount('financials', 'or=(chiffre_affaires.lt.0,ebitda.lt.0,fonds_propres.lt.0,dettes_financieres.lt.0,total_actif.lt.0,cap_boursiere.lt.0,dpa.lt.0,capex.lt.0,dividend_yield.lt.0,rendement_dividende.lt.0,payout_ratio.lt.0)'),
        diagCount('financials', 'or=(source.is.null,source.eq.)'),
        diagCount('financials', 'source_url=is.null'),
        diagCount('dividendes_calendrier', 'and=(ex_date.not.is.null,date_paiement.not.is.null,ex_date.gt.date_paiement)'),
        diagCount('data_corrections_log')
    ]);

    issues.push(diagIssue('Cours avec valeur impossible', badCours, badCours ? 'critical' : 'ok', 'Prix, volumes ou capitalisation négatifs détectés.'));
    issues.push(diagIssue('Cours avec High < Low', badOhlc, badOhlc ? 'critical' : 'ok', 'High doit toujours être supérieur ou égal à Low.'));
    issues.push(diagIssue('Cours datés dans le futur', futureCours, futureCours ? 'critical' : 'ok', 'Une séance future ne doit pas être publiée.'));
    issues.push(diagIssue('Cours sans variation', missingVariation, missingVariation ? 'warning' : 'ok', 'Peut être acceptable si la source ne fournit pas la variation, mais doit être identifié.'));
    issues.push(diagIssue('Cours à échelle anormale', extremeCours, extremeCours ? 'critical' : 'ok', 'Seuil de contrôle : ≥ 100 000 FCFA. À vérifier comme possible erreur d’unité.'));
    issues.push(diagIssue('Historique avec valeurs impossibles', badHist, badHist ? 'critical' : 'ok', 'Prix/volumes négatifs détectés.'));
    issues.push(diagIssue('Financials avec valeurs négatives impossibles', badFinancial, badFinancial ? 'critical' : 'ok', 'CA, EBITDA, actifs, dette, DPA, etc. ne doivent pas être négatifs.'));
    issues.push(diagIssue('Financials sans source', missingSource, missingSource ? 'warning' : 'ok', 'Toute donnée professionnelle doit être traçable.'));
    issues.push(diagIssue('Financials sans URL source', missingSourceUrl, missingSourceUrl ? 'warning' : 'ok', 'Ajoute le lien du document lorsque disponible.'));
    issues.push(diagIssue('Dividendes : dates incohérentes', badDivDates, badDivDates ? 'critical' : 'ok', 'La date de détachement doit précéder ou égaler la date de paiement.'));
    issues.push(diagIssue('Corrections auditées', correctionLog, correctionLog ? 'ok' : 'warning', correctionLog ? 'Les corrections historiques sont traçables.' : 'Aucune correction enregistrée.'));

    const [ents, fins] = await Promise.all([
        sbGet('entreprises', 'select=ticker&limit=1000'),
        sbGet('financials', 'select=ticker&limit=1000')
    ]);
    const finSet = new Set((fins || []).map(function(f){ return String(f.ticker || '').toUpperCase(); }));
    const missingFinancialTickers = (ents || []).filter(function(e){ return !finSet.has(String(e.ticker || '').toUpperCase()); });
    issues.push(diagIssue('Entreprises sans financial', missingFinancialTickers.length, missingFinancialTickers.length ? 'warning' : 'ok', missingFinancialTickers.slice(0,20).map(function(e){ return e.ticker; }).join(', ')));

    const missingIdentity = await diagCount('entreprises', 'or=(isin.is.null,nombre_actions.is.null,nb_actions.is.null)');
    issues.push(diagIssue('Entreprises sans identifiants de marché complets', missingIdentity, missingIdentity ? 'warning' : 'ok', 'ISIN et nombre d’actions sont importants pour les analyses professionnelles.'));

    const errors = issues.filter(function(i){ return i.severity === 'critical' && i.count > 0; });
    const warnings = issues.filter(function(i){ return i.severity === 'warning' && i.count > 0; });
    const score = Math.max(0, Math.round(100 - errors.length*12 - warnings.length*4));

    const bar = document.getElementById('diag-health-bar');
    if(bar) bar.style.display = '';
    const hIcon = document.getElementById('diag-health-icon');
    const hTitle = document.getElementById('diag-health-title');
    const hSub = document.getElementById('diag-health-sub');
    const hScore = document.getElementById('diag-score');
    if(hIcon) hIcon.textContent = errors.length ? '⛔' : warnings.length ? '⚠️' : '✅';
    if(hTitle) hTitle.textContent = errors.length ? 'Erreurs à corriger' : warnings.length ? 'Base exploitable avec alertes' : 'Base saine';
    if(hSub) hSub.textContent = errors.length + ' erreur(s) critique(s) · ' + warnings.length + ' avertissement(s)';
    if(hScore){ hScore.textContent = score + '%'; hScore.style.color = errors.length ? 'var(--red)' : warnings.length ? 'var(--orange)' : 'var(--green)'; }

    if(res){
        res.innerHTML = '<div class="card"><div style="padding:18px;">' +
            '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Le diagnostic contrôle la qualité des données et les règles qui empêchent les nouvelles erreurs. Les anomalies historiques ne sont jamais corrigées silencieusement.</div>' +
            '<table class="diag-table" style="width:100%;font-size:13px;">' +
            '<tr><th style="text-align:left;">Contrôle</th><th style="text-align:right;">Éléments</th><th>État</th><th style="text-align:left;">Détail</th></tr>' +
            issues.map(function(i){
                const cls = i.severity === 'critical' && i.count ? 'diag-err' : i.severity === 'warning' && i.count ? 'diag-warn' : 'diag-ok';
                const label = i.severity === 'critical' && i.count ? 'ERREUR' : i.severity === 'warning' && i.count ? 'ALERTE' : 'OK';
                return '<tr><td>' + i.label + '</td><td style="text-align:right;font-family:var(--mono);">' + i.count + '</td><td class="' + cls + '">' + label + '</td><td style="color:var(--muted);font-size:11px;">' + (i.detail || '—') + '</td></tr>';
            }).join('') +
            '</table></div></div>' +
            '<div class="card" style="margin-top:12px;"><div class="card-header"><span class="card-title">Couverture de la base</span></div><div style="padding:18px;font-size:12px;line-height:1.8;">' +
            'Entreprises : <b>' + nEnt + '</b> · Cours : <b>' + nCours + '</b> · Historique : <b>' + nHist + '</b> · Financials : <b>' + nFin + '</b> · Dividendes : <b>' + nDiv + '</b> · Financials annuels : <b>' + base[5] + '</b> · Infrannuels : <b>' + base[6] + '</b> · Documents financiers : <b>' + base[7] + '</b> · Indices : <b>' + base[8] + '</b>' +
            '</div></div>';
    }

    diagData = {
        generated_at: new Date().toISOString(), score: score,
        critical_errors: errors.length, warnings: warnings.length,
        counts: { entreprises:nEnt, cours:nCours, historique:nHist, financials:nFin, dividendes:nDiv, financials_annuels:base[5], financials_infrannuels:base[6], documents_financiers:base[7], indices:base[8], corrections:correctionLog },
        issues: issues,
        missing_financial_tickers: missingFinancialTickers.map(function(e){ return e.ticker; })
    };
}

function exportDiagnostic() {
    if (!diagData) { toast('Lancez d’abord le diagnostic', 'err'); return; }
    const blob = new Blob([JSON.stringify(diagData, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diagnostic-the-capital-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
    URL.revokeObjectURL(url);
}

async function loadCoursErreurs() {
    const panel = document.getElementById('cours-erreurs-panel');
    const rows = await sbGet('cours', 'select=ticker,date_seance,cours,ouverture,plus_haut,plus_bas,volume,variation,capitalisation&or=(cours.lt.0,ouverture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0,capitalisation.lt.0,variation.lt.-100)&order=date_seance.desc&limit=100');
    if (!panel) return;
    if (!rows || !rows.length) { panel.innerHTML = '<div style="padding:16px;color:var(--green);">✓ Aucun cours invalide détecté</div>'; return; }
    panel.innerHTML = '<div class="tw"><table style="font-size:12px;"><thead><tr><th>Ticker</th><th>Date</th><th>Cours</th><th>Ouverture</th><th>Haut</th><th>Bas</th><th>Volume</th><th>Variation</th></tr></thead><tbody>' +
        rows.map(function(r){ return '<tr><td>' + r.ticker + '</td><td>' + r.date_seance + '</td><td>' + fmt(r.cours) + '</td><td>' + fmt(r.ouverture) + '</td><td>' + fmt(r.plus_haut) + '</td><td>' + fmt(r.plus_bas) + '</td><td>' + fmt(r.volume) + '</td><td>' + fmt(r.variation) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
}

async function loadTickersSansFinancials() {
    const panel = document.getElementById('tickers-sans-fin-panel');
    const ents = await sbGet('entreprises', 'select=ticker&limit=1000');
    const fins = await sbGet('financials', 'select=ticker&limit=1000');
    if (!panel) return;
    const finSet = new Set((fins || []).map(function(f){ return String(f.ticker || '').toUpperCase(); }));
    const missing = (ents || []).filter(function(e){ return !finSet.has(String(e.ticker || '').toUpperCase()); });
    if (!missing.length) { panel.innerHTML = '<div style="padding:16px;color:var(--green);">✓ Toutes les entreprises ont au moins un financial</div>'; return; }
    panel.innerHTML = '<div class="tw"><table style="font-size:12px;"><thead><tr><th>Ticker</th></tr></thead><tbody>' +
        missing.map(function(e){ return '<tr><td>' + e.ticker + '</td></tr>'; }).join('') + '</tbody></table></div>';
}

/* Load the read-only historical quality dashboard without changing the existing diagnostic logic. */
(function loadHistoricalQualityModule(){
    var s=document.createElement('script');
    s.src='/admin/js/historique/historique-quality.js';
    s.async=false;
    s.onload=function(){
        setTimeout(function(){
            var panel=document.getElementById('panel-historique');
            if(!panel || document.getElementById('hist-quality-dashboard')) return;
            var host=document.createElement('div');
            host.id='hist-quality-dashboard';
            panel.insertBefore(host,panel.firstChild);
            if(typeof loadHistoriqueQualityDashboard==='function') loadHistoriqueQualityDashboard();
        },300);
    };
    s.onerror=function(){console.warn('[DIAGNOSTIC] historique-quality.js indisponible');};
    document.head.appendChild(s);
})();
