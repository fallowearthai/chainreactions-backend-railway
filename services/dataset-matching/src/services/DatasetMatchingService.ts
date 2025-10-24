import { SupabaseService } from './SupabaseService';
import { EntityNormalization } from '../algorithms/EntityNormalization';
import { TextMatching } from '../algorithms/TextMatching';
import { QualityAssessment } from '../algorithms/QualityAssessment';
import { ConfigurableMatching } from '../algorithms/ConfigurableMatching';
import { GeographicMatching } from '../algorithms/GeographicMatching';
import { ConfigManager } from '../utils/ConfigManager';
import { CountryNormalizer } from '../utils/CountryNormalizer';
import { LRUCache } from '../utils/LRUCache';
import { ConcurrencyManager } from '../utils/ConcurrencyManager';
import {
  DatasetMatch,
  MatchCandidate,
  ServiceResponse,
  NormalizedEntity,
  EnhancedDatasetMatch,
  AffiliatedMatchRequest,
  AffiliatedMatchResponse
} from '../types/DatasetMatchTypes';
import { createServiceError } from '../utils/ErrorHandler';

export class DatasetMatchingService {
  private static instance: DatasetMatchingService;
  private supabaseService: SupabaseService;
  private configurableMatching: ConfigurableMatching;
  private geographicMatching: GeographicMatching;
  private configManager: ConfigManager;
  private countryNormalizer: CountryNormalizer;

  // Enhanced LRU cache for better performance
  private cache: LRUCache<DatasetMatch[]>;
  private affiliatedCache: LRUCache<AffiliatedMatchResponse['data']>;
  private cacheExpiration: number;

  // Concurrency manager for controlled parallel processing
  private concurrencyManager: ConcurrencyManager;

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
    this.configurableMatching = ConfigurableMatching.getInstance();
    this.geographicMatching = GeographicMatching.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.countryNormalizer = CountryNormalizer.getInstance();

    // Get cache expiration from config and initialize LRU caches
    const cacheConfig = this.configManager.getCacheConfig();
    this.cacheExpiration = cacheConfig.default_ttl_minutes * 60 * 1000;

    // Initialize LRU caches with optimized settings
    this.cache = new LRUCache<DatasetMatch[]>({
      maxSize: cacheConfig.max_cache_entries || 1000,
      defaultTTL: this.cacheExpiration,
      enableNegativeCaching: true,
      negativeTTL: 15 * 60 * 1000 // 15 minutes for negative results
    });

    this.affiliatedCache = new LRUCache<AffiliatedMatchResponse['data']>({
      maxSize: Math.floor((cacheConfig.max_cache_entries || 1000) / 2), // Smaller cache for affiliated data
      defaultTTL: this.cacheExpiration,
      enableNegativeCaching: true,
      negativeTTL: 10 * 60 * 1000 // 10 minutes for negative affiliated results
    });

