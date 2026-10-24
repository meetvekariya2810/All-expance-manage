import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { searchService } from '../services/searchService';
import { formatINR, formatDate } from '../utils/constants';

const SYSTEM_PAGES = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: 'fa-table-columns',
    color: '#2563eb',
    category: 'Overview',
    desc: 'Main financial metrics, summary cards & recent transactions',
    keywords: ['home', 'dashboard', 'overview', 'balance', 'chart', 'stat', 'analytics', 'fintech']
  },
  {
    title: 'Add Expense',
    path: '/add-expense',
    icon: 'fa-circle-plus',
    color: '#ef4444',
    category: 'Expenses',
    desc: 'Record a new personal expenditure transaction',
    keywords: ['add', 'create', 'new', 'spend', 'transaction', 'record', 'payment', 'receipt']
  },
  {
    title: 'My Expense History',
    path: '/expenses',
    icon: 'fa-list-check',
    color: '#3b82f6',
    category: 'Expenses',
    desc: 'View, filter, search and export all expense transactions',
    keywords: ['history', 'list', 'expenses', 'transactions', 'filter', 'export', 'search', 'ledger']
  },
  {
    title: 'Bulk Data Import / Export',
    path: '/bulk-import-export',
    icon: 'fa-file-excel',
    color: '#10b981',
    category: 'Tools',
    desc: 'Import expenses via Excel (XLSX, CSV) and download reports',
    keywords: ['excel', 'import', 'export', 'csv', 'bulk', 'upload', 'xlsx', 'spreadsheet', 'template']
  },
  {
    title: 'Funds / Money In',
    path: '/funds',
    icon: 'fa-vault',
    color: '#059669',
    category: 'Funds',
    desc: 'Manage incoming funds, deposits and available capital balance',
    keywords: ['funds', 'money in', 'deposit', 'received', 'pool', 'cash', 'balance', 'incoming']
  },
  {
    title: 'Settle Up / Settlements',
    path: '/settlements',
    icon: 'fa-handshake',
    color: '#6366f1',
    category: 'Settlements',
    desc: 'Reconcile money paid, received, or pending with persons',
    keywords: ['settle', 'settlement', 'reconciliation', 'person', 'borrow', 'lend', 'pending', 'paid', 'received']
  },
  {
    title: 'My Activity Log',
    path: '/activity',
    icon: 'fa-clock-rotate-left',
    color: '#8b5cf6',
    category: 'Audit',
    desc: 'Detailed chronological audit log of all system activities',
    keywords: ['activity', 'audit', 'logs', 'history', 'timeline', 'events', 'actions']
  },
  {
    title: 'My Reports & Analytics',
    path: '/reports',
    icon: 'fa-chart-pie',
    color: '#f59e0b',
    category: 'Reports',
    desc: 'Monthly breakdowns, visual charts, and PDF/Excel financial reports',
    keywords: ['reports', 'analytics', 'pdf', 'charts', 'summary', 'breakdown', 'monthly', 'download']
  },
  {
    title: 'My Budget Planner',
    path: '/budget',
    icon: 'fa-bullseye',
    color: '#ec4899',
    category: 'Budgeting',
    desc: 'Set category budgets and track spending limits vs actuals',
    keywords: ['budget', 'target', 'limit', 'plan', 'spending', 'category budget']
  },
  {
    title: 'Category Manager',
    path: '/categories',
    icon: 'fa-tags',
    color: '#06b6d4',
    category: 'Settings',
    desc: 'Organize and manage personal expense categories and icons',
    keywords: ['category', 'categories', 'tags', 'group', 'label']
  },
  {
    title: 'My Profile',
    path: '/profile',
    icon: 'fa-user',
    color: '#64748b',
    category: 'Account',
    desc: 'Manage personal user profile, credentials and settings',
    keywords: ['profile', 'account', 'settings', 'me', 'password', 'user info']
  },
  {
    title: 'User Management',
    path: '/users',
    icon: 'fa-users-gear',
    color: '#7c3aed',
    category: 'Admin',
    desc: 'Create, edit and manage team members and sub-accounts',
    keywords: ['users', 'members', 'admin', 'accounts', 'permissions', 'harsh', 'meet', 'roles'],
    adminOnly: true
  }
];

