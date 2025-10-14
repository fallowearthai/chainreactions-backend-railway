import { Request, Response, NextFunction } from 'express';
import { DatasetSearchController as OriginalController } from '../services/dataset-search/controllers/DatasetSearchController';
import path from 'path';

/**
 * Dataset Search Controller for the unified service
 * This controller wraps the original DatasetSearchController and adapts it for the unified service architecture
 */
export class DatasetSearchController {
  private originalController: OriginalController;

  constructor() {
    this.originalController = new OriginalController();
  }

  /**
   * POST /api/dataset-search/stream
   */
  async streamSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.originalController.streamSearch(req, res, next);
    } catch (error) {
      this.handleError(res, error, 'Failed to start stream search');
    }
  }

  /**
   * DELETE /api/dataset-search/stream/:execution_id
   */
  async cancelStreamSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.originalController.cancelStreamSearch(req, res, next);
    } catch (error) {
      this.handleError(res, error, 'Failed to cancel stream search');
    }
  }

  /**
   * GET /api/dataset-search/stream/:execution_id/status
   */
  async getStreamSearchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.originalController.getStreamSearchStatus(req, res, next);
    } catch (error) {
      this.handleError(res, error, 'Failed to get stream search status');
    }
  }

  /**
   * GET /api/dataset-search/nro-stats
   */
  async getNROStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.originalController.getNROStats(req, res, next);
    } catch (error) {
      this.handleError(res, error, 'Failed to get NRO stats');
    }
  }

  /**
   * Health check for dataset search service
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Use the original controller's health check method
      await this.originalController.healthCheck(req, res, next);
    } catch (error) {
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
  async testDatasetSearch(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.handleError(res, error, 'Dataset search test failed');
    }
  }

  // Error handling helper
  private handleError(res: Response, error: unknown, message: string): void {
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