"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetMatchingService = void 0;
const SupabaseService_1 = require("./SupabaseService");
const EntityNormalization_1 = require("../algorithms/EntityNormalization");
const QualityAssessment_1 = require("../algorithms/QualityAssessment");
const ConfigurableMatching_1 = require("../algorithms/ConfigurableMatching");
const GeographicMatching_1 = require("../algorithms/GeographicMatching");
const ConfigManager_1 = require("../utils/ConfigManager");
const CountryNormalizer_1 = require("../utils/CountryNormalizer");
const ErrorHandler_1 = require("../utils/ErrorHandler");
class DatasetMatchingService {
    constructor() {
        // In-memory cache for quick lookups
        this.cache = new Map();
        this.supabaseService = SupabaseService_1.SupabaseService.getInstance();
        this.configurableMatching = ConfigurableMatching_1.ConfigurableMatching.getInstance();
        this.geographicMatching = GeographicMatching_1.GeographicMatching.getInstance();
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.countryNormalizer = CountryNormalizer_1.CountryNormalizer.getInstance();
        // Get cache expiration from config
        const cacheConfig = this.configManager.getCacheConfig();
        this.cacheExpiration = cacheConfig.default_ttl_minutes * 60 * 1000;
    }
    static getInstance() {
        if (!DatasetMatchingService.instance) {
            DatasetMatchingService.instance = new DatasetMatchingService();
        }
        return DatasetMatchingService.instance;
    }
    /**
     * Enhanced find dataset matches with geographic and configurable algorithms
     */
    async findMatchesEnhanced(entityName, searchLocation, context, options) {
        const startTime = process.hrtime();
        const opts = { forceRefresh: false, maxResults: 20, ...options };
        try {
            // Skip matching for generic or empty terms
            if (EntityNormalization_1.EntityNormalization.shouldSkipMatching(entityName)) {
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
            }
            catch (error) {
                earlyTerminationConfig = { enable: false, confidence_threshold: 0.9 };
            }
            if (earlyTerminationConfig.enable && matches.length > 0) {
                const highConfidenceMatches = matches.filter(match => match.confidence_score && match.confidence_score >= earlyTerminationConfig.confidence_threshold);
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('ENHANCED_MATCHING_ERROR', `Failed to find enhanced matches for entity "${entityName}": ${error.message}`, { entity: entityName, location: searchLocation, context });
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
    async findMatches(entityName, context, forceRefresh = false) {
        // Delegate to enhanced method for backward compatibility
        return this.findMatchesEnhanced(entityName, undefined, context, { forceRefresh });
    }
    /**
     * Legacy findMatches implementation
     */
    async findMatchesLegacy(entityName, context, forceRefresh = false) {
        const startTime = process.hrtime();
        try {
            // Skip matching for generic or empty terms
            if (EntityNormalization_1.EntityNormalization.shouldSkipMatching(entityName)) {
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
            const normalizedEntity = EntityNormalization_1.EntityNormalization.normalizeEntity(entityName);
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
            const allMatches = [];
            for (const variation of normalizedEntity.variations) {
                const result = await this.supabaseService.findDatasetMatches(variation);
                if (result.success && result.data) {
                    // Convert to match candidates with quality metrics
                    const candidates = result.data.map(match => this.createMatchCandidate(entityName, match, context));
                    allMatches.push(...candidates);
                }
            }
            // Remove duplicates based on dataset + organization name
            const uniqueMatches = this.removeDuplicateMatches(allMatches);
            // Apply quality assessment and filtering
            const qualityFilteredMatches = QualityAssessment_1.QualityAssessment.filterMatchResults(uniqueMatches.map(candidate => candidate), entityName, context);
            // Apply academic filtering if needed
            const academicFilteredMatches = QualityAssessment_1.QualityAssessment.applyAcademicFiltering(entityName, qualityFilteredMatches);
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('MATCHING_ERROR', `Failed to find matches for entity "${entityName}": ${error.message}`, { entity: entityName, context });
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
    async findMatchesBatch(entities, context, forceRefresh = false, options) {
        const startTime = process.hrtime();
        try {
            const results = {};
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
                    const result = await this.findMatchesEnhanced(entity, options?.location, context, {
                        forceRefresh,
                        searchRadius: options?.searchRadius,
                        prioritizeLocal: options?.prioritizeLocal,
                        maxResults: options?.maxResults || 20
                    });
                    if (result.success) {
                        if (result.metadata?.cache_used) {
                            cacheHits++;
                        }
                        return { entity, matches: result.data };
                    }
                    else {
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('BATCH_MATCHING_ERROR', `Failed to process batch matching: ${error.message}`, { entity_count: entities.length, context });
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
    createMatchCandidate(searchEntity, match, context) {
        // Calculate quality metrics
        const qualityMetrics = QualityAssessment_1.QualityAssessment.calculateQualityMetrics(searchEntity, match.organization_name, match.match_type, context);
        // Calculate overall confidence score
        const confidenceScore = QualityAssessment_1.QualityAssessment.calculateMatchQuality(searchEntity, match.organization_name, match.match_type, context);
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
    removeDuplicateMatches(matches) {
        const seen = new Set();
        const uniqueMatches = [];
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
     * Get cached matches if available and valid
     */
    async getCachedMatches(normalizedEntity) {
        const cached = this.cache.get(normalizedEntity);
        if (!cached)
            return null;
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
    async cacheMatches(normalizedEntity, matches) {
        try {
            // Get current version
            const versionResult = await this.supabaseService.getDatasetsVersion();
            const version = versionResult.success ? versionResult.data : Date.now().toString();
            // Clean up expired cache entries periodically
            if (this.cache.size > 100) {
                this.cleanupExpiredCache();
            }
            this.cache.set(normalizedEntity, {
                matches,
                timestamp: Date.now(),
                version
            });
        }
        catch (error) {
            console.warn('Failed to cache matches:', error);
            // Don't throw error, caching is optional
        }
    }
    /**
     * Clean up expired cache entries
     */
    cleanupExpiredCache() {
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
    async clearCache() {
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('CACHE_CLEAR_ERROR', `Failed to clear cache: ${error.message}`);
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
    async getServiceStats() {
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('STATS_ERROR', `Failed to get service statistics: ${error.message}`);
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
    getProcessingTime(startTime) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        return Math.round((seconds * 1000) + (nanoseconds / 1e6));
    }
    /**
     * Create enhanced cache key that includes location context
     */
    createEnhancedCacheKey(entityName, searchLocation, context) {
        const normalizedEntity = EntityNormalization_1.EntityNormalization.normalizeText(entityName);
        const normalizedLocation = searchLocation ? this.countryNormalizer.normalizeCountry(searchLocation)?.canonical || searchLocation : '';
        const normalizedContext = context ? EntityNormalization_1.EntityNormalization.normalizeText(context) : '';
        return `enhanced:${normalizedEntity}:${normalizedLocation}:${normalizedContext}`;
    }
    /**
     * Execute progressive search strategy
     */
    async executeProgressiveSearch(entityName, searchLocation, context, options) {
        // Get strategies with safe defaults
        const strategies = this.configManager.getQueryStrategies();
        const timeouts = this.configManager.getTimeouts();
        const allMatches = [];
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
    async findExactMatches(entityName, searchLocation) {
        const result = await this.supabaseService.findDatasetMatches(entityName, searchLocation, { prioritizeLocal: true, maxResults: 10 });
        if (!result.success || !result.data) {
            return [];
        }
        return result.data.filter(match => {
            const similarity = this.configurableMatching.calculateAdvancedSimilarity(entityName, match.organization_name, {
                searchLocation,
                entityCountries: [match.category || ''] // Using category as temporary country placeholder
            });
            return similarity.matchType === 'exact' ||
                similarity.matchType === 'core_acronym' ||
                similarity.score >= 0.95;
        });
    }
    /**
     * Find high similarity matches
     */
    async findHighSimilarityMatches(entityName, searchLocation) {
        const result = await this.supabaseService.findDatasetMatches(entityName, searchLocation, { prioritizeLocal: false, maxResults: 15 });
        if (!result.success || !result.data) {
            return [];
        }
        const matches = [];
        const thresholds = this.configManager.getSimilarityThresholds();
        // Safe access with default
        const goodSimilarityThreshold = thresholds?.good_similarity || 0.85;
        for (const match of result.data) {
            const similarity = this.configurableMatching.calculateAdvancedSimilarity(entityName, match.organization_name, {
                searchLocation,
                entityCountries: [match.category || '']
            });
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
    async findAliasMatches(entityName, searchLocation) {
        // Use geographic-aware search for alias matching
        const result = await this.supabaseService.findDatasetMatches(entityName, searchLocation, { prioritizeLocal: false, maxResults: 10 });
        if (!result.success || !result.data) {
            return [];
        }
        return result.data.filter(match => match.match_type === 'alias' || match.match_type === 'alias_partial');
    }
    /**
     * Rank and deduplicate matches using enhanced algorithms
     */
    rankAndDeduplicateMatches(matches, entityName, searchLocation, context) {
        // Simple deduplication by organization name
        const uniqueMatches = new Map();
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
    applyGeographicRanking(matches, searchLocation, options) {
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
    async warmupCache() {
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
                }
                catch (error) {
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('CACHE_WARMUP_ERROR', `Cache warmup failed: ${error.message}`);
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
    async getEnhancedServiceStats() {
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
        }
        catch (error) {
            const serviceError = (0, ErrorHandler_1.createServiceError)('ENHANCED_STATS_ERROR', `Failed to get enhanced service statistics: ${error.message}`);
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
exports.DatasetMatchingService = DatasetMatchingService;
//# sourceMappingURL=DatasetMatchingService.js.map