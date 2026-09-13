/* ==========================================================================
   EXPORT & PRINT UTILITIES
   ========================================================================== */

const ExportManager = {
  downloadPDF() {
    const token = Auth.getToken();
    if (!token) return alert('Session expired. Please log in.');
    window.open(`/api/reports/export/pdf?token=${token}`, '_blank');
  },

  downloadExcel() {
    const token = Auth.getToken();
    if (!token) return alert('Session expired. Please log in.');
    window.open(`/api/reports/export/excel?token=${token}`, '_blank');
  },

  exportCSV(expenses) {
    if (!expenses || expenses.length === 0) {
      alert('No expense data available to export.');
      return;
    }

    const headers = ['Expense ID', 'Date', 'Time', 'Title', 'Person', 'Category', 'Amount', 'Payment Method', 'Vendor', 'Location', 'Notes'];
    let csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n';

    expenses.forEach(e => {
      const row = [
        `"${e.expense_id}"`,
        `"${e.expense_date}"`,
        `"${e.expense_time || ''}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.user_name || '').replace(/"/g, '""')}"`,
        `"${e.category}"`,
        e.amount,
        `"${e.payment_method}"`,
        `"${(e.vendor || '').replace(/"/g, '""')}"`,
        `"${(e.location || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expense_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  printReport() {
    window.print();
  }
};
