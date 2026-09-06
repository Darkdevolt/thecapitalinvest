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
   ============================================================ */
'use strict';

(function (TC) {

    const C = {
        bg: '#0A0804', panel: '#13110C', line: '#241C10',
        cream: '#F5F0E8', gold: '#B8964E', goldLight: '#D4AF6A',
        muted: '#8F887F', green: '#4ADE80', red: '#F87171'
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
        { id: 'indices', l: 'Indices de marché' },
        { id: 'hausses', l: 'Plus fortes hausses' },
        { id: 'baisses', l: 'Plus fortes baisses' },
        { id: 'volumes', l: 'Titres les plus échangés' },
        { id: 'activite', l: 'Activité du marché' },
        { id: 'note', l: 'Commentaire éditorial' }
    ];

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
            '<div class="card-body"><div class="toggle-list" id="rep-blocs">' +
            BLOCS.map(b => '<label class="toggle on"><input type="checkbox" data-bloc="' + b.id + '" checked>' +
                TC.esc(b.l) + '</label>').join('') + '</div></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Habillage</span></div>' +
            '<div class="form-grid" style="grid-template-columns:1fr;">' +
            TC.field({ id: 'rep-surtitre', label: 'Surtitre', placeholder: 'BRVM · Abidjan' }) +
            TC.field({ id: 'rep-bulletin', label: 'Référence', placeholder: 'Bulletin n° 128' }) +
            TC.field({ id: 'rep-note', label: 'Commentaire éditorial', type: 'textarea', rows: 4, placeholder: 'Une lecture en trois phrases : ce qui a porté le marché, ce qui l\'a freiné, ce qu\'il faut surveiller.' }) +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Production</span></div>' +
            '<div class="card-body"><div class="btn-row">' +
            '<button class="btn btn-primary" id="rep-build">Générer le reporting</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-png" disabled>⬇ PNG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-jpg" disabled>⬇ JPEG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-svg" disabled>⬇ SVG</button>' +
            '<button class="btn btn-outline btn-sm" id="rep-csv" disabled>⬇ Données (CSV)</button>' +
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

        const names = {};
        refs.forEach(r => { names[String(r.ticker).toUpperCase()] = r.nom || ''; });

        const close = r => TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
        const rows = (quotes || []).filter(r => !TC.isIndice(r.ticker) && close(r) !== null);

        if (!rows.length) return null;

        const sessions = Array.from(new Set(rows.map(r => r.date_seance))).sort();

        /* Par valeur : première et dernière clôture de la fenêtre. */
        const byTicker = {};
        rows.forEach(function (r) {
            const key = String(r.ticker).toUpperCase();
            const entry = byTicker[key] || (byTicker[key] = {
                ticker: r.ticker, nom: names[key] || '', first: null, last: null,
                firstDate: null, lastDate: null, volume: 0, valeur: 0, seances: 0,
                haut: null, bas: null
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

        return {
            window: w,
            sessions,
            values,
            indices: idxList,
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

    function build(data, options) {
        const [W, H] = options.format.split('x').map(Number);
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
        const rule = (ty, opacity) =>
            '<line x1="' + pad + '" y1="' + ty + '" x2="' + (W - pad) + '" y2="' + ty +
            '" stroke="' + C.gold + '" stroke-opacity="' + (opacity || 0.24) + '" stroke-width="1"/>';

        /* — Fond — */
        parts.push('<rect width="' + W + '" height="' + H + '" fill="' + C.bg + '"/>');
        parts.push('<rect x="0" y="0" width="' + W + '" height="' + Math.round(H * 0.004) + '" fill="' + C.gold + '"/>');

        /* — En-tête — */
        y = pad + 22;
        if (logoData) {
            parts.push('<image href="' + logoData + '" x="' + pad + '" y="' + (y - 34) + '" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>');
        }
        parts.push(text('THE · CAPITAL', pad + (logoData ? 66 : 0), y, {
            family: "'Playfair Display',serif", size: 27, weight: 700, spacing: 3.4
        }));
        parts.push(text(options.surtitre || 'BRVM · Bourse Régionale des Valeurs Mobilières',
            pad + (logoData ? 66 : 0), y + 22, { size: 14, fill: C.muted, spacing: 1.6 }));
        if (options.bulletin) {
            parts.push(text(options.bulletin, W - pad, y, { size: 14, fill: C.gold, anchor: 'end', family: "'DM Mono',monospace" }));
        }

        y += 52;
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

        /* — Bandeau d'activité — */
        y += g(40);
        if (options.blocs.activite) {
            const boxH = 108;
            parts.push('<rect x="' + pad + '" y="' + y + '" width="' + inner + '" height="' + boxH +
                '" fill="' + C.panel + '" stroke="' + C.line + '" rx="6"/>');
            const cells = [
                { l: 'Titres cotés', v: String(data.totals.titres) },
                { l: 'Hausse', v: String(data.totals.up), c: C.green },
                { l: 'Baisse', v: String(data.totals.down), c: C.red },
                { l: 'Stables', v: String(data.totals.flat) },
                { l: 'Valeur échangée', v: money(data.totals.valeur) }
            ];
            const cw = inner / cells.length;
            cells.forEach(function (cell, i) {
                const cx = pad + cw * i + cw / 2;
                parts.push(text(cell.l.toUpperCase(), cx, y + 34, { size: 11, fill: C.muted, anchor: 'middle', spacing: 1.5 }));
                parts.push(text(cell.v, cx, y + 76, {
                    size: 32, anchor: 'middle', family: "'DM Mono',monospace", fill: cell.c || C.cream, weight: 500
                }));
                if (i) parts.push('<line x1="' + (pad + cw * i) + '" y1="' + (y + 18) + '" x2="' + (pad + cw * i) +
                    '" y2="' + (y + boxH - 18) + '" stroke="' + C.line + '"/>');
            });
            y += boxH + g(40);
        }

        /* — Indices — */
        if (options.blocs.indices && data.indices.length) {
            y = section(parts, 'Indices de marché', pad, y, W, text, rule, g);
            data.indices.slice(0, 5).forEach(function (idx) {
                parts.push(text(idx.indice, pad, y, { size: 17 }));
                parts.push(text(idx.last.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    W - pad - 130, y, { size: 17, anchor: 'end', family: "'DM Mono',monospace" }));
                parts.push(text(pct(idx.perf), W - pad, y, {
                    size: 17, anchor: 'end', family: "'DM Mono',monospace",
                    fill: TC.toNumber(idx.perf) >= 0 ? C.green : C.red
                }));
                y += g(32);
            });
            y += g(18);
        }

        /* — Palmarès — */
        const podium = function (title, list, positive) {
            if (!list.length) return;
            y = section(parts, title, pad, y, W, text, rule, g);
            list.forEach(function (e, i) {
                parts.push(text(String(i + 1).padStart(2, '0'), pad, y, {
                    size: 13, fill: C.gold, family: "'DM Mono',monospace"
                }));
                parts.push(text(e.ticker, pad + 34, y, { size: 18, weight: 500, family: "'Playfair Display',serif", fill: C.gold }));
                const label = (e.nom || '').slice(0, 26);
                if (label) parts.push(text(label, pad + 34 + Math.max(72, e.ticker.length * 12), y, { size: 13, fill: C.muted }));
                parts.push(text(money(e.last), W - pad - 132, y, { size: 16, anchor: 'end', family: "'DM Mono',monospace" }));
                parts.push(text(pct(e.perf), W - pad, y, {
                    size: 17, anchor: 'end', family: "'DM Mono',monospace", weight: 500,
                    fill: positive ? C.green : C.red
                }));
                y += g(32);
            });
            y += g(18);
        };
        if (options.blocs.hausses) podium('Plus fortes hausses', data.hausses, true);
        if (options.blocs.baisses) podium('Plus fortes baisses', data.baisses, false);

        /* — Volumes — */
        if (options.blocs.volumes && data.volumes.length) {
            y = section(parts, 'Titres les plus échangés', pad, y, W, text, rule, g);
            const max = Math.max.apply(null, data.volumes.map(e => e.valeur)) || 1;
            data.volumes.forEach(function (e) {
                parts.push(text(e.ticker, pad, y, { size: 17, fill: C.gold, family: "'Playfair Display',serif", weight: 500 }));
                parts.push(text(money(e.valeur) + ' F', W - pad, y, { size: 15, anchor: 'end', family: "'DM Mono',monospace" }));
                const barY = y + 10;
                const barW = Math.max(6, (inner) * (e.valeur / max));
                parts.push('<rect x="' + pad + '" y="' + barY + '" width="' + inner + '" height="4" fill="' + C.line + '" rx="2"/>');
                parts.push('<rect x="' + pad + '" y="' + barY + '" width="' + barW + '" height="4" fill="' + C.gold + '" rx="2"/>');
                y += g(40);
            });
            y += g(8);
        }

        /* — Commentaire — */
        if (options.blocs.note && options.note) {
            y = section(parts, 'Lecture du marché', pad, y, W, text, rule, g);
            wrap(options.note, Math.floor(inner / 9.6)).slice(0, 7).forEach(function (line) {
                parts.push(text(line, pad, y, { size: 16, fill: C.cream }));
                y += g(27);
            });
            y += g(14);
        }

        /* — Pied — */
        const footY = H - Math.round(pad * 0.72);
        parts.push(rule(footY - 34, 0.22));
        parts.push(text('Données de séance The Capital · sources BRVM', pad, footY, { size: 12, fill: C.muted }));
        parts.push(text('thecapitalinvest', W - pad, footY, { size: 12, fill: C.gold, anchor: 'end', family: "'DM Mono',monospace" }));

        /* Le contenu peut dépasser le format choisi : on prévient plutôt que
           de tronquer silencieusement une section du palmarès. */
        const overflow = y > (footY - 44);

        return {
            bodyTop: bodyTop, footTop: footY - 44,
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
                '" viewBox="0 0 ' + W + ' ' + H + '" font-family="\'DM Sans\',sans-serif">' + parts.join('') + '</svg>',
            width: W, height: H, overflow, contentBottom: Math.round(y)
        };
    }

    function section(parts, title, pad, y, W, text, rule, g) {
        parts.push(text(title.toUpperCase(), pad, y, { size: 12, fill: C.gold, spacing: 2.4, weight: 500 }));
        parts.push(rule(y + 14, 0.2));
        return y + (g ? g(48) : 48);
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

        await loadLogo();
        const data = await collect(w);

        if (!data) {
            TC.el('rep-stage').innerHTML = '<div class="empty-state"><strong>Aucune cotation sur cette période</strong>' +
                'Du ' + TC.fmtDate(w.from) + ' au ' + TC.fmtDate(w.to) + ', la base ne contient aucune séance. ' +
                'Vérifiez le calendrier dans Cours &amp; historique.</div>';
            TC.say('rep-msg', 'Période vide : rien à publier.', 'warn');
            ['rep-png', 'rep-jpg', 'rep-svg', 'rep-csv'].forEach(id => { TC.el(id).disabled = true; });
            return;
        }

        const blocs = {};
        TC.qsa('#rep-blocs input[data-bloc]').forEach(cb => { blocs[cb.dataset.bloc] = cb.checked; });

        const options = {
            format: TC.val('rep-format') || '1080x1350',
            surtitre: TC.val('rep-surtitre'),
            bulletin: TC.val('rep-bulletin'),
            note: TC.val('rep-note'),
            blocs, gap: 1
        };

        /* Première passe pour mesurer, seconde pour occuper la hauteur. Sans
           cela, une séance étroite laisse la moitié du visuel vide et un mois
           chargé déborde sous le pied de page. */
        let output = build(data, options);
        const used = output.contentBottom - output.bodyTop;
        const available = output.footTop - output.bodyTop;
        if (used > 0) {
            const ratio = available / used;
            const gap = Math.min(1.85, Math.max(0.82, ratio));
            if (Math.abs(gap - 1) > 0.04) {
                options.gap = gap;
                output = build(data, options);
            }
        }

        report = { data, output, window: w };

        TC.el('rep-stage').innerHTML = output.svg;
        TC.el('rep-dims').textContent = output.width + ' × ' + output.height + ' px';
        ['rep-png', 'rep-jpg', 'rep-svg', 'rep-csv'].forEach(id => { TC.el(id).disabled = false; });

        TC.say('rep-msg', output.overflow
            ? 'Généré, mais le contenu dépasse le format choisi. Retirez un bloc ou passez au format Story.'
            : 'Reporting généré : ' + data.totals.titres + ' valeur(s) sur ' + data.totals.seances + ' séance(s).',
            output.overflow ? 'warn' : 'ok');

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
        }
    });

})(window.TC);
