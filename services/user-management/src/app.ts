// Load environment variables FIRST - before any imports that use them
import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Logger } from '../../../src/shared/utils/Logger';

// Initialize logger
const logger = new Logger('user-management');

// Import controllers
import { UserController } from './controllers/UserController';
import { AuthController } from './controllers/AuthControllerSimple';
import { AuthNotificationController } from './controllers/AuthNotificationController';

// Import middleware
import {
  authenticate,
  optionalAuth,
  requireAdmin,
  authenticateService,
  AuthMiddleware
} from './middleware/auth';
import {
  validateSignUp,
  validateSignIn,
  validatePasswordReset,
  validateUpdatePassword,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateAssignRole,
  validateAddCredits,
  validateGetUsers,
  validateGetUsageStats,
  validateBulkOperation,
  validateEmailVerification
} from './middleware/validation';

// Initialize Express app
const app = express();
const PORT = parseInt(process.env.PORT || '3007', 10);

// Controllers
const userController = new UserController();
const authController = new AuthController();
const authNotificationController = new AuthNotificationController();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting - very lenient to avoid 429 errors
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // limit each IP to 1000 requests per minute
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting will be applied after CORS (moved to prevent blocking preflight requests)

// CORS middleware - MUST come before rate limiting to handle preflight requests
const corsOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://chainreactions.site',
  'https://www.chainreactions.site',
  'https://chainreactions-frontend-dev.vercel.app'
];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token', 'X-Session-ID']
}));

// Development: Log CORS requests
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      console.log(`🌐 CORS Preflight: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
    }
    next();
  });
}

// More lenient rate limiting for auth endpoints (SSE needs higher limits)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 auth requests per minute
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Separate, more restrictive rate limiting for sensitive auth actions (login, signup)
const sensitiveAuthLimiter = rateLimit({
  windowMs: parseInt(process.env.SENSITIVE_AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.SENSITIVE_AUTH_RATE_LIMIT_MAX_REQUESTS || '20'), // limit each IP to 20 sensitive auth requests per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very lenient rate limiting for SSE connections (can't be too restrictive)
const sseLimiter = rateLimit({
  windowMs: parseInt(process.env.SSE_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.SSE_RATE_LIMIT_MAX_REQUESTS || '200'), // limit each IP to 200 SSE connections per minute
  message: {
    success: false,
    error: 'Too many SSE connections',
    message: 'Please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration moved above to handle preflight requests before rate limiting

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${clientIP} - UA: ${userAgent}`);

  // Add request metadata for later use
  req.requestStartTime = Date.now();

  next();
});

// Response logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;

  res.send = function(body) {
    const duration = Date.now() - (req.requestStartTime || Date.now());
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

    return originalSend.call(this, body);
  };

  next();
});

// Rate limiting (exclude OPTIONS requests to prevent blocking CORS preflight)
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  return limiter(req, res, next);
});

// Health check endpoint (no auth required)
app.get('/api/health', (req: Request, res: Response) => {
  userController.healthCheck(req, res);
});

