-- Corrections validées par le propriétaire le 03/10/2026.
-- 1. Séance fantôme du 07/08/2026 (fête de l'Indépendance, BRVM fermée) :
--    47 cours et 3 indices copiés à l'identique de la séance du 06/08/2026.
--    Sauvegarde : private.backup_seance_fantome_20260807 et
--    private.backup_indices_fantome_20260807.
delete from public.historique where date_seance = '2026-08-07';
delete from public.indices where date_seance = '2026-08-07';

-- 2. Dividendes par action manquants.
update public.financials set dpa = 406
 where ticker = 'CBIBF' and annee = 2020 and periode = 'annuel' and dpa is null;
update public.financials set dpa = 1112,
       validation_notes = coalesce(validation_notes || ' ; ', '') || 'DPA 2021 : 1 112 FCFA brut (communiqué SGCI résultats 2022).'
 where ticker = 'SGBC' and annee = 2021 and periode = 'annuel' and dpa is null;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261003140000', 'corrections_seance_fantome_dividendes') on conflict do nothing;
