import { AggregatedSerpResults } from './SerpExecutorService';
import { MetaPromptResult } from './WebSearchMetaPromptService';
export interface OptimizedSearchResult {
    title: string;
    url: string;
    snippet: string;
    engine: string;
    relevanceScore: number;
    searchKeywords: string[];
}
export interface OptimizedSerpResults {
    success: boolean;
    stage: number;
    optimizationMetadata: {
        originalResults: number;
        deduplicatedResults: number;
        compressionRatio: number;
        processingTime: number;
        filtersApplied: string[];
    };
    consolidatedResults: OptimizedSearchResult[];
    executionSummary: {
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        totalResults: number;
        enginesUsed: string[];
        executionTime: number;
        performanceMetrics?: {
            averageResponseTime: number;
            engineSuccessRates: Record<string, number>;
            retrySuccessCount: number;
        };
    };
}
export declare class ResultOptimizationService {
    /**
     * Main optimization method that removes duplicates, filters invalid results,
     * and compresses the data structure
     */
    optimizeResults(serpResults: AggregatedSerpResults, metaPromptResult: MetaPromptResult): OptimizedSerpResults;
    /**
     * Extract all search results from the nested structure
     */
    private extractAllResults;
    /**
     * Remove duplicate results based on URL normalization
     */
    private deduplicateByUrl;
    /**
     * Normalize URLs for better deduplication
     */
    private normalizeUrl;
    /**
     * Filter out only truly invalid results (minimal filtering)
     */
    private filterInvalidResults;
    /**
     * Check if a URL is an image search result that should be filtered out
     */
    private isImageSearchResult;
    /**
     * Calculate relevance scores based on multiple factors
     */
    private calculateRelevanceScores;
    /**
     * Sort by relevance score and limit to top N results
     */
    private sortAndLimitResults;
    /**
     * Extract target keywords dynamically from entity information
     * Replaces hardcoded keywords for better generalization
     */
    private extractTargetKeywords;
    /**
     * Get optimization statistics
     */
    getOptimizationStats(original: AggregatedSerpResults, optimized: OptimizedSerpResults): string;
}
//# sourceMappingURL=ResultOptimizationService.d.ts.map