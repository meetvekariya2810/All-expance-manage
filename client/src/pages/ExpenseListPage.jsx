import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { categoryService } from '../services/categoryService';
import { reportService } from '../services/reportService';
import { formatINR, formatDate, PAYMENT_METHODS, DATE_PRESETS, SORT_OPTIONS } from '../utils/constants';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ReceiptModal from '../components/ReceiptModal';

export default function ExpenseListPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [person, setPerson] = useState('all');
  const [datePreset, setDatePreset] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortValue, setSortValue] = useState('date_desc');

  // Pagination & data states
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [expenses, setExpenses] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSum, setPageSum] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [activeExpenseDetails, setActiveExpenseDetails] = useState(null);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Debounce search timer ref
  const searchTimeoutRef = useRef(null);

  // Calculate preset dates
  const applyPreset = useCallback((preset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      setStartDate(monday.toISOString().slice(0, 10));
      setEndDate(new Date().toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'this_year') {
      const firstDay = `${now.getFullYear()}-01-01`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
    setPage(1);
  }, []);

  // Initialize date preset on mount
  useEffect(() => {
    applyPreset('this_month');
    categoryService.getCategories().then(res => {
      if (res.success) setCategories(res.categories || []);
    });
  }, [applyPreset]);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const sortOpt = SORT_OPTIONS.find(s => s.value === sortValue) || SORT_OPTIONS[0];
      const params = {
        page,
        limit,
        sortBy: sortOpt.sortBy,
        sortOrder: sortOpt.sortOrder
      };

      if (search.trim()) params.search = search.trim();
      if (category !== 'all') params.category = category;
      if (paymentMethod !== 'all') params.payment_method = paymentMethod;
      if (isAdmin && person !== 'all') params.person = person;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await expenseService.getExpenses(params);
      if (data.success) {
        setExpenses(data.expenses || []);
        setTotalRecords(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPageSum(data.sum || 0);
      }
    } catch (err) {
      showToast('Error loading expenses: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, category, paymentMethod, person, startDate, endDate, sortValue, isAdmin, showToast]);

  useEffect(() => {
    fetchExpenses();

    const handleRefresh = () => fetchExpenses();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchExpenses]);

  // Debounced search handler
  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setPaymentMethod('all');
    setPerson('all');
    setSortValue('date_desc');
    applyPreset('this_month');
    setSelectedIds([]);
  };

  // Row selection
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(expenses.map(exp => exp.id || exp._id));
    } else {
      setSelectedIds([]);
    }
  };

  const getUserBadgeColor = (userName) => {
    const name = (userName || '').toLowerCase();
    if (name.includes('bhavik')) return 'badge bg-primary text-white';
    if (name.includes('meet')) return 'badge bg-success text-white';
    if (name.includes('harsh')) return 'badge bg-warning text-dark';
    return 'badge bg-secondary text-white';
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Single Delete
  const handleDelete = async (exp) => {
    if (!window.confirm(`Are you sure you want to delete "${exp.title}"?`)) return;
    try {
      await expenseService.deleteExpense(exp.id || exp._id);
      showToast('Expense record deleted.', 'success');
      setActiveExpenseDetails(null);
      fetchExpenses();
    } catch (err) {
      showToast('Failed to delete expense.', 'error');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected expenses?`)) return;
    try {
      const res = await expenseService.bulkDeleteExpenses(selectedIds);
      showToast(res.message || 'Records deleted successfully.', 'success');
      setSelectedIds([]);
      fetchExpenses();
    } catch (err) {
      showToast('Error during bulk deletion.', 'error');
    }
  };

  // Erase All
  const handleEraseAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to erase ALL matching expense records? This cannot be undone!')) return;
    try {
      const res = await expenseService.clearAllExpenses(person);
      showToast(res.message || 'All records cleared.', 'success');
      setSelectedIds([]);
      fetchExpenses();
    } catch (err) {
      showToast('Error clearing records.', 'error');
    }
  };

  // Export handlers
  const handleExport = async (type) => {
    setExportDropdownOpen(false);
    showToast(`Generating ${type.toUpperCase()} statement...`, 'info');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category !== 'all') params.category = category;
      if (paymentMethod !== 'all') params.payment_method = paymentMethod;
      if (isAdmin && person !== 'all') params.person = person;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      await reportService.downloadExport(type, params);
      showToast(`${type.toUpperCase()} statement downloaded!`, 'success');
    } catch (err) {
      showToast('Export failed. ' + (err.message || ''), 'error');
    }
  };

  return (
    <div className="view-container active">
      {/* Title box */}
      <div className="page-title-box">
        <div>
          <h3>Expense Records List</h3>
          <p>Filter, search, view receipts, and manage all financial transactions</p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {selectedIds.length > 0 && (
            <button className="btn btn-danger-custom" onClick={handleBulkDelete}>
              <i className="fa-solid fa-trash me-1"></i> Bulk Delete ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-outline-danger" onClick={handleEraseAll}>
            <i className="fa-solid fa-broom me-1"></i> Erase All
          </button>
          <button className="btn btn-primary-custom" onClick={() => navigate('/expenses/new')}>
            <i className="fa-solid fa-plus me-1"></i> Add Expense
          </button>
        </div>
      </div>

      {/* Multi-filter bar Card */}
      <div className="glass-card p-3 mb-4">
        <div className="row g-2 align-items-center">
          {/* Search box */}
          <div className="col-12 col-md-3">
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search ID, title, vendor..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="col-6 col-md-2">
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

          {/* Payment filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={paymentMethod}
              onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            >
              <option value="all">All Payments</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          {/* Person filter (admin-only) */}
          {isAdmin && (
            <div className="col-6 col-md-2">
              <select
                className="form-select"
                value={person}
                onChange={(e) => { setPerson(e.target.value); setPage(1); }}
              >
                <option value="all">All Members</option>
                <option value="bhavik">Bhavik Bhai</option>
                <option value="meet">Meet</option>
                <option value="harsh">Harsh</option>
              </select>
            </div>
          )}

          {/* Date Preset */}
          <div className="col-6 col-md-3">
            <select
              className="form-select"
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="col-6 col-md-2">
            <input
              type="date"
              className="form-control"
              title="Start Date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); setPage(1); }}
            />
          </div>
          <div className="col-6 col-md-2">
            <input
              type="date"
              className="form-control"
              title="End Date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); setPage(1); }}
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={sortValue}
              onChange={(e) => { setSortValue(e.target.value); setPage(1); }}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Reset & Export Actions */}
          <div className="col-12 col-md-4 ms-auto d-flex gap-2 justify-content-end position-relative">
            <button
              className="btn btn-secondary-custom flex-grow-1 flex-md-grow-0"
              onClick={handleResetFilters}
            >
              <i className="fa-solid fa-arrow-rotate-left me-1"></i> Reset
            </button>

            <div className="dropdown position-relative">
              <button
                className="btn btn-secondary-custom dropdown-toggle"
                type="button"
                onClick={() => setExportDropdownOpen(prev => !prev)}
              >
                <i className="fa-solid fa-file-export me-1"></i> Export
              </button>

              {exportDropdownOpen && (
                <>
                  <div
                    className="position-fixed top-0 start-0 w-100 h-100"
                    style={{ zIndex: 1000 }}
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <ul
                    className="dropdown-menu dropdown-menu-end glass-card border-0 shadow show position-absolute end-0 mt-2"
                    style={{ zIndex: 1001, minWidth: '200px' }}
                  >
                    <li>
                      <button
                        className="dropdown-item d-flex align-items-center gap-2"
                        onClick={() => handleExport('pdf')}
                      >
                        <i className="fa-solid fa-file-pdf text-danger"></i> PDF Statement
                      </button>
                    </li>
                    <li>
                      <button
                        className="dropdown-item d-flex align-items-center gap-2"
                        onClick={() => handleExport('excel')}
                      >
                        <i className="fa-solid fa-file-excel text-success"></i> Excel Spreadsheet (.xlsx)
                      </button>
                    </li>
                    <li>
                      <button
                        className="dropdown-item d-flex align-items-center gap-2"
                        onClick={() => handleExport('csv')}
                      >
                        <i className="fa-solid fa-file-csv text-primary"></i> CSV Spreadsheet (.csv)
                      </button>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="d-flex align-items-center justify-content-between mb-3 px-1 text-muted small flex-wrap gap-2">
        <span className="fw-semibold">
          {loading ? 'Loading records...' : `Showing ${expenses.length} of ${totalRecords} matching records`}
        </span>
        <span className="fw-bold text-primary">
          Page Total: {formatINR(pageSum)}
        </span>
      </div>

      {/* Expense Table Container */}
      <div className="glass-card p-3 p-md-4">
        <div className="table-glass-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={expenses.length > 0 && selectedIds.length === expenses.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all expenses"
                  />
                </th>
                <th>ID</th>
                <th>Date & Time</th>
                <th>Title & Vendor</th>
                <th>Member</th>
                <th>Category</th>
                <th className="text-end">Amount</th>
                <th>Payment</th>
                <th className="text-center">Receipt</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Retrieving records...
                  </td>
                </tr>
              ) : expenses.length > 0 ? (
                expenses.map((item) => {
                  const expId = item.id || item._id;
                  const isChecked = selectedIds.includes(expId);
                  return (
                    <tr key={expId} className={isChecked ? 'table-active' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(expId)}
                        />
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border font-monospace">
                          {item.expense_id || expId}
                        </span>
                      </td>
                      <td>
                        <div>{formatDate(item.expense_date)}</div>
                        <small className="text-muted">{item.expense_time || '12:00'}</small>
                      </td>
                      <td>
                        <div className="fw-bold">{item.title}</div>
                        {item.vendor && (
                          <small className="text-muted">
                            <i className="fa-solid fa-store me-1"></i>
                            {item.vendor}
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={getUserBadgeColor(item.user_name)}>
                          {item.user_name || 'Member'}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary">
                          {item.category}
                        </span>
                      </td>
                      <td className="text-end fw-bold text-primary">
                        {formatINR(item.amount)}
                      </td>
                      <td>
                        <span className="small text-muted">{item.payment_method}</span>
                      </td>
                      <td className="text-center">
                        {item.receipt ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-icon"
                            title="View Receipt"
                            onClick={() => setActiveReceiptUrl(item.receipt)}
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
                            onClick={() => setActiveExpenseDetails(item)}
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-1 px-2"
                            title="Edit Record"
                            onClick={() => navigate(`/expenses/edit/${expId}`)}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            title="Delete Record"
                            onClick={() => handleDelete(item)}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    No expense records found matching current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-2">
          <div className="text-muted small">
            Showing page <span className="fw-bold">{page}</span> of {totalPages} ({totalRecords} items)
          </div>
          <ul className="pagination mb-0">
            <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
            </li>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && page > 3) {
                pageNum = page - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - 4 + i;
              }
              return (
                <li key={pageNum} className={`page-item ${page === pageNum ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setPage(pageNum)}>
                    {pageNum}
                  </button>
                </li>
              );
            })}
            <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Modals */}
      <ExpenseDetailsModal
        expense={activeExpenseDetails}
        onClose={() => setActiveExpenseDetails(null)}
        onViewReceipt={(url) => setActiveReceiptUrl(url)}
        onEdit={(exp) => navigate(`/expenses/edit/${exp.id || exp._id}`)}
        onDelete={(exp) => handleDelete(exp)}
      />

      <ReceiptModal
        receiptUrl={activeReceiptUrl}
        onClose={() => setActiveReceiptUrl(null)}
      />
    </div>
  );
}
