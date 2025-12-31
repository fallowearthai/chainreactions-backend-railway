/**
 * Simple Session Client
 *
 * 基于定时检查的简单会话管理客户端
 * 不依赖实时功能，使用定期轮询检查会话状态
 */

class SimpleSessionClient {
  constructor(options = {}) {
    this.config = {
      validationInterval: options.validationInterval || 30000, // 30秒
      maxValidationAttempts: options.maxValidationAttempts || 3,
      activityUpdateInterval: options.activityUpdateInterval || 300000, // 5分钟
      apiUrl: options.apiUrl || this.getApiUrl(),
      ...options
    };

    this.currentUser = null;
    this.currentSession = null;
    this.validationTimer = null;
    this.activityTimer = null;
    this.validationFailures = 0;
    this.isMonitoring = false;
  }

  /**
   * 初始化会话监控
   */
  async initialize(userData, sessionData) {
    try {
      console.log('🔐 Initializing simple session monitoring...');

      // 保存用户和会话信息
      this.currentUser = userData;
      this.currentSession = sessionData;

      // 启动定时检查
      this.startSessionValidation();

      // 启动活动更新
      this.startActivityUpdate();

      this.isMonitoring = true;
      console.log('✅ Session monitoring started');
      console.log(`📊 Check interval: ${this.config.validationInterval}ms`);

      return true;

    } catch (error) {
      console.error('❌ Session monitoring initialization failed:', error);
      return false;
    }
  }

  /**
   * 启动会话验证定时器
   */
  startSessionValidation() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    this.validationTimer = setInterval(async () => {
      await this.checkSessionStatus();
    }, this.config.validationInterval);

