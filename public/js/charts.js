/* ==========================================================================
   CHART.JS VISUALIZATION CONTROLLER
   ========================================================================== */

const ChartManager = {
  categoryChart: null,
  trendChart: null,
  comparisonChart: null,

  initCategoryChart(ctx, categoryData) {
    if (this.categoryChart) this.categoryChart.destroy();

    const labels = Object.keys(categoryData || {});
    const data = Object.values(categoryData || {});

    const colors = [
      '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', 
      '#f43f5e', '#06b6d4', '#ec4899', '#6366f1',
      '#14b8a6', '#84cc16', '#a855f7', '#64748b'
    ];

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: colors.slice(0, labels.length || 1),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans' } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ₹${context.raw.toLocaleString()}`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  initTrendChart(ctx, trendData) {
    if (this.trendChart) this.trendChart.destroy();

    const labels = Object.keys(trendData || {});
    const data = Object.values(trendData || {});

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Current Month'],
        datasets: [{
          label: 'Monthly Expense (₹)',
          data: data.length ? data : [0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.5)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  initComparisonChart(ctx, userTotals) {
    if (this.comparisonChart) this.comparisonChart.destroy();

    const labels = Object.keys(userTotals || {});
    const data = Object.values(userTotals || {});

    this.comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['User A', 'User B'],
        datasets: [{
          label: 'Total Expenses (₹)',
          data: data.length ? data : [0, 0],
          backgroundColor: ['#2563eb', '#10b981'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } }
        }
      }
    });
  }
};
