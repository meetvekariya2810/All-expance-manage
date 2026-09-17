import React, { useState, useEffect, useCallback } from 'react';
import { fundService } from '../services/fundService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatDate } from '../utils/constants';
import AddFundModal from '../components/AddFundModal';

export default function FundListPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [personFilter, setPersonFilter] = useState('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState(null);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (personFilter !== 'all') params.person = personFilter;

      const data = await fundService.getFunds(params);
      if (data.success) {
        setFunds(data.funds || []);
        setTotalAmount(data.totalAmount || 0);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error fetching funds:', err);
      showToast('Failed to load fund history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, startDate, endDate, personFilter, showToast]);

  useEffect(() => {
    fetchFunds();

    const handleRefresh = () => fetchFunds();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchFunds]);

  const handleDeleteFund = async (fund) => {
    const id = fund._id || fund.id || fund.fund_id;
    const confirmMsg = `Permanently delete Fund "${fund.fund_id}"?\n\nAmount: +₹${(parseFloat(fund.amount) || 0).toLocaleString('en-IN')}\nPerson: ${fund.person_name}\n\nThis deletion is permanent in MongoDB Atlas and cannot be recovered.\n\nClick OK to confirm permanent deletion.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fundService.deleteFund(id);
      showToast(res?.message || 'Fund deleted permanently.', 'success');
      window.dispatchEvent(new Event('app:refresh'));
      await fetchFunds();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete fund.', 'error');
    }
  };

  const handleOpenEdit = (fund) => {
    setEditingFund(fund);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingFund(null);
    setIsModalOpen(true);
  };

  return (
    <div className="view-container active">
      {/* Top Header & Quick Action */}
      <div className="page-title-box">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              <i className="fa-solid fa-arrow-down-left me-1"></i> MONEY IN
            </span>
            <h3 className="mb-0">Fund History</h3>
          </div>
          <p className="mb-0 mt-1">Manage all incoming funds and money added to the personal account</p>
        </div>
        <div>
          <button
            className="btn btn-success-custom d-flex align-items-center gap-2 shadow-sm"
            onClick={handleOpenNew}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff' }}
          >
            <i className="fa-solid fa-plus-circle"></i>
            <span>+ Add Fund</span>
          </button>
        </div>
      </div>

      {/* Summary Statistic Banner */}
      <div className="row g-3 mb-4">
        <div className="col-md-6 col-xl-4">
          <div className="stat-card glass-card h-100 p-3" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="stat-card-title text-uppercase" style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  Total Funds Added
                </div>
                <div className="stat-card-value my-1" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
                  +{formatINR(totalAmount)}
                </div>
                <div className="stat-card-subtitle" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {totalCount} total deposit records
                </div>
              </div>
              <div className="stat-card-icon rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '1.4rem' }}>
                <i className="fa-solid fa-vault"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
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
                placeholder="Search by Fund ID, Person, Notes, Creator..."
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
            <input
              type="date"
              className="form-control border-0"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="From Date"
              title="From Date"
              style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc' }}
            />
          </div>

          <div className="col-6 col-md-3">
            <input
              type="date"
              className="form-control border-0"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="To Date"
              title="To Date"
              style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc' }}
            />
          </div>

          <div className="col-12 col-md-1 d-flex gap-1">
            <button
              className="btn btn-secondary-custom w-100 p-2"
              title="Reset Filters"
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setPersonFilter('all');
              }}
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Funds Table / Card List */}
      <div className="glass-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ color: '#f8fafc' }}>
            <thead style={{ background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <tr>
                <th className="py-3 px-4">Fund ID</th>
                <th className="py-3">Person</th>
                <th className="py-3">Date</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Notes</th>
                <th className="py-3">Added By</th>
                <th className="py-3 px-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-success" role="status">
                      <span className="visually-hidden">Loading funds...</span>
                    </div>
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <div className="mb-2" style={{ fontSize: '2rem', color: '#64748b' }}>
                      <i className="fa-solid fa-receipt"></i>
                    </div>
                    <h6>No fund records found</h6>
                    <p className="small mb-3" style={{ color: '#94a3b8' }}>Click "+ Add Fund" to record incoming funds.</p>
                    <button className="btn btn-sm btn-success-custom" onClick={handleOpenNew}>
                      + Add First Fund
                    </button>
                  </td>
                </tr>
              ) : (
                funds.map((f) => (
                  <tr key={f._id || f.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td className="py-3 px-4 fw-semibold" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {f.fund_id || f.id}
                    </td>
                    <td className="py-3">
                      <div className="fw-semibold text-white">{f.person_name}</div>
                    </td>
                    <td className="py-3" style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {formatDate(f.fund_date)}
                    </td>
                    <td className="py-3">
                      <span className="badge py-2 px-3 rounded-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.9rem', fontWeight: '700' }}>
                        +{formatINR(f.amount)}
                      </span>
                    </td>
                    <td className="py-3" style={{ maxWidth: '240px', fontSize: '0.875rem', color: '#94a3b8' }}>
                      {f.notes || <span className="text-muted fst-italic">None</span>}
                    </td>
                    <td className="py-3" style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <i className="fa-solid fa-user-circle me-1 text-muted"></i>
                      {f.created_by || f.user_name || 'Admin'}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary border-0"
                          title="Edit Fund"
                          onClick={() => handleOpenEdit(f)}
                          style={{ color: '#94a3b8' }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger border-0"
                          title="Delete Fund"
                          onClick={() => handleDeleteFund(f)}
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

      {/* Add / Edit Fund Modal */}
      <AddFundModal
        isOpen={isModalOpen}
        initialFund={editingFund}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchFunds}
      />
    </div>
  );
}
