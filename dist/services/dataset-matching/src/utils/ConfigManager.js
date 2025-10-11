"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ConfigManager {
    constructor() {
        this.matchingConfig = null;
        this.countryMappings = null;
        this.similarityWeights = null;
        this.configDir = path_1.default.join(__dirname, '../config');
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    /**
     * Load configuration from files with environment variable overrides
     */
    loadConfig(filename, envPrefix) {
        const configPath = path_1.default.join(this.configDir, filename);
        if (!fs_1.default.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        try {
            const fileContent = fs_1.default.readFileSync(configPath, 'utf-8');
            let config = JSON.parse(fileContent);
            // Apply environment variable overrides if prefix provided
            if (envPrefix) {
                config = this.applyEnvironmentOverrides(config, envPrefix);
            }
            return config;
        }
        catch (error) {
            throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
        }
    }
    /**
     * Apply environment variable overrides to configuration
     */
    applyEnvironmentOverrides(config, prefix) {
        const envVars = Object.keys(process.env)
            .filter(key => key.startsWith(prefix))
            .reduce((acc, key) => {
            const configKey = key.substring(prefix.length).toLowerCase();
            acc[configKey] = process.env[key];
            return acc;
        }, {});
        // Apply simple overrides (extend this for nested objects if needed)
        return { ...config, ...envVars };
    }
    /**
     * Get matching configuration
     */
    getMatchingConfig() {
        if (!this.matchingConfig) {
            this.matchingConfig = this.loadConfig('matching-config.json', 'MATCHING_');
        }
        return this.matchingConfig;
    }
    /**
     * Get country mappings configuration
     */
    getCountryMappings() {
        if (!this.countryMappings) {
            this.countryMappings = this.loadConfig('country-mappings.json', 'COUNTRY_');
        }
        return this.countryMappings;
    }
    /**
     * Get similarity weights configuration
     */
    getSimilarityWeights() {
        if (!this.similarityWeights) {
            this.similarityWeights = this.loadConfig('similarity-weights.json', 'SIMILARITY_');
        }
        return this.similarityWeights;
    }
    /**
     * Reload all configurations (useful for hot updates)
     */
    reloadConfigurations() {
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
    getConfigValue(configType, path, defaultValue) {
        const pathParts = path.split('.');
        let config;
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
            }
            else {
                return defaultValue;
            }
        }
        return current;
    }
    /**
     * Check if debugging is enabled
     */
    isDebuggingEnabled() {
        return this.getConfigValue('matching', 'debugging.enable_query_logging', false);
    }
    /**
     * Get cache configuration
     */
    getCacheConfig() {
        return this.getMatchingConfig().cache;
    }
    /**
     * Get similarity thresholds
     */
    getSimilarityThresholds() {
        return this.getMatchingConfig().similarity.thresholds;
    }
    /**
     * Get geographic configuration
     */
    getGeographicConfig() {
        return this.getMatchingConfig().geographic;
    }
    /**
     * Get query strategies configuration
     */
    getQueryStrategies() {
        return this.getMatchingConfig().query.strategies;
    }
    /**
     * Get timeout configurations
     */
    getTimeouts() {
        return this.getMatchingConfig().query.timeouts;
    }
    /**
     * Validate configuration integrity
     */
    validateConfigurations() {
        const errors = [];
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
        }
        catch (error) {
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
    getConfigurationSummary() {
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
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map