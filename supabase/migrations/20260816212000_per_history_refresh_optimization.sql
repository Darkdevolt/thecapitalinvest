-- Keep closed years untouched during normal reads. The previous year is only
-- revisited when it is still marked as the dynamic year (e.g. after rollover).

create or replace function public.refresh_per_history(p_ticker text default null, p_full boolean default false)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_current_year integer := extract(year from current_date)::integer;
  v_target_ticker text := nullif(upper(trim(p_ticker)), '');
  v_count integer := 0;
begin
  with existing as (
    select count(*)::integer as n
    from public.per_history ph
    where v_target_ticker is null or upper(ph.ticker) = v_target_ticker
  ),
  target_years as (
    select y.annee
    from generate_series(2010, v_current_year) as y(annee)
    where p_full
       or (select n from existing) = 0
       or y.annee = v_current_year
       or exists (
         select 1
         from public.per_history ph
         where upper(ph.ticker) = coalesce(v_target_ticker, upper(ph.ticker))
           and ph.annee = v_current_year - 1
           and ph.statut = 'en_cours'
       ) and y.annee = v_current_year - 1
  ),
  latest_courses as (
    select distinct on (upper(h.ticker), extract(year from h.date_seance)::integer)
      upper(h.ticker) as ticker,
      extract(year from h.date_seance)::integer as annee,
      h.date_seance,
      coalesce(h.cours_cloture, h.cloture, h.cours_normal) as cours_reference
    from public.historique h
    where h.date_seance is not null
      and h.date_seance >= make_date(2010,1,1)
      and h.date_seance <= current_date
      and (v_target_ticker is null or upper(h.ticker) = v_target_ticker)
    order by upper(h.ticker), extract(year from h.date_seance)::integer, h.date_seance desc, h.id desc
  ),
  annual_bpa as (
    select distinct on (upper(f.ticker), f.annee)
      upper(f.ticker) as ticker,
      f.annee,
      f.bpa
    from public.financials f
    where (f.periode = 'annuel' or f.periode is null)
      and f.annee between 2010 and v_current_year
      and (v_target_ticker is null or upper(f.ticker) = v_target_ticker)
    order by upper(f.ticker), f.annee,
      (f.bpa is not null) desc,
      (lower(coalesce(f.validation_status,'')) = 'validated') desc,
      f.updated_at desc nulls last,
      f.id desc
  ),
  source_rows as (
    select
      c.ticker,
      c.annee,
      b.bpa,
      c.date_seance,
      c.cours_reference,
      case
        when b.bpa is null or b.bpa <= 0 or c.cours_reference is null then null
        else c.cours_reference / b.bpa
      end as per,
      case
        when b.bpa is null then 'BPA manquant'
        when b.bpa = 0 then 'BPA nul'
        when b.bpa < 0 then 'BPA négatif'
        when c.cours_reference is null then 'Cours de référence manquant'
        else null
      end as raison,
      case
        when c.annee = v_current_year then 'en_cours'
        when b.bpa is null or b.bpa <= 0 or c.cours_reference is null then 'non_calculable'
        else 'definitif'
      end as statut
    from latest_courses c
    join target_years ty on ty.annee = c.annee
    left join annual_bpa b on b.ticker = c.ticker and b.annee = c.annee
  ),
  upserted as (
    insert into public.per_history (
      ticker, annee, bpa, date_cours_reference, cours_reference, per,
      statut, raison, date_calcul, updated_at
    )
    select
      ticker, annee, bpa, date_seance, cours_reference, per,
      statut, raison, now(), now()
    from source_rows
    on conflict (ticker, annee) do update set
      bpa = excluded.bpa,
      date_cours_reference = excluded.date_cours_reference,
      cours_reference = excluded.cours_reference,
      per = excluded.per,
      statut = excluded.statut,
      raison = excluded.raison,
      date_calcul = excluded.date_calcul,
      updated_at = excluded.updated_at
    returning 1
  )
  select count(*)::integer into v_count from upserted;

  return v_count;
end;
$$;
