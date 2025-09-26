import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadPath = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['csv', 'xml', 'json', 'js'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Parse file size from environment variable (e.g., "50MB")
const parseFileSize = (sizeStr: string): number => {
  const size = sizeStr.toUpperCase();
  const numericValue = parseInt(size);

  if (size.includes('KB')) {
    return numericValue * 1024;
  } else if (size.includes('MB')) {
    return numericValue * 1024 * 1024;
  } else if (size.includes('GB')) {
    return numericValue * 1024 * 1024 * 1024;
  } else {
    return numericValue; // Assume bytes
  }
};

const maxFileSize = parseFileSize(process.env.MAX_FILE_SIZE || '50MB');

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1 // Only allow single file upload
  }
});

// Error handling middleware for multer
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File size exceeds limit of ${process.env.MAX_FILE_SIZE || '50MB'}`
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Only one file can be uploaded at a time'
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field'
      });
    }
  }

  if (error.message) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
};