-- 1. tc_send_telegram utilisait le délai par défaut de pg_net (5 s) : le
--    24/09, le rapport quotidien de 18:30 a été perdu (poignée de main TLS
--    avec api.telegram.org > 5 s). Délai porté à 20 s.
create or replace function public.tc_send_telegram(msg text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  bot_token text;
  chat_id text;
begin
  select decrypted_secret into bot_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into chat_id from vault.decrypted_secrets where name = 'telegram_chat_id';
  if bot_token is null or chat_id is null then
    raise warning 'tc_send_telegram : secrets Vault telegram_bot_token / telegram_chat_id absents';
    return;
  end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', chat_id, 'text', msg),
    timeout_milliseconds := 20000
  );
end;
$function$;

-- 2. La BRVM publie le Bulletin Officiel de la Cote après 17:30 : second
--    passage le matin (07:30 UTC, du mardi au samedi) pour récupérer celui de
--    la veille sans attendre le lendemain soir.
select cron.unschedule(jobid) from cron.job where jobname = 'tc-boc-sync-matin';
select cron.schedule('tc-boc-sync-matin', '30 7 * * 2-6',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"boc","limit":20}'::jsonb)$$);
