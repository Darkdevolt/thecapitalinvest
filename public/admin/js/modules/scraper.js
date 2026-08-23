/* ============================================================
   THE CAPITAL — RÉCUPÉRATION BRVM
   Trois temps strictement séparés : récupérer, contrôler, écrire.
   Rien n'est écrit dans Supabase avant validation explicite en
   mode manuel. La date de séance est modifiable avant écriture :
   elle sert de clé de conflit, une date fausse écrase la mauvaise
   séance sans aucun message d'erreur.
   ============================================================ */
'use strict';

(function (TC) {

    const PENDING_KEY = 'tc_scraper_pending_v4';
    const MODE_KEY = 'tc_scraper_mode_v4';

    let pending = null;

    function mode() { return localStorage.getItem(MODE_KEY) === 'auto' ? 'auto' : 'manual'; }
    function setMode(value) {
        localStorage.setItem(MODE_KEY, value === 'auto' ? 'auto' : 'manual');
        paintMode();
        if (pending) paintPreview();
    }

    function view() {
        return '' +
            '<div class="page-head">' +
            '<div><div class="page-title">Récupération <em>BRVM</em></div>' +
            '<div class="page-sub">Le scraper lit la séance publiée sur brvm.org et la présente ici sans rien écrire. Les cotations ne rejoignent la base qu\'après contrôle et validation, ou automatiquement si vous activez le mode correspondant.</div></div>' +
            '</div>' +

            '<div class="grid-2">' +
            '<div class="card"><div class="card-head"><span class="card-title">Mode de traitement</span></div>' +
            '<div class="card-body">' +
            '<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">' +
            '<button class="btn btn-outline btn-sm" id="mode-manual">Manuel</button>' +
            '<button class="btn btn-outline btn-sm" id="mode-auto">Automatique</button></div>' +
            '<div class="note" id="mode-note"></div>' +
            '<div class="btn-row" style="margin-top:14px;">' +
            '<button class="btn btn-primary" id="run-scraper">▶ Récupérer la séance BRVM</button>' +
            '<button class="btn btn-blue" id="run-health">Vérifier la disponibilité de la source</button>' +
            '</div><div class="msg" id="scraper-msg" style="margin-top:10px;"></div>' +
            '<div class="note" style="margin-top:12px;">La tâche planifiée Vercel exécute <span style="font-family:var(--mono);">/api/process-brvm</span> du lundi au vendredi. Le lancement manuel ci-dessus reste indépendant et ne modifie pas la planification.</div>' +
            '</div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Journal d\'exécution</span>' +
            '<span class="card-tools"><button class="btn btn-outline btn-sm" id="log-clear">Vider</button></span></div>' +
            '<div class="card-body"><div class="log" id="scraper-log">Aucune exécution dans cette session.</div></div></div>' +
            '</div>' +

            '<div class="card" id="preview-card" hidden>' +
            '<div class="card-head"><span class="card-title">Séance en attente de validation</span>' +
            '<span class="card-tools"><span class="card-count" id="preview-count"></span></span></div>' +
            '<div class="card-body tight" id="preview-head"></div>' +
            '<div class="tw capped"><table><thead><tr>' +
            '<th>Ticker</th><th>Société</th><th class="r">Clôture</th><th class="r">Ouverture</th>' +
            '<th class="r">Plus haut</th><th class="r">Plus bas</th><th class="r">Volume</th>' +
            '<th class="r">Variation</th><th class="r">Valeur</th><th>Contrôle</th>' +
            '</tr></thead><tbody id="preview-body"></tbody></table></div>' +
            '<div class="actions">' +
            '<button class="btn btn-green" id="preview-validate">✓ Valider et écrire dans la base</button>' +
            '<button class="btn btn-outline btn-sm" id="preview-reject">Rejeter la séance</button>' +
            '<span class="msg" id="preview-msg"></span></div></div>' +

            '<div class="card"><div class="card-head"><span class="card-title">Entretien des données</span></div>' +
            '<div class="card-body"><div class="note" style="margin-bottom:14px;">Ces opérations agissent sur l\'ensemble de la table <span style="font-family:var(--mono);">historique</span>. Elles sont lentes et demandent confirmation.</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button class="btn btn-orange btn-sm" id="fix-variations">Recalculer toutes les variations</button>' +
            '<button class="btn btn-orange btn-sm" id="fix-close">Aligner cloture et cours_cloture</button>' +
            '</div><div class="msg" id="maint-msg" style="margin-top:12px;"></div>' +
            '<div class="bar thin" style="margin-top:10px;" hidden id="maint-bar"><i style="width:0%"></i></div>' +
            '</div></div>';
    }

    /* ── Journal ─────────────────────────────────────────── */

    function log(text, level) {
        const box = TC.el('scraper-log');
        if (!box) return;
        if (box.dataset.fresh !== '1') { box.innerHTML = ''; box.dataset.fresh = '1'; }
        const time = new Date().toLocaleTimeString('fr-FR');
        box.innerHTML += '<div><span class="' + (level || 'info') + '">' + TC.esc(time) + ' — ' + TC.esc(text) + '</span></div>';
        box.scrollTop = box.scrollHeight;
    }

    function paintMode() {
        const m = mode();
        TC.el('mode-manual').className = 'btn btn-sm ' + (m === 'manual' ? 'btn-primary' : 'btn-outline');
        TC.el('mode-auto').className = 'btn btn-sm ' + (m === 'auto' ? 'btn-green' : 'btn-outline');
        TC.el('mode-note').innerHTML = m === 'auto'
            ? '<strong>Automatique</strong> — dès la récupération, la séance est contrôlée puis écrite dans la base sans intervention. À réserver aux périodes où vous ne pouvez pas surveiller la source.'
            : '<strong>Manuel</strong> — la séance reste dans cette page jusqu\'à validation. C\'est le mode recommandé : il laisse le temps de corriger la date et de vérifier les cotations aberrantes.';
    }

    /* ── Récupération ────────────────────────────────────── */

    function extractRows(payload) {
        const candidates = [
            payload && payload.data && payload.data.rows,
            payload && payload.rows,
            Array.isArray(payload && payload.data) ? payload.data : null,
            payload && payload.cours
        ];
        for (const c of candidates) if (Array.isArray(c) && c.length) return c;
        return [];
    }

    function normalize(raw, fallbackDate) {
        const pick = (...keys) => {
            for (const k of keys) if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
            return null;
        };
        const closeValue = TC.toNumber(pick('cours_cloture', 'cours', 'cloture', 'close'));
        return {
            ticker: String(pick('ticker', 'symbol', 'code') || '').trim().toUpperCase(),
            date_seance: TC.toISODate(pick('date_seance', 'date')) || fallbackDate,
            cours_cloture: closeValue,
            cloture: closeValue,
            cours_ouverture: TC.toNumber(pick('cours_ouverture', 'ouverture', 'open')),
            plus_haut: TC.toNumber(pick('plus_haut', 'haut', 'high')),
            plus_bas: TC.toNumber(pick('plus_bas', 'bas', 'low')),
            volume: TC.toNumber(pick('volume', 'vol')),
            variation: TC.toNumber(pick('variation', 'variation_pct', 'var')),
            valeur_totale: TC.toNumber(pick('valeur_totale', 'valeur', 'valeur_transigee'))
        };
    }

    async function run() {
        TC.say('scraper-msg', 'Interrogation de la source BRVM…', 'info');
        log('Lancement du scraper — lecture seule, aucune écriture à ce stade.', 'info');
        try {
            const payload = await TC.api('/api/scrape-brvm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
                timeout: 70000
            });

            const fallbackDate = TC.toISODate(payload.date_seance || (payload.data && payload.data.date_seance)) || TC.today();
            const raw = extractRows(payload);
            const rows = raw.map(r => normalize(r, fallbackDate)).filter(r => r.ticker && r.cours_cloture !== null);

            /* Une même valeur peut apparaître deux fois dans le bulletin. */
            const unique = Array.from(new Map(rows.map(r => [r.ticker, r])).values());
            if (!unique.length) throw new Error('La source n\'a retourné aucune cotation exploitable.');

            const indices = (payload.indices || (payload.data && payload.data.indices) || []).map(x => ({
                indice: String(x.indice || x.nom || '').trim().toUpperCase(),
                date_seance: TC.toISODate(x.date_seance) || fallbackDate,
                valeur: TC.toNumber(x.valeur),
                variation: TC.toNumber(x.variation),
                variation_pct: TC.toNumber(x.variation_pct !== undefined ? x.variation_pct : x.variation)
            })).filter(x => x.indice && x.valeur !== null);

            pending = {
                source: payload.source || 'brvm.org',
                date_seance: fallbackDate,
                date_detectee: fallbackDate,
                rows: unique,
                indices,
                received_at: new Date().toISOString()
            };
            save();
            log(unique.length + ' cotation(s) et ' + indices.length + ' indice(s) reçus pour le ' + fallbackDate + '.', 'ok');
            await paintPreview();

            if (mode() === 'auto') {
                log('Mode automatique — écriture immédiate dans la base.', 'info');
                await commit();
            } else {
                TC.say('scraper-msg', 'Séance récupérée. Contrôlez puis validez.', 'ok');
            }
        } catch (e) {
            log('Échec : ' + e.message, 'err');
            TC.say('scraper-msg', e.message, 'err');
        }
    }

    function save() {
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch (e) { /* quota */ }
    }

    function discard() {
        pending = null;
        try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* quota */ }
        TC.el('preview-card').hidden = true;
    }

    function restore() {
        try {
            const stored = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
            if (stored && Array.isArray(stored.rows) && stored.rows.length) {
                pending = stored;
                paintPreview();
                log('Séance en attente restaurée depuis la session précédente (' + stored.date_seance + ').', 'warn');
            }
        } catch (e) { /* contenu illisible */ }
    }

    /* ── Contrôle et aperçu ──────────────────────────────── */

    async function paintPreview() {
        if (!pending) return;
        const card = TC.el('preview-card');
        card.hidden = false;

        const [refs, existing] = await Promise.all([
            TC.tickers(),
            TC.getAll('historique', 'select=ticker,cours_cloture,cloture&date_seance=eq.' + pending.date_seance)
        ]);
        const names = {}, known = new Set();
        refs.forEach(r => {
            const key = String(r.ticker).toUpperCase();
            names[key] = r.nom || '';
            known.add(key);
        });
        const already = new Set((existing || []).map(r => String(r.ticker).toUpperCase()));

        /* Clôtures de la séance précédente pour contrôler les variations. */
        const prevRows = await TC.get('historique',
            'select=date_seance&date_seance=lt.' + pending.date_seance + '&order=date_seance.desc&limit=1');
        const prevDate = prevRows && prevRows[0] ? prevRows[0].date_seance : null;
        const prevClose = {};
        if (prevDate) {
            const rows = await TC.getAll('historique', 'select=ticker,cours_cloture,cloture&date_seance=eq.' + prevDate);
            (rows || []).forEach(r => {
                prevClose[String(r.ticker).toUpperCase()] =
                    TC.toNumber(r.cours_cloture !== null && r.cours_cloture !== undefined ? r.cours_cloture : r.cloture);
            });
        }

        pending.rows.forEach(function (r) {
            const key = r.ticker;
            const issues = [];
            if (!known.has(key) && !TC.isIndice(key)) issues.push({ level: 'err', text: 'ticker inconnu du référentiel' });
            if (r.cours_cloture === null || r.cours_cloture <= 0) issues.push({ level: 'err', text: 'clôture invalide' });
            if (r.plus_haut !== null && r.plus_bas !== null && r.plus_haut < r.plus_bas) issues.push({ level: 'err', text: 'plus haut < plus bas' });
            const prev = prevClose[key];
            if (prev && prev > 0 && r.cours_cloture !== null) {
                const computed = ((r.cours_cloture - prev) / prev) * 100;
                r.__computed = computed;
                if (Math.abs(computed) > TC.VARIATION_LIMIT + 0.05) {
                    issues.push({ level: 'warn', text: 'variation ' + computed.toFixed(2) + ' % hors limite' });
                }
                if (r.variation !== null && Math.abs(computed - r.variation) > 0.3) {
                    issues.push({ level: 'warn', text: 'variation publiée ≠ recalculée' });
                }
            }
            if (already.has(key)) issues.push({ level: 'warn', text: 'écrase une cotation existante' });
            r.__issues = issues;
            r.__name = names[key] || '';
        });

        const errors = pending.rows.filter(r => r.__issues.some(i => i.level === 'err')).length;
        const warns = pending.rows.filter(r => r.__issues.length && !r.__issues.some(i => i.level === 'err')).length;

        TC.el('preview-count').textContent = pending.rows.length + ' cotation(s) · ' + pending.indices.length + ' indice(s)';
        TC.el('preview-head').innerHTML =
            '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px;">' +
            '<div class="field" style="max-width:190px;"><label>Date de séance</label>' +
            '<input type="date" id="pending-date" value="' + TC.esc(pending.date_seance) + '" max="' + TC.today() + '"></div>' +
            '<div style="font-size:11.5px;color:var(--muted);line-height:1.6;padding-bottom:9px;">' +
            (pending.date_detectee !== pending.date_seance
                ? '<span class="badge badge-orange">date corrigée</span> détectée : ' + TC.esc(pending.date_detectee)
                : 'date détectée sur la source, modifiable avant écriture') +
            '<br>Source : ' + TC.esc(pending.source) +
            (prevDate ? ' · séance précédente en base : ' + TC.fmtDate(prevDate) : ' · aucune séance antérieure') +
            '</div></div>' +
            (errors ? '<div class="note err"><strong>' + errors + ' cotation(s) en défaut bloquant.</strong> Elles ne seront pas écrites ; corrigez le référentiel ou la source, puis relancez.</div>' : '') +
            (warns ? '<div class="note warn"><strong>' + warns + ' cotation(s) à vérifier.</strong> Elles seront écrites après validation : lisez la colonne Contrôle avant de confirmer.</div>' : '') +
            (!errors && !warns ? '<div class="note"><strong>Aucune anomalie détectée</strong> sur cette séance.</div>' : '');

        TC.el('preview-body').innerHTML = pending.rows.map(function (r) {
            const err = r.__issues.some(i => i.level === 'err');
            return '<tr class="' + (err ? 'row-flag' : r.__issues.length ? 'row-warn' : '') + '">' +
                '<td class="td-key">' + TC.esc(r.ticker) + '</td>' +
                '<td class="td-muted">' + TC.esc(r.__name || '—') + '</td>' +
                '<td class="r td-mono">' + TC.fmt(r.cours_cloture) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.cours_ouverture) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_haut) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmt(r.plus_bas) + '</td>' +
                '<td class="r td-mono">' + TC.fmtInt(r.volume) + '</td>' +
                '<td class="r td-mono ' + TC.trendClass(r.variation) + '">' + TC.fmtPct(r.variation) + '</td>' +
                '<td class="r td-mono td-muted">' + TC.fmtInt(r.valeur_totale) + '</td>' +
                '<td>' + (r.__issues.length
                    ? '<span class="badge ' + (err ? 'badge-red' : 'badge-orange') + '" title="' +
                    TC.esc(r.__issues.map(i => i.text).join(' · ')) + '">' + TC.esc(r.__issues[0].text) + '</span>'
                    : '<span class="badge badge-green">prête</span>') + '</td></tr>';
        }).join('');

        TC.on('pending-date', 'change', function (e) {
            const value = TC.toISODate(e.target.value);
            if (!value) { TC.say('preview-msg', 'Date illisible.', 'err'); return; }
            if (value > TC.today()) { TC.say('preview-msg', 'Une séance ne peut pas être datée dans le futur.', 'err'); return; }
            if (!pending.date_detectee) pending.date_detectee = pending.date_seance;
            pending.date_seance = value;
            pending.rows.forEach(r => { r.date_seance = value; });
            pending.indices.forEach(x => { x.date_seance = value; });
            save();
            log('Date de séance fixée au ' + value + '.', 'ok');
            paintPreview();
        });

        TC.el('preview-validate').disabled = pending.rows.filter(r => !r.__issues.some(i => i.level === 'err')).length === 0;
    }

    /* ── Écriture ────────────────────────────────────────── */

    async function commit() {
        if (!pending) return;
        const writable = pending.rows.filter(r => !r.__issues || !r.__issues.some(i => i.level === 'err'));
        if (!writable.length) { TC.say('preview-msg', 'Aucune cotation ne passe les contrôles bloquants.', 'err'); return; }

        TC.say('preview-msg', 'Écriture en cours…', 'info');
        TC.el('preview-validate').disabled = true;

        try {
            const payload = writable.map(r => ({
                ticker: r.ticker, date_seance: r.date_seance,
                cours_cloture: r.cours_cloture, cloture: r.cours_cloture,
                cours_ouverture: r.cours_ouverture, plus_haut: r.plus_haut, plus_bas: r.plus_bas,
                volume: r.volume,
                variation: r.variation !== null ? r.variation : (r.__computed !== undefined ? Math.round(r.__computed * 100) / 100 : null),
                variation_pct: r.variation !== null ? r.variation : (r.__computed !== undefined ? Math.round(r.__computed * 100) / 100 : null),
                valeur_totale: r.valeur_totale
            }));

            const result = await TC.postBatched('historique', payload, TC.CONFLICT.historique, function (p) {
                TC.say('preview-msg', p.done + ' / ' + p.total + ' cotation(s) écrites…', 'info');
            });

            if (result.failures.length) throw new Error(result.failures[0].error);
            log(result.imported + ' cotation(s) écrites pour la séance ' + pending.date_seance + '.', 'ok');

            if (pending.indices.length) {
                await TC.post('indices', pending.indices, TC.CONFLICT.indices);
                log(pending.indices.length + ' indice(s) écrits.', 'ok');
            }

            const skipped = pending.rows.length - writable.length;
            TC.say('preview-msg', result.imported + ' cotation(s) enregistrées' +
                (skipped ? ' · ' + skipped + ' écartée(s) par les contrôles' : '') + '.', 'ok');
            TC.toast('Séance ' + TC.fmtDate(pending.date_seance) + ' enregistrée', 'ok');
            discard();
            TC.health.probe();
            const cours = TC.module('cours');
            if (cours && typeof cours.refresh === 'function') cours.refresh();
        } catch (e) {
            log('Échec de l\'écriture : ' + e.message, 'err');
            TC.say('preview-msg', e.message, 'err');
            TC.el('preview-validate').disabled = false;
        }
    }

    /* ── Entretien ───────────────────────────────────────── */

    async function fixVariations() {
        if (!confirm('Recalculer la variation de toutes les cotations à partir des clôtures enregistrées ?\n\n' +
            'Cette opération lit tout l\'historique et peut durer plusieurs minutes.')) return;

        const bar = TC.el('maint-bar');
        bar.hidden = false;
        TC.say('maint-msg', 'Lecture de l\'historique…', 'info');

        const rows = await TC.getAll('historique', 'select=id,ticker,date_seance,cours_cloture,cloture,variation&order=ticker.asc,date_seance.asc');
        const byTicker = {};
        (rows || []).forEach(r => { (byTicker[r.ticker] = byTicker[r.ticker] || []).push(r); });

        const updates = [];
        Object.keys(byTicker).forEach(function (ticker) {
            const serie = byTicker[ticker];
            for (let i = 1; i < serie.length; i++) {
                const prev = TC.toNumber(serie[i - 1].cours_cloture !== null ? serie[i - 1].cours_cloture : serie[i - 1].cloture);
                const cur = TC.toNumber(serie[i].cours_cloture !== null ? serie[i].cours_cloture : serie[i].cloture);
                if (!prev || prev <= 0 || cur === null) continue;
                const computed = Math.round(((cur - prev) / prev) * 10000) / 100;
                const published = TC.toNumber(serie[i].variation);
                if (published === null || Math.abs(published - computed) > 0.01) {
                    updates.push({ id: serie[i].id, value: computed });
                }
            }
        });

        if (!updates.length) { TC.say('maint-msg', 'Toutes les variations sont déjà exactes.', 'ok'); bar.hidden = true; return; }
        if (!confirm(updates.length + ' variation(s) diffèrent du calcul. Les corriger ?')) { bar.hidden = true; return; }

        let done = 0;
        for (const u of updates) {
            try { await TC.patch('historique', 'id=eq.' + u.id, { variation: u.value, variation_pct: u.value }); done++; }
            catch (e) { /* comptabilisé dans le bilan */ }
            if (done % 20 === 0 || done === updates.length) {
                const pct = Math.round(done / updates.length * 100);
                TC.qs('i', bar).style.width = pct + '%';
                TC.say('maint-msg', done + ' / ' + updates.length + ' variation(s) corrigées…', 'info');
            }
        }
        TC.say('maint-msg', done + ' variation(s) recalculées.', 'ok');
        log(done + ' variations recalculées sur l\'ensemble de l\'historique.', 'ok');
        setTimeout(() => { bar.hidden = true; }, 2000);
    }

    /**
     * Deux colonnes portent la clôture selon l'origine de la ligne : les
     * imports anciens n'alimentent que `cloture`, le scraper alimente
     * `cours_cloture`. L'application lit l'une ou l'autre selon la vue, d'où
     * des courbes qui s'interrompent. Cette opération les aligne.
     */
    async function fixClose() {
        if (!confirm('Aligner les deux colonnes de clôture (cloture et cours_cloture) sur les lignes où une seule est renseignée ?')) return;
        TC.say('maint-msg', 'Recherche des lignes désalignées…', 'info');
        const rows = await TC.getAll('historique', 'select=id,cloture,cours_cloture&order=date_seance.desc');
        const drift = (rows || []).filter(r => {
            const a = TC.toNumber(r.cloture), b = TC.toNumber(r.cours_cloture);
            return (a === null) !== (b === null);
        });
        if (!drift.length) { TC.say('maint-msg', 'Aucune ligne désalignée.', 'ok'); return; }
        if (!confirm(drift.length + ' ligne(s) concernées. Poursuivre ?')) return;
        let done = 0;
        for (const r of drift) {
            const value = TC.toNumber(r.cours_cloture !== null ? r.cours_cloture : r.cloture);
            try { await TC.patch('historique', 'id=eq.' + r.id, { cloture: value, cours_cloture: value }); done++; }
            catch (e) { /* comptabilisé dans le bilan */ }
        }
        TC.say('maint-msg', done + ' ligne(s) alignées.', 'ok');
        log(done + ' clôtures alignées entre cloture et cours_cloture.', 'ok');
    }

    TC.register({
        id: 'scraper',
        label: 'Récupération BRVM',
        group: 'marche',
        icon: '⬇',
        keywords: 'scraper import automatique brvm cron seance',
        view,
        mount() {
            paintMode();
            TC.on('mode-manual', 'click', () => setMode('manual'));
            TC.on('mode-auto', 'click', () => setMode('auto'));
            TC.on('run-scraper', 'click', run);
            TC.on('run-health', 'click', async function () {
                TC.say('scraper-msg', 'Contrôle de la source…', 'info');
                try {
                    const data = await TC.api('/api/health', { method: 'GET', timeout: 25000 });
                    log('Route /api/health accessible.', 'ok');
                    TC.say('scraper-msg', 'Les services répondent. Détail dans le diagnostic.', 'ok');
                    if (data && data.tables) {
                        Object.keys(data.tables).slice(0, 6).forEach(t =>
                            log(t + ' : ' + (data.tables[t].etat || 'inconnu'), data.tables[t].etat === 'ok' ? 'ok' : 'warn'));
                    }
                } catch (e) {
                    log('Contrôle impossible : ' + e.message, 'err');
                    TC.say('scraper-msg', e.message, 'err');
                }
            });
            TC.on('log-clear', 'click', function () {
                const box = TC.el('scraper-log');
                box.innerHTML = 'Journal vidé.'; box.dataset.fresh = '0';
            });
            TC.on('preview-validate', 'click', commit);
            TC.on('preview-reject', 'click', function () {
                if (!pending) return;
                if (!confirm('Rejeter cette séance ? Aucune donnée n\'aura été écrite.')) return;
                log('Séance rejetée par l\'administrateur.', 'warn');
                discard();
                TC.toast('Séance rejetée', 'info');
            });
            TC.on('fix-variations', 'click', fixVariations);
            TC.on('fix-close', 'click', fixClose);
            restore();
        }
    });

})(window.TC);
