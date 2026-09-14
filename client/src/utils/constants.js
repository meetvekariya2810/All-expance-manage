export const PAYMENT_METHODS = [
  'UPI',
  'Cash',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Other'
];

export const DATE_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all', label: 'All Time' }
];

export const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date: Newest', sortBy: 'expense_date', sortOrder: 'desc' },
  { value: 'date_asc', label: 'Date: Oldest', sortBy: 'expense_date', sortOrder: 'asc' },
  { value: 'amount_desc', label: 'Amount: High-Low', sortBy: 'amount', sortOrder: 'desc' },
  { value: 'amount_asc', label: 'Amount: Low-High', sortBy: 'amount', sortOrder: 'asc' },
  { value: 'title_asc', label: 'Title: A-Z', sortBy: 'title', sortOrder: 'asc' },
  { value: 'category_asc', label: 'Category: A-Z', sortBy: 'category', sortOrder: 'asc' }
];

export const formatINR = (num) => {
  const val = parseFloat(num) || 0;
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};
