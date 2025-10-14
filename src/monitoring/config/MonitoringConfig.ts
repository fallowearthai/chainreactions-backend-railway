/**
 * Monitoring System Configuration
 * ChainReactions Backend Monitoring
 */

import { ServiceRegistry, MonitoringConfig } from '../types/MonitoringTypes';

export const MONITORING_CONFIG: MonitoringConfig = {
  checkInterval: 30000, // 30 seconds
  alertCooldown: 300000, // 5 minutes
  metricsRetention: 2592000000, // 30 days in milliseconds
  enableSystemMetrics: true,
  enableBusinessMetrics: true,
  enableAlerts: true,
  enableFallbacks: true,
};

export const SERVICE_REGISTRY: ServiceRegistry = {
  'entity-relations': {
    endpoint: '/api/enhanced/search',
    timeout: 120000, // 2 minutes
    retries: 2,
    healthCheckPath: '/api/health',
    dependencies: ['database', 'gemini-api']
  },
  'entity-search': {
    endpoint: '/api/entity-search',
    timeout: 30000, // 30 seconds
    retries: 3,
    healthCheckPath: '/api/health',
    dependencies: ['database', 'linkup-api']
  },
  'dataset-matching': {
    endpoint: '/api/dataset-matching/match',
    timeout: 60000, // 1 minute
    retries: 2,
    healthCheckPath: '/api/health',
    dependencies: ['database']
  },
  'data-management': {
    endpoint: '/api/data-management/datasets',
    timeout: 15000, // 15 seconds
    retries: 3,
    healthCheckPath: '/api/health',
    dependencies: ['database']
  },
  'dataset-search': {
    endpoint: '/api/dataset-search/stream',
    timeout: 180000, // 3 minutes
    retries: 1,
    healthCheckPath: '/api/health',
    dependencies: ['database', 'nro-api']
  },
  'demo-email': {
    endpoint: '/api/demo-request',
    timeout: 10000, // 10 seconds
    retries: 2,
    healthCheckPath: '/api/health',
    dependencies: ['gmail-smtp']
  }
};

export const HEALTH_THRESHOLDS = {
  responseTime: {
    healthy: 5000,    // 5 seconds
    degraded: 15000,  // 15 seconds
    down: 30000       // 30 seconds
  },
  errorRate: {
    healthy: 0.01,    // 1%
    degraded: 0.05,   // 5%
    down: 0.10        // 10%
  },
  uptime: {
    healthy: 0.99,    // 99%
    degraded: 0.95,   // 95%
    down: 0.90        // 90%
  }
};

export const SYSTEM_THRESHOLDS = {
  cpu: {
    healthy: 70,      // 70%
    degraded: 85,     // 85%
    critical: 95      // 95%
  },
  memory: {
    healthy: 75,      // 75%
    degraded: 85,     // 85%
    critical: 95      // 95%
  },
  disk: {
    healthy: 80,      // 80%
    degraded: 90,     // 90%
    critical: 95      // 95%
  }
};

export const BUSINESS_THRESHOLDS = {
  queueLength: {
    healthy: 5,
    degraded: 15,
    critical: 25
  },
  responseTime: {
    entityRelations: {
      healthy: 120000,    // 2 minutes
      degraded: 180000,   // 3 minutes
      critical: 300000    // 5 minutes
    },
    datasetSearch: {
      healthy: 45000,     // 45 seconds
      degraded: 90000,    // 1.5 minutes
      critical: 180000    // 3 minutes
    }
  },
  apiUsage: {
    warning: 0.8,     // 80% of limit
    critical: 0.95    // 95% of limit
  }
};