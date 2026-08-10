/* THE CAPITAL ADMIN — DASHBOARD DE PILOTAGE DATA */

function dashEsc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

async function loadDashboard() {
    var info = document.getElementById('dash-info');
    if (!info) return;
    info.innerHTML = '<div class="dash-loading"><div class="spinner"></div><span>Analyse de la base…</span></div>';

    var started = Date.now();
    var tables = ['entreprises', 'cours', 'historique', 'financials', 'dividendes_calendrier', 'users'];
    var counts = await Promise.all(tables.map(function(t) { return sbCount(t); }));
    var c = { entreprises: counts[0], cours: counts[1], historique: counts[2], financials: counts[3], dividendes: counts[4], users: counts[5] };

    var latest = await Promise.all([
        dashLatest('cours', 'date_seance'),
        dashLatest('historique', 'date_seance'),
        dashLatest('financials', 'updated_at'),
        dashLatest('dividendes_calendrier', 'updated_at')
    ]);

    var ids = { 'k-entreprises': c.entreprises, 'k-cours': c.cours, 'k-historique': c.historique, 'k-financials': c.financials, 'k-dividendes': c.dividendes, 'k-users': c.users };
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

    var critical = aberrations.filter(function(a) { return a.severity === 'err'; }).length;
    var warnings = aberrations.filter(function(a) { return a.severity !== 'err'; }).length;
    var quality = diagAvailable ? Math.max(0, Math.min(100, 100 - critical * 5 - warnings)) : null;
    var healthClass = quality === null ? 'neutral' : quality >= 95 ? 'good' : quality >= 80 ? 'warn' : 'bad';
    var healthText = quality === null ? 'Contrôle indisponible' : quality + '/100';

    var freshness = [
        { name: 'Cours', date: latest[0], panel: 'cours' },
        { name: 'Historique', date: latest[1], panel: 'historique' },
        { name: 'Financials', date: latest[2], panel: 'financials' },
        { name: 'Dividendes', date: latest[3], panel: 'dividendes' }
    ];

    var actions = [];
    if (critical) actions.push({ level: 'critical', title: critical + ' anomalie(s) critique(s)', detail: 'À corriger avant de considérer la base fiable.', panel: 'diagnostic' });
    if (warnings) actions.push({ level: 'warning', title: warnings + ' avertissement(s)', detail: 'Données à vérifier ou à compléter.', panel: 'diagnostic' });
    if (!c.entreprises) actions.push({ level: 'critical', title: 'Aucune entreprise référencée', detail: 'Le référentiel titres doit être créé avant les financials.', panel: 'entreprises' });
    if (!c.financials) actions.push({ level: 'warning', title: 'Aucun financial enregistré', detail: 'La Financial Database est encore vide.', panel: 'financials' });
    freshness.forEach(function(x) {
        if (x.date && dashAgeLabel(x.date).cls === 'bad') actions.push({ level: 'warning', title: x.name + ' non récent', detail: 'Dernière donnée : ' + dashDate(x.date), panel: x.panel });
    });

    var html = '<div class="dash-health-grid">';
    html += '<div class="dash-health-card ' + healthClass + '"><div class="dash-mini-label">QUALITÉ DE LA BASE</div><div class="dash-score">' + healthText + '</div><div class="dash-muted">' + (diagAvailable ? (critical + ' critique(s) · ' + warnings + ' avertissement(s)') : 'Diagnostic non disponible') + '</div></div>';
    html += '<div class="dash-health-card"><div class="dash-mini-label">DERNIÈRE ACTIVITÉ</div><div class="dash-score small">' + dashDate(latest[0] || latest[1] || latest[2] || latest[3]) + '</div><div class="dash-muted">Cours / données de marché</div></div>';
    html += '<div class="dash-health-card"><div class="dash-mini-label">PERFORMANCE</div><div class="dash-score small">' + (Date.now() - started) + ' ms</div><div class="dash-muted">Temps de lecture du dashboard</div></div></div>';

    html += '<div class="dash-section-title">Fraîcheur des données</div><div class="dash-fresh-grid">';
    freshness.forEach(function(x) {
        var st = dashAgeLabel(x.date);
        html += '<div class="dash-fresh-row"><div><strong>' + dashEsc(x.name) + '</strong><span>' + (x.date ? dashDate(x.date) : 'Aucune donnée') + '</span></div><span class="dash-status ' + st.cls + '">' + dashEsc(st.text) + '</span></div>';
    });
    html += '</div>';

    html += '<div class="dash-section-title">File d’actions</div>';
    if (!actions.length) {
        html += '<div class="dash-empty good">✓ Aucun point prioritaire détecté. La base est prête pour la vérification manuelle.</div>';
    } else {
        html += '<div class="dash-actions">';
        actions.slice(0, 8).forEach(function(a) {
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
        ['Diagnostic', critical + warnings, 'Contrôles qualité', 'diagnostic']
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
            html += '<div class="dash-anomaly-row"><div><strong>' + dashEsc(item.ticker || '—') + '</strong><span>' + dashEsc(item.date_seance || '—') + '</span></div><div><span>' + dashEsc(item.valeur_actuelle || '—') + '</span><small>' + dashEsc(item.valeur_attendue || '—') + '</small></div><em>' + dashEsc(item.source_table || '—') + '</em></div>';
        });
        var target = items[0].source_table === 'historique' ? 'historique' : 'cours';
        html += '<button class="dash-anomaly-link" onclick="switchTab(\'' + target + '\')">→ Ouvrir ' + dashEsc(target) + '</button></div>';
    });
    panel.innerHTML = html;
}
