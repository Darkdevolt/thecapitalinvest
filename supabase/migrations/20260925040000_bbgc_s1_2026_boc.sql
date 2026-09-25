-- Bridge Bank Group Côte d'Ivoire : ticker de cotation BBGC.
-- L'historique financier avait été saisi sous « BBGCI » (sigle de la banque)
-- alors que les cours sont enregistrés sous BBGC : la fiche BBGC n'affichait
-- donc aucun état financier. On COPIE les lignes vers BBGC (rien n'est
-- supprimé) et on désactive la fiche doublon BBGCI.

-- 1) Copie de l'historique BBGCI -> BBGC
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'financials'
    and column_name not in ('id', 'ticker', 'created_at', 'updated_at');
  execute format(
    'insert into public.financials (ticker, %1$s) select ''BBGC'', %1$s from public.financials where ticker = ''BBGCI'' on conflict (ticker, annee, periode) do nothing',
    cols);
end $$;

-- 2) Exercice 2025 : recoupé avec le bilan social audité au 31/12/2025
--    publié dans le BOC du 24/09/2026 (total actif 1 427 417 M, capitaux
--    propres 105 139 M, résultat 27 197 M : identiques).
update public.financials
set validation_status = 'validated', validated_at = now(),
    validation_notes = coalesce(validation_notes, '') || ' Recoupé avec le bilan au 31/12/2025 publié dans le BOC du 24/09/2026 (total actif, capitaux propres et résultat identiques).'
where ticker = 'BBGC' and annee = 2025 and periode = 'annuel' and validation_status <> 'validated';

-- 3) 1er semestre 2026 et comparatif 1er semestre 2025
--    Source : BOC du 24/09/2026 (bfin.brvm.org), rapport d'activité S1 2026
--    + états financiers BCEAO au 30/06/2026 (examen limité Deloitte / Eriedge,
--    rapport du 31/08/2026). Montants en millions de FCFA.
--    Contrôles : PNB − charges générales − dotations = RBE ; RBE − coût du
--    risque = résultat d'exploitation ; − impôt = résultat net ; capitaux
--    propres = capital + réserves + report à nouveau + résultat ; tableau du
--    rapport d'activité concordant.
insert into public.financials (
  ticker, annee, periode, chiffre_affaires, charges_personnel, dotations_amortissements, rbe,
  resultat_exploitation, impot_sur_resultat, resultat_net, total_actif, capitaux_propres,
  capital_social, primes_reserves, report_a_nouveau, bpa, marge_nette, nb_actions, nombre_actions,
  devise, unite, date_arrete, date_publication, statut_audit,
  source, source_url, validation_status, validated_at, validation_notes
) values
(
  'BBGC', 2026, 'S1', 37699000000, null, 1718000000, 22496000000,
  18193000000, 2994000000, 15199000000, 1560431000000, 102659000000,
  20000000000, 22153000000, 45307000000, 303.98, 40.3, 50000000, 50000000,
  'XOF', 'FCFA', '2026-06-30', '2026-09-24', 'examen_limite',
  'BOC du 24/09/2026 — rapport d''activité et états financiers semestriels au 30/06/2026',
  'https://bfin.brvm.org/boc/BOC_JOUR/BOC_20260924.pdf',
  'validated', now(),
  'Banque : chiffre d''affaires = produit net bancaire (PNB). Comptes sociaux BCEAO au 30/06/2026, examen limité des commissaires aux comptes (Deloitte, Eriedge). Charges générales d''exploitation 13 486 M ; coût du risque −4 303 M ; dépôts clientèle 1 318 300 M ; créances clientèle 823 897 M. Capitaux propres en baisse vs 31/12/2025 (105 139 M) après distribution du dividende 2025. BPA = RN / 50 000 000 actions. Recoupé : sous-totaux du compte de résultat, bilan équilibré, tableau du rapport d''activité concordant.'
),
(
  'BBGC', 2025, 'S1', 30246000000, null, 1549000000, 17159000000,
  13377000000, 2995000000, 10382000000, null, null,
  null, null, null, 207.64, 34.3, 50000000, 50000000,
  'XOF', 'FCFA', '2025-06-30', '2026-09-24', 'examen_limite',
  'BOC du 24/09/2026 — comparatif 30/06/2025 des états financiers semestriels 2026',
  'https://bfin.brvm.org/boc/BOC_JOUR/BOC_20260924.pdf',
  'validated', now(),
  'Banque : chiffre d''affaires = produit net bancaire (PNB). Colonne comparative 30/06/2025 du compte de résultat BCEAO publié avec le S1 2026. Charges générales d''exploitation 11 538 M ; coût du risque −3 782 M. Pas de bilan au 30/06/2025 dans ce document. BPA = RN / 50 000 000 actions (base actuelle). Recoupé : sous-totaux cohérents et rapport d''activité (PNB 30,2 Md, RN 10,4 Md).'
)
on conflict (ticker, annee, periode) do nothing;

-- 4) Fiche BBGC complétée à partir de BBGCI (seuls les champs vides) ;
--    BBGCI désactivée (doublon sans cotation).
update public.entreprises b
set isin = coalesce(b.isin, i.isin),
    code_isin = coalesce(b.code_isin, i.code_isin),
    nb_actions = coalesce(b.nb_actions, i.nb_actions),
    nombre_actions = coalesce(b.nombre_actions, i.nombre_actions),
    valeur_nominale = coalesce(b.valeur_nominale, i.valeur_nominale),
    compartiment = coalesce(b.compartiment, i.compartiment),
    updated_at = now()
from public.entreprises i
where b.ticker = 'BBGC' and i.ticker = 'BBGCI';

update public.entreprises set actif = false, updated_at = now()
where ticker = 'BBGCI' and actif;
