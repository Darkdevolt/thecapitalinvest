-- Rattrapage des rapports déplacé hors séance : en journée brvm.org répond
-- en 12 à 40 s par page (constaté le 24/09 entre 11 h 30 et 12 h 30 UTC), les
-- passages dépassaient les 60 s de la fonction. Le soir et la nuit, un passage
-- de 25 rapports tient en moins de 60 s. Toutes les 10 min de 19 h à 6 h 50
-- UTC (nuit du 24 au 25/09), puis le job se retire lui-même.
select cron.unschedule(jobid) from cron.job
where jobname in ('tc-rapports-rattrapage', 'tc-rapports-rattrapage-nuit', 'tc-rapports-rattrapage-fin');
select cron.schedule('tc-rapports-rattrapage', '*/10 19-23 24 9 *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"rapports","sinceYears":2,"limit":25}'::jsonb)$$);
select cron.schedule('tc-rapports-rattrapage-nuit', '*/10 0-6 25 9 *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"rapports","sinceYears":2,"limit":25}'::jsonb)$$);
select cron.schedule('tc-rapports-rattrapage-fin', '55 6 25 9 *',
  $$select cron.unschedule(jobid) from cron.job where jobname in ('tc-rapports-rattrapage', 'tc-rapports-rattrapage-nuit', 'tc-rapports-rattrapage-fin')$$);
