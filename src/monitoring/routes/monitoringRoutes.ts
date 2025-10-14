/**
 * Monitoring Routes
 * Defines all monitoring-related API endpoints
 */

import { Router } from 'express';
import { MonitoringController } from '../controllers/MonitoringController';

const router = Router();

/**
 * @route GET /api/monitoring/health
 * @desc Get health status for all services
 * @access Public
 */
router.get('/health', MonitoringController.getAllServiceHealth);

/**
 * @route GET /api/monitoring/health/summary
 * @desc Get overall system health summary
 * @access Public
 */
router.get('/health/summary', MonitoringController.getSystemHealth);

/**
 * @route GET /api/monitoring/health/:serviceName
 * @desc Get health status for a specific service
 * @access Public
 */
router.get('/health/:serviceName', MonitoringController.getServiceHealth);

/**
 * @route POST /api/monitoring/health/check
 * @desc Trigger manual health check for all services
 * @access Public
 */
router.post('/health/check', MonitoringController.triggerHealthCheck);

/**
 * @route POST /api/monitoring/health/check/:serviceName
 * @desc Trigger manual health check for a specific service
 * @access Public
 */
router.post('/health/check/:serviceName', MonitoringController.triggerServiceHealthCheck);

/**
 * @route GET /api/monitoring/status
 * @desc Get monitoring system status
 * @access Public
 */
router.get('/status', MonitoringController.getMonitoringStatus);

/**
 * @route GET /api/monitoring/enhanced-health
 * @desc Enhanced health check (compatible with existing /api/health)
 * @access Public
 */
router.get('/enhanced-health', MonitoringController.enhancedHealthCheck);

export default router;