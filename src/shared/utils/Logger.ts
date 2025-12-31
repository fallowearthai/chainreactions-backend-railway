/**
 * Commercial-Grade Logging Utility
 * Provides environment-aware, structured logging with sanitization
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogMetadata {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  message: string;
  metadata?: LogMetadata;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Logger class for commercial SaaS applications
 * Features:
 * - Environment-aware logging (dev vs prod)
 * - Structured logging with metadata
 * - Log level filtering
 * - Sensitive data sanitization
 * - JSON format for production, text for development
 */
export class Logger {
  private serviceName: string;
  private environment: string;
  private logLevel: LogLevel;
  private isProduction: boolean;

  // Sensitive field patterns to mask
  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /api[_-]?key/i,
    /secret/i,
    /credential/i,
    /authorization/i,
    /session/i
  ];

  constructor(serviceName: string, environment?: string) {
    this.serviceName = serviceName;
    this.environment = environment || process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';

    // Set log level based on environment
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLogLevel && envLogLevel in LogLevel) {
      this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel];
    } else {
      this.logLevel = this.isProduction ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log trace message
   */
  trace(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata, error?: Error): void {
    // Check if this log level should be output
    if (level > this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    // Sanitize metadata to remove sensitive data
    const sanitizedMetadata = metadata ? this.sanitizeMetadata(metadata) : undefined;

    // Build log entry
    const entry: LogEntry = {
      timestamp,
      level: levelName,
      service: this.serviceName,
      environment: this.environment,
      message,
      metadata: sanitizedMetadata
    };

    // Add error information if provided
    if (error) {
      entry.error = {
        message: error.message
      };

      // Only include stack trace in development
      if (!this.isProduction && error.stack) {
        entry.error.stack = error.stack;
      }
    }

    // Output based on format preference
    if (this.isProduction || process.env.LOG_FORMAT === 'json') {
      // JSON format for production
      console.log(JSON.stringify(entry));
    } else {
      // Readable text format for development
      const textMessage = this.formatTextMessage(entry);
      console.log(textMessage);
    }
  }

  /**
   * Format log entry as readable text
   */
  private formatTextMessage(entry: LogEntry): string {
    const { timestamp, level, service, message, metadata, error } = entry;

    let parts = `[${timestamp}] [${level}] [${service}] ${message}`;

    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      const metadataStr = Object.entries(metadata)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      parts += ` (${metadataStr})`;
    }

    // Add error if present
    if (error) {
      parts += ` | Error: ${error.message}`;
      if (error.stack) {
        parts += `\n${error.stack}`;
      }
    }

    return parts;
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    const sanitized: LogMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Check if key matches sensitive pattern
      const isSensitive = Logger.SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

      if (isSensitive) {
        // Mask sensitive values
        sanitized[key] = this.maskValue(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Mask sensitive value
   */
  private maskValue(value: any): string {
    const strValue = String(value);

    if (strValue.length <= 8) {
      // For short values, show only first character
      return strValue.charAt(0) + '***';
    } else {
      // For longer values, show first 4 and last 4 characters
      return strValue.substring(0, 4) + '...' + strValue.substring(strValue.length - 4);
    }
  }

  /**
   * Sanitize a path by masking IDs
   */
  sanitizePath(path: string): string {
    // Replace UUIDs and numeric IDs with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Mask a user ID for logging
   */
  maskUserId(userId: string): string {
    if (!userId || userId.length < 8) return '***';
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  }
}
