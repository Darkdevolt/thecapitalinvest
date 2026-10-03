-- Compléments d'états financiers (audit de couverture 2020-2026 du 03/10/2026).
-- Déjà appliqués en base ; idempotent (on conflict do nothing).
-- Lacunes restantes justifiées : BICB 2020 (banque créée en 2020 par fusion),
-- LNBB 2020-2023 (avant l'introduction en bourse), SICC 2025, SEMC 2025,
-- UNLC 2024-2025 (non publiés par les émetteurs au 03/10/2026).
insert into public.financials (ticker, annee, periode, chiffre_affaires, rbe, resultat_exploitation, resultat_net, bpa, dpa, fonds_propres, total_actif, nombre_actions, source, source_url, validation_status, validation_notes) values
('SGBC', 2022, 'annuel', 215101000000, null, null, 74612000000, 2398.25, 1230, null, null, 31111110,
 'Société Générale Côte d''Ivoire : communiqué résultats annuels 2022',
 'https://african-markets.com/fr/bourse/brvm/la-banque-societe-generale-cote-d-ivoire-realise-un-resultat-net-record-de-plus-de-74-milliards-fcfa-en-2022',
 'review', 'PNB en chiffre d''affaires ; BPA = résultat net / 31 111 110 actions ; dividende proposé à l''AG.'),
('ETIT', 2020, 'annuel', 949707000000, null, null, 54064000000, 0.187, null, 1075055000000, 13713596000000, null,
 'ETI TOGO : États financiers exercice 2020 (BRVM)',
 'https://www.brvm.org/sites/default/files/20210129_-_etats_financiers_exercice_2020_-_eti_tg.pdf',
 'review', 'Chiffres clés en millions FCFA publiés par ETI ; PNB en chiffre d''affaires ; résultat net consolidé.'),
('SEMC', 2024, 'annuel', 23200000000, null, null, 45000000, null, null, null, null, null,
 'Crown Siem CI : chiffres clés 2024 (Sika Finance, millions FCFA)',
 'https://www.sikafinance.com/marches/societe/SEMC.ci',
 'review', 'États financiers 2024 non publiés sur brvm.org au 03/10/2026 ; montants arrondis au million.'),
('ECOC', 2026, 'S1', 64078000000, null, null, 26408000000, null, null, null, 2077936000000, null,
 'ECOBANK CI : Rapport d''activités - 1er semestre 2026 (BRVM)',
 'https://www.brvm.org/sites/default/files/20260909_-_rapport_dactivites_-_1er_semestre_2026_-_ecobank_ci.pdf',
 'review', 'PNB en chiffre d''affaires ; montants publiés en millions FCFA.'),
('ONTBF', 2026, 'S1', 75948000000, null, 11883000000, 7082000000, null, null, null, null, null,
 'ONATEL : Rapport d''activités et attestation des CAC - 1er semestre 2026 (BRVM)',
 'https://www.brvm.org/sites/default/files/20261001_-_rapport_dactivites_et_attestation_des_commissaires_aux_comptes_-_1er_semestre_2026_-_onatel_bf.pdf',
 'review', 'Données OHADA, millions FCFA (communiqué du 29/09/2026).'),
('SGBC', 2026, 'S1', 134059000000, 84922000000, null, 53350000000, null, null, 548463000000, 4054459000000, 31111110,
 'SOCIETE GENERALE CI : Rapport d''activités - 1er semestre 2026 (BRVM)',
 'https://www.brvm.org/sites/default/files/20260831_-_rapport_dactivites_-_1er_semestre_2026_-_societe_generale_ci.pdf',
 'review', 'PNB en chiffre d''affaires ; millions FCFA ; capitaux propres et ressources assimilées.'),
('SGBC', 2026, 'Q1', 65644000000, 38998000000, null, 23976000000, null, null, null, null, 31111110,
 'SOCIETE GENERALE CI : Rapport d''activités - 1er trimestre 2026 (BRVM)',
 'https://www.brvm.org/sites/default/files/20260430_-_rapport_dactivites_-_1er_trimestre_2026_-_societe_generale_ci.pdf',
 'review', 'PNB en chiffre d''affaires ; RBE = PNB - frais généraux (65 644 - 26 646) ; données non auditées, millions FCFA.')
on conflict (ticker, annee, periode) do nothing;

insert into public.financials (ticker, annee, periode, chiffre_affaires, resultat_net, bpa, fonds_propres, total_actif, source, source_url, validation_status, validation_notes) values
('ORAC', 2020, 'annuel', 871393000000, 122208000000, 811.17, 588975000000, 1617427000000,
 'ORANGE CI : Note d''information de l''OPV 2022, comptes consolidés IFRS (colonne 2020)',
 'https://groupe.orange.ci/site-institutionnel/resources/other/note-d-informationoOpv-orange-ci-2022.pdf',
 'review', 'Millions FCFA ; capitaux propres part du Groupe (hors minoritaires 57 209) ; BPA sur la même base d''actions que 2021 ; exercice antérieur à la cotation (30/12/2022).')
on conflict (ticker, annee, periode) do nothing;
