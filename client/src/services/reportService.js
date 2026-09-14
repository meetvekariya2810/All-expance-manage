import api from './api';

export const reportService = {
  async getSummaryMetrics(params = {}) {
    const res = await api.get('/reports/metrics', { params });
    return res.data;
  },

  async downloadExport(type, params = {}) {
    const res = await api.get(`/reports/export/${type}`, {
      params,
      responseType: 'blob'
    });

    const extensionMap = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };
    const ext = extensionMap[type] || type;
    const defaultFilename = `Expense_Statement_${Date.now()}.${ext}`;

    const disposition = res.headers['content-disposition'];
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return filename;
  }
};
