-- Historique des états financiers 2020-2025, lot 9 : 6 dernières périodes lues
-- (OCR relu à la main) : Ecobank CI S1 2024/2025, NEI-CEDA 2020/2021/2024,
-- Vivo Energy T1 2025 (chiffre d'affaires). Statut 'draft'.
insert into public.financials (ticker,annee,periode,chiffre_affaires,rbe,resultat_exploitation,resultat_activites_ordinaires,resultat_net,total_actif,source,source_url,date_publication,date_arrete,devise,unite,validation_status,statut_audit,validation_notes)
select v.ticker,v.annee::int,v.periode,v.ca::numeric,v.rbe::numeric,v.re::numeric,v.rao::numeric,v.rn::numeric,v.ta::numeric,v.source,
  replace(v.source_url,'~','https://www.brvm.org/sites/default/files/'),v.dp::date,v.da::date,'XOF','FCFA','draft',
  case when v.periode='annuel' then null else 'non_audite' end,
  v.note || ' (source_url) ; lecture OCR relue manuellement le 2026-09-24 ; à valider.'
from (values
('ECOC',2025,'S1',62842000000,null,null,33979000000,28904000000,1901180000000,'ECOBANK CÔTE D''IVOIRE : Rapport d''activités - 1er semestre 2025 (BRVM)','~20250902_-_rapport_dactivites_-_1er_semestre_2025_-_ecobank_ci.pdf','2025-09-02','2025-06-30','Colonne N du rapport'),
('ECOC',2024,'S1',58785000000,null,null,30647000000,25394000000,1854163000000,'ECOBANK CÔTE D''IVOIRE : Rapport d''activités - 1er semestre 2025 (BRVM)','~20250902_-_rapport_dactivites_-_1er_semestre_2025_-_ecobank_ci.pdf','2025-09-02','2024-06-30','Colonne N-1 (comparatif) du rapport de l''exercice suivant'),
('NEIC',2024,'annuel',6744255774,null,603453112,714921778,-759371358,null,'NEI-CEDA MOTORS CÔTE D''IVOIRE : Etats financiers approuvés - Exercice 2024 (BRVM)','~20250613_-_etats_financiers_approuves_-_exercice_2024_-_nei-ceda_ci.pdf','2025-06-13','2024-12-31','Colonne N du rapport'),
('NEIC',2021,'annuel',8874246101,null,1787649834,1895685498,980247893,null,'NEI-CEDA : Etats financiers exercice 2021 (BRVM)','~20220429_-_etats_financiers_exercice_2021_-_nei-ceda_ci.pdf','2022-04-29','2021-12-31','Colonne N du rapport'),
('NEIC',2020,'annuel',7301216273,null,1365392841,1454565770,800792587,null,'NEI-CEDA CÔTE D''IVOIRE : Etats Financiers - Exercice 2020 (BRVM)','~20210517_-_etats_financiers_-_exercice_2020_-_nei-ceda_ci.pdf','2021-05-17','2020-12-31','Chiffre concordant dans deux rapports BRVM'),
('SHEC',2025,'Q1',155873000000,null,null,null,null,null,'VIVO ENERGY CÔTE D''IVOIRE : Rapport d''activités du 1er trimestre 2025 (BRVM)','~20250516_-_etats_financiers_2024_et_rapport_dactivites_du_1er_trimestre_2025_-_vivo_energy_ci_1.pdf','2025-05-16','2025-03-31','Chiffre cité dans le texte du rapport')
) as v(ticker,annee,periode,ca,rbe,re,rao,rn,ta,source,source_url,dp,da,note)
on conflict (ticker,annee,periode) do nothing;
