"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardSearchController = void 0;
const GeminiService_1 = require("../services/GeminiService");
const FeatureFlags_1 = require("../utils/FeatureFlags");
class StandardSearchController {
    constructor() {
        this.geminiService = new GeminiService_1.GeminiService();
    }
    /**
     * Optimized response formatter v2.1.0 - streamlined for frontend efficiency
     * Eliminates key_evidence and sources processing (frontend uses inline citations)
     */
    formatOptimizedSearchResults(result, processingTime) {
        // Handle intermediary_B array conversion to string
        let intermediaryString = 'None';
        if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
            intermediaryString = result.potential_intermediary_B.join(', ');
        }
        else if (typeof result.potential_intermediary_B === 'string' && result.potential_intermediary_B) {
            intermediaryString = result.potential_intermediary_B;
        }
        // Create empty sources and key_evidence arrays (frontend no longer uses these)
        const sources = [];
        const processedKeyEvidence = [];
        // Create quality metrics (simplified for streamlined structure)
        const qualityMetrics = {
            evidence_count: 0,
            source_count: 0,
            coverage_percentage: 0,
            source_quality_score: result.quality_metrics?.source_quality_score
        };
        // Determine enhanced mode
        const enhancedMode = FeatureFlags_1.FeatureFlags.shouldUseEnhancedGrounding();
        return {
            version: '2.1.0',
            success: true,
            data: {
                // Core business data (flattened, no redundancy)
                risk_item: result.risk_item,
                institution_A: result.institution_A,
                relationship_type: result.relationship_type,
                finding_summary: result.finding_summary,
                potential_intermediary_B: intermediaryString,
                // Source data information (empty - frontend uses grounding metadata)
                sources: sources,
                sources_count: 0,
                // Key evidence (empty - frontend uses inline citations)
                key_evidence: processedKeyEvidence,
                // Quality metrics (simplified)
                quality_metrics: qualityMetrics,
                // Grounding metadata (critical for inline citations)
                grounding_metadata: result.grounding_metadata
            },
            // Metadata
            metadata: {
                timestamp: new Date().toISOString(),
                processing_time_ms: processingTime,
                enhanced_mode: enhancedMode,
                api_version: '1.0.0'
            }
        };
    }
    // Legacy formatSearchResults() function removed - now only using Optimized Format v2.1.0
    async handleStandardSearch(req, res) {
        try {
            const searchRequest = {
                Target_institution: req.body.Target_institution,
                Risk_Entity: req.body.Risk_Entity,
                Location: req.body.Location,
                Start_Date: req.body.Start_Date,
                End_Date: req.body.End_Date
            };
            // Validate required fields
            if (!searchRequest.Target_institution || !searchRequest.Risk_Entity) {
                res.status(400).json({
                    error: 'Missing required fields: Target_institution, Risk_Entity'
                });
                return;
            }
            console.log('📨 Standard Search Request:', searchRequest);
            // Execute search using GeminiService's verifyCompanyEntity method
            const startTime = Date.now();
            const result = await this.geminiService.verifyCompanyEntity(searchRequest.Risk_Entity, searchRequest.Location, searchRequest.Target_institution, {
                start: searchRequest.Start_Date,
                end: searchRequest.End_Date
            });
            // Handle no result case - Always use Optimized Format v2.1.0
            if (!result) {
                res.status(200).json({
                    version: '2.1.0',
                    success: true,
                    data: {
                        risk_item: searchRequest.Risk_Entity,
                        institution_A: searchRequest.Target_institution,
                        relationship_type: 'No Evidence Found',
                        finding_summary: 'After thorough search, no evidence of connection was found.',
                        potential_intermediary_B: 'None',
                        sources: [],
                        sources_count: 0,
                        key_evidence: [],
                        quality_metrics: {
                            evidence_count: 0,
                            source_count: 0,
                            coverage_percentage: 0
                        }
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        enhanced_mode: false,
                        api_version: '1.0.0'
                    }
                });
                console.log('✅ Returned Optimized Format v2.1.0 (no results)');
                return;
            }
            // Always use Optimized Format v2.1.0
            const processingTime = Date.now() - startTime;
            // Convert GeminiService result to match expected format
            const normalSearchResult = {
                risk_item: result.risk_item || searchRequest.Risk_Entity,
                institution_A: result.institution_A || searchRequest.Target_institution,
                relationship_type: result.relationship_type || 'Unknown',
                finding_summary: result.finding_summary || 'No clear findings established.',
                potential_intermediary_B: result.potential_intermediary_B || [],
                sources: result.sources || [],
                key_evidence: result.key_evidence || [],
                quality_metrics: result.quality_metrics || {
                    evidence_count: 0,
                    source_count: 0,
                    coverage_percentage: 0
                }
            };
            const responseResult = this.formatOptimizedSearchResults(normalSearchResult, processingTime);
            // Include grounding_supports data if available
            if (result.grounding_metadata && result.grounding_metadata.grounding_supports) {
                responseResult.data.grounding_metadata = result.grounding_metadata;
            }
            // 🔍 [DEBUG] Log key evidence data
            console.log('🔍 [BACKEND DEBUG] Key Evidence Data:', {
                key_evidence_count: responseResult.data.key_evidence?.length || 0,
                key_evidence_sample: responseResult.data.key_evidence?.slice(0, 2),
                sources_count: responseResult.data.sources_count
            });
            console.log('✅ Standard Search completed - Using Optimized Format v2.1.0');
            res.status(200).json(responseResult);
        }
        catch (error) {
            console.error('❌ Standard Search Error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error during standard search',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }
    async healthCheck(req, res) {
        res.status(200).json({
            status: 'healthy',
            service: 'entity_relations_deepthinking',
            version: '1.0.0',
            port: process.env.PORT || 4002,
            features: [
                'Google Web Search via Gemini API',
                'Multi-language OSINT analysis',
                'Time-range filtering',
                'Relationship type classification'
            ]
        });
    }
    async getInfo(req, res) {
        res.status(200).json({
            service: 'Entity Relations DeepThinking Search',
            description: 'Google Web Search based OSINT analysis using Gemini AI - DeepThinking Mode',
            search_method: 'Google Web Search (via Gemini googleSearch tool)',
            capabilities: {
                multi_language: true,
                time_range_filtering: true,
                relationship_types: [
                    'Direct',
                    'Indirect',
                    'Significant Mention',
                    'Unknown',
                    'No Evidence Found'
                ],
                intermediary_detection: true
            },
            api_endpoints: {
                search: 'POST /api/deepthinking-search',
                health: 'GET /api/health',
                info: 'GET /api/info'
            },
            request_format: {
                Target_institution: 'string (required)',
                Risk_Entity: 'string (required)',
                Location: 'string (required)',
                Start_Date: 'string (optional, YYYY-MM-DD)',
                End_Date: 'string (optional, YYYY-MM-DD)'
            },
            response_format: {
                result: 'Formatted text output',
                urls: 'Numbered source URLs',
                raw_data: {
                    risk_item: 'string',
                    institution_A: 'string',
                    relationship_type: 'string',
                    finding_summary: 'string',
                    potential_intermediary_B: 'array',
                    urls: 'string',
                    sources_count: 'number'
                }
            }
        });
    }
    /**
     * Validate if a URL is from a high-quality source
     */
    isValidSourceUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        const urlLower = url.toLowerCase();
        // Exclude social media and low-quality sources
        const excludedPatterns = [
            'facebook.com',
            'twitter.com',
            'instagram.com',
            'linkedin.com',
            'youtube.com',
            'tiktok.com',
            'reddit.com',
            'pinterest.com',
            'tumblr.com',
            'bit.ly',
            'tinyurl.com',
            'goo.gl',
            'ow.ly',
            'bit.do',
            't.co',
            'fb.me'
        ];
        for (const pattern of excludedPatterns) {
            if (urlLower.includes(pattern)) {
                return false;
            }
        }
        // Check for valid URL format
        try {
            new URL(url);
        }
        catch {
            return false;
        }
        return true;
    }
}
exports.StandardSearchController = StandardSearchController;
