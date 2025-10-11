import { DatasetMatch, QualityMetrics } from '../types/DatasetMatchTypes';
export declare class QualityAssessment {
    private static readonly QUALITY_THRESHOLDS;
    private static readonly ALGORITHM_WEIGHTS;
    private static readonly CONTEXT_WEIGHTS;
    /**
     * Calculate comprehensive quality metrics for a match
     */
    static calculateQualityMetrics(searchEntity: string, matchedEntity: string, matchType: DatasetMatch['match_type'], context?: string): QualityMetrics;
    /**
     * Calculate overall match quality based on metrics and match type
     */
    static calculateMatchQuality(searchEntity: string, matchedEntity: string, matchType: DatasetMatch['match_type'], context?: string): number;
    /**
     * Apply match type specific adjustments to quality score
     */
    private static applyMatchTypeAdjustments;
    /**
     * Calculate context relevance if context is provided
     */
    private static calculateContextRelevance;
    /**
     * Calculate overlap between two sets of keywords
     */
    private static calculateKeywordOverlap;
    /**
     * Check if a match passes quality threshold for its type
     */
    static passesQualityThreshold(searchEntity: string, matchedEntity: string, matchType: DatasetMatch['match_type'], context?: string): boolean;
    /**
     * Check for geographic false positives
     */
    static isLikelyGeographicFalsePositive(match: DatasetMatch, originalEntity: string): boolean;
    /**
     * Filter match results using quality assessment
     */
    static filterMatchResults(matches: DatasetMatch[], originalEntity: string, context?: string): DatasetMatch[];
    /**
     * Get match type priority (lower number = higher priority)
     */
    private static getMatchTypePriority;
    /**
     * Calculate academic term filtering
     */
    static shouldFilterAcademicTerm(entity: string, matches: DatasetMatch[], maxResults?: number): boolean;
    /**
     * Apply academic filtering to results
     */
    static applyAcademicFiltering(entity: string, matches: DatasetMatch[]): DatasetMatch[];
    /**
     * Get quality assessment summary for debugging/monitoring
     */
    static getQualityAssessmentSummary(searchEntity: string, matches: DatasetMatch[], context?: string): any;
}
//# sourceMappingURL=QualityAssessment.d.ts.map