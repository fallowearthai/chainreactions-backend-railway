import { NormalizedEntity } from '../types/DatasetMatchTypes';
export declare class EntityNormalization {
    private static readonly GENERIC_TERMS;
    private static readonly STOP_WORDS;
    private static readonly ORG_SUFFIXES;
    /**
     * Extract bracketed content and abbreviations from text
     */
    static extractBracketedContent(text: string): {
        main: string;
        bracketed: string[];
        abbreviations: string[];
    };
    /**
     * Generate abbreviation from text
     */
    static generateAbbreviation(text: string): string;
    /**
     * Normalize text for matching purposes with enhanced bracketed content handling
     */
    static normalizeText(text: string): string;
    /**
     * Create a core version of the text by removing even more organizational elements
     */
    static getCoreText(text: string): string;
    /**
     * Calculate specificity score for a term (higher = more specific)
     */
    static getSpecificityScore(text: string): number;
    /**
     * Generate comprehensive search variations from the input text
     */
    static generateSearchVariations(searchText: string): string[];
    /**
     * Normalize entity for comprehensive processing
     */
    static normalizeEntity(entityName: string): NormalizedEntity;
    /**
     * Check if matching should be skipped for very short or empty terms
     */
    static shouldSkipMatching(entityName: string): boolean;
    /**
     * Parse multiple entities from a string (handles "A, B and C" format)
     */
    static parseMultipleEntities(text: string): string[];
    /**
     * Calculate word overlap between two strings
     */
    static calculateWordOverlap(str1: string, str2: string): number;
    /**
     * Check if text contains academic or publication terms
     */
    static isAcademicTerm(text: string): boolean;
    /**
     * Extract meaningful keywords from text
     */
    static extractKeywords(text: string, minLength?: number): string[];
    /**
     * Check if two entity names are likely the same considering brackets and abbreviations
     */
    static areEntitiesEquivalent(entity1: string, entity2: string): {
        isMatch: boolean;
        confidence: number;
        matchType: string;
    };
}
//# sourceMappingURL=EntityNormalization.d.ts.map