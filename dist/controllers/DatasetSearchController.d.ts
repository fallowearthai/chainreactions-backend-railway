import { Request, Response, NextFunction } from 'express';
/**
 * Dataset Search Controller for the unified service
 * This controller wraps the original DatasetSearchController and adapts it for the unified service architecture
 */
export declare class DatasetSearchController {
    private originalController;
    constructor();
    /**
     * POST /api/dataset-search/stream
     */
    streamSearch(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/dataset-search/stream/:execution_id
     */
    cancelStreamSearch(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dataset-search/stream/:execution_id/status
     */
    getStreamSearchStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dataset-search/nro-stats
     */
    getNROStats(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Health check for dataset search service
     */
    healthCheck(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Test endpoint for dataset search service
     */
    testDatasetSearch(req: Request, res: Response): Promise<void>;
    private handleError;
}
//# sourceMappingURL=DatasetSearchController.d.ts.map