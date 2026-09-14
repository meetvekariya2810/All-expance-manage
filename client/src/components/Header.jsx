import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ toggleMobileMenu }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/expenses?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleRefresh = () => {
    window.dispatchEvent(new Event('app:refresh'));
  };

  return (
    <header className="app-header">
      <div className="d-flex align-items-center gap-3">
        <button
          className="mobile-nav-toggle"
          id="mobileNavToggleBtn"
          aria-label="Open navigation menu"
          onClick={toggleMobileMenu}
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        <form className="header-search" onSubmit={handleSearchSubmit}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            id="globalQuickSearch"
            placeholder="Quick search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="header-actions">
        {/* Theme Switcher */}
        <button
          className="btn-icon"
          id="themeToggleBtn"
          title="Toggle Theme"
          aria-label="Toggle light or dark theme"
          onClick={toggleTheme}
        >
          <i className={theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
        </button>

        {/* Global Refresh Button */}
        <button
          className="btn-icon"
          title="Refresh View"
          aria-label="Refresh view data"
          onClick={handleRefresh}
        >
          <i className="fa-solid fa-arrows-rotate"></i>
        </button>

        {/* User Profile Dropdown */}
        <div className="dropdown position-relative">
          <button
            className="btn-user-profile dropdown-toggle"
            type="button"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-expanded={dropdownOpen}
          >
            <div className="user-avatar-sm">
              <i className="fa-solid fa-user"></i>
            </div>
            <div className="d-none d-md-block text-start lh-sm">
              <div className="fw-bold small current-user-name">{user?.name || 'User'}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                <span className="current-user-role">
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="position-fixed top-0 start-0 w-100 h-100"
                style={{ zIndex: 1000 }}
                onClick={() => setDropdownOpen(false)}
              />
              <ul
                className="dropdown-menu dropdown-menu-end glass-card border-0 shadow py-2 show position-absolute end-0 mt-2"
                style={{ zIndex: 1001, minWidth: '180px' }}
              >
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                  >
                    <i className="fa-solid fa-user-gear text-primary"></i> My Profile
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2"
                    onClick={() => { setDropdownOpen(false); navigate('/expenses'); }}
                  >
                    <i className="fa-solid fa-receipt text-success"></i> My Expenses
                  </button>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button
                    className="dropdown-item text-danger d-flex align-items-center gap-2"
                    onClick={async () => {
                      setDropdownOpen(false);
                      await logout();
                      navigate('/login', { replace: true });
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
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
