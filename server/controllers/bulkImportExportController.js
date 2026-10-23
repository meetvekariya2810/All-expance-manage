const crypto = require('crypto');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Category = require('../models/Category');
const ImportBatch = require('../models/ImportBatch');
const ActivityLog = require('../models/ActivityLog');
const { getMongoStatus, memoryStore, saveLocalStore, syncExpenseStore } = require('../config/db');
const ExcelJS = require('exceljs');

const {
  generateExcelTemplate,
  generateCsvTemplate,
  parseUploadedFile,
  detectColumnMapping,
  validateRows,
  neutralizeFormula,
  escapeCsvField
} = require('../services/spreadsheetService');

// In-Memory cache for validated import sessions
// Key: sessionToken -> Value: { sessionToken, userId, fileHash, filename, validRecords, stats, preview, errors, expiresAt }
const importSessions = new Map();

// Periodically clean up expired sessions (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of importSessions.entries()) {
    if (session.expiresAt && session.expiresAt < now) {
      importSessions.delete(token);
    }
  }
}, 10 * 60 * 1000);

// Helper to generate unique batch ID
const generateBatchId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BATCH-${dateStr}-${randomSuffix}`;
};

// Helper to generate unique human-readable expense ID
const generateExpenseId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${dateStr}-${randomSuffix}`;
};

/**
 * 1. Download official Excel Template
 */
const getTemplateExcel = async (req, res) => {
  try {
    const buffer = await generateExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Expense_Import_Template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    console.error('Download Excel template error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate Excel template: ' + error.message });
  }
};

/**
 * 2. Download official CSV Template
 */
const getTemplateCSV = async (req, res) => {
  try {
    const csvContent = generateCsvTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Expense_Import_Template.csv"');
    return res.send(csvContent);
  } catch (error) {
    console.error('Download CSV template error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate CSV template: ' + error.message });
  }
};

/**
 * 3. Validate Uploaded Spreadsheet
 */
const validateImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No spreadsheet file uploaded. Please upload a .xlsx, .xls, or .csv file.'
      });
    }

    const originalFilename = req.file.originalname || 'import.xlsx';
    const fileBuffer = req.file.buffer;

    // Calculate file SHA-256 hash for audit tracking
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Parse raw rows and headers
    let parsedData;
    try {
      parsedData = await parseUploadedFile(fileBuffer, originalFilename);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: 'Could not parse spreadsheet: ' + parseErr.message
      });
    }

    const { headers: rawHeaders, rows: rawRows } = parsedData;

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded spreadsheet is empty or has no data rows.'
      });
    }

    if (rawRows.length > 5000) {
      return res.status(400).json({
        success: false,
        message: `File contains ${rawRows.length} rows. Maximum allowed rows per import is 5,000.`
      });
    }

    // Auto-detect or apply custom mapping
    let mapping = detectColumnMapping(rawHeaders);
    if (req.body.column_mapping) {
      try {
        const customMap = typeof req.body.column_mapping === 'string' 
          ? JSON.parse(req.body.column_mapping) 
          : req.body.column_mapping;
        mapping = { ...mapping, ...customMap };
      } catch (e) {}
    }

    // Check required fields mapping
    const requiredFields = ['expense_date', 'title', 'amount'];
    const missingFields = requiredFields.filter(f => mapping[f] === undefined || mapping[f] === null || mapping[f] < 0);

    // Fetch existing categories
    let existingCategories = [];
    if (getMongoStatus()) {
      existingCategories = await Category.find({ status: 'active' }).lean();
    } else {
      existingCategories = (memoryStore.categories || []).filter(c => c.status !== 'inactive');
    }

    // Fetch active users for admin username resolution
    const activeUsersMap = new Map();
    if (req.user.role === 'admin') {
      let usersList = [];
      if (getMongoStatus()) {
        usersList = await User.find({ status: 'active' }).select('_id id username name role').lean();
      } else {
        usersList = (memoryStore.users || []).filter(u => u.status !== 'disabled');
      }
      usersList.forEach(u => {
        if (u.username) activeUsersMap.set(u.username.toLowerCase(), u);
      });
    }

    // Fetch existing expenses for duplicate detection
    let existingExpenses = [];
    if (getMongoStatus()) {
      let expQuery = {};
      if (req.user.role !== 'admin') {
        expQuery.$or = [{ user_id: req.user.id }, { user_id: req.user.username }];
      }
      existingExpenses = await Expense.find(expQuery)
        .select('expense_id user_id title amount expense_date category payment_method vendor')
        .lean();
    } else {
      existingExpenses = (memoryStore.expenses || []).filter(e => {
        if (req.user.role !== 'admin') {
          return e.user_id === req.user.id || e.user_id === req.user.username;
        }
        return true;
      });
    }

    // Perform full row validation & duplicate analysis
    const validationResult = await validateRows({
      rawRows,
      mapping,
      currentUser: req.user,
      existingCategories,
      activeUsersMap,
      existingExpenses
    });

    // Create session token (TTL: 30 minutes)
    const sessionToken = `IMP-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    importSessions.set(sessionToken, {
      sessionToken,
      userId: req.user.id || req.user._id,
      userRole: req.user.role,
      userName: req.user.name,
      fileHash,
      filename: originalFilename,
      mapping,
      totalRows: validationResult.totalRows,
      validRowsCount: validationResult.validRowsCount,
      invalidRowsCount: validationResult.invalidRowsCount,
      duplicateRowsCount: validationResult.duplicateRowsCount,
      totalValidAmount: validationResult.totalValidAmount,
      validRecords: validationResult.validRecords,
      preview: validationResult.preview,
      errors: validationResult.errors,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'File parsed and validated successfully.',
      data: {
        sessionToken,
        filename: originalFilename,
        totalRows: validationResult.totalRows,
        validRows: validationResult.validRowsCount,
        invalidRows: validationResult.invalidRowsCount,
        duplicateRows: validationResult.duplicateRowsCount,
        totalValidAmount: validationResult.totalValidAmount,
        columnsDetected: rawHeaders,
        mapping,
        missingRequiredFields: missingFields,
        preview: validationResult.preview,
        errors: validationResult.errors.slice(0, 100) // Top 100 errors for display
      }
    });
  } catch (error) {
    console.error('Validate import error:', error);
    return res.status(500).json({ success: false, message: 'Server error during validation: ' + error.message });
  }
};

/**
 * 4. Confirm and Execute Import
 */
const confirmImport = async (req, res) => {
  try {
    const { sessionToken, skipDuplicates = true, targetUser = null } = req.body;

    if (!sessionToken) {
      return res.status(400).json({ success: false, message: 'Missing sessionToken for import confirmation.' });
    }

    const session = importSessions.get(sessionToken);
    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Import session expired or not found. Please upload and re-validate your file.'
      });
    }

    // Verify session user ownership
    if (session.userId !== (req.user.id || req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized import session.' });
    }

    // Idempotency: immediately consume session so it cannot be double-imported
    importSessions.delete(sessionToken);

    // Filter records to import based on user duplicate policy
    let recordsToImport = session.validRecords.filter(r => {
      if (r.status === 'invalid') return false;
      if (skipDuplicates && (r.status === 'duplicate' || r.isDuplicate)) return false;
      return true;
    });

    if (recordsToImport.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records to import (all records were invalid or skipped as duplicates).'
      });
    }

    const batchId = generateBatchId();
    let importedCount = 0;
    let duplicateSkippedCount = session.duplicateRowsCount;
    let rejectedCount = session.invalidRowsCount;
    let totalImportedAmount = 0;
    const finalInsertedExpenseIds = [];

    // Resolve target account if admin supplied an override
    let adminOverrideUserId = null;
    let adminOverrideUserName = null;
    if (req.user.role === 'admin' && targetUser && targetUser !== 'auto') {
      let foundUser = null;
      if (getMongoStatus()) {
        foundUser = await User.findOne({
          $or: [{ _id: targetUser }, { id: targetUser }, { username: targetUser.toLowerCase() }]
        }).lean();
      } else {
        foundUser = (memoryStore.users || []).find(u =>
          u._id === targetUser || u.id === targetUser || u.username === targetUser.toLowerCase()
        );
      }
      if (foundUser) {
        adminOverrideUserId = foundUser._id || foundUser.id;
        adminOverrideUserName = foundUser.name;
      }
    }

    const now = new Date();
    const preparedExpenseDocs = [];

    for (const rec of recordsToImport) {
      const expenseId = generateExpenseId();
      const uniqueDocId = 'exp_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000);

      let finalUserId = rec.user_id;
      let finalUserName = rec.user_name;

      // Non-admin can NEVER assign to another account
      if (req.user.role !== 'admin') {
        finalUserId = req.user.id || req.user._id;
        finalUserName = req.user.name;
      } else if (adminOverrideUserId) {
        finalUserId = adminOverrideUserId;
        finalUserName = adminOverrideUserName;
      }

      const combinedNotes = rec.notes ? `${rec.notes} [Batch: ${batchId}]` : `[Batch: ${batchId}]`;

      const expenseDoc = {
        _id: uniqueDocId,
        id: uniqueDocId,
        expense_id: expenseId,
        user_id: finalUserId,
        user_name: finalUserName,
        created_by: req.user.name,
        title: rec.title,
        description: rec.description || '',
        category: rec.category,
        amount: rec.amount,
        payment_method: rec.payment_method,
        vendor: rec.vendor || '',
        location: rec.location || '',
        receipt: '',
        notes: combinedNotes,
        expense_date: rec.expense_date,
        expense_time: rec.expense_time || '12:00',
        created_at: rec.expense_date !== 'Undated' ? new Date(`${rec.expense_date}T12:00:00.000Z`) : now,
        updated_at: now
      };

      preparedExpenseDocs.push(expenseDoc);
      totalImportedAmount += rec.amount;
    }

    // Persist to storage (MongoDB Atlas or JSON/Memory fallback)
    if (getMongoStatus()) {
      // Chunked insert in bounded batches of 50
      const chunkSize = 50;
      for (let i = 0; i < preparedExpenseDocs.length; i += chunkSize) {
        const chunk = preparedExpenseDocs.slice(i, i + chunkSize);
        await Expense.insertMany(chunk, { ordered: false });
        chunk.forEach(doc => {
          syncExpenseStore('create', doc);
          finalInsertedExpenseIds.push(doc.expense_id);
        });
      }
      importedCount = preparedExpenseDocs.length;
    } else {
      // JSON / Memory store fallback
      if (!Array.isArray(memoryStore.expenses)) memoryStore.expenses = [];
      preparedExpenseDocs.forEach(doc => {
        memoryStore.expenses.unshift(doc);
        finalInsertedExpenseIds.push(doc.expense_id);
      });
      saveLocalStore();
      importedCount = preparedExpenseDocs.length;
    }

    totalImportedAmount = Math.round(totalImportedAmount * 100) / 100;

    // Record Batch History Entry
    const batchData = {
      _id: 'batch_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      batch_id: batchId,
      initiated_by: req.user.id || req.user._id,
      initiated_by_name: req.user.name,
      target_user_id: adminOverrideUserId || (req.user.role === 'admin' ? 'Multiple/Dynamic' : (req.user.id || req.user._id)),
      target_user_name: adminOverrideUserName || (req.user.role === 'admin' ? 'Multiple / Mapped' : req.user.name),
      original_filename: session.filename,
      file_hash: session.fileHash,
      total_rows: session.totalRows,
      valid_rows: session.validRowsCount,
      imported_rows: importedCount,
      rejected_rows: rejectedCount,
      duplicate_rows: duplicateSkippedCount,
      total_imported_amount: totalImportedAmount,
      status: rejectedCount > 0 ? 'partial' : 'completed',
      started_at: new Date(session.createdAt),
      completed_at: new Date(),
      error_summary: `${importedCount} rows imported, ${duplicateSkippedCount} duplicates skipped, ${rejectedCount} errors rejected.`,
      errors: session.errors || [],
      preview: session.preview || [],
      idempotency_key: sessionToken,
      created_at: new Date()
    };

    if (getMongoStatus()) {
      try {
        await ImportBatch.create(batchData);
      } catch (batchErr) {
        console.warn('Batch record creation notice:', batchErr.message);
      }
    } else {
      if (!Array.isArray(memoryStore.importBatches)) memoryStore.importBatches = [];
      memoryStore.importBatches.unshift(batchData);
      saveLocalStore();
    }

    // Create Audit Activity Log
    try {
      const activityData = {
        user_id: req.user.id || req.user._id,
        user_name: req.user.name,
        action: 'Bulk Expense Import',
        amount: totalImportedAmount,
        title: `Batch ${batchId}`,
        details: `${req.user.name} imported ${importedCount} expense(s) totaling ₹${totalImportedAmount.toLocaleString('en-IN')} from ${session.filename} (Batch ID: ${batchId})`,
        type: 'create',
        timestamp: new Date()
      };

      if (getMongoStatus()) {
        await ActivityLog.create(activityData).catch(() => {});
      } else {
        if (!Array.isArray(memoryStore.activityLogs)) memoryStore.activityLogs = [];
        memoryStore.activityLogs.unshift(activityData);
        saveLocalStore();
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Import completed successfully. ${importedCount} expense record(s) are now available in My Expense History.`,
      data: {
        batchId,
        totalRows: session.totalRows,
        importedRows: importedCount,
        skippedDuplicateRows: duplicateSkippedCount,
        rejectedRows: rejectedCount,
        totalImportedAmount,
        status: rejectedCount > 0 ? 'partial' : 'completed',
        insertedExpenseIds: finalInsertedExpenseIds.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Confirm import error:', error);
    return res.status(500).json({ success: false, message: 'Error processing import: ' + error.message });
  }
};

