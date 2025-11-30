/**
 * Cache Service Logger
 *
 * Specialized logger for cache operations with performance tracking
 * and structured logging for debugging and monitoring
 */

import { PerformanceUtils } from '../utils/CommonUtilities';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: 'cache';
  operation: string;
  message: string;
  data?: any;
  duration?: number;
}

export class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogSize = 1000;

  static debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private static log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'cache',
      operation: this.getCallerFunction(),
      message,
      data
    };

    this.logs.push(entry);

    // Keep log size manageable
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Console output
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${entry.service}] [${entry.operation}]`;
    const logMessage = `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
    }
  }

  private static getCallerFunction(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const lines = stack.split('\n');
    // Skip current function and log function
    const callerLine = lines[4];
    if (!callerLine) return 'unknown';

    const match = callerLine.match(/at\s+([^\s]+)/);
    return match ? match[1] : 'unknown';
  }

  static getLogs(level?: 'debug' | 'info' | 'warn' | 'error', limit?: number): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export default Logger;