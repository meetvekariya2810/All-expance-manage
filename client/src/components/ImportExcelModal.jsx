import React, { useState } from 'react';
import { expenseService } from '../services/expenseService';
import { formatINR, formatDate } from '../utils/constants';

export default function ImportExcelModal({ onClose, onSuccess, currentUser }) {
  const [file, setFile] = useState(null);
  const [year, setYear] = useState('2026');
  const [assignedUser, setAssignedUser] = useState(currentUser?.role === 'admin' ? 'meet' : currentUser?.id || 'meet');
  const [useDefaultFile, setUseDefaultFile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUseDefaultFile(false);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (file && !useDefaultFile) {
        formData.append('file', file);
      }
      formData.append('year', year || '2026');
      formData.append('assigned_user', assignedUser);

      const res = await expenseService.importExpenses(formData);
      if (res.success && res.report) {
        setReport(res.report);
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'Import failed. Please check the Excel file format.');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.message || err.message || 'Error occurred while importing file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content glass-card border-0 p-3 shadow-lg">
          <div className="modal-header border-0 pb-2">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 bg-success-subtle text-success rounded">
                <i className="fa-solid fa-file-excel fa-lg"></i>
              </div>
              <div>
                <h4 className="modal-title fw-bold mb-0">Import Excel Expense Entries</h4>
                <small className="text-muted">Import date-wise expenses with duplicate prevention and audit report</small>
              </div>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={loading}></button>
          </div>

          <div className="modal-body py-3">
            {error && (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div>{error}</div>
              </div>
            )}

            {!report ? (
              <form onSubmit={handleSubmit}>
                <div className="glass-card p-3 mb-3 bg-light-subtle">
                  <label className="form-label fw-bold small text-uppercase text-muted mb-2">
                    <i className="fa-solid fa-file-arrow-up me-1"></i> Excel Source File
                  </label>

                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="fileSource"
                      id="sourceDefault"
                      checked={useDefaultFile}
                      onChange={() => { setUseDefaultFile(true); setFile(null); }}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="sourceDefault">
                      Use Uploaded <code>Expense_Entries_Date_Wise.xlsx</code> (31 records, ₹52,045)
                    </label>
                  </div>

                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="fileSource"
                      id="sourceUpload"
                      checked={!useDefaultFile}
                      onChange={() => setUseDefaultFile(false)}
                    />
                    <label className="form-check-label" htmlFor="sourceUpload">
                      Upload Another Excel File (.xlsx, .xls)
                    </label>
                  </div>

                  {!useDefaultFile && (
                    <div className="mt-2">
                      <input
                        type="file"
                        className="form-control"
                        accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={handleFileChange}
                        required={!useDefaultFile}
                      />
                      <small className="text-muted mt-1 d-block">
                        Expected columns: <code>Entry ID</code>, <code>Date (DD/MM)</code>, <code>Expense Description</code>, <code>Amount (INR)</code>, <code>Notes</code>
                      </small>
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted">
                      <i className="fa-solid fa-calendar me-1"></i> Year for Date (DD/MM)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g. 2026"
                      required
                    />
                    <small className="text-muted">
                      Confirmed year: 2026 (maps 24/08 to 2026-08-24).
                    </small>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted">
                      <i className="fa-solid fa-user me-1"></i> Assign Expenses To
                    </label>
                    <select
                      className="form-select"
                      value={assignedUser}
                      onChange={(e) => setAssignedUser(e.target.value)}
                      disabled={currentUser?.role !== 'admin'}
                    >
                      <option value="meet">Meet (meet)</option>
                      {currentUser?.role === 'admin' && (
                        <>
                          <option value="bhavik">Bhavik Bhai (admin)</option>
                          <option value="admin">Main Admin</option>
                        </>
                      )}
                    </select>
                    <small className="text-muted">
                      Records will be attributed to Meet's account.
                    </small>
                  </div>
                </div>

                <div className="alert alert-info py-2 small mb-3">
                  <i className="fa-solid fa-circle-info me-1"></i>
                  <strong>Safe Import Guarantee:</strong> Existing expenses will not be modified. Duplicate records are automatically detected and skipped. Undated entries (like Zomato ₹1,424) are safely preserved as 'Undated'.
                </div>

                <div className="modal-footer border-0 p-0 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary-custom" onClick={onClose} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Importing & Validating...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-file-import me-1"></i> Start Excel Import
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Import Summary Report */
              <div>
                <div className="alert alert-success d-flex align-items-center gap-2 py-2 mb-3">
                  <i className="fa-solid fa-circle-check fa-lg"></i>
                  <div>
                    <strong>Import Report:</strong> {report.importedCount} record(s) imported, {report.skippedCount} duplicate(s) skipped. Attributed to <strong>{report.targetUser}</strong>.
                  </div>
                </div>

                {/* Stat Summary Cards */}
                <div className="row g-2 mb-3">
                  <div className="col-3">
                    <div className="glass-card p-2 text-center">
                      <small className="text-muted d-block">Total Rows</small>
                      <h4 className="fw-bold mb-0">{report.totalRows}</h4>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-success">
                      <small className="text-muted d-block">Imported</small>
                      <h4 className="fw-bold mb-0 text-success">{report.importedCount}</h4>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-warning">
                      <small className="text-muted d-block">Skipped</small>
                      <h4 className="fw-bold mb-0 text-warning">{report.skippedCount}</h4>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="glass-card p-2 text-center text-primary">
                      <small className="text-muted d-block">Import Total</small>
                      <h5 className="fw-bold mb-0 text-primary">{formatINR(report.importedTotal)}</h5>
                    </div>
                  </div>
                </div>

                {/* Records Table */}
                <h6 className="fw-bold mb-2">Imported Entries Audit Log:</h6>
                <div style={{ maxHeight: '280px', overflowY: 'auto' }} className="border rounded p-1">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="text-end">Amount</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.records?.map((r, i) => (
                        <tr key={i}>
                          <td><span className="badge bg-light text-dark">{r.entryId || i + 1}</span></td>
                          <td><small>{r.date === 'Undated' ? <span className="badge bg-secondary">Undated</span> : formatDate(r.date)}</small></td>
                          <td className="fw-semibold small">{r.title}</td>
                          <td><span className="badge bg-info-subtle text-info-emphasis">{r.category || 'Expense'}</span></td>
                          <td className="text-end fw-bold">{formatINR(r.amount)}</td>
                          <td className="text-center">
                            {r.status === 'imported' && (
                              <span className="badge bg-success">
                                <i className="fa-solid fa-check me-1"></i> Imported
                              </span>
                            )}
                            {r.status === 'skipped' && (
                              <span className="badge bg-warning text-dark" title={r.reason}>
                                <i className="fa-solid fa-copy me-1"></i> Skipped
                              </span>
                            )}
                            {r.status === 'error' && (
                              <span className="badge bg-danger" title={r.reason}>
                                <i className="fa-solid fa-xmark me-1"></i> Error
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="modal-footer border-0 p-0 mt-3 d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-primary-custom"
                    onClick={() => {
                      if (onSuccess) onSuccess();
                      onClose();
                    }}
                  >
                    <i className="fa-solid fa-check me-1"></i> Done & View Expenses
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