/**
 * 5. Get Import History
 */
const getImportHistory = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);

    let query = {};
    if (role !== 'admin') {
      query.initiated_by = userId;
    }

    let history = [];
    let totalCount = 0;

    if (getMongoStatus()) {
      totalCount = await ImportBatch.countDocuments(query);
      history = await ImportBatch.find(query)
        .select('-errors') // Exclude full error logs from list view for efficiency
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    } else {
      let list = [...(memoryStore.importBatches || [])];
      if (role !== 'admin') {
        list = list.filter(b => b.initiated_by === userId);
      }
      totalCount = list.length;
      history = list.slice((page - 1) * limit, page * limit);
    }

    return res.status(200).json({
      success: true,
      data: history,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit) || 1
      }
    });
  } catch (error) {
    console.error('Get import history error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve import history.' });
  }
};

/**
 * 6. Get Single Batch Details with Full Error Log
 */
const getImportBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { role, id: userId } = req.user;

    let batch = null;
    if (getMongoStatus()) {
      batch = await ImportBatch.findOne({
        $or: [{ batch_id: batchId }, { _id: batchId }, { id: batchId }]
      }).lean();
    } else {
      batch = (memoryStore.importBatches || []).find(b =>
        b.batch_id === batchId || b._id === batchId || b.id === batchId
      );
    }

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Import batch record not found.' });
    }

    if (role !== 'admin' && batch.initiated_by !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied to this import batch.' });
    }

    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    console.error('Get batch details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load batch details.' });
  }
};

