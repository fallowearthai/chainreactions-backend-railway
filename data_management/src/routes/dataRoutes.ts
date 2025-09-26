import { Router } from 'express';
import { DataManagementController } from '@/controllers/DataManagementController';
import { upload, handleUploadError } from '@/middleware/upload';

const router = Router();
const controller = new DataManagementController();

// Dataset Management Routes
router.get('/datasets', controller.getDatasets.bind(controller));
router.post('/datasets', controller.createDataset.bind(controller));
router.get('/datasets/:id', controller.getDatasetById.bind(controller));
router.put('/datasets/:id', controller.updateDataset.bind(controller));
router.delete('/datasets/:id', controller.deleteDataset.bind(controller));

// Dataset Entries Routes
router.get('/datasets/:id/entries', controller.getDatasetEntries.bind(controller));
router.get('/datasets/:id/stats', controller.getDatasetStats.bind(controller));

// File Upload and Import Routes
router.post('/datasets/:id/upload',
  upload.single('file'),
  handleUploadError,
  controller.uploadFile.bind(controller)
);

router.post('/datasets/:id/validate-file',
  upload.single('file'),
  handleUploadError,
  controller.validateFile.bind(controller)
);

router.get('/datasets/:id/export', controller.exportDataset.bind(controller));

// Specialized Import Routes
router.post('/import/nro-targets', controller.importNroTargets.bind(controller));

// Health Check
router.get('/health', controller.healthCheck.bind(controller));

export default router;