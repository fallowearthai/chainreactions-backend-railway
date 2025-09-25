import { SupabaseService } from './SupabaseService';
import { EntityNormalization } from '../algorithms/EntityNormalization';
import { TextMatching } from '../algorithms/TextMatching';
import { QualityAssessment } from '../algorithms/QualityAssessment';
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

  // In-memory cache for quick lookups
  private cache = new Map<string, { matches: DatasetMatch[]; timestamp: number; version: string }>();
  private readonly CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
  }

  public static getInstance(): DatasetMatchingService {
    if (!DatasetMatchingService.instance) {
      DatasetMatchingService.instance = new DatasetMatchingService();
    }
    return DatasetMatchingService.instance;
  }

  /**
   * Find dataset matches for a single entity
   */
  async findMatches(
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
   * Find matches for multiple entities in batch
   */
  async findMatchesBatch(
    entities: string[],
    context?: string,
    forceRefresh: boolean = false
  ): Promise<ServiceResponse<Record<string, DatasetMatch[]>>> {
    const startTime = process.hrtime();

    try {
      const results: Record<string, DatasetMatch[]> = {};
      let cacheHits = 0;

      // Process in smaller batches to avoid overwhelming the system
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < entities.length; i += batchSize) {
        batches.push(entities.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (entity, index) => {
          // Add small delay to prevent overwhelming the database
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          const result = await this.findMatches(entity, context, forceRefresh);

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
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRATION_MS) {
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
      if (now - entry.timestamp > this.CACHE_EXPIRATION_MS) {
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
          expiration_ms: this.CACHE_EXPIRATION_MS
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
}