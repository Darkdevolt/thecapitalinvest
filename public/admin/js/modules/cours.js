/* ============================================================
   THE CAPITAL — COURS & HISTORIQUE
   Un seul gestionnaire pour les données de marché. L'ancienne
   séparation « Cours » / « Historique » / « Archive » présentait
   trois vues concurrentes sur la même table `historique`, avec
   trois logiques de suppression différentes. Tout est ici.

   Table de référence : historique (ticker, date_seance,
   cours_cloture, cloture, cours_ouverture, plus_haut, plus_bas,
   volume, variation, variation_pct, valeur_totale).
   ============================================================ */
'use strict';

(function (TC) {

    const state = {
        session: null,      // date de la séance affichée
        rows: [],           // lignes de la séance
        ticker: '',         // ticker de la vue historique
        serie: [],          // série d'un ticker
        sessions: []        // calendrier des séances
    };

    const sel = TC.selection('cours');

    /* Clôture : deux colonnes coexistent en base selon l'origine de la ligne. */
    const close = r => TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);

    /* ── Vue ─────────────────────────────────────────────── */

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Cours &amp; <em>historique</em></div>' +
            '<div class="page-sub">Poste de contrôle des cotations. Une séance se consulte par date, une valeur se suit par ticker. Chaque écriture passe par les mêmes contrôles de cohérence : format de date, ordre des prix, limite de variation BRVM de ±' + TC.VARIATION_LIMIT + ' %.</div></div>' +
            '</div>' +

            '<div class="subtabs">' +
            '<button class="subtab active" data-sub="seance">Par séance</button>' +
            '<button class="subtab" data-sub="valeur">Par valeur</button>' +
            '<button class="subtab" data-sub="saisie">Saisir une cotation</button>' +
            '<button class="subtab" data-sub="lot">Import CSV rapide</button>' +
            '<button class="subtab" data-sub="calendrier">Calendrier des séances</button>' +
            '</div>' +

            /* ── Par séance ── */
            '<div class="subpane active" id="sub-seance">' +
            '<div class="card"><div class="card-head"><span class="card-title">Séance affichée</span>' +
            '<span class="card-tools">' +
            '<button class="btn btn-outline btn-sm" id="c-prev">← Précédente</button>' +
            '<input type="date" id="c-session-date" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;font-family:var(--mono);">' +
            '<button class="btn btn-outline btn-sm" id="c-next">Suivante →</button>' +
            '<button class="btn btn-primary btn-sm" id="c-load">Charger</button>' +
            '<button class="btn btn-outline btn-sm" id="c-export">⬇ CSV</button>' +
            '</span></div>' +
            '<div id="c-summary" class="card-body tight"></div></div>' +

            '<div class="card">' +
            '<div class="card-head"><span class="card-title">Cotations de la séance</span>' +
            '<span class="card-tools"><input type="search" id="c-filter" placeholder="Filtrer un ticker…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:150px;">' +
            '<span class="card-count" id="c-count"></span></span></div>' +
            '<div class="bulkbar" id="bulk-cours"><span class="bulk-count">0 ligne(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="c-bulk-del">Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" id="c-bulk-reset">Tout désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-cours-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="c-check-all"></th>' +
            '<th>Ticker</th><th>Société</th><th class="r">Clôture</th><th class="r">Ouverture</th>' +
            '<th class="r">Plus haut</th><th class="r">Plus bas</th><th class="r">Volume</th>' +
            '<th class="r">Variation</th><th class="r">Valeur échangée</th><th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="c-tbody">' + TC.rowsLoading(12) + '</tbody></table></div></div>' +
            '</div>' +

            /* ── Par valeur ── */
            '<div class="subpane" id="sub-valeur">' +
            '<div class="card"><div class="card-head"><span class="card-title">Suivre une valeur</span>' +
            '<span class="card-tools">' +
            '<input type="text" id="h-ticker" list="tickers-list" placeholder="Ticker…" data-upper="1" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:130px;">' +
            '<input type="date" id="h-from" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<input type="date" id="h-to" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<button class="btn btn-primary btn-sm" id="h-load">Charger</button>' +
            '<button class="btn btn-outline btn-sm" id="h-recalc">↻ Recalculer les variations</button>' +
            '<button class="btn btn-outline btn-sm" id="h-export">⬇ CSV</button>' +
            '</span></div>' +
            '<div id="h-summary" class="card-body tight"><div class="note">Entrez un ticker pour afficher sa série complète, contrôler la continuité des séances et recalculer les variations depuis les clôtures réelles.</div></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Série de cotations</span>' +
            '<span class="card-tools"><span class="card-count" id="h-count"></span>' +
            '<button class="btn btn-danger btn-sm" id="h-purge" hidden>Supprimer toute la série</button></span></div>' +
            '<div class="tw capped"><table><thead><tr>' +
            '<th>Date</th><th class="r">Clôture</th><th class="r">Ouverture</th><th class="r">Plus haut</th>' +
            '<th class="r">Plus bas</th><th class="r">Volume</th><th class="r">Variation</th>' +
            '<th class="r">Variation recalculée</th><th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="h-tbody">' + TC.rowsEmpty(10, 'Aucune valeur chargée', 'Saisissez un ticker puis cliquez sur Charger.') + '</tbody></table></div></div>' +
            '</div>' +

            /* ── Saisie ── */
            '<div class="subpane" id="sub-saisie">' +
            '<div class="card accent"><div class="card-head"><span class="card-title">Enregistrer une cotation</span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 's-ticker', label: 'Ticker', placeholder: 'SNTS', upper: true },
                { id: 's-date', label: 'Date de séance', type: 'date' },
                { id: 's-close', label: 'Cours de clôture', type: 'number', placeholder: '14 500', col: 'cours_cloture' },
                { id: 's-open', label: 'Ouverture', type: 'number', placeholder: '14 400' },
                { id: 's-high', label: 'Plus haut', type: 'number' },
                { id: 's-low', label: 'Plus bas', type: 'number' },
                { id: 's-vol', label: 'Volume (titres)', type: 'number', step: '1' },
                { id: 's-var', label: 'Variation %', type: 'number', col: 'variation', hint: 'Laissez vide : la variation est calculée depuis la clôture précédente.' },
                { id: 's-value', label: 'Valeur échangée', type: 'number', col: 'valeur_totale' }
            ]) + '</div>' +
            '<div class="actions">' +
            '<button class="btn btn-primary" id="s-save">Enregistrer la cotation</button>' +
            '<button class="btn btn-outline btn-sm" id="s-auto">↻ Calculer la variation</button>' +
            '<button class="btn btn-outline btn-sm" id="s-clear">Effacer</button>' +
            '<span class="msg" id="s-msg"></span></div></div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Ce qui est contrôlé avant écriture</span></div>' +
            '<div class="card-body"><div class="note">' +
            '<strong>Référentiel</strong> — le ticker doit exister dans Entreprises.<br>' +
            '<strong>Date</strong> — format AAAA-MM-JJ, jamais dans le futur, jour ouvré signalé si week-end.<br>' +
            '<strong>Prix</strong> — clôture obligatoire et strictement positive, plus haut ≥ plus bas, clôture et ouverture comprises dans l\'intervalle.<br>' +
            '<strong>Variation</strong> — au-delà de ±' + TC.VARIATION_LIMIT + ' %, l\'écriture demande une confirmation explicite.<br>' +
            '<strong>Doublon</strong> — une cotation existante pour ce couple ticker/date est mise à jour, jamais dupliquée.' +
            '</div></div></div>' +
            '</div>' +

            /* ── Import CSV ── */
            '<div class="subpane" id="sub-lot">' +
            '<div class="card"><div class="card-head"><span class="card-title">Coller un lot de cotations</span></div>' +
            '<div class="card-body">' +
            '<div class="note" style="margin-bottom:12px;"><strong>Format attendu</strong> — une ligne par cotation :<br>' +
            '<span style="font-family:var(--mono);font-size:11px;color:var(--cream);">ticker;date;cloture;ouverture;plus_haut;plus_bas;volume;variation;valeur_totale</span><br>' +
            'Le point-virgule, la virgule et la tabulation sont acceptés comme séparateur. Seules les trois premières colonnes sont obligatoires. Pour un vrai fichier Excel, utilisez la section Import Excel.</div>' +
            '<textarea id="lot-text" rows="9" placeholder="SNTS;2026-08-21;14500;14400;14600;14350;1200;0,69;17400000&#10;ECOC;2026-08-21;11250;11200;11300;11150;850;-0,44;9562500" style="width:100%;font-family:var(--mono);font-size:12px;padding:12px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:5px;color:var(--cream);resize:vertical;"></textarea>' +
            '</div>' +
            '<div class="actions">' +
            '<button class="btn btn-outline btn-sm" id="lot-check">Analyser</button>' +
            '<button class="btn btn-primary" id="lot-import" disabled>Importer les lignes valides</button>' +
            '<button class="btn btn-outline btn-sm" id="lot-clear">Effacer</button>' +
            '<span class="msg" id="lot-msg"></span></div>' +
            '<div id="lot-preview"></div></div>' +
            '</div>' +

            /* ── Calendrier ── */
            '<div class="subpane" id="sub-calendrier">' +
            '<div class="card"><div class="card-head"><span class="card-title">Séances enregistrées</span>' +
            '<span class="card-tools"><select id="cal-year" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;"></select>' +
            '<button class="btn btn-outline btn-sm" id="cal-reload">↺ Recharger</button></span></div>' +
            '<div id="cal-body"><div class="loading"><div class="spinner"></div>Lecture du calendrier…</div></div></div>' +
            '</div>';
    }

    /* ── Contrôles de cohérence d'une ligne ──────────────── */

    function auditRow(r, previousClose) {
        const issues = [];
        const c = close(r), o = TC.toNumber(r.cours_ouverture),
            h = TC.toNumber(r.plus_haut), l = TC.toNumber(r.plus_bas),
            vol = TC.toNumber(r.volume), varr = TC.toNumber(r.variation);

        if (c === null) issues.push({ level: 'err', text: 'clôture absente' });
        else if (c <= 0) issues.push({ level: 'err', text: 'clôture nulle ou négative' });
        if (h !== null && l !== null && h < l) issues.push({ level: 'err', text: 'plus haut < plus bas' });
        if (h !== null && c !== null && c > h) issues.push({ level: 'err', text: 'clôture au-dessus du plus haut' });
        if (l !== null && c !== null && c < l) issues.push({ level: 'err', text: 'clôture au-dessous du plus bas' });
        if (o !== null && h !== null && o > h) issues.push({ level: 'err', text: 'ouverture au-dessus du plus haut' });
        if (o !== null && l !== null && o < l) issues.push({ level: 'err', text: 'ouverture au-dessous du plus bas' });
        if (vol !== null && vol < 0) issues.push({ level: 'err', text: 'volume négatif' });
        if (r.date_seance && r.date_seance > TC.today()) issues.push({ level: 'err', text: 'séance future' });
        if (r.date_seance && TC.isWeekend(r.date_seance)) issues.push({ level: 'warn', text: 'jour non ouvré' });
        if (varr !== null && Math.abs(varr) > TC.VARIATION_LIMIT + 0.01) {
            issues.push({ level: 'warn', text: 'variation hors limite ±' + TC.VARIATION_LIMIT + ' %' });
        }
        if (varr === null) issues.push({ level: 'warn', text: 'variation absente' });
        if (previousClose && c !== null && previousClose > 0) {
            const computed = ((c - previousClose) / previousClose) * 100;
            if (varr !== null && Math.abs(computed - varr) > 0.3) {
                issues.push({ level: 'warn', text: 'variation publiée ≠ recalculée (' + computed.toFixed(2) + ' %)' });
            }
        }
        return issues;
    }

    function auditBadge(issues) {
        if (!issues.length) return '<span class="badge badge-green">conforme</span>';
        const err = issues.filter(i => i.level === 'err');
        const title = issues.map(i => i.text).join(' · ');
        return '<span class="badge ' + (err.length ? 'badge-red' : 'badge-orange') + '" title="' + TC.esc(title) + '">' +
            TC.esc(issues[0].text) + (issues.length > 1 ? ' +' + (issues.length - 1) : '') + '</span>';
    }

    /* ── Vue par séance ──────────────────────────────────── */

    async function loadSession(date) {
        const tbody = TC.el('c-tbody');
        tbody.innerHTML = TC.rowsLoading(12);

        if (!date) {
            const latest = await TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1');
            date = latest && latest[0] && latest[0].date_seance;
            if (!date) {
                tbody.innerHTML = TC.rowsEmpty(12, 'Aucune cotation en base',
                    'Lancez le scraper BRVM ou importez un fichier de cours.');
                return;
            }
        }

        state.session = date;
        TC.setVal('c-session-date', date);

        const [rows, refs] = await Promise.all([
            TC.getAll('historique', 'select=*&date_seance=eq.' + date + '&order=ticker.asc'),
            TC.tickers()
        ]);

        const names = {};
        refs.forEach(r => { names[String(r.ticker).toUpperCase()] = r.nom; });

        /* Clôtures de la séance précédente, pour recalculer les variations. */
        const prevDate = await previousSessionDate(date);
        const prevMap = {};
        if (prevDate) {
            const prev = await TC.getAll('historique',
                'select=ticker,cours_cloture,cloture&date_seance=eq.' + prevDate);
            (prev || []).forEach(r => { prevMap[String(r.ticker).toUpperCase()] = close(r); });
        }

        state.rows = (rows || []).map(r => {
            r.__name = names[String(r.ticker).toUpperCase()] || '';
            r.__prev = prevMap[String(r.ticker).toUpperCase()] || null;
            r.__issues = auditRow(r, r.__prev);
            return r;
        });

        paintSummary(prevDate);
        paintSessionRows(state.rows);
    }

    async function previousSessionDate(date) {
        const rows = await TC.get('historique',
            'select=date_seance&date_seance=lt.' + date + '&order=date_seance.desc&limit=1');
        return rows && rows[0] ? rows[0].date_seance : null;
    }

    function paintSummary(prevDate) {
        const quoted = state.rows.filter(r => !TC.isIndice(r.ticker));
        const errors = state.rows.filter(r => r.__issues.some(i => i.level === 'err')).length;
        const warns = state.rows.filter(r => r.__issues.length && !r.__issues.some(i => i.level === 'err')).length;
        const volume = quoted.reduce((s, r) => s + (TC.toNumber(r.volume) || 0), 0);
        const value = quoted.reduce((s, r) => s + (TC.toNumber(r.valeur_totale) || 0), 0);

        TC.el('c-summary').innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">' +
            '<div><div class="kpi-label">Séance</div><div class="kpi-value sm">' + TC.fmtDate(state.session) + '</div>' +
            '<div class="kpi-sub">' + (prevDate ? 'précédente : ' + TC.fmtDate(prevDate) : 'première séance connue') + '</div></div>' +
            '<div><div class="kpi-label">Lignes</div><div class="kpi-value sm">' + state.rows.length + '</div><div class="kpi-sub">' + quoted.length + ' actions</div></div>' +
            '<div><div class="kpi-label">Volume</div><div class="kpi-value sm">' + TC.fmtInt(volume) + '</div></div>' +
            '<div><div class="kpi-label">Valeur échangée</div><div class="kpi-value sm">' + TC.fmtInt(value) + ' F</div></div>' +
            '<div><div class="kpi-label">Bloquants</div><div class="kpi-value sm ' + (errors ? 'down' : 'up') + '">' + errors + '</div></div>' +
            '<div><div class="kpi-label">À vérifier</div><div class="kpi-value sm">' + warns + '</div></div>' +
            '</div>' +
            (errors ? '<div class="note err" style="margin-top:12px;"><strong>' + errors +
                ' cotation(s) refusées par les contrôles.</strong> Elles restent visibles et modifiables ci-dessous ; l\'application publique peut les afficher telles quelles tant qu\'elles ne sont pas corrigées.</div>' : '');
    }

    function paintSessionRows(rows) {
        const tbody = TC.el('c-tbody');
        TC.el('c-count').textContent = rows.length + ' ligne(s)';
        if (!rows.length) {
            tbody.innerHTML = TC.rowsEmpty(12, 'Aucune cotation pour cette date', 'Vérifiez la date ou consultez le calendrier des séances.');
            return;
        }
        sel.reset();
        tbody.innerHTML = rows.map(function (r) {
            const err = r.__issues.some(i => i.level === 'err');
            return '<tr class="' + (err ? 'row-flag' : r.__issues.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="td-muted">' + TC.esc(r.__name || '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(close(r)) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.cours_ouverture) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_haut) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_bas) + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(r.volume) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.variation) + '">' + TC.fmtPct(r.variation) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmtInt(r.valeur_totale) + '</td>' +
                '<td>' + auditBadge(r.__issues) + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    /* ── Édition d'une cotation ──────────────────────────── */

    function editRow(row) {
        TC.modal.open({
            title: 'Cotation ' + row.ticker,
            subtitle: TC.fmtDateLong(row.date_seance) +
                (row.__prev ? ' · clôture précédente ' + TC.fmt(row.__prev) : ''),
            body: '<div class="form-grid">' + TC.fields([
                { id: 'm-close', label: 'Cours de clôture', type: 'number' },
                { id: 'm-open', label: 'Ouverture', type: 'number' },
                { id: 'm-high', label: 'Plus haut', type: 'number' },
                { id: 'm-low', label: 'Plus bas', type: 'number' },
                { id: 'm-vol', label: 'Volume', type: 'number', step: '1' },
                { id: 'm-var', label: 'Variation %', type: 'number' },
                { id: 'm-value', label: 'Valeur échangée', type: 'number', wide: true }
            ]) + '</div>' +
                '<div class="card-body tight"><div class="note" id="m-audit"></div></div>',
            afterOpen() {
                TC.setVal('m-close', close(row));
                TC.setVal('m-open', row.cours_ouverture);
                TC.setVal('m-high', row.plus_haut);
                TC.setVal('m-low', row.plus_bas);
                TC.setVal('m-vol', row.volume);
                TC.setVal('m-var', row.variation);
                TC.setVal('m-value', row.valeur_totale);
                const audit = () => {
                    const draft = {
                        cours_cloture: TC.num('m-close'), cours_ouverture: TC.num('m-open'),
                        plus_haut: TC.num('m-high'), plus_bas: TC.num('m-low'),
                        volume: TC.num('m-vol'), variation: TC.num('m-var'), date_seance: row.date_seance
                    };
                    const issues = auditRow(draft, row.__prev);
                    TC.el('m-audit').innerHTML = issues.length
                        ? '<strong>' + issues.length + ' point(s) de contrôle</strong> ' + TC.esc(issues.map(i => i.text).join(' · '))
                        : '<strong>Ligne conforme</strong> aux contrôles de cohérence.';
                    TC.el('m-audit').className = 'note' + (issues.some(i => i.level === 'err') ? ' err' : issues.length ? ' warn' : '');
                };
                ['m-close', 'm-open', 'm-high', 'm-low', 'm-vol', 'm-var'].forEach(id => TC.on(id, 'input', audit));
                TC.on('m-close', 'input', function () {
                    const c = TC.num('m-close');
                    if (row.__prev && c !== null && row.__prev > 0) {
                        TC.setVal('m-var', (((c - row.__prev) / row.__prev) * 100).toFixed(2));
                        audit();
                    }
                });
                audit();
            },
            async onSave() {
                const body = {
                    cours_cloture: TC.num('m-close'), cloture: TC.num('m-close'),
                    cours_ouverture: TC.num('m-open'), plus_haut: TC.num('m-high'),
                    plus_bas: TC.num('m-low'), volume: TC.num('m-vol'),
                    variation: TC.num('m-var'), variation_pct: TC.num('m-var'),
                    valeur_totale: TC.num('m-value')
                };
                if (body.cours_cloture === null || body.cours_cloture <= 0) {
                    TC.modal.msg('Le cours de clôture est obligatoire et doit être positif.', 'err');
                    return;
                }
                const issues = auditRow(Object.assign({ date_seance: row.date_seance }, body), row.__prev);
                if (issues.some(i => i.level === 'err') &&
                    !confirm('Cette ligne reste en défaut :\n\n' + issues.map(i => '· ' + i.text).join('\n') +
                        '\n\nEnregistrer malgré tout ?')) return;
                try {
                    /* PATCH sur l'identifiant : jamais sur ticker+date, deux lignes
                       en doublon seraient écrasées ensemble sans qu'on le voie. */
                    await TC.patch('historique', 'id=eq.' + encodeURIComponent(row.id), body);
                    TC.modal.close();
                    TC.toast('Cotation ' + row.ticker + ' mise à jour', 'ok');
                    loadSession(state.session);
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    async function deleteRow(row) {
        if (!TC.confirmTwice(
            'Supprimer la cotation ' + row.ticker + ' du ' + TC.fmtDate(row.date_seance) + ' ?',
            'la ligne disparaîtra de l\'historique et des graphiques de l\'application')) return;
        try {
            await TC.del('historique', 'id=eq.' + encodeURIComponent(row.id));
            TC.toast('Cotation supprimée', 'ok');
            loadSession(state.session);
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    async function bulkDelete() {
        const ids = sel.ids();
        if (!ids.length) { TC.toast('Aucune ligne sélectionnée', 'err'); return; }
        if (!TC.confirmTwice('Supprimer ' + ids.length + ' cotation(s) ?',
            ids.length + ' lignes seront définitivement effacées')) return;
        let done = 0;
        for (const id of ids) {
            try { await TC.del('historique', 'id=eq.' + encodeURIComponent(id)); done++; }
            catch (e) { /* comptabilisé dans le bilan */ }
        }
        TC.toast(done + ' / ' + ids.length + ' cotation(s) supprimée(s)', done === ids.length ? 'ok' : 'err');
        sel.reset();
        loadSession(state.session);
    }

    /* ── Vue par valeur ──────────────────────────────────── */

    async function loadSerie() {
        const ticker = TC.val('h-ticker').toUpperCase();
        if (!ticker) { TC.toast('Indiquez un ticker', 'err'); return; }
        state.ticker = ticker;
        const tbody = TC.el('h-tbody');
        tbody.innerHTML = TC.rowsLoading(10);

        let query = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=date_seance.desc';
        const from = TC.val('h-from'), to = TC.val('h-to');
        if (from) query += '&date_seance=gte.' + from;
        if (to) query += '&date_seance=lte.' + to;

        const rows = await TC.getAll('historique', query);
        state.serie = rows || [];

        if (!state.serie.length) {
            tbody.innerHTML = TC.rowsEmpty(10, 'Aucune cotation pour ' + ticker,
                'Vérifiez l\'orthographe du ticker ou élargissez la période.');
            TC.el('h-purge').hidden = true;
            TC.el('h-count').textContent = '';
            TC.el('h-summary').innerHTML = '<div class="note warn"><strong>Série vide.</strong> Ce ticker n\'a aucune cotation sur la période demandée.</div>';
            return;
        }

        /* Ordre croissant pour recalculer les variations, puis inversion. */
        const asc = state.serie.slice().sort((a, b) => a.date_seance.localeCompare(b.date_seance));
        for (let i = 0; i < asc.length; i++) {
            const prev = i > 0 ? close(asc[i - 1]) : null;
            asc[i].__prev = prev;
            asc[i].__computed = (prev && prev > 0 && close(asc[i]) !== null)
                ? ((close(asc[i]) - prev) / prev) * 100 : null;
            asc[i].__issues = auditRow(asc[i], prev);
        }

        const closes = asc.map(close).filter(c => c !== null);
        const gaps = [];
        for (let i = 1; i < asc.length; i++) {
            const delta = Math.round((Date.parse(asc[i].date_seance) - Date.parse(asc[i - 1].date_seance)) / 86400000);
            if (delta > 5) gaps.push({ from: asc[i - 1].date_seance, to: asc[i].date_seance, days: delta });
        }
        const dup = {};
        asc.forEach(r => { dup[r.date_seance] = (dup[r.date_seance] || 0) + 1; });
        const duplicates = Object.keys(dup).filter(d => dup[d] > 1);

        TC.el('h-summary').innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">' +
            '<div><div class="kpi-label">Séances</div><div class="kpi-value sm">' + asc.length + '</div></div>' +
            '<div><div class="kpi-label">Première</div><div class="kpi-value sm">' + TC.fmtDate(asc[0].date_seance) + '</div></div>' +
            '<div><div class="kpi-label">Dernière</div><div class="kpi-value sm">' + TC.fmtDate(asc[asc.length - 1].date_seance) + '</div></div>' +
            '<div><div class="kpi-label">Plus haut</div><div class="kpi-value sm">' + TC.fmt(Math.max.apply(null, closes)) + '</div></div>' +
            '<div><div class="kpi-label">Plus bas</div><div class="kpi-value sm">' + TC.fmt(Math.min.apply(null, closes)) + '</div></div>' +
            '<div><div class="kpi-label">Trous > 5 j</div><div class="kpi-value sm">' + gaps.length + '</div></div>' +
            '</div>' +
            (duplicates.length ? '<div class="note err" style="margin-top:12px;"><strong>Doublons de date : ' +
                TC.esc(duplicates.slice(0, 8).join(', ')) + '</strong> — deux lignes pour la même séance faussent tous les calculs de variation.</div>' : '') +
            (gaps.length ? '<div class="note warn" style="margin-top:10px;"><strong>Interruptions de série</strong> — ' +
                gaps.slice(0, 5).map(g => TC.fmtDate(g.from) + ' → ' + TC.fmtDate(g.to) + ' (' + g.days + ' j)').join(' · ') +
                (gaps.length > 5 ? ' et ' + (gaps.length - 5) + ' autre(s)' : '') + '</div>' : '');

        const desc = asc.slice().reverse();
        TC.el('h-count').textContent = desc.length + ' ligne(s)';
        TC.el('h-purge').hidden = false;
        tbody.innerHTML = desc.map(r => {
            const drift = r.__computed !== null && TC.toNumber(r.variation) !== null &&
                Math.abs(r.__computed - TC.toNumber(r.variation)) > 0.3;
            return '<tr class="' + (r.__issues.some(i => i.level === 'err') ? 'row-flag' : drift ? 'row-warn' : '') + '">' +
                '<td class="td-mono">' + TC.fmtDate(r.date_seance) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(close(r)) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.cours_ouverture) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_haut) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_bas) + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(r.volume) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.variation) + '">' + TC.fmtPct(r.variation) + '</td>' +
                '<td class="r td-mono ' + (drift ? 'down' : 'td-muted') + '">' + TC.fmtPct(r.__computed) + '</td>' +
                '<td>' + auditBadge(r.__issues) + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-hedit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-hdel="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    /**
     * Recalcule les variations d'une série à partir des clôtures réelles.
     * La variation publiée par la source est parfois absente, parfois calculée
     * sur une séance de référence différente ; c'est la première cause d'écart
     * entre le graphique de l'application et le bulletin officiel.
     */
    async function recalcSerie() {
        if (!state.serie.length) { TC.toast('Chargez d\'abord une série', 'err'); return; }
        const asc = state.serie.slice().sort((a, b) => a.date_seance.localeCompare(b.date_seance));
        const updates = [];
        for (let i = 1; i < asc.length; i++) {
            const prev = close(asc[i - 1]), cur = close(asc[i]);
            if (prev === null || cur === null || prev <= 0) continue;
            const computed = Math.round(((cur - prev) / prev) * 10000) / 100;
            const published = TC.toNumber(asc[i].variation);
            if (published === null || Math.abs(published - computed) > 0.01) {
                updates.push({ id: asc[i].id, date: asc[i].date_seance, from: published, to: computed });
            }
        }
        if (!updates.length) { TC.toast('Toutes les variations sont déjà exactes', 'ok'); return; }
        if (!confirm('Recalculer ' + updates.length + ' variation(s) de ' + state.ticker +
            ' à partir des clôtures enregistrées ?\n\nLes valeurs publiées seront remplacées.')) return;

        let done = 0;
        for (const u of updates) {
            try {
                await TC.patch('historique', 'id=eq.' + encodeURIComponent(u.id),
                    { variation: u.to, variation_pct: u.to });
                done++;
            } catch (e) { /* comptabilisé dans le bilan */ }
        }
        TC.toast(done + ' / ' + updates.length + ' variation(s) recalculée(s)', done === updates.length ? 'ok' : 'err');
        loadSerie();
    }

    async function purgeSerie() {
        if (!state.ticker) return;
        const answer = prompt('Suppression totale de la série ' + state.ticker + ' (' + state.serie.length +
            ' lignes).\n\nTapez le ticker en majuscules pour confirmer :');
        if (answer !== state.ticker) { TC.toast('Suppression annulée', 'info'); return; }
        try {
            await TC.del('historique', 'ticker=eq.' + encodeURIComponent(state.ticker));
            TC.toast('Série ' + state.ticker + ' supprimée', 'ok');
            loadSerie();
        } catch (e) { TC.toast(e.message, 'err'); }
    }

    /* ── Saisie unitaire ─────────────────────────────────── */

    async function previousClose(ticker, date) {
        const rows = await TC.get('historique',
            'select=cours_cloture,cloture,date_seance&ticker=eq.' + encodeURIComponent(ticker) +
            '&date_seance=lt.' + date + '&order=date_seance.desc&limit=1');
        return rows && rows[0] ? close(rows[0]) : null;
    }

    async function autoVariation() {
        const ticker = TC.val('s-ticker').toUpperCase(), date = TC.val('s-date'), c = TC.num('s-close');
        if (!ticker || !date || c === null) { TC.say('s-msg', 'Ticker, date et clôture sont nécessaires au calcul.', 'err'); return; }
        const prev = await previousClose(ticker, date);
        if (prev === null || prev <= 0) { TC.say('s-msg', 'Aucune clôture antérieure trouvée pour ' + ticker + '.', 'warn'); return; }
        const computed = ((c - prev) / prev) * 100;
        TC.setVal('s-var', computed.toFixed(2));
        TC.say('s-msg', 'Clôture précédente ' + TC.fmt(prev) + ' → variation ' + TC.fmtPct(computed), 'ok');
    }

    async function saveEntry() {
        const ticker = TC.val('s-ticker').toUpperCase();
        const date = TC.toISODate(TC.val('s-date'));
        const c = TC.num('s-close');

        if (!ticker || !date || c === null) { TC.say('s-msg', 'Ticker, date de séance et clôture sont obligatoires.', 'err'); return; }
        if (c <= 0) { TC.say('s-msg', 'Le cours de clôture doit être strictement positif.', 'err'); return; }
        if (date > TC.today()) { TC.say('s-msg', 'Une séance ne peut pas être datée dans le futur.', 'err'); return; }

        const known = await TC.tickerSet();
        if (!known.has(ticker) && !TC.isIndice(ticker)) {
            TC.say('s-msg', 'Le ticker ' + ticker + ' n\'existe pas dans Entreprises. Créez la société d\'abord.', 'err');
            return;
        }

        let variation = TC.num('s-var');
        if (variation === null) {
            const prev = await previousClose(ticker, date);
            if (prev && prev > 0) variation = Math.round(((c - prev) / prev) * 10000) / 100;
        }

        const body = {
            ticker, date_seance: date,
            cours_cloture: c, cloture: c,
            cours_ouverture: TC.num('s-open'),
            plus_haut: TC.num('s-high'), plus_bas: TC.num('s-low'),
            volume: TC.num('s-vol'),
            variation, variation_pct: variation,
            valeur_totale: TC.num('s-value')
        };

        const issues = auditRow(body, null);
        const blocking = issues.filter(i => i.level === 'err');
        if (blocking.length) {
            TC.say('s-msg', 'Contrôle refusé : ' + blocking.map(i => i.text).join(' · '), 'err');
            return;
        }
        if (variation !== null && Math.abs(variation) > TC.VARIATION_LIMIT &&
            !confirm('La variation calculée (' + variation.toFixed(2) + ' %) dépasse la limite BRVM de ±' +
                TC.VARIATION_LIMIT + ' %.\n\nEnregistrer quand même ?')) return;

        try {
            await TC.post('historique', body);
            TC.say('s-msg', 'Cotation ' + ticker + ' du ' + TC.fmtDate(date) + ' enregistrée.', 'ok');
            TC.clear(['s-close', 's-open', 's-high', 's-low', 's-vol', 's-var', 's-value']);
            TC.el('s-ticker').focus();
            if (date === state.session) loadSession(date);
            TC.health.probe();
        } catch (e) { TC.say('s-msg', e.message, 'err'); }
    }

    /* ── Import CSV rapide ───────────────────────────────── */

    let lotRows = [];

    function parseLot() {
        const text = TC.val('lot-text');
        const preview = TC.el('lot-preview');
        lotRows = [];
        if (!text) { TC.say('lot-msg', 'Collez des lignes à analyser.', 'err'); preview.innerHTML = ''; return; }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const seen = new Set();
        const parsed = lines.map(function (line, i) {
            const parts = line.split(/[;\t]|,(?=\s*[A-Za-z0-9-])/).map(p => p.trim());
            const row = {
                ticker: String(parts[0] || '').toUpperCase(),
                date_seance: TC.toISODate(parts[1]),
                cours_cloture: TC.toNumber(parts[2]),
                cours_ouverture: TC.toNumber(parts[3]),
                plus_haut: TC.toNumber(parts[4]),
                plus_bas: TC.toNumber(parts[5]),
                volume: TC.toNumber(parts[6]),
                variation: TC.toNumber(parts[7]),
                valeur_totale: TC.toNumber(parts[8])
            };
            row.cloture = row.cours_cloture;
            row.variation_pct = row.variation;
            const errors = [];
            if (!row.ticker) errors.push('ticker manquant');
            if (!row.date_seance) errors.push('date illisible');
            if (row.cours_cloture === null) errors.push('clôture manquante');
            auditRow(row, null).filter(x => x.level === 'err').forEach(x => errors.push(x.text));
            const key = row.ticker + '|' + row.date_seance;
            if (seen.has(key)) errors.push('doublon dans le lot');
            seen.add(key);
            return { line: i + 1, row, errors };
        });

        lotRows = parsed.filter(p => !p.errors.length).map(p => p.row);
        const bad = parsed.filter(p => p.errors.length);

        TC.el('lot-import').disabled = !lotRows.length;
        TC.say('lot-msg', lotRows.length + ' ligne(s) valides · ' + bad.length + ' rejetée(s)',
            bad.length ? 'warn' : 'ok');

        preview.innerHTML = '<div class="tw capped"><table><thead><tr><th>#</th><th>Ticker</th><th>Date</th>' +
            '<th class="r">Clôture</th><th class="r">Volume</th><th class="r">Variation</th><th>Contrôle</th></tr></thead><tbody>' +
            parsed.slice(0, 400).map(p =>
                '<tr class="' + (p.errors.length ? 'row-flag' : '') + '">' +
                '<td class="td-muted">' + p.line + '</td>' +
                '<td class="td-key">' + TC.esc(p.row.ticker || '—') + '</td>' +
                '<td class="td-mono">' + (p.row.date_seance || '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(p.row.cours_cloture) + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(p.row.volume) + '</td>' +
                '<td class="r td-mono">' + TC.fmtPct(p.row.variation) + '</td>' +
                '<td>' + (p.errors.length
                    ? '<span class="badge badge-red">' + TC.esc(p.errors.join(' · ')) + '</span>'
                    : '<span class="badge badge-green">prête</span>') + '</td></tr>').join('') +
            '</tbody></table></div>';
    }

    async function importLot() {
        if (!lotRows.length) return;
        const known = await TC.tickerSet();
        const unknown = Array.from(new Set(lotRows.map(r => r.ticker).filter(t => !known.has(t) && !TC.isIndice(t))));
        if (unknown.length && !confirm('Tickers absents du référentiel : ' + unknown.join(', ') +
            '\n\nSupabase refusera ces lignes. Poursuivre malgré tout ?')) return;

        TC.el('lot-import').disabled = true;
        TC.say('lot-msg', 'Import en cours…', 'info');
        const result = await TC.postBatched('historique', lotRows, TC.CONFLICT.historique, function (p) {
            TC.say('lot-msg', p.done + ' / ' + p.total + ' ligne(s) écrites…', 'info');
        });
        TC.el('lot-import').disabled = false;
        if (result.failures.length) {
            TC.say('lot-msg', result.imported + ' ligne(s) importées, ' + result.failures.length +
                ' lot(s) en échec : ' + result.failures[0].error, 'err');
        } else {
            TC.say('lot-msg', result.imported + ' ligne(s) importées.', 'ok');
            TC.toast('Import terminé : ' + result.imported + ' cotations', 'ok');
        }
        TC.health.probe();
    }

    /* ── Calendrier des séances ──────────────────────────── */

    async function loadCalendar() {
        const host = TC.el('cal-body');
        host.innerHTML = '<div class="loading"><div class="spinner"></div>Lecture du calendrier…</div>';
        const rows = await TC.getAll('historique', 'select=date_seance,ticker&order=date_seance.desc');
        const map = {};
        (rows || []).forEach(r => {
            if (!r.date_seance) return;
            map[r.date_seance] = (map[r.date_seance] || 0) + 1;
        });
        state.sessions = Object.keys(map).sort().reverse().map(d => ({ date: d, n: map[d] }));

        const years = Array.from(new Set(state.sessions.map(s => s.date.slice(0, 4)))).sort().reverse();
        const select = TC.el('cal-year');
        const previous = select.value;
        select.innerHTML = years.map(y => '<option value="' + y + '">' + y + '</option>').join('');
        if (previous && years.indexOf(previous) !== -1) select.value = previous;
        paintCalendar();
    }

    function paintCalendar() {
        const year = TC.el('cal-year').value;
        const list = state.sessions.filter(s => s.date.slice(0, 4) === year);
        const host = TC.el('cal-body');
        if (!list.length) {
            host.innerHTML = '<div class="empty-state"><strong>Aucune séance</strong>Pas de cotation enregistrée pour cette année.</div>';
            return;
        }
        const counts = list.map(s => s.n);
        const median = counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)];

        host.innerHTML =
            '<div class="card-body tight"><div class="note"><strong>' + list.length + ' séance(s) en ' + year +
            '</strong> — médiane de ' + median + ' cotations par séance. Une séance nettement en dessous signale un import partiel ; un jour non ouvré signale une date mal renseignée.</div></div>' +
            '<div class="tw capped"><table><thead><tr><th>Date</th><th>Jour</th><th class="r">Cotations</th>' +
            '<th>Complétude</th><th></th></tr></thead><tbody>' +
            list.map(function (s) {
                const weekend = TC.isWeekend(s.date);
                const thin = s.n < median * 0.6;
                return '<tr class="' + (weekend ? 'row-flag' : thin ? 'row-warn' : '') + '">' +
                    '<td class="td-mono">' + s.date + '</td>' +
                    '<td class="td-muted">' + new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' }) + '</td>' +
                    '<td class="r td-mono">' + s.n + '</td>' +
                    '<td>' + (weekend ? '<span class="badge badge-red">jour non ouvré</span>'
                        : thin ? '<span class="badge badge-orange">séance partielle</span>'
                            : '<span class="badge badge-green">complète</span>') + '</td>' +
                    '<td class="r"><button class="btn btn-outline btn-sm" data-open="' + s.date + '">Ouvrir</button></td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    /* ── Montage ─────────────────────────────────────────── */

    function mount() {
        TC.delegate('panel-cours', '.subtab', 'click', function (btn) {
            TC.qsa('#panel-cours .subtab').forEach(b => b.classList.toggle('active', b === btn));
            TC.qsa('#panel-cours .subpane').forEach(p => p.classList.toggle('active', p.id === 'sub-' + btn.dataset.sub));
            if (btn.dataset.sub === 'calendrier' && !state.sessions.length) loadCalendar();
        });

        TC.on('c-load', 'click', () => loadSession(TC.val('c-session-date')));
        TC.on('c-prev', 'click', async function () {
            if (!state.session) return;
            const prev = await previousSessionDate(state.session);
            if (prev) loadSession(prev); else TC.toast('Aucune séance antérieure', 'info');
        });
        TC.on('c-next', 'click', async function () {
            if (!state.session) return;
            const rows = await TC.get('historique',
                'select=date_seance&date_seance=gt.' + state.session + '&order=date_seance.asc&limit=1');
            if (rows && rows[0]) loadSession(rows[0].date_seance); else TC.toast('Séance la plus récente déjà affichée', 'info');
        });
        TC.on('c-filter', 'input', function (e) {
            const q = e.target.value.toUpperCase().trim();
            paintSessionRows(q ? state.rows.filter(r =>
                String(r.ticker).toUpperCase().indexOf(q) !== -1 ||
                String(r.__name).toUpperCase().indexOf(q) !== -1) : state.rows);
        });
        TC.on('c-export', 'click', function () {
            if (!state.rows.length) { TC.toast('Aucune donnée à exporter', 'info'); return; }
            TC.download('seance-' + state.session + '.csv',
                TC.toCSV(state.rows, ['ticker', 'date_seance', 'cours_cloture', 'cours_ouverture',
                    'plus_haut', 'plus_bas', 'volume', 'variation', 'valeur_totale']), 'text/csv;charset=utf-8');
        });
        TC.on('c-check-all', 'change', e => sel.all(state.rows.map(r => r.id), e.target.checked));
        TC.on('c-bulk-del', 'click', bulkDelete);
        TC.on('c-bulk-reset', 'click', () => sel.reset());

        TC.delegate('c-tbody', '.rowcheck', 'change', node => sel.toggle(node.dataset.id, node.checked));
        TC.delegate('c-tbody', '[data-edit]', 'click', function (node) {
            const row = state.rows.find(r => String(r.id) === node.dataset.edit);
            if (row) editRow(row);
        });
        TC.delegate('c-tbody', '[data-del]', 'click', function (node) {
            const row = state.rows.find(r => String(r.id) === node.dataset.del);
            if (row) deleteRow(row);
        });

        TC.on('h-load', 'click', loadSerie);
        TC.on('h-ticker', 'keydown', e => { if (e.key === 'Enter') loadSerie(); });
        TC.on('h-recalc', 'click', recalcSerie);
        TC.on('h-purge', 'click', purgeSerie);
        TC.on('h-export', 'click', function () {
            if (!state.serie.length) { TC.toast('Aucune donnée à exporter', 'info'); return; }
            TC.download('historique-' + state.ticker + '.csv',
                TC.toCSV(state.serie, ['ticker', 'date_seance', 'cours_cloture', 'cours_ouverture',
                    'plus_haut', 'plus_bas', 'volume', 'variation', 'valeur_totale']), 'text/csv;charset=utf-8');
        });
        TC.delegate('h-tbody', '[data-hedit]', 'click', function (node) {
            const row = state.serie.find(r => String(r.id) === node.dataset.hedit);
            if (row) { row.__prev = row.__prev || null; editRow(row); }
        });
        TC.delegate('h-tbody', '[data-hdel]', 'click', async function (node) {
            const row = state.serie.find(r => String(r.id) === node.dataset.hdel);
            if (!row) return;
            if (!TC.confirmTwice('Supprimer la cotation du ' + TC.fmtDate(row.date_seance) + ' ?',
                'cette séance disparaîtra de la série')) return;
            try { await TC.del('historique', 'id=eq.' + row.id); TC.toast('Ligne supprimée', 'ok'); loadSerie(); }
            catch (e) { TC.toast(e.message, 'err'); }
        });

        TC.on('s-save', 'click', saveEntry);
        TC.on('s-auto', 'click', autoVariation);
        TC.on('s-clear', 'click', () => {
            TC.clear(['s-ticker', 's-date', 's-close', 's-open', 's-high', 's-low', 's-vol', 's-var', 's-value']);
            TC.say('s-msg', '');
        });
        const tickerInput = TC.el('s-ticker');
        if (tickerInput) tickerInput.setAttribute('list', 'tickers-list');
        TC.setVal('s-date', TC.today());

        TC.on('lot-check', 'click', parseLot);
        TC.on('lot-import', 'click', importLot);
        TC.on('lot-clear', 'click', () => {
            TC.setVal('lot-text', ''); TC.el('lot-preview').innerHTML = '';
            TC.say('lot-msg', ''); TC.el('lot-import').disabled = true; lotRows = [];
        });

        TC.on('cal-year', 'change', paintCalendar);
        TC.on('cal-reload', 'click', loadCalendar);
        TC.delegate('cal-body', '[data-open]', 'click', function (node) {
            TC.qsa('#panel-cours .subtab').forEach(b => b.classList.toggle('active', b.dataset.sub === 'seance'));
            TC.qsa('#panel-cours .subpane').forEach(p => p.classList.toggle('active', p.id === 'sub-seance'));
            loadSession(node.dataset.open);
        });

        loadSession(null);
    }

    TC.register({
        id: 'cours',
        label: 'Cours & historique',
        group: 'marche',
        icon: '▤',
        keywords: 'cotation seance bourse prix cloture variation archive',
        view, mount,
        refresh() { loadSession(state.session); }
    });

})(window.TC);
