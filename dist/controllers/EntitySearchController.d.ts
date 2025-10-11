import { Request, Response, NextFunction } from 'express';
export declare class EntitySearchController {
    private linkupService;
    constructor();
    handleEntitySearch(req: Request, res: Response, next?: NextFunction): Promise<void>;
    testLinkupConnection(req: Request, res: Response, next?: NextFunction): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        configured: boolean;
        details: any;
    }>;
}
//# sourceMappingURL=EntitySearchController.d.ts.map