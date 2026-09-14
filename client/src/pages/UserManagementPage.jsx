import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/constants';
import UserModal from '../components/UserModal';
import ResetPasswordModal from '../components/ResetPasswordModal';

export default function UserManagementPage() {
  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userForReset, setUserForReset] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      showToast('Error loading users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSaveUser = async (userData) => {
    if (selectedUser) {
      await userService.updateUser(selectedUser.id || selectedUser._id, userData);
      showToast('User account updated successfully!', 'success');
    } else {
      await userService.createUser(userData);
      showToast('New user account created successfully!', 'success');
    }
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    if (user.id === currentAdmin.id && user.status === 'active') {
      showToast('Cannot disable your own active admin account.', 'warning');
      return;
    }
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await userService.updateStatus(user.id || user._id, newStatus);
      showToast(res.message || 'Account status updated.', 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating status.', 'error');
    }
  };

  const handleResetPassword = async (userId, newPassword) => {
    await userService.resetPassword(userId, newPassword);
    showToast('User password reset successfully!', 'success');
  };

  return (
    <div className="view-container active">
      <div className="page-title-box">
        <div>
          <h3>User Account Management</h3>
          <p>Manage user roles, access permissions, status, and reset credentials</p>
        </div>
        <div>
          <button
            className="btn btn-primary-custom"
            onClick={() => { setSelectedUser(null); setIsUserModalOpen(true); }}
          >
            <i className="fa-solid fa-user-plus me-1"></i> Add User
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="table-glass-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email Address</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-center">Expenses</th>
                <th className="text-end">Total Spent</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((u) => {
                  const isCurrent = u.id === currentAdmin?.id || u._id === currentAdmin?.id;
                  return (
                    <tr key={u.id || u._id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="user-avatar-sm">
                            <i className="fa-solid fa-user"></i>
                          </div>
                          <div>
                            <span className="fw-bold">{u.name}</span>
                            {isCurrent && (
                              <span className="badge bg-primary-subtle text-primary ms-1 small">You</span>
                            )}
                            <span className="text-muted small d-block">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="small">{u.email}</td>
                      <td className="small">{u.mobile || '-'}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'bg-success' : 'bg-danger'}`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="text-center fw-semibold">{u.transactionCount || 0}</td>
                      <td className="text-end fw-bold text-primary">
                        {formatINR(u.totalSpent || 0)}
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            title="Edit User"
                            onClick={() => { setSelectedUser(u); setIsUserModalOpen(true); }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning py-1 px-2"
                            title="Reset Password"
                            onClick={() => { setUserForReset(u); setIsResetModalOpen(true); }}
                          >
                            <i className="fa-solid fa-key"></i>
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              className={`btn btn-sm py-1 px-2 ${
                                u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'
                              }`}
                              title={u.status === 'active' ? 'Disable Account' : 'Enable Account'}
                              onClick={() => handleToggleStatus(u)}
                            >
                              <i className={`fa-solid ${u.status === 'active' ? 'fa-ban' : 'fa-check'}`}></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No user accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        user={selectedUser}
      />

      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onReset={handleResetPassword}
        user={userForReset}
      />
    </div>
  );
}
