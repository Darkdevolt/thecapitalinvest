-- 1) Veille du BOC du jour sur bfin.brvm.org/boc/boc_jour.aspx
--    Toutes les 45 min de 16h00 à 22h45 (heure d'Abidjan = UTC), jours de
--    séance : 16:00, 16:45, 17:30, 18:15, 19:00, 19:45, 20:30, 21:15, 22:00,
--    22:45. Chaque passage ne déclenche l'appel que tant que le BOC du jour
--    n'est pas encore en base : une fois récupéré, les passages suivants ne
--    coûtent rien. L'ancien passage unique de 17h30 est remplacé (il fait
--    partie de la nouvelle grille) ; le passage de 07h30 le lendemain reste
--    en filet de sécurité.

select cron.unschedule('tc-boc-sync') where exists (select 1 from cron.job where jobname = 'tc-boc-sync');

do $$
declare
  cmd text := $cmd$
    select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"boc","limit":3}'::jsonb)
    where not exists (select 1 from public.boc where date_seance = current_date)
  $cmd$;
begin
  perform cron.schedule('tc-boc-veille-a', '0,45 16,19,22 * * 1-5', cmd);
  perform cron.schedule('tc-boc-veille-b', '30 17,20 * * 1-5', cmd);
  perform cron.schedule('tc-boc-veille-c', '15 18,21 * * 1-5', cmd);
end $$;

-- 2) BOA Mali — rapport d'activités du 1er semestre 2026 (publié le 23/09/2026)
--    Recoupement : les chiffres 30/06/2025 du document = base (PNB 18 713,
--    RBE 8 355, RN 6 206) et les variations publiées = N − (N−1)
--    (3 274 / 2 456 / 510) -> validé.
insert into public.financials (
  ticker, annee, periode, chiffre_affaires, rbe, resultat_net, bpa, marge_nette,
  nb_actions, nombre_actions, devise, unite, date_arrete, date_publication,
  source, source_url, validation_status, validated_at, validation_notes
) values (
  'BOAM', 2026, 'S1', 21987000000, 10811000000, 6716000000, 244.66, 30.5,
  27450000, 27450000, 'XOF', 'FCFA', '2026-06-30', '2026-09-23',
  'Rapport d''activité du 1er semestre 2026 (BRVM)',
  'https://www.brvm.org/sites/default/files/20260923_-_rapport_dactivites_-_1er_semestre_2026_-_boa_mali.pdf',
  'validated', now(),
  'Banque : chiffre d''affaires = produit net bancaire (PNB). Comptes sociaux en normes locales, semestre (cumul 6 mois), montants publiés en millions de FCFA repris tels quels (non audités). Frais généraux 11 176 M ; coût du risque −4 525 M (−3 664 M au 30/06/2025 selon ce document). BPA = résultat net / 27 450 000 actions. Recoupé : colonne 30/06/2025 identique à la base et variations publiées cohérentes. Pas de bilan dans ce rapport.'
) on conflict (ticker, annee, periode) do nothing;
