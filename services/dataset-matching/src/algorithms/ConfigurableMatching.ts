import { TextMatching } from './TextMatching';
import { EntityNormalization } from './EntityNormalization';
import { ConfigManager } from '../utils/ConfigManager';
import { CountryNormalizer } from '../utils/CountryNormalizer';
import { DatasetMatch, EnhancedDatasetMatch } from '../types/DatasetMatchTypes';

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
    quick_similarity?: number;
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
   * Advanced similarity calculation with configurable weights and early termination
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

    // Early termination: Check for exact match (fast path)
    if (processedSearch === processedTarget) {
      result.score = 1.0;
      result.matchType = 'exact';
      result.explanation = 'Perfect text match';
      return result;
    }

    // Early termination: Check for very high similarity with length comparison
    const lengthRatio = Math.min(processedSearch.length, processedTarget.length) /
                      Math.max(processedSearch.length, processedTarget.length);

    if (lengthRatio > 0.9) {
      // Quick similarity check for very similar strings
      const quickSimilarity = this.quickSimilarityCheck(processedSearch, processedTarget);
      if (quickSimilarity > 0.95) {
        result.score = quickSimilarity;
        result.matchType = 'fuzzy';
        result.explanation = 'High similarity (early termination)';
        result.components.quick_similarity = quickSimilarity;
        return result;
      }
    }

    // Check for acronym matches
    const acronymMatch = this.checkAcronymMatch(searchText, targetText);
    if (acronymMatch.isMatch) {
      result.score = acronymMatch.confidence;
      result.matchType = 'core_acronym';
      result.explanation = acronymMatch.explanation;
      result.components.acronym_boost = acronymMatch.boost;
      return result;
    }

    // Early termination: Check minimum similarity threshold
    const earlyTerminationConfig = config.performance_tuning?.early_termination;
    if (earlyTerminationConfig?.enable) {
      const minSimilarityThreshold = earlyTerminationConfig.confidence_threshold || 0.9;

      // Quick check using most efficient algorithm first
      const quickJaroWinkler = TextMatching.jaroWinklerSimilarity(processedSearch, processedTarget);
      if (quickJaroWinkler < minSimilarityThreshold * 0.5) {
        // Early termination - similarity too low
        result.score = quickJaroWinkler;
        result.matchType = 'partial';
        result.explanation = 'Low similarity (early termination)';
        result.components.jaro_winkler = quickJaroWinkler;
        return result;
      }
    }

    // Calculate component similarities (only if passed early termination)
    const components = this.calculateComponentSimilarities(processedSearch, processedTarget);
    result.components = { ...result.components, ...components };

    // Calculate weighted score
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

    // Apply context boosts
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

    // Determine match type and explanation
    const matchTypeResult = this.determineMatchType(result.score, thresholds, components);
    result.matchType = matchTypeResult.type;
    result.explanation = matchTypeResult.explanation;

    return result;
  }

  /**
   * Quick similarity check for early termination
   */
  private quickSimilarityCheck(str1: string, str2: string): number {
    // Simple character-based similarity for quick comparison
    const matches = Array.from(str1).filter((char, index) => index < str2.length && char === str2[index]).length;
    const maxLength = Math.max(str1.length, str2.length);
    return matches / maxLength;
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
    if (context?.searchLocation && context?.entityCountries && context.entityCountries[0]) {
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

  /**
   * Enhanced similarity calculation for affiliated companies with boost factor
   */
  public calculateAffiliatedSimilarity(
    searchText: string,
    targetText: string,
    affiliatedContext: {
      risk_keyword: string;
      relationship_type: string;
      relationship_strength?: number;
      boost_factor?: number;
    },
    context?: MatchContext
  ): AdvancedSimilarityResult & { affiliated_boost?: number } {
    // Get base similarity result
    const baseResult = this.calculateAdvancedSimilarity(searchText, targetText, context);

    // Calculate relationship strength based on relationship type
    const relationshipStrength = this.calculateRelationshipStrength(
      affiliatedContext.relationship_type,
      affiliatedContext.relationship_strength
    );

    // Apply affiliated company boost
    const boostFactor = affiliatedContext.boost_factor || 1.15;
    const affiliatedBoost = 1.0 + (boostFactor - 1.0) * relationshipStrength;

    const finalScore = Math.min(1.0, baseResult.score * affiliatedBoost);

    return {
      ...baseResult,
      score: finalScore,
      affiliated_boost: affiliatedBoost,
      explanation: `${baseResult.explanation} (Affiliated Company Boost: ${affiliatedBoost.toFixed(2)}x)`
    };
  }

  /**
   * Convert DatasetMatch to EnhancedDatasetMatch with affiliated context
   */
  public enhanceMatchWithAffiliatedContext(
    match: DatasetMatch,
    affiliatedContext: {
      company_name: string;
      risk_keyword: string;
      relationship_type: string;
      relationship_strength?: number;
      boost_applied?: number;
    }
  ): EnhancedDatasetMatch {
    const relationshipStrength = this.calculateRelationshipStrength(
      affiliatedContext.relationship_type,
      affiliatedContext.relationship_strength
    );

    return {
      ...match,
      relationship_source: 'affiliated_company',
      relationship_strength: relationshipStrength,
      source_risk_keyword: affiliatedContext.risk_keyword,
      boost_applied: affiliatedContext.boost_applied || 1.15,
      // Apply boost to confidence score
      confidence_score: match.confidence_score
        ? Math.min(1.0, match.confidence_score * (affiliatedContext.boost_applied || 1.15))
        : undefined
    };
  }

  /**
   * Calculate relationship strength based on relationship type and base strength
   */
  private calculateRelationshipStrength(
    relationshipType: string,
    baseStrength?: number
  ): number {
    // If base strength is provided, use it
    if (baseStrength !== undefined && baseStrength >= 0.0 && baseStrength <= 1.0) {
      return baseStrength;
    }

    // Calculate strength based on relationship type
    switch (relationshipType.toLowerCase()) {
      case 'direct':
        return 1.0;
      case 'indirect':
        return 0.8;
      case 'significant mention':
        return 0.6;
      case 'unknown':
        return 0.4;
      default:
        return 0.5;
    }
  }

  /**
   * Batch process affiliated companies for optimal performance
   */
  public processBatchAffiliatedMatches(
    baseEntity: string,
    affiliatedCompanies: Array<{
      company_name: string;
      risk_keyword: string;
      relationship_type: string;
      confidence_score?: number;
    }>,
    context?: MatchContext,
    options?: {
      maxResults?: number;
      affiliatedBoost?: number;
      minConfidence?: number;
    }
  ): Array<{
    company_name: string;
    risk_keyword: string;
    relationship_type: string;
    similarity_result: AdvancedSimilarityResult & { affiliated_boost?: number };
  }> {
    const opts = { maxResults: 20, affiliatedBoost: 1.15, minConfidence: 0.3, ...options };

    return affiliatedCompanies
      .map(affiliated => ({
        company_name: affiliated.company_name,
        risk_keyword: affiliated.risk_keyword,
        relationship_type: affiliated.relationship_type,
        similarity_result: this.calculateAffiliatedSimilarity(
          baseEntity,
          affiliated.company_name,
          {
            risk_keyword: affiliated.risk_keyword,
            relationship_type: affiliated.relationship_type,
            boost_factor: opts.affiliatedBoost
          },
          context
        )
      }))
      .filter(result => result.similarity_result.score >= opts.minConfidence!)
      .sort((a, b) => b.similarity_result.score - a.similarity_result.score)
      .slice(0, opts.maxResults);
  }
}