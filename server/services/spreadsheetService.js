const ExcelJS = require('exceljs');
const crypto = require('crypto');

// Standard payment methods recognized by SmartExpense
const ALLOWED_PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Other'];

// Standard default categories
const DEFAULT_CATEGORIES = [
  'Food', 'Grocery', 'Petrol', 'Shopping', 'Medical', 'Electricity Bill',
  'Water Bill', 'Gas', 'Internet', 'Mobile Recharge', 'Entertainment',
  'Travel', 'Rent', 'Education', 'EMI', 'Investment', 'Gym & Fitness', 'Miscellaneous'
];

// Header aliases for intelligent mapping
const HEADER_ALIASES = {
  expense_date: [
    'expense_date', 'date', 'expense date', 'date (dd/mm)', 'entry date',
    'transaction date', 'txndate', 'trans date', 'date_time', 'datetime'
  ],
  expense_time: [
    'expense_time', 'time', 'expense time', 'transaction time', 'time (hh:mm)'
  ],
  title: [
    'title', 'expense name', 'description', 'expense description', 'name',
    'item', 'item name', 'particulars', 'title/description', 'item description'
  ],
  amount: [
    'amount', 'amount (inr)', 'cost', 'price', 'inr', 'total', 'amt',
    'expense amount', 'amount in inr', 'value', 'transaction amount'
  ],
  category: [
    'category', 'category name', 'expense category', 'type', 'cat'
  ],
  payment_method: [
    'payment_method', 'payment method', 'payment mode', 'mode', 'paid via',
    'payment type', 'payment', 'method', 'paid by'
  ],
  description: [
    'description', 'details', 'desc', 'full description', 'item details'
  ],
  vendor: [
    'vendor', 'merchant', 'store', 'shop', 'payee', 'vendor name', 'seller'
  ],
  location: [
    'location', 'city', 'place', 'address', 'area'
  ],
  notes: [
    'notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'extra notes'
  ],
  username: [
    'username', 'user', 'member', 'account', 'assigned to', 'assigned_to',
    'user name', 'member name', 'owner'
  ]
};

// CSV Formula Injection Neutralizer
const neutralizeFormula = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
};

