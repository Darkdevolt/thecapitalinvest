-- The Capital Admin — aggregated dashboard reads and targeted financial profile
-- No existing data is modified.

create or replace function public.admin_dashboard_summary(p_stale_days integer default 7, p_forecast_extreme numeric default 100)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_fin_count bigint; v_fin_tickers bigint; v_forecast_count bigint; v_company_count bigint;
  v_cours_count bigint; v_hist_count bigint; v_div_count bigint; v_users bigint;
  v_complete numeric; v_prov numeric; v_valid numeric; v_fresh numeric; v_coherence numeric; v_health numeric; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  select count(*),count(distinct ticker),
    coalesce(round(100*avg(case when chiffre_affaires is not null and resultat_net is not null and bpa is not null and dpa is not null and fonds_propres is not null and coalesce(nombre_actions,nb_actions) is not null then 1 else 0 end),2),0),
    coalesce(round(100*avg(case when btrim(coalesce(source,''))<>'' and btrim(coalesce(source_url,''))<>'' then 1 else 0 end),2),0),
    coalesce(round(100*avg(case when validation_status='validated' then 1 else 0 end),2),0),
    coalesce(round(100*avg(case when updated_at is not null and updated_at>=now()-make_interval(days=>greatest(p_stale_days,1)) then 1 else 0 end),2),0),
    coalesce(round(100-100*avg(case when (marge_nette is not null and chiffre_affaires<>0 and abs(marge_nette-(resultat_net/chiffre_affaires)*100)>0.5) or (bpa is not null and coalesce(nombre_actions,nb_actions)>0 and abs(bpa-resultat_net/coalesce(nombre_actions,nb_actions))>greatest(1,abs(bpa)*0.05)) or (payout_ratio is not null and dpa is not null and bpa<>0 and abs(payout_ratio-(dpa/bpa)*100)>2) or (roe is not null and fonds_propres<>0 and abs(roe-(resultat_net/fonds_propres)*100)>3) then 1 else 0 end),2),100)
  into v_fin_count,v_fin_tickers,v_complete,v_prov,v_valid,v_fresh,v_coherence
  from financials;
  select count(*) into v_forecast_count from forecasts;
  select count(*) into v_company_count from entreprises where coalesce(actif,true);
  select count(*) into v_cours_count from cours;
  select count(*) into v_hist_count from historique;
  select count(*) into v_div_count from dividendes_calendrier;
  select count(*) into v_users from users;
  v_health=round((v_complete+v_prov+v_valid+v_fresh+v_coherence)/5,0);
  select jsonb_build_object(
    'financials',v_fin_count,'financial_tickers',v_fin_tickers,'forecasts',v_forecast_count,'companies',v_company_count,
    'cours',v_cours_count,'historique',v_hist_count,'dividendes',v_div_count,'users',v_users,
    'quality',jsonb_build_object('overall',v_health,'completeness',v_complete,'coherence',v_coherence,'provenance',v_prov,'validation',v_valid,'freshness',v_fresh),
    'validation',jsonb_build_object('draft',(select count(*) from financials where validation_status='draft'),'review',(select count(*) from financials where validation_status='review'),'validated',(select count(*) from financials where validation_status='validated'),'rejected',(select count(*) from financials where validation_status='rejected')),
    'forecast',jsonb_build_object('stale',(select count(*) from forecasts where annee_forecast<extract(year from current_date)::int),'extreme',(select count(*) from forecasts where potentiel_pct is not null and abs(potentiel_pct)>p_forecast_extreme),'missing_method',(select count(*) from forecasts where btrim(coalesce(methode,''))='')),
    'anomalies',jsonb_build_object('financial',(select count(*) from get_financial_anomalies(1000)),'market',(select count(*) from get_aberrations(1000)))
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.admin_dashboard_summary(integer,numeric) to authenticated;

create or replace function public.admin_financial_profile(p_ticker text)
returns jsonb
language plpgsql
set search_path=public
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  select jsonb_build_object(
    'company',(select to_jsonb(e) from entreprises e where upper(e.ticker)=upper(p_ticker) limit 1),
    'history',coalesce((select jsonb_agg(to_jsonb(f) order by f.annee,f.periode) from financials f where upper(f.ticker)=upper(p_ticker)),'[]'::jsonb),
    'forecasts',coalesce((select jsonb_agg(to_jsonb(fc) order by fc.annee_forecast,fc.metrique) from forecasts fc where upper(fc.ticker)=upper(p_ticker)),'[]'::jsonb),
    'anomalies',coalesce((select jsonb_agg(to_jsonb(a)) from get_financial_anomalies(1000) a where upper(a.ticker)=upper(p_ticker)),'[]'::jsonb)
  ) into v;
  return v;
end;
$$;

grant execute on function public.admin_financial_profile(text) to authenticated;
