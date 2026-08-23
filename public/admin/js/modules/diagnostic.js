/* ============================================================
   THE CAPITAL — DIAGNOSTIC
   Le diagnostic vit dans l'espace d'administration, plus dans une
   page séparée ouverte dans un onglet. Il répond à trois questions
   dans l'ordre : les tables répondent-elles, les données sont-elles
   cohérentes, la couverture est-elle suffisante pour que
   l'application publique affiche quelque chose de juste.
   ============================================================ */
'use strict';

(function (TC) {

    let report = null;

    /* Chaque contrôle est déclaratif : libellé, gravité, requête,
       section concernée et geste de correction quand il existe. */
    const CONTROLES = [
        {
            id: 'cours-negatifs', label: 'Cotations à valeur négative', gravite: 'critique',
            table: 'historique', filtre: 'or=(cours_cloture.lt.0,cours_ouverture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0)',
            effet: 'Un prix négatif casse les graphiques et fausse toute performance calculée.',
            go: 'cours'
        },
        {
            id: 'cours-ohlc', label: 'Plus haut inférieur au plus bas', gravite: 'critique',
            table: 'historique', filtre: 'and=(plus_haut.not.is.null,plus_bas.not.is.null,plus_haut.lt.plus_bas)',
            effet: 'Les bornes de séance sont inversées : les chandeliers sont illisibles.',
            go: 'cours'
        },
        {
            id: 'cours-futur', label: 'Séances datées dans le futur', gravite: 'critique',
            table: 'historique', filtre: () => 'date_seance=gt.' + TC.today(),
            effet: 'Une séance future devient le « dernier cours » et contamine tous les rendements.',
            go: 'cours'
        },
        {
            id: 'cours-sans-cloture', label: 'Cotations sans cours de clôture', gravite: 'critique',
            table: 'historique', filtre: 'and=(cours_cloture.is.null,cloture.is.null)',
            effet: 'La valeur n\'a pas de prix : elle disparaît des listes et des calculs.',
            go: 'cours'
        },
        {
            id: 'cours-limite', label: 'Variations hors limite ±' + TC.VARIATION_LIMIT + ' %', gravite: 'alerte',
            table: 'historique', filtre: 'or=(variation.gt.' + TC.VARIATION_LIMIT + ',variation.lt.-' + TC.VARIATION_LIMIT + ')',
            effet: 'La BRVM plafonne la variation quotidienne. Au-delà, il s\'agit d\'une erreur de saisie ou d\'un ajustement non signalé.',
            go: 'cours'
        },
        {
            id: 'cours-sans-variation', label: 'Cotations sans variation', gravite: 'alerte',
            table: 'historique', filtre: 'variation=is.null',
            effet: 'Acceptable pour la première séance d\'une valeur, à corriger ailleurs.',
            go: 'scraper', geste: 'variations'
        },
        {
            id: 'cours-weekend', label: 'Séances un samedi ou un dimanche', gravite: 'alerte',
            calcul: 'weekend',
            effet: 'La BRVM ne cote pas le week-end : la date a probablement été mal renseignée.',
            go: 'cours'
        },
        {
            id: 'ent-sans-actions', label: 'Sociétés sans nombre d\'actions', gravite: 'alerte',
            table: 'entreprises', filtre: 'and=(nombre_actions.is.null,nb_actions.is.null)',
            effet: 'Sans nombre d\'actions, ni la capitalisation ni le bénéfice par action ne peuvent être calculés.',
            go: 'entreprises'
        },
        {
            id: 'ent-sans-isin', label: 'Sociétés sans code ISIN', gravite: 'alerte',
            table: 'entreprises', filtre: 'and=(isin.is.null,code_isin.is.null)',
            effet: 'L\'identifiant international manque : le rapprochement avec des sources externes devient manuel.',
            go: 'entreprises'
        },
        {
            id: 'fin-sans-source', label: 'États financiers sans source', gravite: 'alerte',
            table: 'financials', filtre: 'or=(source.is.null,source.eq.)',
            effet: 'Une donnée publiée sans source n\'est pas vérifiable, donc pas défendable.',
            go: 'financials'
        },
        {
            id: 'fin-fp-actif', label: 'Capitaux propres supérieurs au total actif', gravite: 'critique',
            calcul: 'bilan',
            effet: 'Le bilan est déséquilibré : une des deux valeurs est fausse.',
            go: 'financials'
        },
        {
            id: 'div-sans-montant', label: 'Dividendes sans montant', gravite: 'critique',
            table: 'dividendes_calendrier', filtre: 'and=(montant.is.null,montant_net.is.null)',
            effet: 'Le screener dividendes affiche une ligne vide.',
            go: 'dividendes'
        },
        {
            id: 'div-dates', label: 'Détachement postérieur au paiement', gravite: 'critique',
            calcul: 'dividendes',
            effet: 'On ne peut pas payer un dividende avant de l\'avoir détaché : les deux dates sont inversées.',
            go: 'dividendes'
        },
        {
            id: 'idx-negatif', label: 'Indices à valeur nulle ou négative', gravite: 'critique',
            table: 'indices', filtre: 'valeur.lte.0',
            effet: 'Un indice ne peut pas valoir zéro : la courbe de marché s\'effondre à ce point.',
            go: 'indices'
        }
    ];

    const TABLES = ['entreprises', 'historique', 'indices', 'financials', 'dividendes_calendrier',
        'analyses', 'boc', 'users'];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Diagnostic de la <em>base</em></div>' +
            '<div class="page-sub">Contrôle complet en trois volets : accessibilité des tables, cohérence des données, couverture. Rien n\'est corrigé sans votre accord — un chiffre faux corrigé en silence est plus dangereux qu\'un chiffre faux affiché.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-primary btn-sm" id="diag-run">▶ Lancer le diagnostic</button>' +
            '<button class="btn btn-outline btn-sm" id="diag-export" disabled>⬇ Rapport</button></div></div>' +

            '<div class="card" id="diag-hero" hidden><div class="health-hero" id="diag-hero-body"></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Accessibilité des tables</span>' +
            '<span class="card-tools"><span class="card-count">Une table vide et une table absente ne se soignent pas de la même façon</span></span></div>' +
            '<div class="tw" id="diag-tables"><div class="empty-state">Lancez le diagnostic pour interroger les tables.</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Contrôles de cohérence</span>' +
            '<span class="card-tools"><span class="card-count" id="diag-checks-count"></span></span></div>' +
            '<div class="tw" id="diag-checks"><div class="empty-state">Aucun contrôle exécuté pour le moment.</div></div></div>' +

            '<div class="grid-2">' +
            '<div class="card"><div class="card-head"><span class="card-title">Continuité des séances</span></div>' +
            '<div id="diag-sessions"><div class="empty-state">Le diagnostic vérifie ici les trous du calendrier de cotation.</div></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Couverture fonctionnelle</span></div>' +
            '<div id="diag-coverage"><div class="empty-state">Chaque section de l\'application est reliée aux tables dont elle dépend.</div></div></div>' +
            '</div>';
    }

    /* ── Contrôles calculés, hors portée d'un simple filtre ── */

    async function calcWeekend() {
        const rows = await TC.getAll('historique', 'select=date_seance&order=date_seance.desc');
        const dates = Array.from(new Set((rows || []).map(r => r.date_seance).filter(Boolean)));
        const bad = dates.filter(TC.isWeekend);
        return { count: bad.length, detail: bad.slice(0, 12).join(', ') };
    }

    async function calcBilan() {
        const rows = await TC.getAll('financials', 'select=ticker,annee,fonds_propres,total_actif');
        const bad = (rows || []).filter(r => {
            const fp = TC.toNumber(r.fonds_propres), ta = TC.toNumber(r.total_actif);
            return fp !== null && ta !== null && ta > 0 && fp > ta;
        });
        return { count: bad.length, detail: bad.slice(0, 10).map(r => r.ticker + ' ' + r.annee).join(', ') };
    }

    async function calcDividendes() {
        const rows = await TC.getAll('dividendes_calendrier', 'select=ticker,annee,date_detachement,ex_date,date_paiement');
        const bad = (rows || []).filter(r => {
            const d = TC.toISODate(r.date_detachement || r.ex_date), p = TC.toISODate(r.date_paiement);
            return d && p && d > p;
        });
        return { count: bad.length, detail: bad.slice(0, 10).map(r => r.ticker + ' ' + (r.annee || '')).join(', ') };
    }

    const CALCULS = { weekend: calcWeekend, bilan: calcBilan, dividendes: calcDividendes };

    /* ── Exécution ───────────────────────────────────────── */

    async function run() {
        const button = TC.el('diag-run');
        button.disabled = true;
        button.textContent = 'Analyse en cours…';
        TC.health.set('busy', 'Diagnostic en cours…');

        TC.el('diag-tables').innerHTML = '<div class="loading"><div class="spinner"></div>Interrogation des tables…</div>';
        TC.el('diag-checks').innerHTML = '<div class="loading"><div class="spinner"></div>Contrôles de cohérence…</div>';

        /* 1. Accessibilité */
        const tables = {};
        await Promise.all(TABLES.map(async function (t) {
            const res = await TC.count(t);
            tables[t] = res.ok
                ? (res.value ? { etat: 'ok', lignes: res.value } : { etat: 'vide', lignes: 0 })
                : { etat: 'illisible', lignes: 0, status: res.status };
        }));
        paintTables(tables);

        /* 2. Cohérence */
        const results = [];
        for (const control of CONTROLES) {
            let count = 0, detail = '';
            if (control.calcul) {
                const out = await CALCULS[control.calcul]();
                count = out.count; detail = out.detail;
            } else {
                const filtre = typeof control.filtre === 'function' ? control.filtre() : control.filtre;
                const res = await TC.count(control.table, filtre);
                count = res.ok ? res.value : 0;
                if (!res.ok) detail = 'table non interrogeable';
            }
            results.push(Object.assign({}, control, { count, detail }));
        }
        paintChecks(results);

        /* 3. Continuité et couverture */
        const sessions = await checkSessions();
        const coverage = paintCoverage(tables);

        const critiques = results.filter(r => r.gravite === 'critique' && r.count > 0);
        const alertes = results.filter(r => r.gravite === 'alerte' && r.count > 0);
        const illisibles = Object.keys(tables).filter(t => tables[t].etat === 'illisible');
        const vides = Object.keys(tables).filter(t => tables[t].etat === 'vide');

        const score = Math.max(0, 100
            - critiques.length * 11 - alertes.length * 3
            - illisibles.length * 15 - vides.length * 5
            - (sessions.gaps.length > 3 ? 4 : 0));

        report = {
            genere_le: new Date().toISOString(),
            score, tables, controles: results, seances: sessions, couverture: coverage
        };

        paintHero(score, critiques, alertes, illisibles, vides);
        TC.badge('diagnostic', critiques.reduce((s, r) => s + r.count, 0));
        TC.el('diag-export').disabled = false;
        button.disabled = false;
        button.textContent = '▶ Relancer le diagnostic';
        TC.health.probe();
    }

    function paintHero(score, critiques, alertes, illisibles, vides) {
        const level = illisibles.length || critiques.length ? 'err' : alertes.length ? 'warn' : 'ok';
        const color = level === 'err' ? 'var(--red)' : level === 'warn' ? 'var(--orange)' : 'var(--green)';
        const circumference = 2 * Math.PI * 32;
        const dash = (score / 100) * circumference;

        TC.el('diag-hero').hidden = false;
        TC.el('diag-hero-body').innerHTML =
            '<svg class="health-ring" viewBox="0 0 74 74">' +
            '<circle cx="37" cy="37" r="32" fill="none" stroke="var(--border)" stroke-width="5"/>' +
            '<circle cx="37" cy="37" r="32" fill="none" stroke="' + color + '" stroke-width="5" ' +
            'stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + circumference.toFixed(1) + '" ' +
            'transform="rotate(-90 37 37)"/></svg>' +
            '<div><div class="health-score" style="color:' + color + '">' + score + '<span style="font-size:16px;color:var(--muted)"> / 100</span></div>' +
            '<div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.6;">' +
            (illisibles.length ? '<b style="color:var(--red)">' + illisibles.length + ' table(s) illisibles</b> · ' : '') +
            (vides.length ? vides.length + ' table(s) vides · ' : '') +
            '<b style="color:var(--red)">' + critiques.length + '</b> contrôle(s) en défaut bloquant · ' +
            '<b style="color:var(--orange)">' + alertes.length + '</b> alerte(s)' +
            '</div></div>' +
            '<div style="margin-left:auto;max-width:400px;font-size:12.5px;color:var(--muted);line-height:1.65;">' +
            (level === 'ok'
                ? 'La base est exploitable en l\'état. Relancez ce contrôle après chaque import.'
                : level === 'warn'
                    ? 'La base est exploitable, mais certaines valeurs ne sont pas défendables publiquement. Traitez les alertes avant publication.'
                    : 'Des données incohérentes sont actuellement servies à l\'application. Traitez les défauts bloquants en priorité.') +
            '</div>';
    }

    function paintTables(tables) {
        TC.el('diag-tables').innerHTML = '<table><thead><tr><th>Table</th><th class="r">Lignes</th><th>État</th>' +
            '<th>Lecture</th></tr></thead><tbody>' +
            Object.keys(tables).map(function (t) {
                const s = tables[t];
                const badge = s.etat === 'ok' ? '<span class="badge badge-green">lisible</span>'
                    : s.etat === 'vide' ? '<span class="badge badge-orange">vide</span>'
                        : '<span class="badge badge-red">illisible</span>';
                const note = s.etat === 'ok' ? 'Table interrogée sans erreur.'
                    : s.etat === 'vide' ? 'La table répond mais ne contient aucune ligne : les sections qui en dépendent restent muettes.'
                        : 'La table n\'existe pas, ou une règle RLS en interdit la lecture avec ce compte.';
                return '<tr class="' + (s.etat === 'illisible' ? 'row-flag' : s.etat === 'vide' ? 'row-warn' : '') + '">' +
                    '<td class="td-mono">' + TC.esc(t) + '</td>' +
                    '<td class="r td-mono">' + (s.etat === 'ok' ? s.lignes.toLocaleString('fr-FR') : '—') + '</td>' +
                    '<td>' + badge + '</td>' +
                    '<td class="td-muted" style="white-space:normal;max-width:520px;">' + TC.esc(note) + '</td></tr>';
            }).join('') + '</tbody></table>';
    }

    function paintChecks(results) {
        const failing = results.filter(r => r.count > 0);
        TC.el('diag-checks-count').textContent = failing.length + ' contrôle(s) en défaut sur ' + results.length;
        TC.el('diag-checks').innerHTML = '<table><thead><tr><th>Contrôle</th><th class="r">Lignes</th><th>Gravité</th>' +
            '<th>Conséquence</th><th></th></tr></thead><tbody>' +
            results.map(function (r) {
                const ok = r.count === 0;
                return '<tr class="' + (ok ? '' : r.gravite === 'critique' ? 'row-flag' : 'row-warn') + '">' +
                    '<td>' + TC.esc(r.label) + (r.detail ? '<br><span class="td-muted" style="font-size:11px;">' + TC.esc(r.detail) + '</span>' : '') + '</td>' +
                    '<td class="r td-mono">' + r.count.toLocaleString('fr-FR') + '</td>' +
                    '<td>' + (ok ? '<span class="badge badge-green">conforme</span>'
                        : r.gravite === 'critique' ? '<span class="badge badge-red">bloquant</span>'
                            : '<span class="badge badge-orange">à vérifier</span>') + '</td>' +
                    '<td class="td-muted" style="white-space:normal;max-width:460px;">' + TC.esc(r.effet) + '</td>' +
                    '<td class="r">' + (ok ? '' :
                        '<button class="btn btn-outline btn-sm" data-go="' + r.go + '">Traiter</button>') + '</td></tr>';
            }).join('') + '</tbody></table>';
    }

    async function checkSessions() {
        const host = TC.el('diag-sessions');
        host.innerHTML = '<div class="loading"><div class="spinner"></div>Analyse du calendrier…</div>';
        const rows = await TC.getAll('historique', 'select=date_seance&order=date_seance.desc');
        const map = {};
        (rows || []).forEach(r => { if (r.date_seance) map[r.date_seance] = (map[r.date_seance] || 0) + 1; });
        const dates = Object.keys(map).sort();

        if (!dates.length) {
            host.innerHTML = '<div class="empty-state"><strong>Aucune séance</strong>La table historique est vide.</div>';
            return { total: 0, gaps: [], thin: [] };
        }

        const counts = dates.map(d => map[d]);
        const median = counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)];
        const gaps = [];
        for (let i = 1; i < dates.length; i++) {
            const days = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86400000);
            if (days > 5) gaps.push({ from: dates[i - 1], to: dates[i], days });
        }
        const thin = dates.filter(d => map[d] < median * 0.6);
        const age = Math.round((Date.now() - Date.parse(dates[dates.length - 1] + 'T12:00:00')) / 86400000);

        host.innerHTML = '<div class="card-body tight">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:12px;">' +
            '<div><div class="kpi-label">Séances</div><div class="kpi-value sm">' + dates.length + '</div></div>' +
            '<div><div class="kpi-label">Médiane</div><div class="kpi-value sm">' + median + '</div><div class="kpi-sub">cotations / séance</div></div>' +
            '<div><div class="kpi-label">Interruptions</div><div class="kpi-value sm ' + (gaps.length ? 'down' : 'up') + '">' + gaps.length + '</div></div>' +
            '<div><div class="kpi-label">Séances partielles</div><div class="kpi-value sm">' + thin.length + '</div></div>' +
            '<div><div class="kpi-label">Fraîcheur</div><div class="kpi-value sm ' + (age > 4 ? 'down' : 'up') + '">' + age + ' j</div></div>' +
            '</div>' +
            (age > 4 ? '<div class="note warn"><strong>Dernière séance il y a ' + age + ' jours</strong> (' +
                TC.fmtDate(dates[dates.length - 1]) + '). Vérifiez la tâche planifiée ou lancez la récupération manuelle.</div>' : '') +
            (gaps.length ? '<div class="note" style="margin-top:10px;"><strong>Interruptions de plus de cinq jours</strong><br>' +
                gaps.slice(-6).map(g => TC.fmtDate(g.from) + ' → ' + TC.fmtDate(g.to) + ' (' + g.days + ' j)').join('<br>') + '</div>' : '') +
            '</div>';

        return { total: dates.length, median, gaps, thin: thin.slice(0, 20), derniere: dates[dates.length - 1], age };
    }

    /** Quelle section de l'application dépend de quelle table. */
    const DEPENDANCES = [
        { section: 'Cours du jour et marché', tables: ['historique', 'indices'] },
        { section: 'Fiche valeur et graphiques', tables: ['entreprises', 'historique'] },
        { section: 'Analyse fondamentale', tables: ['financials', 'entreprises'] },
        { section: 'Screener dividendes', tables: ['dividendes_calendrier', 'historique'] },
        { section: 'Recommandations', tables: ['analyses'] },
        { section: 'Bulletins officiels', tables: ['boc'] },
        { section: 'Comptes et abonnements', tables: ['users'] }
    ];

    function paintCoverage(tables) {
        const results = DEPENDANCES.map(function (d) {
            const missing = d.tables.filter(t => !tables[t] || tables[t].etat !== 'ok');
            return { section: d.section, tables: d.tables, missing };
        });
        TC.el('diag-coverage').innerHTML = '<div class="tw"><table><thead><tr><th>Section de l\'application</th>' +
            '<th>Tables requises</th><th>État</th></tr></thead><tbody>' +
            results.map(r =>
                '<tr class="' + (r.missing.length ? 'row-warn' : '') + '">' +
                '<td>' + TC.esc(r.section) + '</td>' +
                '<td class="td-mono td-muted" style="font-size:11px;">' + TC.esc(r.tables.join(', ')) + '</td>' +
                '<td>' + (r.missing.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(r.missing.join(', ')) + '">incomplète</span>'
                    : '<span class="badge badge-green">alimentée</span>') + '</td></tr>').join('') +
            '</tbody></table></div>';
        return results;
    }

    TC.register({
        id: 'diagnostic',
        label: 'Diagnostic',
        group: 'pilotage',
        icon: '◉',
        keywords: 'diagnostic sante qualite anomalie controle audit',
        view,
        mount() {
            TC.on('diag-run', 'click', run);
            TC.on('diag-export', 'click', function () {
                if (!report) return;
                TC.download('diagnostic-the-capital-' + TC.today() + '.json',
                    JSON.stringify(report, null, 2), 'application/json');
            });
            TC.delegate('panel-diagnostic', '[data-go]', 'click', node => TC.go(node.dataset.go));
            run();
        }
    });

})(window.TC);
