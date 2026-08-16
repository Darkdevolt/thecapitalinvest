-- The Capital — Historical PER storage
-- One row per ticker/year. Historical years keep their own year-end reference price;
-- the current year remains dynamic until the year closes.

create table if not exists public.per_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  annee integer not null check (annee between 1900 and 2200),
  bpa numeric,
  date_cours_reference date,
  cours_reference numeric,
  per numeric,
  statut text not null default 'en_cours' check (statut in ('en_cours','definitif','non_calculable')),
  raison text,
  date_calcul timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint per_history_ticker_year_unique unique (ticker, annee)
);

create index if not exists idx_per_history_ticker_year
  on public.per_history (ticker, annee desc);

create index if not exists idx_per_history_status
  on public.per_history (statut);

alter table public.per_history enable row level security;

comment on table public.per_history is 'Historique annuel du PER The Capital, avec cours de référence propre à chaque exercice.';
comment on column public.per_history.statut is 'en_cours pour l''année courante, definitif pour une année clôturée, non_calculable lorsque les données nécessaires manquent.';
