/* THE CAPITAL — dashboard chart runtime
 *
 * Restores the Overview BRVM Composite chart from the application's real
 * index-history dataset. No synthetic values, dates or fallback series are
 * generated. The runtime only waits for Chart.js/data when an earlier
 * renderer ran too soon.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_CHART_RUNTIME__) return;
  w.__TC_DASHBOARD_CHART_RUNTIME__ = true;

  var timer = 0;
  var period = 30;

  function arr(v) { return Array.isArray(v) ? v : []; }
  function norm(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function finite(v) { var n = Number(v); return Number.isFinite(n) ? n : null; }
  function compositeRows() {
    var source = arr(w.allIndicesHistory);
    if (!source.length) source = arr(w.allIndices);
    var names = ['BRVM C', 'BRVM Composite', 'BRVM-COMPOSITE', 'BRVM COMPOSITE', 'COMPOSITE'];
    var wanted = names.map(norm);
    return source.filter(function (row) {
      return row && row.indice && wanted.indexOf(norm(row.indice)) !== -1 &&
        row.date_seance && finite(row.valeur) != null;
    }).sort(function (a, b) {
      return new Date(a.date_seance).getTime() - new Date(b.date_seance).getTime();
    }).slice(-period);
  }

  function ensureCanvas() {
    var canvas = d.getElementById('chartComposite');
    if (!canvas) return null;
    var box = canvas.parentElement;
    if (box) {
      box.style.position = 'relative';
      box.style.height = '340px';
      box.style.minHeight = '340px';
      box.style.width = '100%';
    }
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'crosshair';
    return canvas;
  }

  function draw() {
    var canvas = ensureCanvas();
    if (!canvas) return false;

    if (!w.Chart) return false;
    var rows = compositeRows();
    if (rows.length < 2) return false;

    if (w.compositeChartInst && typeof w.compositeChartInst.destroy === 'function') {
      try { w.compositeChartInst.destroy(); } catch (_) {}
      w.compositeChartInst = null;
    }

    var labels = rows.map(function (row) {
      return new Date(row.date_seance).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    });
    var values = rows.map(function (row) { return Number(row.valeur); });

    var crosshair = {
      id: 'tcCompositeCrosshair',
      afterDraw: function (chart) {
        var active = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
        if (!active || !active.length) return;
        var x = active[0].element.x;
        var area = chart.chartArea;
        var ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, area.top);
        ctx.lineTo(x, area.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(184,150,78,.55)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    };

    try {
      w.compositeChartInst = new w.Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'BRVM Composite',
            data: values,
            borderColor: '#B8964E',
            backgroundColor: 'rgba(184,150,78,.10)',
            borderWidth: 2,
            fill: true,
            tension: .28,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#B8964E',
            pointHoverBorderColor: '#F5F0E8',
            pointHoverBorderWidth: 2
          }]
        },
        plugins: [crosshair],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          hover: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              displayColors: false,
              callbacks: {
                title: function (items) {
                  return items && items[0] ? items[0].label : '';
                },
                label: function (ctx) {
                  return 'BRVM Composite : ' + Number(ctx.parsed.y).toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) + ' pts';
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(184,150,78,.05)' },
              ticks: {
                color: 'rgba(245,240,232,.45)',
                font: { size: 10, family: 'DM Mono' },
                maxTicksLimit: 8
              }
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(184,150,78,.07)' },
              ticks: {
                color: 'rgba(245,240,232,.45)',
                font: { size: 10, family: 'DM Mono' },
                callback: function (value) {
                  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
                }
              }
            }
          }
        }
      });
      return true;
    } catch (error) {
      console.error('[DASHBOARD CHART] Impossible de créer le graphique BRVM Composite:', error);
      return false;
    }
  }

  function schedule(reason) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (draw()) return;
      if (!w.allIndicesHistory || !w.allIndicesHistory.length) {
        if (typeof w.loadIndexHistory === 'function') {
          Promise.resolve(w.loadIndexHistory()).then(function () { schedule('history-ready'); }).catch(function (error) {
            console.warn('[DASHBOARD CHART] Historique indisponible:', error);
          });
        }
      } else if (!w.Chart) {
        setTimeout(function () { schedule('chartjs-ready'); }, 150);
      }
    }, reason === 'load' ? 120 : 40);
  }

  w.setDashboardCompositePeriod = function (days) {
    var value = Number(days);
    if (!Number.isFinite(value) || value < 2) return;
    period = Math.min(Math.floor(value), 90);
    schedule('period');
  };

  w.addEventListener('tc:dataready', function () { schedule('dataready'); });
  w.addEventListener('load', function () { schedule('load'); });
  w.addEventListener('resize', function () { schedule('resize'); });
  w.addEventListener('hashchange', function () {
    var view = d.getElementById('view-overview');
    if (view && view.classList.contains('active')) schedule('navigation');
  });

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () { schedule('dom'); }, { once: true });
  } else {
    schedule('dom');
  }
})(window, document);
