import { SupabaseService } from './SupabaseService';
import { EntityNormalization } from '../algorithms/EntityNormalization';
import { TextMatching } from '../algorithms/TextMatching';
import { QualityAssessment } from '../algorithms/QualityAssessment';
import { ConfigurableMatching } from '../algorithms/ConfigurableMatching';
import { GeographicMatching } from '../algorithms/GeographicMatching';
import { ConfigManager } from '../utils/ConfigManager';
import { CountryNormalizer } from '../utils/CountryNormalizer';
import {
  DatasetMatch,
  MatchCandidate,
  ServiceResponse,
  NormalizedEntity
} from '../types/DatasetMatchTypes';
import { createServiceError } from '../utils/ErrorHandler';

export class DatasetMatchingService {
  private static instance: DatasetMatchingService;
  private supabaseService: SupabaseService;
  private configurableMatching: ConfigurableMatching;
  private geographicMatching: GeographicMatching;
  private configManager: ConfigManager;
  private countryNormalizer: CountryNormalizer;

  // In-memory cache for quick lookups
  private cache = new Map<string, { matches: DatasetMatch[]; timestamp: number; version: string }>();
  private cacheExpiration: number;

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
    this.configurableMatching = ConfigurableMatching.getInstance();
    this.geographicMatching = GeographicMatching.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.countryNormalizer = CountryNormalizer.getInstance();

    // Get cache expiration from config
    const cacheConfig = this.configManager.getCacheConfig();
    this.cacheExpiration = cacheConfig.default_ttl_minutes * 60 * 1000;
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
   * Find matches for multiple entities in batch with enhanced geographic support
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
      const results: Record<string, DatasetMatch[]> = {};
      let cacheHits = 0;

      // Adaptive batch sizing based on performance configuration
      const performanceConfig = this.configManager.getSimilarityWeights().performance_tuning.batch_processing;
      const batchSize = Math.min(performanceConfig.chunk_size || 5, entities.length);
      const maxConcurrent = performanceConfig.max_concurrent || 3;
      const batches = [];

      for (let i = 0; i < entities.length; i += batchSize) {
        batches.push(entities.slice(i, i + batchSize));
      }

      console.log(`Processing ${entities.length} entities in ${batches.length} batches of ${batchSize}, max concurrent: ${maxConcurrent}`);

