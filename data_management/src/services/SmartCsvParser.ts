import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

/**
 * 智能CSV解析器 - 自动检测和映射各种CSV格式
 * 高优先级字段：organization_name, aliases, countries
 * 支持解析所有可用字段并智能映射到数据库结构
 */
export class SmartCsvParser {
  // 高优先级字段映射规则
  private static readonly PRIORITY_FIELD_PATTERNS = {
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
  private static readonly FIELD_PATTERNS = {
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

  /**
   * 智能解析CSV文件头，自动检测字段映射
   */
  static async detectFieldMapping(filePath: string): Promise<{
    mapping: Record<string, string>;
    headers: string[];
    confidence: 'high' | 'medium' | 'low';
    priorities: { found: string[]; missing: string[] };
  }> {
    return new Promise((resolve, reject) => {
      const headers: string[] = [];
      let headersParsed = false;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (csvHeaders: string[]) => {
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
  private static analyzeHeaders(headers: string[]): {
    mapping: Record<string, string>;
    headers: string[];
    confidence: 'high' | 'medium' | 'low';
    priorities: { found: string[]; missing: string[] };
  } {
    const mapping: Record<string, string> = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));

    // 高优先级字段检测
    const priorityFound: string[] = [];
    const priorityMissing: string[] = [];

    // 检测高优先级字段
    for (const [targetField, patterns] of Object.entries(this.PRIORITY_FIELD_PATTERNS)) {
      const found = this.findBestMatch(normalizedHeaders, headers, patterns);
      if (found) {
        mapping[found.original] = targetField;
        priorityFound.push(targetField);
      } else {
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
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (priorityFound.length === 3) confidence = 'high';
    else if (priorityFound.length >= 2) confidence = 'medium';

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
  private static findBestMatch(
    normalizedHeaders: string[],
    originalHeaders: string[],
    patterns: string[]
  ): { normalized: string; original: string } | null {
    for (const pattern of patterns) {
      const index = normalizedHeaders.findIndex(h =>
        h === pattern ||
        h.includes(pattern) ||
        pattern.includes(h) ||
        this.calculateSimilarity(h, pattern) > 0.8
      );

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
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算Levenshtein距离
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 解析CSV行数据并根据映射转换
   */
  static transformRowData(row: any, mapping: Record<string, string>): any {
    const result: any = {
      metadata: {}
    };

    for (const [originalField, targetField] of Object.entries(mapping)) {
      const value = row[originalField];

      if (value !== undefined && value !== null && value !== '') {
        if (targetField.startsWith('metadata.')) {
          const metadataKey = targetField.replace('metadata.', '');
          result.metadata[metadataKey] = value;
        } else {
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
  private static processFieldValue(fieldName: string, value: string): any {
    if (!value || value.trim() === '') return undefined;

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
        // 尝试解析日期
        const date = new Date(trimmedValue);
        return isNaN(date.getTime()) ? trimmedValue : date;

      default:
        return trimmedValue;
    }
  }

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
  } {
    const issues: string[] = [];
    let validRows = 0;
    const priorityFields = ['organization_name', 'aliases', 'countries'];
    let priorityFieldsFound = 0;

    // 检查优先级字段覆盖率
    for (const field of priorityFields) {
      if (Object.values(mapping).includes(field)) {
        priorityFieldsFound++;
      } else {
        issues.push(`Missing high-priority field: ${field}`);
      }
    }

    // 检查数据质量
    data.forEach((row, index) => {
      if (row.organization_name && row.organization_name.trim() !== '') {
        validRows++;
      } else {
        issues.push(`Row ${index + 1}: Missing organization name`);
      }
    });

    const priorityFieldCoverage = priorityFieldsFound / priorityFields.length;
    const validRowsPercentage = data.length > 0 ? validRows / data.length : 0;

    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (priorityFieldCoverage === 1 && validRowsPercentage > 0.9) quality = 'excellent';
    else if (priorityFieldCoverage >= 0.67 && validRowsPercentage > 0.8) quality = 'good';
    else if (priorityFieldCoverage >= 0.33 && validRowsPercentage > 0.6) quality = 'fair';
    else quality = 'poor';

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