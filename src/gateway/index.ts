/**
 * API Gateway Module Export
 * ChainReactions Backend - Phase 2
 */

// Core components
export { GatewayServer, gatewayServer } from './GatewayServer';
export { gatewayRouter } from './routers/GatewayRouter';

// Service discovery
export { ServiceDiscovery, serviceDiscovery } from './discovery/ServiceDiscovery';
export { LoadBalancer, loadBalancer, RoundRobinStrategy, LeastConnectionsStrategy, RandomStrategy } from './discovery/LoadBalancer';

// Proxy service
export { ProxyService, proxyService } from './proxy/ProxyService';

// Middleware
export { AuthMiddleware, authMiddleware } from './middleware/AuthMiddleware';
export { RateLimitMiddleware, rateLimitMiddleware } from './middleware/RateLimitMiddleware';
export { LoggingMiddleware, loggingMiddleware } from './middleware/LoggingMiddleware';

// Types and configurations
export * from './types/GatewayTypes';
export { GATEWAY_CONFIG, ROUTE_CONFIG, SERVICE_REGISTRY_CONFIG, REDIS_CONFIG, FEATURE_FLAGS } from './config/GatewayConfig';

// Initialization function
export const initializeGateway = async (): Promise<void> => {
  try {
    await gatewayServer.start();
  } catch (error) {
    console.error('Failed to initialize API Gateway:', error);
    throw error;
  }
};

// Shutdown function
export const shutdownGateway = async (): Promise<void> => {
  try {
    await gatewayServer.stop();
  } catch (error) {
    console.error('Error during gateway shutdown:', error);
    throw error;
  }
};