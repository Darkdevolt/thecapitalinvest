-- BPA des exercices annuels non publiés = résultat net ÷ nombre d'actions de l'exercice.
-- Nombre d'actions : celui de la ligne s'il est renseigné, sinon celui de la société
-- (entreprises.nombre_actions, base actuelle) ramené à la base de l'époque par
-- facteur_actions (nb brut = nb actuel × facteur ; le BPA brut est ensuite remultiplié
-- par facteur_actions à l'affichage, donc cohérent avec le cours ajusté).
-- Contrôle préalable (25/09/2026) : sur chaque titre, le nombre d'actions connu est
-- identique d'un exercice à l'autre et aucune opération sur le capital n'est enregistrée.
update public.financials f
set bpa = round(f.resultat_net / coalesce(nullif(f.nombre_actions, 0), nullif(f.nb_actions, 0), e.nombre_actions * f.facteur_actions), 2),
    validation_notes = coalesce(f.validation_notes, '') || ' | 2026-09-25 : BPA reconstitué = résultat net ÷ '
      || round(coalesce(nullif(f.nombre_actions, 0), nullif(f.nb_actions, 0), e.nombre_actions * f.facteur_actions)) || ' actions (non publié dans la source).'
from public.entreprises e
where e.ticker = f.ticker
  and f.periode = 'annuel' and f.bpa is null and f.resultat_net is not null
  and coalesce(nullif(f.nombre_actions, 0), nullif(f.nb_actions, 0), e.nombre_actions * f.facteur_actions) > 0;
