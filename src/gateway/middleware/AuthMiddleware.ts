/**
 * Authentication Middleware for API Gateway
 * ChainReactions Backend - Phase 2
 */

import { Request, Response, NextFunction } from 'express';
import { GatewayMiddleware, ProxyRequest } from '../types/GatewayTypes';
import { logger } from '../../../utils/Logger';

export class AuthMiddleware implements GatewayMiddleware {
  name = 'auth';

  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    // For Phase 2, we'll implement basic authentication
    // In Phase 3, this will be enhanced with JWT and user management

    try {
      // Skip auth for health checks and monitoring
      const skipAuthPaths = [
        '/api/health',
        '/api/monitoring',
        '/api'
      ];

      if (skipAuthPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Skip auth for OPTIONS requests (CORS preflight)
      if (req.method === 'OPTIONS') {
        return next();
      }

      // Basic API key validation for Phase 2
      const apiKey = req.headers['x-api-key'] as string;
      const allowedApiKeys = process.env.ALLOWED_API_KEYS?.split(',') || [];

      if (allowedApiKeys.length > 0) {
        if (!apiKey) {
          logger.warn(`Missing API key for ${req.method} ${req.path} from ${req.ip}`);
          res.status(401).json({
            error: 'API key required',
            message: 'Please provide a valid API key in X-API-Key header'
          });
          return;
        }

        if (!allowedApiKeys.includes(apiKey)) {
          logger.warn(`Invalid API key for ${req.method} ${req.path} from ${req.ip}`);
          res.status(401).json({
            error: 'Invalid API key',
            message: 'The provided API key is not valid'
          });
          return;
        }
      }

      // Add auth context to request
      (req as any).authContext = {
        authenticated: true,
        apiKey: apiKey || 'anonymous',
        timestamp: new Date()
      };

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication'
      });
    }
  }
}

export const authMiddleware = new AuthMiddleware();