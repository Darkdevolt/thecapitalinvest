-- Capitaux propres négatifs autorisés : une société dont les pertes cumulées
-- dépassent les apports publie une situation nette négative (ex. Unilever CI
-- 2020, 2022, 2023). Les autres garde-fous de qualité sont conservés tels quels.
alter table public.financials drop constraint if exists financials_data_quality_guard;
alter table public.financials add constraint financials_data_quality_guard check (
  annee >= 1900 and annee <= 2100
  and periode = any (array['annuel','S1','S2','Q1','Q2','Q3','Q4','9M','TTM'])
  and (chiffre_affaires is null or chiffre_affaires >= 0)
  and (ebitda is null or ebitda >= 0)
  and (dettes_financieres is null or dettes_financieres >= 0)
  and (total_actif is null or total_actif >= 0)
  and (cap_boursiere is null or cap_boursiere >= 0)
  and (nombre_actions is null or nombre_actions > 0)
  and (nb_actions is null or nb_actions > 0)
  and (dpa is null or dpa >= 0)
  and (capex is null or capex >= 0)
  and (dividend_yield is null or dividend_yield >= 0)
  and (rendement_dividende is null or rendement_dividende >= 0)
  and (payout_ratio is null or payout_ratio >= 0)
) not valid;

-- Unilever CI : capitaux propres négatifs publiés (total CP et ressources assimilées).
update public.financials f set fonds_propres = v.fp, updated_at = now(),
  validation_notes = coalesce(f.validation_notes, '') || ' | 2026-09-26 : capitaux propres ' || v.fp || ' (' || v.src || ').'
from (values
  (2020, -4391004080::numeric, 'négatifs, colonne N-1 des états 2021'),
  (2022, -10773429335::numeric, 'négatifs, états 2022'),
  (2023, -10658856096::numeric, 'négatifs, états 2023')
) as v(annee, fp, src)
where f.ticker = 'UNLC' and f.periode = 'annuel' and f.annee = v.annee and f.fonds_propres is null;
