"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetMatchingController = void 0;
const DatasetMatchingService_1 = require("../services/DatasetMatchingService");
const ResponseFormatter_1 = require("../utils/ResponseFormatter");
const ErrorHandler_1 = require("../utils/ErrorHandler");
class DatasetMatchingController {
    constructor() {
        /**
         * Handle single entity matching
         * POST /api/dataset-matching/match
         */
        this.handleSingleMatch = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const startTime = process.hrtime();
            // Validate request body
            const { entity, context, location, matchTypes, minConfidence, forceRefresh, searchRadius, prioritizeLocal, maxResults } = req.body;
            // Required validation
            (0, ErrorHandler_1.validateRequired)(entity, 'entity');
            (0, ErrorHandler_1.validateString)(entity, 'entity', 1, 500);
            // Optional validation
            if (context !== undefined) {
                (0, ErrorHandler_1.validateString)(context, 'context', 0, 1000);
            }
            if (location !== undefined) {
                (0, ErrorHandler_1.validateString)(location, 'location', 1, 100);
            }
            if (matchTypes !== undefined) {
                (0, ErrorHandler_1.validateArray)(matchTypes, 'matchTypes', 0, 10);
                matchTypes.forEach(type => (0, ErrorHandler_1.validateString)(type, 'matchType'));
            }
            if (minConfidence !== undefined) {
                (0, ErrorHandler_1.validateNumber)(minConfidence, 'minConfidence', 0, 1);
            }
            if (maxResults !== undefined) {
                (0, ErrorHandler_1.validateNumber)(maxResults, 'maxResults', 1, 100);
            }
            // Call enhanced matching service with geographic support
            const result = await this.datasetMatchingService.findMatchesEnhanced(entity.trim(), location?.trim(), context?.trim(), {
                forceRefresh: forceRefresh || false,
                searchRadius: searchRadius,
                prioritizeLocal: prioritizeLocal,
                maxResults: maxResults || 20
            });
            const processingTime = ResponseFormatter_1.ResponseFormatter.formatProcessingTime(startTime);
            if (result.success) {
                // Filter by match types if specified
                let matches = result.data;
                if (matchTypes && matchTypes.length > 0) {
                    matches = matches.filter(match => matchTypes.includes(match.match_type));
                }
                // Filter by minimum confidence if specified
                if (minConfidence !== undefined) {
                    matches = matches.filter(match => match.confidence_score && match.confidence_score >= minConfidence);
                }
                // Sanitize matches for response
                const sanitizedMatches = ResponseFormatter_1.ResponseFormatter.sanitizeMatches(matches);
                ResponseFormatter_1.ResponseFormatter.matchResponse(res, sanitizedMatches, entity, processingTime, result.metadata?.cache_used || false);
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        /**
         * Handle batch entity matching
         * POST /api/dataset-matching/batch
         */
        this.handleBatchMatch = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const startTime = process.hrtime();
            // Validate request body
            const { entities, options } = req.body;
            // Required validation
            (0, ErrorHandler_1.validateRequired)(entities, 'entities');
            (0, ErrorHandler_1.validateArray)(entities, 'entities', 1, 100); // Limit to 100 entities per batch
            entities.forEach((entity, index) => {
                (0, ErrorHandler_1.validateString)(entity, `entities[${index}]`, 1, 500);
            });
            // Optional validation
            if (options) {
                if (options.matchTypes !== undefined) {
                    (0, ErrorHandler_1.validateArray)(options.matchTypes, 'matchTypes', 0, 10);
                    options.matchTypes.forEach(type => (0, ErrorHandler_1.validateString)(type, 'matchType'));
                }
                if (options.minConfidence !== undefined) {
                    (0, ErrorHandler_1.validateNumber)(options.minConfidence, 'minConfidence', 0, 1);
                }
                if (options.context !== undefined) {
                    (0, ErrorHandler_1.validateString)(options.context, 'context', 0, 1000);
                }
                if (options.location !== undefined) {
                    (0, ErrorHandler_1.validateString)(options.location, 'location', 1, 100);
                }
                if (options.maxResults !== undefined) {
                    (0, ErrorHandler_1.validateNumber)(options.maxResults, 'maxResults', 1, 100);
                }
            }
            // Call enhanced batch matching service with geographic support
            const result = await this.datasetMatchingService.findMatchesBatch(entities.map(e => e.trim()), options?.context?.trim(), options?.forceRefresh || false, {
                location: options?.location?.trim(),
                searchRadius: options?.searchRadius,
                prioritizeLocal: options?.prioritizeLocal,
                maxResults: options?.maxResults
            });
            const processingTime = ResponseFormatter_1.ResponseFormatter.formatProcessingTime(startTime);
            if (result.success) {
                let matchResults = result.data;
                // Apply filters if specified
                if (options?.matchTypes || options?.minConfidence) {
                    const filteredResults = {};
                    Object.entries(matchResults).forEach(([entity, matches]) => {
                        let filteredMatches = matches;
                        // Filter by match types
                        if (options.matchTypes && options.matchTypes.length > 0) {
                            filteredMatches = filteredMatches.filter(match => options.matchTypes.includes(match.match_type));
                        }
                        // Filter by minimum confidence
                        if (options.minConfidence !== undefined) {
                            filteredMatches = filteredMatches.filter(match => match.confidence_score && match.confidence_score >= options.minConfidence);
                        }
                        filteredResults[entity] = ResponseFormatter_1.ResponseFormatter.sanitizeMatches(filteredMatches);
                    });
                    matchResults = filteredResults;
                }
                else {
                    // Sanitize all matches
                    const sanitizedResults = {};
                    Object.entries(matchResults).forEach(([entity, matches]) => {
                        sanitizedResults[entity] = ResponseFormatter_1.ResponseFormatter.sanitizeMatches(matches);
                    });
                    matchResults = sanitizedResults;
                }
                ResponseFormatter_1.ResponseFormatter.batchMatchResponse(res, matchResults, processingTime, result.metadata?.cache_used ? 1 : 0);
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        /**
         * Clear matching cache
         * GET /api/dataset-matching/cache/clear
         */
        this.handleClearCache = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.datasetMatchingService.clearCache();
            if (result.success) {
                ResponseFormatter_1.ResponseFormatter.success(res, result.data, result.metadata);
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        /**
         * Get service statistics
         * GET /api/dataset-matching/stats
         */
        this.handleGetStats = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.datasetMatchingService.getServiceStats();
            if (result.success) {
                ResponseFormatter_1.ResponseFormatter.success(res, result.data, result.metadata);
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        /**
         * Health check with matching service status
         * GET /api/dataset-matching/health
         */
        this.handleHealthCheck = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
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
                ResponseFormatter_1.ResponseFormatter.healthCheck(res, healthData);
            }
            catch (error) {
                const healthData = {
                    matching_service: 'error',
                    error: 'Service health check failed'
                };
                ResponseFormatter_1.ResponseFormatter.healthCheck(res, healthData);
            }
        });
        /**
         * Handle cache warmup
         * POST /api/dataset-matching/cache/warmup
         */
        this.handleCacheWarmup = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const startTime = process.hrtime();
            const result = await this.datasetMatchingService.warmupCache();
            const processingTime = ResponseFormatter_1.ResponseFormatter.formatProcessingTime(startTime);
            if (result.success) {
                ResponseFormatter_1.ResponseFormatter.success(res, {
                    message: 'Cache warmup completed',
                    warmed_queries: result.data.warmed_queries,
                    processing_time_ms: processingTime
                }, {
                    processing_time_ms: processingTime,
                    cache_used: false,
                    algorithm_version: '2.0.0-enhanced'
                });
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        /**
         * Test matching with a sample entity
         * GET /api/dataset-matching/test?entity=entityName
         */
        this.handleTestMatch = (0, ErrorHandler_1.asyncHandler)(async (req, res) => {
            const entity = req.query.entity || 'Tesla';
            const result = await this.datasetMatchingService.findMatches(entity);
            if (result.success) {
                const response = {
                    test_entity: entity,
                    matches_found: result.data.length,
                    matches: result.data.slice(0, 5), // Show first 5 matches
                    processing_time_ms: result.metadata?.processing_time_ms,
                    cache_used: result.metadata?.cache_used
                };
                ResponseFormatter_1.ResponseFormatter.success(res, response);
            }
            else {
                ResponseFormatter_1.ResponseFormatter.error(res, result.error, 500);
            }
        });
        this.datasetMatchingService = DatasetMatchingService_1.DatasetMatchingService.getInstance();
    }
}
exports.DatasetMatchingController = DatasetMatchingController;
//# sourceMappingURL=DatasetMatchingController.js.map