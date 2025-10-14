/**
 * Load Balancer Implementation
 * ChainReactions Backend - Phase 2
 */

import { LoadBalancer as ILoadBalancer, ServiceRegistry } from '../types/GatewayTypes';
import { logger } from '../../utils/Logger';

export interface LoadBalancerStrategy {
  selectService(services: ServiceRegistry[]): ServiceRegistry | null;
}

export class RoundRobinStrategy implements LoadBalancerStrategy {
  private counters: Map<string, number> = new Map();

  selectService(services: ServiceRegistry[]): ServiceRegistry | null {
    if (services.length === 0) return null;
    if (services.length === 1) return services[0];

    // Filter healthy services only
    const healthyServices = services.filter(s => s.status === 'healthy');
    if (healthyServices.length === 0) return null;
    if (healthyServices.length === 1) return healthyServices[0];

    const serviceName = healthyServices[0].serviceName;
    const currentCounter = this.counters.get(serviceName) || 0;
    const selectedIndex = currentCounter % healthyServices.length;

    this.counters.set(serviceName, currentCounter + 1);

    return healthyServices[selectedIndex];
  }
}

export class LeastConnectionsStrategy implements LoadBalancerStrategy {
  selectService(services: ServiceRegistry[]): ServiceRegistry | null {
    if (services.length === 0) return null;
    if (services.length === 1) return services[0];

    // Filter healthy services only
    const healthyServices = services.filter(s => s.status === 'healthy');
    if (healthyServices.length === 0) return null;
    if (healthyServices.length === 1) return healthyServices[0];

    // For now, use round robin as we don't have connection tracking
    // This can be enhanced later with actual connection tracking
    const strategy = new RoundRobinStrategy();
    return strategy.selectService(healthyServices);
  }
}

export class RandomStrategy implements LoadBalancerStrategy {
  selectService(services: ServiceRegistry[]): ServiceRegistry | null {
    if (services.length === 0) return null;
    if (services.length === 1) return services[0];

    // Filter healthy services only
    const healthyServices = services.filter(s => s.status === 'healthy');
    if (healthyServices.length === 0) return null;
    if (healthyServices.length === 1) return healthyServices[0];

    const randomIndex = Math.floor(Math.random() * healthyServices.length);
    return healthyServices[randomIndex];
  }
}

export class LoadBalancer implements ILoadBalancer {
  private strategy: LoadBalancerStrategy;
  private serviceHealth: Map<string, Map<string, boolean>> = new Map();

  constructor(strategy: LoadBalancerStrategy = new RoundRobinStrategy()) {
    this.strategy = strategy;
  }

  /**
   * Select a service instance using the configured strategy
   */
  public selectService(services: ServiceRegistry[]): ServiceRegistry | null {
    if (services.length === 0) {
      logger.warn('No services available for load balancing');
      return null;
    }

    const selectedService = this.strategy.selectService(services);

    if (selectedService) {
      logger.debug(`Selected service instance: ${selectedService.serviceName} at ${selectedService.host}:${selectedService.port}`);
    } else {
      logger.warn('No healthy services available');
    }

    return selectedService;
  }

  /**
   * Update service health status
   */
  public updateServiceHealth(serviceName: string, healthy: boolean): void {
    if (!this.serviceHealth.has(serviceName)) {
      this.serviceHealth.set(serviceName, new Map());
    }

    const serviceHealthMap = this.serviceHealth.get(serviceName)!;
    const healthKey = `${serviceName}-overall`;
    serviceHealthMap.set(healthKey, healthy);

    logger.debug(`Updated health for ${serviceName}: ${healthy}`);
  }

  /**
   * Update service instance health
   */
  public updateServiceInstanceHealth(serviceName: string, instanceId: string, healthy: boolean): void {
    if (!this.serviceHealth.has(serviceName)) {
      this.serviceHealth.set(serviceName, new Map());
    }

    const serviceHealthMap = this.serviceHealth.get(serviceName)!;
    serviceHealthMap.set(instanceId, healthy);

    logger.debug(`Updated health for ${serviceName} instance ${instanceId}: ${healthy}`);
  }

  /**
   * Get service health status
   */
  public getServiceHealth(serviceName: string): boolean {
    const serviceHealthMap = this.serviceHealth.get(serviceName);
    if (!serviceHealthMap) return false;

    const healthKey = `${serviceName}-overall`;
    return serviceHealthMap.get(healthKey) || false;
  }

  /**
   * Get service instance health status
   */
  public getServiceInstanceHealth(serviceName: string, instanceId: string): boolean {
    const serviceHealthMap = this.serviceHealth.get(serviceName);
    if (!serviceHealthMap) return false;

    return serviceHealthMap.get(instanceId) || false;
  }

  /**
   * Change load balancing strategy
   */
  public setStrategy(strategy: LoadBalancerStrategy): void {
    this.strategy = strategy;
    logger.info(`Load balancer strategy changed to ${strategy.constructor.name}`);
  }

  /**
   * Get current strategy name
   */
  public getStrategyName(): string {
    return this.strategy.constructor.name;
  }

  /**
   * Get load balancer statistics
   */
  public getStatistics(): {
    totalServices: number;
    healthyServices: number;
    strategy: string;
    serviceHealth: Record<string, boolean>;
  } {
    const serviceHealth: Record<string, boolean> = {};
    let totalServices = 0;
    let healthyServices = 0;

    for (const [serviceName, healthMap] of this.serviceHealth.entries()) {
      const healthKey = `${serviceName}-overall`;
      const isHealthy = healthMap.get(healthKey) || false;
      serviceHealth[serviceName] = isHealthy;
      totalServices++;
      if (isHealthy) healthyServices++;
    }

    return {
      totalServices,
      healthyServices,
      strategy: this.getStrategyName(),
      serviceHealth
    };
  }
}

// Export load balancer instance with default strategy
export const loadBalancer = new LoadBalancer(new RoundRobinStrategy());

// Export strategies for configuration
export {
  RoundRobinStrategy,
  LeastConnectionsStrategy,
  RandomStrategy
};