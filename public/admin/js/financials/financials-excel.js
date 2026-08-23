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

    /* ── Modèle de saisie ────────────────────────────────── */

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

        /* Deux lignes d'en-tête : le libellé pour l'œil, la colonne pour la machine. */
        const sheet = X.utils.aoa_to_sheet([labels, headers]);
        sheet['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(34, h.length + 8)) }));
        sheet['!freeze'] = { xSplit: 0, ySplit: 2 };

        const book = X.utils.book_new();
        X.utils.book_append_sheet(book, sheet, SHEET);

        /* Mode d'emploi */
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

        /* Référentiel, pour éviter les tickers inventés */
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

    /* ── Lecture d'un classeur rempli ────────────────────── */

    /**
     * Le modèle porte deux lignes d'en-tête. Un fichier construit ailleurs n'en
     * porte qu'une. On détecte laquelle contient des noms de colonnes connus
     * plutôt que de supposer une structure.
     */
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

    /**
     * Retourne { rows, headers, ignored } où rows est une liste d'objets prêts
     * pour la validation métier — pas encore pour l'écriture.
     */
    async function readWorkbook(file) {
        const X = xlsx();
        const buffer = await file.arrayBuffer();
        const book = X.read(buffer, { type: 'array', cellNF: true, cellDates: true });
        if (!book.SheetNames.length) throw new Error('Le classeur ne contient aucune feuille.');

        /* La feuille de saisie prime sur le mode d'emploi. */
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
            /* Une ligne d'en-tête recopiée par mégarde ne doit pas être importée. */
            if (!row.ticker || row.ticker === 'TICKER') continue;
            if (!row.periode) row.periode = 'annuel';
            rows.push(row);
        }

        return { rows, sheetName: name, ignored, headerRow: headerRow + 1 };
    }

    /* ── Export des données en base ──────────────────────── */

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
