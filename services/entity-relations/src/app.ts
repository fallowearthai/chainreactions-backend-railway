import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { DeepThinkingSearchController } from './controllers/DeepThinkingSearchController';
import { StandardSearchController } from './controllers/StandardSearchController';
import { FeatureFlags } from './utils/FeatureFlags';
import { Logger } from '../../../src/shared/utils/Logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('entity-relations');

// Global error handlers for stability
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : undefined, {
    reason: reason?.toString() || reason,
    promise: promise?.toString() || 'unknown'
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error, {
    context: 'process_handler'
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Graceful shutdown handlers
let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn(`Signal ${signal} received but shutdown already in progress`);
    return;
  }

  isShuttingDown = true;
  logger.info(`Signal ${signal} received, starting graceful shutdown`);

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown timeout reached');
    process.exit(1);
  }, 10000);

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Environment variable validation
function validateEnvironment() {
  const required = [
    'GEMINI_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!process.env.NODE_ENV) {
    logger.warn('NODE_ENV not set, defaulting to development');
    process.env.NODE_ENV = 'development';
  }
}

// Validate environment on startup
try {
  validateEnvironment();
  logger.info('Service configuration validated');
} catch (error) {
  logger.error('Environment validation failed', error instanceof Error ? error : undefined);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize controllers
const deepThinkingSearchController = new DeepThinkingSearchController();
const standardSearchController = new StandardSearchController();

// Memory monitoring
let memoryCheckInterval: NodeJS.Timeout | null;

function startMemoryMonitoring() {
  const memoryLimit = 512 * 1024 * 1024; // 512MB limit

  memoryCheckInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);

    if (usedMB > 400) { // Warning at 400MB
      logger.warn('High memory usage detected', { usedMB, limitMB: 512 });
    }

    if (usage.heapUsed > memoryLimit) {
      logger.error('Memory limit exceeded', undefined, { usedMB, limitMB: 512 });
      // Trigger garbage collection and consider graceful degradation
      if (global.gc) {
        global.gc();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Start memory monitoring
startMemoryMonitoring();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://chainreactions.site',
        'https://chainreactions-frontend-dev.vercel.app',
        'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
        'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
      ]
    : ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn('Request timeout', {
        method: req.method,
        path: logger.sanitizePath(req.path)
      });
      res.status(504).json({
        error: 'Request timeout',
        message: 'Request took too long to process',
        timestamp: new Date().toISOString()
      });
    }
  }, 240000); // 4 minute timeout

  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  next();
});

// Request logging middleware (sanitized, no IP or User-Agent)
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: logger.sanitizePath(req.path)
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const featureFlags = FeatureFlags.getFeatureFlagStatus();

  res.status(200).json({
    status: 'healthy',
    service: 'entity-relations',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString(),
    features: [
      'DeepThinking Search mode',
      'Standard Search mode',
      'Enhanced Grounding mode',
      'Gemini AI integration',
      'Grounding metadata extraction'
    ],
    grounding: featureFlags.enhanced_grounding,
    endpoints: {
      deepthinking_search: 'POST /api/deepthinking-search',
      deepthinking_health: 'GET /api/deepthinking/health',
      deepthinking_info: 'GET /api/deepthinking/info',
      normal_search: 'POST /api/normal-search',
      normal_health: 'GET /api/normal/health',
      normal_info: 'GET /api/normal/info',
      standard_search: 'POST /api/standard-search',
      standard_health: 'GET /api/standard/health',
      standard_info: 'GET /api/standard/info',
      grounding_admin: 'POST /api/admin/grounding/config', // Admin endpoint
      grounding_status: 'GET /api/admin/grounding/status' // Status endpoint
    }
  });
});

