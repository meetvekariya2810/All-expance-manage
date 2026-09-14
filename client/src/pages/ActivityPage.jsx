import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { activityService } from '../services/activityService';
import { formatINR, formatDate } from '../utils/constants';

export default function ActivityPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('all');
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (isAdmin && selectedUser !== 'all') {
        params.user = selectedUser;
      }
      const data = await activityService.getActivities(params);
      if (data.success) {
        setActivities(data.activities || []);
        setTotalRecords(data.total || 0);
      }
    } catch (err) {
      showToast('Error loading activity logs: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedUser, showToast]);

  useEffect(() => {
    fetchActivities();
    const handleRefresh = () => fetchActivities();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchActivities]);

  const getActionBadge = (type) => {
    switch (type) {
      case 'create':
        return { icon: 'fa-circle-plus', color: 'text-success', bg: 'bg-success-subtle' };
      case 'update':
        return { icon: 'fa-pen-to-square', color: 'text-warning', bg: 'bg-warning-subtle' };
      case 'delete':
        return { icon: 'fa-trash', color: 'text-danger', bg: 'bg-danger-subtle' };
      default:
        return { icon: 'fa-info-circle', color: 'text-primary', bg: 'bg-primary-subtle' };
    }
  };

  return (
    <div className="view-container active">
      {/* Title Box */}
      <div className="page-title-box">
        <div>
          <h3>
            {isAdmin ? 'System Activity & Audit Log' : 'My Activity History'}
          </h3>
          <p>
            {isAdmin
              ? 'Real-time audit log of all actions performed by Meet, Harsh, and Bhavik Bhai'
              : 'Detailed chronological log of all your expense and account activities'}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-secondary-custom" onClick={fetchActivities}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh Feed
          </button>
        </div>
      </div>

      {/* Admin User Filter */}
      {isAdmin && (
        <div className="glass-card p-3 mb-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-filter text-primary"></i>
              <span className="fw-bold small text-muted text-uppercase">Filter Activity by Member:</span>
            </div>
            <div className="btn-group btn-group-sm flex-wrap" role="group">
              <button
                type="button"
                className={`btn ${selectedUser === 'all' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUser('all')}
              >
                All Members
              </button>
              <button
                type="button"
                className={`btn ${selectedUser === 'bhavik' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUser('bhavik')}
              >
                Bhavik Bhai
              </button>
              <button
                type="button"
                className={`btn ${selectedUser === 'meet' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUser('meet')}
              >
                Meet
              </button>
              <button
                type="button"
                className={`btn ${selectedUser === 'harsh' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
                onClick={() => setSelectedUser('harsh')}
              >
                Harsh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline List */}
      <div className="glass-card p-4">
        <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
          <h5 className="fw-bold mb-0">
            <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i> Chronological Activity Stream
          </h5>
          <span className="badge bg-light text-dark border">
            {totalRecords} Total Log Entries
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
            Loading activity stream...
          </div>
        ) : activities.length > 0 ? (
          <div className="activity-timeline">
            {activities.map((act) => {
              const badge = getActionBadge(act.type);
              const timestampDate = new Date(act.timestamp);
              const dateStr = formatDate(timestampDate.toISOString().slice(0, 10));
              const timeStr = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={act._id || act.id}
                  className="glass-card p-3 mb-3 border-start border-4"
                  style={{
                    borderLeftColor:
                      act.type === 'create'
                        ? '#10b981'
                        : act.type === 'update'
                        ? '#f59e0b'
                        : act.type === 'delete'
                        ? '#ef4444'
                        : '#3b82f6'
                  }}
                >
                  <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-start gap-3">
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center ${badge.bg} ${badge.color}`}
                        style={{ width: '40px', height: '40px', flexShrink: 0 }}
                      >
                        <i className={`fa-solid ${badge.icon} fs-5`}></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-bold text-dark">{act.user_name}</span>
                          <span className="badge bg-secondary-subtle text-secondary small">
                            {act.action}
                          </span>
                          {act.category && (
                            <span className="badge bg-primary-subtle text-primary small">
                              {act.category}
                            </span>
                          )}
                          {act.expense_id && (
                            <span className="badge bg-light text-muted border font-monospace small">
                              {act.expense_id}
                            </span>
                          )}
                        </div>
                        <p className="mb-1 mt-1 text-muted small">{act.details}</p>
                      </div>
                    </div>

                    <div className="text-end ms-auto ms-md-0">
                      {act.amount > 0 && (
                        <div className="fw-bold fs-6 text-primary mb-1">
                          {formatINR(act.amount)}
                        </div>
                      )}
                      <div className="small text-muted">
                        <i className="fa-regular fa-clock me-1"></i>
                        {dateStr} at {timeStr}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-5 text-muted">
            <i className="fa-solid fa-list-check fs-1 text-muted mb-2 d-block"></i>
            No activity recorded yet for the selected scope.
          </div>
        )}
      </div>
    </div>
  );
}