      for (const batch of batches) {
        const batchPromises = batch.map(async (entity, index) => {
          // Add small delay to prevent overwhelming the database
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Use enhanced matching with geographic support
          const result = await this.findMatchesEnhanced(
            entity,
            options?.location,
            context,
            {
              forceRefresh,
              searchRadius: options?.searchRadius,
              prioritizeLocal: options?.prioritizeLocal,
              maxResults: options?.maxResults || 20
            }
          );

          if (result.success) {
            if (result.metadata?.cache_used) {
              cacheHits++;
            }
            return { entity, matches: result.data! };
          } else {
            console.warn(`Failed to find matches for entity "${entity}":`, result.error);
            return { entity, matches: [] };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ entity, matches }) => {
          results[entity] = matches;
        });
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: results,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: cacheHits > 0,
          algorithm_version: '1.0.0'
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
          algorithm_version: '1.0.0'
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
          category: candidate.dataset_entry.category || undefined,
          confidence_score: candidate.confidence_score,
          last_updated: candidate.dataset_entry.updated_at || undefined,
          quality_metrics: candidate.quality_metrics
        });
      }
    }

    return uniqueMatches;
  }

  /**
   * Get cached matches if available and valid
   */
  private async getCachedMatches(normalizedEntity: string): Promise<DatasetMatch[] | null> {
    const cached = this.cache.get(normalizedEntity);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheExpiration) {
      this.cache.delete(normalizedEntity);
      return null;
    }

    // Check if cache version is still valid
    const versionResult = await this.supabaseService.getDatasetsVersion();
    if (versionResult.success && versionResult.data !== cached.version) {
      this.cache.delete(normalizedEntity);
      return null;
    }

    return cached.matches;
  }

  /**
   * Cache matches for an entity
   */
  private async cacheMatches(normalizedEntity: string, matches: DatasetMatch[]): Promise<void> {
    try {
      // Get current version
      const versionResult = await this.supabaseService.getDatasetsVersion();
      const version = versionResult.success ? versionResult.data! : Date.now().toString();

      // Clean up expired cache entries periodically
      if (this.cache.size > 100) {
        this.cleanupExpiredCache();
      }

      this.cache.set(normalizedEntity, {
        matches,
        timestamp: Date.now(),
        version
      });
    } catch (error) {
      console.warn('Failed to cache matches:', error);
      // Don't throw error, caching is optional
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheExpiration) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached matches
   */
  async clearCache(): Promise<ServiceResponse<{ cleared_entries: number }>> {
    const startTime = process.hrtime();

    try {
      const entriesCount = this.cache.size;
      this.cache.clear();

      return {
        success: true,
        data: { cleared_entries: entriesCount },
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '1.0.0'
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
          algorithm_version: '1.0.0'
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
    const strategies = this.configManager.getQueryStrategies();
    const timeouts = this.configManager.getTimeouts();
    const allMatches: DatasetMatch[] = [];

    // Strategy 1: Exact matches
    const exactMatches = await this.findExactMatches(entityName, searchLocation);
    allMatches.push(...exactMatches);

    if (allMatches.length >= strategies.exact_match_limit) {
      return this.rankAndDeduplicateMatches(allMatches, entityName, searchLocation, context);
    }

    // Strategy 2: High similarity matches
    const fuzzyMatches = await this.findHighSimilarityMatches(entityName, searchLocation);
    allMatches.push(...fuzzyMatches);

    if (allMatches.length >= strategies.fuzzy_match_limit) {
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
      return similarity.matchType === 'exact' || similarity.score >= 0.95;
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

    for (const match of result.data) {
      const similarity = this.configurableMatching.calculateAdvancedSimilarity(
        entityName,
        match.organization_name,
        {
          searchLocation,
          entityCountries: [match.category || '']
        }
      );

      if (similarity.score >= thresholds.good_similarity) {
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
    // Remove duplicates
    const uniqueMatches = this.removeDuplicateMatches(matches.map(match => ({
      dataset_entry: {
        id: '',
        dataset_id: '',
        organization_name: match.organization_name,
        aliases: [],
        category: match.category,
        created_at: '',
        updated_at: match.last_updated || ''
      },
      dataset: {
        id: '',
        name: match.dataset_name,
        is_active: true,
        created_at: '',
        updated_at: ''
      },
      match_type: match.match_type,
      confidence_score: match.confidence_score || 0,
      quality_metrics: match.quality_metrics
    })));

    // Convert back to DatasetMatch format and re-calculate scores
    return uniqueMatches.map(candidate => {
      const enhancedSimilarity = this.configurableMatching.calculateAdvancedSimilarity(
        entityName,
        candidate.dataset_entry.organization_name,
        {
          searchLocation,
          entityCountries: candidate.dataset_entry.category ? [candidate.dataset_entry.category] : undefined
        }
      );

      return {
        dataset_name: candidate.dataset.name,
        organization_name: candidate.dataset_entry.organization_name,
        match_type: enhancedSimilarity.matchType,
        category: candidate.dataset_entry.category,
        confidence_score: enhancedSimilarity.score,
        last_updated: candidate.dataset_entry.updated_at,
        quality_metrics: {
          specificity_score: enhancedSimilarity.components.jaro_winkler || 0,
          length_ratio: enhancedSimilarity.components.levenshtein || 0,
          word_count_ratio: enhancedSimilarity.components.word_level || 0,
          match_coverage: enhancedSimilarity.score
        }
      };
    }).sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
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
   * Get enhanced service statistics
   */
  async getEnhancedServiceStats(): Promise<ServiceResponse<any>> {
    const startTime = process.hrtime();

    try {
      // Get basic stats
      const basicStats = await this.getServiceStats();

      // Add enhanced stats
      const enhancedStats = {
        ...basicStats.data,
        enhanced_features: {
          configurable_matching: this.configurableMatching.getPerformanceMetrics(),
          geographic_matching: this.geographicMatching.getGeographicStats(),
          configuration: this.configManager.getConfigurationSummary()
        },
        algorithm_version: '2.0.0-enhanced'
      };

      return {
        success: true,
        data: enhancedStats,
        metadata: {
          processing_time_ms: this.getProcessingTime(startTime),
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
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
          algorithm_version: '2.0.0-enhanced'
        }
      };
    }
  }
}