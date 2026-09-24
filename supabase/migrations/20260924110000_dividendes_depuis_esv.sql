-- Dividendes : le calendrier du site (dividendes_calendrier) n'était alimenté
-- qu'à la main, alors que les avis BRVM sont récupérés automatiquement dans
-- evenements_valeurs. Au 2026-09-24, 20 dividendes de l'exercice 2025 publiés
-- par la BRVM manquaient au calendrier (BICI, Orange CI, SOLIBRA, SITAB…).
--
-- 1. tc_sync_dividende_esv() : à chaque avis de dividende (insert/update dans
--    evenements_valeurs) d'une société cotée, crée la ligne du calendrier si
--    l'exercice n'y figure pas encore. Jamais de mise à jour d'une ligne
--    existante (saisies manuelles préservées).
-- 2. Montant brut = net publié / (1 - IRVM) ; IRVM = dernier taux connu pour la
--    société dans le calendrier, 12 % à défaut.
-- 3. Rattrapage des avis déjà en base.

create or replace function public.tc_sync_dividende_esv()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  irvm numeric;
begin
  if NEW.categorie <> 'dividende' or NEW.ticker is null or NEW.exercice is null or NEW.montant_net is null then
    return NEW;
  end if;
  if not exists (select 1 from entreprises where ticker = NEW.ticker) then
    return NEW;
  end if;
  if exists (select 1 from dividendes_calendrier
             where ticker = NEW.ticker and coalesce(exercice, annee) = NEW.exercice) then
    return NEW;
  end if;

  select taux_irvm into irvm from dividendes_calendrier
  where ticker = NEW.ticker and taux_irvm is not null
  order by exercice desc limit 1;
  irvm := coalesce(irvm, 12);

  insert into dividendes_calendrier
    (ticker, exercice, annee, montant_net, montant, taux_irvm, date_detachement, ex_date, date_paiement, statut, notes)
  values
    (NEW.ticker, NEW.exercice, NEW.exercice, NEW.montant_net,
     round(NEW.montant_net / (1 - irvm / 100), 2), irvm,
     NEW.date_ex, NEW.date_ex, NEW.date_paiement, 'confirmé',
     'Ajouté automatiquement depuis l''avis BRVM' || coalesce(' n° ' || NEW.avis_numero, '')
       || ' ; brut recalculé (IRVM ' || irvm || ' %).');
  return NEW;
end;
$$;

drop trigger if exists trg_tc_sync_dividende_esv on public.evenements_valeurs;
create trigger trg_tc_sync_dividende_esv
  after insert or update of montant_net, date_paiement, date_ex on public.evenements_valeurs
  for each row execute function public.tc_sync_dividende_esv();

-- Rattrapage : rejoue le déclencheur sur les avis existants.
update public.evenements_valeurs set montant_net = montant_net
where categorie = 'dividende' and ticker is not null and exercice >= 2019;
