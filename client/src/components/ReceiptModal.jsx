import React from 'react';

export default function ReceiptModal({ receiptUrl, onClose }) {
  if (!receiptUrl) return null;

  const isPdf = receiptUrl.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1080 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content glass-card border-0 p-3 shadow-lg">
          <div className="modal-header border-0 pb-2">
            <h5 className="modal-title fw-bold">
              <i className="fa-solid fa-receipt me-2 text-primary"></i> Receipt Attachment
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body text-center p-3">
            {isPdf ? (
              <div className="p-4 text-center">
                <i className="fa-solid fa-file-pdf text-danger fa-4x mb-3"></i>
                <h5>PDF Receipt Document</h5>
                <p className="text-muted small">You can view or download this document directly:</p>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary-custom"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> Open PDF in New Tab
                </a>
              </div>
            ) : (
              <div className="text-center">
                <img
                  src={receiptUrl}
                  alt="Receipt Preview"
                  className="img-fluid rounded border shadow-sm"
                  style={{ maxHeight: '70vh', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
          <div className="modal-footer border-0 pt-2 d-flex justify-content-between">
            <a
              href={receiptUrl}
              download
              className="btn btn-secondary-custom btn-sm"
            >
              <i className="fa-solid fa-download me-1"></i> Download File
            </a>
            <button
              type="button"
              className="btn btn-secondary-custom btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