export default function GlobalSearch() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    expenses: [],
    funds: [],
    settlements: [],
    categories: [],
    users: []
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  // 1. Filter matching system navigation pages
  const matchedPages = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SYSTEM_PAGES.filter(p => {
      if (p.adminOnly && !isAdmin) return false;
      const titleMatch = p.title.toLowerCase().includes(q);
      const descMatch = p.desc.toLowerCase().includes(q);
      const catMatch = p.category.toLowerCase().includes(q);
      const keywordMatch = p.keywords.some(k => k.includes(q));
      return titleMatch || descMatch || catMatch || keywordMatch;
    }).slice(0, 4);
  }, [query, isAdmin]);

  // 2. Fetch backend search results with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults({
        expenses: [],
        funds: [],
        settlements: [],
        categories: [],
        users: []
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await searchService.globalSearch(trimmed);
        if (data.success && data.results) {
          setResults(data.results);
        }
      } catch (err) {
        console.warn('Global search query failed:', err);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  // Flattened actionable items for keyboard navigation
  const flatItems = useMemo(() => {
    const list = [];
    matchedPages.forEach(p => list.push({ type: 'page', data: p }));
    (results.expenses || []).forEach(e => list.push({ type: 'expense', data: e }));
    (results.funds || []).forEach(f => list.push({ type: 'fund', data: f }));
    (results.settlements || []).forEach(s => list.push({ type: 'settlement', data: s }));
    (results.categories || []).forEach(c => list.push({ type: 'category', data: c }));
    (results.users || []).forEach(u => list.push({ type: 'user', data: u }));
    return list;
  }, [matchedPages, results]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [flatItems.length, query]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        handleSelectItem(flatItems[selectedIndex]);
      } else if (query.trim()) {
        navigate(`/expenses?search=${encodeURIComponent(query.trim())}`);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectItem = (item) => {
    setIsOpen(false);
    setQuery('');
    if (!item) return;

    switch (item.type) {
      case 'page':
        navigate(item.data.path);
        break;
      case 'expense':
        navigate(`/expenses?search=${encodeURIComponent(item.data.expense_id || item.data.title)}`);
        break;
      case 'fund':
        navigate('/funds');
        break;
      case 'settlement':
        navigate('/settlements');
        break;
      case 'category':
        navigate(`/expenses?category=${encodeURIComponent(item.data.category_name || item.data.name)}`);
        break;
      case 'user':
        navigate('/users');
        break;
      default:
        break;
    }
  };

  const isDark = theme === 'dark';
  const hasResults = flatItems.length > 0;
  const isTyping = query.trim().length > 0;

  return (
    <div className="position-relative w-100" ref={containerRef} style={{ maxWidth: '440px' }}>
      {/* Search Input Bar */}
      <div className="input-group position-relative align-items-center">
        <i
          className="fa-solid fa-magnifying-glass position-absolute"
          style={{
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isDark ? '#94a3b8' : '#64748b',
            fontSize: '0.875rem',
            zIndex: 4,
            pointerEvents: 'none'
          }}
        ></i>

        <input
          ref={inputRef}
          type="text"
          id="globalQuickSearch"
          className="form-control"
          placeholder="Quick search transactions, categories, persons, pages..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{
            borderRadius: '9999px',
            paddingLeft: '38px',
            paddingRight: query ? '38px' : '14px',
            fontSize: '0.85rem',
            height: '38px',
            background: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'var(--border-color, #cbd5e1)',
            color: 'var(--text-main, #0f172a)',
            boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
            transition: 'all 0.2s ease'
          }}
        />

        {/* Clear or Spinner Indicator */}
        {loading ? (
          <div
            className="position-absolute d-flex align-items-center"
            style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}
          >
            <span className="spinner-border spinner-border-sm text-primary" style={{ width: '14px', height: '14px' }}></span>
          </div>
        ) : query ? (
          <button
            type="button"
            className="btn btn-sm border-0 position-absolute d-flex align-items-center justify-content-center p-0"
            onClick={() => {
              setQuery('');
              setResults({ expenses: [], funds: [], settlements: [], categories: [], users: [] });
              inputRef.current?.focus();
            }}
            style={{
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #94a3b8)',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              zIndex: 4
            }}
            title="Clear search"
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '0.75rem' }}></i>
          </button>
        ) : null}
      </div>

      {/* Floating Results Popover */}
      {isOpen && isTyping && (
        <div
          className="global-search-dropdown shadow-2xl"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '100%',
            minWidth: '380px',
            maxWidth: '560px',
            maxHeight: '480px',
            overflowY: 'auto',
            background: isDark ? '#1e293b' : '#ffffff',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.3)',
            zIndex: 1070,
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header Summary */}
          <div
            className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
              background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
              fontSize: '0.75rem'
            }}
          >
            <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
              Search Results for <strong style={{ color: 'var(--text-main, #0f172a)' }}>"{query}"</strong>
            </span>
            <span className="badge bg-primary-subtle text-primary rounded-pill">
              {flatItems.length} match{flatItems.length === 1 ? '' : 'es'}
            </span>
          </div>

          <div className="py-2">
            {/* 1. System Navigation Pages */}
            {matchedPages.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center gap-1"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <i className="fa-solid fa-compass me-1 text-primary"></i>
                  <span>Navigation & Quick Access</span>
                </div>
                {matchedPages.map((page) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'page' && it.data.path === page.path);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={page.path}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'page', data: page })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '32px',
                            height: '32px',
                            background: page.color + '22',
                            color: page.color
                          }}
                        >
                          <i className={`fa-solid ${page.icon}`} style={{ fontSize: '0.85rem' }}></i>
                        </div>
                        <div className="text-truncate">
                          <div className="fw-semibold text-truncate" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                            {page.title}
                          </div>
                          <small className="text-truncate d-block" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                            {page.desc}
                          </small>
                        </div>
                      </div>
                      <i className="fa-solid fa-arrow-right text-muted ms-2" style={{ fontSize: '0.75rem' }}></i>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Expenses Results */}
            {results.expenses && results.expenses.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center justify-content-between"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <span>
                    <i className="fa-solid fa-credit-card me-1 text-danger"></i>
                    Expenses & Transactions
                  </span>
                  <span className="badge bg-secondary-subtle text-secondary rounded-pill">{results.expenses.length}</span>
                </div>
                {results.expenses.map((exp) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'expense' && (it.data.expense_id === exp.expense_id || it.data._id === exp._id));
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={exp.expense_id || exp._id}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'expense', data: exp })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444'
                          }}
                        >
                          <i className="fa-solid fa-receipt" style={{ fontSize: '0.85rem' }}></i>
                        </div>
                        <div className="text-truncate">
                          <div className="fw-semibold text-truncate" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                            {exp.title}
                          </div>
                          <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                            <span className="badge bg-light text-dark border py-0 px-1">{exp.category}</span>
                            <span>{formatDate(exp.expense_date)}</span>
                            {exp.created_by && <span>• {exp.created_by}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-end ms-2 flex-shrink-0">
                        <span className="fw-bold text-danger" style={{ fontSize: '0.9rem' }}>
                          -{formatINR(exp.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Funds Results */}
            {results.funds && results.funds.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center justify-content-between"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <span>
                    <i className="fa-solid fa-vault me-1 text-success"></i>
                    Funds / Money In
                  </span>
                  <span className="badge bg-success-subtle text-success rounded-pill">{results.funds.length}</span>
                </div>
                {results.funds.map((fund) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'fund' && (it.data.fund_id === fund.fund_id || it.data._id === fund._id));
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={fund.fund_id || fund._id}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'fund', data: fund })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981'
                          }}
                        >
                          <i className="fa-solid fa-arrow-down-left" style={{ fontSize: '0.85rem' }}></i>
                        </div>
                        <div className="text-truncate">
                          <div className="fw-semibold text-truncate" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                            {fund.person_name}
                          </div>
                          <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                            <span>{fund.fund_id}</span>
                            <span>• {formatDate(fund.fund_date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-end ms-2 flex-shrink-0">
                        <span className="fw-bold text-success" style={{ fontSize: '0.9rem' }}>
                          +{formatINR(fund.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. Settlements Results */}
            {results.settlements && results.settlements.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center justify-content-between"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <span>
                    <i className="fa-solid fa-handshake me-1 text-primary"></i>
                    Settlements (Settle Up)
                  </span>
                  <span className="badge bg-primary-subtle text-primary rounded-pill">{results.settlements.length}</span>
                </div>
                {results.settlements.map((settle) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'settlement' && (it.data.settlement_id === settle.settlement_id || it.data._id === settle._id));
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={settle.settlement_id || settle._id}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'settlement', data: settle })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#6366f1'
                          }}
                        >
                          <i className="fa-solid fa-user-tag" style={{ fontSize: '0.85rem' }}></i>
                        </div>
                        <div className="text-truncate">
                          <div className="fw-semibold text-truncate" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                            {settle.person_name}
                          </div>
                          <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                            <span className={`badge py-0 px-1 ${settle.settlement_type === 'Paid' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                              {settle.settlement_type}
                            </span>
                            <span className="badge bg-secondary-subtle text-secondary py-0 px-1">{settle.status}</span>
                            <span>{formatDate(settle.settlement_date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-end ms-2 flex-shrink-0">
                        <span className={`fw-bold ${settle.settlement_type === 'Paid' ? 'text-danger' : 'text-success'}`} style={{ fontSize: '0.9rem' }}>
                          {settle.settlement_type === 'Paid' ? `-${formatINR(settle.amount)}` : `+${formatINR(settle.amount)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. Categories Results */}
            {results.categories && results.categories.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center justify-content-between"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <span>
                    <i className="fa-solid fa-tags me-1 text-info"></i>
                    Categories
                  </span>
                  <span className="badge bg-info-subtle text-info rounded-pill">{results.categories.length}</span>
                </div>
                {results.categories.map((cat) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'category' && (it.data.category_name === cat.category_name || it.data.name === cat.name));
                  const isSelected = itemIndex === selectedIndex;
                  const catName = cat.category_name || cat.name;
                  return (
                    <div
                      key={catName}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'category', data: cat })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '28px',
                            height: '28px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: '#06b6d4'
                          }}
                        >
                          <i className={`fa-solid ${cat.icon || 'fa-tag'}`} style={{ fontSize: '0.75rem' }}></i>
                        </div>
                        <span className="fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                          {catName}
                        </span>
                      </div>
                      <span className="badge bg-light text-muted border" style={{ fontSize: '0.7rem' }}>
                        View Expenses <i className="fa-solid fa-arrow-right ms-1"></i>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 6. Users Results (Admin) */}
            {isAdmin && results.users && results.users.length > 0 && (
              <div className="mb-2">
                <div
                  className="px-3 py-1 text-uppercase fw-bold d-flex align-items-center justify-content-between"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <span>
                    <i className="fa-solid fa-users me-1 text-primary"></i>
                    Team Users
                  </span>
                  <span className="badge bg-primary-subtle text-primary rounded-pill">{results.users.length}</span>
                </div>
                {results.users.map((u) => {
                  const itemIndex = flatItems.findIndex(it => it.type === 'user' && it.data.username === u.username);
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={u.username}
                      className="px-3 py-2 d-flex align-items-center justify-content-between cursor-pointer"
                      onClick={() => handleSelectItem({ type: 'user', data: u })}
                      style={{
                        background: isSelected ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '28px',
                            height: '28px',
                            background: 'rgba(37, 99, 235, 0.15)',
                            color: '#2563eb',
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        >
                          {u.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span className="fw-semibold d-block" style={{ fontSize: '0.85rem', color: 'var(--text-main, #0f172a)' }}>
                            {u.name} (@{u.username})
                          </span>
                          <small style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>{u.email}</small>
                        </div>
                      </div>
                      <span className="badge bg-secondary-subtle text-secondary">{u.role}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && !hasResults && (
              <div className="p-4 text-center">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                  style={{ width: '44px', height: '44px', background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9', color: 'var(--text-muted, #94a3b8)' }}
                >
                  <i className="fa-solid fa-magnifying-glass fs-5"></i>
                </div>
                <h6 className="fw-semibold mb-1" style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.9rem' }}>
                  No exact matches found for "{query}"
                </h6>
                <p className="small mb-3" style={{ color: 'var(--text-muted, #64748b)' }}>
                  Try searching for a transaction title, person name, category, or amount.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-primary-custom px-3 py-1"
                  onClick={() => {
                    navigate(`/expenses?search=${encodeURIComponent(query.trim())}`);
                    setIsOpen(false);
                  }}
                >
                  Search in Expense History <i className="fa-solid fa-arrow-right ms-1"></i>
                </button>
              </div>
            )}
          </div>

          {/* Footer Navigation Hints */}
          {hasResults && (
            <div
              className="px-3 py-2 border-top d-flex align-items-center justify-content-between"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
                fontSize: '0.72rem',
                color: 'var(--text-muted, #94a3b8)'
              }}
            >
              <span>
                <kbd className="me-1 px-1 py-0.5 rounded" style={{ fontSize: '0.65rem' }}>↑</kbd>
                <kbd className="me-1 px-1 py-0.5 rounded" style={{ fontSize: '0.65rem' }}>↓</kbd>
                Navigate
                <kbd className="ms-2 me-1 px-1 py-0.5 rounded" style={{ fontSize: '0.65rem' }}>↵</kbd>
                Select
                <kbd className="ms-2 me-1 px-1 py-0.5 rounded" style={{ fontSize: '0.65rem' }}>ESC</kbd>
                Close
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                style={{ fontSize: '0.72rem', color: '#2563eb' }}
                onClick={() => {
                  navigate(`/expenses?search=${encodeURIComponent(query.trim())}`);
                  setIsOpen(false);
                }}
              >
                All results in Expenses ➔
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
