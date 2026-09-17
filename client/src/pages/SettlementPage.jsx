import React, { useState, useEffect, useCallback } from 'react';
import { settlementService } from '../services/settlementService';
import { reportService } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/constants';
import SettlementModal from '../components/SettlementModal';

export default function SettlementPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [personBreakdown, setPersonBreakdown] = useState([]);
  const [globalMetrics, setGlobalMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.settlement_type = typeFilter;

      const [settleRes, metricsRes] = await Promise.all([
        settlementService.getSettlements(params),
        reportService.getSummaryMetrics()
      ]);

      if (settleRes.success) {
        setSettlements(settleRes.settlements || []);
        setSummary(settleRes.summary || null);
        setPersonBreakdown(settleRes.personBreakdown || []);
      }

      if (metricsRes.success) {
        setGlobalMetrics(metricsRes.metrics);
      }
    } catch (err) {
      console.error('Error fetching settlements:', err);
      showToast('Failed to load settlement data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, typeFilter, showToast]);

  useEffect(() => {
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchData]);

  const handleToggleStatus = async (settle) => {
    const id = settle._id || settle.id || settle.settlement_id;
    const nextStatus = settle.status === 'Pending' ? 'Settled' : 'Pending';
    try {
      await settlementService.updateSettlementStatus(id, nextStatus);
      showToast(`Settlement marked as ${nextStatus}.`, 'success');
      window.dispatchEvent(new Event('app:refresh'));
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const handleDeleteSettlement = async (settle) => {
    const id = settle._id || settle.id || settle.settlement_id;
    const confirmMsg = `Delete Settlement "${settle.settlement_id}"?\n\nPerson: ${settle.person_name}\nAmount: ₹${(parseFloat(settle.amount) || 0).toLocaleString('en-IN')} (${settle.settlement_type})\n\nThis deletion is permanent in MongoDB Atlas.\n\nClick OK to confirm.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await settlementService.deleteSettlement(id);
      showToast(res?.message || 'Settlement permanently deleted.', 'success');
      window.dispatchEvent(new Event('app:refresh'));
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete settlement.', 'error');
    }
  };

  const handleOpenEdit = (settle) => {
    setEditingSettlement(settle);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingSettlement(null);
    setIsModalOpen(true);
  };

  return (
    <div className="view-container active">
      {/* Page Title Box */}
      <div className="page-title-box">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              <i className="fa-solid fa-scale-balanced me-1"></i> SETTLE UP
            </span>
            <h3 className="mb-0">Settle Up Manager</h3>
          </div>
          <p className="mb-0 mt-1">Manage person settlements and maintain balance between funds received and expenditures</p>
        </div>
        <div>
          <button
            className="btn btn-primary-custom d-flex align-items-center gap-2 shadow-sm"
            onClick={handleOpenNew}
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff' }}
          >
            <i className="fa-solid fa-handshake"></i>
            <span>+ New Settlement</span>
          </button>
        </div>
      </div>

      {/* Top Financial Position Grid */}
      <div className="row g-3 mb-4">
        {/* Total Funds */}
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card glass-card p-3 h-100" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Total Funds In
            </div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
              +{formatINR(globalMetrics?.totalFunds || 0)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Money added to account
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card glass-card p-3 h-100" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Total Expenses Out
            </div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
              -{formatINR(globalMetrics?.totalSpending || 0)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Expenditures spent
            </div>
          </div>
        </div>

        {/* Available Balance */}
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card glass-card p-3 h-100" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Available Balance
            </div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: (globalMetrics?.availableBalance || 0) >= 0 ? '#3b82f6' : '#ef4444' }}>
              {formatINR(globalMetrics?.availableBalance || 0)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Funds - Expenses
            </div>
          </div>
        </div>

        {/* Unsettled Pending Amount */}
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card glass-card p-3 h-100" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-card-title text-uppercase" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Unsettled / Pending
            </div>
            <div className="stat-card-value my-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
              {formatINR(summary?.pendingAmount || 0)}
            </div>
            <div className="stat-card-subtitle" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {summary?.pendingCount || 0} pending settlements
            </div>
          </div>
        </div>
      </div>

      {/* Person-wise Ledger Breakdown */}
      {personBreakdown.length > 0 && (
        <div className="mb-4">
          <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#f8fafc' }}>
            <i className="fa-solid fa-users text-primary"></i>
            <span>Person-Wise Settlement Ledger</span>
          </h5>
          <div className="row g-3">
            {personBreakdown.map((p) => (
              <div key={p.person_name} className="col-md-6 col-xl-4">
                <div className="glass-card p-3 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 'bold' }}>
                        {p.person_name.charAt(0).toUpperCase()}
                      </div>
                      <h6 className="mb-0 fw-bold text-white">{p.person_name}</h6>
                    </div>
                    {p.pendingCount > 0 ? (
                      <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill">
                        {p.pendingCount} Pending
                      </span>
                    ) : (
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                        Settled
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded mt-2" style={{ background: 'rgba(15, 23, 42, 0.4)', fontSize: '0.85rem' }}>
                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Total Received:</span>
                      <span className="fw-semibold text-success">+{formatINR(p.totalReceived)}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Total Paid:</span>
                      <span className="fw-semibold text-danger">-{formatINR(p.totalPaid)}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.1) !important' }}>
                      <span className="fw-bold text-white">Net Position:</span>
                      <span className={`fw-bold ${p.net >= 0 ? 'text-primary' : 'text-danger'}`}>
                        {p.net >= 0 ? `+${formatINR(p.net)}` : formatINR(p.net)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card p-3 mb-4">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }}>
                <i className="fa-solid fa-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-0"
                placeholder="Search settlements by Person, ID, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc' }}
              />
              {searchTerm && (
                <button className="btn border-0" style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }} onClick={() => setSearchTerm('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select border-0"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc' }}
            >
              <option value="all">All Statuses</option>
              <option value="Settled">Settled</option>
              <option value="Pending">Pending (Unsettled)</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select border-0"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc' }}
            >
              <option value="all">All Types</option>
              <option value="Paid">Paid (Money Out)</option>
              <option value="Received">Received (Money In)</option>
            </select>
          </div>

          <div className="col-12 col-md-1">
            <button
              className="btn btn-secondary-custom w-100 p-2"
              title="Reset Filters"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Settlements List Table */}
      <div className="glass-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ color: '#f8fafc' }}>
            <thead style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <tr>
                <th className="py-3 px-4">Settlement ID</th>
                <th className="py-3">Person</th>
                <th className="py-3">Type</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Date</th>
                <th className="py-3">Status</th>
                <th className="py-3">Notes</th>
                <th className="py-3 px-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading settlements...</span>
                    </div>
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <div className="mb-2" style={{ fontSize: '2rem', color: '#64748b' }}>
                      <i className="fa-solid fa-handshake-simple"></i>
                    </div>
                    <h6>No settlement records found</h6>
                    <p className="small mb-3" style={{ color: '#94a3b8' }}>Click "+ New Settlement" to record a settlement.</p>
                    <button className="btn btn-sm btn-primary-custom" onClick={handleOpenNew}>
                      + New Settlement
                    </button>
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s._id || s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td className="py-3 px-4 fw-semibold" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {s.settlement_id || s.id}
                    </td>
                    <td className="py-3">
                      <div className="fw-semibold text-white">{s.person_name}</div>
                    </td>
                    <td className="py-3">
                      <span className={`badge py-1 px-2 rounded-pill ${s.settlement_type === 'Paid' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                        {s.settlement_type === 'Paid' ? 'Paid (Out)' : 'Received (In)'}
                      </span>
                    </td>
                    <td className="py-3 fw-bold" style={{ fontSize: '0.95rem', color: s.settlement_type === 'Paid' ? '#f87171' : '#34d399' }}>
                      {s.settlement_type === 'Paid' ? `-${formatINR(s.amount)}` : `+${formatINR(s.amount)}`}
                    </td>
                    <td className="py-3" style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {formatDate(s.settlement_date)}
                    </td>
                    <td className="py-3">
                      <button
                        className={`badge border-0 py-1 px-2 rounded-pill ${s.status === 'Settled' ? 'bg-success text-white' : 'bg-warning text-dark'}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to toggle status"
                        onClick={() => handleToggleStatus(s)}
                      >
                        <i className={`fa-solid ${s.status === 'Settled' ? 'fa-check-circle' : 'fa-clock'} me-1`}></i>
                        {s.status}
                      </button>
                    </td>
                    <td className="py-3" style={{ maxWidth: '200px', fontSize: '0.85rem', color: '#94a3b8' }}>
                      {s.notes || <span className="text-muted fst-italic">None</span>}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary border-0"
                          title="Edit Settlement"
                          onClick={() => handleOpenEdit(s)}
                          style={{ color: '#94a3b8' }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger border-0"
                          title="Delete Settlement"
                          onClick={() => handleDeleteSettlement(s)}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New / Edit Settlement Modal */}
      <SettlementModal
        isOpen={isModalOpen}
        initialSettlement={editingSettlement}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}
