/* ==========================================================================
   CHART.JS VISUALIZATION CONTROLLER
   ========================================================================== */

const ChartManager = {
  categoryChart: null,
  trendChart: null,
  comparisonChart: null,
  paymentChart: null,
  dailyChart: null,

  destroyAll() {
    if (this.categoryChart) { this.categoryChart.destroy(); this.categoryChart = null; }
    if (this.trendChart) { this.trendChart.destroy(); this.trendChart = null; }
    if (this.comparisonChart) { this.comparisonChart.destroy(); this.comparisonChart = null; }
    if (this.paymentChart) { this.paymentChart.destroy(); this.paymentChart = null; }
    if (this.dailyChart) { this.dailyChart.destroy(); this.dailyChart = null; }
  },

  initCategoryChart(ctx, categoryData) {
    if (this.categoryChart) this.categoryChart.destroy();

    const labels = Object.keys(categoryData || {});
    const data = Object.values(categoryData || {});

    const colors = [
      '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', 
      '#f43f5e', '#06b6d4', '#ec4899', '#6366f1',
      '#14b8a6', '#84cc16', '#a855f7', '#64748b',
      '#f97316', '#0ea5e9', '#d946ef', '#e11d48'
    ];

    const hasData = data.some(v => v > 0);

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? labels : ['No Expenses Recorded'],
        datasets: [{
          data: hasData ? data : [1],
          backgroundColor: hasData ? colors.slice(0, labels.length) : ['#cbd5e1'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom', 
            labels: { 
              boxWidth: 10, 
              padding: 10,
              font: { family: 'Plus Jakarta Sans', size: 11 } 
            } 
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (!hasData) return 'No data available';
                const total = data.reduce((a, b) => a + b, 0);
                const val = context.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return `${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  },

  initTrendChart(ctx, trendData) {
    if (this.trendChart) this.trendChart.destroy();

    const labels = Object.keys(trendData || {}).sort();
    const data = labels.map(m => trendData[m] || 0);

    const hasData = data.some(v => v > 0);

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Current Month'],
        datasets: [{
          label: 'Monthly Expense (₹)',
          data: labels.length ? data : [0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Spent: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.4)' },
            ticks: {
              callback: (v) => '₹' + v.toLocaleString('en-IN')
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  initPaymentChart(ctx, paymentData) {
    if (this.paymentChart) this.paymentChart.destroy();

    const labels = Object.keys(paymentData || {});
    const data = Object.values(paymentData || {});
    const hasData = data.some(v => v > 0);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    this.paymentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? labels : ['No Data'],
        datasets: [{
          data: hasData ? data : [1],
          backgroundColor: hasData ? colors.slice(0, labels.length) : ['#cbd5e1'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 8, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`
            }
          }
        },
        cutout: '60%'
      }
    });
  },

  initDailyChart(ctx, dailyData) {
    if (this.dailyChart) this.dailyChart.destroy();

    const days = [];
    for (let i = 1; i <= 31; i++) {
      const dayStr = i < 10 ? '0' + i : '' + i;
      days.push(dayStr);
    }

    const data = days.map(d => (dailyData && dailyData[d]) ? dailyData[d] : 0);

    this.dailyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Daily Spending (₹)',
          data: data,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Day ${ctx.label}: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => '₹' + v.toLocaleString('en-IN') }
          },
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 16 }
          }
        }
      }
    });
  },

  initComparisonChart(ctx, userTotals) {
    if (this.comparisonChart) this.comparisonChart.destroy();

    const labels = Object.keys(userTotals || {});
    const data = Object.values(userTotals || {});

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    this.comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Users'],
        datasets: [{
          label: 'Total Expenses (₹)',
          data: labels.length ? data : [0],
          backgroundColor: colors.slice(0, labels.length || 1),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => '₹' + v.toLocaleString('en-IN') }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }
};
