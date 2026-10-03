-- Espace Gérant (formule Pro) : registre des clients d'un gérant de
-- portefeuille (SGI, conseiller, family office) et ses paramètres.
-- Les opérations d'un client restent dans public.transactions, rattachées
-- par le code client (préfixe « @@code@@ » du champ note, couche multi-comptes).
-- Lecture et écriture via /api/user-data?mode=gestion-clients|gestion-parametres.
create table if not exists public.gestion_clients (
  id uuid primary key default gen_random_uuid(),
  gerant_id uuid not null references public.users(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40),
  nom text not null check (char_length(nom) between 1 and 120),
  type_client text not null default 'particulier' check (type_client in ('particulier','entreprise','institutionnel')),
  email text, telephone text, numero_compte text,
  profil_risque text not null default 'equilibre' check (profil_risque in ('prudent','equilibre','dynamique')),
  objectif text, horizon text,
  date_ouverture date,
  frais jsonb not null default '{}'::jsonb,
  limites jsonb not null default '{}'::jsonb,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gerant_id, code)
);
create index if not exists gestion_clients_gerant_idx on public.gestion_clients (gerant_id);
alter table public.gestion_clients enable row level security;
drop policy if exists gestion_clients_own_select on public.gestion_clients;
create policy gestion_clients_own_select on public.gestion_clients for select to authenticated using (gerant_id = (select auth.uid()));

create table if not exists public.gestion_parametres (
  user_id uuid primary key references public.users(id) on delete cascade,
  valeur jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.gestion_parametres enable row level security;
drop policy if exists gestion_parametres_own_select on public.gestion_parametres;
create policy gestion_parametres_own_select on public.gestion_parametres for select to authenticated using (user_id = (select auth.uid()));
