import { Request, Response } from 'express';
export declare class DatasetSearchController {
    private nroService;
    private linkupService;
    private historyService;
    private activeExecutions;
    constructor();
    /**
     * SSE流式搜索 - 新的简化搜索模式
     * POST /api/dataset-search/stream
     */
    streamSearch: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * 处理流式搜索的后台逻辑
     */
    private processStreamSearch;
    /**
     * 取消SSE搜索
     * DELETE /api/dataset-search/stream/:execution_id
     */
    cancelStreamSearch: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * 获取流式搜索状态
     * GET /api/dataset-search/stream/:execution_id/status
     */
    getStreamSearchStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * 获取Canadian NRO统计信息
     * GET /api/dataset-search/nro-stats
     */
    getNROStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Generate detailed timeout error message
     */
    private generateTimeoutMessage;
    /**
     * 健康检查
     * GET /api/health
     */
    healthCheck: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=DatasetSearchController.d.ts.map