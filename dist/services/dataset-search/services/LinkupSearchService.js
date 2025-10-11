"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkupSearchService = void 0;
const axios_1 = __importDefault(require("axios"));
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
class LinkupSearchService {
    constructor() {
        this.activeCalls = new Set();
        this.apiKeys = [
            process.env.LINKUP_API_KEY || '',
            process.env.LINKUP_API_KEY_2 || ''
        ].filter(key => key.length > 0);
        this.apiUrl = process.env.LINKUP_API_URL || 'https://api.linkup.so/v1/search';
        if (this.apiKeys.length === 0) {
            throw new DatasetSearchTypes_1.DatasetSearchError('At least one LINKUP_API_KEY environment variable is required', 'MISSING_API_KEY', 500);
        }
        console.log(`🔗 LinkupSearchService initialized with ${this.apiKeys.length} API keys for parallel processing`);
        // Initialize rate limiters for each API key: 10 queries per second with burst capacity
        this.rateLimiters = this.apiKeys.map(() => ({
            tokens: 10,
            lastRefill: Date.now(),
            tokensPerSecond: 10,
            maxTokens: 10
        }));
    }
    /**
     * Refill rate limiter tokens based on elapsed time
     */
    refillTokens(apiIndex) {
        const now = Date.now();
        const elapsed = (now - this.rateLimiters[apiIndex].lastRefill) / 1000;
        if (elapsed > 0) {
            const tokensToAdd = elapsed * this.rateLimiters[apiIndex].tokensPerSecond;
            this.rateLimiters[apiIndex].tokens = Math.min(this.rateLimiters[apiIndex].maxTokens, this.rateLimiters[apiIndex].tokens + tokensToAdd);
            this.rateLimiters[apiIndex].lastRefill = now;
        }
    }
    /**
     * Wait for available rate limit token for specific API
     */
    async waitForToken(apiIndex) {
        this.refillTokens(apiIndex);
        if (this.rateLimiters[apiIndex].tokens >= 1) {
            this.rateLimiters[apiIndex].tokens -= 1;
            return;
        }
        // Calculate wait time for next token
        const waitMs = (1 / this.rateLimiters[apiIndex].tokensPerSecond) * 1000;
        await this.delay(waitMs);
        return this.waitForToken(apiIndex);
    }
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get default exclude domains for higher quality results
     */
    getDefaultExcludeDomains() {
        // Conservative list of low-quality domains to exclude
        // (Based on entity_search service configuration)
        return [
            'wikipedia.org',
            'reddit.com',
            'quora.com',
            'pinterest.com'
        ];
    }
    /**
     * Build the OSINT prompt for relationship analysis
     */
    buildOSINTPrompt(institutionA, riskEntity, country) {
        return `You are a skilled Research Security Analyst specializing in open-source intelligence (OSINT) investigations. Your assignment is to systematically identify and document institutional connections between Institution A and Risk Item C.

Goal: For entity in Risk Item C, determine the existence and nature of any relationship with Institution A, focusing on both direct (e.g., formal collaborations, joint research, funding) and indirect (e.g., via intermediary organizations) connections, as well as notable co-mentions in risk or security-related contexts.

Scope: Conduct comprehensive web searches across authoritative sources, including official institutional websites, reputable news outlets, academic publications, and government reports. Search in both English and the primary language(s) of the entity's country (e.g., Chinese for China-based entities). Prioritize official and high-credibility sources.

Criteria/Method: For each entity in Risk Item C:
- Formulate targeted search queries combining Institution A and the risk item name.
- Identify and classify the relationship as one of: 'Direct', 'Indirect', 'Significant Mention', 'Unknown', or 'No Evidence Found'.
- For 'Direct', 'Indirect', or 'Significant Mention', provide a concise summary of findings and list any intermediary organizations involved.
- Always include source URLs for verification.
- Ensure findings are supported by both English and local-language sources where available.

Format: Return a JSON array, where each object contains: risk_item, relationship_type, finding_summary (if applicable, always in English), intermediary_organizations (if any), and source_urls.

User Query: Investigate and report on the relationship between '${institutionA}' (Institution A) and '${riskEntity}' (Risk Item C, location: ${country}) using the above methodology. Return your findings in the specified JSON format.`;
    }
    /**
     * Perform single Linkup API search with enhanced retry logic
     */
    async performSingleSearch(institutionA, riskEntity, country, apiIndex = 0, signal, fromDate, toDate, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.attemptSearch(institutionA, riskEntity, country, apiIndex, signal, fromDate, toDate, attempt);
            }
            catch (error) {
                lastError = error;
                // Don't retry if the operation was cancelled
                if (signal?.aborted) {
                    throw new DatasetSearchTypes_1.DatasetSearchError('Search was cancelled', 'SEARCH_CANCELLED', 499);
                }
                // Don't retry for certain error types
                if (this.isNonRetryableError(error)) {
                    throw error;
                }
                // For the last attempt, throw the error
                if (attempt === maxRetries) {
                    console.error(`❌ API ${apiIndex + 1} failed after ${maxRetries + 1} attempts:`, error.message);
                    throw error;
                }
                // Calculate retry delay with exponential backoff
                const retryDelay = this.calculateRetryDelay(attempt, error);
                console.warn(`⚠️ API ${apiIndex + 1} attempt ${attempt + 1} failed, retrying in ${retryDelay}ms:`, error.message);
                // Wait before retry
                await this.delay(retryDelay);
            }
        }
        // This should never be reached, but TypeScript requires it
        throw lastError || new DatasetSearchTypes_1.DatasetSearchError('Unknown error occurred', 'UNKNOWN_ERROR', 500);
    }
    /**
     * Attempt a single search without retry logic
     */
    async attemptSearch(institutionA, riskEntity, country, apiIndex, signal, fromDate, toDate, attempt = 0) {
        const prompt = this.buildOSINTPrompt(institutionA, riskEntity, country);
        // Debug: Log the exact prompt being sent to API (only on first attempt to reduce noise)
        if (attempt === 0) {
            console.log(`🔍 API ${apiIndex + 1} sending prompt to Linkup API:`);
            console.log(`--- START PROMPT ---`);
            console.log(prompt);
            console.log(`--- END PROMPT ---`);
            console.log(`Variables: institutionA="${institutionA}", riskEntity="${riskEntity}", country="${country}"`);
        }
        // Rate limiting removed: Concurrent pool architecture provides natural rate limiting
        // Each pool processes entities sequentially, eliminating need for additional delays
        // await this.waitForToken(apiIndex);
        // Get default exclude domains for higher quality results
        const excludeDomains = this.getDefaultExcludeDomains();
        const requestData = {
            q: prompt,
            depth: "standard", // Changed from "deep" to "standard" for better performance
            outputType: "sourcedAnswer",
            includeImages: "false",
            includeInlineCitations: false,
            excludeDomains: excludeDomains
        };
        // Add optional date range if provided
        if (fromDate) {
            requestData.fromDate = fromDate;
            if (attempt === 0)
                console.log(`📅 Adding fromDate: ${fromDate}`);
        }
        if (toDate) {
            requestData.toDate = toDate;
            if (attempt === 0)
                console.log(`📅 Adding toDate: ${toDate}`);
        }
        const response = await axios_1.default.post(this.apiUrl, requestData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKeys[apiIndex]}`
            },
            timeout: 120000, // 120 second (2 minute) timeout
            signal
        });
        if (!response.data || typeof response.data.answer !== 'string') {
            throw new DatasetSearchTypes_1.DatasetSearchError(`Invalid response format from Linkup API`, 'INVALID_API_RESPONSE', 502);
        }
        // Log successful attempts (only for retries to reduce noise)
        if (attempt > 0) {
            console.log(`✅ API ${apiIndex + 1} attempt ${attempt + 1} succeeded`);
        }
        return response.data;
    }
    /**
     * Check if an error should not be retried
     */
    isNonRetryableError(error) {
        // Authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
            return true;
        }
        // Not found errors
        if (error.response?.status === 404) {
            return true;
        }
        // Bad request errors (client error)
        if (error.response?.status >= 400 && error.response?.status < 500) {
            return error.response?.status !== 429; // Only retry 429 (rate limit)
        }
        // Network timeout with specific message
        if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
            // Retry timeouts as they might be temporary
            return false;
        }
        return false;
    }
    /**
     * Calculate retry delay with exponential backoff and jitter
     */
    calculateRetryDelay(attempt, error) {
        // Base delay: 1 second, 2 seconds, 4 seconds, 8 seconds...
        let baseDelay = Math.pow(2, attempt) * 1000;
        // Add jitter to prevent thundering herd (±25% random variation)
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        baseDelay += jitter;
        // Special handling for rate limiting (429)
        if (error.response?.status === 429) {
            // Use longer base delay for rate limiting
            baseDelay = Math.max(baseDelay, 5000); // Minimum 5 seconds for rate limits
            console.log(`🚦 Rate limit detected on API, using extended delay: ${Math.round(baseDelay)}ms`);
        }
        // Cap the maximum delay to 30 seconds
        return Math.min(baseDelay, 30000);
    }
    /**
     * Search for relationships between institution and multiple risk entities with true concurrent pools
     * Uses separate sequential pools per API key for predictable, stable performance
     */
    async searchInstitutionRelationships(institutionName, institutionCountry, riskEntities, options = {}, signal, onProgress) {
        const { maxConcurrent = 2, timeoutMs = 900000, // 15 minutes
        retryAttempts = 3, retryDelayMs = 1000, fromDate, toDate } = options;
        // Create timeout signal
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        // Combine external signal with timeout signal
        const combinedSignal = signal || timeoutController.signal;
        try {
            console.log(`🚀 Starting TRUE CONCURRENT POOL search with ${this.apiKeys.length} APIs for ${riskEntities.length} entities`);
            // Distribute entities across API pools
            const pools = Array.from({ length: this.apiKeys.length }, () => []);
            riskEntities.forEach((entity, index) => {
                const poolIndex = index % this.apiKeys.length;
                pools[poolIndex].push(entity);
            });
            // Log pool distribution
            pools.forEach((pool, apiIndex) => {
                console.log(`📦 Pool ${apiIndex + 1} (API ${apiIndex + 1}): ${pool.length} entities - ${pool.map(e => e.organization_name).join(', ')}`);
            });
            // Process pools in parallel with Promise.all
            const poolPromises = pools.map((pool, apiIndex) => this.processPool(pool, apiIndex, institutionName, institutionCountry, combinedSignal, fromDate, toDate, retryAttempts, onProgress, riskEntities.length));
            // Wait for all pools to complete
            const poolResults = await Promise.all(poolPromises);
            clearTimeout(timeoutId);
            // Flatten and collect all results
            const allResults = poolResults.flat().filter(result => result !== null);
            console.log(`🎯 Concurrent pool search completed: ${allResults.length}/${riskEntities.length} successful`);
            return allResults;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Concurrent pool search operation failed: ${error}`, 'POOL_SEARCH_FAILED', 500);
        }
        finally {
            // Clear any remaining active calls
            this.activeCalls.clear();
        }
    }
    /**
     * Process a single pool of entities sequentially with one API key
     * This ensures predictable, stable performance without complex rate limiting
     */
    async processPool(entities, apiIndex, institutionName, institutionCountry, signal, fromDate, toDate, retryAttempts = 3, onProgress, totalEntities = 0) {
        const results = [];
        let completedInPool = 0;
        console.log(`🏊 Pool ${apiIndex + 1} starting sequential processing of ${entities.length} entities`);
        for (const entity of entities) {
            if (signal.aborted) {
                console.log(`🛑 Pool ${apiIndex + 1} aborted`);
                throw new DatasetSearchTypes_1.DatasetSearchError('Search operation was cancelled', 'SEARCH_CANCELLED', 499);
            }
            try {
                completedInPool++;
                const globalCompleted = this.calculateGlobalProgress(apiIndex, completedInPool, entities.length);
                console.log(`🔍 Pool ${apiIndex + 1} - Entity ${completedInPool}/${entities.length} (Global: ${globalCompleted}/${totalEntities}): ${entity.organization_name}`);
                const result = await this.performSingleSearch(institutionName, entity.organization_name, entity.countries[0] || institutionCountry, apiIndex, signal, fromDate, toDate, retryAttempts);
                results.push(result);
                // Report progress with global count
                if (onProgress) {
                    onProgress(globalCompleted, totalEntities, result, apiIndex);
                }
                console.log(`✅ Pool ${apiIndex + 1} - Entity ${completedInPool}/${entities.length} completed`);
            }
            catch (error) {
                const globalCompleted = this.calculateGlobalProgress(apiIndex, completedInPool, entities.length);
                console.error(`❌ Pool ${apiIndex + 1} - Entity ${completedInPool}/${entities.length} failed:`, error instanceof Error ? error.message : String(error));
                results.push(null);
                // Report failure progress
                if (onProgress) {
                    onProgress(globalCompleted, totalEntities, undefined, apiIndex);
                }
            }
        }
        console.log(`✅ Pool ${apiIndex + 1} completed: ${results.filter(r => r !== null).length}/${entities.length} successful`);
        return results;
    }
    /**
     * Calculate global progress across all pools
     * This ensures progress reporting reflects overall completion, not just per-pool
     */
    calculateGlobalProgress(poolIndex, completedInPool, poolSize) {
        // Each pool processes entities sequentially
        // Global progress = (poolIndex * average pool size) + completedInPool
        // Simplified: just increment based on actual completion across all pools
        // This is called from single pool, so we track completion globally via onProgress callback
        return completedInPool; // Actual global tracking handled in controller via completed counter
    }
    /**
     * Search for a single institution-entity relationship
     */
    async searchSingleRelationship(institutionName, riskEntityName, country, signal) {
        try {
            return await this.performSingleSearch(institutionName, riskEntityName, country, 0, signal);
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Single relationship search failed: ${error.message}`, 'SINGLE_SEARCH_FAILED', 500);
        }
    }
    /**
     * Test the Linkup API connection
     */
    async testConnection() {
        try {
            const testResponse = await this.searchSingleRelationship('Test Institution', 'Test Entity', 'Test Country');
            return !!(testResponse && testResponse.answer);
        }
        catch (error) {
            console.error('Linkup API connection test failed:', error);
            return false;
        }
    }
    /**
     * Get current rate limit status for all APIs
     */
    getRateLimitStatus() {
        return this.rateLimiters.map((limiter, index) => {
            this.refillTokens(index);
            return {
                apiIndex: index,
                tokens: limiter.tokens,
                maxTokens: limiter.maxTokens,
                refillRate: limiter.tokensPerSecond
            };
        });
    }
    /**
     * Cancel all active searches
     */
    cancelAllSearches() {
        this.activeCalls.clear();
    }
}
exports.LinkupSearchService = LinkupSearchService;
//# sourceMappingURL=LinkupSearchService.js.map