    console.log(`🔄 Session validation timer started (${this.config.validationInterval}ms interval)`);
  }

  /**
   * 启动活动更新定时器
   */
  startActivityUpdate() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }

    this.activityTimer = setInterval(async () => {
      await this.updateActivity();
    }, this.config.activityUpdateInterval);

    console.log(`📝 Activity update timer started (${this.config.activityUpdateInterval}ms interval)`);
  }

  /**
   * 检查会话状态
   */
  async checkSessionStatus() {
    try {
      if (!this.currentSession || !this.currentUser) {
        console.warn('⚠️ Missing session info, skipping validation');
        return;
      }

      const response = await fetch(`${this.config.apiUrl}/api/auth/check-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentSession.access_token}`
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ 会话检查失败: ${response.status}`);
        this.handleValidationFailure('API_ERROR');
        return;
      }

      const result = await response.json();

      if (!result.success) {
        console.warn('⚠️ 会话检查返回失败:', result);
        this.handleValidationFailure('VALIDATION_FAILED');
        return;
      }

      const { isValid, isActive } = result.data;

      if (!isValid || !isActive) {
        console.log('🚨 Session invalid, need to re-login');
        this.handleSessionKicked('SESSION_INVALID');
        return;
      }

      // Reset failure count
      this.validationFailures = 0;
      console.log('✅ Session validation passed');

    } catch (error) {
      console.error('❌ 会话验证出错:', error);
      this.handleValidationFailure('NETWORK_ERROR');
    }
  }

  /**
   * 更新活动时间
   */
  async updateActivity() {
    try {
      if (!this.currentSession) {
        return;
      }

      const response = await fetch(`${this.config.apiUrl}/api/auth/update-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentSession.access_token}`
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ 活动更新失败: ${response.status}`);
        return;
      }

      console.log('📝 活动时间已更新');

    } catch (error) {
      console.error('❌ 活动更新出错:', error);
    }
  }

  /**
   * Handle validation failure
   */
  handleValidationFailure(reason) {
    this.validationFailures++;

    console.log(`⚠️ Validation failure #${this.validationFailures}: ${reason}`);

    if (this.validationFailures >= this.config.maxValidationAttempts) {
      console.log('❌ Too many validation failures, forcing logout');
      this.handleSessionKicked('VALIDATION_EXCEEDED');
    }
  }

  /**
   * Handle session kickout
   */
  handleSessionKicked(reason) {
    console.log(`🚨 Session kicked out: ${reason}`);

    // 显示用户友好的消息
    const message = this.getKickoutMessage(reason);
    this.showNotification(message, 'warning');

    // 清理定时器
    this.cleanup();

    // 触发回调
    if (this.config.onSessionKicked) {
      this.config.onSessionKicked(reason, message);
    }

    // 默认行为：跳转到登录页
    if (this.config.autoRedirect !== false) {
      setTimeout(() => {
        window.location.href = `/login?message=${encodeURIComponent(message)}`;
      }, 2000);
    }
  }

  /**
   * 获取踢出消息
   */
  getKickoutMessage(reason) {
    const messages = {
      'NEW_LOGIN': 'Your account has been logged in on another device. Current session has ended.',
      'SESSION_INVALID': 'Session has expired. Please log in again.',
      'VALIDATION_EXCEEDED': 'Session validation failed. Please log in again.',
      'ADMIN_LOGOUT': 'You have been logged out by an administrator. Please log in again.',
      'NETWORK_ERROR': 'Network connection error. Please log in again.'
    };

    return messages[reason] || 'Session has ended. Please log in again.';
  }

  /**
   * 显示通知
   */
  showNotification(message, type = 'info') {
    // 浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('ChainReactions Account Security', {
        body: message,
        icon: '/favicon.ico'
      });
    } else if ('Notification' in window && Notification.permission === 'default') {
      // 请求通知权限
      Notification.requestPermission();
    }

    // 控制台日志
    console.log(`[${type.toUpperCase()}] ${message}`);

    // 自定义UI通知（如果有）
    if (this.config.onNotification) {
      this.config.onNotification(message, type);
    }
  }

  /**
   * 手动检查会话状态
   */
  async manualCheck() {
    await this.checkSessionStatus();
  }

  /**
   * 获取当前会话信息
   */
  getSessionInfo() {
    return {
      user: this.currentUser,
      session: this.currentSession,
      isMonitoring: this.isMonitoring,
      validationFailures: this.validationFailures
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('⏹️ Stopping session monitoring');
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    this.isMonitoring = false;
    console.log('🧹 Session monitoring resources cleaned up');
  }

  /**
   * 获取API基础URL
   */
  getApiUrl() {
    // 根据环境返回API URL
    if (typeof window !== 'undefined') {
      // 浏览器环境
      return window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? 'http://localhost:3007'
        : window.location.origin;
    }

    // Node.js环境
    return process.env.NODE_ENV === 'production'
      ? 'https://your-production-api.com'
      : 'http://localhost:3007';
  }

  /**
   * 销毁客户端实例
   */
  destroy() {
    this.cleanup();
    this.currentUser = null;
    this.currentSession = null;
    this.validationFailures = 0;
  }
}

/**
 * 全局会话管理器
 */
class GlobalSessionManager {
  constructor() {
    this.client = null;
  }

  /**
   * 初始化全局会话管理
   */
  async init(userData, sessionData, options = {}) {
    if (this.client) {
      this.client.destroy();
    }

    this.client = new SimpleSessionClient(options);
    return await this.client.initialize(userData, sessionData);
  }

  /**
   * 停止会话管理
   */
  stop() {
    if (this.client) {
      this.client.stop();
    }
  }

  /**
   * 获取会话信息
   */
  getInfo() {
    return this.client ? this.client.getSessionInfo() : null;
  }

  /**
   * 手动检查会话
   */
  async check() {
    if (this.client) {
      await this.client.manualCheck();
    }
  }
}

// 创建全局实例
const sessionManager = new GlobalSessionManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimpleSessionClient, GlobalSessionManager, sessionManager };
} else {
  window.SimpleSessionClient = SimpleSessionClient;
  window.sessionManager = sessionManager;
}

/**
 * 使用示例:
 *
 * // 登录成功后
 * await sessionManager.init(userData, sessionData, {
 *   onSessionKicked: (reason, message) => {
 *     console.log('被踢出:', reason, message);
 *     // 自定义处理逻辑
 *   },
 *   onNotification: (message, type) => {
 *     // 自定义通知显示
 *     showToast(message, type);
 *   },
 *   validationInterval: 30000, // 30秒检查一次
 *   autoRedirect: true // 自动跳转到登录页
 * });
 *
 * // 登出时
 * sessionManager.stop();
 *
 * // 手动检查会话
 * await sessionManager.check();
 */