// Escape CSV string with quotes if needed
const escapeCsvField = (val) => {
  if (val === null || val === undefined) return '""';
  let str = neutralizeFormula(val);
  if (typeof str !== 'string') str = String(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generate official downloadable Excel Template (.xlsx)
 */
const generateExcelTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartExpense System';
  workbook.lastModifiedBy = 'SmartExpense System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Worksheet 1: Template
  const worksheet = workbook.addWorksheet('Expenses Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = [
    { header: 'expense_date *', key: 'expense_date', width: 16 },
    { header: 'expense_time', key: 'expense_time', width: 14 },
    { header: 'title *', key: 'title', width: 28 },
    { header: 'amount *', key: 'amount', width: 16 },
    { header: 'category *', key: 'category', width: 20 },
    { header: 'payment_method *', key: 'payment_method', width: 18 },
    { header: 'description', key: 'description', width: 28 },
    { header: 'vendor', key: 'vendor', width: 20 },
    { header: 'location', key: 'location', width: 18 },
    { header: 'notes', key: 'notes', width: 26 },
    { header: 'username (Admin Only)', key: 'username', width: 22 }
  ];

  // Header styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate-900 / Dark Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Sample Rows matching requirements
  worksheet.addRow({
    expense_date: '2026-10-01',
    expense_time: '10:30',
    title: 'Grocery Purchase',
    amount: 850.00,
    category: 'Grocery',
    payment_method: 'UPI',
    description: 'Monthly groceries',
    vendor: 'Local Store',
    location: 'Ahmedabad',
    notes: 'Household expense',
    username: 'bhavik'
  });

  worksheet.addRow({
    expense_date: '2026-10-02',
    expense_time: '18:00',
    title: 'Electricity Bill',
    amount: 1500.00,
    category: 'Electricity Bill',
    payment_method: 'Net Banking',
    description: 'Monthly bill',
    vendor: 'Utility Provider',
    location: 'Online',
    notes: 'October bill',
    username: 'bhavik'
  });

  // Apply row heights and alignments
  [2, 3].forEach(rowIdx => {
    const r = worksheet.getRow(rowIdx);
    r.height = 22;
    r.getCell('amount').numFmt = '#,##0.00';
    r.getCell('amount').alignment = { horizontal: 'right' };
    r.getCell('expense_date').alignment = { horizontal: 'center' };
    r.getCell('expense_time').alignment = { horizontal: 'center' };
    r.getCell('payment_method').alignment = { horizontal: 'center' };
  });

  // Worksheet 2: Instructions
  const instSheet = workbook.addWorksheet('Instructions');
  instSheet.columns = [
    { header: 'Field Name', key: 'field', width: 22 },
    { header: 'Required?', key: 'required', width: 14 },
    { header: 'Format / Allowed Values', key: 'format', width: 34 },
    { header: 'Description & Guidance', key: 'desc', width: 44 }
  ];

  const instHeader = instSheet.getRow(1);
  instHeader.height = 26;
  instHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  instHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  instHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  const instructions = [
    { field: 'expense_date', required: 'YES', format: 'YYYY-MM-DD or DD/MM/YYYY', desc: 'Date transaction took place (e.g. 2026-10-01 or 01/10/2026)' },
    { field: 'expense_time', required: 'NO', format: 'HH:mm (24-hour clock)', desc: 'Time of expense (e.g. 10:30, 18:00). Defaults to 12:00 if omitted' },
    { field: 'title', required: 'YES', format: 'Text (max 200 chars)', desc: 'Brief title or name of the expense' },
    { field: 'amount', required: 'YES', format: 'Positive number (e.g. 850.00)', desc: 'Must be greater than 0. No currency symbols required' },
    { field: 'category', required: 'YES', format: 'Existing category name', desc: 'e.g. Food, Grocery, Petrol, Shopping, Electricity Bill, Travel, etc.' },
    { field: 'payment_method', required: 'YES', format: 'Cash, UPI, Credit Card, Debit Card, Net Banking, Other', desc: 'Payment channel used for transaction' },
    { field: 'description', required: 'NO', format: 'Text', desc: 'Detailed description or breakdown' },
    { field: 'vendor', required: 'NO', format: 'Text', desc: 'Store, merchant, shop, or payee name' },
    { field: 'location', required: 'NO', format: 'Text', desc: 'City or place of transaction (e.g. Ahmedabad, Online)' },
    { field: 'notes', required: 'NO', format: 'Text', desc: 'Optional audit remarks or internal comments' },
    { field: 'username', required: 'ADMIN ONLY', format: 'Registered active username', desc: 'Optional username assignment (bhavik, meet, harsh). Ignored for non-admins.' }
  ];

  instructions.forEach(item => {
    const r = instSheet.addRow(item);
    r.height = 22;
    if (item.required === 'YES') {
      r.getCell('required').font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Generate official downloadable CSV Template
 */
const generateCsvTemplate = () => {
  const headers = [
    'expense_date',
    'expense_time',
    'title',
    'amount',
    'category',
    'payment_method',
    'description',
    'vendor',
    'location',
    'notes',
    'username'
  ];

  const row1 = [
    '2026-10-01',
    '10:30',
    'Grocery Purchase',
    '850.00',
    'Grocery',
    'UPI',
    'Monthly groceries',
    'Local Store',
    'Ahmedabad',
    'Household expense',
    'bhavik'
  ];

  const row2 = [
    '2026-10-02',
    '18:00',
    'Electricity Bill',
    '1500.00',
    'Electricity Bill',
    'Net Banking',
    'Monthly bill',
    'Utility Provider',
    'Online',
    'October bill',
    'bhavik'
  ];

  return [
    headers.join(','),
    row1.map(escapeCsvField).join(','),
    row2.map(escapeCsvField).join(',')
  ].join('\r\n');
};

/**
 * Parse CSV buffer or string into raw headers and rows
 */
const parseCsv = (contentStr) => {
  const lines = contentStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = [];
    let insideQuotes = false;
    let currentValue = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      const nextChar = line[c + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentValue += '"';
          c++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    rows.push(values);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].map(h => String(h || '').trim());
  const dataRows = rows.slice(1);

  return { headers: rawHeaders, rows: dataRows };
};

/**
 * Auto-detect column mapping by comparing raw headers against aliases
 */
const detectColumnMapping = (rawHeaders) => {
  const mapping = {};
  const normalizedHeaders = rawHeaders.map(h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

  Object.entries(HEADER_ALIASES).forEach(([fieldKey, aliases]) => {
    let matchedIdx = -1;

    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = normalizedHeaders.findIndex(nh => nh === normalizedAlias || nh.includes(normalizedAlias));
      if (idx !== -1) {
        matchedIdx = idx;
        break;
      }
    }

    if (matchedIdx !== -1) {
      mapping[fieldKey] = matchedIdx;
    }
  });

  return mapping;
};

/**
 * Safe date normalizer
 */
const normalizeDate = (rawDate, defaultYear = 2026) => {
  if (!rawDate) return { valid: false, error: 'Date is required' };

  // Handle Date instance
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return { valid: false, error: 'Invalid Date object' };
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return { valid: true, date: `${y}-${m}-${d}` };
  }

  // Handle Excel Serial Number (e.g. 45582)
  if (typeof rawDate === 'number') {
    if (rawDate > 1000 && rawDate < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const dateObj = new Date(excelEpoch.getTime() + rawDate * 86400000);
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getUTCDate()).padStart(2, '0');
        return { valid: true, date: `${y}-${m}-${d}` };
      }
    }
  }

  const str = String(rawDate).trim();
  if (str.toLowerCase() === 'undated') {
    return { valid: true, date: 'Undated' };
  }

  // YYYY-MM-DD format
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      // Validate real month days (leap years, 30/31 days)
      const testDate = new Date(y, m - 1, d);
      if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
        return { valid: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
    return { valid: false, error: `Invalid calendar date: ${str}` };
  }

  // DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const testDate = new Date(y, m - 1, d);
      if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
        return { valid: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
    return { valid: false, error: `Invalid calendar date: ${str}` };
  }

  // DD/MM format (e.g. 24/08)
  const dmMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10);
    const m = parseInt(dmMatch[2], 10);
    const y = parseInt(defaultYear, 10) || 2026;

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const testDate = new Date(y, m - 1, d);
      if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
        return { valid: true, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
  }

  // Try standard Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return { valid: true, date: `${y}-${m}-${d}` };
  }

  return { valid: false, error: `Unrecognized date format: "${str}". Expected YYYY-MM-DD or DD/MM/YYYY.` };
};

