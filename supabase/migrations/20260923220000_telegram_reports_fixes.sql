-- Rapports / alertes Telegram (pg_cron + triggers) : corrections constatées
-- sur les messages du 2026-09-23.
--
-- 1. « Séance enregistrée avec succès (? titres) » : le rapport de fin de
--    séance lisait result->>'count', clé que le pipeline n'écrit pas (il écrit
--    `courses` / `historique`).
-- 2. « Pipeline BRVM en erreur (séance ?) » : sur une erreur de source, le
--    résultat est vide, donc pas de date_seance ; on affiche la date du
--    passage à la place.
-- 3. Rapport quotidien : un passage ESV « partial » (une seule ligne rejetée
--    sur 77) était affiché « ❌ échec ». Un succès partiel est désormais
--    affiché 🟡 avec le nombre de lignes rejetées, et un échec affiche la
--    dernière erreur au lieu d'un simple « échec ».
-- 4. Le token du bot n'est plus écrit en dur dans chaque fonction : il est lu
--    dans Supabase Vault (secrets `telegram_bot_token` et `telegram_chat_id`,
--    à créer une fois via vault.create_secret, hors dépôt).

create or replace function public.tc_send_telegram(msg text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    body := jsonb_build_object('chat_id', chat_id, 'text', msg)
  );
end;
$$;

revoke all on function public.tc_send_telegram(text) from public, anon, authenticated;


create or replace function public.send_daily_report()
returns void
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  cours_ok boolean;
  cours_last_status text;
  obl record;
  esv record;
  msg text;
  line text;
begin
  select bool_or(status = 'success' and result->>'date_seance' = today::text)
    into cours_ok
  from brvm_scrape_runs where started_at::date = today;

  select status into cours_last_status
  from brvm_scrape_runs where started_at::date = today
  order by id desc limit 1;

  select count(*) as n_runs,
         count(*) filter (where status = 'success') as n_success,
         count(*) filter (where status = 'partial') as n_partial,
         (array_agg(status order by id desc))[1] as last_status,
         (array_agg(error order by id desc))[1] as last_error,
         (array_agg(result->>'date_seance' order by id desc) filter (where status = 'success'))[1] as last_date
    into obl
  from obligations_scrape_runs where started_at::date = today;

  select count(*) as n_runs,
         count(*) filter (where status = 'success') as n_success,
         count(*) filter (where status = 'partial') as n_partial,
         (array_agg(status order by id desc))[1] as last_status,
         (array_agg(error order by id desc))[1] as last_error,
         (array_agg(jsonb_array_length(coalesce(result->'row_errors', '[]'::jsonb))
                    + jsonb_array_length(coalesce(result->'doc_errors', '[]'::jsonb))
                    + jsonb_array_length(coalesce(result->'scrape_errors', '[]'::jsonb))
                    order by id desc))[1] as rejected
    into esv
  from esv_scrape_runs where started_at::date = today;

  msg := '📊 Rapport quotidien The Capital — ' || to_char(today, 'DD/MM/YYYY') || E'\n\n';

  msg := msg || (case when cours_ok then '✅' else '❌' end) || ' Cours BRVM (actions) : ' ||
         (case when cours_ok then 'séance du jour enregistrée correctement'
               else 'non enregistrée aujourd''hui (dernier statut : ' || coalesce(cours_last_status, 'aucune exécution') || ')' end) || E'\n';

  line := case
    when obl.n_runs = 0 then '⚪ Obligations : aucune exécution aujourd''hui'
    when obl.n_success > 0 then '✅ Obligations : à jour' ||
         coalesce(' (séance ' || obl.last_date || ')', '')
    when obl.n_partial > 0 then '🟡 Obligations : succès partiel'
    else '❌ Obligations : échec (' || obl.n_runs || ' tentative(s)) — ' ||
         coalesce(obl.last_error, 'voir l''admin')
  end;
  msg := msg || line || E'\n';

  line := case
    when esv.n_runs = 0 then '⚪ Évènements sur valeurs : aucune exécution aujourd''hui (normal avant 18h)'
    when esv.last_status = 'success' then '✅ Évènements sur valeurs : à jour'
    when esv.last_status = 'partial' then '🟡 Évènements sur valeurs : à jour, ' ||
         coalesce(esv.rejected, 0) || ' ligne(s) rejetée(s) — voir l''admin'
    when esv.n_success > 0 then '✅ Évènements sur valeurs : à jour'
    else '❌ Évènements sur valeurs : échec — ' || coalesce(esv.last_error, 'voir l''admin')
  end;
  msg := msg || line;

  perform public.tc_send_telegram(msg);
