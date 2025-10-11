import { DatasetSearchError } from '../types/DatasetSearchTypes';
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
export declare class ErrorHandlerService {
    private errorHistory;
    private readonly MAX_ERROR_HISTORY;
    private historyService;
    constructor();
    /**
     * Handle search execution errors with proper cleanup
     */
    handleSearchError(error: Error | DatasetSearchError, context: ErrorContext): Promise<void>;
    /**
     * Handle API errors (Linkup, Supabase, etc.)
     */
    handleApiError(error: Error, context: ErrorContext & {
        apiName: string;
        endpoint?: string;
    }): Promise<void>;
    /**
     * Handle validation errors
     */
    handleValidationError(error: DatasetSearchError, context: ErrorContext): void;
    /**
     * Handle resource cleanup errors
     */
    handleCleanupError(error: Error, context: ErrorContext & {
        resourceType: string;
    }): Promise<void>;
    /**
     * Cleanup failed execution with comprehensive resource management
     */
    private cleanupFailedExecution;
    /**
     * Handle critical API errors that might affect service availability
     */
    private handleCriticalApiError;
    /**
     * Attempt alternative cleanup methods when primary cleanup fails
     */
    private attemptAlternativeCleanup;
    /**
     * Create standardized error report
     */
    private createErrorReport;
    /**
     * Determine severity level for API errors
     */
    private determineApiErrorSeverity;
    /**
     * Get error statistics
     */
    getErrorStatistics(): {
        totalErrors: number;
        errorsBySeverity: Record<ErrorReport['severity'], number>;
        recentErrors: ErrorReport[];
        commonErrorCodes: Array<{
            code: string;
            count: number;
        }>;
    };
    /**
     * Get error report by ID
     */
    getErrorReport(errorId: string): ErrorReport | null;
    /**
     * Clear error history
     */
    clearErrorHistory(): void;
    /**
     * Perform emergency shutdown cleanup
     */
    emergencyShutdown(): void;
}
export declare const errorHandler: ErrorHandlerService;
//# sourceMappingURL=ErrorHandlerService.d.ts.map