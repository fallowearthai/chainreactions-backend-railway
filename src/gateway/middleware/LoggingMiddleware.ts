/**
 * Logging Middleware for API Gateway
 * ChainReactions Backend - Phase 2
 */

import { Request, Response, NextFunction } from 'express';
import { GatewayMiddleware, ProxyRequest } from '../types/GatewayTypes';
import { logger } from '../../../utils/Logger';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  requestId: string;
  startTime: number;
  method: string;
  path: string;
  userAgent?: string;
  ip: string;
  referer?: string;
  service?: string;
  userId?: string;
}

export class LoggingMiddleware implements GatewayMiddleware {
  name = 'logging';

  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Create request context
    const context: RequestContext = {
      requestId,
      startTime,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: this.getClientIp(req),
      referer: req.get('Referer'),
      userId: (req as any).authContext?.userId
    };

    // Add context to request for other middleware
    (req as any).requestContext = context;

    // Add request ID to response headers
    res.set('X-Request-ID', requestId);

    // Log incoming request
    this.logIncomingRequest(req, context);

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: any[]) {
      const duration = Date.now() - context.startTime;

      // Log response
      LoggingMiddleware.prototype.logResponse.call(
        LoggingMiddleware.prototype,
        req,
        this,
        context,
        duration
      );

      // Call original end
      originalEnd.apply(this, args);
    };

    next();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const clientIp = req.headers['x-client-ip'] as string;

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    if (realIp) {
      return realIp.trim();
    }

    if (clientIp) {
      return clientIp.trim();
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Log incoming request
   */
  private logIncomingRequest(req: Request, context: RequestContext): void {
    const logData = {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      query: req.query,
      ip: context.ip,
      userAgent: context.userAgent,
      referer: context.referer,
      userId: context.userId,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type']
    };

    // Skip logging for health checks in production
    const isHealthCheck = context.path === '/api/health' || context.path.startsWith('/api/monitoring');
    const shouldLog = process.env.NODE_ENV !== 'production' || !isHealthCheck;

    if (shouldLog) {
      logger.info(`Incoming request: ${context.method} ${context.path}`, logData);
    }
  }

  /**
   * Log response
   */
  private logResponse(req: Request, res: Response, context: RequestContext, duration: number): void {
    const statusCode = res.statusCode;
    const contentLength = res.get('content-length') || '0';

    const logData = {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      statusCode,
      duration,
      contentLength,
      ip: context.ip,
      userAgent: context.userAgent,
      service: context.service,
      userId: context.userId
    };

    // Determine log level based on status code
    const isHealthCheck = context.path === '/api/health' || context.path.startsWith('/api/monitoring');
    const shouldLog = process.env.NODE_ENV !== 'production' || !isHealthCheck;

    if (!shouldLog) {
      return;
    }

    if (statusCode >= 500) {
      logger.error(`Request failed: ${context.method} ${context.path} ${statusCode}`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`Request error: ${context.method} ${context.path} ${statusCode}`, logData);
    } else if (duration > 5000) {
      logger.warn(`Slow request: ${context.method} ${context.path} ${statusCode} (${duration}ms)`, logData);
    } else {
      logger.info(`Request completed: ${context.method} ${context.path} ${statusCode} (${duration}ms)`, logData);
    }
  }

  /**
   * Log proxy request to backend service
   */
  public logProxyRequest(context: RequestContext, targetService: string, targetUrl: string): void {
    const logData = {
      requestId: context.requestId,
      method: context.method,
      originalPath: context.path,
      targetService,
      targetUrl,
      ip: context.ip,
      userId: context.userId
    };

    logger.info(`Proxying request to ${targetService}: ${context.method} ${targetUrl}`, logData);

    // Update context with target service
    context.service = targetService;
  }

  /**
   * Log proxy response from backend service
   */
  public logProxyResponse(
    context: RequestContext,
    targetService: string,
    statusCode: number,
    duration: number,
    error?: string
  ): void {
    const logData = {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      targetService,
      statusCode,
      duration,
      ip: context.ip,
      userId: context.userId,
      error
    };

    if (error) {
      logger.error(`Proxy request failed: ${targetService} returned error`, logData);
    } else if (statusCode >= 500) {
      logger.error(`Proxy request failed: ${targetService} ${statusCode}`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`Proxy request error: ${targetService} ${statusCode}`, logData);
    } else if (duration > 10000) {
      logger.warn(`Slow proxy request: ${targetService} ${statusCode} (${duration}ms)`, logData);
    } else {
      logger.debug(`Proxy request completed: ${targetService} ${statusCode} (${duration}ms)`, logData);
    }
  }

  /**
   * Get request statistics
   */
  public getStatistics(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    statusCodes: Record<number, number>;
    topPaths: Array<{ path: string; count: number }>;
  } {
    // This would typically be stored in a metrics collection
    // For now, return placeholder data
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      statusCodes: {},
      topPaths: []
    };
  }
}

export const loggingMiddleware = new LoggingMiddleware();