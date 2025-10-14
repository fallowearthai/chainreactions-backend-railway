/**
 * Rate Limiting Middleware for API Gateway
 * ChainReactions Backend - Phase 2
 */

import { Request, Response, NextFunction } from 'express';
import { GatewayMiddleware } from '../types/GatewayTypes';
import { GATEWAY_CONFIG } from '../config/GatewayConfig';
import { logger } from '../../../utils/Logger';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimitMiddleware implements GatewayMiddleware {
  name = 'rateLimit';
  private records: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!GATEWAY_CONFIG.rateLimiting) {
      return next();
    }

    try {
      const clientId = this.getClientId(req);
      const now = Date.now();
      const windowStart = now - GATEWAY_CONFIG.rateLimit.windowMs;

      let record = this.records.get(clientId);

      if (!record || record.resetTime <= now) {
        // Create new record or reset expired record
        record = {
          count: 1,
          resetTime: now + GATEWAY_CONFIG.rateLimit.windowMs,
          firstRequest: now
        };
        this.records.set(clientId, record);
      } else {
        // Increment existing record
        record.count++;
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': GATEWAY_CONFIG.rateLimit.max.toString(),
        'X-RateLimit-Remaining': Math.max(0, GATEWAY_CONFIG.rateLimit.max - record.count).toString(),
        'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
      });

      // Check if limit exceeded
      if (record.count > GATEWAY_CONFIG.rateLimit.max) {
        logger.warn(`Rate limit exceeded for ${clientId} (${record.count}/${GATEWAY_CONFIG.rateLimit.max})`, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds.`,
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
          limit: GATEWAY_CONFIG.rateLimit.max,
          remaining: 0,
          resetTime: record.resetTime
        });
        return;
      }

      // Log rate limit status in development
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`Rate limit status for ${clientId}: ${record.count}/${GATEWAY_CONFIG.rateLimit.max}`, {
          path: req.path,
          method: req.method,
          remaining: Math.max(0, GATEWAY_CONFIG.rateLimit.max - record.count)
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
      next(); // Continue on error to avoid breaking requests
    }
  }

  /**
   * Generate client identifier for rate limiting
   */
  private getClientId(req: Request): string {
    // Use IP address as client identifier
    // In Phase 3, this will be enhanced to use authenticated user IDs
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const ip = forwarded?.split(',')[0] || realIp || req.ip || 'unknown';

    // For development, include a port identifier to avoid conflicts
    const devSuffix = process.env.NODE_ENV !== 'production' ? `-${req.socket.localPort}` : '';

    return `ip:${ip}${devSuffix}`;
  }

  /**
   * Clean up expired rate limit records
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientId, record] of this.records.entries()) {
      if (record.resetTime <= now) {
        this.records.delete(clientId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  /**
   * Get current rate limit statistics
   */
  public getStatistics(): {
    totalRecords: number;
    activeRecords: number;
    averageRequests: number;
    topClients: Array<{ clientId: string; count: number; lastRequest: number }>;
  } {
    const now = Date.now();
    const activeRecords: Array<{ clientId: string; count: number; lastRequest: number }> = [];
    let totalRequests = 0;

    for (const [clientId, record] of this.records.entries()) {
      if (record.resetTime > now) {
        activeRecords.push({
          clientId: this.sanitizeClientId(clientId),
          count: record.count,
          lastRequest: record.firstRequest
        });
        totalRequests += record.count;
      }
    }

    // Sort by request count and get top 10
    const topClients = activeRecords
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRecords: this.records.size,
      activeRecords: activeRecords.length,
      averageRequests: activeRecords.length > 0 ? Math.round(totalRequests / activeRecords.length) : 0,
      topClients
    };
  }

  /**
   * Sanitize client ID for logging (remove sensitive information)
   */
  private sanitizeClientId(clientId: string): string {
    // For IP-based IDs, show only the first two octets
    if (clientId.startsWith('ip:')) {
      const ip = clientId.substring(3);
      const parts = ip.split('.');
      if (parts.length >= 2) {
        return `ip:${parts[0]}.${parts[1]}.***.***`;
      }
    }

    // For other IDs, return only first few characters
    return clientId.substring(0, 8) + '***';
  }

  /**
   * Reset rate limit for a specific client (admin function)
   */
  public resetClient(clientId: string): boolean {
    const deleted = this.records.delete(clientId);
    if (deleted) {
      logger.info(`Rate limit reset for client: ${this.sanitizeClientId(clientId)}`);
    }
    return deleted;
  }

  /**
   * Reset all rate limits (admin function)
   */
  public resetAll(): number {
    const count = this.records.size;
    this.records.clear();
    logger.info(`Reset ${count} rate limit records`);
    return count;
  }

  /**
   * Cleanup on shutdown
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.records.clear();
  }
}

export const rateLimitMiddleware = new RateLimitMiddleware();