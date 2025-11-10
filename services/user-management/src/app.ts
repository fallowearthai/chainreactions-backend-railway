// Load environment variables FIRST - before any imports that use them
import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Import controllers
import { UserController } from './controllers/UserController';
import { AuthController } from './controllers/AuthController';

// Import middleware
import {
  authenticate,
  optionalAuth,
  requireAdmin,
  authenticateService
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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
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
  'http://127.0.0.1:4173'
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

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10'), // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts',
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
        'POST /api/auth/service-auth': 'Service authentication'
      },
      userManagement: {
        'GET /api/users/profile': 'Get current user profile',
        'GET /api/users/:userId': 'Get user by ID (admin)',
        'GET /api/users': 'Get users list (admin)',
        'PUT /api/users/profile/:userId': 'Update user profile',
        'POST /api/users/:userId/approve': 'Approve user (admin)',
        'POST /api/users/:userId/deactivate': 'Deactivate user (admin)',
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
        'POST /api/usage/record': 'Record usage'
      }
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Authentication Routes (with rate limiting)
app.use('/api/auth', authLimiter);

app.post('/api/auth/signup', validateSignUp, (req: Request, res: Response) => {
  authController.signUp(req, res);
});

app.post('/api/auth/signin', validateSignIn, (req: Request, res: Response) => {
  authController.signIn(req, res);
});

app.post('/api/auth/signout', authenticate, (req: Request, res: Response) => {
  authController.signOut(req, res);
});

app.post('/api/auth/verify-email', validateEmailVerification, (req: Request, res: Response) => {
  authController.verifyEmail(req, res);
});

app.post('/api/auth/reset-password', validatePasswordReset, (req: Request, res: Response) => {
  authController.requestPasswordReset(req, res);
});

app.put('/api/auth/update-password', authenticate, validateUpdatePassword, (req: Request, res: Response) => {
  authController.updatePassword(req, res);
});


app.get('/api/auth/user', authenticate, (req: Request, res: Response) => {
  authController.getCurrentUser(req, res);
});

app.post('/api/auth/refresh', (req: Request, res: Response) => {
  authController.refreshToken(req, res);
});

app.post('/api/auth/service-auth', authenticateService, (req: Request, res: Response) => {
  authController.authenticateService(req, res);
});

// User Profile Routes
app.get('/api/users/profile', authenticate, (req: Request, res: Response) => {
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

// Usage Statistics Routes
app.get('/api/users/:userId/usage', authenticate, validateUserId, validateGetUsageStats, (req: Request, res: Response) => {
  userController.getUserUsageStats(req, res);
});

// Credits Management Routes
app.post('/api/users/:userId/credits', authenticate, requireAdmin, validateUserId, validateAddCredits, (req: Request, res: Response) => {
  userController.addCredits(req, res);
});

// Bulk Operations Routes
app.post('/api/users/bulk', authenticate, requireAdmin, validateBulkOperation, (req: Request, res: Response) => {
  userController.bulkUserOperation(req, res);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

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

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  // Close database connections, stop accepting new requests, etc.
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  // Close database connections, stop accepting new requests, etc.
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 User Management Service Started');
  console.log(`📡 Server running on port ${PORT} (0.0.0.0)`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Info: http://localhost:${PORT}/api/info`);
  console.log(`🔐 Auth: POST http://localhost:${PORT}/api/auth/signin`);
  console.log(`👤 Users: GET http://localhost:${PORT}/api/users`);
  console.log('');
  console.log('📋 Configuration:');
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   RATE_LIMIT_MAX_REQUESTS: ${process.env.RATE_LIMIT_MAX_REQUESTS || '100'}`);
  console.log('');
  console.log('🔗 Available Services:');
  console.log('   Authentication (Supabase Auth)');
  console.log('   User Profile Management');
  console.log('   Role & Permission Management');
  console.log('   Usage Credits System');
  console.log('   Bulk Operations');
  console.log('');
  console.log('✅ Ready to accept requests...');

  // Configuration warnings
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase configuration incomplete. Service may not function properly.');
  }

  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️ FRONTEND_URL not set. OAuth redirects may not work correctly.');
  }
});

export default app;