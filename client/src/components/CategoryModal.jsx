import React, { useState, useEffect } from 'react';

export default function CategoryModal({
  isOpen,
  onClose,
  onSave,
  category = null
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('fa-tag');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.category_name || '');
      setIcon(category.icon || 'fa-tag');
    } else {
      setName('');
      setIcon('fa-tag');
    }
    setError('');
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave({ category_name: name.trim(), icon: icon.trim() });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error saving category.');
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
              {category ? 'Edit Category' : 'Add New Category'}
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
                <label className="form-label fw-semibold">Category Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Travel, Gym, Groceries"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">FontAwesome Icon Class</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className={`fa-solid ${icon || 'fa-tag'}`}></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. fa-utensils, fa-plane, fa-car"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  />
                </div>
                <div className="form-text small text-muted">
                  Enter FontAwesome icon name (e.g. fa-gas-pump, fa-film, fa-bolt).
                </div>
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
                {loading ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
