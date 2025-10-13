"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSearchController = void 0;
const uuid_1 = require("uuid");
const SupabaseNROService_1 = require("../services/SupabaseNROService");
const LinkupSearchService_1 = require("../services/LinkupSearchService");
const LinkupResponseParser_1 = require("../services/LinkupResponseParser");
const SearchHistoryService_1 = require("../services/SearchHistoryService");
const SSEService_1 = require("../services/SSEService");
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
const ErrorHandler_1 = require("../utils/ErrorHandler");
class DatasetSearchController {
    constructor() {
        this.activeExecutions = new Map();
        /**
         * SSE流式搜索 - 新的简化搜索模式
         * POST /api/dataset-search/stream
         */
        this.streamSearch = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const { target_institution, test_mode = false, from_date, to_date } = req.body;
            // 验证输入
            (0, ErrorHandler_1.validateRequired)(target_institution, 'target_institution');
            (0, ErrorHandler_1.validateString)(target_institution, 'target_institution', 1, 200);
            // 验证日期格式（如果提供）
            if (from_date) {
                (0, ErrorHandler_1.validateString)(from_date, 'from_date', 1, 50);
            }
            if (to_date) {
                (0, ErrorHandler_1.validateString)(to_date, 'to_date', 1, 50);
            }
            const executionId = (0, uuid_1.v4)();
            const startTime = Date.now();
            console.log(`🚀 Starting SSE stream search for: ${target_institution} (${executionId})${test_mode ? ' [TEST MODE]' : ''}`);
            try {
                // 获取Canadian NRO组织列表 (测试模式下限制为6个实体)
                const nroOrganizations = await this.nroService.getCanadianNRO(test_mode);
                if (nroOrganizations.length === 0) {
                    throw new DatasetSearchTypes_1.DatasetSearchError('No Canadian NRO organizations found', 'NO_NRO_DATA', 500);
                }
                // 创建执行状态
                const executionState = {
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
                const connectionId = SSEService_1.sseService.createConnection(res, executionId, 'anonymous');
                // 开始后台搜索处理
                this.processStreamSearch(executionState, nroOrganizations, from_date, to_date)
                    .catch(error => {
                    console.error(`Stream search processing failed for ${executionId}:`, error);
                    SSEService_1.sseService.sendError(executionId, error);
                });
                console.log(`✅ SSE stream search initiated: ${executionId} with ${nroOrganizations.length} entities`);
            }
            catch (error) {
                console.error(`❌ Failed to start stream search:`, error);
                if (!res.headersSent) {
                    const response = {
                        success: false,
                        execution_id: executionId,
                        message: 'Failed to start stream search',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                    const statusCode = error instanceof DatasetSearchTypes_1.DatasetSearchError ? error.statusCode : 500;
                    res.status(statusCode).json(response);
                }
            }
        });
        /**
         * 取消SSE搜索
         * DELETE /api/dataset-search/stream/:execution_id
         */
        this.cancelStreamSearch = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const { execution_id } = req.params;
            (0, ErrorHandler_1.validateExecutionId)(execution_id, 'execution_id');
            console.log(`🛑 Cancelling stream search: ${execution_id}`);
            try {
                const executionState = this.activeExecutions.get(execution_id);
                if (!executionState) {
                    throw new DatasetSearchTypes_1.DatasetSearchError(`Execution ${execution_id} not found or already completed`, 'EXECUTION_NOT_FOUND', 404);
                }
                // 取消搜索
                executionState.cancelled = true;
                executionState.status = 'cancelled';
                executionState.abortController.abort();
                // 取消搜索 - 不再更新历史记录
                // 发送取消通知
                SSEService_1.sseService.sendCancellation(execution_id);
                console.log(`✅ Stream search cancelled: ${execution_id}`);
                res.json({
                    success: true,
                    execution_id,
                    message: 'Stream search cancelled successfully'
                });
            }
            catch (error) {
                console.error(`❌ Failed to cancel stream search:`, error);
                throw error;
            }
        });
        /**
         * 获取流式搜索状态
         * GET /api/dataset-search/stream/:execution_id/status
         */
        this.getStreamSearchStatus = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const { execution_id } = req.params;
            (0, ErrorHandler_1.validateExecutionId)(execution_id, 'execution_id');
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
                throw new DatasetSearchTypes_1.DatasetSearchError(`Execution ${execution_id} not found or already completed`, 'EXECUTION_NOT_FOUND', 404);
            }
            catch (error) {
                console.error(`❌ Failed to get stream search status:`, error);
                throw error;
            }
        });
        /**
         * 获取Canadian NRO统计信息
         * GET /api/dataset-search/nro-stats
         */
        this.getNROStats = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            try {
                const stats = await this.nroService.getNROStatistics();
                res.json({
                    success: true,
                    stats
                });
            }
            catch (error) {
                console.error(`❌ Failed to get NRO stats:`, error);
                throw error;
            }
        });
        /**
         * 健康检查
         * GET /api/health
         * IMPORTANT: Does NOT call real Linkup API to prevent credit consumption
         */
        this.healthCheck = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            // Supabase connection test (lightweight query, no credits consumed)
            const supabaseHealthy = await this.nroService.testConnection();
            // Linkup configuration check (NO API call, no credits consumed)
            const linkupConfig = this.linkupService.checkConfiguration();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'Dataset Search Service',
                version: '2.0.0',
                dependencies: {
                    supabase: supabaseHealthy ? 'healthy' : 'unhealthy',
                    linkup: linkupConfig.configured ? 'configured' : 'misconfigured',
                    linkup_details: {
                        ...linkupConfig,
                        note: 'Health check does not call real API to prevent credit consumption'
                    }
                },
                active_executions: this.activeExecutions.size,
                sse_connections: SSEService_1.sseService.getActiveConnectionsCount()
            });
        });
        this.nroService = new SupabaseNROService_1.SupabaseNROService();
        this.linkupService = new LinkupSearchService_1.LinkupSearchService();
        this.historyService = new SearchHistoryService_1.SearchHistoryService();
    }
    /**
     * 处理流式搜索的后台逻辑
     */
    async processStreamSearch(executionState, nroOrganizations, fromDate, toDate) {
        const { executionId, institutionName, abortController } = executionState;
        console.log(`📅 Search date range: ${fromDate || 'N/A'} to ${toDate || 'N/A'}`);
        try {
            // 搜索开始 - 不再记录历史
            const firstEntity = nroOrganizations[0]?.organization_name || 'First Entity';
            SSEService_1.sseService.sendProgress(executionId, 0, nroOrganizations.length, 'Starting search...', undefined, firstEntity);
            // 使用LinkupSearchService进行并发搜索
            const linkupResponses = await this.linkupService.searchInstitutionRelationships(institutionName, 'Canada', // 默认使用Canada作为机构国家
            nroOrganizations, {
                maxConcurrent: 2, // 2个并发搜索
                timeoutMs: 900000, // 15分钟超时
                fromDate,
                toDate
            }, abortController.signal, 
            // 进度回调 - 增强API分配信息
            async (current, total, result, apiIndex) => {
                if (abortController.signal.aborted) {
                    return;
                }
                executionState.processedEntities = current;
                const riskEntity = nroOrganizations[current - 1]?.organization_name || `Entity_${current - 1}`;
                const apiInfo = apiIndex !== undefined ? ` (API ${apiIndex + 1})` : '';
                if (result) {
                    // 解析响应
                    const parsedResult = LinkupResponseParser_1.LinkupResponseParser.parseResponse(result, riskEntity);
                    executionState.results.push(parsedResult);
                    executionState.foundRelationships++;
                    // 发送新结果到SSE
                    SSEService_1.sseService.sendNewResult(executionId, parsedResult, current, total, apiIndex);
                    console.log(`✅ Processed entity ${current}/${total}: ${riskEntity}${apiInfo} - Relationship found`);
                }
                else {
                    // 搜索超时或失败的情况 - 创建一个 "Timed Out" 结果
                    const timedOutResult = {
                        risk_item: riskEntity,
                        relationship_type: 'Timed Out',
                        finding_summary: this.generateTimeoutMessage(riskEntity, apiIndex),
                        intermediary_organizations: [],
                        source_urls: [],
                        completed_at: new Date().toISOString()
                    };
                    executionState.results.push(timedOutResult);
                    // 发送 timed out 结果到SSE
                    SSEService_1.sseService.sendNewResult(executionId, timedOutResult, current, total, apiIndex);
                    console.log(`⏱️ Processed entity ${current}/${total}: ${riskEntity}${apiInfo} - Timed out`);
                }
            });
            // 处理完成
            const endTime = Date.now();
            const processingTime = endTime - executionState.startTime.getTime();
            executionState.status = 'completed';
            executionState.endTime = new Date();
            // 搜索完成 - 不再更新历史记录
            // 发送完成通知
            SSEService_1.sseService.sendCompletion(executionId, executionState.foundRelationships, processingTime);
            console.log(`✅ Stream search completed: ${executionId} - ${executionState.foundRelationships} relationships found in ${processingTime}ms`);
        }
        catch (error) {
            console.error(`❌ Stream search processing error:`, error);
            executionState.status = 'failed';
            // 搜索失败 - 不再更新历史记录
            // 发送错误通知
            SSEService_1.sseService.sendError(executionId, error, executionState.processedEntities, executionState.totalEntities);
        }
        finally {
            // 清理执行状态
            setTimeout(() => {
                this.activeExecutions.delete(executionId);
            }, 30000); // 30秒后清理
        }
    }
    /**
     * Generate detailed timeout error message
     */
    generateTimeoutMessage(riskEntity, apiIndex) {
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
}
exports.DatasetSearchController = DatasetSearchController;
//# sourceMappingURL=DatasetSearchController.js.map