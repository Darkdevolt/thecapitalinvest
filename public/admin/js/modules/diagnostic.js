/* ============================================================
   THE CAPITAL — DIAGNOSTIC
   Contrôle de continuité des séances et des références de variation.
   ============================================================ */
'use strict';

(function (TC) {
    let report = null;

    const CONTROLES = [
        {
            id: 'cours-negatifs', label: 'Cotations à valeur négative', gravite: 'critique',
            table: 'historique', filtre: 'or=(cours_cloture.lt.0,cours_ouverture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0)',
            effet: 'Un prix négatif casse les graphiques et fausse toute performance calculée.', go: 'cours'
        },
        {
            id: 'cours-ohlc', label: 'Plus haut inférieur au plus bas', gravite: 'critique',
            table: 'historique', filtre: 'and=(plus_haut.not.is.null,plus_bas.not.is.null,plus_haut.lt.plus_bas)',
            effet: 'Les bornes de séance sont inversées.', go: 'cours'
        },
        {
            id: 'cours-futur', label: 'Séances datées dans le futur', gravite: 'critique',
            table: 'historique', filtre: () => 'date_seance=gt.' + TC.today(),
            effet: 'Une séance future contamine les derniers cours et rendements.', go: 'cours'
        },
        {
            id: 'cours-sans-cloture', label: 'Cotations sans cours de clôture', gravite: 'critique',
            table: 'historique', filtre: 'and=(cours_cloture.is.null,cloture.is.null)',
            effet: 'La valeur ne peut pas servir de référence de marché.', go: 'cours'
        },
        {
            id: 'cours-limite', label: 'Variations hors limite ±' + TC.VARIATION_LIMIT + ' %', gravite: 'alerte',
            table: 'historique', filtre: 'or=(variation.gt.' + TC.VARIATION_LIMIT + ',variation.lt.-' + TC.VARIATION_LIMIT + ')',
            effet: 'Variation inhabituelle à contrôler : erreur, ajustement ou opération sur titre.', go: 'cours'
        },
        {
            id: 'cours-sans-variation', label: 'Cotations sans variation', gravite: 'alerte',
            table: 'historique', filtre: 'variation=is.null',
            effet: 'Acceptable pour une première cotation, sinon à contrôler.', go: 'scraper', geste: 'variations'
        },
        {
            id: 'cours-weekend', label: 'Séances un samedi ou un dimanche', gravite: 'alerte', calcul: 'weekend',
            effet: 'La BRVM ne cote pas le week-end.', go: 'cours'
        },
        {
            id: 'cours-trous-titres', label: 'Titres avec trou avant leur séance récente', gravite: 'critique', calcul: 'titreGaps',
            effet: 'Une séance manquante ne doit jamais être remplacée par une séance plus ancienne pour calculer une variation journalière.', go: 'cours'
        },
        {
            id: 'ent-sans-actions', label: 'Sociétés sans nombre d\'actions', gravite: 'alerte',
            table: 'entreprises', filtre: 'and=(nombre_actions.is.null,nb_actions.is.null)',
            effet: 'La capitalisation et le bénéfice par action ne peuvent pas être calculés.', go: 'entreprises'
        },
        {
            id: 'ent-sans-isin', label: 'Sociétés sans code ISIN', gravite: 'alerte',
            table: 'entreprises', filtre: 'and=(isin.is.null,code_isin.is.null)',
            effet: 'Le rapprochement avec les sources externes devient manuel.', go: 'entreprises'
        },
        {
            id: 'fin-sans-source', label: 'États financiers sans source', gravite: 'alerte',
            table: 'financials', filtre: 'or=(source.is.null,source.eq.)',
            effet: 'Une donnée sans source n\'est pas vérifiable.', go: 'financials'
        },
        {
            id: 'fin-fp-actif', label: 'Capitaux propres supérieurs au total actif', gravite: 'critique', calcul: 'bilan',
            effet: 'Le bilan est déséquilibré.', go: 'financials'
        },
        {
            id: 'div-sans-montant', label: 'Dividendes sans montant', gravite: 'critique',
            table: 'dividendes_calendrier', filtre: 'and=(montant.is.null,montant_net.is.null)',
            effet: 'Le dividende est incomplet.', go: 'dividendes'
        },
        {
            id: 'div-dates', label: 'Détachement postérieur au paiement', gravite: 'critique', calcul: 'dividendes',
            effet: 'Les dates de dividende sont incohérentes.', go: 'dividendes'
        },
        {
            id: 'idx-negatif', label: 'Indices à valeur nulle ou négative', gravite: 'critique',
            table: 'indices', filtre: 'valeur.lte.0', effet: 'Un indice ne peut pas être nul ou négatif.', go: 'indices'
        }
    ];

    const TABLES = ['entreprises', 'historique', 'indices', 'financials', 'dividendes_calendrier', 'analyses', 'boc', 'users'];

    function view() {
        return '' +
            '<div class="page-head"><div><div class="page-title">Diagnostic de la <em>base</em></div>' +
            '<div class="page-sub">Contrôle de l\'accessibilité, de la cohérence et surtout de la continuité des séances. Une séance manquante ne doit jamais devenir une fausse variation quotidienne.</div></div>' +
            '<div class="page-actions"><button class="btn btn-primary btn-sm" id="diag-run">▶ Lancer le diagnostic</button><button class="btn btn-outline btn-sm" id="diag-export" disabled>⬇ Rapport</button></div></div>' +
            '<div class="card" id="diag-hero" hidden><div class="health-hero" id="diag-hero-body"></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Accessibilité des tables</span></div><div class="tw" id="diag-tables"><div class="empty-state">Lancez le diagnostic.</div></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Contrôles de cohérence</span><span class="card-tools"><span class="card-count" id="diag-checks-count"></span></span></div><div class="tw" id="diag-checks"><div class="empty-state">Aucun contrôle exécuté.</div></div></div>' +
            '<div class="grid-2"><div class="card"><div class="card-head"><span class="card-title">Continuité des séances</span></div><div id="diag-sessions"><div class="empty-state">Les trous de cotation seront listés ici.</div></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Couverture fonctionnelle</span></div><div id="diag-coverage"><div class="empty-state">Chaque section de l\'application est contrôlée.</div></div></div></div>';
    }

    async function calcWeekend() {
        const rows = await TC.getAll('historique', 'select=date_seance&order=date_seance.desc');
        const dates = Array.from(new Set((rows || []).map(r => r.date_seance).filter(Boolean)));
        const bad = dates.filter(TC.isWeekend);
        return { count: bad.length, detail: bad.slice(0, 12).join(', ') };
    }

    async function calcTitreGaps() {
        const rows = await TC.getAll('historique', 'select=ticker,date_seance,cours_cloture,cloture&order=date_seance.asc');
        const byTicker = {};
        (rows || []).forEach(r => {
            const ticker = String(r.ticker || '').trim().toUpperCase();
            const date = TC.toISODate(r.date_seance);
            if (!ticker || !date) return;
            (byTicker[ticker] ||= []).push(date);
        });

        const sessions = Array.from(new Set((rows || []).map(r => TC.toISODate(r.date_seance)).filter(Boolean))).sort();
        const sessionSet = new Set(sessions);
        const gaps = [];
        Object.keys(byTicker).forEach(ticker => {
            const dates = new Set(byTicker[ticker]);
            if (byTicker[ticker].length < 2) return;
            const latest = byTicker[ticker][byTicker[ticker].length - 1];
            const idx = sessions.indexOf(latest);
            if (idx <= 0) return;
            const previousMarketSession = sessions[idx - 1];
            if (!dates.has(previousMarketSession)) {
                gaps.push({ ticker, date: latest, previous: previousMarketSession });
            }
        });
        return {
            count: gaps.length,
            detail: gaps.slice(0, 20).map(g => g.ticker + ' ' + g.date + ' ← séance précédente absente (' + g.previous + ')').join(' · '),
            gaps
        };
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

    const CALCULS = { weekend: calcWeekend, titreGaps: calcTitreGaps, bilan: calcBilan, dividendes: calcDividendes };

    async function run() {
        const button = TC.el('diag-run');
        button.disabled = true; button.textContent = 'Analyse en cours…'; TC.health.set('busy', 'Diagnostic en cours…');
        TC.el('diag-tables').innerHTML = '<div class="loading"><div class="spinner"></div>Interrogation des tables…</div>';
        TC.el('diag-checks').innerHTML = '<div class="loading"><div class="spinner"></div>Contrôles de cohérence…</div>';

        const tables = {};
        await Promise.all(TABLES.map(async t => {
            const res = await TC.count(t);
            tables[t] = res.ok ? (res.value ? { etat: 'ok', lignes: res.value } : { etat: 'vide', lignes: 0 }) : { etat: 'illisible', lignes: 0, status: res.status };
        }));
        paintTables(tables);

        const results = [];
        let gapResult = { count: 0, detail: '', gaps: [] };
        for (const control of CONTROLES) {
            let count = 0, detail = '';
            if (control.calcul) {
                const out = await CALCULS[control.calcul]();
                count = out.count; detail = out.detail;
                if (control.calcul === 'titreGaps') gapResult = out;
            } else {
                const filtre = typeof control.filtre === 'function' ? control.filtre() : control.filtre;
                const res = await TC.count(control.table, filtre);
                count = res.ok ? res.value : 0;
                if (!res.ok) detail = 'table non interrogeable';
            }
            results.push(Object.assign({}, control, { count, detail }));
        }
        paintChecks(results);
        const sessions = await checkSessions();
        sessions.titre_gaps = gapResult.gaps || [];
        const coverage = paintCoverage(tables);

        const critiques = results.filter(r => r.gravite === 'critique' && r.count > 0);
        const alertes = results.filter(r => r.gravite === 'alerte' && r.count > 0);
        const illisibles = Object.keys(tables).filter(t => tables[t].etat === 'illisible');
        const vides = Object.keys(tables).filter(t => tables[t].etat === 'vide');
        const score = Math.max(0, 100 - critiques.length * 11 - alertes.length * 3 - illisibles.length * 15 - vides.length * 5 - (sessions.gaps.length > 3 ? 4 : 0) - (gapResult.count > 0 ? 8 : 0));
        report = { genere_le: new Date().toISOString(), score, tables, controles: results, seances: sessions, couverture: coverage };
        paintHero(score, critiques, alertes, illisibles, vides);
        TC.el('diag-export').disabled = false;
        button.disabled = false; button.textContent = '↻ Relancer le diagnostic';
        TC.health.set(score < 70 ? 'err' : score < 90 ? 'warn' : 'ok', 'Diagnostic terminé · score <b>' + score + '/100</b>');
    }

    /* Les fonctions de rendu historiques restent utilisées par l'interface existante. */
    function paintTables(tables) {
        const host = TC.el('diag-tables');
        host.innerHTML = '<table><thead><tr><th>Table</th><th>État</th><th>Lignes</th></tr></thead><tbody>' + Object.keys(tables).map(t => {
            const x = tables[t];
            return '<tr><td>' + TC.esc(t) + '</td><td>' + TC.esc(x.etat) + '</td><td>' + TC.esc(String(x.lignes || 0)) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    function paintChecks(results) {
        const host = TC.el('diag-checks');
        const bad = results.filter(r => r.count > 0);
        TC.el('diag-checks-count').textContent = bad.length + ' anomalie(s)';
        host.innerHTML = '<table><thead><tr><th>Contrôle</th><th>Gravité</th><th>Nombre</th><th>Détail</th></tr></thead><tbody>' + results.map(r =>
            '<tr><td>' + TC.esc(r.label) + '</td><td>' + TC.esc(r.gravite) + '</td><td>' + r.count + '</td><td class="td-muted">' + TC.esc(r.detail || 'OK') + '</td></tr>'
        ).join('') + '</tbody></table>';
    }
    function paintHero(score, critiques, alertes, illisibles, vides) {
        const hero = TC.el('diag-hero');
        hero.hidden = false;
        TC.el('diag-hero-body').innerHTML = '<strong>Score ' + score + '/100</strong><span>' + critiques.length + ' critique(s) · ' + alertes.length + ' alerte(s) · ' + illisibles.length + ' table(s) illisible(s)</span>';
    }
    function paintCoverage(tables) {
        const host = TC.el('diag-coverage');
        host.innerHTML = '<div class="note">' + Object.keys(tables).length + ' tables contrôlées.</div>';
        return tables;
    }
    async function checkSessions() {
        const rows = await TC.getAll('historique', 'select=date_seance&order=date_seance.asc');
        const dates = Array.from(new Set((rows || []).map(r => TC.toISODate(r.date_seance)).filter(Boolean))).sort();
        const gaps = [];
        for (let i = 1; i < dates.length; i++) {
            const a = Date.parse(dates[i - 1] + 'T12:00:00'), b = Date.parse(dates[i] + 'T12:00:00');
            const days = Math.round((b - a) / 86400000);
            if (days > 4) gaps.push({ from: dates[i - 1], to: dates[i], days });
        }
        const host = TC.el('diag-sessions');
        host.innerHTML = gaps.length ? '<div class="note err">' + gaps.slice(0, 20).map(g => TC.esc(g.from + ' → ' + g.to + ' (' + g.days + ' jours)')).join('<br>') + '</div>' : '<div class="note ok">Aucun trou global important détecté.</div>';
        return { gaps };
    }

    TC.modules = TC.modules || {};
    TC.modules.diagnostic = { view, mount() { TC.el('diag-run').addEventListener('click', run); } };
    TC.registerModule && TC.registerModule(TC.modules.diagnostic);
})(window.TC);
