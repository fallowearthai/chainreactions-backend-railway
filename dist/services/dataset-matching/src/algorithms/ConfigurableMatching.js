"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurableMatching = void 0;
const TextMatching_1 = require("./TextMatching");
const ConfigManager_1 = require("../utils/ConfigManager");
const CountryNormalizer_1 = require("../utils/CountryNormalizer");
class ConfigurableMatching {
    constructor() {
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.countryNormalizer = CountryNormalizer_1.CountryNormalizer.getInstance();
    }
    static getInstance() {
        if (!ConfigurableMatching.instance) {
            ConfigurableMatching.instance = new ConfigurableMatching();
        }
        return ConfigurableMatching.instance;
    }
    /**
     * Advanced similarity calculation with configurable weights
     */
    calculateAdvancedSimilarity(searchText, targetText, context) {
        const config = this.configManager.getSimilarityWeights();
        const thresholds = this.configManager.getSimilarityThresholds();
        // Preprocess texts
        const processedSearch = this.preprocessText(searchText);
        const processedTarget = this.preprocessText(targetText);
        // Initialize result
        const result = {
            score: 0,
            matchType: 'partial',
            explanation: '',
            components: {}
        };
        // 1. Check for exact match
        if (processedSearch === processedTarget) {
            result.score = 1.0;
            result.matchType = 'exact';
            result.explanation = 'Perfect text match';
            return result;
        }
        // 2. Check for acronym matches
        const acronymMatch = this.checkAcronymMatch(searchText, targetText);
        if (acronymMatch.isMatch) {
            result.score = acronymMatch.confidence;
            result.matchType = 'core_acronym';
            result.explanation = acronymMatch.explanation;
            result.components.acronym_boost = acronymMatch.boost;
            return result;
        }
        // 3. Calculate component similarities
        const components = this.calculateComponentSimilarities(processedSearch, processedTarget);
        result.components = { ...result.components, ...components };
        // 4. Calculate weighted score
        let weightedScore = 0;
        const algorithms = config.algorithms;
        if (components.jaro_winkler !== undefined) {
            weightedScore += components.jaro_winkler * (algorithms.jaro_winkler?.weight || 0.4);
        }
        if (components.levenshtein !== undefined) {
            weightedScore += components.levenshtein * (algorithms.levenshtein?.weight || 0.3);
        }
        if (components.word_level !== undefined) {
            weightedScore += components.word_level * (algorithms.word_level_similarity?.weight || 0.2);
        }
        if (components.character_ngram !== undefined) {
            weightedScore += components.character_ngram * (algorithms.character_ngram?.weight || 0.1);
        }
        // 5. Apply context boosts
        const contextBoosts = this.calculateContextBoosts(searchText, targetText, context);
        result.components = { ...result.components, ...contextBoosts };
        // Apply boosts to final score
        if (contextBoosts.geographic_boost) {
            weightedScore *= contextBoosts.geographic_boost;
        }
        if (contextBoosts.context_boost) {
            weightedScore *= contextBoosts.context_boost;
        }
        result.score = Math.min(1.0, weightedScore);
        // 6. Determine match type and explanation
        const matchTypeResult = this.determineMatchType(result.score, thresholds, components);
        result.matchType = matchTypeResult.type;
        result.explanation = matchTypeResult.explanation;
        return result;
    }
    /**
     * Preprocess text according to configuration
     */
    preprocessText(text) {
        const config = this.configManager.getMatchingConfig().similarity.preprocessing;
        let processed = text;
        if (config.convert_to_lowercase) {
            processed = processed.toLowerCase();
        }
        if (config.remove_punctuation) {
            processed = processed.replace(/[^\w\s]/g, ' ');
        }
        if (config.normalize_whitespace) {
            processed = processed.replace(/\s+/g, ' ').trim();
        }
        // Remove common words
        if (config.remove_common_words && config.remove_common_words.length > 0) {
            const words = processed.split(' ');
            const filteredWords = words.filter(word => !config.remove_common_words.includes(word.toLowerCase()));
            processed = filteredWords.join(' ');
        }
        // Normalize organization suffixes
        if (config.normalize_organization_suffixes) {
            for (const suffix of config.normalize_organization_suffixes) {
                const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
                processed = processed.replace(regex, '').trim();
            }
        }
        return processed;
    }
    /**
     * Check for acronym matches (e.g., "Physics Research Center" vs "Physics Research Center (PRC)")
     */
    checkAcronymMatch(searchText, targetText) {
        const config = this.configManager.getSimilarityWeights().special_patterns.acronym_detection;
        if (!config.enable) {
            return { isMatch: false, confidence: 0, explanation: '', boost: 0 };
        }
        // Try each pattern
        for (const pattern of config.parentheses_patterns) {
            const regex = new RegExp(pattern, 'i');
            // Check if target has acronym pattern
            const targetMatch = targetText.match(regex);
            if (targetMatch && targetMatch[1] && targetMatch[2]) {
                const fullName = targetMatch[1].trim();
                const acronym = targetMatch[2].trim();
                // Check if search matches either full name or acronym
                const searchNormalized = this.preprocessText(searchText);
                const fullNameNormalized = this.preprocessText(fullName);
                const acronymNormalized = acronym.toLowerCase();
                if (searchNormalized === fullNameNormalized ||
                    searchNormalized === acronymNormalized) {
                    return {
                        isMatch: true,
                        confidence: config.boost_factor * 0.95,
                        explanation: `Acronym match: "${fullName}" with "${acronym}"`,
                        boost: config.boost_factor
                    };
                }
            }
            // Check if search has acronym pattern
            const searchMatch = searchText.match(regex);
            if (searchMatch && searchMatch[1] && searchMatch[2]) {
                const fullName = searchMatch[1].trim();
                const acronym = searchMatch[2].trim();
                const targetNormalized = this.preprocessText(targetText);
                const fullNameNormalized = this.preprocessText(fullName);
                if (targetNormalized === fullNameNormalized) {
                    return {
                        isMatch: true,
                        confidence: config.boost_factor * 0.95,
                        explanation: `Reverse acronym match: "${fullName}" with "${acronym}"`,
                        boost: config.boost_factor
                    };
                }
            }
        }
        return { isMatch: false, confidence: 0, explanation: '', boost: 0 };
    }
    /**
     * Calculate individual algorithm similarities
     */
    calculateComponentSimilarities(searchText, targetText) {
        return {
            jaro_winkler: TextMatching_1.TextMatching.jaroWinklerSimilarity(searchText, targetText),
            levenshtein: TextMatching_1.TextMatching.normalizedLevenshteinDistance(searchText, targetText),
            word_level: this.calculateWordLevelSimilarity(searchText, targetText),
            character_ngram: TextMatching_1.TextMatching.nGramSimilarity(searchText, targetText, 3)
        };
    }
    /**
     * Calculate word-level similarity
     */
    calculateWordLevelSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    /**
     * Calculate context-based boosts
     */
    calculateContextBoosts(searchText, targetText, context) {
        const boosts = {};
        // Geographic boost
        if (context?.searchLocation && context?.entityCountries && context.entityCountries[0]) {
            const relationship = this.countryNormalizer.calculateGeographicRelationship(context.searchLocation, context.entityCountries[0] // Use first country
            );
            boosts.geographic_boost = relationship.boost_factor;
        }
        // Context boost (organization type)
        const contextBoost = this.calculateOrganizationTypeBoost(searchText, targetText);
        if (contextBoost > 1.0) {
            boosts.context_boost = contextBoost;
        }
        return boosts;
    }
    /**
     * Calculate organization type boost
     */
    calculateOrganizationTypeBoost(searchText, targetText) {
        const config = this.configManager.getSimilarityWeights().context_adjustments.organization_types;
        const combinedText = `${searchText} ${targetText}`.toLowerCase();
        let maxBoost = 1.0;
        for (const [type, typeConfig] of Object.entries(config)) {
            for (const keyword of typeConfig.keywords) {
                if (combinedText.includes(keyword.toLowerCase())) {
                    maxBoost = Math.max(maxBoost, typeConfig.boost_factor);
                }
            }
        }
        return maxBoost;
    }
    /**
     * Determine match type based on score and components
     */
    determineMatchType(score, thresholds, components) {
        // Safe access with defaults
        const exactMatchThreshold = thresholds.exact_match || 0.95;
        const highSimilarityThreshold = thresholds.high_similarity || 0.85;
        const goodSimilarityThreshold = thresholds.good_similarity || 0.75;
        const moderateSimilarityThreshold = thresholds.moderate_similarity || 0.65;
        const lowSimilarityThreshold = thresholds.low_similarity || 0.55;
        if (score >= exactMatchThreshold) {
            return { type: 'exact', explanation: 'Perfect or near-perfect match' };
        }
        if (score >= highSimilarityThreshold) {
            return { type: 'fuzzy', explanation: 'High similarity across multiple algorithms' };
        }
        if (score >= goodSimilarityThreshold) {
            if (components.word_level > 0.8) {
                return { type: 'word_match', explanation: 'Strong word-level similarity' };
            }
            return { type: 'fuzzy', explanation: 'Good overall similarity' };
        }
        if (score >= moderateSimilarityThreshold) {
            return { type: 'core_match', explanation: 'Moderate similarity, likely core match' };
        }
        if (score >= lowSimilarityThreshold) {
            return { type: 'partial', explanation: 'Partial match detected' };
        }
        return { type: 'partial', explanation: 'Low similarity, possible partial match' };
    }
    /**
     * Batch similarity calculation for multiple targets
     */
    calculateBatchSimilarity(searchText, targets, limit) {
        const results = targets.map(target => this.calculateAdvancedSimilarity(searchText, target.text, target.context));
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        // Apply early termination if configured
        const performanceTuning = this.configManager.getSimilarityWeights().performance_tuning;
        const earlyTermination = performanceTuning?.early_termination;
        if (earlyTermination?.enable) {
            const confidenceThreshold = earlyTermination.confidence_threshold || 0.9;
            const highConfidenceIndex = results.findIndex(r => r.score >= confidenceThreshold);
            if (highConfidenceIndex >= 0 && highConfidenceIndex < (limit || results.length)) {
                return results.slice(0, Math.max(3, highConfidenceIndex + 1));
            }
        }
        return limit ? results.slice(0, limit) : results;
    }
    /**
     * Get similarity explanation for debugging
     */
    getDetailedExplanation(result) {
        let explanation = `Match Type: ${result.matchType} (Score: ${result.score.toFixed(3)})\n`;
        explanation += `Explanation: ${result.explanation}\n\n`;
        explanation += 'Component Scores:\n';
        for (const [component, score] of Object.entries(result.components)) {
            if (score !== undefined) {
                explanation += `  ${component}: ${score.toFixed(3)}\n`;
            }
        }
        return explanation;
    }
    /**
     * Validate configuration and return performance metrics
     */
    getPerformanceMetrics() {
        const config = this.configManager.getSimilarityWeights();
        const algorithms = config.algorithms || {};
        const totalWeight = Object.values(algorithms).reduce((sum, alg) => sum + (alg?.weight || 0), 0);
        return {
            algorithm_weights_sum: totalWeight,
            weights_valid: Math.abs(totalWeight - 1.0) < 0.01,
            acronym_detection_enabled: config.special_patterns?.acronym_detection?.enable || false,
            early_termination_enabled: config.performance_tuning?.early_termination?.enable || false,
            supported_countries: this.countryNormalizer.getAllSupportedCountries().length
        };
    }
}
exports.ConfigurableMatching = ConfigurableMatching;
//# sourceMappingURL=ConfigurableMatching.js.map