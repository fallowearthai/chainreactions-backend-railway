/**
 * Proxy Service for API Gateway
 * ChainReactions Backend - Phase 2
 */

import { Request, Response } from 'express';
import { ProxyRequest, ProxyResponse, CircuitBreakerState } from '../types/GatewayTypes';
import { serviceDiscovery } from '../discovery/ServiceDiscovery';
import { loadBalancer } from '../discovery/LoadBalancer';
import { GATEWAY_CONFIG } from '../config/GatewayConfig';
import { loggingMiddleware } from '../middleware/LoggingMiddleware';
import { logger } from '../../../utils/Logger';
import fetch from 'node-fetch';

export class ProxyService {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  /**
   * Proxy request to target service
   */
  public async proxyRequest(
    req: Request,
    res: Response,
    targetService: string,
    rewritePath?: string
  ): Promise<void> {
    const startTime = Date.now();
    const context = (req as any).requestContext;

    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(targetService)) {
        return this.sendCircuitBreakerResponse(res, targetService);
      }

      // Get available service instances
      const services = await serviceDiscovery.getServices(targetService);
      if (services.length === 0) {
        return this.sendServiceUnavailable(res, targetService);
      }

      // Select service instance using load balancer
      const selectedService = loadBalancer.selectService(services);
      if (!selectedService) {
        return this.sendServiceUnavailable(res, targetService);
      }

      // Build target URL
      const targetPath = rewritePath || req.path;
      const targetUrl = `${selectedService.protocol}://${selectedService.host}:${selectedService.port}${targetPath}${
        Object.keys(req.query).length > 0 ? '?' + new URLSearchParams(req.query as any).toString() : ''
      }`;

      // Log proxy request
      if (context) {
        loggingMiddleware.logProxyRequest(context, targetService, targetUrl);
      }

      // Build proxy request
      const proxyRequest: ProxyRequest = {
        method: req.method,
        path: req.path,
        headers: this.buildHeaders(req),
        body: req.body,
        query: req.query as Record<string, string>,
        params: req.params as Record<string, string>
      };

      // Execute proxy request
      const proxyResponse = await this.executeProxyRequest(
        proxyRequest,
        targetUrl,
        selectedService,
        targetService
      );

      // Send response to client
      this.sendProxyResponse(res, proxyResponse);

      // Log successful proxy response
      if (context) {
        const duration = Date.now() - startTime;
        loggingMiddleware.logProxyResponse(
          context,
          targetService,
          proxyResponse.status,
          duration
        );
      }

