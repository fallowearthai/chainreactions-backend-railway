import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  N8nExecutionRequest,
  N8nWebhookPayload,
  ExecutionStatus,
  LongTextResult,
  DatasetSearchError
} from '../types/DatasetSearchTypes';

export interface N8nConfig {
  webhookUrl: string;
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export class N8nIntegrationService {
  private config: N8nConfig;
  private executionStore: Map<string, {
    status: ExecutionStatus;
    results?: LongTextResult[];
    error?: string;
    createdAt: Date;
    completedAt?: Date;
  }> = new Map();

  constructor(config?: N8nConfig) {
    this.config = {
      webhookUrl: config?.webhookUrl || process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/dataset-search',
      apiUrl: config?.apiUrl || process.env.N8N_API_URL || 'http://localhost:5678/api/v1',
      apiKey: config?.apiKey || process.env.N8N_API_KEY,
      timeout: config?.timeout || 30000
    };
  }

  /**
   * 触发N8N工作流执行
   */
  async triggerExecution(request: {
    target_institution: string;
    keywords?: string[];
    start_date?: string;
    end_date?: string;
    excel_file_content?: string;
    excel_file_name?: string;
  }): Promise<string> {
    const executionId = uuidv4();

    try {
      console.log(`🚀 Triggering N8N execution for: ${request.target_institution}`);

      // 准备N8N请求数据
      const n8nRequest: N8nExecutionRequest = {
        webhook_url: `${process.env.BACKEND_URL || 'http://localhost:3004'}/api/dataset-search/webhook`,
        target_institution: request.target_institution,
        keywords: request.keywords,
        start_date: request.start_date,
        end_date: request.end_date,
        excel_file_content: request.excel_file_content,
        excel_file_name: request.excel_file_name,
        execution_id: executionId
      };

      // 初始化执行状态
      this.executionStore.set(executionId, {
        status: 'pending',
        createdAt: new Date()
      });

      // 调用N8N webhook
      const response = await axios.post(this.config.webhookUrl, n8nRequest, {
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dataset-Search-Service/1.0.0'
        }
      });

      console.log(`✅ N8N execution triggered successfully:`, {
        executionId,
        target_institution: request.target_institution,
        responseStatus: response.status
      });

      // 更新状态为处理中
      this.updateExecutionStatus(executionId, 'processing');

      return executionId;

    } catch (error) {
      console.error(`❌ Failed to trigger N8N execution:`, error);

      // 更新状态为失败
      this.updateExecutionStatus(executionId, 'failed', undefined,
        error instanceof Error ? error.message : 'Unknown N8N trigger error');

      throw new DatasetSearchError(
        `Failed to trigger N8N execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'N8N_TRIGGER_ERROR',
        500
      );
    }
  }

  /**
   * 处理N8N webhook回调
   */
  async handleWebhookCallback(payload: N8nWebhookPayload): Promise<void> {
    const { execution_id, status, results, error, metadata } = payload;

    console.log(`📥 Received N8N webhook callback:`, {
      execution_id,
      status,
      results_count: results?.length || 0,
      error: error ? 'Present' : 'None'
    });

    if (!this.executionStore.has(execution_id)) {
      console.warn(`⚠️  Received callback for unknown execution ID: ${execution_id}`);
      return;
    }

    // 更新执行状态
    this.updateExecutionStatus(execution_id, status, results, error);

    // 如果是完成状态，记录完成时间
    if (status === 'completed' || status === 'failed') {
      const execution = this.executionStore.get(execution_id);
      if (execution) {
        execution.completedAt = new Date();
      }
    }

    console.log(`✅ Updated execution status: ${execution_id} -> ${status}`);
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): {
    status: ExecutionStatus;
    results?: LongTextResult[];
    error?: string;
    createdAt: Date;
    completedAt?: Date;
  } | null {
    return this.executionStore.get(executionId) || null;
  }

  /**
   * 取消执行（如果N8N支持）
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    if (!this.executionStore.has(executionId)) {
      throw new DatasetSearchError(`Execution ${executionId} not found`, 'EXECUTION_NOT_FOUND', 404);
    }

    const execution = this.executionStore.get(executionId);
    if (!execution) return false;

    // 如果已经完成或失败，不能取消
    if (execution.status === 'completed' || execution.status === 'failed') {
      throw new DatasetSearchError(
        `Cannot cancel execution in ${execution.status} status`,
        'INVALID_CANCEL_STATUS',
        400
      );
    }

    try {
      // 如果配置了N8N API，尝试通过API取消
      if (this.config.apiKey && this.config.apiUrl) {
        // 实际项目中，这里应该调用N8N的取消执行API
        console.log(`📞 Attempting to cancel N8N execution via API: ${executionId}`);
        // await this.cancelN8nExecution(executionId);
      }

      // 更新本地状态
      this.updateExecutionStatus(executionId, 'cancelled');

      console.log(`🛑 Execution cancelled: ${executionId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel execution ${executionId}:`, error);
      throw new DatasetSearchError(
        `Failed to cancel execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CANCEL_ERROR',
        500
      );
    }
  }

  /**
   * 清理过期的执行记录
   */
  cleanupExpiredExecutions(maxAgeHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [executionId, execution] of this.executionStore.entries()) {
      if (execution.createdAt < cutoffTime) {
        this.executionStore.delete(executionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired executions`);
    }

    return cleanedCount;
  }

  /**
   * 获取所有执行的统计信息
   */
  getExecutionStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const stats = {
      total: this.executionStore.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const execution of this.executionStore.values()) {
      stats[execution.status]++;
    }

    return stats;
  }

  /**
   * 检查N8N服务是否可用
   */
  async checkN8nHealth(): Promise<boolean> {
    try {
      // 简单的健康检查 - ping webhook端点
      const response = await axios.get(this.config.webhookUrl.replace('/webhook/dataset-search', '/health'), {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('N8N health check failed:', error);
      return false;
    }
  }

  /**
   * 更新执行状态的私有方法
   */
  private updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    results?: LongTextResult[],
    error?: string
  ): void {
    const execution = this.executionStore.get(executionId);
    if (execution) {
      execution.status = status;
      if (results) execution.results = results;
      if (error) execution.error = error;
    }
  }
}