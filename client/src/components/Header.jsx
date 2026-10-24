import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import GlobalSearch from './GlobalSearch';

export default function Header({ toggleMobileMenu }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('Oct 2026');
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.dispatchEvent(new Event('app:refresh'));
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'M';

  return (
    <header className="app-header d-flex align-items-center justify-content-between px-3 py-2" style={{ background: 'var(--header-bg, #ffffff)', borderBottom: '1px solid var(--border-color, #e2e8f0)', minHeight: '64px' }}>
      {/* Left: Mobile Nav Toggle & Quick Search */}
      <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ maxWidth: '460px' }}>
        <button
          className="mobile-nav-toggle"
          id="mobileNavToggleBtn"
          aria-label="Open navigation menu"
          onClick={toggleMobileMenu}
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        <GlobalSearch />
      </div>

      {/* Right Controls matching Screenshot */}
      <div className="d-flex align-items-center gap-2 gap-md-3">
        {/* Date Selector Pill */}
        <div
          className="d-none d-sm-flex align-items-center gap-2 px-3 py-1 rounded-pill"
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            fontSize: '0.84rem',
            fontWeight: 500,
            color: 'var(--text-main, #0f172a)',
            cursor: 'pointer'
          }}
          title="Reporting Period"
        >
          <i className="fa-regular fa-calendar text-muted"></i>
          <span>{selectedMonth}</span>
          <i className="fa-solid fa-chevron-down text-muted" style={{ fontSize: '0.65rem' }}></i>
        </div>

        {/* Refresh Button */}
        <button
          className="btn btn-sm d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            fontSize: '0.84rem',
            fontWeight: 500,
            color: 'var(--text-main, #0f172a)'
          }}
          onClick={handleRefresh}
          title="Refresh Dashboard"
        >
          <i className="fa-solid fa-arrows-rotate text-muted" style={{ fontSize: '0.8rem' }}></i>
          <span className="d-none d-md-inline">Refresh</span>
        </button>

        {/* Theme Toggle (Moon / Sun) */}
        <button
          className="btn btn-sm d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: '36px',
            height: '36px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main, #334155)',
            fontSize: '1rem'
          }}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          <i className={theme === 'dark' ? 'fa-solid fa-sun text-warning' : 'fa-solid fa-moon text-dark'}></i>
        </button>

        {/* Notification Bell */}
        <button
          className="btn btn-sm position-relative d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: '36px',
            height: '36px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main, #334155)',
            fontSize: '1.05rem'
          }}
          title="Notifications"
        >
          <i className="fa-solid fa-bell"></i>
          <span
            className="position-absolute"
            style={{
              top: '8px',
              right: '8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: '2px solid #ffffff'
            }}
          />
        </button>

        {/* User Pill Dropdown matching Screenshot */}
        <div className="position-relative">
          <button
            className="btn btn-sm d-flex align-items-center gap-2 px-2 py-1 rounded-pill"
            type="button"
            style={{
              background: 'transparent',
              border: 'none'
            }}
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-expanded={dropdownOpen}
          >
            <div
              className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
              style={{
                width: '32px',
                height: '32px',
                background: '#2563eb',
                fontSize: '0.85rem'
              }}
            >
              {userInitial}
            </div>
            <span className="d-none d-md-inline fw-semibold small" style={{ color: 'var(--text-main, #0f172a)' }}>
              {user?.name || 'Meet'}
            </span>
            <i className="fa-solid fa-chevron-down text-muted" style={{ fontSize: '0.65rem' }}></i>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="position-fixed top-0 start-0 w-100 h-100"
                style={{ zIndex: 1000 }}
                onClick={() => setDropdownOpen(false)}
              />
              <ul
                className="dropdown-menu dropdown-menu-end border shadow-sm py-2 show position-absolute end-0 mt-2"
                style={{
                  zIndex: 1001,
                  minWidth: '180px',
                  borderRadius: '12px',
                  background: 'var(--card-bg, #ffffff)',
                  borderColor: 'var(--border-color, #e2e8f0)'
                }}
              >
                <li>
                  <div className="px-3 py-1">
                    <div className="fw-bold small" style={{ color: 'var(--text-main, #0f172a)' }}>{user?.name || 'User'}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                    </div>
                  </div>
                </li>
                <li><hr className="dropdown-divider my-1" style={{ borderColor: 'var(--border-color, #e2e8f0)' }} /></li>
                <li>
                  <button
                    className="dropdown-item small d-flex align-items-center gap-2 py-2"
                    onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                  >
                    <i className="fa-solid fa-user-circle text-muted"></i>
                    <span>My Profile</span>
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item small d-flex align-items-center gap-2 py-2 text-danger"
                    onClick={async () => {
                      setDropdownOpen(false);
                      await logout();
                      navigate('/login', { replace: true });
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                    <span>Log Out</span>
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
