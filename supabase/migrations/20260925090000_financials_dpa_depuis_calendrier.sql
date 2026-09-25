-- DPA des exercices annuels depuis le calendrier des dividendes (dividendes_calendrier.montant,
-- dividende BRUT par action, convention de financials.dpa : 52 lignes sur 66 déjà concordantes).
--  1. Correction des DPA saisis en NET (ECOC 2025, CIEC 2025, ABJC 2023) ou en net × 0,88,
--     l'impôt retenu deux fois (CABC, SLBC, BICC, ORAC, SPHC, SOGC, NTLC, SHEC, STBC, PALC 2024).
--  2. Remplissage des DPA manquants.
-- Le calendrier donne le dividende à la date de l'exercice : facteur_actions (attributions
-- gratuites postérieures) s'applique ensuite à l'affichage comme pour toute autre ligne.
with div as (
  select ticker, coalesce(exercice, annee) ex, max(montant) brut, max(montant_net) net
  from public.dividendes_calendrier
  where (statut is null or statut !~* 'annul|suspend') and montant > 0
  group by 1, 2
)
update public.financials f
set dpa = v.brut,
    validation_notes = coalesce(f.validation_notes, '') || case
      when f.dpa is null then ' | 2026-09-25 : DPA brut repris du calendrier des dividendes.'
      else ' | 2026-09-25 : DPA corrigé ' || f.dpa || ' -> ' || v.brut || ' (brut du calendrier des dividendes ; la valeur précédente était le net ou le net × 0,88).'
    end
from div v
where f.periode = 'annuel' and v.ticker = f.ticker and v.ex = f.annee
  and (f.dpa is null
       or (v.net is not null and (abs(f.dpa - v.net) <= 0.01 * v.net or abs(f.dpa - v.net * 0.88) <= 0.01 * v.net)
           and abs(f.dpa - v.brut) > 0.02 * v.brut));
