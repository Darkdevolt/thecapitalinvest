/* ============================================================
   THE CAPITAL — ANALYSES ET RECOMMANDATIONS
   Une recommandation publiée engage la maison. Le potentiel est
   donc recalculé en continu sur le dernier cours connu : une note
   « Acheter » dont l'objectif est déjà dépassé doit se voir.
   ============================================================ */
'use strict';

(function (TC) {

    let rows = [];
    let editing = null;
    const sel = TC.selection('an');

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Analyses &amp; <em>recommandations</em></div>' +
            '<div class="page-sub">Notes de recherche publiées dans l\'application. Le potentiel est réévalué à chaque affichage sur le dernier cours de clôture : une recommandation dont l\'objectif est atteint ou dépassé est signalée pour révision.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="an-export">⬇ CSV</button></div></div>' +

            '<div class="kpis" id="an-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title" id="an-form-title">Publier une recommandation</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="an-cancel-edit" hidden>Annuler la modification</button></span></div>' +
            '<div class="form-grid">' + TC.fields([
                { id: 'a-ticker', label: 'Ticker', upper: true, placeholder: 'SNTS' },
                { id: 'a-titre', label: 'Titre de la note', placeholder: 'Sonatel — la croissance mobile money tient' },
                { id: 'a-reco', label: 'Recommandation', type: 'select', options: TC.RECOS.map(r => ({ v: r, l: r })) },
                { id: 'a-cible', label: 'Cours cible', type: 'number', col: 'cours_cible' },
                { id: 'a-ref', label: 'Cours de référence', type: 'number', col: 'cours_reference', hint: 'Vide : dernier cours de clôture connu.' },
                { id: 'a-analyste', label: 'Analyste', placeholder: 'The Capital Research' },
                { id: 'a-date', label: "Date de l'analyse", type: 'date' },
                { id: 'a-texte', label: 'Analyse', type: 'textarea', rows: 6, wide: true, col: 'commentaire', placeholder: 'Thèse d\'investissement, catalyseurs, risques identifiés, hypothèses de valorisation…' }
            ]) + '</div>' +
            '<div class="card-body tight"><div class="note" id="an-live">Renseignez le ticker et le cours cible : le potentiel se calcule sur le dernier cours connu.</div></div>' +
            '<div class="actions"><button class="btn btn-primary" id="an-save">Publier</button>' +
            '<button class="btn btn-outline btn-sm" id="an-price">↑ Charger le dernier cours</button>' +
            '<button class="btn btn-outline btn-sm" id="an-clear">Effacer</button>' +
            '<span class="msg" id="an-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Notes publiées</span>' +
            '<span class="card-tools">' +
            '<input type="search" id="an-search" placeholder="Ticker ou titre…" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;width:180px;">' +
            '<select id="an-filter-reco" style="padding:5px 9px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:5px;">' +
            '<option value="">Toutes recommandations</option>' + TC.RECOS.map(r => '<option>' + r + '</option>').join('') +
            '<option value="__revoir">À réviser</option></select>' +
            '<span class="card-count" id="an-count"></span>' +
            '<button class="btn btn-outline btn-sm" id="an-reload">↺</button></span></div>' +
            '<div class="bulkbar" id="bulk-an"><span class="bulk-count">0 note(s)</span>' +
            '<button class="btn btn-danger btn-sm" id="an-bulk-del">Supprimer</button>' +
            '<button class="btn btn-outline btn-sm" id="an-bulk-reset">Désélectionner</button></div>' +
            '<div class="tw capped" id="bulk-an-scope"><table><thead><tr>' +
            '<th><input type="checkbox" class="rowcheck" id="an-all"></th>' +
            '<th>Ticker</th><th>Titre</th><th>Recommandation</th><th class="r">Cible</th>' +
            '<th class="r">Cours actuel</th><th class="r">Potentiel</th><th>Analyste</th><th>Date</th>' +
            '<th>Suivi</th><th></th>' +
            '</tr></thead><tbody id="an-tbody">' + TC.rowsLoading(11) + '</tbody></table></div></div>';
    }

    let lastPrices = null;

    async function prices() {
        if (lastPrices) return lastPrices;
        const latest = await TC.get('historique', 'select=date_seance&order=date_seance.desc&limit=1');
        const date = latest && latest[0] && latest[0].date_seance;
        lastPrices = { date, map: {} };
        if (!date) return lastPrices;
        const data = await TC.getAll('historique', 'select=ticker,cours_cloture,cloture&date_seance=eq.' + date);
        (data || []).forEach(r => {
            lastPrices.map[String(r.ticker).toUpperCase()] =
                TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        });
        return lastPrices;
    }

    /** Une note est à réviser si l'objectif est atteint, ou si elle a vieilli. */
    function reviewFlag(r) {
        const cible = TC.toNumber(r.cours_cible);
        const age = r.date_analyse ? Math.round((Date.now() - Date.parse(String(r.date_analyse).slice(0, 10) + 'T12:00:00')) / 86400000) : null;
        const reasons = [];
        if (cible !== null && r.__price) {
            const sens = ['Acheter', 'Renforcer'].indexOf(r.recommandation) !== -1 ? 1 : -1;
            if (sens === 1 && r.__price >= cible) reasons.push('objectif atteint');
            if (sens === -1 && r.__price <= cible) reasons.push('objectif atteint à la baisse');
        }
        if (age !== null && age > 365) reasons.push('note de plus d\'un an');
        else if (age !== null && age > 180) reasons.push('note de plus de six mois');
        if (!r.commentaire && !r.resume) reasons.push('sans corps d\'analyse');
        return reasons;
    }

    async function load() {
        TC.el('an-tbody').innerHTML = TC.rowsLoading(11);
        lastPrices = null;
        const [data, quotes] = await Promise.all([
            TC.getAll('analyses', 'select=*&order=date_analyse.desc'),
            prices()
        ]);
        rows = (data || []).map(function (r) {
            r.__price = quotes.map[String(r.ticker).toUpperCase()] || null;
            const cible = TC.toNumber(r.cours_cible);
            r.__potential = (cible !== null && r.__price && r.__price > 0)
                ? ((cible - r.__price) / r.__price) * 100 : null;
            r.__review = reviewFlag(r);
            return r;
        });
        paintKpis(quotes.date);
        paint(rows);
    }

    function paintKpis(priceDate) {
        const byReco = {};
        TC.RECOS.forEach(x => { byReco[x] = rows.filter(r => r.recommandation === x).length; });
        const toReview = rows.filter(r => r.__review.length).length;
        const potentials = rows.map(r => r.__potential).filter(p => p !== null);
        const avg = potentials.length ? potentials.reduce((a, b) => a + b, 0) / potentials.length : null;

        TC.el('an-kpis').innerHTML =
            box('Notes publiées', rows.length) +
            box('Acheter / Renforcer', byReco['Acheter'] + byReco['Renforcer'], 'green') +
            box('Alléger / Vendre', byReco['Alléger'] + byReco['Vendre'], 'red') +
            box('Potentiel moyen', avg !== null ? (avg >= 0 ? '+' : '') + avg.toFixed(1) + ' %' : '—') +
            box('À réviser', toReview, toReview ? 'orange' : 'green') +
            '<div class="kpi"><div class="kpi-label">Cours de référence</div><div class="kpi-value sm">' +
            (priceDate ? TC.fmtDate(priceDate) : '—') + '</div></div>';
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function recoBadge(reco) {
        const tone = reco === 'Acheter' || reco === 'Renforcer' ? 'badge-green'
            : reco === 'Vendre' || reco === 'Alléger' ? 'badge-red' : 'badge-gold';
        return '<span class="badge ' + tone + '">' + TC.esc(reco || '—') + '</span>';
    }

    function paint(list) {
        const tbody = TC.el('an-tbody');
        TC.el('an-count').textContent = list.length + ' note(s)';
        if (!list.length) {
            tbody.innerHTML = TC.rowsEmpty(11, 'Aucune note publiée',
                'Les recommandations alimentent la section Analyses de l\'application.');
            return;
        }
        sel.reset();
        tbody.innerHTML = list.map(function (r) {
            return '<tr class="' + (r.__review.length ? 'row-warn' : '') + '">' +
                '<td><input type="checkbox" class="rowcheck" data-id="' + r.id + '"></td>' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;">' + TC.esc(r.titre || 'Sans titre') + '</td>' +
                '<td>' + recoBadge(r.recommandation) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.cours_cible) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.__price) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.__potential) + '">' + TC.fmtPct(r.__potential) + '</td>' +
                '<td class="td-muted">' + TC.esc(r.analyste || '—') + '</td>' +
                '<td class="td-muted td-mono">' + TC.fmtDate(r.date_analyse) + '</td>' +
                '<td>' + (r.__review.length
                    ? '<span class="badge badge-orange" title="' + TC.esc(r.__review.join(' · ')) + '">' + TC.esc(r.__review[0]) + '</span>'
                    : '<span class="badge badge-green">à jour</span>') + '</td>' +
                '<td class="r" style="white-space:nowrap;">' +
                '<button class="btn btn-outline btn-ico" data-read="' + r.id + '">◱</button> ' +
                '<button class="btn btn-outline btn-ico" data-edit="' + r.id + '">✎</button> ' +
                '<button class="btn btn-danger btn-ico" data-del="' + r.id + '">✕</button></td></tr>';
        }).join('');
    }

    function filter() {
        const q = TC.val('an-search').toLowerCase();
        const reco = TC.val('an-filter-reco');
        paint(rows.filter(function (r) {
            const haystack = (r.ticker + ' ' + (r.titre || '') + ' ' + (r.analyste || '')).toLowerCase();
            if (q && haystack.indexOf(q) === -1) return false;
            if (reco === '__revoir') return r.__review.length > 0;
            if (reco && r.recommandation !== reco) return false;
            return true;
        }));
    }

    async function paintLive() {
        const ticker = TC.val('a-ticker').toUpperCase();
        const cible = TC.num('a-cible');
        let ref = TC.num('a-ref');
        const node = TC.el('an-live');
        if (!ticker) {
            node.className = 'note';
            node.innerHTML = 'Renseignez le ticker et le cours cible : le potentiel se calcule sur le dernier cours connu.';
            return;
        }
        const quotes = await prices();
        const price = quotes.map[ticker];
        if (ref === null) ref = price;
        if (!ref || cible === null) {
            node.className = 'note' + (price ? '' : ' warn');
            node.innerHTML = price
                ? '<strong>Dernier cours ' + TC.fmt(price) + ' F</strong> au ' + TC.fmtDate(quotes.date) + '. Indiquez un cours cible pour obtenir le potentiel.'
                : '<strong>Aucun cours enregistré pour ' + TC.esc(ticker) + '.</strong> Le potentiel ne pourra pas être calculé.';
            return;
        }
        const potential = ((cible - ref) / ref) * 100;
        const reco = TC.val('a-reco');
        const incoherent = (potential > 5 && (reco === 'Vendre' || reco === 'Alléger')) ||
            (potential < -5 && (reco === 'Acheter' || reco === 'Renforcer'));
        node.className = 'note' + (incoherent ? ' err' : '');
        node.innerHTML = '<strong>Potentiel : ' + (potential >= 0 ? '+' : '') + potential.toFixed(1) + ' %</strong> — ' +
            'cible ' + TC.fmt(cible) + ' F sur une référence de ' + TC.fmt(ref) + ' F' +
            (price ? ' (dernier cours au ' + TC.fmtDate(quotes.date) + ')' : '') +
            (incoherent ? '<br><strong>Incohérence</strong> — le sens de la recommandation contredit le potentiel calculé.' : '');
    }

    async function loadPrice() {
        const ticker = TC.val('a-ticker').toUpperCase();
        if (!ticker) { TC.say('an-msg', 'Indiquez un ticker.', 'err'); return; }
        const quotes = await prices();
        const price = quotes.map[ticker];
        if (!price) { TC.say('an-msg', 'Aucun cours enregistré pour ' + ticker + '.', 'warn'); return; }
        TC.setVal('a-ref', price);
        TC.say('an-msg', 'Cours du ' + TC.fmtDate(quotes.date) + ' chargé : ' + TC.fmt(price) + ' F', 'ok');
        paintLive();
    }

    async function save() {
        const ticker = TC.val('a-ticker').toUpperCase();
        const reco = TC.val('a-reco');
        if (!ticker || !reco) { TC.say('an-msg', 'Le ticker et la recommandation sont obligatoires.', 'err'); return; }
        const known = await TC.tickerSet();
        if (!known.has(ticker)) { TC.say('an-msg', 'Le ticker ' + ticker + ' n\'existe pas dans le référentiel.', 'err'); return; }

        const texte = TC.val('a-texte');
        if (!texte && !confirm('Cette note n\'a pas de corps d\'analyse. Elle apparaîtra dans l\'application sans justification.\n\nPublier quand même ?')) return;

        const body = {
            ticker,
            titre: TC.val('a-titre') || null,
            recommandation: reco,
            commentaire: texte || null,
            resume: texte ? texte.slice(0, 400) : null,
            date_analyse: TC.val('a-date') || TC.today(),
            analyste: TC.val('a-analyste') || 'The Capital Research',
            cours_cible: TC.num('a-cible'),
            cours_reference: TC.num('a-ref')
        };

        try {
            if (editing) {
                await TC.patch('analyses', 'id=eq.' + editing, body);
                TC.say('an-msg', 'Note modifiée.', 'ok');
                resetForm();
            } else {
                await TC.post('analyses', body, null);
                TC.say('an-msg', 'Note publiée pour ' + ticker + '.', 'ok');
                TC.clear(['a-titre', 'a-cible', 'a-ref', 'a-texte']);
            }
            load();
        } catch (e) { TC.say('an-msg', e.message, 'err'); }
    }

    function edit(row) {
        editing = row.id;
        TC.setVal('a-ticker', row.ticker);
        TC.setVal('a-titre', row.titre);
        TC.setVal('a-reco', row.recommandation);
        TC.setVal('a-cible', row.cours_cible);
        TC.setVal('a-ref', row.cours_reference);
        TC.setVal('a-analyste', row.analyste);
        TC.setVal('a-date', TC.toISODate(row.date_analyse) || '');
        TC.setVal('a-texte', row.commentaire || row.resume || '');
        TC.el('an-form-title').textContent = 'Modifier la note ' + row.ticker;
        TC.el('an-save').textContent = 'Enregistrer la modification';
        TC.el('an-cancel-edit').hidden = false;
        paintLive();
        TC.el('panel-analyses').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetForm() {
        editing = null;
        TC.clear(['a-ticker', 'a-titre', 'a-cible', 'a-ref', 'a-analyste', 'a-texte']);
        TC.setVal('a-date', TC.today());
        TC.el('an-form-title').textContent = 'Publier une recommandation';
        TC.el('an-save').textContent = 'Publier';
        TC.el('an-cancel-edit').hidden = true;
        TC.say('an-msg', '');
        paintLive();
    }

    function read(row) {
        TC.modal.open({
            title: row.titre || (row.ticker + ' — ' + row.recommandation),
            subtitle: row.ticker + ' · ' + (row.analyste || 'analyste non précisé') + ' · ' + TC.fmtDateLong(row.date_analyse),
            readonly: true,
            body: '<div class="card-body">' +
                '<div class="note" style="margin-bottom:14px;">' + recoBadge(row.recommandation) +
                ' &nbsp; Cible <b>' + TC.fmt(row.cours_cible) + ' F</b>' +
                (row.__price ? ' · cours actuel <b>' + TC.fmt(row.__price) + ' F</b> · potentiel <b>' + TC.fmtPct(row.__potential) + '</b>' : '') +
                (row.__review.length ? '<br>À réviser : ' + TC.esc(row.__review.join(' · ')) : '') + '</div>' +
                '<div style="font-size:13.5px;line-height:1.75;white-space:pre-wrap;">' +
                TC.esc(row.commentaire || row.resume || 'Aucun corps d\'analyse enregistré pour cette note.') + '</div></div>'
        });
    }

    TC.register({
        id: 'analyses',
        label: 'Analyses',
        group: 'societes',
        icon: '✦',
        keywords: 'analyse recommandation recherche cible potentiel',
        view,
        refresh: load,
        mount() {
            const tickerInput = TC.el('a-ticker');
            if (tickerInput) tickerInput.setAttribute('list', 'tickers-list');
            TC.setVal('a-date', TC.today());
            TC.on('an-save', 'click', save);
            TC.on('an-clear', 'click', resetForm);
            TC.on('an-cancel-edit', 'click', resetForm);
            TC.on('an-price', 'click', loadPrice);
            TC.on('an-reload', 'click', load);
            TC.on('an-search', 'input', filter);
            TC.on('an-filter-reco', 'change', filter);
            ['a-ticker', 'a-cible', 'a-ref', 'a-reco'].forEach(id => TC.on(id, 'input', paintLive));
            TC.on('a-reco', 'change', paintLive);
            TC.on('an-export', 'click', function () {
                if (!rows.length) return;
                TC.download('analyses-' + TC.today() + '.csv',
                    TC.toCSV(rows, ['ticker', 'titre', 'recommandation', 'cours_cible', 'cours_reference', 'analyste', 'date_analyse']),
                    'text/csv;charset=utf-8');
            });
            TC.on('an-all', 'change', e => sel.all(rows.map(r => r.id), e.target.checked));
            TC.on('an-bulk-reset', 'click', () => sel.reset());
            TC.on('an-bulk-del', 'click', async function () {
                const ids = sel.ids();
                if (!ids.length) return;
                if (!TC.confirmTwice('Retirer ' + ids.length + ' note(s) de la publication ?')) return;
                let done = 0;
                for (const id of ids) { try { await TC.del('analyses', 'id=eq.' + id); done++; } catch (e) { /* bilan */ } }
                TC.toast(done + ' note(s) supprimées', 'ok');
                load();
            });
            TC.delegate('an-tbody', '.rowcheck', 'change', n => sel.toggle(n.dataset.id, n.checked));
            TC.delegate('an-tbody', '[data-read]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.read); if (row) read(row);
            });
            TC.delegate('an-tbody', '[data-edit]', 'click', n => {
                const row = rows.find(r => String(r.id) === n.dataset.edit); if (row) edit(row);
            });
            TC.delegate('an-tbody', '[data-del]', 'click', async function (n) {
                const row = rows.find(r => String(r.id) === n.dataset.del);
                if (!row || !TC.confirmTwice('Retirer la note « ' + (row.titre || row.ticker) + ' » ?')) return;
                try { await TC.del('analyses', 'id=eq.' + row.id); TC.toast('Note retirée', 'ok'); load(); }
                catch (e) { TC.toast(e.message, 'err'); }
            });
            load();
        }
    });

})(window.TC);
