/* ============================================================
   THE CAPITAL — SIMULATEUR D'ORDRE OBLIGATAIRE (réglages)
   Taux par défaut du simulateur réservé aux abonnés Professional
   (parametres_publics, clé simulateur_obligataire) : commission SGI,
   apporteur d'affaires, TAF, commissions BRVM/DC-BR, délai de
   règlement et lignes masquées. Un fichier Excel au format de la
   fiche « SIMULATION » peut être importé : les taux sont lus dans la
   section PARAMÈTRES ou, à défaut, déduits des libellés et montants.
   Le calcul et la lecture du fichier sont partagés avec l'application
   (/app/js/views/obligations-ordre.js).
   ============================================================ */
'use strict';

(function (TC) {

    const KEY = 'simulateur_obligataire';
    let current = null;     // paramètres enregistrés
    let updatedAt = null;
    let pending = null;     // paramètres lus dans un fichier, en attente

    function lib() {
        if (window.TCOrdreObligataire) return Promise.resolve(window.TCOrdreObligataire);
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = '/app/js/views/obligations-ordre.js?v=20261003.3';
            s.onload = () => window.TCOrdreObligataire ? resolve(window.TCOrdreObligataire) : reject(new Error('Module de calcul introuvable.'));
            s.onerror = () => reject(new Error('Module de calcul introuvable.'));
            document.head.appendChild(s);
        });
    }

    const FIELDS = [
        ['commission_sgi_libelle', 'Libellé de la commission SGI', 'text'],
        ['commission_sgi_pct', 'Commission SGI (% du montant de l\'opération)', 'number'],
        ['apporteur_par_titre', 'Apporteur d\'affaires (FCFA par titre)', 'number'],
        ['taf_pct', 'TAF (% des commissions)', 'number'],
        ['brvm_dcbr_pct', 'Commissions BRVM / DC-BR (%)', 'number'],
        ['brvm_dcbr_base', 'Base BRVM / DC-BR', 'base'],
        ['delai_reglement_jours', 'Délai de règlement (jours ouvrés)', 'number']
    ];
    const BOOLS = [
        ['apporteur_actif', 'Inclure l\'apporteur d\'affaires'],
        ['brvm_dcbr_actif', 'Inclure les commissions BRVM / DC-BR'],
        ['taf_sur_apporteur', 'Appliquer la TAF à la commission de l\'apporteur']
    ];

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Simulateur <em>obligataire</em></div>' +
            '<div class="page-sub">Taux par défaut du simulateur d\'ordre réservé aux abonnés Professional (fiche obligation de l\'application). Chaque professionnel peut ensuite saisir ses propres taux et masquer des lignes.</div></div>' +
            '<div class="page-actions"><button class="btn btn-outline btn-sm" id="so-reload">↺</button></div></div>' +

            '<div class="card accent"><div class="card-head"><span class="card-title">Importer une fiche « SIMULATION »</span></div>' +
            '<div class="card-body"><div class="note">Téléchargez le modèle, ajustez les taux (section <strong>PARAMÈTRES</strong>) ou déposez directement une fiche de simulation de votre SGI : les taux sont alors déduits des libellés (« Commission SGI (0,4%) », « TAF (17%) », « Apporteur d\'affaires (100 FCFA par titre) »), de la ligne Commissions BRVM/DCBR rapportée au nominal, et le délai de règlement des dates de transaction et de valeur.</div>' +
            '<div class="actions"><button class="btn btn-outline" id="so-template">Télécharger le modèle Excel</button>' +
            '<label class="btn btn-primary" for="so-file">Choisir un fichier Excel</label><input id="so-file" type="file" accept=".xlsx,.xls,.csv" hidden></div>' +
            '<div id="so-preview"></div>' +
            '<div class="actions"><button class="btn btn-primary" id="so-apply" disabled>Appliquer ces taux</button><span class="msg" id="so-import-msg"></span></div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Taux par défaut</span>' +
            '<span class="card-tools"><span class="card-count" id="so-updated"></span></span></div>' +
            '<div class="form-grid" id="so-form"></div>' +
            '<div class="card-body"><div id="so-bools"></div></div>' +
            '<div class="card-head"><span class="card-title">Lignes masquées par défaut</span></div>' +
            '<div class="card-body"><div id="so-lines" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 16px;"></div></div>' +
            '<div class="actions"><button class="btn btn-primary" id="so-save">Enregistrer</button><span class="msg" id="so-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Contrôle — fiche SGI de référence EOS.O19</span></div>' +
            '<div class="card-body"><div class="hint" style="margin-bottom:8px;">200 000 titres à 9 600 FCFA, transaction le 29/07/2026, valeur le 31/07/2026, intérêts courus 38 229 508 FCFA : frais recalculés avec les taux ci-dessus.</div>' +
            '<div class="tw"><table><tbody id="so-check"></tbody></table></div></div></div>';
    }

    async function load() {
        const rows = await TC.get('parametres_publics', 'select=valeur,updated_at&cle=eq.' + KEY).catch(() => []);
        const L = await lib();
        current = L.mergeParams(rows && rows[0] ? rows[0].valeur : {}, {});
        updatedAt = rows && rows[0] ? rows[0].updated_at : null;
        paint(L);
    }

    function paint(L) {
        const p = current;
        TC.el('so-updated').textContent = updatedAt ? 'mis à jour le ' + TC.fmtDate(updatedAt) : 'valeurs initiales';
        TC.el('so-form').innerHTML = FIELDS.map(([k, l, t]) => t === 'base'
            ? '<div class="field"><label for="so-' + k + '">' + TC.esc(l) + '</label><select id="so-' + k + '"><option value="nominal"' + (p[k] !== 'montant' ? ' selected' : '') + '>Nominal (capital restant dû)</option><option value="montant"' + (p[k] === 'montant' ? ' selected' : '') + '>Montant de l\'opération</option></select></div>'
            : '<div class="field"><label for="so-' + k + '">' + TC.esc(l) + '</label><input id="so-' + k + '" type="' + t + '"' + (t === 'number' ? ' step="any"' : '') + ' value="' + TC.esc(p[k] == null ? '' : p[k]) + '"></div>'
        ).join('');
        TC.el('so-bools').innerHTML = BOOLS.map(([k, l]) =>
            '<label style="display:flex;gap:8px;align-items:center;margin:4px 0;"><input type="checkbox" id="so-' + k + '"' + (p[k] ? ' checked' : '') + '> ' + TC.esc(l) + '</label>').join('');
        const hide = new Set(p.masquer || []);
        TC.el('so-lines').innerHTML = L.LINES.filter(l => l.k !== 'montant').map(l =>
            '<label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" class="so-hide" data-k="' + l.k + '"' + (hide.has(l.k) ? ' checked' : '') + '> ' + TC.esc(L.labelOf(l, p)) + '</label>').join('');
        paintCheck(L, p);
    }

    function readForm() {
        const out = Object.assign({}, current);
        FIELDS.forEach(([k, , t]) => {
            const v = TC.el('so-' + k).value;
            if (t === 'number') { const n = Number(String(v).replace(',', '.')); if (v !== '' && Number.isFinite(n)) out[k] = n; }
            else out[k] = String(v).trim();
        });
        BOOLS.forEach(([k]) => { out[k] = TC.el('so-' + k).checked; });
        out.masquer = Array.from(document.querySelectorAll('.so-hide:checked')).map(i => i.dataset.k);
        return out;
    }

    /* Frais de la fiche d'exemple avec les taux donnés (sans échéancier). */
    function paintCheck(L, p) {
        const S = L.SAMPLE, qty = S.quantite, nominal = qty * S.vn, montantOp = S.montant_operation;
        const sgi = p.commission_sgi_pct / 100 * montantOp;
        const app = p.apporteur_actif ? qty * p.apporteur_par_titre : 0;
        const taf = p.taf_pct / 100 * (sgi + (p.taf_sur_apporteur ? app : 0));
        const dcbr = p.brvm_dcbr_actif ? p.brvm_dcbr_pct / 100 * (p.brvm_dcbr_base === 'montant' ? montantOp : nominal) : 0;
        const total = sgi + app + taf + dcbr;
        const fmt = v => Math.round(v).toLocaleString('fr-FR');
        const rows = [
            [L.labelOf({ k: 'commission_sgi' }, p), fmt(sgi), '17 624 066'],
            [L.labelOf({ k: 'apporteur' }, p), fmt(app), '40 000 000'],
            [L.labelOf({ k: 'taf' }, p), fmt(taf), '2 996 091'],
            ['Commissions BRVM/DCBR', fmt(dcbr), '2 338 425'],
            ['Total commissions', fmt(total), '62 958 582'],
            ['Taux commissions', (total / nominal * 100).toFixed(2).replace('.', ',') + ' %', '3,15 %'],
            ['Montant', fmt(montantOp + total), '2 021 188 090']
        ];
        TC.el('so-check').innerHTML = '<tr><th>Ligne</th><th class="r">Avec ces taux</th><th class="r">Fiche d\'origine</th></tr>' +
            rows.map(r => '<tr><td>' + TC.esc(r[0]) + '</td><td class="r mono">' + r[1] + '</td><td class="r mono" style="color:var(--muted)">' + r[2] + '</td></tr>').join('');
    }

    async function save(values, msgId) {
        const L = await lib();
        const clean = L.mergeParams(values, {});
        if (!(clean.delai_reglement_jours >= 0 && clean.delai_reglement_jours <= 10)) throw new Error('Délai de règlement hors limites (0 à 10 jours ouvrés).');
        ['commission_sgi_pct', 'taf_pct', 'brvm_dcbr_pct'].forEach(k => {
            if (!(clean[k] >= 0 && clean[k] <= 100)) throw new Error('Taux hors limites : ' + k);
        });
        const stamp = new Date().toISOString();
        await TC.post('parametres_publics', { cle: KEY, valeur: clean, updated_at: stamp }, 'cle');
        current = clean; updatedAt = stamp;
        paint(L);
        TC.say(msgId, 'Taux enregistrés : ils s\'appliquent aux simulations des abonnés Professional.', 'ok');
    }

    async function readFile(file) {
        if (!window.XLSX) throw new Error('Le moteur Excel n’est pas chargé. Rechargez la page.');
        const X = window.XLSX, wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const L = await lib();
        let best = null;
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const raw = X.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
            const text = X.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
            const r = L.parseRows(raw, text);
            if (!best || Object.keys(r.found).length > Object.keys(best.found).length) best = r;
        });
        return best;
    }

    function showPreview(L, r) {
        const keys = Object.keys(r.found);
        if (!keys.length) {
            TC.el('so-preview').innerHTML = '<div class="note">Aucun taux reconnu dans ce fichier.</div>';
            TC.el('so-apply').disabled = true; pending = null; return;
        }
        const label = k => (L.PARAM_ROWS.find(x => x[0] === k) || [k, k])[1];
        const show = v => Array.isArray(v) ? (v.join(', ') || '—') : typeof v === 'boolean' ? (v ? 'oui' : 'non') : (v == null ? '—' : String(v));
        TC.el('so-preview').innerHTML =
            (r.info && r.info.code ? '<div class="hint" style="margin:6px 0;">Fiche : ' + TC.esc(r.info.code) + ' — ' + TC.esc(r.info.designation || '') + '</div>' : '') +
            '<div class="tw"><table><thead><tr><th>Paramètre</th><th class="r">Actuel</th><th class="r">Fichier</th><th>Lu depuis</th></tr></thead><tbody>' +
            keys.map(k => {
                const changed = show(current[k]) !== show(r.params[k]);
                return '<tr><td>' + TC.esc(label(k)) + '</td><td class="r mono">' + TC.esc(show(current[k])) + '</td><td class="r mono"' + (changed ? ' style="color:var(--gold)"' : '') + '>' + TC.esc(show(r.params[k])) + '</td><td class="hint">' + TC.esc(r.found[k]) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (r.warnings.length ? '<div class="note" style="color:var(--orange)">' + r.warnings.map(TC.esc).join('<br>') + '</div>' : '');
        pending = r.params;
        TC.el('so-apply').disabled = false;
    }

    function mount() {
        TC.el('so-reload').onclick = () => load();
        TC.el('so-save').onclick = async () => {
            TC.el('so-save').disabled = true;
            try { await save(readForm(), 'so-msg'); } catch (e) { TC.say('so-msg', e.message, 'err'); }
            finally { TC.el('so-save').disabled = false; }
        };
        TC.el('so-form').oninput = async () => { const L = await lib(); paintCheck(L, readForm()); };
        TC.el('so-bools').onchange = async () => { const L = await lib(); paintCheck(L, readForm()); };
        TC.el('so-template').onclick = async () => {
            try {
                if (!window.XLSX) throw new Error('Le moteur Excel n’est pas chargé. Rechargez la page.');
                const L = await lib();
                L.writeWorkbook(window.XLSX, L.SAMPLE, current, 'The-Capital-Simulation-obligataire.xlsx', { notes: [
                    'Mode d\'emploi',
                    'Ce fichier suit la fiche « SIMULATION » : une ligne par libellé, valeur en colonne B.',
                    'Admin The Capital → Simulateur obligataire → Importer : les taux de la section PARAMÈTRES deviennent les valeurs par défaut des abonnés Professional.',
                    'À défaut de section PARAMÈTRES, les taux sont déduits des libellés (« Commission SGI (0,9%) », « TAF (17%) », « Apporteur d\'affaires (200 FCFA par titre) ») et de la ligne Commissions BRVM/DCBR rapportée au nominal.',
                    'Codes de lignes masquables : ' + L.LINES.filter(l => l.k !== 'montant').map(l => l.k).join(', ')
                ] });
                TC.toast('Modèle Excel téléchargé', 'ok');
            } catch (e) { TC.toast(e.message, 'err'); }
        };
        TC.el('so-file').onchange = async e => {
            const file = e.target.files[0]; if (!file) return;
            TC.say('so-import-msg', 'Lecture…', 'info');
            try { const L = await lib(); showPreview(L, await readFile(file)); TC.say('so-import-msg', ''); }
            catch (err) { pending = null; TC.el('so-apply').disabled = true; TC.say('so-import-msg', err.message, 'err'); }
            e.target.value = '';
        };
        TC.el('so-apply').onclick = async () => {
            if (!pending) return;
            TC.el('so-apply').disabled = true;
            try { await save(Object.assign({}, current, pending), 'so-import-msg'); pending = null; TC.el('so-preview').innerHTML = ''; }
            catch (e) { TC.el('so-apply').disabled = false; TC.say('so-import-msg', e.message, 'err'); }
        };
        load().catch(e => TC.toast(e.message, 'err'));
    }

    TC.register({ id: 'simulateur-obligataire', label: 'Simulateur obligataire', group: 'marche', icon: '%', view, mount, refresh: load });
})(window.TC);
