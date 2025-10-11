import { DatasetMatch, ServiceResponse } from '../types/DatasetMatchTypes';
export declare class DatasetMatchingService {
    private static instance;
    private supabaseService;
    private configurableMatching;
    private geographicMatching;
    private configManager;
    private countryNormalizer;
    private cache;
    private cacheExpiration;
    private constructor();
    static getInstance(): DatasetMatchingService;
    /**
     * Enhanced find dataset matches with geographic and configurable algorithms
     */
    findMatchesEnhanced(entityName: string, searchLocation?: string, context?: string, options?: {
        forceRefresh?: boolean;
        searchRadius?: 'local' | 'regional' | 'global';
        prioritizeLocal?: boolean;
        maxResults?: number;
    }): Promise<ServiceResponse<DatasetMatch[]>>;
    /**
     * Original find dataset matches method (backward compatibility)
     */
    findMatches(entityName: string, context?: string, forceRefresh?: boolean): Promise<ServiceResponse<DatasetMatch[]>>;
    /**
     * Legacy findMatches implementation
     */
    private findMatchesLegacy;
    /**
     * Find matches for multiple entities in batch with enhanced geographic support
     */
    findMatchesBatch(entities: string[], context?: string, forceRefresh?: boolean, options?: {
        location?: string;
        searchRadius?: 'local' | 'regional' | 'global';
        prioritizeLocal?: boolean;
        maxResults?: number;
    }): Promise<ServiceResponse<Record<string, DatasetMatch[]>>>;
    /**
     * Create a match candidate with quality metrics
     */
    private createMatchCandidate;
    /**
     * Remove duplicate matches based on dataset + organization name
     */
    private removeDuplicateMatches;
    /**
     * Get cached matches if available and valid
     */
    private getCachedMatches;
    /**
     * Cache matches for an entity
     */
    private cacheMatches;
    /**
     * Clean up expired cache entries
     */
    private cleanupExpiredCache;
    /**
     * Clear all cached matches
     */
    clearCache(): Promise<ServiceResponse<{
        cleared_entries: number;
    }>>;
    /**
     * Get service statistics
     */
    getServiceStats(): Promise<ServiceResponse<any>>;
    /**
     * Calculate processing time from start time
     */
    private getProcessingTime;
    /**
     * Create enhanced cache key that includes location context
     */
    private createEnhancedCacheKey;
    /**
     * Execute progressive search strategy
     */
    private executeProgressiveSearch;
    /**
     * Find exact matches using database
     */
    private findExactMatches;
    /**
     * Find high similarity matches
     */
    private findHighSimilarityMatches;
    /**
     * Find alias matches
     */
    private findAliasMatches;
    /**
     * Rank and deduplicate matches using enhanced algorithms
     */
    private rankAndDeduplicateMatches;
    /**
     * Apply geographic ranking to matches
     */
    private applyGeographicRanking;
    /**
     * Warm up cache with popular queries
     */
    warmupCache(): Promise<ServiceResponse<{
        warmed_queries: number;
        processing_time_ms: number;
    }>>;
    /**
     * Get enhanced service statistics
     */
    getEnhancedServiceStats(): Promise<ServiceResponse<any>>;
}
//# sourceMappingURL=DatasetMatchingService.d.ts.map