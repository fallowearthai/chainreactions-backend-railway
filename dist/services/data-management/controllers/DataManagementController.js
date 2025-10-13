"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataManagementController = void 0;
const SupabaseService_1 = require("../services/SupabaseService");
const CsvImportService_1 = require("../services/CsvImportService");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class DataManagementController {
    constructor() {
        this.supabaseService = SupabaseService_1.SupabaseService.getInstance();
        this.csvImportService = CsvImportService_1.CsvImportService.getInstance();
    }
    // Dataset Management Endpoints
    /**
     * GET /api/datasets
     */
    async getDatasets(req, res) {
        try {
            const { page = '1', limit = '20' } = req.query;
            const result = await this.supabaseService.getDatasets(Number(page), Number(limit));
            const response = {
                success: true,
                data: {
                    datasets: result.datasets,
                    total: result.total,
                    page: Number(page),
                    limit: Number(limit)
                }
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch datasets');
        }
    }
    /**
     * GET /api/datasets/:id
     */
    async getDatasetById(req, res) {
        try {
            const { id } = req.params;
            const dataset = await this.supabaseService.getDatasetById(id);
            if (!dataset) {
                res.status(404).json({
                    success: false,
                    error: 'Dataset not found'
                });
                return;
            }
            const response = {
                success: true,
                data: dataset
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset');
        }
    }
    /**
     * POST /api/datasets
     */
    async createDataset(req, res) {
        try {
            const datasetData = req.body;
            // Validate required fields
            if (!datasetData.name) {
                res.status(400).json({
                    success: false,
                    error: 'Dataset name is required'
                });
                return;
            }
            const dataset = await this.supabaseService.createDataset(datasetData);
            const response = {
                success: true,
                data: dataset,
                message: 'Dataset created successfully'
            };
            res.status(201).json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to create dataset');
        }
    }
    /**
     * PUT /api/datasets/:id
     */
    async updateDataset(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const dataset = await this.supabaseService.updateDataset(id, updates);
            const response = {
                success: true,
                data: dataset,
                message: 'Dataset updated successfully'
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to update dataset');
        }
    }
    /**
     * DELETE /api/datasets/:id
     */
    async deleteDataset(req, res) {
        try {
            const { id } = req.params;
            await this.supabaseService.deleteDataset(id);
            const response = {
                success: true,
                message: 'Dataset deleted successfully'
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to delete dataset');
        }
    }
    /**
     * GET /api/datasets/:id/entries
     */
    async getDatasetEntries(req, res) {
        try {
            const { id } = req.params;
            const { page = '1', limit = '50', search } = req.query;
            let result;
            if (search) {
                result = await this.supabaseService.searchDatasetEntries(id, search, Number(page), Number(limit));
            }
            else {
                result = await this.supabaseService.getDatasetEntries(id, Number(page), Number(limit));
            }
            // Get dataset info
            const dataset = await this.supabaseService.getDatasetById(id);
            const response = {
                success: true,
                data: {
                    entries: result.entries,
                    total: result.total,
                    page: Number(page),
                    limit: Number(limit),
                    dataset_info: dataset ? {
                        id: dataset.id,
                        name: dataset.name,
                        description: dataset.description
                    } : null
                }
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset entries');
        }
    }
    /**
     * GET /api/datasets/:id/stats
     */
    async getDatasetStats(req, res) {
        try {
            const { id } = req.params;
            const stats = await this.supabaseService.getDatasetStats(id);
            const response = {
                success: true,
                data: stats
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset statistics');
        }
    }
    // File Upload and Import Endpoints
    /**
     * POST /api/datasets/:id/upload
     */
    async uploadFile(req, res) {
        try {
            const { id } = req.params;
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
                return;
            }
            const file = req.file;
            // Processing uploaded file
            // Validate file type
            const allowedExtensions = ['.csv', '.xml', '.json', '.js'];
            const fileExtension = path.extname(file.originalname).toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                res.status(400).json({
                    success: false,
                    error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
                });
                return;
            }
            // Get the existing dataset information
            const dataset = await this.supabaseService.getDatasetById(id);
            if (!dataset) {
                res.status(404).json({
                    success: false,
                    error: `Dataset with id ${id} not found`
                });
                return;
            }
            let importResult;
            // Process based on file type
            if (fileExtension === '.csv') {
                importResult = await this.csvImportService.importCsvFileSmartToDataset(file.path, id // Use the actual dataset ID from URL params
                );
            }
            else {
                // For XML/JSON files, use existing processing logic
                // This would need to be implemented based on the frontend logic
                res.status(400).json({
                    success: false,
                    error: 'XML/JSON processing not yet implemented in backend'
                });
                return;
            }
            // Clean up uploaded file
            try {
                fs.unlinkSync(file.path);
            }
            catch (cleanupError) {
                console.warn('Failed to cleanup uploaded file:', cleanupError);
            }
            const response = {
                success: importResult.success,
                data: importResult,
                message: importResult.success ?
                    `Successfully imported ${importResult.importedRows}/${importResult.totalRows} entries` :
                    'Import failed'
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'File upload failed');
        }
    }
    /**
     * POST /api/import/nro-targets
     */
    async importNroTargets(req, res) {
        try {
            console.log('🚀 importNroTargets called!', {
                method: req.method,
                path: req.path,
                body: req.body,
                headers: req.headers
            });
            const { file_path } = req.body;
            const filePath = file_path || '/Users/kanbei/Code/chainreactions_backend/targets.simple.csv';
            console.log(`📁 Importing NRO targets from: ${filePath}`);
            // Send immediate response to avoid timeout
            res.json({
                success: true,
                message: 'NRO import started successfully',
                filePath: filePath,
                status: 'processing'
            });
            // Process import in background
            this.csvImportService.importNroTargetsFile(filePath)
                .then((importResult) => {
                console.log(`✅ Background import completed: ${importResult.importedRows}/${importResult.totalRows} rows imported`);
            })
                .catch((error) => {
                console.error('❌ Background import failed:', error);
            });
        }
        catch (error) {
            console.error('❌ Error in importNroTargets:', error);
            this.handleError(res, error, 'NRO targets import failed');
        }
    }
    /**
     * POST /api/datasets/:id/validate-file
     */
    async validateFile(req, res) {
        try {
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
                return;
            }
            const file = req.file;
            const fileExtension = path.extname(file.originalname).toLowerCase();
            let validationResult;
            if (fileExtension === '.csv') {
                validationResult = await this.csvImportService.validateCsvFormat(file.path);
            }
            else {
                validationResult = {
                    valid: false,
                    errors: ['Only CSV validation is currently supported'],
                    warnings: []
                };
            }
            // Clean up uploaded file
            try {
                fs.unlinkSync(file.path);
            }
            catch (cleanupError) {
                console.warn('Failed to cleanup validation file:', cleanupError);
            }
            const response = {
                success: validationResult.valid,
                data: validationResult
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error, 'File validation failed');
        }
    }
    /**
     * GET /api/datasets/:id/export
     */
    async exportDataset(req, res) {
        try {
            const { id } = req.params;
            const { format = 'user-friendly' } = req.query;
            // Support both user-friendly and technical formats
            if (!['user-friendly', 'technical', 'csv'].includes(format)) {
                res.status(400).json({
                    success: false,
                    error: 'Format must be "user-friendly" or "technical"'
                });
                return;
            }
            // Normalize 'csv' to 'user-friendly' for backward compatibility
            const csvFormat = format === 'csv' ? 'user-friendly' : format;
            // Get dataset info
            const dataset = await this.supabaseService.getDatasetById(id);
            if (!dataset) {
                res.status(404).json({
                    success: false,
                    error: 'Dataset not found'
                });
                return;
            }
            // Create temporary export file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`;
            const tempPath = path.join(process.env.UPLOAD_PATH || './uploads', filename);
            const success = await this.csvImportService.exportDatasetToCsv(id, tempPath, csvFormat);
            if (!success) {
                res.status(500).json({
                    success: false,
                    error: 'Export failed'
                });
                return;
            }
            // Send file as download
            res.download(tempPath, filename, (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                // Clean up file after download
                try {
                    fs.unlinkSync(tempPath);
                }
                catch (cleanupError) {
                    console.warn('Failed to cleanup export file:', cleanupError);
                }
            });
        }
        catch (error) {
            this.handleError(res, error, 'Dataset export failed');
        }
    }
    // Health Check
    async healthCheck(req, res) {
        try {
            // Test database connection
            await this.supabaseService.getDatasets(1, 1);
            const response = {
                success: true,
                data: {
                    status: 'healthy',
                    service: 'data-management',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            res.json(response);
        }
        catch (error) {
            res.status(503).json({
                success: false,
                error: 'Service unhealthy',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    // Error handling helper
    handleError(res, error, message) {
        console.error(message, error);
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
        let errorDetails;
        if (error instanceof Error) {
            errorDetails = error.message;
        }
        else if (typeof error === 'object' && error !== null) {
            try {
                errorDetails = JSON.stringify(error, null, 2);
            }
            catch {
                errorDetails = Object.prototype.toString.call(error);
            }
        }
        else {
            errorDetails = String(error);
        }
        res.status(statusCode).json({
            success: false,
            error: message,
            details: errorDetails
        });
    }
}
exports.DataManagementController = DataManagementController;
//# sourceMappingURL=DataManagementController.js.map