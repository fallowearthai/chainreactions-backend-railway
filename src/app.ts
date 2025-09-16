import express from 'express';
import { SearchController } from './controllers/SearchController';
import { MetaController } from './controllers/MetaController';
import { MultiSearchController } from './controllers/MultiSearchController';
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

// Create controller instances
const searchController = new SearchController();
const metaController = new MetaController();
const multiSearchController = new MultiSearchController();

// Routes
// Main search endpoint
app.post('/api/search', searchController.search);

// Health check endpoint
app.get('/api/health', searchController.healthCheck);

// Legacy webhook endpoint (for n8n compatibility)
app.post('/webhook/search', searchController.webhook);

// Meta prompting endpoints
app.post('/api/meta/strategy', (req, res) => metaController.generateStrategy(req, res));
app.get('/api/meta/test', (req, res) => metaController.testMetaPrompt(req, res));

// Multi-search engine endpoints
app.get('/api/multisearch/health', (req, res) => multiSearchController.healthCheck(req, res));
app.post('/api/multisearch/search', (req, res) => multiSearchController.searchMultiple(req, res));
app.get('/api/multisearch/test', (req, res) => multiSearchController.quickTest(req, res));
app.post('/api/multisearch/compare', (req, res) => multiSearchController.compareEngines(req, res));
app.get('/api/multisearch/engines', (req, res) => multiSearchController.testEngineSelection(req, res));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Gemini Search API',
    version: '1.0.0',
    endpoints: {
      search: 'POST /api/search',
      health: 'GET /api/health',
      webhook: 'POST /webhook/search',
      metaStrategy: 'POST /api/meta/strategy',
      metaTest: 'GET /api/meta/test',
      multiSearchHealth: 'GET /api/multisearch/health',
      multiSearch: 'POST /api/multisearch/search',
      multiSearchTest: 'GET /api/multisearch/test',
      multiSearchCompare: 'POST /api/multisearch/compare',
      engineSelection: 'GET /api/multisearch/engines'
    },
    documentation: 'See CLAUDE.md for usage instructions'
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
    console.log(`🚀 Gemini Search API server running on port ${PORT}`);
    console.log(`📖 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Search endpoint: http://localhost:${PORT}/api/search`);
    console.log(`🪝 Legacy webhook: http://localhost:${PORT}/webhook/search`);

    // Check if environment variables are set
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY environment variable is not set');
    }
  });
}

export default app;