-- Périodes mal étiquetées, détectées par recoupement S1 / 9M / annuel (25/09/2026).
--  * SIVC 2024 et 2025 : saisies en 'Q3' (trimestre isolé) alors que ce sont les
--    cumuls au 30 septembre (6,73 et 7,58 Md = 73-75 % de l'annuel ; en T3 isolé,
--    le T4 déduit de 2025 ressortait à −2,4 Md).
--  * CFAC 2021 et 2022 : saisies en '9M' alors que ce sont les T3 isolés
--    (30,3 et 40,5 Md, inférieurs au S1 de 56,9 et 64,5 Md publié la même année).
update public.financials
set periode = '9M',
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : période corrigée Q3 → 9M (cumul au 30 septembre, 73-75 % de l''annuel).'
where ticker = 'SIVC' and annee in (2024, 2025) and periode = 'Q3';

update public.financials
set periode = 'Q3',
    validation_status = 'review',
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : période corrigée 9M → Q3 (trimestre isolé : montant inférieur au S1 publié) ; à reconfirmer sur la source.'
where ticker = 'CFAC' and annee in (2021, 2022) and periode = '9M';
