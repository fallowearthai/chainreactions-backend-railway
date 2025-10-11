import { Request, Response } from 'express';
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}
export declare class DataManagementController {
    private supabaseService;
    private csvImportService;
    constructor();
    /**
     * GET /api/datasets
     */
    getDatasets(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/datasets/:id
     */
    getDatasetById(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/datasets
     */
    createDataset(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/datasets/:id
     */
    updateDataset(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/datasets/:id
     */
    deleteDataset(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/datasets/:id/entries
     */
    getDatasetEntries(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/datasets/:id/stats
     */
    getDatasetStats(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/datasets/:id/upload
     */
    uploadFile(req: MulterRequest, res: Response): Promise<void>;
    /**
     * POST /api/import/nro-targets
     */
    importNroTargets(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/datasets/:id/validate-file
     */
    validateFile(req: MulterRequest, res: Response): Promise<void>;
    /**
     * GET /api/datasets/:id/export
     */
    exportDataset(req: Request, res: Response): Promise<void>;
    healthCheck(req: Request, res: Response): Promise<void>;
    private handleError;
}
export {};
//# sourceMappingURL=DataManagementController.d.ts.map