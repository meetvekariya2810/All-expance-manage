import api from './api';

export const categoryService = {
  async getCategories(includeInactive = false) {
    const res = await api.get('/categories', { params: { includeInactive } });
    return res.data;
  },

  async createCategory(categoryData) {
    const res = await api.post('/categories', categoryData);
    return res.data;
  },

  async updateCategory(id, categoryData) {
    const res = await api.put(`/categories/${id}`, categoryData);
    return res.data;
  },

  async toggleStatus(id) {
    const res = await api.patch(`/categories/${id}/status`);
    return res.data;
  }
};
