-- Fonctions SECURITY DEFINER appelables par n'importe qui via /rest/v1/rpc
-- (alerte Supabase 0028/0029) :
--   * admin_payment_revenue_summary exposait le chiffre d'affaires (commandes,
--     revenus 30 j / 12 mois) sans aucun contrôle d'identité ;
--   * send_*_report déclenchaient l'envoi des rapports Telegram ;
--   * trigger_brvm_scrape empilait des passages de collecte ;
--   * les fonctions de déclencheur n'ont rien à faire dans l'API.
-- Elles restent appelables par service_role (serveur) et par pg_cron (postgres).
revoke execute on function public.admin_payment_revenue_summary() from public, anon, authenticated;
revoke execute on function public.send_daily_report() from public, anon, authenticated;
revoke execute on function public.send_weekly_report() from public, anon, authenticated;
revoke execute on function public.send_session_end_report() from public, anon, authenticated;
revoke execute on function public.trigger_brvm_scrape() from public, anon, authenticated;
revoke execute on function public.admin_audit_trigger() from public, anon, authenticated;
revoke execute on function public.initialize_new_user_trial() from public, anon, authenticated;
revoke execute on function public.notify_brvm_pipeline_status() from public, anon, authenticated;
revoke execute on function public.notify_scrape_run_status() from public, anon, authenticated;
revoke execute on function public.tc_sync_dividende_esv() from public, anon, authenticated;
grant execute on function public.admin_payment_revenue_summary() to service_role;
grant execute on function public.trigger_brvm_scrape() to service_role;
