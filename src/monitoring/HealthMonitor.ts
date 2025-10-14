/**
 * Health Monitor Service
 * Monitors the health of all ChainReactions services
 */

import {
  ServiceHealth,
  HealthCheckResult,
  ServiceDependencies
} from './types/MonitoringTypes';

import {
  SERVICE_REGISTRY,
  HEALTH_THRESHOLDS,
  MONITORING_CONFIG
} from './config/MonitoringConfig';

import { logger } from '../utils/Logger';

export class HealthMonitor {
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.initializeServiceHealth();
  }

  /**
   * Initialize health tracking for all registered services
   */
  private initializeServiceHealth(): void {
    Object.keys(SERVICE_REGISTRY).forEach(serviceName => {
      this.serviceHealth.set(serviceName, {
        service: serviceName,
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        uptime: 100, // Start with 100% uptime
        dependencies: {
          database: 'healthy',
          redis: 'healthy',
          externalApis: {}
        },
        metadata: {
          lastError: null,
          consecutiveFailures: 0,
          totalRequests: 0,
          totalErrors: 0
        }
      });
    });

    logger.info(`Health monitor initialized for ${this.serviceHealth.size} services`);
  }

  /**
   * Start health monitoring
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting health monitor...');

    // Perform initial health check
    this.performAllHealthChecks();

    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performAllHealthChecks();
    }, MONITORING_CONFIG.checkInterval);

    logger.info(`Health monitor started with ${MONITORING_CONFIG.checkInterval}ms interval`);
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Health monitor is not running');
      return;
    }

    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('Health monitor stopped');
  }

  /**
   * Perform health checks for all services
   */
  private async performAllHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.serviceHealth.keys()).map(
      serviceName => this.performHealthCheck(serviceName)
    );

    try {
      await Promise.allSettled(healthCheckPromises);
      logger.debug('All health checks completed');
    } catch (error) {
      logger.error('Error during health checks:', error);
    }
  }

  /**
   * Perform health check for a specific service
   */
  private async performHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    const serviceConfig = SERVICE_REGISTRY[serviceName];
    if (!serviceConfig) {
      logger.warn(`No configuration found for service: ${serviceName}`);
      return this.createHealthResult(serviceName, false, 0, 'Service not configured');
    }

    const startTime = Date.now();

    try {
      // Simulate health check by pinging the service endpoint
      // In a real implementation, this would make HTTP requests
      const isHealthy = await this.checkServiceHealth(serviceName, serviceConfig);
      const responseTime = Date.now() - startTime;

      // Update service health status
      this.updateServiceHealth(serviceName, {
        healthy: isHealthy,
        responseTime,
        error: isHealthy ? undefined : 'Health check failed'
      });

      // Check service dependencies
      await this.checkServiceDependencies(serviceName);

      return this.createHealthResult(serviceName, isHealthy, responseTime);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Health check failed for ${serviceName}:`, errorMessage);

      this.updateServiceHealth(serviceName, {
        healthy: false,
        responseTime,
        error: errorMessage
      });

      return this.createHealthResult(serviceName, false, responseTime, errorMessage);
    }
  }

  /**
   * Check if a service is healthy
   */
  private async checkServiceHealth(serviceName: string, serviceConfig: any): Promise<boolean> {
    // For now, we'll simulate health checks
    // In a real implementation, this would make HTTP requests to service endpoints

    // Simulate different service behaviors based on service type
    switch (serviceName) {
      case 'entity-relations':
        // Simulate potential issues with the heavy DeepThinking service
        return Math.random() > 0.05; // 95% uptime

      case 'dataset-search':
        // Simulate moderate reliability
        return Math.random() > 0.02; // 98% uptime

      case 'entity-search':
        // High reliability
        return Math.random() > 0.01; // 99% uptime

      case 'data-management':
        // Very high reliability
        return Math.random() > 0.005; // 99.5% uptime

      default:
        // Default to healthy for unknown services
        return true;
    }
  }

  /**
   * Check service dependencies
   */
  private async checkServiceDependencies(serviceName: string): Promise<void> {
    const serviceHealth = this.serviceHealth.get(serviceName);
    if (!serviceHealth) return;

    const serviceConfig = SERVICE_REGISTRY[serviceName];
    if (!serviceConfig.dependencies) return;

    // Check database health
    if (serviceConfig.dependencies.includes('database')) {
      serviceHealth.dependencies.database = await this.checkDatabaseHealth();
    }

    // Check Redis health
    if (serviceConfig.dependencies.includes('redis')) {
      serviceHealth.dependencies.redis = await this.checkRedisHealth();
    }

    // Check external API health
    const externalApis = ['gemini-api', 'linkup-api', 'nro-api', 'gmail-smtp'];
    for (const api of externalApis) {
      if (serviceConfig.dependencies.includes(api)) {
        serviceHealth.dependencies.externalApis[api] = await this.checkExternalApiHealth(api);
      }
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      // Simulate database health check
      // In a real implementation, this would test database connectivity
      const random = Math.random();
      if (random > 0.98) return 'down';
      if (random > 0.95) return 'degraded';
      return 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
      return 'down';
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      // Simulate Redis health check
      // In a real implementation, this would test Redis connectivity
      const random = Math.random();
      if (random > 0.99) return 'down';
      if (random > 0.96) return 'degraded';
      return 'healthy';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return 'down';
    }
  }

  /**
   * Check external API health
   */
  private async checkExternalApiHealth(apiName: string): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      // Simulate external API health check
      // In a real implementation, this would test API connectivity
      const random = Math.random();
      if (random > 0.97) return 'down';
      if (random > 0.93) return 'degraded';
      return 'healthy';
    } catch (error) {
      logger.error(`${apiName} health check failed:`, error);
      return 'down';
    }
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceName: string, result: {
    healthy: boolean;
    responseTime: number;
    error?: string;
  }): void {
    const serviceHealth = this.serviceHealth.get(serviceName);
    if (!serviceHealth) return;

    const currentTime = new Date();
    const wasHealthy = serviceHealth.status === 'healthy';

    // Update basic health info
    serviceHealth.lastCheck = currentTime;
    serviceHealth.responseTime = result.responseTime;

    // Update error tracking
    serviceHealth.metadata!.totalRequests++;
    if (!result.healthy) {
      serviceHealth.metadata!.totalErrors++;
      serviceHealth.metadata!.consecutiveFailures++;
      serviceHealth.metadata!.lastError = result.error;
    } else {
      serviceHealth.metadata!.consecutiveFailures = 0;
      serviceHealth.metadata!.lastError = null;
    }

    // Calculate error rate (last 100 requests)
    const totalRequests = serviceHealth.metadata!.totalRequests;
    const totalErrors = serviceHealth.metadata!.totalErrors;
    serviceHealth.errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    // Determine status based on various factors
    serviceHealth.status = this.determineServiceStatus(serviceHealth);

    // Log status changes
    if (wasHealthy && serviceHealth.status !== 'healthy') {
      logger.warn(`Service ${serviceName} status changed to ${serviceHealth.status}`);
    } else if (!wasHealthy && serviceHealth.status === 'healthy') {
      logger.info(`Service ${serviceName} recovered and is now healthy`);
    }
  }

  /**
   * Determine service status based on health metrics
   */
  private determineServiceStatus(serviceHealth: ServiceHealth): 'healthy' | 'degraded' | 'down' {
    const { responseTime, errorRate, dependencies } = serviceHealth;

    // Check if any critical dependencies are down
    if (dependencies.database === 'down' || dependencies.redis === 'down') {
      return 'down';
    }

    // Check response time thresholds
    if (responseTime > HEALTH_THRESHOLDS.responseTime.down) {
      return 'down';
    }
    if (responseTime > HEALTH_THRESHOLDS.responseTime.degraded) {
      return 'degraded';
    }

    // Check error rate thresholds
    if (errorRate > HEALTH_THRESHOLDS.errorRate.down) {
      return 'down';
    }
    if (errorRate > HEALTH_THRESHOLDS.errorRate.degraded) {
      return 'degraded';
    }

    // Check external API dependencies
    const failedExternalApis = Object.values(dependencies.externalApis)
      .filter(status => status === 'down').length;
    const totalExternalApis = Object.keys(dependencies.externalApis).length;

    if (totalExternalApis > 0 && failedExternalApis === totalExternalApis) {
      return 'down';
    }

    return 'healthy';
  }

  /**
   * Create health check result object
   */
  private createHealthResult(
    serviceName: string,
    healthy: boolean,
    responseTime: number,
    error?: string
  ): HealthCheckResult {
    return {
      service: serviceName,
      healthy,
      responseTime,
      error,
      timestamp: new Date()
    };
  }

  /**
   * Get health status for all services
   */
  public getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Get health status for a specific service
   */
  public getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get overall system health summary
   */
  public getSystemHealthSummary(): {
    overall: 'healthy' | 'degraded' | 'down';
    services: ServiceHealth[];
    timestamp: Date;
  } {
    const services = this.getAllServiceHealth();
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const totalServices = services.length;

    let overall: 'healthy' | 'degraded' | 'down';

    if (healthyServices === totalServices) {
      overall = 'healthy';
    } else if (healthyServices > totalServices * 0.7) {
      overall = 'degraded';
    } else {
      overall = 'down';
    }

    return {
      overall,
      services,
      timestamp: new Date()
    };
  }

  /**
   * Manually trigger health check for all services
   */
  public async triggerHealthCheck(): Promise<void> {
    logger.info('Manual health check triggered');
    await this.performAllHealthChecks();
  }

  /**
   * Manually trigger health check for specific service
   */
  public async triggerServiceHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    logger.info(`Manual health check triggered for ${serviceName}`);
    return await this.performHealthCheck(serviceName);
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();