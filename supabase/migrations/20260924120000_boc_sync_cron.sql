-- Bulletins Officiels de la Cote : import automatique depuis brvm.org.
-- Jusqu'ici la table boc n'était alimentée que par l'import manuel de
-- l'admin (2 bulletins au 2026-09-24). Chaque jour de séance à 17 h 30 UTC,
-- /api/process-brvm { scope:'boc' } copie dans le bucket boc_pdfs les
-- bulletins absents de la table (20 au plus par passage ; les séances déjà
-- enregistrées ne sont jamais remplacées).
select cron.unschedule(jobid) from cron.job where jobname = 'tc-boc-sync';
select cron.schedule(
  'tc-boc-sync',
  '30 17 * * 1-5',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"boc","limit":20}'::jsonb)$$
);
