/**
 * Standardized error types for all ChainReactions microservices.
 *
 * These error classes provide consistent error handling with appropriate
 * HTTP status codes and structured error information.
 *
 * Usage:
 * ```typescript
 * throw new ValidationError('Email is required');
 * throw new ExternalApiError('Gemini', 'Rate limit exceeded');
 * throw new ServiceError(409, 'CONFLICT', 'User already exists');
 * ```
 */

/**
 * Base service error class
 */
export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }
}

/**
 * Validation error (400 Bad Request)
 */
export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error (401 Unauthorized)
 */
export class AuthenticationError extends ServiceError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(401, 'AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403 Forbidden)
 */
export class AuthorizationError extends ServiceError {
  constructor(message: string = 'Access denied', details?: any) {
    super(403, 'AUTHORIZATION_ERROR', message, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error (404 Not Found)
 */
export class NotFoundError extends ServiceError {
  constructor(
    public resource: string,
    public identifier?: string,
    details?: any
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(404, 'NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error (409 Conflict)
 */
export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429 Too Many Requests)
 */
export class RateLimitError extends ServiceError {
  constructor(retryAfter?: number, details?: any) {
    const message = retryAfter
      ? `Rate limit exceeded. Try again in ${retryAfter} seconds`
      : 'Rate limit exceeded';

    super(429, 'RATE_LIMIT_EXCEEDED', message, { retryAfter, ...details });
    this.name = 'RateLimitError';
  }
}

/**
 * External API error (502 Bad Gateway)
 */
export class ExternalApiError extends ServiceError {
  constructor(
    public service: string,
    message: string,
    public statusCode?: number,
    details?: any
  ) {
    const fullMessage = `${service} API error: ${message}`;
    super(502, 'EXTERNAL_API_ERROR', fullMessage, { service, statusCode, ...details });
    this.name = 'ExternalApiError';
  }
}

/**
 * Service unavailable error (503 Service Unavailable)
 */
export class ServiceUnavailableError extends ServiceError {
  constructor(service: string, message?: string, details?: any) {
    super(503, 'SERVICE_UNAVAILABLE', message || `${service} is currently unavailable`, details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Timeout error (408 Request Timeout or 504 Gateway Timeout)
 */
export class TimeoutError extends ServiceError {
  constructor(
    operation: string,
    public timeoutMs: number,
    details?: any
  ) {
    super(408, 'TIMEOUT_ERROR', `${operation} timed out after ${timeoutMs}ms`, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Configuration error (500 Internal Server Error)
 */
export class ConfigurationError extends ServiceError {
  constructor(configKey: string, message?: string, details?: any) {
    super(500, 'CONFIGURATION_ERROR', message || `Invalid configuration: ${configKey}`, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Database error (500 Internal Server Error)
 */
export class DatabaseError extends ServiceError {
  constructor(operation: string, message?: string, details?: any) {
    super(500, 'DATABASE_ERROR', message || `Database operation failed: ${operation}`, details);
    this.name = 'DatabaseError';
  }
}

/**
 * File processing error (400 Bad Request or 500 Internal Server Error)
 */
export class FileProcessingError extends ServiceError {
  constructor(
    operation: string,
    message: string,
    public filename?: string,
    details?: any
  ) {
    super(400, 'FILE_PROCESSING_ERROR', `File processing failed: ${message}`, { operation, filename, ...details });
    this.name = 'FileProcessingError';
  }
}

/**
 * Business logic error (422 Unprocessable Entity)
 */
export class BusinessLogicError extends ServiceError {
  constructor(rule: string, message: string, details?: any) {
    super(422, 'BUSINESS_LOGIC_ERROR', `Business rule '${rule}' violated: ${message}`, details);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Cache error (500 Internal Server Error)
 */
export class CacheError extends ServiceError {
  constructor(operation: string, message?: string, details?: any) {
    super(500, 'CACHE_ERROR', message || `Cache operation failed: ${operation}`, details);
    this.name = 'CacheError';
  }
}

/**
 * Quota exceeded error (429 Too Many Requests)
 */
export class QuotaExceededError extends ServiceError {
  constructor(
    resource: string,
    limit: number,
    current: number,
    details?: any
  ) {
    super(429, 'QUOTA_EXCEEDED', `Quota exceeded for ${resource}. Limit: ${limit}, Current: ${current}`, {
      resource,
      limit,
      current,
      ...details
    });
    this.name = 'QuotaExceededError';
  }
}

/**
 * Maintenance mode error (503 Service Unavailable)
 */
export class MaintenanceModeError extends ServiceError {
  constructor(message: string = 'Service is under maintenance', details?: any) {
    super(503, 'MAINTENANCE_MODE', message, details);
    this.name = 'MaintenanceModeError';
  }
}

/**
 * Utility function to create appropriate error from external API response
 */
export function createExternalApiError(
  service: string,
  statusCode: number,
  responseBody: any,
  defaultMessage?: string
): ExternalApiError {
  let message = defaultMessage || `HTTP ${statusCode}`;

  try {
    if (typeof responseBody === 'string') {
      message = responseBody;
    } else if (responseBody?.error) {
      message = responseBody.error;
    } else if (responseBody?.message) {
      message = responseBody.message;
    } else if (responseBody?.detail) {
      message = responseBody.detail;
    }
  } catch (error) {
    // Fallback to default message if parsing fails
    message = defaultMessage || `HTTP ${statusCode} error`;
  }

  return new ExternalApiError(service, message, statusCode, responseBody);
}

/**
 * Utility function to wrap unknown errors in ServiceError
 */
export function wrapUnknownError(error: unknown, defaultMessage: string = 'Unknown error'): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new ServiceError(500, 'INTERNAL_ERROR', error.message, {
      originalError: error.name,
      stack: error.stack
    });
  }

  return new ServiceError(500, 'UNKNOWN_ERROR', defaultMessage, { originalError: error });
}