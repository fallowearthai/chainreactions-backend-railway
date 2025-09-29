import { Request, Response } from 'express';
import { N8nIntegrationService } from '../services/N8nIntegrationService';
import { ExcelProcessingService } from '../services/ExcelProcessingService';
import {
  DatasetSearchRequest,
  DatasetSearchResponse,
  ExecutionStatusResponse,
  N8nWebhookPayload,
  DatasetSearchError
} from '../types/DatasetSearchTypes';
import {
  asyncHandler,
  validateRequired,
  validateString,
  validateArray,
  validateDate,
  validateExecutionId,
  validateFile
} from '../utils/ErrorHandler';

export class DatasetSearchController {
  private n8nService: N8nIntegrationService;
  private excelService: ExcelProcessingService;

  constructor() {
    this.n8nService = new N8nIntegrationService();
    this.excelService = new ExcelProcessingService();
  }

  /**
   * 执行Dataset搜索
   * POST /api/dataset-search/execute
   */
  executeSearch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    // 验证请求数据
    const {
      target_institution,
      keywords,
      start_date,
      end_date
    } = req.body as DatasetSearchRequest;

    // 基本验证
    validateRequired(target_institution, 'target_institution');
    validateString(target_institution, 'target_institution', 1, 200);

    if (keywords) {
      validateArray(keywords, 'keywords', 0, 50);
      keywords.forEach((keyword: string, index: number) => {
        validateString(keyword, `keywords[${index}]`, 1, 100);
      });
    }

    if (start_date) {
      validateDate(start_date, 'start_date');
    }

    if (end_date) {
      validateDate(end_date, 'end_date');
    }

    // 验证日期范围
    if (start_date && end_date && start_date > end_date) {
      throw new DatasetSearchError('start_date cannot be after end_date', 'INVALID_DATE_RANGE', 400);
    }

    console.log(`🚀 Starting Dataset Search for: ${target_institution}`);

