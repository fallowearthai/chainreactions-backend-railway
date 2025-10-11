"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryNormalizer = void 0;
const ConfigManager_1 = require("./ConfigManager");
class CountryNormalizer {
    constructor() {
        this.countryCache = new Map();
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
    }
    static getInstance() {
        if (!CountryNormalizer.instance) {
            CountryNormalizer.instance = new CountryNormalizer();
        }
        return CountryNormalizer.instance;
    }
    /**
     * Normalize a country input to its canonical form
     */
    normalizeCountry(input) {
        if (!input || typeof input !== 'string') {
            return null;
        }
        const normalizedInput = this.normalizeString(input);
        // Check cache first
        const cached = this.countryCache.get(normalizedInput);
        if (cached) {
            return cached;
        }
        const mappings = this.configManager.getCountryMappings().mappings;
        let bestMatch = null;
        let bestScore = 0;
        for (const [canonical, config] of Object.entries(mappings)) {
            const match = this.matchCountry(normalizedInput, canonical, config);
            if (match && match.confidence > bestScore) {
                bestMatch = match;
                bestScore = match.confidence;
            }
        }
        // Cache the result
        if (bestMatch) {
            this.countryCache.set(normalizedInput, bestMatch);
        }
        return bestMatch;
    }
    /**
     * Match input against a specific country configuration
     */
    matchCountry(input, canonical, config) {
        const normalizedCanonical = this.normalizeString(canonical);
        // Exact match with canonical name
        if (input === normalizedCanonical) {
            return {
                canonical,
                confidence: 1.0,
                matchType: 'exact',
                originalInput: input
            };
        }
        // ISO code match
        for (const isoCode of config.iso_codes) {
            if (input === isoCode.toLowerCase()) {
                return {
                    canonical,
                    confidence: 0.95,
                    matchType: 'iso_code',
                    originalInput: input
                };
            }
        }
        // Alias match
        for (const alias of config.aliases) {
            const normalizedAlias = this.normalizeString(alias);
            if (input === normalizedAlias) {
                return {
                    canonical,
                    confidence: 0.9,
                    matchType: 'alias',
                    originalInput: input
                };
            }
        }
        // Fuzzy match with aliases and canonical
        const allVariants = [canonical, ...config.aliases];
        for (const variant of allVariants) {
            const normalizedVariant = this.normalizeString(variant);
            const similarity = this.calculateStringSimilarity(input, normalizedVariant);
            if (similarity > 0.8) {
                return {
                    canonical,
                    confidence: similarity * 0.8, // Reduce confidence for fuzzy matches
                    matchType: 'fuzzy',
                    originalInput: input
                };
            }
        }
        return null;
    }
    /**
     * Normalize country names in an array
     */
    normalizeCountryArray(countries) {
        if (!Array.isArray(countries)) {
            return [];
        }
        return countries
            .map(country => this.normalizeCountry(country))
            .filter(match => match !== null)
            .map(match => match.canonical);
    }
    /**
     * Check if two countries are the same (with normalization)
     */
    areCountriesSame(country1, country2) {
        const normalized1 = this.normalizeCountry(country1);
        const normalized2 = this.normalizeCountry(country2);
        if (!normalized1 || !normalized2) {
            return false;
        }
        return normalized1.canonical === normalized2.canonical;
    }
    /**
     * Get all countries in the same region
     */
    getRegionalCountries(country) {
        const normalized = this.normalizeCountry(country);
        if (!normalized) {
            return [];
        }
        const regionalGroups = this.configManager.getCountryMappings().regional_groups;
        for (const [region, countries] of Object.entries(regionalGroups)) {
            if (countries.includes(normalized.canonical)) {
                return countries;
            }
        }
        return [normalized.canonical];
    }
    /**
     * Calculate geographic relationship between countries
     */
    calculateGeographicRelationship(country1, country2) {
        const weights = this.configManager.getSimilarityWeights().context_adjustments.geographic_boost;
        const normalized1 = this.normalizeCountry(country1);
        const normalized2 = this.normalizeCountry(country2);
        if (!normalized1 || !normalized2) {
            return { relationship: 'different', boost_factor: weights.different_region || 0.9 };
        }
        // Same country
        if (normalized1.canonical === normalized2.canonical) {
            return { relationship: 'same', boost_factor: weights.same_country || 1.2 };
        }
        // Check if in same region
        const regional1 = this.getRegionalCountries(country1);
        if (regional1.includes(normalized2.canonical)) {
            return { relationship: 'regional', boost_factor: weights.same_region || 1.1 };
        }
        return { relationship: 'different', boost_factor: weights.different_region || 0.9 };
    }
    /**
     * Get country suggestions for partial input
     */
    getCountrySuggestions(input, limit = 5) {
        if (!input || input.length < 2) {
            return [];
        }
        const normalizedInput = this.normalizeString(input);
        const mappings = this.configManager.getCountryMappings().mappings;
        const suggestions = [];
        for (const [canonical, config] of Object.entries(mappings)) {
            const match = this.matchCountry(normalizedInput, canonical, config);
            if (match) {
                suggestions.push(match);
            }
            else {
                // Check for partial matches
                const allVariants = [canonical, ...config.iso_codes, ...config.aliases];
                for (const variant of allVariants) {
                    const normalizedVariant = this.normalizeString(variant);
                    if (normalizedVariant.includes(normalizedInput) || normalizedInput.includes(normalizedVariant)) {
                        suggestions.push({
                            canonical,
                            confidence: 0.6,
                            matchType: 'fuzzy',
                            originalInput: input
                        });
                        break;
                    }
                }
            }
        }
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }
    /**
     * Check if a country is in the priority list
     */
    isPriorityCountry(country) {
        const normalized = this.normalizeCountry(country);
        if (!normalized) {
            return false;
        }
        const priorityCountries = this.configManager.getCountryMappings().priority_countries;
        return priorityCountries.includes(normalized.canonical);
    }
    /**
     * Get all supported countries
     */
    getAllSupportedCountries() {
        const mappings = this.configManager.getCountryMappings().mappings;
        return Object.keys(mappings).sort();
    }
    /**
     * Normalize string for comparison
     */
    normalizeString(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    /**
     * Calculate string similarity using simple algorithm
     */
    calculateStringSimilarity(str1, str2) {
        if (str1 === str2)
            return 1.0;
        if (!str1 || !str2)
            return 0.0;
        const maxLength = Math.max(str1.length, str2.length);
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLength);
    }
    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, // insertion
                matrix[j - 1][i] + 1, // deletion
                matrix[j - 1][i - 1] + substitutionCost // substitution
                );
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * Clear the country cache
     */
    clearCache() {
        this.countryCache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cache_size: this.countryCache.size,
            supported_countries: this.getAllSupportedCountries().length,
            priority_countries: this.configManager.getCountryMappings().priority_countries.length,
            regional_groups: Object.keys(this.configManager.getCountryMappings().regional_groups).length
        };
    }
}
exports.CountryNormalizer = CountryNormalizer;
//# sourceMappingURL=CountryNormalizer.js.map