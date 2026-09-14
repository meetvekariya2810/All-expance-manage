import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { categoryService } from '../services/categoryService';
import { formatINR, formatDate, PAYMENT_METHODS } from '../utils/constants';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ReceiptModal from '../components/ReceiptModal';

export default function ExpenseMonitoringPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Filters
  const [selectedUser, setSelectedUser] = useState('all');
  const [category, setCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSum, setTotalSum] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);

  const searchTimerRef = useRef(null);

  useEffect(() => {
    categoryService.getCategories().then(res => {
      if (res.success) setCategories(res.categories || []);
    });
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 25,
        sortBy: 'expense_date',
        sortOrder: 'desc'
      };

      if (selectedUser !== 'all') params.person = selectedUser;
      if (category !== 'all') params.category = category;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search.trim()) params.search = search.trim();

      const data = await expenseService.getExpenses(params);
      if (data.success) {
        setExpenses(data.expenses || []);
        setTotalExpenses(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setTotalSum(data.sum || 0);
      }
    } catch (err) {
      showToast('Error loading monitoring data: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, category, startDate, endDate, search, page, showToast]);

  useEffect(() => {
    fetchMonitoringData();
    const handleRefresh = () => fetchMonitoringData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchMonitoringData]);

  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const resetFilters = () => {
    setSelectedUser('all');
    setCategory('all');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
  };

  const getUserBadgeColor = (userName) => {
    const name = (userName || '').toLowerCase();
    if (name.includes('bhavik')) return 'badge bg-primary text-white';
    if (name.includes('meet')) return 'badge bg-success text-white';
    if (name.includes('harsh')) return 'badge bg-warning text-dark';
    return 'badge bg-secondary text-white';
  };

  return (
    <div className="view-container active">
      {/* Page Title */}
      <div className="page-title-box">
        <div>
          <h3>
            <i className="fa-solid fa-users-viewfinder me-2 text-primary"></i>
            Admin Expense Monitoring Center
          </h3>
          <p>
            Centralized monitoring hub for Bhavik Bhai to track, audit, and inspect all expenses from Meet & Harsh
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <button className="btn btn-secondary-custom" onClick={fetchMonitoringData}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
          </button>
          <button className="btn btn-primary-custom" onClick={() => navigate('/expenses/new')}>
            <i className="fa-solid fa-plus me-1"></i> New Entry
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card p-3 mb-4">
        <div className="row g-2 align-items-center">
          {/* User Filter */}
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted mb-1">Filter User / Creator:</label>
            <select
              className="form-select"
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
            >
              <option value="all">👥 All Members (Global)</option>
              <option value="bhavik">👤 Bhavik Bhai (Admin)</option>
              <option value="meet">👤 Meet (Sub-Account)</option>
              <option value="harsh">👤 Harsh (Sub-Account)</option>
            </select>
          </div>

          {/* Search */}
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted mb-1">Search Keyword:</label>
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search ID, title, vendor, user..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">Category:</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c._id} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">From Date:</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>

          {/* Date To */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">To Date:</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>

          {/* Reset Button */}
          <div className="col-6 col-md-12 text-end mt-2">
            <button className="btn btn-sm btn-secondary-custom" onClick={resetFilters}>
              <i className="fa-solid fa-arrow-rotate-left me-1"></i> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="glass-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-wrapper bg-primary text-white">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <span className="text-muted small">Matching Records</span>
              <h4 className="fw-bold mb-0">{totalExpenses}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-wrapper bg-success text-white">
              <i className="fa-solid fa-indian-rupee-sign"></i>
            </div>
            <div>
              <span className="text-muted small">Total Monitored Spend</span>
              <h4 className="fw-bold mb-0 text-primary">{formatINR(totalSum)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="glass-card p-3 d-flex align-items-center gap-3">
            <div className="stat-icon-wrapper bg-info text-white">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <span className="text-muted small">Current Scope</span>
              <h5 className="fw-bold mb-0 text-capitalize">
                {selectedUser === 'all' ? 'All Family Members' : selectedUser}
              </h5>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Records Table / Cards */}
      <div className="glass-card p-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h5 className="fw-bold mb-0">
            <i className="fa-solid fa-list-check me-2 text-primary"></i>
            Expense Audit & Monitoring Records
          </h5>
          <span className="small text-muted">
            Showing page {page} of {totalPages}
          </span>
        </div>

        {/* Desktop / Laptop Table Layout */}
        <div className="table-glass-container d-none d-md-block">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Created By</th>
                <th>Expense Details</th>
                <th>Category</th>
                <th className="text-end">Amount</th>
                <th>Date & Time</th>
                <th>Payment</th>
                <th className="text-center">Receipt</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Retrieving monitored expenses...
                  </td>
                </tr>
              ) : expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr key={exp._id || exp.id || exp.expense_id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className={getUserBadgeColor(exp.user_name)}>
                          {exp.user_name || 'Member'}
                        </span>
                      </div>
                      <small className="text-muted font-monospace">{exp.expense_id}</small>
                    </td>
                    <td>
                      <div className="fw-bold">{exp.title}</div>
                      {exp.vendor && (
                        <small className="text-muted">
                          <i className="fa-solid fa-store me-1"></i>
                          {exp.vendor} {exp.location ? `• ${exp.location}` : ''}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {exp.category}
                      </span>
                    </td>
                    <td className="text-end fw-bold fs-6 text-primary">
                      {formatINR(exp.amount)}
                    </td>
                    <td>
                      <div>{formatDate(exp.expense_date)}</div>
                      <small className="text-muted">{exp.expense_time || '12:00'}</small>
                    </td>
                    <td>
                      <span className="small text-muted">{exp.payment_method}</span>
                    </td>
                    <td className="text-center">
                      {exp.receipt ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-icon"
                          title="View Receipt"
                          onClick={() => setReceiptUrl(exp.receipt)}
                        >
                          <i className="fa-solid fa-paperclip text-primary"></i>
                        </button>
                      ) : (
                        <span className="text-muted small">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary py-1 px-2"
                          title="View Details"
                          onClick={() => setSelectedExpense(exp)}
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-1 px-2"
                          title="Edit"
                          onClick={() => navigate(`/expenses/edit/${exp.id || exp._id}`)}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    No expense records found matching current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards Layout */}
        <div className="d-block d-md-none">
          {loading ? (
            <div className="text-center py-4 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2"></div>
              Loading...
            </div>
          ) : expenses.length > 0 ? (
            expenses.map((exp) => (
              <div key={exp._id || exp.id} className="glass-card p-3 mb-3 border">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className={getUserBadgeColor(exp.user_name)}>
                    {exp.user_name || 'Member'}
                  </span>
                  <span className="fw-bold fs-5 text-primary">
                    {formatINR(exp.amount)}
                  </span>
                </div>
                <h6 className="fw-bold mb-1">{exp.title}</h6>
                <div className="small text-muted mb-2">
                  <span>{exp.category}</span> • <span>{exp.payment_method}</span>
                  {exp.vendor && <span> • {exp.vendor}</span>}
                </div>
                <div className="d-flex justify-content-between align-items-center small text-muted border-top pt-2">
                  <span>
                    <i className="fa-regular fa-calendar me-1"></i>
                    {formatDate(exp.expense_date)}
                  </span>
                  <div className="d-flex gap-2">
                    {exp.receipt && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary py-0 px-2"
                        onClick={() => setReceiptUrl(exp.receipt)}
                      >
                        <i className="fa-solid fa-paperclip me-1"></i> Receipt
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-primary-custom py-0 px-2"
                      onClick={() => setSelectedExpense(exp)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted">
              No matching records.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top flex-wrap gap-2">
            <span className="small text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-secondary-custom"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary-custom"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExpenseDetailsModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onViewReceipt={(url) => setReceiptUrl(url)}
        onEdit={(exp) => navigate(`/expenses/edit/${exp.id || exp._id}`)}
      />

      <ReceiptModal
        receiptUrl={receiptUrl}
        onClose={() => setReceiptUrl(null)}
      />
    </div>
  );
}
