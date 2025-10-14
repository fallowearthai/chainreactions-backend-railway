/**
 * API Gateway Configuration
 * ChainReactions Backend - Phase 2
 */

import { GatewayConfig, RouteConfig } from '../types/GatewayTypes';

export const GATEWAY_CONFIG: GatewayConfig = {
  port: parseInt(process.env.GATEWAY_PORT || '3000', 10),
  host: process.env.GATEWAY_HOST || '0.0.0.0',
  timeout: 30000, // 30 seconds default timeout
  retries: 3,
  circuitBreakerThreshold: 5,
  healthCheckInterval: 30000, // 30 seconds
  logLevel: (process.env.LOG_LEVEL as any) || 'info',
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [
          'https://chainreactions.site',
          'https://chainreactions-frontend-dev.vercel.app',
          'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
          'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
        ]
      : [
          'http://localhost:8080', // Frontend dev server
          'http://localhost:3000', // Alternative dev port
          'http://localhost:3001', // Frontend dev server (mentioned by user)
          'http://localhost:4000', // Main app (Phase 2)
          'http://localhost:4001', // Dataset search (Phase 2)
          'http://localhost:4002', // Entity relations (Phase 2)
          'http://localhost:4003'  // Dataset matching (Phase 2)
        ],
    credentials: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // limit each IP to 1000 requests per windowMs
  }
};

// Service routing configuration
export const ROUTE_CONFIG: RouteConfig[] = [
  // Entity Relations (DeepThinking + Normal) - Port 4002
  {
    path: '/api/enhanced/*',
    targetService: 'entity-relations',
    timeout: 120000 // 2 minutes timeout for heavy processing
  },
  {
    path: '/api/normal-search/*',
    targetService: 'entity-relations',
    timeout: 60000 // 1 minute timeout
  },

  // Dataset Search - Port 4001 (first service to separate)
  {
    path: '/api/dataset-search/*',
    targetService: 'dataset-search',
    timeout: 300000 // 5 minutes timeout for streaming searches
  },

  // Dataset Matching - Port 4003
  {
    path: '/api/dataset-matching/*',
    targetService: 'dataset-matching',
    timeout: 60000 // 1 minute timeout
  },

  // Services remaining in main app - Port 4000
  {
    path: '/api/entity-search/*',
    targetService: 'main-app'
  },
  {
    path: '/api/data-management/*',
    targetService: 'main-app'
  },
  {
    path: '/api/demo-request',
    targetService: 'main-app'
  },
  {
    path: '/api/test-email',
    targetService: 'main-app'
  },

  // Gateway endpoints - handled directly
  {
    path: '/api/monitoring/*',
    targetService: 'gateway'
  },
  {
    path: '/api/health',
    targetService: 'gateway'
  },
  {
    path: '/api',
    targetService: 'gateway'
  }
];

// Service registry initial configuration
export const SERVICE_REGISTRY_CONFIG = {
  'api-gateway': {
    host: 'localhost',
    port: 3000,
    health: '/api/monitoring/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['monitoring', 'gateway']
  },
  'main-app': {
    host: 'localhost',
    port: 4000,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 10000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['entity-search', 'data-management', 'email-service']
  },
  'dataset-search': {
    host: 'localhost',
    port: 4001,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['dataset-search']
  },
  'entity-relations': {
    host: 'localhost',
    port: 4002,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['enhanced-search', 'normal-search']
  },
  'dataset-matching': {
    host: 'localhost',
    port: 4003,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['dataset-matching']
  }
};

// Redis configuration for service discovery
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'chainreactions:gateway:',
  serviceRegistryKey: 'services',
  healthCheckKey: 'health',
  metricsKey: 'metrics',
  circuitBreakerKey: 'circuit-breaker'
};

// Development/Production specific configurations
export const isDevelopment = process.env.NODE_ENV !== 'production';
export const isProduction = process.env.NODE_ENV === 'production';

// Enable/disable features based on environment
export const FEATURE_FLAGS = {
  detailedLogging: isDevelopment,
  requestTracing: isDevelopment,
  performanceMetrics: true,
  circuitBreaker: true,
  rateLimiting: true,
  corsEnabled: true,
  compressionEnabled: true,
  healthCheckLogging: isDevelopment
};