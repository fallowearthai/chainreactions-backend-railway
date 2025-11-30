/**
 * Cached API Service - High-performance wrapper for external API calls
 *
 * Provides intelligent caching for external API calls including:
 * - Gemini AI API responses
 * - Linkup API results
 * - NRO data queries
 * - Search results and entity matching
 */

import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { CacheService, CacheKeyBuilder, getCacheInstance } from './CacheService';
import { PerformanceUtils, ValidationUtils } from '../utils/CommonUtilities';

export interface CachedAPIOptions {
  ttl?: number; // Cache time-to-live in seconds
  forceRefresh?: boolean; // Bypass cache and force fresh call
  compress?: boolean; // Compress large responses
  namespace?: string; // Cache namespace
  version?: string; // Cache version for invalidation
  retryCount?: number; // Number of retries on failure
  timeout?: number; // Request timeout in milliseconds
}

export interface CachedAPIResponse<T = any> {
  data: T;
  cached: boolean;
  responseTime: number;
  cacheAge?: number;
  source: 'cache' | 'api';
}

export interface APIConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxResponseSize: number;
}

/**
 * High-performance cached API service
 */
export class CachedAPIService {
  private cache: CacheService;
  private config: APIConfig;

  constructor(cache?: CacheService, config: Partial<APIConfig> = {}) {
    this.cache = cache || getCacheInstance();
    this.config = {
      timeout: 30000, // 30 seconds default
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      maxResponseSize: 50 * 1024 * 1024, // 50MB
      ...config
    };
  }

  /**
   * Make cached GET request
   */
  async get<T = any>(
    url: string,
    params: Record<string, any> = {},
    options: CachedAPIOptions = {}
  ): Promise<CachedAPIResponse<T>> {
    const timer = PerformanceUtils.createTimer('api.get');
    const cacheKey = CacheKeyBuilder
      .for('http')
      .method('get')
      .params({ url, ...params })
      .build();

    // Try cache first unless force refresh
    if (!options.forceRefresh) {
      const cached = await this.cache.get<T>(cacheKey, {
        ttl: options.ttl,
        compress: options.compress,
        namespace: options.namespace || 'http_cache',
        version: options.version
      });

      if (cached) {
        const responseTime = timer.elapsed();
        return {
          data: cached,
          cached: true,
          responseTime,
          source: 'cache'
        };
      }
    }

    // Make fresh API call
    const response = await this.makeRequest<T>('GET', url, params, {}, options);
    const responseTime = timer.elapsed();

    // Cache the response
    if (response.data && this.shouldCacheResponse(response)) {
      await this.cache.set(cacheKey, response.data, {
        ttl: options.ttl,
        compress: options.compress,
        namespace: options.namespace || 'http_cache',
        version: options.version
      });
    }

    return {
      data: response.data,
      cached: false,
      responseTime,
      source: 'api'
    };
  }

  /**
   * Make cached POST request
   */
  async post<T = any>(
    url: string,
    data: any,
    params: Record<string, any> = {},
    options: CachedAPIOptions = {}
  ): Promise<CachedAPIResponse<T>> {
    const timer = PerformanceUtils.createTimer('api.post');
    const cacheKey = CacheKeyBuilder
      .for('http')
      .method('post')
      .params({ url, ...params })
      .hash(JSON.stringify(data))
      .build();

    // Try cache first unless force refresh
    if (!options.forceRefresh) {
      const cached = await this.cache.get<T>(cacheKey, {
        ttl: options.ttl,
        compress: options.compress,
        namespace: options.namespace || 'http_cache',
        version: options.version
      });

      if (cached) {
        const responseTime = timer.elapsed();
        return {
          data: cached,
          cached: true,
          responseTime,
          source: 'cache'
        };
      }
    }

    // Make fresh API call
    const response = await this.makeRequest<T>('POST', url, params, data, options);
    const responseTime = timer.elapsed();

    // Cache the response
    if (response.data && this.shouldCacheResponse(response)) {
      await this.cache.set(cacheKey, response.data, {
        ttl: options.ttl,
        compress: options.compress,
        namespace: options.namespace || 'http_cache',
        version: options.version
      });
    }

    return {
      data: response.data,
      cached: false,
      responseTime,
      source: 'api'
    };
  }

  /**
   * Cache Gemini AI API responses with intelligent key generation
   */
  async cacheGeminiResponse<T = any>(
    prompt: string,
    apiResponse: T,
    options: CachedAPIOptions = {}
  ): Promise<void> {
    const cacheKey = CacheKeyBuilder
      .for('gemini_api')
      .method('completion')
      .hash(prompt)
      .build();

    await this.cache.set(cacheKey, apiResponse, {
      ttl: options.ttl || 3600, // 1 hour default for AI responses
      compress: options.compress !== false, // Compress by default
      namespace: 'gemini_api',
      version: options.version
    });
  }

  /**
   * Get cached Gemini AI response
   */
  async getCachedGeminiResponse<T = any>(
    prompt: string,
    options: CachedAPIOptions = {}
  ): Promise<T | null> {
    const cacheKey = CacheKeyBuilder
      .for('gemini_api')
      .method('completion')
      .hash(prompt)
      .build();

    return await this.cache.get<T>(cacheKey, {
      ttl: options.ttl,
      compress: options.compress !== false,
      namespace: 'gemini_api',
      version: options.version
    });
  }

