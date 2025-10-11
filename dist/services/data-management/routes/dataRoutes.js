"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DataManagementController_1 = require("../controllers/DataManagementController");
const TestUploadController_1 = require("../controllers/TestUploadController");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
const controller = new DataManagementController_1.DataManagementController();
const testController = new TestUploadController_1.TestUploadController();
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
router.post('/datasets/:id/upload', upload_1.upload.single('file'), upload_1.handleUploadError, controller.uploadFile.bind(controller));
router.post('/datasets/:id/validate-file', upload_1.upload.single('file'), upload_1.handleUploadError, controller.validateFile.bind(controller));
router.get('/datasets/:id/export', controller.exportDataset.bind(controller));
// Specialized Import Routes
router.post('/import/nro-targets', controller.importNroTargets.bind(controller));
// Test Smart CSV Upload (bypasses Supabase auth issues)
router.post('/test-upload/:id', upload_1.upload.single('file'), upload_1.handleUploadError, testController.testUploadFile.bind(testController));
// Health Check
router.get('/health', controller.healthCheck.bind(controller));
exports.default = router;
//# sourceMappingURL=dataRoutes.js.map