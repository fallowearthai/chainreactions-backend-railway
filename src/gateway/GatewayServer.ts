/**
 * API Gateway Server
 * ChainReactions Backend - Phase 2
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { GATEWAY_CONFIG } from './config/GatewayConfig';
import { serviceDiscovery } from './discovery/ServiceDiscovery';
import { gatewayRouter } from './routers/GatewayRouter';
import { logger } from '../utils/Logger';
import { SERVICE_REGISTRY_CONFIG } from './config/GatewayConfig';

export class GatewayServer {
  private app: express.Application;
  private isRunning: boolean = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Compression
    this.app.use(compression());

    // JSON parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS
    this.app.use(cors({
      origin: GATEWAY_CONFIG.cors.origin,
      credentials: GATEWAY_CONFIG.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'Cache-Control',
        'Pragma'
      ]
    }));

    // Trust proxy for accurate client IPs
    this.app.set('trust proxy', 1);
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Use gateway router for all routes
    this.app.use('/', gatewayRouter.getRouter());
  }

  /**
   * Start the gateway server
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Gateway server is already running');
      return;
    }

    try {
      // Start service discovery
      await serviceDiscovery.start();

      // Register gateway itself in service discovery
      await serviceDiscovery.registerService({
        serviceName: 'api-gateway',
        host: GATEWAY_CONFIG.host,
        port: GATEWAY_CONFIG.port,
        health: '/api/health',
        protocol: 'http',
        timeout: 5000,
        retries: 3,
        circuitBreakerThreshold: 10,
        lastHealthCheck: new Date(),
        status: 'healthy'
      });

      // Start the Express server
      const server = this.app.listen(GATEWAY_CONFIG.port, GATEWAY_CONFIG.host, () => {
        this.isRunning = true;
        logger.info(`🚀 ChainReactions API Gateway started successfully`);
        logger.info(`📡 Gateway listening on ${GATEWAY_CONFIG.host}:${GATEWAY_CONFIG.port}`);
        logger.info(`🏥 Gateway Health: http://${GATEWAY_CONFIG.host}:${GATEWAY_CONFIG.port}/api/health`);
        logger.info(`📊 API Info: http://${GATEWAY_CONFIG.host}:${GATEWAY_CONFIG.port}/api`);
        logger.info(`🔍 Environment: ${GATEWAY_CONFIG.logLevel.toUpperCase()}`);
        logger.info(`🌐 CORS enabled for ${GATEWAY_CONFIG.cors.origin.length} origins`);
        logger.info(`⚡ Rate limiting: ${GATEWAY_CONFIG.rateLimiting ? 'ENABLED' : 'DISABLED'}`);
        logger.info(`🔄 Service discovery: CONNECTED`);
        logger.info(`⚖️ Load balancer: ROUND_ROBIN`);
        logger.info(`🔌 Circuit breaker: ENABLED (threshold: ${GATEWAY_CONFIG.circuitBreakerThreshold})`);
      });

      // Handle server errors
      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${GATEWAY_CONFIG.port} is already in use`);
        } else {
          logger.error('❌ Gateway server error:', error);
        }
        process.exit(1);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown(server);

      logger.info('✅ Gateway server startup completed');

    } catch (error) {
      logger.error('❌ Failed to start gateway server:', error);
      throw error;
    }
  }

  /**
   * Stop the gateway server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Gateway server is not running');
      return;
    }

    try {
      logger.info('🛑 Shutting down gateway server...');

      // Stop service discovery
      await serviceDiscovery.stop();

      // Deregister from service discovery
      await serviceDiscovery.deregisterService('api-gateway');

      this.isRunning = false;
      logger.info('✅ Gateway server stopped successfully');

    } catch (error) {
      logger.error('❌ Error during gateway shutdown:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(server: any): void {
    const shutdown = async (signal: string) => {
      logger.info(`📡 Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        server.close(async () => {
          logger.info('🔌 Server stopped accepting new connections');

          // Stop the gateway
          await this.stop();

          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
          logger.error('❌ Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, 30000);

      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Get server status
   */
  public getStatus(): {
    running: boolean;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    config: typeof GATEWAY_CONFIG;
  } {
    return {
      running: this.isRunning,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: GATEWAY_CONFIG
    };
  }

  /**
   * Get Express app instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }
}

// Export singleton instance
export const gatewayServer = new GatewayServer();

// Start server if this file is run directly
if (require.main === module) {
  gatewayServer.start().catch((error) => {
    logger.error('💥 Failed to start gateway server:', error);
    process.exit(1);
  });
}