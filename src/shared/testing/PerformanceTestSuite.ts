/**
 * Performance Testing Suite - Comprehensive performance validation
 *
 * Features:
 * - Load testing with configurable concurrency
 * - Stress testing for breaking points
 * - Comparative testing (before/after optimization)
 * - Performance regression detection
 * - Detailed reporting and metrics
 */

import { EventEmitter } from 'events';
import { PerformanceUtils, StringUtils } from '../utils/CommonUtilities';
import { getAPMInstance, APMService } from '../monitoring/APMService';
import { Logger } from '../cache/CacheLogger';

export interface TestConfig {
  name: string;
  duration: number; // milliseconds
  concurrency: number;
  rampUpTime: number; // milliseconds
  requestsPerSecond?: number;
  warmupTime?: number; // milliseconds
  endpoints: TestEndpoint[];
}

export interface TestEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  timeout?: number;
  weight?: number; // For weighted load distribution
}

export interface TestResult {
  testName: string;
  config: TestConfig;
  startTime: string;
  endTime: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  responseTime: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errors: Array<{ count: number; message: string; status?: number }>;
  throughput: number;
  statusCodes: Record<number, number>;
  metadata: any;
}

export interface ComparisonResult {
  baseline: TestResult;
  optimization: TestResult;
  improvements: {
    responseTimeImprovement: number; // percentage
    throughputImprovement: number; // percentage
    errorRateImprovement: number; // percentage
  };
  regression: boolean;
  summary: string;
}

/**
 * Comprehensive performance testing framework
 */
export class PerformanceTestSuite extends EventEmitter {
  private apm: APMService;
  private results: TestResult[] = [];
  private isRunning = false;
  private activeRequests = 0;

  constructor() {
    super();
    this.apm = getAPMInstance();
  }

