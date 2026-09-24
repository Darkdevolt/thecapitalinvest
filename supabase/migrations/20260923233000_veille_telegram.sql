-- Veille automatique + alertes Telegram (demande du 2026-09-23) :
--
-- 1. documents_emetteurs : période couverte (exercice, periode) pour les
--    états financiers / rapports d'activités archivés depuis
--    brvm.org/fr/rapports-societes-cotees (scope 'rapports' de process-brvm).
-- 2. rapports_scrape_runs : journal de ce flux, alertes Telegram en cas
--    d'échec comme les autres journaux (notify_scrape_run_status).
-- 3. send_veille_digest() : message Telegram récapitulant ce qui est apparu
--    depuis le précédent envoi — nouveaux dividendes / coupons / opérations
--    sur titres, nouveaux documents émetteurs, comptes publiés par la BRVM
--    mais pas encore chiffrés sur le site. Rien de nouveau : aucun message.
-- 4. send_daily_report() : ajoute la fraîcheur de chaque flux et le nombre de
--    comptes publiés restant à chiffrer.
-- 5. Tâches pg_cron : rapports, annonces et ESV plusieurs fois par jour, veille
--    toutes les 4 heures. Le secret machine est lu dans Vault (cron_secret),
--    jamais écrit ici.

alter table public.documents_emetteurs add column if not exists exercice integer;
alter table public.documents_emetteurs add column if not exists periode text;

create table if not exists public.rapports_scrape_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  result jsonb,
  error text,
  triggered_by uuid
);
alter table public.rapports_scrape_runs enable row level security;

drop trigger if exists trg_notify_scrape_run_status on public.rapports_scrape_runs;
create trigger trg_notify_scrape_run_status
  after insert on public.rapports_scrape_runs
  for each row execute function public.notify_scrape_run_status();

create table if not exists public.tc_veille_state (
  cle text primary key,
  derniere_execution timestamptz not null
);
alter table public.tc_veille_state enable row level security;


-- Libellé du journal rapports dans les alertes d'échec.
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
    when 'rapports_scrape_runs' then 'Rapports / états financiers'
    when 'dcbr_scrape_runs' then 'DC/BR'
    when 'esv_scrape_runs' then 'Évènements sur valeurs'
    else TG_TABLE_NAME
  end;

  execute format('select status from %I where id < $1 order by id desc limit 1', TG_TABLE_NAME)
    into prev_status using NEW.id;

  if NEW.status in ('error', 'partial') then
    if prev_status = NEW.status then
      return NEW;
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


