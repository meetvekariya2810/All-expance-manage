import React, { useState, useEffect } from 'react';
import { reportService } from '../services/reportService';
import { useToast } from '../context/ToastContext';
import { formatINR } from '../utils/constants';
import StatCard from '../components/StatCard';

export default function ReportsPage() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportEntity, setExportEntity] = useState('expenses'); // expenses, funds, settlements

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await reportService.getSummaryMetrics();
        if (data.success) {
          setMetrics(data.metrics);
        }
      } catch (err) {
        showToast('Error loading financial reports.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [showToast]);

  const handleExport = async (type) => {
    const entityLabel = exportEntity === 'funds' ? 'Funds' : (exportEntity === 'settlements' ? 'Settlements' : 'Expenses');
    showToast(`Preparing ${entityLabel} ${type.toUpperCase()} download...`, 'info');
    try {
      await reportService.downloadExport(type, { entity: exportEntity });
      showToast(`${entityLabel} ${type.toUpperCase()} statement downloaded successfully!`, 'success');
    } catch (err) {
      showToast('Export failed. ' + (err.message || ''), 'error');
    }
  };

  const categoryBreakdown = metrics?.categoryBreakdown || {};
  const fundsByPerson = metrics?.fundsByPerson || {};
  const monthlyTrend = metrics?.monthlyTrend || {};
  const totalSpend = metrics?.totalSpending || 0;
  const totalFunds = metrics?.totalFunds || 0;

  return (
    <div className="view-container active">
      {/* Title box */}
      <div className="page-title-box">
        <div>
          <h3>Reports & Financial Statements</h3>
          <p>Export authoritative financial statements for Expenses, Funds, and Settlements</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {/* Entity Selector */}
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${exportEntity === 'expenses' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
              onClick={() => setExportEntity('expenses')}
            >
              Expenses
            </button>
            <button
              type="button"
              className={`btn ${exportEntity === 'funds' ? 'btn-success-custom text-white' : 'btn-secondary-custom'}`}
              onClick={() => setExportEntity('funds')}
              style={exportEntity === 'funds' ? { background: '#10b981', borderColor: '#10b981' } : {}}
            >
              Funds In
            </button>
            <button
              type="button"
              className={`btn ${exportEntity === 'settlements' ? 'btn-indigo-custom text-white' : 'btn-secondary-custom'}`}
              onClick={() => setExportEntity('settlements')}
              style={exportEntity === 'settlements' ? { background: '#6366f1', borderColor: '#6366f1' } : {}}
            >
              Settlements
            </button>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-secondary-custom" onClick={() => handleExport('pdf')}>
              <i className="fa-solid fa-file-pdf text-danger me-1"></i> PDF
            </button>
            <button className="btn btn-secondary-custom" onClick={() => handleExport('excel')}>
              <i className="fa-solid fa-file-excel text-success me-1"></i> Excel
            </button>
            <button className="btn btn-secondary-custom" onClick={() => handleExport('csv')}>
              <i className="fa-solid fa-file-csv text-primary me-1"></i> CSV
            </button>
            <button className="btn btn-secondary-custom" onClick={() => window.print()}>
              <i className="fa-solid fa-print me-1"></i> Print
            </button>
          </div>
        </div>
      </div>

      {/* Core Balance Summary Card */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="stat-card glass-card h-100 p-3" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Funds (Money In)</div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
              +{formatINR(totalFunds)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {metrics?.totalFundTransactions || 0} deposit entries
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="stat-card glass-card h-100 p-3" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Expenses (Money Out)</div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>
              -{formatINR(totalSpend)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {metrics?.totalTransactions || 0} total transactions
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="stat-card glass-card h-100 p-3" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Available Balance</div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.75rem', fontWeight: 800, color: (metrics?.availableBalance || 0) >= 0 ? '#3b82f6' : '#ef4444' }}>
              {formatINR(metrics?.availableBalance || 0)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Funds - Expenses
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="stats-grid mb-4">
        <StatCard
          title="Average Spend / Txn"
          value={formatINR(metrics?.averageSpending)}
          subtitle="Mean spend per record"
          icon="fa-calculator"
          color="info"
        />

        <StatCard
          title="Highest Single Spend"
          value={formatINR(metrics?.highestExpense)}
          subtitle="Peak single expenditure"
          icon="fa-arrow-trend-up"
          color="danger"
        />

        <StatCard
          title="Settlements Paid"
          value={formatINR(metrics?.settlements?.totalPaid || 0)}
          subtitle="Total paid out"
          icon="fa-arrow-up-right"
          color="warning"
        />

        <StatCard
          title="Settlements Received"
          value={formatINR(metrics?.settlements?.totalReceived || 0)}
          subtitle="Total received in"
          icon="fa-arrow-down-left"
          color="success"
        />
      </div>

      {/* Breakdown Grids */}
      <div className="row g-4 mb-4">
        {/* Category Breakdown */}
        <div className="col-md-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-layer-group text-primary"></i> Expense Category Breakdown
            </h5>
            <div className="category-breakdown-list">
              {Object.keys(categoryBreakdown).length > 0 ? (
                Object.entries(categoryBreakdown).map(([category, amount]) => {
                  const percentage = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;
                  return (
                    <div key={category} className="mb-3">
                      <div className="d-flex justify-content-between mb-1 small">
                        <span className="fw-semibold">{category}</span>
                        <span>{formatINR(amount)} ({percentage}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)' }}>
                        <div
                          className="progress-bar bg-primary"
                          role="progressbar"
                          style={{ width: `${percentage}%` }}
                          aria-valuenow={percentage}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted text-center py-4">No categories recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Funds by Person Breakdown */}
        <div className="col-md-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-hand-holding-dollar text-success"></i> Funds by Contributor
            </h5>
            <div className="category-breakdown-list">
              {Object.keys(fundsByPerson).length > 0 ? (
                Object.entries(fundsByPerson).map(([person, amount]) => {
                  const percentage = totalFunds > 0 ? Math.round((amount / totalFunds) * 100) : 0;
                  return (
                    <div key={person} className="mb-3">
                      <div className="d-flex justify-content-between mb-1 small">
                        <span className="fw-semibold text-white">{person}</span>
                        <span className="text-success font-monospace">+{formatINR(amount)} ({percentage}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)' }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${percentage}%` }}
                          aria-valuenow={percentage}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted text-center py-4">No fund deposits recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
