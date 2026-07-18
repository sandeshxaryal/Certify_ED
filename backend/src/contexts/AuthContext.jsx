// src/middlewares/fileUpload.middleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `cert-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Memory storage for direct buffer access
const memoryStorage = multer.memoryStorage();

// `file.mimetype` here is whatever Content-Type header the client sent — it's
// just a string the uploader chose and is trivially spoofable (rename a .exe
// to foo.pdf, set the header, done). This fileFilter is only a cheap early
// reject; the real check is validatePdfMagicBytes below, which runs after
// multer has the actual bytes and looks at the file's real signature.
const mimeFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Real PDF files start with the byte sequence for "%PDF-" (25 50 44 46 2D).
// This is the actual file-format signature, not something the client sends,
// so it can't be spoofed via headers or a renamed extension.
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

function bufferLooksLikePdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= PDF_MAGIC.length &&
    buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

/**
 * Runs after multer. Verifies the uploaded file's real magic bytes, not the
 * client-supplied mimetype. For memory-storage uploads it checks req.file.buffer
 * directly; for disk-storage uploads it reads the first few bytes back off disk
 * (and deletes the file if the check fails, so a spoofed upload doesn't linger).
 */
export const validatePdfMagicBytes = (req, res, next) => {
  const file = req.file;
  if (!file) return next(); // let downstream "file required" checks handle this

  if (file.buffer) {
    if (!bufferLooksLikePdf(file.buffer)) {
      return res.status(400).json({ success: false, message: 'File is not a valid PDF' });
    }
    return next();
  }

  if (file.path) {
    const fd = fs.openSync(file.path, 'r');
    const head = Buffer.alloc(PDF_MAGIC.length);
    fs.readSync(fd, head, 0, PDF_MAGIC.length, 0);
    fs.closeSync(fd);

    if (!bufferLooksLikePdf(head)) {
      fs.unlink(file.path, () => {}); // best-effort cleanup, don't block the error response on it
      return res.status(400).json({ success: false, message: 'File is not a valid PDF' });
    }
    return next();
  }

  return next();
};

// Disk storage for file system storage
export const pdfUpload = multer({
  storage: storage,
  fileFilter: mimeFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Memory storage version for direct buffer access
export const pdfUploadMemory = multer({
  storage: memoryStorage,
  fileFilter: mimeFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});