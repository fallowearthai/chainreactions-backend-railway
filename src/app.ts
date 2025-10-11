import express from 'express';
import path from 'path';
import cors from 'cors';
import { EnhancedSearchController } from './controllers/EnhancedSearchController';
import { NormalSearchController } from './controllers/NormalSearchController';
import { EntitySearchController } from './controllers/EntitySearchController';
import { DatasetMatchingController } from './controllers/DatasetMatchingController';
import { DataManagementController } from './controllers/DataManagementController';
import { DatasetSearchController } from './controllers/DatasetSearchController';
import { DemoRequestController } from './controllers/DemoRequestController';
import { upload, handleUploadError } from './services/data-management/middleware/upload';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

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
const dataManagementController = new DataManagementController();
const datasetSearchController = new DatasetSearchController();
const demoRequestController = new DemoRequestController();

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

// Routes - Data Management (Integrated from port 3006)
app.get('/api/data-management/datasets', (req, res) => dataManagementController.getDatasets(req, res));
app.get('/api/data-management/datasets/:id', (req, res) => dataManagementController.getDatasetById(req, res));
app.post('/api/data-management/datasets', (req, res) => dataManagementController.createDataset(req, res));
app.put('/api/data-management/datasets/:id', (req, res) => dataManagementController.updateDataset(req, res));
app.delete('/api/data-management/datasets/:id', (req, res) => dataManagementController.deleteDataset(req, res));
app.get('/api/data-management/datasets/:id/entries', (req, res) => dataManagementController.getDatasetEntries(req, res));
app.get('/api/data-management/datasets/:id/stats', (req, res) => dataManagementController.getDatasetStats(req, res));
app.post('/api/data-management/datasets/:id/upload', upload.single('file'), handleUploadError, (req: any, res: any) => dataManagementController.uploadFile(req, res));
app.post('/api/data-management/import/nro-targets', (req: any, res: any) => dataManagementController.importNroTargets(req, res));
app.post('/api/data-management/datasets/:id/validate-file', upload.single('file'), handleUploadError, (req: any, res: any) => dataManagementController.validateFile(req, res));
app.get('/api/data-management/datasets/:id/export', (req, res) => dataManagementController.exportDataset(req, res));
app.get('/api/data-management/health', (req, res) => dataManagementController.healthCheck(req, res));
app.get('/api/data-management/test', (req, res) => dataManagementController.testDataManagement(req, res));

// Routes - Dataset Search (Integrated from port 3004)
app.post('/api/dataset-search/stream', (req, res, next) => datasetSearchController.streamSearch(req, res, next));
app.delete('/api/dataset-search/stream/:execution_id', (req, res, next) => datasetSearchController.cancelStreamSearch(req, res, next));
app.get('/api/dataset-search/stream/:execution_id/status', (req, res, next) => datasetSearchController.getStreamSearchStatus(req, res, next));
app.get('/api/dataset-search/nro-stats', (req, res, next) => datasetSearchController.getNROStats(req, res, next));
app.get('/api/dataset-search/health', (req, res, next) => datasetSearchController.healthCheck(req, res, next));
app.get('/api/dataset-search/test', (req, res) => datasetSearchController.testDatasetSearch(req, res));

// Routes - Demo Email Service (Integrated from port 3001)
app.post('/api/demo-request', (req, res) => demoRequestController.handleDemoRequest(req, res));
app.get('/api/test-email', (req, res) => demoRequestController.testEmailService(req, res));