// Service info endpoint (no auth required)
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    service: 'User Management Service',
    version: '1.0.0',
    description: 'User authentication and management service with Supabase Auth integration',
    port: PORT,
    endpoints: {
      authentication: {
        'POST /api/auth/signup': 'User registration',
        'POST /api/auth/signin': 'User sign in',
        'POST /api/auth/signout': 'User sign out',
        'POST /api/auth/verify-email': 'Email verification',
        'POST /api/auth/reset-password': 'Request password reset',
        'PUT /api/auth/update-password': 'Update password',
        'GET /api/auth/user': 'Get current user',
        'POST /api/auth/refresh': 'Refresh token',
        'POST /api/auth/service-auth': 'Service authentication',
        'GET /api/auth/session-config': 'Get session configuration',
        'POST /api/auth/check-session': 'Check session status',
        'POST /api/auth/update-activity': 'Update session activity',
        'GET /api/auth/sessions': 'Get user active sessions',
        'POST /api/auth/sessions/:sessionId/logout': 'Force logout session'
      },
      notifications: {
        'GET /api/auth/notifications/stream': 'SSE notification stream (no rate limiting)',
        'GET /api/auth/notifications/stats': 'Notification connection stats',
        'POST /api/auth/notifications/test': 'Send test notification'
      },
      userManagement: {
        'GET /api/users/profile': 'Get current user profile',
        'GET /api/users/:userId': 'Get user by ID (admin)',
        'GET /api/users': 'Get users list (admin)',
        'PUT /api/users/profile/:userId': 'Update user profile',
        'POST /api/users/:userId/approve': 'Approve user (admin)',
        'POST /api/users/:userId/deactivate': 'Deactivate user (admin)',
        'PUT /api/users/:userId/account-type': 'Update user account type (admin)',
        'GET /api/users/:userId/usage': 'Get user usage stats',
        'POST /api/users/:userId/credits': 'Add credits (admin)',
        'POST /api/users/bulk': 'Bulk user operations (admin)'
      },
      roleManagement: {
        'POST /api/users/:userId/roles': 'Assign role (admin)',
        'DELETE /api/users/:userId/roles/:role': 'Remove role (admin)'
      },
      creditsManagement: {
        'GET /api/users/:userId/credits': 'Get user credits',
        'POST /api/users/:userId/credits/add': 'Add credits (admin)',
        'POST /api/credits/validate': 'Validate user credits',
        'POST /api/credits/deduct': 'Deduct user credits',
        'POST /api/users/:userId/credits/reset': 'Reset user credits (admin)',
        'POST /api/usage/record': 'Record usage'
      },
        systemAdministration: {
        'POST /api/admin/monthly-reset': 'Perform monthly credit reset (admin)',
        'POST /api/admin/check-trials': 'Check and expire expired trials (admin)'
      }
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// SSE Notification Routes - Separate path to avoid auth rate limiting
// Apply SSE rate limiter to prevent 429 errors
app.get('/api/notifications/stream', sseLimiter, (req: Request, res: Response, next: NextFunction) => {
  authNotificationController.connectNotificationsStream(req, res, next);
});

app.get('/api/notifications/stats', sseLimiter, (req: Request, res: Response, next: NextFunction) => {
  authNotificationController.getNotificationsStats(req, res, next);
});

app.post('/api/notifications/test', sseLimiter, (req: Request, res: Response, next: NextFunction) => {
  authNotificationController.sendTestNotification(req, res, next);
});

app.get('/api/notifications/metrics', sseLimiter, (req: Request, res: Response, next: NextFunction) => {
  authNotificationController.getConnectionMetrics(req, res, next);
});

// Authentication Routes (with rate limiting)
app.use('/api/auth', authLimiter);

app.post('/api/auth/signup', sensitiveAuthLimiter, validateSignUp, (req: Request, res: Response, next: NextFunction) => {
  authController.signUp(req, res);
});

app.post('/api/auth/signin', sensitiveAuthLimiter, validateSignIn, (req: Request, res: Response, next: NextFunction) => {
  authController.signIn(req, res);
});

app.post('/api/auth/signout', authenticate, (req: Request, res: Response, next: NextFunction) => {
  authController.signOut(req, res);
});

app.post('/api/auth/verify-email', validateEmailVerification, (req: Request, res: Response, next: NextFunction) => {
  authController.verifyEmail(req, res);
});

app.post('/api/auth/reset-password', validatePasswordReset, (req: Request, res: Response, next: NextFunction) => {
  authController.requestPasswordReset(req, res);
});

app.put('/api/auth/update-password', authenticate, validateUpdatePassword, (req: Request, res: Response, next: NextFunction) => {
  authController.updatePassword(req, res);
});


app.get('/api/auth/user', authenticate, (req: Request, res: Response, next: NextFunction) => {
  authController.getCurrentUser(req, res);
});

app.post('/api/auth/refresh', (req: Request, res: Response, next: NextFunction) => {
  authController.refreshToken(req, res);
});

app.post('/api/auth/service-auth', authenticateService, (req: Request, res: Response, next: NextFunction) => {
  authController.authenticateService(req, res);
});

// Simple Session Management Routes
app.get('/api/auth/session-config', (req: Request, res: Response, next: NextFunction) => {
  authController.getSessionConfig(req, res);
});

app.post('/api/auth/check-session', AuthMiddleware.authenticateJWTOnly, (req: Request, res: Response, next: NextFunction) => {
  authController.checkSession(req, res);
});

app.post('/api/auth/update-activity', authenticate, (req: Request, res: Response, next: NextFunction) => {
  authController.updateActivity(req, res);
});

app.get('/api/auth/sessions', authenticate, (req: Request, res: Response, next: NextFunction) => {
  authController.getUserSessions(req, res);
});

app.post('/api/auth/sessions/:sessionId/logout', authenticate, (req: Request, res: Response, next: NextFunction) => {
  authController.forceLogoutSession(req, res);
});

app.post('/api/auth/sessions', AuthMiddleware.authenticateJWTOnly, (req: Request, res: Response, next: NextFunction) => {
  authController.registerSession(req, res, next);
});

app.post('/api/auth/update-session-id', AuthMiddleware.authenticateJWTOnly, (req: Request, res: Response, next: NextFunction) => {
  authController.updateSessionId(req, res, next);
});

// User Profile Routes
app.get('/api/users/profile', AuthMiddleware.authenticateJWTOnly, (req: Request, res: Response) => {
  userController.getCurrentUserProfile(req, res);
});

app.get('/api/users/:userId', authenticate, requireAdmin, validateUserId, (req: Request, res: Response) => {
  userController.getUserById(req, res);
});

app.get('/api/users', authenticate, requireAdmin, validateGetUsers, (req: Request, res: Response) => {
  userController.getUsers(req, res);
});

app.put('/api/users/profile', authenticate, validateUpdateUser, (req: Request, res: Response) => {
  userController.updateUserProfile(req, res);
});

app.put('/api/users/profile/:userId', authenticate, requireAdmin, validateUserId, validateUpdateUser, (req: Request, res: Response) => {
  userController.updateUserProfile(req, res);
});


app.post('/api/users/:userId/deactivate', authenticate, requireAdmin, validateUserId, (req: Request, res: Response) => {
  userController.deactivateUser(req, res);
});

app.put('/api/users/:userId/account-type', authenticate, requireAdmin, validateUserId, (req: Request, res: Response) => {
  userController.updateUserAccountType(req, res);
});

// Usage Statistics Routes
app.get('/api/users/:userId/usage', authenticate, validateUserId, validateGetUsageStats, (req: Request, res: Response) => {
  userController.getUserUsageStats(req, res);
});

// Credits Management Routes
app.post('/api/users/:userId/credits', authenticate, requireAdmin, validateUserId, validateAddCredits, (req: Request, res: Response) => {
  userController.addCredits(req, res);
});

// Credit Validation Routes
app.post('/api/credits/validate', authenticate, (req: Request, res: Response) => {
  userController.validateCredits(req, res);
});

app.post('/api/credits/deduct', authenticate, (req: Request, res: Response) => {
  userController.deductCredits(req, res);
});

app.post('/api/users/:userId/credits/reset', authenticate, requireAdmin, validateUserId, (req: Request, res: Response) => {
  userController.resetUserCredits(req, res);
});


// System Administration Routes
app.post('/api/admin/monthly-reset', authenticate, requireAdmin, (req: Request, res: Response) => {
  userController.monthlyCreditReset(req, res);
});

app.post('/api/admin/check-trials', authenticate, requireAdmin, (req: Request, res: Response) => {
  userController.checkAndExpireTrials(req, res);
});

// Bulk Operations Routes
app.post('/api/users/bulk', authenticate, requireAdmin, validateBulkOperation, (req: Request, res: Response) => {
  userController.bulkUserOperation(req, res);
});

// Error handling middleware with enhanced logging
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Express Error Handler:', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't include stack trace in production
  const response = {
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.headers['x-request-id'] || 'unknown'
  };

  res.status(500).json(response);
});

