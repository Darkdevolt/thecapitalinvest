(function () {
    'use strict';

    /*
     * ============================================================
     * THE CAPITAL — BRVM
     * LA SÉANCE DU JOUR EN 1 MINUTE
     * ============================================================
     *
     * Générateur réservé à l'Admin.
     *
     * PRINCIPES :
     * - aucune modification Supabase
     * - aucune modification Auth
     * - aucune modification des API existantes
     * - lecture des données avec select=*
     * - sections dynamiques
     * - aperçu = export
     * - logo intégré dans le SVG
     *
     * POLICES :
     * - Playfair Display : titres
     * - DM Sans          : interface / texte
     * - DM Mono          : chiffres
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
     * IMPORTANT :
     * Mets ici le chemin EXACT du logo déjà utilisé dans ton Admin.
     *
     * Si ton logo est à un autre emplacement, change uniquement
     * cette variable.
     */
    var LOGO_PATH = '/assets/the-capital-logo.png';

    var DEFAULT_WIDTH = 1080;

    var DEFAULT_HEIGHT = 1620;

    var GAP = 18;

    var STATE = {
        data: null,
        svg: '',
        logoDataUri: null,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        generated: false,
        mode: 'auto',
        sections: {
            indices: true,
            market: true,
            financials: true,
            gainers: true,
            losers: true,
            bonds: true,
            dividends: true,
            news: true
        }
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
        if (!row) {
            return 0;
        }

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
            var previous =
                number(row.cours_veille);

            if (previous !== 0) {
                return (
                    number(row.cours) /
                    previous -
                    1
                ) * 100;
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
                    number(row.prix) /
                    previousPrice -
                    1
                ) * 100;
            }
        }

        return 0;
    }

    function getPrice(row) {
        if (!row) {
            return 0;
        }

        return number(
            row.cours ??
            row.prix ??
            row.close ??
            row.last_price ??
            row.dernier_cours
        );
    }

    function getVolume(row) {
        if (!row) {
            return 0;
        }

        return number(
            row.volume ??
            row.vol ??
            row.quantite ??
            row.quantite_echangee ??
            row.volume_echange
        );
    }

    function getValue(row) {
        if (!row) {
            return 0;
        }

        return number(
            row.valeur_totale ??
            row.valeur_transigee ??
            row.valeur_echangee ??
            row.valeur ??
            row.montant
        );
    }

    function getCapitalisation(row) {
        if (!row) {
            return 0;
        }

        return number(
            row.capitalisation ??
            row.capitalisation_boursiere ??
            row.cap_boursiere
        );
    }


    /* ============================================================
     * SVG
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
            ' fill="' +
            (color || COLORS.cream) +
            '"' +
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
                '[seance] logo non chargé',
                error
            );

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
     * LECTURE SUPABASE
     * ========================================================== */

    async function readTable(
        table,
        query
    ) {

        try {

            var result =
                await sbGet(
                    table,
                    query || 'select=*'
                );

            return Array.isArray(result)
                ? result
                : [];

        } catch (error) {

            console.warn(
                '[seance] table indisponible:',
                table,
                error
            );

            return [];
        }
    }

    async function readCourses(date) {

        /*
         * AUCUNE colonne supposée.
         *
         * On utilise select=*.
         */

        var query =
            'select=*' +
            '&date_seance=eq.' +
            encodeURIComponent(date) +
            '&limit=1000';

        var rows =
            await readTable(
                'cours',
                query
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
                query
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
                'select=*' +
                '&limit=1000'
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
            'select=*' +
            '&limit=1000'
        );
    }

    async function readDividends() {

        return await readTable(
            'dividendes_calendrier',
            'select=*' +
            '&limit=100'
        );
    }

    async function readFinancials() {

        return await readTable(
            'financials',
            'select=*' +
            '&limit=1000'
        );
    }


    /* ============================================================
     * DONNÉES
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
         * Entreprises.
         */

        var companyMap = {};

        companies.forEach(function (company) {

            var ticker =
                company.ticker ||
                company.code ||
                company.symbole;

            if (!ticker) {
                return;
            }

            companyMap[
                String(ticker).toUpperCase()
            ] =
                company.nom_court ||
                company.nom ||
                company.libelle ||
                ticker;
        });

        /*
         * Cours normalisés.
         */

        var normalized =
            courses.map(function (row) {

                var ticker =
                    getTicker(row);

                var normalizedTicker =
                    String(ticker).toUpperCase();

                return {
                    raw: row,

                    ticker: ticker,

                    societe:
                        companyMap[
                            normalizedTicker
                        ] ||
                        getName(row),

                    variation:
                        getVariation(row),

                    volume:
                        getVolume(row),

                    value:
                        getValue(row),

                    price:
                        getPrice(row),

                    capitalisation:
                        getCapitalisation(row)
                };

            });

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
                            : hasNumber(
                                row.variation_ytd
                            )
                                ? number(
                                    row.variation_ytd
                                )
                                : null
                };

            });

        /*
         * Financials.
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
                financialMap[ticker] = row;
                return;
            }

            if (
                number(row.annee) >
                number(
                    financialMap[ticker].annee
                )
            ) {
                financialMap[ticker] = row;
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
                number(financial.bpa);

            var dpa =
                number(financial.dpa);

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

            if (equity > 0) {
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
                    function (
                        sum,
                        value
                    ) {
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

            indices: indexCards,

            courses: active,

            gain: gain,

            loss: loss,

            flat: flat,

            volume: totalVolume,

            value: totalValue,

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
     * DÉTECTION AUTOMATIQUE DES SECTIONS
     * ========================================================== */

    function hasIndexData(data) {

        return (
            data &&
            data.indices &&
            data.indices.some(function (item) {
                return !!item.row;
            })
        );
    }

    function hasMarketData(data) {

        return (
            data &&
            data.courses &&
            data.courses.length > 0
        );
    }

    function hasFinancialData(data) {

        return (
            data &&
            data.stats &&
            (
                data.stats.pe !== null ||
                data.stats.yield !== null ||
                data.stats.roe !== null
            )
        );
    }

    function hasGainers(data) {

        return (
            data &&
            data.gain &&
            data.gain.length > 0
        );
    }

    function hasLosers(data) {

        return (
            data &&
            data.loss &&
            data.loss.length > 0
        );
    }

    function hasDividendData(data) {

        return (
            data &&
            data.dividends &&
            data.dividends.length > 0
        );
    }

    function autoDetectSections(
        data,
        manualSections
    ) {

        var sections = {
            indices:
                hasIndexData(data),

            market:
                hasMarketData(data),

            financials:
                hasFinancialData(data),

            gainers:
                hasGainers(data),

            losers:
                hasLosers(data),

            bonds:
                manualSections.bonds,

            dividends:
                hasDividendData(data),

            news:
                manualSections.news
        };

        /*
         * En mode automatique, le bloc financier peut disparaître
         * s'il n'y a absolument aucune donnée.
         */

        return sections;
    }


    /* ============================================================
     * HEADER
     * ========================================================== */

    function drawHeader(
        width,
        date
    ) {

        var output = '';

        output +=
            svgRect(
                0,
                0,
                width,
                250,
                COLORS.dark,
                null,
                0
            );

        /*
         * Logo intégré.
         */

        if (STATE.logoDataUri) {

            output +=
                '<image' +
                ' href="' +
                STATE.logoDataUri +
                '"' +
                ' x="42"' +
                ' y="28"' +
                ' width="170"' +
                ' height="145"' +
                ' preserveAspectRatio="xMidYMid meet"' +
                '/>';

        } else {

            output +=
                svgText(
                    42,
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
                235,
                28,
                235,
                205,
                COLORS.gold,
                2
            );

        output +=
            svgText(
                265,
                76,
                'BRVM',
                56,
                COLORS.gold,
                800,
                FONTS.serif
            );

        output +=
            svgText(
                265,
                125,
                'LA SÉANCE DU JOUR',
                27,
                COLORS.cream,
                700,
                FONTS.sans,
                'start',
                '1.2'
            );

        output +=
            svgText(
                265,
                162,
                'EN 1 MINUTE',
                27,
                COLORS.cream,
                700,
                FONTS.sans,
                'start',
                '1.2'
            );

        output +=
            svgRect(
                265,
                181,
                520,
                36,
                '#1E170B',
                COLORS.gold,
                18
            );

        output +=
            svgText(
                525,
                205,
                dateFR(date),
                14,
                COLORS.goldLight,
                600,
                FONTS.sans,
                'middle'
            );

        output +=
            svgText(
                width - 42,
                55,
                'THE CAPITAL',
                11,
                COLORS.muted,
                700,
                FONTS.serif,
                'end'
            );

        output +=
            svgText(
                width - 42,
                76,
                'MARKET INTELLIGENCE',
                8,
                COLORS.muted,
                500,
                FONTS.sans,
                'end',
                '1'
            );

        return output;
    }


    /* ============================================================
     * SECTION INDICES
     * ========================================================== */

    function renderIndices(
        data,
        x,
        y,
        width
    ) {

        var height = 250;

        var output =
            svgText(
                x,
                y,
                'INDICES BRVM',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        var gap = 12;

        var cardWidth =
            (
                width -
                gap * 2
            ) / 3;

        data.indices.forEach(
            function (
                item,
                index
            ) {

                var cx =
                    x +
                    index *
                    (
                        cardWidth +
                        gap
                    );

                output +=
                    svgRect(
                        cx,
                        y,
                        cardWidth,
                        205,
                        '#FCFBF8',
                        '#E8E3D8',
                        12
                    );

                output +=
                    svgText(
                        cx + 18,
                        y + 28,
                        item.name,
                        12,
                        '#25231F',
                        700,
                        FONTS.sans,
                        'start',
                        '.5'
                    );

                if (!item.row) {

                    output +=
                        svgText(
                            cx + 18,
                            y + 94,
                            '—',
                            28,
                            '#999',
                            500,
                            FONTS.mono
                        );

                    output +=
                        svgText(
                            cx + 18,
                            y + 122,
                            'Donnée indisponible',
                            10,
                            '#777',
                            500,
                            FONTS.sans
                        );

                    return;
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
                        : hasNumber(
                            row.variation_pct
                        )
                            ? number(
                                row.variation_pct
                            )
                            : 0;

                var positive =
                    variation >= 0;

                var color =
                    positive
                        ? COLORS.greenDark
                        : COLORS.redDark;

                output +=
                    svgText(
                        cx + 18,
                        y + 83,
                        formatNumber(
                            value,
                            2
                        ),
                        26,
                        color,
                        700,
                        FONTS.mono
                    );

                output +=
                    svgText(
                        cx + 18,
                        y + 111,
                        formatPercent(
                            variation
                        ),
                        14,
                        color,
                        700,
                        FONTS.mono
                    );

                output +=
                    svgText(
                        cx + 18,
                        y + 146,
                        'Depuis le 1er janvier',
                        10,
                        COLORS.mutedDark,
                        500,
                        FONTS.sans
                    );

                output +=
                    svgText(
                        cx + 18,
                        y + 170,
                        item.ytd == null
                            ? '—'
                            : formatPercent(
                                item.ytd
                            ),
                        14,
                        item.ytd == null
                            ? '#777'
                            : item.ytd >= 0
                                ? COLORS.greenDark
                                : COLORS.redDark,
                        700,
                        FONTS.mono
                    );

            }
        );

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * SECTION MARCHÉ
     * ========================================================== */

    function renderMarket(
        data,
        x,
        y,
        width
    ) {

        var height = 185;

        var output =
            svgText(
                x,
                y,
                'LE MARCHÉ ACTIONS EN CHIFFRES',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        output +=
            svgRect(
                x,
                y,
                width,
                78,
                '#FCFBF8',
                '#E8E3D8',
                11
            );

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

            var center =
                x +
                index *
                cellWidth +
                cellWidth / 2;

            if (index > 0) {

                output +=
                    svgLine(
                        x +
                        index *
                        cellWidth,
                        y + 10,
                        x +
                        index *
                        cellWidth,
                        y + 68,
                        '#E5DED3',
                        1
                    );

            }

            output +=
                svgText(
                    center,
                    y + 36,
                    formatNumber(value),
                    25,
                    '#171513',
                    500,
                    FONTS.mono,
                    'middle'
                );

            output +=
                svgText(
                    center,
                    y + 59,
                    labels[index],
                    10,
                    COLORS.mutedDark,
                    500,
                    FONTS.sans,
                    'middle'
                );

        });

        y += 90;

        output +=
            svgRect(
                x,
                y,
                width,
                62,
                COLORS.goldSoft,
                '#EFE5D6',
                10
            );

        var metrics = [
            [
                'VOLUME',
                formatNumber(
                    data.volume
                ) + ' titres'
            ],
            [
                'VALEUR',
                compact(
                    data.value
                ) + ' FCFA'
            ],
            [
                'CAPITALISATION',
                compact(
                    data.capitalisation
                ) + ' FCFA'
            ]
        ];

        metrics.forEach(function (
            metric,
            index
        ) {

            var center =
                x +
                width *
                (
                    (index * 2 + 1) /
                    6
                );

            output +=
                svgText(
                    center,
                    y + 24,
                    metric[0],
                    9,
                    '#746B61',
                    600,
                    FONTS.sans,
                    'middle',
                    '.6'
                );

            output +=
                svgText(
                    center,
                    y + 47,
                    metric[1],
                    13,
                    COLORS.gold,
                    500,
                    FONTS.mono,
                    'middle'
                );

        });

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * SECTION FINANCIÈRE
     * ========================================================== */

    function renderFinancials(
        data,
        x,
        y,
        width
    ) {

        var height = 105;

        var output =
            svgText(
                x,
                y,
                'INDICATEURS FINANCIERS',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        output +=
            svgRect(
                x,
                y,
                width,
                68,
                '#FFF9F0',
                '#E8DFD0',
                10
            );

        var values = [
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

        var cellWidth =
            width / 3;

        values.forEach(function (
            item,
            index
        ) {

            var center =
                x +
                index *
                cellWidth +
                cellWidth / 2;

            if (index > 0) {

                output +=
                    svgLine(
                        x +
                        index *
                        cellWidth,
                        y + 10,
                        x +
                        index *
                        cellWidth,
                        y + 58,
                        '#E5D9C8',
                        1
                    );

            }

            output +=
                svgText(
                    center,
                    y + 24,
                    item[0],
                    9,
                    '#746B61',
                    600,
                    FONTS.sans,
                    'middle',
                    '.6'
                );

            output +=
                svgText(
                    center,
                    y + 48,
                    item[1],
                    15,
                    '#24211D',
                    500,
                    FONTS.mono,
                    'middle'
                );

        });

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * TOP 5
     * ========================================================== */

    function renderTopBox(
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
                x + 18,
                y + 27,
                title,
                15,
                color,
                700,
                FONTS.sans,
                'start',
                '.4'
            );

        output +=
            svgLine(
                x + 18,
                y + 43,
                x + width - 18,
                y + 43,
                '#E8E1D8',
                1
            );

        rows
            .slice(0, 5)
            .forEach(function (
                row,
                index
            ) {

                var yy =
                    y +
                    70 +
                    index *
                    43;

                output +=
                    svgCircle(
                        x + 27,
                        yy - 5,
                        10,
                        color
                    );

                output +=
                    svgText(
                        x + 27,
                        yy - 1,
                        String(
                            index + 1
                        ),
                        8,
                        '#FFFFFF',
                        700,
                        FONTS.mono,
                        'middle'
                    );

                output +=
                    svgText(
                        x + 48,
                        yy,
                        getTicker(row),
                        11,
                        '#24211D',
                        700,
                        FONTS.mono
                    );

                output +=
                    svgText(
                        x + width - 18,
                        yy,
                        formatPercent(
                            row.variation
                        ),
                        11,
                        color,
                        700,
                        FONTS.mono,
                        'end'
                    );

                output +=
                    svgText(
                        x + 48,
                        yy + 16,
                        getName(row),
                        9,
                        '#777',
                        500,
                        FONTS.sans
                    );

            });

        return output;
    }


    function renderTops(
        data,
        x,
        y,
        width
    ) {

        var height = 285;

        var gap = 12;

        var boxWidth =
            (
                width -
                gap
            ) / 2;

        var output =
            svgText(
                x,
                y,
                'VALEURS À SURVEILLER',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        if (
            data.gain.length &&
            data.loss.length
        ) {

            output +=
                renderTopBox(
                    x,
                    y,
                    boxWidth,
                    250,
                    'TOP 5 HAUSSES',
                    data.gain,
                    COLORS.greenDark
                );

            output +=
                renderTopBox(
                    x +
                    boxWidth +
                    gap,
                    y,
                    boxWidth,
                    250,
                    'TOP 5 BAISSES',
                    data.loss,
                    COLORS.redDark
                );

        } else if (data.gain.length) {

            output +=
                renderTopBox(
                    x,
                    y,
                    width,
                    250,
                    'TOP 5 HAUSSES',
                    data.gain,
                    COLORS.greenDark
                );

        } else if (data.loss.length) {

            output +=
                renderTopBox(
                    x,
                    y,
                    width,
                    250,
                    'TOP 5 BAISSES',
                    data.loss,
                    COLORS.redDark
                );

        }

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * OBLIGATAIRE
     * ========================================================== */

    function renderBonds(
        bond,
        x,
        y,
        width
    ) {

        var height = 110;

        var output =
            svgText(
                x,
                y,
                'MARCHÉ OBLIGATAIRE',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        output +=
            svgRect(
                x,
                y,
                width,
                72,
                '#FFF9F0',
                '#E8DFD0',
                11
            );

        var values = [
            [
                'CAPITALISATION',
                hasNumber(bond.cap)
                    ? compact(
                        bond.cap
                    ) + ' FCFA'
                    : '—'
            ],
            [
                'VALEUR ÉCHANGÉE',
                hasNumber(bond.value)
                    ? compact(
                        bond.value
                    ) + ' FCFA'
                    : '—'
            ],
            [
                'VOLUME ÉCHANGÉ',
                hasNumber(bond.volume)
                    ? formatNumber(
                        bond.volume
                    ) + ' titres'
                    : '—'
            ]
        ];

        var cellWidth =
            width / 3;

        values.forEach(function (
            item,
            index
        ) {

            var center =
                x +
                index *
                cellWidth +
                cellWidth / 2;

            output +=
                svgText(
                    center,
                    y + 26,
                    item[0],
                    9,
                    '#746B61',
                    600,
                    FONTS.sans,
                    'middle',
                    '.5'
                );

            output +=
                svgText(
                    center,
                    y + 51,
                    item[1],
                    13,
                    '#24211D',
                    500,
                    FONTS.mono,
                    'middle'
                );

        });

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * DIVIDENDES
     * ========================================================== */

    function renderDividends(
        data,
        x,
        y,
        width
    ) {

        var height = 140;

        var output =
            svgText(
                x,
                y,
                'DIVIDENDES À VENIR',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        output +=
            svgRect(
                x,
                y,
                width,
                100,
                '#FFF9F0',
                '#E8DFD0',
                11
            );

        data.dividends
            .slice(0, 4)
            .forEach(function (
                row,
                index
            ) {

                var yy =
                    y +
                    24 +
                    index *
                    20;

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
                        x + 18,
                        yy,
                        ticker,
                        10,
                        '#24211D',
                        700,
                        FONTS.mono
                    );

                output +=
                    svgText(
                        x + 120,
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
                        x + width - 18,
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

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * ACTUALITÉ
     * ========================================================== */

    function renderNews(
        note,
        x,
        y,
        width
    ) {

        var height = 130;

        var text =
            note &&
            note.trim()
                ? note.trim()
                : 'Séance BRVM du jour : évolution des indices, activité du marché et valeurs les plus marquantes.';

        var output =
            svgText(
                x,
                y,
                'ACTU DU JOUR',
                22,
                '#24211D',
                700,
                FONTS.serif
            );

        y += 25;

        output +=
            svgRect(
                x,
                y,
                width,
                92,
                '#FAF7F1',
                '#E8DFD0',
                11
            );

        var words =
            text.split(/\s+/);

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
                105
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
                line,
                index
            ) {

                output +=
                    svgText(
                        x + 18,
                        y +
                        27 +
                        index * 18,
                        11,
                        '#3F3A34',
                        500,
                        FONTS.sans
                    );

            });

        return {
            svg: output,
            height: height
        };
    }


    /* ============================================================
     * FOOTER
     * ========================================================== */

    function renderFooter(
        width,
        y
    ) {

        return {
            svg:
                svgText(
                    width / 2,
                    y,
                    'THE CAPITAL  ·  MARKET INTELLIGENCE',
                    9,
                    '#8A8177',
                    600,
                    FONTS.sans,
                    'middle',
                    '1'
                ),
            height: 30
        };
    }


    /* ============================================================
     * MOTEUR DE COMPOSITION DYNAMIQUE
     * ========================================================== */

    function buildSections(
        data,
        note,
        bond
    ) {

        var sections = [];

        /*
         * Chaque section est indépendante.
         *
         * enabled = affichage ou non
         * render   = génération
         * height   = hauteur calculée
         */

        if (STATE.sections.indices) {

            sections.push({
                id: 'indices',
                label: 'Indices BRVM',
                enabled:
                    STATE.mode === 'auto'
                        ? hasIndexData(data)
                        : true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderIndices(
                            data,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        if (STATE.sections.market) {

            sections.push({
                id: 'market',
                label: 'Marché actions',
                enabled:
                    STATE.mode === 'auto'
                        ? hasMarketData(data)
                        : true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderMarket(
                            data,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        if (STATE.sections.financials) {

            sections.push({
                id: 'financials',
                label: 'Indicateurs financiers',
                enabled:
                    STATE.mode === 'auto'
                        ? hasFinancialData(data)
                        : true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderFinancials(
                            data,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        /*
         * Les deux Tops peuvent être indépendants.
         *
         * Si les deux sont cochés, on les affiche ensemble.
         * Si un seul est disponible, le moteur peut quand même
         * afficher le Top disponible.
         */

        if (
            STATE.sections.gainers ||
            STATE.sections.losers
        ) {

            var topsEnabled =
                (
                    STATE.mode === 'auto'
                        ? (
                            hasGainers(data) ||
                            hasLosers(data)
                        )
                        : true
                );

            if (topsEnabled) {

                var topData = {
                    gain:
                        STATE.sections.gainers
                            ? data.gain
                            : [],

                    loss:
                        STATE.sections.losers
                            ? data.loss
                            : []
                };

                if (
                    topData.gain.length ||
                    topData.loss.length ||
                    STATE.mode === 'manual'
                ) {

                    sections.push({
                        id: 'tops',
                        label: 'Top 5',
                        enabled: true,
                        render:
                            function (
                                x,
                                y,
                                width
                            ) {
                                return renderTops(
                                    {
                                        gain:
                                            topData.gain,

                                        loss:
                                            topData.loss
                                    },
                                    x,
                                    y,
                                    width
                                );
                            }
                    });

                }

            }

        }

        if (STATE.sections.bonds) {

            /*
             * En mode automatique, le marché obligataire
             * n'est affiché que si l'utilisateur a renseigné
             * au moins une donnée.
             */

            var bondAvailable =
                hasNumber(bond.cap) ||
                hasNumber(bond.value) ||
                hasNumber(bond.volume);

            sections.push({
                id: 'bonds',
                label: 'Marché obligataire',
                enabled:
                    STATE.mode === 'auto'
                        ? bondAvailable
                        : true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderBonds(
                            bond,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        if (STATE.sections.dividends) {

            sections.push({
                id: 'dividends',
                label: 'Dividendes',
                enabled:
                    STATE.mode === 'auto'
                        ? hasDividendData(data)
                        : true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderDividends(
                            data,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        if (STATE.sections.news) {

            sections.push({
                id: 'news',
                label: 'Actualité',
                enabled: true,
                render:
                    function (
                        x,
                        y,
                        width
                    ) {
                        return renderNews(
                            note,
                            x,
                            y,
                            width
                        );
                    }
            });

        }

        return sections.filter(
            function (section) {
                return section.enabled;
            }
        );
    }


    /* ============================================================
     * CONSTRUCTION SVG COMPLÈTE
     * ========================================================== */

    function buildSVG(
        data,
        width,
        note,
        bond
    ) {

        var padding = 34;

        var contentWidth =
            width -
            padding * 2;

        /*
         * Header fixe.
         */

        var headerHeight = 250;

        /*
         * Construction dynamique.
         */

        var sections =
            buildSections(
                data,
                note,
                bond
            );

        /*
         * Première passe :
         * calcul des hauteurs.
         */

        var sectionResults =
            [];

        sections.forEach(
            function (
                section
            ) {

                var result =
                    section.render(
                        padding,
                        0,
                        contentWidth
                    );

                sectionResults.push({
                    section:
                        section,

                    height:
                        result.height,

                    svg:
                        result.svg
                });

            }
        );

        /*
         * Hauteur finale.
         */

        var totalHeight =
            headerHeight +
            34;

        sectionResults.forEach(
            function (
                result,
                index
            ) {

                totalHeight +=
                    result.height;

                if (
                    index <
                    sectionResults.length - 1
                ) {
                    totalHeight += GAP;
                }

            }
        );

        totalHeight += 40;

        STATE.height =
            Math.max(
                totalHeight,
                800
            );

        /*
         * SVG.
         */

        var svg =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<svg xmlns="http://www.w3.org/2000/svg"' +
            ' width="' + width + '"' +
            ' height="' + STATE.height + '"' +
            ' viewBox="0 0 ' +
            width +
            ' ' +
            STATE.height +
            '">' ;

        /*
         * Fond.
         */

        svg +=
            svgRect(
                0,
                0,
                width,
                STATE.height,
                COLORS.white,
                null,
                0
            );

        /*
         * Header.
         */

        svg +=
            drawHeader(
                width,
                data.date
            );

        /*
         * Sections.
         */

        var y =
            headerHeight +
            34;

        sectionResults.forEach(
            function (
                result,
                index
            ) {

                /*
                 * Le SVG du premier rendu avait y=0.
                 *
                 * On déplace tout le groupe avec transform.
                 */

                svg +=
                    '<g transform="translate(0,' +
                    y +
                    ')">' +
                    result.svg +
                    '</g>';

                y +=
                    result.height;

                if (
                    index <
                    sectionResults.length - 1
                ) {
                    y += GAP;
                }

            }
        );

        /*
         * Footer.
         */

        svg +=
            renderFooter(
                width,
                STATE.height - 18
            ).svg;

        svg += '</svg>';

        return svg;
    }


    /* ============================================================
     * EXPORT IMAGE
     * ========================================================== */

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

            return await new Promise(
                function (
                    resolve,
                    reject
                ) {

                    canvas.toBlob(
                        function (blob) {

                            if (!blob) {

                                reject(
                                    new Error(
                                        'Export impossible.'
                                    )
                                );

                                return;
                            }

                            resolve(blob);

                        },
                        type,
                        0.96
                    );

                }
            );

        } finally {

            URL.revokeObjectURL(
                svgUrl
            );

        }
    }


    /* ============================================================
     * TÉLÉCHARGEMENT
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

            var pdf =
                new PDF({
                    orientation:
                        STATE.width >= STATE.height
                            ? 'landscape'
                            : 'portrait',

                    unit: 'mm',

                    format: 'a4'
                });

            var pageWidth =
                pdf.internal.pageSize.getWidth();

            var pageHeight =
                pdf.internal.pageSize.getHeight();

            var ratio =
                Math.min(
                    pageWidth /
                    STATE.width,

                    pageHeight /
                    STATE.height
                );

            var imageWidth =
                STATE.width *
                ratio;

            var imageHeight =
                STATE.height *
                ratio;

            var offsetX =
                (
                    pageWidth -
                    imageWidth
                ) / 2;

            var offsetY =
                (
                    pageHeight -
                    imageHeight
                ) / 2;

            pdf.addImage(
                dataUrl,
                'PNG',
                offsetX,
                offsetY,
                imageWidth,
                imageHeight,
                undefined,
                'FAST'
            );

            pdf.save(
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
     * INTERFACE
     * ========================================================== */

    function showMessage(
        message,
        type
    ) {

        var element =
            document.getElementById(
                'seance-msg'
            );

        if (!element) {
            return;
        }

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

    function getSectionLabels() {

        return {
            indices:
                'Indices BRVM',

            market:
                'Marché actions',

            financials:
                'Indicateurs financiers',

            gainers:
                'Top 5 hausses',

            losers:
                'Top 5 baisses',

            bonds:
                'Marché obligataire',

            dividends:
                'Dividendes',

            news:
                'Actualité du jour'
        };
    }

    function renderSectionControls() {

        var container =
            document.getElementById(
                'seance-section-controls'
            );

        if (!container) {
            return;
        }

        var labels =
            getSectionLabels();

        var html = '';

        Object.keys(labels)
            .forEach(function (
                key
            ) {

                var checked =
                    STATE.sections[key]
                        ? 'checked'
                        : '';

                html +=
                    '<label class="seance-check">' +
                        '<input ' +
                            'type="checkbox" ' +
                            'data-section="' +
                            key +
                            '" ' +
                            checked +
                        '>' +
                        '<span>' +
                            esc(labels[key]) +
                        '</span>' +
                    '</label>';

            });

        container.innerHTML =
            html;

        container
            .querySelectorAll(
                'input[data-section]'
            )
            .forEach(function (
                checkbox
            ) {

                checkbox.addEventListener(
                    'change',
                    function () {

                        var key =
                            checkbox.dataset.section;

                        STATE.sections[key] =
                            checkbox.checked;

                        /*
                         * Une modification manuelle
                         * fait passer le générateur
                         * en mode manuel.
                         */

                        STATE.mode =
                            'manual';

                        updateModeButtons();

                        if (
                            STATE.data
                        ) {
                            generatePreview();
                        }

                    }
                );

            });
    }

    function updateModeButtons() {

        var auto =
            document.getElementById(
                'seance-mode-auto'
            );

        var manual =
            document.getElementById(
                'seance-mode-manual'
            );

        if (auto) {
            auto.classList.toggle(
                'active',
                STATE.mode === 'auto'
            );
        }

        if (manual) {
            manual.classList.toggle(
                'active',
                STATE.mode === 'manual'
            );
        }
    }

    function setAutomaticMode() {

        STATE.mode =
            'auto';

        if (STATE.data) {

            STATE.sections =
                autoDetectSections(
                    STATE.data,
                    STATE.sections
                );

        }

        renderSectionControls();

        updateModeButtons();

        if (STATE.data) {
            generatePreview();
        }
    }

    function setManualMode() {

        STATE.mode =
            'manual';

        renderSectionControls();

        updateModeButtons();
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
                                    'placeholder="Commentaire de marché du jour...">' +
                                '</textarea>' +

                            '</div>' +

                        '</div>' +

                        '<div class="seance-config">' +

                            '<div class="seance-config-title">' +
                                'Sections du visuel' +
                            '</div>' +

                            '<div class="seance-mode">' +

                                '<button ' +
                                    'type="button" ' +
                                    'id="seance-mode-auto" ' +
                                    'class="seance-mode-btn active">' +
                                    'Automatique' +
                                '</button>' +

                                '<button ' +
                                    'type="button" ' +
                                    'id="seance-mode-manual" ' +
                                    'class="seance-mode-btn">' +
                                    'Manuel' +
                                '</button>' +

                            '</div>' +

                            '<div ' +
                                'id="seance-section-controls" ' +
                                'class="seance-section-controls">' +
                            '</div>' +

                            '<div class="seance-config-help">' +
                                'En mode automatique, les sections sans données sont masquées. ' +
                                'En mode manuel, tu peux choisir exactement ce qui doit apparaître. ' +
                                'La mise en page se réorganise automatiquement.' +
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
         * Date.
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
         * Contrôles.
         */

        renderSectionControls();

        document
            .getElementById(
                'seance-mode-auto'
            )
            .addEventListener(
                'click',
                setAutomaticMode
            );

        document
            .getElementById(
                'seance-mode-manual'
            )
            .addEventListener(
                'click',
                setManualMode
            );

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
         * CSS dédié.
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
     * GÉNÉRATION APERÇU
     * ========================================================== */

    function generatePreview() {

        if (!STATE.data) {
            return;
        }

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
    }


    /* ============================================================
     * CHARGEMENT PRINCIPAL
     * ========================================================== */

    async function loadSeance() {

        injectInterface();

        showMessage(
            'Chargement des données BRVM…',
            'info'
        );

        try {

            /*
             * Logo avant génération.
             */

            await loadLogoDataUri();

            var date =
                document
                    .getElementById(
                        'seance-date'
                    )
                    .value;

            STATE.data =
                await getData(
                    date
                );

            /*
             * Mode automatique :
             * masquer automatiquement ce qui
             * n'a pas de données.
             */

            if (
                STATE.mode ===
                'auto'
            ) {

                STATE.sections =
                    autoDetectSections(
                        STATE.data,
                        STATE.sections
                    );

            }

            renderSectionControls();

            updateModeButtons();

            generatePreview();

            if (
                !STATE.logoDataUri
            ) {

                showMessage(
                    'Séance générée, mais le logo n’a pas pu être chargé. Vérifie LOGO_PATH.',
                    'error'
                );

            } else {

                showMessage(
                    '✓ Séance générée avec composition dynamique.',
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
     * EXPORT GLOBAL
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
