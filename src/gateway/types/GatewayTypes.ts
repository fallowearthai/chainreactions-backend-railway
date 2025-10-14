/**
 * API Gateway Types
 * ChainReactions Backend - Phase 2
 */

export interface ServiceRegistry {
  serviceName: string;
  host: string;
  port: number;
  health: string;
  protocol: 'http' | 'https';
  timeout: number;
  retries: number;
  circuitBreakerThreshold: number;
  lastHealthCheck: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
  services?: string[]; // For services that host multiple sub-services
}

export interface RouteConfig {
  path: string;
  targetService: string;
  method?: string | string[];
  middleware?: string[];
  rewrite?: {
    from: string;
    to: string;
  };
  timeout?: number;
  retries?: number;
}

export interface GatewayConfig {
  port: number;
  host: string;
  timeout: number;
  retries: number;
  circuitBreakerThreshold: number;
  healthCheckInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface ProxyRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
  service: string;
}

export interface ServiceMetrics {
  serviceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequest: Date;
  currentConnections: number;
  circuitBreakerTrips: number;
}

export interface CircuitBreakerState {
  service: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
}

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

// Gateway middleware interface
export interface GatewayMiddleware {
  name: string;
  execute: (req: ProxyRequest, res: any, next: () => void) => Promise<void> | void;
}

// Load balancer interface
export interface LoadBalancer {
  selectService(services: ServiceRegistry[]): ServiceRegistry | null;
  updateServiceHealth(serviceName: string, healthy: boolean): void;
}

// Service discovery interface
export interface ServiceDiscovery {
  registerService(service: ServiceRegistry): Promise<void>;
  deregisterService(serviceName: string): Promise<void>;
  getServices(serviceName?: string): Promise<ServiceRegistry[]>;
  watchService(serviceName: string, callback: (services: ServiceRegistry[]) => void): void;
}