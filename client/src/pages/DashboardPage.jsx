import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { activityService } from '../services/activityService';
import { formatINR, formatDate } from '../utils/constants';
import StatCard from '../components/StatCard';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import {
  CategoryDoughnutChart,
  MonthlyTrendLineChart,
  PaymentMethodChart,
  DailySpendingChart,
  UserComparisonChart
} from '../components/Charts';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [selectedUserScope, setSelectedUserScope] = useState('all');
  const [metrics, setMetrics] = useState(null);
  const [usersSummary, setUsersSummary] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (isAdmin && selectedUserScope !== 'all') {
        params.person = selectedUserScope;
      }
      const data = await reportService.getSummaryMetrics(params);
      if (data.success) {
        setMetrics(data.metrics);
      }

      if (isAdmin) {
        const uData = await userService.getUsers();
        if (uData.success) {
          setUsersSummary(uData.users || []);
        }
      }

      // Fetch recent activity
      const actParams = { limit: 6 };
      if (isAdmin && selectedUserScope !== 'all') {
        actParams.user = selectedUserScope;
      }
      const actData = await activityService.getActivities(actParams);
      if (actData.success) {
        setRecentActivities(actData.activities || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedUserScope]);

  useEffect(() => {
    fetchDashboardData();

    const handleRefresh = () => fetchDashboardData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchDashboardData]);

  // Specific user data helpers
  const getUserStat = (username) => {
    return usersSummary.find(u => u.username === username) || {
      name: username,
      totalSpent: 0,
      transactionCount: 0,
      thisMonthSpent: 0
    };
  };

  const bhavikStat = getUserStat('bhavik');
  const meetStat = getUserStat('meet');
  const harshStat = getUserStat('harsh');

  return (
    <div className="view-container active">
      {/* Page Title & Profile Header */}
      <div className="page-title-box">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h3 id="dashboardTitle" className="mb-0">
              {isAdmin
                ? `Admin Dashboard Overview - ${user?.name || 'Bhavik Bhai'}`
                : `Personal Dashboard - Welcome ${user?.name || 'Member'}`}
            </h3>
            <span
              className={`badge ${
                isAdmin
                  ? 'bg-primary text-white'
                  : 'bg-info text-dark'
              }`}
            >
              {isAdmin ? 'MAIN ADMIN / OWNER' : 'SUB ADMIN / USER'}
            </span>
          </div>
          <p id="dashboardSubtitle">
            {isAdmin
              ? 'Global financial overview, sub-account monitoring (Meet & Harsh), and live audit feed'
              : 'Real-time personal financial summary and expense activity insights'}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {isAdmin && (
            <button className="btn btn-outline-primary" onClick={() => navigate('/monitoring')}>
              <i className="fa-solid fa-users-viewfinder me-1"></i> Monitoring Hub
            </button>
          )}
          <button className="btn btn-secondary-custom" onClick={fetchDashboardData}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
          </button>
          <button className="btn btn-primary-custom" onClick={() => navigate('/expenses/new')}>
            <i className="fa-solid fa-plus me-1"></i> New Expense
          </button>
        </div>
      </div>

      {/* Admin Member View Scope Filter */}
      {isAdmin && (
        <div className="glass-card p-3 mb-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-users-viewfinder text-primary fs-5"></i>
              <span className="fw-bold small text-muted text-uppercase">Admin View Scope:</span>
            </div>
            <div className="btn-group btn-group-sm flex-wrap" role="group">
              <button
                type="button"
                className={`btn ${selectedUserScope === 'all' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUserScope('all')}
              >
                <i className="fa-solid fa-layer-group me-1"></i> All Members (Global)
              </button>
              <button
                type="button"
                className={`btn ${selectedUserScope === 'bhavik' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUserScope('bhavik')}
              >
                Bhavik Bhai
              </button>
              <button
                type="button"
                className={`btn ${selectedUserScope === 'meet' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUserScope('meet')}
              >
                Meet
              </button>
              <button
                type="button"
                className={`btn ${selectedUserScope === 'harsh' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUserScope('harsh')}
              >
                Harsh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6 Overall Stat Cards Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Expenses"
          value={formatINR(metrics?.totalSpending)}
          subtitle={`${metrics?.totalTransactions || 0} records tracked`}
          icon="fa-money-bill-wave"
          color="primary"
        />

        <StatCard
          title="This Month's Spend"
          value={formatINR(metrics?.monthlySpending)}
          subtitle={`Target: ${formatINR(metrics?.monthlyBudget)}`}
          icon="fa-calendar-days"
          color="purple"
        />

        <StatCard
          title="Remaining Budget"
          value={formatINR(metrics?.remainingBudget)}
          subtitle={`${metrics?.budgetPercent || 0}% Used`}
          progress={metrics?.budgetPercent || 0}
          icon="fa-piggy-bank"
          color="warning"
        />

        <StatCard
          title="Today's Spending"
          value={formatINR(metrics?.todaySpending)}
          subtitle="Daily spending total"
          icon="fa-calendar-day"
          color="success"
        />

        <StatCard
          title="Average / Expense"
          value={formatINR(metrics?.averageSpending)}
          subtitle="Per transaction"
          icon="fa-chart-line"
          color="info"
        />

        <StatCard
          title="Highest Expense"
          value={formatINR(metrics?.highestExpense)}
          subtitle="Peak single transaction"
          icon="fa-arrow-trend-up"
          color="danger"
        />
      </div>

      {/* USER-WISE SUMMARY: Dedicated Cards for Bhavik Bhai, Meet, and Harsh */}
      {isAdmin && (
        <div className="mt-4 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="fw-bold mb-0">
                <i className="fa-solid fa-users me-2 text-primary"></i>
                Family & Sub-Account Breakdown
              </h5>
              <p className="text-muted small mb-0">
                Individual spending statistics across all accounts from live database
              </p>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={() => navigate('/users')}>
              <i className="fa-solid fa-users-gear me-1"></i> Manage Users
            </button>
          </div>

          <div className="row g-3">
            {/* Bhavik Bhai Card */}
            <div className="col-md-4">
              <div className="glass-card p-3 h-100 border-start border-4 border-primary">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="user-avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                      <i className="fa-solid fa-crown"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0">Bhavik Bhai</h6>
                      <small className="text-muted">Main Admin / Owner</small>
                    </div>
                  </div>
                  <span className="badge bg-primary-subtle text-primary">Admin</span>
                </div>
                <div className="mt-3 pt-2 border-top">
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Total Expenses:</span>
                    <strong className="text-dark">{formatINR(bhavikStat.totalSpent)}</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Transactions:</span>
                    <strong className="text-dark">{bhavikStat.transactionCount} entries</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small">
                    <span>This Month:</span>
                    <strong className="text-primary">{formatINR(bhavikStat.thisMonthSpent)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Meet Card */}
            <div className="col-md-4">
              <div className="glass-card p-3 h-100 border-start border-4 border-success">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="user-avatar-sm bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0">Meet</h6>
                      <small className="text-muted">Sub Admin / User</small>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success">Sub-User</span>
                </div>
                <div className="mt-3 pt-2 border-top">
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Total Expenses:</span>
                    <strong className="text-dark">{formatINR(meetStat.totalSpent)}</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Transactions:</span>
                    <strong className="text-dark">{meetStat.transactionCount} entries</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small">
                    <span>This Month:</span>
                    <strong className="text-success">{formatINR(meetStat.thisMonthSpent)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Harsh Card */}
            <div className="col-md-4">
              <div className="glass-card p-3 h-100 border-start border-4 border-warning">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="user-avatar-sm bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0">Harsh</h6>
                      <small className="text-muted">Sub Admin / User</small>
                    </div>
                  </div>
                  <span className="badge bg-warning-subtle text-warning">Sub-User</span>
                </div>
                <div className="mt-3 pt-2 border-top">
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Total Expenses:</span>
                    <strong className="text-dark">{formatINR(harshStat.totalSpent)}</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small mb-1">
                    <span>Transactions:</span>
                    <strong className="text-dark">{harshStat.transactionCount} entries</strong>
                  </div>
                  <div className="d-flex justify-content-between text-muted small">
                    <span>This Month:</span>
                    <strong className="text-warning">{formatINR(harshStat.thisMonthSpent)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEAM RECENT ACTIVITY FEED */}
      <div className="glass-card p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-0">
              <i className="fa-solid fa-bolt me-2 text-warning"></i>
              {isAdmin ? 'Recent Team Activity' : 'My Recent Activity'}
            </h5>
            <p className="text-muted small mb-0">
              {isAdmin
                ? 'Real-time feed of expenses added, updated, or removed by Meet and Harsh'
                : 'Recent actions performed in your account'}
            </p>
          </div>
          <button className="btn btn-sm btn-secondary-custom" onClick={() => navigate('/activity')}>
            View Full Activity Log <i className="fa-solid fa-arrow-right ms-1"></i>
          </button>
        </div>

        {recentActivities.length > 0 ? (
          <div className="row g-2">
            {recentActivities.map((act) => {
              const typeIcon =
                act.type === 'create'
                  ? 'fa-circle-plus text-success'
                  : act.type === 'update'
                  ? 'fa-pen-to-square text-warning'
                  : 'fa-trash text-danger';

              const timestampDate = new Date(act.timestamp);
              const dateStr = formatDate(timestampDate.toISOString().slice(0, 10));
              const timeStr = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={act._id || act.id} className="col-12 col-md-6">
                  <div className="glass-card p-3 h-100 d-flex align-items-start justify-content-between gap-2 border-start border-3" style={{ borderLeftColor: act.type === 'create' ? '#10b981' : act.type === 'update' ? '#f59e0b' : '#ef4444' }}>
                    <div className="d-flex align-items-start gap-2">
                      <i className={`fa-solid ${typeIcon} fs-5 mt-1`}></i>
                      <div>
                        <div className="fw-bold small">
                          {act.user_name} <span className="text-muted fw-normal">({act.action})</span>
                        </div>
                        <p className="mb-0 text-muted small">{act.details}</p>
                      </div>
                    </div>
                    <div className="text-end" style={{ minWidth: '90px' }}>
                      {act.amount > 0 && (
                        <div className="fw-bold small text-primary">{formatINR(act.amount)}</div>
                      )}
                      <small className="text-muted">{timeStr}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted small">
            No recent activity recorded yet.
          </div>
        )}
      </div>

      {/* 5 Charts Section Grid */}
      <div className="charts-grid mb-4">
        {/* 1. Category Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-chart-pie me-2 text-primary"></i> Category Distribution</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <CategoryDoughnutChart data={metrics?.categoryBreakdown} />
          </div>
        </div>

        {/* 2. Monthly Trend Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-chart-area me-2 text-purple"></i> Monthly Trend (₹)</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <MonthlyTrendLineChart data={metrics?.monthlyTrend} />
          </div>
        </div>

        {/* 3. Payment Method Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-credit-card me-2 text-warning"></i> Payment Methods</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <PaymentMethodChart data={metrics?.paymentMethodBreakdown} />
          </div>
        </div>

        {/* 4. Daily Spending Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-calendar-check me-2 text-success"></i> Daily Spending Flow</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <DailySpendingChart data={metrics?.dailySpending} />
          </div>
        </div>

        {/* 5. User Comparison Chart (Admin Only) */}
        {isAdmin && (
          <div className="glass-card chart-card col-12">
            <div className="chart-card-header">
              <h5><i className="fa-solid fa-user-group me-2 text-info"></i> Total Spending by Member</h5>
            </div>
            <div className="chart-container" style={{ position: 'relative', height: '260px' }}>
              <UserComparisonChart data={metrics?.userComparison} />
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions Card */}
      <div className="glass-card p-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h5 className="mb-0 fw-bold">
            <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i> Recent Expense Transactions
          </h5>
          <button className="btn btn-sm btn-secondary-custom" onClick={() => navigate('/expenses')}>
            View All Records <i className="fa-solid fa-arrow-right ms-1"></i>
          </button>
        </div>

        <div className="table-glass-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Created By</th>
                <th>Title & Date</th>
                <th>Category</th>
                <th>Payment</th>
                <th className="text-end">Amount</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.recentTransactions && metrics.recentTransactions.length > 0 ? (
                metrics.recentTransactions.map(item => (
                  <tr key={item._id || item.id || item.expense_id}>
                    <td>
                      <span className="badge bg-primary-subtle text-primary fw-semibold">
                        {item.user_name || 'Member'}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span className="fw-bold d-block">{item.title}</span>
                        <small className="text-muted">
                          {formatDate(item.expense_date)} {item.expense_time ? `at ${item.expense_time}` : ''}
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span className="small text-muted">{item.payment_method}</span>
                    </td>
                    <td className="text-end fw-bold text-primary">
                      {formatINR(item.amount)}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setSelectedExpense(item)}
                      >
                        <i className="fa-solid fa-eye me-1"></i> Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">
                    No transactions recorded yet. Click <strong>New Expense</strong> to record one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ExpenseDetailsModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onViewReceipt={(url) => setReceiptUrl(url)}
        onEdit={(exp) => navigate(`/expenses/edit/${exp.id || exp._id}`)}
      />

      <ReceiptModal
        receiptUrl={receiptUrl}
        onClose={() => setReceiptUrl(null)}
      />
    </div>
  );
}
