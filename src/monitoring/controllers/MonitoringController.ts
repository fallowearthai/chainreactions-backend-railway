/**
 * Monitoring API Controller
 * Provides endpoints for health monitoring and metrics
 */

import { Request, Response } from 'express';
import { healthMonitor } from '../HealthMonitor';
import { logger } from '../../utils/Logger';

export class MonitoringController {
  /**
   * Get health status for all services
   */
  public static async getAllServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const services = healthMonitor.getAllServiceHealth();

      res.json({
        success: true,
        data: {
          services,
          totalServices: services.length,
          healthyServices: services.filter(s => s.status === 'healthy').length,
          degradedServices: services.filter(s => s.status === 'degraded').length,
          downServices: services.filter(s => s.status === 'down').length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting all service health:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve service health information'
      });
    }
  }

  /**
   * Get health status for a specific service
   */
  public static async getServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;

      if (!serviceName) {
        res.status(400).json({
          success: false,
          error: 'Bad request',
          message: 'Service name is required'
        });
        return;
      }

      const serviceHealth = healthMonitor.getServiceHealth(serviceName);

      if (!serviceHealth) {
        res.status(404).json({
          success: false,
          error: 'Not found',
          message: `Service '${serviceName}' not found or not monitored`
        });
        return;
      }

      res.json({
        success: true,
        data: serviceHealth
      });
    } catch (error) {
      logger.error(`Error getting service health for ${req.params.serviceName}:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve service health information'
      });
    }
  }

  /**
   * Get overall system health summary
   */
  public static async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const systemHealth = healthMonitor.getSystemHealthSummary();

      res.json({
        success: true,
        data: systemHealth
      });
    } catch (error) {
      logger.error('Error getting system health summary:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve system health summary'
      });
    }
  }

  /**
   * Trigger manual health check for all services
   */
  public static async triggerHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      await healthMonitor.triggerHealthCheck();

      res.json({
        success: true,
        message: 'Health check triggered for all services',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error triggering health check:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to trigger health check'
      });
    }
  }

  /**
   * Trigger manual health check for a specific service
   */
  public static async triggerServiceHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;

      if (!serviceName) {
        res.status(400).json({
          success: false,
          error: 'Bad request',
          message: 'Service name is required'
        });
        return;
      }

      const healthResult = await healthMonitor.triggerServiceHealthCheck(serviceName);

      res.json({
        success: true,
        message: `Health check triggered for service '${serviceName}'`,
        data: healthResult,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Error triggering health check for ${req.params.serviceName}:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to trigger service health check'
      });
    }
  }

  /**
   * Get monitoring system status
   */
  public static async getMonitoringStatus(req: Request, res: Response): Promise<void> {
    try {
      const services = healthMonitor.getAllServiceHealth();
      const isRunning = healthMonitor['isRunning']; // Access private property for status

      res.json({
        success: true,
        data: {
          monitoring: {
            isRunning,
            servicesCount: services.length,
            lastUpdate: new Date(),
            uptime: isRunning ? 'Running' : 'Stopped'
          },
          services: services.map(s => ({
            name: s.service,
            status: s.status,
            lastCheck: s.lastCheck,
            responseTime: s.responseTime,
            errorRate: s.errorRate
          }))
        }
      });
    } catch (error) {
      logger.error('Error getting monitoring status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve monitoring status'
      });
    }
  }

  /**
   * Enhanced health check endpoint (compatible with existing /api/health)
   */
  public static async enhancedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const systemHealth = healthMonitor.getSystemHealthSummary();
      const services = healthMonitor.getAllServiceHealth();

      // Create response compatible with existing health check format
      const healthResponse = {
        status: systemHealth.overall === 'healthy' ? 'ok' : 'error',
        timestamp: new Date(),
        services: {
          entityRelations: {
            status: services.find(s => s.service === 'entity-relations')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'entity-relations')?.responseTime || 0
          },
          entitySearch: {
            status: services.find(s => s.service === 'entity-search')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'entity-search')?.responseTime || 0
          },
          datasetMatching: {
            status: services.find(s => s.service === 'dataset-matching')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'dataset-matching')?.responseTime || 0
          },
          dataManagement: {
            status: services.find(s => s.service === 'data-management')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'data-management')?.responseTime || 0
          },
          datasetSearch: {
            status: services.find(s => s.service === 'dataset-search')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'dataset-search')?.responseTime || 0
          },
          demoEmail: {
            status: services.find(s => s.service === 'demo-email')?.status || 'unknown',
            responseTime: services.find(s => s.service === 'demo-email')?.responseTime || 0
          }
        },
        monitoring: {
          systemHealth: systemHealth.overall,
          totalServices: services.length,
          healthyServices: services.filter(s => s.status === 'healthy').length,
          monitoringActive: healthMonitor['isRunning'] || false
        }
      };

      // Set appropriate status code
      const statusCode = systemHealth.overall === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthResponse);
    } catch (error) {
      logger.error('Error in enhanced health check:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date(),
        error: 'Health check failed',
        monitoring: {
          systemHealth: 'down',
          monitoringActive: false
        }
      });
    }
  }
}