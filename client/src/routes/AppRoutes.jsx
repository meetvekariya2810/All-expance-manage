import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ExpenseEntryPage from '../pages/ExpenseEntryPage';
import ExpenseListPage from '../pages/ExpenseListPage';
import ReportsPage from '../pages/ReportsPage';
import BudgetPage from '../pages/BudgetPage';
import CategoryManagerPage from '../pages/CategoryManagerPage';
import UserManagementPage from '../pages/UserManagementPage';
import ProfilePage from '../pages/ProfilePage';
import ActivityPage from '../pages/ActivityPage';
import ExpenseMonitoringPage from '../pages/ExpenseMonitoringPage';

// Component to protect all Private/Dashboard routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ background: '#0f172a', color: '#6366f1' }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Authenticating...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Component to protect Admin-only routes
const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export default function AppRoutes() {
  return (
    <Routes>
      {/* 1. Public Standalone Route: Clean Login Only */}
      <Route path="/login" element={<LoginPage />} />

      {/* 2. Authenticated Application Routes (Guarded by ProtectedRoute) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="expenses" element={<ExpenseListPage />} />
        <Route path="expenses/new" element={<ExpenseEntryPage />} />
        <Route path="expenses/edit/:id" element={<ExpenseEntryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="activity" element={<ActivityPage />} />

        {/* Admin Only Routes */}
        <Route
          path="monitoring"
          element={
            <AdminRoute>
              <ExpenseMonitoringPage />
            </AdminRoute>
          }
        />
        <Route
          path="categories"
          element={
            <AdminRoute>
              <CategoryManagerPage />
            </AdminRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          }
        />

        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* 3. Fallback Route: Redirect unauthenticated requests to /login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
