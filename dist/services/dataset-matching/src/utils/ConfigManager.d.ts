interface MatchingConfig {
    similarity: {
        thresholds: Record<string, number>;
        weights: Record<string, number>;
        preprocessing: {
            remove_punctuation: boolean;
            normalize_whitespace: boolean;
            convert_to_lowercase: boolean;
            remove_common_words: string[];
            normalize_organization_suffixes: string[];
        };
    };
    geographic: {
        enable_location_boost: boolean;
        location_boost_factor: number;
        location_penalty_factor: number;
        enable_regional_grouping: boolean;
    };
    query: {
        strategies: Record<string, number>;
        timeouts: Record<string, number>;
        enable_progressive_search: boolean;
        minimum_results_before_next_strategy: number;
    };
    cache: {
        enable_caching: boolean;
        default_ttl_minutes: number;
        popular_queries_ttl_minutes: number;
        max_cache_entries: number;
        enable_warmup: boolean;
        warmup_queries: string[];
    };
    match_types: Record<string, {
        confidence: number;
        description: string;
    }>;
    debugging: {
        enable_query_logging: boolean;
        enable_timing_metrics: boolean;
        log_similarity_scores: boolean;
        max_debug_results: number;
    };
}
interface CountryMappings {
    mappings: Record<string, {
        canonical: string;
        iso_codes: string[];
        aliases: string[];
    }>;
    regional_groups: Record<string, string[]>;
    priority_countries: string[];
    search_preferences: {
        fuzzy_matching: boolean;
        case_insensitive: boolean;
        accent_insensitive: boolean;
        partial_matching: boolean;
    };
}
interface SimilarityWeights {
    algorithms: Record<string, {
        weight: number;
        [key: string]: any;
    }>;
    context_adjustments: {
        organization_types: Record<string, {
            boost_factor: number;
            keywords: string[];
        }>;
        geographic_boost: Record<string, number>;
        length_penalties: Record<string, {
            threshold?: number;
            ratio_threshold?: number;
            penalty: number;
            description: string;
        }>;
    };
    special_patterns: {
        acronym_detection: {
            enable: boolean;
            parentheses_patterns: string[];
            boost_factor: number;
            description: string;
        };
        abbreviation_expansion: {
            enable: boolean;
            common_abbreviations: Record<string, string>;
        };
        suffix_normalization: {
            enable: boolean;
            organization_suffixes: string[];
            weight_reduction: number;
        };
    };
    quality_filters: {
        minimum_word_overlap: number;
        maximum_length_ratio: number;
        minimum_character_overlap: number;
        filter_common_words: boolean;
        require_significant_match: boolean;
    };
    performance_tuning: {
        early_termination: {
            enable: boolean;
            confidence_threshold: number;
            description: string;
        };
        batch_processing: {
            chunk_size: number;
            parallel_processing: boolean;
            max_concurrent: number;
        };
        caching: {
            normalize_cache_keys: boolean;
            cache_negative_results: boolean;
            cache_similarity_scores: boolean;
        };
    };
}
export declare class ConfigManager {
    private static instance;
    private matchingConfig;
    private countryMappings;
    private similarityWeights;
    private configDir;
    private constructor();
    static getInstance(): ConfigManager;
    /**
     * Load configuration from files with environment variable overrides
     */
    private loadConfig;
    /**
     * Apply environment variable overrides to configuration
     */
    private applyEnvironmentOverrides;
    /**
     * Get matching configuration
     */
    getMatchingConfig(): MatchingConfig;
    /**
     * Get country mappings configuration
     */
    getCountryMappings(): CountryMappings;
    /**
     * Get similarity weights configuration
     */
    getSimilarityWeights(): SimilarityWeights;
    /**
     * Reload all configurations (useful for hot updates)
     */
    reloadConfigurations(): void;
    /**
     * Get specific configuration value with path notation
     */
    getConfigValue(configType: 'matching' | 'country' | 'similarity', path: string, defaultValue?: any): any;
    /**
     * Check if debugging is enabled
     */
    isDebuggingEnabled(): boolean;
    /**
     * Get cache configuration
     */
    getCacheConfig(): {
        enable_caching: boolean;
        default_ttl_minutes: number;
        popular_queries_ttl_minutes: number;
        max_cache_entries: number;
        enable_warmup: boolean;
        warmup_queries: string[];
    };
    /**
     * Get similarity thresholds
     */
    getSimilarityThresholds(): Record<string, number>;
    /**
     * Get geographic configuration
     */
    getGeographicConfig(): {
        enable_location_boost: boolean;
        location_boost_factor: number;
        location_penalty_factor: number;
        enable_regional_grouping: boolean;
    };
    /**
     * Get query strategies configuration
     */
    getQueryStrategies(): Record<string, number>;
    /**
     * Get timeout configurations
     */
    getTimeouts(): Record<string, number>;
    /**
     * Validate configuration integrity
     */
    validateConfigurations(): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Get configuration summary for debugging
     */
    getConfigurationSummary(): {
        matching_config_loaded: boolean;
        country_mappings_loaded: boolean;
        similarity_weights_loaded: boolean;
        validation: {
            valid: boolean;
            errors: string[];
        };
        cache_enabled: any;
        debugging_enabled: boolean;
        countries_count: number;
        algorithms_count: number;
    };
}
export {};
//# sourceMappingURL=ConfigManager.d.ts.map