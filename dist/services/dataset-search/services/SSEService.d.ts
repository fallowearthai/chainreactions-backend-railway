import { Response } from 'express';
import { SSEProgressEvent, ParsedSearchResult } from '../types/DatasetSearchTypes';
export interface SSEConnection {
    id: string;
    response: Response;
    executionId: string;
    userId: string;
    lastPing: number;
    isActive: boolean;
}
export declare class SSEService {
    private connections;
    private pingInterval;
    private readonly PING_INTERVAL_MS;
    private readonly CONNECTION_TIMEOUT_MS;
    constructor();
    /**
     * Create a new SSE connection
     */
    createConnection(response: Response, executionId: string, userId: string): string;
    /**
     * Send progress update to specific execution
     */
    sendProgress(executionId: string, current: number, total: number, message?: string, apiIndex?: number, currentEntity?: string): void;
    /**
     * Send new search result to specific execution
     */
    sendNewResult(executionId: string, result: ParsedSearchResult, current: number, total: number, apiIndex?: number): void;
    /**
     * Optimize result data based on relationship type to reduce SSE message size
     * AGGRESSIVE OPTIMIZATION: 15KB hard limit to prevent JSON truncation
     */
    private optimizeResultData;
    /**
     * Generate simple summary for basic relationship types
     */
    private generateSimpleSummary;
    /**
     * Send completion notification to specific execution
     */
    sendCompletion(executionId: string, totalResults: number, processingTimeMs: number): void;
    /**
     * Send error notification to specific execution
     */
    sendError(executionId: string, error: string | Error, current?: number, total?: number): void;
    /**
     * Send cancellation notification to specific execution
     */
    sendCancellation(executionId: string): void;
    /**
     * Send custom message to specific execution
     */
    sendMessage(executionId: string, stage: SSEProgressEvent['stage'], status: SSEProgressEvent['status'], message: string, data?: any): void;
    /**
     * Remove a specific connection
     */
    removeConnection(connectionId: string): void;
    /**
     * Close all connections for a specific execution
     */
    closeExecutionConnections(executionId: string): void;
    /**
     * Get active connections count
     */
    getActiveConnectionsCount(): number;
    /**
     * Get connections for specific execution
     */
    getExecutionConnections(executionId: string): SSEConnection[];
    /**
     * Close all connections and clean up
     */
    shutdown(): void;
    /**
     * Send event to all connections for a specific execution
     */
    private sendToExecution;
    /**
     * Send a single event to a response stream
     */
    private sendEvent;
    /**
     * Send ping to all connections to keep them alive
     */
    private pingConnections;
    /**
     * Generate a unique connection ID
     */
    private generateConnectionId;
}
export declare const sseService: SSEService;
//# sourceMappingURL=SSEService.d.ts.map