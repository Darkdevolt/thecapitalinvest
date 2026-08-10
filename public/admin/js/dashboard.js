/* THE CAPITAL ADMIN — DASHBOARD DE PILOTAGE DATA */

function dashEsc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}
function dashNum(value) { return Number(value || 0).toLocaleString('fr-FR'); }
function dashDate(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('fr-FR');
}
function dashAgeLabel(value) {
    if (!value) return { text: 'Aucune donnée', cls: 'bad' };
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return { text: 'Date invalide', cls: 'bad' };
    var age = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (age <= 1) return { text: 'À jour', cls: 'good' };
    if (age <= 7) return { text: age + ' j', cls: 'warn' };
    return { text: age + ' j', cls: 'bad' };
}

async function dashLatest(table, dateField) {
    try {
        var rows = await sbGet(table, 'select=' + encodeURIComponent(dateField) + '&' + encodeURIComponent(dateField) + '=not.is.null&order=' + encodeURIComponent(dateField) + '.desc&limit=1');
        return rows && rows[0] ? rows[0][dateField] : null;
    } catch (e) { return null; }
}

async function dashFinancialQuality() {
    try {
        var rows = await sbGet('financials', 'select=validation_status,source,source_url&limit=1000');
        rows = Array.isArray(rows) ? rows : [];
        return {
            total: rows.length,
            validated: rows.filter(function(r){ return r.validation_status === 'validated'; }).length,
            review: rows.filter(function(r){ return r.validation_status === 'review'; }).length,
            draft: rows.filter(function(r){ return !r.validation_status || r.validation_status === 'draft'; }).length,
            missingSource: rows.filter(function(r){ return !r.source || !String(r.source).trim(); }).length,
            missingUrl: rows.filter(function(r){ return !r.source_url || !String(r.source_url).trim(); }).length
        };
    } catch (e) {
        return { total: 0, validated: 0, review: 0, draft: 0, missingSource: 0, missingUrl: 0 };
    }
}

async function dashForecastQuality() {
    try {
        var rows = await sbGet('forecasts', 'select=ticker,annee_forecast,metrique,methode,valeur,valeur_cible,potentiel_pct,calcule_le&limit=1000');
        rows = Array.isArray(rows) ? rows : [];
        var currentYear = new Date().getFullYear();
        return {
            total: rows.length,
            future: rows.filter(function(r){ return Number(r.annee_forecast) >= currentYear; }).length,
            stale: rows.filter(function(r){ return Number(r.annee_forecast) < currentYear; }).length,
            noMethod: rows.filter(function(r){ return !r.methode || !String(r.methode).trim(); }).length,
            extreme: rows.filter(function(r){ return r.potentiel_pct != null && Math.abs(Number(r.potentiel_pct)) > 100; }).length
        };
    } catch (e) {
        return { total: 0, future: 0, stale: 0, noMethod: 0, extreme: 0 };
    }
}

async function dashFinancialAnomalies() {
    try {
        var resp = await fetch(SB_REST + '/rpc/get_financial_anomalies', {
            method: 'POST',
            headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + TK, 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit_per_type: 50 })
        });
        if (!resp.ok) return [];
        var rows = await resp.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.warn('[dashboard] financial anomalies:', e);
        return [];
    }
}

function dashAnomalyTarget(sourceTable) {
    if (sourceTable === 'historique') return 'historique';
    if (sourceTable === 'financials' || sourceTable === 'financials_annuels' || sourceTable === 'financials_infrannuels' || sourceTable === 'forecasts') return 'financials';
    if (sourceTable === 'dividendes_calendrier') return 'dividendes';
    return 'cours';
}