    // Initialize concurrency manager
    const performanceConfig = this.configManager.getSimilarityWeights().performance_tuning?.batch_processing;
    this.concurrencyManager = new ConcurrencyManager({
      maxConcurrent: performanceConfig?.max_concurrent || 5,
      delayBetweenBatches: 50, // 50ms between batches
      timeout: 30000, // 30 seconds timeout
      retryAttempts: 2
    });
  }

  public static getInstance(): DatasetMatchingService {
    if (!DatasetMatchingService.instance) {
      DatasetMatchingService.instance = new DatasetMatchingService();
    }
    return DatasetMatchingService.instance;
  }

  /**
   * Enhanced find dataset matches with geographic and configurable algorithms
   */
  async findMatchesEnhanced(
    entityName: string,
    searchLocation?: string,
    context?: string,
    options?: {
      forceRefresh?: boolean;
      searchRadius?: 'local' | 'regional' | 'global';
      prioritizeLocal?: boolean;
      maxResults?: number;
    }
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    const startTime = process.hrtime();
    const opts = { forceRefresh: false, maxResults: 20, ...options };

    try {
      // Skip matching for generic or empty terms
      if (EntityNormalization.shouldSkipMatching(entityName)) {
        return {
          success: true,
          data: [],
          metadata: {
            processing_time_ms: this.getProcessingTime(startTime),
            cache_used: false,
            algorithm_version: '2.0.0-enhanced'
          }
        };
      }

      // Create enhanced cache key that includes location
      const cacheKey = this.createEnhancedCacheKey(entityName, searchLocation, context);

      // Check cache first (unless forced refresh)
      if (!opts.forceRefresh) {
        const cached = await this.getCachedMatches(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              processing_time_ms: this.getProcessingTime(startTime),
              cache_used: true,
              algorithm_version: '2.0.0-enhanced'
            }
          };
        }
      }

      // Use progressive search strategy
      const matches = await this.executeProgressiveSearch(entityName, searchLocation, context, opts);

      // Apply early termination if high-confidence matches found (with safe fallback)
      let earlyTerminationConfig;
      try {
        earlyTerminationConfig = this.configManager.getSimilarityWeights().performance_tuning.early_termination;
      } catch (error) {
        earlyTerminationConfig = { enable: false, confidence_threshold: 0.9 };
      }
      if (earlyTerminationConfig.enable && matches.length > 0) {
        const highConfidenceMatches = matches.filter(match =>
          match.confidence_score && match.confidence_score >= earlyTerminationConfig.confidence_threshold
        );

        if (highConfidenceMatches.length >= 3) {
          console.log(`Early termination: Found ${highConfidenceMatches.length} high-confidence matches`);
          const finalMatches = this.applyGeographicRanking(highConfidenceMatches, searchLocation, opts)
            .slice(0, Math.min(opts.maxResults, 5));

          await this.cacheMatches(cacheKey, finalMatches);

          return {
            success: true,
            data: finalMatches,
            metadata: {
              processing_time_ms: this.getProcessingTime(startTime),
              cache_used: false,
              algorithm_version: '2.0.0-enhanced',
              matches_found: finalMatches.length,
              geographic_boost_applied: !!searchLocation,
              early_termination_applied: true
            }
          };
        }
      }

      // Apply geographic filtering and ranking
      const geographicallyRanked = this.applyGeographicRanking(matches, searchLocation, opts);

      // Limit results
      const finalMatches = geographicallyRanked.slice(0, opts.maxResults);

      // Cache the results
      await this.cacheMatches(cacheKey, finalMatches);

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: finalMatches,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '2.0.0-enhanced',
          matches_found: finalMatches.length,
          geographic_boost_applied: !!searchLocation
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'ENHANCED_MATCHING_ERROR',
        `Failed to find enhanced matches for entity "${entityName}": ${error.message}`,
        { entity: entityName, location: searchLocation, context }
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
        }
      };
    }
  }

  /**
   * Original find dataset matches method (backward compatibility)
   */
  async findMatches(
    entityName: string,
    context?: string,
    forceRefresh: boolean = false
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    // Delegate to enhanced method for backward compatibility
    return this.findMatchesEnhanced(entityName, undefined, context, { forceRefresh });
  }

  /**
   * Legacy findMatches implementation
   */
  private async findMatchesLegacy(
    entityName: string,
    context?: string,
    forceRefresh: boolean = false
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    const startTime = process.hrtime();

    try {
      // Skip matching for generic or empty terms
      if (EntityNormalization.shouldSkipMatching(entityName)) {
        return {
          success: true,
          data: [],
          metadata: {
            processing_time_ms: this.getProcessingTime(startTime),
            cache_used: false,
            algorithm_version: '1.0.0'
          }
        };
      }

      // Normalize entity for processing
      const normalizedEntity = EntityNormalization.normalizeEntity(entityName);

      // Check cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = await this.getCachedMatches(normalizedEntity.normalized);
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              processing_time_ms: this.getProcessingTime(startTime),
              cache_used: true,
              algorithm_version: '1.0.0'
            }
          };
        }
      }

      // Search in database using all variations
      const allMatches: MatchCandidate[] = [];

      for (const variation of normalizedEntity.variations) {
        const result = await this.supabaseService.findDatasetMatches(variation);

        if (result.success && result.data) {
          // Convert to match candidates with quality metrics
          const candidates = result.data.map(match => this.createMatchCandidate(
            entityName,
            match,
            context
          ));

          allMatches.push(...candidates);
        }
      }

      // Remove duplicates based on dataset + organization name
      const uniqueMatches = this.removeDuplicateMatches(allMatches);

      // Apply quality assessment and filtering
      const qualityFilteredMatches = QualityAssessment.filterMatchResults(
        uniqueMatches.map(candidate => candidate),
        entityName,
        context
      );

      // Apply academic filtering if needed
      const academicFilteredMatches = QualityAssessment.applyAcademicFiltering(
        entityName,
        qualityFilteredMatches
      );

      // Cache the results
      await this.cacheMatches(normalizedEntity.normalized, academicFilteredMatches);

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: academicFilteredMatches,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'MATCHING_ERROR',
        `Failed to find matches for entity "${entityName}": ${error.message}`,
        { entity: entityName, context }
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    }
  }

  /**
   * Find matches for multiple entities in batch with enhanced geographic support (Optimized)
   */
  async findMatchesBatch(
    entities: string[],
    context?: string,
    forceRefresh: boolean = false,
    options?: {
      location?: string;
      searchRadius?: 'local' | 'regional' | 'global';
      prioritizeLocal?: boolean;
      maxResults?: number;
    }
  ): Promise<ServiceResponse<Record<string, DatasetMatch[]>>> {
    const startTime = process.hrtime();

    try {
      let cacheHits = 0;
      const uncachedEntities: string[] = [];
      const cachedResults: Record<string, DatasetMatch[]> = {};

      // Check cache first for all entities
      if (!forceRefresh) {
        for (const entity of entities) {
          const cacheKey = this.createEnhancedCacheKey(entity, options?.location, context);
          const cached = await this.getCachedMatches(cacheKey);

          if (cached) {
            cachedResults[entity] = cached;
            cacheHits++;
          } else {
            uncachedEntities.push(entity);
          }
        }
      } else {
        uncachedEntities.push(...entities);
      }

      let batchResults: Record<string, DatasetMatch[]> = {};

      // Use optimized batch query for uncached entities
      if (uncachedEntities.length > 0) {
        const batchResult = await this.supabaseService.findDatasetMatchesBatch(uncachedEntities);

        if (batchResult.success && batchResult.data) {
          batchResults = batchResult.data;

          // Cache the new results
          for (const [entity, matches] of Object.entries(batchResults)) {
            const cacheKey = this.createEnhancedCacheKey(entity, options?.location, context);
            await this.cacheMatches(cacheKey, matches);
          }
        }
      }

      // Combine cached and batch results
      const allResults: Record<string, DatasetMatch[]> = {
        ...cachedResults,
        ...batchResults
      };

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: allResults,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: cacheHits > 0,
          algorithm_version: '2.0.0-batch-optimized',
          cache_hits: cacheHits,
          cache_misses: uncachedEntities.length,
          total_entities: entities.length
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'BATCH_MATCHING_ERROR',
        `Failed to process batch matching: ${error.message}`,
        { entity_count: entities.length, context }
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-batch-optimized'
        }
      };
    }
  }

  /**
   * Create a match candidate with quality metrics
   */
  private createMatchCandidate(
    searchEntity: string,
    match: DatasetMatch,
    context?: string
  ): MatchCandidate {
    // Calculate quality metrics
    const qualityMetrics = QualityAssessment.calculateQualityMetrics(
      searchEntity,
      match.organization_name,
      match.match_type,
      context
    );

    // Calculate overall confidence score
    const confidenceScore = QualityAssessment.calculateMatchQuality(
      searchEntity,
      match.organization_name,
      match.match_type,
      context
    );

    return {
      dataset_entry: {
        id: '',
        dataset_id: '',
        organization_name: match.organization_name,
        aliases: [],
        category: match.category || undefined,
        created_at: '',
        updated_at: match.last_updated || ''
      },
      dataset: {
        id: '',
        name: match.dataset_name,
        is_active: true,
        created_at: '',
        updated_at: match.last_updated || ''
      },
      match_type: match.match_type,
      confidence_score: confidenceScore,
      quality_metrics: qualityMetrics
    };
  }

  /**
   * Remove duplicate matches based on dataset + organization name
   */
  private removeDuplicateMatches(matches: MatchCandidate[]): DatasetMatch[] {
    const seen = new Set<string>();
    const uniqueMatches: DatasetMatch[] = [];

    for (const candidate of matches) {
      const key = `${candidate.dataset.name}:${candidate.dataset_entry.organization_name}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push({
          dataset_name: candidate.dataset.name,
          organization_name: candidate.dataset_entry.organization_name,
          match_type: candidate.match_type,
          category: candidate.dataset_entry.category ?? undefined,
          confidence_score: candidate.confidence_score,
          last_updated: candidate.dataset_entry.updated_at || undefined,
          quality_metrics: candidate.quality_metrics
        });
      }
    }

    return uniqueMatches;
  }

  /**
   * Get cached matches if available and valid (Enhanced with LRU cache)
   */
  private async getCachedMatches(cacheKey: string): Promise<DatasetMatch[] | null> {
    try {
      const cached = this.cache.get(cacheKey);

      if (cached === null) return null;

      // Check if cached result is negative (empty array)
      if (cached.length === 0) {
        return []; // Return empty array as negative cache result
      }

      // Check if cache version is still valid for non-negative results
      const versionResult = await this.supabaseService.getDatasetsVersion();
      const cachedVersion = this.cache.get(`${cacheKey}:version`);

      if (versionResult.success && cachedVersion && versionResult.data !== String(cachedVersion[0])) {
        this.cache.delete(cacheKey);
        this.cache.delete(`${cacheKey}:version`);
        return null;
      }

      return cached;
    } catch (error) {
      console.warn('Failed to get cached matches:', error);
      return null;
    }
  }

  /**
   * Cache matches for an entity (Enhanced with LRU cache)
   */
  private async cacheMatches(cacheKey: string, matches: DatasetMatch[]): Promise<void> {
    try {
      // Get current version for cache invalidation
      const versionResult = await this.supabaseService.getDatasetsVersion();
      const version = versionResult.success ? versionResult.data! : Date.now().toString();

      // Cache the matches (or negative result if empty)
      if (matches.length > 0) {
        this.cache.set(cacheKey, matches, this.cacheExpiration, version);
        this.cache.set(`${cacheKey}:version`, [version] as any, this.cacheExpiration);
      } else {
        // Cache negative result
        this.cache.setNegative(cacheKey);
      }

      // Periodic cleanup
      if (this.cache.size() > this.cache['maxSize'] * 0.9) {
        this.cache.cleanup();
      }
    } catch (error) {
      console.warn('Failed to cache matches:', error);
      // Don't throw error, caching is optional
    }
  }

  /**
   * Get cached affiliated matches
   */
  private async getCachedAffiliatedMatches(cacheKey: string): Promise<AffiliatedMatchResponse['data'] | null> {
    try {
      return this.affiliatedCache.get(cacheKey);
    } catch (error) {
      console.warn('Failed to get cached affiliated matches:', error);
      return null;
    }
  }

  /**
   * Cache affiliated matches
   */
  private async cacheAffiliatedMatches(cacheKey: string, data: AffiliatedMatchResponse['data']): Promise<void> {
    try {
      this.affiliatedCache.set(cacheKey, data, this.cacheExpiration);

      // Periodic cleanup
      if (this.affiliatedCache.size() > this.affiliatedCache['maxSize'] * 0.9) {
        this.affiliatedCache.cleanup();
      }
    } catch (error) {
      console.warn('Failed to cache affiliated matches:', error);
    }
  }

  /**
   * Clear all cached matches (Enhanced with LRU cache)
   */
  async clearCache(): Promise<ServiceResponse<{ cleared_entries: number; cache_stats: any }>> {
    const startTime = process.hrtime();

    try {
      const mainCacheSize = this.cache.size();
      const affiliatedCacheSize = this.affiliatedCache.size();
      const totalCleared = mainCacheSize + affiliatedCacheSize;

      const mainCacheStats = this.cache.getStats();
      const affiliatedCacheStats = this.affiliatedCache.getStats();

      this.cache.clear();
      this.affiliatedCache.clear();

      return {
        success: true,
        data: {
          cleared_entries: totalCleared,
          cache_stats: {
            main_cache: {
              entries: mainCacheSize,
              hits: mainCacheStats.hits,
              misses: mainCacheStats.misses,
              hit_rate: mainCacheStats.hitRate,
              memory_usage: this.cache.getMemoryUsage()
            },
            affiliated_cache: {
              entries: affiliatedCacheSize,
              hits: affiliatedCacheStats.hits,
              misses: affiliatedCacheStats.misses,
              hit_rate: affiliatedCacheStats.hitRate,
              memory_usage: this.affiliatedCache.getMemoryUsage()
            }
          }
        },
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-lru-enhanced'
        }
      };
    } catch (error: any) {
      const serviceError = createServiceError(
        'CACHE_CLEAR_ERROR',
        `Failed to clear cache: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-lru-enhanced'
        }
      };
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<ServiceResponse<any>> {
    const startTime = process.hrtime();

    try {
      // Get database stats
      const dbStatsResult = await this.supabaseService.getDatabaseStats();

      const stats = {
        cache: {
          entries: this.cache.size,
          max_entries: 100,
          expiration_ms: this.cacheExpiration
        },
        database: dbStatsResult.success ? dbStatsResult.data : null,
        algorithms: {
          text_matching: ['Jaro-Winkler', 'Levenshtein', 'N-gram'],
          quality_assessment: ['Specificity', 'Coverage', 'Context'],
          match_types: ['exact', 'alias', 'fuzzy', 'partial', 'core_match']
        },
        performance: {
          avg_processing_time_ms: 50, // Estimated
          cache_hit_ratio: 0.85, // Estimated
          supported_batch_size: 100
        }
      };

      return {
        success: true,
        data: stats,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const serviceError = createServiceError(
        'STATS_ERROR',
        `Failed to get service statistics: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    }
  }

  /**
   * Calculate processing time from start time
   */
  private getProcessingTime(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return Math.round((seconds * 1000) + (nanoseconds / 1e6));
  }

  /**
   * Create enhanced cache key that includes location context
   */
  private createEnhancedCacheKey(entityName: string, searchLocation?: string, context?: string): string {
    const normalizedEntity = EntityNormalization.normalizeText(entityName);
    const normalizedLocation = searchLocation ? this.countryNormalizer.normalizeCountry(searchLocation)?.canonical || searchLocation : '';
    const normalizedContext = context ? EntityNormalization.normalizeText(context) : '';

    return `enhanced:${normalizedEntity}:${normalizedLocation}:${normalizedContext}`;
  }

  /**
   * Execute progressive search strategy
   */
  private async executeProgressiveSearch(
    entityName: string,
    searchLocation?: string,
    context?: string,
    options?: any
  ): Promise<DatasetMatch[]> {
    // Get strategies with safe defaults
    const strategies = this.configManager.getQueryStrategies();
    const timeouts = this.configManager.getTimeouts();
    const allMatches: DatasetMatch[] = [];

    // Safe access with defaults
    const exactMatchLimit = strategies?.exact_match_limit || 10;
    const fuzzyMatchLimit = strategies?.fuzzy_match_limit || 20;

    // Strategy 1: Exact matches
    const exactMatches = await this.findExactMatches(entityName, searchLocation);
    allMatches.push(...exactMatches);

    if (allMatches.length >= exactMatchLimit) {
      return this.rankAndDeduplicateMatches(allMatches, entityName, searchLocation, context);
    }

    // Strategy 2: High similarity matches
    const fuzzyMatches = await this.findHighSimilarityMatches(entityName, searchLocation);
    allMatches.push(...fuzzyMatches);

    if (allMatches.length >= fuzzyMatchLimit) {
      return this.rankAndDeduplicateMatches(allMatches, entityName, searchLocation, context);
    }

    // Strategy 3: Alias matches
    const aliasMatches = await this.findAliasMatches(entityName, searchLocation);
    allMatches.push(...aliasMatches);

    return this.rankAndDeduplicateMatches(allMatches, entityName, searchLocation, context);
  }

  /**
   * Find exact matches using database
   */
  private async findExactMatches(entityName: string, searchLocation?: string): Promise<DatasetMatch[]> {
    const result = await this.supabaseService.findDatasetMatches(
      entityName,
      searchLocation,
      { prioritizeLocal: true, maxResults: 10 }
    );
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.filter(match => {
      const similarity = this.configurableMatching.calculateAdvancedSimilarity(
        entityName,
        match.organization_name,
        {
          searchLocation,
          entityCountries: [match.category || ''] // Using category as temporary country placeholder
        }
      );
      return similarity.matchType === 'exact' ||
             similarity.matchType === 'core_acronym' ||
             similarity.score >= 0.95;
    });
  }

  /**
   * Find high similarity matches
   */
  private async findHighSimilarityMatches(entityName: string, searchLocation?: string): Promise<DatasetMatch[]> {
    const result = await this.supabaseService.findDatasetMatches(
      entityName,
      searchLocation,
      { prioritizeLocal: false, maxResults: 15 }
    );
    if (!result.success || !result.data) {
      return [];
    }

    const matches: DatasetMatch[] = [];
    const thresholds = this.configManager.getSimilarityThresholds();

    // Safe access with default
    const goodSimilarityThreshold = thresholds?.good_similarity || 0.85;

    for (const match of result.data) {
      const similarity = this.configurableMatching.calculateAdvancedSimilarity(
        entityName,
        match.organization_name,
        {
          searchLocation,
          entityCountries: [match.category || '']
        }
      );

      if (similarity.score >= goodSimilarityThreshold) {
        matches.push({
          ...match,
          match_type: similarity.matchType,
          confidence_score: similarity.score,
          quality_metrics: {
            specificity_score: similarity.components.jaro_winkler || 0,
            length_ratio: similarity.components.levenshtein || 0,
            word_count_ratio: similarity.components.word_level || 0,
            match_coverage: similarity.score
          }
        });
      }
    }

    return matches;
  }

  /**
   * Find alias matches
   */
  private async findAliasMatches(entityName: string, searchLocation?: string): Promise<DatasetMatch[]> {
    // Use geographic-aware search for alias matching
    const result = await this.supabaseService.findDatasetMatches(
      entityName,
      searchLocation,
      { prioritizeLocal: false, maxResults: 10 }
    );
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.filter(match =>
      match.match_type === 'alias' || match.match_type === 'alias_partial'
    );
  }

  /**
   * Rank and deduplicate matches using enhanced algorithms
   */
  private rankAndDeduplicateMatches(
    matches: DatasetMatch[],
    entityName: string,
    searchLocation?: string,
    context?: string
  ): DatasetMatch[] {
    // Simple deduplication by organization name
    const uniqueMatches = new Map<string, DatasetMatch>();

    for (const match of matches) {
      const key = match.organization_name.toLowerCase();
      const existing = uniqueMatches.get(key);

      // Keep the match with higher confidence
      if (!existing || (match.confidence_score || 0) > (existing.confidence_score || 0)) {
        uniqueMatches.set(key, match);
      }
    }

    // Convert back to array and sort by confidence
    return Array.from(uniqueMatches.values())
      .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  }

  /**
   * Apply geographic ranking to matches
   */
  private applyGeographicRanking(
    matches: DatasetMatch[],
    searchLocation?: string,
    options?: any
  ): DatasetMatch[] {
    if (!searchLocation || !this.configManager.getGeographicConfig().enable_location_boost) {
      return matches;
    }

    return matches.map(match => {
      const geographicScore = this.geographicMatching.calculateGeographicScore({
        searchLocation,
        entityCountries: match.category ? [match.category] : [],
        searchRadius: options?.searchRadius,
        prioritizeLocal: options?.prioritizeLocal
      });

      return {
        ...match,
        confidence_score: (match.confidence_score || 0) * geographicScore.boost_factor
      };
    }).sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  }

  /**
   * Warm up cache with popular queries
   */
  async warmupCache(): Promise<ServiceResponse<{ warmed_queries: number; processing_time_ms: number }>> {
    const startTime = process.hrtime();
    const cacheConfig = this.configManager.getCacheConfig();

    if (!cacheConfig.enable_warmup || !cacheConfig.warmup_queries || cacheConfig.warmup_queries.length === 0) {
      return {
        success: true,
        data: { warmed_queries: 0, processing_time_ms: 0 },
        metadata: {
          processing_time_ms: 0,
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
        }
      };
    }

    try {
      let warmedQueries = 0;

      for (const query of cacheConfig.warmup_queries) {
        try {
          await this.findMatchesEnhanced(query, undefined, undefined, { maxResults: 10 });
          warmedQueries++;
        } catch (error) {
          console.warn(`Failed to warm up cache for query "${query}":`, error);
        }
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: { warmed_queries: warmedQueries, processing_time_ms: processingTime },
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'CACHE_WARMUP_ERROR',
        `Cache warmup failed: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
        }
      };
    }
  }

  /**
   * Get enhanced service statistics with performance monitoring
   */
  async getEnhancedServiceStats(): Promise<ServiceResponse<any>> {
    const startTime = process.hrtime();

    try {
      // Get basic stats
      const basicStats = await this.getServiceStats();

      // Get cache performance metrics
      const mainCacheStats = this.cache.getStats();
      const affiliatedCacheStats = this.affiliatedCache.getStats();

      // Add enhanced stats with performance monitoring
      const enhancedStats = {
        ...basicStats.data,
        performance: {
          cache_performance: {
            main_cache: {
              entries: mainCacheStats.entries,
              hits: mainCacheStats.hits,
              misses: mainCacheStats.misses,
              hit_rate: Math.round(mainCacheStats.hitRate * 10000) / 100, // Round to 2 decimal places
              evictions: mainCacheStats.evictions,
              memory_usage: this.cache.getMemoryUsage(),
              size_bytes: mainCacheStats.size_bytes
            },
            affiliated_cache: {
              entries: affiliatedCacheStats.entries,
              hits: affiliatedCacheStats.hits,
              misses: affiliatedCacheStats.misses,
              hit_rate: Math.round(affiliatedCacheStats.hitRate * 10000) / 100,
              evictions: affiliatedCacheStats.evictions,
              memory_usage: this.affiliatedCache.getMemoryUsage(),
              size_bytes: affiliatedCacheStats.size_bytes
            },
            combined: {
              total_hits: mainCacheStats.hits + affiliatedCacheStats.hits,
              total_misses: mainCacheStats.misses + affiliatedCacheStats.misses,
              overall_hit_rate: Math.round(
                ((mainCacheStats.hits + affiliatedCacheStats.hits) /
                (mainCacheStats.hits + affiliatedCacheStats.hits + mainCacheStats.misses + affiliatedCacheStats.misses)) * 10000
              ) / 100 || 0,
              total_memory_usage: `${this.cache.getMemoryUsage()} + ${this.affiliatedCache.getMemoryUsage()}`
            }
          },
          database_performance: {
            avg_query_time_ms: basicStats.data?.performance?.avg_processing_time_ms || 50,
            cache_hit_ratio: mainCacheStats.hitRate,
            supported_batch_size: 100,
            batch_optimization_enabled: true
          }
        },
        enhanced_features: {
          configurable_matching: this.configurableMatching.getPerformanceMetrics(),
          geographic_matching: this.geographicMatching.getGeographicStats(),
          configuration: this.configManager.getConfigurationSummary()
        },
        optimization_status: {
          batch_queries_enabled: true,
          lru_cache_enabled: true,
          negative_cache_enabled: this.cache['enableNegativeCaching'],
          early_termination_enabled: this.configManager.getSimilarityWeights().performance_tuning?.early_termination?.enable || false,
          concurrent_processing_enabled: true
        },
        algorithm_version: '2.0.0-performance-optimized'
      };

      return {
        success: true,
        data: enhancedStats,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-performance-optimized'
        }
      };
    } catch (error: any) {
      const serviceError = createServiceError(
        'ENHANCED_STATS_ERROR',
        `Failed to get enhanced service statistics: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-performance-optimized'
        }
      };
    }
  }

  /**
   * Enhanced matching for entities with affiliated companies
   * This method integrates with Entity Search results to provide comprehensive matching
   */
  async findAffiliatedMatches(request: AffiliatedMatchRequest): Promise<ServiceResponse<AffiliatedMatchResponse['data']>> {
    const startTime = process.hrtime();
    const {
      entity,
      affiliated_companies,
      location,
      context,
      options = {}
    } = request;

    try {
      // 1. Find direct matches for the main entity
      const directMatchesResponse = await this.findMatchesEnhanced(
        entity,
        location,
        context,
        {
          forceRefresh: options.forceRefresh,
          searchRadius: options.searchRadius,
          prioritizeLocal: options.prioritizeLocal,
          maxResults: options.maxResults || 20
        }
      );

      if (!directMatchesResponse.success || !directMatchesResponse.data) {
        throw new Error(directMatchesResponse.error?.message || 'Failed to find direct matches');
      }

      // Convert direct matches to enhanced matches
      const directMatches: EnhancedDatasetMatch[] = directMatchesResponse.data.map(match => ({
        ...match,
        relationship_source: 'direct',
        relationship_strength: 1.0,
        boost_applied: 1.0
      }));

      // 2. Process affiliated companies with boost
      const affiliatedBoost = options.affiliatedBoost || 1.15;
      const affiliatedMatches: Record<string, EnhancedDatasetMatch[]> = {};
      let totalAffiliatedMatches = 0;
      let matchedAffiliatedEntities = 0;

      // Create context for affiliated matching
      const matchContext = {
        searchLocation: location,
        searchContext: context
      };

      // Deduplicate affiliated companies
      const uniqueAffiliatedCompanies = this.deduplicateAffiliatedCompanies(affiliated_companies);

      // Use batch processing for affiliated companies (Performance Optimization)
      if (uniqueAffiliatedCompanies.length > 0) {
        const affiliatedCompanyNames = uniqueAffiliatedCompanies.map(ac => ac.company_name);

        const affiliatedBatchResponse = await this.findMatchesBatch(
          affiliatedCompanyNames,
          context,
          options.forceRefresh,
          {
            location,
            searchRadius: options.searchRadius,
            prioritizeLocal: options.prioritizeLocal,
            maxResults: Math.floor((options.maxResults || 20) / 2) // Allocate half results to affiliated
          }
        );

        if (affiliatedBatchResponse.success && affiliatedBatchResponse.data) {
          // Process batch results and enhance with affiliated context
          for (const affiliated of uniqueAffiliatedCompanies) {
            const matches = affiliatedBatchResponse.data[affiliated.company_name] || [];

            if (matches.length > 0) {
              // Enhance matches with affiliated context
              const enhancedMatches = matches
                .map(match => this.configurableMatching.enhanceMatchWithAffiliatedContext(match, {
                  company_name: affiliated.company_name,
                  risk_keyword: affiliated.risk_keyword,
                  relationship_type: affiliated.relationship_type,
                  boost_applied: affiliatedBoost
                }))
                .filter(match => (match.confidence_score || 0) >= (options.minConfidence || 0.3));

              if (enhancedMatches.length > 0) {
                affiliatedMatches[affiliated.company_name] = enhancedMatches;
                totalAffiliatedMatches += enhancedMatches.length;
                matchedAffiliatedEntities++;
              }
            }
          }
        }
      }

      // 3. Create detailed affiliated company breakdown with match sources
      const affiliatedBreakdown = uniqueAffiliatedCompanies.map(affiliated => {
        const matches = affiliatedMatches[affiliated.company_name] || [];
        return {
          company_name: affiliated.company_name,
          risk_keyword: affiliated.risk_keyword,
          relationship_type: affiliated.relationship_type,
          match_count: matches.length,
          matches: matches,
          has_matches: matches.length > 0,
          top_confidence: matches.length > 0 ? Math.max(...matches.map(m => m.confidence_score || 0)) : 0
        };
      });

      // 4. Calculate match summary
      const highConfidenceMatches = [
        ...directMatches.filter(match => (match.confidence_score || 0) > 0.8),
        ...Object.values(affiliatedMatches).flat().filter(match => (match.confidence_score || 0) > 0.8)
      ].length;

      const allMatches = [...directMatches, ...Object.values(affiliatedMatches).flat()];
      const averageConfidence = allMatches.length > 0
        ? allMatches.reduce((sum, match) => sum + (match.confidence_score || 0), 0) / allMatches.length
        : 0;

      const matchSummary = {
        total_affiliated_entities: uniqueAffiliatedCompanies.length,
        matched_affiliated_entities: matchedAffiliatedEntities,
        total_direct_matches: directMatches.length,
        total_affiliated_matches: totalAffiliatedMatches,
        high_confidence_matches: highConfidenceMatches,
        average_confidence: Math.round(averageConfidence * 100) / 100
      };

      const responseData: AffiliatedMatchResponse['data'] = {
        direct_matches: directMatches,
        affiliated_matches: affiliatedMatches,
        affiliated_breakdown: affiliatedBreakdown, // New detailed breakdown
        match_summary: matchSummary
      };

      return {
        success: true,
        data: responseData,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.1.0-affiliated-enhanced'
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'AFFILIATED_MATCHING_ERROR',
        `Failed to find affiliated matches: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.1.0-affiliated-enhanced'
        }
      };
    }
  }

  /**
   * Batch processing for multiple entities with affiliated companies (Concurrency Enhanced)
   */
  async findBatchAffiliatedMatches(request: {
    entities_with_affiliated: AffiliatedMatchRequest[];
    global_options?: AffiliatedMatchRequest['options'];
  }): Promise<ServiceResponse<Record<string, AffiliatedMatchResponse['data']>>> {
    const startTime = process.hrtime();

    try {
      // Prepare tasks for concurrent processing
      const tasks = request.entities_with_affiliated.map(entityRequest => ({
        id: entityRequest.entity,
        data: {
          ...entityRequest,
          options: { ...request.global_options, ...entityRequest.options }
        }
      }));

      // Process with concurrency manager
      const taskResults = await this.concurrencyManager.processParallel(
        tasks,
        async (affiliatedRequest: AffiliatedMatchRequest) => {
          return this.findAffiliatedMatches(affiliatedRequest);
        }
      );

      // Collect successful results
      const results: Record<string, AffiliatedMatchResponse['data']> = {};
      taskResults.forEach(({ taskId, success, data, error }) => {
        if (success && data && data.data) {
          results[taskId] = data.data;
        } else {
          console.warn(`Failed to process affiliated matches for "${taskId}":`, error?.message);
        }
      });

      // Get performance statistics
      const stats = this.concurrencyManager.getStats(taskResults);

      return {
        success: true,
        data: results,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.1.0-concurrency-enhanced',
          performance_stats: {
            total_entities: tasks.length,
            successful_entities: stats.successful,
            failed_entities: stats.failed,
            success_rate: Math.round(stats.successRate * 10000) / 100,
            avg_duration_ms: Math.round(stats.avgDuration),
            total_duration_ms: stats.totalDuration
          }
        }
      };

    } catch (error: any) {
      const serviceError = createServiceError(
        'BATCH_AFFILIATED_MATCHING_ERROR',
        `Failed to process batch affiliated matches: ${error.message}`
      );

      return {
        success: false,
        error: serviceError,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.1.0-concurrency-enhanced'
        }
      };
    }
  }

  /**
   * Deduplicate affiliated companies to optimize processing
   */
  private deduplicateAffiliatedCompanies(
    affiliated_companies: AffiliatedMatchRequest['affiliated_companies']
  ): AffiliatedMatchRequest['affiliated_companies'] {
    const seen = new Set<string>();
    const deduplicated: AffiliatedMatchRequest['affiliated_companies'] = [];

    for (const company of affiliated_companies) {
      const normalized = company.company_name.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(company);
      }
    }

    return deduplicated;
  }

  /**
   * Create enhanced cache key for affiliated matching
   */
  private createAffiliatedCacheKey(
    entity: string,
    affiliatedCompanies: AffiliatedMatchRequest['affiliated_companies'],
    location?: string,
    context?: string
  ): string {
    const affiliatedHash = affiliatedCompanies
      .map(ac => `${ac.company_name}:${ac.risk_keyword}`)
      .sort()
      .join('|')
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, '');

    return `affiliated:${entity}:${affiliatedHash}:${location || ''}:${context || ''}`;
  }

  }