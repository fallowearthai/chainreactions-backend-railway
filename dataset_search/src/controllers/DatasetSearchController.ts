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
    const { target_institution, test_mode = false } = req.body;

    // 验证输入
    validateRequired(target_institution, 'target_institution');
    validateString(target_institution, 'target_institution', 1, 200);

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
      this.processStreamSearch(executionState, nroOrganizations)
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
    nroOrganizations: NROOrganization[]
  ): Promise<void> {
    const { executionId, institutionName, abortController } = executionState;

    try {
      // 搜索开始 - 不再记录历史

      sseService.sendProgress(executionId, 0, nroOrganizations.length, 'Starting search...');

      // 使用LinkupSearchService进行并发搜索
      const linkupResponses = await this.linkupService.searchInstitutionRelationships(
        institutionName,
        'Canada', // 默认使用Canada作为机构国家
        nroOrganizations,
        {
          maxConcurrent: 2, // 2个并发搜索
          timeoutMs: 600000 // 10分钟超时
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
            // 没有结果的情况（可能是搜索失败但没有抛出错误）
            console.log(`⚠️ Processed entity ${current}/${total}: ${riskEntity}${apiInfo} - No relationship data`);

            // 发送进度更新，表明实体已处理但无关系数据
            sseService.sendProgress(executionId, current, total, `Processed ${riskEntity}${apiInfo} - no relationship found`, apiIndex, riskEntity);
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