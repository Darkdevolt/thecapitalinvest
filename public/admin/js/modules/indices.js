/* ============================================================
   THE CAPITAL — INDICES BRVM
   Table indices (indice, date_seance, valeur, variation, variation_pct).
   L'ancienne version confondait `variation` (points) et
   `variation_pct` (pourcentage) : les deux colonnes recevaient la
   même valeur, et l'application affichait un pourcentage comme un
   écart en points. Les deux sont désormais distinguées et le
   pourcentage est recalculé depuis la séance précédente.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    const sel = TC.selection('idx');

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Indices <em>de marché</em></div>' +
            '<div class="page-sub">Valeurs des indices BRVM séance par séance. La variation en points et la variation en pourcentage sont deux grandeurs différentes : la seconde est recalculée depuis la séance précédente lorsque la source ne la fournit pas.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="idx-recalc">↻ Recalculer les pourcentages</button>' +
            '<button class="btn btn-outline btn-sm" id="idx-export">⬇ CSV</button></div></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Enregistrer une valeur d\'indice</span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'idx-code', label: 'Indice', type: 'select', options: TC.INDICES.map(i => ({ v: i, l: i })) },
                { id: 'idx-date', label: 'Date de séance', type: 'date' },
                { id: 'idx-value', label: 'Valeur', type: 'number', placeholder: '185,42' },
                { id: 'idx-var', label: 'Variation (points)', type: 'number', col: 'variation' },
                { id: 'idx-pct', label: 'Variation %', type: 'number', col: 'variation_pct', hint: 'Vide : calculée depuis la séance précédente.' }
            ]) + '</div>' +
            '<div class="actions"><button class="btn btn-primary" id="idx-save">Enregistrer</button>' +
            '<button class="btn btn-outline btn-sm" id="idx-auto">↻ Calculer depuis la séance précédente</button>' +
            '<button class="btn btn-outline btn-sm" id="idx-clear">Effacer</button>' +
            '<span class="msg" id="idx-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Valeurs enregistrées</span>' +
            '<span class="card-tools">' +
            '<select id="idx-filter" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Tous les indices</option>' + TC.INDICES.map(i => '<option>' + TC.esc(i) + '</option>').join('') + '</select>' +
            '<input type="date" id="idx-date-filter" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<span class="card-count" id="idx-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="idx-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-idx"><span class="bulk-count">0 ligne(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="idx-bulk-del">Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" id="idx-bulk-reset">Tout désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-idx-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="idx-all"></th>' +
            '<th>Indice</th><th>Date</th><th class="r">Valeur</th><th class="r">Variation (pts)</th>' +
            '<th class="r">Variation %</th><th class="r">% recalculé</th><th>Contrôle</th><th></th>' +
            '</tr></thead><tbody id="idx-tbody">' + TC.rowsLoading(9) + '</tbody></table></div></div>';
    }

    async function load() {
        TC.el('idx-tbody').innerHTML = TC.rowsLoading(9);
        const data = await TC.getAll('indices', 'select=*&order=date_seance.desc,indice.asc');
        rows = data || [];

        /* Série par indice, ordre croissant, pour recalculer les pourcentages. */
        const series = {};
        rows.forEach(r => {
            const key = String(r.indice || '').toUpperCase();
            (series[key] = series[key] || []).push(r);
        });
        Object.keys(series).forEach(function (key) {
            const asc = series[key].sort((a, b) => String(a.date_seance).localeCompare(String(b.date_seance)));
            asc.forEach(function (r, i) {
                const prev = i > 0 ? TC.toNumber(asc[i - 1].valeur) : null;
                const cur = TC.toNumber(r.valeur);
                r.__prev = prev;
                r.__pts = (prev !== null && cur !== null) ? cur - prev : null;
                r.__pct = (prev && prev !== 0 && cur !== null) ? ((cur - prev) / prev) * 100 : null;
            });
        });

        paint(rows);
    }

    function audit(r) {
        const issues = [];
        const value = TC.toNumber(r.valeur);
        if (value === null) issues.push('valeur absente');
        else if (value <= 0) issues.push('valeur nulle ou négative');
        if (r.date_seance > TC.today()) issues.push('séance future');
        const pct = TC.toNumber(r.variation_pct);
        if (r.__pct !== null && pct !== null && Math.abs(pct - r.__pct) > 0.15) {
            issues.push('% publié ≠ recalculé');
        }
        /* Symptôme du bug historique : les deux colonnes portent la même valeur. */
        const pts = TC.toNumber(r.variation);
        if (pts !== null && pct !== null && pts === pct && r.__pts !== null && Math.abs(r.__pts - pts) > 0.5) {
            issues.push('variation en points recopiée du pourcentage');
        }
        return issues;
    }

    function paint(list) {
        const tbody = TC.el('idx-tbody');
        TC.el('idx-count').textContent = list.length + ' ligne(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(9, 'Aucun indice enregistré',
                'Le scraper BRVM alimente cette table automatiquement, ou saisissez une valeur ci-dessus.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            const issues = audit(r);
            return '<tr class="' + (issues.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key" style="font-size:12px;">' + TC.esc(r.indice) + '</td>' +
                '<td class="td-mono td-muted">' + TC.fmtDate(r.date_seance) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.valeur) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.variation) + '">' + TC.fmt(r.variation) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.variation_pct) + '">' + TC.fmtPct(r.variation_pct) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmtPct(r.__pct) + '</td>' +
                '<td>' + (issues.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(issues.join(' · ')) + '">' + TC.esc(issues[0]) + '</span>'
                    : '<span class="badge badge-green">conforme</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const code = TC.val('idx-filter'), date = TC.val('idx-date-filter');
        paint(rows.filter(r =>
            (!code || r.indice === code) && (!date || r.date_seance === date)));
    }

    async function previousValue(code, date) {
        const data = await TC.get('indices', 'select=valeur&indice=eq.' + encodeURIComponent(code) +
            '&date_seance=lt.' + date + '&order=date_seance.desc&limit=1');
        return data && data[0] ? TC.toNumber(data[0].valeur) : null;
    }

    async function autoCompute() {
        const code = TC.val('idx-code'), date = TC.val('idx-date'), value = TC.num('idx-value');
        if (!code || !date || value === null) { TC.say('idx-msg', 'Indice, date et valeur sont nécessaires.', 'err'); return; }
        const prev = await previousValue(code, date);
        if (prev === null) { TC.say('idx-msg', 'Aucune valeur antérieure pour cet indice.', 'warn'); return; }
        TC.setVal('idx-var', (value - prev).toFixed(2));
        TC.setVal('idx-pct', (((value - prev) / prev) * 100).toFixed(2));
        TC.say('idx-msg', 'Séance précédente : ' + TC.fmt(prev), 'ok');
    }

    async function save() {
        const code = TC.val('idx-code');
        const date = TC.toISODate(TC.val('idx-date'));
        const value = TC.num('idx-value');
        if (!code || !date || value === null) { TC.say('idx-msg', 'Indice, date et valeur sont obligatoires.', 'err'); return; }
        if (value <= 0) { TC.say('idx-msg', 'La valeur d\'un indice est strictement positive.', 'err'); return; }
        if (date > TC.today()) { TC.say('idx-msg', 'Une séance ne peut pas être datée dans le futur.', 'err'); return; }

        let pts = TC.num('idx-var'), pct = TC.num('idx-pct');
        if (pts === null || pct === null) {
            const prev = await previousValue(code, date);
            if (prev !== null && prev !== 0) {
                if (pts === null) pts = Math.round((value - prev) * 100) / 100;
                if (pct === null) pct = Math.round(((value - prev) / prev) * 10000) / 100;
            }
        }

        try {
            await TC.post('indices', { indice: code, date_seance: date, valeur: value, variation: pts, variation_pct: pct });
            TC.say('idx-msg', code + ' enregistré pour le ' + TC.fmtDate(date) + '.', 'ok');
            TC.clear(['idx-value', 'idx-var', 'idx-pct']);
            load();
        } catch (e) { TC.say('idx-msg', e.message, 'err'); }
    }

    function edit(row) {
        TC.modal.open({
            title: row.indice,
            subtitle: TC.fmtDateLong(row.date_seance) + (row.__prev !== null ? ' · séance précédente ' + TC.fmt(row.__prev) : ''),
            body: '<div class="form-grid">' + TC.fields([
                { id: 'mi-value', label: 'Valeur', type: 'number' },
                { id: 'mi-var', label: 'Variation (points)', type: 'number' },
                { id: 'mi-pct', label: 'Variation %', type: 'number', wide: true }
            ]) + '</div>',
            afterOpen() {
                TC.setVal('mi-value', row.valeur);
                TC.setVal('mi-var', row.variation);
                TC.setVal('mi-pct', row.variation_pct);
                TC.on('mi-value', 'input', function () {
                    const v = TC.num('mi-value');
                    if (row.__prev && v !== null) {
                        TC.setVal('mi-var', (v - row.__prev).toFixed(2));
                        TC.setVal('mi-pct', (((v - row.__prev) / row.__prev) * 100).toFixed(2));
                    }
                });
            },
            async onSave() {
                try {
                    await TC.patch('indices', 'id=eq.' + row.id, {
                        valeur: TC.num('mi-value'), variation: TC.num('mi-var'), variation_pct: TC.num('mi-pct')
                    });
                    TC.modal.close(); TC.toast('Indice mis à jour', 'ok'); load();
                } catch (e) { TC.modal.msg(e.message, 'err'); }
            }
        });
    }

    /** Réaligne variation_pct sur les valeurs réellement enregistrées. */
    async function recalcAll() {
        const drift = rows.filter(r => {
            const pct = TC.toNumber(r.variation_pct);
            return r.__pct !== null && (pct === null || Math.abs(pct - r.__pct) > 0.01);
        });
        if (!drift.length) { TC.toast('Tous les pourcentages sont déjà exacts', 'ok'); return; }
        if (!confirm('Recalculer ' + drift.length + ' pourcentage(s) de variation depuis les valeurs enregistrées ?')) return;
        let done = 0;
        for (const r of drift) {
            try {
                await TC.patch('indices', 'id=eq.' + r.id, {
                    variation_pct: Math.round(r.__pct * 100) / 100,
                    variation: r.__pts !== null ? Math.round(r.__pts * 100) / 100 : r.variation
                });
                done++;
            } catch (e) { /* comptabilisé dans le bilan */ }
        }
        TC.toast(done + ' / ' + drift.length + ' indice(s) recalculé(s)', done === drift.length ? 'ok' : 'err');
        load();
    }

    TC.register({
        id: 'indices',
        label: 'Indices',
        group: 'marche',
        icon: '◪',
        keywords: 'brvm composite prestige 30 10 indice',
        view,
        refresh: load,
        mount() {
            TC.setVal('idx-date', TC.today());
            TC.on('idx-save', 'click', save);
            TC.on('idx-auto', 'click', autoCompute);
            TC.on('idx-clear', 'click', () => { TC.clear(['idx-value', 'idx-var', 'idx-pct']); TC.say('idx-msg', ''); });
            TC.on('idx-reload', 'click', load);
            TC.on('idx-recalc', 'click', recalcAll);
            TC.on('idx-filter', 'change', filter);
            TC.on('idx-date-filter', 'input', filter);
            TC.on('idx-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('idx-bulk-reset', 'click', () => sel.reset());
            TC.on('idx-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Supprimer ' + ids.length + ' valeur(s) d\'indice ?', 'les graphiques de marché perdront ces points')) return;
                let done = 0;
                for (const id of ids) { try { await TC.del('indices', 'id=eq.' + id); done++; } catch (e) { /* bilan */ } }
                TC.toast(done + ' ligne(s) supprimée(s)', 'ok');
                load();
            });
            TC.on('idx-export', 'click', function () {
                if (!rows.length) return;
                TC.download('indices-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['indice', 'date_seance', 'valeur', 'variation', 'variation_pct']), 'text/csv;charset=utf-8');
            });
            TC.delegate('idx-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('idx-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('idx-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Supprimer ' + row.indice + ' du ' + TC.fmtDate(row.date_seance) + ' ?')) return;
                try { await TC.del('indices', 'id=eq.' + row.id); TC.toast('Supprimé', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