end;
$$;


create or replace function public.send_session_end_report()
returns void
language plpgsql
security definer
as $$
declare
  today date := (now() at time zone 'utc')::date;
  today_txt text := today::text;
  last_run record;
  n_blocked int;
  n_error int;
  detail text;
  msg text;
begin
  select * into last_run from brvm_scrape_runs
  where started_at::date = today
  order by id desc limit 1;

  select count(*) into n_blocked from brvm_scrape_runs
  where started_at::date = today and status = 'blocked_validation';
  select count(*) into n_error from brvm_scrape_runs
  where started_at::date = today and status = 'error';

  msg := '🔔 Fin de séance BRVM — ' || to_char(today, 'DD/MM/YYYY') || E'\n\n';

  if last_run.status = 'success' and last_run.result->>'date_seance' = today_txt then
    msg := msg || '✅ Séance enregistrée avec succès (' ||
           coalesce(last_run.result->>'courses', last_run.result->>'historique', last_run.result->>'count', '?') ||
           ' titres).';
    select string_agg(format('• %s', w->>'ticker'), ', ')
      into detail
      from jsonb_array_elements(coalesce(last_run.result->'warnings', '[]'::jsonb)) w;
    if detail is not null then
      msg := msg || E'\n⚠️ Avertissements de cohérence (non bloquants) sur : ' || detail;
    end if;
  else
    select string_agg(
      format('• %s : publié %s %%, recalculé %s %%', v->>'ticker',
        round((v->>'variation')::numeric, 2), round((v->>'computed_variation')::numeric, 2)),
      E'\n'
    ) into detail
    from jsonb_array_elements(coalesce(last_run.result->'violations', '[]'::jsonb)) v;

    msg := msg || '❌ Séance NON enregistrée à la clôture.' ||
           E'\nDernier statut : ' || coalesce(last_run.status, 'aucune exécution aujourd''hui') ||
           (case when detail is not null then E'\nTitres en cause :\n' || detail else '' end) ||
           E'\nLe cron continue de réessayer toutes les 15 min jusqu''à 16h.';
  end if;

  msg := msg || E'\n\nIncidents dans la journée — blocages : ' || n_blocked || ' · erreurs : ' || n_error;

  perform public.tc_send_telegram(msg);
end;
$$;


create or replace function public.notify_brvm_pipeline_status()
returns trigger
language plpgsql
security definer
as $$
declare
  prev_status text;
  prev_date text;
  cur_date text;
  seance_label text;
  msg text;
  detail text;
  n_viol int;
  n_warn int;
begin
  cur_date := NEW.result->>'date_seance';
  -- Sur une erreur de source, aucun résultat n'est écrit : on affiche la
  -- date du passage plutôt qu'un « ? ».
  seance_label := coalesce(cur_date,
    'du ' || to_char(coalesce(NEW.started_at, now()) at time zone 'utc', 'DD/MM/YYYY'));

  select status, result->>'date_seance' into prev_status, prev_date
  from brvm_scrape_runs
  where id < NEW.id
  order by id desc
  limit 1;

  if NEW.status in ('blocked_validation', 'error') then
    if prev_status = NEW.status and prev_date is not distinct from cur_date then
      return NEW;
    end if;

    if NEW.status = 'blocked_validation' then
      select count(*) into n_viol from jsonb_array_elements(coalesce(NEW.result->'violations', '[]'::jsonb));
      select string_agg(
        format('• %s : publié %s %%, recalculé %s %% — %s',
          v->>'ticker',
          round((v->>'variation')::numeric, 2),
          round((v->>'computed_variation')::numeric, 2),
          case v->>'type'
            when 'variation_hors_limite' then 'dépassement réel du seuil ±7,5 %'
            when 'variation_incoherente' then 'écart publié/recalculé anormal (souvent : titre suspendu)'
            else coalesce(v->>'type', 'anomalie')
          end),
        E'\n'
      ) into detail
      from jsonb_array_elements(coalesce(NEW.result->'violations', '[]'::jsonb)) v;

      msg := '⚠️ Pipeline BRVM bloqué — séance ' || seance_label ||
             E'\n' || n_viol || ' titre(s) en cause :' ||
             E'\n' || coalesce(detail, '(détail indisponible)') ||
             E'\nAucune donnée de cette séance n''est enregistrée tant que ce n''est pas résolu.';
    else
      msg := '🔴 Pipeline BRVM en erreur (séance ' || seance_label || ') :' ||
             E'\n' || coalesce(NEW.error, 'erreur inconnue') ||
             E'\nNouvelle tentative automatique au prochain passage (15 min).';
    end if;
  elsif NEW.status = 'success' and prev_status in ('blocked_validation', 'error') then
    select count(*) into n_warn from jsonb_array_elements(coalesce(NEW.result->'warnings', '[]'::jsonb));
    msg := '✅ Pipeline BRVM rétabli — séance ' || seance_label || ' enregistrée.' ||
           (case when n_warn > 0 then E'\n(' || n_warn || ' avertissement(s) de cohérence, sans blocage — voir l''admin.)' else '' end);
  else
    return NEW;
  end if;

  perform public.tc_send_telegram(msg);
  return NEW;
