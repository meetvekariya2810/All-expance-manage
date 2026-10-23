import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { formatINR } from '../utils/constants';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler
);

const PALETTE = [
  '#2563eb', // Blue (e.g. Electricity)
  '#10b981', // Green (e.g. Water)
  '#f59e0b', // Amber/Orange (e.g. Food)
  '#8b5cf6', // Violet (e.g. Grocery)
  '#06b6d4', // Cyan (e.g. Misc)
  '#a78bfa', // Lavender (e.g. Others)
  '#ec4899',
  '#f43f5e'
];

export function CategoryDoughnutChart({ data = {}, total = null }) {
  const entries = Object.entries(data);
  const totalAmount = total !== null ? total : entries.reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);

  // Sort descending by amount
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const topCategories = sorted.slice(0, 5);
  const othersAmount = sorted.slice(5).reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);

  if (othersAmount > 0) {
    topCategories.push(['Others', othersAmount]);
  }

  const labels = topCategories.map(([cat]) => cat);
  const values = topCategories.map(([, val]) => val);
  const hasData = values.some(v => v > 0);

  const chartData = {
    labels: hasData ? labels : ['No Expense Recorded'],
    datasets: [
      {
        data: hasData ? values : [1],
        backgroundColor: hasData ? PALETTE.slice(0, labels.length) : ['#cbd5e1'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (!hasData) return 'No data';
            const val = context.raw || 0;
            const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : '0.0';
            return ` ${context.label}: ${formatINR(val)} (${pct}%)`;
          }
        }
      }
    },
    cutout: '72%'
  };

  return (
    <div className="d-flex align-items-center justify-content-between h-100 flex-wrap gap-2">
      {/* Donut Chart with Centered Overlay */}
      <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0, margin: '0 auto' }}>
        <Doughnut data={chartData} options={options} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            lineHeight: 1.15
          }}
        >
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
            {formatINR(totalAmount)}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
            Total Spent
          </span>
        </div>
      </div>

      {/* Styled Legend on Right matching Screenshot */}
      <div className="flex-grow-1 ps-2" style={{ minWidth: '150px', maxWidth: '100%' }}>
        {hasData ? (
          <ul className="list-unstyled mb-0" style={{ fontSize: '0.78rem' }}>
            {topCategories.map(([cat, val], idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : '0.0';
              return (
                <li key={cat} className="d-flex align-items-center justify-content-between py-1">
                  <div className="d-flex align-items-center gap-2 text-truncate me-2" style={{ maxWidth: '120px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        flexShrink: 0
                      }}
                    />
                    <span className="text-truncate" style={{ color: 'var(--text-main, #334155)', fontWeight: 500 }} title={cat}>
                      {cat}
                    </span>
                  </div>
                  <span className="fw-semibold" style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.75rem' }}>
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-muted small py-3 text-center">No categories to display</div>
        )}
      </div>
    </div>
  );
}

export function MonthlyTrendLineChart({ data = {} }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Map monthly data to 12 months array
  const currentYear = new Date().getFullYear();
  const values = months.map((m, idx) => {
    const monthKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
    return data[monthKey] || (data[m] || 0);
  });

  const chartData = {
    labels: months,
    datasets: [
      {
        label: 'Expense',
        data: values,
        borderColor: '#2563eb',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 220);
          gradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
          gradient.addColorStop(1, 'rgba(37, 99, 235, 0.00)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 8,
        titleFont: { size: 11, family: 'Plus Jakarta Sans' },
        bodyFont: { size: 11, family: 'Plus Jakarta Sans', weight: 'bold' },
        callbacks: {
          label: (context) => ` ₹${(context.raw || 0).toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            if (value >= 100000) return `₹${value / 100000}L`;
            if (value >= 1000) return `₹${value / 1000}k`;
            return `₹${value}`;
          },
          font: { family: 'Plus Jakarta Sans', size: 9 },
          color: '#94a3b8'
        },
        grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 9 }, color: '#94a3b8' }
      }
    }
  };

  return <Line data={chartData} options={options} />;
}

export function PaymentMethodChart({ data = {} }) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const hasData = values.some(v => v > 0);

  const chartData = {
    labels: hasData ? labels : ['No Data'],
    datasets: [
      {
        data: hasData ? values : [1],
        backgroundColor: hasData ? ['#10b981', '#2563eb', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'] : ['#cbd5e1'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, padding: 8, font: { family: 'Plus Jakarta Sans', size: 11 } }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${formatINR(context.raw || 0)}`
        }
      }
    },
    cutout: '55%'
  };

  return <Doughnut data={chartData} options={options} />;
}

export function DailySpendingChart({ data = {} }) {
  const labels = Object.keys(data).sort();
  const values = labels.map(d => data[d] || 0);

  const chartData = {
    labels: labels.map(d => d.slice(-5)),
    datasets: [
      {
        label: 'Daily Spend (₹)',
        data: values,
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { grid: { display: false } }
    }
  };

  return <Bar data={chartData} options={options} />;
}

export function UserComparisonChart({ data = {} }) {
  const labels = Object.keys(data);
  const values = Object.values(data);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Total Expenses',
        data: values,
        backgroundColor: '#2563eb',
        borderRadius: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { grid: { display: false } }
    }
  };

  return <Bar data={chartData} options={options} />;
}

export function FundsVsExpensesChart({ funds = 0, expenses = 0 }) {
  const chartData = {
    labels: ['Total Funds (In)', 'Total Expenses (Out)'],
    datasets: [
      {
        data: [funds, expenses],
        backgroundColor: ['#10b981', '#ef4444'],
        borderRadius: 8,
        barThickness: 45
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Amount: ${formatINR(ctx.raw || 0)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₹' + value.toLocaleString('en-IN'),
          font: { family: 'Plus Jakarta Sans', size: 10 }
        },
        grid: { color: 'rgba(0,0,0,0.04)' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
}
