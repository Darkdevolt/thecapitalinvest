-- Opérations sur le capital modifiant le nombre d'actions (attributions gratuites, fractionnements).
-- Liste d'objets {date, ratio, type, note} : date = première séance ex-droit, ratio = multiplicateur du
-- nombre d'actions (2 = une action nouvelle pour une ancienne). Sert à ajuster les COURS antérieurs
-- (cours * 1/ratio) ; l'ajustement du BPA/DPA passe par financials.facteur_actions.
alter table public.entreprises
  add column if not exists operations_capital jsonb not null default '[]'::jsonb;

comment on column public.entreprises.operations_capital is
  'Opérations sur le nombre d''actions : [{"date":"AAAA-MM-JJ" (1re séance ex-droit),"ratio":2,"type":"attribution_gratuite","note":"..."}]. Cours antérieurs à la date × 1/ratio.';

update public.entreprises
set operations_capital = '[{"date":"2024-09-03","ratio":2,"type":"attribution_gratuite","note":"1 action nouvelle pour 1 ancienne, AGE du 20/08/2024, incorporation de réserves et primes, jouissance au 01/01/2024 ; capital 20 280 524 000 -> 40 561 048 000 F, nominal 1 000 F"}]'::jsonb
where ticker = 'BOAB';