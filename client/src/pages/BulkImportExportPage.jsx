import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import { formatINR, formatDate, PAYMENT_METHODS, DATE_PRESETS } from '../utils/constants';

export default function BulkImportExportPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Active Main Tab: 'import' | 'export' | 'history'
  const [activeTab, setActiveTab] = useState('import');

  // ==========================================
  // 1. IMPORT STATE
  // ==========================================
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [adminTargetUser, setAdminTargetUser] = useState('auto');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [customMapping, setCustomMapping] = useState({});

  // System reference lists
  const [categories, setCategories] = useState([]);
  const [userList, setUserList] = useState([]);

  const fileInputRef = useRef(null);

  // ==========================================
  // 2. EXPORT STATE
  // ==========================================
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportCategory, setExportCategory] = useState('all');
  const [exportPayment, setExportPayment] = useState('all');
  const [exportPerson, setExportPerson] = useState('all');
  const [exportMinAmount, setExportMinAmount] = useState('');
  const [exportMaxAmount, setExportMaxAmount] = useState('');
  const [exportSearch, setExportSearch] = useState('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // ==========================================
  // 3. IMPORT HISTORY STATE
  // ==========================================
  const [historyBatches, setHistoryBatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);

  // Load initial categories & users
  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const catRes = await categoryService.getCategories();
        if (catRes.success && catRes.data) setCategories(catRes.data);
      } catch (e) {}

      if (isAdmin) {
        try {
          const userRes = await userService.getUsers();
          if (userRes.success && userRes.data) setUserList(userRes.data);
        } catch (e) {}
      }
    };
    loadPrerequisites();
  }, [isAdmin]);

  // Load history when tab is clicked
  useEffect(() => {
    if (activeTab === 'history') {
      fetchImportHistory(historyPage);
    }
  }, [activeTab, historyPage]);

  const fetchImportHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await expenseService.getImportHistory({ page, limit: 10 });
      if (res.success) {
        setHistoryBatches(res.data || []);
        if (res.pagination) {
          setHistoryTotalPages(res.pagination.pages || 1);
        }
      }
    } catch (err) {
      showToast('Failed to load import history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const viewBatchDetails = async (batchId) => {
    setBatchDetailsLoading(true);
    try {
      const res = await expenseService.getImportBatchDetails(batchId);
      if (res.success && res.data) {
        setSelectedBatchDetails(res.data);
      }
    } catch (err) {
      showToast('Could not load batch details.', 'error');
    } finally {
      setBatchDetailsLoading(false);
    }
  };

  // ==========================================
  // DRAG & DROP AND FILE SELECTION
  // ==========================================
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleSelectedFile = (selected) => {
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.', 'error');
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      showToast('File size exceeds the 15MB limit.', 'error');
      return;
    }

    setFile(selected);
    setValidationResult(null);
    setImportReport(null);
    setUploadProgress(0);
    setCustomMapping({});
    setShowMappingPanel(false);
    showToast(`Loaded "${selected.name}" (${(selected.size / 1024).toFixed(1)} KB). Ready for validation.`, 'info');
  };

  const clearFile = () => {
    setFile(null);
    setValidationResult(null);
    setImportReport(null);
    setUploadProgress(0);
    setCustomMapping({});
    setShowMappingPanel(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // TEMPLATE DOWNLOADS
  // ==========================================
  const handleDownloadExcelTemplate = async () => {
    try {
      showToast('Preparing Excel Template (.xlsx)...', 'info');
      await expenseService.downloadExcelTemplate();
      showToast('Official Excel Template downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download Excel template: ' + err.message, 'error');
    }
  };

  const handleDownloadCsvTemplate = async () => {
    try {
      showToast('Preparing CSV Template (.csv)...', 'info');
      await expenseService.downloadCsvTemplate();
      showToast('Official CSV Template downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download CSV template: ' + err.message, 'error');
    }
  };

  // ==========================================
  // VALIDATE FILE (STEP 4)
  // ==========================================
  const handleValidateFile = async () => {
    if (!file) {
      showToast('Please select or drop a spreadsheet file first.', 'warning');
      return;
    }

    setIsValidating(true);
    setUploadProgress(30);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (Object.keys(customMapping).length > 0) {
        formData.append('column_mapping', JSON.stringify(customMapping));
      }

      setUploadProgress(60);
      const res = await expenseService.validateImport(formData);
      setUploadProgress(100);

      if (res.success && res.data) {
        setValidationResult(res.data);
        setCustomMapping(res.data.mapping || {});
        if (res.data.missingRequiredFields && res.data.missingRequiredFields.length > 0) {
          setShowMappingPanel(true);
          showToast(`Note: Some standard columns were not auto-detected. Please review column mappings.`, 'warning');
        } else {
          showToast(`Validation complete: ${res.data.validRows} valid rows detected.`, 'success');
        }
      } else {
        showToast(res.message || 'Validation failed. Please verify file format.', 'error');
      }
    } catch (err) {
      console.error('Validation error:', err);
      showToast(err.response?.data?.message || err.message || 'Validation error occurred.', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // ==========================================
  // CONFIRM IMPORT (STEP 5 & 6)
  // ==========================================
  const handleConfirmImport = async () => {
    if (!validationResult || !validationResult.sessionToken) {
      showToast('Validation session expired. Please re-validate your file.', 'warning');
      return;
    }

    setShowConfirmModal(false);
    setIsImporting(true);

    try {
      const payload = {
        sessionToken: validationResult.sessionToken,
        skipDuplicates,
        targetUser: isAdmin ? adminTargetUser : undefined
      };

      const res = await expenseService.confirmImport(payload);

      if (res.success && res.data) {
        setImportReport(res.data);
        showToast('Import completed successfully. Your expense records are now available in My Expense History.', 'success');

        // Automatically navigate to My Expense History after brief display
        setTimeout(() => {
          navigate('/expenses');
        }, 1800);
      } else {
        showToast(res.message || 'Failed to complete import.', 'error');
      }
    } catch (err) {
      console.error('Import confirmation error:', err);
      showToast(err.response?.data?.message || err.message || 'Import failed.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // ==========================================
  // EXPORT HANDLERS
  // ==========================================
  const applyExportPreset = (preset) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setExportStartDate(`${y}-${m}-01`);
      setExportEndDate(todayStr);
    } else if (preset === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setExportStartDate(prev.toISOString().slice(0, 10));
      setExportEndDate(lastDay.toISOString().slice(0, 10));
    } else if (preset === 'this_year') {
      setExportStartDate(`${now.getFullYear()}-01-01`);
      setExportEndDate(todayStr);
    } else if (preset === 'all') {
      setExportStartDate('');
      setExportEndDate('');
    }
  };

  const buildExportParams = () => {
    const params = {};
    if (exportStartDate) params.startDate = exportStartDate;
    if (exportEndDate) params.endDate = exportEndDate;
    if (exportCategory && exportCategory !== 'all') params.category = exportCategory;
    if (exportPayment && exportPayment !== 'all') params.payment_method = exportPayment;
    if (isAdmin && exportPerson && exportPerson !== 'all') params.person = exportPerson;
    if (exportMinAmount) params.minAmount = exportMinAmount;
    if (exportMaxAmount) params.maxAmount = exportMaxAmount;
    if (exportSearch.trim()) params.search = exportSearch.trim();
    return params;
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    showToast('Generating Excel report with summary sheet...', 'info');
    try {
      await expenseService.exportExpensesExcel(buildExportParams());
      showToast('Excel file downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to export Excel: ' + err.message, 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    showToast('Generating CSV file with formula protection...', 'info');
    try {
      await expenseService.exportExpensesCSV(buildExportParams());
      showToast('CSV file downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to export CSV: ' + err.message, 'error');
    } finally {
      setIsExportingCSV(false);
    }
  };

  return (
    <div className="view-container active">
      {/* Title box */}
      <div className="page-title-box mb-4">
        <div>
          <h3 className="fw-bold mb-1">Bulk Data Import &amp; Export</h3>
          <p className="text-muted mb-0">
            Import multiple expenses from Excel or CSV and manage your expense records efficiently.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <button
            className="btn btn-outline-primary"
            onClick={() => navigate('/expenses')}
            title="Go to Expense Records"
          >
            <i className="fa-solid fa-list-check me-1"></i> My Expense History
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={handleDownloadExcelTemplate}
            title="Download blank Excel Template"
          >
            <i className="fa-solid fa-download me-1"></i> Excel Template
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat-card glass-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Detected Rows</span>
              <div className="stat-icon-wrapper bg-primary-subtle text-primary p-2 rounded">
                <i className="fa-solid fa-table-list"></i>
              </div>
            </div>
            <h3 className="fw-bold mb-1">{validationResult ? validationResult.totalRows : 0}</h3>
            <small className="text-muted">Total rows in spreadsheet</small>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="stat-card glass-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Valid Rows</span>
              <div className="stat-icon-wrapper bg-success-subtle text-success p-2 rounded">
                <i className="fa-solid fa-circle-check"></i>
              </div>
            </div>
            <h3 className="fw-bold mb-1 text-success">{validationResult ? validationResult.validRows : 0}</h3>
            <small className="text-muted">
              {validationResult ? `₹${validationResult.totalValidAmount.toLocaleString('en-IN')}` : 'Ready for database'}
            </small>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="stat-card glass-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Invalid Rows</span>
              <div className="stat-icon-wrapper bg-danger-subtle text-danger p-2 rounded">
                <i className="fa-solid fa-circle-xmark"></i>
              </div>
            </div>
            <h3 className="fw-bold mb-1 text-danger">{validationResult ? validationResult.invalidRows : 0}</h3>
            <small className="text-muted">Rejected due to format/validation</small>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="stat-card glass-card p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Duplicate Rows</span>
              <div className="stat-icon-wrapper bg-warning-subtle text-warning p-2 rounded">
                <i className="fa-solid fa-clone"></i>
              </div>
            </div>
            <h3 className="fw-bold mb-1 text-warning">{validationResult ? validationResult.duplicateRows : 0}</h3>
            <small className="text-muted">Within-file or in database</small>
          </div>
        </div>
      </div>

      {/* Main Feature Tabs */}
      <div className="glass-card mb-4 p-1">
        <ul className="nav nav-pills nav-fill" role="tablist">
          <li className="nav-item">
            <button
              className={`nav-link py-2 fw-semibold ${activeTab === 'import' ? 'active shadow-sm' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <i className="fa-solid fa-file-import me-2"></i> Import Expenses
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-2 fw-semibold ${activeTab === 'export' ? 'active shadow-sm' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <i className="fa-solid fa-file-export me-2"></i> Export Expenses
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-2 fw-semibold ${activeTab === 'history' ? 'active shadow-sm' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <i className="fa-solid fa-clock-rotate-left me-2"></i> Import History &amp; Audits
            </button>
          </li>
        </ul>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: IMPORT EXPENSES */}
      {/* ========================================================================= */}
      {activeTab === 'import' && (
        <div className="fade show">
          {/* Success Result Banner */}
          {importReport && (
            <div className="alert alert-success d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-success text-white p-2 rounded-circle">
                  <i className="fa-solid fa-check fa-lg"></i>
                </div>
                <div>
                  <h5 className="alert-heading fw-bold mb-1">Import Completed Successfully!</h5>
                  <p className="mb-0 small">
                    Batch Ref: <strong>{importReport.batchId}</strong> &bull; {importReport.importedRows} record(s) inserted &bull; {importReport.skippedDuplicateRows} duplicates skipped.
                    Redirecting to My Expense History...
                  </p>
                </div>
              </div>
              <button className="btn btn-success btn-sm px-3" onClick={() => navigate('/expenses')}>
                View Now <i className="fa-solid fa-arrow-right ms-1"></i>
              </button>
            </div>
          )}

          {/* Upload Area Card */}
          <div className="glass-card p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0">
                <i className="fa-solid fa-cloud-arrow-up text-primary me-2"></i>
                Upload Spreadsheet File
              </h5>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={handleDownloadExcelTemplate}
                >
                  <i className="fa-solid fa-file-excel me-1"></i> Download Excel Template
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleDownloadCsvTemplate}
                >
                  <i className="fa-solid fa-file-csv me-1"></i> Download CSV Template
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              className={`dropzone-box p-4 text-center border-2 border-dashed rounded-3 ${isDragging ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle'}`}
              style={{
                cursor: 'pointer',
                backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s ease-in-out'
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileInput}
              />
              <div className="my-3">
                <i className="fa-solid fa-file-excel fa-3x text-primary mb-3"></i>
                <h5 className="fw-bold mb-1">Drag and drop your Excel or CSV file here</h5>
                <p className="text-muted small mb-3">
                  Supported formats: <strong>.xlsx, .xls, .csv</strong> &bull; Maximum file size: <strong>15 MB</strong>
                </p>
                <button
                  type="button"
                  className="btn btn-primary px-4 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                >
                  <i className="fa-solid fa-folder-open me-2"></i> Browse File
                </button>
              </div>
            </div>

            {/* Selected File Details Bar */}
            {file && (
              <div className="glass-card p-3 mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-success-subtle text-success rounded">
                    <i className="fa-solid fa-file-lines fa-lg"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0">{file.name}</h6>
                    <small className="text-muted">
                      Size: {(file.size / 1024).toFixed(1)} KB &bull; Type: {file.type || 'Spreadsheet'}
                    </small>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setShowMappingPanel(!showMappingPanel)}
                  >
                    <i className="fa-solid fa-sliders me-1"></i>
                    {showMappingPanel ? 'Hide Mapping' : 'Column Mapping'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={clearFile}
                    disabled={isValidating || isImporting}
                  >
                    <i className="fa-solid fa-trash-can me-1"></i> Clear File
                  </button>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress mt-3" style={{ height: '6px' }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                  role="progressbar"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}

            {/* Column Mapping Panel (If toggled or auto-opened) */}
            {file && showMappingPanel && (
              <div className="glass-card p-3 mt-3 bg-light-subtle">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0">
                    <i className="fa-solid fa-diagram-project text-primary me-2"></i>
                    Column Mapping Configuration
                  </h6>
                  <small className="text-muted">Match your spreadsheet headers with expense fields</small>
                </div>
                <div className="row g-2 mt-1">
                  {validationResult && validationResult.columnsDetected && (
                    <>
                      <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-muted">Date Column *</label>
                        <select
                          className="form-select form-select-sm"
                          value={customMapping.expense_date !== undefined ? customMapping.expense_date : ''}
                          onChange={(e) => setCustomMapping({ ...customMapping, expense_date: parseInt(e.target.value) })}
                        >
                          <option value="">-- Select Header --</option>
                          {validationResult.columnsDetected.map((col, idx) => (
                            <option key={idx} value={idx}>{col} (Col {idx + 1})</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-muted">Title / Description *</label>
                        <select
                          className="form-select form-select-sm"
                          value={customMapping.title !== undefined ? customMapping.title : ''}
                          onChange={(e) => setCustomMapping({ ...customMapping, title: parseInt(e.target.value) })}
                        >
                          <option value="">-- Select Header --</option>
                          {validationResult.columnsDetected.map((col, idx) => (
                            <option key={idx} value={idx}>{col} (Col {idx + 1})</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-muted">Amount Column *</label>
                        <select
                          className="form-select form-select-sm"
                          value={customMapping.amount !== undefined ? customMapping.amount : ''}
                          onChange={(e) => setCustomMapping({ ...customMapping, amount: parseInt(e.target.value) })}
                        >
                          <option value="">-- Select Header --</option>
                          {validationResult.columnsDetected.map((col, idx) => (
                            <option key={idx} value={idx}>{col} (Col {idx + 1})</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-3">
                        <label className="form-label small fw-bold text-muted">Category Column</label>
                        <select
                          className="form-select form-select-sm"
                          value={customMapping.category !== undefined ? customMapping.category : ''}
                          onChange={(e) => setCustomMapping({ ...customMapping, category: parseInt(e.target.value) })}
                        >
                          <option value="">-- Default / Auto --</option>
                          {validationResult.columnsDetected.map((col, idx) => (
                            <option key={idx} value={idx}>{col} (Col {idx + 1})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Admin Target User Selection */}
            {isAdmin && file && (
              <div className="glass-card p-3 mt-3 bg-light-subtle">
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted mb-1">
                      <i className="fa-solid fa-user-gear me-1 text-primary"></i>
                      Admin Assignment Policy:
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={adminTargetUser}
                      onChange={(e) => setAdminTargetUser(e.target.value)}
                    >
                      <option value="auto">Auto: Resolve 'username' column, or attribute to logged-in user</option>
                      {userList.map(u => (
                        <option key={u._id || u.id} value={u.username}>
                          Assign all records to {u.name} (@{u.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="form-check mt-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="skipDuplicatesCheck"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                      />
                      <label className="form-check-label fw-semibold small" htmlFor="skipDuplicatesCheck">
                        Skip exact duplicate records (Recommended)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="d-flex align-items-center justify-content-between mt-4 flex-wrap gap-2 pt-3 border-top">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary-custom"
                  onClick={clearFile}
                  disabled={!file || isValidating || isImporting}
                >
                  <i className="fa-solid fa-rotate-left me-1"></i> Start Over
                </button>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleValidateFile}
                  disabled={!file || isValidating || isImporting}
                >
                  {isValidating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Parsing &amp; Validating...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-magnifying-glass-chart me-1"></i> Validate File
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-success shadow-sm"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!validationResult || validationResult.validRows === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Saving to Database...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up me-1"></i> Import Valid Records
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Validation Preview & Error Table */}
          {validationResult && (
            <div className="glass-card p-4 mb-4">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <h5 className="fw-bold mb-0">Spreadsheet Preview &amp; Verification</h5>
                  <small className="text-muted">
                    Displaying sample rows detected in <strong>{validationResult.filename}</strong>
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <span className="badge bg-success-subtle text-success p-2">
                    <i className="fa-solid fa-check me-1"></i> {validationResult.validRows} Valid
                  </span>
                  <span className="badge bg-warning-subtle text-warning p-2">
                    <i className="fa-solid fa-copy me-1"></i> {validationResult.duplicateRows} Duplicates
                  </span>
                  <span className="badge bg-danger-subtle text-danger p-2">
                    <i className="fa-solid fa-xmark me-1"></i> {validationResult.invalidRows} Errors
                  </span>
                </div>
              </div>

              {/* Sample 20 Rows Preview Table */}
              <div className="table-responsive rounded-3 border mb-3" style={{ maxHeight: '380px' }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Date</th>
                      <th>Title / Description</th>
                      <th>Category</th>
                      <th className="text-end">Amount</th>
                      <th>Payment</th>
                      <th>Member</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.preview && validationResult.preview.length > 0 ? (
                      validationResult.preview.map((row, i) => (
                        <tr key={i} className={row.status === 'invalid' ? 'table-danger' : (row.status === 'duplicate' ? 'table-warning' : '')}>
                          <td className="fw-semibold text-muted">{row.rowNumber || i + 1}</td>
                          <td>
                            <small className="fw-semibold">
                              {row.date === 'Undated' ? <span className="badge bg-secondary">Undated</span> : formatDate(row.date)}
                            </small>
                          </td>
                          <td className="fw-semibold">
                            {row.title}
                            {row.vendor && <span className="text-muted small ms-1">({row.vendor})</span>}
                          </td>
                          <td>
                            <span className="badge bg-info-subtle text-info-emphasis">{row.category}</span>
                          </td>
                          <td className="text-end fw-bold text-nowrap">
                            {formatINR(row.amount)}
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">{row.payment_method}</span>
                          </td>
                          <td>
                            <small className="text-muted">{row.user_name || 'Member'}</small>
                          </td>
                          <td className="text-center">
                            {row.status === 'valid' && (
                              <span className="badge bg-success">
                                <i className="fa-solid fa-check me-1"></i> Valid
                              </span>
                            )}
                            {row.status === 'duplicate' && (
                              <span className="badge bg-warning text-dark" title={row.duplicateReason}>
                                <i className="fa-solid fa-clone me-1"></i> Duplicate
                              </span>
                            )}
                            {row.status === 'invalid' && (
                              <span className="badge bg-danger" title={row.errorText}>
                                <i className="fa-solid fa-triangle-exclamation me-1"></i> Error
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center py-3 text-muted">No preview rows available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Row-Level Errors Breakdown */}
              {validationResult.errors && validationResult.errors.length > 0 && (
                <div className="alert alert-danger py-3 px-3 mb-0 rounded-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fa-solid fa-circle-exclamation fa-lg text-danger"></i>
                    <h6 className="fw-bold mb-0">Detected {validationResult.errors.length} Validation Error(s):</h6>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    <ul className="mb-0 ps-3 small">
                      {validationResult.errors.slice(0, 20).map((err, errIdx) => (
                        <li key={errIdx} className="mb-1">
                          <strong>Row {err.rowNumber} [{err.field}]:</strong> {err.message}
                          {err.value && <span className="text-muted ms-1">(Given value: "{err.value}")</span>}
                        </li>
                      ))}
                      {validationResult.errors.length > 20 && (
                        <li className="text-muted fst-italic">...and {validationResult.errors.length - 20} more errors.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPORT EXPENSES */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="glass-card p-4 fade show">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1">
                <i className="fa-solid fa-file-export text-primary me-2"></i>
                Export Expense Statements
              </h5>
              <p className="text-muted small mb-0">
                Filter and download financial records to Excel (.xlsx) or CSV format with automated formulas protection.
              </p>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="mb-3 d-flex gap-2 flex-wrap">
            <span className="small fw-bold text-muted align-self-center">Quick Date Presets:</span>
            {DATE_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => applyExportPreset(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export Filter Form */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">From Date</label>
              <input
                type="date"
                className="form-control"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">To Date</label>
              <input
                type="date"
                className="form-control"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Category</label>
              <select
                className="form-select"
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c._id || c.id || c.category_name} value={c.category_name}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Payment Method</label>
              <select
                className="form-select"
                value={exportPayment}
                onChange={(e) => setExportPayment(e.target.value)}
              >
                <option value="all">All Payment Methods</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-muted">Filter by Member (Admin)</label>
                <select
                  className="form-select"
                  value={exportPerson}
                  onChange={(e) => setExportPerson(e.target.value)}
                >
                  <option value="all">All Members</option>
                  {userList.map(u => (
                    <option key={u._id || u.id} value={u._id || u.id}>
                      {u.name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Min Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 500"
                value={exportMinAmount}
                onChange={(e) => setExportMinAmount(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Max Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 50000"
                value={exportMaxAmount}
                onChange={(e) => setExportMaxAmount(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Keyword Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search title, vendor..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center gap-3 pt-3 border-top flex-wrap">
            <button
              type="button"
              className="btn btn-success px-4 py-2 fw-semibold shadow-sm"
              onClick={handleExportExcel}
              disabled={isExportingExcel || isExportingCSV}
            >
              {isExportingExcel ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Preparing Excel...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-excel me-2"></i> Export to Excel (.xlsx)
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-primary px-4 py-2 fw-semibold shadow-sm"
              onClick={handleExportCSV}
              disabled={isExportingExcel || isExportingCSV}
            >
              {isExportingCSV ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Preparing CSV...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-csv me-2"></i> Export to CSV (.csv)
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary py-2"
              onClick={() => {
                setExportStartDate('');
                setExportEndDate('');
                setExportCategory('all');
                setExportPayment('all');
                setExportPerson('all');
                setExportMinAmount('');
                setExportMaxAmount('');
                setExportSearch('');
              }}
            >
              <i className="fa-solid fa-arrow-rotate-left me-1"></i> Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: IMPORT HISTORY & AUDITS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="glass-card p-4 fade show">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1">
                <i className="fa-solid fa-clock-rotate-left text-primary me-2"></i>
                Import Batch History &amp; Audits
              </h5>
              <p className="text-muted small mb-0">
                Track previous import sessions, audit counts, and row error reports.
              </p>
            </div>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => fetchImportHistory(historyPage)}
            >
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh History
            </button>
          </div>

          {historyLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading import batches...</p>
            </div>
          ) : historyBatches.length > 0 ? (
            <div className="table-responsive rounded-3 border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Batch ID</th>
                    <th>Initiated By</th>
                    <th>File Name</th>
                    <th>Total / Imported</th>
                    <th>Duplicates</th>
                    <th>Errors</th>
                    <th className="text-end">Import Amount</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyBatches.map(b => (
                    <tr key={b._id || b.batch_id}>
                      <td>
                        <span className="badge bg-light text-dark border font-monospace">
                          {b.batch_id}
                        </span>
                        <small className="d-block text-muted">
                          {new Date(b.created_at || b.started_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </small>
                      </td>
                      <td>
                        <span className="fw-semibold">{b.initiated_by_name}</span>
                        {b.target_user_name && b.target_user_name !== b.initiated_by_name && (
                          <small className="d-block text-muted">Target: {b.target_user_name}</small>
                        )}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '160px' }} title={b.original_filename}>
                        <i className="fa-solid fa-file-excel text-success me-1"></i>
                        {b.original_filename}
                      </td>
                      <td>
                        <span className="fw-bold text-success">{b.imported_rows}</span> / {b.total_rows}
                      </td>
                      <td>
                        <span className="badge bg-warning-subtle text-warning-emphasis">
                          {b.duplicate_rows || 0}
                        </span>
                      </td>
                      <td>
                        {b.rejected_rows > 0 ? (
                          <span className="badge bg-danger">{b.rejected_rows}</span>
                        ) : (
                          <span className="badge bg-light text-muted">0</span>
                        )}
                      </td>
                      <td className="text-end fw-bold">
                        {formatINR(b.total_imported_amount || 0)}
                      </td>
                      <td className="text-center">
                        {b.status === 'completed' && <span className="badge bg-success">Completed</span>}
                        {b.status === 'partial' && <span className="badge bg-warning text-dark">Partial</span>}
                        {b.status === 'failed' && <span className="badge bg-danger">Failed</span>}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info"
                          onClick={() => viewBatchDetails(b.batch_id)}
                          title="View Batch Audit Details"
                        >
                          <i className="fa-solid fa-eye me-1"></i> Audit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-inbox fa-3x mb-3 text-secondary opacity-50"></i>
              <p className="mb-0">No import history found. Upload an Excel or CSV file to create your first batch!</p>
            </div>
          )}

          {/* History Pagination */}
          {historyTotalPages > 1 && (
            <div className="d-flex justify-content-end mt-3">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${historyPage <= 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setHistoryPage(p => Math.max(1, p - 1))}>
                    Previous
                  </button>
                </li>
                <li className="page-item disabled">
                  <span className="page-link">Page {historyPage} of {historyTotalPages}</span>
                </li>
                <li className={`page-item ${historyPage >= historyTotalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}>
                    Next
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showConfirmModal && validationResult && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card border-0 p-3 shadow-lg">
              <div className="modal-header border-0 pb-2">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-success-subtle text-success rounded">
                    <i className="fa-solid fa-circle-question fa-lg"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Confirm Bulk Import</h5>
                    <small className="text-muted">Review import totals before database insertion</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isImporting}
                ></button>
              </div>

              <div className="modal-body py-3">
                <div className="glass-card p-3 mb-3 bg-light-subtle">
                  <div className="row g-2 text-center">
                    <div className="col-4">
                      <small className="text-muted d-block">Valid Records</small>
                      <h4 className="fw-bold mb-0 text-success">{validationResult.validRows}</h4>
                    </div>
                    <div className="col-4">
                      <small className="text-muted d-block">Duplicates</small>
                      <h4 className="fw-bold mb-0 text-warning">{validationResult.duplicateRows}</h4>
                    </div>
                    <div className="col-4">
                      <small className="text-muted d-block">Rejected</small>
                      <h4 className="fw-bold mb-0 text-danger">{validationResult.invalidRows}</h4>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info py-2 small mb-3">
                  <i className="fa-solid fa-wallet me-1"></i>
                  <strong>Total Value:</strong> {formatINR(validationResult.totalValidAmount)} will be credited to{' '}
                  <strong>{isAdmin && adminTargetUser !== 'auto' ? adminTargetUser : user?.name}</strong>'s expense records.
                </div>

                <p className="small text-muted mb-0">
                  Imported records will be directly saved to the database and will appear immediately in{' '}
                  <strong>My Expense History</strong>. You will be automatically redirected upon completion.
                </p>
              </div>

              <div className="modal-footer border-0 p-0 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary-custom"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check me-1"></i> Confirm &amp; Save Records
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BATCH AUDIT DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedBatchDetails && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content glass-card border-0 p-3 shadow-lg">
              <div className="modal-header border-0 pb-2">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded">
                    <i className="fa-solid fa-file-shield fa-lg"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Batch Audit: {selectedBatchDetails.batch_id}</h5>
                    <small className="text-muted">
                      Uploaded by {selectedBatchDetails.initiated_by_name} on {new Date(selectedBatchDetails.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedBatchDetails(null)}
                ></button>
              </div>

              <div className="modal-body py-3">
                <div className="row g-2 mb-3">
                  <div className="col-3">
                    <div className="glass-card p-2 text-center">
                      <small className="text-muted d-block">Total Rows</small>
                      <h5 className="fw-bold mb-0">{selectedBatchDetails.total_rows}</h5>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-success">
                      <small className="text-muted d-block">Imported</small>
                      <h5 className="fw-bold mb-0 text-success">{selectedBatchDetails.imported_rows}</h5>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-warning">
                      <small className="text-muted d-block">Duplicates</small>
                      <h5 className="fw-bold mb-0 text-warning">{selectedBatchDetails.duplicate_rows || 0}</h5>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-danger">
                      <small className="text-muted d-block">Rejected</small>
                      <h5 className="fw-bold mb-0 text-danger">{selectedBatchDetails.rejected_rows || 0}</h5>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <span className="small fw-bold text-muted">Original File: </span>
                  <span className="small">{selectedBatchDetails.original_filename}</span>
                </div>
                <div className="mb-3">
                  <span className="small fw-bold text-muted">Total Amount Imported: </span>
                  <span className="small fw-bold text-success">{formatINR(selectedBatchDetails.total_imported_amount || 0)}</span>
                </div>

                {selectedBatchDetails.errors && selectedBatchDetails.errors.length > 0 ? (
                  <>
                    <h6 className="fw-bold mb-2 text-danger">
                      <i className="fa-solid fa-triangle-exclamation me-1"></i> Row Errors Log:
                    </h6>
                    <div className="border rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="table table-sm table-striped mb-0 small">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Field</th>
                            <th>Message</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBatchDetails.errors.map((e, idx) => (
                            <tr key={idx}>
                              <td>{e.rowNumber}</td>
                              <td><code>{e.field}</code></td>
                              <td>{e.message}</td>
                              <td className="text-muted">{e.value || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="alert alert-success py-2 small mb-0">
                    <i className="fa-solid fa-check me-1"></i> Zero validation errors recorded for this batch.
                  </div>
                )}
              </div>

              <div className="modal-footer border-0 p-0 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-secondary-custom"
                  onClick={() => setSelectedBatchDetails(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
