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
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
  '#f43f5e', '#06b6d4', '#ec4899', '#6366f1',
  '#14b8a6', '#84cc16', '#a855f7', '#64748b',
  '#f97316', '#0ea5e9', '#d946ef', '#e11d48'
];

export function CategoryDoughnutChart({ data = {} }) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const hasData = values.some(v => v > 0);

  const chartData = {
    labels: hasData ? labels : ['No Expense Recorded'],
    datasets: [
      {
        data: hasData ? values : [1],
        backgroundColor: hasData ? PALETTE.slice(0, labels.length) : ['#cbd5e1'],
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
        labels: {
          boxWidth: 10,
          padding: 8,
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (!hasData) return 'No data available';
            const total = values.reduce((a, b) => a + b, 0);
            const val = context.raw || 0;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return `${context.label}: ${formatINR(val)} (${pct}%)`;
          }
        }
      }
    },
    cutout: '65%'
  };

  return <Doughnut data={chartData} options={options} />;
}

export function MonthlyTrendLineChart({ data = {} }) {
  const sortedMonths = Object.keys(data).sort();
  const values = sortedMonths.map(m => data[m] || 0);
  const hasData = values.some(v => v > 0);

  const chartData = {
    labels: sortedMonths.length ? sortedMonths : ['Current Month'],
    datasets: [
      {
        label: 'Monthly Expense (₹)',
        data: sortedMonths.length ? values : [0],
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#2563eb'
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
          label: (context) => `Total: ${formatINR(context.raw || 0)}`
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
        ticks: { font: { family: 'Plus Jakarta Sans', size: 10 } }
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
        labels: {
          boxWidth: 10,
          padding: 8,
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
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
    labels: labels.map(d => d.slice(-5)), // Show MM-DD
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
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0] ? `Date: ${labels[items[0].dataIndex]}` : '',
          label: (context) => `Spent: ${formatINR(context.raw || 0)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (val) => '₹' + val,
          font: { family: 'Plus Jakarta Sans', size: 10 }
        },
        grid: { color: 'rgba(0,0,0,0.04)' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
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
        label: 'Total Spending (₹)',
        data: values,
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'],
        borderRadius: 6
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
          label: (context) => `Total: ${formatINR(context.raw || 0)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (val) => '₹' + val.toLocaleString('en-IN'),
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

export function FundsVsExpensesChart({ funds = 0, expenses = 0 }) {
  const chartData = {
    labels: ['Total Funds (Money In)', 'Total Expenses (Money Out)'],
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
          label: (context) => `${context.label}: ${formatINR(context.raw || 0)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (val) => '₹' + val.toLocaleString('en-IN'),
          font: { family: 'Plus Jakarta Sans', size: 10 }
        },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
}
