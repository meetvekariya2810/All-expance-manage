import React, { useState, useEffect } from 'react';
import { fundService } from '../services/fundService';
import { useToast } from '../context/ToastContext';

export default function AddFundModal({ isOpen, onClose, onSuccess, initialFund = null }) {
  const { showToast } = useToast();
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

  return (
    <div className="modal-backdrop-custom show d-flex align-items-center justify-content-center" style={{ zIndex: 1050, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="card glass-card border-0 shadow-2xl" style={{ maxWidth: '480px', width: '92%', borderRadius: '16px', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc' }}>
        <div className="card-header border-0 pb-0 pt-4 px-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}>
              <i className="fa-solid fa-arrow-down-left"></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ letterSpacing: '-0.02em' }}>
                {isEditing ? 'Edit Fund Entry' : 'Add Fund (Money In)'}
              </h5>
              <small className="text-muted" style={{ color: '#94a3b8' }}>
                {isEditing ? `Updating ${initialFund.fund_id}` : 'Record incoming funds to available balance'}
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
            {/* Amount */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Amount (₹) *
              </label>
              <div className="input-group">
                <span className="input-group-text border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#10b981', fontWeight: 'bold' }}>
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control border-0"
                  placeholder="e.g. 100000"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem', fontSize: '1.1rem', fontWeight: '600' }}
                  autoFocus
                />
              </div>
            </div>

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
                  placeholder="e.g. Rajesh / Office Cash"
                  required
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                />
              </div>
            </div>

            {/* Date */}
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Date *
              </label>
              <div className="input-group">
                <span className="input-group-text border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }}>
                  <i className="fa-solid fa-calendar-day"></i>
                </span>
                <input
                  type="date"
                  className="form-control border-0"
                  required
                  value={formData.fund_date}
                  onChange={(e) => setFormData({ ...formData, fund_date: e.target.value })}
                  style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', padding: '0.65rem 0.85rem' }}
                />
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
                placeholder="Optional details or context..."
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
                className="btn btn-success-custom px-4 d-flex align-items-center gap-2"
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff' }}
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
