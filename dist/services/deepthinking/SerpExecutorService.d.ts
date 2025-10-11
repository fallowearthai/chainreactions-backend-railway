import { MetaPromptResult } from './WebSearchMetaPromptService';
import { OptimizedSerpResults } from './ResultOptimizationService';
import { SearchRequest } from '../../types/gemini';
export interface SerpExecutionResult {
    searchKeyword: string;
    engine: string;
    results: any[];
    metadata: {
        totalResults: number;
        searchTime: number;
        engine: string;
        country?: string;
        language?: string;
    };
}
export interface AggregatedSerpResults {
    allResults: SerpExecutionResult[];
    consolidatedResults: any[];
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
export declare class SerpExecutorService {
    private serpService;
    private optimizationService;
    constructor();
    executeSearchStrategy(request: SearchRequest, metaPromptResult: MetaPromptResult): Promise<AggregatedSerpResults>;
    /**
     * Execute search strategy and return optimized results
     * This is the enhanced version that includes result optimization
     */
    executeSearchStrategyOptimized(request: SearchRequest, metaPromptResult: MetaPromptResult): Promise<OptimizedSerpResults>;
    /**
     * Execute optimized search strategy with progress callbacks for SSE
     */
    executeSearchStrategyOptimizedWithProgress(request: SearchRequest, metaPromptResult: MetaPromptResult, progressCallback: (progress: string, current?: number, total?: number) => void): Promise<OptimizedSerpResults>;
    /**
     * Execute search strategy with progress callbacks
     */
    private executeSearchStrategyWithProgress;
    private generateSearchTasks;
    /**
     * Normalize search engines from Stage 1 results to available engines
     * Maps "google scholar" -> "google", "baidu scholar" -> "baidu", defaults to "google"
     */
    private normalizeSearchEngines;
    /**
     * Validate and format country codes for search engines
     * Handles complex cases like "ca,lb" and ensures valid formats
     */
    private validateAndFormatCountryCode;
    private calculateKeywordPriority;
    private executeSearchesWithConcurrency;
    private groupTasksByEngine;
    private executeEngineTasksBatch;
    private executeSingleSearchWithTimeout;
    private retryFailedTasks;
    private executeSingleSearch;
    private consolidateResults;
    /**
     * Check if a URL is an image search result that should be filtered out
     */
    private isImageSearchResult;
    getExecutionStats(results: AggregatedSerpResults): string;
    /**
     * Generate custom keyword combinations based on dual-language strategy
     * Strategy: Entity A + Entity B (bilingual) + Custom Keyword
     */
    private generateCustomKeywordCombinations;
}
//# sourceMappingURL=SerpExecutorService.d.ts.map