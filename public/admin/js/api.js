/* ── RAFRAÎCHISSEMENT TOKEN SUPABASE ─────────────────────────── */
async function refreshSession() {
    const raw = localStorage.getItem(SK);
    if (!raw) return false;
    let sess;
    try { sess = JSON.parse(raw); } catch(e) { return false; }
    const refresh = sess && sess.data && sess.data.session && sess.data.session.refresh_token ? sess.data.session.refresh_token : (sess && sess.session && sess.session.refresh_token ? sess.session.refresh_token : (sess && sess.refresh_token ? sess.refresh_token : ''));
    if (!refresh) return false;
    try {
        const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh })
        });
        const data = await r.json();
        if (!r.ok || !data.access_token) return false;
        if (sess.data && sess.data.session) {
            sess.data.session.access_token = data.access_token;
            sess.data.session.refresh_token = data.refresh_token;
            sess.data.session.expires_at  = data.expires_at;
            if (data.user) sess.data.user = data.user;
        } else if (sess.session) {
            sess.session.access_token = data.access_token;
            sess.session.refresh_token = data.refresh_token;
            sess.session.expires_at  = data.expires_at;
            if (data.user) sess.user = data.user;
        } else {
            sess.access_token = data.access_token;
            sess.refresh_token = data.refresh_token;
            sess.expires_at = data.expires_at;
        }
        localStorage.setItem(SK, JSON.stringify(sess));
        TK = data.access_token;
        return true;
    } catch(e) { return false; }
}

async function ensureAuth() {
    const raw = localStorage.getItem(SK);
    if (!raw) return false;
    let sess;
    try { sess = JSON.parse(raw); } catch(e) { return false; }
    const session = sess && sess.data && sess.data.session ? sess.data.session : (sess && sess.session ? sess.session : sess);
    const expiresAt = session && session.expires_at ? session.expires_at : null;
    if (expiresAt && (Date.now()/1000) > (expiresAt - 120)) return await refreshSession();
    return true;
}

function sbHeaders(extra) {
    var base = { apikey: SB_ANON, Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (extra) {
        for (var k in extra) base[k] = extra[k];
    }
    return base;
}

async function sbGet(table, params) {
    try {
        const url = SB_REST + '/' + table + (params ? '?' + params : '');
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 10000);
        const r = await fetch(url, { headers: sbHeaders(), signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) { const e = await r.json().catch(function() { return {}; }); toast((e && e.message || 'Erreur lecture') + ' [' + table + ']', 'err'); return null; }
        return r.json();
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return null;
    }
}

async function sbCount(table, params) {
    try {
        const cleanParams = params ? String(params).replace(/select=[^&]*/g, '').replace(/^&|&$/g, '') : '';
        const url = SB_REST + '/' + table + '?select=*&limit=0' + (cleanParams ? '&' + cleanParams : '');
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 8000);
        const r = await fetch(url, {
            headers: Object.assign({}, sbHeaders(), { Prefer: 'count=exact', Range: '0-0' }),
            signal: ctrl.signal
        });
        clearTimeout(t);
        if (!r.ok) { console.warn('sbCount [' + table + '] HTTP ' + r.status); return 0; }
        const range = r.headers.get('content-range');
        return parseInt(range ? range.split('/')[1] : '0') || 0;
    } catch(e) {
        console.error('sbCount [' + table + '] error:', e.message);
        return 0;
    }
}

