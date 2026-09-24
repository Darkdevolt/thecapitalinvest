-- Validation des périodes historiques ajoutées le 24/09/2026 (statut 'draft'),
-- à la demande de l'administrateur (« fais tout ce qui reste »).
--  * 'validated' : chiffres recoupés automatiquement — variation N/N-1 publiée
--    vérifiée avec son signe, ou même chiffre dans deux rapports distincts.
--  * 'review'    : chiffres lus à la main sur une seule source, ou arrondis
--    dans le texte du rapport : restent signalés « contrôle éditorial en cours ».
-- Les lignes 'review' / 'validated' antérieures ne sont pas modifiées.
update public.financials
set validation_status = 'validated',
    validated_at = now(),
    validation_notes = validation_notes || ' | Validé le 2026-09-25 par recoupement automatique (variation publiée ou deux rapports concordants).'
where validation_status = 'draft'
  and (validation_notes ilike '%variation N/N-1 publiée contrôlée%'
       or validation_notes ilike '%concordant dans deux rapports%'
       or validation_notes ilike '%confirmés par deux rapports%')
  and validation_notes not ilike '%arrondi%';

update public.financials
set validation_status = 'review',
    validation_notes = validation_notes || ' | Passé en revue le 2026-09-25 : lecture manuelle d''une seule source ou chiffre arrondi, à confirmer.'
where validation_status = 'draft';