// Wrap async route handlers to catch errors
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('🔥 Async Route Error:', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      });

      // Send error response
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    });
  };
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Global error handlers to prevent service crashes
process.on('uncaughtException', (error: Error, origin: string) => {
  logger.error('Uncaught Exception', error, {
    origin
  });

  // Log but don't exit - keep service running
  logger.warn('Service continues running despite uncaught exception');

  // Report to monitoring if available
  // TODO: Add error reporting service integration
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : undefined, {
    reason: reason instanceof Error ? reason.message : reason,
    promise: promise.toString()
  });

  // Log but don't exit - keep service running
  logger.warn('Service continues running despite unhandled promise rejection');

  // Report to monitoring if available
  // TODO: Add error reporting service integration
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');

  // Close SSE connections first
  try {
    const { authNotificationService } = require('./services/AuthNotificationService');
    authNotificationService.shutdown();
    logger.info('SSE connections closed');
  } catch (error) {
    logger.error('Error closing SSE connections', error instanceof Error ? error : undefined);
  }

  // Close database connections, stop accepting new requests, etc.
  setTimeout(() => {
    logger.info('Graceful shutdown complete');
    process.exit(0);
  }, 2000); // Give 2 seconds for cleanup
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully');

  // Close SSE connections first
  try {
    const { authNotificationService } = require('./services/AuthNotificationService');
    authNotificationService.shutdown();
    logger.info('SSE connections closed');
  } catch (error) {
    logger.error('Error closing SSE connections', error instanceof Error ? error : undefined);
  }

  // Close database connections, stop accepting new requests, etc.
  setTimeout(() => {
    logger.info('Graceful shutdown complete');
    process.exit(0);
  }, 2000); // Give 2 seconds for cleanup
});

