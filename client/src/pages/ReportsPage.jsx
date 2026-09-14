import React, { useState, useEffect } from 'react';
import { reportService } from '../services/reportService';
import { useToast } from '../context/ToastContext';
import { formatINR } from '../utils/constants';
import StatCard from '../components/StatCard';

export default function ReportsPage() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

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
    showToast(`Preparing ${type.toUpperCase()} download...`, 'info');
    try {
      await reportService.downloadExport(type);
      showToast(`${type.toUpperCase()} statement downloaded successfully!`, 'success');
    } catch (err) {
      showToast('Export failed. ' + (err.message || ''), 'error');
    }
  };

  const categoryBreakdown = metrics?.categoryBreakdown || {};
  const monthlyTrend = metrics?.monthlyTrend || {};
  const totalSpend = metrics?.totalSpending || 0;

  return (
    <div className="view-container active">
      {/* Title box */}
      <div className="page-title-box">
        <div>
          <h3>Reports & Analytics Center</h3>
          <p>Export formal statements to PDF, Excel (.xlsx), or CSV</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
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

      {/* Quick Metrics Grid */}
      <div className="stats-grid mb-4">
        <StatCard
          title="Total Expenditure"
          value={formatINR(metrics?.totalSpending)}
          subtitle={`${metrics?.totalTransactions || 0} transactions`}
          icon="fa-sack-dollar"
          color="primary"
        />

        <StatCard
          title="Average / Txn"
          value={formatINR(metrics?.averageSpending)}
          subtitle="Mean spend per record"
          icon="fa-calculator"
          color="info"
        />

        <StatCard
          title="Highest Txn"
          value={formatINR(metrics?.highestExpense)}
          subtitle="Peak single expenditure"
          icon="fa-arrow-trend-up"
          color="danger"
        />

        <StatCard
          title="Lowest Txn"
          value={formatINR(metrics?.lowestExpense)}
          subtitle="Minimum expenditure"
          icon="fa-arrow-trend-down"
          color="success"
        />
      </div>

      {/* Report Breakdown Tables */}
      <div className="row g-4">
        {/* Spending by Category Table */}
        <div className="col-lg-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-tags me-2 text-primary"></i> Spending by Category
            </h5>
            <div className="table-glass-container">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-end">Total Amount</th>
                    <th className="text-end">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(categoryBreakdown).length > 0 ? (
                    Object.entries(categoryBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => {
                        const pct = totalSpend > 0 ? Math.round((amt / totalSpend) * 100) : 0;
                        return (
                          <tr key={cat}>
                            <td className="fw-semibold">{cat}</td>
                            <td className="text-end fw-bold text-primary">{formatINR(amt)}</td>
                            <td className="text-end">
                              <span className="badge bg-light text-dark border">{pct}%</span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-muted">
                        No category data recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown Table */}
        <div className="col-lg-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-calendar-days me-2 text-purple"></i> Monthly Breakdown
            </h5>
            <div className="table-glass-container">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-end">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(monthlyTrend).length > 0 ? (
                    Object.entries(monthlyTrend)
                      .sort((a, b) => (b[0] > a[0] ? 1 : -1))
                      .map(([m, amt]) => (
                        <tr key={m}>
                          <td className="fw-semibold">{m}</td>
                          <td className="text-end fw-bold text-purple">{formatINR(amt)}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="text-center py-4 text-muted">
                        No monthly trend data recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
