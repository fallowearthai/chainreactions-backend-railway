import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { EnhancedSearchController } from './controllers/EnhancedSearchController';
import { NormalSearchController } from './controllers/NormalSearchController';
import { FeatureFlags } from './utils/FeatureFlags';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize controllers
const enhancedSearchController = new EnhancedSearchController();
const normalSearchController = new NormalSearchController();

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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const featureFlags = FeatureFlags.getFeatureFlagStatus();

  res.status(200).json({
    status: 'healthy',
    service: 'entity-relations',
    version: '2.0.0', // Updated to reflect enhanced grounding
    port: PORT,
    timestamp: new Date().toISOString(),
    features: [
      'DeepThinking 3-Stage OSINT workflow',
      'Normal Search mode',
      'Enhanced Grounding mode',
      'Gemini AI integration',
      'Bright Data SERP integration',
      'Multi-engine search support',
      'SSE streaming support',
      'Grounding metadata extraction',
      'Evidence-to-source mapping'
    ],
    grounding: featureFlags.enhanced_grounding,
    endpoints: {
      enhanced_search: 'POST /api/enhanced/search',
      enhanced_search_stream: 'GET /api/enhanced/search-stream',
      enhanced_strategy: 'POST /api/enhanced/strategy',
      enhanced_test: 'POST /api/enhanced/test',
      enhanced_info: 'GET /api/enhanced/info',
      normal_search: 'POST /api/normal-search',
      normal_health: 'GET /api/normal/health',
      normal_info: 'GET /api/normal/info',
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

// Enhanced Search (DeepThinking) endpoints
app.post('/api/enhanced/search', enhancedSearchController.enhancedSearch.bind(enhancedSearchController));
app.get('/api/enhanced/search-stream', enhancedSearchController.enhancedSearchStream.bind(enhancedSearchController));
app.post('/api/enhanced/strategy', enhancedSearchController.getSearchStrategy.bind(enhancedSearchController));
app.post('/api/enhanced/test', enhancedSearchController.testWorkflow.bind(enhancedSearchController));
app.get('/api/enhanced/info', enhancedSearchController.getWorkflowInfo.bind(enhancedSearchController));

// Normal Search endpoints
app.post('/api/normal-search', normalSearchController.handleNormalSearch.bind(normalSearchController));
app.get('/api/normal/health', normalSearchController.healthCheck.bind(normalSearchController));
app.get('/api/normal/info', normalSearchController.getInfo.bind(normalSearchController));

// Service information endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    service: 'Entity Relations Service',
    description: 'DeepThinking 3-Stage OSINT workflow and Normal Search mode for entity relationship analysis',
    version: '1.0.0',
    port: PORT,
    modes: {
      enhanced: {
        name: 'DeepThinking 3-Stage OSINT',
        description: 'Advanced AI-powered relationship analysis with multi-stage processing',
        features: [
          'WebSearch meta-prompting',
          'Multi-engine SERP execution',
          'AI result integration and analysis',
          'SSE streaming support'
        ]
      },
      normal: {
        name: 'Normal Search Mode',
        description: 'Fast Google Web Search based OSINT analysis',
        features: [
          'Direct Gemini Google Search integration',
          'Multi-language support',
          'Time-range filtering',
          'Quick results'
        ]
      }
    },
    documentation: {
      enhanced_endpoints: {
        search: 'POST /api/enhanced/search - Full 3-stage analysis',
        stream: 'GET /api/enhanced/search-stream - SSE streaming analysis',
        strategy: 'POST /api/enhanced/strategy - Generate search strategy only',
        test: 'POST /api/enhanced/test - Test workflow with sample data',
        info: 'GET /api/enhanced/info - Workflow information'
      },
      normal_endpoints: {
        search: 'POST /api/normal-search - Quick entity search',
        health: 'GET /api/normal/health - Service health check',
        info: 'GET /api/normal/info - Service information'
      }
    },
    integrations: [
      'Google Gemini 2.5 Flash AI',
      'Bright Data SERP API',
      'Multi-engine search (Google, Baidu, Yandex)'
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
      'POST /api/enhanced/search',
      'GET /api/enhanced/search-stream',
      'POST /api/enhanced/strategy',
      'POST /api/enhanced/test',
      'GET /api/enhanced/info',
      'POST /api/normal-search',
      'GET /api/normal/health',
      'GET /api/normal/info'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Entity Relations Service started on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   Health: GET /api/health`);
  console.log(`   Info: GET /api`);
  console.log(`   Enhanced Search: POST /api/enhanced/search`);
  console.log(`   Enhanced Stream: GET /api/enhanced/search-stream`);
  console.log(`   Normal Search: POST /api/normal-search`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${process.env.NODE_ENV === 'production' ? 'Production domains' : 'Local development'}`);
});

export default app;