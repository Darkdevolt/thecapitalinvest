/* ============================================================
   THE CAPITAL — NOYAU / CONFIGURATION
   Source unique des constantes de l'espace d'administration.
   Ce fichier ne produit aucun effet de bord : il ne charge rien,
   n'injecte aucun style et ne touche pas au DOM. Les anciennes
   versions déclenchaient dix chargements de scripts depuis ici,
   ce qui rendait l'ordre d'exécution imprévisible.
   ============================================================ */
'use strict';

window.TC = window.TC || {};

TC.env = {
    SESSION_KEY: window.TC_ENV.SESSION_KEY,
    SUPABASE_URL: window.TC_ENV.SUPABASE_URL,
    SUPABASE_ANON: window.TC_ENV.SUPABASE_ANON_KEY,
    REST: window.TC_ENV.SUPABASE_URL + '/rest/v1',
    AUTH: window.TC_ENV.SUPABASE_URL + '/auth/v1',
    LOGO: '/assets/the-capital-logo.png'
};

/* Codes traités comme indices de marché et non comme sociétés cotées. */
TC.INDICES = [
    'BRVM COMPOSITE', 'BRVM30', 'BRVM10', 'BRVM PRESTIGE', 'BRVM PRINCIPAL',
    'BRVM FINANCE', 'BRVM INDUSTRIE', 'BRVM AGRICULTURE', 'BRVM TRANSPORT',
    'BRVM DISTRIBUTION', 'BRVM SERVICES PUBLICS', 'BRVM AUTRES SECTEURS'
];

/* Limite réglementaire de variation d'un titre sur une séance BRVM. */
TC.VARIATION_LIMIT = 7.5;

/* Horizon des balayages d'historique, en mois. PostgREST plafonne les réponses
   à mille lignes : lire trois ans de cotations demande une trentaine d'allers-
   retours enchaînés, soit plusieurs secondes d'attente avant le premier
   affichage. Les contrôles de qualité portent sur la période récente, la seule
   sur laquelle une correction ait encore un sens. */
TC.SCAN_MONTHS = 18;

TC.PAYS_UEMOA = ['Bénin', 'Burkina Faso', "Côte d'Ivoire", 'Guinée-Bissau', 'Mali', 'Niger', 'Sénégal', 'Togo'];

TC.RECOS = ['Acheter', 'Renforcer', 'Conserver', 'Alléger', 'Vendre'];

TC.PERIODES_FIN = [
    { v: 'annuel', l: 'Annuel' },
    { v: 'S1', l: 'Semestre 1' },
    { v: 'S2', l: 'Semestre 2' },
    { v: 'T1', l: 'Trimestre 1' },
    { v: 'T2', l: 'Trimestre 2' },
    { v: 'T3', l: 'Trimestre 3' },
    { v: 'T4', l: 'Trimestre 4' },
    { v: 'TTM', l: '12 mois glissants' }
];

/* ------------------------------------------------------------
   Colonnes réellement présentes dans chaque table Supabase.
   PostgREST rejette la requête entière dès qu'une seule colonne
   inconnue est envoyée : tout écrit passe par ce filtre.
   ------------------------------------------------------------ */
TC.COLUMNS = {
    entreprises: ['ticker', 'nom', 'nom_court', 'secteur', 'sous_secteur', 'pays', 'devise',
        'description', 'siege_social', 'site_web', 'date_introduction', 'nb_actions',
        'flottant_pct', 'valeur_nominale', 'pdg', 'dg', 'compartiment', 'code_isin',
        'logo_url', 'actif', 'isin', 'nombre_actions'],

    historique: ['ticker', 'date_seance', 'cloture', 'cours_cloture', 'cours_ouverture',
        'plus_haut', 'plus_bas', 'volume', 'variation', 'variation_pct', 'valeur_totale',
        'cours_normal', 'volume_normal'],

    cours: ['ticker', 'date_seance', 'cours', 'ouverture', 'plus_haut', 'plus_bas',
        'volume', 'variation', 'capitalisation', 'plus_haut_52', 'plus_bas_52'],

    financials: ['ticker', 'annee', 'periode', 'chiffre_affaires', 'rbe', 'ebit', 'ebitda',
        'resultat_exploitation', 'resultat_net', 'bpa', 'dpa', 'roe', 'roa', 'marge_nette',
        'fonds_propres', 'dette_nette', 'dettes_financieres', 'dette_fin', 'total_actif',
        'nombre_actions', 'nb_actions', 'cash_flow_operationnel', 'capex', 'cap_boursiere',
        'ev', 'dividend_yield', 'rendement_dividende', 'payout_ratio', 'source', 'source_url',
        'source_page', 'validation_status', 'validation_notes', 'validated_at'],

    dividendes_calendrier: ['ticker', 'annee', 'exercice', 'montant', 'montant_net',
        'taux_rendement', 'rendement', 'date_detachement', 'ex_date', 'date_paiement',
        'statut', 'notes'],

    indices: ['indice', 'date_seance', 'valeur', 'variation', 'variation_pct'],

    /* Colonnes vérifiées directement dans Supabase. `titre` et `resume`
       n'existent pas : les écrire faisait rejeter la note entière par
       PostgREST. `objectif_cours`, `potentiel_pct` et `horizon` existent et
       n'étaient jamais alimentées. */
    analyses: ['ticker', 'date_analyse', 'analyste', 'recommandation', 'objectif_cours',
        'cours_cible', 'cours_reference', 'potentiel_pct', 'commentaire', 'horizon'],

    actionnaires: ['ticker', 'nom_actionnaire', 'pourcentage', 'type_actionnaire', 'pays_origine'],

    users: ['nom', 'plan', 'plan_expire_at', 'is_admin']
};

/* Clé de conflit utilisée pour les écritures idempotentes (upsert). */
TC.CONFLICT = {
    entreprises: 'ticker',
    historique: 'ticker,date_seance',
    cours: 'ticker,date_seance',
    financials: 'ticker,annee,periode',
    dividendes_calendrier: 'ticker,annee',
    indices: 'indice,date_seance',
    actionnaires: null,
    analyses: null
};
