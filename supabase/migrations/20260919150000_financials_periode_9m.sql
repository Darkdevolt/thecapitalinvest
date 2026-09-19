-- Période « 9M » : cumul des neuf premiers mois, tel que le publient les
-- rapports du 3e trimestre (Sonatel : « au 30 septembre »). Le trimestre isolé
-- (T3 réel = 9M − S1) n'est pas stocké : il est déduit à l'affichage par le
-- module « Trimestres et semestres », exactement comme T2, T4 et S2.
--
-- La contrainte est recréée à l'identique (NOT VALID, comme avant : elle ne
-- porte que sur les lignes écrites après sa création) avec '9M' en plus.

alter table public.financials drop constraint if exists financials_data_quality_guard;

alter table public.financials add constraint financials_data_quality_guard check (
  annee >= 1900 and annee <= 2100
  and periode = any (array['annuel','S1','S2','Q1','Q2','Q3','Q4','9M','TTM'])
  and (chiffre_affaires is null or chiffre_affaires >= 0)
  and (ebitda is null or ebitda >= 0)
  and (fonds_propres is null or fonds_propres >= 0)
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
