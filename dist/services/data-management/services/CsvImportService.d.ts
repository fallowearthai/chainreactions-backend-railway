import { ImportResult, ValidationResult } from '../types/DataTypes';
export declare class CsvImportService {
    private static instance;
    private supabaseService;
    private constructor();
    static getInstance(): CsvImportService;
    /**
     * 智能导入CSV文件到指定数据集ID - 自动检测字段格式
     */
    importCsvFileSmartToDataset(filePath: string, datasetId: string): Promise<ImportResult>;
    /**
     * 智能导入CSV文件 - 自动检测字段格式
     */
    importCsvFileSmart(filePath: string, datasetName: string, description?: string, isSystem?: boolean): Promise<ImportResult>;
    /**
     * Import NRO CSV file into Supabase (Legacy method)
     */
    importCsvFile(filePath: string, datasetName: string, description?: string, isSystem?: boolean): Promise<ImportResult>;
    /**
     * Parse CSV file and return rows
     */
    private parseCsvFile;
    /**
     * Process a batch of CSV rows
     */
    private processBatch;
    /**
     * Convert CSV row to DatasetEntry format
     */
    private convertRowToEntry;
    /**
     * Get or create dataset
     */
    private getOrCreateDataset;
    /**
     * Import the targets.simple.csv file specifically
     */
    importNroTargetsFile(filePath?: string): Promise<ImportResult>;
    /**
     * Validate CSV format before import
     */
    validateCsvFormat(filePath: string): Promise<ValidationResult>;
    /**
     * Export dataset to CSV format
     */
    exportDatasetToCsv(datasetId: string, outputPath: string, format?: 'user-friendly' | 'technical'): Promise<boolean>;
    /**
     * Convert entries to user-friendly CSV format (4 columns)
     */
    private convertEntriesToUserFriendlyCsv;
    /**
     * Convert entries to technical CSV format (15 columns)
     */
    private convertEntriesToCsv;
    /**
     * 解析智能CSV文件
     */
    private parseSmartCsvFile;
    /**
     * 处理智能批次数据
     */
    private processSmartBatch;
}
//# sourceMappingURL=CsvImportService.d.ts.map