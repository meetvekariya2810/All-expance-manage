const multer = require('multer');
const path = require('path');

// Use memory storage for Excel files so they can be parsed directly from buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls', '.csv'];
  const isExcelMime = 
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'application/octet-stream';

  if (allowedExts.includes(ext) || isExcelMime) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
    err.status = 400;
    cb(err, false);
  }
};

const excelUpload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: fileFilter
});

module.exports = excelUpload;
