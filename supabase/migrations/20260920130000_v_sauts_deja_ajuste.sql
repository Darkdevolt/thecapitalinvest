-- La vue de contrôle tient aussi compte de deja_ajuste_avant : un saut daté d'une date « déjà ajustée » est expliqué.
create or replace view public.v_sauts_cours_sans_operation
with (security_invoker = true) as
select h.ticker, h.date_seance, coalesce(h.cloture, h.cours_cloture) as cloture, h.variation_pct
from public.historique h
where abs(coalesce(h.variation_pct, 0)) >= 25
  and not exists (
    select 1 from public.entreprises e, jsonb_array_elements(coalesce(e.operations_capital, '[]'::jsonb)) o
    where e.ticker = h.ticker
      and (abs((o->>'date')::date - h.date_seance) <= 7
        or (o->>'deja_ajuste_avant' is not null and abs((o->>'deja_ajuste_avant')::date - h.date_seance) <= 7))
  )
order by h.date_seance desc;