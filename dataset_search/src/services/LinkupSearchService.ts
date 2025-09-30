import axios, { AxiosResponse } from 'axios';
import { LinkupApiResponse, NROOrganization, DatasetSearchError } from '../types/DatasetSearchTypes';

interface RateLimiter {
  tokens: number;
  lastRefill: number;
  tokensPerSecond: number;
  maxTokens: number;
}

export interface LinkupSearchOptions {
  maxConcurrent?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class LinkupSearchService {
  private apiKeys: string[];
  private apiUrl: string;
  private rateLimiters: RateLimiter[];
  private activeCalls: Set<Promise<any>> = new Set();

  constructor() {
    this.apiKeys = [
      process.env.LINKUP_API_KEY || '',
      process.env.LINKUP_API_KEY_2 || ''
    ].filter(key => key.length > 0);

    this.apiUrl = process.env.LINKUP_API_URL || 'https://api.linkup.so/v1/search';

    if (this.apiKeys.length === 0) {
      throw new DatasetSearchError('At least one LINKUP_API_KEY environment variable is required', 'MISSING_API_KEY', 500);
    }

    console.log(`🔗 LinkupSearchService initialized with ${this.apiKeys.length} API keys for parallel processing`);

    // Initialize rate limiters for each API key: 10 queries per second with burst capacity
    this.rateLimiters = this.apiKeys.map(() => ({
      tokens: 10,
      lastRefill: Date.now(),
      tokensPerSecond: 10,
      maxTokens: 10
    }));
  }

  /**
   * Refill rate limiter tokens based on elapsed time
   */
  private refillTokens(apiIndex: number): void {
    const now = Date.now();
    const elapsed = (now - this.rateLimiters[apiIndex].lastRefill) / 1000;

    if (elapsed > 0) {
      const tokensToAdd = elapsed * this.rateLimiters[apiIndex].tokensPerSecond;
      this.rateLimiters[apiIndex].tokens = Math.min(
        this.rateLimiters[apiIndex].maxTokens,
        this.rateLimiters[apiIndex].tokens + tokensToAdd
      );
      this.rateLimiters[apiIndex].lastRefill = now;
    }
  }

  /**
   * Wait for available rate limit token for specific API
   */
  private async waitForToken(apiIndex: number): Promise<void> {
    this.refillTokens(apiIndex);

    if (this.rateLimiters[apiIndex].tokens >= 1) {
      this.rateLimiters[apiIndex].tokens -= 1;
      return;
    }

    // Calculate wait time for next token
    const waitMs = (1 / this.rateLimiters[apiIndex].tokensPerSecond) * 1000;
    await this.delay(waitMs);
    return this.waitForToken(apiIndex);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build the OSINT prompt for relationship analysis
   */
  private buildOSINTPrompt(institutionA: string, riskEntity: string, country: string): string {
    return `Find relationships between "${institutionA}" and "${riskEntity}" in ${country}. Search for partnerships, collaborations, business relationships, personnel connections, and any significant associations. Provide a comprehensive analysis with sources.`;
  }

  /**
   * Perform single Linkup API search with retry logic
   */
  private async performSingleSearch(
    institutionA: string,
    riskEntity: string,
    country: string,
    apiIndex: number = 0,
    signal?: AbortSignal
  ): Promise<LinkupApiResponse> {
    const prompt = this.buildOSINTPrompt(institutionA, riskEntity, country);

    // Wait for rate limit token for specific API
    await this.waitForToken(apiIndex);

    const requestData = {
      q: prompt,
      depth: "standard", // Changed from "deep" to "standard" for better performance
      outputType: "sourcedAnswer"
    };

    try {
      const response: AxiosResponse<LinkupApiResponse> = await axios.post(
        this.apiUrl,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKeys[apiIndex]}`
          },
          timeout: 60000, // 60 second timeout
          signal
        }
      );

      if (!response.data || typeof response.data.answer !== 'string') {
        throw new DatasetSearchError(
          `Invalid response format from Linkup API`,
          'INVALID_API_RESPONSE',
          502
        );
      }

      return response.data;
    } catch (error: any) {
      if (signal?.aborted) {
        throw new DatasetSearchError('Search was cancelled', 'SEARCH_CANCELLED', 499);
      }

      if ((error as any).response?.status === 429) {
        // Rate limit exceeded, wait and retry
        await this.delay(2000);
        return this.performSingleSearch(institutionA, riskEntity, country, apiIndex, signal);
      }

      throw new DatasetSearchError(
        `Linkup API request failed: ${(error as Error).message}`,
        'API_REQUEST_FAILED',
        error.response?.status || 500
      );
    }
  }

  /**
   * Search for relationships between institution and multiple risk entities with parallel APIs
   */
  async searchInstitutionRelationships(
    institutionName: string,
    institutionCountry: string,
    riskEntities: NROOrganization[],
    options: LinkupSearchOptions = {},
    signal?: AbortSignal,
    onProgress?: (current: number, total: number, result?: LinkupApiResponse, apiIndex?: number) => void
  ): Promise<LinkupApiResponse[]> {
    const {
      maxConcurrent = 2,
      timeoutMs = 300000, // 5 minutes
      retryAttempts = 3,
      retryDelayMs = 1000
    } = options;

    const results: LinkupApiResponse[] = [];
    const errors: Error[] = [];
    let completed = 0;

    // Create timeout signal
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    // Combine external signal with timeout signal
    const combinedSignal = signal || timeoutController.signal;

    try {
      console.log(`🚀 Starting parallel search with ${this.apiKeys.length} APIs for ${riskEntities.length} entities`);

      // Process entities using parallel APIs for true concurrency
      const searchPromises = riskEntities.map(async (entity, index) => {
        if (combinedSignal.aborted) {
          throw new DatasetSearchError('Search operation was cancelled', 'SEARCH_CANCELLED', 499);
        }

        // Assign entity to an API key (round-robin distribution)
        const apiIndex = index % this.apiKeys.length;

        try {
          console.log(`🔍 Entity ${index + 1}/${riskEntities.length}: ${entity.organization_name} → API ${apiIndex + 1}`);

          const result = await this.performSingleSearch(
            institutionName,
            entity.organization_name,
            entity.countries[0] || institutionCountry,
            apiIndex,
            combinedSignal
          );

          completed++;
          onProgress?.(completed, riskEntities.length, result, apiIndex);

          console.log(`✅ Entity ${index + 1} completed with API ${apiIndex + 1}`);
          return result;
        } catch (error) {
          completed++;
          errors.push(error as Error);
          onProgress?.(completed, riskEntities.length, undefined, apiIndex);

          console.error(`❌ Entity ${index + 1} failed with API ${apiIndex + 1}:`, error instanceof Error ? error.message : String(error));

          // Continue with other searches even if one fails
          return null;
        }
      });

      // Wait for all searches to complete (running in parallel)
      const allResults = await Promise.all(searchPromises);

      clearTimeout(timeoutId);

      // Collect successful results
      allResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });

      console.log(`🎯 Parallel search completed: ${results.length}/${riskEntities.length} successful`);

      // If we have some results, return them even if some failed
      if (results.length > 0) {
        return results;
      }

      // If no results and we have errors, throw the first error
      if (errors.length > 0) {
        throw errors[0];
      }

      return results;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DatasetSearchError) {
        throw error;
      }

      throw new DatasetSearchError(
        `Parallel search operation failed: ${error}`,
        'PARALLEL_SEARCH_FAILED',
        500
      );
    } finally {
      // Clear any remaining active calls
      this.activeCalls.clear();
    }
  }

  /**
   * Search for a single institution-entity relationship
   */
  async searchSingleRelationship(
    institutionName: string,
    riskEntityName: string,
    country: string,
    signal?: AbortSignal
  ): Promise<LinkupApiResponse> {
    try {
      return await this.performSingleSearch(institutionName, riskEntityName, country, 0, signal);
    } catch (error) {
      if (error instanceof DatasetSearchError) {
        throw error;
      }

      throw new DatasetSearchError(
        `Single relationship search failed: ${(error as Error).message}`,
        'SINGLE_SEARCH_FAILED',
        500
      );
    }
  }

  /**
   * Test the Linkup API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.searchSingleRelationship(
        'Test Institution',
        'Test Entity',
        'Test Country'
      );

      return !!(testResponse && testResponse.answer);
    } catch (error) {
      console.error('Linkup API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current rate limit status for all APIs
   */
  getRateLimitStatus(): { apiIndex: number; tokens: number; maxTokens: number; refillRate: number }[] {
    return this.rateLimiters.map((limiter, index) => {
      this.refillTokens(index);
      return {
        apiIndex: index,
        tokens: limiter.tokens,
        maxTokens: limiter.maxTokens,
        refillRate: limiter.tokensPerSecond
      };
    });
  }

  /**
   * Cancel all active searches
   */
  cancelAllSearches(): void {
    this.activeCalls.clear();
  }
}