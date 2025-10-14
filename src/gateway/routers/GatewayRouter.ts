/**
 * Gateway Router
 * ChainReactions Backend - Phase 2
 */

import { Router, Request, Response } from 'express';
import { ROUTE_CONFIG } from '../config/GatewayConfig';
import { proxyService } from '../proxy/ProxyService';
import { loggingMiddleware } from '../middleware/LoggingMiddleware';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { rateLimitMiddleware } from '../middleware/RateLimitMiddleware';
import { logger } from '../../../utils/Logger';

export class GatewayRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Setup all gateway routes
   */
  private setupRoutes(): void {
    // Apply global middleware
    this.router.use(loggingMiddleware.execute.bind(loggingMiddleware));
    this.router.use(rateLimitMiddleware.execute.bind(rateLimitMiddleware));
    this.router.use(authMiddleware.execute.bind(authMiddleware));

    // Setup route configurations
    for (const route of ROUTE_CONFIG) {
      this.setupRoute(route);
    }

    // Handle 404 for unmatched routes
    this.router.use('*', this.handleNotFound.bind(this));

    // Global error handler
    this.router.use(this.handleError.bind(this));
  }

  /**
   * Setup individual route
   */
  private setupRoute(route: any): void {
    const methods = route.method ? (Array.isArray(route.method) ? route.method : [route.method]) : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

    for (const method of methods) {
      if (route.targetService === 'gateway') {
        // Handle gateway endpoints directly
        this.registerGatewayEndpoint(method, route.path);
      } else {
        // Proxy to backend services
        this.registerProxyEndpoint(method, route.path, route.targetService, route.rewrite, route.timeout);
      }
    }

    logger.info(`Registered route: ${methods.join(',')} ${route.path} -> ${route.targetService}`);
  }

  /**
   * Register gateway endpoint (handled by gateway itself)
   */
  private registerGatewayEndpoint(method: string, path: string): void {
    const handler = this.getGatewayHandler(path);

    switch (method.toUpperCase()) {
      case 'GET':
        this.router.get(path, handler);
        break;
      case 'POST':
        this.router.post(path, handler);
        break;
      case 'PUT':
        this.router.put(path, handler);
        break;
      case 'DELETE':
        this.router.delete(path, handler);
        break;
      case 'PATCH':
        this.router.patch(path, handler);
        break;
      case 'OPTIONS':
        this.router.options(path, handler);
        break;
    }
  }

  /**
   * Register proxy endpoint (forwarded to backend services)
   */
  private registerProxyEndpoint(
    method: string,
    path: string,
    targetService: string,
    rewrite?: any,
    timeout?: number
  ): void {
    const handler = async (req: Request, res: Response) => {
      const context = (req as any).requestContext;

      // Apply timeout if specified
      if (timeout) {
        res.setTimeout(timeout, () => {
          if (!res.headersSent) {
            res.status(504).json({
              error: 'Gateway Timeout',
              message: `Request timed out after ${timeout}ms`
            });
          }
        });
      }

      // Determine rewrite path
      let rewritePath: string | undefined;
      if (rewrite) {
        rewritePath = req.path.replace(rewrite.from, rewrite.to);
      }

      // Proxy request
      await proxyService.proxyRequest(req, res, targetService, rewritePath);
    };

    switch (method.toUpperCase()) {
      case 'GET':
        this.router.get(path, handler);
        break;
      case 'POST':
        this.router.post(path, handler);
        break;
      case 'PUT':
        this.router.put(path, handler);
        break;
      case 'DELETE':
        this.router.delete(path, handler);
        break;
      case 'PATCH':
        this.router.patch(path, handler);
        break;
      case 'OPTIONS':
        this.router.options(path, handler);
        break;
    }
  }

  /**
   * Get handler for gateway endpoints
   */
  private getGatewayHandler(path: string): (req: Request, res: Response) => Promise<void> {
    return async (req: Request, res: Response) => {
      const context = (req as any).requestContext;

      try {
        switch (path) {
          case '/api/health':
            await this.handleHealthCheck(req, res);
            break;
          case '/api':
            await this.handleApiInfo(req, res);
            break;
          case '/api/monitoring/health':
          case '/api/monitoring/health/*':
          case '/api/monitoring/status':
            await this.handleMonitoringRequest(req, res);
            break;
          default:
            res.status(404).json({
              error: 'Not Found',
              message: `Gateway endpoint ${path} not found`
            });
        }
      } catch (error) {
        logger.error(`Gateway endpoint error for ${path}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while processing your request'
          });
        }
      }
    };
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    const context = (req as any).requestContext;

    try {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'ChainReactions API Gateway',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        requestId: context?.requestId,
        gateway: {
          port: process.env.GATEWAY_PORT || 3000,
          nodeVersion: process.version,
          memory: process.memoryUsage(),
          loadBalancer: {
            strategy: 'round-robin', // This would come from the actual load balancer
            statistics: {} // This would come from the actual load balancer
          },
          circuitBreakers: proxyService.getCircuitBreakerStatistics(),
          rateLimit: rateLimitMiddleware.getStatistics()
        },
        services: {
          // This would come from service discovery
          'main-app': { status: 'healthy', port: 4000 },
          'dataset-search': { status: 'healthy', port: 4001 },
          'entity-relations': { status: 'healthy', port: 4002 },
          'dataset-matching': { status: 'healthy', port: 4003 }
        }
      };

      res.json(healthData);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'ChainReactions API Gateway',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle API info requests
   */
  private async handleApiInfo(req: Request, res: Response): Promise<void> {
    const context = (req as any).requestContext;

    try {
      const apiInfo = {
        message: 'ChainReactions API Gateway - Phase 2',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        requestId: context?.requestId,
        gateway: {
          description: 'API Gateway providing unified access to ChainReactions services',
          port: process.env.GATEWAY_PORT || 3000,
          features: [
            'Service Discovery',
            'Load Balancing',
            'Circuit Breaker',
            'Rate Limiting',
            'Request Logging',
            'Health Monitoring'
          ]
        },
        services: {
          overview: 'All services are now accessible through the gateway',
          routing: 'Requests are automatically routed to appropriate backend services',
          ports: {
            gateway: 3000,
            'main-app': 4000,
            'dataset-search': 4001,
            'entity-relations': 4002,
            'dataset-matching': 4003
          }
        },
        endpoints: {
          gateway: {
            health: 'GET /api/health - Gateway health check',
            info: 'GET /api - This information endpoint',
            monitoring: 'GET /api/monitoring/* - Gateway monitoring endpoints'
          },
          services: {
            entity_relations: {
              deepthinking: 'POST /api/enhanced/search - 3-Stage OSINT workflow',
              normal: 'POST /api/normal-search - Fast Google Web Search OSINT'
            },
            dataset_search: {
              stream: 'POST /api/dataset-search/stream - Start streaming search',
              status: 'GET /api/dataset-search/stream/:id/status - Get search status'
            },
            dataset_matching: {
              match: 'POST /api/dataset-matching/match - Single entity matching',
              batch: 'POST /api/dataset-matching/batch - Batch entity matching'
            },
            entity_search: {
              search: 'POST /api/entity-search - Professional business intelligence'
            },
            data_management: {
              datasets: 'GET /api/data-management/datasets - List datasets',
              upload: 'POST /api/data-management/datasets/:id/upload - Upload CSV'
            },
            email_service: {
              demo: 'POST /api/demo-request - Send demo request email'
            }
          }
        },
        documentation: 'See CLAUDE.md for detailed usage instructions'
      };

      res.json(apiInfo);
    } catch (error) {
      logger.error('API info error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate API information'
      });
    }
  }

  /**
   * Handle monitoring requests
   */
  private async handleMonitoringRequest(req: Request, res: Response): Promise<void> {
    // For now, delegate to existing monitoring system
    // In a full implementation, this would integrate with the gateway's own monitoring
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Gateway monitoring endpoints will be implemented in Phase 2 completion'
    });
  }

  /**
   * Handle 404 not found
   */
  private handleNotFound(req: Request, res: Response): void {
    const context = (req as any).requestContext;

    logger.warn(`Route not found: ${req.method} ${req.path}`, {
      requestId: context?.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      requestId: context?.requestId,
      availableEndpoints: '/api',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle global errors
   */
  private handleError(error: any, req: Request, res: Response, next: any): void {
    const context = (req as any).requestContext;

    logger.error('Gateway error:', {
      error: error.message,
      stack: error.stack,
      requestId: context?.requestId,
      method: req.method,
      path: req.path,
      ip: req.ip
    });

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred in the gateway',
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV !== 'production' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }

  /**
   * Get router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

export const gatewayRouter = new GatewayRouter();