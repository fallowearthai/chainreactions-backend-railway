import { DatasetExecutionState, ExecutionStatus } from '../types/DatasetSearchTypes';
export interface ExecutionMetrics {
    totalActiveExecutions: number;
    executionsByStatus: Record<ExecutionStatus, number>;
    averageExecutionTime: number;
    totalExecutionsProcessed: number;
}
export declare class ExecutionStateManager {
    private activeExecutions;
    private executionHistory;
    private readonly MAX_HISTORY_SIZE;
    private readonly CLEANUP_INTERVAL_MS;
    private cleanupTimer;
    constructor();
    /**
     * Create a new execution state
     */
    createExecution(executionId: string, userId: string, institutionName: string, totalEntities: number): DatasetExecutionState;
    /**
     * Get execution state by ID
     */
    getExecution(executionId: string): DatasetExecutionState | null;
    /**
     * Update execution state
     */
    updateExecution(executionId: string, updates: Partial<DatasetExecutionState>): DatasetExecutionState | null;
    /**
     * Cancel execution
     */
    cancelExecution(executionId: string): boolean;
    /**
     * Get all active executions
     */
    getActiveExecutions(): DatasetExecutionState[];
    /**
     * Get executions by user ID
     */
    getUserExecutions(userId: string, includeHistory?: boolean): DatasetExecutionState[];
    /**
     * Get execution metrics
     */
    getMetrics(): ExecutionMetrics;
    /**
     * Force cleanup of execution
     */
    forceCleanup(executionId: string): boolean;
    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        activeExecutions: number;
        historyExecutions: number;
        totalMemoryItems: number;
        estimatedMemoryUsage: string;
    };
    /**
     * Shutdown and cleanup all resources
     */
    shutdown(): void;
    /**
     * Move execution from active to history
     */
    private moveToHistory;
    /**
     * Perform periodic cleanup of old executions
     */
    private performCleanup;
}
export declare const executionStateManager: ExecutionStateManager;
//# sourceMappingURL=ExecutionStateManager.d.ts.map