/**
 * Configuration publique unique du client.
 *
 * Motif : quatre pages déclaraient chacune leur propre couple URL / clé, et deux
 * clés distinctes coexistaient — la clé « publishable » récente sur login.html
 * et l'espace admin, l'ancienne clé anonyme au format JWT sur payment.html et
 * admin-payments.html. La révocation de la clé historique aurait coupé le
 * parcours de paiement sans que rien d'autre ne bouge.
 *
 * Ces valeurs sont publiques par conception : la sécurité repose entièrement sur
 * les règles RLS définies dans Supabase, jamais sur le secret de cette clé.
 */
(function (global) {
  'use strict';
  var env = {
    SUPABASE_URL: 'https://otsiwiwlnowxeolbbgvm.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_MhaI5b-kMmb5liIMOJ4P3Q_xGTsJAFJ',
    SESSION_KEY: 'tc_session'
  };
  env.SUPABASE_REST = env.SUPABASE_URL + '/rest/v1';
  env.SUPABASE_AUTH = env.SUPABASE_URL + '/auth/v1';

  /**
   * Lecture tolérante de la session : selon le point d'entrée utilisé, l'objet
   * stocké a la forme {access_token}, {session:{...}} ou {data:{session:{...}}}.
   * Chaque module implémentait sa propre variante ; certains ne géraient qu'une
   * seule forme et perdaient donc silencieusement le jeton.
   */
  env.getSession = function () {
    try {
      var raw = localStorage.getItem(env.SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.data && parsed.data.session)
        || (parsed && parsed.session)
        || parsed
        || null;
    } catch (e) { return null; }
  };

  env.getToken = function () {
    var session = env.getSession();
    return (session && session.access_token) || '';
  };

  global.TC_ENV = env;
})(window);
