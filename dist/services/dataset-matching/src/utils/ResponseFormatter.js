"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseFormatter = void 0;
class ResponseFormatter {
    static success(res, data, metadata, statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            data,
            metadata,
            timestamp: new Date().toISOString()
        });
    }
    static error(res, error, statusCode = 500) {
        const errorObj = typeof error === 'string'
            ? {
                code: 'INTERNAL_ERROR',
                message: error,
                timestamp: new Date().toISOString()
            }
            : error;
        return res.status(statusCode).json({
            success: false,
            error: errorObj,
            timestamp: new Date().toISOString()
        });
    }
    static matchResponse(res, matches, searchEntity, processingTimeMs, cacheHit = false, statusCode = 200) {
        const response = {
            success: true,
            data: matches,
            metadata: {
                total_matches: matches.length,
                processing_time_ms: processingTimeMs,
                cache_hit: cacheHit,
                search_entity: searchEntity
            }
        };
        return res.status(statusCode).json(response);
    }
    static batchMatchResponse(res, matchResults, processingTimeMs, cacheHits = 0, failedEntities = [], statusCode = 200) {
        const totalMatches = Object.values(matchResults)
            .reduce((sum, matches) => sum + matches.length, 0);
        const response = {
            success: true,
            data: matchResults,
            metadata: {
                total_entities: Object.keys(matchResults).length,
                total_matches: totalMatches,
                processing_time_ms: processingTimeMs,
                cache_hits: cacheHits,
                failed_entities: failedEntities
            }
        };
        return res.status(statusCode).json(response);
    }
    static healthCheck(res, additionalData) {
        return res.status(200).json({
            status: 'healthy',
            service: 'Dataset Matching Service',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            ...additionalData
        });
    }
    static serviceInfo(res) {
        return res.status(200).json({
            service: 'Dataset Matching Service',
            version: '1.0.0',
            description: 'Enhanced Entity Matching with AI-powered algorithms',
            endpoints: [
                'GET /api - Service information',
                'GET /api/health - Health check',
                'POST /api/dataset-matching/match - Single entity matching',
                'POST /api/dataset-matching/batch - Batch entity matching',
                'GET /api/dataset-matching/cache/clear - Clear cache',
                'GET /api/test-supabase - Test database connection'
            ],
            status: 'running',
            timestamp: new Date().toISOString(),
            algorithms: [
                'Exact matching',
                'Alias matching',
                'Fuzzy matching (Levenshtein, Jaro-Winkler)',
                'Semantic matching',
                'Quality assessment',
                'Context-aware scoring'
            ],
            features: [
                'Multi-level caching',
                'Batch processing',
                'Quality scoring',
                'Real-time matching',
                'Multi-language support'
            ]
        });
    }
    static validationError(res, message, field) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message,
                field,
                timestamp: new Date().toISOString()
            }
        });
    }
    static notFound(res, resource = 'Resource') {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `${resource} not found`,
                timestamp: new Date().toISOString()
            }
        });
    }
    static serviceUnavailable(res, service) {
        return res.status(503).json({
            success: false,
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: `${service} is temporarily unavailable`,
                timestamp: new Date().toISOString()
            }
        });
    }
    static tooManyRequests(res, retryAfter) {
        if (retryAfter) {
            res.set('Retry-After', retryAfter.toString());
        }
        return res.status(429).json({
            success: false,
            error: {
                code: 'TOO_MANY_REQUESTS',
                message: 'Rate limit exceeded. Please try again later.',
                retry_after: retryAfter,
                timestamp: new Date().toISOString()
            }
        });
    }
    // Helper method to format processing time
    static formatProcessingTime(startTime) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        return Math.round((seconds * 1000) + (nanoseconds / 1e6));
    }
    // Helper method to sanitize matches for response
    static sanitizeMatches(matches) {
        return matches.map(match => ({
            ...match,
            // Round confidence scores to 3 decimal places
            confidence_score: match.confidence_score ?
                Math.round(match.confidence_score * 1000) / 1000 : undefined,
            // Ensure quality metrics are properly formatted
            quality_metrics: match.quality_metrics ? {
                ...match.quality_metrics,
                specificity_score: Math.round(match.quality_metrics.specificity_score * 1000) / 1000,
                length_ratio: Math.round(match.quality_metrics.length_ratio * 1000) / 1000,
                word_count_ratio: Math.round(match.quality_metrics.word_count_ratio * 1000) / 1000,
                match_coverage: Math.round(match.quality_metrics.match_coverage * 1000) / 1000,
                context_relevance: match.quality_metrics.context_relevance ?
                    Math.round(match.quality_metrics.context_relevance * 1000) / 1000 : undefined
            } : undefined
        }));
    }
}
exports.ResponseFormatter = ResponseFormatter;
//# sourceMappingURL=ResponseFormatter.js.map