import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isMobileOpen, closeMobileMenu }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay active"
          onClick={closeMobileMenu}
        />
      )}

      {/* Main Sidebar */}
      <aside className={`app-sidebar ${isMobileOpen ? 'show' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div className="brand-text">SmartExpense</div>
        </div>

        <div className="sidebar-user-badge">
          <div className="user-avatar-placeholder">
            <i className={`fa-solid ${isAdmin ? 'fa-user-tie text-primary' : 'fa-user text-info'}`}></i>
          </div>
          <div className="user-badge-info">
            <h6 className="current-user-name mb-0">{user?.name || 'Guest'}</h6>
            <span className="current-user-role">
              {isAdmin ? 'MAIN ADMIN / OWNER' : 'SUB ADMIN / USER'}
            </span>
          </div>
        </div>

        <div className="sidebar-menu">
          <div className="menu-label">{isAdmin ? 'Admin Navigation' : 'My Workspace'}</div>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-chart-pie"></i>
            <span>{isAdmin ? 'Admin Dashboard' : 'My Dashboard'}</span>
          </NavLink>

          <NavLink
            to="/expenses/new"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-plus-circle"></i>
            <span>Add Expense</span>
          </NavLink>

          <NavLink
            to="/expenses"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
            end
          >
            <i className="fa-solid fa-list-check"></i>
            <span>{isAdmin ? 'All Expense History' : 'My Expense History'}</span>
          </NavLink>

          {/* Admin Monitoring Center */}
          {isAdmin && (
            <NavLink
              to="/monitoring"
              className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              <i className="fa-solid fa-users-viewfinder text-primary"></i>
              <span>Expense Monitoring</span>
            </NavLink>
          )}

          {/* Activity / Audit Log */}
          <NavLink
            to="/activity"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>{isAdmin ? 'Team Activity Log' : 'My Activity'}</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-chart-column"></i>
            <span>{isAdmin ? 'Reports & Analytics' : 'My Reports'}</span>
          </NavLink>

          <NavLink
            to="/budget"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-piggy-bank"></i>
            <span>{isAdmin ? 'Budget & Limits' : 'My Budget'}</span>
          </NavLink>

          {/* Admin Controls */}
          {isAdmin && (
            <>
              <div className="menu-label admin-only">Admin Controls</div>

              <NavLink
                to="/categories"
                className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <i className="fa-solid fa-tags"></i>
                <span>Category Manager</span>
              </NavLink>

              <NavLink
                to="/users"
                className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <i className="fa-solid fa-users-gear"></i>
                <span>User Management</span>
              </NavLink>
            </>
          )}

          <div className="menu-label">Account</div>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-user-shield"></i>
            <span>{isAdmin ? 'Admin Profile' : 'My Profile'}</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-sm btn-outline-danger w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            onClick={async () => {
              closeMobileMenu();
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
