-- Historique des états financiers 2020-2025, lot 10 : 3 dernières périodes lues
-- directement sur l'image des documents (SITAB 2022, CIE 2020, Bernabé S1 2023).
-- Statut 'draft'.
insert into public.financials (ticker,annee,periode,chiffre_affaires,rbe,resultat_exploitation,resultat_activites_ordinaires,resultat_net,total_actif,source,source_url,date_publication,date_arrete,devise,unite,validation_status,statut_audit,validation_notes)
select v.ticker,v.annee::int,v.periode,v.ca::numeric,v.rbe::numeric,v.re::numeric,v.rao::numeric,v.rn::numeric,v.ta::numeric,v.source,
  replace(v.source_url,'~','https://www.brvm.org/sites/default/files/'),v.dp::date,v.da::date,'XOF','FCFA','draft',
  case when v.periode='annuel' then null else 'non_audite' end,
  v.note || ' (source_url) ; lu sur l''image du document le 2026-09-24 ; à valider.'
from (values
('STBC',2022,'annuel',151133280425,12907224132,12768812060,14828925064,11503188097,31612312100,'SITAB : Etats financiers SYSCOHADA exercice 2022 (BRVM)','~20230614_-_etats_financiers_syscohada_exercice_2022_-_sitab_ci.pdf','2023-06-14','2022-12-31','Colonne N du rapport ; CA = ventes de marchandises + travaux + produits accessoires'),
('CIEC',2020,'annuel',722628000000,43255000000,22771000000,20735000000,16170000000,1237732000000,'CIE CI : Etats financiers exercice 2020 (BRVM)','~20210604_-_etats_financiers_exercice_2020_-_cie_ci.pdf','2021-06-04','2020-12-31','Colonne N du rapport ; en 2020 le chiffre d''affaires SYSCOHADA inclut la vente d''énergie (périmètre modifié à partir de 2021)'),
('BNBC',2023,'S1',23343110837,null,605153666,375619437,295670970,null,'BERNABE CI : Rapport d''activités - 1er semestre 2024 (BRVM)','~20241120_-_rapport_dactivites_-_1er_semestre_2024_-_bernabe_ci.pdf','2024-11-20','2023-06-30','Colonne N-1 (comparatif) du rapport de l''exercice suivant')
) as v(ticker,annee,periode,ca,rbe,re,rao,rn,ta,source,source_url,dp,da,note)
on conflict (ticker,annee,periode) do nothing;
