import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting
 */
class RateLimiter {
  private requests: Map<string, RateLimitRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired records every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let record = this.requests.get(identifier);

    // Create new record or reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.requests.set(identifier, record);
    }

    // Check if request is allowed
    if (record.count < this.maxRequests) {
      record.count++;
      return {
        allowed: true,
        remaining: this.maxRequests - record.count,
        resetTime: record.resetTime
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  getStatus(): { totalClients: number; totalRequests: number } {
    let totalRequests = 0;
    for (const record of this.requests.values()) {
      totalRequests += record.count;
    }
    return {
      totalClients: this.requests.size,
      totalRequests
    };
  }
}

// Health check rate limiter: 10 requests per minute per IP
const healthCheckLimiter = new RateLimiter(60000, 10);

// API test endpoints rate limiter: 5 requests per hour per IP
const apiTestLimiter = new RateLimiter(3600000, 5);

/**
 * Middleware for health check rate limiting
 */
export const healthCheckRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const result = healthCheckLimiter.check(identifier);

  if (!result.allowed) {
    const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000);
    console.warn(`⚠️ Rate limit exceeded for health check: ${identifier}`);

    res.status(429).json({
      error: 'Too many health check requests',
      message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
      limit: '10 requests per minute',
      retryAfter: resetIn,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  next();
};

/**
 * Middleware for API test endpoints rate limiting
 */
export const apiTestRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const result = apiTestLimiter.check(identifier);

  if (!result.allowed) {
    const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000);
    console.warn(`⚠️ Rate limit exceeded for API test: ${identifier} - ${req.path}`);
    console.warn(`⚠️ This prevents excessive Linkup API credit consumption`);

    res.status(429).json({
      error: 'Too many API test requests',
      message: `Rate limit exceeded. API test endpoints consume credits. Please try again in ${Math.ceil(resetIn / 60)} minutes.`,
      limit: '5 requests per hour',
      retryAfter: resetIn,
      warning: 'API test endpoints consume Linkup credits',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  console.log(`⚠️ API test request allowed: ${identifier} - ${req.path} (${result.remaining} remaining)`);

  next();
};

/**
 * Get rate limiter statistics
 */
export const getRateLimiterStats = () => {
  return {
    healthCheck: healthCheckLimiter.getStatus(),
    apiTest: apiTestLimiter.getStatus()
  };
};
