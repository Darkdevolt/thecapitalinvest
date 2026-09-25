-- Bulletins de marché prêts à publier (story TikTok 9:16, carré 1:1, carrousel 4:5
-- + PDF LinkedIn, textes TikTok / LinkedIn) : /api/telegram-report, rangés dans le
-- bucket public `bulletins` (reporting/<periode>/<date>/) et envoyés sur Telegram.

-- Identifiants Telegram du Vault, lisibles par le seul rôle serveur (service_role) :
-- l'API les utilise si TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID ne sont pas définis sur Vercel.
create or replace function public.tc_telegram_credentials()
returns table (bot_token text, chat_id text)
language sql
security definer
set search_path = public
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_chat_id')
$$;
revoke all on function public.tc_telegram_credentials() from public, anon, authenticated;
grant execute on function public.tc_telegram_credentials() to service_role;

-- Séance : 16 h 40 UTC du lundi au vendredi (clôture 15 h, dernier import automatique 15 h 45).
-- Jour sans séance (férié) : l'API ne publie rien.
select cron.unschedule(jobid) from cron.job where jobname in ('tc-bulletin-seance', 'tc-bulletin-hebdo');
select cron.schedule('tc-bulletin-seance', '40 16 * * 1-5',
  $$select public.tc_call_api('/api/telegram-report?periode=seance', 'GET')$$);
-- Semaine : vendredi 17 h 20 UTC.
select cron.schedule('tc-bulletin-hebdo', '20 17 * * 5',
  $$select public.tc_call_api('/api/telegram-report?periode=hebdo', 'GET')$$);
