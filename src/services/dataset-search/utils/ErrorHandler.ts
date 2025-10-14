import { Request, Response, NextFunction } from 'express';
import { DatasetSearchError } from '../types/DatasetSearchTypes';

export interface ValidationError {
  field: string;
  message: string;
}

// Async handler wrapper to catch errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation helper functions
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new DatasetSearchError(`${fieldName} is required`, 'VALIDATION_ERROR', 400);
  }
};

export const validateString = (value: any, fieldName: string, minLength?: number, maxLength?: number): void => {
  if (typeof value !== 'string') {
    throw new DatasetSearchError(`${fieldName} must be a string`, 'VALIDATION_ERROR', 400);
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new DatasetSearchError(`${fieldName} must be at least ${minLength} characters long`, 'VALIDATION_ERROR', 400);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new DatasetSearchError(`${fieldName} must be no more than ${maxLength} characters long`, 'VALIDATION_ERROR', 400);
  }
};

export const validateArray = (value: any, fieldName: string, minLength?: number, maxLength?: number): void => {
  if (!Array.isArray(value)) {
    throw new DatasetSearchError(`${fieldName} must be an array`, 'VALIDATION_ERROR', 400);
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new DatasetSearchError(`${fieldName} must contain at least ${minLength} items`, 'VALIDATION_ERROR', 400);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new DatasetSearchError(`${fieldName} must contain no more than ${maxLength} items`, 'VALIDATION_ERROR', 400);
  }
};

export const validateDate = (value: any, fieldName: string): void => {
  if (typeof value !== 'string') {
    throw new DatasetSearchError(`${fieldName} must be a string in YYYY-MM-DD format`, 'VALIDATION_ERROR', 400);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new DatasetSearchError(`${fieldName} must be in YYYY-MM-DD format`, 'VALIDATION_ERROR', 400);
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new DatasetSearchError(`${fieldName} is not a valid date`, 'VALIDATION_ERROR', 400);
  }
};

export const validateExecutionId = (value: any, fieldName: string): void => {
  validateRequired(value, fieldName);
  validateString(value, fieldName);

  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new DatasetSearchError(`${fieldName} must be a valid UUID`, 'VALIDATION_ERROR', 400);
  }
};

// File validation
export const validateFile = (file: Express.Multer.File, allowedExtensions: string[]): void => {
  if (!file) {
    throw new DatasetSearchError('File is required', 'VALIDATION_ERROR', 400);
  }

  const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    throw new DatasetSearchError(
      `File type not supported. Allowed extensions: ${allowedExtensions.join(', ')}`,
      'VALIDATION_ERROR',
      400
    );
  }

  // Check file size (from environment variable)
  const maxSize = process.env.MAX_FILE_SIZE || '10MB';
  const maxSizeBytes = parseSize(maxSize);
  if (file.size > maxSizeBytes) {
    throw new DatasetSearchError(
      `File size exceeds limit of ${maxSize}`,
      'VALIDATION_ERROR',
      400
    );
  }
};

// Helper function to parse size strings like "10MB"
const parseSize = (sizeString: string): number => {
  const units: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };

  const match = sizeString.match(/^(\d+)(B|KB|MB|GB)$/i);
  if (!match) {
    return 10 * 1024 * 1024; // Default to 10MB
  }

  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase();

  return value * units[unit];
};

// Central error handler middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Handle DatasetSearchError
  if (err instanceof DatasetSearchError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
    return;
  }

  // Handle Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE'
    });
    return;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({
      success: false,
      error: 'Unexpected file field',
      code: 'UNEXPECTED_FILE'
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
    return;
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error occurred',
    code: 'INTERNAL_ERROR'
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND'
  });
};