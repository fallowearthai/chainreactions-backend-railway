import { Request, Response } from 'express';
export declare class EnhancedSearchController {
    private metaPromptService;
    private serpExecutorService;
    private resultIntegrationService;
    constructor();
    enhancedSearch(req: Request, res: Response): Promise<void>;
    enhancedSearchStream(req: Request, res: Response): Promise<void>;
    getSearchStrategy(req: Request, res: Response): Promise<void>;
    testWorkflow(req: Request, res: Response): Promise<void>;
    private validateSearchRequest;
    /**
     * Validate custom keyword format and content
     */
    private validateCustomKeyword;
    getWorkflowInfo(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=EnhancedSearchController.d.ts.map