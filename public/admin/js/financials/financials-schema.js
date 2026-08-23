/* ============================================================
   THE CAPITAL — DICTIONNAIRE DES POSTES FINANCIERS
   Source unique du formulaire de saisie, du modèle Excel et de
   l'affichage. Ce fichier était référencé par admin.html sans
   exister : le contrôle des références statiques échouait au
   déploiement et la section Financials restait muette.

   Chaque poste porte le nom de la colonne Supabase, le libellé
   affiché, la référence SYSCOHADA lorsqu'elle existe, et la règle
   de contrôle appliquée avant écriture.
   ============================================================ */
'use strict';

(function (TC) {

    /**
     * signe :
     *   'positif'  — la valeur ne peut pas être négative
     *   'libre'    — une valeur négative est un résultat possible (perte)
     *   'entier'   — nombre entier strictement positif
     */
    const POSTES = [
        /* ── Compte de résultat ── */
        { col: 'chiffre_affaires', label: "Chiffre d'affaires", groupe: 'resultat', ref: 'TA', signe: 'positif', aide: 'Ventes de marchandises, de produits et de services, nettes de remises.' },
        { col: 'rbe', label: 'Résultat brut d\'exploitation', groupe: 'resultat', ref: 'XD', signe: 'libre', aide: 'Excédent brut d\'exploitation avant dotations aux amortissements.' },
        { col: 'resultat_exploitation', label: "Résultat d'exploitation", groupe: 'resultat', ref: 'XE', signe: 'libre' },
        { col: 'ebitda', label: 'EBITDA', groupe: 'resultat', signe: 'libre', aide: 'Renseignez si le rapport le publie sous cette forme ; sinon, laissez vide.' },
        { col: 'ebit', label: 'EBIT', groupe: 'resultat', signe: 'libre' },
        { col: 'resultat_net', label: 'Résultat net', groupe: 'resultat', ref: 'XI', signe: 'libre', aide: 'Résultat net de l\'exercice, part du groupe.' },

        /* ── Bilan ── */
        { col: 'total_actif', label: 'Total actif', groupe: 'bilan', ref: 'BZ', signe: 'positif' },
        { col: 'fonds_propres', label: 'Capitaux propres', groupe: 'bilan', ref: 'CP', signe: 'libre', aide: 'Une valeur négative signale des capitaux propres consommés : elle est acceptée mais signalée.' },
        { col: 'dettes_financieres', label: 'Dettes financières', groupe: 'bilan', ref: 'DD', signe: 'positif' },
        { col: 'dette_nette', label: 'Dette nette', groupe: 'bilan', signe: 'libre', aide: 'Dettes financières diminuées de la trésorerie. Négative en situation de trésorerie nette.' },

        /* ── Flux ── */
        { col: 'cash_flow_operationnel', label: "Flux de trésorerie d'exploitation", groupe: 'flux', ref: 'ZB', signe: 'libre' },
        { col: 'capex', label: 'Investissements (CAPEX)', groupe: 'flux', signe: 'positif' },

        /* ── Données par action ── */
        { col: 'nombre_actions', label: 'Nombre d\'actions', groupe: 'action', signe: 'entier', aide: 'Repris du référentiel si la fiche société le renseigne.' },
        { col: 'bpa', label: 'Bénéfice par action', groupe: 'action', signe: 'libre', aide: 'Calculé automatiquement si le résultat net et le nombre d\'actions sont renseignés.' },
        { col: 'dpa', label: 'Dividende par action', groupe: 'action', signe: 'positif' },

        /* ── Ratios dérivés, calculés et non saisis ── */
        { col: 'roe', label: 'Rentabilité des capitaux propres', groupe: 'ratio', calcule: true, unite: '%' },
        { col: 'roa', label: 'Rentabilité de l\'actif', groupe: 'ratio', calcule: true, unite: '%' },
        { col: 'marge_nette', label: 'Marge nette', groupe: 'ratio', calcule: true, unite: '%' },
        { col: 'payout_ratio', label: 'Taux de distribution', groupe: 'ratio', calcule: true, unite: '%' }
    ];

    const GROUPES = [
        { id: 'resultat', label: 'Compte de résultat' },
        { id: 'bilan', label: 'Bilan' },
        { id: 'flux', label: 'Tableau des flux' },
        { id: 'action', label: 'Données par action' },
        { id: 'ratio', label: 'Ratios calculés' }
    ];

    /** Postes réellement saisis par l'administrateur. */
    const saisis = () => POSTES.filter(p => !p.calcule);

    /**
     * Ratios déduits des postes saisis. Ils ne sont jamais demandés :
     * un ratio saisi à la main et un ratio recalculé finissent toujours par
     * diverger, et c'est le ratio qui s'affiche dans l'application.
     */
    function ratios(row) {
        const n = v => TC.toNumber(v);
        const ca = n(row.chiffre_affaires), rn = n(row.resultat_net),
            fp = n(row.fonds_propres), ta = n(row.total_actif),
            bpa = n(row.bpa), dpa = n(row.dpa),
            actions = n(row.nombre_actions || row.nb_actions);

        const out = {};
        if (rn !== null && fp !== null && fp > 0) out.roe = Math.round((rn / fp) * 10000) / 100;
        if (rn !== null && ta !== null && ta > 0) out.roa = Math.round((rn / ta) * 10000) / 100;
        if (rn !== null && ca !== null && ca > 0) out.marge_nette = Math.round((rn / ca) * 10000) / 100;
        if (dpa !== null && bpa !== null && bpa > 0) out.payout_ratio = Math.round((dpa / bpa) * 10000) / 100;
        else if (dpa !== null && rn !== null && actions && rn > 0) {
            out.payout_ratio = Math.round(((dpa * actions) / rn) * 10000) / 100;
        }
        return out;
    }

    /** Bénéfice par action déduit, quand il n'est pas fourni. */
    function bpaFrom(row) {
        const rn = TC.toNumber(row.resultat_net);
        const actions = TC.toNumber(row.nombre_actions || row.nb_actions);
        if (rn === null || !actions || actions <= 0) return null;
        return Math.round((rn / actions) * 100) / 100;
    }

    /**
     * Contrôles de cohérence comptable. Ils ne bloquent pas l'écriture par
     * eux-mêmes : c'est le module Financials qui décide, en distinguant
     * l'erreur de saisie de la situation comptable réelle mais inhabituelle.
     */
    function audit(row) {
        const issues = [];
        const n = v => TC.toNumber(v);
        const annee = parseInt(row.annee, 10);
        const currentYear = new Date().getFullYear();

        if (!row.ticker) issues.push({ level: 'err', text: 'ticker manquant' });
        if (!Number.isInteger(annee) || annee < 1990 || annee > currentYear + 1) {
            issues.push({ level: 'err', text: 'exercice invalide' });
        }

        saisis().forEach(function (p) {
            const value = n(row[p.col]);
            if (value === null) return;
            if (p.signe === 'positif' && value < 0) issues.push({ level: 'err', text: p.label.toLowerCase() + ' négatif' });
            if (p.signe === 'entier' && (!Number.isFinite(value) || value <= 0)) {
                issues.push({ level: 'err', text: p.label.toLowerCase() + ' non valide' });
            }
        });

        const ca = n(row.chiffre_affaires), rn = n(row.resultat_net),
            rbe = n(row.rbe), fp = n(row.fonds_propres), ta = n(row.total_actif),
            dettes = n(row.dettes_financieres), bpa = n(row.bpa), dpa = n(row.dpa);

        if (ca !== null && rn !== null && ca > 0 && rn > ca) {
            issues.push({ level: 'warn', text: 'résultat net supérieur au chiffre d\'affaires' });
        }
        if (ca !== null && rbe !== null && ca > 0 && rbe > ca) {
            issues.push({ level: 'warn', text: 'RBE supérieur au chiffre d\'affaires' });
        }
        if (fp !== null && ta !== null && ta > 0 && fp > ta) {
            issues.push({ level: 'err', text: 'capitaux propres supérieurs au total actif' });
        }
        if (dettes !== null && ta !== null && ta > 0 && dettes > ta) {
            issues.push({ level: 'warn', text: 'dettes financières supérieures au total actif' });
        }
        if (fp !== null && fp < 0) issues.push({ level: 'warn', text: 'capitaux propres négatifs' });
        if (dpa !== null && bpa !== null && bpa > 0 && dpa > bpa * 1.5) {
            issues.push({ level: 'warn', text: 'dividende très supérieur au bénéfice par action' });
        }

        const computed = bpaFrom(row);
        if (computed !== null && bpa !== null && Math.abs(computed) > 0 &&
            Math.abs((bpa - computed) / Math.abs(computed)) > 0.1) {
            issues.push({ level: 'warn', text: 'BPA publié ≠ résultat net / nombre d\'actions' });
        }

        if (!row.source) issues.push({ level: 'warn', text: 'source non renseignée' });
        if (row.source_url && !/^https?:\/\//i.test(String(row.source_url))) {
            issues.push({ level: 'err', text: 'URL de source invalide' });
        }
        return issues;
    }

    TC.FIN = {
        POSTES, GROUPES, saisis, ratios, bpaFrom, audit,
        /** Colonnes du modèle Excel, dans l'ordre de saisie. */
        excelHeaders() {
            return ['ticker', 'annee', 'periode'].concat(saisis().map(p => p.col)).concat(['source', 'source_url', 'source_page']);
        },
        label(col) {
            const found = POSTES.find(p => p.col === col);
            return found ? found.label : col;
        }
    };

})(window.TC);
