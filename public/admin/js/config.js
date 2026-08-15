const SK      = 'tc_session';
const SB_URL  = 'https://otsiwiwlnowxeolbbgvm.supabase.co';
// Use the active Supabase publishable key. Do not use service_role in browser code.
const SB_ANON = 'sb_publishable_MhaI5b-kMmb5liIMOJ4P3Q_xGTsJAFJ';
const SB_REST = SB_URL + '/rest/v1';

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
        headers: ['ticker','date_seance','cours_cloture','cours_ouverture','plus_haut','plus_bas','volume','variation','valeur_totale','plus_haut_52','plus_bas_52'],
        required: ['ticker','date_seance','cours_cloture'],
        table: 'historique',
        uniqueKey: 'ticker,date_seance',
        autoCalc: ['variation'],
        fieldMap: {
            'ticker': ['ticker','code','symbol','isin','code_valeur'],
            'date_seance': ['date_seance','date'],
            'cours_cloture': ['cours','cloture','cours_cloture'],
            'cours_ouverture': ['ouverture','cours_ouverture','ouv'],
            'plus_haut': ['plus_haut','haut','high'],
            'plus_bas': ['plus_bas','bas','low'],
            'volume': ['volume','vol','quantite'],
            'variation': ['variation','var','pct','variation_pct'],
            'valeur_totale': ['capitalisation','valeur_totale','capi','cap'],
            'plus_haut_52': ['plus_haut_52','haut_52','high_52'],
            'plus_bas_52': ['plus_bas_52','bas_52','low_52']
        }
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
        table: 'dividendes_calendrier', uniqueKey: 'ticker,exercice', autoCalc: ['taux_rendement']
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

(function adminUXHardening(){
    function inject(){
        if(document.getElementById('tc-admin-ux-hardening')) return;
        var style=document.createElement('style'); style.id='tc-admin-ux-hardening';
        style.textContent=`.form-grid{grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px 14px;align-items:start}.form-grid .field{min-width:0;width:100%}.form-grid .field label{line-height:1.35;min-height:28px;display:flex;align-items:flex-start;flex-wrap:wrap;gap:4px}.form-grid .field input,.form-grid .field select,.form-grid .field textarea{min-width:0;max-width:100%;width:100%;box-sizing:border-box}.form-grid .field input[type=number]{font-family:var(--mono)}.actions-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 18px 18px;min-height:42px}.actions-row .msg{min-width:0;flex:1 1 220px;line-height:1.4}.card-header{flex-wrap:wrap}.card-header>div:last-child{min-width:0;max-width:100%}.tw{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.tw table{min-width:max-content}.info-box{line-height:1.55}.sub-tabs{align-items:center}.admin-nav{scrollbar-width:thin}@media(max-width:900px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.main{padding-left:16px;padding-right:16px}}@media(max-width:600px){.form-grid{grid-template-columns:1fr;gap:12px}.form-grid .field label{min-height:0}.actions-row{padding-left:14px;padding-right:14px}.btn{max-width:100%}.topbar{padding-left:14px;padding-right:14px}.topbar-user{display:none}}`;
        document.head.appendChild(style);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject); else inject();
})();

(function loadDashboardOverviewModule(){
    function load(){if(document.getElementById('tc-dashboard-overview-script')) return;var s=document.createElement('script');s.id='tc-dashboard-overview-script';s.src='js/dashboard-overview.js';s.defer=true;s.onerror=function(){console.warn('[dashboard] module indisponible');};document.head.appendChild(s);}
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(load,0);}); else setTimeout(load,0);
})();

(function loadCourseControlEditorModule(){
    function load(){if(document.getElementById('tc-course-control-editor-script'))return;var s=document.createElement('script');s.id='tc-course-control-editor-script';s.src='js/cours-control-editor.js?v=20260815';s.defer=true;s.onerror=function(){console.warn('[cours-control] éditeur indisponible');};document.head.appendChild(s)}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(load,0)});else setTimeout(load,0)
})();

(function loadHistoriqueSessionDeleteModule(){
    function load(){
        if(document.getElementById('tc-historique-session-delete-script')) return;
        var s=document.createElement('script');
        s.id='tc-historique-session-delete-script';
        s.src='js/historique-session-delete.js?v=20260815-1443';
        s.defer=true;
        s.onerror=function(){console.warn('[hist-session] module indisponible');};
        document.head.appendChild(s);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(load,0);});
    else setTimeout(load,0);
})();

(function loadCoursHistoryEntryDeleteModule(){
    function load(){
        if(document.getElementById('tc-cours-history-entry-delete-script')) return;
        var s=document.createElement('script');
        s.id='tc-cours-history-entry-delete-script';
        s.src='js/cours-history-entry-delete.js?v=20260815-1458';
        s.defer=true;
        s.onerror=function(){console.warn('[cours-history-delete] module indisponible');};
        document.head.appendChild(s);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(load,0);});
    else setTimeout(load,0);
})();
