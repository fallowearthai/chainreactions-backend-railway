"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNumber = exports.validateString = exports.validateArray = exports.validateRequired = exports.asyncHandler = exports.globalErrorHandler = exports.createCacheError = exports.createDatabaseError = exports.createServiceError = exports.MatchingError = exports.CacheConnectionError = exports.DatabaseConnectionError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode, code, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class DatabaseConnectionError extends AppError {
    constructor(message = 'Database connection failed') {
        super(message, 503, 'DATABASE_CONNECTION_ERROR');
        this.name = 'DatabaseConnectionError';
    }
}
exports.DatabaseConnectionError = DatabaseConnectionError;
class CacheConnectionError extends AppError {
    constructor(message = 'Cache connection failed') {
        super(message, 503, 'CACHE_CONNECTION_ERROR');
        this.name = 'CacheConnectionError';
    }
}
exports.CacheConnectionError = CacheConnectionError;
class MatchingError extends AppError {
    constructor(message, entity) {
        super(message, 422, 'MATCHING_ERROR');
        this.name = 'MatchingError';
    }
}
exports.MatchingError = MatchingError;
const createServiceError = (code, message, details) => ({
    code,
    message,
    details,
    timestamp: new Date().toISOString()
});
exports.createServiceError = createServiceError;
const createDatabaseError = (message, query, parameters) => ({
    code: 'DATABASE_ERROR',
    message,
    query,
    parameters,
    timestamp: new Date().toISOString()
});
exports.createDatabaseError = createDatabaseError;
const createCacheError = (message, cache_key, operation) => ({
    code: 'CACHE_ERROR',
    message,
    cache_key,
    operation,
    timestamp: new Date().toISOString()
});
exports.createCacheError = createCacheError;
// Global error handler middleware
const globalErrorHandler = (error, req, res, next) => {
    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    // Log the error for debugging
    console.error('Error occurred:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        code = error.code;
        message = error.message;
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = error.message;
    }
    else if (error.message.includes('SUPABASE') || error.message.includes('database')) {
        statusCode = 503;
        code = 'DATABASE_ERROR';
        message = 'Database service temporarily unavailable';
    }
    else if (error.message.includes('Redis') || error.message.includes('cache')) {
        statusCode = 503;
        code = 'CACHE_ERROR';
        message = 'Cache service temporarily unavailable';
    }
    const errorResponse = {
        success: false,
        error: {
            code,
            message,
            timestamp: new Date().toISOString()
        }
    };
    // Include error details in development mode
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.details = error.message;
        errorResponse.error.stack = error.stack;
    }
    res.status(statusCode).json(errorResponse);
};
exports.globalErrorHandler = globalErrorHandler;
// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Validation helper
const validateRequired = (value, fieldName) => {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        throw new ValidationError(`${fieldName} is required`);
    }
};
exports.validateRequired = validateRequired;
const validateArray = (value, fieldName, minLength = 0, maxLength = 1000) => {
    if (!Array.isArray(value)) {
        throw new ValidationError(`${fieldName} must be an array`);
    }
    if (value.length < minLength) {
        throw new ValidationError(`${fieldName} must contain at least ${minLength} items`);
    }
    if (value.length > maxLength) {
        throw new ValidationError(`${fieldName} cannot contain more than ${maxLength} items`);
    }
};
exports.validateArray = validateArray;
const validateString = (value, fieldName, minLength = 1, maxLength = 1000) => {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`);
    }
    if (value.length < minLength) {
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
    }
    if (value.length > maxLength) {
        throw new ValidationError(`${fieldName} cannot be longer than ${maxLength} characters`);
    }
};
exports.validateString = validateString;
const validateNumber = (value, fieldName, min = 0, max = 1) => {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${fieldName} must be a valid number`);
    }
    if (value < min || value > max) {
        throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
    }
};
exports.validateNumber = validateNumber;
//# sourceMappingURL=ErrorHandler.js.map