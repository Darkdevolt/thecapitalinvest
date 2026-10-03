-- Composition des indices BRVM au 1er octobre 2026, avec l'historique 2026
-- du BRVM 30 (révisions trimestrielles). Sources :
--   T1 (effet 02/01/2026) : avis BRVM n° 001-2026/BRVM/DG, liste complète
--     publiée par allAfrica / Le Soleil le 05/01/2026.
--   T2 (effet 01/04/2026) : + CBIBF, NEIC, SEMC, STAC ; − PALC, SAFC, SLBC, SOGC
--     (Dabafinance, « La BRVM met à jour l'indice Benchmark 30 »).
--   T3 (effet 01/07/2026) : + NSBC, SAFC, SOGC ; − FTSC, ONTBF, SHEC
--     (avis du 01/07/2026, Dabafinance).
--   T4 (effet 01/10/2026) : + LNBB, ONTBF, SLBC, SHEC ; − NEIC, SCRC, SEMC, STAC
--     (Sika Finance, 02/10/2026).
-- BRVM Prestige 2026 : avis n° 001-2026/BRVM/DG (12 valeurs, révision annuelle).
-- BRVM Principal et indices sectoriels : toutes les actions du compartiment /
-- du secteur, d'après les fiches entreprises au 01/10/2026.
-- Idempotent : on conflict do nothing sur (indice, ticker, date_debut).

-- ── BRVM 30 ─────────────────────────────────────────────────────────────
with periodes(ticker, debut, fin) as (values
  -- Présents toute l'année 2026
  ('SDSC','2026-01-02',null), ('SIVC','2026-01-02',null), ('BOABF','2026-01-02',null),
  ('BOAB','2026-01-02',null), ('BOAC','2026-01-02',null), ('BOAM','2026-01-02',null),
  ('BOAN','2026-01-02',null), ('BOAS','2026-01-02',null), ('BICB','2026-01-02',null),
  ('CFAC','2026-01-02',null), ('CIEC','2026-01-02',null), ('ECOC','2026-01-02',null),
  ('ETIT','2026-01-02',null), ('ORGT','2026-01-02',null), ('ORAC','2026-01-02',null),
  ('SPHC','2026-01-02',null), ('SGBC','2026-01-02',null), ('STBC','2026-01-02',null),
  ('SIBC','2026-01-02',null), ('SNTS','2026-01-02',null), ('TTLC','2026-01-02',null),
  ('UNXC','2026-01-02',null),
  -- Sortis en cours d'année
  ('PALC','2026-01-02','2026-04-01'), ('SAFC','2026-01-02','2026-04-01'),
  ('SLBC','2026-01-02','2026-04-01'), ('SOGC','2026-01-02','2026-04-01'),
  ('FTSC','2026-01-02','2026-07-01'), ('ONTBF','2026-01-02','2026-07-01'),
  ('SHEC','2026-01-02','2026-07-01'), ('SCRC','2026-01-02','2026-10-01'),
  -- Révision T2
  ('CBIBF','2026-04-01',null), ('NEIC','2026-04-01','2026-10-01'),
  ('SEMC','2026-04-01','2026-10-01'), ('STAC','2026-04-01','2026-10-01'),
  -- Révision T3
  ('NSBC','2026-07-01',null), ('SAFC','2026-07-01',null), ('SOGC','2026-07-01',null),
  -- Révision T4
  ('LNBB','2026-10-01',null), ('ONTBF','2026-10-01',null),
  ('SLBC','2026-10-01',null), ('SHEC','2026-10-01',null)
)
insert into public.indices_composition (indice, ticker, date_debut, date_fin, notes)
select 'BRVM-30', p.ticker, p.debut::date, p.fin::date, 'Révisions trimestrielles BRVM 2026'
from periodes p join public.entreprises e on e.ticker = p.ticker
on conflict (indice, ticker, date_debut) do nothing;

-- ── BRVM Prestige (révision annuelle 2026) ──────────────────────────────
insert into public.indices_composition (indice, ticker, date_debut, notes)
select 'BRVM-PRESTIGE', t, '2026-01-02', 'Avis n° 001-2026/BRVM/DG'
from unnest(array['ECOC','NTLC','ONTBF','ORAC','PALC','SGBC','SIBC','SMBC','SNTS','SPHC','TTLC','TTLS']) t
where exists (select 1 from public.entreprises e where e.ticker = t)
on conflict (indice, ticker, date_debut) do nothing;

-- ── BRVM Principal : actions du compartiment Principal ─────────────────
insert into public.indices_composition (indice, ticker, date_debut, notes)
select 'BRVM-PRINCIPAL', ticker, '2026-01-02', 'Compartiment Principal (fiches entreprises)'
from public.entreprises where actif and upper(compartiment) = 'PRINCIPAL'
on conflict (indice, ticker, date_debut) do nothing;

-- ── Indices sectoriels (classification BRVM 2023) ──────────────────────
insert into public.indices_composition (indice, ticker, date_debut, notes)
select s.indice, e.ticker, '2026-01-02', 'Secteur ' || e.secteur || ' (fiches entreprises)'
from public.entreprises e
join (values
  ('Télécommunications', 'BRVM-TELECOMMUNICATIONS'),
  ('Consommation discrétionnaire', 'BRVM-CONSOMMATION-DISCRETIONNAIRE'),
  ('Services Financiers', 'BRVM-SERVICES-FINANCIERS'),
  ('Consommation de base', 'BRVM-CONSOMMATION-DE-BASE'),
  ('Industriels', 'BRVM-INDUSTRIELS'),
  ('Energie', 'BRVM-ENERGIE'),
  ('Services Publics', 'BRVM-SERVICES-PUBLICS')
) s(secteur, indice) on s.secteur = e.secteur
where e.actif
on conflict (indice, ticker, date_debut) do nothing;
