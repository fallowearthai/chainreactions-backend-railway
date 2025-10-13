"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkupService = void 0;
const axios_1 = __importDefault(require("axios"));
const LinkupAPIMonitor_1 = require("../../utils/LinkupAPIMonitor");
class LinkupService {
    constructor() {
        this.apiKey = process.env.LINKUP_API_KEY || '';
        this.baseURL = process.env.LINKUP_BASE_URL || 'https://api.linkup.so/v1';
        if (!this.apiKey) {
            console.warn('⚠️ LINKUP_API_KEY not configured. Service may not function properly.');
        }
    }
    getDefaultExcludeDomains() {
        // Conservative list of low-quality domains to exclude
        // (Linkup API may have limits on number of excluded domains)
        return [
            'wikipedia.org',
            'reddit.com',
            'quora.com',
            'pinterest.com'
        ];
    }
    buildSearchQuery(companyName, location) {
        // Professional business intelligence analyst prompt based on N8N workflow
        const basePrompt = `Act as a professional business intelligence analyst. Given a specific company name and address, your goal is to accurately identify the correct company entity. Search authoritative sources, including the official company website, government registries, reputable business directories, SEC filings, press releases, and partnership announcements. If multiple companies with similar or identical names are found, set 'similar_name_companies_exist' to true and provide a list of these entities with distinguishing details. For the identified company, return a JSON object with these fields: original_name (as registered), english_name, past_names (list of previous names), description (concise summary of main activities and industry in English), headquarters (full registered address), sectors (primary business sectors), similar_name_companies_exist (true/false), vendors (key suppliers or vendors with specific details and source URLs), partnerships (notable business partnerships, joint ventures, strategic alliances with specific details and source URLs), Research References (comprehensive list of all source URLs used for each field with titles and relevance). CRITICAL: For vendors and partnerships, always include the specific source URL where this information was found. Ensure all data is current, accurate, and cite the source URL for each field. Format your response as a single, well-structured JSON object.`;
        const companyInfo = `Company_name = ${companyName}`;
        const locationInfo = location ? `Company_location = ${location}` : '';
        return `${basePrompt}${companyInfo}${locationInfo}`;
    }
    async searchEntity(companyName, location, customExcludeDomains) {
        try {
            console.log(`🔍 Searching entity: "${companyName}"${location ? ` in ${location}` : ''}`);
            const searchQuery = this.buildSearchQuery(companyName, location);
            // Combine default and custom exclude domains
            const defaultExcludes = this.getDefaultExcludeDomains();
            const allExcludes = customExcludeDomains
                ? [...defaultExcludes, ...customExcludeDomains]
                : defaultExcludes;
            // Remove duplicates
            const uniqueExcludes = [...new Set(allExcludes)];
            const requestBody = {
                q: searchQuery,
                depth: "standard",
                outputType: "sourcedAnswer",
                excludeDomains: uniqueExcludes
            };
            console.log('📤 Sending Linkup API request:', {
                endpoint: `${this.baseURL}/search`,
                queryLength: searchQuery.length,
                company: companyName,
                location: location || 'not specified',
                excludeDomainsCount: uniqueExcludes.length,
                excludedDomains: uniqueExcludes.slice(0, 5) // Show first 5 for logging
            });
            const response = await axios_1.default.post(`${this.baseURL}/search`, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000, // 60 second timeout for comprehensive search
                proxy: false, // Disable proxy to avoid connection issues
            });
            console.log('✅ Linkup API response received:', {
                status: response.status,
                hasAnswer: !!response.data?.answer,
                hasSources: !!response.data?.sources,
                answerLength: response.data?.answer?.length || 0,
                sourcesCount: response.data?.sources?.length || 0
            });
            // Record successful API call
            LinkupAPIMonitor_1.linkupAPIMonitor.recordCall('entity-search', 'entity-search', true);
            return {
                success: true,
                data: response.data
            };
        }
        catch (error) {
            console.error('❌ Error calling Linkup API:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                company: companyName
            });
            // Record failed API call
            LinkupAPIMonitor_1.linkupAPIMonitor.recordCall('entity-search', 'entity-search', false);
            return {
                success: false,
                error: error.response?.data?.message || error.message || 'Unknown error occurred'
            };
        }
    }
    async testConnection() {
        try {
            console.log('🧪 Testing Linkup API connection...');
            console.warn('⚠️ WARNING: This will consume Linkup API credits by calling /credits/balance');
            // IMPORTANT: This endpoint may consume credits!
            // Use credits/balance endpoint for connection test
            const response = await axios_1.default.get(`${this.baseURL}/credits/balance`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000, // 10 second timeout for test
                proxy: false, // Disable proxy to avoid connection issues
            });
            console.log('✅ Linkup API connection test successful:', {
                status: response.status,
                data: response.data
            });
            // Record test API call
            LinkupAPIMonitor_1.linkupAPIMonitor.recordCall('credits/balance', 'test-connection', true);
            return {
                success: true,
                data: {
                    status: 'connected',
                    message: 'Linkup API connection successful (may have consumed credits)',
                    timestamp: new Date().toISOString(),
                    credits: response.data,
                    warning: 'This test may consume Linkup API credits'
                }
            };
        }
        catch (error) {
            console.error('❌ Linkup API connection test failed:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            // Record failed test API call
            LinkupAPIMonitor_1.linkupAPIMonitor.recordCall('credits/balance', 'test-connection', false);
            return {
                success: false,
                error: error.response?.data?.message || error.message || 'Connection test failed'
            };
        }
    }
    /**
     * Lightweight configuration check - does NOT call any API
     * Use this for health checks to avoid consuming credits
     */
    checkConfiguration() {
        return {
            configured: this.isConfigured(),
            baseURL: this.baseURL,
            hasApiKey: !!this.apiKey && this.apiKey.length > 0
        };
    }
    isConfigured() {
        return !!this.apiKey;
    }
}
exports.LinkupService = LinkupService;
//# sourceMappingURL=LinkupService.js.map