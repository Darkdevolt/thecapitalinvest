/* ============================================================
   THE CAPITAL — TABLEAU DE BORD
   État réel de la base : volumétrie par table, dernière séance
   effectivement enregistrée, anomalies bloquantes et couverture
   des données par société. Aucun chiffre décoratif.
   ============================================================ */
'use strict';

(function (TC) {

    const TABLES = [
        { t: 'entreprises', label: 'Sociétés', go: 'entreprises' },
        { t: 'historique', label: 'Cotations', go: 'cours' },
        { t: 'indices', label: 'Indices', go: 'indices' },
        { t: 'financials', label: 'États financiers', go: 'financials' },
        { t: 'dividendes_calendrier', label: 'Dividendes', go: 'dividendes' },
        { t: 'analyses', label: 'Analyses', go: 'analyses' },
        { t: 'users', label: 'Comptes', go: 'utilisateurs' }
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Tableau de <em>bord</em></div>' +
            '<div class="page-sub">Situation réelle de la base au moment de l\'affichage. Chaque compteur est lu directement dans Supabase ; un compteur à zéro signale une table vide, absente, ou fermée par une règle RLS.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="dash-reload">↺ Actualiser</button></div>' +
            '</div>' +

            '<div class="kpis" id="dash-kpis"></div>' +

            '<div class="grid-2">' +
            '<div class="card"><div class="card-head"><span class="card-title">Dernière séance enregistrée</span>' +
            '<span class="card-tools"><span class="card-count" id="dash-session-date"></span></span></div>' +
            '<div id="dash-session"><div class="loading"><div class="spinner"></div>Lecture de la dernière séance…</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Points de contrôle</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="dash-to-diag">Ouvrir le diagnostic</button></span></div>' +
            '<div id="dash-alerts"><div class="loading"><div class="spinner"></div>Contrôles en cours…</div></div></div>' +
            '</div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Couverture par société</span>' +
            '<span class="card-tools"><span class="card-count" id="dash-cov-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="dash-cov-export">⬇ Exporter (CSV)</button></span></div>' +
            '<div class="tw capped" id="dash-coverage"><div class="loading"><div class="spinner"></div>Croisement du référentiel…</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Actions courantes</span></div>' +
            '<div class="card-body"><div class="tpl-grid">' +
            '<button class="tpl" data-go="scraper"><div class="ico">⬇</div><div class="nm">Récupérer la séance du jour</div><div class="ds">Lancer le scraper BRVM, contrôler puis valider avant écriture.</div></button>' +
            '<button class="tpl" data-go="cours"><div class="ico">✎</div><div class="nm">Corriger une cotation</div><div class="ds">Rechercher une séance, modifier ou supprimer une ligne.</div></button>' +
            '<button class="tpl" data-go="import"><div class="ico">▤</div><div class="nm">Importer un fichier Excel</div><div class="ds">Modèles, contrôle ligne à ligne puis insertion par lots.</div></button>' +
            '<button class="tpl" data-go="reporting"><div class="ico">◈</div><div class="nm">Produire un reporting</div><div class="ds">Séance, semaine, mois, trimestre ou année, prêt à publier.</div></button>' +
            '</div></div></div>';
    }

    async function loadCounts() {
        const host = TC.el('dash-kpis');
        host.innerHTML = TABLES.map(x =>
            '<div class="kpi clickable" data-go="' + x.go + '"><div class="kpi-label">' + TC.esc(x.label) +
            '</div><div class="kpi-value" id="k-' + x.t + '">…</div>' +
            '<div class="kpi-sub" id="ks-' + x.t + '">' + x.t + '</div></div>').join('');

        await Promise.all(TABLES.map(async function (x) {
            const res = await TC.count(x.t);
            const value = TC.el('k-' + x.t);
            const sub = TC.el('ks-' + x.t);
            if (!value) return;
            value.textContent = res.ok ? res.value.toLocaleString('fr-FR') : '—';
            if (!res.ok) {
                value.style.color = 'var(--red)';
                sub.textContent = 'table illisible';
                sub.style.color = 'var(--red)';
            } else if (res.value === 0) {
                value.style.color = 'var(--orange)';
                sub.textContent = 'aucune donnée';
                sub.style.color = 'var(--orange)';
            } else {
                sub.textContent = x.t;
            }
        }));
    }

    async function loadSession() {
        const host = TC.el('dash-session');
        const latest = await TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1');
        const date = latest && latest[0] && latest[0].date_seance;
        if (!date) {
            host.innerHTML = '<div class="empty-state"><strong>Aucune cotation en base</strong>' +
                'Lancez le scraper BRVM ou importez un fichier de cours pour amorcer l\'historique.</div>';
            return;
        }
        TC.el('dash-session-date').textContent = TC.fmtDateLong(date);

        const rows = await TC.getAll('historique',
            'select=ticker,cours_cloture,cloture,variation,volume,valeur_totale&date_seance=eq.' + date);
        const clean = (rows || []).filter(r => !TC.isIndice(r.ticker));
        const close = r => TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        const up = clean.filter(r => TC.toNumber(r.variation) > 0).length;
        const down = clean.filter(r => TC.toNumber(r.variation) < 0).length;
        const flat = clean.length - up - down;
        const volume = clean.reduce((s, r) => s + (TC.toNumber(r.volume) || 0), 0);
        const value = clean.reduce((s, r) => s + (TC.toNumber(r.valeur_totale) || 0), 0);
        const noClose = clean.filter(r => close(r) === null).length;

        const sorted = clean.slice().sort((a, b) => (TC.toNumber(b.variation) || 0) - (TC.toNumber(a.variation) || 0));
        const best = sorted.slice(0, 3);
        const worst = sorted.slice(-3).reverse();

        host.innerHTML =
            '<div class="card-body tight" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;">' +
            stat('Titres cotés', clean.length) +
            stat('Hausse', up, 'up') + stat('Baisse', down, 'down') + stat('Stables', flat) +
            stat('Volume', TC.fmtInt(volume)) +
            stat('Valeur échangée', TC.fmtInt(value) + ' F') +
            '</div>' +
            (noClose ? '<div class="card-body tight"><div class="note err"><strong>' + noClose +
                ' cotation(s) sans cours de clôture</strong> sur cette séance. Corrigez-les dans Cours &amp; historique.</div></div>' : '') +
            '<div class="card-body tight"><div class="grid-2" style="gap:12px;">' +
            miniList('Plus fortes hausses', best, close) +
            miniList('Plus fortes baisses', worst, close) +
            '</div></div>';
    }

    function stat(label, value, cls) {
        return '<div><div class="kpi-label">' + TC.esc(label) + '</div>' +
            '<div class="kpi-value sm ' + (cls || '') + '">' + TC.esc(String(value)) + '</div></div>';
    }

    function miniList(title, rows, close) {
        if (!rows.length) return '';
        return '<div><div class="card-title" style="margin-bottom:8px;">' + TC.esc(title) + '</div>' +
            rows.map(r =>
                '<div style="display:flex;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border-s);">' +
                '<span class="td-key" style="font-size:13px;">' + TC.esc(r.ticker) + '</span>' +
                '<span class="td-mono td-muted">' + TC.fmt(close(r)) + '</span>' +
                '<span class="td-mono ' + TC.trendClass(r.variation) + '" style="margin-left:auto;">' +
                TC.fmtPct(r.variation) + '</span></div>').join('') + '</div>';
    }

    async function loadAlerts() {
        const host = TC.el('dash-alerts');
        const today = TC.today();

        const checks = await Promise.all([
            TC.count('historique', 'or=(cours_cloture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0)'),
            TC.count('historique', 'and=(plus_haut.not.is.null,plus_bas.not.is.null,plus_haut.lt.plus_bas)'),
            TC.count('historique', 'date_seance=gt.' + today),
            TC.count('historique', 'and=(cours_cloture.is.null,cloture.is.null)'),
            TC.count('historique', 'or=(variation.gt.' + TC.VARIATION_LIMIT + ',variation.lt.-' + TC.VARIATION_LIMIT + ')'),
            TC.count('financials', 'or=(source.is.null,source.eq.)'),
            TC.count('dividendes_calendrier', 'montant.is.null')
        ]);

        const items = [
            { label: 'Valeurs négatives impossibles', n: checks[0].value, level: 'err', go: 'diagnostic' },
            { label: 'Plus haut inférieur au plus bas', n: checks[1].value, level: 'err', go: 'diagnostic' },
            { label: 'Séances datées dans le futur', n: checks[2].value, level: 'err', go: 'cours' },
            { label: 'Cotations sans cours de clôture', n: checks[3].value, level: 'err', go: 'cours' },
            { label: 'Variations hors limite ±' + TC.VARIATION_LIMIT + ' %', n: checks[4].value, level: 'warn', go: 'diagnostic' },
            { label: 'États financiers sans source', n: checks[5].value, level: 'warn', go: 'financials' },
            { label: 'Dividendes sans montant', n: checks[6].value, level: 'warn', go: 'dividendes' }
        ];

        const flagged = items.filter(i => i.n > 0);
        const critical = flagged.filter(i => i.level === 'err').reduce((s, i) => s + i.n, 0);
        TC.badge('diagnostic', critical);

        if (!flagged.length) {
            host.innerHTML = '<div class="empty-state"><strong>Aucune anomalie bloquante</strong>' +
                'Les sept contrôles rapides passent. Le diagnostic complet couvre en plus la traçabilité et la couverture.</div>';
            return;
        }

        host.innerHTML = '<div class="tw"><table><tbody>' + flagged.map(i =>
            '<tr><td><span class="badge ' + (i.level === 'err' ? 'badge-red' : 'badge-orange') + '">' +
            (i.level === 'err' ? 'Bloquant' : 'À vérifier') + '</span></td>' +
            '<td>' + TC.esc(i.label) + '</td>' +
            '<td class="r td-mono">' + i.n.toLocaleString('fr-FR') + '</td>' +
            '<td class="r"><button class="btn btn-outline btn-sm" data-go="' + i.go + '">Traiter</button></td></tr>'
        ).join('') + '</tbody></table></div>';
    }

    let coverage = [];

    async function loadCoverage() {
        const host = TC.el('dash-coverage');
        const [refs, fins, divs, hist] = await Promise.all([
            TC.tickers(true),
            TC.getAll('financials', 'select=ticker,annee&order=ticker.asc'),
            TC.getAll('dividendes_calendrier', 'select=ticker,annee&order=ticker.asc'),
            TC.getAll('historique', 'select=ticker&order=ticker.asc')
        ]);

        const tally = list => {
            const map = {};
            (list || []).forEach(r => {
                const key = String(r.ticker || '').toUpperCase();
                if (!key) return;
                map[key] = (map[key] || 0) + 1;
            });
            return map;
        };
        const finMap = tally(fins), divMap = tally(divs), histMap = tally(hist);

        coverage = refs.map(r => {
            const key = String(r.ticker).toUpperCase();
            const row = {
                ticker: r.ticker, nom: r.nom || '', secteur: r.secteur || '',
                cotations: histMap[key] || 0, financials: finMap[key] || 0, dividendes: divMap[key] || 0,
                actions: TC.toNumber(r.nombre_actions || r.nb_actions) || 0
            };
            row.manques = ['cotations', 'financials', 'dividendes'].filter(k => !row[k]).length + (row.actions ? 0 : 1);
            return row;
        }).sort((a, b) => b.manques - a.manques || a.ticker.localeCompare(b.ticker));

        const incomplete = coverage.filter(r => r.manques > 0).length;
        TC.el('dash-cov-count').textContent = incomplete + ' société(s) incomplète(s) sur ' + coverage.length;

        if (!coverage.length) {
            host.innerHTML = '<div class="empty-state"><strong>Référentiel vide</strong>Ajoutez les sociétés cotées avant tout import de cours.</div>';
            return;
        }

        host.innerHTML = '<table><thead><tr>' +
            '<th>Ticker</th><th>Société</th><th>Secteur</th>' +
            '<th class="r">Cotations</th><th class="r">États fin.</th><th class="r">Dividendes</th>' +
            '<th class="r">Nb actions</th><th>Manques</th></tr></thead><tbody>' +
            coverage.map(r =>
                '<tr class="' + (r.manques >= 2 ? 'row-flag' : r.manques === 1 ? 'row-warn' : '') + '">' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td>' + TC.esc(r.nom || '—') + '</td>' +
                '<td class="td-muted">' + TC.esc(r.secteur || '—') + '</td>' +
                cell(r.cotations) + cell(r.financials) + cell(r.dividendes) +
                '<td class="r td-mono' + (r.actions ? '' : ' down') + '">' + (r.actions ? TC.fmtInt(r.actions) : 'absent') + '</td>' +
                '<td>' + (r.manques ? '<span class="badge badge-orange">' + r.manques + '</span>' : '<span class="badge badge-green">complet</span>') + '</td>' +
                '</tr>').join('') + '</tbody></table>';
    }

    function cell(n) {
        return '<td class="r td-mono' + (n ? '' : ' down') + '">' + (n ? n.toLocaleString('fr-FR') : '0') + '</td>';
    }

    function refresh() {
        loadCounts();
        loadSession();
        loadAlerts();
        loadCoverage();
    }

    TC.register({
        id: 'dashboard',
        label: 'Tableau de bord',
        group: 'pilotage',
        icon: '◧',
        keywords: 'accueil kpi synthese vue ensemble',
        view,
        refresh,
        mount() {
            TC.on('dash-reload', 'click', refresh);
            TC.on('dash-to-diag', 'click', () => TC.go('diagnostic'));
            TC.on('dash-cov-export', 'click', function () {
                if (!coverage.length) { TC.toast('Rien à exporter pour le moment', 'info'); return; }
                TC.download('couverture-donnees-' + TC.today() + '.csv',
                    TC.toCSV(coverage, ['ticker', 'nom', 'secteur', 'cotations', 'financials', 'dividendes', 'actions', 'manques']),
                    'text/csv;charset=utf-8');
            });
            TC.delegate('panel-dashboard', '[data-go]', 'click', node => TC.go(node.dataset.go));
            refresh();
        }
    });

})(window.TC);
