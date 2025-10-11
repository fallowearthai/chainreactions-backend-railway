"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.validateFile = exports.validateExecutionId = exports.validateDate = exports.validateArray = exports.validateString = exports.validateRequired = exports.asyncHandler = void 0;
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
// Async handler wrapper to catch errors
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Validation helper functions
const validateRequired = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} is required`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateRequired = validateRequired;
const validateString = (value, fieldName, minLength, maxLength) => {
    if (typeof value !== 'string') {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be a string`, 'VALIDATION_ERROR', 400);
    }
    if (minLength !== undefined && value.length < minLength) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be at least ${minLength} characters long`, 'VALIDATION_ERROR', 400);
    }
    if (maxLength !== undefined && value.length > maxLength) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be no more than ${maxLength} characters long`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateString = validateString;
const validateArray = (value, fieldName, minLength, maxLength) => {
    if (!Array.isArray(value)) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be an array`, 'VALIDATION_ERROR', 400);
    }
    if (minLength !== undefined && value.length < minLength) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must contain at least ${minLength} items`, 'VALIDATION_ERROR', 400);
    }
    if (maxLength !== undefined && value.length > maxLength) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must contain no more than ${maxLength} items`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateArray = validateArray;
const validateDate = (value, fieldName) => {
    if (typeof value !== 'string') {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be a string in YYYY-MM-DD format`, 'VALIDATION_ERROR', 400);
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be in YYYY-MM-DD format`, 'VALIDATION_ERROR', 400);
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} is not a valid date`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateDate = validateDate;
const validateExecutionId = (value, fieldName) => {
    (0, exports.validateRequired)(value, fieldName);
    (0, exports.validateString)(value, fieldName);
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`${fieldName} must be a valid UUID`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateExecutionId = validateExecutionId;
// File validation
const validateFile = (file, allowedExtensions) => {
    if (!file) {
        throw new DatasetSearchTypes_1.DatasetSearchError('File is required', 'VALIDATION_ERROR', 400);
    }
    const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`File type not supported. Allowed extensions: ${allowedExtensions.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    // Check file size (from environment variable)
    const maxSize = process.env.MAX_FILE_SIZE || '10MB';
    const maxSizeBytes = parseSize(maxSize);
    if (file.size > maxSizeBytes) {
        throw new DatasetSearchTypes_1.DatasetSearchError(`File size exceeds limit of ${maxSize}`, 'VALIDATION_ERROR', 400);
    }
};
exports.validateFile = validateFile;
// Helper function to parse size strings like "10MB"
const parseSize = (sizeString) => {
    const units = {
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
const errorHandler = (err, req, res, next) => {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    // Handle DatasetSearchError
    if (err instanceof DatasetSearchTypes_1.DatasetSearchError) {
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
exports.errorHandler = errorHandler;
// 404 handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND'
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=ErrorHandler.js.map