// Admin endpoints for grounding configuration
app.post('/api/admin/grounding/config', (req, res) => {
  try {
    const { enabled, rollout_percentage, confidence_threshold, log_level } = req.body;

    const updates: any = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof rollout_percentage === 'number') updates.rolloutPercentage = rollout_percentage;
    if (typeof confidence_threshold === 'number') updates.confidenceThreshold = confidence_threshold;
    if (typeof log_level === 'string') updates.logLevel = log_level;

    FeatureFlags.updateGroundingConfig(updates);

    FeatureFlags.log('Grounding configuration updated via admin API', 'info', {
      updates,
      adminIp: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Grounding configuration updated successfully',
      config: FeatureFlags.getFeatureFlagStatus().enhanced_grounding,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update grounding configuration',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get grounding status
app.get('/api/admin/grounding/status', (req, res) => {
  const config = FeatureFlags.getGroundingConfig();
  const status = FeatureFlags.shouldUseEnhancedGrounding();

  res.status(200).json({
    status: 'success',
    grounding: {
      ...config,
      current_session_active: status
    },
    timestamp: new Date().toISOString()
  });
});

// Emergency disable endpoint
app.post('/api/admin/grounding/emergency-disable', (req, res) => {
  FeatureFlags.emergencyDisable();

  FeatureFlags.log('Emergency disable triggered via admin API', 'warn', {
    adminIp: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Enhanced grounding emergency disabled',
    config: FeatureFlags.getFeatureFlagStatus().enhanced_grounding,
    timestamp: new Date().toISOString()
  });
});

// DeepThinking Search endpoints
app.post('/api/deepthinking-search', deepThinkingSearchController.handleDeepThinkingSearch.bind(deepThinkingSearchController));
app.get('/api/deepthinking/health', deepThinkingSearchController.healthCheck.bind(deepThinkingSearchController));
app.get('/api/deepthinking/info', deepThinkingSearchController.getInfo.bind(deepThinkingSearchController));

// Standard Search endpoints
app.post('/api/standard-search', standardSearchController.handleStandardSearch.bind(standardSearchController));
app.get('/api/standard/health', standardSearchController.healthCheck.bind(standardSearchController));
app.get('/api/standard/info', standardSearchController.getInfo.bind(standardSearchController));

// Service information endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    service: 'Entity Relations Service',
    description: 'DeepThinking and Standard Search modes for entity relationship analysis',
    version: '1.0.0',
    port: PORT,
    modes: {
      deepthinking: {
        name: 'DeepThinking Search Mode',
        description: 'Advanced AI-powered relationship analysis using Gemini Google Search',
        features: [
          'Direct Gemini Google Search integration',
          'Multi-language support',
          'Time-range filtering',
          'Relationship type classification',
          'Grounding metadata extraction'
        ]
      },
      standard: {
        name: 'Standard Search Mode',
        description: 'Fast entity verification using Gemini AI',
        features: [
          'Quick entity verification',
          'Basic relationship analysis',
          'Multi-language support',
          'Fast response times'
        ]
      }
    },
    documentation: {
      deepthinking_endpoints: {
        search: 'POST /api/deepthinking-search - Advanced entity search',
        health: 'GET /api/deepthinking/health - Service health check',
        info: 'GET /api/deepthinking/info - Service information'
      },
      standard_endpoints: {
        search: 'POST /api/standard-search - Fast entity verification',
        health: 'GET /api/standard/health - Service health check',
        info: 'GET /api/standard/info - Service information'
      }
    },
    integrations: [
      'Google Gemini 2.5 Flash AI',
      'Enhanced Grounding mode'
    ]
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    available_endpoints: [
      'GET /api/health',
      'GET /api',
      'POST /api/deepthinking-search',
      'GET /api/deepthinking/health',
      'GET /api/deepthinking/info',
      'POST /api/standard-search',
      'GET /api/standard/health',
      'GET /api/standard/info'
    ]
  });
});

// Start server with proper Docker binding
const HOST = process.env.HOST || '0.0.0.0'; // Docker requires binding to 0.0.0.0

const server = app.listen(Number(PORT), HOST, () => {
  logger.info(`Entity Relations Service started successfully`, {
    host: HOST,
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
  logger.info('Endpoints available: GET /api/health, GET /api, POST /api/deepthinking-search, POST /api/standard-search');
  logger.info(`CORS enabled for: ${process.env.NODE_ENV === 'production' ? 'Production domains' : 'Local development'}`);
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`, undefined, { port: PORT });
    process.exit(1);
  } else {
    logger.error('Server error', error);
    process.exit(1);
  }
});

// Handle server close event for graceful shutdown
server.on('close', () => {
  logger.info('Server closed');
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
  }
});

export default app;