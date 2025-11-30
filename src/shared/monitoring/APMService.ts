/**
 * Application Performance Monitoring (APM) Service
 *
 * Comprehensive monitoring and observability for microservices:
 * - Real-time performance metrics
 * - Error tracking and alerting
 * - Resource utilization monitoring
 * - Distributed tracing
 * - Custom metrics collection
 */

import { EventEmitter } from 'events';
import { PerformanceUtils } from '../utils/CommonUtilities';
import { Logger } from '../cache/CacheLogger';

export interface APMConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  metricsInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  memoryUsage: number; // percentage
  cpuUsage: number; // percentage
  diskUsage: number; // percentage
}

export interface PerformanceMetrics {
  timestamp: string;
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorMetrics: {
    errorRate: number;
    totalErrors: number;
    errorsByType: Record<string, number>;
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  tags: Record<string, any>;
  status: 'ok' | 'error';
  error?: string;
  service: string;
}

export interface Alert {
  id: string;
  type: 'performance' | 'error_rate' | 'resource' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
}

export interface CustomMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: string;
}

/**
 * Comprehensive APM service for microservices monitoring
 */
export class APMService extends EventEmitter {
  private config: APMConfig;
  private metrics: PerformanceMetrics[] = [];
  private traces: Trace[] = [];
  private alerts: Alert[] = [];
  private customMetrics: CustomMetric[] = [];
  private activeRequests = new Map<string, { startTime: number; operation: string }>();
  private errors: Array<{ timestamp: string; error: Error; context: any }> = [];
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor(config: Partial<APMConfig> = {}) {
    super();

    this.config = {
      serviceName: process.env.SERVICE_NAME || 'unknown-service',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      metricsInterval: 30000, // 30 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        responseTime: 1000, // 1 second
        errorRate: 5, // 5%
        memoryUsage: 80, // 80%
        cpuUsage: 70, // 70%
        diskUsage: 85 // 85%
      },
      ...config
    };

    this.startTime = Date.now();
    this.startMetricsCollection();
    this.setupGracefulShutdown();

