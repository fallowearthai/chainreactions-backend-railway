import { Request, Response } from 'express';
export declare class NormalSearchController {
    private geminiService;
    constructor();
    /**
     * Format search results to match N8N output format
     */
    private formatSearchResults;
    /**
     * Handle normal search request
     * POST /api/normal-search
     */
    handleNormalSearch(req: Request, res: Response): Promise<void>;
    /**
     * Health check endpoint
     * GET /api/health
     */
    healthCheck(req: Request, res: Response): Promise<void>;
    /**
     * Get service information
     * GET /api/info
     */
    getInfo(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=NormalSearchController.d.ts.map