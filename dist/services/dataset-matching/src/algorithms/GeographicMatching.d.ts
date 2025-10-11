interface GeographicContext {
    searchLocation?: string;
    entityCountries?: string[];
    searchRadius?: 'local' | 'regional' | 'global';
    prioritizeLocal?: boolean;
}
interface GeographicScore {
    relevance_score: number;
    boost_factor: number;
    relationship: 'same_country' | 'same_region' | 'different_region' | 'unknown';
    matched_countries: string[];
    explanation: string;
}
export declare class GeographicMatching {
    private static instance;
    private countryNormalizer;
    private configManager;
    private constructor();
    static getInstance(): GeographicMatching;
    /**
     * Calculate geographic relevance score
     */
    calculateGeographicScore(context: GeographicContext): GeographicScore;
    /**
     * Calculate relationship between search country and entity countries
     */
    private calculateCountryRelationship;
    /**
     * Apply search radius modifiers
     */
    private applySearchRadiusModifier;
    /**
     * Filter and rank entities by geographic relevance
     */
    filterByGeographicRelevance<T extends {
        countries?: string[];
    }>(entities: T[], context: GeographicContext, minRelevanceScore?: number): Array<T & {
        geographic_score: GeographicScore;
    }>;
    /**
     * Get geographic suggestions for a location
     */
    getGeographicSuggestions(location: string, entityCountries: string[]): {
        suggested_countries: string[];
        regional_alternatives: string[];
        explanation: string;
    };
    /**
     * Calculate geographic diversity score for a set of results
     */
    calculateDiversityScore(results: Array<{
        countries?: string[];
    }>): {
        diversity_score: number;
        unique_countries: number;
        unique_regions: number;
        geographic_distribution: Record<string, number>;
    };
    /**
     * Apply geographic deduplication to results
     */
    applyGeographicDeduplication<T extends {
        organization_name: string;
        countries?: string[];
    }>(results: T[], maxPerCountry?: number): T[];
    /**
     * Get geographic matching statistics
     */
    getGeographicStats(): {
        supported_countries: number;
        priority_countries: number;
        regional_groups: number;
        geographic_boost_enabled: boolean;
        cache_stats: {
            cache_size: number;
            supported_countries: number;
            priority_countries: number;
            regional_groups: number;
        };
    };
}
export {};
//# sourceMappingURL=GeographicMatching.d.ts.map