/**
 * Normalizes payment method string
 */
const normalizePaymentMethod = (rawMethod) => {
  if (!rawMethod) return 'UPI';
  const val = String(rawMethod).trim().toLowerCase();

  if (val.includes('upi') || val.includes('gpay') || val.includes('phonepe') || val.includes('paytm') || val.includes('bhim')) {
    return 'UPI';
  }
  if (val.includes('cash')) {
    return 'Cash';
  }
  if (val.includes('credit')) {
    return 'Credit Card';
  }
  if (val.includes('debit')) {
    return 'Debit Card';
  }
  if (val.includes('net') || val.includes('bank') || val.includes('neft') || val.includes('rtgs') || val.includes('imps') || val.includes('online')) {
    return 'Net Banking';
  }
  if (val.includes('other')) {
    return 'Other';
  }

  const matched = ALLOWED_PAYMENT_METHODS.find(m => m.toLowerCase() === val);
  return matched || 'Other';
};

/**
 * Parses raw uploaded file buffer into raw headers and raw row values
 */
const parseUploadedFile = async (fileBuffer, originalFilename) => {
  const ext = (originalFilename || '').split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const content = fileBuffer.toString('utf8').replace(/^\uFEFF/, ''); // Strip BOM
    return parseCsv(content);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    let worksheet = workbook.getWorksheet('Expenses Template') ||
                    workbook.getWorksheet('Expenses') ||
                    workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Spreadsheet has no worksheets.');
    }

    const rawRows = [];
    let headers = [];
    let headerRowNumber = 1;

    // Scan top 5 rows to locate header row
    for (let r = 1; r <= Math.min(5, worksheet.rowCount); r++) {
      const rowVals = worksheet.getRow(r).values;
      if (!Array.isArray(rowVals)) continue;
      const joined = rowVals.map(v => String(v || '').toLowerCase()).join(' ');
      if (joined.includes('date') || joined.includes('title') || joined.includes('amount') || joined.includes('expense')) {
        headerRowNumber = r;
        // ExcelJS row.values is 1-indexed, element 0 is empty
        headers = rowVals.slice(1).map(v => {
          if (v && typeof v === 'object' && v.richText) {
            return v.richText.map(t => t.text).join('').trim();
          }
          return String(v || '').trim();
        });
        break;
      }
    }

    if (headers.length === 0) {
      // Default to row 1
      const rowVals = worksheet.getRow(1).values;
      headers = (Array.isArray(rowVals) ? rowVals.slice(1) : []).map(v => String(v || '').trim());
      headerRowNumber = 1;
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return; // Skip headers
      const vals = row.values;
      if (!Array.isArray(vals)) return;
      const rowArr = vals.slice(1).map(v => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') {
          if (v.result !== undefined) return v.result; // Formula cell evaluation
          if (v.richText) return v.richText.map(t => t.text).join('').trim();
          if (v instanceof Date) return v;
          if (v.text) return v.text;
        }
        return v;
      });

      // Skip completely empty rows
      const hasContent = rowArr.some(c => c !== '' && c !== null && c !== undefined);
      if (hasContent) {
        rawRows.push(rowArr);
      }
    });

    return { headers, rows: rawRows };
  }

  throw new Error(`Unsupported file type: .${ext}. Only .xlsx, .xls, and .csv are supported.`);
};