/**
 * Filter helper for exports (enforcing role permissions)
 */
const getFilteredExpensesForExport = async (req) => {
  const { role, id: userId, username } = req.user;
  const { search, category, payment_method, person, startDate, endDate, minAmount, maxAmount } = req.query;

  let filter = {};

  // Role check: non-admin can ONLY export their own expenses
  if (role !== 'admin') {
    filter.$or = [{ user_id: userId }, { user_id: username }];
  } else if (person && person !== 'all') {
    if (getMongoStatus()) {
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        filter.$or = [{ user_id: targetUser._id }, { user_id: targetUser.username }];
      } else {
        filter.user_id = person;
      }
    } else {
      filter.user_id = person;
    }
  }

  if (category && category !== 'all') filter.category = category;
  if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;

  if (startDate && endDate) {
    filter.expense_date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.expense_date = { $gte: startDate };
  } else if (endDate) {
    filter.expense_date = { $lte: endDate };
  }

  const min = parseFloat(minAmount);
  const max = parseFloat(maxAmount);
  if (!isNaN(min) && !isNaN(max)) {
    filter.amount = { $gte: min, $lte: max };
  } else if (!isNaN(min)) {
    filter.amount = { $gte: min };
  } else if (!isNaN(max)) {
    filter.amount = { $lte: max };
  }

  if (getMongoStatus()) {
    let query = Expense.find(filter);
    if (search && search.trim()) {
      const q = search.trim();
      const searchRegex = { $regex: q, $options: 'i' };
      query = query.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { vendor: searchRegex },
          { location: searchRegex },
          { expense_id: searchRegex },
          { category: searchRegex },
          { notes: searchRegex },
          { user_name: searchRegex }
        ]
      });
    }
    return await query.sort({ expense_date: -1, created_at: -1 }).lean();
  } else {
    let list = [...(memoryStore.expenses || [])];
    if (role !== 'admin') {
      list = list.filter(e => e.user_id === userId || e.user_id === username);
    } else if (person && person !== 'all') {
      list = list.filter(e => e.user_id === person);
    }
    if (category && category !== 'all') list = list.filter(e => e.category === category);
    if (payment_method && payment_method !== 'all') list = list.filter(e => e.payment_method === payment_method);
    if (startDate) list = list.filter(e => e.expense_date >= startDate);
    if (endDate) list = list.filter(e => e.expense_date <= endDate);
    if (!isNaN(min)) list = list.filter(e => parseFloat(e.amount) >= min);
    if (!isNaN(max)) list = list.filter(e => parseFloat(e.amount) <= max);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.vendor && e.vendor.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.expense_id && e.expense_id.toLowerCase().includes(q)) ||
        (e.user_name && e.user_name.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
    return list;
  }
};

/**
 * 7. Export Expenses to Formatted Excel (.xlsx)
 */
