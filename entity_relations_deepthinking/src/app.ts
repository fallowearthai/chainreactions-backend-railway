import express from 'express';
import path from 'path';
import { EnhancedSearchController } from './controllers/EnhancedSearchController';
import { NormalSearchController } from './controllers/NormalSearchController';
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
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create controller instances
const enhancedSearchController = new EnhancedSearchController();
const normalSearchController = new NormalSearchController();

// Routes - 3-Stage OSINT Workflow (DeepThinking Mode)
app.post('/api/enhanced/search', (req, res) => enhancedSearchController.enhancedSearch(req, res));
app.get('/api/enhanced/search-stream', (req, res) => enhancedSearchController.enhancedSearchStream(req, res));
app.post('/api/enhanced/strategy', (req, res) => enhancedSearchController.getSearchStrategy(req, res));
app.get('/api/enhanced/test', (req, res) => enhancedSearchController.testWorkflow(req, res));
app.get('/api/enhanced/info', (req, res) => enhancedSearchController.getWorkflowInfo(req, res));

// Routes - Normal Search (Google Web Search Mode)
app.post('/api/normal-search', (req, res) => normalSearchController.handleNormalSearch(req, res));
app.get('/api/normal-search/info', (req, res) => normalSearchController.getInfo(req, res));

// Health check endpoint - Combined service
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Entity Relations OSINT Service',
    version: '2.0.0',
    modes: {
      deepthinking: '3-Stage OSINT Workflow (Gemini + Bright Data SERP)',
      normal: 'Google Web Search based OSINT (Gemini googleSearch)'
    },
    endpoints: {
      deepthinking: '/api/enhanced/search',
      normal: '/api/normal-search'
    }
  });
});

// Root endpoint - serve the frontend interface
app.get('/api', (req, res) => {
  res.json({
    message: 'Entity Relations OSINT Service - Dual Mode',
    version: '2.0.0',
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
    },
    common_endpoints: {
      health: 'GET /api/health - Health check'
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
    console.log('🚀 Entity Relations OSINT Service - Dual Mode');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('🔬 DeepThinking Mode (3-Stage Workflow):');
    console.log(`  POST /api/enhanced/search - Complete 3-stage workflow`);
    console.log(`  POST /api/enhanced/strategy - Stage 1 only (meta-prompting)`);
    console.log(`  GET  /api/enhanced/test - Test with sample data`);
    console.log(`  GET  /api/enhanced/info - Workflow information`);
    console.log('');
    console.log('⚡ Normal Mode (Google Web Search):');
    console.log(`  POST /api/normal-search - Execute normal search`);
    console.log(`  GET  /api/normal-search/info - Service information`);
    console.log('');

    // Check if environment variables are set
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY environment variable is not set');
    }
    if (!process.env.BRIGHT_DATA_API_KEY) {
      console.warn('⚠️  BRIGHT_DATA_API_KEY environment variable is not set (required for DeepThinking mode)');
    }

    console.log('✅ Ready to accept requests...');
  });
}

export default app;