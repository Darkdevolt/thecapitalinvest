-- Opérations sur titres : le facteur d'ajustement des BPA/DPA devient AUTOMATIQUE.
-- entreprises.operations_capital = [{date, ratio, type, cours_bruts?, deja_ajuste_avant?, note}]
--   type « ajustants » (changent le nombre d'actions sans apport d'argent) :
--     fractionnement (ratio > 1, ex. 10 nouvelles pour 1), attribution_gratuite (ratio = 1 + parité, ex. 1 pour 2 -> 1,5),
--     regroupement (ratio < 1, ex. 0,1 pour 10 anciennes -> 1 nouvelle)
--   type informatifs (aucun ajustement rétroactif) : augmentation_numeraire, fusion, autre
-- Règle de saisie : nombre_actions et BPA d'une ligne financials = base d'actions EN VIGUEUR à sa date d'arrêté ;
-- facteur_actions (multiplicateur BPA/DPA vers la base ACTUELLE) est calculé ici, plus jamais saisi à la main.

create or replace function public.facteur_actions_a(p_ticker text, p_date date)
returns numeric
language sql stable
set search_path = public
as $$
  select round(coalesce(exp(sum(-ln((o->>'ratio')::numeric))), 1), 10)
  from public.entreprises e, jsonb_array_elements(coalesce(e.operations_capital, '[]'::jsonb)) o
  where e.ticker = p_ticker
    and p_date is not null
    and o->>'type' in ('fractionnement', 'attribution_gratuite', 'regroupement')
    and coalesce((o->>'ratio')::numeric, 0) > 0
    and (o->>'date')::date > p_date
$$;

create or replace function public.date_fin_periode(p_annee int, p_periode text, p_arrete date)
returns date
language sql immutable
as $$
  select coalesce(p_arrete, case lower(coalesce(p_periode, 'annuel'))
    when 'q1' then make_date(p_annee, 3, 31)
    when 'q2' then make_date(p_annee, 6, 30) when 's1' then make_date(p_annee, 6, 30)
    when 'q3' then make_date(p_annee, 9, 30) when '9m' then make_date(p_annee, 9, 30)
    else make_date(p_annee, 12, 31) end)
$$;

create or replace function public.trg_financials_facteur_actions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.facteur_actions := public.facteur_actions_a(new.ticker, public.date_fin_periode(new.annee, new.periode, new.date_arrete));
  return new;
end;
$$;

drop trigger if exists trg_financials_facteur_actions on public.financials;
create trigger trg_financials_facteur_actions
  before insert or update on public.financials
  for each row execute function public.trg_financials_facteur_actions();

-- Quand les opérations d'une société changent, toutes ses lignes sont recalculées.
create or replace function public.trg_entreprises_recalc_facteur()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.financials set ticker = ticker where ticker = new.ticker;
  return new;
end;
$$;

drop trigger if exists trg_entreprises_recalc_facteur on public.entreprises;
create trigger trg_entreprises_recalc_facteur
  after update of operations_capital on public.entreprises
  for each row when (old.operations_capital is distinct from new.operations_capital)
  execute function public.trg_entreprises_recalc_facteur();

-- Garde-fou : sauts de cours quotidiens >= 25 % sans opération sur titres enregistrée à +/- 7 jours.
-- Un saut de ce type est presque toujours un fractionnement, une attribution gratuite ou un regroupement non saisi.
create or replace view public.v_sauts_cours_sans_operation
with (security_invoker = true) as
select h.ticker, h.date_seance, coalesce(h.cloture, h.cours_cloture) as cloture, h.variation_pct
from public.historique h
where abs(coalesce(h.variation_pct, 0)) >= 25
  and not exists (
    select 1 from public.entreprises e, jsonb_array_elements(coalesce(e.operations_capital, '[]'::jsonb)) o
    where e.ticker = h.ticker
      and abs((o->>'date')::date - h.date_seance) <= 7
  )
order by h.date_seance desc;