/**
 * Monitoring System Type Definitions
 * ChainReactions Backend Monitoring
 */

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  dependencies: ServiceDependencies;
  metadata?: Record<string, any>;
}

export interface ServiceDependencies {
  database: 'healthy' | 'degraded' | 'down';
  redis: 'healthy' | 'degraded' | 'down';
  externalApis: Record<string, 'healthy' | 'degraded' | 'down'>;
}

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface PerformanceMetrics {
  timestamp: Date;
  service: string;
  apiMetrics: ApiMetrics;
  systemMetrics: SystemMetrics;
  businessMetrics: BusinessMetrics;
}

export interface ApiMetrics {
  endpoint: string;
  avgResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  p95ResponseTime: number;
  activeConnections: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
  heapUsed: number;
  heapTotal: number;
}

export interface BusinessMetrics {
  activeSearchTasks: number;
  queueWaitTime: number;
  processedRequests: number;
  successRate: number;
  apiUsage: {
    geminiTokens: number;
    linkupCredits: number;
    brightDataRequests: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number;
  enabled: boolean;
  actions: AlertAction[];
  createdAt: Date;
  lastTriggered?: Date;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log' | 'fallback';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface FallbackStrategy {
  service: string;
  triggers: string[];
  actions: FallbackAction[];
  enabled: boolean;
  priority: number;
}

export interface FallbackAction {
  type: 'disable' | 'throttle' | 'queue' | 'alternative';
  config: Record<string, any>;
}

export interface MonitoringConfig {
  checkInterval: number;
  alertCooldown: number;
  metricsRetention: number;
  enableSystemMetrics: boolean;
  enableBusinessMetrics: boolean;
  enableAlerts: boolean;
  enableFallbacks: boolean;
}

export interface ServiceRegistry {
  [serviceName: string]: {
    endpoint: string;
    timeout: number;
    retries: number;
    healthCheckPath?: string;
    dependencies?: string[];
  };
}