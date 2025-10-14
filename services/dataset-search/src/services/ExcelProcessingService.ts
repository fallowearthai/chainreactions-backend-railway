import * as XLSX from 'xlsx';
import { DatasetSearchError } from '../types/DatasetSearchTypes';

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
    preview: any[][];  // First few rows for preview
  };
}

export class ExcelProcessingService {
  private maxPreviewRows: number = 10;
  private supportedFormats: string[] = ['.xlsx', '.xls', '.csv'];

  /**
   * 处理上传的Excel文件
   */
  async processUploadedFile(file: Express.Multer.File): Promise<ProcessedExcelData> {
    try {
      console.log(`📊 Processing Excel file: ${file.originalname}`);

      // 验证文件格式
      this.validateFileFormat(file.originalname);

      // 解析Excel文件
      const excelData = this.parseExcelFile(file.buffer, file.originalname);

      // 转换为Base64用于N8N传输
      const base64Content = file.buffer.toString('base64');

      // 创建预览数据（前几行）
      const preview = excelData.data.slice(0, this.maxPreviewRows);

      const processedData: ProcessedExcelData = {
        base64Content,
        metadata: {
          fileName: file.originalname,
          fileSize: file.size,
          rowCount: excelData.rowCount,
          columnCount: excelData.columnCount,
          headers: excelData.headers,
          preview
        }
      };

      console.log(`✅ Excel file processed successfully:`, {
        fileName: file.originalname,
        rowCount: excelData.rowCount,
        columnCount: excelData.columnCount,
        headersCount: excelData.headers.length
      });

      return processedData;

    } catch (error) {
      console.error(`❌ Failed to process Excel file:`, error);
      throw new DatasetSearchError(
        `Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXCEL_PROCESSING_ERROR',
        400
      );
    }
  }

  /**
   * 从Base64解析Excel数据（用于预览或验证）
   */
  parseBase64Excel(base64Content: string, fileName: string): ExcelData {
    try {
      const buffer = Buffer.from(base64Content, 'base64');
      return this.parseExcelFile(buffer, fileName);
    } catch (error) {
      throw new DatasetSearchError(
        `Failed to parse Excel from base64: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXCEL_PARSE_ERROR',
        400
      );
    }
  }

  /**
   * 验证Excel文件内容是否适合搜索
   */
  validateExcelForSearch(excelData: ExcelData): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isValid = true;

    // 检查行数
    if (excelData.rowCount === 0) {
      warnings.push('Excel文件为空');
      isValid = false;
    } else if (excelData.rowCount < 2) {
      warnings.push('Excel文件只有标题行，没有数据');
      isValid = false;
    }

    // 检查列数
    if (excelData.columnCount === 0) {
      warnings.push('Excel文件没有列');
      isValid = false;
    } else if (excelData.columnCount > 50) {
      warnings.push('Excel文件列数过多（>50），可能影响处理性能');
    }

    // 检查文件大小
    if (excelData.rowCount > 10000) {
      recommendations.push('文件行数较多，建议考虑分批处理');
    }

    // 检查标题行
    if (excelData.headers.length === 0) {
      warnings.push('未检测到标题行');
    } else {
      const emptyHeaders = excelData.headers.filter(h => !h || h.toString().trim() === '');
      if (emptyHeaders.length > 0) {
        warnings.push(`检测到${emptyHeaders.length}个空标题列`);
      }
    }

    // 检查数据质量
    if (excelData.data.length > 1) {
      const sampleRow = excelData.data[1]; // 第一行数据（跳过标题）
      const emptyValues = sampleRow.filter(cell => cell === null || cell === undefined || cell === '');
      if (emptyValues.length / sampleRow.length > 0.5) {
        warnings.push('检测到大量空值，可能影响搜索效果');
      }
    }

    // 提供建议
    if (excelData.rowCount < 100) {
      recommendations.push('数据量较小，建议增加更多数据以提高搜索效果');
    }

    if (excelData.headers.some(h => ['name', 'title', 'institution', 'company', 'organization'].some(keyword =>
      h.toString().toLowerCase().includes(keyword)))) {
      recommendations.push('检测到机构/组织相关字段，适合进行实体搜索');
    }

    return {
      isValid,
      warnings,
      recommendations
    };
  }

  /**
   * 从Excel数据中提取关键词建议
   */
  extractKeywordSuggestions(excelData: ExcelData, maxKeywords: number = 20): string[] {
    const keywords: Set<string> = new Set();

    try {
      // 分析前几行数据，提取潜在关键词
      const sampleRows = excelData.data.slice(1, Math.min(11, excelData.data.length)); // 取前10行数据

      for (const row of sampleRows) {
        for (const cell of row) {
          if (cell && typeof cell === 'string') {
            // 提取有意义的词汇
            const words = this.extractMeaningfulWords(cell);
            words.forEach(word => {
              if (word.length >= 3 && word.length <= 30) {
                keywords.add(word);
              }
            });
          }
        }
      }

      // 转换为数组并限制数量
      const keywordArray = Array.from(keywords).slice(0, maxKeywords);

      console.log(`📝 Extracted ${keywordArray.length} keyword suggestions from Excel data`);
      return keywordArray;

    } catch (error) {
      console.error('Failed to extract keywords from Excel:', error);
      return [];
    }
  }

  /**
   * 解析Excel文件的私有方法
   */
  private parseExcelFile(buffer: Buffer, fileName: string): ExcelData {
    try {
      // 读取Excel文件
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      // 获取第一个工作表
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Excel文件没有工作表');
      }

      const worksheet = workbook.Sheets[firstSheetName];

      // 转换为JSON数组格式
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,  // 使用数组格式而不是对象格式
        raw: false, // 将所有值转换为字符串
        dateNF: 'yyyy-mm-dd' // 日期格式
      }) as any[][];

      if (jsonData.length === 0) {
        throw new Error('Excel文件没有数据');
      }

      // 提取标题行（第一行）
      const headers = jsonData[0] ? jsonData[0].map(cell => cell?.toString() || '') : [];

      return {
        data: jsonData,
        headers,
        rowCount: jsonData.length,
        columnCount: jsonData[0]?.length || 0,
        fileName
      };

    } catch (error) {
      throw new Error(`Excel解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证文件格式
   */
  private validateFileFormat(fileName: string): void {
    const extension = '.' + fileName.split('.').pop()?.toLowerCase();
    if (!this.supportedFormats.includes(extension)) {
      throw new DatasetSearchError(
        `不支持的文件格式: ${extension}。支持的格式: ${this.supportedFormats.join(', ')}`,
        'UNSUPPORTED_FORMAT',
        400
      );
    }
  }

  /**
   * 从文本中提取有意义的词汇
   */
  private extractMeaningfulWords(text: string): string[] {
    // 基本的词汇提取逻辑
    const words = text
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留字母、数字、空格和中文字符
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .filter(word => !/^\d+$/.test(word)) // 过滤纯数字
      .map(word => word.trim())
      .filter(word => word.length > 0);

    return [...new Set(words)]; // 去重
  }
}