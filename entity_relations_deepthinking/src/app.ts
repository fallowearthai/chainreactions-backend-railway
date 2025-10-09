import express from 'express';
import path from 'path';
import cors from 'cors';
import { EnhancedSearchController } from './controllers/EnhancedSearchController';
import { NormalSearchController } from './controllers/NormalSearchController';
import { EntitySearchController } from './controllers/EntitySearchController';
import { DatasetMatchingController } from './controllers/DatasetMatchingController';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// CORS middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com'] // Replace with actual frontend domain
    : ['http://localhost:8080'], // Fixed frontend port
  credentials: true
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create controller instances
const enhancedSearchController = new EnhancedSearchController();
const normalSearchController = new NormalSearchController();
const entitySearchController = new EntitySearchController();
const datasetMatchingController = new DatasetMatchingController();

// Routes - 3-Stage OSINT Workflow (DeepThinking Mode)
app.post('/api/enhanced/search', (req, res) => enhancedSearchController.enhancedSearch(req, res));
app.get('/api/enhanced/search-stream', (req, res) => enhancedSearchController.enhancedSearchStream(req, res));
app.post('/api/enhanced/strategy', (req, res) => enhancedSearchController.getSearchStrategy(req, res));
app.get('/api/enhanced/test', (req, res) => enhancedSearchController.testWorkflow(req, res));
app.get('/api/enhanced/info', (req, res) => enhancedSearchController.getWorkflowInfo(req, res));

// Routes - Normal Search (Google Web Search Mode)
app.post('/api/normal-search', (req, res) => normalSearchController.handleNormalSearch(req, res));
app.get('/api/normal-search/info', (req, res) => normalSearchController.getInfo(req, res));

// Routes - Entity Search (Integrated from port 3002)
app.post('/api/entity-search', (req, res, next) => entitySearchController.handleEntitySearch(req, res, next));
app.get('/api/entity-search/test', (req, res, next) => entitySearchController.testLinkupConnection(req, res, next));

// Routes - Dataset Matching (Integrated from port 3003)
app.post('/api/dataset-matching/match', (req, res, next) => datasetMatchingController.handleSingleMatch(req, res, next));
app.post('/api/dataset-matching/batch', (req, res, next) => datasetMatchingController.handleBatchMatch(req, res, next));
app.get('/api/dataset-matching/cache/clear', (req, res, next) => datasetMatchingController.handleClearCache(req, res, next));
app.post('/api/dataset-matching/cache/warmup', (req, res, next) => datasetMatchingController.handleCacheWarmup(req, res, next));
app.get('/api/dataset-matching/stats', (req, res, next) => datasetMatchingController.handleGetStats(req, res, next));
app.get('/api/dataset-matching/health', (req, res, next) => datasetMatchingController.handleHealthCheck(req, res, next));
app.get('/api/dataset-matching/test', (req, res, next) => datasetMatchingController.handleTestMatch(req, res, next));

// Health check endpoint - Combined service
app.get('/api/health', async (req, res) => {
  try {
    // Check all services health
    const entitySearchHealth = await entitySearchController.healthCheck();
    const datasetMatchingHealth = await datasetMatchingController.healthCheck();

    // Overall service health
    const allHealthy = entitySearchHealth.status === 'operational' &&
                      datasetMatchingHealth.status === 'operational';

    res.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'ChainReactions Unified API Gateway',
      version: '3.0.0',
      unified_services: {
        entity_relations: {
          modes: {
            deepthinking: '3-Stage OSINT Workflow (Gemini + Bright Data SERP)',
            normal: 'Google Web Search based OSINT (Gemini googleSearch)'
          },
          endpoints: {
            deepthinking: '/api/enhanced/search',
            normal: '/api/normal-search'
          },
          status: 'operational'
        },
        entity_search: {
          description: 'Linkup API integration for professional business intelligence',
          endpoints: {
            search: '/api/entity-search',
            test: '/api/entity-search/test'
          },
          health: entitySearchHealth
        },
        dataset_matching: {
          description: 'Advanced entity matching with multiple algorithms',
          endpoints: {
            match: '/api/dataset-matching/match',
            batch: '/api/dataset-matching/batch',
            health: '/api/dataset-matching/health'
          },
          health: datasetMatchingHealth
        }
      },
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'ChainReactions Unified API Gateway',
      error: error.message
    });
  }
});

