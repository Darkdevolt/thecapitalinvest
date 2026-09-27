-- Alertes de prix : suivi de l'envoi. Une alerte atteinte est notifiée une fois
-- par e-mail puis mise en pause (triggered_at renseigné) ; la réactiver la réarme.
alter table public.alertes_cours add column if not exists triggered_at timestamptz;
alter table public.alertes_cours add column if not exists triggered_price numeric;

create index if not exists alertes_cours_actives_idx on public.alertes_cours (ticker) where active;

-- Vérification toutes les 15 min pendant la séance BRVM (9h-15h30 UTC), après
-- l'import des cours (tc-auto-import à :00/:15/:30/:45), plus un passage de
-- clôture à 16h05 UTC.
select cron.unschedule('tc-alertes-prix') where exists (select 1 from cron.job where jobname = 'tc-alertes-prix');
select cron.schedule('tc-alertes-prix', '7,22,37,52 9-15 * * 1-5',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"price-alerts"}'::jsonb)$$);
select cron.unschedule('tc-alertes-prix-cloture') where exists (select 1 from cron.job where jobname = 'tc-alertes-prix-cloture');
select cron.schedule('tc-alertes-prix-cloture', '5 16 * * 1-5',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"price-alerts"}'::jsonb)$$);
