/**
 * Simple Session Management Service
 *
 * 基于实时推送的会话管理，支持SSE通知
 * 当用户登录时踢出其他会话并通过SSE实时通知被踢出的用户
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authNotificationService } from './AuthNotificationService';

export class SimpleSessionService {
  private static instance: SimpleSessionService;
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing required Supabase configuration for session service');
    }

    // Regular client for user-specific operations (RLS compliant)
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Admin client for privileged operations (bypasses RLS when needed)
    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  public static getInstance(): SimpleSessionService {
    if (!SimpleSessionService.instance) {
      SimpleSessionService.instance = new SimpleSessionService();
    }
    return SimpleSessionService.instance;
  }

  /**
   * 设备指纹识别 - 生成简化的设备指纹
   */
  private generateDeviceFingerprint(userAgent?: string, ip?: string, acceptLanguage?: string): string {
    try {
      const components = [
        userAgent || '',
        ip || '',
        acceptLanguage || ''
      ];

      // 简化的设备指纹算法（基于多个头部信息）
      const fingerprint = Buffer.from(components.join('|')).toString('base64');
      return fingerprint.substring(0, 32); // 限制长度
    } catch (error) {
      console.warn('设备指纹生成失败:', error);
      return 'unknown_device';
    }
  }

  /**
   * 设备类型识别 - 根据User-Agent识别设备类型
   */
  private identifyDeviceType(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';

    // 检测浏览器类型
    if (userAgent.includes('Chrome')) {
      if (userAgent.includes('Edg')) return 'Microsoft Edge';
      if (userAgent.includes('OPR')) return 'Opera';
      return 'Chrome';
    }
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';

    // 检测操作系统
    if (userAgent.includes('Windows')) return 'Windows Device';
    if (userAgent.includes('Mac') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'Apple Device';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Linux')) return 'Linux Device';

    return 'Unknown Device';
  }

  /**
   * 登录时踢出所有其他会话（增强版 - 支持设备指纹识别）
   */
  public async kickOutOtherSessions(
    userId: string,
    currentSessionId: string,
    userToken?: string,
    deviceInfo?: {
      userAgent?: string;
      ip?: string;
      acceptLanguage?: string;
    }
  ): Promise<{
    success: boolean;
    kickedOutCount: number;
    error?: string;
    deviceInfo?: {
      fingerprint: string;
      deviceType: string;
      isNewDevice: boolean;
    };
  }> {
    try {
      // 生成设备指纹和识别设备类型
      const deviceFingerprint = this.generateDeviceFingerprint(
        deviceInfo?.userAgent,
        deviceInfo?.ip,
        deviceInfo?.acceptLanguage
      );
      const deviceType = this.identifyDeviceType(deviceInfo?.userAgent);

      // 检查是否有现有的活跃会话
      const { data: existingDevice, error: deviceCheckError } = await this.adminClient
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      const isNewDevice = deviceCheckError ? true : !(existingDevice && existingDevice.length > 0);

      // Use user's authenticated client if token is provided, otherwise use admin client
      const activeClient = userToken
        ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            },
            global: {
              headers: {
                Authorization: `Bearer ${userToken}`
              }
            }
          })
        : this.adminClient;

      // 1. Deactivate all existing sessions for this user
      const { data: deactivatedSessions, error: deactivateError } = await activeClient
        .from('user_sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (deactivateError) {
        return {
          success: false,
          kickedOutCount: 0,
          error: deactivateError.message
        };
      }

      const kickedOutCount = (deactivatedSessions as any)?.length || 0;

      // 2. 发送实时通知给被踢出的用户
      if (kickedOutCount > 0) {
        // 发送会话冲突通知给被踢出的用户（使用真实设备信息）
        await authNotificationService.sendSessionConflictNotification(
          userId,
          'new_login',
          deviceType,
          deviceInfo?.ip || 'Unknown IP'
        );

        console.log(`🔔 已发送 ${kickedOutCount} 个会话冲突通知给用户 ${userId} (设备: ${deviceType})`);
      }

      // 3. Create new active session
      const { data: newSession, error: insertError } = await activeClient
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_id: currentSessionId,
          is_active: true,
          device_type: deviceType,
          user_agent: deviceInfo?.userAgent,
          ip_address: deviceInfo?.ip,
          last_activity_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        return {
          success: false,
          kickedOutCount: 0,
          error: insertError.message
        };
      }

      return {
        success: true,
        kickedOutCount: kickedOutCount,
        deviceInfo: {
          fingerprint: deviceFingerprint,
          deviceType,
          isNewDevice
        }
      };

    } catch (error) {
      return {
        success: false,
        kickedOutCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 检查指定会话是否仍然有效
   * 客户端会定期调用这个方法
   */
  public async isSessionValid(userId: string, sessionId: string, userToken?: string): Promise<{
    isValid: boolean;
    isActive: boolean;
    error?: string;
  }> {
    try {
      // Use user's authenticated client if token is provided, otherwise use admin client
      const activeClient = userToken
        ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            },
            global: {
              headers: {
                Authorization: `Bearer ${userToken}`
              }
            }
          })
        : this.adminClient;

      const { data: session, error } = await activeClient
        .from('user_sessions')
        .select('is_active, last_activity_at')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return { isValid: false, isActive: false };
        }
        return {
          isValid: false,
          isActive: false,
          error: error.message
        };
      }

      return {
        isValid: true,
        isActive: session?.is_active || false
      };

    } catch (error) {
      console.error('Error checking session validity:', error);
      return {
        isValid: false,
        isActive: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 更新会话活动时间
   */
  public async updateSessionActivity(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.adminClient
        .from('user_sessions')
        .update({
          last_activity_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('is_active', true);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('Error updating session activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取用户的所有活跃会话
   */
  public async getUserActiveSessions(userId: string): Promise<{
    sessions: any[];
    error?: string;
  }> {
    try {
      const { data: sessions, error } = await this.adminClient
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        return { sessions: [], error: error.message };
      }

      return { sessions: sessions || [] };

    } catch (error) {
      return {
        sessions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 强制登出指定会话
   */
  public async forceLogoutSession(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.adminClient
        .from('user_sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 用户登出时清理会话
   */
  public async logoutSession(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.adminClient
        .from('user_sessions')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 清理过期的会话（定时任务用）
   */
  public async cleanupExpiredSessions(): Promise<{
    cleanedCount: number;
    error?: string;
  }> {
    try {
      // 清理超过24小时的非活跃会话
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.adminClient
        .from('user_sessions')
        .delete()
        .lt('last_activity_at', oneDayAgo)
        .eq('is_active', false);

      if (error) {
        return { cleanedCount: 0, error: error.message };
      }

      return { cleanedCount: (data as any)?.length || 0 };

    } catch (error) {
      return {
        cleanedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}