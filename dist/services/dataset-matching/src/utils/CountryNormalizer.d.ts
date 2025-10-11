interface CountryMatch {
    canonical: string;
    confidence: number;
    matchType: 'exact' | 'iso_code' | 'alias' | 'fuzzy';
    originalInput: string;
}
export declare class CountryNormalizer {
    private static instance;
    private configManager;
    private countryCache;
    private constructor();
    static getInstance(): CountryNormalizer;
    /**
     * Normalize a country input to its canonical form
     */
    normalizeCountry(input: string): CountryMatch | null;
    /**
     * Match input against a specific country configuration
     */
    private matchCountry;
    /**
     * Normalize country names in an array
     */
    normalizeCountryArray(countries: string[]): string[];
    /**
     * Check if two countries are the same (with normalization)
     */
    areCountriesSame(country1: string, country2: string): boolean;
    /**
     * Get all countries in the same region
     */
    getRegionalCountries(country: string): string[];
    /**
     * Calculate geographic relationship between countries
     */
    calculateGeographicRelationship(country1: string, country2: string): {
        relationship: 'same' | 'regional' | 'different';
        boost_factor: number;
    };
    /**
     * Get country suggestions for partial input
     */
    getCountrySuggestions(input: string, limit?: number): CountryMatch[];
    /**
     * Check if a country is in the priority list
     */
    isPriorityCountry(country: string): boolean;
    /**
     * Get all supported countries
     */
    getAllSupportedCountries(): string[];
    /**
     * Normalize string for comparison
     */
    private normalizeString;
    /**
     * Calculate string similarity using simple algorithm
     */
    private calculateStringSimilarity;
    /**
     * Calculate Levenshtein distance
     */
    private levenshteinDistance;
    /**
     * Clear the country cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        cache_size: number;
        supported_countries: number;
        priority_countries: number;
        regional_groups: number;
    };
}
export {};
//# sourceMappingURL=CountryNormalizer.d.ts.map