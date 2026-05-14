import { CONFIG, SB_REST } from './config.js';
import { toast } from './utils.js';

let TK = '';

export function setToken(token) { TK = token; }
export function getToken() { return TK; }

export async function refreshSession() {
    const raw = localStorage.getItem(CONFIG.SK);
    if (!raw) return false;
    let sess;
    try { sess = JSON.parse(raw); } catch(e) { return false; }
    const refresh = sess?.data?.session?.refresh_token ?? sess?.session?.refresh_token ?? sess?.refresh_token ?? '';
    if (!refresh) return false;
    try {
        const r = await fetch(CONFIG.SB_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { apikey: CONFIG.SB_ANON, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh })
        });
        const data = await r.json();
        if (!r.ok || !data.access_token) return false;
        if (sess.data?.session) {
            sess.data.session.access_token = data.access_token;
            sess.data.session.refresh_token = data.refresh_token;
            sess.data.session.expires_at = data.expires_at;
            if (data.user) sess.data.user = data.user;
        } else if (sess.session) {
            sess.session.access_token = data.access_token;
            sess.session.refresh_token = data.refresh_token;
            sess.session.expires_at = data.expires_at;
        } else {
            sess.access_token = data.access_token;
            sess.refresh_token = data.refresh_token;
            sess.expires_at = data.expires_at;
        }
        localStorage.setItem(CONFIG.SK, JSON.stringify(sess));
        TK = data.access_token;
        return true;
    } catch(e) { return false; }
}

export async function ensureAuth() {
    const raw = localStorage.getItem(CONFIG.SK);
    if (!raw) return false;
    let sess;
    try { sess = JSON.parse(raw); } catch(e) { return false; }
    const session = sess?.data?.session ?? sess?.session ?? sess;
    const expiresAt = session?.expires_at ?? null;
    if (expiresAt && (Date.now()/1000) > (expiresAt - 120)) return await refreshSession();
    return true;
}

function sbHeaders(extra = {}) {
    return {
        apikey: CONFIG.SB_ANON,
        Authorization: 'Bearer ' + TK,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...extra
    };
}

export async function sbGet(table, params) {
    try {
        const url = SB_REST + '/' + table + (params ? '?' + params : '');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(url, { headers: sbHeaders(), signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            toast((e?.message || 'Erreur lecture') + ' [' + table + ']', 'err');
            return null;
        }
        return r.json();
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return null;
    }
}

export async function sbCount(table, params) {
    try {
        const cleanParams = params ? String(params).replace(/select=[^&]*/g, '').replace(/^&|&$/g, '') : '';
        const url = SB_REST + '/' + table + '?select=*&limit=0' + (cleanParams ? '&' + cleanParams : '');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(url, {
            headers: { ...sbHeaders(), Prefer: 'count=exact', Range: '0-0' },
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

export async function sbPost(table, body, onConflict) {
    try {
        let prefer = onConflict ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
        let url = onConflict ? SB_REST + '/' + table + '?on_conflict=' + onConflict : SB_REST + '/' + table;

        if (table === 'dividendes_calendrier') {
            const payload = Array.isArray(body) ? body : [body];
            payload.forEach(item => {
                if (!item.exercice) item.exercice = String(item.annee || new Date().getFullYear());
                else item.exercice = String(item.exercice);
            });
            body = Array.isArray(body) ? payload : payload[0];
        }

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(url, {
            method: 'POST',
            headers: sbHeaders({ Prefer: prefer }),
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
        clearTimeout(t);

        if (!r.ok) {
            let e = await r.json().catch(() => ({}));
            let errMsg = e?.message || e?.details || JSON.stringify(e);

            if (errMsg) {
                if (errMsg.indexOf('foreign key') !== -1) {
                    const t = body?.ticker ? ' "' + body.ticker + '"' : '';
                    errMsg = '⚠️ Ticker' + t + ' inexistant — créez-le d\'abord dans l\'onglet Entreprises.';
                } else if (errMsg.indexOf('duplicate') !== -1 || errMsg.indexOf('unique') !== -1) {
                    const t = body?.ticker ? ' pour ' + body.ticker : '';
                    const d = body?.date_seance ? ' du ' + body.date_seance : (body?.annee ? ' ' + body.annee : '');
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

export async function sbPatch(table, filter, body) {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(SB_REST + '/' + table + '?' + filter, {
            method: 'PATCH',
            headers: sbHeaders(),
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
        clearTimeout(t);
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            let raw = e?.message || e?.details || 'Erreur MAJ';
            if (raw.indexOf('foreign key') !== -1) raw = '⚠️ Référence invalide — le ticker lié n\'existe pas.';
            else if (raw.indexOf('duplicate') !== -1 || raw.indexOf('unique') !== -1) raw = '⚠️ Doublon — cette entrée existe déjà.';
            else if (raw.indexOf('null value') !== -1) raw = '⚠️ Champ obligatoire vide.';
            else if (raw.indexOf('permission') !== -1 || raw.indexOf('policy') !== -1) raw = '⚠️ Accès refusé — vérifiez les permissions RLS.';
            else if (raw.indexOf('jwt') !== -1 || raw.indexOf('expired') !== -1) raw = '⚠️ Session expirée — reconnectez-vous.';
            toast(raw, 'err');
            return null;
        }
        return r.json();
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return null;
    }
}

export async function sbDel(table, filter) {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(SB_REST + '/' + table + '?' + filter, {
            method: 'DELETE',
            headers: sbHeaders(),
            signal: ctrl.signal
        });
        clearTimeout(t);
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            let raw = e?.message || e?.details || 'Erreur suppression';
            if (raw.indexOf('foreign key') !== -1) raw = '⚠️ Suppression impossible — d\'autres données dépendent de cet élément.';
            else if (raw.indexOf('permission') !== -1 || raw.indexOf('policy') !== -1) raw = '⚠️ Accès refusé — vérifiez les permissions RLS.';
            else if (raw.indexOf('jwt') !== -1 || raw.indexOf('expired') !== -1) raw = '⚠️ Session expirée — reconnectez-vous.';
            toast(raw, 'err');
            return false;
        }
        return true;
    } catch(e) {
        if (e.name !== 'AbortError') toast('Réseau: ' + e.message, 'err');
        return false;
    }
}
