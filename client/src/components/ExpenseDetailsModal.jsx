import React from 'react';
import { formatINR, formatDate } from '../utils/constants';

export default function ExpenseDetailsModal({
  expense,
  onClose,
  onEdit,
  onDelete,
  onViewReceipt
}) {
  if (!expense) return null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content glass-card border-0 p-3 shadow-lg">
          <div className="modal-header border-0 pb-2">
            <div>
              <span className="badge bg-primary-subtle text-primary mb-1">
                {expense.expense_id || expense.id}
              </span>
              <h4 className="modal-title fw-bold mb-0">{expense.title}</h4>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body py-3">
            <div className="row g-3">
              <div className="col-sm-6">
                <div className="glass-card p-3 h-100">
                  <span className="text-muted small d-block">Transaction Amount</span>
                  <h3 className="text-primary fw-bold mb-0 mt-1">
                    {formatINR(expense.amount)}
                  </h3>
                </div>
              </div>

              <div className="col-sm-6">
                <div className="glass-card p-3 h-100">
                  <span className="text-muted small d-block">Created By / User</span>
                  <h5 className="fw-bold mb-0 mt-1 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-user-circle text-primary"></i>
                    <span>{expense.created_by || expense.user_name || 'Member'}</span>
                  </h5>
                  {expense.created_at && (
                    <small className="text-muted d-block mt-1">
                      Created: {new Date(expense.created_at).toLocaleString()}
                    </small>
                  )}
                  {expense.updated_at && (
                    <small className="text-muted d-block">
                      Updated: {new Date(expense.updated_at).toLocaleString()}
                    </small>
                  )}
                </div>
              </div>

              <div className="col-sm-4 col-6">
                <div className="text-muted small">Category</div>
                <div className="fw-semibold">
                  <span className="badge bg-light text-dark border">
                    {expense.category}
                  </span>
                </div>
              </div>

              <div className="col-sm-4 col-6">
                <div className="text-muted small">Payment Method</div>
                <div className="fw-semibold">
                  <i className="fa-solid fa-credit-card text-muted me-1"></i>
                  {expense.payment_method}
                </div>
              </div>

              <div className="col-sm-4 col-12">
                <div className="text-muted small">Date & Time</div>
                <div className="fw-semibold">
                  <i className="fa-solid fa-calendar text-muted me-1"></i>
                  {formatDate(expense.expense_date)} at {expense.expense_time || '12:00'}
                </div>
              </div>

              {expense.vendor && (
                <div className="col-sm-6">
                  <div className="text-muted small">Vendor / Store</div>
                  <div className="fw-semibold">
                    <i className="fa-solid fa-store text-muted me-1"></i>
                    {expense.vendor}
                  </div>
                </div>
              )}

              {expense.location && (
                <div className="col-sm-6">
                  <div className="text-muted small">Location</div>
                  <div className="fw-semibold">
                    <i className="fa-solid fa-location-dot text-muted me-1"></i>
                    {expense.location}
                  </div>
                </div>
              )}

              {expense.description && (
                <div className="col-12">
                  <div className="text-muted small">Description</div>
                  <div className="p-2 bg-light rounded small mt-1">
                    {expense.description}
                  </div>
                </div>
              )}

              {expense.notes && (
                <div className="col-12">
                  <div className="text-muted small">Remarks & Tracking Tags</div>
                  <div className="p-2 bg-light rounded small mt-1 text-muted">
                    {expense.notes}
                  </div>
                </div>
              )}

              {expense.receipt && (
                <div className="col-12 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2"
                    onClick={() => onViewReceipt(expense.receipt)}
                  >
                    <i className="fa-solid fa-paperclip"></i>
                    <span>View Attached Receipt Document</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer border-0 pt-2 d-flex justify-content-between flex-wrap gap-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDelete(expense)}
                >
                  <i className="fa-solid fa-trash me-1"></i> Delete
                </button>
              )}
            </div>
            <div className="d-flex gap-2">
              {onEdit && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary-custom"
                  onClick={() => onEdit(expense)}
                >
                  <i className="fa-solid fa-pen me-1"></i> Edit Record
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary-custom"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
