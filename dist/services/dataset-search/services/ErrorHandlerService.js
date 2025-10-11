"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ErrorHandlerService = void 0;
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
const SSEService_1 = require("./SSEService");
const ExecutionStateManager_1 = require("./ExecutionStateManager");
const SearchHistoryService_1 = require("./SearchHistoryService");
class ErrorHandlerService {
    constructor() {
        this.errorHistory = new Map();
        this.MAX_ERROR_HISTORY = 1000;
        this.historyService = new SearchHistoryService_1.SearchHistoryService();
    }
    /**
     * Handle search execution errors with proper cleanup
     */
    async handleSearchError(error, context) {
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
                SSEService_1.sseService.sendError(context.executionId, error);
            }
        }
        catch (cleanupError) {
            console.error(`💥 Failed to cleanup after error:`, cleanupError);
            // Create secondary error report
            this.createErrorReport(cleanupError, {
                ...context,
                operation: 'error_cleanup'
            }, 'critical');
        }
    }
    /**
     * Handle API errors (Linkup, Supabase, etc.)
     */
    async handleApiError(error, context) {
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
    handleValidationError(error, context) {
        const errorReport = this.createErrorReport(error, context, 'medium');
        console.warn(`⚠️ Validation Error [${errorReport.id}]:`, {
            error: errorReport.error,
            context: errorReport.context
        });
    }
    /**
     * Handle resource cleanup errors
     */
    async handleCleanupError(error, context) {
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
    async cleanupFailedExecution(executionId, originalError) {
        try {
            console.log(`🧹 Starting cleanup for failed execution: ${executionId}`);
            // 1. Cancel execution state
            const cancelled = ExecutionStateManager_1.executionStateManager.cancelExecution(executionId);
            if (!cancelled) {
                console.warn(`⚠️ Could not find execution state to cancel: ${executionId}`);
            }
            // 2. Close SSE connections
            SSEService_1.sseService.closeExecutionConnections(executionId);
            // 3. Force cleanup any lingering resources
            setTimeout(() => {
                ExecutionStateManager_1.executionStateManager.forceCleanup(executionId);
            }, 5000); // 5 second delay to allow graceful cleanup
            console.log(`✅ Cleanup completed for execution: ${executionId}`);
        }
        catch (cleanupError) {
            console.error(`💥 Critical: Failed to cleanup execution ${executionId}:`, cleanupError);
            // Last resort: force cleanup
            ExecutionStateManager_1.executionStateManager.forceCleanup(executionId);
            SSEService_1.sseService.closeExecutionConnections(executionId);
        }
    }
    /**
     * Handle critical API errors that might affect service availability
     */
    async handleCriticalApiError(apiName, error) {
        console.error(`🚨 CRITICAL API FAILURE - ${apiName}:`, error.message);
        // For now, just log the critical error
        // In production, this might trigger alerts, circuit breakers, etc.
        if (apiName === 'linkup') {
            console.warn(`⚠️ Linkup API is experiencing issues. New searches may be affected.`);
        }
        else if (apiName === 'supabase') {
            console.warn(`⚠️ Database connectivity issues detected. Data persistence may be affected.`);
        }
    }
    /**
     * Attempt alternative cleanup methods when primary cleanup fails
     */
    async attemptAlternativeCleanup(context) {
        try {
            switch (context.resourceType) {
                case 'execution_state':
                    if (context.executionId) {
                        ExecutionStateManager_1.executionStateManager.forceCleanup(context.executionId);
                    }
                    break;
                case 'sse_connection':
                    if (context.executionId) {
                        SSEService_1.sseService.closeExecutionConnections(context.executionId);
                    }
                    break;
                default:
                    console.warn(`Unknown resource type for cleanup: ${context.resourceType}`);
            }
        }
        catch (altError) {
            console.error(`💥 Alternative cleanup also failed:`, altError);
        }
    }
    /**
     * Create standardized error report
     */
    createErrorReport(error, context, severity) {
        const reportId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const errorReport = {
            id: reportId,
            timestamp: new Date().toISOString(),
            error: {
                code: error instanceof DatasetSearchTypes_1.DatasetSearchError ? error.code : 'UNKNOWN_ERROR',
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
    determineApiErrorSeverity(error, apiName) {
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
    getErrorStatistics() {
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
        const errorCodeCounts = new Map();
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
    getErrorReport(errorId) {
        return this.errorHistory.get(errorId) || null;
    }
    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errorHistory.clear();
        console.log('🧹 Error history cleared');
    }
    /**
     * Perform emergency shutdown cleanup
     */
    emergencyShutdown() {
        console.log('🚨 Emergency shutdown initiated - cleaning up all resources');
        try {
            // Cancel all active executions
            const activeExecutions = ExecutionStateManager_1.executionStateManager.getActiveExecutions();
            activeExecutions.forEach(execution => {
                execution.cancelled = true;
                execution.abortController.abort();
            });
            // Close all SSE connections
            SSEService_1.sseService.shutdown();
            // Shutdown execution state manager
            ExecutionStateManager_1.executionStateManager.shutdown();
            console.log('✅ Emergency shutdown completed');
        }
        catch (error) {
            console.error('💥 Emergency shutdown failed:', error);
        }
    }
}
exports.ErrorHandlerService = ErrorHandlerService;
// Create singleton instance
exports.errorHandler = new ErrorHandlerService();
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 UNCAUGHT EXCEPTION:', error);
    exports.errorHandler.emergencyShutdown();
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    exports.errorHandler.handleSearchError(error, {
        operation: 'unhandled_promise_rejection'
    });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received - performing graceful shutdown');
    exports.errorHandler.emergencyShutdown();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('📴 SIGINT received - performing graceful shutdown');
    exports.errorHandler.emergencyShutdown();
    process.exit(0);
});
//# sourceMappingURL=ErrorHandlerService.js.map