import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { budgetService } from '../services/budgetService';

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      const fetchBudgetAlert = async () => {
        try {
          const data = await budgetService.getBudgets();
          if (data.success) {
            setBudgetStatus(data);
          }
        } catch (e) {
          // Ignore budget fetch errors for alert
        }
      };
      fetchBudgetAlert();

      const handleRefresh = () => fetchBudgetAlert();
      window.addEventListener('app:refresh', handleRefresh);
      return () => window.removeEventListener('app:refresh', handleRefresh);
    }
  }, [isAuthenticated, user]);

  return (
    <div id="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        closeMobileMenu={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <main className="app-main">
        <Header toggleMobileMenu={() => setIsMobileOpen(prev => !prev)} />

        <div className="content-body">
          {/* Budget Alert Banner */}
          {budgetStatus && (budgetStatus.isExceeded || budgetStatus.isWarning) && (
            <div
              className={`alert ${
                budgetStatus.isExceeded ? 'alert-danger' : 'alert-warning'
              } alert-dismissible fade show glass-card mb-4 shadow-sm`}
              role="alert"
            >
              <div className="d-flex align-items-center gap-2">
                <i
                  className={`fa-solid ${
                    budgetStatus.isExceeded
                      ? 'fa-triangle-exclamation fs-4 text-danger'
                      : 'fa-circle-exclamation fs-4 text-warning'
                  }`}
                ></i>
                <div>
                  <strong>Budget Notice: </strong>
                  {budgetStatus.isExceeded
                    ? `You have exceeded your monthly limit by ₹${(
                        budgetStatus.spent - budgetStatus.budget
                      ).toLocaleString('en-IN')} (${budgetStatus.percentage}% used).`
                    : `You have utilized ${budgetStatus.percentage}% of your monthly limit.`}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setBudgetStatus(null)}
                aria-label="Close"
              ></button>
            </div>
          )}

          {/* Render Active Route View */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
