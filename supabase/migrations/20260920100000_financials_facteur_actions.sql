-- Facteur d'ajustement des actions (attributions gratuites, fractionnements).
-- Multiplicateur qui ramène le BPA et le DPA d'une ligne, et son nombre d'actions (diviseur),
-- à la base d'actions ACTUELLE : BOAB avant l'attribution gratuite 1 pour 1 de septembre 2024 = 0,5.
-- Les valeurs publiées restent en base telles quelles (cours historiques bruts, PER d'époque exact) ;
-- l'application les retraite à l'affichage et garde les valeurs brutes dans bpa_brut / dpa_brut /
-- nombre_actions_brut. Défaut 1 = aucune opération postérieure.
alter table public.financials
  add column if not exists facteur_actions numeric not null default 1;

alter table public.financials
  drop constraint if exists financials_facteur_actions_positif;
alter table public.financials
  add constraint financials_facteur_actions_positif check (facteur_actions > 0);

comment on column public.financials.facteur_actions is
  'Multiplicateur BPA/DPA (et diviseur du nombre d''actions) vers la base d''actions actuelle ; 1 = aucune opération postérieure, 0,5 = attribution gratuite 1 pour 1 postérieure.';