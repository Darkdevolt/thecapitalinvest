-- Registre des bulletins (séance / semaine) : un bulletin n'est JAMAIS envoyé deux fois,
-- chaque tentative laisse une trace (envoyé, bloqué par le contrôle qualité, sans séance,
-- erreur), et une vérification du soir alerte si rien n'a été tracé un jour de séance.
create table if not exists public.reporting_envois (
  id bigserial primary key,
  periode text not null check (periode in ('seance', 'hebdo')),
  date_ref date not null,
  essai int not null default 1,
  statut text not null check (statut in ('en_cours', 'envoye', 'bloque', 'sans_seance', 'erreur')),
  bloquants jsonb not null default '[]'::jsonb,
  avertissements jsonb not null default '[]'::jsonb,
  fichiers jsonb,
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Verrou anti-doublon : une seule ligne « en cours » ou « envoyé » par bulletin, même si
-- deux déclenchements arrivent en même temps.
create unique index if not exists reporting_envois_un_seul_envoi
  on public.reporting_envois (periode, date_ref) where statut in ('en_cours', 'envoye');
create index if not exists reporting_envois_date on public.reporting_envois (date_ref desc);
alter table public.reporting_envois enable row level security; -- aucun accès public : rôle serveur seulement

-- Vérification du soir (20 h 40 UTC, lundi-vendredi) : si la BRVM a coté aujourd'hui et
-- qu'aucune issue définitive n'est tracée pour le bulletin de séance, l'API n'a pas pu
-- s'exécuter (plantage, délai dépassé, déploiement cassé) : alerte Telegram.
create or replace function public.tc_verifier_bulletin_du_jour()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  jour date := (now() at time zone 'utc')::date;
  seance boolean;
  trace text;
begin
  select exists (select 1 from historique where date_seance = jour) into seance;
  select string_agg(statut || ' (essai ' || essai || ')', ', ' order by id) into trace
    from reporting_envois where periode = 'seance' and date_ref = jour;
  if seance and not exists (
    select 1 from reporting_envois where periode = 'seance' and date_ref = jour and statut in ('envoye', 'bloque', 'sans_seance')
  ) then
    perform public.tc_send_telegram(
      '🚨 Bulletin du ' || to_char(jour, 'DD/MM/YYYY') || E' : aucune issue enregistrée alors que la séance est en base.\n' ||
      'Traces : ' || coalesce(trace, 'aucune (l''API n''a pas répondu)') || E'.\n' ||
      'À vérifier : déploiement Vercel et journaux de /api/telegram-report.');
  end if;
end;
$$;
revoke all on function public.tc_verifier_bulletin_du_jour() from public, anon, authenticated;

-- Trois essais par séance : 16 h 40 (après clôture et dernier import), 18 h 10, 20 h 10.
-- L'API ne renvoie rien si le bulletin est déjà parti ; le dernier essai trace une issue définitive.
select cron.unschedule(jobid) from cron.job
  where jobname in ('tc-bulletin-seance', 'tc-bulletin-seance-2', 'tc-bulletin-seance-3', 'tc-bulletin-hebdo', 'tc-bulletin-hebdo-2', 'tc-bulletin-verif');
select cron.schedule('tc-bulletin-seance', '40 16 * * 1-5', $$select public.tc_call_api('/api/telegram-report?periode=seance&essai=1', 'GET')$$);
select cron.schedule('tc-bulletin-seance-2', '10 18 * * 1-5', $$select public.tc_call_api('/api/telegram-report?periode=seance&essai=2', 'GET')$$);
select cron.schedule('tc-bulletin-seance-3', '10 20 * * 1-5', $$select public.tc_call_api('/api/telegram-report?periode=seance&essai=3', 'GET')$$);
select cron.schedule('tc-bulletin-hebdo', '20 17 * * 5', $$select public.tc_call_api('/api/telegram-report?periode=hebdo&essai=1', 'GET')$$);
select cron.schedule('tc-bulletin-hebdo-2', '25 20 * * 5', $$select public.tc_call_api('/api/telegram-report?periode=hebdo&essai=3', 'GET')$$);
select cron.schedule('tc-bulletin-verif', '40 20 * * 1-5', $$select public.tc_verifier_bulletin_du_jour()$$);