// Root endpoint - serve the frontend interface
app.get('/api', (req, res) => {
  res.json({
    message: 'ChainReactions Unified API Gateway - All Services Integrated',
    version: '3.0.0',
    services: {
      entity_relations: {
        name: 'Entity Relations OSINT Service',
        modes: {
          deepthinking: {
            name: '3-Stage OSINT Workflow',
            architecture: {
              stage1: 'WebSearch Meta-Prompting',
              stage2: 'Multi-Engine SERP Execution',
              stage3: 'AI Analysis & Integration'
            },
            endpoints: {
              search: 'POST /api/enhanced/search - Complete 3-stage workflow',
              strategy: 'POST /api/enhanced/strategy - Stage 1 only (meta-prompting)',
              test: 'GET /api/enhanced/test - Test with sample data',
              info: 'GET /api/enhanced/info - Workflow information'
            }
          },
          normal: {
            name: 'Google Web Search OSINT',
            description: 'Fast OSINT analysis using Gemini googleSearch tool',
            endpoints: {
              search: 'POST /api/normal-search - Execute normal search',
              info: 'GET /api/normal-search/info - Service information'
            }
          }
        }
      },
      entity_search: {
        name: 'Entity Search Service',
        description: 'Linkup API integration for professional business intelligence',
        endpoints: {
          search: 'POST /api/entity-search - Entity search with domain filtering',
          test: 'GET /api/entity-search/test - Test Linkup API connection'
        }
      },
      dataset_matching: {
        name: 'Dataset Matching Service',
        description: 'Advanced entity matching with multiple algorithms',
        endpoints: {
          match: 'POST /api/dataset-matching/match - Single entity matching',
          batch: 'POST /api/dataset-matching/batch - Batch entity matching',
          health: 'GET /api/dataset-matching/health - Matching service health',
          stats: 'GET /api/dataset-matching/stats - Service statistics',
          test: 'GET /api/dataset-matching/test - Test matching with sample entity',
          cache_clear: 'GET /api/dataset-matching/cache/clear - Clear cache',
          cache_warmup: 'POST /api/dataset-matching/cache/warmup - Warmup cache'
        }
      }
    },
    common_endpoints: {
      health: 'GET /api/health - Unified health check for all services',
      info: 'GET /api - Service information (this endpoint)'
    },
    port_unification: {
      description: 'All services now unified on port 3000',
      previous_ports: {
        entity_relations: 3000,
        entity_search: 3002,
        dataset_matching: 3003
      },
      current_port: 3000
    },
    documentation: 'See CLAUDE.md for detailed usage instructions'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('🚀 ChainReactions Unified API Gateway - All Services Integrated');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`📋 Info: http://localhost:${PORT}/api`);
    console.log('');
    console.log('🔬 Entity Relations Service:');
    console.log('  🔬 DeepThinking Mode (3-Stage Workflow):');
    console.log(`    POST /api/enhanced/search - Complete 3-stage workflow`);
    console.log(`    POST /api/enhanced/strategy - Stage 1 only (meta-prompting)`);
    console.log(`    GET  /api/enhanced/test - Test with sample data`);
    console.log(`    GET  /api/enhanced/info - Workflow information`);
    console.log('  ⚡ Normal Mode (Google Web Search):');
    console.log(`    POST /api/normal-search - Execute normal search`);
    console.log(`    GET  /api/normal-search/info - Service information`);
    console.log('');
    console.log('🔍 Entity Search Service (Integrated from port 3002):');
    console.log(`    POST /api/entity-search - Entity search with domain filtering`);
    console.log(`    GET  /api/entity-search/test - Test Linkup API connection`);
    console.log('');
    console.log('🎯 Dataset Matching Service (Integrated from port 3003):');
    console.log(`    POST /api/dataset-matching/match - Single entity matching`);
    console.log(`    POST /api/dataset-matching/batch - Batch entity matching`);
    console.log(`    GET  /api/dataset-matching/health - Matching service health`);
    console.log(`    GET  /api/dataset-matching/stats - Service statistics`);
    console.log(`    GET  /api/dataset-matching/test - Test matching with sample entity`);
    console.log(`    GET  /api/dataset-matching/cache/clear - Clear cache`);
    console.log(`    POST /api/dataset-matching/cache/warmup - Warmup cache`);
    console.log('');

    // Check if environment variables are set
    console.log('🔧 Environment Configuration:');
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY environment variable is not set');
    } else {
      console.log('✅ GEMINI_API_KEY is configured');
    }

    if (!process.env.BRIGHT_DATA_API_KEY) {
      console.warn('⚠️  BRIGHT_DATA_API_KEY environment variable is not set (required for DeepThinking mode)');
    } else {
      console.log('✅ BRIGHT_DATA_API_KEY is configured');
    }

    if (!process.env.LINKUP_API_KEY) {
      console.warn('⚠️  LINKUP_API_KEY environment variable is not set (required for Entity Search)');
    } else {
      console.log('✅ LINKUP_API_KEY is configured');
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.warn('⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not set (required for Dataset Matching)');
    } else {
      console.log('✅ SUPABASE credentials are configured');
    }

    console.log('');
    console.log('🎉 Port Unification Complete!');
    console.log('   • Entity Relations: port 3000 → port 3000 ✓');
    console.log('   • Entity Search: port 3002 → port 3000 ✓');
    console.log('   • Dataset Matching: port 3003 → port 3000 ✓');
    console.log('✅ Ready to accept requests...');
  });
}

export default app;