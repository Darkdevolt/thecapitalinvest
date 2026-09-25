-- Opérations sur le capital non enregistrées, vérifiées sur les documents officiels :
--  * SOLIBRA (SLBC) : fractionnement 10 pour 1, communiqué SOLIBRA du 11/09/2024 (AGE du
--    11/09/2024) : nominal 2 500 -> 250 F, 1 646 084 -> 16 460 840 actions, effet le 30/09/2024
--    (cours 102 125 -> 10 975 F ce jour-là). L'historique de la base d'avant le 17/08/2021 est
--    déjà exprimé après fractionnement (saut x10 ce jour-là) : deja_ajuste_avant.
--    https://www.brvm.org/sites/default/files/20240911_-_communique_-_solibra_ci.pdf
--  * SIB (SIBC) : attribution gratuite de 1 action nouvelle pour 1 ancienne par incorporation
--    de 10 Md F de réserves, 50 000 000 actions nouvelles de 200 F, ex-droit le 14/11/2024,
--    jouissance au 01/01/2024 (avis BRVM n°273-2024 du 30/10/2024).
--    https://www.brvm.org/sites/default/files/20241030_-_avis_ndeg273_brvmdg_-_augmentation_de_capital_-_sib_ci.pdf
-- Le déclencheur trg_entreprises_recalc_facteur recalcule facteur_actions des lignes financials.
update public.entreprises
set operations_capital = coalesce(operations_capital, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'date', '2024-09-30', 'type', 'fractionnement', 'ratio', 10, 'cours_bruts', true, 'deja_ajuste_avant', '2021-08-17',
  'note', '10 actions nouvelles pour 1 ancienne (AGE du 11/09/2024) : nominal 2 500 -> 250 F, 1 646 084 -> 16 460 840 actions ; effet le 30/09/2024 (cours brut 102 125 -> 10 975 F). Communiqué SOLIBRA du 11/09/2024.'))
where ticker = 'SLBC' and not coalesce(operations_capital, '[]'::jsonb) @> '[{"date":"2024-09-30"}]';

update public.entreprises
set operations_capital = coalesce(operations_capital, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'date', '2024-11-14', 'type', 'attribution_gratuite', 'ratio', 2, 'cours_bruts', true,
  'note', '1 action nouvelle pour 1 ancienne, incorporation de 10 Md F de réserves : 50 000 000 -> 100 000 000 actions de 200 F ; ex-droit le 14/11/2024 (cours brut 7 100 -> 3 540 F), jouissance au 01/01/2024. Avis BRVM n°273-2024 du 30/10/2024.'))
where ticker = 'SIBC' and not coalesce(operations_capital, '[]'::jsonb) @> '[{"date":"2024-11-14"}]';

-- Lignes d'avant l'opération : BPA et nombre d'actions ramenés à la base en vigueur à la date
-- d'arrêté (règle de la table ; l'application les ajuste ensuite par facteur_actions).
update public.financials
set bpa = case when resultat_net is not null then round(resultat_net / 1646084.0, 2) else bpa end,
    nombre_actions = case when nombre_actions is not null then 1646084 end,
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : BPA et nombre d''actions à la base d''avant le fractionnement 10 pour 1 du 30/09/2024 (1 646 084 actions).'
where ticker = 'SLBC' and facteur_actions < 1 and (bpa is not null or nombre_actions is not null);

update public.financials
set bpa = case when resultat_net is not null then round(resultat_net / 50000000.0, 2) else bpa end,
    nombre_actions = case when nombre_actions is not null then 50000000 end,
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : BPA et nombre d''actions à la base d''avant l''attribution gratuite 1 pour 1 du 14/11/2024 (50 000 000 actions).'
where ticker = 'SIBC' and facteur_actions < 1 and (bpa is not null or nombre_actions is not null);