-- Comptes publiés (états financiers, rapports d'activités) dont la période
-- n'a pas encore de ligne dans `financials`.
create or replace view public.v_comptes_a_chiffrer as
select distinct on (d.ticker, d.exercice, d.periode)
  d.ticker, d.exercice, d.periode, d.titre, d.date_publication, d.source_url, d.created_at
from public.documents_emetteurs d
where d.categorie in ('etats_financiers', 'rapport_activites')
  and d.ticker is not null and d.exercice is not null and d.periode is not null
  and d.exercice >= extract(year from now())::int - 1
  and not exists (
    select 1 from public.financials f
    where f.ticker = d.ticker and f.annee = d.exercice and f.periode = d.periode
  )
order by d.ticker, d.exercice, d.periode, d.date_publication desc;

revoke all on public.v_comptes_a_chiffrer from anon, authenticated;


create or replace function public.tc_categorie_label(cat text)
returns text
language sql
immutable
as $$
  select case cat
    when 'convocation_ag' then 'Convocation AG'
    when 'projet_resolution' then 'Projet de résolution'
    when 'notation_financiere' then 'Notation financière'
    when 'communique' then 'Communiqué'
    when 'changement_dirigeants' then 'Changement de dirigeants'
    when 'franchissement_seuil' then 'Franchissement de seuil'
    when 'etats_financiers' then 'États financiers'
    when 'rapport_activites' then 'Rapport d''activités'
    when 'dividende' then '💰 Dividende'
    when 'coupon' then '🎟️ Coupon'
    when 'augmentation_capital' then '📈 Augmentation de capital'
    when 'reduction_capital' then 'Réduction de capital'
    when 'fractionnement' then '✂️ Fractionnement'
    when 'consolidation' then 'Regroupement d''actions'
    when 'fusion_absorption' then '🤝 Fusion-absorption'
    when 'radiation' then '🚪 Radiation'
    else cat
  end
$$;


create or replace function public.send_veille_digest(force boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz;
  msg text := '';
  part text;
  n_total int;
  n_maj int;
  n_pending int;
begin
  select derniere_execution into since from tc_veille_state where cle = 'veille';
  since := coalesce(since, now() - interval '1 day');

  -- 1. Évènements sur valeurs nouveaux (dividendes, coupons, OST…).
  select count(*) into n_total from evenements_valeurs where created_at > since;
  if n_total > 0 then
    select string_agg(l, E'\n') into part from (
      select format('• %s — %s%s%s',
               tc_categorie_label(categorie),
               coalesce(ticker, obligation, emetteur_brvm, '?'),
               case when montant_net is not null
                    then ' : ' || replace(to_char(montant_net, 'FM999G999G990D99'), ',', ' ') || ' FCFA net' else '' end,
               case when date_paiement is not null
                    then ', paiement le ' || to_char(date_paiement, 'DD/MM/YYYY') else '' end) l
      from evenements_valeurs where created_at > since
      order by (categorie = 'dividende') desc, coalesce(date_paiement, date_evenement) desc nulls last
      limit 15
    ) t;
    msg := msg || E'🔔 Nouveaux évènements sur valeurs (' || n_total || E') :\n' || part ||
           case when n_total > 15 then E'\n… et ' || (n_total - 15) || ' autre(s)' else '' end || E'\n\n';
  end if;

  select count(*) into n_maj from evenements_valeurs
  where last_changed_at > since and created_at <= since;
  if n_maj > 0 then
    msg := msg || '✏️ ' || n_maj || E' évènement(s) sur valeurs modifié(s) par la BRVM (dates / montants).\n\n';
  end if;

  -- 2. Nouveaux documents émetteurs.
  select count(*) into n_total from documents_emetteurs where created_at > since;
  if n_total > 0 then
    select string_agg(l, E'\n') into part from (
      select format('• %s — %s : %s', tc_categorie_label(categorie), coalesce(ticker, societe_nom, '?'),
               left(regexp_replace(coalesce(titre, ''), '^[^:]*:\s*', ''), 90)) l
      from documents_emetteurs where created_at > since
      order by date_publication desc nulls last
      limit 15
    ) t;
    msg := msg || E'📄 Nouvelles publications émetteurs (' || n_total || E') :\n' || part ||
           case when n_total > 15 then E'\n… et ' || (n_total - 15) || ' autre(s)' else '' end || E'\n\n';
  end if;

  -- 3. Comptes publiés mais pas encore chiffrés sur le site.
  select count(*) into n_pending from v_comptes_a_chiffrer;
  select string_agg(l, E'\n') into part from (
    select format('• %s %s %s', ticker, periode, exercice) l
    from v_comptes_a_chiffrer where created_at > since
    order by date_publication desc limit 15
  ) t;
  if part is not null then
    msg := msg || E'🧮 Comptes publiés à saisir dans le site :\n' || part ||
           E'\n(' || n_pending || E' période(s) au total en attente de chiffrage)\n\n';
  end if;

  update tc_veille_state set derniere_execution = now() where cle = 'veille';
  if not found then
    insert into tc_veille_state (cle, derniere_execution) values ('veille', now());
  end if;

  if msg = '' and not force then
    return;
  end if;
  if msg = '' then
    msg := E'Rien de nouveau depuis le dernier point.\n';
  end if;

  perform tc_send_telegram('🛰️ Veille The Capital — ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || E' (GMT)\n\n' || rtrim(msg, E'\n'));
end;
$$;

revoke all on function public.send_veille_digest(boolean) from public, anon, authenticated;


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
  fraicheur text := '';
  last_ok timestamptz;
  n_pending int;
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

  -- Fraîcheur : un flux sans passage réussi depuis plus de 2 jours est signalé.
  select max(started_at) into last_ok from announcements_scrape_runs where status in ('success', 'partial');
  if last_ok is null or last_ok < now() - interval '2 days' then
    fraicheur := fraicheur || E'\n⚠️ Annonces émetteurs : aucun passage réussi depuis ' ||
                 coalesce(to_char(last_ok, 'DD/MM/YYYY'), 'jamais');
  end if;
  select max(started_at) into last_ok from rapports_scrape_runs where status in ('success', 'partial');
  if last_ok is null or last_ok < now() - interval '2 days' then
    fraicheur := fraicheur || E'\n⚠️ Rapports / états financiers : aucun passage réussi depuis ' ||
                 coalesce(to_char(last_ok, 'DD/MM/YYYY'), 'jamais');
  end if;
  select max(started_at) into last_ok from esv_scrape_runs where status in ('success', 'partial');
  if last_ok is null or last_ok < now() - interval '2 days' then
    fraicheur := fraicheur || E'\n⚠️ Évènements sur valeurs : aucun passage réussi depuis ' ||
                 coalesce(to_char(last_ok, 'DD/MM/YYYY'), 'jamais');
  end if;
  if fraicheur <> '' then
    msg := msg || E'\n' || fraicheur;
  end if;

  select count(*) into n_pending from v_comptes_a_chiffrer;
  msg := msg || E'\n\n' || case when n_pending = 0
    then '✅ Comptes publiés : tous chiffrés sur le site'
    else '🧮 Comptes publiés à saisir sur le site : ' || n_pending || ' période(s)'
  end;

  perform public.tc_send_telegram(msg);
end;
$$;


-- Appel machine vers l'API Vercel, secret lu dans Vault.
create or replace function public.tc_call_api(path text, method text default 'POST', body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  headers jsonb;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if secret is null then
    raise warning 'tc_call_api : secret Vault cron_secret absent';
    return null;
  end if;
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret);
  if method = 'GET' then
    return net.http_get(url := 'https://thecapitalinvest.vercel.app' || path, headers := headers,
                        timeout_milliseconds := 55000);
  end if;
  return net.http_post(url := 'https://thecapitalinvest.vercel.app' || path, headers := headers,
                       body := body, timeout_milliseconds := 55000);
end;
$$;

revoke all on function public.tc_call_api(text, text, jsonb) from public, anon, authenticated;


do $$
begin
  perform cron.unschedule(jobname) from cron.job
  where jobname in ('tc-rapports-sync', 'tc-announcements-sync', 'tc-esv-sync', 'tc-veille-digest');
end $$;

select cron.schedule('tc-rapports-sync', '20 7,13,19 * * *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"rapports","sinceYears":2,"limit":20}'::jsonb)$$);
select cron.schedule('tc-announcements-sync', '40 7,13,19 * * *',
  $$select public.tc_call_api('/api/process-brvm', 'POST', '{"scope":"announcements","sinceYears":1,"limit":30}'::jsonb)$$);
select cron.schedule('tc-esv-sync', '10 10,15 * * 1-5',
  $$select public.tc_call_api('/api/process-brvm?scope=esv', 'GET')$$);
select cron.schedule('tc-veille-digest', '0 8,12,16,20 * * *',
  $$select public.send_veille_digest()$$);
