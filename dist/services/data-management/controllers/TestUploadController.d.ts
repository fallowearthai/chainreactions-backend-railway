import { Request, Response } from 'express';
export declare class TestUploadController {
    /**
     * POST /api/test-upload/:id
     * 测试智能CSV上传功能，直接返回解析结果
     */
    testUploadFile(req: Request, res: Response): Promise<void>;
    /**
     * 解析CSV文件的前几行作为示例
     */
    private parseSampleCsvData;
}
//# sourceMappingURL=TestUploadController.d.ts.map