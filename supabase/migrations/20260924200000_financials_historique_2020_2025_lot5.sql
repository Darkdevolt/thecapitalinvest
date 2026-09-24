-- Historique des états financiers 2020-2025, lot 5 : 16 périodes sans colonne de
-- variation, retenues seulement quand le même chiffre figure dans deux rapports
-- distincts (N du rapport de l'exercice = N-1 du rapport suivant, écart < 0,5 %).
-- Relecture manuelle le 2026-09-24 (Vivo T1 2025 écarté : chiffres annuels).
insert into public.financials (ticker,annee,periode,chiffre_affaires,rbe,resultat_exploitation,resultat_activites_ordinaires,resultat_net,total_actif,source,source_url,date_publication,date_arrete,devise,unite,validation_status,statut_audit,validation_notes)
select v.ticker,v.annee::int,v.periode,v.ca::numeric,v.rbe::numeric,v.re::numeric,v.rao::numeric,v.rn::numeric,v.ta::numeric,v.source,
  replace(v.source_url,'~','https://www.brvm.org/sites/default/files/'),v.dp::date,v.da::date,'XOF','FCFA','draft',
  case when v.periode='annuel' then null else 'non_audite' end,
  'Chiffres confirmés par deux rapports BRVM distincts (colonne N du rapport de l''exercice et colonne N-1 du rapport suivant, écart < 0,5 %) ; source_url ; relu le 2026-09-24 ; à valider.'
from (values
('CABC',2021,'annuel',19036863791,null,628129534,null,null,null,'SICABLE CI : États financiers exercice 2021 (BRVM)','~20220322_-_etats_financiers_exercice_2021_-_sicable_ci.pdf','2022-03-22','2021-12-31'),
('CIEC',2024,'annuel',264472000000,null,null,null,10555000000,1482881000000,'CIE SODE CÔTE D''IVOIRE : Etats financiers - Norme SYSCOHADA (BRVM)','~20250430_-_etats_financiers_-_norme_syscohada_-_exercice_2024_-_cie_ci.pdf','2025-04-30','2024-12-31'),
('NEIC',2020,'S1',null,null,null,null,-401453673,null,'NEI-CEDA CI : Rapport d''activités au 1er semestre 2020 (BRVM)','~20201030_-_rapport_dactivites_du_1er_semestre_2020_-_nei-ceda_ci.pdf','2020-10-30','2020-06-30'),
('NEIC',2023,'Q1',92677733,null,null,null,null,null,'NEI-CEDA CI : Rapport d''activité - 1er trimestre 2023 (BRVM)','~20230512_-_rapport_dactivite_-_1er_trimestre_2023_-_nei-ceda_ci_1.pdf','2023-05-12','2023-03-31'),
('NEIC',2024,'Q1',105827562,null,null,null,-94719306,null,'NEI CEDA CI : Rapport d''activités - 1er trimestre 2024 (BRVM)','~20241015_-_rapport_dactivites_-_1er_trimestre_2024_-_nei_ceda_ci.pdf','2024-10-15','2024-03-31'),
('NEIC',2025,'Q1',48534243,null,null,null,null,null,'NEI CEDA CÔTE D''IVOIRE : Rapport d''activités du 1er trimestre 2025 (BRVM)','~20250509_-_rapport_dactivites_-_1er_trimestre_2025_-_nei_ceda_ci.pdf','2025-05-09','2025-03-31'),
('SLBC',2020,'annuel',229359000000,null,null,null,17520000000,null,'SOLIBRA CÔTE D''IVOIRE : Etats Financiers - Exercice 2020 (BRVM)','~20210504_-_etats_financiers_-_exercice_2020_-_solibra_ci.pdf','2021-05-04','2020-12-31'),
('SLBC',2021,'annuel',299269000000,null,null,null,22020000000,null,'SOLIBRA CI : Etats financiers Exercice 2021 (BRVM)','~20220603_-_etats_financiers_exercice_2021_-_solibra.pdf','2022-06-03','2021-12-31'),
('SLBC',2022,'annuel',281880000000,null,null,null,1217000000,null,'SOLIBRA CI : Etats financiers exercice 2022 (BRVM)','~20230512_-_etats_financiers_exercice_2022_-_solibra_ci.pdf','2023-05-12','2022-12-31'),
('SMBC',2020,'9M',null,null,null,8547511365,5958511435,null,'SMB CI : Rapport d''activités du 3ème trimestre 2020 (BRVM)','~20201016_-_rapport_activite_3eme_trimestre_2020_-_smb_ci.pdf','2020-10-16','2020-09-30'),
('SMBC',2020,'Q1',null,null,null,2294927353,1729362767,null,'SMB CI : Rapport d''activité du 1er trimestre 2020 (BRVM)','~20200429_-_rapport_dactivite_du_1er_trimestre_2020_-_smb_ci.pdf','2020-04-29','2020-03-31'),
('SMBC',2021,'S1',null,null,6651000000,6370000000,4178000000,null,'SMB CÔTE D''IVOIRE : Rapport d''activités au 1er semestre 2021 (BRVM)','~20210902_-_rapport_dactivites_au_1er_semestre_2021_-_smb_ci.pdf','2021-09-02','2021-06-30'),
('SMBC',2024,'annuel',229061000000,null,null,null,null,null,'SMB CÔTE D''IVOIRE : Etats financiers - Exercice 2024 (BRVM)','~20250903_-_etats_financiers_-_exercice_2024_-_smb_ci.pdf','2025-09-03','2024-12-31'),
('UNLC',2020,'Q1',null,null,259804000,null,61253000,null,'UNILEVER CI : Rapport d''activité du 1er trimestre 2020 (BRVM)','~20200504_-_rapport_dactivite_du_1er_trimestre_2020_-_unilever_ci.pdf','2020-05-04','2020-03-31'),
('UNXC',2020,'annuel',34916710441,null,null,null,null,32704361831,'UNIWAX CÔTE D''IVOIRE : Etats Financiers - Exercice 2020 (BRVM)','~20210504_-_etats_financiers_-_exercice_2020_-_uniwax_ci.pdf','2021-05-04','2020-12-31'),
('UNXC',2021,'annuel',38191193639,null,null,null,1400692889,37292681535,'UNIWAX CI : Etats Financiers certifiés exercice 2021 (BRVM)','~20220613_-_etats_financiers_certifies_exercice_2021_-_uniwax_ci.pdf','2022-06-13','2021-12-31')
) as v(ticker,annee,periode,ca,rbe,re,rao,rn,ta,source,source_url,dp,da)
on conflict (ticker,annee,periode) do nothing;
