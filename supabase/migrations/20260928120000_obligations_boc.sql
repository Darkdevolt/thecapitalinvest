-- Tableau des obligations du BOC (Bulletin Officiel de la Cote), une ligne par
-- obligation et par séance : capital restant par titre (« valeur nominale »),
-- cours, coupon couru, périodicité, prochain coupon net et sa date, type
-- d'amortissement (IF, AC, AD, ACD). Source officielle des calculs obligataires.
create table if not exists public.obligations_boc (
  symbole text not null,
  date_seance date not null,
  titre text,
  categorie text,
  valeur_nominale numeric,
  cours_precedent numeric,
  cours_jour numeric,
  cours_reference numeric,
  volume numeric,
  valeur numeric,
  coupon_couru numeric,
  periodicite integer,
  coupon_net numeric,
  echeance_coupon date,
  type_amort text,
  suspendu boolean default false,
  taux numeric,
  page integer,
  created_at timestamptz default now(),
  primary key (symbole, date_seance)
);
create index if not exists obligations_boc_date_idx on public.obligations_boc (date_seance desc);

alter table public.obligations_boc enable row level security;
drop policy if exists public_read_obligations_boc on public.obligations_boc;
create policy public_read_obligations_boc on public.obligations_boc for select to anon, authenticated using (true);
drop policy if exists tc_admin_write_obligations_boc on public.obligations_boc;
create policy tc_admin_write_obligations_boc on public.obligations_boc for all to authenticated
  using ((select private.tc_is_admin())) with check ((select private.tc_is_admin()));

-- Dernière ligne connue de chaque obligation.
create or replace view public.obligations_boc_latest with (security_invoker = true) as
  select distinct on (symbole) * from public.obligations_boc order by symbole, date_seance desc;
