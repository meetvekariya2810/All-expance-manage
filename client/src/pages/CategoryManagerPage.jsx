import React, { useState, useEffect, useCallback } from 'react';
import { categoryService } from '../services/categoryService';
import { useToast } from '../context/ToastContext';
import CategoryModal from '../components/CategoryModal';

export default function CategoryManagerPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoryService.getCategories(true);
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      showToast('Error loading categories.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSaveCategory = async (catData) => {
    if (selectedCategory) {
      await categoryService.updateCategory(selectedCategory.id || selectedCategory._id, catData);
      showToast('Category updated successfully!', 'success');
    } else {
      await categoryService.createCategory(catData);
      showToast('Category created successfully!', 'success');
    }
    fetchCategories();
  };

  const handleToggleStatus = async (cat) => {
    try {
      const res = await categoryService.toggleStatus(cat.id || cat._id);
      showToast(res.message || 'Status updated.', 'success');
      fetchCategories();
    } catch (err) {
      showToast('Error toggling category status.', 'error');
    }
  };

  return (
    <div className="view-container active">
      <div className="page-title-box">
        <div>
          <h3>Expense Category Management</h3>
          <p>Add, edit, enable or disable expense categories for all system users</p>
        </div>
        <div>
          <button
            className="btn btn-primary-custom"
            onClick={() => { setSelectedCategory(null); setIsModalOpen(true); }}
          >
            <i className="fa-solid fa-plus me-1"></i> Add Category
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="table-glass-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Icon</th>
                <th>Category Name</th>
                <th>Status</th>
                <th>Type</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length > 0 ? (
                categories.map((c) => (
                  <tr key={c.id || c._id}>
                    <td>
                      <div className="category-icon-preview">
                        <i className={`fa-solid ${c.icon || 'fa-tag'}`}></i>
                      </div>
                    </td>
                    <td className="fw-bold">{c.category_name}</td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <span className="small text-muted">
                        {c.is_default ? 'System Default' : 'Custom'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => { setSelectedCategory(c); setIsModalOpen(true); }}
                        >
                          <i className="fa-solid fa-pen me-1"></i> Edit
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            c.status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'
                          }`}
                          onClick={() => handleToggleStatus(c)}
                        >
                          {c.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Add/Edit Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCategory}
        category={selectedCategory}
      />
    </div>
  );
}
