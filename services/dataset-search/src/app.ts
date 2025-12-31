import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatasetSearchController } from './controllers/DatasetSearchController';
import { errorHandler, notFoundHandler } from './utils/ErrorHandler';
import { authenticate } from './middleware/auth';
import { Logger } from './shared/utils/Logger';

// Initialize logger
const logger = new Logger('dataset-search');

// Simplified service registration for testing
async function registerWithServiceDiscovery(): Promise<void> {
  try {
    logger.info('Dataset search service started (Redis service discovery disabled for testing)');
    // TODO: Implement proper service discovery after fixing dependencies
  } catch (error) {
    logger.error('Failed to register with service discovery', error instanceof Error ? error : undefined);
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;



// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://chainreactions.site',
        'https://chainreactions-frontend-dev.vercel.app',
        'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
        'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
      ]
    : [
        'http://localhost:3000', // API Gateway
        'http://localhost:3001', // Frontend dev server (Vite)
        'http://localhost:8080', // Frontend dev server
        'http://localhost:4000', // Main app
        'http://localhost:4002', // Entity relations
        'http://localhost:4003', // Dataset matching
        'http://localhost:8081', // Test ports
        'null'
      ], // Allow frontend, backend, test ports + local files
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware (sanitized)
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: logger.sanitizePath(req.path)
  });
  next();
});

// Initialize controllers
const datasetSearchController = new DatasetSearchController();

// Routes
app.get('/api', (req, res) => {
  res.json({
    service: 'Dataset Search Service',
    version: '2.0.0',
    description: 'ChainReactions Dataset Search Service with SSE Streaming Support',
    endpoints: [
      'POST /api/dataset-search/stream - Start SSE streaming search',
      'DELETE /api/dataset-search/stream/:execution_id - Cancel streaming search',
      'GET /api/dataset-search/stream/:execution_id/status - Get streaming search status',
      'GET /api/dataset-search/datasets - List available datasets',
      'GET /api/dataset-search/nro-stats - Get Canadian NRO statistics',
      'GET /api/health - Health check'
    ],
    status: 'running',
    features: {
      sse_streaming: 'enabled',
      concurrent_search: 'enabled',
      canadian_nro_data: 'enabled'
    }
  });
});

// Health check
app.get('/api/health', datasetSearchController.healthCheck);

// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit!');
  res.json({ message: 'Test endpoint working!', timestamp: new Date().toISOString() });
});


// Apply authentication middleware to all dataset-search routes
app.use('/api/dataset-search', authenticate);

// SSE Streaming Routes (with authentication)
app.post('/api/dataset-search/stream',
  datasetSearchController.streamSearch
);

app.delete('/api/dataset-search/stream/:execution_id',
  datasetSearchController.cancelStreamSearch
);

app.get('/api/dataset-search/stream/:execution_id/status',
  datasetSearchController.getStreamSearchStatus
);

app.get('/api/dataset-search/datasets',
  datasetSearchController.listAvailableDatasets
);

app.get('/api/dataset-search/nro-stats',
  datasetSearchController.getNROStats
);

// Serve the test frontend explicitly
app.get('/test-frontend.html', (req, res) => {
  logger.debug('Serving test-frontend.html');
  res.sendFile('test-frontend.html', { root: '.' });
});

// Serve static files (test frontend) - must be after API routes
app.use(express.static('.'));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use(notFoundHandler);

// Environment variable validation (graceful degradation)
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'LINKUP_API_KEY'];
const missingRequiredVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingRequiredVars.length > 0) {
  logger.warn(`Missing environment variables: ${missingRequiredVars.join(', ')}`, {
    missingVars,
    mode: 'degraded'
  });
  logger.warn('Service will start in degraded mode. Please check your Docker environment configuration');
} else {
  logger.info('All required environment variables are present');
}



app.listen(PORT, async () => {
  logger.info(`Dataset Search Service started`, {
    port: PORT,
    phase: 'Final microservices architecture'
  });
  logger.info('Endpoints available: GET /api, GET /api/health, POST /api/dataset-search/stream');
  logger.info('SSE Streaming: POST /api/dataset-search/stream, DELETE /api/dataset-search/stream/:id, GET /api/dataset-search/stream/:id/status');
  logger.info('Data endpoints: GET /api/dataset-search/datasets, GET /api/dataset-search/nro-stats');

  // Register with service discovery
  await registerWithServiceDiscovery();
  logger.info('Configuration loaded', {
    supabase: !!process.env.SUPABASE_URL,
    linkupApi: !!process.env.LINKUP_API_KEY,
    serviceDiscovery: !!process.env.REDIS_HOST
  });
  logger.info('Service ready for SSE streaming dataset searches');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  try {
    logger.info('Service stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error instanceof Error ? error : undefined);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  try {
    logger.info('Service stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error instanceof Error ? error : undefined);
    process.exit(1);
  }
});

export default app;