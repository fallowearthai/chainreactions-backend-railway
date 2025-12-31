/**
 * Database Optimization Service - High-performance query optimization
 *
 * Features:
 * - Intelligent query optimization and caching
 * - Connection pooling and management
 * - Query performance monitoring
 * - Automatic index recommendations
 * - Connection health monitoring
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PerformanceUtils, StringUtils, DataTransformUtils } from '../utils/CommonUtilities';
import { Logger } from '../cache/CacheLogger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  maxUses?: number;
}

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  timeout?: number;
  retryCount?: number;
  useReadReplica?: boolean;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  rows: number;
  cached: boolean;
  timestamp: string;
  parameters?: any[];
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  estimatedImprovement: number;
  currentPerformance: number;
  recommendedIndexName: string;
}

/**
 * High-performance database optimization service
 */
export class DatabaseOptimizer {
  private pool!: Pool;
  private queryCache = new Map<string, { result: any; expires: number }>();
  private queryMetrics: QueryMetrics[] = [];
  private config: DatabaseConfig;
  private readonly maxCacheSize = 1000;
  private readonly metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  constructor(config: DatabaseConfig) {
    this.config = {
      poolSize: 20,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 10000,
      maxUses: 7500,
      ...config
    };

    this.initializeConnectionPool();
    this.startCacheCleanup();
    this.startMetricsCleanup();
  }

