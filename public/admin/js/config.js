const SK      = 'tc_session';
const SB_URL  = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
const SB_REST = SB_URL + '/rest/v1';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90c2l3aXdsbm93eGVvbGJiZ3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjgwODIsImV4cCI6MjA4MjIwNDA4Mn0.bIWFJZAm0acmc5Ogk2M-DjPafQCDN0vRE9Y5owma-LY';

const INDICES_BRV = ['BRVM10','BRVM COMPOSITE','BRVM PRESTIGE','BRVM TRANSPORT','BRVM FINANCE','BRVM DISTRIBUTION','BRVM INDUSTRIE','BRVM AGRICULTURE','BRVM SERVICES PUBLICS','BRVM AUTRES SECTEURS'];

const TEMPLATE_SYNONYMS = {
    'date': ['date_seance','date_detachement','date_paiement','date_introduction','date_entree','date_analyse'],
    'code': ['indice','ticker','isin'],
    'valeur': ['valeur','cours','montant','capitalisation'],
    'volume': ['volume'],
    'nom': ['nom','nom_complet','nom_actionnaire'],
    'variation': ['variation','variation_pct'],
    'pays': ['pays','pays_origine'],
    'annee': ['annee','year'],
    'montant': ['montant','valeur','dividende']
};

const TEMPLATE_CONFIG = {
    entreprises: {
        name: 'BRVM_Entreprises',
        headers: ['ticker','nom','nom_complet','pays','secteur','compartiment','capital_social_fcfa','nombre_actions','valeur_nominale','isin','description','site_web','date_introduction','siege_social','actif'],
        required: ['ticker','nom','pays','secteur','compartiment'],
        table: 'entreprises', uniqueKey: 'ticker'
    },
    cours: {
        name: 'BRVM_Cours',
        headers: ['ticker','date_seance','cours','ouverture','plus_haut','plus_bas','volume','capitalisation','plus_haut_52','plus_bas_52'],
        required: ['ticker','date_seance','cours'],
        table: 'cours', uniqueKey: 'ticker,date_seance', autoCalc: ['variation']
    },
    financials: {
        name: 'BRVM_Financials',
        headers: ['ticker','annee','periode','chiffre_affaires','rbe','resultat_net','bpa','dpa','fonds_propres','dettes_financieres','total_actif','nombre_actions','cash_flow_operationnel','capex','source'],
        required: ['ticker','annee'],
        table: 'financials', uniqueKey: 'ticker,annee,periode', autoCalc: ['roe','roa','marge_rbe']
    },
    dividendes: {
        name: 'BRVM_Dividendes',
        headers: ['ticker','annee','montant','taux_rendement','date_detachement','date_paiement','statut','exercice','notes'],
        required: ['ticker','annee','montant'],
        table: 'dividendes_calendrier', uniqueKey: 'ticker,annee', autoCalc: ['taux_rendement']
    },
    indices: {
        name: 'BRVM_Indices',
        headers: ['indice','date_seance','valeur','variation','variation_pct'],
        required: ['indice','date_seance','valeur'],
        table: 'indices', uniqueKey: 'indice,date_seance'
    },
    actionnaires: {
        name: 'BRVM_Actionnaires',
        headers: ['ticker','nom_actionnaire','pourcentage','type_actionnaire','pays_origine'],
        required: ['ticker','nom_actionnaire','pourcentage'], table: 'actionnaires', uniqueKey: null
    }
};
