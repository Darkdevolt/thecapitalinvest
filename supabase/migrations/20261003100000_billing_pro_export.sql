-- Formule Pro : l'export Excel / PDF des données financières complètes
-- (api/marche.js type=export_financier, réservé au palier « pro ») figure
-- dans la liste des avantages affichée aux clients. Idempotent.
update public.billing_plans
set features = features || '["Export Excel / PDF des données financières"]'::jsonb,
    updated_at = now()
where code = 'pro'
  and not features @> '["Export Excel / PDF des données financières"]'::jsonb;
