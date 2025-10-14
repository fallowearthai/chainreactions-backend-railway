#!/usr/bin/env node

/**
 * API Gateway Startup Script
 * ChainReactions Backend - Phase 2
 *
 * This script starts the API Gateway server.
 * Run this after starting Redis and registering services.
 */

import { initializeGateway, shutdownGateway } from '../src/gateway';
import { logger } from '../src/utils/Logger';

async function startGateway(): Promise<void> {
  try {
    logger.info('🚀 Starting ChainReactions API Gateway...');

    await initializeGateway();

    logger.info('✅ API Gateway is running and ready to accept requests');
    logger.info('📊 Gateway Health: http://localhost:3000/api/health');
    logger.info('📋 API Info: http://localhost:3000/api');
    logger.info('');
    logger.info('To stop the gateway, press Ctrl+C');

  } catch (error) {
    logger.error('💥 Failed to start API Gateway:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('📡 Received SIGTERM, shutting down gateway...');
  try {
    await shutdownGateway();
    logger.info('✅ Gateway shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('📡 Received SIGINT, shutting down gateway...');
  try {
    await shutdownGateway();
    logger.info('✅ Gateway shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the gateway
if (require.main === module) {
  startGateway();
}