import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isMobileOpen, closeMobileMenu }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'M';
  const roleDisplay = isAdmin ? 'MAIN ADMIN / OWNER' : 'SUB ADMIN / USER';

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
        {/* Brand Area matching Screenshot */}
        <div className="sidebar-brand d-flex align-items-center gap-3 px-3 py-3">
          <div
            className="brand-logo d-flex align-items-center justify-content-center"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: '1.25rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              flexShrink: 0
            }}
          >
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div className="brand-text-container">
            <div className="brand-text fw-bold text-white lh-1" style={{ fontSize: '1.18rem', letterSpacing: '-0.02em' }}>
              SmartExpense
            </div>
            <div className="brand-subtitle text-muted" style={{ fontSize: '0.68rem', marginTop: '3px', lineHeight: 1.1 }}>
              Smart Personal Expense Management System
            </div>
          </div>
        </div>

        {/* User Capsule matching Screenshot */}
        <div className="sidebar-user-capsule mx-3 my-2 p-2 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="d-flex align-items-center gap-2 min-w-0">
            <div
              className="user-capsule-avatar d-flex align-items-center justify-content-center fw-bold text-white rounded-circle flex-shrink-0"
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                fontSize: '0.95rem'
              }}
            >
              {userInitial}
            </div>
            <div className="user-capsule-info text-truncate">
              <div className="user-capsule-name fw-bold text-white small text-truncate">
                {user?.name || 'Meet'}
              </div>
              <div className="d-flex align-items-center">
                <span
                  className="badge px-1 py-0"
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: isAdmin ? 'rgba(37, 99, 235, 0.25)' : 'rgba(14, 165, 233, 0.25)',
                    color: isAdmin ? '#60a5fa' : '#38bdf8',
                    borderRadius: '4px',
                    letterSpacing: '0.02em'
                  }}
                >
                  {roleDisplay}
                </span>
              </div>
            </div>
          </div>
          <i className="fa-solid fa-chevron-down text-muted small pe-1" style={{ fontSize: '0.7rem' }}></i>
        </div>

        {/* Sidebar Menu Items */}
        <div className="sidebar-menu px-2 py-2">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-house"></i>
            <span>{isAdmin ? 'My Dashboard' : 'My Dashboard'}</span>
          </NavLink>

          <NavLink
            to="/expenses/new"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-circle-plus"></i>
            <span>Add Expense</span>
          </NavLink>

          <NavLink
            to="/expenses"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
            end
          >
            <i className="fa-solid fa-list-ul"></i>
            <span>{isAdmin ? 'All Expense History' : 'My Expense History'}</span>
          </NavLink>

          <NavLink
            to="/bulk-import-export"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-file-arrow-up text-success"></i>
            <span>Bulk Data Import / Export</span>
            <span
              className="badge ms-auto"
              style={{
                fontSize: '0.6rem',
                padding: '2px 6px',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '6px',
                fontWeight: 700
              }}
            >
              NEW
            </span>
          </NavLink>

          <NavLink
            to="/funds"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-wallet text-success"></i>
            <span>Funds / Money In</span>
          </NavLink>

          <NavLink
            to="/settlements"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-handshake text-primary"></i>
            <span>Settle Up</span>
          </NavLink>

          <NavLink
            to="/activity"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>My Activity</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-chart-column"></i>
            <span>My Reports</span>
          </NavLink>

          <NavLink
            to="/budget"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-chart-pie"></i>
            <span>My Budget</span>
          </NavLink>

          {/* Account Section */}
          <div className="sidebar-section-title px-3 pt-3 pb-1" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>
            ACCOUNT
          </div>

          <NavLink
            to="/profile"
            className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <i className="fa-solid fa-user"></i>
            <span>My Profile</span>
          </NavLink>

          {isAdmin && (
            <>
              <NavLink
                to="/categories"
                className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <i className="fa-solid fa-tags"></i>
                <span>Categories</span>
              </NavLink>

              <NavLink
                to="/users"
                className={({ isActive }) => `fintech-nav-item ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <i className="fa-solid fa-users-gear"></i>
                <span>User Management</span>
              </NavLink>
            </>
          )}
        </div>

        {/* Sidebar Footer Logout Button */}
        <div className="sidebar-footer p-3 mt-auto">
          <button
            type="button"
            className="btn btn-sm w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
            style={{
              borderRadius: '10px',
              border: '1px solid #ef4444',
              background: 'transparent',
              color: '#ef4444',
              transition: 'all 0.2s ease'
            }}
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
