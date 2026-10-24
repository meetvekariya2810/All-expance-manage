import React, { useState, useEffect } from 'react';
import { fundService } from '../services/fundService';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export default function AddFundModal({ isOpen, onClose, onSuccess, initialFund = null }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isEditing = Boolean(initialFund);

  const [formData, setFormData] = useState({
    amount: '',
    person_name: '',
    fund_date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialFund) {
      setFormData({
        amount: initialFund.amount || '',
        person_name: initialFund.person_name || '',
        fund_date: initialFund.fund_date || new Date().toISOString().slice(0, 10),
        notes: initialFund.notes || ''
      });
    } else {
      setFormData({
        amount: '',
        person_name: '',
        fund_date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
    }
    setErrorMsg('');
  }, [initialFund, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Frontend validation
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive fund amount greater than 0.');
      return;
    }

    if (!formData.person_name.trim()) {
      setErrorMsg('Please enter the person name from whom funds were received.');
      return;
    }

    if (!formData.fund_date) {
      setErrorMsg('Please select a valid date.');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        const id = initialFund._id || initialFund.id || initialFund.fund_id;
        const res = await fundService.updateFund(id, formData);
        showToast(res.message || 'Fund entry updated successfully in MongoDB Atlas.', 'success');
      } else {
        const res = await fundService.createFund(formData);
        showToast(res.message || 'Fund entry added successfully to MongoDB Atlas.', 'success');
      }

      window.dispatchEvent(new Event('app:refresh'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Failed to save fund entry.';
      setErrorMsg(serverMsg);
      showToast(serverMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className="modal-backdrop-custom show d-flex align-items-center justify-content-center"
      style={{
        zIndex: 1060,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="card fintech-modal-card border-0 shadow-2xl"
        style={{
          maxWidth: '480px',
          width: '100%',
          borderRadius: '18px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          color: 'var(--text-main, #0f172a)'
        }}
      >
        {/* Header */}
        <div className="card-header border-0 pb-0 pt-4 px-4 d-flex align-items-center justify-content-between" style={{ background: 'transparent' }}>
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: '42px',
                height: '42px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <i className="fa-solid fa-arrow-down-left fs-5"></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
                {isEditing ? 'Edit Fund Entry' : 'Add Fund (Money In)'}
              </h5>
              <p className="mb-0" style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.825rem', marginTop: '2px' }}>
                {isEditing ? `Updating ${initialFund.fund_id}` : 'Record incoming funds to available balance'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`btn-close ${isDark ? 'btn-close-white' : ''}`}
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          ></button>
        </div>

        {/* Body */}
        <div className="card-body p-4">
          {errorMsg && (
            <div
              className="alert alert-danger py-2 px-3 mb-3 border-0 d-flex align-items-center gap-2"
              style={{
                borderRadius: '10px',
                fontSize: '0.875rem',
                background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                color: isDark ? '#fca5a5' : '#b91c1c'
              }}
            >
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Amount */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                Amount (₹) <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span
                  className="input-group-text"
                  style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f1f5f9',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: '#10b981',
                    fontWeight: '700',
                    fontSize: '1.1rem'
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="e.g. 100000"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    padding: '0.65rem 0.85rem',
                    fontSize: '1.1rem',
                    fontWeight: '600'
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Person Name */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                Person Name <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span
                  className="input-group-text"
                  style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f1f5f9',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-muted, #64748b)'
                  }}
                >
                  <i className="fa-solid fa-user"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rajesh / Office Cash"
                  required
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    padding: '0.65rem 0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Date */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                Date <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span
                  className="input-group-text"
                  style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f1f5f9',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-muted, #64748b)'
                  }}
                >
                  <i className="fa-solid fa-calendar-day"></i>
                </span>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={formData.fund_date}
                  onChange={(e) => setFormData({ ...formData, fund_date: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    colorScheme: isDark ? 'dark' : 'light',
                    padding: '0.65rem 0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                Notes <span style={{ fontWeight: 'normal', color: 'var(--text-muted, #64748b)' }}>(Optional)</span>
              </label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Optional details or context..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{
                  background: isDark ? '#0f172a' : '#ffffff',
                  borderColor: 'var(--border-color, #cbd5e1)',
                  color: 'var(--text-main, #0f172a)',
                  padding: '0.65rem 0.85rem'
                }}
              ></textarea>
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-end gap-2 pt-3 border-top" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <button
                type="button"
                className="btn px-4 fw-medium"
                onClick={onClose}
                disabled={loading}
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                  color: 'var(--text-main, #0f172a)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  borderRadius: '10px'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn px-4 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>{isEditing ? 'Updating...' : 'Adding...'}</span>
                  </>
                ) : (
                  <>
                    <i className={isEditing ? "fa-solid fa-check" : "fa-solid fa-plus"}></i>
                    <span>{isEditing ? 'Save Changes' : 'Add Fund'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