  private initializeConnectionPool(): void {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.poolSize,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      maxUses: this.config.maxUses
    });

    this.pool.on('connect', (client: PoolClient) => {
      Logger.info('Database client connected');
    });

    this.pool.on('error', (err: Error) => {
      Logger.error('Database pool error:', err);
    });

    this.pool.on('remove', (client: PoolClient) => {
      Logger.info('Database client removed');
    });
  }

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async query<T extends QueryResultRow = any>(
    sql: string,
    parameters: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const timer = PerformanceUtils.createTimer('database.query');
    const cacheKey = options.cache !== false ? this.createCacheKey(sql, parameters) : null;

    try {
      // Try cache first if enabled
      if (cacheKey && options.cache !== false) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          const duration = timer.elapsed();
          this.recordQueryMetrics(sql, duration, cached.rowCount || 0, true, parameters);

          Logger.debug('Query served from cache', {
            sql: sql.substring(0, 100),
            duration,
            rowCount: cached.rowCount
          });

          return cached as QueryResult<T>;
        }
      }

      // Execute query with timeout
      const result = await this.executeQueryWithTimeout<T>(sql, parameters, options.timeout);
      const duration = timer.elapsed();

      // Cache result if enabled and query is successful
      if (cacheKey && options.cache !== false && result.rows.length > 0) {
        this.setCache(cacheKey, result, options.cacheTTL || 300); // 5 minutes default
      }

      // Record metrics for performance analysis
      this.recordQueryMetrics(sql, duration, result.rows.length, false, parameters);

      Logger.debug('Query executed successfully', {
        sql: sql.substring(0, 100),
        duration,
        rowCount: result.rows.length,
        cached: false
      });

      return result;

    } catch (error) {
      const duration = timer.elapsed();
      Logger.error('Query execution failed', {
        sql: sql.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(queries: Array<{ sql: string; parameters?: any[] }>): Promise<T[]> {
    const client = await this.pool.connect();
    const timer = PerformanceUtils.createTimer('database.transaction');

    try {
      await client.query('BEGIN');

      const results: T[] = [];
      for (const query of queries) {
        const result = await client.query(query.sql, query.parameters || []);
        results.push(result.rows as T);
      }

      await client.query('COMMIT');

      const duration = timer.elapsed();
      Logger.info('Transaction completed successfully', {
        queryCount: queries.length,
        duration
      });

      return results;

    } catch (error) {
      await client.query('ROLLBACK');
      const duration = timer.elapsed();

      Logger.error('Transaction failed and rolled back', {
        queryCount: queries.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch insert for improved performance
   */
  async batchInsert<T>(
    table: string,
    records: T[],
    batchSize: number = 1000,
    options: QueryOptions = {}
  ): Promise<void> {
    if (records.length === 0) return;

    const timer = PerformanceUtils.createTimer('database.batchInsert');

    try {
      const columns = Object.keys(records[0] as any);
      const columnNames = columns.join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

      const sql = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`;

      // Process in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const values = batch.map(record => columns.map(col => (record as any)[col]));

        await this.query(sql, values.flat(), options);
      }

      const duration = timer.elapsed();
      Logger.info('Batch insert completed', {
        table,
        recordCount: records.length,
        batchSize,
        duration
      });

    } catch (error) {
      const duration = timer.elapsed();
      Logger.error('Batch insert failed', {
        table,
        recordCount: records.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      throw error;
    }
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(limit?: number): QueryMetrics[] {
    const metrics = this.queryMetrics
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return limit ? metrics.slice(0, limit) : metrics;
  }

  /**
   * Analyze slow queries and provide optimization recommendations
   */
  async analyzeSlowQueries(): Promise<{
    slowQueries: QueryMetrics[];
    recommendations: IndexRecommendation[];
    optimizationSuggestions: string[];
  }> {
    const slowQueries = this.queryMetrics.filter(q => q.duration > 1000); // Queries > 1 second

    // Analyze for potential indexes
    const recommendations = await this.generateIndexRecommendations(slowQueries);

    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions(slowQueries);

    return {
      slowQueries: slowQueries.sort((a, b) => b.duration - a.duration),
      recommendations,
      optimizationSuggestions
    };
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(recommendations: IndexRecommendation[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      for (const recommendation of recommendations) {
        const indexSQL = `
          CREATE INDEX CONCURRENTLY ${recommendation.recommendedIndexName}
          ON ${recommendation.table}
          USING ${recommendation.type} (${recommendation.columns.join(', ')})
        `;

        await client.query(indexSQL);

        Logger.info('Created recommended index', {
          table: recommendation.table,
          indexName: recommendation.recommendedIndexName,
          estimatedImprovement: recommendation.estimatedImprovement
        });
      }
    } catch (error) {
      Logger.error('Failed to create recommended indexes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database health and performance statistics
   */
  async getDatabaseStats(): Promise<{
    connectionPool: any;
    performance: any;
    cacheStats: { size: number; hitRate: number };
    slowQueries: QueryMetrics[];
  }> {
    try {
      // Get connection pool stats
      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      // Get performance stats
      const performanceQuery = `
        SELECT
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables
        ORDER BY seq_scan + seq_tup_read DESC
        LIMIT 10
      `;

      const performanceResult = await this.query(performanceQuery);

      // Calculate cache stats
      const totalQueries = this.queryMetrics.length;
      const cachedQueries = this.queryMetrics.filter(q => q.cached).length;
      const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;

      const slowQueries = this.queryMetrics
        .filter(q => q.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

      return {
        connectionPool: poolStats,
        performance: performanceResult.rows,
        cacheStats: {
          size: this.queryCache.size,
          hitRate: Math.round(cacheHitRate * 100) / 100
        },
        slowQueries
      };

    } catch (error) {
      Logger.error('Failed to get database stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const timer = PerformanceUtils.createTimer('database.health');
      const result = await this.query('SELECT 1 as health_check');
      const responseTime = timer.elapsed();

      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (responseTime > 1000) {
        status = 'degraded';
      }
      if (responseTime > 5000) {
        status = 'unhealthy';
      }

      return {
        status,
        details: {
          responseTime,
          poolStats,
          cacheSize: this.queryCache.size
        }
      };

    } catch (error) {
      Logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  // Private helper methods

  private async executeQueryWithTimeout<T extends QueryResultRow>(
    sql: string,
    parameters: any[],
    timeout?: number
  ): Promise<QueryResult<T>> {
    const queryTimeout = timeout || 30000; // 30 seconds default

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query timeout after ${queryTimeout}ms`));
      }, queryTimeout);

      this.pool.query<T>(sql, parameters)
        .then((result: any) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: any) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private createCacheKey(sql: string, parameters: any[]): string {
    const normalizedSQL = StringUtils.normalizeText(sql, {
      lowercase: true,
      removeWhitespace: true
    });

    return `${normalizedSQL}:${JSON.stringify(parameters)}`;
  }

  private getFromCache<T extends QueryResultRow>(key: string): QueryResult<T> | null {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.result;
    }

    if (cached) {
      this.queryCache.delete(key);
    }

    return null;
  }

  private setCache<T extends QueryResultRow>(key: string, result: QueryResult<T>, ttl: number): void {
    if (this.queryCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }

    this.queryCache.set(key, {
      result,
      expires: Date.now() + (ttl * 1000)
    });
  }

  private recordQueryMetrics(
    sql: string,
    duration: number,
    rowCount: number,
    cached: boolean,
    parameters?: any[]
  ): void {
    const metric: QueryMetrics = {
      query: sql.substring(0, 200), // Limit length
      duration,
      rows: rowCount,
      cached,
      timestamp: new Date().toISOString(),
      parameters
    };

    this.queryMetrics.push(metric);

    // Limit metrics size
    if (this.queryMetrics.length > 10000) {
      this.queryMetrics = this.queryMetrics.slice(-5000);
    }
  }

  private async generateIndexRecommendations(
    slowQueries: QueryMetrics[]
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    const analyzedQueries = new Set<string>();

    for (const metric of slowQueries) {
      const queryHash = DataTransformUtils.hashObject(metric.query);
      if (analyzedQueries.has(queryHash)) continue;
      analyzedQueries.add(queryHash);

      // Simple analysis - in production, you'd use more sophisticated query parsing
      const tables = this.extractTableNames(metric.query);
      const columns = this.extractColumnNames(metric.query);

      for (const table of tables) {
        for (const column of columns) {
          recommendations.push({
            table,
            columns: [column],
            type: 'btree',
            estimatedImprovement: Math.round(metric.duration * 0.7), // 70% improvement estimate
            currentPerformance: metric.duration,
            recommendedIndexName: `idx_${table}_${column}_perf`
          });
        }
      }
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  private generateOptimizationSuggestions(slowQueries: QueryMetrics[]): string[] {
    const suggestions: string[] = [];

    // Analyze patterns
    const avgDuration = slowQueries.reduce((sum, q) => sum + q.duration, 0) / slowQueries.length;
    const hasLargeResultSets = slowQueries.some(q => q.rows > 1000);
    const hasComplexQueries = slowQueries.some(q => q.query.includes('JOIN') || q.query.includes('SUBQUERY'));

    if (avgDuration > 5000) {
      suggestions.push('Consider optimizing frequently used queries with proper indexing');
    }

    if (hasLargeResultSets) {
      suggestions.push('Implement pagination for queries returning large result sets');
    }

    if (hasComplexQueries) {
      suggestions.push('Consider simplifying complex JOINs or using materialized views');
    }

    suggestions.push('Enable query result caching for read-heavy operations');
    suggestions.push('Consider read replicas for reporting queries');

    return suggestions;
  }

  private extractTableNames(query: string): string[] {
    const tableRegex = /\bFROM\s+(\w+)|\bJOIN\s+(\w+)/gi;
    const tables = new Set<string>();
    let match;

    while ((match = tableRegex.exec(query)) !== null) {
      const tableName = match[1] || match[2];
      if (tableName) tables.add(tableName);
    }

    return Array.from(tables);
  }

  private extractColumnNames(query: string): string[] {
    const whereRegex = /\bWHERE\s+([\w\s=<>!&|]+)/i;
    const match = whereRegex.exec(query);

    if (!match) return [];

    const whereClause = match[1];
    const columnRegex = /\b(\w+)\s*=/g;
    const columns = new Set<string>();
    let columnMatch;

    while ((columnMatch = columnRegex.exec(whereClause)) !== null) {
      columns.add(columnMatch[1]);
    }

    return Array.from(columns);
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.queryCache.entries()) {
        if (now >= value.expires) {
          this.queryCache.delete(key);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private startMetricsCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.metricsRetentionPeriod;
      this.queryMetrics = this.queryMetrics.filter(m =>
        new Date(m.timestamp).getTime() > cutoff
      );
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    Logger.info('Shutting down database optimizer...');

    if (this.pool) {
      await this.pool.end();
    }

    this.queryCache.clear();
    this.queryMetrics = [];

    Logger.info('Database optimizer shutdown complete');
  }
}

export default DatabaseOptimizer;