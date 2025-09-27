import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EntitySearchController } from './controllers/EntitySearchController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com'] // Replace with actual frontend domain
    : ['http://localhost:8080'], // Fixed frontend port
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize controllers
const entitySearchController = new EntitySearchController();

// Routes
app.get('/api', (req, res) => {
  res.json({
    service: 'Entity Search Service',
    version: '1.0.0',
    description: 'ChainReactions Entity Search Service with Linkup API Integration',
    endpoints: [
      'POST /api/entity-search',
      'GET /api/test-linkup',
      'GET /api/health',
      'GET /api'
    ],
    status: 'running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Entity Search Service',
    version: '1.0.0'
  });
});

app.post('/api/entity-search', (req, res) => entitySearchController.handleEntitySearch(req, res));
app.get('/api/test-linkup', (req, res) => entitySearchController.testLinkupConnection(req, res));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Environment variable validation
const requiredEnvVars = ['LINKUP_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('   Service may not function properly without proper configuration.');
}

app.listen(PORT, () => {
  console.log(`🚀 Entity Search Service running on port ${PORT}`);
  console.log(`📋 Service endpoints:`);
  console.log(`   • GET  /api - Service information`);
  console.log(`   • GET  /api/health - Health check`);
  console.log(`   • POST /api/entity-search - Entity search`);
  console.log(`   • GET  /api/test-linkup - Test Linkup API connection`);
  console.log(`🔗 Linkup API configured: ${process.env.LINKUP_API_KEY ? '✅' : '❌'}`);
});

export default app;