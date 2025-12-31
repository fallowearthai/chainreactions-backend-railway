import { Response } from 'express';

/**
 * 认证通知事件类型
 */
export interface AuthNotificationEvent {
  type: 'session_conflict' | 'force_signout' | 'connection_established';
  data: {
    reason?: string;
    newDevice?: string;
    initiatedBy?: string;
    timestamp: string;
    message: string;
  };
}

/**
 * SSE连接接口
 */
export interface AuthNotificationConnection {
  id: string;
  response: Response;
  userId: string;
  lastPing: number;
  isActive: boolean;
  createdAt: number;
  userAgent?: string;
  ipAddress?: string;
  connectionId?: string; // 前端传递的连接ID
}

/**
 * 连接指标接口
 */
export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  activeUsers: number;
  averageConnectionsPerUser: number;
  totalConnectionsCreated: number;
  connectionErrors: number;
  uptime: number;
  memoryUsage?: string;
}

/**
 * 认证通知服务
 *
 * 基于现有SSE架构，为用户管理服务提供实时通知功能
 * 用于替代前端轮询，减少API调用和Supabase Egress使用
 */
export class AuthNotificationService {
  private static instance: AuthNotificationService;
  private connections: Map<string, AuthNotificationConnection> = new Map();
  private pingInterval: NodeJS.Timeout;

  // 配置常量（针对200人并发优化）
  private readonly PING_INTERVAL_MS = 30000; // 30秒ping一次保持连接
  private readonly CONNECTION_TIMEOUT_MS = 300000; // 5分钟连接超时
  private readonly MAX_CONNECTIONS_PER_USER = 3; // 每用户最多3个连接（与前端一致）

  // 连接指标监控
  private totalConnectionsCreated = 0;
  private connectionErrors = 0;
  private startTime: number = Date.now();

  private constructor() {
    // 启动ping服务保持连接活跃
    this.pingInterval = setInterval(() => {
      this.pingConnections();
    }, this.PING_INTERVAL_MS);

    console.log('🔔 AuthNotificationService initialized');
  }

  public static getInstance(): AuthNotificationService {
    if (!AuthNotificationService.instance) {
      AuthNotificationService.instance = new AuthNotificationService();
    }
    return AuthNotificationService.instance;
  }

