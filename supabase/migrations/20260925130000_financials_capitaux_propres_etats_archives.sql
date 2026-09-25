-- Capitaux propres manquants, relevés dans les états financiers archivés (documents_emetteurs,
-- bucket annonces-emetteurs) le 25/09/2026 : texte extrait (OCR pour les scans) puis contrôle
-- manuel. Définition identique à la base : « Total capitaux propres et ressources assimilées »
-- (SYSCOHADA), IFRS pour Orange CI comme ses autres exercices. Chaque valeur a été étalonnée sur un
-- exercice déjà connu du même document quand il existait (unité et colonne vérifiées).
-- Ne remplit que les cases vides.
with v(ticker, annee, fp, src) as (values
  ('SPHC',2023,105420142539,'SYSCOHADA, colonne N-1 des états 2024 (2024 = 122 370 184 084, identique à la base)'),
  ('SPHC',2025,137936908394,'SYSCOHADA, états financiers 2025'),
  ('PALC',2023,128875431000,'SYSCOHADA en milliers, colonne N-1 des états 2024 (2024 identique à la base)'),
  ('PALC',2025,142638984000,'SYSCOHADA en milliers, états financiers 2025'),
  ('BNBC',2023,17743296528,'SYSCOHADA, colonne N-1 des états 2024'),
  ('BNBC',2024,17747635829,'SYSCOHADA, états 2024 et colonne N-1 des états 2025 (2025 identique à la base)'),
  ('LNBB',2024,23614741046,'Total capitaux propres et ressources assimilées, colonne N-1 des états 2025'),
  ('LNBB',2025,21953860132,'Total capitaux propres et ressources assimilées, états financiers 2025'),
  ('SAFC',2024,5215000000,'Capitaux propres et ressources assimilées (millions), colonne N-1 des états 2025'),
  ('SAFC',2025,5916000000,'Capitaux propres et ressources assimilées (millions), états financiers 2025'),
  ('SLBC',2023,152909000000,'Capitaux propres (millions), colonne N-1 des états 2024 (2024 identique à la base)'),
  ('SMBC',2023,35951000000,'Capitaux propres (millions), colonne N-1 des états 2024'),
  ('SMBC',2024,35294000000,'Capitaux propres (millions), états 2024 et colonne N-1 des états 2025 (2025 identique à la base)'),
  ('TTLC',2023,45699000000,'Capitaux propres (millions), colonne N-1 des états 2024 (2024 identique à la base)'),
  ('TTLC',2025,36202000000,'Capitaux propres (millions), états 2025 (colonnes N-1 puis N ; 2024 identique à la base)'),
  ('ONTBF',2023,61929278606,'Total capitaux propres et ressources assimilées, colonne N-1 des états 2024 (OCR ; 2024 identique à la base)'),
  ('ORAC',2023,724000000000,'Total capitaux propres IFRS (milliards), colonne N-1 des états 2024 (2024 identique à la base)'),
  ('ORAC',2025,707800000000,'Total capitaux propres IFRS (milliards), états financiers 2025'),
  ('UNXC',2024,15591475518,'Ligne CP SYSCOHADA, colonne N-1 des états 2025 (2025 identique à la base)'),
  ('CFAC',2023,17979153259,'Total capitaux propres et ressources assimilées, colonne N-1 des états 2024'),
  ('CFAC',2024,19452985667,'Total capitaux propres et ressources assimilées, états financiers 2024'),
  ('SIVC',2024,3272424840,'Ligne CP SYSCOHADA, colonne N-1 des états 2025'),
  ('SIVC',2025,2526541669,'Ligne CP SYSCOHADA, états financiers 2025'),
  ('STAC',2023,801502000,'Capitaux propres (milliers), colonne N-1 des états 2024 ; écart 2023-2024 = perte 2024'),
  ('STAC',2024,453306000,'Capitaux propres (milliers), états 2024 et colonne N-1 des états 2025'),
  ('STAC',2025,356746000,'Capitaux propres (milliers), états 2025 ; écart 2024-2025 = perte 2025'),
  ('PRSC',2023,11015041886,'Ligne CP SYSCOHADA, colonne N-1 des états 2024'),
  ('PRSC',2024,11283033493,'Ligne CP SYSCOHADA, états financiers 2024')
)
update public.financials f
set fonds_propres = v.fp,
    validation_notes = coalesce(f.validation_notes, '') || ' | 2026-09-25 : capitaux propres ' || v.src || '.'
from v
where f.ticker = v.ticker and f.annee = v.annee and f.periode = 'annuel' and f.fonds_propres is null;

-- SMB : résultat net 2024 lu sur la même page que les capitaux propres (états 2025, colonne N-1).
update public.financials
set resultat_net = 8698000000,
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : résultat net 2024 (8 698 M) repris de la colonne N-1 des états financiers 2025.'
where ticker = 'SMBC' and annee = 2024 and periode = 'annuel' and resultat_net is null;
update public.financials f
set bpa = round(f.resultat_net / (e.nombre_actions * f.facteur_actions), 2),
    validation_notes = coalesce(f.validation_notes, '') || ' | 2026-09-25 : BPA reconstitué = résultat net ÷ ' || round(e.nombre_actions * f.facteur_actions) || ' actions (non publié dans la source).'
from public.entreprises e
where e.ticker = f.ticker and f.ticker = 'SMBC' and f.annee = 2024 and f.periode = 'annuel'
  and f.bpa is null and f.resultat_net is not null and e.nombre_actions > 0;
