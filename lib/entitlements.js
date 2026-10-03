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
  // L'application des formules est active par défaut. Un environnement
  // peut explicitement choisir "off" ou "observe" pour maintenance/diagnostic.
  return v === 'off' ? 'off' : v === 'observe' ? 'observe' : 'on';
})();

const RANK = { free: 0, investor: 1, pro: 2, elite: 3, admin: 4 };
/* « Accès complet » attribué depuis l'administration : droits Elite. */
const ALIAS = { all: 'elite', professional: 'pro' };

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
  boc_history: 'investor',
  /* Export Excel / PDF des données financières complètes : formule Professional. */
  export_donnees: 'pro',
  /* Simulateur d'ordre obligataire paramétrable (frais, TAF, apporteur) : Professional. */
  simulateur_obligataire: 'pro',
  /* Espace Gérant : registre de clients, frais et limites par client, relevés. */
  gestion_pro: 'pro'
};

/* Palier minimal par type de lecture /api/marche. Les types absents sont
   publics (cours, indices, entreprises, dividendes, apercu, historique,
   indices_historique, boc…) : ils alimentent la vitrine, le SEO et les
   fiches Free — les fermer nuirait sans rien protéger. */
export const MARCHE_TIER = {
  analyses: 'investor',
  coupons: 'investor',
  obligations: 'investor',
  obligations_marche: 'investor',
  obligations_boc: 'investor',
  export_financier: 'pro',
  simulateur_obligataire: 'pro'
};

/* Jeton vérifié auprès de Supabase (signature, expiration, révocation).
   Auparavant le jeton était seulement DÉCODÉ et ses champs « plan » ou
   « is_admin » crus sur parole : un jeton fabriqué à la main pouvait se
   déclarer Elite. Cache court pour ne pas interroger Supabase à chaque lecture. */
const verifiedCache = new Map();
async function verifiedUserId(tok) {
  const hit = verifiedCache.get(tok);
  if (hit && hit.at > Date.now() - 60000) return hit.id;
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(tok);
    const id = !error && data?.user?.id ? data.user.id : null;
    if (verifiedCache.size > 500) verifiedCache.clear();
    verifiedCache.set(tok, { id, at: Date.now() });
    return id;
  } catch {
    return null;
  }
}

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
  const userId = await verifiedUserId(tok);
  if (!userId) return out;
  out.authenticated = true;

  /* Droits lus en base pour l'utilisateur vérifié, jamais dans le jeton. */
  let plan = null;
  let isAdmin = false;
  let trialEnds = null;

  if (db) {
    try {
      const { data } = await db
        .from('users')
        .select('plan, plan_expire_at, is_admin, trial_ends_at')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        plan = String(data.plan || 'free').toLowerCase();
        plan = ALIAS[plan] || plan;
        isAdmin = isAdmin || data.is_admin === true;
        trialEnds = data.trial_ends_at || trialEnds;
        /* Formule échue (toutes, Elite comprise) : retour au gratuit. Sans date de fin, l'accès reste ouvert. */
        if (
          data.plan_expire_at &&
          new Date(data.plan_expire_at).getTime() < Date.now() &&
          (RANK[plan] || 0) > 0
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
