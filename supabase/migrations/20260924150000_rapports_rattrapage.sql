-- Rattrapage ponctuel de l'archive des rapports BRVM (≈ 430 rapports des
-- deux derniers exercices restant à copier au 24/09/2026 ; le cron normal
-- tc-rapports-sync en prend 20, 3 fois par jour). Un passage toutes les
-- 10 minutes le 24/09 seulement (25 rapports par passage, < 60 s), puis le
-- job se retire lui-même à 23 h 55 UTC.
select cron.unschedule(jobid) from cron.job where jobname in ('tc-rapports-rattrapage', 'tc-rapports-rattrapage-fin');
select cron.schedule('tc-rapports-rattrapage', '*/10 11-23 24 9 *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"rapports","sinceYears":2,"limit":25}'::jsonb)$$);
select cron.schedule('tc-rapports-rattrapage-fin', '55 23 24 9 *',
  $$select cron.unschedule(jobid) from cron.job where jobname in ('tc-rapports-rattrapage', 'tc-rapports-rattrapage-fin')$$);