// Initialize trial expiration service
import { TrialExpirationService } from './services/TrialExpirationService';
const trialExpirationService = new TrialExpirationService();

// Schedule trial expiration check to run daily at midnight UTC
const scheduleTrialExpirationCheck = () => {
  const checkTrials = async () => {
    try {
      logger.info('Running daily trial expiration check');
      const result = await trialExpirationService.checkAndExpireTrials();
      logger.info('Trial expiration check completed', { result: result.message });

      // Check for trials expiring in next 3 days
      const expiringSoon = await trialExpirationService.getTrialsExpiringSoon(3);
      if (expiringSoon.length > 0) {
        logger.warn(`Found ${expiringSoon.length} trials expiring in the next 3 days`, {
          count: expiringSoon.length
        });
      }
    } catch (error) {
      logger.error('Trial expiration check failed', error instanceof Error ? error : undefined);
    }
  };

  // Run immediately on startup
  checkTrials();

  // Schedule to run daily at midnight UTC
  const scheduleNextRun = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0); // Set to midnight UTC

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      checkTrials();
      scheduleNextRun(); // Schedule next day's run
    }, msUntilMidnight);
  };

  scheduleNextRun();
};

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`User Management Service started on port ${PORT}`, {
    port: PORT,
    host: '0.0.0.0'
  });
  logger.info('Endpoints available: GET /api/health, GET /api/info, POST /api/auth/signin, GET /api/users');
  logger.info('Available Services: Authentication, User Profile Management, Role & Permission Management, Usage Credits System, Bulk Operations, Trial Expiration Management');

  // Start trial expiration scheduling
  scheduleTrialExpirationCheck();

  logger.info('Service ready to accept requests');

  // Configuration warnings
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('Supabase configuration incomplete. Service may not function properly');
  }

  if (!process.env.FRONTEND_URL) {
    logger.warn('FRONTEND_URL not set. OAuth redirects may not work correctly');
  }
});

export default app;