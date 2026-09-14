import api from './api';

export const expenseService = {
  async getExpenses(params = {}) {
    const res = await api.get('/expenses', { params });
    return res.data;
  },

  async getExpenseById(id) {
    const res = await api.get(`/expenses/${id}`);
    return res.data;
  },

  async createExpense(formData) {
    const res = await api.post('/expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async updateExpense(id, formData) {
    const res = await api.put(`/expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async deleteExpense(id) {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },

  async bulkDeleteExpenses(ids) {
    const res = await api.delete('/expenses/bulk', { data: { ids } });
    return res.data;
  },

  async clearAllExpenses(person) {
    const res = await api.delete('/expenses/clear-all', { params: { person } });
    return res.data;
  }
};
