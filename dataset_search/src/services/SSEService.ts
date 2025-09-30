import { Response } from 'express';
import { SSEProgressEvent, ParsedSearchResult, DatasetSearchError } from '../types/DatasetSearchTypes';

export interface SSEConnection {
  id: string;
  response: Response;
  executionId: string;
  userId: string;
  lastPing: number;
  isActive: boolean;
}

export class SSEService {
  private connections: Map<string, SSEConnection> = new Map();
  private pingInterval: NodeJS.Timeout;
  private readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT_MS = 60000; // 1 minute

  constructor() {
    // Start ping service to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingConnections();
    }, this.PING_INTERVAL_MS);
  }

  /**
   * Create a new SSE connection
   */
  createConnection(
    response: Response,
    executionId: string,
    userId: string
  ): string {
    const connectionId = this.generateConnectionId();

    // Set up SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Send initial connection event with executionId
    this.sendEvent(response, {
      stage: 'connection',
      status: 'connected',
      message: 'Connected to dataset search stream',
      data: { executionId }
    });

    // Store connection
    const connection: SSEConnection = {
      id: connectionId,
      response,
      executionId,
      userId,
      lastPing: Date.now(),
      isActive: true
    };

    this.connections.set(connectionId, connection);

    // Handle client disconnect
    response.on('close', () => {
      this.removeConnection(connectionId);
    });

    response.on('error', (error) => {
      console.error(`SSE connection error for ${connectionId}:`, error);
      this.removeConnection(connectionId);
    });

    console.log(`SSE connection created: ${connectionId} for execution: ${executionId}`);
    return connectionId;
  }

  /**
   * Send progress update to specific execution
   */
  sendProgress(
    executionId: string,
    current: number,
    total: number,
    message?: string,
    apiIndex?: number
  ): void {
    const event: SSEProgressEvent = {
      stage: 'progress',
      status: 'running',
      message: message || `Processing ${current} of ${total}`,
      current,
      total,
      data: apiIndex !== undefined ? { apiIndex: apiIndex + 1 } : undefined
    };

    this.sendToExecution(executionId, event);
  }

  /**
   * Send new search result to specific execution
   */
  sendNewResult(
    executionId: string,
    result: ParsedSearchResult,
    current: number,
    total: number,
    apiIndex?: number
  ): void {
    const event: SSEProgressEvent = {
      stage: 'new_result',
      status: 'success',
      message: `Found result for ${result.risk_item}`,
      current,
      total,
      data: {
        ...result,
        apiIndex: apiIndex !== undefined ? apiIndex + 1 : undefined
      }
    };

    this.sendToExecution(executionId, event);
  }

  /**
   * Send completion notification to specific execution
   */
  sendCompletion(
    executionId: string,
    totalResults: number,
    processingTimeMs: number
  ): void {
    const event: SSEProgressEvent = {
      stage: 'completed',
      status: 'success',
      message: `Search completed. Found ${totalResults} results in ${processingTimeMs}ms`,
      current: totalResults,
      total: totalResults
    };

    this.sendToExecution(executionId, event);

    // Close connections for this execution after a short delay
    setTimeout(() => {
      this.closeExecutionConnections(executionId);
    }, 2000);
  }

  /**
   * Send error notification to specific execution
   */
  sendError(
    executionId: string,
    error: string | Error,
    current?: number,
    total?: number
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;

    const event: SSEProgressEvent = {
      stage: 'error',
      status: 'failed',
      message: `Search failed: ${errorMessage}`,
      current,
      total,
      error: errorMessage
    };

    this.sendToExecution(executionId, event);

    // Close connections for this execution after a short delay
    setTimeout(() => {
      this.closeExecutionConnections(executionId);
    }, 2000);
  }

  /**
   * Send cancellation notification to specific execution
   */
  sendCancellation(executionId: string): void {
    const event: SSEProgressEvent = {
      stage: 'error',
      status: 'failed',
      message: 'Search was cancelled by user',
      error: 'SEARCH_CANCELLED'
    };

    this.sendToExecution(executionId, event);

    // Close connections for this execution immediately
    this.closeExecutionConnections(executionId);
  }

  /**
   * Send custom message to specific execution
   */
  sendMessage(
    executionId: string,
    stage: SSEProgressEvent['stage'],
    status: SSEProgressEvent['status'],
    message: string,
    data?: any
  ): void {
    const event: SSEProgressEvent = {
      stage,
      status,
      message,
      data
    };

    this.sendToExecution(executionId, event);
  }

  /**
   * Remove a specific connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      this.connections.delete(connectionId);
      console.log(`SSE connection removed: ${connectionId}`);
    }
  }

  /**
   * Close all connections for a specific execution
   */
  closeExecutionConnections(executionId: string): void {
    const connectionsToClose = Array.from(this.connections.values())
      .filter(conn => conn.executionId === executionId);

    connectionsToClose.forEach(connection => {
      try {
        connection.response.end();
      } catch (error) {
        console.error('Error closing SSE connection:', error);
      }
      this.removeConnection(connection.id);
    });

    console.log(`Closed ${connectionsToClose.length} SSE connections for execution: ${executionId}`);
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for specific execution
   */
  getExecutionConnections(executionId: string): SSEConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.executionId === executionId && conn.isActive);
  }

  /**
   * Close all connections and clean up
   */
  shutdown(): void {
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
    this.connections.forEach(connection => {
      try {
        connection.response.end();
      } catch (error) {
        console.error('Error closing SSE connection during shutdown:', error);
      }
    });

    this.connections.clear();
    console.log('SSE Service shutdown completed');
  }

  /**
   * Send event to all connections for a specific execution
   */
  private sendToExecution(executionId: string, event: SSEProgressEvent): void {
    const connections = this.getExecutionConnections(executionId);

    connections.forEach(connection => {
      try {
        this.sendEvent(connection.response, event);
      } catch (error) {
        console.error(`Failed to send SSE event to connection ${connection.id}:`, error);
        this.removeConnection(connection.id);
      }
    });

    if (connections.length === 0) {
      console.warn(`No active SSE connections found for execution: ${executionId}`);
    }
  }

  /**
   * Send a single event to a response stream
   */
  private sendEvent(response: Response, event: SSEProgressEvent): void {
    try {
      const eventData = JSON.stringify(event);
      const sseData = `data: ${eventData}\n\n`;

      response.write(sseData);
    } catch (error) {
      console.error('Error writing SSE event:', error);
      throw error;
    }
  }

  /**
   * Send ping to all connections to keep them alive
   */
  private pingConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    this.connections.forEach((connection, connectionId) => {
      // Check if connection is too old
      if (now - connection.lastPing > this.CONNECTION_TIMEOUT_MS) {
        connectionsToRemove.push(connectionId);
        return;
      }

      try {
        // Send ping
        connection.response.write('data: {"type":"ping"}\n\n');
        connection.lastPing = now;
      } catch (error) {
        console.error(`Ping failed for connection ${connectionId}:`, error);
        connectionsToRemove.push(connectionId);
      }
    });

    // Remove failed connections
    connectionsToRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (connectionsToRemove.length > 0) {
      console.log(`Removed ${connectionsToRemove.length} inactive SSE connections`);
    }
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
export const sseService = new SSEService();

// Cleanup on process exit
process.on('SIGTERM', () => {
  sseService.shutdown();
});

process.on('SIGINT', () => {
  sseService.shutdown();
});