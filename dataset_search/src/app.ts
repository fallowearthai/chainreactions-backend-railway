import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { DatasetSearchController } from './controllers/DatasetSearchController';
import { errorHandler, notFoundHandler } from './utils/ErrorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Multer配置用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseSize(process.env.MAX_FILE_SIZE || '10MB'),
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = (process.env.ALLOWED_FILE_EXTENSIONS || '.xlsx,.xls,.csv').split(',');
    const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed extensions: ${allowedExtensions.join(', ')}`));
    }
  }
});

// Helper function to parse size strings
function parseSize(sizeString: string): number {
  const units: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024
  };

  const match = sizeString.match(/^(\d+)(B|KB|MB|GB)$/i);
  if (!match) {
    return 10 * 1024 * 1024; // Default to 10MB
  }

  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase();

  return value * units[unit];
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com'] // Replace with actual frontend domain
    : ['http://localhost:8080'], // Fixed frontend port
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.file) {
    console.log(`  📎 File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
  }
  next();
});

// Initialize controllers
const datasetSearchController = new DatasetSearchController();

// Routes
app.get('/api', (req, res) => {
  res.json({
    service: 'Dataset Search Service',
    version: '1.0.0',
    description: 'ChainReactions Dataset Search Service with N8N Integration',
    endpoints: [
      'POST /api/dataset-search/execute - Execute dataset search',
      'POST /api/dataset-search/upload - Upload and preview Excel file',
      'GET /api/dataset-search/status/:execution_id - Get execution status',
      'GET /api/dataset-search/results/:execution_id - Get execution results',
      'DELETE /api/dataset-search/execution/:execution_id - Cancel execution',
      'POST /api/dataset-search/webhook - N8N webhook callback',
      'GET /api/dataset-search/stats - Service statistics',
      'GET /api/health - Health check'
    ],
    status: 'running',
    n8n_integration: 'enabled'
  });
});

// Health check
app.get('/api/health', datasetSearchController.healthCheck);

// Dataset Search Routes
app.post('/api/dataset-search/execute',
  upload.single('excel_file'), // Optional file upload
  datasetSearchController.executeSearch
);

app.post('/api/dataset-search/upload',
  upload.single('excel_file'), // Required file upload
  datasetSearchController.uploadFile
);

app.get('/api/dataset-search/status/:execution_id',
  datasetSearchController.getExecutionStatus
);

app.get('/api/dataset-search/results/:execution_id',
  datasetSearchController.getExecutionResults
);

app.delete('/api/dataset-search/execution/:execution_id',
  datasetSearchController.cancelExecution
);

app.post('/api/dataset-search/webhook',
  datasetSearchController.handleWebhook
);

app.get('/api/dataset-search/stats',
  datasetSearchController.getServiceStats
);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use(notFoundHandler);

// Environment variable validation
const requiredEnvVars = ['N8N_WEBHOOK_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('   Service may not function properly without proper configuration.');
}

// Periodic cleanup of expired executions
setInterval(() => {
  // This would be handled by the N8nIntegrationService
  // datasetSearchController.cleanupExpiredExecutions();
}, 60 * 60 * 1000); // Every hour

app.listen(PORT, () => {
  console.log(`🚀 Dataset Search Service running on port ${PORT}`);
  console.log(`📋 Service endpoints:`);
  console.log(`   • GET  /api - Service information`);
  console.log(`   • GET  /api/health - Health check`);
  console.log(`   • POST /api/dataset-search/execute - Execute search`);
  console.log(`   • POST /api/dataset-search/upload - Upload file`);
  console.log(`   • GET  /api/dataset-search/status/:id - Execution status`);
  console.log(`   • GET  /api/dataset-search/results/:id - Execution results`);
  console.log(`   • DELETE /api/dataset-search/execution/:id - Cancel execution`);
  console.log(`   • POST /api/dataset-search/webhook - N8N webhook`);
  console.log(`   • GET  /api/dataset-search/stats - Service statistics`);
  console.log(`🔗 N8N Webhook configured: ${process.env.N8N_WEBHOOK_URL ? '✅' : '❌'}`);
  console.log(`📁 File uploads: Max ${process.env.MAX_FILE_SIZE || '10MB'}, Extensions: ${process.env.ALLOWED_FILE_EXTENSIONS || '.xlsx,.xls,.csv'}`);
});

export default app;