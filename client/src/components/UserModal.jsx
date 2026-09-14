import React, { useState, useEffect } from 'react';

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  user = null
}) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setMobile(user.mobile || '');
      setRole(user.role || 'user');
      setPassword('');
    } else {
      setName('');
      setUsername('');
      setEmail('');
      setMobile('');
      setPassword('');
      setRole('user');
    }
    setError('');
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { name, email, mobile, role };
      if (!user) {
        payload.username = username;
        payload.password = password;
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save user account.');
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
              {user ? 'Edit User Details' : 'Create User Account'}
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

              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Harsh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {!user && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. harsh"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. harsh@expense.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Mobile Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. +91 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>

              {!user && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Initial Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Minimum 4 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={4}
                    required
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">User Role</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="user">User (Sub-Account)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
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
                {loading ? 'Saving...' : user ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
