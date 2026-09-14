/* ==========================================================================
   EXPORT & PRINT UTILITIES
   ========================================================================== */

const ExportManager = {
  // Helper to build active filter query parameters from UI
  getFilterQueryString() {
    const params = new URLSearchParams();

    const token = Auth.getToken();
    if (token) params.append('token', token);

    const search = document.getElementById('filterSearch')?.value || '';
    if (search.trim()) params.append('search', search.trim());

    const category = document.getElementById('filterCategory')?.value || 'all';
    if (category && category !== 'all') params.append('category', category);

    const payment = document.getElementById('filterPayment')?.value || 'all';
    if (payment && payment !== 'all') params.append('payment_method', payment);

    const person = document.getElementById('filterPerson')?.value || 'all';
    if (person && person !== 'all') params.append('person', person);

    const startDate = document.getElementById('filterStartDate')?.value || '';
    if (startDate) params.append('startDate', startDate);

    const endDate = document.getElementById('filterEndDate')?.value || '';
    if (endDate) params.append('endDate', endDate);

    return params.toString();
  },

  async downloadWithAuth(url, defaultFilename) {
    const token = Auth.getToken();
    if (!token) {
      App.showToast('Session expired. Please log in.', 'error');
      return;
    }

    try {
      App.showToast('Preparing download...', 'info');
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Export failed with status: ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = defaultFilename;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      App.showToast('File downloaded successfully.', 'success');
    } catch (err) {
      console.error('Export download error:', err);
      // Fallback to window.open with query token
      const separator = url.includes('?') ? '&' : '?';
      window.open(`${url}${separator}token=${token}`, '_blank');
    }
  },

  exportCurrentPDF() {
    const qs = this.getFilterQueryString();
    this.downloadWithAuth(`/api/reports/export/pdf?${qs}`, `Expense_Statement_${Date.now()}.pdf`);
  },

  exportCurrentExcel() {
    const qs = this.getFilterQueryString();
    this.downloadWithAuth(`/api/reports/export/excel?${qs}`, `Expense_Statement_${Date.now()}.xlsx`);
  },

  exportCurrentCSV() {
    const qs = this.getFilterQueryString();
    this.downloadWithAuth(`/api/reports/export/csv?${qs}`, `Expense_Statement_${Date.now()}.csv`);
  },

  // Aliases for compatibility
  downloadPDF() { this.exportCurrentPDF(); },
  downloadExcel() { this.exportCurrentExcel(); },
  downloadCSV() { this.exportCurrentCSV(); },

  printReport() {
    window.print();
  }
};
