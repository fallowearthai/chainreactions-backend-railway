#!/usr/bin/env node

/**
 * Service Registration Script
 * ChainReactions Backend - Phase 2
 *
 * This script registers all backend services with the service discovery system.
 * Run this after starting Redis to register the initial services.
 */

import { serviceDiscovery } from '../src/gateway/discovery/ServiceDiscovery';
import { SERVICE_REGISTRY_CONFIG } from '../src/gateway/config/GatewayConfig';
import { logger } from '../src/utils/Logger';

const SERVICES = [
  {
    serviceName: 'main-app',
    host: 'localhost',
    port: 4000,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 10000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['entity-search', 'data-management', 'email-service']
  },
  {
    serviceName: 'dataset-search',
    host: 'localhost',
    port: 4001,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['dataset-search']
  },
  {
    serviceName: 'entity-relations',
    host: 'localhost',
    port: 4002,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['enhanced-search', 'normal-search']
  },
  {
    serviceName: 'dataset-matching',
    host: 'localhost',
    port: 4003,
    health: '/api/health',
    protocol: 'http' as const,
    timeout: 5000,
    retries: 3,
    circuitBreakerThreshold: 5,
    services: ['dataset-matching']
  }
];

async function registerAllServices(): Promise<void> {
  try {
    logger.info('🔧 Starting service registration...');

    // Start service discovery
    await serviceDiscovery.start();
    logger.info('✅ Service discovery started');

    // Register all services
    for (const service of SERVICES) {
      try {
        await serviceDiscovery.registerService({
          ...service,
          lastHealthCheck: new Date(),
          status: 'healthy'
        });
        logger.info(`✅ Registered service: ${service.serviceName} at ${service.host}:${service.port}`);
      } catch (error) {
        logger.error(`❌ Failed to register service ${service.serviceName}:`, error);
      }
    }

    // Verify registration
    const registeredServices = await serviceDiscovery.getServices();
    logger.info(`📊 Total registered services: ${registeredServices.length}`);

    for (const service of registeredServices) {
      logger.info(`  - ${service.serviceName}: ${service.host}:${service.port} (${service.status})`);
    }

    logger.info('🎉 Service registration completed successfully');

  } catch (error) {
    logger.error('💥 Service registration failed:', error);
    process.exit(1);
  }
}

async function unregisterAllServices(): Promise<void> {
  try {
    logger.info('🗑️ Unregistering all services...');

    await serviceDiscovery.start();

    for (const service of SERVICES) {
      try {
        await serviceDiscovery.deregisterService(service.serviceName);
        logger.info(`✅ Unregistered service: ${service.serviceName}`);
      } catch (error) {
        logger.error(`❌ Failed to unregister service ${service.serviceName}:`, error);
      }
    }

    await serviceDiscovery.stop();
    logger.info('🎉 Service unregistration completed');

  } catch (error) {
    logger.error('💥 Service unregistration failed:', error);
    process.exit(1);
  }
}

async function listServices(): Promise<void> {
  try {
    await serviceDiscovery.start();

    const services = await serviceDiscovery.getServices();

    if (services.length === 0) {
      logger.info('📭 No services are currently registered');
    } else {
      logger.info(`📊 Currently registered services (${services.length}):`);

      for (const service of services) {
        logger.info(`  - ${service.serviceName}:`);
        logger.info(`    Host: ${service.host}:${service.port}`);
        logger.info(`    Status: ${service.status}`);
        logger.info(`    Health: ${service.health}`);
        logger.info(`    Last Check: ${service.lastHealthCheck.toISOString()}`);
        if (service.services) {
          logger.info(`    Sub-services: ${service.services.join(', ')}`);
        }
        logger.info('');
      }
    }

    await serviceDiscovery.stop();

  } catch (error) {
    logger.error('💥 Failed to list services:', error);
    process.exit(1);
  }
}

// CLI interface
async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'register':
      await registerAllServices();
      break;
    case 'unregister':
      await unregisterAllServices();
      break;
    case 'list':
      await listServices();
      break;
    case 'help':
    default:
      console.log(`
Service Registration Tool

Usage: node scripts/register-services.ts <command>

Commands:
  register    - Register all services with service discovery
  unregister  - Unregister all services from service discovery
  list        - List currently registered services
  help        - Show this help message

Examples:
  node scripts/register-services.ts register
  node scripts/register-services.ts list
  node scripts/register-services.ts unregister
      `);
      break;
  }

  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}