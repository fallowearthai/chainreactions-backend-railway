import { EntityNormalization } from './EntityNormalization';
import { TextMatching } from './TextMatching';
import {
  DatasetMatch,
  QualityMetrics,
  MatchingConfig
} from '../types/DatasetMatchTypes';

export class QualityAssessment {
  // Quality assessment thresholds for different match types
  private static readonly QUALITY_THRESHOLDS: Record<string, number> = {
    exact: 0.3,
    alias: 0.4,
    alias_partial: 0.5,
    core_match: 0.5,
    fuzzy: 0.5,
    partial: 0.6
  };

  // Algorithm weights for quality calculation
  private static readonly ALGORITHM_WEIGHTS = {
    specificity: 0.35,
    length_ratio: 0.15,
    word_coverage: 0.25,
    match_coverage: 0.25
  };

  // Context relevance weights (when context is provided)
  private static readonly CONTEXT_WEIGHTS = {
    specificity: 0.3,
    length_ratio: 0.1,
    word_coverage: 0.2,
    match_coverage: 0.2,
    context_relevance: 0.2
  };

  /**
   * Calculate comprehensive quality metrics for a match
   */
  static calculateQualityMetrics(
    searchEntity: string,
    matchedEntity: string,
    matchType: DatasetMatch['match_type'],
    context?: string
  ): QualityMetrics {
    const specificityScore = EntityNormalization.getSpecificityScore(searchEntity);
    const lengthRatio = TextMatching.calculateLengthRatio(searchEntity, matchedEntity);
    const wordCountRatio = TextMatching.calculateWordCountRatio(searchEntity, matchedEntity);
    const matchCoverage = TextMatching.calculateMatchCoverage(searchEntity, matchedEntity, matchType);

    let contextRelevance: number | undefined;
    if (context) {
      contextRelevance = this.calculateContextRelevance(searchEntity, matchedEntity, context);
    }

    return {
      specificity_score: specificityScore,
      length_ratio: lengthRatio,
      word_count_ratio: wordCountRatio,
      match_coverage: matchCoverage,
      context_relevance: contextRelevance
    };
  }

