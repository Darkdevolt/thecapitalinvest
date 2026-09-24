-- Nouvelle introduction en bourse : Bridge Bank Group Côte d'Ivoire (BBGC),
-- première cotation le 24/09/2026 à 7 255 FCFA. Absente du référentiel, elle
-- bloquait tout le pipeline de la séance (INSTRUMENT_MAPPING_REVIEW_REQUIRED).
insert into public.entreprises (ticker, nom, nom_court, pays, secteur, sous_secteur, devise, actif, date_introduction, description)
values ('BBGC', 'BRIDGE BANK GROUP COTE D''IVOIRE', 'Bridge Bank Group CI', 'Côte d''Ivoire', 'Services Financiers', 'Banque', 'FCFA', true, '2026-09-24',
        'Introduite à la BRVM le 24/09/2026 (première cotation à 7 255 FCFA).')
on conflict (ticker) do nothing;
