/**
 * Diagnostic d'exploitation.
 *
 * Répond à la question qui bloque tout le reste : chaque section de
 * l'application a-t-elle réellement des données derrière elle ?
 *
 * Une section peut être parfaitement codée et rester vide parce que la table
 * n'existe pas, parce qu'une règle RLS en interdit la lecture, ou parce
 * qu'aucune ligne n'a encore été chargée. Le navigateur n'affiche alors rien et
 * l'on conclut à tort à un défaut d'affichage. Cette route distingue les trois
 * cas, table par table.
 *
 * Accès : administrateur ou secret machine. Le détail du schéma n'a pas à être
 * exposé publiquement.
 */
import { supabaseAdmin, isSupabaseReady } from '../lib/supabase.js';
import { authenticateAdmin, isMachineRequest, handlePreflight } from '../lib/middleware.js';
import { json, fail } from '../lib/http.js';

/** Table → sections de l'application qui en dépendent. */
const DEPENDANCES = {
  entreprises: ['Titres', 'Fiche valeur', 'Comparateur', 'Screener'],
  historique: ['Cours du jour', 'Marché', 'Graphiques', 'Analyse technique'],
  cours: ['Cours du jour'],
  indices: ['Vue d\'ensemble', 'Marché'],
  boc: ['BOC / Bulletins'],
  financials: ['États financiers', 'Analyse fondamentale', 'Comparateur'],
  analyses: ['Recommandations'],
  dividendes_calendrier: ['Screener Dividendes'],
  publications: ['Calendrier des publications'],
  formations: ['Formation'],
  transactions: ['Portefeuille'],
  watchlist: ['Liste de suivi'],
  alertes_cours: ['Alertes de prix'],
  user_preferences: ['Mode Simple / Pro'],
  users: ['Authentification', 'Administration'],
  admin_settings: ['Traitement automatique BRVM'],
  admin_log: ['Journal d\'administration'],
  brvm_scrape_runs: ['Historique des traitements'],
  plans: ['Tarifs', 'Paiement'],
  payment_orders: ['Paiement'],
  payment_proofs: ['Vérification des paiements']
};

/**
 * Une lecture bornée à zéro ligne suffit : elle distingue une table absente
 * (code 42P01), un refus de politique (42501) et une table vide mais lisible.
 */
async function probe(table) {
  try {
    const { count, error } = await supabaseAdmin
      .from(table).select('*', { count: 'exact', head: true });
    if (error) {
      const code = error.code || '';
      if (code === '42P01') return { etat: 'absente', message: 'La table n\'existe pas.' };
      if (code === '42501') return { etat: 'interdite', message: 'Lecture refusée par une règle RLS.' };
      return { etat: 'erreur', message: error.message || 'Erreur inconnue.' };
    }
    if (!count) return { etat: 'vide', lignes: 0, message: 'Table lisible mais sans données.' };
    return { etat: 'ok', lignes: count };
  } catch (e) {
    return { etat: 'erreur', message: e?.message || 'Erreur inattendue.' };
  }
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'GET,OPTIONS' })) return;
  if (req.method !== 'GET') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');

  if (!isSupabaseReady() || !supabaseAdmin) {
    return json(res, 503, {
      success: false,
      configuration: { supabase: false },
      message: 'Supabase n\'est pas configuré côté serveur : vérifiez SUPABASE_URL et SUPABASE_SECRET_KEY.'
    });
  }

  if (!isMachineRequest(req)) {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;
  }

  const tables = Object.keys(DEPENDANCES);
  const resultats = await Promise.all(tables.map(async t => [t, await probe(t)]));

  const rapport = {};
  const sectionsBloquees = new Set();
  let ok = 0, vides = 0, problemes = 0;

  for (const [table, r] of resultats) {
    rapport[table] = { ...r, sections: DEPENDANCES[table] };
    if (r.etat === 'ok') ok++;
    else if (r.etat === 'vide') { vides++; DEPENDANCES[table].forEach(s => sectionsBloquees.add(s)); }
    else { problemes++; DEPENDANCES[table].forEach(s => sectionsBloquees.add(s)); }
  }

  return json(res, 200, {
    success: true,
    genere_le: new Date().toISOString(),
    configuration: {
      supabase: true,
      cron_secret: Boolean(process.env.CRON_SECRET),
      origines_autorisees: process.env.ALLOWED_ORIGIN || '*',
      moteur_ia: Boolean(process.env.OPENAI_API_KEY)
    },
    synthese: {
      tables_avec_donnees: ok,
      tables_vides: vides,
      tables_en_erreur: problemes,
      sections_sans_donnees: [...sectionsBloquees].sort()
    },
    tables: rapport
  });
}
