import express, { Application } from 'express';
import dotenv from 'dotenv';
import { NormalSearchController } from './controllers/NormalSearchController';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());

// CORS configuration - allow frontend access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Initialize controller
const normalSearchController = new NormalSearchController();

// Routes
app.post('/api/normal-search', (req, res) => normalSearchController.handleNormalSearch(req, res));
app.get('/api/health', (req, res) => normalSearchController.healthCheck(req, res));
app.get('/api/info', (req, res) => normalSearchController.getInfo(req, res));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Entity Relations Normal Search Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      search: 'POST /api/normal-search',
      health: 'GET /api/health',
      info: 'GET /api/info'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Entity Relations Normal Search Service');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`ℹ️  Info: http://localhost:${PORT}/api/info`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /api/normal-search - Execute normal search');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/info - Service information');
  console.log('');
  console.log('🔍 Search method: Google Web Search via Gemini API');
  console.log('✅ Ready to accept requests...');
});

export default app;
