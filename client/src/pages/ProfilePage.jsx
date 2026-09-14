import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  // Profile Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMobile(user.mobile || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required.', 'warning');
      return;
    }

    setProfileLoading(true);
    try {
      const res = await authService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim()
      });
      if (res.success) {
        updateUser(res.user);
        showToast('Profile details updated successfully!', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      showToast('Please fill in current and new password.', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'error');
      return;
    }

    if (newPassword.length < 4) {
      showToast('New password must be at least 4 characters.', 'warning');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authService.changePassword({
        oldPassword,
        newPassword,
        confirmPassword
      });
      if (res.success) {
        showToast('Password updated successfully!', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error changing password.', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="view-container active">
      <div className="page-title-box">
        <div>
          <h3>Account Profile & Security</h3>
          <p>Manage personal account details and update access password</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Profile Info Form */}
        <div className="col-lg-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-id-card me-2 text-primary"></i> Personal Information
            </h5>

            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Username</label>
                <input
                  type="text"
                  className="form-control bg-light"
                  value={user?.username || ''}
                  readOnly
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
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

              <div className="mb-3">
                <label className="form-label fw-semibold">System Role</label>
                <input
                  type="text"
                  className="form-control bg-light fw-bold text-primary"
                  value={user?.role === 'admin' ? 'MAIN ADMIN / OWNER' : 'SUB ADMIN / USER'}
                  readOnly
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary-custom w-100 py-2"
                disabled={profileLoading}
              >
                <i className="fa-solid fa-floppy-disk me-1"></i>
                {profileLoading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="col-lg-6">
          <div className="glass-card p-4 h-100">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-shield-halved me-2 text-warning"></i> Change Password
            </h5>

            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Current Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>

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
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Confirm New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={4}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-warning-custom w-100 py-2 text-dark"
                disabled={passwordLoading}
              >
                <i className="fa-solid fa-key me-1"></i>
                {passwordLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
