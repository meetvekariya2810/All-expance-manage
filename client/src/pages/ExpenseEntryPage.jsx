import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import { PAYMENT_METHODS } from '../utils/constants';

export default function ExpenseEntryPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseTime, setExpenseTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [vendor, setVendor] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedUser, setAssignedUser] = useState('self');
  const [receiptFile, setReceiptFile] = useState(null);
  const [existingReceipt, setExistingReceipt] = useState('');
  const [receiptPreview, setReceiptPreview] = useState('');

  useEffect(() => {
    const loadInitData = async () => {
      try {
        const catRes = await categoryService.getCategories();
        if (catRes.success) setCategories(catRes.categories || []);

        if (isAdmin) {
          const uRes = await userService.getUsers();
          if (uRes.success) setUsers(uRes.users || []);
        }

        if (isEditMode) {
          const expRes = await expenseService.getExpenseById(id);
          if (expRes.success && expRes.expense) {
            const e = expRes.expense;
            setTitle(e.title || '');
            setAmount(e.amount ? String(e.amount) : '');
            setCategory(e.category || '');
            setPaymentMethod(e.payment_method || 'UPI');
            setExpenseDate(e.expense_date || '');
            setExpenseTime(e.expense_time || '');
            setVendor(e.vendor || '');
            setLocation(e.location || '');
            setDescription(e.description || '');
            setNotes(e.notes || '');
            if (e.receipt) {
              setExistingReceipt(e.receipt);
              setReceiptPreview(e.receipt);
            }
          }
        }
      } catch (err) {
        showToast('Error loading form data: ' + (err.response?.data?.message || err.message), 'error');
      } finally {
        setFetching(false);
      }
    };

    loadInitData();
  }, [id, isEditMode, isAdmin, showToast]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Receipt file must not exceed 5MB.', 'warning');
        return;
      }
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        setReceiptPreview(URL.createObjectURL(file));
      } else {
        setReceiptPreview('');
      }
    }
  };

  const handleReset = () => {
    setTitle('');
    setAmount('');
    setCategory('');
    setPaymentMethod('UPI');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseTime(new Date().toTimeString().slice(0, 5));
    setVendor('');
    setLocation('');
    setDescription('');
    setNotes('');
    setAssignedUser('self');
    setReceiptFile(null);
    setReceiptPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !category || !amount || !expenseDate) {
      showToast('Please fill in all required fields (Title, Amount, Category, Date).', 'warning');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Amount must be a positive number.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('amount', parsedAmount);
    formData.append('category', category);
    formData.append('payment_method', paymentMethod);
    formData.append('expense_date', expenseDate);
    formData.append('expense_time', expenseTime);
    formData.append('vendor', vendor.trim());
    formData.append('location', location.trim());
    formData.append('description', description.trim());
    formData.append('notes', notes.trim());

    if (isAdmin && assignedUser !== 'self') {
      formData.append('assigned_user', assignedUser);
    }

    if (receiptFile) {
      formData.append('receipt', receiptFile);
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await expenseService.updateExpense(id, formData);
        showToast('Expense updated successfully!', 'success');
      } else {
        await expenseService.createExpense(formData);
        showToast('Expense recorded successfully!', 'success');
      }
      navigate('/expenses');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save expense.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="view-container active text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading transaction details...</p>
      </div>
    );
  }

  return (
    <div className="view-container active">
      <div className="page-title-box">
        <div>
          <h3>{isEditMode ? 'Edit Expense Entry' : 'Add New Expense Entry'}</h3>
          <p>
            {isEditMode
              ? 'Update expense transaction details, classification and receipt'
              : 'Record daily expense transactions with detail tags & receipt upload'}
          </p>
        </div>
        <div>
          <button className="btn btn-secondary-custom" onClick={() => navigate('/expenses')}>
            <i className="fa-solid fa-arrow-left me-1"></i> Back to Records
          </button>
        </div>
      </div>

      <div className="glass-card form-glass p-4">
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* Title */}
            <div className="col-md-8">
              <label className="form-label fw-semibold">Expense Title / Item *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Grocery shopping, Fuel, Team Lunch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Amount */}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Amount (₹) *</label>
              <div className="input-group">
                <span className="input-group-text bg-light fw-bold">₹</span>
                <input
                  type="number"
                  className="form-control"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Category */}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Category *</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select Category *</option>
                {categories.map((c) => (
                  <option key={c.id || c._id} value={c.category_name}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Payment Method *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin Member Assignment Scope */}
            {isAdmin && !isEditMode && (
              <div className="col-md-4">
                <label className="form-label fw-semibold">Assign Expense To</label>
                <select
                  className="form-select"
                  value={assignedUser}
                  onChange={(e) => setAssignedUser(e.target.value)}
                >
                  <option value="self">Myself (Current Admin)</option>
                  {users.map((u) => (
                    <option key={u.id || u._id} value={u.id || u._id}>
                      {u.name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date & Time */}
            <div className={`col-md-2 ${isAdmin && !isEditMode ? 'col-6' : 'col-6'}`}>
              <label className="form-label fw-semibold">Date *</label>
              <input
                type="date"
                className="form-control"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div className={`col-md-2 ${isAdmin && !isEditMode ? 'col-6' : 'col-6'}`}>
              <label className="form-label fw-semibold">Time</label>
              <input
                type="time"
                className="form-control"
                value={expenseTime}
                onChange={(e) => setExpenseTime(e.target.value)}
              />
            </div>

            {/* Vendor */}
            <div className="col-md-6">
              <label className="form-label fw-semibold">Vendor / Store Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. DMart, Shell Petrol Pump, Amazon"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="col-md-6">
              <label className="form-label fw-semibold">Location / City</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ahmedabad, Surat, Online"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="col-12">
              <label className="form-label fw-semibold">Description / Item Details</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Optional notes about the transaction..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>

            {/* Remarks / Tags */}
            <div className="col-12">
              <label className="form-label fw-semibold">Notes / Remarks</label>
              <input
                type="text"
                className="form-control"
                placeholder="Additional remarks or tracking tags"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Receipt Upload */}
            <div className="col-12">
              <label className="form-label fw-semibold">Receipt Attachment (Image or PDF)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
              <div className="form-text small text-muted">
                Supported formats: JPG, JPEG, PNG, WEBP, PDF (Max 5MB)
              </div>

              {receiptPreview && (
                <div className="mt-3 p-2 border rounded glass-card d-inline-block">
                  <div className="small fw-semibold mb-1 text-muted">Receipt Preview:</div>
                  <img
                    src={receiptPreview}
                    alt="Receipt"
                    className="img-thumbnail"
                    style={{ maxHeight: '160px', objectFit: 'contain' }}
                  />
                </div>
              )}

              {existingReceipt && !receiptPreview && (
                <div className="mt-2 small text-success">
                  <i className="fa-solid fa-file-check me-1"></i>
                  Current receipt attached: <strong>{existingReceipt.split('/').pop()}</strong>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="col-12 mt-4 pt-2 border-top d-flex gap-2 justify-content-end flex-wrap">
              <button
                type="button"
                className="btn btn-secondary-custom"
                onClick={() => navigate('/expenses')}
              >
                Cancel
              </button>
              {!isEditMode && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleReset}
                >
                  Reset Form
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary-custom"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk me-1"></i>
                    {isEditMode ? 'Update Expense Entry' : 'Save Expense Entry'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
