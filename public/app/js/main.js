// MAIN — The Capital BRVM Dashboard

window.allCours = [];
window.allIndices = [];
window.allBoc = [];
window.allFinancials = [];
window.allAnalyses = [];
window.allEntreprises = [];
window.entMap = {};

(function() {
  if (window.__TC_MAIN_LOADED__) {
    console.log("[MAIN] Deja charge, skip.");
    return;
  }
  window.__TC_MAIN_LOADED__ = true;

  async function initApp() {
    console.log("[MAIN] Initialisation...");

    if (!document.getElementById("toastContainer")) {
      var tc = document.createElement("div");
      tc.id = "toastContainer";
      tc.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
      document.body.appendChild(tc);
    }

    loadAll().catch(function(err) {
      console.error("[MAIN] Erreur loadAll:", err);
      if (typeof toast === "function") toast("Erreur de chargement des donnees", "error");
    });

    setupGlobalEvents();

    // Gestion propre du hash initial (plus de double appel)
    window.addEventListener("hashchange", function() {
      if (typeof parseHash === "function") parseHash();
    });

    if (location.hash && typeof parseHash === "function") {
      parseHash();                 // hash existant → parseHash appelle nav()
    } else if (typeof nav === "function") {
      nav("overview", true);       // pas de hash → overview par défaut
    }

    // ⭐ CORRECTION PRINCIPALE : retirer le voile noir
    document.body.classList.remove("init-hidden");

    console.log("[MAIN] Initialisation terminee");
  }

  async function loadAll() {
    var fetchOrEmpty = function(endpoint, setter, emptyVal) {
      if (typeof window.apiGet !== "function") {
        console.warn("[MAIN] apiGet non disponible");
        setter(emptyVal);
        return Promise.resolve();
      }
      return window.apiGet(endpoint)
        .then(function(data) { setter(data || emptyVal); })
        .catch(function(err) {
          console.warn("[MAIN] " + endpoint + " non charge:", err.message || err);
          setter(emptyVal);
        });
    };

    var promises = [
      fetchOrEmpty("/marche?type=cours", function(d) { window.allCours = d; }, []),
      fetchOrEmpty("/marche?type=indices", function(d) { window.allIndices = d; }, []),
      fetchOrEmpty("/boc", function(d) { window.allBoc = d; }, []),
      fetchOrEmpty("/marche?type=financials", function(d) { window.allFinancials = d; }, []),
      fetchOrEmpty("/marche?type=analyses", function(d) { window.allAnalyses = d; }, []),
      fetchOrEmpty("/marche?type=entreprises", function(d) {
        window.allEntreprises = d || [];
        window.entMap = {};
        for (var i = 0; i < window.allEntreprises.length; i++) {
          var e = window.allEntreprises[i];
          if (e && e.ticker) window.entMap[e.ticker] = e;
        }
      }, [])
    ];

    await Promise.all(promises);

    var activeView = document.querySelector(".view.active");
    var viewId = activeView && activeView.id ? activeView.id.replace("view-", "") : "";
    if (viewId) {
      var fnName = "render" + viewId.charAt(0).toUpperCase() + viewId.slice(1);
      if (typeof window[fnName] === "function") {
        try { window[fnName](); } catch(e) {}
      }
    }

    console.log("[MAIN] Donnees chargees:", {
      cours: window.allCours ? window.allCours.length : 0,
      indices: window.allIndices ? window.allIndices.length : 0,
      boc: window.allBoc ? window.allBoc.length : 0,
      financials: window.allFinancials ? window.allFinancials.length : 0,
      analyses: window.allAnalyses ? window.allAnalyses.length : 0,
      entreprises: window.allEntreprises ? window.allEntreprises.length : 0
    });
  }

  function setupGlobalEvents() {
    document.addEventListener("click", function(e) {
      if (!e.target.closest(".nav-dropdown") && !e.target.closest(".topnav-logo")) {
        if (typeof closeDropdowns === "function") closeDropdowns();
      }
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        if (typeof closeDropdowns === "function") closeDropdowns();
        if (typeof closeSidebar === "function") closeSidebar();
      }
    });
  }

  window.loadAll = loadAll;
  window.initApp = initApp;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
