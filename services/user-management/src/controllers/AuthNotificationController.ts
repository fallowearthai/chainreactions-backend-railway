import { Request, Response } from 'express';
import { authNotificationService } from '../services/AuthNotificationService';
import { AuthMiddleware } from '../middleware/auth';
import { BaseController } from '../base/BaseController';

/**
 * 认证通知控制器
 *
 * 提供SSE端点用于实时认证通知，替代前端轮询机制
 */
export class AuthNotificationController extends BaseController {
  constructor() {
    super('user-management');
  }

  /**
   * 建立SSE连接用于认证通知
   * GET /api/auth/notifications/stream?token=<jwt_token>
   */
  connectNotificationsStream = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log('🔌 收到SSE连接请求，URL:', req.url);
    console.log('🔌 请求头:', Object.keys(req.headers));

    // 从查询参数获取token和连接ID (EventSource不支持自定义头)
    const token = req.query.token as string;
    const frontendConnectionId = req.query.connectionId as string;

    if (!token) {
      console.log('❌ SSE连接失败: 缺少token');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized - Missing token'
      }));
      return;
    }

    console.log('🔌 收到token，长度:', token.length);

    // 轻量级JWT验证（避免重复数据库查询）
    const tokenValidation = await this.validateJWTToken(token);

    if (!tokenValidation.success) {
      console.warn('🔐 JWT validation failed:', tokenValidation.error);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized - Invalid or expired token'
      }));
      return;
    }

    const userId = tokenValidation.userId;
    const userToken = token;

    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized - No user ID found'
      }));
      return;
    }

    try {
      // 获取客户端信息用于设备识别
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown IP';

      // 简化设备名称（避免过长）
      let deviceName = 'Unknown Device';
      if (userAgent.includes('Chrome')) {
        deviceName = userAgent.includes('Edg') ? 'Microsoft Edge' : 'Chrome';
      } else if (userAgent.includes('Firefox')) {
        deviceName = 'Firefox';
      } else if (userAgent.includes('Safari')) {
        deviceName = 'Safari';
      } else if (userAgent.includes('Mobile')) {
        deviceName = 'Mobile Device';
      }

      // 添加操作系统信息
      if (userAgent.includes('Windows')) {
        deviceName += ' (Windows)';
      } else if (userAgent.includes('Mac')) {
        deviceName += ' (macOS)';
      } else if (userAgent.includes('Linux')) {
        deviceName += ' (Linux)';
      }

      // 创建SSE连接（包含设备信息）
      const connectionId = authNotificationService.createConnection(
        res,
        userId,
        userAgent,
        clientIp,
        frontendConnectionId
      );

      // 记录连接信息用于调试
      console.log(`🔔 用户 ${userId} 建立认证通知连接: ${connectionId}`);
      console.log(`📱 设备信息: ${deviceName} | IP: ${clientIp}`);

      // 统计信息
      const userConnectionCount = authNotificationService.getUserConnectionCount(userId);
      const totalConnections = authNotificationService.getActiveConnectionsCount();

      console.log(`📊 连接统计 - 用户 ${userId}: ${userConnectionCount} 个连接, 总计: ${totalConnections} 个连接`);

    } catch (error) {
      console.error('建立认证通知连接失败:', error);

      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Internal server error'
        }));
      }
    }
  });

  /**
   * 获取连接统计信息
   * GET /api/auth/notifications/stats
   */
  getNotificationsStats = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.sendErrorResponse(res, 'Authorization token required', 401);
      return;
    }

    // 验证token
    const tokenValidation = await this.validateJWTToken(token);

    if (!tokenValidation.success) {
      this.sendErrorResponse(res, 'Unauthorized - Invalid token', 401);
      return;
    }

    try {
      const stats = {
        totalConnections: authNotificationService.getActiveConnectionsCount(),
        timestamp: new Date().toISOString(),
        service: 'AuthNotificationService'
      };

      this.sendSuccessResponse(res, stats, 'Stats retrieved successfully');

    } catch (error) {
      console.error('获取通知统计信息失败:', error);
      this.sendErrorResponse(res, 'Failed to get notification stats', 500);
    }
  });

  /**
   * 测试端点 - 发送测试通知到指定用户
   * POST /api/auth/notifications/test
   * 注意：仅用于开发和测试
   */
  /**
   * JWT token验证方法 (私有)
   */
  private async validateJWTToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      console.log('🔐 开始JWT验证，token长度:', token?.length || 'undefined');

      if (!token) {
        console.log('❌ JWT验证失败: Token为空');
        return {
          success: false,
          error: 'Token is required'
        };
      }

      if (token.length < 10) {
        console.log('❌ JWT验证失败: Token长度太短');
        return {
          success: false,
          error: 'Token too short'
        };
      }

      const authService = require('../services/SupabaseAuthService').SupabaseAuthService.getInstance();
      console.log('✅ 找到AuthService实例');

      const result = await authService.validateJWT(token);
      console.log('📋 JWT验证结果:', { valid: result.valid, hasUser: !!result.user, error: result.error });

      // Transform the response format to match what the controller expects
      if (result.valid && result.user) {
        console.log('✅ JWT验证成功，用户ID:', result.user.id);
        return {
          success: true,
          userId: result.user.id
        };
      } else {
        console.log('❌ JWT验证失败:', result.error || 'Token validation failed');
        return {
          success: false,
          error: result.error || 'Token validation failed'
        };
      }
    } catch (error) {
      console.error('🔐 JWT验证异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  sendTestNotification = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 生产环境禁用测试端点
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorResponse(res, 'Test endpoint not available in production', 403);
      return;
    }

    // Check if already authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.sendErrorResponse(res, 'Authorization token required', 401);
      return;
    }

    try {
      const { userId, message } = req.body;

      if (!userId) {
        this.sendErrorResponse(res, 'userId is required', 400);
        return;
      }

      // 发送测试会话冲突通知
      await authNotificationService.sendSessionConflictNotification(
        userId,
        'test_notification',
        'Test Device',
        '127.0.0.1'
      );

      this.sendSuccessResponse(res, {
        sentTo: userId,
        message: message || '这是一条测试通知',
        timestamp: new Date().toISOString()
      }, 'Test notification sent successfully');

    } catch (error) {
      console.error('发送测试通知失败:', error);
      this.sendErrorResponse(res, 'Failed to send test notification', 500);
    }
  });

  /**
   * 获取连接监控指标
   * GET /api/notifications/metrics
   */
  getConnectionMetrics = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.sendErrorResponse(res, 'Authorization token required', 401);
      return;
    }

    // 验证token
    const tokenValidation = await this.validateJWTToken(token);

    if (!tokenValidation.success) {
      this.sendErrorResponse(res, 'Unauthorized - Invalid token', 401);
      return;
    }

    try {
      const metrics = authNotificationService.getConnectionMetrics();

      // 格式化运行时间
      const uptimeHours = Math.floor(metrics.uptime / (1000 * 60 * 60));
      const uptimeMinutes = Math.floor((metrics.uptime % (1000 * 60 * 60)) / (1000 * 60));
      const formattedUptime = `${uptimeHours}h ${uptimeMinutes}m`;

      const enhancedMetrics = {
        ...metrics,
        uptime: formattedUptime,
        timestamp: new Date().toISOString(),
        service: 'AuthNotificationService',
        limits: {
          maxConnectionsPerUser: 3,
          connectionTimeoutMs: 300000,
          pingIntervalMs: 30000
        }
      };

      this.sendSuccessResponse(res, enhancedMetrics, 'Connection metrics retrieved successfully');

    } catch (error) {
      console.error('获取连接指标失败:', error);
      this.sendErrorResponse(res, 'Failed to get connection metrics', 500);
    }
  });
}