/**
 * Validate each parsed row against application rules & database entities
 */
const validateRows = async ({
  rawRows,
  mapping,
  currentUser,
  existingCategories = [],
  activeUsersMap = new Map(),
  existingExpenses = []
}) => {
  const preview = [];
  const errors = [];
  const validRecords = [];
  const seenFingerprints = new Set();

  let totalRows = rawRows.length;
  let validRowsCount = 0;
  let invalidRowsCount = 0;
  let duplicateRowsCount = 0;
  let totalValidAmount = 0;

  // Build existing expenses fingerprint set for existing-record duplicate detection
  const existingFingerprints = new Map();
  existingExpenses.forEach(e => {
    const normTitle = String(e.title || '').trim().toLowerCase();
    const normAmount = (parseFloat(e.amount) || 0).toFixed(2);
    const normDate = String(e.expense_date || '').trim();
    const owner = String(e.user_id || '').toLowerCase();
    const normCat = String(e.category || '').trim().toLowerCase();

    const fp = `${owner}|${normDate}|${normTitle}|${normAmount}|${normCat}`;
    existingFingerprints.set(fp, e);
  });

  const availableCatLower = existingCategories.map(c => String(c.category_name || c).trim().toLowerCase());

  for (let idx = 0; idx < rawRows.length; idx++) {
    const rowArr = rawRows[idx];
    const rowNumber = idx + 2; // Accounting for 1-based header row
    const rowErrors = [];

    // Extract mapped cell values
    const getVal = (key) => {
      const colIdx = mapping[key];
      if (colIdx === undefined || colIdx < 0 || colIdx >= rowArr.length) return '';
      const v = rowArr[colIdx];
      return v !== null && v !== undefined ? v : '';
    };

    const rawDate = getVal('expense_date');
    const rawTime = getVal('expense_time');
    let rawTitle = String(getVal('title') || '').trim();
    const rawAmount = getVal('amount');
    const rawCategory = String(getVal('category') || '').trim();
    const rawPayment = String(getVal('payment_method') || '').trim();
    const rawDesc = String(getVal('description') || '').trim();
    const rawVendor = String(getVal('vendor') || '').trim();
    const rawLocation = String(getVal('location') || '').trim();
    const rawNotes = String(getVal('notes') || '').trim();
    const rawUsername = String(getVal('username') || '').trim();

    // 1. Date Validation
    let expense_date = '';
    const dateRes = normalizeDate(rawDate);
    if (!dateRes.valid) {
      rowErrors.push({
        rowNumber,
        field: 'expense_date',
        value: String(rawDate),
        message: dateRes.error
      });
    } else {
      expense_date = dateRes.date;
    }

    // 2. Title Validation
    if (!rawTitle) {
      rowErrors.push({
        rowNumber,
        field: 'title',
        value: '',
        message: 'Expense title is required.'
      });
    } else {
      // Strip potential formula prefix characters
      if (/^[=+\-@]/.test(rawTitle)) {
        rawTitle = rawTitle.replace(/^[=+\-@]+/, '').trim();
      }
      if (rawTitle.length > 200) {
        rawTitle = rawTitle.substring(0, 200);
      }
    }

    // 3. Amount Validation
    let cleanAmount = 0;
    if (typeof rawAmount === 'number') {
      cleanAmount = rawAmount;
    } else {
      const cleanStr = String(rawAmount || '').replace(/[^\d.-]/g, '');
      cleanAmount = parseFloat(cleanStr);
    }

    if (isNaN(cleanAmount) || !isFinite(cleanAmount) || cleanAmount <= 0) {
      rowErrors.push({
        rowNumber,
        field: 'amount',
        value: String(rawAmount),
        message: 'Amount must be a positive finite number greater than 0.'
      });
    } else if (cleanAmount > 10000000) {
      rowErrors.push({
        rowNumber,
        field: 'amount',
        value: String(cleanAmount),
        message: 'Amount exceeds maximum allowable limit of ₹1,00,00,000.'
      });
    } else {
      cleanAmount = Math.round(cleanAmount * 100) / 100; // 2 decimal precision
    }

    // 4. Category Validation
    let resolvedCategory = rawCategory;
    if (!resolvedCategory) {
      // Fallback or error
      resolvedCategory = 'Miscellaneous';
    } else {
      const match = existingCategories.find(c => {
        const name = String(c.category_name || c).trim();
        return name.toLowerCase() === resolvedCategory.toLowerCase();
      });
      if (match) {
        resolvedCategory = match.category_name || match;
      }
    }

    // 5. Payment Method Validation & Normalization
    const payment_method = normalizePaymentMethod(rawPayment);

    // 6. User Account Ownership & Role Authorization
    let targetUserId = currentUser.id || currentUser._id;
    let targetUserName = currentUser.name;

    if (currentUser.role === 'admin') {
      if (rawUsername) {
        const foundUser = activeUsersMap.get(rawUsername.toLowerCase());
        if (foundUser) {
          targetUserId = foundUser._id || foundUser.id;
          targetUserName = foundUser.name;
        } else {
          rowErrors.push({
            rowNumber,
            field: 'username',
            value: rawUsername,
            message: `User '${rawUsername}' not found or inactive in the system.`
          });
        }
      }
    }

    // Time normalization (default 12:00)
    let expense_time = '12:00';
    if (rawTime) {
      const timeStr = String(rawTime).trim();
      const timeMatch = timeStr.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
      if (timeMatch) {
        expense_time = `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}`;
      }
    }

    // 7. Duplicate Detection
    let isDuplicate = false;
    let duplicateType = 'none'; // 'within_file' | 'existing_record' | 'none'
    let duplicateReason = '';

    const fingerprint = `${String(targetUserId).toLowerCase()}|${expense_date}|${rawTitle.toLowerCase()}|${cleanAmount.toFixed(2)}|${resolvedCategory.toLowerCase()}`;

    if (rowErrors.length === 0) {
      // A. Check within-file duplicate
      if (seenFingerprints.has(fingerprint)) {
        isDuplicate = true;
        duplicateType = 'within_file';
        duplicateReason = `Exact duplicate of another row within this file.`;
      } else if (existingFingerprints.has(fingerprint)) {
        // B. Check existing record duplicate in DB
        isDuplicate = true;
        duplicateType = 'existing_record';
        const matchExp = existingFingerprints.get(fingerprint);
        duplicateReason = `Matches existing expense record [${matchExp.expense_id || 'ID'}] in database.`;
      }
      seenFingerprints.add(fingerprint);
    }

    const rowStatus = rowErrors.length > 0 ? 'invalid' : (isDuplicate ? 'duplicate' : 'valid');

    if (rowStatus === 'valid') {
      validRowsCount++;
      totalValidAmount += cleanAmount;
    } else if (rowStatus === 'duplicate') {
      duplicateRowsCount++;
    } else {
      invalidRowsCount++;
      errors.push(...rowErrors);
    }

    const processedRecord = {
      rowNumber,
      expense_date,
      expense_time,
      title: rawTitle,
      amount: cleanAmount,
      category: resolvedCategory,
      payment_method,
      description: rawDesc.substring(0, 500),
      vendor: rawVendor.substring(0, 200),
      location: rawLocation.substring(0, 200),
      notes: rawNotes.substring(0, 500),
      user_id: targetUserId,
      user_name: targetUserName,
      status: rowStatus,
      isDuplicate,
      duplicateType,
      duplicateReason,
      errors: rowErrors
    };

    if (rowStatus === 'valid' || rowStatus === 'duplicate') {
      validRecords.push(processedRecord);
    }

    // Store up to 25 items for preview
    if (preview.length < 25) {
      preview.push({
        rowNumber,
        date: expense_date,
        time: expense_time,
        title: rawTitle,
        category: resolvedCategory,
        amount: cleanAmount,
        payment_method,
        vendor: rawVendor,
        user_name: targetUserName,
        status: rowStatus,
        duplicateReason,
        errorText: rowErrors.map(e => e.message).join('; ')
      });
    }
  }

  return {
    totalRows,
    validRowsCount,
    invalidRowsCount,
    duplicateRowsCount,
    totalValidAmount: Math.round(totalValidAmount * 100) / 100,
    preview,
    errors,
    validRecords
  };
};

module.exports = {
  generateExcelTemplate,
  generateCsvTemplate,
  parseUploadedFile,
  detectColumnMapping,
  validateRows,
  neutralizeFormula,
  escapeCsvField,
  normalizeDate,
  normalizePaymentMethod,
  ALLOWED_PAYMENT_METHODS,
  DEFAULT_CATEGORIES
};
