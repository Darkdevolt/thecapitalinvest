-- Le secret machine (x-cron-secret) figurait en clair dans la commande des
-- jobs tc-auto-import et tc-market-auto-refresh (lisible par quiconque accède
-- à cron.job). tc-auto-import passe par tc_call_api(), qui lit le secret dans
-- Vault : le changer ne demande plus que de mettre à jour le secret Vault
-- cron_secret et la variable CRON_SECRET de Vercel. Même planning, même appel.
select cron.alter_job(jobid,
  command := $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"auto"}'::jsonb)$$)
from cron.job where jobname = 'tc-auto-import';

-- Job désactivé (voir 20260924130000) : commande neutralisée pour retirer le secret.
select cron.alter_job(jobid,
  command := $$select 1 /* désactivé : ancienne Edge Function scrape-brvm (401), remplacée par tc-auto-import */$$)
from cron.job where jobname = 'tc-market-auto-refresh';
