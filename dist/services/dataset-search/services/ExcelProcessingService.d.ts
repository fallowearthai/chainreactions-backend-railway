export interface ExcelData {
    data: any[][];
    headers: string[];
    rowCount: number;
    columnCount: number;
    fileName: string;
}
export interface ProcessedExcelData {
    base64Content: string;
    metadata: {
        fileName: string;
        fileSize: number;
        rowCount: number;
        columnCount: number;
        headers: string[];
        preview: any[][];
    };
}
export declare class ExcelProcessingService {
    private maxPreviewRows;
    private supportedFormats;
    /**
     * 处理上传的Excel文件
     */
    processUploadedFile(file: Express.Multer.File): Promise<ProcessedExcelData>;
    /**
     * 从Base64解析Excel数据（用于预览或验证）
     */
    parseBase64Excel(base64Content: string, fileName: string): ExcelData;
    /**
     * 验证Excel文件内容是否适合搜索
     */
    validateExcelForSearch(excelData: ExcelData): {
        isValid: boolean;
        warnings: string[];
        recommendations: string[];
    };
    /**
     * 从Excel数据中提取关键词建议
     */
    extractKeywordSuggestions(excelData: ExcelData, maxKeywords?: number): string[];
    /**
     * 解析Excel文件的私有方法
     */
    private parseExcelFile;
    /**
     * 验证文件格式
     */
    private validateFileFormat;
    /**
     * 从文本中提取有意义的词汇
     */
    private extractMeaningfulWords;
}
//# sourceMappingURL=ExcelProcessingService.d.ts.map