-- Historique des états financiers 2020-2025, lot 8 : périodes relues à la main
-- dans des rapports BRVM téléchargés en complément (états de synthèse,
-- communiqués chiffrés). Tractafric S1 2023 : deux versions du rapport
-- divergent sur le résultat, seul le chiffre d'affaires (identique) est repris.
-- Statut 'draft'.
insert into public.financials (ticker,annee,periode,chiffre_affaires,rbe,resultat_exploitation,resultat_activites_ordinaires,resultat_net,total_actif,source,source_url,date_publication,date_arrete,devise,unite,validation_status,statut_audit,validation_notes)
select v.ticker,v.annee::int,v.periode,v.ca::numeric,v.rbe::numeric,v.re::numeric,v.rao::numeric,v.rn::numeric,v.ta::numeric,v.source,
  replace(v.source_url,'~','https://www.brvm.org/sites/default/files/'),v.dp::date,v.da::date,'XOF','FCFA','draft',
  case when v.periode='annuel' then null else 'non_audite' end,
  v.note || ' (source_url) ; relu manuellement le 2026-09-24 ; à valider.'
from (values
('CIEC',2021,'annuel',231783000000,null,15449000000,13456000000,9757000000,1679593000000,'CIE CI : Etats financiers de synthèse exercice 2022 (BRVM)','~etats_financiers_de_synthese_cie.pdf',null,'2021-12-31','Colonne N-1 (comparatif) du rapport de l''exercice suivant'),
('NSBC',2020,'annuel',71400000000,23900000000,null,null,null,1550000000000,'NSIA BANQUE CI : États financiers exercice 2021 (BRVM)','~20220401_-_etats_financiers_exercice_2021_-_nsia_banque_ci.pdf','2022-04-01','2020-12-31','Chiffres cités (arrondis) dans le texte du rapport'),
('ONTBF',2022,'annuel',145625000000,null,35678000000,32610000000,22372000000,null,'ONATEL BURKINA FASO : Résultats financiers au 31 décembre 2022 (BRVM)','~20230428_-_resultats_financiers_au_31_decembre_2022_-_onatel_bf.pdf','2023-04-28','2022-12-31','Chiffre concordant dans deux rapports BRVM'),
('ONTBF',2021,'annuel',154881000000,null,48605000000,45136000000,32374000000,null,'ONATEL BURKINA FASO : Résultats financiers au 31 décembre 2022 (BRVM)','~20230428_-_resultats_financiers_au_31_decembre_2022_-_onatel_bf.pdf','2023-04-28','2021-12-31','Colonne N-1 (comparatif) du rapport de l''exercice suivant'),
('ONTBF',2020,'annuel',157358000000,null,48521000000,43327000000,31052000000,null,'ONATEL SA : Communiqué - Résultats financier exercice 2020 (BRVM)','~20210322_-_communique_-_resultats_exercice_2020_-_onatel-sa.pdf','2021-03-22','2020-12-31','Colonne N du rapport'),
('ORAC',2022,'annuel',965000000000,null,260800000000,249700000000,153500000000,null,'ORANGE CI : Rapport d''activités et Attestation des Commissaires Aux Comptes - 1er Semestre 2023 (BRVM)','~20231030_-_rapport_dactivites_et_attestation_des_cac_-_1er_semestre_2023_-_orange_ci.pdf','2023-10-30','2022-12-31','Colonne exercice précédent du rapport semestriel suivant (comptes consolidés)'),
('SAFC',2023,'annuel',3690000000,null,-422000000,-420000000,-579000000,null,'SAFCA CÔTE D''IVOIRE : Etats financiers - Exercice 2024 (BRVM)','~20250703_-_etats_finaniers_-_exercice_2024_-_safca_ci.pdf','2025-07-03','2023-12-31','Chiffre concordant dans deux rapports BRVM'),
('SPHC',2021,'annuel',208794460641,null,27558059338,25003018391,20750470464,null,'SAPH CI : Etats financiers OHADA exercice 2021 (BRVM)','~20220415_-_etats_financiers_ohada_exercice_2021_-_saph_ci.pdf','2022-04-15','2021-12-31','Colonne N du rapport'),
('SPHC',2020,'annuel',158789037442,null,10954030372,8407172903,7493033989,null,'SAPH CI : Etats financiers OHADA exercice 2021 (BRVM)','~20220415_-_etats_financiers_ohada_exercice_2021_-_saph_ci.pdf','2022-04-15','2020-12-31','Colonne N-1 (comparatif) du rapport de l''exercice suivant'),
('SPHC',2022,'annuel',null,null,null,null,16701000000,null,'SAPH CI : Rapport annuel - Exercice 2023 (BRVM)','~20240718_-_rapport_annuel_-_exercice_2023_-_saph_ci_vf.pdf','2024-07-18','2022-12-31','Chiffre cité dans le texte du rapport'),
('ABJC',2020,'annuel',5707724950,null,-1036799412,-957503739,-985334838,6541501558,'SERVAIR ABIDJAN CÔTE D''IVOIRE : Etats Financiers - Exercice 2020 (BRVM)','~20210426_-_etats_financiers_2020_-_servair_abidjan_ci.pdf','2021-04-26','2020-12-31','Chiffre concordant dans deux rapports BRVM'),
('SNTS',2020,'9M',895000000000,null,null,null,140000000000,null,'SONATEL SN: Résultats financiers - 3ème trimestre 2020 (BRVM)','~20201026-resultats_financiers_-_3eme_trimestre_2020_-_sonatel_sn.pdf',null,'2020-09-30','Chiffres cités (arrondis) dans le texte du rapport'),
('SNTS',2020,'Q1',274100000000,null,null,null,null,null,'SONATEL : Rapport d''activité du 1er trimestre 2020 (BRVM)','~20200430_-_rapport_dactivite_du_1er_trimestre_2020_-_sonatel.pdf','2020-04-30','2020-03-31','Chiffres cités (arrondis) dans le texte du rapport'),
('PRSC',2023,'S1',37254218579,null,null,null,null,null,'TRACTAFRIC MOTORS CÔTE D''IVOIRE : Attestation des Commissaires Aux Comptes sur le Rapport d''activités du 1er semestre 2023 (BRVM)','~20231102_-_attestation_des_cac_sur_le_rapport_dactivites_du_1er_semestre_2023_-_tractafric_motors_ci.pdf','2023-11-02','2023-06-30','Colonne N du rapport'),
('PRSC',2021,'annuel',65019000000,null,4889000000,4564000000,3067000000,36448000000,'TRACTAFRIC MOTORS CI : Etats financiers certifiés et approuvés - Exercice 2022 (BRVM)','~20230803_-_etats_financiers_certifies_et_approuves_-_exercice_2022_-_tractafric_motors_ci.pdf','2023-08-03','2021-12-31','Colonne N-1 (comparatif) du rapport de l''exercice suivant')
) as v(ticker,annee,periode,ca,rbe,re,rao,rn,ta,source,source_url,dp,da,note)
on conflict (ticker,annee,periode) do nothing;
