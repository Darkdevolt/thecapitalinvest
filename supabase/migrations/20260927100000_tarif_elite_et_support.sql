-- Elite était moins cher que Pro sur toutes les périodes : repositionné au-dessus
-- de Pro avec les mêmes remises par période. Contact du support : e-mail seul.
update public.billing_plans set weekly_price = 20000, monthly_price = 79900, quarterly_price = 219900,
  semiannual_price = 439000, annual_price = 799000, updated_at = now()
where code = 'elite';

update public.admin_settings
set value = value || '{"support_email":"thecapitalinvest.fin@gmail.com","support_whatsapp":""}'::jsonb, updated_at = now()
where key = 'app_config';
