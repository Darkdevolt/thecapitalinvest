/* ============================================================
   THE CAPITAL — GARDE-FOU PERFORMANCE ADMIN
   Correctifs purement front-end :
   - évite le téléchargement de dizaines de milliers de lignes
     d'historique depuis le tableau de bord ;
   - utilise le RPC est_admin() pour le contrôle initial des droits,
     afin de ne pas dépendre d'une policy users trop restrictive.
   Aucune table, colonne ou donnée Supabase n'est modifiée.
   ============================================================ */
'use strict';

(function (TC) {
    const originalGet = TC.get;
    const originalGetAll = TC.getAll;

    /* Le dashboard demandait historiquement tout `historique` pour
       calculer une couverture par ticker. On conserve le résultat exact
       mais on remplace 150 requêtes paginées par un count ciblé par société. */
    TC.getAll = async function (table, query, pageSize) {
        if (table === 'historique' && String(query || '') === 'select=ticker&order=ticker.asc') {
            const refs = await TC.tickers();
            const counts = await Promise.all((refs || []).map(async function (r) {
                const ticker = String(r.ticker || '').trim();
                if (!ticker) return { ticker: '', count: 0 };
                const filter = 'ticker=eq.' + encodeURIComponent(ticker);
                const result = await TC.count('historique', filter);
                return { ticker: ticker, count: result.ok ? result.value : 0 };
            }));

            const compact = [];
            counts.forEach(function (item) {
                /* Le module dashboard additionne les occurrences de ticker.
                   On restitue uniquement ce qu'il lui faut, sans appels réseau
                   supplémentaires. */
                for (let i = 0; i < item.count; i++) compact.push({ ticker: item.ticker });
            });
            return compact;
        }
        return originalGetAll(table, query, pageSize);
    };

    /* Le contrôle initial de l'admin doit utiliser la fonction SECURITY
       DEFINER déjà présente en base. Cela respecte la RLS de users au lieu
       de tenter de la contourner ou de la modifier. */
    TC.get = async function (table, query) {
        const q = String(query || '');
        const isBootProfile = table === 'users' &&
            q.indexOf('select=id,email,nom,is_admin') === 0 &&
            (q.indexOf('id=eq.') !== -1 || q.indexOf('email=eq.') !== -1);

        if (isBootProfile) {
            try {
                const response = await fetch(TC.env.REST + '/rpc/est_admin', {
                    method: 'POST',
                    headers: {
                        apikey: TC.env.SUPABASE_ANON,
                        Authorization: 'Bearer ' + TC.session.token,
                        'Content-Type': 'application/json'
                    },
                    body: '{}'
                });
                if (!response.ok) {
                    console.warn('[TC] RPC est_admin indisponible:', response.status);
                    return originalGet(table, query);
                }
                const value = await response.json();
                const isAdmin = value === true || value === 1 || value === 'true' ||
                    (Array.isArray(value) && value[0] === true);
                if (!isAdmin) return [];

                const user = TC.session.user || {};
                return [{
                    id: user.id || null,
                    email: user.email || '',
                    nom: user.user_metadata && user.user_metadata.nom || '',
                    is_admin: true
                }];
            } catch (e) {
                console.warn('[TC] RPC est_admin impossible:', e.message);
                return originalGet(table, query);
            }
        }

        return originalGet(table, query);
    };
})(window.TC);