  /**
   * 创建新的SSE连接用于认证通知
   */
  createConnection(
    response: Response,
    userId: string,
    userAgent?: string,
    ipAddress?: string,
    frontendConnectionId?: string
  ): string {
    // 检查用户连接数限制
    const userConnections = this.getUserConnections(userId);
    if (userConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
      // 移除最旧的连接
      const oldestConnection = userConnections[0];
      this.removeConnection(oldestConnection.id);
      console.log(`🔕 Removed oldest connection for user ${userId}: ${oldestConnection.id}`);
    }

    const connectionId = this.generateConnectionId();

    // 设置SSE响应头
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    });

    // 发送初始连接事件
    this.sendEvent(response, {
      type: 'connection_established',
      data: {
        timestamp: new Date().toISOString(),
        message: '已连接到认证通知服务'
      }
    });

    // 存储连接（包含设备信息）
    const connection: AuthNotificationConnection = {
      id: connectionId,
      response,
      userId,
      lastPing: Date.now(),
      isActive: true,
      createdAt: Date.now(),
      userAgent: userAgent || 'Unknown',
      ipAddress: ipAddress || 'Unknown',
      connectionId: frontendConnectionId
    };

    // 更新连接指标
    this.totalConnectionsCreated++;

    this.connections.set(connectionId, connection);

    // 处理客户端断开连接
    response.on('close', () => {
      this.removeConnection(connectionId);
    });

    response.on('error', (error) => {
      console.error(`SSE连接错误 ${connectionId}:`, error);
      this.connectionErrors++;
      this.removeConnection(connectionId);
    });

    console.log(`🔌 认证通知SSE连接已创建: ${connectionId} for user: ${userId}`);
    return connectionId;
  }

  /**
   * 发送会话冲突通知
   */
  async sendSessionConflictNotification(
    userId: string,
    reason: string,
    newDevice?: string,
    newDeviceIp?: string
  ): Promise<void> {
    const event: AuthNotificationEvent = {
      type: 'session_conflict',
      data: {
        reason,
        newDevice: newDevice || '未知设备',
        timestamp: new Date().toISOString(),
        message: newDevice
          ? `您的账户在另一设备上登录 (${newDevice})，当前会话已结束`
          : '您的账户在另一设备上登录，当前会话已结束'
      }
    };

    await this.sendToUser(userId, event);
    console.log(`⚠️ 会话冲突通知已发送给用户 ${userId}: ${reason}`);
  }

  /**
   * 发送强制登出通知
   */
  async sendForceSignOutNotification(
    userId: string,
    reason: string,
    initiatedBy?: string
  ): Promise<void> {
    const event: AuthNotificationEvent = {
      type: 'force_signout',
      data: {
        reason,
        initiatedBy: initiatedBy || '系统管理员',
        timestamp: new Date().toISOString(),
        message: reason === 'admin_action'
          ? '管理员强制您登出系统'
          : `您的会话已结束: ${reason}`
      }
    };

    await this.sendToUser(userId, event);
    console.log(`🚪 强制登出通知已发送给用户 ${userId}: ${reason}`);
  }

  /**
   * 获取用户的活跃连接数
   */
  getUserConnectionCount(userId: string): number {
    return this.getUserConnections(userId).length;
  }

  /**
   * 获取所有活跃连接数
   */
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  /**
   * 获取详细的连接指标
   */
  getConnectionMetrics(): ConnectionMetrics {
    const activeConnections = this.connections.size;
    const uniqueUsers = new Set(Array.from(this.connections.values()).map(conn => conn.userId));
    const activeUsers = uniqueUsers.size;
    const averageConnectionsPerUser = activeUsers > 0 ? activeConnections / activeUsers : 0;

    // 获取内存使用情况
    const memoryUsage = process.memoryUsage();
    const formattedMemory = `RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(1)}MB, Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`;

    const uptime = Date.now() - this.startTime;

    return {
      totalConnections: this.totalConnectionsCreated,
      activeConnections,
      activeUsers,
      averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100, // 保留2位小数
      totalConnectionsCreated: this.totalConnectionsCreated,
      connectionErrors: this.connectionErrors,
      uptime,
      memoryUsage: formattedMemory
    };
  }

  /**
   * 移除特定连接
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      this.connections.delete(connectionId);
      console.log(`🔌 认证通知SSE连接已移除: ${connectionId}`);
    }
  }

  /**
   * 关闭用户的所有连接
   */
  closeUserConnections(userId: string): number {
    const userConnections = this.getUserConnections(userId);
    let closedCount = 0;

    userConnections.forEach(connection => {
      try {
        connection.response.end();
      } catch (error) {
        console.error(`关闭用户 ${userId} 的SSE连接时出错:`, error);
      }
      this.removeConnection(connection.id);
      closedCount++;
    });

    console.log(`🔌 已关闭用户 ${userId} 的 ${closedCount} 个SSE连接`);
    return closedCount;
  }

  /**
   * 关闭所有连接并清理
   */
  shutdown(): void {
    // 清理ping定时器
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // 关闭所有连接
    this.connections.forEach(connection => {
      try {
        connection.response.end();
      } catch (error) {
        console.error('关闭SSE连接时出错:', error);
      }
    });

    this.connections.clear();
    console.log('🔌 AuthNotificationService 已关闭');
  }

  /**
   * 发送事件到特定用户的所有连接
   */
  private async sendToUser(userId: string, event: AuthNotificationEvent): Promise<void> {
    const userConnections = this.getUserConnections(userId);
    let successCount = 0;
    const connectionsToRemove: string[] = [];

    // 创建异步发送操作
    const sendPromises = userConnections.map(async (connection) => {
      try {
        const success = this.sendEvent(connection.response, event);
        if (success) {
          successCount++;
        } else {
          connectionsToRemove.push(connection.id);
        }
      } catch (error) {
        console.error(`向连接 ${connection.id} 发送事件失败:`, error);
        connectionsToRemove.push(connection.id);
      }
    });

    // 等待所有发送操作完成
    await Promise.allSettled(sendPromises);

    // 移除失败的连接
    connectionsToRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    console.log(`📤 事件已发送到用户 ${userId} 的 ${successCount}/${userConnections.length} 个连接`);
  }

  /**
   * 发送单个事件到响应流
   */
  private sendEvent(response: Response, event: AuthNotificationEvent): boolean {
    try {
      const eventData = JSON.stringify(event);
      const sseData = `data: ${eventData}\n\n`;

      // 使用回调方式处理写入，避免阻塞
      return response.write(sseData);
    } catch (error) {
      console.error('写入SSE事件时出错:', error);
      // 不再抛出错误，而是返回失败状态
      return false;
    }
  }

  /**
   * 获取特定用户的所有活跃连接
   */
  private getUserConnections(userId: string): AuthNotificationConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.userId === userId && conn.isActive);
  }

  /**
   * 向所有连接发送ping保持连接活跃（异步版本）
   */
  private async pingConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: string[] = [];
    const pingPromises: Promise<void>[] = [];

    this.connections.forEach((connection, connectionId) => {
      // 检查连接是否超时
      if (now - connection.lastPing > this.CONNECTION_TIMEOUT_MS) {
        connectionsToRemove.push(connectionId);
        return;
      }

      // 创建异步ping操作
      const pingPromise = new Promise<void>((resolve) => {
        try {
          // 使用异步写入避免阻塞
          connection.response.write('data: {"type":"ping","timestamp":"' + new Date().toISOString() + '"}\n\n', (err) => {
            if (err) {
              connectionsToRemove.push(connectionId);
            } else {
              connection.lastPing = now;
            }
            resolve();
          });
        } catch (error) {
          console.error(`Ping失败，连接 ${connectionId}:`, error);
          connectionsToRemove.push(connectionId);
          resolve();
        }
      });

      pingPromises.push(pingPromise);
    });

    // 等待所有ping操作完成
    await Promise.allSettled(pingPromises);

    // 移除失败的连接
    connectionsToRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (connectionsToRemove.length > 0) {
      console.log(`🔌 移除了 ${connectionsToRemove.length} 个不活跃的SSE连接`);
    }
  }

  /**
   * 生成唯一的连接ID
   */
  private generateConnectionId(): string {
    return `auth_notify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建单例实例
export const authNotificationService = AuthNotificationService.getInstance();

// 进程退出时清理
process.on('SIGTERM', () => {
  authNotificationService.shutdown();
});

process.on('SIGINT', () => {
  authNotificationService.shutdown();
});