/* ============================================================
   THE CAPITAL — JOURS FÉRIÉS BRVM
   Table jours_feries (date, libelle). Un jour férié ne compte pas
   comme une séance manquante dans le calendrier « Séances & import
   Excel » et ferme le marché dans l'application (horaires, délais de
   règlement du simulateur obligataire). Le module repère aussi les
   jours ouvrés passés sans aucune séance en base : soit un férié à
   déclarer, soit une séance à importer.
   ============================================================ */
'use strict';

(function (TC) {

    /* Cache partagé avec le calendrier des séances. */
    let cache = null;
    TC.joursFeries = {
        async load(force) {
            if (cache && !force) return cache;
            const rows = await TC.getAll('jours_feries', 'select=date,libelle&order=date.asc');
            cache = new Map((rows || []).map(r => [r.date, r.libelle]));
            return cache;
        },
        forget() { cache = null; },
        async add(date, libelle) {
            await TC.post('jours_feries', { date, libelle: libelle || 'Jour férié' }, 'date');
            cache = null;
        },
        async remove(date) {
            await TC.del('jours_feries', 'date=eq.' + date);
            cache = null;
        }
    };

    let year = new Date().getFullYear();
    let holidays = new Map();
    let sessions = new Set();

    const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const weekday = iso => WD[new Date(iso + 'T12:00:00').getDay()];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Jours <em>fériés</em></div>' +
            '<div class="page-sub">Jours sans séance à la BRVM. Ils ne sont plus signalés en rouge dans le calendrier des séances et ferment le marché dans l\'application (horaires, date de valeur du simulateur obligataire).</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="jf-prev">←</button>' +
            '<select id="jf-year"></select>' +
            '<button class="btn btn-outline btn-sm" id="jf-next">→</button>' +
            '<button class="btn btn-outline btn-sm" id="jf-reload">↺</button></div></div>' +

            '<div class="kpis" id="jf-kpis"></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Ajouter un jour férié</span></div>' +
            '<div class="form-grid">' +
            '<div class="field"><label for="jf-date">Date</label><input type="date" id="jf-date"></div>' +
            '<div class="field wide"><label for="jf-libelle">Libellé</label><input type="text" id="jf-libelle" placeholder="Fête de la Tabaski"></div>' +
            '</div><div class="actions"><button class="btn btn-primary" id="jf-add">Ajouter</button>' +
            '<span class="msg" id="jf-add-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title" id="jf-title">Jours fériés</span>' +
            '<span class="card-tools"><span class="card-count" id="jf-count"></span></span></div>' +
            '<div class="tw capped"><table><thead><tr><th>Date</th><th>Jour</th><th>Libellé</th><th></th></tr></thead>' +
            '<tbody id="jf-tbody">' + TC.rowsLoading(4) + '</tbody></table></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Jours ouvrés passés sans séance en base</span>' +
            '<span class="card-tools"><span class="card-count" id="jf-gap-count"></span></span></div>' +
            '<div class="card-body"><div class="hint">Chaque date ci-dessous apparaît en rouge dans le calendrier des séances. Si la bourse était fermée, marquez-la fériée ; sinon importez la séance manquante (module « Séances &amp; import Excel »).</div></div>' +
            '<div class="tw capped"><table><thead><tr><th>Date</th><th>Jour</th><th>Libellé si férié</th><th></th></tr></thead>' +
            '<tbody id="jf-gaps">' + TC.rowsLoading(4) + '</tbody></table></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Saisie en lot</span></div>' +
            '<div class="card-body"><div class="hint" style="margin-bottom:10px;">Une ligne par jour : <strong>AAAA-MM-JJ</strong> (ou JJ/MM/AAAA) suivi du libellé. Exemple : <code>2027-01-01 Jour de l\'an</code>. Les dates déjà présentes sont mises à jour.</div>' +
            '<textarea id="jf-bulk" rows="5" placeholder="2027-01-01 Jour de l\'an&#10;2027-03-29 Lundi de Pâques"></textarea></div>' +
            '<div class="actions"><button class="btn btn-primary" id="jf-bulk-save">Enregistrer la liste</button>' +
            '<span class="msg" id="jf-bulk-msg"></span></div></div>';
    }

    function box(label, value, tone) {
        return '<div class="kpi"><div class="kpi-label">' + TC.esc(label) + '</div><div class="kpi-value sm"' +
            (tone ? ' style="color:var(--' + tone + ')"' : '') + '>' + TC.esc(String(value)) + '</div></div>';
    }

    function isoDays(y) {
        const out = [];
        for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) out.push(TC.toISODate(d));
        return out;
    }

    async function load(force) {
        TC.el('jf-tbody').innerHTML = TC.rowsLoading(4);
        TC.el('jf-gaps').innerHTML = TC.rowsLoading(4);
        const [map, dates] = await Promise.all([
            TC.joursFeries.load(force),
            TC.rpc('seances_dates', { debut: year + '-01-01', fin: (year + 1) + '-01-01' }).catch(() => [])
        ]);
        holidays = map;
        sessions = new Set((dates || []).map(r => r.date_seance));
        paint();
    }

    function paintYears() {
        const sel = TC.el('jf-year');
        const now = new Date().getFullYear();
        const years = [];
        for (let y = now + 1; y >= 2015; y--) years.push(y);
        if (years.indexOf(year) === -1) years.push(year);
        sel.innerHTML = years.map(y => '<option' + (y === year ? ' selected' : '') + '>' + y + '</option>').join('');
    }

    function paint() {
        paintYears();
        const today = TC.today();
        const list = Array.from(holidays.entries()).filter(([d]) => d.slice(0, 4) === String(year));
        const openDays = isoDays(year).filter(d => !TC.isWeekend(d) && !holidays.has(d));
        const gaps = openDays.filter(d => d < today && !sessions.has(d));
        const conflicts = list.filter(([d]) => sessions.has(d));

        TC.el('jf-kpis').innerHTML =
            box('Jours fériés ' + year, list.length) +
            box('Jours ouvrés attendus', openDays.length) +
            box('Séances en base', sessions.size) +
            box('Jours ouvrés sans séance', gaps.length, gaps.length ? 'red' : 'green');

        TC.el('jf-title').textContent = 'Jours fériés ' + year;
        TC.el('jf-count').textContent = list.length + ' jour(s)';
        TC.el('jf-tbody').innerHTML = list.length ? list.map(([d, l]) =>
            '<tr><td class="mono">' + TC.fmtDate(d) + '</td><td>' + weekday(d) +
            (TC.isWeekend(d) ? ' <span class="hint">(week-end)</span>' : '') +
            (sessions.has(d) ? ' <span class="hint" style="color:var(--orange)">· une séance existe ce jour-là</span>' : '') + '</td>' +
            '<td><input type="text" class="jf-lib" data-date="' + d + '" value="' + TC.esc(l) + '"></td>' +
            '<td class="r"><button class="btn btn-outline btn-sm jf-del" data-date="' + d + '">Retirer</button></td></tr>'
        ).join('') : TC.rowsEmpty(4, 'Aucun jour férié saisi pour ' + year + '.');

        TC.el('jf-gap-count').textContent = gaps.length ? gaps.length + ' date(s)' : 'aucune';
        TC.el('jf-gaps').innerHTML = gaps.length ? gaps.map(d =>
            '<tr><td class="mono">' + TC.fmtDate(d) + '</td><td>' + weekday(d) + '</td>' +
            '<td><input type="text" class="jf-gap-lib" data-date="' + d + '" placeholder="Jour férié"></td>' +
            '<td class="r"><button class="btn btn-outline btn-sm jf-mark" data-date="' + d + '">Marquer férié</button></td></tr>'
        ).join('') : TC.rowsEmpty(4, 'Toutes les séances attendues sont en base.');

        if (conflicts.length) TC.toast(conflicts.length + ' jour(s) férié(s) ont pourtant une séance en base : vérifiez la date.', 'warn', 6000);
    }

    function parseBulk(text) {
        const out = [], bad = [];
        String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
            const m = line.match(/^(\S+)\s*[;,\t-]?\s*(.*)$/);
            const d = m && TC.toISODate(m[1]);
            if (!d) { bad.push(line); return; }
            out.push({ date: d, libelle: (m[2] || '').trim() || 'Jour férié' });
        });
        return { out, bad };
    }

    function mount() {
        TC.el('jf-year').onchange = e => { year = +e.target.value; load(); };
        TC.el('jf-prev').onclick = () => { year--; load(); };
        TC.el('jf-next').onclick = () => { year++; load(); };
        TC.el('jf-reload').onclick = () => load(true);

        TC.el('jf-add').onclick = async () => {
            const d = TC.el('jf-date').value, l = TC.el('jf-libelle').value.trim();
            if (!d) { TC.say('jf-add-msg', 'Choisissez une date.', 'err'); return; }
            try {
                await TC.joursFeries.add(d, l);
                TC.el('jf-date').value = ''; TC.el('jf-libelle').value = '';
                year = +d.slice(0, 4);
                await load(true);
                TC.say('jf-add-msg', TC.fmtDate(d) + ' ajouté.', 'ok');
            } catch (e) { TC.say('jf-add-msg', e.message, 'err'); }
        };

        TC.el('jf-tbody').onclick = async e => {
            const b = e.target.closest('.jf-del'); if (!b) return;
            if (!window.confirm('Retirer le ' + TC.fmtDate(b.dataset.date) + ' des jours fériés ?')) return;
            try { await TC.joursFeries.remove(b.dataset.date); await load(true); TC.toast('Jour férié retiré', 'ok'); }
            catch (err) { TC.toast(err.message, 'err'); }
        };
        TC.el('jf-tbody').onchange = async e => {
            const i = e.target.closest('.jf-lib'); if (!i) return;
            try { await TC.joursFeries.add(i.dataset.date, i.value.trim()); holidays.set(i.dataset.date, i.value.trim()); TC.toast('Libellé enregistré', 'ok'); }
            catch (err) { TC.toast(err.message, 'err'); }
        };

        TC.el('jf-gaps').onclick = async e => {
            const b = e.target.closest('.jf-mark'); if (!b) return;
            const input = TC.el('jf-gaps').querySelector('.jf-gap-lib[data-date="' + b.dataset.date + '"]');
            b.disabled = true;
            try { await TC.joursFeries.add(b.dataset.date, input && input.value.trim()); await load(true); TC.toast(TC.fmtDate(b.dataset.date) + ' marqué férié', 'ok'); }
            catch (err) { b.disabled = false; TC.toast(err.message, 'err'); }
        };

        TC.el('jf-bulk-save').onclick = async () => {
            const { out, bad } = parseBulk(TC.el('jf-bulk').value);
            if (bad.length) { TC.say('jf-bulk-msg', 'Lignes illisibles : ' + bad.slice(0, 3).join(' | '), 'err'); return; }
            if (!out.length) { TC.say('jf-bulk-msg', 'Rien à enregistrer.', 'err'); return; }
            try {
                await TC.post('jours_feries', out, 'date');
                TC.joursFeries.forget();
                TC.el('jf-bulk').value = '';
                await load(true);
                TC.say('jf-bulk-msg', out.length + ' jour(s) enregistré(s).', 'ok');
            } catch (e) { TC.say('jf-bulk-msg', e.message, 'err'); }
        };

        load();
    }

    TC.register({ id: 'jours-feries', label: 'Jours fériés', group: 'marche', icon: '☾', view, mount, refresh: () => load(true) });
})(window.TC);