end;
$$;


create or replace function public.notify_scrape_run_status()
returns trigger
language plpgsql
security definer
as $$
declare
  prev_status text;
  msg text;
  label text;
begin
  label := case TG_TABLE_NAME
    when 'obligations_scrape_runs' then 'Obligations'
    when 'announcements_scrape_runs' then 'Annonces émetteurs'
    when 'dcbr_scrape_runs' then 'DC/BR'
    when 'esv_scrape_runs' then 'Évènements sur valeurs'
    else TG_TABLE_NAME
  end;

  execute format('select status from %I where id < $1 order by id desc limit 1', TG_TABLE_NAME)
    into prev_status using NEW.id;

  if NEW.status in ('error', 'partial') then
    if prev_status = NEW.status then
      return NEW; -- deja notifie pour ce meme probleme consecutif
    end if;
    msg := (case when NEW.status = 'error' then '🔴 ' else '🟡 ' end) || label || ' : ' ||
           (case when NEW.status = 'error' then 'erreur — ' else 'succès partiel — ' end) ||
           coalesce(NEW.error, 'voir le détail dans l''admin');
  elsif NEW.status = 'success' and prev_status in ('error', 'partial') then
    msg := '✅ ' || label || ' : rétabli, dernier passage réussi.';
  else
    return NEW;
  end if;

  perform public.tc_send_telegram(msg);
  return NEW;
end;
$$;


create or replace function public.send_weekly_report()
returns void
language plpgsql
security definer
as $$
declare
  week_start date := (now() at time zone 'utc')::date - 4; -- lundi de la semaine si on tourne le vendredi
  d date;
  ok_count int := 0;
  total_count int := 0;
  day_line text;
  msg text;
  problem_tickers text;
begin
  msg := '📅 Rapport hebdomadaire The Capital — semaine du ' || to_char(week_start, 'DD/MM') || ' au ' ||
         to_char((now() at time zone 'utc')::date, 'DD/MM/YYYY') || E'\n\n';

  for d in select generate_series(week_start, (now() at time zone 'utc')::date, interval '1 day')::date loop
    if extract(isodow from d) between 1 and 5 then
      total_count := total_count + 1;
      if exists (
        select 1 from brvm_scrape_runs
        where status = 'success' and result->>'date_seance' = d::text
      ) then
        ok_count := ok_count + 1;
        day_line := '✅ ' || to_char(d, 'DD/MM') || ' — séance enregistrée';
      else
        day_line := '❌ ' || to_char(d, 'DD/MM') || ' — séance non enregistrée';
      end if;
      msg := msg || day_line || E'\n';
    end if;
  end loop;

  msg := msg || E'\nBilan : ' || ok_count || ' / ' || total_count || ' séance(s) enregistrée(s) cette semaine.' || E'\n';

  select string_agg(format('%s (%s fois)', ticker, cnt), ', ') into problem_tickers
  from (
    select v->>'ticker' as ticker, count(*) as cnt
    from brvm_scrape_runs r, jsonb_array_elements(coalesce(r.result->'violations', '[]'::jsonb)) v
    where r.started_at::date >= week_start
    group by v->>'ticker'
    order by count(*) desc
    limit 5
  ) t;

  if problem_tickers is not null then
    msg := msg || E'\nTitres les plus souvent signalés cette semaine : ' || problem_tickers;
  end if;

  perform public.tc_send_telegram(msg);
end;
$$;
