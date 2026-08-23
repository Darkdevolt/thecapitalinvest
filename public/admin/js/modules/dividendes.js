/* ============================================================
   THE CAPITAL — DIVIDENDES

   Règle de calcul du rendement, corrigée.

   Un dividende déjà détaché est un fait passé : son rendement se
   mesure au cours qui prévalait au détachement, et il ne bouge
   plus jamais. L'exprimer au cours du jour revient à réécrire
   l'histoire à chaque séance — un dividende de 2024 afficherait
   un rendement différent chaque matin.

   Un dividende annoncé mais non encore détaché est au contraire
   une projection : son rendement se mesure au dernier cours connu
   et se recalcule jusqu'à la date de détachement, après quoi il
   se fige.

   La date de détachement n'étant pas toujours un jour de bourse,
   la référence retenue est la dernière clôture à cette date ou
   avant.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let editing = null;
    const sel = TC.selection('div');

    const STATUTS = [
        { v: 'prévisionnel', l: 'Prévisionnel' },
        { v: 'confirmé', l: 'Confirmé' },
        { v: 'payé', l: 'Payé' }
    ];

    const close = r => TC.toNumber(
        r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);

    const montantOf = r => TC.toNumber(
        r.montant !== null && r.montant !== undefined ? r.montant : r.montant_net);

    const detachOf = r => TC.toISODate(r.date_detachement || r.ex_date);

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Calendrier des <em>dividendes</em></div>' +
            '<div class="page-sub">Un dividende se rattache à l\'exercice qui l\'a produit, jamais à l\'année du versement. Le rendement d\'un dividende déjà détaché est calculé au cours du détachement et ne bouge plus ; celui d\'un dividende à venir suit le dernier cours connu jusqu\'à sa date de détachement.</div></div>' +
            '<div class="page-actions">' +
            '<button class="btn btn-outline btn-sm" id="div-refresh-yield">↻ Recalculer les rendements</button>' +
            '<button class="btn btn-outline btn-sm" id="div-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="div-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title" id="div-form-title">Enregistrer un dividende</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="div-cancel-edit" hidden>Annuler la modification</button></span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'd-ticker', label: 'Ticker', upper: true, placeholder: 'SNTS' },
                { id: 'd-annee', label: 'Exercice bénéficiaire', type: 'number', step: '1', col: 'annee', placeholder: String(new Date().getFullYear() - 1), hint: 'Année des comptes, pas celle du versement.' },
                { id: 'd-montant', label: 'Dividende par action', type: 'number', placeholder: '1 250' },
                { id: 'd-detach', label: 'Date de détachement', type: 'date', col: 'date_detachement', hint: 'Détermine le cours servant de base au rendement.' },
                { id: 'd-paiement', label: 'Date de paiement', type: 'date' },
                { id: 'd-statut', label: 'Statut', type: 'select', options: STATUTS },
                { id: 'd-rendement', label: 'Rendement %', type: 'number', col: 'taux_rendement', hint: 'Vide : calculé sur le cours de référence.' },
                { id: 'd-notes', label: 'Observation', placeholder: 'Acompte, solde, dividende exceptionnel…', wide: true }
            ]) + '</div>' +
            '<div class="card-body tight"><div class="note" id="div-live">Saisissez le ticker, le montant et la date de détachement : le rendement se calcule sur le cours qui convient.</div></div>' +
            '<div class="actions"><button class="btn btn-primary" id="div-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="div-clear">Effacer</button>' +
            '<span class="msg" id="div-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Dividendes enregistrés</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="div-search" placeholder="Ticker…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:130px;">' +
            '<select id="div-statut-filter" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Tous statuts</option>' + STATUTS.map(s => '<option value="' + s.v + '">' + s.l + '</option>').join('') +
            '<option value="__futur">Détachement à venir</option><option value="__ecart">Rendement à corriger</option></select>' +
            '<span class="card-count" id="div-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="div-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-div"><span class="bulk-count">0 ligne(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="div-bulk-del">Supprimer</button>' +
            '<button class="btn btn-outline btn-sm" id="div-bulk-reset">Désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-div-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="div-all"></th>' +
            '<th>Ticker</th><th>Exercice</th><th class="r">Montant</th><th class="r">Rendement</th>' +
            '<th class="r">Rendement recalculé</th><th>Base du calcul</th><th>Détachement</th><th>Paiement</th>' +
            '<th>Statut</th><th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="div-tbody">' + TC.rowsLoading(12) + '</tbody></table></div></div>';
    }

    /* ============================================================
       COURS DE RÉFÉRENCE

       Il faut, pour chaque dividende passé, la dernière clôture à
       la date de détachement ou avant. Interroger la base ligne par
       ligne coûterait deux cents requêtes ; on regroupe donc les
       dates en fenêtres, on fusionne celles qui se recouvrent, et
       l'on ne lance qu'une requête par période contiguë.
       ============================================================ */

    const LOOKBACK = 12;   // jours remontés pour retrouver une séance cotée

    let latest = { date: null, map: {} };
    let history = {};      // ticker → [{ date, close }] trié par date croissante

    async function loadLatest() {
        const last = await TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1');
        const date = last && last[0] && last[0].date_seance;
        latest = { date, map: {} };
        if (!date) return latest;
        const quotes = await TC.getAll('historique',
            'select=ticker,cours_cloture,cloture&date_seance=eq.' + date);
        (quotes || []).forEach(r => { latest.map[String(r.ticker).toUpperCase()] = close(r); });
        return latest;
    }

    /** Fusionne les fenêtres [D-LOOKBACK, D] qui se recouvrent. */
    function windows(dates) {
        const spans = dates.map(d => ({ from: TC.shiftDays(d, -LOOKBACK), to: d }))
            .sort((a, b) => a.from.localeCompare(b.from));
        const merged = [];
        spans.forEach(function (span) {
            const last = merged[merged.length - 1];
            if (last && span.from <= last.to) {
                if (span.to > last.to) last.to = span.to;
            } else merged.push({ from: span.from, to: span.to });
        });
        return merged;
    }

    async function loadHistory(dates) {
        history = {};
        if (!dates.length) return;
        const spans = windows(dates);
        for (const span of spans) {
            const quotes = await TC.getAll('historique',
                'select=ticker,date_seance,cours_cloture,cloture' +
                '&date_seance=gte.' + span.from + '&date_seance=lte.' + span.to +
                '&order=date_seance.asc');
            (quotes || []).forEach(function (r) {
                const value = close(r);
                if (value === null) return;
                const key = String(r.ticker).toUpperCase();
                (history[key] = history[key] || []).push({ date: r.date_seance, close: value });
            });
        }
        Object.keys(history).forEach(k => history[k].sort((a, b) => a.date.localeCompare(b.date)));
    }

    /** Dernière clôture connue à la date donnée ou avant. */
    function closeAt(ticker, date) {
        const serie = history[String(ticker).toUpperCase()];
        if (!serie || !serie.length) return null;
        let found = null;
        for (let i = 0; i < serie.length; i++) {
            if (serie[i].date <= date) found = serie[i]; else break;
        }
        return found;
    }

    /**
     * Détermine la base de calcul d'un dividende et le rendement qui en
     * découle. Le résultat porte la date de référence : c'est elle qui
     * rend le chiffre vérifiable.
     */
    function reference(r) {
        const montant = montantOf(r);
        const detach = detachOf(r);
        const today = TC.today();
        const future = !detach || detach > today;

        if (future) {
            const price = latest.map[String(r.ticker).toUpperCase()] || null;
            return {
                nature: 'prévisionnel',
                date: latest.date,
                price,
                yield: (price && price > 0 && montant !== null) ? Math.round((montant / price) * 10000) / 100 : null,
                label: latest.date ? 'dernier cours ' + TC.fmtDate(latest.date) : 'aucun cours connu'
            };
        }

        const point = closeAt(r.ticker, detach);
        if (!point) {
            /* Aucune cotation dans les douze jours précédant le détachement :
               le rendement reste incalculable plutôt que d'être approché par
               un cours sans rapport. */
            return {
                nature: 'historique', date: null, price: null, yield: null,
                label: 'aucune cotation au détachement'
            };
        }
        return {
            nature: 'historique',
            date: point.date,
            price: point.close,
            yield: (point.close > 0 && montant !== null) ? Math.round((montant / point.close) * 10000) / 100 : null,
            label: 'cours du ' + TC.fmtDate(point.date) +
                (point.date === detach ? '' : ' (séance précédant le détachement)')
        };
    }

    function audit(r) {
        const issues = [];
        const montant = montantOf(r);
        const annee = parseInt(r.annee, 10);
        const currentYear = new Date().getFullYear();

        if (montant === null) issues.push('montant absent');
        else if (montant < 0) issues.push('montant négatif');
        if (!Number.isInteger(annee)) issues.push('exercice absent');
        else if (annee > currentYear) issues.push('exercice postérieur à l\'année en cours');

        const detach = detachOf(r);
        const paiement = TC.toISODate(r.date_paiement);
        if (!detach) issues.push('date de détachement absente');
        if (detach && paiement && detach > paiement) issues.push('détachement postérieur au paiement');
        if (detach && annee && Number(detach.slice(0, 4)) < annee) issues.push('détachement antérieur à l\'exercice');
        if (r.statut === 'payé' && !paiement) issues.push('statut payé sans date de paiement');

        const ref = r.__ref;
        if (ref && ref.yield !== null) {
            const published = TC.toNumber(r.taux_rendement);
            if (published !== null && Math.abs(published - ref.yield) > 0.15) {
                issues.push('rendement publié ≠ recalculé');
            }
            if (ref.yield > 25) issues.push('rendement supérieur à 25 %, à vérifier');
        } else if (ref && ref.nature === 'historique') {
            issues.push('cours de détachement introuvable');
        }
        return issues;
    }

    async function load() {
        TC.el('div-tbody').innerHTML = TC.rowsLoading(12);
        const data = await TC.getAll('dividendes_calendrier', 'select=*&order=annee.desc,ticker.asc');
        rows = data || [];

        await loadLatest();

        const today = TC.today();
        const pastDates = Array.from(new Set(rows
            .map(detachOf)
            .filter(d => d && d <= today)))
            .sort();
        await loadHistory(pastDates);

        rows.forEach(function (r) {
            r.__ref = reference(r);
            r.__issues = audit(r);
        });

        paintKpis();
        paint(rows);
    }

    function paintKpis() {
        const today = TC.today();
        const year = new Date().getFullYear();
        const upcoming = rows.filter(r => { const d = detachOf(r); return d && d > today; });
        const passes = rows.filter(r => { const d = detachOf(r); return d && d <= today; });
        const yields = passes.map(r => r.__ref && r.__ref.yield).filter(v => v !== null && v !== undefined && v > 0);
        const median = yields.length ? yields.slice().sort((a, b) => a - b)[Math.floor(yields.length / 2)] : null;
        const flagged = rows.filter(r => r.__issues.length).length;

        TC.el('div-kpis').innerHTML =
            box('Dividendes', rows.length) +
            box('Exercice ' + (year - 1), rows.filter(r => Number(r.annee) === year - 1).length) +
            box('Détachements à venir', upcoming.length) +
            box('Rendement médian', median !== null ? median.toFixed(2) + ' %' : '—', '', 'au détachement') +
            box('À vérifier', flagged, flagged ? 'orange' : 'green') +
            box('Cours prévisionnel', latest.date ? TC.fmtDate(latest.date) : '—', '', 'base des dividendes à venir');
    }

    function box(label, value, tone, sub) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div>' +
            (sub ? '<div class="kpi-sub">' + TC.esc(sub) + '</div>' : '') + '</div>';
    }

    function paint(list) {
        const tbody = TC.el('div-tbody');
        TC.el('div-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(12, 'Aucun dividende enregistré',
                'Le calendrier alimente le screener dividendes de l\'application.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const statut = r.statut || 'confirmé';
            const tone = statut === 'payé' ? 'badge-green' : statut === 'prévisionnel' ? 'badge-orange' : 'badge-gold';
            const ref = r.__ref || {};
            const baseTone = ref.nature === 'prévisionnel' ? 'badge-blue'
                : ref.price ? 'badge-grey' : 'badge-red';
            return '<tr class="' + (r.__issues.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="td-mono">' + TC.esc(r.annee || r.exercice || '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(montantOf(r)) + '</td>' +
                '<td class="r td-mono">' + TC.fmtPct(r.taux_rendement) + '</td>' +
                '<td class="r td-mono td-muted">' + (ref.yield !== null && ref.yield !== undefined ? ref.yield.toFixed(2) + ' %' : '—') + '</td>' +
                '<td><span class="badge ' + baseTone + '" title="' +
                TC.esc((ref.price ? 'cours ' + TC.fmt(ref.price) + ' F · ' : '') + (ref.label || '')) + '">' +
                TC.esc(ref.nature === 'prévisionnel' ? 'dernier cours' : ref.price ? TC.fmtDate(ref.date) : 'introuvable') +
                '</span></td>' +
                '<td class="td-muted">' + TC.fmtDate(detachOf(r)) + '</td>' +
                '<td class="td-muted">' + TC.fmtDate(r.date_paiement) + '</td>' +
                '<td><span class="badge ' + tone + '">' + TC.esc(statut) + '</span></td>' +
                '<td>' + (r.__issues.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(r.__issues.join(' · ')) + '">' + TC.esc(r.__issues[0]) + '</span>'
                    : '<span class="badge badge-green">conforme</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('div-search').toUpperCase();
        const scope = TC.val('div-statut-filter');
        const today = TC.today();
        paint(rows.filter(function (r) {
            if (q && String(r.ticker).toUpperCase().indexOf(q) === -1) return false;
            if (scope === '__futur') { const d = detachOf(r); return d && d > today; }
            if (scope === '__ecart') return r.__issues.indexOf('rendement publié ≠ recalculé') !== -1;
            if (scope) return (r.statut || 'confirmé') === scope;
            return true;
        }));
    }

    /* ── Aperçu à la saisie ──────────────────────────────── */

    async function paintLive() {
        const ticker = TC.val('d-ticker').toUpperCase();
        const montant = TC.num('d-montant');
        const detach = TC.val('d-detach');
        const node = TC.el('div-live');

        if (!ticker || montant === null) {
            node.className = 'note';
            node.innerHTML = 'Saisissez le ticker, le montant et la date de détachement : le rendement se calcule sur le cours qui convient.';
            return;
        }

        const today = TC.today();
        const future = !detach || detach > today;

        if (future) {
            const price = latest.map[ticker];
            if (!price) {
                node.className = 'note warn';
                node.innerHTML = '<strong>Aucun cours connu pour ' + TC.esc(ticker) + '</strong> à la séance du ' +
                    (latest.date ? TC.fmtDate(latest.date) : 'jour') + '. Le rendement ne peut pas être calculé.';
                return;
            }
            const value = (montant / price) * 100;
            node.className = 'note' + (value > 25 ? ' warn' : '');
            node.innerHTML = '<strong>Rendement prévisionnel : ' + value.toFixed(2) + ' %</strong> — ' +
                TC.fmt(montant) + ' F sur le dernier cours connu de ' + TC.fmt(price) + ' F au ' + TC.fmtDate(latest.date) +
                '.<br>Ce chiffre suivra le marché jusqu\'au détachement, après quoi il se figera sur le cours de ce jour-là.' +
                (value > 25 ? '<br>Un rendement supérieur à 25 % traduit presque toujours une erreur de montant.' : '');
            return;
        }

        /* Détachement passé : on va chercher le cours de ce jour-là. */
        node.className = 'note';
        node.innerHTML = 'Recherche du cours au détachement…';
        const quotes = await TC.get('historique',
            'select=date_seance,cours_cloture,cloture&ticker=eq.' + encodeURIComponent(ticker) +
            '&date_seance=lte.' + detach + '&order=date_seance.desc&limit=1');
        const point = quotes && quotes[0];
        const price = point ? close(point) : null;

        if (!price) {
            node.className = 'note warn';
            node.innerHTML = '<strong>Aucune cotation de ' + TC.esc(ticker) + ' au ' + TC.fmtDate(detach) +
                ' ou avant.</strong> Le rendement historique ne peut pas être établi ; importez l\'historique de cette période.';
            return;
        }
        const value = (montant / price) * 100;
        node.className = 'note' + (value > 25 ? ' warn' : '');
        node.innerHTML = '<strong>Rendement historique : ' + value.toFixed(2) + ' %</strong> — ' +
            TC.fmt(montant) + ' F sur le cours de clôture du ' + TC.fmtDate(point.date_seance) +
            ' (' + TC.fmt(price) + ' F)' +
            (point.date_seance === detach ? '' : ', dernière séance avant le détachement') +
            '.<br>Ce rendement est définitif : il ne dépend pas du cours actuel.';
    }

    async function save() {
        const ticker = TC.val('d-ticker').toUpperCase();
        const annee = TC.int('d-annee');
        const montant = TC.num('d-montant');
        const detach = TC.val('d-detach') || null;

        if (!ticker || annee === null || montant === null) {
            TC.say('div-msg', 'Ticker, exercice et montant sont obligatoires.', 'err'); return;
        }
        const known = await TC.tickerSet();
        if (!known.has(ticker)) {
            TC.say('div-msg', 'Le ticker ' + ticker + ' n\'existe pas dans le référentiel.', 'err'); return;
        }

        let rendement = TC.num('d-rendement');
        if (rendement === null) {
            const today = TC.today();
            if (detach && detach <= today) {
                const quotes = await TC.get('historique',
                    'select=cours_cloture,cloture&ticker=eq.' + encodeURIComponent(ticker) +
                    '&date_seance=lte.' + detach + '&order=date_seance.desc&limit=1');
                const price = quotes && quotes[0] ? close(quotes[0]) : null;
                if (price && price > 0) rendement = Math.round((montant / price) * 10000) / 100;
            } else {
                const price = latest.map[ticker];
                if (price && price > 0) rendement = Math.round((montant / price) * 10000) / 100;
            }
        }

        const body = {
            ticker, annee, exercice: annee,
            montant, montant_net: montant,
            taux_rendement: rendement, rendement,
            date_detachement: detach, ex_date: detach,
            date_paiement: TC.val('d-paiement') || null,
            statut: TC.val('d-statut'),
            notes: TC.val('d-notes') || null
        };

        const issues = audit(Object.assign({ __ref: null }, body));
        if (issues.length && !confirm('Points à vérifier :\n\n' + issues.map(i => '· ' + i).join('\n') +
            '\n\nEnregistrer malgré tout ?')) return;

        try {
            if (editing) {
                await TC.patch('dividendes_calendrier', 'id=eq.' + editing, body);
                TC.say('div-msg', 'Dividende modifié.', 'ok');
                resetForm();
            } else {
                await TC.post('dividendes_calendrier', body);
                TC.say('div-msg', ticker + ' — exercice ' + annee + ' enregistré.', 'ok');
                TC.clear(['d-montant', 'd-rendement', 'd-detach', 'd-paiement', 'd-notes']);
            }
            load();
        } catch (e) { TC.say('div-msg', e.message, 'err'); }
    }

    function edit(row) {
        editing = row.id;
        TC.setVal('d-ticker', row.ticker);
        TC.setVal('d-annee', row.annee || row.exercice);
        TC.setVal('d-montant', montantOf(row));
        TC.setVal('d-rendement', row.taux_rendement);
        TC.setVal('d-detach', detachOf(row) || '');
        TC.setVal('d-paiement', TC.toISODate(row.date_paiement) || '');
        TC.setVal('d-statut', row.statut || 'confirmé');
        TC.setVal('d-notes', row.notes);
        TC.el('div-form-title').textContent = 'Modifier ' + row.ticker + ' — exercice ' + (row.annee || row.exercice);
        TC.el('div-save').textContent = 'Enregistrer la modification';
        TC.el('div-cancel-edit').hidden = false;
        TC.say('div-msg', 'Modification en cours. Les champs sont pré-remplis.', 'info');
        paintLive();
        TC.el('d-montant').focus();
        TC.el('panel-dividendes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetForm() {
        editing = null;
        TC.clear(['d-ticker', 'd-annee', 'd-montant', 'd-rendement', 'd-detach', 'd-paiement', 'd-notes']);
        TC.setVal('d-statut', 'confirmé');
        TC.el('div-form-title').textContent = 'Enregistrer un dividende';
        TC.el('div-save').textContent = 'Enregistrer';
        TC.el('div-cancel-edit').hidden = true;
        TC.say('div-msg', '');
        paintLive();
    }

    /**
     * Réalignement de masse. Les dividendes passés sont reportés au cours de
     * leur détachement, les dividendes à venir au dernier cours connu. Le
     * détail est annoncé avant exécution : corriger deux cents lignes de
     * rendement sans dire selon quelle règle serait inacceptable.
     */
    async function refreshYields() {
        const drift = rows.filter(function (r) {
            const ref = r.__ref;
            if (!ref || ref.yield === null || ref.yield === undefined) return false;
            const published = TC.toNumber(r.taux_rendement);
            return published === null || Math.abs(published - ref.yield) > 0.05;
        });

        if (!drift.length) { TC.toast('Tous les rendements sont conformes à la règle de calcul', 'ok'); return; }

        const past = drift.filter(r => r.__ref.nature === 'historique').length;
        const future = drift.length - past;
        const orphans = rows.filter(r => r.__ref && r.__ref.nature === 'historique' &&
            (r.__ref.yield === null || r.__ref.yield === undefined)).length;

        if (!confirm(
            'Recalculer ' + drift.length + ' rendement(s) ?\n\n' +
            '· ' + past + ' dividende(s) déjà détaché(s) : rendement établi au cours de clôture du jour du détachement, définitif.\n' +
            '· ' + future + ' dividende(s) à venir : rendement établi au dernier cours connu' +
            (latest.date ? ' (' + TC.fmtDate(latest.date) + ')' : '') + ', révisable jusqu\'au détachement.\n' +
            (orphans ? '\n' + orphans + ' dividende(s) resteront sans rendement : aucune cotation trouvée au détachement.\n' : '') +
            '\nLes valeurs publiées seront remplacées.')) return;

        let done = 0;
        for (const r of drift) {
            try {
                await TC.patch('dividendes_calendrier', 'id=eq.' + r.id,
                    { taux_rendement: r.__ref.yield, rendement: r.__ref.yield });
                done++;
            } catch (e) { /* comptabilisé dans le bilan */ }
        }
        TC.toast(done + ' / ' + drift.length + ' rendement(s) recalculés', done === drift.length ? 'ok' : 'err');
        load();
    }

    TC.register({
        id: 'dividendes',
        label: 'Dividendes',
        group: 'societes',
        icon: '◆',
        keywords: 'dividende rendement detachement paiement exercice',
        view,
        refresh: load,
        mount() {
            const tickerInput = TC.el('d-ticker');
            if (tickerInput) tickerInput.setAttribute('list', 'tickers-list');
            TC.on('div-save', 'click', save);
            TC.on('div-clear', 'click', resetForm);
            TC.on('div-cancel-edit', 'click', resetForm);
            TC.on('div-reload', 'click', load);
            TC.on('div-search', 'input', filter);
            TC.on('div-statut-filter', 'change', filter);
            TC.on('div-refresh-yield', 'click', refreshYields);
            TC.on('d-ticker', 'input', paintLive);
            TC.on('d-montant', 'input', paintLive);
            TC.on('d-detach', 'change', paintLive);
            TC.on('div-export', 'click', function () {
                if (!rows.length) return;
                const list = rows.map(r => ({
                    ticker: r.ticker, annee: r.annee, montant: montantOf(r),
                    rendement_publie: r.taux_rendement,
                    rendement_recalcule: r.__ref ? r.__ref.yield : null,
                    base_calcul: r.__ref ? r.__ref.nature : '',
                    cours_reference: r.__ref ? r.__ref.price : null,
                    date_reference: r.__ref ? r.__ref.date : '',
                    date_detachement: detachOf(r), date_paiement: r.date_paiement,
                    statut: r.statut, notes: r.notes
                }));
                TC.download('dividendes-' + TC.today() + '.csv',
                    TC.toCSV(list, ['ticker', 'annee', 'montant', 'rendement_publie', 'rendement_recalcule',
                        'base_calcul', 'cours_reference', 'date_reference', 'date_detachement',
                        'date_paiement', 'statut', 'notes']),
                    'text/csv;charset=utf-8');
            });
            TC.on('div-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('div-bulk-reset', 'click', () => sel.reset());
            TC.on('div-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' dividende(s) ?', 'le screener dividendes perdra ces lignes')) return;
                let done = 0;
                for (const id of ids) { try { await TC.del('dividendes_calendrier', 'id=eq.' + id); done++; } catch (e) { /* bilan */ } }
                TC.toast(done + ' ligne(s) supprimées', 'ok');
                load();
            });
            TC.delegate('div-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('div-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('div-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer le dividende ' + row.ticker + ' — ' + (row.annee || '') + ' ?')) return;
                try { await TC.del('dividendes_calendrier', 'id=eq.' + row.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
