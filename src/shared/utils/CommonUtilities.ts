/**
 * Common Utilities - Shared utility functions for all services
 *
 * These utilities address common patterns identified across the codebase:
 * - String processing and normalization
 * - Array and object manipulation
 * - Validation helpers
 * - Performance utilities
 * - Data transformation helpers
 */

/**
 * String processing utilities
 */
export class StringUtils {
  /**
   * Clean and normalize text for comparison
   */
  static normalizeText(text: string, options: {
    lowercase?: boolean;
    removePunctuation?: boolean;
    removeWhitespace?: boolean;
    trim?: boolean;
  } = {}): string {
    let result = text;

    // Trim whitespace
    if (options.trim !== false) {
      result = result.trim();
    }

    // Convert to lowercase
    if (options.lowercase !== false) {
      result = result.toLowerCase();
    }

    // Remove punctuation
    if (options.removePunctuation) {
      result = result.replace(/[^\w\s-]/g, '');
    }

    // Normalize whitespace
    if (options.removeWhitespace) {
      result = result.replace(/\s+/g, ' ');
    }

    return result;
  }

  /**
   * Extract acronyms from text (patterns like "MIT (Massachusetts Institute of Technology)")
   */
  static extractAcronyms(text: string): Array<{ acronym: string; expansion: string }> {
    const patterns = [
      /\(([^)]+)\)/g,  // (Massachusetts Institute of Technology)
      /\[([^\]]+)\]/g, // [Massachusetts Institute of Technology]
    ];

    const acronyms: Array<{ acronym: string; expansion: string }> = [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const expansion = match[1].trim();
        const words = expansion.split(/\s+/);

        // Check if it's a valid acronym candidate
        if (words.length >= 2 && words.length <= 6) {
          const acronym = words.map(word => word.charAt(0).toUpperCase()).join('');

          // Verify acronym appears elsewhere in text
          if (text.includes(acronym)) {
            acronyms.push({ acronym, expansion });
          }
        }
      }
    }

    return acronyms;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy string matching
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    // Initialize first row and column
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    // Fill the matrix
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,      // deletion
            matrix[j][i - 1] + 1,      // insertion
            matrix[j - 1][i - 1] + 1   // substitution
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate Jaro-Winkler similarity
   * Optimized for short strings like entity names
   */
  static jaroWinklerSimilarity(str1: string, str2: string): number {
    // Edge cases
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Find matching characters
    const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);
    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance, str2.length - 1);

      for (let j = start; j <= end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;

        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;

      while (!str2Matches[k]) k++;

      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    // Calculate Jaro similarity
    const jaroSimilarity = (
      matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches
    ) / 3;

    // Apply Winkler prefix scaling
    let prefixLength = 0;
    const maxPrefixLength = Math.min(4, str1.length, str2.length);

    for (let i = 0; i < maxPrefixLength; i++) {
      if (str1[i] === str2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    return jaroSimilarity + (0.1 * prefixLength * (1 - jaroSimilarity));
  }

  /**
   * Generate text similarity score using multiple algorithms
   */
  static calculateTextSimilarity(
    text1: string,
    text2: string,
    options: {
      jaroWinklerWeight?: number;
      levenshteinWeight?: number;
      wordLevelWeight?: number;
      ngramWeight?: number;
      ngramSize?: number;
    } = {}
  ): { overall: number; components: any } {
    const weights = {
      jaroWinklerWeight: options.jaroWinklerWeight || 0.4,
      levenshteinWeight: options.levenshteinWeight || 0.3,
      wordLevelWeight: options.wordLevelWeight || 0.2,
      ngramWeight: options.ngramWeight || 0.1
    };

    // Calculate individual similarities
    const jaroWinkler = this.jaroWinklerSimilarity(text1, text2);

    const levenshteinDist = this.levenshteinDistance(text1, text2);
    const levenshteinSim = 1 - (levenshteinDist / Math.max(text1.length, text2.length));

    const wordLevelSim = this.wordLevelSimilarity(text1, text2);
    const ngramSim = this.ngramSimilarity(text1, text2, options.ngramSize || 2);

    const components = {
      jaroWinkler,
      levenshtein: levenshteinSim,
      wordLevel: wordLevelSim,
      ngram: ngramSim
    };

    // Calculate weighted overall similarity
    const overall =
      components.jaroWinkler * weights.jaroWinklerWeight +
      components.levenshtein * weights.levenshteinWeight +
      components.wordLevel * weights.wordLevelWeight +
      components.ngram * weights.ngramWeight;

    return { overall, components };
  }

  /**
   * Word-level similarity calculation
   */
  private static wordLevelSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * N-gram similarity calculation
   */
  private static ngramSimilarity(text1: string, text2: string, n: number = 2): number {
    const ngrams1 = this.getNgrams(text1.toLowerCase(), n);
    const ngrams2 = this.getNgrams(text2.toLowerCase(), n);

    const intersection = new Set([...ngrams1].filter(gram => ngrams2.has(gram)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private static getNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();

    for (let i = 0; i <= text.length - n; i++) {
      ngrams.add(text.substring(i, i + n));
    }

    return ngrams;
  }
}

/**
 * Array and object manipulation utilities
 */
export class ArrayUtils {
  /**
   * Chunk array into smaller arrays of specified size
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }

  /**
   * Remove duplicates from array while preserving order
   */
  static unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
    const seen = new Set();
    const result: T[] = [];

    for (const item of array) {
      const key = keyFn ? keyFn(item) : item;

      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Flatten nested arrays
   */
  static flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((acc, val) => {
      return acc.concat(Array.isArray(val) ? val : [val]);
    }, []);
  }

  /**
   * Group array items by a key
   */
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Sort array by multiple criteria
   */
  static sortBy<T>(array: T[], sortFns: Array<(a: T, b: T) => number>): T[] {
    return [...array].sort((a, b) => {
      for (const sortFn of sortFns) {
        const result = sortFn(a, b);
        if (result !== 0) return result;
      }
      return 0;
    });
  }

  /**
   * Paginate array
   */
  static paginate<T>(array: T[], page: number, limit: number): {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  } {
    const offset = (page - 1) * limit;
    const items = array.slice(offset, offset + limit);
    const totalPages = Math.ceil(array.length / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: array.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }
}

/**
 * Object manipulation utilities
 */
export class ObjectUtils {
  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Merge objects with deep merge
   */
  static deepMerge<T>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if value is an object
   */
  private static isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Pick specific properties from object
   */
  static pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;

    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }

    return result;
  }

  /**
   * Omit specific properties from object
   */
  static omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj } as any;

    for (const key of keys) {
      delete result[key];
    }

    return result;
  }

  /**
   * Convert object to query string
   */
  static toQueryString(obj: Record<string, any>): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    }

    return params.toString();
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number format (basic)
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate date string (YYYY-MM-DD format)
   */
  static isValidDateString(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  }

  /**
   * Check if string contains dangerous patterns
   */
  static containsDangerousPatterns(text: string): {
    hasDangerous: boolean;
    patterns: string[];
  } {
    const patterns = [
      /<script[^>]*>/i,           // Script tags
      /javascript:/i,              // JavaScript protocol
      /on\w+\s*=/i,              // Event handlers
      /[\\"'&<>]/,                  // HTML entities
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i, // SQL keywords
      /(\b(UNION|EXEC|EXECUTE)\b)/i, // Dangerous SQL keywords
    ];

    const foundPatterns = patterns.filter(pattern => pattern.test(text));

    return {
      hasDangerous: foundPatterns.length > 0,
      patterns: foundPatterns.map(p => p.source)
    };
  }

  /**
   * Sanitize text input
   */
  static sanitizeText(text: string, options: {
    removeHTML?: boolean;
    maxLength?: number;
    allowedChars?: RegExp;
  } = {}): string {
    let result = text;

    // Remove HTML tags
    if (options.removeHTML !== false) {
      result = result.replace(/<[^>]*>/g, '');
    }

    // Apply allowed characters filter
    if (options.allowedChars) {
      result = result.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
    }

    // Limit length
    if (options.maxLength) {
      result = result.substring(0, options.maxLength);
    }

    return result.trim();
  }
}

