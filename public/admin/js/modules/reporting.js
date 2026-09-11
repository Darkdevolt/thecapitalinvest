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

    /* Palette sur fond blanc. `cream` reste la clé du texte principal mais
       porte désormais une encre sombre : tous les appels text() suivent. */
    const C = {
        bg: '#FFFFFF', panel: '#F7F3EA', line: '#E6DECC',
        cream: '#1C1813', ink: '#1C1813',
        gold: '#8C6D2E', goldBright: '#B8964E', goldLight: '#A9884A',
        muted: '#8A8172', green: '#1F9B57', red: '#CC3B3B'
    };

    const FORMATS = [
        { v: '1080x1350', l: 'Publication — 1080 × 1350' },
        { v: '1080x1920', l: 'Story — 1080 × 1920' },
        { v: '1080x1080', l: 'Carré — 1080 × 1080' },
        { v: '1200x1700', l: 'Impression — 1200 × 1700' }
    ];

    const PERIODES = [
        { v: 'seance', l: 'Séance', titre: 'La séance en une minute' },
        { v: 'hebdo', l: 'Semaine', titre: 'La semaine boursière' },
        { v: 'mensuel', l: 'Mois', titre: 'Le mois boursier' },
        { v: 'trimestre', l: 'Trimestre', titre: 'Le trimestre boursier' },
        { v: 'annuel', l: 'Année', titre: "L'année boursière" }
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
    let bannerData = null;
    let bannerRatio = 0;
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
        const perList = [], yldList = [], roeList = [];
        values.forEach(function (e) {
            const f = finByT[String(e.ticker).toUpperCase()];
            if (!f) return;
            const bpa = TC.toNumber(f.bpa);
            if (bpa && bpa > 0 && e.last) perList.push(e.last / bpa);
            let y = TC.toNumber(f.dividend_yield);
            if (y !== null && y <= 1.5) y *= 100;
            if ((y === null || y === 0) && TC.toNumber(f.dpa) && e.last) y = (TC.toNumber(f.dpa) / e.last) * 100;
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
                pct(compo.perf).replace('+', '') + ' à ' +
                compo.last.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' points.');
        }
        parts.push(t.up + ' valeur' + (t.up > 1 ? 's' : '') + ' en hausse contre ' + t.down +
            ' en baisse sur ' + t.titres + ' titres cotés' + (t.flat ? ' (' + t.flat + ' stable' + (t.flat > 1 ? 's' : '') + ')' : '') + '.');
        const vol = data.volumes[0];
        if (vol) parts.push('Titre le plus actif : ' + vol.ticker + ' avec ' + money(vol.valeur) + ' F échangés.');
        return parts.join(' ');
    }

    /* Petites icônes de repère — traits géométriques simples (rects, cercles,
       lignes, polygones), un seul système visuel cohérent, sans police
       d'icônes externe pour que l'export PNG/JPEG reste autonome. */
    function glyph(key, x, y, opts) {
        const o = opts || {};
        const s = o.color || C.gold, cy = y - 4; // aligné sur la ligne de base du titre (12px)
        switch (key) {
            case 'up':
                return '<path d="M' + x + ' ' + (cy + 5) + ' L' + (x + 5) + ' ' + (cy - 2) + ' L' + (x + 9) + ' ' + (cy + 2) + ' L' + (x + 15) + ' ' + (cy - 6) +
                    '" fill="none" stroke="' + C.green + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M' + (x + 11) + ' ' + (cy - 6) + ' L' + (x + 15) + ' ' + (cy - 6) + ' L' + (x + 15) + ' ' + (cy - 2) + '" fill="none" stroke="' + C.green + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            case 'down':
                return '<path d="M' + x + ' ' + (cy - 5) + ' L' + (x + 5) + ' ' + (cy + 2) + ' L' + (x + 9) + ' ' + (cy - 2) + ' L' + (x + 15) + ' ' + (cy + 6) +
                    '" fill="none" stroke="' + C.red + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '<path d="M' + (x + 11) + ' ' + (cy + 6) + ' L' + (x + 15) + ' ' + (cy + 6) + ' L' + (x + 15) + ' ' + (cy + 2) + '" fill="none" stroke="' + C.red + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            case 'bars':
                return '<rect x="' + x + '" y="' + (cy + 1) + '" width="3" height="7" fill="' + s + '" rx="1"/>' +
                    '<rect x="' + (x + 5) + '" y="' + (cy - 4) + '" width="3" height="12" fill="' + s + '" rx="1"/>' +
                    '<rect x="' + (x + 10) + '" y="' + (cy - 7) + '" width="3" height="15" fill="' + s + '" rx="1"/>';
            /* Bourse / colonnes — fronton triangulaire sur trois colonnes,
               identité graphique cohérente avec le bandeau or/bronze
               (remplace l'ancien pictogramme « pièces » lu comme un
               maillon de chaîne). */
            case 'columns':
                return '<path d="M' + (x - 1) + ' ' + (cy - 6) + ' L' + (x + 7.5) + ' ' + (cy - 11) + ' L' + (x + 16) + ' ' + (cy - 6) + ' Z" fill="none" stroke="' + s + '" stroke-width="1.5" stroke-linejoin="round"/>' +
                    '<line x1="' + (x - 1) + '" y1="' + (cy - 6) + '" x2="' + (x + 16) + '" y2="' + (cy - 6) + '" stroke="' + s + '" stroke-width="1.5"/>' +
                    '<line x1="' + (x + 1) + '" y1="' + (cy - 3) + '" x2="' + (x + 1) + '" y2="' + (cy + 6) + '" stroke="' + s + '" stroke-width="1.5" stroke-linecap="round"/>' +
                    '<line x1="' + (x + 7.5) + '" y1="' + (cy - 3) + '" x2="' + (x + 7.5) + '" y2="' + (cy + 6) + '" stroke="' + s + '" stroke-width="1.5" stroke-linecap="round"/>' +
                    '<line x1="' + (x + 14) + '" y1="' + (cy - 3) + '" x2="' + (x + 14) + '" y2="' + (cy + 6) + '" stroke="' + s + '" stroke-width="1.5" stroke-linecap="round"/>' +
                    '<line x1="' + (x - 2) + '" y1="' + (cy + 6) + '" x2="' + (x + 17) + '" y2="' + (cy + 6) + '" stroke="' + s + '" stroke-width="1.5"/>';
            case 'calendar':
                return '<rect x="' + x + '" y="' + (cy - 6) + '" width="15" height="13" rx="2" fill="none" stroke="' + s + '" stroke-width="1.6"/>' +
                    '<line x1="' + x + '" y1="' + (cy - 2) + '" x2="' + (x + 15) + '" y2="' + (cy - 2) + '" stroke="' + s + '" stroke-width="1.6"/>' +
                    '<line x1="' + (x + 4) + '" y1="' + (cy - 8) + '" x2="' + (x + 4) + '" y2="' + (cy - 4) + '" stroke="' + s + '" stroke-width="1.6" stroke-linecap="round"/>' +
                    '<line x1="' + (x + 11) + '" y1="' + (cy - 8) + '" x2="' + (x + 11) + '" y2="' + (cy - 4) + '" stroke="' + s + '" stroke-width="1.6" stroke-linecap="round"/>';
            case 'quote':
                return '<path d="M' + x + ' ' + (cy + 4) + ' Q' + x + ' ' + (cy - 6) + ' ' + (x + 7) + ' ' + (cy - 6) +
                    ' Q' + (x + 4) + ' ' + (cy - 6) + ' ' + (x + 4) + ' ' + (cy - 1) + ' L' + (x + 4) + ' ' + (cy + 4) + ' Z" fill="' + s + '" fill-opacity="0.85"/>' +
                    '<path d="M' + (x + 8) + ' ' + (cy + 4) + ' Q' + (x + 8) + ' ' + (cy - 6) + ' ' + (x + 15) + ' ' + (cy - 6) +
                    ' Q' + (x + 12) + ' ' + (cy - 6) + ' ' + (x + 12) + ' ' + (cy - 1) + ' L' + (x + 12) + ' ' + (cy + 4) + ' Z" fill="' + s + '" fill-opacity="0.85"/>';
            case 'bond':
                return '<rect x="' + x + '" y="' + (cy - 6) + '" width="15" height="11" rx="2" fill="none" stroke="' + s + '" stroke-width="1.6"/>' +
                    '<line x1="' + (x + 3) + '" y1="' + (cy - 2) + '" x2="' + (x + 12) + '" y2="' + (cy - 2) + '" stroke="' + s + '" stroke-width="1.2"/>' +
                    '<circle cx="' + (x + 11) + '" cy="' + (cy + 1) + '" r="2.6" fill="' + C.bg + '" stroke="' + s + '" stroke-width="1.2"/>';
            case 'volume':
            case 'pulse':
                return '<polyline points="' + x + ',' + (cy + 3) + ' ' + (x + 4) + ',' + (cy + 3) + ' ' + (x + 6.5) + ',' + (cy - 7) + ' ' + (x + 9) + ',' + (cy + 8) + ' ' + (x + 11.5) + ',' + (cy - 2) + ' ' + (x + 15) + ',' + (cy - 2) +
                    '" fill="none" stroke="' + s + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
            case 'coin':
                return '<circle cx="' + (x + 7.5) + '" cy="' + cy + '" r="7.5" fill="none" stroke="' + s + '" stroke-width="1.6"/>' +
                    '<text x="' + (x + 7.5) + '" y="' + (cy + 3.2) + '" text-anchor="middle" font-size="8" font-family="\'DM Mono\',monospace" fill="' + s + '" font-weight="600">F</text>';
            /* Triangle plein — utilisé pour le repère de tendance des cases
               d'activité et devant chaque variation d'indice. */
            case 'triUp':
                return '<polygon points="' + (x + 5) + ',' + (cy - 7) + ' ' + (x + 10) + ',' + (cy + 3) + ' ' + x + ',' + (cy + 3) + '" fill="' + (o.color || C.green) + '"/>';
            case 'triDown':
                return '<polygon points="' + x + ',' + (cy - 7) + ' ' + (x + 10) + ',' + (cy - 7) + ' ' + (x + 5) + ',' + (cy + 3) + '" fill="' + (o.color || C.red) + '"/>';
            case 'dash':
                return '<rect x="' + x + '" y="' + (cy - 2) + '" width="10" height="3.4" rx="1.7" fill="' + (o.color || C.muted) + '"/>';
            default:
                return '';
        }
    }

    /* Ligne de séparation ; x1/x2 permettent de la limiter à une colonne
       plutôt qu'à toute la largeur (usage : mise en page à deux colonnes). */
    function makeRule(pad, W, text) {
        return function (ty, opacity, x1, x2) {
            return '<line x1="' + (x1 != null ? x1 : pad) + '" y1="' + ty + '" x2="' + (x2 != null ? x2 : (W - pad)) + '" y2="' + ty +
                '" stroke="' + C.gold + '" stroke-opacity="' + (opacity || 0.24) + '" stroke-width="1"/>';
        };
    }

    function section(parts, title, x, y, width, text, rule, g, icon) {
        const dx = icon ? 22 : 0;
        if (icon) parts.push(glyph(icon, x, y));
        parts.push(text(title.toUpperCase(), x + dx, y, { size: 12, fill: C.gold, spacing: 2.2, weight: 500 }));
        parts.push(rule(y + 14, 0.2, x, x + width));
        return y + (g ? g(40) : 40);
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

    /* Mini-tendance à 5 points — indices uniquement, sans axe ni étiquette :
       la lecture est relative (progression / repli), pas la valeur absolue. */
    function sparkline(x1, x2, yBase, height, values) {
        const v = (values || []).filter(n => n !== null && n !== undefined && isFinite(n));
        if (v.length < 2) return '';
        const min = Math.min.apply(null, v), max = Math.max.apply(null, v);
        const span = (max - min) || Math.abs(max) || 1;
        const color = v[v.length - 1] >= v[0] ? C.green : C.red;
        const pts = v.map(function (val, i) {
            const px = x1 + (x2 - x1) * (i / (v.length - 1));
            const py = yBase - ((val - min) / span) * height;
            return px.toFixed(1) + ',' + py.toFixed(1);
        }).join(' ');
        const last = v[v.length - 1], lastX = x1 + (x2 - x1), lastY = yBase - ((last - min) / span) * height;
        return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="2" fill="' + color + '"/>';
    }

    /* Badge pilule aligné sur son bord droit (x2). Retourne le bord gauche
       utilisé, pour empiler un second badge à sa gauche si besoin. */
    function pillRight(parts, text, label, x2, yCenter, opts) {
        const o = opts || {};
        const fs = o.size || 11;
        const charW = fs * 0.6;
        const dot = !!o.dot;
        const padX = 10;
        const textW = label.length * charW;
        const w = Math.round(textW + padX * 2 + (dot ? 13 : 0));
        const h = o.height || 22;
        const x1 = x2 - w;
        parts.push('<rect x="' + x1 + '" y="' + (yCenter - h / 2) + '" width="' + w + '" height="' + h +
            '" rx="' + (h / 2) + '" fill="' + (o.fill || C.panel) + '" stroke="' + (o.stroke || C.line) + '" stroke-width="1"/>');
        if (dot) parts.push('<circle cx="' + (x1 + padX + 3) + '" cy="' + yCenter + '" r="3" fill="' + (o.dotColor || C.gold) + '"/>');
        parts.push(text(label, x2 - padX, yCenter + fs * 0.35, {
            size: fs, anchor: 'end', fill: o.textColor || C.ink, family: "'DM Mono',monospace", spacing: 0.4
        }));
        return x1;
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
            return '<text x="' + x + '" y="' + ty + '" fill="' + (o.fill || C.cream) + '" ' +
                'font-family="' + (o.family || "'DM Sans',sans-serif") + '" ' +
                'font-size="' + (o.size || 18) + '" font-weight="' + (o.weight || 400) + '" ' +
                (o.anchor ? 'text-anchor="' + o.anchor + '" ' : '') +
                (o.spacing ? 'letter-spacing="' + o.spacing + '" ' : '') +
                (o.style ? 'font-style="' + o.style + '" ' : '') +
                '>' + esc(content) + '</text>';
        };
        const rule = makeRule(pad, W, text);

        /* — Fond blanc — */
        parts.push('<rect width="' + W + '" height="' + H + '" fill="' + C.bg + '"/>');

        const status = marketStatus(data.window);

        /* — Badges d'en-tête : édition/heure + statut marché, coin
           haut-droit du bandeau, à côté du logo. */
        const headerBadges = function (bh) {
            const cy1 = Math.max(20, Math.round(bh * 0.16));
            const cy2 = Math.max(44, Math.round(bh * 0.40));
            const editionLabel = [options.bulletin, options.heure].filter(Boolean).join(' · ');
            if (editionLabel) pillRight(parts, text, editionLabel, W - pad, cy1, { fill: '#FFFFFF', stroke: C.line, textColor: C.ink, size: 12 });
            if (status) pillRight(parts, text, status.label, W - pad, cy2, {
                fill: status.open ? '#EAF7EF' : C.panel, stroke: status.open ? C.green : C.line,
                textColor: status.open ? C.green : C.muted, dot: true, dotColor: status.open ? C.green : C.muted, size: 11
            });
        };

        /* — Bannière — l'image fournie (/assets) est posée telle quelle en
           pleine largeur ; elle contient déjà le logo et les titres. Sans
           fichier, une composition SVG de repli reprend le même gabarit. */
        if (bannerData) {
            const bh = Math.min(Math.round(H * 0.30), Math.round(W * (bannerRatio || 0.32)));
            parts.push('<image href="' + bannerData + '" x="0" y="0" width="' + W + '" height="' + bh +
                '" preserveAspectRatio="xMidYMid meet"/>');
            parts.push('<rect x="0" y="' + bh + '" width="' + W + '" height="2" fill="' + C.goldBright + '" fill-opacity="0.5"/>');
            headerBadges(bh);
            y = bh + Math.round(pad * 0.62) + 18;
            parts.push(glyph('columns', pad, y, { color: C.gold }));
            parts.push(text(options.surtitre || 'BRVM · Bourse Régionale des Valeurs Mobilières',
                pad + 22, y, { size: 14, fill: C.muted, spacing: 1.6 }));
        } else {
            const banH = Math.max(Math.round(W * 0.150), Math.round(H * 0.104));
            parts.push('<defs><linearGradient id="tcBanner" x1="0" y1="0" x2="1" y2="1">' +
                '<stop offset="0" stop-color="#171009"/><stop offset="0.5" stop-color="#0C0906"/>' +
                '<stop offset="1" stop-color="#1E1509"/></linearGradient></defs>');
            parts.push('<rect x="0" y="0" width="' + W + '" height="' + banH + '" fill="url(#tcBanner)"/>');
            parts.push('<rect x="0" y="0" width="' + W + '" height="3" fill="' + C.goldBright + '"/>');
            parts.push('<rect x="0" y="' + (banH - 2) + '" width="' + W + '" height="2" fill="' + C.goldBright + '" fill-opacity="0.55"/>');

            const lr = Math.round(banH * 0.30);
            const lcx = pad + lr;
            const lcy = Math.round(banH / 2);
            parts.push('<circle cx="' + lcx + '" cy="' + lcy + '" r="' + lr + '" fill="none" stroke="' + C.goldBright + '" stroke-width="2"/>');
            if (logoData) {
                const li = Math.round(lr * 1.42);
                parts.push('<image href="' + logoData + '" x="' + (lcx - li / 2) + '" y="' + (lcy - li / 2) +
                    '" width="' + li + '" height="' + li + '" preserveAspectRatio="xMidYMid meet"/>');
            }

            const bx = lcx + lr + Math.round(banH * 0.30);
            parts.push('<line x1="' + (bx - Math.round(banH * 0.16)) + '" y1="' + Math.round(banH * 0.22) +
                '" x2="' + (bx - Math.round(banH * 0.16)) + '" y2="' + Math.round(banH * 0.78) +
                '" stroke="' + C.goldBright + '" stroke-opacity="0.5" stroke-width="1"/>');
            const bs = Math.round(banH * 0.29);
            const b1y = Math.round(banH * 0.42);
            parts.push(text('LA SÉANCE DU JOUR', bx, b1y, {
                family: "'Playfair Display',serif", size: bs, weight: 700, fill: '#FBF7EF', spacing: 0.5
            }));
            parts.push(text('EN 1 MINUTE', bx, b1y + Math.round(bs * 1.05), {
                family: "'Playfair Display',serif", size: bs, weight: 700, fill: C.goldBright, spacing: 0.5
            }));
            parts.push(text("L'AFRIQUE FINANCIÈRE EN TEMPS RÉEL", bx,
                b1y + Math.round(bs * 1.05) + Math.round(banH * 0.19), {
                size: Math.max(10, Math.round(banH * 0.095)), fill: '#C9B58B', spacing: 3
            }));
            headerBadges(banH);

            y = banH + Math.round(pad * 0.55) + 22;
            if (logoData) {
                parts.push('<image href="' + logoData + '" x="' + pad + '" y="' + (y - 32) + '" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>');
            }
            parts.push(text('THE · CAPITAL', pad + (logoData ? 58 : 0), y, {
                family: "'Playfair Display',serif", size: 25, weight: 700, spacing: 3.4
            }));
            const surtY = y + 21;
            parts.push(glyph('columns', pad + (logoData ? 58 : 0), surtY, { color: C.gold }));
            parts.push(text(options.surtitre || 'BRVM · Bourse Régionale des Valeurs Mobilières',
                pad + (logoData ? 58 : 0) + 22, surtY, { size: 14, fill: C.muted, spacing: 1.6 }));
        }

        y += 50;
        parts.push(rule(y, 0.3));

        /* — Titre de période — */
        const bodyTop = y;
        y += g(62);
        const meta = PERIODES.find(p => p.v === data.window.periode);
        parts.push(text(meta.titre, pad, y, { family: "'Playfair Display',serif", size: 46, weight: 700 }));
        y += g(34);
        parts.push(text(data.window.label, pad, y, { size: 17, fill: C.gold, style: 'italic', family: "'Playfair Display',serif" }));
        if (data.window.periode !== 'seance') {
            y += g(24);
            parts.push(text(data.totals.seances + ' séance' + (data.totals.seances > 1 ? 's' : '') + ' de cotation',
                pad, y, { size: 13, fill: C.muted }));
        }

        /* — Analyse de la séance — 2-3 phrases, entre le titre et les
           chiffres clés. Texte éditorial s'il est saisi, sinon une lecture
           générée à partir des totaux réels de la période. */
        if (options.blocs.note) {
            const noteText = (options.note && options.note.trim()) || autoNote(data);
            if (noteText) {
                y += g(34);
                wrap(noteText, Math.floor(inner / 8.4)).slice(0, 4).forEach(function (line) {
                    parts.push(text(line, pad, y, { size: 17, fill: C.ink, family: "'Playfair Display',serif", style: 'italic' }));
                    y += g(26);
                });
            }
        }

        /* — Bandeau d'activité — chaque case porte un repère de tendance
           distinct en haut à gauche : triangle vert / rouge, tiret gris,
           pouls pour la valeur échangée. */
        y += g(36);
        if (options.blocs.activite) {
            const boxH = 112;
            parts.push('<rect x="' + pad + '" y="' + y + '" width="' + inner + '" height="' + boxH +
                '" fill="' + C.panel + '" stroke="' + C.line + '" rx="6"/>');
            const cells = [
                { l: 'Titres cotés', v: String(data.totals.titres), icon: 'columns' },
                { l: 'Hausse', v: String(data.totals.up), c: C.green, icon: 'triUp' },
                { l: 'Baisse', v: String(data.totals.down), c: C.red, icon: 'triDown' },
                { l: 'Stables', v: String(data.totals.flat), icon: 'dash' },
                { l: 'Valeur échangée', v: money(data.totals.valeur), icon: 'pulse' }
            ];
            const cw = inner / cells.length;
            cells.forEach(function (cell, i) {
                const cx = pad + cw * i + cw / 2;
                const ix = pad + cw * i + 16;
                parts.push(glyph(cell.icon, ix, y + 24, { color: cell.c || C.gold }));
                parts.push(text(cell.l.toUpperCase(), cx, y + 42, { size: 11, fill: C.muted, anchor: 'middle', spacing: 1.5 }));
                parts.push(text(cell.v, cx, y + 82, {
                    size: 32, anchor: 'middle', family: "'DM Mono',monospace", fill: cell.c || C.cream, weight: 500
                }));
                if (i) parts.push('<line x1="' + (pad + cw * i) + '" y1="' + (y + 18) + '" x2="' + (pad + cw * i) +
                    '" y2="' + (y + boxH - 18) + '" stroke="' + C.line + '"/>');
            });
            y += boxH + g(40);
        }

        /* — Indices — valeur, variation de période (triangle + %), variation
           depuis le 1er janvier, mini-tendance 5 séances. */
        if (options.blocs.indices && data.indices.length) {
            y = section(parts, 'Indices de marché', pad, y, inner, text, rule, g, 'bars');
            const sparkX2 = W - pad, sparkX1 = sparkX2 - 64;
            const colYtd = sparkX1 - 26, colPer = colYtd - 140, colVal = colPer - 150;
            parts.push(text('VALEUR', colVal, y, { size: 9, anchor: 'end', fill: C.muted, spacing: 1.4 }));
            parts.push(text(data.window.periode === 'seance' ? 'SÉANCE' : 'PÉRIODE', colPer, y, { size: 9, anchor: 'end', fill: C.muted, spacing: 1.4 }));
            parts.push(text('DEPUIS 1ᵉʳ JANV.', colYtd, y, { size: 9, anchor: 'end', fill: C.muted, spacing: 1.4 }));
            parts.push(text('TENDANCE', (sparkX1 + sparkX2) / 2, y, { size: 9, anchor: 'middle', fill: C.muted, spacing: 1.4 }));
            y += g(26);
            data.indices.slice(0, 5).forEach(function (idx) {
                const positive = TC.toNumber(idx.perf) >= 0;
                parts.push(text(idx.indice, pad, y, { size: 16 }));
                parts.push(text(idx.last.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colVal, y, { size: 16, anchor: 'end', family: "'DM Mono',monospace" }));
                parts.push(glyph(positive ? 'triUp' : 'triDown', colPer - 88, y, { color: positive ? C.green : C.red }));
                parts.push(text(pct(idx.perf), colPer, y, {
                    size: 16, anchor: 'end', family: "'DM Mono',monospace",
                    fill: positive ? C.green : C.red
                }));
                parts.push(text(idx.ytd == null ? '—' : pct(idx.ytd), colYtd, y, {
                    size: 16, anchor: 'end', family: "'DM Mono',monospace",
                    fill: idx.ytd == null ? C.muted : TC.toNumber(idx.ytd) >= 0 ? C.green : C.red
                }));
                if (idx.spark && idx.spark.length >= 2) {
                    parts.push(sparkline(sparkX1, sparkX2, y + 4, 22, idx.spark));
                }
                y += g(34);
            });
            y += g(10);
        }

        /* — Marché en chiffres / Répartition sectorielle — deux colonnes :
           actions + obligataire à gauche, secteurs à droite. Si les
           secteurs sont indisponibles, la colonne de gauche reprend toute
           la largeur plutôt que de laisser un vide. */
        if (options.blocs.chiffres && data.chiffres) {
            const hasSecteurs = data.secteurs && data.secteurs.length >= 2;
            const colGap = Math.round(inner * 0.06);
            const colW = hasSecteurs ? Math.round((inner - colGap) / 2) : inner;
            const xR = pad + colW + colGap;
            let yL = y, yR = y;

            const c = data.chiffres;
            yL = section(parts, 'Le marché en chiffres', pad, yL, colW, text, rule, g, 'columns');
            const rowItem = function (label, value, yy) {
                parts.push(text(label, pad, yy, { size: 14, fill: C.muted }));
                parts.push(text(value, pad + colW, yy, { size: 14, anchor: 'end', family: "'DM Mono',monospace" }));
                return yy + g(23);
            };
            if (c.valeurTransactions != null) yL = rowItem('Valeur des transactions', money(c.valeurTransactions) + ' F', yL);
            yL += g(4);
            parts.push(text('ACTIONS', pad, yL, { size: 10, fill: C.gold, spacing: 1.8, weight: 600 }));
            yL += g(20);
            [
                ['Titres cotés', c.titresCotes != null ? String(c.titresCotes) : null],
                ['Sociétés cotées', c.societesCotees != null ? String(c.societesCotees) : null],
                ['Capitalisation actions', c.capiActions != null ? money(c.capiActions) + ' F' : null],
                ['PER médian', c.perMedian != null ? c.perMedian.toFixed(1) + 'x' : null],
                ['Rendement médian', c.rdtMedian != null ? c.rdtMedian.toFixed(2) + ' %' : null],
                ['Rentabilité médiane (ROE)', c.roeMedian != null ? c.roeMedian.toFixed(1) + ' %' : null]
            ].filter(it => it[1] != null).forEach(it => { yL = rowItem(it[0], it[1], yL); });

            if (c.lignesObligataires != null || c.capiObligations != null) {
                yL += g(10);
                parts.push(glyph('bond', pad, yL, { color: C.gold }));
                parts.push(text('OBLIGATAIRE', pad + 20, yL, { size: 10, fill: C.gold, spacing: 1.8, weight: 600 }));
                yL += g(20);
                [
                    ['Lignes obligataires', c.lignesObligataires != null ? String(c.lignesObligataires) : null],
                    ['Capitalisation obligations', c.capiObligations != null ? money(c.capiObligations) + ' F' : null]
                ].filter(it => it[1] != null).forEach(it => { yL = rowItem(it[0], it[1], yL); });
            }

            if (hasSecteurs) {
                yR = section(parts, 'Répartition sectorielle', xR, yR, colW, text, rule, g, 'pulse');
                const maxPct = Math.max.apply(null, data.secteurs.map(s => s.pct)) || 1;
                data.secteurs.forEach(function (s) {
                    parts.push(text(s.nom, xR, yR, { size: 13, fill: C.ink }));
                    parts.push(text(s.pct.toFixed(1) + ' %', xR + colW, yR, { size: 13, anchor: 'end', family: "'DM Mono',monospace", fill: C.gold }));
                    const barY = yR + 8;
                    const barW = Math.max(4, colW * (s.pct / maxPct));
                    parts.push('<rect x="' + xR + '" y="' + barY + '" width="' + colW + '" height="4" fill="' + C.line + '" rx="2"/>');
                    parts.push('<rect x="' + xR + '" y="' + barY + '" width="' + barW + '" height="4" fill="' + C.gold + '" rx="2"/>');
                    yR += g(34);
                });
            }
            y = Math.max(yL, yR) + g(16);
        }

        /* — Palmarès — avatar rond (initiale du ticker) + en-têtes de
           colonnes (Société / Cours / Var.) sous le titre de section. */
        const podium = function (title, list, positive) {
            if (!list.length) return;
            const colCours = W - pad - 132, colVar = W - pad;
            y = section(parts, title, pad, y, inner, text, rule, g, positive ? 'up' : 'down');
            parts.push(text('SOCIÉTÉ', pad + 40, y, { size: 9, anchor: 'start', fill: C.muted, spacing: 1.4 }));
            parts.push(text('COURS', colCours, y, { size: 9, anchor: 'end', fill: C.muted, spacing: 1.4 }));
            parts.push(text('VAR.', colVar, y, { size: 9, anchor: 'end', fill: C.muted, spacing: 1.4 }));
            y += g(22);
            list.forEach(function (e) {
                const initiale = String(e.ticker || '?').charAt(0);
                parts.push('<circle cx="' + (pad + 13) + '" cy="' + (y - 5) + '" r="13" fill="' + C.panel + '" stroke="' + C.gold + '" stroke-width="1.4"/>');
                parts.push(text(initiale, pad + 13, y - 1, { size: 12, anchor: 'middle', fill: C.gold, weight: 700, family: "'Playfair Display',serif" }));
                parts.push(text(e.ticker, pad + 34, y, { size: 18, weight: 500, family: "'Playfair Display',serif", fill: C.gold }));
                const label = (e.nom || '').slice(0, 24);
                if (label) parts.push(text(label, pad + 34 + Math.max(72, e.ticker.length * 12), y, { size: 13, fill: C.muted }));
                parts.push(text(money(e.last), colCours, y, { size: 16, anchor: 'end', family: "'DM Mono',monospace" }));
                parts.push(text(pct(e.perf), colVar, y, {
                    size: 17, anchor: 'end', family: "'DM Mono',monospace", weight: 500,
                    fill: positive ? C.green : C.red
                }));
                const detail = [];
                if (TC.toNumber(e.volume)) detail.push(money(e.volume) + ' titres');
                if (TC.toNumber(e.valeur)) detail.push(money(e.valeur) + ' F échangés');
                if (detail.length) {
                    parts.push(text(detail.join(' · '), pad + 34, y + g(16), { size: 11, fill: C.muted }));
                    y += g(37);
                } else {
                    y += g(27);
                }
            });
            y += g(14);
        };
        if (options.blocs.hausses) podium('Plus fortes hausses', data.hausses, true);
        if (options.blocs.baisses) podium('Plus fortes baisses', data.baisses, false);

        /* — Plus forte activité — titres les plus échangés en valeur — */
        if (options.blocs.volumes && data.volumes.length) {
            y = section(parts, 'Plus forte activité · valeurs échangées', pad, y, inner, text, rule, g, 'pulse');
            const max = Math.max.apply(null, data.volumes.map(e => e.valeur)) || 1;
            data.volumes.forEach(function (e) {
                parts.push(text(e.ticker, pad, y, { size: 17, fill: C.gold, family: "'Playfair Display',serif", weight: 500 }));
                parts.push(text(money(e.valeur) + ' F', W - pad, y, { size: 15, anchor: 'end', family: "'DM Mono',monospace" }));
                const barY = y + 10;
                const barW = Math.max(6, (inner) * (e.valeur / max));
                parts.push('<rect x="' + pad + '" y="' + barY + '" width="' + inner + '" height="4" fill="' + C.line + '" rx="2"/>');
                parts.push('<rect x="' + pad + '" y="' + barY + '" width="' + barW + '" height="4" fill="' + C.gold + '" rx="2"/>');
                y += g(33);
            });
            y += g(6);
        }

        /* — Marché obligataire — */
        if (options.blocs.obligataire && data.obligataire && (data.obligataire.lignes || data.obligataire.snapshot)) {
            const o = data.obligataire;
            y = section(parts, 'Marché obligataire', pad, y, inner, text, rule, g, 'bond');
            const lines = [];
            if (o.lignes) lines.push(['Lignes cotées', String(o.lignes)]);
            if (o.snapshot && TC.toNumber(o.snapshot.capitalisation_obligations) != null)
                lines.push(['Capitalisation obligataire', money(o.snapshot.capitalisation_obligations) + ' F']);
            if (o.tauxMoyen != null) lines.push(['Taux facial médian', o.tauxMoyen.toFixed(2) + ' %']);
            lines.forEach(function (it) {
                parts.push(text(it[0], pad, y, { size: 15, fill: C.muted }));
                parts.push(text(it[1], W - pad, y, { size: 15, anchor: 'end', family: "'DM Mono',monospace" }));
                y += g(24);
            });
            if (o.top && o.top.length) {
                y += g(6);
                parts.push(text('LIGNES LES PLUS COTÉES', pad, y, { size: 9, fill: C.muted, spacing: 1.6 }));
                y += g(24);
                o.top.slice(0, 5).forEach(function (b) {
                    parts.push(text(String(b.code || ''), pad, y, { size: 14, fill: C.gold, family: "'DM Mono',monospace" }));
                    const nm = (b.nom || '').slice(0, 34);
                    if (nm) parts.push(text(nm, pad + 120, y, { size: 12, fill: C.muted }));
                    parts.push(text(money(b.cours) + ' F', W - pad, y, { size: 13, anchor: 'end', family: "'DM Mono',monospace" }));
                    y += g(26);
                });
            }
            y += g(16);
        }

        /* — Dividendes à venir — */
        if (options.blocs.dividendes && data.dividendesAVenir && data.dividendesAVenir.length) {
            y = section(parts, 'Dividendes à venir', pad, y, inner, text, rule, g, 'calendar');
            data.dividendesAVenir.forEach(function (d) {
                parts.push(text(d.ticker, pad, y, { size: 15, fill: C.gold, family: "'Playfair Display',serif", weight: 500 }));
                const nm = (d.nom || '').slice(0, 24);
                if (nm) parts.push(text(nm, pad + 90, y, { size: 12, fill: C.muted }));
                parts.push(text(typeof TC.fmtDate === 'function' ? TC.fmtDate(d.detach) : String(d.detach || ''), W - pad - 210, y, { size: 13, anchor: 'end', fill: C.muted, family: "'DM Mono',monospace" }));
                parts.push(text(d.montant != null ? money(d.montant) + ' F' : '—', W - pad - 90, y, { size: 13, anchor: 'end', family: "'DM Mono',monospace" }));
                parts.push(text(d.rdt != null ? (d.rdt <= 1.5 ? (d.rdt * 100) : d.rdt).toFixed(2) + ' %' : '—', W - pad, y, { size: 13, anchor: 'end', family: "'DM Mono',monospace", fill: C.green }));
                y += g(25);
            });
            y += g(16);
        }

        /* — Change / parité XOF — fait réglementaire fixe, pas une cotation
           du jour : un bandeau fin, avant le pied de page. */
        if (options.blocs.chiffres) {
            y += g(6);
            parts.push(glyph('coin', pad, y, { color: C.gold }));
            parts.push(text('1 € = ' + XOF_PER_EUR.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' FCFA', pad + 22, y, { size: 13, family: "'DM Mono',monospace", fill: C.ink }));
            parts.push(text('Parité fixe UEMOA / zone euro', W - pad, y, { size: 12, anchor: 'end', fill: C.muted }));
            y += g(30);
        }

        /* — Pied de page — source, mention réglementaire, abonnement,
           copyright. Toujours quatre lignes, jamais tronqué : la hauteur
           du canevas s'ajuste plus bas si le contenu déborde. */
        const footLines = 2;
        const footH = 22 + footLines * 18;
        const footYIdeal = H - Math.round(pad * 0.72);
        const footTop = Math.max(footYIdeal - footH, Math.round(y + g(30)));
        const footY = footTop + footH;
        parts.push(rule(footTop - 10, 0.22));
        parts.push(text('Données de séance The Capital · sources BRVM', pad, footTop + 16, { size: 12, fill: C.muted }));
        parts.push(text('Information à caractère informatif — ne constitue pas un conseil en investissement.', pad, footTop + 36, { size: 10.5, fill: C.muted }));
        parts.push(text('thecapitalinvest.com · abonnement Investor', W - pad, footTop + 16, { size: 12, fill: C.gold, anchor: 'end', family: "'DM Mono',monospace" }));
        parts.push(text('© ' + data.window.to.slice(0, 4) + ' The Capital — Tous droits réservés.', W - pad, footTop + 36, { size: 10.5, fill: C.muted, anchor: 'end' }));

        /* Le contenu peut dépasser le format choisi : on prévient plutôt que
           de tronquer silencieusement une section. */
        const overflow = y > (footTop - 44);
        /* Filet de sécurité : si même après compression (gap) le contenu
           déborde encore du format social choisi, le canevas grandit pour
           l'accueillir. Mieux vaut une image plus haute qu'un tableau coupé
           en plein milieu — ce n'est jamais un compromis acceptable. */
        const neededH = footY + Math.round(pad * 0.5);
        if (neededH > H) H = neededH;

        return {
            bodyTop: bodyTop, footTop: footTop - 44,
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
                '" viewBox="0 0 ' + W + ' ' + H + '" font-family="\'DM Sans\',sans-serif">' + parts.join('') + '</svg>',
            width: W, height: H, overflow, contentBottom: Math.round(y), grew: H > H0
        };
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

    /* ── Bannière fournie (image /assets), en base64 comme le logo ── */

    async function loadBanner() {
        if (bannerData !== null) return bannerData;
        /* Ne dépend pas d'un config.js éventuellement en cache : l'URL a un
           repli en dur. */
        const url = (TC.env && TC.env.BANNER) || '/assets/banniere-seance-1min.png';
        try {
            const r = await fetch(url, { cache: 'no-cache' });
            if (!r.ok) throw new Error('bannière absente (' + r.status + ')');
            const blob = await r.blob();
            bannerData = await new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            /* Ratio réel de l'image, pour poser la bande à la bonne hauteur. */
            bannerRatio = await new Promise(function (resolve) {
                const img = new Image();
                img.onload = () => resolve(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.32);
                img.onerror = () => resolve(0.32);
                img.src = bannerData;
            });
        } catch (e) {
            bannerData = '';
            console.warn('[REPORTING] Bannière /assets non chargée, repli SVG :', e && e.message);
        }
        return bannerData;
    }

    /* ── Génération ──────────────────────────────────────── */

    async function generate() {
        const periode = TC.qs('#rep-periodes .subtab.active').dataset.periode;
        const ref = TC.val('rep-date') || TC.today();
        const w = windowFor(periode, ref);

        TC.say('rep-msg', 'Lecture des données…', 'info');
        TC.el('rep-stage').innerHTML = '<div class="loading"><div class="spinner"></div>Agrégation de la période…</div>';

        await Promise.all([loadLogo(), loadBanner()]);
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
