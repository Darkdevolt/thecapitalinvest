-- Composition des indices BRVM (BRVM 30, Prestige, Principal, sectoriels…),
-- saisie depuis l'admin (module « Composition des indices »). Une ligne par
-- appartenance d'un titre à un indice sur une période : date_debut = entrée
-- dans l'indice (date d'effet de la révision), date_fin = sortie (null tant
-- que le titre en fait partie). On garde ainsi l'historique des révisions
-- semestrielles du BRVM 30 au lieu d'écraser la liste.
create table if not exists public.indices_composition (
  id bigint generated always as identity primary key,
  indice text not null check (indice ~ '^[A-Z0-9-]+$'),
  ticker text not null references public.entreprises (ticker) on update cascade,
  date_debut date not null default current_date,
  date_fin date,
  poids_pct numeric check (poids_pct is null or (poids_pct >= 0 and poids_pct <= 100)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut),
  unique (indice, ticker, date_debut)
);
create index if not exists indices_composition_indice_idx on public.indices_composition (indice, date_fin);
create index if not exists indices_composition_ticker_idx on public.indices_composition (ticker);

drop trigger if exists indices_composition_touch on public.indices_composition;
create trigger indices_composition_touch before update on public.indices_composition
  for each row execute function public.update_updated_at();

alter table public.indices_composition enable row level security;
drop policy if exists public_read_indices_composition on public.indices_composition;
create policy public_read_indices_composition on public.indices_composition for select to anon, authenticated using (true);
drop policy if exists tc_admin_write_indices_composition on public.indices_composition;
create policy tc_admin_write_indices_composition on public.indices_composition for all to authenticated
  using ((select private.tc_is_admin())) with check ((select private.tc_is_admin()));

-- Composition en vigueur aujourd'hui, avec le nom de la société.
create or replace view public.indices_composition_actuelle with (security_invoker = true) as
  select c.indice, c.ticker, e.nom, e.secteur, e.compartiment, c.poids_pct, c.date_debut, c.notes
  from public.indices_composition c
  join public.entreprises e on e.ticker = c.ticker
  where c.date_debut <= current_date and (c.date_fin is null or c.date_fin > current_date);
