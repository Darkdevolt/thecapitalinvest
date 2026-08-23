/* ============================================================
   THE CAPITAL — IMPORT EXCEL
   Un import se joue en quatre temps : reconnaître le modèle, lire
   les cellules, contrôler chaque ligne, écrire par lots.

   Les lignes douteuses ne bloquent pas les lignes valides : elles
   attendent une décision explicite. L'ancienne version rejetait le
   fichier entier dès la première anomalie.
   ============================================================ */
'use strict';

(function (TC) {

    const MAX_ROWS = 100000;
    const MAX_MB = 50;

    const MODELES = {
        entreprises: {
            nom: 'Sociétés cotées', icone: '⌂', table: 'entreprises', conflit: 'ticker',
            colonnes: ['ticker', 'nom', 'secteur', 'pays', 'compartiment', 'isin', 'nombre_actions', 'valeur_nominale', 'site_web', 'siege_social', 'date_introduction', 'description'],
            requis: ['ticker', 'nom'],
            resume: 'Référentiel de la place'
        },
        cours: {
            nom: 'Cotations', icone: '▤', table: 'historique', conflit: 'ticker,date_seance',
            colonnes: ['ticker', 'date_seance', 'cours_cloture', 'cours_ouverture', 'plus_haut', 'plus_bas', 'volume', 'variation', 'valeur_totale'],
            requis: ['ticker', 'date_seance', 'cours_cloture'],
            resume: 'Séances de bourse'
        },
        financials: {
            nom: 'États financiers', icone: '≡', table: 'financials', conflit: 'ticker,annee,periode',
            colonnes: ['ticker', 'annee', 'periode', 'chiffre_affaires', 'rbe', 'resultat_net', 'bpa', 'dpa', 'fonds_propres', 'dettes_financieres', 'total_actif', 'nombre_actions', 'cash_flow_operationnel', 'capex', 'source'],
            requis: ['ticker', 'annee'],
            resume: 'Comptes publiés'
        },
        dividendes: {
            nom: 'Dividendes', icone: '◆', table: 'dividendes_calendrier', conflit: 'ticker,annee',
            colonnes: ['ticker', 'annee', 'montant', 'taux_rendement', 'date_detachement', 'date_paiement', 'statut', 'notes'],
            requis: ['ticker', 'annee', 'montant'],
            resume: 'Calendrier de distribution'
        },
        indices: {
            nom: 'Indices', icone: '◪', table: 'indices', conflit: 'indice,date_seance',
            colonnes: ['indice', 'date_seance', 'valeur', 'variation', 'variation_pct'],
            requis: ['indice', 'date_seance', 'valeur'],
            resume: 'Indices de marché'
        },
        actionnaires: {
            nom: 'Actionnariat', icone: '◔', table: 'actionnaires', conflit: null,
            colonnes: ['ticker', 'nom_actionnaire', 'pourcentage', 'type_actionnaire', 'pays_origine'],
            requis: ['ticker', 'nom_actionnaire', 'pourcentage'],
            resume: 'Actionnaires significatifs'
        }
    };

    const ALIAS = {
        ticker: ['ticker', 'code', 'symbole', 'symbol', 'code_valeur', 'valeur'],
        nom: ['nom', 'nom_complet', 'societe', 'entreprise', 'denomination'],
        secteur: ['secteur', 'sector', 'activite'],
        pays: ['pays', 'country'],
        compartiment: ['compartiment', 'segment'],
        isin: ['isin', 'code_isin'],
        nombre_actions: ['nombre_actions', 'nb_actions', 'actions', 'titres'],
        valeur_nominale: ['valeur_nominale', 'nominal'],
        site_web: ['site_web', 'website', 'site'],
        siege_social: ['siege_social', 'siege'],
        date_introduction: ['date_introduction', 'date_ipo', 'introduction'],
        description: ['description', 'presentation'],
        date_seance: ['date_seance', 'date', 'date_cotation', 'seance'],
        cours_cloture: ['cours_cloture', 'cloture', 'cours', 'close', 'dernier_cours'],
        cours_ouverture: ['cours_ouverture', 'ouverture', 'open', 'ouv'],
        plus_haut: ['plus_haut', 'haut', 'high', 'plus_haut_seance'],
        plus_bas: ['plus_bas', 'bas', 'low', 'plus_bas_seance'],
        volume: ['volume', 'vol', 'quantite', 'titres_echanges'],
        variation: ['variation', 'var', 'variation_pct', 'pourcentage_variation'],
        valeur_totale: ['valeur_totale', 'capitalisation', 'valeur_echangee', 'valeur_transigee', 'capi'],
        annee: ['annee', 'exercice', 'year'],
        periode: ['periode', 'period'],
        chiffre_affaires: ['chiffre_affaires', 'ca', 'chiffre_d_affaires', 'revenus'],
        rbe: ['rbe', 'ebe', 'resultat_brut_exploitation'],
        resultat_net: ['resultat_net', 'rn', 'benefice_net'],
        bpa: ['bpa', 'benefice_par_action', 'eps'],
        dpa: ['dpa', 'dividende_par_action'],
        fonds_propres: ['fonds_propres', 'capitaux_propres'],
        dettes_financieres: ['dettes_financieres', 'dettes', 'dette_financiere'],
        total_actif: ['total_actif', 'actif_total', 'bilan'],
        cash_flow_operationnel: ['cash_flow_operationnel', 'cfo', 'flux_exploitation'],
        capex: ['capex', 'investissements'],
        source: ['source', 'origine', 'document'],
        montant: ['montant', 'dividende', 'dividende_par_action'],
        taux_rendement: ['taux_rendement', 'rendement', 'dividend_yield'],
        date_detachement: ['date_detachement', 'ex_date', 'detachement'],
        date_paiement: ['date_paiement', 'paiement', 'payment_date'],
        statut: ['statut', 'status'],
        notes: ['notes', 'observation', 'commentaire'],
        indice: ['indice', 'index', 'nom_indice'],
        valeur: ['valeur', 'niveau', 'points'],
        variation_pct: ['variation_pct', 'variation_pourcent', 'var_pct'],
        nom_actionnaire: ['nom_actionnaire', 'actionnaire', 'detenteur'],
        pourcentage: ['pourcentage', 'part', 'participation', 'pct'],
        type_actionnaire: ['type_actionnaire', 'type', 'categorie'],
        pays_origine: ['pays_origine', 'origine', 'pays']
    };

    const CHAMPS_DATE = new Set(['date_seance', 'date_introduction', 'date_detachement', 'date_paiement']);
    const CHAMPS_TEXTE = new Set(['nom', 'secteur', 'pays', 'compartiment', 'isin', 'site_web', 'siege_social',
        'description', 'periode', 'source', 'statut', 'notes', 'nom_actionnaire', 'type_actionnaire', 'pays_origine']);
    const CHAMPS_CLE = new Set(['ticker', 'indice']);

    const state = { file: null, modele: '', details: [], decisions: {}, headers: [] };

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Import <em>Excel</em></div>' +
            '<div class="page-sub">Chargement en masse depuis un classeur. Chaque ligne est contrôlée avant écriture ; celles qui posent question attendent votre décision sans bloquer les autres.</div></div>' +
            '</div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Modèles de saisie</span>' +
            '<span class="card-tools"><span class="card-count">Colonnes attendues, prêtes à remplir</span></span></div>' +
            '<div class="card-body"><div class="tpl-grid">' +
            Object.keys(MODELES).map(function (key) {
                const m = MODELES[key];
                return '<button class="tpl" data-tpl="' + key + '"><div class="ico">' + m.icone + '</div>' +
                    '<div class="nm">' + TC.esc(m.nom) + '</div><div class="ds">' + TC.esc(m.resume) + ' · ' +
                    m.colonnes.length + ' colonnes</div></button>';
            }).join('') + '</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Charger un fichier</span></div>' +
            '<div class="card-body">' +
            '<div class="drop" id="imp-drop"><div class="drop-ico">▤</div>' +
            '<div class="drop-main">Déposez le fichier ou cliquez pour le choisir</div>' +
            '<div class="drop-hint">.xlsx, .xls ou .csv — ' + MAX_MB + ' Mo et ' + MAX_ROWS.toLocaleString('fr-FR') + ' lignes au maximum</div></div>' +
            '<input type="file" id="imp-file" accept=".xlsx,.xls,.csv" hidden>' +
            '<div id="imp-file-info" style="margin-top:14px;"></div>' +
            '<div id="imp-force" style="margin-top:12px;display:none;">' +
            '<div class="field" style="max-width:280px;"><label>Forcer le modèle</label>' +
            '<select id="imp-modele"><option value="">Reconnaissance automatique</option>' +
            Object.keys(MODELES).map(k => '<option value="' + k + '">' + TC.esc(MODELES[k].nom) + '</option>').join('') +
            '</select></div></div>' +
            '</div></div>' +

            '<div class="card" id="imp-preview-card" hidden>' +
            '<div class="card-head"><span class="card-title">Contrôle avant écriture</span>' +
            '<span class="card-tools"><span class="card-count" id="imp-preview-count"></span></span></div>' +
            '<div class="card-body tight" id="imp-summary"></div>' +
            '<div class="tw capped" id="imp-preview"></div>' +
            '<div class="actions">' +
            '<button class="btn btn-primary" id="imp-run">Importer les lignes retenues</button>' +
            '<button class="btn btn-outline btn-sm" id="imp-approve-all">Valider toutes les lignes en attente</button>' +
            '<button class="btn btn-outline btn-sm" id="imp-cancel">Annuler</button>' +
            '<span class="msg" id="imp-msg"></span></div></div>' +

            '<div class="card" id="imp-progress-card" hidden>' +
            '<div class="card-head"><span class="card-title">Écriture</span>' +
            '<span class="card-tools"><span class="card-count" id="imp-pct">0 %</span></span></div>' +
            '<div class="card-body"><div class="bar"><i id="imp-bar" style="width:0%"></i></div>' +
            '<div class="log" id="imp-log" style="margin-top:12px;"></div>' +
            '<button class="btn btn-orange btn-sm" id="imp-retry" style="margin-top:12px;" hidden>↻ Reprendre les lots en échec</button>' +
            '</div></div>';
    }

    /* ── Modèle Excel ────────────────────────────────────── */

    async function downloadTemplate(key) {
        const m = MODELES[key];
        if (!m) return;
        if (typeof XLSX === 'undefined') { TC.toast('Le moteur Excel n\'est pas chargé.', 'err'); return; }

        const sheet = XLSX.utils.aoa_to_sheet([m.colonnes]);
        sheet['!cols'] = m.colonnes.map(c => ({ wch: Math.max(14, Math.min(32, c.length + 6)) }));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, m.nom.slice(0, 28));

        const guide = [
            ['THE CAPITAL — MODÈLE « ' + m.nom.toUpperCase() + ' »'],
            [''],
            ['Colonnes obligatoires', m.requis.join(', ')],
            ['Dates', 'AAAA-MM-JJ de préférence. Les formats JJ/MM/AAAA et les dates Excel natives sont reconnus.'],
            ['Nombres', 'La virgule décimale française est acceptée. Ne mettez pas de symbole monétaire.'],
            ['Pourcentages', 'Saisissez 2,69 pour 2,69 %. Une cellule au format pourcentage Excel est aussi reconnue.'],
            ['Doublons', m.conflit ? 'Clé d\'unicité : ' + m.conflit + '. Une ligne existante est mise à jour, pas dupliquée.' : 'Aucune clé d\'unicité : chaque ligne crée un enregistrement.'],
            ['Volume', 'Jusqu\'à ' + MAX_ROWS.toLocaleString('fr-FR') + ' lignes par fichier.'],
            [''],
            ['Colonne', 'Obligatoire']
        ].concat(m.colonnes.map(c => [c, m.requis.indexOf(c) !== -1 ? 'oui' : 'non']));

        const guideSheet = XLSX.utils.aoa_to_sheet(guide);
        guideSheet['!cols'] = [{ wch: 34 }, { wch: 74 }];
        XLSX.utils.book_append_sheet(book, guideSheet, 'Mode d_emploi');

        if (key !== 'entreprises') {
            const refs = await TC.tickers();
            if (refs.length) {
                const ref = XLSX.utils.aoa_to_sheet([['ticker', 'société', 'secteur']]
                    .concat(refs.map(r => [r.ticker, r.nom || '', r.secteur || ''])));
                ref['!cols'] = [{ wch: 12 }, { wch: 38 }, { wch: 24 }];
                XLSX.utils.book_append_sheet(book, ref, 'Societes_cotees');
            }
        }

        XLSX.writeFile(book, 'The-Capital-' + m.nom.replace(/\s+/g, '-') + '.xlsx');
        TC.toast('Modèle « ' + m.nom + ' » téléchargé', 'ok');
    }

    /* ── Lecture ─────────────────────────────────────────── */

    function normalize(value) {
        return String(value === null || value === undefined ? '' : value).trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s\-/.]+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    function findColumn(headers, field) {
        const candidates = ALIAS[field] || [field];
        for (const candidate of candidates) {
            const idx = headers.indexOf(normalize(candidate));
            if (idx >= 0) return idx;
        }
        return -1;
    }

    function detect(headers) {
        let best = '', bestScore = 0;
        Object.keys(MODELES).forEach(function (key) {
            const m = MODELES[key];
            let score = 0;
            m.requis.forEach(f => { if (findColumn(headers, f) >= 0) score += 10; });
            m.colonnes.forEach(f => { if (findColumn(headers, f) >= 0) score += 1; });
            /* Cotations et dividendes partagent ticker + année : la présence
               d'une date de séance tranche. */
            if (key === 'cours' && findColumn(headers, 'date_seance') >= 0) score += 5;
            if (score > bestScore) { bestScore = score; best = key; }
        });
        return bestScore >= 20 ? best : '';
    }

    function convert(field, raw, cell) {
        if (raw === null || raw === undefined || raw === '') return null;
        if (CHAMPS_CLE.has(field)) return String(raw).trim().toUpperCase();
        if (CHAMPS_DATE.has(field)) return TC.toISODate(raw);
        if (CHAMPS_TEXTE.has(field)) return String(raw).trim();
        const n = TC.toNumber(raw);
        if (n === null) return null;
        /* Une cellule au format pourcentage Excel stocke 0,0269 pour 2,69 %. */
        const isPct = field === 'variation' || field === 'variation_pct' || field === 'taux_rendement' || field === 'pourcentage';
        if (isPct && cell && ((cell.z && String(cell.z).indexOf('%') >= 0) || (cell.w && /%/.test(String(cell.w)))) && Math.abs(n) <= 1) {
            return n * 100;
        }
        return n;
    }

    async function read(file, forced) {
        state.file = file;
        state.decisions = {};
        const info = TC.el('imp-file-info');
        info.innerHTML = '<div class="loading"><div class="spinner"></div>Lecture du fichier…</div>';
        TC.el('imp-preview-card').hidden = true;

        try {
            if (file.size > MAX_MB * 1024 * 1024) throw new Error('Fichier trop volumineux : ' + MAX_MB + ' Mo au maximum.');
            if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Format non pris en charge. Utilisez .xlsx, .xls ou .csv.');
            if (typeof XLSX === 'undefined') throw new Error('Le moteur Excel n\'est pas chargé. Rechargez la page.');

            const buffer = await file.arrayBuffer();
            const book = XLSX.read(buffer, { type: 'array', cellNF: true, cellDates: true });
            if (!book.SheetNames.length) throw new Error('Le classeur ne contient aucune feuille.');

            const sheetName = book.SheetNames[0];
            const sheet = book.Sheets[sheetName];
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: true });
            if (!matrix.length) throw new Error('La feuille « ' + sheetName + ' » est vide.');
            if (matrix.length > MAX_ROWS) throw new Error('Le fichier contient ' + matrix.length.toLocaleString('fr-FR') +
                ' lignes, au-delà de la limite de ' + MAX_ROWS.toLocaleString('fr-FR') + '.');

            const headers = (matrix[0] || []).map(normalize);
            state.headers = headers;
            const modele = forced || detect(headers);
            if (!modele) throw new Error('Modèle non reconnu à partir des colonnes du fichier. Choisissez-le manuellement.');
            state.modele = modele;
            const m = MODELES[modele];

            const range = XLSX.utils.decode_range(sheet['!ref']);
            const map = {};
            const absentes = [];
            m.colonnes.forEach(function (field) {
                const idx = findColumn(headers, field);
                if (idx >= 0) map[field] = idx; else absentes.push(field);
            });

            const rows = [];
            for (let i = 1; i < matrix.length; i++) {
                const line = matrix[i] || [];
                if (!line.length || line.every(c => c === null || c === '')) continue;
                const row = { __line: i + 1 };
                Object.keys(map).forEach(function (field) {
                    const cellRef = XLSX.utils.encode_cell({ r: range.s.r + i, c: range.s.c + map[field] });
                    row[field] = convert(field, line[map[field]], sheet[cellRef]);
                });
                rows.push(row);
            }

            await validate(rows, modele);

            info.innerHTML = '<div class="note"><strong>' + TC.esc(file.name) + '</strong> — feuille « ' +
                TC.esc(sheetName) + ' », ' + rows.length.toLocaleString('fr-FR') + ' ligne(s).<br>' +
                'Modèle reconnu : <strong>' + TC.esc(m.nom) + '</strong> · écriture dans <span style="font-family:var(--mono);">' +
                m.table + '</span>' +
                (absentes.length ? '<br>Colonnes absentes du fichier, laissées vides : ' + TC.esc(absentes.join(', ')) : '') +
                '</div>';
            TC.el('imp-force').style.display = 'block';
            TC.setVal('imp-modele', modele);

        } catch (e) {
            info.innerHTML = '<div class="note err"><strong>Lecture impossible.</strong> ' + TC.esc(e.message) + '</div>';
            TC.el('imp-force').style.display = 'block';
        }
    }

    /* ── Contrôle ────────────────────────────────────────── */

    async function validate(rows, modele) {
        const m = MODELES[modele];
        const known = await TC.tickerSet();
        const seen = new Set();

        state.details = rows.map(function (row) {
            const errors = [];
            const pending = [];

            m.requis.forEach(function (field) {
                if (row[field] === null || row[field] === undefined || row[field] === '') {
                    errors.push(field + ' manquant');
                }
            });

            if (row.ticker && !/^[A-Z0-9.\-]{2,20}$/.test(row.ticker)) errors.push('ticker mal formé');
            if (row.ticker && modele !== 'entreprises' && !known.has(row.ticker) && !TC.isIndice(row.ticker)) {
                errors.push('ticker absent du référentiel');
            }
            if (m.conflit) {
                const key = m.conflit.split(',').map(f => String(row[f] || '').toUpperCase()).join('|');
                if (seen.has(key)) errors.push('doublon dans le fichier');
                seen.add(key);
            }

            if (modele === 'cours') {
                if (row.date_seance && row.date_seance > TC.today()) errors.push('séance datée dans le futur');
                if (row.cours_cloture !== null && row.cours_cloture <= 0) errors.push('clôture nulle ou négative');
                if (row.plus_haut !== null && row.plus_bas !== null && row.plus_haut < row.plus_bas) errors.push('plus haut < plus bas');
                if (row.variation !== null && Math.abs(row.variation) > TC.VARIATION_LIMIT + 0.01) {
                    pending.push('variation ' + row.variation.toFixed(2) + ' % hors limite BRVM');
                }
                if (row.variation === null) pending.push('variation absente');
            }

            if (modele === 'financials') {
                const annee = parseInt(row.annee, 10);
                if (!Number.isInteger(annee) || annee < 1990 || annee > new Date().getFullYear() + 1) errors.push('exercice invalide');
                if (!row.periode) row.periode = 'annuel';
                if (!row.source) pending.push('source non renseignée');
                if (row.fonds_propres !== null && row.total_actif !== null && row.fonds_propres > row.total_actif) {
                    errors.push('capitaux propres supérieurs au total actif');
                }
            }

            if (modele === 'dividendes') {
                if (row.montant !== null && row.montant < 0) errors.push('montant négatif');
                const detach = row.date_detachement, paiement = row.date_paiement;
                if (detach && paiement && detach > paiement) errors.push('détachement postérieur au paiement');
                if (!row.statut) row.statut = 'confirmé';
            }

            if (modele === 'indices') {
                if (row.valeur !== null && row.valeur <= 0) errors.push('valeur nulle ou négative');
                if (row.date_seance && row.date_seance > TC.today()) errors.push('séance datée dans le futur');
            }

            if (modele === 'actionnaires') {
                if (row.pourcentage !== null && (row.pourcentage < 0 || row.pourcentage > 100)) {
                    errors.push('participation hors de l\'intervalle 0–100');
                }
            }

            const remplis = m.colonnes.filter(f => row[f] !== null && row[f] !== undefined && row[f] !== '').length;
            return { row, errors, pending, completude: Math.round(remplis / m.colonnes.length * 100) };
        });

        paintPreview();
    }

    function disposition(detail) {
        if (detail.errors.length) return 'erreur';
        const decision = state.decisions[String(detail.row.__line)];
        if (decision === 'valide') return 'valide';
        if (decision === 'exclu') return 'exclu';
        return detail.pending.length ? 'attente' : 'valide';
    }

    function retained() {
        return state.details.filter(d => disposition(d) === 'valide');
    }

    function paintPreview() {
        const m = MODELES[state.modele];
        if (!m) return;
        TC.el('imp-preview-card').hidden = false;

        const good = retained().length;
        const waiting = state.details.filter(d => disposition(d) === 'attente').length;
        const bad = state.details.filter(d => disposition(d) === 'erreur').length;
        const excluded = state.details.filter(d => disposition(d) === 'exclu').length;

        TC.el('imp-preview-count').textContent = good.toLocaleString('fr-FR') + ' / ' +
            state.details.length.toLocaleString('fr-FR') + ' ligne(s) retenues';

        TC.el('imp-summary').innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:12px;">' +
            '<div><div class="kpi-label">Retenues</div><div class="kpi-value sm up">' + good + '</div></div>' +
            '<div><div class="kpi-label">En attente</div><div class="kpi-value sm" style="color:var(--orange)">' + waiting + '</div></div>' +
            '<div><div class="kpi-label">Rejetées</div><div class="kpi-value sm down">' + bad + '</div></div>' +
            '<div><div class="kpi-label">Exclues</div><div class="kpi-value sm td-muted">' + excluded + '</div></div>' +
            '</div>' +
            (bad ? '<div class="note err"><strong>' + bad + ' ligne(s) rejetées.</strong> Elles ne sont pas importables en l\'état : corrigez le fichier ou le référentiel, puis rechargez.</div>' : '') +
            (waiting ? '<div class="note warn"><strong>' + waiting + ' ligne(s) en attente de décision.</strong> Elles ne bloquent rien : validez-les pour les inclure, excluez-les pour les laisser de côté.</div>' : '');

        TC.el('imp-run').disabled = !good;

        const visible = state.details.slice(0, 250);
        TC.el('imp-preview').innerHTML = '<table><thead><tr><th>Ligne</th><th>Complétude</th>' +
            m.colonnes.map(c => '<th>' + TC.esc(c.replace(/_/g, ' ')) + '</th>').join('') +
            '<th>Contrôle</th><th>Décision</th></tr></thead><tbody>' +
            visible.map(function (d) {
                const disp = disposition(d);
                const cls = disp === 'erreur' ? 'row-flag' : disp === 'attente' ? 'row-warn' : '';
                return '<tr class="' + cls + '"><td class="td-muted">' + d.row.__line + '</td>' +
                    '<td><span class="td-mono" style="color:var(--' +
                    (d.completude === 100 ? 'green' : d.completude >= 70 ? 'gold' : 'orange') + ')">' + d.completude + ' %</span></td>' +
                    m.colonnes.map(function (c) {
                        const value = d.row[c];
                        const empty = value === null || value === undefined || value === '';
                        return '<td class="' + (empty ? 'td-muted' : (typeof value === 'number' ? 'td-mono' : '')) + '">' +
                            (empty ? '—' : TC.esc(typeof value === 'number' ? value.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : value)) + '</td>';
                    }).join('') +
                    '<td>' + (d.errors.length
                        ? '<span class="badge badge-red">' + TC.esc(d.errors.join(' · ')) + '</span>'
                        : d.pending.length
                            ? '<span class="badge badge-orange">' + TC.esc(d.pending.join(' · ')) + '</span>'
                            : '<span class="badge badge-green">conforme</span>') + '</td>' +
                    '<td style="white-space:nowrap;">' + (d.errors.length ? '—' :
                        disp === 'exclu'
                            ? '<button class="btn btn-outline btn-sm" data-approve="' + d.row.__line + '">Réintégrer</button>'
                            : disp === 'attente'
                                ? '<button class="btn btn-primary btn-sm" data-approve="' + d.row.__line + '">Valider</button> ' +
                                '<button class="btn btn-danger btn-sm" data-exclude="' + d.row.__line + '">Exclure</button>'
                                : '<button class="btn btn-outline btn-sm" data-exclude="' + d.row.__line + '">Exclure</button>') +
                    '</td></tr>';
            }).join('') + '</tbody></table>' +
            (state.details.length > 250
                ? '<div class="note" style="margin:12px 18px;">Aperçu limité aux 250 premières lignes. Les ' +
                (state.details.length - 250).toLocaleString('fr-FR') + ' suivantes suivent les mêmes règles et seront importées si elles sont conformes.</div>'
                : '');
    }

    /* ── Écriture ────────────────────────────────────────── */

    let failures = [];

    function toPayload(detail) {
        const row = Object.assign({}, detail.row);
        delete row.__line;
        if (state.modele === 'cours') {
            row.cloture = row.cours_cloture;
            row.variation_pct = row.variation;
        }
        if (state.modele === 'financials') {
            if (row.nombre_actions) row.nb_actions = row.nombre_actions;
            if (window.TC.FIN) {
                if (row.bpa === null || row.bpa === undefined) {
                    const computed = TC.FIN.bpaFrom(row);
                    if (computed !== null) row.bpa = computed;
                }
                Object.assign(row, TC.FIN.ratios(row));
            }
        }
        if (state.modele === 'dividendes') {
            row.exercice = row.annee;
            row.montant_net = row.montant;
            row.rendement = row.taux_rendement;
            row.ex_date = row.date_detachement;
        }
        if (state.modele === 'entreprises') {
            if (row.nombre_actions) row.nb_actions = row.nombre_actions;
            if (row.isin) row.code_isin = row.isin;
            row.actif = true;
        }
        return row;
    }

    function logLine(text, level) {
        const box = TC.el('imp-log');
        box.innerHTML += '<div><span class="' + (level || 'info') + '">' + TC.esc(text) + '</span></div>';
        box.scrollTop = box.scrollHeight;
    }

    async function run(details) {
        const m = MODELES[state.modele];
        const list = details || retained();
        if (!list.length) { TC.say('imp-msg', 'Aucune ligne retenue.', 'err'); return; }

        TC.el('imp-progress-card').hidden = false;
        TC.el('imp-log').innerHTML = '';
        TC.el('imp-retry').hidden = true;
        TC.el('imp-run').disabled = true;
        TC.say('imp-msg', 'Écriture en cours…', 'info');
        logLine('Cible : table ' + m.table + (m.conflit ? ' · clé ' + m.conflit : ' · sans clé d\'unicité'), 'info');

        const payload = list.map(toPayload);
        const result = await TC.postBatched(m.table, payload, m.conflit, function (p) {
            const pct = Math.round(p.done / p.total * 100);
            TC.el('imp-bar').style.width = pct + '%';
            TC.el('imp-pct').textContent = pct + ' %';
            logLine(p.ok
                ? 'Lot ' + p.batch + ' : ' + p.size.toLocaleString('fr-FR') + ' ligne(s) écrites'
                : 'Lot ' + p.batch + ' en échec après trois tentatives — ' + p.error,
                p.ok ? 'ok' : 'err');
        });

        failures = result.failures;
        TC.el('imp-run').disabled = false;

        if (failures.length) {
            const lost = failures.reduce((s, f) => s + f.rows.length, 0);
            TC.say('imp-msg', result.imported.toLocaleString('fr-FR') + ' ligne(s) importées · ' +
                lost.toLocaleString('fr-FR') + ' ligne(s) en échec.', 'err');
            logLine('Motif du premier échec : ' + failures[0].error, 'err');
            TC.el('imp-retry').hidden = false;
        } else {
            TC.say('imp-msg', result.imported.toLocaleString('fr-FR') + ' ligne(s) importées avec succès.', 'ok');
            logLine('Import terminé sans échec.', 'ok');
            TC.toast('Import terminé : ' + result.imported + ' lignes', 'ok');
            TC.health.probe();
            TC.invalidateTickers();
        }
    }

    TC.register({
        id: 'import',
        label: 'Import Excel',
        group: 'gestion',
        icon: '▥',
        keywords: 'import excel xlsx csv modele masse chargement',
        view,
        mount() {
            TC.delegate('panel-import', '[data-tpl]', 'click', node => downloadTemplate(node.dataset.tpl));

            const drop = TC.el('imp-drop');
            const input = TC.el('imp-file');
            drop.addEventListener('click', () => input.click());
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
            drop.addEventListener('drop', e => {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) read(file, '');
            });
            input.addEventListener('change', e => {
                const file = e.target.files && e.target.files[0];
                if (file) read(file, '');
            });

            TC.on('imp-modele', 'change', function (e) {
                if (state.file) read(state.file, e.target.value);
            });

            TC.delegate('imp-preview', '[data-approve]', 'click', function (node) {
                state.decisions[node.dataset.approve] = 'valide';
                paintPreview();
            });
            TC.delegate('imp-preview', '[data-exclude]', 'click', function (node) {
                state.decisions[node.dataset.exclude] = 'exclu';
                paintPreview();
            });
            TC.on('imp-approve-all', 'click', function () {
                state.details.forEach(d => {
                    if (disposition(d) === 'attente') state.decisions[String(d.row.__line)] = 'valide';
                });
                paintPreview();
            });
            TC.on('imp-run', 'click', () => run());
            TC.on('imp-retry', 'click', function () {
                if (!failures.length) return;
                const rows = failures.reduce((acc, f) => acc.concat(f.rows.map(r => ({ row: r }))), []);
                /* Les lignes en échec sont déjà au format d'écriture. */
                const m = MODELES[state.modele];
                TC.el('imp-retry').hidden = true;
                TC.postBatched(m.table, rows.map(x => x.row), m.conflit, function (p) {
                    const pct = Math.round(p.done / p.total * 100);
                    TC.el('imp-bar').style.width = pct + '%';
                    TC.el('imp-pct').textContent = pct + ' %';
                    logLine('Reprise — lot ' + p.batch + ' : ' + (p.ok ? p.size + ' ligne(s)' : 'échec ' + p.error), p.ok ? 'ok' : 'err');
                }).then(function (result) {
                    failures = result.failures;
                    if (failures.length) {
                        TC.say('imp-msg', 'Reprise partielle : ' + result.imported + ' importées, ' + failures.length + ' lot(s) restants.', 'err');
                        TC.el('imp-retry').hidden = false;
                    } else {
                        TC.say('imp-msg', 'Tous les lots ont été repris.', 'ok');
                    }
                });
            });
            TC.on('imp-cancel', 'click', function () {
                state.file = null; state.details = []; state.decisions = {}; state.modele = '';
                TC.el('imp-preview-card').hidden = true;
                TC.el('imp-progress-card').hidden = true;
                TC.el('imp-file-info').innerHTML = '';
                TC.el('imp-force').style.display = 'none';
                TC.el('imp-file').value = '';
                TC.say('imp-msg', '');
            });
        }
    });

})(window.TC);
