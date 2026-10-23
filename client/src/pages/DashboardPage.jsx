import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { expenseService } from '../services/expenseService';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/constants';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ReceiptModal from '../components/ReceiptModal';
import AddFundModal from '../components/AddFundModal';
import SettlementModal from '../components/SettlementModal';
import {
  CategoryDoughnutChart,
  MonthlyTrendLineChart
} from '../components/Charts';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedUserScope, setSelectedUserScope] = useState('all');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals & Navigation
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

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

  // Helper for Category Icon & Color
  const getCategoryIconDetails = (categoryName = '') => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('water')) {
      return { icon: 'fa-solid fa-droplet', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)' };
    }
    if (cat.includes('elect')) {
      return { icon: 'fa-solid fa-bolt', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
    }
    if (cat.includes('food') || cat.includes('milk') || cat.includes('lunch') || cat.includes('dinner')) {
      return { icon: 'fa-solid fa-utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' };
    }
    if (cat.includes('transfer') || cat.includes('misc')) {
      return { icon: 'fa-solid fa-arrow-right-arrow-left', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
    }
    if (cat.includes('grocer') || cat.includes('shop') || cat.includes('wefar')) {
      return { icon: 'fa-solid fa-cart-shopping', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' };
    }
    return { icon: 'fa-solid fa-receipt', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
  };

  const totalFunds = metrics?.totalFunds || 0;
  const totalSpending = metrics?.totalSpending || 0;
  const availableBalance = metrics?.availableBalance || 0;
  const todaySpending = metrics?.todaySpending || 0;
  const monthlySpending = metrics?.monthlySpending || 0;
  const monthlyBudget = metrics?.monthlyBudget || 0;
  const settlementNet = metrics?.settlements?.net || 0;
  const settlementPaid = metrics?.settlements?.totalPaid || 0;
  const settlementRecv = metrics?.settlements?.totalReceived || 0;
  const pendingSettlements = metrics?.settlements?.pendingAmount || 0;
  const pendingCount = metrics?.settlements?.pendingCount || 0;
  const recentTransactions = metrics?.recentTransactions || [];

  const roleText = isAdmin ? 'MAIN ADMIN / OWNER' : 'SUB ADMIN / USER';

  return (
    <div className="view-container active pb-5" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Title & Quick Actions Row matching Reference Screenshot */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3 pt-2">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <h3 className="fw-bold mb-0" style={{ fontSize: '1.45rem', color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
              Personal Dashboard — Welcome {user?.name || 'Meet'}
            </h3>
            <span
              className="badge px-2 py-1"
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                borderRadius: '6px',
                letterSpacing: '0.02em'
              }}
            >
              {roleText}
            </span>
          </div>
          <p className="text-muted small mb-0" style={{ fontSize: '0.84rem' }}>
            Real-time financial summary: Funds received, expenses, available balance, and live audit feed
          </p>
        </div>

        {/* Quick Action Buttons on Top Right */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            className="btn-fintech-action btn-fintech-blue"
            onClick={() => navigate('/expenses/new')}
          >
            <i className="fa-solid fa-plus"></i>
            <span>New Expense</span>
          </button>
          <button
            className="btn-fintech-action btn-fintech-green"
            onClick={() => setIsAddFundOpen(true)}
          >
            <i className="fa-solid fa-plus"></i>
            <span>Add Fund</span>
          </button>
          <button
            className="btn-fintech-action btn-fintech-purple"
            onClick={() => setIsSettlementOpen(true)}
          >
            <i className="fa-solid fa-handshake"></i>
            <span>Settle Up</span>
          </button>
          <button
            className="btn-fintech-action btn-fintech-outline"
            onClick={() => navigate('/funds')}
          >
            <i className="fa-regular fa-calendar text-muted"></i>
            <span>Fund History</span>
          </button>
          <button
            className="btn-fintech-action btn-fintech-outline"
            onClick={() => navigate('/settlements')}
          >
            <i className="fa-solid fa-scale-balanced text-muted"></i>
            <span>Settlements</span>
          </button>
        </div>
      </div>

      {/* Admin View Scope Selector (if authorized Admin) */}
      {isAdmin && (
        <div className="card-fintech-sm p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="small fw-bold text-muted text-uppercase">
            <i className="fa-solid fa-filter me-1 text-primary"></i> Admin Scope Filter:
          </span>
          <div className="d-flex gap-2 flex-wrap">
            {['all', 'bhavik', 'meet', 'harsh'].map((scope) => (
              <button
                key={scope}
                type="button"
                className={`btn btn-sm px-3 py-1 fw-semibold ${selectedUserScope === scope ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                style={{
                  borderRadius: '8px',
                  background: selectedUserScope === scope ? '#2563eb' : 'transparent',
                  borderColor: selectedUserScope === scope ? '#2563eb' : 'var(--border-color, #e2e8f0)',
                  color: selectedUserScope === scope ? '#fff' : 'var(--text-muted, #64748b)'
                }}
                onClick={() => setSelectedUserScope(scope)}
              >
                {scope === 'all' ? 'All Members' : scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ROW 1: THREE PRIMARY FINANCIAL SUMMARY CARDS
          ========================================================================= */}
      <div className="row g-3 mb-4">
        {/* CARD 1: TOTAL FUNDS ADDED */}
        <div className="col-12 col-md-4">
          <div className="card-fintech-funds p-4 h-100 d-flex flex-column justify-content-between position-relative">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '28px', height: '28px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.85rem' }}
                >
                  <i className="fa-solid fa-sack-dollar"></i>
                </div>
                <span className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: '#047857', letterSpacing: '0.04em' }}>
                  TOTAL FUNDS ADDED
                </span>
              </div>
              <div className="fw-bold my-1" style={{ fontSize: '1.95rem', color: '#10b981', letterSpacing: '-0.02em' }}>
                ₹{totalFunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="small text-muted" style={{ fontSize: '0.8rem' }}>
                {metrics?.totalFundTransactions || 1} deposit entries in Atlas
              </div>
            </div>

            {/* Right Decorative Graphic matching Screenshot */}
            <div
              className="position-absolute end-0 bottom-0 p-3 d-flex align-items-end gap-2"
              style={{ pointerEvents: 'none', opacity: 0.95 }}
            >
              <i className="fa-solid fa-arrow-trend-up" style={{ color: 'rgba(16, 185, 129, 0.35)', fontSize: '2rem' }}></i>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                style={{ width: '44px', height: '44px', background: '#10b981', color: '#ffffff', fontSize: '1.25rem' }}
              >
                <i className="fa-solid fa-wallet"></i>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL EXPENSES SPENT */}
        <div className="col-12 col-md-4">
          <div className="card-fintech-expenses p-4 h-100 d-flex flex-column justify-content-between position-relative">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '28px', height: '28px', background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', fontSize: '0.85rem' }}
                >
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <span className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: '#be123c', letterSpacing: '0.04em' }}>
                  TOTAL EXPENSES SPENT
                </span>
              </div>
              <div className="fw-bold my-1" style={{ fontSize: '1.95rem', color: '#f43f5e', letterSpacing: '-0.02em' }}>
                ₹{totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="small text-muted" style={{ fontSize: '0.8rem' }}>
                {metrics?.totalTransactions || 81} expense records in Atlas
              </div>
            </div>

            {/* Right Decorative Graphic matching Screenshot */}
            <div
              className="position-absolute end-0 bottom-0 p-3 d-flex align-items-end gap-2"
              style={{ pointerEvents: 'none', opacity: 0.95 }}
            >
              <i className="fa-solid fa-chart-simple" style={{ color: 'rgba(244, 63, 94, 0.35)', fontSize: '2rem' }}></i>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                style={{ width: '44px', height: '44px', background: '#f43f5e', color: '#ffffff', fontSize: '1.25rem' }}
              >
                <i className="fa-solid fa-file-invoice"></i>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: AVAILABLE BALANCE */}
        <div className="col-12 col-md-4">
          <div className="card-fintech-balance p-4 h-100 d-flex flex-column justify-content-between position-relative">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '28px', height: '28px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', fontSize: '0.85rem' }}
                >
                  <i className="fa-solid fa-wallet"></i>
                </div>
                <span className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: '#1d4ed8', letterSpacing: '0.04em' }}>
                  AVAILABLE BALANCE
                </span>
              </div>
              <div
                className="fw-bold my-1"
                style={{
                  fontSize: '1.95rem',
                  color: availableBalance >= 0 ? '#3b82f6' : '#f43f5e',
                  letterSpacing: '-0.02em'
                }}
              >
                {availableBalance < 0 ? '-' : ''}₹{Math.abs(availableBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="small text-muted" style={{ fontSize: '0.8rem' }}>
                Total Funds (₹{totalFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) - Expenses (₹{totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </div>
            </div>

            {/* Right Decorative Graphic matching Screenshot */}
            <div
              className="position-absolute end-0 bottom-0 p-3 d-flex align-items-end gap-2"
              style={{ pointerEvents: 'none', opacity: 0.95 }}
            >
              <i className="fa-solid fa-coins" style={{ color: 'rgba(59, 130, 246, 0.35)', fontSize: '2rem' }}></i>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                style={{ width: '44px', height: '44px', background: '#3b82f6', color: '#ffffff', fontSize: '1.25rem' }}
              >
                <i className="fa-solid fa-file-invoice-dollar"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: FOUR SECONDARY SUMMARY CARDS
          ========================================================================= */}
      <div className="row g-3 mb-4">
        {/* 1. TODAY'S SPENDING */}
        <div className="col-6 col-lg-3">
          <div className="card-fintech-sm d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontSize: '1.1rem' }}
              >
                <i className="fa-regular fa-calendar"></i>
              </div>
              <div>
                <div className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  TODAY'S SPENDING
                </div>
                <div className="fw-bold fs-5" style={{ color: 'var(--text-main, #0f172a)' }}>
                  {formatINR(todaySpending)}
                </div>
                <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                  Today's out-flow
                </div>
              </div>
            </div>
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.85rem' }}
            >
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
        </div>

        {/* 2. THIS MONTH'S SPEND */}
        <div className="col-6 col-lg-3">
          <div className="card-fintech-sm d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '1.1rem' }}
              >
                <i className="fa-solid fa-chart-column"></i>
              </div>
              <div>
                <div className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  THIS MONTH'S SPEND
                </div>
                <div className="fw-bold fs-5" style={{ color: 'var(--text-main, #0f172a)' }}>
                  {formatINR(monthlySpending)}
                </div>
                <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                  Target: {formatINR(monthlyBudget)}
                </div>
              </div>
            </div>
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '0.85rem' }}
            >
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
        </div>

        {/* 3. SETTLEMENTS SUMMARY */}
        <div className="col-6 col-lg-3">
          <div className="card-fintech-sm d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', fontSize: '1.1rem' }}
              >
                <i className="fa-solid fa-users"></i>
              </div>
              <div>
                <div className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  SETTLEMENTS SUMMARY
                </div>
                <div className="fw-bold fs-5" style={{ color: 'var(--text-main, #0f172a)' }}>
                  {formatINR(settlementNet)}
                </div>
                <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                  Paid: {formatINR(settlementPaid)} | Recv: {formatINR(settlementRecv)}
                </div>
              </div>
            </div>
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', fontSize: '0.85rem' }}
            >
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
        </div>

        {/* 4. PENDING SETTLEMENTS */}
        <div className="col-6 col-lg-3">
          <div className="card-fintech-sm d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '1.1rem' }}
              >
                <i className="fa-regular fa-clock"></i>
              </div>
              <div>
                <div className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  PENDING SETTLEMENTS
                </div>
                <div className="fw-bold fs-5" style={{ color: 'var(--text-main, #0f172a)' }}>
                  {formatINR(pendingSettlements)}
                </div>
                <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                  {pendingCount} pending actions
                </div>
              </div>
            </div>
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.85rem' }}
            >
              <i className="fa-regular fa-clock"></i>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: SETTLE UP RECONCILIATION WIDE PANEL
          ========================================================================= */}
      <div className="card-fintech-reconcile mb-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: '48px', height: '48px', background: '#3b82f6', color: '#ffffff', fontSize: '1.35rem' }}
            >
              <i className="fa-solid fa-handshake"></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-uppercase" style={{ fontSize: '1.05rem', color: 'var(--text-main, #0f172a)', letterSpacing: '0.03em' }}>
                SETTLE UP RECONCILIATION
              </h5>
              <p className="text-muted small mb-0" style={{ fontSize: '0.8rem' }}>
                Track money settled with individuals without double-counting against expenses
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn-fintech-action text-white"
              style={{ background: '#6366f1' }}
              onClick={() => setIsSettlementOpen(true)}
            >
              <i className="fa-solid fa-plus"></i>
              <span>New Settlement</span>
            </button>
            <button
              className="btn-fintech-action btn-fintech-outline"
              onClick={() => navigate('/settlements')}
            >
              <i className="fa-solid fa-list-ul text-muted"></i>
              <span>View Settlements</span>
            </button>
          </div>
        </div>

        {/* 4 Inner Stat Pills matching Screenshot */}
        <div className="row g-3 pt-1">
          <div className="col-6 col-md-3">
            <div className="reconcile-stat-pill">
              <div>
                <span className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b' }}>TOTAL FUNDS</span>
                <div className="fw-bold fs-6 mt-1" style={{ color: '#10b981' }}>
                  ₹{totalFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-wallet"></i>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="reconcile-stat-pill">
              <div>
                <span className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b' }}>TOTAL EXPENSES</span>
                <div className="fw-bold fs-6 mt-1" style={{ color: '#f43f5e' }}>
                  ₹{totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-file-invoice"></i>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="reconcile-stat-pill">
              <div>
                <span className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b' }}>AVAILABLE BALANCE</span>
                <div className="fw-bold fs-6 mt-1" style={{ color: availableBalance >= 0 ? '#3b82f6' : '#f43f5e' }}>
                  {availableBalance < 0 ? '-' : ''}₹{Math.abs(availableBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-coins"></i>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="reconcile-stat-pill">
              <div>
                <span className="text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748b' }}>UNSETTLED AMOUNT</span>
                <div className="fw-bold fs-6 mt-1" style={{ color: '#f59e0b' }}>
                  ₹{pendingSettlements.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.85rem' }}
              >
                <i className="fa-regular fa-clock"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: THREE ANALYTICS PANELS (IN ONE ROW ON DESKTOP)
          ========================================================================= */}
      <div className="row g-3 mb-4">
        {/* PANEL 1: MONTHLY EXPENSE TREND */}
        <div className="col-12 col-lg-4">
          <div className="analytics-panel-card d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-chart-line text-primary"></i>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: 'var(--text-main, #0f172a)' }}>
                  Monthly Expense Trend
                </h6>
              </div>
              <div
                className="d-flex align-items-center gap-1 px-2 py-0 rounded border small text-muted"
                style={{ fontSize: '0.75rem', cursor: 'pointer', background: 'var(--hover-bg, #f8fafc)' }}
              >
                <span>2026</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.65rem' }}></i>
              </div>
            </div>
            <div style={{ height: '230px', width: '100%' }}>
              <MonthlyTrendLineChart data={metrics?.monthlyTrend} />
            </div>
          </div>
        </div>

        {/* PANEL 2: EXPENSE BY CATEGORY */}
        <div className="col-12 col-lg-4">
          <div className="analytics-panel-card d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-tag text-success"></i>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: 'var(--text-main, #0f172a)' }}>
                  Expense by Category
                </h6>
              </div>
              <div
                className="d-flex align-items-center gap-1 px-2 py-0 rounded border small text-muted"
                style={{ fontSize: '0.75rem', cursor: 'pointer', background: 'var(--hover-bg, #f8fafc)' }}
              >
                <span>This Month</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.65rem' }}></i>
              </div>
            </div>
            <div style={{ height: '230px', width: '100%' }}>
              <CategoryDoughnutChart data={metrics?.categoryBreakdown} total={totalSpending} />
            </div>
          </div>
        </div>

        {/* PANEL 3: RECENT TRANSACTIONS */}
        <div className="col-12 col-lg-4">
          <div className="analytics-panel-card d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-primary"></i>
                <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: 'var(--text-main, #0f172a)' }}>
                  Recent Transactions
                </h6>
              </div>
              <button
                className="btn btn-sm btn-link p-0 text-primary text-decoration-none fw-semibold"
                style={{ fontSize: '0.78rem' }}
                onClick={() => navigate('/expenses')}
              >
                View All
              </button>
            </div>

            {/* Table of Recent Transactions matching Screenshot */}
            <div className="table-responsive" style={{ maxHeight: '230px' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                <thead style={{ color: '#94a3b8', fontSize: '0.72rem', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <tr>
                    <th className="py-1 px-2 font-monospace fw-normal">Date</th>
                    <th className="py-1 px-2 fw-normal">Title</th>
                    <th className="py-1 px-2 fw-normal">Category</th>
                    <th className="py-1 px-2 fw-normal text-end">Amount</th>
                    <th className="py-1 px-2 fw-normal">User</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.slice(0, 5).map((t) => {
                      const iconDetails = getCategoryIconDetails(t.category);
                      const isFund = t.txn_type === 'fund';
                      return (
                        <tr
                          key={t._id || t.id}
                          style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                          onClick={() => {
                            if (!isFund) setSelectedExpense(t);
                          }}
                        >
                          <td className="py-2 px-2 text-nowrap">
                            <div className="d-flex align-items-center gap-1">
                              <span style={{ color: iconDetails.color, fontSize: '0.75rem' }}>
                                <i className={iconDetails.icon}></i>
                              </span>
                              <span className="text-muted">{formatDate(t.date || t.expense_date)}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 fw-semibold text-truncate" style={{ maxWidth: '80px', color: 'var(--text-main, #0f172a)' }}>
                            {t.title}
                          </td>
                          <td className="py-2 px-2 text-muted text-truncate" style={{ maxWidth: '80px' }}>
                            {t.category}
                          </td>
                          <td className="py-2 px-2 text-end fw-bold text-nowrap" style={{ color: isFund ? '#10b981' : '#f43f5e' }}>
                            {isFund ? `+${formatINR(t.amount)}` : `${formatINR(t.amount)}`}
                          </td>
                          <td className="py-2 px-2 text-muted text-truncate" style={{ maxWidth: '75px' }}>
                            {t.user_name || t.person || 'Admin'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-muted">
                        No recent transactions recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
