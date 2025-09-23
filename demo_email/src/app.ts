import express from 'express';
import { DemoRequestController } from './controllers/DemoRequestController';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Use different port to avoid conflicts

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

// Create controller instance
const demoRequestController = new DemoRequestController();

// Routes - Demo Request Email Service
app.post('/api/demo-request', (req, res) => demoRequestController.handleDemoRequest(req, res));
app.get('/api/test-email', (req, res) => demoRequestController.testEmailService(req, res));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Demo Request Email Service',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'ChainReactions Demo Request Email Service',
    version: '1.0.0',
    description: 'Standalone email service for processing demo requests',
    endpoints: {
      demoRequest: 'POST /api/demo-request - Send demo request email',
      testEmail: 'GET /api/test-email - Test email service connection',
      health: 'GET /api/health - Health check'
    },
    environmentVariables: {
      required: [
        'GMAIL_USER',
        'GMAIL_APP_PASSWORD'
      ]
    }
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
    console.log(`📧 Demo Request Email Service running on port ${PORT}`);
    console.log(`🌐 API Base: http://localhost:${PORT}/api`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`✉️  Demo request endpoint: http://localhost:${PORT}/api/demo-request`);
    console.log(`🧪 Test email: http://localhost:${PORT}/api/test-email`);

    // Check if environment variables are set
    if (!process.env.GMAIL_USER) {
      console.warn('⚠️  GMAIL_USER environment variable is not set');
    }
    if (!process.env.GMAIL_APP_PASSWORD) {
      console.warn('⚠️  GMAIL_APP_PASSWORD environment variable is not set');
    }

    console.log('📝 To configure Gmail:');
    console.log('   1. Enable 2-Factor Authentication on your Gmail account');
    console.log('   2. Generate an App Password: https://myaccount.google.com/apppasswords');
    console.log('   3. Set environment variables:');
    console.log('      GMAIL_USER=your-gmail@gmail.com');
    console.log('      GMAIL_APP_PASSWORD=your-app-password');
  });
}

export default app;