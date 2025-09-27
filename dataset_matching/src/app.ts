import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { globalErrorHandler } from './utils/ErrorHandler';
import { ResponseFormatter } from './utils/ResponseFormatter';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com'] // Replace with actual frontend domain
    : ['http://localhost:8080'], // Fixed frontend port
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';

  console.log(`${timestamp} - ${method} ${url} - ${userAgent}`);

  // Log body for debugging in development (excluding sensitive data)
  if (process.env.NODE_ENV === 'development' && method !== 'GET') {
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
  }

  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthData = {
    environment: process.env.NODE_ENV || 'development',
    supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    redis_configured: !!process.env.REDIS_URL,
    features: {
      caching: process.env.ENABLE_DISTRIBUTED_CACHE === 'true',
      batch_processing: true,
      quality_assessment: true,
      fuzzy_matching: true
    }
  };

  ResponseFormatter.healthCheck(res, healthData);
});

// Service information endpoint
app.get('/api', (req, res) => {
  ResponseFormatter.serviceInfo(res);
});

// Test database connection endpoint
app.get('/api/test-supabase', async (req, res) => {
  try {
    const { SupabaseService } = await import('./services/SupabaseService');
    const supabaseService = SupabaseService.getInstance();

    const result = await supabaseService.testConnection();

    if (result.success) {
      ResponseFormatter.success(res, result.data, result.metadata);
    } else {
      ResponseFormatter.error(res, result.error!, 503);
    }
  } catch (error: any) {
    console.error('Supabase test error:', error);
    ResponseFormatter.serviceUnavailable(res, 'Supabase');
  }
});

// Initialize Dataset Matching Controller
let datasetMatchingController: any = null;

// Lazy load controller to avoid circular dependencies
const getController = async () => {
  if (!datasetMatchingController) {
    const { DatasetMatchingController } = await import('./controllers/DatasetMatchingController');
    datasetMatchingController = new DatasetMatchingController();
  }
  return datasetMatchingController;
};

// Dataset matching endpoints
app.post('/api/dataset-matching/match', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleSingleMatch(req, res);
  } catch (error: any) {
    console.error('Single match endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

app.post('/api/dataset-matching/batch', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleBatchMatch(req, res);
  } catch (error: any) {
    console.error('Batch match endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

app.get('/api/dataset-matching/cache/clear', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleClearCache(req, res);
  } catch (error: any) {
    console.error('Cache clear endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

app.post('/api/dataset-matching/cache/warmup', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleCacheWarmup(req, res);
  } catch (error: any) {
    console.error('Cache warmup endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

// Additional endpoints
app.get('/api/dataset-matching/stats', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleGetStats(req, res);
  } catch (error: any) {
    console.error('Stats endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

app.get('/api/dataset-matching/health', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleHealthCheck(req, res);
  } catch (error: any) {
    console.error('Health check endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

app.get('/api/dataset-matching/test', async (req, res) => {
  try {
    const controller = await getController();
    await controller.handleTestMatch(req, res);
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    ResponseFormatter.error(res, error.message, 500);
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  ResponseFormatter.notFound(res, 'Endpoint');
});

// Global error handling middleware
app.use(globalErrorHandler);

// Environment variable validation
const validateEnvironment = () => {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('   Service may not function properly without proper configuration.');
    console.warn('   Please check your .env file and ensure all required variables are set.');
  }

  // Optional environment variables
  const optionalEnvVars = [
    'REDIS_URL',
    'DEFAULT_MIN_CONFIDENCE',
    'CACHE_EXPIRATION_MINUTES',
    'BATCH_SIZE_LIMIT'
  ];

  const missingOptionalVars = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptionalVars.length > 0) {
    console.info(`ℹ️  Optional environment variables not set: ${missingOptionalVars.join(', ')}`);
    console.info('   Using default values for these configurations.');
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n📡 Received ${signal}. Shutting down gracefully...`);

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process in production, but log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Dataset Matching Service running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 Service endpoints:`);
  console.log(`   • GET  /api - Service information`);
  console.log(`   • GET  /api/health - Health check`);
  console.log(`   • POST /api/dataset-matching/match - Single entity matching`);
  console.log(`   • POST /api/dataset-matching/batch - Batch entity matching`);
  console.log(`   • GET  /api/dataset-matching/cache/clear - Clear cache`);
  console.log(`   • GET  /api/dataset-matching/stats - Service statistics`);
  console.log(`   • GET  /api/dataset-matching/health - Matching service health`);
  console.log(`   • GET  /api/dataset-matching/test - Test matching`);
  console.log(`   • GET  /api/test-supabase - Test database connection`);

  // Validate environment
  validateEnvironment();

  console.log(`✅ Server started successfully at ${new Date().toISOString()}`);
});

export default app;