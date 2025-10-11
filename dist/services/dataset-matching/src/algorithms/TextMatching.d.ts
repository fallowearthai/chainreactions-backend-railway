import { DatasetMatch } from '../types/DatasetMatchTypes';
export declare class TextMatching {
    static jaroWinklerSimilarity(s1: string, s2: string): number;
    private static jaroSimilarity;
    /**
     * Calculate normalized Levenshtein distance (0-1 scale)
     */
    static normalizedLevenshteinDistance(s1: string, s2: string): number;
    /**
     * N-gram similarity calculation
     */
    static nGramSimilarity(s1: string, s2: string, n?: number): number;
    private static generateNGrams;
    /**
     * Calculate length ratio between two strings
     */
    static calculateLengthRatio(str1: string, str2: string): number;
    /**
     * Calculate word count ratio between two strings
     */
    static calculateWordCountRatio(str1: string, str2: string): number;
    /**
     * Determine match type based on comparison between search term and entity
     */
    static determineMatchType(searchTerm: string, entityName: string, aliases?: string[]): DatasetMatch['match_type'];
    /**
     * Calculate match confidence based on multiple similarity metrics
     */
    static calculateMatchConfidence(searchTerm: string, entityName: string, matchType: DatasetMatch['match_type'], aliases?: string[]): number;
    /**
     * Calculate how much one string contains the other
     */
    private static calculateContainmentScore;
    /**
     * Calculate match coverage (how much of the matched term is covered by the search term)
     */
    static calculateMatchCoverage(searchTerm: string, matchedTerm: string, matchType: DatasetMatch['match_type']): number;
    /**
     * Check if two entities are likely the same despite different representations
     */
    static areEntitiesEquivalent(entity1: string, entity2: string, threshold?: number): boolean;
}
//# sourceMappingURL=TextMatching.d.ts.map