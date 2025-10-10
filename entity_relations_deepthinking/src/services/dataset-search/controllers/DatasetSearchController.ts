import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseNROService } from '../services/SupabaseNROService';
import { LinkupSearchService } from '../services/LinkupSearchService';
import { LinkupResponseParser } from '../services/LinkupResponseParser';
import { SearchHistoryService } from '../services/SearchHistoryService';
import { sseService } from '../services/SSEService';
import {
  DatasetSearchRequest,
  DatasetSearchResponse,
  ExecutionStatusResponse,
  DatasetSearchError,
  DatasetExecutionState,
  ParsedSearchResult,
  NROOrganization
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
  private nroService: SupabaseNROService;
  private linkupService: LinkupSearchService;
  private historyService: SearchHistoryService;
  private activeExecutions: Map<string, DatasetExecutionState> = new Map();

  constructor() {
    this.nroService = new SupabaseNROService();
    this.linkupService = new LinkupSearchService();
    this.historyService = new SearchHistoryService();
  }








  /**
   * SSE流式搜索 - 新的简化搜索模式
   * POST /api/dataset-search/stream
   */
  streamSearch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { target_institution, test_mode = false, from_date, to_date } = req.body;

    // 验证输入
    validateRequired(target_institution, 'target_institution');
    validateString(target_institution, 'target_institution', 1, 200);

    // 验证日期格式（如果提供）
    if (from_date) {
      validateString(from_date, 'from_date', 1, 50);
    }
    if (to_date) {
      validateString(to_date, 'to_date', 1, 50);
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    console.log(`🚀 Starting SSE stream search for: ${target_institution} (${executionId})${test_mode ? ' [TEST MODE]' : ''}`);

    try {
      // 获取Canadian NRO组织列表 (测试模式下限制为6个实体)
      const nroOrganizations = await this.nroService.getCanadianNRO(test_mode);

      if (nroOrganizations.length === 0) {
        throw new DatasetSearchError('No Canadian NRO organizations found', 'NO_NRO_DATA', 500);
      }

      // 创建执行状态
      const executionState: DatasetExecutionState = {
        executionId,
        status: 'processing',
        userId: 'anonymous', // 简化为匿名用户
        institutionName: target_institution,
        totalEntities: nroOrganizations.length,
        processedEntities: 0,
        foundRelationships: 0,
        startTime: new Date(),
        cancelled: false,
        abortController: new AbortController(),
        results: []
      };

      this.activeExecutions.set(executionId, executionState);

      // 不再创建搜索历史记录，直接开始搜索

      // 建立SSE连接
      const connectionId = sseService.createConnection(res, executionId, 'anonymous');

      // 开始后台搜索处理
      this.processStreamSearch(executionState, nroOrganizations, from_date, to_date)
        .catch(error => {
          console.error(`Stream search processing failed for ${executionId}:`, error);
          sseService.sendError(executionId, error);
        });

      console.log(`✅ SSE stream search initiated: ${executionId} with ${nroOrganizations.length} entities`);

    } catch (error) {
      console.error(`❌ Failed to start stream search:`, error);

      if (!res.headersSent) {
        const response: DatasetSearchResponse = {
          success: false,
          execution_id: executionId,
          message: 'Failed to start stream search',
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        const statusCode = error instanceof DatasetSearchError ? error.statusCode : 500;
        res.status(statusCode).json(response);
      }
    }
  });

  /**
   * 处理流式搜索的后台逻辑
   */
  private async processStreamSearch(
    executionState: DatasetExecutionState,
    nroOrganizations: NROOrganization[],
    fromDate?: string,
    toDate?: string
  ): Promise<void> {
    const { executionId, institutionName, abortController } = executionState;

    console.log(`📅 Search date range: ${fromDate || 'N/A'} to ${toDate || 'N/A'}`);

    try {
      // 搜索开始 - 不再记录历史
      const firstEntity = nroOrganizations[0]?.organization_name || 'First Entity';
      sseService.sendProgress(executionId, 0, nroOrganizations.length, 'Starting search...', undefined, firstEntity);

      // 使用LinkupSearchService进行并发搜索
      const linkupResponses = await this.linkupService.searchInstitutionRelationships(
        institutionName,
        'Canada', // 默认使用Canada作为机构国家
        nroOrganizations,
        {
          maxConcurrent: 2, // 2个并发搜索
          timeoutMs: 900000, // 15分钟超时
          fromDate,
          toDate
        },
        abortController.signal,
        // 进度回调 - 增强API分配信息
        async (current: number, total: number, result?, apiIndex?: number) => {
          if (abortController.signal.aborted) {
            return;
          }

          executionState.processedEntities = current;

          const riskEntity = nroOrganizations[current - 1]?.organization_name || `Entity_${current - 1}`;
          const apiInfo = apiIndex !== undefined ? ` (API ${apiIndex + 1})` : '';

          if (result) {
            // 解析响应
            const parsedResult = LinkupResponseParser.parseResponse(result, riskEntity);

            executionState.results.push(parsedResult);
            executionState.foundRelationships++;

            // 发送新结果到SSE
            sseService.sendNewResult(executionId, parsedResult, current, total, apiIndex);

            console.log(`✅ Processed entity ${current}/${total}: ${riskEntity}${apiInfo} - Relationship found`);
          } else {
            // 搜索超时或失败的情况 - 创建一个 "Timed Out" 结果
            const timedOutResult: ParsedSearchResult = {
              risk_item: riskEntity,
              relationship_type: 'Timed Out',
              finding_summary: this.generateTimeoutMessage(riskEntity, apiIndex),
              intermediary_organizations: [],
              source_urls: [],
              completed_at: new Date().toISOString()
            };

            executionState.results.push(timedOutResult);

            // 发送 timed out 结果到SSE
            sseService.sendNewResult(executionId, timedOutResult, current, total, apiIndex);

            console.log(`⏱️ Processed entity ${current}/${total}: ${riskEntity}${apiInfo} - Timed out`);
          }
        }
      );

      // 处理完成
      const endTime = Date.now();
      const processingTime = endTime - executionState.startTime.getTime();

      executionState.status = 'completed';
      executionState.endTime = new Date();

      // 搜索完成 - 不再更新历史记录

      // 发送完成通知
      sseService.sendCompletion(executionId, executionState.foundRelationships, processingTime);

      console.log(`✅ Stream search completed: ${executionId} - ${executionState.foundRelationships} relationships found in ${processingTime}ms`);

    } catch (error) {
      console.error(`❌ Stream search processing error:`, error);

      executionState.status = 'failed';

      // 搜索失败 - 不再更新历史记录

      // 发送错误通知
      sseService.sendError(executionId, error as Error, executionState.processedEntities, executionState.totalEntities);
    } finally {
      // 清理执行状态
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 30000); // 30秒后清理
    }
  }

  /**
   * 取消SSE搜索
   * DELETE /api/dataset-search/stream/:execution_id
   */
  cancelStreamSearch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { execution_id } = req.params;

    validateExecutionId(execution_id, 'execution_id');

    console.log(`🛑 Cancelling stream search: ${execution_id}`);

    try {
      const executionState = this.activeExecutions.get(execution_id);

      if (!executionState) {
        throw new DatasetSearchError(`Execution ${execution_id} not found or already completed`, 'EXECUTION_NOT_FOUND', 404);
      }

      // 取消搜索
      executionState.cancelled = true;
      executionState.status = 'cancelled';
      executionState.abortController.abort();

      // 取消搜索 - 不再更新历史记录

      // 发送取消通知
      sseService.sendCancellation(execution_id);

      console.log(`✅ Stream search cancelled: ${execution_id}`);

      res.json({
        success: true,
        execution_id,
        message: 'Stream search cancelled successfully'
      });

    } catch (error) {
      console.error(`❌ Failed to cancel stream search:`, error);
      throw error;
    }
  });

  /**
   * 获取流式搜索状态
   * GET /api/dataset-search/stream/:execution_id/status
   */
  getStreamSearchStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { execution_id } = req.params;

    validateExecutionId(execution_id, 'execution_id');

    try {
      // 首先检查内存中的活跃执行
      const executionState = this.activeExecutions.get(execution_id);

      if (executionState) {
        res.json({
          success: true,
          execution_id,
          status: executionState.status,
          progress: {
            current: executionState.processedEntities,
            total: executionState.totalEntities,
            found_relationships: executionState.foundRelationships
          },
          start_time: executionState.startTime.toISOString(),
          end_time: executionState.endTime?.toISOString()
        });
        return;
      }

      // 如果不在内存中，说明搜索已完成或不存在
      throw new DatasetSearchError(`Execution ${execution_id} not found or already completed`, 'EXECUTION_NOT_FOUND', 404);

    } catch (error) {
      console.error(`❌ Failed to get stream search status:`, error);
      throw error;
    }
  });

  /**
   * 获取Canadian NRO统计信息
   * GET /api/dataset-search/nro-stats
   */
  getNROStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.nroService.getNROStatistics();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error(`❌ Failed to get NRO stats:`, error);
      throw error;
    }
  });

  /**
   * Generate detailed timeout error message
   */
  private generateTimeoutMessage(riskEntity: string, apiIndex?: number): string {
    const apiInfo = apiIndex !== undefined ? ` (API ${apiIndex + 1})` : '';

    return `Search for "${riskEntity}" timed out${apiInfo}. This may be due to:\n\n` +
      `• Complex entity relationships requiring extended analysis time\n` +
      `• Network latency or temporary API rate limits\n` +
      `• High volume of search results for this entity\n\n` +
      `💡 **Recommendations:**\n` +
      `1. Try searching again later (the system has 15-minute retry limits)\n` +
      `2. Consider breaking down large searches into smaller batches\n` +
      `3. Check your internet connection if multiple entities time out\n\n` +
      `🔧 **Technical Details:**\n` +
      `• Timeout limit: 15 minutes per search batch\n` +
      `• Retry mechanism: 3 attempts with exponential backoff\n` +
      `• API Rate Limit: 10 queries/second per API key`;
  }

  /**
   * 健康检查
   * GET /api/health
   */
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const supabaseHealthy = await this.nroService.testConnection();
    const linkupHealthy = await this.linkupService.testConnection();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Dataset Search Service',
      version: '2.0.0',
      dependencies: {
        supabase: supabaseHealthy ? 'healthy' : 'unhealthy',
        linkup: linkupHealthy ? 'healthy' : 'unhealthy'
      },
      active_executions: this.activeExecutions.size,
      sse_connections: sseService.getActiveConnectionsCount()
    });
  });
}