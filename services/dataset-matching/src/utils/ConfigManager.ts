import fs from 'fs';
import path from 'path';

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
  match_types: Record<string, { confidence: number; description: string }>;
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

export class ConfigManager {
  private static instance: ConfigManager;
  private matchingConfig: MatchingConfig | null = null;
  private countryMappings: CountryMappings | null = null;
  private similarityWeights: SimilarityWeights | null = null;
  private configDir: string;

  private constructor() {
    this.configDir = path.join(__dirname, '../config');
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from files with environment variable overrides
   */
  private loadConfig<T>(filename: string, envPrefix?: string): T {
    const configPath = path.join(this.configDir, filename);

    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️  Warning: Configuration file not found: ${configPath}`);
      console.warn(`   Using default configuration for ${filename}`);
      console.warn(`   Please check your deployment - config files should be in: ${this.configDir}`);

      // Return default configuration instead of throwing error
      return this.getDefaultConfig<T>(filename);
    }

    try {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      let config = JSON.parse(fileContent) as T;

      // Apply environment variable overrides if prefix provided
      if (envPrefix) {
        config = this.applyEnvironmentOverrides(config, envPrefix);
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
    }
  }

  /**
   * Apply environment variable overrides to configuration
   */
  private applyEnvironmentOverrides<T>(config: T, prefix: string): T {
    const envVars = Object.keys(process.env)
      .filter(key => key.startsWith(prefix))
      .reduce((acc, key) => {
        const configKey = key.substring(prefix.length).toLowerCase();
        acc[configKey] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>);

    // Apply simple overrides (extend this for nested objects if needed)
    return { ...config, ...envVars };
  }

  /**
   * Get matching configuration
   */
  public getMatchingConfig(): MatchingConfig {
    if (!this.matchingConfig) {
      this.matchingConfig = this.loadConfig<MatchingConfig>('matching-config.json', 'MATCHING_');
    }
    return this.matchingConfig;
  }

  /**
   * Get country mappings configuration
   */
  public getCountryMappings(): CountryMappings {
    if (!this.countryMappings) {
      this.countryMappings = this.loadConfig<CountryMappings>('country-mappings.json', 'COUNTRY_');
    }
    return this.countryMappings;
  }

  /**
   * Get similarity weights configuration
   */
  public getSimilarityWeights(): SimilarityWeights {
    if (!this.similarityWeights) {
      this.similarityWeights = this.loadConfig<SimilarityWeights>('similarity-weights.json', 'SIMILARITY_');
    }
    return this.similarityWeights;
  }

  /**
   * Reload all configurations (useful for hot updates)
   */
  public reloadConfigurations(): void {
    this.matchingConfig = null;
    this.countryMappings = null;
    this.similarityWeights = null;

    // Pre-load all configurations
    this.getMatchingConfig();
    this.getCountryMappings();
    this.getSimilarityWeights();
  }

  /**
   * Get specific configuration value with path notation
   */
  public getConfigValue(configType: 'matching' | 'country' | 'similarity', path: string, defaultValue?: any): any {
    const pathParts = path.split('.');
    let config: any;

    switch (configType) {
      case 'matching':
        config = this.getMatchingConfig();
        break;
      case 'country':
        config = this.getCountryMappings();
        break;
      case 'similarity':
        config = this.getSimilarityWeights();
        break;
      default:
        throw new Error(`Unknown configuration type: ${configType}`);
    }

    let current = config;
    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Check if debugging is enabled
   */
  public isDebuggingEnabled(): boolean {
    return this.getConfigValue('matching', 'debugging.enable_query_logging', false);
  }

  /**
   * Get cache configuration
   */
  public getCacheConfig() {
    return this.getMatchingConfig().cache;
  }

  /**
   * Get similarity thresholds
   */
  public getSimilarityThresholds() {
    return this.getMatchingConfig().similarity.thresholds;
  }

  /**
   * Get geographic configuration
   */
  public getGeographicConfig() {
    return this.getMatchingConfig().geographic;
  }

  /**
   * Get query strategies configuration
   */
  public getQueryStrategies() {
    return this.getMatchingConfig().query.strategies;
  }

  /**
   * Get timeout configurations
   */
  public getTimeouts() {
    return this.getMatchingConfig().query.timeouts;
  }

  /**
   * Validate configuration integrity
   */
  public validateConfigurations(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate matching config
      const matching = this.getMatchingConfig();
      if (!matching.similarity || !matching.geographic || !matching.query) {
        errors.push('Missing required sections in matching configuration');
      }

      // Validate country mappings
      const countries = this.getCountryMappings();
      if (!countries.mappings || Object.keys(countries.mappings).length === 0) {
        errors.push('Country mappings are empty or invalid');
      }

      // Validate similarity weights
      const weights = this.getSimilarityWeights();
      if (!weights.algorithms || Object.keys(weights.algorithms).length === 0) {
        errors.push('Similarity algorithms configuration is empty or invalid');
      }

      // Validate weight totals
      const totalWeight = Object.values(weights.algorithms).reduce((sum, alg) => sum + alg.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        errors.push(`Algorithm weights should sum to 1.0, got ${totalWeight}`);
      }

    } catch (error) {
      errors.push(`Configuration validation error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration summary for debugging
   */
  public getConfigurationSummary() {
    const validation = this.validateConfigurations();

    return {
      matching_config_loaded: !!this.matchingConfig,
      country_mappings_loaded: !!this.countryMappings,
      similarity_weights_loaded: !!this.similarityWeights,
      validation: validation,
      cache_enabled: this.getConfigValue('matching', 'cache.enable_caching', false),
      debugging_enabled: this.isDebuggingEnabled(),
      countries_count: Object.keys(this.getCountryMappings().mappings).length,
      algorithms_count: Object.keys(this.getSimilarityWeights().algorithms).length
    };
  }

  /**
   * Get default configuration when files are missing
   */
  private getDefaultConfig<T>(filename: string): T {
    switch (filename) {
      case 'matching-config.json':
        return this.getDefaultMatchingConfig() as T;
      case 'country-mappings.json':
        return this.getDefaultCountryMappings() as T;
      case 'similarity-weights.json':
        return this.getDefaultSimilarityWeights() as T;
      default:
        console.warn(`No default configuration available for ${filename}, returning empty object`);
        return {} as T;
    }
  }

  /**
   * Default matching configuration
   */
  private getDefaultMatchingConfig(): MatchingConfig {
    return {
      similarity: {
        thresholds: {
          exact_match: 1.0,
          high_similarity: 0.95,
          good_similarity: 0.85,
          moderate_similarity: 0.75,
          low_similarity: 0.6,
          minimum_match: 0.3
        },
        weights: {
          jaro_winkler: 0.4,
          levenshtein: 0.3,
          word_level: 0.2,
          character_ngram: 0.1
        },
        preprocessing: {
          remove_punctuation: true,
          normalize_whitespace: true,
          convert_to_lowercase: true,
          remove_common_words: ["the", "of", "and", "for", "in", "at", "to", "a", "an"],
          normalize_organization_suffixes: ["inc", "ltd", "llc", "corp", "corporation", "company", "co", "institute", "university", "research", "center", "centre"]
        }
      },
      geographic: {
        enable_location_boost: true,
        location_boost_factor: 1.2,
        location_penalty_factor: 0.8,
        enable_regional_grouping: true
      },
      query: {
        strategies: {
          exact_match_limit: 10,
          fuzzy_match_limit: 20,
          alias_match_limit: 30,
          full_text_limit: 50
        },
        timeouts: {
          exact_match_ms: 100,
          fuzzy_match_ms: 300,
          alias_match_ms: 500,
          full_text_ms: 1000
        },
        enable_progressive_search: true,
        minimum_results_before_next_strategy: 3
      },
      cache: {
        enable_caching: true,
        default_ttl_minutes: 5,
        popular_queries_ttl_minutes: 30,
        max_cache_entries: 1000,
        enable_warmup: true,
        warmup_queries: [
          "university", "institute", "research", "center", "academy",
          "medical", "military", "aerospace", "technology", "laboratory"
        ]
      },
      match_types: {
        exact: { confidence: 1.0, description: "Perfect string match" },
        core_acronym: { confidence: 0.95, description: "Core name matches with acronym in parentheses" },
        alias: { confidence: 0.95, description: "Exact match with known alias" },
        fuzzy: { confidence: 0.85, description: "High similarity match using multiple algorithms" },
        word_match: { confidence: 0.8, description: "Strong word-level similarity" },
        core_match: { confidence: 0.75, description: "Core organization name matches" },
        alias_partial: { confidence: 0.7, description: "Partial match with alias" },
        partial: { confidence: 0.6, description: "Substring or containment match" }
      },
      debugging: {
        enable_query_logging: true,
        enable_timing_metrics: true,
        log_similarity_scores: false,
        max_debug_results: 100
      }
    };
  }

  /**
   * Default country mappings
   */
  private getDefaultCountryMappings(): CountryMappings {
    return {
      mappings: {},
      regional_groups: {},
      priority_countries: ["United States", "China", "Russia", "United Kingdom", "France"],
      search_preferences: {
        fuzzy_matching: true,
        case_insensitive: true,
        accent_insensitive: true,
        partial_matching: true
      }
    };
  }

  /**
   * Default similarity weights
   */
  private getDefaultSimilarityWeights(): SimilarityWeights {
    return {
      algorithms: {
        jaro_winkler: { weight: 0.4, description: "Jaro-Winkler distance" },
        levenshtein: { weight: 0.3, description: "Levenshtein distance" },
        word_level: { weight: 0.2, description: "Word-level similarity" },
        character_ngram: { weight: 0.1, description: "Character n-gram similarity" }
      },
      context_adjustments: {
        organization_types: {
          academic: { boost_factor: 1.1, keywords: ["university", "institute", "college", "academy"] },
          corporate: { boost_factor: 1.0, keywords: ["company", "corporation", "inc", "ltd"] },
          government: { boost_factor: 1.05, keywords: ["agency", "department", "bureau", "office"] }
        }
      },
      special_patterns: {
        acronym_detection: {
          enable: true,
          parentheses_patterns: ["(\\w+)", "[\\w\\s-]+"],
          boost_factor: 1.1,
          description: "Detect acronyms in parentheses"
        },
        abbreviation_expansion: {
          enable: true,
          common_abbreviations: {
            "MIT": "Massachusetts Institute of Technology",
            "NASA": "National Aeronautics and Space Administration",
            "CIA": "Central Intelligence Agency"
          }
        },
        suffix_normalization: {
          enable: true,
          organization_suffixes: ["inc", "ltd", "llc", "corp", "corporation", "company", "co", "institute", "university", "research", "center", "centre"],
          weight_reduction: 0.05
        }
      },
      confidence_calculation: {
        base_thresholds: {
          exact: 1.0,
          very_high: 0.95,
          high: 0.85,
          moderate: 0.75,
          low: 0.6,
          minimal: 0.3
        },
        context_boosts: {
          location_match: 0.1,
          field_relevance: 0.05,
          name_frequency: -0.05
        },
        penalty_factors: {
          partial_match: 0.8,
          case_mismatch: 0.95,
          word_order_difference: 0.9
        }
      }
    };
  }
}