  /**
   * Run a single performance test
   */
  async runTest(config: TestConfig): Promise<TestResult> {
    if (this.isRunning) {
      throw new Error('Another test is already running');
    }

    this.isRunning = true;
    this.activeRequests = 0;

    const testTimer = PerformanceUtils.createTimer(`test.${config.name}`);
    const startTime = new Date().toISOString();

    Logger.info('Starting performance test', {
      testName: config.name,
      duration: config.duration,
      concurrency: config.concurrency,
      endpoints: config.endpoints.length
    });

    try {
      // Start APM trace for the entire test
      const traceId = this.apm.startTrace('performance_test', {
        testName: config.name,
        concurrency: config.concurrency
      });

      // Initialize result tracking
      const result: Partial<TestResult> = {
        testName: config.name,
        config,
        startTime,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTime: [],
        errors: [],
        statusCodes: {},
        metadata: {}
      };

      // Warmup phase
      if (config.warmupTime) {
        await this.runWarmup(config, config.warmupTime);
      }

      // Main test phase
      await this.runMainTest(config, result as any);

      const endTime = new Date().toISOString();
      const totalDuration = testTimer.elapsed();

      // Calculate final metrics
      const finalResult = this.calculateFinalMetrics(result as TestResult, endTime, totalDuration);

      // Complete APM trace
      this.apm.finishTrace(traceId);

      this.results.push(finalResult);

      Logger.info('Performance test completed', {
        testName: config.name,
        duration: totalDuration,
        totalRequests: finalResult.totalRequests,
        requestsPerSecond: finalResult.requestsPerSecond,
        avgResponseTime: finalResult.responseTime.mean
      });

      this.isRunning = false;
      return finalResult;

    } catch (error) {
      this.isRunning = false;
      Logger.error('Performance test failed', {
        testName: config.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run comparative test (baseline vs optimization)
   */
  async runComparisonTest(
    baselineConfig: TestConfig,
    optimizedConfig: TestConfig
  ): Promise<ComparisonResult> {
    Logger.info('Starting comparative performance test', {
      baseline: baselineConfig.name,
      optimized: optimizedConfig.name
    });

    try {
      // Run baseline test
      Logger.info('Running baseline test...');
      const baseline = await this.runTest(baselineConfig);

      // Wait a bit between tests
      await this.delay(5000);

      // Run optimized test
      Logger.info('Running optimized test...');
      const optimization = await this.runTest(optimizedConfig);

      // Calculate improvements
      const improvements = this.calculateImprovements(baseline, optimization);

      const comparisonResult: ComparisonResult = {
        baseline,
        optimization,
        improvements,
        regression: improvements.responseTimeImprovement < 0 || improvements.throughputImprovement < 0,
        summary: this.generateComparisonSummary(improvements)
      };

      Logger.info('Comparative test completed', {
        responseTimeImprovement: improvements.responseTimeImprovement,
        throughputImprovement: improvements.throughputImprovement,
        errorRateImprovement: improvements.errorRateImprovement,
        regression: comparisonResult.regression
      });

      this.emit('comparison-complete', comparisonResult);
      return comparisonResult;

    } catch (error) {
      Logger.error('Comparative test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run stress test to find breaking points
   */
  async runStressTest(
    baseConfig: TestConfig,
    maxConcurrency: number,
    concurrencyStep: number = 10
  ): Promise<TestResult[]> {
    Logger.info('Starting stress test', {
      baseName: baseConfig.name,
      maxConcurrency,
      concurrencyStep
    });

    const stressResults: TestResult[] = [];

    for (let concurrency = concurrencyStep; concurrency <= maxConcurrency; concurrency += concurrencyStep) {
      const stressConfig = {
        ...baseConfig,
        name: `${baseConfig.name}_stress_${concurrency}`,
        concurrency,
        duration: 30000 // 30 seconds for each stress level
      };

      try {
        Logger.info(`Running stress test with concurrency: ${concurrency}`);
        const result = await this.runTest(stressConfig);
        stressResults.push(result);

        // Check if we're hitting breaking point
        if (result.failedRequests / result.totalRequests > 0.1) { // >10% error rate
          Logger.warn(`High error rate detected at concurrency ${concurrency}: ${Math.round((result.failedRequests / result.totalRequests) * 100)}%`);
        }

        // Emit progress event
        this.emit('stress-progress', {
          concurrency,
          result,
          progress: (concurrency / maxConcurrency) * 100
        });

      } catch (error) {
        Logger.error(`Stress test failed at concurrency ${concurrency}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        break; // Stop stress test on failure
      }

      // Brief pause between stress levels
      await this.delay(3000);
    }

    this.emit('stress-complete', stressResults);
    return stressResults;
  }

  /**
   * Generate performance report
   */
  generateReport(testResults: TestResult[]): string {
    const report = {
      summary: this.generateSummary(testResults),
      detailedResults: testResults,
      recommendations: this.generateRecommendations(testResults),
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Get all test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = [];
    Logger.info('Test results cleared');
  }

  // Private helper methods

  private async runWarmup(config: TestConfig, warmupTime: number): Promise<void> {
    Logger.info('Running warmup phase', { duration: warmupTime });

    const warmupConfig = {
      ...config,
      duration: warmupTime,
      concurrency: Math.min(config.concurrency, 5),
      name: `${config.name}_warmup`
    };

    // Run a smaller version of the test for warmup
    await this.runMainTest(warmupConfig, {} as any);
  }

  private async runMainTest(config: TestConfig, result: TestResult): Promise<void> {
    const endTime = Date.now() + config.duration;
    const responseTimes: number[] = [];
    const errors = new Map<string, { count: number; status?: number }>();

    // Create weighted endpoint selection
    const weightedEndpoints = this.createWeightedEndpoints(config.endpoints);

    // Start concurrent workers
    const workers: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil(config.concurrency / workers.length);

    for (let i = 0; i < config.concurrency; i++) {
      workers.push(this.runWorker(
        weightedEndpoints,
        endTime,
        responseTimes,
        errors,
        result
      ));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate response time metrics
    result.responseTime = this.calculateResponseTimeMetrics(responseTimes);

    // Convert errors map to array
    result.errors = Array.from(errors.entries()).map(([message, data]) => ({
      count: data.count,
      message,
      status: data.status
    }));
  }

  private async runWorker(
    endpoints: TestEndpoint[],
    endTime: number,
    responseTimes: number[],
    errors: Map<string, { count: number; status?: number }>,
    result: TestResult
  ): Promise<void> {
    while (Date.now() < endTime) {
      try {
        // Select endpoint based on weights
        const endpoint = this.selectWeightedEndpoint(endpoints);

        // Make request
        const requestTimer = PerformanceUtils.createTimer('http.request');
        this.activeRequests++;

        const response = await this.makeRequest(endpoint);
        const responseTime = requestTimer.elapsed();

        this.activeRequests--;

        // Record metrics
        responseTimes.push(responseTime);
        result.totalRequests++;

        if (response.status === (endpoint.expectedStatus || 200)) {
          result.successfulRequests++;
        } else {
          result.failedRequests++;
        }

        // Record status code
        result.statusCodes[response.status] = (result.statusCodes[response.status] || 0) + 1;

      } catch (error) {
        this.activeRequests--;
        result.totalRequests++;
        result.failedRequests++;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorKey = `${errorMessage}`;

        if (errors.has(errorKey)) {
          errors.get(errorKey)!.count++;
        } else {
          errors.set(errorKey, { count: 1 });
        }

        Logger.debug('Request failed', {
          error: errorMessage,
          activeRequests: this.activeRequests
        });
      }
    }
  }

  private async makeRequest(endpoint: TestEndpoint): Promise<Response> {
    const url = endpoint.url;
    const options: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        ...endpoint.headers
      },
      signal: AbortSignal.timeout(endpoint.timeout || 30000)
    };

    if (endpoint.body && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
      options.body = JSON.stringify(endpoint.body);
    }

    return fetch(url, options);
  }

  private createWeightedEndpoints(endpoints: TestEndpoint[]): TestEndpoint[] {
    const weighted: TestEndpoint[] = [];
    for (const endpoint of endpoints) {
      const weight = endpoint.weight || 1;
      for (let i = 0; i < weight; i++) {
        weighted.push(endpoint);
      }
    }
    return weighted;
  }

  private selectWeightedEndpoint(endpoints: TestEndpoint[]): TestEndpoint {
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  private calculateResponseTimeMetrics(responseTimes: number[]): TestResult['responseTime'] {
    if (responseTimes.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = responseTimes.sort((a, b) => a - b);
    const sum = responseTimes.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  private calculateFinalMetrics(
    result: TestResult,
    endTime: string,
    totalDuration: number
  ): TestResult {
    result.endTime = endTime;
    result.duration = totalDuration;
    result.requestsPerSecond = (result.totalRequests / totalDuration) * 1000;
    result.throughput = result.successfulRequests / (totalDuration / 1000);

    return result;
  }

  private calculateImprovements(baseline: TestResult, optimization: TestResult): ComparisonResult['improvements'] {
    const responseTimeImprovement = ((baseline.responseTime.mean - optimization.responseTime.mean) / baseline.responseTime.mean) * 100;
    const throughputImprovement = ((optimization.throughput - baseline.throughput) / baseline.throughput) * 100;
    const baselineErrorRate = (baseline.failedRequests / baseline.totalRequests) * 100;
    const optimizationErrorRate = (optimization.failedRequests / optimization.totalRequests) * 100;
    const errorRateImprovement = baselineErrorRate - optimizationErrorRate;

    return {
      responseTimeImprovement: Math.round(responseTimeImprovement * 100) / 100,
      throughputImprovement: Math.round(throughputImprovement * 100) / 100,
      errorRateImprovement: Math.round(errorRateImprovement * 100) / 100
    };
  }

  private generateComparisonSummary(improvements: ComparisonResult['improvements']): string {
    const parts = [];

    if (improvements.responseTimeImprovement > 0) {
      parts.push(`${Math.abs(improvements.responseTimeImprovement)}% faster response time`);
    } else if (improvements.responseTimeImprovement < 0) {
      parts.push(`${Math.abs(improvements.responseTimeImprovement)}% slower response time`);
    }

    if (improvements.throughputImprovement > 0) {
      parts.push(`${Math.abs(improvements.throughputImprovement)}% higher throughput`);
    } else if (improvements.throughputImprovement < 0) {
      parts.push(`${Math.abs(improvements.throughputImprovement)}% lower throughput`);
    }

    if (improvements.errorRateImprovement > 0) {
      parts.push(`${Math.abs(improvements.errorRateImprovement)}% lower error rate`);
    } else if (improvements.errorRateImprovement < 0) {
      parts.push(`${Math.abs(improvements.errorRateImprovement)}% higher error rate`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No significant performance changes';
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private generateSummary(testResults: TestResult[]): any {
    if (testResults.length === 0) return {};

    const totalRequests = testResults.reduce((sum, r) => sum + r.totalRequests, 0);
    const avgResponseTime = testResults.reduce((sum, r) => sum + r.responseTime.mean, 0) / testResults.length;
    const avgThroughput = testResults.reduce((sum, r) => sum + r.throughput, 0) / testResults.length;
    const totalErrors = testResults.reduce((sum, r) => sum + r.failedRequests, 0);

    return {
      totalTests: testResults.length,
      totalRequests,
      totalErrors,
      overallErrorRate: (totalErrors / totalRequests) * 100,
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      averageThroughput: Math.round(avgThroughput * 100) / 100,
      bestPerformance: testResults.reduce((best, current) =>
        current.responseTime.mean < best.responseTime.mean ? current : best
      ),
      worstPerformance: testResults.reduce((worst, current) =>
        current.responseTime.mean > worst.responseTime.mean ? current : worst
      )
    };
  }

  private generateRecommendations(testResults: TestResult[]): string[] {
    const recommendations: string[] = [];

    const avgResponseTime = testResults.reduce((sum, r) => sum + r.responseTime.mean, 0) / testResults.length;
    const avgErrorRate = testResults.reduce((sum, r) => sum + (r.failedRequests / r.totalRequests) * 100, 0) / testResults.length;

    if (avgResponseTime > 1000) {
      recommendations.push('Consider implementing caching to reduce response times');
    }

    if (avgErrorRate > 5) {
      recommendations.push('Investigate high error rate and improve error handling');
    }

    const slowTests = testResults.filter(r => r.responseTime.p95 > 2000);
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow endpoints with P95 response time > 2 seconds');
    }

    const lowThroughputTests = testResults.filter(r => r.throughput < 10);
    if (lowThroughputTests.length > 0) {
      recommendations.push('Consider optimizing database queries and reducing blocking operations');
    }

    return recommendations;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default PerformanceTestSuite;