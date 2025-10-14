import { DatasetSearchError } from '../types/DatasetSearchTypes';
import { sseService } from './SSEService';
import { executionStateManager } from './ExecutionStateManager';
import { SearchHistoryService } from './SearchHistoryService';

export interface ErrorContext {
  executionId?: string;
  userId?: string;
  institutionName?: string;
  operation?: string;
  additionalData?: any;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    code: string;
    message: string;
    stack?: string;
  };
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export class ErrorHandlerService {
  private errorHistory: Map<string, ErrorReport> = new Map();
  private readonly MAX_ERROR_HISTORY = 1000;
  private historyService: SearchHistoryService;

  constructor() {
    this.historyService = new SearchHistoryService();
  }

  /**
   * Handle search execution errors with proper cleanup
   */
  async handleSearchError(
    error: Error | DatasetSearchError,
    context: ErrorContext
  ): Promise<void> {
    const errorReport = this.createErrorReport(error, context, 'high');

    console.error(`🚨 Search Error [${errorReport.id}]:`, {
      error: errorReport.error,
      context: errorReport.context
    });

    try {
      // Cleanup execution state
      if (context.executionId) {
        await this.cleanupFailedExecution(context.executionId, error);
      }

      // Send SSE error notification
      if (context.executionId) {
        sseService.sendError(context.executionId, error);
      }

    } catch (cleanupError) {
      console.error(`💥 Failed to cleanup after error:`, cleanupError);
      // Create secondary error report
      this.createErrorReport(cleanupError as Error, {
        ...context,
        operation: 'error_cleanup'
      }, 'critical');
    }
  }

  /**
   * Handle API errors (Linkup, Supabase, etc.)
   */
  async handleApiError(
    error: Error,
    context: ErrorContext & { apiName: string; endpoint?: string }
  ): Promise<void> {
    const severity = this.determineApiErrorSeverity(error, context.apiName);
    const errorReport = this.createErrorReport(error, context, severity);

    console.error(`🔌 API Error [${errorReport.id}] - ${context.apiName}:`, {
      error: errorReport.error,
      context: errorReport.context
    });

    // For critical API errors, we might need to pause operations
    if (severity === 'critical') {
      await this.handleCriticalApiError(context.apiName, error);
    }
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    error: DatasetSearchError,
    context: ErrorContext
  ): void {
    const errorReport = this.createErrorReport(error, context, 'medium');

    console.warn(`⚠️ Validation Error [${errorReport.id}]:`, {
      error: errorReport.error,
      context: errorReport.context
    });
  }

  /**
   * Handle resource cleanup errors
   */
  async handleCleanupError(
    error: Error,
    context: ErrorContext & { resourceType: string }
  ): Promise<void> {
    const errorReport = this.createErrorReport(error, context, 'medium');

    console.error(`🧹 Cleanup Error [${errorReport.id}] - ${context.resourceType}:`, {
      error: errorReport.error,
      context: errorReport.context
    });

    // For cleanup errors, we should try alternative cleanup methods
    await this.attemptAlternativeCleanup(context);
  }

  /**
   * Cleanup failed execution with comprehensive resource management
   */
  private async cleanupFailedExecution(
    executionId: string,
    originalError: Error
  ): Promise<void> {
    try {
      console.log(`🧹 Starting cleanup for failed execution: ${executionId}`);

      // 1. Cancel execution state
      const cancelled = executionStateManager.cancelExecution(executionId);
      if (!cancelled) {
        console.warn(`⚠️ Could not find execution state to cancel: ${executionId}`);
      }

      // 2. Close SSE connections
      sseService.closeExecutionConnections(executionId);

      // 3. Force cleanup any lingering resources
      setTimeout(() => {
        executionStateManager.forceCleanup(executionId);
      }, 5000); // 5 second delay to allow graceful cleanup

      console.log(`✅ Cleanup completed for execution: ${executionId}`);

    } catch (cleanupError) {
      console.error(`💥 Critical: Failed to cleanup execution ${executionId}:`, cleanupError);

      // Last resort: force cleanup
      executionStateManager.forceCleanup(executionId);
      sseService.closeExecutionConnections(executionId);
    }
  }

  /**
   * Handle critical API errors that might affect service availability
   */
  private async handleCriticalApiError(
    apiName: string,
    error: Error
  ): Promise<void> {
    console.error(`🚨 CRITICAL API FAILURE - ${apiName}:`, error.message);

    // For now, just log the critical error
    // In production, this might trigger alerts, circuit breakers, etc.

    if (apiName === 'linkup') {
      console.warn(`⚠️ Linkup API is experiencing issues. New searches may be affected.`);
    } else if (apiName === 'supabase') {
      console.warn(`⚠️ Database connectivity issues detected. Data persistence may be affected.`);
    }
  }

  /**
   * Attempt alternative cleanup methods when primary cleanup fails
   */
  private async attemptAlternativeCleanup(
    context: ErrorContext & { resourceType: string }
  ): Promise<void> {
    try {
      switch (context.resourceType) {
        case 'execution_state':
          if (context.executionId) {
            executionStateManager.forceCleanup(context.executionId);
          }
          break;

        case 'sse_connection':
          if (context.executionId) {
            sseService.closeExecutionConnections(context.executionId);
          }
          break;

        default:
          console.warn(`Unknown resource type for cleanup: ${context.resourceType}`);
      }
    } catch (altError) {
      console.error(`💥 Alternative cleanup also failed:`, altError);
    }
  }

  /**
   * Create standardized error report
   */
  private createErrorReport(
    error: Error,
    context: ErrorContext,
    severity: ErrorReport['severity']
  ): ErrorReport {
    const reportId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const errorReport: ErrorReport = {
      id: reportId,
      timestamp: new Date().toISOString(),
      error: {
        code: error instanceof DatasetSearchError ? error.code : 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack
      },
      context,
      severity,
      handled: true
    };

    // Store in error history
    this.errorHistory.set(reportId, errorReport);

    // Manage history size
    if (this.errorHistory.size > this.MAX_ERROR_HISTORY) {
      const oldestKey = this.errorHistory.keys().next().value;
      if (oldestKey) {
        this.errorHistory.delete(oldestKey);
      }
    }

    return errorReport;
  }

  /**
   * Determine severity level for API errors
   */
  private determineApiErrorSeverity(
    error: Error,
    apiName: string
  ): ErrorReport['severity'] {
    const message = error.message.toLowerCase();

    // Critical errors that might indicate service outage
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection refused') ||
        message.includes('503') ||
        message.includes('502')) {
      return 'critical';
    }

    // High severity for authentication/authorization issues
    if (message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('401') ||
        message.includes('403')) {
      return 'high';
    }

    // Medium for rate limiting or temporary issues
    if (message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('quota')) {
      return 'medium';
    }

    // Default to medium for unknown API errors
    return 'medium';
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsBySeverity: Record<ErrorReport['severity'], number>;
    recentErrors: ErrorReport[];
    commonErrorCodes: Array<{ code: string; count: number }>;
  } {
    const errors = Array.from(this.errorHistory.values());

    // Count by severity
    const errorsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    errors.forEach(error => {
      errorsBySeverity[error.severity]++;
    });

    // Get recent errors (last 10)
    const recentErrors = errors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // Count common error codes
    const errorCodeCounts = new Map<string, number>();
    errors.forEach(error => {
      const count = errorCodeCounts.get(error.error.code) || 0;
      errorCodeCounts.set(error.error.code, count + 1);
    });

    const commonErrorCodes = Array.from(errorCodeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalErrors: errors.length,
      errorsBySeverity,
      recentErrors,
      commonErrorCodes
    };
  }

  /**
   * Get error report by ID
   */
  getErrorReport(errorId: string): ErrorReport | null {
    return this.errorHistory.get(errorId) || null;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    console.log('🧹 Error history cleared');
  }

  /**
   * Perform emergency shutdown cleanup
   */
  emergencyShutdown(): void {
    console.log('🚨 Emergency shutdown initiated - cleaning up all resources');

    try {
      // Cancel all active executions
      const activeExecutions = executionStateManager.getActiveExecutions();
      activeExecutions.forEach(execution => {
        execution.cancelled = true;
        execution.abortController.abort();
      });

      // Close all SSE connections
      sseService.shutdown();

      // Shutdown execution state manager
      executionStateManager.shutdown();

      console.log('✅ Emergency shutdown completed');
    } catch (error) {
      console.error('💥 Emergency shutdown failed:', error);
    }
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandlerService();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  errorHandler.emergencyShutdown();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);

  const error = reason instanceof Error ? reason : new Error(String(reason));
  errorHandler.handleSearchError(error, {
    operation: 'unhandled_promise_rejection'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received - performing graceful shutdown');
  errorHandler.emergencyShutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received - performing graceful shutdown');
  errorHandler.emergencyShutdown();
  process.exit(0);
});