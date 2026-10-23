import api from './api';

// Helper to trigger browser file download from Blob
const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};

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
  },

  async importExpenses(formData) {
    const res = await api.post('/expenses/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  // --- Bulk Data Import & Export Methods ---

  async downloadExcelTemplate() {
    const res = await api.get('/expenses/import/template', {
      responseType: 'blob'
    });
    triggerBlobDownload(new Blob([res.data]), 'Expense_Import_Template.xlsx');
    return true;
  },

  async downloadCsvTemplate() {
    const res = await api.get('/expenses/import/template.csv', {
      responseType: 'blob'
    });
    triggerBlobDownload(new Blob([res.data], { type: 'text/csv' }), 'Expense_Import_Template.csv');
    return true;
  },

  async validateImport(formData) {
    const res = await api.post('/expenses/import/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async confirmImport(payload) {
    const res = await api.post('/expenses/import/confirm', payload);
    return res.data;
  },

  async getImportHistory(params = {}) {
    const res = await api.get('/expenses/import/history', { params });
    return res.data;
  },

  async getImportBatchDetails(batchId) {
    const res = await api.get(`/expenses/import/history/${batchId}`);
    return res.data;
  },

  async exportExpensesExcel(params = {}) {
    const res = await api.get('/expenses/export/excel', {
      params,
      responseType: 'blob'
    });
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    triggerBlobDownload(new Blob([res.data]), `Expense_Records_${timestamp}.xlsx`);
    return true;
  },

  async exportExpensesCSV(params = {}) {
    const res = await api.get('/expenses/export/csv', {
      params,
      responseType: 'blob'
    });
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    triggerBlobDownload(new Blob([res.data], { type: 'text/csv' }), `Expense_Records_${timestamp}.csv`);
    return true;
  }
};
