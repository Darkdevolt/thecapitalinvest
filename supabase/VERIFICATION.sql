-- ═══════════════════════════════════════════════════════════════════════════
-- THE CAPITAL — Script de vérification de la base
--
-- À exécuter dans l'éditeur SQL de Supabase. Ce script ne modifie RIEN :
-- il ne fait que constater l'état de votre base et le confronter à ce que le
-- code attend réellement.
--
-- L'inventaire ci-dessous a été extrait des requêtes présentes dans le code,
-- pas supposé. Chaque table et chaque colonne citée est effectivement
-- interrogée quelque part dans l'application.
--
-- Renvoyez-moi les résultats des cinq requêtes et je peux confronter le code
-- ligne à ligne à la réalité de votre schéma.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. TABLES ET COLONNES EXISTANTES ──────────────────────────────────────
-- Attendu par le code : entreprises, cours, historique, indices, boc,
-- financials, analyses, dividendes_calendrier, publications, formations,
-- transactions, watchlist, alertes_cours, user_preferences, users,
-- admin_settings, admin_log, brvm_scrape_runs, plans, payment_orders,
-- payment_proofs.

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ─── 2. TABLES ATTENDUES MAIS ABSENTES ─────────────────────────────────────
-- Toute ligne renvoyée ici correspond à une section de l'application qui ne
-- peut pas fonctionner, quel que soit l'état du code.

with attendues(nom) as (
  values ('entreprises'),('cours'),('historique'),('indices'),('boc'),
         ('financials'),('analyses'),('dividendes_calendrier'),('publications'),
         ('formations'),('transactions'),('watchlist'),('alertes_cours'),
         ('user_preferences'),('users'),('admin_settings'),('admin_log'),
         ('brvm_scrape_runs'),('plans'),('payment_orders'),('payment_proofs')
)
select a.nom as table_manquante
from attendues a
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = a.nom
where t.table_name is null;


-- ─── 3. ÉTAT DE LA SÉCURITÉ AU NIVEAU LIGNE (RLS) ──────────────────────────
-- POINT CRITIQUE. L'espace d'administration écrit directement dans PostgREST
-- avec la clé publique. Toute table où rowsecurity = false est modifiable par
-- n'importe quel utilisateur inscrit.

select tablename,
       rowsecurity as rls_active,
       case when rowsecurity then 'ok' else '⚠ TABLE NON PROTÉGÉE' end as verdict
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;


-- ─── 4. POLICIES EN VIGUEUR ────────────────────────────────────────────────
-- Vérifiez que toute policy INSERT / UPDATE / DELETE sur les tables de marché
-- (cours, historique, indices, entreprises, financials, analyses) est
-- conditionnée à is_admin(). Une policy d'écriture ouverte à 'authenticated'
-- sans condition laisse n'importe quel inscrit modifier vos données.

select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;


-- ─── 5. FONCTIONS RPC APPELÉES PAR LE CODE ─────────────────────────────────
-- create_payment_order et submit_payment_proof reçoivent p_user_id et le
-- montant DEPUIS LE NAVIGATEUR. Inspectez leur corps : elles doivent comparer
-- p_user_id à auth.uid() et recalculer le montant à partir du plan, sans jamais
-- faire confiance à la valeur transmise.

select p.proname as fonction,
       pg_get_function_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_payment_order','submit_payment_proof',
                    'review_payment_proof','admin_clientele_summary',
                    'admin_customer_intelligence','is_admin')
order by p.proname;


-- ─── 6. CORPS DES DEUX FONCTIONS DE PAIEMENT ───────────────────────────────
-- À lire attentivement : c'est ici que se joue la sécurité du parcours d'achat.

select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_payment_order','submit_payment_proof');
