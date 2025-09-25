import { distance as levenshteinDistance } from 'fastest-levenshtein';
import { EntityNormalization } from './EntityNormalization';
import { DatasetMatch } from '../types/DatasetMatchTypes';

export class TextMatching {
  // Jaro-Winkler similarity implementation
  static jaroWinklerSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    // Calculate Jaro similarity
    const jaro = this.jaroSimilarity(s1, s2);

    // If Jaro similarity is below threshold, return as is
    if (jaro < 0.7) return jaro;

    // Calculate common prefix length (max 4)
    let prefixLength = 0;
    const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));

    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    // Jaro-Winkler = Jaro + (0.1 * prefixLength * (1 - Jaro))
    return jaro + (0.1 * prefixLength * (1 - jaro));
  }

  private static jaroSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const len1 = s1.length;
    const len2 = s2.length;

    // Calculate match window
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchWindow < 0) return 0.0;

    // Initialize arrays
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Find transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  }

  /**
   * Calculate normalized Levenshtein distance (0-1 scale)
   */
  static normalizedLevenshteinDistance(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1.0;

    const distance = levenshteinDistance(s1, s2);
    return 1 - (distance / maxLength);
  }

  /**
   * N-gram similarity calculation
   */
  static nGramSimilarity(s1: string, s2: string, n: number = 2): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const ngrams1 = this.generateNGrams(s1, n);
    const ngrams2 = this.generateNGrams(s2, n);

    if (ngrams1.size === 0 || ngrams2.size === 0) return 0.0;

    const intersection = new Set([...ngrams1].filter(gram => ngrams2.has(gram)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  private static generateNGrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');

    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Calculate length ratio between two strings
   */
  static calculateLengthRatio(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const len1 = str1.length;
    const len2 = str2.length;
    return Math.min(len1, len2) / Math.max(len1, len2);
  }

  /**
   * Calculate word count ratio between two strings
   */
  static calculateWordCountRatio(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const words1 = str1.trim().split(/\s+/).length;
    const words2 = str2.trim().split(/\s+/).length;
    return Math.min(words1, words2) / Math.max(words1, words2);
  }

  /**
   * Determine match type based on comparison between search term and entity
   */
  static determineMatchType(
    searchTerm: string,
    entityName: string,
    aliases: string[] = []
  ): DatasetMatch['match_type'] {
    const normalizedSearch = EntityNormalization.normalizeText(searchTerm);
    const normalizedEntity = EntityNormalization.normalizeText(entityName);

    // Exact match
    if (normalizedSearch === normalizedEntity ||
        searchTerm.toLowerCase() === entityName.toLowerCase()) {
      return 'exact';
    }

    // Alias match
    if (aliases && aliases.length > 0) {
      const normalizedAliases = aliases.map(alias => EntityNormalization.normalizeText(alias));

      // Exact alias match
      if (normalizedAliases.includes(normalizedSearch)) {
        return 'alias';
      }

      // Partial alias match
      if (normalizedAliases.some(alias =>
        alias.includes(normalizedSearch) || normalizedSearch.includes(alias)
      )) {
        return 'alias_partial';
      }
    }

    // Core match (without organizational suffixes)
    const coreSearch = EntityNormalization.getCoreText(searchTerm);
    const coreEntity = EntityNormalization.getCoreText(entityName);

    if (coreSearch && coreEntity && coreSearch === coreEntity) {
      return 'core_match';
    }

    // Fuzzy match using multiple algorithms
    const jaroWinkler = this.jaroWinklerSimilarity(normalizedSearch, normalizedEntity);
    const levenshtein = this.normalizedLevenshteinDistance(normalizedSearch, normalizedEntity);
    const ngram = this.nGramSimilarity(normalizedSearch, normalizedEntity, 2);

    // High similarity indicates fuzzy match
    if (jaroWinkler > 0.8 || levenshtein > 0.8 || ngram > 0.7) {
      return 'fuzzy';
    }

    // Partial match (substring)
    if (normalizedEntity.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedEntity)) {
      return 'partial';
    }

    // If no clear match type, default to partial for any similarity
    if (jaroWinkler > 0.3 || levenshtein > 0.3 || ngram > 0.3) {
      return 'partial';
    }

    // This shouldn't happen in normal flow, but just in case
    return 'partial';
  }

  /**
   * Calculate match confidence based on multiple similarity metrics
   */
  static calculateMatchConfidence(
    searchTerm: string,
    entityName: string,
    matchType: DatasetMatch['match_type'],
    aliases: string[] = []
  ): number {
    const normalizedSearch = EntityNormalization.normalizeText(searchTerm);
    const normalizedEntity = EntityNormalization.normalizeText(entityName);

    switch (matchType) {
      case 'exact':
        return 1.0;

      case 'alias':
        // Check how well the search term matches the best alias
        if (aliases && aliases.length > 0) {
          const bestAliasMatch = Math.max(
            ...aliases.map(alias => {
              const normalizedAlias = EntityNormalization.normalizeText(alias);
              return this.jaroWinklerSimilarity(normalizedSearch, normalizedAlias);
            })
          );
          return Math.min(0.95, bestAliasMatch);
        }
        return 0.9;

      case 'alias_partial':
        return 0.8;

      case 'core_match':
        const coreSearch = EntityNormalization.getCoreText(searchTerm);
        const coreEntity = EntityNormalization.getCoreText(entityName);
        return this.jaroWinklerSimilarity(coreSearch, coreEntity) * 0.85;

      case 'fuzzy':
        // Use weighted combination of similarity metrics
        const jaroWinkler = this.jaroWinklerSimilarity(normalizedSearch, normalizedEntity);
        const levenshtein = this.normalizedLevenshteinDistance(normalizedSearch, normalizedEntity);
        const ngram = this.nGramSimilarity(normalizedSearch, normalizedEntity);

        // Weighted average: Jaro-Winkler is best for names
        return (jaroWinkler * 0.5 + levenshtein * 0.3 + ngram * 0.2) * 0.8;

      case 'partial':
        // Lower confidence for partial matches
        const wordOverlap = EntityNormalization.calculateWordOverlap(searchTerm, entityName);
        const containmentScore = this.calculateContainmentScore(normalizedSearch, normalizedEntity);

        return Math.max(wordOverlap, containmentScore) * 0.6;

      default:
        return 0.3;
    }
  }

  /**
   * Calculate how much one string contains the other
   */
  private static calculateContainmentScore(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length <= str2.length ? str1 : str2;

    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    return 0;
  }

  /**
   * Calculate match coverage (how much of the matched term is covered by the search term)
   */
  static calculateMatchCoverage(
    searchTerm: string,
    matchedTerm: string,
    matchType: DatasetMatch['match_type']
  ): number {
    if (!searchTerm || !matchedTerm) return 0;

    const normalizedSearch = EntityNormalization.normalizeText(searchTerm);
    const normalizedMatch = EntityNormalization.normalizeText(matchedTerm);

    switch (matchType) {
      case 'exact':
        return normalizedSearch === normalizedMatch ? 1.0 : 0.9;

      case 'alias':
        // For alias matches, check if search term appears in the match
        return normalizedMatch.includes(normalizedSearch) ? 0.95 : 0.85;

      case 'alias_partial':
      case 'core_match':
        // Calculate word overlap
        return EntityNormalization.calculateWordOverlap(searchTerm, matchedTerm);

      case 'fuzzy':
      case 'partial':
        // For fuzzy/partial, use the best available similarity metric
        return Math.max(
          this.jaroWinklerSimilarity(normalizedSearch, normalizedMatch),
          EntityNormalization.calculateWordOverlap(searchTerm, matchedTerm),
          this.calculateContainmentScore(normalizedSearch, normalizedMatch)
        );

      default:
        return 0.5;
    }
  }

  /**
   * Check if two entities are likely the same despite different representations
   */
  static areEntitiesEquivalent(entity1: string, entity2: string, threshold: number = 0.9): boolean {
    if (entity1 === entity2) return true;

    const normalized1 = EntityNormalization.normalizeText(entity1);
    const normalized2 = EntityNormalization.normalizeText(entity2);

    if (normalized1 === normalized2) return true;

    // Check core versions
    const core1 = EntityNormalization.getCoreText(entity1);
    const core2 = EntityNormalization.getCoreText(entity2);

    if (core1 === core2 && core1.length > 3) return true;

    // Use similarity metrics
    const jaroWinkler = this.jaroWinklerSimilarity(normalized1, normalized2);
    const wordOverlap = EntityNormalization.calculateWordOverlap(entity1, entity2);

    return jaroWinkler >= threshold || wordOverlap >= threshold;
  }
}