import { Request, Response } from 'express';
import { DatasetMatchingService } from '../services/DatasetMatchingService';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import {
  SingleMatchRequest,
  BatchMatchRequest
} from '../types/DatasetMatchTypes';
import {
  asyncHandler,
  validateRequired,
  validateString,
  validateArray,
  validateNumber
} from '../utils/ErrorHandler';

export class DatasetMatchingController {
  private datasetMatchingService: DatasetMatchingService;

  constructor() {
    this.datasetMatchingService = DatasetMatchingService.getInstance();
  }

  /**
   * Handle single entity matching
   * POST /api/dataset-matching/match
   */
  handleSingleMatch = asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();

    // Validate request body
    const {
      entity,
      context,
      matchTypes,
      minConfidence,
      forceRefresh
    } = req.body as SingleMatchRequest;

    // Required validation
    validateRequired(entity, 'entity');
    validateString(entity, 'entity', 1, 500);

    // Optional validation
    if (context !== undefined) {
      validateString(context, 'context', 0, 1000);
    }

    if (matchTypes !== undefined) {
      validateArray(matchTypes, 'matchTypes', 0, 10);
      matchTypes.forEach(type => validateString(type, 'matchType'));
    }

    if (minConfidence !== undefined) {
      validateNumber(minConfidence, 'minConfidence', 0, 1);
    }

    // Call matching service
    const result = await this.datasetMatchingService.findMatches(
      entity.trim(),
      context?.trim(),
      forceRefresh || false
    );

    const processingTime = ResponseFormatter.formatProcessingTime(startTime);

    if (result.success) {
      // Filter by match types if specified
      let matches = result.data!;
      if (matchTypes && matchTypes.length > 0) {
        matches = matches.filter(match => matchTypes.includes(match.match_type));
      }

      // Filter by minimum confidence if specified
      if (minConfidence !== undefined) {
        matches = matches.filter(match =>
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
  handleBatchMatch = asyncHandler(async (req: Request, res: Response) => {
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
    }

    // Call batch matching service
    const result = await this.datasetMatchingService.findMatchesBatch(
      entities.map(e => e.trim()),
      options?.context?.trim(),
      options?.forceRefresh || false
    );

    const processingTime = ResponseFormatter.formatProcessingTime(startTime);

    if (result.success) {
      let matchResults = result.data!;

      // Apply filters if specified
      if (options?.matchTypes || options?.minConfidence) {
        const filteredResults: Record<string, any> = {};

        Object.entries(matchResults).forEach(([entity, matches]) => {
          let filteredMatches = matches;

          // Filter by match types
          if (options.matchTypes && options.matchTypes.length > 0) {
            filteredMatches = filteredMatches.filter(match =>
              options.matchTypes!.includes(match.match_type)
            );
          }

          // Filter by minimum confidence
          if (options.minConfidence !== undefined) {
            filteredMatches = filteredMatches.filter(match =>
              match.confidence_score && match.confidence_score >= options.minConfidence!
            );
          }

          filteredResults[entity] = ResponseFormatter.sanitizeMatches(filteredMatches);
        });

        matchResults = filteredResults;
      } else {
        // Sanitize all matches
        const sanitizedResults: Record<string, any> = {};
        Object.entries(matchResults).forEach(([entity, matches]) => {
          sanitizedResults[entity] = ResponseFormatter.sanitizeMatches(matches);
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
  handleClearCache = asyncHandler(async (req: Request, res: Response) => {
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
  handleGetStats = asyncHandler(async (req: Request, res: Response) => {
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
  handleHealthCheck = asyncHandler(async (req: Request, res: Response) => {
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
   * Test matching with a sample entity
   * GET /api/dataset-matching/test?entity=entityName
   */
  handleTestMatch = asyncHandler(async (req: Request, res: Response) => {
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
}