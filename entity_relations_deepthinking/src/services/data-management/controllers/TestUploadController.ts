import { Request, Response } from 'express';
import { SmartCsvParser } from '../services/SmartCsvParser';
import * as path from 'path';
import * as fs from 'fs';

export class TestUploadController {

  /**
   * POST /api/test-upload/:id
   * 测试智能CSV上传功能，直接返回解析结果
   */
  async testUploadFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const file = req.file;
      console.log(`🔍 Processing test upload: ${file.originalname} (${file.size} bytes)`);

      // 验证文件类型
      const allowedExtensions = ['.csv'];
      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        res.status(400).json({
          success: false,
          error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
        });
        return;
      }

      // 智能检测字段映射
      console.log('🔍 Analyzing CSV structure...');
      const fieldAnalysis = await SmartCsvParser.detectFieldMapping(file.path);

      console.log('📊 Field mapping analysis:', {
        confidence: fieldAnalysis.confidence,
        prioritiesFound: fieldAnalysis.priorities.found,
        prioritiesMissing: fieldAnalysis.priorities.missing,
        totalFields: fieldAnalysis.headers.length
      });

      // 解析前几行数据作为示例
      const sampleRows = await this.parseSampleCsvData(file.path, fieldAnalysis.mapping, 3);

      // 清理上传的文件
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }

      const response = {
        success: true,
        message: 'Smart CSV analysis completed',
        data: {
          field_analysis: {
            confidence: fieldAnalysis.confidence,
            priorities_found: fieldAnalysis.priorities.found,
            priorities_missing: fieldAnalysis.priorities.missing,
            total_headers: fieldAnalysis.headers.length,
            mapping: fieldAnalysis.mapping
          },
          sample_data: sampleRows,
          file_info: {
            filename: file.originalname,
            size: file.size,
            format: 'csv'
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Test upload failed:', error);
      res.status(500).json({
        success: false,
        error: 'Test upload failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 解析CSV文件的前几行作为示例
   */
  private async parseSampleCsvData(filePath: string, mapping: Record<string, string>, limit: number = 3): Promise<any[]> {
    return new Promise((resolve) => {
      const results: any[] = [];
      let count = 0;

      const fs = require('fs');
      const csv = require('csv-parser');

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          if (count < limit) {
            try {
              const transformedRow = SmartCsvParser.transformRowData(row, mapping);
              if (transformedRow.organization_name && transformedRow.organization_name.trim()) {
                results.push(transformedRow);
                count++;
              }
            } catch (error) {
              console.warn('Error transforming sample row:', error);
            }
          }
        })
        .on('end', () => {
          console.log(`Sample parsing completed: ${results.length} sample rows`);
          resolve(results);
        })
        .on('error', (error: any) => {
          console.error('Error parsing sample CSV:', error);
          resolve([]);
        });
    });
  }
}