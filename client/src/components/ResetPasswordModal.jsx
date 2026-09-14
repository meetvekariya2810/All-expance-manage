import React, { useState } from 'react';

export default function ResetPasswordModal({
  isOpen,
  onClose,
  onReset,
  user
}) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onReset(user.id || user._id, newPassword);
      setNewPassword('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error resetting password.');
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
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content glass-card border-0 p-3 shadow-lg">
          <div className="modal-header border-0 pb-2">
            <h5 className="modal-title fw-bold">
              Reset Password: {user.name}
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2 px-3 small mb-3">
                  {error}
                </div>
              )}

              <p className="small text-muted mb-3">
                Set a new password for account <strong>@{user.username}</strong> ({user.email}).
              </p>

              <div className="mb-3">
                <label className="form-label fw-semibold">New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimum 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={4}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer border-0 pt-2 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary-custom btn-sm"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary-custom btn-sm"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
