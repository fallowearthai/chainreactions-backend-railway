"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartCsvParser = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
/**
 * 智能CSV解析器 - 自动检测和映射各种CSV格式
 * 高优先级字段：organization_name, aliases, countries
 * 支持解析所有可用字段并智能映射到数据库结构
 */
class SmartCsvParser {
    /**
     * 智能解析CSV文件头，自动检测字段映射
     */
    static async detectFieldMapping(filePath) {
        return new Promise((resolve, reject) => {
            const headers = [];
            let headersParsed = false;
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('headers', (csvHeaders) => {
                headers.push(...csvHeaders);
                headersParsed = true;
            })
                .on('data', () => {
                // We only need the headers, so stop after first row
                if (headersParsed) {
                    // Process the headers
                    const result = this.analyzeHeaders(headers);
                    resolve(result);
                }
            })
                .on('error', reject)
                .on('end', () => {
                if (!headersParsed && headers.length > 0) {
                    const result = this.analyzeHeaders(headers);
                    resolve(result);
                }
            });
        });
    }
    /**
     * 分析CSV头部，创建字段映射
     */
    static analyzeHeaders(headers) {
        const mapping = {};
        const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
        // 高优先级字段检测
        const priorityFound = [];
        const priorityMissing = [];
        // 检测高优先级字段
        for (const [targetField, patterns] of Object.entries(this.PRIORITY_FIELD_PATTERNS)) {
            const found = this.findBestMatch(normalizedHeaders, headers, patterns);
            if (found) {
                mapping[found.original] = targetField;
                priorityFound.push(targetField);
            }
            else {
                priorityMissing.push(targetField);
            }
        }
        // 检测其他字段
        for (const [targetField, patterns] of Object.entries(this.FIELD_PATTERNS)) {
            if (!Object.values(mapping).includes(targetField)) {
                const found = this.findBestMatch(normalizedHeaders, headers, patterns);
                if (found) {
                    mapping[found.original] = targetField;
                }
            }
        }
        // 处理未映射的字段 - 保存到metadata
        const unmappedHeaders = headers.filter(h => !mapping[h]);
        unmappedHeaders.forEach(header => {
            mapping[header] = `metadata.${header.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        });
        // 计算置信度
        let confidence = 'low';
        if (priorityFound.length === 3)
            confidence = 'high';
        else if (priorityFound.length >= 2)
            confidence = 'medium';
        return {
            mapping,
            headers,
            confidence,
            priorities: {
                found: priorityFound,
                missing: priorityMissing
            }
        };
    }
    /**
     * 找到最佳字段匹配
     */
    static findBestMatch(normalizedHeaders, originalHeaders, patterns) {
        for (const pattern of patterns) {
            const index = normalizedHeaders.findIndex(h => h === pattern ||
                h.includes(pattern) ||
                pattern.includes(h) ||
                this.calculateSimilarity(h, pattern) > 0.8);
            if (index !== -1) {
                return {
                    normalized: normalizedHeaders[index],
                    original: originalHeaders[index]
                };
            }
        }
        return null;
    }
    /**
     * 计算字符串相似度
     */
    static calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    /**
     * 计算Levenshtein距离
     */
    static levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * 解析CSV行数据并根据映射转换
     */
    static transformRowData(row, mapping) {
        const result = {
            metadata: {}
        };
        for (const [originalField, targetField] of Object.entries(mapping)) {
            const value = row[originalField];
            if (value !== undefined && value !== null && value !== '') {
                if (targetField.startsWith('metadata.')) {
                    const metadataKey = targetField.replace('metadata.', '');
                    result.metadata[metadataKey] = value;
                }
                else {
                    // 处理特殊字段类型
                    result[targetField] = this.processFieldValue(targetField, value);
                }
            }
        }
        return result;
    }
    /**
     * 处理特定字段类型的值
     */
    static processFieldValue(fieldName, value) {
        if (!value || value.trim() === '')
            return undefined;
        const trimmedValue = value.trim();
        switch (fieldName) {
            case 'aliases':
                // 解析别名 - 支持多种分隔符
                return trimmedValue.split(/[;,|]/)
                    .map(alias => alias.trim())
                    .filter(alias => alias.length > 0);
            case 'countries':
                // 解析国家 - 支持多种分隔符
                return trimmedValue.split(/[;,|]/)
                    .map(country => country.trim())
                    .filter(country => country.length > 0);
            case 'first_seen':
            case 'last_seen':
            case 'last_change':
            case 'birth_date':
                // 智能日期解析 - 支持多种格式
                return SmartCsvParser.parseDate(trimmedValue);
            default:
                return trimmedValue;
        }
    }
    /**
     * 智能日期解析 - 支持多种日期格式
     */
    static parseDate(dateStr) {
        if (!dateStr || dateStr.trim() === '')
            return dateStr;
        const trimmed = dateStr.trim();
        // 常见日期格式匹配
        const patterns = [
            // Japanese format: YYYY 年MM 月DD 日 (如 2025 年01 月10 日)
            {
                regex: /^(\d{4}) 年(\d{1,2}) 月(\d{1,2}) 日$/,
                transform: (match) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            },
            // Japanese format: YYYY年MM月DD日 (如 2025年01月10日)
            {
                regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,
                transform: (match) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            },
            // DD.MM.YY 格式 (如 13.07.20)
            {
                regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/,
                transform: (match) => {
                    const day = match[1].padStart(2, '0');
                    const month = match[2].padStart(2, '0');
                    const year = `20${match[3]}`;
                    return `${year}-${month}-${day}`;
                }
            },
            // DD.MM.YYYY 格式 (如 31.07.2024)
            {
                regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
                transform: (match) => {
                    const day = match[1].padStart(2, '0');
                    const month = match[2].padStart(2, '0');
                    const year = match[3];
                    return `${year}-${month}-${day}`;
                }
            },
            // YYYY-MM-DD 格式 (标准ISO格式)
            {
                regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
                transform: (match) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
        ];
        // 尝试匹配已知格式
        for (const pattern of patterns) {
            const match = trimmed.match(pattern.regex);
            if (match) {
                try {
                    const isoDateStr = pattern.transform(match);
                    const date = new Date(isoDateStr);
                    // 验证日期有效性
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
                catch (error) {
                    // 继续尝试下一个格式
                    continue;
                }
            }
        }
        // 尝试直接解析
        try {
            const date = new Date(trimmed);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        catch (error) {
            // 忽略错误
        }
        // 如果所有格式都失败，返回原始字符串
        console.warn(`Unable to parse date: "${dateStr}", keeping as string`);
        return trimmed;
    }
    /**
     * 验证解析结果的质量
     */
    static validateParseResult(data, mapping) {
        const issues = [];
        let validRows = 0;
        const priorityFields = ['organization_name', 'aliases', 'countries'];
        let priorityFieldsFound = 0;
        // 检查优先级字段覆盖率
        for (const field of priorityFields) {
            if (Object.values(mapping).includes(field)) {
                priorityFieldsFound++;
            }
            else {
                issues.push(`Missing high-priority field: ${field}`);
            }
        }
        // 检查数据质量
        data.forEach((row, index) => {
            if (row.organization_name && row.organization_name.trim() !== '') {
                validRows++;
            }
            else {
                issues.push(`Row ${index + 1}: Missing organization name`);
            }
        });
        const priorityFieldCoverage = priorityFieldsFound / priorityFields.length;
        const validRowsPercentage = data.length > 0 ? validRows / data.length : 0;
        let quality;
        if (priorityFieldCoverage === 1 && validRowsPercentage > 0.9)
            quality = 'excellent';
        else if (priorityFieldCoverage >= 0.67 && validRowsPercentage > 0.8)
            quality = 'good';
        else if (priorityFieldCoverage >= 0.33 && validRowsPercentage > 0.6)
            quality = 'fair';
        else
            quality = 'poor';
        return {
            quality,
            stats: {
                totalRows: data.length,
                validRows,
                priorityFieldCoverage,
                issues: issues.slice(0, 10) // 限制问题数量
            }
        };
    }
}
exports.SmartCsvParser = SmartCsvParser;
// 高优先级字段映射规则
SmartCsvParser.PRIORITY_FIELD_PATTERNS = {
    organization_name: [
        'name', 'organization', 'org_name', 'entity_name', 'company', 'institution',
        'organization_name', 'entity', 'target', 'subject', 'title'
    ],
    aliases: [
        'alias', 'aliases', 'also_known_as', 'aka', 'alternative_names', 'other_names',
        'known_alias', 'alternate_names', 'nicknames'
    ],
    countries: [
        'country', 'countries', 'location', 'nation', 'region', 'geography',
        'place', 'origin', 'nationality', 'jurisdiction'
    ]
};
// 通用字段映射规则
SmartCsvParser.FIELD_PATTERNS = {
    external_id: ['id', 'external_id', 'ref_id', 'reference', 'code', 'identifier'],
    schema_type: ['schema', 'type', 'category', 'classification', 'kind'],
    birth_date: ['birth_date', 'established', 'founded', 'created', 'inception'],
    addresses: ['address', 'addresses', 'location_detail', 'physical_address'],
    identifiers: ['identifiers', 'ids', 'reference_numbers', 'codes'],
    sanctions: ['sanctions', 'penalties', 'restrictions', 'measures'],
    phones: ['phone', 'phones', 'telephone', 'contact', 'mobile'],
    emails: ['email', 'emails', 'contact_email', 'e_mail'],
    program_ids: ['program_id', 'program_ids', 'programs', 'schemes'],
    dataset_source: ['dataset', 'source', 'origin', 'data_source'],
    first_seen: ['first_seen', 'first_observed', 'initial_date', 'start_date'],
    last_seen: ['last_seen', 'last_observed', 'final_date', 'end_date'],
    last_change: ['last_change', 'updated', 'modified', 'last_modified']
};
//# sourceMappingURL=SmartCsvParser.js.map