async function loadDashboard() {
    var info = document.getElementById('dash-info');
    if (!info) return;
    info.innerHTML = '<div class="dash-loading"><div class="spinner"></div><span>Analyse de la base…</span></div>';

    var started = Date.now();
    var tables = ['entreprises', 'cours', 'historique', 'financials', 'financials_annuels', 'financials_infrannuels', 'dividendes_calendrier', 'users'];
    var counts = await Promise.all(tables.map(function(t) { return sbCount(t); }));
    var c = {
        entreprises: counts[0], cours: counts[1], historique: counts[2], financials: counts[3],
        financials_annuels: counts[4], financials_infrannuels: counts[5], dividendes: counts[6], users: counts[7]
    };
    var fq = await dashFinancialQuality();
    var forecast = await dashForecastQuality();

    var latest = await Promise.all([
        dashLatest('cours', 'date_seance'),
        dashLatest('historique', 'date_seance'),
        dashLatest('financials', 'updated_at'),
        dashLatest('financials_annuels', 'created_at'),
        dashLatest('dividendes_calendrier', 'created_at')
    ]);

    var ids = {
        'k-entreprises': c.entreprises, 'k-cours': c.cours, 'k-historique': c.historique,
        'k-financials': c.financials, 'k-dividendes': c.dividendes, 'k-users': c.users
    };
    Object.keys(ids).forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = dashNum(ids[id]); });
    var kc = document.getElementById('ks-cours'); if (kc) kc.textContent = latest[0] ? 'Dernier cours : ' + dashDate(latest[0]) : 'Aucune date disponible';
    var ku = document.getElementById('ks-users'); if (ku) ku.textContent = 'Comptes enregistrés';

    var aberrations = [];
    var diagAvailable = false;
    try {
        var resp = await fetch(SB_REST + '/rpc/get_aberrations', {
            method: 'POST',
            headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + TK, 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit_per_type: 50 })
        });
        if (resp.ok) { aberrations = await resp.json(); diagAvailable = true; }
    } catch (e) { console.warn('[dashboard] diagnostic RPC:', e); }

    var financialAnomalies = await dashFinancialAnomalies();
    var critical = aberrations.filter(function(a) { return a.severity === 'err'; }).length;
    var warnings = aberrations.filter(function(a) { return a.severity !== 'err'; }).length;
    var financialCritical = financialAnomalies.filter(function(a){ return a.severity === 'err'; }).length;
    var financialWarnings = financialAnomalies.filter(function(a){ return a.severity !== 'err'; }).length;
    var provenanceIssues = fq.missingSource + fq.missingUrl;
    var quality = diagAvailable ? Math.max(0, Math.min(100, 100 - critical * 5 - warnings - (fq.total ? Math.round((provenanceIssues / (fq.total * 2)) * 20) : 0))) : null;
    var healthClass = quality === null ? 'neutral' : quality >= 95 ? 'good' : quality >= 80 ? 'warn' : 'bad';
    var healthText = quality === null ? 'Contrôle indisponible' : quality + '/100';

    var freshness = [
        { name: 'Cours', date: latest[0], panel: 'cours' },
        { name: 'Historique', date: latest[1], panel: 'historique' },
        { name: 'Financials', date: latest[2], panel: 'financials' },
        { name: 'Financials annuels', date: latest[3], panel: 'financials' },
        { name: 'Dividendes', date: latest[4], panel: 'dividendes' }
    ];

    var actions = [];
    if (critical) actions.push({ level: 'critical', title: critical + ' anomalie(s) critique(s)', detail: 'À corriger avant de considérer la base fiable.', panel: 'diagnostic' });
    if (warnings) actions.push({ level: 'warning', title: warnings + ' avertissement(s)', detail: 'Données à vérifier ou à compléter.', panel: 'diagnostic' });
    if (financialCritical) actions.push({ level: 'critical', title: financialCritical + ' anomalie(s) financières critique(s)', detail: 'Doublons, années futures ou incohérences structurelles.', panel: 'financials' });
    if (financialWarnings) actions.push({ level: 'warning', title: financialWarnings + ' contrôle(s) financier(s) à revoir', detail: 'Ratios, provenance ou prévisions nécessitent une revue.', panel: 'financials' });
    if (fq.total && fq.validated < fq.total) actions.push({ level: 'warning', title: (fq.total - fq.validated) + ' financial(s) non validé(s)', detail: fq.draft + ' brouillon(s) · ' + fq.review + ' en revue.', panel: 'financials' });
    if (fq.missingSource) actions.push({ level: 'warning', title: fq.missingSource + ' financial(s) sans source', detail: 'Ajouter uniquement une source réellement vérifiable.', panel: 'financials' });
    if (fq.missingUrl) actions.push({ level: 'warning', title: fq.missingUrl + ' financial(s) sans URL source', detail: 'La provenance doit rester traçable.', panel: 'financials' });
    if (forecast.stale) actions.push({ level: 'warning', title: forecast.stale + ' prévision(s) dépassée(s)', detail: 'Actualiser ou archiver les scénarios dont l’année cible est passée.', panel: 'financials' });
    if (forecast.noMethod) actions.push({ level: 'warning', title: forecast.noMethod + ' prévision(s) sans méthode', detail: 'Une prévision doit indiquer sa méthode de calcul.', panel: 'financials' });
    if (forecast.extreme) actions.push({ level: 'warning', title: forecast.extreme + ' prévision(s) à potentiel extrême', detail: 'Revue manuelle recommandée avant publication.', panel: 'financials' });
    if (!c.entreprises) actions.push({ level: 'critical', title: 'Aucune entreprise référencée', detail: 'Le référentiel titres doit être créé avant les financials.', panel: 'entreprises' });
    freshness.forEach(function(x) {
        if (x.date && dashAgeLabel(x.date).cls === 'bad') actions.push({ level: 'warning', title: x.name + ' non récent', detail: 'Dernière donnée : ' + dashDate(x.date), panel: x.panel });
    });

    var html = '<div class="dash-health-grid">';
    html += '<div class="dash-health-card ' + healthClass + '"><div class="dash-mini-label">QUALITÉ DE LA BASE</div><div class="dash-score">' + healthText + '</div><div class="dash-muted">' + (diagAvailable ? (critical + ' critique(s) · ' + warnings + ' avertissement(s)') : 'Diagnostic non disponible') + '</div></div>';
    html += '<div class="dash-health-card"><div class="dash-mini-label">QUALITÉ FINANCIÈRE</div><div class="dash-score small">' + dashNum(financialAnomalies.length) + '</div><div class="dash-muted">' + financialCritical + ' critique(s) · ' + financialWarnings + ' à revoir</div></div>';
    html += '<div class="dash-health-card"><div class="dash-mini-label">PRÉVISIONS</div><div class="dash-score small">' + dashNum(forecast.future) + '</div><div class="dash-muted">scénario(s) futur(s) · ' + dashNum(forecast.noMethod) + ' sans méthode</div></div></div>';

    html += '<div class="dash-section-title">Fraîcheur des données</div><div class="dash-fresh-grid">';
    freshness.forEach(function(x) {
        var st = dashAgeLabel(x.date);
        html += '<div class="dash-fresh-row"><div><strong>' + dashEsc(x.name) + '</strong><span>' + (x.date ? dashDate(x.date) : 'Aucune donnée') + '</span></div><span class="dash-status ' + st.cls + '">' + dashEsc(st.text) + '</span></div>';
    });
    html += '</div>';

    html += '<div class="dash-section-title">Contrôles financiers & anticipation</div><div class="dash-module-grid">';
    [
        ['Anomalies financières', financialAnomalies.length, 'Cohérence, doublons, ratios, sources', 'diagnostic'],
        ['Prévisions', forecast.total, 'Scénarios et signaux à revoir', 'financials'],
        ['Financials validés', fq.validated, 'Données avec workflow de validation', 'financials'],
        ['Financials à revoir', fq.total - fq.validated, 'Brouillons et revues en attente', 'financials']
    ].forEach(function(m) {
        html += '<button class="dash-module" onclick="switchTab(\'' + m[3] + '\')"><div><strong>' + dashEsc(m[0]) + '</strong><span>' + dashEsc(m[2]) + '</span></div><b>' + dashNum(m[1]) + '</b></button>';
    });
    html += '</div>';

    html += '<div class="dash-section-title">Structure Financial Database</div><div class="dash-module-grid">';
    [
        ['Financials', c.financials, 'États financiers généraux', 'financials'],
        ['Annuels', c.financials_annuels, 'Données annuelles', 'financials'],
        ['Infrannuels', c.financials_infrannuels, 'Données intermédiaires', 'financials'],
        ['Dividendes', c.dividendes, 'Calendrier et historique', 'dividendes']
    ].forEach(function(m) {
        html += '<button class="dash-module" onclick="switchTab(\'' + m[3] + '\')"><div><strong>' + dashEsc(m[0]) + '</strong><span>' + dashEsc(m[2]) + '</span></div><b>' + dashNum(m[1]) + '</b></button>';
    });
    html += '</div>';

    html += '<div class="dash-section-title">File d’actions</div>';
    if (!actions.length) {
        html += '<div class="dash-empty good">✓ Aucun point prioritaire détecté. La base est prête pour la vérification manuelle.</div>';
    } else {
        html += '<div class="dash-actions">';
        actions.slice(0, 12).forEach(function(a) {
            html += '<div class="dash-action ' + a.level + '"><div><strong>' + dashEsc(a.title) + '</strong><span>' + dashEsc(a.detail) + '</span></div><button onclick="switchTab(\'' + dashEsc(a.panel) + '\')">Voir →</button></div>';
        });
        html += '</div>';
    }

    html += '<div class="dash-section-title">Modules de gestion</div><div class="dash-module-grid">';
    [
        ['Entreprises', c.entreprises, 'Référentiel des émetteurs', 'entreprises'],
        ['Cours', c.cours, 'Données de marché', 'cours'],
        ['Historique', c.historique, 'Séries historiques', 'historique'],
        ['Financials', c.financials, 'États financiers', 'financials'],
        ['Dividendes', c.dividendes, 'Calendrier et historique', 'dividendes'],
        ['Diagnostic', critical + warnings + financialAnomalies.length, 'Contrôles qualité et anticipation', 'diagnostic']
    ].forEach(function(m) {
        html += '<button class="dash-module" onclick="switchTab(\'' + m[3] + '\')"><div><strong>' + dashEsc(m[0]) + '</strong><span>' + dashEsc(m[2]) + '</span></div><b>' + dashNum(m[1]) + '</b></button>';
    });
    html += '</div>';
    info.innerHTML = html;

    var ts = document.getElementById('dash-ts');
    if (ts) ts.textContent = 'Actualisé à ' + new Date().toLocaleTimeString('fr-FR');
    await loadDashboardAlerts(aberrations, diagAvailable);
}