    try {
      // 处理文件（如果有）
      let fileData: {
        base64Content?: string;
        fileName?: string;
      } = {};

      if (req.file) {
        console.log(`📎 Processing uploaded file: ${req.file.originalname}`);
        const processedFile = await this.excelService.processUploadedFile(req.file);
        fileData = {
          base64Content: processedFile.base64Content,
          fileName: processedFile.metadata.fileName
        };

        console.log(`✅ File processed: ${processedFile.metadata.rowCount} rows, ${processedFile.metadata.columnCount} columns`);
      }

      // 触发N8N执行
      const executionId = await this.n8nService.triggerExecution({
        target_institution,
        keywords,
        start_date,
        end_date,
        excel_file_content: fileData.base64Content,
        excel_file_name: fileData.fileName
      });

      const processingTime = Date.now() - startTime;

      const response: DatasetSearchResponse = {
        success: true,
        execution_id: executionId,
        message: 'Dataset search started successfully',
        metadata: {
          processing_time: processingTime,
          keywords_used: keywords,
          date_range: start_date || end_date ? {
            start_date,
            end_date
          } : undefined
        }
      };

      console.log(`✅ Dataset search initiated successfully: ${executionId} (${processingTime}ms)`);

      res.status(202).json(response); // 202 Accepted for async processing

    } catch (error) {
      console.error(`❌ Dataset search failed:`, error);

      const response: DatasetSearchResponse = {
        success: false,
        execution_id: '',
        message: 'Failed to start dataset search',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // 如果是已知的DatasetSearchError，使用其状态码
      const statusCode = error instanceof DatasetSearchError ? error.statusCode : 500;
      res.status(statusCode).json(response);
    }
  });

  /**
   * 上传Excel文件并预览
   * POST /api/dataset-search/upload
   */
  uploadFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new DatasetSearchError('No file uploaded', 'NO_FILE', 400);
    }

    console.log(`📤 File upload request: ${req.file.originalname}`);

    // 验证文件
    const allowedExtensions = (process.env.ALLOWED_FILE_EXTENSIONS || '.xlsx,.xls,.csv').split(',');
    validateFile(req.file, allowedExtensions);

    try {
      // 处理Excel文件
      const processedFile = await this.excelService.processUploadedFile(req.file);

      // 验证文件内容
      const excelData = this.excelService.parseBase64Excel(
        processedFile.base64Content,
        processedFile.metadata.fileName
      );

      const validation = this.excelService.validateExcelForSearch(excelData);
      const keywordSuggestions = this.excelService.extractKeywordSuggestions(excelData);

      console.log(`✅ File uploaded and processed: ${req.file.originalname}`);

      res.json({
        success: true,
        file_info: processedFile.metadata,
        validation,
        keyword_suggestions: keywordSuggestions,
        message: 'File uploaded and processed successfully'
      });

    } catch (error) {
      console.error(`❌ File upload processing failed:`, error);
      throw error; // Re-throw to be handled by error middleware
    }
  });

  /**
   * 查询执行状态
   * GET /api/dataset-search/status/:execution_id
   */
  getExecutionStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { execution_id } = req.params;

    validateExecutionId(execution_id, 'execution_id');

    console.log(`📊 Checking execution status: ${execution_id}`);

    try {
      const execution = this.n8nService.getExecutionStatus(execution_id);

      if (!execution) {
        throw new DatasetSearchError(`Execution ${execution_id} not found`, 'EXECUTION_NOT_FOUND', 404);
      }

      const response: ExecutionStatusResponse = {
        success: true,
        execution_id,
        status: execution.status,
        results_count: execution.results?.length || 0,
        error: execution.error,
        completed_at: execution.completedAt?.toISOString(),
        created_at: execution.createdAt.toISOString()
      };

      console.log(`✅ Execution status retrieved: ${execution_id} -> ${execution.status}`);

      res.json(response);

    } catch (error) {
      console.error(`❌ Failed to get execution status:`, error);
      throw error;
    }
  });

  /**
   * 获取执行结果
   * GET /api/dataset-search/results/:execution_id
   */
  getExecutionResults = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { execution_id } = req.params;

    validateExecutionId(execution_id, 'execution_id');

    console.log(`📥 Retrieving execution results: ${execution_id}`);

    try {
      const execution = this.n8nService.getExecutionStatus(execution_id);

      if (!execution) {
        throw new DatasetSearchError(`Execution ${execution_id} not found`, 'EXECUTION_NOT_FOUND', 404);
      }

      if (execution.status !== 'completed') {
        throw new DatasetSearchError(
          `Execution is not completed. Current status: ${execution.status}`,
          'EXECUTION_NOT_COMPLETED',
          400
        );
      }

      const response: DatasetSearchResponse = {
        success: true,
        execution_id,
        message: 'Results retrieved successfully',
        data: execution.results || [],
        metadata: {
          total_results: execution.results?.length || 0
        }
      };

      console.log(`✅ Execution results retrieved: ${execution_id} (${execution.results?.length || 0} results)`);

      res.json(response);

    } catch (error) {
      console.error(`❌ Failed to get execution results:`, error);
      throw error;
    }
  });

  /**
   * 取消执行
   * DELETE /api/dataset-search/execution/:execution_id
   */
  cancelExecution = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { execution_id } = req.params;

    validateExecutionId(execution_id, 'execution_id');

    console.log(`🛑 Cancelling execution: ${execution_id}`);

    try {
      const success = await this.n8nService.cancelExecution(execution_id);

      console.log(`✅ Execution cancellation ${success ? 'successful' : 'failed'}: ${execution_id}`);

      res.json({
        success,
        execution_id,
        message: success ? 'Execution cancelled successfully' : 'Failed to cancel execution'
      });

    } catch (error) {
      console.error(`❌ Failed to cancel execution:`, error);
      throw error;
    }
  });

  /**
   * N8N Webhook回调处理
   * POST /api/dataset-search/webhook
   */
  handleWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as N8nWebhookPayload;

    console.log(`🔗 N8N webhook received:`, {
      execution_id: payload.execution_id,
      status: payload.status,
      results_count: payload.results?.length || 0
    });

    try {
      validateRequired(payload.execution_id, 'execution_id');
      validateRequired(payload.status, 'status');

      await this.n8nService.handleWebhookCallback(payload);

      console.log(`✅ Webhook processed successfully: ${payload.execution_id}`);

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      console.error(`❌ Webhook processing failed:`, error);
      throw error;
    }
  });

  /**
   * 服务统计信息
   * GET /api/dataset-search/stats
   */
  getServiceStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const executionStats = this.n8nService.getExecutionStats();
      const n8nHealthy = await this.n8nService.checkN8nHealth();

      const stats = {
        service: 'Dataset Search Service',
        version: '1.0.0',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        execution_stats: executionStats,
        n8n_health: n8nHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      };

      console.log(`📊 Service stats requested`);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error(`❌ Failed to get service stats:`, error);
      throw error;
    }
  });

  /**
   * 健康检查
   * GET /api/health
   */
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const n8nHealthy = await this.n8nService.checkN8nHealth();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Dataset Search Service',
      version: '1.0.0',
      dependencies: {
        n8n: n8nHealthy ? 'healthy' : 'unhealthy'
      }
    });
  });
}