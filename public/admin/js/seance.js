(function () {
  'use strict';

  /*
   * ============================================================
   * THE CAPITAL — BRVM
   * LA SÉANCE DU JOUR EN 1 MINUTE
   * ============================================================
   *
   * Module autonome réservé à l'administration.
   *
   * IMPORTANT :
   * - Ne modifie aucune table Supabase.
   * - Ne modifie aucune colonne.
   * - Ne touche pas à l'authentification.
   * - Ne touche pas aux clés API.
   * - Utilise les fonctions Supabase déjà disponibles dans Admin.
   * - Les données sont récupérées avec select=* afin de ne pas
   *   supposer des colonnes qui n'existent pas.
   *
   * Design :
   * - DM Sans       : texte
   * - Playfair      : titres
   * - DM Mono       : chiffres
   *
   * Export :
   * - PNG
   * - JPEG
   * - PDF
   *
   * Le logo est converti en Data URI avant génération du SVG
   * afin qu'il soit également présent dans le fichier exporté.
   */

  /* ============================================================
   * CONFIGURATION
   * ========================================================== */

  var COLORS = {
    bg: '#050505',
    dark: '#0A0804',
    cream: '#F5F0E8',
    white: '#FFFFFF',
    gold: '#B8964E',
    goldLight: '#D4AF6A',
    goldBright: '#C9A34A',
    goldSoft: '#FFF9F0',
    muted: '#8F887F',
    mutedDark: '#625B52',
    line: '#E5DED3',
    green: '#4ADE80',
    greenDark: '#1E6B35',
    red: '#F87171',
    redDark: '#B4232D'
  };

  var FONTS = {
    sans: "'DM Sans', Arial, sans-serif",
    serif: "'Playfair Display', Georgia, serif",
    mono: "'DM Mono', Consolas, monospace"
  };

  /*
   * Chemin du logo.
   *
   * Si ton logo actuel utilise un autre chemin dans le projet,
   * modifie UNIQUEMENT cette variable.
   */
  var LOGO_PATH = '/assets/the-capital-logo.png';

  var STATE = {
    data: null,
    svg: '',
    logoDataUri: null,
    width: 1080,
    height: 1620,
    generated: false
  };


  /* ============================================================
   * UTILITAIRES
   * ========================================================== */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/[&<>"']/g, function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }[char];
      });
  }

  function number(value) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 0;
    }

    var normalized = String(value)
      .replace(/\s/g, '')
      .replace(',', '.');

    var n = Number(normalized);

    return isFinite(n) ? n : 0;
  }

  function hasNumber(value) {
    return (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !isNaN(Number(value))
    );
  }

  function formatNumber(value, decimals) {
    return number(value).toLocaleString('fr-FR', {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  function formatPercent(value) {
    var n = number(value);

    return (
      n >= 0 ? '+' : ''
    ) +
      n.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) +
      ' %';
  }

  function compact(value) {
    var n = number(value);

    if (Math.abs(n) >= 1000000000000) {
      return formatNumber(n / 1000000000000, 2) + ' tn';
    }

    if (Math.abs(n) >= 1000000000) {
      return formatNumber(n / 1000000000, 2) + ' Mds';
    }

    if (Math.abs(n) >= 1000000) {
      return formatNumber(n / 1000000, 2) + ' M';
    }

    if (Math.abs(n) >= 1000) {
      return formatNumber(n / 1000, 2) + ' k';
    }

    return formatNumber(n, 0);
  }

  function dateFR(date) {
    if (!date) {
      return '—';
    }

    try {
      return new Date(date + 'T00:00:00')
        .toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
    } catch (e) {
      return date;
    }
  }

  function shortDate(date) {
    if (!date) {
      return '—';
    }

    try {
      return new Date(date + 'T00:00:00')
        .toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
    } catch (e) {
      return date;
    }
  }

  function getTicker(row) {
    return (
      row &&
      (
        row.ticker ||
        row.code ||
        row.symbole ||
        row.symbol ||
        row.valeur
      )
    ) || '—';
  }

  function getName(row) {
    return (
      row &&
      (
        row.societe ||
        row.nom_court ||
        row.nom ||
        row.libelle ||
        row.raison_sociale ||
        row.company_name
      )
    ) || getTicker(row);
  }

  function getVariation(row) {
    if (!row) return 0;

    if (hasNumber(row.variation)) {
      return number(row.variation);
    }

    if (hasNumber(row.variation_pct)) {
      return number(row.variation_pct);
    }

    if (hasNumber(row.var_pct)) {
      return number(row.var_pct);
    }

    if (
      hasNumber(row.cours_veille) &&
      hasNumber(row.cours)
    ) {
      var previous = number(row.cours_veille);

      if (previous !== 0) {
        return (
          (number(row.cours) / previous - 1) * 100
        );
      }
    }

    if (
      hasNumber(row.prix_precedent) &&
      hasNumber(row.prix)
    ) {
      var previousPrice =
        number(row.prix_precedent);

      if (previousPrice !== 0) {
        return (
          (number(row.prix) / previousPrice - 1) * 100
        );
      }
    }

    return 0;
  }

  function getPrice(row) {
    if (!row) return 0;

    return number(
      row.cours ??
      row.prix ??
      row.cours_cloture ??
      row.close ??
      row.last_price ??
      row.dernier_cours
    );
  }

  function getVolume(row) {
    if (!row) return 0;

    return number(
      row.volume ??
      row.vol ??
      row.quantite ??
      row.quantite_echangee ??
      row.volume_echange
    );
  }

  function getValue(row) {
    if (!row) return 0;

    return number(
      row.valeur_totale ??
      row.valeur_transigee ??
      row.valeur_echangee ??
      row.valeur ??
      row.montant
    );
  }

  function getCapitalisation(row) {
    if (!row) return 0;

    return number(
      row.capitalisation ??
      row.capitalisation_boursiere ??
      row.cap_boursiere
    );
  }


  /* ============================================================
   * SVG HELPERS
   * ========================================================== */

  function svgText(
    x,
    y,
    value,
    size,
    color,
    weight,
    family,
    anchor,
    letterSpacing
  ) {
    return (
      '<text' +
      ' x="' + x + '"' +
      ' y="' + y + '"' +
      ' font-family="' +
        (family || FONTS.sans) +
      '"' +
      ' font-size="' + size + '"' +
      ' font-weight="' + (weight || 400) + '"' +
      ' fill="' + (color || COLORS.cream) + '"' +
      ' text-anchor="' +
        (anchor || 'start') +
      '"' +
      (
        letterSpacing
          ? ' letter-spacing="' +
            letterSpacing +
            '"'
          : ''
      ) +
      '>' +
      esc(value) +
      '</text>'
    );
  }

  function svgLine(
    x1,
    y1,
    x2,
    y2,
    color,
    width
  ) {
    return (
      '<line' +
      ' x1="' + x1 + '"' +
      ' y1="' + y1 + '"' +
      ' x2="' + x2 + '"' +
      ' y2="' + y2 + '"' +
      ' stroke="' +
        (color || COLORS.line) +
      '"' +
      ' stroke-width="' +
        (width || 1) +
      '"' +
      '/>'
    );
  }

  function svgRect(
    x,
    y,
    width,
    height,
    fill,
    stroke,
    radius
  ) {
    return (
      '<rect' +
      ' x="' + x + '"' +
      ' y="' + y + '"' +
      ' width="' + width + '"' +
      ' height="' + height + '"' +
      ' rx="' + (radius || 10) + '"' +
      ' fill="' + fill + '"' +
      (
        stroke
          ? ' stroke="' + stroke + '"'
          : ''
      ) +
      '/>'
    );
  }

  function svgCircle(
    cx,
    cy,
    radius,
    fill,
    stroke,
    strokeWidth
  ) {
    return (
      '<circle' +
      ' cx="' + cx + '"' +
      ' cy="' + cy + '"' +
      ' r="' + radius + '"' +
      ' fill="' +
        (fill || 'none') +
      '"' +
      (
        stroke
          ? ' stroke="' +
            stroke +
            '" stroke-width="' +
            (strokeWidth || 1) +
            '"'
          : ''
      ) +
      '/>'
    );
  }


  /* ============================================================
   * LOGO
   *
   * C'est la correction principale de l'export.
   *
   * L'image n'est plus référencée uniquement par :
   * /assets/the-capital-logo.png
   *
   * Elle est transformée en Data URI :
   * data:image/png;base64,...
   *
   * Le Canvas peut donc l'exporter dans le JPEG/PNG/PDF.
   * ========================================================== */

  async function loadLogoDataUri() {

    if (STATE.logoDataUri) {
      return STATE.logoDataUri;
    }

    try {

      var response =
        await fetch(
          LOGO_PATH,
          {
            cache: 'no-cache'
          }
        );

      if (!response.ok) {
        throw new Error(
          'Logo introuvable : ' +
          LOGO_PATH
        );
      }

      var blob =
        await response.blob();

      STATE.logoDataUri =
        await blobToDataUri(blob);

      return STATE.logoDataUri;

    } catch (error) {

      console.warn(
        '[seance] impossible de charger le logo',
        error
      );

      /*
       * L'aperçu peut continuer sans logo
       * si le chemin est mauvais, mais l'utilisateur
       * sera prévenu.
       */

      return null;
    }
  }

  function blobToDataUri(blob) {

    return new Promise(function (
      resolve,
      reject
    ) {

      var reader =
        new FileReader();

      reader.onload =
        function () {
          resolve(
            reader.result
          );
        };

      reader.onerror =
        reject;

      reader.readAsDataURL(blob);
    });
  }


  /* ============================================================
   * DONNÉES
   * ========================================================== */

  async function readTable(
    table,
    filters
  ) {

    var query =
      'select=*';

    if (filters) {
      query += '&' + filters;
    }

    try {

      var result =
        await sbGet(
          table,
          query
        );

      return Array.isArray(result)
        ? result
        : [];

    } catch (error) {

      console.warn(
        '[seance] table ' +
        table +
        ' indisponible',
        error
      );

      return [];
    }
  }

  async function readCourses(date) {

    /*
     * IMPORTANT :
     * On ne sélectionne plus :
     *
     * cours_cloture
     * cours
     * etc.
     *
     * On demande simplement les colonnes
     * réellement présentes.
     */

    var filters =
      'date_seance=eq.' +
      encodeURIComponent(date) +
      '&limit=1000';

    var rows =
      await readTable(
        'cours',
        filters
      );

    if (rows.length) {
      return rows;
    }

    /*
     * Fallback historique.
     */

    rows =
      await readTable(
        'historique',
        filters
      );

    return rows;
  }

  async function findLatestDate() {

    var rows =
      await readTable(
        'cours',
        'select=date_seance' +
        '&order=date_seance.desc' +
        '&limit=1'
      );

    if (
      rows.length &&
      rows[0].date_seance
    ) {
      return rows[0].date_seance;
    }

    rows =
      await readTable(
        'historique',
        'select=date_seance' +
        '&order=date_seance.desc' +
        '&limit=1'
      );

    if (
      rows.length &&
      rows[0].date_seance
    ) {
      return rows[0].date_seance;
    }

    return null;
  }

  async function readIndices(date) {

    var rows =
      await readTable(
        'indices',
        'limit=1000'
      );

    return rows.filter(function (row) {

      return (
        !date ||
        !row.date_seance ||
        row.date_seance === date
      );

    });
  }

  async function readCompanies() {

    return await readTable(
      'entreprises',
      'limit=1000'
    );
  }

  async function readDividends() {

    return await readTable(
      'dividendes_calendrier',
      'limit=20'
    );
  }

  async function readFinancials() {

    return await readTable(
      'financials',
      'limit=1000'
    );
  }


  /* ============================================================
   * CONSTRUCTION DES DONNÉES
   * ========================================================== */

  async function getData(date) {

    var actualDate =
      date || await findLatestDate();

    if (!actualDate) {

      throw new Error(
        'Impossible de déterminer la date de séance.'
      );
    }

    var courses =
      await readCourses(
        actualDate
      );

    if (!courses.length) {

      throw new Error(
        'Aucune donnée de séance disponible pour ' +
        actualDate +
        '.'
      );
    }

    var indices =
      await readIndices(
        actualDate
      );

    var companies =
      await readCompanies();

    var dividends =
      await readDividends();

    var financials =
      await readFinancials();

    /*
     * Mapping des sociétés.
     */

    var companyMap = {};

    companies.forEach(function (company) {

      var ticker =
        company.ticker ||
        company.code ||
        company.symbole;

      if (ticker) {

        companyMap[
          String(ticker).toUpperCase()
        ] =
          company.nom_court ||
          company.nom ||
          company.libelle ||
          ticker;
      }

    });

    /*
     * Normalisation des cours.
     */

    var normalized =
      courses.map(function (row) {

        var ticker =
          getTicker(row);

        var normalizedTicker =
          String(ticker).toUpperCase();

        var variation =
          getVariation(row);

        return {
          raw: row,
          ticker: ticker,
          societe:
            companyMap[
              normalizedTicker
            ] ||
            getName(row),
          variation: variation,
          volume: getVolume(row),
          value: getValue(row),
          price: getPrice(row),
          capitalisation:
            getCapitalisation(row)
        };

      });

    /*
     * Ne conserver que les lignes réellement
     * exploitables pour les tops.
     */

    var active =
      normalized.filter(function (row) {

        return (
          row.volume > 0 ||
          row.value > 0 ||
          row.variation !== 0
        );

      });

    var gain =
      active
        .filter(function (row) {
          return row.variation > 0;
        })
        .sort(function (a, b) {
          return (
            b.variation -
            a.variation
          );
        })
        .slice(0, 5);

    var loss =
      active
        .filter(function (row) {
          return row.variation < 0;
        })
        .sort(function (a, b) {
          return (
            a.variation -
            b.variation
          );
        })
        .slice(0, 5);

    var flat =
      active.filter(function (row) {
        return row.variation === 0;
      });

    var totalVolume =
      active.reduce(
        function (sum, row) {
          return sum + row.volume;
        },
        0
      );

    var totalValue =
      active.reduce(
        function (sum, row) {
          return sum + row.value;
        },
        0
      );

    var totalCapitalisation =
      active.reduce(
        function (sum, row) {
          return sum +
            row.capitalisation;
        },
        0
      );

    /*
     * Indices.
     */

    var indexNames = [
      'BRVM COMPOSITE',
      'BRVM 30',
      'BRVM PRESTIGE'
    ];

    var indexCards =
      indexNames.map(function (name) {

        var row =
          indices.find(function (item) {

            var label =
              String(
                item.indice ||
                item.nom ||
                item.code ||
                ''
              ).toUpperCase();

            return (
              label === name ||
              label.indexOf(name) !== -1
            );

          });

        if (!row) {
          return {
            name: name,
            row: null,
            ytd: null
          };
        }

        return {
          name: name,
          row: row,
          ytd:
            hasNumber(row.ytd)
              ? number(row.ytd)
              : hasNumber(row.variation_ytd)
                ? number(row.variation_ytd)
                : null
        };

      });

    /*
     * Ratios financiers.
     */

    var financialMap = {};

    financials.forEach(function (row) {

      var ticker =
        String(
          row.ticker ||
          row.code ||
          ''
        ).toUpperCase();

      if (!ticker) {
        return;
      }

      if (!financialMap[ticker]) {
        financialMap[ticker] =
          row;
        return;
      }

      if (
        number(row.annee) >
        number(
          financialMap[ticker].annee
        )
      ) {
        financialMap[ticker] =
          row;
      }

    });

    var peValues = [];
    var yieldValues = [];
    var roeValues = [];

    active.forEach(function (row) {

      var financial =
        financialMap[
          String(
            row.ticker
          ).toUpperCase()
        ];

      if (!financial) {
        return;
      }

      var bpa =
        number(
          financial.bpa
        );

      var dpa =
        number(
          financial.dpa
        );

      var result =
        number(
          financial.resultat_net
        );

      var equity =
        number(
          financial.fonds_propres
        );

      if (
        row.price > 0 &&
        bpa > 0
      ) {

        peValues.push(
          row.price / bpa
        );

      }

      if (
        row.price > 0 &&
        dpa > 0
      ) {

        yieldValues.push(
          dpa /
          row.price *
          100
        );

      }

      if (
        equity > 0
      ) {

        roeValues.push(
          result /
          equity *
          100
        );

      }

    });

    function average(values) {

      if (!values.length) {
        return null;
      }

      return (
        values.reduce(
          function (sum, value) {
            return sum + value;
          },
          0
        ) /
        values.length
      );

    }

    /*
     * Dividendes.
     */

    var futureDividends =
      dividends
        .filter(function (row) {

          var d =
            row.ex_date ||
            row.date_detachement ||
            row.date_paiement ||
            row.date_paiement_cal;

          return (
            !d ||
            d >= actualDate
          );

        })
        .slice(0, 5);

    return {

      date: actualDate,

      indices:
        indexCards,

      courses:
        active,

      gain:
        gain,

      loss:
        loss,

      flat:
        flat,

      volume:
        totalVolume,

      value:
        totalValue,

      capitalisation:
        totalCapitalisation,

      dividends:
        futureDividends,

      stats: {
        pe:
          average(peValues),

        yield:
          average(yieldValues),

        roe:
          average(roeValues)
      }

    };
  }


  /* ============================================================
   * HEADER
   * ========================================================== */

  function drawHeader(
    data,
    width
  ) {

    var output = '';

    output +=
      svgRect(
        0,
        0,
        width,
        260,
        COLORS.dark,
        null,
        0
      );

    /*
     * LOGO INTÉGRÉ DIRECTEMENT DANS LE SVG.
     */

    if (STATE.logoDataUri) {

      output +=
        '<image' +
        ' href="' +
        STATE.logoDataUri +
        '"' +
        ' x="46"' +
        ' y="32"' +
        ' width="160"' +
        ' height="150"' +
        ' preserveAspectRatio="xMidYMid meet"' +
        '/>';

    } else {

      output +=
        svgText(
          46,
          95,
          'THE CAPITAL',
          27,
          COLORS.cream,
          700,
          FONTS.serif
        );

    }

    output +=
      svgLine(
        230,
        28,
        230,
        215,
        COLORS.gold,
        2
      );

    output +=
      svgText(
        260,
        82,
        'BRVM',
        58,
        COLORS.gold,
        800,
        FONTS.serif
      );

    output +=
      svgText(
        260,
        135,
        'LA SÉANCE DU JOUR',
        30,
        COLORS.cream,
        700,
        FONTS.sans,
        'start',
        '1.5'
      );

    output +=
      svgText(
        260,
        174,
        'EN 1 MINUTE',
        30,
        COLORS.cream,
        700,
        FONTS.sans,
        'start',
        '1.5'
      );

    output +=
      svgRect(
        260,
        197,
        535,
        39,
        '#1E170B',
        COLORS.gold,
        19
      );

    output +=
      svgText(
        527,
        222,
        dateFR(data.date),
        16,
        COLORS.goldLight,
        600,
        FONTS.sans,
        'middle'
      );

    output +=
      svgText(
        width - 48,
        70,
        'THE CAPITAL',
        12,
        COLORS.muted,
        700,
        FONTS.serif,
        'end'
      );

    output +=
      svgText(
        width - 48,
        92,
        'MARKET INTELLIGENCE',
        9,
        COLORS.muted,
        500,
        FONTS.sans,
        'end',
        '1'
      );

    return output;
  }


  /* ============================================================
   * CARTE INDICE
   * ========================================================== */

  function indexCard(
    x,
    y,
    width,
    height,
    item
  ) {

    var output =
      svgRect(
        x,
        y,
        width,
        height,
        '#FCFBF8',
        '#E8E3D8',
        12
      );

    output +=
      svgText(
        x + 20,
        y + 30,
        item.name,
        14,
        '#25231F',
        700,
        FONTS.sans,
        'start',
        '.8'
      );

    if (!item.row) {

      output +=
        svgText(
          x + 20,
          y + 88,
          'Donnée indisponible',
          15,
          '#777',
          500,
          FONTS.sans
        );

      return output;
    }

    var row =
      item.row;

    var value =
      number(
        row.valeur ??
        row.value ??
        row.indice
      );

    var variation =
      hasNumber(row.variation)
        ? number(row.variation)
        : hasNumber(row.variation_pct)
          ? number(row.variation_pct)
          : 0;

    var positive =
      variation >= 0;

    var color =
      positive
        ? COLORS.greenDark
        : COLORS.redDark;

    output +=
      svgCircle(
        x + 37,
        y + 77,
        22,
        'none',
        positive
          ? COLORS.green
          : COLORS.red,
        2.5
      );

    output +=
      svgLine(
        x + 29,
        y + 84,
        x + 44,
        y + 69,
        positive
          ? COLORS.green
          : COLORS.red,
        3
      );

    output +=
      svgLine(
        x + 44,
        y + 69,
        x + 44,
        y + 78,
        positive
          ? COLORS.green
          : COLORS.red,
        3
      );

    output +=
      svgLine(
        x + 44,
        y + 69,
        x + 35,
        y + 69,
        positive
          ? COLORS.green
          : COLORS.red,
        3
      );

    output +=
      svgText(
        x + 70,
        y + 87,
        formatNumber(value, 2),
        31,
        color,
        700,
        FONTS.mono
      );

    output +=
      svgText(
        x + 70,
        y + 115,
        formatPercent(variation),
        15,
        positive
          ? COLORS.greenDark
          : COLORS.redDark,
        700,
        FONTS.mono
      );

    output +=
      svgText(
        x + 20,
        y + 150,
        'Depuis le 1er janvier',
        11,
        COLORS.mutedDark,
        500,
        FONTS.sans
      );

    output +=
      svgText(
        x + 20,
        y + 174,
        item.ytd == null
          ? '—'
          : formatPercent(item.ytd),
        15,
        item.ytd == null
          ? '#777'
          : item.ytd >= 0
            ? COLORS.greenDark
            : COLORS.redDark,
        700,
        FONTS.mono
      );

    return output;
  }


  /* ============================================================
   * STATISTIQUES
   * ========================================================== */

  function marketStats(
    data,
    x,
    y,
    width
  ) {

    var output =
      svgText(
        x,
        y,
        'LE MARCHÉ ACTIONS EN CHIFFRES',
        23,
        '#24211D',
        700,
        FONTS.serif
      );

    y += 26;

    var values = [
      data.courses.length,
      data.gain.length,
      data.loss.length,
      data.flat.length
    ];

    var labels = [
      'titres échangés',
      'en hausse',
      'en baisse',
      'inchangés'
    ];

    var cellWidth =
      width / 4;

    values.forEach(function (
      value,
      index
    ) {

      var cellX =
        x +
        index *
        cellWidth;

      if (index > 0) {

        output +=
          svgLine(
            cellX,
            y,
            cellX,
            y + 95,
            '#E5DED3',
            1
          );

      }

      output +=
        svgText(
          cellX + cellWidth / 2,
          y + 42,
          formatNumber(value),
          30,
          '#171513',
          500,
          FONTS.mono,
          'middle'
        );

      output +=
        svgText(
          cellX + cellWidth / 2,
          y + 67,
          labels[index],
          11,
          COLORS.mutedDark,
          500,
          FONTS.sans,
          'middle'
        );

    });

    y += 112;

    output +=
      svgRect(
        x,
        y,
        width,
        82,
        COLORS.goldSoft,
        '#EFE5D6',
        10
      );

    var metrics = [
      [
        'VOLUME ÉCHANGÉ',
        formatNumber(data.volume) +
          ' titres'
      ],
      [
        'VALEUR ÉCHANGÉE',
        compact(data.value) +
          ' FCFA'
      ],
      [
        'CAPITALISATION',
        compact(data.capitalisation) +
          ' FCFA'
      ]
    ];

    metrics.forEach(function (
      metric,
      index
    ) {

      var center =
        x +
        width *
        ((index * 2 + 1) / 6);

      if (index > 0) {

        output +=
          svgLine(
            x +
              width *
              (index / 3),
            y + 13,
            x +
              width *
              (index / 3),
            y + 69,
            '#E5D9C8',
            1
          );

      }

      output +=
        svgText(
          center,
          y + 28,
          metric[0],
          10,
          '#746B61',
          600,
          FONTS.sans,
          'middle',
          '.8'
        );

      output +=
        svgText(
          center,
          y + 55,
          metric[1],
          17,
          COLORS.gold,
          500,
          FONTS.mono,
          'middle'
        );

    });

    y += 100;

    output +=
      svgRect(
        x,
        y,
        width,
        72,
        '#FFF9F0',
        '#EFE5D6',
        10
      );

    var financials = [
      [
        'P/E MOYEN',
        data.stats.pe == null
          ? '—'
          : formatNumber(
              data.stats.pe,
              2
            )
      ],
      [
        'RENDEMENT MOYEN',
        data.stats.yield == null
          ? '—'
          : formatNumber(
              data.stats.yield,
              2
            ) + ' %'
      ],
      [
        'ROE MOYEN',
        data.stats.roe == null
          ? '—'
          : formatNumber(
              data.stats.roe,
              2
            ) + ' %'
      ]
    ];

    financials.forEach(function (
      metric,
      index
    ) {

      var cellWidth =
        width / 3;

      var center =
        x +
        cellWidth *
        index +
        cellWidth / 2;

      if (index > 0) {

        output +=
          svgLine(
            x +
              cellWidth *
              index,
            y + 10,
            x +
              cellWidth *
              index,
            y + 62,
            '#E5D9C8',
            1
          );

      }

      output +=
        svgText(
          center,
          y + 26,
          metric[0],
          10,
          '#746B61',
          600,
          FONTS.sans,
          'middle',
          '.7'
        );

      output +=
        svgText(
          center,
          y + 52,
          metric[1],
          17,
          '#171513',
          500,
          FONTS.mono,
          'middle'
        );

    });

    return {
      svg: output,
      nextY: y + 90
    };
  }


  /* ============================================================
   * TOP 5
   * ========================================================== */

  function topBox(
    x,
    y,
    width,
    height,
    title,
    rows,
    color
  ) {

    var output =
      svgRect(
        x,
        y,
        width,
        height,
        '#FFFFFF',
        '#E7E0D6',
        12
      );

    output +=
      svgText(
        x + 20,
        y + 29,
        title,
        17,
        color,
        700,
        FONTS.sans,
        'start',
        '.4'
      );

    output +=
      svgLine(
        x + 20,
        y + 45,
        x + width - 20,
        y + 45,
        '#E8E1D8',
        1
      );

    if (!rows.length) {

      output +=
        svgText(
          x + 20,
          y + 78,
          'Aucune donnée disponible',
          12,
          '#777',
          400,
          FONTS.sans
        );

      return output;
    }

    rows.forEach(function (
      row,
      index
    ) {

      var yy =
        y +
        77 +
        index *
        43;

      output +=
        svgCircle(
          x + 29,
          yy - 5,
          11,
          color
        );

      output +=
        svgText(
          x + 29,
          yy - 1,
          String(index + 1),
          9,
          '#FFFFFF',
          700,
          FONTS.mono,
          'middle'
        );

      output +=
        svgText(
          x + 51,
          yy,
          getTicker(row) +
            ' — ' +
            getName(row),
          11,
          '#24211D',
          600,
          FONTS.sans
        );

      output +=
        svgText(
          x + width - 20,
          yy,
          formatPercent(
            row.variation
          ),
          12,
          color,
          600,
          FONTS.mono,
          'end'
        );

      output +=
        svgText(
          x + 51,
          yy + 16,
          'Vol. ' +
            formatNumber(
              row.volume
            ) +
            ' · ' +
            compact(row.value) +
            ' FCFA',
          9,
          '#777',
          400,
          FONTS.mono
        );

    });

    return output;
  }


  /* ============================================================
   * DIVIDENDES
   * ========================================================== */

  function dividendBox(
    x,
    y,
    width,
    data
  ) {

    var height = 120;

    var output =
      svgRect(
        x,
        y,
        width,
        height,
        '#FFF9F0',
        '#E8DFD0',
        11
      );

    output +=
      svgText(
        x + 20,
        y + 27,
        'DIVIDENDES À VENIR',
        15,
        COLORS.gold,
        700,
        FONTS.sans,
        'start',
        '.6'
      );

    var rows =
      (data.dividends || [])
        .slice(0, 4);

    if (!rows.length) {

      output +=
        svgText(
          x + 20,
          y + 59,
          'Aucun dividende disponible.',
          11,
          '#777',
          400,
          FONTS.sans
        );

      return output;
    }

    rows.forEach(function (
      row,
      index
    ) {

      var yy =
        y +
        51 +
        index *
        16;

      var ticker =
        row.ticker ||
        row.code ||
        '—';

      var amount =
        row.montant_net ??
        row.montant ??
        row.dividende;

      var dividendDate =
        row.ex_date ||
        row.date_detachement ||
        row.date_paiement ||
        row.date_paiement_cal;

      output +=
        svgText(
          x + 20,
          yy,
          ticker,
          10,
          '#24211D',
          700,
          FONTS.mono
        );

      output +=
        svgText(
          x + 130,
          yy,
          hasNumber(amount)
            ? formatNumber(
                amount,
                2
              ) +
              ' FCFA/action'
            : '—',
          10,
          '#625B52',
          500,
          FONTS.sans
        );

      output +=
        svgText(
          x + width - 20,
          yy,
          shortDate(
            dividendDate
          ),
          10,
          '#625B52',
          500,
          FONTS.mono,
          'end'
        );

    });

    return output;
  }


  /* ============================================================
   * GÉNÉRATION SVG
   * ========================================================== */

  function buildSVG(
    data,
    width,
    height,
    note,
    bond
  ) {

    var padding = 34;
    var contentWidth =
      width -
      padding * 2;

    var gap = 12;

    var svg =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg"' +
      ' width="' + width + '"' +
      ' height="' + height + '"' +
      ' viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '">' ;

    /*
     * Fond.
     */

    svg +=
      svgRect(
        0,
        0,
        width,
        height,
        COLORS.white,
        null,
        0
      );

    /*
     * Header.
     */

    svg +=
      drawHeader(
        data,
        width
      );

    var y = 284;

    /*
     * Indices.
     */

    var indexWidth =
      (
        contentWidth -
        gap * 2
      ) / 3;

    var indexHeight =
      268;

    data.indices.forEach(
      function (
        item,
        index
      ) {

        svg +=
          indexCard(
            padding +
              index *
              (indexWidth + gap),
            y,
            indexWidth,
            indexHeight,
            item
          );

      }
    );

    y +=
      indexHeight +
      26;

    /*
     * Statistiques.
     */

    var metrics =
      marketStats(
        data,
        padding,
        y,
        contentWidth
      );

    svg += metrics.svg;

    y = metrics.nextY;

    /*
     * Top 5.
     */

    var boxWidth =
      (
        contentWidth -
        gap
      ) / 2;

    var boxHeight =
      286;

    svg +=
      topBox(
        padding,
        y,
        boxWidth,
        boxHeight,
        'TOP 5 HAUSSES DU JOUR',
        data.gain,
        COLORS.greenDark
      );

    svg +=
      topBox(
        padding +
          boxWidth +
          gap,
        y,
        boxWidth,
        boxHeight,
        'TOP 5 BAISSES DU JOUR',
        data.loss,
        COLORS.redDark
      );

    y +=
      boxHeight +
      18;

    /*
     * Marché obligataire.
     */

    var bondHeight =
      105;

    svg +=
      svgRect(
        padding,
        y,
        contentWidth,
        bondHeight,
        '#FFF9F0',
        '#E8DFD0',
        11
      );

    svg +=
      svgText(
        padding + 20,
        y + 27,
        'MARCHÉ OBLIGATAIRE',
        15,
        '#C78A00',
        700,
        FONTS.sans,
        'start',
        '.6'
      );

    var bondMetrics = [
      [
        'CAPITALISATION',
        hasNumber(bond.cap)
          ? compact(bond.cap) +
            ' FCFA'
          : '—'
      ],
      [
        'VALEUR ÉCHANGÉE',
        hasNumber(bond.value)
          ? compact(bond.value) +
            ' FCFA'
          : '—'
      ],
      [
        'VOLUME ÉCHANGÉ',
        hasNumber(bond.volume)
          ? formatNumber(
              bond.volume
            ) +
            ' titres'
          : '—'
      ]
    ];

    bondMetrics.forEach(
      function (
        metric,
        index
      ) {

        var center =
          padding +
          145 +
          index *
          260;

        if (index > 0) {

          svg +=
            svgLine(
              center - 130,
              y + 43,
              center - 130,
              y + 88,
              '#E5D9C8',
              1
            );

        }

        svg +=
          svgText(
            center,
            y + 53,
            metric[0],
            9,
            '#746B61',
            600,
            FONTS.sans,
            'middle',
            '.6'
          );

        svg +=
          svgText(
            center,
            y + 76,
            metric[1],
            14,
            '#24211D',
            500,
            FONTS.mono,
            'middle'
          );

      }
    );

    y +=
      bondHeight +
      16;

    /*
     * Dividendes.
     */

    svg +=
      dividendBox(
        padding,
        y,
        contentWidth,
        data
      );

    y += 138;

    /*
     * Actualité.
     */

    var noteText =
      note &&
      note.trim()
        ? note.trim()
        : 'Séance BRVM du jour : évolution des indices, activité du marché et valeurs les plus marquantes.';

    svg +=
      svgRect(
        padding,
        y,
        contentWidth,
        112,
        '#FAF7F1',
        '#E8DFD0',
        11
      );

    svg +=
      svgText(
        padding + 20,
        y + 27,
        'ACTU DU JOUR',
        15,
        COLORS.gold,
        700,
        FONTS.sans,
        'start',
        '.7'
      );

    var words =
      noteText.split(/\s+/);

    var lines = [];
    var current = '';

    words.forEach(function (
      word
    ) {

      var candidate =
        (
          current +
          ' ' +
          word
        ).trim();

      if (
        candidate.length >
        92
      ) {

        lines.push(
          current
        );

        current =
          word;

      } else {

        current =
          candidate;

      }

    });

    if (current) {
      lines.push(current);
    }

    lines
      .slice(0, 4)
      .forEach(function (
        textValue,
        index
      ) {

        svg +=
          svgText(
            padding + 20,
            y +
              53 +
              index * 18,
            textValue,
            11,
            '#3F3A34',
            500,
            FONTS.sans
          );

      });

    /*
     * Footer.
     */

    svg +=
      svgText(
        width / 2,
        height - 30,
        'THE CAPITAL  ·  MARKET INTELLIGENCE',
        9,
        '#8A8177',
        600,
        FONTS.sans,
        'middle',
        '1'
      );

    svg += '</svg>';

    return svg;
  }


  /* ============================================================
   * SVG -> IMAGE
   *
   * Le logo est déjà inclus en Base64.
   * ========================================================== */

  async function svgToBlob(
    type
  ) {

    if (!STATE.svg) {

      throw new Error(
        'Aucune séance générée.'
      );

    }

    var svgBlob =
      new Blob(
        [STATE.svg],
        {
          type:
            'image/svg+xml;charset=utf-8'
        }
      );

    var svgUrl =
      URL.createObjectURL(
        svgBlob
      );

    try {

      var image =
        await loadImage(
          svgUrl
        );

      var canvas =
        document.createElement(
          'canvas'
        );

      canvas.width =
        STATE.width;

      canvas.height =
        STATE.height;

      var context =
        canvas.getContext(
          '2d'
        );

      /*
       * Fond blanc obligatoire pour JPEG.
       */

      context.fillStyle =
        '#FFFFFF';

      context.fillRect(
        0,
        0,
        STATE.width,
        STATE.height
      );

      context.drawImage(
        image,
        0,
        0,
        STATE.width,
        STATE.height
      );

      var blob =
        await new Promise(
          function (
            resolve,
            reject
          ) {

            canvas.toBlob(
              function (result) {

                if (!result) {

                  reject(
                    new Error(
                      'Export impossible.'
                    )
                  );

                  return;
                }

                resolve(result);

              },
              type,
              0.96
            );

          }
        );

      return blob;

    } finally {

      URL.revokeObjectURL(
        svgUrl
      );

    }
  }

  function loadImage(
    source
  ) {

    return new Promise(
      function (
        resolve,
        reject
      ) {

        var image =
          new Image();

        image.onload =
          function () {
            resolve(image);
          };

        image.onerror =
          function () {
            reject(
              new Error(
                'Impossible de rasteriser le visuel.'
              )
            );
          };

        image.src =
          source;

      }
    );
  }


  /* ============================================================
   * DOWNLOAD
   * ========================================================== */

  function saveBlob(
    blob,
    filename
  ) {

    var url =
      URL.createObjectURL(
        blob
      );

    var link =
      document.createElement(
        'a'
      );

    link.href =
      url;

    link.download =
      filename;

    document.body.appendChild(
      link
    );

    link.click();

    setTimeout(
      function () {

        URL.revokeObjectURL(
          url
        );

        link.remove();

      },
      1000
    );
  }

  async function downloadPNG() {

    try {

      var blob =
        await svgToBlob(
          'image/png'
        );

      saveBlob(
        blob,
        'the-capital-seance-' +
          STATE.data.date +
          '.png'
      );

    } catch (error) {

      showMessage(
        error.message,
        'error'
      );

    }
  }

  async function downloadJPEG() {

    try {

      var blob =
        await svgToBlob(
          'image/jpeg'
        );

      saveBlob(
        blob,
        'the-capital-seance-' +
          STATE.data.date +
          '.jpg'
      );

    } catch (error) {

      showMessage(
        error.message,
        'error'
      );

    }
  }


  /* ============================================================
   * PDF
   * ========================================================== */

  function loadJsPDF() {

    return new Promise(
      function (
        resolve,
        reject
      ) {

        if (
          window.jspdf &&
          window.jspdf.jsPDF
        ) {

          resolve();
          return;

        }

        var script =
          document.createElement(
            'script'
          );

        script.src =
          'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

        script.onload =
          function () {
            resolve();
          };

        script.onerror =
          function () {

            reject(
              new Error(
                'Impossible de charger le moteur PDF.'
              )
            );

          };

        document.head.appendChild(
          script
        );

      }
    );
  }

  async function downloadPDF() {

    try {

      await loadJsPDF();

      var blob =
        await svgToBlob(
          'image/png'
        );

      var dataUrl =
        await blobToDataUri(
          blob
        );

      var PDF =
        window.jspdf.jsPDF;

      var documentPdf =
        new PDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

      var pageWidth =
        documentPdf
          .internal
          .pageSize
          .getWidth();

      var pageHeight =
        documentPdf
          .internal
          .pageSize
          .getHeight();

      documentPdf.addImage(
        dataUrl,
        'PNG',
        0,
        0,
        pageWidth,
        pageHeight,
        undefined,
        'FAST'
      );

      documentPdf.save(
        'the-capital-seance-' +
          STATE.data.date +
          '.pdf'
      );

    } catch (error) {

      console.error(
        '[seance] PDF',
        error
      );

      showMessage(
        error.message,
        'error'
      );

    }
  }


  /* ============================================================
   * INTERFACE ADMIN
   * ========================================================== */

  function showMessage(
    message,
    type
  ) {

    var element =
      document.getElementById(
        'seance-msg'
      );

    if (!element) return;

    element.textContent =
      message;

    element.className =
      'msg ' +
      (
        type === 'error'
          ? 'err'
          : type === 'success'
            ? 'ok'
            : 'info'
      );

  }

  function injectInterface() {

    if (
      document.getElementById(
        'tab-seance-1m'
      )
    ) {

      return;

    }

    var navigation =
      document.querySelector(
        '.admin-nav'
      );

    if (!navigation) {
      return;
    }

    var button =
      document.createElement(
        'button'
      );

    button.id =
      'tab-seance-1m';

    button.className =
      'admin-tab';

    button.textContent =
      'Séance 1 minute';

    button.addEventListener(
      'click',
      function () {

        if (
          typeof switchTab ===
          'function'
        ) {

          switchTab(
            'seance1m',
            button
          );

        }

        loadSeance();

      }
    );

    navigation.appendChild(
      button
    );

    var main =
      document.querySelector(
        '.main'
      );

    if (!main) {
      return;
    }

    var panel =
      document.createElement(
        'div'
      );

    panel.className =
      'tab-panel';

    panel.id =
      'panel-seance1m';

    panel.innerHTML =

      '<div class="section-header">' +

        '<div class="section-title">' +
          'BRVM ' +
          '<em>La séance du jour en 1 minute</em>' +
        '</div>' +

        '<button ' +
          'class="btn btn-outline btn-sm" ' +
          'id="seance-refresh">' +
          '↺ Actualiser' +
        '</button>' +

      '</div>' +

      '<div class="seance-layout">' +

        '<div class="card">' +

          '<div class="card-header">' +

            '<span class="card-title">' +
              'Générateur The Capital' +
            '</span>' +

            '<span class="badge badge-gold">' +
              'Admin uniquement' +
            '</span>' +

          '</div>' +

          '<div style="padding:18px">' +

            '<div class="form-grid">' +

              '<div class="field">' +
                '<label>Date de séance</label>' +
                '<input ' +
                  'type="date" ' +
                  'id="seance-date">' +
              '</div>' +

              '<div class="field">' +
                '<label>Format</label>' +

                '<select ' +
                  'id="seance-format">' +

                  '<option value="1080x1620">' +
                    'Vertical — 1080 × 1620' +
                  '</option>' +

                  '<option value="1080x1920">' +
                    'Story — 1080 × 1920' +
                  '</option>' +

                  '<option value="1080x1350">' +
                    'Instagram — 1080 × 1350' +
                  '</option>' +

                  '<option value="1080x1080">' +
                    'Carré — 1080 × 1080' +
                  '</option>' +

                '</select>' +

              '</div>' +

              '<div class="field">' +
                '<label>N° Bulletin</label>' +
                '<input ' +
                  'type="text" ' +
                  'id="seance-bulletin" ' +
                  'placeholder="Facultatif">' +
              '</div>' +

              '<div class="field">' +
                '<label>Obligataire — capitalisation</label>' +
                '<input ' +
                  'type="number" ' +
                  'id="seance-bond-cap" ' +
                  'step="any" ' +
                  'placeholder="Facultatif">' +
              '</div>' +

              '<div class="field">' +
                '<label>Obligataire — valeur échangée</label>' +
                '<input ' +
                  'type="number" ' +
                  'id="seance-bond-value" ' +
                  'step="any" ' +
                  'placeholder="Facultatif">' +
              '</div>' +

              '<div class="field">' +
                '<label>Obligataire — volume</label>' +
                '<input ' +
                  'type="number" ' +
                  'id="seance-bond-volume" ' +
                  'step="1" ' +
                  'placeholder="Facultatif">' +
              '</div>' +

              '<div ' +
                'class="field" ' +
                'style="grid-column:1/-1">' +

                '<label>' +
                  'Commentaire éditorial' +
                '</label>' +

                '<textarea ' +
                  'id="seance-note" ' +
                  'rows="4" ' +
                  'placeholder="Ajoute ici le commentaire de marché du jour...">' +
                '</textarea>' +

              '</div>' +

            '</div>' +

            '<div class="actions-row" style="margin-top:16px">' +

              '<button ' +
                'class="btn btn-primary" ' +
                'id="seance-generate">' +
                'Générer la séance' +
              '</button>' +

              '<button ' +
                'class="btn btn-outline" ' +
                'id="seance-jpeg">' +
                'Télécharger JPEG' +
              '</button>' +

              '<button ' +
                'class="btn btn-outline" ' +
                'id="seance-png">' +
                'Télécharger PNG' +
              '</button>' +

              '<button ' +
                'class="btn btn-green" ' +
                'id="seance-pdf">' +
                'Télécharger PDF' +
              '</button>' +

              '<span ' +
                'id="seance-msg" ' +
                'class="msg">' +
              '</span>' +

            '</div>' +

          '</div>' +

        '</div>' +

        '<div class="card">' +

          '<div class="card-header">' +

            '<span class="card-title">' +
              'Prévisualisation' +
            '</span>' +

            '<span ' +
              'id="seance-meta" ' +
              'class="card-count">' +
            '</span>' +

          '</div>' +

          '<div class="seance-preview-wrap">' +

            '<div id="seance-preview"></div>' +

          '</div>' +

        '</div>' +

      '</div>';

    main.appendChild(
      panel
    );

    /*
     * Date par défaut.
     */

    var dateInput =
      document.getElementById(
        'seance-date'
      );

    if (dateInput) {

      dateInput.value =
        new Date()
          .toISOString()
          .slice(0, 10);

    }

    /*
     * Événements.
     */

    document
      .getElementById(
        'seance-generate'
      )
      .addEventListener(
        'click',
        loadSeance
      );

    document
      .getElementById(
        'seance-refresh'
      )
      .addEventListener(
        'click',
        loadSeance
      );

    document
      .getElementById(
        'seance-jpeg'
      )
      .addEventListener(
        'click',
        downloadJPEG
      );

    document
      .getElementById(
        'seance-png'
      )
      .addEventListener(
        'click',
        downloadPNG
      );

    document
      .getElementById(
        'seance-pdf'
      )
      .addEventListener(
        'click',
        downloadPDF
      );

    /*
     * Charger le CSS dédié uniquement si nécessaire.
     */

    if (
      !document.getElementById(
        'seance-css'
      )
    ) {

      var stylesheet =
        document.createElement(
          'link'
        );

      stylesheet.id =
        'seance-css';

      stylesheet.rel =
        'stylesheet';

      stylesheet.href =
        'admin/css/seance.css';

      document.head.appendChild(
        stylesheet
      );

    }
  }


  /* ============================================================
   * GÉNÉRER
   * ========================================================== */

  async function loadSeance() {

    injectInterface();

    showMessage(
      'Chargement des données BRVM…',
      'info'
    );

    try {

      /*
       * Charger le logo AVANT de construire le SVG.
       * C'est ce qui garantit sa présence dans l'export.
       */

      await loadLogoDataUri();

      var date =
        document
          .getElementById(
            'seance-date'
          )
          .value;

      var format =
        document
          .getElementById(
            'seance-format'
          )
          .value;

      var dimensions =
        format.split('x');

      STATE.width =
        Number(
          dimensions[0]
        );

      STATE.height =
        Number(
          dimensions[1]
        );

      STATE.data =
        await getData(
          date
        );

      var bond = {

        cap:
          document
            .getElementById(
              'seance-bond-cap'
            )
            .value,

        value:
          document
            .getElementById(
              'seance-bond-value'
            )
            .value,

        volume:
          document
            .getElementById(
              'seance-bond-volume'
            )
            .value

      };

      var note =
        document
          .getElementById(
            'seance-note'
          )
          .value;

      STATE.svg =
        buildSVG(
          STATE.data,
          STATE.width,
          STATE.height,
          note,
          bond
        );

      var preview =
        document.getElementById(
          'seance-preview'
        );

      preview.innerHTML =
        STATE.svg;

      document.getElementById(
        'seance-meta'
      ).textContent =
        dateFR(
          STATE.data.date
        ) +
        ' · ' +
        STATE.width +
        ' × ' +
        STATE.height;

      STATE.generated =
        true;

      if (!STATE.logoDataUri) {

        showMessage(
          'Séance générée. Attention : le logo n’a pas pu être chargé. Vérifie LOGO_PATH.',
          'error'
        );

      } else {

        showMessage(
          '✓ Séance générée avec logo intégré.',
          'success'
        );

      }

    } catch (error) {

      console.error(
        '[THE CAPITAL / SEANCE]',
        error
      );

      showMessage(
        error.message ||
        'Impossible de générer la séance.',
        'error'
      );

    }
  }


  /* ============================================================
   * EXPOSITION GLOBALE
   * ========================================================== */

  window.loadSeance1m =
    loadSeance;

  window.downloadSeanceJPEG =
    downloadJPEG;

  window.downloadSeancePNG =
    downloadPNG;

  window.downloadSeancePDF =
    downloadPDF;


  /* ============================================================
   * INITIALISATION
   * ========================================================== */

  function init() {

    injectInterface();

  }

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();

  }

})();