// Health check endpoint - Combined service
app.get('/api/health', async (req, res) => {
  try {
    // Check all services health
    const entitySearchHealth = await entitySearchController.healthCheck();
    const datasetMatchingHealth = await datasetMatchingController.healthCheck();

    // Check new services health
    let dataManagementHealth: { status: string; error?: string } = { status: 'operational' };
    let datasetSearchHealth: { status: string; error?: string } = { status: 'operational' };
    let emailServiceHealth: { status: string; error?: string } = { status: 'operational' };

    try {
      // For new services, we need to call the health check methods differently
      // since they're wrapper controllers
      const mockReq = {} as any;
      const mockRes = {
        status: () => mockRes,
        json: (data: any) => {
          if (data.status === 'unhealthy' || data.status === 'error') {
            if (data.service === 'data-management') {
              dataManagementHealth = { status: 'unhealthy', error: data.error };
            } else if (data.service === 'dataset-search') {
              datasetSearchHealth = { status: 'unhealthy', error: data.error };
            }
          }
          return mockRes;
        }
      } as any;

      await dataManagementController.healthCheck(mockReq, mockRes);
      await datasetSearchController.healthCheck(mockReq, mockRes, {} as any);

      // Check email service health
      try {
        await demoRequestController.testEmailService(mockReq, {
          status: () => ({ json: () => {} }),
          json: (data: any) => {
            if (!data.success) {
              emailServiceHealth = { status: 'unhealthy', error: data.error };
            }
          }
        } as any);
      } catch (error) {
        console.warn('Email service health check failed:', error);
        emailServiceHealth = { status: 'unhealthy', error: 'Email service unavailable' };
      }
    } catch (error) {
      console.warn('Health check warning for new services:', error);
    }

    // Overall service health
    const allHealthy = entitySearchHealth.status === 'operational' &&
                      datasetMatchingHealth.status === 'operational' &&
                      dataManagementHealth.status === 'operational' &&
                      datasetSearchHealth.status === 'operational' &&
                      emailServiceHealth.status === 'operational';

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
        },
        data_management: {
          description: 'CSV upload and intelligent parsing service',
          endpoints: {
            datasets: '/api/data-management/datasets',
            upload: '/api/data-management/datasets/:id/upload',
            export: '/api/data-management/datasets/:id/export',
            health: '/api/data-management/health'
          },
          health: dataManagementHealth
        },
        dataset_search: {
          description: 'Dataset search with SSE streaming and dual Linkup API processing',
          endpoints: {
            stream: '/api/dataset-search/stream',
            nro_stats: '/api/dataset-search/nro-stats',
            health: '/api/dataset-search/health'
          },
          health: datasetSearchHealth
        },
        email_service: {
          description: 'Demo request email service with Gmail SMTP integration',
          endpoints: {
            demo_request: '/api/demo-request - Send demo request email',
            test_email: '/api/test-email - Test email service connection'
          },
          health: emailServiceHealth
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
      },
      data_management: {
        name: 'Data Management Service',
        description: 'CSV upload and intelligent parsing service',
        endpoints: {
          datasets: 'GET /api/data-management/datasets - List all datasets',
          create_dataset: 'POST /api/data-management/datasets - Create new dataset',
          dataset_detail: 'GET /api/data-management/datasets/:id - Get dataset details',
          update_dataset: 'PUT /api/data-management/datasets/:id - Update dataset',
          delete_dataset: 'DELETE /api/data-management/datasets/:id - Delete dataset',
          upload: 'POST /api/data-management/datasets/:id/upload - Upload CSV file',
          entries: 'GET /api/data-management/datasets/:id/entries - Get dataset entries',
          stats: 'GET /api/data-management/datasets/:id/stats - Dataset statistics',
          validate: 'POST /api/data-management/datasets/:id/validate-file - Validate file format',
          export: 'GET /api/data-management/datasets/:id/export - Export dataset',
          import_nro: 'POST /api/data-management/import/nro-targets - Import NRO targets',
          health: 'GET /api/data-management/health - Service health check',
          test: 'GET /api/data-management/test - Service test endpoint'
        }
      },
      dataset_search: {
        name: 'Dataset Search Service',
        description: 'Dataset search with SSE streaming and dual Linkup API processing',
        endpoints: {
          stream_search: 'POST /api/dataset-search/stream - Start streaming search',
          cancel_search: 'DELETE /api/dataset-search/stream/:execution_id - Cancel search',
          search_status: 'GET /api/dataset-search/stream/:execution_id/status - Get search status',
          nro_stats: 'GET /api/dataset-search/nro-stats - Get NRO statistics',
          health: 'GET /api/dataset-search/health - Service health check',
          test: 'GET /api/dataset-search/test - Service test endpoint'
        }
      },
      email_service: {
        name: 'Demo Email Service',
        description: 'Demo request email service with Gmail SMTP integration',
        endpoints: {
          demo_request: 'POST /api/demo-request - Send demo request email',
          test_email: 'GET /api/test-email - Test email service connection'
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
        dataset_matching: 3003,
        data_management: 3006,
        dataset_search: 3004,
        email_service: 3001
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ChainReactions Unified API Gateway - All Services Integrated');
    console.log(`📡 Server running on port ${PORT} (0.0.0.0)`);
    console.log(`🔗 API: http://localhost:${PORT}`);
    console.log(`🌐 Network Access: http://0.0.0.0:${PORT}`);
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
    console.log('📊 Data Management Service (Integrated from port 3006):');
    console.log(`    GET  /api/data-management/datasets - List all datasets`);
    console.log(`    POST /api/data-management/datasets - Create new dataset`);
    console.log(`    GET  /api/data-management/datasets/:id - Get dataset details`);
    console.log(`    PUT  /api/data-management/datasets/:id - Update dataset`);
    console.log(`    DELETE /api/data-management/datasets/:id - Delete dataset`);
    console.log(`    POST /api/data-management/datasets/:id/upload - Upload CSV file`);
    console.log(`    GET  /api/data-management/datasets/:id/entries - Get dataset entries`);
    console.log(`    GET  /api/data-management/datasets/:id/stats - Dataset statistics`);
    console.log(`    POST /api/data-management/datasets/:id/validate-file - Validate file format`);
    console.log(`    GET  /api/data-management/datasets/:id/export - Export dataset`);
    console.log(`    POST /api/data-management/import/nro-targets - Import NRO targets`);
    console.log(`    GET  /api/data-management/health - Service health check`);
    console.log(`    GET  /api/data-management/test - Service test endpoint`);
    console.log('');
    console.log('🔍 Dataset Search Service (Integrated from port 3004):');
    console.log(`    POST /api/dataset-search/stream - Start streaming search`);
    console.log(`    DELETE /api/dataset-search/stream/:execution_id - Cancel search`);
    console.log(`    GET  /api/dataset-search/stream/:execution_id/status - Get search status`);
    console.log(`    GET  /api/dataset-search/nro-stats - Get NRO statistics`);
    console.log(`    GET  /api/dataset-search/health - Service health check`);
    console.log(`    GET  /api/dataset-search/test - Service test endpoint`);
    console.log('');
    console.log('📧 Demo Email Service (Integrated from port 3001):');
    console.log(`    POST /api/demo-request - Send demo request email`);
    console.log(`    GET  /api/test-email - Test email service connection`);
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

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('⚠️  GMAIL_USER or GMAIL_APP_PASSWORD not set (required for Demo Email Service)');
    } else {
      console.log('✅ Gmail credentials are configured');
    }

    console.log('');
    console.log('🎉 Port Unification Complete!');
    console.log('   • Entity Relations: port 3000 → port 3000 ✓');
    console.log('   • Entity Search: port 3002 → port 3000 ✓');
    console.log('   • Dataset Matching: port 3003 → port 3000 ✓');
    console.log('   • Data Management: port 3006 → port 3000 ✓');
    console.log('   • Dataset Search: port 3004 → port 3000 ✓');
    console.log('   • Demo Email Service: port 3001 → port 3000 ✓');
    console.log('🌐 Network Binding: 0.0.0.0 (Accepts connections from all interfaces)');
    console.log('✅ Ready to accept requests...');
  });
}

export default app;