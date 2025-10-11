import { Request, Response } from 'express';
/**
 * Data Management Controller for the unified service
 * This controller wraps the original DataManagementController and adapts it for the unified service architecture
 */
export declare class DataManagementController {
    private originalController;
    constructor();
    /**
     * GET /api/data-management/datasets
     */
    getDatasets(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/data-management/datasets/:id
     */
    getDatasetById(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/data-management/datasets
     */
    createDataset(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/data-management/datasets/:id
     */
    updateDataset(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/data-management/datasets/:id
     */
    deleteDataset(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/data-management/datasets/:id/entries
     */
    getDatasetEntries(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/data-management/datasets/:id/stats
     */
    getDatasetStats(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/data-management/datasets/:id/upload
     */
    uploadFile(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/data-management/import/nro-targets
     */
    importNroTargets(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/data-management/datasets/:id/validate-file
     */
    validateFile(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/data-management/datasets/:id/export
     */
    exportDataset(req: Request, res: Response): Promise<void>;
    /**
     * Health check for data management service
     */
    healthCheck(req: Request, res: Response): Promise<void>;
    /**
     * Test endpoint for data management service
     */
    testDataManagement(req: Request, res: Response): Promise<void>;
    private handleError;
}
//# sourceMappingURL=DataManagementController.d.ts.map