  /**
   * Cache Linkup API results
   */
  async cacheLinkupResponse<T = any>(
    query: string,
    filters: Record<string, any>,
    apiResponse: T,
    options: CachedAPIOptions = {}
  ): Promise<void> {
    const cacheKey = CacheKeyBuilder
      .for('linkup_api')
      .method('search')
      .params({ query, ...filters })
      .build();

    await this.cache.set(cacheKey, apiResponse, {
      ttl: options.ttl || 1800, // 30 minutes default for search results
      compress: options.compress !== false,
      namespace: 'linkup_api',
      version: options.version
    });
  }

  /**
   * Get cached Linkup API response
   */
  async getCachedLinkupResponse<T = any>(
    query: string,
    filters: Record<string, any> = {},
    options: CachedAPIOptions = {}
  ): Promise<T | null> {
    const cacheKey = CacheKeyBuilder
      .for('linkup_api')
      .method('search')
      .params({ query, ...filters })
      .build();

    return await this.cache.get<T>(cacheKey, {
      ttl: options.ttl,
      compress: options.compress !== false,
      namespace: 'linkup_api',
      version: options.version
    });
  }

  /**
   * Cache NRO data queries
   */
  async cacheNROData<T = any>(
    queryType: string,
    params: Record<string, any>,
    data: T,
    options: CachedAPIOptions = {}
  ): Promise<void> {
    const cacheKey = CacheKeyBuilder
      .for('nro_data')
      .method(queryType)
      .params(params)
      .build();

    await this.cache.set(cacheKey, data, {
      ttl: options.ttl || 86400, // 24 hours for NRO data (relatively static)
      compress: options.compress !== false,
      namespace: 'nro_data',
      version: options.version
    });
  }

  /**
   * Get cached NRO data
   */
  async getCachedNROData<T = any>(
    queryType: string,
    params: Record<string, any> = {},
    options: CachedAPIOptions = {}
  ): Promise<T | null> {
    const cacheKey = CacheKeyBuilder
      .for('nro_data')
      .method(queryType)
      .params(params)
      .build();

    return await this.cache.get<T>(cacheKey, {
      ttl: options.ttl,
      compress: options.compress !== false,
      namespace: 'nro_data',
      version: options.version
    });
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern: {
    namespace?: string;
    service?: string;
    method?: string;
  }): Promise<void> {
    const namespaces = [pattern.namespace].filter(Boolean);

    for (const namespace of namespaces) {
      await this.cache.clearNamespace(namespace);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Health check for cached API service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const cacheHealth = await this.cache.healthCheck();

    // Test API connectivity with a simple request
    let apiStatus = 'healthy';
    let apiResponseTime = 0;

    try {
      const timer = PerformanceUtils.createTimer('api.health');
      await axios.get('https://httpbin.org/status/200', {
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 300
      });
      apiResponseTime = timer.elapsed();
    } catch (error) {
      apiStatus = 'unhealthy';
    }

    const overallStatus = cacheHealth.status === 'healthy' && apiStatus === 'healthy'
      ? 'healthy'
      : cacheHealth.status === 'degraded' || apiStatus === 'unhealthy'
      ? 'degraded'
      : 'unhealthy';

    return {
      status: overallStatus,
      details: {
        cache: cacheHealth,
        api: {
          status: apiStatus,
          responseTime: apiResponseTime
        }
      }
    };
  }

  // Private helper methods

  private async makeRequest<T>(
    method: 'GET' | 'POST',
    url: string,
    params: Record<string, any>,
    data: any,
    options: CachedAPIOptions
  ): Promise<AxiosResponse<T>> {
    const config: AxiosRequestConfig = {
      method,
      url,
      params,
      data,
      timeout: options.timeout || this.config.timeout,
      validateStatus: (status) => status >= 200 && status < 300,
      maxContentLength: this.config.maxResponseSize,
      maxBodyLength: this.config.maxResponseSize
    };

    const retryCount = options.retryCount || this.config.retryAttempts;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const response = await axios(config);
        return response;
      } catch (error) {
        if (attempt === retryCount) {
          throw error;
        }

        // Wait before retry
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }

    throw new Error('Request failed after all retry attempts');
  }

  private shouldCacheResponse(response: AxiosResponse): boolean {
    // Don't cache if response is too large
    const contentLength = response.headers['content-length'];
    if (contentLength && parseInt(contentLength) > this.config.maxResponseSize) {
      return false;
    }

    // Don't cache error responses
    if (response.status >= 400) {
      return false;
    }

    // Don't cache if no-cache header is present
    const cacheControl = response.headers['cache-control'];
    if (cacheControl && cacheControl.includes('no-cache')) {
      return false;
    }

    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global use
 */
let cachedApiInstance: CachedAPIService | null = null;

export function getCachedApiInstance(): CachedAPIService {
  if (!cachedApiInstance) {
    cachedApiInstance = new CachedAPIService();
  }
  return cachedApiInstance;
}

export default CachedAPIService;