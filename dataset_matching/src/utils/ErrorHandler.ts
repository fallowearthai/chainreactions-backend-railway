import { Request, Response, NextFunction } from 'express';
import { ServiceError, DatabaseError, CacheError } from '../types/DatasetMatchTypes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message: string = 'Database connection failed') {
    super(message, 503, 'DATABASE_CONNECTION_ERROR');
    this.name = 'DatabaseConnectionError';
  }
}

export class CacheConnectionError extends AppError {
  constructor(message: string = 'Cache connection failed') {
    super(message, 503, 'CACHE_CONNECTION_ERROR');
    this.name = 'CacheConnectionError';
  }
}

export class MatchingError extends AppError {
  constructor(message: string, entity?: string) {
    super(message, 422, 'MATCHING_ERROR');
    this.name = 'MatchingError';
  }
}

export const createServiceError = (
  code: string,
  message: string,
  details?: any
): ServiceError => ({
  code,
  message,
  details,
  timestamp: new Date().toISOString()
});

export const createDatabaseError = (
  message: string,
  query?: string,
  parameters?: any
): DatabaseError => ({
  code: 'DATABASE_ERROR',
  message,
  query,
  parameters,
  timestamp: new Date().toISOString()
});

export const createCacheError = (
  message: string,
  cache_key?: string,
  operation?: 'get' | 'set' | 'delete' | 'clear'
): CacheError => ({
  code: 'CACHE_ERROR',
  message,
  cache_key,
  operation,
  timestamp: new Date().toISOString()
});

// Global error handler middleware
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.message.includes('SUPABASE') || error.message.includes('database')) {
    statusCode = 503;
    code = 'DATABASE_ERROR';
    message = 'Database service temporarily unavailable';
  } else if (error.message.includes('Redis') || error.message.includes('cache')) {
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
    (errorResponse.error as any).details = error.message;
    (errorResponse.error as any).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation helper
export const validateRequired = (value: any, fieldName: string) => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    throw new ValidationError(`${fieldName} is required`);
  }
};

export const validateArray = (value: any, fieldName: string, minLength = 0, maxLength = 1000) => {
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

export const validateString = (value: any, fieldName: string, minLength = 1, maxLength = 1000) => {
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

export const validateNumber = (value: any, fieldName: string, min = 0, max = 1) => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
};