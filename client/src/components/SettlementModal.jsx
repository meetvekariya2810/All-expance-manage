import React, { useState, useEffect } from 'react';
import { settlementService } from '../services/settlementService';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export default function SettlementModal({ isOpen, onClose, onSuccess, initialSettlement = null }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isEditing = Boolean(initialSettlement);

  const [formData, setFormData] = useState({
    person_name: '',
    amount: '',
    settlement_type: 'Paid',
    settlement_date: new Date().toISOString().slice(0, 10),
    status: 'Settled',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialSettlement) {
      setFormData({
        person_name: initialSettlement.person_name || '',
        amount: initialSettlement.amount || '',
        settlement_type: initialSettlement.settlement_type || 'Paid',
        settlement_date: initialSettlement.settlement_date || new Date().toISOString().slice(0, 10),
        status: initialSettlement.status || 'Settled',
        notes: initialSettlement.notes || ''
      });
    } else {
      setFormData({
        person_name: '',
        amount: '',
        settlement_type: 'Paid',
        settlement_date: new Date().toISOString().slice(0, 10),
        status: 'Settled',
        notes: ''
      });
    }
    setErrorMsg('');
  }, [initialSettlement, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive settlement amount.');
      return;
    }

    if (!formData.person_name.trim()) {
      setErrorMsg('Please specify the person name for this settlement.');
      return;
    }

    if (!formData.settlement_date) {
      setErrorMsg('Please select a valid date.');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        const id = initialSettlement._id || initialSettlement.id || initialSettlement.settlement_id;
        const res = await settlementService.updateSettlement(id, formData);
        showToast(res.message || 'Settlement record updated successfully.', 'success');
      } else {
        const res = await settlementService.createSettlement(formData);
        showToast(res.message || 'Settlement record created successfully.', 'success');
      }

      window.dispatchEvent(new Event('app:refresh'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Failed to save settlement record.';
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
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <i className="fa-solid fa-handshake fs-5"></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
                {isEditing ? 'Edit Settlement' : 'New Settlement (Settle Up)'}
              </h5>
              <p className="mb-0" style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.825rem', marginTop: '2px' }}>
                {isEditing ? `Updating ${initialSettlement.settlement_id}` : 'Manage money settled or pending with a person'}
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
                  placeholder="e.g. Rajesh"
                  required
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    padding: '0.65rem 0.85rem'
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Amount & Settlement Type */}
            <div className="row g-2 mb-3">
              <div className="col-sm-7">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                  Amount (₹) <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span
                    className="input-group-text"
                    style={{
                      background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f1f5f9',
                      borderColor: 'var(--border-color, #cbd5e1)',
                      color: '#6366f1',
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
                    placeholder="e.g. 5000"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{
                      background: isDark ? '#0f172a' : '#ffffff',
                      borderColor: 'var(--border-color, #cbd5e1)',
                      color: 'var(--text-main, #0f172a)',
                      padding: '0.65rem 0.85rem',
                      fontWeight: '600'
                    }}
                  />
                </div>
              </div>

              <div className="col-sm-5">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                  Type <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.settlement_type}
                  onChange={(e) => setFormData({ ...formData, settlement_type: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    padding: '0.65rem 0.85rem'
                  }}
                >
                  <option value="Paid">Paid (Money Out)</option>
                  <option value="Received">Received (Money In)</option>
                </select>
              </div>
            </div>

            {/* Date & Status */}
            <div className="row g-2 mb-3">
              <div className="col-sm-7">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                  Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={formData.settlement_date}
                  onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    colorScheme: isDark ? 'dark' : 'light',
                    padding: '0.65rem 0.85rem'
                  }}
                />
              </div>

              <div className="col-sm-5">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-main, #334155)' }}>
                  Status <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    background: isDark ? '#0f172a' : '#ffffff',
                    borderColor: 'var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    padding: '0.65rem 0.85rem'
                  }}
                >
                  <option value="Settled">Settled (Complete)</option>
                  <option value="Pending">Pending (Unsettled)</option>
                </select>
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
                placeholder="Optional settlement notes or purpose..."
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-handshake"></i>
                    <span>{isEditing ? 'Save Changes' : 'Settle Up'}</span>
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
