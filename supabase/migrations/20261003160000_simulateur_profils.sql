-- Personnalisation du simulateur d'ordre obligataire (formule Pro) :
-- identité visuelle (nom, logo, couleurs, mention de bas de page) et taux
-- propres à chaque professionnel, retrouvés sur tous ses appareils.
-- Lecture et écriture via /api/user-data?mode=simulateur-profil (clé service).
create table if not exists public.simulateur_profils (
  user_id uuid primary key references public.users(id) on delete cascade,
  marque jsonb not null default '{}'::jsonb,
  parametres jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint simulateur_profils_taille check (pg_column_size(marque) < 400000 and pg_column_size(parametres) < 20000)
);
alter table public.simulateur_profils enable row level security;
drop policy if exists simulateur_profils_own_select on public.simulateur_profils;
create policy simulateur_profils_own_select on public.simulateur_profils for select to authenticated using (user_id = (select auth.uid()));