      // Update circuit breaker state
      this.updateCircuitBreaker(targetService, true);

    } catch (error) {
      logger.error(`Proxy request failed for ${targetService}:`, error);

      // Update circuit breaker state
      this.updateCircuitBreaker(targetService, false);

      // Log failed proxy response
      if (context) {
        const duration = Date.now() - startTime;
        loggingMiddleware.logProxyResponse(
          context,
          targetService,
          0,
          duration,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      this.sendErrorResponse(res, error);
    }
  }

  /**
   * Execute actual HTTP request to target service
   */
  private async executeProxyRequest(
    proxyRequest: ProxyRequest,
    targetUrl: string,
    service: any,
    serviceName: string
  ): Promise<ProxyResponse> {
    const startTime = Date.now();

    try {
      const fetchOptions: any = {
        method: proxyRequest.method,
        headers: proxyRequest.headers,
        timeout: service.timeout || GATEWAY_CONFIG.timeout,
        // Note: node-fetch doesn't directly support timeout, we'll handle it differently
      };

      // Add body for POST/PUT/PATCH requests
      if (proxyRequest.body && ['POST', 'PUT', 'PATCH'].includes(proxyRequest.method)) {
        if (typeof proxyRequest.body === 'object') {
          fetchOptions.body = JSON.stringify(proxyRequest.body);
          fetchOptions.headers['Content-Type'] = 'application/json';
        } else {
          fetchOptions.body = proxyRequest.body;
        }
      }

      // Add timeout using Promise.race
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), service.timeout || GATEWAY_CONFIG.timeout);
      });

      const fetchPromise = fetch(targetUrl, fetchOptions);

      const response = await Promise.race([fetchPromise, timeoutPromise]) as any;

      const duration = Date.now() - startTime;

      // Handle streaming responses (SSE, file downloads)
      if (response.headers.get('content-type')?.includes('text/event-stream') ||
          response.headers.get('content-type')?.includes('application/octet-stream')) {
        return {
          status: response.status,
          headers: this.extractHeaders(response),
          body: response.body, // Keep as stream
          duration,
          service: serviceName
        };
      }

      // Handle JSON responses
      const contentType = response.headers.get('content-type');
      let body;

      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else if (contentType?.includes('text/')) {
        body = await response.text();
      } else {
        body = await response.buffer();
      }

      return {
        status: response.status,
        headers: this.extractHeaders(response),
        body,
        duration,
        service: serviceName
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Build headers for proxy request
   */
  private buildHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    // Copy most headers, but skip some that shouldn't be forwarded
    const skipHeaders = [
      'host',
      'connection',
      'accept-encoding',
      'content-length'
    ];

    for (const [key, value] of Object.entries(req.headers)) {
      if (value && !skipHeaders.includes(key.toLowerCase())) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    // Add gateway-specific headers
    headers['X-Forwarded-For'] = req.ip || 'unknown';
    headers['X-Forwarded-Proto'] = req.protocol;
    headers['X-Forwarded-Host'] = req.get('host') || 'unknown';
    headers['X-Gateway-Request-ID'] = (req as any).requestContext?.requestId || 'unknown';

    return headers;
  }

  /**
   * Extract headers from service response
   */
  private extractHeaders(response: any): Record<string, string> {
    const headers: Record<string, string> = {};

    response.headers.forEach((value: string, key: string) => {
      // Skip some headers that shouldn't be forwarded
      const skipHeaders = [
        'connection',
        'transfer-encoding',
        'content-encoding'
      ];

      if (!skipHeaders.includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    return headers;
  }

  /**
   * Send proxy response to client
   */
  private sendProxyResponse(res: Response, proxyResponse: ProxyResponse): void {
    // Set status code
    res.status(proxyResponse.status);

    // Set headers
    for (const [key, value] of Object.entries(proxyResponse.headers)) {
      res.set(key, value);
    }

    // Add gateway-specific headers
    res.set('X-Gateway-Service', proxyResponse.service);
    res.set('X-Gateway-Duration', proxyResponse.duration.toString());

    // Send body
    if (proxyResponse.body) {
      // Handle streaming responses
      if (proxyResponse.body.pipe) {
        proxyResponse.body.pipe(res);
      } else {
        res.send(proxyResponse.body);
      }
    } else {
      res.end();
    }
  }

  /**
   * Check if circuit breaker is open for a service
   */
  private isCircuitBreakerOpen(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) return false;

    if (circuitBreaker.state === 'open') {
      // Check if we should try again (half-open state)
      if (Date.now() >= circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'half-open';
        logger.info(`Circuit breaker for ${serviceName} entering half-open state`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker state based on request result
   */
  private updateCircuitBreaker(serviceName: string, success: boolean): void {
    let circuitBreaker = this.circuitBreakers.get(serviceName);

    if (!circuitBreaker) {
      circuitBreaker = {
        service: serviceName,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date()
      };
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }

    if (success) {
      if (circuitBreaker.state === 'half-open') {
        // Reset to closed after successful request in half-open state
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
        logger.info(`Circuit breaker for ${serviceName} reset to closed state`);
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date();

      if (circuitBreaker.failureCount >= GATEWAY_CONFIG.circuitBreakerThreshold) {
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime = new Date(Date.now() + 60000); // 1 minute timeout
        logger.warn(`Circuit breaker opened for ${serviceName} after ${circuitBreaker.failureCount} failures`);
      }
    }
  }

  /**
   * Send circuit breaker response
   */
  private sendCircuitBreakerResponse(res: Response, serviceName: string): void {
    res.status(503).json({
      error: 'Service Unavailable',
      message: `Service ${serviceName} is temporarily unavailable due to high error rate`,
      service: serviceName,
      circuitBreaker: 'open',
      retryAfter: 60
    });
  }

  /**
   * Send service unavailable response
   */
  private sendServiceUnavailable(res: Response, serviceName: string): void {
    res.status(503).json({
      error: 'Service Unavailable',
      message: `No healthy instances available for service ${serviceName}`,
      service: serviceName
    });
  }

  /**
   * Send error response
   */
  private sendErrorResponse(res: Response, error: any): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    res.status(502).json({
      error: 'Bad Gateway',
      message: 'An error occurred while processing your request',
      details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
    });
  }

  /**
   * Get circuit breaker statistics
   */
  public getCircuitBreakerStatistics(): Record<string, CircuitBreakerState> {
    const stats: Record<string, CircuitBreakerState> = {};

    for (const [serviceName, state] of this.circuitBreakers.entries()) {
      stats[serviceName] = { ...state };
    }

    return stats;
  }

  /**
   * Reset circuit breaker for a service
   */
  public resetCircuitBreaker(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.state = 'closed';
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastFailureTime = new Date();
      circuitBreaker.nextAttemptTime = new Date();
      logger.info(`Circuit breaker for ${serviceName} manually reset`);
    }
  }
}

export const proxyService = new ProxyService();