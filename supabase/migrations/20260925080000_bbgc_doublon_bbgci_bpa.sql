-- Bridge Bank Group CI : un seul titre, BBGC (coté depuis le 24/09/2026, 50 000 000 actions,
-- ISIN CI0000010609). BBGCI est un doublon inactif (même ISIN) qui portait une copie des
-- exercices 2020-2025 : il apparaissait dans les listes construites depuis les états
-- financiers sans aucun cours (les séances sont enregistrées sous BBGC) et avec un BNPA
-- sur 2025 seulement. Toutes ses lignes existent à l'identique sous BBGC : on les supprime.
delete from public.financials f
where f.ticker = 'BBGCI'
  and exists (
    select 1 from public.financials b
    where b.ticker = 'BBGC' and b.annee = f.annee and b.periode = f.periode
      and b.resultat_net is not distinct from f.resultat_net
      and b.fonds_propres is not distinct from f.fonds_propres
  );

-- BNPA 2020-2024 de BBGC : le nombre d'actions d'avant l'introduction n'est pas publié ;
-- le BNPA est ramené aux 50 000 000 actions actuelles (même base que 2025 et le S1 2026),
-- ce qui rend la série comparable au cours coté. nombre_actions reste vide (non publié).
update public.financials
set bpa = round(resultat_net / 50000000.0, 2),
    validation_notes = coalesce(validation_notes, '') || ' | 2026-09-25 : BNPA = résultat net ÷ 50 000 000 actions (base actuelle ; nombre d''actions d''avant l''introduction non publié).'
where ticker = 'BBGC' and periode = 'annuel' and annee between 2020 and 2024
  and bpa is null and resultat_net is not null;
