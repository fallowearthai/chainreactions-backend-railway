/**
 * 智能CSV解析器 - 自动检测和映射各种CSV格式
 * 高优先级字段：organization_name, aliases, countries
 * 支持解析所有可用字段并智能映射到数据库结构
 */
export declare class SmartCsvParser {
    private static readonly PRIORITY_FIELD_PATTERNS;
    private static readonly FIELD_PATTERNS;
    /**
     * 智能解析CSV文件头，自动检测字段映射
     */
    static detectFieldMapping(filePath: string): Promise<{
        mapping: Record<string, string>;
        headers: string[];
        confidence: 'high' | 'medium' | 'low';
        priorities: {
            found: string[];
            missing: string[];
        };
    }>;
    /**
     * 分析CSV头部，创建字段映射
     */
    private static analyzeHeaders;
    /**
     * 找到最佳字段匹配
     */
    private static findBestMatch;
    /**
     * 计算字符串相似度
     */
    private static calculateSimilarity;
    /**
     * 计算Levenshtein距离
     */
    private static levenshteinDistance;
    /**
     * 解析CSV行数据并根据映射转换
     */
    static transformRowData(row: any, mapping: Record<string, string>): any;
    /**
     * 处理特定字段类型的值
     */
    private static processFieldValue;
    /**
     * 智能日期解析 - 支持多种日期格式
     */
    private static parseDate;
    /**
     * 验证解析结果的质量
     */
    static validateParseResult(data: any[], mapping: Record<string, string>): {
        quality: 'excellent' | 'good' | 'fair' | 'poor';
        stats: {
            totalRows: number;
            validRows: number;
            priorityFieldCoverage: number;
            issues: string[];
        };
    };
}
//# sourceMappingURL=SmartCsvParser.d.ts.map