async function sbPost(table, body, onConflict) {
    try {
        var prefer = onConflict ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
        var url    = onConflict ? SB_REST + '/' + table + '?on_conflict=' + onConflict : SB_REST + '/' + table;

        if (table === 'dividendes_calendrier') {
            var payload = Array.isArray(body) ? body : [body];
            payload.forEach(function(item){
                if (!item.exercice) item.exercice = String(item.annee || new Date().getFullYear());
                else item.exercice = String(item.exercice);
            });
            body = Array.isArray(body) ? payload : payload[0];
        }

        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 15000);
        const r = await fetch(url, { method:'POST', headers: sbHeaders({ Prefer: prefer }), body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);

        if (!r.ok) {
            const e = await r.json().catch(function() { return {}; });
            var errMsg = e && e.message || e && e.details || JSON.stringify(e);

            if (errMsg) {
                if (errMsg.indexOf('foreign key') !== -1) {
                    var t = body && body.ticker ? ' "' + body.ticker + '"' : '';
                    errMsg = '⚠️ Ticker' + t + ' inexistant — créez-le d\'abord dans l\'onglet Entreprises.';
                } else if (errMsg.indexOf('duplicate') !== -1 || errMsg.indexOf('unique') !== -1) {
                    var t = body && body.ticker ? ' pour ' + body.ticker : '';
                    var d = body && body.date_seance ? ' du ' + body.date_seance : (body && body.annee ? ' ' + body.annee : '');
                    errMsg = '⚠️ Entrée déjà existante' + t + d + ' — utilisez ✎ pour modifier.';
                } else if (errMsg.indexOf('null value') !== -1 || errMsg.indexOf('not-null') !== -1) {
                    errMsg = '⚠️ Un champ obligatoire est vide — vérifiez ticker, date et valeur principale.';
                } else if (errMsg.indexOf('invalid input syntax') !== -1) {
                    errMsg = '⚠️ Format invalide — vérifiez que les nombres ne contiennent pas de lettres.';
                } else if (errMsg.indexOf('permission') !== -1 || errMsg.indexOf('policy') !== -1) {
                    errMsg = '⚠️ Accès refusé — vérifiez les permissions RLS dans Supabase.';
                } else if (errMsg.indexOf('relation') !== -1 && errMsg.indexOf('does not exist') !== -1) {
                    errMsg = '⚠️ Table introuvable dans Supabase.';
                } else if (errMsg.indexOf('too long') !== -1) {
                    errMsg = '⚠️ Valeur trop longue dans un des champs.';
                }
            }

            if (/jwt|expired/i.test(errMsg)) {
                const refreshed = await refreshSession();
                if (refreshed) {
                    const retry = await fetch(url, { method:'POST', headers: sbHeaders({ Prefer: prefer }), body: JSON.stringify(body) });
                    if (retry.ok) return retry.json();
                }
            }
            toast(errMsg + ' [' + table + ']', 'err');
            return null;
        }
        return r.json();
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return null;
    }
}

async function sbPatch(table, filter, body) {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 10000);
        const r = await fetch(SB_REST + '/' + table + '?' + filter, { method:'PATCH', headers: sbHeaders(), body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) {
            const e = await r.json().catch(function() { return {}; });
            var raw = e && e.message || e && e.details || 'Erreur MAJ';
            if (raw.indexOf('foreign key') !== -1)       raw = '⚠️ Référence invalide — le Je vais continuer le découpage des fichiers restants. Voici la suite complète :

---

### 5. `public/admin/js/api.js` (suite)

```javascript
            if (raw.indexOf('foreign key') !== -1)       raw = '⚠️ Référence invalide — le ticker lié n\'existe pas.';
            else if (raw.indexOf('duplicate') !== -1 || raw.indexOf('unique') !== -1) raw = '⚠️ Doublon — cette entrée existe déjà.';
            else if (raw.indexOf('null value') !== -1)   raw = '⚠️ Champ obligatoire vide.';
            else if (raw.indexOf('permission') !== -1 || raw.indexOf('policy') !== -1) raw = '⚠️ Accès refusé — vérifiez les permissions RLS.';
            else if (raw.indexOf('jwt') !== -1 || raw.indexOf('expired') !== -1) raw = '⚠️ Session expirée — reconnectez-vous.';
            toast(raw, 'err'); return null;
        }
        return r.json();
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return null;
    }
}

async function sbDel(table, filter) {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 10000);
        const r = await fetch(SB_REST + '/' + table + '?' + filter, { method:'DELETE', headers: sbHeaders(), signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) {
            const e = await r.json().catch(function() { return {}; });
            var raw = e && e.message || e && e.details || 'Erreur suppression';
            if (raw.indexOf('foreign key') !== -1)       raw = '⚠️ Suppression impossible — d\'autres données dépendent de cet élément.';
            else if (raw.indexOf('permission') !== -1 || raw.indexOf('policy') !== -1) raw = '⚠️ Accès refusé — vérifiez les permissions RLS.';
            else if (raw.indexOf('jwt') !== -1 || raw.indexOf('expired') !== -1) raw = '⚠️ Session expirée — reconnectez-vous.';
            toast(raw, 'err'); return false;
        }
        return true;
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return false;
    }
}
