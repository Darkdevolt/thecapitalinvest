-- Alertes du pipeline BRVM (séance du 2026-09-24) :
--
-- 1. Un simple délai dépassé de brvm.org (≈ 1 passage sur 25, rétabli au
--    passage suivant) déclenchait immédiatement « 🔴 Pipeline en erreur ».
--    Une erreur réseau passagère n'alerte plus qu'au 2e échec consécutif
--    (30 min sans données) ; une erreur d'une autre nature alerte tout de suite.
--    « ✅ rétabli » n'est envoyé que si une alerte l'a été.
-- 2. Nouveau statut « blocked_mapping » (rapprochement ambigu d'un titre).
-- 3. Titre coté inconnu du référentiel (nouvelle introduction : BBGC le
--    24/09/2026, qui bloquait la séance sans aucune alerte) : la séance est
--    désormais publiée et un message signale le titre, une fois par liste.
-- 4. Job tc-market-auto-refresh désactivé (non supprimé) : il appelait toutes
--    les 15 min l'Edge Function scrape-brvm sans jeton d'administrateur
--    (401 systématique) ; cette fonction ne fait que lire et refuse de
--    tourner avant 16 h UTC. L'import réel est assuré par tc-auto-import.

create or replace function public.tc_is_transient_error(err text)
returns boolean
language sql
immutable
as $$
  select coalesce(err, '') ~* '(délai dépassé|timeout|HTTP 5[0-9][0-9]|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|aborted)';
$$;

create or replace function public.notify_brvm_pipeline_status()
returns trigger
language plpgsql
security definer
as $$
declare
  prev_status text;
  prev_date text;
  prev_unmatched jsonb;
  cur_date text;
  seance_label text;
  msg text;
  detail text;
  n_viol int;
  n_warn int;
  streak int := 0;           -- erreurs consécutives juste avant ce passage
  streak_alerted boolean := false;
  r record;
  cur_unmatched jsonb;
begin
  cur_date := NEW.result->>'date_seance';
  seance_label := coalesce(cur_date,
    'du ' || to_char(coalesce(NEW.started_at, now()) at time zone 'utc', 'DD/MM/YYYY'));

  select status, result->>'date_seance' into prev_status, prev_date
  from brvm_scrape_runs where id < NEW.id order by id desc limit 1;

  -- Série d'erreurs précédant ce passage, et si elle a déjà été signalée.
  for r in select status, error from brvm_scrape_runs where id < NEW.id order by id desc limit 20 loop
    exit when r.status <> 'error';
    streak := streak + 1;
    if not public.tc_is_transient_error(r.error) or streak >= 2 then
      streak_alerted := true;
    end if;
  end loop;

  if NEW.status = 'error' then
    if streak_alerted then
      return NEW;                                   -- déjà signalé
    end if;
    if public.tc_is_transient_error(NEW.error) and streak = 0 then
      return NEW;                                   -- 1er échec réseau : on attend le passage suivant
    end if;
    msg := '🔴 Pipeline BRVM en erreur (séance ' || seance_label || ') :' ||
           E'\n' || coalesce(NEW.error, 'erreur inconnue') ||
           case when streak >= 1 then E'\n' || (streak + 1) || ' passages consécutifs en échec (' || (streak + 1) * 15 || ' min sans nouvelles données).' else '' end ||
           E'\nNouvelle tentative automatique au prochain passage (15 min).';

  elsif NEW.status in ('blocked_validation', 'blocked_mapping') then
    if prev_status = NEW.status and prev_date is not distinct from cur_date then
      return NEW;
    end if;
    if NEW.status = 'blocked_mapping' then
      select string_agg(format('• %s (%s) : %s', coalesce(a->>'source_ticker', '?'),
                               coalesce(a->>'source_name', 'nom inconnu'),
                               coalesce((select string_agg(c->>'ticker', ' / ') from jsonb_array_elements(a->'candidates') c), 'aucun candidat')), E'\n')
        into detail
      from jsonb_array_elements(coalesce(NEW.result->'mapping'->'ambiguous', '[]'::jsonb)) a;
      msg := '⚠️ Pipeline BRVM bloqué — séance ' || seance_label ||
             E'\nRapprochement ambigu entre la cote BRVM et le référentiel :' ||
             E'\n' || coalesce(detail, '(détail indisponible)') ||
             E'\nCorriger le ticker dans la table entreprises ; nouvelle tentative toutes les 15 min.';
    else
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
    end if;

  elsif NEW.status = 'success' then
    msg := null;
    if prev_status in ('blocked_validation', 'blocked_mapping') or streak_alerted then
      select count(*) into n_warn from jsonb_array_elements(coalesce(NEW.result->'warnings', '[]'::jsonb));
      msg := '✅ Pipeline BRVM rétabli — séance ' || seance_label || ' enregistrée.' ||
             (case when n_warn > 0 then E'\n(' || n_warn || ' avertissement(s) de cohérence, sans blocage — voir l''admin.)' else '' end);
    end if;

    -- Titres cotés absents du référentiel : signalés à chaque changement de liste.
    select coalesce(jsonb_agg(u->>'source_ticker' order by u->>'source_ticker'), '[]'::jsonb) into cur_unmatched
    from jsonb_array_elements(coalesce(NEW.result->'mapping'->'unmatched', '[]'::jsonb)) u;
    select coalesce(jsonb_agg(u->>'source_ticker' order by u->>'source_ticker'), '[]'::jsonb) into prev_unmatched
    from jsonb_array_elements(coalesce((select result->'mapping'->'unmatched' from brvm_scrape_runs
                                        where id < NEW.id and status = 'success' order by id desc limit 1), '[]'::jsonb)) u;
    if jsonb_array_length(cur_unmatched) > 0 and cur_unmatched is distinct from prev_unmatched then
      msg := coalesce(msg || E'\n\n', '') ||
             '🆕 Titre(s) coté(s) inconnu(s) du site — séance ' || seance_label || ' : ' ||
             (select string_agg(x, ', ') from jsonb_array_elements_text(cur_unmatched) x) ||
             E'\nProbable nouvelle introduction en bourse. Les autres titres sont bien enregistrés ; ' ||
             E'ajouter la société dans la table entreprises pour enregistrer son cours.';
    end if;
    if msg is null then
      return NEW;
    end if;
  else
    return NEW;
  end if;

  perform public.tc_send_telegram(msg);
  return NEW;
end;
$$;

-- Désactivé, pas supprimé : cron.alter_job(..., active := true) pour le rétablir.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'tc-market-auto-refresh';
