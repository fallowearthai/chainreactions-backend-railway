import { LinkupApiResponse, NROOrganization } from '../types/DatasetSearchTypes';
export interface LinkupSearchOptions {
    maxConcurrent?: number;
    timeoutMs?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
    fromDate?: string;
    toDate?: string;
}
export declare class LinkupSearchService {
    private apiKeys;
    private apiUrl;
    private rateLimiters;
    private activeCalls;
    constructor();
    /**
     * Refill rate limiter tokens based on elapsed time
     */
    private refillTokens;
    /**
     * Wait for available rate limit token for specific API
     */
    private waitForToken;
    /**
     * Utility delay function
     */
    private delay;
    /**
     * Get default exclude domains for higher quality results
     */
    private getDefaultExcludeDomains;
    /**
     * Build the OSINT prompt for relationship analysis
     */
    private buildOSINTPrompt;
    /**
     * Perform single Linkup API search with enhanced retry logic
     */
    private performSingleSearch;
    /**
     * Attempt a single search without retry logic
     */
    private attemptSearch;
    /**
     * Check if an error should not be retried
     */
    private isNonRetryableError;
    /**
     * Calculate retry delay with exponential backoff and jitter
     */
    private calculateRetryDelay;
    /**
     * Search for relationships between institution and multiple risk entities with true concurrent pools
     * Uses separate sequential pools per API key for predictable, stable performance
     */
    searchInstitutionRelationships(institutionName: string, institutionCountry: string, riskEntities: NROOrganization[], options?: LinkupSearchOptions, signal?: AbortSignal, onProgress?: (current: number, total: number, result?: LinkupApiResponse, apiIndex?: number) => void): Promise<LinkupApiResponse[]>;
    /**
     * Process a single pool of entities sequentially with one API key
     * This ensures predictable, stable performance without complex rate limiting
     */
    private processPool;
    /**
     * Calculate global progress across all pools
     * This ensures progress reporting reflects overall completion, not just per-pool
     */
    private calculateGlobalProgress;
    /**
     * Search for a single institution-entity relationship
     */
    searchSingleRelationship(institutionName: string, riskEntityName: string, country: string, signal?: AbortSignal): Promise<LinkupApiResponse>;
    /**
     * Test the Linkup API connection
     */
    testConnection(): Promise<boolean>;
    /**
     * Get current rate limit status for all APIs
     */
    getRateLimitStatus(): {
        apiIndex: number;
        tokens: number;
        maxTokens: number;
        refillRate: number;
    }[];
    /**
     * Cancel all active searches
     */
    cancelAllSearches(): void;
}
//# sourceMappingURL=LinkupSearchService.d.ts.map