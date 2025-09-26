import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import dataRoutes from './routes/dataRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan(process.env.LOG_FORMAT || 'combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads (if needed for testing)
const uploadPath = process.env.UPLOAD_PATH || './uploads';
app.use('/uploads', express.static(uploadPath));

// API routes
app.use(process.env.API_PREFIX || '/api', dataRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ChainReactions Data Management Service',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    endpoints: {
      health: '/api/health',
      datasets: '/api/datasets',
      upload: '/api/datasets/:id/upload',
      import_nro: '/api/import/nro-targets'
    },
    documentation: 'https://github.com/chainreactions/backend/tree/main/data_management'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Data Management Service running on port ${PORT}`);
    console.log(`📁 Upload path: ${uploadPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📋 API documentation: http://localhost:${PORT}/`);
  });
}

export default app;