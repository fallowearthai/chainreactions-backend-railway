import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatasetSearchController } from './controllers/DatasetSearchController';
import { errorHandler, notFoundHandler } from './utils/ErrorHandler';

// Simple logger for standalone service
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[DatasetSearch] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[DatasetSearch] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[DatasetSearch] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DatasetSearch:DEBUG] ${msg}`, ...args),
  verbose: (msg: string, ...args: any[]) => console.log(`[DatasetSearch:VERBOSE] ${msg}`, ...args),
  success: (msg: string, ...args: any[]) => console.log(`[DatasetSearch:SUCCESS] ${msg}`, ...args)
};

// Simplified service registration for testing
async function registerWithServiceDiscovery(): Promise<void> {
  try {
    logger.info('Dataset search service started (Redis service discovery disabled for testing)');
    // TODO: Implement proper service discovery after fixing dependencies
  } catch (error) {
    logger.error('Failed to register with service discovery:', error);
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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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


// SSE Streaming Routes
app.post('/api/dataset-search/stream',
  datasetSearchController.streamSearch
);

app.delete('/api/dataset-search/stream/:execution_id',
  datasetSearchController.cancelStreamSearch
);

app.get('/api/dataset-search/stream/:execution_id/status',
  datasetSearchController.getStreamSearchStatus
);

app.get('/api/dataset-search/nro-stats',
  datasetSearchController.getNROStats
);

// Serve the test frontend explicitly
app.get('/test-frontend.html', (req, res) => {
  console.log('📄 Serving test-frontend.html');
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
  console.warn(`⚠️  Warning: Missing environment variables: ${missingRequiredVars.join(', ')}`);
  console.warn('   Some features may not work correctly.');
  console.warn('   Service will start in degraded mode for troubleshooting.');
  console.warn('   Please check your Docker environment configuration.');
  // Don't exit - allow service to start for health checks and debugging
} else {
  console.log('✅ All required environment variables are present');
}



app.listen(PORT, async () => {
  console.log(`🚀 ChainReactions Dataset Search Service - Phase 3`);
  console.log(`📡 Service running on port ${PORT} (0.0.0.0)`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Service Info: http://localhost:${PORT}/api`);
  console.log(`🔄 Phase 3: Final microservices architecture`);
  console.log(`🔗 API Gateway: http://localhost:3000`);

  // Register with service discovery
  await registerWithServiceDiscovery();

  console.log(`📋 Service endpoints:`);
  console.log(`   • GET  /api - Service information`);
  console.log(`   • GET  /api/health - Health check`);
  console.log(``);
  console.log(`   📡 SSE Streaming:`);
  console.log(`   • POST /api/dataset-search/stream - Start streaming search`);
  console.log(`   • DELETE /api/dataset-search/stream/:id - Cancel streaming search`);
  console.log(`   • GET  /api/dataset-search/stream/:id/status - Stream status`);
  console.log(`   • GET  /api/dataset-search/nro-stats - Canadian NRO statistics`);
  console.log(``);
  console.log(`🔧 Configuration:`);
  console.log(`   🗄️  Supabase: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`   🔍 Linkup API: ${process.env.LINKUP_API_KEY ? '✅' : '❌'}`);
  console.log(`   🔄 Service Discovery: ${process.env.REDIS_HOST ? '✅' : '❌'}`);
  console.log(``);
  console.log(`🎯 Ready for SSE streaming dataset searches with Canadian NRO data!`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DatasetSearch] Received SIGTERM, shutting down gracefully...');
  try {
    console.log('[DatasetSearch] Service stopped');
    process.exit(0);
  } catch (error) {
    console.error('[DatasetSearch] Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('[DatasetSearch] Received SIGINT, shutting down gracefully...');
  try {
    console.log('[DatasetSearch] Service stopped');
    process.exit(0);
  } catch (error) {
    console.error('[DatasetSearch] Error during shutdown:', error);
    process.exit(1);
  }
});

export default app;