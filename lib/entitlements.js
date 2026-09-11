/* ============================================================================
   THE CAPITAL — Droits d'accès par formule (Free / Investor / Professional)
   ----------------------------------------------------------------------------
   Point unique de vérité côté serveur. Résout le plan de l'appelant à partir
   de son jeton Supabase (claim direct si présent, sinon lecture de la table
   users), puis expose de quoi accepter / refuser / tronquer une réponse.

   Un DRAPEAU d'environnement gouverne tout : TC_TIERS
     • absent / "off"  → aucune restriction (comportement historique)
     • "observe"       → rien n'est bloqué, mais l'en-tête x-tc-tier-would-block
                          signale ce qui le serait — pour vérifier sans risque
     • "on"            → application réelle

   « elite » et « is_admin » = accès interne complet, hors grille publique.
   Un abonnement payant expiré (plan_expire_at dépassé) retombe en « free ».
   Un compte « free » encore en période d'essai est traité comme « pro ».
   ========================================================================== */
import { extractBearer } from './jwt.js';
import { supabase, supabaseAdmin } from './supabase.js';

const db = supabaseAdmin || supabase;

export const TIERS_MODE = (() => {
  const v = String(process.env.TC_TIERS || '').trim().toLowerCase();
  return v === 'on' || v === 'observe' ? v : 'off';
})();

const RANK = { free: 0, investor: 1, pro: 2, elite: 3, admin: 4 };

/* Palier minimal par fonctionnalité — mêmes clés que le front (tiers.js). */
export const FEATURE_TIER = {
  recommandations: 'investor',
  technique: 'investor',
  comparateur: 'investor',
  fondamentale: 'investor',
  dcf: 'pro',
  screener: 'pro',
  backtest: 'pro',
  opportunites_full: 'pro',
  financials_full: 'pro',
  palmares_history: 'investor',
  obligations: 'investor',
  portefeuille: 'investor',
  alertes_prix: 'investor',
  alertes_signaux: 'pro',
  calendrier_export: 'investor',
  boc_history: 'investor'
};

/* Palier minimal par type de lecture /api/marche. Les types absents sont
   publics (cours, indices, entreprises, dividendes, apercu, historique,
   indices_historique, boc…) : ils alimentent la vitrine, le SEO et les
   fiches Free — les fermer nuirait sans rien protéger. */
export const MARCHE_TIER = {
  analyses: 'investor',
  coupons: 'investor',
  obligations: 'investor',
  obligations_marche: 'investor'
};

function decodeJwtPayload(tok) {
  try {
    const seg = tok.split('.')[1];
    if (!seg) return null;
    let b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/* Résout les droits de la requête. Ne jette jamais : en cas de doute
   (jeton absent/illisible, users injoignable) → free. */
export async function resolveEntitlements(req) {
  const out = {
    authenticated: false,
    plan: 'free',
    isAdmin: false,
    trialActive: false,
    effective: 'free',
    mode: TIERS_MODE
  };

  const hdr = req && req.headers ? (req.headers.authorization || req.headers.Authorization) : null;
  const tok = extractBearer(hdr);
  if (!tok) return out;

  const payload = decodeJwtPayload(tok);
  if (!payload || !payload.sub || (payload.exp && payload.exp * 1000 <= Date.now())) return out;
  out.authenticated = true;

  let plan = typeof payload.plan === 'string' ? payload.plan.toLowerCase() : null;
  let isAdmin = payload.is_admin === true || payload.user_role === 'admin';
  let trialEnds = payload.trial_ends_at || null;

  if ((!plan || !Object.prototype.hasOwnProperty.call(RANK, plan)) && db) {
    try {
      const { data } = await db
        .from('users')
        .select('plan, plan_expire_at, is_admin, trial_ends_at')
        .eq('id', payload.sub)
        .maybeSingle();
      if (data) {
        plan = String(data.plan || 'free').toLowerCase();
        isAdmin = isAdmin || data.is_admin === true;
        trialEnds = data.trial_ends_at || trialEnds;
        if (
          data.plan_expire_at &&
          new Date(data.plan_expire_at).getTime() < Date.now() &&
          (RANK[plan] || 0) > 0 && plan !== 'elite'
        ) {
          plan = 'free';
        }
      }
    } catch {
      /* réseau / RLS : on reste en free, sans casser la requête */
    }
  }

  plan = Object.prototype.hasOwnProperty.call(RANK, plan) ? plan : 'free';
  const trialActive = !!trialEnds && new Date(trialEnds).getTime() > Date.now();

  out.plan = plan;
  out.isAdmin = isAdmin;
  out.trialActive = trialActive;
  out.effective = isAdmin
    ? 'admin'
    : trialActive && plan === 'free'
      ? 'pro'
      : plan;
  return out;
}

export function meets(effective, requiredTier) {
  if (!requiredTier) return true;
  return (RANK[effective] || 0) >= (RANK[requiredTier] != null ? RANK[requiredTier] : 99);
}

export function featureMap(effective) {
  const m = {};
  for (const k of Object.keys(FEATURE_TIER)) m[k] = meets(effective, FEATURE_TIER[k]);
  return m;
}

/* Réponse du type `entitlements` — consommée par public/app/js/tiers.js. */
export function entitlementsPayload(ent) {
  return {
    mode: ent.mode,
    authenticated: ent.authenticated,
    plan: ent.plan,
    effective: ent.effective,
    isAdmin: ent.isAdmin,
    trialActive: ent.trialActive,
    features: featureMap(ent.effective)
  };
}
