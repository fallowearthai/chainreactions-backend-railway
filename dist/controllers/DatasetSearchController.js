"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSearchController = void 0;
const DatasetSearchController_1 = require("../services/dataset-search/controllers/DatasetSearchController");
/**
 * Dataset Search Controller for the unified service
 * This controller wraps the original DatasetSearchController and adapts it for the unified service architecture
 */
class DatasetSearchController {
    constructor() {
        this.originalController = new DatasetSearchController_1.DatasetSearchController();
    }
    /**
     * POST /api/dataset-search/stream
     */
    async streamSearch(req, res, next) {
        try {
            await this.originalController.streamSearch(req, res, next);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to start stream search');
        }
    }
    /**
     * DELETE /api/dataset-search/stream/:execution_id
     */
    async cancelStreamSearch(req, res, next) {
        try {
            await this.originalController.cancelStreamSearch(req, res, next);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to cancel stream search');
        }
    }
    /**
     * GET /api/dataset-search/stream/:execution_id/status
     */
    async getStreamSearchStatus(req, res, next) {
        try {
            await this.originalController.getStreamSearchStatus(req, res, next);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to get stream search status');
        }
    }
    /**
     * GET /api/dataset-search/nro-stats
     */
    async getNROStats(req, res, next) {
        try {
            await this.originalController.getNROStats(req, res, next);
        }
        catch (error) {
            this.handleError(res, error, 'Failed to get NRO stats');
        }
    }
    /**
     * Health check for dataset search service
     */
    async healthCheck(req, res, next) {
        try {
            // Use the original controller's health check method
            await this.originalController.healthCheck(req, res, next);
        }
        catch (error) {
            // If the original health check fails, provide a unified response
            res.status(503).json({
                status: 'unhealthy',
                service: 'dataset-search',
                error: 'Health check failed',
                details: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Test endpoint for dataset search service
     */
    async testDatasetSearch(req, res) {
        try {
            res.json({
                success: true,
                service: 'dataset-search',
                status: 'operational',
                message: 'Dataset Search Service is integrated and operational',
                capabilities: [
                    'SSE streaming search',
                    'Dual Linkup API processing',
                    'Canadian NRO database integration',
                    'Real-time progress tracking',
                    'Search cancellation support'
                ],
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.handleError(res, error, 'Dataset search test failed');
        }
    }
    // Error handling helper
    handleError(res, error, message) {
        console.error(`DatasetSearch Controller Error - ${message}:`, error);
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            error: message,
            service: 'dataset-search',
            details: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
}
exports.DatasetSearchController = DatasetSearchController;
//# sourceMappingURL=DatasetSearchController.js.map