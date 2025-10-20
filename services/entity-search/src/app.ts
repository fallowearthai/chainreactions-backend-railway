import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EntitySearchController } from './controllers/EntitySearchController';

// Load environment variables
dotenv.config();

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

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Create controller instance
const entitySearchController = new EntitySearchController();

// Routes
app.post('/api/entity-search', (req, res, next) =>
  entitySearchController.handleEntitySearch(req, res, next)
);

app.post('/api/entity-search-enhanced', (req, res, next) =>
  entitySearchController.handleEnhancedEntitySearchWithDatasetMatching(req, res, next)
);

app.get('/api/health', (req, res) =>
  entitySearchController.healthCheck(req, res)
);

app.get('/api/info', (req, res) =>
  entitySearchController.getInfo(req, res)
);

app.get('/api/enhanced-info', (req, res) =>
  entitySearchController.getEnhancedInfo(req, res)
);

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'Enhanced Entity Search Service',
    version: '2.0.0',
    status: 'operational',
    description: 'Google Search via Gemini API for comprehensive entity intelligence with automatic risk analysis',
    features: {
      basic_search: 'Company information, headquarters, sectors, description',
      risk_analysis: '8 automatic risk keyword checks',
      multi_language: 'Automatic language detection based on location'
    },
    endpoints: {
      search: 'POST /api/entity-search - Enhanced entity search with risk analysis',
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
    console.log('🚀 Enhanced Entity Search Service Started');
    console.log(`📡 Server running on port ${PORT} (0.0.0.0)`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 Info: http://localhost:${PORT}/api/info`);
    console.log(`🔍 Search: POST http://localhost:${PORT}/api/entity-search`);
    console.log('');
    console.log('📋 Configuration:');
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not set'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    console.log('✨ Features:');
    console.log('   • Basic company information search');
    console.log('   • 8 automatic risk keyword analysis');
    console.log('   • Multi-language search support');
    console.log('   • Severity assessment (high/medium/low/none)');
    console.log('');
    console.log('✅ Ready to accept requests...');
  });
}

export default app;
