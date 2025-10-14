/**
 * Service Discovery Implementation
 * ChainReactions Backend - Phase 2
 */

import { ServiceDiscovery as IServiceDiscovery, ServiceRegistry } from '../types/GatewayTypes';
import { REDIS_CONFIG } from '../config/GatewayConfig';
import { logger } from '../../utils/Logger';
import Redis from 'ioredis';

export class ServiceDiscovery implements IServiceDiscovery {
  private redis: Redis;
  private services: Map<string, ServiceRegistry[]> = new Map();
  private watchers: Map<string, ((services: ServiceRegistry[]) => void)[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.redis = new Redis({
      host: REDIS_CONFIG.host,
      port: REDIS_CONFIG.port,
      password: REDIS_CONFIG.password,
      db: REDIS_CONFIG.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      logger.info('Service discovery connected to Redis');
    });

    this.redis.on('error', (error: any) => {
      logger.error('Service discovery Redis error:', error);
    });
  }

  /**
   * Start service discovery
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Service discovery is already running');
      return;
    }

    try {
      await this.redis.connect();
      await this.loadServicesFromRedis();
      this.startHealthCheckLoop();
      this.isRunning = true;
      logger.info('Service discovery started successfully');
    } catch (error) {
      logger.error('Failed to start service discovery:', error);
      throw error;
    }
  }

  /**
   * Stop service discovery
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Service discovery is not running');
      return;
    }

    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    await this.redis.disconnect();
    logger.info('Service discovery stopped');
  }

  /**
   * Register a service
   */
  public async registerService(service: ServiceRegistry): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:${service.serviceName}`;
      const serviceData = {
        ...service,
        registeredAt: new Date().toISOString(),
        lastHealthCheck: new Date().toISOString()
      };

      await this.redis.hset(key, `${service.host}:${service.port}`, JSON.stringify(serviceData));
      await this.redis.expire(key, 300); // 5 minutes TTL

      // Update local cache
      this.updateLocalServiceCache(service.serviceName);

      logger.info(`Service registered: ${service.serviceName} at ${service.host}:${service.port}`);
    } catch (error) {
      logger.error(`Failed to register service ${service.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Deregister a service
   */
  public async deregisterService(serviceName: string): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:${serviceName}`;
      await this.redis.del(key);

      // Update local cache
      this.services.delete(serviceName);
      this.notifyWatchers(serviceName, []);

      logger.info(`Service deregistered: ${serviceName}`);
    } catch (error) {
      logger.error(`Failed to deregister service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get services by name (all services if not specified)
   */
  public async getServices(serviceName?: string): Promise<ServiceRegistry[]> {
    if (serviceName) {
      return this.services.get(serviceName) || [];
    }

    const allServices: ServiceRegistry[] = [];
    for (const services of this.services.values()) {
      allServices.push(...services);
    }
    return allServices;
  }

  /**
   * Watch a service for changes
   */
  public watchService(serviceName: string, callback: (services: ServiceRegistry[]) => void): void {
    if (!this.watchers.has(serviceName)) {
      this.watchers.set(serviceName, []);
    }
    this.watchers.get(serviceName)!.push(callback);

    // Immediately call with current services
    const currentServices = this.services.get(serviceName) || [];
    callback(currentServices);
  }

  /**
   * Perform health check on a service
   */
  public async performHealthCheck(service: ServiceRegistry): Promise<boolean> {
    try {
      const healthUrl = `${service.protocol}://${service.host}:${service.port}${service.health}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout || 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;

      // Update health status in Redis
      await this.updateServiceHealth(service, isHealthy);

      return isHealthy;
    } catch (error) {
      logger.debug(`Health check failed for ${service.serviceName}:`, error);
      await this.updateServiceHealth(service, false);
      return false;
    }
  }

  /**
   * Get service metrics
   */
  public async getServiceMetrics(serviceName: string): Promise<any> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.metricsKey}:${serviceName}`;
      const data = await this.redis.hgetall(key);
      return data;
    } catch (error) {
      logger.error(`Failed to get metrics for ${serviceName}:`, error);
      return {};
    }
  }

  /**
   * Update service metrics
   */
  public async updateServiceMetrics(serviceName: string, metrics: any): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.metricsKey}:${serviceName}`;
      await this.redis.hmset(key, metrics);
      await this.redis.expire(key, 300); // 5 minutes TTL
    } catch (error) {
      logger.error(`Failed to update metrics for ${serviceName}:`, error);
    }
  }

  /**
   * Get circuit breaker state
   */
  public async getCircuitBreakerState(serviceName: string): Promise<any> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.circuitBreakerKey}:${serviceName}`;
      const data = await this.redis.hgetall(key);
      return data;
    } catch (error) {
      logger.error(`Failed to get circuit breaker state for ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Update circuit breaker state
   */
  public async updateCircuitBreakerState(serviceName: string, state: any): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.circuitBreakerKey}:${serviceName}`;
      await this.redis.hmset(key, {
        ...state,
        updatedAt: new Date().toISOString()
      });
      await this.redis.expire(key, 300); // 5 minutes TTL
    } catch (error) {
      logger.error(`Failed to update circuit breaker state for ${serviceName}:`, error);
    }
  }

  /**
   * Load services from Redis
   */
  private async loadServicesFromRedis(): Promise<void> {
    try {
      const pattern = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:*`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const serviceName = key.replace(`${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:`, '');
        await this.updateLocalServiceCache(serviceName);
      }

      logger.info(`Loaded ${keys.length} services from Redis`);
    } catch (error) {
      logger.error('Failed to load services from Redis:', error);
    }
  }

  /**
   * Update local service cache
   */
  private async updateLocalServiceCache(serviceName: string): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:${serviceName}`;
      const serviceEntries = await this.redis.hgetall(key);

      const services: ServiceRegistry[] = [];
      for (const [instanceId, serviceData] of Object.entries(serviceEntries)) {
        try {
          const service = JSON.parse(serviceData as string);
          services.push({
            ...service,
            lastHealthCheck: new Date(service.lastHealthCheck),
            registeredAt: new Date(service.registeredAt)
          });
        } catch (parseError) {
          logger.error(`Failed to parse service data for ${serviceName}:`, parseError);
        }
      }

      this.services.set(serviceName, services);
      this.notifyWatchers(serviceName, services);
    } catch (error) {
      logger.error(`Failed to update local cache for ${serviceName}:`, error);
    }
  }

  /**
   * Start health check loop
   */
  private startHealthCheckLoop(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performAllHealthChecks();
    }, 30000); // 30 seconds
  }

  /**
   * Perform health checks on all services
   */
  private async performAllHealthChecks(): Promise<void> {
    const allServices = await this.getServices();
    const healthCheckPromises = allServices.map(service =>
      this.performHealthCheck(service).catch(error => {
        logger.error(`Health check error for ${service.serviceName}:`, error);
        return false;
      })
    );

    try {
      await Promise.allSettled(healthCheckPromises);
    } catch (error) {
      logger.error('Error during health checks:', error);
    }
  }

  /**
   * Update service health status
   */
  private async updateServiceHealth(service: ServiceRegistry, healthy: boolean): Promise<void> {
    try {
      const healthKey = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.healthCheckKey}:${service.serviceName}:${service.host}:${service.port}`;
      await this.redis.hmset(healthKey, {
        healthy: healthy.toString(),
        lastCheck: new Date().toISOString()
      });
      await this.redis.expire(healthKey, 60); // 1 minute TTL

      // Update service registry entry
      await this.updateServiceRegistryHealth(service, healthy);
    } catch (error) {
      logger.error(`Failed to update health for ${service.serviceName}:`, error);
    }
  }

  /**
   * Update service registry health status
   */
  private async updateServiceRegistryHealth(service: ServiceRegistry, healthy: boolean): Promise<void> {
    try {
      const key = `${REDIS_CONFIG.keyPrefix}${REDIS_CONFIG.serviceRegistryKey}:${service.serviceName}`;
      const instanceKey = `${service.host}:${service.port}`;
      const serviceData = await this.redis.hget(key, instanceKey);

      if (serviceData) {
        const parsedService = JSON.parse(serviceData);
        parsedService.status = healthy ? 'healthy' : 'unhealthy';
        parsedService.lastHealthCheck = new Date().toISOString();

        await this.redis.hset(key, instanceKey, JSON.stringify(parsedService));
        await this.redis.expire(key, 300); // 5 minutes TTL
      }
    } catch (error) {
      logger.error(`Failed to update registry health for ${service.serviceName}:`, error);
    }
  }

  /**
   * Notify service watchers
   */
  private notifyWatchers(serviceName: string, services: ServiceRegistry[]): void {
    const callbacks = this.watchers.get(serviceName) || [];
    for (const callback of callbacks) {
      try {
        callback(services);
      } catch (error) {
        logger.error(`Error notifying watcher for ${serviceName}:`, error);
      }
    }
  }
}

// Export singleton instance
export const serviceDiscovery = new ServiceDiscovery();