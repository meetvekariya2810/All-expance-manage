import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { budgetService } from '../services/budgetService';
import { formatINR } from '../utils/constants';

export default function BudgetPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [targetUser, setTargetUser] = useState('global');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const data = await budgetService.getBudgets(month, targetUser);
      if (data.success) {
        setBudgetData(data);
        setBudgetAmount(data.budget ? String(data.budget) : '');
      }
    } catch (err) {
      showToast('Error loading budget data.', 'error');
    }
  }, [month, targetUser, showToast]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetAmount);
    if (isNaN(parsed) || parsed < 0) {
      showToast('Please enter a valid positive budget amount.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await budgetService.setBudget({
        month,
        budget_amount: parsed,
        targetUser: isAdmin ? targetUser : undefined
      });
      showToast('Monthly budget saved successfully!', 'success');
      fetchBudget();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving budget.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const statusBadgeMap = {
    safe: { text: 'Safe', class: 'bg-success' },
    warning: { text: 'Warning (Near Limit)', class: 'bg-warning text-dark' },
    exceeded: { text: 'Limit Exceeded', class: 'bg-danger' }
  };
  const currentBadge = statusBadgeMap[budgetData?.status || 'safe'] || statusBadgeMap.safe;

  return (
    <div className="view-container active">
      {/* Title box */}
      <div className="page-title-box">
        <div>
          <h3>Monthly Budget & Spending Limits</h3>
          <p>Define monthly expenditure thresholds and monitor usage in real-time</p>
        </div>
        <div>
          <input
            type="month"
            className="form-control"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="row g-4">
        {/* Set Budget Form Card */}
        <div className="col-lg-5">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-sliders me-2 text-primary"></i> Set Monthly Limit
            </h5>

            {isAdmin && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Target Account Scope</label>
                <select
                  className="form-select"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                >
                  <option value="global">Overall Family (Global)</option>
                  <option value="bhavik">Bhavik Bhai</option>
                  <option value="meet">Meet</option>
                  <option value="harsh">Harsh</option>
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold">Budget Amount (₹) *</label>
              <div className="input-group">
                <span className="input-group-text bg-light fw-bold">₹</span>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 50000"
                  min="0"
                  step="500"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary-custom w-100 py-2"
              onClick={handleSaveBudget}
              disabled={loading}
            >
              <i className="fa-solid fa-check me-1"></i>
              {loading ? 'Saving Budget...' : 'Save Monthly Budget'}
            </button>
          </div>
        </div>

        {/* Budget Status Display Card */}
        <div className="col-lg-7">
          <div className="glass-card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold mb-0">
                <i className="fa-solid fa-gauge-high me-2 text-warning"></i> Budget Health Status
              </h5>
              <span className={`badge ${currentBadge.class} fs-6 px-3 py-2`}>
                {currentBadge.text}
              </span>
            </div>

            <div className="row g-3 my-3 text-center">
              <div className="col-4">
                <span className="text-muted small d-block">Monthly Limit</span>
                <h4 className="fw-bold text-dark mt-1">
                  {formatINR(budgetData?.budget || 0)}
                </h4>
              </div>
              <div className="col-4 border-start border-end">
                <span className="text-muted small d-block">Spent So Far</span>
                <h4 className="fw-bold text-danger mt-1">
                  {formatINR(budgetData?.spent || 0)}
                </h4>
              </div>
              <div className="col-4">
                <span className="text-muted small d-block">Remaining</span>
                <h4 className="fw-bold text-success mt-1">
                  {formatINR(budgetData?.remaining || 0)}
                </h4>
              </div>
            </div>

            <div className="mt-4">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Usage Progress</span>
                <span className="fw-bold">{budgetData?.percentage || 0}% of budget spent</span>
              </div>
              <div className="progress-glass" style={{ height: '12px' }}>
                <div
                  className={`progress-glass-bar ${
                    budgetData?.isExceeded
                      ? 'bg-danger'
                      : budgetData?.isWarning
                      ? 'bg-warning'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, budgetData?.percentage || 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
