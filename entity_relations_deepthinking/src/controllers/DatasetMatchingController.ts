import { Request, Response, NextFunction } from 'express';
import { DatasetMatchingService } from '../services/dataset-matching/src/services/DatasetMatchingService';
import { ResponseFormatter } from '../services/dataset-matching/src/utils/ResponseFormatter';
import {
  SingleMatchRequest,
  BatchMatchRequest,
  DatasetMatch
} from '../services/dataset-matching/src/types/DatasetMatchTypes';
import {
  asyncHandler,
  validateRequired,
  validateString,
  validateArray,
  validateNumber
} from '../services/dataset-matching/src/utils/ErrorHandler';

export class DatasetMatchingController {
  private datasetMatchingService: DatasetMatchingService;

  constructor() {
    this.datasetMatchingService = DatasetMatchingService.getInstance();
  }

  /**
   * Handle single entity matching
   * POST /api/dataset-matching/match
   */
  handleSingleMatch = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();

    // Validate request body
    const {
      entity,
      context,
      location,
      matchTypes,
      minConfidence,
      forceRefresh,
      searchRadius,
      prioritizeLocal,
      maxResults
    } = req.body as SingleMatchRequest;

    // Required validation
    validateRequired(entity, 'entity');
    validateString(entity, 'entity', 1, 500);

    // Optional validation
    if (context !== undefined) {
      validateString(context, 'context', 0, 1000);
    }

    if (location !== undefined) {
      validateString(location, 'location', 1, 100);
    }

    if (matchTypes !== undefined) {
      validateArray(matchTypes, 'matchTypes', 0, 10);
      matchTypes.forEach(type => validateString(type, 'matchType'));
    }

    if (minConfidence !== undefined) {
      validateNumber(minConfidence, 'minConfidence', 0, 1);
    }

    if (maxResults !== undefined) {
      validateNumber(maxResults, 'maxResults', 1, 100);
    }

    // Call enhanced matching service with geographic support
    const result = await this.datasetMatchingService.findMatchesEnhanced(
      entity.trim(),
      location?.trim(),
      context?.trim(),
      {
        forceRefresh: forceRefresh || false,
        searchRadius: searchRadius,
        prioritizeLocal: prioritizeLocal,
        maxResults: maxResults || 20
      }
    );

    const processingTime = ResponseFormatter.formatProcessingTime(startTime);