/**
 * Performance utilities
 */
export class PerformanceUtils {
  /**
   * Create performance timer
   */
  static createTimer(name?: string): {
    start: number;
    end: () => number;
    elapsed: () => number;
  } {
    const start = Date.now();
    let ended = false;
    let end = start;

    return {
      start,
      end: () => {
        if (!ended) {
          end = Date.now();
          ended = true;
        }
        return end;
      },
      elapsed: () => {
        const currentEnd = ended ? end : Date.now();
        return currentEnd - start;
      }
    };
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return ((...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    });
  }

  /**
   * Throttle function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    });
  }

  /**
   * Measure memory usage
   */
  static getMemoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external
    };
  }

  /**
   * Simple rate limiter
   */
  static createRateLimit(maxCalls: number, windowMs: number): () => boolean {
    const calls: number[] = [];
    const window = windowMs;

    return () => {
      const now = Date.now();

      // Remove old calls outside the window
      const validCalls = calls.filter(callTime => now - callTime < window);
      calls.length = 0;
      calls.push(...validCalls);

      if (calls.length >= maxCalls) {
        return false; // Rate limited
      }

      calls.push(now);
      return true; // Allowed
    };
  }
}

/**
 * Data transformation utilities
 */
export class DataTransformUtils {
  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert kebab-case to camelCase
   */
  static kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * Format duration in milliseconds to human readable string
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else if (seconds > 0) {
      return `${seconds}s`;
    } else {
      return `${ms}ms`;
    }
  }

  /**
   * Format percentage with configurable precision
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Create hash from object (simple implementation)
   */
  static hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0xffffffff;
    }

    return hash.toString(36);
  }
}

/**
 * Export all utilities as default for convenience
 */
export default {
  StringUtils,
  ArrayUtils,
  ObjectUtils,
  ValidationUtils,
  PerformanceUtils,
  DataTransformUtils
};