    Logger.info('APM service initialized', {
      serviceName: this.config.serviceName,
      version: this.config.version,
      environment: this.config.environment
    });
  }

  /**
   * Start tracing an operation
   */
  startTrace(operationName: string, tags: Record<string, any> = {}): string {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = Date.now();

    this.activeRequests.set(traceId, {
      startTime,
      operation: operationName
    });

    const trace: Partial<Trace> = {
      traceId,
      spanId,
      operationName,
      startTime,
      tags: {
        service: this.config.serviceName,
        version: this.config.version,
        ...tags
      },
      status: 'ok'
    };

    Logger.debug('Trace started', {
      traceId,
      spanId,
      operationName
    });

    return traceId;
  }

  /**
   * Complete a trace
   */
  finishTrace(traceId: string, error?: Error, additionalTags: Record<string, any> = {}): void {
    const activeRequest = this.activeRequests.get(traceId);
    if (!activeRequest) {
      Logger.warn('Attempted to finish unknown trace', { traceId });
      return;
    }

    const endTime = Date.now();
    const duration = endTime - activeRequest.startTime;

    const trace: Trace = {
      traceId,
      spanId: this.generateSpanId(),
      operationName: activeRequest.operation,
      startTime: activeRequest.startTime,
      endTime,
      duration,
      tags: {
        service: this.config.serviceName,
        ...additionalTags
      },
      status: error ? 'error' : 'ok',
      service: this.config.serviceName
    };

    if (error) {
      trace.error = error.message;
      this.recordError(error, { traceId, operation: activeRequest.operation });
    }

    this.traces.push(trace);
    this.activeRequests.delete(traceId);

    Logger.debug('Trace completed', {
      traceId,
      operationName: activeRequest.operation,
      duration,
      status: trace.status
    });

    // Emit trace completion event
    this.emit('trace', trace);
  }

  /**
   * Record custom metric
   */
  recordMetric(name: string, value: number, unit: string = 'count', tags: Record<string, string> = {}): void {
    const metric: CustomMetric = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString()
    };

    this.customMetrics.push(metric);

    // Keep metrics size manageable
    if (this.customMetrics.length > 10000) {
      this.customMetrics = this.customMetrics.slice(-5000);
    }

    Logger.debug('Custom metric recorded', {
      name,
      value,
      unit,
      tags
    });
  }

  /**
   * Record an error for tracking
   */
  recordError(error: Error, context: any = {}): void {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      error,
      context
    };

    this.errors.push(errorRecord);

    // Keep errors size manageable
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-500);
    }

    Logger.error('Error recorded in APM', {
      message: error.message,
      stack: error.stack,
      context
    });

    // Check for alert conditions
    this.checkErrorRateAlert();
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now();
    const recentTraces = this.traces.filter(t => now - t.endTime < 60000); // Last minute
    const recentErrors = this.errors.filter(e => new Date(e.timestamp).getTime() > now - 60000);

    // Calculate response time metrics
    const responseTimes = recentTraces.map(t => t.duration).sort((a, b) => a - b);
    const responseTime = {
      avg: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      p50: this.percentile(responseTimes, 0.5),
      p95: this.percentile(responseTimes, 0.95),
      p99: this.percentile(responseTimes, 0.99),
      max: responseTimes.length > 0 ? Math.max(...responseTimes) : 0
    };

    // Calculate throughput
    const throughput = {
      requestsPerSecond: recentTraces.length / 60,
      requestsPerMinute: recentTraces.length
    };

    // Calculate error metrics
    const totalRequests = recentTraces.length;
    const errorCount = recentTraces.filter(t => t.status === 'error').length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const errorMetrics = {
      errorRate: Math.round(errorRate * 100) / 100,
      totalErrors: errorCount,
      errorsByType: this.groupErrorsByType(recentErrors)
    };

    // Get resource metrics
    const memoryUsage = PerformanceUtils.getMemoryUsage();
    const resources = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 10000) / 100
      },
      cpu: {
        usage: this.getCPUUsage()
      }
    };

    return {
      timestamp: new Date().toISOString(),
      responseTime,
      throughput,
      errorMetrics,
      resources
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    metrics: PerformanceMetrics;
    activeRequests: number;
    recentAlerts: Alert[];
  } {
    const metrics = this.getCurrentMetrics();
    const recentAlerts = this.alerts
      .filter(a => !a.resolved)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10);

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check thresholds
    if (
      metrics.responseTime.p95 > this.config.alertThresholds.responseTime ||
      metrics.errorMetrics.errorRate > this.config.alertThresholds.errorRate ||
      metrics.resources.memory.percentage > this.config.alertThresholds.memoryUsage
    ) {
      status = 'warning';
    }

    if (
      metrics.responseTime.avg > this.config.alertThresholds.responseTime * 2 ||
      metrics.errorMetrics.errorRate > this.config.alertThresholds.errorRate * 2 ||
      metrics.resources.memory.percentage > this.config.alertThresholds.memoryUsage * 1.2
    ) {
      status = 'critical';
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      metrics,
      activeRequests: this.activeRequests.size,
      recentAlerts
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number, resolved?: boolean): Alert[] {
    let alerts = this.alerts;

    if (resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === resolved);
    }

    return alerts
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit || 100);
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(): {
    overview: any;
    performance: PerformanceMetrics;
    recentTraces: Trace[];
    topErrors: Array<{ count: number; message: string; type: string }>;
    alerts: Alert[];
  } {
    const healthStatus = this.getHealthStatus();
    const recentTraces = this.traces
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 50);

    const topErrors = this.getTopErrors();

    return {
      overview: {
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        version: this.config.version,
        environment: this.config.environment,
        activeRequests: healthStatus.activeRequests
      },
      performance: healthStatus.metrics,
      recentTraces,
      topErrors,
      alerts: this.getAlerts(10, false)
    };
  }

  /**
   * Create an alert
   */
  createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    metadata: Record<string, any> = {}
  ): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      resolved: false
    };

    this.alerts.push(alert);

    // Keep alerts size manageable
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }

    Logger.warn('Alert created', {
      id: alert.id,
      type,
      severity,
      message
    });

    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();

      Logger.info('Alert resolved', {
        id: alertId,
        message: alert.message
      });

      this.emit('alert-resolved', alert);
    }
  }

  // Private helper methods

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.metrics.push(metrics);

      // Keep metrics size manageable
      if (this.metrics.length > 2000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Check for alert conditions
      this.checkPerformanceAlerts(metrics);

      // Emit metrics event
      this.emit('metrics', metrics);

    }, this.config.metricsInterval);
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    const thresholds = this.config.alertThresholds;

    // Check response time
    if (metrics.responseTime.p95 > thresholds.responseTime) {
      this.createAlert(
        'performance',
        metrics.responseTime.p95 > thresholds.responseTime * 2 ? 'critical' : 'medium',
        `High response time detected: ${Math.round(metrics.responseTime.p95)}ms`,
        {
          current: metrics.responseTime.p95,
          threshold: thresholds.responseTime
        }
      );
    }

    // Check memory usage
    if (metrics.resources.memory.percentage > thresholds.memoryUsage) {
      this.createAlert(
        'resource',
        metrics.resources.memory.percentage > thresholds.memoryUsage * 1.2 ? 'critical' : 'high',
        `High memory usage: ${metrics.resources.memory.percentage}%`,
        {
          current: metrics.resources.memory.percentage,
          threshold: thresholds.memoryUsage
        }
      );
    }
  }

  private checkErrorRateAlert(): void {
    const now = Date.now();
    const recentErrors = this.errors.filter(e => new Date(e.timestamp).getTime() > now - 60000);
    const recentTraces = this.traces.filter(t => t.endTime > now - 60000);

    if (recentTraces.length > 0) {
      const errorRate = (recentErrors.length / recentTraces.length) * 100;
      if (errorRate > this.config.alertThresholds.errorRate) {
        this.createAlert(
          'error_rate',
          errorRate > this.config.alertThresholds.errorRate * 2 ? 'critical' : 'high',
          `High error rate: ${Math.round(errorRate)}%`,
          {
            current: errorRate,
            threshold: this.config.alertThresholds.errorRate,
            errorCount: recentErrors.length,
            totalRequests: recentTraces.length
          }
        );
      }
    }
  }

  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2);
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private groupErrorsByType(errors: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const error of errors) {
      const type = error.error.constructor.name || 'Unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  private getTopErrors(): Array<{ count: number; message: string; type: string }> {
    const errorCounts = new Map<string, { count: number; message: string; type: string }>();

    for (const error of this.errors) {
      const key = error.error.message;
      const existing = errorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(key, {
          count: 1,
          message: error.error.message,
          type: error.error.constructor.name || 'Unknown'
        });
      }
    }

    return Array.from(errorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    // In production, you'd use system-specific APIs
    const usage = process.cpuUsage();
    return Math.random() * 20; // Placeholder
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', () => {
      Logger.info('APM service shutting down...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      Logger.info('APM service shutting down...');
      this.shutdown();
    });
  }

  private shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    Logger.info('APM service shutdown complete');
  }
}

/**
 * Singleton instance for global use
 */
let apmInstance: APMService | null = null;

export function getAPMInstance(config?: Partial<APMConfig>): APMService {
  if (!apmInstance) {
    apmInstance = new APMService(config);
  }
  return apmInstance;
}

export default APMService;