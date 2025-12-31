import { Response, NextFunction } from 'express';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { ServiceError, ValidationError, ExternalApiError, NotFoundError } from '../errors/ServiceErrors';
import { Request } from 'express';
import { Logger } from '../utils/Logger';
import { Sanitization } from '../utils/Sanitization';

/**
 * Base controller class for all ChainReactions microservices.
 *
 * This class provides common functionality for:
 * - Error handling with appropriate HTTP status codes
 * - Request validation
 * - Response formatting
 * - Professional logging with sanitization
 *
 * Extending controllers should call super.setup() in their constructor.
 */
export abstract class BaseController {
  protected serviceName: string;
  protected logger: Logger;
  protected sanitizer: Sanitization;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
    this.sanitizer = new Sanitization();
  }

  /**
   * Handle errors consistently across all controllers
   */
  protected handleError(
    res: Response,
    error: unknown,
    defaultMessage: string = 'Internal server error',
    path?: string
  ): void {
    // Log error using professional logger
    if (error instanceof Error) {
      this.logger.error(defaultMessage, error, { path });
    } else {
      this.logger.error(defaultMessage, undefined, { error: String(error), path });
    }

    if (error instanceof ValidationError) {
      res.status(400).json(
        ResponseFormatter.validationError(
          error.details ? [error.details] : [error.message],
          error.message,
          path
        )
      );
      return;
    }

    if (error instanceof NotFoundError) {
      res.status(404).json(
        ResponseFormatter.notFoundError(error.resource, error.identifier, path)
      );
      return;
    }

    if (error instanceof ExternalApiError) {
      res.status(502).json(
        ResponseFormatter.externalApiError(
          error.service,
          error.message,
          error.details,
          path
        )
      );
      return;
    }

    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(
        ResponseFormatter.error(error.message, error.details, error.code, path)
      );
      return;
    }

    // Handle Express async errors
    if (error instanceof Error) {
      res.status(500).json(
        ResponseFormatter.error(
          defaultMessage,
          error.message,
          'INTERNAL_ERROR',
          path
        )
      );
      return;
    }

    // Handle unknown errors
    res.status(500).json(
      ResponseFormatter.error(
        defaultMessage,
        String(error),
        'UNKNOWN_ERROR',
        path
      )
    );
  }

  /**
   * Send success response
   */
  protected sendSuccess<T>(
    res: Response,
    data: T,
    message: string = 'Operation successful',
    statusCode: number = 200
  ): void {
    res.status(statusCode).json(ResponseFormatter.success(data, message));
  }

  /**
   * Send paginated response
   */
  protected sendPaginated<T>(
    res: Response,
    items: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data retrieved successfully'
  ): void {
    const pagination = ResponseFormatter.createPaginationInfo(page, limit, total);
    res.json(ResponseFormatter.paginated(items, pagination, message));
  }

  /**
   * Validate required fields in request body
   */
  protected validateRequiredFields(
    body: any,
    requiredFields: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!body[field]) {
        errors.push(`${field} is required`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate string field
   */
  protected validateStringField(
    value: any,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return { isValid: false, errors };
    }

    if (minLength && value.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters`);
    }

    if (maxLength && value.length > maxLength) {
      errors.push(`${fieldName} must be at most ${maxLength} characters`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get client IP address from request
   * Note: Only use this for legitimate security purposes, not for logging
   */
  protected getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Log request information (sanitized - no IP or User-Agent)
   */
  protected logRequest(req: Request, additionalInfo?: string): void {
    this.logger.info('Request received', {
      method: req.method,
      path: this.logger.sanitizePath(req.path),
      additionalInfo
    });
  }

  /**
   * Log error with additional context
   */
  protected logError(error: Error, context?: string): void {
    this.logger.error(error.message, error, { context });
  }

  /**
   * Async error handler wrapper for route handlers
   */
  protected asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Check if service is in maintenance mode
   */
  protected isMaintenanceMode(): boolean {
    return process.env.MAINTENANCE_MODE === 'true';
  }

  /**
   * Send maintenance mode response
   */
  protected sendMaintenanceResponse(res: Response): void {
    res.status(503).json(
      ResponseFormatter.error(
        'Service is currently under maintenance',
        'Please try again later',
        'MAINTENANCE_MODE'
      )
    );
  }

  /**
   * Get service health information
   */
  protected getServiceHealth(
    status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy',
    version?: string,
    uptime?: number,
    dependencies?: Array<{
      name: string;
      status: 'connected' | 'disconnected' | 'degraded';
      responseTime?: number;
    }>
  ) {
    return ResponseFormatter.health(
      this.serviceName,
      status,
      version,
      uptime,
      dependencies
    );
  }
}