import { TextMatching } from './TextMatching';
import { EntityNormalization } from './EntityNormalization';
import { ConfigManager } from '../utils/ConfigManager';
import { CountryNormalizer } from '../utils/CountryNormalizer';
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

export class ConfigurableMatching {
  private static instance: ConfigurableMatching;
  private configManager: ConfigManager;
  private countryNormalizer: CountryNormalizer;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.countryNormalizer = CountryNormalizer.getInstance();
  }

  public static getInstance(): ConfigurableMatching {
    if (!ConfigurableMatching.instance) {
      ConfigurableMatching.instance = new ConfigurableMatching();
    }
    return ConfigurableMatching.instance;
  }

  /**
   * Advanced similarity calculation with configurable weights
   */
  public calculateAdvancedSimilarity(
    searchText: string,
    targetText: string,
    context?: MatchContext
  ): AdvancedSimilarityResult {
    const config = this.configManager.getSimilarityWeights();
    const thresholds = this.configManager.getSimilarityThresholds();

    // Preprocess texts
    const processedSearch = this.preprocessText(searchText);
    const processedTarget = this.preprocessText(targetText);

    // Initialize result
    const result: AdvancedSimilarityResult = {
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
      weightedScore += components.jaro_winkler * algorithms.jaro_winkler.weight;
    }
    if (components.levenshtein !== undefined) {
      weightedScore += components.levenshtein * algorithms.levenshtein.weight;
    }
    if (components.word_level !== undefined) {
      weightedScore += components.word_level * algorithms.word_level_similarity.weight;
    }
    if (components.character_ngram !== undefined) {
      weightedScore += components.character_ngram * algorithms.character_ngram.weight;
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
  private preprocessText(text: string): string {
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
      const filteredWords = words.filter(word =>
        !config.remove_common_words.includes(word.toLowerCase())
      );
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
  private checkAcronymMatch(searchText: string, targetText: string): {
    isMatch: boolean;
    confidence: number;
    explanation: string;
    boost: number;
  } {
    const config = this.configManager.getSimilarityWeights().special_patterns.acronym_detection;

    if (!config.enable) {
      return { isMatch: false, confidence: 0, explanation: '', boost: 0 };
    }

    // Try each pattern
    for (const pattern of config.parentheses_patterns) {
      const regex = new RegExp(pattern, 'i');

      // Check if target has acronym pattern
      const targetMatch = targetText.match(regex);
      if (targetMatch) {
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
      if (searchMatch) {
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
  private calculateComponentSimilarities(searchText: string, targetText: string) {
    return {
      jaro_winkler: TextMatching.jaroWinklerSimilarity(searchText, targetText),
      levenshtein: TextMatching.normalizedLevenshteinDistance(searchText, targetText),
      word_level: this.calculateWordLevelSimilarity(searchText, targetText),
      character_ngram: TextMatching.nGramSimilarity(searchText, targetText, 3)
    };
  }

  /**
   * Calculate word-level similarity
   */
  private calculateWordLevelSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate context-based boosts
   */
  private calculateContextBoosts(
    searchText: string,
    targetText: string,
    context?: MatchContext
  ) {
    const boosts: { geographic_boost?: number; context_boost?: number } = {};

    // Geographic boost
    if (context?.searchLocation && context?.entityCountries) {
      const relationship = this.countryNormalizer.calculateGeographicRelationship(
        context.searchLocation,
        context.entityCountries[0] // Use first country
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
  private calculateOrganizationTypeBoost(searchText: string, targetText: string): number {
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
  private determineMatchType(
    score: number,
    thresholds: Record<string, number>,
    components: any
  ): { type: DatasetMatch['match_type']; explanation: string } {
    if (score >= thresholds.exact_match) {
      return { type: 'exact', explanation: 'Perfect or near-perfect match' };
    }

    if (score >= thresholds.high_similarity) {
      return { type: 'fuzzy', explanation: 'High similarity across multiple algorithms' };
    }

    if (score >= thresholds.good_similarity) {
      if (components.word_level > 0.8) {
        return { type: 'word_match', explanation: 'Strong word-level similarity' };
      }
      return { type: 'fuzzy', explanation: 'Good overall similarity' };
    }

    if (score >= thresholds.moderate_similarity) {
      return { type: 'core_match', explanation: 'Moderate similarity, likely core match' };
    }

    if (score >= thresholds.low_similarity) {
      return { type: 'partial', explanation: 'Partial match detected' };
    }

    return { type: 'partial', explanation: 'Low similarity, possible partial match' };
  }

  /**
   * Batch similarity calculation for multiple targets
   */
  public calculateBatchSimilarity(
    searchText: string,
    targets: Array<{ text: string; context?: MatchContext }>,
    limit?: number
  ): AdvancedSimilarityResult[] {
    const results = targets.map(target =>
      this.calculateAdvancedSimilarity(searchText, target.text, target.context)
    );

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply early termination if configured
    const earlyTermination = this.configManager.getSimilarityWeights().performance_tuning.early_termination;
    if (earlyTermination.enable) {
      const highConfidenceIndex = results.findIndex(r => r.score >= earlyTermination.confidence_threshold);
      if (highConfidenceIndex >= 0 && highConfidenceIndex < (limit || results.length)) {
        return results.slice(0, Math.max(3, highConfidenceIndex + 1));
      }
    }

    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Get similarity explanation for debugging
   */
  public getDetailedExplanation(result: AdvancedSimilarityResult): string {
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
  public getPerformanceMetrics() {
    const config = this.configManager.getSimilarityWeights();
    const totalWeight = Object.values(config.algorithms).reduce((sum, alg) => sum + alg.weight, 0);

    return {
      algorithm_weights_sum: totalWeight,
      weights_valid: Math.abs(totalWeight - 1.0) < 0.01,
      acronym_detection_enabled: config.special_patterns.acronym_detection.enable,
      early_termination_enabled: config.performance_tuning.early_termination.enable,
      supported_countries: this.countryNormalizer.getAllSupportedCountries().length
    };
  }
}