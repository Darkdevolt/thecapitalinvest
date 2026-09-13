/* ============================================================
   THE CAPITAL — ÉTATS FINANCIERS : MODÈLE ET FICHIERS EXCEL
   Deuxième fichier référencé par admin.html sans exister.
   Il produit le modèle de saisie, relit un classeur rempli et
   exporte les données déjà en base.

   Le modèle est engendré depuis le dictionnaire de postes : il ne
   peut donc pas diverger du formulaire ni des colonnes Supabase.
   ============================================================ */
'use strict';

(function (TC) {

    const SHEET = 'Etats_financiers';

    function xlsx() {
        if (typeof XLSX === 'undefined') {
            throw new Error('Le moteur Excel n\'est pas chargé. Rechargez la page.');
        }
        return XLSX;
    }

    function buildTemplate(tickers) {
        const X = xlsx();
        const headers = TC.FIN.excelHeaders();
        const labels = headers.map(function (h) {
            if (h === 'ticker') return 'Ticker';
            if (h === 'annee') return 'Exercice';
            if (h === 'periode') return 'Période';
            if (h === 'source') return 'Source';
            if (h === 'source_url') return 'URL de la source';
            if (h === 'source_page') return 'Page';
            return TC.FIN.label(h);
        });
        const sheet = X.utils.aoa_to_sheet([labels, headers]);
        sheet['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(34, h.length + 8)) }));
        sheet['!freeze'] = { xSplit: 0, ySplit: 2 };
        const book = X.utils.book_new();
        X.utils.book_append_sheet(book, sheet, SHEET);
        const guide = [
            ['THE CAPITAL — MODÈLE DE SAISIE DES ÉTATS FINANCIERS'],
            [''],
            ['Règle', 'Explication'],
            ['Deux lignes d\'en-tête', 'La ligne 1 porte les libellés, la ligne 2 le nom exact des colonnes. Ne supprimez ni ne réordonnez la ligne 2 : c\'est elle qui est lue.'],
            ['Saisie', 'Commencez à la ligne 3. Une ligne par couple société / exercice / période.'],
            ['Montants', 'En unités monétaires réelles, sans séparateur de milliers imposé. La virgule décimale française est acceptée.'],
            ['Période', 'annuel, S1, S2, T1, T2, T3, T4 ou TTM. Vide vaut annuel.'],
            ['Ratios', 'Ne les saisissez pas : rentabilité, marge et taux de distribution sont recalculés depuis les postes.'],
            ['Source', 'Obligatoire pour toute donnée publiée : intitulé du document, et son URL si elle existe.'],
            [''],
            ['Poste', 'Colonne', 'Référence SYSCOHADA', 'Contrôle appliqué']
        ].concat(TC.FIN.saisis().map(p => [
            p.label, p.col, p.ref || '—',
            p.signe === 'positif' ? 'valeur négative refusée'
                : p.signe === 'entier' ? 'entier strictement positif'
                    : 'valeur négative acceptée'
        ]));
        const guideSheet = X.utils.aoa_to_sheet(guide);
        guideSheet['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 22 }, { wch: 40 }];
        X.utils.book_append_sheet(book, guideSheet, 'Mode d_emploi');
        if (tickers && tickers.length) {
            const ref = X.utils.aoa_to_sheet(
                [['ticker', 'société', 'secteur', 'nombre d\'actions']].concat(
                    tickers.map(t => [t.ticker, t.nom || '', t.secteur || '', t.nombre_actions || t.nb_actions || ''])));
            ref['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 24 }, { wch: 18 }];
            X.utils.book_append_sheet(book, ref, 'Societes_cotees');
        }
        return book;
    }

    async function downloadTemplate() {
        try {
            const tickers = await TC.tickers();
            const book = buildTemplate(tickers);
            xlsx().writeFile(book, 'The-Capital-Etats-financiers.xlsx');
            TC.toast('Modèle Excel téléchargé', 'ok');
        } catch (e) {
            TC.toast('Modèle indisponible : ' + e.message, 'err');
        }
    }

    function detectHeaderRow(matrix) {
        const known = new Set(TC.FIN.excelHeaders());
        for (let i = 0; i < Math.min(4, matrix.length); i++) {
            const cells = (matrix[i] || []).map(c => String(c || '').trim().toLowerCase());
            const hits = cells.filter(c => known.has(c)).length;
            if (hits >= 3) return i;
        }
        return 0;
    }

    function normalizeHeader(value) {
        return String(value || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s\-/]+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    const ALIAS = {
        ticker: ['ticker', 'code', 'symbole', 'valeur'],
        annee: ['annee', 'exercice', 'year'],
        periode: ['periode', 'period'],
        chiffre_affaires: ['chiffre_affaires', 'ca', 'chiffre_d_affaires', 'revenus'],
        resultat_net: ['resultat_net', 'rn', 'benefice_net'],
        fonds_propres: ['fonds_propres', 'capitaux_propres'],
        dettes_financieres: ['dettes_financieres', 'dette_financiere', 'dettes'],
        cash_flow_operationnel: ['cash_flow_operationnel', 'cfo', 'flux_exploitation'],
        nombre_actions: ['nombre_actions', 'nb_actions', 'actions'],
        total_actif: ['total_actif', 'actif_total'],
        source_url: ['source_url', 'url', 'lien']
    };

    function columnIndex(headers, field) {
        const candidates = ALIAS[field] || [field];
        for (const candidate of candidates) {
            const idx = headers.indexOf(normalizeHeader(candidate));
            if (idx >= 0) return idx;
        }
        return -1;
    }

    async function readWorkbook(file) {
        const X = xlsx();
        const buffer = await file.arrayBuffer();
        const book = X.read(buffer, { type: 'array', cellNF: true, cellDates: true });
        if (!book.SheetNames.length) throw new Error('Le classeur ne contient aucune feuille.');
        const name = book.SheetNames.find(n => normalizeHeader(n).indexOf('etats') === 0)
            || book.SheetNames.find(n => normalizeHeader(n).indexOf('financ') >= 0)
            || book.SheetNames[0];
        const sheet = book.Sheets[name];
        const matrix = X.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: true });
        if (!matrix.length) throw new Error('La feuille « ' + name + ' » est vide.');
        const headerRow = detectHeaderRow(matrix);
        const headers = (matrix[headerRow] || []).map(normalizeHeader);
        const fields = TC.FIN.excelHeaders();
        const map = {};
        const ignored = [];
        fields.forEach(f => {
            const idx = columnIndex(headers, f);
            if (idx >= 0) map[f] = idx; else ignored.push(f);
        });
        if (map.ticker === undefined || map.annee === undefined) {
            throw new Error('Colonnes « ticker » et « annee » introuvables dans la feuille « ' + name + ' ».');
        }
        const rows = [];
        for (let i = headerRow + 1; i < matrix.length; i++) {
            const line = matrix[i] || [];
            if (!line.length || line.every(c => c === null || c === '')) continue;
            const row = { __line: i + 1 };
            Object.keys(map).forEach(function (field) {
                const raw = line[map[field]];
                if (raw === null || raw === undefined || raw === '') return;
                if (field === 'ticker') row[field] = String(raw).trim().toUpperCase();
                else if (field === 'periode') row[field] = String(raw).trim();
                else if (field === 'source' || field === 'source_url') row[field] = String(raw).trim();
                else if (field === 'annee' || field === 'source_page') {
                    const n = TC.toNumber(raw);
                    row[field] = n === null ? null : Math.trunc(n);
                } else row[field] = TC.toNumber(raw);
            });
            if (!row.ticker || row.ticker === 'TICKER') continue;
            if (!row.periode) row.periode = 'annuel';
            rows.push(row);
        }
        return { rows, sheetName: name, ignored, headerRow: headerRow + 1 };
    }

    function exportRows(rows, filename) {
        const X = xlsx();
        const headers = TC.FIN.excelHeaders().concat(['roe', 'roa', 'marge_nette', 'payout_ratio']);
        const matrix = [headers].concat(rows.map(r => headers.map(h => {
            const value = r[h];
            return value === null || value === undefined ? '' : value;
        })));
        const sheet = X.utils.aoa_to_sheet(matrix);
        sheet['!cols'] = headers.map(h => ({ wch: Math.max(12, Math.min(30, h.length + 6)) }));
        const book = X.utils.book_new();
        X.utils.book_append_sheet(book, sheet, SHEET);
        X.writeFile(book, filename || ('etats-financiers-' + TC.today() + '.xlsx'));
    }

    TC.FIN_XLS = { downloadTemplate, buildTemplate, readWorkbook, exportRows };

})(window.TC);

/* ============================================================
   THE CAPITAL — NORMALISATION DES UNITÉS DES ÉTATS FINANCIERS
   La saisie peut être exprimée en unités, milliers, millions ou milliards.
   Les postes comptables monétaires sont convertis en FCFA avant calcul et
   avant écriture. Les données par action gardent leur unité propre.
   ============================================================ */
(function (TC) {
    if (window.__TC_FIN_UNITS__) return;
    window.__TC_FIN_UNITS__ = true;

    const UNITS = {
        unite: { label: 'Unités (FCFA)', factor: 1 },
        milliers: { label: 'Milliers de FCFA', factor: 1e3 },
        millions: { label: 'Millions de FCFA', factor: 1e6 },
        milliards: { label: 'Milliards de FCFA', factor: 1e9 }
    };

    const MONETARY = new Set([
        'chiffre_affaires', 'rbe', 'resultat_exploitation', 'ebitda', 'ebit', 'resultat_net',
        'total_actif', 'fonds_propres', 'dettes_financieres', 'dette_nette',
        'cash_flow_operationnel', 'capex'
    ]);

    function injectStyles() {
        if (document.getElementById('fin-units-style')) return;
        const style = document.createElement('style');
        style.id = 'fin-units-style';
        style.textContent = '.fin-unit-control{grid-column:1/-1;padding:12px 14px;border:1px solid var(--border);background:var(--surface);border-radius:8px;display:grid;grid-template-columns:minmax(170px,auto) minmax(220px,320px);gap:6px 14px;align-items:center}.fin-unit-control label{font-weight:600}.fin-unit-select{width:100%;padding:8px 10px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:6px}.fin-unit-help{grid-column:1/-1;font-size:11px;color:var(--muted)}.fin-unit-control-compact{grid-template-columns:minmax(170px,auto) minmax(180px,280px);margin-bottom:14px}@media(max-width:700px){.fin-unit-control{grid-template-columns:1fr}.fin-unit-help{grid-column:1}}';
        document.head.appendChild(style);
    }

    function unitField(id, compact) {
        const options = Object.keys(UNITS).map(function (key) {
            return '<option value="' + key + '">' + TC.esc(UNITS[key].label) + '</option>';
        }).join('');
        return '<div class="fin-unit-control' + (compact ? ' fin-unit-control-compact' : '') + '">' +
            '<label for="' + id + '">Unité des montants saisis</label>' +
            '<select id="' + id + '" class="fin-unit-select">' + options + '</select>' +
            '<span class="fin-unit-help">Les montants comptables sont enregistrés en FCFA. Nombre d’actions, BPA et DPA ne changent pas.</span>' +
            '</div>';
    }

    function injectMain() {
        const form = document.querySelector('#fsub-saisie .form-grid');
        if (!form || document.getElementById('f-unite')) return;
        form.insertAdjacentHTML('afterbegin', unitField('f-unite', false));
        const select = document.getElementById('f-unite');
        select.value = 'unite';
        select.addEventListener('change', function () {
            const node = document.getElementById('fin-live');
            if (node) node.innerHTML = '<strong>Unité sélectionnée</strong> — ' + TC.esc(UNITS[this.value].label) + '. Les montants seront normalisés en FCFA lors de l’enregistrement.';
        });
    }

    function injectEdit() {
        const form = document.querySelector('#modal-body .form-grid');
        if (!form || document.getElementById('mf-unite')) return;
        form.insertAdjacentHTML('afterbegin', unitField('mf-unite', true));
        document.getElementById('mf-unite').value = 'unite';
    }

    const observer = new MutationObserver(function () {
        injectStyles();
        injectMain();
        injectEdit();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    injectStyles();
    injectMain();

    function normalizeInputs(prefix, unitKey) {
        const f = (UNITS[unitKey] || UNITS.unite).factor;
        const original = [];
        if (f === 1) return original;
        MONETARY.forEach(function (key) {
            const el = document.getElementById(prefix + key);
            if (!el || el.value === '') return;
            const raw = el.value;
            const value = Number(String(raw).replace(',', '.'));
            if (Number.isFinite(value)) {
                original.push([el, raw]);
                el.value = String(value * f);
            }
        });
        return original;
    }

    function restoreInputs(original) {
        (original || []).forEach(function (pair) { pair[0].value = pair[1]; });
    }

    function normalizeBeforeSave(event) {
        const target = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!target) return;
        if (target.id === 'fin-save') {
            const select = document.getElementById('f-unite');
            const original = normalizeInputs('f-', select ? select.value : 'unite');
            setTimeout(function () { restoreInputs(original); }, 0);
            return;
        }
        if (target.id === 'modal-save' && document.getElementById('mf-unite')) {
            const select = document.getElementById('mf-unite');
            const original = normalizeInputs('mf-', select ? select.value : 'unite');
            setTimeout(function () { restoreInputs(original); }, 0);
        }
    }

    document.addEventListener('click', normalizeBeforeSave, true);
    TC.FIN_UNITS = { UNITS, MONETARY };
})(window.TC);
