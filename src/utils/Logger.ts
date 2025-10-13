/**
 * Smart Logger Utility
 * Provides environment-aware logging with configurable levels
 */

export enum LogLevel {
  ERROR = 0,   // Always log errors
  WARN = 1,    // Important warnings
  INFO = 2,    // General information
  DEBUG = 3,   // Detailed debugging (development only)
  VERBOSE = 4  // Very detailed logs (development only)
}

class Logger {
  private currentLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    // Set log level based on environment
    this.isProduction = process.env.NODE_ENV === 'production';

    const configuredLevel = process.env.LOG_LEVEL?.toUpperCase();

    if (this.isProduction) {
      // Production: Only ERROR, WARN, and INFO by default
      this.currentLevel = configuredLevel === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO;
    } else {
      // Development: All logs
      this.currentLevel = LogLevel.VERBOSE;
    }

    if (configuredLevel) {
      switch (configuredLevel) {
        case 'ERROR':
          this.currentLevel = LogLevel.ERROR;
          break;
        case 'WARN':
          this.currentLevel = LogLevel.WARN;
          break;
        case 'INFO':
          this.currentLevel = LogLevel.INFO;
          break;
        case 'DEBUG':
          this.currentLevel = LogLevel.DEBUG;
          break;
        case 'VERBOSE':
          this.currentLevel = LogLevel.VERBOSE;
          break;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  /**
   * Log error - always logged
   */
  error(message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (error) {
        console.error(`❌ ${message}`, error);
      } else {
        console.error(`❌ ${message}`);
      }
    }
  }

  /**
   * Log warning - important issues
   */
  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      if (meta) {
        console.warn(`⚠️ ${message}`, meta);
      } else {
        console.warn(`⚠️ ${message}`);
      }
    }
  }

  /**
   * Log info - general information (limited in production)
   */
  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (meta) {
        console.log(`ℹ️ ${message}`, meta);
      } else {
        console.log(`ℹ️ ${message}`);
      }
    }
  }

  /**
   * Log debug - detailed debugging (disabled in production by default)
   */
  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      if (meta) {
        console.log(`🔍 ${message}`, meta);
      } else {
        console.log(`🔍 ${message}`);
      }
    }
  }

  /**
   * Log verbose - very detailed (development only)
   */
  verbose(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      if (meta) {
        console.log(`🔬 ${message}`, meta);
      } else {
        console.log(`🔬 ${message}`);
      }
    }
  }

  /**
   * Log API call - special format for API tracking
   */
  api(method: string, path: string, status: number, duration: number): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const statusEmoji = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
      console.log(`${statusEmoji} ${method} ${path} - ${status} (${duration}ms)`);
    }
  }

  /**
   * Log API call with minimal info (production-friendly)
   */
  apiMinimal(method: string, path: string, status: number): void {
    if (this.shouldLog(LogLevel.INFO) && status >= 400) {
      // Only log errors in production
      console.log(`❌ ${method} ${path} - ${status}`);
    }
  }

  /**
   * Log success with emoji
   */
  success(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (meta) {
        console.log(`✅ ${message}`, meta);
      } else {
        console.log(`✅ ${message}`);
      }
    }
  }

  /**
   * Check if production mode
   */
  isProductionMode(): boolean {
    return this.isProduction;
  }

  /**
   * Get current log level name
   */
  getCurrentLevelName(): string {
    return LogLevel[this.currentLevel];
  }
}

// Export singleton instance
export const logger = new Logger();

// Log startup configuration
if (!logger.isProductionMode()) {
  console.log(`🔧 Logger initialized: ${logger.getCurrentLevelName()} level`);
}
