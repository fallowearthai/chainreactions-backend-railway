import { NormalizedEntity } from '../types/DatasetMatchTypes';

export class EntityNormalization {
  // Common generic terms that indicate low specificity
  private static readonly GENERIC_TERMS = new Set([
    'company', 'corporation', 'corp', 'inc', 'ltd', 'llc', 'group', 'international',
    'global', 'development', 'management', 'systems', 'services', 'name', 'co',
    'china', 'chinese', 'america', 'american', 'usa', 'us', 'canada', 'canadian',
    'japan', 'japanese', 'europe', 'european', 'asia', 'asian',
    'africa', 'african', 'india', 'indian', 'germany', 'german',
    'france', 'french', 'uk', 'britain', 'british', 'italy', 'italian',
    'spain', 'spanish', 'russia', 'russian', 'iran', 'korea', 'korean',
    'australia', 'australian', 'brazil', 'brazilian', 'mexico', 'mexican',
    'university', 'college', 'institute', 'research', 'center', 'centre',
    'technology', 'science', 'engineering', 'medical', 'hospital',
    'school', 'academy', 'laboratory', 'lab', 'faculty', 'department',
    'military', 'government', 'agency', 'organization', 'organisation', 'association',
    'limited', 'public', 'private', 'holdings', 'enterprises'
  ]);

  // Stop words to ignore in processing
  private static readonly STOP_WORDS = new Set([
    'the', 'of', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
  ]);

  // Organizational suffixes and prefixes that can be removed for core matching
  private static readonly ORG_SUFFIXES = new Set([
    'university of', 'institute of', 'center for', 'centre for', 'the',
    'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 'co', 'limited',
    'group', 'holdings', 'enterprises', 'international', 'global'
  ]);

