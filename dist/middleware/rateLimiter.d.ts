import { Request, Response, NextFunction } from 'express';
/**
 * Middleware for health check rate limiting
 */
export declare const healthCheckRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware for API test endpoints rate limiting
 */
export declare const apiTestRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Get rate limiter statistics
 */
export declare const getRateLimiterStats: () => {
    healthCheck: {
        totalClients: number;
        totalRequests: number;
    };
    apiTest: {
        totalClients: number;
        totalRequests: number;
    };
};
//# sourceMappingURL=rateLimiter.d.ts.map