async function loadDashboardAlerts(prefetched, prefetchedAvailable) {
    var panel = document.getElementById('dash-alerts');
    if (!panel) return;
    var aberrations = Array.isArray(prefetched) ? prefetched : [];
    var available = !!prefetchedAvailable;
    if (!available) {
        try {
            var resp = await fetch(SB_REST + '/rpc/get_aberrations', {
                method: 'POST',
                headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + TK, 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit_per_type: 10 })
            });
            if (resp.ok) { aberrations = await resp.json(); available = true; }
        } catch(e) { console.error('Erreur RPC get_aberrations:', e); }
    }
    if (!available) { panel.innerHTML = '<div class="dash-empty neutral">⚠ Le contrôle automatique des anomalies est indisponible. Ouvrez <strong>Diagnostic</strong> pour vérifier la configuration.</div>'; return; }
    if (!aberrations || aberrations.length === 0) { panel.innerHTML = '<div class="dash-empty good">✓ Aucune anomalie détectée par le contrôle automatique.</div>'; return; }

    var errs = aberrations.filter(function(a){ return a.severity === 'err'; }).length;
    var warns = aberrations.length - errs;
    var html = '<div class="dash-alert-summary"><span class="critical">● ' + errs + ' CRITIQUE(S)</span><span class="warning">● ' + warns + ' AVERTISSEMENT(S)</span><span>' + aberrations.length + ' ligne(s) concernée(s)</span></div>';
    var byType = {};
    aberrations.forEach(function(a){ var type = a.anomalie_type || 'Anomalie'; if (!byType[type]) byType[type] = []; byType[type].push(a); });

    Object.keys(byType).forEach(function(type){
        var items = byType[type];
        var isErr = items.some(function(i){ return i.severity === 'err'; });
        html += '<div class="dash-anomaly-group ' + (isErr ? 'critical' : 'warning') + '"><div class="dash-anomaly-head"><strong>' + dashEsc(type) + '</strong><span>' + items.length + '</span></div>';
        items.slice(0, 10).forEach(function(item){
            var period = item.date_seance || item.periode || '—';
            html += '<div class="dash-anomaly-row"><div><strong>' + dashEsc(item.ticker || '—') + '</strong><span>' + dashEsc(period) + '</span></div><div><span>' + dashEsc(item.valeur_actuelle || '—') + '</span><small>' + dashEsc(item.valeur_attendue || '—') + '</small></div><em>' + dashEsc(item.source_table || '—') + '</em></div>';
        });
        var target = dashAnomalyTarget(items[0].source_table);
        html += '<button class="dash-anomaly-link" onclick="switchTab(\'' + target + '\')">→ Ouvrir ' + dashEsc(target) + '</button></div>';
    });
    panel.innerHTML = html;
}