  /**
   * Normalize text for matching purposes
   */
  static normalizeText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      .trim()
      // Remove parentheses and their contents completely
      .replace(/\s*\([^)]*\)/g, '')
      // Remove common organizational suffixes/prefixes
      .replace(/\b(university of|institute of|center for|centre for|the|inc|ltd|llc|corp|corporation|company|co|limited)\b/g, '')
      // Remove special characters and normalize spacing
      .replace(/[^\w\s]/g, ' ')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Create a core version of the text by removing even more organizational elements
   */
  static getCoreText(text: string): string {
    let core = this.normalizeText(text);

    // Remove more organizational terms for core matching
    const orgPattern = Array.from(this.ORG_SUFFIXES).join('|');
    const regex = new RegExp(`\\b(${orgPattern})\\b`, 'gi');

    core = core
      .replace(regex, '')
      .replace(/\s+/g, ' ')
      .trim();

    return core;
  }

  /**
   * Calculate specificity score for a term (higher = more specific)
   */
  static getSpecificityScore(text: string): number {
    if (!text) return 0;

    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(word => word.length > 0);

    if (words.length === 0) return 0;

    // Base score from word count (more words = more specific)
    let score = Math.min(words.length * 0.2, 1.0);

    // Penalty for generic terms
    const genericWordCount = words.filter(word => this.GENERIC_TERMS.has(word)).length;
    const genericPenalty = (genericWordCount / words.length) * 0.7;
    score -= genericPenalty;

    // Bonus for longer terms
    const lengthBonus = Math.min(normalized.length / 50, 0.3);
    score += lengthBonus;

    // Bonus for having numbers or special formatting indicators
    if (/\d/.test(normalized) || /[.-]/.test(normalized)) {
      score += 0.1;
    }

    // Penalty for very short terms
    if (normalized.length < 5) {
      score *= 0.5;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate search variations from the input text
   */
  static generateSearchVariations(searchText: string): string[] {
    const variations = new Set<string>();

    // Add original text
    variations.add(searchText);

    // Add normalized version
    const normalized = this.normalizeText(searchText);
    if (normalized !== searchText.toLowerCase()) {
      variations.add(normalized);
    }

    // Add core version
    const core = this.getCoreText(searchText);
    if (core && core !== normalized) {
      variations.add(core);
    }

    // Add acronym variations if the text contains multiple words
    const words = searchText.trim().split(/\s+/);
    if (words.length > 1 && words.length <= 6) { // Reasonable limit for acronyms
      const acronym = words
        .map(word => word.charAt(0).toUpperCase())
        .join('');

      if (acronym.length > 1) {
        variations.add(acronym);
        variations.add(acronym.toLowerCase());
      }
    }

    // Add variations without common organizational terms
    const withoutOrg = searchText
      .replace(/\b(inc|ltd|llc|corp|corporation|company|co|limited|group)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (withoutOrg && withoutOrg !== searchText) {
      variations.add(withoutOrg);
    }

    // Remove empty strings and duplicates
    return Array.from(variations).filter(v => v && v.trim().length > 0);
  }

  /**
   * Normalize entity for comprehensive processing
   */
  static normalizeEntity(entityName: string): NormalizedEntity {
    const original = entityName.trim();
    const normalized = this.normalizeText(original);
    const variations = this.generateSearchVariations(original);
    const specificityScore = this.getSpecificityScore(original);

    return {
      original,
      normalized,
      variations,
      specificity_score: specificityScore
    };
  }

  /**
   * Check if matching should be skipped for very short or empty terms
   */
  static shouldSkipMatching(entityName: string): boolean {
    if (!entityName) return true;

    const normalized = entityName.toLowerCase().trim();

    // Skip if too short
    if (normalized.length < 2) return true;

    // Skip if it's only generic terms
    const words = normalized.split(/\s+/);
    const nonGenericWords = words.filter(word =>
      !this.GENERIC_TERMS.has(word) &&
      !this.STOP_WORDS.has(word) &&
      word.length > 1
    );

    if (nonGenericWords.length === 0) return true;

    return false;
  }

  /**
   * Parse multiple entities from a string (handles "A, B and C" format)
   */
  static parseMultipleEntities(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Handle numbered lists first (1. Item, 2. Item)
    if (/^\d+\.\s/.test(text.trim())) {
      return text
        .split(/\d+\.\s/)
        .map(item => item.trim())
        .filter(item => item.length > 0 && item.toLowerCase() !== 'none');
    }

    // Handle comma and "and" separated lists
    const entities = text
      // Split by comma, semicolon, or newline
      .split(/[,;\n]+/)
      // Further split by "and" but preserve meaningful phrases
      .flatMap(part => {
        // Don't split on "and" if it's part of a company name
        if (/\b(research and development|oil and gas|arts and sciences)\b/i.test(part)) {
          return [part.trim()];
        }
        return part.split(/\s+and\s+/i);
      })
      // Clean up each entity
      .map(entity => entity.trim())
      // Remove empty strings and generic terms
      .filter(entity => {
        if (!entity || entity.length < 2) return false;
        if (entity.toLowerCase() === 'none') return false;
        if (entity.toLowerCase() === 'no evidence found') return false;

        // Skip if it's just a number or single character
        if (/^\d+$/.test(entity) || entity.length === 1) return false;

        return true;
      })
      // Remove duplicates (case-insensitive)
      .filter((entity, index, array) => {
        const normalized = entity.toLowerCase();
        return array.findIndex(e => e.toLowerCase() === normalized) === index;
      });

    return entities;
  }

  /**
   * Calculate word overlap between two strings
   */
  static calculateWordOverlap(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const words1 = str1.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.STOP_WORDS.has(word));

    const words2 = str2.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.STOP_WORDS.has(word));

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if text contains academic or publication terms
   */
  static isAcademicTerm(text: string): boolean {
    const academicTerms = [
      'journal', 'conference', 'proceedings', 'review', 'publication',
      'article', 'paper', 'symposium', 'workshop', 'seminar', 'congress'
    ];

    const normalizedText = text.toLowerCase();
    return academicTerms.some(term => normalizedText.includes(term));
  }

  /**
   * Extract meaningful keywords from text
   */
  static extractKeywords(text: string, minLength: number = 3): string[] {
    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/);

    return words
      .filter(word =>
        word.length >= minLength &&
        !this.STOP_WORDS.has(word) &&
        !this.GENERIC_TERMS.has(word)
      )
      .filter((word, index, array) => array.indexOf(word) === index) // Remove duplicates
      .sort((a, b) => b.length - a.length); // Sort by length, longer first
  }
}