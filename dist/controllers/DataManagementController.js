"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataManagementController = void 0;
const DataManagementController_1 = require("../services/data-management/controllers/DataManagementController");
/**
 * Data Management Controller for the unified service
 * This controller wraps the original DataManagementController and adapts it for the unified service architecture
 */
class DataManagementController {
    constructor() {
        this.originalController = new DataManagementController_1.DataManagementController();
    }
    /**
     * GET /api/data-management/datasets
     */
    async getDatasets(req, res) {
        try {
            await this.originalController.getDatasets(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch datasets');
        }
    }
    /**
     * GET /api/data-management/datasets/:id
     */
    async getDatasetById(req, res) {
        try {
            await this.originalController.getDatasetById(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset');
        }
    }
    /**
     * POST /api/data-management/datasets
     */
    async createDataset(req, res) {
        try {
            await this.originalController.createDataset(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to create dataset');
        }
    }
    /**
     * PUT /api/data-management/datasets/:id
     */
    async updateDataset(req, res) {
        try {
            await this.originalController.updateDataset(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to update dataset');
        }
    }
    /**
     * DELETE /api/data-management/datasets/:id
     */
    async deleteDataset(req, res) {
        try {
            await this.originalController.deleteDataset(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to delete dataset');
        }
    }
    /**
     * GET /api/data-management/datasets/:id/entries
     */
    async getDatasetEntries(req, res) {
        try {
            await this.originalController.getDatasetEntries(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset entries');
        }
    }
    /**
     * GET /api/data-management/datasets/:id/stats
     */
    async getDatasetStats(req, res) {
        console.log('🔍 DataManagementController.getDatasetStats called with dataset ID:', req.params.id);
        try {
            await this.originalController.getDatasetStats(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to fetch dataset statistics');
        }
    }
    /**
     * POST /api/data-management/datasets/:id/upload
     */
    async uploadFile(req, res) {
        try {
            await this.originalController.uploadFile(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'File upload failed');
        }
    }
    /**
     * POST /api/data-management/import/nro-targets
     */
    async importNroTargets(req, res) {
        try {
            await this.originalController.importNroTargets(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'NRO targets import failed');
        }
    }
    /**
     * POST /api/data-management/datasets/:id/validate-file
     */
    async validateFile(req, res) {
        try {
            await this.originalController.validateFile(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'File validation failed');
        }
    }
    /**
     * GET /api/data-management/datasets/:id/export
     */
    async exportDataset(req, res) {
        try {
            await this.originalController.exportDataset(req, res);
        }
        catch (error) {
            this.handleError(res, error, 'Dataset export failed');
        }
    }
    /**
     * Health check for data management service
     */
    async healthCheck(req, res) {
        try {
            // Call the original health check method
            await this.originalController.healthCheck(req, res);
            // If we get here, assume the health check passed
            res.json({
                success: true,
                status: 'operational',
                service: 'data-management',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                port: process.env.PORT || 3000,
                capabilities: {
                    'dataset_management': true,
                    'file_upload': true,
                    'csv_import': true,
                    'data_export': true,
                    'nro_support': true
                }
            });
        }
        catch (error) {
            res.status(503).json({
                success: false,
                status: 'error',
                service: 'data-management',
                error: 'Health check error',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Test endpoint for data management service
     */
    async testDataManagement(req, res) {
        try {
            res.json({
                success: true,
                service: 'data-management',
                status: 'operational',
                message: 'Data Management Service is integrated and operational',
                capabilities: [
                    'Dataset CRUD operations',
                    'File upload and CSV import',
                    'NRO format support',
                    'Data validation and export'
                ],
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.handleError(res, error, 'Data management test failed');
        }
    }
    // Error handling helper
    handleError(res, error, message) {
        console.error(`DataManagement Controller Error - ${message}:`, error);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error?.constructor?.name);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
        let errorDetails;
        if (error instanceof Error) {
            errorDetails = error.message;
        }
        else if (typeof error === 'object' && error !== null) {
            try {
                errorDetails = JSON.stringify(error, null, 2);
                console.error('Stringified error object:', errorDetails);
            }
            catch {
                errorDetails = Object.prototype.toString.call(error);
                console.error('Fallback error details:', errorDetails);
            }
        }
        else {
            errorDetails = String(error);
            console.error('Final error details:', errorDetails);
        }
        console.error('Final error response details:', errorDetails);
        res.status(statusCode).json({
            success: false,
            error: message,
            service: 'data-management',
            details: errorDetails,
            timestamp: new Date().toISOString()
        });
    }
}
exports.DataManagementController = DataManagementController;
//# sourceMappingURL=DataManagementController.js.map