import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { activityService } from '../services/activityService';
import { expenseService } from '../services/expenseService';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/constants';
import StatCard from '../components/StatCard';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import AddFundModal from '../components/AddFundModal';
import SettlementModal from '../components/SettlementModal';
import {
  CategoryDoughnutChart,
  MonthlyTrendLineChart,
  PaymentMethodChart,
  DailySpendingChart,
  UserComparisonChart,
  FundsVsExpensesChart
} from '../components/Charts';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedUserScope, setSelectedUserScope] = useState('all');
  const [metrics, setMetrics] = useState(null);
  const [usersSummary, setUsersSummary] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Navigation
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  // Transaction tab filter
  const [transactionFilter, setTransactionFilter] = useState('all'); // all, fund, expense

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

  const handleDeleteExpense = async (exp) => {
    const id = exp._id || exp.id;
    if (!id) return;
    const confirmMsg = `Delete Expense?\n\nThis action permanently deletes "${exp.title}" (₹${(parseFloat(exp.amount) || 0).toLocaleString('en-IN')}) from the database.\nIt cannot be recovered.\n\nClick OK to confirm permanent deletion.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await expenseService.deleteExpense(id);
      showToast(res?.message || 'Expense permanently deleted.', 'success');
      setSelectedExpense(null);
      await fetchDashboardData();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete expense.', 'error');
    }
  };

  const getUserStat = (username) => {
    return usersSummary.find(u => u.username === username) || {
      name: username,
      totalSpent: 0,
      totalFunds: 0,
      balance: 0,
      transactionCount: 0,
      thisMonthSpent: 0
    };
  };

  const bhavikStat = getUserStat('bhavik');
  const meetStat = getUserStat('meet');
  const harshStat = getUserStat('harsh');

  // Filter recent transactions
  const filteredRecentTransactions = (metrics?.recentTransactions || []).filter(item => {
    if (transactionFilter === 'all') return true;
    return item.txn_type === transactionFilter;
  });

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
          <p id="dashboardSubtitle" className="mb-0">
            {isAdmin
              ? 'Complete financial management: Funds (Money In), Expenses (Money Out), Available Balance, and Settle Up'
              : 'Real-time financial summary: Funds received, expenses, available balance, and live audit feed'}
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
        </div>
      </div>

      {/* QUICK FINANCIAL ACTIONS BAR */}
      <div className="glass-card p-3 mb-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-bolt text-warning fs-5"></i>
            <span className="fw-bold text-uppercase small text-muted">Quick Financial Actions:</span>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-primary-custom d-flex align-items-center gap-2 shadow-sm"
              onClick={() => navigate('/expenses/new')}
            >
              <i className="fa-solid fa-plus-circle"></i>
              <span>+ New Expense</span>
            </button>
            <button
              className="btn btn-success-custom d-flex align-items-center gap-2 shadow-sm"
              onClick={() => setIsAddFundOpen(true)}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff' }}
            >
              <i className="fa-solid fa-arrow-down-left"></i>
              <span>+ Add Fund</span>
            </button>
            <button
              className="btn d-flex align-items-center gap-2 shadow-sm"
              onClick={() => setIsSettlementOpen(true)}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff' }}
            >
              <i className="fa-solid fa-handshake"></i>
              <span>Settle Up</span>
            </button>
            <button
              className="btn btn-secondary-custom d-flex align-items-center gap-2"
              onClick={() => navigate('/funds')}
            >
              <i className="fa-solid fa-vault"></i>
              <span>Fund History</span>
            </button>
            <button
              className="btn btn-secondary-custom d-flex align-items-center gap-2"
              onClick={() => navigate('/settlements')}
            >
              <i className="fa-solid fa-scale-balanced"></i>
              <span>Settlements</span>
            </button>
          </div>
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

      {/* 1. PRIMARY FINANCIAL METRICS (TOP 3 PILLARS: FUNDS, EXPENSES, AVAILABLE BALANCE) */}
      <div className="row g-3 mb-4">
        {/* TOTAL FUNDS (MONEY IN) */}
        <div className="col-12 col-md-4">
          <div className="stat-card glass-card h-100 p-4" style={{ borderLeft: '5px solid #10b981', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill mb-2" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-arrow-down-left me-1"></i> MONEY IN
                </span>
                <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  Total Funds Added
                </div>
                <div className="stat-card-value my-1" style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                  +{formatINR(metrics?.totalFunds || 0)}
                </div>
                <div className="stat-card-subtitle" style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                  {metrics?.totalFundTransactions || 0} deposit entries in Atlas
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center shadow" style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontSize: '1.6rem' }}>
                <i className="fa-solid fa-vault"></i>
              </div>
            </div>
          </div>
        </div>

        {/* TOTAL EXPENSES (MONEY OUT) */}
        <div className="col-12 col-md-4">
          <div className="stat-card glass-card h-100 p-4" style={{ borderLeft: '5px solid #ef4444', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill mb-2" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-arrow-up-right me-1"></i> MONEY OUT
                </span>
                <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  Total Expenses Spent
                </div>
                <div className="stat-card-value my-1" style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>
                  -{formatINR(metrics?.totalSpending || 0)}
                </div>
                <div className="stat-card-subtitle" style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                  {metrics?.totalTransactions || 0} expense records in Atlas
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center shadow" style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', fontSize: '1.6rem' }}>
                <i className="fa-solid fa-receipt"></i>
              </div>
            </div>
          </div>
        </div>

        {/* AVAILABLE BALANCE (TOTAL FUNDS - TOTAL EXPENSES) */}
        <div className="col-12 col-md-4">
          <div className="stat-card glass-card h-100 p-4" style={{ borderLeft: '5px solid #3b82f6', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill mb-2" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-wallet me-1"></i> NET POSITION
                </span>
                <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  Available Balance
                </div>
                <div className="stat-card-value my-1" style={{ fontSize: '2rem', fontWeight: 800, color: (metrics?.availableBalance || 0) >= 0 ? '#3b82f6' : '#ef4444' }}>
                  {formatINR(metrics?.availableBalance || 0)}
                </div>
                <div className="stat-card-subtitle" style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                  Total Funds ({formatINR(metrics?.totalFunds || 0)}) − Expenses ({formatINR(metrics?.totalSpending || 0)})
                </div>
              </div>
              <div className="rounded-circle d-flex align-items-center justify-content-center shadow" style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', fontSize: '1.6rem' }}>
                <i className="fa-solid fa-scale-balanced"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECONDARY OPERATIONAL METRICS */}
      <div className="stats-grid mb-4">
        <StatCard
          title="Today's Spending"
          value={formatINR(metrics?.todaySpending)}
          subtitle="Today's out-flow"
          icon="fa-calendar-day"
          color="success"
        />

        <StatCard
          title="This Month's Spend"
          value={formatINR(metrics?.monthlySpending)}
          subtitle={`Target: ${formatINR(metrics?.monthlyBudget)}`}
          icon="fa-calendar-days"
          color="purple"
        />

        <StatCard
          title="Settlements Summary"
          value={formatINR(metrics?.settlements?.net || 0)}
          subtitle={`Paid: ${formatINR(metrics?.settlements?.totalPaid || 0)} | Recv: ${formatINR(metrics?.settlements?.totalReceived || 0)}`}
          icon="fa-handshake"
          color="info"
        />

        <StatCard
          title="Pending Settlements"
          value={formatINR(metrics?.settlements?.pendingAmount || 0)}
          subtitle={`${metrics?.settlements?.pendingCount || 0} pending actions`}
          icon="fa-clock-rotate-left"
          color="warning"
        />
      </div>

      {/* 3. DEDICATED SETTLE UP DASHBOARD CARD (Prompt Item 19 & 20) */}
      <div className="glass-card p-4 mb-4" style={{ border: '1px solid rgba(99, 102, 241, 0.3)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(15, 23, 42, 0.4) 100%)' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', fontSize: '1.4rem' }}>
              <i className="fa-solid fa-handshake"></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-white">SETTLE UP RECONCILIATION</h5>
              <p className="text-muted small mb-0">
                Track money settled with individuals without double-counting against expenses
              </p>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm px-3 shadow-sm text-white d-flex align-items-center gap-2"
              onClick={() => setIsSettlementOpen(true)}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}
            >
              <i className="fa-solid fa-plus-circle"></i>
              <span>+ New Settlement</span>
            </button>
            <button
              className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-2"
              onClick={() => navigate('/settlements')}
            >
              <i className="fa-solid fa-list-check"></i>
              <span>View Settlements</span>
            </button>
          </div>
        </div>

        <div className="row g-3 pt-2">
          <div className="col-6 col-md-3">
            <div className="p-3 rounded" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.725rem' }}>Total Funds</small>
              <strong className="text-success fs-5">+{formatINR(metrics?.totalFunds || 0)}</strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.725rem' }}>Total Expenses</small>
              <strong className="text-danger fs-5">-{formatINR(metrics?.totalSpending || 0)}</strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.725rem' }}>Available Balance</small>
              <strong className="text-primary fs-5">{formatINR(metrics?.availableBalance || 0)}</strong>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
              <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.725rem' }}>Unsettled Amount</small>
              <strong className="text-warning fs-5">{formatINR(metrics?.settlements?.pendingAmount || 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* USER-WISE SUMMARY: Dedicated Cards for Bhavik Bhai, Meet, and Harsh */}
      {isAdmin && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="fw-bold mb-0">
                <i className="fa-solid fa-users me-2 text-primary"></i>
                Family & Sub-Account Breakdown
              </h5>
              <p className="text-muted small mb-0">
                Individual financial statistics across all accounts from live MongoDB Atlas
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
                ? 'Real-time feed of funds added, expenses recorded, and settlements created'
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
                act.type === 'create' || act.type === 'fund_create'
                  ? 'fa-circle-plus text-success'
                  : act.type === 'settlement_create' || act.type === 'settlement_status'
                  ? 'fa-handshake text-primary'
                  : act.type === 'update' || act.type === 'fund_update'
                  ? 'fa-pen-to-square text-warning'
                  : 'fa-trash text-danger';

              const timestampDate = new Date(act.timestamp);
              const timeStr = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={act._id || act.id} className="col-12 col-md-6">
                  <div className="glass-card p-3 h-100 d-flex align-items-start justify-content-between gap-2 border-start border-3" style={{ borderLeftColor: act.type?.includes('fund') ? '#10b981' : act.type?.includes('settle') ? '#6366f1' : '#f59e0b' }}>
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

      {/* 4. FINANCIAL CHARTS SECTION (INCLUDING FUNDS VS EXPENSES) */}
      <div className="charts-grid mb-4">
        {/* Funds vs Expenses Comparison Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-scale-balanced me-2 text-primary"></i> Funds vs Expenses (₹)</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <FundsVsExpensesChart funds={metrics?.totalFunds || 0} expenses={metrics?.totalSpending || 0} />
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-chart-pie me-2 text-success"></i> Category Distribution</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <CategoryDoughnutChart data={metrics?.categoryBreakdown} />
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-chart-area me-2 text-purple"></i> Monthly Expense Trend (₹)</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <MonthlyTrendLineChart data={metrics?.monthlyTrend} />
          </div>
        </div>

        {/* Payment Method Chart */}
        <div className="glass-card chart-card">
          <div className="chart-card-header">
            <h5><i className="fa-solid fa-credit-card me-2 text-warning"></i> Payment Methods</h5>
          </div>
          <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
            <PaymentMethodChart data={metrics?.paymentMethodBreakdown} />
          </div>
        </div>
      </div>

      {/* 5. UNIFIED RECENT FINANCIAL TRANSACTIONS (FUNDS & EXPENSES) */}
      <div className="glass-card p-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h5 className="mb-0 fw-bold">
              <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i> Unified Financial Transactions
            </h5>
            <p className="text-muted small mb-0">Incoming funds (+₹) and outgoing expenses (-₹) sorted chronologically</p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className={`btn ${transactionFilter === 'all' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setTransactionFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn ${transactionFilter === 'fund' ? 'btn-success-custom text-white' : 'btn-secondary-custom'}`}
                onClick={() => setTransactionFilter('fund')}
              >
                Funds In (+₹)
              </button>
              <button
                type="button"
                className={`btn ${transactionFilter === 'expense' ? 'btn-danger text-white' : 'btn-secondary-custom'}`}
                onClick={() => setTransactionFilter('expense')}
              >
                Expenses Out (-₹)
              </button>
            </div>

            <button className="btn btn-sm btn-secondary-custom" onClick={() => navigate('/expenses')}>
              All Expenses <i className="fa-solid fa-arrow-right ms-1"></i>
            </button>
          </div>
        </div>

        <div className="table-glass-container">
          <table className="table-custom align-middle">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title / Person</th>
                <th>Category</th>
                <th>Date</th>
                <th className="text-end">Amount</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentTransactions.length > 0 ? (
                filteredRecentTransactions.map((item) => {
                  const isFund = item.txn_type === 'fund';

                  return (
                    <tr key={item._id || item.id}>
                      <td>
                        {isFund ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            <i className="fa-solid fa-arrow-down-left me-1"></i> MONEY IN
                          </span>
                        ) : (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            <i className="fa-solid fa-arrow-up-right me-1"></i> EXPENSE
                          </span>
                        )}
                      </td>
                      <td>
                        <div>
                          <span className="fw-bold d-block text-white">{item.title}</span>
                          <small className="text-muted">
                            {isFund ? `Received from ${item.person}` : `By ${item.person}`}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatDate(item.date)}
                        </small>
                      </td>
                      <td className={`text-end fw-bold ${isFund ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1rem' }}>
                        {isFund ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`}
                      </td>
                      <td className="text-center">
                        {isFund ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => navigate('/funds')}
                          >
                            <i className="fa-solid fa-eye me-1"></i> View Funds
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setSelectedExpense(item)}
                          >
                            <i className="fa-solid fa-eye me-1"></i> Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">
                    No transactions found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddFundModal
        isOpen={isAddFundOpen}
        onClose={() => setIsAddFundOpen(false)}
        onSuccess={fetchDashboardData}
      />

      <SettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        onSuccess={fetchDashboardData}
      />

      <ExpenseDetailsModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onViewReceipt={(url) => setReceiptUrl(url)}
        onEdit={(exp) => navigate(`/expenses/edit/${exp.id || exp._id}`)}
        onDelete={handleDeleteExpense}
      />

      <ReceiptModal
        receiptUrl={receiptUrl}
        onClose={() => setReceiptUrl(null)}
      />
    </div>
  );
}
