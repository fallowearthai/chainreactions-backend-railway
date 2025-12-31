import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import compression from 'compression';
import { DataManagementController } from './controllers/DataManagementController';
import { upload } from './middleware/upload';
import { Logger } from './shared/utils/Logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('data-management');

// Initialize Express app
const app = express();
const PORT = parseInt(process.env.PORT || '3005', 10);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const corsOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://chainreactions.site',
      'https://chainreactions-frontend-dev.vercel.app',
      'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
      'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
    ]
  : [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Request logging (sanitized)
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Request received', {
    method: req.method,
    path: logger.sanitizePath(req.path)
  });
  next();
});

// Initialize controller
const dataManagementController = new DataManagementController();

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  dataManagementController.healthCheck(req, res);
});

// Service info endpoint
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    service: 'Data Management Service',
    version: '1.0.0',
    description: 'CSV upload, parsing, and dataset management with Supabase',
    port: PORT,
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/info - Service information',
      'GET /api/data-management/datasets - List all datasets',
      'GET /api/data-management/datasets/:id - Get dataset by ID',
      'POST /api/data-management/datasets - Create new dataset',
      'PUT /api/data-management/datasets/:id - Update dataset',
      'DELETE /api/data-management/datasets/:id - Delete dataset',
      'GET /api/data-management/datasets/:id/entries - Get dataset entries',
      'GET /api/data-management/datasets/:id/stats - Get dataset statistics',
      'POST /api/data-management/datasets/:id/upload - Upload file to dataset',
      'POST /api/data-management/datasets/:id/validate-file - Validate file format',
      'GET /api/data-management/datasets/:id/export - Export dataset to CSV'
    ],
    status: 'operational'
  });
});

// Dataset Management Routes
app.get('/api/data-management/datasets', (req: Request, res: Response) => {
  dataManagementController.getDatasets(req, res);
});

app.get('/api/data-management/datasets/:id', (req: Request, res: Response) => {
  dataManagementController.getDatasetById(req, res);
});

app.post('/api/data-management/datasets', (req: Request, res: Response) => {
  dataManagementController.createDataset(req, res);
});

app.put('/api/data-management/datasets/:id', (req: Request, res: Response) => {
  dataManagementController.updateDataset(req, res);
});

app.delete('/api/data-management/datasets/:id', (req: Request, res: Response) => {
  dataManagementController.deleteDataset(req, res);
});

// Dataset Entries Routes
app.get('/api/data-management/datasets/:id/entries', (req: Request, res: Response) => {
  dataManagementController.getDatasetEntries(req, res);
});

app.get('/api/data-management/datasets/:id/stats', (req: Request, res: Response) => {
  dataManagementController.getDatasetStats(req, res);
});

// File Upload Routes (with multer middleware)
app.post('/api/data-management/datasets/:id/upload', upload.single('file'), (req: Request, res: Response) => {
  dataManagementController.uploadFile(req, res);
});

app.post('/api/data-management/datasets/:id/validate-file', upload.single('file'), (req: Request, res: Response) => {
  dataManagementController.validateFile(req, res);
});

// Dataset Export Route
app.get('/api/data-management/datasets/:id/export', (req: Request, res: Response) => {
  dataManagementController.exportDataset(req, res);
});

// Legacy NRO import endpoint (for backward compatibility)
app.post('/api/data-management/import/nro-targets', (req: Request, res: Response) => {
  dataManagementController.importNroTargets(req, res);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message,
    path: req.path
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Data Management Service started on port ${PORT}`, {
    port: PORT,
    host: '0.0.0.0'
  });
  logger.info('Endpoints available: GET /api/health, GET /api/info, GET /api/data-management/datasets, POST /api/data-management/datasets/:id/upload');
  logger.info('Configuration loaded', {
    supabaseUrl: !!process.env.SUPABASE_URL,
    supabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    environment: process.env.NODE_ENV || 'development'
  });
  logger.info('Service ready to accept requests');

  // Configuration warnings
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    logger.warn('Supabase configuration incomplete. Service may not function properly');
  }
});

export default app;
