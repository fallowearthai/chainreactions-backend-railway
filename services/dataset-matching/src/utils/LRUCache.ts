/**
 * LRU (Least Recently Used) Cache implementation with negative result caching
 * Optimized for dataset matching performance
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
  evictions: number;
  size_bytes?: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private enableNegativeCaching: boolean;
  private negativeTTL: number;

  // Performance metrics
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: {
    maxSize?: number;
    defaultTTL?: number; // Default TTL in milliseconds
    enableNegativeCaching?: boolean;
    negativeTTL?: number; // TTL for negative results
  } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60 * 60 * 1000; // 1 hour
    this.enableNegativeCaching = options.enableNegativeCaching !== false;
    this.negativeTTL = options.negativeTTL || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();

    // Check if entry is expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, value: T, ttl?: number, version?: string): void {
    const existingEntry = this.cache.get(key);

    // Remove existing entry if present
    if (existingEntry) {
      this.cache.delete(key);
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      version
    };

    this.cache.set(key, entry);

    // Evict oldest entries if over capacity
    this.evictIfNecessary();
  }

  /**
   * Set negative result (empty array, null, etc.) in cache
   */
  setNegative(key: string, ttl?: number): void {
    if (!this.enableNegativeCaching) {
      return;
    }

    // Store empty array as negative result for DatasetMatch[]
    const negativeValue = [] as unknown as T;
    this.set(key, negativeValue, ttl || this.negativeTTL);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const beforeSize = this.cache.size;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    return beforeSize - this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    // Estimate cache size (rough approximation)
    let sizeBytes = 0;
    try {
      for (const [key, entry] of this.cache.entries()) {
        sizeBytes += key.length * 2; // UTF-16 characters
        sizeBytes += JSON.stringify(entry.value).length * 2;
        sizeBytes += 64; // Entry overhead
      }
    } catch (error) {
      // Ignore serialization errors for size calculation
    }

    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size,
      hitRate,
      evictions: this.evictions,
      size_bytes: sizeBytes
    };
  }

  /**
   * Get approximate memory usage in human readable format
   */
  getMemoryUsage(): string {
    const stats = this.getStats();
    const bytes = stats.size_bytes || 0;

    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  /**
   * Get all keys (useful for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is full
   */
  isFull(): boolean {
    return this.cache.size >= this.maxSize;
  }

  /**
   * Evict oldest entries if over capacity
   */
  private evictIfNecessary(): void {
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.evictions++;
      } else {
        break;
      }
    }
  }

  /**
   * Preload cache with warmup data
   */
  async warmup<TData>(
    keys: string[],
    dataLoader: (key: string) => Promise<TData | null>,
    ttl?: number
  ): Promise<{ loaded: number; failed: number }> {
    let loaded = 0;
    let failed = 0;

    const promises = keys.map(async (key) => {
      try {
        const data = await dataLoader(key);
        if (data !== null) {
          this.set(key, data as T, ttl);
          loaded++;
        } else {
          // Cache negative result if enabled
          this.setNegative(key, ttl);
          failed++;
        }
      } catch (error) {
        console.warn(`Failed to warmup cache for key "${key}":`, error);
        failed++;
      }
    });

    await Promise.allSettled(promises);
    return { loaded, failed };
  }

  /**
   * Export cache state (for persistence)
   */
  export(): Array<{ key: string; entry: CacheEntry<T> }> {
    const entries: Array<{ key: string; entry: CacheEntry<T> }> = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({ key, entry });
    }

    return entries;
  }

  /**
   * Import cache state (for restoration)
   */
  import(entries: Array<{ key: string; entry: CacheEntry<T> }>): void {
    this.clear();

    for (const { key, entry } of entries) {
      const now = Date.now();

      // Only import non-expired entries
      if (now - entry.timestamp <= entry.ttl) {
        this.cache.set(key, entry);
      }
    }

    // Evict if over capacity
    this.evictIfNecessary();
  }

  /**
   * Create a cache key from multiple components
   */
  static createKey(...parts: (string | number | undefined | null)[]): string {
    return parts
      .filter(part => part !== undefined && part !== null)
      .map(part => String(part))
      .join(':');
  }

  /**
   * Create a hash-based cache key for long strings
   */
  static createHashKey(input: string, prefix?: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const hashStr = Math.abs(hash).toString(36);
    return prefix ? `${prefix}:${hashStr}` : hashStr;
  }
}