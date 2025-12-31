#!/usr/bin/env node

/**
 * Performance Test Script for Enhanced SSE System
 *
 * Tests the enhanced SSE implementation under load conditions
 * Monitors memory usage, connection limits, and response times
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = 'http://localhost:3007';
const CONCURRENT_USERS = 200;
const TEST_DURATION_SECONDS = 60;

class PerformanceTester {
  constructor() {
    this.connections = [];
    this.metrics = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageResponseTime: 0,
      memoryUsage: [],
      connectionErrors: 0
    };
    this.startTime = Date.now();
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100 // MB
    };
  }

  /**
   * Make HTTP request with timing
   */
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      const req = http.request(`${BASE_URL}${url}`, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          resolve({
            statusCode: res.statusCode,
            responseTime,
            data
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        reject({
          error,
          responseTime
        });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Create SSE connection and monitor it
   */
  async createSSEConnection(userId, tokenId) {
    const connectionId = `test_${userId}_${tokenId}`;
    const url = `/api/notifications/stream?token=${tokenId}&connectionId=${connectionId}`;

    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      const req = http.request(`${BASE_URL}${url}`, (res) => {
        if (res.statusCode !== 200) {
          this.metrics.failedConnections++;
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let connectionActive = true;
        let messagesReceived = 0;

        res.on('data', (chunk) => {
          messagesReceived++;

          // Check for connection_established message
          if (chunk.includes('connection_established')) {
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            this.metrics.successfulConnections++;
            this.metrics.totalConnections++;

            // Update average response time
            this.metrics.averageResponseTime =
              (this.metrics.averageResponseTime * (this.metrics.successfulConnections - 1) + responseTime)
              / this.metrics.successfulConnections;

            resolve({
              connectionId,
              responseTime,
              statusCode: res.statusCode
            });
          }
        });

        res.on('error', (error) => {
          if (connectionActive) {
            connectionActive = false;
            this.metrics.connectionErrors++;
            this.metrics.failedConnections++;
            reject(error);
          }
        });

        res.on('close', () => {
          connectionActive = false;
        });

        // Close connection after test duration
        setTimeout(() => {
          if (connectionActive) {
            req.destroy();
          }
        }, TEST_DURATION_SECONDS * 1000);
      });

      req.on('error', (error) => {
        this.metrics.failedConnections++;
        this.metrics.connectionErrors++;
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Get system health and metrics
   */
  async getSystemMetrics() {
    try {
      const healthResponse = await this.makeRequest('/api/health');

      // Try to get detailed metrics (requires authentication)
      let metricsResponse = null;
      try {
        metricsResponse = await this.makeRequest('/api/notifications/metrics', {
          headers: {
            'Authorization': 'Bearer test_token'
          }
        });
      } catch (error) {
        // Metrics endpoint requires auth, that's ok
      }

      const memoryUsage = this.getMemoryUsage();

      return {
        health: healthResponse.statusCode === 200,
        memoryUsage,
        detailedMetrics: metricsResponse
      };
    } catch (error) {
      return {
        health: false,
        error: error.message,
        memoryUsage: this.getMemoryUsage()
      };
    }
  }

  /**
   * Run concurrent connection test
   */
  async runConcurrentTest() {
    console.log(`🚀 Starting performance test with ${CONCURRENT_USERS} concurrent users...`);
    console.log(`📊 Test duration: ${TEST_DURATION_SECONDS} seconds`);
    console.log(`⏰ Start time: ${new Date().toISOString()}`);
    console.log('');

    // Get baseline metrics
    const baselineMetrics = await this.getSystemMetrics();
    console.log('📊 Baseline metrics:');
    console.log(`   Health: ${baselineMetrics.health ? '✅ OK' : '❌ Failed'}`);
    console.log(`   Memory: ${baselineMetrics.memoryUsage.rss}MB RSS, ${baselineMetrics.memoryUsage.heapUsed}MB Heap`);
    console.log('');

    // Create concurrent connections
    const connectionPromises = [];
    const batchPromises = [];

    console.log('🔌 Creating concurrent SSE connections...');

    for (let i = 0; i < CONCURRENT_USERS; i++) {
      const userId = `user_${i}`;
      const tokenId = `token_${i}_${Date.now()}`;

      const connectionPromise = this.createSSEConnection(userId, tokenId)
        .then(result => {
          console.log(`✅ Connection ${i + 1}/${CONCURRENT_USERS}: ${result.connectionId} (${result.responseTime.toFixed(0)}ms)`);
          return result;
        })
        .catch(error => {
          console.log(`❌ Connection ${i + 1}/${CONCURRENT_USERS}: ${error.message}`);
          return { error, connectionId: null };
        });

      connectionPromises.push(connectionPromise);

      // Create connections in batches to avoid overwhelming the server
      if (connectionPromises.length >= 10) {
        batchPromises.push(Promise.allSettled(connectionPromises));
        connectionPromises.length = 0;

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final batch
    if (connectionPromises.length > 0) {
      batchPromises.push(Promise.allSettled(connectionPromises));
    }

    // Wait for all connections to be established
    console.log('');
    console.log('⏳ Waiting for all connections to be established...');
    const results = await Promise.allSettled(batchPromises);

    // Flatten results
    const allConnections = results.flatMap(batch =>
      batch.value || []
    );

    // Wait for test duration
    console.log('');
    console.log(`⏱️  Maintaining connections for ${TEST_DURATION_SECONDS} seconds...`);

    const monitorInterval = setInterval(() => {
      const currentMetrics = this.getSystemMetrics();
      const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);

      console.log(`📊 [${elapsedTime}s] Memory: ${currentMetrics.rss}MB RSS, ${currentMetrics.heapUsed}MB Heap | Active: ${this.metrics.successfulConnections}/${CONCURRENT_USERS} connections`);

      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        ...currentMetrics
      });
    }, 5000);

    await new Promise(resolve => setTimeout(resolve, TEST_DURATION_SECONDS * 1000));
    clearInterval(monitorInterval);

    // Final metrics
    const finalMetrics = await this.getSystemMetrics();
    const totalTestTime = (Date.now() - this.startTime) / 1000;

    console.log('');
    console.log('📊 Final Results:');
    console.log('================');
    console.log(`⏱️  Total test time: ${totalTestTime.toFixed(1)} seconds`);
    console.log(`🔌 Total connections attempted: ${CONCURRENT_USERS}`);
    console.log(`✅ Successful connections: ${this.metrics.successfulConnections}`);
    console.log(`❌ Failed connections: ${this.metrics.failedConnections}`);
    console.log(`⚡ Average response time: ${this.metrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`🔗 Connection errors: ${this.metrics.connectionErrors}`);
    console.log('');
    console.log('💾 Memory Usage:');
    console.log(`   Initial: ${baselineMetrics.memoryUsage.rss}MB RSS, ${baselineMetrics.memoryUsage.heapUsed}MB Heap`);
    console.log(`   Final: ${finalMetrics.memoryUsage.rss}MB RSS, ${finalMetrics.memoryUsage.heapUsed}MB Heap`);

    const memoryIncrease = finalMetrics.memoryUsage.rss - baselineMetrics.memoryUsage.rss;
    console.log(`   Increase: +${memoryIncrease.toFixed(1)}MB RSS`);
    console.log(`   Average per connection: ${(memoryIncrease / Math.max(1, this.metrics.successfulConnections)).toFixed(2)}MB`);
    console.log('');

    // Performance evaluation
    const successRate = (this.metrics.successfulConnections / CONCURRENT_USERS) * 100;
    const avgResponseTime = this.metrics.averageResponseTime;
    const memoryPerConnection = memoryIncrease / Math.max(1, this.metrics.successfulConnections);

    console.log('🎯 Performance Evaluation:');
    console.log('=========================');

    let allTestsPassed = true;

    // Success rate test (target: >95%)
    if (successRate >= 95) {
      console.log(`✅ Success rate: ${successRate.toFixed(1)}% (target: >95%)`);
    } else {
      console.log(`❌ Success rate: ${successRate.toFixed(1)}% (target: >95%)`);
      allTestsPassed = false;
    }

    // Response time test (target: <100ms)
    if (avgResponseTime < 100) {
      console.log(`✅ Average response time: ${avgResponseTime.toFixed(0)}ms (target: <100ms)`);
    } else {
      console.log(`❌ Average response time: ${avgResponseTime.toFixed(0)}ms (target: <100ms)`);
      allTestsPassed = false;
    }

    // Memory usage test (target: <1MB per connection)
    if (memoryPerConnection < 1) {
      console.log(`✅ Memory per connection: ${memoryPerConnection.toFixed(2)}MB (target: <1MB)`);
    } else {
      console.log(`❌ Memory per connection: ${memoryPerConnection.toFixed(2)}MB (target: <1MB)`);
      allTestsPassed = false;
    }

    // Total memory usage test (target: <50MB for 200 users)
    if (memoryIncrease < 50) {
      console.log(`✅ Total memory increase: ${memoryIncrease.toFixed(1)}MB (target: <50MB for 200 users)`);
    } else {
      console.log(`❌ Total memory increase: ${memoryIncrease.toFixed(1)}MB (target: <50MB for 200 users)`);
      allTestsPassed = false;
    }

    console.log('');
    if (allTestsPassed) {
      console.log('🎉 All performance tests PASSED! System is ready for 200 concurrent users.');
    } else {
      console.log('⚠️  Some performance tests FAILED. Please review the metrics above.');
    }

    // Save detailed metrics to file
    const reportData = {
      timestamp: new Date().toISOString(),
      testConfiguration: {
        concurrentUsers: CONCURRENT_USERS,
        testDuration: TEST_DURATION_SECONDS,
        targetUrl: BASE_URL
      },
      results: {
        successRate,
        avgResponseTime,
        memoryPerConnection,
        totalMemoryIncrease: memoryIncrease,
        ...this.metrics,
        baselineMemory: baselineMetrics.memoryUsage,
        finalMemory: finalMetrics.memoryUsage,
        memoryHistory: this.metrics.memoryUsage
      }
    };

    const fs = require('fs');
    const reportFile = `performance-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`📄 Detailed report saved to: ${reportFile}`);

    return allTestsPassed;
  }
}

// Run the test
async function main() {
  const tester = new PerformanceTester();

  try {
    const success = await tester.runConcurrentTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceTester;