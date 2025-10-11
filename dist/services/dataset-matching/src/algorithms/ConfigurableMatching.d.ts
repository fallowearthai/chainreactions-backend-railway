import { DatasetMatch } from '../types/DatasetMatchTypes';
interface AdvancedSimilarityResult {
    score: number;
    matchType: DatasetMatch['match_type'];
    explanation: string;
    components: {
        jaro_winkler?: number;
        levenshtein?: number;
        word_level?: number;
        character_ngram?: number;
        acronym_boost?: number;
        geographic_boost?: number;
        context_boost?: number;
    };
}
interface MatchContext {
    searchLocation?: string;
    entityCountries?: string[];
    searchContext?: string;
}
export declare class ConfigurableMatching {
    private static instance;
    private configManager;
    private countryNormalizer;
    private constructor();
    static getInstance(): ConfigurableMatching;
    /**
     * Advanced similarity calculation with configurable weights
     */
    calculateAdvancedSimilarity(searchText: string, targetText: string, context?: MatchContext): AdvancedSimilarityResult;
    /**
     * Preprocess text according to configuration
     */
    private preprocessText;
    /**
     * Check for acronym matches (e.g., "Physics Research Center" vs "Physics Research Center (PRC)")
     */
    private checkAcronymMatch;
    /**
     * Calculate individual algorithm similarities
     */
    private calculateComponentSimilarities;
    /**
     * Calculate word-level similarity
     */
    private calculateWordLevelSimilarity;
    /**
     * Calculate context-based boosts
     */
    private calculateContextBoosts;
    /**
     * Calculate organization type boost
     */
    private calculateOrganizationTypeBoost;
    /**
     * Determine match type based on score and components
     */
    private determineMatchType;
    /**
     * Batch similarity calculation for multiple targets
     */
    calculateBatchSimilarity(searchText: string, targets: Array<{
        text: string;
        context?: MatchContext;
    }>, limit?: number): AdvancedSimilarityResult[];
    /**
     * Get similarity explanation for debugging
     */
    getDetailedExplanation(result: AdvancedSimilarityResult): string;
    /**
     * Validate configuration and return performance metrics
     */
    getPerformanceMetrics(): {
        algorithm_weights_sum: number;
        weights_valid: boolean;
        acronym_detection_enabled: boolean;
        early_termination_enabled: boolean;
        supported_countries: number;
    };
}
export {};
//# sourceMappingURL=ConfigurableMatching.d.ts.map