    if (result.success) {
      // Filter by match types if specified
      let matches = result.data!;
      if (matchTypes && matchTypes.length > 0) {
        matches = matches.filter((match: DatasetMatch) => matchTypes.includes(match.match_type));
      }

      // Filter by minimum confidence if specified
      if (minConfidence !== undefined) {
        matches = matches.filter((match: DatasetMatch) =>
          match.confidence_score && match.confidence_score >= minConfidence
        );
      }

      // Sanitize matches for response
      const sanitizedMatches = ResponseFormatter.sanitizeMatches(matches);

      ResponseFormatter.matchResponse(
        res,
        sanitizedMatches,
        entity,
        processingTime,
        result.metadata?.cache_used || false
      );
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Handle batch entity matching
   * POST /api/dataset-matching/batch
   */
  handleBatchMatch = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();

    // Validate request body
    const { entities, options } = req.body as BatchMatchRequest;

    // Required validation
    validateRequired(entities, 'entities');
    validateArray(entities, 'entities', 1, 100); // Limit to 100 entities per batch

    entities.forEach((entity, index) => {
      validateString(entity, `entities[${index}]`, 1, 500);
    });

    // Optional validation
    if (options) {
      if (options.matchTypes !== undefined) {
        validateArray(options.matchTypes, 'matchTypes', 0, 10);
        options.matchTypes.forEach(type => validateString(type, 'matchType'));
      }

      if (options.minConfidence !== undefined) {
        validateNumber(options.minConfidence, 'minConfidence', 0, 1);
      }

      if (options.context !== undefined) {
        validateString(options.context, 'context', 0, 1000);
      }

      if (options.location !== undefined) {
        validateString(options.location, 'location', 1, 100);
      }

      if (options.maxResults !== undefined) {
        validateNumber(options.maxResults, 'maxResults', 1, 100);
      }
    }

    // Call enhanced batch matching service with geographic support
    const result = await this.datasetMatchingService.findMatchesBatch(
      entities.map(e => e.trim()),
      options?.context?.trim(),
      options?.forceRefresh || false,
      {
        location: options?.location?.trim(),
        searchRadius: options?.searchRadius,
        prioritizeLocal: options?.prioritizeLocal,
        maxResults: options?.maxResults
      }
    );

    const processingTime = ResponseFormatter.formatProcessingTime(startTime);

    if (result.success) {
      let matchResults = result.data!;

      // Apply filters if specified
      if (options?.matchTypes || options?.minConfidence) {
        const filteredResults: Record<string, any> = {};

        Object.entries(matchResults).forEach(([entity, matches]) => {
          let filteredMatches = matches as DatasetMatch[];

          // Filter by match types
          if (options.matchTypes && options.matchTypes.length > 0) {
            filteredMatches = filteredMatches.filter((match: DatasetMatch) =>
              options.matchTypes!.includes(match.match_type)
            );
          }

          // Filter by minimum confidence
          if (options.minConfidence !== undefined) {
            filteredMatches = filteredMatches.filter((match: DatasetMatch) =>
              match.confidence_score && match.confidence_score >= options.minConfidence!
            );
          }

          filteredResults[entity] = ResponseFormatter.sanitizeMatches(filteredMatches as DatasetMatch[]);
        });

        matchResults = filteredResults;
      } else {
        // Sanitize all matches
        const sanitizedResults: Record<string, any> = {};
        Object.entries(matchResults).forEach(([entity, matches]) => {
          sanitizedResults[entity] = ResponseFormatter.sanitizeMatches(matches as DatasetMatch[]);
        });
        matchResults = sanitizedResults;
      }

      ResponseFormatter.batchMatchResponse(
        res,
        matchResults,
        processingTime,
        result.metadata?.cache_used ? 1 : 0
      );
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Clear matching cache
   * GET /api/dataset-matching/cache/clear
   */
  handleClearCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await this.datasetMatchingService.clearCache();

    if (result.success) {
      ResponseFormatter.success(res, result.data, result.metadata);
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Get service statistics
   * GET /api/dataset-matching/stats
   */
  handleGetStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await this.datasetMatchingService.getServiceStats();

    if (result.success) {
      ResponseFormatter.success(res, result.data, result.metadata);
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Health check with matching service status
   * GET /api/dataset-matching/health
   */
  handleHealthCheck = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Test basic matching functionality
      const testResult = await this.datasetMatchingService.findMatches('test entity');

      const healthData = {
        matching_service: testResult.success ? 'operational' : 'degraded',
        cache_size: testResult.metadata?.cache_used !== undefined ? 'available' : 'unknown',
        database_connection: 'operational',
        algorithms: {
          text_matching: 'operational',
          quality_assessment: 'operational',
          entity_normalization: 'operational'
        }
      };

      ResponseFormatter.healthCheck(res, healthData);
    } catch (error) {
      const healthData = {
        matching_service: 'error',
        error: 'Service health check failed'
      };

      ResponseFormatter.healthCheck(res, healthData);
    }
  });

  /**
   * Handle cache warmup
   * POST /api/dataset-matching/cache/warmup
   */
  handleCacheWarmup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();

    const result = await this.datasetMatchingService.warmupCache();
    const processingTime = ResponseFormatter.formatProcessingTime(startTime);

    if (result.success) {
      ResponseFormatter.success(
        res,
        {
          message: 'Cache warmup completed',
          warmed_queries: result.data!.warmed_queries,
          processing_time_ms: processingTime
        },
        {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '2.0.0-enhanced'
        }
      );
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Test matching with a sample entity
   * GET /api/dataset-matching/test?entity=entityName
   */
  handleTestMatch = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const entity = req.query.entity as string || 'Tesla';

    const result = await this.datasetMatchingService.findMatches(entity);

    if (result.success) {
      const response = {
        test_entity: entity,
        matches_found: result.data!.length,
        matches: result.data!.slice(0, 5), // Show first 5 matches
        processing_time_ms: result.metadata?.processing_time_ms,
        cache_used: result.metadata?.cache_used
      };

      ResponseFormatter.success(res, response);
    } else {
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  // Health check method for unified gateway
  async healthCheck(): Promise<{ status: string; configured: boolean; details: any }> {
    let details: any = {};
    let configured = true;

    try {
      // Check if Supabase is configured
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        details.supabase = 'configured';

        // Test connection
        const testResult = await this.datasetMatchingService.findMatches('test');
        details.service_connection = testResult.success ? 'operational' : 'failed';

        if (!testResult.success) {
          details.service_error = testResult.error;
        }
      } else {
        details.supabase = 'not configured';
        configured = false;
      }

      // Check Redis configuration
      if (process.env.REDIS_URL) {
        details.redis = 'configured';
      } else {
        details.redis = 'not configured';
      }

      return {
        status: configured && details.service_connection === 'operational' ? 'operational' : 'degraded',
        configured,
        details
      };
    } catch (error: any) {
      return {
        status: 'error',
        configured: false,
        details: { error: error.message }
      };
    }
  }
}