const exportExpensesExcel = async (req, res) => {
  try {
    const expenses = await getFilteredExpensesForExport(req);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartExpense';
    workbook.created = new Date();

    // Sheet 1: Expenses
    const worksheet = workbook.addWorksheet('Expense Records', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Expense ID', key: 'expense_id', width: 22 },
      { header: 'Date', key: 'expense_date', width: 14 },
      { header: 'Time', key: 'expense_time', width: 10 },
      { header: 'Title', key: 'title', width: 28 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount (INR)', key: 'amount', width: 16 },
      { header: 'Payment Method', key: 'payment_method', width: 16 },
      { header: 'Member Name', key: 'user_name', width: 18 },
      { header: 'Vendor', key: 'vendor', width: 22 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Notes', key: 'notes', width: 26 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 26;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Blue-800
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let totalAmount = 0;
    const categoryTotals = {};

    expenses.forEach((exp, idx) => {
      const amt = parseFloat(exp.amount) || 0;
      totalAmount += amt;

      const cat = exp.category || 'Miscellaneous';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

      const r = worksheet.addRow({
        expense_id: exp.expense_id || exp.id || '-',
        expense_date: exp.expense_date || '-',
        expense_time: exp.expense_time || '12:00',
        title: exp.title || '-',
        category: exp.category || 'Other',
        amount: amt,
        payment_method: exp.payment_method || 'UPI',
        user_name: exp.user_name || 'Member',
        vendor: exp.vendor || '',
        location: exp.location || '',
        description: exp.description || '',
        notes: exp.notes || ''
      });

      r.height = 20;
      r.getCell('amount').numFmt = '#,##0.00';
      r.getCell('expense_date').alignment = { horizontal: 'center' };
      r.getCell('expense_time').alignment = { horizontal: 'center' };
      r.getCell('payment_method').alignment = { horizontal: 'center' };

      if (idx % 2 === 1) {
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });

    // Sheet 2: Summary Dashboard
    const summarySheet = workbook.addWorksheet('Summary & Analytics');
    summarySheet.columns = [
      { header: 'Metric / Category', key: 'item', width: 30 },
      { header: 'Value / Amount (INR)', key: 'val', width: 25 },
      { header: 'Share (%)', key: 'share', width: 16 }
    ];

    const sumHeader = summarySheet.getRow(1);
    sumHeader.height = 26;
    sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Teal-700
    sumHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    summarySheet.addRow({ item: 'Total Expense Records', val: expenses.length, share: '-' });
    const totRow = summarySheet.addRow({ item: 'Total Expenditure', val: totalAmount, share: '100.00%' });
    totRow.getCell('val').numFmt = '#,##0.00';
    totRow.font = { bold: true };

    summarySheet.addRow({});
    const catHeader = summarySheet.addRow({ item: 'CATEGORY BREAKDOWN', val: '', share: '' });
    catHeader.font = { bold: true };

    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, sum]) => {
        const share = totalAmount > 0 ? ((sum / totalAmount) * 100).toFixed(2) + '%' : '0%';
        const cr = summarySheet.addRow({ item: cat, val: sum, share });
        cr.getCell('val').numFmt = '#,##0.00';
      });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Expense_Records_${timestamp}.xlsx"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Export expenses Excel error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate Excel export: ' + error.message });
  }
};

/**
 * 8. Export Expenses to CSV with Formula Injection Neutralization
 */
const exportExpensesCSV = async (req, res) => {
  try {
    const expenses = await getFilteredExpensesForExport(req);

    const headers = [
      'Expense ID',
      'Date',
      'Time',
      'Title',
      'Category',
      'Amount (INR)',
      'Payment Method',
      'Member',
      'Vendor',
      'Location',
      'Description',
      'Notes'
    ];

    let csvContent = headers.join(',') + '\r\n';

    expenses.forEach(exp => {
      const row = [
        escapeCsvField(exp.expense_id || exp.id),
        escapeCsvField(exp.expense_date),
        escapeCsvField(exp.expense_time || '12:00'),
        escapeCsvField(exp.title),
        escapeCsvField(exp.category),
        (parseFloat(exp.amount) || 0).toFixed(2),
        escapeCsvField(exp.payment_method),
        escapeCsvField(exp.user_name),
        escapeCsvField(exp.vendor),
        escapeCsvField(exp.location),
        escapeCsvField(exp.description),
        escapeCsvField(exp.notes)
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Expense_Records_${timestamp}.csv"`);
    return res.send(csvContent);
  } catch (error) {
    console.error('Export expenses CSV error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate CSV export: ' + error.message });
  }
};

module.exports = {
  getTemplateExcel,
  getTemplateCSV,
  validateImport,
  confirmImport,
  getImportHistory,
  getImportBatchDetails,
  exportExpensesExcel,
  exportExpensesCSV
};
