import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EntitySearchController } from './controllers/EntitySearchController';
import { Logger } from './shared/utils/Logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('entity-search');

const app = express();
const PORT = parseInt(process.env.PORT || '3003', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://chainreactions.site',
        'https://chainreactions-frontend-dev.vercel.app',
        'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
        'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
      ]
    : [
        'http://localhost:8080',  // Frontend dev server
        'http://localhost:3000',  // API Gateway
        'http://localhost:4000',  // Main app
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:4001',
        'http://localhost:4002',
        'http://localhost:4003'
      ],
  credentials: true
}));

// Request logging middleware (sanitized)
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      path: logger.sanitizePath(req.path),
      status: res.statusCode,
      duration
    });
  });

  next();
});

// Create controller instance
const entitySearchController = new EntitySearchController();

// Routes
app.post('/api/entity-search', (req, res) =>
  entitySearchController.handleEntitySearch(req, res)
);

app.post('/api/entity-search/analyze-keyword', (req, res) =>
  entitySearchController.analyzeRiskKeyword(req, res)
);

app.get('/api/health', (req, res) =>
  entitySearchController.healthCheck(req, res)
);

app.get('/api/info', (req, res) =>
  entitySearchController.getInfo(req, res)
);

app.post('/api/test-gemini', async (req, res) => {
  try {
    logger.debug('Gemini API test endpoint called');

    const { test_company = "Test Company" } = req.body;

    // Test the Enhanced Entity Search Service directly
    const result = await entitySearchController.testGeminiAPI(test_company);

    logger.debug('Gemini API test completed', {
      success: result.success,
      duration: result.duration
    });

    res.json({
      test_status: 'completed',
      timestamp: new Date().toISOString(),
      test_company,
      ...result
    });

  } catch (error: any) {
    logger.error('Gemini API test failed', error);
    res.status(500).json({
      test_status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'Entity Search Service (Enhanced)',
    version: '4.0.0',
    status: 'operational',
    description: 'Enhanced entity search using Gemini API for comprehensive company information',
    features: {
      basic_search: 'Comprehensive company information via Gemini AI',
      business_intelligence: 'Professional business intelligence gathering',
      risk_analysis: 'Risk keyword analysis for due diligence and compliance',
      simplified_architecture: 'Focused on high-quality company data only'
    },
    endpoints: {
      entity_search: 'POST /api/entity-search - Enhanced entity search',
      risk_analysis: 'POST /api/entity-search/analyze-keyword - Risk keyword analysis',
      health: 'GET /api/health - Health check',
      info: 'GET /api/info - Service information'
    },
    port: PORT
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
  logger.error('Unhandled error', err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Entity Search Service (Enhanced) started on port ${PORT}`, {
      port: PORT,
      host: '0.0.0.0'
    });
    logger.info('Endpoints available: GET /api/health, GET /api/info, POST /api/entity-search, POST /api/entity-search/analyze-keyword');
    logger.info('Features: Comprehensive company information, Business intelligence, Risk keyword analysis, Simplified architecture');
    logger.info('Configuration loaded', {
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      environment: process.env.NODE_ENV || 'development'
    });
    logger.info('Service ready to accept requests');
  });
}

export default app;