  /**
   * Calculate overall match quality based on metrics and match type
   */
  static calculateMatchQuality(
    searchEntity: string,
    matchedEntity: string,
    matchType: DatasetMatch['match_type'],
    context?: string
  ): number {
    if (!searchEntity || !matchedEntity) return 0;

    const metrics = this.calculateQualityMetrics(searchEntity, matchedEntity, matchType, context);

    // Choose weights based on whether context is available
    const weights = context ? this.CONTEXT_WEIGHTS : this.ALGORITHM_WEIGHTS;

    // Calculate weighted quality score
    let quality = 0;

    quality += metrics.specificity_score * weights.specificity;
    quality += metrics.length_ratio * weights.length_ratio;
    quality += metrics.word_count_ratio * weights.word_coverage;
    quality += metrics.match_coverage * weights.match_coverage;

    if (context && metrics.context_relevance !== undefined && 'context_relevance' in weights) {
      quality += metrics.context_relevance * (weights as any).context_relevance;
    }

    // Apply match type specific adjustments
    quality = this.applyMatchTypeAdjustments(quality, matchType, metrics);

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Apply match type specific adjustments to quality score
   */
  private static applyMatchTypeAdjustments(
    baseQuality: number,
    matchType: DatasetMatch['match_type'],
    metrics: QualityMetrics
  ): number {
    let adjustedQuality = baseQuality;

    switch (matchType) {
      case 'exact':
        // Boost for exact matches, but penalize if very low specificity
        adjustedQuality = metrics.specificity_score < 0.3 ? baseQuality * 0.8 : baseQuality * 1.1;
        break;

      case 'alias':
        // Moderate boost for alias matches
        adjustedQuality = baseQuality * 1.05;
        break;

      case 'alias_partial':
      case 'core_match':
        // Slight penalty for partial matches
        adjustedQuality = baseQuality * 0.95;
        break;

      case 'fuzzy':
        // Penalty for fuzzy matches, more severe if poor coverage
        const fuzzyPenalty = metrics.match_coverage < 0.7 ? 0.8 : 0.9;
        adjustedQuality = baseQuality * fuzzyPenalty;
        break;

      case 'partial':
        // Significant penalty for partial matches
        const partialPenalty = metrics.match_coverage < 0.5 ? 0.6 : 0.75;
        adjustedQuality = baseQuality * partialPenalty;
        break;

      default:
        adjustedQuality = baseQuality * 0.7;
    }

    return adjustedQuality;
  }

  /**
   * Calculate context relevance if context is provided
   */
  private static calculateContextRelevance(
    searchEntity: string,
    matchedEntity: string,
    context: string
  ): number {
    if (!context) return 0.5; // Neutral score if no context

    const contextKeywords = EntityNormalization.extractKeywords(context, 3);
    const entityKeywords = EntityNormalization.extractKeywords(matchedEntity, 3);
    const searchKeywords = EntityNormalization.extractKeywords(searchEntity, 3);

    // Calculate keyword overlap between context and entities
    const contextEntityOverlap = this.calculateKeywordOverlap(contextKeywords, entityKeywords);
    const contextSearchOverlap = this.calculateKeywordOverlap(contextKeywords, searchKeywords);

    // Combine the overlaps with more weight on entity-context relationship
    return (contextEntityOverlap * 0.7 + contextSearchOverlap * 0.3);
  }

  /**
   * Calculate overlap between two sets of keywords
   */
  private static calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));

    const intersection = new Set([...set1].filter(k => set2.has(k)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if a match passes quality threshold for its type
   */
  static passesQualityThreshold(
    searchEntity: string,
    matchedEntity: string,
    matchType: DatasetMatch['match_type'],
    context?: string
  ): boolean {
    const quality = this.calculateMatchQuality(searchEntity, matchedEntity, matchType, context);
    const threshold = this.QUALITY_THRESHOLDS[matchType] || 0.5;

    return quality >= threshold;
  }

  /**
   * Check for geographic false positives
   */
  static isLikelyGeographicFalsePositive(
    match: DatasetMatch,
    originalEntity: string
  ): boolean {
    const quality = this.calculateMatchQuality(originalEntity, match.organization_name, match.match_type);
    const specificityScore = EntityNormalization.getSpecificityScore(originalEntity);

    // If the original entity has very low specificity and low quality match, it's likely a false positive
    if (specificityScore < 0.3 && quality < 0.4) {
      return true;
    }

    // Additional check for very generic terms matching with geographic entities
    const genericGeographicTerms = ['china', 'usa', 'america', 'europe', 'asia', 'africa'];
    const normalizedOriginal = originalEntity.toLowerCase();
    const normalizedMatch = match.organization_name.toLowerCase();

    if (genericGeographicTerms.some(term =>
      normalizedOriginal.includes(term) || normalizedMatch.includes(term)
    )) {
      // If both contain geographic terms but quality is low, likely false positive
      return quality < 0.5;
    }

    return false;
  }

  /**
   * Filter match results using quality assessment
   */
  static filterMatchResults(
    matches: DatasetMatch[],
    originalEntity: string,
    context?: string
  ): DatasetMatch[] {
    return matches
      .map(match => {
        // Calculate quality metrics for each match
        const qualityMetrics = this.calculateQualityMetrics(
          originalEntity,
          match.organization_name,
          match.match_type,
          context
        );

        const quality = this.calculateMatchQuality(
          originalEntity,
          match.organization_name,
          match.match_type,
          context
        );

        return {
          ...match,
          confidence_score: quality,
          quality_metrics: qualityMetrics
        };
      })
      .filter(match => {
        // Apply quality threshold filtering
        if (!this.passesQualityThreshold(originalEntity, match.organization_name, match.match_type, context)) {
          return false;
        }

        // Filter out geographic false positives
        if (this.isLikelyGeographicFalsePositive(match, originalEntity)) {
          return false;
        }

        // For partial matches, require at least 50% word overlap
        if (match.match_type === 'partial' || match.match_type === 'fuzzy') {
          const overlap = EntityNormalization.calculateWordOverlap(match.organization_name, originalEntity);
          if (overlap < 0.5) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by match type priority first, then by confidence score
        const priorityA = this.getMatchTypePriority(a.match_type);
        const priorityB = this.getMatchTypePriority(b.match_type);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // If same priority, sort by confidence score (descending)
        return (b.confidence_score || 0) - (a.confidence_score || 0);
      });
  }

  /**
   * Get match type priority (lower number = higher priority)
   */
  private static getMatchTypePriority(matchType: DatasetMatch['match_type']): number {
    const priorities: Record<string, number> = {
      exact: 1,
      alias: 2,
      alias_partial: 3,
      core_match: 4,
      core_acronym: 3.5,
      word_match: 4.5,
      fuzzy: 5,
      partial: 6
    };
    return priorities[matchType] || 7;
  }

  /**
   * Calculate academic term filtering
   */
  static shouldFilterAcademicTerm(
    entity: string,
    matches: DatasetMatch[],
    maxResults: number = 20
  ): boolean {
    // Check if it's an academic term
    if (!EntityNormalization.isAcademicTerm(entity)) {
      return false;
    }

    // If we have too many results for an academic term, filter to high-confidence only
    if (matches.length > maxResults) {
      return true;
    }

    // Check if the entity is too generic for academic context
    const normalizedEntity = EntityNormalization.normalizeText(entity);
    const words = normalizedEntity.split(/\s+/);

    // Very generic academic terms should be filtered more aggressively
    if (words.length <= 2 && matches.length > 5) {
      return true;
    }

    return false;
  }

  /**
   * Apply academic filtering to results
   */
  static applyAcademicFiltering(
    entity: string,
    matches: DatasetMatch[]
  ): DatasetMatch[] {
    if (!this.shouldFilterAcademicTerm(entity, matches)) {
      return matches;
    }

    // For academic terms with many results, only return high-confidence matches
    return matches.filter(match =>
      match.match_type === 'exact' ||
      match.match_type === 'alias' ||
      (match.confidence_score && match.confidence_score > 0.7)
    );
  }

  /**
   * Get quality assessment summary for debugging/monitoring
   */
  static getQualityAssessmentSummary(
    searchEntity: string,
    matches: DatasetMatch[],
    context?: string
  ): any {
    const originalCount = matches.length;
    const filteredMatches = this.filterMatchResults(matches, searchEntity, context);
    const filteredCount = filteredMatches.length;

    const qualityScores = filteredMatches.map(m => m.confidence_score || 0);
    const avgQuality = qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    const matchTypeDistribution = filteredMatches.reduce((acc, match) => {
      acc[match.match_type] = (acc[match.match_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      original_count: originalCount,
      filtered_count: filteredCount,
      filter_ratio: originalCount > 0 ? filteredCount / originalCount : 0,
      average_quality: avgQuality,
      match_type_distribution: matchTypeDistribution,
      specificity_score: EntityNormalization.getSpecificityScore(searchEntity),
      has_context: !!context
    };
  }
}