import { Request } from 'express';
import { APIResponse, ErrorResponse, PaginatedResponse, PaginationInfo } from '../types/CommonTypes';

/**
 * Standardized response formatter for all ChainReactions microservices.
 *
 * This utility eliminates code duplication across services by providing
 * consistent response formats for success and error cases.
 *
 * Usage:
 * ```typescript
 * // Success response
 * res.json(ResponseFormatter.success(data, "Operation completed"));
 *
 * // Error response
 * res.status(400).json(ResponseFormatter.error("Validation failed", details));
 *
 * // Paginated response
 * res.json(ResponseFormatter.paginated(items, pagination));
 * ```
 */
export class ResponseFormatter {

  /**
   * Format a successful API response
   */
  static success<T>(data: T, message: string = 'Operation successful'): APIResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format an error response
   */
  static error(
    error: string,
    details?: string,
    code?: string,
    path?: string
  ): ErrorResponse {
    return {
      success: false,
      error,
      details: details || 'Unknown error',
      code,
      path,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format an error response with request path from Express request
   */
  static errorFromRequest(
    req: Request,
    error: string,
    details?: string,
    code?: string
  ): ErrorResponse {
    return this.error(error, details, code, req.path);
  }

  /**
   * Format a paginated response
   */
  static paginated<T>(
    items: T[],
    pagination: PaginationInfo,
    message: string = 'Data retrieved successfully'
  ): PaginatedResponse<T> {
    return {
      success: true,
      data: items,
      message,
      timestamp: new Date().toISOString(),
      pagination
    };
  }

  /**
   * Create pagination info from data
   */
  static createPaginationInfo(
    page: number,
    limit: number,
    total: number
  ): PaginationInfo {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Format a health check response
   */
  static health(
    service: string,
    status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy',
    version?: string,
    uptime?: number,
    dependencies?: Array<{
      name: string;
      status: 'connected' | 'disconnected' | 'degraded';
      responseTime?: number;
    }>
  ): APIResponse {
    return this.success({
      service,
      status,
      version,
      uptime,
      timestamp: new Date().toISOString(),
      dependencies: dependencies || []
    }, `${service} is ${status}`);
  }

  /**
   * Format validation error response
   */
  static validationError(
    errors: string[],
    details?: string,
    path?: string
  ): ErrorResponse {
    return this.error(
      'Validation failed',
      details || errors.join(', '),
      'VALIDATION_ERROR',
      path
    );
  }

  /**
   * Format external API error response
   */
  static externalApiError(
    apiName: string,
    error: string,
    details?: string,
    path?: string
  ): ErrorResponse {
    return this.error(
      `${apiName} API error`,
      details || error,
      'EXTERNAL_API_ERROR',
      path
    );
  }

  /**
   * Format timeout error response
   */
  static timeoutError(
    operation: string,
    timeoutMs: number,
    path?: string
  ): ErrorResponse {
    return this.error(
      `${operation} timed out`,
      `Operation exceeded ${timeoutMs}ms timeout`,
      'TIMEOUT_ERROR',
      path
    );
  }

  /**
   * Format not found error response
   */
  static notFoundError(
    resource: string,
    identifier?: string,
    path?: string
  ): ErrorResponse {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    return this.error(
      message,
      undefined,
      'NOT_FOUND',
      path
    );
  }

  /**
   * Format unauthorized error response
   */
  static unauthorizedError(
    message: string = 'Unauthorized access',
    details?: string,
    path?: string
  ): ErrorResponse {
    return this.error(
      message,
      details,
      'UNAUTHORIZED',
      path
    );
  }

  /**
   * Format forbidden error response
   */
  static forbiddenError(
    message: string = 'Access forbidden',
    details?: string,
    path?: string
  ): ErrorResponse {
    return this.error(
      message,
      details,
      'FORBIDDEN',
      path
    );
  }

  /**
   * Format rate limit error response
   */
  static rateLimitError(
    retryAfter?: number,
    details?: string,
    path?: string
  ): ErrorResponse {
    const message = retryAfter
      ? `Rate limit exceeded. Try again in ${retryAfter} seconds`
      : 'Rate limit exceeded';

    return this.error(
      message,
      details,
      'RATE_LIMIT_EXCEEDED',
      path
    );
  }
}