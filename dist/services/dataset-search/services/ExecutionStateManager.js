"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionStateManager = exports.ExecutionStateManager = void 0;
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
class ExecutionStateManager {
    constructor() {
        this.activeExecutions = new Map();
        this.executionHistory = new Map();
        this.MAX_HISTORY_SIZE = 1000;
        this.CLEANUP_INTERVAL_MS = 300000; // 5 minutes
        // Start periodic cleanup
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.CLEANUP_INTERVAL_MS);
    }
    /**
     * Create a new execution state
     */
    createExecution(executionId, userId, institutionName, totalEntities) {
        if (this.activeExecutions.has(executionId)) {
            throw new DatasetSearchTypes_1.DatasetSearchError(`Execution ${executionId} already exists`, 'EXECUTION_EXISTS', 409);
        }
        const executionState = {
            executionId,
            status: 'pending',
            userId,
            institutionName,
            totalEntities,
            processedEntities: 0,
            foundRelationships: 0,
            startTime: new Date(),
            cancelled: false,
            abortController: new AbortController(),
            results: []
        };
        this.activeExecutions.set(executionId, executionState);
        console.log(`📋 Created execution state: ${executionId} for ${institutionName}`);
        return executionState;
    }
    /**
     * Get execution state by ID
     */
    getExecution(executionId) {
        return this.activeExecutions.get(executionId) || this.executionHistory.get(executionId) || null;
    }
    /**
     * Update execution state
     */
    updateExecution(executionId, updates) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return null;
        }
        // Apply updates
        Object.assign(execution, updates);
        // If execution is completed or failed, move to history
        if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
            execution.endTime = new Date();
            this.moveToHistory(executionId);
        }
        return execution;
    }
    /**
     * Cancel execution
     */
    cancelExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return false;
        }
        execution.cancelled = true;
        execution.status = 'cancelled';
        execution.abortController.abort();
        execution.endTime = new Date();
        this.moveToHistory(executionId);
        console.log(`🛑 Cancelled execution: ${executionId}`);
        return true;
    }
    /**
     * Get all active executions
     */
    getActiveExecutions() {
        return Array.from(this.activeExecutions.values());
    }
    /**
     * Get executions by user ID
     */
    getUserExecutions(userId, includeHistory = false) {
        const active = Array.from(this.activeExecutions.values())
            .filter(exec => exec.userId === userId);
        if (!includeHistory) {
            return active;
        }
        const history = Array.from(this.executionHistory.values())
            .filter(exec => exec.userId === userId);
        return [...active, ...history];
    }
    /**
     * Get execution metrics
     */
    getMetrics() {
        const activeExecutions = Array.from(this.activeExecutions.values());
        const historyExecutions = Array.from(this.executionHistory.values());
        const allExecutions = [...activeExecutions, ...historyExecutions];
        // Count by status
        const executionsByStatus = {
            pending: 0,
            processing: 0,
            completed: 0,
            cancelled: 0,
            failed: 0
        };
        allExecutions.forEach(exec => {
            executionsByStatus[exec.status]++;
        });
        // Calculate average execution time for completed executions
        const completedExecutions = allExecutions.filter(exec => exec.status === 'completed' && exec.endTime);
        const averageExecutionTime = completedExecutions.length > 0
            ? completedExecutions.reduce((sum, exec) => {
                return sum + (exec.endTime.getTime() - exec.startTime.getTime());
            }, 0) / completedExecutions.length
            : 0;
        return {
            totalActiveExecutions: activeExecutions.length,
            executionsByStatus,
            averageExecutionTime: Math.round(averageExecutionTime),
            totalExecutionsProcessed: allExecutions.length
        };
    }
    /**
     * Force cleanup of execution
     */
    forceCleanup(executionId) {
        const removed = this.activeExecutions.delete(executionId) ||
            this.executionHistory.delete(executionId);
        if (removed) {
            console.log(`🧹 Force cleaned execution: ${executionId}`);
        }
        return removed;
    }
    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        const active = this.activeExecutions.size;
        const history = this.executionHistory.size;
        const total = active + history;
        // Rough estimate of memory usage (each execution state is approximately 1KB)
        const estimatedBytes = total * 1024;
        const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(2);
        return {
            activeExecutions: active,
            historyExecutions: history,
            totalMemoryItems: total,
            estimatedMemoryUsage: `${estimatedMB} MB`
        };
    }
    /**
     * Shutdown and cleanup all resources
     */
    shutdown() {
        // Cancel all active executions
        this.activeExecutions.forEach((execution, executionId) => {
            execution.cancelled = true;
            execution.abortController.abort();
        });
        // Clear all data
        this.activeExecutions.clear();
        this.executionHistory.clear();
        // Clear cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        console.log('🔄 ExecutionStateManager shutdown completed');
    }
    /**
     * Move execution from active to history
     */
    moveToHistory(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
            this.activeExecutions.delete(executionId);
            this.executionHistory.set(executionId, execution);
            // Manage history size
            if (this.executionHistory.size > this.MAX_HISTORY_SIZE) {
                const oldestKey = this.executionHistory.keys().next().value;
                if (oldestKey) {
                    this.executionHistory.delete(oldestKey);
                }
            }
        }
    }
    /**
     * Perform periodic cleanup of old executions
     */
    performCleanup() {
        const now = Date.now();
        const STALE_THRESHOLD_MS = 1800000; // 30 minutes
        let cleanedCount = 0;
        // Cleanup stale active executions (should not happen normally)
        this.activeExecutions.forEach((execution, executionId) => {
            const age = now - execution.startTime.getTime();
            if (age > STALE_THRESHOLD_MS) {
                console.warn(`🚨 Cleaning up stale active execution: ${executionId}`);
                execution.cancelled = true;
                execution.abortController.abort();
                this.moveToHistory(executionId);
                cleanedCount++;
            }
        });
        // Cleanup old history entries (keep for 24 hours)
        const HISTORY_THRESHOLD_MS = 86400000; // 24 hours
        this.executionHistory.forEach((execution, executionId) => {
            const age = now - execution.startTime.getTime();
            if (age > HISTORY_THRESHOLD_MS) {
                this.executionHistory.delete(executionId);
                cleanedCount++;
            }
        });
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old execution states`);
        }
    }
}
exports.ExecutionStateManager = ExecutionStateManager;
// Create singleton instance
exports.executionStateManager = new ExecutionStateManager();
// Cleanup on process exit
process.on('SIGTERM', () => {
    exports.executionStateManager.shutdown();
});
process.on('SIGINT', () => {
    exports.executionStateManager.shutdown();
});
//# sourceMappingURL=ExecutionStateManager.js.map