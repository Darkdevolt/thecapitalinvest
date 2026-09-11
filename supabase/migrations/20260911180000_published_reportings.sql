-- Reportings publiés sur le site public (/reporting.html).
--
-- Écriture : uniquement via api/process-brvm.js (scope:'reporting',
-- action:'publish'), authentifié par authenticateAdmin() puis exécuté avec
-- la clé service_role — cette table n'a donc aucune policy d'écriture pour
-- anon/authenticated : le service role contourne RLS, c'est le seul chemin.
-- Lecture : publique, sans authentification (api/marche.js?type=reporting_latest
-- et la page /reporting.html elle-même).
--
-- Une ligne par (periode, window_to) : republier la même période le même
-- jour remplace la publication précédente plutôt que d'empiler des doublons.

create table if not exists public.published_reportings (
  id uuid primary key default gen_random_uuid(),
  periode text not null check (periode in ('seance', 'hebdo', 'mensuel', 'trimestre', 'annuel')),
  window_from date not null,
  window_to date not null,
  payload jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (periode, window_to)
);

create index if not exists published_reportings_published_at_idx
  on public.published_reportings (published_at desc);

alter table public.published_reportings enable row level security;

drop policy if exists "published_reportings_public_read" on public.published_reportings;
create policy "published_reportings_public_read"
  on public.published_reportings
  for select
  using (true);
