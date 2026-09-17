import React, { useState, useEffect } from 'react';
import { settlementService } from '../services/settlementService';
import { useToast } from '../context/ToastContext';

export default function SettlementModal({ isOpen, onClose, onSuccess, initialSettlement = null }) {
  const { showToast } = useToast();
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

  return (
    <div className="modal-backdrop-custom show d-flex align-items-center justify-content-center" style={{ zIndex: 1050, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="card glass-card border-0 shadow-2xl" style={{ maxWidth: '480px', width: '92%', borderRadius: '16px', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc' }}>
        <div className="card-header border-0 pb-0 pt-4 px-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff' }}>
              <i className="fa-solid fa-handshake"></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ letterSpacing: '-0.02em' }}>
                {isEditing ? 'Edit Settlement' : 'New Settlement (Settle Up)'}
              </h5>
              <small className="text-muted" style={{ color: '#94a3b8' }}>
                {isEditing ? `Updating ${initialSettlement.settlement_id}` : 'Manage money settled or pending with a person'}
              </small>
            </div>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={loading}></button>
        </div>

        <div className="card-body p-4">
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 mb-3 border-0 d-flex align-items-center gap-2" style={{ borderRadius: '8px', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Person Name */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Person Name *
              </label>
              <div className="input-group">
                <span className="input-group-text border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }}>
                  <i className="fa-solid fa-user"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-0"
                  placeholder="e.g. Rajesh"
                  required
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Amount & Settlement Type */}
            <div className="row g-2 mb-3">
              <div className="col-sm-7">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Amount (₹) *
                </label>
                <div className="input-group">
                  <span className="input-group-text border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#6366f1', fontWeight: 'bold' }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control border-0"
                    placeholder="e.g. 5000"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem', fontWeight: '600' }}
                  />
                </div>
              </div>

              <div className="col-sm-5">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Type *
                </label>
                <select
                  className="form-select border-0"
                  value={formData.settlement_type}
                  onChange={(e) => setFormData({ ...formData, settlement_type: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                >
                  <option value="Paid">Paid (Money Out)</option>
                  <option value="Received">Received (Money In)</option>
                </select>
              </div>
            </div>

            {/* Date & Status */}
            <div className="row g-2 mb-3">
              <div className="col-sm-7">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Date *
                </label>
                <input
                  type="date"
                  className="form-control border-0"
                  required
                  value={formData.settlement_date}
                  onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                />
              </div>

              <div className="col-sm-5">
                <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Status *
                </label>
                <select
                  className="form-select border-0"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                >
                  <option value="Settled">Settled (Complete)</option>
                  <option value="Pending">Pending (Unsettled)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Notes <span className="text-muted" style={{ fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <textarea
                className="form-control border-0"
                rows="2"
                placeholder="Optional settlement notes or purpose..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
              ></textarea>
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-secondary-custom px-4"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn px-4 d-flex align-items-center gap-2"
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff' }}
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
