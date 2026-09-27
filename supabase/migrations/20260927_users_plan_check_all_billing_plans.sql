-- La contrainte n'acceptait que free/pro/elite : toute activation Investor
-- (attribution admin ou paiement validé) échouait. Appliquée le 27/09/2026.
alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check check (plan = any (array['free','investor','pro','elite','all']));
