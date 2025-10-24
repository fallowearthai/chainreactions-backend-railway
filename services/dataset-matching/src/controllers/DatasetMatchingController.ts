import { Request, Response } from 'express';
import { DatasetMatchingService } from '../services/DatasetMatchingService';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import {
  SingleMatchRequest,
  BatchMatchRequest,
  AffiliatedMatchRequest,
  BatchAffiliatedRequest
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
   * Handle cache warmup
   * POST /api/dataset-matching/cache/warmup
   */
  handleCacheWarmup = asyncHandler(async (req: Request, res: Response) => {
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

  /**
   * Handle affiliated entity matching
   * POST /api/dataset-matching/affiliated-match
   */
  handleAffiliatedMatch = asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();

    // Validate request body
    const {
      entity,
      affiliated_companies,
      location,
      context,
      options
    } = req.body as AffiliatedMatchRequest;

    // Required validation
    validateRequired(entity, 'entity');
    validateString(entity, 'entity', 1, 500);
    validateRequired(affiliated_companies, 'affiliated_companies');
    validateArray(affiliated_companies, 'affiliated_companies', 1, 50);

    // Validate affiliated companies structure
    affiliated_companies.forEach((company, index) => {
      validateRequired(company.company_name, `affiliated_companies[${index}].company_name`);
      validateString(company.company_name, `affiliated_companies[${index}].company_name`, 1, 200);
      validateRequired(company.risk_keyword, `affiliated_companies[${index}].risk_keyword`);
      validateString(company.risk_keyword, `affiliated_companies[${index}].risk_keyword`, 1, 100);
      validateString(company.relationship_type, `affiliated_companies[${index}].relationship_type`, 1, 100);
    });

    // Optional validation
    if (location !== undefined) {
      validateString(location, 'location', 0, 200);
    }
    if (context !== undefined) {
      validateString(context, 'context', 0, 1000);
    }

    console.log(`📥 Affiliated match request for entity: ${entity} with ${affiliated_companies.length} affiliated companies`);

    const result = await this.datasetMatchingService.findAffiliatedMatches({
      entity,
      affiliated_companies,
      location,
      context,
      options
    });

    if (result.success) {
      // Enhanced logging with detailed breakdown
      const affiliatedBreakdown = result.data?.affiliated_breakdown || [];
      const matchingCompanies = affiliatedBreakdown.filter(ab => ab.has_matches).map(ab => ab.company_name);
      const nonMatchingCompanies = affiliatedBreakdown.filter(ab => !ab.has_matches).map(ab => ab.company_name);

      console.log(`✅ Affiliated match completed for ${entity}:`, {
        direct_matches: result.data?.direct_matches.length || 0,
        affiliated_matches: Object.keys(result.data?.affiliated_matches || {}).length,
        total_affiliated_entities: result.data?.match_summary.total_affiliated_entities || 0,
        matched_affiliated_entities: result.data?.match_summary.matched_affiliated_entities || 0,
        high_confidence_matches: result.data?.match_summary.high_confidence_matches || 0,
        average_confidence: result.data?.match_summary.average_confidence || 0,
        processing_time_ms: result.metadata?.processing_time_ms,
        matching_companies: matchingCompanies,
        non_matching_companies: nonMatchingCompanies,
        detailed_breakdown: affiliatedBreakdown.map(ab => ({
          company: ab.company_name,
          matches: ab.match_count,
          top_confidence: ab.top_confidence,
          risk_keyword: ab.risk_keyword
        }))
      });

      const response = {
        success: true,
        entity,
        location,
        affiliated_companies_count: affiliated_companies.length,
        ...result.data,
        metadata: {
          processing_time_ms: result.metadata?.processing_time_ms,
          affiliated_boost_applied: options?.affiliatedBoost || 1.15,
          algorithm_version: result.metadata?.algorithm_version
        }
      };

      ResponseFormatter.success(res, response);
    } else {
      console.error(`❌ Affiliated match failed for ${entity}:`, result.error?.message);
      ResponseFormatter.error(res, result.error!, 500);
    }
  });

  /**
   * Handle batch affiliated entity matching
   * POST /api/dataset-matching/batch-affiliated
   */
  handleBatchAffiliatedMatch = asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();

    // Validate request body
    const {
      entities_with_affiliated,
      global_options
    } = req.body as BatchAffiliatedRequest;

    // Required validation
    validateRequired(entities_with_affiliated, 'entities_with_affiliated');
    validateArray(entities_with_affiliated, 'entities_with_affiliated', 1, 20);

    // Validate each entity structure
    entities_with_affiliated.forEach ( (entityRequest, index) => {
      validateRequired(entityRequest.entity, `entities_with_affiliated[${index}].entity`);
      validateString(entityRequest.entity, `entities_with_affiliated[${index}].entity`, 1, 500);
      validateRequired(entityRequest.affiliated_companies, `entities_with_affiliated[${index}].affiliated_companies`);
      validateArray(entityRequest.affiliated_companies, `entities_with_affiliated[${index}].affiliated_companies`, 1, 50);

      // Validate affiliated companies structure
      entityRequest.affiliated_companies.forEach((company, companyIndex) => {
        validateRequired(company.company_name, `entities_with_affiliated[${index}].affiliated_companies[${companyIndex}].company_name`);
        validateString(company.company_name, `entities_with_affiliated[${index}].affiliated_companies[${companyIndex}].company_name`, 1, 200);
        validateRequired(company.risk_keyword, `entities_with_affiliated[${index}].affiliated_companies[${companyIndex}].risk_keyword`);
        validateString(company.risk_keyword, `entities_with_affiliated[${index}].affiliated_companies[${companyIndex}].risk_keyword`, 1, 100);
        validateString(company.relationship_type, `entities_with_affiliated[${index}].affiliated_companies[${companyIndex}].relationship_type`, 1, 100);
      });
    });

    const totalEntities = entities_with_affiliated.length;
    const totalAffiliatedCompanies = entities_with_affiliated.reduce((sum, req) => sum + req.affiliated_companies.length, 0);

    console.log(`📥 Batch affiliated match request for ${totalEntities} entities with ${totalAffiliatedCompanies} total affiliated companies`);

    const result = await this.datasetMatchingService.findBatchAffiliatedMatches({
      entities_with_affiliated,
      global_options
    });

    if (result.success && result.data) {
      const data = result.data;
      const successfulEntities = Object.keys(data).length;
      const totalDirectMatches = Object.values(data).reduce((sum, entityData) => sum + (entityData?.direct_matches.length || 0), 0);
      const totalAffiliatedMatches = Object.values(data).reduce((sum, entityData) => sum + Object.values(entityData?.affiliated_matches || {}).flat().length, 0);

      // Enhanced batch logging with affiliated breakdown
      const entityBreakdown = Object.entries(data).map(([entity, entityData]) => {
        const affiliatedBreakdown = entityData?.affiliated_breakdown || [];
        const matchingCompanies = affiliatedBreakdown.filter(ab => ab.has_matches);
        return {
          entity,
          total_affiliated: affiliatedBreakdown.length,
          matching_companies: matchingCompanies.length,
          top_matches: matchingCompanies.map(ab => ({ company: ab.company_name, confidence: ab.top_confidence }))
        };
      });

      console.log(`✅ Batch affiliated match completed:`, {
        total_entities: totalEntities,
        successful_entities: successfulEntities,
        total_direct_matches: totalDirectMatches,
        total_affiliated_matches: totalAffiliatedMatches,
        processing_time_ms: result.metadata?.processing_time_ms,
        entity_breakdown: entityBreakdown,
        total_matching_affiliated_companies: entityBreakdown.reduce((sum, eb) => sum + eb.matching_companies, 0)
      });

      const response = {
        success: true,
        batch_summary: {
          total_entities: totalEntities,
          successful_entities: successfulEntities,
          total_affiliated_companies: totalAffiliatedCompanies,
          total_direct_matches: totalDirectMatches,
          total_affiliated_matches: totalAffiliatedMatches,
          average_affiliated_entities_per_entity: Math.round((totalAffiliatedCompanies / totalEntities) * 100) / 100
        },
        results: result.data,
        metadata: {
          processing_time_ms: result.metadata?.processing_time_ms,
          affiliated_boost_applied: global_options?.affiliatedBoost || 1.15,
          algorithm_version: result.metadata?.algorithm_version
        }
      };

      ResponseFormatter.success(res, response);
    } else {
      console.error(`❌ Batch affiliated match failed:`, result.error?.message);
      ResponseFormatter.error(res, result.error!, 500);
    }
  });
}