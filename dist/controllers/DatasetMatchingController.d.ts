import { Request, Response, NextFunction } from 'express';
export declare class DatasetMatchingController {
    private datasetMatchingService;
    constructor();
    /**
     * Handle single entity matching
     * POST /api/dataset-matching/match
     */
    handleSingleMatch: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Handle batch entity matching
     * POST /api/dataset-matching/batch
     */
    handleBatchMatch: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Clear matching cache
     * GET /api/dataset-matching/cache/clear
     */
    handleClearCache: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get service statistics
     * GET /api/dataset-matching/stats
     */
    handleGetStats: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Health check with matching service status
     * GET /api/dataset-matching/health
     */
    handleHealthCheck: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Handle cache warmup
     * POST /api/dataset-matching/cache/warmup
     */
    handleCacheWarmup: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Test matching with a sample entity
     * GET /api/dataset-matching/test?entity=entityName
     */
    handleTestMatch: (req: Request, res: Response, next: NextFunction) => void;
    healthCheck(): Promise<{
        status: string;
        configured: boolean;
        details: any;
    }>;
}
//# sourceMappingURL=DatasetMatchingController.d.ts.map