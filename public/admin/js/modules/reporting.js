/* ============================================================
   THE CAPITAL — REPORTING
   Remplace l'ancien générateur « Séance en 1 minute », qui ne
   savait produire qu'une seule période et injectait lui-même son
   onglet dans le menu.

   Cinq périodes partagent le même moteur : séance, semaine, mois,
   trimestre, année. Ce qui change d'une période à l'autre, ce
   n'est pas la mise en page mais l'agrégation — sur une séance on
   lit une variation, sur un trimestre on la compose.

   La sortie est un SVG : il s'exporte en PNG et en JPEG pour les
   réseaux, et reste net à toute taille pour l'impression.

   Refonte visuelle : un seul système d'icônes en trait fin
   (currentColor), badges d'en-tête, tendance chiffrée sur les
   indices, répartition sectorielle, avatars sur les palmarès,
   pied de page complet. Le canevas ne tronque plus jamais un
   tableau — s'il déborde du format choisi après compression, la
   hauteur s'ajuste au contenu réel plutôt que de couper une ligne.
   ============================================================ */
'use strict';

(function (TC) {

    /* Palette « papier et encre ». `cream` reste la clé du texte principal
       (anciens appels) et porte l'encre. */
    const C = {
        bg: '#F3EDE1', panel: '#E9E1D0', line: '#D8CDB7',
        cream: '#17130E', ink: '#17130E', ink2: '#4B4337',
        gold: '#9A7021', goldBright: '#B8893A', goldLight: '#A9884A',
        muted: '#877B68', flatCell: '#B5AB98', green: '#1D6A45', red: '#AD2D22'
    };

    const FORMATS = [
        { v: '1080x1350', l: 'Publication — 1080 × 1350' },
        { v: '1080x1920', l: 'Story — 1080 × 1920' },
        { v: '1080x1080', l: 'Carré — 1080 × 1080' },
        { v: '1200x1700', l: 'Impression — 1200 × 1700' }
    ];

    const PERIODES = [
        { v: 'seance', l: 'Séance', titre: 'La séance en une minute', rubrique: 'La séance du jour' },
        { v: 'hebdo', l: 'Semaine', titre: 'La semaine boursière', rubrique: 'Bilan de la semaine' },
        { v: 'mensuel', l: 'Mois', titre: 'Le mois boursier', rubrique: 'Bilan du mois' },
        { v: 'trimestre', l: 'Trimestre', titre: 'Le trimestre boursier', rubrique: 'Bilan du trimestre' },
        { v: 'annuel', l: 'Année', titre: "L'année boursière", rubrique: "Bilan de l'année" }
    ];

    const BLOCS = [
        { id: 'note', l: 'Analyse de la séance (2-3 phrases)' },
        { id: 'activite', l: 'Activité du marché' },
        { id: 'indices', l: 'Indices de marché (tendance + YTD)' },
        { id: 'chiffres', l: 'Marché en chiffres (actions, obligataire, secteurs)' },
        { id: 'hausses', l: 'Plus fortes hausses' },
        { id: 'baisses', l: 'Plus fortes baisses' },
        { id: 'volumes', l: 'Plus forte activité (valeurs échangées)' },
        { id: 'obligataire', l: 'Marché obligataire — détail' },
        { id: 'dividendes', l: 'Dividendes à venir' }
    ];

    /* Aperçu « Réseaux sociaux » : un sous-ensemble volontairement court
       (titre, analyse, activité, indices, hausses, baisses) pour tenir dans
       un format Instagram/LinkedIn/TikTok sans faire grandir le canevas —
       les sections secondaires (chiffres, secteurs, obligataire,
       dividendes) restent réservées au bulletin complet, pensé pour la
       page publique ou l'impression. Le format Impression (1200×1700) n'a
       pas sa place dans ce mode. */
    const LEAN_BLOCS = ['note', 'activite', 'indices', 'hausses', 'baisses'];
    const SOCIAL_FORMATS = FORMATS.filter(f => f.v !== '1200x1700');

    /* Parité fixe UEMOA / zone euro — un fait réglementaire, pas une
       estimation. Inchangée depuis 1999 (accord de coopération monétaire). */
    const XOF_PER_EUR = 655.957;

    /* Fenêtre de cotation usuelle BRVM (heure d'Abidjan = GMT, sans heure
       d'été). Sert uniquement à teinter le badge de statut sur un reporting
       de séance généré le jour même ; n'affecte aucun chiffre publié. */
    const SESSION_OPEN_H = 9, SESSION_CLOSE_H = 15.25;

    let logoData = null;
    let report = null;

    /* ── Vue ─────────────────────────────────────────────── */

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Reporting <em>de marché</em></div>' +
            '<div class="page-sub">Produit une synthèse publiable à partir des données réellement en base. Cinq horizons : la séance, la semaine, le mois, le trimestre et l\'année. Aucun chiffre n\'est estimé — une période sans données le dit.</div></div>' +
            '</div>' +

            '<div class="report-layout">' +

            '<div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Période</span></div>' +
            '<div class="card-body">' +
            '<div class="subtabs" id="rep-periodes">' +
            PERIODES.map((p, i) => '<button class="subtab' + (i === 0 ? ' active' : '') +
                '" data-periode="' + p.v + '">' + p.l + '</button>').join('') + '</div>' +
            '<div class="form-grid" style="padding:0;grid-template-columns:1fr 1fr;gap:12px;">' +
            TC.field({ id: 'rep-date', label: 'Date de référence', type: 'date' }) +
            TC.field({ id: 'rep-format', label: 'Format', type: 'select', options: FORMATS }) +
            '</div>' +
            '<div class="note" id="rep-window" style="margin-top:12px;"></div>' +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Contenu</span></div>' +
            '<div class="card-body">' +
            '<div class="subtabs" id="rep-mode">' +
            '<button class="subtab active" data-mode="complet">Bulletin complet</button>' +
            '<button class="subtab" data-mode="social">Réseaux sociaux</button>' +
            '</div>' +
            '<div class="note" id="rep-mode-note" style="margin:10px 0 14px;">Toutes les sections — pensé pour la page publique et l\'impression.</div>' +
            '<div class="toggle-list" id="rep-blocs">' +
            BLOCS.map(b => '<label class="toggle on"><input type="checkbox" data-bloc="' + b.id + '" checked>' +
                TC.esc(b.l) + '</label>').join('') + '</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Habillage</span></div>' +
            '<div class="form-grid" style="grid-template-columns:1fr 1fr;">' +
            TC.field({ id: 'rep-surtitre', label: 'Surtitre', placeholder: 'BRVM · Abidjan' }) +
            TC.field({ id: 'rep-bulletin', label: 'Édition / référence', placeholder: 'Édition n° 247' }) +
            TC.field({ id: 'rep-heure', label: 'Heure de clôture (optionnel)', placeholder: '16h05 GMT' }) +
            '</div>' +
            '<div class="form-grid" style="grid-template-columns:1fr;">' +
            TC.field({ id: 'rep-note', label: 'Commentaire éditorial (remplace l\'analyse automatique)', type: 'textarea', rows: 4, placeholder: 'Une lecture en trois phrases : ce qui a porté le marché, ce qui l\'a freiné, ce qu\'il faut surveiller. Laissez vide pour une analyse générée à partir des chiffres réels de la séance.' }) +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Production</span></div>' +
            '<div class="card-body"><div class="btn-row">' +
            '<button class="btn btn-primary" id="rep-build">Générer le reporting</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-png" disabled>⬇ PNG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-jpg" disabled>⬇ JPEG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-svg" disabled>⬇ SVG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-csv" disabled>⬇ Données (CSV)</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-publish" disabled>↑ Publier sur le site</button>' +
            '</div><div class="msg" id="rep-msg" style="margin-top:12px;"></div></div></div>' +
            '</div>' +

            '<div>' +
            '<div class="card"><div class="card-head"><span class="card-title">Aperçu</span>' +
            '<span class="card-tools"><span class="card-count" id="rep-dims"></span></span></div>' +
            '<div class="report-stage" id="rep-stage">' +
            '<div class="empty-state"><strong>Aucun reporting généré</strong>' +
            'Choisissez une période et une date, puis lancez la génération. L\'aperçu est exactement ce qui sera exporté.</div>' +
            '</div></div>' +
            '<div class="card" id="rep-table-card" hidden><div class="card-head"><span class="card-title">Données de la période</span></div>' +
            '<div class="tw capped" id="rep-table"></div></div>' +
            '</div>' +

            '</div>';
    }

    /* ── Fenêtre temporelle ──────────────────────────────── */

    function windowFor(periode, ref) {
        const d = new Date(ref + 'T12:00:00');
        let from, to, label;
        if (periode === 'seance') {
            from = to = ref;
            label = TC.fmtDateLong(ref);
        } else if (periode === 'hebdo') {
            const day = d.getDay() === 0 ? 7 : d.getDay();
            from = TC.shiftDays(ref, -(day - 1));
            to = TC.shiftDays(from, 6);
            label = 'Du ' + TC.fmtDate(from) + ' au ' + TC.fmtDate(to);
        } else if (periode === 'mensuel') {
            from = ref.slice(0, 8) + '01';
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            to = end.toISOString().slice(0, 10);
            label = new Date(from + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else if (periode === 'trimestre') {
            const q = Math.floor(d.getMonth() / 3);
            from = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
            to = new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
            label = 'T' + (q + 1) + ' ' + d.getFullYear();
        } else {
            from = d.getFullYear() + '-01-01';
            to = d.getFullYear() + '-12-31';
            label = 'Année ' + d.getFullYear();
        }
        if (to > TC.today()) to = TC.today();
        return { from, to, label, periode };
    }

    function paintWindow() {
        const periode = TC.qs('#rep-periodes .subtab.active').dataset.periode;
        const ref = TC.val('rep-date') || TC.today();
        const w = windowFor(periode, ref);
        TC.el('rep-window').innerHTML = '<strong>' + TC.esc(w.label) + '</strong>' +
            (periode === 'seance'
                ? ' — une seule séance. La variation lue est celle publiée pour cette date.'
                : ' — du ' + TC.fmtDate(w.from) + ' au ' + TC.fmtDate(w.to) +
                '. La performance est composée entre la première et la dernière clôture de la période.');
    }

    /* Bascule Bulletin complet / Réseaux sociaux : coche le bon sous-ensemble
       de sections et restreint le choix de format en conséquence, pour que
       l'export social tienne dans son cadre sans dépendre du filet de
       sécurité (qui, lui, reste correct mais fait grandir le canevas). */
    function applyMode(mode) {
        const lean = mode === 'social';
        TC.qsa('#rep-blocs input[data-bloc]').forEach(function (cb) {
            const on = !lean || LEAN_BLOCS.indexOf(cb.dataset.bloc) !== -1;
            cb.checked = on;
            cb.closest('.toggle').classList.toggle('on', on);
        });
        const sel = TC.el('rep-format');
        const list = lean ? SOCIAL_FORMATS : FORMATS;
        const current = sel.value;
        sel.innerHTML = list.map(o => '<option value="' + o.v + '">' + TC.esc(o.l) + '</option>').join('');
        sel.value = list.some(o => o.v === current) ? current : list[0].v;
        TC.el('rep-mode-note').textContent = lean
            ? 'Titre, analyse, activité, indices, hausses et baisses — pensé pour tenir dans un seul écran Instagram/LinkedIn/TikTok. Le format Impression est masqué.'
            : 'Toutes les sections — pensé pour la page publique et l\'impression.';
    }

    /* ── Agrégation ──────────────────────────────────────── */

    async function collect(w) {
        const [quotes, indices, refs] = await Promise.all([
            TC.getAll('historique',
                'select=ticker,date_seance,cours_cloture,cloture,cours_ouverture,volume,variation,valeur_totale' +
                '&date_seance=gte.' + w.from + '&date_seance=lte.' + w.to + '&order=date_seance.asc'),
            TC.getAll('indices',
                'select=indice,date_seance,valeur,variation_pct&date_seance=gte.' + w.from +
                '&date_seance=lte.' + w.to + '&order=date_seance.asc'),
            TC.tickers()
        ]);

        const names = {}, secteurs = {};
        refs.forEach(r => {
            const k = String(r.ticker).toUpperCase();
            names[k] = r.nom || '';
            secteurs[k] = r.secteur || '';
        });

        const close = r => TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        const rows = (quotes || []).filter(r => !TC.isIndice(r.ticker) && close(r) !== null);

        if (!rows.length) return null;

        const sessions = Array.from(new Set(rows.map(r => r.date_seance))).sort();

        /* Par valeur : première et dernière clôture de la fenêtre. */
        const byTicker = {};
        rows.forEach(function (r) {
            const key = String(r.ticker).toUpperCase();
            const entry = byTicker[key] || (byTicker[key] = {
                ticker: r.ticker, nom: names[key] || '', secteur: secteurs[key] || '',
                first: null, last: null, firstDate: null, lastDate: null,
                volume: 0, valeur: 0, seances: 0, haut: null, bas: null
            });
            const c = close(r);
            if (entry.first === null) { entry.first = c; entry.firstDate = r.date_seance; }
            entry.last = c; entry.lastDate = r.date_seance;
            entry.volume += TC.toNumber(r.volume) || 0;
            entry.valeur += TC.toNumber(r.valeur_totale) || 0;
            entry.seances++;
            entry.haut = entry.haut === null ? c : Math.max(entry.haut, c);
            entry.bas = entry.bas === null ? c : Math.min(entry.bas, c);
            if (w.periode === 'seance') entry.published = TC.toNumber(r.variation);
        });

        const values = Object.keys(byTicker).map(function (key) {
            const e = byTicker[key];
            /* Sur une séance, la variation publiée fait foi : c'est celle du
               bulletin. Sur une période plus longue, elle se compose. */
            if (w.periode === 'seance' && e.published !== null && e.published !== undefined) {
                e.perf = e.published;
            } else if (w.periode === 'seance') {
                e.perf = null;
            } else if (e.first && e.first > 0 && e.last !== null) {
                /* La première clôture de la fenêtre est déjà le résultat d'une
                   séance : le point de départ correct est la clôture qui la
                   précède. On l'ajoute plus bas quand elle est disponible. */
                e.perf = ((e.last - e.first) / e.first) * 100;
            } else e.perf = null;
            return e;
        });

        /* Point de départ réel : dernière clôture avant la fenêtre. */
        if (w.periode !== 'seance') {
            const before = await TC.getAll('historique',
                'select=ticker,date_seance,cours_cloture,cloture&date_seance=lt.' + w.from +
                '&date_seance=gte.' + TC.shiftDays(w.from, -20) + '&order=date_seance.asc');
            const base = {};
            (before || []).forEach(r => { base[String(r.ticker).toUpperCase()] = close(r); });
            values.forEach(function (e) {
                const start = base[String(e.ticker).toUpperCase()];
                if (start && start > 0 && e.last !== null) {
                    e.base = start;
                    e.perf = ((e.last - start) / start) * 100;
                }
            });
        }

        const rated = values.filter(e => e.perf !== null);
        const up = rated.filter(e => e.perf > 0).length;
        const down = rated.filter(e => e.perf < 0).length;
        const flat = rated.length - up - down;

        /* Indices : première et dernière valeur de la période. */
        const idxMap = {};
        (indices || []).forEach(function (r) {
            const key = String(r.indice || '').toUpperCase();
            const e = idxMap[key] || (idxMap[key] = { indice: r.indice, first: null, last: null, lastPct: null });
            const value = TC.toNumber(r.valeur);
            if (value === null) return;
            if (e.first === null) e.first = value;
            e.last = value;
            e.lastPct = TC.toNumber(r.variation_pct);
        });
        const idxList = Object.keys(idxMap).map(function (key) {
            const e = idxMap[key];
            e.perf = w.periode === 'seance'
                ? e.lastPct
                : (e.first && e.first > 0 ? ((e.last - e.first) / e.first) * 100 : null);
            return e;
        }).filter(e => e.last !== null)
            .sort((a, b) => {
                const rank = x => x.indice.indexOf('COMPOSITE') >= 0 ? 0 : x.indice.indexOf('30') >= 0 ? 1 : x.indice.indexOf('PRESTIGE') >= 0 ? 2 : 3;
                return rank(a) - rank(b) || a.indice.localeCompare(b.indice);
            });

        /* ── Données complémentaires : obligations, dividendes, ratios ──
           Petites tables, toujours lues ; un bloc sans données est masqué,
           jamais estimé. */
        const [obl, oblM, fin, divs] = await Promise.all([
            TC.getAll('obligations', 'select=code,nom,cours,coupon_couru,taux_facial,date_maturite&order=cours.desc&limit=2000').catch(() => []),
            TC.getAll('obligations_marche', 'select=date_seance,valeur_transactions,capitalisation_actions,capitalisation_obligations,nb_lignes&order=date_seance.desc&limit=8').catch(() => []),
            TC.getAll('financials', 'select=ticker,annee,bpa,dpa,dividend_yield,roe,validation_status&order=annee.desc&limit=2000').catch(() => []),
            TC.getAll('dividendes_calendrier', 'select=ticker,montant_net,montant,taux_rendement,rendement,date_detachement,date_paiement&order=date_detachement.asc&limit=800').catch(() => [])
        ]);

        const median = a => { const x = a.filter(v => isFinite(v)).sort((m, n) => m - n); if (!x.length) return null; const i = Math.floor(x.length / 2); return x.length % 2 ? x[i] : (x[i - 1] + x[i]) / 2; };

        const oblSnap = (oblM || []).filter(r => !r.date_seance || r.date_seance <= w.to)[0] || (oblM || [])[0] || null;
        const oblRows = (obl || []).filter(r => TC.toNumber(r.cours) !== null);

        const finByT = {};
        (fin || []).forEach(function (r) {
            const k = String(r.ticker || '').toUpperCase();
            if (!k) return;
            if (!finByT[k] || Number(r.annee) > Number(finByT[k].annee)) finByT[k] = r;
        });
        /* Dernier dividende NET connu par titre (méthode BRVM : l'IRVM est retenu
           à la source, le rendement de marché se lit net) — divs est trié par
           date_detachement croissante, donc une simple écrasement conserve la
           plus récente occurrence de chaque ticker. */
        const netDivByT = {};
        (divs || []).forEach(function (d) {
            const k = String(d.ticker || '').toUpperCase();
            const v = TC.toNumber(d.montant_net != null ? d.montant_net : d.montant);
            if (k && v !== null) netDivByT[k] = v;
        });
        const perList = [], yldList = [], roeList = [];
        values.forEach(function (e) {
            const f = finByT[String(e.ticker).toUpperCase()];
            if (!f) return;
            const bpa = TC.toNumber(f.bpa);
            if (bpa && bpa > 0 && e.last) perList.push(e.last / bpa);
            // Toujours recalculé sur le cours de la période plutôt que lu dans la
            // colonne stockée (figée au jour de sa saisie) : seule cette colonne
            // sert de repli, quand ni le calendrier ni le cours ne permettent un calcul en direct.
            const netDiv = netDivByT[String(e.ticker).toUpperCase()];
            let y = null;
            if (netDiv && e.last) y = (netDiv / e.last) * 100;
            else {
                y = TC.toNumber(f.dividend_yield);
                if (y !== null && y <= 1.5) y *= 100;
            }
            if (y !== null && y > 0) yldList.push(y);
            let roe = TC.toNumber(f.roe);
            if (roe !== null && roe <= 1.5) roe *= 100;
            if (roe !== null) roeList.push(roe);
        });

        const dividendesAVenir = (divs || [])
            .map(function (d) {
                return {
                    ticker: d.ticker,
                    nom: names[String(d.ticker || '').toUpperCase()] || '',
                    montant: TC.toNumber(d.montant_net != null ? d.montant_net : d.montant),
                    rdt: TC.toNumber(d.taux_rendement != null ? d.taux_rendement : d.rendement),
                    detach: d.date_detachement, paiement: d.date_paiement
                };
            })
            .filter(d => d.detach && String(d.detach) >= w.to)
            .sort((a, b) => String(a.detach).localeCompare(String(b.detach)))
            .slice(0, 6);

        /* Indices : performance depuis le 1er janvier + historique court pour
           une mini-tendance (5 dernières séances connues avant/à la date de
           référence). Une seule requête pour les deux besoins. */
        const yearStart = w.to.slice(0, 4) + '-01-01';
        let ytdMap = {};
        const histByIdx = {};
        try {
            const idxYtd = await TC.getAll('indices',
                'select=indice,date_seance,valeur&date_seance=gte.' + yearStart + '&date_seance=lte.' + w.to + '&order=date_seance.asc&limit=4000');
            (idxYtd || []).forEach(function (r) {
                const k = String(r.indice || '').toUpperCase();
                if (ytdMap[k] === undefined) ytdMap[k] = TC.toNumber(r.valeur);
                const v = TC.toNumber(r.valeur);
                if (v !== null) (histByIdx[k] = histByIdx[k] || []).push(v);
            });
        } catch (e) { ytdMap = {}; }
        idxList.forEach(function (e) {
            const k = String(e.indice || '').toUpperCase();
            const base = ytdMap[k];
            e.ytd = (base && base > 0 && e.last) ? ((e.last - base) / base) * 100 : null;
            e.spark = (histByIdx[k] || []).slice(-5);
        });

        /* ── Répartition sectorielle : réelle, tirée du référentiel
           entreprises (secteur), pondérée par la valeur échangée sur la
           fenêtre. Masquée si le référentiel est trop lacunaire. */
        const secteurMap = {};
        let secteurTotal = 0;
        values.forEach(function (e) {
            const s = (e.secteur || '').trim();
            if (!s || !(e.valeur > 0)) return;
            secteurMap[s] = (secteurMap[s] || 0) + e.valeur;
            secteurTotal += e.valeur;
        });
        let secteurs2 = Object.keys(secteurMap).map(s => ({ nom: s, valeur: secteurMap[s] }))
            .sort((a, b) => b.valeur - a.valeur);
        if (secteurTotal > 0 && secteurs2.length > 6) {
            const top = secteurs2.slice(0, 5);
            const autres = secteurs2.slice(5).reduce((s, x) => s + x.valeur, 0);
            secteurs2 = top.concat([{ nom: 'Autres secteurs', valeur: autres }]);
        }
        secteurs2.forEach(s => { s.pct = secteurTotal > 0 ? (s.valeur / secteurTotal) * 100 : 0; });

        const chiffres = {
            titresCotes: values.length,
            societesCotees: (refs || []).length || values.length,
            lignesObligataires: (oblSnap && oblSnap.nb_lignes) ? oblSnap.nb_lignes : (oblRows.length || null),
            capiActions: oblSnap ? TC.toNumber(oblSnap.capitalisation_actions) : null,
            capiObligations: oblSnap ? TC.toNumber(oblSnap.capitalisation_obligations) : null,
            valeurTransactions: oblSnap ? TC.toNumber(oblSnap.valeur_transactions) : null,
            perMedian: median(perList),
            rdtMedian: median(yldList),
            roeMedian: median(roeList)
        };
        const obligataire = {
            snapshot: oblSnap,
            lignes: oblRows.length,
            top: oblRows.slice(0, 5),
            tauxMoyen: median(oblRows.map(r => TC.toNumber(r.taux_facial)).filter(v => v && v > 0))
        };

        return {
            window: w,
            sessions,
            values,
            indices: idxList,
            secteurs: secteurs2,
            dividendesAVenir,
            chiffres,
            obligataire,
            /* Un palmarès des baisses qui contient des hausses n'est pas un
               palmarès : sur une séance étroite, il vaut mieux trois lignes
               que cinq lignes fausses. */
            hausses: rated.filter(e => e.perf > 0).sort((a, b) => b.perf - a.perf).slice(0, 5),
            baisses: rated.filter(e => e.perf < 0).sort((a, b) => a.perf - b.perf).slice(0, 5),
            volumes: values.filter(e => e.valeur > 0).sort((a, b) => b.valeur - a.valeur).slice(0, 5),
            totals: {
                titres: values.length, up, down, flat,
                volume: values.reduce((s, e) => s + e.volume, 0),
                valeur: values.reduce((s, e) => s + e.valeur, 0),
                seances: sessions.length
            }
        };
    }

    /* ── Rendu SVG ───────────────────────────────────────── */

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function money(n) {
        const value = TC.toNumber(n);
        if (value === null) return '—';
        if (Math.abs(value) >= 1e9) return (value / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
        if (Math.abs(value) >= 1e6) return (value / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
        return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    }

    function pct(n) {
        const value = TC.toNumber(n);
        if (value === null) return '—';
        return (value >= 0 ? '+' : '') + value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    }

    /* Statut de marché, purement indicatif : ne s'affiche que pour un
       reporting de séance généré à la date du jour. N'influence aucune
       donnée publiée — un simple repère visuel sur l'heure habituelle de
       cotation à la BRVM (9h–15h15, heure d'Abidjan = GMT). */
    function marketStatus(w) {
        if (w.periode !== 'seance' || w.to !== TC.today()) return null;
        const now = new Date();
        const h = now.getUTCHours() + now.getUTCMinutes() / 60;
        const open = h >= SESSION_OPEN_H && h < SESSION_CLOSE_H;
        return { label: open ? 'MARCHÉ OUVERT' : 'MARCHÉ CLÔTURÉ', open };
    }

    /* Analyse générée à partir des chiffres réels de la période — sert de
       repli quand aucun commentaire éditorial n'est saisi. Jamais de
       chiffre inventé : uniquement ce qui est déjà agrégé dans `data`. */
    function autoNote(data) {
        const t = data.totals;
        const compo = data.indices.find(i => /COMPOSITE/.test(i.indice || '')) || data.indices[0];
        const parts = [];
        if (compo && compo.perf !== null && compo.perf !== undefined) {
            parts.push(compo.indice + ' ' + (compo.perf >= 0 ? 'progresse' : 'recule') + ' de ' +
                pct(Math.abs(compo.perf)).replace('+', '') + ' à ' +
                compo.last.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' points.');
        }
        parts.push(t.up + ' valeur' + (t.up > 1 ? 's' : '') + ' en hausse contre ' + t.down +
            ' en baisse sur ' + t.titres + ' titres cotés' + (t.flat ? ' (' + t.flat + ' stable' + (t.flat > 1 ? 's' : '') + ')' : '') + '.');
        const vol = data.volumes[0];
        if (vol) parts.push('Titre le plus actif : ' + vol.ticker + ' avec ' + money(vol.valeur) + ' F échangés.');
        return parts.join(' ');
    }

    /* ── Charte « cote du jour » ─────────────────────────────
       Une page de quotidien financier : papier chaud, encre, filets,
       titre en serif (Newsreader), chiffres en colonnes (IBM Plex Mono),
       libellés en Plex Sans Condensed. Pas de pastilles, d'avatars ni de
       dégradés ; la couleur ne porte que le sens (hausse / baisse) et la
       marque (ocre). Les polices sont embarquées dans le SVG (voir
       loadFonts) : l'export PNG/JPEG est identique à l'aperçu. */
    const F = {
        serif: "'TC Serif',Georgia,serif",
        mono: "'TC Mono','Courier New',monospace",
        sans: "'TC Sans','Arial Narrow',sans-serif"
    };

    /* Triangle de sens, calé sur la ligne de base d'un texte de taille fs. */
    function tri(v, x, y, fs) {
        const s = Math.round(fs * 0.55), top = y - fs * 0.62;
        if (v > 0) return '<polygon points="' + (x + s / 2) + ',' + top + ' ' + (x + s) + ',' + (top + s * 0.9) + ' ' + x + ',' + (top + s * 0.9) + '" fill="' + C.green + '"/>';
        if (v < 0) return '<polygon points="' + x + ',' + top + ' ' + (x + s) + ',' + top + ' ' + (x + s / 2) + ',' + (top + s * 0.9) + '" fill="' + C.red + '"/>';
        return '<rect x="' + x + '" y="' + (top + s * 0.35) + '" width="' + s + '" height="' + Math.max(2, s * 0.22) + '" fill="' + C.muted + '"/>';
    }

    /* Mini-tendance à l'encre, point final ocre. */
    function sparkline(x1, x2, yBase, height, values) {
        const v = (values || []).filter(n => n !== null && n !== undefined && isFinite(n));
        if (v.length < 2) return '';
        const min = Math.min.apply(null, v), max = Math.max.apply(null, v);
        const span = (max - min) || Math.abs(max) || 1;
        const pts = v.map(function (val, i) {
            return (x1 + (x2 - x1) * (i / (v.length - 1))).toFixed(1) + ',' + (yBase - ((val - min) / span) * height).toFixed(1);
        }).join(' ');
        const lastY = yBase - ((v[v.length - 1] - min) / span) * height;
        return '<polyline points="' + pts + '" fill="none" stroke="' + C.ink + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle cx="' + x2.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="' + C.gold + '"/>';
    }

    function wrap(source, width) {
        const words = String(source).replace(/\s+/g, ' ').trim().split(' ');
        const lines = [];
        let line = '';
        words.forEach(function (word) {
            if ((line + ' ' + word).trim().length > width) { lines.push(line.trim()); line = word; }
            else line += ' ' + word;
        });
        if (line.trim()) lines.push(line.trim());
        return lines;
    }

    /* Nom lisible : sans « Côte d'Ivoire » (le pays par défaut ; les autres
       distinguent BOA Burkina de BOA Bénin), coupé au mot avec une ellipse. */
    function nomCourt(nom, max) {
        let n = String(nom || '').replace(/\s+(COTE D'IVOIRE|CÔTE D'IVOIRE|CI)$/i, '').trim();
        if (n.length <= max) return n;
        n = n.slice(0, max - 1);
        return n.slice(0, Math.max(n.lastIndexOf(' '), max * 0.6)).trim() + '…';
    }

    /* Titre de une, tiré des chiffres de la période (jamais inventé). */
    function headline(data) {
        const compo = data.indices.find(i => /COMPOSITE/.test(i.indice || '')) || data.indices[0];
        const quand = { seance: 'en séance', hebdo: 'sur la semaine', mensuel: 'sur le mois', trimestre: 'sur le trimestre', annuel: 'sur l\'année' }[data.window.periode] || '';
        if (!compo || compo.perf == null) return PERIODES.find(p => p.v === data.window.periode).titre;
        const p = TC.toNumber(compo.perf);
        if (Math.abs(p) < 0.05) return 'La BRVM est stable ' + quand;
        return 'La BRVM ' + (p > 0 ? 'progresse' : 'recule') + ' de ' +
            Math.abs(p).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' % ' + quand;
    }

    function build(data, options) {
        const [W, H0] = options.format.split('x').map(Number);
        let H = H0;
        const pad = Math.round(W * 0.062);
        const inner = W - pad * 2;
        /* Facteur d'aération : un reporting court sur un format Story laisserait
           la moitié de l'image vide. La seconde passe l'étire pour occuper la
           hauteur réellement disponible. */
        const G = options.gap || 1;
        const g = n => Math.round(n * G);
        let y = 0;
        const parts = [];

        const text = (content, x, ty, opts) => {
            const o = opts || {};
            return '<text x="' + x + '" y="' + ty + '" fill="' + (o.fill || C.ink) + '" ' +
                'font-family="' + (o.family || F.sans) + '" ' +
                'font-size="' + (o.size || 18) + '" font-weight="' + (o.weight || 400) + '" ' +
                (o.anchor ? 'text-anchor="' + o.anchor + '" ' : '') +
                (o.spacing ? 'letter-spacing="' + o.spacing + '" ' : '') +
                (o.style ? 'font-style="' + o.style + '" ' : '') +
                '>' + esc(content) + '</text>';
        };
        const label = (s, x, ty, o) => text(String(s).toUpperCase(), x, ty, Object.assign({ size: 11, fill: C.muted, spacing: 1.4, weight: 600 }, o || {}));
        const num = (s, x, ty, o) => text(s, x, ty, Object.assign({ family: F.mono, size: 15, anchor: 'end' }, o || {}));
        const line = (x1, ty, x2, w, color, op) => '<line x1="' + x1 + '" y1="' + ty + '" x2="' + x2 + '" y2="' + ty +
            '" stroke="' + (color || C.ink) + '" stroke-opacity="' + (op == null ? 1 : op) + '" stroke-width="' + (w || 1) + '"/>';
        const hair = (ty, x1, x2) => line(x1 != null ? x1 : pad, ty, x2 != null ? x2 : W - pad, 1, C.ink, 0.16);
        const signe = v => TC.toNumber(v) > 0 ? C.green : TC.toNumber(v) < 0 ? C.red : C.muted;
        const variation = (v, x2, ty, fs, weight) => {
            const s = pct(v);
            const w = s.length * fs * 0.6;
            return tri(TC.toNumber(v), x2 - w - fs * 0.95, ty, fs) +
                num(s, x2, ty, { size: fs, fill: signe(v), weight: weight || 600 });
        };

        /* Format court (réseaux sociaux) : pas de détail sous chaque valeur,
           lignes plus serrées, pour tenir dans le format du post. */
        const compact = !options.blocs.chiffres && !options.blocs.volumes;
        const pas = compact ? 32 : 38;

        /* Rubrique numérotée : gros filet noir, numéro ocre, intitulé. */
        let nRub = 0;
        const rubrique = function (titre, x, width, droite) {
            nRub++;
            parts.push('<rect x="' + x + '" y="' + y + '" width="' + width + '" height="3.5" fill="' + C.ink + '"/>');
            const ty = y + 24;
            parts.push(text(String(nRub).padStart(2, '0'), x, ty, { family: F.mono, size: 13, fill: C.gold, weight: 600 }));
            parts.push(label(titre, x + 28, ty, { size: 13, fill: C.ink, spacing: 1.8 }));
            if (droite) parts.push(label(droite, x + width, ty, { anchor: 'end' }));
            return ty + g(30);
        };

        /* — Fond papier, liseré ocre — */
        parts.push('<rect width="' + W + '" height="' + H + '" fill="' + C.bg + '"/>');
        parts.push('<rect width="' + W + '" height="8" fill="' + C.gold + '"/>');

        /* — Manchette — */
        const meta = PERIODES.find(p => p.v === data.window.periode);
        const status = marketStatus(data.window);
        y = 30 + Math.round(pad * 0.4);
        const lg = Math.round(W * 0.052);
        let tx = pad;
        if (logoData) {
            parts.push('<image href="' + logoData + '" x="' + pad + '" y="' + y + '" width="' + lg + '" height="' + lg + '" preserveAspectRatio="xMidYMid meet"/>');
            tx = pad + lg + 16;
        }
        parts.push(text('The Capital', tx, y + lg * 0.62, { family: F.serif, size: Math.round(W * 0.036), weight: 700, spacing: -0.4 }));
        parts.push(label('Bourse régionale · UEMOA', tx, y + lg * 0.62 + 20, { size: 10.5 }));
        parts.push(label(meta.rubrique, W - pad, y + lg * 0.4, { anchor: 'end', size: 12.5, fill: C.gold, spacing: 1.6 }));
        const edition = [options.bulletin, options.heure].filter(Boolean).join(' · ');
        if (edition) parts.push(label(edition, W - pad, y + lg * 0.4 + 19, { anchor: 'end', size: 10.5 }));
        if (status) parts.push(label((status.open ? '● ' : '○ ') + status.label, W - pad, y + lg * 0.4 + (edition ? 37 : 19), { anchor: 'end', size: 10.5, fill: status.open ? C.green : C.muted }));
        y += lg + 16;
        parts.push('<rect x="' + pad + '" y="' + y + '" width="' + inner + '" height="3" fill="' + C.ink + '"/>');
        parts.push(line(pad, y + 7, W - pad, 1));
        y += 27;
        const dateLigne = data.window.periode === 'seance'
            ? new Date(data.window.to + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
            : data.window.label;
        parts.push(label(dateLigne, pad, y, { size: 12, fill: C.ink2, spacing: 1.2 }));
        parts.push(label(options.surtitre || 'Clôture BRVM · Abidjan', W - pad, y, { anchor: 'end', size: 12, spacing: 1.2 }));
        y += 12;
        parts.push(hair(y));

        /* — Titre de une et chapeau — */
        const bodyTop = y;
        const hs = Math.round(W * 0.043);
        y += g(22) + hs;
        wrap(headline(data), Math.floor(inner / (hs * 0.47))).slice(0, 2).forEach(function (l, i) {
            if (i) y += Math.round(hs * 1.08);
            parts.push(text(l, pad, y, { family: F.serif, size: hs, weight: 600, spacing: -0.5 }));
        });
        if (data.window.periode !== 'seance') {
            y += g(26);
            parts.push(label(data.totals.seances + ' séance' + (data.totals.seances > 1 ? 's' : '') + ' de cotation', pad, y, { size: 11 }));
        }
        if (options.blocs.note) {
            const noteText = (options.note && options.note.trim()) || autoNote(data);
            if (noteText) {
                y += g(14);
                wrap(noteText, Math.floor(inner / 8.3)).slice(0, 4).forEach(function (l) {
                    y += g(25);
                    parts.push(text(l, pad, y, { size: 17, fill: C.ink2, family: F.serif, style: 'italic' }));
                });
            }
        }

        /* — Activité : bandeau à filets + une case par titre coté — */
        y += g(30);
        if (options.blocs.activite) {
            const boxH = 76;
            parts.push(line(pad, y, W - pad, 1.5));
            parts.push(line(pad, y + boxH, W - pad, 1.5));
            const cells = [
                { l: 'Titres cotés', v: String(data.totals.titres) },
                { l: 'En hausse', v: String(data.totals.up), c: C.green },
                { l: 'En baisse', v: String(data.totals.down), c: C.red },
                { l: 'Stables', v: String(data.totals.flat), c: C.muted },
                { l: 'Valeur échangée', v: money(data.totals.valeur) + ' F' }
            ];
            const cw = inner / cells.length;
            cells.forEach(function (cell, i) {
                const x = pad + cw * i + (i ? 16 : 0);
                if (i) parts.push('<line x1="' + (pad + cw * i) + '" y1="' + (y + 12) + '" x2="' + (pad + cw * i) + '" y2="' + (y + boxH - 12) + '" stroke="' + C.ink + '" stroke-opacity="0.16"/>');
                parts.push(label(cell.l, x, y + 26, { size: 10.5 }));
                parts.push(text(cell.v, x, y + 58, { family: F.mono, size: 26, weight: 600, fill: cell.c || C.ink }));
            });
            y += boxH + g(18);
            const n = Math.max(1, data.totals.titres), gap = 2.5;
            const cell = (inner - gap * (n - 1)) / n;
            for (let i = 0; i < n; i++) {
                const c = i < data.totals.up ? C.green : i < data.totals.up + data.totals.flat ? C.flatCell : C.red;
                parts.push('<rect x="' + (pad + i * (cell + gap)).toFixed(1) + '" y="' + y + '" width="' + cell.toFixed(1) + '" height="18" fill="' + c + '"/>');
            }
            y += 18 + g(40);
        }

        /* — Indices — */
        if (options.blocs.indices && data.indices.length) {
            y = rubrique('Indices de marché', pad, inner);
            const sparkX2 = W - pad, sparkX1 = sparkX2 - 70;
            const colYtd = sparkX1 - 28, colPer = colYtd - 150, colVal = colPer - 150;
            parts.push(label('Valeur', colVal, y, { anchor: 'end', size: 10 }));
            parts.push(label(data.window.periode === 'seance' ? 'Séance' : 'Période', colPer, y, { anchor: 'end', size: 10 }));
            parts.push(label('Depuis le 1er janv.', colYtd, y, { anchor: 'end', size: 10 }));
            parts.push(label('5 séances', sparkX2, y, { anchor: 'end', size: 10 }));
            parts.push(line(pad, y + 9, W - pad, 1.2));
            y += g(38);
            data.indices.slice(0, 5).forEach(function (idx) {
                parts.push(text(String(idx.indice).replace('BRVM-', 'BRVM ').replace('COMPOSITE', 'Composite').replace('PRESTIGE', 'Prestige'),
                    pad, y, { family: F.serif, size: 19, weight: 600 }));
                parts.push(num(idx.last.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colVal, y, { size: 16 }));
                parts.push(variation(idx.perf, colPer, y, 16));
                parts.push(num(idx.ytd == null ? '—' : pct(idx.ytd), colYtd, y, { size: 15, fill: idx.ytd == null ? C.muted : signe(idx.ytd) }));
                if (idx.spark && idx.spark.length >= 2) parts.push(sparkline(sparkX1, sparkX2 - 3, y + 2, 20, idx.spark));
                parts.push(hair(y + g(12)));
                y += g(pas);
            });
            y += g(compact ? 10 : 18);
        }

        /* — Marché en chiffres / secteurs — deux colonnes */
        if (options.blocs.chiffres && data.chiffres) {
            const hasSecteurs = data.secteurs && data.secteurs.length >= 2;
            const colGap = Math.round(inner * 0.06);
            const colW = hasSecteurs ? Math.round((inner - colGap) / 2) : inner;
            const xR = pad + colW + colGap;
            const y0 = y;
            const c = data.chiffres;
            let yL = rubrique('Le marché en chiffres', pad, colW);
            const rowItem = function (lib, value, yy) {
                parts.push(text(lib, pad, yy, { size: 14, fill: C.ink2 }));
                parts.push(num(value, pad + colW, yy, { size: 14 }));
                parts.push(hair(yy + 8, pad, pad + colW));
                return yy + g(26);
            };
            if (c.valeurTransactions != null) yL = rowItem('Valeur des transactions', money(c.valeurTransactions) + ' F', yL);
            yL += g(6);
            parts.push(label('Actions', pad, yL, { size: 10, fill: C.gold }));
            yL += g(20);
            [
                ['Titres cotés', c.titresCotes != null ? String(c.titresCotes) : null],
                ['Sociétés cotées', c.societesCotees != null ? String(c.societesCotees) : null],
                ['Capitalisation actions', c.capiActions != null ? money(c.capiActions) + ' F' : null],
                ['PER médian', c.perMedian != null ? c.perMedian.toFixed(1).replace('.', ',') + ' x' : null],
                ['Rendement médian', c.rdtMedian != null ? c.rdtMedian.toFixed(2).replace('.', ',') + ' %' : null],
                ['Rentabilité médiane (ROE)', c.roeMedian != null ? c.roeMedian.toFixed(1).replace('.', ',') + ' %' : null]
            ].filter(it => it[1] != null).forEach(it => { yL = rowItem(it[0], it[1], yL); });
            if (c.lignesObligataires != null || c.capiObligations != null) {
                yL += g(8);
                parts.push(label('Obligataire', pad, yL, { size: 10, fill: C.gold }));
                yL += g(20);
                [
                    ['Lignes obligataires', c.lignesObligataires != null ? String(c.lignesObligataires) : null],
                    ['Capitalisation obligations', c.capiObligations != null ? money(c.capiObligations) + ' F' : null]
                ].filter(it => it[1] != null).forEach(it => { yL = rowItem(it[0], it[1], yL); });
            }
            let yR = y0;
            if (hasSecteurs) {
                y = y0;
                yR = rubrique('Échanges par secteur', xR, colW);
                const maxPct = Math.max.apply(null, data.secteurs.map(s => s.pct)) || 1;
                data.secteurs.forEach(function (s) {
                    parts.push(text(s.nom, xR, yR, { size: 14 }));
                    parts.push(num(s.pct.toFixed(1).replace('.', ',') + ' %', xR + colW, yR, { size: 14, fill: C.gold, weight: 600 }));
                    parts.push('<rect x="' + xR + '" y="' + (yR + 8) + '" width="' + Math.max(3, colW * (s.pct / maxPct)).toFixed(1) + '" height="5" fill="' + C.ink + '"/>');
                    yR += g(36);
                });
            }
            y = Math.max(yL, yR) + g(20);
        }

        /* — Palmarès — */
        const podium = function (title, list) {
            if (!list.length) return;
            const colCours = W - pad - 150, colVar = W - pad;
            y = rubrique(title, pad, inner);
            parts.push(label('Valeur', pad + 30, y, { size: 10 }));
            parts.push(label('Cours', colCours, y, { anchor: 'end', size: 10 }));
            parts.push(label('Var.', colVar, y, { anchor: 'end', size: 10 }));
            parts.push(line(pad, y + 9, W - pad, 1.2));
            y += g(38);
            list.forEach(function (e, k) {
                parts.push(text(String(k + 1), pad, y, { family: F.mono, size: 13, fill: C.muted }));
                parts.push(text(e.ticker, pad + 30, y, { size: 19, weight: 700, spacing: 0.3 }));
                const nm = nomCourt(e.nom, 30);
                if (nm) parts.push(text(nm, pad + 30 + Math.max(80, String(e.ticker).length * 12.5), y, { size: 15, fill: C.ink2, family: F.serif, style: 'italic' }));
                parts.push(num(money(e.last), colCours, y, { size: 16, fill: C.ink2 }));
                parts.push(variation(e.perf, colVar, y, 17));
                const detail = [];
                if (TC.toNumber(e.volume)) detail.push(money(e.volume) + ' titres');
                if (TC.toNumber(e.valeur)) detail.push(money(e.valeur) + ' F échangés');
                if (detail.length && !compact) {
                    parts.push(text(detail.join(' · '), pad + 30, y + g(19), { size: 11.5, fill: C.muted }));
                    parts.push(hair(y + g(31)));
                    y += g(50);
                } else {
                    parts.push(hair(y + g(12)));
                    y += g(pas);
                }
            });
            y += g(compact ? 8 : 16);
        };
        if (options.blocs.hausses) podium('Plus fortes hausses', data.hausses);
        if (options.blocs.baisses) podium('Plus fortes baisses', data.baisses);

        /* — Plus forte activité — */
        if (options.blocs.volumes && data.volumes.length) {
            y = rubrique('Plus forte activité', pad, inner, 'valeurs échangées');
            const max = Math.max.apply(null, data.volumes.map(e => e.valeur)) || 1;
            const barX = pad + 110, barMax = inner - 110 - 150;
            data.volumes.forEach(function (e) {
                parts.push(text(e.ticker, pad, y, { size: 17, weight: 700 }));
                parts.push('<rect x="' + barX + '" y="' + (y - 11) + '" width="' + Math.max(4, barMax * e.valeur / max).toFixed(1) + '" height="10" fill="' + C.ink + '"/>');
                parts.push(num(money(e.valeur) + ' F', W - pad, y, { size: 15, weight: 600 }));
                parts.push(hair(y + g(12)));
                y += g(34);
            });
            y += g(16);
        }

        /* — Marché obligataire — */
        if (options.blocs.obligataire && data.obligataire && (data.obligataire.lignes || data.obligataire.snapshot)) {
            const o = data.obligataire;
            y = rubrique('Marché obligataire', pad, inner);
            const lines = [];
            if (o.lignes) lines.push(['Lignes cotées', String(o.lignes)]);
            if (o.snapshot && TC.toNumber(o.snapshot.capitalisation_obligations) != null)
                lines.push(['Capitalisation obligataire', money(o.snapshot.capitalisation_obligations) + ' F']);
            if (o.tauxMoyen != null) lines.push(['Taux facial médian', o.tauxMoyen.toFixed(2).replace('.', ',') + ' %']);
            lines.forEach(function (it) {
                parts.push(text(it[0], pad, y, { size: 15, fill: C.ink2 }));
                parts.push(num(it[1], W - pad, y, { size: 15 }));
                parts.push(hair(y + 9));
                y += g(28);
            });
            if (o.top && o.top.length) {
                y += g(8);
                parts.push(label('Lignes les plus cotées', pad, y, { size: 10, fill: C.gold }));
                y += g(24);
                o.top.slice(0, 5).forEach(function (b) {
                    parts.push(text(String(b.code || ''), pad, y, { size: 14, family: F.mono, weight: 600 }));
                    const nm = (b.nom || '').slice(0, 38);
                    if (nm) parts.push(text(nm, pad + 130, y, { size: 13, fill: C.ink2, family: F.serif, style: 'italic' }));
                    parts.push(num(money(b.cours) + ' F', W - pad, y, { size: 14 }));
                    parts.push(hair(y + 9));
                    y += g(28);
                });
            }
            y += g(16);
        }

        /* — Dividendes à venir — */
        if (options.blocs.dividendes && data.dividendesAVenir && data.dividendesAVenir.length) {
            y = rubrique('Dividendes à venir', pad, inner);
            parts.push(label('Détachement', W - pad - 210, y, { anchor: 'end', size: 10 }));
            parts.push(label('Net', W - pad - 95, y, { anchor: 'end', size: 10 }));
            parts.push(label('Rdt', W - pad, y, { anchor: 'end', size: 10 }));
            parts.push(line(pad, y + 9, W - pad, 1.2));
            y += g(36);
            data.dividendesAVenir.forEach(function (d) {
                parts.push(text(d.ticker, pad, y, { size: 16, weight: 700 }));
                const nm = nomCourt(d.nom, 26);
                if (nm) parts.push(text(nm, pad + 90, y, { size: 14, fill: C.ink2, family: F.serif, style: 'italic' }));
                parts.push(num(typeof TC.fmtDate === 'function' ? TC.fmtDate(d.detach) : String(d.detach || ''), W - pad - 210, y, { size: 14, fill: C.ink2 }));
                parts.push(num(d.montant != null ? money(d.montant) + ' F' : '—', W - pad - 95, y, { size: 14 }));
                parts.push(num(d.rdt != null ? (d.rdt <= 1.5 ? (d.rdt * 100) : d.rdt).toFixed(2).replace('.', ',') + ' %' : '—', W - pad, y, { size: 14, fill: C.green, weight: 600 }));
                parts.push(hair(y + 9));
                y += g(30);
            });
            y += g(16);
        }

        /* — Parité XOF : fait réglementaire fixe, pas une cotation — */
        if (options.blocs.chiffres) {
            y += g(4);
            parts.push(text('1 € = ' + XOF_PER_EUR.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' FCFA', pad, y, { size: 13, family: F.mono }));
            parts.push(text('Parité fixe UEMOA / zone euro', W - pad, y, { size: 12, anchor: 'end', fill: C.muted, family: F.serif, style: 'italic' }));
            y += g(30);
        }

        /* — Pied de page — jamais tronqué : la hauteur du canevas s'ajuste
           plus bas si le contenu déborde. */
        const footH = 58;
        const footYIdeal = H - Math.round(pad * 0.72);
        const footTop = Math.max(footYIdeal - footH, Math.round(y + g(30)));
        const footY = footTop + footH;
        parts.push(line(pad, footTop - 10, W - pad, 1.2));
        parts.push(text('Source : BRVM · calculs The Capital', pad, footTop + 14, { size: 12, fill: C.ink2 }));
        parts.push(text('Information à caractère informatif — ne constitue pas un conseil en investissement.', pad, footTop + 34, { size: 11, fill: C.muted, family: F.serif, style: 'italic' }));
        parts.push(text('thecapitalinvest.com', W - pad, footTop + 14, { size: 13, fill: C.gold, anchor: 'end', family: F.mono, weight: 600 }));
        parts.push(text('© ' + data.window.to.slice(0, 4) + ' The Capital', W - pad, footTop + 34, { size: 11, fill: C.muted, anchor: 'end' }));

        const overflow = y > (footTop - 44);
        /* Filet de sécurité : mieux vaut une image plus haute qu'un tableau
           coupé en plein milieu. */
        const neededH = footY + Math.round(pad * 0.5);
        if (neededH > H) {
            H = neededH;
            parts[0] = '<rect width="' + W + '" height="' + H + '" fill="' + C.bg + '"/>';
        }

        return {
            bodyTop: bodyTop, footTop: footTop - 44,
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
                '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + F.sans.replace(/'/g, '&apos;') + '">' +
                (fontCss ? '<defs><style>' + fontCss + '</style></defs>' : '') + parts.join('') + '</svg>',
            width: W, height: H, overflow, contentBottom: Math.round(y), grew: H > H0
        };
    }

    /* ── Polices embarquées (base64) : l'export ne dépend ni du réseau ni des
       polices installées sur le poste. ── */
    const FONT_FILES = [
        ['TC Serif', 'newsreader-600-normal.woff', 600, 'normal'],
        ['TC Serif', 'newsreader-700-normal.woff', 700, 'normal'],
        ['TC Serif', 'newsreader-400-italic.woff', 400, 'italic'],
        ['TC Mono', 'ibm-plex-mono-400-normal.woff', 400, 'normal'],
        ['TC Mono', 'ibm-plex-mono-600-normal.woff', 600, 'normal'],
        ['TC Sans', 'ibm-plex-sans-condensed-400-normal.woff', 400, 'normal'],
        ['TC Sans', 'ibm-plex-sans-condensed-600-normal.woff', 600, 'normal'],
        ['TC Sans', 'ibm-plex-sans-condensed-700-normal.woff', 700, 'normal']
    ];
    let fontCss = null;
    async function loadFonts() {
        if (fontCss !== null) return fontCss;
        try {
            const rules = await Promise.all(FONT_FILES.map(async function (f) {
                const r = await fetch('/fonts/report/' + f[1], { cache: 'force-cache' });
                if (!r.ok) throw new Error(f[1]);
                const blob = await r.blob();
                const data = await new Promise(function (resolve, reject) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                return "@font-face{font-family:'" + f[0] + "';src:url(" + data.replace('application/octet-stream', 'font/woff') + ") format('woff');font-weight:" + f[2] + ';font-style:' + f[3] + '}';
            }));
            fontCss = rules.join('');
        } catch (e) {
            fontCss = '';
            console.warn('[REPORTING] Polices non chargées, repli système :', e && e.message);
        }
        return fontCss;
    }

    /* ── Logo en base64, pour que l'export ne dépende pas du réseau ── */

    async function loadLogo() {
        if (logoData !== null) return logoData;
        try {
            const r = await fetch(TC.env.LOGO, { cache: 'force-cache' });
            if (!r.ok) throw new Error('logo indisponible');
            const blob = await r.blob();
            logoData = await new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            logoData = '';
        }
        return logoData;
    }

    /* ── Génération ──────────────────────────────────────── */

    async function generate() {
        const periode = TC.qs('#rep-periodes .subtab.active').dataset.periode;
        const ref = TC.val('rep-date') || TC.today();
        const w = windowFor(periode, ref);

        TC.say('rep-msg', 'Lecture des données…', 'info');
        TC.el('rep-stage').innerHTML = '<div class="loading"><div class="spinner"></div>Agrégation de la période…</div>';

        await Promise.all([loadLogo(), loadFonts()]);
        const data = await collect(w);

        if (!data) {
            TC.el('rep-stage').innerHTML = '<div class="empty-state"><strong>Aucune cotation sur cette période</strong>' +
                'Du ' + TC.fmtDate(w.from) + ' au ' + TC.fmtDate(w.to) + ', la base ne contient aucune séance. ' +
                'Vérifiez le calendrier dans Cours &amp; historique.</div>';
            TC.say('rep-msg', 'Période vide : rien à publier.', 'warn');
            ['rep-png', 'rep-jpg', 'rep-svg', 'rep-csv', 'rep-publish'].forEach(id => { TC.el(id).disabled = true; });
            return;
        }

        const blocs = {};
        TC.qsa('#rep-blocs input[data-bloc]').forEach(cb => { blocs[cb.dataset.bloc] = cb.checked; });

        const options = {
            format: TC.val('rep-format') || '1080x1350',
            surtitre: TC.val('rep-surtitre'),
            bulletin: TC.val('rep-bulletin'),
            heure: TC.val('rep-heure'),
            note: TC.val('rep-note'),
            blocs, gap: 1
        };

        /* Première passe pour mesurer, seconde pour occuper la hauteur. Sans
           cela, une séance étroite laisse la moitié du visuel vide et un mois
           chargé déborde sous le pied de page. Une éventuelle troisième passe
           (gap déjà au plancher) fait grandir le canevas plutôt que de couper
           une ligne — voir le filet de sécurité dans build(). */
        let output = build(data, options);
        const used = output.contentBottom - output.bodyTop;
        const available = output.footTop - output.bodyTop;
        if (used > 0) {
            const ratio = available / used;
            const gap = Math.min(1.85, Math.max(0.7, ratio));
            if (Math.abs(gap - 1) > 0.04) {
                options.gap = gap;
                output = build(data, options);
            }
        }

        report = { data, output, window: w, options };

        TC.el('rep-stage').innerHTML = output.svg;
        TC.el('rep-dims').textContent = output.width + ' × ' + output.height + ' px';
        ['rep-png', 'rep-jpg', 'rep-svg', 'rep-csv', 'rep-publish'].forEach(id => { TC.el(id).disabled = false; });

        const socialMode = TC.qs('#rep-mode .subtab.active').dataset.mode === 'social';
        TC.say('rep-msg', output.grew
            ? 'Reporting généré : le contenu dépassait le format choisi, la hauteur a été ajustée (' + output.width + ' × ' + output.height + ' px) pour ne rien couper.' +
                (socialMode ? ' Ce format n\'est plus idéal pour un post — désactivez une section de plus.' : '')
            : 'Reporting généré : ' + data.totals.titres + ' valeur(s) sur ' + data.totals.seances + ' séance(s).' +
                (socialMode ? ' Format prêt pour Instagram/LinkedIn/TikTok.' : ''),
            output.grew ? 'warn' : 'ok');

        paintTable(data);
    }

    function paintTable(data) {
        TC.el('rep-table-card').hidden = false;
        const list = data.values.slice().sort((a, b) => (b.perf || -999) - (a.perf || -999));
        TC.el('rep-table').innerHTML =
            '<table><thead><tr><th>Ticker</th><th>Société</th><th class="r">Départ</th><th class="r">Arrivée</th>' +
            '<th class="r">Performance</th><th class="r">Séances</th><th class="r">Volume</th><th class="r">Valeur</th>' +
            '</tr></thead><tbody>' + list.map(e =>
                '<tr><td class="td-key">' + TC.esc(e.ticker) + '</td>' +
                '<td class="td-muted">' + TC.esc(e.nom || '—') + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(e.base !== undefined ? e.base : e.first) + '</td>' +
                '<td class="r td-mono">' + TC.fmt(e.last) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(e.perf) + '">' + TC.fmtPct(e.perf) + '</td>' +
                '<td class="r td-mono td-muted">' + e.seances + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(e.volume) + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(e.valeur) + '</td></tr>').join('') +
            '</tbody></table>';
    }

    /* ── Exports ─────────────────────────────────────────── */

    function baseName() {
        return 'the-capital-' + report.window.periode + '-' + report.window.to;
    }

    async function raster(type, quality) {
        if (!report) return;
        TC.say('rep-msg', 'Rendu de l\'image…', 'info');
        try {
            const blob = new Blob([report.output.svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const image = new Image();
            await new Promise(function (resolve, reject) {
                image.onload = resolve;
                image.onerror = () => reject(new Error('Le navigateur n\'a pas pu rendre le visuel.'));
                image.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = report.output.width;
            canvas.height = report.output.height;
            const ctx = canvas.getContext('2d');
            /* Le JPEG n'a pas de canal alpha : sans fond, il sort noir ou blanc. */
            ctx.fillStyle = C.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0);
            URL.revokeObjectURL(url);
            const out = await new Promise(res => canvas.toBlob(res, type, quality));
            if (!out) throw new Error('Export impossible sur ce navigateur.');
            TC.download(baseName() + (type === 'image/png' ? '.png' : '.jpg'), out);
            TC.say('rep-msg', 'Image exportée.', 'ok');
        } catch (e) {
            TC.say('rep-msg', e.message + ' Utilisez l\'export SVG en repli.', 'err');
        }
    }

    /* ── Publication publique (/reporting.html) ─────────────────────────
       Envoie un résumé du reporting — pas le tableau brut par valeur
       (`data.values`), inutile côté public et qui alourdirait la charge —
       à l'API serveur, qui écrit avec la clé service role après vérification
       admin. Une ligne par (période, fin de fenêtre) : republier remplace. */
    async function publish() {
        if (!report) return;
        TC.say('rep-msg', 'Publication en cours…', 'info');
        try {
            const d = report.data;
            const meta = PERIODES.find(p => p.v === d.window.periode);
            const payload = {
                window: d.window,
                titre: meta ? meta.titre : '',
                totals: d.totals,
                indices: d.indices,
                secteurs: d.secteurs,
                chiffres: d.chiffres,
                obligataire: d.obligataire,
                hausses: d.hausses,
                baisses: d.baisses,
                volumes: d.volumes,
                dividendesAVenir: d.dividendesAVenir,
                habillage: {
                    surtitre: report.options.surtitre || '',
                    bulletin: report.options.bulletin || '',
                    heure: report.options.heure || ''
                },
                note: (report.options.note && report.options.note.trim()) || autoNote(d)
            };
            const r = await TC.api('/api/process-brvm', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'reporting', action: 'publish',
                    periode: d.window.periode, window_from: d.window.from, window_to: d.window.to,
                    payload
                }), timeout: 20000
            });
            TC.say('rep-msg', 'Publié sur thecapitalinvest.com/reporting.html' +
                (r && r.data && r.data.published_at ? ' (' + TC.fmtDateLong(r.data.published_at.slice(0, 10)) + ')' : '') + '.', 'ok');
        } catch (e) {
            TC.say('rep-msg', 'Publication impossible : ' + e.message, 'err');
        }
    }

    TC.register({
        id: 'reporting',
        label: 'Reporting',
        group: 'diffusion',
        icon: '◈',
        keywords: 'seance minute rapport hebdomadaire mensuel trimestriel annuel publication visuel',
        view,
        mount() {
            TC.setVal('rep-date', TC.today());
            paintWindow();

            TC.delegate('rep-periodes', '.subtab', 'click', function (btn) {
                TC.qsa('#rep-periodes .subtab').forEach(b => b.classList.toggle('active', b === btn));
                paintWindow();
            });
            TC.on('rep-date', 'change', paintWindow);
            TC.delegate('rep-blocs', 'input', 'change', function (cb) {
                cb.closest('.toggle').classList.toggle('on', cb.checked);
            });
            TC.delegate('rep-mode', '.subtab', 'click', function (btn) {
                TC.qsa('#rep-mode .subtab').forEach(b => b.classList.toggle('active', b === btn));
                applyMode(btn.dataset.mode);
            });

            TC.on('rep-build', 'click', generate);
            TC.on('rep-png', 'click', () => raster('image/png'));
            TC.on('rep-jpg', 'click', () => raster('image/jpeg', 0.94));
            TC.on('rep-svg', 'click', function () {
                if (!report) return;
                TC.download(baseName() + '.svg', report.output.svg, 'image/svg+xml;charset=utf-8');
                TC.say('rep-msg', 'Fichier SVG exporté.', 'ok');
            });
            TC.on('rep-csv', 'click', function () {
                if (!report) return;
                const list = report.data.values.map(e => ({
                    ticker: e.ticker, societe: e.nom,
                    depart: e.base !== undefined ? e.base : e.first,
                    arrivee: e.last, performance_pct: e.perf !== null ? e.perf.toFixed(2) : '',
                    seances: e.seances, volume: e.volume, valeur_echangee: e.valeur
                }));
                TC.download(baseName() + '.csv',
                    TC.toCSV(list, ['ticker', 'societe', 'depart', 'arrivee', 'performance_pct', 'seances', 'volume', 'valeur_echangee']),
                    'text/csv;charset=utf-8');
            });
            TC.on('rep-publish', 'click', publish);
        }
    });

})(window.TC);
