/**
 * Monitoring System Export
 * ChainReactions Backend Monitoring
 */

export { HealthMonitor, healthMonitor } from './HealthMonitor';
export { MonitoringController } from './controllers/MonitoringController';
export { default as monitoringRoutes } from './routes/monitoringRoutes';

export * from './types/MonitoringTypes';
export * from './config/MonitoringConfig';

// Initialize monitoring system
import { healthMonitor } from './HealthMonitor';
import { logger } from '../utils/Logger';

export const initializeMonitoring = (): void => {
  try {
    logger.info('Initializing ChainReactions Monitoring System...');
    healthMonitor.start();
    logger.info('Monitoring system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize monitoring system:', error);
    throw error;
  }
};

export const shutdownMonitoring = (): void => {
  try {
    logger.info('Shutting down monitoring system...');
    healthMonitor.stop();
    logger.info('Monitoring system shutdown complete');
  } catch (error) {
    logger.error('Error during monitoring shutdown:', error);
  }
};